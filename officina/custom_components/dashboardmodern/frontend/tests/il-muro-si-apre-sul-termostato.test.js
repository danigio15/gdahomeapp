/* La pagina Clima del muro si apre anche sul Termostato.
 *
 * «Mettici anche termostato come scelta, manca.» La linguetta Termostato del
 * tablet c'era gia' — quella dei termostati col caldo e il freddo, come nella
 * sezione Clima — ma la zona scelta nel config passava solo se era Freddo o
 * Caldo: «termostato» tornava Freddo prima ancora di arrivare al tablet.
 * Queste prove tengono ferma la terza scelta, e le pagine di prima com'erano.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  ZONE_DEL_CLIMA,
  comandiDellaPagina,
  muroPulito,
  paginaPulita,
} from "../src/core/plancia-a-muro.js";

const editor = await readFile(
  new URL("../src/sections/plancia-a-muro-editor-section.js", import.meta.url),
  "utf8",
);

test("le zone su cui si apre una pagina Clima sono tre, nell'ordine del tablet", () => {
  assert.deepEqual([...ZONE_DEL_CLIMA], ["freddo", "caldo", "termostato"]);
});

test("una pagina Clima scelta sul Termostato resta sul Termostato", () => {
  assert.equal(paginaPulita({ modello: "clima", zona: "termostato" }).zona, "termostato");
  const muro = muroPulito({ pagine: [{ id: "p1", modello: "clima", zona: "termostato" }] });
  assert.equal(muro.pagine[0].zona, "termostato");
});

test("le pagine di prima si aprono dove si aprivano", () => {
  assert.equal(paginaPulita({ modello: "clima" }).zona, "freddo");
  assert.equal(paginaPulita({ modello: "clima", zona: "freddo" }).zona, "freddo");
  assert.equal(paginaPulita({ modello: "clima", zona: "caldo" }).zona, "caldo");
  assert.equal(paginaPulita({ modello: "clima", zona: "altro" }).zona, "freddo");
  /* Le pagine nate «freddo» e «caldo» diventano una pagina Clima che si apre
   * su quella linguetta, come prima. */
  assert.deepEqual(
    [paginaPulita({ modello: "caldo" }).modello, paginaPulita({ modello: "caldo" }).zona],
    ["clima", "caldo"],
  );
  assert.deepEqual(
    [paginaPulita({ modello: "freddo" }).modello, paginaPulita({ modello: "freddo" }).zona],
    ["clima", "freddo"],
  );
  /* «termostato» non e' mai stato il nome di una pagina: non diventa Clima. */
  assert.notEqual(paginaPulita({ modello: "termostato" }).modello, "clima");
});

test("la linguetta Termostato mostra i termostati col caldo e il freddo, e solo loro", () => {
  const fonte = {
    clima: [
      { entity: "climate.split", tipo: "clima" },
      { entity: "climate.valvola", tipo: "termo" },
      { entity: "climate.coppia", tipo: "termo" },
    ],
  };
  const aCoppia = (id) => id === "climate.coppia";
  const pagina = paginaPulita({ modello: "clima", zona: "termostato" });
  const ids = (zona) => comandiDellaPagina(pagina, fonte, zona, { aCoppia }).map((c) => c.entita);
  assert.deepEqual(ids(""), ["climate.coppia"]);
  assert.deepEqual(ids("termostato"), ["climate.coppia"]);
  assert.deepEqual(ids("caldo"), ["climate.valvola"]);
  assert.deepEqual(ids("freddo"), ["climate.split"]);
});

test("nel config «Si apre su» offre Freddo, Caldo e Termostato", () => {
  const blocco = editor.slice(editor.indexOf('t("Si apre su", "Opens on")'));
  const scelte = blocco.slice(0, blocco.indexOf("]),"));
  assert.match(scelte, /\["freddo", `❄️ \$\{t\("Freddo", "Cooling"\)\}`\]/);
  assert.match(scelte, /\["caldo", `🔥 \$\{t\("Caldo", "Heating"\)\}`\]/);
  assert.match(scelte, /\["termostato", `🌡️ \$\{t\("Termostato", "Thermostat"\)\}`\]/);
});
