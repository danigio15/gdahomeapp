# Il quadro

**Bozza.** Qui dentro non c'è ancora niente che gira: c'è il disegno di come
un installatore guarda i suoi impianti, e la pagina che lo fa vedere
(`console/index.html`, con case finte). Serve a decidere prima di costruire.

Il quadro elettrico e il quadro della situazione sono la stessa parola, e per
chi installa impianti è la sua.

## A cosa serve

Un installatore mette gdahome in quaranta case. Dopo la consegna non ci torna
più, e quello che succede lì dentro non lo sa nessuno: il Wi-Fi che cambia, la
presa Zigbee che sparisce, Home Assistant fermo a sei mesi fa, il backup che
non gira dal giorno dell'installazione. Se ne accorge quando squilla il
telefono, cioè quando il cliente è già arrabbiato.

Il quadro risponde a due domande, e sono due domande diverse:

- **il collaudo** — *quell'impianto l'ho finito bene?* Una fila di spunte per
  casa, che si chiude il giorno della consegna.
- **la salute** — *regge nel tempo?* Le stesse righe guardate tutti i giorni,
  che si riaprono quando qualcosa si rompe.

## Dove sta, e perché non sta altrove

Il quadro è **un pezzo che si accende l'installatore**, come il centralino:
Node su una macchina sua, oppure un Worker su Cloudflare (`nuvola/` è il
precedente, piano gratuito e indirizzo compreso). Il ponte gli parla
**diritto**, in HTTPS, e `tramite.gdahome.org` non c'entra niente.

Non sta sul centralino di gdahome, e non è una questione di fatica: il
centralino oggi instrada e non capisce, e c'è una prova che guarda tutto quello
che lo attraversa e controlla che non ci sia niente di leggibile. Un cruscotto
lì dentro renderebbe falsa quella riga del README, e farebbe di chi mantiene
l'app il custode dei dati di centinaia di case che sono di qualcun altro.
L'installatore invece con quelle case un contratto ce l'ha già.

Non sta nemmeno solo nell'app, e per un motivo pratico: un cruscotto che vive
in un telefono dice che una casa è giù **quando lo apri**. Il mestiere del
quadro è accorgersene mentre nessuno guarda.

## Cosa vede l'installatore

Si apre su un numero solo — **quante case gli chiedono qualcosa adesso** — e
sotto l'elenco. Ogni riga è una casa: stato, nome, da quanto non parla, le spie
accese, e la striscia dei quattordici giorni con i buchi in rosso.

Aprendo una casa:

| | |
|---|---|
| **L'impianto** | matricola, installata il, collaudata il, ogni quanto manda, telefoni abbinati e quanti visti in 7 giorni |
| **Il collaudo** | sette spunte: plancia configurata · almeno un telefono · da fuori casa funziona · nessun dispositivo sparito · niente da aggiornare · il backup gira · nessuna batteria da cambiare |
| **La salute** | la striscia dei giorni, dispositivi totali e spariti, batterie sotto soglia e la più bassa, ultimo backup, errori nel registro, da quanto regge il filo |
| **I dispositivi spariti** | le impronte, non i nomi (sotto c'è perché) |
| **Le versioni** | gdahome, la plancia, Home Assistant Core, Supervisor, il sistema — con «c'è la nuova» dove c'è |
| **La cartolina** | il testo grezzo, come è arrivato |

### Gli stati, e perché hanno una forma

Quattro: **● a posto**, **▲ da guardare**, **■ muta**, **◇ collaudo aperto**.
Muta batte tutto — di una casa che non parla non si sa niente, nemmeno che sta
bene — e il collaudo aperto sta in una fila sua, perché un lavoro non finito si
sbriga in un altro modo da un impianto che si è rotto.

Ogni stato porta **una forma, una parola e un colore**, e non il colore da
solo. Non è prudenza generica: misurando la tavolozza del progetto, `--ottone`
e `--allarme` distano 1.7 per chi non distingue il rosso dal verde, e 9.1 per
chi li distingue tutti — sotto la soglia in tutti e due i casi. Su una pagina
che serve a separare a colpo d'occhio le case ambra dalle rosse, il pallino da
solo non porta il significato. Le forme e le parole sì.

## La cartolina

Quello che una casa manda, ogni quindici minuti. Ci sono **numeri e versioni**,
e nient'altro.

```json
{
  "casa": "casa_a3f19c74e05b2d8890fa4c1e6b73d052",
  "quando": "2026-09-18T09:41:12Z",
  "ogni": 15,
  "ponte": "1.4.32.14",
  "plancia": "1.4.32",
  "ha": "2026.9.1",
  "supervisor": "2026.08.3",
  "sistema": "Home Assistant OS 14.2",
  "aggiornamenti": { "quanti": 0, "ha": false, "addon": 0, "gdahome": false, "firmware": 0 },
  "plance": { "quante": 3, "configurate": 3 },
  "telefoni": { "abbinati": 2, "visti7gg": 2 },
  "fuori": { "acceso": true, "filo": true, "daGiorni": 41 },
  "dispositivi": { "totali": 214, "spariti": 3, "impronte": ["7c2a", "91ff", "04be"] },
  "batterie": { "sotto20": 0, "piuBassa": 47 },
  "backup": { "giorniFa": 2 },
  "registro": { "errori24h": 0 }
}
```

**Cosa non c'è, e non ci deve andare:** nomi di entità, nomi di stanze, nomi di
persone, stati di sensori, indirizzi IP, posizione, foto, la configurazione
della plancia, il contenuto delle segnalazioni. Il quadro dice **che c'è da
guardare**; guardare si fa dentro casa, dall'app, sul filo cifrato, col segno
che chi ci abita può togliere.

**Le impronte.** Un dispositivo sparito l'installatore lo vuole seguire: è
quello di ieri o un altro? Perciò la casa manda quattro cifre,
`sha256(sale_di_casa + entity_id)` accorciato, con un sale che nasce in `/data`
e non esce mai. Il quadro può dire «lo stesso di ieri» e non può dire quale.
Nella prima versione si possono anche lasciar fuori: contarli basta a far
suonare la spia.

## Le funzioni da aggiungere

### Nel ponte

Quasi tutto il contenuto della cartolina il ponte ce l'ha già in mano. Le due
cose che oggi non si chiede sono i dispositivi spariti e le batterie, e si
prendono dallo stesso `get_states` che `aggiornamenti.js` fa già ogni dieci
secondi sulla rete di casa — oggi ne tiene solo le entità `update.` e butta il
resto.

**`ponte/src/cartolina.js`** — nuovo

```js
/* Il foglio, da quello che il ponte sa già. Nessuna rete qui dentro: si prova
 * tutto senza Home Assistant e senza un quadro acceso. */
export function compila({ identita, opzioni, versioni, aggiornamenti, plance,
                          dispositivi, fuori, salute, adesso }) → object

/* Quattro esadecimali per un'entità, col sale di questa casa. */
export function impronta(sale, entita) → string

/* Chi la spedisce: un orologio, e un tentativo che se fallisce rallenta
 * invece di insistere. Spento quando `dove` è vuoto — cioè quasi sempre. */
export class Postino {
  constructor({ dove, chiave, ogni, prendi = fetch, registro, adesso })
  parti()            // accende l'orologio
  ferma()
  get ultima()       // l'ultima cartolina spedita, per la console
  get ultimoEsito()  // andata, o perché no
}
```

**`ponte/src/salute.js`** — nuovo

```js
/* Le due domande che oggi non si fanno, sugli stati che già arrivano. */
export function iDispositivi(stati, { sale }) → { totali, spariti, impronte }
export function leBatterie(stati, { scarica = 20 }) → { sotto20, piuBassa }
export function ilBackup(stati) → { giorniFa }        // dall'entità del backup
```

**`ponte/src/opzioni.js`** — due voci: `quadro` (il codice incollato, vuoto di
serie) e `quadro_ogni` (minuti, 15).

**`ponte/config.yaml`** — `quadro: ""` con schema `str?`, esattamente come
`chiave_console`: una casella che quasi nessuno riempie, e chi la riempie sa
cosa ci mette.

**Il codice del quadro** è una stringa sola da incollare — l'indirizzo e la
chiave insieme, come si fa già col QR code dell'abbinamento: base64url di
`{"q":"https://quadro.rossi.it","k":"…"}`. Due caselle da riempire giuste
sarebbero due caselle da sbagliare.

**`ponte/console/`** — la scheda **«Il quadro»**, dietro l'ingress: a chi va,
ogni quanto, **l'ultima cartolina spedita in chiaro**, quando è andata l'ultima
e il tasto **«Smetti di mandarla»**. Più una riga nel registro la prima volta
che parte.

**`ponte/src/commissioni.js`** — una via per la console: `ponte/quadro`,
leggere e spegnere.

### Nel quadro

```
quadro/
  src/quadro.js      il server: le vie, e niente altro
  src/case.js        le case seguite: matricola, nome dell'installatore,
                     collaudataIl, la storia dei giorni
  src/cartoline.js   riceve, valida, tiene N giorni e pota
  src/collaudo.js    da una cartolina alle spunte, e dalle spunte allo stato
  src/chiavi.js      le chiavi di flotta, e la loro impronta
  console/index.html la pagina (la bozza c'è già)
```

Le vie:

| | |
|---|---|
| `POST /cartolina` | la casa deposita. Matricola + chiave di flotta; una matricola mai vista nasce qui, in fila «collaudo aperto» |
| `GET /case` | l'elenco per la console — è la forma di `CASE` nella bozza |
| `GET /casa/:matricola` | una casa, con la sua storia |
| `PUT /casa/:matricola` | il nome che le dà l'installatore, e «non seguirla più» |
| `GET /salute` | se il quadro sta in piedi |

`src/collaudo.js` è già scritto dentro la bozza — `ilCollaudo`, `loStato`,
`leSpie` — e va portato lì com'è, con le sue prove.

### Nell'app

`caseMassime` sta a 10 (`app/lib/casa/archivio_delle_case.dart:16`): «più di
così non è un elenco di case, è un elenco di prove». Per un installatore che
dal quadro vuole **aprire** la casa che lampeggia, dieci sono poche. Va alzato,
e serve un modo di aprire una casa per matricola da un link.

## Le tre regole che non si toccano

1. **Il quadro ascolta e non parla.** La cartolina va in una direzione sola, e
   il quadro non ha nessun modo di comandare niente. Un quadro che comandasse
   sarebbe una porta di servizio dell'installatore in casa del cliente. Per
   entrare c'è la strada che esiste già: l'app, col suo segno, che si toglie
   con un bottone.
2. **Il consenso è di chi ci abita, non di chi ha installato.** L'opzione si
   vede nella scheda dell'add-on, la scheda della console fa leggere parola per
   parola quello che parte, e il tasto per smettere è lì di fianco. Si dice, non
   si nasconde — come per la plancia modificata, che non viene bloccata: viene
   detta.
3. **Numeri, non nomi.** Tutto quello che non serve a far suonare una spia
   resta in casa.

## Le tappe

1. **La cartolina nel ponte**, spenta di serie, con la scheda nella console che
   la fa leggere. Si prova con `curl` e un file, senza nessun quadro acceso — ed
   è già utile da sola: chi ha una casa sola può guardarsi la sua.
2. **Il quadro in Node**, la pagina che c'è già attaccata a dati veri.
3. **La versione su Cloudflare**, come `nuvola/`, con la stessa prova dal vivo
   contro tutte e due.
4. Poi, se serve: la storia lunga, un avviso quando una casa tace, le impronte
   dei dispositivi.

## Quello che resta da decidere

- **Ogni quanto.** Quindici minuti fanno 96 cartoline al giorno per casa: su
  quaranta case sono quattromila richieste, che è niente. Ma una casa muta si
  scopre in tre quarti d'ora, e forse per un impianto va bene anche un'ora.
- **Quanto tiene il quadro.** Qui si propone la striscia a quattordici giorni,
  come la finestra del traffico di GitHub in `strumenti/conta-le-case.mjs`.
- **Le soglie.** Batteria al 20%, backup fermo dopo 14 giorni, muta dopo tre
  cartoline saltate: sono numeri scelti per far vedere la bozza, non misurati.
- **Se un aggiornamento in attesa fa suonare la spia.** Nella bozza no, a meno
  che tocchi Home Assistant o gdahome o siano tre: una casa che diventa ambra
  perché un add-on ha una versione nuova da ieri insegna a non guardare più le
  case ambra. Nel collaudo invece contano tutti, perché alla consegna un
  impianto si lascia aggiornato.
- **Chi lo accende.** Se il quadro resta una cosa che un installatore si tira su
  da sé, o se un domani ne esiste uno ospitato — e allora tornano tutte le
  domande sui dati di case altrui, che è il motivo per cui qui sta da questa
  parte.
