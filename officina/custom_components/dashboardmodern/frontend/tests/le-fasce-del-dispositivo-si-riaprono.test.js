/* «Riparto fasce energia sui dispositivi non presente.»
 *
 * Dal campo, e con la precisazione che ha risolto il caso: «si vedono nella
 * parte panoramica ma dentro analisi quando seleziono i dispositivi non le
 * vedo». Quindi le fasce erano configurate coi loro prezzi — il blocco si
 * nasconde apposta quando non lo sono — e il guasto stava nell'aggancio.
 *
 * Il blocco vive dentro la scheda del dispositivo, che sta nella linguetta
 * ANALISI. Mentre si guarda PANORAMICA quella scheda non si vede, e `rifai`
 * toglie il riquadro: e' voluto, perche' un conto a ore chiesto per una scheda
 * che nessuno guarda e' esattamente il carico sul Recorder che la #553 ha
 * chiuso. A rimetterlo doveva essere il click sulla linguetta — e quel click
 * si ascoltava su `#ed-tab-disp`, che **in questa plancia non esiste**: le
 * linguette di Energia sono due, `ed-tab-pan` e `ed-tab-ana`, e una scheda
 * chiamata «disp» non c'e' mai stata.
 *
 * Cosi' il blocco spariva per davvero, e tornava solo cambiando apparecchio
 * nella tendina: cioe' il gesto che chi segnala non fa, perche' l'apparecchio
 * e' gia' scelto da prima.
 *
 * Questa prova guarda le due cose insieme — cosa ascolta la sezione e cosa c'e'
 * davvero nel guscio — perche' e' l'unico modo di accorgersi di un selettore
 * che punta al nulla: preso da solo, un selettore sbagliato e' scritto bene.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, ROOT), "utf8");

/* Gli identificativi che un selettore CSS nomina: `#questo`. */
function idNominati(selettore) {
  return [...selettore.matchAll(/#([\w-]+)/g)].map((trovato) => trovato[1]);
}

/* Il selettore che la sezione ascolta per il click sulle linguette. */
async function ilSelettoreDelleLinguette() {
  const sezione = await read("src/sections/le-fasce-del-dispositivo-section.js");
  const trovato = sezione.match(/evento\.target\?\.closest\?\.\("([^"]+)"\)\) return;/);
  assert.ok(trovato, "la sezione deve ascoltare un click con un selettore");
  return trovato[1];
}

test("la linguetta che la sezione ascolta esiste davvero nel guscio", async () => {
  const guscio = await read("legacy/dashboard.html");
  const selettore = await ilSelettoreDelleLinguette();
  const nominati = idNominati(selettore);
  assert.ok(nominati.length, "il selettore deve nominare almeno una linguetta");
  for (const id of nominati)
    assert.ok(
      guscio.includes(`id="${id}"`),
      `il guscio non ha nessun elemento con id="${id}": il click non scattera' mai`,
    );
});

test("le linguette di Energia sono quelle due, e «disp» non c'è", async () => {
  const guscio = await read("legacy/dashboard.html");
  /* I due nomi veri, cosi' come li scrive il documento vendorizzato. Se un
   * giorno cambiano, questa prova cade insieme a quella sopra — ed e' giusto:
   * il selettore va rifatto con loro. */
  assert.match(guscio, /id="ed-tab-pan"/);
  assert.match(guscio, /id="ed-tab-ana"/);
  assert.doesNotMatch(
    guscio,
    /ed-tab-disp/,
    "«disp» non e' una linguetta di questa plancia: era il nome che l'aggancio cercava",
  );
});

test("il riquadro si rifà tornando su Analisi, non solo cambiando apparecchio", async () => {
  const sezione = await read("src/sections/le-fasce-del-dispositivo-section.js");
  const selettore = await ilSelettoreDelleLinguette();
  assert.ok(
    selettore.includes("ed-tab-ana") || selettore.includes("ed-inner-tab"),
    "la linguetta ANALISI deve essere fra quelle ascoltate",
  );
  /* Gli altri due agganci restano, e servono: la tendina e' l'unico gesto che
   * cambia di chi si sta parlando, e il pacchetto del periodo e' il momento in
   * cui il guscio ridipinge la scheda. */
  assert.match(sezione, /evento\.target\?\.id === "ed-dev-selector"/);
  assert.match(sezione, /"dashboardmodern:period-bundle"/);
});

/* ── E il blocco che parla di un altro apparecchio ─────────────────────────
 *
 * «Le fasce per dispositivo non si aggiorna in base al dispositivo
 * selezionato: se metto ad esempio wallbox esce boiler.»
 *
 * Il giro e' uno per volta — sono tre entita' chieste a ore, e due giri
 * insieme sono due fette di Recorder in contemporanea — e quel «uno per
 * volta» era scritto `if (state.inCorso) return false`: la domanda che
 * arrivava mentre si aspettava non veniva rimandata, veniva **buttata**.
 *
 * Quindi: si guarda il boiler, il suo giro parte, si cambia tendina sulla
 * wallbox mentre quello e' ancora per aria — e la domanda della wallbox non
 * parte proprio. Torna la risposta del boiler, disegna il boiler, e li'
 * resta: l'evento della tendina e' gia' passato, e nessuno lo rifa'.
 *
 * Due regole, e ci vogliono tutt'e due. Chi arriva mentre si aspetta si mette
 * in coda invece di sparire; e una risposta si disegna solo se la tendina
 * mostra ancora l'apparecchio per cui era partita — se no, per un istante, il
 * blocco direbbe «Boiler» sotto la scheda della wallbox, che e' il falso
 * detto con dei numeri veri accanto.
 *
 * Si legge il sorgente, come le tre prove qui sopra: il giro alla rete vuole
 * il Recorder e il guscio di Energia, e in questa cartella non ci sono. Quello
 * che si difende qui e' che le due regole ci siano scritte — il caso che le ha
 * fatte nascere non lascia traccia in nessuna funzione pura.
 */

test("la domanda che arriva mentre si aspetta si mette in coda, non si perde", async () => {
  const sezione = await read("src/sections/le-fasce-del-dispositivo-section.js");
  const dentro = sezione.match(/if \(state\.inCorso\) \{([\s\S]*?)\n  \}/);
  assert.ok(dentro, "il giro deve restare uno per volta");
  assert.match(
    dentro[1],
    /state\.dopo = true/,
    "chi trova il giro occupato deve segnarsi, non sparire",
  );
  /* E chi finisce deve guardare se c'è qualcuno in coda. */
  assert.match(sezione, /if \(state\.dopo\) \{\s*\n\s*state\.dopo = false;/);
  assert.match(sezione, /state\.dopo = false;[\s\S]{0,400}rifai\(true\)/);
});

test("non si disegna il conto di un apparecchio che non è più quello scelto", async () => {
  const sezione = await read("src/sections/le-fasce-del-dispositivo-section.js");
  /* Fra il `disegna` della risposta e la riga sopra ci deve stare il
   * confronto con quello che la tendina mostra **adesso**, riletto dal
   * documento: il valore preso prima dell'attesa e' proprio quello che non
   * vale piu'. */
  const finale = sezione.match(
    /state\.letto = Date\.now\(\);([\s\S]*?)const fatto = disegna\(detto, config, nome\);/,
  );
  assert.ok(finale, "la risposta deve finire con un disegno");
  assert.match(
    finale[1],
    /getElementById\("ed-dev-selector"\)\?\.value\) !== scelto\) return false;/,
    "prima di disegnare si rilegge la tendina",
  );
});

test("cambiando apparecchio il blocco vecchio si toglie subito", async () => {
  const sezione = await read("src/sections/le-fasce-del-dispositivo-section.js");
  assert.match(
    sezione,
    /if \(state\.chiave && state\.chiave !== chiave\) togliIlRiquadro\(\);/,
    "un blocco che parla di un altro apparecchio non resta appeso ad aspettare",
  );
});

test("la chiave del conto tiene dentro l'apparecchio, se no due si confondono", async () => {
  const { chiaveDelConto } = await import(
    "../src/sections/le-fasce-del-dispositivo-section.js"
  );
  const periodo = { year: 2026, month: 9 };
  assert.notEqual(
    chiaveDelConto("sensor.wallbox", periodo, 0.3),
    chiaveDelConto("sensor.boiler", periodo, 0.3),
  );
});

/* «Seleziono la prima volta boiler e non lo porta: seleziono un altro
 * dispositivo, poi ritorno su boiler e lo carica.»
 *
 * Il giro dopo quello della linguetta sbagliata, e lo stesso blocco. Il click
 * adesso si sente — si ascolta in CATTURA, cioe' prima che il guscio faccia
 * qualunque cosa — e un istante dopo la scheda del dispositivo non si vede
 * ancora: il guscio la deve ancora aprire. `rifai` la trova chiusa, e faceva
 * due cose sbagliate insieme: non disegnava (giusto) e buttava via il conto
 * appena fatto (sbagliato). Nessuno ripassava, e il blocco tornava solo
 * cambiando apparecchio nella tendina — che e' il gesto raccontato dal campo.
 *
 * Riscegliere lo STESSO apparecchio non genera nessun evento: per questo
 * bisognava passare da un altro e tornare indietro.
 *
 * Due regole, e ci vogliono tutt'e due: la scheda chiusa non fa dimenticare il
 * conto, e dopo il tocco si riprova piu' di una volta, perche' quando il
 * guscio avra' finito di aprirla non lo dice nessuno.
 */

test("la scheda che non si vede toglie il riquadro ma non butta il conto", async () => {
  const sezione = await read("src/sections/le-fasce-del-dispositivo-section.js");
  const chiusa = sezione.match(/if \(!scelto \|\| !laSchedaSiVede\(\)\) \{([\s\S]*?)\n  \}/);
  assert.ok(chiusa, "la sezione deve fermarsi quando la scheda non si vede");
  assert.match(
    chiusa[1],
    /togliIlRiquadro\(false\)/,
    "scheda chiusa: si toglie il riquadro, il conto resta in tasca",
  );
  /* E il ripiego deve esistere per davvero: `false` senza un `scorda` che lo
   * legga sarebbe una rassicurazione scritta e basta. */
  const togli = sezione.match(/function togliIlRiquadro\(([^)]*)\) \{([\s\S]*?)\n\}/);
  assert.ok(togli, "togliIlRiquadro deve esserci");
  assert.match(togli[1], /scorda/, "togliIlRiquadro deve poter NON scordare");
  assert.match(
    togli[2],
    /if \(!scorda\) return;[\s\S]*state\.detto = null/,
    "con scorda a false il conto non si azzera",
  );
});

test("dopo il tocco sulla linguetta si riprova più di una volta", async () => {
  const sezione = await read("src/sections/le-fasce-del-dispositivo-section.js");
  const dopoIlClick = sezione.match(
    /closest\?\.\("\.ed-inner-tab[^"]*"\)\) return;([\s\S]*?)\n    \},/,
  );
  assert.ok(dopoIlClick, "il click sulle linguette deve fare qualcosa");
  const attese = [...dopoIlClick[1].matchAll(/\b(\d+)\b/g)].map((trovato) => Number(trovato[1]));
  assert.ok(
    attese.length > 1,
    "una passata sola torna quando la scheda e' ancora chiusa: ce ne vuole piu' d'una",
  );
  assert.ok(
    Math.max(...attese) >= 250,
    "l'ultima passata deve arrivare dopo che il guscio ha aperto la scheda",
  );
});

/* E i tre euro del mese vengono da una fonte sola.
 *
 * «Il costo riportato in alto non si trova con quello riportato sotto dalle
 * fasce.» In alto la stima al prezzo medio, sotto la misura ora per ora: due
 * conti diversi sulla stessa scheda, a dieci centimetri uno dall'altro.
 *
 * Adesso il blocco, appena ha il conto vero, lo passa alla card — e a
 * scrivere nella card resta la card: chi misura non tocca il documento. Qui si
 * difende quel passaggio, e che i tre euro del mese (il totale, il
 * risparmiato, lo speso) escano tutti e tre dalla stessa fonte: se uno solo
 * restasse la stima, la somma in cima non tornerebbe piu' con le due tessere
 * sotto, che e' il difetto di prima rifatto piu' piccolo.
 */

test("il blocco passa alla scheda il conto misurato, e non le scrive dentro", async () => {
  const sezione = await read("src/sections/le-fasce-del-dispositivo-section.js");
  assert.match(
    sezione,
    /segnaIlContoMisurato\(scelto, periodo, \{\s*euro: detto\.euro,\s*valoreDelSole: detto\.valoreDelSole,/,
    "il conto si passa: euro dalla rete e valore del sole, per quell'apparecchio e quel mese",
  );
  /* Le due caselle della card non le tocca nessun altro. */
  assert.ok(!sezione.includes("ed-dkpi-costo-eur"), "nel documento della card scrive la card");
  assert.ok(!sezione.includes("ed-dkpi-risp-eur"));
});

test("i tre euro del mese vengono tutti dalla stessa fonte", async () => {
  const energia = await read("src/sections/energy-section.js");
  assert.match(
    energia,
    /const misurato = ilContoMisurato\(entity, bundle\.period\);/,
    "la card chiede se qualcuno ha misurato questo apparecchio in questo mese",
  );
  assert.match(energia, /risparmioMese = misurato \? misurato\.valoreDelSole :/);
  assert.match(energia, /spesaMese = misurato \? misurato\.euro :/);
  /* Il totale in cima e' la somma delle due tessere, non un terzo conto. */
  assert.match(energia, /"ed-dkpi-mese-eur", `€ \$\{formatNumber\(risparmioMese \+ spesaMese, 2\)\}`/);
  assert.match(energia, /"ed-dkpi-risp-eur", `\+ \$\{formatNumber\(risparmioMese, 2\)\}/);
  assert.match(energia, /"ed-dkpi-costo-eur", `- \$\{formatNumber\(spesaMese, 2\)\}/);
});

/* «Le fasce continuano a non uscire nella sezione analisi dei dispositivi.»
 *
 * Terzo giro sullo stesso blocco, e stavolta la causa era sotto le altre due:
 * il posto in cui si appende. Lo cercava in due modi e dal campo hanno fallito
 * tutti e due.
 *
 * Il primo guardava l'elemento subito dopo il titolo dell'anno, aspettandosi
 * la riga delle tessere. Sulla wallbox li' c'e' il riquadro verde dei
 * kilowattora che il contatore aveva gia' fatto prima delle statistiche — sul
 * boiler no, e infatti sul boiler il blocco si vedeva.
 *
 * Il secondo, il ripiego, diceva `.ed-dev-cost-row:last-of-type`. In CSS
 * `:last-of-type` vuol dire ULTIMO ELEMENTO DI QUEL TAG fra i fratelli, non
 * ultimo con quella classe: dopo le tessere ci sono le righe «Spartizione
 * misurata/stimata», che sono `div` anche loro, e quel selettore non trovava
 * mai niente. Due modi che si somigliano e nessuno dei due dice quello che
 * serve — verificato in un browser vero, con la forma esatta della scheda.
 */

test("il posto del blocco è l'ultima riga di tessere, contata", async () => {
  const sezione = await read("src/sections/le-fasce-del-dispositivo-section.js");
  const dentro = sezione.match(/function ilRiquadro\(crea = false\) \{([\s\S]*?)if \(!ultimo\) return null;/);
  assert.ok(dentro, "ilRiquadro deve cercarsi un posto");
  assert.match(
    dentro[1],
    /querySelectorAll\?\.\("\.ed-dev-cost-row"\)/,
    "le righe di tessere si contano tutte",
  );
  assert.match(dentro[1], /righe\[righe\.length - 1\]/, "e si prende l'ultima");
  /* E i due modi che hanno fallito non tornano: `:last-of-type` non vuol dire
   * «l'ultima con questa classe», e il titolo dell'anno non ha per forza le
   * tessere subito sotto. */
  assert.ok(
    !/querySelector[^\n]*last-of-type/.test(sezione),
    "«:last-of-type» guarda il tag, non la classe: non trovava mai la riga",
  );
  assert.ok(!sezione.includes("ed-dkpi-year-lbl"), "dopo il titolo dell'anno può esserci dell'altro");
});

test("il blocco sta sotto la riga della provenienza, non fra lei e le sue tessere", async () => {
  const sezione = await read("src/sections/le-fasce-del-dispositivo-section.js");
  assert.match(
    sezione,
    /const strada = ultimo\.nextElementSibling;[\s\S]{0,200}classList\?\.contains\("dm-ed-strada"\) \? strada : ultimo/,
    "quel posto è della riga «Spartizione…»: il blocco va dopo",
  );
  /* E la scheda si riprende le copie rimaste: erano tre in fila sullo schermo
   * di casa, una per ogni ridisegno che non trovava piu' la sua. */
  const energia = await read("src/sections/energy-section.js");
  assert.match(
    energia,
    /while \(riga\.nextElementSibling\?\.classList\?\.contains\("dm-ed-strada"\)\)\s*\n?\s*riga\.nextElementSibling\.remove\(\);/,
    "le righe doppie si tolgono",
  );
});

test("il conto misurato si passa alla scheda dopo aver disegnato, non prima", async () => {
  const sezione = await read("src/sections/le-fasce-del-dispositivo-section.js");
  const coda = sezione.match(/const fatto = disegna\(detto, config, nome\);([\s\S]*?)return fatto;/);
  assert.ok(coda, "prima si disegna il proprio blocco");
  assert.match(
    coda[1],
    /segnaIlContoMisurato\(scelto, periodo/,
    "e solo dopo si passa il conto alla scheda, che si ridipinge",
  );
});
