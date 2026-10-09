/* «Nessun condizionatore configurato. Aggiungi le unità dalla Configurazione
 * della plancia — anche se presenti nella configurazione.» (#196)
 *
 * L'8 ottobre i condizionatori di maggio-settembre stanno fuori stagione, e la
 * griglia vuota diceva di andarli ad aggiungere. Adesso dice che sono fuori
 * stagione, quando si vedono, e offre di mostrarli lo stesso.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../src/sections/climate-thermal-section.js", import.meta.url),
  "utf8",
);

const { seasonEmptyMarkup } = await import("../src/sections/climate-thermal-section.js");

test("una zona tenuta fuori dalla stagione non dice «nessuno configurato»", () => {
  const fuori = [
    { entity: "climate.salone", zone: "freddo", mesi: [5, 6, 7, 8, 9] },
    { entity: "climate.camera", zone: "freddo", mesi: [5, 6, 7, 8, 9] },
  ];
  const html = seasonEmptyMarkup("freddo", fuori);
  assert.match(html, /Condizionatori fuori stagione · 2/);
  assert.match(html, /Si vedono: da maggio a settembre/);
  assert.match(html, /data-dm-cl-mostra-fuori/);
  assert.doesNotMatch(html, /Nessun condizionatore configurato/);
  assert.doesNotMatch(html, /Aggiungi le unità/);
});

test("con mesi diversi non si inventa un periodo solo", () => {
  const html = seasonEmptyMarkup("caldo", [
    { entity: "climate.bagno", zone: "caldo", mesi: [10, 11, 12, 1, 2, 3, 4] },
    { entity: "climate.studio", zone: "caldo", mesi: [11, 12, 1, 2] },
  ]);
  assert.match(html, /Termosifoni fuori stagione · 2/);
  assert.match(html, /Ognuno ha i suoi mesi/);
});

test("la griglia sceglie il vuoto della stagione prima di quello della configurazione", () => {
  const sync = source.slice(source.indexOf("function syncGrid("));
  const corpo = sync.slice(0, sync.indexOf("\n}\n"));
  assert.ok(
    corpo.indexOf("seasonEmptyMarkup") < corpo.indexOf("emptyMarkup(grid"),
    "con unità fuori stagione la griglia non deve dire di aggiungerle",
  );
  assert.match(source, /fuori\.filter\(\(unit\) => unit\.zone === zone\)/);
  assert.match(source, /state\.mostraFuoriStagione = true/);
});
