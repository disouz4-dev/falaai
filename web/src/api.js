// PT-BR: Helpers de API e formatação. Toda chamada envia o token LOCAL (Bearer) para o
//        backend identificar o usuário (login local/offline).
// EN:    API and formatting helpers. Every call sends the LOCAL token (Bearer) so the
//        backend can identify the user (local/offline login).

// PT-BR: pega o token local atual (se logado). EN: get the current local token (if logged in).
async function _token() {
  const { getLocalToken } = await import("./localauth.js");
  return getLocalToken();
}

async function _fetch(path, options = {}) {
  const token = await _token();
  const { apiBase } = await import("./localauth.js");
  const headers = { ...(options.headers || {}) };
  if (token) headers["Authorization"] = "Bearer " + token;
  const res = await fetch(apiBase() + path, { ...options, headers });
  // PT-BR: 401 = token inválido/expirado; deixa o App saber. EN: 401 = invalid/expired token.
  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent("falaai:auth-required"));
  }
  return res;
}

export const api = {
  get: (path) => _fetch(path).then((r) => r.json()),
  post: (path, body) =>
    _fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }).then((r) => r.json()),
};

export const skillLabel = (s) =>
  ({ grammar: "Gramática", vocabulary: "Vocabulário", reading: "Leitura" }[s] || s);

function escapeHTML(str) {
  const d = document.createElement("div");
  d.textContent = str == null ? "" : String(str);
  return d.innerHTML;
}

// PT-BR: markdown mínimo (**negrito**). EN: minimal markdown (**bold**).
export function mdLite(str) {
  return escapeHTML(str).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

// PT-BR: renderiza um bloco de material (títulos, negrito, itálico, listas). EN: material block.
export function mdBlock(str) {
  const lines = String(str || "").split("\n");
  let html = "", inList = false;
  const inline = (s) =>
    escapeHTML(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*]+?)\*/g, "$1<em>$2</em>");
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { if (inList) { html += "</ul>"; inList = false; } continue; }
    if (/^-\s+/.test(line)) {
      if (!inList) { html += "<ul>"; inList = true; }
      html += "<li>" + inline(line.replace(/^-\s+/, "")) + "</li>";
    } else {
      if (inList) { html += "</ul>"; inList = false; }
      if (/^###\s/.test(line)) html += "<h3>" + inline(line.slice(4)) + "</h3>";
      else if (/^##\s/.test(line)) html += "<h3>" + inline(line.slice(3)) + "</h3>";
      else html += "<p>" + inline(line) + "</p>";
    }
  }
  if (inList) html += "</ul>";
  return html;
}
