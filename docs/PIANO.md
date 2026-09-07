# Il piano

Scritto dopo aver misurato cosa c'e' davvero in
[dashboardmodern-v2](https://github.com/danigio15/dashboardmodern-v2), non a
occhio: 182.000 righe di frontend, 7.000 di Python, ventitre sezioni che
funzionano, quindici lingue, versione 1.4.11 distribuita su HACS con utenti
veri.

## Le tre decisioni gia' prese

| | scelta | cosa cambia |
|---|---|---|
| **Accesso da fuori** | il ponte **chiama fuori**, verso un centralino | l'utente non apre niente e non installa niente |
| **Zigbee** | **ZHA e Zigbee2MQTT tutti e due** | il pairing va dietro un'interfaccia sola con due adattatori; la fase costa il doppio |
| **La plancia** | resta quella che c'e' | non si riscrive niente di cio' che gia' funziona |
| **Con cosa si scrive l'app** | **Flutter** | una sola app per tutti e due i telefoni, e l'interfaccia piu' fluida delle tre strade |

Sulla terza vale la pena essere espliciti, perche' e' la decisione che fa
risparmiare piu' tempo di tutte. Il progetto vecchio ha gia' provato a
riscrivere la plancia in nativo e ha smesso, mettendolo per iscritto: un
renderer parallelo deve rifare da zero un documento di 892 KB con 328 funzioni,
e o viene identico — e allora riscriverlo non e' servito a niente — o viene
diverso, e l'utente lo riconosce come peggiore. Quindi: **le sezioni che
esistono si mostrano in una WebView; le funzioni nuove si scrivono native.**
Non e' un compromesso, e' il punto: le tre funzioni che vogliamo non esistono
da nessuna parte, quindi scriverle native non costa un minuto in piu'.

## Cosa manca davvero

Verificato nel codice del progetto vecchio: la plancia **legge e comanda**
entita', non ne **crea**.

| | c'e' oggi |
|---|---|
| Aggiungere un dispositivo Zigbee | niente |
| Scrivere un'automazione | niente |
| Creare un aiutante | niente |
| Flussi di configurazione di Home Assistant | niente |
| Notifiche native | niente |

Quindi non c'e' niente da smontare: c'e' da costruire.

## Le fasi

### Fase 1 — il guscio *(chiusa, tranne la plancia)*

* ✅ L'add-on: abbinamento con codice a tempo, revoca, filo verso Home
  Assistant, console dentro Home Assistant, 60 prove.
* ✅ Il filo in Dart: stretta di mano, comandi numerati, sottoscrizioni,
  riconnessione con attesa che raddoppia, e le sottoscrizioni che risalgono da
  sole dopo una caduta.
* ✅ Il primo avvio: indirizzo e codice, segno nel portachiavi del sistema
  (Keychain su iPhone, Keystore su Android), e il ponte controllato *prima* di
  bruciare il codice.
* ✅ La casa viva: `get_states` piu' `state_changed`, con la rilettura completa
  dopo ogni riconnessione.
* ✅ **Piu' case.** Ognuna col suo segno, in un archivio nel portachiavi. Si
  passa dall'una all'altra buttando giu' il filo della prima e aprendo quello
  della seconda: due fili aperti insieme vorrebbero dire due case mescolate a
  schermo.
* ✅ **Dentro e fuori casa.** Tre strade per la stessa istanza — la rete di
  casa, il centralino, e un indirizzo pubblico per chi ce l'ha. La sonda le
  chiede tutte insieme e tiene la prima che risponde; il filo la richiama **a
  ogni tentativo**, cosi' uscire dal portone non richiede niente a nessuno.
  Dove si e' entrati si ricorda, e la volta dopo si prova per primo quello.
  In casa vince sempre la strada diretta: il centralino parte con quattro
  decimi di ritardo, se no ogni comando farebbe il giro del mondo per arrivare
  a tre metri.
* ✅ **Il centralino.** La casa chiama fuori e resta in attesa; i telefoni
  arrivano da li'. Due scritture dello stesso centralino — una in Node, una che
  gira gratis su Cloudflare — e la stessa prova dal vivo passa contro tutte e
  due.
* ✅ **Cifrato punta a punta.** Il centralino instrada e non puo' leggere.
  X25519, HKDF, AES-256-GCM, con vettori di prova che tengono allineate le due
  scritture — Node e Dart — byte per byte.
* ✅ **Otto lettere e basta.** Nell'app si batte il codice e nient'altro:
  nessun indirizzo, e mai nessuna credenziale di Home Assistant. Il resto —
  chi e' questo telefono, la chiave, quale centralino, dove sta la casa sulla
  rete locale — lo dice la casa nella risposta all'abbinamento.
* ✅ **La home.** Luci accese, aperture, temperatura, antifurto, cose che non
  rispondono. E in cima, sotto il nome della casa, da dove si sta passando —
  che e' la prima domanda di chi apre l'app fuori casa e vede qualcosa di
  strano: sto guardando dati veri o vecchi?

La plancia dentro l'app resta fuori dalla fase 1 **apposta**: e' l'ultimo
blocco che confluisce nell'app, e prima vengono le tre funzioni che in Home
Assistant stanno nascoste. Quando sara' il suo turno servira' un pezzo che al
momento non c'e' da nessuna parte — il ponte passa il *filo*, cioe' il
WebSocket, ma non le *pagine* — e una WebView autenticata e' un posto dove si
sbaglia facile.

### Fase 2 — gli aiutanti

Si spaccano in due gruppi, e solo il primo e' facile.

* **I sette classici** — `input_boolean`, `input_number`, `input_text`,
  `input_select`, `input_datetime`, `counter`, `timer`. Home Assistant ha un
  comando `*/create` per ognuno: si creano, si elencano, si cancellano. Questo
  e' il gruppo della fase 2.
* **Quelli che passano da un flusso di configurazione** — modello, soglia,
  derivata, contatore consumi, gruppo. Vogliono le API dei flussi, che sono
  un'altra cosa e un altro lavoro. Fase 5.

### Fase 3 — Zigbee, tutti e due

Un'interfaccia sola davanti, due adattatori dietro:

```
        ┌──────────── quello che vede l'app ────────────┐
        │  cerca · abbina · dai un nome · metti in una  │
        │  stanza · guarda com'e' andata · togli        │
        └───────────────────────────────────────────────┘
                    │                        │
              ┌─────┴─────┐            ┌─────┴─────┐
              │    ZHA    │            │    Z2M    │
              │ WebSocket │            │   MQTT    │
              └───────────┘            └───────────┘
```

Il pezzo delicato non e' parlare con i due sistemi: e' che **l'abbinamento non
e' un bottone, e' un processo con degli stati**. Si apre la rete, si aspetta che
il dispositivo si faccia vivo, poi c'e' l'intervista — che puo' durare minuti e
puo' fallire a meta'. L'app deve raccontare cosa sta succedendo, non girare una
rotella.

Il ponte gia' si prepara: se in casa c'e' un broker MQTT configurato, `run.sh`
lo passa all'add-on. Serve a Z2M quando sara' il suo turno.

### Fase 4 — il mago delle automazioni

Rifare l'editor di Home Assistant sul telefono sono mesi, e verrebbe peggio del
suo. Quindi non si rifa'.

Al posto suo, **un mago su una decina di schemi** che coprono quasi tutto
quello che la gente scrive davvero: a un orario, quando cambia uno stato,
quando qualcuno arriva o esce, all'alba o al tramonto, quando un numero passa
una soglia, quando si preme un pulsante. Piu' l'elenco: accendi, spegni, esegui
adesso, guarda l'ultima volta che e' partita.

Home Assistant le salva con una chiamata REST e un ricaricamento: la scrittura
e' la parte facile. Il lavoro e' tutto nell'interfaccia.

### Fase 5 — il resto

Notifiche native (servono FCM e APNs), impronta digitale e Face ID, riquadri
nella schermata iniziale, gli aiutanti da flusso di configurazione.

### Fase 6 — i negozi

Programma sviluppatori Apple (99 $ l'anno) e Google Play (25 $ una volta).
Attenzione a una cosa: Apple in revisione vuole che l'app abbia un valore suo,
e una WebView e basta rischia il rifiuto. **Le fasi 2, 3 e 4 sono anche la
risposta a quella revisione**, non solo funzioni in piu'.

## Perche' il ponte chiama fuori

E' la decisione che e' costata di piu' arrivarci, e vale la pena scrivere come.

Il ponte nasce come add-on su una porta sua. In casa funziona. Da fuori no, e
le strade per rimediare sembravano tre: l'accesso remoto di Home Assistant, una
VPN, un proxy inverso.

**La prima non esiste.** Quel tunnel arriva a Home Assistant e si ferma li': le
porte degli add-on non le fa passare, e non c'e' nessuna impostazione che
glielo faccia fare. E' anche la prima che viene in mente a chi ce l'ha, quindi
e' quella che fa perdere piu' tempo — l'indirizzo *sembra* giusto.

**Le altre due funzionano, e sono sbagliate lo stesso**, perche' chiedono
all'utente di installare e configurare qualcosa. E questo progetto ha promesso
il contrario: niente token da incollare, niente file da scaricare, niente
`configuration.yaml` da toccare. Dire «installa Tailscale su Home Assistant e
sul telefono» rompe quella promessa in pieno.

C'era una quarta strada, ed e' quella giusta: **girare il verso**. Non e' il
telefono che deve entrare in casa: e' la casa che chiama fuori. Il ponte apre
lui un filo verso un centralino e lo tiene aperto; i telefoni arrivano da
quella parte.

L'utente installa l'add-on e basta. Nessuna porta, nessun account, nessuna
configurazione, e funziona anche a chi non ha ne' Nabu Casa ne' un dominio.
Nell'app si batte **solo il codice**, perche' il codice sa gia' a quale casa
appartiene.

Il costo si sposta: dall'utente a chi mantiene il centralino. Ed e' giusto
cosi' — e' la stessa cosa che fa Nabu Casa.

E si e' scoperto che quel costo e' **zero**. Il centralino sta dentro il piano
gratuito di Cloudflare senza sforzo: una casa e' un Durable Object che dorme
quando non passa niente, e un telefono apre un filo e lo tiene invece di fare
richieste a raffica. Chi vuole il proprio ce l'ha lo stesso, in Node.

E il debito che veniva con questa strada e' pagato: **il centralino non puo'
leggere quello che instrada**. Non e' una promessa ma una prova — si registra
tutto quello che gli passa sotto il naso e ci si cerca dentro il segno, il
codice, i comandi, i nomi delle entita'. Non c'e' niente.

Sotto ci sono due segreti diversi apposta, e la ragione va scritta perche' non
e' ovvia. Il ponte il segno **non ce l'ha**: sul disco tiene solo l'impronta,
cosi' un file rubato non fa entrare nessuno. Quella proprieta' vale piu' della
comodita' di riusare il segno come chiave, quindi a ogni telefono si da' anche
una **chiave del filo**, che serve solo a cifrare. Chi rubasse il file avrebbe
la seconda e non la prima: potrebbe leggere del traffico registrato, ma non
entrerebbe in casa. E perche' anche quello resti chiuso, a ogni collegamento si
mescola dentro uno scambio effimero — le chiavi di quel momento spariscono con
lui, e chi rubasse il file domani non leggerebbe quello che e' passato ieri.

## Le cose che decidono tutto, e che non sono codice

1. **Il centralino lo mantiene chi distribuisce l'app**, non chi la usa — e
   non costa niente: `npx wrangler deploy`, piano gratuito, indirizzo
   compreso.
2. **Le quindici lingue** del progetto vecchio vanno riportate nell'app.
3. **Cosa puo' fare un telefono abbinato**: tutto quello che puo' fare il
   ponte. Non c'e' un filtro per tipo di comando, e non c'e' apposta — un
   filtro per esclusione lascia sempre fuori qualcosa e da' l'idea sbagliata
   che il telefono sia limitato. Quello che c'e' e' che un telefono entra solo
   se qualcuno gia' dentro Home Assistant ha fatto un codice negli ultimi
   cinque minuti, e si stacca con un bottone.

## Flutter, e cosa vuol dire in pratica

Una sola app per Android e iPhone, disegnata da Flutter invece che dal sistema:
vuol dire che quello che si vede e' identico sui due telefoni, e che le
animazioni sono le stesse. E' la strada che da' il risultato piu' fluido.

Il prezzo e' Dart, che e' un linguaggio nuovo rispetto a tutto il resto del
progetto. Si paga una volta, e per limitare quanto si paga il codice e' diviso
in due meta' con una regola netta:

* **`app/lib/ponte/` non sa che Flutter esiste.** E' Dart e basta: la stretta
  di mano col ponte, i comandi, le sottoscrizioni, la riconnessione. Si prova
  con `flutter test` contro un ponte finto, senza telefono, senza emulatore e
  senza schermo — che e' l'unico modo di avere prove che girano davvero a ogni
  commit.
* **`app/lib/schermate/` e' Flutter**, e sopra quella meta' non c'e' niente da
  provare che non sia guardare lo schermo.

La divisione non e' pulizia fine a se stessa: e' quello che permette alla CI di
dire qualcosa di vero sull'app senza avere un telefono attaccato.

## Come si mettono insieme i pezzi

```
    app/lib/schermate/          Flutter: primo avvio, plancia, impostazioni
            │
    app/lib/ponte/              Dart puro: il filo, i comandi — provato
            │
        ══════════  WSS  ══════════
            │
    ponte/  (add-on)             gia' fatto, 60 prove
            │
    Home Assistant
```

La cosa importante e' che il pezzo di mezzo — `app/lib/ponte/` — parla il
**protocollo di Home Assistant**, non un protocollo nostro: l'add-on si
presenta come Home Assistant apposta. Vuol dire che lo stesso codice del filo
funziona anche puntato dritto a un Home Assistant, senza ponte, e che nessuno
dei due lati e' incastrato con l'altro.
