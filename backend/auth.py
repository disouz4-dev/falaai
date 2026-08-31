"""
PT-BR: Validação de tokens de ID do Firebase Auth no backend.
       O token de ID é um JWT assinado com o certificado público do projeto Firebase
       (publicado pelo Google). Validamos a assinatura, o emissor, o público e o tempo,
       sem precisar de service account nem do SDK firebase-admin. Isso mantém o app leve
       e local, e adiciona multi-usuário de verdade por uid.
EN:    Firebase Auth ID-token validation for the backend.
       The ID token is a JWT signed with the project's public certificate (published by
       Google). We verify signature, issuer, audience and time — no service account or
       firebase-admin SDK needed. Keeps the app light/local while adding real per-uid users.
"""

import json
import os
import time
import urllib.request

import jwt  # PyJWT

# PT-BR: seu projeto Firebase (igual ao firebaseConfig do frontend). EN: your Firebase project.
FIREBASE_PROJECT_ID = os.environ.get("OPENLINGO_FIREBASE_PROJECT", "openlingo-app")

# PT-BR: onde o Google publica as chaves públicas de assinatura dos tokens deste projeto.
# EN: where Google publishes this project's public signing keys.
_CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
_CERTS = None
_CERTS_FETCHED = 0.0
_CERTS_TTL = 60 * 60  # PT-BR: revalida as chaves a cada hora. EN: refresh keys every hour.


def _public_keys():
    """PT-BR: busca e faz cache das chaves públicas do projeto (uma vez por hora).
    EN: fetch and cache the project's public keys (refreshed hourly)."""
    global _CERTS, _CERTS_FETCHED
    now = time.time()
    if _CERTS and (now - _CERTS_FETCHED) < _CERTS_TTL:
        return _CERTS
    try:
        with urllib.request.urlopen(_CERTS_URL, timeout=15) as r:
            data = json.loads(r.read().decode())
        _CERTS = data
        _CERTS_FETCHED = now
    except Exception:
        # PT-BR: em último caso, usa o cache antigo (pode estar desatualizado).
        # EN: fall back to stale cache as a last resort.
        pass
    return _CERTS or {}


def verify_id_token(token: str):
    """PT-BR: valida um token de ID do Firebase e devolve o uid (ou lança exceção).
    EN: validate a Firebase ID token and return the uid (or raise)."""
    if not token:
        raise ValueError("Token ausente / Missing token")
    keys = _public_keys()
    if not keys:
        raise ValueError("Não foi possível buscar as chaves públicas do Firebase / Cannot fetch Firebase keys")

    # PT-BR: descobre o kid (key id) do cabeçalho para escolher a chave certa.
    # EN: read the kid from the header to pick the right key.
    header = jwt.get_unverified_header(token)
    kid = header.get("kid")
    key = keys.get(kid)
    if not key:
        raise ValueError("Chave pública do token não encontrada / Unknown key id")

    try:
        payload = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            audience=FIREBASE_PROJECT_ID,
            issuer=f"https://securetoken.google.com/{FIREBASE_PROJECT_ID}",
            options={"verify_exp": True, "verify_iat": True, "verify_aud": True, "verify_iss": True},
        )
    except jwt.ExpiredSignatureError:
        raise ValueError("Token expirado / Token expired")
    except jwt.InvalidTokenError as e:
        raise ValueError(f"Token inválido: {e}")

    # PT-BR: retorna o uid (identidade única Firebase) + dados úteis. EN: return uid + useful fields.
    return {
        "uid": payload.get("sub"),
        "email": payload.get("email"),
        "name": payload.get("name"),
        "picture": payload.get("picture"),
        "auth_time": payload.get("auth_time"),
    }


def get_uid_from_header(authorization: str):
    """PT-BR: extrai e valida o token do header 'Authorization: Bearer <token>'.
    EN: extract and validate the token from the 'Authorization: Bearer <token>' header."""
    if not authorization:
        raise ValueError("Autenticação necessária / Authentication required")
    scheme, _, value = authorization.partition(" ")
    if scheme.lower() != "bearer" or not value.strip():
        raise ValueError("Header de autorização inválido / Bad Authorization header")
    return verify_id_token(value.strip())
