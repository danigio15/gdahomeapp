# I pezzi di GdAHome OS

Qui, nell'immagine dell'add-on, stanno i pezzi che l'add-on mette su un
pannello a muro (`src/installatore-pannelli.js`, che li cerca in `/app/muro`):

| File                    | Cos'è                                                                       |
| ----------------------- | --------------------------------------------------------------------------- |
| `GdAHome-OS.apk`        | il servizio di sistema `com.gdahome.os`: avvio, relè, sensori, Zigbee, MQTT |
| `gdaserial-arm64-v8a`   | il ponte UART ↔ TCP per il chip Zigbee del pannello                         |
| `bootanimation-86.zip`  | l'animazione d'avvio del NSPanel Pro 86 (480×480)                           |
| `bootanimation-120.zip` | l'animazione d'avvio del NSPanel Pro 120 (750×1334)                         |

**Nella repository non ci sono, ed è voluto**: sono file costruiti. Li fa la
CI (`.github/workflows/immagini-add-on.yml`, lavoro «I pezzi di GdAHome OS»)
dal sorgente di GdAHome OS, che vive nella sua repository, al commit scritto in
`ORIGINE.json`. Fissato il commit, ogni immagine si rifà uguale; per portare
dentro un GdAHome OS nuovo si cambia quella riga.

Prima mancavano del tutto, e l'installazione si fermava su «Manca GdAHome OS
in questo add-on»: una prova dentro l'immagine appena costruita (stesso
workflow) adesso la ferma se uno di questi file non c'è.
