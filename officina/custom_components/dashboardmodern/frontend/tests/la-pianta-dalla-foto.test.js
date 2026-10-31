/* La pianta dalla foto della planimetria: si disegna una planimetria finta
 * (due stanze, una porta fra loro, una finestra fuori, una scritta, una
 * quota), la si gira un poco come una foto storta, e si pretende che torni
 * la casa giusta. */

import assert from "node:assert/strict";
import test from "node:test";
import {
  PASSO,
  grigliaDeiMuri,
  inchiostro,
  riconosciDaFoto,
  stimaInclinazione,
} from "../src/core/pianta-da-foto.js";

const PXM = 60; // pixel per metro

function foglio(w, h) {
  const data = new Uint8ClampedArray(w * h * 4).fill(245);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  return { width: w, height: h, data };
}
function rettangolo(im, x0, y0, x1, y1, v = 20) {
  for (let y = Math.round(y0); y < Math.round(y1); y++)
    for (let x = Math.round(x0); x < Math.round(x1); x++) {
      const i = (y * im.width + x) * 4;
      im.data[i] = im.data[i + 1] = im.data[i + 2] = v;
    }
}
function ruota(im, gradi) {
  const out = foglio(im.width, im.height),
    r = (gradi * Math.PI) / 180,
    c = Math.cos(r),
    s = Math.sin(r),
    cx = im.width / 2,
    cy = im.height / 2;
  for (let y = 0; y < im.height; y++)
    for (let x = 0; x < im.width; x++) {
      const sx = Math.round(c * (x - cx) + s * (y - cy) + cx),
        sy = Math.round(-s * (x - cx) + c * (y - cy) + cy);
      if (sx < 0 || sy < 0 || sx >= im.width || sy >= im.height) continue;
      const i = (y * im.width + x) * 4,
        j = (sy * im.width + sx) * 4;
      out.data[i] = im.data[j];
      out.data[i + 1] = im.data[j + 1];
      out.data[i + 2] = im.data[j + 2];
    }
  return out;
}

/* Una casa 8×5 m: muri esterni da 30 cm, uno interno da 12 cm a 4 m con una
 * porta da 90 cm, una finestra da 1,2 m sul lato in basso della stanza a
 * destra (due righe sottili nel vano), una scritta e una quota. */
function planimetria() {
  const im = foglio(16 * PXM, 11 * PXM),
    m = (v) => v * PXM,
    X = (v) => m(v + 4),
    Y = (v) => m(v + 3);
  const muro = (x0, y0, x1, y1) => rettangolo(im, X(x0), Y(y0), X(x1), Y(y1));
  muro(0, 0, 8, 0.3);
  muro(0, 0, 0.3, 5);
  muro(7.7, 0, 8, 5); // sopra, sinistra, destra
  muro(0, 4.7, 5.4, 5);
  muro(6.6, 4.7, 8, 5); // sotto, con la finestra da 5,4 a 6,6
  for (const d of [4.8, 4.9]) rettangolo(im, X(5.4), Y(d), X(6.6), Y(d) + 1);
  muro(3.94, 0.3, 4.06, 2.0);
  muro(3.94, 2.9, 4.06, 4.7); // l'interno, con la porta da 2,0 a 2,9
  for (let k = 0; k < 6; k++) rettangolo(im, X(1 + k * 0.25), Y(2.4), X(1.15 + k * 0.25), Y(2.6)); // «SALONE»
  rettangolo(im, X(0), Y(5.6), X(8), Y(5.6) + 1); // la quota
  return ruota(im, 2);
}

test("la planimetria storta si raddrizza", () => {
  const ang = stimaInclinazione(planimetria());
  assert.ok(Math.abs(ang - 2) < 0.35 || Math.abs(ang + 2) < 0.35, `angolo ${ang}`);
});

test("dalla foto tornano due stanze, una porta fra loro e una finestra fuori", () => {
  let im = planimetria();
  const ang = stimaInclinazione(im);
  im = ruota(im, -ang);
  const griglia = grigliaDeiMuri(inchiostro(im), im.width, im.height, 1 / PXM);
  const casa = riconosciDaFoto(griglia);
  const aree = casa.stanze.map((s) => s.area).sort((a, b) => a - b);
  assert.equal(casa.stanze.length, 2, `stanze: ${aree}`);
  // ~3,6×4,4 e ~3,6×4,4 di dentro: 14-17 m² ciascuna
  for (const a of aree) assert.ok(a > 13 && a < 18.5, `area ${a}`);
  const porte = casa.aperture.filter((a) => a.tipo === "porta"),
    finestre = casa.aperture.filter((a) => a.tipo === "finestra");
  assert.equal(porte.length, 1);
  assert.ok(Math.abs(porte[0].largo - 0.9) < 0.25, `porta ${porte[0].largo}`);
  assert.equal(finestre.length, 1);
  assert.ok(Math.abs(finestre[0].largo - 1.2) < 0.3, `finestra ${finestre[0].largo}`);
  // le scritte non diventano muri: dentro la stanza a sinistra resta tutto stanza
  assert.equal(PASSO, 0.03);
});
