# L'albo

**Progetto, non ancora costruito.** Qui c'è come gdahome riconosce gli
installatori, quante case hanno, e cosa succede a chi non è iscritto.

L'albo professionale è il registro di chi può esercitare. Un installatore è
**iscritto all'albo**, e quello che si porta dietro è **il tesserino**: una riga
firmata che dice chi è, fino a quando, e per quante case.

## Il problema, detto bene

Oggi niente lega una casa a un installatore, e non per svista: la matricola se
la fabbrica la casa da sola — `casa_` e trentadue cifre di caso — e non si
registra da nessuna parte. Il centralino vede arrivare un numero e lo instrada.
Il quadro quel legame ce l'ha, ma **il quadro sta sulla macchina
dell'installatore**, e lì gdahome non entra: è la scelta su cui regge tutta la
privacy del quadro.

Quindi la domanda «quante case gestisce Rossi» oggi non ha nessuna risposta, e
non c'è nessun posto dove andarla a cercare.

### Vedere e limitare sono due problemi, non uno

Vanno separati subito, perché hanno soluzioni diverse e una delle due non esiste
nel modo in cui di solito la si immagina.

**Limitare** si può solo dove il controllo sta in mano a chi limita. Un
contatore dentro il quadro non limita niente: quel programma gira su una
macchina dell'installatore, e chi vuole più case di quelle che ha pagato lo
modifica in trenta secondi. **Ogni controllo che vive nel software ospitato da
chi deve essere controllato è un dosso, non una serratura.**

**Vedere** invece si può, e onestamente: basta che all'installatore convenga
farsi contare.

L'albo fa tutte e due, ma in due posti diversi.

## Le due metà

```
  LEI                            L'INSTALLATORE              LA CASA
  ┌──────────────┐               ┌──────────────┐            ┌──────────────┐
  │   L'ALBO     │  tesserino    │  IL QUADRO   │  codice    │  IL PONTE    │
  │              │ ────────────► │              │ ─────────► │              │
  │ firma i      │  (una volta)  │ lo mette in  │ col        │ VERIFICA la  │
  │ tesserini    │               │ ogni codice  │ tesserino  │ firma, e se  │
  │              │ ◄──────────── │ di           │  dentro    │ non torna    │
  │ conta        │  il battito   │ abbinamento  │            │ NON ABBINA   │
  └──────────────┘  (un numero)  └──────────────┘            └──────────────┘
```

**Il tesserino limita** — perché chi lo verifica è il ponte, che è programma di
gdahome e gira in casa del cliente, non dell'installatore.

**Il battito fa vedere** — il quadro dice quante case segue, e in cambio il
tesserino gli viene rinnovato.

## Cosa l'albo NON fa

È la parte che va scritta per prima, perché è quella che si perde per strada.

* **Non tocca il centralino.** `tramite.gdahome.org` resta com'è: non sa cosa
  sia un installatore, non conta niente, non rifiuta nessuno. Quel pezzo ha due
  promesse di forza diversa, e vanno tenute distinte. Una è **stretta e
  verificata**: il codice di abbinamento non ci passa mai, e il segreto di una
  casa non finisce sul disco in chiaro — ci sono due prove in
  `centralino/test/centralino.test.js` che lo tengono. L'altra è una **postura,
  non una garanzia**: i messaggi li gira senza guardarli, ma li gira in chiaro,
  e chi tiene accesa quella macchina potrebbe guardarli. Aggiungerci il
  commercio vuol dire allargare il solo pezzo di gdahome che sta in mezzo fra un
  telefono e una casa — che è precisamente il punto dove conviene aggiungere il
  meno possibile.
* **Non tocca una casa senza quadro.** Chi si installa gdahome da sé non incontra
  mai l'albo: nessun tesserino, nessun controllo, niente da pagare, per sempre.
  Il progetto esiste per non chiedere niente a chi abita una casa, e questo non
  cambia. **Il tesserino chiude il quadro, mai la casa.**
* **Non spegne quello che già funziona.** Il ponte verifica la firma **al
  momento dell'abbinamento**. Una casa già abbinata continua a mandare le sue
  cartoline anche se il tesserino scade: un installatore che non rinnova smette
  di poter **crescere**, non smette di vedere gli impianti che ha già montato.
  Se fosse il contrario, a restare senza controllo sarebbe l'impianto di un
  cliente che con quel contratto non c'entra niente.
* **Non riceve elenchi.** Il battito porta **un numero**, mai le matricole e mai
  i nomi che l'installatore ha dato alle case. È la stessa disciplina della
  cartolina, girata: *la cartolina non dice all'installatore chi abita la casa,
  il battito non dice a gdahome quali case ha l'installatore.*

## Il tesserino

Oggi il codice che l'installatore incolla nella scheda dell'add-on è così:

    quadro|1|https://quadro.rossi.it|CHIAVE

Il ponte lo legge, controlla che l'indirizzo sia `https` e che la chiave non sia
vuota, e si fida. Chiunque può fabbricarne uno.

Con l'albo diventa:

    quadro|2|https://quadro.rossi.it|CHIAVE|TESSERINO

e il tesserino sono due pezzi separati da un punto — quello che dice, e la firma
di chi lo dice:

    <quello-che-dice>.<firma>

Quello che dice, corto perché finisce in una riga da incollare:

| | |
|---|---|
| `i` | chi è l'installatore: `rossi` |
| `d` | **dove**: `quadro.rossi.it` — il tesserino vale solo per quel quadro |
| `s` | la **soglia**: quante case, `40` |
| `f` | **fino a**: `2027-03-01` |

Firmato **Ed25519**, che Node fa da sé — nessuna libreria da aggiungere, in
nessuno dei tre pezzi. Misurato: la firma sono 64 byte, cioè **86 caratteri**, e
la chiave pubblica ne occupa 59. Un codice da incollare resta un codice da
incollare.

### Chi firma, chi verifica

**Firma lei, con una chiave privata che non entra mai nella repository** — sta
sulla sua macchina, e in un `.env` che non si versiona. È l'unico segreto di
tutto questo, e se esce si rifà tutto da capo.

**Verifica il ponte**, con la chiave **pubblica** scritta dentro l'add-on. E qui
c'è la cosa che rende il disegno buono:

> **La verifica non chiama nessuno.**

Il ponte non telefona a casa per validare un tesserino: controlla una firma
contro una chiave che ha già. Quindi l'abbinamento funziona anche se il suo
server è spento, non c'è nessuna nuova dipendenza di rete in casa del cliente, e
il centralino resta fuori dal giro.

Nel ponte vanno **più chiavi pubbliche, non una**: il giorno che quella privata
va cambiata, i tesserini vecchi devono restare buoni finché scadono. Una lista
costa tre righe adesso e ne salva trecento dopo.

## Il battito

Il quadro, una volta al giorno:

```
POST https://albo.gdahome.org/battito
{ "tesserino": "…", "case": 37, "versione": "1.4.32.15" }
```

e si sente rispondere `{ "valido": true, "fino": "2027-03-01" }`, oppure che è
ora di rinnovare.

Un numero, la versione che gira, e basta. Se un giorno l'albo è spento, il
quadro continua a funzionare e riprova domani: **il battito è un promemoria, non
un permesso.** Il permesso è il tesserino, e quello ce l'ha già in tasca.

### Perché l'installatore ci sta

Non perché è obbligato — perché senza non lavora, e con gli conviene:

* senza tesserino **non abbina nessuna casa**, quindi niente quadro;
* il rinnovo è automatico se il battito arriva, e da chiedere a mano se non
  arriva;
* e il tesserino è quello che sblocca le cose che contano: gli **aggiornamenti
  da remoto** (i due verbi `aggiorna` e `riavvia`), il marchio, l'assistenza,
  l'essere elencato fra gli installatori riconosciuti.

## Cosa vede lei

Una pagina, come le altre console del progetto:

| | |
|---|---|
| chi è iscritto | nome, tesserino, da quando |
| quante case | l'ultimo numero che ha battuto |
| la soglia | e se è vicino o oltre |
| l'ultimo battito | e chi ha smesso di batterne |
| in scadenza | chi va rinnovato questo mese |

Il conto totale delle case di gdahome lei ce l'ha già da un'altra parte e per
un'altra strada — `strumenti/conta-le-case.mjs`, che legge i cloni della
repository da GitHub. Sono due misure diverse e vanno lette diverse: quella dice
**quante case esistono**, questa dice **quante ne segue un installatore**. Una
casa senza quadro sta nella prima e non nella seconda, e va bene così.

## Il limite onesto

Il ponte è programma aperto. Un installatore può forcare l'add-on, togliere la
verifica, e dire ai suoi clienti di installare la **sua** versione. Non lo si
può impedire, e chi scrive che lo impedisce sta vendendo fumo.

Ma il conto è diverso da quello di prima. Modificare il proprio quadro costa
trenta secondi e non lo vede nessuno. Forcare l'add-on vuol dire: mantenerlo a
ogni versione di gdahome, convincere ogni cliente a installare un add-on che non
è nel negozio ufficiale, e restare indietro sugli aggiornamenti — visibilmente,
in casa di gente che ha pagato per un impianto che funziona.

La serratura non è matematica: è che **la strada storta costa più di quella
dritta**. Per il problema vero — un installatore che vuole quaranta case avendone
pagate dieci — basta e avanza.

## Dove sta

Un quinto pezzo, sulla sua macchina. Può stare sulla stessa del centralino, ma
**non dentro** il centralino: quello è cieco per contratto e ha una prova che lo
verifica, e mettergli in pancia il commercio vuol dire che fra un anno nessuno
sa più cosa poteva vedere.

```
albo/
  src/tesserini.js   fa e firma i tesserini
  src/albo.js        gli iscritti, i battiti, le scadenze
  src/server.js      /battito, e la console
  console/index.html la pagina
  strumenti/firma.mjs   un tesserino a mano, da riga di comando
```

E due aggiunte piccole altrove:

| dove | cosa | quanto |
|---|---|---|
| `ponte/src/tesserino.js` | verifica la firma, e basta | ~60 righe |
| `ponte/src/cartolina.js` | il codice versione `2`, e il rifiuto se non torna | ~20 righe |
| `quadro/src/tesserino.js` | lo tiene, lo mette nei codici, manda il battito | ~90 righe |

## Le tappe

1. **Il tesserino e la sua verifica**, senza nessun albo acceso: `firma.mjs`
   che ne fa uno a mano, e il ponte che lo verifica o rifiuta. Da qui si può già
   lavorare — i tesserini si firmano a mano finché sono dieci.
2. **Il quadro lo porta**: mette il tesserino nei codici che genera, e si rifiuta
   di generarne se non ce l'ha o è scaduto.
3. **L'albo**: il server, il battito, la console delle scadenze.
4. **Il rinnovo automatico** a chi batte, e l'avviso a chi non batte più.

## Quello che resta da decidere

- **Quanto dura un tesserino.** Corto costringe a rinnovare spesso e dà più
  presa; lungo dà meno fastidio. Novanta giorni col rinnovo automatico al
  battito sembra il punto giusto, ma è da provare con un installatore vero.
- **Se la soglia serve davvero.** Il tesserino la può portare, ma **nessuno la
  fa rispettare**: il ponte non sa quante case ha quell'installatore, e il quadro
  che le conta è suo. Serve al rinnovo — si rinnova per quaranta e si vede che ne
  batte cinquanta — non a bloccare la quarantunesima. Portarsela dietro senza
  dire questo sarebbe una promessa falsa scritta in un campo.
- **Cosa succede a chi era iscritto e smette.** Le sue case continuano a mandare
  cartoline a un quadro che non è più riconosciuto. È giusto — sono impianti che
  funzionano — ma va deciso se dirlo a chi ci abita, e come.
- **Un tesserino per quadro o per installatore.** Uno che ha due sedi ha due
  quadri. Oggi il campo `d` lega il tesserino a un indirizzo: o si firmano due
  tesserini, o `d` diventa una lista.
