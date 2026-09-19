# Cosa cambia, giro per giro

Questo è quello che Home Assistant fa vedere quando dice «Aggiornamento
disponibile»: prima di premere si legge cosa arriva.

**Dalla 1.5.0 il numero è di gdahome.** Fino alla 1.4.32.16 era quello della
plancia che l'add-on ha dentro, e il quarto numero — `1.4.32.2` — erano le
correzioni dell'add-on fra due plance. Ma gdahome è più della plancia che
serve: è l'app sul telefono, il ponte in casa, il tramite che fa entrare da
fuori. La plancia dentro continua a dire la sua, e si legge dov'è sempre
stata: nella pastiglia «La plancia» della console. Sono due numeri perché
sono due cose.

## 1.5.9.3

**Fra «Installa» e l'installazione che parte non passa più un minuto.** Passa un
giro di rete. La casa, dopo ogni rapporto, resta in linea col quadro: quando chi
ti ha montato l'impianto preme il tasto, la tua casa lo sente nell'istante, lo
fa, e manda subito il rapporto che dice com'è andata. Prima quel comando
aspettava lì finché la casa non ci ripassava.

Resta una casa che **bussa**: non si apre nessuna porta e non c'è niente in
ascolto. È la stessa richiesta del rapporto, tenuta aperta più a lungo, e vuole
la stessa chiave. E se non si può tenere — un router di mezzo, il quadro spento
— non si perde niente: il rapporto al minuto porta il comando come ha sempre
fatto. Questo è in più, non al posto.

**Le scritte della barra in basso non si accavallano più.** Su uno schermo
largo con molte voci si leggeva «ENERGELÆTTRODOMESTIAUTGESTIONE TERMICGA»: le
scritte uscivano dalla loro linguetta e finivano una sopra l'altra. Adesso
quello che non ci sta si taglia coi puntini — «ELETTRODOM…» dice quale voce è,
due parole incastrate non dicono niente — e la barra, se le voci sono tante, si
scorre invece di finire sotto il bordo.

## 1.5.9.2

**«Dispositivi non collegati» adesso sono dispositivi.** In una casa vera ne
contava centottanta — in una casa che ne ha una quarantina — e i nomi erano
«Automazioni Elettrodomestici 1», «Avvio Ritardato Conteggio Elettrodomestici»,
«Aggiornamento package elettrodomestici». Non erano dispositivi: erano aiutanti,
automazioni e sensori template, roba che un dispositivo non ce l'ha e non lo
deve avere. Un numero così non è impreciso, è inservibile — chi lo legge non
può sapere quali di quelle righe siano un guasto, e smette di guardarle tutte.

Adesso si guardano **solo le entità di un dispositivo vero**: quelli che in Home
Assistant stanno in «Dispositivi e integrazioni», Zigbee compreso. E se Home
Assistant non dà i suoi registri, quella riga dice «questa casa non lo dice»
invece di tirare a indovinare.

**La plancia diceva di essere la 1.4.32.** Si leggeva in due posti: sotto
«CONFIGURAZIONE» e nella diagnostica runtime. Quei numeri li scrive uno script
della plancia quando la si costruisce, e di gdahome non sa niente; adesso si
rimettono in pari col nostro al momento di servirla, e non possono più
divergere.

**E il segno in cima a Configurazione è il logo di gdahome.** Prima c'era una
casetta azzurra disegnata dentro la pagina — non il logo di nessuno, e nemmeno
il nostro — e aprendo quella schermata il marchio cambiava sotto gli occhi.
Adesso è lo stesso file della testata: il nostro, o quello di chi ti ha montato
l'impianto se ne ha uno.

## 1.5.9.1

**La plancia diceva di essere la 1.4.32.** Nella console, alla riga «La
plancia», e nella stessa riga che l'app fa vedere: un numero fermo a quattordici
versioni fa, mentre l'add-on e l'app dicevano 1.5.9. Non era rotto niente — la
plancia era quella giusta — ma un numero sbagliato su una riga che serve a
capire cosa si ha installato è peggio di un numero che non c'è.

Quel numero sta nella carta d'identità della plancia (`ORIGINE.json`) e non lo
scriveva nessuno: chi la sigilla se lo riporta avanti dal giro prima, quindi
restava fermo al giorno in cui qualcuno l'aveva scritto a mano. Adesso lo scrive
lo stesso programma che scrive gli altri tre, e una prova tiene ferma la regola
che siano lo stesso numero.

## 1.5.9

**La plancia porta il nome e il logo di chi ti ha fatto l'impianto.** Se la casa
te l'ha montata un installatore e lui il suo marchio l'ha caricato, la voce
nella barra laterale prende il suo nome al posto di «gdahome», e in cima alla
plancia c'è il suo logo. Serve a te: il giorno che qualcosa non va, hai davanti
il nome di chi chiamare invece del nostro.

**Se togli l'installatore, torna gdahome — e non perdi niente.** È la domanda
che conta, e la risposta è nel come: si cambia **solo il titolo**. La
configurazione della plancia sta sotto il *profilo*, e il profilo non si sfiora:
cambiare il titolo è come cambiare la targhetta sulla porta, quello che c'è
dentro la stanza non si muove. Tessere, colori, stanze, avvisi: tutto dov'era.

**E se la plancia l'hai rinominata tu, quel nome non lo tocca nessuno.** Né un
installatore che arriva, né uno che se ne va, né l'interruttore qui sotto. Si
tocca solo quello che ci abbiamo messo noi: «gdahome», o il nome che ci aveva
messo l'installatore di prima.

**Il logo lo scarica il ponte, non il tuo browser.** Potrebbe prenderselo la
pagina da sola — il quadro lo serve a chiunque — e non si fa: ogni volta che
apri la plancia, il tuo browser andrebbe a farsi vedere da una macchina che non
è la tua, e chi tiene il quadro si troverebbe in mano gli orari in cui in casa
tua si guarda la plancia. Lo prende l'add-on, una volta al giorno, e da lì in
poi lo serve lui dalla rete di casa.

**C'è l'interruttore per dire di no:** *Casa › Lascia che la plancia porti il
marchio di chi ti ha fatto l'impianto*, acceso di serie. Spento resta gdahome, e
non cambia nient'altro — il rapporto parte lo stesso.

**E nel cruscotto dell'installatore** il suo marchio sta in testata al posto del
nostro, col suo nome. Si carica dalla pagina «Abbina»: PNG, JPEG, WEBP o SVG
fino a 128 kB.

## 1.5.8

> **Prima di aggiornare, tieni sotto mano il codice del quadro** (e, se le usi,
> le chiavi del cruscotto e della gestione). Le caselle cambiano posto, e
> secondo come si comporta il Supervisor potrebbe toccarti rimetterle una
> volta. Le trovi dove sono adesso: Impostazioni › Add-on › gdahome ›
> Configurazione.

**La configurazione è in sezioni.** Erano tredici caselle una sotto l'altra, e
le leggevano tre persone diverse di cui due non c'entravano niente: chi apriva
la scheda si trovava fra i piedi «La chiave della console» e «La chiave della
gestione» senza nessun modo di capire che non lo riguardavano.

Adesso sono cinque gruppi con un titolo:

- **La casa** — la tua parte, e per quasi tutti l'unica che conta
- **Chi installa** — solo se gdahome lo monti in casa d'altri
- **Chi tiene il quadro** e **L'assistenza** — una casa sola al mondo ciascuna
- **Avanzate** — due numeri che non cambia quasi nessuno

Home Assistant non ha titoli di sezione: li disegna **solo** per le caselle
annidate. È l'unico modo che c'era, e il prezzo è quello scritto qui sopra. In
cambio il prefisso nel nome sparisce: «Casa · Da fuori casa» adesso è «Da fuori
casa» dentro «La casa», che è la stessa cosa detta una volta sola.

**E il cruscotto dell'installatore si legge a capitoli.** La scheda di una casa
era una colonna di dieci riquadri tutti sullo stesso piano: chi la apriva per
sapere cosa gli toccava se li leggeva tutti e dieci, e il collaudo — che è la
risposta — stava in mezzo alla macchina e alle versioni. Adesso ci sono tre
titoli, perché le domande che uno si fa aprendo un impianto sono tre: **Cosa
c'è da fare**, **Come sta**, **Cos'è di preciso**.

**Il ponte legge tutt'e due le forme.** Se il Supervisor si tiene quello che
avevi scritto, non ti accorgi di niente e la casa continua a mandare il suo
rapporto senza che tu tocchi nulla. Se lo butta, lo rimetti una volta e non
succede più.

## 1.5.7

**Via il bollo dalla testata del cruscotto e della gestione**, e il tasto del
menu di Home Assistant torna a sinistra, dov'è quello di Home Assistant e dove
uno lo cerca.

Ci si era sbattuto due volte. Quel tasto *galleggia*: sta nel documento di
fuori, sopra la pagina, e la pagina non sa di averlo addosso. A sinistra si
sedeva sopra il bollo; spostato a destra, si è seduto sulla nav. Scansarlo non
funziona — da una parte o dall'altra, sotto c'è sempre qualcosa.

Adesso non lo si scansa: **gli si fa spazio.** La pagina si accorge da sola di
stare dentro un riquadro e gli lascia il posto in cima, e solo lì: aperta in un
browser quel tasto non c'è, e un buco sarebbe solo un buco. Il bollo resta dove
serve davvero — accanto agli aggiornamenti di gdahome, dove distingue la roba
nostra senza scaricare niente.


**Dal cruscotto si installa.** Era il pezzo che mancava: il quadro faceva
vedere cosa c'era da aggiornare in ogni casa e non c'era modo di farlo. Il
tasto «Installa su N case» stava lì da un anno senza essere agganciato a
niente — nessun `onclick`, nessuna chiamata — quindi non installava un bel
niente, e chi lo premeva non se ne accorgeva nemmeno.

**Verso casa tua non si apre nessuna porta.** È la cosa da leggere per prima.
Non c'è nessun buco nel router, nessun servizio in ascolto, nessun indirizzo da
difendere: è questa casa che ogni minuto manda il rapporto, e nella risposta
trova — qualche volta — una riga che dice cosa fare. Chi non manda il rapporto
non riceve niente, e chi toglie il codice smette di mandarlo.

**È un secondo interruttore, e nasce spento.** Nelle opzioni c'è
`Casa · Lascia che chi ti ha fatto l'impianto aggiorni da lontano`. Mandargli i
numeri l'hai già deciso incollando il codice; questa è un'altra decisione, e la
prendi tu. Spento — cioè finché non lo accendi — nel suo cruscotto il tasto non
c'è e al posto suo c'è scritto perché.

**Un verbo solo:** far partire un aggiornamento che questa casa *ha già in
attesa*, gli stessi che vedi tu in Impostazioni. Non apre la tua plancia, non
legge i tuoi sensori, non tocca la tua configurazione, non esegue comandi.
L'elenco dei verbi sta nel programma del ponte, non nel messaggio: una parola
che non è in quella lista viene rifiutata.

> I documenti dicevano da tempo che i verbi erano due, con `riavvia` accanto.
> Non c'è. Adesso i documenti dicono quello che c'è.

**Si nomina per nome e salto di versione**, non per entità — «Shelly Plus», da
`1.2.0` a `1.3.0` — perché nel rapporto l'entità non viaggia. Ne viene la regola
più utile di tutte: se nel frattempo quella versione è già stata installata, o
ne è uscita un'altra, il salto non torna e **non si fa niente**. Un tasto
premuto ieri non installa una cosa diversa oggi.

**Uno per volta**, e per questo non c'è nessun «installa tutti»: due insieme su
una casa sola vogliono dire non sapere quale dei due non è tornato. Il tasto
chiede conferma due volte, perché non stai premendo un tasto sul tuo computer.

**Dove si accende, detto dove serve.** Quando una casa non ha aperto la
manutenzione, il cruscotto dell'installatore adesso non dice solo «è chiusa»:
dice la strada esatta da fare — *Impostazioni › Add-on › gdahome ›
Configurazione*, la casella col suo nome per intero — perché è lui che deve
spiegarla al cliente al telefono. Da lì non si accende: sarebbe il permesso che
se lo dà da solo.

**Quello che ti è stato fatto lo leggi tu.** Cosa è stato chiesto e com'è andata
stanno dentro il rapporto, e il rapporto nella scheda «Il quadro» si legge
parola per parola: non un riassunto di quello che è successo, la cosa stessa che
è partita. E nel registro dell'add-on c'è la riga con l'ora.

## 1.5.6.5

**Gli aggiornamenti nel quadro, con il logo e con cosa cambia.** Erano
pastigline: «Shelly Plus · 1.2.0 → 1.3.0», e basta. Nell'app quella stessa
schermata ha il logo di chi porta l'aggiornamento e le note della versione, e
non c'era nessun motivo perché il quadro ne mostrasse meno — è lo stesso
elenco, e chi lo guarda deve prendere la stessa decisione.

**Il logo si compone, non si scarica da un indirizzo che arriva.** Da casa
parte una *parola* — `shelly`, `zha`, `homeassistant` — e l'indirizzo dei
marchi di Home Assistant lo sa il quadro. È la differenza fra una casa che
dice «il mio logo è questo» e una casa che dice «vai a bussare qui»: la
seconda, chiunque possa scrivere l'attributo di un'entità la può usare per
mandare il browser dell'installatore dove vuole. Roba nostra a parte, che
porta il bollo del quadro, disegnato nella pagina e mai scaricato.

Add-on e Home Assistant passano dalla stessa porta (`hassio`) e non hanno lo
stesso segno: un add-on la sua icona ce l'ha nella macchina di casa, e da
fuori non si prende — resta l'iniziale, che dice più del logo del Supervisor
ripetuto venti volte. Un firmware che arriva per MQTT porta il marchio di
Zigbee2MQTT, e solo se quell'add-on in casa c'è davvero.

**E la stessa riga la disegnano tutt'e due le schermate.** Prima erano due —
righe nella scheda di una casa, pastigline nella flotta — e una delle due
restava sempre indietro. Adesso è una.

## 1.5.6.4

**I dispositivi che non rispondono adesso hanno un nome.** Prima nel quadro
dell'installatore erano dodici pastiglie così: `#00a7`, `#033f`, `#03ad`.
Quattro cifre ricavate dal nome con un sale che non usciva da casa, e
servivano a dire *è lo stesso di ieri* oppure *è un altro* — cioè a
distinguere un apparecchio morto da una rete che balla.

Era la scelta giusta finché quella spia serviva a **sapere**. Non regge nel
momento in cui deve servire a **riparare**: davanti a dodici codici chi ha
montato l'impianto sa che dodici cose sono giù e non sa da dove cominciare, e
finisce che telefona a chi ci abita per farsi leggere i nomi — cioè quei nomi
escono lo stesso, per telefono, e il quadro non è servito a niente.

**Quello che parte adesso, detto per intero:** il nome dei dispositivi che in
quel momento non rispondono. Solo quelli. Di tutti gli altri — quelli che
funzionano — non parte nemmeno l'elenco: una casa con duecento apparecchi a
posto e due giù manda due nomi. Niente stati di sensori, niente persone,
niente SSID, niente indirizzo pubblico. Sta scritto nella casella dell'add-on
prima che tu incolli il codice, e nella scheda «Il quadro» lo rileggi parola
per parola, col tasto per smettere accanto.

**La spunta del collaudo segue.** Si chiamava «Nessuna entità sparita» e
contava le entità; adesso è **«Sono collegati tutti»** e conta gli apparecchi,
con le stesse parole del riquadro qui sopra. (Nella prima stesura era rimasta
indietro e diceva «undefined su 180», rossa per sempre: trovata guardando la
pagina, non le prove — che ora ci sono.)

**E si contano per apparecchio, non per entità.** Un termostato che se ne va
portava giù cinque righe — temperatura, umidità, batteria, e via — e adesso ne
fa una: «Termostato soggiorno». Il conto delle entità c'è lo stesso, sotto, che
è un'altra domanda. Il nome è quello che hai messo tu, se gliene hai messo uno:
«Frigo» si trova, `Shelly Plus Plug S-6A3F` no.

## 1.5.6.3

**Il tasto del menu si sedeva sopra il marchio della pagina.** Stava in alto a
sinistra, dove sta l'hamburger di Home Assistant — e lì sotto, nel Cruscotto e
nella Gestione, c'è già il marchio del quadro, che spuntava da sotto il tasto.

Ora sta in alto a destra. Non è dove uno se lo aspetta, ed è il prezzo: quel
tasto galleggia su una pagina che non sa di averlo addosso e non gli fa spazio.
Ma un tasto fuori posto si trova, una cosa coperta no.

## 1.5.6.2

**Il cruscotto dell'installatore si apriva bianco.** Colpa della 1.5.6.1, e di
un carattere: un backtick dentro un commento, dentro una stringa che i backtick
li usa per delimitarsi. Da lì in poi il file non era più un programma, e il
browser si fermava — pagina vuota, nessun messaggio, e niente nel registro
dell'add-on perché succedeva nel browser.

Niente di rotto nei dati: era solo la pagina che non si disegnava.

**E adesso una prova legge quel programma prima di te.** Erano 678, e nessuna
lo faceva: c'è chi lo legge come testo e chi ci cerca dei numeri, nessuna aveva
mai provato a leggerlo *come codice*. Era l'unico file del progetto che
arrivava a destinazione senza che nessuno l'avesse mai aperto.

## 1.5.6.1

*Tutto nel cruscotto di chi installa. Nelle case non cambia niente.*

**Gli aggiornamenti si leggono per casa.** Erano raggruppati al contrario — un
riquadro per ogni cosa da installare, e sotto le case che ce l'hanno indietro —
perché con quaranta impianti la domanda è «chi è indietro su Home Assistant
Core». Reggeva su un gesto che non c'era: il tasto «Installa su N case» non è
mai stato collegato a niente. Restava solo il costo: con **una** casa sola,
sedici riquadri che dicono tutti «1 casa». Ora una casa per riquadro, con dentro
cosa le manca, e il nome si preme per aprirla.

**«Rinomina» non apre più il popup del browser.** Sul telefono si apriva come un
avviso di sistema — «la pagina all'indirizzo … indica» — cioè con l'aria di una
cosa andata storta. Ora è una casella nella pagina, col nome di adesso già
dentro da correggere.

**E la pastiglia di «Abbina» conta solo i codici in attesa.** Sommava anche le
case senza nome, così una casa appena abbinata lasciava acceso un «1» che si
legge in un modo solo: c'è un abbinamento che non è andato. Era andato.

## 1.5.6

**Se sbagli casella, adesso te lo dice.**

Nella scheda ci sono due caselle che vogliono una stringa a caso, e da fuori si
somigliano: il codice che abbina una casa, e la chiave con cui un installatore
apre il proprio cruscotto. Scambiarle è successo alla prima persona che ci ha
provato, e quello che si prendeva era un `403` a ogni giro — per sempre, perché
quella stringa un invito non lo sarà mai. Un guasto che non dice niente e non
smette manda a cercare il rotto nel quadro, non nella casella.

I due però si distinguono: **un codice di abbinamento è lungo sedici, una chiave
trentadue**. Adesso il conto lo fa la macchina, e dice quale delle due hai
incollato e dove va.

**E ogni casella dice in testa chi la deve compilare** — `Casa ·`,
`Installatore ·`, `Gestore ·`, `Assistenza ·`. Home Assistant non ha titoli di
sezione: disegna dodici caselle una sotto l'altra, e l'unico posto dove scrivere
«questa non è roba tua» è il nome. Dove il prefisso cambia, cambia il pubblico.

**L'hamburger è tornato.** Togliendo la barra di Home Assistant se ne andava
anche il modo di riaprire il suo menu: chi entrava nel Cruscotto o nella
Gestione restava dentro. Adesso c'è un tasto in alto a sinistra, dove
l'hamburger sta di solito.

E la pagina Abbina non dice più «quindici minuti» mentre il contatore ne mostra
millequattrocento, né manda a una casella che si chiama in un altro modo.

## 1.5.5.1

**La scheda dell'add-on si legge dall'alto in basso.**

Dodici caselle, e finora stavano in fila senza un ordine: «La chiave della
console» — che serve a una casa sola al mondo — stava in mezzo, fra i telefoni
e l'installatore. Chi leggeva dall'alto non aveva nessun modo di capire che
non era roba sua.

Adesso l'ordine è quello di chi legge: prima tutto quello che riguarda chi
abita la casa, poi le due caselle di chi installa, poi in fondo le tre chiavi
che restano vuote dappertutto tranne che in una casa.

**E i nomi dicono di quale cosa parlano.** In questa scheda ci sono tre codici
diversi — il QR che abbina un telefono, quello che dà l'installatore, e quello
che apre il cruscotto di chi installa — e finché uno si chiamava «Quanto vive
un codice» erano tre cose con un nome solo. Così anche «Giorni di silenzio»,
che era una poesia: adesso dice «Dopo quanto un telefono va riabbinato».

*Nell'app non cambia niente: è una correzione dell'add-on, e il numero
dell'app resta 1.5.5.*

## 1.5.5

**Il codice si scrive una volta sola, e le due voci si aprono come la plancia.**

Chi apriva «Cruscotto installatore» dopo aver messo il codice nella scheda
dell'add-on se lo sentiva richiedere da capo. Due volte lo stesso codice, e la
seconda è quella che fa pensare che la prima non abbia funzionato. Adesso
l'add-on lo consegna alla pagina, e la pagina non chiede più niente.

Non finisce nell'indirizzo — un `#chiave=…` andrebbe nella barra del browser,
nella cronologia e in ogni schermata mandata per chiedere aiuto — ma in un
messaggio diretto alla sola pagina del quadro. Chi la chiave se l'era già
battuta a mano non se la vede cambiare sotto.

**E sopra quelle pagine non c'è più la barra di Home Assistant.** Titolo,
lente, matita: roba che sopra una pagina a tutto schermo non ci va, ed è lo
stesso difetto che la plancia aveva già risolto. Adesso lo risolvono con lo
stesso pezzo di codice, non con due copie.

Le due pagine si chiamano anche come le voci che le aprono — «Cruscotto
installatore» e «Gestione installatori» — invece di presentarsi con un nome
diverso da quello su cui hai appena premuto.

## Prima di questa, tre cose che si vedevano solo usandole

**La pagina del cruscotto chiedeva una chiave che quella porta non ha mai
aperto.** Diceva «è quella che sta sulla macchina come QUADRO_CHIAVE», mentre
il server ha sempre voluto la chiave dell'installatore — quella che gli dà chi
tiene il quadro. Un installatore andava a cercare una variabile d'ambiente su
un computer che non ha mai visto.

**Il codice di abbinamento scadeva mentre lo si incollava.** Quindici minuti,
in cui dovevano starci: copiarlo, aprire Home Assistant, trovare l'add-on,
incollare, salvare, far ripartire il ponte. E nel caso vero non lo incolla chi
lo genera: lo manda a chi ci abita, che lo farà stasera. Quello che ne usciva
era un «403 questa chiave non apre niente», che non dice «scaduto». Adesso
vive **un giorno**.

**E una casa che si presentava ci metteva due minuti a comparire.** Trenta
secondi prima del primo rapporto, più il giro, più un minuto di ricarica della
pagina: tutti numeri giusti quando il passo era un quarto d'ora, tutti
sbagliati adesso. Ora sono dodici secondi, ed è il momento in cui qualcuno sta
davvero guardando lo schermo.

## 1.5.4.1

**Tre nomi per la stessa cosa, nella stessa schermata.**

Nella scheda dell'add-on c'era scritto «il tuo **cruscotto**», e la casella
sotto chiedeva il codice della «**flotta**». Poi ne compariva un terzo, il
«**quadro**». Sono la stessa cosa guardata da tre punti diversi, ma chi apre
quella scheda non ha modo di saperlo: «flotta» e «quadro» erano parole prese
da dentro il codice, finite davanti a chi il codice non lo legge.

Adesso ogni casella parla la lingua di chi la deve riempire:

- chi abita la casa incolla **«Il codice di chi ti ha fatto l'impianto»**, e
  non deve imparare nessun nome nuovo;
- chi installa incolla **«Il codice del tuo cruscotto»**, che è la stessa
  parola dell'interruttore sopra e della voce nella barra laterale;
- chi gestisce gli installatori incolla **«La chiave per gestire gli
  installatori»**, che è il nome della voce che fa comparire.

**E tre commenti nel codice dicevano il falso.** Sostenevano che quelle chiavi
«non finiscono sul disco di nessuna casa» — vero fino alla 1.5.3, non più
dalla 1.5.4, che è la versione che ce le ha messe. Un commento che mente è
peggio di nessun commento: chi lo legge smette di verificare.

Quello che resta vero, e adesso è scritto per bene: dalla console il codice
del cruscotto **non esce**. Sta nelle opzioni perché è lì che dice se la
sezione esiste, ma servirlo a chi apre la pagina vorrebbe dire darlo a
chiunque, in casa, apra quella pagina.

*Nell'app non cambia niente: è una correzione dell'add-on, e il numero
dell'app resta 1.5.4.*

## 1.5.4

**Le voci nella barra laterale non comparivano, e la colpa era dell'add-on.**

Chi accendeva l'interruttore non vedeva niente. Non era un permesso e non era
Home Assistant: il ponte creava la voce e un secondo dopo se la cancellava da
solo. Fa piazza pulita delle Plance che non ci sono più — giusto, se no
restano voci che non aprono più niente — e il Cruscotto e la Gestione
finivano in quel cestino perché il loro indirizzo comincia come quello delle
Plance. Adesso le salta.

**Senza il codice non c'è la porta, invece di una porta che non si apre.**

Le due chiavi si scrivono ora nella scheda dell'add-on, e sono loro a
decidere:

- il **Cruscotto** vuole l'interruttore «Questo Home Assistant è di chi
  installa» acceso **e** il codice della flotta. Da solo l'interruttore non
  apre più niente;
- la **Gestione** non ha più nessun interruttore. È una casa sola al mondo, e
  un interruttore su tutte le altre è un invito a premerlo: adesso c'è la sua
  chiave o non c'è la voce.

Prima bastava accendere, e la chiave la chiedeva la pagina — così non finiva
sul disco di nessuno, ed era il pregio. Il difetto era che chi accendeva per
curiosità, o in casa di un cliente, si trovava comunque una voce nella barra
laterale: una porta che non si apre, ma che si vede, e una porta che si vede è
una domanda a cui qualcuno deve rispondere.

**Il prezzo, detto per intero:** le opzioni di un add-on stanno su disco in
chiaro e finiscono nei backup. Sono chiavi da scrivere sul proprio Home
Assistant, non su quello di un cliente. In tutte le case che non c'entrano le
due caselle restano vuote e non fanno niente.

**E il rapporto al quadro parte ogni minuto**, non più ogni quarto d'ora — e
si può scendere fino a un minuto, prima il minimo era cinque. Con quindici
minuti di passo un impianto fermo alle 9:02 si sapeva alle 9:15, e in quel
quarto d'ora il cliente aveva già telefonato: cioè era successo esattamente
quello che il quadro doveva evitare. Chi non manda niente a nessun quadro —
cioè chiunque abbia quella casella vuota — non se ne accorge.

## 1.5.3

**Per chi tiene il quadro: la gestione degli installatori nella barra laterale.**

C'è un interruttore nuovo nella scheda dell'add-on, «Questo Home Assistant è di
chi tiene il quadro». Acceso, nella barra laterale compare **Gestione
installatori**: da lì aggiungi un installatore, gli dai il suo limite, gli rifai
la chiave se la perde, o lo togli.

È l'altra metà dell'interruttore della 1.5.2: quello è di chi gli impianti li
monta, questo di chi decide chi può montarli. È una casa sola al mondo, e sugli
Home Assistant di tutti gli altri quella voce non c'è — non nascosta: assente.

**Nessuna delle due chiavi si scrive nella scheda dell'add-on**, né quella della
flotta né quella di gestione: le chiede la pagina, e restano nel browser di chi
le digita. L'interruttore dice soltanto se la voce c'è, e chi lo accendesse
senza avere la chiave si troverebbe una pagina che gliela chiede e basta.

Da quella pagina, come sempre, si vede **quanti** impianti ha ognuno e non
quali.

## 1.5.2

**Per chi installa: il cruscotto anche nella barra laterale di Home Assistant.**

Con l'interruttore «installatore» acceso compare una voce nuova,
**Cruscotto installatore**, che apre gli impianti che hai montato senza uscire
da Home Assistant. È la stessa cosa che la 1.5.1 aveva messo nell'app: adesso
c'è in tutti e due i posti, e in tutti e due mostra il cruscotto vero — non una
copia, che prima o poi racconterebbe un'altra storia.

La voce la vede solo chi amministra: porta agli impianti dei clienti di
qualcuno, e Home Assistant in casa lo aprono anche i familiari. Spegnendo
l'interruttore sparisce subito.

*Nella 1.5.1 quella voce c'era già, ma nel posto sbagliato: stava
nell'integrazione DashboardModern, che dalla 1.4 non arriva più nelle case —
la plancia viene dall'add-on. Non faceva danno e non la vedeva nessuno.*

## 1.5.1

**Se la casa te l'ha montata un installatore, adesso può accorgersi da solo
che qualcosa non va.**

Nella console di gdahome c'è una scheda nuova, «Il quadro». Chi ti ha fatto
l'impianto ti dà un codice, tu lo incolli lì, e da quel momento questa casa
gli manda ogni quarto d'ora **poche righe di numeri**: le versioni, quanto è
pieno il disco, quali add-on girano, quante entità non rispondono. Così si
accorge che qualcosa si è fermato prima che tocchi a te telefonargli.

**Quello che parte lo puoi leggere.** Non «manda dei dati»: nella stessa
scheda c'è il testo esatto che esce da qui, parola per parola, e non un
riassunto — perché un riassunto di quello che esce è proprio la cosa di cui
ci si dovrebbe fidare. Accanto c'è il nome di chi lo riceve, e il tasto per
smettere.

E quello che **non** parte, detto per intero: nessun nome di entità, nessuna
stanza, nessuna persona, nessuno stato di nessun sensore, il nome del tuo
Wi-Fi no e il tuo indirizzo pubblico nemmeno. Senza codice incollato non
parte niente e non si apre nessuna connessione: la casella vuota è lo stato
di serie.

Per chi gli impianti li monta, c'è anche un interruttore «installatore» che
accende la voce per arrivare al proprio cruscotto.

## 1.5.0

**Su iPhone i disegni si vedevano solo una volta.**

Nella barra in fondo, nelle tessere della Home, nel menu della
configurazione: il primo disegno c'era, gli altri erano sagome vuote o nere.
Su Android e sul computer si vedevano tutti, e questa differenza è la
diagnosi.

Un disegno a colori sfumati tiene le sue sfumature in un pezzo a parte, e
ogni copia le chiama per nome. I nomi erano **tre, fissi**, e il pezzo che li
definiva stava in un solo posto della pagina: la prima copia se lo prendeva,
e le altre chiamavano un nome che dal loro punto di vista non esisteva.
Chrome quel riferimento lo segue lo stesso; Safari no, e ha ragione lui.

Adesso ogni disegno si porta dietro le sue sfumature, con un nome che dice da
quale posto viene — la tessera, la voce di menu, la riga di quella entità. Le
pagine, le schede e le finestre sono state guardate una per una, e quello che
si vede è identico a prima: cambia soltanto che adesso si vede su tutti i
telefoni. Nell'app le stesse figure sono un file per disegno, dove il difetto
non può nascere — e una prova tiene ferme le due copie, così non si
scollano.

**Il nome dell'entità non si vede più dove non serviva.**

Sotto il nome di una porta c'era `binary_sensor.porta_cantina`, sotto una
batteria `sensor.telecomando_battery`, dentro le finestre dei dispositivi la
stessa riga. È la risposta a una domanda che si fa chi **configura** — quale
entità ho messo in questa casella — e chi configura ha le sue schede, dove
l'identificativo c'è, si legge e serve. Chi apre una pagina vuole sapere se
la finestra è aperta.

Via da sei pagine (Varchi, Presenza, Batterie, Macchine e rete, Le tue
sezioni, Le tue entità) e dalle finestre: quella di cosa è acceso, il
dettaglio di un'allerta, quella di una luce o di una presa. Al suo posto,
dove prima non c'era, **lo stato scritto in parole**: «Aperta», «In
riproduzione», «Riscalda», in una pastiglia del colore della sezione. Nelle
schede della configurazione l'identificativo resta dov'era.

**Sette segnalazioni, chiuse.**

_Il sensore dei rifiuti_ (#28): il SAVNO di Conegliano scrive la frazione in
attributi che non guardavamo, e sette ritiri diventavano un solo «Altro».
Adesso Umido e Secco oggi, Verde fra tre giorni, Carta e Vetro fra sei — e un
ritiro che porta via due frazioni diventa due pastiglie, perché sono due
bidoni da mettere fuori.

_L'autonomia dell'UPS_ (#9): «il mio CyberPower mostra il tempo residuo in
secondi invece dei minuti». Erano 1800 secondi letti come 1800 minuti, cioè
trenta ore di autonomia su una batteria che ne fa mezz'ora — la risposta
opposta a quella che si cerca, nel momento in cui è andata via la corrente.
L'unità adesso si legge dall'entità, che la dichiara: a chi configura non si
chiede niente.

E poi l'auto, il citofono, le stanze, i varchi, il clima: ognuna col suo
perché, tutte verificate su una casa vera prima di chiuderle.

**Gli elettrodomestici dicono quello che stanno facendo** (#27, #20).

«In funzione, ma la card indica spenta»: una lavastoviglie Bosch con Home
Connect, e gli elettrodomestici Samsung con SmartThings. Le entità c'erano e
gli stati arrivavano — «su schermata classica Home Assistant tutto funziona
correttamente» — ma Home Connect non pubblica la parola, pubblica il suo
indirizzo dentro il protocollo: `BSH.Common.EnumType.OperationState.Run`.
Una macchina che dice chiarissimo «Run» cadeva in fondo alla scala e usciva
SPENTA.

Adesso si guarda anche l'ultimo pezzo, quello dopo l'ultimo punto, e la
scheda scrive la **fase** invece dell'indirizzo. Una pausa, poi, non è un
ciclo nuovo: la lavatrice fermata e ripresa resta lo stesso lavaggio.

**Il radar, e la riga rossa del meteo.**

La mappa di OpenStreetMap rispondeva «Access blocked» — tagliano fuori chi
non è un browser che naviga — e una mappa che non si disegna non è una scelta
da lasciare in una tendina: è uscita, e chi ce l'aveva scritta a mano viene
portato su quella che funziona.

E dove il meteo non dà le previsioni c'era una riga rossa che sembrava un
guasto. Non lo è: quell'entità dice che tempo fa adesso e basta. Adesso lo
dice così, dicendo anche dove si sceglie l'entità giusta — e che il radar qui
sopra è un'altra cosa e funziona per conto suo.

**Da fuori casa: il lucchetto, e il tasto che diceva di sì.**

«Il problema è il certificato, anche a me esce non sicuro.» Il certificato
era sano: erano le nostre chiamate. L'app aperta su un indirizzo `https`
bussa a tutti gli approdi della casa insieme, e fra quelli c'è l'indirizzo di
rete locale, che è `http://192.168.…` — il browser non lo lascia passare e
marca la pagina. Da una pagina cifrata adesso non si bussa in chiaro.

E il tasto «Apri nel browser», premuto quando la casa non è agganciata al
tramite, apriva un'app che girava venticinque secondi e poi diceva «non trovo
la casa». La risposta c'era dopo un secondo — «questa casa adesso non è
collegata» — e restava nell'attesa. Adesso si legge subito, e la console lo
dice **prima**, accanto al tasto. Il perché di un filo che non si apre, poi,
non è più `getaddrinfo ENOTFOUND`: è «il nome non si risolve», «porta
chiusa», «nessuno risponde», «certificato scaduto», col rimedio accanto e la
riga tecnica in fondo per chi la vuole.

**Le didascalie e la fascia, misurate invece che indovinate.**

«Sistema le didascalie tagliate a metà parola»: non erano tagliate — chi non
ci sta prende un nastro che scorre avanti e indietro, e il bordo sfuma per
dire che il testo continua. Solo che sfumava **anche** dove il testo finiva
lì. Adesso il velo compare solo dal lato in cui c'è davvero altro.

E la fascia sotto il meteo si fermava quindici pixel sotto la propria
sfumatura, ai due capi della corsa: la prima e l'ultima pastiglia — quelle
che si sta aspettando — restavano sotto il velo senza più strada per
uscirne.

**Il ritratto senza buchi, e le tapparelle che non sono finestre.**

Due cose trovate guardando fotogramma per fotogramma il video di una casa
vera. Accanto a una faccia c'era un cerchio vuoto che sembrava un'icona non
arrivata: era il pallino di presenza, disegnato sempre, che per chi non ha
un'attività nota non aveva niente da mettere dentro — adesso, se non ha
niente da dire, non c'è. E una tapparella contata fra le finestre aperte
faceva dire «2 finestre aperte» a una casa che ne aveva una.

## 1.4.32.16

**La barra delle sezioni non si legge più attraverso.**

Su un tablet girato, sotto la barra si leggevano i titoli delle tessere che
le passavano dietro — «TEMPERATURA», «AUTO», «BATTERIE», «ARIA» — in
filigrana sopra i nomi della barra stessa. Non sembrava una barra di vetro:
sembrava un disegno doppio.

Misurato nel browser, non indovinato: col tema chiaro il fondo della barra
stava a `rgba(255,255,255,.92)` e il vetro smerigliato era **spento**.
Spento per una buona ragione — una sfocatura a schermo intero il browser la
ricompone a ogni scorrimento, ed è un costo che questa plancia si è levata
di mezzo — ma senza vetro quell'otto per cento di trasparenza non è una
macchia: è testo nitido. Sul telefono non si vedeva perché lì la barra sta
ritirata; su un tablet sta sempre in fondo.

La cura è il fondo **pieno**, non il vetro riacceso: dietro non passa più
niente da sfocare e il risparmio resta dov'era. Dal fondo della pagina la
barra la staccano l'ombra e il suo bordo chiaro, che c'erano già. Vale nei
due temi e solo quando la barra è in vista — tirata fuori, o tenuta ferma da
chi l'ha scelta così: ritirata resta com'era.

**E lo spazio in fondo alla pagina non c'entrava.** L'ho misurato prima di
toccarlo: arrivati in fondo, l'ultima tessera si porta sopra la barra. Quello
che si vede a mezza pagina è una barra che galleggia, ed è quello che fa una
barra che galleggia: per non averla mai sopra niente va messa di lato, e
quella è un'altra cosa — tutto il carrello delle sezioni è orizzontale.

## 1.4.32.15

**La barra delle sezioni su un tablet: i disegni alla loro misura vera, e il
nome che si legge.**

Le misure di serie sono quelle di un telefono tenuto in mano: il disegno di
una sezione sta in ventiquattro punti e il suo nome è scritto in **nove**.
Su un tablet in orizzontale, a mezzo metro dagli occhi, quei nove punti sono
una riga grigia che si indovina.

I disegni delle sezioni sono SVG col riquadro «0 0 32»: portarli a
trentadue non è ingrandirli, è **smetterli di rimpicciolire** — una figura
fitta schiacciata a tre quarti perde le linee sottili, e si vede. Il nome
passa da nove a dodici punti.

E la spaziatura si stringe per fare posto: i fianchi di ogni sezione da
quattordici a dodici punti, lo spazio fra una e l'altra da dodici a dieci.
Il conto torna: su un tablet largo milleottanta le sezioni ci stanno tutte
come prima, senza che la barra cominci a scorrere. Insieme a loro cresce lo
spazio riservato in fondo alla pagina — sedici punti, quanto è cresciuta la
barra — se no la barra più alta si mangiava proprio la distanza che serviva
a non coprire l'ultima tessera.

**Sul telefono non cambia niente, nemmeno girato.** La regola vuole almeno
settecentosessantotto punti di larghezza **e** seicento di altezza: un
telefono in orizzontale ha la prima misura e non la seconda, e su uno
schermo alto trecentonovanta una barra più alta si mangia le tessere.

## 1.4.32.15

**Il rapporto: la casa può dire come sta a chi te l'ha montata.**

Se l'impianto te l'ha fatto un installatore, adesso può darti una riga da
incollare nella casella **«Il quadro di chi ti ha fatto l'impianto»**: da quel
momento questa casa gli manda ogni quarto d'ora poche righe di numeri — le
versioni, quanto è pieno il disco, quali add-on girano, quante entità non
rispondono — e lui si accorge che qualcosa non va prima che tocchi a te
telefonargli.

**Senza quella riga non parte niente**, e non si apre nessuna connessione: in
una casa qualunque questo pezzo è codice che non gira.

**Nel rapporto non c'è niente di tuo.** Nessun nome di entità, nessuna
stanza, nessuna persona, nessuno stato di nessun sensore; il nome del tuo
Wi-Fi no, e il tuo indirizzo pubblico nemmeno. La regola si dice così: cosa
c'è nella scatola, non chi ci abita — «Mosquitto broker» ed `eth0` sono nomi
di prodotti e di schede. Le entità che non rispondono partono come quattro
cifre, con un sale che nasce in questa casa e non esce: servono a dire «è lo
stesso di ieri», e a niente di più. Non è una promessa scritta in un
documento: è una prova che compila un rapporto da una casa piena di nomi che
raccontano una famiglia e controlla che non ne esca nemmeno uno.

L'indirizzo **sulla rete di casa** invece c'è, ed è voluto: `192.168.1.50` non
dice chi sei, e a chi ripara queste macchine serve tutti i giorni.

E dove non si sa, si dice che non si sa. CPU, memoria e temperatura della
macchina il Supervisor non le ha — quelle che offre sono del suo contenitore,
non del ferro — e senza l'integrazione System Monitor restano vuote invece di
diventare zero: uno zero rassicurante su una scheda in ginocchio è peggio di
niente.

Non passa dal centralino di gdahome: va dalla casa al quadro e basta.

**E lo puoi leggere e fermare da qui.** In questa pagina, dove quella casella è
piena, compare la scheda «Il quadro di chi ti ha fatto l'impianto»: c'è scritto
a chi parla la tua casa e ogni quanto, e sotto «Cosa parte da qui» c'è
**l'ultimo rapporto spedito per intero**, com'è partita. Non un riassunto: il
testo. Un riassunto di quello che esce sarebbe esattamente la cosa di cui
dovresti fidarti.

Il tasto **«Smetti di mandarla»** ferma tutto adesso e svuota anche la casella,
perché se no al prossimo riavvio ricomincerebbe da sola. Se non ci riesce te lo
dice, e ti dice cosa fare a mano.

## 1.4.32.14

**La pastiglia dei rifiuti non si scrive due volte.**

«Indicazione rifiuti sulla pastiglia doppia»: nella fascia sotto il meteo
c'erano «Vetro OGGI» e «Vetro OGGI», e accanto restava posto per una
notizia sola invece di due. Chi scende le scale ha un bidone, non due.

Da dove veniva: nella plancia la regola «stesso materiale e stesso giorno è
lo stesso bidone» c'era già, ma solo per «il prossimo ritiro». Le **righe**
— quelle che finiscono nell'elenco della tessera e nella fascia — mettevano
in fila i sensori per materiale e il «Calendario dei ritiri» senza
guardarsi. Adesso la regola vale anche lì, ed è scritta una volta sola nel
modello dei rifiuti.

E sulla fascia c'è una seconda rete: due righe che si **leggono uguali** —
stesso segno, stesso nome, stesso giorno — sono una pastiglia sola. Così
chi ha due integrazioni che nominano lo stesso bidone non vede la scritta
doppia, e la sua configurazione non si tocca: nell'elenco della tessera ci
sono tutte e due, col loro nome.

**E i loghi degli aggiornamenti si aprono alla misura in cui si vedono.**
Arrivano a 256 punti per lato e nel riquadro se ne disegnano trentadue:
aperti com'erano, ognuno si teneva in memoria un quarto di mega — tre per
una casa con dodici aggiornamenti — e adesso sono sedici kilobyte a testa.
Non è la cura dello scatto che si vede da browser: quello l'ho misurato sul
banco e i tempi non si muovono. È memoria che non serviva a niente.

## 1.4.32.13

**Gli interruttori Zigbee prendono il segno di Zigbee2MQTT, non quello di
MQTT.**

Nella 1.4.32.12 la seconda strada era il marchio dell'integrazione, e per
i firmware Zigbee l'integrazione è `mqtt`: nei riquadri è uscito il logo
di MQTT. Che è vero e non serve a niente — MQTT è la **strada** che quel
firmware ha fatto per arrivare, non chi comanda l'interruttore. Tre
interruttori col logo di MQTT dicono quanto tre «S».

Chi li comanda sta in casa, ed è l'add-on di Zigbee2MQTT. Il suo segno si
prende da lì, dalla macchina di casa, senza chiedere niente fuori — e si
trova senza una domanda in più: Home Assistant fa un'entità `update.` per
**ogni** add-on installato, anche per quelli a posto, e ognuna si porta
dietro l'indirizzo della sua icona. Il ponte quegli stati li ha già in
mano.

Se Zigbee2MQTT gira da un'altra parte e in casa quell'add-on non c'è, non
si mette niente e resta l'iniziale: meno di un logo, ma non il nome di
un'altra cosa.

**E un marchio che non esiste adesso è un no.** I marchi di Home Assistant
servono lo stesso indirizzo in due modi, e in quello che il ponte usava
un'integrazione senza marchio non risponde «non c'è»: risponde con un
disegno che dice «logo mancante». Il telefono lo prendeva per un logo e lo
disegnava, al posto dell'iniziale. Ora quella strada chiede l'indirizzo
che risponde `404`, e l'iniziale torna al suo posto.

## 1.4.32.12

**Il logo di chi non ne dichiara uno: lo si chiede al registro.**

Nella 1.4.32.11 c'è scritto che gli interruttori Zigbee restano con la
loro iniziale, e che quella era la risposta giusta. Non lo era: tre «S»
identiche per «Switch casa», «Switch cortile» e «Switch tavernetta» non
dicono niente, e una riga che non si distingue dalle altre due tanto vale
che non ci sia.

Loro un indirizzo per il segno non lo dichiarano affatto. Però si sa **da
dove vengono**: il registro delle entità di Home Assistant dice
l'integrazione — `mqtt` per chi passa da Zigbee2MQTT, `zha` per chi parla
con la chiavetta — e le integrazioni hanno tutte il loro marchio. È lo
stesso segno che Home Assistant fa vedere nella pagina delle
integrazioni: non è il logo dell'interruttore, ed è quello di chi lo porta
in casa.

Così le strade diventano due, e la seconda si prende solo quando la prima
non c'è. Il registro lo si chiede una volta per entità, e solo per quelle
che aspettano davvero un aggiornamento; la risposta si tiene, anche
quando è «non si sa», che è un modo di non richiedere due volte una cosa
già chiesta.

## 1.4.32.11

**L'icona di un add-on la chiede al Supervisor, e non a Home Assistant.**

La 1.4.32.10 ha fatto scrivere nel registro cosa risponde un logo che non
arriva, e la prima casa vera lo ha detto subito:

```
il logo di update.studio_code_server_update:
/api/hassio/addons/a0d7b954_vscode/icon ha risposto 403
```

L'indirizzo era giusto — lo dichiara Home Assistant — ed era Home
Assistant a rifiutarlo. Quella strada, dentro Home Assistant, è un
passaggio verso il Supervisor con le **sue** regole di permesso: il segno
che l'add-on ha è quello del Supervisor, non di un utente amministratore,
e per l'icona di un add-on che non è lui la risposta è no. Per l'icona di
gdahome no, perché quella è la sua.

Al Supervisor la stessa cosa si chiede diretta, col suo segno — ed è
proprio per questo che il manifesto dichiara `hassio_role: manager`. Una
strada in meno in mezzo, e le regole di quella strada non c'entrano più.

Gli interruttori Zigbee restano con la loro iniziale, e quella è la
risposta giusta: non hanno un logo da nessuna parte, e anche Home
Assistant, nella sua pagina, per quelli disegna un segno generico.

## 1.4.32.10

**I loghi che non arrivano lo dicono, invece di sparire in silenzio.**

Nella 1.4.32.9 ogni riga degli aggiornamenti ha preso il suo segno, e in
una casa vera alcuni si vedevano e altri no — l'add-on con la sua icona sì,
Home Assistant sì, un add-on qualunque no, gli interruttori Zigbee no. Non
era il logo il problema: era che **non c'era modo di sapere perché**. Tre
silenzi, e sono chiusi tutti e tre.

Un 404 di Home Assistant è una risposta _riuscita_ con dentro un no, e
diventava «niente logo» senza lasciare traccia: da fuori non si poteva
distinguere un indirizzo storto, un segno non passato, e un add-on che
un'icona non ce l'ha. Adesso il registro dell'add-on scrive, per ogni logo
che non arriva, **dove** ha chiesto e **cosa gli ha risposto**.

Un salto di indirizzo — un `301` — tornava anche lui come una risposta
riuscita, con dentro niente. Ora si segue, uno solo, e solo verso un
indirizzo che sarebbe passato comunque.

E il terzo, che era il peggiore: **una caduta diventava «non ce n'è uno»,
per sempre.** Il filo che cade un momento, i marchi che non rispondono, un
`502` — e quella riga restava con l'iniziale fino a che l'app non si
riapriva. Adesso un intoppo si riprova alla lettura dopo; solo un
indirizzo che non esiste resta un no, perché domani non risponderà in un
altro modo.

I segni si chiedono a gruppi di quattro invece di uno per volta: uno per
volta il decimo aspettava i nove prima di lui, e uno lento teneva fermi
tutti quelli dopo. In una casa con dieci aggiornamenti si vedeva.

**E le correzioni dell'add-on adesso sono cento invece di dieci.** Il
quarto numero aveva una cifra sola, e dieci sono finite proprio qui: la
1.4.32.10 dava lo stesso numero di costruzione della 1.4.33 — un numero
che il negozio rifiuta, e non il giorno dello sbaglio, il giorno che si fa
la plancia nuova.

## 1.4.32.9

**Gli aggiornamenti di casa, con i loghi, e queste note lette dentro l'app.**

Se stai leggendo questo **dentro gdahome**, in un foglio che è salito dal
basso e che porta «Installa» in fondo, allora la cosa principale di questa
versione funziona: prima quel tasto si chiamava «Cosa cambia in questa
versione» e apriva una pagina di GitHub nel browser — su un telefono voleva
dire uscire dall'app, cercare la versione giusta in mezzo a tutte, e tornare
indietro a memoria a ritrovare la riga da cui si era partiti. Adesso le note
le chiede a Home Assistant, con lo stesso comando che usa la sua finestra, e
le mostra qui.

Si comincia da **questa** versione e non dal principio del file: il numero sta
già scritto in testa al foglio, e chi ha appena premuto su una versione non
vuole leggere l'introduzione di un changelog. Le versioni di prima restano
sotto, che è dove si vanno a cercare. E dove Home Assistant le note non le sa
dare — un firmware, un'integrazione vecchia — il foglio lo dice invece di
restare bianco, e offre la pagina di fuori come ultima spiaggia.

**E ogni riga ha il suo segno.** Sei righe con sei nomi scritti si leggono una
per una; col logo davanti si riconosce quello che si cerca senza leggere. Il
quadrato di gdahome, la casa di Home Assistant, il marchio dell'add-on: li
dichiara Home Assistant, e li va a prendere l'add-on — l'icona di un add-on
dalla casa, col suo segno, e il marchio di un'integrazione dai marchi di Home
Assistant. Chi non ne ha uno tiene la sua iniziale in un quadrato come gli
altri, che non è un buco in attesa.

Guardando la sezione, tre cose che si vedono e basta:

- **i tasti non sono più barre.** Sei schede una sotto l'altra, con sei barre
  azzurre larghe tutta la pagina, erano un muro: sei aggiornamenti facevano
  due schermate e mezzo di telefono. Adesso «Installa» è della sua misura e
  sta sulla riga del nome, e sei aggiornamenti ci stanno in una schermata;
- **le versioni si leggono.** Erano una riga grigia, e due versioni si
  somigliano per definizione: `1.4.32.8 → 1.4.32.9` grigio su grigio non si
  legge, si indovina. Quella nuova adesso è in evidenza, con le cifre a
  larghezza fissa perché il numero non balli;
- **su uno schermo da computer la colonna si ferma.** Prima il tasto finiva un
  metro a destra di quello che si era appena letto: si guardava a sinistra e
  si premeva a destra, col vuoto in mezzo.

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
