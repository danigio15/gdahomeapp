# Il centralino

Fa incontrare un telefono e la sua casa, **senza che la casa apra niente**.

```
   il telefono                                    la casa
        │                                            │
        │  wss://…/telefono/casa_9f3a…               │  wss://…/casa
        └──────────────►  ┌──────────────┐  ◄────────┘
                          │  centralino  │   (chiama lei, sempre)
                          └──────────────┘
```

## Perche' esiste

Il ponte sta su una porta sua dentro casa. Da fuori, quella porta non la
raggiunge nessuno: non c'e' un indirizzo pubblico, il router non ha niente
aperto, e l'accesso remoto di Home Assistant fa passare Home Assistant e si
ferma li'.

Le strade che restano — una VPN, un proxy inverso — vogliono tutte che
**l'utente installi e configuri qualcosa**. E quel qualcosa e' esattamente
cio' che questo progetto ha promesso di non chiedere.

Quindi si gira il verso: **e' la casa che chiama fuori**. Apre lei un filo
verso il centralino e lo tiene aperto; i telefoni arrivano da questa parte. Chi
installa l'add-on non configura niente, non apre niente, e funziona dentro e
fuori casa uguale.

## Quello che il centralino NON fa

E' la parte importante, ed e' scritta anche in cima al codice.

* **Non verifica niente che sia un segreto.** Il codice di abbinamento non lo
  vede mai: la casa gliene registra l'**impronta**, il telefono arriva con la
  stessa impronta, e il centralino instrada. Il codice vero viaggia dentro il
  filo, fino alla casa, che e' l'unica che lo puo' verificare.
* **Non verifica i segni dei telefoni.** Li passa alla casa.
* **Non guarda dentro ai messaggi.** Sono byte, e li sposta.

L'unica cosa che difende e' che una casa non possa spacciarsi per un'altra —
perche' se ci riuscisse raccoglierebbe i segni dei telefoni che bussano. La
prima che si presenta con un identificativo se lo prende; chi torna dopo con
quell'identificativo e un segreto diverso resta fuori, e se lo sente dire.

Sul disco finisce l'**impronta** del segreto di ogni casa, mai il segreto.

## Le vie

| | | |
|---|---|---|
| `GET /` | — | la soglia: una pagina che dice cos'e' questo indirizzo e dove si va |
| `GET /salute` | — | dice solo che e' vivo, e quante case ci sono |
| `GET /console/` | la chiave, per leggere | la console della chat dell'assistenza |
| `WS /casa` | il segreto della casa, dentro il filo | la casa che chiama fuori |
| `WS /telefono/<casa_…>` | — | un telefono che va alla sua casa |
| `WS /abbinamento/<impronta>` | — | un telefono che si sta abbinando |

L'identificativo della casa sta nell'indirizzo, e non e' un segreto: serve a
instradare, come un numero di telefono. Quello che fa entrare e' il segno, che
viaggia dentro.

Davanti al centralino, sulla macchina, c'e' anche l'app compilata per il
browser: sotto `/app/` sullo stesso nome, oltre che sul suo nome corto. Quei
file li serve Caddy e non questo processo, ma l'indirizzo conta: e' quello che
la console dell'add-on fabbrica da se' — il nome del centralino con `/app/` in
fondo — ed e' l'unico che esiste su un centralino proprio. Sulla nuvola lo fa
il centralino stesso.

La prima via non serve a niente di tecnico, e serve a una persona: l'indirizzo
del centralino uno se lo tiene fra i segnalibri e prima o poi lo apre nudo.
Trovarci un errore in JSON vuol dire crederlo rotto — quindi ci trova una
porta, che dice cos'e' questa macchina e manda dove si va davvero. I due nomi
che mostra — il sito e l'app — arrivano da fuori (`NOME_DEL_SITO`,
`NOME_DELL_APP`): un centralino che non ce li ha dice una riga in meno, e non
si inventa indirizzi di nessuno.

Sul filo della casa i telefoni sono multiplati, un canale per telefono:

```
centralino → casa   {c: 3, t: "apri", da: "…"}     un telefono e' arrivato
centralino → casa   {c: 3, t: "d", m: "…"}         quello che ha detto
centralino → casa   {c: 3, t: "chiudi"}            se n'e' andato
casa → centralino   {c: 3, t: "d", m: "…"}         la risposta
casa → centralino   {c: 3, t: "chiudi"}            chiudilo
casa → centralino   {t: "apri-abbinamento", impronta: "…"}
```

Dalla parte del telefono non c'e' nessun involucro: quello che manda arriva
alla casa cosi' com'e'. Vuol dire che il codice dell'app che parla con Home
Assistant **non cambia di una riga** — cambia solo l'indirizzo a cui bussa.

## Come si mette su

```bash
cd centralino
npm run avvia
```

Non ha dipendenze: la presa WebSocket e' scritta qui dentro, e il resto viene
da Node. Le variabili che legge:

| | |
|---|---|
| `CENTRALINO_PORTA` | su quale porta ascoltare (difetto: 8099) |
| `CENTRALINO_DATI` | dove tenere l'elenco delle case (difetto: `./dati`) |
| `CENTRALINO_SILENZIO` | dopo quanti giorni si dimentica una casa sparita (difetto: 180) |
| `CENTRALINO_REGISTRO` | `debug`, `info`, `attenzione`, `errore` |

Davanti ci va un proxy che parla in cifrato — il centralino sta su internet, e
sopra ci passano i fili delle case.

## Le prove

```bash
npm test
```

Diciotto prove, senza rete e senza nulla di finto nel mezzo: il centralino e'
acceso davvero e le case e i telefoni sono WebSocket clienti veri di Node,
quelli che useranno il ponte e l'app.

## Il centralino non puo' leggere quello che instrada

Non e' una promessa: e' una prova, in `ponte/test/cieco.test.js`. Si registra
**tutto** quello che passa dal centralino e poi ci si cerca dentro il segno del
telefono, il codice di abbinamento, i comandi e i nomi delle entita'. Non c'e'
niente.

Come: le due punte si scambiano una chiave a ogni collegamento — uno scambio
effimero, X25519, mescolato con una chiave che si sono dette al momento
dell'abbinamento e che qui non passa mai. Poi ogni messaggio e' una busta
sigillata (AES-256-GCM), numerata, che non si apre due volte e non si apre
fuori ordine.

Vale anche per l'abbinamento, che e' il momento delicato: li' la chiave comune
non c'e' ancora, e resta lo scambio effimero. Chi guarda passare due chiavi
pubbliche non ricava niente.

**Il limite, detto perche' vada scritto e non scoperto.** Un centralino
riscritto per *attaccare* — non che guarda, ma che si mette in mezzo — potrebbe
intromettersi nell'abbinamento di un telefono nuovo, perche' li' non c'e'
ancora niente di condiviso da cui riconoscersi. I telefoni gia' abbinati
restano al sicuro comunque: la loro chiave non e' mai passata di qui, e senza
quella non si fabbrica un filo che regga.

Il QR code ne ha tolta meta'. Il codice adesso e' di **sedici**
lettere — ottanta bit — e la sua impronta, che e' l'unica cosa che arriva fin
qui, non si prova piu' a raffica in casa propria: otto lettere erano quaranta
bit, e quaranta bit su una scheda grafica cadono in qualche minuto, cioe'
dentro i cinque in cui il codice vale.

L'altra meta' resta aperta: quella stretta di mano non e' autenticata. Si
chiude legandola al codice stesso — usarlo come chiave del filo
dell'abbinamento — e adesso che il codice e' lungo si puo' fare davvero, perche'
chi sta in mezzo non ce l'ha e non lo indovina.
