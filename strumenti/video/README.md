# I video e le copertine di gdahome

Quattro filmati e tre immagini ferme, **ognuno in italiano e in inglese**,
fatti dalla stessa pagina web e dalla stessa cartella:

| film | misura | dura | a cosa serve |
|---|---|---|---|
| `gdahome-presentazione` | 1280×720 | 2:49 | quello che spiega: cos'è, come si installa l'add-on, come si abbina il telefono, quanto costa (niente) |
| `gdahome-facebook` | 1080×1080 | 0:47 | il quadrato per il feed di Facebook |
| `gdahome-tiktok` | 1080×1920 | 0:47 | lo stesso, in piedi, per TikTok — e per Reels e Storie |
| `gdahome-quadro` | 1280×720 | 2:10 | **il quadro**: cosa vede chi ha montato l'impianto quando gli si danno in gestione le case, e cosa da lì non vede |

I primi tre parlano a chi abita una casa. Il quarto parla a chi ne segue
quaranta, e per questo dice due cose che negli altri non ci sono: cosa si legge
dal quadro, e **cosa da lì non si può leggere**. La seconda metà non è un di
più — è quella che decide se questo pezzo si può dare in mano a qualcuno — e
sta nel film per intero: `quadro/README.md`, «Cosa il quadro non può fare».

| immagine | misura | dove va |
|---|---|---|
| `gdahome-copertina-gruppo.png` | 1640×856 | la copertina di un **gruppo** di Facebook |
| `gdahome-copertina-pagina.png` | 1640×624 | la copertina di una **pagina** di Facebook |
| `gdahome-profilo.png` | 1080×1080 | l'immagine del profilo della pagina, che Facebook ritaglia tonda |

**Le due lingue.** Ogni file esiste due volte: l'italiano si chiama come è
sempre stato — `gdahome-tiktok.mp4` — e l'inglese ha `-en` in fondo,
`gdahome-tiktok-en.mp4`. Non sono due film diversi: è lo stesso, con le parole
che cambiano. La traduzione sta accanto alla frase, in `t("…", "…")`, come nella
plancia. L'immagine del profilo è una sola: dentro c'è il marchio e basta.

Anche **la plancia dentro gli schermi** segue la lingua: le copertine inglesi
montano le fotografie di `plancia-*-en.png`, che escono dalla pagina inglese
della plancia vera con una casa finta che ha le entità in inglese. Due cose
restano in italiano anche lì, e non dipendono da qui: la parola del meteo
(«SOLEGGIATO») e la pastiglia «ANTIFURTO · CASA» sono scritte così dentro
DashboardModern, che in inglese non le traduce.

**La console del quadro invece resta in italiano anche nel film inglese**, e
non è una dimenticanza: quella pagina è scritta in italiano e basta — sta
scritto nel suo programma, «questa pagina è in italiano, non nella lingua del
browser». Tradurre le fotografie vorrebbe dire far vedere un quadro che non
esiste. Le parole del film cambiano, gli schermi no; il giorno che la console
parla due lingue, si scattano le fotografie anche nell'altra e questa riga si
cancella.

I filmati escono in **mp4** (H.264, con una traccia audio muta nei due corti) se
sulla macchina c'è un ffmpeg vero; se c'è solo quello di Playwright escono in
webm, e la ripresa lo dice. Per i negozi dei video serve l'mp4: TikTok un webm
non lo prende.

![L'apertura del video lungo](gdahome-presentazione-copertina.png)

## Rifarli

```
node strumenti/video/rendi.mjs                 i quattro filmati, nelle due lingue
node strumenti/video/rendi.mjs --film tiktok   uno solo (due lingue)
node strumenti/video/rendi.mjs --lingua en     solo l'inglese
node strumenti/video/rendi.mjs --copertine     le immagini ferme di Facebook
```

Le fotografie della plancia vera si rifanno a parte, una lingua per volta —
aprono la plancia e aspettano che si configuri da sola:

```
node strumenti/video/plancia-vera.mjs
node strumenti/video/plancia-vera.mjs --lingua en
```

E quelle della console del quadro, che invece è una sola lingua e non ha
bisogno di essere detto due volte — accende un quadro vero, gli fa depositare
una flotta inventata e lo fotografa:

```
node strumenti/video/quadro-vero.mjs
```

Venti minuti circa per tutti e otto i filmati. Serve **Playwright** (`npm i -g playwright`,
oppure installato di fianco al progetto) e, per l'mp4, **ffmpeg**
(`apt install ffmpeg`). Nient'altro.

Mentre si lavora a una scena conviene non rifare tutto:

```
node strumenti/video/rendi.mjs --film tiktok --scena il-gancio   una scena, in provini/
node strumenti/video/rendi.mjs --foto il-gancio@3.2              una fotografia
node strumenti/video/rendi.mjs --foto "a@1,b@2.5"                più d'una
```

I nomi delle scene sono quelli che passa `scena(...)`, e la ripresa li stampa
mentre va.

## Com'è fatto

| file | cosa fa |
|---|---|
| `comune.css` | quello che i quattro film hanno in comune: caratteri, colori, il fondo del palco, le animazioni, il telefono, le schede |
| `pezzi.js` | i pezzi condivisi: il marchio, i disegnini, il telefono, **la plancia**, e il palco che chi filma va a cercare |
| `presentazione.html` + `scene.js` | il film lungo: quindici scene, disposte a coordinate |
| `social.html` + `social.js` | il film corto: sette scene, disposte **a colonna** |
| `quadro.html` + `quadro.js` | il film del quadro: quattordici scene, con dentro le fotografie della console vera |
| `copertine.html` + `copertine.js` | le copertine di Facebook e l'immagine del profilo, ferme |
| `plancia-vera.mjs` + `casa-finta.js` | fotografano **la plancia vera**, quella di `ponte/plancia/` |
| `quadro-vero.mjs` + `flotta-finta.js` | fotografano **il quadro vero**, quello di `quadro/console/` |
| `quadro-elenco.png`, `-controlli`, `-come-sta`, `-dispositivi`, `-aggiornamenti`, `-abbina` | le sei fotografie della console, che finiscono negli schermi del quarto film |
| `plancia-telefono.png`, `-tablet`, `-computer` (e `-en`) | le fotografie, che finiscono negli schermi delle copertine |
| `rendi.mjs` | chi filma: apre la pagina, sposta l'orologio, scatta, e passa gli scatti a ffmpeg |
| `qrcode.svg` | il QR code che si vede nel film lungo — lo rifà `rendi.mjs` a ogni ripresa |
| `provini/` | le fotografie di `--foto` e i filmati di `--scena`; non sta nella repository |

**Il tempo non passa: glielo si dice.** Le animazioni della pagina stanno ferme
(`animation-play-state: paused`), e per ogni fotogramma chi filma porta
l'orologio di tutte al momento che gli serve e scatta. Una registrazione dal
vivo dipenderebbe da quanto è carico il computer, e due riprese darebbero due
file diversi; così sono venticinque fotogrammi al secondo esatti, sempre gli
stessi. Finita l'ultima animazione di una scena, chi filma se ne accorge e
rimanda l'ultimo scatto invece di rifarlo — è il motivo per cui una scena ferma
per sei secondi non costa sei secondi di ripresa.

Due regole per chi ci mette mano, e sono scritte anche in cima ai documenti:

* **niente animazioni infinite** — un puntino che pulsa per sempre toglie quella
  scorciatoia e triplica il tempo di ripresa;
* **quello che compare dopo parte nascosto**, con `opacity: 0` nel foglio di
  stile e l'animazione in `forwards`: è il solo modo perché due animazioni sulla
  stessa proprietà — una che mostra, una che nasconde più tardi — non si pestino
  i piedi.

### Un film solo per due negozi

Facebook e TikTok ricevono **lo stesso film**: cambia quanto è alto il palco e
quanta aria si lascia sopra e sotto, e a dirlo è l'indirizzo della pagina —
`social.html?alto=1920&su=210&giu=390&zoom=1.15`. Le misure stanno in `rendi.mjs`,
in cima, una riga per film.

L'aria sotto non è un gusto: su TikTok lì ci stanno il testo, i tasti e il nome
di chi pubblica, e quello che ci finisce sotto non lo legge nessuno. Per questo
le scene del film corto non sono disposte a coordinate come quelle del film
lungo, ma **a colonna**: si mettono in fila e si dispongono da sole con lo
spazio che trovano, che in un quadrato e in un palco in piedi è diverso.

### Il film del quadro, e perché gli schermi sono veri

Negli altri tre film la plancia è **ricostruita** (`pezzi.js`), e c'è una
ragione: lì si muove — una luce che si accende al tocco — e una fotografia non
si tocca. Nel film del quadro invece non si muove niente dentro gli schermi, e
allora vale la regola delle copertine: **si fotografa la cosa vera**.

Le sei fotografie escono da `quadro-vero.mjs` (qui sotto), e sono la pagina di
`quadro/console/` — quella che un installatore apre davvero. Un cruscotto
ridisegnato a mano si sarebbe staccato dal vero al primo cambiamento, e nessuno
se ne sarebbe accorto: un film è l'unico posto del progetto dove un difetto non
si vede finché non lo guarda qualcuno da fuori.

Due mosse sole, e tornano in tutte le scene che hanno uno schermo dentro:

- **lo schermo intero**, dentro la cornice del computer di `pezzi.js`. Dice una
  cosa e una sola — «è un cruscotto vero, e sono quindici case» — e non si
  pretende che si legga;
- **il ritaglio**, cioè un pezzo di quella stessa fotografia guardato da
  vicino, che arriva quando lo schermo se ne va. È lì che si legge: una riga
  dell'elenco, i due metri della macchina, la riga di un aggiornamento col suo
  tasto.

I due stanno nello stesso posto e si danno il cambio — `.corpo.sovrapposti` nel
documento — perché messi in fila si rimpicciolirebbero a vicenda. A separarli è
il tempo, non lo spazio: il primo se ne va (`via`) un attimo prima che arrivi il
secondo, e chi guarda ha appena visto dove sta il pezzo che gli si sta
ingrandendo davanti.

Le coordinate dei ritagli sono quelle **della fotografia** — 1440 punti di
larghezza, la misura dello schermo che l'ha scattata — e non quelle del palco:
se un giorno la console sposta una scheda, si sposta un numero qui e non si
rifà il conto di niente.

### Le copertine: i tre schermi, con la plancia vera

Le due copertine sono ferme — nessuna animazione — e dicono una cosa sola: **la
stessa casa su tutti e tre gli schermi**. Chi vede gdahome per la prima volta
pensa a un'app da telefono, e il computer non se lo immagina; scriverglielo non
basta.

Dentro ai tre schermi non c'è un disegno somigliante: c'è **la plancia vera**,
fotografata da `plancia-vera.mjs` (qui sotto) alle misure vere di un telefono,
di un tablet e di un computer, e poi guardata da lontano. Le cornici hanno le
proporzioni delle fotografie e non le proprie: una fotografia dentro una
cornice di un'altra forma o si stira o si taglia, e tagliare vuol dire perdere
la barra in fondo — che è metà di quello che fa vedere che è un'app.

E sono **due** copertine perché Facebook le taglia in due modi diversi:

- **il gruppo** (1640×856): sul telefono la striscia si accorcia, e in fondo ci
  finisce sopra il nome del gruppo. Per questo le parole stanno in alto e gli
  schermi sotto, dove al massimo si perde un pezzo di cornice.
- **la pagina** (1640×624): sul telefono se ne vede solo la **parte in mezzo**,
  due terzi scarsi della larghezza — da 279 a 1361 — e in basso a sinistra, sul
  computer, ci finisce sopra la foto del profilo. Per questo è tutto in mezzo, e
  gli schermi cominciano più a destra di dove arriva quella foto.

Come si controlla, invece di sperarci — si ritaglia quello che vedrebbe il
telefono e si guarda se manca qualcosa:

```
ffmpeg -i gdahome-copertina-pagina.png -vf "crop=1082:624:279:0" prova.png
```

Sono **png** e non jpg apposta: sono quasi tutte testo e linee nette, e il jpg
lì sporca i bordi delle lettere.

## La plancia vera, fotografata

```
node strumenti/video/plancia-vera.mjs
```

Tre minuti, e ne escono `plancia-telefono.png`, `plancia-tablet.png`,
`plancia-computer.png`. Non sono ricostruzioni: è la pagina di DashboardModern
che sta in `ponte/plancia/` — quella che l'add-on serve davvero — aperta in un
Chromium e fotografata.

**Come fa a girare senza una casa.** La plancia ospitata non apre un WebSocket
verso Home Assistant: apre quello che le dà chi la ospita
(`window.__DASHBOARDMODERN_BRIDGE_WS__`). È così che le fa da casa l'app
(`app/lib/plancia/`) e che le fa da casa il ponte dentro Home Assistant
(`ponte/src/cucitura.js`). `casa-finta.js` è la terza: una casa che sta tutta
dentro il browser, con una trentina di entità inventate, e che risponde come
risponderebbe Home Assistant.

La pagina si serve **come la serve il ponte** — `conLePremesse()` e
`vestiDiGdahome()`, il suo codice, non una copia — cambiando una cosa sola: al
posto del WebSocket verso la casa ci va la casa finta. Per questo quello che si
fotografa è la plancia come la vede chi ce l'ha installata: stesso logo, stesso
velo d'avvio, stesso nome.

**E si configura da sola.** Appena installata la plancia è vuota e lo dice: «La
dashboard è quasi pronta». Chi la installa preme il 🪄 nella Config, che guarda
le entità della casa e le mette nei posti giusti. Qui lo si preme per conto suo
— si apre l'editor dal tasto che la plancia stessa mette in mezzo alla pagina,
si chiama `edAutoRileva`, si applica — e quello che si fotografa è una plancia
configurata **come la configurerebbe lei**, non una configurazione scritta da
noi per far bella figura nella fotografia. L'unica cosa messa a mano è il nome
in cima (`cd_branding`): di suo DashboardModern si chiama «Smart Home», e in
una copertina di gdahome il nome di un altro è la prima cosa che si legge.

**Due cose il 🪄 non le trova**, e si mettono a mano perché senza in copertina
si vede un buco:

- **il meteo**. I suoi posti — `dm.home_meteo` e i tre numeri accanto —
  vogliono un'entità `weather.` e i sensori di fuori, e il rilevatore su quelli
  non si sbilancia. Nella plancia vera li collega chi la configura, in un
  minuto; qui si scrivono nella busta della casa finta, che è lo stesso posto.
  Senza, accanto al nome della casa resta una striscia vuota — ed è metà
  dell'intestazione.
- **i ritratti delle persone**. Un ritratto non si rileva: è una fila di
  scelte — taglio, colori, occhi, barba — che fa chi configura, una persona per
  volta. Qui ce ne sono tre in `cd_people`; a disegnarle è il compositore della
  plancia, quello vero.

E si parte da quello che la plancia ha **adesso**, non dalla busta: i posti che
il 🪄 ha appena riempito stanno lì. Partendo dalla busta si riscriveva sopra al
suo lavoro, e nella fotografia sparivano la sicurezza e l'antifurto.

**La plancia si monta dove la monta il ponte** — `/dashboardmodern_static/`, con
i file sotto un'impronta e `avatars/` e `brands/` fuori (`ponte/src/plancia.js`).
Non è un dettaglio di gusto: il compositore chiede le figure due cartelle più su
della pagina, e servita da un'altra profondità le chiedeva a un indirizzo che non
esiste — gli avatar uscivano come cerchi vuoti.

Prima di scattare si ferma quello che si muove: la striscia in cima alla
plancia scorre da sola, e una striscia ferma a metà corsa in una fotografia
sembra un pezzo tagliato via.

Le entità sono **inventate** e si vedono solo nelle immagini. `casa-finta.js`
non è un pezzo del prodotto e non deve diventarlo.

## Il quadro vero, fotografato

```
node strumenti/video/quadro-vero.mjs
```

Un minuto, e ne escono sei fotografie: `quadro-elenco.png`,
`quadro-controlli.png`, `quadro-come-sta.png`, `quadro-dispositivi.png`,
`quadro-aggiornamenti.png`, `quadro-abbina.png`. Sono 1440×900 — le
proporzioni della cornice del computer di `pezzi.js` — e scattate al doppio,
così un ritaglio si può guardare da vicino senza che si sgrani.

**Come fa a girare senza installatori e senza case.** Lo script è il quadro:
lo accende lui (`alzaIlQuadro`, porta a caso, archivi in una cartella
temporanea), iscrive un installatore dalla via della gestione, e poi fa entrare
quindici case **come entrano quelle vere** — un codice di abbinamento a testa,
e un `POST /rapporto` con quel codice e la matricola in testa. Il quadro non sa
che sono finte, e infatti le giudica lui: gli stati, i controlli e le pastiglie
delle fotografie non sono scritti da nessuna parte qui dentro.

La flotta sta in `flotta-finta.js`: quindici impianti, **una muta, tre da
guardare, undici a posto**. È la proporzione di una giornata normale, ed è una
scelta — se fossero metà rosse la fotografia racconterebbe un installatore che
ha sbagliato mestiere, e se fossero tutte verdi non si capirebbe a cosa serve
il quadro. I numeri sono quelli che il rapporto manda davvero
(`ponte/src/rapporto.js`), con i nomi che hanno là dentro; i nomi delle case
sono inventati, perché quelli veri sono clienti di qualcuno.

**Una cosa sola si scrive da dietro, ed è il passato:** da quanti giorni una
casa è installata e quanti rapporti ha mandato ogni giorno. Non c'è altro modo
— per averlo davvero ci vorrebbero quattordici giorni — e senza, la striscia
dei quattordici giorni sarebbe vuota in tutte e quindici le case. Si scrive sui
dati del quadro e non attraverso una sua via, perché una via per riscrivere il
passato non esiste e non deve esistere: lì si può perché quel quadro l'ha
acceso questo script, e la cartella è sua.

Le entità, i nomi e gli indirizzi sono **inventati** e si vedono solo nelle
immagini. `flotta-finta.js` non è un pezzo del prodotto e non deve diventarlo.

## Quello che si vede è roba di qui dentro

Il marchio è `app/assets/marchio/gda.png`, quello dell'icona dell'app. I
caratteri sono gli Inter di `app/assets/carattere/`, gli stessi dell'app. I
disegni delle tessere sono gli SVG di `app/assets/oggetti/`, gli stessi della
plancia. I colori sono quelli di `app/lib/vestito/tema.dart`. E la plancia che
si vede nel telefono è **una sola**, in `pezzi.js`: tre film che disegnano tre
plance leggermente diverse sarebbero tre prodotti.

**La plancia è vera** — vedi qui sopra — e **il QR code è vero**: lo disegna
`ponte/src/qr.js`, l'encoder dell'add-on, e non un quadrato finto messo lì per
somiglianza. Quello che ci sta scritto invece
è finto e lo dice: chi lo inquadra si trova in mano
`gdahome://codice-finto-del-video/non-abbina-niente`, non un abbinamento.

Le finestre di Home Assistant e la pagina di Google Play sono invece
**ricostruite**, non catturate: servivano una casa vera e un'app pubblicata.
Nei tre filmati anche la plancia è ricostruita (`pezzi.js`), perché lì si
muove: una luce che si accende al tocco. Nelle copertine, dove nessuno si
muove, c'è quella vera.

**E il quadro è vero.** Negli schermi del quarto film non c'è niente di
disegnato: sono le fotografie di `quadro/console/index.html`, presa così com'è
e riempita di una flotta inventata. Gli stati delle case, i dieci controlli e
le pastiglie che si leggono lì dentro non li ha scritti questo film — li ha
calcolati `quadro/src/controlli.js`, che è lo stesso programma che li calcola
in casa di chi lo usa.

## Le date, e dove stanno scritte

I tre film dicono le stesse tre cose, e quando cambiano vanno cambiate in tutti
e tre:

- **da subito**: l'add-on, la plancia, e l'app dal browser;
- **dal 30 settembre**: l'app per Android, **su Google Play** — per ora l'unico negozio;
- **in fase di sviluppo**: la versione per iOS.

Nel film lungo stanno nella scena `dal-negozio-del-telefono` (la targhetta in
alto) e in `come-si-prova-oggi` (la pastiglia); nel film corto, nella scena
`da-quando`; nelle copertine, nella pastiglia gialla.

## Il suono

Non c'è, e non per dimenticanza: le parole stanno scritte sul filmato, ed è
anche il modo in cui lo guardano quasi tutti — un video di installazione si
guarda col telefono in silenzio, e uno sui social pure.

Nei due corti c'è però una traccia audio **muta**: un negozio che riceve un
video senza nessuna traccia ogni tanto lo rifiuta, e accorgersene mentre si
pubblica è la cosa peggiore.

Chi vuole leggere il parlato ha il copione in [`copione.md`](copione.md), scena
per scena, con i tempi. Registrata una traccia, si attacca senza rifare il
video:

```
ffmpeg -i gdahome-tiktok.mp4 -i voce.m4a -map 0:v -map 1:a \
       -c:v copy -c:a aac -shortest gdahome-tiktok-con-voce.mp4
```

## Cambiare le parole

Nel film lungo le didascalie stanno in `didascalia([...])`: ogni riga ha quando
entra (`t`) e quando esce (`t2`), in secondi dall'inizio della scena. Nel film
corto le parole sono la scena: si cambiano dove sono scritte.

Se si allunga una riga bisogna guardare che ci stia — e guardarlo **in tutti e
due i palchi**, perché quello che sta in una riga sul quadrato in piedi può
andare a capo.
