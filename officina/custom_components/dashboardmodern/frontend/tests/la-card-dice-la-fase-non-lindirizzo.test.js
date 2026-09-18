/* «La lavastoviglie è in funzione ma la card indica spenta» (#27), «gli
 * elettrodomestici Samsung non mostrano nessun dato» (#20) — il secondo giro.
 *
 * Lo stato si leggeva già: `letturaDelloStato` sa che
 * `BSH.Common.EnumType.OperationState.Run` finisce con «Run». Ma la stessa
 * regola serviva in un altro posto e là non c'era, e il difetto restava mezzo
 * risolto: la card diceva IN FUNZIONE e sotto, al posto della fase, l'indirizzo
 * del protocollo di Bosch. Il programma pure: «Eco 50» si leggeva
 * «Dishcare.Dishwasher.Program.Eco50».
 *
 * E su SmartThings mancava una parola sola: la fase, là, si chiama `job_state`
 * — `machine_state` dice soltanto «run». Cercando «fase» o «phase» nel nome,
 * quel sensore non si trovava, e la card ripeteva lo stato macchina al posto
 * della fase, che è l'unica cosa che uno guarda sull'oblò.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  faseInParole,
  inParole,
  programFacts,
  ultimoPezzo,
} from "../src/core/appliance-program.js";
import { createApplianceViewModel, letturaDelloStato } from "../src/core/appliance-view-model.js";

/* La lavastoviglie Bosch di #27, con le entità che Home Connect crea davvero. */
const BOSCH = Object.freeze({
  id: "lavastoviglie",
  name: "Lavastoviglie",
  entities: Object.freeze([
    "sensor.dishwasher_operation_state",
    "sensor.dishwasher_program_progress",
    "sensor.dishwasher_selected_program",
    "switch.dishwasher_power",
  ]),
});

const statiBosch = (stato = "BSH.Common.EnumType.OperationState.Run") => ({
  "sensor.dishwasher_operation_state": {
    state: stato,
    attributes: { friendly_name: "Lavastoviglie Operation state" },
  },
  "sensor.dishwasher_program_progress": {
    state: "42",
    attributes: { unit_of_measurement: "%", friendly_name: "Lavastoviglie Program progress" },
  },
  "sensor.dishwasher_selected_program": {
    state: "Dishcare.Dishwasher.Program.Eco50",
    attributes: { friendly_name: "Lavastoviglie Selected program" },
  },
  "switch.dishwasher_power": { state: "on", attributes: {} },
});

/* La lavatrice Samsung di #20, come la nomina SmartThings. */
const SAMSUNG = Object.freeze({
  id: "lavatrice",
  name: "Lavatrice",
  entities: Object.freeze([
    "sensor.washer_machine_state",
    "sensor.washer_job_state",
    "sensor.washer_washer_cycle",
    "switch.washer",
  ]),
});

const statiSamsung = (macchina = "run", fase = "rinse") => ({
  "sensor.washer_machine_state": {
    state: macchina,
    attributes: { friendly_name: "Lavatrice Machine state" },
  },
  "sensor.washer_job_state": { state: fase, attributes: { friendly_name: "Lavatrice Job state" } },
  "sensor.washer_washer_cycle": {
    state: "Cotone",
    attributes: { friendly_name: "Lavatrice Washer cycle" },
  },
  "switch.washer": { state: macchina === "stop" ? "off" : "on", attributes: {} },
});

const fatti = (device, states) => {
  const modello = createApplianceViewModel(device, states, [], "it");
  return {
    modello,
    ...programFacts({ ...device, state_entity: modello.stateEntity }, states, {
      locale: "it",
      mode: modello.modo || modello.mode,
    }),
  };
};

test("la lavastoviglie Bosch: in funzione, e la fase in italiano", () => {
  const { modello, phase, chips } = fatti(BOSCH, statiBosch());
  assert.equal(modello.mode, "running");
  assert.equal(modello.label, "IN FUNZIONE");
  assert.equal(modello.stateEntity, "sensor.dishwasher_operation_state");
  /* La cosa che si vedeva prima: l'indirizzo del protocollo, a schermo. */
  assert.ok(phase, "la fase non c'è");
  assert.equal(phase.label, "In funzione");
  assert.ok(!phase.label.includes("BSH."), "sulla card c'è ancora l'indirizzo di Bosch");
  const programma = chips.find((voce) => voce.key === "programma");
  assert.equal(programma?.label, "Eco50");
  assert.ok(!programma?.label.includes("Dishcare."), "il programma è ancora un indirizzo");
});

test("a lavastoviglie ferma non dice che sta lavorando", () => {
  const { modello } = fatti(BOSCH, statiBosch("BSH.Common.EnumType.OperationState.Ready"));
  assert.equal(modello.mode, "off");
  const finita = fatti(BOSCH, statiBosch("BSH.Common.EnumType.OperationState.Finished"));
  assert.equal(finita.modello.mode, "off");
  /* In pausa non è spenta: il piatto è ancora dentro. */
  const pausa = fatti(BOSCH, statiBosch("BSH.Common.EnumType.OperationState.Pause"));
  assert.equal(pausa.modello.mode, "standby");
});

test("la lavatrice Samsung: la fase è il «job», non lo stato macchina", () => {
  const { modello, phase, chips } = fatti(SAMSUNG, statiSamsung());
  assert.equal(modello.mode, "running");
  assert.equal(modello.label, "IN FUNZIONE");
  /* Prima usciva «In funzione», che è lo stato macchina ripetuto: la fase
   * vera — il risciacquo — stava in un sensore che non si guardava. */
  assert.equal(phase?.label, "Risciacquo");
  assert.equal(phase?.entity, "sensor.washer_job_state");
  assert.equal(chips.find((voce) => voce.key === "programma")?.label, "Cotone");
  /* Anche quando SmartThings scrive la fase per esteso. */
  const lunga = fatti(SAMSUNG, statiSamsung("run", "samsungce.washerOperatingState.spin"));
  assert.equal(lunga.phase?.label, "Centrifuga");
});

test("a lavatrice ferma la card dice spento", () => {
  const { modello } = fatti(SAMSUNG, statiSamsung("stop", "none"));
  assert.equal(modello.mode, "off");
  assert.equal(modello.label, "SPENTO");
});

test("un indirizzo è un indirizzo, il resto no", () => {
  assert.equal(ultimoPezzo("BSH.Common.EnumType.OperationState.Run"), "Run");
  assert.equal(ultimoPezzo("samsungce.washerOperatingState.wash"), "wash");
  /* Due punti almeno: un numero con la virgola decimale non è un indirizzo, e
   * «1.5» non deve diventare «5». */
  assert.equal(ultimoPezzo("1.5"), "");
  assert.equal(ultimoPezzo("sensor.lavatrice"), "");
  /* Niente spazi: «All in One 59'» è scritto da persone. */
  assert.equal(ultimoPezzo("All in One 59'"), "");
  assert.equal(ultimoPezzo("qualcosa."), "");
  assert.equal(ultimoPezzo(""), "");
});

test("le parole di prima valgono ancora", () => {
  /* La regola sta in un posto solo, ed è quella che legge anche lo stato. */
  assert.equal(letturaDelloStato("BSH.Common.EnumType.OperationState.Run"), "running");
  assert.equal(letturaDelloStato("main.machineState.stop"), "off");
  assert.equal(letturaDelloStato("running"), "running");
  assert.equal(inParole("All in One 59'"), "All in One 59'");
  assert.equal(inParole("iot_wash_cotton"), "Cotton");
  assert.equal(faseInParole("spin")?.label, "Centrifuga");
  assert.equal(faseInParole("none"), null);
});
