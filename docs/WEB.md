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

## Il link: dove si apre

Il link lo dà **l'add-on**, e non c'è niente da installare da nessuna parte:
chi ha il ponte acceso ha già gdahome.

1. In Home Assistant, barra laterale → **Il ponte**.
2. Nella scheda «gdahome in un browser», premi **Apri gdahome**.

L'indirizzo è quello dell'add-on con `/app/` in fondo, e sta **dietro
l'ingress**: ci arriva solo chi è già entrato in Home Assistant. Non c'è nessuna
porta nuova aperta sul router, e da fuori casa non si vede niente che non si
vedesse prima.

Funziona su computer, tablet e telefono: l'app guarda quanto è largo lo schermo
e si dispone di conseguenza — la barra resta aperta di fianco su un computer, si
apre a scomparsa su tablet e telefono, e il contenuto non si allarga oltre il
punto in cui una riga di testo diventa faticosa da leggere.

### La sola cosa che manca, su `http`

Se apri Home Assistant su un indirizzo `http` — `http://homeassistant.local:8123`
e simili — **la plancia nel browser non si disegna**. Tutto il resto sì.

Non è un pezzo che manca: è che la plancia la serve un service worker, e i
service worker i browser li fanno girare solo su `https` o su `localhost`. È una
regola loro, e non c'è modo di aggirarla dal nostro lato. L'app lo scrive a
schermo invece di restare bianca, e la console lo dice prima ancora di aprirla.

Come si ha `https` su Home Assistant, in ordine di fatica:

- **Nabu Casa** (Impostazioni → Home Assistant Cloud): è `https` e basta.
- Un proxy davanti a Home Assistant con un certificato (NGINX, Caddy,
  Cloudflare Tunnel).
- Sul telefono, niente: **l'app installata non ha questo problema**, perché lì
  la plancia la serve un server vero dentro l'app.

## Come ci finisce dentro l'add-on

L'app web è roba costruita, e chi ha l'add-on in casa non ha un computer per
costruirsela. Perciò se la porta dietro l'add-on: in `ponte/app/` c'è
`flutter build web` già fatto, e il ponte serve quella cartella sotto `/app/`.

Si rifà da GitHub, senza computer: **Actions → «gdahome dentro l'add-on» → Run
workflow**. Costruisce, toglie quello che non serve, ricontrolla e salva. Poi si
aggiorna l'add-on.

A mano, per chi ha un computer:

```bash
cd app && flutter build web --release --pwa-strategy=none
cd .. && node strumenti/porta-l-app.mjs
```

Quindici megabyte, non quarantasei: Flutter costruisce **sei** motori di
disegno — uno per ogni browser che potrebbe capitare — e ne serve uno.
`app/web/flutter_bootstrap.js` ne sceglie uno solo (`canvaskit`, nella versione
buona per tutti), e `porta-l-app.mjs` lascia fuori gli altri cinque e le tabelle
dei simboli. Se un giorno quella riga cambia senza che cambi la lista, la prova
`ponte/test/app.test.js` se ne accorge — prima che l'app smetta di partire su
Chrome e basta.

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

E il link, servito dall'add-on sotto un prefisso di ingress finto:

```bash
node collaudo/guarda-il-link.mjs
```

Apre `ponte/app/` col ponte vero, davanti gli mette un prefisso come quello che
Home Assistant cambia a ogni riavvio, e fotografa la pagina a tre larghezze —
telefono, tablet, computer. Se la pagina non trovasse i suoi file non ci sarebbe
nessun errore da nessuna parte: ci sarebbe una pagina bianca. Per questo si
guarda con un browser vero.

## Cosa non c'è, nel browser

- **Inquadrare il codice a quadretti**: la fotocamera nel browser si può
  chiedere, ma il codice lungo si incolla, ed è più veloce.
- **Le notifiche**: non ce ne sono nemmeno sul telefono, per ora.
- **Il nome del dispositivo**: sul telefono l'app sa come si chiama il telefono;
  nel browser no, e la casa si registra col nome che gli dai tu.
