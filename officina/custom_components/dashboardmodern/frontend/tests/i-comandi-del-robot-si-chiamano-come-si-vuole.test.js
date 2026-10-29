/* «Sarebbe possibile personalizzare le scritte delle scorciatoie o eliminare
 * la parola Scorciatoia?» (#340). */
import assert from "node:assert/strict";
import test from "node:test";

import { normalizeRobots, robotView } from "../src/core/robot-model.js";

const STATI = {
  "vacuum.dreame": { state: "docked", attributes: { friendly_name: "Dreame" } },
  "button.dreame_scorciatoia_1": {
    state: "unknown",
    attributes: { friendly_name: "Dreame Scorciatoia Pulizia cucina" },
  },
  "button.dreame_scorciatoia_2": {
    state: "unknown",
    attributes: { friendly_name: "Dreame Scorciatoia 2" },
  },
  "script.lava_il_bagno": { state: "off", attributes: { friendly_name: "Lava il bagno" } },
};

const comandi = [
  "button.dreame_scorciatoia_1",
  "button.dreame_scorciatoia_2",
  "script.lava_il_bagno",
];

test("la parola «Scorciatoia» davanti si toglie da sola", () => {
  const [robot] = normalizeRobots([{ entity: "vacuum.dreame", comandi }]);
  const nomi = robotView(robot, STATI).comandi.map((c) => c.name);
  assert.deepEqual(nomi, ["Pulizia cucina", "2", "Lava il bagno"]);
});

test("ogni comando si chiama come si vuole, e il nome resta salvato", () => {
  const [robot] = normalizeRobots([
    {
      entity: "vacuum.dreame",
      comandi,
      nomi: {
        "button.dreame_scorciatoia_2": "  Aspira il salotto  ",
        "script.lava_il_bagno": "Lava bagno <b>",
        /* Un comando che non c'e' non si tiene. */
        "button.non_ce": "Fantasma",
      },
    },
  ]);
  assert.deepEqual(robot.nomi, {
    "button.dreame_scorciatoia_2": "Aspira il salotto",
    "script.lava_il_bagno": "Lava bagno b",
  });
  const nomi = robotView(robot, STATI).comandi.map((c) => c.name);
  assert.deepEqual(nomi, ["Pulizia cucina", "Aspira il salotto", "Lava bagno b"]);
  /* Rinormalizzare non perde niente. */
  assert.deepEqual(normalizeRobots([robot])[0].nomi, robot.nomi);
});
