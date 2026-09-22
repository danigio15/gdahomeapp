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
