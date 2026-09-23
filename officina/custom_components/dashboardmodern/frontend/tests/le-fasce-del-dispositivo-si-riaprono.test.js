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
    /state\.letto = Date\.now\(\);([\s\S]*?)return disegna\(detto, config, nome\);/,
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
