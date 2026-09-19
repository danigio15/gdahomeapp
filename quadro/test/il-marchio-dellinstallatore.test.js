/* Il marchio di un installatore: cosa si accetta, e cosa si serve.
 *
 * E' un file che arriva da fuori e che poi **il quadro serve senza chiave**,
 * perche' deve finire nel browser di chi abita una casa abbinata. Quindi le
 * prove che contano sono due: che roba si accetta, e che il tipo con cui si
 * serve sia quello che il file e' davvero — non quello che dice il nome.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { cheRazzaE, ilTipoDi, Marchi, QUANTO_GROSSO } from "../src/marchi.js";

const CHI = "inst_0123456789abcdef";
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect /></svg>', "utf8");

function banco() {
  const cartella = mkdtempSync(join(tmpdir(), "quadro-marchi-"));
  return {
    marchi: new Marchi({ cartella }),
    chiudi: () => rmSync(cartella, { recursive: true, force: true }),
  };
}

test("si guarda come comincia il file, non come si chiama", () => {
  /* Il nome lo sceglie chi carica. Un `.png` che dentro e' un eseguibile resta
   * un eseguibile, e servirlo come `image/png` vorrebbe dire metterci la
   * firma sopra. */
  assert.equal(cheRazzaE(PNG), "png");
  assert.equal(cheRazzaE(JPG), "jpg");
  assert.equal(cheRazzaE(SVG), "svg");
  assert.equal(cheRazzaE(Buffer.from("MZ un eseguibile", "utf8")), "");
  assert.equal(cheRazzaE(Buffer.from("%PDF-1.7", "utf8")), "");
  assert.equal(cheRazzaE(Buffer.from("<html><body>ciao</body></html>", "utf8")), "");
  assert.equal(cheRazzaE(Buffer.from("", "utf8")), "");
  assert.equal(cheRazzaE("non un buffer"), "");
});

test("un SVG si riconosce anche se comincia con la dichiarazione o un commento", () => {
  /* E' testo: puo' cominciare con dei bianchi, con `<?xml`, o con un commento
   * messo da chi l'ha esportato. Guardare il primo byte non basta. */
  for (const prima of ['<?xml version="1.0"?>', "<!-- fatto con Inkscape -->", "\n  "]) {
    assert.equal(cheRazzaE(Buffer.from(`${prima}<svg viewBox="0 0 1 1"></svg>`, "utf8")), "svg");
  }
  /* Ma un file che si limita a nominare un `<svg>` dentro dell'altro non lo e'. */
  assert.equal(cheRazzaE(Buffer.from("<html><p>un svg</p></html>", "utf8")), "");
});

test("il tipo con cui si serve e' quello della razza, e per le altre non c'e'", () => {
  assert.equal(ilTipoDi("png"), "image/png");
  assert.equal(ilTipoDi("svg"), "image/svg+xml");
  assert.equal(ilTipoDi("exe"), "");
  assert.equal(ilTipoDi(""), "");
});

test("si mette, si rilegge, si toglie", () => {
  const b = banco();
  try {
    assert.equal(b.marchi.metti(CHI, PNG), "png");
    assert.deepEqual(b.marchi.leggi(CHI, "png"), PNG);
    b.marchi.togli(CHI, "png");
    assert.equal(b.marchi.leggi(CHI, "png"), null);
  } finally {
    b.chiudi();
  }
});

test("cambiando razza non restano due file", () => {
  /* Da PNG a SVG: se il vecchio non si togliesse, in cartella ne resterebbero
   * due e il giorno che uno li guarda non saprebbe quale vale. */
  const b = banco();
  try {
    b.marchi.metti(CHI, PNG);
    assert.equal(b.marchi.metti(CHI, SVG, "png"), "svg");
    assert.equal(b.marchi.leggi(CHI, "png"), null);
    assert.deepEqual(b.marchi.leggi(CHI, "svg"), SVG);
  } finally {
    b.chiudi();
  }
});

test("quello che non e' un'immagine non si mette, e non lascia niente dietro", () => {
  const b = banco();
  try {
    for (const storto of [
      Buffer.from("MZ un eseguibile", "utf8"),
      Buffer.alloc(QUANTO_GROSSO + 1, 0x89),
      Buffer.alloc(0),
      "non un buffer",
    ]) {
      assert.equal(b.marchi.metti(CHI, storto), "");
    }
    for (const razza of ["png", "jpg", "webp", "svg"]) {
      assert.equal(b.marchi.leggi(CHI, razza), null);
    }
  } finally {
    b.chiudi();
  }
});

test("un marchio che l'archivio dice e che il file non ha non e' un guasto", () => {
  /* Succede se qualcuno ha ripulito `/data` a mano. E' un marchio che non
   * c'e', e chi disegna mette il nostro: non una pagina che si ferma. */
  const b = banco();
  try {
    assert.equal(b.marchi.leggi(CHI, "png"), null);
    assert.equal(b.marchi.leggi(CHI, ""), null);
    assert.equal(b.marchi.leggi(CHI, "exe"), null);
  } finally {
    b.chiudi();
  }
});
