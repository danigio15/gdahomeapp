# Il tramite su una macchina nostra: come si mette in piedi

Passo per passo, dal dominio all'accensione. Si fa **tutto dal browser del
telefono**: non serve un computer, non serve un terminale, non serve SSH.

Questo documento racconta com'e' andata davvero, non come si sarebbe potuta
fare: i nomi, il fornitore e gli indirizzi qui dentro sono quelli veri.

> **Fatto: le case stanno sul tramite** (12 settembre 2026, add-on 0.22.0).
> L'indirizzo di serie non e' piu' il Worker di Cloudflare: e'
> `wss://tramite.gdahome.org`, scritto nei tre posti dove sta —
> `ponte/src/opzioni.js`, `app/lib/ponte/centralino.dart`, `ponte/src/chat.js`
> — con `node strumenti/centralino.mjs`. Come si spostano le case che ci sono
> gia', e i telefoni, sta nel §12 in fondo.

---

## Perche' si fa

Il tramite fra il telefono e la casa era un Worker di Cloudflare, e Cloudflare
**conta i messaggi**: centomila al giorno sul piano gratuito, poi si spegne per
tutti. Un filo aperto ne fa migliaia all'ora, quindi il costo cresceva con le
**ore di uso** — e cresceva per sempre, a qualunque prezzo si partisse.

Su una macchina nostra i messaggi non li conta nessuno. Cinquecento case aperte
insieme sono un problema di memoria, non di fattura: il conto e' **fisso**.

| | prima | adesso |
|---|---|---|
| chi paga | a messaggio | al mese, sempre uguale |
| 10 case | gratis | ~6,71 €/mese |
| 500 case | ~100 €/mese | ~6,71 €/mese |
| 5.000 case | non ci sta | ~6,71 €/mese |

Quello che **non** cambia: l'app, il ponte, la cifratura, l'abbinamento, le
segnalazioni, la chat. Il protocollo resta identico — cambia solo dove le case
vanno a bussare.

---

## Quanto costa

| cosa | quanto |
|---|---|
| la macchina (Contabo Cloud VPS 4, mensile) | 6,71 €/mese, IVA inclusa |
| il dominio `gdahome.org` | ~12 €/anno |

**Circa 92 € l'anno**, e non si muovono con gli utenti.

---

## I tre nomi

Non uno: tre, e fanno mestieri diversi.

| nome | cos'e' | chi lo apre |
|---|---|---|
| `gdahome.org` | la pagina che dice cos'e' e da dove si comincia | chi non sa ancora niente |
| `webapp.gdahome.org` | i file di gdahome da aprire nel browser | chi ce l'ha gia': e' il link da copiare |
| `tramite.gdahome.org` | il tubo: `wss://`, dove casa e telefono si parlano | nessuno, mai a mano |

Li serve la stessa macchina, con lo stesso certificato. Il nome nudo — quello
che si scrive su un negozio o si dice a voce — e' il **sito**: una pagina
sola, ferma, senza niente che venga da fuori. `www.gdahome.org` non e' un
secondo sito: manda li'.

Piu' avanti `webapp` si potra' mettere dietro la rete di Cloudflare per
alleggerirla; `tramite` resta diretto per sempre, perche' il certificato se lo
prende lui.

---

## 1. Il dominio

`gdahome.org`, comprato su Namecheap. Un `.org` perche' quello che conta e' il
**rinnovo** e non il primo anno: dodici euro e mezzo l'anno, per sempre, contro
i trenta o quaranta di chi regala il primo anno.

Il DNS e' rimasto **su Namecheap**. Cloudflare e' stato aggiunto e poi lasciato
da parte: i suoi due nameserver non sono mai stati messi, quindi a rispondere
per `gdahome.org` sono ancora `dns1.registrar-servers.com` e
`dns2.registrar-servers.com`. Va benissimo cosi' — il certificato se lo prende
la macchina, e Cloudflare serviva solo per comodita'.

> **Se un giorno si passa a Cloudflare:** prima si rifanno li' i due record, poi
> si cambiano i nameserver. E i due record devono restare **grigi** («DNS
> only»): col proxy arancione davanti, la macchina non riesce piu' a rinnovare
> il certificato.

---

## 2. La macchina

**Contabo Cloud VPS 4**, in Europa, Ubuntu 24.04 LTS, mensile senza vincolo.
Quattro processori e 8 GB: abbondanti — il tramite gira le buste, non le apre —
ma il prezzo era quello.

Il backup automatico non e' stato preso: due euro al mese per proteggere una
manciata di kilobyte che si ricreano da soli. Al loro posto c'e' lo **snapshot
incluso**, da fare a mano quando tutto funziona; e piu' sotto e' spiegato
perche' perdere l'archivio non costringe a riabbinare niente.

Il terminale e' la **VNC Console** nel pannello di Contabo: un riquadro nero
dentro la pagina. Attento a una cosa sola: la tastiera li' dentro e' americana,
quindi i simboli stanno in posti diversi. Non serve scriverli — serve
**incollare**, e la console ha il suo bottone per farlo.

---

## 3. I nomi puntano alla macchina

Su Namecheap: **Domain List → Manage → Advanced DNS → HOST RECORDS**.

| Type | Host | Value | TTL |
|---|---|---|---|
| `A Record` | `tramite` | l'indirizzo della macchina | Automatic |
| `A Record` | `webapp` | lo stesso indirizzo | Automatic |
| `A Record` | `@` | lo stesso indirizzo | Automatic |
| `A Record` | `www` | lo stesso indirizzo | Automatic |

Le prime due righe sono il tramite e l'app; le ultime due sono il **sito**, e
sono arrivate dopo. `@` vuol dire «il nome nudo», cioe' `gdahome.org` senza
niente davanti: scritto per esteso, il record finirebbe su
`gdahome.org.gdahome.org` e non risponderebbe nessuno.

> **Le righe del parcheggio vanno via.** Namecheap ne mette due da sola —
> `CNAME www` e `URL Redirect @` — e finche' ci sono, `@` e `www` sono suoi,
> non nostri: si cancellano prima di mettere i due `A Record`. Finche' non lo
> si fa, l'accensione si ferma e lo dice.

**Come si sa che hanno preso:** apri `http://tramite.gdahome.org` dal telefono.
Deve dare **connessione rifiutata**, non «sito non trovato». Vuol dire che il
nome arriva alla macchina, e che sulla macchina non c'e' ancora niente in
ascolto. E' giusto cosi': il pezzo dopo e' quello.

---

## 4. Accendere il tramite

Nella **VNC Console**, entrato come `root`, si incolla **una riga**:

```bash
read -rsp 'gettone: ' G && echo && curl -fsSL \
  --config <(printf 'header = "Authorization: Bearer %s"\n' "$G") \
  -H 'Accept: application/vnd.github.raw' \
  https://api.github.com/repos/danigio15/gdahomeapp/contents/centralino/accendi.sh \
  | GETTONE_LETTURA="$G" bash
```

Chiede subito il **gettone di lettura** — quello con cui scarica il codice — e
lo chiede al prompt apposta: cosi' non finisce nella riga di comando, che sulla
macchina la legge chiunque con un `ps`, ne' nella cronologia della shell. Lo
chiede **solo la prima volta**: dalla seconda se lo rilegge da dove l'ha
scritto (§7), e la riga da incollare diventa piu' corta.

Poi lo script (`centralino/accendi.sh`) fa tutto da solo, in quest'ordine:

1. **guarda se la macchina va bene**: Debian o Ubuntu, root, e soprattutto che
   `tramite.gdahome.org` e `webapp.gdahome.org` arrivino **qui**. Un record che
   punta altrove e' il difetto piu' comune: senza questo controllo lo si
   scoprirebbe venti minuti dopo, quando il certificato non arriva;
2. **chiede le altre due cose**: il gettone con cui aprire le segnalazioni su
   GitHub (si puo' saltare e metterlo dopo) e la repository dove finiscono;
3. **genera la chiave della console** della chat — quarantotto caratteri presi
   dal caso, perche' una chiave scelta a mano e' una chiave indovinabile, e
   quella apre tutte le conversazioni;
4. **installa** Node, Caddy, il blocco di chi prova le password a raffica
   (`fail2ban`) e gli aggiornamenti di sicurezza automatici;
5. **scarica il tramite** e **ci gira sopra le prove**. Se non passano non lo
   accende: un tramite rotto e' peggio di un tramite spento;
6. **lo accende come servizio**, con un utente suo che non e' root e che puo'
   scrivere in una cartella sola;
7. **mette Caddy davanti**, che si prende i certificati per i due nomi e li
   rinnova da solo;
8. **accende il giro** che lo tiene aggiornato (il passo 6 qui sotto);
9. **prova che risponda da fuori** e stampa la chiave della console.

Se qualcosa non quadra si ferma **dicendo cosa**, e la riga si puo' reincollare
senza pulire niente.

---

## 5. La prova

Dal telefono:

```
https://tramite.gdahome.org/salute
```

Risponde con cinque cose: che e' vivo, **da quanto** (un numero piccolo senza
che nessuno abbia toccato niente vuol dire che si e' riavviato da solo), quante
case e quanti telefoni ha in linea, se le segnalazioni hanno il gettone, e se
la console della chat ha la chiave.

E gli altri due indirizzi:

- l'app da browser: `https://webapp.gdahome.org`
- la chat, per rispondere: `https://tramite.gdahome.org/console/`

Quella pagina e' la scorciatoia: si apre da qualunque browser e la chiave la
chiede una volta sola. Il posto per bene invece e' **dentro l'app**: si incolla
la chiave nelle opzioni dell'add-on, alla voce «chiave_console», e da quel
momento compaiono da soli la voce **Console** nel menu dell'app e il
**Cruscotto** nella finestra dell'assistenza della plancia. Cosi' non c'e'
niente da ricordarsi: la chiave sta dove stanno le altre impostazioni della
casa, e non passa mai dal telefono.

Se invece:

- **non si apre proprio**: il nome non punta ancora. Rifai il passo 3;
- **il certificato non e' valido**: c'e' un proxy davanti. Va tolto;
- **connessione rifiutata**: il servizio non e' partito. Nella console,
  `journalctl -u tramite -n 40 --no-pager` dice l'ultimo errore.

---

## 6. Come si aggiorna

**La macchina non segue `main`.** Segue un segno che si chiama `tramite`, e
finche' quel segno non si sposta lei non si muove. Su main si spinge dieci volte
al giorno: una macchina che seguisse main si riavvierebbe dieci volte al
giorno, a volte su un commit scritto a meta', mentre qualcuno e' fuori casa.

Per mandare in produzione si preme **«Il tramite»** su Actions. Quel bottone
gira le prove su quel commit e poi sposta il segno. Da li' in poi:

- la macchina se ne accorge **entro dieci minuti**;
- scarica quella versione e **ci gira sopra le prove**;
- se passano si riavvia; se non passano **resta dov'e'**, e lo scrive nel
  registro.

Nessuna chiave SSH da nessuna parte, nessuna porta nuova aperta: e' la macchina
che va a vedere, non noi che entriamo.

Come si controlla che sia arrivata: `acceso_da` in `/salute` torna piccolo.

---

## 7. Il sito, sul nome nudo

`https://gdahome.org` e' **una pagina sola**: cos'e' gdahome, i due pezzi
(l'add-on in casa, l'app sul telefono), come si comincia, e cosa non fa. Sta in
`sito/index.html`, e non ha niente che venga da fuori — nessun carattere
scaricato, nessuna libreria, nessun contatore. Chi la apre non viene seguito da
nessuno, che e' la stessa promessa che fa l'app.

Serve a due cose, e la seconda e' quella che l'ha fatta nascere:

- a chi non sa ancora niente, per capire in mezzo minuto se gli interessa;
- alla casella **«Website»** del Play Console, che vuole un indirizzo nostro e
  non un link a GitHub.

### Chi la serve

La serve **Caddy**, come i file dell'app: sono file fermi, e il tramite ha
altro da fare. Il blocco e' il terzo del `Caddyfile`, e `www` non e' un secondo
sito — manda al nome nudo con un `redir` permanente.

Una differenza con l'app, e non e' un dettaglio: qui **non c'e' `try_files`**.
L'app decide le sue schermate da sola, quindi tutto quello che non e' un file
va all'indice; il sito no — una pagina che non esiste deve dire che non esiste.

### Come si tiene aggiornata

Da sola, con lo stesso giro di tutto il resto: `scarica.sh` porta dentro
`sito/` insieme a `centralino/` e a `ponte/app/`, con lo stesso scambio —
prima si prova, poi si sostituisce. Quindi si modifica `sito/index.html`, si
sposta il segno `tramite`, e **entro dieci minuti** la pagina nuova e' la'.

Se una versione non avesse la cartella `sito/`, resta quella di prima: una
cartella vuota davanti a un nome pubblico vuol dire un sito che smette di
esistere perche' qualcuno ha spostato un file.

### Su una macchina che e' gia' in piedi

Prima i **due record** su Namecheap (`@` e `www`, §3), poi si sposta il segno
(Actions → «Il tramite»), e poi si reincolla nella VNC Console la riga che
accende tutto:

```bash
curl -fsSL \
  https://raw.githubusercontent.com/danigio15/gdahomeapp/main/centralino/accendi.sh \
  | bash
```

Niente gettoni da battere: quello di lettura e' gia' sulla macchina, e lo
script se lo rilegge da la'.

> **Rilanciarlo non porta via niente.** I segreti che sono gia' scritti — la
> chiave della console, il gettone delle segnalazioni, quello di lettura — se
> li rilegge invece di rifarli, e alla fine lo dice: «la chiave della console
> e' quella di prima, non l'ho toccata».
>
> Prima non era cosi': la chiave si rigenerava a ogni giro, in una riga senza
> `if`. Chi reincollava la riga per aggiungere un pezzo si ritrovava la chat
> chiusa con una chiave che non aveva mai visto. Ora c'e' una prova che lo
> tiene fermo (`centralino/test/accendi.test.js`).

Alla fine lo script controlla anche il sito, e se la cartella e' vuota dice
perche': quasi sempre e' il segno `tramite` che sta ancora su una versione in
cui il sito non c'era.

---

## 8. La spia

Se il tramite morisse, senza una spia lo scopriresti da un utente arrabbiato.

1. account su **UptimeRobot** (o simile);
2. monitor **HTTP(s)** su `https://tramite.gdahome.org/salute`, ogni 5 minuti;
3. la tua mail come avviso.

Quelle richieste le fa alla **tua** macchina, dove non le conta nessuno.

---

## 9. Cosa succede dopo

### Se la macchina si spegne

Da fuori casa non entra piu' nessuno finche' non torna. **Dentro casa continua
a funzionare tutto**, perche' li' il filo e' locale e non passa dal tramite: la
plancia, i dispositivi, la configurazione. Questo e' il prezzo vero del costo
fisso, ed e' giusto saperlo prima.

Per ripartire: dal pannello si riavvia la macchina. Se fosse persa del tutto,
se ne crea un'altra e si reincolla la riga del passo 4.

### L'archivio, e perche' perderlo non e' un dramma

Il tramite tiene poca roba: per ogni casa **l'impronta** del suo segreto (non
il segreto: l'impronta, che non si puo' girare al contrario), un contatore,
l'elenco delle segnalazioni e le conversazioni della chat.

Se quell'archivio si perdesse, **non si dovrebbe riabbinare niente**: il ponte
si ripresenta e il tramite lo riconosce da capo, perche' la prima casa che si
presenta con un certo identificativo se lo prende. Per quella finestra di tempo
l'identificativo di una casa sarebbe libero, e chi lo conoscesse potrebbe
prenderselo — ma sono centoventotto bit presi a caso, e indovinarli non si
indovina. Le conversazioni della chat invece si perderebbero davvero: quelle,
se contano, stanno nello snapshot.

### Il sistema

Gli aggiornamenti di sicurezza si installano da soli, e **non riavviano niente
di nascosto**: un riavvio mentre qualcuno e' fuori casa gli chiude la porta in
faccia. Il riavvio si fa a mano, due volte l'anno, dal pannello.

### La chiave della console

Sulla macchina si fa tutto con `tramite-chiave`:

| | |
|---|---|
| `tramite-chiave` | la dice: e' li' e si rilegge, non e' persa |
| `tramite-chiave --nuova` | ne fa una nuova, presa dal caso |
| `tramite-chiave <la tua>` | mette quella che scegli tu (almeno 16 caratteri) |

Le ultime due riavviano il tramite, e chi aveva la vecchia non entra piu'.
Cambiandola va rimessa anche nelle opzioni dell'add-on, dove sta la sua copia:
sono la stessa chiave, e il ponte bussa con quella.

Chi prova a indovinarla ha dieci tentativi: al decimo, quell'indirizzo resta
fuori per un quarto d'ora.

---

## 10. Come si torna indietro

Il Worker su Cloudflare resta dov'e' finche' non lo spegni tu. Se qualcosa non
va, si rilancia `strumenti/centralino.mjs` con l'indirizzo vecchio, si
ripubblicano add-on e app, e le case tornano li'. Non si perde nessuno, e non
si riabbina niente.

Per questo il Worker si spegne **dopo** qualche settimana, e non il giorno
stesso.

---

## 11. Quello che serve da te

1. il **gettone di lettura**: un fine-grained token che veda
   `danigio15/gdahomeapp` con **Contents: Read**, e nient'altro. Da quando
   quella repository e' **pubblica** non serve piu' a niente: GitHub i file
   pubblici li da' a chiunque li chieda, senza presentarsi. `accendi.sh` lo
   chiede ancora perche' non e' stato ancora cambiato — si puo' battere
   qualunque cosa, e il giorno che lo si sistema quella domanda sparisce;
2. il **gettone delle segnalazioni**: un secondo token, che veda
   `danigio15/gdahome-segnalazioni` con **Issues: Read and write** e
   **Contents: Read and write** (gli allegati finiscono li');
3. incollare la riga del passo 4 nella console di Contabo;
4. mettere la chiave della console nelle opzioni dell'add-on — e nel gestore
   di password, che e' dove si guarda quando la macchina non risponde.

**Due gettoni e non uno**, e la ragione e' che un gettone di GitHub porta gli
stessi permessi su tutte le repository che vede. Uno solo, per poter aprire le
segnalazioni, dovrebbe avere **Contents: Read and write** — e su `gdahomeapp`
vorrebbe dire che chi entrasse nella macchina potrebbe riscrivere il codice che
poi tutte le case si scaricano. Due gettoni separati tolgono quella strada.

---

## 12. Lo spostamento delle case, e dei telefoni

L'indirizzo del centralino sta scritto in **tre posti**, e si cambiano tutti e
tre con un comando solo — se divergessero, i telefoni cercherebbero le case in
un posto e le case aspetterebbero in un altro, e l'app direbbe soltanto «non
trovo la casa»:

```
node strumenti/centralino.mjs wss://tramite.gdahome.org
```

Scrive il difetto dell'add-on (`ponte/src/opzioni.js`), quello dell'app
(`app/lib/ponte/centralino.dart`) e quello della chat (`ponte/src/chat.js`,
convertito in `https://`). Che i primi due restino identici lo tiene fermo
`ponte/test/centralino-di-difetto.test.js`, cosi' non dipende dal fatto che
qualcuno si ricordi di usare il comando.

### Una casa si sposta quando aggiorna l'add-on

Il difetto e' scritto nel programma dell'add-on: una casa lo prende quando
aggiorna, e da quel momento chiama il tramite invece del Worker. Chi nelle
opzioni ha scritto un centralino suo non si muove — e' quello il senso di
quella casella.

### Un telefono gia' abbinato **non** si sposta da solo

L'indirizzo del centralino l'app lo tiene **per casa**, e glielo dice il ponte
una volta sola: quando si abbina (`ponte/src/portiere.js`, il messaggio
`ecco`). Dopo, nessuno gli dice piu' niente. Quindi, appena la casa aggiorna:

- **in casa** tutto continua a funzionare, perche' li' l'app va dritta
  all'indirizzo di rete locale e il centralino non c'entra;
- **da fuori** il telefono cerca la casa dove non c'e' piu', e dice «non trovo
  la casa».

Si rimette a posto **riabbinando**: nella console dell'add-on si stacca quel
telefono, si fabbrica un codice, e si inquadra il quadretto. Trenta secondi per
telefono, una volta sola.

> Si potrebbe togliere di mezzo per sempre — il ponte che dice il suo
> centralino a **ogni** collegamento e l'app che lo aggiorna quando e'
> cambiato — e allora i telefoni seguirebbero la loro casa da soli, anche il
> giorno che si cambia di nuovo fornitore. Per adesso si e' scelto di
> riabbinare a mano: i telefoni sono pochi e sono nostri.

### La chat si sposta con loro, le conversazioni no

`ponte/src/chat.js` adesso punta al tramite. Le conversazioni aperte prima
stanno nell'archivio del **Worker di prima** e non si spostano: chi aveva una
chat aperta, dal primo messaggio dopo l'aggiornamento ne apre una nuova sul
tramite. Per chi risponde vuol dire che la coda sulla console del tramite
parte vuota.

E la **chiave della console** e' quella del tramite — quella in
`/etc/tramite/ambiente`, che si rilegge con `tramite-chiave` — non quella del
Worker di prima. Va rimessa nelle opzioni dell'add-on, alla voce
`chiave_console`.

### Il pacchetto dell'app

Il difetto scritto nell'app serve a **trovare una casa che non si conosce
ancora**: abbinandosi col solo codice da fuori, il telefono deve sapere dove
sta il centralino prima di aver sentito la casa. Per quello va rifatto il
pacchetto — **Actions → «L'app da provare» → Run workflow** — se no un
telefono nuovo, da fuori casa, cercherebbe sul Worker. In casa, col
quadretto, l'indirizzo arriva dentro il codice a quadretti e il difetto non
serve.
