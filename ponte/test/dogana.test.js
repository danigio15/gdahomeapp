/* La dogana: cosa passa verso Home Assistant, e per chi.
 *
 * Il filo verso Home Assistant e' aperto col segno del Supervisor, che la' e'
 * un amministratore. Queste prove tengono fermo che quello che arriva dal
 * telefono o dalla pagina non si prenda quei poteri: le credenziali e il
 * Supervisor per nessuno, le cose da amministratore solo per chi amministra,
 * e le strade REST con le stesse regole — senza trucchi nei percorsi.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { Casa } from "../src/casa.js";
import { Commissioni, dentroLaVia, TIPO } from "../src/commissioni.js";
import { Cucitura } from "../src/cucitura.js";
import {
  passaLaDogana,
  perche,
  percorsoSenzaTrucchi,
  perLaVia,
  servizioVietato,
} from "../src/dogana.js";

const ZITTO = { info() {}, attenzione() {}, errore() {} };
const SEGNO = "il-segno-del-supervisor";

/* ─── I messaggi ─────────────────────────────────────────────────────────── */

test("le credenziali, il Supervisor e i comandi della macchina non passano per nessuno", () => {
  for (const detto of [
    { type: "auth/long_lived_access_token", client_name: "x", lifespan: 3650 },
    { type: "auth/delete_refresh_token", refresh_token_id: "x" },
    { type: "auth/delete_all_refresh_tokens" },
    { type: "auth/refresh_tokens" },
    { type: "auth/current_user" },
    { type: "config/auth/list" },
    { type: "config/auth/create", name: "x" },
    { type: "config/auth_provider_homeassistant/create", username: "x", password: "y" },
    { type: "supervisor/api", endpoint: "/addons/self/info", method: "get" },
    { type: "hassio/addon/info" },
    { type: "backup/generate" },
    { type: "execute_script", sequence: [] },
    { type: "application_credentials/list" },
    { type: "call_service", domain: "hassio", service: "addon_stdin" },
    { type: "call_service", domain: "shell_command", service: "x" },
    { type: "call_service", domain: "python_script", service: "x" },
    { type: "call_service", domain: "pyscript", service: "x" },
    { type: "call_service", domain: "command_line", service: "x" },
  ]) {
    assert.ok(perche(detto, { amministra: true }), `${JSON.stringify(detto)} per chi amministra`);
    assert.ok(perche(detto, { amministra: false }), `${JSON.stringify(detto)} per gli altri`);
  }
});

test("chi amministra passa con il resto; chi non amministra solo con l'elenco", () => {
  const daAmministratore = [
    { type: "config/entity_registry/update", entity_id: "light.x" },
    { type: "render_template", template: "{{ 1 }}" },
    { type: "subscribe_trigger", trigger: {} },
    { type: "subscribe_events" },
    { type: "call_service", domain: "homeassistant", service: "restart" },
    { type: "call_service", domain: "recorder", service: "purge" },
    { type: "call_service", domain: "automation", service: "reload" },
    { type: "call_service", domain: "rest_command", service: "x" },
    { type: "lovelace/config/save", config: {} },
  ];
  for (const detto of daAmministratore) {
    assert.equal(perche(detto, { amministra: true }), null, JSON.stringify(detto));
    assert.ok(perche(detto, { amministra: false }), JSON.stringify(detto));
  }
  const perTutti = [
    { type: "ping" },
    { type: "get_states" },
    { type: "get_services" },
    { type: "subscribe_events", event_type: "state_changed" },
    { type: "unsubscribe_events", subscription: 3 },
    { type: "call_service", domain: "light", service: "turn_on" },
    { type: "call_service", domain: "homeassistant", service: "toggle" },
    { type: "config/entity_registry/list" },
    { type: "history/history_during_period" },
    { type: "recorder/statistics_during_period" },
    { type: "camera/webrtc/offer" },
    { type: "frontend/get_user_data", key: "x" },
    { type: "dashboardmodern/qualcosa" },
    { type: "auth/sign_path", path: "/api/camera_proxy_stream/camera.porta" },
  ];
  for (const detto of perTutti) {
    assert.equal(perche(detto, { amministra: false }), null, JSON.stringify(detto));
  }
});

test("si firmano solo gli indirizzi delle telecamere, delle immagini e del calendario", () => {
  for (const path of [
    "/api/hassio/backups/abc/download",
    "/api/config/core",
    "/api/camera_proxy/../hassio/x",
    "/api/camera_proxy/%2e%2e/%2e%2e/hassio",
    "/api/camera_proxy/%252e%252e/hassio",
    "http://altrove/api/camera_proxy/x",
  ]) {
    assert.ok(perche({ type: "auth/sign_path", path }, { amministra: true }), path);
  }
  assert.equal(
    perche({ type: "auth/sign_path", path: "/api/webrtc/ws?url=rtsp%3A%2F%2Fx%2Fy" }),
    null,
    "nella domanda una barra in percentuale e' un valore, non una strada",
  );
});

test("la dogana risponde come Home Assistant, e un `auth` si lascia cadere", () => {
  const no = passaLaDogana(JSON.stringify({ id: 9, type: "config/auth/list" }), {
    amministra: true,
  });
  assert.deepEqual(no.passa, []);
  assert.deepEqual(no.rifiuti, [
    {
      id: 9,
      type: "result",
      success: false,
      error: { code: "unauthorized", message: "config/auth/list non passa dal ponte" },
    },
  ]);
  assert.deepEqual(passaLaDogana(JSON.stringify({ type: "auth", access_token: "x" })), {
    passa: [],
    rifiuti: [],
  });
  /* Un testo che non e' JSON non arriva a Home Assistant. */
  assert.deepEqual(passaLaDogana("non json"), { passa: [], rifiuti: [] });
  /* Un elenco si guarda un messaggio per volta. */
  const misto = passaLaDogana(
    JSON.stringify([
      { id: 1, type: "get_states" },
      { id: 2, type: "auth/long_lived_access_token" },
    ]),
    { amministra: false },
  );
  assert.deepEqual(misto.passa, [JSON.stringify({ id: 1, type: "get_states" })]);
  assert.equal(misto.rifiuti[0].id, 2);
});

test("un servizio si decide per dominio e per nome", () => {
  assert.ok(servizioVietato("HASSIO", "addon_start", { amministra: true }));
  assert.equal(servizioVietato("light", "turn_on"), null);
  assert.ok(servizioVietato("input_boolean", "reload"));
  assert.equal(servizioVietato("input_boolean", "reload", { amministra: true }), null);
  assert.equal(servizioVietato("homeassistant", "update_entity"), null);
  assert.ok(servizioVietato("homeassistant", "stop"));
});

/* ─── Le strade REST ─────────────────────────────────────────────────────── */

test("i percorsi con i trucchi non passano, sciolti quante volte serve", () => {
  for (const percorso of [
    "/api/../hassio",
    "/api/%2e%2e/%2e%2e/addons/self/info",
    "/api/%2E%2E/x",
    "/api/%252e%252e/x",
    "/api/x%2fy",
    "/api/x%5cy",
    "/api/x\\y",
    "/api/./x",
    "/api/x\u0000",
    "api/x",
  ]) {
    assert.equal(percorsoSenzaTrucchi(percorso), false, percorso);
  }
  assert.equal(percorsoSenzaTrucchi("/local/mia auto.png"), true);
  assert.equal(percorsoSenzaTrucchi("/api/calendars/x?start=2025-01-01T00%3A00%3A00Z"), true);
});

test("per REST valgono le stesse regole", () => {
  assert.ok(perLaVia({ percorso: "/api/hassio/addons/self/info", amministra: true }));
  assert.ok(perLaVia({ percorso: "/api/hassio_ingress/x", amministra: true }));
  assert.ok(
    perLaVia({ metodo: "POST", percorso: "/api/services/hassio/addon_stdin", amministra: true }),
  );
  assert.ok(
    perLaVia({ metodo: "POST", percorso: "/api/services/shell_command/x", amministra: true }),
  );
  assert.ok(perLaVia({ percorso: "/api/auth/qualunque", amministra: true }));
  assert.equal(
    perLaVia({ percorso: "/api/hassio/addons/uno/icon" }),
    null,
    "un'icona e' un disegno",
  );
  assert.equal(perLaVia({ metodo: "POST", percorso: "/api/template", amministra: true }), null);
  /* Chi non amministra legge e usa, non cambia la casa. */
  assert.equal(perLaVia({ percorso: "/api/states" }), null);
  assert.equal(perLaVia({ metodo: "POST", percorso: "/api/services/light/turn_on" }), null);
  assert.equal(perLaVia({ metodo: "POST", percorso: "/api/image/upload" }), null);
  assert.ok(perLaVia({ metodo: "POST", percorso: "/api/states/light.x" }));
  assert.ok(perLaVia({ metodo: "POST", percorso: "/api/template" }));
  assert.ok(perLaVia({ percorso: "/api/error_log" }));
  assert.ok(perLaVia({ percorso: "/api/config/automation/config/1" }));
  assert.ok(perLaVia({ metodo: "POST", percorso: "/api/services/homeassistant/restart" }));
});

test("ponte/http non esce da /core/api, nemmeno coi punti in percentuale", async () => {
  const chieste = [];
  const commissioni = new Commissioni({
    casa: new Casa({
      indirizzo: "http://supervisor/core",
      segno: SEGNO,
      plancia: "http://172.30.32.1:8123",
    }),
    registro: ZITTO,
    scarica: async (quale) => {
      chieste.push(quale);
      return { stato: 200, tipo: "text/plain", corpo: Buffer.from("x") };
    },
  });
  for (const percorso of [
    "/api/%2e%2e/%2e%2e/addons/self/info",
    "/api/%2E%2e/addons/self/options/config",
    "/api/%252e%252e/%252e%252e/addons/self/info",
    "/api/x/..%2f..%2f..%2faddons",
    "/dashboardmodern_static/%2e%2e/api/hassio/x",
  ]) {
    const risposta = await commissioni.rispondi(
      { id: 1, type: TIPO, percorso },
      { puoAmministrare: true },
    );
    assert.equal(risposta.success, false, percorso);
  }
  assert.equal(chieste.length, 0, "non si e' nemmeno provato");

  /* Il Supervisor attraverso Home Assistant no, per nessuno. */
  const supervisor = await commissioni.rispondi(
    { id: 2, type: TIPO, percorso: "/api/hassio/addons/self/info" },
    { puoAmministrare: true },
  );
  assert.equal(supervisor.error.code, "unauthorized");
  /* E chi non amministra non scrive gli stati. */
  const scritto = await commissioni.rispondi({
    id: 3,
    type: TIPO,
    metodo: "POST",
    percorso: "/api/states/light.x",
    corpo: Buffer.from("{}").toString("base64"),
  });
  assert.equal(scritto.error.code, "unauthorized");
  assert.equal(chieste.length, 0);
});

test("l'indirizzo composto resta sulla stessa macchina e sotto la stessa cartella", () => {
  assert.equal(
    dentroLaVia("http://supervisor/core", "/api/states", "/api/"),
    "http://supervisor/core/api/states",
  );
  assert.equal(dentroLaVia("http://supervisor/core", "/api/../../addons", "/api/"), null);
  assert.equal(dentroLaVia("http://supervisor/core", "/api/%2e%2e/%2e%2e/addons", "/api/"), null);
  assert.equal(dentroLaVia("http://supervisor/core", "@altrove/api/x", "/api/"), null);
  assert.equal(
    dentroLaVia(
      "http://172.30.32.1:8123",
      "/dashboardmodern_static/%2e%2e/api/x",
      "/dashboardmodern_static/",
    ),
    null,
  );
});

/* ─── Le commissioni da amministratore ───────────────────────────────────── */

test("le commissioni che cambiano la casa le fa solo chi amministra", async () => {
  const commissioni = new Commissioni({
    registro: ZITTO,
    plance: { elenco: () => [], aggiungi: () => ({ profilo: "x" }) },
    configurazione: { leggi: () => ({}), scrivi: () => ({ status: "saved" }) },
    aggiornamenti: { installa: async () => ({ avviato: true }), riavvia: async () => ({}) },
    zigbee: { apri: async () => ({}), chiudi: async () => ({}), rinomina: async () => ({}) },
  });
  for (const detto of [
    { type: "ponte/plance/aggiungi", titolo: "x" },
    { type: "ponte/plance/togli", profilo: "x" },
    { type: "ponte/aggiornamenti/installa", entity_id: "update.x" },
    { type: "ponte/aggiornamenti/riavvia" },
    { type: "ponte/zigbee/apri" },
    { type: "dashboardmodern/config/set", snapshot: { values: {} } },
    { type: "ponte/console/coda" },
  ]) {
    for (const come of [{}, { chiChiede: "d".repeat(32), puoAmministrare: false }]) {
      const risposta = await commissioni.rispondi({ id: 5, ...detto }, come);
      assert.equal(risposta.error?.code, "unauthorized", `${detto.type} ${JSON.stringify(come)}`);
      assert.equal(risposta.id, 5);
    }
  }
  const fatto = await commissioni.rispondi(
    { id: 6, type: "ponte/plance/aggiungi", titolo: "x" },
    { puoAmministrare: true },
  );
  assert.equal(fatto.success, true);
});

/* ─── La pagina della plancia dentro Home Assistant ─────────────────────── */

function unaCucitura({ chiGuarda, utenti }) {
  const allaPagina = [];
  const allaCasa = [];
  const presa = {
    manda: (testo) => allaPagina.push(JSON.parse(testo)),
    chiudi() {},
  };
  const casa = {
    apriIlFilo: async () => ({
      manda: (testo) => {
        allaCasa.push(JSON.parse(testo));
        return true;
      },
      chiudi() {},
    }),
  };
  const cucitura = new Cucitura({ presa, casa, registro: ZITTO, chiGuarda, utenti });
  return { cucitura, presa, allaPagina, allaCasa };
}

test("la pagina di chi non amministra passa dalla dogana come un telefono", async () => {
  const utenti = { amministratore: async (chi) => chi === "chi-amministra" };
  const ospite = unaCucitura({ chiGuarda: "un-ospite", utenti });
  await ospite.cucitura.avvia();
  ospite.presa.onMessaggio(JSON.stringify({ id: 1, type: "config/auth/list" }));
  ospite.presa.onMessaggio(JSON.stringify({ id: 2, type: "get_states" }));
  ospite.presa.onMessaggio(JSON.stringify({ id: 3, type: "config/entity_registry/update" }));
  assert.deepEqual(
    ospite.allaCasa.map((detto) => detto.type),
    ["get_states"],
  );
  assert.deepEqual(
    ospite.allaPagina.filter((detto) => detto.type === "result").map((detto) => detto.id),
    [1, 3],
  );

  const admin = unaCucitura({ chiGuarda: "chi-amministra", utenti });
  await admin.cucitura.avvia();
  admin.presa.onMessaggio(JSON.stringify({ id: 3, type: "config/entity_registry/update" }));
  admin.presa.onMessaggio(JSON.stringify({ id: 4, type: "auth/long_lived_access_token" }));
  assert.deepEqual(
    admin.allaCasa.map((detto) => detto.type),
    ["config/entity_registry/update"],
  );

  /* Senza la riga dell'ingress non si sa chi e': non amministra. */
  const nessuno = unaCucitura({ chiGuarda: "", utenti });
  await nessuno.cucitura.avvia();
  nessuno.presa.onMessaggio(JSON.stringify({ id: 5, type: "config/entity_registry/update" }));
  assert.deepEqual(nessuno.allaCasa, []);
});
