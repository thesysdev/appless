#!/usr/bin/env bash
# Run on the GPU host with vLLM >= 0.24 installed.
set -euo pipefail

if ! command -v vllm >/dev/null 2>&1; then
  echo 'Install vLLM first: pip install "vllm>=0.24"' >&2
  exit 1
fi

exec vllm serve thesysdev/OUI-1 \
  --served-model-name OUI-1 \
  --trust-remote-code \
  --quantization fp8 \
  --max-model-len "${VLLM_MAX_MODEL_LEN:-16384}" \
  --max-num-seqs "${VLLM_MAX_NUM_SEQS:-4}" \
  --enable-auto-tool-choice \
  --tool-call-parser gemma4 \
  --host "${VLLM_HOST:-0.0.0.0}" \
  --port "${VLLM_PORT:-8000}" \
  "$@"
