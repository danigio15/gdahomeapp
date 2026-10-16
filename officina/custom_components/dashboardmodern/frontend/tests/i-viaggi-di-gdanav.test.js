/* I viaggi di gdanav visti dalla plancia (`core/i-viaggi.js`): gli stessi
 * conti della casa, prima di salvare. */
import assert from "node:assert/strict";
import test from "node:test";

import {
  bozzaNuova,
  durataStimata,
  giorniDetti,
  MARGINE_SENZA_TRAFFICO,
  nomeDelViaggio,
  oraDi,
  partenzaEArrivo,
  proietta,
  quandoDetto,
} from "../src/core/i-viaggi.js";

const MINUTO = 60_000;

test("arrivo entro: si parte prima, col margine se manca il traffico", () => {
  const bozza = {
    ...bozzaNuova("una", new Date(2026, 9, 15, 12).getTime()),
    tappe: [{ nome: "Caserta", lat: 41, lon: 14 }],
    stima: { durataS: 40 * 60, fonte: "strada" },
  };
  assert.equal(bozza.quando.giorno, "2026-10-16");
  assert.equal(durataStimata(bozza), Math.round(40 * MINUTO * MARGINE_SENZA_TRAFFICO));
  const { partenza, arrivo } = partenzaEArrivo(bozza, bozza.quando.giorno);
  assert.equal(oraDi(arrivo), "9:00");
  assert.equal(oraDi(partenza), "8:14");
  bozza.stima = { durataS: 48 * 60, fonte: "traffico" };
  assert.equal(oraDi(partenzaEArrivo(bozza, bozza.quando.giorno).partenza), "8:12");
});

test("a tappe: si parte all'ora scritta, e le soste allungano l'arrivo", () => {
  const bozza = {
    ...bozzaNuova("tappe"),
    quando: { modo: "partenza", ora: "08:30", giorno: "2026-10-16", giorni: [] },
    tappe: [
      { nome: "Ufficio", lat: 41, lon: 14, sostaMin: 30 },
      { nome: "Cliente", lat: 41.1, lon: 14.1 },
    ],
    stima: { durataS: 3600, fonte: "traffico" },
  };
  const { partenza, arrivo } = partenzaEArrivo(bozza, "2026-10-16");
  assert.equal(oraDi(partenza), "8:30");
  assert.equal(oraDi(arrivo), "10:00");
});

test("come si dice un viaggio", () => {
  assert.equal(giorniDetti([1, 2, 3, 4, 5]), "Lun – Ven");
  assert.equal(giorniDetti([6, 7]), "Sab, Dom");
  assert.equal(giorniDetti([1, 2, 3, 4, 5, 6, 7]), "Tutti i giorni");
  assert.equal(nomeDelViaggio({ tappe: [{ nome: "Caserta · Piazza Dante" }] }), "Casa – Caserta");
  assert.equal(nomeDelViaggio({ nome: "Giro clienti", tappe: [] }), "Giro clienti");
  const oggi = new Date(2026, 9, 15, 12).getTime();
  assert.equal(
    quandoDetto(
      { tipo: "una", quando: { modo: "arrivo", ora: "09:00", giorno: "2026-10-16" } },
      oggi,
    ),
    "Domani · arrivo entro le 09:00",
  );
  assert.equal(
    quandoDetto(
      { tipo: "settimana", quando: { modo: "partenza", ora: "18:00", giorni: [1, 2, 3, 4, 5] } },
      oggi,
    ),
    "Lun – Ven · parto alle 18:00",
  );
});

test("la strada sta dentro il riquadro, senza deformarsi", () => {
  const punti = proietta(
    [
      [14.26, 40.85],
      [14.33, 41.07],
    ],
    600,
    260,
  );
  for (const [x, y] of punti) {
    assert.ok(x >= 0 && x <= 600 && y >= 0 && y <= 260);
  }
  assert.ok(punti[1][1] < punti[0][1], "il nord sta in alto");
  assert.deepEqual(proietta([], 600, 260), []);
});
