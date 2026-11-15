/* La pianta arredata a colori: «questa è la mappa di casa mia: fai in modo
 * che se la carico così com'è venga riconosciuta tutta, anche gli
 * arredamenti». E poi: «togli quelle icone dei rilevatori».
 *
 * Qui la pianta si disegna col codice, piccola come una schermata, nello
 * stile delle piante delle agenzie: muri grigi coi bordi scuri (fuori
 * spessi, i tramezzi sottili), pavimenti a piastrelle beige con le fughe, il
 * bagno a piastrelle verdi, un terrazzo tratteggiato a griglia, le finestre
 * come un tratto chiaro nel muro, le porte con l'arco, e gli arredi: il
 * letto coi cuscini e i comodini, il tavolo con le sedie, il divano con lo
 * schienale, l'isola di legno con gli sgabelli neri, il camino grigio, la
 * vasca, il wc e il bidet. Sopra, due icone di una centrale d'allarme. Si
 * ingrandisce come fa la plancia (il lato lungo a 2400 pixel) e si pretende
 * la casa giusta. */

import assert from "node:assert/strict";
import test from "node:test";
import { arrediDallaPianta } from "../src/core/arredi-dalla-pianta.js";
import {
  CARTA_PULITA,
  conMargine,
  grigliaDallaFoto,
  leggiIlRender,
  margineDellaPianta,
  riconosciDaFoto,
  scalaDaiMuri,
  togliISovrapposti,
} from "../src/core/pianta-da-foto.js";

const PXM = 40; // pixel per metro: una schermata piccola
const OX = 2.6,
  OY = 1.6; // la casa nell'immagine, in metri

function tela(w, h, rgb) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set([...rgb, 255], i * 4);
  return { width: w, height: h, data };
}
/* in metri della casa */
const X = (v) => Math.round((v + OX) * PXM),
  Y = (v) => Math.round((v + OY) * PXM);
function riempi(im, x0, y0, x1, y1, f) {
  for (let y = Math.max(0, Y(y0)); y < Math.min(im.height, Y(y1)); y++)
    for (let x = Math.max(0, X(x0)); x < Math.min(im.width, X(x1)); x++) {
      const i = (y * im.width + x) * 4,
        c = typeof f === "function" ? f(x, y) : f;
      if (c) im.data.set(c, i);
    }
}
/* il contorno di un pixel */
function bordo(im, x0, y0, x1, y1, c) {
  for (let x = X(x0); x < X(x1); x++)
    for (const y of [Y(y0), Y(y1) - 1]) im.data.set(c, (y * im.width + x) * 4);
  for (let y = Y(y0); y < Y(y1); y++)
    for (const x of [X(x0), X(x1) - 1]) im.data.set(c, (y * im.width + x) * 4);
}
const BIANCO = [255, 255, 255],
  RIGA = [120, 120, 120];
/* un mobile bianco col contorno grigio */
function mobile(im, x0, y0, x1, y1) {
  riempi(im, x0, y0, x1, y1, BIANCO);
  bordo(im, x0, y0, x1, y1, RIGA);
}
function cerchio(im, cx, cy, r, c) {
  for (let y = Y(cy - r); y <= Y(cy + r); y++)
    for (let x = X(cx - r); x <= X(cx + r); x++)
      if (Math.hypot(x - X(cx), y - Y(cy)) <= r * PXM) im.data.set(c, (y * im.width + x) * 4);
}

/* La casa: 10 × 7 m. Il soggiorno con la cucina a sinistra (6 × 7), la
 * camera in alto a destra (4 × 4), il bagno in basso a destra (4 × 3). */
const MURO_FUORI = 0.3,
  TRAMEZZO = 0.12;
function pianta({ icone = false } = {}) {
  const im = tela(Math.round((10 + OX + 1.6) * PXM), Math.round((7 + OY + 1.6) * PXM), BIANCO);
  /* il terrazzo a sinistra: bianco tratteggiato a griglia, col parapetto */
  for (let x = -2.2; x < 0; x += 0.3) riempi(im, x, 1, x + 0.025, 5, [190, 190, 190]);
  for (let y = 1; y < 5; y += 0.3) riempi(im, -2.2, y, 0, y + 0.025, [190, 190, 190]);
  bordo(im, -2.2, 1, 0.01, 5, [150, 150, 150]);
  /* i pavimenti: piastrelle beige da 60 cm con le fughe, il bagno verde */
  riempi(im, 0, 0, 10, 7, (x, y) =>
    (x - X(0)) % 24 === 0 || (y - Y(0)) % 24 === 0 ? [200, 194, 180] : [226, 218, 202],
  );
  riempi(im, 6, 4, 10, 7, (x, y) =>
    (x - X(6)) % 12 === 0 || (y - Y(4)) % 12 === 0 ? [120, 128, 92] : [150, 160, 112],
  );
  /* i muri: grigio coi bordi scuri */
  const muro = (x0, y0, x1, y1) => {
    riempi(im, x0, y0, x1, y1, [160, 160, 160]);
    bordo(im, x0, y0, x1, y1, [100, 100, 100]);
  };
  const t = MURO_FUORI;
  muro(0, 0, 1.5, t);
  muro(3.0, 0, 10, t); // la finestra del soggiorno da 1,5 a 3
  muro(0, 0, t, 7);
  muro(10 - t, 0, 10, 1.0);
  muro(10 - t, 2.5, 10, 7); // la finestra della camera da 1 a 2,5
  muro(0, 7 - t, 2.0, 7);
  muro(3.0, 7 - t, 8.0, 7); // l'ingresso da 2 a 3
  muro(9.0, 7 - t, 10, 7); // la finestra del bagno da 8 a 9
  const s = TRAMEZZO;
  muro(6 - s / 2, t, 6 + s / 2, 1.5);
  muro(6 - s / 2, 2.4, 6 + s / 2, 5.0);
  muro(6 - s / 2, 5.8, 6 + s / 2, 7 - t);
  muro(6, 4 - s / 2, 10 - t, 4 + s / 2);
  /* le finestre: il tratto chiaro nel muro, col telaio sottile */
  const finestra = (x0, y0, x1, y1, oriz) => {
    riempi(im, x0, y0, x1, y1, [245, 245, 245]);
    bordo(im, x0, y0, x1, y1, [170, 170, 170]);
    if (oriz) riempi(im, x0, (y0 + y1) / 2, x1, (y0 + y1) / 2 + 0.025, [170, 170, 170]);
    else riempi(im, (x0 + x1) / 2, y0, (x0 + x1) / 2 + 0.025, y1, [170, 170, 170]);
  };
  finestra(1.5, 0, 3.0, t, true);
  finestra(10 - t, 1.0, 10, 2.5, false);
  finestra(8.0, 7 - t, 9.0, 7, true);
  /* gli archi delle porte */
  const arco = (cx, cy, r, a0, a1) => {
    for (let a = a0; a <= a1; a += 0.01)
      im.data.set(RIGA, (Math.round(Y(cy) + Math.sin(a) * r * PXM) * im.width + Math.round(X(cx) + Math.cos(a) * r * PXM)) * 4);
  };
  arco(6, 1.5, 0.9, 0, Math.PI / 2);
  arco(6, 5.8, 0.8, -Math.PI / 2, 0);
  arco(2, 7, 1.0, -Math.PI / 2, 0);
  /* la camera: il letto coi cuscini contro il muro di sopra, i comodini */
  mobile(im, 7.15, t, 8.85, t + 2.1);
  mobile(im, 7.3, t + 0.1, 7.95, t + 0.45);
  mobile(im, 8.05, t + 0.1, 8.7, t + 0.45);
  riempi(im, 6.6, t, 7.05, t + 0.42, [120, 70, 40]);
  riempi(im, 8.95, t, 9.4, t + 0.42, [120, 70, 40]);
  /* il soggiorno: il tavolo con quattro sedie */
  mobile(im, 1.0, 4.6, 2.6, 5.5);
  for (const x of [1.2, 1.9]) {
    mobile(im, x, 4.1, x + 0.45, 4.5);
    mobile(im, x, 5.6, x + 0.45, 6.0);
  }
  /* il divano con lo schienale di sopra */
  mobile(im, 3.0, 2.4, 5.2, 3.3);
  riempi(im, 3.0, 2.6, 5.2, 2.625, RIGA);
  riempi(im, 4.1, 2.6, 4.125, 3.3, RIGA);
  /* l'isola di legno con gli sgabelli neri */
  riempi(im, 1.2, 1.2, 3.0, 1.8, [150, 85, 45]);
  cerchio(im, 1.7, 2.1, 0.17, [10, 10, 10]);
  cerchio(im, 2.5, 2.1, 0.17, [10, 10, 10]);
  /* il camino grigio contro il muro di sotto */
  riempi(im, 4.2, 6.2, 5.4, 7 - t, [128, 128, 128]);
  riempi(im, 4.5, 6.3, 5.1, 6.6, [100, 100, 100]);
  /* il bagno: la vasca contro il muro di destra, wc e bidet contro quello
   * di sotto */
  mobile(im, 10 - t - 0.75, 4.4, 10 - t, 6.1);
  mobile(im, 10 - t - 0.65, 4.5, 10 - t - 0.1, 6.0);
  mobile(im, 6.6, 7 - t - 0.55, 6.98, 7 - t);
  mobile(im, 7.2, 7 - t - 0.55, 7.58, 7 - t);
  if (icone) {
    /* le icone della centrale: un quadratino bianco coi bordi tondi, il
     * contorno nero sottile e i raggi azzurri; una sopra il muro di sopra,
     * una sul pavimento del soggiorno */
    for (const [cx, cy] of [
      [4.5, 0.1],
      [4.5, 4.8],
    ]) {
      const r = 0.45,
        tondo = 0.12;
      for (let y = Y(cy - r); y <= Y(cy + r); y++)
        for (let x = X(cx - r); x <= X(cx + r); x++) {
          const qx = Math.min(Math.max(x, X(cx - r + tondo)), X(cx + r - tondo)),
            qy = Math.min(Math.max(y, Y(cy - r + tondo)), Y(cy + r - tondo)),
            d = Math.hypot(x - qx, y - qy) / PXM;
          if (d > tondo) continue;
          const i = (y * im.width + x) * 4;
          if (d > tondo - 0.04) im.data.set([30, 28, 32], i);
          else {
            const a = Math.atan2(y - Y(cy - r + 0.15), x - X(cx - r + 0.15)),
              raggio = Math.floor((a / (Math.PI / 2)) * 9) % 2 === 0;
            im.data.set(
              x > X(cx - r + 0.12) && y > Y(cy - r + 0.12) && x < X(cx + r - 0.1) && y < Y(cy + r - 0.1) && raggio
                ? [0, 158, 223]
                : BIANCO,
              i,
            );
          }
        }
    }
  }
  return im;
}

/* ingrandita come nella plancia: il lato lungo a 2400 pixel (bilineare) */
function a2400(im) {
  const k = 2400 / Math.max(im.width, im.height),
    W = Math.round(im.width * k),
    H = Math.round(im.height * k),
    out = new Uint8ClampedArray(W * H * 4),
    d = im.data;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const sx = Math.min(Math.max((x + 0.5) / k - 0.5, 0), im.width - 1.001),
        sy = Math.min(Math.max((y + 0.5) / k - 0.5, 0), im.height - 1.001);
      const a = Math.floor(sx),
        b = Math.floor(sy),
        fx = sx - a,
        fy = sy - b;
      for (let c = 0; c < 4; c++) {
        const i = (b * im.width + a) * 4 + c;
        out[(y * W + x) * 4 + c] =
          d[i] * (1 - fx) * (1 - fy) +
          d[i + 4] * fx * (1 - fy) +
          d[i + im.width * 4] * (1 - fx) * fy +
          d[i + im.width * 4 + 4] * fx * fy;
      }
    }
  return { width: W, height: H, data: out, k };
}

/* Il giro della plancia (usaPlanimetria e riconosci): via le icone, a 2400
 * pixel, la pianta pulita col margine, la scala dai muri, le stanze, gli
 * arredi. */
function riconosci(im) {
  const via = togliISovrapposti(im);
  const big = a2400(via ? via.im : im);
  const r = leggiIlRender(big);
  assert.ok(r?.arredata, "e' una pianta arredata");
  const m = margineDellaPianta(r.im, r.spessore);
  const img = conMargine(big, m),
    pulita = conMargine(r.im, m, CARTA_PULITA);
  const sc = scalaDaiMuri(pulita, { muro: r.muroM, minimo: r.minimo });
  assert.ok(sc, "la scala dai muri");
  const griglia = grigliaDallaFoto(pulita, sc.mpp, { render: true });
  const casa = riconosciDaFoto(griglia);
  /* da metri della casa a metri della pianta riconosciuta */
  const inCasa = (v, o) => (v + o) * PXM * big.k * sc.mpp + m * sc.mpp;
  return {
    via,
    r,
    sc,
    casa,
    arredi: arrediDallaPianta(img, casa, sc.mpp),
    big,
    inCasa: (x, y) => [inCasa(x, OX), inCasa(y, OY)],
    stanzaIn: (x, y) => {
      const [a, b] = [inCasa(x, OX), inCasa(y, OY)];
      return casa.tipo[Math.floor(b / casa.passo) * casa.W + Math.floor(a / casa.passo)];
    },
  };
}

const giro = riconosci(pianta());

test("pianta arredata: la scala dai muri grigi, anche ingrandita da piccola", () => {
  const { r, sc, big } = giro;
  assert.ok(Math.abs(r.spessore / big.k / PXM - MURO_FUORI) < 0.08, `muro ${r.spessore}`);
  const vero = 1 / (PXM * big.k);
  assert.ok(Math.abs(sc.mpp / vero - 1) < 0.2, `metri per pixel ${sc.mpp} invece di ${vero}`);
});

test("pianta arredata: tre stanze, il terrazzo e' fuori, le fughe e gli arredi non sono muri", () => {
  const { casa, stanzaIn } = giro;
  const grandi = casa.stanze.filter((s) => s.area >= 2);
  assert.equal(grandi.length, 3, `stanze: ${casa.stanze.map((s) => s.area.toFixed(1)).join(", ")}`);
  const soggiorno = stanzaIn(3, 4),
    camera = stanzaIn(8, 3),
    bagno = stanzaIn(8, 5);
  assert.ok(soggiorno > 0 && camera > 0 && bagno > 0, "le tre stanze ci sono");
  assert.equal(new Set([soggiorno, camera, bagno]).size, 3, "e sono tre diverse");
  /* il letto, il tavolo, il divano sono dentro le loro stanze, non muri */
  assert.equal(stanzaIn(8, 1.3), camera);
  assert.equal(stanzaIn(1.8, 5.0), soggiorno);
  assert.equal(stanzaIn(4.1, 2.9), soggiorno);
  /* il terrazzo tratteggiato e' fuori */
  assert.ok(!(stanzaIn(-1, 3) > 0), "il terrazzo non e' una stanza");
  const area = (id) => casa.stanze.find((s) => s.id === id).area;
  assert.ok(Math.abs(area(camera) - 13.5) < 3, `camera ${area(camera)}`);
  assert.ok(Math.abs(area(soggiorno) - 37) < 7, `soggiorno ${area(soggiorno)}`);
});

test("pianta arredata: le finestre dal tratto chiaro nel muro, le porte dal varco", () => {
  const { casa } = giro;
  const finestre = casa.aperture.filter((a) => a.tipo === "finestra"),
    porte = casa.aperture.filter((a) => a.tipo === "porta");
  assert.ok(finestre.length >= 2, `finestre: ${finestre.length}`);
  assert.ok(porte.length >= 2, `porte: ${porte.length}`);
});

test("pianta arredata: gli arredi principali, al loro posto e girati giusti", () => {
  const { arredi, stanzaIn, inCasa } = giro;
  const uno = (k) => {
    const a = arredi.filter((x) => x.k === k);
    assert.equal(a.length, 1, `${k}: ${arredi.map((x) => x.k).join(", ")}`);
    return a[0];
  };
  const vicino = (a, x, y, tol = 0.35) => {
    const [px, py] = inCasa(x, y);
    assert.ok(Math.hypot(a.x - px, a.y - py) < tol, `${a.k} a ${a.x},${a.y} invece di ${px},${py}`);
  };
  const letto = uno("matrimoniale");
  vicino(letto, 8.0, MURO_FUORI + 1.05);
  assert.equal(letto.stanza, stanzaIn(8, 3));
  assert.ok(Math.abs(letto.rot) < 0.01, "la testa contro il muro di sopra: guarda in giu'");
  const tavolo = uno("pranzo6");
  vicino(tavolo, 1.8, 5.05, 0.4);
  assert.ok(Math.abs(tavolo.l - 1.6) < 0.35, `tavolo lungo ${tavolo.l}`);
  const divano = uno("divano");
  vicino(divano, 4.1, 2.85);
  assert.ok(Math.abs(divano.rot) < 0.01, "lo schienale di sopra: guarda in giu'");
  const isola = uno("isola");
  vicino(isola, 2.1, 1.5);
  assert.ok(Math.abs(isola.rot) < 0.01, "gli sgabelli sotto");
  const camino = uno("camino");
  assert.ok(Math.abs(Math.abs(camino.rot) - Math.PI) < 0.01, "contro il muro di sotto: guarda in su");
  const vasca = uno("vasca");
  assert.equal(vasca.stanza, stanzaIn(8, 5));
  assert.ok(Math.abs(vasca.rot + Math.PI / 2) < 0.01, "contro il muro di destra: guarda a sinistra");
  /* meglio pochi giusti che tanti sbagliati */
  const noti = new Set(["matrimoniale", "comodino", "pranzo6", "divano", "isola", "camino", "vasca", "wc", "bidet"]);
  for (const a of arredi) assert.ok(noti.has(a.k), `arredo inventato: ${a.k}`);
  assert.ok(arredi.length <= 11, `troppi arredi: ${arredi.length}`);
});

test("le icone della centrale sopra la pianta: tolte, il muro sotto ricostruito, la casa uguale", () => {
  const im = pianta({ icone: true });
  const via = togliISovrapposti(im);
  assert.ok(via, "ci sono icone");
  assert.equal(via.tolte.length, 2);
  let azzurri = 0;
  for (let i = 0; i < via.im.data.length; i += 4) {
    const [r, g, b] = via.im.data.subarray(i, i + 3);
    if (b > 180 && r < 60) azzurri++;
  }
  assert.equal(azzurri, 0, "niente piu' azzurro");
  /* il muro di sopra, dove c'era l'icona, e' di nuovo grigio */
  const i = (Y(MURO_FUORI / 2) * im.width + X(4.5)) * 4,
    v = 0.3 * via.im.data[i] + 0.59 * via.im.data[i + 1] + 0.11 * via.im.data[i + 2];
  assert.ok(v > 90 && v < 190, `il muro sotto l'icona: ${v}`);
  const g = riconosci(im);
  assert.equal(
    g.casa.stanze.filter((s) => s.area >= 2).length,
    3,
    `stanze: ${g.casa.stanze.map((s) => s.area.toFixed(1)).join(", ")}`,
  );
  assert.ok(g.arredi.some((a) => a.k === "matrimoniale"), "il letto c'e' ancora");
});

test("niente da togliere su una pianta a righe nere, e una pianta a righe non e' arredata", () => {
  const im = tela(16 * PXM, 11 * PXM, [245, 245, 245]);
  for (let y = 3 * PXM; y < 8 * PXM; y++)
    for (let x = 4 * PXM; x < 12 * PXM; x++)
      if (y < 3 * PXM + 8 || y >= 8 * PXM - 8 || x < 4 * PXM + 8 || x >= 12 * PXM - 8)
        im.data.set([20, 20, 20], (y * im.width + x) * 4);
  assert.equal(togliISovrapposti(im), null);
  assert.equal(leggiIlRender(im), null);
});
