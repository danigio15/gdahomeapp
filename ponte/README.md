# Il ponte

L'add-on che fa parlare l'app di DashboardModern con questa casa — da dentro e
da fuori — senza che nessun segreto di Home Assistant finisca sul telefono.

## Il problema che risolve

Un'app sul telefono deve entrare in Home Assistant. Le due strade classiche
sono tutte e due sbagliate per un'app che si distribuisce a qualcuno che non
sia se stessi:

* **Un segno lungo incollato a mano.** Vive anni, vale tutto, e per revocarlo
  bisogna sapere quale dei sette in elenco era quello del telefono perso.
* **L'autenticazione di Home Assistant dentro l'app.** Funziona, ma il telefono
  si ritrova in mano un segno di aggiornamento vero, e da fuori casa serve
  comunque che qualcuno lo faccia arrivare a Home Assistant.

Il ponte prende una terza strada. Il telefono riceve **un segno suo**, che vale
solo per questo ponte e per questa casa. Il segno di Home Assistant resta
nell'add-on e non esce mai.

```
   telefono                    il ponte                Home Assistant
      │                    ┌──────────────┐
      │   segno del ponte  │              │  SUPERVISOR_TOKEN
      ├───────────────────►│  porta 8098  ├──────────────────────►
      │                    │              │
      │                    │  ingress ────┼── la console, dietro
      │                    │              │   l'autenticazione di HA
      │                    └──────────────┘
```

## Le due porte, che sono tutta la sicurezza

| | dove arriva | cosa si puo' fare |
|---|---|---|
| **ingress** | solo da Home Assistant, che ci mette davanti la sua autenticazione | fabbricare un codice di abbinamento, vedere i telefoni, staccarli, aprire gdahome in un browser |
| **8098** | l'unica che puo' finire esposta | chiedere se il ponte e' vivo, presentare un codice, aprire il filo con un segno gia' avuto |

Un codice di abbinamento **nasce solo dalla console**. Sulla porta esposta non
c'e' nessuna via per farne nascere uno: da li' si puo' soltanto presentarne uno
che esiste gia'. E' la differenza fra un ponte e una porta aperta.

## Come si mette su

**Se la repository e' privata**, l'indirizzo non funziona: Home Assistant va a
prendere gli archivi di add-on senza presentarsi, e da una repository privata
si sente rispondere «non esiste». Si installa a mano, ed e' altrettanto
semplice:

1. Si scarica il codice — **Code → Download ZIP** — e si copia la cartella
   `ponte` dentro la cartella `addons` di Home Assistant. Ci si arriva con
   l'add-on **Samba share**, con **Advanced SSH & Web Terminal**, o con
   **Studio Code Server**. Alla fine deve esserci `addons/ponte/config.yaml`.
2. **Impostazioni → Add-on → Negozio degli add-on**, menu in alto a destra →
   **Ricarica**. Compare una sezione **Local add-ons**.
3. Si installa. La prima volta ci mette qualche minuto, perche' se lo
   costruisce sul posto invece di scaricarlo gia' pronto.

**Se la repository e' pubblica**, si fa prima: **Impostazioni → Add-on →
Negozio degli add-on**, menu in alto a destra → **Archivi**, e si incolla
l'indirizzo della repository.

In tutti e due i casi, alla fine nella barra laterale compare **Il ponte**. E'
la console.

## Abbinare un telefono

Dalla console si preme **Fabbrica un codice**: compare un **quadretto**, che
vale **cinque minuti e una volta sola**. Si apre gdahome sul telefono, lo si
inquadra, e il telefono e' dentro. Da quel momento l'app entra da sola, e nella
console compare col suo nome e con un pallino verde quando e' collegata.

Dentro al quadretto non c'e' solo il codice: c'e' anche **dove sta questa
casa** — a quale centralino chiama, e su quali indirizzi la si trova stando sul
Wi-Fi. E' il motivo per cui inquadrando non si deve battere nient'altro,
nemmeno la prima volta e nemmeno da fuori.

Sotto al quadretto, per chi non puo' inquadrare, ci sono le stesse cose in
lettere: sedici, in quattro gruppi da quattro. Sono sedici e non otto apposta —
otto si indovinano provandole a raffica lontano da qui, e sedici no.

**Stacca** spegne un telefono subito: il filo aperto cade nello stesso istante,
e con quel segno non si rientra piu'.

## Da fuori casa

In casa l'app trova il ponte sulla porta 8098, e basta cosi'.

Da fuori il ponte **chiama lui**. Nell'opzione `centralino` si scrive
l'indirizzo di un centralino, e da quel momento il ponte apre un filo verso
quello e lo tiene aperto; i telefoni arrivano da quella parte. Non c'e' nessuna
porta da aprire sul router, nessun indirizzo pubblico da avere, nessuna VPN da
installare, e funziona anche a chi non ha ne' un dominio ne' un abbonamento.

Lasciando l'opzione vuota il ponte non chiama nessuno, e l'app funziona solo
sotto il Wi-Fi di casa. Per chi la casa la guarda dal divano va benissimo.

Il perche' di questa strada, e le tre che sono state scartate, stanno in
[`../docs/PIANO.md`](../docs/PIANO.md). In due righe: l'accesso remoto di Home
Assistant le porte degli add-on non le fa passare — e non e' cosa che si
configuri — mentre una VPN o un proxy inverso funzionano ma chiedono a chi usa
l'app di installare e configurare qualcosa, che e' esattamente cio' che questo
progetto ha promesso di non chiedere.

## Cosa puo' fare un telefono abbinato

Tutto quello che puo' fare il ponte, cioe' tutto quello che si puo' fare in
Home Assistant. Non c'e' un filtro per tipo di comando, e non c'e' apposta:
un filtro fatto per esclusione lascia sempre fuori qualcosa, e da' l'idea
sbagliata che il telefono sia limitato quando non lo e'.

Quello che c'e' al posto suo e' che un telefono entra **solo** se qualcuno gia'
dentro Home Assistant ha fabbricato un codice negli ultimi cinque minuti, e che
qualunque telefono si stacca da solo con un bottone.

C'e' una cosa che il ponte fa **da se'** per il telefono, senza girarla a
Home Assistant: la plancia. L'app fa girare la plancia vera di DashboardModern
dentro un WebView, e in Home Assistant non c'e' e non deve esserci nessuna
integrazione: i file della plancia stanno qui, in `plancia/` (li porta dentro
`strumenti/porta-la-plancia.mjs` da un checkout di `dashboardmodern-v2`), e
la configurazione la tiene il ponte in `/data/plancia.json`, rispondendo alla
pagina esattamente come risponderebbe l'integrazione
(`dashboardmodern/config/get`, `set`, `restore`: stesse regole contro le
perdite di dati, stesse cinque revisioni tenute). Il telefono chiede tutto sul
filo — `ponte/plancia` per sapere dove sta, `ponte/http` per i file — e le
chiamate REST della pagina, lo storico e le istantanee, passano dal Supervisor
col suo segno. Nient'altro passa di li'. Sta scritto in `src/commissioni.js`,
`src/plancia.js` e `src/configurazione.js`.

Le **segnalazioni** dell'app passano anche loro dal ponte, con
`ponte/segnalazioni/…`: il ponte le porta al centralino — presentandosi col
segreto della casa, lo stesso della chiamata — e il centralino le apre come
issue di GitHub per chi mantiene l'app. Qui non c'e' nessun gettone di
nessuno; una copia di quello che si e' scritto sta in
`/data/segnalazioni.json`, cosi' l'app vede subito qualcosa anche quando il
centralino e' lento. Senza centralino non c'e' dove spedire, e si dice cosi'.
Con `ponte/segnalazioni/allega` passano anche le foto e i video: arrivano
dall'app in base64 dentro il messaggio, e al centralino vanno cosi' come
sono, in binario. Dieci megabyte al massimo.

La **chat di assistenza** invece non passa da GitHub, ed e' quella della
plancia: gli otto comandi `dashboardmodern/chat/*` che nell'integrazione fa
`chat.py`, qui li fa `src/chat.js`. I quattro di chi chiede — stato, filo,
manda, dimentica — arrivano al centralino della chat della dashboard, che e'
un altro posto dal centralino di gdahome; i quattro di chi risponde, che
sono la coda di tutte le case, si fermano qui con una frase: quella coda si
apre dalla dashboard di chi mantiene, non da una casa.

Questa casa, per quel centralino, e' un nome di 128 bit e un segreto di 256
presi dal caso alla prima parola scritta, tenuti in `/data/chat.json`: niente
entita', niente indirizzi, nessun identificativo di questo Home Assistant, e
il segreto non esce dal ponte. Insieme alle parole parte un'etichetta di
quaranta caratteri — `plancia 1.4.19 ponte 0.18.0 app 1.0.2` — che e' quello
che chi risponde chiederebbe per primo. L'**app** usa la stessa chat, con
`ponte/chat/leggi` e `ponte/chat/scrivi`; un allegato no, e si dice dove
metterlo.

## Le opzioni

| | |
|---|---|
| `centralino` | dove chiamare per farsi raggiungere da fuori casa; vuoto = solo in casa |
| `porta_app` | la porta su cui bussa l'app (difetto: 8098) |
| `dispositivi_massimi` | quanti telefoni possono restare abbinati insieme (difetto: 10) |
| `minuti_del_codice` | quanto vive un codice di abbinamento (difetto: 5) |
| `giorni_di_silenzio` | dopo quanto un telefono sparito viene tolto da solo; zero vuol dire mai (difetto: 90) |
| `registro` | `debug`, `info`, `attenzione`, `errore` |

## I due sportelli della porta dell'app

| | | |
|---|---|---|
| `GET /salute` | — | dice solo che e' vivo |
| `POST /abbinamento` | un codice valido | `{"codice":"…","nome":"…","sistema":"ios"}` → il segno, una volta sola |
| `WS /casa` | il segno | la stretta di mano di Home Assistant, e poi il filo |

Chi si abbina riceve **quattro cose**, e servono tutte e quattro:

| | |
|---|---|
| `segno` | fa entrare. Qui ne resta solo l'impronta: chi ruba il file non entra |
| `chiave` | cifra il filo. Questa resta com'e', perche' per cifrare serve la chiave |
| `dispositivo` | il nome e l'identificativo del telefono, per la console |
| `ritorno` | **dove ribussare domani** |

`ritorno` e' il motivo per cui l'utente non batte nessun indirizzo: dice
l'identificativo di questa casa al centralino, l'indirizzo del centralino, e
gli indirizzi su cui questa casa si trova sulla rete locale — cosi' il
telefono, quando e' sul divano, va dritto invece di fare il giro del mondo.

Gli indirizzi di rete locale il ponte li chiede al Supervisor, ed e' l'unica
cosa per cui serve `hassio_api`. Se non arrivano — permesso tolto, Supervisor
vecchio, prova su un computer — si perde la strada veloce e non altro: si
passa sempre dal centralino, che e' piu' lento e funziona uguale.

Sul filo il ponte **si presenta come Home Assistant**: manda `auth_required`,
aspetta `auth` col segno del ponte al posto di quello di Home Assistant, e
risponde `auth_ok`. Da li' in poi non guarda piu' dentro a niente. Vuol dire che
qualunque codice che sa parlare con Home Assistant funziona di qui senza
cambiare una riga.

## gdahome da aprire in un browser

Sulla porta dell'ingress, sotto `/app/`, il ponte serve **gdahome**: la stessa
app del telefono, compilata per il browser. Dalla console c'e' il bottone che la
apre.

E' il link che mancava: chi ha l'add-on acceso ha gia' l'app, e non deve
installare niente da nessuna parte. Sta dietro l'ingress, quindi ci arriva solo
chi e' gia' entrato in Home Assistant — nessuna porta nuova, niente che si veda
da fuori.

I file stanno in `ponte/app/`, e ce li mette `strumenti/porta-l-app.mjs` da un
`flutter build web`. Senza quella cartella il ponte risponde che l'app non c'e'
e la console non mostra il bottone: un link che porta a un 404 e' peggio di
nessun link.

Una cosa da dire, perche' sembra un difetto e non lo e': se Home Assistant e'
aperta su un indirizzo `http`, **la plancia dentro l'app web non si disegna**.
La serve un service worker, e i service worker i browser li fanno girare solo su
`https` o `localhost`. Tutto il resto dell'app funziona, e sia la console sia
l'app lo dicono a schermo. Sul telefono non succede: li' il server sta dentro
l'app.

## Le foto: due cartelle

Quando si sceglie una foto — quella dell'auto, il ritratto di un
elettrodomestico — se ne guardano due:

| | dove sta | cosa si puo' fare | indirizzo che si scrive |
|---|---|---|---|
| **il ponte** | `/data/www` dell'add-on | leggere e caricare | `/dashboardmodern_static/www/…` |
| **Home Assistant** | `config/www`, montata in sola lettura | solo leggere | `/local/…` |

La seconda e' quella che serviva davvero: chi ha una casa da qualche anno ha li'
dentro le foto delle auto, i loghi e gli sfondi, e la plancia li chiama
`/local/…` da sempre. Senza, la maschera delle foto diceva «nessuna foto,
ancora» a chi ne aveva duecento.

Si legge e non si scrive, e non e' prudenza generica: in quella cartella ci
sono le automazioni, i temi e i segreti di chi ci abita. Un add-on che ci
lascia dentro file e' un add-on che, il giorno che si disinstalla, lascia
sporco in casa d'altri. Quello che si carica dall'app finisce nella cartella
del ponte, sempre.

`/local/…` lo serve il ponte anche alla plancia dentro l'app, dove Home
Assistant non c'e' a servirlo: cosi' una configurazione fatta dall'app mostra la
stessa foto anche nella plancia dentro Home Assistant, e viceversa.

Serve `map: [homeassistant_config:ro]` nel manifesto: un add-on aggiornato ma
non riavviato quella cartella non la vede ancora, e allora quella meta' della
maschera semplicemente non compare.

## Cosa finisce sul disco

Solo `/data/dispositivi.json`, e dentro c'e' l'**impronta** di ogni segno, mai
il segno. Chi legge quel file — o un backup dimenticato in giro — non entra in
casa di nessuno.

L'ora dell'ultima visita si scrive al massimo ogni cinque minuti: un telefono
collegato fa passare messaggi in continuazione, e scriverla ogni volta vorrebbe
dire scrivere sulla scheda SD di un Raspberry qualche volta al secondo.

## Le prove

```bash
cd ponte
npm test
```

Girano senza rete e senza Home Assistant: c'e' una Home Assistant finta che fa
la stretta di mano vera, un telefono finto che e' il WebSocket cliente di Node,
e in mezzo il ponte vero. Duecentoventinove prove, qualche secondo.

Le due che guardano `ponte/app/` si saltano da sole quando quella cartella non
c'e': chi lavora sul ponte non ha per forza un'app costruita sotto mano, e un
rosso li' insegnerebbe soltanto a non guardare i rossi.

Non c'e' niente da installare — `npm install` non serve, il ponte non ha
dipendenze: la presa WebSocket e' scritta in `src/presa.js`, e il resto viene
da Node.
