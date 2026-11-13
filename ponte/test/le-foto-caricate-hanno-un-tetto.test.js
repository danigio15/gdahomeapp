/* Le foto caricate dalla plancia stanno sul disco dell'add-on (`/data`), lo
 * stesso della configurazione: chi caricava a ripetizione lo riempiva, dieci
 * megabyte alla volta, e da li' in poi non si salvava piu' niente. Adesso
 * c'e' un tetto per tutta la cartella (`TETTO_DELLE_FOTO`) e un limite a
 * quante foto carica una persona di fila; le foto di una casa normale ci
 * stanno larghe.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Commissioni } from "../src/commissioni.js";
import { CartellaDelleFotoPiena, Foto, TETTO_DELLE_FOTO } from "../src/foto.js";

const ZITTO = { info() {}, attenzione() {}, errore() {} };
const LEI = "a".repeat(32);
const LUI = "b".repeat(32);

/* Un PNG da un kilobyte: la firma giusta e il resto riempito. */
const PNG = Buffer.concat([Buffer.from("\x89PNG\r\n\x1a\n", "latin1"), Buffer.alloc(1016, 1)]);

function unaCartella(opzioni = {}) {
  const dove = mkdtempSync(join(tmpdir(), "foto-tetto-"));
  return {
    foto: new Foto({ cartella: join(dove, "www"), ...opzioni }),
    via: () => rmSync(dove, { recursive: true, force: true }),
  };
}

test("il tetto di serie e' di trecento megabyte", () => {
  assert.equal(TETTO_DELLE_FOTO, 300 * 1024 * 1024);
});

test("oltre il tetto della cartella una foto non si mette, e lo si dice", () => {
  const { foto, via } = unaCartella({ tetto: 3 * PNG.length });
  try {
    assert.ok(foto.carica("uno.png", PNG));
    assert.ok(foto.carica("due.png", PNG, { cartella: "riquadri" }));
    assert.ok(foto.carica("tre.png", PNG));
    assert.throws(() => foto.carica("quattro.png", PNG), CartellaDelleFotoPiena);
    /* Le foto che c'erano restano, e si leggono. */
    assert.equal(foto.elenca("dashboardmodern").images.length, 2);
  } finally {
    via();
  }
});

test("dalla plancia: la cartella piena e' un no chiaro, non «non e' un'immagine»", async () => {
  const { foto, via } = unaCartella({ tetto: PNG.length });
  try {
    const commissioni = new Commissioni({ registro: ZITTO, foto });
    const carica = (nome) =>
      commissioni.rispondi(
        {
          id: 1,
          type: "dashboardmodern/www/upload",
          filename: nome,
          data: PNG.toString("base64"),
        },
        { chiChiede: LEI },
      );
    assert.equal((await carica("prima.png")).success, true);
    const piena = await carica("seconda.png");
    assert.equal(piena.success, false);
    assert.equal(piena.error.code, "storage_full");
    assert.match(piena.error.message, /300 MB/);
  } finally {
    via();
  }
});

test("una persona non carica centinaia di foto di fila; un'altra non paga per lei", async () => {
  const { foto, via } = unaCartella();
  try {
    const commissioni = new Commissioni({ registro: ZITTO, foto });
    const carica = (chi, n) =>
      commissioni.rispondi(
        {
          id: n,
          type: "dashboardmodern/www/upload",
          filename: `stanza-${n}.png`,
          data: PNG.toString("base64"),
        },
        { chiChiede: chi },
      );
    /* Le foto di tutte le stanze e qualche sfondo passano. */
    for (let n = 0; n < 40; n += 1) assert.equal((await carica(LEI, n)).success, true, `foto ${n}`);
    const troppe = await carica(LEI, 40);
    assert.equal(troppe.success, false);
    assert.equal(troppe.error.code, "rate_limited");
    assert.equal((await carica(LUI, 41)).success, true);
  } finally {
    via();
  }
});
