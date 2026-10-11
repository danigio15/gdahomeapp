/* La dogana, a tappeto.
 *
 * Il ponte parla a Home Assistant col segno del Supervisor, che per Home
 * Assistant e' un amministratore: tutto quello che un telefono chiede, Home
 * Assistant lo fa. Le regole su chi puo' cosa, quindi, stanno solo qui
 * (`dogana.js`), e un buco qui e' un buco in casa.
 *
 * Le altre prove guardano i casi uno per uno. Questa li guarda **tutti
 * insieme**, per un telefono di chi non amministra, e cerca le strade
 * indirette: non solo «posso chiamare `shell_command`», ma «posso scrivere
 * un'automazione che lo chiami», «posso farmi firmare un indirizzo del
 * Supervisor», «posso infilare il comando in un elenco», «posso scriverlo in
 * maiuscolo». Ogni riga che passa e non doveva e' una porta aperta.
 *
 * E il contrario, alla fine: quello che l'app e la plancia usano davvero deve
 * continuare a passare. Una dogana che chiude tutto e' una plancia spenta.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { passaLaDogana, perLaVia, perche } from "../src/dogana.js";

const NON_AMMINISTRA = { amministra: false };
const AMMINISTRA = { amministra: true };

const no = (detto, chi = NON_AMMINISTRA) => perche(detto, chi);
const servizio = (domain, service, extra = {}) => ({
  id: 1,
  type: "call_service",
  domain,
  service,
  ...extra,
});

/* ─── 1. I comandi che chi non amministra non deve poter mandare ────────── */

test("comandi da amministratore: nessuno passa a chi non amministra", () => {
  const vietati = [
    /* Credenziali e utenti. */
    "auth/long_lived_access_token",
    "auth/delete_refresh_token",
    "auth/delete_all_refresh_tokens",
    "auth/refresh_tokens",
    "auth/current_user",
    "config/auth/list",
    "config/auth/create",
    "config/auth/delete",
    "config/auth_provider_homeassistant/create",
    "config/auth_provider_homeassistant/change_password",
    "application_credentials/create",
    /* Supervisor e backup. */
    "supervisor/api",
    "hassio/addon/start",
    "backup/generate",
    "backup/info",
    /* Codice che gira: copioni, modelli, inneschi. */
    "execute_script",
    "render_template",
    "subscribe_trigger",
    "test_condition",
    "validate_config",
    /* Le pagine di Home Assistant: risorse e configurazioni delle dashboard. */
    "lovelace/resources/create",
    "lovelace/resources/update",
    "lovelace/config/save",
    "lovelace/config/delete",
    "lovelace/dashboards/create",
    /* Automazioni, script, scene, blueprint scritti dal filo. */
    "config/automation/config",
    "config/script/config",
    "blueprint/save",
    "blueprint/import",
    /* Integrazioni, registri, impostazioni. */
    "config_entries/flow/progress",
    "config_entries/delete",
    "config/entity_registry/update",
    "config/entity_registry/remove",
    "config/device_registry/update",
    "config/area_registry/create",
    "config/core/update",
    "energy/save_prefs",
    "recorder/clear_statistics",
    "recorder/update_statistics_metadata",
    "system_log/list",
    "logger/log_info",
    "repairs/list_issues",
    "search/related",
    "update/release_notes",
    "hacs/repositories/add",
    "zha/devices/permit",
    "zwave_js/add_node",
    "mqtt/subscribe",
    "cloud/status",
    /* Il comando di un altro: un tipo che non si conosce non e' un permesso. */
    "una_cosa_nuova/che_nessuno_conosce",
  ];
  for (const type of vietati) {
    assert.notEqual(no({ id: 1, type }), null, `${type} passava a chi non amministra`);
  }
});

test("le credenziali, il Supervisor e i copioni non passano nemmeno a chi amministra", () => {
  for (const type of [
    "auth/long_lived_access_token",
    "auth/delete_all_refresh_tokens",
    "config/auth/delete",
    "supervisor/api",
    "hassio/addon/start",
    "backup/generate",
    "execute_script",
    "lovelace/resources/create",
    "lovelace/config/save",
    "blueprint/save",
    "hacs/repositories/add",
  ]) {
    assert.notEqual(no({ id: 1, type }, AMMINISTRA), null, `${type} passava a chi amministra`);
  }
});

/* ─── 2. I servizi: le strade indirette verso la macchina ───────────────── */

test("servizi che eseguono, riscrivono o spengono: no a chi non amministra", () => {
  const vietati = [
    ["shell_command", "qualunque"],
    ["python_script", "qualunque"],
    ["pyscript", "reload"],
    ["command_line", "reload"],
    ["hassio", "addon_start"],
    ["hassio", "host_shutdown"],
    ["backup", "create"],
    ["homeassistant", "stop"],
    ["homeassistant", "restart"],
    ["homeassistant", "reload_all"],
    ["homeassistant", "reload_core_config"],
    ["homeassistant", "reload_config_entry"],
    ["homeassistant", "set_location"],
    ["homeassistant", "check_config"],
    ["homeassistant", "save_persistent_states"],
    /* Le automazioni, gli script e le scene si usano, non si riscrivono. */
    ["automation", "reload"],
    ["script", "reload"],
    ["scene", "reload"],
    ["scene", "create"],
    ["scene", "apply"],
    ["scene", "delete"],
    ["input_boolean", "reload"],
    ["timer", "reload"],
    /* Registrare, scrivere file, toccare la rete. */
    ["camera", "snapshot"],
    ["camera", "record"],
    ["recorder", "purge"],
    ["recorder", "purge_entities"],
    ["recorder", "disable"],
    ["logger", "set_level"],
    ["system_log", "clear"],
    ["update", "install"],
    ["update", "skip"],
    ["mqtt", "publish"],
    ["mqtt", "dump"],
    ["zha", "permit"],
    ["zha", "remove"],
    ["zwave_js", "set_config_parameter"],
    ["rest_command", "qualunque"],
    ["cloud", "remote_connect"],
    ["frontend", "set_theme"],
    ["frontend", "reload_themes"],
    ["webostv", "command"],
    ["notify", "reload"],
  ];
  for (const [domain, service] of vietati) {
    assert.notEqual(
      no(servizio(domain, service)),
      null,
      `${domain}.${service} passava a chi non amministra`,
    );
  }
});

test("i servizi che toccano la macchina non passano nemmeno a chi amministra", () => {
  for (const [domain, service] of [
    ["shell_command", "x"],
    ["python_script", "x"],
    ["pyscript", "x"],
    ["command_line", "x"],
    ["hassio", "addon_start"],
    ["backup", "create"],
    ["homeassistant", "stop"],
  ]) {
    assert.notEqual(no(servizio(domain, service), AMMINISTRA), null, `${domain}.${service}`);
  }
});

test("lo stesso servizio scritto storto resta lo stesso servizio", () => {
  for (const [domain, service] of [
    ["SHELL_COMMAND", "x"],
    [" shell_command ", "x"],
    ["Hassio", "addon_start"],
    ["homeassistant", " STOP "],
    ["Homeassistant", "Restart"],
  ]) {
    assert.notEqual(no(servizio(domain, service)), null, `«${domain}».«${service}»`);
  }
  /* E senza dominio o senza servizio non si chiede niente. */
  assert.notEqual(no(servizio("", "turn_on")), null);
  assert.notEqual(no(servizio("light", "")), null);
  assert.notEqual(no({ id: 1, type: "call_service" }), null);
});

/* ─── 3. Gli eventi: cosa si ascolta ────────────────────────────────────── */

test("ascoltare tutto, o gli eventi che raccontano la casa, non passa", () => {
  for (const event_type of [
    undefined,
    "",
    "*",
    "call_service",
    "automation_triggered",
    "script_started",
    "homeassistant_stop",
    "user_added",
    "user_removed",
    "mobile_app_notification_action",
    "zha_event",
  ]) {
    assert.notEqual(
      no({ id: 1, type: "subscribe_events", ...(event_type === undefined ? {} : { event_type }) }),
      null,
      `subscribe_events «${event_type}» passava`,
    );
  }
});

/* ─── 4. Le firme: un indirizzo firmato vale come il segno del Supervisor ─ */

test("si firmano solo gli indirizzi delle telecamere, delle immagini e del calendario", () => {
  const firma = (path) => no({ id: 1, type: "auth/sign_path", path });
  for (const path of [
    "/api/hassio/addons/core_ssh/info",
    "/api/hassio_ingress/abc/",
    "/api/supervisor/info",
    "/api/backup/download/x",
    "/api/config/core/check_config",
    "/api/error_log",
    "/api/template",
    "/api/states",
    "/auth/token",
    "/api/camera_proxy/../hassio/info",
    "/api/camera_proxy/%2e%2e/hassio/info",
    "/api/camera_proxy/%252e%252e/hassio",
    "/api/camera_proxy\\..\\hassio",
    "/api/camera_proxy/camera.x\u0000/../hassio",
    "api/camera_proxy/camera.x",
    "",
  ]) {
    assert.notEqual(firma(path), null, `si firmava «${path}»`);
  }
  for (const path of [
    "/api/camera_proxy/camera.ingresso",
    "/api/camera_proxy_stream/camera.ingresso",
    "/api/image_proxy/image.x",
    "/api/image/serve/abc/512x512",
    "/api/media_player_proxy/media_player.sala",
    "/api/calendars/calendar.casa",
    "/api/webrtc/ws",
    "/api/tts_proxy/abc.mp3",
    "/api/hls/abc/master_playlist.m3u8",
    "/media/local/foto.jpg",
  ]) {
    assert.equal(firma(path), null, `non si firmava «${path}»`);
  }
});

/* ─── 5. Gli elenchi e le scritture strane ──────────────────────────────── */

test("in un elenco ogni messaggio passa la sua dogana, e i comandi del ponte non passano", () => {
  const elenco = JSON.stringify([
    { id: 1, type: "get_states" },
    { id: 2, type: "execute_script", sequence: [] },
    servizio("shell_command", "x"),
    { id: 4, type: "ponte/plance/aggiungi" },
    { id: 5, type: "dashboardmodern/config/set" },
    servizio("light", "turn_on"),
  ]);
  const { passa, rifiuti } = passaLaDogana(elenco, NON_AMMINISTRA);
  assert.deepEqual(
    passa.map((uno) => JSON.parse(uno).id),
    [1, 1],
  );
  assert.deepEqual(rifiuti.map((uno) => uno.id).sort(), [1, 2, 4, 5].sort());
  for (const uno of rifiuti) assert.equal(uno.success, false);
});

test("spazi, maiuscole e chiavi doppie non cambiano il comando", () => {
  /* Spazi intorno: il controllo guarda il tipo ripulito. */
  assert.notEqual(no({ id: 1, type: " execute_script " }), null);
  assert.notEqual(no({ id: 1, type: "\texecute_script" }), null);
  /* In maiuscolo Home Assistant non lo riconosce, e chi non amministra non
   * lo manda nemmeno: fuori dall'elenco di chi non amministra, e' un no. */
  assert.notEqual(no({ id: 1, type: "EXECUTE_SCRIPT" }), null);
  /* Una chiave scritta due volte: vince l'ultima, qui come in Home
   * Assistant (orjson e json di Python fanno lo stesso), quindi si guarda
   * quella che arrivera'. */
  const doppio = '{"id":1,"type":"get_states","type":"execute_script"}';
  assert.equal(passaLaDogana(doppio, NON_AMMINISTRA).passa.length, 0);
  /* Un messaggio che non e' un oggetto non passa e non fa cadere niente. */
  for (const strano of ["null", "1", '"ciao"', "[]", "{", "[null]"]) {
    assert.doesNotThrow(() => passaLaDogana(strano, NON_AMMINISTRA));
    assert.equal(passaLaDogana(strano, NON_AMMINISTRA).passa.length, 0, strano);
  }
  /* L'autenticazione la fa il ponte: un «auth» sul filo non va a Home
   * Assistant per nessuno. */
  const auth = JSON.stringify({ type: "auth", access_token: "x" });
  assert.equal(passaLaDogana(auth, AMMINISTRA).passa.length, 0);
});

/* ─── 6. La strada REST ─────────────────────────────────────────────────── */

test("REST: le vie del Supervisor, dei backup e delle credenziali sono chiuse a tutti", () => {
  for (const amministra of [false, true]) {
    for (const percorso of [
      "/api/hassio/addons/core_ssh/info",
      "/api/hassio/host/reboot",
      "/api/hassio_ingress/abc/",
      "/api/hassio_auth",
      "/api/supervisor/info",
      "/api/auth/token",
      "/api/config/auth/list",
      "/api/backup/download/x",
      "/api/websocket",
    ]) {
      for (const metodo of ["GET", "POST"]) {
        assert.notEqual(
          perLaVia({ metodo, percorso, amministra }),
          null,
          `${metodo} ${percorso} passava (amministra: ${amministra})`,
        );
      }
    }
  }
});

test("REST: automazioni, script, scene e integrazioni non si scrivono dal filo, nemmeno da chi amministra", () => {
  for (const amministra of [false, true]) {
    for (const [metodo, percorso] of [
      ["POST", "/api/config/automation/config/abc"],
      ["DELETE", "/api/config/automation/config/abc"],
      ["POST", "/api/config/script/config/abc"],
      ["POST", "/api/config/scene/config/abc"],
      ["POST", "/api/config/config_entries/flow"],
      ["POST", "/api/config/config_entries/options/flow"],
    ]) {
      assert.notEqual(perLaVia({ metodo, percorso, amministra }), null, `${metodo} ${percorso}`);
    }
  }
});

test("REST: quello che e' da amministratore resta chiuso a chi non amministra", () => {
  for (const [metodo, percorso] of [
    ["GET", "/api/config/core/check_config"],
    ["GET", "/api/config/config_entries/entry"],
    ["GET", "/api/error_log"],
    ["GET", "/api/diagnostics/config_entry/abc"],
    ["GET", "/api/logbook"],
    ["GET", "/api/events"],
    ["POST", "/api/events/qualunque"],
    ["POST", "/api/template"],
    ["POST", "/api/states/light.sala"],
    ["DELETE", "/api/states/light.sala"],
    ["POST", "/api/services/shell_command/x"],
    ["POST", "/api/services/homeassistant/restart"],
    ["POST", "/api/services/automation/reload"],
    ["POST", "/api/services/scene/create"],
    ["POST", "/api/services/update/install"],
    ["POST", "/api/services/mqtt/publish"],
    ["POST", "/api/intent/handle"],
    ["POST", "/api/conversation/process"],
    ["POST", "/api/file_upload"],
    ["POST", "/api/media_source/local_source/upload"],
    /* Le viste da amministratore di Home Assistant che si leggono con un GET:
     * qui il segno e' del Supervisor, e Home Assistant le darebbe. */
    ["GET", "/api/zwave_js/dump/abc"],
    ["GET", "/api/cloud/account"],
    ["GET", "/api/cloud/status"],
    ["GET", "/api/insteon/properties/abc"],
  ]) {
    assert.notEqual(perLaVia({ metodo, percorso }), null, `${metodo} ${percorso} passava`);
  }
});

test("REST: le strade storte verso il Supervisor non passano", () => {
  for (const percorso of [
    "/api/%68assio/addons",
    "/api/hassio%2faddons",
    "/api//hassio/addons",
    "/api/./hassio/addons",
    "/api/states/../hassio/addons",
    "/api/states/%2e%2e/hassio",
    "/api/states/%252e%252e/hassio",
    "/api/states\\..\\hassio",
    "/API/HASSIO/addons",
    "/api/Hassio/addons",
    "/api/hassio/addons/../../states",
    "/api/states\u0000/hassio",
    "/api/states#/../hassio",
    "api/hassio",
    "",
  ]) {
    for (const amministra of [false, true]) {
      assert.notEqual(
        perLaVia({ metodo: "GET", percorso, amministra }),
        null,
        `«${percorso}» passava (amministra: ${amministra})`,
      );
    }
  }
});

/* ─── 7. E quello che serve, passa ──────────────────────────────────────── */

test("quello che l'app e la plancia usano passa a chi non amministra", () => {
  for (const detto of [
    { id: 1, type: "get_states" },
    { id: 1, type: "get_config" },
    { id: 1, type: "get_services" },
    { id: 1, type: "subscribe_entities" },
    { id: 1, type: "subscribe_events", event_type: "state_changed" },
    { id: 1, type: "config/entity_registry/list_for_display" },
    { id: 1, type: "config/area_registry/list" },
    { id: 1, type: "history/history_during_period" },
    { id: 1, type: "recorder/statistics_during_period" },
    { id: 1, type: "camera/stream", entity_id: "camera.ingresso" },
    { id: 1, type: "media_player/browse_media", entity_id: "media_player.sala" },
    { id: 1, type: "calendar/event/create" },
    { id: 1, type: "todo/item/list" },
    { id: 1, type: "conversation/process", text: "accendi la luce" },
    { id: 1, type: "lovelace/config" },
    servizio("light", "turn_on"),
    servizio("cover", "open_cover"),
    servizio("climate", "set_temperature"),
    servizio("lock", "unlock"),
    servizio("alarm_control_panel", "alarm_disarm"),
    servizio("script", "turn_on"),
    servizio("script", "notte"),
    servizio("automation", "trigger"),
    servizio("scene", "turn_on"),
    servizio("media_player", "play_media"),
    servizio("homeassistant", "toggle"),
    servizio("homeassistant", "update_entity"),
    servizio("notify", "mobile_app_telefono"),
    servizio("camera", "turn_on"),
  ]) {
    assert.equal(no(detto), null, `${detto.type} ${detto.domain || ""}.${detto.service || ""}`);
  }
  for (const [metodo, percorso] of [
    ["GET", "/api/states"],
    ["GET", "/api/states/light.sala"],
    ["GET", "/api/config"],
    ["GET", "/api/history/period/2026-10-01T00:00:00Z?filter_entity_id=sensor.x"],
    ["GET", "/api/camera_proxy/camera.ingresso?token=abc"],
    ["GET", "/api/calendars/calendar.casa?start=a&end=b"],
    ["GET", "/api/image/serve/abc/512x512"],
    ["GET", "/api/media_player_proxy/media_player.sala"],
    ["GET", "/api/hassio/addons/core_ssh/icon"],
    ["POST", "/api/image/upload"],
    ["POST", "/api/services/light/turn_on"],
  ]) {
    assert.equal(perLaVia({ metodo, percorso }), null, `${metodo} ${percorso}`);
  }
});
