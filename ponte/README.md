# Il ponte

L'add-on che fa parlare l'app di DashboardModern con questa casa — da dentro e
da fuori — senza che nessun segreto di Home Assistant finisca sul telefono.

## Il problema che risolve

Un'app sul telefono deve entrare in Home Assistant. Le due strade classiche
sono tutte e due sbagliate per un'app che si distribuisce a qualcuno che non
sia se stessi:

* **Un segno lungo incollato a mano.** Vive anni, vale tutto, e per revocarlo
  bisogna sapere quale dei sette in elenco era quello del telefono perso.
* **L'autenticazione di Home Assistant dentro l'app.** Funziona, ma il telefono
  si ritrova in mano un segno di aggiornamento vero, e da fuori casa serve
  comunque che qualcuno lo faccia arrivare a Home Assistant.

Il ponte prende una terza strada. Il telefono riceve **un segno suo**, che vale
solo per questo ponte e per questa casa. Il segno di Home Assistant resta
nell'add-on e non esce mai.

```
   telefono                    il ponte                Home Assistant
      │                    ┌──────────────┐
      │   segno del ponte  │              │  SUPERVISOR_TOKEN
      ├───────────────────►│  porta 8098  ├──────────────────────►
      │                    │              │
      │                    │  ingress ────┼── la console, dietro
      │                    │              │   l'autenticazione di HA
      │                    └──────────────┘
```

## Le due porte, che sono tutta la sicurezza

| | dove arriva | cosa si puo' fare |
|---|---|---|
| **ingress** | solo da Home Assistant, che ci mette davanti la sua autenticazione | fabbricare un codice di abbinamento, vedere i telefoni, staccarli, aprire gdahome in un browser |
| **8098** | l'unica che puo' finire esposta | chiedere se il ponte e' vivo, presentare un codice, aprire il filo con un segno gia' avuto |

Un codice di abbinamento **nasce solo dalla console**. Sulla porta esposta non
c'e' nessuna via per farne nascere uno: da li' si puo' soltanto presentarne uno
che esiste gia'. E' la differenza fra un ponte e una porta aperta.

## Come si mette su

Dal negozio di Home Assistant, come qualunque altro add-on:

1. **Impostazioni → Add-on → Negozio degli add-on**, i tre puntini in alto a
   destra → **Archivi**.
2. Si incolla `https://github.com/danigio15/gdahomeapp` e si preme
   **Aggiungi**.
3. Compare una sezione **gdahome** con dentro **Il ponte**. Si installa.

La prima volta ci mette qualche minuto: il Supervisor se lo **costruisce sul
posto** dal `Dockerfile` invece di scaricare un'immagine gia' pronta. E' anche
il motivo per cui non c'e' niente da fidarsi: quello che gira in casa e' fatto
dai file che si leggono qui.

Da li' in poi gli aggiornamenti arrivano dal negozio, e nella scheda
dell'add-on compare **Aggiorna** quando c'e' una versione nuova. Il bottone
dentro la console — quello che il ponte usa per portarsi dentro i file da se' —
in questo caso **non si mostra affatto**: serviva a chi tiene l'add-on come
copia locale, dove nessun negozio glielo dice.

**A mano**, per chi vuole tenersene una copia sua o lavorarci sopra: si copia
la cartella `ponte` dentro la cartella `addons` di Home Assistant — con
**Samba share**, **Advanced SSH & Web Terminal** o **Studio Code Server**,
finche' c'e' `addons/ponte/config.yaml` — poi **Negozio degli add-on → i tre
puntini → Ricarica**, e compare una sezione **Local add-ons**. Li' il bottone
nella console c'e', e si porta dentro le versioni nuove da se'.

In tutti e due i casi, alla fine nella barra laterale compare **Il ponte**. E'
la console.

## Abbinare un telefono

Dalla console si preme **Fabbrica un codice**: compare un **quadretto**, che
vale **cinque minuti e una volta sola**. Si apre gdahome sul telefono, lo si
inquadra, e il telefono e' dentro. Da quel momento l'app entra da sola, e nella
console compare col suo nome e con un pallino verde quando e' collegata.

Dentro al quadretto non c'e' solo il codice: c'e' anche **dove sta questa
casa** — a quale centralino chiama, e su quali indirizzi la si trova stando sul
Wi-Fi. E' il motivo per cui inquadrando non si deve battere nient'altro,
nemmeno la prima volta e nemmeno da fuori.

Sotto al quadretto, per chi non puo' inquadrare, ci sono le stesse cose in
lettere: sedici, in quattro gruppi da quattro. Sono sedici e non otto apposta —
otto si indovinano provandole a raffica lontano da qui, e sedici no.

**Stacca** spegne un telefono subito: il filo aperto cade nello stesso istante,
e con quel segno non si rientra piu'.

## Da fuori casa

In casa l'app trova il ponte sulla porta 8098, e basta cosi'.

Da fuori il ponte **chiama lui**: apre un filo verso il centralino di gdahome
e lo tiene aperto, e i telefoni arrivano da quella parte. Non c'e' nessuna
porta da aprire sul router, nessun indirizzo pubblico da avere, nessuna VPN da
installare, e funziona anche a chi non ha ne' un dominio ne' un abbonamento.

**L'indirizzo non si scrive da nessuna parte, e nella scheda dell'add-on non
c'e' nessuna casella per metterlo.** C'era, e stava sempre vuota: l'indirizzo
giusto e' quello scritto nel programma — `src/opzioni.js`, e identico dentro
l'app, tenuti uguali da una prova — e una casella che non va toccata e' una
casella che prima o poi qualcuno tocca: scrivendoci qualcosa di storto, o
congelando per quella casa un indirizzo che il giorno che cambia non cambia
piu'. Dove chiama **questa** casa lo dice la console, nella scheda «Da fuori
casa»: e' la riga da guardare quando qualcosa non torna.

Spegnendo `da_fuori_casa` il ponte non chiama nessuno, e l'app funziona solo
sotto il Wi-Fi di casa. Per chi la casa la guarda dal divano va benissimo.

Chi vuole un **centralino suo** se ne accende uno — sta tutto in
[`../nuvola/README.md`](../nuvola/README.md) — e si tiene una copia locale di
questo add-on, dove quella riga si cambia con
`node strumenti/centralino.mjs <indirizzo>`. E' una cosa da chi sa cos'e' un
centralino, e chi lo sa sa anche cambiare una riga.

Il perche' di questa strada, e le tre che sono state scartate, stanno in
[`../docs/PIANO.md`](../docs/PIANO.md). In due righe: l'accesso remoto di Home
Assistant le porte degli add-on non le fa passare — e non e' cosa che si
configuri — mentre una VPN o un proxy inverso funzionano ma chiedono a chi usa
l'app di installare e configurare qualcosa, che e' esattamente cio' che questo
progetto ha promesso di non chiedere.

## Cosa puo' fare un telefono abbinato

Tutto quello che puo' fare il ponte, cioe' tutto quello che si puo' fare in
Home Assistant. Non c'e' un filtro per tipo di comando, e non c'e' apposta:
un filtro fatto per esclusione lascia sempre fuori qualcosa, e da' l'idea
sbagliata che il telefono sia limitato quando non lo e'.

Quello che c'e' al posto suo e' che un telefono entra **solo** se qualcuno gia'
dentro Home Assistant ha fabbricato un codice negli ultimi cinque minuti, e che
qualunque telefono si stacca da solo con un bottone.

C'e' una cosa che il ponte fa **da se'** per il telefono, senza girarla a
Home Assistant: la plancia. L'app fa girare la plancia vera di DashboardModern
dentro un WebView, e in Home Assistant non c'e' e non deve esserci nessuna
integrazione: i file della plancia stanno qui, in `plancia/` (li porta dentro
`strumenti/porta-la-plancia.mjs` da un checkout di `dashboardmodern-v2`), e
la configurazione la tiene il ponte in `/data/plancia.json`, rispondendo alla
pagina esattamente come risponderebbe l'integrazione
(`dashboardmodern/config/get`, `set`, `restore`: stesse regole contro le
perdite di dati, stesse cinque revisioni tenute). Il telefono chiede tutto sul
filo — `ponte/plancia` per sapere dove sta, `ponte/http` per i file — e le
chiamate REST della pagina, lo storico e le istantanee, passano dal Supervisor
col suo segno. Nient'altro passa di li'. Sta scritto in `src/commissioni.js`,
`src/plancia.js` e `src/configurazione.js`.

Le **segnalazioni** dell'app passano anche loro dal ponte, con
`ponte/segnalazioni/…`: il ponte le porta al centralino — presentandosi col
segreto della casa, lo stesso della chiamata — e il centralino le apre come
issue di GitHub per chi mantiene l'app. Qui non c'e' nessun gettone di
nessuno; una copia di quello che si e' scritto sta in
`/data/segnalazioni.json`, cosi' l'app vede subito qualcosa anche quando il
centralino e' lento. Senza centralino non c'e' dove spedire, e si dice cosi'.
Con `ponte/segnalazioni/allega` passano anche le foto e i video: arrivano
dall'app in base64 dentro il messaggio, e al centralino vanno cosi' come
sono, in binario. Dieci megabyte al massimo.

## Piu' di una plancia

Nella dashboard una seconda plancia e' una seconda **istanza**
dell'integrazione: la si aggiunge da «Dispositivi e servizi», e in Home
Assistant compaiono due voci, ognuna con la sua configurazione. Qui
l'integrazione non c'e', e quel mestiere lo fa il ponte: l'elenco delle plance
sta in `/data/plance.json` (`src/plance.js`), e la configurazione di ognuna nel
suo cassetto dentro `/data/plancia.json` — dove stava gia', per profilo.

Una plancia e' **tre nomi** che fanno tre mestieri: il `profilo`, che e' il
cassetto dove sta la configurazione; il `titolo`, che e' come la chiama chi ci
abita; e l'`istanza`, che e' il nome con cui la pagina tiene separate le proprie
cose nel deposito del browser — il tema, la tavolozza, la barra. Rinominare una
plancia cambia il titolo e non gli altri due, se no le cancellerebbe il lavoro.

La prima c'e' sempre, si chiama «DashboardModern», tiene il profilo `primary` e
non si toglie: chi ha l'add-on da prima non si accorge di niente. Le altre si
aggiungono, si rinominano e si tolgono dalla **scheda dell'add-on** — che sta
dietro l'autenticazione di Home Assistant, come quella pagina di Home Assistant
— o dall'app. Togliendone una va via anche il suo cassetto: se restasse, chi ne
rifacesse una con lo stesso nome si ritroverebbe dentro il lavoro di prima.
Se ne tengono otto.

| | |
|---|---|
| `GET /api/plance` | l'elenco (sta anche dentro `/api/stato`) |
| `POST /api/plance` | `{titolo}` — una in piu' |
| `PATCH /api/plance` | `{profilo, titolo}` — come si chiama |
| `DELETE /api/plance` | `{profilo}` — via lei e il suo cassetto |
| `ponte/plance/elenco` | gli stessi quattro, dall'app |
| `ponte/plance/aggiungi` | `{titolo}` |
| `ponte/plance/rinomina` | `{profilo, titolo}` |
| `ponte/plance/togli` | `{profilo}` |

E `ponte/plancia` accetta un `profilo`: senza, risponde con la prima — che e' la
risposta di sempre — e insieme manda l'elenco, cosi' chi disegna un selettore
non deve chiedere due volte. Nell'app il selettore sta in cima alla barra delle
sezioni, sotto la casa, e c'e' solo per chi ha piu' d'una plancia; la scelta si
ricorda **per casa**, perche' chi ha una plancia al mare e una in citta' non
vuole che cambiando casa gli resti quella di prima.

### E fra le «Plance» di Home Assistant

Nella dashboard ogni istanza registra un pannello suo, e la barra laterale di
Home Assistant ha la sua voce. L'integrazione va dismessa, e allora quel
mestiere lo fa il ponte (`src/plance-in-casa.js`): a ogni avvio, e ogni volta
che le plance cambiano, mette a posto **una Plancia per plancia** —
`gdahome-<profilo>`, col titolo che le ha dato chi ci abita, una vista sola a
pagina intera. Chi apre Home Assistant trova la sua plancia dove l'ha sempre
trovata.

Servono tre pezzi, e servono tutti e tre:

1. la **cartina** `carta/plancia.js`, copiata in `config/www/gdahome/`;
2. quel file **dichiarato a Lovelace** come risorsa, con la versione dell'add-on
   nell'indirizzo — se no il browser si tiene quella di ieri;
3. una **Plancia** per plancia, con dentro la cartina.

La cartina non puo' stare dentro l'add-on, e questo e' il motivo per cui il
ponte chiede di poter scrivere nella cartella di Home Assistant: quel file lo
carica il browser **dentro** la pagina di Home Assistant, e da un add-on non lo
saprebbe prendere — all'ingress serve una sessione, e per chiederla serve del
programma che gira in quella pagina. La cartina chiede la sessione (la stessa
chiamata che fa il frontend di Home Assistant quando apri la scheda di un
add-on), la rinfresca ogni mezzo minuto, chiede al Supervisor dove si entra
adesso — l'indirizzo dell'ingress porta un gettone che Home Assistant puo'
rifare, e una Plancia salvata sei mesi fa ne avrebbe uno morto — e solo dopo
apre il riquadro. Se qualcosa non riesce, lo scrive a schermo invece di lasciare
un rettangolo bianco.

Il permesso e' grosso e va detto chiaro: `homeassistant_config:rw` da' al ponte
tutta la cartella di chi ci abita — automazioni, temi, segreti — perche' Home
Assistant non sa mappare una sottocartella. Quello che il ponte ci scrive sta in
un metodo solo, `doveVaLaCarta`, e una prova
(`test/plance-in-casa.test.js`) elenca tutto quello che compare dentro quella
cartella e lo confronta riga per riga: `www/gdahome/plancia.js` e un
`LEGGIMI.txt` accanto, e niente altro.

Non tocca le Plance di nessun altro: guarda solo quelle il cui indirizzo
comincia per `gdahome-`, che sono le sue. E dove non riesce — Lovelace in
modalita' YAML, dove le Plance non si aggiungono da fuori — lo scrive nel
registro e lascia tutto il resto in piedi: la plancia dall'app e dall'ingress
funziona uguale, e questa e' una comodita' in piu', non la strada.

La stessa pagina si apre anche senza passare da una Plancia, dalla porta
dell'ingress: `plancia/` per la prima, `plancia/<profilo>/` per le altre — e'
il tasto «Apri» accanto a ogni riga nella scheda dell'add-on. La serve il ponte
con le sue premesse (`src/premesse.js`), e il WebSocket che quella pagina apre
torna a lui (`src/cucitura.js`), che risponde da se' alle commissioni e gira
tutto il resto a Home Assistant.

La **chat di assistenza** invece non passa da GitHub, ed e' quella della
plancia: gli otto comandi `dashboardmodern/chat/*` che nell'integrazione fa
`chat.py`, qui li fa `src/chat.js`. I quattro di chi chiede — stato, filo,
manda, dimentica — li ha ogni casa. I quattro di chi risponde — la coda di
tutte le case, aprirne una, rispondere, buttarla via — li ha **una casa sola
al mondo**: quella che nelle opzioni ha scritto `chiave_console`. Dove quella
chiave non c'e', quei quattro rispondono `forbidden` — la porta esiste, e in
quella casa non si apre — e nella finestra dell'assistenza non compare
niente.

Quando c'e', si accendono due cose insieme, senza che nessuno le installi: il
**Cruscotto** della plancia, la scheda con la coda che nella dashboard e' li'
da sempre, e la voce **Console** nel menu dell'app. La chiave non esce dalle
opzioni: bussa il ponte, e al telefono arrivano solo le conversazioni. L'app
usa gli stessi quattro sportelli coi suoi nomi — `ponte/console/coda`,
`/apri`, `/rispondi`, `/butta` — e chiede a `ponte/chat/stato` se quella voce
va disegnata.

Questa casa, per quel centralino, e' un nome di 128 bit e un segreto di 256
presi dal caso alla prima parola scritta, tenuti in `/data/chat.json`: niente
entita', niente indirizzi, nessun identificativo di questo Home Assistant, e
il segreto non esce dal ponte. Insieme alle parole parte un'etichetta di
quaranta caratteri — `plancia 1.4.19 ponte 0.18.0 app 1.0.2` — che e' quello
che chi risponde chiederebbe per primo. L'**app** usa la stessa chat, con
`ponte/chat/leggi` e `ponte/chat/scrivi`; un allegato no, e si dice dove
metterlo.

## Chi parla di piu'

Ogni cambiamento in casa e' un **evento**, e ogni evento arriva a tutti i
telefoni collegati. Una casa che ne fa seicento al minuto — dieci al secondo —
non ha seicento cose che cambiano: ne ha **due o tre** che cambiano di
continuo, un contatore di potenza, un sensore di consumo istantaneo, una presa
che misura i watt; le altre duecento stanno ferme per ore.

Finche' non si sa **quali**, non c'e' niente da fare: si guarda una
diagnostica che dice «seicento eventi» e si tira a indovinare. La scheda
dell'add-on adesso li nomina — le cinque entita' che hanno mandato piu' eventi
nell'ultimo minuto, con la loro fetta del traffico — e da li' il rimedio sta in
Home Assistant e costa un minuto: a quelle due o tre si mette un filtro, o si
tolgono dalla registrazione, e il traffico cala di dieci volte senza toccare
una riga di questo programma.

Contarli costa un'espressione regolare sui primi quattrocento caratteri, e
niente altro (`src/chiacchieroni.js`): il nome dell'entita' sta in testa al
messaggio, e leggere il JSON per intero — su seicento eventi al minuto —
vorrebbe dire fare per misurare il lavoro che si sta misurando. Il ponte gli
eventi non li apre mai, li gira come sono, ed e' per questo che sta dietro a
una casa che parla molto.

## Le opzioni

| | |
|---|---|
| `da_fuori_casa` | acceso: si passa dal centralino di gdahome, e non c'e' niente da scrivere. Spento: solo la rete di casa. L'indirizzo del centralino **non e' un'opzione**, e il perche' sta due sezioni piu' su |
| `porta_app` | la porta su cui bussa l'app (difetto: 8098) |
| `dispositivi_massimi` | quanti telefoni possono restare abbinati insieme (difetto: 10) |
| `minuti_del_codice` | quanto vive un codice di abbinamento (difetto: 5) |
| `giorni_di_silenzio` | dopo quanto un telefono sparito viene tolto da solo; zero vuol dire mai (difetto: 90) |
| `gettone` | **lascialo vuoto**: da quando la repository e' pubblica non serve. Resta per chi tiene una copia privata, dove il bottone della console senza gettone non arriverebbe al manifesto |
| `chiave_console` | la chiave con cui si **risponde** alle chat di tutte le case. Lasciala vuota: serve a una installazione al mondo. E' la stessa messa fra i segreti del centralino |
| `registro` | `debug`, `info`, `attenzione`, `errore` |

## I due sportelli della porta dell'app

| | | |
|---|---|---|
| `GET /salute` | — | dice solo che e' vivo |
| `POST /abbinamento` | un codice valido | `{"codice":"…","nome":"…","sistema":"ios"}` → il segno, una volta sola |
| `WS /casa` | il segno | la stretta di mano di Home Assistant, e poi il filo |

Chi si abbina riceve **quattro cose**, e servono tutte e quattro:

| | |
|---|---|
| `segno` | fa entrare. Qui ne resta solo l'impronta: chi ruba il file non entra |
| `chiave` | cifra il filo. Questa resta com'e', perche' per cifrare serve la chiave |
| `dispositivo` | il nome e l'identificativo del telefono, per la console |
| `ritorno` | **dove ribussare domani** |

`ritorno` e' il motivo per cui l'utente non batte nessun indirizzo: dice
l'identificativo di questa casa al centralino, l'indirizzo del centralino, e
gli indirizzi su cui questa casa si trova sulla rete locale — cosi' il
telefono, quando e' sul divano, va dritto invece di fare il giro del mondo.

Gli indirizzi di rete locale il ponte li chiede al Supervisor, ed e' l'unica
cosa per cui serve `hassio_api`. Se non arrivano — permesso tolto, Supervisor
vecchio, prova su un computer — si perde la strada veloce e non altro: si
passa sempre dal centralino, che e' piu' lento e funziona uguale.

Sul filo il ponte **si presenta come Home Assistant**: manda `auth_required`,
aspetta `auth` col segno del ponte al posto di quello di Home Assistant, e
risponde `auth_ok`. Da li' in poi non guarda piu' dentro a niente. Vuol dire che
qualunque codice che sa parlare con Home Assistant funziona di qui senza
cambiare una riga.

## gdahome da aprire in un browser

Sulla porta dell'ingress, sotto `/app/`, il ponte serve **gdahome**: la stessa
app del telefono, compilata per il browser. Dalla console c'e' il bottone che la
apre.

E' il link che mancava: chi ha l'add-on acceso ha gia' l'app, e non deve
installare niente da nessuna parte. Sta dietro l'ingress, quindi ci arriva solo
chi e' gia' entrato in Home Assistant — nessuna porta nuova, niente che si veda
da fuori.

I file stanno in `ponte/app/`, e ce li mette `strumenti/porta-l-app.mjs` da un
`flutter build web`. Senza quella cartella il ponte risponde che l'app non c'e'
e la console non mostra il bottone: un link che porta a un 404 e' peggio di
nessun link.

Una cosa da dire, perche' sembra un difetto e non lo e': se Home Assistant e'
aperta su un indirizzo `http`, **la plancia dentro l'app web non si disegna**.
La serve un service worker, e i service worker i browser li fanno girare solo su
`https` o `localhost`. Tutto il resto dell'app funziona, e sia la console sia
l'app lo dicono a schermo. Sul telefono non succede: li' il server sta dentro
l'app.

## Le foto: due cartelle

Quando si sceglie una foto — quella dell'auto, il ritratto di un
elettrodomestico — se ne guardano due:

| | dove sta | cosa si puo' fare | indirizzo che si scrive |
|---|---|---|---|
| **il ponte** | `/data/www` dell'add-on | leggere e caricare | `/dashboardmodern_static/www/…` |
| **Home Assistant** | `config/www`, montata in sola lettura | solo leggere | `/local/…` |

La seconda e' quella che serviva davvero: chi ha una casa da qualche anno ha li'
dentro le foto delle auto, i loghi e gli sfondi, e la plancia li chiama
`/local/…` da sempre. Senza, la maschera delle foto diceva «nessuna foto,
ancora» a chi ne aveva duecento.

Si legge e non si scrive, e non e' prudenza generica: in quella cartella ci
sono le automazioni, i temi e i segreti di chi ci abita. Un add-on che ci
lascia dentro file e' un add-on che, il giorno che si disinstalla, lascia
sporco in casa d'altri. Quello che si carica dall'app finisce nella cartella
del ponte, sempre.

`/local/…` lo serve il ponte anche alla plancia dentro l'app, dove Home
Assistant non c'e' a servirlo: cosi' una configurazione fatta dall'app mostra la
stessa foto anche nella plancia dentro Home Assistant, e viceversa.

Serve `map: [homeassistant_config:ro]` nel manifesto: un add-on aggiornato ma
non riavviato quella cartella non la vede ancora, e allora quella meta' della
maschera semplicemente non compare.

## Cosa finisce sul disco

Solo `/data/dispositivi.json`, e dentro c'e' l'**impronta** di ogni segno, mai
il segno. Chi legge quel file — o un backup dimenticato in giro — non entra in
casa di nessuno.

L'ora dell'ultima visita si scrive al massimo ogni cinque minuti: un telefono
collegato fa passare messaggi in continuazione, e scriverla ogni volta vorrebbe
dire scrivere sulla scheda SD di un Raspberry qualche volta al secondo.

## Le prove

```bash
cd ponte
npm test
```

Girano senza rete e senza Home Assistant: c'e' una Home Assistant finta che fa
la stretta di mano vera, un telefono finto che e' il WebSocket cliente di Node,
e in mezzo il ponte vero. Duecentoventinove prove, qualche secondo.

Le due che guardano `ponte/app/` si saltano da sole quando quella cartella non
c'e': chi lavora sul ponte non ha per forza un'app costruita sotto mano, e un
rosso li' insegnerebbe soltanto a non guardare i rossi.

Non c'e' niente da installare — `npm install` non serve, il ponte non ha
dipendenze: la presa WebSocket e' scritta in `src/presa.js`, e il resto viene
da Node.
