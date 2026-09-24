# gdahome in auto — la prova

Non è un rilascio: è il poco che serve per **guardarla**.

## Cosa c'è

Un servizio di Android Auto (`GdahomeCarAppService`, categoria `IOT`) con tre
schermate, disegnate con i modelli di Android — in auto non si disegna:

| schermata | modello | cosa dice |
|---|---|---|
| `LaCasaInAuto` | `PaneTemplate` | fino a tre misure del fotovoltaico, da quando sono, e i due tasti |
| `LePersoneInAuto` | `ListTemplate` | chi è in casa e chi è fuori |
| `LeAzioniInAuto` | `GridTemplate` | sei azioni rapide, e non una di più |

## Cosa manca, ed è la parte grossa

**L'app non scrive ancora la fotografia.** Il servizio legge
`filesDir/gdahome-auto.json`; finché quel file non c'è, in auto compare la
schermata che lo dice — e non numeri finti, che su un cruscotto sono la cosa
peggiore, perché chi guarda non ha modo di accorgersene.

La fotografia dovrà scriverla il telefono, con quello che la plancia già sa:
produzione, batteria, scambio, le persone e le azioni rapide. La forma è questa:

```json
{
  "casa": "Casa di Giovanni",
  "quando": 1758700000000,
  "fotovoltaico": [{ "nome": "Dal sole adesso", "valore": "4,2 kW" }],
  "persone": [{ "nome": "Giovanni", "inCasa": true }],
  "azioni": [{ "id": "cancello", "nome": "Cancello", "segno": "🚧" }]
}
```

E i comandi tornano indietro dallo stesso corridoio: l'auto lascia scritto
`gdahome-auto-comando.json`, l'app — l'unica che il filo con la casa ce l'ha —
lo esegue appena è viva. Il servizio in auto non parla con la casa, e non deve:
due posti che sanno entrare in casa sono uno di troppo.

## Come si guarda davvero

Serve l'SDK di Android e il **Desktop Head Unit**, che qui dentro non ci sono:

```
flutter build apk --debug
adb install -r build/app/outputs/flutter-apk/app-debug.apk
# sul telefono: Android Auto → Impostazioni → modalità sviluppatore
adb forward tcp:5277 tcp:5277 && ./desktop-head-unit
```

Gli scatti in `scatti-di-stanotte/auto-*.png` sono **disegni alla misura vera**
dello schermo (1024×578), non fotografie di una macchina: servono a decidere
cosa ci va e cosa no, non a dire che funziona.
