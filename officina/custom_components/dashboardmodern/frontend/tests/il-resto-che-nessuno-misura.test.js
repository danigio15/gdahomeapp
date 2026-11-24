/* «Negli assorbimenti ci potrebbero essere dei carichi non monitorati. Sarebbe
 * carino avere un flusso automatico degli assorbimenti non configurati. Es.
 * qui mancano circa 40 watt.» Casa 120 W, Bagno 80 W, Spogliatoio 1 W, e
 * «Altro» a 0 W: il resto di Casa non lo diceva nessuno. Adesso ha un cerchio
 * suo, «Non monitorati», separato da «Altro». */
import assert from "node:assert/strict";
import test from "node:test";

import {
  CERCHIO_NON_MONITORATI,
  FLOW_MAX_LOADS,
  flowStageModel,
  residuoNonMisurato,
  valoreDellaCasa,
} from "../src/core/energy-flow-topology.js";
import { CERCHIO_ALTRO, cerchiDelleStanze } from "../src/core/i-cerchi-delle-stanze.js";
import { casaDalPacchetto } from "../src/sections/energy-flow-section.js";

const watt = (valore, unita = "W") => ({
  state: String(valore),
  attributes: { unit_of_measurement: unita },
});

/* La casa della segnalazione: due stanze con un apparecchio ciascuna e uno
 * senza stanza, fermo, che fa nascere il cerchio «Altro». */
function laCasaDiAndrea() {
  const { loads, appliances } = cerchiDelleStanze({
    rooms: [
      { id: "bagno", name: "Bagno" },
      { id: "spogliatoio", name: "Spogliatoio" },
    ],
    appliances: [
      {
        id: "scaldasalviette",
        name: "Scaldasalviette",
        room_id: "bagno",
        power_entity: "sensor.scalda_w",
      },
      { id: "luce", name: "Luce", room_id: "spogliatoio", power_entity: "sensor.luce_w" },
      { id: "frigo", name: "Frigo", power_entity: "sensor.frigo_w" },
    ],
  });
  return { loads, appliances };
}

const statiDiAndrea = (extra = {}) => ({
  "sensor.scalda_w": watt(80),
  "sensor.luce_w": watt(1),
  "sensor.frigo_w": watt(0),
  ...extra,
});

const nodo = (model, id) => model.nodes.find((voce) => voce.id === id);

test("Casa 120 W, Bagno 80 W e Spogliatoio 1 W: «Non monitorati» dice i 39 W che mancano", () => {
  const model = flowStageModel({
    ...laCasaDiAndrea(),
    states: statiDiAndrea(),
    casa: 120,
    nomeDelResiduo: "Non monitorati",
  });
  const resto = nodo(model, CERCHIO_NON_MONITORATI);
  assert.equal(model.count, 4);
  assert.equal(nodo(model, "stanza-bagno").value, 80);
  assert.equal(nodo(model, "stanza-spogliatoio").value, 1);
  /* «Altro» resta quello che era: gli apparecchi senza stanza, fermi. */
  assert.equal(nodo(model, CERCHIO_ALTRO).name, "Altro");
  assert.equal(nodo(model, CERCHIO_ALTRO).value, 0);
  assert.equal(nodo(model, CERCHIO_ALTRO).nonMisurato, undefined);
  assert.equal(resto.name, "Non monitorati");
  assert.equal(resto.value, 39);
  assert.equal(resto.nonMisurato, 39);
  assert.equal(resto.residuo, true);
  assert.equal(resto.text, "39 W");
  assert.equal(resto.active, true);
  assert.equal(resto.click, null);
  /* La linea e' proporzionata come le altre: piu' grossa di Spogliatoio,
   * piu' sottile di Bagno. */
  const larghezza = (id) => nodo(model, id).intensity.width;
  assert.ok(larghezza(CERCHIO_NON_MONITORATI) > larghezza("stanza-spogliatoio"));
  assert.ok(larghezza(CERCHIO_NON_MONITORATI) < larghezza("stanza-bagno"));
  /* Al suo posto nella fila, non sopra un altro cerchio. */
  const posti = new Set(model.nodes.map((voce) => voce.desktop.left));
  assert.equal(posti.size, 4);
});

test("senza Casa non si inventa niente: nessun cerchio «Non monitorati»", () => {
  const model = flowStageModel({ ...laCasaDiAndrea(), states: statiDiAndrea() });
  assert.equal(model.count, 3);
  assert.equal(nodo(model, CERCHIO_NON_MONITORATI), undefined);
});

test("un sensore che non risponde: niente resto, non si inventa", () => {
  const model = flowStageModel({
    ...laCasaDiAndrea(),
    states: statiDiAndrea({ "sensor.scalda_w": { state: "unavailable" } }),
    casa: 120,
  });
  assert.equal(nodo(model, CERCHIO_NON_MONITORATI), undefined);
});

test("ma chi tace da tanto non tiene nascosto il resto della casa", () => {
  /* «Sono scomparsi i consumi non monitorati?»: Casa 2,30 kW, i cerchi che
   * rispondono ne sommano 2,035, e la wallbox dice «—» da ore. */
  const loads = [
    { id: "cucina", name: "Cucina", power_entity: "sensor.cucina_w" },
    { id: "cucinino", name: "Cucinino", power_entity: "sensor.cucinino_w" },
    { id: "wallbox", name: "Wallbox", power_entity: "sensor.wallbox_w" },
  ];
  const states = {
    "sensor.cucina_w": watt(85),
    "sensor.cucinino_w": watt(1950),
    "sensor.wallbox_w": { state: "unavailable" },
  };
  const subito = flowStageModel({ loads, states, casa: 2300 });
  assert.equal(nodo(subito, CERCHIO_NON_MONITORATI), undefined, "appena tace si aspetta");
  assert.equal(nodo(subito, "wallbox").value, null);

  const dopo = flowStageModel({ loads, states, casa: 2300, mutiDaTanto: new Set(["wallbox"]) });
  const resto = nodo(dopo, CERCHIO_NON_MONITORATI);
  assert.ok(resto, "dopo un po' il cerchio torna");
  assert.equal(resto.value, 265);
  assert.equal(nodo(dopo, "wallbox").value, null, "la wallbox resta col trattino");

  /* Un altro cerchio che tace da poco fa ancora aspettare. */
  const due = flowStageModel({
    loads,
    states: { ...states, "sensor.cucina_w": { state: "unavailable" } },
    casa: 2300,
    mutiDaTanto: new Set(["wallbox"]),
  });
  assert.equal(nodo(due, CERCHIO_NON_MONITORATI), undefined);
});

test("Casa in kW e carichi in W si confrontano nella stessa unita'", () => {
  const model = flowStageModel({
    ...laCasaDiAndrea(),
    states: statiDiAndrea({ "sensor.scalda_w": watt(0.08, "kW") }),
    casa: watt(0.12, "kW"),
  });
  assert.equal(nodo(model, "stanza-bagno").value, 80);
  assert.equal(nodo(model, CERCHIO_NON_MONITORATI).value, 39);
  assert.equal(valoreDellaCasa(watt(1.5, "kW")), 1500);
  assert.equal(valoreDellaCasa(watt(0.12, "kW")), 120);
  assert.equal(valoreDellaCasa({ state: "unavailable" }), null);
  assert.equal(
    valoreDellaCasa({ state: "4500", attributes: { unit_of_measurement: "Wh" } }, "day"),
    4.5,
  );
});

test("se i carichi sommano piu' di Casa il resto e' zero, mai negativo", () => {
  /* Nessun cerchio nuovo per uno zero... */
  const prima = flowStageModel({ ...laCasaDiAndrea(), states: statiDiAndrea(), casa: 70 });
  assert.equal(nodo(prima, CERCHIO_NON_MONITORATI), undefined);
  /* ...ma quello che c'era gia' resta, a 0 W, senza far ballare il disegno. */
  const model = flowStageModel({
    ...laCasaDiAndrea(),
    states: statiDiAndrea(),
    casa: 70,
    tieniIlResiduo: true,
  });
  const resto = nodo(model, CERCHIO_NON_MONITORATI);
  assert.equal(resto.value, 0);
  assert.equal(resto.text, "0 W");
  assert.equal(resto.active, false);
  assert.equal(residuoNonMisurato(70, [80, 1]), 0);
});

test("il rumore non si mostra: sotto 5 W o sotto il 3% di Casa vale zero", () => {
  assert.equal(residuoNonMisurato(85, [80, 1]), 0); // 4 W
  assert.equal(residuoNonMisurato(3000, [2950]), 0); // 50 W ma l'1,7%
  assert.equal(residuoNonMisurato(3000, [2800]), 200);
  assert.equal(residuoNonMisurato(86, [80, 1]), 5);
  assert.equal(residuoNonMisurato(null, [80]), null);
  assert.equal(residuoNonMisurato(-10, [80]), null);
  /* Nel Giorno e nel Mese la soglia e' in kWh. */
  assert.equal(residuoNonMisurato(10, [9.98], "day"), 0);
  assert.equal(residuoNonMisurato(10, [8.5], "day"), 1.5);
  /* Col rumore il cerchio non nasce; se c'era, resta a zero. */
  const nuovo = flowStageModel({ ...laCasaDiAndrea(), states: statiDiAndrea(), casa: 84 });
  assert.equal(nodo(nuovo, CERCHIO_NON_MONITORATI), undefined);
  const model = flowStageModel({
    ...laCasaDiAndrea(),
    states: statiDiAndrea(),
    casa: 84,
    tieniIlResiduo: true,
  });
  assert.equal(nodo(model, CERCHIO_NON_MONITORATI).value, 0);
});

test("carichi scritti a mano, sensori in W e kW: il resto ha il suo cerchio", () => {
  const loads = [
    { id: "boiler", name: "Boiler", power_entity: "sensor.boiler_w", order: 0 },
    { id: "clima", name: "Clima", power_entity: "sensor.clima_kw", order: 1 },
  ];
  const states = { "sensor.boiler_w": watt(1200), "sensor.clima_kw": watt(0.6, "kW") };
  const model = flowStageModel({
    loads,
    states,
    casa: watt(2.1, "kW"),
    nomeDelResiduo: "Unmonitored",
  });
  const resto = nodo(model, CERCHIO_NON_MONITORATI);
  assert.equal(model.count, 3);
  assert.equal(resto.name, "Unmonitored");
  assert.equal(resto.value, 300);
  assert.equal(resto.sensore, true);
  assert.notEqual(resto.desktop.left, nodo(model, "clima").desktop.left);

  /* Senza carichi non c'e' niente da confrontare. */
  assert.equal(flowStageModel({ loads: [], states, casa: 500 }).count, 0);
  /* Palco pieno: nessun nono cerchio. */
  const otto = Array.from({ length: FLOW_MAX_LOADS }, (_, i) => ({
    id: `c${i}`,
    name: `C${i}`,
    power_entity: `sensor.c${i}`,
    order: i,
  }));
  assert.equal(flowStageModel({ loads: otto, states: {}, casa: 500 }).count, FLOW_MAX_LOADS);
});

test("un «Altro» configurato a mano resta suo, e il resto e' un cerchio separato", () => {
  const loads = [
    { id: "boiler", name: "Boiler", power_entity: "sensor.boiler_w", order: 0 },
    { id: "mio-altro", name: "Altro", power_entity: "sensor.altro_w", order: 1 },
  ];
  const states = { "sensor.boiler_w": watt(1000), "sensor.altro_w": watt(150) };
  const model = flowStageModel({ loads, states, casa: 1500 });
  assert.equal(model.count, 3);
  assert.equal(nodo(model, "mio-altro").name, "Altro");
  assert.equal(nodo(model, "mio-altro").value, 150);
  assert.equal(nodo(model, "mio-altro").nonMisurato, undefined);
  /* 1500 − 1000 − 150: il suo numero si sottrae come quello degli altri. */
  assert.equal(nodo(model, CERCHIO_NON_MONITORATI).value, 350);

  /* Un «Altro» a mano senza sensore non si riempie: dice «—», e il resto va
   * nel cerchio dei non monitorati. */
  const senza = flowStageModel({
    loads: [loads[0], { id: "mio-altro", name: "Altro", order: 1 }],
    states,
    casa: 1250,
  });
  assert.equal(nodo(senza, "mio-altro").value, null);
  assert.equal(nodo(senza, CERCHIO_NON_MONITORATI).value, 250);
});

test("Giorno e Mese: lo stesso conto in kWh, e niente resto mentre un numero e' in viaggio", () => {
  const loads = [
    { id: "boiler", name: "Boiler", daily_energy_entity: "sensor.boiler_oggi", order: 0 },
    { id: "clima", name: "Clima", daily_energy_entity: "sensor.clima_oggi", order: 1 },
  ];
  const states = {
    "sensor.boiler_oggi": { state: "3.2", attributes: { unit_of_measurement: "kWh" } },
    "sensor.clima_oggi": { state: "1500", attributes: { unit_of_measurement: "Wh" } },
  };
  const day = flowStageModel({ loads, states, period: "day", casa: 6.1 });
  assert.equal(nodo(day, CERCHIO_NON_MONITORATI).value, 1.4);
  assert.match(nodo(day, CERCHIO_NON_MONITORATI).text, /1,4\d* kWh/);

  const inViaggio = flowStageModel({
    loads: [
      ...loads,
      { id: "forno", name: "Forno", daily_energy_entity: "sensor.forno_oggi", order: 2 },
    ],
    states,
    period: "day",
    casa: 6.1,
    inAttesa: new Set(["forno"]),
  });
  assert.equal(nodo(inViaggio, CERCHIO_NON_MONITORATI), undefined);
});

test("Giorno e Mese: Casa e' il numero del pacchetto dell'Energia, se quel periodo e' letto", () => {
  const bundle = {
    day: { house: 6.1 },
    month: { house: 182.4 },
    letti: { day: true, month: false },
  };
  assert.equal(casaDalPacchetto(bundle, "day"), 6.1);
  assert.equal(casaDalPacchetto(bundle, "month"), null);
  assert.equal(casaDalPacchetto({ day: { house: 2 } }, "day"), 2);
  assert.equal(casaDalPacchetto(null, "day"), null);
  assert.equal(casaDalPacchetto(bundle, "instant"), null);
});
