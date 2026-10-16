/* «Non si vede mappa»: la cartina del pianificatore prendeva le tessere da
 * `tile.openstreetmap.org`, e il server dei volontari di OpenStreetMap le
 * restituiva stampate «403 — Access blocked. App is not following the tile
 * usage policy». Era gia' successo al radar, che per questo era passato al
 * fondo di Esri: qui si tiene ferma la regola per tutta la plancia, cosi' la
 * prossima mappa non ci ricasca. */
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const SRC = fileURLToPath(new URL("../src/", import.meta.url));

async function tuttiIFile(cartella) {
  const fuori = [];
  for (const voce of await readdir(cartella, { withFileTypes: true })) {
    const dove = join(cartella, voce.name);
    if (voce.isDirectory()) fuori.push(...(await tuttiIFile(dove)));
    else if (voce.name.endsWith(".js")) fuori.push(dove);
  }
  return fuori;
}

test("nessuna parte della plancia chiede tessere al server dei volontari di OpenStreetMap", async () => {
  const colpevoli = [];
  for (const file of await tuttiIFile(SRC)) {
    const testo = await readFile(file, "utf8");
    if (/https?:\/\/[a-z.]*tile\.(?:openstreetmap|osm)\.org/i.test(testo)) colpevoli.push(file);
  }
  assert.deepEqual(colpevoli, []);
});

test("la cartina del pianificatore usa il fondo del radar, e ne scrive il nome", async () => {
  const sezione = await readFile(join(SRC, "sections/gdanav-section.js"), "utf8");
  assert.match(sezione, /import \{ FONDI_MAPPA \} from "\.\.\/core\/radar-mappa\.js";/);
  assert.match(sezione, /const FONDO = FONDI_MAPPA\.esri;/);
  assert.match(sezione, /© \$\{esc\(FONDO\.attribuzione\)\}/);
});
