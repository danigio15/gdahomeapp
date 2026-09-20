# Privacy di gdahome

Ultimo aggiornamento: 20 settembre 2026.

gdahome è l'app che apre la plancia di Home Assistant sul telefono. Questa
pagina dice, in modo chiaro e senza giri di parole, **quali dati ci sono di
mezzo, dove stanno e chi li può leggere**. È la stessa cosa che il Play Store
chiede di dichiarare, e vale la pena leggerla anche senza avere niente da
dichiarare a nessuno.

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

Vanno a chi mantiene gdahome, per rispondere. Non vanno a nessun altro, non
vengono usate per profilare niente e non finiscono in nessuna pubblicità. Se
non scrivi una segnalazione, non parte niente.

## Il modulo dei contatti sul sito

Su gdahome.org c'è un modulo per scrivere a chi mantiene gdahome. Quello che ci
scrivi — il nome, l'indirizzo email e il messaggio — parte come una mail verso
assistenza@gdahome.org, e serve a una cosa sola: risponderti. Sulla macchina
che lo spedisce non resta niente del messaggio; resta, per un'ora e solo in
memoria, il conto di quante volte un indirizzo di rete ha usato il modulo, che
serve a non farlo usare a raffica. Se non scrivi, non parte niente.

## La fotocamera

Serve a una cosa sola: **inquadrare il QR code** che abbina il
telefono alla casa. L'immagine non viene salvata né mandata da nessuna parte —
si legge il codice e basta. Se preferisci, il codice si digita a mano e la
fotocamera non serve.

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
quel telefono smette di valere all'istante. Le segnalazioni già mandate si
cancellano chiedendolo dalla chat di assistenza.

## Chi risponde

gdahome è mantenuta da danigio15 — <https://github.com/danigio15/gdahomeapp>.
Per qualunque cosa su questa pagina, si apre una segnalazione dall'app o una
issue sulla repository.
