/* I servizi e gli stati di Home Assistant, detti in parole.
 *
 * «chiama climate.set_temperature su Termostato» e «Antifurto diventa
 * «triggered»» sono la lingua di Home Assistant, non quella di chi abita: qui
 * diventano «imposta Termostato soggiorno a 21°» e «Antifurto scatta». Lo
 * usano la plancia (la riga di un'automazione, il foglio, la frase
 * dell'editor) e il ponte (il riassunto di una complessa,
 * `ponte/src/riassunto-delle-automazioni.js`), cosi' le due parlano uguale.
 *
 * E' puro: riceve il servizio, i nomi gia' detti e i dati, e torna `{it, en}`.
 * Un servizio che non conosce si dice con le sue parole («esegue backup
 * create»), mai coi punti e coi trattini bassi, e mai con un entity_id: chi
 * chiama passa i nomi, e se un nome manca usa `nomeDaId`.
 */

const pulito = (x) => (x === undefined || x === null ? "" : String(x).trim());

/**
 * Un id che nessuno sa leggere: quello di un dispositivo o di una voce del
 * registro delle entita' (trentadue cifre esadecimali, «eddd506f61c3e0…»), o
 * un UUID. Un'automazione fatta col «Dispositivo» di Home Assistant li porta
 * al posto degli entity_id, e a chi abita non dicono niente.
 */
export function eUnIdCrudo(id) {
  const s = pulito(id);
  return /^[0-9a-f]{16,}$/i.test(s) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-/i.test(s);
}

/** «light.cabina_armadio» → «cabina armadio»: mai l'id cosi' com'e'. Un id crudo → «». */
export function nomeDaId(id) {
  if (eUnIdCrudo(id)) return "";
  const resto = pulito(id).split(".").slice(1).join(".") || pulito(id);
  return resto.replace(/[._]+/g, " ").replace(/\s+/g, " ").trim();
}

/** «backup.create» → «backup create». */
export const inParole = (x) => pulito(x).replace(/[._]+/g, " ").replace(/\s+/g, " ").trim();

/* Una frase senza spazi doppi, anche quando manca il nome. */
const frase = (x) => String(x).replace(/\s+/g, " ").trim();
const coppia = (it, en) => ({ it: frase(it), en: frase(en) });

/* Gli stati, come aggettivi: «Antifurto è disinserito». */
const STATI = {
  on: ["acceso", "on"],
  off: ["spento", "off"],
  open: ["aperto", "open"],
  opening: ["in apertura", "opening"],
  closed: ["chiuso", "closed"],
  closing: ["in chiusura", "closing"],
  home: ["a casa", "home"],
  not_home: ["fuori casa", "away"],
  triggered: ["scattato", "triggered"],
  armed_away: ["inserito (fuori casa)", "armed (away)"],
  armed_home: ["inserito (in casa)", "armed (home)"],
  armed_night: ["inserito (notte)", "armed (night)"],
  armed_vacation: ["inserito (vacanza)", "armed (vacation)"],
  armed_custom_bypass: ["inserito", "armed"],
  arming: ["in inserimento", "arming"],
  pending: ["in attesa", "pending"],
  disarmed: ["disinserito", "disarmed"],
  locked: ["chiuso a chiave", "locked"],
  unlocked: ["aperto", "unlocked"],
  jammed: ["bloccato", "jammed"],
  playing: ["in riproduzione", "playing"],
  paused: ["in pausa", "paused"],
  idle: ["fermo", "idle"],
  standby: ["in attesa", "standby"],
  cleaning: ["in pulizia", "cleaning"],
  docked: ["alla base", "docked"],
  returning: ["di ritorno alla base", "returning to base"],
  heat: ["in riscaldamento", "heating"],
  cool: ["in raffrescamento", "cooling"],
  heat_cool: ["in automatico", "on auto"],
  auto: ["in automatico", "on auto"],
  dry: ["in deumidificazione", "drying"],
  fan_only: ["in ventilazione", "fan only"],
  below_horizon: ["sotto l'orizzonte", "below the horizon"],
  above_horizon: ["sopra l'orizzonte", "above the horizon"],
  unavailable: ["non disponibile", "unavailable"],
  unknown: ["sconosciuto", "unknown"],
};

/** Uno stato come aggettivo, `{it, en}`: «disinserito», «a casa». */
export function statoInParole(stato) {
  const s = pulito(stato);
  const noto = STATI[s.toLowerCase()];
  if (noto) return coppia(noto[0], noto[1]);
  /* Un numero o un valore suo resta com'e', senza trattini bassi. */
  const detto = inParole(s);
  return coppia(detto, detto);
}

/* Cosa fa una cosa quando arriva in uno stato: «scatta», «si apre». */
const DIVENTA = {
  on: ["si accende", "turns on"],
  off: ["si spegne", "turns off"],
  open: ["si apre", "opens"],
  closed: ["si chiude", "closes"],
  home: ["arriva a casa", "gets home"],
  not_home: ["esce di casa", "leaves home"],
  triggered: ["scatta", "goes off"],
  armed_away: ["si inserisce (fuori casa)", "is armed (away)"],
  armed_home: ["si inserisce (in casa)", "is armed (home)"],
  armed_night: ["si inserisce (notte)", "is armed (night)"],
  armed_vacation: ["si inserisce (vacanza)", "is armed (vacation)"],
  disarmed: ["si disinserisce", "is disarmed"],
  locked: ["si chiude a chiave", "locks"],
  unlocked: ["si apre", "unlocks"],
  playing: ["inizia a suonare", "starts playing"],
  paused: ["va in pausa", "pauses"],
  cleaning: ["inizia a pulire", "starts cleaning"],
  docked: ["torna alla base", "docks"],
  unavailable: ["non risponde più", "stops responding"],
  below_horizon: ["tramonta", "sets"],
  above_horizon: ["sorge", "rises"],
};

/** «Antifurto scatta», «Persona 1 esce di casa»: il soggetto e il verbo, `{it, en}`. */
export function diventaInParole(chi, stato) {
  const s = pulito(stato).toLowerCase();
  const noto = DIVENTA[s];
  if (noto) return coppia(`${chi} ${noto[0]}`.trim(), `${chi} ${noto[1]}`.trim());
  const a = statoInParole(stato);
  return coppia(`${chi} diventa ${a.it}`.trim(), `${chi} becomes ${a.en}`.trim());
}

const numero = (x) => {
  const n = Number(x);
  return Number.isFinite(n) ? String(Math.round(n * 10) / 10).replace(".", ",") : "";
};
const numeroEn = (x) => {
  const n = Number(x);
  return Number.isFinite(n) ? String(Math.round(n * 10) / 10) : "";
};

const MODI_DEL_CLIMA = {
  heat: ["in riscaldamento", "to heating"],
  cool: ["in raffrescamento", "to cooling"],
  heat_cool: ["in automatico", "to auto"],
  auto: ["in automatico", "to auto"],
  dry: ["in deumidificazione", "to dry"],
  fan_only: ["in sola ventilazione", "to fan only"],
};

const ANTIFURTO = {
  alarm_arm_away: ["fuori casa", "away"],
  alarm_arm_home: ["in casa", "home"],
  alarm_arm_night: ["notte", "night"],
  alarm_arm_vacation: ["vacanza", "vacation"],
  alarm_arm_custom_bypass: ["personalizzato", "custom"],
};

/**
 * Un servizio di Home Assistant in parole, `{it, en}`: il verbo e su cosa.
 * `chi` sono i nomi gia' detti delle entita' su cui agisce (anche vuoto),
 * `dati` i dati del servizio.
 */
export function servizioInParole(servizio, { chi = "", dati = {} } = {}) {
  const dominio = pulito(servizio).toLowerCase().split(".")[0];
  const quali = QUALI[dominio];
  if (pulito(chi) || !quali) return servizioCrudo(servizio, { chi: pulito(chi), dati });
  /* Senza un nome («light.turn_on» senza bersaglio) si dice cosa sono: «le luci». */
  const detto = servizioCrudo(servizio, { chi: SEGNAPOSTO, dati });
  return coppia(detto.it.replace(SEGNAPOSTO, quali[0]), detto.en.replace(SEGNAPOSTO, quali[1]));
}

const SEGNAPOSTO = "\u0001";
const QUALI = {
  light: ["le luci", "the lights"],
  switch: ["gli interruttori", "the switches"],
  fan: ["la ventola", "the fan"],
  climate: ["il clima", "the climate"],
  water_heater: ["lo scaldabagno", "the water heater"],
  cover: ["le tapparelle", "the shutters"],
  valve: ["la valvola", "the valve"],
  lock: ["la serratura", "the lock"],
  media_player: ["la musica", "the music"],
  vacuum: ["il robot", "the robot"],
  siren: ["la sirena", "the siren"],
  input_boolean: ["un interruttore", "a toggle"],
};

function servizioCrudo(servizio, { chi = "", dati = {} } = {}) {
  const s = pulito(servizio).toLowerCase();
  const [dominio, nome = ""] = s.split(".");
  const d = dati && typeof dati === "object" ? dati : {};
  const su = (it, en) => coppia(`${it} ${chi}`.trim(), `${en} ${chi}`.trim());
  if (dominio === "notify" || (dominio === "persistent_notification" && nome === "create"))
    return dominio === "notify"
      ? coppia("manda una notifica", "sends a notification")
      : coppia("scrive un avviso in Home Assistant", "writes a notice in Home Assistant");
  if (dominio === "tts") return coppia("legge un messaggio ad alta voce", "reads a message aloud");
  if (dominio === "scene") return su("avvia la scena", "starts the scene");
  if (dominio === "script") {
    if (["turn_on", "toggle"].includes(nome)) return su("avvia lo script", "runs the script");
    if (nome === "turn_off") return su("ferma lo script", "stops the script");
    const detto = inParole(nome);
    return coppia(`avvia lo script ${detto}`, `runs the script ${detto}`);
  }
  if (dominio === "automation") {
    if (nome === "trigger") return su("fa partire", "runs");
    if (nome === "turn_on") return su("riaccende l'automazione", "turns on the automation");
    if (nome === "turn_off") return su("spegne l'automazione", "turns off the automation");
  }
  if (dominio === "alarm_control_panel") {
    const chi2 = chi || "l'antifurto";
    const chiEn = chi || "the alarm";
    const modo = ANTIFURTO[nome];
    if (modo) return coppia(`inserisci ${chi2} (${modo[0]})`, `arm ${chiEn} (${modo[1]})`);
    if (nome === "alarm_disarm") return coppia(`disinserisci ${chi2}`, `disarm ${chiEn}`);
    if (nome === "alarm_trigger") return coppia(`fai scattare ${chi2}`, `trigger ${chiEn}`);
  }
  if (dominio === "climate" || dominio === "water_heater") {
    if (nome === "set_temperature") {
      const gradi = d.temperature ?? d.target_temp_high ?? d.target_temp_low;
      return gradi !== undefined && numero(gradi)
        ? coppia(`imposta ${chi} a ${numero(gradi)}°`, `set ${chi} to ${numeroEn(gradi)}°`)
        : su("regola", "adjust");
    }
    if (nome === "set_hvac_mode") {
      const modo = pulito(d.hvac_mode).toLowerCase();
      if (modo === "off") return su("spegni", "turn off");
      const m = MODI_DEL_CLIMA[modo];
      return m
        ? coppia(`metti ${chi} ${m[0]}`, `set ${chi} ${m[1]}`)
        : su("cambia modo a", "change the mode of");
    }
    if (nome === "set_preset_mode" || nome === "set_operation_mode") {
      const modo = inParole(d.preset_mode ?? d.operation_mode);
      return modo
        ? coppia(`metti ${chi} in modo «${modo}»`, `set ${chi} to «${modo}» mode`)
        : su("cambia modo a", "change the mode of");
    }
    if (nome === "set_fan_mode") return su("cambia la ventola di", "change the fan of");
  }
  if (dominio === "cover") {
    if (nome === "open_cover" || nome === "open_cover_tilt") return su("apri", "open");
    if (nome === "close_cover" || nome === "close_cover_tilt") return su("chiudi", "close");
    if (nome === "stop_cover") return su("ferma", "stop");
    if (nome === "set_cover_position" && numeroEn(d.position))
      return coppia(
        `porta ${chi} al ${numeroEn(d.position)}%`,
        `set ${chi} to ${numeroEn(d.position)}%`,
      );
  }
  if (dominio === "valve") {
    if (nome === "open_valve") return su("apri", "open");
    if (nome === "close_valve") return su("chiudi", "close");
    if (nome === "stop_valve") return su("ferma", "stop");
    if (nome === "set_valve_position" && numeroEn(d.position))
      return coppia(
        `porta ${chi} al ${numeroEn(d.position)}%`,
        `set ${chi} to ${numeroEn(d.position)}%`,
      );
  }
  if (dominio === "lock") {
    if (nome === "lock") return su("chiudi a chiave", "lock");
    if (nome === "unlock") return su("apri", "unlock");
    if (nome === "open") return su("apri", "open");
  }
  if (dominio === "media_player") {
    if (nome === "media_play" || nome === "play_media") return su("fai suonare", "play");
    if (nome === "media_pause") return su("metti in pausa", "pause");
    if (nome === "media_stop") return su("ferma", "stop");
    if (nome === "media_play_pause") return su("pausa o play su", "play or pause");
    if (nome === "media_next_track") return su("brano dopo su", "next track on");
    if (nome === "media_previous_track") return su("brano prima su", "previous track on");
    if (nome === "volume_set" && numeroEn(d.volume_level))
      return coppia(
        `${chi} al volume ${Math.round(Number(d.volume_level) * 100)}%`.trim(),
        `${chi} at volume ${Math.round(Number(d.volume_level) * 100)}%`.trim(),
      );
    if (nome === "volume_mute") return su("silenzia", "mute");
    if (nome === "select_source") {
      const fonte = pulito(d.source);
      return coppia(`metti ${chi} su «${fonte}»`, `switch ${chi} to «${fonte}»`);
    }
  }
  if (dominio === "vacuum") {
    if (nome === "start") return su("fai partire", "start");
    if (nome === "return_to_base") return su("rimanda alla base", "send back to base");
    if (nome === "stop" || nome === "pause") return su("ferma", "stop");
    if (nome === "clean_spot") return su("pulisci un punto con", "spot clean with");
  }
  if (dominio === "fan" && nome === "set_percentage" && numeroEn(d.percentage))
    return coppia(
      `${chi} al ${numeroEn(d.percentage)}%`.trim(),
      `${chi} at ${numeroEn(d.percentage)}%`.trim(),
    );
  if (dominio === "input_number" && nome === "set_value")
    return coppia(`metti ${chi} a ${pulito(d.value)}`, `set ${chi} to ${pulito(d.value)}`);
  if (dominio === "input_select" && nome === "select_option")
    return coppia(`metti ${chi} su «${pulito(d.option)}»`, `set ${chi} to «${pulito(d.option)}»`);
  if ((dominio === "button" || dominio === "input_button") && nome === "press")
    return su("premi", "press");
  /* Accendere, spegnere e invertire valgono per quasi tutti. */
  if (nome === "turn_on") {
    const luce = dominio === "light" && numeroEn(d.brightness_pct);
    return luce
      ? coppia(
          `accendi ${chi} al ${numeroEn(d.brightness_pct)}%`,
          `turn on ${chi} at ${numeroEn(d.brightness_pct)}%`,
        )
      : su("accendi", "turn on");
  }
  if (nome === "turn_off") return su("spegni", "turn off");
  if (nome === "toggle") return su("accendi o spegni", "toggle");
  /* Uno che non si conosce: le sue parole, senza punti e trattini bassi. */
  const detto = inParole(s);
  return chi
    ? coppia(`esegue ${detto} su ${chi}`, `runs ${detto} on ${chi}`)
    : coppia(`esegue ${detto}`, `runs ${detto}`);
}

/* ── i dispositivi ──────────────────────────────────────────────────────── *
 *
 * Un innesco, una condizione o un'azione fatti col «Dispositivo» di Home
 * Assistant non hanno un entity_id da dire: hanno un `device_id`, spesso un
 * `entity_id` che e' la voce del registro (un id crudo), e un `type` che dice
 * cosa succede («turned_on», «remote_button_short_press»). Qui il `type`
 * diventa un verbo; il nome lo passa chi chiama, gia' risolto, e se non c'e'
 * si dice «un dispositivo». */

/* «Lavatrice si accende»: il soggetto e il verbo. */
const DEL_DISPOSITIVO = {
  turned_on: DIVENTA.on,
  turned_off: DIVENTA.off,
  opened: DIVENTA.open,
  closed: DIVENTA.closed,
  not_opened: DIVENTA.closed,
  opening: ["inizia ad aprirsi", "starts opening"],
  closing: ["inizia a chiudersi", "starts closing"],
  locked: DIVENTA.locked,
  unlocked: ["si sblocca", "unlocks"],
  triggered: DIVENTA.triggered,
  armed_away: DIVENTA.armed_away,
  armed_home: DIVENTA.armed_home,
  armed_night: DIVENTA.armed_night,
  armed_vacation: DIVENTA.armed_vacation,
  disarmed: DIVENTA.disarmed,
  playing: DIVENTA.playing,
  paused: DIVENTA.paused,
  idle: ["si ferma", "goes idle"],
  cleaning: DIVENTA.cleaning,
  docked: DIVENTA.docked,
  connected: ["si collega", "connects"],
  not_connected: ["si scollega", "disconnects"],
  bat_low: ["ha la batteria scarica", "runs low on battery"],
  smoke: ["sente del fumo", "detects smoke"],
  gas: ["sente del gas", "detects gas"],
  moist: ["sente dell'acqua", "detects water"],
  problem: ["ha un problema", "has a problem"],
  changed_states: ["cambia stato", "changes state"],
  hvac_mode_changed: ["cambia modalità", "changes mode"],
  enters: ["entra in una zona", "enters a zone"],
  leaves: ["esce da una zona", "leaves a zone"],
};

const MOVIMENTO_SI = ["motion", "occupied", "present"];
const MOVIMENTO_NO = ["no_motion", "not_occupied", "not_present"];

/* Un pulsante: «remote_button_short_press», «button_double_press», «pressed». */
const ePulsante = (tipo) =>
  /press|click|(^|_)(tap|hold|held|release|released|button)(_|$)/.test(tipo);

/* Il numero del tasto, se il `subtype` lo dice («button_2», «2»): niente altro. */
function tastoDi(subtype) {
  const m = /^(?:button_?|b)?(\d{1,2})$/i.exec(pulito(subtype));
  return m ? m[1] : "";
}

/* Una soglia scritta (anche 0), o «». */
const soglia = (x) => (x === undefined || x === null || x === "" ? "" : numero(x));
const sogliaEn = (x) => (x === undefined || x === null || x === "" ? "" : numeroEn(x));

/**
 * Un innesco «device», `{it, en}` senza il «Quando» davanti («Lavatrice si
 * accende», «si preme il pulsante Interruttore cucina»), o `null` se il suo
 * `type` non si sa dire: chi chiama allora dice solo da chi viene. `chi` e'
 * un nome gia' detto, mai un id.
 */
export function innescoDelDispositivoInParole(innesco, chi = "") {
  const tipo = pulito(innesco?.type).toLowerCase();
  const nome = pulito(chi);
  const it = nome || "un dispositivo";
  const en = nome || "a device";
  const sopra = soglia(innesco?.above);
  const sotto = soglia(innesco?.below);
  if (sopra && sotto)
    return coppia(
      `${it} sta fra ${sopra} e ${sotto}`,
      `${en} is between ${sogliaEn(innesco.above)} and ${sogliaEn(innesco.below)}`,
    );
  if (sopra) return coppia(`${it} supera ${sopra}`, `${en} goes above ${sogliaEn(innesco.above)}`);
  if (sotto)
    return coppia(`${it} scende sotto ${sotto}`, `${en} drops below ${sogliaEn(innesco.below)}`);
  if (!tipo) return null;
  if (MOVIMENTO_SI.includes(tipo))
    return coppia(`c'è movimento in ${it}`, `there's motion in ${en}`);
  if (MOVIMENTO_NO.includes(tipo))
    return coppia(`non c'è più movimento in ${it}`, `motion stops in ${en}`);
  const noto = DEL_DISPOSITIVO[tipo];
  if (noto) return coppia(`${it} ${noto[0]}`, `${en} ${noto[1]}`);
  if (ePulsante(tipo)) {
    const tasto = tastoDi(innesco?.subtype);
    const qualeIt = `${nome ? `il pulsante ${nome}` : "un pulsante"}${tasto ? ` (tasto ${tasto})` : ""}`;
    const qualeEn = `${nome || "a button"}${tasto ? ` (button ${tasto})` : ""}`;
    if (/double/.test(tipo))
      return coppia(`si preme due volte ${qualeIt}`, `${qualeEn} is pressed twice`);
    if (/triple/.test(tipo))
      return coppia(`si preme tre volte ${qualeIt}`, `${qualeEn} is pressed three times`);
    if (/long|hold|held/.test(tipo))
      return coppia(`si tiene premuto ${qualeIt}`, `${qualeEn} is held down`);
    if (/release/.test(tipo)) return coppia(`si lascia ${qualeIt}`, `${qualeEn} is released`);
    return coppia(`si preme ${qualeIt}`, `${qualeEn} is pressed`);
  }
  return null;
}

/* I `type` delle condizioni «device»: gli stati, al presente. */
const STATO_DEL_DISPOSITIVO = {
  is_on: "on",
  is_off: "off",
  is_open: "open",
  is_not_open: "closed",
  is_closed: "closed",
  is_locked: "locked",
  is_unlocked: "unlocked",
  is_home: "home",
  is_not_home: "not_home",
  is_triggered: "triggered",
  is_disarmed: "disarmed",
  is_armed_away: "armed_away",
  is_armed_home: "armed_home",
  is_armed_night: "armed_night",
  is_armed_vacation: "armed_vacation",
  is_playing: "playing",
  is_paused: "paused",
  is_idle: "idle",
  is_cleaning: "cleaning",
  is_docked: "docked",
};

/**
 * Una condizione «device», `{it, en}` («Lavatrice è acceso»), o `null` se il
 * suo `type` non si sa dire.
 */
export function condizioneDelDispositivoInParole(condizione, chi = "") {
  const tipo = pulito(condizione?.type).toLowerCase();
  const nome = pulito(chi);
  const it = nome || "un dispositivo";
  const en = nome || "a device";
  const sopra = soglia(condizione?.above);
  const sotto = soglia(condizione?.below);
  if (sopra) return coppia(`${it} sopra ${sopra}`, `${en} above ${sogliaEn(condizione.above)}`);
  if (sotto) return coppia(`${it} sotto ${sotto}`, `${en} below ${sogliaEn(condizione.below)}`);
  const stato = STATO_DEL_DISPOSITIVO[tipo];
  if (stato) {
    const a = statoInParole(stato);
    return coppia(`${it} è ${a.it}`, `${en} is ${a.en}`);
  }
  if (tipo === "is_motion") return coppia(`c'è movimento in ${it}`, `there's motion in ${en}`);
  if (tipo === "is_no_motion") return coppia(`non c'è movimento in ${it}`, `no motion in ${en}`);
  return null;
}

/* Il `type` di un'azione «device» e il servizio che vuol dire, per dominio. */
const AZIONI_DEL_DISPOSITIVO = {
  turn_on: () => "turn_on",
  turn_off: () => "turn_off",
  toggle: () => "toggle",
  open: (d) => (d === "cover" ? "open_cover" : d === "valve" ? "open_valve" : "open"),
  close: (d) => (d === "cover" ? "close_cover" : d === "valve" ? "close_valve" : "close"),
  stop: (d) => (d === "cover" ? "stop_cover" : d === "valve" ? "stop_valve" : "stop"),
  lock: () => "lock",
  unlock: () => "unlock",
  press: () => "press",
  arm_away: () => "alarm_arm_away",
  arm_home: () => "alarm_arm_home",
  arm_night: () => "alarm_arm_night",
  arm_vacation: () => "alarm_arm_vacation",
  disarm: () => "alarm_disarm",
  trigger: () => "alarm_trigger",
  clean: () => "start",
  dock: () => "return_to_base",
};

/**
 * Un'azione «device», `{it, en}` col suo verbo («spegni Lavatrice», «manda
 * una notifica a Telefono»), o `null` se il suo `type` non si sa dire.
 */
export function azioneDelDispositivoInParole(azione, chi = "") {
  const tipo = pulito(azione?.type).toLowerCase();
  const dominio = pulito(azione?.domain).toLowerCase();
  const nome = pulito(chi);
  if (tipo === "notify" || dominio === "mobile_app")
    return nome
      ? coppia(`manda una notifica a ${nome}`, `sends a notification to ${nome}`)
      : coppia("manda una notifica", "sends a notification");
  const servizio = AZIONI_DEL_DISPOSITIVO[tipo];
  if (!servizio || !dominio) return null;
  if (!nome && !QUALI[dominio]) {
    const detto = servizioCrudo(`${dominio}.${servizio(dominio)}`, { chi: SEGNAPOSTO });
    return coppia(
      detto.it.replace(SEGNAPOSTO, "un dispositivo"),
      detto.en.replace(SEGNAPOSTO, "a device"),
    );
  }
  return servizioInParole(`${dominio}.${servizio(dominio)}`, { chi: nome });
}
