# 🦜 OpenLingo

Plataforma de ensino de inglês estilo Duolingo, **100% local**, usando IA via **Ollama**
(modelo `small-english-teacher`, recriação fiel do
[Lckoo1230/small-english-teacher-ollama](https://huggingface.co/Lckoo1230/small-english-teacher-ollama)).

## O que já faz

- 🎯 **Teste de nivelamento adaptativo (CEFR A1–C2)** — 20 questões que se ajustam ao seu
  desempenho usando **Teoria de Resposta ao Item (modelo de Rasch + estimativa EAP)**, o mesmo
  princípio de testes reais (EF SET, Cambridge Linguaskill, Duolingo English Test). Mede
  **gramática, vocabulário e leitura** com itens alinhados ao que cada nível de fato exige.
- 📋 **Relatório da IA** ao final: nível, ponto forte/fraco e plano de estudo personalizado (em PT-BR).
- 🎙️ **Conversação por voz em tempo real** — você fala em inglês (Web Speech API), o professor
  de IA responde por voz, adaptando o vocabulário ao seu nível e corrigindo com gentileza.
- 📱 **PWA responsiva** — funciona no PC e no **celular**, instalável como app.

## Requisitos

- [Ollama](https://ollama.com) rodando localmente
- Python 3.10+
- Navegador **Chrome** (para o reconhecimento de voz)

## Instalação do modelo

```bash
ollama create small-english-teacher -f Modelfile
```

> O modelo é construído sobre `gemma3:4b` mantendo o system prompt/persona original.
> Se preferir outra base, edite a linha `FROM` no `Modelfile`.

## Rodar

**No PC:**

```bash
./run.sh
```

Abra `http://localhost:8000`.

**No celular (com microfone):** o navegador só libera o microfone em contexto seguro (HTTPS).
Rode com TLS autoassinado:

```bash
./run.sh --https
```

O terminal mostra o endereço `https://SEU_IP:8000`. No celular (mesma rede Wi-Fi), abra esse
endereço e **aceite o aviso de certificado** (autoassinado).

## Arquitetura

```
openlingo/
├── Modelfile              # modelo Ollama small-english-teacher
├── run.sh                 # sobe o servidor (HTTP ou HTTPS)
├── backend/               # FastAPI
│   ├── main.py            # API: teste adaptativo, resultado, conversação
│   ├── irt.py             # motor TRI/Rasch + mapeamento CEFR
│   ├── ollama_client.py   # cliente Ollama (streaming e não-streaming)
│   └── data/items.json    # banco de itens calibrado por nível
└── frontend/              # PWA (HTML/CSS/JS puro, sem build)
    ├── index.html
    ├── styles.css
    ├── app.js
    ├── manifest.webmanifest
    └── sw.js
```

## Roadmap

- [ ] Geração de novos itens pela IA (expandir o banco / evitar repetição)
- [ ] Árvore de lições e exercícios diários (XP, ofensiva, vidas)
- [ ] Repetição espaçada (SRS) para vocabulário
- [ ] Correção de pronúncia na conversação
- [ ] Contas de usuário e histórico de progresso
