"""
PT-BR: Autenticação LOCAL do Fala A.I. (app desktop, sem contas nem nuvem).
       O app usa apenas login local: gera um token assinado (HMAC) quando o usuário
       clica em "Entrar" e valida esse token a cada requisição. Tudo fica neste
       dispositivo: nenhuma conta externa, criação de conta nem envio de dados para a internet.
EN:    LOCAL authentication for Fala A.I. (desktop app, no accounts and no cloud).
       The app uses local login only: it mints a signed (HMAC) token when the user clicks
       "Entrar" and validates that token on every request. Everything stays on this
       device: no external account, no account creation, and no data sent to the internet.
"""

import base64
import hashlib
import hmac
import json
import os

# PT-BR: segredo fixo do app para assinar tokens LOCAIS (login local desktop).
#        Só serve para não deixar qualquer uid forjado passar sem assinatura.
# EN: fixed app secret that signs LOCAL tokens (desktop local login). It only keeps a
#     forged uid from passing without a signature.
LOCAL_SECRET = os.environ.get("FALA_AI_LOCAL_SECRET", "falaai.local-desktop-secret-v1")


def _sign(msg: str) -> str:
    """PT-BR: HMAC-SHA256 do payload (firma o token local). EN: HMAC of the payload."""
    return hmac.new(LOCAL_SECRET.encode(), msg.encode(), hashlib.sha256).hexdigest()


def create_local_token(uid: str, name: str = "", email: str = "", picture: str = "") -> str:
    """PT-BR: gera um token local assinado p/ o app desktop. EN: mint a signed local token."""
    payload = json.dumps({"uid": uid, "name": name, "email": email, "picture": picture})
    b64 = base64.urlsafe_b64encode(payload.encode()).decode().rstrip("=")
    return f"local.{b64}.{_sign(payload)}"


def _parse_local_token(value: str):
    """PT-BR: valida e decodifica um token local. Lança ValueError se inválido.
    EN: validate & decode a local token; raise ValueError if invalid."""
    parts = value.split(".")
    if len(parts) != 3 or parts[0] != "local":
        raise ValueError("Token local malformado / Malformed local token")
    _, b64, sig = parts
    try:
        payload_b64 = b64 + "=" * (-len(b64) % 4)
        payload = base64.urlsafe_b64decode(payload_b64).decode()
    except Exception:
        raise ValueError("Token local ilegível / Unreadable local token")
    expected = _sign(payload)
    if not hmac.compare_digest(expected, sig):
        raise ValueError("Assinatura local inválida / Invalid local signature")
    data = json.loads(payload)
    return {
        "uid": data.get("uid"),
        "email": data.get("email"),
        "name": data.get("name"),
        "picture": data.get("picture"),
        "local": True,
    }


def get_uid_from_header(authorization: str):
    """PT-BR: extrai e valida o token do header 'Authorization: Bearer <token>'.
    Aceita apenas token LOCAL (login desktop). EN: extract & validate the bearer token
    from the 'Authorization' header. Accepts only LOCAL (desktop) tokens."""
    if not authorization:
        raise ValueError("Autenticação necessária / Authentication required")
    scheme, _, value = authorization.partition(" ")
    if scheme.lower() != "bearer" or not value.strip():
        raise ValueError("Header de autorização inválido / Bad Authorization header")
    value = value.strip()
    if value.startswith("local."):
        return _parse_local_token(value)
    raise ValueError("Apenas tokens locais são aceitos / Only local tokens are accepted")
