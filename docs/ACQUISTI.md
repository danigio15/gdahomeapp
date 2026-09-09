# Gli acquisti, e come si autorizzano

Bozza. Niente di quello che c'è qui dentro è ancora scritto in codice: quello
che c'è è il **listino**, il giro dei soldi e — la parte che interessa a chi
vende — i tre modi in cui si autorizza uno sblocco.

I numeri stanno in un posto solo, `app/lib/schermate/acquisti/catalogo.dart`.
Li leggono la schermata dell'app, la scheda «Acquisti» della console
dell'add-on e questo documento. Tre posti che dicono tre prezzi diversi è il
modo più rapido di perdere la fiducia di chi paga.

## Le tre regole che hanno deciso la forma

1. **Quello che serve a vedere e comandare la propria casa non si paga.** Mai.
   Compreso l'accesso da fuori: tenerlo in piedi costa zero — il centralino
   gira gratis su Cloudflare — ed è il motivo per cui l'app esiste. Farlo
   pagare è il modo più rapido di far chiudere l'app.
2. **Si paga per casa, non per telefono.** Chi compra lo vede sul suo
   telefono, sul tablet in cucina e su quello di sua moglie. Un acquisto per
   famiglia. Se uno ha due case, ognuna fa storia a sé.
3. **Il limite si sente al secondo dispositivo, non al primo.** Il primo di
   ogni cosa è gratis davvero, non una vetrina: chi prova l'app deve vederla
   funzionare. Il secondo elettrodomestico è il momento in cui l'app ha già
   dimostrato di valere, ed è lì che si chiede.

## Cosa resta gratis, per sempre

- La plancia intera, con tutte le sue pagine
- Comandare la casa da fuori, dal centralino
- Più case sullo stesso telefono
- L'elenco dei dispositivi, e comandarli
- Le segnalazioni e la chat di assistenza
- **Un** dispositivo collegato: un elettrodomestico, un'auto o un robot
- **Una** telecamera nella plancia
- L'energia di adesso: quanto produci e quanto consumi
- **Tre** aiutanti, **una** automazione, **un** dispositivo Zigbee

E la **prova di quattordici giorni**: al primo abbinamento tutto è acceso per
due settimane, senza carta e senza chiedere niente. Serve a far vedere cosa si
perde, che è il modo più onesto di far comprare.

## Il listino

### Il pacchetto

| cosa | chiave | prezzo |
|---|---|---|
| **Casa completa** — toglie tutti i limiti, per sempre, per tutta la casa. Comprende la precedenza nelle risposte alle segnalazioni. | `casa.completa` | **19,99 €** una volta |
| **Casa completa, a mesi** — le stesse cose, si disdice quando si vuole | `casa.completa` | **1,99 €** al mese |

I due prezzi stanno bene insieme sui negozi e nessuno dei due spaventa. Il
mensile non è un secondo prodotto: è la stessa cosa per chi non vuole
decidere subito.

### I singoli

Per chi vuole una cosa sola. Messi insieme costano 35,94 €, quasi il doppio
del pacchetto, ed è **voluto**: chi ne prende due deve accorgersi da sé che
gli conviene l'altro.

| cosa | chiave | gratis | prezzo |
|---|---|---|---|
| Dispositivi senza limite — elettrodomestici, auto elettriche, robot | `app.dispositivi` | 1 | 6,99 € |
| Energia completa — report, analisi per dispositivo, confronti nel tempo | `plancia.energia` | l'energia di adesso | 6,99 € |
| Telecamere senza limite | `plancia.telecamere` | 1 | 4,99 € |
| Zigbee senza limite — ZHA e Zigbee2MQTT | `app.zigbee` | 1 dispositivo | 6,99 € |
| Automazioni senza limite — il mago | `app.automazioni` | 1 | 6,99 € |
| Aiutanti senza limite — interruttori, numeri, testi, orari | `app.aiutanti` | 3 | 3,99 € |

> **La decisione da prendere.** Il piano diceva «un livello solo e non tre»,
> perché ogni livello in più è una domanda in più da fare a chi paga. I
> singoli qui sopra sono la lista completa di cosa *si potrebbe* vendere, non
> di cosa *si vende*: si può partire col solo pacchetto e tenerli nel cassetto,
> oppure aprirne uno — e se se ne apre uno solo, quello dei dispositivi, che è
> il limite che si sente. Sono già scritti, accenderli è togliere un `if`.

### Quello che si prende senza pagare

| cosa | come |
|---|---|
| La prova di quattordici giorni | Da sola, al primo abbinamento |
| Un codice di sblocco | Si batte nell'app, o nella console dell'add-on |
| Chiedere lo sblocco | Si chiede dall'app, la richiesta arriva a chi può concederla |

## Dove passano i soldi, e dove passa la verità

Sono due giri diversi, e tenerli separati è quello che fa funzionare tutto.

**I soldi** passano dai negozi, e non c'è alternativa: Apple e Google lo
impongono per le funzioni digitali comprate dentro l'app. Si usa
`in_app_purchase` di Flutter, Google Play Billing da una parte e StoreKit
dall'altra. Loro prendono la loro parte e ci mettono la loro macchina dei
pagamenti, i rimborsi e le tasse: sono il pezzo che non conviene rifare.

**La verità** — cioè *cosa è acceso su questa casa* — non sta nel telefono e
non sta nel ponte, perché sono tutti e due in casa dell'utente e chi vuole li
può cambiare. Sta nel **centralino**, che è già il pezzo che chi distribuisce
l'app mantiene.

Il giro, per intero:

    app                    centralino                     ponte
     │                          │                           │
     │ compra dal negozio       │                           │
     │ ← ricevuta               │                           │
     │                          │                           │
     ├─ ricevuta + casa ──────► │                           │
     │                          ├─ verifica presso          │
     │                          │  Google / Apple           │
     │                          ├─ scrive nel registro      │
     │                          ├─ firma il diritto (Ed25519)
     │                          │                           │
     │ ◄──── diritto firmato ───┤                           │
     ├─────────────────────────────── diritto firmato ────► │
     │                                                      ├─ verifica la firma
     │                                                      │  con la chiave
     │                                                      │  pubblica, da solo
     │                                                      ├─ /data/diritti.json
     │                                                      │
     │ ◄──── cosa è acceso ─────────────────────────────────┤

Un **diritto** è: l'elenco delle chiavi accese per una casa, i limiti (quanti
dispositivi), una scadenza, e la firma. Il ponte ha solo la chiave pubblica:
verifica da solo, anche senza rete, e non c'è modo di scriverne uno finto. Un
diritto vale fino alla sua scadenza — un mese — e il ponte lo rinnova dal
centralino quando ci arriva. Spegnere una sezione è togliere la chiave dal
diritto: al rinnovo dopo, la sezione si chiude da sola.

Chi non ha mai rete verso il centralino tiene il suo diritto finché non
scade, e poi torna al gratis. È il compromesso giusto: un mese di margine a
chi la rete non ce l'ha, e nessun modo di stare acceso per sempre senza
passare mai di lì.

**Come si accende e si spegne, in pratica.** Il ponte è l'unico punto di
passaggio:

- per la plancia, `dashboardmodern/config/get` serve la configurazione
  **senza** le sezioni spente e `config/set` non le accetta; nella premessa in
  testa alla pagina il ponte scrive quali sono accese, così la barra e la
  Config le mostrano chiuse col loro prezzo;
- per l'app, la barra e le schermate leggono lo stesso elenco;
- i **limiti** si contano nel ponte: il catalogo delle integrazioni sa quanti
  dispositivi sono collegati, e il ponte rifiuta di collegarne uno in più di
  quanti il diritto ne concede.

## Come autorizzo io

Tre modi, e servono tutti e tre.

### 1. Dai negozi: non autorizzo niente, ed è giusto così

Google e Apple hanno già incassato. Il centralino verifica la ricevuta presso
di loro, e se è buona firma. Io non tocco niente e non devo esserci.

Quello che decido **una volta sola** sono i prezzi, in Play Console e in App
Store Connect. E quello che guardo ogni tanto è il registro: la console del
centralino mostra le case, cosa è acceso su ognuna, da quando e per quanto.

### 2. A mano, dalla console del centralino: quando autorizzo io

Serve per i casi in cui i soldi non passano da un negozio:

- chi collauda l'app, e chi aiuta;
- un rimborso da rimettere a posto;
- un cliente che paga in un altro modo — un bonifico, un'installazione fatta
  da me;
- una casa che ha avuto un problema e a cui si allunga la prova.

Nella console, per ogni casa, tre bottoni:

| bottone | cosa fa |
|---|---|
| **Regala** | Accende le chiavi che scelgo, fino alla data che scelgo |
| **Proroga** | Sposta in avanti la scadenza di quello che c'è già |
| **Revoca** | Spegne, dal rinnovo dopo |

Ognuno dei tre chiede **il motivo**, e il motivo finisce nel registro insieme
a chi l'ha fatto e a quando. Fra sei mesi «perché questa casa ha tutto acceso
gratis» deve avere una risposta scritta, non una da ricordare.

La console non è aperta a chiunque: sta dietro una parola d'ordine che è un
segreto di Cloudflare (`wrangler secret put PADRONE`), e la firma dei diritti
la fa la chiave privata del centralino, che sta lì dentro e non esce mai.

### 3. Un codice di sblocco: quando non voglio aprire la console

Fabbrico un codice — `GDA-XXXX-XXXX` — dicendo per quante case vale, quali
chiavi accende e fino a quando. Lo mando per messaggio. Chi lo riceve lo batte
nell'app, sotto Acquisti → «Ho un codice», o nella console dell'add-on. Il
centralino lo consuma e firma il diritto.

Serve alle fiere, a chi installa case per mestiere, a un regalo, a un gruppo di
collaudatori: si mandano dieci codici e non si apre la console dieci volte.

### E le richieste che arrivano

Nell'app, sotto Acquisti, c'è **«Chiedi lo sblocco»**. Passa dal filo delle
segnalazioni, che c'è già: la richiesta arriva nella console con il nome della
casa, cosa chiede e perché. Due bottoni, concedi o rispondi di no. Concedere è
esattamente il modo 2, con i campi già compilati.

È la differenza fra «scrivimi una mail» e «tocca qui»: la seconda la usa
qualcuno.

## Quanto regge, e cosa non regge

La domanda giusta da farsi prima di scrivere una riga di questo: **uno non
può semplicemente sbloccare tutto senza pagare?**

Sì. Può. E non c'è modo di impedirglielo.

Il ponte gira **in casa sua**, dentro il suo Home Assistant, dove ha i
permessi di amministratore. La plancia è JavaScript in chiaro. L'APK si
decompila. E la chiave pubblica con cui il ponte verifica il diritto firmato
sta dentro il ponte: si sostituisce con la propria e ci si firma i diritti da
soli.

Non è un difetto di questo disegno: è la natura di qualunque licenza che gira
sulla macchina del cliente. Sublime Text, WinRAR, JetBrains fuori linea —
tutti crackati, tutti fatti da aziende con più mezzi di noi. Chi dice di aver
risolto questo problema sta vendendo qualcosa.

Quindi la regola, e vale per tutte le decisioni qui sotto: **il controllo
nell'app è un dosso, non una serratura.** Va dimensionato come tale. Qualche
giorno di lavoro, non settimane; e ogni ora spesa a offuscare è un'ora tolta
alle funzioni, senza vincere lo stesso.

### Quello che regge davvero, in ordine

1. **Gli aggiornamenti.** La plancia è passata da 1.4.11 a 1.4.15 in tre
   giorni. Chi cracka si congela alla versione che ha crackato e deve rifarlo
   a ogni rilascio. Per un prodotto che si muove così, il flusso degli
   aggiornamenti vale più di qualunque protezione — e non costa niente,
   perché lo si sta già facendo.
2. **Il servizio, che non si copia.** Il codice si copia; l'assistenza con
   precedenza, il backup della configurazione, le notifiche no. Chi cracka
   ottiene un'app che funziona ed è sola. È l'unico pezzo genuinamente non
   copiabile, e per questo è quello su cui conviene appoggiarsi.
3. **Il diritto legato alla casa, con scadenza.** Non ferma chi cracka, ma
   ferma la **condivisione casuale** — che è il grosso del problema vero.
   Nessuno può mandare a un amico il proprio file «sbloccato»: è firmato per
   la sua casa e scade fra un mese.
4. **La licenza.** Dove la tecnica non arriva. La plancia ha già una licenza
   proprietaria che vieta la redistribuzione; l'app dovrebbe averne una
   uguale, e oggi non ce l'ha.

### Quello che il centralino può vedere, e che costa zero

Il centralino sa quali case chiedono il rinnovo di un diritto. Se un diritto
firmato per una casa comincia a comparire da quaranta case diverse, si vede.
Non serve bloccare nessuno in automatico — serve **saperlo**, perché è la
differenza fra «qualcuno l'ha crackata» e «qualcuno la sta rivendendo», che
sono due problemi con due risposte diverse.

### Difendere la paternità è un'altra partita, e quella si vince

Tutto quello scritto qui sopra vale per **l'incasso**. Difendere il *lavoro* —
che non venga preso, rimaneggiato e presentato come di qualcun altro — è un
problema diverso, e lì gli strumenti funzionano: non si impedisce un'azione, si
rende **riconoscibile**, **dimostrabile** e **costosa**. Sta in
[`TUTELA.md`](TUTELA.md), ed è già in piedi per metà.

### Il rischio vero non è chi cracka

Per 19,99 € una tantum su un pubblico Home Assistant, chi cracka spesso non
avrebbe pagato comunque, e la perdita è limitata. Il rischio vero è un altro,
ed è di quelli legali: **qualcuno che rivende la plancia come propria**, o un
pacchetto modificato che circola su un forum. Lì non serve codice — serve la
licenza, e serve accorgersene.

## Cosa non fare

- **Non far pagare l'accesso da fuori casa.** Costa zero, è il motivo per cui
  l'app esiste.
- **Non far pagare le segnalazioni.** Chi segnala aiuta, e un difetto trovato
  da un utente vale più di 19,99 €.
- **Non spegnere niente a chi ha già comprato**, mai, nemmeno cambiando i
  pacchetti: un diritto già firmato resta valido per quello che diceva.
- **Non chiedere la carta per la prova.** Quattordici giorni senza carta si
  raccontano in una riga; quattordici giorni con la carta sono un abbonamento
  con la trappola, e si vede.
- **Non spostare i dati sul centralino per proteggerli.** Calcolare i report
  di la' li renderebbe non copiabili, ed e' vero. Ma ucciderebbe la promessa
  che tutto resta in casa dell'utente, che e' il motivo per cui il progetto
  esiste: vale piu' di 19,99 €.
- **Non mettere controlli nel JavaScript della plancia.** E' la superficie
  piu' esposta, e il giorno che un controllo sbaglia si rompe la dashboard a
  chi **ha pagato**. Il punto di passaggio e' il ponte, ed e' uno solo.
- **Non offuscare.** Costa, si legge lo stesso, e intanto rende illeggibile il
  codice anche a noi.

## Cosa c'è già e cosa manca

| pezzo | dove | stato |
|---|---|---|
| Il listino, in un posto solo | `app/lib/schermate/acquisti/catalogo.dart` | ✅ bozza |
| La schermata dell'app | `app/lib/schermate/acquisti.dart` | ✅ bozza, non compra |
| La scheda nella console dell'add-on | `ponte/console/index.html` | ✅ bozza, bottoni spenti |
| Il registro degli acquisti e la firma dei diritti | `nuvola/` | ⬜ |
| La verifica delle ricevute presso Google e Apple | `nuvola/` | ⬜ |
| La console del centralino: vedere, regalare, prorogare, revocare | `nuvola/` | ⬜ |
| I codici di sblocco | `nuvola/` | ⬜ |
| I diritti nel ponte, la configurazione filtrata, la premessa | `ponte/src/diritti.js` | ⬜ |
| Il conteggio dei limiti | `ponte/src/catalogo.js` | ⬜ |
| L'acquisto e il ripristino nell'app | `app/lib/acquisti/` | ⬜ |
| «Chiedi lo sblocco» e la coda delle richieste | `app/`, `nuvola/` | ⬜ |
