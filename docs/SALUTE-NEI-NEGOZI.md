# La Salute nei negozi: cosa fare in App Store Connect e nella Play Console

La pagina «Salute» dell'app legge le misure dell'orologio (Apple Salute su
iPhone, Health Connect su Android) e le manda **solo** alla casa
dell'utente. Il codice c'è; questi passi stanno nelle console, e li fa chi
le tiene. Il perché di ogni scelta è in `app/lib/salute/il_corpo.dart` e in
`ponte/src/il-corpo-dal-telefono.js`.

## iPhone (App Store Connect / Apple Developer)

1. **HealthKit sull'App ID.** La firma è automatica (`app.yml`,
   `-allowProvisioningUpdates`): alla prima build Xcode aggiunge la
   capacità HealthKit al profilo da solo. Se la build si ferma con un errore
   di profilo, su developer.apple.com › Identifiers › l'App ID di GdAHome ›
   spuntare **HealthKit** e salvare.
2. **Privacy dell'app** (App Store Connect › App Privacy): aggiungere
   **Health & Fitness › Health**, uso «App Functionality», **non** collegato
   a tracking, **non** usato per la pubblicità. Va dichiarato «Linked to the
   user»: la casa lo mostra col nome della persona.
3. **Note per la revisione** (da incollare):

   > GdAHome reads the health readings the user selects (steps, heart rate,
   > blood pressure, weight, sleep…) from Apple Health, only after the user
   > turns on Menu › Health. Readings are sent end-to-end encrypted only to
   > the user's own Home Assistant at home (the GdAHome add-on), where they
   > appear on the Health page of their dashboard. Nothing is sent to our
   > servers, nothing is written to Apple Health, nothing is used for
   > advertising. Turning it off deletes the readings from the home.

4. La privacy policy pubblica è `docs/PRIVACY.md`, sezione «La salute».

## Android (Play Console)

La release Android aspetta ancora la revisione di Google: questi passi
servono per la prossima.

1. **Dichiarazione dei permessi salute** (Play Console › Policy › App
   content › Health apps / Health Connect): dichiarare la lettura di
   STEPS, HEART_RATE, RESTING_HEART_RATE, WEIGHT, BODY_FAT,
   BLOOD_PRESSURE, OXYGEN_SATURATION, SLEEP, ACTIVE_CALORIES_BURNED, con lo
   scopo «mostrare all'utente le sue misure nella sua casa domotica». Solo
   lettura, nessuna scrittura.
2. **Data safety**: «Health info» e «Fitness info» raccolti, cifrati in
   transito, **non** condivisi con terzi, eliminabili dall'utente
   (spegnendo «Salute»).
3. **Android 8 come minimo** (API 26): lo chiede Health Connect. I
   telefoni con Android 7 non ricevono più aggiornamenti.
