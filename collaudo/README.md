# Il collaudo

Guardare l'app girare, invece di crederci sulla parola.

```
   Chromium ── l'app vera (Flutter, versione web)
        │
        ▼  il codice di abbinamento, battuto come lo batterebbe una persona
   il ponte vero ── node ponte/src/index.js, quello dell'add-on
        │
        ▼
   una Home Assistant finta, con dentro una casa piccola
```

L'unica finzione e' l'ultima. Il ponte e' il processo vero, l'app e' l'app
vera, e il codice di abbinamento nasce dalla console come nasce in casa.

## Come si accende

```bash
cd app && flutter build web --release --dart-define=COLLAUDO=true
cd ../collaudo && npm install && npm run guarda
```

Le fotografie finiscono in `collaudo/foto/`.

Con `node guarda.mjs --resta` il banco resta acceso invece di spegnersi: si
apre l'indirizzo che stampa e ci si guarda dentro col browser, premendo i
bottoni a mano.

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

E' il motivo per cui questo banco esiste: ci sono cose che si vedono solo
guardando.

## Quello che il collaudo *non* prova

Il tocco simulato sui bottoni della barra del titolo a volte finisce sulla riga
sotto: l'albero dell'accessibilita' di Flutter mette i riquadri dove gli pare.
Non e' un difetto dell'app — col dito sul telefono funziona — quindi quel passo
si prova e, se non va, si tira avanti invece di far fallire tutto.

Per provare l'app **davvero**, sul telefono, sta tutto in
[`../COME_PROVARLA.md`](../COME_PROVARLA.md).
