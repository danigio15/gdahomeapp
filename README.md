<p align="center">
  <img src="docs/immagini/banner.png" alt="gdahome" width="640">
</p>

<h3 align="center">La tua casa in una plancia.</h3>

<p align="center">
  Home Assistant sul telefono, in una pagina sola fatta per essere guardata:<br>
  le luci, il clima, le tapparelle, le telecamere, i consumi, le persone.
</p>

<p align="center">
  <a href="https://gdahome.org"><b>Il sito</b></a>
  &nbsp;·&nbsp;
  <a href="https://webapp.gdahome.org"><b>Aprila dal browser</b></a>
  &nbsp;·&nbsp;
  <a href="COME_PROVARLA.md"><b>Come si prova</b></a>
  &nbsp;·&nbsp;
  <a href="https://gdahome.org/privacy.html"><b>Privacy</b></a>
</p>

<p align="center">
  <a href="https://github.com/danigio15/gdahomeapp/releases"><img src="https://img.shields.io/github/v/release/danigio15/gdahomeapp?label=versione&color=0ea5e9" alt="Ultima versione"></a>
  <a href="https://github.com/danigio15/gdahomeapp/actions/workflows/prove.yml"><img src="https://github.com/danigio15/gdahomeapp/actions/workflows/prove.yml/badge.svg" alt="Le prove"></a>
  <a href="https://github.com/danigio15/gdahomeapp/blob/contatori/traffico.json"><img src="https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Fdanigio15%2Fgdahomeapp%2Fcontatori%2Fbollino-case.json&cacheSeconds=3600" alt="Case con gdahome"></a>
  <a href="https://github.com/danigio15/gdahomeapp/blob/contatori/traffico.json"><img src="https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Fdanigio15%2Fgdahomeapp%2Fcontatori%2Fbollino-scaricamenti.json&cacheSeconds=3600" alt="Scaricamenti"></a>
  <a href="https://www.paypal.com/paypalme/giovannidaniello15"><img src="https://img.shields.io/badge/PayPal-sostieni-003087?logo=paypal&logoColor=white" alt="Sostieni il progetto con PayPal"></a>
  <img src="https://img.shields.io/badge/Home%20Assistant-OS%20%7C%20Supervised-18BCF2" alt="Home Assistant OS o Supervised">
  <img src="https://img.shields.io/badge/Android%20%C2%B7%20iPhone%20%C2%B7%20browser-16a34a" alt="Android, iPhone, browser">
  <img src="https://img.shields.io/badge/UI-Italiano%20%7C%20English-16a34a" alt="Italiano e inglese">
  <a href="LICENSE"><img src="https://img.shields.io/badge/licenza-proprietaria-64748b" alt="Licenza proprietaria"></a>
</p>


<p align="center">
  <img src="docs/immagini/3-le-luci.png" alt="Le luci" width="31%">
  <img src="docs/immagini/4-il-clima.png" alt="Il clima" width="31%">
  <img src="docs/immagini/1-la-plancia.png" alt="La plancia" width="31%">
</p>

---

Quello che in Home Assistant sta in dieci pagine diverse, qui sta dove lo
cerchi. Sono due pezzi, e lavorano insieme:

- **un add-on** che si installa in Home Assistant, serve la plancia al telefono
  e tiene il segreto della casa — quello non esce mai da lì;
- **un'app** per Android, iPhone e browser, che si abbina inquadrando un QR
  code: nessuna password da inserire, nessun token da copiare, nessuna porta da
  aprire sul router.

## Metterla in casa

Serve un Home Assistant che abbia il **Supervisor**: **Home Assistant OS** o
**Home Assistant Supervised**. Su **Container** — Home Assistant in Docker — il
negozio degli add-on non esiste, e non si installa nessun add-on di nessuno:
[il perché, e cosa si può fare](#domande-che-arrivano-davvero).

**Impostazioni → Add-on → Negozio degli add-on**, i tre puntini in alto a
destra → **Archivi**, e si incolla:

```
https://github.com/danigio15/gdahomeapp
```

Nell'elenco compare una sezione **gdahome** con dentro l'add-on **gdahome** —
il pezzo dentro il codice continua a chiamarsi «il ponte», nel negozio no. Si
installa e si avvia: la prima volta ci mette qualche minuto — su un Raspberry
anche dieci — perché Home Assistant non se lo scarica già pronto, se lo
costruisce sul posto. Le volte dopo è immediato, e gli aggiornamenti arrivano
come per ogni altro add-on.

Poi si apre **gdahome** dalla barra laterale e si preme **Genera QR code**.
Dal telefono si inquadra, e la casa è abbinata.

Tutto passo per passo, e cosa guardare una volta dentro, sta in
**[`COME_PROVARLA.md`](COME_PROVARLA.md)**.

**C'è un video** di tre minuti scarsi che fa vedere tutta questa strada — il
negozio, l'archivio da incollare, Installa, Avvia, il QR code da inquadrare e
la plancia sul telefono — più due corti da mettere sui social, uno quadrato e
uno in piedi. Tutti e tre **in italiano e in inglese**:
[`strumenti/video/`](strumenti/video/README.md).

## Quanto costa: niente

L'add-on, la plancia, l'app, l'accesso da fuori casa, le segnalazioni e la
chat di assistenza: **tutto gratis**. Nessun abbonamento, nessun limite a
pagamento, nessun account da fare. Nell'app non c'è nessun tasto che chiede
soldi, ed è una scelta scritta: quello che serve a vedere e comandare la
propria casa non si paga mai — l'accesso da fuori compreso, che tenerlo in
piedi costa zero ([`nuvola/`](nuvola/README.md)).

**Gratis però non vuol dire finito.** Gli aiutanti, lo Zigbee, il mago delle
automazioni non ci sono ancora: sono in fila, e il lavoro va avanti finché c'è
chi lo tiene in piedi. Chi vuole dare una mano ha il tasto **Sponsor** qui in
cima alla pagina: ogni sostegno è una di quelle cose che arriva prima. Chi non
vuole o non può, la usa lo stesso — tutta, per sempre.

Un sostegno non sblocca niente, e non deve: se sbloccasse qualcosa, «tutto
gratis» sarebbe una frase da togliere. Come è fatto, e cosa si è scelto di
non vendere, sta in [`docs/SOSTEGNO.md`](docs/SOSTEGNO.md).

## Come ci si arriva

```
                     ┌── in casa ──►  192.168.1.50:8098 ────────────┐
   ┌─────────────┐   │                                              ▼
   │    l'app    │───┤                                      ┌──────────────┐     ┌──────────────────┐
   │ Android/iOS │   │          ┌──────────────┐            │   il ponte   │────►│  Home Assistant  │
   │   browser   │   └─ da fuori►│ il centralino│◄───────────┤   (add-on)   │     │      Core        │
   └─────────────┘              └──────────────┘   chiama    └──────────────┘     └──────────────────┘
    segno + chiave               instrada e          lui                         SUPERVISOR_TOKEN
    (revocabili)                 non capisce                                     (non esce da lì)
```

**La casa chiama fuori.** È tutto il punto. Non c'è nessuna porta da aprire sul
router, nessun indirizzo pubblico da avere, nessuna VPN da installare: il ponte
apre lui un filo verso il centralino e lo tiene aperto, e i telefoni arrivano
da quella parte.

**Il centralino instrada e non può leggere.** Fra il telefono e la casa c'è uno
scambio di chiavi che gli passa davanti senza che lui ne ricavi niente, e da lì
in poi ogni messaggio è cifrato punta a punta. Non è una promessa: è una prova
che registra tutto quello che lo attraversa e controlla che non ci sia dentro
niente di leggibile.

Quello di gdahome è `tramite.gdahome.org`, e non c'è niente da configurare.
**Chi preferisce il proprio** se ne accende uno: [`nuvola/`](nuvola/README.md)
è la versione per Cloudflare — piano gratuito, indirizzo compreso —,
[`centralino/`](centralino/README.md) la stessa cosa in Node per una macchina
propria. Sono intercambiabili, e la prova dal vivo passa identica contro tutti
e due.

**Tre strade, una casa sola.** Quale funziona dipende da dove sta il telefono
adesso, e cambia mentre l'app è aperta: si esce dal portone e la prima smette
di rispondere a metà frase. L'app le chiede tutte insieme e tiene la prima che
risponde — e lo rifà a ogni tentativo di riconnessione, non una volta
all'avvio. Con una regola in più: in casa **vince sempre la strada diretta**,
se no ogni comando farebbe il giro del mondo per arrivare a tre metri.

## Com'è fatta

| | dove sta | cosa fa |
|---|---|---|
| **il ponte** | [`ponte/`](ponte/README.md) | l'add-on: fa entrare l'app da dentro e da fuori casa, serve la plancia, tiene la configurazione |
| **l'app** | [`app/`](app/README.md) | Flutter, per Android, iPhone e browser: si abbina, si collega, comanda |
| **la plancia** | `ponte/plancia/` | una copia di [DashboardModern](https://github.com/danigio15/dashboardmodern-v2), **con la sua licenza**, che il ponte serve dal disco |
| **il centralino** | [`nuvola/`](nuvola/README.md), [`centralino/`](centralino/README.md) | fa incontrare un telefono e la sua casa, senza capire niente di quello che si dicono |
| **il collaudo** | [`collaudo/`](collaudo/README.md) | guarda l'app davvero, con un ponte vero e le fotografie di ogni schermata |
| **il sito** | [`sito/`](sito/README.md) | gdahome.org: racconta il progetto, e ne fa toccare **la plancia vera** da un browser |

### La plancia è quella vera

L'app **non rifà** la plancia: mostra quella di DashboardModern — le sue
tessere, le sue finestre, la sua barra, la sua configurazione — dentro un
WebView. Prima si era provato a rifarla in Flutter: non era lei.

E arriva **dall'add-on**. In Home Assistant non serve nessuna integrazione: i
file della plancia stanno nel ponte, in [`ponte/plancia/`](ponte/plancia/), e
tutto quello che la plancia chiedeva all'integrazione lo fa il ponte
rispondendo esattamente come risponderebbe lei — la configurazione, il catalogo
dei dispositivi, le foto, la chat.

La plancia **si sviluppa qui**: fino a settembre 2026 arrivava da una seconda
repository e questa ne teneva una copia sigillata; adesso è una cartella come
le altre, e i suoi difetti si correggono da qui. Dopo averla toccata il sigillo
si rifà con `node strumenti/sigilla-la-plancia.mjs` — e se ci si dimentica lo
dicono le prove, non le case.

Ogni file porta dentro la propria impronta, e la console dice se la plancia che
hai è **quella originale** o se qualcuno l'ha toccata. Una copia modificata non
viene bloccata: viene detta.

### Perché un ponte, e non un token incollato a mano

Un'app sul telefono deve entrare in Home Assistant, e le due strade classiche
sono sbagliate entrambe per un'app che si dà anche a qualcun altro:

- **un token lungo incollato a mano** vive anni, vale tutto, e per revocarlo
  bisogna ricordarsi quale dei sette in elenco era quello del telefono perso;
- **l'autenticazione di Home Assistant dentro l'app** mette in mano al telefono
  un segno di aggiornamento vero, e da fuori casa non risolve niente comunque.

Il ponte prende una terza strada: il telefono riceve **un segno suo**, che vale
solo per quel ponte e per quella casa, si toglie con un bottone, e il segreto
di Home Assistant non esce mai dall'add-on. Il resto — le due porte,
l'abbinamento, cosa finisce sul disco — sta in
[`ponte/README.md`](ponte/README.md).

## Cosa fa, oggi

| | |
|---|---|
| ✅ | **Un QR code e basta**: nessun indirizzo, nessuna credenziale di Home Assistant |
| ✅ | **Dentro e fuori casa**: tre strade per la stessa casa, scelte da sole e ricalcolate a ogni riconnessione |
| ✅ | **Cifrato punta a punta**: il centralino instrada e non può leggere |
| ✅ | **Più case**: ognuna col suo segno, si passa dall'una all'altra senza riabbinare |
| ✅ | **Più di una plancia** per casa, ognuna con la sua configurazione, le sue sezioni, le sue stanze — e ognuna compare fra le «Plance» di Home Assistant |
| ✅ | **La plancia si configura dal telefono**: la sua pagina Config, intatta, dentro l'app |
| ✅ | **Segnalazioni** con foto e video, e una **chat di assistenza** — quella della dashboard, che il ponte fa da sé |
| ✅ | **Gli aggiornamenti di casa nel menu**, col numero addosso alla voce: Home Assistant, gli add-on, gdahome, i firmware. Si installano da lì, e da lì si riavvia la casa |
| ✅ | **Dal browser**, senza installare niente: la stessa app, che si adatta allo schermo |
| ✅ | **822 prove** — 421 sul ponte, 85 sul centralino, 16 sulla nuvola, 300 sull'app — senza rete, senza Home Assistant, senza telefono |
| ⬜ | Gli aiutanti di Home Assistant, nativi nell'app |
| ⬜ | Zigbee: abbinare un dispositivo da qui (ZHA e Zigbee2MQTT) |
| ⬜ | Le automazioni, scritte dall'app |
| ⬜ | Notifiche, impronta digitale, l'app sul Play Store per tutti |

## Domande che arrivano davvero

**Si installa su Home Assistant in Docker?**
No, e non e' una scelta nostra: su **Home Assistant Container** — l'immagine
Docker, quella che si tira su con `docker run` o un `compose` — il negozio
degli add-on **non esiste**. Non manca gdahome: manca il Supervisor, che e' il
pezzo che installa e fa girare gli add-on, e senza di lui nessun add-on si
installa. gdahome ha bisogno di lui anche per lavorare: si presenta a Home
Assistant col segno che il Supervisor gli da' (`SUPERVISOR_TOKEN`), e la sua
scheda — quella dei QR code — sta dietro l'**ingress**, cioe' dietro
l'autenticazione di Home Assistant.

Le installazioni che hanno il Supervisor sono due, e su tutt'e due gdahome va:

| | add-on |
|---|---|
| **Home Assistant OS** — il sistema completo, su Raspberry, su un mini PC, in una macchina virtuale | ✅ |
| **Home Assistant Supervised** — Debian piu' l'installatore ufficiale: e' la strada di chi vuole restare padrone della sua macchina | ✅ |
| **Home Assistant Container** — l'immagine Docker da sola | ❌ nessun add-on, di nessuno |
| **Home Assistant Core** — in un ambiente Python | ❌ idem |

Chi oggi ha Container e vuole gdahome ha due strade: passare a **Supervised**
sulla stessa macchina — Docker ce l'ha gia' — oppure tenere Home Assistant
dov'e'. Un gdahome che gira come container a se' stante oggi non c'e'; il
lavoro che ci vorrebbe e' scritto, e non e' un'opzione da accendere: un segno
a lunga vita al posto di quello del Supervisor, la scheda su una porta vera
**con un'autenticazione propria** — oggi la protegge l'ingress, e senza
ingress i codici di abbinamento resterebbero esposti — e l'aggiornamento
automatico da rifare. Se la domanda arriva da abbastanza persone, si fa.

**L'add-on serve solo per usare l'app?**
No: serve anche **senza l'app**. gdahome porta dentro la plancia di
DashboardModern, e in Home Assistant compare come voce nella barra laterale —
una per plancia. Da li' si guarda e si configura da qualunque browser, senza
installare nessuna integrazione. L'app e' l'altra metà: la stessa plancia sul
telefono, e da fuori casa senza aprire niente sul router.

Quindi: **con l'app** e' una casa in tasca; **senza**, e' DashboardModern che
si installa come add-on invece che da HACS.

**Serve avere l'integrazione DashboardModern installata?**
No, e non e' nemmeno consigliato averle tutte e due: la plancia sta dentro
l'add-on, e tutto quello che chiedeva all'integrazione lo fa il ponte. Chi
l'integrazione ce l'ha già, e ci ha configurato la plancia, **non ricomincia da
zero**: alla prima apertura gdahome si va a prendere quella configurazione e la
adotta.

**E' gratis?**
Sì. L'add-on, la plancia e l'app si usano senza pagare niente e senza conti da
aprire. Se ti è utile e puoi permettertelo, [dai una mano](#sostieni-il-progetto):
non cambia niente di quello che funziona, ma cambia quanto tempo ci si può
mettere.

**Quelle due targhette in cima contano cosa?**
Le **case**: quante, in quattordici giorni, hanno scaricato gdahome da qui.
Non è un sondaggio e non è telemetria — dall'add-on non esce niente. È che un
add-on non si scarica come un'integrazione: si aggiunge questa repository fra
gli Archivi, e da lì in poi è **Home Assistant a clonarla** ogni volta che
rinfresca il negozio. Quei cloni GitHub li conta, e sono le case accese e
aggiornate: chi spegne tutto sparisce dal conto in un paio di giorni. Gli
**scaricamenti** invece sono tutti i passaggi da quando si conta, e crescono e
basta. I numeri li rifà [una corsa al
giorno](.github/workflows/quante-case.yml), e la loro storia sta [sul ramo
`contatori`](https://github.com/danigio15/gdahomeapp/blob/contatori/traffico.json).

**Dove finiscono le cose che segnalo?**
Nelle [issue di questa repository](https://github.com/danigio15/gdahomeapp/issues).
Si scrivono dall'app — **Segnalazioni** nel menu, con foto e video — e passano
dal ponte al centralino, che apre la issue: **nessun conto GitHub da avere**,
nessun token da incollare. Per chiedere aiuto invece che segnalare un difetto
c'è **Assistenza**, che è una conversazione privata e non finisce su una pagina
pubblica.

## Il sito

Su **[gdahome.org](https://gdahome.org)**, e in [`sito/`](sito/README.md), c'e'
il posto dove il progetto si racconta a chi non l'ha mai visto: com'e' fatto e
cosa fa. E in mezzo, il pezzo per cui esiste: **la plancia vera, che ci gira
dentro**.

Non una riproduzione e non delle fotografie: DashboardModern, gli stessi file
che stanno nell'add-on, in un riquadro dentro la pagina. Le trenta voci della
barra sono le sue, le tessere sono le sue, i ritratti delle persone sono i
suoi. Chi arriva dal sito all'app ritrova esattamente quello che ha visto.

Una plancia vuole un Home Assistant dietro, e un sito non ce l'ha. Ma la
plancia ha un gancio fatto apposta — lo stesso con cui l'app sul telefono le
cuce addosso il proprio filo — e di qua dal gancio c'e'
`sito/casa-in-pagina.js`: una Home Assistant finta dentro la pagina, che
risponde come quella del collaudo e ha dentro la stessa casa demo. Si accende
una luce e si accende, si chiude una tapparella e scende.

Sul sito c'e' anche l'informativa — `sito/privacy.html`, l'indirizzo che il
Play Store tiene da parte — e una prova tiene lei e `docs/PRIVACY.md` allineate
sezione per sezione, perche' quella che si corregge, quando si corregge, e'
quasi sempre la seconda.

Si pubblica **da dove si pubblica tutto il resto**: si sposta il segno
(**Actions → «Il tramite»**) e la macchina di gdahome.org scambia da sola entro
dieci minuti, dopo aver rigirato le prove. Non c'e' nessun altro posto e
nessun altro bottone. Quello che non si scrive a mano — la plancia, il marchio,
le icone, i caratteri, la casa demo — lo porta
`node strumenti/porta-nel-sito.mjs`, che gira sia qui che sulla macchina; e che
il sito stia in piedi lo dice `node collaudo/guarda-il-sito.mjs`, con un
browser vero.

## Le prove

Nessuna prova ha bisogno di rete, di Home Assistant o di un telefono: il ponte
ha una Home Assistant finta che fa la stretta di mano vera, e l'app ha un ponte
finto che fa lo stesso. È l'unico modo di avere prove che girino davvero a ogni
commit.

```bash
npm test                        # ponte, centralino e nuvola: 522 prove
npm run test:ponte              # il ponte: 421 prove, due secondi
cd app && flutter test          # l'app: 300 prove, mezzo minuto

npm run format:check            # prettier, sui file nostri
cd app && flutter analyze       # l'analisi di Dart
```

Per il ponte non serve `npm install`: dipendenze non ne ha. `npm install` serve
solo per `prettier`.

Fra quelle dell'app ce n'è un gruppo diverso dagli altri, in
`app/test/integrazione/`. Uno accende il **ponte vero** — lo stesso processo
dell'add-on — contro una Home Assistant finta, e ci fa passare il **cliente
vero** dell'app. L'altro, `da_fuori_test.dart`, accende la catena intera:

```
    app (Dart)  ──►  centralino (node)  ◄──  ponte (node)  ──►  HA finta
```

e lì il telefono **non ha nessun indirizzo della casa**: ha la riga che ha
letto da un QR code, e basta quella. È la differenza fra «funziona se apri
una porta sul router» e «funziona», ed è l'unica prova che la dimostra per
intero — tutte le altre hanno un finto proprio nel punto che conta. La stessa
prova gira anche contro il centralino su Cloudflare:

```bash
cd nuvola && npx wrangler dev &
cd app && CENTRALINO_ESTERNO=ws://127.0.0.1:8787 flutter test test/integrazione/da_fuori_test.dart
```

E per **guardarla** girare, con le fotografie delle schermate, c'è
[`collaudo/`](collaudo/README.md).

## Sostieni il progetto

gdahome lo faccio nel tempo libero, e resta gratuito. Chi vuole dare una mano
può farlo da qui:

<p align="center">
  <a href="https://www.paypal.com/paypalme/giovannidaniello15"><img src="https://img.shields.io/badge/PAYPAL-ME-1f8fdd?style=for-the-badge&logo=paypal&logoColor=white&labelColor=555555" alt="Sostieni il progetto con PayPal"></a>
  &nbsp;
  <a href="https://github.com/sponsors/danigio15"><img src="https://img.shields.io/badge/GITHUB-SPONSORS-ea4aaa?style=for-the-badge&logo=githubsponsors&logoColor=white&labelColor=555555" alt="Sostieni il progetto su GitHub Sponsors"></a>
</p>

Più sostegno vuol dire una cosa sola, e concreta: **più tempo su questo** —
assistenza più rapida, correzioni più rapide, e prove su dispositivi veri
invece che su un emulatore.

E ci sono due modi di aiutare che non costano niente: una ⭐ qui sopra, e una
[segnalazione scritta bene](https://github.com/danigio15/gdahomeapp/issues) —
cosa stavi facendo, cosa ti aspettavi, cosa è successo. Le migliori correzioni
di questo progetto sono nate così.

## La licenza, e le due repository

Il codice di gdahome è in questa repository, con la sua licenza
([`LICENSE`](LICENSE)).

La plancia in `ponte/plancia/` **non è nostra**: è una copia di
[DashboardModern](https://github.com/danigio15/dashboardmodern-v2), portata
dentro senza toccarne una riga e con la sua licenza. Il nome e il marchio di
gdahome si applicano quando i file vengono serviti, non nei file: così
l'aggiornamento successivo della plancia entra senza dover rifare niente.

Questa repository è **pubblica**, e deve restarlo: è così che Home Assistant
scarica un add-on — il Supervisor va a prendere gli archivi senza presentarsi,
e da una repository privata si sente rispondere «non esiste».
