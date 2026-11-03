/* I consumi dello split, per le ore dei mesi passati.
 *
 * «Continua a non funzionare, i dati storici non mi da il valore.» Quattro
 * split senza valvola e senza presa nella scheda: il report di giugno diceva
 * «Impianto 0 min» e barre vuote, come se non avessero mai lavorato. Quello
 * che deve restare vero:
 *
 *  - quando nessuna fonte sa le ore, il report dice «non noto» — mai zero —
 *    e le colonne del grafico sono segnate ignote;
 *  - i watt che lo split pubblica sul suo stesso dispositivo si trovano da
 *    soli (prima la potenza, poi l'energia; mai quelli di un altro
 *    dispositivo, mai senza statistiche), e la presa scritta nella scheda
 *    vince sempre;
 *  - dalla potenza escono ore e kWh, dall'energia le ore con consumo e kWh,
 *    segnati «dispositivo»;
 *  - nella storia, uno split senza `hvac_action` conta le ore coi suoi watt.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  conIlConsumoTrovato,
  consumoDelDispositivo,
  tipoDelConsumo,
} from "../src/core/consumo-trovato-del-clima.js";
import { periodoDelReport, stanzaNelPeriodo } from "../src/core/report-del-clima.js";
import {
  SOGLIA_WH_DELL_ORA,
  giorniDelPeriodo,
  reportDaiGiorni,
  riassuntoDalleStatistiche,
  riassuntoDelGiorno,
} from "../src/core/storico-del-clima.js";

const H = 3_600_000;
/* Giugno 2026: tutto dalle statistiche, la storia non c'e' piu'. */
const GIUGNO = new Date(2026, 5, 15);
const ADESSO = new Date(2026, 10, 3, 12).getTime();

const stato = (unita, classe, statistica, nome = "") => ({
  state: "0",
  attributes: {
    unit_of_measurement: unita,
    device_class: classe,
    state_class: statistica,
    friendly_name: nome,
  },
});

const STATI = {
  "sensor.split_camera_power": stato("W", "power", "measurement", "Split Camera Power"),
  "sensor.split_camera_energy": stato("kWh", "energy", "total_increasing", "Split Camera Energy"),
  "sensor.split_camera_temperatura": stato("°C", "temperature", "measurement"),
  "sensor.split_salone_energy": stato("kWh", "energy", "total_increasing", "Split Salone Energy"),
  "sensor.split_salone_costo": stato("EUR", "monetary", "total_increasing", "Split Salone Costo"),
  "sensor.split_cucina_power": stato("W", "power", "", "Split Cucina Power"),
  "sensor.lavatrice_power": stato("W", "power", "measurement", "Lavatrice Power"),
};
const DI = {
  "climate.camera": "dev-camera",
  "sensor.split_camera_power": "dev-camera",
  "sensor.split_camera_energy": "dev-camera",
  "sensor.split_camera_temperatura": "dev-camera",
  "climate.salone": "dev-salone",
  "sensor.split_salone_energy": "dev-salone",
  "sensor.split_salone_costo": "dev-salone",
  "climate.cucina": "dev-cucina",
  /* Senza state_class: niente statistiche, non serve. */
  "sensor.split_cucina_power": "dev-cucina",
  /* Un altro dispositivo: mai suo, anche se e' nella stessa stanza. */
  "sensor.lavatrice_power": "dev-lavatrice",
};
const leggi = (id) => STATI[id] || null;

test("il consumo dello split si trova sul suo dispositivo: prima la potenza, poi l'energia", () => {
  assert.equal(tipoDelConsumo(STATI["sensor.split_camera_power"]), "potenza");
  assert.equal(tipoDelConsumo(STATI["sensor.split_camera_energy"]), "energia");
  assert.equal(tipoDelConsumo(STATI["sensor.split_cucina_power"]), "");
  assert.deepEqual(consumoDelDispositivo("climate.camera", { di: DI, stato: leggi }), {
    entity: "sensor.split_camera_power",
    tipo: "potenza",
  });
  assert.deepEqual(consumoDelDispositivo("climate.salone", { di: DI, stato: leggi }), {
    entity: "sensor.split_salone_energy",
    tipo: "energia",
  });
  /* Un sensore senza statistiche non e' un consumo; uno di un altro
   * dispositivo nemmeno; un climatizzatore senza dispositivo non ha niente. */
  assert.equal(consumoDelDispositivo("climate.cucina", { di: DI, stato: leggi }), null);
  assert.equal(consumoDelDispositivo("climate.studio", { di: DI, stato: leggi }), null);
});

test("la presa scritta nella scheda vince su quella trovata", () => {
  const unita = conIlConsumoTrovato(
    [
      { entity: "climate.camera", zone: "freddo" },
      { entity: "climate.salone", zone: "freddo", consumo: "sensor.presa_salone" },
      { entity: "climate.cucina", zone: "freddo" },
    ],
    { di: DI, stato: leggi },
  );
  assert.equal(unita[0].consumo, "sensor.split_camera_power");
  assert.equal(unita[0].consumoTrovato, true);
  assert.equal(unita[1].consumo, "sensor.presa_salone");
  assert.equal(unita[1].consumoTrovato, undefined);
  assert.equal(unita[2].consumo, undefined);
});

/* Le statistiche di un mese: ogni giorno la camera raffresca dalle 14 alle
 * 17, il salone dalle 20 alle 22. */
function statisticheDiGiugno({ potenza = true, energia = true } = {}) {
  const serie = {
    "sensor.t_camera": [],
    "sensor.t_salone": [],
    "sensor.split_camera_power": [],
    "sensor.split_salone_energy": [],
  };
  const inizio = new Date(2026, 5, 1).getTime();
  const fine = new Date(2026, 6, 1).getTime();
  let totale = 0;
  for (let t = inizio; t < fine; t += H) {
    const ora = new Date(t).getHours();
    serie["sensor.t_camera"].push({ t, mean: 26.6, max: 27, min: 26, change: null, state: null });
    serie["sensor.t_salone"].push({ t, mean: 27.4, max: 28, min: 27, change: null, state: null });
    if (potenza) {
      const lavora = ora >= 14 && ora < 17;
      serie["sensor.split_camera_power"].push({
        t,
        mean: lavora ? 900 : 4,
        max: lavora ? 950 : 5,
        min: 3,
        change: null,
        state: null,
      });
    }
    if (energia) {
      const lavora = ora >= 20 && ora < 22;
      const kwh = lavora ? 0.8 : 0.005;
      totale += kwh;
      serie["sensor.split_salone_energy"].push({
        t,
        mean: null,
        max: null,
        min: null,
        change: kwh,
        state: totale,
      });
    }
  }
  return serie;
}

const UNITA_DI = {
  "sensor.split_camera_power": "W",
  "sensor.split_salone_energy": "kWh",
  "sensor.t_camera": "°C",
  "sensor.t_salone": "°C",
};

function reportDiGiugno(unita, serie) {
  const periodo = periodoDelReport("mese", GIUGNO, new Date(ADESSO));
  const giorni = giorniDelPeriodo(periodo).map((g) => ({
    ...g,
    record: riassuntoDalleStatistiche({
      impianto: "freddo",
      unita,
      serie,
      unitaDi: (id) => UNITA_DI[id] || "",
      giorno: g,
      adesso: ADESSO,
    }),
  }));
  return reportDaiGiorni({ impianto: "freddo", unita, periodo, giorni });
}

test("senza nessun consumo il report dice «non noto», non zero", () => {
  const unita = [
    { entity: "climate.camera", name: "Camera", zone: "freddo", temperatura: "sensor.t_camera" },
    { entity: "climate.salone", name: "Salone", zone: "freddo", temperatura: "sensor.t_salone" },
  ];
  const report = reportDiGiugno(unita, statisticheDiGiugno({ potenza: false, energia: false }));
  assert.equal(report.fonti.statistiche, 30);
  assert.equal(report.totali.msGeneratore, null);
  assert.equal(report.totali.msRichiesta, null);
  assert.equal(report.generatori[0].ms, null);
  /* Nessuna colonna e' «zero»: sono tutte ignote. */
  assert.ok(report.secchielli.every((s) => s.noto === false));
  /* La temperatura si sa lo stesso. */
  assert.ok(Math.abs(report.totali.ambiente - 27) < 0.01);
  for (const s of report.stanze) assert.equal(s.msRichiesta, null);
});

test("coi consumi trovati: potenza → ore e kWh, energia → ore con consumo e kWh", () => {
  const unita = conIlConsumoTrovato(
    [
      { entity: "climate.camera", name: "Camera", zone: "freddo", temperatura: "sensor.t_camera" },
      { entity: "climate.salone", name: "Salone", zone: "freddo", temperatura: "sensor.t_salone" },
    ],
    { di: DI, stato: leggi },
  );
  const report = reportDiGiugno(unita, statisticheDiGiugno());
  const camera = report.stanze.find((s) => s.entity === "climate.camera");
  const salone = report.stanze.find((s) => s.entity === "climate.salone");
  /* Tre ore al giorno per trenta giorni; la quota d'ora e' media/massimo. */
  assert.ok(Math.abs(camera.msRichiesta / H - 90 * (900 / 950)) < 1);
  assert.deepEqual(camera.stimaDa, ["dispositivo"]);
  /* Ogni giorno si arrotonda al centesimo: su un mese, qualche decimo. */
  assert.ok(Math.abs(camera.kwh - 30 * (3 * 0.9 + 21 * 0.004)) < 0.3);
  /* Due ore al giorno sopra la soglia d'ora; il resto e' attesa. */
  assert.ok(0.005 * 1000 < SOGLIA_WH_DELL_ORA);
  assert.equal(salone.msRichiesta, 60 * H);
  assert.equal(salone.msAccesa, 60 * H);
  assert.deepEqual(salone.stimaDa, ["dispositivo"]);
  assert.ok(Math.abs(salone.kwh - 30 * (2 * 0.8 + 22 * 0.005)) < 0.01);
  assert.ok(report.totali.msGeneratore > 0);
  assert.ok(report.secchielli.every((s) => s.noto === true));
});

test("nella storia uno split senza hvac_action conta le ore coi suoi watt", () => {
  const giorno = new Date(2026, 9, 30).getTime();
  const periodo = periodoDelReport("giorno", new Date(giorno), new Date(ADESSO));
  const storie = {
    /* Acceso in cool tutto il pomeriggio, ma senza dire quando lavora. */
    "climate.camera": [
      { t: giorno, s: "off", a: { current_temperature: 26 } },
      { t: giorno + 13 * H, s: "cool", a: { current_temperature: 26, temperature: 27 } },
      { t: giorno + 19 * H, s: "off", a: { current_temperature: 25 } },
    ],
    "sensor.split_camera_power": [
      { t: giorno, s: "4", a: { unit_of_measurement: "W" } },
      { t: giorno + 14 * H, s: "900", a: { unit_of_measurement: "W" } },
      { t: giorno + 16 * H, s: "5", a: { unit_of_measurement: "W" } },
    ],
  };
  const u = {
    entity: "climate.camera",
    name: "Camera",
    zone: "freddo",
    consumo: "sensor.split_camera_power",
    consumoTrovato: true,
  };
  const s = stanzaNelPeriodo("freddo", u, storie, periodo);
  /* Senza i watt: l'ambiente (26) e' sotto l'obiettivo (27), quindi «non
   * chiede» — zero. Coi watt: due ore vere. */
  assert.equal(s.msRichiesta, 2 * H);
  assert.equal(s.richiestaDa, "dispositivo");
  assert.ok(Math.abs(s.kwh - 1.9) < 0.01);
  const record = riassuntoDelGiorno({
    impianto: "freddo",
    unita: [u],
    storie,
    giorno: { inizio: giorno, fine: giorno + 24 * H },
    adesso: ADESSO,
  });
  assert.equal(record.stanze["climate.camera"].r, 120);
  assert.equal(record.stanze["climate.camera"].sv, "dispositivo");
  assert.equal(record.stima.ms, 120);
  /* Uno split che dice hvac_action resta com'era: i watt non servono. */
  const conAzione = {
    ...storie,
    "climate.camera": storie["climate.camera"].map((r) =>
      r.s === "cool" ? { ...r, a: { ...r.a, hvac_action: "cooling" } } : r,
    ),
  };
  const altra = stanzaNelPeriodo("freddo", u, conAzione, periodo);
  assert.equal(altra.msRichiesta, 6 * H);
  assert.equal(altra.richiestaDa, null);
});
