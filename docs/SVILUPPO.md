# Per chi sviluppa gdahome

Il [README](../README.md) è per chi usa gdahome e per chi lo installa. Qui c'è
il resto: come sono fatti i pezzi, come si parlano, come si prova e come si
pubblica. Qui i pezzi si chiamano col loro nome di casa.

## I pezzi

|                   | dove sta                                                                   | cosa fa                                                                                                                 |
| ----------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **il ponte**      | [`ponte/`](../ponte/README.md)                                             | l'add-on: fa entrare l'app da dentro e da fuori casa, serve la plancia, tiene la configurazione e la licenza della casa |
| **l'app**         | [`app/`](../app/README.md)                                                 | Flutter, per Android, iPhone e browser: si abbina, si collega, comanda ([iPhone e CarPlay](IPHONE.md))                  |
| **la plancia**    | `ponte/plancia/`                                                           | i file di DashboardModern che il ponte serve dal disco, **con la sua licenza**                                          |
| **l'officina**    | [`officina/`](../officina/LEGGIMI.md)                                      | il resto del progetto DashboardModern: gli attrezzi che costruiscono la plancia, le sue prove, i suoi documenti         |
| **il centralino** | [`nuvola/`](../nuvola/README.md), [`centralino/`](../centralino/README.md) | fa incontrare un telefono e la sua casa, senza capire niente di quello che si dicono                                    |
| **il quadro**     | [`quadro/`](../quadro/README.md)                                           | il cruscotto di chi installa, e le licenze Premium: le rilascia, le regala, controlla i rinnovi col negozio             |
| **il collaudo**   | [`collaudo/`](../collaudo/README.md)                                       | guarda l'app davvero, con un ponte vero e le fotografie di ogni schermata                                               |
| **il sito**       | [`sito/`](../sito/README.md)                                               | gdahome.org: racconta il progetto, e ne fa toccare **la plancia vera** da un browser                                    |
| **il negozio**    | [`app/negozio/`](../app/negozio/LEGGIMI.md)                                | i testi del Play Store e dell'App Store, una lingua per file                                                            |

Come si installa l'add-on a mano per svilupparlo, e come si accende un
centralino proprio: [`COME_PROVARLA.md`](../COME_PROVARLA.md).

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

**La casa chiama fuori.** Non c'è nessuna porta da aprire sul router, nessun
indirizzo pubblico da avere, nessuna VPN da installare: il ponte apre lui un
filo verso il centralino e lo tiene aperto, e i telefoni arrivano da quella
parte. Da fuori casa si entra con Premium.

**Il centralino instrada e non può leggere.** Fra il telefono e la casa c'è uno
scambio di chiavi che gli passa davanti senza che lui ne ricavi niente, e da lì
in poi ogni messaggio è cifrato punta a punta. Una prova registra tutto quello
che lo attraversa e controlla che non ci sia dentro niente di leggibile.

Quello di gdahome è `tramite.gdahome.org`, scritto nel codice del ponte e
dell'app. **Chi preferisce il proprio** se ne accende uno:
[`nuvola/`](../nuvola/README.md) è la versione per Cloudflare,
[`centralino/`](../centralino/README.md) la stessa cosa in Node per una
macchina propria. Sono intercambiabili, e la prova dal vivo passa identica
contro tutti e due.

**Tre strade, una casa sola.** Quale funziona dipende da dove sta il telefono
adesso, e cambia mentre l'app è aperta. L'app le chiede tutte insieme e tiene
la prima che risponde — e lo rifà a ogni riconnessione, non una volta
all'avvio. In casa **vince sempre la strada diretta**.

### La plancia è quella vera

L'app **non rifà** la plancia: mostra quella di DashboardModern — le sue
tessere, le sue finestre, la sua barra, la sua configurazione — dentro un
WebView. E arriva **dall'add-on**: in Home Assistant non serve nessuna
integrazione. I file della plancia stanno in
[`ponte/plancia/`](../ponte/plancia/), e tutto quello che la plancia chiedeva
all'integrazione lo fa il ponte rispondendo esattamente come risponderebbe lei
— la configurazione, il catalogo dei dispositivi, le foto, la chat.

Ogni file porta dentro la propria impronta, e la console dice se la plancia è
**quella originale** o se qualcuno l'ha toccata. Una copia modificata non viene
bloccata: viene detta.

La plancia **si sviluppa qui**: dopo averla toccata il sigillo si rifà con
`node strumenti/sigilla-la-plancia.mjs` — e se ci si dimentica lo dicono le
prove.

### Perché un ponte, e non un token incollato a mano

- **un token lungo incollato a mano** vive anni, vale tutto, e per revocarlo
  bisogna ricordarsi quale dei sette in elenco era quello del telefono perso;
- **l'autenticazione di Home Assistant dentro l'app** mette in mano al telefono
  un segno di aggiornamento vero, e da fuori casa non risolve niente comunque.

Il ponte prende una terza strada: il telefono riceve **un segno suo**, che vale
solo per quel ponte e per quella casa, si toglie con un bottone, e il segreto
di Home Assistant (`SUPERVISOR_TOKEN`) non esce mai dall'add-on. Il resto — le
due porte, l'abbinamento, cosa finisce sul disco — sta in
[`ponte/README.md`](../ponte/README.md).

### Perché niente Home Assistant Container

Il ponte si presenta a Home Assistant col segno che gli dà il Supervisor, e la
sua scheda — quella dei QR code — sta dietro l'**ingress**, cioè dietro
l'autenticazione di Home Assistant. Un gdahome come container a sé vorrebbe
dire: un segno a lunga vita al posto di quello del Supervisor, la scheda su una
porta vera **con un'autenticazione propria** (senza ingress i codici di
abbinamento resterebbero esposti), e l'aggiornamento automatico da rifare.

## Le licenze

Come si parlano il quadro, l'add-on, il centralino e l'app sulle licenze — il
gettone firmato, i codici regalo, i pacchetti degli installatori, la prova di
14 giorni, i rinnovi col negozio — sta in [`LICENZE.md`](LICENZE.md). Il
cruscotto degli installatori e la pagina del gestore sono in
[`quadro/`](../quadro/README.md).

## Il sito

**[gdahome.org](https://gdahome.org)** è in [`sito/`](../sito/README.md). Ci
gira **la plancia vera** — gli stessi file dell'add-on — con davanti una Home
Assistant finta in pagina (`sito/casa-in-pagina.js`) che ha dentro la casa demo
del collaudo.

L'informativa è `sito/privacy.html`, e una prova la tiene allineata a
[`PRIVACY.md`](PRIVACY.md) sezione per sezione.

Si pubblica spostando il segno (**Actions → «Il tramite»**): la macchina di
gdahome.org scambia da sola entro dieci minuti, dopo aver rigirato le prove.
Quello che non si scrive a mano — la plancia, il marchio, le icone, i
caratteri, la casa demo — lo porta `node strumenti/porta-nel-sito.mjs`; che il
sito stia in piedi lo dice `node collaudo/guarda-il-sito.mjs`, con un browser
vero.

## Le prove

Nessuna prova ha bisogno di rete, di Home Assistant o di un telefono: il ponte
ha una Home Assistant finta che fa la stretta di mano vera, e l'app ha un ponte
finto che fa lo stesso.

```bash
npm test                        # tutto quello che gira su Node
npm run test:ponte              # il ponte
npm run test:quadro             # il quadro e le licenze
npm run test:plancia            # la plancia
cd app && flutter test          # l'app

npm run format:check            # prettier, sui file nostri
cd app && flutter analyze       # l'analisi di Dart
```

Per il ponte non serve `npm install`: dipendenze non ne ha. `npm install` serve
solo per `prettier`.

In `app/test/integrazione/` c'è un gruppo diverso dagli altri. Uno accende il
**ponte vero** contro una Home Assistant finta, e ci fa passare il **cliente
vero** dell'app. L'altro, `da_fuori_test.dart`, accende la catena intera:

```
    app (Dart)  ──►  centralino (node)  ◄──  ponte (node)  ──►  HA finta
```

e lì il telefono **non ha nessun indirizzo della casa**: ha la riga letta da un
QR code, e basta quella. La stessa prova gira anche contro il centralino su
Cloudflare:

```bash
cd nuvola && npx wrangler dev &
cd app && CENTRALINO_ESTERNO=ws://127.0.0.1:8787 flutter test test/integrazione/da_fuori_test.dart
```

Per **guardarla** girare, con le fotografie delle schermate, c'è
[`collaudo/`](../collaudo/README.md).

## I contatori

Le **case** sono quante, in quattordici giorni, hanno scaricato gdahome da qui:
un add-on si aggiunge fra gli Archivi, e da lì è **Home Assistant a clonare la
repository** ogni volta che rinfresca il negozio. Quei cloni GitHub li conta —
non è telemetria, dall'add-on non esce niente. Gli **scaricamenti** sono tutti
i passaggi da quando si conta. I numeri li rifà
[una corsa al giorno](../.github/workflows/quante-case.yml), e la loro storia
sta [sul ramo `contatori`](https://github.com/danigio15/gdahomeapp/blob/contatori/traffico.json).

<p>
  <img src="https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Fdanigio15%2Fgdahomeapp%2Fcontatori%2Fbollino-case.json&cacheSeconds=300" alt="Case con gdahome">
  <img src="https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Fdanigio15%2Fgdahomeapp%2Fcontatori%2Fbollino-scaricamenti.json&cacheSeconds=300" alt="Scaricamenti">
  <a href="https://github.com/danigio15/gdahomeapp/actions/workflows/prove.yml"><img src="https://github.com/danigio15/gdahomeapp/actions/workflows/prove.yml/badge.svg" alt="Le prove"></a>
</p>

## La licenza e la repository pubblica

Il codice di gdahome ha la sua licenza ([`LICENSE`](../LICENSE)). La plancia in
`ponte/plancia/` è DashboardModern, **con la sua licenza**
([`ponte/plancia/LICENSE`](../ponte/plancia/LICENSE)). Il nome e il marchio di
gdahome si applicano quando i file vengono serviti, non nei file.

Questa repository è **pubblica**, e deve restarlo: il Supervisor va a prendere
gli archivi senza presentarsi, e da una repository privata si sente rispondere
«non esiste».
