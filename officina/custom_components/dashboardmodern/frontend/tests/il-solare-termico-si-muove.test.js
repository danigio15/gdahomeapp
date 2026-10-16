/* Il solare termico si muove (e a movimento ridotto non si ferma).
 *
 * «Il solare termico e' statico.» La causa era il ramo a movimento ridotto
 * della sua sezione: spegneva il flusso nei tubi, la girante della pompa e il
 * pallino «in diretta» — lo STATO, non la decorazione — contro la regola della
 * casa (`beta27-appliance-motion-cards.test.js`): su molti desktop quella
 * impostazione e' accesa senza che chi guarda lo sappia.
 *
 * Qui si tiene fermo il nucleo del movimento (quanto corre, quanto scalda, il
 * boiler in potenza) e la forma del foglio: a movimento ridotto si spegne la
 * decorazione e lo stato rallenta; nella «plancia leggera» dell'app lo stato
 * continua a girare; e niente timer, solo fotogrammi CSS.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  RIFERIMENTI_DEL_MOTO,
  caloreDelPannello,
  ilMotoDelSolare,
  lettureDelMoto,
  passiDelFlusso,
} from "../src/core/il-solare-in-movimento.js";

const SEZIONE = readFileSync(
  new URL("../src/sections/solar-thermal-design-section.js", import.meta.url),
  "utf8",
);

function ramoRidotto() {
  const inizio = SEZIONE.indexOf("@media (prefers-reduced-motion: reduce)");
  assert.ok(inizio > 0, "manca il ramo a movimento ridotto");
  let profondita = 0;
  for (let i = SEZIONE.indexOf("{", inizio); i < SEZIONE.length; i += 1) {
    if (SEZIONE[i] === "{") profondita += 1;
    else if (SEZIONE[i] === "}") {
      profondita -= 1;
      if (!profondita) return SEZIONE.slice(inizio, i + 1);
    }
  }
  return "";
}

test("il flusso corre col ΔT: sei passi, tutti divisori di quattro secondi", () => {
  assert.equal(passiDelFlusso(0), 1);
  assert.equal(passiDelFlusso(null), 1);
  assert.equal(passiDelFlusso(6), 2);
  assert.equal(passiDelFlusso("34,6"), 6);
  assert.equal(passiDelFlusso(200), 6);
  assert.equal(passiDelFlusso(-10), 1);
  for (let dt = 0; dt <= 40; dt += 1) {
    const { ciclo, rotore } = ilMotoDelSolare({ delta: dt });
    const n = passiDelFlusso(dt);
    assert.ok(Math.abs(Number.parseFloat(ciclo) * n - 4) < 0.001, ciclo);
    assert.ok(Math.abs(Number.parseFloat(rotore) * n * 2 - 4) < 0.001, rotore);
  }
});

test("il pannello scalda da 30 a 90 gradi, e il boiler e' acceso se tira", () => {
  assert.equal(caloreDelPannello(30), 0);
  assert.equal(caloreDelPannello(90), 1);
  assert.equal(caloreDelPannello(60), 0.5);
  assert.equal(caloreDelPannello(120), 1);
  assert.equal(caloreDelPannello(undefined), 0);
  assert.equal(ilMotoDelSolare({ potenza: 1500 }).boiler, "on");
  assert.equal(ilMotoDelSolare({ potenza: 0 }).boiler, "off");
  assert.equal(ilMotoDelSolare({}).boiler, "off");
});

test("le letture vengono dagli stati veri, attraverso il mappatore", () => {
  const mappa = {
    [RIFERIMENTI_DEL_MOTO.delta]: "sensor.dt",
    [RIFERIMENTI_DEL_MOTO.pannello]: "sensor.pannello",
    [RIFERIMENTI_DEL_MOTO.potenza]: "sensor.potenza",
  };
  const stati = {
    "sensor.dt": { state: "12.4", attributes: {} },
    "sensor.pannello": { state: "unavailable", attributes: {} },
    "sensor.potenza": { state: "1.5", attributes: { unit_of_measurement: "kW" } },
  };
  assert.deepEqual(
    lettureDelMoto(stati, (rif) => mappa[rif] || rif),
    { delta: 12.4, pannello: null, potenza: 1500 },
  );
  /* Senza mappatura non si legge niente. */
  assert.deepEqual(
    lettureDelMoto(stati, (rif) => rif),
    {
      delta: null,
      pannello: null,
      potenza: null,
    },
  );
});

test("a movimento ridotto si spegne la decorazione, non lo stato", () => {
  const ramo = ramoRidotto();
  /* Nessuna regola che spenga il flusso, la girante, il pallino in diretta,
   * l'allarme della valvola di sicurezza o i tasti accesi. */
  for (const regola of ramo.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const [, selettore, corpo] = regola;
    if (!/animation:\s*none/.test(corpo)) continue;
    for (const stato of [
      "syn-flow",
      "anim-icon",
      "dm-st-rotor",
      "dm-st-live",
      "syn-safety-alert",
      "spin-active",
      "blink-active",
      "dmx-dots",
      "dmx-coil",
      "dmx-element",
      "dmx-drop",
      "dmx-chev",
    ])
      assert.doesNotMatch(selettore, new RegExp(stato), `spegne lo stato: ${stato}`);
  }
  /* Lo stato rallenta: particelle a meta', girante a un quarto. */
  assert.match(ramo, /\.dmx-dots \{ animation:dmxRun25 var\(--dmx-cycle\)/);
  assert.match(ramo, /dm-st-rotor \{ animation:spinAnim calc\(var\(--dmx-rotor\) \* 4\)/);
  /* E la decorazione si spegne. */
  assert.match(ramo, /\.dmx-sweep,\.dmx-wave,\.dmx-beam,\.dmx-rays/);
});

test("nella plancia leggera dell'app lo stato continua a girare", () => {
  /* L'app ferma ogni animazione dopo un giro con tre id di forza: lo stato
   * risponde con quattro. */
  assert.match(
    SEZIONE,
    /#page-boiler:not\(#dmx-a\):not\(#dmx-b\):not\(#dmx-c\):not\(#dmx-d\)[^{]*\.syn-flow\.active \{ animation-iteration-count:infinite !important; \}/,
  );
  assert.match(SEZIONE, /:not\(#dmx-d\) #syn-p-solare\.active \.dm-st-rotor/);
});

test("il movimento e' solo CSS: niente timer, niente osservatori", () => {
  assert.doesNotMatch(SEZIONE, /setInterval|MutationObserver/);
  assert.doesNotMatch(SEZIONE, /<animate/);
  /* I numeri del movimento vengono dal modello, non dai testi a schermo. */
  assert.match(SEZIONE, /lettureDelMoto\(allStates\(\)/);
  assert.doesNotMatch(SEZIONE, /syn-v-delta"\)\?\.textContent/);
});
