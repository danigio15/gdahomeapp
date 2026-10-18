/* La parte dati della giornata e delle automazioni compatte.
 *
 * Quello che deve restare vero: ogni carico si conta tutto il giorno, col
 * sole, la batteria e la rete divisi come per i cicli, e i piu' grossi
 * restano nei giorni passati; i carichi della plancia si leggono dal suo
 * stato salvato; il riepilogo dice chi ha consumato di piu'; la pagina «La
 * tua giornata» la legge solo chi ha un utente; le categorie delle
 * automazioni sono solo quelle salvate in Home Assistant; e ogni automazione,
 * anche complessa, si racconta in una riga.
 */

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { Automazioni } from "../src/automazioni.js";
import { Dispositivi } from "../src/dispositivi.js";
import {
  carichiDellaGiornata,
  carichiDellaPlancia,
  TaccuinoDellEnergia,
} from "../src/l-energia-di-casa.js";
import { LA_GIORNATA, Notifiche } from "../src/notifiche.js";
import { paroleDelRiepilogo } from "../src/parole-delle-notifiche.js";
import { riassuntoDellAutomazione } from "../src/riassunto-delle-automazioni.js";
import { Sentinella } from "../src/sentinella.js";

const W = { device_class: "power", unit_of_measurement: "W" };
const stato = (entity_id, state, attributes = {}) => ({ entity_id, state, attributes });
const mezzogiorno = () => new Date(2026, 9, 14, 12, 0).getTime();

/* ─── I carichi della giornata ────────────────────────────────────────── */

test("ogni carico si conta tutto il giorno: kWh, quota di sole ed euro della rete", () => {
  const orologio = { ora: mezzogiorno() };
  const taccuino = new TaccuinoDellEnergia({ adesso: () => orologio.ora });
  const prezzo = () => ({ prezzo: 0.2, indice: 0 });
  const passa = (minuti, letture) => {
    for (let i = 0; i < minuti * 2; i += 1) {
      orologio.ora += 30 * 1000;
      taccuino.campiona(letture, prezzo);
    }
  };
  const primo = { "sensor.pdc_w": 2000, "sensor.forno_w": 1000, "sensor.led_w": 5 };
  taccuino.campiona({ sole: 3000, rete: 0, carichi: primo }, prezzo);
  /* Un'ora col sole che basta per tutto, un'ora con la rete che mette tutto. */
  passa(60, { sole: 3000, rete: 0, carichi: primo });
  passa(60, { sole: 0, rete: 2000, carichi: { "sensor.pdc_w": 2000 } });
  const carichi = taccuino.laGiornata().carichi;
  assert.deepEqual(
    carichi.map((c) => c.id),
    ["sensor.pdc_w", "sensor.forno_w"],
    "dal piu' grosso, e sotto i 10 Wh non si dice",
  );
  const [pdc, forno] = carichi;
  assert.equal(pdc.kwh, 4);
  assert.equal(pdc.sole, 0.5);
  assert.equal(pdc.eur, 0.4);
  assert.equal(forno.kwh, 1);
  assert.equal(forno.sole, 1);
  assert.equal(forno.eur, 0, "col sole non costa");

  /* Senza nessun prezzo, gli euro non si inventano. */
  assert.deepEqual(
    carichiDellaGiornata({ "sensor.x": { wh: 500, sole: 0, eur: 0, conPrezzo: false } }),
    [{ id: "sensor.x", kwh: 0.5, eur: null, sole: 0 }],
  );
  assert.deepEqual(carichiDellaGiornata(null), []);
});

test("senza `carichi` contano gli elettrodomestici, e i piu' grossi restano nei giorni passati", () => {
  const cartella = mkdtempSync(join(tmpdir(), "carichi-"));
  try {
    const orologio = { ora: new Date(2026, 9, 14, 20, 0).getTime() };
    const taccuino = new TaccuinoDellEnergia({ cartella, adesso: () => orologio.ora });
    const letture = { casa: 7000, apparecchi: {} };
    for (let i = 1; i <= 7; i += 1) letture.apparecchi[`sensor.carico_${i}`] = i * 100;
    taccuino.campiona(letture);
    for (let i = 0; i < 120; i += 1) {
      orologio.ora += 30 * 1000;
      taccuino.campiona(letture);
    }
    /* Il giorno dopo: quello di ieri si chiude. */
    orologio.ora = new Date(2026, 9, 15, 9, 0).getTime();
    taccuino.campiona({ casa: 100 });
    taccuino.scrivi();
    const riletto = new TaccuinoDellEnergia({ cartella, adesso: () => orologio.ora });
    const ieri = riletto.giorniPassati().at(-1);
    assert.equal(ieri.d, "2026-10-14");
    assert.equal(ieri.top.length, 5);
    assert.deepEqual(ieri.top[0], ["sensor.carico_7", 0.7, null, 0]);
    assert.equal(ieri.top.at(-1)[0], "sensor.carico_3");
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("i carichi della plancia: elettrodomestici e carichi, col nome, senza doppioni", () => {
  const stato = {
    sections: {
      appliances: [
        { name: "Lavatrice", power_entity: "sensor.lavatrice_w" },
        { name: "Senza potenza" },
      ],
      loads: [
        { name: "Pompa di calore", power_entity: "sensor.pdc_w" },
        { name: "Doppione", power_entity: "sensor.lavatrice_w" },
        { name: "Strana", power_entity: "non un'entita'" },
      ],
    },
  };
  const attesi = [
    { id: "sensor.lavatrice_w", nome: "Lavatrice" },
    { id: "sensor.pdc_w", nome: "Pompa di calore" },
  ];
  assert.deepEqual(carichiDellaPlancia({ dm_dashboard_state: stato }), attesi);
  assert.deepEqual(carichiDellaPlancia({ dm_dashboard_state: JSON.stringify(stato) }), attesi);
  assert.deepEqual(carichiDellaPlancia({ dm_dashboard_state: "{rotto" }), []);
  assert.deepEqual(carichiDellaPlancia(), []);
});

test("la sentinella conta i carichi della plancia e li racconta col loro nome", () => {
  const orologio = { ora: mezzogiorno() };
  const sentinella = new Sentinella({ adesso: () => orologio.ora, quando: () => {} });
  sentinella.taccuino = new TaccuinoDellEnergia({ adesso: () => orologio.ora });
  sentinella.valori = () => ({
    cd_entity_overrides: JSON.stringify({
      "dm.energy_potenza_fotovoltaico": "sensor.pv",
      "dm.energy_potenza_scambio_rete": "sensor.rete",
    }),
    cd_costo_kwh: 0.2,
    dm_dashboard_state: {
      sections: { loads: [{ name: "Pompa di calore", power_entity: "sensor.pdc_w" }] },
    },
  });
  sentinella.carica([
    stato("sensor.pv", "1000", W),
    stato("sensor.rete", "1000", W),
    stato("sensor.pdc_w", "1500", W),
  ]);
  sentinella.battito();
  for (let i = 0; i < 120; i += 1) {
    orologio.ora += 30 * 1000;
    sentinella.battito();
  }
  const dati = sentinella._laGiornataDaRaccontare();
  assert.equal(dati.piu[0].nome, "Pompa di calore");
  assert.equal(dati.piu[0].kwh, 1.5);
  assert.ok(dati.piu[0].sole > 0 && dati.piu[0].sole < 1, "un po' dal sole, un po' dalla rete");
  assert.deepEqual(dati.piuAcceso, { nome: "Pompa di calore", kwh: 1.5 });
});

/* ─── Il riepilogo dice chi ha consumato di piu' ─────────────────────── */

const giornata = (extra = {}) => ({
  d: "2026-10-17",
  sole: null,
  casa: 11.6,
  presi: 11.6,
  ceduti: 0,
  usato: 0,
  quotaInCasa: null,
  euroRete: 1.84,
  risparmio: 0,
  picco: 3.2,
  piccoIl: "19:40",
  p: Array(24).fill(0),
  c: Array(24).fill(8),
  perFascia: {},
  cicli: [],
  ...extra,
});

test("il riepilogo: «chi ha consumato di piu'» nella semplice, il piu' grosso nell'elaborata", () => {
  const dati = {
    giornata: giornata(),
    conSole: false,
    ieri: null,
    piu: [
      { nome: "Pompa di calore", kwh: 4.2, eur: 0.84, sole: 0 },
      { nome: "Forno", kwh: 1.9, eur: 0.38, sole: 0 },
      { nome: "Lavatrice", kwh: 0.9, eur: null, sole: 0 },
      { nome: "Quarto", kwh: 0.5, eur: 0.1, sole: 0 },
    ],
    piuAcceso: { nome: "Pompa di calore", kwh: 4.2 },
    batteria: null,
    domani: { met: [], soleFino: null, pioggia: false },
    fasce: { nomi: {}, piuBassa: null },
    daSistemare: { batterie: 0, spenti: 0, aggiornamenti: 0 },
  };
  const semplice = paroleDelRiepilogo(dati, "it");
  assert.match(semplice.testo, /💡 Chi ha consumato di più: Pompa di calore 4,2 kWh/);
  assert.match(semplice.testo, /Forno 1,9/);
  assert.doesNotMatch(semplice.testo, /Il più acceso/, "una volta sola");
  const elaborata = paroleDelRiepilogo(dati, "it", { stile: "elaborata" });
  assert.match(elaborata.testo, /^⚡ Ha consumato di più: Pompa di calore, 4,2 kWh/);
  assert.equal(elaborata.scheda.piu.length, 3, "nella scheda i primi tre");
  assert.deepEqual(elaborata.scheda.piu[0], ["Pompa di calore", 4.2, 0.84]);
  /* Senza carichi contati torna il «piu' acceso» di prima. */
  const prima = paroleDelRiepilogo({ ...dati, piu: [] }, "it");
  assert.match(prima.testo, /💡 Il più acceso: Pompa di calore, 4,2 kWh/);
});

/* ─── La pagina «La tua giornata» ────────────────────────────────────── */

test("`ponte/energia/giornata`: solo chi ha un utente, e solo numeri", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "la-giornata-"));
  try {
    const orologio = { ora: mezzogiorno() };
    const dispositivi = new Dispositivi({ cartella, adesso: () => orologio.ora });
    const conUtente = dispositivi.abbina({ nome: "Telefono A", utente: "a".repeat(32) });
    const notifiche = new Notifiche({
      cartella,
      dispositivi,
      casa: { chiedi: async () => [], ascolta: async () => () => {} },
      adesso: () => orologio.ora,
    });
    try {
      const senza = await notifiche.rispondi(
        { id: 1, type: LA_GIORNATA },
        { dispositivo: { id: "b".repeat(32) } },
      );
      assert.equal(senza.success, false);
      assert.equal(senza.error.code, "unauthorized");
      assert.equal(
        (await notifiche.rispondi({ id: 2, type: LA_GIORNATA }, {})).error.code,
        "unauthorized",
      );

      notifiche.sentinella._laGiornataDaRaccontare = () => ({
        giornata: giornata(),
        conSole: false,
        piu: [{ nome: "Forno", kwh: 1.9, eur: 0.38, sole: 0 }],
        ieri: 12.7,
        batteria: null,
        fasce: { nomi: {}, piuBassa: null },
      });
      const detto = await notifiche.rispondi(
        { id: 3, type: LA_GIORNATA },
        { dispositivo: conUtente.dispositivo },
      );
      assert.equal(detto.success, true);
      const r = detto.result;
      assert.equal(r.giornata.casa, 11.6);
      assert.equal(r.giornata.p.length, 24);
      assert.equal("cicli" in r.giornata, false, "solo i numeri della giornata");
      assert.deepEqual(r.piu, [{ nome: "Forno", kwh: 1.9, eur: 0.38, sole: 0 }]);
      assert.equal(r.ieri, 12.7);
      assert.ok(Array.isArray(r.settimana));
      assert.doesNotMatch(JSON.stringify(r), /sensor\./, "nessuna entita'");

      notifiche.sentinella._laGiornataDaRaccontare = () => ({});
      const vuota = await notifiche.rispondi(
        { id: 4, type: LA_GIORNATA },
        { dispositivo: conUtente.dispositivo },
      );
      assert.deepEqual(vuota.result, { giornata: null });
    } finally {
      notifiche.ferma();
    }
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});

/* ─── Le categorie di Home Assistant ─────────────────────────────────── */

function unaCasaConCategorie({ categorie, entita }) {
  const chiamate = [];
  const mappa = new Map([
    [
      "binary_sensor.porta",
      { state: "off", attributes: { device_class: "door", friendly_name: "Porta ingresso" } },
    ],
    [
      "automation.luce",
      { state: "on", attributes: { id: "luce", friendly_name: "Luce ingresso" } },
    ],
    ["automation.boiler", { state: "on", attributes: { id: "boiler", friendly_name: "Boiler" } }],
    ["automation.altra", { state: "off", attributes: { id: "altra", friendly_name: "Altra" } }],
  ]);
  const configurazioni = {
    luce: {
      alias: "Luce ingresso",
      triggers: [{ trigger: "state", entity_id: "binary_sensor.porta", to: "on" }],
      conditions: [{ condition: "sun", after: "sunset" }],
      actions: [{ action: "light.turn_on" }, { delay: "00:05:00" }, { action: "light.turn_off" }],
    },
    boiler: { alias: "Boiler", use_blueprint: { path: "casa/scalda_acqua.yaml" } },
    altra: { alias: "Altra", triggers: [{ trigger: "time", at: "7:15:00" }], actions: [{}] },
  };
  const casa = {
    api: async (metodo, percorso) => {
      const id = decodeURIComponent(percorso.split("/").pop());
      return structuredClone(configurazioni[id]);
    },
    chiedi: async (m) => {
      chiamate.push(m);
      if (m.type === "config/category_registry/list") return categorie;
      if (m.type === "config/area_registry/list") return [];
      return null;
    },
    ascolta: async () => async () => {},
  };
  const ponte = new Automazioni({
    casa,
    stati: () => mappa,
    configurazione: { leggi: () => ({ snapshot: { values: {} } }) },
    registri: { chiedi: async () => ({ dispositivi: [], entita }) },
    notifiche: { consegna: async () => {} },
    licenze: { attive: true, premium: true },
    ogni: () => null,
  });
  return { ponte, chiamate };
}

test("le categorie sono quelle salvate in Home Assistant, in ordine di nome", async () => {
  const { ponte, chiamate } = unaCasaConCategorie({
    categorie: [
      { category_id: "c2", name: "Riscaldamento", icon: "mdi:fire" },
      { category_id: "c1", name: "Luci" },
    ],
    entita: [
      { entity_id: "automation.luce", categories: { automation: "c1" } },
      { entity_id: "automation.boiler", categories: { automation: "c2" } },
      /* Una categoria che in Home Assistant non c'e' piu': nessuna. */
      { entity_id: "automation.altra", categories: { automation: "sparita" } },
    ],
  });
  const s = await ponte.stato();
  assert.deepEqual(s.categorie, [
    { id: "c1", nome: "Luci", icona: "" },
    { id: "c2", nome: "Riscaldamento", icona: "mdi:fire" },
  ]);
  const di = (id) => s.automazioni.find((a) => a.id === id);
  assert.equal(di("luce").categoriaHa, "c1");
  assert.equal(di("boiler").categoriaHa, "c2");
  assert.equal(di("altra").categoriaHa, null);
  const chiesta = chiamate.find((m) => m.type === "config/category_registry/list");
  assert.equal(chiesta.scope, "automation");
  /* Si rileggono come le stanze, non a ogni apertura. */
  const prima = chiamate.length;
  await ponte.stato();
  assert.equal(
    chiamate.slice(prima).filter((m) => m.type === "config/category_registry/list").length,
    0,
  );
});

test("senza categorie in Home Assistant (o se non si leggono) nessuna categoria", async () => {
  const { ponte } = unaCasaConCategorie({
    categorie: null,
    entita: [{ entity_id: "automation.luce", categories: { automation: "c1" } }],
  });
  const s = await ponte.stato();
  assert.deepEqual(s.categorie, []);
  assert.ok(s.automazioni.every((a) => a.categoriaHa === null));
});

test("ogni automazione porta il suo riassunto, letto dalla configurazione", async () => {
  const { ponte } = unaCasaConCategorie({ categorie: [], entita: [] });
  const elenco = await ponte.elencoDiCasa();
  const di = (id) => elenco.find((a) => a.id === id).riassunto;
  assert.equal(di("luce").it, "Quando si apre Porta ingresso · 1 condizione · 3 azioni");
  assert.equal(di("luce").en, "When Porta ingresso opens · 1 condition · 3 actions");
  assert.equal(di("boiler").it, "Da blueprint «Scalda acqua»");
  assert.equal(di("altra").it, "Alle 07:15 · 1 azione");
});

/* ─── Il riassunto in una riga ───────────────────────────────────────── */

test("il riassunto racconta il primo innesco, gli altri, condizioni e azioni", () => {
  const nomi = {
    "binary_sensor.pir": "Corridoio",
    "person.persona_1": "Persona 1",
    "sensor.temperatura": "Temperatura sala",
    "zone.lavoro": "Lavoro",
  };
  const classi = { "binary_sensor.pir": "motion" };
  const r = (config) =>
    riassuntoDellAutomazione(config, {
      nomeDi: (id) => nomi[id] || "",
      classeDi: (id) => classi[id] || "",
    })?.it;
  assert.equal(
    r({
      triggers: [
        { trigger: "state", entity_id: "binary_sensor.pir", to: "on" },
        { trigger: "time", at: "22:00" },
        { trigger: "homeassistant", event: "start" },
      ],
      actions: [{}],
    }),
    "Quando c'è movimento in Corridoio (e 2 altri) · 1 azione",
  );
  /* Le vecchie chiavi al singolare, e un oggetto al posto di un elenco. */
  assert.equal(
    r({ trigger: { platform: "state", entity_id: "person.persona_1", to: "home" }, action: {} }),
    "Quando Persona 1 arriva a casa · 1 azione",
  );
  assert.equal(
    r({ triggers: [{ trigger: "numeric_state", entity_id: "sensor.temperatura", below: 18 }] }),
    "Quando Temperatura sala scende sotto 18",
  );
  assert.equal(
    r({ triggers: [{ trigger: "sun", event: "sunset", offset: "-00:15:00" }] }),
    "15 min prima del tramonto",
  );
  assert.equal(r({ triggers: [{ trigger: "sun", event: "sunrise" }] }), "All'alba");
  assert.equal(r({ triggers: [{ trigger: "time_pattern", minutes: "/10" }] }), "Ogni 10 minuti");
  assert.equal(
    r({
      triggers: [
        { trigger: "zone", entity_id: "person.persona_1", zone: "zone.lavoro", event: "leave" },
      ],
    }),
    "Quando Persona 1 esce da Lavoro",
  );
  assert.equal(
    r({ triggers: [{ trigger: "template", value_template: "{{ true }}" }], conditions: [{}, {}] }),
    "Quando una condizione diventa vera · 2 condizioni",
  );
  assert.equal(r({ actions: [{}, {}] }), "Si avvia a mano · 2 azioni");
  assert.equal(r({ triggers: [{ trigger: "qualcosa_di_nuovo" }] }), "Quando succede qualcosa");
  /* Senza nomi si usa l'entita'; senza configurazione niente riassunto. */
  assert.equal(
    riassuntoDellAutomazione({
      triggers: [{ trigger: "state", entity_id: "light.sala", to: "off" }],
    }).it,
    "Quando si spegne light.sala",
  );
  assert.equal(riassuntoDellAutomazione(null), null);
  assert.equal(riassuntoDellAutomazione({ use_blueprint: {} }).it, "Da un blueprint");
});
