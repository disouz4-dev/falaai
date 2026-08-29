import React, { useState } from "react";
import { api } from "../api.js";

export default function Profile({ nav, profile, setProfile }) {
  const [name, setName] = useState(profile?.name || "");
  const [goal, setGoal] = useState(profile?.goal || "");
  const [interests, setInterests] = useState(profile?.interests || "");
  const [msg, setMsg] = useState("");

  async function save() {
    if (!name.trim()) { setMsg("Digite pelo menos seu nome."); return; }
    const d = await api.post("/api/profile", {
      name: name.trim(), goal: goal.trim(), interests: interests.trim(),
    });
    setProfile(d.profile);
    setMsg("✓ Salvo!");
    setTimeout(() => { setMsg(""); nav("home"); }, 700);
  }

  return (
    <section className="screen active">
      <div className="panel">
        <h2>👤 Meu perfil</h2>
        <p className="subtitle" style={{ marginBottom: 16 }}>
          O professor usa essas informações para personalizar as conversas.
        </p>
        <label className="field">Nome
          <input type="text" placeholder="Como quer ser chamado(a)?"
            value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">Objetivo com o inglês
          <input type="text" placeholder="Ex.: viajar, trabalho, entrevistas…"
            value={goal} onChange={(e) => setGoal(e.target.value)} />
        </label>
        <label className="field">Interesses / temas favoritos
          <input type="text" placeholder="Ex.: tecnologia, música, games, negócios…"
            value={interests} onChange={(e) => setInterests(e.target.value)} />
        </label>
        <button className="btn-primary" onClick={save}>Salvar</button>
        <button className="btn-ghost" onClick={() => nav("home")}>Voltar</button>
        <p className="pf-msg">{msg}</p>
      </div>
    </section>
  );
}
