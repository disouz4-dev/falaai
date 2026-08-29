<div align="center">

# 🦜 OpenLingo

**Plataforma de ensino de inglês estilo Duolingo — 100% local, com IA via [Ollama](https://ollama.com).**

Teste de nível adaptativo (CEFR) · Curso completo A1–C2 · Conversação por voz em tempo real · Relatórios de evolução

</div>

---

## ✨ Funcionalidades

- 🎯 **Teste de nivelamento adaptativo (CEFR A1–C2)** — 20 questões que se ajustam ao seu desempenho usando **Teoria de Resposta ao Item (modelo de Rasch + estimativa EAP)**, o mesmo princípio de testes reais (EF SET, Cambridge Linguaskill, Duolingo English Test). Mede gramática, vocabulário e leitura.
- 📚 **Curso completo A1 → C2** — 26 lições em 6 módulos, no formato **PPP** (Apresentação → Prática → Produção), com **material didático digital**, vocabulário, exercícios e **tarefas comunicativas** avaliadas pela IA. Baseado em métodos reais: **CEFR, CLT, Task-Based Learning, abordagem lexical e repetição espaçada**.
- 🎙️ **Conversação por voz com professor bilíngue** — você fala em inglês e o professor responde **com texto e voz**: **ensina em inglês** (imersão) e **corrige em português** (na voz `pt_BR`), como um professor de verdade, adaptando-se ao seu nível.
- 👤 **Perfil do aluno** — o professor conhece seu nome, objetivo e interesses e personaliza as conversas.
- 📈 **Curva de aprendizado** — histórico de testes com **gráficos de evolução** (nível e habilidades) e análise da IA sobre seu progresso.
- 🗣️ **Voz gerada localmente** ([Piper](https://github.com/rhasspy/piper)) — funciona em qualquer aparelho, mesmo sem voz instalada no navegador.
- ⚡ **Detector de GPU** — dá preferência à **GPU** quando disponível e cai automaticamente para **CPU** quando a GPU não suporta o modelo.
- 📱 **PWA responsiva e instalável** — roda no PC e no celular, e pode ser instalada como app no **Windows, macOS e Linux**.

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

**🐧 Linux**
```bash
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

Depois disso, abra **http://localhost:8000**.

### Instalação manual (alternativa)

```bash
git clone https://github.com/disouz4-dev/openlingo.git
cd openlingo
./setup.sh          # cria o modelo no Ollama + baixa as vozes do Piper  (Windows: veja abaixo)
./run.sh            # inicia (http://localhost:8000)
./run.sh --https    # inicia com HTTPS (necessário p/ microfone no celular)
```

No **Windows**, use `run.bat` e `run.bat https`. O modelo do professor é criado com
`ollama create small-english-teacher -f Modelfile` — uma recriação fiel do
[`Lckoo1230/small-english-teacher-ollama`](https://huggingface.co/Lckoo1230/small-english-teacher-ollama)
sobre `gemma3:4b`.

---

## 📱 Instalar como aplicativo (Windows, macOS, Linux)

Há duas formas — as duas dão um **ícone** para abrir o app:

### A) Ícone na área de trabalho (atalho que sobe o servidor e abre o app)

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

Cria o ícone 🦜 **OpenLingo** na Área de trabalho e no menu de aplicativos (Menu Iniciar /
Launchpad / lançador). Um clique sobe o servidor e abre o app no navegador.

### B) Instalar como PWA (janela própria)

1. Abra `http://localhost:8000` (ou `http://openlingo.local:8000`) no **Chrome** ou **Edge**.
2. Clique em **⬇️ Instalar o OpenLingo** na tela inicial (ou no ícone de instalar da barra de endereço).
3. Ele passa a abrir em janela própria, com ícone no sistema — **Windows** (menu Iniciar), **macOS** (Launchpad/Dock) e **Linux** (lançador de apps).

> **Instaladores nativos** (`.exe` / `.dmg` / `.AppImage`): no roadmap. Cada um precisa ser
> gerado no respectivo sistema operacional.

**No celular:** conecte na mesma rede Wi-Fi, rode com `--https`/`https`, abra `https://openlingo.local:8000` no Chrome (aceite o aviso do certificado autoassinado) e use **Adicionar à tela inicial**.

### 🌐 Acesso pela rede pelo nome (sem IP)

O OpenLingo se anuncia na rede via **mDNS/Zeroconf**. Qualquer dispositivo na mesma rede
(PC, celular, tablet) acessa pelo nome, **sem precisar saber o IP**:

```
http://openlingo.local:8000      (ou https://openlingo.local:8000 no modo --https)
```

Funciona nativamente em macOS, iOS, Windows 10+ e Linux (Avahi). Em alguns Androids antigos,
use o IP como alternativa.

### 🔒 HTTPS confiável (sem aviso "não seguro")

Por padrão o modo `--https` usa um certificado autoassinado — funciona, mas o navegador mostra
"não seguro". Para **cadeado verde, sem aviso**, gere um certificado confiável com `mkcert`
(cria uma Autoridade Certificadora local):

```bash
./setup-cert.sh      # roda uma vez; pede a senha do sudo para instalar e confiar na CA
./run.sh --https     # passa a usar o certificado confiável automaticamente
```

No **PC** o aviso some. Para o **celular** também ficar seguro, instale o `rootCA.pem`
(o caminho é mostrado ao final do `setup-cert.sh`) no aparelho.

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
├── run.sh / run.bat       # sobem o servidor (HTTP ou HTTPS)
├── backend/               # FastAPI
│   ├── main.py            # API: teste, curso, conversa, TTS, progresso, perfil
│   ├── irt.py             # motor TRI/Rasch + mapeamento CEFR
│   ├── ollama_client.py   # cliente Ollama (streaming e não-streaming)
│   ├── tts.py             # síntese de voz local bilíngue (Piper en_US + pt_BR)
│   ├── gpu.py             # detector de GPU (preferência GPU, fallback CPU)
│   ├── db.py              # persistência SQLite (perfil, histórico, curso)
│   └── data/
│       ├── items.json     # banco de 48 itens calibrados do teste (por nível CEFR)
│       ├── course.json    # currículo: 6 módulos, 26 lições (A1–C2)
│       ├── openlingo.db   # banco SQLite do aluno (criado no 1º uso)
│       └── memory/        # vault .md INTERNO do professor (memória do aluno)
└── web/                   # frontend React + Vite (PWA)
    ├── src/App.jsx · api.js · speech.js
    ├── src/screens/       # Home, Placement, Talk, Course, Lesson, Profile, Progress
    ├── public/            # manifest.webmanifest, sw.js, icon.svg
    └── dist/              # build servido pelo FastAPI (gerado por ./run.sh)
```

### 🗄️ Banco de dados (dados do aluno e evolução)

**SQLite local** (`backend/data/openlingo.db`), via `sqlite3` puro (sem ORM), single-user. Tabelas:

| Tabela | O que guarda |
|---|---|
| `profile` | nome, idioma nativo, objetivo, interesses |
| `attempts` | **curva de evolução** — cada teste: data, nível, `theta`, `se`, acertos, total, habilidades (JSON) |
| `lesson_progress` | conclusão de lições do curso: `lesson_id`, status, nota, data |
| `practice` | sessões de conversa (para métricas) |

A tela **Meu progresso** e o endpoint `/api/progress` leem a tabela `attempts` (ordenada por data) para montar os gráficos de evolução e a análise da IA.

### 🔌 API

| Endpoint | Função |
|---|---|
| `GET /api/health` | status do Ollama, TTS e GPU |
| `GET/POST /api/profile` | ler/salvar o perfil |
| `POST /api/placement/start` · `/answer` · `GET /result/{id}` | teste adaptativo |
| `GET /api/progress` · `/progress/analysis` | curva de evolução + análise da IA |
| `GET /api/course` · `/course/lesson/{id}` · `POST /complete` · `/task-feedback` | curso e tarefas |
| `POST /api/chat` | conversa por voz (streaming, professor bilíngue) |
| `GET /api/tts?text=&lang=` | áudio da fala (Piper), `lang=en`/`pt` |

---

## 🎓 Métodos pedagógicos

O conteúdo segue métodos reais e atuais de ensino de línguas:

- **CEFR** — Quadro Europeu Comum de Referência (A1 a C2).
- **IRT / Rasch** — teoria de resposta ao item para o nivelamento adaptativo.
- **CLT** — Communicative Language Teaching (foco na comunicação).
- **TBLT** — Task-Based Learning (tarefas reais de produção).
- **PPP** — Presentation, Practice, Production (estrutura das lições).
- **Abordagem lexical** — aprendizado por chunks e colocações.
- **Repetição espaçada** — retenção de vocabulário.

---

## 🗺️ Roadmap

- [ ] Repetição espaçada (SRS) ativa do vocabulário
- [ ] XP, ofensiva (streak) e vidas
- [ ] Desbloqueio de módulos pelo nível do teste
- [ ] Geração de novos itens/lições pela IA
- [ ] Correção de pronúncia na conversação
- [ ] Empacotamento nativo (Electron/Tauri) com instaladores `.exe` / `.dmg` / `.AppImage`
- [x] HTTPS confiável (cadeado verde) com CA local via `mkcert` — ver `./setup-cert.sh`

---

## 📄 Licença e créditos

Projeto pessoal. Persona do professor baseada no modelo [`Lckoo1230/small-english-teacher-ollama`](https://huggingface.co/Lckoo1230/small-english-teacher-ollama). Vozes por [Piper](https://github.com/rhasspy/piper). IA local via [Ollama](https://ollama.com).
