/* «La notifica della lavastoviglie ha l'icona della lavatrice.»
 *
 * La scheda di un elettrodomestico che ha finito porta il tipo (`i`), e il
 * telefono ci disegna la faccia di quel tipo: la lavastoviglie la sua, la
 * lavatrice la sua, e quello che nessuno sa che cos'e' la presa generica —
 * mai il cestello di un'altra cosa.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { Sentinella } from "../src/sentinella.js";
import { iconaDelGenere, paroleDelCiclo } from "../src/parole-delle-notifiche.js";
import {
  elettrodomesticoDellaPlancia,
  tipoDellElettrodomestico,
} from "../src/il-tipo-dell-elettrodomestico.js";

const APP = fileURLToPath(new URL("../../app/", import.meta.url));

const stato = (entity_id, state, attributes = {}) => ({ entity_id, state, attributes });

const CICLO = {
  da: "15:50",
  a: "17:42",
  min: 112,
  kwh: 0.94,
  eur: 0,
  sole: 0.82,
  batt: 0,
  rkwh: 0,
  reur: 0,
  senza: 0.16,
  w: [30, 1900, 20],
  s: [1500, 1480, 100],
};

/* Il nome come lo scrive chi abita, e il disegno che ci si aspetta. */
const DAL_NOME = {
  Lavastoviglie: "dishwasher",
  "sensor.dishwasher_power": "dishwasher",
  Lavatrice: "washer",
  "Washing machine": "washer",
  Asciugatrice: "dryer",
  Forno: "oven",
  Microonde: "microwave",
  Frigorifero: "fridge",
  Condizionatore: "air-conditioner",
  "Clima camera": "air-conditioner",
  "Pompa di calore": "heat-pump",
  Scaldabagno: "boiler",
  Boiler: "boiler",
  "Boiler di accumulo": "storage-boiler",
  "Robot aspirapolvere": "robot-vacuum",
  Wallbox: "wallbox",
  "Ricarica auto": "wallbox",
  "Piastra a induzione": "cooktop",
  "Piano cottura": "cooktop",
  Friggitrice: "air-fryer",
  "Macchina del caffè": "coffee",
  "Pompa piscina": "pool-pump",
  "Presa studio": "generic",
  "Qualcosa di strano": "generic",
  "": "generic",
};

test("dal nome, il disegno giusto: la lavastoviglie non e' la lavatrice", () => {
  for (const [nome, atteso] of Object.entries(DAL_NOME))
    assert.equal(tipoDellElettrodomestico({ parole: [nome] }), atteso, nome);
  assert.notEqual(
    tipoDellElettrodomestico({ parole: ["Lavastoviglie"] }),
    tipoDellElettrodomestico({ parole: ["Lavatrice"] }),
  );
});

test("quello che non si sa prende la presa generica", () => {
  assert.equal(tipoDellElettrodomestico(), "generic");
  assert.equal(tipoDellElettrodomestico({ voce: {}, parole: [] }), "generic");
  assert.equal(tipoDellElettrodomestico({ parole: ["sensor.presa_3_power"] }), "generic");
  /* Il genere di un ponte che il tipo non lo sa ancora: mai «altro». */
  assert.equal(iconaDelGenere("lavastoviglie"), "dishwasher");
  assert.equal(iconaDelGenere("lavasciuga"), "washer");
  assert.equal(iconaDelGenere("sensor.boh"), "generic");
});

test("decide prima quello che e' configurato nella plancia, poi il nome", () => {
  const valori = {
    dm_dashboard_state: JSON.stringify({
      sections: {
        appliances: [
          { name: "Lavatrice", power_entity: "sensor.presa_bagno_power" },
          {
            name: "Cucina",
            type: "dishwasher",
            state_entity: "sensor.lavatrice_cucina_stato",
            entities: [{ entity: "sensor.presa_cucina_power" }],
          },
        ],
        loads: [{ name: "Forno", power: "sensor.presa_forno_power" }],
      },
    }),
  };
  const cucina = elettrodomesticoDellaPlancia(valori, "sensor.presa_cucina_power");
  assert.equal(cucina?.name, "Cucina");
  assert.deepEqual(elettrodomesticoDellaPlancia(valori, "sensor.lavatrice_cucina_stato"), cucina);
  assert.equal(elettrodomesticoDellaPlancia(valori, "sensor.altro"), null);
  assert.equal(elettrodomesticoDellaPlancia({}, "sensor.presa_cucina_power"), null);
  /* Il tipo configurato vince sul nome che viene da Home Assistant. */
  assert.equal(
    tipoDellElettrodomestico({ voce: cucina, parole: ["Lavatrice cucina"] }),
    "dishwasher",
  );
  const forno = elettrodomesticoDellaPlancia(valori, "sensor.presa_forno_power");
  assert.equal(
    tipoDellElettrodomestico({ voce: forno, parole: ["sensor.presa_forno_power"] }),
    "oven",
  );
  /* L'icona di Home Assistant scelta a mano dice anche lei che cos'e'. */
  assert.equal(tipoDellElettrodomestico({ voce: { icon: "mdi:dishwasher" } }), "dishwasher");
  assert.equal(tipoDellElettrodomestico({ voce: { icon: "mdi:tumble-dryer" } }), "dryer");
});

test("la lavastoviglie che finisce manda la scheda con la lavastoviglie, la lavatrice con la lavatrice", () => {
  const ora = new Date(2026, 9, 14, 12, 0, 0).getTime();
  const dette = [];
  const sentinella = new Sentinella({ adesso: () => ora, quando: (e) => dette.push(e) });
  sentinella.valori = () => ({
    dm_dashboard_state: {
      sections: {
        appliances: [
          { name: "Lavastoviglie", type: "dishwasher", state_entity: "sensor.lavastoviglie_stato" },
        ],
      },
    },
  });
  sentinella.carica([
    stato("sensor.lavastoviglie_stato", "run", { friendly_name: "Lavastoviglie" }),
    stato("sensor.lavatrice_stato", "run", { friendly_name: "Lavatrice" }),
  ]);
  for (const id of ["sensor.lavastoviglie_stato", "sensor.lavatrice_stato"])
    sentinella.cambia(id, stato(id, "finished", { friendly_name: id.split(/[._]/)[1] }));
  const finite = dette.filter((d) => d.tipo === "elettrodomestici");
  assert.equal(finite.length, 2);
  const schede = finite.map(
    (d) => paroleDelCiclo({ ...d.componi.dati, ciclo: CICLO }, "it", { stile: "elaborata" }).scheda,
  );
  assert.deepEqual(
    schede.map((s) => [s.n, s.i]),
    [
      ["Lavastoviglie", "dishwasher"],
      ["Lavatrice", "washer"],
    ],
  );
  assert.notEqual(schede[0].i, schede[1].i);
});

test("ogni tipo che il ponte manda, l'app lo sa disegnare (e l'iPhone ha il suo simbolo)", () => {
  const swift = readFileSync(`${APP}ios/NotificheService/LaScheda.swift`, "utf8");
  const dart = readFileSync(`${APP}lib/vestito/elettrodomestici.dart`, "utf8");
  const tipi = new Set(Object.values(DAL_NOME));
  for (const tipo of tipi) {
    assert.ok(existsSync(`${APP}assets/elettrodomestici/${tipo}.svg`), `manca il disegno: ${tipo}`);
    assert.ok(dart.includes(`'${tipo}',`), `l'app non conosce il tipo: ${tipo}`);
    if (tipo !== "generic")
      assert.ok(swift.includes(`"${tipo}": [`), `l'iPhone non ha il simbolo: ${tipo}`);
  }
  /* I disegni sono uno diverso dall'altro: la lavastoviglie non e' la
   * lavatrice con un altro nome. */
  const facce = [...tipi].map((tipo) =>
    readFileSync(`${APP}assets/elettrodomestici/${tipo}.svg`, "utf8"),
  );
  assert.equal(new Set(facce).size, facce.length);
});
