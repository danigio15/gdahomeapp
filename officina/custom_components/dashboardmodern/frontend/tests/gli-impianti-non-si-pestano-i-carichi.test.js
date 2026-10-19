/* Due impianti, e i carichi dell'uno che non cancellano quelli dell'altro
 * (#292, dal campo); le tessere Energia che si comportano tutte da tessere
 * (#286, dal campo).
 *
 *   «Configurando un carico su uno dei due impianti dopo il salvataggio
 *    cancella quelli sull'altro.» «Passando da un impianto all'altro in
 *    configurazione non aggiorna i carichi.» «Solo il primo widget segue
 *    l'ordinamento, l'altro resta in coda; il secondo non ha il tasto per
 *    andare nella sezione; il tasto del primo apre l'impianto che era attivo.»
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const magazzino = new Map();
globalThis.localStorage = {
  getItem: (k) => (magazzino.has(k) ? magazzino.get(k) : null),
  setItem: (k, v) => magazzino.set(k, String(v)),
  removeItem: (k) => magazzino.delete(k),
};
globalThis.document = undefined;

const { loadsConfigToSections } = await import("../src/core/energy-loads-config.js");
const { applyWidgetPreferences } = await import("../src/sections/home-widgets-section.js");

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const leggi = (relativo) => readFileSync(join(SRC, relativo), "utf8");

const primo = {
  id: "carico-1",
  plant: "",
  name: "Cucina Casa A",
  power_entity: "sensor.cucina_g",
  control_entity: "switch.cucina_g",
  metadata: { flow_group: "carico-1" },
};

test("salvare i carichi del secondo impianto non tocca quelli del primo, anche con gli stessi id", () => {
  const modelloDonato = [{ id: "carico-1", name: "Cucina Casa B", power: "sensor.cucina_d", children: [] }];
  const { loads } = loadsConfigToSections(modelloDonato, [primo], "casa_b");
  const casa_a = loads.find((load) => load.name === "Cucina Casa A");
  const casa_b = loads.find((load) => load.name === "Cucina Casa B");
  assert.ok(casa_a, "il carico dell'altro impianto sopravvive");
  assert.equal(casa_a.id, "carico-1");
  assert.equal(casa_a.plant, "");
  assert.ok(casa_b);
  assert.equal(casa_b.plant, "casa_b");
  /* L'id che l'altro impianto usa gia' si rinomina, cosi' nessuna riga ne
   * copre un'altra. */
  assert.equal(casa_b.id, "casa_b-carico-1");
  assert.equal(casa_b.metadata.flow_group, "casa_b-carico-1");
  /* E i campi tenuti non si prendono dall'impianto sbagliato. */
  assert.equal(casa_b.control_entity ?? "", "");
  assert.equal(casa_b.power_entity, "sensor.cucina_d");
});

test("salvare il primo impianto lascia al suo posto tutto quello del secondo", () => {
  const casa_b = { id: "casa_b-carico-1", plant: "casa_b", name: "Cucina Casa B", power_entity: "sensor.cucina_d" };
  const figlio = { id: "lavatrice-d", plant: "casa_b", name: "Lavatrice", metadata: { beta27_subload_group: "casa_b-carico-1" } };
  const modelloGiovanni = [{ id: "carico-1", name: "Cucina Casa A", power: "sensor.cucina_g", children: [] }];
  const { loads } = loadsConfigToSections(modelloGiovanni, [primo, casa_b, figlio], "");
  assert.deepEqual(
    loads.map((load) => [load.id, load.plant]).sort(),
    [
      ["carico-1", ""],
      ["casa_b-carico-1", "casa_b"],
      ["lavatrice-d", "casa_b"],
    ],
  );
  /* Con un impianto solo — nessun impianto passato — tutto come sempre. */
  const solo = loadsConfigToSections(modelloGiovanni, [primo], null);
  assert.deepEqual(solo.loads.map((load) => load.id), ["carico-1"]);
});

test("la scheda Carichi si rilegge quando si cambia impianto", () => {
  const editor = leggi("sections/energy-loads-editor-section.js");
  /* Il modello in mano si mette da parte se sporco, altrimenti si butta, e la
   * scheda si ridisegna con quello dell'impianto nuovo (o con la sua bozza). */
  assert.match(
    editor,
    /addEventListener\?\.\("dashboardmodern:energy-plant-changed", \(\) => \{[\s\S]*?state\.model = bozza;\s*state\.dirty = Boolean\(bozza\);\s*state\.impianto = adesso;\s*scheduleRender\(\);/,
  );
});

test("tutte le tessere energia seguono l'ordine di «Energia», e ognuna porta alla sua sezione", () => {
  magazzino.set("cd_widgets", JSON.stringify({ order: ["luci", "energia", "clima"] }));
  const ordinate = applyWidgetPreferences([
    { key: "clima" },
    { key: "energia_casa_b" },
    { key: "energia" },
    { key: "luci" },
  ]);
  assert.deepEqual(
    ordinate.map((w) => w.key),
    ["luci", "energia_casa_b", "energia", "clima"],
  );
  magazzino.delete("cd_widgets");
  const home = leggi("sections/home-widgets-section.js");
  /* La riduzione «una tessera energia e' pur sempre l'Energia» si fa in un
   * posto solo: ordinare, disegnare le caselle, aprire la pagina e scegliere
   * il disegno della pastiglia sono quattro domande diverse con la stessa
   * risposta, e quando erano scritte a parte la quarta se l'e' persa — la
   * seconda zona restava senza icona. */
  assert.match(home, /const famigliaDellaTessera = \(chiave\) =>\n\s*eUnaTesseraEnergia\(chiave\) \? "energia" : clean\(chiave\);/);
  assert.match(home, /SEZIONE_DEL_WIDGET\[famigliaDellaTessera\(grezza\)\]/);
  assert.equal((home.match(/\? "energia"/g) || []).length, 1, "la riduzione e' scritta due volte");
  assert.match(home, /impianto: clean\(impianto\?\.id\) \|\| PRIMO_IMPIANTO,/);
  assert.match(home, /data-dm-w-impianto="\$\{esc\(widget\.impianto\)\}"/);
  assert.match(home, /new CustomEvent\("dashboardmodern:energy-plant-requested", \{ detail: \{ plant: impianto \} \}\)/);
  const impianti = leggi("sections/energy-plants-section.js");
  assert.match(impianti, /addEventListener\?\.\("dashboardmodern:energy-plant-requested"/);
  assert.match(impianti, /ascoltaLaHome\(\);/);
});

test("il modello di un impianto non prende i figli dell'altro, nemmeno con lo stesso id di cerchio (revisione)", async () => {
  /* Due maschere numerano i cerchi allo stesso modo, e prima della 1.4.7 gli
   * id potevano coincidere. I figli del «carico-1» dell'altro impianto
   * finivano nel modello di questo, e al salvataggio ci venivano scritti una
   * seconda volta, rinominati: un doppione per ogni elettrodomestico. */
  const { loadsConfigModel } = await import("../src/core/energy-loads-config.js");
  const { PRIMO_IMPIANTO } = await import("../src/core/energy-plants.js");
  const loads = [
    { ...primo },
    {
      id: "lav-casa_a",
      plant: "",
      name: "Lavatrice Casa A",
      power_entity: "sensor.lav_g",
      metadata: { beta27_subload_group: "carico-1" },
    },
    {
      id: "carico-1",
      plant: "casa_b",
      name: "Cucina Casa B",
      power_entity: "sensor.cucina_d",
      control_entity: "switch.cucina_d",
      metadata: { flow_group: "carico-1" },
    },
    {
      id: "lav-casa_b",
      plant: "casa_b",
      name: "Lavatrice Casa B",
      power_entity: "sensor.lav_d",
      metadata: { beta27_subload_group: "carico-1" },
    },
  ];
  const casa_b = loadsConfigModel({ loads, plant: { id: "casa_b" }, plantIndex: 1 });
  assert.deepEqual(casa_b.map((load) => load.name), ["Cucina Casa B"]);
  assert.deepEqual(casa_b[0].children.map((child) => child.id), ["lav-casa_b"]);
  const casa_a = loadsConfigModel({ loads, plant: { id: PRIMO_IMPIANTO }, plantIndex: 0 });
  assert.deepEqual(casa_a.map((load) => load.name), ["Cucina Casa A"]);
  assert.deepEqual(casa_a[0].children.map((child) => child.id), ["lav-casa_a"]);
  /* E il codice lo dice: i figli si cercano fra i carichi di QUESTO impianto. */
  const core = leggi("core/energy-loads-config.js");
  assert.match(core, /const canonical = suoi\.filter\(subloadOf\(group\)\)/);
});

test("cambiando impianto le modifiche non salvate si mettono da parte, e tornando si ritrovano (revisione)", () => {
  const editor = leggi("sections/energy-loads-editor-section.js");
  const ascolto = editor.slice(editor.indexOf('"dashboardmodern:energy-plant-changed"'));
  assert.match(ascolto, /state\.bozze \|\|= new Map\(\);/);
  assert.match(ascolto, /if \(state\.dirty && state\.model && state\.impianto !== undefined\)\s*state\.bozze\.set\(state\.impianto, state\.model\);/);
  assert.match(ascolto, /const bozza = state\.bozze\.get\(adesso\) \|\| null;/);
  assert.match(ascolto, /state\.dirty = Boolean\(bozza\);/);
  /* Il modello sa di quale impianto e', e il salvataggio butta la sua bozza. */
  assert.match(editor, /state\.model = readModel\(\);\s*state\.impianto = chiaveImpianto\(\);/);
  assert.match(editor, /state\.bozze\?\.delete\?\.\(chiaveImpianto\(\)\);/);
});
