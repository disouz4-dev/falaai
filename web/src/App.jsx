import React, { useEffect, useState } from "react";
import { api } from "./api.js";
import { getLocalToken, clearLocalToken, getLocalUserFromToken, isTauri as isTauriEnv } from "./localauth.js";
import Home from "./screens/Home.jsx";
import Placement from "./screens/Placement.jsx";
import Talk from "./screens/Talk.jsx";
import Course from "./screens/Course.jsx";
import Lesson from "./screens/Lesson.jsx";
import Profile from "./screens/Profile.jsx";
import Progress from "./screens/Progress.jsx";
import Practice from "./screens/practice/Practice.jsx";

// PT-BR: estado inicial de autenticação. undefined = verificando token; null = precisa logar; objeto = logado.
// EN:    initial auth state. undefined = checking token; null = needs login; object = logged in.
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
  const [update, setUpdate] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [registering, setRegistering] = useState(false);
  const isLocalhost = ["localhost", "127.0.0.1", "::1"].includes(location.hostname);

  const nav = (name, arg) => {
    if (name === "lesson") setLessonId(arg);
    setScreen(name);
  };

  // PT-BR: no boot, verifica se há token salvo. Se houver, tenta restaurar sessão.
  //        Se não houver, mostra a tela de registro (primeira vez) ou login.
  // EN:    on boot, check for saved token. If present, try to restore session.
  //        If not, show registration screen (first time) or login.
  useEffect(() => {
    const token = getLocalToken();
    if (token) {
      const user = getLocalUserFromToken(token);
      if (user) {
        setAuthUser(user);
      } else {
        clearLocalToken();
        setAuthUser(null);
      }
    } else {
      setAuthUser(null);
    }
  }, []);

  // PT-BR: quando entra um 401 (token expirado/inválido), força o logout limpo.
  // EN:    on a 401 (expired/invalid token), force a clean sign-out.
  useEffect(() => {
    const onAuthRequired = () => { setLoginError("Sessão expirada. Entre novamente."); clearLocalToken(); setAuthUser(null); };
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

  async function recheck() {
    setChecking(true);
    try { setUpdate(await api.get("/api/version?force=true")); } catch {}
    setChecking(false);
  }

  async function doUpdate() {
    setUpdating(true);
    try {
      const result = await api.post("/api/update");
      if (isTauriEnv() && result?.ok) {
        try { await window.__TAURI_INTERNALS__.invoke("relaunch_app"); } catch {}
      }
    } catch {}
    if (!isTauriEnv()) {
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

  const [loggingIn, setLoggingIn] = useState(false);
  const [authTab, setAuthTab] = useState("register");
  const [form, setForm] = useState({ name: "", native_lang: "pt", goal: "", interests: "", gender_preference: "female", password: "", confirmPassword: "" });
  const [loginPassword, setLoginPassword] = useState("");
  // PT-BR: decide aba inicial: sem token = cadastro, com token = login. EN: initial tab: no token = register.
  useEffect(() => {
    if (authUser === null) setAuthTab(getLocalToken() ? "login" : "register");
  }, [authUser]);

  async function handleLogin(password) {
    setLoginError("");
    setLoggingIn(true);
    try {
      const { loginLocal } = await import("./localauth.js");
      for (let attempt = 0; attempt < 12; attempt++) {
        try {
          const data = await loginLocal("", password);
          setAuthUser(data.user);
          return;
        } catch (e) {
          if (attempt === 11) throw new Error("não foi possível conectar ao servidor local");
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
    } catch (e) {
      setLoginError("Não foi possível entrar: " + (e?.message || e));
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleRegister(profileData) {
    setLoginError("");
    setRegistering(true);
    try {
      const { loginLocal } = await import("./localauth.js");
      for (let attempt = 0; attempt < 12; attempt++) {
        try {
          const data = await loginLocal(profileData.name, profileData.password);
          // Se o perfil não existe, salva os dados do cadastro
          if (!data.profile || !data.profile.name) {
            await api.post("/api/profile", {
              name: profileData.name,
              native_lang: profileData.native_lang || "pt",
              goal: profileData.goal || "",
              interests: profileData.interests || "",
              gender_preference: profileData.gender_preference || "female"
            });
          }
          setAuthUser(data.user);
          return;
        } catch (e) {
          if (attempt === 11) throw new Error("não foi possível conectar ao servidor local");
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
    } catch (e) {
      setLoginError("Não foi possível cadastrar: " + (e?.message || e));
    } finally {
      setRegistering(false);
    }
  }

  async function handleLogout() {
    try {
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

  // PT-BR: tela de auth obrigatória — abas Criar conta / Entrar. EN: mandatory auth — tabs.
  if (authUser === null) {
    const handleSubmit = (e) => {
      e.preventDefault();
      if (!form.name.trim()) { setLoginError("Digite seu nome."); return; }
      if (!form.password) { setLoginError("Digite uma senha."); return; }
      if (form.password !== form.confirmPassword) { setLoginError("As senhas não coincidem."); return; }
      if (form.password.length < 4) { setLoginError("A senha deve ter pelo menos 4 caracteres."); return; }
      handleRegister(form);
    };
    return (
      <section className="screen active">
        <div className="panel center-panel" style={{ maxWidth: 460 }}>
          <div className="brand" style={{ fontSize: 28 }}>🐺 <span>Guaralingo</span></div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16, borderBottom: "2px solid var(--line)" }}>
            <button onClick={() => setAuthTab("register")} style={{ flex: 1, padding: "10px", border: "none", background: "none", fontWeight: 700, borderBottom: authTab === "register" ? "3px solid var(--guara)" : "3px solid transparent", color: authTab === "register" ? "var(--guara)" : "var(--muted)", cursor: "pointer" }}>Criar conta</button>
            <button onClick={() => setAuthTab("login")} style={{ flex: 1, padding: "10px", border: "none", background: "none", fontWeight: 700, borderBottom: authTab === "login" ? "3px solid var(--guara)" : "3px solid transparent", color: authTab === "login" ? "var(--guara)" : "var(--muted)", cursor: "pointer" }}>Entrar</button>
          </div>
          {authTab === "register" ? (
            <>
              <h2 style={{ marginTop: 0 }}>Criar conta</h2>
              <p className="subtitle" style={{ marginBottom: 16 }}>Seus dados ficam <strong>apenas neste dispositivo</strong> (offline). Login obrigatório para jogar.</p>
              <form onSubmit={handleSubmit}>
                <div className="field">
                  <label htmlFor="name">Seu nome *</label>
                  <input id="name" type="text" autoComplete="name" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Como devemos te chamar?" />
                </div>
                <div className="field">
                  <label htmlFor="native_lang">Idioma nativo</label>
                  <select id="native_lang" value={form.native_lang} onChange={e => setForm({...form, native_lang: e.target.value})}>
                    <option value="pt">Português (Brasil)</option>
                    <option value="es">Espanhol</option>
                    <option value="en">Inglês</option>
                    <option value="fr">Francês</option>
                    <option value="de">Alemão</option>
                    <option value="it">Italiano</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="goal">Objetivo</label>
                  <input id="goal" type="text" value={form.goal} onChange={e => setForm({...form, goal: e.target.value})} placeholder="Ex: viajar, trabalho, estudo..." />
                </div>
                <div className="field">
                  <label htmlFor="interests">Interesses (opcional)</label>
                  <textarea id="interests" rows={2} value={form.interests} onChange={e => setForm({...form, interests: e.target.value})} placeholder="Tecnologia, esportes, música..." />
                </div>
                <div className="field">
                  <label htmlFor="password">Senha *</label>
                  <input id="password" type="password" autoComplete="new-password" required value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="Crie uma senha" />
                </div>
                <div className="field">
                  <label htmlFor="confirmPassword">Confirmar senha *</label>
                  <input id="confirmPassword" type="password" autoComplete="new-password" required value={form.confirmPassword} onChange={e => setForm({...form, confirmPassword: e.target.value})} placeholder="Repita a senha" />
                </div>
                <div className="field">
                  <label>Voz do professor</label>
                  <div className="radio-group">
                    <label className="radio-option">
                      <input type="radio" name="gender_preference" value="female" checked={form.gender_preference === "female"} onChange={e => setForm({...form, gender_preference: e.target.value})} />
                      <span className="radio-label">Professora</span>
                    </label>
                    <label className="radio-option">
                      <input type="radio" name="gender_preference" value="male" checked={form.gender_preference === "male"} onChange={e => setForm({...form, gender_preference: e.target.value})} />
                      <span className="radio-label">Professor</span>
                    </label>
                  </div>
                </div>
                <button className="btn-primary" type="submit" disabled={registering} style={{ width: "100%", marginTop: 8 }}>{registering ? "Cadastrando…" : "Criar e entrar"}</button>
                {loginError && <p className="auth-error">{loginError}</p>}
              </form>
            </>
          ) : (
            <>
              <h2 style={{ marginTop: 0 }}>Entrar</h2>
              <p className="subtitle" style={{ marginBottom: 16 }}>Já tem conta? Digite sua senha para entrar.</p>
              <div className="field">
                <label htmlFor="loginPassword">Senha</label>
                <input id="loginPassword" type="password" autoComplete="current-password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="Sua senha" />
              </div>
              <button className="btn-primary" onClick={() => handleLogin(loginPassword)} disabled={loggingIn} style={{ width: "100%" }}>{loggingIn ? "Entrando…" : "Entrar"}</button>
              {loginError && <p className="auth-error">{loginError}</p>}
              {loggingIn && <p className="auth-hint">Conectando ao servidor local…</p>}
              <p className="subtitle" style={{ marginTop: 12, fontSize: 12 }}>Sem conta? Vá em <strong>Criar conta</strong>.</p>
            </>
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
