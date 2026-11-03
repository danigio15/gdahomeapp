/* Le tessere che si nascondono quando e' tutto spento (#355).
 *
 * «Quando nessun elettrodomestico e' in moto il widget non si vede,
 * recuperando spazio.» L'opzione e' per tessera, spenta di serie. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  TESSERE_A_SCOMPARSA,
  qualcosaAcceso,
  soloAcceseValide,
  tesseraDaMostrare,
} from "../src/core/tessere-a-scomparsa.js";

const leggi = (percorso) => readFile(new URL(percorso, import.meta.url), "utf8");

test("le tessere che sanno nascondersi sono luci, prese ed elettrodomestici", () => {
  assert.deepEqual([...TESSERE_A_SCOMPARSA], ["luci", "prese", "elettrodomestici"]);
  /* La lista salvata si ripulisce: niente doppioni, niente tessere che non
   * sanno dire «e' tutto spento», niente rifiuti. */
  assert.deepEqual(soloAcceseValide(["luci", "luci", "meteo", "", null, " prese "]), [
    "luci",
    "prese",
  ]);
  assert.deepEqual(soloAcceseValide(undefined), []);
});

test("spenta di serie: la tessera si vede anche con tutto spento", () => {
  const luci = { key: "luci", on: [] };
  assert.equal(tesseraDaMostrare(luci, []), true);
  assert.equal(tesseraDaMostrare(luci), true);
});

test("accesa: con tutto spento sparisce, con qualcosa acceso torna", () => {
  const solo = ["luci", "prese", "elettrodomestici"];
  assert.equal(tesseraDaMostrare({ key: "luci", on: [] }, solo), false);
  assert.equal(tesseraDaMostrare({ key: "luci", on: [{ entity: "light.a" }] }, solo), true);
  assert.equal(tesseraDaMostrare({ key: "prese", on: [] }, solo), false);
  assert.equal(tesseraDaMostrare({ key: "prese", on: [{ entity: "switch.a" }] }, solo), true);
  /* Gli elettrodomestici contano quelli in funzione, non quelli fermi. */
  assert.equal(
    tesseraDaMostrare({ key: "elettrodomestici", running: [], rows: [{}] }, solo),
    false,
  );
  assert.equal(tesseraDaMostrare({ key: "elettrodomestici", running: [{}] }, solo), true);
  /* Le altre tessere non c'entrano. */
  assert.equal(tesseraDaMostrare({ key: "meteo" }, solo), true);
});

test("nel dubbio la tessera si mostra", () => {
  assert.equal(qualcosaAcceso(null), true);
  assert.equal(qualcosaAcceso({ key: "luci" }), true);
  assert.equal(qualcosaAcceso({ key: "elettrodomestici" }), true);
});

test("la Home e il Config usano la scelta", async () => {
  const home = await leggi("../src/sections/home-widgets-section.js");
  assert.match(home, /soloAccese = soloAcceseValide\(stored\?\.soloAccese\)/);
  assert.match(home, /\.filter\(\(widget\) => tesseraDaMostrare\(widget, soloAccese\)\)/);
  const editor = await leggi("../src/sections/todo-editor-section.js");
  assert.match(editor, /data-widget-solo-acceso/);
  assert.match(editor, /scriviPreferenze\(\{ soloAccese: \[\.\.\.scelte\] \}\)/);
});
