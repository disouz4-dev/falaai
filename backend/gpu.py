"""
PT-BR: Detector de GPU do OpenLingo. Detecta GPU (NVIDIA / AMD / Apple Silicon) e a VRAM
       disponível, e decide o dispositivo: dá PREFERÊNCIA à GPU e cai para CPU quando a GPU
       não suporta o modelo (VRAM insuficiente). O Ollama já usa a GPU por padrão e faz
       offload parcial; aqui detectamos, reportamos e ajustamos quando necessário.
EN:    OpenLingo GPU detector. Detects the GPU (NVIDIA / AMD / Apple Silicon) and available
       VRAM, then decides the device: PREFERS the GPU and falls back to CPU when the GPU can't
       fit the model. Ollama already uses the GPU by default with partial offload; here we
       detect, report and adjust when needed.
"""

import os
import platform
import re
import shutil
import subprocess

# PT-BR: tamanho aproximado do modelo em GB (para decidir GPU x CPU). EN: approx model size (GB).
MODEL_SIZE_GB = float(os.environ.get("OPENLINGO_MODEL_GB", "3.6"))  # gemma3:4b ~3.3-3.6 GB
_OVERHEAD_GB = 1.2  # PT-BR: margem p/ contexto/KV cache. EN: headroom for context/KV cache.


def _nvidia():
    """PT-BR: detecta GPU NVIDIA via nvidia-smi. EN: detect NVIDIA GPU via nvidia-smi."""
    if not shutil.which("nvidia-smi"):
        return None
    try:
        out = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,memory.total,memory.free",
             "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=6,
        ).stdout.strip()
        if not out:
            return None
        name, total, free = [x.strip() for x in out.splitlines()[0].split(",")]
        return {"vendor": "NVIDIA", "name": name,
                "vram_total_gb": round(float(total) / 1024, 1),
                "vram_free_gb": round(float(free) / 1024, 1)}
    except Exception:
        return None


def _amd():
    """PT-BR: detecta GPU AMD (ROCm). EN: detect AMD GPU (ROCm)."""
    if not (shutil.which("rocm-smi") or shutil.which("rocminfo")):
        return None
    try:
        out = subprocess.run(["rocm-smi", "--showmeminfo", "vram"],
                             capture_output=True, text=True, timeout=6).stdout
        m = re.search(r"Total.*?(\d+)", out)
        total_gb = round(int(m.group(1)) / (1024 ** 3), 1) if m else None
        return {"vendor": "AMD", "name": "AMD GPU (ROCm)",
                "vram_total_gb": total_gb, "vram_free_gb": total_gb}
    except Exception:
        return {"vendor": "AMD", "name": "AMD GPU (ROCm)", "vram_total_gb": None, "vram_free_gb": None}


def _apple():
    """PT-BR: Apple Silicon usa Metal (memória unificada). EN: Apple Silicon uses Metal (unified memory)."""
    if platform.system() == "Darwin" and platform.machine() in ("arm64", "aarch64"):
        return {"vendor": "Apple", "name": "Apple Silicon (Metal)",
                "vram_total_gb": None, "vram_free_gb": None}
    return None


def detect():
    """
    PT-BR: Retorna o estado da aceleração e o dispositivo escolhido.
    EN:    Returns the acceleration status and the chosen device.
    """
    gpu = _nvidia() or _amd() or _apple()
    needed = MODEL_SIZE_GB + _OVERHEAD_GB

    if not gpu:
        return {"gpu": False, "device": "cpu", "vendor": None, "name": "CPU",
                "reason": "Nenhuma GPU detectada — usando CPU.",
                "model_needs_gb": round(needed, 1)}

    free = gpu.get("vram_free_gb")
    # PT-BR: Apple/AMD sem leitura exata → confia no Ollama (usa a GPU). EN: unknown VRAM → trust Ollama.
    if free is None:
        device, reason = "gpu", f"GPU {gpu['name']} detectada — usando aceleração."
    elif free >= needed:
        device, reason = "gpu", (f"GPU {gpu['name']} com {free} GB livres — "
                                 f"modelo (~{needed:.1f} GB) cabe na VRAM. Usando GPU.")
    elif free >= MODEL_SIZE_GB * 0.5:
        device, reason = "gpu-partial", (f"GPU {gpu['name']} com {free} GB livres — "
                                         f"offload parcial GPU+CPU (modelo ~{MODEL_SIZE_GB} GB).")
    else:
        device, reason = "cpu", (f"GPU {gpu['name']} com apenas {free} GB livres — "
                                 f"insuficiente para o modelo (~{needed:.1f} GB). Usando CPU.")

    return {"gpu": device != "cpu", "device": device, "vendor": gpu["vendor"],
            "name": gpu["name"], "vram_total_gb": gpu.get("vram_total_gb"),
            "vram_free_gb": free, "model_needs_gb": round(needed, 1), "reason": reason}


def apply_env():
    """
    PT-BR: Ajusta variáveis do Ollama conforme a decisão. Se a GPU não suporta, força CPU
           (OLLAMA_NUM_GPU=0) para evitar erros de falta de VRAM. EN: tune Ollama env per decision.
    """
    info = detect()
    if info["device"] == "cpu" and info["vendor"] is not None:
        # PT-BR: GPU existe mas não cabe → força CPU no Ollama. EN: GPU too small → force CPU.
        os.environ.setdefault("OLLAMA_NUM_GPU", "0")
    return info


if __name__ == "__main__":
    import json
    print(json.dumps(detect(), indent=2, ensure_ascii=False))
