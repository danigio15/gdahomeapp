/* La dogana: quello che un telefono o una pagina possono chiedere a Home
 * Assistant passando dal ponte.
 *
 * Il filo che il ponte apre verso Home Assistant e' aperto col segno del
 * Supervisor, e per Home Assistant quel segno e' un amministratore. Finche' il
 * ponte girava i messaggi senza guardarli, chiunque stesse dall'altra parte —
 * un telefono intestato a un bambino, una pagina della plancia aperta da un
 * ospite — parlava con Home Assistant **con i poteri dell'add-on**: poteva
 * farsi un gettone lungo, leggere e cambiare gli utenti, chiedere al
 * Supervisor quello che al Supervisor si chiede. Il limite non stava in quello
 * che chiedeva, stava nella sua buona volonta'.
 *
 * Qui il limite si scrive. Tre regole, in quest'ordine:
 *
 *  1. **Quello che non passa per nessuno**, nemmeno per chi amministra: un
 *     telefono si perde, e un telefono perso non deve essere una chiave della
 *     macchina, ne' una chiave di Home Assistant per conto di qualcun altro.
 *     Non lo usano ne' l'app ne' la plancia, e chi lo vuole ce l'ha dentro
 *     Home Assistant, con la sua utenza. Sono:
 *      - le credenziali: fabbricare o buttare gettoni, gli utenti e le loro
 *        password;
 *      - il Supervisor e i backup, per nessuna delle loro strade
 *        (`supervisor/`, `hassio/`, `backup/`, `/api/hassio…`,
 *        `/api/backup…`, e i servizi qui sotto);
 *      - i servizi che eseguono comandi sulla macchina o parlano al
 *        Supervisor (`hassio`, `backup`, `shell_command`, `python_script`,
 *        `pyscript`, `command_line`), e `homeassistant.stop`. Riavviare la
 *        casa si puo' — e' un tasto dell'app — ma spegnerla no: con il
 *        Supervisor resta giu' finche' qualcuno non la riaccende dalla
 *        macchina, e dall'app non si riaccende;
 *      - **scrivere quello che poi gira da solo**, che e' la strada lunga per
 *        arrivare agli stessi posti. Le automazioni, gli script e le scene
 *        (REST `/api/config/{automation,script,scene}/…`, tutto tranne
 *        leggerli) e i blueprint su cui si reggono girano come Home
 *        Assistant, e il controllo sui servizi qui sotto non li vede mai:
 *        un'automazione scritta con dentro `hassio.addon_stdin` e fatta
 *        partire con `automation.trigger` passerebbe tutto quello che qui si
 *        ferma. Per lo stesso motivo non passa un copione scritto al momento
 *        (`execute_script`). Le risorse e le configurazioni delle dashboard di
 *        Home Assistant (`lovelace/resources/*`, `lovelace/config/save` e
 *        `/delete`) sono programmi che girano nel browser di chiunque apra
 *        Home Assistant, anche di chi lo amministra davvero; i pacchetti di
 *        HACS (`hacs/…`) sono codice che Home Assistant esegue al prossimo
 *        avvio; e un'integrazione nuova o riconfigurata
 *        (`/api/config/config_entries/…/flow`) e' un pezzo di casa che si
 *        mette su senza che nessuno lo veda.
 *  2. **Chi amministra** — o un telefono abbinato prima che i telefoni si
 *     intestassero a qualcuno, che fino a oggi era trattato cosi' — passa con
 *     tutto il resto, com'era.
 *  3. **Chi non amministra** passa solo con quello che l'app e la plancia
 *     usano davvero per guardare e usare la casa: gli stati, i servizi, lo
 *     storico, le telecamere, i registri in lettura. E' un elenco e non un
 *     divieto: un comando nuovo di Home Assistant resta fuori finche' qualcuno
 *     non decide che puo' entrare.
 *
 * ─── Quello che chi amministra usa davvero, e che deve passare ───────────
 *
 * La regola 1 si e' scritta dopo aver cercato cosa mandano per davvero l'app
 * (`app/lib`), la plancia (`ponte/plancia/src` e `legacy/`) e il ponte
 * stesso: un divieto che rompe un tasto e' un divieto che prima o poi
 * qualcuno toglie. Di qui, da chi amministra, passano:
 *
 *  - le letture: `get_states`, `get_config`, `get_services`, `get_panels`,
 *    `subscribe_events` e `subscribe_entities`, i registri
 *    (`config/*_registry/list`), lo storico e le statistiche, le telecamere
 *    (`camera/*`), i media, `frontend/get_user_data`;
 *  - dalla plancia, `frontend/set_user_data` e il calendario
 *    (`calendar/event/*`);
 *  - `call_service` sui domini delle cose di casa, preso dall'entita' che si
 *    tocca — anche `scene.turn_on`, `script.turn_on`,
 *    `homeassistant.turn_on/turn_off/toggle` — e `update.install`, che la
 *    tessera degli aggiornamenti della plancia preme da se';
 *  - `auth/sign_path` sulle vie delle telecamere (anche `/api/webrtc/ws`),
 *    delle immagini e del calendario;
 *  - REST, da `ponte/http`: `/api/camera_proxy/` e `/api/camera_proxy_stream/`,
 *    `/api/calendars/`, `/api/image/serve/`, `POST /api/image/upload`,
 *    `/api/history/period/`.
 *
 * Altre cose da amministratore non passano di qui, perche' le fa il ponte coi
 * suoi comandi e sul filo suo, con le sue regole su chi amministra
 * (`commissioni.js`, `SOLO_CHI_AMMINISTRA`): il riavvio di Home Assistant e
 * l'installazione di un aggiornamento dall'app (`ponte/aggiornamenti/*`), la
 * rete Zigbee (`ponte/zigbee/*`), le plance e la loro configurazione
 * (`ponte/plance/*`, `dashboardmodern/config/*`), e le voci fra le «Plance» di
 * Home Assistant con la loro risorsa e la loro configurazione, che scrive
 * `plance-in-casa.js`. Nessun pezzo dell'app o della plancia scrive di qui
 * automazioni, script, scene, blueprint, risorse o configurazioni delle
 * dashboard di Home Assistant, ne' aggiunge integrazioni o tocca HACS; e
 * nessuno cambia di qui i registri o le preferenze dell'energia, che pero'
 * restano a chi amministra perche' non fanno girare niente.
 * `homeassistant.restart` diretto resta anche lui: e' lo stesso potere del
 * tasto dell'app.
 *
 * Un no si dice come lo direbbe Home Assistant — `{id, type: "result",
 * success: false, error}` — cosi' chi ha chiesto riceve una risposta e non
 * resta ad aspettare per sempre.
 */

/* ─── Chi non passa mai ────────────────────────────────────────────────── */

/* I comandi che non passano per nessuno. Un prefisso finisce con `/`. */
const MAI = Object.freeze([
  /* Le credenziali: fabbricarle, buttarle, elencarle. */
  "auth/long_lived_access_token",
  "auth/delete_refresh_token",
  "auth/delete_all_refresh_tokens",
  "auth/refresh_tokens",
  "auth/refresh_token_set_expiry",
  "config/auth/",
  "config/auth_provider_homeassistant/",
  "application_credentials/",
  /* Il Supervisor e i backup, per nessuna strada. */
  "supervisor/",
  "hassio/",
  "backup/",
  /* Un copione scritto al momento: puo' chiamare qualunque servizio, cioe'
   * anche quelli qui sotto. */
  "execute_script",
  /* I programmi delle pagine di Home Assistant. Una risorsa e' un file
   * JavaScript che il browser di chiunque apra Home Assistant carica ed
   * esegue con la sua sessione — anche quello di chi lo amministra davvero,
   * che da li' puo' tutto, Supervisor compreso. La configurazione di una
   * dashboard fa lo stesso dove c'e' una scheda che esegue quello che ha
   * scritto dentro (una `custom:button-card` coi suoi `[[[ … ]]]`). Leggerle
   * resta per tutti; scriverle no. */
  "lovelace/resources/create",
  "lovelace/resources/update",
  "lovelace/resources/delete",
  "lovelace/config/save",
  "lovelace/config/delete",
  /* I blueprint: sono il corpo delle automazioni che li usano, e
   * riscriverne uno vuol dire riscrivere quelle automazioni senza passare
   * dalla porta REST, che qui sotto e' chiusa. Leggerli resta. */
  "blueprint/save",
  "blueprint/import",
  "blueprint/delete",
  /* HACS scarica e installa codice che Home Assistant esegue al prossimo
   * avvio, e il riavvio un telefono di chi amministra lo sa chiedere. */
  "hacs/",
]);

/* Di `auth/…` passa una cosa sola: la firma di un indirizzo, che serve alle
 * telecamere e al calendario. Tutto il resto di quella famiglia e' roba di
 * credenziali. */
const DI_AUTH_PASSA = new Set(["auth/sign_path"]);

/* I servizi che eseguono qualcosa sulla macchina, o parlano al Supervisor.
 *
 * `backup` e' l'integrazione dei backup di Home Assistant: su una casa col
 * Supervisor i backup li fa per mano sua, ed e' l'altra strada per arrivare
 * dove `hassio.backup_full` e `backup/` non arrivano. Nessun pezzo dell'app o
 * della plancia la chiama. */
const DOMINI_MAI = new Set([
  "hassio",
  "backup",
  "shell_command",
  "python_script",
  "pyscript",
  "command_line",
]);

/* E uno solo, per nome, di un dominio che per il resto passa: spegnere Home
 * Assistant. `homeassistant.restart` invece resta a chi amministra — l'app ha
 * il suo tasto per riavviare, e la casa torna da sola — mentre una casa
 * spenta col Supervisor resta spenta finche' qualcuno non la riaccende dalla
 * macchina, e dall'app non si riaccende. */
const SERVIZI_MAI = new Set(["homeassistant.stop"]);

/* ─── Chi non amministra ───────────────────────────────────────────────── */

/* Quello che usano l'app e la plancia: la lista si e' fatta cercando i
 * comandi che mandano davvero (`app/lib`, `ponte/plancia`), e tenendo solo
 * quelli che leggono o usano la casa. */
const PER_TUTTI = new Set([
  "ping",
  "supported_features",
  "get_states",
  "get_config",
  "get_services",
  "get_panels",
  "call_service",
  "subscribe_events",
  "unsubscribe_events",
  "subscribe_entities",
  "config/area_registry/list",
  "config/floor_registry/list",
  "config/device_registry/list",
  "config/entity_registry/list",
  "config/entity_registry/list_for_display",
  "config/label_registry/list",
  "history/history_during_period",
  "history/stream",
  "recorder/statistics_during_period",
  "recorder/list_statistic_ids",
  "recorder/get_statistics_metadata",
  "camera/stream",
  "camera/capabilities",
  "camera_thumbnail",
  "camera/webrtc/offer",
  "camera/webrtc/candidate",
  "camera/webrtc/get_client_config",
  "camera/web_rtc_offer",
  "media_source/browse_media",
  "media_source/resolve_media",
  /* Cosa ha da offrire un lettore: le playlist di Music Assistant, le stazioni
   * di Sonos. E' la domanda che la scheda Musica manda per far scegliere cosa
   * suonare; senza, da dentro il pannello e da Nabu Casa la finestra si
   * aprirebbe su «Message type not permitted through the bridge». Legge e non
   * cambia niente, come le altre di questo elenco: quello che poi si suona
   * passa per «call_service», che qui c'e' gia'. */
  "media_player/browse_media",
  "frontend/get_user_data",
  "frontend/set_user_data",
  "frontend/get_translations",
  "frontend/get_themes",
  "frontend/get_icons",
  "lovelace/config",
  "lovelace/resources",
  "lovelace/dashboards/list",
  "calendar/event/create",
  "calendar/event/update",
  "calendar/event/delete",
  "conversation/process",
  "conversation/agent/info",
  "weather/subscribe_forecast",
  "todo/item/list",
  "todo/item/subscribe",
  "energy/get_prefs",
  "energy/info",
  "auth/sign_path",
]);

/* I comandi della plancia che, senza il ponte, faceva l'integrazione: sono
 * suoi, e se arrivano fin qui li riceve lei. */
const DELLA_PLANCIA = "dashboardmodern/";

/* Gli eventi che si possono ascoltare senza amministrare: quelli che Home
 * Assistant stessa lascia a un utente qualunque, piu' quello della chat della
 * plancia. Tutti gli altri — e ascoltare «tutto» — raccontano della casa piu'
 * di quello che una plancia deve sapere. */
const EVENTI_PER_TUTTI = new Set([
  "state_changed",
  "themes_updated",
  "component_loaded",
  "core_config_updated",
  "panels_updated",
  "entity_registry_updated",
  "device_registry_updated",
  "area_registry_updated",
  "floor_registry_updated",
  "label_registry_updated",
  "persistent_notifications_updated",
  "lovelace_updated",
  "service_registered",
  "service_removed",
  "shopping_list_updated",
  "recorder_5min_statistics_generated",
  "dashboardmodern_chat",
]);

/* I servizi che chi non amministra puo' chiamare: un elenco di domini, non
 * un elenco di divieti.
 *
 * In Home Assistant un servizio «da amministratore» guarda chi lo chiama. Qui
 * chi lo chiama, per Home Assistant, e' sempre il Supervisor — cioe' un
 * amministratore — quindi quel controllo non scatta mai, e un elenco di
 * divieti sarebbe sempre un passo indietro rispetto ai domini che esistono.
 * Allora si dice cosa passa: i domini delle cose di casa — quelli che la
 * plancia e l'app chiamano, prendendo il dominio dall'entita' che toccano — e
 * per qualcuno solo i servizi che usano la casa e non la cambiano. `true`
 * vuol dire tutti i servizi del dominio (tranne i `reload`); un insieme vuol
 * dire solo quelli. */
const DOMINI_PER_TUTTI = new Map([
  ["light", true],
  ["switch", true],
  ["cover", true],
  ["climate", true],
  ["fan", true],
  ["lock", true],
  ["alarm_control_panel", true],
  ["media_player", true],
  ["vacuum", true],
  ["lawn_mower", true],
  ["valve", true],
  ["water_heater", true],
  ["humidifier", true],
  ["siren", true],
  ["button", true],
  ["input_boolean", true],
  ["input_number", true],
  ["input_select", true],
  ["input_text", true],
  ["input_datetime", true],
  ["input_button", true],
  ["number", true],
  ["select", true],
  ["text", true],
  ["date", true],
  ["time", true],
  ["datetime", true],
  ["scene", new Set(["turn_on"])],
  /* Gli script e le automazioni li ha scritti chi amministra: farli partire
   * e' usarli, riscriverli no. */
  ["script", true],
  ["automation", new Set(["trigger", "turn_on", "turn_off", "toggle"])],
  ["remote", true],
  /* Il telecomando di una TV LG (#132): webOS un'entita' `remote` non ce l'ha,
   * e i tasti li prende il televisore con `webostv.button` — la stessa cosa
   * che `remote.send_command` fa per le altre. `webostv.command` no: manda
   * alla TV qualunque richiesta del suo sistema, e quello e' per chi
   * amministra. */
  ["webostv", new Set(["button"])],
  /* La friggitrice Philips da HACS (#71): tasti non ne pubblica, e si comanda
   * solo coi suoi servizi. Passano quelli della cottura — fermarla, farla
   * ripartire, darle un minuto o cinque gradi in piu', accenderla e spegnerla —
   * che sono i tasti che ha sul davanti. */
  [
    "philips_airfryer",
    new Set([
      "pause",
      "start_resume",
      "stop",
      "adjust_time",
      "adjust_temp",
      "start_cooking",
      "toggle_airspeed",
      "turn_on",
      "turn_off",
    ]),
  ],
  ["timer", true],
  ["counter", true],
  ["todo", true],
  ["calendar", new Set(["get_events", "create_event"])],
  ["weather", new Set(["get_forecasts", "get_forecast"])],
  ["notify", true],
  ["persistent_notification", new Set(["create", "dismiss", "dismiss_all"])],
  ["conversation", new Set(["process"])],
  /* Di una telecamera si usa il flusso; salvare un'istantanea o registrare
   * scrive file sul disco di Home Assistant, e quello no. */
  [
    "camera",
    new Set([
      "turn_on",
      "turn_off",
      "enable_motion_detection",
      "disable_motion_detection",
      "play_stream",
    ]),
  ],
  /* Di `homeassistant` resta quello che una tessera fa: accendere, spegnere,
   * invertire, ridomandare lo stato. */
  ["homeassistant", new Set(["turn_on", "turn_off", "toggle", "update_entity"])],
]);

/* ─── Le firme degli indirizzi ─────────────────────────────────────────── */

/* Quali indirizzi si possono firmare. Una firma vale come il segno che l'ha
 * fatta — quello del Supervisor — per un indirizzo solo: un indirizzo
 * qualunque firmato sarebbe una porta aperta su quella strada, per chiunque
 * abbia il link. Si firmano le telecamere, le immagini e il calendario, che
 * sono quello che la plancia chiede. */
const FIRMABILI = Object.freeze([
  "/api/camera_proxy/",
  "/api/camera_proxy_stream/",
  "/api/image_proxy/",
  "/api/image/serve/",
  "/api/media_player_proxy/",
  "/api/calendars/",
  "/api/webrtc/ws",
  "/api/tts_proxy/",
  "/api/hls/",
  "/media/",
]);

/* ─── Le domande ───────────────────────────────────────────────────────── */

const cominciaCon = (tipo, elenco) =>
  elenco.some((uno) => (uno.endsWith("/") ? tipo.startsWith(uno) : tipo === uno));

/* Un percorso senza trucchi: nessun `..`, nessuna barra rovescia, nessuna
 * barra o punto scritti in percentuale — sciogliendo le percentuali quante
 * volte servono, perche' chi le scrive due volte spera che se ne sciolga una
 * sola. `true` se va bene.
 *
 * Si guarda il percorso e non la domanda che viene dopo il `?`: li' una barra
 * in percentuale e' un valore come un altro — il nome di un flusso, una data —
 * e non cambia la strada. */
export function percorsoSenzaTrucchi(percorso) {
  if (typeof percorso !== "string" || !percorso.startsWith("/")) return false;
  if (/[\u0000-\u001f\u007f#]/.test(percorso)) return false;
  let adesso = percorso.split("?")[0];
  for (let giri = 0; giri < 5; giri += 1) {
    if (/%(?:2e|2f|5c)/i.test(adesso)) return false;
    if (adesso.includes("\\") || /(^|\/)\.\.?(\/|$)/.test(adesso)) return false;
    if (/[\u0000-\u001f\u007f]/.test(adesso)) return false;
    let sciolto;
    try {
      sciolto = decodeURIComponent(adesso);
    } catch (_errore) {
      return false;
    }
    if (sciolto === adesso) return true;
    adesso = sciolto;
  }
  return false;
}

/* Il servizio che si vuole chiamare: `null` se va bene, se no il perche'. */
export function servizioVietato(dominio, servizio, { amministra = false } = {}) {
  const suo = String(dominio || "")
    .trim()
    .toLowerCase();
  const quale = String(servizio || "")
    .trim()
    .toLowerCase();
  /* Senza dominio o servizio, Home Assistant risponde di no da se'; ma chi
   * non amministra non gli fa nemmeno la domanda. */
  if (!suo || !quale) return amministra ? null : "servizio non valido";
  if (DOMINI_MAI.has(suo)) return `i servizi di ${suo} non passano dal ponte`;
  if (SERVIZI_MAI.has(`${suo}.${quale}`)) return `${suo}.${quale} non passa dal ponte`;
  if (amministra) return null;
  const permessi = DOMINI_PER_TUTTI.get(suo);
  const passa =
    (permessi === true && quale !== "reload" && !quale.startsWith("reload_")) ||
    (permessi instanceof Set && permessi.has(quale));
  return passa ? null : `${suo}.${quale} e' per chi amministra la casa`;
}

/**
 * Un messaggio per Home Assistant: passa?
 *
 * Torna `null` se passa, o il perche' di un no.
 *
 * @param {object} detto il messaggio, gia' letto
 * @param {{amministra: boolean}} chi `amministra` vale solo se e' `true`
 */
export function perche(detto, { amministra = false } = {}) {
  const admin = amministra === true;
  if (!detto || typeof detto !== "object" || Array.isArray(detto)) return "messaggio non valido";
  const tipo = typeof detto.type === "string" ? detto.type.trim() : "";
  if (!tipo) return "messaggio senza tipo";

  if (cominciaCon(tipo, MAI)) return `${tipo} non passa dal ponte`;
  /* I comandi del ponte non vanno mai a Home Assistant: se arrivano fin qui
   * nessuno li ha riconosciuti — per esempio perche' viaggiavano dentro un
   * elenco — e girarli vorrebbe dire saltare le regole di chi li fa. */
  if (tipo.startsWith("ponte/")) return `${tipo} non passa di qui`;
  if (tipo.startsWith("auth/") && !DI_AUTH_PASSA.has(tipo)) return `${tipo} non passa dal ponte`;

  if (tipo === "call_service") {
    const no = servizioVietato(detto.domain, detto.service, { amministra: admin });
    if (no) return no;
  }
  if (tipo === "auth/sign_path") {
    const via = typeof detto.path === "string" ? detto.path : "";
    if (!percorsoSenzaTrucchi(via) || !FIRMABILI.some((uno) => via.startsWith(uno)))
      return "questo indirizzo non si firma";
  }

  if (admin) return null;

  /* I comandi della plancia li fa il ponte (`commissioni.js`), con le sue
   * regole su chi puo' cosa. Uno che arriva fin qui non l'ha preso lui, e a
   * Home Assistant — dove un'integrazione lo eseguirebbe come se l'avesse
   * chiesto il Supervisor — non va. */
  if (tipo.startsWith(DELLA_PLANCIA)) return `${tipo} e' per chi amministra la casa`;
  if (!PER_TUTTI.has(tipo)) return `${tipo} e' per chi amministra la casa`;
  if (tipo === "subscribe_events" && !EVENTI_PER_TUTTI.has(String(detto.event_type || "")))
    return "quell'evento e' per chi amministra la casa";
  return null;
}

/* La risposta di un no, nella forma di Home Assistant. */
export function unNo(id, messaggio) {
  return {
    id: id ?? null,
    type: "result",
    success: false,
    error: { code: "unauthorized", message: String(messaggio || "non permesso") },
  };
}

/**
 * Un testo arrivato dal client, passato alla dogana.
 *
 * Torna `{passa, rifiuti}`: `passa` e' l'elenco dei testi da girare a Home
 * Assistant (vuoto se non passa niente), `rifiuti` le risposte da rimandare a
 * chi ha chiesto. Home Assistant accetta anche piu' messaggi in un elenco
 * solo: si guardano uno per uno, e passano da soli quelli buoni.
 *
 * Un `auth` si lascia cadere senza risposta: il filo e' gia' autenticato, e
 * rispondergli «no» chiuderebbe una pagina che va bene.
 *
 * @param {string} testo
 * @param {{amministra: boolean}} chi
 */
export function passaLaDogana(testo, { amministra = false } = {}) {
  let letto;
  try {
    letto = JSON.parse(testo);
  } catch (_errore) {
    return { passa: [], rifiuti: [] };
  }
  const elenco = Array.isArray(letto) ? letto : [letto];
  const passa = [];
  const rifiuti = [];
  for (const uno of elenco) {
    if (uno && typeof uno === "object" && uno.type === "auth") continue;
    /* In un elenco un comando della plancia o del ponte non e' passato dal
     * ponte, che li riconosce uno per uno: non va a Home Assistant per
     * nessuno. */
    const tipo = typeof uno?.type === "string" ? uno.type : "";
    const no =
      Array.isArray(letto) && (tipo.startsWith(DELLA_PLANCIA) || tipo.startsWith("ponte/"))
        ? `${tipo} non passa dentro un elenco`
        : perche(uno, { amministra });
    if (no) {
      const id = uno && typeof uno === "object" ? (uno.id ?? null) : null;
      rifiuti.push(unNo(id, no));
      continue;
    }
    passa.push(Array.isArray(letto) ? JSON.stringify(uno) : testo);
  }
  return { passa, rifiuti };
}

/* ─── La strada REST ───────────────────────────────────────────────────── */

/* Le vie REST di Home Assistant che non passano per nessuno. */
const VIE_MAI = Object.freeze([
  "/api/hassio",
  "/api/supervisor",
  "/api/auth",
  "/api/config/auth",
  "/api/backup",
  "/api/websocket",
]);

/* Quelle che si leggono e basta, anche per chi amministra: scriverci vuol
 * dire mettere in casa qualcosa che poi gira da solo con i poteri di Home
 * Assistant (vedi la regola 1 in cima). Un'automazione, uno script o una
 * scena si scrivono qui, con `POST` o `DELETE`; un'integrazione si aggiunge o
 * si riconfigura con i giri di domande dei `flow`. */
const VIE_DA_NON_SCRIVERE = Object.freeze([
  "/api/config/automation",
  "/api/config/script",
  "/api/config/scene",
  "/api/config/config_entries/flow",
  "/api/config/config_entries/options/flow",
  "/api/config/config_entries/subentries/flow",
]);

/* Quelle da amministratore, per chi non lo e'. */
const VIE_DI_CHI_AMMINISTRA = Object.freeze([
  "/api/config/",
  "/api/error_log",
  "/api/template",
  "/api/diagnostics",
  "/api/logbook",
  "/api/events",
  "/api/states",
]);

const ICONA_DI_UN_ADDON = /^\/api\/hassio\/addons\/[A-Za-z0-9_-]+\/(?:icon|logo)$/;

/* Le vie che si possono **scrivere** anche senza amministrare. */
const SCRIVIBILI_PER_TUTTI = Object.freeze(["/api/image/upload"]);

const sottoLaVia = (percorso, via) =>
  percorso === via || percorso.startsWith(`${via}/`) || percorso.startsWith(`${via}?`);

/**
 * Una richiesta REST verso Home Assistant, col segno del Supervisor: passa?
 *
 * Torna `null` se passa, o il perche' di un no. Il percorso e' quello dopo
 * l'indirizzo di Home Assistant, e comincia per `/api/`.
 */
export function perLaVia({ metodo = "GET", percorso = "", amministra = false } = {}) {
  const admin = amministra === true;
  if (!percorsoSenzaTrucchi(percorso)) return "percorso non valido";
  const grezza = percorso.split("?")[0];
  /* Nessuna percentuale e nessuna barra doppia nel percorso di una via REST.
   * Home Assistant le scioglie prima di decidere dove andare, e allora i
   * controlli qui sotto — fatti sulle lettere — guarderebbero una strada e la
   * richiesta ne farebbe un'altra. L'app e la plancia queste vie le chiedono
   * gia' sciolte; la parte dopo il `?` resta com'e'. */
  if (grezza.includes("%") || grezza.includes("//")) return "percorso non valido";
  const via = grezza.replace(/\/+$/, "").toLowerCase() || "/";
  const verbo = String(metodo || "GET").toUpperCase();
  /* L'icona di un add-on e' l'unica cosa del Supervisor che passa: e' un
   * disegno, Home Assistant la mostra a chiunque sia entrato, e la chiede
   * l'elenco degli aggiornamenti. */
  if (verbo === "GET" && ICONA_DI_UN_ADDON.test(via)) return null;
  /* Qui basta che cominci cosi': `/api/hassio_ingress/…` e' Supervisor
   * quanto `/api/hassio/…`. */
  if (VIE_MAI.some((una) => via.startsWith(una))) return `${via} non passa dal ponte`;
  const servizio = /^\/api\/services\/([^/]+)\/([^/]+)$/.exec(via);
  if (servizio) {
    const no = servizioVietato(servizio[1], servizio[2], { amministra: admin });
    if (no) return no;
  }
  if (verbo !== "GET" && VIE_DA_NON_SCRIVERE.some((una) => sottoLaVia(via, una)))
    return `${verbo} ${via} non passa dal ponte`;
  if (admin) return null;
  /* `GET /api/states` e `/api/config` da soli sono letture che un utente
   * qualunque fa; scriverli, o entrare sotto `/api/config/`, no. */
  if (verbo === "GET" && (via === "/api/states" || via.startsWith("/api/states/"))) return null;
  if (VIE_DI_CHI_AMMINISTRA.some((una) => sottoLaVia(via, una) || via.startsWith(una)))
    return `${via} e' per chi amministra la casa`;
  if (verbo === "GET") return null;
  if (servizio) return null;
  if (SCRIVIBILI_PER_TUTTI.some((una) => sottoLaVia(via, una))) return null;
  return `${verbo} ${via} e' per chi amministra la casa`;
}
