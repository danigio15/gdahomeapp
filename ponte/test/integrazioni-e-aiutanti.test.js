/* Le integrazioni, i dispositivi e gli aiutanti di Home Assistant, dall'app.
 *
 * «Pensa a come poter gestire anche le integrazioni», «devi dare la
 * possibilità di poter ricaricare anche le integrazioni», «implementiamo gli
 * aiutanti»: e «saranno solo per app e saranno solo premium». Qui una casa
 * finta che risponde come Home Assistant, e il ponte in mezzo. */
import { test } from "node:test";
import assert from "node:assert/strict";

import { Integrazioni, passoDelFlusso, statoDellaVoce } from "../src/integrazioni.js";
import { Aiutanti, campiPuliti } from "../src/aiutanti.js";

const VOCE_SHELLY = "01JAB3C4D5E6F7G8H9J0K1M2N3";
const VOCE_NETATMO = "0f1e2d3c4b5a69788796a5b4c3d2e1f0";

function unaCasa() {
  const chieste = [];
  const chiamate = [];
  const casa = {
    chieste,
    chiamate,
    async chiedi(c) {
      chieste.push(c);
      switch (c.type) {
        case "config_entries/get":
          if (c.type_filter?.includes("helper"))
            return [
              {
                entry_id: "aaaabbbbcccc",
                domain: "group",
                title: "Tutte le luci giorno",
                supports_options: true,
              },
            ];
          return [
            {
              entry_id: VOCE_SHELLY,
              domain: "shelly",
              title: "Shelly Plus 1PM",
              state: "loaded",
              supports_options: true,
            },
            {
              entry_id: VOCE_NETATMO,
              domain: "netatmo",
              title: "Casa",
              state: "setup_error",
              reason: "auth",
            },
            {
              entry_id: "ccccddddeeee",
              domain: "met",
              title: "Meteo",
              state: "not_loaded",
              disabled_by: "user",
            },
          ];
        case "config/device_registry/list":
          return [
            {
              id: "d1",
              name: "Caldaia",
              config_entries: [VOCE_SHELLY],
              primary_config_entry: VOCE_SHELLY,
              area_id: "tecnico",
              manufacturer: "Shelly",
              model: "Plus 1PM",
            },
            { id: "d2", name: "Termostato", config_entries: [VOCE_NETATMO], area_id: "soggiorno" },
          ];
        case "config/entity_registry/list":
          return [
            { entity_id: "switch.caldaia", device_id: "d1", config_entry_id: VOCE_SHELLY },
            { entity_id: "sensor.caldaia_potenza", device_id: "d1", config_entry_id: VOCE_SHELLY },
            { entity_id: "climate.soggiorno", device_id: "d2", config_entry_id: VOCE_NETATMO },
            {
              entity_id: "sensor.termostato_batteria",
              device_id: "d2",
              config_entry_id: VOCE_NETATMO,
              original_device_class: "battery",
              entity_category: "diagnostic",
            },
            { entity_id: "input_boolean.vacanza", platform: "input_boolean", unique_id: "vacanza" },
            { entity_id: "light.tutte_le_luci_giorno", config_entry_id: "aaaabbbbcccc" },
          ];
        case "config/area_registry/list":
          return [
            { area_id: "tecnico", name: "Locale tecnico" },
            { area_id: "soggiorno", name: "Soggiorno" },
          ];
        case "config_entries/flow/progress":
          return [
            {
              flow_id: "f0f0f0f0f0f0",
              handler: "shelly",
              context: { source: "zeroconf", title_placeholders: { name: "Shelly Plus 1PM" } },
            },
            {
              flow_id: "a1a1a1a1a1a1",
              handler: "netatmo",
              context: { source: "reauth", entry_id: VOCE_NETATMO },
            },
          ];
        case "integration/descriptions":
          return {
            core: {
              integration: {
                shelly: { name: "Shelly", config_flow: true, iot_class: "local_push" },
                tado: { name: "tado°", config_flow: true, iot_class: "cloud_polling" },
                netatmo: { name: "Netatmo", config_flow: true },
                sun: { name: "Sun", config_flow: false },
              },
              helper: {
                group: { name: "Group", config_flow: true },
                threshold: { name: "Threshold", config_flow: true },
              },
            },
            custom: {},
          };
        case "frontend/get_translations":
          if (c.category === "title") return { resources: { "component.group.title": "Gruppo" } };
          return {
            resources: {
              "component.shelly.config.step.user.title": "Dove si trova?",
              "component.shelly.config.step.user.data.host": "Indirizzo",
            },
          };
        case "input_boolean/list":
          return [{ id: "vacanza", name: "Modalità vacanza", icon: "mdi:beach" }];
        case "input_number/list":
          return [];
        case "input_boolean/create":
          return { id: "ospiti", name: c.name };
        case "input_boolean/update":
        case "input_boolean/delete":
          return { fatto: true };
        case "config_entries/disable":
          return { require_restart: false };
        default:
          if (/\/list$/.test(c.type)) return [];
          throw Object.assign(new Error("unknown"), { code: "unknown_command" });
      }
    },
    async api(metodo, percorso, corpo) {
      chiamate.push([metodo, percorso, corpo]);
      if (percorso === "config/config_entries/flow" && metodo === "POST")
        return {
          type: "form",
          flow_id: "b2b2b2b2b2b2",
          handler: corpo.handler,
          step_id: "user",
          data_schema: [{ name: "host", type: "string", required: true }],
          errors: {},
        };
      if (percorso === "config/config_entries/flow/b2b2b2b2b2b2" && metodo === "POST")
        return {
          type: "create_entry",
          flow_id: "b2b2b2b2b2b2",
          handler: "shelly",
          title: "Shelly Plus 1PM",
          result: { entry_id: "nuovanuova12" },
        };
      return { require_restart: false };
    },
  };
  return casa;
}

const CHI = { utente: "u1", amministra: true, dalTelefono: true };
const premium = { attive: true, premium: true };

test("lo stato di una voce in tre parole", () => {
  assert.equal(statoDellaVoce({ state: "loaded" }), "ok");
  assert.equal(statoDellaVoce({ state: "setup_error" }), "errore");
  assert.equal(statoDellaVoce({ state: "setup_retry" }), "in-avvio");
  assert.equal(statoDellaVoce({ state: "loaded", disabled_by: "user" }), "disattivata");
});

test("solo dall'app, solo chi amministra, solo Premium", async () => {
  const i = new Integrazioni({ casa: unaCasa(), licenze: premium });
  const elenco = { id: 1, type: "ponte/integrazioni/elenco" };
  assert.equal((await i.rispondi(elenco, { ...CHI, utente: "" })).error.code, "unauthorized");
  assert.equal(
    (await i.rispondi(elenco, { ...CHI, dalTelefono: false })).error.code,
    "unauthorized",
  );
  assert.equal(
    (await i.rispondi(elenco, { ...CHI, amministra: false })).error.code,
    "unauthorized",
  );
  const base = new Integrazioni({ casa: unaCasa(), licenze: { attive: true, premium: false } });
  assert.equal((await base.rispondi(elenco, CHI)).error.code, "premium-richiesto");
  const a = new Aiutanti({ casa: unaCasa(), licenze: premium });
  const suoi = { id: 2, type: "ponte/aiutanti/elenco" };
  assert.equal((await a.rispondi(suoi, { ...CHI, dalTelefono: false })).error.code, "unauthorized");
  assert.equal((await a.rispondi(suoi, { ...CHI, amministra: false })).error.code, "unauthorized");
});

test("l'elenco: nome, stato, quanti dispositivi ed entita', trovate in rete e riparazioni", async () => {
  const i = new Integrazioni({ casa: unaCasa(), licenze: premium });
  const r = (await i.rispondi({ id: 1, type: "ponte/integrazioni/elenco" }, CHI)).result;
  const shelly = r.voci.find((v) => v.dominio === "shelly");
  assert.deepEqual(
    { nome: shelly.integrazione, stato: shelly.stato, d: shelly.dispositivi, e: shelly.entita },
    { nome: "Shelly", stato: "ok", d: 1, e: 2 },
  );
  assert.equal(r.voci.find((v) => v.dominio === "netatmo").stato, "errore");
  assert.equal(r.voci.find((v) => v.dominio === "met").stato, "disattivata");
  assert.deepEqual(
    r.trovate.map((t) => t.titolo),
    ["Shelly Plus 1PM"],
  );
  assert.equal(r.riparazioni[0].voce, VOCE_NETATMO);
});

test("ricarica, disattiva ed elimina: le porte di Home Assistant, elimina con la conferma", async () => {
  const casa = unaCasa();
  const i = new Integrazioni({ casa, licenze: premium });
  assert.equal(
    (await i.rispondi({ id: 1, type: "ponte/integrazioni/ricarica", voce: VOCE_SHELLY }, CHI))
      .success,
    true,
  );
  assert.deepEqual(casa.chiamate.at(-1).slice(0, 2), [
    "POST",
    `config/config_entries/entry/${VOCE_SHELLY}/reload`,
  ]);
  await i.rispondi({ id: 2, type: "ponte/integrazioni/disattiva", voce: VOCE_SHELLY }, CHI);
  assert.deepEqual(casa.chieste.at(-1), {
    type: "config_entries/disable",
    entry_id: VOCE_SHELLY,
    disabled_by: "user",
  });
  const senza = await i.rispondi(
    { id: 3, type: "ponte/integrazioni/elimina", voce: VOCE_SHELLY },
    CHI,
  );
  assert.equal(senza.success, false);
  await i.rispondi(
    { id: 4, type: "ponte/integrazioni/elimina", voce: VOCE_SHELLY, conferma: true },
    CHI,
  );
  assert.deepEqual(casa.chiamate.at(-1).slice(0, 2), [
    "DELETE",
    `config/config_entries/entry/${VOCE_SHELLY}`,
  ]);
  /* Un numero storto non arriva a Home Assistant. */
  const storto = await i.rispondi(
    { id: 5, type: "ponte/integrazioni/ricarica", voce: "../../x" },
    CHI,
  );
  assert.equal(storto.error.code, "invalid_format");
});

test("aggiungere: la procedura passo per passo, con le parole tradotte", async () => {
  const casa = unaCasa();
  const i = new Integrazioni({ casa, licenze: premium });
  const primo = (await i.rispondi({ id: 1, type: "ponte/flussi/avvia", handler: "shelly" }, CHI))
    .result;
  assert.equal(primo.tipo, "form");
  assert.equal(primo.parole["step.user.title"], "Dove si trova?");
  assert.equal(primo.parole["step.user.data.host"], "Indirizzo");
  /* Una procedura che non e' passata di qui non si inoltra. */
  const altra = await i.rispondi(
    { id: 2, type: "ponte/flussi/passo", flow_id: "zzzzzzzzzzzz", dati: {} },
    CHI,
  );
  assert.equal(altra.error.code, "not_found");
  const fine = (
    await i.rispondi(
      { id: 3, type: "ponte/flussi/passo", flow_id: primo.flow_id, dati: { host: "192.168.1.47" } },
      CHI,
    )
  ).result;
  assert.equal(fine.tipo, "create_entry");
  assert.equal(fine.voce, "nuovanuova12");
  /* Finita, la procedura non c'e' piu'. */
  const dopo = await i.rispondi({ id: 4, type: "ponte/flussi/leggi", flow_id: primo.flow_id }, CHI);
  assert.equal(dopo.error.code, "not_found");
});

test("le procedure trovate in rete e le riparazioni si possono continuare", async () => {
  const i = new Integrazioni({ casa: unaCasa(), licenze: premium });
  await i.rispondi({ id: 1, type: "ponte/integrazioni/elenco" }, CHI);
  const r = await i.rispondi({ id: 2, type: "ponte/flussi/leggi", flow_id: "f0f0f0f0f0f0" }, CHI);
  assert.equal(r.success, true);
});

test("il catalogo: solo quelle che si aggiungono, con installata e cloud", async () => {
  const i = new Integrazioni({ casa: unaCasa(), licenze: premium });
  const r = (await i.rispondi({ id: 1, type: "ponte/integrazioni/catalogo" }, CHI)).result;
  assert.deepEqual(
    r.integrazioni.map((x) => [x.dominio, x.installata, x.cloud]),
    [
      ["netatmo", true, false],
      ["shelly", true, false],
      ["tado", false, true],
    ],
  );
});

test("i dispositivi della casa, per stanza, con l'integrazione e la batteria", async () => {
  const i = new Integrazioni({ casa: unaCasa(), licenze: premium });
  const r = (await i.rispondi({ id: 1, type: "ponte/dispositivi/elenco" }, CHI)).result;
  assert.deepEqual(
    r.stanze.map((s) => s.nome),
    ["Locale tecnico", "Soggiorno"],
  );
  const caldaia = r.dispositivi.find((d) => d.nome === "Caldaia");
  assert.equal(caldaia.integrazione, "Shelly");
  assert.equal(caldaia.stanza, "tecnico");
  assert.deepEqual(
    caldaia.entita.map((e) => e.id),
    ["switch.caldaia", "sensor.caldaia_potenza"],
  );
  const termostato = r.dispositivi.find((d) => d.nome === "Termostato");
  assert.equal(termostato.entita.find((e) => e.batteria).id, "sensor.termostato_batteria");
});

test("i passi di una procedura, ripuliti", () => {
  assert.deepEqual(
    passoDelFlusso({ type: "external", flow_id: "x", url: "https://tado.com/x" }).tipo,
    "external",
  );
  assert.deepEqual(passoDelFlusso({ type: "menu", menu_options: { a: "A", b: "B" } }).menu, [
    "a",
    "b",
  ]);
  assert.equal(
    passoDelFlusso({ type: "abort", reason: "already_configured" }).perche,
    "already_configured",
  );
});

test("gli aiutanti: i semplici e i calcolati, coi tipi che la casa sa fare", async () => {
  const casa = unaCasa();
  const a = new Aiutanti({ casa, licenze: premium, integrazioni: new Integrazioni({ casa }) });
  const r = (await a.rispondi({ id: 1, type: "ponte/aiutanti/elenco" }, CHI)).result;
  assert.deepEqual(
    r.semplici.map((x) => x.entity_id),
    ["input_boolean.vacanza"],
  );
  assert.equal(r.calcolati[0].nome, "Tutte le luci giorno");
  assert.deepEqual(r.calcolati[0].entita, ["light.tutte_le_luci_giorno"]);
  assert.equal(r.calcolati[0].tipoNome, "Gruppo");
  assert.deepEqual(
    r.tipiCalcolati.map((t) => t.dominio),
    ["group", "threshold"],
  );
});

test("i campi di un aiutante: solo quelli del suo tipo, controllati", () => {
  assert.deepEqual(
    campiPuliti(
      "input_number",
      {
        name: "Comfort",
        min: 16,
        max: 26,
        step: 0.5,
        mode: "slider",
        unit_of_measurement: "°C",
        segreto: 1,
      },
      { nuovo: true },
    ),
    {
      name: "Comfort",
      min: 16,
      max: 26,
      step: 0.5,
      mode: "slider",
      unit_of_measurement: "°C",
    },
  );
  assert.equal(campiPuliti("input_number", { name: "x", min: 5, max: 1 }, { nuovo: true }), null);
  assert.equal(campiPuliti("input_select", { name: "Modo" }, { nuovo: true }), null);
  assert.equal(campiPuliti("timer", { name: "T", duration: "1 ora" }, { nuovo: true }), null);
  assert.deepEqual(
    campiPuliti(
      "schedule",
      { name: "Ufficio", monday: [{ from: "09:00:00", to: "18:00:00" }] },
      { nuovo: true },
    ),
    {
      name: "Ufficio",
      monday: [{ from: "09:00:00", to: "18:00:00" }],
    },
  );
  assert.equal(campiPuliti("shell_command", { name: "x" }, { nuovo: true }), null);
});

test("creare, cambiare e togliere un aiutante semplice", async () => {
  const casa = unaCasa();
  const a = new Aiutanti({ casa, licenze: premium });
  const fatto = await a.rispondi(
    {
      id: 1,
      type: "ponte/aiutanti/crea",
      tipo: "input_boolean",
      campi: { name: "Ospiti in casa", icon: "mdi:account" },
    },
    CHI,
  );
  assert.equal(fatto.success, true);
  assert.deepEqual(casa.chieste.at(-1), {
    type: "input_boolean/create",
    name: "Ospiti in casa",
    icon: "mdi:account",
  });
  await a.rispondi(
    {
      id: 2,
      type: "ponte/aiutanti/modifica",
      tipo: "input_boolean",
      aiutante: "ospiti",
      campi: { name: "Ospiti" },
    },
    CHI,
  );
  assert.deepEqual(casa.chieste.at(-1), {
    type: "input_boolean/update",
    input_boolean_id: "ospiti",
    name: "Ospiti",
  });
  const senza = await a.rispondi(
    { id: 3, type: "ponte/aiutanti/elimina", tipo: "input_boolean", aiutante: "ospiti" },
    CHI,
  );
  assert.equal(senza.success, false);
  await a.rispondi(
    {
      id: 4,
      type: "ponte/aiutanti/elimina",
      tipo: "input_boolean",
      aiutante: "ospiti",
      conferma: true,
    },
    CHI,
  );
  assert.deepEqual(casa.chieste.at(-1), {
    type: "input_boolean/delete",
    input_boolean_id: "ospiti",
  });
  const ignoto = await a.rispondi(
    { id: 5, type: "ponte/aiutanti/crea", tipo: "shell_command", campi: { name: "x" } },
    CHI,
  );
  assert.equal(ignoto.error.code, "invalid_format");
});
