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
    /* Qui c'era anche `lovelace/config/save`. Adesso non passa nemmeno a chi
     * amministra: una configurazione di dashboard puo' portarsi dietro
     * programmi che girano nel browser di chi apre Home Assistant, e nessun
     * pezzo dell'app o della plancia la scrive di qui. Le prove di quello che
     * a chi amministra resta chiuso stanno piu' sotto. */
    { type: "lovelace/dashboards/create", url_path: "x", title: "x" },
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
    zigbee: {
      apri: async () => ({}),
      chiudi: async () => ({}),
      rinomina: async () => ({}),
      elimina: async () => ({}),
    },
  });
  for (const detto of [
    { type: "ponte/plance/aggiungi", titolo: "x" },
    { type: "ponte/plance/togli", profilo: "x" },
    { type: "ponte/aggiornamenti/installa", entity_id: "update.x" },
    { type: "ponte/aggiornamenti/riavvia" },
    { type: "ponte/zigbee/apri" },
    { type: "ponte/zigbee/elimina", targa: "0x00124b0001" },
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

/* ─── Quello che una revisione ha trovato ───────────────────────────────── */

test("nelle vie REST le percentuali e le barre doppie non passano, e le maiuscole non ingannano", () => {
  for (const [metodo, percorso, amministra] of [
    ["POST", "/api/services/hass%69o/addon_stdin", true],
    ["POST", "/api/services/hass%69o/addon_stdin", false],
    ["POST", "/api/services/homeassist%61nt/restart", false],
    ["POST", "/api/%63onfig/automation/config/x", false],
    ["POST", "/api/templat%65", false],
    ["GET", "/api/hass%69o/addons", true],
    ["GET", "/api/%61uth/x", true],
    ["POST", "/api/services/shell%5Fcommand/x", true],
    ["GET", "/api//hassio/addons", true],
    ["GET", "/api/HASSIO/addons", true],
    ["POST", "/api/services/SHELL_COMMAND/x", true],
    ["POST", "/api/Template", false],
  ]) {
    assert.ok(perLaVia({ metodo, percorso, amministra }), `${metodo} ${percorso} ${amministra}`);
  }
  /* La domanda dopo il `?` resta com'e'. */
  assert.equal(perLaVia({ percorso: "/api/calendars/calendar.x?start=2025-01-01T00%3A00Z" }), null);
});

test("in un elenco i comandi della plancia e del ponte non vanno a Home Assistant", () => {
  for (const amministra of [false, true]) {
    const detto = passaLaDogana(
      JSON.stringify([
        { id: 1, type: "dashboardmodern/config/set", snapshot: { values: {} } },
        { id: 2, type: "dashboardmodern/config/restore", revision: 1 },
        { id: 3, type: "dashboardmodern/chat/queue" },
        { id: 4, type: "dashboardmodern/www/upload" },
        { id: 5, type: "ponte/plance/togli", profilo: "x" },
        { id: 6, type: "get_states" },
      ]),
      { amministra },
    );
    assert.deepEqual(detto.passa, [JSON.stringify({ id: 6, type: "get_states" })]);
    assert.deepEqual(
      detto.rifiuti.map((uno) => [uno.id, uno.error.code]),
      [1, 2, 3, 4, 5].map((id) => [id, "unauthorized"]),
    );
  }
  /* E da solo, un comando della plancia che il ponte non ha preso non va a
   * Home Assistant per chi non amministra; un `ponte/…` per nessuno. */
  assert.ok(perche({ type: "dashboardmodern/config/set" }, { amministra: false }));
  assert.ok(perche({ type: "ponte/qualunque" }, { amministra: true }));
});

test("chi non amministra chiama solo i servizi delle cose di casa", () => {
  for (const [dominio, servizio] of [
    ["light", "turn_on"],
    ["switch", "toggle"],
    ["cover", "open_cover"],
    ["climate", "set_temperature"],
    ["lock", "unlock"],
    ["alarm_control_panel", "alarm_disarm"],
    ["vacuum", "start"],
    ["input_boolean", "toggle"],
    ["select", "select_option"],
    ["script", "inserisci_antifurto"],
    ["scene", "turn_on"],
    ["todo", "add_item"],
    ["weather", "get_forecasts"],
    ["calendar", "get_events"],
    ["homeassistant", "toggle"],
  ]) {
    assert.equal(servizioVietato(dominio, servizio), null, `${dominio}.${servizio}`);
  }
  for (const [dominio, servizio] of [
    ["frontend", "set_theme"],
    ["group", "set"],
    ["input_boolean", "reload"],
    ["scene", "create"],
    ["scene", "apply"],
    ["automation", "reload"],
    ["camera", "snapshot"],
    ["camera", "record"],
    ["homeassistant", "restart"],
    ["tts", "clear_cache"],
    ["counter_non_esiste", "x"],
    ["system_log", "clear"],
    ["zone", "reload"],
    ["", "turn_on"],
  ]) {
    assert.ok(servizioVietato(dominio, servizio), `${dominio}.${servizio}`);
    assert.ok(
      perLaVia({ metodo: "POST", percorso: `/api/services/${dominio || "x"}/${servizio}` }) ||
        !dominio,
      `REST ${dominio}.${servizio}`,
    );
  }
  /* Chi amministra: tutto tranne quello che non passa per nessuno. */
  assert.equal(servizioVietato("frontend", "set_theme", { amministra: true }), null);
  assert.ok(servizioVietato("hassio", "addon_start", { amministra: true }));
});

test("il telecomando della TV passa per tutti, i comandi di sistema della TV no (#132)", () => {
  /* Le frecce, OK, i canali: per le TV col telecomando in Home Assistant e per
   * le LG, che i tasti li prendono dal televisore. */
  assert.equal(servizioVietato("remote", "send_command"), null);
  assert.equal(servizioVietato("webostv", "button"), null);
  /* Una richiesta qualunque al sistema della TV, o la riga di comando di un
   * Android via ADB, non e' un tasto: resta a chi amministra. */
  assert.ok(servizioVietato("webostv", "command"));
  assert.ok(servizioVietato("androidtv", "adb_command"));
  assert.equal(servizioVietato("webostv", "command", { amministra: true }), null);
});

test("la friggitrice Philips si comanda per tutti, coi servizi della cottura (#71)", () => {
  /* `philips_airfryer` tasti non ne ha: la pausa, lo stop, il minuto in piu'
   * e i gradi passano dai suoi servizi, e sono quelli che la Cottura preme. */
  for (const servizio of ["pause", "start_resume", "stop", "adjust_time", "adjust_temp"])
    assert.equal(servizioVietato("philips_airfryer", servizio), null, servizio);
  /* Un servizio che la plancia non preme resta a chi amministra. */
  assert.ok(servizioVietato("philips_airfryer", "reload"));
  assert.ok(servizioVietato("philips_airfryer", "qualcosa_d_altro"));
});

/* ─── Chi amministra, e quello che neanche lui ──────────────────────────────
 *
 * Un telefono intestato a chi amministra passava con quasi tutto, e dentro
 * quel «quasi» c'erano due giri per arrivare dove la regola 1 di `dogana.js`
 * non voleva: scriversi un'automazione con dentro un servizio che qui non
 * passa e poi farla partire, o mettere un programma fra le risorse delle
 * dashboard, che poi gira nel browser di chi amministra davvero. Queste prove
 * li tengono chiusi — e tengono aperto, messaggio per messaggio, quello che
 * l'app e la plancia mandano davvero, perche' un divieto che rompe un tasto e'
 * un divieto che qualcuno togliera'. */

const CHI_AMMINISTRA = { amministra: true };

test("chi amministra non si scrive un'automazione da far partire: la scrittura si ferma", () => {
  /* Il giro intero: `POST /api/config/automation/config/<id>` con dentro
   * `hassio.addon_stdin`, poi `automation.trigger`. L'automazione gira come
   * Home Assistant, e il controllo sui servizi non la vede mai. Il secondo
   * passo e' un tasto della casa e deve restare: si chiude il primo. */
  for (const [metodo, percorso] of [
    ["POST", "/api/config/automation/config/porta_aperta"],
    ["PUT", "/api/config/automation/config/porta_aperta"],
    ["DELETE", "/api/config/automation/config/porta_aperta"],
    ["POST", "/api/config/script/config/fai_tutto"],
    ["DELETE", "/api/config/script/config/fai_tutto"],
    ["POST", "/api/config/scene/config/1712345678"],
    /* Con le maiuscole, la barra in fondo o una domanda dopo il `?`, la via
     * e' la stessa. */
    ["POST", "/api/Config/Automation/config/x"],
    ["POST", "/api/config/automation/config/x/"],
    ["POST", "/api/config/automation/config/x?y=1"],
    /* E un'integrazione nuova, o riconfigurata, non si mette su di qui. */
    ["POST", "/api/config/config_entries/flow"],
    ["POST", "/api/config/config_entries/flow/0123abcd"],
    ["POST", "/api/config/config_entries/options/flow"],
    ["POST", "/api/config/config_entries/subentries/flow"],
  ]) {
    assert.ok(perLaVia({ metodo, percorso, amministra: true }), `${metodo} ${percorso}`);
  }
  /* Leggerle resta: non fa girare niente. */
  assert.equal(
    perLaVia({ percorso: "/api/config/automation/config/porta_aperta", amministra: true }),
    null,
  );
  assert.equal(
    perLaVia({ percorso: "/api/config/script/config/fai_tutto", amministra: true }),
    null,
  );
  /* E il secondo passo resta quello che e': un servizio delle cose di casa. */
  assert.equal(
    perche({ type: "call_service", domain: "automation", service: "trigger" }, CHI_AMMINISTRA),
    null,
  );
});

test("da `ponte/http`, l'automazione di chi amministra non arriva nemmeno a Home Assistant", async () => {
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
      return { stato: 200, tipo: "application/json", corpo: Buffer.from("{}") };
    },
  });
  const automazione = {
    alias: "Porta aperta",
    triggers: [],
    actions: [{ action: "hassio.addon_stdin", data: { addon: "core_ssh", input: "x" } }],
  };
  const scritta = await commissioni.rispondi(
    {
      id: 1,
      type: TIPO,
      metodo: "POST",
      percorso: "/api/config/automation/config/porta_aperta",
      corpo: Buffer.from(JSON.stringify(automazione)).toString("base64"),
      tipo: "application/json",
    },
    { puoAmministrare: true },
  );
  assert.equal(scritta.success, false);
  assert.equal(scritta.error.code, "unauthorized");
  assert.equal(chieste.length, 0, "a Home Assistant non e' arrivato niente");

  /* Quello che la plancia chiede di qui, invece, ci arriva. */
  for (const [metodo, percorso] of [
    ["GET", "/api/camera_proxy/camera.ingresso"],
    ["GET", "/api/calendars/calendar.casa?start=2026-10-01T00%3A00%3A00Z"],
    ["GET", "/api/history/period/2026-10-01T00:00:00Z"],
    ["POST", "/api/image/upload"],
  ]) {
    const passata = await commissioni.rispondi(
      { id: 2, type: TIPO, metodo, percorso },
      { puoAmministrare: true },
    );
    assert.equal(passata.success, true, `${metodo} ${percorso}`);
  }
  assert.equal(chieste.length, 4);
});

test("chi amministra non mette programmi nelle pagine di Home Assistant", () => {
  for (const detto of [
    { type: "lovelace/resources/create", res_type: "module", url: "https://altrove.example/x.js" },
    { type: "lovelace/resources/update", resource_id: "abc", url: "/local/x.js" },
    { type: "lovelace/resources/delete", resource_id: "abc" },
    { type: "lovelace/config/save", url_path: "x", config: { views: [] } },
    { type: "lovelace/config/delete", url_path: "x" },
  ]) {
    assert.ok(perche(detto, CHI_AMMINISTRA), JSON.stringify(detto));
  }
  /* Leggerle resta, per tutti. */
  for (const detto of [
    { type: "lovelace/resources" },
    { type: "lovelace/config" },
    { type: "lovelace/dashboards/list" },
  ]) {
    assert.equal(perche(detto, CHI_AMMINISTRA), null, JSON.stringify(detto));
    assert.equal(perche(detto, { amministra: false }), null, JSON.stringify(detto));
  }
});

test("ne' blueprint, ne' HACS, ne' una casa spenta: nemmeno a chi amministra", () => {
  for (const detto of [
    {
      type: "blueprint/save",
      domain: "automation",
      path: "x.yaml",
      yaml: "",
      allow_override: true,
    },
    { type: "blueprint/import", url: "https://altrove.example/x.yaml" },
    { type: "blueprint/delete", domain: "automation", path: "x.yaml" },
    { type: "hacs/repositories/add", repository: "qualcuno/qualcosa", category: "integration" },
    { type: "hacs/repository/download", repository: "123" },
    { type: "call_service", domain: "homeassistant", service: "stop" },
    { type: "call_service", domain: "HomeAssistant", service: "STOP" },
    { type: "call_service", domain: "hassio", service: "addon_stdin" },
    { type: "call_service", domain: "hassio", service: "backup_full" },
    { type: "call_service", domain: "backup", service: "create_automatic" },
    { type: "call_service", domain: "shell_command", service: "qualunque" },
    { type: "call_service", domain: "python_script", service: "qualunque" },
    { type: "call_service", domain: "pyscript", service: "qualunque" },
  ]) {
    assert.ok(perche(detto, CHI_AMMINISTRA), JSON.stringify(detto));
  }
  for (const percorso of [
    "/api/services/homeassistant/stop",
    "/api/services/hassio/addon_stdin",
    "/api/services/hassio/backup_full",
    "/api/services/backup/create_automatic",
    "/api/services/shell_command/qualunque",
  ]) {
    assert.ok(perLaVia({ metodo: "POST", percorso, amministra: true }), percorso);
  }
  /* Leggere i blueprint resta: non fa girare niente. */
  assert.equal(perche({ type: "blueprint/list", domain: "automation" }, CHI_AMMINISTRA), null);
});

test("quello che l'app e la plancia mandano davvero passa ancora per chi amministra", () => {
  /* L'elenco in cima a `dogana.js`, messaggio per messaggio: e' quello che si
   * e' trovato cercando nell'app, nella plancia e nel ponte. */
  for (const detto of [
    { type: "get_states" },
    { type: "get_config" },
    { type: "get_services" },
    { type: "get_panels" },
    { type: "subscribe_events", event_type: "state_changed" },
    { type: "subscribe_entities", entity_ids: ["light.x"] },
    { type: "config/entity_registry/list" },
    { type: "config/device_registry/list" },
    { type: "config/area_registry/list" },
    { type: "config/floor_registry/list" },
    { type: "history/history_during_period", start_time: "2026-10-01T00:00:00Z" },
    { type: "recorder/statistics_during_period", statistic_ids: ["sensor.x"] },
    { type: "camera/stream", entity_id: "camera.x" },
    { type: "camera/webrtc/offer", entity_id: "camera.x", offer: "v=0" },
    { type: "media_source/browse_media" },
    { type: "media_player/browse_media", entity_id: "media_player.x" },
    { type: "frontend/get_user_data", key: "x" },
    { type: "frontend/set_user_data", key: "x", value: {} },
    { type: "calendar/event/create", entity_id: "calendar.x", event: {} },
    { type: "auth/sign_path", path: "/api/camera_proxy_stream/camera.porta" },
    { type: "auth/sign_path", path: "/api/webrtc/ws?url=rtsp%3A%2F%2Fx" },
    { type: "call_service", domain: "light", service: "turn_on" },
    { type: "call_service", domain: "scene", service: "turn_on" },
    { type: "call_service", domain: "script", service: "turn_on" },
    { type: "call_service", domain: "homeassistant", service: "toggle" },
    { type: "call_service", domain: "update", service: "install" },
    /* E le cose da amministratore che non fanno girare niente, anche se oggi
     * nessuno le chiede di qui: il riavvio — lo stesso potere del tasto
     * dell'app — i registri, l'energia, il titolo di una dashboard. */
    { type: "call_service", domain: "homeassistant", service: "restart" },
    { type: "config/entity_registry/update", entity_id: "light.x", name: "x" },
    { type: "config/area_registry/update", area_id: "x", name: "x" },
    { type: "energy/save_prefs", energy_sources: [] },
    { type: "lovelace/dashboards/update", dashboard_id: "x", title: "x" },
  ]) {
    assert.equal(perche(detto, CHI_AMMINISTRA), null, JSON.stringify(detto));
  }
  for (const [metodo, percorso] of [
    ["GET", "/api/camera_proxy/camera.ingresso"],
    ["GET", "/api/camera_proxy_stream/camera.ingresso"],
    ["GET", "/api/calendars/calendar.casa?start=2026-10-01T00%3A00%3A00Z"],
    ["GET", "/api/image/serve/abc/original"],
    ["POST", "/api/image/upload"],
    ["GET", "/api/history/period/2026-10-01T00:00:00Z"],
    ["POST", "/api/services/update/install"],
    ["POST", "/api/services/homeassistant/restart"],
  ]) {
    assert.equal(perLaVia({ metodo, percorso, amministra: true }), null, `${metodo} ${percorso}`);
  }
});
