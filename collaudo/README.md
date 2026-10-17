# Il collaudo

Guardare l'app girare, invece di crederci sulla parola.

```
   Chromium ── l'app vera (Flutter, versione web)
        │           └── il riquadro della plancia ── il servitore vero
        │                                            (dart run bin/servitore.dart)
        ▼  il codice di abbinamento, battuto come lo batterebbe una persona
   il ponte vero ── node ponte/src/index.js, quello dell'add-on
        │
        ▼
   una Home Assistant finta, con dentro la casa demo di DashboardModern
   (i file della plancia e la sua configurazione ce li ha il ponte)
```

L'unica finzione e' l'ultima. Il ponte e' il processo vero, l'app e' l'app
vera, il servitore — il server che dentro l'app serve la plancia al WebView —
e' lo stesso che gira sul telefono, e il codice di abbinamento nasce dalla
console come nasce in casa.

Sul web un server dentro la pagina non si apre: il servitore si accende a
parte, sulla porta 8765, e il riquadro dell'app ci punta con `PLANCIA_URL`.
E' l'unica differenza col telefono, dove il servitore sta dentro l'app.

## Come si accende

```bash
cd app && flutter build web --release --pwa-strategy=none --dart-define=COLLAUDO=true \
  --dart-define=PLANCIA_URL=http://127.0.0.1:8765
cd ../collaudo && npm install && npm run guarda
```

I file della plancia il ponte li ha con se', in `ponte/plancia/` — gli
stessi che vanno nell'add-on — e la configurazione della casa demo gliela
mette il collaudo nell'archivio prima di accenderlo. In Home Assistant, vera o
finta, non c'e' nessuna integrazione.

Le fotografie finiscono in `collaudo/foto/`: la plancia vera dentro l'app,
pagina per pagina dalla sua barra, e poi la barra dell'app, i dispositivi,
le segnalazioni, l'assistenza con «Come va l'app», le case.

Con `node guarda.mjs --resta` il banco resta acceso invece di spegnersi: si
apre l'indirizzo che stampa e ci si guarda dentro col browser, premendo i
bottoni a mano.

Con `node guarda.mjs --scuro` l'app gira col tema scuro, come la vede chi
tiene il telefono cosi', e le fotografie finiscono in `collaudo/foto/scuro/`.

Con `node guarda.mjs --iphone` le fotografie escono a 1290 × 2796, e con
`node guarda.mjs --ipad` a 2752 × 2064: sono le misure che l'App Store vuole
per iPhone e iPad (in `collaudo/foto/iphone/` e `collaudo/foto/ipad/`).

Con `COLLAUDO_SALTA_PLANCIA=1 node guarda.mjs` si salta il giro delle pagine
della plancia, che e' la parte lunga: serve a chi sta lavorando a una
schermata dell'app — le segnalazioni, l'assistenza, le case — e vuole
arrivarci in un minuto invece che in quattro.

## Perche' `--dart-define=COLLAUDO=true`

Flutter disegna su una tela. In una pagina web questo vuol dire che nel
documento non c'e' nessun bottone da premere e nessun testo da leggere — ne'
per un programma che guida il browser, ne' per chi usa un lettore di schermo.
Quel flag accende l'albero dell'accessibilita', che rimette tutto nel
documento.

Non e' un trucco da collaudo: e' la stessa cosa che serve a chi l'app la usa
senza vederla. `bool.fromEnvironment` si decide quando si costruisce, quindi
nella versione che va sui telefoni quella riga non c'e' proprio.

## Cosa ha gia' trovato

Il primo giro ha trovato due sviste di grammatica che nessuna prova aveva
preso, perche' le prove guardavano il numero e non la frase: «1 **aperte**» e
«1 **accese**». Sono la prima cosa che si nota guardando la home, e fanno
sembrare sciatto tutto il resto.

Il secondo ha trovato una cosa molto peggiore, e l'ha trovata perche' e' qui
che l'app gira **in un browser**. Dart compilato in JavaScript non ha gli
interi a sessantaquattro bit, e i contatori delle buste cifrate ne usavano
uno: ogni singolo messaggio scoppiava, e l'errore finiva in una coda che non
guardava nessuno. Il filo restava aperto e muto, e a schermo si vedeva una
rotella per venticinque secondi e poi «il ponte non risponde». Tutte le prove
erano verdi: giravano sulla macchina virtuale, dove quel numero esiste.

Due cure, e la seconda vale piu' della prima: i contatori adesso si scrivono
in due meta' da trentadue bit — le stesse su tutti e due — e la cifratura ha
una prova che gira **dentro un browser**, dentro la CI. Ma soprattutto: un
errore che non e' quello previsto adesso chiude il filo e dice cosa e'
successo, invece di essere ingoiato. Un errore ingoiato costa sempre piu' di
quello che nasconde.

E' il motivo per cui questo banco esiste: ci sono cose che si vedono solo
guardando.

## L'altro banco: il link

```bash
node collaudo/guarda-il-link.mjs
```

Non e' lo stesso giro. Qui non c'e' nessuna casa e nessun abbinamento: si guarda
**gdahome servita dall'add-on**, che e' il link che si apre dalla console.

Accende il ponte vero con dentro `ponte/app/`, gli mette davanti un prefisso di
ingress finto — uno di quelli che Home Assistant cambia a ogni riavvio — e apre
la pagina con un browser vero, a tre larghezze: telefono, tablet, computer. Poi
controlla che la pagina si sia calcolata bene da dove pende, e fotografa.

Serve perche' quando uno di quei pezzi e' storto **non c'e' nessun errore**: c'e'
una pagina bianca, e un errore che non si vede si trova solo guardando. Le
fotografie restano in `collaudo/foto/link-*.png`.

## E il sito

```bash
node guarda-il-sito.mjs
```

Il sito in [`../sito/`](../sito/README.md) e' fatto di file statici e non ha
prove sue: non c'e' niente da chiamare, non c'e' niente che risponda. L'unico
modo di sapere se sta in piedi e' aprirlo con un browser e provarci dentro.

Questo lo serve, lo apre a tre larghezze e guarda che **ogni fotografia
arrivi** — scorrendo la pagina, e chiedendo subito quelle dei nastri — che le
sezioni della plancia, dell'app e di gdanav ci siano e si raggiungano dal
menu, che la lingua si cambi, che il modulo dei contatti mandi al tramite, che
non ci siano errori in console ne' file che non arrivano, e che la pagina non
scorra di lato. Le fotografie restano in `collaudo/foto/sito-*.png`.

## Le fotografie della plancia, per il sito

```bash
node strumenti/porta-nel-sito.mjs
node collaudo/fotografa-la-plancia.mjs
node strumenti/porta-nel-sito.mjs
```

Il sito fa vedere la plancia con fotografie, e queste sono della plancia vera:
la stessa che `porta-nel-sito.mjs` mette in `sito/dashboardmodern_static/`,
con dentro la Home Assistant finta della pagina (`sito/casa-in-pagina.js`) e
questa casa demo. Lo script prende ogni pagina dalla sua linguetta — la casa,
le luci, il clima, l'energia, le finestre, la sicurezza, l'auto, le stanze, e
la casa e l'energia anche sul computer — e le scrive in
`docs/immagini/plancia-*.jpg`. La seconda passata di `porta-nel-sito.mjs` le
copia nel sito.

La configurazione della casa demo porta, accanto a `dm_dashboard_state`, anche
le chiavi «di prima» di ogni sezione — `cd_energy_model`, `cd_loads`,
`cd_ev_cars`, `cd_piscina`, `cd_irrigazione`, `cd_robot`, `cd_energy_loads` —
uguali alle sezioni della copia canonica, come le salva una plancia vera.
All'avvio la plancia fa parlare per ultime quelle (`core/dashboard-store.js`),
e una chiave che manca la riscrive vuota: senza `cd_energy_model` la pagina
Energia restava senza fotovoltaico, rete e batteria.

## Quello che il collaudo *non* prova

Il tocco simulato sui bottoni della barra del titolo a volte finisce sulla riga
sotto: l'albero dell'accessibilita' di Flutter mette i riquadri dove gli pare.
Non e' un difetto dell'app — col dito sul telefono funziona — quindi quel passo
si prova e, se non va, si tira avanti invece di far fallire tutto.

Per provare l'app **davvero**, sul telefono, sta tutto in
[`../COME_PROVARLA.md`](../COME_PROVARLA.md).
