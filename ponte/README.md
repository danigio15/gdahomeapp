# gdahome

La tua casa sul telefono. Questo add-on serve la **plancia** — quella di
DashboardModern — all'app di gdahome, da dentro e da fuori casa, e tiene il
segreto di Home Assistant al posto suo: sul telefono non ci finisce mai.

Nella barra laterale di Home Assistant compare **gdahome**: è la sua pagina, ed
è da lì che si fa tutto.

## Comincia da qui

1. Apri **gdahome** dalla barra laterale.
2. Premi **Genera QR code**: compare il QR code.
3. Apri gdahome sul telefono e inquadralo.

Fatto: il telefono è dentro, e da quel momento entra da solo. Il codice vale
**cinque minuti e una volta sola**; sotto al QR code ci sono le stesse cose in
lettere — sedici, in quattro gruppi da quattro — per chi non può inquadrare.

Dentro al QR code non c'è solo il codice: c'è anche **dove sta questa casa**,
cioè su quali indirizzi la si trova sul Wi-Fi e a quale centralino chiama. È il
motivo per cui non si deve scrivere nessun indirizzo, nemmeno la prima volta e
nemmeno da fuori.

Non hai il telefono sotto mano? Nella pagina c'è **Apri gdahome**: la stessa
app, dentro il browser, senza installare niente.

## Cosa c'è nella pagina

|                           |                                                                                                                                                                              |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **la striscia in cima**   | tre pastiglie con un pallino: Home Assistant, Da fuori casa, La plancia. È il «come sta», e si legge in un secondo                                                           |
| **Abbina un telefono**    | il QR code e il codice in lettere                                                                                                                                            |
| **Telefoni abbinati**     | chi entra in questa casa. **Togli associazione** spegne un telefono all'istante: il filo aperto cade, e con quel segno non si rientra più                                    |
| **Le plance**             | se ne tengono fino a otto, ognuna con le sue sezioni, le sue tessere, le sue stanze, e ognuna con i suoi utenti abilitati. Compaiono anche fra le «Plance» di Home Assistant |
| **Aprila in un browser**  | l'app qui dentro, e l'indirizzo per aprirla da fuori                                                                                                                         |
| **Se qualcosa non torna** | chiuso: dentro c'è lo stato per bene e i rimedi. È il posto da aprire il giorno che qualcosa non va                                                                          |

## Chi vede quale plancia

Le plance si tengono fino a otto, e ognuna può essere riservata a **chi decidi
tu**: nella scheda «Le plance» ogni riga ha **Chi la vede**, e sotto ci sono due
modi di dirlo. Serve a chi tiene una plancia per sé e una per chi abita con lui,
e a chi ha un tablet in cucina che deve aprire una plancia sola.

|                                        |                                                                                                             |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Solo gli amministratori della casa** | chiunque abbia le chiavi di casa, anche chi arriverà domani. Si aggiorna da sé: non c'è una lista da rifare |
| **e anche, solo questi utenti**        | gli utenti di questa casa, con una spunta per ognuno. Quando sai esattamente chi                            |

- **Niente di spuntato vuol dire tutti**, ed è come nascono le plance: chi non
  apre questa impostazione non se ne accorge.
- Le due cose **si sommano**: se metti l'interruttore _e_ spunti due nomi, la
  plancia la vedono quei due, e solo se amministrano.
- Tutto si salva appena lo tocchi. Per riaprirla a tutti, spegni l'interruttore
  e togli le spunte.
- Chi non ha **nessuna** plancia, nell'app legge «Non hai plance associate alla
  tua utenza» e non si apre niente. Non gli si apre quella di un altro: se
  bastasse non avere niente per vedere tutto, questa impostazione non
  servirebbe a nulla.
- Vale anche per la prima plancia, quella di sempre.
- Gli utenti li chiede Home Assistant al momento: se togli una persona da casa,
  sparisce anche da qui.

**E vale anche per l'app.** Il QR abbina un telefono, non un utente: perché
allora il telefono veda le plance giuste, **il codice si intesta a qualcuno**.
Di serie è chi sta usando la pagina; se il codice lo fai per un altro — lo fai
tu e passi il telefono — lo dici in **Per chi è**, accanto al tasto. Da quel
momento quel telefono vede quello che vede lui, e cambiando le spunte cambia
subito: non c'è niente da riabbinare.

In **Telefoni abbinati** c'è scritto di chi è ogni telefono. Quelli abbinati
prima di questa versione dicono «vede tutte le plance», perché è così: nessuno
li aveva intestati, e non si spengono da soli. Per dargli un padrone basta
togliere l'associazione e rifarla.

**Cosa fa, per bene.** Chi non è abilitato apre quella voce e trova scritto che
non è abilitato: la plancia non gli arriva. Non gli arriva nascosta — non gli
arriva. Il controllo lo fa l'add-on, e sa chi sta guardando perché è Home
Assistant a dirglielo su ogni richiesta, non la pagina: non c'è niente da
aggirare togliendo un pezzo di pagina col browser.

Con **Solo gli amministratori** ci sono due lucchetti invece di uno: quella voce
Home Assistant non la mette nemmeno nella barra laterale di chi non amministra,
e chi prova ad arrivarci per un'altra strada lo ferma l'add-on.

**Cosa non fa.** Non è un permesso di Home Assistant e non ne fa le veci: chi
entra in casa continua a deciderlo Home Assistant, e questo decide quale
plancia gli si apre quando è dentro. Chi in Home Assistant è amministratore può
cambiare queste spunte, perché questa pagina la aprono gli amministratori.

## Da fuori casa

In casa l'app trova gdahome da sola, sulla porta 8098. Da fuori è **la casa che
chiama**: apre un filo verso il centralino e ci resta in attesa, e i telefoni
arrivano da quella parte. Nessuna porta da aprire sul router, nessun indirizzo
pubblico da avere, nessuna VPN da installare — e funziona anche senza un
dominio e senza abbonamenti. Il centralino instrada e non può leggere niente:
fra il telefono e la casa c'è uno scambio di chiavi che gli passa davanti senza
che lui ne ricavi nulla.

L'indirizzo non si scrive da nessuna parte: è quello di gdahome, sta dentro
l'add-on, e **nella configurazione non c'è nessuna casella per metterlo**.
C'era, e stava sempre vuota: una casella che non va toccata è una casella che
prima o poi qualcuno tocca. Dove chiama questa casa lo dice la pastiglia **Da
fuori casa** in cima alla pagina, e se non ci arriva dice anche perché.

Spegnendo `da_fuori_casa` la casa non chiama nessuno e l'app funziona solo sotto
il Wi-Fi di casa. Per chi la guarda dal divano va benissimo.

## Le opzioni

|                       |                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| `da_fuori_casa`       | acceso: si passa dal centralino di gdahome, e non c'è niente da scrivere. Spento: solo la rete di casa |
| `porta_app`           | la porta su cui bussa l'app (di serie: 8098)                                                           |
| `dispositivi_massimi` | quanti telefoni possono restare abbinati insieme (10)                                                  |
| `minuti_del_codice`   | quanto vive un codice di abbinamento (5)                                                               |
| `giorni_di_silenzio`  | dopo quanto un telefono sparito viene tolto da solo; zero vuol dire mai (90)                           |
| `gettone`             | **lascialo vuoto**: da quando la repository è pubblica non serve più                                   |
| `chiave_console`      | **lasciala vuota**: serve a una installazione al mondo, quella di chi risponde alle segnalazioni       |
| `registro`            | `debug`, `info`, `attenzione`, `errore`                                                                |

## Se qualcosa non torna

| cosa vedi                                          | cos'è, e cosa si fa                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| la plancia esce con **«Errore di configurazione»** | Home Assistant non ha ancora la cartina della plancia. Nella pagina, in «Se qualcosa non torna», c'è scritto quale dei tre passaggi manca e il bottone **Carica la cartina adesso**. Se dice di riavviare Home Assistant, riavvialo una volta: la cartella `www` l'ha creata l'add-on, e i file che stanno lì dentro Home Assistant li serve solo se c'era quando è partito |
| **da fuori casa non entra**                        | guarda la pastiglia «Da fuori casa». Se dice `getaddrinfo` o `SERVFAIL`, il nome del centralino non si risolve: è il DNS di casa, non l'add-on. Se dice «ci rifiuta», il motivo è scritto di fianco                                                                                                                                                                         |
| **l'app va a scatti**                              | apri «Chi parla di più» (c'è solo per chi risponde alle segnalazioni): nomina le entità che mandano più eventi. A quelle due o tre si mette un filtro in Home Assistant, e il traffico cala di dieci volte                                                                                                                                                                  |
| la plancia **nel browser non si disegna**          | Home Assistant è aperta su un indirizzo `http`. La plancia nel browser ha bisogno di `https` — è una regola dei browser, non nostra. Sul telefono si vede comunque                                                                                                                                                                                                          |
| il codice **non funziona più**                     | vale cinque minuti e una volta sola: fanne un altro                                                                                                                                                                                                                                                                                                                         |

## Come si mette su

Dal negozio di Home Assistant, come qualunque altro add-on:

1. **Impostazioni → Add-on → Negozio degli add-on**, i tre puntini in alto a
   destra → **Archivi**.
2. Incolla `https://github.com/danigio15/gdahomeapp` e premi **Aggiungi**.
3. Nell'elenco compare **gdahome**: si installa e si avvia.

La prima volta ci mette qualche minuto — su un Raspberry anche dieci — perché
Home Assistant non se lo scarica già pronto: se lo **costruisce sul posto** dai
file che si leggono qui. È anche il motivo per cui non c'è niente da fidarsi.
Dopo, gli aggiornamenti arrivano dal negozio come per ogni altro add-on.

**A mano**, per chi vuole tenersene una copia sua: si copia la cartella `ponte`
dentro la cartella `addons` di Home Assistant — con Samba, un terminale o
Studio Code Server, finché c'è `addons/ponte/config.yaml` — poi **Negozio degli
add-on → i tre puntini → Ricarica**. Lì compare anche il bottone **Aggiorna
gdahome** dentro la pagina, che si porta dentro le versioni nuove da sé: serve
a chi non ha nessun negozio dietro.

---

## Come è fatto, per chi vuole saperlo

### Le due porte, che sono tutta la sicurezza

|             | dove arriva                                                        | cosa si può fare                                                                |
| ----------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| **ingress** | solo da Home Assistant, che ci mette davanti la sua autenticazione | fabbricare un codice, vedere i telefoni, staccarli, aprire gdahome nel browser  |
| **8098**    | l'unica che può finire esposta                                     | chiedere se è vivo, presentare un codice, aprire il filo con un segno già avuto |

Un codice di abbinamento **nasce solo dalla pagina**. Sulla porta esposta non
c'è nessuna via per farne nascere uno: da lì si può soltanto presentarne uno che
esiste già. È la differenza fra un ponte e una porta aperta.

Le tre vie della porta dell'app: `GET /salute` dice che è vivo, `POST
/abbinamento` scambia un codice valido con un segno — una volta sola — e `WS
/casa` apre il filo. Sul filo l'add-on **si presenta come Home Assistant**:
manda `auth_required`, aspetta `auth` col proprio segno al posto di quello di
Home Assistant, risponde `auth_ok`, e da lì in poi non guarda più dentro a
niente. Qualunque codice che sa parlare con Home Assistant funziona di qui
senza cambiare una riga.

Chi si abbina riceve quattro cose: il **segno**, che fa entrare (qui ne resta
solo l'impronta: chi legge il file non entra); la **chiave**, che cifra il filo;
il **dispositivo**, cioè nome e identificativo per l'elenco; e il **ritorno** —
dove ribussare domani. È il ritorno che fa sì che nessuno debba scrivere un
indirizzo: dice l'identificativo di questa casa al centralino, l'indirizzo del
centralino, e gli indirizzi su cui la casa si trova sulla rete locale, così il
telefono sul divano va dritto invece di fare il giro del mondo.

### La plancia

I file della plancia stanno qui, in `plancia/`, e **in Home Assistant non serve
nessuna integrazione**: tutto quello che la plancia chiedeva all'integrazione lo
fa questo add-on, rispondendo esattamente come risponderebbe lei — la
configurazione (`/data/plancia.json`, con le stesse regole contro le perdite di
dati e le stesse cinque revisioni tenute), il catalogo dei dispositivi, le foto,
la chat. Ogni file porta dentro la propria impronta, e la pastiglia **La
plancia** dice se è quella originale o se qualcuno l'ha toccata: una copia
modificata non viene bloccata, viene detta.

Una plancia è **tre nomi** con tre mestieri: il `profilo` (il cassetto dove sta
la configurazione), il `titolo` (come la chiama chi ci abita) e l'`istanza` (il
nome con cui la pagina tiene separate le proprie cose nel deposito del browser).
Rinominarla cambia il titolo e non gli altri due, se no le si cancellerebbe il
lavoro. E ha due cose che non sono nomi: `utenti`, gli identificativi degli
utenti di Home Assistant abilitati a vederla — vuoto vuol dire tutti — e
`solo_admin`, che finisce su `require_admin` della sua voce fra le «Plance».
Le due si sommano in `laVede`, che è il posto unico dove sta la regola.
Quell'elenco lo guarda `laPlanciaServita` prima di leggere la pagina dal disco,
confrontandolo con la riga `X-Remote-User-Id` che il Supervisor scrive su ogni
richiesta che passa dall'ingress: non arriva dalla pagina, quindi non è la
pagina a poterla cambiare. «Amministra?» è l'unico pezzo che l'ingress non dice,
e lo chiede `utenti.js` a Home Assistant (`config/auth/list`, risposta tenuta un
minuto, e se Home Assistant non risponde si riusa l'ultima buona invece di
chiudere la porta in faccia a chi amministra). Il filo della plancia — uno per
tutte, e non sa quale pagina l'ha aperto — si chiude a chi non vede **nessuna**
plancia di questa casa. Nell'app la stessa regola passa dal telefono: il codice
di abbinamento porta con sé l'utente (`abbinamento.js`), il telefono lo eredita
(`dispositivi.js`, campo `utente`), e `commissioni.js` filtra l'elenco con la
stessa `laVede`. Un telefono senza utente — abbinato prima, o con un codice
fatto fuori dall'ingress — vede tutto, come prima. La cartina si porta dietro le stesse due cose per un
motivo solo: dire subito «non è abilitata per te» invece di lasciare un riquadro
bianco. La prima c'è sempre, tiene il profilo `primary` e non si toglie; le
altre si aggiungono, si rinominano e si tolgono dalla pagina o dall'app. Ogni
plancia ha la sua voce fra le «Plance» di Home Assistant, e ce la mette l'add-on
(`src/plance-in-casa.js`) scrivendo la cartina in `www/gdahome/` — l'unica cosa
che scrive nella cartella di Home Assistant.

### Le foto: due cartelle

|                    | dove sta                      | cosa si può fare   | indirizzo                       |
| ------------------ | ----------------------------- | ------------------ | ------------------------------- |
| **l'add-on**       | `/data/www`                   | leggere e caricare | `/dashboardmodern_static/www/…` |
| **Home Assistant** | `config/www`, in sola lettura | solo leggere       | `/local/…`                      |

La seconda è quella che serviva davvero: chi ha una casa da qualche anno ha lì
dentro le foto delle auto, i loghi e gli sfondi, e la plancia li chiama
`/local/…` da sempre. Si legge e non si scrive: in quella cartella ci sono le
automazioni, i temi e i segreti di chi ci abita, e un add-on che ci lascia
dentro file è un add-on che, il giorno che si disinstalla, lascia sporco in casa
d'altri.

### Cosa finisce sul disco

`/data/dispositivi.json` con l'**impronta** di ogni segno, mai il segno;
`/data/plancia.json` con la configurazione delle plance; `/data/plance.json` con
l'elenco; `/data/segnalazioni.json` con una copia di quello che hai scritto,
così l'app mostra subito qualcosa anche quando il centralino è lento. L'ora
dell'ultima visita di un telefono si scrive al massimo ogni cinque minuti: un
telefono collegato fa passare messaggi in continuazione, e scriverla ogni volta
vorrebbe dire scrivere sulla scheda SD di un Raspberry qualche volta al secondo.

### Le prove

```bash
cd ponte
npm test
```

Girano senza rete e senza Home Assistant: c'è una Home Assistant finta che fa la
stretta di mano vera, un telefono finto che è il WebSocket cliente di Node, e in
mezzo l'add-on vero. Non c'è niente da installare — `npm install` non serve,
dipendenze non ce ne sono: la presa WebSocket è scritta in `src/presa.js`, e il
resto viene da Node.
