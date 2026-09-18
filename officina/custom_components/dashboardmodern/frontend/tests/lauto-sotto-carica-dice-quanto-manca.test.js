/* «Al posto del tempo rimasto alla fine della ricarica mette i km» (#14).
 *
 * > La % di fine ricarica viene messa ma non viene calcolato il tempo
 * > rimanente ma viene messo i km al posto del tempo.
 *
 * La didascalia della tessera Auto era sempre l'autonomia. Ferma è la risposta
 * giusta — quanto ci faccio — ma a un'auto attaccata al cavo si guarda per
 * sapere quando si può staccare, e lì i chilometri sono un numero che non
 * risponde e per giunta si muove mentre carica.
 *
 * Il conto è quello della pagina EV e del popup, chiamato dallo stesso posto:
 * tre punti che dicono ore diverse per la stessa carica sono peggio di nessun
 * numero. E la capacità è quella della vettura, non settanta kilowattora per
 * tutte le auto del mondo.
 */
import assert from "node:assert/strict";
import test from "node:test";

const magazzino = new Map();
globalThis.localStorage = {
  getItem: (k) => (magazzino.has(k) ? magazzino.get(k) : null),
  setItem: (k, v) => magazzino.set(k, String(v)),
  removeItem: (k) => magazzino.delete(k),
};
globalThis.DashboardModernModules = {
  store: { getSection: (nome) => ({ rooms: [{ id: "r1", name: "Camera" }] })[nome] },
};

const { modelliDelleTessere } = await import("../src/sections/home-widgets-section.js");

const stato = (state, attributes = {}) => ({ state, attributes });

const MAPPA = {
  "dm.ev_batteria_auto": "sensor.leaf_soc",
  "dm.ev_autonomia": "sensor.leaf_autonomia",
  "dm.ev_stato_ricarica": "binary_sensor.wallbox_charging",
  "dm.ev_potenza_ricarica": "sensor.wallbox_potenza",
  "dm.ev_target_soc": "sensor.leaf_target",
};

/** La casa: batteria al 50%, traguardo 100, 300 km di autonomia, 7 kW. */
function casa({ carica = "50", ricarica = "on", potenza = "7" } = {}) {
  return {
    "sensor.leaf_soc": stato(carica, { unit_of_measurement: "%" }),
    "sensor.leaf_autonomia": stato("300", { unit_of_measurement: "km" }),
    "binary_sensor.wallbox_charging": stato(ricarica),
    "sensor.wallbox_potenza": stato(potenza, { unit_of_measurement: "kW" }),
    "sensor.leaf_target": stato("100", { unit_of_measurement: "%" }),
  };
}

function tesseraAuto(stati, vetture) {
  magazzino.clear();
  magazzino.set("cd_ev_cars", JSON.stringify(vetture));
  return (modelliDelleTessere(stati) || []).find((widget) => widget?.key === "ev") || null;
}

const LEAF = [{ key: "leaf", name: "Leaf", ov: MAPPA, kwh: "40" }];

test("sotto carica la didascalia dice quanto manca, non i chilometri", () => {
  /* Mezza batteria da 40 kWh a 7 kW: venti kilowattora, poco meno di tre ore. */
  const tessera = tesseraAuto(casa(), LEAF);
  assert.ok(tessera, "la tessera dell'auto c'è");
  assert.match(tessera.caption, /^2H \d+M /);
  assert.ok(!tessera.caption.includes("km"), `didascalia: ${tessera.caption}`);
});

test("la capacità è quella della vettura, non settanta per tutte", () => {
  /* La stessa carica su una batteria da 70 kWh dura quasi il doppio: se il
   * numero non cambiasse, vorrebbe dire che la capacità non la legge nessuno. */
  const piccola = tesseraAuto(casa(), LEAF);
  const grande = tesseraAuto(casa(), [{ ...LEAF[0], kwh: "70" }]);
  assert.notEqual(piccola.caption, grande.caption);
  assert.match(grande.caption, /^5H /);
});

test("ferma, la didascalia torna a essere l'autonomia", () => {
  /* È la risposta giusta a quella domanda: quanto ci faccio. */
  const tessera = tesseraAuto(casa({ ricarica: "off", potenza: "0" }), LEAF);
  assert.equal(tessera.caption, "300 km");
});

test("attaccata ma senza potenza non inventa un tempo", () => {
  /* Un numero calcolato su una carica che non passa sarebbe una promessa che
   * nessuno sta mantenendo: meglio i chilometri, che almeno sono veri. */
  const tessera = tesseraAuto(casa({ potenza: "0" }), LEAF);
  assert.equal(tessera.caption, "300 km");
});

test("a batteria piena non manca niente, e non si scrive «0H 0M»", () => {
  const tessera = tesseraAuto(casa({ carica: "100" }), LEAF);
  assert.equal(tessera.caption, "300 km");
});
