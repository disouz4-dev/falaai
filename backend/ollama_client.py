"""
PT-BR: Cliente do Ollama para o Guaralingo. Fala com o modelo local 'small-english-teacher'
       tanto para conversação em tempo real (streaming) quanto para gerar itens/relatórios.
EN:    Ollama client for Guaralingo. Talks to the local 'small-english-teacher' model for both
       real-time conversation (streaming) and item/report generation.
"""

import json
import os
import urllib.request

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
MODEL = os.environ.get("GUARALINGO_MODEL", "small-english-teacher")


def chat_once(messages, temperature=0.6):
    """
    PT-BR: Chamada de chat sem streaming — retorna o texto completo. Usado para gerar
           relatório final e itens. EN: Non-streaming chat call — returns full text.
    """
    payload = {
        "model": MODEL,
        "messages": messages,
        "stream": False,
        "options": {"temperature": temperature},
    }
    req = urllib.request.Request(
        f"{OLLAMA_URL}/api/chat",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data.get("message", {}).get("content", "")


def chat_stream(messages, temperature=0.6):
    """
    PT-BR: Gerador que produz pedaços de texto em streaming (para conversação por voz).
    EN:    Generator yielding streamed text chunks (for voice conversation).
    """
    payload = {
        "model": MODEL,
        "messages": messages,
        "stream": True,
        "options": {"temperature": temperature},
    }
    req = urllib.request.Request(
        f"{OLLAMA_URL}/api/chat",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        for raw in resp:
            line = raw.decode("utf-8").strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            chunk = obj.get("message", {}).get("content", "")
            if chunk:
                yield chunk
            if obj.get("done"):
                break


def is_available():
    """PT-BR: Verifica se o Ollama está no ar. EN: Check whether Ollama is reachable."""
    try:
        with urllib.request.urlopen(f"{OLLAMA_URL}/api/tags", timeout=3) as resp:
            tags = json.loads(resp.read().decode("utf-8"))
        names = [m.get("name", "") for m in tags.get("models", [])]
        return any(MODEL in n for n in names), names
    except Exception:
        return False, []
