/* «Nel conteggio dove è presente 6 li voglio vedere solo le case gestite da
 * installatore, i codici regalati li voglio vedere in un'altra casella.»
 *
 * La casella «Case» della Panoramica contava anche le case che il quadro
 * conosce solo per la licenza (un regalo, un acquisto senza installatore):
 * 6 con «1 senza installatore» dentro. Adesso conta le seguite, e i regali
 * stanno in una casella loro che porta a «Regali e codici».
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const QUI = dirname(fileURLToPath(import.meta.url));
const GESTORE = readFileSync(join(QUI, "..", "gestore", "index.html"), "utf8");

function laCasella(etichetta) {
  const riga = new RegExp(
    `numerone\\("([^"]+)",\\s*"([^"]+)",\\s*"${etichetta}",\\s*([^,]+),`,
  ).exec(GESTORE);
  assert.ok(riga, `la casella «${etichetta}» non c'è`);
  return { vai: riga[1], icona: riga[2], valore: riga[3].trim() };
}

test("«Case» conta solo quelle seguite da un installatore", () => {
  assert.equal(laCasella("Case").valore, "numero(seguite.length)");
  assert.equal(GESTORE.includes("senza installatore` :"), false);
});

test("i regali hanno la loro casella, che porta a «Regali e codici»", () => {
  const regali = laCasella("Regali");
  assert.equal(regali.vai, "licenze");
  assert.equal(regali.valore, "numero(regalate.length)");
  assert.match(GESTORE, /codiciLiberi[\s\S]{0,200}da usare/);
});
