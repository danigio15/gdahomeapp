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

## 1.6.10

**Le modalità di ricarica le dice evcc, non le sa a memoria gdahome.** evcc ha
rifatto le sue modalità: `pv` adesso si chiama **smart** — «intelligente», e
copre anche chi il fotovoltaico non ce l'ha e usa evcc per le tariffe orarie —
e `minpv` non c'è più. Qui i quattro tasti erano scritti a mano, e il tasto
acceso si cercava per nome: da quando evcc risponde `smart` non si accendeva
più niente, mentre il comando partiva lo stesso. Un tasto che fa quello che deve
e sembra rotto. Adesso i tasti sono quelli che l'entità dichiara davvero, con le
loro parole: chi ha evcc nuovo ne vede tre, chi ha il vecchio resta con quattro,
e al prossimo cambio di nomi non si rompe niente. La modalità rapida si chiama
**Fast**, come nella tendina di Home Assistant, e non più «Subito».

**E «Always charge» ha il suo posto.** Quello che faceva `minpv` — non fermarsi
mai, tenere almeno il minimo anche oltre il surplus — in evcc è diventato
un'opzione a parte, che si affianca a «intelligente» invece di sostituirla.
Nella configurazione c'è la sua casella, accanto a quella della modalità; nella
console della ricarica compare sotto i tasti, col suo titolo — «Tieni il minimo,
anche quando il sole non basta» — e tre scelte: **Mai**, **Sempre**,
**Stavolta**. Si vede solo dove ha senso: da spenti non si carica, e in Fast si
carica al massimo comunque.

**Il navigatore in auto risponde a «Ok Google, portami a…».** gdanav arriva
all'ultimo, e con lui i requisiti che Google mette ai navigatori: in guida la
manovra, le corsie e l'orario di arrivo li disegna Android Auto nelle sue schede
— sulla mappa restano la velocità, il limite e gli avvisi — la prossima svolta
va anche al quadro strumenti, c'è la notifica di navigazione, e la voce usa il
canale della navigazione, quindi abbassa la musica invece di sovrapporsi. Le
richieste di navigazione da altre app e dall'assistente adesso arrivano: con le
coordinate si parte subito, con un indirizzo si cerca e si va.

**E la scheda dell'auto, quando i dati non ci sono, dice perché.** Non più un
riquadro vuoto: relè non raggiungibile, Home Assistant non collegato, nessuna
auto elettrica nella plancia, sensore della batteria mancante o muto. Dice dove
si ferma il filo, invece di lasciare a indovinare.

## 1.6.9

**In macchina parte il navigatore.** gdanav — il navigatore che finora era
un'app a parte — adesso è dentro gdahome, come voce «gdanav» del menu, e in
Android Auto è quello che si apre salendo in macchina: la mappa davanti, e la
casa dietro un tasto. È l'app di sempre, con lo stesso nome e la stessa firma:
non c'è niente da installare in più e niente da abbinare. Sul telefono la
sezione si accende la prima volta che la si apre e poi resta accesa — si torna
alla plancia e la guida continua. Nella webapp non c'è: è roba da telefono.

**L'auto della plancia arriva al navigatore da sola.** Nessun codice, nessun
QR: la casa è già collegata, e il navigatore legge dalla sezione Auto l'auto
attiva — nome, marca, modello, capacità — e i suoi sensori: batteria,
autonomia, ricarica, potenza, posizione, contachilometri, temperatura. In
tempo reale, con le unità già convertite. Se cambi auto nella plancia, il
navigatore se ne accorge in quel momento. Le termiche restano fuori, perché di
autonomia elettrica non ne hanno.

**I comandi rapidi in auto: scelti sul telefono, premuti sulla mappa.** Dal
menu di gdanav si compone la griglia — fino a dodici, i primi sei su ogni
auto, gli altri dove lo schermo è più grande. Dentro ci vanno le azioni rapide
della plancia, tutte, e le cose di casa che si premono: scene, script,
cancelli e tapparelle, serrature, luci, prese, pulsanti. Ce ne puoi anche
creare di tuoi — dispositivo, cosa fa, il nome sul tasto — e chiedere la
conferma dove serve. Una serratura la conferma sempre. In macchina il tasto
con la casa, sulla mappa, apre la griglia.

**«Quasi a casa».** Avvicinandosi a casa, l'auto propone un comando — il
cancello, il garage, quello che hai scelto tu — con «Fallo» o «Non ora». La
distanza la decidi: da 100 metri a 2 chilometri, mezzo chilometro se non
scegli. Lo propone solo se prima eri lontano davvero, così non lo ripete
girando intorno all'isolato.

**Il menu laterale ridisegnato.** In testa la casa, e sotto la tessera di
gdanav, viva: batteria, nome e autonomia dell'auto, e i due tasti «A casa» e
«Al lavoro» che accendono il navigatore e calcolano il viaggio. Le altre voci
in tre gruppi — Casa, Avanzate, Aiuto — e l'aiuto in fondo, dove si cerca.
Con più di una plancia nella casa, la tessera della plancia dice quale stai
guardando e apre la tendina per cambiarla.

**Le fasce del dispositivo dicono quali kilowattora prezzano.** Nel dettaglio
di un dispositivo, la riga di una fascia metteva accanto i kilowattora
*totali* e gli euro *della sola rete*: due basi diverse sulla stessa riga, e i
conti non tornavano — 21 euro sopra e 12 sotto, sugli stessi consumi. Il sole
non si paga, ed è giusto che gli euro siano quelli della rete: adesso la riga
lo scrive, «di cui dalla rete», e la nota sotto porta tutti e tre i numeri.

**La mappa dei flussi dice quando i suoi numeri non possono essere veri.**
«Vedo tutto ma il flusso verso casa non va»: il disegno era fedele — la
batteria diceva di caricarsi, e con quell'ingresso le linee giuste erano
quelle — solo che entravano 24 watt e ne uscivano 1346. Una cosa che non
esiste, e la plancia la disegnava con sicurezza. Adesso quando quello che esce
non può venire da quello che entra lo dice, e segna la casella sospetta: nove
volte su dieci è il segno della batteria o della rete, girato. Parla solo
davanti a un caso impossibile — più del doppio, almeno trecento watt di
scarto, due letture di fila e tutti e quattro i sensori dichiarati — perché un
falso allarme qui manda a cercare un guasto che non c'è.

**Un varco si esclude dall'antifurto, senza uscire dalla plancia.** Chi ha una
centrale lo fa di continuo: la finestra del bagno resta aperta di notte, e
prima di inserire l'antifurto quella zona la si esclude. Le centrali
pubblicano accanto a ogni contatto l'interruttore che serve — Risco lo chiama
`bypass` — e adesso lo si scrive nella riga del varco, in configurazione, con
la proposta già pronta. Da lì in poi sulla carta c'è lo scudo, e il conto in
cima dice quante sono escluse, accanto a quante sono aperte: chi sta per
inserire l'antifurto lo deve sapere prima, non scoprirlo dopo. Una finestra
esclusa resta contata fra le aperte, perché aperta è: l'esclusione parla alla
centrale, non all'infisso.

## 1.6.8

**L'avviso «Statistiche a lungo termine mancanti» non parla più alla prima
lettura.** Era la frase che manda a controllare i sensori, e la si scriveva
appena una casella tornava vuota — ma vuota non vuol dire sconfigurata: vuol
dire che il Recorder non ha risposto *adesso*, cosa che succede proprio quando
l'add-on è appena ripartito e il database è ancora freddo. Cioè nel momento in
cui uno apre la plancia dopo un aggiornamento. Un attimo dopo la stessa domanda
si riempie, l'avviso sparisce da solo, e chi l'ha letto è già andato a cercare
un guasto che non c'era. Adesso parla solo di quello che manca due letture di
fila.

**Il sensore della pioggia si trova, cercandolo.** Le due caselle — intensità
e millimetri caduti oggi — ci sono da sempre in Home → «Barra sotto il meteo»,
e sono le stesse che guarda l'Irrigazione. Ma la ricerca nella configurazione
cammina sui valori già salvati, e una casella mai riempita un valore non ce
l'ha: chi cercava «pioggia» leggeva «Nessuna configurazione contiene questa
parola», che si legge in un modo solo. Adesso la ricerca porta dritto alle
caselle anche da vuote, sotto «Dove si configura» — e con loro tutte e cinque
quelle della barra, compresa la cassetta della posta.

**La TV si accende dal tasto che dice «Accendi».** Una TV si mette fra i
lettori, e accenderla si poteva già — ma il tasto mostrava il triangolo di
«Riproduci», che su un televisore spento non si legge come «accendi». Peggio:
un televisore che la pausa non ce l'ha — quasi tutti, perché non riproduce
niente di suo — da acceso rispondeva a quel triangolo con un servizio che Home
Assistant accetta e non esegue. Adesso il tasto in mezzo dice quello che fa:
«Accendi» se è spenta, la pausa solo a chi la pausa ce l'ha, e niente dove non
c'è niente da premere. Anche l'azione rapida su una TV accesa adesso la spegne
invece di non fare nulla.

**Il contatore totale tolto resta tolto.** Nella scheda di un elettrodomestico,
svuotare la casella del contatore totale e salvare: riaprendo, il valore era
tornato. Non era il salvataggio — era la riapertura, che se la casella la
trovava vuota se la ricompilava da sola pescando fra le altre entità. Adesso
una scelta fatta resta fatta, anche quando la scelta è «nessuna».

**Nel cruscotto, «telefoni collegati» non erano telefoni.** Diceva 22 dove i
telefoni con l'app erano molti meno: contava i *collegamenti* aperti verso il
centralino, che sono un'altra cosa. Adesso sono due numeri, e dicono quello che
sono: **collegamenti aperti** e **app aperte**.

## 1.6.7

**Stesse cose della 1.6.6, con un numero nuovo.** La 1.6.6 era stata caricata
sulla pista chiusa e li' si e' fermata: il negozio la tiene come «non ancora
mandata in revisione», e il suo numero — una volta usato — non si puo' riusare
su un'altra pista. Questa e' la stessa identica versione col numero avanti di
uno, per poterla portare sulla pista interna, che non aspetta la revisione.

Dentro non cambia niente rispetto alla 1.6.6: in macchina si vedono i
dispositivi e si premono, il sole e le persone stanno dietro il tasto «Casa»,
e dentro casa plancia, ponte e cruscotto sono quelli di prima.

## 1.6.6

**In macchina si vedono i dispositivi, e si premono.** Fino a ieri gdahome in
auto apriva tre numeri del fotovoltaico e due tasti per altre due schermate:
informazioni sulla casa, non roba da premere. Adesso la prima cosa che si vede
è la griglia dei dispositivi — sei, col nome, com'è messo ognuno e un tocco per
girarlo. Davanti le porte e i varchi, che sono quello che si preme arrivando;
dietro le luci e le prese rimaste accese, che sono la domanda opposta: sono
partito e ho lasciato acceso?

Quali sei li sceglie la plancia, e non si sceglie niente di nuovo: le porte
sono quelle di Sicurezza, i varchi quelli dei Varchi, luci e prese quelle delle
loro tessere. Anche le parole («Aperto», «Accesa») arrivano fatte da lì — due
parole diverse per lo stesso stato, una in macchina e una sul divano, sarebbero
due stati per chi le legge.

**Il sole e chi c'è in casa non spariscono:** stanno dietro il tasto «Casa», in
alto, e sono diventati una schermata sola invece di due. In macchina i tocchi
si contano.

Fuori dalla griglia restano la serratura e il lettore, apposta: il comando
giusto dipende da com'è messa l'entità **adesso**, e una ricetta scritta
mezz'ora fa chiuderebbe una porta che intanto qualcuno ha aperto.

**Perché tutto questo.** La categoria con cui l'app si presenta all'auto è
`IOT`, e le due cose che Google mette davanti a tutte per un'app così sono
vedere com'è messo un dispositivo e accenderlo o spegnerlo con un tocco. Non
ce n'era nessuna delle due, ed è il motivo per cui dalla 1.6.4 in poi — la
prima con l'auto dentro — le revisioni del negozio non passavano più.

Dentro casa non cambia niente: la plancia, il ponte e il cruscotto sono quelli
della 1.6.5.

## 1.6.5

**Un numero solo.** Da qui in avanti l'add-on in casa e l'app sul telefono
dicono la stessa cosa: fino a ieri la casa leggeva 1.6.4.4 e il negozio 1.6.4.2,
e due numeri per la stessa versione sono due versioni per chi li guarda.

**Gli aiutanti non sono dispositivi non connessi.** «68 dispositivi non
connessi», e non erano dispositivi: erano automazioni, contatori, scene,
script, timer e le caselle `input_*`, che un dispositivo da andare a premere
non ce l'hanno. La regola c'era già ma valeva solo dove Home Assistant manda le
mappe dei registri; dove non le manda — o per un'entità che a nessun
dispositivo appartiene — rientravano tutti. Adesso è scritta una volta sola e
vale nella tessera, nella sezione e nel cruscotto dell'installatore.

**L'Agenda su iPhone si riempie appena riapri.** «Ogni volta che apro HA il
widget agenda non carica gli eventi; devo cliccare sul widget e fare apri
selezione, e appena richiudo mi fa lo stesso difetto.» Non era il calendario.
Quando l'app va in secondo piano, iOS sospende la pagina e la richiesta che era
per aria muore senza rispondere e senza rompere: la scheda restava «in attesa»
di una risposta che non sarebbe mai arrivata, e da lì in poi nessun disegno
chiedeva più niente. Adesso una richiesta persa scade da sé dopo mezzo minuto, e
al rientro in primo piano si libera subito — l'agenda è già lì. Vale anche per
le liste ToDo, che avevano lo stesso identico difetto.

**La porta del frigo cambia e la card se ne accorge.** «Lo stato della marcia
funziona e cambia, quello delle porte no.» La lettura della porta era giusta —
riaprendo la pagina la pastiglia c'era — ma la scheda non si rifaceva mai.
Quali entità facciano ridisegnare le card degli elettrodomestici era scritto in
un elenco a parte, e quell'elenco aveva dentro l'interruttore, lo stato, la
potenza e i contatori dell'energia: non la porta, non le temperature, non il
tempo che manca, non l'anomalia, e nemmeno le letture, i comandi e le voci
scelte in «Cosa accende la card». Adesso è uno solo e sta accanto alle caselle
che lo compongono.

**Aggiornamenti pendenti, e si vedono in cima.** La tessera compare solo quando
c'è qualcosa da fare, ma si chiamava col nome di una sezione: adesso dice
«Aggiornamenti pendenti», e la stessa notizia ha la sua pastiglia nella barra
sotto il meteo — in fondo alle notizie, perché un aggiornamento si fa con
calma. Toccandola si vede cosa aspetta. Si spegne dalla sua spunta in
«Barra sotto il meteo», come tutte le altre.

## 1.6.4.4

**I due euro della scheda del dispositivo adesso si parlano.** In alto il costo
del mese, sotto il conto delle fasce, e non si trovavano: sulla wallbox 34,69 €
contro 12,58 €. Nessuno dei due era un errore di somma — erano due conti
diversi detti con la stessa parola. In alto tutto il consumo al **prezzo medio**
delle fasce, pesato sulle ore della settimana; sotto solo i kilowattora presi
davvero dalla rete, ai prezzi delle fasce vere, **ora per ora**. Su una
macchina che carica di notte la stima sbagliava del sessanta per cento.

Adesso, quando le ore si conoscono — è il blocco delle fasce che le chiede — la
scheda usa quelle: quanto è costato alla rete e quanto ha risparmiato il sole,
ciascuno al prezzo dell'ora in cui è successo. Il totale in cima è la somma
delle due tessere sotto, non un terzo conto. Chi le fasce non le ha continua a
leggere la stima di prima, che resta l'unica cosa vera che si possa dire senza
sapere le ore.

## 1.6.4.3

**L'auto mappata che la pagina non mostrava.** In configurazione la vettura
c'era — «attiva, 13 entità mappate» — e la pagina dell'auto era vuota:
batteria a zero, autonomia e odometro a «—». Si vedevano solo tensione e
temperatura della colonnina, ed è quello che ha spiegato il resto. La pagina
non legge i profili: legge una mappa sola, e ogni vettura ne tiene la sua
copia. Le due si allineavano soltanto salvando un veicolo o premendo «Usa»;
riaprendo la plancia nessuno riapplicava niente, e lì restavano le caselle
della colonnina — che sono di casa e nessuno cancella. Adesso l'auto in uso
torna al suo posto anche all'avvio, e con una vettura sola quello che avevi
mappato altrove viene adottato invece che perso.

**Le fasce del dispositivo al primo colpo.** Sceglievi il boiler e il riquadro
non compariva; bisognava passare da un altro apparecchio e tornare indietro.
La scheda, appena toccata la linguetta, non è ancora aperta: il blocco non si
disegnava e buttava anche il conto appena fatto. Adesso il conto resta, e dopo
il tocco si riprova finché la scheda c'è.

**I nomi nelle card dei Varchi.** Su una riga sola, con «NON RISPONDE»
accanto, di un nome vero restavano sei lettere. Vanno su due righe, e la
pastiglia dello stato va a capo anche lei.

**La card dei sensori della stanza** porta il nome della stanza quando la
sonda è una sola: il nome della sonda serve a distinguerne tre, non a
ribattezzare il Salone.

## 1.6.4.2

**Il negozio rifiutava il pacchetto.** Costruito bene, firmato bene, e il Play
Console lo rimandava indietro: nel manifesto c'erano dichiarate insieme due
cose che si somigliano solo nel nome. Android **Auto** è l'app che gira sul
telefono e in macchina ci arriva proiettata — è quello che gdahome fa; Android
**Automotive** è il sistema che sta dentro l'auto. Google non lascia dichiarare
tutte e due, e ha ragione: sono due prodotti diversi. Ne resta una, quella
vera.

E le «Novità» che il negozio mostra a chi installa l'app parlavano ancora della
1.6.2: adesso raccontano la macchina.

In casa non cambia niente.

## 1.6.4.1

**L'app della 1.6.4 non è mai uscita.** Il pacchetto per il telefono non si
costruiva: il pezzo nuovo che porta gdahome in macchina si metteva in ascolto
della sessione dell'auto sovrascrivendo un metodo che in quella libreria non
esiste, e la costruzione si fermava lì — con l'etichetta già messa e il
negozio già aperto a mano. In casa non cambia niente, la 1.6.4 dell'add-on è
quella giusta: cambia che adesso c'è anche l'app.

**E la rete che mancava.** Le prove guardavano il Dart — `flutter analyze`,
`flutter test` — e il codice nativo di Android non lo costruiva nessuno fino
al rilascio. Adesso a ogni modifica il pacchetto per Android si costruisce per
davvero: un errore come quello si vede subito, non dentro una versione già
etichettata.

## 1.6.4

**gdahome sale in macchina.** Android Auto mostra i suoi modelli — un pannello,
una lista, una griglia — e li disegna lui col carattere e i colori dell'auto:
non c'è la plancia, c'è il poco che si guarda guidando. Quanto tira la casa e
quanto fa il sole, chi è rientrato, e i tasti delle azioni rapide.

I numeri non li rifà nessuno: sono le stesse righe che la finestra
dell'Energia mostra in casa, con dentro la conversione da kW e la parola nella
lingua di chi guarda. Il servizio in auto con la casa non parla — due posti che
sanno entrare in casa sono uno di troppo: la plancia lascia al telefono una
fotografia, e l'auto legge quella. Se il telefono non ne ha ancora mandata una,
in macchina si legge che non è arrivata: mai un numero inventato al posto di
uno vero.

E i tasti premono davvero, **anche a schermo spento**. Premuto in macchina, il
comando lo esegue l'app senza che nulla compaia in mano. Non tutto può partire
da solo, e quello che non può lo dice il tasto: un'azione con una conferma
vuole qualcuno che guardi, un menu vuole un dito che sceglie, e una serratura
non si comanda su uno stato di mezz'ora fa. Col lucchetto acceso non parte
niente senza aprire l'app, che è il senso del lucchetto.

**Da app la casa chiedeva due volte i codici.** «Su Home Assistant funziona, da
app mi richiede codici sia installatore che gestore.» Fra tutti i comandi che
l'app fa al ponte, uno solo non guardava la chiave che l'app gli stava già
passando: quello che chiede lo stato del quadro. Bastava quello per rifare la
domanda a chi aveva già risposto.

**Il radar diceva «Zoom Level Not Supported» sopra un indirizzo scritto a
mano.** L'ingrandimento della pioggia ha un tetto, diverso da servizio a
servizio, e per un indirizzo battuto a mano non lo guardava nessuno. Adesso lo
guarda — e anche il tasto «Prova», che provava a un ingrandimento che poi non
si usava e quindi rispondeva su una cosa diversa da quella che si vedeva.

**Sessantotto dispositivi non connessi che erano uno.** La tessera contava
anche gli aiutanti — i numeri e gli interruttori che uno si crea in Home
Assistant — e quelli un dispositivo non ce l'hanno: non sono un dispositivo
che non risponde. Su una casa vera: da 68 a 1. E la finestra ha smesso di
stampare la maniglia del dispositivo, che è roba da scheda, non da pagina.

**Il tasto del feed manuale non compariva.** Un pulsante che nessuno ha mai
premuto sta su `unknown`, e chi disegnava lo prendeva per rotto e lo
nascondeva — per sempre, perché finché non si preme non cambia stato. E un
menu a tendina disegnava un tasto che non faceva niente: adesso apre le voci e
se ne sceglie una.

**Le telecamere si tolgono da Sicurezza senza perdere l'allarme.** Chi non ne
ha una poteva solo spegnere Sicurezza intera, e perdere anche i varchi e
l'antifurto, che con le telecamere non c'entrano. Adesso c'è un interruttore
sotto le telecamere, e spegnerlo non cancella niente: si riaccende e tornano
dov'erano.

**Prima di inserire l'allarme, la plancia dice cosa è ancora aperto.** Si
inseriva e poi si scopriva la finestra del bagno dal telefono, da fuori.

**«Si vede in Home» adesso è scritto anche dentro la scheda del MiniPC.**
L'interruttore c'era, in Configurazione → Widget, e non lo trovava nessuno: è
lo stesso, scritto dove uno lo cerca.

**Nel flusso dell'Energia le linee passavano sopra le bolle degli altri
carichi.** Sul telefono, dal quinto carico in poi, le file diventano due e
stavano incolonnate: la linea verso una bolla di sotto attraversava quella di
sopra, e sembrava che il boiler fosse attaccato alla lavatrice. Adesso le file
si sfalsano come i mattoni di un muro e ogni linea scende nel suo varco. Nello
stesso giro la seconda fila è salita di sessantasette punti: i suoi numeri
finivano sotto la barra dell'app, e per leggerli bisognava scorrere senza
sapere che ci fosse qualcosa da scorrere.

**La mappa della rete Zigbee, su una casa vera, non si leggeva.** «La mappa
dopo vari tentativi si è caricata ma non si vede nulla e non si può né fare
zoom né niente.» Erano due cose, e tutte e due si vedono solo misurando.

Il disegno aveva due cerchi di misura fissa, tarati su una dozzina di
apparecchi: su un cerchio di centottantacinque pixel ci stanno milleduecento
pixel di circonferenza, e quarantacinque ripetitori larghi cinquantaquattro ne
vogliono duemilaquattrocento. Contate: centoventitré coppie di anelli uno sopra
l'altro e sessantanove coppie di scritte accavallate. Adesso il raggio lo detta
la rete — a ognuno spetta il pezzo di cerchio che il suo nome occupa — e su
ottanta apparecchi le coppie sovrapposte sono zero. Una casa piccola ha la
mappa di sempre: sotto il minimo non si scende.

E nell'app la figura non si poteva ingrandire perché stava dentro una lista,
che il dito se lo prende lei, e col margine di spostamento a zero — il valore
di serie — anche ingrandendo non c'era niente da portare al centro. Adesso si
tocca e si apre in una pagina sua: si ingrandisce con le dita o con i tasti, si
sposta dove si vuole, e un tasto la rimette intera.

**E la rete si legge anche a righe, che su un telefono è la cosa che serve.**
Sotto la mappa c'è «Chi regge chi»: l'antenna, ogni ripetitore, cosa gli sta
appeso e quanto tiene il filo — buono, discreto, debole. Un disegno grande due
metri di schermo si scorre male; un elenco lo scorre chiunque. Lo conta lo
stesso modulo che disegna la mappa, quindi le due cose non possono dire cose
diverse.

**Togliendo un dispositivo dalla rete usciva «la rete ha accettato l'ordine ma
quel dispositivo è ancora lì» — e invece stava andando via.** Un ordine Zigbee
viaggia via radio: il coordinatore lo manda, l'apparecchio se ne va, e l'elenco
si riscrive dopo. Si rileggeva nell'istante in cui l'ordine partiva, quindi lo
si trovava ancora lì quasi sempre. Adesso si guarda per dodici secondi, e solo
se dopo c'è ancora si dice — dicendo anche cosa fare, perché quasi sempre è un
apparecchio che dorme e l'ordine di uscire non lo sente finché non si sveglia.

**Negli aggiornamenti mancava proprio la nostra icona.** Nel cruscotto Duck
DNS, Git pull e Home Assistant Core avevano il loro marchio e gdahome una «G».
Il modo in cui l'icona viaggia funziona — la casa la prende dal Supervisor e la
manda col rapporto — ma in un rapporto un'icona ci sta fino a 64 KiB, e la
nostra ne pesava 102: sopra quel peso il ponte non dice «oggi non ce l'ho», dice
«un'icona non ce l'ha», e il quadro se lo segna e non la richiede più. Era
l'unica icona sopra il tetto di tutta la casa. Adesso pesa 28 KiB, sempre 256
per 256, e una prova guarda il file vero perché non succeda di nuovo.

**Il nome di un dispositivo Zigbee adesso arriva anche alla rete.** «Ho
associato dispositivo zigbee… il nome nella sezione zigbee, sia su Home
Assistant che su app, non risulta modificato.» Erano due nomi e se ne scriveva
uno solo: l'etichetta nel registro di Home Assistant. Il `friendly_name` di
Zigbee2MQTT — quello con cui la rete lo chiama nella sua cassetta, nella sua
pagina e in ogni messaggio che manda — non lo sapeva nessuno, e restava
l'indirizzo (`0x0cae5ffffec141a9`). Adesso si scrivono tutti e due, e non ci si
fida del «sì»: si riguarda la cassetta finché il nome nuovo non c'è.

Rinominare, però, non è mettere un'etichetta: il nome della rete è l'indirizzo
della cassetta, e cambiandolo Home Assistant rifà le entità con identificativi
nuovi. La schermata lo dice prima di farlo, con le parole di quello che
succede — e nell'abbinamento lo dice al momento giusto, quando il dispositivo è
appena entrato e non lo usa ancora nessuno.

**E su Zigbee2MQTT la riga dell'elenco porta il suo dispositivo di Home
Assistant.** Lo riempiva solo ZHA: su una casa Zigbee2MQTT, nella scheda di un
dispositivo, «rinominalo» e «mettilo nella plancia» non avevano su cosa
lavorare — non hanno mai funzionato. Il filo c'era già ed è l'indirizzo: si
incrocia col registro dei dispositivi, che il ponte legge una volta e si
ricorda per mezzo minuto.

**E «non risponde» non si dice più di una riga che punta a un'entità che non
c'è.** Nella Presenza, un rilevatore che Home Assistant non ha affatto —
un'entità cambiata sotto i piedi, un dispositivo tolto e rimesso — diceva «Non
risponde», che manda a guardare la batteria e il segnale di una cosa che non
esiste. Adesso dice «Non c'è in Home Assistant»: sono due guasti diversi e si
riparano in due posti diversi, uno col dispositivo in mano e l'altro nella
scheda della configurazione.

**Un avviso finito nel gruppo Allagamenti non diventa più una sonda bagnata.**
La tessera leggeva tutto quello che c'era in quella lista allo stesso modo —
acceso vuol dire bagnato — e un antifurto inserito faceva dire alla casa «C'è
acqua». Adesso nella tessera è una sonda chi dichiara umidità o chi non
dichiara niente (il sensore fatto in casa resta); chi dichiara di essere
un'altra cosa — `safety`, `problem`, `motion` — resta nella configurazione ma
fuori dal conto. La regola del rilevamento automatico non cambia: quella è
stretta apposta.

**E nella scheda degli Allagamenti si vede quale voce non è una sonda.** «Non
c'è nessuna entità allarme, sono 5 i sensori configurati, questo 6 non esiste»:
il sesto stava nella lista — ce l'aveva messo la scheda degli avvisi, col nome
scritto a mano — ma non era una sonda, e la tessera lo leggeva come legge tutti
(acceso vuol dire bagnato). Toglierlo d'ufficio sarebbe peggio, perché c'è chi
in quella lista mette un sensore fatto in casa che la classe non la dichiara:
adesso la riga lo dice, accanto al cestino che la toglie.

**La finestra di una tessera ci sta dentro la sua card.** «Aggiusta i margini
del popup allagamenti, non entra all'interno tutto»: negli Allagamenti
«Asciutto» finiva oltre il bordo destro e il titoletto «LO STATO» spariva a
sinistra. Non era degli allagamenti — sul telefono sbordavano anche il fumo e
le tapparelle, e tutte e sei le finestre avevano dieci pixel di margine invece
dei quindici del loro foglio. I nomi lunghi, nelle righe, non si tagliano più a
metà di una lettera: vanno a capo.

## 1.6.3

**Energia: «Costo Reale» e il riquadro sotto dicevano due cifre per la stessa
spesa.** In Panoramica il costo era stimato da una media, mentre «Come si
divide il costo reale» lo faceva ora per ora con le fasce — due conti diversi
sullo stesso consumo, e chi guardava la schermata vedeva due numeri e non
sapeva quale credere. Adesso il numero è uno: quello a fasce, quando le fasce
ci sono. Sopra e sotto si legge la stessa cifra, e il risparmio si conta da
quella.

**La «Gestione installatori» si chiama Cruscotto gdahome.** Nella barra
laterale di Home Assistant, nel titolo della scheda e in cima alla pagina.

**Il riquadro «Il servizio» si legge a colpo d'occhio.** Erano due paragrafi
in grassetto e cinque caselle stirate per tutta la larghezza, col numero in
alto a sinistra e mezzo riquadro vuoto accanto. Adesso ogni macchina — il
quadro, il tramite — ha la sua testa, con il suo disegno e la pastiglia che
dice come sta; i conti sono mattonelle larghe quanto serve; e gli interruttori
del tramite sono pastiglie con la spia, una per uno.

**E adesso dice quando il quadro ha smesso di aggiornarsi da sé.** Quel
segnale arrivava già — sei giri a vuoto di fila, e `/salute` lo dice — e la
pagina lo buttava via. È la cosa per cui quel riquadro esiste, perché un
quadro fermo non lo scopre nessun altro: si legge nella pastiglia, che diventa
ambra, e sotto da quanto è fermo e perché.

**La scheda di una casa si apre accanto all'elenco, non sopra.** «Case a
sinistra e se clicco mi apre il dettaglio affianco, non il popup: non mi piace
il popup.»

Il foglio che sale dal basso è giusto sul telefono, dove non c'è spazio per
due cose insieme. Su uno schermo largo si pagava due volte: copriva l'elenco da
cui eri appena partito — con un velo sfocato sopra — e per passare alla casa
dopo toccava chiudere, ritrovare il punto, riaprire. Da quattordici pollici in
su le due pagine del quadro diventano elenco a sinistra e scheda accanto, con
la casa aperta riconoscibile dal bordo, e l'elenco che resta fermo mentre si
legge. Sotto quella misura non cambia niente: telefono e tablet in verticale
restano col foglio che sale, identico a prima.

Nel cruscotto dell'installatore l'elenco diventa un elenco vero: una riga per
impianto, il nome e lo stato sulla stessa linea. Alte com'erano nella griglia a
due colonne, otto impianti riempivano due schermi.

**E i margini tornano in squadra.** Tre disallineamenti, trovati misurando e
non guardando: la colonna dell'elenco cominciava cinque pixel prima di tutto il
resto; dentro la scheda i titoli stavano quattro pixel più a destra delle carte
che intitolano — questo c'era da sempre, e col foglio largo quanto un telefono
non lo notava nessuno; e il titolo della raccolta era finito attaccato alla
carta sopra. Corretti tutti e tre, in tutte e due le pagine, e il quarto anche
sul telefono.

## 1.6.2

**Aggiorna l'add-on e l'app insieme.** Questa versione cambia il modo in cui
un telefono si abbina, e i due pezzi devono parlare la stessa lingua.

- **Abbinare un telefono nuovo** vuole l'add-on e l'app di questa versione.
  I telefoni già abbinati continuano a funzionare come prima, senza fare
  niente.
- **La console di gdahome la apre chi amministra Home Assistant.** Gli altri
  utenti di casa continuano a vedere e usare la plancia; non ne cambiano la
  configurazione e non fanno codici di abbinamento.
- **Un telefono intestato a chi non amministra** usa la casa — luci, clima,
  tapparelle, telecamere, scene — ma non le impostazioni di Home Assistant.
- **L'add-on si aggiorna dalle versioni pubblicate**, e mai a una più vecchia
  di quella che ha.
- **Il logo di chi ti ha fatto l'impianto** si carica come PNG, JPEG o WebP.

## 1.6.1

**Zigbee: si vede chi c'è già in rete, e la mappa.** «Voglio vedere elenco
completo dei dispositivi e poterli eliminare e eventualmente associare
dispositivi già esistenti nella plancia. Crea inoltre la possibilità di
mostrare la mappa di collegamento.»

Sotto i tasti dell'abbinamento adesso c'è l'elenco di chi c'è già, con marca,
modello e la pila per chi va a batteria. Da ogni riga si apre la sua scheda: si
rinomina, si manda nella plancia, si toglie dalla rete — e prima di togliere si
dice **la parte che costa**, cioè che per rimetterlo lo si riabbina da qui. Di
un ripetitore si dice anche che tiene su la rete per gli altri.

«Guarda la rete» apre la **mappa**: al centro l'antenna, intorno i ripetitori,
fuori chi sta in fondo a un ramo — che è la forma che una rete Zigbee *ha*, non
una disposizione scelta. Lo spessore e il tratteggio dicono quanto è buono ogni
collegamento, e chi non parla con nessuno sta in fondo con scritto perché. I
pallini sono i disegni veri del catalogo: il disegno dice *cos'è*
quell'apparecchio, l'anello colorato *che mestiere fa* nella rete.

**Sul telefono la mappa usciva vuota.** Gli anelli, i fili e i nomi c'erano, e
dentro ogni anello niente: proprio le icone dei dispositivi. Erano un `<svg>`
dentro l'altro — un modo valido, che nel browser si vede — e `flutter_svg`
quelli li salta. Nessuna prova se ne era accorta perché guardavano tutte il
*testo* della figura, e il testo era giusto: si è visto fotografando la
schermata.

**La plancia si mangiava un core intero, ferma.** La segnalazione diceva «la
torre 3d va a scatti quando si clicca»: non era la torre e non era il clic —
ogni pagina, con nessuno che la tocca, stava al cento per cento di un core, per
sempre. Il clic si notava soltanto perché è il momento in cui uno si aspetta
una risposta.

Erano tre cose: la sfocatura da cento pixel delle due macchie di sfondo,
rifatta in continuazione; il loro movimento, che obbliga a ricomporre tutto
quello che ci sta sopra; e i pallini che pulsano, che respirando scrivevano un
valore nuovo a ogni fotogramma. Adesso le macchie sono una sfumatura e stanno
ferme, e i pallini lampeggiano invece di respirare. A pagina aperta e senza
toccare niente: **Home 4%, MiniPC 4%, Energia 1%**.

Si vede cambiare due cose: lo sfondo non scorre più, e i pallini non crescono
più — cambia solo quanto sono accesi.

## 1.6.0.6

**I dispositivi non connessi si contano per dispositivo, non per entità.** «Non
devi mettere le entità ma i dispositivi non connessi, così come li mostri nel
cruscotto installatore.»

Nell'elenco finivano «Asciugatrice Child lock», «Boiler Child lock»,
«Condizionatori Child lock»: quattro elettrodomestici che rispondono benissimo,
di ognuno dei quali tace una sola entità — quella serratura bambini che
l'integrazione pubblica sempre e che è `unavailable` quando la macchina non sta
lavorando. Cioè l'avviso diceva il vero su cose che non interessano, che è il
modo esatto in cui un avviso si impara a ignorare.

Nel cruscotto dell'installatore quei `child_lock` non compaiono, perché il
ponte la regola giusta ce l'ha da sempre: si raggruppa per dispositivo, e un
dispositivo è giù **solo se tacciono tutte le sue entità**. Adesso la plancia fa
la stessa, non una somigliante. Le entità che parlano si guardano in tutta la
casa e non solo fra quelle mappate qui: se di un'asciugatrice è configurata la
sola serratura bambini, a dire che la macchina sta bene sono le altre. Il
cestino mette da parte tutte le entità di quel dispositivo in un colpo, e quello
che si scrive restano entità — così le voci già messe da parte continuano a
valere.

**La scheda si chiama «Dispositivi non connessi»**, come la tessera in Home.

**Le fasce nel dettaglio del dispositivo tornano quando si apre ANALISI.** «Si
vedono nella parte panoramica ma dentro analisi quando seleziono i dispositivi
non le vedo.» Il blocco si toglie quando la scheda non si vede — un conto a ore
chiesto per una scheda che nessuno guarda è carico sul Recorder regalato — e a
rimetterlo doveva essere il click sulla linguetta. Quel click si ascoltava su
`#ed-tab-disp`, che in questa plancia non esiste: le linguette di Energia sono
`ed-tab-pan` e `ed-tab-ana`. Così il blocco tornava solo cambiando apparecchio
nella tendina, cioè il gesto che non si fa quando l'apparecchio è già scelto.

**Nel MiniPC, sotto «Macchine e container», si leggeva «server» al posto
dell'icona.** Dalla 1.6.0 quel campo è il nome di un disegno del catalogo e non
un'emoji; chi disegna ha continuato a stamparlo com'era, e un nome stampato è
una parola.

## 1.6.0.5

Una correzione sola, e un numero nuovo perché la 1.6.0.4 era già arrivata
nelle case senza di lei.

**La pagina Musica sta dentro lo schermo di un telefono.** «Si riesce ad
impaginare o per telefono o per tablet? perché oltre che sborda, non scorre
per andare a lato.»

Erano due guasti. Il primo si vedeva nella tendina: etichetta e tendina
stavano affiancate per forza, e quei nomi non li sceglie nessuno qui — li
manda l'integrazione, e SmartThings scrive «Formato di ingresso del
segnale». Su un telefono l'etichetta si impilava su tre righe e alla tendina
restavano cento pixel: dentro si leggeva «No input co», e il resto non si
poteva andare a prendere, perché una tendina non si scorre di lato. Adesso
quando affiancate non ci stanno la tendina va a capo e si prende la riga
intera.

Il secondo era il «sborda», e stava più a monte: la colonna del testo della
card era una griglia senza colonne dichiarate, e una griglia così se ne fa
una larga quanto il figlio più largo. Su uno schermo da 320 px quella colonna
veniva 220 dove ce n'erano 162, e la card taglia quello che le esce perché le
serve per il fondale sfocato della copertina: il di più spariva, senza modo
di riprenderselo.

## 1.6.0.4

**Una casa senza pannelli non legge più numeri finti (#82).** «Uno switch che
tolga completamente la gestione energetica casa con fotovoltaico, pulendo da
info errate la pagina energia.»

Senza impianto la pagina Energia mostrava lo stesso «Produzione FV 0,0 kWh» —
che non è produzione zero, è che i pannelli non ci sono — e «Autosufficienza
100 %», che è il numero sbagliato vero: viene da `(consumo − prelievo) /
consumo`, e con il prelievo a `0` perché nemmeno il contatore di rete è
configurato, una casa che prende tutto dalla rete leggeva di essere
autosufficiente. Il consumo, l'unica cosa che quella casa misura davvero, si
perdeva in mezzo ai due numeri finti.

Sono due domande e non una: **il 100 % è sbagliato anche in una casa che i
pannelli ce li ha**, se le manca il contatore di rete, perché quel conto vuole
tutte e due le misure. Adesso la produzione sparisce dove i pannelli non ci
sono, e l'autosufficienza dove non si può dire — spenta o accesa che sia la
spunta.

Di solito non c'è niente da chiedere: senza nemmeno un'entità di produzione la
risposta la sa già la configurazione. La spunta **«Impianto fotovoltaico»**, in
cima al riquadro ☀️ Fotovoltaico, serve a chi i pannelli ce li ha e questa
pagina non la vuole. Spegnendola vanno via anche il sole dalla riga del mese,
la linea «Produzione» dal grafico giornaliero e quattro delle cinque caselle
dei soldi — «Senza FV» è esattamente quello che si paga, il risparmio è zero
per definizione, l'immesso non esiste e la CO₂ evitata nemmeno. Restano
consumo, costo reale e fasce orarie. Le entità scritte in configurazione non si
toccano: chi rimette la spunta le ritrova dov'erano.

**Una scheda «Scollegati» nel config, con un cestino.** La tessera
«Dispositivi non connessi» compare in Home quando qualcosa smette di
rispondere, e finché resta muta va bene così. Il guaio è quando dice il vero su
una cosa che non interessa — un'integrazione tolta che lascia l'entità scritta,
la presa dell'albero di Natale a gennaio — perché allora l'avviso si impara a
ignorare, e un avviso che si ignora è peggio di nessun avviso.

Adesso quell'elenco si apre anche in configurazione, sotto **Macchine e rete**,
con accanto a ogni riga un cestino. Le righe le mette la plancia: non c'è
niente da aggiungere. Il cestino chiede conferma e poi toglie quel dispositivo
dall'avviso **per sempre** — le righe tolte restano scritte in fondo alla
scheda, senza cestino, e dicono se in casa quell'entità esiste ancora: un
dispositivo silenziato e una configurazione rimasta indietro sono due cose
diverse. L'elenco è uno solo: la scheda e la tessera leggono la stessa regola.

**La ricerca nel config sa anche dove si scrive.** «La casella c'è ma manca nel
config dove inserire l'entità.» La casella c'era davvero, ed erano due cose
insieme.

La ricerca camminava solo sui valori **già salvati**, e una casella vuota non
ha valore: chi cercava «ventola» prima di averci scritto qualcosa si sentiva
rispondere «Nessuna configurazione contiene questa parola», che si legge in un
modo solo. Adesso i risultati sono due gruppi: quello che è scritto, e sotto
**«Dove si configura»**, le caselle — che esistono anche da vuote. Il tocco
apre la scheda, la maschera giusta e accende la riga, che è l'unico modo di
dire «è questa» a chi ha davanti venti caselle uguali.

E il salto portava nel posto sbagliato: le entità mappate a mano finivano tutte
attribuite al **MiniPC**, perché stanno in un cassetto solo. Chi cercava dove
mettere la ventola atterrava in una scheda dove di ventole non se ne parla, e
concludeva — giustamente — che quella casella non esiste.

**Le entità di Energia sparivano appena scritte.** Trovato inseguendo la
ventola. Alla fine della procedura guidata tutto quello che il rilevamento
aveva trovato veniva scritto in un colpo solo, e un attimo dopo di ⚡ Energia
non restava niente: delle sei mappature ne sopravvivevano due, e le quattro di
Energia sparivano con il modello ancora vuoto. Nemmeno il ricaricamento
rimediava. Adesso quello che arriva mappato a mano entra nel modello **prima**
che la plancia lo riproietti, e svuotare un campo continua a svuotarlo.

**Il tasto della ventola dell'inverter manda un ordine vero.** Mandava a Home
Assistant il nome della casella invece dell'entità mappata, e non succedeva
niente. La potenza si vedeva — quella si legge, e leggere funzionava — e il
tasto no: è il modo più confondente di essere rotti. L'entità si scrive in
**Energia → IMPOSTAZIONI → 🌡️ Temperature e raffreddamento → «Interruttore
ventola»**.

**L'ora di una fascia oraria cambiata torna a quella di prima.** «Nella
selezione delle fasce orarie se cambio ora non salva, ritorna di nuovo a quella
impostata per default.» Le fasce scrivevano i minuti e rileggevano le ore: la
funzione non sapeva rileggere quello che scriveva, e alla riapertura ricadeva
sull'ora di fabbrica. Un'ora diversa da quelle di serie **non era mai
sopravvissuta a una riapertura**: sembrava a posto solo finché le ore erano
ancora quelle di default, perché il ripiego indovinava giusto.

**Le fasce dentro il dettaglio del dispositivo (#111).** «Mi aggiungi anche nel
dispositivo le fasce per capire quanto quel dispositivo assorbe di più e in
quale fascia.» Nella finestra di un apparecchio, sotto i costi, adesso c'è
quanto ha preso in ognuna delle tre fasce e quanto è costato. I kWh li conta
tutti; **gli euro contano solo quello che è venuto dalla rete**, ora per ora,
perché il sole a nessuna ora ha un prezzo.

**La rete Zigbee si apre davvero, e il rifiuto non è più colpa dell'add-on.**
«No perché non mi fa aprire la rete.» Erano due cose. La prima: quando Home
Assistant rifiutava il comando, la plancia diceva «gdahome in casa è più
vecchio dell'app, aggiorna l'add-on» — e mandava ad aggiornare una cosa che era
già aggiornata. Adesso il messaggio riporta le parole di Home Assistant e dice
di controllare che ZHA o Zigbee2MQTT siano accesi e l'antenna collegata.

La seconda: con ZHA la rete **non si apriva**. Si chiedeva prima per una via
interna che Home Assistant ha riscritto, e solo dopo col servizio `zha.permit`,
che è l'API pubblica e non è mai cambiata. Adesso si prova prima quella.

**Un veicolo è un'auto o una moto, e la scheda lo chiede (#75).** «Molti di noi
smanettoni hanno anche una moto connessa, sarebbe carino avere una sezione
MOTO.» Nella scheda dei Veicoli c'è la scelta **Auto / Moto**, sopra il motore
e indipendente da lui: una moto può essere elettrica, a benzina o ibrida come
un'auto. Scegliendo Moto la card prende il disegno della moto, il titolo della
pagina lo dice, e le quattro caselle che una moto non ha — portiere, finestrini,
bagagliaio, cofano — spariscono dalla configurazione. Chi non tocca niente non
vede cambiare niente: vuoto vuol dire auto.

**La linguetta «Installatori» della gestione diceva 1 a chi ne ha due.** Il
numero non era sbagliato, era un altro numero: contava gli installatori **al
limite**. Ma una pastiglia appoggiata alla parola «Installatori» si legge in un
modo solo, e quel conto quella schermata lo dice già due volte. Adesso la
linguetta di una raccolta non porta pastiglia, come «Impianti» nel cruscotto.

**Il dispositivo che entra nella rete Zigbee viene annunciato.** «Il pairing
lo fa partire l'app, ma poi non vede che lo ha trovato»: la rete si apriva,
il conto alla rovescia scorreva, il dispositivo entrava davvero in
Zigbee2MQTT — e la schermata restava su «Sto ascoltando la casa» fino alla
fine.

Non era ne' Zigbee2MQTT ne' un ritardo: **non e' mai stato annunciato
niente**, a nessuno, in nessuna casa, nemmeno con ZHA. Gli eventi del bus
Home Assistant li manda in una busta — fuori che evento e', dentro `data` i
suoi dati:

```
{ event_type: "device_registry_updated",
  data: { action: "create", device_id: "..." } }
```

`eUnoNuovo` leggeva `evento.action` e `evento.device_id`, cioe' **fuori dalla
busta**: sempre `undefined`, sempre «no». Lo stesso abbonamento in
`spegnimento.js` la busta la apre da sempre (`const dati = evento?.data`):
erano due letture della stessa cosa, e una sola era giusta.

Le prove non se ne sono accorte perche' la casa finta consegnava i dati nudi
— la forma comoda, quella che si aspettava il codice — invece della busta
vera. E' la **terza** volta in tre giorni: la casa finta che consegnava i
messaggi MQTT ignorando i caratteri jolly, il ponte finto dell'app che
rispondeva `z2m`, e adesso questa. Un finto piu' accomodante dell'originale
non prova niente, e due errori che si danno ragione a vicenda passano
qualunque corsa verde.

Adesso la casa finta imbusta come Home Assistant, e la forma nuda **non passa
piu'**: era il travestimento del guasto, e accettarla vorrebbe dire lasciare
la porta aperta al prossimo. Col codice di prima sei prove diventano rosse.

**Una telecamera che si vede solo quando in casa non c'è nessuno (#81).**
«Tipo io ne ho una interna ma vorrei si potesse vedere solo se a casa non
c'è nessuno per una questione di privacy.»

Nella scheda Sicurezza, sotto le telecamere, c'è una spunta per telecamera.
Spuntata, quella telecamera si vede soltanto a casa vuota: mentre qualcuno è
in casa sparisce dalla pagina Sicurezza, dalla stanza in cui è stata messa e
dal giro dei fotogrammi — **il fotogramma non viene nemmeno scaricato**, che
su una telecamera interna è la differenza fra nasconderla e coprirla con un
foglio. Chi rientra la fa sparire subito, non al prossimo cambio pagina: è
la stessa presenza che già fa ridisegnare la plancia.

Chi c'è in casa lo dicono le persone della sezione Persone: `home` vuol dire
dentro, tutto il resto — `not_home`, una zona col nome, l'ufficio — vuol
dire fuori. E se non si sa (nessuna persona configurata, o nessuna delle
loro entità che risponde) **la telecamera resta nascosta**. Fra i due
sbagli possibili — una telecamera nascosta a chi poteva vederla, e una
telecamera accesa in salotto mentre qualcuno ci passa davanti — il primo si
scopre subito e si rimedia con una spunta, il secondo non lo scopri mai.
Per questo la spunta si offre solo dove almeno una persona c'è, e dove non
c'è lo dice invece di far finta di niente.

La scelta viaggia fra i dispositivi, come tutta la configurazione della
casa: se restasse su un telefono, la telecamera nascosta lì resterebbe
accesa sul tablet in cucina — cioè proprio sullo schermo davanti a cui si
passa.

**L'umidità del terreno si vede anche senza elettrovalvole (#80).** «Quella
umidità terreno in realtà già è presente ma se inserisco solo quella entità
non esce nei widget.»

La funzione c'era per intero — il sensore in configurazione, il misuratore
con la banda ideale, la soglia che salta l'irrigazione a terreno bagnato — e
quello che non andava era l'**ordine** in cui si guardavano le cose, nello
stesso modo in due posti. Sia la tessera della Home sia la pagina
Irrigazione uscivano su «nessuna zona» prima di arrivare a leggere il
sensore. Chi ha due sonde nel vaso e nessuna valvola non vedeva niente, e
non aveva modo di capire perché. Adesso il sensore si legge prima del
verdetto: senza zone il misuratore si disegna lo stesso, sopra l'invito ad
aggiungere le zone.

**La mattonella della gestione conta i dispositivi, non le entità.** Diceva
«Entità 2496 · 49 non rispondono» tre centimetri sotto una riga che dice «7
dispositivi non collegati». Non sono in disaccordo — sono 49 entità mute
dentro 7 apparecchi — ma chi legge non ha modo di saperlo, e quei 49 non li
può nemmeno andare a vedere: da una casa viaggiano solo i nomi dei
dispositivi, mai quelli delle entità. Adesso quando qualcosa è giù la
mattonella dice i dispositivi, che è il numero che si può aprire.


**I Varchi si dichiarano, non si autocompilano (#74).** «Sezione varchi
attuale non ha alcuna possibilità di inserire icone. Inoltre è differente
dalle altre sezioni in quanto si autocompila, cosa che avevo detto già di
eliminare, e sotto compaiono ancora quelle che ho eliminato da sopra.»

Tre difetti, ed erano lo stesso difetto: quella scheda non era una scheda,
era un **rilevamento con delle correzioni sopra**. L'elenco lo faceva Home
Assistant — tutto quello che si chiamava «door» o «window» — il cestino non
cancellava ma ESCLUDEVA, e l'escluso restava scritto sotto in «Tolti dai
conti». Di suo, chi abita la casa poteva solo cambiare il nome.

Adesso è come Porte e cancelli, come i Carichi, come tutte le altre: **una
riga per varco**, e dentro la riga le tre cose che un varco ha — l'entità, il
nome, il disegno. La metti tu, e quando la elimini è eliminata. Via «Tolti dai
conti».

**Quello che c'era non si perde.** Alla prima apertura la scheda scrive come
righe esattamente quello che la pagina mostrava un attimo prima: i nomi già
dati, senza quelli già tolti, col disegno che viene dalla classe. E una
finestra nuova non entra più da sola — è il punto di tutto — ma nemmeno si
deve cercare a mano: il tasto in fondo dice quanti contatti Home Assistant ha
trovato che qui dentro non ci sono, e li mette come righe. Una volta sola.

**Dieci disegni nuovi, e niente più emoji di sistema.** «Icone sempre quelle
del catalogo nostro, se non presenti queste creale.» I varchi avevano quattro
emoji scelte dalla classe — porta, finestra, casa diroccata, cartello di
lavori — che cambiano faccia da un telefono all'altro, e la casa diroccata
come portone del garage non la riconosceva nessuno. Adesso ce ne sono tredici
fra cui scegliere, tutti disegnati con la tavolozza degli elettrodomestici:
finestra, porta-finestra, portone, basculante, lucernario, botola,
scorrevole, sbarra, varco generico — più il radar di presenza, che arriva con
loro. Il disegno si vede anche nella pagina Varchi, nella vetrina della
Sicurezza e nella scheda delle aree d'allarme, che leggono lo stesso elenco.

**E adesso sono tutte e quattro la stessa scheda.** Non «la stessa forma»
scritta due volte: proprio lo stesso file. I rilevatori avevano lo stesso
difetto dei varchi — l'elenco lo faceva Home Assistant, il cestino escludeva
invece di cancellare, e sotto c'era «Tolti dai conti» — e adesso hanno la
riga, la pastiglia, la striscia dei disegni e il tasto d'importazione dei
varchi, perché li disegna lo stesso pezzo di codice. Quattro copie della
stessa scheda sarebbero quattro schede che fra sei mesi non si comportano più
alla stessa maniera, che è esattamente come ci siamo arrivati la prima volta.
Anche i due disegni della presenza erano emoji: adesso sono quindici fra cui
scegliere, col radar per chi ha un mmWave.

Le **Batterie** e le **Macchine** hanno la stessa scheda, con le loro due cose
in più: la soglia di casa e le soglie di ricarica da una parte, la scelta
delle integrazioni dall'altra. Le integrazioni spuntate restano e fanno ancora
il loro mestiere — da quali marche si adotta — ma adesso decidono cosa viene
**proposto**, non cosa si vede: quello che si vede è quello che hai scritto.
Le macchine hanno in più la fascia, macchina o pezzo di rete, che prima si
deduceva dalla classe e adesso la scegli tu.

**E dichiarando entra anche quello che il rilevamento non trovava.** Il
rilevamento dei varchi guarda solo i `binary_sensor.*`: un basculante che in
Home Assistant è un `cover.*` non lo trovava, e non c'era modo di metterlo.

**E i due comandi della pastiglia dell'entità stavano male.** Su un campo che
l'etichetta ce l'ha già — cioè ogni riga dichiarata, quindi anche Porte e
cancelli e i Carichi di oggi — il 🗑 Elimina restava da solo su una riga sua e
la ✏️ sbordava dal suo quadrato da 36 pixel. Adesso sono gemelli, sotto la
pastiglia, sulla stessa riga. Nella stessa passata è sparito un difetto più
silenzioso: un entity_id lungo apriva la riga in larghezza invece di
accorciarsi con i puntini, e quello che sbordava veniva tagliato via.


## 1.6.0.3

**La voce «Zigbee» nell'app c'e', in una casa con Zigbee2MQTT.** Era una
parola sola, e stava scritta in due modi.

La riga nuova del registro, dalla casa di chi l'ha segnalato, ha detto in un
colpo cos'era: `la rete Zigbee di questa casa e' Zigbee2MQTT, nella cassetta
«zigbee2mqtt»`. Il ponte la rete la trovava — la trovava dalla 1.6.0 — e
l'app continuava a non disegnare la voce nel menu. Quindi il guasto non era
nel cercare: era in chi ascolta la risposta.

Sul filo il ponte manda `quale: "zigbee2mqtt"` (`Z2M`, in
`ponte/src/zigbee.js`). L'app, nel suo elenco `LaRete`, cercava
l'abbreviazione — `z2m`. Due parole diverse non tornano mai: la risposta
finiva in `LaRete.nessuna`, `siApre` diceva che una rete non c'e', e
`barra.dart` la voce non la metteva. Esattamente lo stesso disegno di una
casa che Zigbee non ce l'ha — che e' il motivo per cui dal di fuori non si
poteva distinguere, ed e' il guasto che la 1.6.0.2 ha reso visibile.

Con ZHA le due parole erano la stessa, `zha` di qua e `zha` di la', e quella
meta' funzionava. E' cosi' che un guasto del genere passa le prove: meta' del
codice e' giusta, e la si prova.

Le due meta' stanno in due linguaggi e nessun compilatore le guarda insieme.
Adesso le guarda una prova: legge l'elenco `LaRete` dal file Dart, lo
confronta con le tre costanti del ponte e cade se una delle tre non torna —
come `marchio.test.js` fa con i numeri di versione. Rimessa la parola
vecchia, la prova diventa rossa; e' stata provata in tutt'e due i versi.

E c'e' un secondo motivo per cui e' passato, che vale la pena scrivere: **le
prove dell'app usavano la stessa parola sbagliata**. Il ponte finto di
`app/test/` rispondeva `z2m`, perche' l'ha scritto chi ha scritto anche
l'elenco. Un ponte finto che parla la lingua inventata da chi lo interroga
non prova niente — e' lo stesso sbaglio della casa finta che consegnava i
messaggi MQTT a chiunque, «piu' generosa di un broker vero», scoperto due
versioni fa. Adesso il ponte finto dice `zigbee2mqtt`, che e' quello che dice
il ponte vero.

**E nella stanza esce l'icona dell'azione rapida, e la finestra si intitola
come la riga.** Il nome era arrivato, il resto no.

L'icona, perche' qui passava soltanto un **glifo** — qualcosa fuori
dall'ASCII — e l'editor delle Azioni rapide di serie ci mette un token del
catalogo, `mdi:qualcosa`. Buttato quello, la riga si prendeva il segno che
sa dedurre dal dominio: su un `select`, la lavagnetta. La regola aveva la
sua ragione, ed era vera quando e' stata scritta: quella riga era testo, e
un token stampato com'e' sarebbe stata la scritta «mdi:tune» sopra il nome.
Adesso il segno lo mette `iconGlyphHtml`, che la differenza fra un glifo e
un token la sa ed e' nata per questo. La terza forma continua a non passare
— su qualche riga `icon` e' la CHIAVE di un disegno del catalogo,
«washer» — perche' quella a video sarebbe davvero la parola «washer».

Il titolo, perche' la finestra delle voci e' **la stessa** che apre il tasto
delle Azioni rapide nella Home, e di la' le arriva l'azione: nome scelto,
icona scelta. Da qui non le arrivava niente, e ripiegava sul nome di Home
Assistant e sulla sua faccia di serie — una finestra intitolata «MODUS»
aperta da una riga che si chiama «prova». Adesso il tasto dei tre puntini si
porta dietro quei due campi, che erano gia' calcolati una riga sopra.

## 1.6.0.2

**La riga dello Zigbee esce da sola, nel registro dell'add-on.** La 1.6.0.1
aveva messo in piedi il rimedio al guasto muto — il ponte scrive cos'ha
trovato guardando la rete Zigbee, invece di lasciare indovinare — ma il
rimedio era muto anche lui. Quella riga la riempiva `rete()`, e `rete()`
partiva la prima volta quando qualcuno apriva la schermata Zigbee nell'app:
finche' nessuno la apriva, il riquadro della console restava nascosto e nel
registro non compariva niente. Solo che chi quella schermata non ce l'ha —
perche' la voce nel menu non compare, **che e' esattamente la domanda** — non
puo' aprirla per scoprire perche' non compare. Un cerchio, e dal campo si e'
chiuso cosi': «Ho aggiornato app ma niente, nei log non e' uscito».

Adesso la rete la si guarda all'accensione, e la riga va nel registro
dell'add-on insieme alle altre — accanto a «Home Assistant risponde», a «5
dispositivi abbinati», a «il centralino ci conosce». Il registro e' il primo
posto dove si guarda quando una cosa non c'e', ed e' dove il ponte dice gia'
tutto il resto di se'. Dice una cosa sola di tre:

- `la rete Zigbee di questa casa e' ZHA`
- `la rete Zigbee di questa casa e' Zigbee2MQTT, nella cassetta «zigbee2mqtt»`
- `nessuna rete Zigbee: nell'app la voce «Zigbee» non comparira' — <perche'>`

La terza porta con se' tutt'e due le ragioni, quella di ZHA e quella della
posta, perche' e' l'unica riga che quella persona leggera': se il motivo non
ci sta dentro, non sta da nessuna parte. Ed e' scritta come un avviso, non
come una riga qualunque, per chi il registro lo scorre cercando cosa non va.

Se la prima occhiata non trova niente si riguarda dopo mezzo minuto e dopo
due: all'accensione Home Assistant sta spesso ancora partendo, e l'add-on di
Zigbee2MQTT parte per conto suo, a volte dopo di noi. Scrivere «nessuna rete
Zigbee» in una casa che ce l'ha, e non correggerlo piu' fino al riavvio dopo,
sarebbe peggio del silenzio. E siccome adesso la rete si guarda comunque, il
riquadro «Zigbee» nella console dell'add-on si riempie da se' invece di
aspettare che qualcuno passi dall'app.

**Nella stanza, il nome glielo da' anche l'azione rapida.** «Leggo ancora
modus… sono azioni rapide, scene, queste — non modus.» La 1.6.0.1 aveva
corretto meta' del guasto: nella stanza il nome se lo prende da «Le tue
entita'» invece che da Home Assistant. Ma i rubinetti che un nome ce l'hanno
sono due, e il secondo non lo guardava nessuno — chi un'azione rapida ce l'ha
non ha nessun motivo di riscrivere la stessa entita' in un'altra scheda per
darle lo stesso nome. Il nome stava li', e nella stanza la riga continuava a
chiamarsi «Modus»: e' il `select` di un'integrazione tedesca, e vuol dire
«modalita'».

Adesso il nome e il segno arrivano anche dalle Azioni rapide. Dove ci sono
tutt'e due vince quello di «Le tue entita'», che di mestiere fa proprio dare
un nome a un'entita'; l'azione rapida il nome ce l'ha per fare un tasto, e
vale dove l'altro non c'e'. E un'azione rapida da sola in nessuna stanza ci
va: il nome lo presta, la riga non la crea — se no la pagina Stanze si
riempirebbe di tasti della Home che nessuno ha messo li'.

**Le «Novita'» nel Play Store raccontano la 1.6.0.** Sotto la 1.6.0 e sotto
la 1.6.0.1 c'era il testo della 1.5.4 — «Il numero dell'app e quello di casa
tornano uguali. Qui dentro non cambia niente» — perche' quei due file non li
aveva piu' toccati nessuno da marzo. Chi apriva la scheda dell'app sul
telefono leggeva quello, davanti alla versione con l'abbinamento Zigbee, il
volto o l'impronta, le fasce orarie e le stanze per piano.

## 1.6.0.1

Sette cose viste provando la 1.6.0 su un telefono e su una casa vera. Nessuna
funzione nuova: sono tutte correzioni, e due di queste toglievano fiducia a
quello che la plancia dice.

**Uno switch acceso non è più un «dispositivo non collegato».** Nel cruscotto
dell'installatore comparivano quarantatré apparecchi giù in una casa in cui
funzionavano quasi tutti. La prova sta nella scheda di uno switch UniFi:
stato **Connesso**, in casa, CPU al 5,7%, firmware aggiornato — e in fondo
all'elenco «Port 1 power cycle» e «Port 4 power cycle» col tasto grigio. Su
quelle due porte non c'è attaccato niente, quindi UniFi pubblica quei due
pulsanti come non disponibili. Due entità su venti, e la regola diceva: se
una tace, il dispositivo è giù. Non è un capriccio di UniFi — il blocco
bambini di un'asciugatrice spenta, il canale non usato di una presa multipla,
la ricarica di un'auto che non c'è fanno lo stesso. Adesso un apparecchio è
giù solo quando **tutte** le sue entità tacciono insieme, che è come si
presenta davvero uno irraggiungibile: una sola che parla vuol dire che la
strada c'è.

**Il Report divide per fasce subito, invece di aspettare un giro da Analisi.**
«Devo cliccare prima su Analisi, poi vado in Panoramica e cambia.» Il conto
si fa se c'è qualcuno che guarda la Panoramica — sono settecento righe
chieste al Recorder, e farle per una pagina che nessuno ha davanti sarebbe
lavoro buttato — ma quella domanda era una fotografia, e rispondeva per
l'istante in cui la si faceva. Il pacchetto del mese arriva mentre il Report
si sta ancora aprendo: la risposta era «no», e non si riprovava più. Da qui
il giro da Analisi, che non era un rimedio ma il dito che dava la seconda
occasione al posto del codice. E non mancava solo il blocco: finché il conto
non c'è, «Costo Reale» resta sulla stima invece della spesa contata ora per
ora — **32,16 € nella tessera e 19,85 € nel blocco**, a tre centimetri di
distanza. Adesso il pacchetto si mette da parte e si aspetta di essere
guardati.

**Il ponte dice che rete Zigbee ha trovato, invece di tacere.** Una casa che
ha Zigbee e un ponte che non lo trova erano indistinguibili da una casa che
Zigbee non ce l'ha: in tutt'e due i casi la voce nel menu dell'app non
compare, e chi guarda non sa né quale dei due gli è capitato né cosa andare a
controllare. Adesso la console dell'add-on lo scrive in una riga, accanto a
quella del centralino: «la cassetta si chiama zigbee2mqtt», oppure «in 2
secondi non ha risposto nessuno», oppure «Home Assistant non fa ascoltare
MQTT». E la cassetta si trova anche quando il suo prefisso ha una barra
dentro: la funzione che lo legge era preparata per quel caso, ma la domanda
lo rendeva impossibile — in MQTT il `+` copre un livello solo.

**Nel cruscotto i dispositivi non collegati si leggono tutti.** Erano dodici
più «e altri 31», e quella scritta non risponde alla domanda per cui quel
riquadro esiste: chi installa ci va a cercare dentro **quali** cose sono giù,
perché è da lì che decide se prendere la macchina. Il taglio non era nel
cruscotto, che disegna tutto quello che gli arriva: era nel ponte, e stava a
dodici per una ragione di impaginazione. Adesso sta a duecento, che è una
guardia contro un elenco che cresce senza fine.

**Il nome che dai a un'entità arriva anche nella stanza**, non solo nel suo
elenco. Le righe di «Altro in questa stanza» le riempiono due rubinetti:
l'assegnazione a mano, che sa **dove** e del nome non sa niente, e «Le tue
entità», che sa dove, come si chiama e con che segno. Vinceva la prima
arrivata, tutta intera — e siccome la mappa a mano si legge per prima,
un'entità scritta in tutt'e due perdeva il nome che le era stato dato e
tornava a chiamarsi come la chiama Home Assistant. Adesso si decide campo per
campo: la stanza la dice quella scritta a mano, il nome e il segno l'unica
delle due che ce li ha.

**I disegni degli elettrodomestici non abbagliano più al buio.** Il palco su
cui stanno era una radiale azzurro chiaro su fondo quasi bianco, uguale per
tutti e due i temi: su una pagina scura diventava una lastra, e il disegno —
che è bianco e acciaio — ci si perdeva dentro invece di staccarsi. Guardati
tutti e ventidue prima di toccare: su un palco scuro si leggono meglio, non
peggio. I palchi erano due, quello a riposo e quello di quando l'apparecchio
è in funzione, e il secondo al buio era il peggiore.

**Tre cose più piccole, dalla stessa sera.** La tessera «Non rispondono» si
chiama **Dispositivi non connessi** e ha finalmente un disegno suo: era
l'unica della Home che ricadeva su un'emoji, e accanto a sei oggetti disegnati
si vedeva che era più grande e fuori asse. Le didascalie che scorrono sotto le
tessere vanno a **metà velocità**: andavano a una quindicina di punti al
secondo, e un tetto sbagliato faceva correre proprio le più lunghe, che sono
quelle che si fa più fatica a leggere.

## 1.6.0

Il numero passa a **1.6.0** e non a 1.5.9.17, perché qui non ci sono
correzioni: ci sono due cose che l'app prima non sapeva fare, l'energia che
comincia a rispondere a «a che ora costa», le stanze che si dividono per
piano, e la plancia dentro Home Assistant che si apre in tre secondi invece
che in tredici. Trentasei giri di lavoro.

**Un dispositivo Zigbee si abbina dall'app, senza entrare in Home Assistant.**
«Vorrei poter abbinare un dispositivo zigbee direttamente dall'app.» È una
schermata sola, che va avanti da sé: si apre la rete, si aspetta, entra
qualcosa, gli si dà un nome. Che rete ci sia in casa non lo chiede a nessuno —
ZHA o Zigbee2MQTT lo scopre il ponte guardando la casa, e dove non c'è nessuna
delle due la voce nel menu non compare affatto, come la Console e il
Cruscotto. Il conto alla rovescia è quello del ponte e non un cronometro del
telefono: un cronometro qui direbbe «2:58» a rete già chiusa — telefono che
dorme, ponte riavviato — e chi preme il tasto di una presa davanti a una porta
chiusa non capirebbe perché non succede niente. E la voce è **solo su Android
e iOS**: nella webapp non c'è.

**E quando è entrato, la plancia chiede dove metterlo.** Il passo che manca
sempre: un dispositivo abbinato è un dispositivo che non si vede da nessuna
parte finché qualcuno non apre la configurazione. Adesso, appena gli si dà un
nome, si passa alla plancia e si apre un foglietto: otto sezioni — Luci,
Prese, Clima, Finestre, Varchi, Presenza, Temperature, Le tue entità — con
quella giusta già suggerita, e le altre entità dello stesso dispositivo
elencate con dove andrebbero. Su Zigbee entra un dispositivo, non un'entità:
ne porta cinque o sei e una sola dice cos'è, e quella si sceglie per ordine di
dominio invece di prendere la prima che arriva — l'ordine non è garantito, e
prendere la prima vuol dire la stessa presa fra le prese in una casa e fra i
sensori in un'altra. Niente è definitivo: nome, stanza e icona si cambiano
quando si vuole dall'editor della sezione. Trentasette righe nuove nei tredici
cataloghi.

**Il volto o l'impronta davanti all'app.** Un telefono sbloccato e lasciato
sul tavolo apre la casa di chi ce l'ha: le luci, le tapparelle, le telecamere,
chi c'è e chi non c'è. Adesso davanti ci si può mettere il riconoscimento —
all'avvio, tornandoci dopo un minuto, e prima delle tre cose che da un
telefono trovato aperto non si disfano: il cruscotto, un comando, togliere una
casa. Il volto e l'impronta **non escono dal telefono**: restano nel suo
coprocessore, e da lì torna un sì o un no — non passano dall'app, non arrivano
né a gdahome né alla casa. La scheda lo scrive, e scrive anche cosa non copre:
porte e cancelli si aprono dalla plancia, e lì la guardia è il PIN
dell'azione. Di serie è spento, e accendendolo si prova subito: un lucchetto
che si chiude e non si apre più è peggio di nessun lucchetto, e chi si trova
l'app che non si apre la disinstalla — e con lei se ne va l'abbinamento. Su un
telefono senza lettore non si offre niente. Anche questo **solo su Android e
iOS**, e con lui dalla webapp se ne vanno Zigbee, Aiutanti e Automazioni: sono
cose che vogliono il telefono, e nel browser sarebbero porte che si aprono su
metà di quello che promettono.

**Il kWh può costare diverso a ore diverse** (#72). «Possibilità di inserire
prezzi diversi per fasce diverse, tipo 2 fasce impostabile con orario o anche
3 fasce.» Il kWh aveva un prezzo solo, e per chi ha un contratto a fasce
quello è una media inventata: la lavastoviglie delle undici di sera costa un
terzo in meno di quella delle quattro del pomeriggio, e una plancia che dice
lo stesso euro in tutt'e due le ore sta dicendo il falso proprio nel momento
in cui uno la guarda per decidere. In Energia → Impostazioni, sotto i due
prezzi di sempre: due o tre fasce, ognuna con l'ora da cui comincia e il suo
prezzo, più la riga del fine settimana — in Italia sta tutto nella fascia più
bassa, e senza quella il sabato verrebbe contato come un mercoledì. Di serie
sono spente, e chi non le apre non si accorge di niente.

**E il costo del mese diviso per fascia è un conto, non una stima** (#72).
«Hai corretto anche il report nella sezione energia che calcola i costi in
base a quelli configurati?» Quando le fasce sono nate c'era scritto, nel
codice, che su un periodo si poteva dare solo una stima perché «la plancia sa
quanti kWh sono passati, non in che ore». Era una limitazione nostra, non una
limitazione vera: il Report le statistiche orarie le chiede già — è così che
misura la quota di sole di un apparecchio — e se i kilowattora arrivano già
divisi per ora, ogni ora si mette nella sua fascia e il conto torna. In
Panoramica, subito sotto la griglia finanziaria: una barra a tre colori con le
quote, una riga per fascia con orario, kilowattora, percentuale, prezzo e
spesa, e il confronto che risponde alla domanda vera — le fasce mi convengono?
Esatto per le ore che ci sono: il Recorder tiene il passo orario per un pugno
di giorni, e più indietro restano i totali del giorno. Il blocco dice quanta
parte è l'una e quanta l'altra, invece di spacciare tutto per un conto. E
«Costo Reale» adesso è quel numero: due cifre diverse per la stessa spesa, a
tre centimetri di distanza, sarebbero il difetto peggiore di tutta la storia.

**L'andamento giornaliero si colora di fasce** (#72). Sotto le due linee di
sempre, la barra di ogni giorno alta quanto i kilowattora presi dalla rete e
divisa nei colori di F1, F2 e F3. Si aggiungono alle linee e non le
sostituiscono, perché raccontano un'altra cosa: «Consumo» è quello che la casa
ha usato, le fasce stanno sotto quello che si è comprato — che col
fotovoltaico è sempre meno. Mettere le tre fasce al posto della linea del
consumo avrebbe fatto sembrare che nei giorni di sole si consumasse meno,
quando invece si comprava meno: un grafico che dice il falso proprio nei
giorni in cui l'impianto lavora bene.

**«A che ora compri dalla rete», in ANALISI** (#72). Ventiquattro colonne,
alte quanto i kilowattora presi dalla rete in quell'ora di tutto il mese e
colorate come la fascia che le copre, con sotto l'ora in cui si compra di più
— con la sua fascia e la sua spesa. È l'altra domanda dietro le fasce, e
nessuno la fa a Home Assistant: quanto costa si legge in bolletta, a che ora
si compra no. E sapendolo si decide: la lavastoviglie alle undici di sera
invece che alle quattro del pomeriggio, l'auto in carica dopo mezzanotte. Su
un mese vero la risposta si legge a colpo d'occhio — la notte blu bassa, il
giorno arancio, la punta viola fra le sette e le nove di sera.

**Le stanze si aprono in elenco, divise per piano, con le pastiglie che dicono
e che spengono** (#17). «Rooms must be displayed in groups based on the
selected floor… Small icons should appear on the card to indicate the status
or count of lights, climate, power outlets, alerts, doors, windows and
temperature. Clicking on one of these should toggle the device without needing
to enter the room.» La pagina si apriva su una stanza, con la fila delle
linguette in cima: con cinque stanze funziona, con venti è uno scorrimento
orizzontale in cui si cerca il nome. Adesso si apre sull'elenco, e accanto al
titolo di ogni piano c'è quante luci sono rimaste accese lassù — la domanda di
chi sale le scale. Sulla tessera: luci accese, prese accese, i gradi, le unità
del clima, i varchi aperti, le porte non chiuse, e cosa non risponde. Esce
solo quello che ha qualcosa da dire, e una stanza senza sonda non scrive «0°».
Il tocco **non spegne: chiede** — «Spengo 3 luci?» per due secondi, e dopo che
si è spento resta cinque secondi l'annulla, che riaccende quelle che ha spento
lui e non «tutto com'era». Comandano solo la lampadina e la presa: i gradi non
sono un interruttore, una finestra non si chiude da una pastiglia.

**I piani si gestiscono davvero, e due stanze omonime non si rubano più le
entità** (#17). «Posso creare bagno primo piano e bagno secondo piano e le
entità poi devono funzionare divise, non è la stessa stanza.» I piani c'erano
ed erano tre righe in fondo alla scheda Stanze: non si ordinavano — e l'ordine
è quello con cui si sale le scale, quindi decide la pagina Stanze, le scene
delle luci e le tapparelle — non si rinominavano, non avevano un segno, e il
cestino toglieva il piano alle sue stanze senza dire quante fossero. Adesso il
pannello «I piani della casa» sta in cima alla scheda, con le frecce, il
segno, la rinomina che si porta dietro le sue stanze e il cestino che chiede
prima. E nella finestra «Modifica stanza» il Piano non è più una casella di
testo: «primo piano» accanto a un «Primo piano» faceva due piani, cioè la
stessa casa divisa in quattro per una lettera. **Il difetto** era l'altra
metà: un'entità assegnata col nome della stanza finiva nella prima che quel
nome ce l'aveva. Su due bagni di due piani diversi vuol dire mettere
l'interruttore di sopra nella stanza di sotto — uno spegne la luce sbagliata e
non capisce perché. Adesso l'identificativo vince sempre e il nome vale solo
quando è di una stanza sola; con due omonime la voce compare fra quelle senza
stanza, e l'editor lo dice su tutt'e due le righe. Peggio esteticamente e
meglio in tutto il resto, perché si vede e si va a correggerlo.

**Una tessera compare quando qualcosa non risponde** (#33). «Ho dei comandi
domotici in giardino che ogni tanto, causa segnale wifi non sufficiente, vanno
in offline: avere l'avviso mi allerta di ripristinarli per evitare che la
pompa resti ferma troppo a lungo.» È il guasto più cattivo che una casa
domotica abbia, perché è muto: una presa che sparisce non fa rumore, la sua
tessera resta con l'ultimo valore che aveva, e uno se ne accorge quando la
piscina è verde. La tessera **non c'è** finché non c'è niente da dire, ed è il
punto: una tessera verde fissa che dice «tutto a posto» diventa invisibile in
una settimana, e il giorno che diventa rossa nessuno la guarda più. Compare
quando qualcosa tace, dice quante e quali e da quanto — cinque minuti è un
riavvio e passa da solo, due giorni è una presa da andare a premere — e
sparisce da sola quando tornano. Conta solo `unavailable`: `unknown` vuol dire
«c'è e risponde ma non ha ancora un valore», ed è normalissima dopo un
riavvio. Contarla sarebbe una tessera rossa a ogni riavvio, cioè un avviso che
si impara a ignorare.

**Le entità che scegli tu, sotto il meteo, e solo quando servono** (#7). «La
mia idea è quella di avere la possibilità di aggiungere nella sezione sotto al
meteo le info di entità personalizzate, magari scegliere se visualizzare in
base allo stato. Esempio: quando la modalità vacanze è attiva lo mostra
altrimenti no.» Fino a sei, ognuna col suo nome, segno e colore. La condizione
è la metà che conta: una fascia che porta sempre tutto non è una fascia, è un
elenco — la regola di tutta la barra è che si vede quello che ha qualcosa da
dire adesso, e un numero c'è sempre. Allora lo dice un'altra entità — «questa
mi serve quando siamo via» — e se la condizione non si riesce a leggere la
pastiglia non si vede: se non si sa se siamo in vacanza, dirlo per scrupolo
vorrebbe dire dire una cosa che non si sa. Stanno subito dopo la presenza e
prima della temperatura, in fondo al gruppo delle cose accese: una lettura che
uno ha scelto apposta la sta cercando, mentre la temperatura di fuori è lo
sfondo su cui si guarda la casa.

**La presenza fra le pastiglie sotto il meteo** (#73). «Si potrebbe una
pastiglia sotto al meteo?» La tessera contava già in quante stanze c'è
qualcuno; la fascia una voce per lei non ce l'aveva. Sta fra gli stati e non
fra le notizie — dopo la musica, prima delle misure — per la stessa ragione
per cui la sua tessera non si accende mai: qualcuno in casa non è un allarme,
è la normalità. Il conto sono i posti occupati e non i rilevatori: una stanza
con tre rilevatori resta una stanza.

**Le tre funzioni della serratura, dal popup della Home** (#34). «Per chi ha
serrature smart vorrei si potesse già dal popup del widget in prima pagina
scegliere tra le 3 funzioni: sblocco senza apertura, sblocco completo,
blocco.» Le prime due il modello le sapeva già, ma il popup ne mostrava una
sola. La terza non esisteva affatto: la plancia sapeva aprire e sbloccare e
non sapeva **chiudere**, che su una serratura è metà comando. Ogni tasto si
chiama come il gesto che fa — tre lucchetti uguali in fila sarebbero tre
indovinelli — e prima viene quello che si può disfare, il blocco in fondo. Il
PIN protegge l'apertura, non la chiusura: chiedere un codice per chiudere la
propria porta sarebbe attrito senza sicurezza in cambio, col risultato che chi
ha fretta la lascia aperta.

**Un'azione rapida che apre tutte le prese** (#25). «Si potrebbe inserire
nelle Azioni rapide un pop up di tutte le prese?» «Popup tutte le luci» c'era
già; per le prese no, e una finestra delle prese la plancia ce l'ha — è quella
della tessera. Quindi non una seconda finestra, che alla prima modifica se ne
aggiusterebbe una sola, ma una porta: si dice il nome della tessera e si apre
la sua. E una casa senza prese configurate non lascia il dito su un tasto che
non fa niente: porta dove si configurano.

**Un menu a tendina si sceglie ovunque, e nella stanza si comanda invece di
uscirne.** «Dove nella sezione entità viene inserita una entità select, fai
aprire popup dove si sceglie la modalità di quel select.» Il popup c'era, ed
era di uno solo: le azioni rapide. Dappertutto altrove un menu a tendina era
una riga morta — e nella stanza era peggio, perché premerla portava in Home.
Quello era un difetto generale della stanza: un'entità assegnata a mano finiva
nel blocco «Altro», e «Altro» aveva una destinazione scritta in tabella,
`home`. Da lì in poi tutta la riga era un tasto, e quel tasto faceva una cosa
sola: uscire dalla stanza — non importava cosa ci fosse dentro. Lo stesso
difetto era già stato corretto tre volte, un genere alla volta; qui si
guarisce la regola: non avere una destinazione non vuol dire averne una
qualsiasi, vuol dire non andare da nessuna parte. Restano quattro righe
possibili e nessuna esce dalla stanza: quella che si accende ha la levetta,
quella che si fa partire la stella, quella che si sceglie i tre puntini, e
quella che si guarda e basta è una riga e niente più.

**Nella stanza c'è la card del clima, non una riga generica** (#11). «La
tessera del clima nella stanza ha uno stile diverso da quella della pagina
Clima.» Non erano due disegni in gara: nella pagina Clima c'è una card — i
gradi grandi, la barra fra minimo e massimo, l'ambiente sotto, il meno, il più
e l'interruttore — e nella stanza c'era la riga che si dà a qualunque cosa.
Vince la card, e non per gusto: è l'unica che risponde senza aprire niente
alle quattro domande che uno fa a un condizionatore — a quanto sta, quanto fa
in stanza, fra che estremi si muove, e come lo alzo o lo spengo. Non una copia
somigliante, che tornerebbe a divergere al primo ritocco: è la stessa card,
chiamata da lì. Nella stessa passata, la pagina Stanze diceva «Raffredda» dove
la pagina Clima dice «Raffresca» — la stessa macchina con due parole a due
dita di distanza.

**Le alette si muovono anche di lato** (#56). «I miei climatizzatori hanno
alette sia verticali che orizzontali, al momento vengono visti solo i comandi
per le alette verticali.» Home Assistant pubblica il secondo asse con la
stessa forma del primo e lo comanda con un servizio suo; il pannello ne
leggeva solo metà. Ora c'è una riga per asse, e i nomi si qualificano solo
quando c'è da distinguere: chi ha un asse solo continua a leggere «Alette»,
come ha sempre fatto.

**La TV accesa non dice più standby, e la potenza muta dice perché** (#47).
«Le tv anche se accese risultano sempre in stand-by»: la parola di un lettore
arrivava a un solo bivio, quello dell'«acceso generico», che porta a STANDBY —
e la TV in standby, parola che nessuno raccoglieva, diceva SPENTO. Ora la
stessa entità dice la stessa cosa da tutt'e due le parti. «Gli
elettrodomestici non mostrano i consumi»: la card pretende un sensore in W o
kW e scartava in silenzio tutto il resto, lasciando una card vuota e una
configurazione che sembrava giusta. Il caso vero è quasi sempre lo stesso —
l'integrazione porta i kWh, che contano quanto ha consumato in tutto e non
quanto assorbe adesso — e ora l'editor lo dice sotto il campo dove si sbaglia,
e dice in quale campo va quel sensore.

**La friggitrice ad aria si può scegliere** (#71). «Mi piacerebbe pilotare la
mia friggitrice ad aria della Philips.» Il disegno la plancia ce l'aveva da
sempre, insieme a quello del tostapane, ma nell'elenco delle cose che si
possono scegliere non c'era: chi ce l'aveva in Home Assistant, in plancia
doveva chiamarla «Presa». Adesso ci sono tutt'e due, e il nome
dell'apparecchio in Home Assistant le riconosce da solo. La sezione dei
dispositivi di cottura è un'altra cosa, e non è qui.

**L'entità scelta con la lente arriva in configurazione** (#70). «L'entità
assist che ho, in questo caso ollama, non resta salvata»: si sceglie, il nome
compare nella casella, e riaprendo la scheda la casella è di nuovo vuota. Il
perché era una parola sola. Quando si sceglie una riga del catalogo, il guscio
annuncia il cambio con un evento che **non risale** il documento, mentre
quello vero — che nasce quando una persona scrive e poi esce dal campo — sì.
Chi ascoltava sull'elemento lo sentiva; chi ascoltava sul documento non lo
sentiva mai. Contati: undici moduli usano la lente e ascoltano sul documento,
quattro in cattura — e quei quattro funzionavano da sempre. Gli altri sette
aspettavano un evento che non arrivava. Non era un caso di Assist: era una
parola mancante in una riga che riguarda tutti.

**Una sezione nascosta dall'elenco resta nascosta** (#68). «Quando seleziono
di non vederlo nella barra non scompare, rimane lì.» Spegnerla funzionava: la
voce spariva subito, e tornava al primo salvataggio. Nella mappa delle
visibilità un `false` vuol dire due cose opposte — «non l'ho ancora
configurata» e «non la voglio vedere» — e la passata che accende le sezioni
configurate le distingue leggendo un segno a parte. Quel segno però lo
scriveva un ascolto che guardava una cosa sola: la fascia dentro la scheda
della sezione lo faceva scattare, l'interruttore dell'elenco no. Due porte
sulla stessa decisione, e una sola lasciava detto di averla presa.

**La plancia dentro Home Assistant si apre in tre secondi invece che in
tredici.** «Da Home Assistant la plancia ci mette tantissimo a caricare,
invece da app apre subito»: da un video, la testata resta a «Caricamento…» dal
quinto al quindicesimo secondo. Sul filo del telefono i moduli viaggiano a
pacchi e compressi; dentro Home Assistant la pagina li chiede uno per uno
all'ingress, e l'ingress li serviva in chiaro — i trecentosessantotto file
dell'apertura sono nove megabyte e mezzo così, e tre compressi. Il sessantotto
per cento di roba che non doveva viaggiare. E non bastava comprimerli: Node ha
un filo solo, e stringerli tutti lo tiene fermo trecentodieci millesimi.
Quindi si stringe una volta e ci si tiene il risultato. Misurato sugli stessi
file: 9,34 MB → 2,95 MB sul filo, 94 ms → 3 ms dal secondo browser in poi.

**Tre sfocature calcolate per niente, e l'interruttore che non le toglieva.**
«C'è un notevole frame lag su app, vedi video»: misurato fotogramma per
fotogramma, ventisette fermate oltre un decimo di secondo in trentun secondi
d'uso. La barra in basso sfocava quello che poi copriva — il fondo pieno era
stato messo un anno fa e il vetro era rimasto acceso dietro, e un vetro
rilegge quello che ha dietro ogni volta che dietro si muove qualcosa. «Plancia
leggera» non lo toglieva: scriveva una stella in testa al documento, e fra due
`!important` della stessa origine decide prima la specificità — una stella
vale zero. E il disegno del guscio, il più caro di tutti, era l'unico che non
si fermava mai quando nessuno guardava.

**Nell'app la plancia si parcheggia quando nessuno la guarda.** Era la metà
che mancava: dentro Home Assistant chi la ospita le scrive addosso un segno e
lei smette di disegnare, ma nell'app quel segno non glielo scriveva nessuno.
Le sezioni restano tutte in piedi anche quando non si guardano — rifarle da
capo a ogni ritorno vorrebbe dire riaprire la plancia ogni volta — ma restare
in piedi non vuol dire restare al lavoro, e la plancia era l'unica che
continuava a disegnare per nessuno, col suo disegno da settecento righe, i
suoi timer e le sue animazioni, sotto una schermata che non la mostrava.

**Sul tablet le scritte della barra non si tagliano più.** «I testi delle
icone della navbar non entrano»: da una fotografia di un tablet con ventitré
sezioni accese, dieci scritte su ventitré tagliate a metà — «ANIM…», «AGEN…»,
«ELETT…». Dai 900 punti in su la riga si divideva fra le linguette, e con
ventitré dividere la riga vuol dire dare a ognuna il suo minimo: settantadue
punti, in cui per la scritta ne restano poco più di cinquanta.
«Elettrodomestici» ne chiede centosei. Adesso ogni linguetta è larga quanto la
sua parola, la scritta cresce da dieci a undici punti, e quello che non ci sta
si raggiunge scorrendo.

**La bolla di un carico non finisce sopra la Casa.** «Wallbox sta troppo
attaccato a casa»: non era attaccato, era sopra — fra i 769 e gli 820 punti di
larghezza si sovrapponeva al cerchio della Casa di quarantaquattro punti,
misurati. Due soglie per una stessa decisione: il guscio cambia tutto a 768, i
carichi si spostavano sulla riga stretta a 820, e nella fascia in mezzo la
bolla saliva restando grande in un palco rimasto alto. Adesso la soglia è una
sola. E siccome sul largo le bolle stanno su una riga, chi disegna guarda la
larghezza vera e le stringe quel tanto che basta: otto bolle da novantadue
punti ne chiedono settecentotrentasei, e in settecentoventicinque si
toccavano.

**La testata della Home non resta spenta, e il MiniPC incolonna le sue
misure.** «Quando entro nel widget energia e ritorno nella home spariscono le
3 lineette in alto a sinistra, il nome della Dashboard e l'icona della
configurazione. Per farli rientrare devo chiudere e rilanciare l'app.» Il
guardiano che riaccende la fascia dà per scontato che una pagina aperta ci
sia, e che sia una: ci sono due stati in cui non è così — nessuna pagina
attiva, o due — e in tutt'e due non ripara niente, e non ripara mai più. Non
si rincorre nessuno dei due: si rimette l'invariante che quella regola
presuppone, una pagina aperta e una sola. E «sui widget il mini pc non
incolonna bene le scritte»: la tessera legge dieci caselle e in finestra non
se ne vedeva nessuna delle otto che sono numeri, perché il MiniPC non era
nell'elenco delle tessere che disegnano le loro letture come caselle.

**Il cruscotto dell'installatore mostra anche le altre macchine di casa, e i
nodi giù fra le anomalie.** «Nel lato installatore devono comparire anche
eventuali macchine inserite e nodi presenti.» Chi ha un cluster — un Proxmox,
un NAS, un secondo mini PC — lo dichiara nella sezione MiniPC, e da lì non
usciva: chi installa vedeva la macchina di Home Assistant e non le altre, cioè
non vedeva proprio quelle su cui nessuno guarda mai. Una macchina che non sta
in piedi finisce anche fra le anomalie, che è dove chi installa guarda per
primo. Viaggiano i numeri e il nome scelto da chi abita; le entità no —
servono in casa per sapere cosa leggere, e di lì non escono.

**La sezione MiniPC si accorge della configurazione, e il cruscotto legge le
caselle mappate a mano.** «Ho inserito manualmente i dati della sezione dal
configurazione, se la apro vedo vuoto poi chiudo e riapro ed escono; da app
sono vuoti; e da cruscotto installatore non escono le informazioni.» Due
guasti diversi. Il guscio la mappa delle caselle se la prende una volta sola:
chi la cambia dopo non ci scrive dentro, la sostituisce — e nessuno
ridisegnava, così la pagina restava su NON CONFIGURATO finché non si usciva e
si rientrava. Nell'app quello è il caso normale, non l'eccezione. E il ponte
CPU, RAM e temperatura le cercava solo nei nomi di serie di System Monitor:
chi ha compilato a mano la sezione ci ha messo le entità che la sua casa
pubblica, e quelle il rapporto non le guardava — la plancia mostrava i tre
numeri e il quadro diceva «non comunicato» sugli stessi tre.

## 1.5.9.16

**Il popup di un'azione rapida disegna la sua icona, non ne scrive il nome.**
Con un'azione che porta un'icona del catalogo, in cima alla finestra delle
voci si leggeva `mdi:home` sopra il titolo, che ci finiva pure sotto. Adesso
il disegno passa dal motore delle icone, come in tutto il resto della
plancia: un simbolo scelto a mano resta il simbolo, un token diventa il suo
disegno.

**L'avvio dell'ultimo ciclo non è più l'ora in cui apri la scheda** (#65).
«Se apro la scheda dopo 10 minuti che un elettrodomestico è già in funzione mi
indica che è appena iniziato il ciclo.» Il contatore apriva il ciclo con
l'istante in cui vedeva «in funzione» per la prima volta: quando stava già
guardando quell'istante **è** l'avvio, ma quando nessuno guardava — browser
chiuso, plancia appena aperta — è solo l'ora in cui si è cominciato a
guardare. Adesso sono tre risposte: se la casa lo sa dire (un sensore
`binary_sensor` di attività, dove `last_changed` è davvero l'avvio) vale
quella; se la macchina è partita sotto gli occhi, l'avvio è quello; se la si è
trovata già in funzione, la scheda scrive **«da prima di» le 10:35** e la
durata **«almeno 1h 10m»**, invece di far passare una supposizione per una
misura.

**Il numero grande della tessera non esce più dalla sua scatola** (#30). «Su
Google Chrome si vede male il numero, che è sovrapposto.» Il numero è Oswald a
quaranta, e un margine negativo gli toglie l'aria che quella riga si porta
dentro. Quel margine però è tarato su quel carattere a quel corpo: un valore
più lungo passa a Inter a venti, e lì toglieva più di quanto la riga fosse
alta — una scatola di cinque pixel per un testo che ne occupa trentadue, e il
resto finiva sopra l'insegna e sotto sulla didascalia. Non era Chrome: era
qualunque tessera con un valore di otto caratteri o più.

**Le tre linee per tornare in Home Assistant funzionano anche da computer**
(#35). «Se c'è la modalità kiosk attiva c'è questo problema, se è disattivata
no»; e «da app installata su Mac uguale, invece su telefono iPhone e Android
tutto ok». Il tasto chiedeva a Home Assistant di aprire la barra laterale: su
uno schermo stretto quella barra è un cassetto e si apre — ed è perché sul
telefono andava — su uno largo non è un cassetto, e lì non c'era niente da
aprire. Adesso su schermo largo rimette la barra della dashboard, quella che
il kiosk toglie, col suo menu e le sue linguette; premuto di nuovo se ne va.

**Il rilascio dice se l'app è arrivata davvero nel negozio.** «L'apk
dell'ultima release non è arrivato nello store»: il registro scriveva
«pubblicato» e il lavoro diventava verde, ma quella riga voleva dire soltanto
che Google aveva accettato la consegna — non che il pacchetto fosse sulla
pista. Adesso, dopo la consegna, lo strumento riapre una modifica, **riguarda
la pista** e scrive cosa ci vede: «il negozio conferma: la 1050915 è sulla
pista «alpha», stato completed». Se non la vede lo dice a chiare lettere, con
le versioni che invece ci sono, e non finge un rosso: la consegna è andata,
il pacchetto può essere ancora in lavorazione o in revisione. E `--piste`
adesso dice anche lo stato di ogni versione, non solo il numero.

**La tessera delle finestre conta anche le tapparelle, e nel nome lo dice**
(#64). «Ho provato ad associare oltre che alla tapparella anche il sensore
finestra della stessa, ma facendo così il widget mostra solo 1, ma ci sono 4
tapparelle aperte e 1 sensore della finestra aperto: dovrebbe mostrare
entrambi.» Era il prezzo della #442 pagato dall'altra parte: per non chiamare
«finestre aperte» quattro tapparelle tirate su, il numero grande aveva smesso
di contarle — con quattro su e una finestra aperta diceva «1», con quattro su
e nessuna aperta diceva «0» sopra la scritta «4 alzate». Adesso dove ci sono
tutte e due le cose la tessera si chiama **Finestre e tapparelle**, il numero
conta quello che la tessera elenca, e la didascalia le tiene separate. La
pastiglia sotto il meteo non cambia: lì una tapparella alzata non è una
finestra aperta, e continua a dire le ante aperte e basta.

## 1.5.9.15

**Nell'app, cambiando casa, la testata della plancia diceva ancora la casa di
prima.** «Passando da una casa all'altra il titolo resta quello di prima — i
dati sono quelli giusti — finché non si chiude e si riapre l'app.» Erano due
cose, e si correggono tutte e due. La plancia scriveva il titolo solo
all'avvio, da quello che il deposito del browser aveva in quel momento, e la
configurazione che arrivava dopo dal ponte rifaceva tutto tranne la testata:
adesso rifà anche lei, e vale dovunque la plancia si apra. E nell'app tutte le
case tenevano le loro cose nello stesso deposito — la plancia lo chiama col
nome che le dà il ponte, uguale per ogni casa — quindi la casa al mare partiva
dalla configurazione di casa: adesso ogni casa ha il suo, e la prima volta si
riempie da quello di prima, così il tema scelto non si perde, nemmeno per chi
di casa ne ha una sola.

**Un'azione rapida su un menu a tendina fa scegliere la voce.** «Sotto il
comando scena, se inserisco un'entità che è un select mi devi far scegliere
cosa far partire.» Un `select` non si accende e non è una scena: ha delle
voci, e il tasto chiedeva a Home Assistant un servizio che non c'è, in
silenzio. Adesso il tasto apre un **popup con le voci del menu**, con quella
di adesso segnata, e mette quella che si tocca. Chi vuole un tasto secco la
fissa nell'editor, nella riga «Quale voce» che compare appena l'entità è un
menu a tendina: allora il tasto la mette senza chiedere, e si accende quando
la casa è su quella voce.

**Le stampanti sotto il meteo.** «Sulla sezione stampanti riesce a mettere i 4
colori? che poi va sulla home sotto il meteo quando c'è un sottosoglia?» I
quattro colori c'erano già — nero, ciano, magenta, giallo, ognuno con la sua
barra e il suo colore vero, ambra sotto il 25% e rosso sotto il 10% — e la
tessera Stampanti in Home contava già quante hanno qualcosa da dire. Sotto il
meteo no: adesso la fascia ha una pastiglia per le stampanti, che compare solo
quando una è ferma o una cartuccia è agli sgoccioli, rossa se è ferma, e
toccandola si apre la tessera. Si spegne dalla configurazione della barra come
le altre voci.

**Il cruscotto non chiede più la chiave, da nessuna parte.** Tre strade, e
prima ne andava una sola. **Dall'app web** la consegna della 1.5.9.14 non
arrivava: chi ospita la pagina doveva trovare il riquadro e indovinare il
momento. Adesso è la pagina a **chiedere** la chiave a chi la contiene o a chi
l'ha aperta, finché qualcuno risponde; l'app e la tessera in Home Assistant
rispondono, a quella pagina e a nessun'altra. **Dal telefono**, «Apri nel
browser» apre il browser del sistema, a cui l'app non può parlare — e la
chiave nell'indirizzo non ci va, che finisce nella cronologia: l'app chiede al
quadro un **biglietto**, che vale un minuto e una volta sola, e lo mette lei
nell'indirizzo; il cruscotto lo cambia con la chiave, la tiene come se fosse
stata battuta, e toglie il biglietto dall'indirizzo. **Dalla console
dell'add-on in Home Assistant**, il tasto «Apri il cruscotto» apre una scheda
già aperta: il biglietto lo chiede la casa al quadro con la chiave delle sue
opzioni, che da lì continua a non uscire. Chi apre l'indirizzo a mano continua
a battere la chiave una volta, come prima.

**Il cruscotto dice di chi è il problema quando l'editor non si apre.** «Questo
quadro non ha la plancia da servire» si leggeva come se mancasse la plancia
della casa. Manca la copia dei file che il quadro serve nell'editor, e la porta
`accendi.sh`, da rilanciare una volta sulla macchina del quadro (vedi
1.5.9.14): adesso lo scrive, e dice a chi chiederlo.

## 1.5.9.14

**Dal cruscotto si apre l'editor vero della plancia.** Il tasto
«Configurazione» nel capitolo «Le plance» non apre più una casella di JSON:
apre la Configurazione di DashboardModern — quella con «Configura Entità»,
le stanze, le sezioni, i widget — servita dal quadro in un riquadro sopra il
cruscotto. La pagina crede di parlare con Home Assistant e parla col quadro,
che di casa ha soltanto quello che la casa gli ha mandato: com'è fatta la
plancia e **l'inventario** — quali entità ci sono, come si chiamano, cosa
sanno fare, in quale stanza stanno, a quale dispositivo appartengono. Mai
cosa stanno facendo: gli stati escono come «non lo so», le immagini e i
flussi delle telecamere non escono, un comando a un dispositivo il quadro
lo rifiuta per nome. Ogni modifica salvata diventa un lavoro che la casa
ritira appena passa, come prima. Prima di aprire, il cruscotto chiede alla
casa com'è fatta la plancia **adesso**, e la casa in linea risponde in pochi
secondi. Serve il terzo interruttore, come prima; accendendolo, adesso escono
anche i nomi dei dispositivi e le capacità delle entità, e la scheda lo dice.
Sulla macchina del quadro va rilanciato `accendi.sh` una volta, perché la
plancia da servire arrivi accanto al quadro.

**Una plancia aggiunta dal cruscotto nasce da sola, in pochi secondi.** Non
c'è niente da confermare in casa, e non c'era nemmeno prima; ma «in attesa che
la casa la crei» si leggeva come un permesso da dare, e arrivava col rapporto
del minuto dopo. Adesso il quadro sveglia la casa in linea appena si preme
«Aggiungi» — o «Salva» sui nomi — e la casa passa subito: la plancia compare
nel menu laterale mentre si guarda. Se un impianto ha spento «il marchio di
chi installa», il cruscotto lo scrive invece di lasciar aspettare una plancia
che non nasce.

**Il logo dell'installatore si mette anche dalla scheda di un impianto.** Nel
capitolo «Le plance» c'è lo stesso riquadro della pagina Abbinamento: chi
l'ha messo all'abbinamento lo ritrova, chi non l'ha messo lo mette da lì. È
lo stesso logo per tutti i suoi impianti, e lo dice.

**Nell'app web il cruscotto non chiede più il codice.** Il codice sta nella
scheda dell'add-on, e l'app lo consegnava al riquadro solo sul telefono: nel
browser si contava sul deposito della pagina, che dentro il riquadro di un
altro sito è a parte e a volte non dura nemmeno la sessione. Adesso lo
consegna anche lì, e anche alla scheda che apre il tasto «Apri nel browser».

## 1.5.9.13

**Le icone degli aggiornamenti arrivano tutte nel cruscotto.** Nella 1.5.9.11
era stata sistemata l'icona che sta in casa; quella dei marchi di Home
Assistant — Home Assistant stesso, il sistema operativo, Frigate — il rapporto
se la scaricava per conto suo, con uno scaricatore diverso da quello dell'app,
e in una casa vera non portava niente, senza dirlo: nell'app i loghi c'erano,
nel cruscotto restava la lettera. Adesso la strada è una sola, quella
dell'app: se un'icona si vede nell'app, si vede nel cruscotto. E il tetto per
un'icona è passato da 24 a 64 KiB, che è quello che il cruscotto accetta: un
marchio colorato da 256 punti li passava, e non partiva. Quello che non
arriva, adesso, si legge nel registro dell'add-on.

**Nel cruscotto la fila «tutti» è quella di serie.** Sotto l'anello c'erano
solo offline, da verificare e in ordine, e a pagina aperta nessuna era accesa:
non si capiva che si premono. Adesso la prima fila è «tutti», accesa di serie,
e le altre tre filtrano.

**Dalla gestione si rinomina un installatore.** Il tasto «Rinomina» accanto a
«Limite»: il nome nuovo compare nel suo cruscotto e, al rapporto dopo, nelle
plance dei suoi impianti. Fino a ieri l'unica via era eliminarlo e rifarlo,
cioè riabbinare ogni impianto.

**Ogni plancia porta i nomi che sceglie l'installatore.** Nel cruscotto, nel
foglio di un impianto, c'è il capitolo «Le plance»: per ognuna due caselle. Il
**nome della plancia** va nel menu laterale di Home Assistant e in cima alla
home; il **nome all'avvio** compare col suo logo mentre la pagina si apre,
nell'app e dentro Home Assistant. Arrivano in casa col rapporto dopo. Fino a
ieri la prima plancia prendeva da sola il nome dell'installatore, e nel menu
laterale compariva «giovanni» al posto di «Casa»: quello non succede più, e in
quelle case il titolo torna «gdahome» finché lui non ne sceglie uno. Un titolo
scritto in casa, dall'app, resta finché l'installatore non sceglie qualcos'altro.
Per farlo, il rapporto porta anche **profilo e titolo di ogni plancia** — nomi
di cose in casa, non di chi ci abita — e lo si legge, come tutto il resto,
nella console dell'add-on. Un impianto con l'add-on precedente non manda
l'elenco, e il cruscotto lo dice invece di far finta. E dallo stesso capitolo
se ne **aggiunge una**: «Una plancia in più», col suo nome, e la casa la crea
al rapporto dopo, vuota come una aggiunta dall'app; da quel momento è come le
altre. Di plance se ne tengono otto, contando quelle in attesa, e da qui non
se ne toglie nessuna: si toglie da casa. Dalla gestione le scelte si leggono e
basta.

**Dalla Configurazione della plancia si riapre il menu dell'app.** Nell'app e
nel browser, aperta la Configurazione dal menu, non c'era più un tasto per
tornare indietro: la testata della plancia lì non c'è, e la barra in fondo è
nascosta apposta. Adesso nel riquadro in cima, a sinistra del logo, c'è lo
stesso ☰ della home, e apre lo stesso menu.

**La plancia si configura dal cruscotto, con un terzo permesso della casa.**
Accanto ai nomi di ogni plancia, nel capitolo «Le plance», c'è il tasto
**Configurazione**: apre com'è fatta quella plancia — sezioni, stanze, entità,
disposizione, la configurazione intera — e la si riscrive; l'impianto ritira la
modifica al rapporto dopo, e com'è andata si legge nel foglio dell'impianto e
nella console dell'add-on. Il tasto c'è **solo** dove chi abita la casa ha
acceso un terzo interruttore nelle opzioni dell'add-on, «Lascia che chi ti ha
fatto l'impianto configuri la plancia da lontano»: è a parte dalla manutenzione,
perché lasciar installare un aggiornamento e lasciar rimettere mano alla
propria plancia sono due cose diverse. Quello che passa è la configurazione; le
telecamere no: gli indirizzi dei flussi non partono da casa, e una
configurazione che ne contenesse uno la casa la rifiuta e lo scrive nel
rapporto. La configurazione viaggia su una strada sua, non dentro il rapporto —
è la casa che la manda quando il cruscotto dice di non averla, e che passa a
ritirare quella scritta — e il rapporto porta solo un numero in più per
plancia, la revisione, così il cruscotto sa se quello che tiene è ancora quello.

**Il controllo delle batterie dice di cosa parla.** Nel cruscotto si chiama
«Batterie dei dispositivi», e la tessera dello stato «Batteria più bassa dei
dispositivi»: sono le pile dei sensori e dei telecomandi, non una batteria di
casa. E le case, nell'elenco, sono card.

**Le icone della barra non spariscono più su iPhone.** «Le icone in basso
vanno e vengono»: il posto c'era, il nome sotto pure, e in mezzo niente, finché
non tornavano tutte insieme. Nella 1.5.9.1 si era portata ogni sfumatura dentro
il suo disegno, e non è bastato — chi l'aveva segnalato ha risposto «uguale a
prima». Un video guardato fotogramma per fotogramma ha detto perché: fra le
caselle vuote c'erano anche le emoji, che sfumature non ne hanno. Quello che le
caselle vuote avevano in comune era il filtro grafico che spegneva le voci a
riposo, e su iPhone un filtro dentro una barra che scorre si ridipinge quando
gli pare. Adesso le caselle della barra non hanno filtri, in nessun tema: le
voci a riposo restano appena spente per opacità, e a dire qual è quella aperta
ci pensano la pastiglia e il nome.

## 1.5.9.12

**Il cruscotto ha una faccia nuova.** Si chiama Aurora: un cielo che sfuma
dietro tutto, vetro smerigliato sopra, angoli larghi, un carattere solo e
nessuna scritta in maiuscolo. Non è un ritocco: è ridisegnato da capo per chi
lo guarda dal telefono in mezzo a un cantiere, e deve leggersi da lontano.

La schermata delle case ha tre pezzi. In cima **l'anello**: tutti gli impianti
in un cerchio, colorato in proporzione a come stanno, con sotto le tre file —
offline, da guardare, a posto — che si premono e filtrano. Poi **da guardare
adesso**: una carta per ogni casa che chiede qualcosa, che scorre di lato; si
apre e mostra **solo quello che non va**, e «Mostra tutto» apre il resto. In
fondo **tutti gli impianti**, una card per casa con la linea degli
ultimi quattordici giorni, che batte quando arriva un rapporto. Una casa si
apre in un foglio che sale dal basso, con la stessa scheda di prima a
capitoli; i metri della macchina sono diventati anellini. La barra delle
schermate sta in cima e ci resta mentre si scorre — e nell'app non lascia più
quella fascia vuota sopra la testata. Gli avvisi sono una riga in basso, non
più una finestra del browser.

Il carattere lo serve il cruscotto, da casa sua: il browser di chi apre queste
pagine — da fuori o dentro Home Assistant — non va a farsi vedere da nessun
altro, nemmeno per un carattere. Il cruscotto nell'app cambia da solo, senza
aggiornare l'app: quello che l'app fa vedere è la pagina del cruscotto.

**Chi gestisce il cruscotto vede gli impianti di ogni installatore.** Fino a ieri la
gestione contava e basta — quanti impianti ha ognuno, non quali. Adesso vede
di ognuno i nomi che gli ha dato, come stanno, quante entità ha ciascuna, e
apre la stessa scheda che apre lui: **in sola lettura**, e con la stessa
grafica. La regola è cambiata di poco e conta molto: le case arrivano alla
gestione dalla stessa strada da cui arrivano all'installatore, quindi lì non
arriva una riga che non arrivi anche a lui — i numeri che ogni casa manda da
sé, e i nomi solo dei dispositivi che non rispondono. E da lì non si tocca
niente: non si installa, non si riavvia, non si rinomina. Il limite si cambia
in una riga sotto l'installatore; congelare, rifare la chiave ed eliminare
chiedono conferma in due tempi, con scritto sotto cosa succede.

**Dal cruscotto si riavvia Home Assistant.** È il tasto per il giorno che
un'integrazione si impunta e chi ci abita non c'è: prima si telefonava a casa
per far premere «Riavvia». C'è solo se quella casa ha aperto la manutenzione,
solo se lì non sta già succedendo altro, e chiede conferma in due tempi. La
casa lo esegue al prossimo rapporto, come fa per un'installazione — e come per
un'installazione dice di no da sola se il cruscotto glielo chiedesse senza
permesso. È il secondo verbo che il cruscotto conosce, dopo «installa», e non ce
ne sono altri. Serve questa versione dell'add-on in casa: un ponte più vecchio
il riavvio non lo sa fare, e lo dice.

**E le parole sono quelle giuste.** Tutte le scritte del cruscotto e della
gestione sono state riviste con termini coerenti: gli impianti sono
«impianti», gli stati sono «offline», «da verificare» e «in ordine», i tasti
dicono cosa fanno — «Genera codice», «Salva», «Rimuovi», «Aggiorna» — e le
conferme in due tempi dicono «Premi ancora per confermare». La sezione degli
avvisi via web, che nessuno usava, non c'è più.

## 1.5.9.11

**Nel cruscotto tornano le icone degli aggiornamenti.** Quelle che si vedono
nell'app — Home Assistant Core, il sistema operativo, Frigate, il minipc — nel
cruscotto erano un quadratino vuoto, e per chi guarda dodici case di fila un
elenco senza facce è un elenco che si legge peggio.

Il motivo era una sola riga. Le icone non le scarica il browser di nessuno: le
va a prendere il ponte, a casa, e le manda insieme al rapporto. Solo che
quando l'indirizzo dell'icona era **di casa** — `/api/...`, cioè una cosa che
esiste dentro Home Assistant e da fuori no — il ponte rispondeva «quell'icona
non esiste», che è una risposta definitiva: non si richiede più. Ma quelle
icone esistono eccome, e il ponte le sa prendere da sempre: è la stessa strada
che usa l'app, che infatti le vede. Adesso la usa anche per il quadro.

Sistemare il ponte però non bastava: il quadro quel «non esiste» se l'era già
scritto, e non l'avrebbe richiesto mai più. Adesso **un no scade**. Richiederlo
costa una riga di rapporto e una domanda che la casa si fa in memoria — per un
firmware che un'icona non ce l'ha davvero il no torna uguale e non viaggia
niente — e in cambio una risposta sbagliata non resta lì per sempre. È la
risposta che nessuno rimette mai in discussione: per questo va rimessa in
discussione ogni tanto.

**Le note di una versione si leggono, invece di leggersi coi cancelletti.**
«Cosa cambia, per intero» apriva il CHANGELOG così come è scritto: `## 5.3.0`
col cancelletto davanti, gli elenchi con gli asterischi, il grassetto con le
stelline. Nell'app le stesse identiche parole si leggono disegnate. Una cosa
sola mostrata in due modi diversi sono due cose da imparare invece di una.

Adesso il quadro le disegna come le disegna l'app, con lo stesso lettore e le
stesse regole: titoli, elenchi, righe che separano, blocchi di codice, e dentro
la riga grassetto, corsivo, codice e link. Anche quella di cominciare dalla
versione nuova, e non dal principio della storia. E quella più importante:
**quello che non sa disegnare non lo butta, lo lascia scritto com'è** — una
tabella esce con le sue barre e si capisce lo stesso, un pezzo mangiato no.

Quelle parole le ha scritte chi ha fatto l'aggiornamento, non noi, e fra lì e
lo schermo non c'è nessun altro che le guardi: prima si scappano tutte, e i
tag li mette solo il quadro. Un `<script>` scritto dentro le note si legge
`<script>`. I link si possono premere — si aprono di fianco, e senza portarsi
dietro l'indirizzo del quadro di nessuno.

**E si dice «si aggiorna dal suo apparecchio».** C'è roba che da qui non si
installa: certi firmware vogliono il pulsante sull'oggetto. L'app lo dice
così; il cruscotto se l'era inventata un'altra frase, che non vuol dire niente
per nessuno. Adesso è la stessa, e c'è una prova che lo tiene fermo.

## 1.5.9.10

**Adesso il codice del cruscotto arriva davvero.** Nella 1.5.9.9 quasi mai:
il ponte lo dà solo a chi amministra la casa, e per sapere chi amministra
guarda l'elenco degli utenti — che tiene in memoria e chiede a Home Assistant
quando serve. Ma l'app quella domanda la fa **una volta sola, nell'istante in
cui il filo si alza**: cioè esattamente quando quella memoria è ancora vuota.
Il ponte rispondeva «non so chi sei», il codice non partiva, e siccome l'app
non lo richiedeva quella sessione restava senza. Riassociare il telefono non
serviva a niente.

Adesso «non si sa» non è più un no: il ponte va a vedere. Aspettare una volta
per collegamento non costa niente a nessuno, e chi risponde davvero no resta un
no. Se Home Assistant non risponde affatto, fra le due si sceglie quella che
non apre niente.

E l'app non si tiene più quel «niente codice» per tutta la sessione: finché c'è
una porta di cui sa l'indirizzo ma non il codice riprova, poche volte e poi
basta — chi non amministra quel codice non lo avrà mai, e continuare a
chiederlo sarebbe un giro che non finisce.

## 1.5.9.9

**Dall'app, Cruscotto e Gestione non richiedono più il codice.** Il codice sta
già nella scheda dell'add-on — è quello che fa esistere la voce — e dentro Home
Assistant la pagina non lo richiede da un pezzo: gliela passa la tessera.
Nell'app se lo faceva ribattere, perché l'app aveva solo l'indirizzo e non il
codice. Due volte lo stesso codice, e la seconda è quella che fa pensare che la
prima non abbia funzionato.

Adesso è il ponte a darlo, sulla stessa risposta con cui dice se quella casa ha
il cruscotto, e l'app lo consegna alla pagina **per la stessa strada della
tessera** di Home Assistant: un messaggio, non l'indirizzo — un `#chiave=…`
finirebbe nella cronologia e in ogni schermata mandata per chiedere aiuto.

**Lo riceve solo chi amministra quella casa.** In Home Assistant quella voce è
riservata a chi amministra, e darla sul filo a chiunque abbia abbinato un
telefono vorrebbe dire una porta più aperta dall'app che da casa: di là di quel
codice c'è l'elenco dei clienti di qualcuno. Chi non amministra — e chi ha
abbinato il telefono prima che il ponte sapesse di chi fosse — la voce continua
a vederla e il codice continua a battersela, come prima.

## 1.5.9.8

**Il quadro adesso dice quale versione sta girando.** Prima non lo diceva da
nessuna parte: `/salute` diceva soltanto di essere vivo, la soglia è un testo
fisso, e le pagine mostrano la versione *delle case*, non la sua. Per sapere se
una correzione era arrivata bisognava entrare nella macchina e leggere un
registro — cioè proprio la cosa che questo quadro esiste per non dover fare.

Il numero c'era già: lo scrive il giro degli aggiornamenti quando **scambia** il
codice, e lo scrive solo dopo che le prove di quella versione sono passate.
Mancava qualcuno che lo leggesse. Adesso `curl https://quadro.gdahome.org/salute`
risponde anche `"versione":"26bad09"`, sette cifre da confrontare a occhio con
l'ultimo rilascio.

## 1.5.9.7

**Nella pagina Luci si accende dalla levetta, non da tutto il riquadro.** Prima
la card era un tasto solo: il disegno, il nome, lo stato, i cartellini —
dovunque si toccasse, la luce cambiava. Su una pagina di venti luci vuol dire
accenderne una ogni volta che si scorre col dito, o che ci si avvicina per
leggere quale sia quale.

Adesso quello che accende è la levetta a destra, e basta: è già lei a dire se
la luce è accesa, ed è lì che uno la cerca. Il resto della card si legge e si
tocca senza conseguenze. Vale anche nella lista che si apre dalla tessera
Luci — erano due disegni della stessa card, e sistemarne uno solo voleva dire
il guasto che resta in metà dei posti.

Resta com'era l'unica eccezione: una luce che si guarda e basta la levetta non
ce l'ha proprio, e lì il corpo della card apre le informazioni. Mai accendere,
mai spegnere.

## 1.5.9.6

**Le icone degli aggiornamenti adesso arrivano davvero.** Nella 1.5.9.4 quel
lavoro era tutto scritto e non funzionava niente: la casa non metteva nella
riga il *segno* dell'aggiornamento — il pezzo da cui il quadro capisce quale
icona gli manca — e quindi il quadro non ne chiedeva mai una, e quindi non ne
arrivava mai una. Le prove guardavano i pezzi, uno per uno, e nessuna guardava
il giro intero: adesso c'è, e parte da quello che la casa manda davvero.

E con quella, altre cinque cose della stessa faccenda:

- **Un rapporto con le icone non viene più rifiutato.** La casa era disposta a
  mandarne fino a 192 KiB, che viaggiando diventano 256, e il quadro ne
  accettava 64 in tutto. Bastava un'icona un po' grossa: il rapporto tornava
  indietro, e siccome la casa si tiene l'elenco di quello che le è stato
  chiesto, al minuto dopo rimandava lo stesso pacco. Quella casa avrebbe smesso
  di dire come sta, per sempre, per un'icona.
- **Quando il quadro non chiede più niente, la casa smette di mandare.** Prima
  l'elenco di quello che era stato chiesto non si svuotava mai, e le stesse
  icone ripartivano ogni minuto anche dopo essere arrivate.
- **Se arriva una sola delle due metà, l'altra si richiede.** Note sì e icona
  no — succede, è uno scarico che va storto — e il segno risultava completo
  lo stesso: quell'icona non sarebbe arrivata mai più. Adesso la casa sa anche
  dire «di questa non ce n'è», che è un'altra cosa da «non è arrivata», e per
  un firmware la si smette di chiedere.
- **L'icona nella pagina si vede.** L'indirizzo era scritto in modo che il
  browser lo cercasse dentro `/console/`, dove non c'è: ogni icona salvata
  bene tornava un 404 e restava l'iniziale.
- **Il magazzino delle icone non gira più a vuoto.** Oltre le cinquecento se ne
  buttavano in ordine di impronta, che sembra caso ma è una regola: le stesse
  ogni volta. Arrivavano, si salvavano, si buttavano, si richiedevano. Adesso
  se ne va quello che nessuno nomina più.

**E una casa non può più avvelenare l'icona che vedono gli altri.** Il segno di
un aggiornamento si ricava da cose pubbliche — il nome e la versione — quindi
chiunque sa calcolare quello di un'applicazione diffusa; il magazzino è uno
solo per tutti e chi scrive per primo vince. Una casa sola, bucata o in
malafede, poteva mandare il segno di un aggiornamento che non ha con dentro
l'immagine e le note che voleva, e quella roba sarebbe comparsa nella pagina di
tutti gli installatori sotto il nome di un'applicazione vera. Adesso il segno
lo ricalcola il quadro dalla riga, e quello che arriva scritto serve solo a
vedere se combacia.

## 1.5.9.5

**Dall'app si aprono di nuovo il Cruscotto e la Gestione.** Non comparivano in
nessuna casa, nemmeno dove l'interruttore c'era: la domanda che il telefono fa
al ponte — «questa casa ha il cruscotto? ha la gestione?» — era scritta in
mezzo ai comandi della chat, e lì quella domanda non arriva mai. Il ponte la
riconosceva e poi rispondeva «non conosco»; l'app si sentiva dire di no e non
disegnava niente. Non erano il telefono né le opzioni: era una risposta scritta
in una stanza dove la domanda non entrava.

**E la voce «Gestione» nell'app adesso c'è.** Non era rotta: non era mai stata
fatta. Il ponte fabbrica da tempo la sua voce nella barra laterale di Home
Assistant, e nel menu dell'app quella voce non c'era proprio. Compare dove
compare quella — cioè solo dove c'è la chiave della gestione — e apre la stessa
pagina, non una copia rifatta.

**La barra in basso, su un tablet, non scrive più tutto accalcato.** Le regole
di quella barra per gli schermi che si toccano sono scritte per un telefono: la
linguetta si ferma a 72 punti e le voci si stringono a sinistra. Un tablet
appeso al muro le prendeva uguali, e si vedeva il risultato — le scritte una
addosso all'altra con mezza barra vuota a destra. Da 900 punti di larghezza in
su adesso le voci si dividono la riga che c'è, e la scritta torna leggibile.

## 1.5.9.4

**Nel cruscotto di chi installa, ogni aggiornamento ha la sua icona vera.**
Prima quella pagina mandava il browser di chi installa a prendersi l'icona su
`brands.home-assistant.io`, con una parola presa dal rapporto, e c'erano due
guai in uno: quel browser andava a farsi vedere da una macchina che non è la
sua, e quello che trovava era sbagliato — il logo di HACS al posto di quello
dell'applicazione (per un'integrazione installata da HACS quella parola **è**
`hacs`) e niente del tutto per un firmware, che una parola non ce l'ha.

Adesso l'icona giusta la manda la tua casa: gliela dà il suo Supervisor per gli
add-on e i marchi di Home Assistant per le integrazioni, che è esattamente
quello che l'add-on fa già per l'app sul telefono. Viaggia **una volta sola** —
è il quadro a dire quali icone non ha — e il tuo browser non ci va più.

**E il CHANGELOG si legge lì, senza uscire.** «Le note per intero» era un
collegamento che portava sul sito di chi ha scritto l'aggiornamento: leggere
cosa cambia prima di premere «Installa» voleva dire uscire dal cruscotto. Adesso
le note arrivano insieme all'icona e si aprono sotto la riga.

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
