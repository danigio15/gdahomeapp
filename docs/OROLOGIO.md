# gdahome al polso: Apple Watch e Wear OS

Al polso c'è quello che c'è in auto, rifatto per uno schermo da guardare in
due secondi:

- **la casa**: i comandi rapidi (gli stessi scelti per l'auto: navigatore,
  menu, *Comandi rapidi in auto*), i dispositivi, le azioni rapide della
  plancia, e com'è la casa — chi c'è, il fotovoltaico;
- **il navigatore**: la prossima manovra grande, quanto manca e quando si
  arriva, il limite e la velocità; da fermi, *Portami a casa* e *Al lavoro*;
  in guida, *Fine guida*.

È una funzione **Premium**, come la casa in auto: lo stesso biglietto
(`lib/auto/la_licenza.dart`) decide per tutt'e due.

## Come funziona

L'orologio **con la casa non parla**, ed è la stessa regola di CarPlay e
Android Auto: un posto solo sa entrare in casa, ed è l'app sul telefono.

```
 casa ⇄ app sul telefono (Dart, il filo) ⇄ tramite nativo ⇄ orologio
```

- **Dal telefono al polso** va una *fotografia*: gli stessi tre file che
  legge l'auto (`gdahome-auto.json`, `gdahome-auto-comandi.json`,
  `gdahome-auto-licenza.json`) più la guida di gdanav. Il Dart, quando li
  riscrive, dà un colpetto sul canale `gdahome/orologio`
  (`lib/auto/sul_telefono.dart`); la guida arriva da gdanav da sé, al più una
  volta al secondo.
- **Dal polso al telefono** va un *tocco*. Un comando prende la strada di
  sempre: si lascia scritto `gdahome-auto-comando.json` e si sveglia il Dart
  (`LaCasaInCarPlay.lascia` sull'iPhone, `IlPonteDellAuto.sveglia` su
  Android), che lo esegue col suo filo. Vale due minuti, come in auto.

| | iPhone + Apple Watch | Android + Wear OS |
| --- | --- | --- |
| Tramite sul telefono | `ios/Runner/LOrologio.swift` (WatchConnectivity) | `android/app/.../orologio/IlTramiteDellOrologio.kt`, `OrologioInAscolto.kt` (Data Layer) |
| App al polso | `ios/Orologio/` (SwiftUI, watchOS 10) | `android/orologio/` (Compose for Wear OS, Wear OS 3) |
| Fotografia | application context, chiave `foto` | DataItem `/gdahome/foto`, chiave `foto` |
| Tocco | `sendMessage` con risposta | `MessageClient.sendRequest` su `/gdahome/tocco` |
| Guida di gdanav | notifica `gdanav.orologio.guida` (`GdanavOrologio.swift` in gdanav) | `PonteAuto` di gdanav, direttamente |

### La fotografia

Un JSON, in una stringa:

```json
{
  "v": 1,
  "premium": true,
  "casa": "Casa al mare",
  "quando": 1760000000000,
  "comandi": [{ "id": "c|cover.cancello|toggle", "nome": "Cancello", "disegno": "varco", "conferma": false }],
  "dispositivi": [{ "id": "…", "nome": "Luce salone", "genere": "luce", "stato": "Accesa", "acceso": true }],
  "azioni": [{ "id": "3|Notte", "nome": "Notte", "subito": true }],
  "persone": [{ "nome": "Anna", "inCasa": true }],
  "misure": [{ "nome": "Produzione", "valore": "3,2 kW" }],
  "nav": {
    "attiva": true, "casa": true, "lavoro": false,
    "tipo": 10, "distanza": 350, "istruzione": "Svolta a destra in Via Roma",
    "strada": "Via Roma", "restanti": 12400, "secondi": 840,
    "arrivo": 1760000840000, "destinazione": "Casa",
    "velocita": 48, "limite": 50, "messaggio": "Calcolo il percorso…"
  }
}
```

Senza Premium ci va solo `{"v":1,"premium":false}`: i nomi di casa restano
sul telefono. `tipo` è il tipo di manovra di Valhalla (la tabella è
`ManovreCarPlay.simbolo` in gdanav); `velocita` è in km/h.

### Il tocco

Domanda e risposta, in JSON:

| Domanda | Cosa fa |
| --- | --- |
| `{"cosa":"comando","id":"…"}` | Lascia scritto il comando e sveglia il Dart. |
| `{"cosa":"vai","dove":"casa"}` (o `lavoro`) | Parte la guida verso Casa o Lavoro di gdanav. |
| `{"cosa":"ferma"}` | Finisce la guida. |
| `{"cosa":"aggiorna"}` | Risponde con la fotografia di adesso (`"foto"`). |

Risposta: `{"ok": true, "testo": "Fatto"}` — il testo è quello che il polso
mostra, con un colpetto di vibrazione.

## Accenderli

Gli orologi **non entrano** nei pacchetti finché non si accende la variabile
`GDAHOME_OROLOGIO` = `si` (Settings → Secrets and variables → Actions →
Variables), come CarPlay. Fino ad allora il telefono è quello di prima (il
tramite c'è, ma non trova nessun orologio). Intanto il workflow **«Gli
orologi»** li compila tutt'e due a ogni modifica, e lascia fra gli artefatti
l'APK di prova per Wear OS.

### Apple Watch

1. Su developer.apple.com, l'App ID `com.gdahome.gdahome.watchkitapp` (con la
   firma automatica e la chiave dell'App Store Connect lo crea l'esportazione
   da sé, se la chiave è *Admin*).
2. `GDAHOME_OROLOGIO` = `si`: il lavoro *iPhone (IPA)* aggiunge il target
   «gdahome Watch» (`strumenti/orologio-in-xcode.rb`) e l'orologio parte
   dentro l'app per iPhone, su TestFlight come sempre.
3. Per lavorarci su un Mac: `ruby strumenti/orologio-in-xcode.rb` una volta,
   e in Xcode compare il target. Non si committa il progetto cambiato: finché
   l'orologio è a richiesta, lo aggiunge lo script.

### Wear OS

1. `GDAHOME_OROLOGIO` = `si`: il lavoro *Android* costruisce anche
   `:orologio` (APK e `.aab`), firmato con la stessa chiave del telefono —
   senza, il Data Layer non li mette in contatto.
2. Nel Play Console: *Test and release → Advanced settings → Form factors →
   Wear OS*, poi si carica il `.aab` dell'artefatto `gdahome-wear-os` nella
   pista Wear OS. Il numero è quello del telefono più uno.
3. A mano: `GDAHOME_OROLOGIO=si ./gradlew :orologio:installDebug` con
   l'orologio collegato in adb, e sul telefono l'app di debug (`.prova`).

## Cosa resta fuori, per ora

- Le complicazioni e i riquadri (*tile*) sul quadrante.
- La mappa: al polso c'è la manovra, non la strada.
- «Fatto» al polso vuol dire *consegnato al telefono*, come in auto: se poi
  la casa non risponde, il comando scade in due minuti e non riparte da solo.
  Con l'app chiusa il telefono la sveglia lui (Android: il motore senza
  schermo di Android Auto; iPhone: WatchConnectivity apre l'app in
  background).
