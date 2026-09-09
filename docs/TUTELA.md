# Tutelare il lavoro

Questo documento non parla di soldi. Parla di **paternità**: fare in modo che
il lavoro fatto non venga preso, rimaneggiato e presentato come di qualcun
altro — e che se succede, si veda e si possa dimostrare.

È un problema diverso da quello degli acquisti ([`ACQUISTI.md`](ACQUISTI.md)),
e la differenza va detta subito perché cambia tutto:

> **Contro la pirateria non si vince.** Il codice gira sulla macchina di chi lo
> usa, e chi ha quella macchina comanda. Qualunque controllo si scriva, si può
> togliere.
>
> **Contro l'appropriazione si vince**, ed è tutta un'altra partita. Non si
> tratta di impedire un'azione — si tratta di renderla **riconoscibile**,
> **dimostrabile** e **costosa**. Tutte e tre le cose si possono fare, e non
> costano quasi niente.

## Il primo pezzo: la copia dice cosa è

*Fatto. Vedi `ponte/src/provenienza.js`.*

Quando `porta-la-plancia.mjs` porta DashboardModern dentro l'add-on, scrive in
`ponte/plancia/ORIGINE.json` l'impronta SHA-256 di **ogni** file — sono
ottocento — più un **sigillo**, che è l'impronta della lista. Il ponte
ricontrolla tutto all'avvio e scrive il verdetto nel registro e nella console.

Quattro risposte possibili, e si dicono tutte e quattro senza girarci intorno:

| verdetto | vuol dire |
|---|---|
| **originale, firma verificata** | ogni file è quello pubblicato, e la firma lo conferma |
| **i file tornano, senza firma** | intatta, ma nessuna firma valida la accompagna |
| **modificata** | qualcosa non è come è stato pubblicato — e dice **quali** file |
| **provenienza sconosciuta** | non porta le impronte: non è arrivata da qui |

Il secondo pezzo è la **firma** (`strumenti/firma-la-plancia.mjs`). Le impronte
da sole fermano chi modifica; non chi rigenera anche `ORIGINE.json`. La firma
sì: il sigillo è firmato Ed25519, la chiave pubblica sta dentro l'add-on di
tutti, quella privata no. Chi rimaneggia può rifare impronte e sigillo, ma non
la firma — e la sua copia resta «non firmata» per sempre.

**Cosa non fa, ed è giusto dirlo.** Non impedisce a nessuno di modificare la
sua copia e usarla: chi vuole toglie anche questo controllo, che sta nel codice
come tutto il resto. Serve a rendere una copia rimaneggiata **riconoscibile in
due secondi da chi la riceve**, e a togliere a chi la distribuisce la
possibilità di dire «è l'originale».

### Come si mette in piedi la firma

La chiave si fabbrica una volta sola:

    node strumenti/firma-la-plancia.mjs --fabbrica

Stampa due cose. La **pubblica** si incolla in `ponte/src/provenienza.js`, alla
voce `CHIAVE_DI_CHI_PUBBLICA`. La **privata** va in un segreto di GitHub
(Settings → Secrets and variables → Actions) con nome `CHIAVE_DELLA_PLANCIA`, e
non esce mai da lì: si firma dentro il flusso che pubblica l'add-on, così non
tocca mai un computer. Senza terminale, il modo è lanciare `--fabbrica` una
volta da un'azione di GitHub e copiare l'uscita.

Se la privata si perde, se ne fa un'altra e si cambia la pubblica. Se **esce**,
chiunque può firmare a nome tuo: si cambia subito, e le copie vecchie tornano
non firmate.

## Il secondo pezzo: dimostrare che è tuo, e da quando

*Da fare. Costa mezz'ora e vale più di tutto il resto messo insieme.*

Se un giorno qualcuno dice «questo l'ho scritto io», quello che decide non è il
codice: è **chi può provare di averlo avuto prima**. Tre cose, in ordine di
valore:

1. **Firmare i commit e le etichette** (`git commit -S`, `git tag -s`). Ogni
   commit diventa una dichiarazione firmata e datata di paternità. Su GitHub
   compare il bollino «Verified». Gratis, permanente, e nessuno può fabbricare
   a posteriori una storia firmata dalla tua chiave.
2. **Firmare gli artefatti dei rilasci** — l'APK e il pacchetto dell'add-on —
   e pubblicare le impronte accanto al rilascio. Chi scarica può verificare;
   chi ridistribuisce non può.
3. **Tenere le repository private finché non serve altrimenti**, che è già
   quello che si sta facendo. Il codice che nessuno ha non viene copiato.

## Il terzo pezzo: accorgersene

*Da fare, e va fatto in modo pigro: un controllo ogni tanto, non una guardia.*

Se una copia gira in giro, il modo di saperlo è cercarla:

- una ricerca periodica su GitHub di due o tre **stringhe caratteristiche** del
  codice — non parole comuni, ma frasi che stanno solo qui;
- il centralino sa quali case chiedono il rinnovo di un diritto: se un diritto
  firmato per una casa comincia a comparire da quaranta case, si vede. Non
  serve bloccare — serve **saperlo**, perché «qualcuno l'ha crackata» e
  «qualcuno la sta rivendendo» sono due problemi con due risposte diverse.

## Il quarto pezzo: la licenza

*Fatto. `LICENSE` nella radice, e `dashboardmodern-v2` ne ha già una sua.*

È lo strumento che copre tutto quello che la tecnica non può. Le clausole che
contano per questo documento sono tre:

- **3(a) e 3(b)** — vietata la ridistribuzione, in qualunque forma, e la
  pubblicazione su qualunque negozio o repository di add-on;
- **3(e)** — vietato togliere o alterare avvisi di copyright, attribuzioni,
  **record di provenienza, firme e controlli di integrità**, o presentare il
  lavoro come non proveniente dall'autore;
- **3(g)** — vietato usare i nomi e il marchio per un prodotto derivato o
  concorrente.

Chi ridistribuisce una copia rimaneggiata viola tutte e tre. La rimozione
**dolosa** di una firma è anche, in molti ordinamenti, un illecito a sé — ed è
esattamente per questo che la Sezione 5 nomina la provenienza per esteso.

E il rimedio pratico esiste ed è gratuito: una richiesta di rimozione a GitHub,
a Google Play o all'App Store. Funziona, e funziona in giorni.

## Quello che si è deciso di non fare

Sono tutte cose che sembrano rafforzare e invece indeboliscono.

- **Offuscare il codice della plancia.** Contro chi copia e rimarchia sarebbe
  un ostacolo vero, ed è la tentazione più forte. Ma la plancia si è deciso di
  non toccarla (è il paletto del binario A: si porta dentro com'è e si aggiorna
  rilanciando uno script), e un minificatore che rinomina le funzioni globali
  romperebbe i `onclick="editorSwitch(...)"` scritti nel corpo della pagina.
  Un giorno si può fare, ma va fatto sulla dashboard a monte, non qui.
- **Spostare pezzi sul centralino** perché non siano copiabili. Ucciderebbe la
  promessa che tutto resta in casa dell'utente, che è il motivo per cui il
  progetto esiste.
- **Far cadere il ponte quando la provenienza non torna.** Sarebbe un controllo
  che fa danno a chi non ha fatto niente di male: un file corrotto da un disco,
  un aggiornamento a metà, e la casa smette di funzionare. Si **dice**, non si
  blocca.
- **Marchiare ogni copia con un identificativo nascosto.** Si toglie in cinque
  minuti, e intanto è una cosa che l'utente non sa di avere addosso.

## Cosa c'è e cosa manca

| pezzo | dove | stato |
|---|---|---|
| Impronta di ogni file e sigillo | `strumenti/porta-la-plancia.mjs` | ✅ |
| La verifica, e il verdetto in una riga | `ponte/src/provenienza.js` | ✅ |
| Il verdetto nel registro all'avvio | `ponte/src/index.js` | ✅ |
| La scheda «La plancia» nella console | `ponte/console/` | ✅ |
| Le prove: file cambiato, aggiunto, sparito, firma altrui | `ponte/test/provenienza.test.js` | ✅ |
| Lo strumento che firma | `strumenti/firma-la-plancia.mjs` | ✅ |
| La chiave fabbricata, la pubblica incollata, la privata nel segreto | — | ⬜ **da fare** |
| La firma dentro il flusso che pubblica l'add-on | `.github/workflows/` | ⬜ |
| Commit ed etichette firmati | git | ⬜ |
| Impronte degli artefatti accanto ai rilasci | `.github/workflows/` | ⬜ |
| La ricerca periodica delle stringhe caratteristiche | — | ⬜ |
