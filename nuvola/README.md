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

Quello si scrive **dentro l'add-on**, non nella sua scheda: nella scheda una
casella per l'indirizzo non c'è più, e il perché sta in
[`../ponte/README.md`](../ponte/README.md#da-fuori-casa) — una casella che non
va toccata è una casella che prima o poi qualcuno tocca.

Quindi: si tiene una copia locale dell'add-on (la cartella `ponte` dentro
`addons` di Home Assistant), e una volta sola —

    node strumenti/centralino.mjs wss://gdahome-centralino.<il-tuo-nome>.workers.dev

che scrive i tre posti dove quell'indirizzo sta: il difetto dell'add-on, quello
dell'app e quello della chat. Poi **Negozio degli add-on → Ricarica**, e si
installa (o si ricostruisce) da lì.

Il ponte da quel momento **chiama fuori da solo**. Nella sua console, in Home
Assistant, sotto «Da fuori casa» c'è scritto a quale indirizzo — ed è lì che si
controlla che sia il proprio e non quello di gdahome.

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

## Le segnalazioni

Il centralino riceve dal ponte le segnalazioni e le apre come **issue di
GitHub**, in `GITHUB_REPO`
(`wrangler.toml`), col gettone `GITHUB_SEGNALAZIONI`, che e' un segreto del
worker: lo porta li' il bottone **Il centralino** su Actions, prendendolo dal
segreto `GETTONE_SEGNALAZIONI` di questa repository; o, da un terminale,

    npx wrangler secret put GITHUB_SEGNALAZIONI

**Le issue in una repository, le foto in un'altra.** Le issue vanno dove la
gente le cerca — `gdahomeapp`, quella del progetto — e le foto e i video no:
gli allegati non sono allegati di GitHub, si **committano** sotto
`allegati/<numero>/` e restano nella storia di git per sempre. E `gdahomeapp`
e' la repository che Home Assistant **clona** per installare l'add-on: le foto
delle case degli altri le farebbero scaricare a tutti, a ogni installazione,
per sempre. Quindi `GITHUB_REPO_ALLEGATI` punta altrove; lasciandola vuota si
torna a una sola, come prima.

Un token a grana fine con **Issues: Read and write** su quella delle issue e
**Contents: Read and write** su quella degli allegati. Il bottone **Il
centralino** le prova tutte e due prima di accendere niente, e se il permesso
sui file manca lo dice — le segnalazioni vanno lo stesso, gli allegati no.
La casa si presenta col suo segreto — lo stesso
della chiamata — e legge e scrive solo nelle issue che ha aperto lei; chi
risponde da GitHub scrive un commento, e il commento torna nell'app. I
commenti della casa portano un segno invisibile in testa, cosi' si sa chi ha
scritto cosa anche se il gettone e' uno solo. Sta in `src/segnalazioni.js`,
con le sue prove in `test/`.

La **chat di assistenza** da qui non passa, e prima passava: era una issue
sola per casa, con l'etichetta «chat». Chiedere aiuto non e' segnalare un
difetto — si incolla un pezzo di configurazione, il nome delle proprie
entita' — e non si chiede a nessuno di farlo su una pagina che chiunque puo'
leggere. Quella e' la chat della dashboard, ha un centralino suo, e la fa il
ponte (`ponte/src/chat.js`).

Gli **allegati** — foto e video — arrivano dal ponte in binario, con
`POST /casa/<id>/segnalazioni/<n>/allegati`, il tipo nel `content-type` e il
nome in `x-gdahome-nome`. Il centralino li mette nella
repository con l'API dei contenuti, sotto `allegati/<n>/`, e scrive sotto la
issue un commento col nome, il peso e il link. Dieci megabyte al massimo, e
solo foto e video: e' un tetto che vale uguale nell'app, nel ponte e qui.
