/* «Se attivo la ricarica notturna mi devi dire se la vettura riesce ad
 * arrivare alla percentuale che ho impostato di ricarica.» */
import assert from "node:assert/strict";
import test from "node:test";
import { ciArriva, impostazioniPulite } from "../src/core/ricarica-di-notte.js";

const ORA = 3600000;
const inizio = Date.UTC(2026, 10, 1, 23),
  fine = inizio + 6 * ORA;

test("ci arriva: dal 40% al 100% con 60 kWh a 7,4 kW in sei ore", () => {
  const r = ciArriva({ soc: 40, limite: 100, capacita: 60, kw: 7.4, inizio, fine });
  assert.equal(r.esito, "si");
  /* 36 kWh / (7,4 × 0,9) = 5,4 ore */
  assert.ok(r.minuti > 320 && r.minuti < 330, `${r.minuti} minuti`);
  assert.equal(r.alle, inizio + r.minuti * 60000);
});

test("non ci arriva: a 3,7 kW alle 05:00 e' a meta' strada", () => {
  const r = ciArriva({ soc: 20, limite: 100, capacita: 77, kw: 3.7, inizio, fine });
  assert.equal(r.esito, "no");
  assert.equal(r.alle, fine);
  /* 3,7 × 0,9 × 6 = 20 kWh su 77: +25% */
  assert.equal(r.percentuale, 45);
  assert.ok(r.minuti > 6 * 60);
});

test("gia' al limite, o manca qualcosa per dirlo", () => {
  assert.equal(ciArriva({ soc: 80, limite: 80 }).esito, "gia");
  assert.equal(ciArriva({ soc: null, limite: 80 }).esito, "nonso");
  assert.equal(
    ciArriva({ soc: 30, limite: 80, capacita: 60, kw: null, inizio, fine }).esito,
    "nonso",
  );
  assert.equal(
    ciArriva({ soc: 30, limite: 80, capacita: null, kw: 7, inizio, fine }).esito,
    "nonso",
  );
});

test("la potenza della wallbox si scrive nelle impostazioni", () => {
  assert.equal(impostazioniPulite({ kw: "7,4" }).kw, 7.4);
  assert.equal(impostazioniPulite({ kw: "" }).kw, 0);
  assert.equal(impostazioniPulite({ kw: 300 }).kw, 0);
});
