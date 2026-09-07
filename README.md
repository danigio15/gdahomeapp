# GDA Home

Un'app per Android e iPhone che fa vedere la casa come una plancia, e che sa
fare le tre cose che in Home Assistant stanno nascoste in fondo a un menu:
**abbinare un dispositivo Zigbee**, **scrivere un'automazione**, **creare un
aiutante**. Tutto quello che si crea da qui compare nella plancia, perche' sono
entita' di Home Assistant come le altre.

> **Stato: fase 1.** Il ponte c'e' ed e' provato. L'app non c'e' ancora.

## Le tre parti

```
   ┌─────────────┐        ┌──────────────┐        ┌──────────────────┐
   │   l'app     │  WSS   │   il ponte   │        │  Home Assistant  │
   │ Android/iOS ├───────►│   (add-on)   ├───────►│      Core        │
   └─────────────┘        └──────────────┘        └──────────────────┘
     segno del ponte       SUPERVISOR_TOKEN
     (revocabile)          (non esce da li')
```

| | dove sta | cosa fa |
|---|---|---|
| **il ponte** | `ponte/` | l'add-on di Home Assistant che fa entrare l'app, da dentro e da fuori casa |
| **l'app** | `app/` — da fare | la plancia sul telefono, e i comandi che creano le cose |
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
| ✅ | 60 prove che girano senza rete e senza Home Assistant, in meno di un secondo |
| ⬜ | L'app: guscio, primo avvio, plancia |
| ⬜ | Gli aiutanti (i sette classici, nativi) |
| ⬜ | Zigbee: ZHA **e** Zigbee2MQTT |
| ⬜ | Il mago delle automazioni |
| ⬜ | Notifiche, impronta digitale, pubblicazione sui negozi |

Il piano per intero, fase per fase, sta in [`docs/PIANO.md`](docs/PIANO.md).

## Le prove

```bash
npm run test:ponte
```

Non serve `npm install`: il ponte non ha dipendenze, e le prove girano su Node
e basta. `npm install` serve solo per `prettier`, che controlla la forma del
codice.
