#!/usr/bin/env python3
"""Chi dice le frasi del film del quadro.

Sta qui, in Python, per una ragione sola: la voce e' un modello ONNX e chi lo
sa far parlare — kokoro-onnx — e' una libreria Python. Tutto il resto del
montaggio (i tempi, la traccia, il film) resta in `voce.mjs`, che chiama questo
programma una volta sola e gli passa tutte le frasi insieme: caricare il
modello costa un paio di secondi, e caricarlo trenta volte sarebbe un minuto
buttato a ogni ripresa.

Si parla per JSON, dallo standard input allo standard output:

    {"voce": "im_nicola", "lingua": "it", "andatura": 0.92,
     "pezzi": [{"testo": "…", "dove": "/tmp/…/0.wav"}, …]}

e torna `{"pezzi": [{"dove": "…", "dura": 3.42}, …]}`.

I wav escono a **16 bit**, che e' la forma che `voce.mjs` sa rimettere in fila:
il modello dentro lavora in virgola mobile, e un wav in virgola mobile la' si
leggerebbe come rumore.

Il modello e le voci non stanno nella repository — trecentocinquanta megabyte —
e si scaricano una volta sola in `strumenti/video/voce/`. Come, sta scritto in
cima a `voce.mjs`.
"""

import json
import os
import sys
from pathlib import Path

QUI = Path(__file__).resolve().parent
VOCE = QUI / "voce"


def dove_sta(nome, variabile):
    """Il modello, o la busta delle voci: qui di fianco, o dove dice chi chiama."""
    suo = os.environ.get(variabile)
    if suo and Path(suo).exists():
        return Path(suo)
    vicino = VOCE / nome
    if vicino.exists():
        return vicino
    raise SystemExit(
        f"manca {nome}: si scarica una volta sola in strumenti/video/voce/ "
        f"(le istruzioni sono in cima a voce.mjs), oppure si dice con {variabile}."
    )


def main():
    lavoro = json.load(sys.stdin)
    try:
        from kokoro_onnx import Kokoro
        import soundfile as suono
    except ImportError as manca:
        raise SystemExit(
            f"manca una libreria: {manca.name}. "
            "Si mette con: pip install kokoro-onnx soundfile"
        )

    kokoro = Kokoro(
        str(dove_sta("kokoro-v1.0.onnx", "KOKORO_MODELLO")),
        str(dove_sta("voices-v1.0.bin", "KOKORO_VOCI")),
    )

    fuori = []
    alSecondo = None
    for pezzo in lavoro["pezzi"]:
        onde, alSecondo = kokoro.create(
            pezzo["testo"],
            voice=lavoro["voce"],
            speed=float(lavoro.get("andatura", 1.0)),
            lang=lavoro.get("lingua", "it"),
        )
        suono.write(pezzo["dove"], onde, alSecondo, subtype="PCM_16")
        fuori.append({"dove": pezzo["dove"], "dura": len(onde) / alSecondo})

    json.dump({"pezzi": fuori, "alSecondo": alSecondo}, sys.stdout)


if __name__ == "__main__":
    main()
