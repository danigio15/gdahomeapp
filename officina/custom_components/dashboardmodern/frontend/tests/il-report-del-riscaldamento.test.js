/* Il report del riscaldamento: quanto ha chiesto ogni stanza, quanto ha
 * lavorato la caldaia, con che valvola e a che temperatura.
 *
 * «Report giornaliero/mensile sulle varie stanze di quanto sono state
 * accese, con che media di apertura valvola, quanto e' stata accesa la
 * caldaia ecc. Un po' come per la parte energia, report per ogni impianto.»
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  accensioni,
  accesaPer,
  chiedePer,
  durataNeiSecchielli,
  generatoreAcceso,
  impiantiPresenti,
  intervalliDove,
  mediaNelTempo,
  oreScritte,
  periodoDelReport,
  reportDellImpianto,
  righeDellaStoria,
  spostaIlPeriodo,
  unisci,
  unitaDellImpianto,
} from "../src/core/report-del-clima.js";

const H = 3_600_000;
const M = 60_000;

test("il giorno si divide in ore, il mese in giorni, la settimana parte il lunedi'", () => {
  const giorno = periodoDelReport("giorno", new Date(2026, 0, 14, 15), new Date(2026, 0, 20));
  assert.equal(giorno.secchielli.length, 24);
  assert.equal(giorno.inizio, new Date(2026, 0, 14).getTime());
  assert.equal(giorno.fine, new Date(2026, 0, 15).getTime());
  assert.equal(giorno.passo, "ora");

  const mese = periodoDelReport("mese", new Date(2026, 1, 10), new Date(2026, 5, 1));
  assert.equal(mese.secchielli.length, 28);
  assert.equal(mese.passo, "giorno");

  /* Mercoledi' 14 gennaio 2026: la settimana e' quella da lunedi' 12. */
  const settimana = periodoDelReport("settimana", new Date(2026, 0, 14), new Date(2026, 1, 1));
  assert.equal(settimana.inizio, new Date(2026, 0, 12).getTime());
  assert.equal(settimana.secchielli.length, 7);
});

test("il periodo in corso finisce adesso: il futuro non ha ore", () => {
  const adesso = new Date(2026, 0, 14, 10, 30);
  const p = periodoDelReport("giorno", adesso, adesso);
  assert.equal(p.fine, adesso.getTime());
  assert.equal(p.inCorso, true);
  assert.equal(p.secchielli.length, 24);
});

test("le frecce spostano di un giorno, di una settimana, di un mese", () => {
  assert.deepEqual(spostaIlPeriodo("giorno", new Date(2026, 0, 1), -1), new Date(2025, 11, 31));
  assert.deepEqual(spostaIlPeriodo("settimana", new Date(2026, 0, 14), 1), new Date(2026, 0, 19));
  assert.deepEqual(spostaIlPeriodo("mese", new Date(2026, 0, 31), 1), new Date(2026, 1, 1));
});

test("le righe compresse del websocket portano avanti gli attributi", () => {
  const righe = righeDellaStoria(
    {
      "climate.sala": [
        { s: "heat", a: { hvac_action: "heating", current_temperature: 19 }, lu: 100 },
        { s: "heat", lu: 200 },
      ],
    },
    "climate.sala",
  );
  assert.equal(righe.length, 2);
  assert.equal(righe[0].t, 100_000);
  assert.equal(righe[1].a.hvac_action, "heating");
  /* E quelle per esteso della REST. */
  const rest = righeDellaStoria(
    [[{ state: "off", attributes: {}, last_updated: "2026-01-01T00:00:00Z" }]],
    "climate.sala",
  );
  assert.equal(rest[0].s, "off");
});

test("gli intervalli si tagliano ai bordi e i buchi non contano", () => {
  const righe = [
    { t: -5 * H, s: "on" }, // da prima del periodo: vale da 0
    { t: 2 * H, s: "unavailable" },
    { t: 3 * H, s: "on" },
    { t: 4 * H, s: "off" },
  ];
  const { veri, noti } = intervalliDove(righe, 0, 10 * H, (r) =>
    r.s === "unavailable" ? null : r.s === "on",
  );
  assert.deepEqual(veri, [
    [0, 2 * H],
    [3 * H, 4 * H],
  ]);
  /* Il buco di un'ora non e' ne' acceso ne' spento. */
  assert.deepEqual(noti, [
    [0, 2 * H],
    [3 * H, 10 * H],
  ]);
});

test("le accensioni: quella gia' accesa a mezzanotte non conta, un minuto di buco non spegne", () => {
  assert.equal(
    accensioni(
      [
        [0, H],
        [2 * H, 3 * H],
        [3 * H + 30_000, 4 * H],
        [5 * H, 6 * H],
      ],
      0,
    ),
    2,
  );
  assert.deepEqual(
    unisci([
      [0, 2],
      [1, 3],
      [5, 6],
    ]),
    [
      [0, 3],
      [5, 6],
    ],
  );
});

test("la media nel tempo pesa ogni lettura quanto dura", () => {
  const righe = [
    { t: 0, a: { current_temperature: 18 } },
    { t: 3 * H, a: { current_temperature: 22 } },
  ];
  /* Tre ore a 18 e una a 22: 19, non 20. */
  const media = mediaNelTempo(righe, 0, 4 * H, (r) => r.a.current_temperature);
  assert.equal(media, 19);
});

test("chi chiede calore: hvac_action, poi la valvola, poi la stanza sotto l'obiettivo", () => {
  const riga = (s, a) => ({ s, a });
  assert.equal(chiedePer("caldo", riga("heat", { hvac_action: "heating" })), true);
  assert.equal(chiedePer("caldo", riga("heat", { hvac_action: "idle" })), false);
  assert.equal(chiedePer("caldo", riga("off", { hvac_action: "heating" })), false);
  assert.equal(chiedePer("caldo", riga("unavailable", {})), null);
  assert.equal(chiedePer("caldo", riga("heat", {}), 40), true);
  assert.equal(
    chiedePer("caldo", riga("heat", { current_temperature: 18, temperature: 20 })),
    true,
  );
  assert.equal(chiedePer("freddo", riga("cool", { hvac_action: "cooling" })), true);
  /* La pompa di calore in freddo non e' accesa per il riscaldamento. */
  assert.equal(accesaPer("caldo", riga("cool", {})), false);
  assert.equal(accesaPer("freddo", riga("heat", {})), false);
  assert.equal(accesaPer("freddo", riga("heat_cool", {})), true);
});

test("il generatore: interruttore, parola della centralina, climate, watt sopra soglia", () => {
  assert.equal(generatoreAcceso("switch.caldaia", { s: "on" }), true);
  assert.equal(generatoreAcceso("binary_sensor.fiamma", { s: "off" }), false);
  assert.equal(generatoreAcceso("sensor.froling", { s: "Heizen" }), true);
  assert.equal(
    generatoreAcceso("climate.caldaia", { s: "heat", a: { hvac_action: "idle" } }),
    false,
  );
  assert.equal(
    generatoreAcceso("sensor.caldaia_w", { s: "8", a: { unit_of_measurement: "W" } }),
    false,
  );
  assert.equal(
    generatoreAcceso("sensor.caldaia_w", { s: "120", a: { unit_of_measurement: "W" } }),
    true,
  );
  assert.equal(
    generatoreAcceso("sensor.modulazione", { s: "0", a: { unit_of_measurement: "%" } }),
    false,
  );
  assert.equal(generatoreAcceso("switch.caldaia", { s: "unavailable" }), null);
});

test("gli impianti: il caldo prende termosifoni e termostati, la pompa sta in tutti e due", () => {
  const unita = [
    { entity: "climate.sala", zone: "caldo" },
    { entity: "climate.pdc", zone: "freddo" },
    { entity: "climate.pdc", zone: "caldo" },
    { entity: "climate.coppia", zone: "termostato" },
    { entity: "climate.split", zone: "freddo" },
  ];
  assert.deepEqual(
    unitaDellImpianto("caldo", unita).map((u) => u.entity),
    ["climate.sala", "climate.pdc", "climate.coppia"],
  );
  assert.deepEqual(
    unitaDellImpianto("freddo", unita).map((u) => u.entity),
    ["climate.pdc", "climate.coppia", "climate.split"],
  );
  assert.deepEqual(impiantiPresenti([{ entity: "climate.split", zone: "freddo" }]), ["freddo"]);
});

const giornata = (inizio) => {
  /* Sala: chiede dalle 6 alle 9 e dalle 18 alle 22, valvola 60% quando chiede. */
  const sala = [
    {
      t: inizio - H,
      s: "heat",
      a: { hvac_action: "idle", current_temperature: 18, temperature: 20, valve_position: 0 },
    },
    {
      t: inizio + 6 * H,
      s: "heat",
      a: { hvac_action: "heating", current_temperature: 18.5, temperature: 21, valve_position: 60 },
    },
    {
      t: inizio + 9 * H,
      s: "heat",
      a: { hvac_action: "idle", current_temperature: 21, temperature: 21, valve_position: 0 },
    },
    {
      t: inizio + 18 * H,
      s: "heat",
      a: { hvac_action: "heating", current_temperature: 19, temperature: 21, valve_position: 60 },
    },
    {
      t: inizio + 22 * H,
      s: "heat",
      a: { hvac_action: "idle", current_temperature: 21, temperature: 21, valve_position: 0 },
    },
  ];
  /* Camera: chiede dalle 7 alle 8, spenta dalle 12; la valvola e' un'entita'. */
  const camera = [
    { t: inizio, s: "heat", a: { hvac_action: "idle", current_temperature: 19, temperature: 19 } },
    {
      t: inizio + 7 * H,
      s: "heat",
      a: { hvac_action: "heating", current_temperature: 18, temperature: 19 },
    },
    {
      t: inizio + 8 * H,
      s: "heat",
      a: { hvac_action: "idle", current_temperature: 19, temperature: 19 },
    },
    { t: inizio + 12 * H, s: "off", a: { current_temperature: 19 } },
  ];
  const valvolaCamera = [
    { t: inizio, s: "0", a: { unit_of_measurement: "%" } },
    { t: inizio + 7 * H, s: "80", a: { unit_of_measurement: "%" } },
    { t: inizio + 8 * H, s: "0", a: { unit_of_measurement: "%" } },
  ];
  /* La caldaia: due accensioni, una di 3 h 10 min e una di 4 h. */
  const caldaia = [
    { t: inizio, s: "off", a: {} },
    { t: inizio + 6 * H - 5 * M, s: "on", a: {} },
    { t: inizio + 9 * H + 5 * M, s: "off", a: {} },
    { t: inizio + 18 * H, s: "on", a: {} },
    { t: inizio + 22 * H, s: "off", a: {} },
  ];
  return { sala, camera, valvolaCamera, caldaia };
};

const UNITA = [
  { entity: "climate.sala", name: "Sala", room: "Sala", zone: "caldo" },
  {
    entity: "climate.camera",
    name: "Camera",
    room: "Camera",
    zone: "caldo",
    valvola: "sensor.valvola_camera",
  },
];

test("il report di un giorno con la caldaia configurata", () => {
  const giorno = new Date(2026, 0, 14);
  const periodo = periodoDelReport("giorno", giorno, new Date(2026, 0, 20));
  const s = giornata(periodo.inizio);
  const report = reportDellImpianto({
    impianto: "caldo",
    unita: UNITA,
    storie: {
      "climate.sala": s.sala,
      "climate.camera": s.camera,
      "sensor.valvola_camera": s.valvolaCamera,
      "switch.caldaia": s.caldaia,
    },
    generatori: [{ nome: "Caldaia", entity: "switch.caldaia" }],
    periodo,
  });
  assert.equal(report.stima, false);
  const [sala, camera] = report.stanze;
  /* Ordinate per ore: la Sala 7 h, la Camera 1 h. */
  assert.equal(sala.nome, "Sala");
  assert.equal(sala.msRichiesta, 7 * H);
  assert.equal(sala.msAccesa, 24 * H);
  assert.equal(camera.msRichiesta, H);
  assert.equal(camera.msAccesa, 12 * H);
  /* La valvola della Sala: 60% per 7 ore su 24. */
  assert.equal(Math.round(sala.valvola * 10) / 10, 17.5);
  assert.equal(sala.valvolaDa, "attributo");
  /* Quella della Camera dall'entita': 80% per un'ora su 24. */
  assert.equal(Math.round(camera.valvola * 100) / 100, 3.33);
  assert.equal(camera.valvolaDa, "entita");
  /* L'obiettivo conta solo da accesa: la Camera spenta non ha 19 per 12 ore. */
  assert.equal(camera.obiettivo, 19);
  /* La caldaia: 3 h 10 + 4 h, due accensioni. */
  assert.equal(report.totali.msGeneratore, 7 * H + 10 * M);
  assert.equal(report.totali.accensioni, 2);
  assert.equal(report.secchielli.length, 24);
  assert.equal(report.secchielli[6].ms, H);
  assert.equal(report.secchielli[5].ms, 5 * M);
  assert.equal(oreScritte(report.totali.msGeneratore), "7 h 10 min");
});

test("senza caldaia il tempo dell'impianto e' la stima: almeno una stanza chiede", () => {
  const periodo = periodoDelReport("giorno", new Date(2026, 0, 14), new Date(2026, 0, 20));
  const s = giornata(periodo.inizio);
  const report = reportDellImpianto({
    impianto: "caldo",
    unita: UNITA,
    storie: { "climate.sala": s.sala, "climate.camera": s.camera },
    generatori: [{ nome: "Caldaia", entity: "switch.caldaia" }],
    periodo,
  });
  assert.equal(report.stima, true);
  /* Sala 6-9 e 18-22, Camera 7-8 dentro la prima: 7 ore, due accensioni. */
  assert.equal(report.totali.msGeneratore, 7 * H);
  assert.equal(report.totali.accensioni, 2);
  assert.equal(report.generatori[0].stima, true);
});

test("una stanza senza dati e' segnata, e il mese conta per giorni", () => {
  const periodo = periodoDelReport("mese", new Date(2026, 0, 1), new Date(2026, 1, 10));
  const s = giornata(new Date(2026, 0, 14).getTime());
  const report = reportDellImpianto({
    impianto: "caldo",
    unita: UNITA,
    storie: { "climate.sala": s.sala },
    periodo,
  });
  const camera = report.stanze.find((x) => x.entity === "climate.camera");
  assert.equal(camera.copertura, 0);
  assert.equal(camera.datiScarsi, true);
  assert.equal(report.secchielli.length, 31);
  /* Il 14 gennaio la Sala ha chiesto 7 ore, e dal 15 resta «idle». */
  assert.equal(report.secchielli[13].ms, 7 * H);
  assert.equal(report.secchielli[14].ms, 0);
});

test("i secchielli seguono il calendario locale", () => {
  const periodo = periodoDelReport("giorno", new Date(2026, 2, 29), new Date(2026, 3, 2));
  const somma = periodo.secchielli.reduce((s, x) => s + (x.fine - x.inizio), 0);
  assert.equal(somma, periodo.prossimo - periodo.inizio);
  assert.deepEqual(
    durataNeiSecchielli(
      [[periodo.inizio, periodo.inizio + 90 * M]],
      periodo.secchielli.slice(0, 2),
    ),
    [H, 30 * M],
  );
});
