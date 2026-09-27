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
si ribatte a mano»), ma la pagina non li usa più.

## Una luce sola, e il prodotto in faccia

Due scelte che valgono più di tutto il resto, e che si possono disfare per
distrazione.

**Niente tema scuro.** C'era, e seguiva quello del sistema. Chi apriva
gdahome.org con un telefono in tema scuro si trovava una pagina quasi nera —
cioè una pagina diversa da quella che gli era stata mostrata — e le schermate
dell'app, che sono chiare, ci galleggiavano sopra come ritagli. Una copertina
si presenta sempre allo stesso modo. Dentro l'app il chiaro e scuro c'è, e lì
ha senso: quella si guarda di notte, in corridoio, con una mano sola.

**Le schermate vere, in cima.** Sono `docs/immagini/`, le stesse del README e
del negozio: fotografie dell'app, non dei mockup disegnati. Prima la copertina
raccontava l'app a parole e chiedeva di fidarsi; adesso la fa vedere nella
prima schermata. La fotografia di copertina è quella delle **luci** e non
quella della plancia: la seconda mostra una casa non ancora configurata, col
riquadro «La dashboard è quasi pronta», che è la schermata giusta per il
manuale e la peggiore possibile per una copertina.

## Per chi installa, e dove scrivere

Il **cruscotto installatore** ha una sezione sua (`#installatori`), perché è
l'unico pezzo di gdahome che non è per chi abita la casa: come sta ogni casa,
le licenze Premium da dare ai clienti, e accanto cosa **non** vede, con le
parole del quadro (`quadro/README.md`). **Quanto costa** (`#prezzi`) dice Base
e Premium, come si ha Premium e gdanav, coi prezzi e le regole di
[`docs/LICENZE.md`](../docs/LICENZE.md); il sostegno (`#sostieni`) sta a parte,
perché non sblocca niente.

E c'è un posto dove **scrivere** (`#contatti`): un modulo con nome, email e
messaggio, che arriva per posta a `assistenza@gdahome.org`. È l'unica cosa
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
| `index.html`                      | la pagina: il colpo d'occhio, la plancia, come funziona, l'app gdahome, gdanav, quanto costa, per chi installa, scaricala, sostegno, contatti                                             |
| `privacy.html`                    | l'informativa — la gemella di `docs/PRIVACY.md`, ed è l'indirizzo che il Play Store tiene da parte                                                                                        |
| `stile.css`                       | i colori (quelli di `app/lib/vestito/tema.dart`), i caratteri, il fondo vivo coi due aloni, le file di fotografie                                                                         |
| `privacy.css`                     | l'unica cosa che nell'informativa è diversa: una colonna stretta, da leggere                                                                                                              |
| `casa-in-pagina.js`               | la Home Assistant finta della plancia di prima: la pagina non la usa più                                                                                                                  |
| `sito.js`                         | la lingua, l'ombra sotto la barra, le schede che compaiono, il modulo dei contatti — lo caricano tutte e due le pagine                                                                    |
| `statico/`                        | marchio, icone, caratteri, casa demo e le schermate della plancia — **non si toccano a mano**, sono salvati nella repository                                                              |
| `statico/app/`, `statico/gdanav/` | le fotografie delle due app, ridotte in JPG dalle schermate dei README (quelle di gdanav vengono da `danigio15/gdanav`, `docs/immagini/`) — **si fanno a mano**, e lo script non le tocca |
| `dashboardmodern_static/`         | la plancia vera — fuori da git; la pagina non la usa più, la vuole lo scambio sul server                                                                                                  |
| `gdahome.png`                     | il marchio dell'informativa                                                                                                                                                               |
| `robots.txt`, `sitemap.xml`       | si può guardare tutto, e le pagine sono due                                                                                                                                               |

## Quello che non si ribatte a mano

Il marchio, le icone, i caratteri Inter e Oswald, le schermate della plancia
(solo quelle che le pagine usano, da `docs/immagini/`), la casa demo e la
plancia intera: li porta uno script, dalle cartelle dove stanno per davvero.

```bash
node strumenti/porta-nel-sito.mjs
```

Rifà `statico/oggetti/`, `statico/font/` e `statico/schermate/`, e basta:
`statico/app/` e `statico/gdanav/` sono fatte a mano e restano come sono. Prima
lo script buttava via tutta `statico/`, e sul server — dove gira prima di ogni
scambio — le fotografie delle app sarebbero sparite a ogni versione.

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
  corretto che resta in cache è un testo corretto che nessuno legge;
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
dalla repository, e sul server è un buco.

## Come si prova

Con un browser vero, come tutto il resto del collaudo:

```bash
cd collaudo && npm install && cd ..
node collaudo/guarda-il-sito.mjs
```

Apre il sito a tre larghezze — telefono, tablet, computer — e guarda, in
ordine di quanto fa male sbagliarlo:

1. **le fotografie arrivano**: si scorre tutta la pagina (le immagini sono
   caricate quando ci si arriva) e si chiede al browser se in ogni immagine ci
   sono davvero dei pixel, perché un'immagine che non arriva lascia un buco e
   non fa nessun rumore;
2. **la plancia, l'app e gdanav** hanno la loro sezione, la loro voce nel menu
   e le loro fotografie; nella pagina non c'è più nessun riquadro;
3. **niente errori** in console e nessun file che non arriva;
4. **niente scorrimento di lato** a nessuna larghezza, e il menu del telefono
   si apre e si richiude;
5. **la lingua si cambia** coi due tasti, anche nelle sezioni nuove, e si torna
   all'italiano;
6. **i link portano dove dicono**, il modulo dei contatti manda al tramite, il
   bottone delle donazioni è quello della plancia;
7. **la copertina resta chiara** anche a chi preferisce il tema scuro;
8. **l'informativa è vestita come il sito**: i caratteri giusti, il fondo
   giusto, una colonna da leggere e i collegamenti che si distinguono dal
   testo.

Le fotografie finiscono in `collaudo/foto/sito-*.png`.

Se la pagina non trovasse i suoi file non ci sarebbe nessun errore da nessuna
parte: ci sarebbe una pagina bianca. Per questo si guarda con un browser vero.
