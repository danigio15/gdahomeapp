import { test } from "node:test";
import assert from "node:assert/strict";
import { finestreNeiMuri } from "../src/core/finestre-nei-muri.js";

const PASSO = 0.03;

/* Una griglia vuota con le due mappe e un pennello che disegna in celle. */
function griglia(W, H) {
  const riga = new Uint8Array(W * H),
    muro = new Uint8Array(W * H);
  const segna = (mappa, x0, y0, x1, y1) => {
    for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++)
      for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) mappa[y * W + x] = 1;
  };
  return { W, H, riga, muro, segna };
}

/* Un muro esterno «tratteggiato» come lo disegna un CAD, orizzontale da xa a
 * xb, con la fascia sulle righe y0..y0+t-1: due righe ai bordi (spesse due
 * celle), una riga tratteggiata appena dentro il bordo esterno, il resto
 * vuoto (la campitura grigia non e' inchiostro). Tutto e' muro chiuso. */
function muroTratteggiato(g, xa, xb, y0, t = 18) {
  g.segna(g.muro, xa, y0, xb, y0 + t - 1);
  g.segna(g.riga, xa, y0, xb, y0 + 1);
  g.segna(g.riga, xa, y0 + 4, xb, y0 + 4);
  g.segna(g.riga, xa, y0 + t - 3, xb, y0 + t - 1);
}

/* La finestra nel muro di sopra, da xa a xb: fra i due stipiti il muro
 * cambia inchiostro (via il tratteggio, bordi sottili) e nel cuore corre la
 * riga del vetro, col trattino in mezzo. */
function finestraNelTratteggiato(g, xa, xb, y0, t = 18) {
  for (let y = y0; y < y0 + t; y++)
    for (let x = xa; x <= Math.min(xb, g.W - 1); x++) g.riga[y * g.W + x] = 0;
  g.segna(g.riga, xa, y0, xb, y0 + 1);
  g.segna(g.riga, xa, y0 + t - 2, xb, y0 + t - 1);
  g.segna(g.riga, xa, y0 + 9, xb, y0 + 12);
  g.segna(g.riga, xa, y0, xa, y0 + t - 1);
  g.segna(g.riga, xb, y0, xb, y0 + t - 1);
  const m = (xa + xb) >> 1;
  g.segna(g.riga, m, y0, m, y0 + t - 1);
}

/* Un tramezzo a doppia riga verticale, da ya a yb, sulle colonne x0..x0+4. */
function tramezzo(g, x0, ya, yb) {
  g.segna(g.muro, x0, ya, x0 + 4, yb);
  g.segna(g.riga, x0, ya, x0, yb);
  g.segna(g.riga, x0 + 4, ya, x0 + 4, yb);
}

test("trova la finestra in un muro esterno tratteggiato, dove deve", () => {
  const g = griglia(300, 80);
  muroTratteggiato(g, 10, 289, 30);
  finestraNelTratteggiato(g, 120, 165, 30);
  const { vetro, finestre } = finestreNeiMuri(g.riga, g.muro, g.W, g.H, PASSO);
  assert.equal(finestre.length, 1);
  const f = finestre[0];
  assert.deepEqual(
    { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1, oriz: f.oriz },
    { x0: 120, y0: 30, x1: 165, y1: 47, oriz: true },
  );
  assert.ok(Math.abs(f.largo - 46 * PASSO) < 1e-9);
  /* il vetro sta solo nel riquadro della finestra, ed e' tutto muro */
  let dentro = 0,
    fuori = 0;
  for (let i = 0; i < g.W * g.H; i++) {
    if (!vetro[i]) continue;
    assert.equal(g.muro[i], 1);
    const x = i % g.W,
      y = (i / g.W) | 0;
    if (x >= 120 && x <= 165 && y >= 30 && y <= 47) dentro++;
    else fuori++;
  }
  assert.equal(fuori, 0);
  assert.equal(dentro, 46 * 18);
});

test("la finestra verticale, e due finestre vicine nello stesso muro", () => {
  /* lo stesso disegno trasposto: il muro corre lungo y */
  const g = griglia(80, 300),
    o = griglia(300, 80);
  muroTratteggiato(o, 10, 289, 30);
  finestraNelTratteggiato(o, 60, 105, 30);
  finestraNelTratteggiato(o, 200, 245, 30);
  for (let y = 0; y < 80; y++)
    for (let x = 0; x < 300; x++) {
      g.riga[x * 80 + y] = o.riga[y * 300 + x];
      g.muro[x * 80 + y] = o.muro[y * 300 + x];
    }
  const { finestre } = finestreNeiMuri(g.riga, g.muro, g.W, g.H, PASSO);
  assert.equal(finestre.length, 2);
  assert.deepEqual(
    finestre.map((f) => [f.x0, f.y0, f.x1, f.y1, f.oriz]),
    [
      [30, 60, 47, 105, false],
      [30, 200, 47, 245, false],
    ],
  );
});

test("un tramezzo a doppia riga: la finestra ha piu' righe del muro, la porta no", () => {
  const g = griglia(60, 400);
  /* il tramezzo, con un varco di porta (il varco non e' muro) a 150..180 e
   * le righe dell'anta ai due lati del varco */
  tramezzo(g, 20, 10, 149);
  tramezzo(g, 20, 181, 389);
  g.segna(g.riga, 20, 149, 40, 149);
  g.segna(g.riga, 20, 181, 40, 181);
  /* la finestra a 260..300: stipiti e due righe in piu' nel cuore */
  g.segna(g.riga, 20, 260, 24, 260);
  g.segna(g.riga, 20, 300, 24, 300);
  g.segna(g.riga, 22, 260, 22, 300);
  const { finestre } = finestreNeiMuri(g.riga, g.muro, g.W, g.H, PASSO);
  assert.equal(finestre.length, 1);
  assert.deepEqual(
    [finestre[0].x0, finestre[0].y0, finestre[0].x1, finestre[0].y1, finestre[0].oriz],
    [20, 260, 24, 300, false],
  );
});

test("non trova quello che non deve: muri senza finestre, porte, scritte", () => {
  const g = griglia(300, 200);
  /* un muro tratteggiato intero, uno con un varco di porta, un tramezzo */
  muroTratteggiato(g, 10, 289, 20);
  muroTratteggiato(g, 10, 140, 100);
  muroTratteggiato(g, 171, 289, 100);
  tramezzo(g, 60, 38, 99);
  /* un pezzo di muro fra due «stipiti» (le righe delle ante di due porte)
   * ha l'inchiostro del muro: non e' una finestra */
  g.segna(g.riga, 200, 100, 200, 117);
  g.segna(g.riga, 250, 100, 250, 117);
  /* una scritta chiusa dentro un blocco di muro: inchiostro a casaccio */
  let seme = 7;
  const caso = () => ((seme = (seme * 1103515245 + 12345) & 0x7fffffff), seme / 0x7fffffff);
  g.segna(g.muro, 100, 150, 180, 164);
  for (let y = 150; y < 165; y++)
    for (let x = 100; x <= 180; x++) if (caso() < 0.5) g.riga[y * g.W + x] = 1;
  const { vetro, finestre } = finestreNeiMuri(g.riga, g.muro, g.W, g.H, PASSO);
  assert.deepEqual(finestre, []);
  assert.equal(
    vetro.some((v) => v),
    false,
  );
});

test("bordi e griglie vuote", () => {
  for (const [W, H] of [
    [0, 0],
    [1, 1],
    [5, 3],
  ]) {
    const { vetro, finestre } = finestreNeiMuri(
      new Uint8Array(W * H),
      new Uint8Array(W * H),
      W,
      H,
      PASSO,
    );
    assert.deepEqual(finestre, []);
    assert.equal(vetro.length, W * H);
  }
  /* tutto muro e tutto inchiostro: nessun tratto normale */
  const pieno = new Uint8Array(40 * 40).fill(1);
  assert.deepEqual(finestreNeiMuri(pieno, pieno, 40, 40, PASSO).finestre, []);
  /* una finestra attaccata al bordo della griglia: il muro parte da x=0 e
   * la finestra sta in fondo, contro l'ultima colonna */
  const g = griglia(200, 60);
  muroTratteggiato(g, 0, 199, 0);
  finestraNelTratteggiato(g, 150, 205, 0);
  const { finestre } = finestreNeiMuri(g.riga, g.muro, g.W, g.H, PASSO);
  /* lo stipite in fondo manca (e' oltre il bordo, tagliato via): niente
   * finestra, e niente errori */
  assert.deepEqual(finestre, []);
  /* la stessa finestra un poco piu' dentro si trova */
  const h = griglia(200, 60);
  muroTratteggiato(h, 0, 199, 0);
  finestraNelTratteggiato(h, 150, 195, 0);
  assert.equal(finestreNeiMuri(h.riga, h.muro, h.W, h.H, PASSO).finestre.length, 1);
});

test("una finestra piu' corta di 40 cm o piu' lunga di 3,2 m non conta", () => {
  /* una vetrata lunga 4,8 m e una finestrella da 33 cm, in un muro dove il
   * tratteggio fra le due e' un candidato (sta fra due stipiti); il secondo
   * muro, tutto tratteggio, e' il muro di riferimento della pianta */
  const g = griglia(400, 120);
  muroTratteggiato(g, 5, 394, 20);
  muroTratteggiato(g, 5, 394, 80);
  finestraNelTratteggiato(g, 30, 40, 20);
  finestraNelTratteggiato(g, 100, 260, 20);
  assert.deepEqual(finestreNeiMuri(g.riga, g.muro, g.W, g.H, PASSO).finestre, []);
});
