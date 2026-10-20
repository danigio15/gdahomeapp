/* «La tua giornata» per intero, e il Premium delle notifiche.
 *
 * Quello che deve restare vero:
 *
 *  - Premium lo decide il ponte, come per le automazioni: gdahome Premium o
 *    licenze spente. In Base le notifiche sono tutte semplici e senza foto,
 *    il riepilogo della sera non c'e', le righe «nel riepilogo» partono
 *    subito, «La tua giornata» dice `premium-richiesto`; gli avvisi di
 *    sicurezza arrivano sempre. Quando il Premium scade non si perde niente.
 *  - Il diario della casa annota il clima, il riscaldamento, il solare
 *    termico, l'auto (ricariche e viaggi), l'acqua e gli eventi; ogni
 *    sezione c'e' solo se in casa c'e' il dispositivo.
 *  - Nella risposta nessuna entita' e nessun nome di persona.
 */

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { Dispositivi } from "../src/dispositivi.js";
import {
  DiarioDellaCasa,
  capacitaDellAccumulo,
  consiglioPerDomani,
  daSistemare,
  ilConfronto,
  ilMese,
  inBreve,
  prezziDelleFasce,
  prezzoDiCessione,
  senzaNomiDiPersone,
} from "../src/la-giornata-di-casa.js";
import { TaccuinoDellEnergia } from "../src/l-energia-di-casa.js";
import { cieloDiDomani, LA_GIORNATA, LE_RICARICHE_DI_CASA, Notifiche } from "../src/notifiche.js";
import { apriLaSpinta } from "../src/spinta.js";

const MINUTO = 60 * 1000;
const UTENTE_A = "a".repeat(32);
const alle = (ore, minuti = 0) => new Date(2026, 9, 18, ore, minuti).getTime();

/* ─── Il Premium delle notifiche ─────────────────────────────────────── */

function unBanco({ licenze = null, adesso = alle(12) } = {}) {
  const cartella = mkdtempSync(join(tmpdir(), "premium-"));
  const orologio = { ora: adesso };
  const dispositivi = new Dispositivi({ cartella, adesso: () => orologio.ora });
  const a = dispositivi.abbina({ nome: "Telefono A", utente: UTENTE_A });
  const spinte = [];
  const foto = [];
  const postino = {
    pronto: true,
    spingi: (spinta) => {
      spinte.push(spinta);
      return true;
    },
    mandaLaFoto: async (una) => {
      foto.push(una);
      return "foto-1";
    },
    diIGettoni: () => {},
  };
  const notifiche = new Notifiche({
    cartella,
    dispositivi,
    utenti: {
      elenco: async () => [{ id: UTENTE_A, nome: "Persona 1", amministratore: true }],
      eVivo: async () => true,
    },
    casa: {
      chiedi: async () => [],
      ascolta: async () => () => {},
      immagine: async () => Buffer.from("jpeg"),
    },
    postino,
    licenze,
    adesso: () => orologio.ora,
  });
  const chiedi = (detto) => notifiche.rispondi({ id: 1, ...detto }, { dispositivo: a.dispositivo });
  const apri = (spinta) =>
    apriLaSpinta({ chiaveDelFilo: a.chiave, telefono: a.dispositivo.id, busta: spinta.busta });
  return {
    notifiche,
    orologio,
    spinte,
    foto,
    chiedi,
    apri,
    spegni: () => {
      notifiche.ferma();
      rmSync(cartella, { recursive: true, force: true });
    },
  };
}

const movimento = () => ({
  tipo: "movimento",
  urgenza: "normale",
  chiave: `movimento:${Math.random()}`,
  pausa: 0,
  camera: "camera.ingresso",
  conFoto: true,
  parole: { it: { titolo: "Movimento all'ingresso", testo: "18:22" } },
  azioni: [],
});

const antifurto = () => ({
  tipo: "antifurto",
  urgenza: "urgente",
  chiave: "antifurto:x",
  pausa: 0,
  camera: "camera.ingresso",
  conFoto: true,
  parole: { it: { titolo: "Antifurto scattato", testo: "Ingresso" } },
  azioni: [],
});

async function conGettoneElaborate(banco, su = {}) {
  await banco.chiedi({ type: "ponte/notifiche/registra", gettone: `g-${"x".repeat(30)}` });
  await banco.chiedi({
    type: "ponte/notifiche/imposta",
    impostazioni: { stile: "elaborate", silenzio: { acceso: false }, su },
  });
}

test("Premium: lo stato lo dice, con lo stesso criterio delle automazioni", async () => {
  for (const [licenze, atteso] of [
    [null, true],
    [{ attive: false, premium: false }, true],
    [{ attive: true, premium: true }, true],
    [{ attive: true, premium: false }, false],
  ]) {
    const banco = unBanco({ licenze });
    try {
      const stato = await banco.chiedi({ type: "ponte/notifiche/stato" });
      assert.equal(stato.result.premium, atteso, JSON.stringify(licenze));
    } finally {
      banco.spegni();
    }
  }
});

test("Base: tutte semplici e senza foto; Premium: elaborate con la foto", async () => {
  const licenze = { attive: true, premium: true };
  const banco = unBanco({ licenze });
  try {
    await conGettoneElaborate(banco, { movimento: { quando: "sempre" } });
    assert.equal(await banco.notifiche.consegna(movimento()), 1);
    let detto = banco.apri(banco.spinte.at(-1));
    assert.equal(detto.stile, "e");
    assert.deepEqual(detto.foto, { id: "foto-1", t: "image/jpeg" });
    assert.equal(banco.foto.length, 1);

    /* Il Premium scade: si torna da soli alle semplici, senza foto. */
    licenze.premium = false;
    banco.orologio.ora += 2 * MINUTO;
    assert.equal(await banco.notifiche.consegna(movimento()), 1);
    detto = banco.apri(banco.spinte.at(-1));
    assert.equal(detto.stile, "s");
    assert.equal(detto.foto, undefined);
    assert.equal(banco.foto.length, 1, "nessuna foto lascia la casa");
    /* Le impostazioni del telefono restano quelle, per quando torna. */
    const stato = await banco.chiedi({ type: "ponte/notifiche/stato" });
    assert.equal(stato.result.impostazioni.stile, "elaborate");

    /* La sicurezza arriva sempre, anche in Base. */
    assert.equal(await banco.notifiche.consegna(antifurto()), 1);
    assert.equal(banco.apri(banco.spinte.at(-1)).titolo, "Antifurto scattato");
  } finally {
    banco.spegni();
  }
});

test("Base: niente riepilogo, e le righe «nel riepilogo» partono subito", async () => {
  const licenze = { attive: true, premium: true };
  const banco = unBanco({ licenze, adesso: alle(15) });
  try {
    await conGettoneElaborate(banco, {
      movimento: { come: "riepilogo", quando: "sempre" },
      elettrodomestici: { come: "riepilogo" },
    });
    /* Con Premium la riga si mette da parte. */
    assert.equal(await banco.notifiche.consegna(movimento()), 0);
    assert.equal(banco.spinte.length, 0);
    /* Il Premium scade prima della sera: la riga parte al battito, semplice. */
    licenze.premium = false;
    await banco.notifiche._riepiloghi();
    assert.equal(banco.spinte.length, 1, "nessuna notifica persa");
    assert.equal(banco.apri(banco.spinte[0]).titolo, "Movimento all'ingresso");
    assert.equal(banco.apri(banco.spinte[0]).stile, "s");
    /* E quelle nuove non aspettano la sera. */
    assert.equal(await banco.notifiche.consegna(movimento()), 1);

    /* All'ora del riepilogo, in Base, non parte niente. */
    banco.notifiche.sentinella.riepilogo = () => ({
      tipo: "riepilogo",
      urgenza: "bassa",
      chiave: "riepilogo",
      componi: { tipo: "riepilogo", dati: { giornata: null } },
      parole: { it: { titolo: "Riepilogo", testo: "1 batteria scarica" } },
    });
    banco.orologio.ora = alle(20, 32);
    const prima = banco.spinte.length;
    await banco.notifiche._riepiloghi();
    assert.equal(banco.spinte.length, prima);
    assert.equal(
      await banco.notifiche.consegna({
        tipo: "riepilogo",
        urgenza: "bassa",
        chiave: "r",
        parole: { it: { titolo: "x", testo: "" } },
      }),
      0,
    );
    /* Nemmeno di prova. */
    const prova = await banco.chiedi({ type: "ponte/notifiche/prova", tipo: "riepilogo" });
    assert.equal(prova.error.code, "premium-richiesto");

    /* Il Premium torna: il riepilogo della sera c'e' di nuovo. */
    licenze.premium = true;
    banco.orologio.ora = alle(20, 33);
    banco.notifiche._riepilogoDel.clear();
    await banco.notifiche._riepiloghi();
    assert.equal(banco.spinte.length, prima + 1);
  } finally {
    banco.spegni();
  }
});

test("Base: `ponte/energia/giornata` dice premium-richiesto, solo a chi ha un utente", async () => {
  const banco = unBanco({ licenze: { attive: true, premium: false } });
  try {
    const detto = await banco.chiedi({ type: LA_GIORNATA });
    assert.equal(detto.success, false);
    assert.equal(detto.error.code, "premium-richiesto");
    const senza = await banco.notifiche.rispondi(
      { id: 2, type: LA_GIORNATA },
      { dispositivo: { id: "b".repeat(32) } },
    );
    assert.equal(senza.error.code, "unauthorized", "prima chi e', poi il Premium");
  } finally {
    banco.spegni();
  }
});

/* ─── Il diario della casa ───────────────────────────────────────────── */

const st = (state, attributes = {}) => ({ state: String(state), attributes, dal: 0 });

function unaCasa() {
  return new Map([
    ["sensor.t_soggiorno", st(20, { device_class: "temperature", unit_of_measurement: "°C" })],
    ["sensor.u_soggiorno", st(48, { device_class: "humidity" })],
    ["sensor.t_camera", st(19, { device_class: "temperature", unit_of_measurement: "°C" })],
    ["weather.casa", st("sunny", { temperature: 9.1 })],
    [
      "climate.pdc",
      st("heat", {
        hvac_modes: ["off", "heat"],
        hvac_action: "heating",
        temperature: 21,
        current_temperature: 20,
      }),
    ],
    ["binary_sensor.finestra_bagno", st("off", { device_class: "window" })],
    ["binary_sensor.porta_ingresso", st("off", { device_class: "door" })],
    ["sensor.collettore", st(30, { unit_of_measurement: "°C" })],
    ["sensor.bollitore", st(45, { unit_of_measurement: "°C" })],
    ["binary_sensor.pompa_solare", st("off")],
    ["sensor.pressione_solare", st(2.1, { unit_of_measurement: "bar" })],
    ["sensor.auto_batteria", st(66, { unit_of_measurement: "%" })],
    ["sensor.wallbox_w", st(0, { unit_of_measurement: "W" })],
    ["sensor.auto_odometro", st(1000, { unit_of_measurement: "km" })],
    [
      "sensor.contatore_acqua",
      st(100, {
        device_class: "water",
        unit_of_measurement: "m³",
        state_class: "total_increasing",
      }),
    ],
    ["switch.zona_prato", st("off")],
    ["alarm_control_panel.casa", st("disarmed")],
    ["automation.luci", st("on", { last_triggered: null })],
    ["person.persona_1", st("home", { friendly_name: "Persona 1" })],
  ]);
}

const VALORI = {
  cd_stanze: [
    { name: "Soggiorno", temp: "sensor.t_soggiorno", hum: "sensor.u_soggiorno" },
    { name: "Camera", temp: "sensor.t_camera" },
  ],
  cd_entity_overrides: {
    "dm.boiler_sonda_temperatura_1": "sensor.collettore",
    "dm.boiler_sonda_temperatura_3": "sensor.bollitore",
    "dm.boiler_stato_pompa_solare": "binary_sensor.pompa_solare",
    "dm.boiler_pressione_acqua": "sensor.pressione_solare",
  },
  cd_ev_cars: [
    {
      name: "Auto elettrica",
      kwh: 60,
      ov: {
        "dm.ev_batteria_auto": "sensor.auto_batteria",
        "dm.ev_potenza_wallbox": "sensor.wallbox_w",
        "dm.ev_odometro": "sensor.auto_odometro",
      },
    },
  ],
  cd_contatori: { righe: [{ entity: "sensor.contatore_acqua", name: "Acqua", genere: "acqua" }] },
  cd_irrigazione: { zones: [{ entity: "switch.zona_prato", name: "Prato" }] },
};

function unDiario(stati, { adesso = alle(6) } = {}) {
  const orologio = { ora: adesso };
  const diario = new DiarioDellaCasa({ adesso: () => orologio.ora });
  const energia = { sole: 0, casa: 500, rete: 500 };
  const passa = (minuti, prima = () => {}) => {
    for (let i = 0; i < minuti * 2; i += 1) {
      orologio.ora += 30 * 1000;
      prima();
      diario.campiona({ stati, valori: VALORI, energia, prezzo: () => ({ prezzo: 0.2 }) });
    }
  };
  const cambia = (id, state, attributes) => {
    const vecchio = stati.get(id);
    const nuovo = st(state, attributes ?? vecchio?.attributes ?? {});
    stati.set(id, nuovo);
    diario.cambia(id, nuovo, vecchio, stati);
  };
  diario.campiona({ stati, valori: VALORI, energia, prezzo: () => ({ prezzo: 0.2 }) });
  return { diario, orologio, passa, cambia, energia };
}

test("il diario: clima, riscaldamento, solare termico, auto, acqua, eventi e conti", () => {
  const stati = unaCasa();
  const { diario, passa, cambia, energia } = unDiario(stati);
  /* La mattina: qualcuno si sveglia, la finestra si apre e si chiude. */
  cambia("binary_sensor.movimento_cucina", "off", { device_class: "motion" });
  cambia("binary_sensor.movimento_cucina", "on");
  cambia("binary_sensor.finestra_bagno", "on");
  cambia("binary_sensor.finestra_bagno", "off");
  cambia("binary_sensor.porta_ingresso", "on");
  cambia("automation.luci", "on", { last_triggered: "2026-10-18T06:01:00Z" });
  passa(60);
  /* Un viaggio: la batteria scende e l'odometro va avanti, senza caricare. */
  stati.get("climate.pdc").attributes.hvac_action = "idle";
  let giro = 0;
  passa(10, () => {
    giro += 1;
    const soc = Number(stati.get("sensor.auto_batteria").state);
    if (giro % 2 === 0)
      stati.set("sensor.auto_batteria", st(soc - 1, { unit_of_measurement: "%" }));
    const km = Number(stati.get("sensor.auto_odometro").state);
    stati.set("sensor.auto_odometro", st(km + 0.5, { unit_of_measurement: "km" }));
  });
  passa(30);
  /* Mezzogiorno: il sole scalda il collettore, l'auto carica col sole. */
  energia.sole = 9000;
  energia.casa = 1000;
  energia.rete = -1000;
  stati.set("sensor.collettore", st(80, { unit_of_measurement: "°C" }));
  stati.set("sensor.bollitore", st(65, { unit_of_measurement: "°C" }));
  stati.set("binary_sensor.pompa_solare", st("on"));
  stati.set("sensor.wallbox_w", st(7000, { unit_of_measurement: "W" }));
  passa(60, () => {
    const soc = Number(stati.get("sensor.auto_batteria").state);
    if (soc < 90) stati.set("sensor.auto_batteria", st(soc + 0.5, { unit_of_measurement: "%" }));
  });
  stati.set("sensor.wallbox_w", st(0, { unit_of_measurement: "W" }));
  stati.set("binary_sensor.pompa_solare", st("off"));
  /* L'acqua: 212 litri, 40 col prato. */
  stati.set("sensor.contatore_acqua", st(100.172, stati.get("sensor.contatore_acqua").attributes));
  passa(1);
  cambia("switch.zona_prato", "on");
  passa(1, () =>
    stati.set(
      "sensor.contatore_acqua",
      st(100.212, stati.get("sensor.contatore_acqua").attributes),
    ),
  );
  cambia("switch.zona_prato", "off");
  /* La sera: l'antifurto, la casa vuota, il rientro. */
  cambia("alarm_control_panel.casa", "armed_away");
  cambia("person.persona_1", "not_home");
  passa(60);
  cambia("person.persona_1", "home");
  cambia("alarm_control_panel.casa", "disarmed");
  diario.evento({
    tipo: "elettrodomestici",
    componi: { dati: { nome: "Lavatrice" } },
    misura: { euro: 0.05 },
  });
  passa(30);

  const r = diario.laGiornata({ stati, valori: VALORI });

  /* Il clima. */
  assert.deepEqual(
    r.clima.stanze.map((s) => s.nome),
    ["Soggiorno", "Camera"],
  );
  const soggiorno = r.clima.stanze[0];
  assert.equal(soggiorno.min, 20);
  assert.equal(soggiorno.umidita, 48);
  assert.equal(soggiorno.ore.length, 24);
  assert.equal(soggiorno.ore[3], null, "un'ora senza campioni e' vuota");
  assert.equal(soggiorno.ore[6], 20);
  assert.equal(r.clima.fuori.min, 9.1);

  /* Il riscaldamento. */
  assert.ok(r.riscaldamento.minutiAcceso >= 59 && r.riscaldamento.minutiAcceso <= 61);
  assert.equal(r.riscaldamento.obiettivo, 21);
  assert.deepEqual(r.riscaldamento.range, [19, 23]);
  assert.equal(r.riscaldamento.finestreAperte, 1);
  assert.equal(r.riscaldamento.comfort, 100);
  assert.equal(r.riscaldamento.ieriMinuti, null);

  /* Il solare termico. */
  assert.equal(r.solareTermico.collettore.max, 80);
  assert.equal(r.solareTermico.bollitore.max, 65);
  assert.equal(r.solareTermico.collettore.ore.length, 24);
  assert.ok(r.solareTermico.pompa.minuti >= 59);
  assert.match(r.solareTermico.pompa.da, /^\d\d:\d\d$/);
  assert.equal(r.solareTermico.pressione, 2.1);
  assert.equal(r.solareTermico.resistenzaMinuti, null, "senza resistenza mappata non si dice");

  /* L'auto: un viaggio di 10 punti e 10 km, una ricarica col sole. */
  assert.equal(r.auto.length, 1);
  const auto = r.auto[0];
  assert.equal(auto.nome, "Auto elettrica");
  assert.equal(auto.viaggi.length, 1);
  assert.equal(auto.viaggi[0].soc, 10);
  assert.equal(auto.viaggi[0].km, 10);
  assert.equal(auto.usatiKwh, 6);
  assert.equal(auto.km, 10);
  assert.equal(auto.kmStimati, false);
  assert.equal(auto.kwh100, 60);
  assert.equal(auto.ricariche.length, 1);
  const ricarica = auto.ricariche[0];
  assert.equal(ricarica.socDa, 56);
  assert.equal(ricarica.socA, 90);
  assert.ok(ricarica.kwh > 6 && ricarica.kwh < 7.5, `kWh ${ricarica.kwh}`);
  assert.equal(ricarica.quotaSole, 1, "col sole che avanza, tutta dal sole");
  assert.equal(ricarica.euro, 0);
  assert.equal(auto.socStasera, 90);
  assert.ok(auto.soc.length > 3 && auto.soc.every((p) => p.length === 2));

  /* L'acqua. */
  assert.equal(r.acqua.litri, 212);
  assert.deepEqual(r.acqua.irrigazione, { litri: 40, zone: 1, alle: r.acqua.irrigazione.alle });
  assert.equal(r.acqua.gas, null, "senza contatore del gas non si dice");

  /* Gli eventi e i conti. */
  const testi = r.eventi.map((e) => e.testo);
  assert.deepEqual(testi, [
    "Prima persona sveglia",
    "Antifurto inserito",
    "Casa vuota",
    "Rientro · casa vuota 1 h 0 min",
    "Antifurto disinserito",
    "Lavatrice: ciclo finito · 0,05 €",
  ]);
  assert.ok(r.eventi.every((e) => /^\d\d:\d\d$/.test(e.ora)));
  assert.deepEqual(r.conti, { porte: 1, automazioni: 1, avvisi: 0 });

  /* Niente entita', niente nomi. */
  const testo = JSON.stringify(r);
  assert.doesNotMatch(testo, /(sensor|climate|switch|binary_sensor|person|weather)\./);
  assert.doesNotMatch(testo, /Persona 1/);
});

test("il diario: senza dispositivi, ogni sezione e' null", () => {
  const stati = new Map([["light.cucina", st("off")]]);
  const diario = new DiarioDellaCasa({ adesso: () => alle(12) });
  diario.campiona({ stati, valori: {} });
  const r = diario.laGiornata({ stati, valori: {} });
  assert.deepEqual(r, {
    clima: null,
    riscaldamento: null,
    solareTermico: null,
    auto: null,
    acqua: null,
    eventi: [],
    conti: null,
  });
});

test("l'auto senza odometro: i chilometri si stimano, e un punto perso da ferma non e' un viaggio", () => {
  const stati = new Map([["sensor.auto_batteria", st(80, { unit_of_measurement: "%" })]]);
  const valori = { cd_entity_overrides: { "dm.ev_batteria_auto": "sensor.auto_batteria" } };
  const orologio = { ora: alle(3) };
  const diario = new DiarioDellaCasa({ adesso: () => orologio.ora });
  const passa = (minuti, prima = () => {}) => {
    for (let i = 0; i < minuti * 2; i += 1) {
      orologio.ora += 30 * 1000;
      prima();
      diario.campiona({ stati, valori });
    }
  };
  diario.campiona({ stati, valori });
  /* La notte perde un punto. */
  stati.set("sensor.auto_batteria", st(79, { unit_of_measurement: "%" }));
  passa(60);
  /* Il mattino un viaggio vero: 14 punti. */
  passa(14, () => {
    const soc = Number(stati.get("sensor.auto_batteria").state);
    if (orologio.ora % (60 * 1000) === 0)
      stati.set("sensor.auto_batteria", st(soc - 1, { unit_of_measurement: "%" }));
  });
  passa(30);
  const [auto] = diario.laGiornata({ stati, valori }).auto;
  assert.equal(auto.nome, "Auto");
  assert.equal(auto.viaggi.length, 1);
  assert.equal(auto.viaggi[0].soc, 14);
  /* 14% di 70 kWh = 9,8 kWh, a 17 kWh/100 km. */
  assert.equal(auto.viaggi[0].km, 58);
  assert.equal(auto.kmStimati, true);
  assert.equal(auto.kwh100, null);
  assert.equal(auto.ricariche.length, 0);
});

test("l'auto che dice capacita' e consumo: i chilometri si stimano coi suoi numeri", () => {
  /* GdAAuto dice quanti kWh tiene la batteria e quanto consuma davvero: la
   * stima dei chilometri senza odometro usa quelli, non 70 kWh e 17 kWh/100. */
  const stati = new Map([
    ["sensor.auto_batteria", st(80, { unit_of_measurement: "%" })],
    ["sensor.auto_capacita", st(50, { unit_of_measurement: "kWh" })],
    ["sensor.auto_consumo", st(14, { unit_of_measurement: "kWh/100 km" })],
  ]);
  const valori = {
    cd_entity_overrides: {
      "dm.ev_batteria_auto": "sensor.auto_batteria",
      "dm.ev_capacita_batteria": "sensor.auto_capacita",
      "dm.ev_consumo_medio": "sensor.auto_consumo",
    },
  };
  const orologio = { ora: alle(3) };
  const diario = new DiarioDellaCasa({ adesso: () => orologio.ora });
  const passa = (minuti, prima = () => {}) => {
    for (let i = 0; i < minuti * 2; i += 1) {
      orologio.ora += 30 * 1000;
      prima();
      diario.campiona({ stati, valori });
    }
  };
  diario.campiona({ stati, valori });
  passa(14, () => {
    const soc = Number(stati.get("sensor.auto_batteria").state);
    if (orologio.ora % (60 * 1000) === 0)
      stati.set("sensor.auto_batteria", st(soc - 1, { unit_of_measurement: "%" }));
  });
  passa(30);
  const [auto] = diario.laGiornata({ stati, valori }).auto;
  assert.equal(auto.viaggi.length, 1);
  assert.equal(auto.viaggi[0].soc, 14);
  /* 14% di 50 kWh = 7 kWh, a 14 kWh/100 km: 50 km. */
  assert.equal(auto.viaggi[0].km, 50);
  assert.equal(auto.kmStimati, true);
});

test("il diario resta sul disco, e ieri resta per il confronto", () => {
  const cartella = mkdtempSync(join(tmpdir(), "diario-"));
  try {
    const orologio = { ora: alle(10) };
    const stati = unaCasa();
    const diario = new DiarioDellaCasa({ cartella, adesso: () => orologio.ora });
    diario.campiona({ stati, valori: VALORI });
    for (let i = 0; i < 60; i += 1) {
      orologio.ora += 30 * 1000;
      diario.campiona({ stati, valori: VALORI });
    }
    diario.scrivi();
    /* Un riavvio: la giornata c'e' ancora. */
    const dopo = new DiarioDellaCasa({ cartella, adesso: () => orologio.ora });
    assert.equal(dopo.laGiornata({ stati, valori: VALORI }).riscaldamento.minutiAcceso, 30);
    /* Il giorno dopo: i minuti di ieri. */
    orologio.ora = new Date(2026, 9, 19, 8, 0).getTime();
    assert.equal(dopo.laGiornata({ stati, valori: VALORI }).riscaldamento.ieriMinuti, 30);
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});

/* ─── I pezzi della risposta ─────────────────────────────────────────── */

test("nessun nome di persona e nessuna entita', in nessun testo", () => {
  const fuori = senzaNomiDiPersone(
    {
      eventi: [{ ora: "07:02", testo: "Rientro di Persona 1" }],
      piu: [{ nome: "sensor.forno_w" }, { nome: "Stufa di Persona 1" }],
      casa: "Casa vuota",
    },
    ["Persona 1", "Casa"],
  );
  assert.equal(fuori.eventi[0].testo, "Rientro di qualcuno");
  assert.equal(fuori.piu[0].nome, "forno w");
  assert.equal(fuori.piu[1].nome, "Stufa di qualcuno");
  assert.equal(fuori.casa, "Casa vuota", "le parole di casa restano");
});

test("il mese, il confronto, le cose da sistemare e «In breve»", () => {
  const passati = [
    { d: "2026-09-01", pk: 10, eur: 1 },
    { d: "2026-09-02", pk: 10, eur: 1 },
    { d: "2026-09-03", pk: 10, eur: 1 },
    { d: "2026-10-16", pk: 12, eur: 0.5 },
    { d: "2026-10-17", pk: 16.4, eur: 0.4 },
  ];
  const giornata = {
    d: "2026-10-18",
    sole: 18.4,
    casa: 16.7,
    presi: 3.1,
    euroRete: 0.52,
  };
  assert.deepEqual(ilMese(passati, giornata), { euro: 1.42, sole: 46.8, giorni: 3 });
  const confronto = ilConfronto({ passati, giornata, conSole: true, media: 15.2 });
  assert.equal(confronto.ieriSolePct, 12);
  assert.equal(confronto.settimanaPct, 21);
  assert.equal(confronto.meseRetePct, -53);

  const sistemare = daSistemare({
    batterie: [
      { nome: "Sensore porta ingresso", carica: 12 },
      { nome: "iPhone di qualcuno", carica: 5 },
    ],
    aggiornamenti: 1,
    spenti: 0,
  });
  assert.deepEqual(sistemare, [
    { icona: "batteria", testo: "Sensore porta ingresso al 12%" },
    { icona: "aggiornamento", testo: "1 aggiornamento disponibile" },
  ]);

  const frasi = inBreve({
    giornata,
    conSole: true,
    piu: [{ nome: "Pompa di calore", kwh: 4.2, sole: 0.62 }],
    clima: { stanze: [{ min: 18.4, max: 22.6 }], fuori: { min: 9.1, max: 20.6 } },
    solareTermico: { bollitore: { max: 65 }, resistenzaMinuti: 0 },
  });
  assert.deepEqual(
    frasi.map((f) => f.testo),
    [
      "Hai preso dalla rete solo **3,1 kWh (0,52 €)**: il resto l'ha dato il sole.",
      "In casa fra **18,4°** e **22,6°**; fuori minima 9,1°, massima 20,6°.",
      "Acqua calda a **65°** col solare termico, senza resistenza elettrica.",
      "Il più acceso: **Pompa di calore**, 4,2 kWh (62% col sole).",
    ],
  );
});

test("`ponte/energia/giornata` con Premium: le sezioni nuove, compatte e senza nomi", async () => {
  const banco = unBanco({ licenze: { attive: true, premium: true }, adesso: alle(21) });
  try {
    const s = banco.notifiche.sentinella;
    s.carica([
      { entity_id: "person.persona_1", state: "home", attributes: { friendly_name: "Persona 1" } },
      {
        entity_id: "sensor.porta_batteria",
        state: "12",
        attributes: { device_class: "battery", friendly_name: "Sensore porta di Persona 1" },
      },
      { entity_id: "update.ponte", state: "on", attributes: {} },
    ]);
    s._laGiornataDaRaccontare = () => ({
      giornata: {
        d: "2026-10-18",
        sole: 18.4,
        casa: 11.6,
        presi: 3.1,
        ceduti: 4.8,
        usato: 13.6,
        quotaInCasa: 0.74,
        euroRete: 0.52,
        risparmio: 2.41,
        picco: 4.9,
        piccoIl: "13:10",
        p: Array(24).fill(0),
        c: Array(24).fill(0),
        perFascia: {},
        cicli: [],
      },
      conSole: true,
      piu: [{ nome: "Pompa di calore", kwh: 4.2, eur: 0.38, sole: 0.62 }],
      ieri: 16.4,
      media: 15.2,
    });
    const detto = await banco.chiedi({ type: LA_GIORNATA });
    assert.equal(detto.success, true);
    const r = detto.result;
    for (const campo of [
      "giornata",
      "piu",
      "settimana",
      "clima",
      "riscaldamento",
      "solareTermico",
      "auto",
      "acqua",
      "eventi",
      "conti",
      "mese",
      "confronto",
      "daSistemare",
      "inBreve",
    ])
      assert.ok(campo in r, campo);
    assert.equal(r.auto, null, "senza auto, niente auto");
    assert.equal(r.solareTermico, null);
    assert.equal(r.mese.giorni, 1);
    assert.deepEqual(r.daSistemare, [
      { icona: "batteria", testo: "Sensore porta di qualcuno al 12%" },
      { icona: "aggiornamento", testo: "1 aggiornamento disponibile" },
    ]);
    assert.ok(r.inBreve.length >= 2);
    const testo = JSON.stringify(r);
    assert.doesNotMatch(testo, /Persona 1/);
    assert.doesNotMatch(testo, /(sensor|update|person)\.[a-z]/);
    assert.ok(Buffer.byteLength(testo) < 8000, "viaggia sul filo");
  } finally {
    banco.spegni();
  }
});

/* ─── Le batterie da cambiare, e i tasti del riepilogo ───────────────── */

const BATTERIE = [
  { entity_id: "person.persona_1", state: "home", attributes: { friendly_name: "Persona 1" } },
  {
    entity_id: "sensor.porta_ingresso_batteria",
    state: "12",
    attributes: { device_class: "battery", friendly_name: "Sensore porta ingresso" },
  },
  {
    entity_id: "sensor.telefono_batteria",
    state: "5",
    attributes: { device_class: "battery", friendly_name: "iPhone di Persona 1" },
  },
  {
    entity_id: "sensor.termostato_batteria",
    state: "9",
    attributes: { device_class: "battery", friendly_name: "Termostato di Persona 1" },
  },
];

const unaGiornata = () => ({
  giornata: {
    d: "2026-10-18",
    sole: 18.4,
    casa: 11.6,
    presi: 3.1,
    ceduti: 4.8,
    usato: 13.6,
    quotaInCasa: 0.74,
    euroRete: 0.52,
    risparmio: 2.41,
    picco: 4.9,
    piccoIl: "13:10",
    p: Array(24).fill(0),
    c: Array(24).fill(0),
    perFascia: {},
    cicli: [],
  },
  conSole: true,
  piu: [{ nome: "Pompa di calore", kwh: 4.2, eur: 0.38, sole: 0.62 }],
  fasce: { nomi: {}, piuBassa: null },
});

test("Base: «🔋 Batterie da cambiare» alla sera, semplice, una volta, senza i telefoni", async () => {
  const banco = unBanco({ licenze: { attive: true, premium: false }, adesso: alle(20, 25) });
  try {
    await conGettoneElaborate(banco);
    banco.notifiche.sentinella.carica(BATTERIE);
    await banco.notifiche._riepiloghi();
    assert.equal(banco.spinte.length, 0, "non prima dell'ora del riepilogo");
    banco.orologio.ora = alle(20, 31);
    await banco.notifiche._riepiloghi();
    assert.equal(banco.spinte.length, 1);
    const detto = banco.apri(banco.spinte[0]);
    assert.equal(detto.titolo, "🔋 Batterie da cambiare");
    assert.equal(detto.testo, "Termostato di qualcuno 9% · Sensore porta ingresso 12%");
    assert.equal(detto.stile, "s");
    assert.doesNotMatch(JSON.stringify(detto), /Persona 1|iPhone|sensor\./);
    /* Una volta al giorno. */
    banco.orologio.ora = alle(20, 35);
    await banco.notifiche._riepiloghi();
    assert.equal(banco.spinte.length, 1);
    /* Senza batterie scariche, niente. */
    banco.notifiche.sentinella.carica(BATTERIE.slice(0, 1));
    banco.orologio.ora = new Date(2026, 9, 19, 20, 31).getTime();
    await banco.notifiche._riepiloghi();
    assert.equal(banco.spinte.length, 1);
  } finally {
    banco.spegni();
  }
});

test("Premium: col riepilogo spento le batterie a parte, acceso dentro il riepilogo e basta", async () => {
  const banco = unBanco({ licenze: { attive: true, premium: true }, adesso: alle(20, 31) });
  try {
    await conGettoneElaborate(banco);
    await banco.chiedi({
      type: "ponte/notifiche/imposta",
      impostazioni: { eventi: { riepilogo: false } },
    });
    banco.notifiche.sentinella.carica(BATTERIE);
    await banco.notifiche._riepiloghi();
    assert.equal(banco.spinte.length, 1);
    assert.equal(banco.apri(banco.spinte[0]).titolo, "🔋 Batterie da cambiare");

    /* Il giorno dopo, col riepilogo acceso: una notifica sola, il riepilogo. */
    await banco.chiedi({
      type: "ponte/notifiche/imposta",
      impostazioni: { eventi: { riepilogo: true } },
    });
    banco.notifiche.sentinella._laGiornataDaRaccontare = unaGiornata;
    banco.orologio.ora = new Date(2026, 9, 19, 20, 31).getTime();
    await banco.notifiche._riepiloghi();
    assert.equal(banco.spinte.length, 2);
    const detto = banco.apri(banco.spinte[1]);
    assert.equal(detto.titolo, "☀️ La tua giornata · 18,4 kWh dal sole");
    assert.deepEqual(detto.testo.split("\n"), [
      "⚡ Ha consumato di più: Pompa di calore, 4,2 kWh",
      "💶 Rete 0,52 € · risparmiati 2,41 €",
      "⚠️ Da sistemare: 2 batterie scariche",
    ]);
    assert.deepEqual(detto.azioni, [
      { id: "giornata", etichetta: "Apri la giornata", apre: true },
      { id: "ok", etichetta: "OK" },
    ]);
  } finally {
    banco.spegni();
  }
});

test("i tasti del riepilogo parlano la lingua del telefono", async () => {
  const banco = unBanco({ adesso: alle(20, 31) });
  try {
    await conGettoneElaborate(banco);
    await banco.chiedi({ type: "ponte/notifiche/imposta", impostazioni: { lingua: "en" } });
    banco.notifiche.sentinella._laGiornataDaRaccontare = unaGiornata;
    await banco.notifiche._riepiloghi();
    const detto = banco.apri(banco.spinte[0]);
    assert.deepEqual(
      detto.azioni.map((a) => [a.id, a.etichetta]),
      [
        ["giornata", "Open your day"],
        ["ok", "OK"],
      ],
    );
  } finally {
    banco.spegni();
  }
});

/* ─── I campi in piu' per la pagina ──────────────────────────────────── */

test("la batteria di casa: caricata, usata, massimo, stasera, dai punti o dai contatori", () => {
  const orologio = { ora: alle(8) };
  const taccuino = new TaccuinoDellEnergia({ adesso: () => orologio.ora });
  assert.equal(taccuino.laBatteria(10), null, "senza batteria, niente");
  const carica = (soc, ore, minuti = 0, extra = {}) => {
    orologio.ora = alle(ore, minuti);
    taccuino.campiona({ sole: 0, rete: 0, carica: soc, ...extra });
  };
  carica(50, 8);
  carica(80, 12);
  carica(100, 14, 40);
  carica(62, 21);
  assert.deepEqual(taccuino.laBatteria(10), {
    caricata: 5,
    usata: 3.8,
    massimo: 100,
    massimoAlle: "14:40",
    stasera: 62,
    capacita: 10,
  });
  assert.equal(taccuino.laBatteria(null).caricata, null, "senza capacita' i kWh non si sanno");
  /* I contatori del giorno valgono piu' dei punti. */
  carica(62, 21, 30, { battCaricataOggi: 6.8, battScaricataOggi: 5.1 });
  const conContatori = taccuino.laBatteria(null);
  assert.equal(conContatori.caricata, 6.8);
  assert.equal(conContatori.usata, 5.1);
});

test("i prezzi: la cessione solo se scritta, le fasce usate, la capacita' dell'accumulo", () => {
  assert.equal(prezzoDiCessione({}), null);
  assert.equal(prezzoDiCessione({ cd_prezzo_immissione: "0,08" }), 0.08);
  assert.equal(
    prezzoDiCessione(
      { cd_prezzo_immissione: "sensor.prezzo_cessione" },
      { "sensor.prezzo_cessione": { state: "0.11" } },
    ),
    0.11,
  );
  const fasce = {
    quante: 3,
    voci: [
      { dalle: "08:00", prezzo: 0.175 },
      { dalle: "19:00", prezzo: 0.15 },
      { dalle: "23:00", prezzo: 0.135 },
    ],
  };
  assert.deepEqual(prezziDelleFasce(fasce, { 0: 0.6, 2: 2.5 }), { F1: 0.175, F3: 0.135 });
  assert.deepEqual(prezziDelleFasce(JSON.stringify(fasce), { 1: 1 }), { F2: 0.15 });
  assert.equal(prezziDelleFasce({}, { 0: 1 }), null);
  assert.equal(
    capacitaDellAccumulo(
      { cd_accumulo: { righe: [{ entity: "sensor.bms_soc", capacita: "10", unita: "kWh" }] } },
      { "sensor.bms_soc": { state: "60", attributes: { unit_of_measurement: "%" } } },
    ),
    10,
  );
  assert.equal(capacitaDellAccumulo({}, {}), null);
});

test("domani: la massima, e il consiglio solo col sole e con qualcosa a cui dirlo", () => {
  const adesso = new Date(2026, 9, 17, 20, 30).getTime();
  const ora = (h, condition, temperature) => ({
    datetime: new Date(2026, 9, 18, h, 0).toISOString(),
    condition,
    temperature,
  });
  const cielo = cieloDiDomani(
    [ora(9, "sunny", 14), ora(11, "sunny", 19), ora(13, "sunny", 21), ora(15, "cloudy", 20.5)],
    adesso,
  );
  assert.equal(cielo.max, 21);
  assert.equal(cielo.soleFino, "14:00");
  const domani = { soleFino: "15:00", soleDa: 9 };
  assert.equal(
    consiglioPerDomani({
      domani,
      conSole: true,
      elettrodomestici: ["lavatrice", "lavastoviglie", "Forno"],
      conAuto: true,
    }),
    "Lavatrice e lavastoviglie entro le 13: gratis col sole. Auto: ricarica dalle 10.",
  );
  assert.equal(
    consiglioPerDomani({ domani, conSole: true, elettrodomestici: ["lavatrice"] }),
    "Lavatrice entro le 13: gratis col sole.",
  );
  assert.equal(consiglioPerDomani({ domani, conSole: true }), null, "niente a cui dirlo");
  assert.equal(consiglioPerDomani({ domani, elettrodomestici: ["lavatrice"] }), null);
  assert.equal(
    consiglioPerDomani({
      domani: { soleFino: null },
      conSole: true,
      elettrodomestici: ["lavatrice"],
    }),
    null,
  );
});

test("`ponte/energia/giornata`: euroCeduti, prezzi delle fasce, batteria e domani", async () => {
  const banco = unBanco({ licenze: { attive: true, premium: true }, adesso: alle(21) });
  try {
    const n = banco.notifiche;
    n._valori = () => ({
      cd_prezzo_immissione: "0.08",
      cd_fasce_kwh: {
        quante: 3,
        voci: [
          { dalle: "08:00", prezzo: 0.175 },
          { dalle: "19:00", prezzo: 0.15 },
          { dalle: "23:00", prezzo: 0.135 },
        ],
      },
    });
    n.sentinella.carica([
      {
        entity_id: "sensor.lavatrice_w",
        state: "0",
        attributes: { unit_of_measurement: "W", friendly_name: "Lavatrice" },
      },
    ]);
    const g = unaGiornata();
    g.giornata.perFascia = { 0: 0.6, 2: 2.5 };
    g.fasce = { nomi: { 0: "F1", 2: "F3" }, piuBassa: null };
    g.batteria = 62;
    n.sentinella._laGiornataDaRaccontare = () => g;
    n.sentinella.taccuino.laBatteria = (capacita) => ({
      caricata: 6.8,
      usata: 5.1,
      massimo: 100,
      massimoAlle: "14:40",
      stasera: 62,
      capacita,
    });
    n._ilTempoDiDomani = async () => ({
      met: [[9, "sole"]],
      soleFino: "15:00",
      pioggia: false,
      max: 21,
      soleDa: 9,
    });
    const r = (await banco.chiedi({ type: LA_GIORNATA })).result;
    assert.equal(r.giornata.euroCeduti, 0.38, "4,8 kWh a 0,08 €");
    assert.deepEqual(r.fasce, {
      nomi: { 0: "F1", 2: "F3" },
      piuBassa: null,
      prezzi: { F1: 0.175, F3: 0.135 },
    });
    assert.deepEqual(r.batteria, {
      caricata: 6.8,
      usata: 5.1,
      massimo: 100,
      massimoAlle: "14:40",
      stasera: 62,
      capacita: null,
    });
    assert.deepEqual(r.domani, {
      met: [[9, "sole"]],
      soleFino: "15:00",
      pioggia: false,
      max: 21,
      consiglio: "Lavatrice entro le 13: gratis col sole.",
    });
    /* Senza prezzo di cessione il guadagno non si inventa. */
    n._valori = () => ({});
    const senza = (await banco.chiedi({ type: LA_GIORNATA })).result;
    assert.equal(senza.giornata.euroCeduti, null);
    assert.equal(senza.fasce.prezzi, null);
  } finally {
    banco.spegni();
  }
});

test("l'ultima ricarica a casa resta, per il costo dei viaggi di GdANav", async () => {
  /* «Considera se si parte da casa al 100%, e verifica l'ultima ricarica a
   * casa: come e' stata caricata.» */
  const stati = unaCasa();
  const { diario, passa, energia } = unDiario(stati, { adesso: alle(11) });
  stati.set("sensor.auto_batteria", st(60, { unit_of_measurement: "%" }));
  passa(1);
  /* Mezzogiorno: 7 kW in wallbox, 3 dal sole e 4 dalla rete. */
  energia.sole = 3000;
  energia.casa = 7300;
  energia.rete = 4300;
  stati.set("sensor.wallbox_w", st(7000, { unit_of_measurement: "W" }));
  passa(60, () => {
    const soc = Number(stati.get("sensor.auto_batteria").state);
    if (soc < 100) stati.set("sensor.auto_batteria", st(soc + 1, { unit_of_measurement: "%" }));
  });
  stati.set("sensor.wallbox_w", st(0, { unit_of_measurement: "W" }));
  energia.casa = 300;
  passa(10);
  const [r] = diario.ricaricheDiCasa();
  assert.ok(r, "la ricarica doveva restare");
  assert.equal(r.nome, "Auto elettrica");
  assert.equal(r.socA, 100);
  assert.ok(r.kwh > 6.5 && r.kwh < 7.5, `kWh ${r.kwh}`);
  assert.ok(r.kwhSole > 2.5 && r.kwhSole < 3.5, `col sole ${r.kwhSole}`);
  assert.ok(r.euroRete > 0.7 && r.euroRete < 0.9, `euro di rete ${r.euroRete}`);
  assert.match(r.finitaIl, /^2026-10-18T/);
  /* Resta anche il giorno dopo, quando la giornata e' nuova. */
  passa(24 * 60);
  assert.equal(diario.ricaricheDiCasa().length, 1);
});

test("le ricariche di casa: solo a un utente, e senza entita'", async () => {
  const banco = unBanco();
  try {
    const detto = await banco.chiedi({ type: LE_RICARICHE_DI_CASA });
    assert.equal(detto.success, true);
    assert.deepEqual(detto.result, { ricariche: [] });
    const senza = await banco.notifiche.rispondi(
      { id: 2, type: LE_RICARICHE_DI_CASA },
      { dispositivo: { id: "b".repeat(32) } },
    );
    assert.equal(senza.error.code, "unauthorized");
  } finally {
    banco.spegni();
  }
});
