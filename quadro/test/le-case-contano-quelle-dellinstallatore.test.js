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

/* «Case Premium» contava le Premium senza i regali, perche' i regali avevano la
 * loro casella. Ma «non capisco nulla sulle licenze»: Premium e Base devono
 * fare tutte le case, e una casa regalata e' Premium quanto una che paga.
 * Adesso «Case Premium» le conta tutte, «su» quante sono, e il perche' lo
 * dice la ciambella delle case per piano: pagano, in prova, regalo tuo,
 * dagli installatori, Base. La casella «Regali» resta, per i regali e i
 * codici. */
test("«Case Premium» conta tutte le Premium, e la ciambella dice perche'", () => {
  assert.match(GESTORE, /premium: tutte\.filter\(\(una\) => una\.licenza\.premium\)\.length,/);
  assert.match(
    GESTORE,
    /"Case Premium",\s*numero\(casa\.premium\),\s*`\/\$\{numero\(casa\.tutte\)\}`/,
  );
  for (const parola of [
    "Pagano un abbonamento",
    "In prova gratuita",
    "Regalo tuo",
    "Dagli installatori",
    "Base, gratis",
  ])
    assert.ok(GESTORE.includes(`"${parola}"`), `la ciambella non dice piu' «${parola}»`);
  assert.equal(GESTORE.includes('plurale(daDove("regalo")'), false);
});
