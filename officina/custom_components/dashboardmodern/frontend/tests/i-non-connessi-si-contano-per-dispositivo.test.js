/* «Non devi mettere le entità ma i dispositivi non connessi, così come li
 * mostri nel cruscotto installatore.»
 *
 * Dal campo, con lo scatto della scheda: dentro c'erano «Asciugatrice Child
 * lock», «Boiler Child lock», «Condizionatori Child lock», «Lavastoviglie
 * Child lock» — cioè quattro elettrodomestici che rispondono benissimo, di
 * ognuno dei quali tace una sola entità. Quella serratura bambini
 * l'integrazione la pubblica sempre ed è `unavailable` quando la macchina non
 * sta lavorando: non è un dispositivo non connesso, è una entità che quando la
 * macchina è ferma non ha niente da dire.
 *
 * Quindi l'avviso diceva il vero su cose che non interessano, che è il modo
 * esatto in cui un avviso si impara a ignorare — e un avviso che si ignora è
 * peggio di nessun avviso. Nel cruscotto dell'installatore quei `child_lock`
 * non compaiono, perché il ponte la regola giusta ce l'ha da sempre
 * (`ponte/src/salute.js`): si raggruppa per dispositivo, e un dispositivo è giù
 * **solo se tacciono tutte le sue entità**.
 *
 * Qui si difende che la plancia faccia la stessa e non una somigliante: due
 * regole per la stessa domanda sono due verità, e il giorno che si scostano
 * nessuno sa quale guardare.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { chiNonRisponde, chiNonRispondePerDispositivo } from "../src/core/chi-non-risponde.js";
import {
  dispositiviDaiRegistri,
  dispositiviDalGuscio,
  nonSiSaNiente,
} from "../src/core/i-dispositivi-di-home-assistant.js";
import { iDispositiviScollegati, mettiDaParte } from "../src/core/i-dispositivi-scollegati.js";

const ROOT = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, ROOT), "utf8");

const muta = (nome) => ({
  state: "unavailable",
  attributes: { friendly_name: nome },
  last_changed: "2026-09-20T08:00:00Z",
});
const viva = (nome, stato = "off") => ({
  state: stato,
  attributes: { friendly_name: nome },
  last_changed: "2026-09-22T20:00:00Z",
});

/* La casa dello scatto, in piccolo.
 *
 * L'asciugatrice ha la serratura bambini muta e il resto che parla: sta bene.
 * Il ripetitore del giardino tace tutto: quello è giù davvero. E c'è un
 * `input_boolean`, che un dispositivo non ce l'ha proprio. */
const STATI = {
  "lock.asciugatrice_child_lock": muta("Asciugatrice Child lock"),
  "sensor.asciugatrice_programma": viva("Asciugatrice Programma", "idle"),
  "switch.asciugatrice_avvio": viva("Asciugatrice Avvio"),
  "switch.presa_giardino": muta("Presa giardino"),
  "sensor.presa_giardino_potenza": muta("Presa giardino Potenza"),
  "input_boolean.vacanza": muta("Vacanza"),
};

const DI = {
  "lock.asciugatrice_child_lock": "asc1",
  "sensor.asciugatrice_programma": "asc1",
  "switch.asciugatrice_avvio": "asc1",
  "switch.presa_giardino": "giard1",
  "sensor.presa_giardino_potenza": "giard1",
};

const NOMI = { asc1: "Asciugatrice", giard1: "Presa giardino" };

const CONFIGURATE = [
  "lock.asciugatrice_child_lock",
  "switch.presa_giardino",
  "sensor.presa_giardino_potenza",
  "input_boolean.vacanza",
];

test("un dispositivo che parla da un'altra bocca non è un dispositivo giù", () => {
  const fuori = chiNonRispondePerDispositivo(CONFIGURATE, STATI, { di: DI, nomi: NOMI });
  const nomi = fuori.map((una) => una.nome);
  assert.ok(
    !nomi.includes("Asciugatrice Child lock"),
    "la serratura bambini muta non deve comparire: l'asciugatrice risponde",
  );
  assert.ok(!nomi.includes("Asciugatrice"), "e nemmeno l'asciugatrice stessa");
});

test("le entità che parlano si guardano in tutta la casa, non fra le configurate", () => {
  /* Dell'asciugatrice, qui dentro, è mappata SOLO la serratura bambini: a dire
   * che la macchina sta bene sono le altre due, che nella plancia non sono
   * configurate. Guardare le sole configurate rimetterebbe l'asciugatrice
   * nell'elenco — cioè proprio il caso che ha fatto nascere questa regola. */
  const soloLaSerratura = ["lock.asciugatrice_child_lock"];
  const fuori = chiNonRispondePerDispositivo(soloLaSerratura, STATI, { di: DI, nomi: NOMI });
  assert.deepEqual(fuori, []);
});

test("un dispositivo con tutte le entità mute è una riga sola, col suo nome", () => {
  const fuori = chiNonRispondePerDispositivo(CONFIGURATE, STATI, { di: DI, nomi: NOMI });
  const presa = fuori.find((una) => una.dispositivo === "giard1");
  assert.ok(presa, "la presa del giardino tace tutta: deve esserci");
  assert.equal(presa.nome, "Presa giardino");
  assert.deepEqual(presa.entita.sort(), [
    "sensor.presa_giardino_potenza",
    "switch.presa_giardino",
  ]);
  assert.equal(
    fuori.filter((una) => una.dispositivo === "giard1").length,
    1,
    "una riga sola, non una per entità",
  );
});

test("un'entità senza dispositivo resta una riga per conto suo", () => {
  const fuori = chiNonRispondePerDispositivo(CONFIGURATE, STATI, { di: DI, nomi: NOMI });
  const sola = fuori.find((una) => una.entity === "input_boolean.vacanza");
  assert.ok(sola, "un input_boolean un dispositivo non ce l'ha: non si può raggruppare");
  assert.deepEqual(sola.entita, ["input_boolean.vacanza"]);
});

test("senza le mappe si torna riga per riga, come prima che i registri ci fossero", () => {
  const senza = chiNonRispondePerDispositivo(CONFIGURATE, STATI, {});
  const prima = chiNonRisponde(CONFIGURATE, STATI);
  assert.deepEqual(
    senza.map((una) => una.entity),
    prima.map((una) => una.entity),
  );
});

test("il dispositivo è irraggiungibile da quando ha smesso l'ultima delle sue", () => {
  const stati = {
    ...STATI,
    "switch.presa_giardino": { ...muta("Presa giardino"), last_changed: "2026-09-20T08:00:00Z" },
    "sensor.presa_giardino_potenza": {
      ...muta("Presa giardino Potenza"),
      last_changed: "2026-09-21T09:00:00Z",
    },
  };
  const fuori = chiNonRispondePerDispositivo(CONFIGURATE, stati, { di: DI, nomi: NOMI });
  const presa = fuori.find((una) => una.dispositivo === "giard1");
  assert.equal(presa.da, Date.parse("2026-09-21T09:00:00Z"));
});

test("il cestino mette da parte tutte le entità di quel dispositivo", () => {
  const dopo = mettiDaParte([], ["switch.presa_giardino", "sensor.presa_giardino_potenza"]);
  assert.ok(dopo.includes("nonrisponde|switch.presa_giardino"));
  assert.ok(dopo.includes("nonrisponde|sensor.presa_giardino_potenza"));
  /* E una sola continua a valere, com'era scritto prima: le voci già nel
   * deposito non vanno migrate. */
  assert.deepEqual(mettiDaParte([], "switch.presa_giardino"), [
    "nonrisponde|switch.presa_giardino",
  ]);
});

test("messo da parte il dispositivo, dall'elenco sparisce del tutto", () => {
  const escluse = mettiDaParte([], ["switch.presa_giardino", "sensor.presa_giardino_potenza"]);
  const { adesso } = iDispositiviScollegati({
    configurate: CONFIGURATE,
    states: STATI,
    escluse,
    di: DI,
    nomi: NOMI,
  });
  assert.ok(!adesso.some((una) => una.dispositivo === "giard1"));
});

test("le due mappe si ricavano dai registri, e dalla forma compatta del guscio", () => {
  const dai = dispositiviDaiRegistri({
    dispositivi: [
      { id: "asc1", name: "Dryer", name_by_user: "Asciugatrice" },
      { id: "giard1", name: "Presa giardino" },
    ],
    entita: [
      { entity_id: "lock.asciugatrice_child_lock", device_id: "asc1" },
      { entity_id: "input_boolean.vacanza" },
    ],
  });
  /* Il nome che gli ha messo chi abita vince su quello di fabbrica: è quello
   * che uno riconosce. */
  assert.equal(dai.nomi.asc1, "Asciugatrice");
  assert.equal(dai.di["lock.asciugatrice_child_lock"], "asc1");
  assert.ok(
    !("input_boolean.vacanza" in dai.di),
    "un'entità senza dispositivo non entra: «non lo so» deve restare vuoto",
  );
  const dal = dispositiviDalGuscio({
    entReg: { "lock.asciugatrice_child_lock": { d: "asc1" } },
    devNames: { asc1: "Asciugatrice" },
  });
  assert.equal(dal.di["lock.asciugatrice_child_lock"], "asc1");
  assert.equal(dal.nomi.asc1, "Asciugatrice");
  assert.ok(nonSiSaNiente({ di: {}, nomi: {} }));
});

test("qui dentro non si prende la rete: è la porta che la #553 ha chiuso", async () => {
  const sorgente = await read("src/core/i-dispositivi-di-home-assistant.js");
  for (const proibito of ["fetch(", "XMLHttpRequest", "WebSocket", "callWS", "sendMessage"])
    assert.ok(!sorgente.includes(proibito), `${proibito} non deve stare in questo file`);
});

test("la scheda si chiama «Dispositivi non connessi», come la tessera in Home", async () => {
  const scheda = await read("src/sections/i-dispositivi-scollegati-section.js");
  assert.match(scheda, /t\("Dispositivi non connessi", "Disconnected devices"\)/);
  assert.doesNotMatch(scheda, /t\("Scollegati", "Disconnected"\)/);
});

test("la sezione e la tessera leggono le stesse due mappe", async () => {
  for (const quale of [
    "src/sections/i-dispositivi-scollegati-section.js",
    "src/sections/home-widgets-section.js",
  ]) {
    const sorgente = await read(quale);
    assert.match(sorgente, /iDispositiviRicordati\(\)/, `${quale} deve leggere le mappe`);
  }
});

test("chi ha i registri li lascia scritti, da tutt'e tre le parti", async () => {
  for (const quale of ["panel.js", "dashboard-card.js"]) {
    const sorgente = await read(quale);
    assert.match(sorgente, /ricordaIDispositiviDiHomeAssistant\(value\)/, quale);
  }
  /* E il guscio storico, che i registri se li tiene in `WIZ`. */
  const condiviso = await read("src/sections/shared.js");
  assert.match(condiviso, /ricordaIDispositivi\(dispositiviDalGuscio\(wiz\)\)/);
});
