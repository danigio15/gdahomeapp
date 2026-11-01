/* «Verifica che con questo PDF non riesce a fare la planimetria»: la visura
 * del catasto, scansionata, con due piante e le altre unita' sullo stesso
 * foglio. Vedi core/piante-nel-foglio.js. */
import assert from "node:assert/strict";
import test from "node:test";

import {
  pianteNelFoglio,
  riquadroDellaPianta,
  scalaDelCatasto,
  SCALA_DEL_CATASTO,
} from "../src/core/piante-nel-foglio.js";

const PIEDE =
  "Ultima planimetria in atti Data presentazione: 22/07/1997 - Data: 12/10/2026 - n. T188581 - Richiedente: X Totale schede: 1 - Formato di acquisizione: A3(297x420) - Formato stampa richiesto: A4(210x297)";

test("la scala del catasto: 1:200, ridotta da A3 ad A4 sul foglio", () => {
  assert.equal(SCALA_DEL_CATASTO, 200);
  assert.ok(Math.abs(scalaDelCatasto(PIEDE) - (200 * 420) / 297) < 1e-9);
  /* Stampata nello stesso formato: 1:200 com'e'. */
  assert.equal(
    scalaDelCatasto("Formato di acquisizione: A4(210x297) - Formato stampa richiesto: A4(210x297)"),
    200,
  );
  /* Del catasto ma senza formati: 1:200. */
  assert.equal(scalaDelCatasto("Catasto dei Fabbricati - Situazione al 12/10/2026"), 200);
  /* Un PDF qualunque: niente. */
  assert.equal(scalaDelCatasto("Preventivo cucina, pagina 1"), 0);
  assert.equal(scalaDelCatasto(""), 0);
});

/* Un foglio finto: due case di muri spessi, una riga sottile che le unisce
 * (il contorno di un'altra unita'), una scritta e una barra sul margine. */
function foglio() {
  const mpp = 0.035,
    w = 1700,
    h = 2400,
    ink = new Uint8Array(w * h);
  const pieno = (x0, y0, x1, y1) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) ink[y * w + x] = 1;
  };
  const casa = (x0, y0, lw, lh) => {
    const s = 9; // 30 cm
    pieno(x0, y0, x0 + lw, y0 + s);
    pieno(x0, y0 + lh - s, x0 + lw, y0 + lh);
    pieno(x0, y0, x0 + s, y0 + lh);
    pieno(x0 + lw - s, y0, x0 + lw, y0 + lh);
    pieno(x0 + Math.round(lw / 2), y0, x0 + Math.round(lw / 2) + 5, y0 + lh); // tramezzo
  };
  casa(800, 800, 230, 240); // 8 x 8,4 m
  casa(800, 1900, 230, 370); // 8 x 13 m
  pieno(1030, 900, 1600, 902); // il contorno sottile di un'altra unita'
  for (let k = 0; k < 20; k++) pieno(300 + k * 12, 300, 300 + k * 12 + 2, 330); // una scritta
  pieno(150, 600, 215, 1070); // la barra nera del margine: troppo stretta
  return { ink, w, h, mpp };
}

test("le piante del foglio: due, dall'alto in basso, senza scritte ne' barre", () => {
  const { ink, w, h, mpp } = foglio();
  const piante = pianteNelFoglio(ink, w, h, mpp);
  assert.equal(piante.length, 2);
  assert.ok(piante[0].y0 < piante[1].y0);
  assert.ok(Math.abs(piante[0].larghezza - 8) < 0.6, `larghezza ${piante[0].larghezza}`);
  assert.ok(Math.abs(piante[1].profondita - 13) < 0.6, `profondita ${piante[1].profondita}`);
  const r = riquadroDellaPianta(piante[0], w, h, mpp);
  /* Un metro di margine attorno, e non di piu': l'altra unita' resta fuori. */
  assert.ok(r.x0 < 800 && r.x0 >= 800 - Math.round(1 / mpp) - 8);
  assert.ok(r.x0 + r.larghezza <= 1030 + Math.round(1 / mpp) + 8);
});

test("un foglio senza muri spessi (un disegno a righe sottili) non si ritaglia", () => {
  const w = 600,
    h = 600,
    ink = new Uint8Array(w * h);
  for (let x = 100; x < 500; x++) ink[100 * w + x] = ink[500 * w + x] = 1;
  for (let y = 100; y < 500; y++) ink[y * w + 100] = ink[y * w + 500] = 1;
  assert.deepEqual(pianteNelFoglio(ink, w, h, 0.03), []);
  assert.deepEqual(pianteNelFoglio(null, w, h, 0.03), []);
  assert.deepEqual(pianteNelFoglio(ink, w, h, 0), []);
});
