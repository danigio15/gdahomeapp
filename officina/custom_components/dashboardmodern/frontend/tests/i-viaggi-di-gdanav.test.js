/* I viaggi di gdanav visti dalla plancia (`core/i-viaggi.js`): gli stessi
 * conti della casa, prima di salvare. */
import assert from "node:assert/strict";
import test from "node:test";

import {
  bozzaNuova,
  caricaAllaPartenza,
  caricaDopo,
  CONSUMO_DI_SERIE,
  consumoStimato,
  durataStimata,
  giorniDetti,
  guidaStimata,
  laStradaInFila,
  MARGINE_SENZA_TRAFFICO,
  minutiDiRicarica,
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

/* ── l'auto elettrica ─────────────────────────────────────────────────── */

/* Napoli – Aversa – Milano: 788 km, 9 h 55 col margine, due soste di
 * ricarica da 22 e 23 minuti. */
const DA_NAPOLI = () => ({
  ...bozzaNuova("tappe"),
  quando: { modo: "partenza", ora: "09:00", giorno: "2026-10-17", giorni: [] },
  tappe: [
    { nome: "Aversa · Caserta, Campania", lat: 40.97, lon: 14.2 },
    { nome: "Milano · Lombardia", lat: 45.46, lon: 9.19 },
  ],
  stima: { durataS: 31044, km: 788, fonte: "strada" },
  soste: {
    elenco: [
      { km: 268, nome: "Area di servizio Ovest", kw: 300, da: 15, a: 80, min: 22 },
      { km: 528, nome: "Area di servizio Nord", kw: 350, da: 17, a: 80, min: 23 },
    ],
    arrivo: 17,
    tappeKm: [16, 788],
  },
});

test("le soste di ricarica allungano il viaggio: l'arrivo dopo, la partenza prima", () => {
  const bozza = DA_NAPOLI();
  assert.equal(minutiDiRicarica(bozza), 45);
  assert.equal(Math.round(guidaStimata(bozza) / MINUTO), 595);
  assert.equal(durataStimata(bozza), guidaStimata(bozza) + 45 * MINUTO);
  const { arrivo } = partenzaEArrivo(bozza, "2026-10-17");
  assert.equal(oraDi(arrivo), "19:40");
  /* Con «arrivo entro» si parte prima, e di 45 minuti in piu'. */
  const entro = {
    ...bozza,
    tipo: "una",
    quando: { ...bozza.quando, modo: "arrivo", ora: "19:40" },
  };
  const senza = { ...entro, soste: null };
  const conSoste = partenzaEArrivo(entro, "2026-10-17").partenza;
  const senzaSoste = partenzaEArrivo(senza, "2026-10-17").partenza;
  assert.equal(senzaSoste - conSoste, 45 * MINUTO);
});

test("la strada in fila: partenza, tappe, soste e arrivo, con le ore", () => {
  const bozza = DA_NAPOLI();
  const partenza = new Date(2026, 9, 17, 9, 0).getTime();
  const fila = laStradaInFila(bozza, partenza);
  assert.deepEqual(
    fila.map((r) => [r.tipo, r.km, oraDi(r.alle), r.riparte ? oraDi(r.riparte) : ""]),
    [
      ["partenza", 0, "9:00", "9:00"],
      ["tappa", 16, "9:12", "9:12"],
      ["sosta", 268, "12:22", "12:44"],
      ["sosta", 528, "16:00", "16:23"],
      ["arrivo", 788, "19:40", ""],
    ],
  );
  assert.equal(fila[2].sosta.nome, "Area di servizio Ovest");
  assert.equal(fila[3].n, 2);
  /* La sosta dell'utente a una tappa sposta tutto quello che viene dopo. */
  bozza.tappe[0].sostaMin = 30;
  const conSosta = laStradaInFila(bozza, partenza);
  assert.equal(oraDi(conSosta[1].riparte), "9:42");
  assert.equal(oraDi(conSosta[2].alle), "12:52");
  assert.equal(oraDi(conSosta[4].alle), "20:10");
  /* Senza stima, niente fila. */
  assert.deepEqual(laStradaInFila({ ...bozza, stima: null }, partenza), []);
});

test("il consumo e la carica: dall'auto, o di serie", () => {
  /* 70 kWh al 62% con 245 km di autonomia: 17,7 kWh ogni 100 km. */
  assert.equal(consumoStimato({ kwh: 70, carica: 62, autonomia: 245 }), 17.7);
  assert.equal(consumoStimato({ kwh: 70, carica: 62 }), CONSUMO_DI_SERIE);
  assert.equal(consumoStimato({ kwh: 70, carica: 62, autonomia: 2 }), CONSUMO_DI_SERIE);
  assert.equal(consumoStimato({ kwh: 70, carica: 90, autonomia: 40 }), CONSUMO_DI_SERIE);
  assert.equal(caricaAllaPartenza("adesso", 62, 80), 62);
  assert.equal(caricaAllaPartenza("obiettivo", 62, 80), 80);
  assert.equal(caricaAllaPartenza("obiettivo", 90, 80), 90, "l'obiettivo non toglie carica");
  assert.equal(caricaAllaPartenza("obiettivo", 62, null), 62);
  assert.equal(caricaAllaPartenza(100, null), 100);
  assert.equal(caricaAllaPartenza("adesso", "unavailable"), null);
  assert.equal(Math.round(caricaDopo(41.3, { carica: 62, kwh: 70, consumo: 17 })), 52);
});
