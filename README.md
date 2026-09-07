# GDA Home

Un'app per Android e iPhone che fa vedere la casa come una plancia, e che sa
fare le tre cose che in Home Assistant stanno nascoste in fondo a un menu:
**abbinare un dispositivo Zigbee**, **scrivere un'automazione**, **creare un
aiutante**. Tutto quello che si crea da qui compare nella plancia, perche' sono
entita' di Home Assistant come le altre.

> **Stato: fase 1 chiusa, tranne la plancia.** Il ponte c'e'. L'app tiene piu'
> case, entra in ognuna **da dentro e da fuori** senza che l'utente tocchi
> niente, e ha la sua home. Le tre funzioni nuove — aiutanti, Zigbee,
> automazioni — sono le fasi 2, 3 e 4. La plancia e' l'ultimo blocco.

## Le tre parti

```
                     ┌── in casa ──►  192.168.1.50:8098 ──┐
   ┌─────────────┐   │                                    ▼
   │   l'app     │───┤                            ┌──────────────┐      ┌──────────────────┐
   │ Android/iOS │   │                            │   il ponte   ├─────►│  Home Assistant  │
   └─────────────┘   │                            │   (add-on)   │      │      Core        │
     segno del ponte └── da fuori ─► casa.tua.it ──┘──────────────┘      └──────────────────┘
     (revocabile)                                   SUPERVISOR_TOKEN
                                                    (non esce da li')
```

Due indirizzi, **una casa sola**. Quale dei due funziona dipende da dove sta il
telefono in questo momento, e cambia mentre l'app e' aperta: si esce dal
portone e il primo smette di rispondere a meta' frase. L'app li chiede tutti e
due insieme e tiene il primo che risponde — e lo rifa' **a ogni tentativo di
riconnessione**, non una volta all'avvio. Chi la usa non deve sapere che esiste
la differenza.

| | dove sta | cosa fa |
|---|---|---|
| **il ponte** | `ponte/` | l'add-on di Home Assistant che fa entrare l'app, da dentro e da fuori casa |
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
| ✅ | **Piu' case**: ognuna col suo segno, si passa dall'una all'altra senza riabbinare |
| ✅ | **Dentro e fuori casa**: due indirizzi per la stessa istanza, scelti da soli |
| ✅ | Il filo: si rialza da solo, cambia approdo, rifa' le sottoscrizioni cadute |
| ✅ | La home: luci accese, aperture, temperatura, antifurto, cosa non risponde |
| ✅ | I dispositivi: tutte le entita' divise per dominio, con gli interruttori |
| ✅ | **150 prove** — 60 sul ponte, 90 sull'app — senza rete, senza Home Assistant, senza telefono |
| ⬜ | Gli aiutanti (i sette classici, nativi) |
| ⬜ | Zigbee: ZHA **e** Zigbee2MQTT |
| ⬜ | Il mago delle automazioni |
| ⬜ | La plancia dentro l'app — **l'ultimo blocco** |
| ⬜ | Notifiche, impronta digitale, pubblicazione sui negozi |

Il piano per intero, fase per fase, sta in [`docs/PIANO.md`](docs/PIANO.md).

## Le prove

```bash
npm run test:ponte          # il ponte: 60 prove, meno di un secondo
cd app && flutter test      # l'app: 90 prove, cinque secondi
```

Girano tutte senza rete, senza Home Assistant e senza telefono: il ponte ha
una Home Assistant finta che fa la stretta di mano vera, e l'app ha un ponte
finto che fa lo stesso. E' l'unico modo di avere prove che girino davvero a
ogni commit.

Per il ponte non serve `npm install`: dipendenze non ne ha. `npm install` serve
solo per `prettier`.
