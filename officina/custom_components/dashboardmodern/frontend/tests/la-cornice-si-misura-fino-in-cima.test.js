/* «Controlla i margini su iPhone… sta storia dei margini sta diventando una
 * tortura»: dentro l'app di Home Assistant, sotto l'orologio, una striscia del
 * colore di Home Assistant e poi un'altra vuota, prima della testata.
 *
 * La plancia sta in due cornici, una dentro l'altra: quella della tessera di
 * Home Assistant (l'ingress) e, dentro, quella `srcdoc` del guscio. Per sapere
 * quanto della fascia dell'orologio scansa gia' Home Assistant si guardava il
 * riquadro della cornice **rispetto a chi la contiene**: la cornice interna
 * comincia sempre a zero dentro quella dell'ingress, e la fascia si scansava
 * due volte. Qui la posizione si somma cornice per cornice fino in cima.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { cimaDiSistema, fondoDiSistema, laCorniceNellaCima } from "../src/core/fondo-di-sistema.js";

/* Una finestra finta: la sua cornice ha un riquadro, e sta in una madre. */
function finestra(madre, riquadro) {
  const w = { frameElement: riquadro ? { getBoundingClientRect: () => riquadro } : null };
  w.parent = madre ?? w;
  return w;
}

test("due cornici una dentro l'altra: la cima e' la somma, non l'ultima", () => {
  const cima = finestra(null, null);
  /* Home Assistant mette la tessera sotto l'orologio: 59 punti. */
  const ingress = finestra(cima, { top: 59, height: 785 });
  /* Il guscio mette la plancia a zero dentro l'ingress. */
  const plancia = finestra(ingress, { top: 0, height: 785 });
  const dove = laCorniceNellaCima(plancia);
  assert.deepEqual(dove, { sopra: 59, sotto: 844 });
  /* E il conto: la fascia l'ha gia' scansata Home Assistant, a noi niente. */
  assert.equal(cimaDiSistema(0, 59, dove.sopra), 0);
  /* Col vecchio conto — solo l'ultima cornice — tornava 59: due volte. */
  assert.equal(cimaDiSistema(0, 59, 0), 59);
});

test("col chiosco la tessera parte dal vetro, e la fascia e' nostra", () => {
  const cima = finestra(null, null);
  const ingress = finestra(cima, { top: 0, height: 844 });
  const plancia = finestra(ingress, { top: 0, height: 844 });
  const dove = laCorniceNellaCima(plancia);
  assert.equal(cimaDiSistema(0, 59, dove.sopra), 59);
  /* E in fondo: la cornice arriva al vetro, la fascia dei gesti e' nostra. */
  assert.equal(fondoDiSistema(0, 34, 844 - dove.sotto), 34);
});

test("in fondo lo stesso: quello che Home Assistant lascia sotto non si rilascia", () => {
  const cima = finestra(null, null);
  const ingress = finestra(cima, { top: 59, height: 751 });
  const plancia = finestra(ingress, { top: 0, height: 751 });
  const dove = laCorniceNellaCima(plancia);
  assert.equal(dove.sotto, 810);
  assert.equal(fondoDiSistema(0, 34, 844 - dove.sotto), 0);
});

test("fuori da ogni cornice non si sa niente, e una cornice chiusa non rompe", () => {
  assert.equal(laCorniceNellaCima(finestra(null, null)), null);
  const chiusa = {
    get frameElement() {
      throw new Error("altra origine");
    },
  };
  chiusa.parent = {};
  assert.equal(laCorniceNellaCima(chiusa), null);
});

test("le fasce si rimisurano quando lo schermo cambia, non in due istanti fissi", () => {
  const navigazione = readFileSync(
    new URL("../src/sections/navigation-section.js", import.meta.url),
    "utf8",
  );
  assert.match(navigazione, /function tieniLeFasceMisurate\(\)/);
  assert.match(
    navigazione,
    /for \(let w = root; w && w !== w\.parent; w = w\.parent\) finestre\.push\(w\.parent\)/,
  );
  assert.match(navigazione, /visibilitychange/);
  assert.doesNotMatch(navigazione, /setInterval/);
  assert.match(navigazione, /laCorniceNellaCima\(root\)/);
  assert.doesNotMatch(navigazione, /for \(const attesa of \[400, 1500\]\)/);
});
