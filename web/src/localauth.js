// PT-BR: Auth LOCAL para o app desktop (Tauri). Usamos login 100% local/offline: o backend
//        cria um perfil/uid local e devolve um token assinado. Não há contas nem nuvem.
// EN:    LOCAL auth for the Tauri desktop app. We use 100% local/offline login: the backend
//        creates a local profile/uid and returns a signed token. No accounts and no cloud.

const KEY = "guaralingo_local_token";

// PT-BR: porta do backend local do app desktop (não-HTTPS, sem root). EN: local backend port.
export const LOCAL_PORT = 8000;
// PT-BR: o backend escuta em 127.0.0.1; usar 127.0.0.1 evita que "localhost" resolva para
//        IPv6 (::1) e a conexão falhe. EN: backend binds to 127.0.0.1; using it avoids
//        "localhost" resolving to IPv6 (::1) and the connection failing.
const LOCAL_HOST = "127.0.0.1";

export function isTauri() {
  if (typeof window === "undefined") return false;
  // PT-BR: Tauri v2 injeta __TAURI_INTERNALS__ (ou __TAURI__) no webview; também
  //        detectamos pela origem do protocolo. EN: detect Tauri webview via the injected
  //        internals object and/or the origin protocol.
  if (window.__TAURI_INTERNALS__ || window.__TAURI__) return true;
  try {
    // PT-BR: no Linux (WebKitGTK) o Tauri v2 serve a UI em tauri://localhost;
    //        em dev usa http://tauri.localhost. EN: on Linux the UI runs on tauri://localhost.
    const p = location.protocol;
    if (p === "tauri:") return true;
    // PT-BR: tenta ler o objeto interno (acessar propriedade prova que a origem é do webview)
    //        EN: reading a property confirms we are on the Tauri webview origin.
    if (location.protocol.startsWith("http") && location.hostname === "tauri.localhost") return true;
  } catch {}
  return false;
}

// PT-BR: URL base do backend. No app Tauri usa o endereço local absoluto; no navegador os
//        caminhos relativos funcionam (o mesmo FastAPI serve o frontend e a API).
// EN:    backend base URL. In Tauri it uses the absolute local address; in the browser
//        relative paths work (the same FastAPI serves the frontend and the API).
export function apiBase() {
  if (isTauri()) {
    return `http://${LOCAL_HOST}:${LOCAL_PORT}`;
  }
  return "";
}

export function getLocalToken() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

function storeToken(t) {
  try { localStorage.setItem(KEY, t); } catch {}
}

export function clearLocalToken() {
  try { localStorage.removeItem(KEY); } catch {}
}

/** PT-BR: faz o login local (background) e devolve {token, user, profile}.
 *  EN: perform local login (background) and return {token, user, profile}. */
export async function loginLocal() {
  const res = await fetch(apiBase() + "/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "" }),
  });
  if (!res.ok) throw new Error("Falha no login local / Local login failed");
  const data = await res.json();
  storeToken(data.token);
  return data;
}

/** PT-BR: devolve o usuário local atual (token → uid) ou null se ainda não logado.
 *  EN: return current local user (token → uid) or null if not yet logged in. */
export function getLocalUserFromToken(token) {
  if (!token) return null;
  try {
    const payloadB64 = token.split(".")[1];
    const padded = payloadB64 + "=".repeat((4 - (payloadB64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    return {
      uid: payload.uid,
      name: payload.name || "Aluno(a)",
      email: payload.email,
      picture: payload.picture,
      local: true,
    };
  } catch { return null; }
}
