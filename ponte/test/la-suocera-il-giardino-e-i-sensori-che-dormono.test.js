/* Le notifiche di una casa vera, dal campo (Raffaele, Premium).
 *
 *  1. «Ieri mi arrivavano notifiche di continuo per il fatto che non era
 *     attivato l'allarme, da parte dei sensori di movimento. A casa c'era mia
 *     suocera.» — la casa e' vuota per le persone di Home Assistant, ma
 *     dentro qualcuno si muove: il movimento si dice una volta, non a ogni
 *     passaggio, e il tasto «C'è qualcuno» lo zittisce fino al ritorno.
 *  2. «Oppure notifiche della temperatura del sensore che ho in giardino.» e
 *  3. «Non mi deve suggerire di attivare il riscaldamento.» — un termometro
 *     fuori casa non e' una stanza fredda, comunque lo si riconosca.
 *  4. «Ho tantissimi sensori che dice che non rispondono quando invece sono
 *     collegati e funzionano benissimo.» — solo `unavailable` che dura, e i
 *     sensori a pile che dormono non sono rotti.
 *
 * Gli stati sono come li manda Home Assistant: le classi, i nomi, le aree dei
 * registri, l'attribuzione dei servizi meteo, la configurazione della plancia.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Sentinella } from "../src/sentinella.js";
import { Dispositivi } from "../src/dispositivi.js";
import { Notifiche } from "../src/notifiche.js";
import { apriLaSpinta } from "../src/spinta.js";

const MINUTO = 60 * 1000;
const ORA = 60 * MINUTO;

/* Un mercoledi' d'autunno, all'ora che serve, nell'ora di questa macchina. */
const alle = (ore, minuti = 0, giorno = 11) => new Date(2026, 10, giorno, ore, minuti).getTime();

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
  sentinella.carica(stati);
  return { sentinella, dette, orologio };
}

/* ─── 1. La suocera ──────────────────────────────────────────────────────── */

const PIR = ["cucina", "sala", "corridoio", "camera"];
const pir = (dove, state, fa = 0, ora = alle(9)) =>
  stato(
    `binary_sensor.movimento_${dove}`,
    state,
    { device_class: "motion", friendly_name: `Movimento ${dove}` },
    fa,
    ora,
  );

function laCasaDiRaffaele(ora = alle(9)) {
  return unaCasa(
    [
      /* Raffaele e la moglie sono al lavoro dalle otto: per Home Assistant la
       * casa e' vuota. La suocera un telefono abbinato non ce l'ha. */
      stato("person.raffaele", "not_home", { friendly_name: "Raffaele" }, ORA, ora),
      stato("person.moglie", "not_home", { friendly_name: "Moglie" }, ORA, ora),
      stato("alarm_control_panel.casa", "disarmed", { friendly_name: "Antifurto" }, ORA, ora),
      ...PIR.map((dove) => pir(dove, "off", ORA, ora)),
      stato(
        "binary_sensor.telecamera_retro_motion",
        "off",
        { device_class: "motion", friendly_name: "Telecamera retro movimento" },
        ORA,
        ora,
      ),
      stato("light.cucina", "on", { friendly_name: "Cucina" }, 0, ora),
    ],
    { ora, aree: { "binary_sensor.telecamera_retro_motion": "Giardino" } },
  );
}

/* La suocera gira per casa: un sensore ogni sette minuti, che si spegne dopo
 * un minuto. */
function giraPerCasa(casa, { dalle, alle: fino, ogni = 7 * MINUTO }) {
  let giro = 0;
  for (let t = dalle; t < fino; t += ogni) {
    const dove = PIR[giro++ % PIR.length];
    casa.orologio.ora = t;
    casa.sentinella.cambia(`binary_sensor.movimento_${dove}`, pir(dove, "on", 0, t));
    casa.sentinella.battito();
    casa.orologio.ora = t + MINUTO;
    casa.sentinella.cambia(`binary_sensor.movimento_${dove}`, pir(dove, "off", 0, t + MINUTO));
    casa.sentinella.battito();
  }
}

const movimenti = (dette) => dette.filter((e) => e.tipo === "movimento");

test("la suocera in casa tutto il giorno: un movimento solo, non uno ogni passaggio", () => {
  const casa = laCasaDiRaffaele();
  giraPerCasa(casa, { dalle: alle(9), alle: alle(18) });
  const dette = movimenti(casa.dette);
  assert.equal(dette.length, 1, "nove ore di passaggi, una notifica");
  const [prima] = dette;
  assert.equal(prima.perche, "casa-vuota");
  assert.equal(prima.entita, "binary_sensor.movimento_cucina");
  /* Il primo movimento con la casa vuota si dice sempre, col tasto per
   * inserire l'antifurto e quello per dire che qualcuno c'e'. */
  assert.deepEqual(
    prima.azioni.map((a) => a.id),
    ["guarda", "inserisci", "qualcuno"],
  );
  assert.equal(prima.azioni[2].parole.it, "C'è qualcuno");
  /* E con qualcuno che si muove, le luci accese non sono «con la casa vuota». */
  assert.equal(
    casa.dette.filter((e) => e.chiave === "suggerimenti:luci").length,
    0,
    "non si propone di spegnere la luce a chi e' in cucina",
  );
});

test("chi il movimento lo vuole sempre lo riceve ancora, ma non come «casa vuota»", () => {
  const casa = laCasaDiRaffaele();
  casa.sentinella.movimentoSempre = true;
  giraPerCasa(casa, { dalle: alle(9), alle: alle(10) });
  const dette = movimenti(casa.dette);
  assert.ok(dette.length > 1, "la scelta «sempre» resta");
  assert.equal(dette.filter((e) => e.perche === "casa-vuota").length, 1);
  assert.ok(dette.slice(1).every((e) => e.perche === "giorno"));
});

test("la casa ferma per ore, poi un movimento: e' di nuovo una notizia", () => {
  const casa = laCasaDiRaffaele();
  giraPerCasa(casa, { dalle: alle(9), alle: alle(12) });
  assert.equal(movimenti(casa.dette).length, 1);
  /* La suocera esce a mezzogiorno. Alle cinque si muove qualcosa in sala: la
   * casa e' ferma da cinque ore, e chi entra adesso va detto. */
  casa.orologio.ora = alle(17);
  casa.sentinella.battito();
  casa.sentinella.cambia("binary_sensor.movimento_sala", pir("sala", "on", 0, alle(17)));
  const dette = movimenti(casa.dette);
  assert.equal(dette.length, 2);
  assert.equal(dette[1].perche, "casa-vuota");
  assert.equal(dette[1].entita, "binary_sensor.movimento_sala");
});

test("la telecamera del giardino non dice che in casa c'e' qualcuno", () => {
  const casa = laCasaDiRaffaele();
  const retro = "binary_sensor.telecamera_retro_motion";
  const attributi = { device_class: "motion", friendly_name: "Telecamera retro movimento" };
  /* Il gatto davanti alla telecamera del giardino, ogni tre minuti. */
  for (let t = alle(9); t < alle(9, 30); t += 3 * MINUTO) {
    casa.orologio.ora = t;
    casa.sentinella.cambia(retro, stato(retro, "on", attributi, 0, t));
    casa.orologio.ora = t + MINUTO;
    casa.sentinella.cambia(retro, stato(retro, "off", attributi, 0, t + MINUTO));
  }
  assert.equal(movimenti(casa.dette).length, 1, "il giardino una volta");
  /* Un'ora dopo, qualcuno in corridoio: e' un altro sensore, e la casa non
   * ha nessuno che si muove dentro. */
  casa.orologio.ora = alle(10, 40);
  casa.sentinella.cambia(
    "binary_sensor.movimento_corridoio",
    pir("corridoio", "on", 0, alle(10, 40)),
  );
  const dette = movimenti(casa.dette);
  assert.equal(dette.length, 2);
  assert.equal(dette[1].entita, "binary_sensor.movimento_corridoio");
});

test("torna Raffaele e riesce: e' un'altra assenza, e il primo movimento si dice", () => {
  const casa = laCasaDiRaffaele();
  giraPerCasa(casa, { dalle: alle(9), alle: alle(10) });
  assert.equal(movimenti(casa.dette).length, 1);
  casa.orologio.ora = alle(10, 5);
  casa.sentinella.cambia(
    "person.raffaele",
    stato("person.raffaele", "home", { friendly_name: "Raffaele" }, 0, alle(10, 5)),
  );
  casa.orologio.ora = alle(10, 20);
  casa.sentinella.cambia(
    "person.raffaele",
    stato("person.raffaele", "not_home", { friendly_name: "Raffaele" }, 0, alle(10, 20)),
  );
  /* Dieci minuti di casa ferma dopo l'uscita, e il primo movimento si dice. */
  casa.orologio.ora = alle(10, 35);
  casa.sentinella.cambia("binary_sensor.movimento_sala", pir("sala", "on", 0, alle(10, 35)));
  const dette = movimenti(casa.dette);
  assert.equal(dette.length, 2);
  assert.equal(dette[1].perche, "casa-vuota");
});

/* Il banco: un telefono abbinato, con le notifiche chieste. */
async function unBanco(orologio, impostazioni = null) {
  const cartella = mkdtempSync(join(tmpdir(), "raffaele-"));
  const dispositivi = new Dispositivi({ cartella, adesso: () => orologio.ora });
  const a = dispositivi.abbina({ nome: "Telefono di Raffaele", utente: "a".repeat(32) });
  const spinte = [];
  const notifiche = new Notifiche({
    cartella,
    dispositivi,
    utenti: {
      elenco: async () => [
        { id: "a".repeat(32), nome: "Raffaele", amministratore: true, attivo: true },
      ],
      eVivo: async () => true,
    },
    casa: { chiedi: async () => [], ascolta: async () => () => {} },
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
  await notifiche.rispondi(
    { id: 1, type: "ponte/notifiche/registra", gettone: `gettone-${"x".repeat(24)}` },
    { dispositivo: a.dispositivo },
  );
  if (impostazioni)
    await notifiche.rispondi(
      { id: 2, type: "ponte/notifiche/imposta", impostazioni },
      { dispositivo: a.dispositivo },
    );
  const apri = (spinta) =>
    apriLaSpinta({ chiaveDelFilo: a.chiave, telefono: a.dispositivo.id, busta: spinta.busta });
  const spegni = () => {
    notifiche.ferma();
    rmSync(cartella, { recursive: true, force: true });
  };
  return { notifiche, a, spinte, apri, spegni };
}

test("«C'è qualcuno» sotto la notifica: il movimento con la casa vuota tace fino al ritorno", async () => {
  const orologio = { ora: alle(9) };
  const banco = await unBanco(orologio);
  try {
    const { notifiche } = banco;
    const dette = [];
    notifiche.sentinella.quando = (e) => dette.push(e);
    notifiche.sentinella.carica([
      stato("person.raffaele", "not_home", { friendly_name: "Raffaele" }, ORA, orologio.ora),
      stato("alarm_control_panel.casa", "disarmed", {}, ORA, orologio.ora),
      pir("cucina", "off", ORA),
      pir("sala", "off", ORA),
    ]);
    notifiche.sentinella.cambia("binary_sensor.movimento_cucina", pir("cucina", "on", 0));
    notifiche.sentinella.cambia("binary_sensor.movimento_cucina", pir("cucina", "off", 0));
    assert.equal(dette.length, 1);
    assert.equal(await notifiche.consegna({ ...dette[0], quando: orologio.ora }), 1);
    const busta = banco.apri(banco.spinte.at(-1));
    assert.ok(busta.azioni.some((x) => x.etichetta === "C'è qualcuno"));
    const detto = await notifiche.rispondi(
      { id: 3, type: "ponte/notifiche/azione", notifica: busta.id, azione: "qualcuno" },
      { dispositivo: banco.a.dispositivo },
    );
    assert.equal(detto.success, true);
    /* Cinque ore dopo, la casa ferma da cinque ore: e' stato detto che
     * qualcuno c'e', e il movimento non si dice. */
    orologio.ora = alle(14);
    notifiche.sentinella.cambia("binary_sensor.movimento_sala", pir("sala", "on", 0, orologio.ora));
    assert.equal(movimenti(dette).length, 1);
    /* Torna Raffaele, riesce: l'assenza nuova ricomincia da capo. */
    orologio.ora = alle(18);
    notifiche.sentinella.cambia(
      "person.raffaele",
      stato("person.raffaele", "home", { friendly_name: "Raffaele" }, 0, orologio.ora),
    );
    orologio.ora = alle(18, 30);
    notifiche.sentinella.cambia(
      "person.raffaele",
      stato("person.raffaele", "not_home", { friendly_name: "Raffaele" }, 0, orologio.ora),
    );
    orologio.ora = alle(19);
    notifiche.sentinella.cambia(
      "binary_sensor.movimento_cucina",
      pir("cucina", "on", 0, orologio.ora),
    );
    assert.equal(movimenti(dette).length, 2);
  } finally {
    banco.spegni();
  }
});

/* «Ed io sono dentro»: alle 9:36 il telefono di Raffaele dice che e' uscito,
 * e nello stesso minuto la presenza dello studio, la telecamera, il corridoio
 * e il letto si accendono. Arrivavano quattro «Movimento · casa vuota» e
 * «Porta Studio: porta aperta, uscita l'ultima persona alle 9:36». */
const occupato = (id, nome, state, ora, fa = 0) =>
  stato(id, state, { device_class: "occupancy", friendly_name: nome }, fa, ora);
const movimento = (id, nome, state, ora, fa = 0) =>
  stato(id, state, { device_class: "motion", friendly_name: nome }, fa, ora);
const portaStudio = (ora) =>
  stato(
    "binary_sensor.porta_studio",
    "on",
    { device_class: "door", friendly_name: "Porta Studio" },
    ora - alle(9, 16),
    ora,
  );

function raffaeleDentro() {
  const ora = alle(9, 30);
  return unaCasa(
    [
      stato("person.raffaele", "home", { friendly_name: "Raffaele" }, ORA, ora),
      stato("person.moglie", "not_home", { friendly_name: "Moglie" }, 2 * ORA, ora),
      stato("alarm_control_panel.casa", "disarmed", { friendly_name: "Antifurto" }, ORA, ora),
      occupato("binary_sensor.presenza_occupazione", "Presenza Occupazione", "off", ora, ORA),
      occupato("binary_sensor.letto_occupato", "Letto Occupato", "off", ora, ORA),
      movimento("binary_sensor.corridoio_occupazione", "Corridoio Occupazione", "off", ora, ORA),
      movimento("binary_sensor.telecamera_camera_motion", "Telecamera camera", "off", ora, ORA),
      portaStudio(ora),
    ],
    { ora },
  );
}

/* Il telefono dice «uscito», e in casa ci si muove. */
function esceIlTelefono(casa, quando) {
  casa.orologio.ora = quando;
  casa.sentinella.cambia(
    "person.raffaele",
    stato("person.raffaele", "not_home", { friendly_name: "Raffaele" }, 0, quando),
  );
}

const accendi = (casa, id, quando, fatto, nome) => {
  casa.orologio.ora = quando;
  casa.sentinella.cambia(id, fatto(id, nome, "on", quando));
  casa.sentinella.battito();
};
const spegni = (casa, id, quando, fatto, nome) => {
  casa.orologio.ora = quando;
  casa.sentinella.cambia(id, fatto(id, nome, "off", quando));
  casa.sentinella.battito();
};

test("«Ed io sono dentro»: il telefono dice uscito, la casa si muove, niente «casa vuota»", () => {
  const casa = raffaeleDentro();
  esceIlTelefono(casa, alle(9, 36));
  accendi(
    casa,
    "binary_sensor.presenza_occupazione",
    alle(9, 36),
    occupato,
    "Presenza Occupazione",
  );
  accendi(
    casa,
    "binary_sensor.telecamera_camera_motion",
    alle(9, 36),
    movimento,
    "Telecamera camera",
  );
  accendi(
    casa,
    "binary_sensor.corridoio_occupazione",
    alle(9, 36),
    movimento,
    "Corridoio Occupazione",
  );
  spegni(
    casa,
    "binary_sensor.telecamera_camera_motion",
    alle(9, 37),
    movimento,
    "Telecamera camera",
  );
  spegni(
    casa,
    "binary_sensor.corridoio_occupazione",
    alle(9, 37),
    movimento,
    "Corridoio Occupazione",
  );
  spegni(casa, "binary_sensor.presenza_occupazione", alle(9, 37), occupato, "Presenza Occupazione");
  /* Si mette a letto: il letto resta occupato, e la casa non e' vuota. */
  accendi(casa, "binary_sensor.letto_occupato", alle(9, 37), occupato, "Letto Occupato");
  for (let t = alle(9, 38); t <= alle(10, 31); t += MINUTO) {
    casa.orologio.ora = t;
    casa.sentinella.battito();
  }
  assert.equal(movimenti(casa.dette).length, 0, "nessun «Movimento · casa vuota»");
  assert.equal(
    casa.dette.filter((e) => e.tipo === "aperture").length,
    0,
    "niente «Porta Studio: porta aperta» a chi e' nello studio",
  );
  /* Si alza alle 10:40 e gira per casa: chi si muove dentro tiene la casa
   * «occupata», un movimento dopo l'altro. */
  spegni(casa, "binary_sensor.letto_occupato", alle(10, 40), occupato, "Letto Occupato");
  for (let t = alle(10, 41); t < alle(12); t += 6 * MINUTO) {
    accendi(casa, "binary_sensor.corridoio_occupazione", t, movimento, "Corridoio Occupazione");
    spegni(
      casa,
      "binary_sensor.corridoio_occupazione",
      t + MINUTO,
      movimento,
      "Corridoio Occupazione",
    );
  }
  assert.equal(movimenti(casa.dette).length, 0);
});

test("chi esce davvero: la casa si ferma, e il movimento dopo si dice; la porta anche", () => {
  const casa = raffaeleDentro();
  esceIlTelefono(casa, alle(9, 36));
  /* Il corridoio verso la porta: e' lui che esce. */
  accendi(
    casa,
    "binary_sensor.corridoio_occupazione",
    alle(9, 36),
    movimento,
    "Corridoio Occupazione",
  );
  spegni(
    casa,
    "binary_sensor.corridoio_occupazione",
    alle(9, 37),
    movimento,
    "Corridoio Occupazione",
  );
  assert.equal(movimenti(casa.dette).length, 0, "chi esce non e' un movimento con la casa vuota");
  for (let t = alle(9, 38); t <= alle(9, 50); t += MINUTO) {
    casa.orologio.ora = t;
    casa.sentinella.battito();
  }
  /* Dieci minuti di casa ferma: la porta lasciata aperta si dice. */
  const porta = casa.dette.filter((e) => e.tipo === "aperture");
  assert.equal(porta.length, 1);
  assert.match(porta[0].parole.it.testo, /uscita l'ultima persona alle 9:36/);
  /* E alle 11 qualcuno entra: il primo movimento si dice. */
  accendi(casa, "binary_sensor.telecamera_camera_motion", alle(11), movimento, "Telecamera camera");
  const dette = movimenti(casa.dette);
  assert.equal(dette.length, 1);
  assert.equal(dette[0].perche, "casa-vuota");
});

/* ─── 2 e 3. Il termometro del giardino ──────────────────────────────────── */

const gradi = (id, valore, nome, attributi = {}, ora = alle(8)) =>
  stato(
    id,
    String(valore),
    {
      device_class: "temperature",
      state_class: "measurement",
      unit_of_measurement: "°C",
      friendly_name: nome,
      ...attributi,
    },
    ORA,
    ora,
  );

/* Una mattina di novembre: Raffaele e' in casa, fuori ci sono sei gradi. */
function unaMattinaFredda(sensori, { valori = {}, aree = {} } = {}) {
  const ora = alle(8);
  const casa = unaCasa(
    [
      stato("person.raffaele", "home", { friendly_name: "Raffaele" }, 10 * ORA, ora),
      /* La pompa di calore: l'unita' esterna sta in giardino, ed e' spenta. */
      stato("climate.pompa_di_calore", "off", { friendly_name: "Pompa di calore" }, ORA, ora),
      gradi("sensor.soggiorno_temperatura", 20.5, "Soggiorno temperatura"),
      ...sensori,
    ],
    {
      ora,
      valori,
      aree: { "climate.pompa_di_calore": "Giardino", ...aree },
    },
  );
  casa.sentinella.battito();
  for (let i = 0; i < 40; i++) {
    casa.orologio.ora += MINUTO;
    casa.sentinella.battito();
  }
  return casa.dette.filter((e) => e.chiave?.startsWith("suggerimenti:comfort:"));
}

test("«Giardino temperatura» a sei gradi: niente «fa freddo», niente riscaldamento", () => {
  const dette = unaMattinaFredda(
    [gradi("sensor.giardino_temperatura", 6.1, "Giardino temperatura")],
    { aree: { "sensor.giardino_temperatura": "Giardino" } },
  );
  assert.deepEqual(dette, []);
});

test("fuori casa anche senza un nome che lo dica: l'area, la plancia, il servizio meteo", () => {
  const sensori = [
    /* Un Aqara col nome di fabbrica, nell'area «Esterno» dei registri. */
    gradi("sensor.0x00158d0004a1b2c3_temperature", 5.8, "Sensore 3 temperatura"),
    /* Un Sonoff nella stanza «Prato» della plancia. */
    gradi("sensor.snzb02_temperatura", 6.4, "SNZB-02 temperatura"),
    /* Uno Shelly in una stanza della plancia segnata «All'aperto». */
    gradi("sensor.shelly_ht_temperatura", 6.9, "Shelly H&T temperatura"),
    /* La stazione meteo della testata della plancia. */
    gradi("sensor.stazione_t", 6.2, "Stazione T"),
    /* Il servizio meteo: met.no lo scrive nell'attribuzione. */
    gradi("sensor.casa_temperature", 7, "Casa Temperature", {
      attribution:
        "Weather forecast from met.no, delivered by the Norwegian Meteorological Institute.",
    }),
    /* Il punto di rugiada non e' una stanza. */
    gradi("sensor.netatmo_punto_di_rugiada", 3, "Punto di rugiada"),
  ];
  const valori = {
    cd_stanze: JSON.stringify([
      { name: "Soggiorno", temp: "sensor.soggiorno_temperatura" },
      { name: "Prato", temp: "sensor.snzb02_temperatura" },
      { name: "Lato nord", temp: "sensor.shelly_ht_temperatura", outdoor: true },
    ]),
    cd_entity_overrides: JSON.stringify({ "dm.home_meteo_temperatura": "sensor.stazione_t" }),
  };
  const dette = unaMattinaFredda(sensori, {
    valori,
    aree: { "sensor.0x00158d0004a1b2c3_temperature": "Esterno" },
  });
  assert.deepEqual(
    dette.map((e) => e.parole.it.titolo),
    [],
  );
});

test("una stanza fredda davvero si dice ancora, anche se il sensore e' di Netatmo", () => {
  const dette = unaMattinaFredda(
    [
      gradi("sensor.giardino_temperatura", 6.1, "Giardino temperatura"),
      /* Netatmo scrive l'attribuzione anche sul modulo di casa: non e' meteo. */
      gradi("sensor.netatmo_camera_temperature", 15.2, "Camera Temperature", {
        attribution: "Data provided by Netatmo",
      }),
    ],
    { aree: { "sensor.netatmo_camera_temperature": "Camera" } },
  );
  assert.equal(dette.length, 1);
  assert.equal(dette[0].parole.it.titolo, "🥶 Camera: 15 °C");
  /* Nessun clima nella Camera: si guarda, non si accende niente. */
  assert.deepEqual(
    dette[0].azioni.map((a) => a.id),
    ["guarda", "basta"],
  );
});

test("i suggerimenti si spengono davvero: con «Solo gli importanti» o la voce spenta non arrivano", async () => {
  const orologio = { ora: alle(15) };
  const comfort = () => ({
    tipo: "suggerimenti",
    urgenza: "bassa",
    importante: false,
    chiave: "suggerimenti:comfort:camera",
    quando: orologio.ora,
    parole: { it: { titolo: "🥶 Camera: 15 °C", testo: "Qualcuno è in casa, e fa freddo." } },
    azioni: [],
  });
  /* Di serie: «Solo gli importanti», e il comfort non lo e'. */
  let banco = await unBanco(orologio);
  try {
    assert.equal(await banco.notifiche.consegna(comfort()), 0);
  } finally {
    banco.spegni();
  }
  /* «Tutti»: arriva. */
  banco = await unBanco(orologio, { assistente: "tutti" });
  try {
    assert.equal(await banco.notifiche.consegna(comfort()), 1);
  } finally {
    banco.spegni();
  }
  /* «Tutti», ma l'assistente spento: non arriva. */
  banco = await unBanco(orologio, { assistente: "tutti", eventi: { suggerimenti: false } });
  try {
    assert.equal(await banco.notifiche.consegna(comfort()), 0);
  } finally {
    banco.spegni();
  }
});

/* ─── 4. I sensori che dormono ───────────────────────────────────────────── */

function unaCasaConIRegistri(stati, { ora, valori = {} }) {
  const casa = unaCasa(
    stati.map(([s]) => s),
    { ora, valori },
  );
  casa.sentinella.dispositivoDi = Object.fromEntries(stati.map(([s, suo]) => [s.entity_id, suo]));
  casa.sentinella.nomiDeiDispositivi = {
    porta: "Porta cantina",
    finestra: "Finestra bagno",
    termometro: "Termometro studio",
    presa: "Presa giardino",
    lavatrice: "Lavatrice",
    router: "Router",
    natale: "Presa albero di Natale",
  };
  return casa;
}

const nonRispondono = (casa) =>
  casa.dette.filter((e) => e.chiave === "suggerimenti:non-rispondono");

test("i sensori a pile che parlano poco non sono «non rispondono»", () => {
  const ora = alle(10, 5);
  const casa = unaCasaConIRegistri(
    [
      /* Un contatto Zigbee chiuso da cinque giorni: risponde benissimo. */
      [
        stato("binary_sensor.porta_cantina", "off", { device_class: "door" }, 5 * 24 * ORA, ora),
        "porta",
      ],
      [
        stato("sensor.porta_cantina_batteria", "87", { device_class: "battery" }, 3 * ORA, ora),
        "porta",
      ],
      /* Una finestra a pile che ZHA dice `unavailable` da nove ore perche'
       * non ha avuto niente da dire: dorme. */
      [
        stato(
          "binary_sensor.finestra_bagno",
          "unavailable",
          { device_class: "window" },
          9 * ORA,
          ora,
        ),
        "finestra",
      ],
      [
        stato(
          "sensor.finestra_bagno_battery",
          "unavailable",
          { device_class: "battery", unit_of_measurement: "%" },
          9 * ORA,
          ora,
        ),
        "finestra",
      ],
      /* Dopo un riavvio: `unknown` non e' «non risponde». */
      [stato("sensor.lavatrice_stato", "unknown", {}, 3 * MINUTO, ora), "lavatrice"],
    ],
    { ora },
  );
  casa.sentinella.battito();
  casa.orologio.ora += MINUTO;
  casa.sentinella.battito();
  assert.equal(nonRispondono(casa).length, 0);
  assert.equal(casa.sentinella.cosaSistemare().spenti, 0);
});

test("un termometro Bluetooth visto tornare da solo dorme; una presa no", () => {
  const ora = alle(20);
  const casa = unaCasaConIRegistri(
    [
      [stato("sensor.termometro_studio_temperatura", "21.4", {}, ORA, ora), "termometro"],
      [stato("switch.presa_giardino", "on", {}, ORA, ora), "presa"],
    ],
    { ora },
  );
  /* Il termometro sparisce un'ora e torna da solo; poi rida' `unavailable`. */
  const t = "sensor.termometro_studio_temperatura";
  const giu = (fa) => stato(t, "unavailable", {}, fa, casa.orologio.ora);
  casa.sentinella.cambia(t, giu(0));
  casa.orologio.ora += ORA;
  casa.sentinella.cambia(t, stato(t, "21.1", {}, 0, casa.orologio.ora));
  casa.orologio.ora += 10 * MINUTO;
  casa.sentinella.cambia(t, giu(0));
  /* La presa cade anche lei, e non torna. */
  casa.sentinella.cambia(
    "switch.presa_giardino",
    stato("switch.presa_giardino", "unavailable", {}, 0, casa.orologio.ora),
  );
  casa.orologio.ora += 2 * ORA;
  assert.equal(casa.sentinella.cosaSistemare().spenti, 1, "la presa si', il termometro no");
});

test("unavailable da mezz'ora: una riga sola nel riepilogo; dopo un riavvio, niente", () => {
  const ora = alle(20, 30);
  const presa = (id, fa) => [stato(id, "unavailable", {}, fa, ora), "presa"];
  /* Il riavvio di Home Assistant di dieci minuti fa: tutto torna piano piano. */
  const riavvio = unaCasaConIRegistri(
    [
      presa("switch.presa_giardino", 10 * MINUTO),
      presa("sensor.presa_giardino_potenza", 10 * MINUTO),
      [stato("switch.lavatrice", "unavailable", {}, 10 * MINUTO, ora), "lavatrice"],
      [stato("sensor.router_wan", "unavailable", {}, 10 * MINUTO, ora), "router"],
    ],
    { ora },
  );
  assert.equal(riavvio.sentinella.cosaSistemare().spenti, 0);
  assert.equal(riavvio.sentinella.riepilogo(), null);

  /* Tre dispositivi muti da quaranta minuti, e la presa dell'albero di Natale
   * che chi abita ha messo da parte nella pagina «Non connessi». */
  const muti = unaCasaConIRegistri(
    [
      presa("switch.presa_giardino", 40 * MINUTO),
      presa("sensor.presa_giardino_potenza", 40 * MINUTO),
      [stato("switch.lavatrice", "unavailable", {}, 40 * MINUTO, ora), "lavatrice"],
      [stato("sensor.router_wan", "unavailable", {}, 40 * MINUTO, ora), "router"],
      [stato("switch.albero", "unavailable", {}, 40 * 24 * ORA, ora), "natale"],
    ],
    {
      ora,
      valori: { cd_widgets: JSON.stringify({ excluded: ["nonrisponde|switch.albero"] }) },
    },
  );
  assert.equal(muti.sentinella.cosaSistemare().spenti, 3);
  const r = muti.sentinella.riepilogo();
  assert.equal(r.parole.it.testo, "3 dispositivi non connessi");
});

test("alle dieci, una notifica sola per tutti i muti; lo stesso elenco non si ridice ogni mattina", () => {
  const ora = alle(10, 2);
  const casa = unaCasaConIRegistri(
    [
      [stato("switch.presa_giardino", "unavailable", {}, 8 * ORA, ora), "presa"],
      [stato("sensor.presa_giardino_potenza", "unavailable", {}, 8 * ORA, ora), "presa"],
      [stato("switch.lavatrice", "unavailable", {}, 7 * ORA, ora), "lavatrice"],
      [stato("sensor.router_wan", "unavailable", {}, 9 * ORA, ora), "router"],
    ],
    { ora },
  );
  casa.sentinella.battito();
  casa.orologio.ora += MINUTO;
  casa.sentinella.battito();
  let dette = nonRispondono(casa);
  assert.equal(dette.length, 1, "una sola, non una per dispositivo");
  assert.equal(dette[0].parole.it.titolo, "📡 3 dispositivi non rispondono");
  assert.equal(dette[0].parole.it.testo, "Lavatrice, Presa giardino, Router · da 7 h.");

  /* Il giorno dopo, alle dieci: gli stessi tre, non si ridice. */
  casa.orologio.ora = alle(10, 2, 12);
  casa.sentinella.battito();
  assert.equal(nonRispondono(casa).length, 1);

  /* Il terzo giorno cade anche il termometro, che non va a pile: si dice, con
   * tutti. */
  casa.sentinella.dispositivoDi["sensor.termometro_studio_temperatura"] = "termometro";
  casa.orologio.ora = alle(1, 0, 13);
  casa.sentinella.cambia(
    "sensor.termometro_studio_temperatura",
    stato("sensor.termometro_studio_temperatura", "unavailable", {}, 0, casa.orologio.ora),
  );
  casa.orologio.ora = alle(10, 2, 13);
  casa.sentinella.battito();
  dette = nonRispondono(casa);
  assert.equal(dette.length, 2);
  assert.equal(dette[1].parole.it.titolo, "📡 4 dispositivi non rispondono");
});
