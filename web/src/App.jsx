import React, { useEffect, useState } from "react";
import { api } from "./api.js";
import { getLocalToken, clearLocalToken, getLocalUserFromToken, isTauri as isTauriEnv } from "./localauth.js";
import Home from "./screens/Home.jsx";
import Placement from "./screens/Placement.jsx";
import Talk from "./screens/Talk.jsx";
import Course from "./screens/Course.jsx";
import Catalog from "./screens/Catalog.jsx";
import Exam from "./screens/Exam.jsx";
import Certificate from "./screens/Certificate.jsx";
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
  const [courseId, setCourseId] = useState(null);
  const [moduleId, setModuleId] = useState(null);
  const [certData, setCertData] = useState(null);
  const [deferredInstall, setDeferredInstall] = useState(null);
  const [update, setUpdate] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [registering, setRegistering] = useState(false);
  const isLocalhost = ["localhost", "127.0.0.1", "::1"].includes(location.hostname);

  const nav = (name, arg) => {
    if (name === "lesson") setLessonId(arg);
    if (name === "course") setCourseId(arg);
    if (name === "exam") { setCourseId(arg?.courseId); setModuleId(arg?.moduleId); }
    if (name === "certificate") setCertData(arg);
    if (name === "course" && !arg) setScreen("catalog");
    else setScreen(name);
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
    window.addEventListener("falaai:auth-required", onAuthRequired);
    return () => window.removeEventListener("falaai:auth-required", onAuthRequired);
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
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  // PT-BR: decide aba inicial: sem token = cadastro, com token = login. EN: initial tab: no token = register.
  useEffect(() => {
    if (authUser === null) setAuthTab(getLocalToken() ? "login" : "register");
  }, [authUser]);

  // PT-BR: carrega os usuários locais cadastrados (pick list da tela de entrar).
  // EN: load the registered local users (pick list on the login screen).
  useEffect(() => {
    if (authUser !== null) return;
    api.get("/api/users")
      .then((d) => setUsers(d.users || []))
      .catch(() => setUsers([]));
  }, [authUser]);

  async function handleLogin(name, password) {
    setLoginError("");
    setLoggingIn(true);
    try {
      const { loginLocal } = await import("./localauth.js");
      for (let attempt = 0; attempt < 12; attempt++) {
        try {
          const data = await loginLocal(name, password);
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
          <div className="brand">🐺 <span>Fala A.I.</span></div>
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
    const pickUser = (u) => {
      setSelectedUser(u);
      setForm((f) => ({ ...f, name: u.name }));
      setLoginError("");
    };
    return (
      <section className="screen active auth-screen">
        <div className="panel center-panel auth-card">
          <div className="auth-seal">
            <span className="seal-wolf">🐺</span>
          </div>
          <h1 className="auth-brand">Fala A.I.</h1>
          <p className="auth-sub">Seu professor de idiomas de IA — tudo local e offline.</p>

          <div className="auth-pills">
            <button className={"auth-pill" + (authTab === "register" ? " on" : "")}
              onClick={() => setAuthTab("register")}>Criar conta</button>
            <button className={"auth-pill" + (authTab === "login" ? " on" : "")}
              onClick={() => setAuthTab("login")}>Entrar</button>
          </div>

          {authTab === "register" ? (
            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-grid">
                <div className="field span-2">
                  <label htmlFor="name">Seu nome</label>
                  <input id="name" type="text" autoComplete="name" required value={form.name}
                    onChange={e => setForm({...form, name: e.target.value})} placeholder="Como devemos te chamar?" />
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
                  <label htmlFor="goal">Meta</label>
                  <input id="goal" type="text" value={form.goal}
                    onChange={e => setForm({...form, goal: e.target.value})} placeholder="Ex: viajar, trabalho…" />
                </div>
                <div className="field span-2">
                  <label htmlFor="interests">Interesses (opcional)</label>
                  <input id="interests" type="text" value={form.interests}
                    onChange={e => setForm({...form, interests: e.target.value})} placeholder="Tecnologia, música, esportes…" />
                </div>
                <div className="field">
                  <label htmlFor="password">Senha</label>
                  <input id="password" type="password" autoComplete="new-password" required value={form.password}
                    onChange={e => setForm({...form, password: e.target.value})} placeholder="Crie uma senha" />
                </div>
                <div className="field">
                  <label htmlFor="confirmPassword">Confirmar senha</label>
                  <input id="confirmPassword" type="password" autoComplete="new-password" required value={form.confirmPassword}
                    onChange={e => setForm({...form, confirmPassword: e.target.value})} placeholder="Repita a senha" />
                </div>
                <div className="field span-2">
                  <label>Voz do professor</label>
                  <div className="radio-group">
                    <label className="radio-option">
                      <input type="radio" name="gender_preference" value="female" checked={form.gender_preference === "female"}
                        onChange={e => setForm({...form, gender_preference: e.target.value})} />
                      <span className="radio-label">Professora</span>
                    </label>
                    <label className="radio-option">
                      <input type="radio" name="gender_preference" value="male" checked={form.gender_preference === "male"}
                        onChange={e => setForm({...form, gender_preference: e.target.value})} />
                      <span className="radio-label">Professor</span>
                    </label>
                  </div>
                </div>
              </div>
              <button className="btn-primary" type="submit" disabled={registering}>
                {registering ? "Cadastrando…" : "Criar e entrar"}
              </button>
              {loginError && <p className="auth-error">{loginError}</p>}
            </form>
          ) : (
            <div className="auth-form">
              {users.length > 0 ? (
                <div className="user-pick">
                  <label className="pick-label">Escolha quem está aprendendo</label>
                  {users.map((u) => (
                    <button key={u.uid} className={"user-card" + (selectedUser?.uid === u.uid ? " on" : "")}
                      onClick={() => pickUser(u)}>
                      <span className="user-avatar">{u.name.charAt(0).toUpperCase()}</span>
                      <span className="user-name">{u.name}</span>
                      <span className="user-check">{selectedUser?.uid === u.uid ? "✓" : "→"}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="auth-hint">Nenhuma conta criada ainda — use a aba <strong>Criar conta</strong>.</p>
              )}

              <div className="field">
                <label htmlFor="loginName">Usuário</label>
                <input id="loginName" type="text" autoComplete="username" value={selectedUser?.name || form.name}
                  onChange={e => { setSelectedUser(null); setForm({...form, name: e.target.value}); }}
                  placeholder="Seu nome de usuário" />
              </div>
              <div className="field">
                <label htmlFor="loginPassword">Senha</label>
                <input id="loginPassword" type="password" autoComplete="current-password" value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)} placeholder="Sua senha" />
              </div>
              <button className="btn-primary" onClick={() => handleLogin(form.name, loginPassword)} disabled={loggingIn}>
                {loggingIn ? "Entrando…" : "Entrar"}
              </button>
              {loginError && <p className="auth-error">{loginError}</p>}
              {loggingIn && <p className="auth-hint">Conectando ao servidor local…</p>}
            </div>
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
        <div className="brand" onClick={() => nav("home")}>🐺 <span>Fala A.I.</span></div>
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
        {screen === "catalog" && <Catalog nav={nav} />}
        {screen === "course" && <Course nav={nav} courseId={courseId} />}
        {screen === "exam" && <Exam nav={nav} courseId={courseId} moduleId={moduleId} />}
        {screen === "certificate" && (
          <Certificate nav={nav} courseId={certData?.courseId} moduleId={certData?.moduleId}
            type={certData?.type} />
        )}
        {screen === "lesson" && <Lesson nav={nav} lessonId={lessonId} />}
        {screen === "profile" && <Profile nav={nav} profile={profile} setProfile={setProfile} />}
        {screen === "progress" && <Progress nav={nav} />}
        {screen === "practice" && <Practice nav={nav} profile={profile} />}
      </main>
    </>
  );
}
