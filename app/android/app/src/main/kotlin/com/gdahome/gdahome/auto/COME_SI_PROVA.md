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

## Come ci arriva la fotografia

Il servizio legge `filesDir/gdahome-auto.json`. Quel file lo scrive l'app, con
quello che la plancia già sa — e la plancia lo sa perché gli stati di casa ce li
ha lei in mano, aggiornati, dentro il suo riquadro.

Il giro è questo, e ha tre pezzi:

1. `ponte/plancia/src/core/la-foto-per-lauto.js` decide **cosa** ci entra e
   quanto: tre misure, sei tasti, e `null` quando non c'è niente da mostrare.
2. `ponte/plancia/src/sections/la-foto-va-in-auto-section.js` legge la tessera
   Energia, le persone e le azioni rapide, e manda dal canale `gdahomeAuto`.
   Quel canale lo registra l'app (`app/lib/schermate/riquadro/sul_telefono.dart`):
   nel browser e dentro Home Assistant non c'è, e lì la sezione non fa niente.
3. `app/lib/auto/` rilegge quello che è arrivato campo per campo — non lo copia
   mai come viene — ci mette il nome della casa, che solo l'app sa, e scrive il
   file. Prima accanto, poi un rinomina: l'auto è un altro processo e legge
   quando le pare, e così non le capita di leggerne metà.

Se la fotografia non c'è ancora — app appena installata, plancia mai aperta —
in auto compare la schermata che lo dice, e non numeri finti: su un cruscotto
sono la cosa peggiore, perché chi guarda non ha modo di accorgersene. Oltre la
mezz'ora (`QUANTO_VALE_MS`) si dice che è vecchia invece di spacciarla per
adesso.

La forma è questa:

```json
{
  "casa": "Casa di Giovanni",
  "quando": 1758700000000,
  "fotovoltaico": [{ "nome": "Dal sole adesso", "valore": "4,2 kW" }],
  "persone": [{ "nome": "Giovanni", "inCasa": true }],
  "azioni": [{ "id": "0|Cancello", "nome": "Cancello", "segno": "🚧" }]
}
```

I numeri sono **già scritti**, non grezzi: `"4,2 kW"` e non `4200`. Sono le
stesse righe che la finestra dell'Energia mostra in casa, con dentro la
conversione, il verso della batteria e la parola nella lingua di chi guarda:
rifare quel conto qui vorrebbe dire una seconda aritmetica dell'energia, e il
giorno che si scostano in macchina si legge un numero e in casa un altro.

L'`id` di un'azione è `«posto|nome»`. Le azioni rapide un nome loro con cui
chiamarle non ce l'hanno: la plancia le preme per posto nell'elenco
(`qaRun(3)`). Ma fra la fotografia e il tasto premuto qualcuno può aver
riordinato l'elenco, e allora il terzo posto non è più la stessa azione: col
nome accanto, chi esegue può controllare di premere quella che in macchina
c'era scritta — e, se non torna, non premere niente.

## Cosa manca ancora

**I comandi non tornano ancora indietro.** L'auto lascia scritto
`gdahome-auto-comando.json` (`IlComandoLasciato.kt`), ma nessuno lo legge: il
pezzo che manca sta nell'app, l'unica che il filo con la casa ce l'ha, e deve
eseguirlo appena è viva controllando il nome. Il servizio in auto con la casa
non parla, e non deve: due posti che sanno entrare in casa sono uno di troppo.

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
