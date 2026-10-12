/* Il termostato col caldo e il freddo, sul muro e dal tasto rapido.
 *
 * La pagina Clima, la sua finestra e la tessera della Home avevano imparato i
 * termostati a DUE obiettivi (`target_temp_low` e `target_temp_high`, il 22 e
 * il 40 delle foto); il tablet a muro e il tasto del Clima rapido no. Il muro
 * scriveva «—» e mandava `temperature` col meno e col piu'; il tasto rapido
 * mandava i gradi del preset come `temperature`, che Home Assistant a quei
 * termostati rifiuta.
 *
 * Qui si tiene fermo il tasto rapido — un preset che scalda porta il basso,
 * uno che raffresca l'alto, l'altro resta, il passo e la scala dell'unita'
 * valgono, e chi ha un obiettivo solo riceve i passi di sempre — e l'attesa
 * del muro, che deve finire quando Home Assistant conferma la coppia.
 *
 * E la terza linguetta del muro: nella pagina Clima i termostati a coppia
 * stanno in «Termostato», e non in Caldo o in Freddo.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { quickClimateSteps } from "../src/core/quick-climate.js";
import { comandiDellElenco, comandiDellaPagina } from "../src/core/plancia-a-muro.js";
import { attesaConfermata } from "../src/sections/plancia-a-muro-section.js";

/* Un termostato di fantasia a coppia: 22 e 40, da 4 a 40, mezzo grado. */
const DOPPIO = Object.freeze({
  hvac_modes: ["off", "heat", "cool", "heat_cool"],
  temperature: null,
  target_temp_low: 22,
  target_temp_high: 40,
  min_temp: 4,
  max_temp: 40,
  target_temp_step: 0.5,
});

const temperaturaDi = (passi) => passi.find((p) => p.service === "set_temperature")?.data;

test("il preset che scalda porta il basso, quello che raffresca l'alto, e l'altro resta", () => {
  assert.deepEqual(
    temperaturaDi(quickClimateSteps({ mode: "heat", temperature: 21, fan: "" }, DOPPIO)),
    { target_temp_low: 21, target_temp_high: 40 },
  );
  assert.deepEqual(
    temperaturaDi(quickClimateSteps({ mode: "cool", temperature: 26, fan: "auto" }, DOPPIO)),
    { target_temp_low: 22, target_temp_high: 26 },
  );
  /* La deumidificazione e la sola ventola stanno dalla parte del freddo. */
  assert.deepEqual(
    temperaturaDi(quickClimateSteps({ mode: "dry", temperature: 27, fan: "" }, DOPPIO)),
    { target_temp_low: 22, target_temp_high: 27 },
  );
  /* E gli altri passi restano quelli di sempre, nell'ordine di sempre. */
  const passi = quickClimateSteps({ mode: "cool", temperature: 26, fan: "auto" }, DOPPIO);
  assert.deepEqual(
    passi.map((p) => p.service),
    ["set_hvac_mode", "set_temperature", "set_fan_mode"],
  );
  assert.equal("temperature" in temperaturaDi(passi), false);
});

test("in automatico decide la zona da cui si preme", () => {
  const auto = { mode: "heat_cool", temperature: 24, fan: "" };
  assert.deepEqual(temperaturaDi(quickClimateSteps(auto, DOPPIO, { zona: "caldo" })), {
    target_temp_low: 24,
    target_temp_high: 40,
  });
  assert.deepEqual(temperaturaDi(quickClimateSteps(auto, DOPPIO, { zona: "freddo" })), {
    target_temp_low: 22,
    target_temp_high: 24,
  });
});

test("il basso non scavalca l'alto, e il passo e la scala sono quelli dell'unita'", () => {
  /* 26 gradi di caldo con il freddo a 24: il basso si ferma a 24, il freddo
   * non lo tocca nessuno. */
  const stretto = { ...DOPPIO, target_temp_low: 20, target_temp_high: 24 };
  assert.deepEqual(
    temperaturaDi(quickClimateSteps({ mode: "heat", temperature: 26, fan: "" }, stretto)),
    { target_temp_low: 24, target_temp_high: 24 },
  );
  /* Un'unita' a passo intero riceve un numero intero: 22,5 va sulla griglia. */
  const intero = { ...DOPPIO, target_temp_step: 1, min_temp: 5 };
  const dato = temperaturaDi(
    quickClimateSteps({ mode: "heat", temperature: 22.5, fan: "" }, intero),
  );
  assert.equal(Number.isInteger(dato.target_temp_low), true);
  /* Sopra il massimo dell'unita' non si va (il preset tiene fino a 35). */
  const basso = { ...DOPPIO, max_temp: 30, target_temp_high: 30 };
  assert.deepEqual(
    temperaturaDi(quickClimateSteps({ mode: "cool", temperature: 35, fan: "" }, basso)),
    undefined,
    "l'alto e' gia' al massimo: non c'e' niente da mandare",
  );
  assert.deepEqual(
    temperaturaDi(
      quickClimateSteps(
        { mode: "cool", temperature: 35, fan: "" },
        {
          ...basso,
          target_temp_high: 28,
        },
      ),
    ),
    { target_temp_low: 22, target_temp_high: 30 },
  );
});

test("chi ha un obiettivo solo, o non dice i suoi attributi, riceve i passi di sempre", () => {
  const preset = { mode: "heat", temperature: 22, fan: "" };
  const sempre = [
    { service: "set_hvac_mode", data: { hvac_mode: "heat" } },
    { service: "set_temperature", data: { temperature: 22 } },
  ];
  assert.deepEqual(quickClimateSteps(preset), sempre);
  assert.deepEqual(quickClimateSteps(preset, null, { zona: "caldo" }), sempre);
  assert.deepEqual(
    quickClimateSteps(preset, { temperature: 20, min_temp: 7, max_temp: 35 }),
    sempre,
  );
  /* Tutti e tre i numeri in caldo: vale il singolo, come in Home Assistant. */
  assert.deepEqual(quickClimateSteps(preset, { ...DOPPIO, temperature: 20 }), sempre);
  /* Senza gradi nel preset non si manda nessuna temperatura, coppia o no. */
  assert.deepEqual(quickClimateSteps({ mode: "heat", temperature: null, fan: "" }, DOPPIO), [
    { service: "set_hvac_mode", data: { hvac_mode: "heat" } },
  ]);
});

test("sul muro l'attesa della coppia finisce quando Home Assistant la conferma", () => {
  const atteso = { target_temp_low: 22.5, target_temp_high: 40 };
  assert.equal(attesaConfermata("coppia", atteso, { coppia: { basso: 22.5, alto: 40 } }), true);
  assert.equal(attesaConfermata("coppia", atteso, { coppia: { basso: 22, alto: 40 } }), false);
  assert.equal(attesaConfermata("coppia", atteso, { coppia: { basso: null, alto: null } }), false);
});

test("il muro e il ponte del tasto rapido leggono i due obiettivi dal nucleo", async () => {
  const muro = await readFile(
    new URL("../src/sections/plancia-a-muro-section.js", import.meta.url),
    "utf8",
  );
  assert.match(muro, /from "\.\.\/core\/i-due-obiettivi-del-clima\.js"/);
  assert.match(muro, /coppiaSpostata\(/);
  assert.match(muro, /quickClimateSteps\(rapido, attributi\(id\)/);
  const editor = await readFile(
    new URL("../src/sections/quick-climate-editor-section.js", import.meta.url),
    "utf8",
  );
  assert.match(editor, /quickClimateSteps\(presetDi\(entita, zona\), allStates\(\)/);
});

test("sul muro il termostato a coppia sta nella linguetta Termostato, e fuori dalle altre", () => {
  const fonte = {
    clima: [
      { entity: "climate.living", tipo: "pompa" },
      { entity: "climate.bagno", tipo: "termo" },
      { entity: "climate.salone", tipo: "clima" },
    ],
  };
  const aCoppia = (id) => id === "climate.living";
  const entita = (comandi) => comandi.map((c) => c.entita);
  assert.deepEqual(entita(comandiDellElenco("termostato", fonte, { aCoppia })), ["climate.living"]);
  assert.deepEqual(entita(comandiDellElenco("caldo", fonte, { aCoppia })), ["climate.bagno"]);
  assert.deepEqual(entita(comandiDellElenco("freddo", fonte, { aCoppia })), ["climate.salone"]);
  /* Chi non sa degli stati (l'editor) riceve le due linguette di sempre, e la
   * terza vuota. */
  assert.deepEqual(entita(comandiDellElenco("caldo", fonte)), ["climate.living", "climate.bagno"]);
  assert.deepEqual(comandiDellElenco("termostato", fonte), []);
  const pagina = { id: "p1", modello: "clima", zona: "caldo" };
  assert.deepEqual(entita(comandiDellaPagina(pagina, fonte, "termostato", { aCoppia })), [
    "climate.living",
  ]);
});

test("la card del muro ha le due righe coi loro tasti, e la finestra pure", async () => {
  const muro = await readFile(
    new URL("../src/sections/plancia-a-muro-section.js", import.meta.url),
    "utf8",
  );
  assert.match(muro, /if \(aCoppia\(id\)\) return cardTermostato\(c, i\);/);
  assert.match(muro, /data-mu-fa="meno" data-mu-estremo="\$\{estremo\}"/);
  assert.match(muro, /data-mu-fa="piu" data-mu-estremo="\$\{estremo\}"/);
  assert.match(muro, /cambiaTemperatura\(id, 1, bersaglio\.dataset\.muEstremo \|\| ""\)/);
  assert.match(muro, /\["termostato", "temperatura", t\("Termostato", "Thermostat"\)/);
  // La scelta a pastiglia della versione di prima non c'e' piu'.
  assert.doesNotMatch(muro, /data-mu-fa="estremo"/);
});
