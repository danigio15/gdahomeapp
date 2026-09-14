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

L'add-on si chiama **gdahome**, e la repository è pubblica: si installa **dal
negozio**, come qualunque altro add-on. Cinque minuti la prima volta, e poi si
aggiorna da sé.

### A. Dal negozio _(questa)_

1. **Impostazioni → Add-on → Negozio degli add-on**, menu in alto a destra →
   **Archivi**: incolla `https://github.com/danigio15/gdahomeapp`, premi
   **Aggiungi**, chiudi.
2. Nell'elenco compare **gdahome**. Aprilo e premi **Installa**. **La prima
   volta ci mette qualche minuto**: Home Assistant non se lo scarica già
   pronto, se lo costruisce sul posto — su un Raspberry anche cinque o dieci
   minuti. Le volte dopo è immediato.
3. **Avvialo.** Nella barra laterale compare **gdahome**: è la console, quella
   che fa i codici di abbinamento e che stacca i telefoni.

Da qui in poi gli aggiornamenti arrivano come per ogni altro add-on: quando si
pubblica una versione nuova, la scheda dell'add-on mostra **Aggiorna**. Non
serve nessun gettone di GitHub, e il bottone «Aggiorna gdahome» dentro la
console non compare nemmeno — in un add-on che ha un negozio dietro non
servirebbe a niente, e un bottone che non può funzionare è peggio di nessun
bottone.

### B. A mano, per svilupparlo

Serve a chi cambia il codice e lo vuole provare senza pubblicare niente.

1. **Scarica il codice**: sulla pagina della repository, **Code → Download
   ZIP**.
2. **Apri la cartella `addons` di Home Assistant.** Ci si arriva con uno
   qualunque di questi, quello che hai già:
   - l'add-on **Samba share**, che la fa comparire come cartella di rete;
   - l'add-on **Advanced SSH & Web Terminal**;
   - l'add-on **Studio Code Server** o **File editor**.
3. **Copiaci dentro la cartella `ponte` dello ZIP, chiamandola `gdahome`.**
   Alla fine deve esserci `addons/gdahome/config.yaml`. Il nome della cartella
   in sé è libero — l'identità Home Assistant la legge dal manifesto — ma
   tenerlo uguale allo slug è l'unico modo per non perdersi fra i comandi qui
   sotto.
4. **Negozio degli add-on**, menu in alto a destra → **Ricarica**: compare una
   sezione **Local add-ons** con dentro **gdahome**.
5. Installalo e avvialo.

#### Per aggiornarlo: glielo chiedi, e lo fa lui

Un add-on tenuto in `/addons/gdahome` non ha nessun negozio dietro: Home
Assistant guarda il manifesto che trova in quella cartella, e quella è l'unica
versione che conosce. Finché quei file non cambiano **sul disco di casa**,
«Aggiorna» non compare mai, per quante versioni si pubblichino. Non è un
difetto del negozio: è che il negozio non c'è.

Quindi ci pensa lui. Apri **gdahome** dalla barra laterale, e in fondo alla
pagina la scheda **«La versione»** dice che versione è e se ce n'è una più
nuova. Il bottone **«Aggiorna gdahome»** se la scarica, la mette al posto di
questa e si ricostruisce. Ci mette qualche minuto, e mentre lo fa quella pagina non
risponde: è normale, torna da sé.

Non serve nessun gettone di GitHub, e infatti nella configurazione
dell'add-on quella casella non c'è più: serviva a quando la repository era
privata, e adesso è pubblica — il manifesto e il pacchetto li legge chiunque.

A mano si può ancora: riscarichi lo ZIP, risostituisci la cartella, e nel
negozio premi **Ricarica**; poi nella pagina dell'add-on premi **Aggiorna**
(o, dai tre puntini, **Ricostruisci**).

#### Dal terminale, in un colpo solo

Lo stesso giro, se hai l'add-on **Terminal & SSH** (o **Advanced SSH & Web
Terminal**): si incolla nel suo terminale e non chiede niente.

```sh
rm -rf /tmp/gdahome && mkdir -p /tmp/gdahome
echo "Il pacchetto: HTTP $(curl -sS -L -o /tmp/gdahome/ponte.tar.gz -w '%{http_code}' https://api.github.com/repos/danigio15/gdahomeapp/tarball/main), $(wc -c < /tmp/gdahome/ponte.tar.gz) byte  (sotto il milione di byte non e' il pacchetto, e' un messaggio di errore)"
tar -xzf /tmp/gdahome/ponte.tar.gz -C /tmp/gdahome 2>/dev/null && dove=$(find /tmp/gdahome -maxdepth 1 -mindepth 1 -type d | head -1) || dove=""
if [ -n "$dove" ] && [ -f "$dove/ponte/config.yaml" ]; then
  echo "Nel pacchetto c'e' la $(sed -n 's/^version: "\(.*\)"/\1/p' "$dove/ponte/config.yaml")"
  rm -rf /addons/gdahome && cp -r "$dove/ponte" /addons/gdahome && rm -rf /tmp/gdahome
  echo "Nella cartella adesso c'e' la $(sed -n 's/^version: "\(.*\)"/\1/p' /addons/gdahome/config.yaml)"
else
  echo "Il codice nuovo non e' arrivato: leggi le righe qui sopra. La cartella e' quella di prima, non si e' rotto niente."
fi
ha store reload 2>/dev/null || echo "(il negozio non si e' ricaricato: si va avanti)"
( ha apps rebuild local_gdahome || ha addons rebuild local_gdahome ) 2>/dev/null || echo "(non ricostruito)"
( ha apps restart local_gdahome || ha addons restart local_gdahome ) 2>/dev/null || echo "(non riavviato)"
( ha apps info local_gdahome || ha addons info local_gdahome ) 2>/dev/null | grep -E '^(version|version_latest|state|update_available):'
```

Scarica il codice, sostituisce `/addons/gdahome`, ricarica il negozio,
ricostruisce l'add-on e lo riavvia: alla fine stampa quello che Home Assistant
ne pensa. La cartella vecchia la toglie **solo dopo** che il pacchetto è
arrivato ed è stato riconosciuto, quindi se qualcosa va storto non si rompe
niente. Ci mette qualche minuto, che è la ricostruzione.

**Perché è scritto così**, e sono due lezioni pagate:

- **Ogni riga del Supervisor va per conto suo.** Prima erano attaccate con
  `&&`, e siccome nelle versioni nuove `ha addons reload` non c'è più — si
  chiama `ha store reload` — quella riga andava in errore e tutto quello che
  veniva dopo non girava. Risultato: i file nuovi nella cartella e Home
  Assistant ancora sulla versione di prima, senza che niente dicesse cosa era
  andato storto. E `addons` ormai si chiama **`apps`**: si prova il nome
  nuovo, e se non c'è si usa quello vecchio.
- **Il download dice cosa risponde GitHub.** Prima era `curl -fsSL`, che
  tace: se il pacchetto non arrivava la riga era sempre la stessa — «non è
  arrivato» — senza dire perché. Adesso si vedono il codice HTTP e quanti
  byte sono arrivati, e i byte bastano a capirlo: un messaggio di errore di
  GitHub sta in poche centinaia.

**Due numeri, non uno.** Se qualcosa non torna, questi due si guardano
separatamente:

```sh
sed -n 's/^version: "\(.*\)"/\1/p' /addons/gdahome/config.yaml
( ha apps info local_gdahome || ha addons info local_gdahome ) 2>/dev/null | grep -E '^(version|version_latest|state|update_available):'
```

Il primo è quello che c'è **sul disco**; il secondo è quello che Home
Assistant ha **installato**. Se sono diversi, i file sono arrivati e manca
solo il giro del Supervisor: `ha store reload`, poi `ha apps rebuild
local_gdahome`. Se il primo è già quello vecchio, il codice nuovo non è mai
arrivato: rifà il blocco qui sopra, e stavolta le righe dicono perché.

> **L'app invece non c'entra niente con tutto questo.** L'APK si scarica da
> Actions, e quello vale per chiunque abbia accesso alla repository.

---

## 2. Il centralino — solo per entrare da fuori casa

Il ponte, da solo, si raggiunge solo dalla rete di casa. Per entrare da fuori
**non si apre niente sul router e non si installa niente**: è il ponte che
chiama fuori e resta in attesa in un posto dove il telefono lo va a trovare.
Quel posto è il centralino.

Il centralino di gdahome è `tramite.gdahome.org`, ed è quello che l'app usa
senza che nessuno configuri niente: sta scritto nel codice, e il ponte lo
chiama da sé. **Questo punto serve solo a chi vuole il proprio**, e ci sono due
modi.

**Su Cloudflare**, piano gratuito, indirizzo compreso: non c'è niente da pagare
e nessun dominio da comprare. È in [`nuvola/`](nuvola/README.md), e dal
computer si fa una volta sola:

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

Poi quell'indirizzo va scritto **dentro l'add-on**: nella sua scheda una
casella per metterlo non c'è, apposta — l'indirizzo giusto è quello di gdahome,
e una casella che non va toccata prima o poi qualcuno la tocca. Con una copia
locale dell'add-on si fa una volta sola:

```
node strumenti/centralino.mjs wss://centralino.<il-tuo-nome>.workers.dev
```

Scrive i tre posti dove quell'indirizzo sta — il difetto dell'add-on, quello
dell'app, quello della chat — e una prova tiene fermo che i primi due restino
identici. Poi **Negozio degli add-on → Ricarica**, e si installa da lì.

**Su una macchina propria**, se si preferisce non dipendere da Cloudflare:
la stessa cosa scritta in Node sta in [`centralino/`](centralino/README.md),
con uno script che la mette in piedi da zero. I due sono intercambiabili, e la
prova dal vivo passa identica contro tutti e due.

Apri **gdahome** nella barra laterale: sotto «Da fuori casa» deve dire
**«Collegato a wss://…: da fuori casa si entra.»**, con dentro il tuo
indirizzo. Se invece c'è quello di gdahome, l'add-on che gira non è la tua
copia.

Se dice altro, lì c'è scritto cosa non va.

> **Il centralino non può leggere niente di quello che passa.** Fra il telefono
> e la casa c'è uno scambio di chiavi che gli passa davanti senza che lui ne
> ricavi niente; da lì in poi ogni messaggio è cifrato punta a punta, e lui
> sposta byte che non sa aprire. Nemmeno il codice di abbinamento gli arriva:
> gli arriva la sua impronta, e dall'impronta non si torna indietro.

---

## 3. L'app

### Il codice

Nella barra laterale di Home Assistant apri **gdahome** e premi **Genera QR
code**. Compare il **QR code**, e vale cinque minuti. (Sotto, per chi non
può inquadrarlo, ci sono le stesse cose in lettere: sedici, in quattro gruppi
da quattro.)

### Il pacchetto Android

Non serve installare niente sul computer: lo costruisce GitHub.

1. Sulla repository: **Actions → «L'app da provare» → Run workflow**.
2. C'è una casella **centralino**: incollaci `wss://centralino.<nome>.workers.dev`.
   Puoi anche lasciarla vuota: inquadrando il quadretto, il centralino glielo
   dice la casa. Serve solo a chi vuole digitare le lettere a mano da fuori.
3. Quando finisce (cinque minuti circa), in fondo alla pagina della corsa c'è
   **gdahome-android**: scaricalo. Dentro c'è `app-release.apk`.
4. Passa il file sul telefono e aprilo. Android chiederà di consentire
   l'installazione da questa origine: è la richiesta normale per un'app che non
   arriva dal Play Store.

Il pacchetto è di _release_, firmato con la chiave di sviluppo: non è quello
che andrebbe su un negozio, ma è compilato per davvero — quello di _debug_
girava interpretato, con tutti i controlli accesi, ed era lento e scaldava.

> **Il ponte va tenuto al passo.** Il ponte e l'app comprimono quello che si
> mandano (cinque, otto volte meno byte, e meno lavoro per decifrarli): un'app
> nuova con un ponte vecchio funziona lo stesso, ma senza. Da «Come va l'app»
> si vede: nella riga del traffico c'è «gzip» oppure «senza gzip».

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

Si configura **dall'app**, dalla voce **Configurazione** del menu: quella apre
la pagina Configurazione della plancia, la sua, con la tessera «Configura
Entità» che porta all'editor, il **Tema** con le sei tavolozze, la **Barra di
navigazione** e «Sostieni il progetto». Nella barra in fondo alla plancia la
voce Config non c'è: su un telefono quella fila di schede non ci sta, ed è la
sola ragione per cui la porta si è spostata. Tornando a **Plancia** dal menu,
la plancia torna dov'era.

Quello che configuri lo vedono uguale tutti i telefoni abbinati a quella casa,
perché sta nel ponte e non sul telefono. Il tema, la tavolozza e la barra no:
quelli sono **di questo dispositivo**, e lo dice la dashboard stessa sotto ogni
tessera.

La prima volta ci mette qualche secondo, di più se sei fuori casa: i file
passano dal ponte e restano sul telefono, e dalla seconda volta in poi si apre
subito. Toccare **«Plancia»** nella barra quando ci sei già la ricarica.

### La plancia si aggiorna da sola

Quando DashboardModern pubblica una versione nuova, l'add-on se la porta dietro
senza che nessuno faccia niente: una volta al giorno la corsa **«La plancia
nuova»** guarda l'ultima release di `dashboardmodern-v2`, e se è più nuova di
quella che l'add-on ha dentro la scarica, la mette in `ponte/plancia/`, alza di
un numero la versione dell'add-on e salva. In Home Assistant compare
**Aggiorna** sulla pagina di «gdahome», e da lì la plancia nuova arriva a tutti
i telefoni abbinati.

Si può anche accendere a mano: **Actions → «La plancia nuova» → Run workflow**.

Se `dashboardmodern-v2` è privata serve un gettone, una volta sola: un token a
grana fine su quella repository sola, con **Contents: Read-only**, messo fra i
segreti di questa repository come **`GETTONE_PLANCIA`** (Settings → Secrets and
variables → Actions). Senza, la corsa finisce verde e scrive che manca quello.

### Dal browser, senza installare niente _(la più rapida in assoluto)_

Il link ce l'hai già: lo dà l'add-on.

1. In Home Assistant, barra laterale → **gdahome**.
2. Scheda «gdahome in un browser» → **Apri gdahome**.

È la stessa app del telefono, e si adatta da sola allo schermo: su un computer
la barra resta aperta di fianco, su tablet e telefono si apre a scomparsa —
anche sopra la plancia, premendo i **tre trattini della plancia** in alto a
sinistra, come sul telefono.
L'indirizzo sta **dietro l'ingress** di Home Assistant — ci arriva solo chi è
già entrato, e non c'è nessuna porta nuova aperta sul router.

Se la scheda non c'è, l'add-on non si porta ancora dietro l'app: **Actions →
«gdahome dentro l'add-on» → Run workflow**, poi aggiorna l'add-on.

Una cosa da sapere, e conviene saperla prima: se apri Home Assistant su un
indirizzo **`http`**, dal browser **la plancia non si disegna**. Tutto il resto
sì — l'abbinamento, il filo, la Configurazione, i dispositivi, le case. Non è un
pezzo che manca: la plancia nel browser la serve un _service worker_, e i
service worker i browser li fanno girare solo su `https` o `localhost`. È una
regola loro. Con Nabu Casa acceso, o con un proxy che mette il certificato,
`https` c'è e la plancia si vede. Sul telefono la plancia si vede sempre, perché
lì il server sta dentro l'app.

### Un link vero, da usare ovunque — anche fuori casa

Quello dell'add-on **non è un link**: vive finché vive la pagina di Home
Assistant che lo tiene aperto, e in una scheda a parte dopo qualche minuto
risponde **401**. Per averne uno da salvare fra i preferiti, da aprire da
qualsiasi rete e da mandare a qualcuno, gdahome sta **anche sul centralino**:

```
https://gdahome-centralino.<il-tuo-nome>.workers.dev/app/
```

L'indirizzo corto — senza `/app/` — porta lì da solo. Lo trovi già scritto,
pronto da copiare, nella console dell'add-on: **gdahome → gdahome in un
browser → «Da fuori casa, o da un browser qualsiasi»**.

Si accende insieme al centralino: **Actions → «Il centralino» → Run
workflow**. Quel bottone copia accanto al centralino la stessa app che sta
dentro l'add-on (`ponte/app`) — non ne costruisce una seconda, così non
possono diventare diverse. Se l'add-on non se la porta ancora dietro, prima
**«gdahome dentro l'add-on»**, poi questo.

**Cosa diventa pubblico: solo l'app.** Non la plancia — quella la serve
l'add-on di casa e passa dal filo cifrato; non la configurazione; non nessuna
casa. Chi apre quel link trova «Colleghiamo la casa», ed è la stessa porta del
telefono: senza un codice di abbinamento non va da nessuna parte. Il link è
**uguale per tutti**, ed è giusto che lo sia: è l'indirizzo dell'app, come
quello di qualsiasi sito. Quello che è di ognuno non è il link, è
l'abbinamento.

E lì `https` c'è sempre, quindi **la plancia si disegna** — a differenza di un
Home Assistant aperto su `http`.

### Dal codice, con Flutter _(per lavorarci)_

```bash
cd gdahomeapp/app
flutter pub get
flutter devices          # il telefono attaccato col cavo, o un browser
flutter run --dart-define=CENTRALINO=wss://centralino.<nome>.workers.dev
```

Per l'iPhone servono un Mac, Xcode e un account sviluppatore Apple: è l'unica
strada, e non c'è modo di aggirarla.

---

## Le segnalazioni, per chi mantiene l'app

Nell'app ci sono **Segnalazioni** e **Assistenza**, e sono due strade diverse.

Una **segnalazione** — un difetto, un'idea, una domanda che deve restare
scritta — arriva a te come **issue di GitHub**, in una repository che scegli
tu. Rispondi da GitHub con un commento, e la risposta torna nell'app. Nessuna
console da tenere accesa: la console è GitHub.

L'**Assistenza** invece è la chat della plancia, la stessa che si apre dalla
sua Configurazione: passa dal suo centralino, e da GitHub non passa. Non c'è
niente da accendere — funziona appena l'add-on è su — e chi risponde la legge
dalla dashboard di chi mantiene, dove legge quelle di tutte le case. Chiedere
aiuto non è segnalare un difetto: si incolla un pezzo di configurazione, il
nome delle proprie entità, e quelle parole non vanno su una pagina che
chiunque può leggere.

Per le segnalazioni, una volta sola:

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

**Le foto e i video.** A una segnalazione si allegano dal telefono: dalla
galleria o scattando al momento. Finiscono nella stessa repository, in una
cartella `allegati/<numero della issue>/`, e sotto la issue compare un
commento con il nome del file e il link per aprirlo. Alla chat non si allega
niente — quella passa parole — e una prova sta meglio dentro una
segnalazione, accanto al difetto che mostra. Le foto
partono già ridotte (1600 punti sul lato lungo); un video deve stare sotto i
10 MB, cioè venti o trenta secondi. Se il token non ha il permesso sui
contenuti, la segnalazione parte lo stesso e l'app dice che l'allegato no, e
perché.

## Cosa guardare, una volta dentro

Prima di tutto le cose arrivate per ultime, che sono quelle da bocciare subito
se non funzionano:

- **L'Assistenza, e la chat della plancia.** Nell'app, sezione
  **Assistenza**: scrivi una frase e premi manda. Non deve dire niente di
  rosso — vuol dire che il centralino della chat ha risposto — e la frase
  resta lì anche chiudendo e riaprendo l'app. La stessa conversazione si apre
  dalla plancia, dalla sua Configurazione: le stesse parole, perché sotto è
  la stessa chat. La graffetta 📎 qui non c'è più, e non è una dimenticanza:
  questa chat passa parole, e una foto si allega a una segnalazione.
- **Menu → Configurazione.** Deve comparire la pagina **CONFIGURAZIONE** della
  dashboard, con la sua insegna e la versione della plancia — deve essere
  quella scritta nella scheda dell'add-on, e se ne dice una più vecchia il
  ponte non è aggiornato — e sotto le sue
  tessere: 🧩 Configura Entità, 🎨 Tema con le sei tavolozze, 📌 Barra di
  navigazione. «Sostieni il progetto» qui **non c'è**: questa pagina si presenta come
  gdahome, e una donazione che porta a un altro progetto, dentro una pagina
  che ne porta il nome, è una cosa che chi la legge non capisce.

E poi tutto il resto:

- **La home è la tua plancia**, com'è in Home Assistant: le stesse tessere,
  le stesse finestre quando le tocchi, la stessa barra in fondo con le sue
  pagine, la stessa Config. Se cambi qualcosa nell'editor di là, qui si vede
  senza fare niente.
- **La barra dell'app** si apre da due posti, e nessuno dei due è un gesto
  nuovo da imparare: sulla plancia i suoi **tre trattini** in alto a sinistra
  — dentro Home Assistant quel tasto apre la barra di HA, qui apre la nostra —
  e sulle altre schermate il **☰** nella barra del titolo. Su Android anche il
  **tasto indietro**: lo apre, e col menu aperto esce dall'app. In cima alla
  barra c'è il nome della casa e da dove stai passando: «in casa» o «da
  fuori». È la cosa più utile da controllare per prima, e la plancia da sola
  non la può sapere.
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
- **Chiudi e riapri l'app**: la plancia deve tornare com'era _subito_, anche
  prima che la casa risponda. Se dice «la dashboard è quasi pronta», vuol dire
  che la pagina non si è ritrovata quello che si era salvata: guarda in «Come
  va l'app» se il filo è aperto.
- **Se va a scatti: «Come va l'app»**, dal menu (o dall'Assistenza, che ha il
  suo bottone). Usa l'app per un minuto
  — plancia, barra, dispositivi — poi apri quella pagina e fotografala: dice
  quanti fotogrammi sono lenti, se il peso è di Flutter o della scheda video,
  se il filo principale è rimasto bloccato, e quanto passa sul filo con la
  casa. Allegala a una segnalazione: è metà della diagnosi. Per un confronto
  onesto, apri la stessa plancia nell'app di Home Assistant o in Chrome sullo
  stesso telefono: se anche lì va a scatti, il peso è della pagina, non
  dell'app.

## Se qualcosa non va

| cosa vedi                                                        | cosa vuol dire                                                                                                                                        |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| L'app dice che la casa si raggiunge solo dalla sua rete          | nel ponte non c'è nessun centralino: vedi il punto 2                                                                                                  |
| La console dice «Sto chiamando il centralino…» e non cambia      | l'indirizzo nelle opzioni è sbagliato, o manca `wss://`                                                                                               |
| La console dice «Il centralino ci rifiuta»                       | c'è già un'altra casa registrata con quell'identificativo su quel centralino                                                                          |
| Il codice viene rifiutato                                        | dura cinque minuti e vale una volta sola: fanne un altro                                                                                              |
| L'app dice che la casa va riabbinata                             | il telefono è stato staccato dalla console, o è stato abbinato con una versione vecchia                                                               |
| L'app dice «Il ponte non ha la plancia»                          | la cartella `plancia` non è finita dentro l'add-on: ricopia la cartella `ponte` intera e ricostruiscilo                                               |
| La plancia resta su «Apro la plancia…» o dice che non è arrivata | il telefono è fuori casa e i file stanno ancora arrivando: la prima volta ci mette qualche secondo. Se non arriva mai, guarda il registro dell'add-on |
