#!/bin/sh
# Avvia Ollama sulla rete interna degli add-on, e si assicura che il modello
# scelto ci sia. Il primo avvio lo scarica (un paio di minuti, un gigabyte);
# i successivi lo trovano in /data.
set -eu

modello="$(sed -n 's/.*"modello"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' /data/options.json 2>/dev/null || true)"
[ -n "$modello" ] || modello="qwen2.5:1.5b"

export OLLAMA_MODELS=/data/modelli
export OLLAMA_HOST=0.0.0.0:11434
# Un modello alla volta, e tenuto in memoria dieci minuti dopo l'ultima
# domanda: l'assistente chiede poco e di rado.
export OLLAMA_MAX_LOADED_MODELS=1
export OLLAMA_KEEP_ALIVE=10m
mkdir -p "$OLLAMA_MODELS"

ollama serve &
servizio=$!

i=0
until ollama list >/dev/null 2>&1; do
  i=$((i + 1))
  [ "$i" -lt 60 ] || { echo "Ollama non parte"; exit 1; }
  sleep 1
done

if ! ollama list | awk 'NR>1 {print $1}' | grep -qx "$modello"; then
  echo "Scarico il modello $modello: la prima volta ci vuole qualche minuto."
  ollama pull "$modello"
fi
echo "gdahome AI pronto, col modello $modello."

wait "$servizio"
