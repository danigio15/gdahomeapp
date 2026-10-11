/* Le finestre dei widget si registrano una per una, e la Home le chiede prima
 * di ripiegare su quella generica. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  finestraDi,
  registraFinestra,
  stiliDelleFinestre,
  tastoServizio,
} from "../src/sections/finestre-dei-widget.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");

test("una finestra registrata si ritrova con la sua chiave, col suo stile", () => {
  assert.equal(
    registraFinestra("prova-finestra", { disegna: () => "<p>ok</p>", stile: ".x{}" }),
    true,
  );
  assert.equal(finestraDi("prova-finestra").disegna({}, {}), "<p>ok</p>");
  assert.match(stiliDelleFinestre(), /\.x\{\}/);
  assert.equal(finestraDi("nessuna"), null);
  assert.equal(registraFinestra("", { disegna: () => "" }), false);
});

test("il tasto porta il servizio, e la conferma quando serve", () => {
  const tasto = tastoServizio(
    { domain: "cover", service: "open_cover", data: { entity_id: "cover.cancello" } },
    { testo: "Apri", conferma: "Tocca ancora per aprire" },
  );
  assert.match(tasto, /data-dm-w-servizio="\{&quot;domain&quot;:&quot;cover&quot;/);
  assert.match(tasto, /data-dm-w-conferma="Tocca ancora per aprire"/);
});

test("la Home chiede la finestra disegnata prima di quella generica", () => {
  const home = readFileSync(join(SRC, "sections/home-widgets-section.js"), "utf8");
  assert.match(home, /const disegnata = finestraDi\(widget\.key\)/);
  assert.match(home, /if \(suTastoServizio\(event\)\) return;/);
  assert.match(home, /entita\.some\(\(id\) => !siComanda\(id\)\)/);
});
