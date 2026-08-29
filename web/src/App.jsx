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
  }, []);

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
