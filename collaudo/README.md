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
   e i file veri della plancia (PLANCIA_VERA=…/frontend)
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
cd app && flutter build web --release --dart-define=COLLAUDO=true \
  --dart-define=PLANCIA_URL=http://127.0.0.1:8765
cd ../collaudo && npm install
PLANCIA_VERA=/dove/sta/dashboardmodern-v2/custom_components/dashboardmodern/frontend npm run guarda
```

`PLANCIA_VERA` e' la cartella del frontend di DashboardModern, presa da un
checkout di `dashboardmodern-v2`: la casa finta serve quei file al ponte, e il
ponte li serve al servitore, come in casa. Senza, la casa finta e' una casa
dove DashboardModern non c'e', e si vede cosa dice l'app in quel caso.

Le fotografie finiscono in `collaudo/foto/`: la plancia vera dentro l'app,
pagina per pagina dalla sua barra, e poi la barra dell'app, i dispositivi,
le case.

Con `node guarda.mjs --resta` il banco resta acceso invece di spegnersi: si
apre l'indirizzo che stampa e ci si guarda dentro col browser, premendo i
bottoni a mano.

Con `node guarda.mjs --scuro` l'app gira col tema scuro, come la vede chi
tiene il telefono cosi', e le fotografie finiscono in `collaudo/foto/scuro/`.

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

## Quello che il collaudo *non* prova

Il tocco simulato sui bottoni della barra del titolo a volte finisce sulla riga
sotto: l'albero dell'accessibilita' di Flutter mette i riquadri dove gli pare.
Non e' un difetto dell'app — col dito sul telefono funziona — quindi quel passo
si prova e, se non va, si tira avanti invece di far fallire tutto.

Per provare l'app **davvero**, sul telefono, sta tutto in
[`../COME_PROVARLA.md`](../COME_PROVARLA.md).
