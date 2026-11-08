/* «Perché dice dal 60 se ho la batteria al 19%?»
 *
 * La Leapmotor b10 (67 kWh) dice 19%, e la pagina Auto lo mostra. evcc, che
 * di un'auto senza il suo collegamento la batteria non la sa, tiene un 60%
 * vecchio: la carta della ricarica di notte contava da li', e diceva «Sì, al
 * 100% verso le 03:20 — Dal 60% servono 4 h 20 min». La batteria e' quella
 * dell'auto; evcc solo se l'auto tace. */
import assert from "node:assert/strict";
import test from "node:test";
import {
  batteriaDellAuto,
  ciArriva,
  entitaDellaRicarica,
  letturaDellAuto,
} from "../src/core/ricarica-di-notte.js";

const AUTO = "sensor.leapmotor_b10_batteria";
const EVCC = "sensor.evcc_garage_vehicle_soc";

const caselle = {
  "dm.ev_modalita_ricarica_evcc": "select.evcc_garage_mode",
  "dm.ev_target_soc": "number.evcc_garage_limit_soc",
};
const risolvi = (rif) => caselle[rif] || "";

const stati = (batteria, evcc) => ({
  "select.evcc_garage_mode": { state: "off", attributes: { options: ["off", "pv", "now"] } },
  [AUTO]: { state: batteria, attributes: { unit_of_measurement: "%" } },
  [EVCC]: { state: evcc, attributes: { unit_of_measurement: "%" } },
  "number.evcc_garage_limit_soc": { state: "100", attributes: {} },
});

test("la batteria dell'auto viene prima di quella di evcc", () => {
  const entita = entitaDellaRicarica(risolvi, { batteria: AUTO });
  assert.deepEqual(entita.soc, [AUTO, EVCC]);
  assert.equal(letturaDellAuto(entita, stati("19", "60")).soc, 19);
});

test("anche quando la batteria dell'auto sta nella casella della plancia", () => {
  const entita = entitaDellaRicarica((rif) =>
    rif === "dm.ev_batteria_auto" ? AUTO : risolvi(rif),
  );
  assert.deepEqual(entita.soc, [AUTO, EVCC]);
  assert.equal(letturaDellAuto(entita, stati("19", "60")).soc, 19);
});

test("dal 19% a 6,9 kW, dalle 23 alle 5, al 100% non ci arriva", () => {
  const entita = entitaDellaRicarica(risolvi, { batteria: AUTO });
  const { soc, limite } = letturaDellAuto(entita, stati("19", "60"));
  const inizio = new Date(2026, 10, 6, 23, 0).getTime();
  const fine = new Date(2026, 10, 7, 5, 0).getTime();
  const r = ciArriva({ soc, limite, capacita: 67, kw: 6.9, inizio, fine });
  assert.equal(r.esito, "no");
  assert.equal(r.alle, fine);
  /* 6,9 kW × 0,9 × 6 h = 37,3 kWh su 67: +55%. Senza perdite sarebbe l'81%. */
  assert.equal(r.percentuale, 74);
  /* 81% di 67 kWh = 54,3 kWh: 8 h 45 min */
  assert.equal(r.minuti, 525);
  /* Dal 60% di evcc diceva di si'. */
  assert.equal(ciArriva({ soc: 60, limite, capacita: 67, kw: 6.9, inizio, fine }).esito, "si");
});

test("l'auto che tace lascia la parola a evcc", () => {
  const entita = entitaDellaRicarica(risolvi, { batteria: AUTO });
  assert.equal(letturaDellAuto(entita, stati("unavailable", "60")).soc, 60);
  assert.equal(letturaDellAuto(entita, stati("unknown", "60")).soc, 60);
  const senza = stati("19", "60");
  delete senza[AUTO];
  assert.equal(letturaDellAuto(entita, senza).soc, 60);
});

test("lo 0% di evcc non conta: vale il 46% dell'auto", () => {
  const entita = entitaDellaRicarica(risolvi, { batteria: AUTO });
  assert.equal(letturaDellAuto(entita, stati("46", "0")).soc, 46);
  /* e lo stesso con evcc davanti, com'era scritto prima */
  assert.equal(letturaDellAuto({ ...entita, soc: [EVCC, AUTO] }, stati("46", "0")).soc, 46);
  /* tutti a zero: zero */
  assert.equal(letturaDellAuto(entita, stati("0", "0")).soc, 0);
});

test("la batteria dal profilo dell'auto", () => {
  assert.equal(batteriaDellAuto({ ov: { "dm.ev_batteria_auto": AUTO } }), AUTO);
  assert.equal(batteriaDellAuto({ overrides: { "dm.ev_batteria_auto": ` ${AUTO} ` } }), AUTO);
  assert.equal(batteriaDellAuto({ ov: { "dm.ev_batteria_auto": "dm.ev_batteria_auto" } }), "");
  assert.equal(batteriaDellAuto({ ov: {} }), "");
  assert.equal(batteriaDellAuto(null), "");
});
