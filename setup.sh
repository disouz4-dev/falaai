#!/usr/bin/env bash
# PT-BR: Setup do Guaralingo — cria o modelo do Ollama e baixa as vozes do Piper (obrigatórias).
# EN:    Guaralingo setup — creates the Ollama model and downloads the (required) Piper voices.
set -e
cd "$(dirname "$0")"

echo "==> 1/3 Criando o modelo do professor no Ollama..."
if command -v ollama >/dev/null 2>&1; then
  ollama create small-english-teacher -f Modelfile
else
  echo "   [ATENÇÃO] Ollama não encontrado. Instale em https://ollama.com/download e rode de novo."
fi

echo "==> 2/3 Verificando o Piper (voz do professor — OBRIGATÓRIO)..."
if ! command -v piper >/dev/null 2>&1; then
  echo "   'piper' não encontrado — instalando via pip..."
  (pip3 install --user piper-tts || pip install --user piper-tts) || \
    echo "   [ATENÇÃO] Falha ao instalar o piper-tts. Veja https://github.com/rhasspy/piper"
fi

echo "==> 3/3 Baixando as vozes do Piper (inglês + português) se faltarem..."
VOICES_DIR="backend/voices"
mkdir -p "$VOICES_DIR"
BASE="https://huggingface.co/rhasspy/piper-voices/resolve/main"
# PT-BR: par de arquivos (.onnx e .onnx.json) por voz. EN: (.onnx and .onnx.json) per voice.
download_voice () {
  local name="$1" url="$2"
  if [ ! -f "$VOICES_DIR/$name.onnx" ]; then
    echo "   baixando $name ..."
    curl -L --fail -o "$VOICES_DIR/$name.onnx"      "$url.onnx"       || echo "   falhou $name.onnx"
    curl -L --fail -o "$VOICES_DIR/$name.onnx.json" "$url.onnx.json"  || echo "   falhou $name.onnx.json"
  else
    echo "   $name já existe ✓"
  fi
}
download_voice "en_US-lessac-medium" "$BASE/en/en_US/lessac/medium/en_US-lessac-medium"
download_voice "pt_BR-faber-medium"  "$BASE/pt/pt_BR/faber/medium/pt_BR-faber-medium"

echo ""
echo "✅ Setup concluído. Agora rode:  ./run.sh   (ou ./run.sh --https para o celular)"
