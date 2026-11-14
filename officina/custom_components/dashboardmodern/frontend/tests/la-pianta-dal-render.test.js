/* La pianta da un render 3D (issue 428): «Inserisco già la pianta in 3d ma
 * quando crea i muri, sbaglia locali e muri di stranezze.»
 *
 * Qui si disegna, col codice, un render finto come quelli dei programmi
 * d'arredo: una schermata col fondo nero, un riquadro bianco con gli angoli
 * tondi, e dentro una casa 8×5 m vista dall'alto un po' inclinata — muri
 * grigio scuro, le loro facce di lato color crema, il parquet a listoni, le
 * piastrelle con le fughe, l'ombra sul pavimento vicino ai muri, l'ombra
 * dove la casa tocca terra, una porta fra le due stanze e una finestra col
 * telaio nero spostato di lato dalla vista. E si pretende la casa giusta. */

import assert from "node:assert/strict";
import test from "node:test";
import {
  SPESSORE_DEL_RENDER,
  grigliaDallaFoto,
  leggiIlRender,
  riconosciDaFoto,
  ritaglioDellaFoto,
  scalaDaiMuri,
  stimaInclinazione,
} from "../src/core/pianta-da-foto.js";

const PXM = 60; // pixel per metro

function tela(w, h, rgb) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set([...rgb, 255], i * 4);
  return { width: w, height: h, data };
}
function colora(im, x0, y0, x1, y1, f) {
  for (let y = Math.max(0, Math.round(y0)); y < Math.min(im.height, Math.round(y1)); y++)
    for (let x = Math.max(0, Math.round(x0)); x < Math.min(im.width, Math.round(x1)); x++) {
      const i = (y * im.width + x) * 4,
        c = typeof f === "function" ? f(x, y, [im.data[i], im.data[i + 1], im.data[i + 2]]) : f;
      if (c) im.data.set(c, i);
    }
}
function ritaglia(im, r) {
  const w = r.x1 - r.x0,
    h = r.y1 - r.y0,
    out = tela(w, h, [0, 0, 0]);
  for (let y = 0; y < h; y++)
    out.data.set(
      im.data.subarray(((r.y0 + y) * im.width + r.x0) * 4, ((r.y0 + y) * im.width + r.x1) * 4),
      y * w * 4,
    );
  return out;
}

/* un rumore fisso, come la grana di un'immagine compressa */
let seme = 11;
const caso = () => (seme = (seme * 16807) % 2147483647) / 2147483647;
const grana = (c, n = 6) => c.map((v) => v + (caso() - 0.5) * 2 * n);

/* La casa, in metri dall'angolo in alto a sinistra della casa. */
const MURI = [
  [0, 0, 8, 0.3],
  [0, 0, 0.3, 5],
  [7.7, 0, 8, 5],
  [0, 4.7, 5.4, 5],
  [6.6, 4.7, 8, 5], // sotto, con la finestra da 5,4 a 6,6
  [3.92, 0.3, 4.08, 2.0],
  [3.92, 2.9, 4.08, 4.7], // l'interno da 16 cm, con la porta da 2,0 a 2,9
];

/**
 * Il render finto. `cornice`: lo sfondo nero e il riquadro bianco attorno;
 * senza, la casa sta su un fondo bianco che arriva al bordo.
 */
function render({ cornice = true } = {}) {
  const casaX = cornice ? 2.6 : 1.2,
    casaY = cornice ? 2.4 : 1.2,
    W = Math.round((8 + 2 * casaX) * PXM),
    H = Math.round((5 + 2 * casaY) * PXM);
  const im = tela(W, H, cornice ? [0, 0, 0] : [253, 253, 253]);
  const m = (v) => v * PXM,
    X = (v) => m(v + casaX),
    Y = (v) => m(v + casaY);
  if (cornice) {
    /* il nero della schermata, sfumato verso il basso */
    colora(im, 0, 0, W, H, (x, y) => grana([0, 0, 0].map(() => (20 * y) / H), 2));
    /* il riquadro bianco, con gli angoli tondi */
    const r = m(0.5),
      a = { x0: m(1), y0: m(1), x1: W - m(1), y1: H - m(1) };
    colora(im, a.x0, a.y0, a.x1, a.y1, (x, y) => {
      const cx = Math.min(Math.max(x, a.x0 + r), a.x1 - r),
        cy = Math.min(Math.max(y, a.y0 + r), a.y1 - r);
      return Math.hypot(x - cx, y - cy) <= r ? grana([254, 254, 254], 1) : null;
    });
  }
  /* l'ombra morbida sotto la casa, sul bianco */
  colora(im, X(-0.2), Y(5), X(8.3), Y(5.5), (x, y, c) => c.map((v) => v - 18 * (1 - (y - Y(5)) / m(0.5))));
  /* il parquet a sinistra, a listoni da 15 cm */
  colora(im, X(0), Y(0), X(4), Y(5), (x, y) => {
    const listone = Math.floor((y - Y(0)) / m(0.15)) % 3;
    return grana([236, 185, 130].map((v) => v - listone * 9));
  });
  /* le piastrelle a destra, con le fughe ogni 60 cm */
  colora(im, X(4), Y(0), X(8), Y(5), (x, y) => {
    const fuga = (x - X(4)) % m(0.6) < 2 || (y - Y(0)) % m(0.6) < 2;
    return grana(fuga ? [196, 180, 170] : [218, 200, 188], 4);
  });
  /* l'ombra sul pavimento vicino ai muri (il parquet in ombra resta parquet) */
  colora(im, X(0.3), Y(0.3), X(7.7), Y(4.7), (x, y, c) => {
    const d = Math.min(x - X(0.3), X(7.7) - x, y - Y(0.3), Y(4.7) - y, Math.abs(x - X(4)));
    const k = d < m(0.3) ? 0.62 + (0.38 * d) / m(0.3) : 1;
    return c.map((v) => v * k);
  });
  /* le facce di lato: la vista e' inclinata, di ogni muro si vede il lato di
   * sotto (22 cm) e quello a destra (8 cm), chiari */
  for (const [x0, y0, x1, y1] of MURI) {
    colora(im, X(x0), Y(y1), X(x1), Y(y1 + 0.22), () => grana([229, 208, 187], 3));
    colora(im, X(x1), Y(y0), X(x1 + 0.08), Y(y1), () => grana([240, 226, 210], 3));
  }
  /* dove la casa tocca terra: una riga grigia sottile sotto la faccia */
  colora(im, X(0), Y(5.22), X(8), Y(5.22) + 2, [100, 100, 100, 255]);
  /* i muri, grigio scuro, le cime tutte allo stesso grigio */
  for (const [x0, y0, x1, y1] of MURI) colora(im, X(x0), Y(y0), X(x1), Y(y1), () => grana([78, 77, 75], 3));
  /* la finestra: il davanzale chiaro nella fila del muro, il telaio nero
   * spostato in giu' dalla vista e i montanti */
  colora(im, X(5.4), Y(4.7), X(6.6), Y(4.78), [250, 248, 245, 255]);
  colora(im, X(5.4), Y(4.86), X(6.6), Y(4.95), () => grana([24, 24, 26], 3));
  for (const xm of [5.4, 5.8, 6.2, 6.57])
    colora(im, X(xm), Y(4.78), X(xm + 0.04), Y(5.02), () => grana([24, 24, 26], 3));
  return { im, X, Y };
}

/* Il giro della plancia (casa-3d-crea-section.js, usaPlanimetria): via la
 * cornice, la pianta pulita, la scala dai muri, i muri, le stanze. */
function riconosciIlRender(im) {
  const rq = ritaglioDellaFoto(im);
  const foto = rq ? ritaglia(im, rq) : im;
  const r = leggiIlRender(foto);
  assert.ok(r, "e' un render");
  const sc = scalaDaiMuri(r.im, { muro: SPESSORE_DEL_RENDER });
  assert.ok(sc, "la scala dai muri");
  const griglia = grigliaDallaFoto(r.im, sc.mpp, { render: true });
  return { rq, r, sc, griglia, casa: riconosciDaFoto(griglia) };
}

test("il render nella schermata: via il fondo nero e il riquadro bianco, resta la casa", () => {
  const { im, X, Y } = render();
  const rq = ritaglioDellaFoto(im);
  assert.ok(rq, "c'e' da ritagliare");
  assert.equal(rq.scuro, true, "il fondo nero e' stato tolto");
  /* tutta la casa dentro, col suo margine, e del riquadro bianco poco */
  assert.ok(rq.x0 <= X(-0.1) && rq.x1 >= X(8.1), `in larghezza: ${rq.x0}-${rq.x1}`);
  assert.ok(rq.y0 <= Y(-0.1) && rq.y1 >= Y(5.2), `in altezza: ${rq.y0}-${rq.y1}`);
  assert.ok(rq.x0 >= X(-1.2) && rq.x1 <= X(9.2), "il riquadro bianco e' tolto quasi tutto");
});

test("il render: muri grigi, pavimenti di parquet e piastrelle, facce di lato — due stanze, una porta, una finestra", () => {
  const { im } = render();
  const { r, sc, griglia, casa } = riconosciIlRender(im);
  /* il grigio del muro e' quello delle cime, non il nero del telaio */
  assert.ok(Math.abs(r.muro - 77) <= 8, `grigio del muro ${r.muro}`);
  assert.ok(r.vetri > 0, "il telaio della finestra c'e'");
  /* la scala: i muri di fuori sono 30 cm */
  assert.ok(Math.abs(sc.mpp * PXM - 1) < 0.12, `metri per pixel ${sc.mpp}`);
  assert.equal(griglia.strada, "render");
  assert.ok(Math.abs(stimaInclinazione(r.im)) <= 0.5, "dritta");
  const grandi = casa.stanze.filter((s) => s.area >= 2);
  assert.equal(grandi.length, 2, `stanze: ${casa.stanze.map((s) => s.area.toFixed(1)).join(", ")}`);
  for (const s of grandi) assert.ok(s.area > 13 && s.area < 20, `area ${s.area}`);
  const porte = casa.aperture.filter((a) => a.tipo === "porta"),
    finestre = casa.aperture.filter((a) => a.tipo === "finestra");
  assert.equal(porte.length, 1, "una porta, fra le due stanze");
  assert.ok(Math.abs(porte[0].largo - 0.9) < 0.3, `larga ${porte[0].largo}`);
  assert.equal(finestre.length, 1, "la finestra e' una finestra, non una porta");
  assert.ok(Math.abs(finestre[0].largo - 1.2) < 0.35, `larga ${finestre[0].largo}`);
});

test("il render senza cornice, sul bianco fino al bordo: lo stesso", () => {
  const { im } = render({ cornice: false });
  const { casa } = riconosciIlRender(im);
  assert.equal(casa.stanze.filter((s) => s.area >= 2).length, 2);
  assert.equal(casa.aperture.filter((a) => a.tipo === "finestra").length, 1);
  assert.equal(casa.aperture.filter((a) => a.tipo === "porta").length, 1);
});

test("una pianta a righe nere su carta non e' un render, e su carta bianca non si ritaglia al buio", () => {
  const im = tela(16 * PXM, 11 * PXM, [245, 245, 245]);
  const m = (v) => v * PXM;
  for (const [x0, y0, x1, y1] of MURI) colora(im, m(x0 + 4), m(y0 + 3), m(x1 + 4), m(y1 + 3), [20, 20, 20, 255]);
  assert.equal(leggiIlRender(im), null);
  const rq = ritaglioDellaFoto(im);
  assert.ok(!rq || rq.scuro === false);
  /* fotografata un po' gialla, sotto la lampada: sempre righe */
  colora(im, 0, 0, im.width, im.height, (x, y, c) => [c[0], c[1] - 6, c[2] - 18, 255]);
  assert.equal(leggiIlRender(im), null);
});

test("la pianta a righe nella schermata col fondo nero: si toglie il nero, la pianta resta intera", () => {
  const im = tela(16 * PXM, 11 * PXM, [8, 8, 8]);
  const m = (v) => v * PXM;
  colora(im, m(1), m(1), m(15), m(10), [250, 250, 250, 255]);
  for (const [x0, y0, x1, y1] of MURI) colora(im, m(x0 + 4), m(y0 + 3), m(x1 + 4), m(y1 + 3), [20, 20, 20, 255]);
  const rq = ritaglioDellaFoto(im);
  assert.ok(rq?.scuro, "il nero si toglie");
  assert.ok(rq.x0 <= m(4) && rq.y0 <= m(3) && rq.x1 >= m(12) && rq.y1 >= m(8), JSON.stringify(rq));
  assert.equal(leggiIlRender(ritaglia(im, rq)), null, "e resta una pianta a righe");
});
