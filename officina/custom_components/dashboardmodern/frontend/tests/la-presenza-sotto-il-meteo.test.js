/* «Si potrebbe una pastiglia sotto al meteo?», chiesto dalla sezione Presenza
 * (#73).
 *
 * La tessera contava già in quante stanze c'è qualcuno; la fascia sotto il
 * meteo non aveva una voce per lei. Adesso ce l'ha, e sta dove va: fra le cose
 * che sono, non fra le cose che sono successe — è la stessa ragione per cui la
 * sua tessera non si accende mai, che qualcuno in casa non è un allarme.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { VOCI_DELLA_BARRA, pastiglieDellaCasa } from "../src/core/come-sta-la-casa.js";
import { contoDellaPresenza } from "../src/core/presenza-in-casa.js";

/* Il modello della tessera come lo fa `presenzaModel`: due stanze occupate su
 * quattro posti. */
const MODELLO = {
  key: "presenza",
  icon: "🏃",
  accent: "#2563eb",
  occupate: ["Cucina", "Studio"],
  rows: [
    { entity: "binary_sensor.cucina", name: "Cucina", on: true },
    { entity: "binary_sensor.studio", name: "Studio", on: true },
    { entity: "binary_sensor.salone", name: "Salone", on: false },
    { entity: "binary_sensor.camera", name: "Camera", on: false },
  ],
};

test("la fascia ha una voce per la presenza, fra gli stati e non fra le notizie", () => {
  const chiavi = VOCI_DELLA_BARRA.map((voce) => voce.chiave);
  assert.ok(chiavi.includes("presenza"));
  /* Dopo la musica, cioè in fondo agli stati della casa: qualcuno che è in
   * casa non è una notizia come l'antifurto che suona o la posta arrivata. */
  assert.ok(chiavi.indexOf("presenza") > chiavi.indexOf("media"));
  /* E prima delle misure, che sono letture e non stati. */
  assert.ok(chiavi.indexOf("presenza") < chiavi.indexOf("temperatura"));
  assert.equal(VOCI_DELLA_BARRA.find((voce) => voce.chiave === "presenza").tessera, "presenza");
});

test("la pastiglia conta i POSTI occupati, non i rilevatori", () => {
  const [pastiglia, ...altre] = pastiglieDellaCasa([MODELLO]);
  assert.deepEqual(altre, []);
  assert.equal(pastiglia.chiave, "presenza");
  assert.equal(pastiglia.conto, 2);
  assert.equal(pastiglia.tinta, "#2563eb");
  assert.equal(pastiglia.tessera, "presenza");
  /* Nessun elenco «tocca per spegnere»: una stanza non si spegne. Toccandola
   * si apre la tessera, che le stanze occupate le dice una per una. */
  assert.deepEqual(pastiglia.voci, []);

  /* Il raggruppamento lo ha già fatto la tessera, ed è il punto: una stanza con
   * tre rilevatori resta una stanza. Rifare quel conto qui vorrebbe dire due
   * regole su cosa è «un posto», che al primo caso strano divergono. */
  const conto = contoDellaPresenza([
    { entity: "binary_sensor.cucina_1", name: "Cucina", stanza: "Cucina", stato: "attivo" },
    { entity: "binary_sensor.cucina_2", name: "Cucina piano", stanza: "Cucina", stato: "attivo" },
    { entity: "binary_sensor.cucina_3", name: "Cucina porta", stanza: "Cucina", stato: "libero" },
  ]);
  assert.equal(conto.attivi, 1);
  const [una] = pastiglieDellaCasa([{ ...MODELLO, occupate: conto.nomi }]);
  assert.equal(una.conto, 1);
});

test("con la casa libera non c'è nessuna pastiglia", () => {
  /* Una voce che non ha niente da dire non si vede: è la regola di tutta la
   * fascia, e vale anche qui — «in 0 stanze c'è qualcuno» non è una notizia. */
  assert.deepEqual(pastiglieDellaCasa([{ ...MODELLO, occupate: [] }]), []);
  assert.deepEqual(pastiglieDellaCasa([{ ...MODELLO, occupate: undefined }]), []);
});
