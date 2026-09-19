# Il quadro

Il quadro elettrico e il quadro della situazione sono la stessa parola, e per
chi installa impianti è la sua.

**Dove siamo: fatto tutto.** Il ponte spedisce il suo rapporto — spento di
serie, e si legge per intero dalla console dell'add-on. Il quadro gira, con più
installatori sopra che fra loro non si vedono, la pagina di chi lo gestisce, e
l'avviso quando una casa tace. C'è anche `accendi.sh`, che lo mette in piedi su
una macchina vera.

Sessantacinque prove qui dentro; il progetto intero ne conta più di settecento.
Per accenderlo, [qui sotto](#accenderlo). Manca solo il record DNS.

## A cosa serve

Un installatore mette gdahome in quaranta case. Dopo la consegna non ci torna
più, e quello che succede lì dentro non lo sa nessuno: il Wi-Fi che cambia, la
presa Zigbee che sparisce, Home Assistant fermo a sei mesi fa, il backup che
non gira dal giorno dell'installazione. Se ne accorge quando squilla il
telefono, cioè quando il cliente è già arrabbiato.

Il quadro risponde a una domanda sola: **quell'impianto, adesso, come sta?**
Dieci controlli per casa — verde quello che va, rosso quello che non va,
spento quello che la casa non dice — guardati tutti i giorni.

C'era anche una seconda domanda, «l'ho finito bene?», con sopra tutta una
cerimonia: una casa restava «in collaudo» finché non erano tutte verdi, si
«consegnava» una volta sola, e da allora quelle righe «si riaprivano». Non
l'aveva chiesta nessuno, e si vedeva: una casa appena abbinata veniva
archiviata come lavoro non finito perché aveva due batterie scariche. È stata
tolta — i dieci controlli sono rimasti quelli.

## Dove sta

**Uno solo, su una macchina di gdahome.** Chi installa non accende niente, non
compra nessun dominio e non tiene su nessun server: lo si aggiunge, gli si
dà una chiave, e apre una pagina. Dentro ci stanno le case di installatori diversi, e
ognuno vede solo le sue.

Il ponte gli parla **diritto**, in HTTPS, all'indirizzo scritto dentro l'add-on
(`ponte/src/rapporto.js`, `QUADRO_DI_DIFETTO`) — come già fa col centralino, e
per lo stesso motivo: una casella che non va toccata è una casella che prima o
poi qualcuno tocca.

### Come ci si è arrivati, e cosa è caduto per strada

Le prime stesure lo davano **auto-ospitato**: ogni installatore il suo quadro,
sul suo dominio. Era una scelta di privacy — le case che quel quadro guarda sono
clienti suoi, e il contratto ce l'ha lui — e si portava dietro due conseguenze
che non si vedevano subito.

La prima: **un limite al numero di impianti non si poteva imporre.** Quel programma
girava su ferro dell'installatore, e un contatore lì dentro si toglie in trenta
secondi. Ci si era inventati una firma da verificare nel ponte — un *tesserino*,
in `albo/README.md` — che era il meglio ottenibile, e restava un dosso, non una
serratura.

La seconda, più semplice: **all'installatore toccava lavoro.** Un VPS, un
dominio, un HTTPS, gli aggiornamenti. Per uno che monta impianti è fatica che
non gli compete.

Ospitandolo qui cadono tutte e due. Il limite è un numero su una macchina di chi
lo decide: chi è al limite non genera il codice successivo, e non c'è niente da
aggirare perché non c'è niente da eseguire in casa d'altri. E all'installatore
non resta niente da fare.

**In cambio si paga una cosa, e va detta.** Il nome che l'installatore dà a una
casa — «Rossi — via Verdi 12» — sta su questo server, e quello è un dato che
nomina una persona e un indirizzo. Chi tiene il quadro ne diventa custode. Per
questo il retro di chi lo gestisce vede **quanti** impianti ha ognuno e non **quali**:
il numero serve alle licenze, l'elenco dei clienti di un'altra azienda no. C'è una
prova che controlla che in quella risposta non finiscano nomi.

Non sta invece **dentro** il centralino, e non è una questione di fatica: quello
instrada e non capisce, e c'è una prova che guarda cosa lo attraversa. Può stare
sulla stessa macchina — è un altro processo e un'altra porta — ma non nello
stesso programma.

Non sta nemmeno solo nell'app, e per un motivo pratico: un cruscotto che vive
in un telefono dice che una casa è giù **quando lo apri**. Il mestiere del
quadro è accorgersene mentre nessuno guarda.

## Accenderlo

Quattro passi, in quest'ordine. Il primo non si può saltare: senza il nome che
risolve, Caddy non riesce a prendere il certificato e lo script si ferma a metà.

### 1 · Il record DNS

La zona di `gdahome.org` la servono i nameserver di **Cloudflare**
(`carmelo.ns.cloudflare.com`, `maya.ns.cloudflare.com`), e lì va messo il
record — non dal registrar, che il DNS non lo tiene lui.

*dash.cloudflare.com* → `gdahome.org` → **DNS** → **Record** → **Aggiungi
record**:

| Tipo | Nome | Indirizzo IPv4 | Stato proxy | TTL |
|---|---|---|---|---|
| `A` | `quadro` | `185.213.27.137` | **Solo DNS** | `Automatico` |

È lo stesso indirizzo di `tramite`, `webapp` e del sito: una macchina sola, e
Caddy smista per nome.

> **Lo «Stato proxy» va messo su «Solo DNS» — la nuvola grigia.** È l'unica
> cosa in quella schermata che si può sbagliare senza accorgersene, perché
> Cloudflare parte **arancione** (*Con proxy*) e va spento a mano ogni volta.
>
> Arancione vuol dire che Cloudflare si mette in mezzo, e il certificato — che
> se lo prende Caddy su questa macchina, parlando con Let's Encrypt — non
> arriva: lo script si ferma con un errore che parla di ACME, e uno va a
> cercare il guasto dove non è.
>
> Non è una cosa da decidere: **è già così per tutti gli altri.** Nella tabella,
> `gdahome.org`, `tramite`, `webapp` e `www` dicono tutti «Solo DNS». Si vede
> anche da fuori senza aprire il pannello: rispondono `185.213.27.137`, che è
> questa macchina, e non un indirizzo di Cloudflare (`104.…`, `172.6…`,
> `188.114.…`). `quadro` va messo uguale agli altri.

Gli `MX` verso `eforward…registrar-servers.com` e il `TXT` con l'`SPF` sono la
posta del dominio, e non c'entrano niente con questo: non si toccano.

Si controlla da qualunque macchina, anche da quella dove si sta leggendo:

```
getent ahostsv4 quadro.gdahome.org
```

Deve rispondere `185.213.27.137`. Se non risponde, si aspetta: un record nuovo
gira in pochi minuti, ma può metterci di più.

### 2 · La macchina

> **Prima: il codice deve stare dove lo script lo va a prendere.** Sono due
> posti, e li sbaglia chi non li conosce:
>
> - la riga qui sotto scarica `accendi.sh` dal **ramo di difetto** della
>   repository, cioè `main`;
> - lo script poi si tira giù il quadro dal **segno `tramite`** (`SEGNO` in
>   cima al file), lo stesso che segue il tramite, perché su `main` si spinge
>   dieci volte al giorno e una macchina che seguisse `main` si riavvierebbe
>   dieci volte al giorno, ogni tanto su un commit scritto a metà.
>
> Finché `quadro/` sta solo su un ramo di lavoro, la prima riga risponde `404`
> e la seconda dice *«nel pacchetto non c'è il quadro»*. Si sistema una volta
> sola: il ramo si porta su `main`, e il segno `tramite` si sposta lì sopra.
>
> Per provarlo **prima** di tutto questo si può puntare le due cose al ramo,
> aggiungendo `?ref=<ramo>` all'indirizzo e `SEGNO_DEL_QUADRO=<ramo>` davanti a
> `bash`. Va bene per una prova, non per lasciarlo così: quel quadro si
> aggiornerebbe a ogni spinta su un ramo di lavoro.

Da `root`, sulla macchina dove gira già il tramite. Prima **senza installare
niente**, per vedere se quadra tutto:

```
read -rsp 'gettone: ' G && echo && curl -fsSL \
  --config <(printf 'header = "Authorization: Bearer %s"\n' "$G") \
  -H 'Accept: application/vnd.github.raw' \
  https://api.github.com/repos/danigio15/gdahomeapp/contents/quadro/accendi.sh \
  | GETTONE_LETTURA="$G" bash -s -- --controlla
```

Se dice che quadra tutto, si rilancia la stessa riga **senza** `--controlla` e
il quadro va su.

Il gettone è quello di lettura della repository — lo stesso del tramite. Si
batte al prompt e non finisce né nella riga di comando né nella cronologia
della shell.

**Alla fine stampa la chiave di gestione.** Si vede quella volta e mai più: va
nel gestore di password prima di chiudere il terminale. Se sfugge, si rilegge
sulla macchina:

```
sed -n 's/^QUADRO_GESTORE=//p' /etc/quadro/ambiente
```

### 3 · Controllare che sia in piedi

```
curl https://quadro.gdahome.org/salute
```

Risponde `{"vivo":true,"case":0,"installatori":0,"gestore":true}`. Le tre cose
da guardare in quella riga:

| | |
|---|---|
| `vivo` | il quadro risponde |
| `gestore` | la chiave c'è, e la pagina di gestione si apre. Se è `false`, lo script non l'ha scritta e non si può aggiungere nessuno |
| `installatori` | quanti ce ne sono. A questo punto zero |

E una quarta che **quasi sempre non c'è**, ed è la più importante quando c'è:

| | |
|---|---|
| `nonMiAggiorno` | il quadro non riesce più a sapere quale versione c'è. Dice **da quando** e **perché** |

Quel campo compare solo dopo **un'ora** di tentativi andati a vuoto — sei giri
di fila. Un tentativo storto non vuol dire niente, e un avviso che si accende da
solo una volta a settimana dopo un mese non lo guarda più nessuno.

Prima quel guasto non lo diceva nessuno, ed è il peggiore che questo pezzo
possa avere: somiglia in tutto allo stare bene. Il quadro risponde, le case
depositano, le pagine si aprono — e le correzioni hanno smesso di arrivare
settimane fa. Te ne accorgi il giorno che serve una correzione.

> **Quella metà arriva solo rilanciando `accendi.sh`.** Il giro degli
> aggiornamenti scambia il **codice** del quadro e non tocca gli script che gli
> stanno di fianco — voluto: un aggiornamento che si porta via chi lo sta
> eseguendo non finisce. Quindi la parte che *legge* il foglietto arriva da
> sola, quella che lo *scrive* no. Una volta sola, e poi va.

Se non risponde da fuori ma risponde da dentro (`curl 127.0.0.1:8100/salute`),
è il certificato: Caddy lo prende al primo che bussa, e il primo giro può
metterci un minuto.

Quando qualcosa non va, i tre posti dove guardare:

```
journalctl -u quadro -n 50 --no-pager      il quadro
journalctl -u caddy  -n 30 --no-pager      il certificato
caddy validate --config /etc/caddy/Caddyfile
```

### 4 · Il primo installatore

Si apre `https://quadro.gdahome.org/gestore/`, si incolla la chiave di
gestione, e da lì si aggiunge. Oppure da riga di comando, che è la stessa cosa:

vedi [Aggiungere un installatore](#aggiungere-un-installatore) qui sotto.

### Quello che lo script fa, e che vale la pena sapere

`accendi.sh` installa Node e Caddy se non ci sono, scarica il quadro e **lo
prova prima di metterlo** — se le prove di quella versione non passano, non
tocca quello che c'era — lo accende come servizio, prende il certificato, e
accende il giro che lo tiene aggiornato da solo ogni dieci minuti.

- **Non riscrive il Caddyfile del tramite: ci mette un innesto** in
  `/etc/caddy/conf.d/`. Il tramite il suo file lo riscrive tutto a ogni giro, e
  due script che scrivono lo stesso file si spengono a vicenda — a sparire
  sarebbe il quadro, cioè quello che nessuno sta guardando. C'è una prova che
  tiene tutte e due le metà: che questo non lo riscriva, e che quello del
  tramite legga gli innesti.
- **Rilanciarlo non porta via niente.** La chiave di gestione, se c'è già,
  resta quella: rifarla a ogni giro vuol dire chiudere fuori chi tiene il
  quadro, e con lui tutti gli installatori che avrebbe dovuto aggiungere. E il
  gettone di lettura non lo richiede nemmeno, se il tramite è già lì: è la
  stessa repository.

### Sul banco, senza installare niente

```
cd quadro
QUADRO_GESTORE='qualcosa di lungo e a caso' npm run avvia
```

| | |
|---|---|
| `QUADRO_GESTORE` | la chiave di **gestione**, almeno sedici caratteri: aggiunge gli installatori e mette i limiti. Senza, non si può aggiungere nessuno — le case già abbinate continuano a depositare, e il quadro lo dice all'accensione e su `/salute` |
| `QUADRO_PORTA` | `8100` |
| `QUADRO_DATI` | dove tiene i suoi file, `./dati` |
| `QUADRO_REGISTRO` | quanto parla: `debug`, `info`, `attenzione`, `errore` |

> **`quadro.gdahome.org` deve risolvere prima di rilasciare l'add-on.** Quel
> nome sta scritto dentro il ponte (`QUADRO_DI_DIFETTO` in
> `ponte/src/rapporto.js`), e una volta uscita una versione quella riga sta in
> ogni casa: cambiarla dopo vuol dire un'altra versione e aspettare che tutte
> si aggiornino. Una casa che non trova il quadro non si rompe — rallenta i
> tentativi e scrive nella sua console *perché* non ci riesce — ma è un giro di
> telefonate che si evita controllando un nome.


### Aggiungere un installatore

Dalla pagina di gestione, o da riga di comando:

```
curl -X POST https://quadro.gdahome.org/gestore/installatori \
  -H "authorization: Bearer $QUADRO_GESTORE" \
  -H "content-type: application/json" \
  -d '{"nome": "Impianti Rossi", "soglia": 40}'
```

Risponde con la sua **chiave, in chiaro e una volta sola**: quella si consegna
all'installatore, e qui resta solo l'impronta. Se si perde si rifà
(`POST /gestore/installatore/<id>/chiave`), non si recupera — e la vecchia
smette di aprire nello stesso istante.

`soglia: 0` vuol dire nessun limite.

### E l'installatore cosa fa

Apre `https://quadro.gdahome.org/console/`, incolla la sua chiave — la pagina se
la tiene nel browser, non sta in nessun indirizzo — e vede i suoi impianti. Per
farne entrare uno: **Abbina** gli dà un codice che vive **un giorno**, e quel
codice si incolla nella casella `quadro` della scheda dell'add-on in casa del
cliente. Nient'altro: niente indirizzo, niente server, niente dominio.

Un giorno e non un quarto d'ora perché quel codice, quasi sempre, non lo
incolla chi lo genera: lo manda a chi ci abita, che lo farà stasera. E perché
chi lo intercettasse non aprirebbe niente — non è una porta, è il permesso di
*depositare* righe di numeri in una lista, e si stacca con un tasto.

Il primo rapporto lega il codice a quella matricola, e da lì in poi non serve a
nessun'altra casa — e la casa è **sua**, cioè compare nella sua pagina e in
nessun'altra.

### Quando un installatore si toglie

**I suoi impianti restano.** Sono impianti che funzionano in casa di qualcuno, e
spegnerne il monitoraggio perché un installatore ha smesso di pagare punirebbe il
cliente per una faccenda che non è sua: i loro rapporti continuano ad
arrivare. Quello che smette è la sua chiave, che da quel momento non apre più niente.

Restano però **contate a parte**: `GET /gestore/installatori` porta un `orfane`,
se no il totale non tornerebbe con la somma degli installatori e non si capirebbe
perché. E il giorno che lo si riaggiunge, tornano a lui.

### Quando una casa tace

Il quadro scrive all'installatore quando un impianto smette di parlare, e di
nuovo quando riprende. Mette un `POST` a un indirizzo suo — un bot di Telegram,
Slack, ntfy, il suo gestionale — con dentro `{ testo, tipo, case, quadro }`.

Niente posta elettronica, e non per pigrizia: mandare una mail che arrivi
davvero vuol dire SMTP, TLS, SPF, DKIM e una reputazione da difendere, e il
primo avviso che finisce nello spam è un avviso che non è mai esistito. Chi
vuole la mail ci mette davanti tre righe sue.

**La parte difficile non è accorgersene: è tacere.** Un avviso che squilla a
ogni riavvio di Home Assistant si silenzia in una settimana, e da quel momento
non avvisa più di niente. Quindi ci sono quattro regole che servono a **non**
mandare niente, e una sola che manda:

| | |
|---|---|
| **due ore, non tre quarti d'ora** | la pagina colora «muta» dopo tre rapporti saltati, e va bene per un colore su uno schermo che si sta già guardando. Un messaggio che arriva addosso vuole più pazienza: un riavvio, un aggiornamento e un router che si riaccende ci stanno dentro. Il colore è per chi guarda, il messaggio per chi non sta guardando |
| **una volta sola** | una casa muta da tre giorni è una notizia, non una al giorno |
| **se tacciono in tanti insieme** | otto su dodici non sono otto guasti: è un guasto. Un messaggio solo, che dice di guardare prima più in grande |
| **se siamo stati via noi** | è la regola che nessuno scrive e che poi si paga. Se il quadro è stato fermo tre ore, al ritorno *tutte* le case sembrano mute perché nessuno era in ascolto. Il giro si ricorda quando è passato: se il buco è più grande del silenzio che cerca, quel giro non dice niente e riparte dal prossimo |

E il segno di «questa l'ho già detta» si scrive **dopo** la consegna, e solo se è
riuscita: scriverlo prima vorrebbe dire che un indirizzo sbagliato per mezz'ora
si mangia per sempre gli avvisi di quella mezz'ora.

### Il limite

Gli inviti aperti contano come impianti: senza quella riga si fanno venti codici
in un minuto stando sotto il limite, e il giorno dopo ci sono venti case oltre,
tutte legittime. Chi è al limite vede il tasto spento e il perché scritto sopra,
invece di scoprirlo da un rifiuto col cliente che aspetta.

## Cosa vede l'installatore

Si apre su un numero solo — **quante case gli chiedono qualcosa adesso** — e
sotto l'elenco. Ogni riga è una casa: stato, nome, da quanto non parla, le spie
accese, e la striscia dei quattordici giorni con i buchi in rosso.

Aprendo una casa:

| | |
|---|---|
| **L'impianto** | matricola, installata il, ogni quanto manda, telefoni abbinati e quanti visti in 7 giorni |
| **I controlli** | dieci, e ognuno è un nome e basta — «I collegamenti», non «Sono collegati tutti»: la plancia · i telefoni · da fuori casa · i collegamenti · gli aggiornamenti · gli add-on · la rete · la macchina · il backup · le batterie. Il nome dice di cosa si parla, il numero a destra come sta, il bollino se va bene: ✓ verde, ✗ rosso, ◇ questa casa non lo dice |
| **La macchina** | la scheda (ODROID-N2+, ODROID-M1, un NUC…), CPU, memoria, disco e quanto resta, temperatura **con la tacca a 75°**, **la vita già consumata del disco**, da quanti giorni è accesa |
| **La rete** | internet sì o no, ogni scheda con su/giù, cavo o Wi-Fi, quale è la principale, il segnale, l'indirizzo sulla rete di casa — e gli apparati sorvegliati (il router, i ripetitori) con quanti non rispondono |
| **Gli add-on** | tutti, uno per pastiglia: acceso, **fermo** (parte all'avvio e non gira) o spento a mano |
| **La salute** | la striscia dei giorni, quante entità e quante non rispondono, batterie sotto soglia e la più bassa, ultimo backup, errori nel registro, da quanti giorni il collegamento da fuori non si riavvia |
| **I dispositivi non collegati** | i loro nomi, fino a dodici (sotto c'è perché, e perché è cambiato) |
| **Gli aggiornamenti** | cosa c'è da installare, da quale versione a quale, e **il tasto per farlo** dove quella casa ha aperto la manutenzione |
| **Le versioni** | gdahome, la plancia, Home Assistant Core, Supervisor, il sistema — con «c'è la nuova» dove c'è |
| **Il rapporto** | il testo grezzo, come è arrivato |

### Le tre domande che la macchina risponde da sola

**La vita del disco è la riga che nessuno guarda e che conta di più.** Su un
ODROID Home Assistant scrive tutto il giorno su una eMMC o una microSD, e
quelle hanno un numero di scritture e poi finiscono. Il Supervisor dichiara
`disk_life_time`, cioè la percentuale già spesa: vederla salire vuol dire
cambiare il supporto quando decidi tu, invece di scoprirlo il giorno che il
cliente ha perso tutto. Dove non c'è — un NUC con un SSD — non si inventa.

**La tacca a 75° non è un numero scelto qui:** è quella che la plancia disegna
già sull'arco della temperatura del MiniPC, ed è dove un ODROID comincia a
rallentarsi da solo. Sopra, la casa non si rompe: diventa lenta, e nessuno
capisce perché.

**Un add-on fermo non è un add-on spento.** Conta solo chi **parte all'avvio**
ed è giù: nessuno spegne un add-on lasciandogli l'avvio automatico, quindi
quello si è fermato da solo. Uno messo a mano e lasciato fermo è una scelta di
chi ci abita, e dirglielo ogni quarto d'ora insegna a non guardare più.

### Gli stati, e perché hanno una forma

Tre: **● a posto**, **▲ da guardare**, **■ muta**. Muta batte tutto — di una
casa che non parla non si sa niente, nemmeno che sta bene.

Ce n'era un quarto, **◇ collaudo aperto**, e teneva in una fila sua le case in
cui un controllo era rosso e nessuno aveva ancora dichiarato finito l'impianto.
È andato via col collaudo: non diceva niente che «da guardare» non dicesse già,
e archiviava come lavoro non finito una casa che funzionava. Le tre cose che
teneva d'occhio solo lui — plancia vuota, nessun telefono abbinato, il
collegamento da fuori giù — sono passate fra i guai che fanno «da guardare», se
no una casa con la plancia vuota sarebbe risultata a posto mentre nella sua
scheda c'era una riga rossa.

Ogni stato porta **una forma, una parola e un colore**, e non il colore da
solo. Non è prudenza generica: misurando la tavolozza del progetto, `--ottone`
e `--allarme` distano 1.7 per chi non distingue il rosso dal verde, e 9.1 per
chi li distingue tutti — sotto la soglia in tutti e due i casi. Su una pagina
che serve a separare a colpo d'occhio le case ambra dalle rosse, il pallino da
solo non porta il significato. Le forme e le parole sì.

## Il rapporto

Quello che una casa manda, ogni quindici minuti. Ci sono **numeri e versioni**,
e nient'altro.

```json
{
  "casa": "casa_a3f19c74e05b2d8890fa4c1e6b73d052",
  "quando": "2026-09-18T09:41:12Z",
  "ogni": 15,
  "ponte": "1.4.32.14",
  "plancia": "1.4.32",
  "ha": "2026.9.1",
  "supervisor": "2026.08.3",
  "sistema": "Home Assistant OS 14.2",
  "macchina": {
    "scheda": "ODROID-N2+", "cpu": 14, "ram": 38,
    "disco": 46, "discoLiberi": 17.2,
    "temperatura": 46, "discoVita": 11, "accesaDa": 41
  },
  "rete": {
    "internet": true,
    "schede": [
      { "nome": "eth0", "tipo": "ethernet", "su": true, "principale": true, "ip": "192.168.1.50" },
      { "nome": "wlan0", "tipo": "wifi", "su": false, "principale": false, "ip": "", "segnale": null }
    ],
    "sorvegliate": { "quante": 3, "giu": 0 }
  },
  "addon": {
    "quanti": 8, "accesi": 8, "spentiCheDovrebbero": 0,
    "elenco": [{ "nome": "Mosquitto broker", "su": true, "allAvvio": true, "aggiornabile": false }]
  },
  "aggiornamenti": { "quanti": 0, "ha": false, "addon": 0, "gdahome": false, "firmware": 0 },
  "plance": { "quante": 3, "configurate": 3 },
  "telefoni": { "abbinati": 2, "visti7gg": 2 },
  "fuori": { "acceso": true, "filo": true, "daGiorni": 41 },
  "entita": { "totali": 214, "giu": 5, "dispositivi": 3, "nomi": ["Termostato bagno", "Presa garage", "Sensore porta"] },
  "batterie": { "sotto20": 0, "piuBassa": 47 },
  "backup": { "giorniFa": 2 },
  "registro": { "errori24h": 0 }
}
```

**Cosa non c'è, e non ci deve andare:** nomi di entità, nomi di stanze, nomi di
persone, stati di sensori, **l'SSID del Wi-Fi**, **l'indirizzo pubblico**,
posizione, foto, la configurazione della plancia, il contenuto delle
segnalazioni. Il quadro dice **che c'è da guardare**, e finisce lì: guardare
dentro casa è un'altra cosa, e non si fa da qui (vedi «Cosa il quadro non può
fare»).

La regola si dice meglio così: **cosa c'è nella scatola, non chi ci abita.**
«Mosquitto broker» ed `eth0` sono nomi di prodotti e di schede, e non dicono
niente di nessuno. L'SSID sì — una rete che si chiama «Casa Rossi» è una
persona — e resta fuori.

**L'indirizzo sulla rete di casa invece c'è, ed è un cambio voluto** rispetto a
come stava scritto prima. `192.168.1.50` non identifica nessuno, e a chi ripara
queste macchine serve davvero: «la scatola ha cambiato indirizzo» è metà delle
telefonate. L'indirizzo pubblico è un'altra cosa — quello dice dove abiti — e
non esce.

**I nomi dei dispositivi che non rispondono, e perché ci sono.** Qui la
promessa è cambiata, alla prova sul campo e con il consenso di chi tiene il
quadro. Prima viaggiavano quattro cifre — `sha256(sale_di_casa + entity_id)`
accorciato — in modo che il quadro potesse dire «è lo stesso di ieri» senza
poter dire quale. Sullo schermo faceva questo:

    ▲ Sono collegati tutti          #7c2a #91ff #04be

cioè chiedeva a chi ripara di uscire di casa, guidare, e scoprire sul posto
cos'era `#7c2a`. Un cruscotto che nasconde il dato a **chi ha montato
l'impianto** non protegge nessuno: protegge sé stesso, e scarica il lavoro
sul cliente.

Adesso viaggiano i **nomi** — al massimo dodici, e **solo di quelli che non
rispondono**. La regola è stretta, ed è scritta anche nelle prove del ponte
(`ponte/test/rapporto.test.js`): i nomi dei dispositivi che funzionano non
escono, gli stati dei sensori non escono, e tutto il resto della riga qui
sopra resta com'era.
Nella prima versione si possono anche lasciar fuori: contarli basta a far
suonare la spia.

## Le funzioni da aggiungere

### Nel ponte

Quasi tutto il contenuto del rapporto il ponte ce l'ha già in mano. Le due
cose che oggi non si chiede sono i dispositivi che non rispondono e le
batterie, e si
prendono dallo stesso `get_states` che `aggiornamenti.js` fa già ogni dieci
secondi sulla rete di casa — oggi ne tiene solo le entità `update.` e butta il
resto.

**`ponte/src/rapporto.js`** — nuovo

```js
/* Il foglio, da quello che il ponte sa già. Nessuna rete qui dentro e nessun
 * orologio che non sia quello che gli si passa: si prova tutto senza Home
 * Assistant, senza Supervisor e senza nessun quadro acceso. */
export function compila({ casa, ogni, versioni, macchina, rete, apparati,
                          addon, aggiornamenti, plance, telefoni, fuori,
                          entita, batterie, backup, adesso }) → object

/* Da dove viene ogni numero: l'unico posto che lo sa. Torna una funzione, non
 * un foglio, così ogni rapporto è di adesso invece che di quando il ponte si
 * è acceso. */
export function fabbricaLaRapporto({ identita, casa, ferro, aggiornamenti,
                                      plance, configurazione, dispositivi,
                                      chiamata, versioni, ogni }) → () => object

/* Il codice incollato nella scheda dell'add-on. */
export function leggiIlCodice(scritto) → { dove, chiave } | null

/* Chi la spedisce: un orologio, e un tentativo che se fallisce rallenta
 * invece di insistere. Spento quando manca il codice — cioè quasi sempre. */
export class Postino {
  constructor({ dove, chiave, casa, ogni, fabbrica, fetch, registro, adesso })
  parti()            // accende l'orologio
  ferma()
  async manda()      // un rapporto, adesso
  get acceso()       // se questa casa manda qualcosa a qualcuno
  get ultima()       // l'ultimo rapporto spedito, per la console
  get ultimoEsito()  // andata, o perché no
}
```

L'impronta delle entità sta in `salute.js`, dove sta la cosa che la usa; il
sale nasce in `identita.js`, di fianco al file che sopravvive ai riavvii.

**`ponte/src/salute.js`** — nuovo

```js
/* Le due domande che oggi non si fanno, sugli stati che già arrivano. */
export function leEntita(stati, { quante, registri }) → { totali, giu, dispositivi, nomi }
export function leBatterie(stati, { scarica = 20 }) → { sotto20, piuBassa }
export function ilBackup(stati) → { giorniFa }        // dall'entità del backup
```

**`ponte/src/ferro.js`** — nuovo: la macchina, la rete e gli add-on

Quasi tutto lo dice il Supervisor, e **senza che nessuno configuri niente in
casa del cliente** — che è la cosa che conta: un installatore non può contare
sul fatto che il cliente abbia aggiunto l'integrazione System Monitor.

```js
/* `/os/info` + `/host/info` + `/supervisor/stats`.
 * Da `/os/info` viene `board` (`odroid-n2`) e da `/host/info` il
 * `disk_life_time`, che sulle schede con eMMC o microSD è la riga che conta. */
export function laMacchina({ os, host, stats, temperatura }) → object

/* `/network/info`, la stessa via che `ritorno.js` chiama già per sapere dove
 * sta questa casa: lì si tengono solo gli `ipv4.address`, qui anche
 * `enabled`, `connected`, `primary`, `type` e il segnale.
 * L'SSID si butta apposta, e una prova tiene fermo che non esca. */
export function laRete({ network, filoSu }) → object

/* `/addons`: nome, `state`, `boot`, `update_available`. La sola domanda che
 * conta è `boot === "auto" && state !== "started"`. */
export function gliAddon({ addons }) → object
```

Le due cose che il Supervisor **non** dice sono la temperatura della scheda e
gli apparati di rete di casa, e tutt'e due ce l'ha già la plancia:

- la temperatura sta nell'arco del MiniPC, insieme a `dm.server_cpu`,
  `dm.server_ram`, `dm.server_disco` e all'uptime
  (`officina/.../sections/minipc-showcase-section.js`);
- il router e i ripetitori sono i `binary_sensor` con
  `device_class: connectivity` che la sezione «Macchine e rete» adotta **per
  integrazione** e non per classe — la regola sta in
  `officina/.../core/macchine-e-rete.js`, e serve a non risucchiare ogni
  telefono e ogni presa Wi-Fi della casa. Il ponte guarda le stesse entità con
  le stesse regole, e dove non è stato spuntato niente manda zero invece di
  fingere.

Che i due numeri siano gli stessi non è un dettaglio: è la regola che
`aggiornamenti.js` si è già data — «chi guarda la dashboard e chi guarda l'app
devono vedere lo stesso elenco, con gli stessi nomi e nello stesso ordine».

**`ponte/src/opzioni.js`** — due voci: `quadro` (il codice incollato, vuoto di
serie) e `quadro_ogni` (minuti, 15).

**`ponte/config.yaml`** — `quadro: ""` con schema `str?`, esattamente come
`chiave_console`: una casella che quasi nessuno riempie, e chi la riempie sa
cosa ci mette.

**Il codice del quadro** è una riga sola da incollare, con dentro tutt'e due le
cose che servono — dove chiamare e con che presentarsi:

```
quadro|1|https://quadro.impiantirossi.it|K7M2-9XQF-3BHT-R4VN
```

Due caselle da riempire giuste sarebbero due caselle da sbagliare. E leggibile,
non un blocco di base64 come diceva una stesura di questo documento: quando
qualcosa non va la prima domanda è «cosa ci hai incollato?», e a quella si deve
poter rispondere leggendo. La forma è quella dell'invito del QR code
(`ponte/src/invito.js`), numero di versione compreso: è l'unica cosa che
permetta a un ponte vecchio di dire «questo codice viene da un quadro più nuovo
di me» invece di leggerne metà.

**`ponte/console/`** — la scheda **«Il quadro»**, dietro l'ingress: a chi va,
ogni quanto, **l'ultimo rapporto spedito in chiaro**, quando è andata l'ultima
e il tasto **«Smetti di mandarla»**. Più una riga nel registro la prima volta
che parte.

**`ponte/src/commissioni.js`** — una via per la console: `ponte/quadro`,
leggere e spegnere.

### Nel quadro

```
quadro/
  src/index.js       lo accende: il server, i tre archivi, la potatura
  src/server.js      le vie, e tre chiavi che non si toccano
  src/case.js        le case seguite: matricola, nome dell'installatore,
                     e quanti rapporti per giorno
  src/controlli.js   da un rapporto ai dieci controlli, e allo stato
  src/chiavi.js      gli inviti, e le chiavi che ne restano
  src/archivio.js    ─┐
  src/registro.js     ├ copie dal ponte, identiche: `src/PRESI_DAL_PONTE.md`
  src/segreti.js     ─┘
  src/installatori.js  gli installatori, le chiavi, i limiti
  src/avvisi.js      quando una casa tace, e quando vale la pena dirlo
  src/fattorino.js   chi porta fuori gli avvisi
  src/giro.js        passa ogni dieci minuti, guarda, e semmai parla
  console/index.html la pagina
```

`src/rapporti.js` non c'è, e non è una dimenticanza: si tiene **l'ultimo**
rapporto e un numero per giorno, non tutti. Novantasei righe al giorno per
casa, su quaranta case, sono quattromila righe al giorno per disegnare quattordici
caselle.

Le vie, davanti:

| | |
|---|---|
| `GET /` | la soglia: cos'è questo indirizzo, in italiano. Chi lo tiene fra i segnalibri prima o poi lo apre nudo |
| `GET /salute` | se è vivo, quante case segue, e se la console è aperta |
| `POST /rapporto` | la casa deposita. `x-casa` + la sua chiave; una matricola mai vista nasce qui, senza nome |

L'installatore, tutte dentro `/console/` e tutte con la **sua** chiave:

| | |
|---|---|
| `GET /console/` | la pagina |
| `GET /console/io` | chi sono, quanti impianti ho, qual è il mio limite |
| `PUT /console/io/avvisi` | dove mandarmi gli avvisi. Vuoto li spegne |
| `POST /console/io/avvisi/prova` | mandamene uno adesso, per vedere se arriva |
| `GET /console/case` | l'elenco già vestito: stato, spunte e pastiglie **già decisi**, più le tre soglie con cui la pagina colora i metri |
| `GET` `POST /console/inviti` | i codici in attesa, e uno nuovo |
| `DELETE /console/inviti/<codice>` | annullalo |
| `PUT /console/casa/<matricola>` | il nome che le dà l'installatore |
| `DELETE /console/casa/<matricola>` | non seguirla più: si butta quello che se ne sa **e** la sua chiave, se no il primo rapporto la fa rinascere tre secondi dopo |

E chi tiene il quadro, dentro `/gestore/` e con la chiave di gestione:

| | |
|---|---|
| `GET /gestore/` | la pagina |
| `GET /gestore/installatori` | chi c'è, quanti impianti ha ognuno, e quanti sono rimasti senza nessuno |
| `POST /gestore/installatori` | aggiungine uno. Risponde con la sua chiave, **in chiaro e una volta sola** |
| `PUT /gestore/installatore/<id>` | nome e limite |
| `POST /gestore/installatore/<id>/chiave` | una chiave nuova; quella di prima smette subito |
| `DELETE /gestore/installatore/<id>` | toglilo. I suoi impianti restano |

**Le chiavi sono tre, e ognuna apre una porta sola.** Dal davanti entrano le
case, ognuna con la sua: apre una porta sola — depositare per la propria
matricola — e non fa vedere niente. Con quella di un installatore si vedono
**le sue** case e nient'altro: è la riga che tiene separati installatori che
fra loro si fanno concorrenza. E la chiave di gestione aggiunge e toglie
installatori, e conta — ma non apre nessuna casa.

Con una chiave sola, una casa qualunque potrebbe leggersi l'elenco degli
impianti di chi l'ha installata, cioè i clienti di qualcun altro.

**Una cosa è andata diversamente da come sta scritta qui sopra.** Il documento
diceva che al primo rapporto il quadro restituisce alla casa una chiave nuova
e l'invito muore. Sarebbe un po' più stretto, e si è scelto di no: quella chiave
nuova la casa dovrebbe tenersela in `/data`, e da quel momento la riga scritta
nella scheda dell'add-on non sarebbe più quella che la casa usa davvero — si
perderebbe **quello che c'è scritto nella casella è quello che parte**, per
guadagnare poco. Il codice resta quello, e a bruciarsi è il suo essere libero:
al primo rapporto si lega a quella matricola e nessun'altra casa lo può più
usare.

### Nell'app: niente

Una stesura di questo documento diceva di alzare `caseMassime` da 10
(`app/lib/casa/archivio_delle_case.dart:16`) perché l'installatore, dal quadro,
dovesse poter **aprire** la casa che lampeggia. Quella riga è caduta insieme al
tasto che la chiedeva: dal quadro non si apre niente, e allora dieci case
nell'app restano quello che erano — le case di chi la usa, non la flotta di chi
la installa. **L'app non va toccata.**

## Aggiornare da lontano

Vedere che una casa è indietro e non poterci fare niente è mezzo lavoro. Il
quadro ha quindi **un verbo**, e uno solo:

| | |
|---|---|
| `installa` | installa una voce `update.` — Home Assistant, un add-on, gdahome, un firmware che si installi da sé |

Niente altro: nessuna riga di comando, nessun cambio di configurazione, nessuna
lettura di stati. L'elenco dei verbi sta **nel programma del ponte**
(`ponte/src/lavori.js`), non nel messaggio: una parola che non è in quella
lista viene rifiutata, e non c'è modo di aggiungerne una dall'esterno.

> Qui è stato scritto a lungo che i verbi erano due, il secondo `riavvia` per
> far ripartire un add-on fermo. Non c'è: nel ponte c'è il pezzo che riavvia
> Home Assistant, e nessun comando del quadro ci arriva. Il giorno che si fa,
> questa tabella cresce di una riga — e non prima.

**Si nomina per nome e salto di versione**, non per entità: nel rapporto
l'entità non viaggia — `update.camera_di_marco_termostato` direbbe chi abita in
quella casa e in quale stanza — quindi il quadro nomina quello che ha visto, e
in casa si ritrova a cosa corrisponde. Ne viene gratis la regola più utile di
tutte: se nel frattempo quella versione è già stata installata, o ne è uscita
un'altra, il salto non torna più e **non si fa niente**. Un tasto premuto ieri
non installa una cosa diversa oggi.

**Il quadro non bussa mai.** Non potrebbe: una casa di gdahome un indirizzo
pubblico non ce l'ha, ed è tutto il punto del ponte. L'ordine viaggia **nella
risposta al rapporto**: la casa deposita i suoi numeri, e nella risposta si
trova, se c'è, una cosa da fare. Nessuna porta da aprire, nessun servizio in
ascolto — la stessa forma che ha già il filo verso il centralino.

**La manutenzione è un secondo interruttore**, e spento di serie:

```yaml
quadro: "…"            # manda il rapporto
quadro_manutenzione: false   # e lasciati anche aggiornare — no, finché non lo dici
```

Vedere e toccare sono due permessi, e il secondo non si dà da sé insieme al
primo. L'interruttore sta nelle opzioni dell'add-on, con scritto accanto cosa
accende; e quello che il quadro ha chiesto a questa casa — cosa, e com'è
andata — sta **dentro il rapporto**, che nella scheda «Il quadro» della console
si legge parola per parola. Chi ci abita non deve fidarsi di un riassunto: legge
la cosa stessa che è partita.

Il comando si consegna **una volta sola**. Se una casa se lo porta via e poi non
ne parla più — succede proprio quando quello che si installa è gdahome, perché
il processo che dovrebbe raccontare com'è andata è quello che si sta
aggiornando — non glielo si rioffre al rapporto dopo: sarebbe un'installazione
al minuto. Il prezzo è che una risposta persa per strada va ripremuta a mano.

Tre regole che il ponte applica e il quadro non può scavalcare:

1. **Il backup viene prima, sempre.** Non è una casella da spuntare: è la
   condizione perché il verbo esista. Un aggiornamento che va storto senza
   backup dietro è una casa da rifare.
2. **Quelli che vogliono un riavvio, uno per volta.** `aggiornamenti.js` li marca
   già (`stacca`): gdahome e Home Assistant si riavviano installandosi. Due
   insieme sulla stessa casa vogliono dire non sapere quale dei due non è
   tornato.
3. **Quello che non si installa da sé non ha un tasto.** `installabile` lo dice
   già, ed è la regola che il ponte si è data: un firmware che si porta col
   cacciavite mostrato con un tasto è una promessa che non si mantiene.

E una conseguenza che va guardata in faccia: **una casa che sta installando
qualcosa che vuole un riavvio smette di mandare rapporti.** Senza saperlo, il
quadro la darebbe per muta ogni volta che si aggiorna qualcosa. Perciò sa cosa
ha chiesto, e lo dice: entro tre quarti d'ora è «sta aggiornando»; oltre, non è
più un'attesa ma **«non è tornata»** — che è la cosa peggiore che possa fare un
quadro che aggiorna da lontano, e va detta con quelle parole invece che
nascosta dietro un «muta».

### La schermata di flotta

Casa per casa la domanda è «a questa cosa manca». Con quaranta impianti è
un'altra: **«quali sono indietro su Home Assistant Core?»**. La scheda
«Aggiornamenti» raggruppa per quello che c'è da installare invece che per dove
sta, e sotto ogni voce ci sono le case che ce l'hanno indietro con la versione
che hanno adesso. Un gesto invece di quaranta — e un avvertimento scritto lì
sotto, perché quaranta case insieme sono quaranta rischi insieme.

## Cosa il quadro non può fare

È la parte che decide se questo pezzo si può dare a qualcuno, e viene prima di
tutte le altre. Un installatore che tiene quaranta impianti non deve poter
guardare dentro quaranta case: quelle case sono di altri, e dentro ci sono le
telecamere, le presenze, gli orari di chi ci vive.

Perciò il quadro **non guarda dentro**, e le tre cose che non fa sono tre cose
che non ha:

- **non apre la plancia** — non c'è nessun tasto che porti dentro una casa, e
  non è un tasto dimenticato: il quadro non ha nessun segno con cui entrare;
- **non vede entità, stanze né persone** — riceve numeri, versioni e nomi di
  processi, e si ferma lì;
- **non tocca niente oltre il suo verbo** — e solo dove quella casa ha aperto la
  manutenzione. Non c'è una riga di comando, non si cambia la configurazione,
  non si legge uno stato.

Le due cose si tengono insieme meglio di come sembra: **un elettricista
sostituisce un interruttore senza leggere la posta di chi ci abita.** Guardare
dentro casa e fare manutenzione sulla scatola non sono lo stesso permesso, e
questo pezzo dà il secondo e non il primo.

Per entrare in una casa serve un abbinamento, e quello lo dà **chi ci abita**,
col suo segno, che toglie con un bottone quando vuole. Vale anche per
l'installatore il giorno dell'installazione: il telefono che abbina per provare
l'impianto è un telefono come gli altri, e al momento della consegna si stacca.
Il quadro mostra quanti telefoni sono abbinati proprio perché quel conto si
guardi.

## Le tre regole che non si toccano

1. **Il quadro non guarda dentro, e tocca solo quello che gli è stato
   aperto.** Una stesura precedente diceva «ascolta e non parla», e con gli
   aggiornamenti quella frase è diventata falsa: si cambia invece di tenerla
   per bella. Quello che non cambia è la metà che conta — dentro casa non
   guarda — e quello che si è aggiunto ha un interruttore suo, spento di serie,
   in mano a chi ci abita.
2. **Il consenso è di chi ci abita, non di chi ha installato.** L'opzione si
   vede nella scheda dell'add-on, la scheda della console fa leggere parola per
   parola quello che parte, e il tasto per smettere è lì di fianco. Si dice, non
   si nasconde — come per la plancia modificata, che non viene bloccata: viene
   detta.
3. **Numeri, non nomi.** Tutto quello che non serve a far suonare una spia
   resta in casa.

## Le tappe

1. **Il rapporto nel ponte**, spento di serie, con la scheda nella console che
   la fa leggere. Si prova con `curl` e un file, senza nessun quadro acceso — ed
   è già utile da sola: chi ha una casa sola può guardarsi la sua.

   **Fatta**, in `1.4.32.15`. Il ponte: `ponte/src/salute.js`,
   `ponte/src/ferro.js` e `ponte/src/rapporto.js`, le due opzioni nel
   manifesto tradotte in italiano e in inglese, il postino acceso in
   `index.js`. E la console: la scheda **«Il quadro di chi ti ha fatto
   l'impianto»**, che compare solo dove quella casella è piena — cioè quasi mai
   — e fa la cosa per cui esiste: mostra **il testo dell'ultimo rapporto
   spedito, intero e senza riassunti**. Un riassunto di quello che esce è
   esattamente la cosa di cui ci si dovrebbe fidare.

   Il tasto **«Smetti di mandarla»** ferma il postino *e* svuota la casella
   nelle opzioni dell'add-on, passando dal Supervisor
   (`Ferro.spegniLaRapporto`): fermarlo solo in memoria vorrebbe dire che al
   primo riavvio la casa ricomincia a parlare da sola, cioè un tasto che smette
   finché non si riavvia — una bugia con un bottone sopra. Dove il Supervisor
   non lascia scrivere si dice **cosa fare a mano**, invece di dire che è
   andata.

   Quarantotto prove in tutto, tre delle quali col ponte intero acceso
   (`ponte/test/server.test.js`): che senza codice la scheda non ci sia, che
   quella via dica a chi parla questa casa e **non** dica con che, e che
   «smetti» faccia tutt'e due le cose.
2. **Il quadro in Node**, la pagina che c'è già attaccata a dati veri.

   **Fatta.** Seicento righe e nessuna dipendenza: `src/server.js` con le vie
   qui sopra, `src/case.js` che tiene l'ultimo rapporto e la storia dei giorni,
   `src/controlli.js` con le regole, `src/chiavi.js` con gli inviti. La pagina è
   la stessa di prima, meno le novecento righe di dati finti e **meno le regole
   che si era portata dietro**: stato, spunte e pastiglie arrivano decisi da
   `GET case`, e con loro le tre soglie dei metri. Quella pagina ora disegna e
   basta, perché una soglia scritta in due posti prima o poi diventa due soglie.

   Ventisei prove allora, nove delle quali col quadro intero acceso: che una casa non
   possa leggere la console, che un codice usato non serva a nessun'altra casa,
   che la matricola in testa vinca su quella nel corpo, e che quello che un
   rapporto non dice resti **«non si sa»** invece di diventare una spunta
   rossa — è la differenza fra un impianto che ha un guaio e un impianto che non
   l'ha raccontato.
3. **L'avviso quando una casa tace.** Il pezzo che trasforma il quadro da
   cruscotto in una cosa che lavora mentre l'installatore non guarda.

   **Fatta.** `src/avvisi.js` decide, `src/fattorino.js` consegna, `src/giro.js`
   passa ogni dieci minuti. Le regole stanno [qui sopra](#quando-una-casa-tace).

   Ventitré prove allora, e quelle che contano provano che **stia zitto**: che non
   ridica una casa muta da tre giorni, che otto insieme facciano un messaggio
   solo, che un fermo del quadro non svegli nessuno, e che una consegna fallita
   lasci la casa da riavvisare. Perché un avviso si giudica da quando tace:
   mandarlo lo fa anche una riga che manda sempre.
4. Poi, se serve: la storia lunga.

### La tappa che non si fa: il quadro su Cloudflare

Una stesura diceva **«la versione su Cloudflare, come `nuvola/`, con la stessa
prova dal vivo contro tutte e due»**. E' tolta, e qui c'e' scritto perche' — se
no fra sei mesi qualcuno la rimette guardando `nuvola/` e pensando «c'e' per il
centralino, ci vorra' anche qui».

**`nuvola/` esiste per un motivo che qui non vale.** Il suo README lo dice
netto: *«un centralino da tenere acceso e' un server da pagare, e chiedere
cinque euro al mese per accendere una luce da fuori casa e' il modo piu' rapido
di far chiudere l'app»*. Il centralino lo accende **chi abita la casa**: una
persona qualunque, per cui cinque euro al mese e un dominio da comprare sono la
differenza fra usare l'app e disinstallarla. Cloudflare regala il piano e
l'indirizzo, e quella e' tutta la ragione del pezzo.

Il quadro invece lo accende **l'installatore**: uno che monta gdahome in
quaranta case, che quelle installazioni le fattura, e che un server e un dominio
ce li ha gia'. Cinque euro al mese su quaranta impianti sono dodici centesimi a
impianto all'anno. La barriera che `nuvola/` abbatte, qui non c'e'. E il vincolo
vero del quadro — che a ospitarlo sia l'installatore, perche' le case che guarda
sono clienti suoi — il suo server lo soddisfa gia'.

**E non sarebbe lo stesso programma su un altro motore.** Delle milleduecento
righe, `controlli.js` (le regole, trecentocinquanta righe) e' puro e passerebbe
di peso; le altre seicentonovanta no. `archivio.js` e' `readFileSync` e
`renameSync`, e su un Worker il filesystem **non c'e'**: andrebbe rifatto su KV,
D1 o Durable Objects. Quelli sono asincroni, quindi le otto `salva()` dentro
`case.js` e `chiavi.js` diventano `async`, e con loro `deposita`, `riconosci`,
`fai`, `annulla`, `togli`, `rinomina`, `stacca` e `potatura` — cioe' tutta la
superficie che il server chiama. E `server.js` e' `node:http`, che diventa un
handler `fetch` con la pagina incollata dentro.

Nemmeno la scelta dell'archivio sarebbe ovvia: il quadro riscrive tutto a ogni
rapporto, e quaranta case ogni quindici minuti fanno quasi quattromila
scritture al giorno **sulla stessa chiave** — che su KV e' il caso da non fare.
Resterebbe D1, e allora `case.js` smette di essere un oggetto JSON che si muta e
diventa SQL.

**Ma la ragione che basterebbe da sola e' un'altra.** Questo progetto la tassa
delle copie la paga gia': `segnalazioni.js` sono cinquecentoquattro righe
identiche fra `centralino/` e `nuvola/`, tenute allineate da una prova scritta
apposta perche' — dice la prova — il rischio e' *«si corregge un difetto da una
parte e dall'altra resta»*. Un quadro su Worker vorrebbe dire pagarla una terza
volta, e su `controlli.js`: cioe' **proprio sulle regole**. Una divergenza
silenziosa li' fa dire a due schermi due cose diverse della stessa casa — che e'
esattamente l'errore appena tolto dalla pagina, dove le soglie stavano scritte
due volte.

Costo: settecento righe riscritte, una seconda architettura d'archivio e un
vincolo di sincronia permanente sulle regole. Beneficio, per chi un posto dove
metterlo ce l'ha gia': nessuno.

## Quello che resta da decidere

- **Ogni quanto.** Quindici minuti fanno 96 rapporti al giorno per casa: su
  quaranta case sono quattromila richieste, che è niente. Ma una casa muta si
  scopre in tre quarti d'ora, e forse per un impianto va bene anche un'ora.
- **Quanto tiene il quadro.** Qui si propone la striscia a quattordici giorni,
  come la finestra del traffico di GitHub in `strumenti/conta-le-case.mjs`.
- **Le soglie.** Batteria al 20%, backup fermo dopo 14 giorni, muta dopo tre
  rapporti saltati, 75 °C, disco al 85%: sono scelte a occhio, non misurate.
  Stanno tutte in cima a `src/controlli.js` con un nome, che è il minimo perché
  un giorno si possano cambiare sapendo quante sono.
- **Se un aggiornamento in attesa fa suonare la spia.** Per ora no, a meno
  che tocchi Home Assistant o gdahome o siano tre: una casa che diventa ambra
  perché un add-on ha una versione nuova da ieri insegna a non guardare più le
  case ambra. Fra i dieci controlli invece contano tutti, e quella riga è severa
  apposta: lì la domanda è «questo impianto è in ordine?», nell'elenco è «devo
  andare a vedere?». È l'unica differenza rimasta fra le due liste, e sta
  scritta sopra `aggiornamentiPesano`.
- **Chi lo accende.** Se il quadro resta una cosa che un installatore si tira su
  da sé, o se un domani ne esiste uno ospitato — e allora tornano tutte le
  domande sui dati di case altrui, che è il motivo per cui qui sta da questa
  parte.
