import React, { useEffect, useState } from "react";
import { api } from "./api.js";
import Home from "./screens/Home.jsx";
import Placement from "./screens/Placement.jsx";
import Talk from "./screens/Talk.jsx";
import Course from "./screens/Course.jsx";
import Lesson from "./screens/Lesson.jsx";
import Profile from "./screens/Profile.jsx";
import Progress from "./screens/Progress.jsx";

export default function App() {
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

  // PT-BR: boot — status da IA + perfil; sem perfil, abre o onboarding. EN: boot — health + profile.
  useEffect(() => {
    api.get("/api/health").then(setHealth).catch(() => setHealth({ error: true }));
    api.get("/api/profile")
      .then((d) => {
        setProfile(d.profile);
        if (!d.profile) setScreen("profile");
      })
      .catch(() => {});
    // PT-BR: verifica se há versão nova no GitHub. EN: check GitHub for a new version.
    api.get("/api/version").then(setUpdate).catch(() => {});
  }, []);

  // PT-BR: atualiza (git pull + rebuild) e espera o servidor voltar, então recarrega.
  // EN: update (git pull + rebuild), wait for the server to come back, then reload.
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
          <Home nav={nav} profile={profile} deferredInstall={deferredInstall} onInstall={doInstall} />
        )}
        {(screen === "test-intro" || screen === "test" || screen === "result") && (
          <Placement screen={screen} nav={nav} />
        )}
        {screen === "talk" && <Talk nav={nav} profile={profile} />}
        {screen === "course" && <Course nav={nav} />}
        {screen === "lesson" && <Lesson nav={nav} lessonId={lessonId} />}
        {screen === "profile" && <Profile nav={nav} profile={profile} setProfile={setProfile} />}
        {screen === "progress" && <Progress nav={nav} />}
      </main>
    </>
  );
}
