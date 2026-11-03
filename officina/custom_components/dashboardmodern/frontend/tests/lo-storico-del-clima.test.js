/* Lo storico del clima: il report anche sui mesi che Home Assistant ha gia'
 * dimenticato.
 *
 * «Recupera anche dati storici altrimenti non ha senso.» Le fonti sono tre —
 * l'archivio del ponte, la storia, le statistiche a lungo termine — e il
 * report di un periodo e' la somma dei suoi giorni. Quello che deve restare
 * vero: dai giorni della storia esce lo stesso report del conto diretto;
 * dalle statistiche le ore di richiesta sono una stima segnata (valvola,
 * watt, stagione), le accensioni non si contano e niente si inventa; un'ora
 * delle statistiche cade nell'ora locale giusta; l'archivio tiene tre anni di
 * giorni e sessanta di ore.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { periodoDelReport, reportDellImpianto } from "../src/core/report-del-clima.js";
import {
  GIORNI_CONSERVATI,
  GIORNI_CON_LE_ORE,
  caldaieDallaConfigurazione,
  chiaveDelGiorno,
  domandaStatisticheDelClima,
  giorniDelPeriodo,
  giorniFra,
  inizioDellaChiave,
  oreDelleStatistiche,
  potaLArchivio,
  quotaDellOra,
  reportDaiGiorni,
  riassuntoDalleStatistiche,
  riassuntoDelGiorno,
  tipoDellaMisura,
  unitaDallaConfigurazione,
  zoneDellUnita,
} from "../src/core/storico-del-clima.js";

const H = 3_600_000;
const M = 60_000;
const GIORNO = 24 * H;

/* Tre giorni di gennaio di un termosifone: la notte a 17°, dalle 6 alle 8 a
 * 21° e chiede calore, poi tiene i 21° fino alle 22. */
function righeDelTermosifone(primo, giorni = 3) {
  const righe = [];
  for (let d = 0; d < giorni; d += 1) {
    const g = new Date(primo);
    g.setDate(g.getDate() + d);
    const t = g.getTime();
    righe.push({ t, s: "heat", a: { hvac_action: "idle", current_temperature: 18, temperature: 17 } });
    righe.push({ t: t + 6 * H, s: "heat", a: { hvac_action: "heating", current_temperature: 18.5, temperature: 21 } });
    righe.push({ t: t + 8 * H, s: "heat", a: { hvac_action: "idle", current_temperature: 21, temperature: 21 } });
    righe.push({ t: t + 22 * H, s: "heat", a: { hvac_action: "idle", current_temperature: 20, temperature: 17 } });
  }
  return righe;
}

const giorniCon = (periodo, record) =>
  giorniDelPeriodo(periodo).map((g) => ({ ...g, record: record(g) }));

/* ── i giorni ─────────────────────────────────────────────────────────── */

test("i giorni di un periodo: chiave locale, e chiuso solo quello finito", () => {
  const adesso = new Date(2026, 6, 14, 15).getTime();
  const mese = periodoDelReport("mese", new Date(2026, 6, 10), new Date(adesso));
  const giorni = giorniDelPeriodo(mese);
  assert.equal(giorni.length, 14, "dal 1° al 14, oggi compreso");
  assert.equal(giorni[0].chiave, "2026-07-01");
  assert.equal(giorni.at(-1).chiave, "2026-07-14");
  assert.equal(giorni.at(-1).chiuso, false, "oggi non e' finito");
  assert.equal(giorni.at(-1).fine, adesso);
  assert.equal(giorni[12].chiuso, true);
  assert.equal(chiaveDelGiorno(new Date(2026, 0, 5, 23, 59).getTime()), "2026-01-05");
  assert.equal(inizioDellaChiave("2026-01-05"), new Date(2026, 0, 5).getTime());
  assert.equal(inizioDellaChiave("5 gennaio"), null);
});

/* ── dalla storia ─────────────────────────────────────────────────────── */

test("dai giorni della storia esce lo stesso report del conto diretto, comfort compreso", () => {
  const primo = new Date(2026, 0, 12).getTime();
  const unita = [{ entity: "climate.sala", name: "Sala", zone: "caldo" }];
  const storie = { "climate.sala": righeDelTermosifone(primo, 7) };
  const adesso = primo + 20 * GIORNO;
  const periodo = periodoDelReport("settimana", new Date(primo), new Date(adesso));
  const diretto = reportDellImpianto({ impianto: "caldo", unita, storie, periodo });
  const giorni = giorniCon(periodo, (g) =>
    riassuntoDelGiorno({ impianto: "caldo", unita, storie, giorno: g, adesso }),
  );
  const dai = reportDaiGiorni({ impianto: "caldo", unita, periodo, giorni });
  assert.deepEqual(dai.fonti, { archivio: 0, storia: 7, statistiche: 0, nessuna: 0 });
  const [a] = diretto.stanze;
  const [b] = dai.stanze;
  assert.equal(b.msRichiesta, a.msRichiesta);
  assert.equal(b.msRichiesta, 14 * H, "due ore al giorno per sette giorni");
  assert.equal(b.msAccesa, a.msAccesa);
  assert.ok(Math.abs(b.ambiente - a.ambiente) < 0.01);
  /* Il comfort si decide sulla settimana, non giorno per giorno. */
  assert.equal(b.obiettivoComfort, 21);
  assert.ok(Math.abs(b.ambienteComfort - a.ambienteComfort) < 0.01);
  assert.equal(b.msComfort, a.msComfort);
  assert.deepEqual(
    b.perSecchiello,
    a.perSecchiello,
    "una barra per giorno, uguale a quella diretta",
  );
  assert.equal(dai.stima, true, "senza caldaia l'impianto e' una stima");
  assert.equal(dai.totali.msGeneratore, diretto.totali.msGeneratore);
  assert.equal(dai.totali.accensioni, diretto.totali.accensioni);
});

test("un giorno ridotto tutto a 17° resta ridotto anche se da solo sembra piatto", () => {
  const primo = new Date(2026, 1, 2).getTime();
  const righe = [
    ...righeDelTermosifone(primo, 1),
    /* Il giorno dopo: tutto il giorno a 17°. */
    { t: primo + GIORNO, s: "heat", a: { hvac_action: "idle", current_temperature: 17.2, temperature: 17 } },
  ];
  const unita = [{ entity: "climate.sala", name: "Sala", zone: "caldo" }];
  const adesso = primo + 10 * GIORNO;
  const periodo = { ...periodoDelReport("settimana", new Date(primo), new Date(adesso)) };
  const giorni = giorniCon(periodo, (g) =>
    g.inizio < primo + 2 * GIORNO
      ? riassuntoDelGiorno({ impianto: "caldo", unita, storie: { "climate.sala": righe }, giorno: g, adesso })
      : null,
  );
  const dai = reportDaiGiorni({ impianto: "caldo", unita, periodo, giorni });
  assert.equal(dai.stanze[0].obiettivoComfort, 21);
  assert.equal(dai.fonti.nessuna, 5, "i giorni senza niente si contano, e non valgono zero");
});

test("un giorno senza un minuto di storia non c'e'", () => {
  const unita = [{ entity: "climate.sala", name: "Sala", zone: "caldo" }];
  const inizio = new Date(2026, 6, 1).getTime();
  assert.equal(
    riassuntoDelGiorno({
      impianto: "caldo",
      unita,
      storie: { "climate.sala": [] },
      giorno: { inizio, fine: inizio + GIORNO },
      adesso: inizio + 40 * GIORNO,
    }),
    null,
  );
});

/* ── dalle statistiche ────────────────────────────────────────────────── */

test("le statistiche: la domanda e' oraria, e un'ora UTC cade nell'ora locale giusta", () => {
  const domanda = domandaStatisticheDelClima(["sensor.t", "sensor.t", ""], 0, H);
  assert.equal(domanda.type, "recorder/statistics_during_period");
  assert.equal(domanda.period, "hour");
  assert.deepEqual(domanda.statistic_ids, ["sensor.t"]);
  const locale = new Date(2026, 6, 14, 15).getTime();
  const ore = oreDelleStatistiche(
    {
      "sensor.t": [
        { start: new Date(locale + H).toISOString(), mean: 24 },
        { start: locale, mean: "23.5", max: 24 },
      ],
    },
    "sensor.t",
  );
  assert.deepEqual(
    ore.map((o) => [o.t, o.mean]),
    [
      [locale, 23.5],
      [locale + H, 24],
    ],
    "in ordine, coi millisecondi e con le date ISO",
  );
  const giorno = { inizio: new Date(2026, 6, 14).getTime(), fine: new Date(2026, 6, 15).getTime() };
  const record = riassuntoDalleStatistiche({
    impianto: "freddo",
    unita: [{ entity: "climate.split", zone: "freddo", temperatura: "sensor.t" }],
    serie: { "sensor.t": ore },
    giorno,
    adesso: giorno.fine + GIORNO,
  });
  assert.deepEqual(record.stanze["climate.split"].t, [23.75, 120]);
  assert.equal(record.stanze["climate.split"].r, null, "senza valvola ne' watt la richiesta non si sa");
});

test("quanto di un'ora ha lavorato: media sul massimo, sotto la soglia niente", () => {
  assert.equal(quotaDellOra({ mean: 20, max: 60 }, 5), 1 / 3);
  assert.equal(quotaDellOra({ mean: 450, max: 900 }, 20), 0.5);
  assert.equal(quotaDellOra({ mean: 2, max: 4 }, 5), 0, "la testina che si assesta non e' richiesta");
  assert.equal(quotaDellOra({ mean: 30, max: null }, 5), 1);
  assert.equal(quotaDellOra(null, 5), 0);
  assert.equal(tipoDellaMisura("W"), "potenza");
  assert.equal(tipoDellaMisura("h"), "ore");
  assert.equal(tipoDellaMisura("m³"), "energia");
  assert.equal(tipoDellaMisura("%"), "percento");
});

/* Le ore di un giorno di statistiche, con quello che si vuole nelle ore
 * scelte: `valori(ora)` torna la voce o null. */
function serieDelGiorno(inizio, valori) {
  const fuori = [];
  for (let ora = 0; ora < 24; ora += 1) {
    const voce = valori(ora);
    if (voce) fuori.push({ t: inizio + ora * H, mean: null, max: null, min: null, change: null, state: null, ...voce });
  }
  return fuori;
}

test("d'inverno la richiesta si stima dalla valvola, e l'accesa non si sa", () => {
  const inizio = new Date(2026, 0, 20).getTime();
  const giorno = { inizio, fine: inizio + GIORNO };
  const record = riassuntoDalleStatistiche({
    impianto: "caldo",
    unita: [{ entity: "climate.camera", zone: "caldo", valvola: "number.valvola", temperatura: "sensor.t_camera" }],
    generatori: [{ nome: "Caldaia", entity: "binary_sensor.caldaia", statistiche: ["binary_sensor.caldaia"] }],
    serie: {
      /* Aperta dalle 6 alle 8: un'ora tutta, un'ora a meta'. */
      "number.valvola": serieDelGiorno(inizio, (ora) =>
        ora === 6 ? { mean: 60, max: 60 } : ora === 7 ? { mean: 30, max: 60 } : { mean: 0, max: 0 },
      ),
      "sensor.t_camera": serieDelGiorno(inizio, () => ({ mean: 20 })),
    },
    unitaDi: () => "",
    giorno,
    adesso: inizio + 40 * GIORNO,
  });
  const camera = record.stanze["climate.camera"];
  assert.equal(camera.r, 90, "un'ora e mezza");
  assert.equal(camera.a, null);
  assert.equal(camera.sv, "valvola");
  assert.equal(camera.s, true);
  assert.equal(camera.o[6], 60);
  assert.equal(camera.o[7], 30);
  assert.deepEqual(camera.v, [3.75, 1440]);
  assert.deepEqual(camera.t, [20, 1440]);
  assert.deepEqual(record.generatori, {}, "un binary_sensor non ha statistiche: non si inventa");
  assert.equal(record.stima.ms, 90);
});

test("d'estate lo split si conosce dai watt, la pompa di calore dalla stagione", () => {
  const inizio = new Date(2026, 6, 14).getTime();
  const giorno = { inizio, fine: inizio + GIORNO };
  const unita = [
    { entity: "climate.split", zone: "freddo", consumo: "sensor.split_w", soglia_consumo: 30 },
    { entity: "climate.pompa", zone: "freddo", consumo: "sensor.pompa_w" },
    { entity: "climate.pompa", zone: "caldo", consumo: "sensor.pompa_w" },
  ];
  const serie = {
    /* Dalle 14 alle 16 a 900 W, poi mezz'ora. */
    "sensor.split_w": serieDelGiorno(inizio, (ora) =>
      ora === 14 || ora === 15 ? { mean: 900, max: 900 } : ora === 16 ? { mean: 450, max: 900 } : { mean: 5, max: 8 },
    ),
    "sensor.pompa_w": serieDelGiorno(inizio, (ora) => (ora === 13 ? { mean: 1.2, max: 1.2 } : { mean: 0, max: 0 })),
  };
  const unitaDi = (id) => (id === "sensor.pompa_w" ? "kW" : "W");
  const freddo = riassuntoDalleStatistiche({ impianto: "freddo", unita, serie, unitaDi, giorno, adesso: inizio + 9 * GIORNO });
  assert.equal(freddo.stanze["climate.split"].r, 150);
  assert.equal(freddo.stanze["climate.split"].a, 150, "dai watt si sa anche quanto e' rimasto acceso");
  assert.equal(freddo.stanze["climate.split"].sv, "consumo");
  assert.equal(freddo.stanze["climate.split"].kwh, 2.35, "2,25 kWh di lavoro e un po' di attesa");
  assert.equal(freddo.stanze["climate.pompa"].sv, "stagione");
  assert.equal(freddo.stanze["climate.pompa"].r, 60, "i kW si leggono come kW");
  const caldo = riassuntoDalleStatistiche({ impianto: "caldo", unita, serie, unitaDi, giorno, adesso: inizio + 9 * GIORNO });
  assert.equal(caldo, null, "a luglio la pompa di calore non scaldava, e non c'e' altro");
});

test("la caldaia dalle statistiche: i watt, le ore di funzionamento, i metri cubi", () => {
  const inizio = new Date(2026, 0, 20).getTime();
  const giorno = { inizio, fine: inizio + GIORNO };
  const serie = {
    "sensor.caldaia_w": serieDelGiorno(inizio, (ora) => (ora >= 6 && ora < 9 ? { mean: 12000, max: 24000 } : { mean: 3, max: 4 })),
    "sensor.caldaia_ore": serieDelGiorno(inizio, (ora) => (ora === 6 ? { change: 0.75 } : { change: 0 })),
    "sensor.gas": serieDelGiorno(inizio, (ora) => (ora === 7 ? { change: 1.4 } : { change: 0 })),
  };
  const unitaDi = (id) => ({ "sensor.caldaia_w": "W", "sensor.caldaia_ore": "h", "sensor.gas": "m³" })[id];
  const conDi = (id) =>
    riassuntoDalleStatistiche({
      impianto: "caldo",
      unita: [],
      generatori: [{ nome: "Caldaia", entity: "binary_sensor.fiamma", statistiche: ["binary_sensor.fiamma", id] }],
      serie,
      unitaDi,
      giorno,
      adesso: inizio + 40 * GIORNO,
    }).generatori["binary_sensor.fiamma"];
  const watt = conDi("sensor.caldaia_w");
  assert.equal(watt.ms, 90, "tre ore a meta'");
  assert.equal(watt.acc, null, "dalle medie d'ora le accensioni non si contano");
  assert.equal(watt.consumo, 36.06, "12 kW per tre ore, e l'attesa");
  assert.equal(watt.unita, "kWh");
  assert.equal(conDi("sensor.caldaia_ore").ms, 45);
  const gas = conDi("sensor.gas");
  assert.equal(gas.ms, 60);
  assert.equal(gas.consumo, 1.4);
  assert.equal(gas.unita, "m³");
});

/* ── le fonti insieme ─────────────────────────────────────────────────── */

test("un mese di fonti miste: archivio, storia, statistiche e giorni vuoti", () => {
  const adesso = new Date(2026, 1, 3, 12).getTime();
  const periodo = periodoDelReport("settimana", new Date(2026, 0, 26), new Date(adesso));
  const unita = [{ entity: "climate.sala", name: "Sala", zone: "caldo", valvola: "number.v" }];
  const generatori = [{ nome: "Caldaia", entity: "switch.caldaia", statistiche: ["switch.caldaia", "sensor.caldaia_w"] }];
  const storie = {
    "climate.sala": righeDelTermosifone(new Date(2026, 0, 26).getTime(), 7),
    "switch.caldaia": [],
  };
  const giorni = giorniCon(periodo, (g) => {
    const quale = giorniDelPeriodo(periodo).findIndex((x) => x.chiave === g.chiave);
    if (quale < 2) {
      const r = riassuntoDelGiorno({ impianto: "caldo", unita, storie, generatori, giorno: g, adesso });
      return { ...r, fonte: "archivio" };
    }
    if (quale < 4) return riassuntoDelGiorno({ impianto: "caldo", unita, storie, generatori, giorno: g, adesso });
    if (quale < 6)
      return riassuntoDalleStatistiche({
        impianto: "caldo",
        unita,
        generatori,
        serie: {
          "number.v": serieDelGiorno(g.inizio, (ora) => (ora === 6 ? { mean: 40, max: 80 } : { mean: 0, max: 0 })),
          "sensor.caldaia_w": serieDelGiorno(g.inizio, (ora) => (ora === 6 ? { mean: 9000, max: 18000 } : { mean: 0, max: 0 })),
        },
        unitaDi: (id) => (id === "sensor.caldaia_w" ? "W" : "%"),
        giorno: g,
        adesso,
      });
    return null;
  });
  const report = reportDaiGiorni({ impianto: "caldo", unita, generatori, periodo, giorni });
  assert.deepEqual(report.fonti, { archivio: 2, storia: 2, statistiche: 2, nessuna: 1 });
  const [sala] = report.stanze;
  assert.equal(sala.msRichiesta, (4 * 120 + 2 * 30) * M, "due ore al giorno dalla storia, mezz'ora dalla valvola");
  assert.equal(sala.giorniStatistiche, 2);
  assert.deepEqual(sala.stimaDa, ["valvola"]);
  assert.equal(sala.datiScarsi, false, "i giorni delle statistiche non sono «dati parziali»");
  assert.equal(report.stimato, true);
  /* La caldaia: solo i giorni delle statistiche ne sanno qualcosa. */
  assert.equal(report.stima, false);
  assert.equal(report.generatori[0].ms, 2 * 30 * M);
  assert.equal(report.totali.accensioni, null, "con le statistiche in mezzo le accensioni non si sommano");
  assert.equal(report.giorniSenzaCaldaia, 4, "quattro giorni con le stanze e senza la caldaia");
  assert.deepEqual(report.totali.consumo, { valore: 18, unita: "kWh" }, "9 kW per un'ora, due giorni");
  assert.equal(report.vuoto, false);
});

test("un giorno vecchio senza le sue ore dice i totali e lo scrive", () => {
  const inizio = new Date(2026, 0, 20).getTime();
  const periodo = periodoDelReport("giorno", new Date(inizio), new Date(inizio + 100 * GIORNO));
  const giorni = giorniCon(periodo, () => ({
    fonte: "archivio",
    stanze: { "climate.sala": { r: 120, a: 900, n: 1440, o: null, t: [20, 1440], ob: [[21, 900, 20.5, 900]], v: null, s: false } },
    generatori: {},
    stima: { ms: 130, acc: 2, o: null },
  }));
  const report = reportDaiGiorni({
    impianto: "caldo",
    unita: [{ entity: "climate.sala", name: "Sala", zone: "caldo" }],
    periodo,
    giorni,
  });
  assert.equal(report.oreMancanti, true);
  assert.equal(report.stanze[0].msRichiesta, 2 * H);
  assert.equal(report.totali.msGeneratore, 130 * M);
  assert.ok(report.secchielli.every((s) => s.ms === 0));
});

test("niente da nessuna parte: il report e' vuoto", () => {
  const periodo = periodoDelReport("mese", new Date(2025, 6, 1), new Date(2026, 10, 3));
  const report = reportDaiGiorni({
    impianto: "freddo",
    unita: [{ entity: "climate.split", name: "Split", zone: "freddo" }],
    periodo,
    giorni: giorniCon(periodo, () => null),
  });
  assert.equal(report.vuoto, true);
  assert.equal(report.fonti.nessuna, 31);
  assert.equal(report.stanze.length, 0);
});

/* ── l'archivio ───────────────────────────────────────────────────────── */

test("l'archivio tiene tre anni di giorni e sessanta di ore", () => {
  const adesso = new Date(2026, 10, 3, 12).getTime();
  const giorno = (o) => ({
    caldo: { fonte: "storia", stanze: { "climate.a": { r: 1, o } }, generatori: { "switch.c": { ms: 1, o } }, stima: { ms: 1, o } },
  });
  const chiave = (indietro) => chiaveDelGiorno(new Date(2026, 10, 3 - indietro).getTime());
  const archivio = {
    [chiave(1)]: giorno([1, 2]),
    [chiave(GIORNI_CON_LE_ORE + 1)]: giorno([1, 2]),
    [chiave(GIORNI_CONSERVATI + 1)]: giorno([1, 2]),
    "non-e-un-giorno": giorno([1]),
  };
  const potato = potaLArchivio(archivio, adesso);
  assert.deepEqual(Object.keys(potato).sort(), [chiave(GIORNI_CON_LE_ORE + 1), chiave(1)].sort());
  assert.deepEqual(potato[chiave(1)].caldo.stanze["climate.a"].o, [1, 2]);
  const vecchio = potato[chiave(GIORNI_CON_LE_ORE + 1)].caldo;
  assert.equal(vecchio.stanze["climate.a"].o, null);
  assert.equal(vecchio.generatori["switch.c"].o, null);
  assert.equal(vecchio.stima.o, null);
  assert.equal(vecchio.stanze["climate.a"].r, 1, "il giorno resta");
  assert.deepEqual(Object.keys(giorniFra(potato, chiave(5), chiave(0))), [chiave(1)]);
});

/* ── la configurazione, per il ponte ──────────────────────────────────── */

test("le unita' e le caldaie dalla configurazione salvata, come le vede la pagina", () => {
  const valori = {
    cd_clima_units: JSON.stringify([
      { entity: "clima_sala", type: "termo", valvola: "valvola_sala" },
      { entity: "climate.studio", type: "pompa" },
      { entity: "climate.coppia", type: "clima" },
      { entity: "humidifier.cantina" },
    ]),
    cd_caldaia: JSON.stringify([{ name: "Giorno", stato: "binary_sensor.fiamma", modulazione: "sensor.mod" }]),
  };
  const mappa = { clima_sala: "climate.sala", valvola_sala: "number.valvola_sala" };
  const unita = unitaDallaConfigurazione(valori, {
    risolvi: (rif) => mappa[rif] || "",
    attributiDi: (id) => (id === "climate.coppia" ? { target_temp_low: 19, target_temp_high: 25 } : null),
  });
  assert.deepEqual(
    unita.map((u) => [u.entity, u.zone, u.valvola]),
    [
      ["climate.sala", "caldo", "number.valvola_sala"],
      ["climate.studio", "freddo", ""],
      ["climate.studio", "caldo", ""],
      ["climate.coppia", "termostato", ""],
    ],
  );
  assert.deepEqual(zoneDellUnita({ type: "condizionatore" }), ["freddo"]);
  assert.deepEqual(caldaieDallaConfigurazione(valori), [
    { nome: "Giorno", entity: "binary_sensor.fiamma", statistiche: ["binary_sensor.fiamma", "sensor.mod"] },
  ]);
  /* Le configurazioni nuove tengono il clima fra le sezioni del deposito. */
  const dalDeposito = unitaDallaConfigurazione({
    dm_dashboard_state: JSON.stringify({ sections: { climate: [{ entity: "climate.x", type: "termo" }] } }),
  });
  assert.deepEqual(dalDeposito.map((u) => u.entity), ["climate.x"]);
});
