# GDA Home

Un'app per Android e iPhone che fa vedere la casa come una plancia, e che sa
fare le tre cose che in Home Assistant stanno nascoste in fondo a un menu:
**abbinare un dispositivo Zigbee**, **scrivere un'automazione**, **creare un
aiutante**. Tutto quello che si crea da qui compare nella plancia, perche' sono
entita' di Home Assistant come le altre.

> **Stato: fase 1 chiusa, plancia compresa.** Il ponte c'e'. L'app tiene piu'
> case, entra in ognuna **da dentro e da fuori** senza che l'utente tocchi
> niente, e ha la sua home. Si abbina **inquadrando un quadretto**: nessun
> codice da battere, nessun indirizzo, nessuna credenziale di Home Assistant.
> La plancia c'e': la home e' la plancia, e le sue pagine stanno nel menu. Le
> tre funzioni nuove — aiutanti, Zigbee, automazioni — sono le fasi 2, 3 e 4.

## Metterla in casa

L'add-on si installa **dal negozio di Home Assistant**: Impostazioni → Add-on →
Negozio degli add-on → i tre puntini in alto a destra → **Archivi**, e si
incolla

```
https://github.com/danigio15/gdahomeapp
```

Compare una sezione **gdahome** con dentro **Il ponte**. Si installa — la prima
volta ci mette qualche minuto, perche' Home Assistant se lo costruisce sul
posto — e nella barra laterale compare la sua console. Da li' si fabbrica il
quadretto da inquadrare col telefono, e la plancia compare fra le **Plance**
di Home Assistant.

I dettagli, i permessi che l'add-on chiede e perche', stanno in
[`ponte/README.md`](ponte/README.md).

## Come ci si arriva

```
                    ┌── in casa ──►  192.168.1.50:8098 ─────────────┐
   ┌─────────────┐  │                                               ▼
   │    l'app    │──┤                                       ┌──────────────┐     ┌──────────────────┐
   │ Android/iOS │  │            ┌──────────────┐           │   il ponte   │────►│  Home Assistant  │
   └─────────────┘  └─ da fuori ─►│ il centralino│◄──────────┤   (add-on)   │     │      Core        │
    segno + chiave                └──────────────┘  chiama   └──────────────┘     └──────────────────┘
    (revocabili)                   instrada e          lui                        SUPERVISOR_TOKEN
                                   non capisce                                    (non esce da li')
```

**La casa chiama fuori.** E' tutto il punto. Non c'e' nessuna porta da aprire
sul router, nessun indirizzo pubblico da avere, nessuna VPN da installare: il
ponte apre lui un filo verso il centralino e lo tiene aperto, e i telefoni
arrivano da quella parte.

Il centralino **instrada e non puo' leggere**. Fra il telefono e la casa c'e'
uno scambio di chiavi che passa da lui senza che lui ne ricavi niente, e da li'
in poi ogni messaggio e' cifrato punta a punta. Non e' una promessa: e' una
prova che registra tutto quello che lo attraversa e controlla che non ci sia
dentro niente di leggibile.

E il centralino **non costa niente**: gira su Cloudflare, piano gratuito,
indirizzo compreso — [`nuvola/`](nuvola/README.md). Chi preferisce il proprio
ha la stessa cosa in Node in [`centralino/`](centralino/README.md); sono
intercambiabili, e la prova dal vivo passa identica contro tutti e due.

**Tre strade, una casa sola.** Quale funziona dipende da dove sta il telefono
adesso, e cambia mentre l'app e' aperta: si esce dal portone e la prima smette
di rispondere a meta' frase. L'app le chiede tutte insieme e tiene la prima che
risponde — e lo rifa' **a ogni tentativo di riconnessione**, non una volta
all'avvio. Con una regola in piu': in casa **vince sempre la strada diretta**,
se no ogni comando farebbe il giro del mondo per arrivare a tre metri.

| | dove sta | cosa fa |
|---|---|---|
| **il ponte** | `ponte/` | l'add-on di Home Assistant che fa entrare l'app, da dentro e da fuori casa |
| **il centralino** | `nuvola/`, `centralino/` | fa incontrare un telefono e la sua casa, senza capire niente di quello che si dicono |
| **l'app** | `app/` | Flutter, per Android e iPhone: si abbina, si collega, comanda |
| **la plancia** | `ponte/plancia/` | le ventitre sezioni che gia' esistono e funzionano: una copia di [DashboardModern](https://github.com/danigio15/dashboardmodern-v2), **con la sua licenza**, che il ponte serve dal disco |

## Perche' un ponte, e non un segno incollato a mano

Un'app sul telefono deve entrare in Home Assistant, e le due strade classiche
sono sbagliate tutte e due per un'app che si da' anche a qualcun altro:

* **un segno lungo incollato a mano** vive anni, vale tutto, e per revocarlo
  bisogna ricordarsi quale dei sette in elenco era quello del telefono perso;
* **l'autenticazione di Home Assistant dentro l'app** mette in mano al telefono
  un segno di aggiornamento vero, e da fuori casa non risolve niente comunque.

Il ponte prende una terza strada: il telefono riceve **un segno suo**, che vale
solo per quel ponte e per quella casa, si stacca con un bottone, e il segreto
di Home Assistant non esce mai dall'add-on.

Il resto — le due porte, l'abbinamento, cosa finisce sul disco — sta in
[`ponte/README.md`](ponte/README.md).

## Cosa c'e' gia', e cosa no

| | |
|---|---|
| ✅ | Il ponte: abbinamento, revoca, filo verso Home Assistant, console dentro HA |
| ✅ | **Otto lettere e basta**: nessun indirizzo, nessuna credenziale di Home Assistant |
| ✅ | **Il centralino**: la casa chiama fuori, e da fuori si entra senza configurare niente |
| ✅ | **Cifrato punta a punta**: il centralino instrada e non puo' leggere |
| ✅ | **Piu' case**: ognuna col suo segno, si passa dall'una all'altra senza riabbinare |
| ✅ | **Dentro e fuori casa**: tre strade per la stessa istanza, scelte da sole |
| ✅ | Il filo: si rialza da solo, cambia approdo, rifa' le sottoscrizioni cadute |
| ✅ | **La plancia dentro l'app**: quella vera di DashboardModern, in un WebView; i file e la configurazione li ha l'add-on, in Home Assistant non serve niente |
| ✅ | I dispositivi: tutte le entita' divise per dominio, con gli interruttori |
| ✅ | **Segnalazioni** nell'app: arrivano a chi la fa come issue di GitHub, passando dal ponte e dal centralino, con la diagnostica raccolta da sola |
| ✅ | **La chat di assistenza**: quella della dashboard, che non passa da GitHub — la fa il ponte (`ponte/src/chat.js`), e si apre dalla plancia come dall'app |
| ✅ | **Piu' di una plancia**: come una seconda istanza dell'integrazione nella dashboard — ognuna con la sua configurazione, le sue sezioni, le sue stanze. Si aggiungono dalla scheda dell'add-on o dall'app (`ponte/src/plance.js`), e nell'app si scelgono dalla barra |
| ✅ | **Una voce per plancia fra le «Plance» di Home Assistant**: quello che faceva l'integrazione, adesso lo fa il ponte (`ponte/src/plance-in-casa.js`) — chi apre Home Assistant trova la sua plancia nella barra laterale, dov'e' sempre stata |
| ✅ | **La console dell'assistenza**: la coda di tutte le case, per chi risponde. La accende la chiave nelle opzioni dell'add-on, e compare in una casa sola al mondo — nel menu dell'app e nel Cruscotto della plancia |
| ✅ | **521 prove** — 272 sul ponte, 19 sul centralino, 13 sulla nuvola, 217 sull'app — senza rete, senza Home Assistant, senza telefono |
| ⬜ | Gli aiutanti (i sette classici, nativi) |
| ⬜ | Zigbee: ZHA **e** Zigbee2MQTT |
| ⬜ | Il mago delle automazioni |
| ⬜ | Notifiche, impronta digitale, pubblicazione sui negozi |

### La plancia, com'e' fatta

L'app **non rifa'** la plancia: mostra quella vera. La pagina di
DashboardModern — con le sue tessere, le sue finestre, la sua barra e la sua
configurazione — gira dentro l'app in un WebView. Prima si era provato a
rifarla in Flutter, ed e' andata come dice il piano: non era lei.

Da dove arriva: **dall'add-on**. In Home Assistant non c'e' e non serve
nessuna integrazione: i file della plancia — la pagina, i moduli, i caratteri,
i ritratti — stanno dentro il ponte, in `ponte/plancia/`, portati da
`strumenti/porta-la-plancia.mjs`. Tutto quello che la plancia chiedeva
all'integrazione lo fa il ponte, rispondendo esattamente come risponderebbe
lei: la configurazione (`ponte/src/configurazione.js`), il catalogo delle
integrazioni per scegliere elettrodomestici, auto e robot
(`ponte/src/catalogo.js`, dai registri di Home Assistant), le foto caricate
(`ponte/src/foto.js`). Si configura dall'app, dalla sezione Config della
plancia, e ogni telefono di casa vede la stessa configurazione. Le
segnalazioni invece escono dalla plancia e diventano dell'app: il piano in due
binari sta in `docs/PIANO.md`. La chat di assistenza no: quella resta la sua,
e il ponte fa il mestiere che nell'integrazione fa `chat.py`
(`ponte/src/chat.js`).

Sul telefono un server che sta **dentro l'app**, su `127.0.0.1`
(`app/lib/plancia/servitore.dart`), chiede i file al ponte sul filo — la
commissione `ponte/http`, in `ponte/src/commissioni.js` — e li tiene sul
disco: il percorso ha dentro un'impronta che cambia a ogni aggiornamento della
plancia nell'add-on, quindi un file preso una volta vale finche' esiste. Il
WebSocket della pagina lo cuce sullo stesso filo, coi numeri del filo. Alla
pagina si dice di essere *ospitata*, come quando gira dentro un pannello:
cosi' non chiede nessun segno, e nessuna credenziale di Home Assistant tocca
ne' la pagina ne' il telefono.

Il **menu laterale** tiene il resto: la casa in cui si e' e da dove ci si
passa, la plancia, i dispositivi, e quello che verra'. Le pagine della plancia
— le luci, il clima, l'energia, la configurazione — stanno dentro la plancia,
nella sua barra: qui non si ripetono.

Il piano per intero, fase per fase, sta in [`docs/PIANO.md`](docs/PIANO.md).

## Provarla davvero, sul telefono

Il pacchetto Android lo costruisce GitHub, quindi non serve installarsi l'SDK:
**Actions → «L'app da provare» → Run workflow**, e a fine corsa si scarica
`gdahome-android`. I passi per intero — ponte compreso, e cosa guardare una
volta dentro — stanno in [`COME_PROVARLA.md`](COME_PROVARLA.md).

Questa repository e' **pubblica**, perche' e' cosi' che Home Assistant
scarica un add-on: il Supervisor va a prendere gli archivi senza presentarsi, e
da una repository privata si sente rispondere «non esiste». Cosa si vede e cosa
no — e le due cose che restano da mettere a posto, la chiave con cui si firmano
i pacchetti Android fra tutte — sta in
[`docs/APRIRE_LA_REPOSITORY.md`](docs/APRIRE_LA_REPOSITORY.md).

## Le prove

```bash
npm run test:ponte              # il ponte: 195 prove, due secondi
npm run test:centralino         # il centralino: 19 prove
cd app && flutter test          # l'app: 179 prove, un quarto di minuto
```

Fra quelle dell'app ce n'e' un gruppo diverso dagli altri, in
`app/test/integrazione/`. Uno accende il **ponte vero** — lo stesso processo
dell'add-on — contro una Home Assistant finta, e ci fa passare il **cliente
vero** dell'app. L'altro, `da_fuori_test.dart`, accende la catena intera:

```
    app (Dart)  ──►  centralino (node)  ◄──  ponte (node)  ──►  HA finta
```

e li' il telefono **non ha nessun indirizzo della casa**: ha la riga che ha
letto da un quadretto, e basta quella. E' la differenza fra «funziona se apri una porta sul router» e
«funziona», ed e' l'unica prova che la dimostra per intero — tutte le altre
hanno un finto proprio nel punto che conta. La stessa prova gira anche contro
il centralino su Cloudflare:

```bash
cd nuvola && npx wrangler dev &
cd app && CENTRALINO_ESTERNO=ws://127.0.0.1:8787 flutter test test/integrazione/da_fuori_test.dart
```

E per **guardarla** girare, con le fotografie delle schermate, c'e'
[`collaudo/`](collaudo/README.md).

Girano tutte senza rete, senza Home Assistant e senza telefono: il ponte ha
una Home Assistant finta che fa la stretta di mano vera, e l'app ha un ponte
finto che fa lo stesso. E' l'unico modo di avere prove che girino davvero a
ogni commit.

Per il ponte non serve `npm install`: dipendenze non ne ha. `npm install` serve
solo per `prettier`.
