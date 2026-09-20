/* Il carattere delle pagine lo serve il quadro, non Google.
 *
 * E' la stessa regola delle icone e dei marchi: il browser di chi apre queste
 * pagine non va a farsi vedere da nessun altro. Un `<link>` a Google Fonts
 * sarebbe esattamente quello — ogni installatore, a ogni pagina, che si
 * presenta a una macchina che non e' la nostra.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { alzaIlQuadro } from "../src/index.js";

const QUI = dirname(fileURLToPath(import.meta.url));

test("il carattere si serve da qui, senza chiave, con la cache lunga", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "carattere-"));
  const acceso = await alzaIlQuadro({ porta: 0, cartella, livello: "errore" });
  try {
    for (const nome of ["manrope-latin", "manrope-latin-ext"]) {
      const risposta = await fetch(`http://127.0.0.1:${acceso.porta}/carattere/${nome}.woff2`);
      assert.equal(risposta.status, 200, `${nome} non si serve`);
      assert.equal(risposta.headers.get("content-type"), "font/woff2");
      assert.match(risposta.headers.get("cache-control"), /max-age=31536000/);
      const byte = Buffer.from(await risposta.arrayBuffer());
      /* Un woff2 comincia con «wOF2»: se comincia con altro, e' un altro file. */
      assert.equal(byte.subarray(0, 4).toString("latin1"), "wOF2");
    }
    /* Non e' una porta per leggere file: solo quei due nomi. */
    for (const storto of [
      "manrope-latin.ttf",
      "../src/server.js",
      "altro.woff2",
      "manrope-latin-ext.woff2/..",
    ]) {
      const risposta = await fetch(`http://127.0.0.1:${acceso.porta}/carattere/${storto}`);
      assert.equal(risposta.status, 404, `«${storto}» ha risposto ${risposta.status}`);
    }
  } finally {
    await acceso.spegni();
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("nessuna delle due pagine va a prendere un carattere da fuori", () => {
  for (const pagina of ["console/index.html", "gestore/index.html"]) {
    const testo = readFileSync(join(QUI, "..", pagina), "utf8");
    assert.doesNotMatch(
      testo,
      /fonts\.googleapis\.com|fonts\.gstatic\.com/,
      `${pagina} chiama Google`,
    );
    assert.doesNotMatch(testo, /<link[^>]+href="https?:\/\//, `${pagina} carica qualcosa da fuori`);
  }
});

test("la licenza del carattere viaggia con lui", () => {
  const licenza = readFileSync(join(QUI, "..", "carattere", "OFL.txt"), "utf8");
  assert.match(licenza, /SIL Open Font License/i);
});
