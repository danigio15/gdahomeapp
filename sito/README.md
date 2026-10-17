# Il sito

Il posto dove il progetto si racconta a chi non l'ha mai visto: cos'è l'app,
come fa la casa a rispondere da fuori senza che si apra niente sul router, e
le due app — **gdahome** e **gdanav** — fatte vedere con le loro fotografie.

Sta su **[gdahome.org](https://gdahome.org)**.

## Fotografie, e non la plancia in un riquadro

Nella sezione «La plancia» c'era, in un riquadro, **la plancia vera** — gli
stessi file dell'add-on, con dietro una Home Assistant finta
(`casa-in-pagina.js`) e la casa demo del collaudo. Sul server però la plancia
nel sito non sta in git: la rifà `strumenti/porta-nel-sito.mjs` a ogni
versione, e quando non c'era al suo posto compariva un riquadro con scritto
«La plancia non è stata pubblicata su questo server». A chi legge non diceva
niente, e lasciava un buco nel mezzo della pagina.

Adesso le tre sezioni che raccontano le app — **la plancia** (`#plancia`),
**l'app gdahome** (`#app`) e **gdanav** (`#gdanav`) — sono fatte di fotografie
vere e di schede di testo. Le fotografie stanno nella repository, dentro
`sito/`, e ci sono sempre. `casa-in-pagina.js` e `statico/casa.js` restano
perché lo script li infila ancora nella plancia che porta (vedi «Quello che non
si ribatte a mano»), e perché è con loro che si fotografa la plancia.

Le fotografie della plancia sono **della plancia vera**, configurata: le fa
`collaudo/fotografa-la-plancia.mjs`, che apre la plancia portata nel sito con
la casa demo del collaudo, prende ogni pagina dalla sua linguetta e la scrive
in `docs/immagini/plancia-*.jpg`. Da lì `porta-nel-sito.mjs` copia in
`statico/schermate/` quelle che la pagina chiama. Nelle fotografie mancano due
cose sole, e nessuna è la plancia: il riquadro «La dashboard è quasi pronta»,
che dentro la pagina compare anche su una casa configurata, e il tasto tondo
dell'assistente, che copre la scheda sotto. L'Energia si fotografa
sull'istante — fotovoltaico, rete, batteria, casa e carichi — perché le viste
del giorno e del mese vogliono lo storico, che la Home Assistant dentro la
pagina non ha.

## Un sito di prodotto, come quelli delle app

Il sito è fatto come i siti delle app che si conoscono: la plancia vera in
copertina, sul computer e sul telefono, appoggiata a un palco col blu di
gdahome; il blu anche sulle schede Premium; le sezioni che si alternano fra
bianco e un azzurrino, così lo scorrimento ha un ritmo, e gdanav al buio,
come lo schermo di un'auto; le schermate vere dentro telefoni, tablet e
orologi disegnati, con un'ombra che le stacca dalla pagina; tasti e schede
arrotondati, aria intorno. Prima c'era quello che hanno tutti i siti disegnati
da un modello — il fondo a macchie di luce, il telefono che galleggia su una
sfumatura, i quattro numeroni, le tre schede uguali con icona, titolo e testo —
e si vedeva che era un modello. Le scelte che tengono in piedi la pagina, e
che si possono disfare per distrazione:

**Colore pieno, mai sfumato.** Il blu è un campo piatto, l'azzurrino è un
campo piatto. Niente sfumature, niente vetro sfocato, niente aloni: sono il
vestito di mille siti usciti uguali nello stesso anno.

**Un'ombra sola, come la fa la luce.** Morbida e spostata in basso, la stessa
su tutte le schede; più forte sotto i telefoni, perché sono oggetti. Un bagliore
colorato intorno a una cosa non è un'ombra.

**Una cosa accesa alla volta.** L'ambra è il colore di una luce accesa: la
voce del menu della sezione in cui si legge, la spia sotto il telefono della
copertina, il segno «primi 14 giorni gratis» su Premium. Non fa altro.

**Niente occhielli e niente schede in fila.** Sopra i titoli non c'è la riga
piccola in maiuscolo che dice la sezione, e i passi non sono tre scatole
uguali col numero, il titolo e due righe: stanno sotto una riga sottile, come
le schede tecniche, e quelli per averla sono un elenco che si legge in ordine.
È un vincolo dichiarato (`PRODUCT.md`), e il primo che si rompe per abitudine.

**I caratteri.** Archivo, in `caratteri/` (licenza OFL, nel file accanto),
servito da qui; Oswald, il carattere dei numeri della plancia, resta per i
prezzi e i numeri dei passi. Tutti e due dal sito, mai da Google.

**Niente tema scuro.** C'era, e seguiva quello del sistema. Chi apriva
gdahome.org con un telefono in tema scuro si trovava una pagina quasi nera —
cioè una pagina diversa da quella che gli era stata mostrata. Una copertina
si presenta sempre allo stesso modo. Dentro l'app il chiaro e scuro c'è, e lì
ha senso. La sezione di gdanav è scura per tutti: è una sezione, non un tema.

**Le schermate vere, in cima.** Sono `docs/immagini/`, le stesse del README e
del negozio: fotografie dell'app, non dei mockup disegnati. La copertina
mostra la **plancia sul computer** e le **luci sul telefono**: prima mostrava
solo le luci, perché l'unica fotografia della plancia era di una casa non
ancora configurata, col riquadro «La dashboard è quasi pronta». Adesso la
plancia si fotografa configurata (vedi sopra).

**Le fotografie scorrono di lato, la pagina no.** Le pagine della plancia e le
schermate di gdanav stanno in un nastro che scorre dentro di sé, col dito o
con le due frecce; la pagina resta larga quanto lo schermo.

## Per chi installa, e dove scrivere

Il **cruscotto installatore** ha una sezione sua (`#installatori`), perché è
l'unico pezzo di gdahome che non è per chi abita la casa: come sta ogni casa,
le licenze Premium da dare ai clienti, e accanto cosa **non** vede, con le
parole del quadro (`quadro/README.md`). Lo racconta a parole, senza
fotografie: il sito fa vedere la plancia e il navigatore, non i pannelli di chi
li gestisce — né quello degli installatori, né quello di chi vende, né la
scheda dell'add-on. **Quanto costa** (`#prezzi`) dice Base
e Premium, come si ha Premium e gdanav, coi prezzi e le regole di
[`docs/LICENZE.md`](../docs/LICENZE.md).

E c'è un posto dove **scrivere** (`#contatti`): un modulo con nome, email e
messaggio, che arriva per posta a `domotica@crvgroup.it`. È l'unica cosa
della pagina che non è un file. Manda un `POST /contatto`, che Caddy passa al
tramite sulla stessa macchina, e il tramite lo consegna al server di posta
della casella che risponde (`centralino/src/posta.js`, e il perché sta lì).
Senza JavaScript funziona lo stesso: il modulo è un modulo, e il tramite
risponde con una pagina nella lingua che si stava leggendo. Con JavaScript
l'esito compare sotto il tasto, e la pagina resta dov'è.

Se il tramite non ha un server di posta, il modulo non fa finta: dice che non è
attivo e a chi scrivere. Le impostazioni le chiede `centralino/accendi.sh`
(`POSTA_SERVER`, `POSTA_UTENTE`, …), e `/salute` del tramite porta
`posta: true` quando è acceso.

## Come si guarda

La pagina è fatta di file fermi, e tutti quelli che usa stanno in `sito/`:

```bash
cd sito && python3 -m http.server 8099
```

Poi `http://127.0.0.1:8099/`.

## I file

|                                   |                                                                                                                                                                                           |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.html`                      | la pagina: la copertina con la plancia, la plancia, come funziona, l'app gdahome, gdanav, quanto costa, per chi installa, scaricala, contatti                                             |
| `privacy.html`                    | l'informativa — la gemella di `docs/PRIVACY.md`, ed è l'indirizzo che il Play Store tiene da parte                                                                                        |
| `stile.css`                       | il vestito: i colori, i caratteri, il palco della copertina, telefoni, tablet e orologi, i nastri delle fotografie, le schede tecniche, i piani                                           |
| `privacy.css`                     | l'unica cosa che nell'informativa è diversa: una colonna stretta, da leggere                                                                                                              |
| `casa-in-pagina.js`               | la Home Assistant finta dentro la pagina: la pagina non la usa, la usa la plancia portata nel sito per farsi fotografare                                                                  |
| `sito.js`                         | la lingua, l'ombra sotto la barra, la cosa accesa, le frecce dei nastri, il modulo dei contatti — lo caricano tutte e due le pagine                                                       |
| `statico/`                        | marchio, icone, caratteri, casa demo e le schermate della plancia (da `docs/immagini/`) — **non si toccano a mano**, sono salvati nella repository                                        |
| `statico/app/`, `statico/gdanav/` | le fotografie delle due app, ridotte in JPG dalle schermate dei README (quelle di gdanav vengono da `danigio15/gdanav`, `docs/immagini/`) — **si fanno a mano**, e lo script non le tocca |
| `dashboardmodern_static/`         | la plancia vera — fuori da git; la pagina non la usa, la vogliono lo scambio sul server e le fotografie della plancia                                                                     |
| `gdahome.png`                     | il marchio dell'informativa                                                                                                                                                               |
| `robots.txt`, `sitemap.xml`       | si può guardare tutto, e le pagine sono due                                                                                                                                               |

## Quello che non si ribatte a mano

Il marchio, le icone, il carattere Oswald, le schermate della plancia (solo
quelle che le pagine usano, da `docs/immagini/`), la casa demo e la plancia
intera: li porta uno script, dalle cartelle dove stanno per davvero.

```bash
node strumenti/porta-nel-sito.mjs
```

Rifà `statico/oggetti/`, `statico/font/` (solo Oswald) e `statico/schermate/`
(le fotografie di `docs/immagini/` che le pagine chiamano), e basta:
`statico/app/`, `statico/gdanav/` e `caratteri/` sono fatte a mano e restano
come sono. Prima
lo script buttava via tutta `statico/`, e sul server — dove gira prima di ogni
scambio — le fotografie delle app sarebbero sparite a ogni versione.

Le fotografie della plancia in `docs/immagini/plancia-*.jpg` si rifanno con la
plancia vera, quando la plancia cambia aspetto:

```bash
node strumenti/porta-nel-sito.mjs        # la plancia e la casa demo nel sito
node collaudo/fotografa-la-plancia.mjs   # le fotografie, in docs/immagini/
node strumenti/porta-nel-sito.mjs        # e di nuovo, per copiarle in statico/
```

E rifà il **segno** con cui le pagine chiamano `stile.css`, `privacy.css` e
`sito.js`: il `?v=` dopo il nome, che è l'impronta del file. Il server fa
rivedere le pagine a ogni visita, ma lo stile e il codice no, e il browser se li
tiene quanto vuole: il 17 ottobre 2026 il sito rifatto è arrivato a chi l'aveva
appena aperto vestito con lo stile di prima — le fotografie a tutta pagina, le
didascalie in mezzo — e nessun errore da nessuna parte. Col segno, un file
cambiato è un indirizzo nuovo, e il browser lo deve chiedere. Chi tocca uno di
quei tre file rilancia lo script; se se ne dimentica, non passa
[`centralino/test/sito.test.js`](../centralino/test/sito.test.js).

La plancia (`dashboardmodern_static/`) la porta ancora, anche se la pagina non
la mostra più: lo scambio sul server (`prepara.sh`, che nasce da
`centralino/accendi.sh`) porta il sito **solo** se dopo lo script c'è
`dashboardmodern_static/legacy/dashboard.html`. Finché quella regola resta,
la plancia si porta; è fuori da git e non pesa sulla repository.

## Dove si pubblica

Su **gdahome.org**, e non c'è nessun posto nuovo dove pubblicarlo: è la stessa
macchina del tramite, lo stesso Caddy, lo stesso giro con cui si aggiorna tutto
il resto.

Il bottone è **uno solo**, ed è quello di sempre: **Actions → «Il tramite» →
Run workflow**. Sposta un segno, e da lì in poi non tocca a noi — la macchina
se ne accorge entro dieci minuti, si scarica quella versione, la prova, e solo
se le prove passano scambia. Nessuna chiave da nessuna parte, nessuna porta
nuova aperta.

### Cosa succede sulla macchina

`prepara.sh` (che nasce da [`centralino/accendi.sh`](../centralino/accendi.sh))
scarica il pacchetto della versione e, prima di copiare `sito/`, lancia la
stessa `node strumenti/porta-nel-sito.mjs` che si lancia qui.

Se non ci riesce, **il sito non si scambia**: resta quello di prima, intero.
Attenzione: `prepara.sh` si scrive sulla macchina quando si lancia
`accendi.sh`, e non si aggiorna da solo con le versioni. Se il sito pubblicato
resta indietro, o gli mancano dei file, la prima cosa da guardare è quale
`prepara.sh` c'è sulla macchina. Il resto
dell'aggiornamento va avanti lo stesso, perché il tramite è un servizio e il
sito è una pagina, e non si tiene fermo il primo per la seconda.

Davanti c'è Caddy, che si prende il certificato da solo e serve la cartella
così com'è. Nel suo blocco ci sono quattro cose e basta:

- **niente `try_files`** — una pagina che non esiste deve dire che non esiste,
  non far finta di essere l'indice;
- **due velocità di cache** — `statico/` un giorno, perché
  cambiano solo quando cambia la versione; le pagine no, perché un testo
  corretto che resta in cache è un testo corretto che nessuno legge. Lo stile e
  il codice non hanno una regola loro, e per questo portano il segno (sopra);
- **`www` è un redirect vero**, non un secondo sito;
- **`/contatto` va al tramite** — l'unica via del sito che non è un file: il
  modulo dei contatti, che il tramite spedisce per posta.

### E prima di spostare il segno

C'è l'altro bottone, **Actions → «Il sito»**, che non pubblica niente: apre il
sito con un browser vero e guarda che le fotografie delle app arrivino tutte.
Parte da sé a ogni
modifica di `sito/` o di `ponte/plancia/`. È il controllo che una pagina ferma
non può farsi da sola — se non trovasse i suoi file non ci sarebbe nessun
errore da nessuna parte, ci sarebbe una pagina bianca.

E le prove che la **macchina** rigira da sé prima di scambiare
([`centralino/test/sito.test.js`](../centralino/test/sito.test.js)) tengono le
due promesse che si rompono per distrazione: che la pagina non tiri su niente
da fuori — nessun carattere scaricato, nessuna libreria, nessun contatore — e
che l'informativa pubblicata dica quello che dice `docs/PRIVACY.md`, sezione
per sezione e con la stessa data. E guardano che **ogni file che le pagine
chiamano stia dentro `sito/`**, salvato in git e scritto con le stesse
maiuscole: un'immagine che punta fuori da `sito/` si vede aprendo la pagina
dalla repository, e sul server è un buco. E che lo stile e il codice siano
chiamati col segno di come sono adesso.

## Come si prova

Con un browser vero, come tutto il resto del collaudo:

```bash
cd collaudo && npm install && cd ..
node collaudo/guarda-il-sito.mjs
```

Apre il sito a tre larghezze — telefono, tablet, computer — e guarda, in
ordine di quanto fa male sbagliarlo:

1. **le fotografie arrivano**: si scorre tutta la pagina (le immagini sono
   caricate quando ci si arriva), quelle dei nastri si chiedono subito — di
   lato il browser le chiede solo quando ci si arriva col dito — e si chiede
   al browser se in ogni immagine ci sono davvero dei pixel, perché
   un'immagine che non arriva lascia un buco e non fa nessun rumore;
2. **la plancia, l'app e gdanav** hanno la loro sezione, la loro voce nel menu
   e le loro fotografie; nella pagina non c'è più nessun riquadro;
3. **niente errori** in console e nessun file che non arriva;
4. **niente scorrimento di lato** a nessuna larghezza, e il menu del telefono
   si apre e si richiude;
5. **la lingua si cambia** coi due tasti, anche nelle sezioni nuove, e si torna
   all'italiano;
6. **i link portano dove dicono**, e il modulo dei contatti manda al tramite;
7. **la copertina resta chiara** anche a chi preferisce il tema scuro;
8. **l'informativa è vestita come il sito**: i caratteri giusti, il fondo
   giusto, una colonna da leggere e i collegamenti che si distinguono dal
   testo.

Le fotografie finiscono in `collaudo/foto/sito-*.png`.

Se la pagina non trovasse i suoi file non ci sarebbe nessun errore da nessuna
parte: ci sarebbe una pagina bianca. Per questo si guarda con un browser vero.
