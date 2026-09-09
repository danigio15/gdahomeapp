# Il centralino, sulla nuvola

Questo è il centralino scritto per girare su **Cloudflare**, gratis.

Fa esattamente le stesse cose di quello in [`../centralino`](../centralino) e
parla esattamente la stessa lingua: sono intercambiabili, e la prova che conta
— quella in cui un telefono senza nessun indirizzo della casa si abbina e la
comanda — passa identica contro tutti e due.

    cd app
    CENTRALINO_ESTERNO=ws://127.0.0.1:8787 flutter test test/integrazione/da_fuori_test.dart

## Perché esiste

Un centralino da tenere acceso è un server da pagare. Chiedere cinque euro al
mese per accendere una luce da fuori casa è il modo più rapido di far chiudere
l'app, e tutto questo progetto esiste per non chiedere niente a nessuno.

Qui non c'è niente da pagare, niente da tenere aggiornato e nessun dominio da
comprare: l'indirizzo arriva insieme.

## Il nome

Il Worker si chiama **`gdahome-centralino`**, non `centralino`, e non e' pignoleria:
il nome e' unico per account e `wrangler deploy` non chiede il permesso — se ne
trova uno che si chiama uguale, ci scrive sopra. In un account Cloudflare ci
finiscono le cose di tutti i progetti, e «centralino» e' una parola che prima o
poi qualcun altro usa.

## Metterlo in piedi

    npm install
    npx wrangler login
    npx wrangler deploy

Alla fine stampa l'indirizzo, che è fatto così:

    https://gdahome-centralino.<il-tuo-nome>.workers.dev

Quello si mette nella scheda dell'add-on, alla voce `centralino`, con `wss://`
davanti:

    centralino: wss://gdahome-centralino.<il-tuo-nome>.workers.dev

Il ponte da quel momento **chiama fuori da solo**. Nella sua console, in Home
Assistant, si vede se è arrivato.

## Come è fatto

**Una casa, un oggetto.** Ogni casa è un Durable Object suo: il filo che lei
tiene aperto e un canale per ogni telefono stanno tutti lì dentro. Due case
non si vedono, non si aspettano e non si rallentano.

**Dorme.** I fili si accettano con `acceptWebSocket` e non con `accept`: così
li tiene aperti Cloudflare e l'oggetto smette di esistere finché non arriva un
messaggio. Una casa ferma di notte non costa niente — ed è il motivo per cui
questa cosa sta dentro il piano gratuito senza sforzo.

Il prezzo di dormire è che fra un messaggio e l'altro non si può ricordare
niente a memoria: quello che serve si scrive addosso al filo
(`serializeAttachment`) o nell'archivio dell'oggetto. Una variabile d'istanza
qui dentro sarebbe un difetto che si vede solo dopo, quando la casa è rimasta
zitta abbastanza a lungo.

**Un oggettino per codice.** Un telefono che si abbina non sa a quale casa va:
sa il codice, e qui arriva solo la sua **impronta**. Ogni impronta viva ha un
oggetto suo che dice a quale casa appartiene e sparisce da solo dopo cinque
minuti. Un elenco unico sarebbe stato più semplice da scrivere e un punto solo
per cui passano gli abbinamenti di tutte le case del mondo.

## Le tre vie

| | |
|---|---|
| `GET /salute` | dice solo che è vivo |
| `WS /casa/<casa_…>` | una casa che chiama fuori |
| `WS /telefono/<casa_…>` | un telefono che va alla sua casa |
| `WS /abbinamento/<impronta>` | un telefono che si sta abbinando |

L'identificativo nell'indirizzo non è un segreto e non fa entrare: serve a
sapere quale oggetto deve ricevere il filo, e quella scelta va fatta prima di
accettarlo. Quello che fa entrare arriva subito dopo, nel primo messaggio, e
il centralino lo confronta con quello che ha in casa.

## Quello che il centralino non fa

Non verifica niente che sia un segreto. Non sa se un codice di abbinamento è
giusto — instrada sulla sua impronta, e il codice non lo vede mai. Non sa se
il segno di un telefono è buono: lo passa alla casa, che lo verifica lei. Non
guarda dentro ai messaggi: sono byte, e li sposta.

Che non li possa nemmeno leggere non è una promessa, è una prova:
[`../ponte/test/cieco.test.js`](../ponte/test/cieco.test.js) registra tutto
quello che attraversa il centralino e controlla che non ci sia dentro niente
di leggibile.

L'unica cosa che difende è che una casa non possa spacciarsi per un'altra:
se ci riuscisse, raccoglierebbe i segni dei telefoni che bussano.

## I conti del piano gratuito

Un telefono apre un filo e lo tiene: non fa richieste a raffica. Le cento mila
richieste al giorno del piano gratuito le consuma un abbinamento ogni tanto e
una riconnessione quando cade la rete — cioè niente. Il tempo di calcolo lo
paga solo quando passa un messaggio, e passare un messaggio è copiare una
stringa da un filo all'altro.

Se un giorno le case diventassero tante da uscire dal piano gratuito, sarebbe
un bel problema da avere.

## Le segnalazioni e la chat

Il centralino riceve dal ponte le segnalazioni e i messaggi della chat di
assistenza e li apre come **issue di GitHub**, in `GITHUB_REPO`
(`wrangler.toml`), col gettone `GITHUB_SEGNALAZIONI`, che e' un segreto del
worker: lo porta li' il bottone **Il centralino** su Actions, prendendolo dal
segreto `GETTONE_SEGNALAZIONI` di questa repository; o, da un terminale,

    npx wrangler secret put GITHUB_SEGNALAZIONI

Un token a grana fine, sulla sola repository delle segnalazioni, con
**Issues: Read and write**. La casa si presenta col suo segreto — lo stesso
della chiamata — e legge e scrive solo nelle issue che ha aperto lei; chi
risponde da GitHub scrive un commento, e il commento torna nell'app. I
commenti della casa portano un segno invisibile in testa, cosi' si sa chi ha
scritto cosa anche se il gettone e' uno solo. Sta in `src/segnalazioni.js`,
con le sue prove in `test/`.
