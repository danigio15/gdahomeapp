import test from "node:test";
import assert from "node:assert/strict";
import { archiDellePorte } from "../src/core/archi-delle-porte.js";

const PASSO = 0.03;

/* Una griglia sintetica: si disegna a celle, come fa pianta-da-foto.js. */
function griglia(W, H) {
  return { W, H, riga: new Uint8Array(W * H), muro: new Uint8Array(W * H) };
}
function segna(g, mappa, x, y) {
  if (x >= 0 && y >= 0 && x < g.W && y < g.H) g[mappa][y * g.W + x] = 1;
}
/* una riga dritta, sottile */
function linea(g, x0, y0, x1, y1) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let k = 0; k <= n; k++)
    segna(g, "riga", Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n));
}
/* un muro pieno (chiuso) con le due righe sulle facce, come un tramezzo a
 * doppia riga dopo la chiusura */
function muro(g, x0, y0, x1, y1) {
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      segna(g, "muro", x, y);
      if (y === y0 || y === y1 || x === x0 || x === x1) segna(g, "riga", x, y);
    }
}
/* il varco: via muro e righe */
function varco(g, x0, y0, x1, y1) {
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      g.muro[y * g.W + x] = 0;
      g.riga[y * g.W + x] = 0;
    }
}
/* un arco di cerchio, da «da» a «a» gradi, di una cella di spessore, con un
 * buco ogni «buco» celle (a 3 cm per cella l'arco vero ha i buchi) */
function arco(g, cx, cy, r, da, a, buco = 0) {
  const passi = Math.ceil((Math.abs(a - da) * Math.PI * r) / 180) * 2;
  let n = 0;
  for (let k = 0; k <= passi; k++) {
    const t = ((da + ((a - da) * k) / passi) * Math.PI) / 180;
    const x = Math.round(cx + r * Math.cos(t)),
      y = Math.round(cy + r * Math.sin(t));
    n++;
    if (buco && n % buco === 0) continue;
    segna(g, "riga", x, y);
  }
}
/* una porta: muro orizzontale con le facce in y0 e y1, cerniera in
 * (hx, y1), si apre verso il basso, arco verso destra */
function porta(g, hx, y0, y1, r, { anta = true, buco = 0 } = {}) {
  varco(g, hx, y0, hx + r, y1);
  arco(g, hx, y1, r, 0, 90, buco);
  if (anta) linea(g, hx, y1 + 1, hx, y1 + r);
}

test("trova la porta: arco con buchi e anta su un tramezzo a doppia riga", () => {
  const g = griglia(200, 200);
  muro(g, 10, 98, 190, 102);
  muro(g, 10, 10, 14, 190);
  porta(g, 80, 98, 102, 27, { buco: 7 });
  const { archi, celle } = archiDellePorte(g.riga, g.muro, g.W, g.H, PASSO);
  assert.equal(archi.length, 1);
  const a = archi[0];
  assert.ok(Math.abs(a.raggio - 27) <= 2, `raggio ${a.raggio}`);
  assert.ok(Math.abs(a.cerniera[0] - 80) <= 2 && Math.abs(a.cerniera[1] - 102) <= 2);
  assert.ok(a.x0 >= 78 && a.x1 <= 110 && a.y0 >= 100 && a.y1 <= 131, JSON.stringify(a));
  /* l'apertura: il varco nel muro, spesso quanto il muro */
  const ap = a.apertura;
  assert.ok(ap.x0 <= 82 && ap.x1 >= 105, JSON.stringify(ap));
  assert.ok(ap.y0 <= 98 && ap.y1 >= 102 && ap.y1 <= 104, JSON.stringify(ap));
  /* le celle: l'arco e l'anta si', le righe del muro no */
  let sull = 0,
    anta = 0;
  for (let y = 0; y < g.H; y++)
    for (let x = 0; x < g.W; x++) {
      if (!celle[y * g.W + x]) continue;
      const d = Math.hypot(x - 80, y - 102);
      if (Math.abs(d - 27) <= 1.6) sull++;
      else if (x === 80 && y > 102) anta++;
      else assert.fail(`cella fuori dall'arco: ${x},${y}`);
    }
  assert.ok(sull >= 30, `celle sull'arco ${sull}`);
  assert.ok(anta >= 20, `celle sull'anta ${anta}`);
});

test("la porta a due ante: due archi affiancati, due cerniere", () => {
  const g = griglia(200, 160);
  muro(g, 10, 60, 190, 64);
  varco(g, 70, 60, 120, 64);
  /* le due ante si aprono verso il basso e si toccano in mezzo al varco */
  arco(g, 70, 64, 25, 0, 90);
  linea(g, 70, 65, 70, 89);
  arco(g, 120, 64, 25, 90, 180);
  linea(g, 120, 65, 120, 89);
  const { archi } = archiDellePorte(g.riga, g.muro, g.W, g.H, PASSO);
  assert.equal(archi.length, 2);
  const cerniere = archi.map((a) => a.cerniera[0]).sort((p, q) => p - q);
  assert.ok(Math.abs(cerniere[0] - 70) <= 2 && Math.abs(cerniere[1] - 120) <= 2, cerniere);
  for (const a of archi) assert.ok(a.apertura.y0 <= 60 && a.apertura.y1 >= 64);
});

test("la porta in un muro verticale, aperta verso sinistra", () => {
  const g = griglia(160, 200);
  muro(g, 100, 10, 106, 190);
  varco(g, 100, 50, 106, 80);
  /* cerniera in basso (100, 80), l'arco sale a sinistra, l'anta e' orizzontale */
  arco(g, 100, 80, 30, 180, 270);
  linea(g, 99, 80, 70, 80);
  const { archi } = archiDellePorte(g.riga, g.muro, g.W, g.H, PASSO);
  assert.equal(archi.length, 1);
  const a = archi[0];
  assert.ok(Math.abs(a.cerniera[0] - 100) <= 2 && Math.abs(a.cerniera[1] - 80) <= 2);
  assert.ok(a.apertura.x0 <= 100 && a.apertura.x1 >= 106 && a.apertura.x1 <= 108);
  assert.ok(a.apertura.y0 <= 52 && a.apertura.y1 >= 78);
});

test("non prende finestre, gradini, scritte, quote, cerchi interi, archi lontani dai muri", () => {
  const g = griglia(300, 300);
  muro(g, 10, 10, 290, 14);
  muro(g, 10, 10, 14, 290);
  muro(g, 10, 150, 290, 154);
  /* la finestra: tre righe parallele dentro lo spessore del muro */
  varco(g, 60, 150, 100, 154);
  for (const y of [150, 152, 154]) linea(g, 60, y, 100, y);
  /* la scala: gradini paralleli e le due righe laterali */
  for (let y = 40; y <= 120; y += 4) linea(g, 200, y, 240, y);
  linea(g, 200, 40, 200, 120);
  linea(g, 240, 40, 240, 120);
  /* una scritta: lettere da 12 celle (36 cm) fatte di tratti corti */
  for (let k = 0; k < 6; k++) {
    const x = 40 + k * 16;
    linea(g, x, 200, x, 212);
    linea(g, x, 200, x + 10, 200);
    linea(g, x + 10, 200, x + 10, 206);
    linea(g, x, 206, x + 10, 206);
  }
  /* la barra della quota, con le tacche */
  linea(g, 100, 250, 250, 250);
  linea(g, 100, 245, 100, 255);
  linea(g, 250, 245, 250, 255);
  /* un cerchio intero (un tavolo) e un semicerchio, grandi come una porta */
  arco(g, 150, 80, 25, 0, 360);
  arco(g, 150, 220, 25, 0, 180);
  /* un quarto di cerchio in mezzo alla stanza: niente muro alla cerniera */
  arco(g, 100, 60, 27, 0, 90);
  /* un tratteggio a 45° come quello dei muri esterni, in una zona a parte */
  for (let k = 0; k < 20; k++) linea(g, 250 + k * 2, 200, 250 + k * 2 - 12, 212);
  const { archi, celle } = archiDellePorte(g.riga, g.muro, g.W, g.H, PASSO);
  assert.deepEqual(archi, []);
  assert.equal(
    celle.reduce((s, v) => s + v, 0),
    0,
  );
});

test("griglie vuote e bordi: niente archi, niente errori", () => {
  const vuota = archiDellePorte(new Uint8Array(0), new Uint8Array(0), 0, 0, PASSO);
  assert.deepEqual(vuota.archi, []);
  assert.equal(vuota.celle.length, 0);
  const g = griglia(60, 60);
  const niente = archiDellePorte(g.riga, g.muro, g.W, g.H, PASSO);
  assert.deepEqual(niente.archi, []);
  assert.equal(niente.celle.length, 60 * 60);
  /* un arco attaccato al bordo della griglia: la cerniera sta sul bordo e il
   * riquadro non esce */
  const b = griglia(80, 80);
  muro(b, 0, 0, 79, 4);
  porta(b, 0, 0, 4, 25);
  const { archi } = archiDellePorte(b.riga, b.muro, b.W, b.H, PASSO);
  for (const a of archi) {
    assert.ok(a.x0 >= 0 && a.y0 >= 0 && a.x1 < 80 && a.y1 < 80);
    assert.ok(a.apertura.x0 >= 0 && a.apertura.y0 >= 0 && a.apertura.x1 < 80 && a.apertura.y1 < 80);
  }
  /* senza la mappa dei muri non c'e' porta: l'arco da solo non basta */
  const c = griglia(120, 120);
  arco(c, 40, 40, 27, 0, 90);
  assert.deepEqual(archiDellePorte(c.riga, null, c.W, c.H, PASSO).archi, []);
});
