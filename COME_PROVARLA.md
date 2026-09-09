# Provare l'app davvero

Tre pezzi, in quest'ordine:

1. **il ponte**, l'add-on dentro Home Assistant — senza, l'app non ha niente a
   cui bussare;
2. **il centralino**, che serve solo per entrare **da fuori casa** — è gratis, e
   si mette in piedi in cinque minuti;
3. **l'app** sul telefono.

Se vuoi solo provarla sul divano, il 2 puoi saltarlo.

---

## 1. Il ponte

Due strade, e **quale delle due dipende da una cosa sola: se la repository è
privata**.

Home Assistant, quando gli si dà l'indirizzo di un archivio di add-on, va a
prenderlo **senza presentarsi a nessuno**. Su una repository privata quella
richiesta torna indietro come «non esiste», e nel negozio non compare niente.
Non è un errore da aggiustare: è che il Supervisor non ha nessuna chiave da
mostrare, e non c'è modo di dargliene una senza scriverla dentro la
configurazione di Home Assistant.

Quindi: **se vuoi tenere la repository privata, si installa a mano.** Non è più
difficile, è solo un'altra strada.

### A. A mano, con la repository che resta privata *(consigliata)*

1. **Scarica il codice.** Sulla pagina della repository: **Code → Download
   ZIP**. Funziona anche se è privata, perché tu sei dentro.
2. **Apri la cartella `addons` di Home Assistant.** Ci si arriva con uno
   qualunque di questi, quello che hai già:
   - l'add-on **Samba share**, che la fa comparire come cartella di rete;
   - l'add-on **Advanced SSH & Web Terminal**;
   - l'add-on **Studio Code Server** o **File editor**.
3. **Copiaci dentro la cartella `ponte`** presa dallo ZIP, così com'è. Alla
   fine deve esserci `addons/ponte/config.yaml`.
4. In Home Assistant: **Impostazioni → Add-on → Negozio degli add-on**, menu in
   alto a destra → **Ricarica**. Compare una sezione **Local add-ons** con
   dentro **Il ponte di DashboardModern**.
5. Installalo. **La prima volta ci mette qualche minuto**: non lo scarica già
   pronto, se lo costruisce sul posto — su un Raspberry anche cinque o dieci
   minuti. Le volte dopo è immediato.
6. Avvialo.

Per aggiornarlo: riscarichi lo ZIP, risostituisci la cartella, e nel negozio
premi **Ricarica**; poi nella pagina dell'add-on premi **Aggiorna** (o, dai
tre puntini, **Ricostruisci**).

#### Dal terminale, in un colpo solo

Se hai l'add-on **Terminal & SSH** (o **Advanced SSH & Web Terminal**), lo
stesso giro lo fa questo, incollato nel suo terminale. Chiede un token di
GitHub perché la repository è privata: un token a grana fine su
`gdahomeapp` soltanto, con **Contents: Read-only** e nient'altro. Non lo
scrive da nessuna parte: si incolla e sparisce.

```sh
printf 'Token di GitHub (non si vede mentre lo incolli), poi Invio: '; stty -echo; read -r G; stty echo; echo
G=$(printf '%s' "$G" | tr -d '[:space:]"'"'"''); case "$G" in github_pat_*|ghp_*) ;; *) G="github_pat_$G";; esac
rm -rf /tmp/gdahomeapp && mkdir -p /tmp/gdahomeapp \
&& curl -fsSL -H "Authorization: Bearer $G" https://api.github.com/repos/danigio15/gdahomeapp/tarball/main | tar -xzf - -C /tmp/gdahomeapp \
&& rm -rf /addons/ponte && cp -r /tmp/gdahomeapp/*/ponte /addons/ponte && rm -rf /tmp/gdahomeapp \
&& grep '^version' /addons/ponte/config.yaml \
&& ha addons reload && (ha addons update local_ponte || ha addons rebuild local_ponte) && ha addons restart local_ponte \
&& ha addons info local_ponte | grep -E '^(version|state):' \
&& echo "Fatto: il ponte e' aggiornato." || echo "Qualcosa non e' andato: leggi la riga sopra."
unset G
```

Scarica il codice, sostituisce `addons/ponte`, ricarica il negozio,
aggiorna (o ricostruisce) l'add-on e lo riavvia: alla fine stampa versione e
stato. La cartella vecchia la toglie **solo dopo** che il codice nuovo è
arrivato, quindi se il token è sbagliato non si rompe niente. Ci mette
qualche minuto, che è la ricostruzione.

### B. Con l'indirizzo, se la rendi pubblica

1. **Impostazioni → Add-on → Negozio degli add-on**, menu in alto a destra →
   **Archivi**, e incolla `https://github.com/danigio15/gdahomeapp`.
2. Nell'elenco compare **Il ponte di DashboardModern**: installalo e avvialo.

Più comodo, e si aggiorna da solo. Ma vuol dire che il codice lo legge
chiunque.

> **L'app invece non c'entra niente con tutto questo.** L'APK si scarica da
> Actions, e lì sei autenticato: la repository può restare privata quanto vuoi.

---

## 2. Il centralino — solo per entrare da fuori casa

Il ponte, da solo, si raggiunge solo dalla rete di casa. Per entrare da fuori
**non si apre niente sul router e non si installa niente**: è il ponte che
chiama fuori e resta in attesa in un posto dove il telefono lo va a trovare.
Quel posto è il centralino.

Gira su Cloudflare, sul piano gratuito, e l'indirizzo arriva insieme: non c'è
niente da pagare e nessun dominio da comprare.

Dal computer, una volta sola:

```bash
git clone https://github.com/danigio15/gdahomeapp
cd gdahomeapp/nuvola
npm install
npx wrangler login      # apre il browser: si fa un account gratuito e basta
npx wrangler deploy
```

Alla fine stampa l'indirizzo, fatto così:

```
https://centralino.<il-tuo-nome>.workers.dev
```

Poi, in Home Assistant: **Impostazioni → Add-on → Il ponte → Configurazione**,
e nella voce `centralino` scrivi lo stesso indirizzo **con `wss://` davanti**:

```
wss://centralino.<il-tuo-nome>.workers.dev
```

Salva e riavvia l'add-on. Apri **Il ponte** nella barra laterale: sotto «Da
fuori casa» deve dire **«Collegato al centralino: da fuori casa si entra.»**

Se dice altro, lì c'è scritto cosa non va.

> **Il centralino non può leggere niente di quello che passa.** Fra il telefono
> e la casa c'è uno scambio di chiavi che gli passa davanti senza che lui ne
> ricavi niente; da lì in poi ogni messaggio è cifrato punta a punta, e lui
> sposta byte che non sa aprire. Nemmeno il codice di abbinamento gli arriva:
> gli arriva la sua impronta, e dall'impronta non si torna indietro.

---

## 3. L'app

### Il codice

Nella barra laterale di Home Assistant apri **Il ponte** e premi **Fabbrica un
codice**. Compare un **quadretto**, e vale cinque minuti. (Sotto, per chi non
può inquadrarlo, ci sono le stesse cose in lettere: sedici, in quattro gruppi
da quattro.)

### Il pacchetto Android

Non serve installare niente sul computer: lo costruisce GitHub.

1. Sulla repository: **Actions → «L'app da provare» → Run workflow**.
2. C'è una casella **centralino**: incollaci `wss://centralino.<nome>.workers.dev`.
   Puoi anche lasciarla vuota: inquadrando il quadretto, il centralino glielo
   dice la casa. Serve solo a chi vuole battere le lettere a mano da fuori.
3. Quando finisce (cinque minuti circa), in fondo alla pagina della corsa c'è
   **gdahome-android**: scaricalo. Dentro c'è `app-release.apk`.
4. Passa il file sul telefono e aprilo. Android chiederà di consentire
   l'installazione da questa origine: è la richiesta normale per un'app che non
   arriva dal Play Store.

Il pacchetto è di *release*, firmato con la chiave di sviluppo: non è quello
che andrebbe su un negozio, ma è compilato per davvero — quello di *debug*
girava interpretato, con tutti i controlli accesi, ed era lento e scaldava.

> **Il ponte va tenuto al passo.** Dalla 0.11.0 il ponte e l'app comprimono
> quello che si mandano (cinque, otto volte meno byte, e meno lavoro per
> decifrarli): un'app nuova con un ponte vecchio funziona lo stesso, ma senza.
> Da «Come va l'app» si vede: nella riga del traffico c'è «gzip» oppure
> «senza gzip».

### La prima accensione

Apri l'app. C'è **un bottone**: «Inquadra il codice».

- **Inquadra il quadretto**, e basta. Da qualunque posto, anche dalla stazione:
  dentro al quadretto c'è anche a quale centralino chiama quella casa e su
  quali indirizzi la si trova sul Wi-Fi, quindi l'app non ha bisogno di sapere
  niente da prima. Funziona anche se nella casella del workflow non hai messo
  nessun centralino.
- Se non puoi inquadrare — un tablet senza fotocamera, il permesso negato —
  tocca **«Non puoi inquadrarlo? Scrivilo a mano»**: lì si battono le sedici
  lettere, e c'è anche la casella dell'indirizzo di casa per chi ne ha
  bisogno.

**Non ti verrà mai chiesta la password di Home Assistant, né un gettone.** Se
un giorno succede, è un difetto: quello che l'app riceve nasce dentro Home
Assistant, vale solo per quel telefono, e si stacca con un bottone dalla
console del ponte.

### La plancia

La home dell'app è **la plancia di DashboardModern**, quella vera: la pagina
con le sue tessere, le sue finestre, la sua barra in fondo e la sua
configurazione. In Home Assistant **non serve installare niente**: la plancia
la porta il ponte, che ha con sé i file e tiene lui la configurazione. Serve
solo **il ponte dalla 0.7.0 in su**; con uno più vecchio l'app dice che il
ponte non ha la plancia, e restano i dispositivi.

Si configura **dall'app**: la sezione Config della plancia, in fondo alla sua
barra. Quello che configuri lo vedono uguale tutti i telefoni abbinati a
quella casa, perché sta nel ponte e non sul telefono.

La prima volta ci mette qualche secondo, di più se sei fuori casa: i file
passano dal ponte e restano sul telefono, e dalla seconda volta in poi si apre
subito. Toccare **«Plancia»** nella barra quando ci sei già la ricarica.

### Dal browser, senza installare niente *(la più rapida in assoluto)*

1. **Actions → «L'app da provare»**, e scarica **gdahome-web**.
2. Scompatta, e servi quella cartella da un computer sulla rete di casa:

   ```bash
   cd gdahome-web
   python3 -m http.server 8000
   ```

3. Dal telefono, sulla stessa rete, apri `http://<ip-del-computer>:8000`.
   Su iPhone, **Condividi → Aggiungi a Home** la mette fra le app.

Una cosa da sapere: il browser fa parlare la pagina col ponte solo se i due
sono **tutti e due** in chiaro o **tutti e due** in cifrato. Se servi la pagina
in `http` e il ponte risponde in `http`, funziona. Mischiarli no — è il browser
che lo impedisce, non l'app.

E una seconda: **dal browser la plancia non si vede**. Sul telefono la serve
un server che sta dentro l'app, e dentro una pagina web un server non si apre.
Dal browser si provano l'abbinamento, il filo, i dispositivi, le case; la
plancia si prova sul telefono (o col collaudo, che il server lo accende a
parte: vedi `collaudo/README.md`).

### Dal codice, con Flutter *(per lavorarci)*

```bash
cd gdahomeapp/app
flutter pub get
flutter devices          # il telefono attaccato col cavo, o un browser
flutter run --dart-define=CENTRALINO=wss://centralino.<nome>.workers.dev
```

Per l'iPhone servono un Mac, Xcode e un account sviluppatore Apple: è l'unica
strada, e non c'è modo di aggirarla.

---

## Le segnalazioni e la chat, per chi mantiene l'app

Nell'app ci sono **Segnalazioni** e **Assistenza**: chi la usa scrive da lì,
e quello che scrive arriva a te come **issue di GitHub**, in una repository
che scegli tu. Rispondi da GitHub con un commento, e la risposta torna
nell'app. Nessuna console da tenere accesa: la console è GitHub.

Per accenderle, una volta sola:

1. Crea una repository per le segnalazioni (privata va bene), per esempio
   `gdahome-segnalazioni`, e scrivila in `nuvola/wrangler.toml` alla voce
   `GITHUB_REPO`.
2. Crea su GitHub un **token a grana fine** (Settings → Developer settings →
   Fine-grained tokens) con accesso alla sola repository di cui sopra e due
   permessi: **Issues: Read and write** per le segnalazioni, e **Contents:
   Read and write** per le foto e i video che ci si allegano. Non incollarlo
   da nessuna parte che non sia il passo dopo.
3. Mettilo fra i segreti di questa repository: Settings → Secrets and
   variables → Actions → New repository secret, nome `GETTONE_SEGNALAZIONI`
   (GitHub non accetta un segreto che cominci con `GITHUB_`), dentro solo il
   token. Non finisce in nessun file.
4. Lancia il bottone **Il centralino** su Actions: ripubblica il centralino e
   gli porta il gettone come `GITHUB_SEGNALAZIONI`.

Chi ha un terminale può fare le stesse due cose dalla cartella `nuvola`, con
`npx wrangler secret put GITHUB_SEGNALAZIONI` e poi `npx wrangler deploy`.

Senza il segreto tutto il resto funziona: l'app dice che il centralino non
ha le segnalazioni accese, e basta.

**Le foto e i video.** A una segnalazione, e alla chat, si allegano dal
telefono: dalla galleria o scattando al momento. Finiscono nella stessa
repository, in una cartella `allegati/<numero della issue>/`, e sotto la
issue compare un commento con il nome del file e il link per aprirlo. Le foto
partono già ridotte (1600 punti sul lato lungo); un video deve stare sotto i
10 MB, cioè venti o trenta secondi. Se il token non ha il permesso sui
contenuti, la segnalazione parte lo stesso e l'app dice che l'allegato no, e
perché.

## Cosa guardare, una volta dentro

- **La home è la tua plancia**, com'è in Home Assistant: le stesse tessere,
  le stesse finestre quando le tocchi, la stessa barra in fondo con le sue
  pagine, la stessa Config. Se cambi qualcosa nell'editor di là, qui si vede
  senza fare niente.
- **La barra dell'app** si tira dentro dal bordo sinistro (la pillola a metà
  altezza). In cima c'è il nome della casa e da dove stai passando: «in
  casa» o «da fuori». È la cosa più utile da controllare per prima, e la
  plancia da sola non la può sapere.
- **Spegni il Wi-Fi del telefono** e passa alla rete del cellulare. Dopo
  qualche secondo l'app deve tornare su da sola e la scritta deve diventare
  «da fuori». Se il centralino non c'è, deve dire che la casa si raggiunge solo
  dalla sua rete — **e dove si mette il centralino**, non un «non ha
  funzionato».
- **Torna sul Wi-Fi di casa.** Deve tornare «in casa» da solo, e i comandi
  devono essere immediati: in casa l'app va dritta al ponte e il centralino non
  lo disturba nemmeno.
- **Metti il telefono in tasca** per qualche minuto e riprendilo: il filo cade e
  si rialza da solo, e i valori devono essere quelli veri, non quelli di prima.
- **Dalla console del ponte, premi «Stacca»** sul telefono mentre l'app è
  aperta: deve accorgersene e dire che va riabbinato, senza restare a girare.
- **Chiudi e riapri l'app**: la plancia deve tornare com'era *subito*, anche
  prima che la casa risponda. Se dice «la dashboard è quasi pronta», vuol dire
  che la pagina non si è ritrovata quello che si era salvata: guarda in «Come
  va l'app» se il filo è aperto.
- **Se va a scatti: Assistenza → «Come va l'app».** Usa l'app per un minuto
  — plancia, barra, dispositivi — poi apri quella pagina e fotografala: dice
  quanti fotogrammi sono lenti, se il peso è di Flutter o della scheda video,
  se il filo principale è rimasto bloccato, e quanto passa sul filo con la
  casa. Allegala a una segnalazione: è metà della diagnosi. Per un confronto
  onesto, apri la stessa plancia nell'app di Home Assistant o in Chrome sullo
  stesso telefono: se anche lì va a scatti, il peso è della pagina, non
  dell'app.

## Se qualcosa non va

| cosa vedi | cosa vuol dire |
|---|---|
| L'app dice che la casa si raggiunge solo dalla sua rete | nel ponte non c'è nessun centralino: vedi il punto 2 |
| La console dice «Sto chiamando il centralino…» e non cambia | l'indirizzo nelle opzioni è sbagliato, o manca `wss://` |
| La console dice «Il centralino ci rifiuta» | c'è già un'altra casa registrata con quell'identificativo su quel centralino |
| Il codice viene rifiutato | dura cinque minuti e vale una volta sola: fanne un altro |
| L'app dice che la casa va riabbinata | il telefono è stato staccato dalla console, o è stato abbinato con una versione vecchia |
| L'app dice «Il ponte non ha la plancia» | il ponte è più vecchio della 0.7.0, o la cartella `plancia` non è finita dentro l'add-on: ricopia la cartella `ponte` intera e ricostruiscilo |
| La plancia resta su «Apro la plancia…» o dice che non è arrivata | il telefono è fuori casa e i file stanno ancora arrivando: la prima volta ci mette qualche secondo. Se non arriva mai, guarda il registro dell'add-on |
