# Cosa cambia, giro per giro

Questo è quello che Home Assistant fa vedere quando dice «Aggiornamento
disponibile»: prima di premere si legge cosa arriva. Il numero è quello della
plancia che l'add-on ha dentro; il quarto numero — `1.4.32.2` — sono le
correzioni dell'add-on fra due plance.

## 1.4.32.8

**Il firewall dell'ufficio, spiegato dove si legge l'indirizzo.**

«FortiGuard Intrusion Prevention — Access Blocked», al posto dell'app, con
scritto `Category: Newly Registered Domain`. Chi l'ha vista ha pensato che
fosse rotto qualcosa, o peggio che gdahome fosse su una lista nera, e l'ha
mandata a chiedere.

Non e' ne' l'una ne' l'altra: quella categoria guarda **la data di
registrazione** del dominio, non cosa c'e' dentro, e molti firewall aziendali la
tengono chiusa di serie come euristica contro il phishing. Passa da se' quando
il dominio esce dalla finestra. E intanto, su quella rete, la strada c'e' gia':
«Qui dentro» e' la stessa app servita dall'add-on, in locale, e l'app sul
telefono su quel Wi-Fi va diretta alla casa senza uscire.

Adesso c'e' scritto, nelle due lingue, accanto all'indirizzo «Da fuori casa»:
e' li' che quell'indirizzo si legge e si copia, quindi e' li' che serve —
«Due cose da sapere» sono diventate tre.

## 1.4.32.7

**Le correzioni non arrivavano, e nessuno lo diceva.**

La 1.4.32.6 toglieva la barra di Home Assistant sopra la plancia. Chi ha
aggiornato ha visto la barra ancora li', ed era vero: non era la correzione, era
il modo in cui arriva.

L'indirizzo della cartina porta la versione dell'add-on (`?v=1.4.32.7`) proprio
perche' il browser non si tenga quella di ieri. Ma l'elenco delle risorse Home
Assistant lo legge **all'avvio della pagina**: su una pagina di Home Assistant
gia' aperta continua a girare la cartina di prima, e qualunque cosa ci sia
dentro quella nuova non si vede. Serve una ricarica, una per aggiornamento — e
di questo non parlava nessuno: la console diceva che andava tutto bene, e i log
tacevano. Lo dicevamo solo la primissima volta, quando la cartina non c'era
ancora.

Adesso lo dicono la console — con la versione della cartina che Lovelace ha in
elenco, accanto — e i log dell'add-on. Nella Plancia invece non si tocca niente:
con la cartina di prima ancora in pagina la plancia si apre, e metterci un
foglietto vorrebbe dire cancellare una plancia che funziona a ogni
aggiornamento.

**E «non hai ancora collegato le tue entita'» su una plancia configurata.**

Due difetti diversi, e la 1.4.32.6 ne aveva curato uno solo. L'altro non c'entra
il filo lento: le quattro domande che la plancia si fa per decidere se e' vuota
guardano le entita', le stanze, le unita' clima e le luci. Una plancia fatta di
`HOME`, `AUTO`, `MUSICA`, `APRI PORTE` e `CONFIG` non ne riempie **nessuna** — e
la plancia diceva «non hai ancora collegato le tue entita'» a chi quelle sezioni
se le era fatte una per una.

Il ponte le chiavi le conta tutte, non quattro. Quindi quando il ponte dice
«questa plancia e' configurata» l'avviso non compare piu', nemmeno a
configurazione arrivata: fra le due risposte si tiene quella meglio informata. E
su una casa che davvero non ha niente l'avviso compare subito, com'e' giusto.

## 1.4.32.6

**La barra di Home Assistant sopra la plancia, e l'avviso che diceva una bugia.**

Due cose che si vedono, e vengono dalla stessa radice: la plancia ha cambiato
casa. Prima la portava un'integrazione, come **pannello**; adesso la porta
l'add-on, come tessera in una Plancia di Home Assistant.

**La barra.** Un pannello non ha niente sopra. Una dashboard Lovelace ha
_sempre_ la sua barra — il titolo, la lente, il piu', la matita — e quella barra
sopra la plancia non ci va. Il modo chiosco la copriva, ma da solo si accende
soltanto su uno schermo stretto comandato da un dito: su un tablet appeso al
muro e su un computer bisognava saperlo. Adesso la barra va via da se', e con
lei lo spazio che si teneva; torna se la dashboard entra in modifica, perche' e'
li' che sta «Fatto», e resta dov'e' in una vista a griglia, dove porta le
linguette per cambiare pagina. Chi la vuole comunque scrive `barra: true` nella
tessera.

**«Non hai ancora collegato le tue entita'».** Quell'avviso non deve comparire a
chi le ha collegate, e un guardiano c'era proprio per questo: tiene occupato il
posto dell'avviso finche' la configurazione — che arriva sul filo, dopo la
pagina — non e' arrivata. Solo che si arrendeva allo scadere di un orologio di
dodici secondi, e allo scadere l'avviso lo scriveva. In casa non si vedeva. Dal
browser, da fuori, dove i file della plancia arrivano **anche loro** sul filo un
pezzo per volta, dodici secondi finiscono prima che la pagina sia in piedi: e la
plancia diceva «configurala» a una casa con diciassette sezioni dentro. Poi non
se ne andava piu'.

L'orologio non serviva a misurare il filo: serviva a indovinare una cosa che il
ponte sa, perche' la configurazione la tiene lui. Adesso la dice, e l'orologio
non decide piu' niente: su una casa configurata si aspetta quanto serve; su una
casa che non ha niente l'avviso compare subito, invece che dopo dodici secondi.

## 1.4.32.5

**«Errore di configurazione»: il caso più frequente era ancora nudo.**

La 1.4.32.2 metteva il foglietto che spiega **solo** quando Home Assistant non
serve il file della tessera — cioè quando serve un riavvio. Ma nelle case che
hanno HACS la cartella `www` c'è da sempre, quindi quel caso non scatta: lì
manca **una ricarica della pagina**, perché la risorsa Lovelace è stata
dichiarata adesso e una pagina già aperta i file nuovi non li va a prendere. E
in quel caso compariva l'errore nudo.

Adesso la Plancia lo dice, con le parole giuste: «ricarica questa pagina, o
**F5**». E la tessera torna al suo posto da sé.

È lo stesso difetto che l'integrazione DashboardModern si è sentita segnalare
**dieci volte**, dall'altro lato: là funzionava il pannello e cadeva la
dashboard, qui funziona il pulsante della console e cadeva la voce nella barra
laterale. Le due strade non usano lo stesso pezzo di codice — una si carica da
sé, l'altra ha bisogno che il suo modulo sia arrivato alla pagina.

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
