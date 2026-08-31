import React, { useEffect, useState } from "react";
import { api } from "./api.js";
import { signInWithGoogle, signOutFirebase, onAuth } from "./firebase.js";
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

  // PT-BR: observa a sessão Firebase (login/logout). EN: watch the Firebase session.
  useEffect(() => {
    const unsub = onAuth((user) => {
      setAuthUser(user);
      setLoginError("");
    });
    return unsub;
  }, []);

  // PT-BR: quando entra um 401 (token expirado/inválido), força o logout limpo.
  // EN:    on a 401 (expired/invalid token), force a clean sign-out.
  useEffect(() => {
    const onAuthRequired = () => { setLoginError("Sessão expirada. Entre novamente."); };
    window.addEventListener("openlingo:auth-required", onAuthRequired);
    return () => window.removeEventListener("openlingo:auth-required", onAuthRequired);
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

  // PT-BR: atualiza (git pull + rebuild) e espera o servidor voltar, então recarrega.
  // EN:    update (git pull + rebuild), wait for the server to come back, then reload.
  async function doUpdate() {
    setUpdating(true);
    try { await api.post("/api/update"); } catch {}
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

  async function handleLogin() {
    setLoginError("");
    try {
      await signInWithGoogle();
    } catch (e) {
      // PT-BR: domínio não autorizado ou popup bloqueado. EN: unauthorized domain or blocked popup.
      setLoginError("Não foi possível entrar: " + (e?.message || e));
    }
  }

  async function handleLogout() {
    try { await signOutFirebase(); } catch {}
    setProfile(null);
    setScreen("home");
  }

  // PT-BR: tela de carregamento da sessão. EN: session loading screen.
  if (authUser === undefined) {
    return (
      <section className="screen active">
        <div className="panel center-panel">
          <div className="brand">🦜 <span>OpenLingo</span></div>
          <p className="subtitle">Carregando…</p>
        </div>
      </section>
    );
  }

  // PT-BR: tela de login. EN: login screen.
  if (authUser === null) {
    return (
      <section className="screen active">
        <div className="panel center-panel">
          <div className="brand" style={{ fontSize: 28 }}>🦜 <span>OpenLingo</span></div>
          <h2>Bem-vindo(a)!</h2>
          <p className="subtitle" style={{ marginBottom: 20 }}>
            Entre com sua conta Google para guardar seu progresso.
          </p>
          <button className="btn-primary glogin" onClick={handleLogin}>
            <span className="glogo">G</span> Entrar com Google
          </button>
          {loginError && <p className="auth-error">{loginError}</p>}
          <p className="auth-hint">
            Dica: por segurança, o Google só aceita domínios autorizados. Está no túnel
            temporário? Registre a URL atual no Firebase Console → Authentication →
            Authorized domains.
          </p>
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
        <div className="brand" onClick={() => nav("home")}>🦜 <span>OpenLingo</span></div>
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
