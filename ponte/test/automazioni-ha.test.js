/* Le automazioni scritte in Home Assistant (`plancia/src/core/automazioni-ha.js`
 * e `src/automazioni.js`).
 *
 * Quello che deve restare vero: ogni automazione della plancia diventa una
 * configurazione di Home Assistant che, riletta, torna la stessa; una scritta
 * a mano col vecchio stile si legge lo stesso; una che non ci sta tutta —
 * un template, un'area, un blueprint — e' «complessa» e non si tocca con
 * l'editor; il gruppo «Per tipo» si deduce da cosa guarda e cosa fa. E nel
 * ponte: l'elenco lo legge solo chi ha un utente, la configurazione intera
 * solo chi amministra, scrivere vuole chi amministra Home Assistant e
 * Premium, `salva` scrive solo quello che sceglie il traduttore, e gli avvisi
 * di Home Assistant arrivano ai telefoni senza diventare una pioggia.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  CATEGORIE,
  DESCRIZIONE_GDAHOME,
  EVENTO_AVVISA,
  categoriaDi,
  dallaHomeAssistant,
  inHomeAssistant,
  normalizzata,
  origineDi,
  secondiDi,
} from "../plancia/src/core/automazioni-ha.js";
import { Automazioni } from "../src/automazioni.js";
import { Commissioni } from "../src/commissioni.js";

const STATI = {
  "person.persona_2": { state: "home", attributes: {} },
  "person.persona_7": { state: "not_home", attributes: {} },
  "binary_sensor.pir": { state: "off", attributes: { device_class: "motion" } },
  "binary_sensor.finestra": { state: "off", attributes: { device_class: "window" } },
  "sensor.lavatrice": {
    state: "2",
    attributes: { device_class: "power", unit_of_measurement: "W" },
  },
};
const statoDi = (id) => STATI[id] ?? null;
const FERIALI = [true, true, true, true, true, false, false];

const ritorno = (a) => {
  const config = JSON.parse(JSON.stringify(inHomeAssistant(a, { stati: STATI })));
  return { config, letta: dallaHomeAssistant(config, { statoDi, stati: STATI }) };
};

/* ── il traduttore ───────────────────────────────────────────────────────── */

test("ogni QUANDO, SOLO SE e ALLORA della plancia va in Home Assistant e torna uguale", () => {
  const casi = [
    {
      id: "a1",
      quando: { tipo: "orario", ore: ["07:15"], giorni: FERIALI },
      allora: [{ tipo: "tapparella", entita: ["cover.sala"], modo: "apri" }],
    },
    {
      id: "a2",
      quando: { tipo: "orario", sole: "tramonto", scarto: -15 },
      soloSe: [{ tipo: "casa", chi: "qualcuno" }],
      allora: [{ tipo: "accendi", entita: ["light.giardino", "switch.fontana"], livello: 40 }],
    },
    {
      id: "a3",
      quando: { tipo: "movimento", entita: ["binary_sensor.pir"], verso: "si" },
      soloSe: [
        { tipo: "notte", da: "", a: "" },
        { tipo: "fascia", da: "23:00", a: "06:00" },
      ],
      tutte: false,
      allora: [
        { tipo: "accendi", entita: ["light.corridoio"], livello: 20 },
        { tipo: "aspetta", minuti: 2 },
        { tipo: "spegni", entita: ["light.corridoio"] },
      ],
      modo: "ignora",
      pausa: 5,
      scadenza: { data: "2026-11-03", stato: "spenta" },
    },
    {
      id: "a4",
      quando: { tipo: "apertura", entita: ["binary_sensor.finestra", "cover.box"], verso: "apre" },
      allora: [
        { tipo: "clima", entita: ["climate.sala"], modo: "spegni" },
        { tipo: "aspettaChe", entita: "binary_sensor.finestra", stato: "off", massimo: 720 },
        { tipo: "clima", entita: ["climate.sala"], modo: "temperatura", gradi: 21.5 },
      ],
    },
    {
      id: "a5",
      quando: { tipo: "elettrodomestico", entita: "sensor.lavatrice", soglia: 5, minuti: 3 },
      allora: [{ tipo: "notifica", testo: "La lavatrice ha finito" }],
    },
    {
      id: "a6",
      quando: { tipo: "persone", verso: "arriva", chi: [] },
      soloSe: [{ tipo: "uguale", entita: "input_select.modo", valore: "ferie, via", non: true }],
      allora: [{ tipo: "media", entita: ["media_player.sala"], comando: "volume", valore: "35" }],
    },
    {
      id: "a7",
      quando: { tipo: "evento", evento: "zha_event", filtro: { command: "on" } },
      allora: [{ tipo: "servizio", servizio: "notify.notify", entita: [], dati: { message: "x" } }],
      modo: "coda",
    },
    {
      id: "a8",
      quando: { tipo: "ogni", minuti: 30 },
      allora: [
        { tipo: "aspettaChe", entita: "sensor.umidita", stato: "<60", massimo: 120 },
        { tipo: "spegni", entita: ["fan.bagno"] },
      ],
    },
    {
      id: "c1",
      nome: "Cronotermostato",
      tipo: "crono",
      crono: { termostati: ["climate.sala"], finestre: ["binary_sensor.finestra"] },
    },
  ];
  for (const a of casi) {
    const { config, letta } = ritorno(a);
    assert.ok(letta, `${a.id} deve tornare: ${JSON.stringify(config)}`);
    assert.equal(letta.id, a.id);
    assert.equal(config.description, DESCRIZIONE_GDAHOME);
  }
  /* Le persone «chiunque» si scrivono per nome. */
  assert.deepEqual(ritorno(casi[5]).config.triggers[0].entity_id, [
    "person.persona_2",
    "person.persona_7",
  ]);
});

test("la configurazione scritta: servizi scelti qui, gli avvisi con l'evento, i giorni e la pausa", () => {
  const { config } = ritorno({
    id: "x",
    nome: "Luce",
    quando: { tipo: "orario", ore: ["07:15"], giorni: FERIALI },
    allora: [
      { tipo: "accendi", entita: ["light.sala"], livello: 30 },
      { tipo: "notifica", testo: "Buongiorno" },
    ],
    pausa: 10,
  });
  assert.equal(config.alias, "Luce");
  assert.equal(config.mode, "restart");
  assert.deepEqual(config.triggers, [{ trigger: "time", at: ["07:15:00"] }]);
  assert.deepEqual(config.conditions[0], {
    condition: "time",
    weekday: ["mon", "tue", "wed", "thu", "fri"],
  });
  assert.match(config.conditions[1].value_template, /total_seconds\(\) > 600/);
  assert.deepEqual(config.actions[0], {
    action: "light.turn_on",
    target: { entity_id: "light.sala" },
    data: { brightness_pct: 30 },
  });
  assert.equal(config.actions[1].event, EVENTO_AVVISA);
  assert.equal(config.actions[1].event_data.testo, "Buongiorno");
  /* Un servizio che apre la casa non si scrive: l'azione non c'e', e senza
   * azioni non c'e' l'automazione. */
  assert.equal(
    inHomeAssistant({
      id: "y",
      quando: { tipo: "orario", ore: ["03:00"] },
      allora: [{ tipo: "servizio", servizio: "lock.unlock", entita: ["lock.porta"] }],
    }),
    null,
  );
});

test("una scritta a mano col vecchio stile si legge; una complessa no", () => {
  const vecchia = {
    id: "1690000000000",
    alias: "Luci di notte",
    trigger: [{ platform: "state", entity_id: "binary_sensor.pir", from: "off", to: "on" }],
    condition: [{ condition: "state", entity_id: "sun.sun", state: "below_horizon" }],
    action: [
      { service: "light.turn_on", entity_id: "light.corridoio", data: { brightness_pct: 20 } },
    ],
    mode: "single",
  };
  const letta = dallaHomeAssistant(vecchia, { statoDi });
  assert.equal(letta.nome, "Luci di notte");
  assert.equal(letta.quando.tipo, "movimento");
  assert.deepEqual(letta.soloSe, [{ tipo: "notte", da: "", a: "" }]);
  assert.equal(letta.modo, "ignora");

  const complesse = [
    { ...vecchia, trigger: [{ platform: "template", value_template: "{{ true }}" }] },
    { ...vecchia, action: [{ service: "light.turn_on", target: { area_id: "sala" } }] },
    { ...vecchia, action: [{ choose: [], default: [] }] },
    { ...vecchia, use_blueprint: { path: "x.yaml", input: {} } },
    {
      ...vecchia,
      action: [
        {
          service: "light.turn_on",
          entity_id: "light.c",
          data: { transition: 2, brightness_pct: 4 },
        },
      ],
    },
  ];
  for (const c of complesse.slice(0, 4)) assert.equal(dallaHomeAssistant(c, { statoDi }), null);
  /* Un dato in piu' non si perde: diventa «chiama un servizio». */
  assert.equal(dallaHomeAssistant(complesse[4], { statoDi }).allora[0].tipo, "servizio");
  assert.equal(origineDi(complesse[3]), "blueprint");
  assert.equal(origineDi({ description: DESCRIZIONE_GDAHOME }), "gdahome");
});

test("le durate e le forme diverse della stessa cosa si confrontano uguali", () => {
  assert.equal(secondiDi({ minutes: 2 }), 120);
  assert.equal(secondiDi("00:02:00"), 120);
  assert.equal(secondiDi("{{ x }}"), "{{ x }}");
  const a = normalizzata({ triggers: [{ trigger: "time", at: "7:15" }] });
  const b = normalizzata({ trigger: { platform: "time", at: ["07:15:00"] } });
  assert.deepEqual(a.triggers, b.triggers);
});

test("il gruppo «Per tipo»: sicurezza prima, poi cosa fa, gli avvisi, l'energia", () => {
  const cat = (a) => categoriaDi(inHomeAssistant(a, { stati: STATI }), statoDi);
  assert.equal(
    cat({
      id: "s",
      quando: { tipo: "antifurto", entita: "alarm_control_panel.casa", verso: "suona" },
      allora: [{ tipo: "accendi", entita: ["light.tutte"] }],
    }),
    "sicurezza",
  );
  assert.equal(
    cat({
      id: "l",
      quando: { tipo: "elettrodomestico", entita: "sensor.lavatrice", soglia: 5, minuti: 3 },
      allora: [{ tipo: "notifica", testo: "Fatto" }],
    }),
    "avvisi",
  );
  assert.equal(
    cat({
      id: "e",
      quando: { tipo: "valore", entita: "sensor.lavatrice", verso: "sopra", soglia: 2000 },
      allora: [{ tipo: "accendi", entita: ["switch.lavastoviglie"] }],
    }),
    "energia",
  );
  assert.equal(
    cat({
      id: "t",
      quando: { tipo: "orario", ore: ["07:00"] },
      allora: [{ tipo: "tapparella", entita: ["cover.sala"], modo: "chiudi" }],
    }),
    "tapparelle",
  );
  assert.equal(
    cat({
      id: "a",
      quando: { tipo: "ogni", minuti: 60 },
      allora: [{ tipo: "accendi", entita: ["switch.router"] }],
    }),
    "altre",
  );
});

test("il gruppo «Per tipo»: l'antifurto nel target e' sicurezza, l'irrigazione ha il suo", () => {
  const cat = (config, stati = {}) => categoriaDi(config, (id) => stati[id] || null);
  /* L'antifurto nominato solo dentro `target`, o solo dal servizio. */
  assert.equal(
    cat({
      triggers: [{ trigger: "time", at: "23:30:00" }],
      actions: [
        {
          action: "alarm_control_panel.alarm_arm_night",
          target: { entity_id: "alarm_control_panel.casa" },
        },
      ],
    }),
    "sicurezza",
  );
  assert.equal(
    cat({
      triggers: [{ trigger: "state", entity_id: "person.persona_1", to: "home" }],
      actions: [
        { action: "alarm_control_panel.alarm_disarm" },
        { action: "notify.notify", data: { message: "Spento" } },
      ],
    }),
    "sicurezza",
  );
  /* Le luci nel target restano luci. */
  assert.equal(
    cat({
      triggers: [{ trigger: "sun", event: "sunset" }],
      actions: [{ action: "light.turn_on", target: { entity_id: "light.giardino" } }],
    }),
    "luci",
  );
  /* Irrigazione: una valvola, un interruttore che si chiama cosi', o il nome. */
  assert.equal(
    cat({
      triggers: [{ trigger: "time", at: "06:00:00" }],
      actions: [{ action: "valve.open_valve", target: { entity_id: "valve.prato" } }],
    }),
    "irrigazione",
  );
  assert.equal(
    cat(
      {
        triggers: [{ trigger: "time", at: "06:00:00" }],
        actions: [{ action: "switch.turn_on", target: { entity_id: "switch.zona_3" } }],
      },
      { "switch.zona_3": { attributes: { friendly_name: "Irrigazione orto" } } },
    ),
    "irrigazione",
  );
  assert.equal(
    cat({
      alias: "Salta l'irrigazione se piove",
      triggers: [{ trigger: "numeric_state", entity_id: "sensor.pioggia", above: 5 }],
      actions: [{ action: "automation.turn_off", target: { entity_id: "automation.prato" } }],
    }),
    "irrigazione",
  );
  assert.ok(CATEGORIE.includes("irrigazione"));
});

/* ── nel ponte ───────────────────────────────────────────────────────────── */

function unaCasa({ premium = true, configurazioni = {} } = {}) {
  const salvate = { ...configurazioni };
  const chiamate = [];
  const avvisi = [];
  let ascolto = null;
  const mappa = new Map(Object.entries(STATI));
  for (const [id, config] of Object.entries(salvate))
    mappa.set(`automation.${id}`, {
      state: "on",
      attributes: {
        id,
        friendly_name: config.alias,
        last_triggered: "2026-10-17T06:00:00Z",
      },
    });
  mappa.set("automation.senza_id", { state: "off", attributes: { friendly_name: "YAML" } });
  const casa = {
    api: async (metodo, percorso, corpo) => {
      chiamate.push({ metodo, percorso, corpo });
      const id = decodeURIComponent(percorso.split("/").pop());
      if (metodo === "GET") {
        if (!salvate[id]) {
          const e = new Error("non c'e'");
          e.status = 404;
          throw e;
        }
        return structuredClone(salvate[id]);
      }
      if (metodo === "POST") {
        salvate[id] = corpo;
        return { result: "ok" };
      }
      delete salvate[id];
      return { result: "ok" };
    },
    chiedi: async (m) => {
      chiamate.push({ ws: m.type, m });
      if (m.type === "config/area_registry/list") return [{ area_id: "sala", name: "Sala" }];
      return null;
    },
    ascolta: async (tipo, cb, { onCaduto } = {}) => {
      ascolto = { tipo, cb, onCaduto };
      return async () => {
        ascolto = null;
      };
    },
  };
  const ponte = new Automazioni({
    casa,
    stati: () => mappa,
    configurazione: { leggi: () => ({ snapshot: { values: {} } }) },
    registri: {
      chiedi: async () => ({
        dispositivi: [],
        entita: [{ entity_id: "automation.a1", area_id: "sala" }],
      }),
    },
    notifiche: { consegna: async (e) => avvisi.push(e) },
    licenze: { attive: true, premium },
    ogni: () => null,
  });
  return {
    ponte,
    salvate,
    chiamate,
    avvisi,
    mappa,
    get ascolto() {
      return ascolto;
    },
  };
}

const semplice = inHomeAssistant(
  {
    id: "a1",
    nome: "Tapparelle",
    quando: { tipo: "orario", ore: ["07:15"] },
    allora: [{ tipo: "tapparella", entita: ["cover.sala"], modo: "apri" }],
  },
  { stati: STATI },
);
const complessa = {
  id: "b2",
  alias: "Scaldabagno",
  description: "mia",
  triggers: [{ trigger: "template", value_template: "{{ true }}" }],
  actions: [{ action: "water_heater.turn_on", target: { entity_id: "water_heater.boiler" } }],
};

test("l'elenco: tutte quelle di Home Assistant, la stanza, l'ultima volta e la forma se ci sta", async () => {
  const c = unaCasa({ configurazioni: { a1: semplice, b2: complessa } });
  const elenco = await c.ponte.elencoDiCasa();
  assert.equal(elenco.length, 3);
  const a1 = elenco.find((v) => v.id === "a1");
  assert.equal(a1.area, "Sala");
  assert.equal(a1.categoria, "tapparelle");
  assert.equal(a1.origine, "gdahome");
  assert.equal(a1.modello.quando.tipo, "orario");
  assert.equal(a1.ultima, Date.parse("2026-10-17T06:00:00Z"));
  assert.equal(a1.config, null, "senza chiederla, la configurazione non viaggia");
  const b2 = elenco.find((v) => v.id === "b2");
  assert.equal(b2.modello, null);
  assert.equal(b2.modificabile, true);
  assert.equal(b2.categoria, "energia");
  const yaml = elenco.find((v) => v.entity_id === "automation.senza_id");
  assert.equal(yaml.modificabile, false);
  /* Mezzo minuto: una seconda lettura non richiede le configurazioni. */
  const prima = c.chiamate.filter((x) => x.metodo === "GET").length;
  await c.ponte.elencoDiCasa();
  assert.equal(c.chiamate.filter((x) => x.metodo === "GET").length, prima);
});

test("chi legge, chi scrive: un utente per leggere, chi amministra e Premium per scrivere", async () => {
  const c = unaCasa({ configurazioni: { a1: semplice } });
  const commissioni = new Commissioni({});
  commissioni.automazioni = c.ponte;
  const nuova = {
    nome: "Luce",
    quando: { tipo: "orario", ore: ["20:00"] },
    allora: [{ tipo: "accendi", entita: ["light.sala"] }],
  };

  const senza = await commissioni.rispondi({ id: 1, type: "ponte/automazioni/stato" });
  assert.equal(senza.error.code, "unauthorized");

  const letto = await commissioni.rispondi(
    { id: 2, type: "ponte/automazioni/stato" },
    { chiChiede: "u1" },
  );
  assert.equal(letto.success, true);
  assert.equal(letto.result.puoScrivere, false);
  assert.ok(letto.result.automazioni.every((v) => v.config === null));

  const negato = await commissioni.rispondi(
    { id: 3, type: "ponte/automazioni/salva", automazione: nuova },
    { chiChiede: "u1" },
  );
  assert.equal(negato.error.code, "unauthorized");
  assert.equal(c.chiamate.filter((x) => x.metodo === "POST").length, 0);

  const daAdmin = await commissioni.rispondi(
    { id: 4, type: "ponte/automazioni/stato" },
    { chiChiede: "u1", puoAmministrare: true },
  );
  assert.equal(daAdmin.result.puoScrivere, true);
  assert.ok(daAdmin.result.automazioni.find((v) => v.id === "a1").config);

  const salvata = await commissioni.rispondi(
    { id: 5, type: "ponte/automazioni/salva", automazione: nuova },
    { chiChiede: "u1", puoAmministrare: true },
  );
  assert.equal(salvata.success, true);
  const scritta = c.salvate[salvata.result.id];
  assert.equal(scritta.alias, "Luce");
  assert.equal(scritta.description, DESCRIZIONE_GDAHOME);
  assert.deepEqual(scritta.actions, [
    { action: "light.turn_on", target: { entity_id: "light.sala" } },
  ]);

  /* Senza Premium non si scrive. */
  const povera = unaCasa();
  const altre = new Commissioni({});
  altre.automazioni = new Automazioni({
    ...povera.ponte,
    licenze: { attive: true, premium: false },
  });
  const chiusa = await altre.rispondi(
    { id: 6, type: "ponte/automazioni/salva", automazione: nuova },
    { chiChiede: "u1", puoAmministrare: true },
  );
  assert.equal(chiusa.error.code, "premium-richiesto");
});

test("salva tiene la descrizione di chi l'ha scritta, e non sovrascrive una complessa", async () => {
  const sua = { ...semplice, description: "la mia" };
  const c = unaCasa({ configurazioni: { a1: sua, b2: complessa } });
  const fatto = await c.ponte.salva({
    id: "a1",
    automazione: {
      nome: "Tapparelle presto",
      quando: { tipo: "orario", ore: ["06:45"] },
      allora: [{ tipo: "tapparella", entita: ["cover.sala"], modo: "apri" }],
    },
  });
  assert.equal(fatto.id, "a1");
  assert.equal(c.salvate.a1.description, "la mia");
  assert.deepEqual(c.salvate.a1.triggers, [{ trigger: "time", at: ["06:45:00"] }]);

  const no = await c.ponte.salva({
    id: "b2",
    automazione: {
      quando: { tipo: "orario", ore: ["06:45"] },
      allora: [{ tipo: "accendi", entita: ["light.sala"] }],
    },
  });
  assert.equal(no.errore, "complessa");
  assert.deepEqual(c.salvate.b2, complessa);
});

test("rinomina, stanza, duplica ed elimina", async () => {
  const c = unaCasa({ configurazioni: { b2: complessa } });
  await c.ponte.rinomina({ id: "b2", nome: "Boiler", area: "sala" });
  assert.equal(c.salvate.b2.alias, "Boiler");
  assert.deepEqual(c.salvate.b2.triggers, complessa.triggers, "il resto non si tocca");
  const area = c.chiamate.find((x) => x.ws === "config/entity_registry/update");
  assert.deepEqual(
    { entity_id: area.m.entity_id, area_id: area.m.area_id },
    { entity_id: "automation.b2", area_id: "sala" },
  );
  const copia = await c.ponte.duplica({ id: "b2" });
  assert.equal(c.salvate[copia.id].alias, "Boiler (copia)");
  assert.notEqual(copia.id, "b2");
  await c.ponte.elimina({ id: "b2" });
  assert.equal(c.salvate.b2, undefined);
  assert.equal((await c.ponte.elimina({ id: "../x" })).errore, "invalid_format");
});

test("gli avvisi di Home Assistant arrivano ai telefoni, con Premium e senza pioggia", async () => {
  const c = unaCasa();
  c.ponte.parti();
  await new Promise((r) => setImmediate(r));
  assert.equal(c.ascolto.tipo, EVENTO_AVVISA);
  c.ascolto.cb({ data: { titolo: "Lavatrice finita", testo: "La lavatrice ha finito" } });
  await new Promise((r) => setImmediate(r));
  assert.equal(c.avvisi.length, 1);
  assert.equal(c.avvisi[0].parole.it.titolo, "Lavatrice finita");
  assert.equal(c.avvisi[0].parole.it.testo, "La lavatrice ha finito");
  for (let i = 0; i < 40; i += 1) await c.ponte.avvisa({ testo: `n. ${i}` });
  assert.equal(c.avvisi.length, 30, "al piu' trenta ogni dieci minuti");
  assert.equal(await c.ponte.avvisa({ testo: "" }), false);
  c.ponte.ferma();

  const povera = unaCasa({ premium: false });
  assert.equal(
    await new Automazioni({
      notifiche: { consegna: async (e) => povera.avvisi.push(e) },
      licenze: { attive: true, premium: false },
    }).avvisa({ testo: "x" }),
    false,
  );
});
