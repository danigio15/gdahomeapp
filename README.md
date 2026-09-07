# GDA Home

Un'app per Android e iPhone che fa vedere la casa come una plancia, e che sa
fare le tre cose che in Home Assistant stanno nascoste in fondo a un menu:
**abbinare un dispositivo Zigbee**, **scrivere un'automazione**, **creare un
aiutante**. Tutto quello che si crea da qui compare nella plancia, perche' sono
entita' di Home Assistant come le altre.

> **Stato: fase 1 chiusa, tranne la plancia.** Il ponte c'e'. L'app tiene piu'
> case, entra in ognuna **da dentro e da fuori** senza che l'utente tocchi
> niente, e ha la sua home. Si abbina **inquadrando un quadretto**: nessun
> codice da battere, nessun indirizzo, nessuna credenziale di Home Assistant.
> Le tre funzioni nuove — aiutanti, Zigbee, automazioni — sono le fasi 2, 3 e
> 4. La plancia e' l'ultimo blocco.

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
| **la plancia** | [dashboardmodern-v2](https://github.com/danigio15/dashboardmodern-v2) | le ventitre sezioni che gia' esistono e funzionano |

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
| ✅ | La home: luci accese, aperture, temperatura, antifurto, cosa non risponde |
| ✅ | I dispositivi: tutte le entita' divise per dominio, con gli interruttori |
| ✅ | **254 prove** — 106 sul ponte, 19 sul centralino, 129 sull'app — senza rete, senza Home Assistant, senza telefono |
| ⬜ | Gli aiutanti (i sette classici, nativi) |
| ⬜ | Zigbee: ZHA **e** Zigbee2MQTT |
| ⬜ | Il mago delle automazioni |
| ⬜ | La plancia dentro l'app — **l'ultimo blocco** |
| ⬜ | Notifiche, impronta digitale, pubblicazione sui negozi |

Il piano per intero, fase per fase, sta in [`docs/PIANO.md`](docs/PIANO.md).

## Provarla davvero, sul telefono

Il pacchetto Android lo costruisce GitHub, quindi non serve installarsi l'SDK:
**Actions → «L'app da provare» → Run workflow**, e a fine corsa si scarica
`gdahome-android`. I passi per intero — ponte compreso, e cosa guardare una
volta dentro — stanno in [`COME_PROVARLA.md`](COME_PROVARLA.md).

## Le prove

```bash
npm run test:ponte              # il ponte: 106 prove, un secondo
npm run test:centralino         # il centralino: 19 prove
cd app && flutter test          # l'app: 129 prove, dieci secondi
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
