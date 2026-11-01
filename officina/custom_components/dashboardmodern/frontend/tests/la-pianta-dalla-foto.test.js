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
  /* Si raddrizza come fa la procedura: si gira dell'angolo stimato (prima si
   * girava dalla parte sbagliata e la pianta restava storta di 4°). */
  im = ruota(im, ang);
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

/* «Se faccio Riconosci muri mi fa questo» (Trovati 0 ambienti, solo
 * puntini): la planimetria del catasto disegna i muri con due righe sottili
 * e il vuoto in mezzo, il portone e' un varco senza soglia, le finestre due
 * righe sottili nel vano, e c'e' la cornice del foglio con l'intestazione.
 * Una schermata ne fa 20-30 pixel per metro. Qui si disegna cosi', e si
 * pretende la casa: cinque stanze, le porte, le finestre, il portone. */
function catasto(pxm) {
  const im = foglio(Math.round(42 * pxm), Math.round(34 * pxm)),
    P = (v) => v * pxm,
    X = (v) => P(v + 15),
    Y = (v) => P(v + 12),
    riga = (x0, y0, x1, y1) =>
      rettangolo(
        im,
        Math.min(X(x0), X(x1)),
        Math.min(Y(y0), Y(y1)),
        Math.max(X(x0), X(x1)) + 1,
        Math.max(Y(y0), Y(y1)) + 1,
        30,
      );
  /* un muro a doppia riga, orizzontale o verticale, coi suoi varchi */
  const muro = (x0, y0, x1, y1, s, varchi = []) => {
    const orizz = y0 === y1;
    let pezzi = [
      [orizz ? Math.min(x0, x1) : Math.min(y0, y1), orizz ? Math.max(x0, x1) : Math.max(y0, y1)],
    ];
    for (const [v0, v1] of varchi)
      pezzi = pezzi.flatMap(([a, b]) =>
        v1 <= a || v0 >= b
          ? [[a, b]]
          : [...(v0 > a ? [[a, v0]] : []), ...(v1 < b ? [[v1, b]] : [])],
      );
    for (const [a, b] of pezzi)
      if (orizz) {
        riga(a, y0 - s / 2, b, y0 - s / 2);
        riga(a, y0 + s / 2, b, y0 + s / 2);
        riga(a, y0 - s / 2, a, y0 + s / 2);
        riga(b, y0 - s / 2, b, y0 + s / 2);
      } else {
        riga(x0 - s / 2, a, x0 - s / 2, b);
        riga(x0 + s / 2, a, x0 + s / 2, b);
        riga(x0 - s / 2, a, x0 + s / 2, a);
        riga(x0 - s / 2, b, x0 + s / 2, b);
      }
  };
  const vetro = (x0, y0, x1, y1) => {
    for (const k of [-0.08, 0.08])
      y0 === y1 ? riga(x0, y0 + k, x1, y0 + k) : riga(x0 + k, y0, x0 + k, y1);
  };
  const E = 0.3,
    I = 0.12;
  muro(0, 0, 12, 0, E, [
    [2, 3.4],
    [8.5, 9.7],
  ]);
  muro(12, 0, 12, 10, E, [[6.2, 7.4]]);
  muro(0, 10, 12, 10, E, [
    [4.3, 5.3],
    [8.5, 9.7],
  ]); // il portone (4,3-5,3) senza soglia
  muro(0, 0, 0, 10, E, [
    [2, 3.4],
    [7.5, 8.3],
  ]);
  vetro(2, 0, 3.4, 0);
  vetro(8.5, 0, 9.7, 0);
  vetro(12, 6.2, 12, 7.4);
  vetro(8.5, 10, 9.7, 10);
  vetro(0, 2, 0, 3.4);
  vetro(0, 7.5, 0, 8.3);
  muro(7, 0, 7, 6, I, [[1.5, 2.4]]);
  muro(7, 4, 12, 4, I, [[7.8, 8.6]]);
  muro(7, 6, 7, 10, I, [[7.5, 8.3]]);
  muro(0, 6, 7, 6, I, [[4.6, 5.4]]);
  muro(3, 6, 3, 10, I, [[7.6, 8.4]]);
  /* le scritte: lettere da 30×40 cm, una accanto all'altra */
  const scritta = (x, y, n) => {
    for (let k = 0; k < n; k++) {
      riga(x + k * 0.36, y, x + k * 0.36, y + 0.4);
      riga(x + k * 0.36 + 0.25, y, x + k * 0.36 + 0.25, y + 0.4);
      riga(x + k * 0.36, y, x + k * 0.36 + 0.25, y);
    }
  };
  scritta(2.2, 3, 9); // SOGGIORNO
  scritta(8.6, 2, 6); // CUCINA
  scritta(8.6, 7, 6); // CAMERA
  scritta(0.6, 8, 5); // BAGNO
  scritta(4.2, 8.5, 4); // DIS.
  /* la cornice e l'intestazione del foglio */
  rettangolo(im, P(1), P(1), P(41), P(1) + 2, 30);
  rettangolo(im, P(1), P(33), P(41), P(33) + 2, 30);
  rettangolo(im, P(1), P(1), P(1) + 2, P(33), 30);
  rettangolo(im, P(41), P(1), P(41) + 2, P(33), 30);
  for (let k = 0; k < 40; k++)
    rettangolo(im, P(2 + k * 0.4), P(2.5), P(2.25 + k * 0.4), P(2.9), 30);
  return im;
}

for (const pxm of [20, 30]) {
  test(`la planimetria del catasto (${pxm} pixel per metro): muri a doppia riga, portone senza soglia`, () => {
    const im = catasto(pxm);
    const casa = riconosciDaFoto(grigliaDeiMuri(inchiostro(im), im.width, im.height, 1 / pxm));
    const aree = casa.stanze.map((s) => s.area).sort((a, b) => a - b);
    assert.equal(casa.stanze.length, 5, `stanze: ${aree.map((a) => a.toFixed(1))}`);
    /* bagno ~10, disimpegno ~14, cucina ~18, camera ~27, soggiorno ~39 */
    const attese = [10.3, 14.4, 17.9, 27.3, 38.9];
    aree.forEach((a, i) =>
      assert.ok(Math.abs(a - attese[i]) < attese[i] * 0.12, `area ${a} invece di ${attese[i]}`),
    );
    const porte = casa.aperture.filter((a) => a.tipo === "porta"),
      finestre = casa.aperture.filter((a) => a.tipo === "finestra");
    assert.equal(porte.length, 6, `porte: ${porte.map((p) => p.largo.toFixed(1))}`); // cinque dentro e il portone
    assert.equal(finestre.length, 6, `finestre: ${finestre.map((p) => p.largo.toFixed(1))}`);
  });
}

/* Una schermata ritagliata stretta attorno alla casa: i muri di fuori sono
 * larghi quanto l'immagine, ma non sono la cornice del foglio. */
function ritaglia(im, x0, y0, x1, y1) {
  const w = x1 - x0,
    h = y1 - y0,
    data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    data.set(
      im.data.subarray(((y + y0) * im.width + x0) * 4, ((y + y0) * im.width + x1) * 4),
      y * w * 4,
    );
  return { width: w, height: h, data };
}
test("la casa ritagliata stretta: i muri di fuori non sono la cornice", () => {
  const pxm = 30,
    im = ritaglia(
      catasto(pxm),
      Math.round(14.6 * pxm),
      Math.round(11.6 * pxm),
      Math.round(27.4 * pxm),
      Math.round(22.4 * pxm),
    );
  const casa = riconosciDaFoto(grigliaDeiMuri(inchiostro(im), im.width, im.height, 1 / pxm));
  assert.equal(casa.stanze.length, 5, `stanze: ${casa.stanze.map((s) => s.area.toFixed(1))}`);
});
test("un contorno solo, senza stanze dentro, e' una stanza", () => {
  const pxm = 40,
    im = foglio(Math.round(13.2 * pxm), Math.round(11.2 * pxm));
  const s = 0.3 * pxm,
    m = 0.6 * pxm;
  rettangolo(im, m, m, im.width - m, m + s);
  rettangolo(im, m, im.height - m - s, im.width - m, im.height - m);
  rettangolo(im, m, m, m + s, im.height - m);
  rettangolo(im, im.width - m - s, m, im.width - m, im.height - m);
  const casa = riconosciDaFoto(grigliaDeiMuri(inchiostro(im), im.width, im.height, 1 / pxm));
  assert.equal(casa.stanze.length, 1);
  assert.ok(Math.abs(casa.stanze[0].area - 11.4 * 9.4) < 6, `area ${casa.stanze[0].area}`);
});

/* Dal DWG («Se faccio riconosci muri mi fa questo» col disegno vero): muri
 * pieni (campiture), un tramezzo che finisce a 1 m dal muro di traverso (la
 * porta, che nel DWG sta in un altro strato), un pezzo di muro da solo fra
 * due aperture, e una finestra larga 1,8 m data dallo strato degli infissi. */
function disegnoDwg(pxm) {
  const W = Math.round(12 * pxm),
    H = Math.round(9 * pxm),
    im = foglio(W, H),
    vetri = new Uint8Array(W * H),
    P = (v) => (v + 0.6) * pxm,
    pieno = (x0, y0, x1, y1) => rettangolo(im, P(x0), P(y0), P(x1), P(y1), 0);
  const E = 0.3;
  pieno(0, 0, 10.8, E); // sopra, con la finestra larga (6,5-8,3)
  pieno(0, 7.5, 10.8, 7.8); // sotto
  pieno(0, 0, E, 7.8); // sinistra
  pieno(10.5, 0, 10.8, 7.8); // destra
  // il tramezzo verticale a x=5: due porte e un pezzo da solo in mezzo
  pieno(4.95, 0, 5.1, 2);
  pieno(4.95, 2.9, 5.1, 4.6); // il pezzo da solo
  pieno(4.95, 5.5, 5.1, 7.8);
  // a destra un tramezzo orizzontale che finisce a 1 m dal muro di destra
  pieno(5, 4, 9.5, 4.15);
  // la finestra: il muro sopra s'interrompe, gli infissi dicono dov'e'
  rettangolo(im, P(6.5), P(0) - 1, P(8.3), P(E) + 1, 245);
  for (let y = Math.round(P(0.12)); y < Math.round(P(0.18)); y++)
    for (let x = Math.round(P(6.5)); x < Math.round(P(8.3)); x++) vetri[y * W + x] = 1;
  return { im, vetri };
}
test("un disegno dal DWG: tramezzo che finisce vicino al muro, pezzo fra due porte, finestra larga", () => {
  const pxm = 60,
    { im, vetri } = disegnoDwg(pxm);
  const casa = riconosciDaFoto(
    grigliaDeiMuri(inchiostro(im), im.width, im.height, 1 / pxm, { vetri, disegno: true }),
  );
  const aree = casa.stanze.map((s) => s.area).sort((a, b) => a - b);
  assert.equal(casa.stanze.length, 3, `stanze: ${aree.map((a) => a.toFixed(1))}`);
  const finestre = casa.aperture.filter((a) => a.tipo === "finestra");
  assert.equal(
    finestre.length,
    1,
    `aperture: ${casa.aperture.map((a) => a.tipo[0] + a.largo.toFixed(1))}`,
  );
  assert.ok(Math.abs(finestre[0].largo - 1.8) < 0.3, `finestra ${finestre[0].largo}`);
  assert.equal(casa.aperture.filter((a) => a.tipo === "porta").length, 3);
});

/* «No, foto: ho scattato le foto alle planimetrie dell'architetto.» Una
 * foto grande (2400 pixel di lato) di una pianta coi muri campiti di grigio,
 * larghi trenta pixel, sul tavolo scuro; una quota sottile corre dal bordo
 * del foglio fino al muro. Prima il tavolo passava per la quota e si
 * mangiava i muri, e il grigio largo si confrontava con se stesso: restavano
 * i bordi, e nessuna stanza. */
test("la foto grande della pianta dell'architetto: muri grigi pieni, una quota fino al bordo", () => {
  const W = 1800,
    H = 2400,
    pxm = 110; // ~0,009 m per pixel, come una foto da 12 megapixel ridotta
  const im = foglio(W, H);
  for (let i = 0; i < W * H; i++) {
    const p = i * 4;
    im.data[p] = im.data[p + 1] = im.data[p + 2] = 198; // la carta un po' grigia della foto
  }
  rettangolo(im, 0, 0, W, 60, 45); // il tavolo sopra
  rettangolo(im, 0, 0, 60, H, 45); // e a sinistra
  const m = (v) => 300 + v * pxm,
    grigio = 118,
    sp = 0.28 * pxm;
  // 8 x 6 m, due stanze divise a 4 m, una porta da 90 cm nel tramezzo
  rettangolo(im, m(0), m(0), m(8), m(0) + sp, grigio);
  rettangolo(im, m(0), m(6) - sp, m(8), m(6), grigio);
  rettangolo(im, m(0), m(0), m(0) + sp, m(6), grigio);
  rettangolo(im, m(8) - sp, m(0), m(8), m(6), grigio);
  rettangolo(im, m(4) - sp / 2, m(0), m(4) + sp / 2, m(2.5), grigio);
  rettangolo(im, m(4) - sp / 2, m(3.4), m(4) + sp / 2, m(6), grigio);
  // la quota: una riga sottile e scura dal tavolo al muro di sopra
  rettangolo(im, m(2), 0, m(2) + 3, m(0), 40);
  rettangolo(im, 0, m(1), m(0), m(1) + 3, 40);
  const ink = inchiostro(im);
  /* il grigio del muro, anche in mezzo, e' inchiostro */
  assert.equal(ink[Math.round(m(3)) + Math.round(m(0) + sp / 2) * W], 1, "il muro in mezzo");
  assert.equal(ink[Math.round(m(8) - sp / 2) + Math.round(m(3)) * W], 1, "il muro di destra");
  const casa = riconosciDaFoto(grigliaDeiMuri(ink, W, H, 1 / pxm));
  const grandi = casa.stanze.filter((s) => s.area > 10).map((s) => Math.round(s.area));
  assert.equal(grandi.length, 2, `due stanze: ${casa.stanze.map((s) => s.area.toFixed(1))}`);
  for (const a of grandi) assert.ok(a >= 18 && a <= 24, `stanza di ${a} m²`);
});
