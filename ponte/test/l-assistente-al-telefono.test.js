/* L'assistente al telefono: le dodici regole, una per una.
 *
 * La casa e' finta — degli stati scritti a mano, le aree come le darebbero i
 * registri, la configurazione della plancia — e l'orologio si sposta a
 * comando. Per ogni regola: parla quando deve, coi tasti giusti; tace quando
 * non deve; e lo dice una volta sola. In fondo il tasto «Va bene così», che
 * zittisce quella cosa per dodici ore su quel telefono.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Sentinella } from "../src/sentinella.js";
import { regoleDellAssistente } from "../src/l-assistente-al-telefono.js";
import { Dispositivi } from "../src/dispositivi.js";
import { Notifiche } from "../src/notifiche.js";
import { apriLaSpinta } from "../src/spinta.js";

const MINUTO = 60 * 1000;
const ORA = 60 * MINUTO;

/* Un giorno qualunque, all'ora che serve, nell'ora di questa macchina. */
const alle = (ore, minuti = 0, giorno = 19) => new Date(2026, 9, giorno, ore, minuti).getTime();

/* Uno stato cambiato `fa` millisecondi prima di `ora`. */
const stato = (entity_id, state, attributes = {}, fa = 0, ora = alle(12)) => ({
  entity_id,
  state,
  attributes,
  last_changed: new Date(ora - fa).toISOString(),
});

function unaCasa(stati, { ora = alle(12), valori = {}, aree = {} } = {}) {
  const orologio = { ora };
  const dette = [];
  const sentinella = new Sentinella({ adesso: () => orologio.ora, quando: (e) => dette.push(e) });
  sentinella.valori = () => valori;
  sentinella.aree = new Map(Object.entries(aree));
  sentinella.carica(typeof stati === "function" ? stati(ora) : stati);
  const dell = (prefisso) =>
    dette.filter((e) => e.tipo === "suggerimenti" && e.chiave.startsWith(prefisso));
  const battito = () => sentinella.battito();
  const passa = (ms) => {
    orologio.ora += ms;
    sentinella.battito();
  };
  return { sentinella, dette, dell, orologio, battito, passa };
}

const servizi = (evento) => evento.azioni.map((a) => a.servizio || null);
const tasti = (evento) => evento.azioni.map((a) => a.id);

/* ─── 1. La serratura ────────────────────────────────────────────────────── */

test("serrature: aperta con la casa vuota da 15 minuti, «Chiudi a chiave» la chiude, una volta", () => {
  const ora = alle(15);
  const casa = unaCasa(
    [
      stato("person.uno", "not_home", { friendly_name: "Persona 1" }, 15 * MINUTO, ora),
      stato("lock.ingresso", "unlocked", { friendly_name: "Ingresso" }, 12 * MINUTO, ora),
      stato("lock.cantina", "unlocked", { friendly_name: "Cantina" }, 3 * MINUTO, ora),
    ],
    { ora },
  );
  casa.battito();
  casa.passa(MINUTO);
  const dette = casa.dell("suggerimenti:serrature:");
  assert.equal(dette.length, 1, "una volta, e solo quella aperta da dieci minuti");
  const [e] = dette;
  assert.equal(e.chiave, "suggerimenti:serrature:lock.ingresso");
  assert.equal(e.importante, true);
  assert.equal(e.parole.it.titolo, "🔓 Ingresso non chiusa a chiave");
  assert.equal(e.parole.it.testo, "Nessuno in casa da 15 min. La chiudo?");
  assert.deepEqual(servizi(e)[0], { dominio: "lock", servizio: "lock", entita: ["lock.ingresso"] });
  assert.deepEqual(tasti(e), ["chiudi", "piu-tardi"]);
});

test("serrature: con la gente in casa di giorno tace; di notte, quando la casa dorme, parla", () => {
  const giorno = unaCasa([
    stato("person.uno", "home", {}, ORA),
    stato("lock.ingresso", "unlocked", {}, ORA),
  ]);
  giorno.battito();
  giorno.passa(30 * MINUTO);
  assert.equal(giorno.dell("suggerimenti:serrature:").length, 0);

  const ora = alle(23, 30);
  const notte = unaCasa(
    [
      stato("person.uno", "home", {}, 2 * ORA, ora),
      stato("lock.ingresso", "unlocked", {}, ORA, ora),
    ],
    { ora },
  );
  notte.battito();
  assert.equal(notte.dell("suggerimenti:serrature:").length, 0, "la casa non dorme ancora");
  notte.passa(21 * MINUTO);
  const [e] = notte.dell("suggerimenti:serrature:");
  assert.equal(e.parole.it.testo, "È notte. La chiudo?");
  assert.equal(e.parole.en.testo, "It's night. Lock it?");
});

/* ─── 2. La finestra e il clima ──────────────────────────────────────────── */

test("finestra-clima: finestra aperta da 5 minuti nella stessa area del riscaldamento acceso", () => {
  const ora = alle(9);
  const stati = [
    stato("climate.sala", "heat", { friendly_name: "Sala", current_temperature: 21 }, ORA, ora),
    stato("binary_sensor.finestra_sala", "on", { device_class: "window" }, 6 * MINUTO, ora),
  ];
  const casa = unaCasa(stati, {
    ora,
    aree: { "climate.sala": "Sala", "binary_sensor.finestra_sala": "Sala" },
  });
  casa.battito();
  casa.passa(MINUTO);
  const dette = casa.dell("suggerimenti:finestra-clima:");
  assert.equal(dette.length, 1);
  const [e] = dette;
  assert.equal(e.importante, true);
  assert.equal(e.parole.it.titolo, "🔥 Finestra aperta col riscaldamento acceso");
  assert.equal(e.parole.it.testo, "Sala · 21 °C. Spengo il clima finché è aperta?");
  assert.deepEqual(servizi(e)[0], {
    dominio: "climate",
    servizio: "turn_off",
    entita: ["climate.sala"],
  });
  assert.equal(e.azioni[1].basta, true);

  /* Senza aree non si sa che sono nella stessa stanza; in un'altra area
   * nemmeno. */
  const senza = unaCasa(stati, { ora });
  senza.battito();
  assert.equal(senza.dell("suggerimenti:finestra-clima:").length, 0);
  const altrove = unaCasa(stati, {
    ora,
    aree: { "climate.sala": "Sala", "binary_sensor.finestra_sala": "Camera" },
  });
  altrove.battito();
  assert.equal(altrove.dell("suggerimenti:finestra-clima:").length, 0);
});

test("finestra-clima: col condizionatore e' «clima», e una finestra appena aperta non conta", () => {
  const ora = alle(15);
  const aree = { "climate.camera": "Camera", "binary_sensor.finestra_camera": "Camera" };
  const casa = unaCasa(
    [
      stato("climate.camera", "cool", {}, ORA, ora),
      stato("binary_sensor.finestra_camera", "on", { device_class: "window" }, 2 * MINUTO, ora),
    ],
    { ora, aree },
  );
  casa.battito();
  assert.equal(casa.dell("suggerimenti:finestra-clima:").length, 0, "aperta da due minuti");
  casa.passa(4 * MINUTO);
  const [e] = casa.dell("suggerimenti:finestra-clima:");
  assert.equal(e.parole.it.titolo, "❄️ Finestra aperta col clima acceso");
  assert.equal(e.parole.it.testo, "Camera. Spengo il clima finché è aperta?");
});

/* ─── 3. Le luci di notte ────────────────────────────────────────────────── */

test("notte-luci: di notte le luci accese da un'ora dove nessuno si muove", () => {
  const ora = alle(23, 30);
  const casa = unaCasa(
    [
      stato("person.uno", "home", {}, 5 * ORA, ora),
      stato("light.taverna", "on", { friendly_name: "Taverna" }, 70 * MINUTO, ora),
      stato("binary_sensor.pir_taverna", "off", { device_class: "motion" }, 2 * ORA, ora),
      stato("light.studio", "on", { friendly_name: "Studio" }, 2 * ORA, ora),
      /* In cucina qualcuno si e' mosso dieci minuti fa: c'e' qualcuno. */
      stato("light.cucina", "on", { friendly_name: "Cucina" }, 2 * ORA, ora),
      stato("binary_sensor.pir_cucina", "off", { device_class: "motion" }, 10 * MINUTO, ora),
      /* Accesa da mezz'ora: e' presto per dirlo. */
      stato("light.bagno", "on", { friendly_name: "Bagno" }, 30 * MINUTO, ora),
    ],
    {
      ora,
      aree: {
        "light.taverna": "Taverna",
        "binary_sensor.pir_taverna": "Taverna",
        "light.cucina": "Cucina",
        "binary_sensor.pir_cucina": "Cucina",
      },
    },
  );
  casa.battito();
  casa.passa(MINUTO);
  const dette = casa.dell("suggerimenti:notte-luci");
  assert.equal(dette.length, 1);
  const [e] = dette;
  assert.equal(e.importante, false);
  assert.equal(e.parole.it.titolo, "🌙 Luci accese di notte dove non c'è nessuno");
  assert.equal(e.parole.it.testo, "Taverna, Studio · da 1 h. Le spengo?");
  assert.deepEqual(servizi(e)[0], {
    dominio: "light",
    servizio: "turn_off",
    entita: ["light.taverna", "light.studio"],
  });
  assert.deepEqual(e.azioni[1].resta, ["light.taverna", "light.studio"]);
});

test("notte-luci: di giorno tace, e l'acquario resta acceso senza che lo si dica", () => {
  const giorno = unaCasa([
    stato("person.uno", "home", {}, 5 * ORA),
    stato("light.studio", "on", { friendly_name: "Studio" }, 3 * ORA),
  ]);
  giorno.battito();
  assert.equal(giorno.dell("suggerimenti:notte-luci").length, 0);
  const ora = alle(1);
  const notte = unaCasa(
    [
      stato("person.uno", "home", {}, 5 * ORA, ora),
      stato("light.acquario", "on", { friendly_name: "Acquario" }, 3 * ORA, ora),
    ],
    { ora },
  );
  notte.battito();
  assert.equal(notte.dell("suggerimenti:notte-luci").length, 0);
});

/* ─── 4. Il sole e la lavatrice ──────────────────────────────────────────── */

const ENERGIA = {
  "dm.energy_potenza_fotovoltaico": "sensor.pv",
  "dm.energy_potenza_consumo_casa": "sensor.casa",
  "dm.energy_potenza_scambio_rete": "sensor.rete",
};
const watt = (id, valore, ora) =>
  stato(id, String(valore), { unit_of_measurement: "W", device_class: "power" }, ORA, ora);
const colSole = (ora) => [
  watt("sensor.pv", 4500, ora),
  watt("sensor.casa", 1300, ora),
  watt("sensor.rete", -3200, ora),
];

test("sole-elettrodomestico: un quarto d'ora di sole che avanza e la lavatrice ferma, una volta al giorno", () => {
  const ora = alle(11);
  const valori = {
    cd_entity_overrides: ENERGIA,
    dm_dashboard_state: {
      sections: {
        appliances: [
          {
            name: "Lavatrice",
            type: "washer",
            power_entity: "sensor.lavatrice_power",
            comandi: ["button.lavatrice_start", "button.lavatrice_stop"],
          },
        ],
      },
    },
  };
  const casa = unaCasa(
    [
      ...colSole(ora),
      watt("sensor.lavatrice_power", 2, ora),
      stato("button.lavatrice_start", "unknown", {}, ORA, ora),
      stato("button.lavatrice_stop", "unknown", {}, ORA, ora),
    ],
    { ora, valori },
  );
  casa.battito();
  casa.passa(10 * MINUTO);
  assert.equal(casa.dell("suggerimenti:sole-elettrodomestico").length, 0, "solo dieci minuti");
  casa.passa(6 * MINUTO);
  casa.passa(MINUTO);
  const dette = casa.dell("suggerimenti:sole-elettrodomestico");
  assert.equal(dette.length, 1);
  const [e] = dette;
  assert.equal(e.parole.it.titolo, "☀️ C'è sole: è il momento della lavatrice");
  assert.equal(e.parole.it.testo, "3,2 kW dai pannelli. La avvio?");
  assert.deepEqual(servizi(e)[0], {
    dominio: "button",
    servizio: "press",
    entita: ["button.lavatrice_start"],
  });
  assert.deepEqual(tasti(e), ["avvia", "piu-tardi"]);
  /* Il sole va e torna: oggi non si ridice. */
  casa.sentinella.cambia("sensor.rete", watt("sensor.rete", 200, casa.orologio.ora));
  casa.sentinella.cambia("sensor.pv", watt("sensor.pv", 1000, casa.orologio.ora));
  casa.passa(MINUTO);
  casa.sentinella.cambia("sensor.rete", watt("sensor.rete", -3200, casa.orologio.ora));
  casa.sentinella.cambia("sensor.pv", watt("sensor.pv", 4500, casa.orologio.ora));
  casa.passa(20 * MINUTO);
  assert.equal(casa.dell("suggerimenti:sole-elettrodomestico").length, 1);
});

test("sole-elettrodomestico: senza un comando di avvio dice «Guarda»; il pomeriggio tardi e con la lavatrice che gira tace", () => {
  const appliances = () => ({
    cd_entity_overrides: ENERGIA,
    dm_dashboard_state: {
      sections: { appliances: [{ name: "Lavastoviglie", power_entity: "sensor.lsv_power" }] },
    },
  });
  const ora = alle(10);
  const senza = unaCasa([...colSole(ora), watt("sensor.lsv_power", 0, ora)], {
    ora,
    valori: appliances(),
  });
  senza.battito();
  senza.passa(16 * MINUTO);
  const [e] = senza.dell("suggerimenti:sole-elettrodomestico");
  assert.equal(e.parole.it.titolo, "☀️ C'è sole: è il momento della lavastoviglie");
  assert.equal(e.parole.it.testo, "3,2 kW dai pannelli: è il momento buono.");
  assert.deepEqual(tasti(e), ["guarda", "piu-tardi"]);

  const tardi = alle(16, 30);
  const sera = unaCasa([...colSole(tardi), watt("sensor.lsv_power", 0, tardi)], {
    ora: tardi,
    valori: appliances(),
  });
  sera.battito();
  sera.passa(20 * MINUTO);
  assert.equal(sera.dell("suggerimenti:sole-elettrodomestico").length, 0);

  const gira = unaCasa([...colSole(ora), watt("sensor.lsv_power", 1900, ora)], {
    ora,
    valori: appliances(),
  });
  gira.battito();
  gira.passa(20 * MINUTO);
  assert.equal(gira.dell("suggerimenti:sole-elettrodomestico").length, 0);
});

/* ─── 5. Il sole e l'auto ────────────────────────────────────────────────── */

const EVCC = { ...ENERGIA, "dm.ev_modalita_ricarica_evcc": "select.evcc_garage_mode" };
const modo = (valore, ora) =>
  stato("select.evcc_garage_mode", valore, { options: ["off", "pv", "minpv", "now"] }, ORA, ora);
const cavo = (valore, ora) =>
  stato("binary_sensor.evcc_garage_connected", valore, { device_class: "plug" }, ORA, ora);

test("sole-auto: l'auto attaccata che non carica, col sole: «Ricarica col sole» mette evcc sul solare", () => {
  const ora = alle(12);
  const casa = unaCasa([...colSole(ora), modo("off", ora), cavo("on", ora)], {
    ora,
    valori: { cd_entity_overrides: EVCC },
  });
  casa.battito();
  casa.passa(5 * MINUTO);
  assert.equal(casa.dell("suggerimenti:sole-auto").length, 0, "cinque minuti non bastano");
  casa.passa(6 * MINUTO);
  casa.passa(MINUTO);
  const dette = casa.dell("suggerimenti:sole-auto");
  assert.equal(dette.length, 1);
  const [e] = dette;
  assert.equal(e.parole.it.testo, "Avanzano 3,2 kW dai pannelli. La carico col sole?");
  assert.equal(e.azioni[0].parole.it, "Ricarica col sole");
  assert.deepEqual(servizi(e)[0], {
    dominio: "select",
    servizio: "select_option",
    entita: ["select.evcc_garage_mode"],
    dati: { option: "pv" },
  });
  assert.equal(e.azioni[1].piuTardi, true);
  /* Staccata e riattaccata: e' un'altra volta, e si ridice. */
  casa.sentinella.cambia("binary_sensor.evcc_garage_connected", cavo("off", casa.orologio.ora));
  casa.passa(MINUTO);
  casa.sentinella.cambia("binary_sensor.evcc_garage_connected", cavo("on", casa.orologio.ora));
  casa.passa(MINUTO);
  assert.equal(casa.dell("suggerimenti:sole-auto").length, 2);
});

test("sole-auto: con evcc gia' sul solare, staccata, o senza nessuna auto, tace", () => {
  const ora = alle(12);
  for (const stati of [
    [...colSole(ora), modo("pv", ora), cavo("on", ora)],
    [...colSole(ora), modo("off", ora), cavo("off", ora)],
    colSole(ora),
  ]) {
    const casa = unaCasa(stati, { ora, valori: { cd_entity_overrides: EVCC } });
    casa.battito();
    casa.passa(15 * MINUTO);
    assert.equal(casa.dell("suggerimenti:sole-auto").length, 0);
  }
});

/* ─── 6. La rete che tira troppo ─────────────────────────────────────────── */

test("rete-alta: due minuti oltre il 90% di tre chilowatt, i due carichi piu' grossi e «Pausa»", () => {
  const ora = alle(19);
  const valori = {
    cd_entity_overrides: ENERGIA,
    dm_dashboard_state: {
      sections: {
        loads: [{ name: "Forno", power: "sensor.forno_power", switch: "switch.forno_presa" }],
      },
    },
  };
  const casa = unaCasa(
    [
      watt("sensor.rete", 2900, ora),
      watt("sensor.forno_power", 2000, ora),
      watt("sensor.lavatrice_power", 900, ora),
      watt("sensor.frigo_power", 80, ora),
      stato("switch.forno_presa", "on", {}, ORA, ora),
    ],
    { ora, valori },
  );
  casa.battito();
  casa.passa(MINUTO);
  assert.equal(casa.dell("suggerimenti:rete-alta").length, 0, "un minuto e' un picco");
  casa.passa(MINUTO + 1000);
  casa.passa(MINUTO);
  const dette = casa.dell("suggerimenti:rete-alta");
  assert.equal(dette.length, 1);
  const [e] = dette;
  assert.equal(e.importante, true);
  assert.equal(e.urgenza, "normale");
  assert.equal(e.parole.it.titolo, "⚡ Dalla rete 2,9 kW: vicino al limite");
  assert.equal(e.parole.it.testo, "Il limite è 3,0 kW. Accesi: Forno 2,0 kW, Lavatrice 0,9 kW.");
  assert.equal(e.azioni[0].parole.it, "Pausa Forno");
  assert.deepEqual(servizi(e)[0], {
    dominio: "switch",
    servizio: "turn_off",
    entita: ["switch.forno_presa"],
  });
  assert.equal(e.azioni[1].basta, true);
});

test("rete-alta: con la soglia della plancia piu' alta, o la rete bassa, tace", () => {
  const ora = alle(19);
  const alta = unaCasa([watt("sensor.rete", 2900, ora)], {
    ora,
    valori: { cd_entity_overrides: ENERGIA, cd_energia_soglia: JSON.stringify({ rossa: 4500 }) },
  });
  alta.battito();
  alta.passa(5 * MINUTO);
  assert.equal(alta.dell("suggerimenti:rete-alta").length, 0);
  const bassa = unaCasa([watt("sensor.rete", 1200, ora)], {
    ora,
    valori: { cd_entity_overrides: ENERGIA },
  });
  bassa.battito();
  bassa.passa(5 * MINUTO);
  assert.equal(bassa.dell("suggerimenti:rete-alta").length, 0);
});

/* ─── 7. I rifiuti ───────────────────────────────────────────────────────── */

const PLASTICA = { cd_rifiuti: { righe: [{ materiale: "plastica", entity: "sensor.plastica" }] } };

test("rifiuti: la sera prima si dice, e la mattina dopo non si ridice", () => {
  const sera = alle(20);
  const casa = unaCasa([stato("sensor.plastica", "domani", {}, ORA, sera)], {
    ora: sera,
    valori: PLASTICA,
  });
  casa.battito();
  casa.passa(MINUTO);
  const dette = casa.dell("suggerimenti:rifiuti:");
  assert.equal(dette.length, 1);
  const [e] = dette;
  assert.equal(e.parole.it.titolo, "🗑️ Domani ritirano la plastica");
  assert.equal(e.parole.it.testo, "Stasera è da mettere fuori.");
  assert.deepEqual(
    e.azioni.map((a) => [a.parole.it, Boolean(a.basta), Boolean(a.piuTardi)]),
    [
      ["Fatto", true, false],
      ["Ricordamelo dopo", false, true],
    ],
  );
  /* La mattina dopo il sensore dice «oggi»: la sera prima l'aveva gia' detto. */
  casa.orologio.ora = alle(7, 0, 20);
  casa.sentinella.cambia(
    "sensor.plastica",
    stato("sensor.plastica", "oggi", {}, 0, alle(7, 0, 20)),
  );
  casa.passa(MINUTO);
  assert.equal(casa.dell("suggerimenti:rifiuti:").length, 1);
});

test("rifiuti: la mattina stessa, se la sera prima non si e' detto; di pomeriggio mai", () => {
  const mattina = alle(7);
  const casa = unaCasa([stato("sensor.plastica", "oggi", {}, ORA, mattina)], {
    ora: mattina,
    valori: PLASTICA,
  });
  casa.battito();
  const [e] = casa.dell("suggerimenti:rifiuti:");
  assert.equal(e.parole.it.titolo, "🗑️ Oggi ritirano la plastica");
  assert.equal(e.parole.it.testo, "È da mettere fuori stamattina.");

  const pomeriggio = alle(15);
  const tace = unaCasa([stato("sensor.plastica", "domani", {}, ORA, pomeriggio)], {
    ora: pomeriggio,
    valori: PLASTICA,
  });
  tace.battito();
  assert.equal(tace.dell("suggerimenti:rifiuti:").length, 0);
});

test("rifiuti: senza la plancia, dai sensori di Waste Collection Schedule", () => {
  const sera = alle(19, 30);
  const casa = unaCasa(
    [
      stato(
        "sensor.waste_collection_schedule_carta",
        "domani",
        { daysTo: 1, types: ["Carta"], friendly_name: "Carta" },
        ORA,
        sera,
      ),
    ],
    { ora: sera },
  );
  casa.battito();
  const [e] = casa.dell("suggerimenti:rifiuti:");
  assert.equal(e.parole.it.titolo, "🗑️ Domani ritirano la carta");
  assert.equal(e.parole.en.titolo, "🗑️ Paper collection tomorrow");
});

/* ─── 8. Un appuntamento ─────────────────────────────────────────────────── */

const calendario = (attributi, ora) =>
  stato(
    "calendar.casa",
    "off",
    { message: "Dentista", start_time: "2026-10-19 18:30:00", all_day: false, ...attributi },
    ORA,
    ora,
  );

test("appuntamento: fra mezz'ora, con l'ora e il posto, una volta", () => {
  const ora = alle(18);
  const casa = unaCasa([calendario({ location: "Studio" }, ora)], { ora });
  casa.battito();
  casa.passa(MINUTO);
  const dette = casa.dell("suggerimenti:appuntamento:");
  assert.equal(dette.length, 1);
  const [e] = dette;
  assert.equal(e.parole.it.titolo, "📅 Fra 30 minuti: Dentista");
  assert.equal(e.parole.it.testo, "alle 18:30 · Studio");
  assert.deepEqual(tasti(e), ["guarda", "basta"]);
  assert.equal(e.azioni[1].parole.it, "Ok");
});

test("appuntamento: troppo presto, o di tutto il giorno, tace", () => {
  const presto = unaCasa([calendario({}, alle(17))], { ora: alle(17) });
  presto.battito();
  assert.equal(presto.dell("suggerimenti:appuntamento:").length, 0);
  const tutto = unaCasa([calendario({ all_day: true }, alle(18))], { ora: alle(18) });
  tutto.battito();
  assert.equal(tutto.dell("suggerimenti:appuntamento:").length, 0);
});

/* ─── 9. Il comfort ──────────────────────────────────────────────────────── */

const gradi = (id, valore, ora) =>
  stato(id, String(valore), { device_class: "temperature", unit_of_measurement: "°C" }, ORA, ora);

test("comfort: mezz'ora a 28 gradi con qualcuno in casa, e il clima spento li': «Accendi il clima»", () => {
  const ora = alle(15);
  const casa = unaCasa(
    [
      stato("person.uno", "home", {}, 5 * ORA, ora),
      gradi("sensor.temperatura_camera", 28.4, ora),
      stato("climate.camera", "off", {}, ORA, ora),
      /* Fuori fa caldo, ed e' l'estate. */
      gradi("sensor.temperatura_giardino", 33, ora),
    ],
    { ora, aree: { "sensor.temperatura_camera": "Camera", "climate.camera": "Camera" } },
  );
  casa.battito();
  casa.passa(20 * MINUTO);
  assert.equal(casa.dell("suggerimenti:comfort:").length, 0, "venti minuti non bastano");
  casa.passa(11 * MINUTO);
  casa.passa(MINUTO);
  const dette = casa.dell("suggerimenti:comfort:");
  assert.equal(dette.length, 1, "il giardino non e' una stanza");
  const [e] = dette;
  assert.equal(e.parole.it.titolo, "🥵 Camera: 28 °C");
  assert.equal(e.parole.it.testo, "Qualcuno è in casa. Accendo il clima?");
  assert.deepEqual(servizi(e)[0], {
    dominio: "climate",
    servizio: "turn_on",
    entita: ["climate.camera"],
  });
  assert.equal(e.azioni[1].basta, true);
});

test("comfort: freddo senza un clima vicino dice «Guarda»; con la casa vuota tace", () => {
  const ora = alle(8);
  const freddo = unaCasa(
    [stato("person.uno", "home", {}, 5 * ORA, ora), gradi("sensor.temperatura_studio", 15, ora)],
    { ora },
  );
  freddo.battito();
  freddo.passa(31 * MINUTO);
  const [e] = freddo.dell("suggerimenti:comfort:");
  assert.ok(e.parole.it.titolo.startsWith("🥶 "));
  assert.deepEqual(tasti(e), ["guarda", "basta"]);

  const vuota = unaCasa(
    [
      stato("person.uno", "not_home", {}, 5 * ORA, ora),
      gradi("sensor.temperatura_studio", 15, ora),
    ],
    { ora },
  );
  vuota.battito();
  vuota.passa(40 * MINUTO);
  assert.equal(vuota.dell("suggerimenti:comfort:").length, 0);
});

/* ─── 10. L'aria ─────────────────────────────────────────────────────────── */

test("aria: la CO₂ alta da un quarto d'ora e una ventola spenta li': «Accendi la ventilazione»", () => {
  const ora = alle(16);
  const casa = unaCasa(
    [
      stato("person.uno", "home", {}, 5 * ORA, ora),
      stato("sensor.co2_studio", "1450", { device_class: "carbon_dioxide" }, ORA, ora),
      stato("fan.studio", "off", {}, ORA, ora),
    ],
    { ora, aree: { "sensor.co2_studio": "Studio", "fan.studio": "Studio" } },
  );
  casa.battito();
  casa.passa(16 * MINUTO);
  casa.passa(MINUTO);
  const dette = casa.dell("suggerimenti:aria:");
  assert.equal(dette.length, 1);
  const [e] = dette;
  assert.equal(e.parole.it.titolo, "💨 Aria da cambiare in Studio");
  assert.equal(e.parole.it.testo, "CO₂ 1.450 ppm. Accendo la ventilazione?");
  assert.equal(e.parole.en.testo, "CO₂ 1,450 ppm. Turn on the ventilation?");
  assert.deepEqual(servizi(e)[0], { dominio: "fan", servizio: "turn_on", entita: ["fan.studio"] });
});

test("aria: l'umidita' alta senza ventola ha solo «Va bene così»; sotto soglia tace", () => {
  const ora = alle(16);
  const casa = unaCasa(
    [
      stato("person.uno", "home", {}, 5 * ORA, ora),
      stato("sensor.umidita_bagno", "78", { device_class: "humidity" }, ORA, ora),
      stato("sensor.umidita_sala", "55", { device_class: "humidity" }, ORA, ora),
    ],
    { ora, aree: { "sensor.umidita_bagno": "Bagno", "sensor.umidita_sala": "Sala" } },
  );
  casa.battito();
  casa.passa(16 * MINUTO);
  const dette = casa.dell("suggerimenti:aria:");
  assert.equal(dette.length, 1);
  assert.equal(dette[0].parole.it.titolo, "💨 Aria da cambiare in Bagno");
  assert.equal(
    dette[0].parole.it.testo,
    "Umidità 78%. Meglio aprire una finestra per qualche minuto.",
  );
  assert.deepEqual(tasti(dette[0]), ["basta"]);
});

/* ─── 11. I dispositivi muti ─────────────────────────────────────────────── */

test("non-rispondono: alle dieci, i dispositivi muti da sei ore, contati una volta, una volta al giorno", () => {
  const ora = alle(10, 5);
  const casa = unaCasa(
    [
      stato("sensor.cantina_temperatura", "unavailable", {}, 7 * ORA, ora),
      stato("sensor.cantina_batteria", "unavailable", {}, 7 * ORA, ora),
      stato("switch.studio", "unavailable", {}, 8 * ORA, ora),
      /* Un dispositivo con un'entita' che risponde non e' muto. */
      stato("sensor.sala_temperatura", "21", {}, ORA, ora),
      stato("sensor.sala_segnale", "unavailable", {}, 9 * ORA, ora),
      /* Una diagnostica muta non conta. */
      stato("sensor.router_diagnostica", "unavailable", {}, 9 * ORA, ora),
      /* Muto da un'ora: presto per dirlo. */
      stato("light.portico", "unavailable", {}, ORA, ora),
    ],
    { ora },
  );
  casa.sentinella.dispositivoDi = {
    "sensor.cantina_temperatura": "d1",
    "sensor.cantina_batteria": "d1",
    "switch.studio": "d2",
    "sensor.sala_temperatura": "d3",
    "sensor.sala_segnale": "d3",
    "sensor.router_diagnostica": "d4",
    "light.portico": "d5",
  };
  casa.sentinella.nomiDeiDispositivi = { d1: "Sensore cantina", d2: "Presa studio" };
  casa.sentinella.daNonContare = new Set(["sensor.router_diagnostica"]);
  casa.battito();
  casa.passa(MINUTO);
  const dette = casa.dell("suggerimenti:non-rispondono");
  assert.equal(dette.length, 1);
  const [e] = dette;
  assert.equal(e.parole.it.titolo, "📡 2 dispositivi non rispondono");
  assert.equal(e.parole.it.testo, "Presa studio, Sensore cantina · da 7 h.");
  assert.deepEqual(tasti(e), ["guarda", "basta"]);
  casa.passa(5 * MINUTO);
  assert.equal(casa.dell("suggerimenti:non-rispondono").length, 1);
});

test("non-rispondono: fuori dalle dieci, o senza registri, tace", () => {
  const ora = alle(15);
  const casa = unaCasa([stato("switch.studio", "unavailable", {}, 8 * ORA, ora)], { ora });
  casa.sentinella.dispositivoDi = { "switch.studio": "d2" };
  casa.battito();
  assert.equal(casa.dell("suggerimenti:non-rispondono").length, 0);
  const senza = unaCasa([stato("switch.studio", "unavailable", {}, 8 * ORA, alle(10, 5))], {
    ora: alle(10, 5),
  });
  senza.battito();
  assert.equal(senza.dell("suggerimenti:non-rispondono").length, 0);
});

/* ─── 12. Gli aggiornamenti ──────────────────────────────────────────────── */

const aggiornamento = (id, titolo, ora) => stato(id, "on", { title: titolo }, ORA, ora);

test("aggiornamenti: alle dieci una volta al giorno, e quando ne arriva uno nuovo", () => {
  const ora = alle(9);
  const casa = unaCasa(
    [
      aggiornamento("update.core", "Home Assistant Core", ora),
      aggiornamento("update.zigbee", "Zigbee2MQTT", ora),
    ],
    { ora },
  );
  casa.battito();
  casa.passa(MINUTO);
  assert.equal(casa.dell("suggerimenti:aggiornamenti").length, 0, "quelli di prima non sono nuovi");
  casa.sentinella.cambia(
    "update.esphome",
    aggiornamento("update.esphome", "ESPHome", casa.orologio.ora),
  );
  casa.passa(MINUTO);
  casa.passa(MINUTO);
  const dette = casa.dell("suggerimenti:aggiornamenti");
  assert.equal(dette.length, 1);
  const [e] = dette;
  assert.equal(e.parole.it.titolo, "⬆️ 3 aggiornamenti in attesa");
  assert.equal(e.parole.it.testo, "Home Assistant Core, Zigbee2MQTT, ESPHome.");
  assert.deepEqual(tasti(e), ["guarda", "piu-tardi"]);
  /* Alle dieci di oggi e' gia' detto; alle dieci di domani si ridice. */
  casa.orologio.ora = alle(10, 5);
  casa.passa(MINUTO);
  assert.equal(casa.dell("suggerimenti:aggiornamenti").length, 1);
  casa.orologio.ora = alle(10, 5, 20);
  casa.passa(MINUTO);
  assert.equal(casa.dell("suggerimenti:aggiornamenti").length, 2);
});

/* ─── Le regole da sole, e una che cade ──────────────────────────────────── */

test("le regole sono funzioni della vista: una casa vuota di cose non dice niente", () => {
  const sbagliate = [];
  const eventi = regoleDellAssistente(
    { ora: alle(10, 5), stati: new Map(), vuota: null, aree: new Map(), valori: {} },
    { sbaglia: (nome) => sbagliate.push(nome) },
  );
  assert.deepEqual(eventi, []);
  assert.deepEqual(sbagliate, []);
  /* Una vista rotta fa cadere le regole, non il giro. */
  const rotte = [];
  regoleDellAssistente({ ora: alle(12), stati: null }, { sbaglia: (nome) => rotte.push(nome) });
  assert.ok(rotte.length > 0);
});

/* ─── «Va bene così»: dodici ore ─────────────────────────────────────────── */

test("«Va bene così» zittisce quella notifica a quel telefono per dodici ore", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "assistente-"));
  /* Alle otto: dodici ore dopo sono le otto di sera, fuori dalle ore di
   * silenzio di serie. */
  const orologio = { ora: alle(8) };
  const UTENTE_A = "a".repeat(32);
  const UTENTE_B = "b".repeat(32);
  try {
    const dispositivi = new Dispositivi({ cartella, adesso: () => orologio.ora });
    const a = dispositivi.abbina({ nome: "Telefono A", utente: UTENTE_A });
    const b = dispositivi.abbina({ nome: "Telefono B", utente: UTENTE_B });
    const spinte = [];
    const chiamate = [];
    const notifiche = new Notifiche({
      cartella,
      dispositivi,
      utenti: {
        elenco: async () => [
          { id: UTENTE_A, nome: "Persona 1", amministratore: true, attivo: true },
          { id: UTENTE_B, nome: "Persona 2", amministratore: false, attivo: true },
        ],
        eVivo: async () => true,
      },
      casa: {
        chiedi: async (comando) => {
          chiamate.push(comando);
          return [];
        },
        ascolta: async () => () => {},
      },
      postino: {
        pronto: true,
        spingi: (spinta) => {
          spinte.push(spinta);
          return true;
        },
        diIGettoni: () => {},
      },
      adesso: () => orologio.ora,
    });
    for (const chi of [a, b])
      await notifiche.rispondi(
        {
          id: 1,
          type: "ponte/notifiche/registra",
          gettone: `gettone-${chi.dispositivo.id}-${"x".repeat(20)}`,
        },
        { dispositivo: chi.dispositivo },
      );
    /* «Tutti» i suggerimenti, anche quelli non importanti. */
    for (const chi of [a, b])
      await notifiche.rispondi(
        { id: 2, type: "ponte/notifiche/imposta", impostazioni: { assistente: "tutti" } },
        { dispositivo: chi.dispositivo },
      );
    const evento = () => ({
      tipo: "suggerimenti",
      urgenza: "bassa",
      importante: false,
      chiave: "suggerimenti:aria:studio",
      parole: { it: { titolo: "💨 Aria da cambiare in Studio", testo: "CO₂ 1.450 ppm." } },
      azioni: [{ id: "basta", parole: { it: "Va bene così" }, basta: true }],
    });
    assert.equal(await notifiche.consegna(evento()), 2);
    const perA = apriLaSpinta({
      chiaveDelFilo: a.chiave,
      telefono: a.dispositivo.id,
      busta: spinte.find((s) => s.telefono === a.dispositivo.id).busta,
    });
    assert.deepEqual(
      perA.azioni.map((x) => x.etichetta),
      ["Va bene così"],
    );
    const detto = await notifiche.rispondi(
      { id: 3, type: "ponte/notifiche/azione", notifica: perA.id, azione: "basta" },
      { dispositivo: a.dispositivo },
    );
    assert.equal(detto.success, true);
    assert.equal(chiamate.filter((c) => c.type === "call_service").length, 0, "non comanda niente");
    /* Tre ore dopo — oltre il «Più tardi» — ad A non arriva, a B si'. */
    orologio.ora += 3 * ORA;
    assert.equal(await notifiche.consegna(evento()), 1);
    assert.equal(spinte.at(-1).telefono, b.dispositivo.id);
    /* Dopo dodici ore torna anche ad A. */
    orologio.ora += 9 * ORA + MINUTO;
    assert.equal(await notifiche.consegna(evento()), 2);
    notifiche.ferma();
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});
