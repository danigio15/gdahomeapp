# Cosa cambia, giro per giro

Questo è quello che Home Assistant fa vedere quando dice «Aggiornamento
disponibile»: prima di premere si legge cosa arriva. Il numero è quello della
plancia che l'add-on ha dentro; il quarto numero — `1.4.32.2` — sono le
correzioni dell'add-on fra due plance.

## 1.4.32.4

**«Errore di configurazione»: adesso l'add-on dice quale dei casi è.** Erano
cinque, e uno solo si aggiusta riavviando. Il più ostinato è una **Plancia
rimasta dall'integrazione DashboardModern**: quella voce apre con l'errore per
sempre, e riavviare non serve. L'add-on lo sapeva — lo scriveva nel registro —
e non lo diceva a nessuno. Adesso lo dice nella sua scheda e con un avviso in
Home Assistant, col nome della voce e dove si leva (Impostazioni → Dashboard).
Non la tocca: una dashboard è di chi ci abita.

**E l'anello del pannello si è aperto.** Nella console il tasto «Apri gdahome»
apre l'app in questa stessa scheda — deve restare così, se no quell'indirizzo
dopo qualche minuto risponde 401. Ma l'app, senza nessuna casa abbinata,
diceva «apri gdahome dalla barra laterale e premi Genera QR code», e la barra
laterale riportava all'app: il codice non si generava **mai**. Adesso l'app sa
di essere servita dall'add-on, e ha un tasto che riporta alla console.

E nella scheda dell'add-on, in cima: **gdahome è un add-on, non
un'integrazione, e su HACS non si mette.** HACS lo rifiuta e non dice perché.

## 1.4.32.3

**Le segnalazioni si aprono anche da Home Assistant.**

Nella plancia la finestra «Segnalazioni» c'era già, col suo modulo — ma sopra
c'era una riga rossa, «Le segnalazioni stanno nell'app, non nella plancia», e
sotto «l'invio non è configurato su questa plancia». Chi sta davanti a Home
Assistant e trova un difetto è nel momento esatto in cui vuole dirlo, e gli si
rispondeva «scaricati l'app».

Adesso passano, e dalla **stessa strada dell'app**: il ponte, il centralino, la
issue. Niente account GitHub da collegare, niente codice a sei cifre — che è la
differenza vera con come lo faceva l'integrazione di DashboardModern.

E si distinguono: sulla issue l'etichetta è **`da-home-assistant`** invece di
`da-app`. La stampa il ponte, non chi scrive: le due strade sono due comandi
diversi, e quale dei due sia arrivato lo sa solo lui.

Restano nella console dell'app i tre comandi di chi risponde — la coda di tutte
le case, prendersi una segnalazione, rispondere come manutentore. Da qui si
scrive, si rilegge e si risponde sotto le proprie: quello che serve a chi ha un
problema.

## 1.4.32.2

**La plancia non si apre più dicendo «Errore di configurazione».**

Era il difetto peggiore che questo add-on abbia avuto, perché non somigliava a
un difetto: la voce nella barra laterale c'era, si apriva, e dentro c'era
scritto «Errore di configurazione» e nient'altro — nessun motivo, niente da
fare.

Il motivo era uno: il file che disegna quella pagina sta nella cartella `www`
della configurazione, e Home Assistant apre quella cartella **soltanto quando
parte**. In una casa che non l'aveva — quasi tutte — la cartella la fa
gdahome al primo avvio, e fino al riavvio dopo Home Assistant quel file non lo
serve a nessuno.

Adesso l'add-on lo chiede a Home Assistant invece di darlo per fatto, e quando
la risposta è no:

- nella Plancia ci scrive **la frase invece dell'errore**: cosa manca, e dove
  si preme per sistemarlo (Impostazioni → Sistema → Riavvia Home Assistant);
- accende un **avviso** nella campanella di Home Assistant, che è dove chi ci
  abita guarda — non nel registro di un add-on;
- e **ci ripensa da sé**: al riavvio di Home Assistant la pagina torna a essere
  la plancia e l'avviso sparisce, senza che nessuno debba riavviare l'add-on.

Nella scheda dell'add-on, sotto le plance, adesso si legge anche cosa vede in
questo momento chi apre quella voce.

## 1.4.32.1

La plancia di DashboardModern **1.4.32** dentro l'add-on: il meteo nella
testata, e quarantadue file cambiati.

## 1.4.32

Gli **aggiornamenti di casa nel menu dell'app**: chi usa gdahome dal telefono
vede gli aggiornamenti che Home Assistant ha da fare, li installa da lì e può
riavviare, senza entrare in Home Assistant.

## 1.4.31

La plancia **1.4.31**, e chi aveva la dashboard installata in Home Assistant
non ricomincia da zero: la sua configurazione la ritrova.

## 1.4.30

La plancia **1.4.30**, con le due correzioni della 1.4.28.

## 1.4.28

La plancia **1.4.28**.

## 1.4.27

La plancia **1.4.27**, e in mezzo: gdahome parla **italiano e inglese** — l'app,
la plancia, questa scheda e le opzioni qui sotto — il menu dell'app si apre dai
tre trattini della plancia e dal tasto indietro, e in casa il telefono va
dritto al ponte invece di fare il giro dal centralino.

## 1.4.26

La plancia **1.4.26**, e **chi vede una plancia**: si scelgono gli utenti di
Home Assistant che ce l'hanno, e chi non è fra quelli non la trova nemmeno
nella barra laterale. Togliere il permesso vale subito, senza riaprire l'app.

## 1.4.25

La plancia **1.4.25**, il logo dell'add-on, e via la casella del gettone dalle
opzioni: una casella che tutti lasciano vuota prima o poi qualcuno la riempie.

## 1.4.24

L'add-on si chiama **gdahome**. Prima si chiamava «ponte», che è come si chiama
ancora dentro il programma: lì è quello che fa, qui è quello che si vede.
