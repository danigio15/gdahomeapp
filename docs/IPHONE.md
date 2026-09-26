# gdahome su iPhone

Quello che l'app fa su Android, su iPhone lo fa uguale: la plancia, i comandi,
le telecamere, il lucchetto col volto, le segnalazioni, il navigatore (gdanav)
e l'auto — che qui è **CarPlay**. Questa pagina dice cosa è già nel codice, cosa
si fa una volta sola dalla parte di Apple, e come esce una versione.

## Cosa c'è nel codice

| Su Android | Su iPhone | Dove |
| --- | --- | --- |
| Android Auto col navigatore e la casa a un tasto | CarPlay, uguale: la mappa di gdanav, e dietro la casetta i comandi rapidi, i dispositivi, le azioni, come sta la casa | `app/ios/Runner/LaCasaInCarPlay.swift`, e CarPlay di gdanav |
| «Quasi a casa», arrivando | Uguale, come avviso sopra la mappa | `LaCasaInCarPlay.swift` |
| «Ok Google, naviga verso…» | «Ehi Siri, naviga con gdahome», «Portami a casa con gdahome», «Portami al lavoro con gdahome», «Aggiungi una tappa con gdahome»: anche in CarPlay, anche con l'app chiusa (dall'iOS 16). In italiano e in inglese | `app/ios/Runner/ComandiVocali.swift`, `it.lproj/AppShortcuts.strings` |
| La prova di guida di Android Auto | In CarPlay → Menu → Impostazioni → **Prova di guida**: il percorso si fa da solo | gdanav |
| Un motore Flutter per telefono e auto (`IlNavigatoreInAuto.kt`) | Lo stesso: acceso all'avvio in `AppDelegate` | `app/ios/Runner` |
| Il comando dell'auto eseguito da un motore senza schermo (`IlPonteDellAuto.kt`) | Lo esegue il motore dell'app, che con CarPlay è sempre acceso: stesso file, stesso canale `gdahome/auto/guarda` | `lib/auto/in_auto.dart`, `lib/main.dart` |
| La vibrazione della plancia (`navigator.vibrate`) | Il WebView dell'iPhone non ce l'ha: gliela dà l'app, e diventa un colpetto del telefono | `lib/schermate/riquadro/sul_telefono.dart` |
| Finestra riservata col lucchetto (`FLAG_SECURE`) | L'istantanea delle app recenti è coperta da un velo nativo. Vietare la fotografia dello schermo, sull'iPhone, non si può | `SceneDelegate.swift` |
| Niente copie (`allowBackup=false`) | I file dell'app fuori dalle copie di iCloud; i segreti stanno nel portachiavi, solo su questo telefono | `AppDelegate.swift` |
| Schermata d'avvio coi colori dell'app, chiara e scura | Uguale | `Assets.xcassets/FondoAvvio.colorset` |

Il progetto è per **iPhone e iPad**: sull'iPad la plancia usa il formato
largo che ha già, e gira in tutti e quattro i versi (serve per stare accanto
a un'altra app). gdanav invece, da solo, resta solo iPhone. Dall'iOS 15, col privacy manifest (`PrivacyInfo.xcprivacy`) e la
cifratura dichiarata (`ITSAppUsesNonExemptEncryption = NO`: è quella
standard). La posizione e la voce vanno anche in background: servono al
navigatore con CarPlay acceso e il telefono in tasca.

## Una volta sola, dalla parte di Apple

1. **Apple Developer Program** (99 $ l'anno), su
   [developer.apple.com/programs](https://developer.apple.com/programs/). Lo
   stesso account serve anche per gdanav.
2. **L'identificativo dell'app**: Certificates, Identifiers & Profiles →
   Identifiers → `+` → App IDs → `com.gdahome.gdahome`.
3. **L'app in App Store Connect**
   ([appstoreconnect.apple.com](https://appstoreconnect.apple.com)) → Le mie
   app → `+` → Nuova app: iOS, nome «gdahome», lingua italiano, bundle ID
   `com.gdahome.gdahome`, SKU `gdahome`.
4. **La chiave per GitHub**: App Store Connect → Utenti e accesso →
   Integrazioni → App Store Connect API → Chiavi del team → `+`, ruolo
   **Amministrazione** (Admin: il certificato di distribuzione, che Xcode
   si fa dare da Apple a ogni build, con «Gestore dell'app» non si crea). Si scarica il `.p8` (una volta sola: poi Apple non lo
   ridà) e si segnano l'**ID chiave** e l'**ID emittente**. L'**ID del team** è
   in developer.apple.com → Account → Membership.
5. **I quattro segreti**, nell'ambiente **`negozio`** della repository
   (Settings → Environments → negozio), accanto a quelli del Play Store:

   | Segreto | Cosa |
   | --- | --- |
   | `APPLE_CHIAVE_P8` | il contenuto del file `.p8`, righe `BEGIN`/`END` comprese |
   | `APPLE_CHIAVE_ID` | l'ID chiave (10 caratteri) |
   | `APPLE_EMITTENTE` | l'ID emittente (un UUID) |
   | `APPLE_SQUADRA` | l'ID del team (10 caratteri) |

   Certificato e profilo non servono: con la chiave, Xcode se li fa dare da
   Apple a ogni build.

### CarPlay: il permesso di Apple

In CarPlay la domotica da sola non entra — Apple tiene le categorie chiuse —
ma gdahome ci entra come **navigatore**, perché dentro c'è gdanav, con la casa
dietro il tasto con la casetta: esattamente come su Android Auto. Il permesso lo
concede Apple app per app, e ci mette da qualche giorno a qualche settimana:
si chiede subito su
[developer.apple.com/contact/carplay](https://developer.apple.com/contact/carplay/),
categoria **Navigation**, per `com.gdahome.gdahome`.

Finché non arriva l'app esce lo stesso, **senza CarPlay**: il permesso è fuori
dalla firma (`Runner.entitlements` è vuoto). Quando Apple dice di sì:

1. developer.apple.com → Identifiers → `com.gdahome.gdahome`: si spunta
   **CarPlay Navigation**.
2. Su GitHub, Settings → Secrets and variables → Actions → **Variables** →
   `GDAHOME_CARPLAY` = `si`. Da lì la build usa `RunnerCarPlay.entitlements`.

Per provarlo prima, su un Mac: Xcode → Open Developer Tool → Simulator, e nel
simulatore I/O → External Displays → CarPlay. Nel simulatore il permesso non
serve.

## Come esce una versione

**Le Prove** (`prove.yml`) costruiscono l'app per iPhone su un Mac di GitHub,
senza firma, sulle richieste di unione e su main: se è verde, lo Swift e i
plugin stanno in piedi. È il primo posto da guardare: senza un Mac questo
codice non si costruisce, e la prima volta è lì che si vede.

**L'app da provare** (`app.yml`), lavoro **iPhone (IPA)**:

- compila sempre; con i quattro segreti fa anche l'archivio **firmato**;
- va su **TestFlight** a ogni etichetta, o lanciando a mano con **testflight**
  spuntato. Con **prova del negozio** si ferma all'archivio firmato;
- il numero del pacchetto è quello della corsa, quindi sale sempre; il nome
  della versione è quello di `pubspec.yaml`, e sull'etichetta la versione
  scritta nell'app è quella del rilascio, come su Android;
- su un'etichetta con i segreti a metà si ferma, come fa Android.

Dopo qualche minuto arriva la mail di Apple, e dall'app TestFlight
sull'iPhone si installa, senza computer.

### Sull'App Store

Da App Store Connect: si sceglie la build arrivata da TestFlight e si manda in
revisione. La prima volta servono:

- **le schermate** dell'iPhone da 6,9": `node collaudo/guarda.mjs --iphone`
  le fa a 1290 × 2796, in `collaudo/foto/iphone/` (vedi `collaudo/README.md`).
  Quelle del Play Store, a 956, l'App Store non le prende. Le prime cinque
  sono già in `docs/negozio/iphone/`;
- **le schermate dell'iPad** da 13": `node collaudo/guarda.mjs --ipad` le fa
  a 2752 × 2064, in `collaudo/foto/ipad/`. Le prime cinque sono in
  `docs/negozio/ipad/`;
- **i testi**: sottotitolo (30 caratteri), descrizione, parole chiave (100),
  URL di supporto (`https://gdahome.org`) e della privacy
  (`https://gdahome.org/privacy.html`). Una proposta è in
  [`app/negozio/app-store.md`](../app/negozio/app-store.md);
- **Privacy dell'app** (come il privacy manifest): posizione precisa, solo
  nel navigatore; foto o video, contenuti dell'assistenza e dati di diagnosi,
  solo dentro una segnalazione che si manda. Tutto per le funzionalità
  dell'app, niente collegato a un account, **niente tracciamento**;
- **la classificazione per età** (il questionario: tutte «no»);
- **per la revisione**: gdahome senza una casa non mostra niente. Nelle note
  per chi rivede l'app va scritto come abbinarla a una casa di prova (un
  codice di abbinamento valido per qualche giorno, o un video), altrimenti la
  risposta è la regola 2.1, «non si riesce a provare l'app».

Le «Novità» di ogni versione stanno in `app/negozio/it-IT.txt` e `en-US.txt`,
per il Play Store; per l'App Store, per ora, si incollano a mano nella scheda
della versione.
