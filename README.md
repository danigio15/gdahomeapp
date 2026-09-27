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
  <a href="COME_PROVARLA.md"><b>Come si installa</b></a>
  &nbsp;·&nbsp;
  <a href="#base-e-premium"><b>Base e Premium</b></a>
  &nbsp;·&nbsp;
  <a href="https://gdahome.org/privacy.html"><b>Privacy</b></a>
</p>

<p align="center">
  <a href="https://github.com/danigio15/gdahomeapp/releases"><img src="https://img.shields.io/github/v/release/danigio15/gdahomeapp?label=versione&color=0ea5e9" alt="Ultima versione"></a>
  <a href="https://github.com/danigio15/gdahomeapp/actions/workflows/prove.yml"><img src="https://github.com/danigio15/gdahomeapp/actions/workflows/prove.yml/badge.svg" alt="Le prove"></a>
  <a href="https://github.com/danigio15/gdahomeapp/blob/contatori/traffico.json"><img src="https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Fdanigio15%2Fgdahomeapp%2Fcontatori%2Fbollino-case.json&cacheSeconds=300" alt="Case con gdahome"></a>
  <a href="https://github.com/danigio15/gdahomeapp/blob/contatori/traffico.json"><img src="https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Fdanigio15%2Fgdahomeapp%2Fcontatori%2Fbollino-scaricamenti.json&cacheSeconds=300" alt="Scaricamenti"></a>
  <img src="https://img.shields.io/badge/Home%20Assistant-OS%20%7C%20Supervised-18BCF2" alt="Home Assistant OS o Supervised">
  <img src="https://img.shields.io/badge/Android%20%C2%B7%20iPhone%20%C2%B7%20browser-16a34a" alt="Android, iPhone, browser">
  <img src="https://img.shields.io/badge/UI-Italiano%20%7C%20English-16a34a" alt="Italiano e inglese">
  <img src="https://img.shields.io/badge/Base-gratis-16a34a" alt="Base gratis">
  <img src="https://img.shields.io/badge/Premium-14%20giorni%20gratis-f59e0b" alt="Premium, i primi 14 giorni gratis">
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

Dentro l'app c'è anche **gdanav**, il navigatore: in auto la strada, e la casa
a un tasto.

## Metterla in casa

Serve un Home Assistant che abbia il **Supervisor**: **Home Assistant OS** o
**Home Assistant Supervised**. Su **Container** — Home Assistant in Docker — il
negozio degli add-on non esiste, e non si installa nessun add-on di nessuno:
[il perché, e cosa si può fare](#domande-che-arrivano-davvero).

1. **Impostazioni → Add-on → Negozio degli add-on**, i tre puntini in alto a
   destra → **Archivi**, e si incolla:

   ```
   https://github.com/danigio15/gdahomeapp
   ```

2. Nell'elenco compare una sezione **gdahome** con dentro l'add-on
   **gdahome**. Si installa e si avvia: la prima volta ci mette qualche minuto
   — su un Raspberry anche dieci — perché Home Assistant non se lo scarica già
   pronto, se lo costruisce sul posto. Le volte dopo è immediato, e gli
   aggiornamenti arrivano come per ogni altro add-on.
3. Si apre **gdahome** dalla barra laterale e si preme **Genera QR code**.
4. Si scarica l'app — **Play Store** su Android, **App Store** su iPhone e iPad
   — oppure si apre [dal browser](https://webapp.gdahome.org), e si inquadra
   il codice (dal browser, o senza fotocamera, lo si digita: sedici caratteri
   in quattro gruppi). La casa è abbinata.

Tutto passo per passo, e cosa guardare una volta dentro, sta in
**[`COME_PROVARLA.md`](COME_PROVARLA.md)**.

## Base e Premium

|                                   | **Base** — gratis                           | **Premium** — 4,99 € al mese o 49,99 € all'anno                               |
| --------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------- |
| l'add-on e la plancia             | la plancia principale                       | fino a **8 plance** per casa                                                  |
| le case                           | una                                         | fino a **10 case**, e si passa dall'una all'altra senza riabbinare            |
| dove si usa                       | sulla rete di casa                          | anche **da fuori casa**: diretto, cifrato punta a punta, nessuna porta aperta |
| la configurazione della plancia   | dalla plancia in Home Assistant             | anche **dall'app**                                                            |
| i dispositivi Zigbee              | da Home Assistant                           | **dall'app**, scegliendo la sezione: «Dove lo metto?»                         |
| gdanav, il navigatore             | [la versione gratis](#gdanav-il-navigatore) | **gdanav Premium compreso**, con tutto sbloccato                              |
| segnalazioni e chat di assistenza | ✅                                          | ✅                                                                            |
| account da fare                   | nessuno                                     | nessuno                                                                       |

**I primi 14 giorni di Premium sono gratis**, la prima volta: si comincia, si
prova tutto, e se non serve si disdice dal negozio prima che finiscano.

**Premium è della casa, non del telefono.** Tutti i telefoni abbinati a quella
casa sono Premium insieme a lei, e anche l'app dal browser. Chi abita con te
non paga un'altra volta.

### Come si ha Premium

- **Dall'app**: pagina **Premium**, il piano mensile o quello annuale. Si paga
  col Play Store o con l'App Store, e si disdice da lì come ogni altro
  abbonamento. Dal browser non si compra: si compra dal telefono, e vale anche
  lì.
- **Con un codice regalo**, fatto così: `GDA-XXXX-XXXX-XXXX`. Si scrive nella
  pagina Premium dell'app (anche dal browser) o nella scheda dell'add-on, e
  vale una volta sola.
- **Da chi ha installato l'impianto.** Gli installatori ricevono da gdahome
  dei pacchetti di licenze, di durate diverse — un mese, un anno, per sempre —
  e le assegnano alle case dei loro clienti, o danno loro un codice. In quel
  caso non c'è niente da fare: la casa è già Premium.

Se Premium scade, non si perde niente: la casa torna Base, e le plance in più
restano salvate dove sono — si rivedono quando si rinnova.

Un sostegno con il tasto **Sponsor** resta un'altra cosa: non sblocca niente,
serve a far andare avanti il piano ([sotto](#sostieni-il-progetto)).

## gdanav, il navigatore

gdanav sta dentro gdahome — ed esiste anche come app a sé. È fatto per l'auto
elettrica, e serve anche a chi guida a benzina o a gasolio: per quella è
completo già gratis.

|                            | **gratis**                                         | **gdanav Premium** — 2,99 € al mese o 29,99 € all'anno                                                   |
| -------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| auto termica               | completa: percorso, distributori, prezzi           | —                                                                                                        |
| auto elettrica             | la batteria si scrive a mano, percorso senza soste | la batteria **letta dall'auto**, percorso **con le soste alle colonnine** e il loro stato in tempo reale |
| Home Assistant             | —                                                  | ✅                                                                                                       |
| in auto                    | —                                                  | **Android Auto** e **CarPlay**                                                                           |
| traffico, autovelox, meteo | per tutti                                          | per tutti                                                                                                |

Anche gdanav Premium ha **i primi 14 giorni gratis**. E con **gdahome Premium
è compreso**: la casa Premium sblocca tutto anche nel navigatore, senza un
secondo abbonamento.

## Per chi installa

Chi mette in piedi impianti per gli altri ha **il cruscotto**
([`quadro/`](quadro/README.md)): una pagina con tutte le case che segue.

- **Come sta ogni casa**: dieci controlli al giorno — la plancia, i telefoni,
  il collegamento da fuori, gli aggiornamenti, gli add-on, la rete, la
  macchina, il backup, le batterie dei dispositivi — e un avviso quando una
  casa smette di parlare.
- **Le licenze Premium da dare ai clienti**: il pacchetto che gli ha dato
  gdahome, con le sue durate (un mese, un anno, per sempre). Una licenza si
  assegna a una delle sue case, oppure diventa un codice regalo da mandare al
  cliente; la durata parte quando la casa la riceve. Tolta, torna nel
  pacchetto.
- Da lontano, **dove il cliente l'ha permesso**: gli aggiornamenti, il
  riavvio, la configurazione della plancia. Tre interruttori nella scheda
  dell'add-on, spenti di serie.

Quello che **non** vede: la plancia del cliente, le stanze, le persone, le
telecamere. Riceve numeri, non nomi. L'accesso si chiede da
[gdahome.org](https://gdahome.org/#contatti).

## Come ci si arriva

```
                     ┌── in casa ──►  192.168.1.50:8098 ────────────┐
   ┌─────────────┐   │                                              ▼
   │    l'app    │───┤                                      ┌──────────────┐     ┌──────────────────┐
   │ Android/iOS │   │          ┌──────────────┐            │   il ponte   │────►│  Home Assistant  │
   │   browser   │   └─ da fuori►│ il centralino│◄───────────┤   (add-on)   │     │      Core        │
   └─────────────┘   (Premium)  └──────────────┘   chiama    └──────────────┘     └──────────────────┘
    segno + chiave               instrada e          lui                         SUPERVISOR_TOKEN
    (revocabili)                 non capisce                                     (non esce da lì)
```

**La casa chiama fuori.** È tutto il punto. Non c'è nessuna porta da aprire sul
router, nessun indirizzo pubblico da avere, nessuna VPN da installare: il ponte
apre lui un filo verso il centralino e lo tiene aperto, e i telefoni arrivano
da quella parte. Da fuori casa si entra con Premium.

**Il centralino instrada e non può leggere.** Fra il telefono e la casa c'è uno
scambio di chiavi che gli passa davanti senza che lui ne ricavi niente, e da lì
in poi ogni messaggio è cifrato punta a punta. Non è una promessa: è una prova
che registra tutto quello che lo attraversa e controlla che non ci sia dentro
niente di leggibile.

Quello di gdahome è `tramite.gdahome.org`, e non c'è niente da configurare.
**Chi preferisce il proprio** se ne accende uno: [`nuvola/`](nuvola/README.md)
è la versione per Cloudflare, [`centralino/`](centralino/README.md) la stessa
cosa in Node per una macchina propria. Sono intercambiabili, e la prova dal
vivo passa identica contro tutti e due.

**Tre strade, una casa sola.** Quale funziona dipende da dove sta il telefono
adesso, e cambia mentre l'app è aperta: si esce dal portone e la prima smette
di rispondere a metà frase. L'app le chiede tutte insieme e tiene la prima che
risponde — e lo rifà a ogni riconnessione, non una volta all'avvio. In casa
**vince sempre la strada diretta**: un comando dato a tre metri non fa il giro
del mondo.

## Cosa fa

|     |                                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| ✅  | **Un QR code e basta**: nessun indirizzo, nessuna credenziale di Home Assistant                                                            |
| ✅  | **La plancia vera**, quella di DashboardModern con le sue trenta sezioni, dentro l'app                                                     |
| ✅  | **Più plance e più case** _(Premium)_: ognuna con le sue sezioni e le sue stanze, e ogni plancia compare fra le «Plance» di Home Assistant |
| ✅  | **Da fuori casa** _(Premium)_: tre strade per la stessa casa, scelte da sole, cifrate punta a punta                                        |
| ✅  | **La plancia si configura dal telefono** _(Premium)_: la sua pagina Config, intatta, dentro l'app                                          |
| ✅  | **Zigbee dall'app** _(Premium)_: si abbina un dispositivo e si sceglie dove metterlo, «Dove lo metto?»                                     |
| ✅  | **gdanav**, il navigatore, con Android Auto e CarPlay _(Premium)_                                                                          |
| ✅  | **Segnalazioni** con foto e video, e una **chat di assistenza** — quella della dashboard, che il ponte fa da sé                            |
| ✅  | **Gli aggiornamenti di casa nel menu**: Home Assistant, gli add-on, gdahome, i firmware. Si installano da lì, e da lì si riavvia la casa   |
| ✅  | **Il lucchetto**: l'app si apre con l'impronta o col volto                                                                                 |
| ✅  | **Dal browser**, senza installare niente: la stessa app, che si adatta allo schermo                                                        |
| ⬜  | Gli aiutanti di Home Assistant, nativi nell'app                                                                                            |
| ⬜  | Le automazioni, scritte dall'app con una procedura guidata                                                                                 |

### La plancia è quella vera

L'app **non rifà** la plancia: mostra quella di DashboardModern — le sue
tessere, le sue finestre, la sua barra, la sua configurazione — dentro un
WebView. Prima si era provato a rifarla in Flutter: non era lei.

E arriva **dall'add-on**. In Home Assistant non serve nessuna integrazione: i
file della plancia stanno nel ponte, in [`ponte/plancia/`](ponte/plancia/), e
tutto quello che la plancia chiedeva all'integrazione lo fa il ponte
rispondendo esattamente come risponderebbe lei — la configurazione, il catalogo
dei dispositivi, le foto, la chat.

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

## I tuoi dati

**I dati della casa restano in casa.** Nessun account, nessuna pubblicità,
nessun tracciamento, nessun servizio di analisi. Da fuori casa passa tutto dal
centralino, cifrato fra il telefono e l'add-on: instrada e non legge.

Per Premium, all'add-on basta chiedere a `quadro.gdahome.org` se la casa è
Premium, e manda **solo** l'identificativo della casa verso il centralino e il
suo segreto — niente nomi, dispositivi, stati o posizione. Chi compra
dall'app: il quadro tiene la casa, la scadenza e **l'identificativo
dell'acquisto**, che gli serve a chiedere a Google o ad Apple se l'abbonamento
si è rinnovato. Il pagamento lo fanno Google e Apple: a gdahome non arrivano né
il nome né i dati della carta.

Tutto per intero, anche il navigatore, la fotocamera e le segnalazioni:
[l'informativa](https://gdahome.org/privacy.html)
([`docs/PRIVACY.md`](docs/PRIVACY.md)).

## Domande che arrivano davvero

**Si installa su Home Assistant in Docker?**
No, e non è una scelta nostra: su **Home Assistant Container** — l'immagine
Docker, quella che si tira su con `docker run` o un `compose` — il negozio
degli add-on **non esiste**. Non manca gdahome: manca il Supervisor, che è il
pezzo che installa e fa girare gli add-on, e senza di lui nessun add-on si
installa. gdahome ha bisogno di lui anche per lavorare: si presenta a Home
Assistant col segno che il Supervisor gli dà (`SUPERVISOR_TOKEN`), e la sua
scheda — quella dei QR code — sta dietro l'**ingress**, cioè dietro
l'autenticazione di Home Assistant.

|                                                                                                                                  | add-on                       |
| -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| **Home Assistant OS** — il sistema completo, su Raspberry, su un mini PC, in una macchina virtuale                               | ✅                           |
| **Home Assistant Supervised** — Debian più l'installatore ufficiale: è la strada di chi vuole restare padrone della sua macchina | ✅                           |
| **Home Assistant Container** — l'immagine Docker da sola                                                                         | ❌ nessun add-on, di nessuno |
| **Home Assistant Core** — in un ambiente Python                                                                                  | ❌ idem                      |

Chi oggi ha Container e vuole gdahome può passare a **Supervised** sulla stessa
macchina — Docker ce l'ha già. Un gdahome che gira come container a sé stante
oggi non c'è; il lavoro che ci vorrebbe è scritto, e non è un'opzione da
accendere: un segno a lunga vita al posto di quello del Supervisor, la scheda
su una porta vera **con un'autenticazione propria** — oggi la protegge
l'ingress, e senza ingress i codici di abbinamento resterebbero esposti — e
l'aggiornamento automatico da rifare. Se la domanda arriva da abbastanza
persone, si fa.

**L'add-on serve solo per usare l'app?**
No: serve anche **senza l'app**. gdahome porta dentro la plancia di
DashboardModern, e in Home Assistant compare come voce nella barra laterale.
Da lì si guarda e si configura da qualunque browser, senza installare nessuna
integrazione. **Con l'app** è una casa in tasca; **senza**, è DashboardModern
che si installa come add-on invece che da HACS.

**Serve avere l'integrazione DashboardModern installata?**
No, e non è nemmeno consigliato averle tutte e due: la plancia sta dentro
l'add-on, e tutto quello che chiedeva all'integrazione lo fa il ponte. Chi
l'integrazione ce l'ha già, e ci ha configurato la plancia, **non ricomincia da
zero**: alla prima apertura gdahome si va a prendere quella configurazione e la
adotta.

**È gratis?**
Base sì: l'add-on, la plancia principale e l'app per una casa, sulla rete di
casa, senza pagare niente e senza conti da aprire. Premium — più plance e più
case, il collegamento da fuori, la configurazione e Zigbee dall'app, gdanav
Premium — costa 4,99 € al mese o 49,99 € all'anno, e i primi 14 giorni sono
gratis. [Qui sopra](#base-e-premium) il resto.

**Ho due telefoni in casa: pago due volte?**
No. Premium è della casa: tutti i telefoni abbinati a lei, e l'app dal browser,
sono Premium insieme.

**Il mio installatore mi ha dato un codice. Dove lo metto?**
Nell'app, pagina **Premium → Ho un codice regalo**, oppure nella scheda
dell'add-on in Home Assistant. Se invece la licenza l'ha assegnata lui alla
casa, non c'è niente da fare: l'app lo sa già.

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

## Com'è fatta

|                   | dove sta                                                             | cosa fa                                                                                                                 |
| ----------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **il ponte**      | [`ponte/`](ponte/README.md)                                          | l'add-on: fa entrare l'app da dentro e da fuori casa, serve la plancia, tiene la configurazione e la licenza della casa |
| **l'app**         | [`app/`](app/README.md)                                              | Flutter, per Android, iPhone e browser: si abbina, si collega, comanda ([iPhone e CarPlay](docs/IPHONE.md))             |
| **la plancia**    | `ponte/plancia/`                                                     | i file di DashboardModern che il ponte serve dal disco, **con la sua licenza**                                          |
| **l'officina**    | [`officina/`](officina/LEGGIMI.md)                                   | il resto del progetto DashboardModern: gli attrezzi che costruiscono la plancia, le sue prove, i suoi documenti         |
| **il centralino** | [`nuvola/`](nuvola/README.md), [`centralino/`](centralino/README.md) | fa incontrare un telefono e la sua casa, senza capire niente di quello che si dicono                                    |
| **il quadro**     | [`quadro/`](quadro/README.md)                                        | il cruscotto di chi installa, e le licenze Premium: le rilascia, le regala, controlla i rinnovi col negozio             |
| **il collaudo**   | [`collaudo/`](collaudo/README.md)                                    | guarda l'app davvero, con un ponte vero e le fotografie di ogni schermata                                               |
| **il sito**       | [`sito/`](sito/README.md)                                            | gdahome.org: racconta il progetto, e ne fa toccare **la plancia vera** da un browser                                    |
| **il negozio**    | [`app/negozio/`](app/negozio/LEGGIMI.md)                             | i testi del Play Store e dell'App Store, una lingua per file                                                            |

Come si parlano il quadro, l'add-on, il centralino e l'app sulle licenze — il
gettone firmato, i codici regalo, i pacchetti degli installatori — sta in
[`docs/LICENZE.md`](docs/LICENZE.md).

La plancia **si sviluppa qui**: è una cartella come le altre, e i suoi difetti
si correggono da qui. Dopo averla toccata il sigillo si rifà con
`node strumenti/sigilla-la-plancia.mjs` — e se ci si dimentica lo dicono le
prove, non le case.

## Il sito

Su **[gdahome.org](https://gdahome.org)**, e in [`sito/`](sito/README.md), c'è
il posto dove il progetto si racconta a chi non l'ha mai visto: com'è fatto,
cosa fa, quanto costa. E in mezzo, il pezzo per cui esiste: **la plancia vera,
che ci gira dentro** — gli stessi file che stanno nell'add-on, con davanti una
Home Assistant finta in pagina (`sito/casa-in-pagina.js`) che ha dentro la
casa demo del collaudo. Si accende una luce e si accende, si chiude una
tapparella e scende.

Sul sito c'è anche l'informativa — `sito/privacy.html`, l'indirizzo che i
negozi tengono da parte — e una prova tiene lei e `docs/PRIVACY.md` allineate
sezione per sezione.

Si pubblica **da dove si pubblica tutto il resto**: si sposta il segno
(**Actions → «Il tramite»**) e la macchina di gdahome.org scambia da sola entro
dieci minuti, dopo aver rigirato le prove. Quello che non si scrive a mano — la
plancia, il marchio, le icone, i caratteri, la casa demo — lo porta
`node strumenti/porta-nel-sito.mjs`; che il sito stia in piedi lo dice
`node collaudo/guarda-il-sito.mjs`, con un browser vero.

## Le prove

Nessuna prova ha bisogno di rete, di Home Assistant o di un telefono: il ponte
ha una Home Assistant finta che fa la stretta di mano vera, e l'app ha un ponte
finto che fa lo stesso. È l'unico modo di avere prove che girino davvero a ogni
commit.

```bash
npm test                        # tutto quello che gira su Node: più di 6200 prove
npm run test:ponte              # il ponte: 945 prove, pochi secondi
npm run test:quadro             # il quadro e le licenze: 391 prove
npm run test:plancia            # la plancia: 4702 prove, un minuto
cd app && flutter test          # l'app, mezzo minuto

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
una porta sul router» e «funziona». La stessa prova gira anche contro il
centralino su Cloudflare:

```bash
cd nuvola && npx wrangler dev &
cd app && CENTRALINO_ESTERNO=ws://127.0.0.1:8787 flutter test test/integrazione/da_fuori_test.dart
```

E per **guardarla** girare, con le fotografie delle schermate, c'è
[`collaudo/`](collaudo/README.md).

## Sostieni il progetto

Il sostegno è separato da Premium: **non sblocca niente** e non diventa uno
sconto. Serve a far andare avanti il piano — gli aiutanti, le automazioni — e a
tenere in piedi la versione Base per chi non paga.

<p align="center">
  <a href="https://github.com/sponsors/danigio15"><img src="https://img.shields.io/badge/GITHUB-SPONSORS-ea4aaa?style=for-the-badge&logo=githubsponsors&logoColor=white&labelColor=555555" alt="Sostieni il progetto su GitHub Sponsors"></a>
  &nbsp;
  <a href="https://www.paypal.com/paypalme/giovannidaniello15"><img src="https://img.shields.io/badge/PAYPAL-ME-1f8fdd?style=for-the-badge&logo=paypal&logoColor=white&labelColor=555555" alt="Sostieni il progetto con PayPal"></a>
</p>

E ci sono due modi di aiutare che non costano niente: una ⭐ qui sopra, e una
[segnalazione scritta bene](https://github.com/danigio15/gdahomeapp/issues) —
cosa stavi facendo, cosa ti aspettavi, cosa è successo. Le migliori correzioni
di questo progetto sono nate così. Il resto sta in
[`docs/SOSTEGNO.md`](docs/SOSTEGNO.md).

## La licenza

Il codice di gdahome è in questa repository, con la sua licenza
([`LICENSE`](LICENSE)): si legge e si controlla cosa fa, non è open source.
La plancia in `ponte/plancia/` è DashboardModern, **con la sua licenza**
([`ponte/plancia/LICENSE`](ponte/plancia/LICENSE)). Il nome e il marchio di
gdahome si applicano quando i file vengono serviti, non nei file.

Questa repository è **pubblica**, e deve restarlo: è così che Home Assistant
scarica un add-on — il Supervisor va a prendere gli archivi senza presentarsi,
e da una repository privata si sente rispondere «non esiste».
