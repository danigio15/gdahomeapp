# Privacy di gdahome

Ultimo aggiornamento: 6 ottobre 2026.

gdahome è l'app che apre la plancia di Home Assistant sul telefono. Questa
pagina dice, in modo chiaro e senza giri di parole, **quali dati ci sono di
mezzo, dove stanno e chi li può leggere**. È la stessa cosa che il Play Store
e l'App Store chiedono di dichiarare, e vale la pena leggerla anche senza
avere niente da dichiarare a nessuno.

## La regola che viene prima di tutte

**I dati della tua casa restano in casa tua.** gdahome non ha nessun server
che li raccolga, non ha un account da fare, e non c'è nessun posto dove
finiscano per essere guardati. Le luci, le temperature, le telecamere, le
persone: quelle stanno nel tuo Home Assistant, e l'app le chiede a lui.

Chi sviluppa gdahome non vede la tua casa. Non è una promessa di buona
volontà: non c'è proprio il posto dove guardarla.

## Cosa c'è sul telefono

- **La credenziale della casa**, una per casa abbinata. Serve a entrare, sta
  nel portachiavi del telefono e non esce da lì. Disinstallando l'app se ne va
  con lei; togliendo l'associazione dalla pagina dell'add-on smette di valere.
- **L'indirizzo della casa** e il nome che le hai dato.
- **Quello che la plancia si tiene per sé** — il tema, la tavolozza, la barra
  — nel deposito del browser interno all'app.

Niente di tutto questo viene mandato da nessuna parte.

## Cosa passa dal centralino, e solo quando serve

Da fuori casa l'app non può bussare direttamente a Home Assistant, quindi
passa da un **centralino**: un punto d'incontro dove l'add-on è già in attesa.
Due cose vanno dette con precisione:

- quello che passa è **cifrato fra il telefono e l'add-on**: il centralino
  instrada e non può leggere niente di quello che gira;
- il centralino tiene in piedi il collegamento e non conserva il contenuto.

Il centralino di gdahome è `tramite.gdahome.org`. Chi vuole, se ne accende uno
suo — è nel codice, ed è gratis.

## Le segnalazioni e la chat di assistenza

Sono l'unica cosa che **tu** puoi decidere di mandare fuori, e succede solo
quando la scrivi:

- il testo della segnalazione, e le foto o i video che ci alleghi;
- qualche riga su come sta l'app in quel momento (versione, se il filo con la
  casa regge), che serve a capire il problema;
- quello che scrivi nella chat di assistenza.

**Le segnalazioni sono pubbliche.** Diventano pagine su GitHub, nella
repository di gdahome: chiunque può leggerle, comprese le foto, i video e le
righe su come sta l'app. Per questo non scriverci password, indirizzi o altri
dati personali, e allega solo foto e video che non ti dispiace far vedere.

**La chat di assistenza non è pubblica.** Non passa da GitHub: la legge solo
chi mantiene gdahome, per risponderti.

Niente di tutto questo viene usato per profilare o per fare pubblicità. Se non
scrivi, non parte niente.

## Il modulo dei contatti sul sito

Su gdahome.org c'è un modulo per scrivere a chi mantiene gdahome. Quello che ci
scrivi — il nome, l'indirizzo email e il messaggio — parte come una mail verso
assistenza@gdahome.org, e serve a una cosa sola: risponderti. Sulla macchina
che lo spedisce non resta niente del messaggio; resta, per un'ora e solo in
memoria, il conto di quante volte un indirizzo di rete ha usato il modulo, che
serve a non farlo usare a raffica. Se non scrivi, non parte niente.

## Il navigatore e l'auto

Dentro l'app c'è un navigatore (gdanav), e si accende solo se lo apri — o se
colleghi il telefono all'auto con Android Auto o CarPlay. Per guidarti usa la
**posizione del telefono**, anche a schermo spento mentre sei in viaggio, e la
manda **solo** ai servizi che servono a guidare, senza nome né account:

- i percorsi e il traffico: TomTom (`api.tomtom.com`);
- la ricerca degli indirizzi: Photon (`photon.komoot.io`);
- la mappa: OpenFreeMap (`tiles.openfreemap.org`);
- le colonnine: Open Charge Map (`api.openchargemap.io`) e OpenStreetMap
  (`overpass-api.de`). Lo stato delle colonnine in tempo reale arriva dalla
  Piattaforma Unica Nazionale (`api.pun.piattaformaunicanazionale.it`), che
  riceve solo quali colonnine stai guardando; per chiederlo l'app usa un
  accesso anonimo ad Amazon Web Services (Cognito), lo stesso del sito
  pubblico della PUN;
- i distributori e i loro prezzi: il Ministero (`carburanti.mise.gov.it`) e
  OpenStreetMap (`overpass-api.de`);
- le segnalazioni della strada (incidenti, lavori, autovelox) e l'abbinamento
  con Home Assistant passano da `gdanav.gdahome.org`, cifrati.

Il **Bluetooth** serve solo se colleghi un dongle OBD, per leggere la batteria
dell'auto: la lettura resta sul telefono. I comandi rapidi in auto, e la
fotografia della casa che l'auto mostra, stanno in un file dentro l'app e
non escono dal telefono: il comando lo esegue l'app, sul filo cifrato di
sempre.

## Il radar della pioggia

Se nella plancia metti la sezione Radar meteo, la plancia chiede le immagini
della pioggia a RainViewer (`api.rainviewer.com`) e la mappa sotto a Esri
(`server.arcgisonline.com`), o al servizio che scegli nella Configurazione.
Ricevono la zona della mappa che stai guardando, non chi sei. Senza quella
sezione non parte niente.

## La fotocamera

Serve a una cosa sola: **inquadrare il QR code** che abbina il
telefono alla casa. L'immagine non viene salvata né mandata da nessuna parte —
si legge il codice e basta. Se preferisci, il codice si digita a mano e la
fotocamera non serve.

## Premium e licenze

Per sapere se una casa è Premium, l'add-on chiede a `quadro.gdahome.org`,
all'accensione e ogni sei ore, **solo** l'identificativo della casa verso il
centralino (`casa_…`) e il suo segreto, che serve a dimostrare che è lei.
Nient'altro: niente nomi, dispositivi, stati o posizione. La risposta è un
gettone firmato, che l'add-on, il centralino e l'app controllano da soli.

Chi compra Premium dall'app: la ricevuta del negozio (il codice d'acquisto di
Google Play o l'identificativo della transazione di Apple) passa cifrata dal
telefono all'add-on e da lì al quadro, che la controlla con Google o Apple.
Se si compra fuori casa con la casa in Base, arriva all'add-on passando dal
centralino, in HTTPS e firmata dal telefono: il centralino la gira senza
conservarla. Il quadro conserva, per ogni licenza: la casa, da dove arriva (negozio, regalo,
installatore), quando scade, se è nella prova gratuita, e l'identificativo
dell'acquisto (il codice d'acquisto di Google Play o l'identificativo della
transazione originale di Apple), che gli serve per chiedere a Google o ad
Apple se l'abbonamento si è rinnovato. Il pagamento lo gestiscono Google e
Apple: a gdahome non arrivano né il nome né i dati della carta.

gdanav da sola usa per i codici regalo un identificativo del telefono (`tel_…`)
fatto a caso sul telefono, che non dice chi sei.

## Quello che non c'è

Nessuna pubblicità. Nessun tracciamento. Nessun account. Nessuna raccolta di
dati per statistiche o profilazione. Nessuna vendita o condivisione di dati con
terzi. Nessun servizio di analisi dentro l'app.

## I bambini

L'app non è rivolta ai bambini e non raccoglie niente da nessuno, quindi
nemmeno da loro.

## Cancellare tutto

Disinstallando l'app, quello che stava sul telefono se ne va con lei. Dalla
pagina dell'add-on, «Telefoni abbinati → Togli associazione», la credenziale di
quel telefono smette di valere all'istante. Le segnalazioni già mandate, con
le loro foto e i video, si cancellano chiedendolo dalla chat di assistenza.

## Chi risponde

gdahome è mantenuta da danigio15 — <https://github.com/danigio15/gdahomeapp>.
Per qualunque cosa su questa pagina, si apre una segnalazione dall'app o una
issue sulla repository. Per una cosa che non vuoi rendere pubblica, scrivi
nella chat di assistenza o ad assistenza@gdahome.org.
