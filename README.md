<div align="center">

# 🦜 OpenLingo

**Plataforma de ensino de inglês estilo Duolingo — 100% local, com IA via [Ollama](https://ollama.com).**

Teste de nível adaptativo (CEFR) · Curso completo A1–C2 · Conversação por voz em tempo real · Relatórios de evolução · **Login com Google · Multi-usuário · Instalador .deb nativo**

</div>

---

## ✨ Funcionalidades

- 🎯 **Teste de nivelamento adaptativo (CEFR A1–C2)** — 20 questões que se ajustam ao seu desempenho usando **Teoria de Resposta ao Item (modelo de Rasch + estimativa EAP)**, o mesmo princípio de testes reais (EF SET, Cambridge Linguaskill, Duolingo English Test). Mede gramática, vocabulário e leitura. **Questões embaralhadas a cada teste.**
- 📚 **Curso completo A1 → C2** — 26 lições em 6 módulos, no formato **PPP** (Apresentação → Prática → Produção), com **material didático digital**, vocabulário, exercícios e **tarefas comunicativas** avaliadas pela IA. Baseado em métodos reais: **CEFR, CLT, Task-Based Learning, abordagem lexical e repetição espaçada**.
- 🎙️ **Conversação por voz com professor bilíngue** — você fala em inglês e o professor responde **com texto e voz**: **ensina em inglês** (imersão) e **corrige em português** (na voz `pt_BR`), como um professor de verdade, adaptando-se ao seu nível.
- 👤 **Perfil do aluno** — o professor conhece seu nome, objetivo e interesses e personaliza as conversas.
- 📈 **Curva de aprendizado** — histórico de testes com **gráficos de evolução** (nível e habilidades) e análise da IA sobre seu progresso.
- 🗣️ **Voz gerada localmente** ([Piper](https://github.com/rhasspy/piper)) — vozes naturais `en_US-amy-medium` (EN) e `pt_BR-faber-medium` (PT), funciona em qualquer aparelho.
- ⚡ **Detector de GPU** — dá preferência à **GPU** quando disponível e cai automaticamente para **CPU** quando a GPU não suporta o modelo.
- 📱 **PWA responsiva e instalável** — roda no PC e no celular, e pode ser instalada como app no **Windows, macOS e Linux**.
- 🔐 **Login com Google (Firebase Auth)** — cada usuário tem seus próprios dados (perfil, progresso, histórico, vocabulário). Dados isolados por conta.
- 📦 **Instalador .deb nativo (Linux)** — instala via `apt`, aparece no menu de aplicações, desinstalável via `apt remove openlingo`.

---

## 🧩 Requisitos

| Componente | Para quê | Obrigatório |
|---|---|---|
| [Ollama](https://ollama.com) | Motor da IA (conversa, feedback, relatórios) | ✅ |
| [Python 3.10+](https://python.org) | Backend (FastAPI) | ✅ |
| [Node.js 18+](https://nodejs.org) | Compilar o frontend React (`./run.sh` faz automático) | ✅ |
| Navegador **Chrome/Edge** | Reconhecimento de voz (falar) e instalação como app | ✅ |
| [Piper](https://github.com/rhasspy/piper) + vozes `en_US` e `pt_BR` | Voz do professor (TTS local, bilíngue) | ✅ |
| GPU NVIDIA/AMD ou Apple Silicon | Acelera a IA (funciona em CPU também) | Opcional |

O instalador cuida de tudo isso automaticamente (Ollama, Piper e as vozes).

---

## 🚀 Instalação — um comando por sistema

Abra o terminal e cole **a linha do seu sistema**. Ela instala os pré-requisitos, baixa o projeto, configura o modelo + as vozes e já sobe o app.

**🐧 Linux** (instalador .deb recomendado)
```bash
# Opção 1: .deb (integra ao sistema, desinstalável)
wget https://github.com/disouz4-dev/openlingo/releases/download/v1.0.0/OpenLingo_1.0.0_amd64.deb
sudo apt install ./OpenLingo_1.0.0_amd64.deb

# Opção 2: script clássico
bash <(curl -fsSL https://raw.githubusercontent.com/disouz4-dev/openlingo/main/install.sh)
```

**🍎 macOS**
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/disouz4-dev/openlingo/main/install.sh)"
```

**🪟 Windows** (PowerShell)
```powershell
irm https://raw.githubusercontent.com/disouz4-dev/openlingo/main/install.ps1 | iex
```

Depois disso, abra **https://localhost** (porta 80, HTTPS — necessário para microfone e login Google).

### Instalação manual (alternativa)

```bash
git clone https://github.com/disouz4-dev/openlingo.git
cd openlingo
./setup.sh          # cria o modelo no Ollama + baixa as vozes do Piper  (Windows: veja abaixo)
./run.sh --https    # inicia com HTTPS na porta 80 (precisa de sudo)
```

No **Windows**, use `run.bat` e `run.bat https`. O modelo do professor é criado com
`ollama create small-english-teacher -f Modelfile` — uma recriação fiel do
[`Lckoo1230/small-english-teacher-ollama`](https://huggingface.co/Lckoo1230/small-english-teacher-ollama)
sobre `gemma3:4b`.

---

## 🔐 Login e Multi-usuário

**Primeira execução:**
1. Abra `https://localhost` (aceite o aviso do certificado autoassinado).
2. Clique em **"Entrar com Google"**.
3. Escolha sua conta Google.
4. Seu perfil é criado automaticamente (nome, e-mail, foto).

**Como funciona:**
- Cada conta Google = **um `uid` único no Firebase**.
- Todos os dados (perfil, testes, lições, vocabulário SRS, conversas, memória do professor) ficam **separados por `uid`**.
- Você pode logar em qualquer dispositivo (desde que o domínio esteja autorizado no Firebase Console).
- Logout no canto superior direito (ícone do avatar).

> **Importante:** Para usar fora de casa (túnel Cloudflare), adicione a URL do túnel em **Firebase Console → Authentication → Settings → Authorized domains**. `localhost` já funciona por padrão.

---

## 📱 Instalar como aplicativo (Windows, macOS, Linux)

### Linux — Instalador .deb (recomendado)
```bash
wget https://github.com/disouz4-dev/openlingo/releases/download/v1.0.0/OpenLingo_1.0.0_amd64.deb
sudo apt install ./OpenLingo_1.0.0_amd64.deb
```
Cria ícone no menu de aplicações, integra ao sistema, desinstalável:
```bash
sudo apt remove openlingo
```

### Ícone na área de trabalho (atalho que sobe o servidor e abre o app)
Depois de clonar o projeto, rode o script do seu sistema:
```bash
# Linux
./desktop/install-desktop-linux.sh
# macOS
./desktop/install-desktop-mac.sh
```
```powershell
# Windows (PowerShell)
./desktop/install-desktop-windows.ps1
```

Cria o ícone 🦜 **OpenLingo** na Área de trabalho e no menu de aplicativos. Um clique sobe o servidor (com `pkexec` para porta 80) e abre o app.

### B) Instalar como PWA (janela própria)
1. Abra `https://localhost` no **Chrome** ou **Edge**.
2. Clique em **⬇️ Instalar o OpenLingo** na tela inicial (ou no ícone de instalar da barra de endereço).
3. Ele passa a abrir em janela própria, com ícone no sistema.

**No celular:** conecte na mesma rede Wi-Fi, rode com `--https`, abra `https://openlingo.local` no Chrome (aceite o aviso do certificado autoassinado) e use **Adicionar à tela inicial**.

### 🌐 Acesso pela rede pelo nome (sem IP)
O OpenLingo se anuncia na rede via **mDNS/Zeroconf**. Qualquer dispositivo na mesma rede acessa pelo nome:
```
https://openlingo.local      (porta 80 HTTPS)
```
Funciona nativamente em macOS, iOS, Windows 10+ e Linux (Avahi).

### 🔒 HTTPS confiável (sem aviso "não seguro")
Por padrão o modo `--https` usa um certificado autoassinado. Para **cadeado verde, sem aviso**, gere um certificado confiável com `mkcert`:
```bash
./setup-cert.sh      # roda uma vez; pede a senha do sudo para instalar e confiar na CA
./run.sh --https     # passa a usar o certificado confiável automaticamente
```
No **PC** o aviso some. Para o **celular** também ficar seguro, instale o `rootCA.pem` no aparelho.

---

## ⚡ GPU e CPU

A IA roda **em CPU ou GPU**. O OpenLingo detecta o hardware no início e escolhe o melhor dispositivo:
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
openlingo/
├── Modelfile              # modelo Ollama "small-english-teacher"
├── install.sh / install.ps1  # instalador de 1 comando (Linux/macOS · Windows)
├── setup.sh               # cria o modelo no Ollama + baixa as vozes do Piper
├── run.sh / run.bat       # sobem o servidor (HTTPS porta 80)
├── remote.sh              # túnel Cloudflare para acesso externo
├── backend/               # FastAPI
│   ├── main.py            # API: teste, curso, conversa, TTS, progresso, perfil
│   ├── auth.py            # validação de token Firebase ID (PyJWT + chaves Google)
│   ├── irt.py             # motor TRI/Rasch + mapeamento CEFR
│   ├── ollama_client.py   # cliente Ollama (streaming e não-streaming)
│   ├── tts.py             # síntese de voz local bilíngue (Piper en_US + pt_BR)
│   ├── gpu.py             # detector de GPU (preferência GPU, fallback CPU)
│   ├── db.py              # persistência SQLite **multi-usuário (chaveada por uid)**
│   ├── srs.py             # repetição espaçada por usuário
│   ├── memory.py          # vault .md interno do professor (por uid)
│   └── data/
│       ├── items.json     # banco de 48 itens calibrados do teste (por nível CEFR)
│       ├── course.json    # currículo: 6 módulos, 26 lições (A1–C2)
│       ├── openlingo.db   # banco SQLite multi-user (criado no 1º uso)
│       └── memory/        # vault .md INTERNO do professor (por uid)
├── web/                   # frontend React + Vite (PWA)
│   ├── src/
│   │   ├── App.jsx        # auth gate, login Google, avatar/logout
│   │   ├── firebase.js    # Firebase init + signInWithRedirect
│   │   ├── api.js         # attach Bearer token (Firebase ID token)
│   │   ├── speech.js      # push-to-talk (hold to record)
│   │   ├── screens/       # Home, Placement, Talk, Course, Lesson, Profile, Progress, Practice
│   │   └── styles.css
│   ├── src-tauri/         # Tauri app (gera .deb, AppImage)
│   └── dist/              # build servido pelo FastAPI (gerado por ./run.sh)
└── desktop/               # scripts de atalho/ícone por SO
```

### 🗄️ Banco de dados (dados do aluno e evolução) — **Multi-usuário**

**SQLite local** (`backend/data/openlingo.db`), via `sqlite3` puro (sem ORM). **Todas as tabelas chaveadas por `uid` (Firebase UID):**

| Tabela | Chave | O que guarda |
|---|---|---|
| `profile` | `uid` (PK) | nome, idioma nativo, objetivo, interesses, e-mail, foto, created_at |
| `attempts` | `uid` + id | **curva de evolução** — cada teste: data, nível, `theta`, `se`, acertos, total, habilidades (JSON) |
| `lesson_progress` | `uid` + `lesson_id` | conclusão de lições: status, nota, data |
| `practice` | `uid` + id | sessões de conversa (para métricas) |
| `srs` | `uid` + `term` | repetição espaçada: intervalo, ease_factor, next_review |
| `mistakes` | `uid` + id | erros extraídos das conversas para revisão |

A tela **Meu progresso** e o endpoint `/api/progress` leem a tabela `attempts` (ordenada por data, filtrada por `uid`) para montar os gráficos de evolução e a análise da IA.

### 🔌 API (todas protegidas — exigem `Authorization: Bearer <Firebase ID Token>`)

| Endpoint | Função |
|---|---|
| `GET /api/health` | status do Ollama, TTS e GPU (público) |
| `GET/POST /api/profile` | ler/salvar o perfil do usuário logado |
| `POST /api/placement/start` · `/answer` · `GET /result/{id}` | teste adaptativo |
| `GET /api/progress` · `/progress/analysis` | curva de evolução + análise da IA |
| `GET /api/course` · `/course/lesson/{id}` · `POST /complete` · `/task-feedback` | curso e tarefas |
| `POST /api/chat` | conversa por voz (streaming, professor bilíngue) |
| `GET /api/tts?text=&lang=` | áudio da fala (Piper), `lang=en`/`pt` |
| `GET /api/srs/due` · `POST /api/srs/review` | SRS por usuário |
| `GET /api/mistakes` | erros do usuário para revisão |

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

## 🗺️ Roadmap

- [x] **Firebase Auth multi-usuário** (login Google, dados isolados por conta)
- [x] **Instalador .deb nativo (Linux)** — integra ao sistema, desinstalável
- [x] **TTS Piper corrigido** — vozes naturais EN/PT male/female
- [x] **Push-to-talk** — segurar para gravar sem cortar
- [x] **Teste de nivelamento** — questões embaralhadas
- [ ] Repetição espaçada (SRS) ativa do vocabulário na UI
- [ ] XP, ofensiva (streak) e vidas
- [ ] Desbloqueio de módulos pelo nível do teste
- [ ] Geração de novos itens/lições pela IA
- [ ] Correção de pronúncia na conversação
- [ ] Instaladores nativos Windows (`.msi`) e macOS (`.dmg`)
- [x] HTTPS confiável (cadeado verde) com CA local via `mkcert` — ver `./setup-cert.sh`

---

## 📄 Licença e créditos

Projeto pessoal. Persona do professor baseada no modelo [`Lckoo1230/small-english-teacher-ollama`](https://huggingface.co/Lckoo1230/small-english-teacher-ollama). Vozes por [Piper](https://github.com/rhasspy/piper). IA local via [Ollama](https://ollama.com). Auth via [Firebase](https://firebase.google.com). Desktop via [Tauri](https://tauri.app).