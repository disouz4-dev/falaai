import React, { useEffect, useState } from "react";
import { api } from "./api.js";
import Home from "./screens/Home.jsx";
import Placement from "./screens/Placement.jsx";
import Talk from "./screens/Talk.jsx";
import Course from "./screens/Course.jsx";
import Lesson from "./screens/Lesson.jsx";
import Profile from "./screens/Profile.jsx";
import Progress from "./screens/Progress.jsx";
import Practice from "./screens/practice/Practice.jsx";

// PT-BR: undefined = carregando sessão; null = deslogado; objeto = logado.
// EN:    undefined = session loading; null = logged out; object = logged in.
function initAuthState() {
  return undefined;
}

// PT-BR: detecta se estamos dentro do app desktop (webview Tauri). EN: detect Tauri webview.
function isTauriEnvironment() {
  return typeof window !== "undefined" && !!(window.__TAURI_INTERNALS__ || window.__TAURI__);
}

export default function App() {
  const [authUser, setAuthUser] = useState(initAuthState);
  const [loginError, setLoginError] = useState("");
  const [screen, setScreen] = useState("home");
  const [profile, setProfile] = useState(null);
  const [health, setHealth] = useState(null);
  const [lessonId, setLessonId] = useState(null);
  const [deferredInstall, setDeferredInstall] = useState(null);
  const [update, setUpdate] = useState(null);   // {current, latest, update_available, url}
  const [updating, setUpdating] = useState(false);
  // PT-BR: atualizar só é permitido no próprio computador. EN: updating only allowed on the host.
  const isLocalhost = ["localhost", "127.0.0.1", "::1"].includes(location.hostname);

  const nav = (name, arg) => {
    if (name === "lesson") setLessonId(arg);
    setScreen(name);
  };

  // PT-BR: o app SEMPRE começa deslogado: mostra a tela de login com o botão "Entrar".
  //        O usuário só entra (login local) ao clicar no botão — o acesso é feito depois
  //        do login explícito. EN: the app ALWAYS starts logged-out: it shows the login
  //        screen with an "Entrar" (Sign in) button. The user only signs in (local login)
  //        by clicking the button — access requires an explicit, user-initiated login.
  useEffect(() => {
    setAuthUser(null);
  }, []);

  // PT-BR: quando entra um 401 (token expirado/inválido), força o logout limpo.
  // EN:    on a 401 (expired/invalid token), force a clean sign-out.
  useEffect(() => {
    const onAuthRequired = () => { setLoginError("Sessão expirada. Entre novamente."); };
    window.addEventListener("guaralingo:auth-required", onAuthRequired);
    return () => window.removeEventListener("guaralingo:auth-required", onAuthRequired);
  }, []);

  // PT-BR: boot — só dispara DEPOIS de logado. EN: boot — only after login.
  useEffect(() => {
    if (!authUser) return;
    api.get("/api/health").then(setHealth).catch(() => setHealth({ error: true }));
    api.get("/api/profile")
      .then((d) => {
        setProfile(d.profile);
        if (!d.profile) setScreen("profile");
      })
      .catch(() => {});
    api.get("/api/version").then(setUpdate).catch(() => {});
  }, [authUser]);

  const [checking, setChecking] = useState(false);
  async function recheck() {
    setChecking(true);
    try { setUpdate(await api.get("/api/version?force=true")); } catch {}
    setChecking(false);
  }

  // PT-BR: atualiza o app. No app desktop (Tauri) chama o backend (baixa o .deb e instala
  //        por cima) e reinicia o app; no navegador faz git pull + rebuild (no servidor) e
  //        espera o servidor voltar para recarregar.
  // EN:    update the app. In the desktop app (Tauri) it calls the backend (downloads the
  //        .deb and installs it over) then relaunches the app; in the browser it does git
  //        pull + rebuild (on the server) and waits for the server to come back to reload.
  async function doUpdate() {
    setUpdating(true);
    try {
      const result = await api.post("/api/update");
      if (isTauriEnvironment() && result?.ok) {
        // PT-BR: desktop — pede ao Rust para reiniciar o app (binário novo). EN: desktop —
        //        ask Rust to relaunch the app (new binary).
        try {
          await window.__TAURI_INTERNALS__.invoke("relaunch_app");
        } catch {}
      }
    } catch {}
    if (!isTauriEnvironment()) {
      let sawDown = false;
      const start = Date.now();
      const poll = async () => {
        try {
          await fetch("/api/health");
          if (sawDown) { location.reload(); return; }
        } catch { sawDown = true; }
        if (Date.now() - start < 120000) setTimeout(poll, 2000);
        else location.reload();
      };
      setTimeout(poll, 4000);
    }
  }

  // PT-BR: captura o evento de instalação (PWA). EN: capture the install event (PWA).
  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setDeferredInstall(e); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const doInstall = async () => {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    await deferredInstall.userChoice;
    setDeferredInstall(null);
  };

  // PT-BR: login local explícito (offline). Ao clicar em "Entrar" tenta o login local;
  //        no primeiro boot o backend do app pode ainda estar subindo, então tenta de novo
  //        com backoff. EN: explicit LOCAL login (offline). On "Entrar" (Sign in) it tries
  //        the local login; on first run the app's backend may still be starting, so it
  //        retries with backoff.
  const [loggingIn, setLoggingIn] = useState(false);
  async function handleLogin() {
    setLoginError("");
    setLoggingIn(true);
    try {
      const { loginLocal } = await import("./localauth.js");
      for (let attempt = 0; attempt < 12; attempt++) {
        try {
          const data = await loginLocal();
          setAuthUser(data.user);
          return;
        } catch (e) {
          if (attempt === 11) {
            throw new Error("não foi possível conectar ao servidor local");
          }
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
    } catch (e) {
      setLoginError("Não foi possível entrar: " + (e?.message || e));
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleLogout() {
    try {
      const { clearLocalToken } = await import("./localauth.js");
      clearLocalToken();
    } catch {}
    setProfile(null);
    setAuthUser(null);
    setScreen("home");
  }

  // PT-BR: tela de carregamento da sessão. EN: session loading screen.
  if (authUser === undefined) {
    return (
      <section className="screen active">
        <div className="panel center-panel">
          <div className="brand">🐺 <span>Guaralingo</span></div>
          <p className="subtitle">Carregando…</p>
        </div>
      </section>
    );
  }

  // PT-BR: tela de login (login local/offline). EN: login screen (local/offline).
  if (authUser === null) {
    return (
      <section className="screen active">
        <div className="panel center-panel">
          <div className="brand" style={{ fontSize: 28 }}>🐺 <span>Guaralingo</span></div>
          <h2>Bem-vindo(a)!</h2>
          <p className="subtitle" style={{ marginBottom: 20 }}>
            O Guaralingo guarda seu progresso neste dispositivo.
          </p>
          <button className="btn-primary" onClick={handleLogin} disabled={loggingIn}>
            {loggingIn ? "Entrando…" : "Entrar"}
          </button>
          {loginError && <p className="auth-error">{loginError}</p>}
          {loggingIn && (
            <p className="auth-hint">Conectando ao servidor local…</p>
          )}
        </div>
      </section>
    );
  }

  const statusPill = health?.error
    ? { cls: "off", txt: "sem servidor" }
    : health?.ollama
    ? { cls: "ok", txt: "IA ✓" }
    : { cls: "off", txt: "IA off" };

  return (
    <>
      <header className="topbar">
        <div className="brand" onClick={() => nav("home")}>🐺 <span>Guaralingo</span></div>
        <div className="topbar-right">
          <button className="icon-btn" title="Meu perfil" onClick={() => nav("profile")}>👤</button>
          {authUser?.picture ? (
            <img className="avatar" src={authUser.picture} alt={authUser.name}
              title={authUser.name + " — sair"} onClick={handleLogout} />
          ) : (
            <button className="icon-btn" title={authUser?.name + " — sair"} onClick={handleLogout}>🚪</button>
          )}
          <div className={"status-pill " + statusPill.cls} title="Estado do Ollama">{statusPill.txt}</div>
        </div>
      </header>

      {update?.update_available && (
        <div className="update-bar">
          <span>🎉 Nova versão <strong>{update.latest}</strong> disponível!</span>
          {isLocalhost ? (
            <button className="update-btn" disabled={updating} onClick={doUpdate}>
              {updating ? "Atualizando…" : "Atualizar"}
            </button>
          ) : (
            <span className="update-hint">Atualize pelo computador que roda o servidor.</span>
          )}
        </div>
      )}

      <main id="app">
        {screen === "home" && (
          <Home nav={nav} profile={profile} deferredInstall={deferredInstall} onInstall={doInstall}
            update={update} checking={checking} recheck={recheck}
            isLocalhost={isLocalhost} updating={updating} onUpdate={doUpdate} />
        )}
        {(screen === "test-intro" || screen === "test" || screen === "result") && (
          <Placement screen={screen} nav={nav} />
        )}
        {screen === "talk" && <Talk nav={nav} profile={profile} />}
        {screen === "course" && <Course nav={nav} />}
        {screen === "lesson" && <Lesson nav={nav} lessonId={lessonId} />}
        {screen === "profile" && <Profile nav={nav} profile={profile} setProfile={setProfile} />}
        {screen === "progress" && <Progress nav={nav} />}
        {screen === "practice" && <Practice nav={nav} profile={profile} />}
      </main>
    </>
  );
}
