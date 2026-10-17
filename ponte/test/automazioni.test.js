/* Le automazioni (`automazioni.js`, e le loro regole in
 * `plancia/src/core/automazioni.js`).
 *
 * Quello che deve restare vero: ogni QUANDO scatta al passaggio e non a ogni
 * lettura; il SOLO SE si guarda quando il QUANDO scatta; l'ALLORA diventa
 * servizi scelti qui e mai scritti da chi salva; «aspetta» sopravvive a un
 * riavvio breve; l'alba si calcola in casa; una fascia attraversa la
 * mezzanotte; la lavatrice ha finito dopo X minuti fermi; il cronotermostato
 * comanda ai passaggi e si spegne con la finestra aperta; senza Premium non
 * parte niente; lo stato lo legge solo chi ha un nome, e le automazioni le
 * scrive solo chi ha un utente.
 */

import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  albaETramonto,
  automazionePulita,
  automazioniPulite,
  azioneDellaPlancia,
  condizioneVera,
  cronoDecide,
  cronoProssimo,
  eCompleta,
  fascePulite,
  passiDellAllora,
  prossimiEventi,
  prossimoIstante,
  serviziDellAzione,
  soleDelGiorno,
  valutaIlQuando,
} from "../plancia/src/core/automazioni.js";
import { Automazioni } from "../src/automazioni.js";
import { Commissioni, conservaLeAutomazioni } from "../src/commissioni.js";

const MINUTO = 60_000;
/* Sabato 17 ottobre 2026, nell'ora della casa. */
const alle = (giorno, ore, minuti = 0, secondi = 0) =>
  new Date(2026, 9, giorno, ore, minuti, secondi).getTime();
const s = (state, attributes = {}, dal = 0) => ({ state, attributes, dal });
const regola = (quando, allora = [{ tipo: "accendi", entita: "light.corridoio" }], piu = {}) =>
  automazionePulita({ id: "a1", nome: "Prova", quando, allora, ...piu });

/* ── la forma ────────────────────────────────────────────────────────────── */

test("si pulisce quello che arriva: tipi, domini, limiti", () => {
  const a = automazionePulita({
    id: "x1",
    nome: "  Luce  ",
    quando: { tipo: "movimento", entita: ["binary_sensor.pir", "light.no", "BAD"], verso: "si" },
    soloSe: [{ tipo: "notte" }, { tipo: "casa", chi: "nessuno" }, { tipo: "giorni" }],
    allora: [
      { tipo: "accendi", entita: "light.corridoio", livello: 140 },
      { tipo: "tapparella", entita: "lock.porta", modo: "apri" },
      { tipo: "aspetta", minuti: 99999 },
      { tipo: "servizio", domain: "lock", service: "unlock" },
    ],
  });
  assert.equal(a.nome, "Luce");
  assert.deepEqual(a.quando.entita, ["binary_sensor.pir"]);
  assert.equal(a.soloSe.length, 2, "al massimo due condizioni");
  assert.deepEqual(a.allora, [
    { tipo: "accendi", entita: "light.corridoio", livello: 100 },
    { tipo: "aspetta", minuti: 720 },
  ]);
  assert.equal(automazionePulita({ nome: "senza id" }), null);
  assert.equal(automazioniPulite(JSON.stringify([a, a])).length, 1, "niente id doppi");
  assert.equal(eCompleta(a), true);
  assert.equal(eCompleta(regola({ tipo: "apertura", entita: [] })), false);
});

/* ── QUANDO ──────────────────────────────────────────────────────────────── */

test("orario: scatta una volta all'ora giusta, nei giorni scelti, e non recupera ore vecchie", () => {
  const q = regola({
    tipo: "orario",
    ore: ["07:15"],
    giorni: [true, true, true, true, true, false, false],
  }).quando;
  // Venerdi' 16: giorno scelto.
  let r = valutaIlQuando(q, { adesso: alle(16, 7, 15, 10), giroPrima: alle(16, 7, 14, 50) });
  assert.equal(r.scatta, true);
  r = valutaIlQuando(q, {
    adesso: alle(16, 7, 15, 30),
    giroPrima: alle(16, 7, 15, 10),
    traccia: r.traccia,
  });
  assert.equal(r.scatta, false, "non due volte");
  // Sabato 17: giorno spento.
  assert.equal(
    valutaIlQuando(q, { adesso: alle(17, 7, 15, 10), giroPrima: alle(17, 7, 14, 50) }).scatta,
    false,
  );
  // Casa riaccesa alle 11: le 7:15 non si recuperano.
  assert.equal(valutaIlQuando(q, { adesso: alle(16, 11), giroPrima: alle(16, 6) }).scatta, false);
  assert.equal(prossimoIstante(q, alle(16, 8)), alle(19, 7, 15), "il prossimo e' lunedi'");
});

test("alba e tramonto: calcolati in casa dalla posizione, e sun.sun quando dice di oggi", () => {
  /* Roma, 17 ottobre: alba alle 5:24 UTC, tramonto alle 16:26 UTC. */
  const r = albaETramonto(41.9, 12.5, alle(17, 12));
  const utc = (t) => new Date(t).getUTCHours() * 60 + new Date(t).getUTCMinutes();
  assert.ok(Math.abs(utc(r.alba) - (5 * 60 + 24)) <= 3, `alba ${new Date(r.alba).toISOString()}`);
  assert.ok(Math.abs(utc(r.tramonto) - (16 * 60 + 26)) <= 3);
  const stati = {
    "zone.home": s("zoning", { latitude: 41.9, longitude: 12.5 }),
    "sun.sun": s("below_horizon", {
      next_rising: new Date(alle(17, 7, 30)).toISOString(),
      next_setting: new Date(alle(17, 18, 40)).toISOString(),
    }),
  };
  const oggi = soleDelGiorno((id) => stati[id], alle(17, 3));
  assert.equal(oggi.alba, alle(17, 7, 30), "per oggi vale sun.sun");
  const domani = soleDelGiorno((id) => stati[id], alle(18, 3));
  assert.notEqual(domani.alba, alle(18, 7, 30), "per domani la formula");
  // Un orario al tramonto meno trenta minuti.
  const q = regola({ tipo: "orario", sole: "tramonto", scarto: -30 }).quando;
  const r2 = valutaIlQuando(q, {
    stati,
    adesso: alle(17, 18, 10, 5),
    giroPrima: alle(17, 18, 9, 45),
  });
  assert.equal(r2.scatta, true);
});

test("apertura e movimento: al passaggio, e «nessun movimento da X minuti» una volta per silenzio", () => {
  const ap = regola({ tipo: "apertura", entita: ["binary_sensor.finestra"], verso: "apre" }).quando;
  const cambio = (prima, dopo, id = "binary_sensor.finestra") => ({
    id,
    prima: s(prima),
    dopo: s(dopo),
  });
  assert.equal(valutaIlQuando(ap, { cambio: cambio("off", "on"), adesso: 1 }).scatta, true);
  assert.equal(valutaIlQuando(ap, { cambio: cambio("on", "off"), adesso: 1 }).scatta, false);
  assert.equal(
    valutaIlQuando(ap, { cambio: cambio("unavailable", "on"), adesso: 1 }).scatta,
    false,
  );
  assert.equal(
    valutaIlQuando(ap, { cambio: cambio("off", "on", "binary_sensor.altra"), adesso: 1 }).scatta,
    false,
  );

  const si = regola({ tipo: "movimento", entita: ["binary_sensor.pir"], verso: "si" }).quando;
  assert.equal(
    valutaIlQuando(si, { cambio: cambio("off", "on", "binary_sensor.pir"), adesso: 1 }).scatta,
    true,
  );

  const no = regola({
    tipo: "movimento",
    entita: ["binary_sensor.pir"],
    verso: "no",
    minuti: 10,
  }).quando;
  const fermo = { "binary_sensor.pir": s("off", {}, alle(17, 10)) };
  assert.equal(valutaIlQuando(no, { stati: fermo, adesso: alle(17, 10, 5) }).scatta, false);
  const r = valutaIlQuando(no, { stati: fermo, adesso: alle(17, 10, 11) });
  assert.equal(r.scatta, true);
  assert.equal(
    valutaIlQuando(no, { stati: fermo, adesso: alle(17, 10, 20), traccia: r.traccia }).scatta,
    false,
  );
  const dopo = { "binary_sensor.pir": s("off", {}, alle(17, 10, 30)) };
  assert.equal(
    valutaIlQuando(no, { stati: dopo, adesso: alle(17, 10, 41), traccia: r.traccia }).scatta,
    true,
    "un silenzio nuovo vale di nuovo",
  );
});

test("valore: scatta al passaggio della soglia, non a ogni lettura, e si riarma con l'isteresi", () => {
  const q = regola({ tipo: "valore", entita: "sensor.umidita", verso: "sopra", soglia: 70 }).quando;
  let traccia = {};
  const leggi = (v) => {
    const r = valutaIlQuando(q, { stati: { "sensor.umidita": s(String(v)) }, adesso: 1, traccia });
    traccia = r.traccia;
    return r.scatta;
  };
  assert.equal(leggi(75), false, "gia' sopra quando nasce: non e' un passaggio");
  assert.equal(leggi(69.5), false);
  assert.equal(leggi(68), false, "rientrato oltre la banda: riarmato");
  assert.equal(leggi(71), true);
  assert.equal(leggi(72), false, "non a ogni lettura");
  assert.equal(leggi(69.9), false);
  assert.equal(leggi(70.5), false, "sotto di un soffio non riarma");
  assert.equal(leggi(68.5), false);
  assert.equal(leggi(70.2), true);
});

test("persone: arriva, esce, tutti fuori", () => {
  const stati = { "person.a": s("not_home"), "person.b": s("home") };
  const cambio = (id, prima, dopo) => ({ id, prima: s(prima), dopo: s(dopo) });
  const arriva = regola({ tipo: "persone", verso: "arriva" }).quando;
  assert.equal(
    valutaIlQuando(arriva, { stati, cambio: cambio("person.a", "not_home", "home"), adesso: 1 })
      .scatta,
    true,
  );
  const fuori = regola({ tipo: "persone", verso: "tuttiFuori" }).quando;
  assert.equal(
    valutaIlQuando(fuori, {
      stati: { "person.a": s("not_home"), "person.b": s("home") },
      cambio: cambio("person.c", "home", "not_home"),
      adesso: 1,
    }).scatta,
    false,
    "chi non e' una persona della casa non conta",
  );
  assert.equal(
    valutaIlQuando(fuori, {
      stati: { "person.a": s("not_home"), "person.b": s("not_home") },
      cambio: cambio("person.b", "home", "not_home"),
      adesso: 1,
    }).scatta,
    true,
  );
  assert.equal(
    valutaIlQuando(fuori, {
      stati: { "person.a": s("home"), "person.b": s("not_home") },
      cambio: cambio("person.b", "home", "not_home"),
      adesso: 1,
    }).scatta,
    false,
  );
});

test("antifurto: si inserisce, suona", () => {
  const ins = regola({
    tipo: "antifurto",
    entita: "alarm_control_panel.casa",
    verso: "inserito",
  }).quando;
  const c = (p, d) => ({ id: "alarm_control_panel.casa", prima: s(p), dopo: s(d) });
  assert.equal(valutaIlQuando(ins, { cambio: c("arming", "armed_away"), adesso: 1 }).scatta, true);
  assert.equal(
    valutaIlQuando(ins, { cambio: c("armed_home", "armed_away"), adesso: 1 }).scatta,
    false,
  );
  const suona = regola({
    tipo: "antifurto",
    entita: "alarm_control_panel.casa",
    verso: "suona",
  }).quando;
  assert.equal(
    valutaIlQuando(suona, { cambio: c("armed_away", "triggered"), adesso: 1 }).scatta,
    true,
  );
});

test("elettrodomestico: ha finito dopo X minuti sotto soglia, dopo essere stato sopra; le pause non contano", () => {
  const q = regola({
    tipo: "elettrodomestico",
    entita: "sensor.lavatrice_w",
    soglia: 5,
    minuti: 3,
  }).quando;
  let traccia = {};
  const w = (watt, minuto, unita = "W") => {
    const r = valutaIlQuando(q, {
      stati: { "sensor.lavatrice_w": s(String(watt), { unit_of_measurement: unita }) },
      adesso: alle(17, 10, minuto),
      traccia,
    });
    traccia = r.traccia;
    return r.scatta;
  };
  assert.equal(w(1, 0), false, "ferma: niente da finire");
  assert.equal(w(2000, 1), false);
  assert.equal(w(0.4, 2, "kW"), false, "400 W in kilowatt: gira");
  assert.equal(w(1800, 4), false);
  assert.equal(traccia.fase, "gira");
  assert.equal(w(2, 10), false, "una pausa");
  assert.equal(w(300, 11), false, "riparte: la pausa non chiude");
  assert.equal(w(1, 20), false);
  assert.equal(w(1, 22), false);
  assert.equal(w(1, 23), true, "tre minuti fermi: ha finito");
  assert.equal(w(1, 40), false, "una volta sola");
});

/* ── SOLO SE ─────────────────────────────────────────────────────────────── */

test("solo se: fascia oltre la mezzanotte, notte col sole, giorni, casa, stato, valore", () => {
  const fascia = { tipo: "notte", da: "23:00", a: "06:00" };
  assert.equal(condizioneVera(fascia, { adesso: alle(17, 2) }), true);
  assert.equal(condizioneVera(fascia, { adesso: alle(17, 23, 30) }), true);
  assert.equal(condizioneVera(fascia, { adesso: alle(17, 12) }), false);
  assert.equal(
    condizioneVera({ tipo: "fascia", da: "08:00", a: "20:00" }, { adesso: alle(17, 20) }),
    false,
  );
  const sole = {
    "sun.sun": s("x", {
      next_rising: new Date(alle(17, 7, 20)).toISOString(),
      next_setting: new Date(alle(17, 18, 30)).toISOString(),
    }),
  };
  assert.equal(condizioneVera({ tipo: "notte" }, { stati: sole, adesso: alle(17, 19) }), true);
  assert.equal(condizioneVera({ tipo: "notte" }, { stati: sole, adesso: alle(17, 12) }), false);
  assert.equal(
    condizioneVera(
      { tipo: "giorni", giorni: [false, false, false, false, false, true, true] },
      { adesso: alle(17, 12) },
    ),
    true,
  );
  const casa = { "person.a": s("not_home") };
  assert.equal(condizioneVera({ tipo: "casa", chi: "nessuno" }, { stati: casa, adesso: 1 }), true);
  assert.equal(
    condizioneVera(
      { tipo: "stato", entita: "light.x", vale: "acceso" },
      { stati: { "light.x": s("on") }, adesso: 1 },
    ),
    true,
  );
  assert.equal(
    condizioneVera(
      { tipo: "stato", entita: "light.x", vale: "spento" },
      { stati: { "light.x": s("unavailable") }, adesso: 1 },
    ),
    false,
  );
  assert.equal(
    condizioneVera(
      { tipo: "valore", entita: "sensor.t", verso: "sotto", soglia: 18 },
      { stati: { "sensor.t": s("17,5") }, adesso: 1 },
    ),
    true,
  );
});

/* ── ALLORA ──────────────────────────────────────────────────────────────── */

test("allora: il servizio giusto per ogni dominio, e mai una serratura", () => {
  const uno = (a, stati = {}) => serviziDellAzione(a, { stati })[0];
  assert.deepEqual(uno({ tipo: "accendi", entita: "light.c", livello: 20 }), {
    domain: "light",
    service: "turn_on",
    data: { entity_id: "light.c", brightness_pct: 20 },
  });
  assert.deepEqual(uno({ tipo: "accendi", entita: "script.notte" }), {
    domain: "script",
    service: "turn_on",
    data: { entity_id: "script.notte" },
  });
  assert.deepEqual(uno({ tipo: "accendi", entita: "button.cancello" }), {
    domain: "button",
    service: "press",
    data: { entity_id: "button.cancello" },
  });
  assert.equal(uno({ tipo: "spegni", entita: "scene.x" }), undefined, "una scena non si spegne");
  assert.deepEqual(
    uno({ tipo: "tapparella", entita: "cover.s", modo: "posizione", posizione: 30 }),
    {
      domain: "cover",
      service: "set_cover_position",
      data: { entity_id: "cover.s", position: 30 },
    },
  );
  const clima = serviziDellAzione(
    { tipo: "clima", entita: "climate.s", gradi: 21 },
    { stati: { "climate.s": s("off") } },
  );
  assert.deepEqual(
    clima.map((x) => x.service),
    ["turn_on", "set_temperature"],
    "un clima spento si accende prima",
  );
  assert.equal(serviziDellAzione({ tipo: "accendi", entita: "lock.porta" }).length, 0);
  assert.equal(azioneDellaPlancia({ name: "Apri", entity: "lock.porta", type: "entity" }), null);
  assert.equal(azioneDellaPlancia({ name: "Cinema", entity: "scene.cinema", confirm: true }), null);
  const passi = passiDellAllora(
    [
      { tipo: "azione", nome: "Esco" },
      { tipo: "aspetta", minuti: 2 },
      { tipo: "notifica", testo: "Fatto" },
    ],
    { azioni: [{ name: "Esco", entity: "scene.esco", type: "scene" }] },
  );
  assert.deepEqual(passi, [
    { servizio: { domain: "scene", service: "turn_on", data: { entity_id: "scene.esco" } } },
    { aspetta: 2 * MINUTO },
    { notifica: "Fatto" },
  ]);
});

/* ── il cronotermostato ──────────────────────────────────────────────────── */

test("cronotermostato: comanda ai passaggi, Lun–Ven e Sab–Dom, e la finestra lo spegne finche' e' aperta", () => {
  const crono = {
    termostati: ["climate.s"],
    inCasa: 21,
    fuori: 18,
    feriali: [
      [360, 480],
      [1020, 1320],
    ],
    festivi: [[480, 1320]],
    finestre: ["binary_sensor.f"],
  };
  const stati = {
    "climate.s": s("heat", { hvac_modes: ["off", "heat"] }),
    "binary_sensor.f": s("off"),
  };
  // Venerdi' alle 7: in fascia.
  let r = cronoDecide(crono, { adesso: alle(16, 7), stati });
  assert.equal(r.voluto, 21);
  assert.deepEqual(r.comandi[0].servizi[0], {
    domain: "climate",
    service: "set_temperature",
    data: { entity_id: "climate.s", temperature: 21 },
  });
  // Stesso voluto gia' chiesto: niente (chi lo cambia a mano ha ragione fino al passaggio).
  assert.equal(
    cronoDecide(crono, { adesso: alle(16, 7, 30), stati, traccia: { voluto: { "climate.s": 21 } } })
      .comandi.length,
    0,
  );
  // Sabato alle 7: fuori fascia festiva.
  assert.equal(cronoDecide(crono, { adesso: alle(17, 7), stati }).voluto, 18);
  // Finestra aperta: si spegne; chiusa: riparte con la sua temperatura e la modalita' caldo.
  r = cronoDecide(crono, {
    adesso: alle(16, 7),
    stati: { ...stati, "binary_sensor.f": s("on") },
    traccia: { voluto: { "climate.s": 21 } },
  });
  assert.equal(r.comandi[0].servizi[0].service, "turn_off");
  r = cronoDecide(crono, {
    adesso: alle(16, 7, 5),
    stati: { ...stati, "climate.s": s("off", { hvac_modes: ["off", "heat"] }) },
    traccia: { voluto: { "climate.s": "spento" } },
  });
  assert.deepEqual(r.comandi[0].servizi[0].data, {
    entity_id: "climate.s",
    temperature: 21,
    hvac_mode: "heat",
  });
  assert.deepEqual(cronoProssimo(crono, alle(16, 7)), { alle: alle(16, 8), voluto: 18 });
  assert.deepEqual(
    fascePulite([
      [370, 470],
      [460, 600],
    ]),
    [[360, 600]],
    "mezz'ore intere, unite",
  );
});

/* ── la casa che esegue ──────────────────────────────────────────────────── */

function unaCasa({
  automazioni = [],
  premium = true,
  attive = true,
  stati = {},
  azioni = [],
} = {}) {
  let ora = alle(16, 7, 14, 50);
  const chiamate = [];
  const avvisi = [];
  const mappa = new Map(Object.entries(stati));
  const valori = {
    cd_automazioni: JSON.stringify(automazioni),
    cd_quick_actions: JSON.stringify(azioni),
  };
  const cartella = mkdtempSync(join(tmpdir(), "automazioni-"));
  const fai = () =>
    new Automazioni({
      cartella,
      casa: { chiedi: async (m) => chiamate.push(m) },
      configurazione: { leggi: () => ({ snapshot: { values: valori } }) },
      stati: () => mappa,
      notifiche: { consegna: async (e) => avvisi.push(e) },
      licenze: { attive, premium },
      adesso: () => ora,
      ogni: () => null,
    });
  return {
    fai,
    chiamate,
    avvisi,
    mappa,
    valori,
    passa: (minuti) => {
      ora += minuti * MINUTO;
    },
    get ora() {
      return ora;
    },
  };
}

const luceColMovimento = {
  id: "luce",
  nome: "Luce corridoio di notte",
  quando: { tipo: "movimento", entita: ["binary_sensor.pir"], verso: "si" },
  soloSe: [{ tipo: "notte", da: "23:00", a: "06:00" }],
  allora: [
    { tipo: "accendi", entita: "light.corridoio", livello: 20 },
    { tipo: "aspetta", minuti: 2 },
    { tipo: "spegni", entita: "light.corridoio" },
    { tipo: "notifica", testo: "Movimento in corridoio" },
  ],
};

test("la casa esegue: accende, aspetta, e dopo un riavvio breve finisce il lavoro", async () => {
  const casa = unaCasa({ automazioni: [luceColMovimento] });
  casa.passa(-7 * 60 + 2 * 60 + 15); // le 2:30 di notte
  const uno = casa.fai();
  uno.quandoCambia("binary_sensor.pir", s("on"), s("off"));
  await new Promise((r) => setImmediate(r));
  assert.equal(casa.chiamate.length, 1);
  assert.equal(casa.chiamate[0].service, "turn_on");
  assert.equal(uno.stato().inCorso.length, 1, "aspetta due minuti");
  // L'add-on si riavvia nel mezzo.
  casa.passa(3);
  const due = casa.fai();
  due.parti();
  await due.battito();
  assert.deepEqual(
    casa.chiamate.map((c) => c.service),
    ["turn_on", "turn_off"],
  );
  assert.equal(casa.avvisi[0].parole.it.testo, "Movimento in corridoio");
  assert.equal(casa.avvisi[0].tipo, "personalizzata");
  const stato = due.stato();
  assert.equal(stato.perAutomazione.luce.esito, "ok");
  assert.equal(stato.ultime[0].id, "luce");
});

test("di giorno il SOLO SE la ferma; e un riavvio lungo butta l'attesa", async () => {
  const casa = unaCasa({ automazioni: [luceColMovimento] });
  const uno = casa.fai();
  uno.quandoCambia("binary_sensor.pir", s("on"), s("off"));
  await new Promise((r) => setImmediate(r));
  assert.equal(casa.chiamate.length, 0, "alle 7:15 non e' notte");
  casa.passa(-7 * 60 - 15 + 23 * 60 + 30);
  uno.quandoCambia("binary_sensor.pir", s("on"), s("off"));
  await new Promise((r) => setImmediate(r));
  assert.equal(casa.chiamate.length, 1);
  casa.passa(120);
  const due = casa.fai();
  due.parti();
  await due.battito();
  assert.equal(casa.chiamate.length, 1, "due ore dopo la luce non si tocca piu'");
});

test("un orario fatto dal battito, e il prossimo nello stato", async () => {
  const casa = unaCasa({
    automazioni: [
      {
        id: "tapp",
        nome: "Tapparelle",
        quando: { tipo: "orario", ore: ["07:15", "21:30"] },
        allora: [{ tipo: "tapparella", entita: "cover.soggiorno", modo: "apri" }],
      },
    ],
  });
  const a = casa.fai();
  await a.battito();
  casa.passa(0.5);
  await a.battito();
  assert.equal(casa.chiamate.length, 1);
  assert.equal(casa.chiamate[0].service, "open_cover");
  assert.equal(a.stato().prossimi[0].alle, alle(16, 21, 30));
  assert.deepEqual(
    prossimiEventi(a.elenco(), alle(16, 22)).map((p) => p.alle),
    [alle(17, 7, 15)],
  );
});

test("senza Premium le automazioni restano salvate ma non parte niente", async () => {
  const casa = unaCasa({ automazioni: [luceColMovimento], premium: false });
  casa.passa(-5 * 60);
  const a = casa.fai();
  a.quandoCambia("binary_sensor.pir", s("on"), s("off"));
  await a.battito();
  assert.equal(casa.chiamate.length, 0);
  assert.equal(a.stato().premium, false);
  assert.equal(a.elenco().length, 1, "restano salvate");
  // Con le licenze spente (chiave vuota) e' tutto aperto, come i viaggi.
  assert.equal(unaCasa({ premium: false, attive: false }).fai().sbloccato, true);
});

test("il cronotermostato dalla casa: comanda una volta, e la finestra lo spegne subito", async () => {
  const casa = unaCasa({
    automazioni: [
      {
        id: "crono",
        nome: "Cronotermostato",
        tipo: "crono",
        crono: { termostati: ["climate.s"], finestre: ["binary_sensor.f"] },
      },
    ],
    stati: { "climate.s": s("heat", { hvac_modes: ["off", "heat"] }), "binary_sensor.f": s("off") },
  });
  const a = casa.fai();
  await a.battito();
  await a.battito();
  assert.equal(casa.chiamate.length, 1);
  casa.mappa.set("binary_sensor.f", s("on"));
  a.quandoCambia("binary_sensor.f", s("on"), s("off"));
  await new Promise((r) => setImmediate(r));
  assert.equal(casa.chiamate.at(-1).service, "turn_off");
});

test("lo stato lo legge solo chi ha un nome, da commissioni.js", async () => {
  const casa = unaCasa({ automazioni: [luceColMovimento] });
  const commissioni = new Commissioni({ automazioni: casa.fai() });
  const senza = await commissioni.rispondi({ id: 1, type: "ponte/automazioni/stato" });
  assert.equal(senza.success, false);
  assert.equal(senza.error.code, "unauthorized");
  const con = await commissioni.rispondi(
    { id: 2, type: "ponte/automazioni/stato" },
    { chiChiede: "u1" },
  );
  assert.equal(con.success, true);
  assert.equal(con.result.attive, 1);
});

test("le automazioni le scrive solo chi ha un utente", () => {
  const salvati = { cd_automazioni: "[1]", cd_luci: "a" };
  assert.deepEqual(conservaLeAutomazioni({ cd_automazioni: "[2]", cd_luci: "b" }, salvati, ""), {
    cd_automazioni: "[1]",
    cd_luci: "b",
  });
  assert.deepEqual(conservaLeAutomazioni({ cd_automazioni: "[2]" }, {}, ""), {});
  assert.deepEqual(conservaLeAutomazioni({ cd_automazioni: "[2]" }, salvati, "u1"), {
    cd_automazioni: "[2]",
  });
});
