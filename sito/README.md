# Il sito

Il posto dove il progetto si racconta a chi non l'ha mai visto: cos'è l'app,
come fa la casa a rispondere da fuori senza che si apra niente sul router, e
**la plancia vera che ci gira dentro**.

Sta su **[gdahome.org](https://gdahome.org)**.

## La plancia non è una riproduzione: è la plancia

È il pezzo per cui il sito esiste, ed è anche la cosa che il sito **non**
disegna. In un riquadro, nella pagina, gira **la plancia di gdahome**: gli stessi
file che stanno dentro l'add-on, `ponte/plancia/`, copiati byte per byte. Le
trenta voci della barra sono le sue, le tessere sono le sue, i ritratti 3D
delle persone sono i suoi.

C'era una versione precedente di questa pagina in cui la plancia era
ridisegnata a mano in duemila righe di HTML. Somigliava, e si vedeva che non
era lei — che è esattamente il motivo per cui un renderer parallelo era già
stato scartato:

> un renderer parallelo […] o viene identico, e allora riscriverlo non è
> servito a niente, o viene diverso, e l'utente lo riconosce come peggiore.

### Come fa a girare senza una casa

Una plancia vuole un Home Assistant dietro, e un sito statico non ce l'ha: non
può aprire un WebSocket verso casa, e non ci sarebbe nessuna casa a cui
aprirlo.

Ma la plancia ha **un gancio fatto apposta**. Il suo preludio
(`legacy/bridge-prelude.js`) guarda se qualcuno ha già messo un
`__DASHBOARDMODERN_BRIDGE_WS__` nella finestra, e se c'è usa quello invece del
WebSocket vero. È lo stesso gancio con cui l'app sul telefono le cuce addosso
il proprio filo: non è un WebSocket, è un oggetto finto messo nella pagina
insieme alle altre premesse.

Di qua dal gancio c'è `casa-in-pagina.js`: una Home Assistant finta che parla
il protocollo vero, con le stesse risposte di `collaudo/casa-finta.js` — la
Home Assistant finta contro cui girano le prove dal vivo. Quello che lì è un
server in Node, qui è un oggetto in pagina: cambia chi consegna le buste, non
cosa c'è dentro. Due comandi non sono di Home Assistant ma del **ponte** —
`dashboardmodern/config/get` e `config/set` — e sono risposti come li risponde
lui, regole comprese (i valori si sostituiscono, una scrittura vuota sopra una
plancia configurata si rifiuta, la revisione cresce e basta).

Dentro c'è la **casa demo del collaudo**: le stesse 235 entità di
`collaudo/casa-demo.json` contro cui girano le prove. Sette stanze, otto luci,
cinque termostati, un fotovoltaico con la batteria, sei elettrodomestici,
un'auto, una piscina.

### Quello che è finto, e il sito lo scrive

Dall'altra parte non c'è nessuna casa: gli stati stanno in una mappa nella
pagina. Premere un interruttore la cambia, e il cambiamento torna indietro
come tornerebbe da Home Assistant — quindi la plancia si muove per davvero —
ma non si accende niente da nessuna parte, e ricaricando la pagina torna tutto
com'era.

Le **due telecamere** sono l'unica cosa che non si può far vedere: la plancia
le chiede come immagini su `/api/camera_proxy/`, e un sito statico non ha un
Home Assistant che gliele dia. In casa quelle due richieste passano dal ponte e
tornano col fotogramma.

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

Due cose che il sito non diceva. Il **cruscotto installatore** ha una sezione
sua (`#installatori`), perché è l'unico pezzo di gdahome che si paga e l'unico
che non è per chi abita la casa: la prima cosa scritta è cosa **non** vede, con
le parole del quadro (`quadro/README.md`), e «Quanto costa» adesso dice che per
casa tua è gratis e che il cruscotto è a parte.

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

La plancia non sta nella repository due volte: `sito/dashboardmodern_static/`
è fuori da git e si fa con un comando.

```bash
node strumenti/porta-nel-sito.mjs
cd sito && python3 -m http.server 8099
```

Poi `http://127.0.0.1:8099/`. Un server ci vuole: un `iframe` su `file://` non
carica i moduli della plancia.

## I file

|                             |                                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `index.html`                | la pagina: il colpo d'occhio, le schermate, come funziona, la plancia, cosa fa, per chi installa, dove sta, quanto costa, contatti |
| `privacy.html`              | l'informativa — la gemella di `docs/PRIVACY.md`, ed è l'indirizzo che il Play Store tiene da parte                 |
| `stile.css`                 | i colori (quelli di `app/lib/vestito/tema.dart`), i caratteri, il fondo vivo coi due aloni, il telaio del riquadro |
| `privacy.css`               | l'unica cosa che nell'informativa è diversa: una colonna stretta, da leggere                                       |
| `casa-in-pagina.js`         | la Home Assistant finta che fa girare la plancia                                                                   |
| `sito.js`                   | la lingua, l'ombra sotto la barra, le schede che compaiono, il modulo dei contatti — lo caricano tutte e due le pagine |
| `statico/`                  | marchio, icone, caratteri, casa demo e **le schermate dell'app** — **non si tocca a mano**, è salvata nella repository |
| `dashboardmodern_static/`   | la plancia vera — **non si tocca a mano**, ed è fuori da git                                                       |
| `gdahome.png`               | il marchio dell'informativa                                                                                        |
| `robots.txt`, `sitemap.xml` | si può guardare tutto, e le pagine sono due                                                                        |

## Quello che non si ribatte a mano

Il marchio, le 47 icone, i caratteri Inter e Oswald, la casa demo, e la
plancia intera: li porta uno script, dalle cartelle dove stanno per davvero.

```bash
node strumenti/porta-nel-sito.mjs
```

Si rilancia quando cambia il marchio, un'icona, la casa demo, o quando arriva
una versione nuova della plancia. Quello che finisce in `statico/` è salvato
nella repository (seicento kilobyte); la plancia no, perché sono diciassette
megabyte identici a quelli che stanno già in `ponte/plancia/`.

Lo script **si ferma** se in `dashboard.html` non trova più il preludio dove
se lo aspetta: meglio fermarsi che pubblicare una plancia che resta sul velo
d'avvio.

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

`scarica.sh` (che nasce da [`centralino/accendi.sh`](../centralino/accendi.sh))
scarica il pacchetto della versione e, prima di copiare `sito/`, **rifà la
plancia**: la stessa `node strumenti/porta-nel-sito.mjs` che si lancia qui, con
dentro la `ponte/plancia/` di quella versione. Nel pacchetto la plancia dentro
il sito non c'è — è fuori da git apposta, per non averne due copie — e quindi
va rimessa lì dove la pagina la va a cercare.

Se non ci riesce, **il sito non si scambia**: resta quello di prima, intero,
invece di diventare una pagina col buco al posto della plancia. Il resto
dell'aggiornamento va avanti lo stesso, perché il tramite è un servizio e il
sito è una pagina, e non si tiene fermo il primo per la seconda.

Davanti c'è Caddy, che si prende il certificato da solo e serve la cartella
così com'è. Nel suo blocco ci sono quattro cose e basta:

- **niente `try_files`** — una pagina che non esiste deve dire che non esiste,
  non far finta di essere l'indice;
- **due velocità di cache** — la plancia e `statico/` un giorno, perché
  cambiano solo quando cambia la versione; le pagine no, perché un testo
  corretto che resta in cache è un testo corretto che nessuno legge;
- **`www` è un redirect vero**, non un secondo sito;
- **`/contatto` va al tramite** — l'unica via del sito che non è un file: il
  modulo dei contatti, che il tramite spedisce per posta.

### E prima di spostare il segno

C'è l'altro bottone, **Actions → «Il sito»**, che non pubblica niente: apre il
sito con un browser vero e guarda che la plancia parta. Parte da sé a ogni
modifica di `sito/` o di `ponte/plancia/`. È il controllo che una pagina ferma
non può farsi da sola — se non trovasse i suoi file non ci sarebbe nessun
errore da nessuna parte, ci sarebbe una pagina bianca.

E le prove che la **macchina** rigira da sé prima di scambiare
([`centralino/test/sito.test.js`](../centralino/test/sito.test.js)) tengono le
due promesse che si rompono per distrazione: che la pagina non tiri su niente
da fuori — nessun carattere scaricato, nessuna libreria, nessun contatore — e
che l'informativa pubblicata dica quello che dice `docs/PRIVACY.md`, sezione
per sezione e con la stessa data.

## Come si prova

Con un browser vero, come tutto il resto del collaudo:

```bash
node strumenti/porta-nel-sito.mjs
cd collaudo && npm install && cd ..
node collaudo/guarda-il-sito.mjs
```

Apre il sito a tre larghezze — telefono, tablet, computer — e guarda, in
ordine di quanto fa male sbagliarlo:

1. **la plancia parte**: esce dal velo d'avvio, tira su la sua barra con tutte
   le sue voci (compresa quella che si è fatta chi ci abita, l'acquario), e
   apre le sue pagine;
2. **la plancia risponde**: un comando dato alla plancia arriva fino alla casa
   finta in pagina e le cambia lo stato;
3. **niente errori** in console e nessun file che non arriva — le due
   telecamere sono l'eccezione, ed è scritta nel collaudo;
4. **niente scorrimento di lato** a nessuna larghezza;
5. **i link portano dove dicono**;
6. **le schermate dell'app si vedono** — non basta che il tag ci sia: si chiede
   al browser se dentro ci sono davvero dei pixel, perché un'immagine che non
   arriva lascia un buco e non fa nessun rumore;
7. **la copertina resta chiara** anche a chi preferisce il tema scuro;
8. **l'informativa è vestita come il sito**: i caratteri giusti, il fondo
   giusto, una colonna da leggere e i collegamenti che si distinguono dal
   testo. Che il testo sia quello giusto lo tiene una prova del centralino;
   questa tiene l'altra metà, che nessuna prova sul testo vedrebbe. È già
   successo: l'informativa era scritta addosso a uno `stile.css` che poi è
   stato rifatto per l'indice, e da quel momento apriva senza niente addosso.

Le fotografie finiscono in `collaudo/foto/sito-*.png`.

Se la pagina non trovasse i suoi file non ci sarebbe nessun errore da nessuna
parte: ci sarebbe una pagina bianca. Per questo si guarda con un browser vero.
