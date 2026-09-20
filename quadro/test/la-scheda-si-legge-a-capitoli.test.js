/* La scheda di una casa si legge a capitoli.
 *
 * Era una colonna di dieci riquadri, ognuno con la sua etichettina grigia in
 * cima. Dieci etichettine sono dieci cose sullo stesso piano: chi apre la
 * scheda di un impianto per sapere **cosa gli tocca** se le legge tutte e
 * dieci prima di trovarlo, e i controlli — che sono la risposta — stanno in
 * mezzo alla macchina e alle versioni.
 *
 * I capitoli sono tre perche' le domande sono tre: cosa mi tocca, come sta,
 * cos'e' di preciso. Questa prova tiene che ci siano tutti e tre e **in
 * quest'ordine**: un capitolo tolto per sbaglio non fa cadere niente e non si
 * vede finche' qualcuno non apre la pagina.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const QUI = dirname(fileURLToPath(import.meta.url));
const PAGINA = readFileSync(join(QUI, "..", "console", "index.html"), "utf8");

test("i quattro capitoli ci sono, e in quest'ordine", () => {
  const titoli = [...PAGINA.matchAll(/<div class="capitolo">\s*<h2>([^<]+)<\/h2>/g)].map((una) =>
    una[1].trim(),
  );
  /* «Le plance» sta dopo lo stato e prima dei dettagli: e' una cosa che si
   * sceglie una volta, non una che si controlla ogni mattina. */
  assert.deepEqual(titoli, ["Da fare", "Stato dell'impianto", "Le plance", "Dettagli tecnici"]);
});

test("ogni capitolo dice sottovoce cosa ci si trova dentro", () => {
  /* Il titolo da solo divide e non spiega: «Come sta» sopra quattro riquadri
   * non dice quali quattro. La riga di fianco e' quella che fa risparmiare lo
   * scorrimento. */
  const righe = [...PAGINA.matchAll(/<div class="capitolo">\s*<h2>[^<]+<\/h2>\s*<span>([^<]+)</g)];
  assert.equal(righe.length, 4, "un capitolo e' rimasto senza la sua riga di spiegazione");
  for (const [, riga] of righe) {
    assert.ok(riga.trim().length > 12, `«${riga.trim()}» non spiega niente`);
  }
});

test("i controlli e gli aggiornamenti stanno nel primo capitolo", () => {
  /* E' la regola che i capitoli servono a tenere: quello che questa casa
   * **chiede** sta tutto insieme e sta in cima. Se un giorno «Gli
   * aggiornamenti» scivolasse sotto «Come sta», la scheda tornerebbe a essere
   * un elenco e nessuno se ne accorgerebbe. */
  const dove = (che) => PAGINA.indexOf(che);
  const primo = dove("<h2>Da fare</h2>");
  const secondo = dove("<h2>Stato dell'impianto</h2>");
  const terzo = dove("<h2>Le plance</h2>");
  const quarto = dove("<h2>Dettagli tecnici</h2>");
  assert.ok(
    primo > 0 && secondo > primo && terzo > secondo && quarto > terzo,
    "i capitoli non sono in fila",
  );

  for (const [che, quale] of [
    ["<h3>I controlli</h3>", "i controlli"],
    ["${gliAggiornamenti(c, casa)}", "gli aggiornamenti"],
  ]) {
    const sta = dove(che);
    assert.ok(sta > primo && sta < secondo, `${quale} non sta piu' nel primo capitolo`);
  }
  for (const che of ["${laMacchina(c)}", "<h3>I dispositivi non collegati</h3>"]) {
    const sta = dove(che);
    assert.ok(sta > secondo && sta < terzo, `«${che}» non sta piu' nel secondo capitolo`);
  }
  const vesti = dove("${leVestiDellePlance(casa, c)}");
  assert.ok(vesti > terzo && vesti < quarto, "le vesti delle plance non stanno nel terzo capitolo");
  assert.ok(dove("<h3>Le versioni</h3>") > quarto, "le versioni non stanno piu' nell'ultimo");
});
