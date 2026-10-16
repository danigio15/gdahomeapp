/* La ricarica di notte (`ricarica-di-notte.js`, e le sue regole in
 * `plancia/src/core/ricarica-di-notte.js`).
 *
 * Quello che deve restare vero: alle 23, con l'auto collegata e la batteria
 * sotto la soglia, evcc va in Veloce ricordandosi com'era; si ferma al limite
 * di evcc o alle 5, quello che viene prima, e va su «Poi»; una modalita'
 * cambiata a mano chiude la notte e alla fine non si tocca niente; un'auto
 * staccata chiude la notte e rimette «Poi»; la fascia attraversa la mezzanotte
 * e il giorno che conta e' quello in cui comincia; un riavvio nel mezzo non
 * perde niente; il prezzo e' quello della F3, poi quello unico, poi nessuno.
 */

import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  entitaDellaRicarica,
  fasciaDi,
  impostazioniPulite,
  laNotte,
  letturaDellAuto,
  modoPerEvcc,
  prefissoDiEvcc,
  prezzoDellaNotte,
  prossimaFascia,
  stessoModo,
} from "../plancia/src/core/ricarica-di-notte.js";
import { RicaricaDiNotte, risolutoreDalla } from "../src/ricarica-di-notte.js";
import { Commissioni } from "../src/commissioni.js";

const MINUTO = 60_000;
/* Venerdi' 16 ottobre 2026, nell'ora della casa. */
const alle = (giorno, ore, minuti = 0) => new Date(2026, 9, giorno, ore, minuti, 0).getTime();

const ACCESA = impostazioniPulite({ attiva: true });
const OPZIONI = ["off", "pv", "minpv", "now"];
const auto = (piu = {}) => ({
  modo: "pv",
  opzioni: OPZIONI,
  soc: 42,
  limite: 80,
  collegata: true,
  kwh: 3,
  ...piu,
});

/* ── le impostazioni ─────────────────────────────────────────────────────── */

test("di serie e' spenta, dalle 23 alle 5, Veloce, poi Spento, tutti i giorni, sempre", () => {
  assert.deepEqual(impostazioniPulite(null), {
    attiva: false,
    da: "23:00",
    a: "05:00",
    inFascia: "now",
    poi: "off",
    giorni: [true, true, true, true, true, true, true],
    sotto: 100,
  });
  const storte = impostazioniPulite(
    '{"attiva":true,"da":"25:00","poi":"smart","sotto":250,"giorni":[1]}',
  );
  assert.equal(storte.attiva, true);
  assert.equal(storte.da, "23:00");
  assert.equal(storte.poi, "pv", "«smart» e' il nome nuovo del solare");
  assert.equal(storte.sotto, 100);
  assert.equal(storte.giorni.length, 7);
});

/* ── la fascia ───────────────────────────────────────────────────────────── */

test("la fascia attraversa la mezzanotte, e la notte si chiama col giorno in cui comincia", () => {
  const dopo = fasciaDi(ACCESA, alle(16, 23, 30));
  assert.equal(dopo.dentro, true);
  assert.equal(dopo.notte, "2026-10-16");
  assert.equal(dopo.fine, alle(17, 5));
  const notteFonda = fasciaDi(ACCESA, alle(17, 3, 0));
  assert.equal(notteFonda.dentro, true);
  assert.equal(notteFonda.notte, "2026-10-16", "le 3 di sabato sono la notte di venerdi'");
  assert.equal(fasciaDi(ACCESA, alle(17, 5, 0)).dentro, false, "alle 5 in punto e' finita");
  assert.equal(fasciaDi(ACCESA, alle(16, 22, 59)).dentro, false);
  const pomeriggio = impostazioniPulite({ attiva: true, da: "13:00", a: "16:00" });
  assert.equal(fasciaDi(pomeriggio, alle(16, 14)).dentro, true);
  assert.equal(fasciaDi(pomeriggio, alle(16, 17)).dentro, false);
});

test("la prossima fascia salta i giorni spenti", () => {
  /* Venerdi' spento (indice 4): la prossima e' sabato alle 23. */
  const imp = impostazioniPulite({
    attiva: true,
    giorni: [true, true, true, true, false, true, true],
  });
  assert.equal(prossimaFascia(imp, alle(16, 12)).inizio, alle(17, 23));
  assert.equal(prossimaFascia(ACCESA, alle(16, 12)).inizio, alle(16, 23));
  assert.equal(
    prossimaFascia(
      impostazioniPulite({ giorni: [false, false, false, false, false, false, false] }),
      alle(16, 12),
    ),
    null,
  );
});

/* ── le modalita' ────────────────────────────────────────────────────────── */

test("si manda il nome che evcc ha dichiarato, con le sue maiuscole", () => {
  assert.equal(modoPerEvcc("now", ["Off", "Smart", "Fast"]), "Fast");
  assert.equal(modoPerEvcc("pv", ["Off", "Smart", "Fast"]), "Smart");
  assert.equal(
    modoPerEvcc("minpv", ["off", "smart", "now"]),
    "now",
    "senza Min+Sole si carica veloce",
  );
  assert.equal(modoPerEvcc("minpv", OPZIONI), "minpv");
  assert.equal(modoPerEvcc("off", []), "off");
  assert.ok(stessoModo("pv", "Smart"));
  assert.ok(stessoModo("now", "Fast"));
  assert.ok(!stessoModo("off", "now"));
});

/* ── la notte ────────────────────────────────────────────────────────────── */

test("alle 23, collegata e sotto la soglia: Veloce, e si ricorda com'era", () => {
  const deciso = laNotte({
    impostazioni: ACCESA,
    memoria: {},
    auto: auto(),
    adesso: alle(16, 23, 0),
  });
  assert.deepEqual(deciso.comando, { modo: "now" });
  assert.equal(deciso.memoria.sessione.modoPrima, "pv");
  assert.equal(deciso.memoria.sessione.socInizio, 42);
  assert.equal(deciso.memoria.sessione.fine, alle(17, 5));
});

test("prima delle 23, spenta, o nei giorni spenti non si tocca niente", () => {
  assert.equal(
    laNotte({ impostazioni: ACCESA, memoria: {}, auto: auto(), adesso: alle(16, 22, 50) }).comando,
    null,
  );
  assert.equal(
    laNotte({
      impostazioni: impostazioniPulite({}),
      memoria: {},
      auto: auto(),
      adesso: alle(16, 23, 10),
    }).comando,
    null,
  );
  /* Venerdi' spento: anche alle 2 di sabato, perche' la notte e' di venerdi'. */
  const senzaVenerdi = impostazioniPulite({
    attiva: true,
    giorni: [true, true, true, true, false, true, true],
  });
  assert.equal(
    laNotte({ impostazioni: senzaVenerdi, memoria: {}, auto: auto(), adesso: alle(17, 2) }).comando,
    null,
  );
  assert.deepEqual(
    laNotte({ impostazioni: senzaVenerdi, memoria: {}, auto: auto(), adesso: alle(18, 2) }).comando,
    { modo: "now" },
    "la notte di sabato si'",
  );
});

test("l'auto collegata dentro la fascia parte appena arriva", () => {
  const staccata = laNotte({
    impostazioni: ACCESA,
    memoria: {},
    auto: auto({ collegata: false }),
    adesso: alle(16, 23, 5),
  });
  assert.equal(staccata.comando, null);
  assert.equal(staccata.memoria.sessione, null);
  assert.equal(staccata.perche, "aspetto-l-auto");
  const arriva = laNotte({
    impostazioni: ACCESA,
    memoria: staccata.memoria,
    auto: auto(),
    adesso: alle(17, 0, 40),
  });
  assert.deepEqual(arriva.comando, { modo: "now" });
});

test("sopra la soglia stanotte non parte, e lo dice; al 100% parte sempre; una batteria muta non ferma", () => {
  const sessanta = impostazioniPulite({ attiva: true, sotto: 60 });
  const no = laNotte({
    impostazioni: sessanta,
    memoria: {},
    auto: auto({ soc: 82 }),
    adesso: alle(16, 23),
  });
  assert.equal(no.comando, null);
  assert.equal(no.memoria.esito.tipo, "non-parte");
  assert.equal(no.memoria.esito.soc, 82);
  assert.equal(no.memoria.esito.sotto, 60);
  assert.equal(no.memoria.chiusa, "2026-10-16");
  /* E non ci ripensa al giro dopo. */
  assert.equal(
    laNotte({
      impostazioni: sessanta,
      memoria: no.memoria,
      auto: auto({ soc: 59 }),
      adesso: alle(16, 23, 30),
    }).comando,
    null,
  );
  assert.deepEqual(
    laNotte({
      impostazioni: ACCESA,
      memoria: {},
      auto: auto({ soc: 82, limite: 90 }),
      adesso: alle(16, 23),
    }).comando,
    {
      modo: "now",
    },
  );
  assert.deepEqual(
    laNotte({
      impostazioni: sessanta,
      memoria: {},
      auto: auto({ soc: null }),
      adesso: alle(16, 23),
    }).comando,
    { modo: "now" },
  );
});

test("si ferma al limite di evcc e mette «Poi», col conto dei kWh e degli euro", () => {
  const parte = laNotte({
    impostazioni: ACCESA,
    memoria: {},
    auto: auto({ kwh: 3 }),
    adesso: alle(16, 23),
  });
  const carica = laNotte({
    impostazioni: ACCESA,
    memoria: parte.memoria,
    auto: auto({ modo: "now", soc: 64, kwh: 9.8 }),
    adesso: alle(17, 1),
    prezzo: 0.13,
  });
  assert.equal(carica.comando, null);
  assert.equal(carica.perche, "in-corso");
  const finita = laNotte({
    impostazioni: ACCESA,
    memoria: carica.memoria,
    auto: auto({ modo: "now", soc: 80, kwh: 14.2 }),
    adesso: alle(17, 3, 40),
    prezzo: 0.13,
  });
  assert.deepEqual(finita.comando, { modo: "off" });
  assert.equal(finita.memoria.sessione, null);
  assert.equal(finita.memoria.esito.tipo, "finita");
  assert.equal(finita.memoria.esito.motivo, "limite");
  assert.equal(finita.memoria.esito.kwh, 11.2);
  assert.equal(finita.memoria.esito.costo, 1.46);
  assert.equal(finita.memoria.esito.poi, "off");
});

test("o alle 5, quello che arriva prima; «Come prima» rimette la modalita' ricordata", () => {
  const comePrima = impostazioniPulite({ attiva: true, poi: "prima" });
  const parte = laNotte({
    impostazioni: comePrima,
    memoria: {},
    auto: auto(),
    adesso: alle(16, 23),
  });
  const finita = laNotte({
    impostazioni: comePrima,
    memoria: parte.memoria,
    auto: auto({ modo: "now", soc: 70 }),
    adesso: alle(17, 5, 0),
  });
  assert.deepEqual(finita.comando, { modo: "pv" });
  assert.equal(finita.memoria.esito.motivo, "orario");
  /* E «Solare» con un evcc di oggi e' «smart». */
  const solare = impostazioniPulite({ attiva: true, poi: "pv" });
  const p2 = laNotte({
    impostazioni: solare,
    memoria: {},
    auto: auto({ modo: "off", opzioni: ["off", "smart", "now"] }),
    adesso: alle(16, 23),
  });
  const f2 = laNotte({
    impostazioni: solare,
    memoria: p2.memoria,
    auto: auto({ modo: "now", opzioni: ["off", "smart", "now"] }),
    adesso: alle(17, 5, 1),
  });
  assert.deepEqual(f2.comando, { modo: "smart" });
});

test("una modalita' cambiata a mano chiude la notte: alla fine non si tocca niente", () => {
  const parte = laNotte({ impostazioni: ACCESA, memoria: {}, auto: auto(), adesso: alle(16, 23) });
  /* Subito dopo evcc dice ancora quella di prima: non e' una mano, e' evcc
   * che non ha ancora ripubblicato. */
  const inRitardo = laNotte({
    impostazioni: ACCESA,
    memoria: parte.memoria,
    auto: auto({ modo: "pv" }),
    adesso: alle(16, 23, 1),
  });
  assert.ok(inRitardo.memoria.sessione, "nella grazia del comando la notte continua");
  const confermata = laNotte({
    impostazioni: ACCESA,
    memoria: inRitardo.memoria,
    auto: auto({ modo: "now" }),
    adesso: alle(16, 23, 2),
  });
  const aMano = laNotte({
    impostazioni: ACCESA,
    memoria: confermata.memoria,
    auto: auto({ modo: "pv" }),
    adesso: alle(17, 1),
  });
  assert.equal(aMano.comando, null);
  assert.equal(aMano.memoria.sessione, null);
  assert.equal(aMano.memoria.esito.tipo, "a-mano");
  /* Alle 5 nessuno la rimette su Spento, e non riparte. */
  assert.equal(
    laNotte({
      impostazioni: ACCESA,
      memoria: aMano.memoria,
      auto: auto({ modo: "pv" }),
      adesso: alle(17, 2),
    }).comando,
    null,
  );
  assert.equal(
    laNotte({
      impostazioni: ACCESA,
      memoria: aMano.memoria,
      auto: auto({ modo: "pv" }),
      adesso: alle(17, 5, 1),
    }).comando,
    null,
  );
  /* Ma la notte dopo si', da capo. */
  assert.deepEqual(
    laNotte({
      impostazioni: ACCESA,
      memoria: aMano.memoria,
      auto: auto({ modo: "pv" }),
      adesso: alle(17, 23),
    }).comando,
    {
      modo: "now",
    },
  );
});

test("l'auto staccata chiude la notte e rimette «Poi»", () => {
  const parte = laNotte({ impostazioni: ACCESA, memoria: {}, auto: auto(), adesso: alle(16, 23) });
  const via = laNotte({
    impostazioni: ACCESA,
    memoria: parte.memoria,
    auto: auto({ modo: "now", collegata: false, kwh: 0 }),
    adesso: alle(17, 0, 30),
  });
  assert.deepEqual(via.comando, { modo: "off" });
  assert.equal(via.memoria.esito.motivo, "staccata");
  /* Rimessa la spina nella stessa notte non riparte: la notte e' chiusa. */
  assert.equal(
    laNotte({
      impostazioni: ACCESA,
      memoria: via.memoria,
      auto: auto({ modo: "off" }),
      adesso: alle(17, 1),
    }).comando,
    null,
  );
});

test("gia' piena al limite di evcc: non parte", () => {
  const piena = laNotte({
    impostazioni: ACCESA,
    memoria: {},
    auto: auto({ soc: 80, limite: 80 }),
    adesso: alle(16, 23),
  });
  assert.equal(piena.comando, null);
  assert.equal(piena.memoria.esito.tipo, "piena");
});

test("i kWh si sommano anche quando il contatore della sessione riparte da zero", () => {
  const parte = laNotte({
    impostazioni: ACCESA,
    memoria: {},
    auto: auto({ kwh: 5 }),
    adesso: alle(16, 23),
  });
  const a = laNotte({
    impostazioni: ACCESA,
    memoria: parte.memoria,
    auto: auto({ modo: "now", kwh: 8 }),
    adesso: alle(17, 0),
  });
  const b = laNotte({
    impostazioni: ACCESA,
    memoria: a.memoria,
    auto: auto({ modo: "now", kwh: 1 }),
    adesso: alle(17, 1),
  });
  assert.equal(b.memoria.sessione.caricati, 4);
});

/* ── le entita' ──────────────────────────────────────────────────────────── */

test("dalla modalita' di evcc si trovano i suoi fratelli", () => {
  assert.equal(prefissoDiEvcc("select.evcc_lp1_mode"), "evcc_lp1_");
  assert.equal(prefissoDiEvcc("select.evcc_loadpoint_1_charge_mode"), "evcc_loadpoint_1_");
  assert.equal(prefissoDiEvcc("select.wallbox_mode"), "");
  const entita = entitaDellaRicarica(
    (rif) => ({ "dm.ev_modalita_ricarica_evcc": "select.evcc_lp1_mode" })[rif] || rif,
  );
  assert.equal(entita.modo, "select.evcc_lp1_mode");
  assert.deepEqual(entita.soc, ["sensor.evcc_lp1_vehicle_soc"]);
  assert.ok(entita.limite.includes("number.evcc_lp1_limit_soc"));
  assert.deepEqual(entita.cavo, ["binary_sensor.evcc_lp1_connected"]);
  assert.ok(entita.energia.includes("sensor.evcc_lp1_charged_energy"));
});

test("la lettura dell'auto: Wh in kWh, il cavo, e chi non lo dice e' collegata", () => {
  const entita = entitaDellaRicarica(
    (rif) => ({ "dm.ev_modalita_ricarica_evcc": "select.evcc_lp1_mode" })[rif] || "",
  );
  const stati = {
    "select.evcc_lp1_mode": { state: "pv", attributes: { options: OPZIONI } },
    "sensor.evcc_lp1_vehicle_soc": { state: "42.4", attributes: {} },
    "number.evcc_lp1_limit_soc": { state: "80", attributes: {} },
    "binary_sensor.evcc_lp1_connected": { state: "on", attributes: {} },
    "sensor.evcc_lp1_charged_energy": { state: "6800", attributes: { unit_of_measurement: "Wh" } },
  };
  assert.deepEqual(letturaDellAuto(entita, stati), {
    modo: "pv",
    opzioni: OPZIONI,
    soc: 42.4,
    limite: 80,
    collegata: true,
    kwh: 6.8,
  });
  assert.equal(
    letturaDellAuto(entita, { ...stati, "binary_sensor.evcc_lp1_connected": { state: "off" } })
      .collegata,
    false,
  );
  assert.equal(
    letturaDellAuto(entita, {
      ...stati,
      "binary_sensor.evcc_lp1_connected": { state: "unavailable" },
    }).collegata,
    null,
    "un cavo che tace non e' un cavo staccato: si aspetta",
  );
  const senzaCavo = { ...stati };
  delete senzaCavo["binary_sensor.evcc_lp1_connected"];
  assert.equal(letturaDellAuto(entita, senzaCavo).collegata, true);
});

/* ── il prezzo ───────────────────────────────────────────────────────────── */

test("il prezzo: la F3, poi la tariffa unica, poi nessuno", () => {
  const tre = JSON.stringify({
    quante: 3,
    voci: [
      { dalle: 480, prezzo: 0.31 },
      { dalle: 1140, prezzo: 0.24 },
      { dalle: 1380, prezzo: 0.13 },
    ],
  });
  assert.deepEqual(prezzoDellaNotte({ fasce: tre, costo: "0.22" }), {
    prezzo: 0.13,
    fonte: "fascia",
    fascia: "F3",
  });
  const due = JSON.stringify({
    quante: 2,
    voci: [
      { dalle: 480, prezzo: 0.3 },
      { dalle: 1140, prezzo: 0.18 },
    ],
  });
  assert.deepEqual(prezzoDellaNotte({ fasce: due, costo: "0.22", da: "23:00" }), {
    prezzo: 0.18,
    fonte: "fascia",
    fascia: "F2",
  });
  const treSenzaF3 = JSON.stringify({ quante: 3, voci: [{ prezzo: 0.31 }, { prezzo: 0.24 }, {}] });
  assert.deepEqual(prezzoDellaNotte({ fasce: treSenzaF3, costo: "0.22" }), {
    prezzo: 0.22,
    fonte: "unica",
    fascia: "",
  });
  assert.deepEqual(
    prezzoDellaNotte({ costo: '"sensor.prezzo"', stati: { "sensor.prezzo": { state: "0,21" } } }),
    { prezzo: 0.21, fonte: "unica", fascia: "" },
  );
  assert.deepEqual(prezzoDellaNotte({}), { prezzo: null, fonte: "nessuno", fascia: "" });
});

/* ── la casa ─────────────────────────────────────────────────────────────── */

function laCasa({
  cartella = "",
  impostazioni = { attiva: true },
  valori = {},
  stati,
  adesso,
} = {}) {
  const chiesti = [];
  let guasta = false;
  const casa = {
    chiesti,
    rompi: (si) => {
      guasta = si;
    },
    async chiedi(cosa) {
      if (guasta) throw new Error("Home Assistant non risponde");
      chiesti.push(cosa);
      if (cosa.type === "call_service")
        stati["select.evcc_lp1_mode"].state = cosa.service_data.option;
      return null;
    },
  };
  const configurazione = {
    leggi: () => ({
      snapshot: {
        values: {
          cd_entity_overrides: JSON.stringify({
            "dm.ev_modalita_ricarica_evcc": "select.evcc_lp1_mode",
          }),
          cd_ricarica_notte: JSON.stringify(impostazioni),
          cd_costo_kwh: "0.22",
          ...valori,
        },
      },
    }),
  };
  const ricarica = new RicaricaDiNotte({
    cartella,
    casa,
    configurazione,
    stati: (id) => stati[id] ?? null,
    adesso,
  });
  return { ricarica, casa };
}

const statiDiCasa = () => ({
  "select.evcc_lp1_mode": { state: "pv", attributes: { options: OPZIONI } },
  "sensor.evcc_lp1_vehicle_soc": { state: "42", attributes: {} },
  "number.evcc_lp1_limit_soc": { state: "80", attributes: {} },
  "binary_sensor.evcc_lp1_connected": { state: "on", attributes: {} },
  "sensor.evcc_lp1_charged_energy": { state: "2", attributes: { unit_of_measurement: "kWh" } },
});

test("la casa mette evcc in Veloce alle 23, e alle 5 lo spegne", async () => {
  let ora = alle(16, 23, 0, 10);
  const stati = statiDiCasa();
  const { ricarica, casa } = laCasa({ stati, adesso: () => ora });
  await ricarica.battito();
  assert.deepEqual(casa.chiesti.at(-1), {
    type: "call_service",
    domain: "select",
    service: "select_option",
    service_data: { entity_id: "select.evcc_lp1_mode", option: "now" },
  });
  ora = alle(17, 5, 0);
  await ricarica.battito();
  assert.equal(casa.chiesti.at(-1).service_data.option, "off");
  assert.equal(ricarica.memoria.esito.motivo, "orario");
  assert.equal(ricarica.memoria.esito.prezzo, 0.22);
});

test("un riavvio nel mezzo della notte non perde niente", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "ricarica-notte-"));
  let ora = alle(16, 23, 0);
  const stati = statiDiCasa();
  const prima = laCasa({
    cartella,
    impostazioni: { attiva: true, poi: "prima" },
    stati,
    adesso: () => ora,
  });
  await prima.ricarica.battito();
  assert.equal(stati["select.evcc_lp1_mode"].state, "now");
  /* L'add-on si riaccende alle 2: la notte c'e' ancora, con la modalita' di prima. */
  ora = alle(17, 2);
  const dopo = laCasa({
    cartella,
    impostazioni: { attiva: true, poi: "prima" },
    stati,
    adesso: () => ora,
  });
  assert.equal(dopo.ricarica.memoria.sessione.modoPrima, "pv");
  await dopo.ricarica.battito();
  assert.equal(dopo.casa.chiesti.length, 0, "nel mezzo non si tocca niente");
  stati["sensor.evcc_lp1_vehicle_soc"].state = "80";
  await dopo.ricarica.battito();
  assert.equal(dopo.casa.chiesti.at(-1).service_data.option, "pv", "torna com'era prima");
});

test("un comando che non passa non si ricorda: si riprova", async () => {
  let ora = alle(16, 23);
  const stati = statiDiCasa();
  const { ricarica, casa } = laCasa({ stati, adesso: () => ora });
  casa.rompi(true);
  await ricarica.battito();
  assert.equal(ricarica.memoria.sessione, null);
  casa.rompi(false);
  ora += 30_000;
  await ricarica.battito();
  assert.equal(casa.chiesti.length, 0, "non prima di due minuti");
  ora += 2 * MINUTO;
  await ricarica.battito();
  assert.equal(casa.chiesti.at(-1).service_data.option, "now");
  assert.ok(ricarica.memoria.sessione);
});

test("lo stato si dice solo a chi ha un nome, e dice la notte", async () => {
  const ora = alle(16, 23, 30);
  const stati = statiDiCasa();
  const { ricarica } = laCasa({ stati, adesso: () => ora });
  await ricarica.battito();
  const anonimo = ricarica.rispondi({ id: 1, type: "ponte/ricarica-notte/stato" }, {});
  assert.equal(anonimo.success, false);
  assert.equal(anonimo.error.code, "unauthorized");
  const visto = ricarica.rispondi({ id: 2, type: "ponte/ricarica-notte/stato" }, { utente: "u1" });
  assert.equal(visto.success, true);
  assert.equal(visto.result.attiva, true);
  assert.equal(visto.result.sessione.modo, "now");
  assert.equal(visto.result.fascia.dentro, true);
  assert.equal(visto.result.prezzo.fonte, "unica");
  assert.equal(visto.result.auto.soc, 42);
});

test("il comando passa dalle commissioni, anche dal filo dell'app", async () => {
  const stati = statiDiCasa();
  const { ricarica } = laCasa({ stati, adesso: () => alle(16, 12) });
  const commissioni = new Commissioni({
    casa: {},
    registro: { info() {}, attenzione() {}, errore() {} },
  });
  assert.ok(commissioni.riconosce({ type: "ponte/ricarica-notte/stato" }));
  const senza = await commissioni.rispondi(
    { id: 1, type: "ponte/ricarica-notte/stato" },
    { chiChiede: "u1" },
  );
  assert.equal(senza.error.code, "unknown_command");
  commissioni.ricaricaDiNotte = ricarica;
  const con = await commissioni.rispondi(
    { id: 2, type: "ponte/ricarica-notte/stato" },
    { chiChiede: "u1" },
  );
  assert.equal(con.success, true);
  assert.equal(con.result.prossima.inizio, alle(16, 23));
});

test("le entita' si trovano anche nelle caselle delle auto", () => {
  const risolvi = risolutoreDalla({
    cd_entity_overrides: "{}",
    cd_ev_cars: JSON.stringify([
      { name: "Una", ov: { "dm.ev_modalita_ricarica_evcc": "select.evcc_garage_mode" } },
    ]),
  });
  assert.equal(risolvi("dm.ev_modalita_ricarica_evcc"), "select.evcc_garage_mode");
  assert.equal(risolvi("dm.ev_target_soc"), "");
});
