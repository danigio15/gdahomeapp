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

## Come arrivano gli aggiornamenti sul pannello

1. Esce un add-on nuovo: la CI ha ricostruito GdAHome OS e l'app GdAHome Muro,
   ognuno con un numero di versione più alto (il numero della corsa della CI,
   che cresce sempre), e li ha scritti in `versioni.json`.
2. Poco dopo l'avvio, e poi ogni sei ore, l'add-on chiede a ogni pannello
   GdAHome che versioni ha (`src/pannelli.js`, `controllaGliAggiornamenti`).
3. Quelli indietro li aggiorna installando sopra: un numero più basso non si
   installa mai. Restano abbinamento, plancia e impostazioni.
4. Un pannello spento o fuori casa si aggiorna al giro dopo; nella console ha
   l'etichetta «aggiornamento pronto» e il tasto «Aggiorna».

Perché un aggiornamento si installi sopra, la **firma deve essere sempre la
stessa**. L'app GdAHome Muro si firma con la chiave del pannello (segreti
`CHIAVE_PANNELLO` e `CHIAVE_PANNELLO_PASSWORD`), dedicata solo a lei e diversa
da quella dell'app del telefono. **Non va mai cambiata né persa**: con una
chiave nuova i pannelli non si aggiornerebbero più senza reinstallare l'app.
GdAHome OS si firma con la chiave di sideload del suo repository.
