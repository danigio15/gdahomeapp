/* Le bollette vere (#295): dai sensori dell'integrazione del fornitore —
 * qui quelli di EON Energia Italia, come nella schermata della segnalazione —
 * a quello che la linguetta Bollette racconta. */
import assert from "node:assert/strict";
import test from "node:test";

import {
  laBolletta,
  laBollettaEPagata,
  mesiAllaScadenza,
  normalizzaBollette,
  sensoriDellaBolletta,
} from "../src/core/le-bollette.js";

const s = (id, state, attributes = {}) => [id, { entity_id: id, state, attributes }];
const EON = Object.fromEntries([
  s("sensor.eon_latest_invoice", "52.0", {
    unit_of_measurement: "€",
    friendly_name: "Latest Invoice",
  }),
  s("sensor.eon_total_invoiced", "316.0", {
    unit_of_measurement: "€",
    friendly_name: "Total Invoiced",
  }),
  s("sensor.eon_unpaid_invoices", "52.0", {
    unit_of_measurement: "€",
    friendly_name: "Unpaid Invoices",
  }),
  s("sensor.eon_invoice_payment_status", "unpaid", { friendly_name: "Invoice Payment Status" }),
  s("sensor.eon_potenza_impegnata", "6.0", {
    unit_of_measurement: "kW",
    friendly_name: "Potenza impegnata",
  }),
  s("sensor.eon_scadenza_offerta", "2028-03-31", { friendly_name: "Scadenza offerta" }),
  s("sensor.eon_daily_consumption", "22.79", {
    unit_of_measurement: "kWh",
    friendly_name: "Daily Consumption",
  }),
  s("sensor.cucina_temperatura", "21", { unit_of_measurement: "°C" }),
]);

test("i sensori di E.ON si trovano da soli, uno per voce", () => {
  assert.deepEqual(sensoriDellaBolletta(EON), {
    daPagare: "sensor.eon_unpaid_invoices",
    stato: "sensor.eon_invoice_payment_status",
    ultima: "sensor.eon_latest_invoice",
    totale: "sensor.eon_total_invoiced",
    potenza: "sensor.eon_potenza_impegnata",
    scadenza: "sensor.eon_scadenza_offerta",
    consumoGiorno: "sensor.eon_daily_consumption",
  });
});

test("la bolletta dice quanto c'e' da pagare, e che non e' pagata", () => {
  const b = laBolletta(EON);
  assert.equal(b.daPagare, 52);
  assert.equal(b.pagata, false);
  assert.equal(b.voci.ultima.valore, 52);
  assert.equal(b.voci.totale.valore, 316);
  assert.equal(b.voci.potenza.unita, "kW");
  assert.equal(new Date(b.voci.scadenza.data).getFullYear(), 2028);
});

test("la scelta salvata vince sul nome", () => {
  const altro = {
    ...EON,
    ...Object.fromEntries([s("sensor.mia_bolletta", "80", { unit_of_measurement: "€" })]),
  };
  const b = laBolletta(altro, { voci: { ultima: "sensor.mia_bolletta" } });
  assert.equal(b.voci.ultima.valore, 80);
  assert.deepEqual(normalizzaBollette({ voci: { ultima: "non un'entita'", pippo: "sensor.x" } }), {
    voci: {},
  });
});

test("senza sensori di bolletta non c'e' niente da dire", () => {
  assert.equal(laBolletta(Object.fromEntries([s("sensor.cucina_temperatura", "21")])), null);
});

test("pagata o no: le parole dei fornitori, e lo zero da pagare", () => {
  assert.equal(laBollettaEPagata("unpaid"), false);
  assert.equal(laBollettaEPagata("paid"), true);
  assert.equal(laBollettaEPagata("Pagata"), true);
  assert.equal(laBollettaEPagata("unknown"), null);
  const zero = { ...EON };
  zero["sensor.eon_unpaid_invoices"] = { state: "0", attributes: {} };
  delete zero["sensor.eon_invoice_payment_status"];
  assert.equal(laBolletta(zero).pagata, true);
});

test("i mesi alla scadenza", () => {
  const adesso = new Date(2026, 9, 21).getTime();
  assert.equal(mesiAllaScadenza(new Date(2028, 2, 31).getTime(), adesso), 17);
  assert.equal(mesiAllaScadenza(new Date(2026, 8, 1).getTime(), adesso) < 0, true);
});
