<div align="center">

# 🦜 OpenLingo

**Plataforma de ensino de inglês estilo Duolingo — 100% local, com IA via [Ollama](https://ollama.com).**

Teste de nível adaptativo (CEFR) · Curso completo A1–C2 · Conversação por voz em tempo real · Relatórios de evolução

</div>

---

## ✨ Funcionalidades

- 🎯 **Teste de nivelamento adaptativo (CEFR A1–C2)** — 20 questões que se ajustam ao seu desempenho usando **Teoria de Resposta ao Item (modelo de Rasch + estimativa EAP)**, o mesmo princípio de testes reais (EF SET, Cambridge Linguaskill, Duolingo English Test). Mede gramática, vocabulário e leitura.
- 📚 **Curso completo A1 → C2** — 26 lições em 6 módulos, no formato **PPP** (Apresentação → Prática → Produção), com **material didático digital**, vocabulário, exercícios e **tarefas comunicativas** avaliadas pela IA. Baseado em métodos reais: **CEFR, CLT, Task-Based Learning, abordagem lexical e repetição espaçada**.
- 🎙️ **Conversação por voz em tempo real** — você fala em inglês, o professor de IA responde **com texto e voz**, adaptando o vocabulário ao seu nível e corrigindo com gentileza.
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
| [Python 3.10+](https://python.org) | Backend | ✅ |
| Navegador **Chrome/Edge** | Reconhecimento de voz (falar) e instalação como app | ✅ |
| [Piper](https://github.com/rhasspy/piper) + uma voz `en_US` | Voz do professor (TTS local) | Opcional* |
| GPU NVIDIA/AMD ou Apple Silicon | Acelera a IA (funciona sem também) | Opcional |

\* Sem o Piper, o app usa a voz do próprio navegador como fallback.

---

## 🚀 Instalação

### 1. Instale o Ollama e o modelo

Instale o [Ollama](https://ollama.com/download) e crie o modelo do professor:

```bash
ollama create small-english-teacher -f Modelfile
```

> O modelo é uma recriação fiel do [`Lckoo1230/small-english-teacher-ollama`](https://huggingface.co/Lckoo1230/small-english-teacher-ollama) (cujo repo não é GGUF), construída sobre `gemma3:4b` mantendo o system prompt original. Para trocar a base, edite a linha `FROM` no [`Modelfile`](Modelfile).

### 2. (Opcional) Voz do professor com Piper

Instale o Piper e baixe uma voz em inglês (ex.: `en_US-lessac-medium`) de [rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices). Coloque os arquivos `.onnx` e `.onnx.json` em uma destas pastas:

- `~/.local/share/piper/voices/`
- `backend/voices/` (dentro do projeto)
- ou aponte com a variável `OPENLINGO_VOICE_DIR`

### 3. Rode

**Linux / macOS:**

```bash
./run.sh           # PC, http://localhost:8000
./run.sh --https   # com HTTPS (necessário p/ microfone no celular)
```

**Windows:**

```bat
run.bat            :: PC, http://localhost:8000
run.bat https      :: com HTTPS
```

O script cria o ambiente virtual, instala as dependências e sobe o servidor.

---

## 📱 Instalar como aplicativo (Windows, macOS, Linux)

O OpenLingo é uma **PWA** — dá para instalar como app de verdade:

1. Abra `http://localhost:8000` no **Chrome** ou **Edge**.
2. Clique em **⬇️ Instalar o OpenLingo** na tela inicial (ou no ícone de instalar da barra de endereço).
3. Ele passa a abrir em janela própria, com ícone no sistema — no **Windows** (menu Iniciar), **macOS** (Launchpad/Dock) e **Linux** (lançador de apps).

**No celular:** conecte na mesma rede Wi-Fi, rode com `--https`/`https`, abra `https://SEU_IP:8000` no Chrome (aceite o aviso do certificado autoassinado) e use **Adicionar à tela inicial**.

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
├── run.sh / run.bat       # sobem o servidor (HTTP ou HTTPS) em Linux/macOS/Windows
├── backend/               # FastAPI
│   ├── main.py            # API: teste, curso, conversa, TTS, progresso, perfil
│   ├── irt.py             # motor TRI/Rasch + mapeamento CEFR
│   ├── ollama_client.py   # cliente Ollama (streaming e não-streaming)
│   ├── tts.py             # síntese de voz local (Piper / espeak-ng)
│   ├── gpu.py             # detector de GPU (preferência GPU, fallback CPU)
│   ├── db.py              # persistência SQLite (perfil, histórico, curso)
│   └── data/              # banco de itens (items.json) e currículo (course.json)
└── frontend/              # PWA (HTML/CSS/JS puro, sem build)
```

**Endpoints:** `/api/health`, `/api/profile`, `/api/placement/*`, `/api/progress`, `/api/course/*`, `/api/chat`, `/api/tts`.

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

---

## 📄 Licença e créditos

Projeto pessoal. Persona do professor baseada no modelo [`Lckoo1230/small-english-teacher-ollama`](https://huggingface.co/Lckoo1230/small-english-teacher-ollama). Vozes por [Piper](https://github.com/rhasspy/piper). IA local via [Ollama](https://ollama.com).
