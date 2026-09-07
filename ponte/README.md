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
| **ingress** | solo da Home Assistant, che ci mette davanti la sua autenticazione | fabbricare un codice di abbinamento, vedere i telefoni, staccarli |
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

Dalla console si preme **Fabbrica un codice**: escono otto lettere, che valgono
**cinque minuti e una volta sola**. Si battono sull'app, e il telefono e'
dentro. Da quel momento l'app entra da sola, e nella console compare col suo
nome e con un pallino verde quando e' collegata.

**Stacca** spegne un telefono subito: il filo aperto cade nello stesso istante,
e con quel segno non si rientra piu'.

## Da fuori casa

In casa l'app trova il ponte sulla porta 8098 e basta cosi'. Da fuori serve che
qualcuno faccia arrivare il traffico fino a quella porta, e il ponte **non apre
niente per conto suo** — non e' cosa che un add-on debba decidere al posto di
chi installa. Le tre strade, in ordine di quanto sono facili per chi usa l'app:

* **L'accesso remoto di Home Assistant** (Nabu Casa): niente da configurare,
  abbonamento mensile;
* **una VPN** (WireGuard, Tailscale): gratis e sicura, ma va messa su ogni
  telefono;
* **un proxy inverso** con il proprio dominio e il proprio certificato.

## Cosa puo' fare un telefono abbinato

Tutto quello che puo' fare il ponte, cioe' tutto quello che si puo' fare in
Home Assistant. Non c'e' un filtro per tipo di comando, e non c'e' apposta:
un filtro fatto per esclusione lascia sempre fuori qualcosa, e da' l'idea
sbagliata che il telefono sia limitato quando non lo e'.

Quello che c'e' al posto suo e' che un telefono entra **solo** se qualcuno gia'
dentro Home Assistant ha fabbricato un codice negli ultimi cinque minuti, e che
qualunque telefono si stacca da solo con un bottone.

## Le opzioni

| | |
|---|---|
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

Sul filo il ponte **si presenta come Home Assistant**: manda `auth_required`,
aspetta `auth` col segno del ponte al posto di quello di Home Assistant, e
risponde `auth_ok`. Da li' in poi non guarda piu' dentro a niente. Vuol dire che
qualunque codice che sa parlare con Home Assistant funziona di qui senza
cambiare una riga.

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
e in mezzo il ponte vero. Sessanta prove, meno di un secondo.

Non c'e' niente da installare — `npm install` non serve, il ponte non ha
dipendenze: la presa WebSocket e' scritta in `src/presa.js`, e il resto viene
da Node.
