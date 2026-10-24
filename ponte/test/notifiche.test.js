/* Le notifiche: le regole, la busta, e a chi arriva cosa.
 *
 * La casa e' finta — degli stati scritti a mano e un orologio che si sposta
 * a comando — ma i telefoni sono veri (`dispositivi.js`, con la loro chiave
 * del filo), e la busta si apre come la apre l'app: con la chiave di quel
 * telefono, e con nessun'altra.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, statSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

import { Dispositivi } from "../src/dispositivi.js";
import {
  doveApre,
  impostazioniPulite,
  inSilenzio,
  Notifiche,
  personalizzataPulita,
} from "../src/notifiche.js";
import { categoriaDi, condizioneVera, Sentinella } from "../src/sentinella.js";
import { apriLaSpinta, chiudiLaSpinta, SpintaGuasta } from "../src/spinta.js";

const MINUTO = 60 * 1000;
const UTENTE_A = "a".repeat(32);
const UTENTE_B = "b".repeat(32);
const UTENTE_SPENTO = "c".repeat(32);

/* Un mezzogiorno qualunque, nell'ora di questa macchina: le ore di silenzio
 * e la notte si contano nell'ora di casa. */
const mezzogiorno = () => {
  const data = new Date(2026, 9, 14, 12, 0, 0);
  return data.getTime();
};

const stato = (entity_id, state, attributes = {}, last_changed = null) => ({
  entity_id,
  state,
  attributes,
  /* Senza, «adesso»: come un `state_changed` vero. */
  ...(last_changed ? { last_changed } : {}),
});

/* ─── La busta ────────────────────────────────────────────────────────── */

test("la busta si apre con la chiave del telefono giusto, e con nient'altro", () => {
  const chiaveDelFilo = randomBytes(32).toString("hex");
  const contenuto = { v: 1, id: "x", titolo: "Antifurto scattato", testo: "Ingresso" };
  const busta = chiudiLaSpinta({ chiaveDelFilo, telefono: "dm_uno", contenuto });

  assert.deepEqual(apriLaSpinta({ chiaveDelFilo, telefono: "dm_uno", busta }), contenuto);
  /* Dentro non si legge niente di quello che c'e' scritto. */
  assert.ok(!Buffer.from(busta, "base64").toString("latin1").includes("Antifurto"));
  /* Un'altra chiave: non si apre. */
  assert.throws(
    () =>
      apriLaSpinta({ chiaveDelFilo: randomBytes(32).toString("hex"), telefono: "dm_uno", busta }),
    SpintaGuasta,
  );
  /* La stessa chiave, un altro telefono: non si apre nemmeno cosi'. */
  assert.throws(() => apriLaSpinta({ chiaveDelFilo, telefono: "dm_due", busta }), SpintaGuasta);
  /* Un byte toccato: non si apre. */
  const toccata = Buffer.from(busta, "base64");
  toccata[20] ^= 1;
  assert.throws(
    () => apriLaSpinta({ chiaveDelFilo, telefono: "dm_uno", busta: toccata.toString("base64") }),
    SpintaGuasta,
  );
  /* Due buste dello stesso contenuto non si somigliano. */
  assert.notEqual(busta, chiudiLaSpinta({ chiaveDelFilo, telefono: "dm_uno", contenuto }));
});

/* ─── Le regole ───────────────────────────────────────────────────────── */

function unaSentinella(stati, { adesso = mezzogiorno() } = {}) {
  const orologio = { ora: adesso };
  const dette = [];
  const sentinella = new Sentinella({ adesso: () => orologio.ora, quando: (e) => dette.push(e) });
  sentinella.carica(stati);
  return { sentinella, dette, orologio };
}

test("l'antifurto che scatta e' urgente, con la telecamera dello stesso posto", () => {
  const { sentinella, dette } = unaSentinella([
    stato("alarm_control_panel.casa", "armed_away", { friendly_name: "Casa" }),
    stato("camera.ingresso", "idle"),
    stato("camera.giardino", "idle"),
  ]);
  sentinella.dispositivoDi = { "alarm_control_panel.casa": "d1", "camera.giardino": "d1" };
  sentinella.cambia(
    "alarm_control_panel.casa",
    stato("alarm_control_panel.casa", "triggered", { friendly_name: "Casa" }),
  );
  assert.equal(dette.length, 1);
  assert.equal(dette[0].tipo, "antifurto");
  assert.equal(dette[0].urgenza, "urgente");
  assert.equal(dette[0].camera, "camera.giardino");
  /* Restare scattato non e' scattare di nuovo. */
  sentinella.cambia(
    "alarm_control_panel.casa",
    stato("alarm_control_panel.casa", "triggered", { friendly_name: "Casa" }),
  );
  assert.equal(dette.length, 1);
});

test("allagamento, fumo e gas dal primo sensore; il campanello con il cancello da aprire", () => {
  const { sentinella, dette } = unaSentinella([
    stato("binary_sensor.perdita_bagno", "off", { device_class: "moisture" }),
    stato("event.campanello_ingresso", "2026-10-14T10:00:00Z", { device_class: "doorbell" }),
    stato("camera.ingresso", "idle"),
    stato("lock.cancello", "locked"),
  ]);
  sentinella.cambia(
    "binary_sensor.perdita_bagno",
    stato("binary_sensor.perdita_bagno", "on", { device_class: "moisture" }),
  );
  sentinella.cambia(
    "event.campanello_ingresso",
    stato("event.campanello_ingresso", "2026-10-14T12:00:00Z", { device_class: "doorbell" }),
  );
  assert.deepEqual(
    dette.map((e) => e.tipo),
    ["allarmi", "campanello"],
  );
  const campanello = dette[1];
  assert.equal(campanello.camera, "camera.ingresso");
  assert.equal(campanello.chiamata, true);
  assert.deepEqual(campanello.azioni[0].servizio, {
    dominio: "lock",
    servizio: "unlock",
    entita: ["lock.cancello"],
  });
});

test("l'ultimo che esce con l'antifurto spento, e il movimento con la casa vuota", () => {
  const { sentinella, dette } = unaSentinella([
    stato("person.uno", "home", { friendly_name: "Persona 1", user_id: UTENTE_A }),
    stato("person.due", "not_home", { friendly_name: "Persona 2" }),
    stato("alarm_control_panel.casa", "disarmed"),
    stato("binary_sensor.pir_sala", "off", { device_class: "motion" }),
  ]);
  /* Con qualcuno in casa il movimento non e' una notizia. */
  sentinella.cambia(
    "binary_sensor.pir_sala",
    stato("binary_sensor.pir_sala", "on", { device_class: "motion" }),
  );
  assert.equal(dette.length, 0);
  sentinella.cambia(
    "binary_sensor.pir_sala",
    stato("binary_sensor.pir_sala", "off", { device_class: "motion" }),
  );

  sentinella.cambia(
    "person.uno",
    stato("person.uno", "not_home", { friendly_name: "Persona 1", user_id: UTENTE_A }),
  );
  const tipi = dette.map((e) => e.tipo);
  assert.deepEqual(tipi, ["arrivi", "uscito"]);
  const uscito = dette[1];
  assert.equal(uscito.azioni[0].servizio.servizio, "alarm_arm_away");
  assert.equal(sentinella.aCasa(UTENTE_A), false);

  sentinella.cambia(
    "binary_sensor.pir_sala",
    stato("binary_sensor.pir_sala", "on", { device_class: "motion" }),
  );
  assert.equal(dette.at(-1).tipo, "movimento");
});

test("l'antifurto inserito in ogni modo, e disinserito: si dice a ogni cambio vero", () => {
  const { sentinella, dette } = unaSentinella([
    stato("alarm_control_panel.casa", "disarmed", { friendly_name: "Antifurto" }),
  ]);
  const passa = (cosa, attributi = {}) =>
    sentinella.cambia(
      "alarm_control_panel.casa",
      stato("alarm_control_panel.casa", cosa, { friendly_name: "Antifurto", ...attributi }),
    );
  passa("arming");
  assert.equal(dette.length, 0, "l'attesa prima di inserirsi non e' una notizia");
  passa("armed_night", { changed_by: "Programma notte" });
  passa("armed_night");
  passa("armed_home");
  passa("armed_away");
  passa("armed_vacation");
  passa("armed_custom_bypass");
  passa("disarmed");
  passa("unavailable");
  passa("disarmed");
  const inserimenti = dette.filter((e) => e.tipo === "inserimenti");
  assert.deepEqual(
    inserimenti.map((e) => e.parole.it.titolo),
    [
      "🌙 Antifurto · Inserito notte",
      "🏠 Antifurto · Inserito parziale (casa)",
      "🔒 Antifurto · Inserito totale",
      "🧳 Antifurto · Inserito vacanza",
      "🛡️ Antifurto · Inserito personalizzato",
      "🔓 Antifurto · Disinserito",
    ],
    "una volta per cambio, e niente tornando da non disponibile",
  );
  assert.equal(inserimenti[0].parole.it.testo, "Antifurto · da Programma notte");
  assert.equal(inserimenti[0].urgenza, "normale");
  assert.equal(categoriaDi("inserimenti"), "sicurezza");
  /* Scattato resta la sua notifica urgente, e disinserito dopo si dice. */
  passa("triggered");
  passa("disarmed");
  assert.deepEqual(
    dette.slice(-2).map((e) => e.tipo),
    ["antifurto", "inserimenti"],
  );
});

test("una porta aperta di notte si dice dopo dieci minuti, una volta", () => {
  const notte = new Date(2026, 9, 14, 23, 0, 0).getTime();
  const { sentinella, dette, orologio } = unaSentinella(
    [
      stato("binary_sensor.garage", "off", {
        device_class: "garage_door",
        friendly_name: "Garage",
      }),
    ],
    { adesso: notte },
  );
  sentinella.cambia(
    "binary_sensor.garage",
    stato("binary_sensor.garage", "on", { device_class: "garage_door", friendly_name: "Garage" }),
  );
  sentinella.battito();
  assert.equal(dette.length, 0);
  /* Aperta da undici minuti ma la casa non dorme ancora da venti: zitta. */
  orologio.ora += 11 * MINUTO;
  sentinella.battito();
  assert.equal(dette.length, 0);
  orologio.ora += 10 * MINUTO;
  sentinella.battito();
  sentinella.battito();
  assert.equal(dette.length, 1);
  assert.equal(dette[0].tipo, "aperture");
  assert.match(dette[0].parole.it.titolo, /Garage: la porta del garage è ancora aperta/);
  assert.deepEqual(
    dette[0].azioni.map((a) => a.id),
    ["va-bene", "piu-tardi"],
  );
});

test("porta aperta di notte con la casa sveglia: niente; e il nome si legge", () => {
  const notte = new Date(2026, 9, 14, 22, 0, 0).getTime();
  const porta = (s) =>
    stato("binary_sensor.sensore_porta_finestra_cucina_porta", s, {
      device_class: "door",
      friendly_name: "Sensore Porta/Finestra Cucina Porta",
    });
  const { sentinella, dette, orologio } = unaSentinella(
    [porta("on"), stato("light.soggiorno", "on", { friendly_name: "Soggiorno" })],
    { adesso: notte },
  );
  /* Le dieci in punto, la luce del soggiorno accesa: si e' svegli. */
  for (let i = 0; i < 6; i += 1) {
    sentinella.battito();
    orologio.ora += 10 * MINUTO;
  }
  assert.equal(dette.length, 0, "con la casa sveglia una porta aperta non e' una notizia");
  /* Si spegne tutto e si va a dormire: venti minuti dopo, una volta, col
   * nome che si legge. */
  sentinella.cambia(
    "light.soggiorno",
    stato("light.soggiorno", "off", { friendly_name: "Soggiorno" }),
  );
  orologio.ora += 25 * MINUTO;
  sentinella.battito();
  assert.equal(dette.length, 1);
  assert.equal(dette[0].parole.it.titolo, "🚪 Cucina: la porta è ancora aperta");
  /* «Va bene stanotte»: fino al mattino tace. */
  sentinella.capire.vaBeneStanotte("binary_sensor.sensore_porta_finestra_cucina_porta");
  assert.deepEqual(
    sentinella.capire.lasciaStare("binary_sensor.sensore_porta_finestra_cucina_porta", "", {
      tipo: "porta",
    }),
    { perche: "stanotte" },
  );
  /* Una porta di camera, di notte con la gente in casa, non e' una notizia. */
  sentinella.cambia(
    "binary_sensor.porta_camera",
    stato("binary_sensor.porta_camera", "on", {
      device_class: "door",
      friendly_name: "Porta camera",
    }),
  );
  orologio.ora += 11 * MINUTO;
  sentinella.battito();
  assert.equal(dette.length, 1);
});

test("luci con la casa vuota: l'acquario resta, «Spegni» spegne solo le altre, «Restano così» impara", () => {
  const { sentinella, dette, orologio } = unaSentinella([
    stato("person.uno", "not_home", { friendly_name: "Persona 1" }),
    stato("light.luce_acquario_blu", "on", { friendly_name: "Luce acquario blu" }),
    stato("light.cucina", "on", { friendly_name: "Cucina" }),
    stato("light.bagno", "on", { friendly_name: "Bagno" }),
  ]);
  orologio.ora += 31 * MINUTO;
  sentinella.battito();
  const luci = () => dette.filter((d) => d.chiave === "suggerimenti:luci");
  assert.equal(luci().length, 1);
  const detta = luci()[0];
  assert.match(detta.parole.it.testo, /Accese: Cucina, Bagno\. Restano accese Luce acquario blu\./);
  const spegni = detta.azioni.find((a) => a.id === "spegni");
  assert.deepEqual(spegni.servizio.entita, ["light.cucina", "light.bagno"]);
  const resta = detta.azioni.find((a) => a.id === "resta");
  assert.deepEqual(resta.resta, ["light.cucina", "light.bagno"]);
  /* «Restano così»: la volta dopo non si propongono piu'. */
  sentinella.capire.resta(resta.resta);
  sentinella.cambia("person.uno", stato("person.uno", "home", { friendly_name: "Persona 1" }));
  sentinella.battito();
  sentinella.cambia("person.uno", stato("person.uno", "not_home", { friendly_name: "Persona 1" }));
  orologio.ora += 40 * MINUTO;
  sentinella.battito();
  assert.equal(luci().length, 1);
});

test("una luce accesa con la casa vuota quasi tutti i giorni e' a orario: l'assistente la impara", async () => {
  const { CapireLaCasa } = await import("../src/capire-la-casa.js");
  let ora = new Date(2026, 9, 1, 12, 0, 0).getTime();
  const capire = new CapireLaCasa({ adesso: () => ora, memoria: {} });
  for (let giorno = 0; giorno < 5; giorno += 1) {
    capire.luceAccesaConLaCasaVuota("light.mensola", 45, ora);
    ora += 24 * 60 * MINUTO;
  }
  assert.deepEqual(capire.lasciaStare("light.mensola", "Mensola"), { perche: "abitudine" });
  assert.equal(capire.lasciaStare("light.cucina", "Cucina"), null);
  assert.deepEqual(capire.lasciaStare("light.vasca_pesci", "Vasca pesci"), { perche: "acquario" });
});

test("il freezer troppo caldo per un quarto d'ora", () => {
  const { sentinella, dette, orologio } = unaSentinella([
    stato("sensor.temperatura_freezer", "-18", {
      device_class: "temperature",
      unit_of_measurement: "°C",
    }),
  ]);
  sentinella.cambia(
    "sensor.temperatura_freezer",
    stato("sensor.temperatura_freezer", "-9.8", {
      device_class: "temperature",
      unit_of_measurement: "°C",
    }),
  );
  sentinella.battito();
  orologio.ora += 16 * MINUTO;
  sentinella.battito();
  assert.equal(dette.length, 1);
  assert.equal(dette[0].tipo, "frigo");
});

test("il frigo che misura anche la stanza: la temperatura ambiente non avvisa", () => {
  /* «Il mio frigorifero ha anche la temperatura ambiente, che ovviamente e'
   * alta, e mi manda un avviso.» Quella dentro avvisa ancora. */
  const t = { device_class: "temperature", unit_of_measurement: "°C" };
  const { sentinella, dette, orologio } = unaSentinella([
    stato("sensor.frigorifero_ambient_temperature", "22", t),
    stato("sensor.frigo_cucina_temperatura", "4", {
      ...t,
      friendly_name: "Frigo cucina temperatura",
    }),
    stato("sensor.frigo_t2", "24", { ...t, friendly_name: "Frigo temperatura ambiente" }),
  ]);
  sentinella.battito();
  orologio.ora += 16 * MINUTO;
  sentinella.battito();
  assert.equal(dette.length, 0, "la stanza non e' il frigo");
  sentinella.cambia(
    "sensor.frigo_cucina_temperatura",
    stato("sensor.frigo_cucina_temperatura", "11", t),
  );
  sentinella.battito();
  orologio.ora += 16 * MINUTO;
  sentinella.battito();
  assert.deepEqual(
    dette.map((d) => d.entita),
    ["sensor.frigo_cucina_temperatura"],
  );
});

test("la lavatrice che ha finito: la potenza scende e resta giu'", () => {
  const { sentinella, dette, orologio } = unaSentinella([
    stato("sensor.lavatrice_potenza", "0", { unit_of_measurement: "W" }),
  ]);
  sentinella.cambia(
    "sensor.lavatrice_potenza",
    stato("sensor.lavatrice_potenza", "500", { unit_of_measurement: "W" }),
  );
  orologio.ora += 40 * MINUTO;
  sentinella.cambia(
    "sensor.lavatrice_potenza",
    stato("sensor.lavatrice_potenza", "1", { unit_of_measurement: "W" }),
  );
  sentinella.battito();
  assert.equal(dette.length, 0);
  orologio.ora += 6 * MINUTO;
  sentinella.battito();
  assert.equal(dette.length, 1);
  assert.equal(dette[0].tipo, "elettrodomestici");
});

/* «Perché arriva due volte la notifica»: «Asciugatrice: finito» e
 * «asciugatrice W: finito» alla stessa ora. La stessa asciugatrice lo diceva
 * da due parti: dal suo stato («finished») e dalla presa che ne misura la
 * potenza. Uno solo, col nome dell'elettrodomestico; una lavatrice che finisce
 * nello stesso momento si dice lo stesso. */
for (const primaLoStato of [true, false]) {
  test(`un elettrodomestico che finisce si dice una volta sola (${primaLoStato ? "prima lo stato" : "prima la potenza"})`, () => {
    const { sentinella, dette, orologio } = unaSentinella([
      stato("sensor.asciugatrice_stato", "run", { friendly_name: "Asciugatrice" }),
      stato("sensor.asciugatrice_w", "0", {
        unit_of_measurement: "W",
        friendly_name: "asciugatrice W",
      }),
      stato("sensor.lavatrice_stato", "run", { friendly_name: "Lavatrice" }),
    ]);
    sentinella.cambia(
      "sensor.asciugatrice_w",
      stato("sensor.asciugatrice_w", "800", {
        unit_of_measurement: "W",
        friendly_name: "asciugatrice W",
      }),
    );
    orologio.ora += 60 * MINUTO;
    sentinella.cambia(
      "sensor.asciugatrice_w",
      stato("sensor.asciugatrice_w", "1", {
        unit_of_measurement: "W",
        friendly_name: "asciugatrice W",
      }),
    );
    const loStato = () =>
      sentinella.cambia(
        "sensor.asciugatrice_stato",
        stato("sensor.asciugatrice_stato", "finished", { friendly_name: "Asciugatrice" }),
      );
    if (primaLoStato) loStato();
    orologio.ora += 6 * MINUTO;
    sentinella.battito();
    if (!primaLoStato) loStato();
    sentinella.cambia(
      "sensor.lavatrice_stato",
      stato("sensor.lavatrice_stato", "finished", { friendly_name: "Lavatrice" }),
    );
    const titoli = dette.map((d) => d.parole.it.titolo);
    assert.equal(titoli.filter((t) => /asciugatrice/i.test(t)).length, 1, titoli.join(" | "));
    assert.ok(titoli.includes("🫧 Lavatrice finita"), titoli.join(" | "));
    assert.ok(!titoli.some((t) => / W: /.test(t)), titoli.join(" | "));
  });
}

test("una personalizzata: condizione, durata, e non ripetere", () => {
  const { sentinella, dette, orologio } = unaSentinella([
    stato("sensor.temperatura_freezer", "-18", {
      unit_of_measurement: "°C",
      friendly_name: "Freezer cantina",
    }),
  ]);
  sentinella.personalizzate = [
    personalizzataPulita({
      entita: "sensor.temperatura_freezer",
      condizione: "sopra",
      valore: "-12",
      per: 10,
      titolo: "Freezer troppo caldo",
      chi: [UTENTE_A],
      nonRipetere: 60,
    }),
  ];
  const cambia = (valore) =>
    sentinella.cambia(
      "sensor.temperatura_freezer",
      stato("sensor.temperatura_freezer", valore, {
        unit_of_measurement: "°C",
        friendly_name: "Freezer cantina",
      }),
    );
  cambia("-9.8");
  assert.equal(dette.length, 0);
  orologio.ora += 11 * MINUTO;
  sentinella.battito();
  assert.equal(dette.length, 1);
  assert.equal(dette[0].parole.it.testo, "-9.8 °C da 11 min · Freezer cantina");
  assert.deepEqual(dette[0].solo, [UTENTE_A]);
  orologio.ora += 30 * MINUTO;
  sentinella.battito();
  assert.equal(dette.length, 1, "dentro l'ora non si ripete");
  orologio.ora += 31 * MINUTO;
  sentinella.battito();
  assert.equal(dette.length, 2, "dopo un'ora, se resta caldo, si ridice");

  assert.equal(condizioneVera({ condizione: "uguale", valore: "on" }, "on"), true);
  assert.equal(condizioneVera({ condizione: "sotto", valore: "abc" }, "3"), false);
  assert.equal(
    personalizzataPulita({ entita: "non valida", condizione: "sopra", titolo: "x" }),
    null,
  );
});

test("le ore di silenzio passano la mezzanotte", () => {
  const imp = impostazioniPulite({ silenzio: { acceso: true, dalle: "23:00", alle: "07:00" } });
  assert.equal(inSilenzio(imp, new Date(2026, 0, 1, 23, 30)), true);
  assert.equal(inSilenzio(imp, new Date(2026, 0, 1, 6, 59)), true);
  assert.equal(inSilenzio(imp, new Date(2026, 0, 1, 7, 0)), false);
  assert.equal(inSilenzio(imp, new Date(2026, 0, 1, 12, 0)), false);
  assert.equal(
    inSilenzio({ silenzio: { acceso: false, dalle: "00:00", alle: "23:59" } }, new Date()),
    false,
  );
  /* Quello che non si capisce resta com'era. */
  const pulite = impostazioniPulite({
    riepilogo: "25:99",
    assistente: "boh",
    eventi: { antifurto: false, inventato: true },
  });
  assert.equal(pulite.riepilogo, "20:30");
  assert.equal(pulite.assistente, "importanti");
  assert.equal(pulite.eventi.antifurto, false);
  assert.equal("inventato" in pulite.eventi, false);
});

/* ─── A chi arriva ────────────────────────────────────────────────────── */

function unBanco({ adesso = mezzogiorno(), chiuse = new Set() } = {}) {
  const cartella = mkdtempSync(join(tmpdir(), "notifiche-"));
  const orologio = { ora: adesso };
  const dispositivi = new Dispositivi({ cartella, adesso: () => orologio.ora });
  const a = dispositivi.abbina({ nome: "Telefono A", utente: UTENTE_A });
  const b = dispositivi.abbina({ nome: "Telefono B", utente: UTENTE_B });
  const spento = dispositivi.abbina({ nome: "Telefono spento", utente: UTENTE_SPENTO });
  const senza = dispositivi.abbina({ nome: "Telefono di prima" });
  const utenti = {
    elenco: async () => [
      { id: UTENTE_A, nome: "Persona 1", amministratore: true, attivo: true },
      { id: UTENTE_B, nome: "Persona 2", amministratore: false, attivo: true },
      { id: UTENTE_SPENTO, nome: "Persona 3", amministratore: false, attivo: false },
    ],
    eVivo: async (chi) => chi === UTENTE_A || chi === UTENTE_B,
  };
  const spinte = [];
  const elenchi = [];
  const postino = {
    pronto: true,
    spingi: (spinta) => {
      spinte.push(spinta);
      return true;
    },
    diIGettoni: (elenco) => elenchi.push(elenco),
  };
  const chiamate = [];
  const casa = {
    chiedi: async (comando) => {
      chiamate.push(comando);
      return [];
    },
    ascolta: async () => () => {},
  };
  const commissioni = {
    telecamereChiuse: (utente) => (utente === UTENTE_B ? chiuse : new Set()),
  };
  const notifiche = new Notifiche({
    cartella,
    dispositivi,
    utenti,
    casa,
    commissioni,
    postino,
    adesso: () => orologio.ora,
  });
  const apri = (spinta, chi) =>
    apriLaSpinta({ chiaveDelFilo: chi.chiave, telefono: chi.dispositivo.id, busta: spinta.busta });
  const registra = async (chi) =>
    notifiche.rispondi(
      {
        id: 1,
        type: "ponte/notifiche/registra",
        gettone: `gettone-${chi.dispositivo.id}-${"x".repeat(20)}`,
      },
      { dispositivo: chi.dispositivo },
    );
  return {
    cartella,
    orologio,
    dispositivi,
    notifiche,
    spinte,
    elenchi,
    chiamate,
    a,
    b,
    spento,
    senza,
    apri,
    registra,
    spegni: () => {
      notifiche.ferma();
      rmSync(cartella, { recursive: true, force: true });
    },
  };
}

const antifurto = (extra = {}) => ({
  tipo: "antifurto",
  urgenza: "urgente",
  chiave: "antifurto:x",
  pausa: 5 * MINUTO,
  camera: "camera.ingresso",
  parole: {
    it: { titolo: "Antifurto scattato", testo: "Ingresso" },
    en: { titolo: "Alarm", testo: "Hall" },
  },
  azioni: [],
  ...extra,
});

test("solo i telefoni di utenti attivi, e la telecamera solo a chi la vede", async () => {
  const banco = unBanco({ chiuse: new Set(["camera.ingresso"]) });
  try {
    for (const chi of [banco.a, banco.b, banco.spento, banco.senza]) await banco.registra(chi);
    const quanti = await banco.notifiche.consegna(antifurto());
    assert.equal(quanti, 2, "il telefono dell'utente spento e quello senza utente restano fuori");
    const perA = banco.spinte.find((s) => s.telefono === banco.a.dispositivo.id);
    const perB = banco.spinte.find((s) => s.telefono === banco.b.dispositivo.id);
    assert.equal(perA.urgente, true);
    assert.equal(banco.apri(perA, banco.a).camera, "camera.ingresso");
    assert.equal(banco.apri(perB, banco.b).camera, undefined, "B quella telecamera non la vede");
    /* La busta di A non si apre con la chiave di B. */
    assert.throws(() => banco.apri(perA, banco.b), SpintaGuasta);
    /* Il centralino ha avuto i gettoni, e la busta non dice niente in chiaro. */
    assert.ok(!JSON.stringify(banco.spinte).includes("Antifurto"));
    assert.equal(banco.elenchi.at(-1).length, 4);
  } finally {
    banco.spegni();
  }
});

test("le ore di silenzio fermano le normali e non le urgenti; la pausa ferma i doppioni", async () => {
  const notte = new Date(2026, 9, 14, 23, 30).getTime();
  const banco = unBanco({ adesso: notte });
  try {
    await banco.registra(banco.a);
    assert.equal(
      await banco.notifiche.consegna(
        antifurto({ tipo: "movimento", urgenza: "normale", chiave: "m" }),
      ),
      0,
    );
    assert.equal(await banco.notifiche.consegna(antifurto()), 1);
    assert.equal(
      await banco.notifiche.consegna(antifurto()),
      0,
      "lo stesso evento dentro la sua pausa",
    );
    banco.orologio.ora += 6 * MINUTO;
    assert.equal(await banco.notifiche.consegna(antifurto()), 1);
  } finally {
    banco.spegni();
  }
});

test("le impostazioni di un telefono restano sue, e restano sul disco chiuse a 600", async () => {
  const banco = unBanco();
  try {
    await banco.registra(banco.a);
    await banco.registra(banco.b);
    const detto = await banco.notifiche.rispondi(
      { id: 2, type: "ponte/notifiche/imposta", impostazioni: { eventi: { antifurto: false } } },
      { dispositivo: banco.a.dispositivo },
    );
    assert.equal(detto.success, true);
    assert.equal(await banco.notifiche.consegna(antifurto()), 1, "solo B");
    assert.equal(banco.spinte[0].telefono, banco.b.dispositivo.id);

    const file = join(banco.cartella, "notifiche.json");
    assert.equal(statSync(file).mode & 0o777, 0o600);
    const dentro = JSON.parse(readFileSync(file, "utf8"));
    assert.equal(dentro.telefoni[banco.a.dispositivo.id].impostazioni.eventi.antifurto, false);

    /* Riletto da capo, come dopo un riavvio. */
    const di_nuovo = new Notifiche({ cartella: banco.cartella, dispositivi: banco.dispositivi });
    assert.equal(di_nuovo.impostazioniDi(banco.a.dispositivo.id).eventi.antifurto, false);
    assert.equal(di_nuovo.impostazioniDi(banco.b.dispositivo.id).eventi.antifurto, true);
  } finally {
    banco.spegni();
  }
});

test("un telefono staccato esce dall'elenco dei gettoni del centralino", async () => {
  const banco = unBanco();
  try {
    await banco.registra(banco.a);
    await banco.registra(banco.b);
    assert.equal(banco.elenchi.at(-1).length, 2);
    banco.dispositivi.stacca(banco.a.dispositivo.id);
    banco.notifiche.sincronizza();
    assert.deepEqual(
      banco.elenchi.at(-1).map((uno) => uno.telefono),
      [banco.b.dispositivo.id],
    );
    /* E un gettone che Firebase non conosce piu' esce anche lui. */
    banco.notifiche.gettoneMorto(banco.b.dispositivo.id);
    assert.deepEqual(banco.elenchi.at(-1), []);
  } finally {
    banco.spegni();
  }
});

test("«solo quando sono fuori casa»: in casa le notifiche di Casa tacciono", async () => {
  const banco = unBanco();
  try {
    await banco.registra(banco.a);
    await banco.notifiche.rispondi(
      { id: 3, type: "ponte/notifiche/imposta", impostazioni: { soloFuori: true } },
      { dispositivo: banco.a.dispositivo },
    );
    banco.notifiche.sentinella.carica([stato("person.uno", "home", { user_id: UTENTE_A })]);
    const lavatrice = {
      tipo: "elettrodomestici",
      urgenza: "normale",
      chiave: "l",
      parole: { it: { titolo: "x", testo: "y" } },
    };
    assert.equal(await banco.notifiche.consegna(lavatrice), 0);
    banco.notifiche.sentinella.carica([stato("person.uno", "not_home", { user_id: UTENTE_A })]);
    assert.equal(await banco.notifiche.consegna(lavatrice), 1);
  } finally {
    banco.spegni();
  }
});

test("i tasti: solo il telefono a cui e' arrivata la notifica, una volta sola", async () => {
  const banco = unBanco();
  try {
    await banco.registra(banco.a);
    await banco.registra(banco.b);
    await banco.notifiche.consegna({
      tipo: "suggerimenti",
      urgenza: "bassa",
      importante: true,
      chiave: "luci",
      parole: { it: { titolo: "Luci accese", testo: "le spengo?" } },
      azioni: [
        {
          id: "spegni",
          parole: { it: "Spegni" },
          servizio: { dominio: "light", servizio: "turn_off", entita: ["light.cucina"] },
        },
        { id: "piu-tardi", parole: { it: "Più tardi" }, piuTardi: true },
      ],
    });
    const perA = banco.apri(
      banco.spinte.find((s) => s.telefono === banco.a.dispositivo.id),
      banco.a,
    );
    assert.deepEqual(
      perA.azioni.map((a) => a.etichetta),
      ["Spegni", "Più tardi"],
    );
    assert.equal(JSON.stringify(perA).includes("turn_off"), false, "il comando resta sul ponte");

    const tasto = (chi, azione) =>
      banco.notifiche.rispondi(
        { id: 9, type: "ponte/notifiche/azione", notifica: perA.id, azione },
        { dispositivo: chi.dispositivo },
      );
    const daB = await tasto(banco.b, "spegni");
    assert.equal(daB.success, false, "B non preme i tasti di A");
    assert.equal(banco.chiamate.length, 0);
    const daA = await tasto(banco.a, "spegni");
    assert.equal(daA.success, true);
    assert.deepEqual(banco.chiamate.at(-1), {
      type: "call_service",
      domain: "light",
      service: "turn_off",
      target: { entity_id: ["light.cucina"] },
    });
    assert.equal((await tasto(banco.a, "spegni")).success, false, "una volta sola");

    /* «Più tardi»: per un'ora quella cosa a quel telefono non si ridice. */
    assert.equal((await tasto(banco.a, "piu-tardi")).success, true);
    banco.orologio.ora += 3 * MINUTO;
    const ancora = await banco.notifiche.consegna({
      tipo: "suggerimenti",
      urgenza: "bassa",
      importante: true,
      chiave: "luci",
      parole: { it: { titolo: "Luci accese", testo: "le spengo?" } },
    });
    assert.equal(ancora, 1, "a B si', ad A no");
  } finally {
    banco.spegni();
  }
});

test("la notifica di prova arriva solo a chi la chiede", async () => {
  const banco = unBanco();
  try {
    await banco.registra(banco.a);
    await banco.registra(banco.b);
    const detto = await banco.notifiche.rispondi(
      { id: 4, type: "ponte/notifiche/prova" },
      { dispositivo: banco.a.dispositivo },
    );
    assert.equal(detto.success, true);
    assert.equal(banco.spinte.length, 1);
    assert.equal(banco.apri(banco.spinte[0], banco.a).tipo, "prova");
    /* La prova non aspetta il filo del centralino: «non e' partita» subito. */
    assert.equal(banco.spinte[0].aspetta, false);
  } finally {
    banco.spegni();
  }
});

test("una notifica vera aspetta il filo del centralino, se e' giu'", async () => {
  const banco = unBanco();
  try {
    await banco.registra(banco.a);
    await banco.notifiche.consegna(antifurto());
    const perA = banco.spinte.find((s) => s.telefono === banco.a.dispositivo.id);
    assert.equal(perA.aspetta, true);
  } finally {
    banco.spegni();
  }
});

test("le personalizzate: chi non amministra le fa solo per se'", async () => {
  const banco = unBanco();
  try {
    const regola = {
      entita: "sensor.temperatura_freezer",
      condizione: "sopra",
      valore: "-12",
      per: 10,
      titolo: "Freezer troppo caldo",
    };
    const perAltri = await banco.notifiche.rispondi(
      {
        id: 5,
        type: "ponte/notifiche/personalizzata/salva",
        regola: { ...regola, chi: [UTENTE_A, UTENTE_B] },
      },
      { dispositivo: banco.b.dispositivo, amministra: false },
    );
    assert.equal(perAltri.success, false);
    const perSe = await banco.notifiche.rispondi(
      { id: 6, type: "ponte/notifiche/personalizzata/salva", regola },
      { dispositivo: banco.b.dispositivo, amministra: false },
    );
    assert.equal(perSe.success, true);
    assert.deepEqual(perSe.result.regola.chi, [UTENTE_B]);
    const stato_ = await banco.notifiche.rispondi(
      { id: 7, type: "ponte/notifiche/stato" },
      { dispositivo: banco.a.dispositivo, amministra: true },
    );
    assert.equal(stato_.result.personalizzate.length, 1);
    assert.equal(stato_.result.personalizzate[0].modificabile, true);
  } finally {
    banco.spegni();
  }
});

/* «Non ci sono 65 dispositivi non connessi.» Il riepilogo della sera contava
 * le ENTITA' mute che hanno un dispositivo, non i dispositivi: una presa
 * spenta con quattro sensori faceva quattro, e il canale non usato di uno
 * switch acceso faceva uno. Adesso la regola e' quella del cruscotto di chi
 * installa (`salute.js`) e della pagina «Non connessi»: un dispositivo e' giu'
 * quando NESSUNA delle sue entita' risponde, e conta una volta sola. */
test("il riepilogo conta i dispositivi giu', non le entita' mute", () => {
  const { sentinella } = unaSentinella([
    // Una presa irraggiungibile: tutte e quattro mute → 1 dispositivo.
    stato("switch.presa_giardino", "unavailable"),
    stato("sensor.presa_giardino_potenza", "unavailable"),
    stato("sensor.presa_giardino_energia", "unavailable"),
    stato("sensor.presa_giardino_tensione", "unavailable"),
    // Uno switch acceso col canale non usato muto: non e' giu'.
    stato("switch.unifi_porta_1", "unavailable"),
    stato("sensor.unifi_cpu", "6"),
    // Un'entita' senza dispositivo: non e' un dispositivo non connesso.
    stato("sensor.template_rotto", "unavailable"),
  ]);
  sentinella.dispositivoDi = {
    "switch.presa_giardino": "presa",
    "sensor.presa_giardino_potenza": "presa",
    "sensor.presa_giardino_energia": "presa",
    "sensor.presa_giardino_tensione": "presa",
    "switch.unifi_porta_1": "unifi",
    "sensor.unifi_cpu": "unifi",
  };
  const r = sentinella.riepilogo();
  assert.ok(r, "c'e' un dispositivo giu'");
  assert.match(r.parole.it.testo, /^1 dispositivo non connesso$/);
});

test("l'assistente sa dov'e' una cosa e chi la gestisce: area, marca, automazioni a orario", async () => {
  const { CapireLaCasa } = await import("../src/capire-la-casa.js");
  const capire = new CapireLaCasa({ memoria: {} });
  /* Nomi che non dicono niente: lo dice l'anagrafe di Home Assistant. */
  capire.descrivi({
    "light.luce_1": "Giardino · Shelly · Plus 1",
    "light.mensola": "Soggiorno · Fluval · Aquasky",
    "binary_sensor.porta_2": "Bagno",
  });
  assert.deepEqual(capire.lasciaStare("light.luce_1", "Luce 1"), { perche: "esterno" });
  assert.deepEqual(capire.lasciaStare("light.mensola", "Mensola"), { perche: "acquario" });
  assert.equal(capire.portaInterna("binary_sensor.porta_2", "Porta 2", "door"), true);
  assert.equal(capire.lasciaStare("light.cucina", "Cucina"), null);
  capire.gestiteDaAutomazioni(["light.cucina"]);
  assert.deepEqual(capire.lasciaStare("light.cucina", "Cucina"), { perche: "automazione" });
});

test("«Cosa c'è in casa»: l'elenco dice cosa ha capito, e «Avvisa» / «Resta così» lo correggono", async () => {
  const { CapireLaCasa } = await import("../src/capire-la-casa.js");
  const capire = new CapireLaCasa({ memoria: {} });
  const stati = new Map([
    [
      "light.luce_acquario_blu",
      { state: "on", attributes: { friendly_name: "Luce acquario blu" } },
    ],
    ["light.cucina", { state: "on", attributes: { friendly_name: "Cucina" } }],
  ]);
  const nome = (s, id) => s.attributes.friendly_name || id;
  const elenco = capire.elenco(stati, nome);
  assert.deepEqual(
    elenco.map((c) => [c.entita, c.perche, c.scelta]),
    [
      ["light.luce_acquario_blu", "acquario", "auto"],
      ["light.cucina", null, "auto"],
    ],
  );
  /* «Avvisa» sull'acquario: si propone anche lui. «Resta così» sulla cucina. */
  assert.equal(capire.scegli("light.luce_acquario_blu", "avvisa"), true);
  assert.equal(capire.lasciaStare("light.luce_acquario_blu", "Luce acquario blu"), null);
  capire.scegli("light.cucina", "resta");
  assert.deepEqual(capire.lasciaStare("light.cucina", "Cucina"), { perche: "detto" });
  /* «Decide lui» torna come prima. */
  capire.scegli("light.luce_acquario_blu", "auto");
  assert.deepEqual(capire.lasciaStare("light.luce_acquario_blu", "Luce acquario blu"), {
    perche: "acquario",
  });
  assert.equal(capire.scegli("light.cucina", "boh"), false);
});

test("un telefono riabbinato riceve una notifica sola, non anche «nuova notifica»", async () => {
  /* La casa tolta e rimessa nell'app: un abbinamento nuovo, lo stesso
   * indirizzo di Firebase. Il vecchio non ha piu' la chiave sul telefono, e la
   * sua busta arrivava come «gdahome · nuova notifica» accanto a quella vera. */
  const banco = unBanco();
  try {
    const nuovo = banco.dispositivi.abbina({ nome: "Telefono A, di nuovo", utente: UTENTE_A });
    const stesso = `gettone-dello-stesso-telefono-${"x".repeat(20)}`;
    const registraCon = (chi) =>
      banco.notifiche.rispondi(
        { id: 1, type: "ponte/notifiche/registra", gettone: stesso },
        { dispositivo: chi.dispositivo },
      );
    await registraCon(banco.a);
    banco.orologio.ora += MINUTO;
    await registraCon(nuovo);
    assert.equal(await banco.notifiche.consegna(antifurto()), 1);
    assert.equal(banco.spinte.length, 1);
    assert.equal(banco.spinte[0].telefono, nuovo.dispositivo.id, "va all'abbinamento nuovo");

    /* Una casa che li aveva gia' doppi da prima: una busta sola lo stesso. */
    banco.notifiche.archivio.dati.telefoni[banco.a.dispositivo.id].gettone = stesso;
    banco.orologio.ora += 6 * MINUTO;
    banco.spinte.length = 0;
    assert.equal(await banco.notifiche.consegna(antifurto({ chiave: "antifurto:y" })), 1);
    assert.equal(banco.spinte[0].telefono, nuovo.dispositivo.id);
  } finally {
    banco.spegni();
  }
});

test("il citofono di Ring: un evento senza classe, col nome o l'evento che dice ding", () => {
  for (const [id, attributi] of [
    ["event.citofono_ding", {}],
    ["event.ingresso_intercom", { event_type: "ding" }],
  ]) {
    const { sentinella, dette } = unaSentinella([stato(id, "2026-10-14T10:00:00Z", attributi)]);
    sentinella.cambia(id, stato(id, "2026-10-14T12:00:00Z", attributi));
    assert.deepEqual(
      dette.map((d) => d.tipo),
      ["campanello"],
      id,
    );
  }
  /* Un evento qualunque che ha «ding» in mezzo al nome non e' un campanello. */
  {
    const altro = "event.building_pulsante";
    const { sentinella, dette } = unaSentinella([stato(altro, "2026-10-14T10:00:00Z", {})]);
    sentinella.cambia(altro, stato(altro, "2026-10-14T12:00:00Z", {}));
    assert.ok(!dette.some((d) => d.tipo === "campanello"));
  }
  /* Il movimento di Ring no: ha la sua classe, e non e' un campanello. */
  const id = "event.citofono_motion";
  const attributi = { device_class: "motion", event_type: "motion" };
  const { sentinella, dette } = unaSentinella([stato(id, "2026-10-14T10:00:00Z", attributi)]);
  sentinella.cambia(id, stato(id, "2026-10-14T12:00:00Z", attributi));
  assert.ok(!dette.some((d) => d.tipo === "campanello"));
});

/* ─── Il movimento davanti alle telecamere ────────────────────────────── */

/* Due telecamere dello stesso modello: gli identificativi hanno in comune il
 * modello, e cambia solo il seriale. Il movimento del balcone e' del balcone. */
const SERIALE_INGRESSO = "i20230101aawrk11111111";
const SERIALE_BALCONE = "i20230101aawrk22222222";
const duePortoni = () => [
  stato("person.uno", "not_home", { friendly_name: "Persona 1", user_id: UTENTE_A }),
  stato(`camera.ds_2cd2143g2_${SERIALE_INGRESSO}_101`, "idle", { friendly_name: "Ingresso" }),
  stato(`camera.ds_2cd2143g2_${SERIALE_BALCONE}_101`, "idle", { friendly_name: "Balcone" }),
  stato(`binary_sensor.ds_2cd2143g2_${SERIALE_BALCONE}_motion`, "off", {
    device_class: "motion",
    friendly_name: "Balcone Motion",
  }),
  stato(`binary_sensor.ds_2cd2143g2_${SERIALE_INGRESSO}_line_crossing`, "off", {
    device_class: "motion",
    friendly_name: "Ingresso Line Crossing",
  }),
];

test("il movimento di una telecamera porta quella telecamera, non una dello stesso modello", () => {
  const { sentinella, dette } = unaSentinella(duePortoni());
  const sensore = `binary_sensor.ds_2cd2143g2_${SERIALE_BALCONE}_motion`;
  sentinella.cambia(
    sensore,
    stato(sensore, "on", { device_class: "motion", friendly_name: "Balcone Motion" }),
  );
  assert.equal(dette.at(-1).tipo, "movimento");
  assert.equal(dette.at(-1).camera, `camera.ds_2cd2143g2_${SERIALE_BALCONE}_101`);
  assert.equal(dette.at(-1).conFoto, true);

  const linea = `binary_sensor.ds_2cd2143g2_${SERIALE_INGRESSO}_line_crossing`;
  sentinella.cambia(
    linea,
    stato(linea, "on", { device_class: "motion", friendly_name: "Ingresso Line Crossing" }),
  );
  assert.equal(dette.at(-1).camera, `camera.ds_2cd2143g2_${SERIALE_INGRESSO}_101`);
});

test("col nome soltanto in comune vale il nome, e a pari merito nessuna telecamera", () => {
  const { sentinella, dette } = unaSentinella([
    stato("person.uno", "not_home", { friendly_name: "Persona 1", user_id: UTENTE_A }),
    stato("camera.cam_a", "idle", { friendly_name: "Giardino" }),
    stato("camera.cam_b", "idle", { friendly_name: "Garage" }),
    stato("binary_sensor.pir_1", "off", { device_class: "motion", friendly_name: "PIR Garage" }),
    stato("binary_sensor.pir_2", "off", { device_class: "motion", friendly_name: "PIR corridoio" }),
  ]);
  sentinella.cambia(
    "binary_sensor.pir_1",
    stato("binary_sensor.pir_1", "on", { device_class: "motion", friendly_name: "PIR Garage" }),
  );
  assert.equal(dette.at(-1).camera, "camera.cam_b");
  sentinella.cambia(
    "binary_sensor.pir_2",
    stato("binary_sensor.pir_2", "on", { device_class: "motion", friendly_name: "PIR corridoio" }),
  );
  assert.equal(dette.at(-1).camera, null, "nessuna telecamera e' vicina: niente foto sbagliata");
});

test("«Quali» del movimento: si salvano, e passano solo le telecamere scelte", async () => {
  const banco = unBanco();
  try {
    await banco.registra(banco.a);
    const balcone = `camera.ds_2cd2143g2_${SERIALE_BALCONE}_101`;
    const ingresso = `camera.ds_2cd2143g2_${SERIALE_INGRESSO}_101`;
    /* Come le manda l'app (`SceltaDellaVoce.inJson`): coi campi vuoti a null. */
    const detto = await banco.notifiche.rispondi(
      {
        id: 9,
        type: "ponte/notifiche/imposta",
        impostazioni: {
          su: {
            movimento: {
              stile: "come-tutte",
              quali: [ingresso, balcone],
              soglia: null,
              suono: "normale",
              orari: null,
              come: "subito",
              dentro: ["durata"],
              quando: "sempre",
            },
          },
        },
      },
      { dispositivo: banco.a.dispositivo },
    );
    assert.equal(detto.success, true);
    assert.deepEqual(detto.result.impostazioni.su.movimento.quali, [ingresso, balcone]);
    assert.deepEqual(banco.notifiche.impostazioniDi(banco.a.dispositivo.id).su.movimento.quali, [
      ingresso,
      balcone,
    ]);

    const movimento = (camera, entita) => ({
      tipo: "movimento",
      urgenza: "normale",
      chiave: `movimento:${entita}`,
      entita,
      camera,
      perche: "casa-vuota",
      parole: { it: { titolo: "Movimento", testo: "" } },
      azioni: [],
    });
    assert.equal(
      await banco.notifiche.consegna(
        movimento(balcone, `binary_sensor.ds_2cd2143g2_${SERIALE_BALCONE}_motion`),
      ),
      1,
      "dal sensore della telecamera scelta: passa",
    );
    assert.equal(
      await banco.notifiche.consegna(movimento("camera.giardino", "binary_sensor.pir_giardino")),
      0,
      "da una telecamera non scelta: no",
    );
  } finally {
    banco.spegni();
  }
});

/* ─── Dove porta il tocco ─────────────────────────────────────────────── */

test("dentro la busta c'e' dove porta il tocco: la sezione, e la cosa", async () => {
  const banco = unBanco({ chiuse: new Set(["camera.ingresso"]) });
  try {
    await banco.registra(banco.a);
    await banco.registra(banco.b);
    /* L'antifurto scattato: la Sicurezza, con la sua centrale; la
     * telecamera solo a chi la vede (B no). */
    await banco.notifiche.consegna(antifurto({ entita: "alarm_control_panel.casa" }));
    const di = (chi) =>
      banco.apri(
        banco.spinte.find((s) => s.telefono === chi.dispositivo.id),
        chi,
      );
    assert.deepEqual(di(banco.a).apri, {
      sezione: "sicurezza",
      entita: "alarm_control_panel.casa",
    });
    assert.deepEqual(di(banco.b).apri, {
      sezione: "sicurezza",
      entita: "alarm_control_panel.casa",
    });
    assert.equal(JSON.stringify(di(banco.b)).includes("camera.ingresso"), false);
  } finally {
    banco.spegni();
  }
});

test("doveApre: ogni tipo la sua sezione, e niente di chi non deve", () => {
  assert.deepEqual(doveApre({ tipo: "aperture", entita: "binary_sensor.porta_garage" }), {
    sezione: "varchi",
    entita: "binary_sensor.porta_garage",
  });
  assert.deepEqual(doveApre({ tipo: "movimento", entita: "binary_sensor.pir" }, "camera.balcone"), {
    sezione: "telecamera",
    entita: "camera.balcone",
  });
  /* La telecamera che a lui non si mostra non entra nella busta. */
  assert.deepEqual(
    doveApre({ tipo: "movimento", entita: "binary_sensor.pir", camera: "camera.x" }),
    {
      sezione: "sicurezza",
      entita: "binary_sensor.pir",
    },
  );
  assert.deepEqual(doveApre({ tipo: "pioggia" }), { sezione: "meteo" });
  assert.deepEqual(doveApre({ tipo: "arrivi", entita: "person.uno" }), { sezione: "persone" });
  assert.deepEqual(doveApre({ tipo: "riepilogo" }), { sezione: "giornata" });
  assert.deepEqual(doveApre({ tipo: "blackout" }), { sezione: "energia" });
  assert.deepEqual(doveApre({ tipo: "viaggi" }), { sezione: "viaggi" });
  assert.deepEqual(doveApre({ tipo: "ha_notify" }), { sezione: "plancia" });
  assert.equal(doveApre({ tipo: "prova" }), null);
});
