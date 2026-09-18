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
| **Il collaudo** | dieci spunte: plancia configurata · almeno un telefono · da fuori casa funziona · nessun dispositivo sparito · niente da aggiornare · il backup gira · **gli add-on che devono girare, girano** · **la rete regge** · **la macchina non soffre** · nessuna batteria da cambiare |
| **La macchina** | la scheda (ODROID-N2+, ODROID-M1, un NUC…), CPU, memoria, disco e quanto resta, temperatura **con la tacca a 75°**, **la vita già consumata del disco**, da quanti giorni è accesa |
| **La rete** | internet sì o no, ogni scheda con su/giù, cavo o Wi-Fi, quale è la principale, il segnale, l'indirizzo sulla rete di casa — e gli apparati sorvegliati (il router, i ripetitori) con quanti non rispondono |
| **Gli add-on** | tutti, uno per pastiglia: acceso, **fermo** (parte all'avvio e non gira) o spento a mano |
| **La salute** | la striscia dei giorni, dispositivi totali e spariti, batterie sotto soglia e la più bassa, ultimo backup, errori nel registro, da quanto regge il filo |
| **I dispositivi spariti** | le impronte, non i nomi (sotto c'è perché) |
| **Gli aggiornamenti** | cosa c'è da installare, da quale versione a quale, e **il tasto per farlo** dove quella casa ha aperto la manutenzione |
| **Le versioni** | gdahome, la plancia, Home Assistant Core, Supervisor, il sistema — con «c'è la nuova» dove c'è |
| **La cartolina** | il testo grezzo, come è arrivato |

### Le tre domande che la macchina risponde da sola

**La vita del disco è la riga che nessuno guarda e che conta di più.** Su un
ODROID Home Assistant scrive tutto il giorno su una eMMC o una microSD, e
quelle hanno un numero di scritture e poi finiscono. Il Supervisor dichiara
`disk_life_time`, cioè la percentuale già spesa: vederla salire vuol dire
cambiare il supporto quando decidi tu, invece di scoprirlo il giorno che il
cliente ha perso tutto. Dove non c'è — un NUC con un SSD — non si inventa.

**La tacca a 75° non è un numero scelto qui:** è quella che la plancia disegna
già sull'arco della temperatura del MiniPC, ed è dove un ODROID comincia a
rallentarsi da solo. Sopra, la casa non si rompe: diventa lenta, e nessuno
capisce perché.

**Un add-on fermo non è un add-on spento.** Conta solo chi **parte all'avvio**
ed è giù: nessuno spegne un add-on lasciandogli l'avvio automatico, quindi
quello si è fermato da solo. Uno messo a mano e lasciato fermo è una scelta di
chi ci abita, e dirglielo ogni quarto d'ora insegna a non guardare più.

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
  "macchina": {
    "scheda": "ODROID-N2+", "cpu": 14, "ram": 38,
    "disco": 46, "discoLiberi": 17.2,
    "temperatura": 46, "discoVita": 11, "accesaDa": 41
  },
  "rete": {
    "internet": true,
    "schede": [
      { "nome": "eth0", "tipo": "ethernet", "su": true, "principale": true, "ip": "192.168.1.50" },
      { "nome": "wlan0", "tipo": "wifi", "su": false, "principale": false, "ip": "", "segnale": null }
    ],
    "sorvegliate": { "quante": 3, "giu": 0 }
  },
  "addon": {
    "quanti": 8, "accesi": 8, "spentiCheDovrebbero": 0,
    "elenco": [{ "nome": "Mosquitto broker", "su": true, "allAvvio": true, "aggiornabile": false }]
  },
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
persone, stati di sensori, **l'SSID del Wi-Fi**, **l'indirizzo pubblico**,
posizione, foto, la configurazione della plancia, il contenuto delle
segnalazioni. Il quadro dice **che c'è da guardare**, e finisce lì: guardare
dentro casa è un'altra cosa, e non si fa da qui (vedi «Cosa il quadro non può
fare»).

La regola si dice meglio così: **cosa c'è nella scatola, non chi ci abita.**
«Mosquitto broker» ed `eth0` sono nomi di prodotti e di schede, e non dicono
niente di nessuno. L'SSID sì — una rete che si chiama «Casa Rossi» è una
persona — e resta fuori.

**L'indirizzo sulla rete di casa invece c'è, ed è un cambio voluto** rispetto a
come stava scritto prima. `192.168.1.50` non identifica nessuno, e a chi ripara
queste macchine serve davvero: «la scatola ha cambiato indirizzo» è metà delle
telefonate. L'indirizzo pubblico è un'altra cosa — quello dice dove abiti — e
non esce.

**Le impronte.** Un dispositivo sparito l'installatore lo vuole seguire: è
quello di ieri o un altro? Perciò la casa manda quattro cifre,
`sha256(sale_di_casa + entity_id)` accorciato, con un sale che nasce in `/data`
e non esce mai. Il quadro può dire «lo stesso di ieri» — cioè distinguere un
dispositivo morto da una rete che balla — e non può dire quale. **Il nome non
lo scopre nessuno da lì**, e non è una cosa da aggiungere dopo: quei nomi
dicono cosa c'è in una casa e in quali stanze. Se serve saperlo, lo legge chi
ci abita dalla propria plancia, dove quel dispositivo risulta non disponibile,
e lo dice se vuole.
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
/* Il foglio, da quello che il ponte sa già. Nessuna rete qui dentro e nessun
 * orologio che non sia quello che gli si passa: si prova tutto senza Home
 * Assistant, senza Supervisor e senza nessun quadro acceso. */
export function compila({ casa, ogni, versioni, macchina, rete, apparati,
                          addon, aggiornamenti, plance, telefoni, fuori,
                          entita, batterie, backup, adesso }) → object

/* Da dove viene ogni numero: l'unico posto che lo sa. Torna una funzione, non
 * un foglio, così ogni cartolina è di adesso invece che di quando il ponte si
 * è acceso. */
export function fabbricaLaCartolina({ identita, casa, ferro, aggiornamenti,
                                      plance, configurazione, dispositivi,
                                      chiamata, versioni, ogni }) → () => object

/* Il codice incollato nella scheda dell'add-on. */
export function leggiIlCodice(scritto) → { dove, chiave } | null

/* Chi la spedisce: un orologio, e un tentativo che se fallisce rallenta
 * invece di insistere. Spento quando manca il codice — cioè quasi sempre. */
export class Postino {
  constructor({ dove, chiave, casa, ogni, fabbrica, fetch, registro, adesso })
  parti()            // accende l'orologio
  ferma()
  async manda()      // una cartolina, adesso
  get acceso()       // se questa casa manda qualcosa a qualcuno
  get ultima()       // l'ultima cartolina spedita, per la console
  get ultimoEsito()  // andata, o perché no
}
```

L'impronta delle entità sta in `salute.js`, dove sta la cosa che la usa; il
sale nasce in `identita.js`, di fianco al file che sopravvive ai riavvii.

**`ponte/src/salute.js`** — nuovo

```js
/* Le due domande che oggi non si fanno, sugli stati che già arrivano. */
export function iDispositivi(stati, { sale }) → { totali, spariti, impronte }
export function leBatterie(stati, { scarica = 20 }) → { sotto20, piuBassa }
export function ilBackup(stati) → { giorniFa }        // dall'entità del backup
```

**`ponte/src/ferro.js`** — nuovo: la macchina, la rete e gli add-on

Quasi tutto lo dice il Supervisor, e **senza che nessuno configuri niente in
casa del cliente** — che è la cosa che conta: un installatore non può contare
sul fatto che il cliente abbia aggiunto l'integrazione System Monitor.

```js
/* `/os/info` + `/host/info` + `/supervisor/stats`.
 * Da `/os/info` viene `board` (`odroid-n2`) e da `/host/info` il
 * `disk_life_time`, che sulle schede con eMMC o microSD è la riga che conta. */
export function laMacchina({ os, host, stats, temperatura }) → object

/* `/network/info`, la stessa via che `ritorno.js` chiama già per sapere dove
 * sta questa casa: lì si tengono solo gli `ipv4.address`, qui anche
 * `enabled`, `connected`, `primary`, `type` e il segnale.
 * L'SSID si butta apposta, e una prova tiene fermo che non esca. */
export function laRete({ network, filoSu }) → object

/* `/addons`: nome, `state`, `boot`, `update_available`. La sola domanda che
 * conta è `boot === "auto" && state !== "started"`. */
export function gliAddon({ addons }) → object
```

Le due cose che il Supervisor **non** dice sono la temperatura della scheda e
gli apparati di rete di casa, e tutt'e due ce l'ha già la plancia:

- la temperatura sta nell'arco del MiniPC, insieme a `dm.server_cpu`,
  `dm.server_ram`, `dm.server_disco` e all'uptime
  (`officina/.../sections/minipc-showcase-section.js`);
- il router e i ripetitori sono i `binary_sensor` con
  `device_class: connectivity` che la sezione «Macchine e rete» adotta **per
  integrazione** e non per classe — la regola sta in
  `officina/.../core/macchine-e-rete.js`, e serve a non risucchiare ogni
  telefono e ogni presa Wi-Fi della casa. Il ponte guarda le stesse entità con
  le stesse regole, e dove non è stato spuntato niente manda zero invece di
  fingere.

Che i due numeri siano gli stessi non è un dettaglio: è la regola che
`aggiornamenti.js` si è già data — «chi guarda la dashboard e chi guarda l'app
devono vedere lo stesso elenco, con gli stessi nomi e nello stesso ordine».

**`ponte/src/opzioni.js`** — due voci: `quadro` (il codice incollato, vuoto di
serie) e `quadro_ogni` (minuti, 15).

**`ponte/config.yaml`** — `quadro: ""` con schema `str?`, esattamente come
`chiave_console`: una casella che quasi nessuno riempie, e chi la riempie sa
cosa ci mette.

**Il codice del quadro** è una riga sola da incollare, con dentro tutt'e due le
cose che servono — dove chiamare e con che presentarsi:

```
quadro|1|https://quadro.impiantirossi.it|K7M2-9XQF-3BHT-R4VN
```

Due caselle da riempire giuste sarebbero due caselle da sbagliare. E leggibile,
non un blocco di base64 come diceva una stesura di questo documento: quando
qualcosa non va la prima domanda è «cosa ci hai incollato?», e a quella si deve
poter rispondere leggendo. La forma è quella dell'invito del QR code
(`ponte/src/invito.js`), numero di versione compreso: è l'unica cosa che
permetta a un ponte vecchio di dire «questo codice viene da un quadro più nuovo
di me» invece di leggerne metà.

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

### Nell'app: niente

Una stesura di questo documento diceva di alzare `caseMassime` da 10
(`app/lib/casa/archivio_delle_case.dart:16`) perché l'installatore, dal quadro,
dovesse poter **aprire** la casa che lampeggia. Quella riga è caduta insieme al
tasto che la chiedeva: dal quadro non si apre niente, e allora dieci case
nell'app restano quello che erano — le case di chi la usa, non la flotta di chi
la installa. **L'app non va toccata.**

## Aggiornare da lontano

Vedere che una casa è indietro e non poterci fare niente è mezzo lavoro. Il
quadro ha quindi **due verbi**, e sono due e non di più:

| | |
|---|---|
| `aggiorna` | installa una voce `update.` — Home Assistant, un add-on, gdahome, un firmware che si installi da sé |
| `riavvia` | fa ripartire un add-on che è fermo |

Niente altro: nessuna riga di comando, nessun cambio di configurazione, nessuna
lettura di stati. L'elenco dei verbi sta **nel programma del ponte**, non nel
messaggio: una parola che non è in quella lista viene rifiutata, e non c'è modo
di aggiungerne una dall'esterno.

**Il quadro non bussa mai.** Non potrebbe: una casa di gdahome un indirizzo
pubblico non ce l'ha, ed è tutto il punto del ponte. L'ordine viaggia **nella
risposta alla cartolina**: la casa deposita i suoi numeri, e nella risposta si
trova, se c'è, una cosa da fare. Nessuna porta da aprire, nessun servizio in
ascolto — la stessa forma che ha già il filo verso il centralino.

**La manutenzione è un secondo interruttore**, e spento di serie:

```yaml
quadro: "…"            # manda la cartolina
quadro_manutenzione: false   # e lasciati anche aggiornare — no, finché non lo dici
```

Vedere e toccare sono due permessi, e il secondo non si dà da sé insieme al
primo. Nella console dell'add-on, scheda «Il quadro», stanno l'interruttore, la
lista dei due verbi scritta a parole, e **il registro di quello che il quadro
ha fatto in questa casa** — con la data. Chi ci abita legge cosa è stato
toccato, quando, e da chi.

Tre regole che il ponte applica e il quadro non può scavalcare:

1. **Il backup viene prima, sempre.** Non è una casella da spuntare: è la
   condizione perché il verbo esista. Un aggiornamento che va storto senza
   backup dietro è una casa da rifare.
2. **Quelli che staccano il filo, uno per volta.** `aggiornamenti.js` li marca
   già (`stacca`): gdahome e Home Assistant si riavviano installandosi. Due
   insieme sulla stessa casa vogliono dire non sapere quale dei due non è
   tornato.
3. **Quello che non si installa da sé non ha un tasto.** `installabile` lo dice
   già, ed è la regola che il ponte si è data: un firmware che si porta col
   cacciavite mostrato con un tasto è una promessa che non si mantiene.

E una conseguenza che va guardata in faccia: **una casa che sta installando
qualcosa che stacca il filo smette di mandare cartoline.** Senza saperlo, il
quadro la darebbe per muta ogni volta che si aggiorna qualcosa. Perciò sa cosa
ha chiesto, e lo dice: entro tre quarti d'ora è «sta aggiornando»; oltre, non è
più un'attesa ma **«non è tornata»** — che è la cosa peggiore che possa fare un
quadro che aggiorna da lontano, e va detta con quelle parole invece che
nascosta dietro un «muta».

### La schermata di flotta

Casa per casa la domanda è «a questa cosa manca». Con quaranta impianti è
un'altra: **«quali sono indietro su Home Assistant Core?»**. La scheda
«Aggiornamenti» raggruppa per quello che c'è da installare invece che per dove
sta, e sotto ogni voce ci sono le case che ce l'hanno indietro con la versione
che hanno adesso. Un gesto invece di quaranta — e un avvertimento scritto lì
sotto, perché quaranta case insieme sono quaranta rischi insieme.

## Cosa il quadro non può fare

È la parte che decide se questo pezzo si può dare a qualcuno, e viene prima di
tutte le altre. Un installatore che tiene quaranta impianti non deve poter
guardare dentro quaranta case: quelle case sono di altri, e dentro ci sono le
telecamere, le presenze, gli orari di chi ci vive.

Perciò il quadro **non guarda dentro**, e le tre cose che non fa sono tre cose
che non ha:

- **non apre la plancia** — non c'è nessun tasto che porti dentro una casa, e
  non è un tasto dimenticato: il quadro non ha nessun segno con cui entrare;
- **non vede entità, stanze né persone** — riceve numeri, versioni e nomi di
  processi, e si ferma lì;
- **non tocca niente oltre i due verbi** — e solo dove quella casa ha aperto la
  manutenzione. Non c'è una riga di comando, non si cambia la configurazione,
  non si legge uno stato.

Le due cose si tengono insieme meglio di come sembra: **un elettricista
sostituisce un interruttore senza leggere la posta di chi ci abita.** Guardare
dentro casa e fare manutenzione sulla scatola non sono lo stesso permesso, e
questo pezzo dà il secondo e non il primo.

Per entrare in una casa serve un abbinamento, e quello lo dà **chi ci abita**,
col suo segno, che toglie con un bottone quando vuole. Vale anche per
l'installatore il giorno dell'installazione: il telefono che abbina per provare
l'impianto è un telefono come gli altri, e al momento della consegna si stacca.
Il quadro mostra quanti telefoni sono abbinati proprio perché quel conto si
guardi.

## Le tre regole che non si toccano

1. **Il quadro non guarda dentro, e tocca solo quello che gli è stato
   aperto.** Una stesura precedente diceva «ascolta e non parla», e con gli
   aggiornamenti quella frase è diventata falsa: si cambia invece di tenerla
   per bella. Quello che non cambia è la metà che conta — dentro casa non
   guarda — e quello che si è aggiunto ha un interruttore suo, spento di serie,
   in mano a chi ci abita.
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

   **Fatta**, in `1.4.32.15`. Il ponte: `ponte/src/salute.js`,
   `ponte/src/ferro.js` e `ponte/src/cartolina.js`, le due opzioni nel
   manifesto tradotte in italiano e in inglese, il postino acceso in
   `index.js`. E la console: la scheda **«Il quadro di chi ti ha fatto
   l'impianto»**, che compare solo dove quella casella è piena — cioè quasi mai
   — e fa la cosa per cui esiste: mostra **il testo dell'ultima cartolina
   spedita, intero e senza riassunti**. Un riassunto di quello che esce è
   esattamente la cosa di cui ci si dovrebbe fidare.

   Il tasto **«Smetti di mandarla»** ferma il postino *e* svuota la casella
   nelle opzioni dell'add-on, passando dal Supervisor
   (`Ferro.spegniLaCartolina`): fermarlo solo in memoria vorrebbe dire che al
   primo riavvio la casa ricomincia a parlare da sola, cioè un tasto che smette
   finché non si riavvia — una bugia con un bottone sopra. Dove il Supervisor
   non lascia scrivere si dice **cosa fare a mano**, invece di dire che è
   andata.

   Quarantotto prove in tutto, tre delle quali col ponte intero acceso
   (`ponte/test/server.test.js`): che senza codice la scheda non ci sia, che
   quella via dica a chi parla questa casa e **non** dica con che, e che
   «smetti» faccia tutt'e due le cose.
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
