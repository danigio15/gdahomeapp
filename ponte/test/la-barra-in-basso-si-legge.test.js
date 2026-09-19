/* Le scritte della barra in basso non si accavallano.
 *
 * Su un tablet si leggeva cosi':
 *
 *     HOME   ENERGELÆTTRODOMESTIAUTGESTIONE TERMICGA…
 *
 * Cinque voci, e le loro scritte una sopra l'altra. Il motivo: la barra e'
 * larga quanto le serve (`min-width: max-content`), ma quando le voci sono
 * tante lo schermo la taglia; allora le linguette si stringono fino al loro
 * minimo e il testo, che non aveva **nessun** limite, usciva dal suo riquadro
 * e finiva addosso a quello di fianco.
 *
 * Una prova sul foglio di stile e non sulla pagina disegnata, e si sa cosa
 * vale: dice che le regole ci sono, non che il risultato e' bello. Ma la
 * regola che manca e' esattamente quello che e' successo, e questa non la fa
 * sparire di nuovo — in un file di quattromila righe che nessuno rilegge, una
 * riga tolta per sbaglio non si vede finche' qualcuno non apre un tablet.
 *
 * Tutt'e due le lingue: i due fogli sono copie, e una sistemata su una sola
 * vuol dire il guasto che resta per chi ha la plancia in inglese.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const iFogli = ["it", "en"].map((lingua) => [
  lingua,
  readFileSync(
    fileURLToPath(new URL(`../plancia/legacy/dashboard-runtime-${lingua}.css`, import.meta.url)),
    "utf8",
  ),
]);

/* Il blocco di una regola, dal selettore alla graffa che lo chiude. */
function laRegola(foglio, selettore) {
  const dove = foglio.indexOf(`${selettore} {`);
  if (dove < 0) return "";
  const fine = foglio.indexOf("}", dove);
  return fine < 0 ? "" : foglio.slice(dove, fine);
}

test("una scritta lunga si taglia coi puntini invece di uscire dalla sua linguetta", () => {
  for (const [lingua, foglio] of iFogli) {
    const regola = laRegola(foglio, "nav.tabs.bottom-nav-bar .tab .text");
    assert.ok(regola, `in ${lingua} la regola della scritta non c'e' piu'`);
    for (const serve of [
      /overflow:\s*hidden/,
      /text-overflow:\s*ellipsis/,
      /white-space:\s*nowrap/,
      /max-width:/,
    ]) {
      assert.match(regola, serve, `in ${lingua} manca ${serve} sulla scritta`);
    }
  }
});

test("una voce lunga non si prende il posto delle altre", () => {
  for (const [lingua, foglio] of iFogli) {
    const regola = laRegola(foglio, "nav.tabs.bottom-nav-bar .tab");
    assert.match(regola, /max-width:/, `in ${lingua} una linguetta puo' allargarsi quanto vuole`);
    assert.match(
      regola,
      /overflow:\s*hidden/,
      `in ${lingua} una linguetta lascia uscire quello che ha dentro`,
    );
  }
});

test("la barra non esce dallo schermo: quello che non ci sta si raggiunge scorrendo", () => {
  for (const [lingua, foglio] of iFogli) {
    const regola = laRegola(foglio, "nav.tabs.bottom-nav-bar");
    assert.match(
      regola,
      /max-width:\s*calc\(100vw/,
      `in ${lingua} la barra puo' essere piu' larga dello schermo`,
    );
    assert.match(
      regola,
      /overflow-x:\s*auto/,
      `in ${lingua} quello che esce dalla barra non si raggiunge`,
    );
  }
});
