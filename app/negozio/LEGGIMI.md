# «Novità» del negozio

Un file per lingua, e **il nome del file è la lingua**: `it-IT.txt`,
`en-US.txt`. Li legge `strumenti/porta-nel-negozio.mjs` e li porta su come
«Novità» della versione.

Stanno qui e non in una casella del Play Console per un motivo solo: quello che
il negozio racconta di una versione, così, si rilegge. Scritto a mano nella
casella non lascia traccia da nessuna parte — e la volta dopo nessuno sa cosa
c'era scritto l'altra volta.

**Il Play Console prende 500 caratteri per lingua.** Il conto lo fa lo
strumento prima di caricare qualunque cosa, e una prova lo tiene fermo
(`ponte/test/il-negozio.test.js`): scoprirlo dopo aver caricato settanta
megabyte vorrebbe dire rifare tutto.

Si scrivono per chi legge la scheda dell'app sul telefono, non per chi legge i
commit: cosa può fare adesso che prima non poteva. Quello che è cambiato dentro
— l'add-on, il ponte, le prove — nel negozio non c'entra niente: quello sta in
`ponte/CHANGELOG.md`, che è la finestra dell'aggiornamento in Home Assistant.

Una lingua nuova è un file nuovo, e basta: va su al giro dopo. Una lingua che
nel Play Console non è dichiarata, però, fa rifiutare tutto — prima si aggiunge
là, poi qui.

## Il credenziale, e perché non sta qui

Chi carica sul Play Console non è una persona: è un **account di servizio** di
Google, e la sua chiave è un file JSON. Quel file sta in un posto solo — i
segreti di questa repository, sotto il nome `NEGOZIO_GOOGLE` — e non esiste da
nessun'altra parte: non nel codice, non in un messaggio, non in una nota. Chi
ce l'ha può pubblicare un'app a nome tuo su tutti i telefoni che l'hanno
installata, e per questo non ha nessun motivo di passare da nessun altro.

Si fa una volta sola, e sono due mezze cose in due posti diversi — è il punto
in cui ci si ferma quasi sempre, perché la prima sembra finita:

1. **Nella Google Cloud Console** (`console.cloud.google.com`, un altro sito):
   si accende la **Google Play Android Developer API**, poi IAM e amministrazione
   → Account di servizio → Crea. Nessun ruolo di Google Cloud da dargli: i
   permessi stanno dall'altra parte. Poi Chiavi → Aggiungi chiave → JSON, e il
   file si scarica. Adesso l'account esiste, ma il negozio non lo conosce ancora.
2. **Nel Play Console**, Utenti e autorizzazioni → Invita nuovi utenti: si
   incolla quell'indirizzo — `qualcosa@…iam.gserviceaccount.com` — e gli si dà
   il permesso di pubblicare su questa app. Senza questo passaggio Google
   risponde `403 the caller does not have permission`, che è esattamente quello
   che risponderebbe se la chiave fosse sbagliata: da quella frase non si
   capisce quale delle due metà manca.

**La pagina «Accesso API» non c'è più.** Per anni la strada passava di là —
Impostazioni → Accesso API — e mezza internet la racconta ancora così, guide di
Google comprese. Google l'ha tolta: adesso l'invito si fa da Utenti e
autorizzazioni come per una persona. Chi la cerca nelle Impostazioni non la
trova e pensa di avere sbagliato qualcosa; non ha sbagliato niente.

Poi il JSON va in Settings → Secrets and variables → Actions → New repository
secret, con nome `NEGOZIO_GOOGLE`. In chiaro o in base64, li prende tutti e
due.

## Si prova prima, e ogni volta

Il giro «L'app da provare» ha due caselle apposta:

- **`elenca_le_piste`** non costruisce niente: chiede al negozio come si
  chiamano davvero le sue piste, e in mezzo minuto le scrive nel riepilogo. Le
  quattro di serie si chiamano `internal`, `alpha`, `beta`, `production`, ma
  una prova chiusa aperta a mano si chiama `custom-4697217…`, e indovinarlo non
  si può. Il negozio elenca le piste che hanno già qualcosa sopra: una prova
  appena aperta e ancora vuota qui non si vede.
- **`negozio`** prende anche più di una pista, separate da una virgola:
  `internal,alpha,beta`. Il pacchetto **si carica una volta sola** e va su
  tutte. Non è una comodità: il `versionCode` è unico per tutta l'app e il
  negozio un numero già visto lo rifiuta, quindi «la stessa versione anche su
  beta» non si fa ricaricando — e chi ci prova si trova a bruciare un numero
  di versione per spostare una cosa che aveva già.
- **`davvero_in_produzione`** è la seconda metà della conferma di
  `production`: quella pista pubblica a tutti quelli che hanno l'app, non ai
  collaudatori, e non si torna indietro premendo un tasto. Il nome scritto
  nella casella non basta — sono due gesti diversi apposta. `production` viene
  fatta **per ultima e in una modifica sua**: è l'unica che il negozio può
  negare (un account personale nuovo non ce l'ha finché non ha finito la prova
  chiusa coi suoi collaudatori), e messa in fondo un suo rifiuto lascia in
  piedi quello che era già andato su alpha.
- **`prova_del_negozio`** fa tutto il giro vero — costruisce, carica il
  pacchetto, prepara la pista, chiede a Google se va bene — e poi **butta la
  modifica** invece di consegnarla. Nessuno si ritrova una versione nuova sul
  telefono, e si sa lo stesso se sarebbe andata.

**E non è solo per la prima volta.** Il credenziale, una volta messo,
funziona; quello che cambia da una versione all'altra è **il pacchetto**, e il
negozio guarda anche quello. La 1.6.4.1 si costruiva bene ed era firmata con la
chiave vera: Google l'ha rimandata indietro lo stesso.

```
The app cannot declare 'android.hardware.type.automotive' device feature
and 'com.google.android.gms.car.application' metadata at the same time.
```

Una riga nel manifesto. Ma l'etichetta era già messa, e un'etichetta non si
sposta: per correggerla è servita una versione nuova e tutto il giro da rifare
— add-on, centralino, etichetta, tramite — più due approvazioni a mano
dell'ambiente `negozio`.

Quindi l'ordine è questo, e costa dieci minuti di macchina:

1. **«L'app da provare» su `main`**, con la pista scritta nella casella
   `negozio` e `prova_del_negozio` spuntato. Se Google dice di no, non è
   costato niente: nessuna etichetta messa, nessuna versione bruciata.
2. Solo quando dice di sì: **«L'etichetta»**, e poi «L'app da provare» su
   quell'etichetta, con la pista e la casella della prova **vuota**. Quella
   volta va su per davvero, e con lei nasce la release.
