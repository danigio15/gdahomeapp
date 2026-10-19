/* La pappa degli animali.
 *
 * Dal campo: «sulla sezione animali possiamo inserire, come hai fatto con la
 * pulizia, il cibo, cosi' confermo che e' stato dato da mangiare e mi avvisa
 * quando sara' da rifare?». Un momento segnato dalla scheda e un ritmo in ore:
 * la pagina dice da quanto e fra quanto, e quando e' l'ora alza l'avviso.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  conLaPappa,
  laPappa,
  normalizzaAnimali,
  oreDellaPappa,
  vistaAnimale,
} from "../src/core/animali-model.js";

const ORA = 60 * 60_000;
const alle = Date.parse("2026-10-19T08:00:00Z");
const iso = (ms) => new Date(ms).toISOString();

test("senza ritmo ne' pappa segnata non c'e' niente da mostrare", () => {
  assert.equal(laPappa({ nome: "Micio" }, alle), null);
});

test("col ritmo e senza pappa segnata: si sa ogni quanto, non che e' l'ora", () => {
  const pappa = laPappa({ pappa_ogni: "12" }, alle);
  assert.equal(pappa.ogni, 12);
  assert.equal(pappa.minuti, null);
  assert.equal(pappa.ora, false);
});

test("segnata da 3 ore, ogni 12: la prossima fra 9 ore", () => {
  const animale = conLaPappa({ pappa_ogni: "12" }, iso(alle - 3 * ORA));
  const pappa = laPappa(animale, alle);
  assert.equal(pappa.minuti, 180);
  assert.equal(pappa.fra, 540);
  assert.equal(pappa.ora, false);
});

test("passate le 12 ore e' l'ora, e la scheda lo dice; tardi di mezzo giro e' rossa", () => {
  const animale = conLaPappa({ id: "micio", nome: "Micio", specie: "gatto", pappa_ogni: "12" }, iso(alle));
  const presto = vistaAnimale(animale, {}, alle + 11 * ORA);
  assert.deepEqual(presto.avvisi, []);
  const ora = vistaAnimale(animale, {}, alle + 12 * ORA);
  assert.deepEqual(
    ora.avvisi.map((a) => [a.chiave, a.gravita]),
    [["pappa_da_dare", "attenzione"]],
  );
  const tardi = vistaAnimale(animale, {}, alle + 18 * ORA);
  assert.equal(tardi.avvisi[0].gravita, "urgente");
  assert.equal(tardi.gravita, "urgente");
});

test("la pappa e il ritmo restano dopo il salvataggio della configurazione", () => {
  const [salvato] = normalizzaAnimali([conLaPappa({ nome: "Fido", specie: "cane", pappa_ogni: "8" }, iso(alle))]);
  assert.equal(salvato.pappa_ogni, "8");
  assert.equal(salvato.pappa, new Date(alle).toISOString());
});

test("«Annulla» rimette la pappa di prima, o nessuna", () => {
  assert.equal(conLaPappa({ pappa: "x" }, "").pappa, undefined);
  assert.equal(conLaPappa({}, new Date(alle).toISOString()).pappa, new Date(alle).toISOString());
});

test("ogni quante ore: a mezz'ore, mai zero, al piu' una settimana", () => {
  assert.equal(oreDellaPappa(""), null);
  assert.equal(oreDellaPappa("0"), null);
  assert.equal(oreDellaPappa("7.7"), 7.5);
  assert.equal(oreDellaPappa("0.1"), 0.5);
  assert.equal(oreDellaPappa("1000"), 168);
});
