# Le regole dei negozi: cosa dichiarare, passo passo

Le app sono già fatte come chiedono Google e Apple: la posizione si chiede
solo quando si apre il navigatore, la Salute legge e non scrive, niente
contatti, SMS, registro chiamate o accesso a tutti i file. Quello che resta
sta **nelle console**, e lo fa chi le tiene. Qui ci sono i passi e i testi
da incollare.

Vale per GdAHome (`com.gdahome.gdahome`) e per GdANav da sola
(`it.gdanav.gdanav`), quando c'è nel Play Store. GdAHome ha dentro il
navigatore, quindi dichiara anche la posizione.

## Google Play: le regole di fine ottobre 2026

### 1. Lo stato di operatore commerciale (da novembre 2026)

Play Console › **Impostazioni** (dell'account, non dell'app) › **Dettagli
account** › **Stato di operatore commerciale**.

1. Si sceglie «Sono un operatore commerciale»: si vendono abbonamenti.
2. Si confermano indirizzo, email e telefono dell'attività: sono quelli che
   il Play Store mostra nella scheda, nell'Unione europea.
3. Una volta per l'account: vale per tutte le app.

### 2. La posizione precisa (obbligatoria dal 27 gennaio 2027)

Play Console › l'app › **Contenuti dell'app** (Policy › App content) ›
**Autorizzazioni di accesso alla posizione**.

1. Funzione principale: **Navigazione**.
2. Perché la posizione approssimativa o il pulsante della posizione non
   bastano, da incollare:

   > The app is a turn-by-turn car navigator (also inside GdAHome as its
   > Navigator section, and on Android Auto). It needs precise location
   > continuously while the user is driving to follow the route, announce
   > maneuvers, lanes, speed cameras and speed limits, and to recalculate
   > when the driver leaves the route. Approximate location (about 2 km)
   > cannot place the car on the right road, and the one-time location
   > button cannot follow a moving car. Location is requested only when the
   > user opens the navigator, is used on the device and is never sold or
   > used for advertising.

3. Video: una registrazione dello schermo di 30 secondi con il navigatore
   che parte e guida (la Console lo chiede per la posizione in primo piano
   continua).
4. Lo stesso per GdANav da sola, col testo uguale.

### 3. Il servizio in primo piano per la posizione

Se la Console lo chiede (Contenuti dell'app › **Servizi in primo piano**):
tipo **location**, uso «Navigazione mentre si guida, anche a schermo
spento o su Android Auto», stesso video del punto 2.

### 4. Il Giappone (entro il 1° dicembre 2026)

Solo se l'app si vende **anche** in Giappone. Play Console › l'app ›
**Produzione** › **Paesi/regioni**: se il Giappone c'è, o lo si toglie, o si
compila il modulo di autorizzazione che Google ha mandato per email. Senza,
Google ferma i pagamenti **in tutti i paesi**.

### 5. Quando passeremo ad Android 17 (API 37)

Oggi le app non puntano ancora ad Android 17, e queste regole non
scattano. Quando succederà:

- **Rete locale**: GdAHome parla con Home Assistant sulla rete di casa,
  quindi va dichiarato il permesso della rete locale. Testo: «The app
  connects to the user's own Home Assistant server on the home network; a
  device picker cannot find it because it is a server, not a device».
- **Pulsante della posizione**: il navigatore resta con la posizione
  precisa continua (punto 2); le domande «una volta sola» passeranno al
  pulsante di sistema.

### 6. Da non fare

Contatti, AppFunctions, SMS e registro chiamate, accesso a tutti i file,
accessibilità, criptovalute, sconti per studenti: le app non li usano, non
c'è niente da dichiarare.

## La Salute

I passi sono in `docs/SALUTE-NEI-NEGOZI.md`. In breve:

- **Google Play**: Contenuti dell'app › **Health Connect**, la lettura delle
  nove misure; **Sicurezza dei dati** con «Informazioni sanitarie» e
  «Informazioni sul fitness».
- **App Store**: HealthKit sull'App ID, **App Privacy** con «Health &
  Fitness», e la nota per la revisione.

## Prima di premere «Invia per la revisione»

1. Le dichiarazioni qui sopra sono tutte salvate (la Console mette un punto
   rosso su quelle che mancano).
2. La Sicurezza dei dati è aggiornata con la Salute.
3. La versione in prova (test interno o TestFlight) è stata aperta su un
   telefono vero: navigatore, Salute, «Gestisci abbonamento».
