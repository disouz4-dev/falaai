<div align="center">

# 🐺 Guaralingo

**Plataforma de ensino de inglês — 100% local, com IA via [Ollama](https://ollama.com).**

O mascote e logo do Guaralingo é o **lobo-guará** 🐺 — símbolo da fauna brasileira, escolhido para representar o projeto.

Teste de nível adaptativo (CEFR) · Curso completo A1–C2 · Conversação por voz em tempo real · Relatórios de evolução · **Login local (offline) · App desktop autônomo · Atualização automática**

<!-- EN: Guaralingo — an English learning platform, 100% local with local AI via Ollama. The logo and mascot is the maned wolf (lobo-guará). -->

</div>

---

## ✨ Funcionalidades

<!-- PT-BR / EN: feature list -->
- 🎯 **Teste de nivelamento adaptativo (CEFR A1–C2)** — 20 questões que se ajustam ao seu desempenho usando **Teoria de Resposta ao Item (modelo de Rasch + estimativa EAP)**, o mesmo princípio de testes adaptativos de proficiência. Mede gramática, vocabulário e leitura. **Questões embaralhadas a cada teste.**
- 📚 **Curso completo A1 → C2** — 26 lições em 6 módulos, no formato **PPP** (Apresentação → Prática → Produção), com **material didático digital**, vocabulário, exercícios e **tarefas comunicativas** avaliadas pela IA. Baseado em métodos reais: **CEFR, CLT, Task-Based Learning, abordagem lexical e repetição espaçada**.
- 🎙️ **Conversação por voz com professor bilíngue** — você fala em inglês e o professor responde **com texto e voz**: **ensina em inglês** (imersão) e **corrige em português** (na voz `pt_BR`), como um professor de verdade, adaptando-se ao seu nível.
- 👤 **Perfil do aluno** — o professor conhece seu nome, objetivo e interesses e personaliza as conversas.
- 📈 **Curva de aprendizado** — histórico de testes com **gráficos de evolução** (nível e habilidades) e análise da IA sobre seu progresso.
- 🗣️ **Voz gerada localmente** ([Piper](https://github.com/rhasspy/piper)) — vozes naturais `en_US-amy-medium` (EN) e `pt_BR-faber-medium` (PT).
- ⚡ **Detector de GPU** — dá preferência à **GPU** quando disponível e cai automaticamente para **CPU** quando a GPU não suporta o modelo.
- 🔐 **Login local (offline, sem conta)** — nada de contas nem nuvem: seu progresso fica **só neste dispositivo**. O app abre na tela de login e você entra com o botão **Entrar**.
- 🚀 **App desktop autônomo** — o app **sobe o backend sozinho** (em segundo plano, na porta 8000). Não precisa instalar/configurar servidor.
- 🔄 **Atualização automática** — o app verifica e instala novas versões **direto de dentro do app**, sem desinstalar/reinstalar (pede a senha de administrador uma vez).

---

## 🚀 Instalação — app desktop (recomendado)

O Guaralingo é um **app desktop**, com um **instalador `.deb` nativo para Linux** e um instalador **universal (AppImage)**. Baixe a release mais recente na página de **Releases** do GitHub:

> https://github.com/disouz4-dev/guaralingo/releases

**🐧 Linux (.deb — recomendado)**

**Via terminal (um comando):**
```bash
# Baixa e instala o .deb da release mais recente (v1.0.0)
curl -L https://github.com/disouz4-dev/guaralingo/releases/download/v1.0.0/Guaralingo_1.0.0_amd64.deb -o Guaralingo_1.0.0_amd64.deb && sudo dpkg -i Guaralingo_1.0.0_amd64.deb && sudo apt-get install -f
```
Depois procure **Guaralingo** no menu de aplicações para abrir.

**Ou manual:** baixe o `.deb` em https://github.com/disouz4-dev/guaralingo/releases e instale:
```bash
sudo dpkg -i Guaralingo_1.0.0_amd64.deb
sudo apt-get install -f
```

**Desinstalar (Linux)**
```bash
sudo apt remove guaralingo
```

> **Nota sobre outros sistemas:** o Linux tem builds prontos (`.deb` e AppImage). Builds de **Windows (.msi)** e **macOS (.dmg)** exigem compilação nesse sistema — veja [Compilar do código](#compilar-do-código).

### Requisitos do sistema

| Componente | Para quê | Observação |
|---|---|---|
| [Ollama](https://ollama.com) | Motor da IA (conversa, feedback, relatórios) | obrigatório para a IA |
| [Python 3.10+](https://python.org) | Backend (FastAPI) | o app cria um venv próprio automaticamente |
| WebKitGTK 4.1 | Runtime do app desktop | instalado como dependência do `.deb` |
| GPU NVIDIA/AMD ou Apple Silicon | Acelera a IA | opcional (funciona em CPU também) |

---

## 🔐 Login local (como funciona)

<!-- PT-BR / EN: local login explanation -->
1. Abra o Guaralingo — ele mostra a **tela de login**.
2. Clique em **Entrar**. O app faz o **login local**: o backend cria (ou reutiliza) um **perfil local** neste dispositivo e guarda um **token** assinado localmente.
3. Pronto — seu progresso (perfil, testes, lições, vocabulário, conversas) fica **guardado neste dispositivo**, sem precisar de contas nem internet para autenticar.

> **Privacidade:** o Guaralingo é **100% local/offline**. Nenhum dado é enviado para a nuvem. Só acessa a internet para (opcionalmente) baixar **atualizações** e, se você instalar o Ollama, o Ollama baixa o modelo da IA na primeira vez.

---

## 🔄 Atualização automática

O Guaralingo avisa quando há **nova versão** disponível (botão **Atualizar** na tela inicial). Ao atualizar:

1. O app baixa o novo **`.deb`** da release do GitHub.
2. Instala **por cima** do atual (via `pkexec` — o sistema pede a senha de administrador uma vez) — **não desinstala nem perde seus dados**.
3. Reinicia o app com a versão nova.

Assim você se mantém na versão mais recente **sem ficar desinstalando e instalando** manualmente.

---

## ⚡ GPU e CPU

A IA roda **em CPU ou GPU**. O Guaralingo detecta o hardware no início e escolhe o melhor dispositivo:
- **Tem GPU com VRAM suficiente** → usa a **GPU** (mais rápido).
- **GPU pequena para o modelo** → offload parcial GPU+CPU.
- **Sem GPU / VRAM insuficiente** → usa a **CPU** (funciona igual, só mais devagar).

Veja o que foi detectado na sua máquina:
```bash
python backend/gpu.py
```
O estado também aparece em `GET /api/health` e no log de inicialização do servidor.

---

## 🏗️ Arquitetura

```
guaralingo/
├── backend/               # FastAPI (Python)
│   ├── main.py            # API: login local, teste, curso, conversa, TTS, progresso, perfil, update
│   ├── auth.py            # token LOCAL assinado (HMAC) + validação
│   ├── irt.py             # motor TRI/Rasch + mapeamento CEFR
│   ├── ollama_client.py   # cliente Ollama (streaming e não-streaming)
│   ├── tts.py             # síntese de voz local bilíngue (Piper en_US + pt_BR)
│   ├── gpu.py             # detector de GPU (preferência GPU, fallback CPU)
│   ├── db.py              # persistência SQLite (suporta GUARALINGO_DATA_DIR)
│   ├── srs.py / memory.py # repetição espaçada / vault .md interno do professor
│   └── version.py         # checagem de versão + auto-update (.deb por cima)
├── web/                   # frontend React + Vite (PWA)
│   ├── src/
│   │   ├── App.jsx        # tela de login local, navegação, auto-update
│   │   ├── localauth.js   # auth local + detecção do app desktop (isTauri)
│   │   ├── api.js         # chamadas de API com token local (Bearer)
│   │   ├── speech.js      # push-to-talk (hold to record)
│   │   └── screens/       # Home, Placement, Talk, Course, Lesson, Profile, Progress, Practice
│   ├── src-tauri/         # app desktop (Rust) — gera .deb / AppImage
│   │   ├── sidecar/       # sobe o backend local na porta 8000 (cria venv próprio)
│   │   └── src/lib.rs     # spawn do sidecar + command de reinício após atualizar
│   └── dist/              # build servido (gerado por npm run build)
├── install.sh / install.ps1  # instaladores de 1 comando (Linux/macOS · Windows)
├── setup.sh / run.sh / run.bat  # dev: modelo Ollama, servidor local
└── Modelfile              # modelo Ollama "small-english-teacher"
```

### 🗄️ Banco de dados (dados do aluno)

**SQLite** (`guaralingo.db`), via `sqlite3` puro (sem ORM), no diretório de dados do usuário
(`~/.local/share/guaralingo/` no app desktop — gravável, sem precisar de root).

| Tabela | Chave | O que guarda |
|---|---|---|
| `profile` | `uid` (PK) | nome, idioma nativo, objetivo, interesses, e-mail, foto, created_at |
| `attempts` | `uid` + id | **curva de evolução** — cada teste: data, nível, `theta`, `se`, acertos, total, habilidades (JSON) |
| `lesson_progress` | `uid` + `lesson_id` | conclusão de lições: status, nota, data |
| `practice` | `uid` + id | sessões de conversa (para métricas) |
| `srs` | `uid` + `term` | repetição espaçada: intervalo, ease_factor, next_review |
| `mistakes` | `uid` + id | erros extraídos das conversas para revisão |

O `uid` local é criado na primeira entrada (login local), tudo **local neste dispositivo** — não há contas nem nuvem.

---

## 🎓 Métodos pedagógicos

O conteúdo segue métodos reais e atuais de ensino de línguas:

- **CEFR** — Quadro Europeu Comum de Referência (A1 a C2).
- **IRT / Rasch** — teoria de resposta ao item para o nivelamento adaptativo.
- **CLT** — Communicative Language Teaching (foco na comunicação).
- **TBLT** — Task-Based Learning (tarefas reais de produção).
- **PPP** — Presentation, Practice, Production (estrutura das lições).
- **Abordagem lexical** — aprendizado por chunks e colocações.
- **Repetição espaçada** — retenção de vocabulário (SRS por usuário).

---

## 🛠️ Compilar do código

```bash
git clone https://github.com/disouz4-dev/guaralingo.git
cd guaralingo

# Frontend + app desktop (gera .deb / AppImage em web/src-tauri/target/release/bundle/)
cd web
npm install
npx tauri build                       # gera o .deb e o AppImage (Linux)
```

Para gerar builds de **Windows** ou **macOS**, rode `npx tauri build` naquele sistema
(o Tauri compila a versão nativa de cada SO).

---

## 🗺️ Roadmap

- [x] **Login local (offline, sem conta)** — progresso guardado no dispositivo
- [x] **App desktop autônomo** — sobe o backend sozinho (porta 8000)
- [x] **Instalador .deb nativo (Linux)** — integra ao menu, desinstalável
- [x] **Atualização automática** — instala a nova versão por cima, sem desinstalar
- [x] **TTS Piper corrigido** — vozes naturais EN/PT male/female
- [x] **Push-to-talk** — segurar para gravar sem cortar
- [x] **Teste de nivelamento** — questões embaralhadas
- [ ] Instaladores nativos Windows (`.msi`) e macOS (`.dmg`)
- [ ] Repetição espaçada (SRS) ativa do vocabulário na UI
- [ ] XP, ofensiva (streak) e vidas
- [ ] Desbloqueio de módulos pelo nível do teste
- [ ] Geração de novos itens/lições pela IA
- [ ] Correção de pronúncia na conversação

---

## 📄 Licença e créditos

Projeto pessoal. Persona do professor baseada no modelo [`Lckoo1230/small-english-teacher-ollama`](https://huggingface.co/Lckoo1230/small-english-teacher-ollama). Vozes por [Piper](https://github.com/rhasspy/piper). IA local via [Ollama](https://ollama.com). Desktop via [Tauri](https://tauri.app).
