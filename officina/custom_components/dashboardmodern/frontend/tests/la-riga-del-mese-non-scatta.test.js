/* «Sezione report non va bene: c'è qualcosa che si aggiorna con layout
 * differenti, la riga sotto a mese e anno prima ha una grafica poi cambia.»
 *
 * Misurato in Chromium, a 412 pixel di larghezza — un telefono — sulla pagina
 * vera: la riga del periodo era alta 77 pixel al primo disegno e 96 nel
 * momento in cui il pacchetto arrivava e le tre pastiglie del mese venivano
 * scritte. Diciannove pixel di salto, e tutto quello che sta sotto — le due
 * linguette, le tessere, il grafico — che scende insieme.
 *
 * A 1280 pixel non si muoveva di un pixel, ed è il motivo per cui da un
 * computer questo difetto non si vede: lì le pastiglie stanno in fila con le
 * due tendine, mentre sotto ai 640 la riga diventa una colonna e loro si
 * prendono un rigo tutto loro. Un rigo che al primo disegno non c'è ancora.
 *
 * La cura è tenere il posto invece di riempirlo dopo. Qui si difende che il
 * posto sia tenuto: la regola c'è, sta nella misura che vale — sotto ai 640 —
 * e vale esattamente quanto è alta una pastiglia.
 *
 * Il numero non si indovina e non si arrotonda per eccesso: venti pixel è
 * quanto misura la pastiglia sul telefono (quattro di margine, dodici di testo
 * a dieci punti, quattro sotto), ed è stato trovato aprendo la pagina e
 * confrontando la riga vuota con la riga piena finché i due numeri non sono
 * stati lo stesso numero. Un pixel in più lascerebbe un filo di bianco che non
 * serve; uno in meno rimetterebbe lo scatto, più piccolo.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, ROOT), "utf8");

test("il posto delle pastiglie del mese è tenuto da subito, sul telefono", async () => {
  const sezione = await read("src/sections/energy-report-polish-section.js");
  const stretto = sezione.match(/@media \(max-width:640px\)\{([\s\S]*?)\n    \}/);
  assert.ok(stretto, "la regola deve valere sotto ai 640, dove la riga va in colonna");
  assert.match(
    stretto[1],
    /#ed-yoy-chips\{min-height:20px!important\}/,
    "le pastiglie tengono il loro rigo anche da vuote",
  );
});

test("su schermo largo non si tiene niente: lì le pastiglie stanno in riga", async () => {
  const sezione = await read("src/sections/energy-report-polish-section.js");
  /* Fuori dal media query `#ed-yoy-chips` non deve comparire: là le pastiglie
   * seguono le tendine e un'altezza minima sarebbe spazio preso per niente. */
  const fuori = sezione.replace(/@media \(max-width:640px\)\{[\s\S]*?\n    \}/g, "");
  assert.doesNotMatch(fuori, /#ed-yoy-chips\s*\{/);
});

test("la riga delle pastiglie resta una riga sola, se no il conto non torna", async () => {
  /* Venti pixel tengono il posto di UNA pastiglia. Il guscio ne scrive al
   * massimo tre e le lascia andare a capo (`flex-wrap`): finché stanno in un
   * rigo la misura è giusta, e se un giorno il guscio ne aggiungesse una
   * quarta tornerebbe a saltare — di meno, ma tornerebbe. Questa prova conta
   * quante ne scrive chi le scrive. */
  const energia = await read("src/sections/energy-section.js");
  const blocco = energia.match(/const chips = doc\?\.getElementById\("ed-yoy-chips"\);([\s\S]*?)\n  \}/);
  assert.ok(blocco, "le pastiglie le scrive la sezione Energia");
  const quante = [...blocco[1].matchAll(/class="ed-yoy-chip"/g)].length;
  assert.equal(quante, 3, `le pastiglie sono ${quante}: la misura tenuta è per un rigo solo`);
});
