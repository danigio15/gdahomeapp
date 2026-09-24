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

## Come torna indietro il comando

L'auto lascia scritto `filesDir/gdahome-auto-comando.json`
(`IlComandoLasciato.kt`): il segno del tasto e il momento in cui è stato
premuto. Il servizio con la casa non parla, e non deve — due posti che sanno
entrare in casa sono uno di troppo.

Lo esegue l'app. `app/lib/auto/` legge il file, lo **toglie prima di tornare**
— un comando si esegue una volta sola, e un file che resta lì si fa ritrovare
a ogni apertura — e passa il segno alla plancia, che è quella che le azioni
rapide ce le ha. La plancia lo confronta con l'elenco di adesso: se qualcuno
le ha riordinate da quando la fotografia è partita, non preme niente. Un tasto
che fa un'altra cosa è peggio di un tasto che non fa niente, e in macchina
nessuno guarda se è partito quello giusto.

Quando si preme si guarda: alla pagina arrivata e ogni volta che si torna
sulla schermata della plancia. Sono i due momenti in cui l'app diventa «viva»
per chi ha premuto in macchina.

**Un comando vale due minuti** (`quantoValeIlComandoMs`). «Apri il cancello»
premuto in macchina è una cosa che si vuole adesso: trovato un'ora dopo — il
telefono in tasca, l'app mai riaperta — non è più quello che uno voleva, ed
eseguirlo vorrebbe dire aprire il cancello a casa vuota. Scaduto si butta e
non si fa niente: è il verso giusto in cui sbagliare. Per questo il tasto in
macchina dice «parte appena apri gdahome sul telefono, entro due minuti», e
non «è partito».

## A schermo spento

Android Auto tiene su il **processo** dell'app — il servizio dell'auto gira lì
dentro — ma non la parte Flutter. Con l'app chiusa il comando restava scritto e
scadeva, e chi aveva premuto «Cancello» guidando doveva poi prendere il telefono
e aprire gdahome: esattamente quello che in macchina non si vuole fare.

`IlPonteDellAuto.kt` accende un **motore Flutter senza schermo** sul secondo
ingresso `inAuto` (`lib/main.dart` → `lib/auto/in_auto.dart`), e quello esegue.
Il telefono resta spento e in mano non compare niente. Il filo con la casa resta
uno solo, ed è quello di Dart: il Kotlin con la casa continua a non parlare, ed
è la ragione per cui si accende un motore invece di riscrivere la stretta di
mano qui.

Il motore resta acceso finché Android Auto è attaccato, e a ogni tasto premuto
arriva un colpetto sul canale `gdahome/auto/guarda`. Accenderne uno per ogni
pressione vorrebbe dire far ripartire tutto — macchina virtuale, plugin,
cassaforte — per un `call_service`. La sessione, finendo, lo spegne.

### Le ricette

Senza schermo non c'è plancia, e senza plancia non c'è `qaRun`. Quello che
un'azione rapida **vuol dire** — quale entità davvero, quale servizio, quale
voce mettere in un menu — lo sa la plancia, e rifarlo in Dart sarebbe una
seconda tabella dei servizi che il giorno che si scosta fa partire la cosa
sbagliata.

Quindi la plancia, mentre è aperta, lascia scritte le ricette dei tasti che
possono partire da soli, in un file suo (`gdahome-auto-ricette.json`). **Non è
quello che legge l'auto**: lì dentro ci sono i nomi delle entità, e in macchina
non servono. A tenerle fuori dal file dell'auto è la rilettura campo per campo
di `la_foto.dart`, non un ricordarsene.

### Cosa NON parte da solo

| | perché |
|---|---|
| una con una conferma | la conferma è il segno che chi l'ha messa voleva essere guardato in faccia prima |
| un menu senza voce fissata | scegliere vuol dire un dito su uno schermo |
| serratura, lettore | lì il servizio giusto dipende da com'è messa l'entità **adesso**, e una ricetta scritta prima congelerebbe lo stato di mezz'ora fa |
| quelle che aprono qualcosa nella plancia | senza plancia non c'è niente da aprire |
| **tutte, col lucchetto acceso** | chi l'ha messo ha detto che in casa non si entra senza che sia lui a tenere il telefono |

Quelle restano come prima: partono quando l'app torna viva. E il tasto in
macchina lo dice — «fatto» per le une, «parte appena apri gdahome sul telefono»
per le altre — perché `subito` viaggia con ogni azione dentro la fotografia.

## Cosa non si è potuto provare qui

Il Kotlin di questa cartella **non è mai stato compilato**: in questo contenitore
non c'è l'SDK di Android e i server di Google non si raggiungono, quindi non si
può né costruire l'APK né far girare il Desktop Head Unit. Quello che è provato
davvero è tutto il resto: il nucleo della plancia, lo scrittore e l'esecutore in
Dart, e nel browser vero che dal canale escono la fotografia e le ricette
giuste. Il primo `flutter build apk` va fatto su una macchina con l'SDK.

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
