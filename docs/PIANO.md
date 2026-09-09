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

## I due binari

Da qui in avanti il lavoro corre su due binari, e conviene tenerli distinti
perche' hanno padroni diversi.

**Binario A — la plancia, e tutto quello che le serve.** La plancia e' quella
di DashboardModern, com'e', dentro un WebView. Non si tocca: si porta dentro
l'add-on con `strumenti/porta-la-plancia.mjs` e si aggiorna rilanciando lo
script. Quello che la plancia chiedeva all'integrazione di Home Assistant lo
fa **il ponte**, e in Home Assistant non c'e' nessuna integrazione — e' un
paletto.

| cosa | chi lo fa | stato |
|---|---|---|
| I file della plancia (pagina, moduli, caratteri, ritratti) | `ponte/plancia/`, serviti sul filo con `ponte/http` | ✅ |
| La configurazione (`dashboardmodern/config/get`, `set`, `restore`) | `ponte/src/configurazione.js`, in `/data/plancia.json` | ✅ |
| Il catalogo delle integrazioni (elettrodomestici, auto, robot, e quello che verra') | `ponte/src/catalogo.js`, dai registri di Home Assistant | ✅ |
| Le foto caricate dalla plancia (`www/list`, `www/upload`) | `ponte/src/foto.js`, in `/data/www` | ✅ |
| Lo storico, le statistiche, le telecamere, i calendari | Home Assistant, sul filo e via REST dal Supervisor | ✅ |
| Il server locale nel telefono e il WebSocket cucito sul filo | `app/lib/plancia/servitore.dart` | ✅ |
| La plancia anche dalla console del ponte, nel browser | il ponte la serve sotto ingress | ⬜ |
| Il ritratto delle persone, la lingua, i temi: come nel pannello | la premessa in testa alla pagina | ✅ |

Le **segnalazioni** e la **chat di assistenza** escono da questo binario: nella
plancia i loro bottoni rispondono «stanno nell'app», e il resto sta sotto.

**Binario B — l'app, e quello che e' suo.** Le cose che in Home Assistant
stanno nascoste o non esistono, scritte native in Flutter, con il ponte che fa
da tramite verso Home Assistant.

| cosa | stato |
|---|---|
| Abbinamento con otto lettere o col quadretto, piu' case, dentro e fuori casa, cifratura | ✅ |
| La barra: la casa in cui si e', da dove si passa, le sezioni | ✅ |
| I dispositivi: tutte le entita' per dominio, con gli interruttori | ✅ (elenco) |
| **Segnalazioni**: si aprono dall'app, con i dati della casa raccolti da soli; dal ponte al centralino, che le apre come issue di GitHub | ✅ |
| **Chat di assistenza**: dall'app, con chi mantiene il progetto, sullo stesso filo | ✅ |
| **Foto e video** allegati alle segnalazioni e alla chat, nella repository sotto `allegati/` | ✅ |
| **L'app fluida** con la plancia com'e' disegnata, animazioni comprese: il lavoro pesante fuori dal filo che disegna, il riquadro composto da Android, le buste compresse, «Come va l'app» con le misure vere | 🔄 (fase 1c) |
| Zigbee: ZHA **e** Zigbee2MQTT, dietro un'interfaccia sola | ⬜ (fase 3) |
| I dispositivi: aggiungerli, rinominarli, metterli in una stanza | ⬜ |
| Gli aiutanti: i sette classici | ⬜ (fase 2) |
| Il mago delle automazioni | ⬜ (fase 4) |
| Notifiche, impronta digitale, negozi | ⬜ (fasi 5 e 6) |

**Binario C — gli acquisti in app.** Alcune sezioni, dell'app e della plancia,
saranno a pagamento. Prima il disegno, poi la proposta commerciale, poi il
codice.

* **I diritti.** Ogni sezione a pagamento ha una chiave — `plancia.energia`,
  `plancia.elettrodomestici`, `app.zigbee`, `app.automazioni` — e un diritto
  e' l'elenco delle chiavi accese per **una casa**, con una scadenza e con i
  **limiti** (quanti dispositivi). Per casa e non per telefono: chi compra
  una sezione la vede su tutti i telefoni abbinati a quella casa, e non la
  ricompra per il tablet in cucina.
* **Dove sta la verita'.** Non nel telefono e non nel ponte, che stanno tutti
  e due in casa dell'utente: sta nel **centralino**, che e' gia' il pezzo che
  chi distribuisce l'app mantiene. Il centralino tiene il registro degli
  acquisti e **firma** i diritti (Ed25519); il ponte ha la chiave pubblica e
  verifica la firma da solo, anche senza rete. Un diritto firmato vale fino
  alla sua scadenza, e il ponte lo rinnova dal centralino quando ci arriva.
* **Come si compra.** Dai negozi, perche' Apple e Google lo impongono per le
  funzioni digitali dentro l'app: Google Play Billing e StoreKit, con il
  plugin `in_app_purchase` di Flutter. L'app compra il prodotto, riceve la
  ricevuta del negozio, la manda al centralino insieme all'identificativo
  della casa; il centralino la verifica presso Google o Apple, scrive
  l'acquisto nel registro e rimanda il diritto firmato, che il ponte mette
  in `/data/diritti.json`. «Ripristina gli acquisti» rifa' lo stesso giro.
* **Come si accende e si spegne una sezione.** Il ponte e' l'unico punto di
  passaggio, e lo fa da li': per la plancia, `config/get` serve la
  configurazione **senza** le sezioni spente e `config/set` non le accetta,
  e in testa alla pagina la premessa scrive quali sezioni sono accese cosi'
  la barra e la Config le mostrano chiuse col loro prezzo; per l'app, la
  barra e le schermate leggono lo stesso elenco. Spegnere e' togliere la
  chiave dal diritto: la volta dopo che il ponte lo rinnova, la sezione si
  chiude da sola. I **limiti sui dispositivi** si contano nel ponte: il
  catalogo delle integrazioni dice quanti dispositivi sono collegati nella
  plancia, e il ponte rifiuta di collegarne uno in piu' del diritto — il
  primo e' gratis, gli altri si sbloccano.
* **Quello che decide chi vende.** Cosa e' gratis e cosa no, i pacchetti,
  una tantum o abbonamento, il periodo di prova, e i diritti **regalati** —
  a chi collauda, a chi aiuta — che si concedono dalla console del
  centralino senza passare dai negozi. Il registro e' un elenco per casa, e
  la console lo mostra e lo cambia.

**La proposta commerciale** (una proposta: si decide insieme).

*Cosa resta gratis, per sempre.* Tutto quello che serve a **vedere e
comandare** la propria casa: la plancia intera con le sue pagine — Home,
stanze, luci, clima, temperatura, finestre, prese, agenda, sicurezza, meteo,
persone, energia istantanea — l'app con l'abbinamento, piu' case, dentro e
fuori casa dal centralino, i dispositivi in elenco, le segnalazioni e la
chat. E **un dispositivo collegato** gratis: un elettrodomestico, un'auto o
un robot dal catalogo delle integrazioni, e piu' avanti un dispositivo
Zigbee. Chi prova l'app deve vederla funzionare davvero, non una vetrina.

*Cosa si sblocca.* Un livello solo, **Casa completa**, per casa:

| cosa | gratis | Casa completa |
|---|---|---|
| Dispositivi collegati (elettrodomestici, auto, robot; poi Zigbee) | 1 | senza limite |
| Telecamere nella plancia | 1 | senza limite |
| Energia: report, analisi, confronti nel tempo | istantanea | tutto |
| Automazioni col mago (fase 4) | 1 | senza limite |
| Aiutanti (fase 2) | 3 | senza limite |
| Zigbee: abbinare dispositivi (fase 3) | 1 dispositivo | senza limite |
| Segnalazioni e chat | si' | con precedenza nelle risposte |

Un livello solo e non tre, perche' ogni livello in piu' e' una domanda in
piu' da fare a chi paga, e la risposta giusta a «quanti dispositivi hai» e'
quasi sempre «piu' di uno». Il limite sui dispositivi e' quello che si sente:
il secondo elettrodomestico e' il momento in cui l'app ha gia' dimostrato di
valere.

*Come si paga.* **Una tantum per casa**, intorno ai 19,99 €, con un
abbonamento alternativo intorno a 1,99 € al mese per chi preferisce provare:
i due prezzi stanno bene insieme sui negozi e nessuno dei due spaventa. Una
**prova di quattordici giorni** con tutto acceso al primo abbinamento, senza
carta: si vede cosa si perde, che e' il modo piu' onesto di far comprare. Il
prezzo e' per casa, quindi la famiglia intera con un acquisto solo. I diritti
regalati dalla console del centralino coprono chi collauda e chi aiuta.

*Cosa non fare.* Non far pagare l'accesso da fuori casa: costa zero, e' il
motivo per cui l'app esiste, e farlo pagare e' il modo piu' rapido di far
chiudere l'app. Non far pagare le segnalazioni: chi segnala aiuta.

| pezzo | dove | stato |
|---|---|---|
| Le chiavi delle sezioni e l'elenco di cosa e' a pagamento | `docs/`, poi codice comune | ⬜ da decidere |
| Il registro degli acquisti e la firma dei diritti | `nuvola/` (centralino) | ⬜ |
| La verifica delle ricevute presso Google e Apple | `nuvola/` | ⬜ |
| I diritti nel ponte, la configurazione filtrata, la premessa | `ponte/src/diritti.js` | ⬜ |
| L'acquisto e il ripristino nell'app | `app/lib/acquisti/` | ⬜ |
| La console del centralino: vedere, regalare, revocare | `nuvola/` | ⬜ |

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

### Fase 1 — il guscio *(chiusa)*

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
* ✅ **La home.** E' la plancia vera. E nella barra, sotto il nome della
  casa, da dove si sta passando — che e' la prima domanda di chi apre l'app
  fuori casa e vede qualcosa di strano: sto guardando dati veri o vecchi?

* ✅ **La plancia.** Quella vera, in un WebView, servita da un server che sta
  dentro l'app e che i file li chiede al ponte — la commissione `ponte/http`
  — e il WebSocket lo cuce sul filo. I file, la configurazione, il catalogo
  delle integrazioni e le foto ce li ha il ponte, dentro l'add-on: in Home
  Assistant non c'e' nessuna integrazione. La WebView non e' autenticata:
  alla pagina si dice di essere ospitata, come in un pannello, e nessun segno
  la tocca. Prima di questo si era provato a rifarla in Flutter, ed e' andata
  come dice la tabella in cima: non era lei.

### Fase 1b — segnalazioni e chat, nell'app

Nella plancia erano due sezioni che parlavano col backend dell'integrazione,
che a sua volta parlava con GitHub e con un relay. Qui diventano dell'app:
una schermata per aprire una segnalazione — con dentro, raccolti da soli, la
versione dell'app e del ponte, il telefono, com'e' andato l'ultimo
collegamento — e una per la chat con chi mantiene il progetto. Passano dal
ponte, che e' l'unico che puo' parlare fuori per conto della casa, e nessun
segreto sta sul telefono. Nella plancia i due bottoni rispondono che quelle
cose stanno nell'app. A una segnalazione si allegano foto e video, dalla
galleria o scattati al momento: viaggiano per intero dal filo al ponte al
centralino, che li mette nella stessa repository delle issue.

### Fase 1c — l'app che non va a scatti

La regola, detta una volta: **la plancia non si tocca**. Le sue animazioni,
le sue sfocature, i suoi effetti sono quello che chi l'ha disegnata vuole
vedere, e l'app deve reggerli cosi' come sono — il compito e' rendere leggero
tutto quello che le sta intorno, non alleggerire lei. La «plancia leggera»
resta come interruttore, spento di serie, per un telefono che proprio non ce
la fa: si accende a mano, da «Come va l'app», e si sa che cambia l'aspetto.

Quello che si e' fatto, in ordine di peso:

- **Gli eventi della casa non ridisegnano tutto.** Un evento al secondo che
  ricostruiva la home intera era la prima causa degli scatti: adesso si
  raccolgono e si consegnano solo a chi li vuole, e l'elenco delle entita' si
  chiede solo quando lo si guarda.
- **Il lavoro pesante si fa altrove.** Decifrare un `get_states` da un
  megabyte e mezzo, o un file della plancia, sul filo che disegna lo schermo
  erano decimi di secondo di schermo fermo: adesso va in un altro isolato di
  Dart, e sul filo principale passano solo i messaggi piccoli.
- **Il riquadro della plancia lo compone Android**, non Flutter: senza,
  ogni fotogramma della plancia — e con le sue animazioni sono sessanta al
  secondo, per sempre — obbligava Flutter a ridisegnare tutta l'app sulla
  stessa scheda video. Con la composizione ibrida Flutter disegna solo quando
  cambia qualcosa di suo, e la plancia va da sola, come in un browser.
- **Il fondo dell'app non sfoca piu'.** Il motore di disegno di Flutter sul
  telefono non tiene da parte quello che ha gia' disegnato, e i due aloni
  sfocati sotto tutte le schermate erano due passate su tutto lo schermo a
  ogni fotogramma dell'app. Adesso sono due gradienti radiali, che costano
  quanto dipingere un colore e a occhio sono lo stesso alone.
- **Le buste sono compresse**, prima di essere cifrate: cinque, otto volte
  meno byte sul filo, sul Wi-Fi e sulla rete del cellulare, e cinque, otto
  volte meno lavoro per decifrarle. Il ponte e l'app se lo dicono nella
  stretta di mano, quindi un ponte vecchio e un'app nuova si parlano come
  prima. Serve il ponte dalla 0.11.0.
- **«Come va l'app»**, in Assistenza, dice in numeri quello che prima era una
  sensazione: quanti fotogrammi in un minuto, quanti lenti, se e' Flutter o
  la scheda video, quante volte il filo principale e' rimasto bloccato, e
  quanto passa sul filo con la casa. E' la pagina da fotografare in una
  segnalazione, e la parte da guardare per decidere il prossimo passo.

E due cose che non erano prestazioni ma sembravano un guasto:

- **La plancia non si dimentica piu' la sua configurazione.** Il servitore
  ascoltava su una porta a caso a ogni avvio, e un browser tiene quello che
  una pagina si salva per *origine* — che e' fatta anche dalla porta. Ogni
  avvio era quindi una pagina nuova, senza niente: la plancia ripartiva vuota
  e si riempiva solo quando riusciva a rileggersi dal ponte. Riaprendo l'app
  fuori casa, col filo ancora in cammino, non ci riusciva, e sembrava che la
  configurazione fosse andata persa. Adesso la porta e' sempre la stessa.
- **La plancia si prende lo schermo intero.** Il riquadro stava dentro le
  barre del telefono e la pagina ci aggiungeva i suoi margini: sopra l'aria
  era doppia, e la barra della plancia restava a mezz'aria sopra i tasti.
  Adesso il riquadro arriva ai bordi — il fondo della pagina passa sotto
  l'orologio e sotto i tasti — e quanto prendono quelle barre glielo dice
  l'app, in due variabili CSS che si riscrivono girando lo schermo senza
  ricaricare niente.
- **Quando il filo torna su da solo, l'app se ne accorge.** Il collegamento
  guardava solo la discesa: caduto il filo si diceva «sto cercando la casa»,
  e quando il filo si rialzava — cosa che fa da solo, ed e' tutto il punto —
  nessuno rimetteva lo stato a posto. L'app restava a cercare una casa che
  intanto le mandava sessanta eventi in quindici secondi: la plancia dentro
  il riquadro funzionava, e la riga sopra diceva di no. La prima volta ci
  pensava l'apertura, e infatti il difetto si vedeva solo dalla seconda in
  poi — cioe' ogni volta che si riprendeva in mano il telefono.
- **Il filo si riprende dopo che l'app e' stata da parte.** Aprire la presa
  non aveva una scadenza: un telefono che si sveglia con la radio ancora
  fredda apriva una presa che non si apriva e non falliva, e l'app restava a
  «sto cercando la casa» per sempre — sembrava tutto in corso, e non stava
  succedendo niente. Adesso l'apertura scade, una bussata rimasta indietro
  non installa piu' niente, e il risveglio lascia perdere quella appesa e ne
  comincia un'altra da zero, senza aspettare l'attesa allungata dai
  tentativi di prima.
- **Quando la casa non risponde, si dice quello che ha detto lei.** La bussata
  che sceglie la strada non veta piu' il centralino: se non risponde nessuno
  lo si prova lo stesso, e il no arriva da chi lo sa — «questa casa adesso non
  e' collegata» invece di «non trovo la casa da nessuna parte».

Quello che resta da capire, e si capisce solo con le misure di un telefono
vero: se la plancia da sola, dentro il riquadro, va come nell'app di Home
Assistant. Se si', l'app e' a posto; se no, il peso e' della pagina — tre
volte gli avvii di storico e le sfocature a quarantadue pixel su una scheda
video da telefono — ed e' lavoro del binario A, non dell'app.

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
