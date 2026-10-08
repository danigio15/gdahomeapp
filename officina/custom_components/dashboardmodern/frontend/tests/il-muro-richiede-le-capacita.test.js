/* «Ora le telecamere se vado nel dettaglio si vedono regolarmente, ma nella
 * sezione Sicurezza dove c'è l'anteprima non si visualizzano» (#164).
 *
 * Una Ring `…_live_view` un'istantanea non la dà: il muro deve provare il
 * video, e per sceglierlo — WebRTC, non HLS — servono le capacità che Home
 * Assistant dichiara. Se la domanda dell'avvio cadeva, perché il filo non era
 * ancora pronto, nessuno la rifaceva: il muro indovinava l'HLS, che una Ring
 * non ha, e restava su «In attesa del fotogramma». Il dettaglio invece le
 * richiede sempre, ed è per questo che lì si vedeva.
 *
 * Adesso il giro del muro le richiede, con la pausa di mezzo minuto che tiene
 * `chiediLeCapacita`. Le tessere da sole continuano a non chiederne.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const muro = readFileSync(new URL("../src/sections/live-ui-section.js", import.meta.url), "utf8");

test("il giro del muro richiede le capacità prima di chiedere i fotogrammi", () => {
  assert.match(
    muro,
    /import \{ chiediLeCapacitaDiTutte \} from "\.\/telecamera-capacita-section\.js";/,
  );
  const giro = muro.indexOf("chiediLeCapacitaDiTutte();");
  const fotogrammi = muro.indexOf("await Promise.all(cameras.map(loadCameraImage));");
  assert.ok(giro > 0 && fotogrammi > giro, "le capacità prima dei fotogrammi");
});
