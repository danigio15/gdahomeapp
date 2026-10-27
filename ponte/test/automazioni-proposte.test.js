/* Le proposte delle automazioni («Suggerite per la tua casa ✨»): le regole in
 * `plancia/src/core/automazioni-proposte.js`, e chi le applica in casa
 * (`src/automazioni.js`).
 *
 * Quello che deve restare vero: una regola sui dispositivi nasce solo da cose
 * che stanno nella stessa stanza; un'abitudine e' un orario che torna sei
 * giorni su dieci, non uno che capita; l'id di una proposta e' lo stesso
 * domani e in qualunque ordine arrivino le entita'; quello che c'e' gia' e
 * quello scartato non si ripropongono; la storia si legge una volta al
 * giorno; e le proposte le legge, e le scarta, solo chi ha un utente.
 */

import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  automazionePulita,
  eLoStatoAtteso,
  soleDelGiorno,
} from "../plancia/src/core/automazioni.js";
import {
  automazioneDellaProposta,
  giaCe,
  orarioCheTorna,
  passaggi,
  proposteDaMostrare,
  proposteDaiDispositivi,
  proposteDalleAbitudini,
} from "../plancia/src/core/automazioni-proposte.js";
import { Automazioni, storieDallaRisposta } from "../src/automazioni.js";
import { Commissioni } from "../src/commissioni.js";

const MINUTO = 60_000;
const GIORNO = 24 * 60 * MINUTO;
/* Sabato 17 ottobre 2026, alle dieci di mattina, nell'ora della casa. */
const ADESSO = new Date(2026, 9, 17, 10, 0).getTime();
const alle = (giorniFa, ore, minuti = 0) => {
  const d = new Date(ADESSO - giorniFa * GIORNO);
  d.setHours(ore, minuti, 0, 0);
  return d.getTime();
};
const festivo = (t) => [0, 6].includes(new Date(t).getDay());

const CASA = [
  {
    id: "binary_sensor.pir_corridoio",
    nome: "Movimento corridoio",
    area: "Corridoio",
    classe: "motion",
  },
  { id: "light.corridoio", nome: "Luce corridoio", area: "Corridoio" },
  {
    id: "binary_sensor.finestra_camera",
    nome: "Finestra camera",
    area: "Camera",
    classe: "window",
  },
  { id: "climate.camera", nome: "Clima camera", area: "Camera" },
  {
    id: "sensor.umidita_bagno",
    nome: "Umidità bagno",
    area: "Bagno",
    classe: "humidity",
    unita: "%",
  },
  { id: "fan.bagno", nome: "Aspiratore", area: "Bagno" },
  {
    id: "sensor.presa_lavatrice_potenza",
    nome: "Lavatrice potenza",
    area: "Lavanderia",
    classe: "power",
    unita: "W",
  },
  {
    id: "sensor.presa_tv_potenza",
    nome: "TV potenza",
    area: "Soggiorno",
    classe: "power",
    unita: "W",
  },
  { id: "cover.soggiorno", nome: "Tapparella soggiorno", area: "Soggiorno", classe: "shutter" },
  { id: "cover.garage", nome: "Garage", area: "Fuori", classe: "garage" },
  { id: "person.a", nome: "A" },
  { id: "alarm_control_panel.casa", nome: "Antifurto" },
  /* Movimento e luce, ma in due stanze diverse: niente proposta. */
  { id: "binary_sensor.pir_cucina", nome: "Movimento cucina", area: "Cucina", classe: "motion" },
  { id: "light.studio", nome: "Luce studio", area: "Studio" },
];

/* ── i dispositivi ───────────────────────────────────────────────────────── */

test("dai dispositivi: le coppie nella stessa stanza, e le regole di casa", () => {
  const proposte = proposteDaiDispositivi({ entita: CASA });
  const chiavi = proposte.map((p) => p.chiave).sort();
  assert.deepEqual(chiavi, [
    "antifurtoLuci",
    "elettrodomestico",
    "finestraClima",
    "fuoriLuci",
    "movimentoLuce",
    "tramontoTapparelle",
    "umiditaAspiratore",
    "vuotaClima",
  ]);
  const luce = proposte.find((p) => p.chiave === "movimentoLuce");
  assert.equal(luce.id, "movimento-luce:binary_sensor.pir_corridoio|light.corridoio");
  assert.equal(luce.gruppo, "dispositivi");
  assert.deepEqual(luce.dati, { area: "Corridoio" });
  assert.deepEqual(luce.automazione.quando.entita, ["binary_sensor.pir_corridoio"]);
  assert.equal(luce.automazione.allora[0].livello, 20);
  /* Il cucina+studio non fa coppia; la TV non e' un elettrodomestico. */
  assert.equal(proposte.filter((p) => p.chiave === "movimentoLuce").length, 1);
  const elettro = proposte.filter((p) => p.chiave === "elettrodomestico");
  assert.deepEqual(
    elettro.map((p) => p.automazione.quando.entita),
    ["sensor.presa_lavatrice_potenza"],
  );
  /* Il garage non si chiude al tramonto. */
  const tapparelle = proposte.find((p) => p.chiave === "tramontoTapparelle");
  assert.deepEqual(tapparelle.automazione.allora[0].entita, ["cover.soggiorno"]);
  /* Ogni proposta e' un'automazione che l'editor sa aprire. */
  for (const p of proposte) {
    const a = automazionePulita({ id: "x", nome: "x", ...p.automazione });
    assert.ok(a, p.chiave);
    assert.ok(a.allora.length, `${p.chiave}: l'ALLORA resta`);
  }
  const aspira = automazionePulita({
    id: "x",
    nome: "x",
    ...proposte.find((p) => p.chiave === "umiditaAspiratore").automazione,
  });
  assert.equal(aspira.allora[1].stato, "<60", "l'attesa a soglia passa la pulizia");
});

test("il motore dice cosa proporre, la conversione lo scrive come si salva", () => {
  const luce = proposteDaiDispositivi({ entita: CASA }).find((p) => p.chiave === "movimentoLuce");
  assert.deepEqual(luce.cose, { sensore: "binary_sensor.pir_corridoio", luce: "light.corridoio" });
  /* La stessa proposta, convertita da sola, e' l'automazione che porta. */
  assert.deepEqual(automazioneDellaProposta(luce), luce.automazione);
  assert.deepEqual(
    automazioneDellaProposta({
      chiave: "abitudineOrario",
      cose: { entita: "cover.studio" },
      dati: { ora: "07:30", festivi: true, verso: "accende" },
    }),
    {
      attiva: true,
      quando: {
        tipo: "orario",
        ore: ["07:30"],
        giorni: [false, false, false, false, false, true, true],
      },
      allora: [{ tipo: "tapparella", entita: ["cover.studio"], modo: "apri" }],
    },
  );
  assert.equal(automazioneDellaProposta({ chiave: "sconosciuta" }), null);
});

test("gli id sono stabili: stesso risultato in qualunque ordine", () => {
  const uno = proposteDaiDispositivi({ entita: CASA }).map((p) => p.id);
  const due = proposteDaiDispositivi({ entita: [...CASA].reverse() }).map((p) => p.id);
  assert.deepEqual([...uno].sort(), [...due].sort());
  assert.equal(new Set(uno).size, uno.length, "niente id doppi");
});

test("l'attesa a soglia: «<60» aspetta che scenda, uno stato sconosciuto no", () => {
  assert.equal(eLoStatoAtteso("<60", "58.5"), true);
  assert.equal(eLoStatoAtteso("<60", "61"), false);
  assert.equal(eLoStatoAtteso(">25", "25,5"), true);
  assert.equal(eLoStatoAtteso("<60", "unavailable"), false);
  assert.equal(eLoStatoAtteso("off", "off"), true);
  assert.equal(eLoStatoAtteso("off", "on"), false);
});

/* ── le abitudini ────────────────────────────────────────────────────────── */

/* Tre settimane: la luce del soggiorno si accende verso le 19 nei feriali
 * (qualche minuto prima o dopo) e si spegne a ore diverse. */
function storiaDelSoggiorno({ salta = 0 } = {}) {
  const storia = [];
  let n = 0;
  for (let g = 21; g >= 1; g -= 1) {
    const sera = alle(g, 19, 0);
    if (festivo(sera)) continue;
    n += 1;
    if (n <= salta) continue;
    storia.push([sera + ((g * 7) % 21) * MINUTO - 10 * MINUTO, "on"]);
    storia.push([alle(g, 21 + (g % 3), 13 * (g % 4)), "off"]);
  }
  return storia;
}

test("i passaggi: solo i cambi, gli stati ripetuti non contano", () => {
  assert.deepEqual(
    passaggi([
      [1, "off"],
      [2, "on"],
      [3, "on"],
      [4, "unavailable"],
      [5, "off"],
      [6, "open"],
    ]).map(([t, v]) => `${t}${v}`),
    ["2accende", "5spegne", "6accende"],
  );
});

test("dalle abitudini: un orario che torna nei feriali diventa una proposta", () => {
  const proposte = proposteDalleAbitudini({
    storie: { "light.soggiorno": storiaDelSoggiorno() },
    entita: [{ id: "light.soggiorno", nome: "Luce soggiorno" }],
    adesso: ADESSO,
  });
  assert.equal(proposte.length, 1, "lo spegnimento a ore diverse non e' un'abitudine");
  const [p] = proposte;
  assert.equal(p.id, "abitudine-accende-feriali:light.soggiorno");
  assert.equal(p.gruppo, "abitudini");
  assert.equal(p.chiave, "abitudineOrario");
  assert.equal(p.dati.nome, "Luce soggiorno");
  assert.equal(p.dati.festivi, false);
  assert.equal(p.dati.settimane, 3);
  assert.match(p.automazione.quando.ore[0], /^(18:5|19:0)\d$/, "verso le sette");
  assert.deepEqual(p.automazione.quando.giorni, [true, true, true, true, true, false, false]);
  assert.deepEqual(p.automazione.allora, [{ tipo: "accendi", entita: ["light.soggiorno"] }]);
});

test("dalle abitudini: meno di sei giorni su dieci non e' un'abitudine", () => {
  /* Quindici feriali, otto saltati: sette su quindici. */
  const proposte = proposteDalleAbitudini({
    storie: { "light.soggiorno": storiaDelSoggiorno({ salta: 8 }) },
    adesso: ADESSO,
  });
  assert.deepEqual(proposte, []);
  assert.equal(orarioCheTorna([], 10), null);
});

test("dalle abitudini: la tapparella chiusa a mano al tramonto", () => {
  const casa = { "zone.home": { state: "1", attributes: { latitude: 45.46, longitude: 9.19 } } };
  const statoDi = (id) => casa[id] || null;
  const storia = [];
  for (let g = 21; g >= 1; g -= 1) {
    storia.push([alle(g, 8, 0), "open"]);
    /* Dieci minuti dopo il tramonto, che ogni giorno cambia. */
    storia.push([soleDelGiorno(statoDi, alle(g, 12)).tramonto + 10 * MINUTO, "closed"]);
  }
  const abitudini = proposteDalleAbitudini({
    storie: { "cover.soggiorno": storia },
    entita: CASA,
    adesso: ADESSO,
    statoDi,
  });
  assert.equal(abitudini[0].chiave, "abitudineTramonto");
  assert.equal(abitudini[0].id, "abitudine-tramonto:cover.soggiorno");
  /* L'apertura alle otto resta un orario; la chiusura no, e' il tramonto. */
  assert.deepEqual(
    abitudini.slice(1).map((p) => `${p.chiave}:${p.dati.verso}`),
    ["abitudineOrario:accende", "abitudineOrario:accende"],
  );
  assert.equal(abitudini[1].automazione.allora[0].modo, "apri");
  /* Detta dall'abitudine, la regola generica sulle tapparelle sparisce. */
  const mostrate = proposteDaMostrare([...proposteDaiDispositivi({ entita: CASA }), ...abitudini]);
  assert.equal(
    mostrate.some((p) => p.chiave === "tramontoTapparelle"),
    false,
  );
  const gruppi = mostrate.map((p) => p.gruppo);
  assert.equal(
    gruppi.lastIndexOf("dispositivi") < gruppi.indexOf("abitudini"),
    true,
    "prima i dispositivi",
  );
});

test("dalle abitudini: le luci rimaste accese con la casa vuota", () => {
  const giorno = (giorniFa) => {
    const d = new Date(ADESSO - giorniFa * GIORNO);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const tre = { [giorno(1)]: 40, [giorno(3)]: 15, [giorno(5)]: 90, [giorno(20)]: 300 };
  const [p] = proposteDalleAbitudini({
    luciConCasaVuota: { "light.cucina": tre, "light.bagno": { [giorno(2)]: 30 } },
    adesso: ADESSO,
  });
  assert.equal(p.chiave, "abitudineFuoriLuci");
  assert.equal(p.dati.volte, 3);
  assert.deepEqual(p.automazione.allora[0].entita, ["light.cucina", "light.bagno"]);
  const due = proposteDalleAbitudini({
    luciConCasaVuota: { "light.cucina": { [giorno(1)]: 40, [giorno(2)]: 40 } },
    adesso: ADESSO,
  });
  assert.deepEqual(due, [], "due volte non bastano");
});

/* ── quello che c'e' gia', quello scartato ──────────────────────────────── */

test("quello che c'e' gia' e quello scartato non si ripropongono", () => {
  const proposte = proposteDaiDispositivi({ entita: CASA });
  const giaFatta = {
    id: "mia",
    nome: "La mia luce",
    quando: { tipo: "movimento", entita: ["binary_sensor.pir_corridoio"], verso: "si" },
    allora: [{ tipo: "accendi", entita: ["light.corridoio"], livello: 60 }],
  };
  const crono = {
    id: "c1",
    nome: "Camera",
    tipo: "crono",
    crono: {
      termostati: ["climate.camera"],
      finestre: ["binary_sensor.finestra_camera"],
      finestraSpegne: true,
    },
  };
  const mostrate = proposteDaMostrare(proposte, {
    automazioni: [giaFatta, crono],
    scartate: ["umidita-aspiratore:fan.bagno|sensor.umidita_bagno"],
  });
  const chiavi = mostrate.map((p) => p.chiave);
  assert.equal(chiavi.includes("movimentoLuce"), false, "c'e' gia'");
  assert.equal(chiavi.includes("finestraClima"), false, "lo fa gia' il cronotermostato");
  assert.equal(chiavi.includes("umiditaAspiratore"), false, "scartata");
  assert.equal(chiavi.includes("fuoriLuci"), true);
  /* Lo stesso QUANDO su un'altra luce non e' la stessa cosa. */
  const altra = { ...giaFatta, allora: [{ tipo: "accendi", entita: ["light.studio"] }] };
  const luce = proposte.find((p) => p.chiave === "movimentoLuce");
  assert.equal(giaCe(luce, [automazionePulita(altra)]), false);
});

/* ── nel ponte ───────────────────────────────────────────────────────────── */

function unaCasa({ automazioni = [], storia = {}, cartella = null } = {}) {
  const domande = [];
  const mappa = new Map([
    [
      "binary_sensor.pir_corridoio",
      {
        state: "off",
        attributes: { device_class: "motion", friendly_name: "Movimento corridoio" },
      },
    ],
    ["light.corridoio", { state: "off", attributes: { friendly_name: "Luce corridoio" } }],
    ["light.soggiorno", { state: "off", attributes: { friendly_name: "Luce soggiorno" } }],
    ["sensor.rssi_corridoio", { state: "-60", attributes: { device_class: "signal_strength" } }],
    ["binary_sensor.pir_nascosto", { state: "off", attributes: { device_class: "motion" } }],
    ["person.a", { state: "home", attributes: {} }],
  ]);
  const casa = {
    chiedi: async (m) => {
      domande.push(m.type);
      if (m.type === "config/area_registry/list")
        return [
          { area_id: "corridoio", name: "Corridoio" },
          { area_id: "soggiorno", name: "Soggiorno" },
        ];
      if (m.type === "history/history_during_period") {
        assert.ok(m.entity_ids.length <= 40);
        assert.equal(m.minimal_response, true);
        return storia;
      }
      return null;
    },
  };
  const registri = {
    chiedi: async () => ({
      dispositivi: [{ id: "d1", area_id: "corridoio" }],
      entita: [
        /* La stanza dal dispositivo… */
        { entity_id: "binary_sensor.pir_corridoio", device_id: "d1" },
        /* …o dall'entita'. */
        { entity_id: "light.corridoio", area_id: "corridoio" },
        { entity_id: "light.soggiorno", area_id: "soggiorno" },
        { entity_id: "binary_sensor.pir_nascosto", area_id: "soggiorno", hidden_by: "user" },
        { entity_id: "sensor.rssi_corridoio", device_id: "d1", entity_category: "diagnostic" },
      ],
    }),
  };
  const dir = cartella || mkdtempSync(join(tmpdir(), "proposte-"));
  let ora = ADESSO;
  const fai = () =>
    new Automazioni({
      cartella: dir,
      casa,
      registri,
      configurazione: {
        leggi: () => ({ snapshot: { values: { cd_automazioni: JSON.stringify(automazioni) } } }),
      },
      stati: () => mappa,
      licenze: { attive: true, premium: false },
      adesso: () => ora,
      ogni: () => null,
    });
  return {
    fai,
    domande,
    dir,
    passa: (minuti) => {
      ora += minuti * MINUTO;
    },
  };
}

/* La storia com'e' sul socket, nella forma stretta. */
const comeSulSocket = (storia) =>
  storia.map(([t, s], i) => (i === 0 ? { s, a: {}, lu: t / 1000 } : { s, lu: t / 1000 }));

test("la storia del Recorder si legge nelle due forme", () => {
  const storie = storieDallaRisposta({
    "light.a": [
      { s: "on", lu: 100 },
      { s: "off", lu: 50 },
    ],
    "light.b": [{ state: "on", last_changed: "2026-10-17T08:00:00Z" }],
    "light.c": "no",
  });
  assert.deepEqual(storie["light.a"], [
    [50_000, "off"],
    [100_000, "on"],
  ]);
  assert.deepEqual(storie["light.b"], [[Date.parse("2026-10-17T08:00:00Z"), "on"]]);
  assert.equal(storie["light.c"], undefined);
});

test("nel ponte: stanze dai registri, niente entita' interne o nascoste, storia una volta al giorno", async () => {
  const casa = unaCasa({
    storia: { "light.soggiorno": comeSulSocket(storiaDelSoggiorno()) },
  });
  const ponte = casa.fai();
  const entita = await ponte.entitaDellaCasa();
  const corridoio = entita.find((e) => e.id === "binary_sensor.pir_corridoio");
  assert.equal(corridoio.area, "Corridoio", "la stanza dal dispositivo");
  assert.equal(
    entita.some((e) => e.id === "sensor.rssi_corridoio"),
    false,
  );
  assert.equal(
    entita.some((e) => e.id === "binary_sensor.pir_nascosto"),
    false,
  );

  const { proposte, abitudiniPronte } = await ponte.proposte();
  assert.equal(abitudiniPronte, true);
  assert.deepEqual(
    proposte.map((p) => p.chiave),
    ["movimentoLuce", "fuoriLuci", "abitudineOrario"],
  );
  await ponte.proposte();
  casa.passa(6 * 60);
  /* Un altro ponte sulla stessa cartella (un riavvio): la storia c'e' gia'. */
  await casa.fai().proposte();
  assert.equal(
    casa.domande.filter((t) => t === "history/history_during_period").length,
    1,
    "una lettura sola della storia in un giorno",
  );
  casa.passa(24 * 60);
  await ponte.proposte();
  assert.equal(casa.domande.filter((t) => t === "history/history_during_period").length, 2);
});

test("nel ponte: le proposte e il «No, grazie» solo a chi ha un utente, e lo scarto resta", async () => {
  const casa = unaCasa();
  const ponte = casa.fai();
  const commissioni = new Commissioni({});
  commissioni.automazioni = ponte;

  for (const type of ["ponte/automazioni/proposte", "ponte/automazioni/proposte/scarta"]) {
    const senza = await commissioni.rispondi({ id: 1, type, proposta: "x" });
    assert.equal(senza.success, false, type);
    assert.equal(senza.error.code, "unauthorized", type);
  }

  const lette = await commissioni.rispondi(
    { id: 2, type: "ponte/automazioni/proposte" },
    { chiChiede: "u1" },
  );
  assert.equal(lette.success, true);
  const id = "movimento-luce:binary_sensor.pir_corridoio|light.corridoio";
  assert.ok(lette.result.proposte.some((p) => p.id === id));

  const vuota = await commissioni.rispondi(
    { id: 3, type: "ponte/automazioni/proposte/scarta", proposta: "" },
    { chiChiede: "u1" },
  );
  assert.equal(vuota.success, false);

  const scartata = await commissioni.rispondi(
    { id: 4, type: "ponte/automazioni/proposte/scarta", proposta: id },
    { chiChiede: "u1" },
  );
  assert.equal(scartata.success, true);
  assert.equal(
    scartata.result.proposte.some((p) => p.id === id),
    false,
  );

  /* Dopo un riavvio lo scarto c'e' ancora. */
  const dopo = await casa.fai().proposte();
  assert.equal(
    dopo.proposte.some((p) => p.id === id),
    false,
  );
});

test("nel ponte: un'automazione salvata toglie la sua proposta", async () => {
  const casa = unaCasa({
    automazioni: [
      {
        id: "a1",
        nome: "Tutti fuori",
        quando: { tipo: "persone", verso: "tuttiFuori" },
        allora: [{ tipo: "spegni", entita: ["light.corridoio"] }],
      },
    ],
  });
  const { proposte } = await casa.fai().proposte();
  assert.equal(
    proposte.some((p) => p.chiave === "fuoriLuci"),
    false,
  );
});

test("con l'antifurto inserito si spengono tutte le luci, non le prime dieci", () => {
  const luci = Array.from({ length: 25 }, (_, i) => ({ id: `light.luce_${i}`, nome: `Luce ${i}` }));
  const proposte = proposteDaiDispositivi({
    entita: [{ id: "alarm_control_panel.casa", nome: "Antifurto" }, ...luci],
  });
  const antifurto = proposte.find((una) => una.chiave === "antifurtoLuci");
  assert.equal(antifurto.cose.luci.length, 25);
  const spegni = automazioneDellaProposta(antifurto).allora.find((una) => una.tipo === "spegni");
  assert.equal(spegni.entita.length, 25);
});
