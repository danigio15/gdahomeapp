# I pannelli a muro dall'add-on

> Progetto. Dice cosa si costruisce e in che ordine; i pezzi già fatti sono
> segnati ✅.

«Creiamo un inject semplice che può fare qualsiasi utente»: un Sonoff NSPanel
Pro (86 o 120) diventa un pannello GdAHome **dalla pagina dell'add-on**, senza
computer e senza comandi. E in casa i pannelli possono essere più d'uno.

## Cosa vede chi installa

Nella console dell'add-on c'è una linguetta **«Pannelli a muro»** (solo per chi
amministra). Dentro, l'elenco dei pannelli della casa, ognuno con nome, stanza,
modello, indirizzo e stato:

| Pannello | Modello | Stato | |
| --- | --- | --- | --- |
| Ingresso | NSPanel Pro 86 | ● GdAHome OS 2.0 · plancia «Ingresso» | Aggiorna · Riavvia · ⋯ |
| Cucina | NSPanel Pro 120 | ● GdAHome OS 2.0 · plancia «Cucina» | Aggiorna · Riavvia · ⋯ |
| (nuovo) 192.168.1.53 | NSPanel Pro 86 | ○ Sonoff · pronto per l'installazione | **Installa GdAHome OS** |

**«+ Aggiungi un pannello»** chiede l'indirizzo del pannello (con ADB acceso
dall'app eWeLink, una volta sola) e poi fa tutto da sé:

1. **Verifica**: modello, root, partizioni, WebView, spazio.
2. **Copia di sicurezza** di tutte le partizioni in `/share/gdahome-os/<pannello>/`
   (si vede dalla cartella condivisa di Home Assistant), verificata.
3. **Installazione**: GdAHome OS al posto del software Sonoff, l'app
   **GdAHome Muro**, l'animazione d'avvio del modello.
4. **Abbinamento**: il pannello entra nella casa da solo, come un telefono
   abbinato, con l'utente di Home Assistant scelto e la **plancia a muro**
   scelta (una per pannello: l'ingresso ha la sua, la cucina la sua).

Dopo, dalla stessa riga: **Aggiorna** (app e sistema), **Riavvia**, **Cambia
plancia**, **Rimetti Sonoff**, **Togli** (lo stacca dalla casa come un telefono).

## I pezzi

```
 add-on GdAHome (Home Assistant)                     NSPanel Pro
┌──────────────────────────────────────┐  ADB/rete  ┌──────────────────────────┐
│ console: «Pannelli a muro»           │──────────▶│ GdAHome OS (sistema)      │
│ pannelli.js: elenco, stati, lavori   │           │  avvio, relè, Zigbee, MQTT│
│ adb (android-tools) + chiave in /data│           │ GdAHome Muro (app)        │
│ installa: gdahome-os (backup, ecc.)  │◀──────────│  plancia a muro, schermo  │
│ porta 8098: portiere (cifrato) ──────┼── filo ──▶│  stesso filo cifrato      │
└──────────────┬───────────────────────┘           └──────────────────────────┘
               │ solo case Premium
        centralino: l'APK di GdAHome Muro (privato)
```

### 1. L'app «GdAHome Muro» (`com.gdahome.muro`)

Una seconda versione dell'app Flutter di `app/`, con un ingresso suo
(`lib/main_muro.dart`) e un *flavor* Android `muro`. Prende dall'app quello che
è già collaudato:

- il **filo cifrato** con l'add-on (`lib/ponte/`): stretta X25519, buste
  AES-GCM, nessuna strada in chiaro, nemmeno in casa;
- la **plancia** con la sua cucitura (`lib/plancia/`);
- lo **schermo a muro** (`lib/casa/lo_schermo.dart`): luce, prossimità, notte,
  campanello.

E lascia fuori tutto il resto: GdANav, Android Auto, orologi, Salute, Firebase,
acquisti, menu. Si apre direttamente sulla plancia a muro del pannello.

**Premium.** La plancia a muro è Premium e resta tale: con una casa Base
l'add-on rifiuta un'app «muro» alla stretta (come fa già fuori casa con
`premium-richiesto`) e la plancia non si apre. Il controllo è nell'add-on,
non nell'app: un APK copiato non apre niente.

### 2. La distribuzione privata (centralino)

L'APK di GdAHome Muro **non** sta su GitHub né dentro l'add-on (che è
un'immagine pubblica): lo costruisce la CI e lo porta sul centralino. L'add-on
lo chiede al centralino con la licenza della casa, e il centralino lo dà solo a
una casa Premium. L'add-on lo tiene in `/data/muro/` e da lì aggiorna i
pannelli: un'app nuova arriva con il suo numero, e i pannelli si aggiornano
dalla pagina (o da soli, se lo si sceglie).

### 3. L'add-on: «Pannelli a muro»

- `ponte/src/pannelli.js`: l'elenco dei pannelli (`/data/pannelli.json`), più
  d'uno per casa; per ognuno indirizzo, nome, modello, dispositivo abbinato,
  plancia, versioni, ultimo lavoro.
- `ponte/src/adb.js`: `adb` come `djpeg` in `rimpicciolisci.js` (avviato con
  `spawn`, con tempo massimo, iniettabile nelle prove); la chiave ADB
  dell'add-on in `/data/adb/`.
- I lavori lunghi (copia di sicurezza, installazione) girano uno per pannello e
  la console ne segue l'avanzamento.
- Nell'immagine: `apk add android-tools`.

### 4. GdAHome OS

Il sistema del pannello resta quello del repository `danigio15`
(`gdahome-nspanel/`): avvio, relè, Zigbee, sensori, MQTT. Cambia solo l'app che
apre: `com.gdahome.muro` invece dell'app dello store.

## L'ordine

1. ✅ La plancia a muro sui due NSPanel: nome della stanza intero sul 86, niente
   buco sul 120 (add-on 1.19.33).
2. La pagina «Pannelli a muro» con più pannelli, `adb` nell'add-on, verifica e
   installazione di GdAHome OS.
3. L'app GdAHome Muro (flavor `muro`) e il rifiuto Premium alla stretta.
4. La distribuzione privata dal centralino e gli aggiornamenti dei pannelli.
