# gdahome in un browser

La stessa app che hai sul telefono, aperta da un computer: la plancia, la
Configurazione, i dispositivi, le segnalazioni. Non è una versione ridotta —
è la stessa, compilata per il browser.

## Com'è possibile, visto che un browser non apre server

Sul telefono la plancia arriva da un **servitore**: un server che l'app apre
dentro di sé su `127.0.0.1`. Prende i file dal ponte, sul filo, e li serve al
riquadro. In un browser un server non si può aprire, ed è la sola ragione per
cui fino a ieri la versione web diceva «la plancia si vede sul telefono».

Un **service worker** fa la stessa cosa da dentro. Si mette in mezzo alle
richieste di `dashboardmodern_static/` — dove sta tutta la plancia — e di
`api/`, e risponde lui. I file non ce li ha: li chiede all'app, che li fa
arrivare **sul filo** come li fa arrivare sul telefono. Stessa strada, stessi
byte, stessa cifratura; cambia solo chi li serve all'ultimo metro.

Il WebSocket della plancia di lì non può passare — un service worker vede le
richieste, non i WebSocket — e allora non è un WebSocket: è un oggetto finto,
messo nella pagina insieme alle altre premesse, che manda i messaggi all'app e
riceve da lei. Dall'altra parte c'è la **stessa cucitura** del telefono, che li
rinumera e li mette sul filo.

Due conseguenze che vale la pena dire:

- **Nessuna porta nuova sul ponte.** Un service worker risponde solo alle
  pagine della sua origine, e la sua origine è l'app. Da fuori non si vede
  niente che non si vedesse prima.
- **Funziona anche fuori casa.** Passa dal filo, e il filo passa dal centralino
  quando serve. Non è legato alla rete di casa.

## Le due differenze vere

**Il gzip.** Il ponte comprime quello che manda, e nel browser `dart:io` non
c'è: il gzip non si apre. Mettersi in casa un decompressore per una cosa che si
può semplicemente non fare è il modo lungo — l'app dice al ponte di non
comprimere (`senzaGzip`), e sul filo passa qualche byte in più. Sulla rete di
casa non si sente. Chi non lo chiede — cioè ogni telefono — riceve quello che
riceveva prima.

**Il service worker di Flutter.** Flutter ne registra uno suo, per far partire
l'app senza rete. Vuole lo stesso ambito del nostro, e chi arriva secondo
scalza il primo. Il nostro serve a far vedere la casa; quello di Flutter a far
partire l'app senza casa, che non serve a niente. Perciò si costruisce con
`--pwa-strategy=none`.

## Come si prova

```bash
cd app && flutter build web --release --pwa-strategy=none
```

Poi si serve `app/build/web` da qualunque parte. Due condizioni:

1. **`https`, oppure `localhost`.** I service worker non girano su `http` verso
   un indirizzo qualunque: è una regola del browser, non nostra.
2. Il ponte deve essere raggiungibile — dalla rete di casa o dal centralino,
   come per il telefono.

Il collaudo lo fa da sé: `cd collaudo && node guarda.mjs` costruisce, serve,
abbina e guarda tutte le pagine della plancia arrivare dal service worker.

## Cosa non c'è, nel browser

- **Inquadrare il codice a quadretti**: la fotocamera nel browser si può
  chiedere, ma il codice lungo si incolla, ed è più veloce.
- **Le notifiche**: non ce ne sono nemmeno sul telefono, per ora.
- **Il nome del dispositivo**: sul telefono l'app sa come si chiama il telefono;
  nel browser no, e la casa si registra col nome che gli dai tu.
