/* Le automazioni di gdahome, scritte come automazioni vere di Home Assistant.
 *
 * «Le automazioni create dalla plancia si scrivono come vere automazioni di
 * Home Assistant: le esegue lui, e si ritrovano in Impostazioni →
 * Automazioni.» Prima le eseguiva l'add-on, con un motore suo: due posti dove
 * una casa fa le cose da sola sono un posto di troppo — chi apre Home
 * Assistant non le vedeva, e chi apriva la plancia non vedeva le sue. Adesso
 * il posto e' uno, ed e' quello di Home Assistant.
 *
 * Questo file e' il traduttore, e non fa altro. La forma della plancia —
 * `{quando, soloSe, allora}` e il cronotermostato, quella di
 * `core/automazioni.js` — e' comoda da scrivere e da raccontare con una
 * frase; quella di Home Assistant (`triggers`, `conditions`, `actions`) e'
 * quella che gira davvero. Si va nei due versi:
 *
 *  - `inHomeAssistant(a)`: la forma della plancia diventa la configurazione
 *    che il ponte salva con `POST /api/config/automation/config/<id>`. I
 *    servizi li sceglie questo file, come li sceglieva il motore: niente
 *    serrature che si aprono, niente antifurto che si disinserisce, niente
 *    riavvii (`servizioPermesso`);
 *  - `dallaHomeAssistant(config)`: un'automazione di Home Assistant — anche
 *    una scritta a mano anni fa — torna nella forma della plancia **solo se
 *    ci sta tutta**. La prova e' una sola e non si inganna: la si ritraduce
 *    e deve tornare identica (`normalizzata`). Una che non torna — un
 *    template, una scelta fra casi, un blueprint, un'area al posto delle
 *    entita' — e' «complessa»: si accende, si spegne, si esegue, si
 *    rinomina, e per il resto si apre in Home Assistant. Modificarla con
 *    l'editor della plancia vorrebbe dire perderne un pezzo senza dirlo.
 *
 * Le avvisa sul telefono passano da un evento del bus, `gdahome_avvisa`: lo
 * scrive l'azione, lo ascolta il ponte e lo consegna ai telefoni con la busta
 * delle notifiche di sempre (`ponte/src/automazioni.js`). Home Assistant non
 * deve sapere niente dei telefoni dell'app.
 *
 * Qui non c'e' DOM e non c'e' un filo: entra un oggetto, esce un oggetto.
 */

import {
  ASPETTA_AL_MASSIMO,
  DOMINI,
  automazionePulita,
  calendarioPulito,
  cronoPulito,
  routinePulita,
  dominioDi,
  serviziDellAzione,
} from "./automazioni.js";

const pulito = (valore) => String(valore ?? "").trim();

/* Come si riconoscono quelle nate dalla plancia: la descrizione lo dice a chi
 * le apre in Home Assistant, e il segno `#gdahome` lo dice a noi. */
export const SEGNO_GDAHOME = "#gdahome";
export const DESCRIZIONE_GDAHOME = `Creata con la plancia GdAHome. ${SEGNO_GDAHOME}`;

/** L'evento che porta un avviso dai telefoni: lo ascolta il ponte. */
export const EVENTO_AVVISA = "gdahome_avvisa";
/* Il titolo dell'avviso e' il nome dell'automazione, come lo sa Home
 * Assistant nel momento in cui parte: rinominarla non rompe niente. */
const TITOLO_DELL_AVVISO = "{{ this.attributes.friendly_name }}";

/** Le categorie dell'elenco «Per tipo», nell'ordine in cui si mostrano. */
export const CATEGORIE = Object.freeze([
  "luci",
  "clima",
  "tapparelle",
  "irrigazione",
  "sicurezza",
  "avvisi",
  "energia",
  "altre",
]);

const MODO_IN_HA = Object.freeze({ ricomincia: "restart", ignora: "single", coda: "queued" });
const MODO_DA_HA = Object.freeze({ restart: "ricomincia", single: "ignora", queued: "coda" });

const GIORNI_HA = Object.freeze(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
const ARMATI = Object.freeze([
  "armed_away",
  "armed_custom_bypass",
  "armed_home",
  "armed_night",
  "armed_vacation",
]);

/* «Acceso» e «spento» detti nella lingua di ogni dominio: una tapparella e'
 * aperta, una persona e' a casa, un lettore suona. */
const ACCESO = Object.freeze({
  cover: "open",
  person: "home",
  device_tracker: "home",
  lock: "unlocked",
  media_player: "playing",
  climate: ["auto", "cool", "dry", "fan_only", "heat", "heat_cool"],
  alarm_control_panel: ARMATI,
});
const SPENTO = Object.freeze({
  cover: "closed",
  person: "not_home",
  device_tracker: "not_home",
  lock: "locked",
  media_player: ["idle", "off", "paused", "standby"],
  alarm_control_panel: "disarmed",
});
const accesoDi = (id) => ACCESO[dominioDi(id)] ?? "on";
const spentoDi = (id) => SPENTO[dominioDi(id)] ?? "off";

/* ── la forma canonica ──────────────────────────────────────────────────── */

const lista = (v) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);
const ordinate = (v) => [...new Set(lista(v).map((x) => String(x)))].sort();
const eOggetto = (v) => Boolean(v) && typeof v === "object" && !Array.isArray(v);

/** Una durata in secondi: `{minutes: 2}`, `"00:02:00"` o `120`. Un template resta com'e'. */
export function secondiDi(v) {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const testo = v.trim();
    if (/^-?\d+(\.\d+)?$/.test(testo)) return Number(testo);
    const m = /^(-)?(\d+):(\d{1,2})(?::(\d{1,2}(?:\.\d+)?))?$/.exec(testo);
    if (!m) return testo;
    const s = Number(m[2]) * 3600 + Number(m[3]) * 60 + Number(m[4] || 0);
    return m[1] ? -s : s;
  }
  if (eOggetto(v)) {
    const pesi = { days: 86400, hours: 3600, minutes: 60, seconds: 1, milliseconds: 0.001 };
    let s = 0;
    for (const [k, x] of Object.entries(v)) {
      if (!(k in pesi) || typeof x !== "number") return v;
      s += x * pesi[k];
    }
    return s;
  }
  return v;
}

/* Un orario in «HH:MM:SS», se e' un orario; un'entita' (input_datetime) o un
 * template restano come sono. */
function orarioPieno(v) {
  const testo = pulito(v);
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(testo);
  if (!m) return v;
  return `${m[1].padStart(2, "0")}:${m[2]}:${m[3] || "00"}`;
}

const numeroSePuo = (v) =>
  typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : v;

/* Uno stato scritto: un elenco di uno e' quell'uno, i numeri sono testo. */
function statoScritto(v) {
  if (v === null) return null;
  if (Array.isArray(v)) {
    const tutti = ordinate(v);
    return tutti.length === 1 ? tutti[0] : tutti;
  }
  return String(v);
}

function senzaContorno(x) {
  const o = { ...x };
  delete o.alias;
  delete o.id;
  if (o.enabled === true) delete o.enabled;
  return o;
}

function triggerNormale(t) {
  if (!eOggetto(t)) return t;
  const o = senzaContorno(t);
  if (o.platform !== undefined && o.trigger === undefined) o.trigger = o.platform;
  delete o.platform;
  if (o.entity_id !== undefined) o.entity_id = ordinate(o.entity_id);
  for (const k of ["to", "from", "not_to", "not_from"])
    if (o[k] !== undefined) o[k] = statoScritto(o[k]);
  if (o.for !== undefined) o.for = secondiDi(o.for);
  if (o.at !== undefined) o.at = lista(o.at).map(orarioPieno);
  if (o.offset !== undefined) {
    o.offset = secondiDi(o.offset);
    if (o.offset === 0) delete o.offset;
  }
  for (const k of ["above", "below"]) if (o[k] !== undefined) o[k] = numeroSePuo(o[k]);
  for (const k of ["hours", "minutes", "seconds"]) if (o[k] !== undefined) o[k] = String(o[k]);
  return o;
}

function condizioneNormale(c) {
  if (typeof c === "string") return { condition: "template", value_template: c };
  if (!eOggetto(c)) return c;
  const o = senzaContorno(c);
  if (o.entity_id !== undefined) o.entity_id = ordinate(o.entity_id);
  if (o.state !== undefined) o.state = statoScritto(o.state);
  if (o.for !== undefined) o.for = secondiDi(o.for);
  for (const k of ["after", "before"]) if (o[k] !== undefined) o[k] = orarioPieno(o[k]);
  if (o.weekday !== undefined) o.weekday = lista(o.weekday).map(String);
  for (const k of ["above", "below"]) if (o[k] !== undefined) o[k] = numeroSePuo(o[k]);
  if (o.match === "all") delete o.match;
  if (Array.isArray(o.conditions)) o.conditions = o.conditions.map(condizioneNormale);
  return o;
}

function azioneNormale(a) {
  if (!eOggetto(a)) return a;
  const o = senzaContorno(a);
  if (o.continue_on_error === false) delete o.continue_on_error;
  if (o.service !== undefined && o.action === undefined) o.action = o.service;
  delete o.service;
  if (typeof o.action === "string") {
    const bersaglio = eOggetto(o.target) ? { ...o.target } : {};
    const dati = eOggetto(o.data) ? { ...o.data } : {};
    const sparse = [o.entity_id, bersaglio.entity_id, dati.entity_id].flatMap(lista);
    delete o.entity_id;
    delete dati.entity_id;
    if (sparse.length) bersaglio.entity_id = ordinate(sparse);
    else delete bersaglio.entity_id;
    if (Object.keys(bersaglio).length) o.target = bersaglio;
    else delete o.target;
    if (Object.keys(dati).length) o.data = dati;
    else delete o.data;
  }
  if (o.delay !== undefined) o.delay = secondiDi(o.delay);
  if (o.timeout !== undefined) o.timeout = secondiDi(o.timeout);
  if (o.continue_on_timeout === true) delete o.continue_on_timeout;
  for (const k of ["sequence", "default", "then", "else"])
    if (Array.isArray(o[k])) o[k] = o[k].map(azioneNormale);
  if (Array.isArray(o.choose))
    o.choose = o.choose.map((x) =>
      eOggetto(x)
        ? {
            ...x,
            conditions: lista(x.conditions).map(condizioneNormale),
            sequence: lista(x.sequence).map(azioneNormale),
          }
        : x,
    );
  if (Array.isArray(o.wait_for_trigger))
    o.wait_for_trigger = o.wait_for_trigger.map(triggerNormale);
  if (o.if !== undefined) o.if = lista(o.if).map(condizioneNormale);
  return o;
}

/* Le chiavi di prima livello che una configurazione puo' avere senza essere
 * «complessa». `variables` le usa soltanto il cronotermostato. */
const DI_PRIMO_LIVELLO = new Set([
  "id",
  "alias",
  "description",
  "mode",
  "triggers",
  "trigger",
  "conditions",
  "condition",
  "actions",
  "action",
  "variables",
]);

/**
 * La configurazione nella forma canonica: le chiavi nuove (`triggers`,
 * `trigger:`, `action:`), le entita' in elenco ordinato, le durate in secondi,
 * gli orari in «HH:MM:SS», senza nomi e id dei singoli pezzi. Due
 * configurazioni che fanno la stessa cosa scritte in due modi tornano uguali.
 */
export function normalizzata(config) {
  const c = eOggetto(config) ? config : {};
  return {
    mode: pulito(c.mode) || "single",
    triggers: lista(c.triggers ?? c.trigger).map(triggerNormale),
    conditions: lista(c.conditions ?? c.condition).map(condizioneNormale),
    actions: lista(c.actions ?? c.action).map(azioneNormale),
    variables: eOggetto(c.variables) ? c.variables : undefined,
    altre: Object.keys(c)
      .filter((k) => !DI_PRIMO_LIVELLO.has(k))
      .sort(),
  };
}

/* Un JSON con le chiavi in ordine: e' la firma con cui si confrontano. */
function firma(v) {
  if (Array.isArray(v)) return `[${v.map(firma).join(",")}]`;
  if (eOggetto(v))
    return `{${Object.keys(v)
      .filter((k) => v[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${firma(v[k])}`)
      .join(",")}}`;
  return JSON.stringify(v ?? null);
}

export const stessaConfigurazione = (a, b) => firma(normalizzata(a)) === firma(normalizzata(b));

/* ── dalla plancia a Home Assistant ─────────────────────────────────────── */

const minuti = (n) => ({ minutes: n });
const entitaIn = (v) => {
  const tutte = lista(v).filter(Boolean);
  return tutte.length === 1 ? tutte[0] : tutte;
};
const bersaglio = (v) => ({ entity_id: entitaIn(v) });

/* Le persone di casa: quelle scelte, o tutte quelle che Home Assistant
 * conosce. Un'automazione di Home Assistant non sa dire «chiunque»: le si
 * scrivono per nome, e una persona aggiunta domani si aggiunge dall'editor. */
function personeDi(scelte, stati) {
  if (scelte.length) return scelte;
  return Object.keys(stati || {})
    .filter((id) => dominioDi(id) === "person")
    .sort();
}

function triggerDelQuando(q, stati) {
  if (q.tipo === "orario") {
    if (q.sole)
      return [
        {
          trigger: "sun",
          event: q.sole === "alba" ? "sunrise" : "sunset",
          ...(q.scarto ? { offset: secondiInOra(q.scarto * 60) } : {}),
        },
      ];
    return q.ore.length ? [{ trigger: "time", at: q.ore.map((o) => `${o}:00`) }] : [];
  }
  if (q.tipo === "ogni")
    return [
      q.minuti < 60
        ? { trigger: "time_pattern", minutes: `/${q.minuti}` }
        : {
            trigger: "time_pattern",
            hours: `/${Math.max(1, Math.round(q.minuti / 60))}`,
            minutes: "0",
          },
    ];
  if (q.tipo === "apertura") {
    const perDominio = new Map();
    for (const id of q.entita) {
      const d = dominioDi(id);
      if (!perDominio.has(d)) perDominio.set(d, []);
      perDominio.get(d).push(id);
    }
    const apre = q.verso !== "chiude";
    return [...perDominio].map(([d, ids]) => {
      if (d === "binary_sensor")
        return {
          trigger: "state",
          entity_id: entitaIn(ids),
          from: apre ? "off" : "on",
          to: apre ? "on" : "off",
        };
      if (d === "lock")
        return { trigger: "state", entity_id: entitaIn(ids), to: apre ? "unlocked" : "locked" };
      return { trigger: "state", entity_id: entitaIn(ids), to: apre ? "open" : "closed" };
    });
  }
  if (q.tipo === "movimento") {
    if (!q.entita.length) return [];
    return q.verso === "no"
      ? [{ trigger: "state", entity_id: entitaIn(q.entita), to: "off", for: minuti(q.minuti) }]
      : [{ trigger: "state", entity_id: entitaIn(q.entita), from: "off", to: "on" }];
  }
  if (q.tipo === "valore")
    return q.entita
      ? [
          {
            trigger: "numeric_state",
            entity_id: q.entita,
            [q.verso === "sotto" ? "below" : "above"]: q.soglia,
          },
        ]
      : [];
  if (q.tipo === "elettrodomestico")
    return q.entita
      ? [
          {
            trigger: "numeric_state",
            entity_id: q.entita,
            below: q.soglia,
            for: minuti(q.minuti),
          },
        ]
      : [];
  if (q.tipo === "persone") {
    if (q.verso === "tuttiFuori") return [{ trigger: "state", entity_id: "zone.home", to: "0" }];
    const chi = personeDi(q.chi, stati);
    if (!chi.length) return [];
    return q.verso === "esce"
      ? [{ trigger: "state", entity_id: entitaIn(chi), from: "home" }]
      : [{ trigger: "state", entity_id: entitaIn(chi), to: "home" }];
  }
  if (q.tipo === "antifurto") {
    if (!q.entita) return [];
    const to =
      q.verso === "suona" ? "triggered" : q.verso === "disinserito" ? "disarmed" : [...ARMATI];
    return [{ trigger: "state", entity_id: q.entita, to }];
  }
  if (q.tipo === "stato") {
    if (!q.entita.length) return [];
    /* Senza uno stato d'arrivo, `to: null`: Home Assistant allora guarda lo
     * stato e non gli attributi, che e' quello che «cambia stato» vuol dire. */
    return [
      {
        trigger: "state",
        entity_id: entitaIn(q.entita),
        ...(q.da ? { from: q.da } : {}),
        to: q.a || null,
        ...(q.per ? { for: minuti(q.per) } : {}),
      },
    ];
  }
  if (q.tipo === "attributo")
    return q.entita && q.attributo
      ? [
          {
            trigger: "state",
            entity_id: q.entita,
            attribute: q.attributo,
            ...(q.valore ? { to: q.valore } : {}),
          },
        ]
      : [];
  if (q.tipo === "evento")
    return q.evento
      ? [
          {
            trigger: "event",
            event_type: q.evento,
            ...(Object.keys(q.filtro || {}).length ? { event_data: { ...q.filtro } } : {}),
          },
        ]
      : [];
  return [];
}

function secondiInOra(s) {
  const segno = s < 0 ? "-" : "";
  const a = Math.abs(Math.round(s));
  const h = String(Math.floor(a / 3600)).padStart(2, "0");
  const m = String(Math.floor((a % 3600) / 60)).padStart(2, "0");
  const ss = String(a % 60).padStart(2, "0");
  return `${segno}${h}:${m}:${ss}`;
}

const giorniInHA = (giorni) => GIORNI_HA.filter((_g, i) => giorni[i]);

function condizioneInHA(c) {
  if (c.tipo === "notte" || c.tipo === "fascia") {
    if (c.da && c.a) return { condition: "time", after: `${c.da}:00`, before: `${c.a}:00` };
    return { condition: "state", entity_id: "sun.sun", state: "below_horizon" };
  }
  if (c.tipo === "giorni") return { condition: "time", weekday: giorniInHA(c.giorni) };
  if (c.tipo === "sole")
    return {
      condition: "state",
      entity_id: "sun.sun",
      state: c.posizione === "sotto" ? "below_horizon" : "above_horizon",
    };
  if (c.tipo === "casa")
    return c.chi === "nessuno"
      ? { condition: "state", entity_id: "zone.home", state: "0" }
      : { condition: "numeric_state", entity_id: "zone.home", above: 0 };
  if (c.tipo === "stato")
    return {
      condition: "state",
      entity_id: c.entita,
      state: c.vale === "spento" ? spentoDi(c.entita) : accesoDi(c.entita),
    };
  if (c.tipo === "uguale") {
    const voluti = c.valore
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    const stato = { condition: "state", entity_id: c.entita, state: entitaIn(voluti) };
    return c.non ? { condition: "not", conditions: [stato] } : stato;
  }
  if (c.tipo === "attributo") {
    if (c.confronto === "uguale")
      return { condition: "state", entity_id: c.entita, attribute: c.attributo, state: c.valore };
    return {
      condition: "numeric_state",
      entity_id: c.entita,
      attribute: c.attributo,
      [c.confronto === "sotto" ? "below" : "above"]: Number(c.valore) || 0,
    };
  }
  return {
    condition: "numeric_state",
    entity_id: c.entita,
    [c.verso === "sotto" ? "below" : "above"]: c.soglia,
  };
}

/* «Non piu' di una volta ogni X minuti» e «spenta fino al…»: Home Assistant
 * non ha una casella per tutte e due, e le si scrive come una condizione con
 * un template — sempre lo stesso, che al ritorno si riconosce. */
const templateDellaPausa = (min) =>
  `{{ this.attributes.last_triggered is none or (now() - this.attributes.last_triggered).total_seconds() > ${min * 60} }}`;
const PAUSA_LETTA =
  /^\{\{ this\.attributes\.last_triggered is none or \(now\(\) - this\.attributes\.last_triggered\)\.total_seconds\(\) > (\d+) \}\}$/;
const templateDellaScadenza = ({ data, stato }) =>
  `{{ now().strftime('%Y-%m-%d') ${stato === "attiva" ? "<" : ">="} '${data}' }}`;
const SCADENZA_LETTA = /^\{\{ now\(\)\.strftime\('%Y-%m-%d'\) (<|>=) '(\d{4}-\d{2}-\d{2})' \}\}$/;

/* «Aspetta finche'…»: un template e non un `wait_for_trigger`, perche' se e'
 * gia' cosi' si deve andare avanti subito. */
function templateDellAttesa(entita, stato) {
  const soglia = /^([<>])\s*(-?\d+(?:[.,]\d+)?)$/.exec(pulito(stato));
  if (soglia)
    return `{{ states('${entita}') | float(none) is not none and states('${entita}') | float ${soglia[1]} ${soglia[2].replace(",", ".")} }}`;
  return `{{ is_state('${entita}', '${pulito(stato).replace(/'/g, "")}') }}`;
}
const ATTESA_SOGLIA =
  /^\{\{ states\('([a-z_]+\.[a-z0-9_]+)'\) \| float\(none\) is not none and states\('\1'\) \| float ([<>]) (-?\d+(?:\.\d+)?) \}\}$/;
const ATTESA_STATO = /^\{\{ is_state\('([a-z_]+\.[a-z0-9_]+)', '([^']*)'\) \}\}$/;

function servizioInHA({ domain, service, data }) {
  const dati = { ...(data || {}) };
  const entita = dati.entity_id;
  delete dati.entity_id;
  return {
    action: `${domain}.${service}`,
    ...(entita !== undefined ? { target: { entity_id: entita } } : {}),
    ...(Object.keys(dati).length ? { data: dati } : {}),
  };
}

function azioniInHA(allora, contesto) {
  const fuori = [];
  for (const a of allora) {
    if (a.tipo === "aspetta") fuori.push({ delay: minuti(a.minuti) });
    else if (a.tipo === "aspettaChe")
      fuori.push({
        wait_template: templateDellAttesa(a.entita, a.stato),
        timeout: minuti(a.massimo),
        continue_on_timeout: true,
      });
    else if (a.tipo === "notifica")
      fuori.push({
        event: EVENTO_AVVISA,
        event_data: { titolo: TITOLO_DELL_AVVISO, testo: a.testo },
      });
    else if (a.tipo === "clima" && a.modo !== "spegni")
      /* Un clima spento a cui si dice «21°» resta spento: prima lo si accende. */
      fuori.push(
        { action: "homeassistant.turn_on", target: bersaglio(a.entita) },
        {
          action: "climate.set_temperature",
          target: bersaglio(a.entita),
          data: { temperature: a.gradi },
        },
      );
    else for (const s of serviziDellAzione(a, contesto)) fuori.push(servizioInHA(s));
  }
  return fuori;
}

/* Il cronotermostato: un'automazione sola, che parte a ogni inizio e fine
 * fascia, quando si apre o si chiude una finestra e quando Home Assistant si
 * riaccende, e decide in quel momento. Le fasce viaggiano in `variables`,
 * dove le rilegge l'editor: il template qui sotto non si traduce in una
 * frase, le fasce si'. */
export const VARIABILE_DEL_CRONO = "gdahome_crono";
const TEMPLATE_DEL_CRONO =
  `{% set c = ${VARIABILE_DEL_CRONO} %}{% set m = now().hour * 60 + now().minute %}` +
  "{% set f = c.festivi if now().weekday() >= 5 else c.feriali %}" +
  "{% set ns = namespace(si=false) %}{% for x in f %}{% if x[0] <= m < x[1] %}{% set ns.si = true %}{% endif %}{% endfor %}" +
  "{{ c.inCasa if ns.si else c.fuori }}";

function cronoInHA(c) {
  const ore = new Set();
  for (const [da, a] of [...c.feriali, ...c.festivi]) {
    ore.add(da % 1440);
    ore.add(a % 1440);
  }
  const at = [...ore].sort((x, y) => x - y).map((m) => secondiInOra(m * 60));
  const finestre = c.finestraSpegne ? c.finestre : [];
  const termostati = bersaglio(c.termostati);
  const scalda = [
    {
      action: "climate.set_hvac_mode",
      target: termostati,
      data: { hvac_mode: "heat" },
      continue_on_error: true,
    },
    {
      action: "climate.set_temperature",
      target: termostati,
      data: { temperature: TEMPLATE_DEL_CRONO },
    },
  ];
  return {
    mode: "restart",
    variables: { [VARIABILE_DEL_CRONO]: { ...c } },
    triggers: [
      ...(at.length ? [{ trigger: "time", at }] : []),
      ...(finestre.length ? [{ trigger: "state", entity_id: entitaIn(finestre), to: null }] : []),
      { trigger: "homeassistant", event: "start" },
    ],
    conditions: [],
    actions: finestre.length
      ? [
          {
            choose: [
              {
                conditions: [
                  { condition: "state", entity_id: entitaIn(finestre), state: "on", match: "any" },
                ],
                sequence: [{ action: "climate.turn_off", target: termostati }],
              },
            ],
            default: scalda,
          },
        ]
      : scalda,
  };
}

/* Il Pianificatore. Come il cronotermostato, il modello viaggia in
 * `variables` (`gdahome_routine`, `gdahome_fasce`), dove lo rilegge l'editor.
 *
 * La routine e' un'automazione sola: un orario per passo, ognuno col suo
 * `id`, e un `choose` che fa le azioni di quel passo. I giorni sono una
 * condizione, il periodo un'altra: fuori periodo resta accesa e non fa
 * niente. */
export const VARIABILE_DELLA_ROUTINE = "gdahome_routine";
export const VARIABILE_DELLE_FASCE = "gdahome_fasce";

const OGGI_MM_GG = "now().strftime('%m-%d')";
function templateDelPeriodo(p) {
  return p.da <= p.a
    ? `{{ '${p.da}' <= ${OGGI_MM_GG} <= '${p.a}' }}`
    : `{{ ${OGGI_MM_GG} >= '${p.da}' or ${OGGI_MM_GG} <= '${p.a}' }}`;
}

function routineInHA(a, contesto) {
  const r = a.routine;
  const passi = r.passi.filter((p) => p.allora.some((x) => x.tipo !== "aspetta"));
  if (!passi.length) return null;
  const conditions = [];
  if (!r.giorni.every(Boolean))
    conditions.push({ condition: "time", weekday: giorniInHA(r.giorni) });
  if (r.periodo)
    conditions.push({ condition: "template", value_template: templateDelPeriodo(r.periodo) });
  const soloSe = a.soloSe.map(condizioneInHA);
  if (soloSe.length > 1 && a.tutte === false)
    conditions.push({ condition: "or", conditions: soloSe });
  else conditions.push(...soloSe);
  return {
    /* Ogni passo per conto suo: un «aspetta 45 minuti» delle 6:30 non
     * ferma il passo delle 7:00. */
    mode: "parallel",
    variables: { [VARIABILE_DELLA_ROUTINE]: { ...r } },
    triggers: passi.map((p, i) => ({ trigger: "time", at: `${p.ora}:00`, id: `passo_${i}` })),
    conditions,
    actions: [
      {
        choose: passi.map((p, i) => ({
          conditions: [{ condition: "trigger", id: `passo_${i}` }],
          sequence: azioniInHA(p.allora, contesto),
        })),
      },
    ],
  };
}

/* Il calendario a fasce: parte a ogni inizio e fine fascia e quando Home
 * Assistant si riaccende, e in quel momento guarda la fascia di oggi —
 * cosi' una casa riavviata nel mezzo di una fascia rimette lo stato giusto. */
const TEMPLATE_DELLE_FASCE =
  `{% set f = ${VARIABILE_DELLE_FASCE}.giorni[now().weekday()] %}{% set m = now().hour * 60 + now().minute %}` +
  "{% set ns = namespace(si=false) %}{% for x in f %}{% if x[0] <= m < x[1] %}{% set ns.si = true %}{% endif %}{% endfor %}" +
  "{{ ns.si }}";

function fasceInHA(c) {
  if (!c.entita.length) return null;
  const ore = new Set();
  for (const giorno of c.giorni)
    for (const [da, a] of giorno) {
      ore.add(da % 1440);
      ore.add(a % 1440);
    }
  const at = [...ore].sort((x, y) => x - y).map((m) => secondiInOra(m * 60));
  const cose = bersaglio(c.entita);
  return {
    mode: "restart",
    variables: { [VARIABILE_DELLE_FASCE]: { ...c } },
    triggers: [
      ...(at.length ? [{ trigger: "time", at }] : []),
      { trigger: "homeassistant", event: "start" },
    ],
    conditions: c.periodo
      ? [{ condition: "template", value_template: templateDelPeriodo(c.periodo) }]
      : [],
    actions: [
      {
        choose: [
          {
            conditions: [{ condition: "template", value_template: TEMPLATE_DELLE_FASCE }],
            sequence: [{ action: "homeassistant.turn_on", target: cose }],
          },
        ],
        ...(c.fuori === "spegni"
          ? { default: [{ action: "homeassistant.turn_off", target: cose }] }
          : {}),
      },
    ],
  };
}

/**
 * La configurazione di Home Assistant di un'automazione della plancia.
 * `null` se non sta in piedi (manca cosa la fa partire, o non fa niente).
 *
 * `azioni` sono le Azioni della plancia (`cd_quick_actions`), `stati` gli
 * stati della casa (per le persone), `descrizione` quella che c'era — chi
 * modifica un'automazione sua non si ritrova la nostra.
 */
export function inHomeAssistant(dato, { azioni = [], stati = {}, descrizione = null } = {}) {
  const a = automazionePulita(dato);
  if (!a) return null;
  const testa = {
    id: a.id,
    alias: a.nome || "GdAHome",
    description: descrizione ?? DESCRIZIONE_GDAHOME,
  };
  if (a.tipo === "crono") {
    if (!a.crono.termostati.length) return null;
    return { ...testa, ...cronoInHA(a.crono) };
  }
  if (a.tipo === "routine") {
    const r = routineInHA(a, { azioni, stati });
    return r ? { ...testa, ...r } : null;
  }
  if (a.tipo === "fasce") {
    const f = fasceInHA(a.fasce);
    return f ? { ...testa, ...f } : null;
  }
  const triggers = triggerDelQuando(a.quando, stati);
  if (!triggers.length) return null;
  const actions = azioniInHA(a.allora, { azioni, stati });
  if (!actions.some((x) => x.delay === undefined)) return null;
  const conditions = [];
  if (a.quando.tipo === "orario" && !a.quando.giorni.every(Boolean))
    conditions.push({ condition: "time", weekday: giorniInHA(a.quando.giorni) });
  const soloSe = a.soloSe.map(condizioneInHA);
  if (soloSe.length > 1 && a.tutte === false)
    conditions.push({ condition: "or", conditions: soloSe });
  else conditions.push(...soloSe);
  if (a.pausa)
    conditions.push({ condition: "template", value_template: templateDellaPausa(a.pausa) });
  if (a.scadenza)
    conditions.push({ condition: "template", value_template: templateDellaScadenza(a.scadenza) });
  return { ...testa, mode: MODO_IN_HA[a.modo] || "restart", triggers, conditions, actions };
}

/* ── da Home Assistant alla plancia ─────────────────────────────────────── */

const solo = (o, chiavi) => Object.keys(o).every((k) => chiavi.includes(k));
const unaSola = (v) => (Array.isArray(v) && v.length === 1 ? v[0] : null);
const minutiInteri = (s) => (typeof s === "number" && s % 60 === 0 ? s / 60 : null);
const oraCorta = (v) => {
  const m = /^(\d{2}):(\d{2}):00$/.exec(pulito(v));
  return m ? `${m[1]}:${m[2]}` : null;
};

function classeDi(statoDi, id) {
  return pulito(statoDi?.(id)?.attributes?.device_class);
}

/* Un trigger, nella forma della plancia. `null` se non ci sta. */
function quandoDiUno(t, statoDi) {
  if (!eOggetto(t)) return null;
  const tipo = t.trigger;
  if (tipo === "time" && solo(t, ["trigger", "at"])) {
    const ore = lista(t.at).map(oraCorta);
    if (!ore.length || ore.some((o) => !o)) return null;
    return { tipo: "orario", ore, sole: "", scarto: 0 };
  }
  if (tipo === "sun" && solo(t, ["trigger", "event", "offset"])) {
    const scarto = t.offset === undefined ? 0 : minutiInteri(t.offset);
    if (scarto === null || !["sunrise", "sunset"].includes(t.event)) return null;
    return {
      tipo: "orario",
      ore: [],
      sole: t.event === "sunrise" ? "alba" : "tramonto",
      scarto,
    };
  }
  if (tipo === "time_pattern") {
    if (solo(t, ["trigger", "minutes"]) && /^\/\d+$/.test(t.minutes))
      return { tipo: "ogni", minuti: Number(t.minutes.slice(1)) };
    if (solo(t, ["trigger", "hours", "minutes"]) && /^\/\d+$/.test(t.hours) && t.minutes === "0")
      return { tipo: "ogni", minuti: Number(t.hours.slice(1)) * 60 };
    return null;
  }
  if (tipo === "numeric_state") {
    const id = unaSola(t.entity_id);
    if (!id || !solo(t, ["trigger", "entity_id", "above", "below", "for"])) return null;
    const sopra = typeof t.above === "number";
    const sotto = typeof t.below === "number";
    if (sopra === sotto) return null;
    if (t.for !== undefined) {
      const m = minutiInteri(t.for);
      return sotto && m
        ? { tipo: "elettrodomestico", entita: id, soglia: t.below, minuti: m }
        : null;
    }
    return {
      tipo: "valore",
      entita: id,
      verso: sotto ? "sotto" : "sopra",
      soglia: sotto ? t.below : t.above,
    };
  }
  if (tipo === "event" && solo(t, ["trigger", "event_type", "event_data"])) {
    const filtro = eOggetto(t.event_data) ? t.event_data : {};
    if (Object.values(filtro).some((v) => typeof v !== "string")) return null;
    return { tipo: "evento", evento: pulito(t.event_type), filtro: { ...filtro } };
  }
  if (tipo !== "state" || !Array.isArray(t.entity_id) || !t.entity_id.length) return null;
  if (!solo(t, ["trigger", "entity_id", "from", "to", "for", "attribute"])) return null;
  const ids = t.entity_id;
  const domini = new Set(ids.map(dominioDi));
  const uno = (d) => domini.size === 1 && domini.has(d);
  const da = t.from;
  const a = t.to;
  const per = t.for === undefined ? 0 : minutiInteri(t.for);
  if (per === null) return null;
  if (t.attribute !== undefined) {
    if (ids.length !== 1 || t.for !== undefined || da !== undefined) return null;
    if (a !== undefined && typeof a !== "string") return null;
    return { tipo: "attributo", entita: ids[0], attributo: pulito(t.attribute), valore: a || "" };
  }
  if (ids.length === 1 && ids[0] === "zone.home" && a === "0" && da === undefined && !per)
    return { tipo: "persone", verso: "tuttiFuori", chi: [] };
  if (ids.every((id) => ["person", "device_tracker"].includes(dominioDi(id))) && !per) {
    if (a === "home" && da === undefined) return { tipo: "persone", verso: "arriva", chi: ids };
    if (da === "home" && a === undefined) return { tipo: "persone", verso: "esce", chi: ids };
  }
  if (uno("alarm_control_panel") && ids.length === 1 && da === undefined && !per) {
    if (firma(a) === firma([...ARMATI]))
      return { tipo: "antifurto", entita: ids[0], verso: "inserito" };
    if (a === "disarmed") return { tipo: "antifurto", entita: ids[0], verso: "disinserito" };
    if (a === "triggered") return { tipo: "antifurto", entita: ids[0], verso: "suona" };
  }
  const classi = ids.map((id) => classeDi(statoDi, id));
  const tutteFra = (ammesse) => classi.every((c) => ammesse.includes(c));
  if (uno("binary_sensor") && tutteFra(["motion", "occupancy", "presence"])) {
    if (da === "off" && a === "on" && !per)
      return { tipo: "movimento", entita: ids, verso: "si", minuti: 5 };
    if (da === undefined && a === "off" && per)
      return { tipo: "movimento", entita: ids, verso: "no", minuti: per };
  }
  if (!per && da !== undefined) {
    if (uno("binary_sensor") && tutteFra(["door", "window", "garage_door", "opening"])) {
      if (da === "off" && a === "on") return { tipo: "apertura", entita: ids, verso: "apre" };
      if (da === "on" && a === "off") return { tipo: "apertura", entita: ids, verso: "chiude" };
    }
  }
  if (!per && da === undefined && (uno("cover") || uno("lock"))) {
    if (a === "open" || a === "unlocked") return { tipo: "apertura", entita: ids, verso: "apre" };
    if (a === "closed" || a === "locked") return { tipo: "apertura", entita: ids, verso: "chiude" };
  }
  if (
    (da !== undefined && typeof da !== "string") ||
    (a !== null && a !== undefined && typeof a !== "string")
  )
    return null;
  return { tipo: "stato", entita: ids, da: da || "", a: a || "", per };
}

function quandoDi(triggers, statoDi) {
  const letti = triggers.map((t) => quandoDiUno(t, statoDi));
  if (!letti.length || letti.some((q) => !q)) return null;
  if (letti.length === 1) return letti[0];
  /* Piu' trigger: solo le aperture di domini diversi, che la plancia scrive
   * una per dominio. */
  if (letti.every((q) => q.tipo === "apertura" && q.verso === letti[0].verso))
    return { tipo: "apertura", entita: letti.flatMap((q) => q.entita), verso: letti[0].verso };
  return null;
}

const ugualeA = (stato, voluto) => firma(stato) === firma(statoScritto(voluto));

function condizioneDi(c) {
  if (!eOggetto(c)) return null;
  const tipo = c.condition;
  if (tipo === "time") {
    if (solo(c, ["condition", "after", "before"]) && c.after && c.before) {
      const da = oraCorta(c.after);
      const a = oraCorta(c.before);
      return da && a ? { tipo: "fascia", da, a } : null;
    }
    if (solo(c, ["condition", "weekday"])) {
      const giorni = GIORNI_HA.map((g) => c.weekday.includes(g));
      return c.weekday.every((g) => GIORNI_HA.includes(g)) ? { tipo: "giorni", giorni } : null;
    }
    return null;
  }
  if (tipo === "not") {
    const dentro = unaSola(c.conditions);
    if (!solo(c, ["condition", "conditions"]) || !dentro) return null;
    const letta = condizioneDi(dentro);
    return letta?.tipo === "uguale" && !letta.non ? { ...letta, non: true } : null;
  }
  const id = unaSola(c.entity_id);
  if (!id) return null;
  if (tipo === "numeric_state") {
    if (!solo(c, ["condition", "entity_id", "above", "below", "attribute"])) return null;
    const sopra = typeof c.above === "number";
    const sotto = typeof c.below === "number";
    if (sopra === sotto) return null;
    if (id === "zone.home" && sopra && c.above === 0 && c.attribute === undefined)
      return { tipo: "casa", chi: "qualcuno" };
    if (c.attribute !== undefined)
      return {
        tipo: "attributo",
        entita: id,
        attributo: pulito(c.attribute),
        confronto: sotto ? "sotto" : "sopra",
        valore: String(sotto ? c.below : c.above),
      };
    return {
      tipo: "valore",
      entita: id,
      verso: sotto ? "sotto" : "sopra",
      soglia: sotto ? c.below : c.above,
    };
  }
  if (tipo !== "state" || !solo(c, ["condition", "entity_id", "state", "attribute"])) return null;
  if (c.attribute !== undefined)
    return typeof c.state === "string"
      ? {
          tipo: "attributo",
          entita: id,
          attributo: pulito(c.attribute),
          confronto: "uguale",
          valore: c.state,
        }
      : null;
  if (id === "sun.sun" && c.state === "below_horizon") return { tipo: "notte", da: "", a: "" };
  if (id === "sun.sun" && c.state === "above_horizon") return { tipo: "sole", posizione: "sopra" };
  if (id === "zone.home" && c.state === "0") return { tipo: "casa", chi: "nessuno" };
  if (ugualeA(c.state, accesoDi(id))) return { tipo: "stato", entita: id, vale: "acceso" };
  if (ugualeA(c.state, spentoDi(id))) return { tipo: "stato", entita: id, vale: "spento" };
  const voluti = lista(c.state);
  if (voluti.some((v) => v.includes(","))) return null;
  return { tipo: "uguale", entita: id, valore: voluti.join(", "), non: false };
}

function opzioniDi(conditions, quando) {
  const resto = [...conditions];
  const fuori = { soloSe: [], tutte: true, pausa: 0, scadenza: null, giorni: null };
  /* In coda: la scadenza, poi la pausa — nell'ordine in cui le scrive
   * `inHomeAssistant`, letto al contrario. */
  const template = (c) =>
    eOggetto(c) && c.condition === "template" && solo(c, ["condition", "value_template"])
      ? pulito(c.value_template)
      : "";
  const scadenza = SCADENZA_LETTA.exec(template(resto.at(-1)));
  if (scadenza) {
    resto.pop();
    fuori.scadenza = { data: scadenza[2], stato: scadenza[1] === "<" ? "attiva" : "spenta" };
  }
  const pausa = PAUSA_LETTA.exec(template(resto.at(-1)));
  if (pausa) {
    resto.pop();
    const m = Number(pausa[1]) / 60;
    if (!Number.isInteger(m)) return null;
    fuori.pausa = m;
  }
  if (quando.tipo === "orario" && resto.length) {
    const primo = condizioneDi(resto[0]);
    if (primo?.tipo === "giorni" && !primo.giorni.every(Boolean)) {
      fuori.giorni = primo.giorni;
      resto.shift();
    }
  }
  let elenco = resto;
  if (
    resto.length === 1 &&
    resto[0]?.condition === "or" &&
    solo(resto[0], ["condition", "conditions"])
  ) {
    elenco = lista(resto[0].conditions);
    fuori.tutte = false;
  }
  for (const c of elenco) {
    const letta = condizioneDi(c);
    if (!letta) return null;
    fuori.soloSe.push(letta);
  }
  return fuori;
}

const SERVIZI_SULLE_COSE = {
  turn_on: "accendi",
  turn_off: "spegni",
};

function azioneDiUna(x) {
  if (!eOggetto(x)) return null;
  if (x.delay !== undefined) {
    const m = solo(x, ["delay"]) ? minutiInteri(x.delay) : null;
    return m ? { tipo: "aspetta", minuti: m } : null;
  }
  if (x.wait_template !== undefined) {
    if (!solo(x, ["wait_template", "timeout"])) return null;
    const massimo = minutiInteri(x.timeout);
    if (!massimo || massimo > ASPETTA_AL_MASSIMO) return null;
    const testo = pulito(x.wait_template);
    const soglia = ATTESA_SOGLIA.exec(testo);
    if (soglia)
      return { tipo: "aspettaChe", entita: soglia[1], stato: `${soglia[2]}${soglia[3]}`, massimo };
    const stato = ATTESA_STATO.exec(testo);
    return stato ? { tipo: "aspettaChe", entita: stato[1], stato: stato[2], massimo } : null;
  }
  if (x.event === EVENTO_AVVISA) {
    const d = x.event_data;
    return solo(x, ["event", "event_data"]) &&
      eOggetto(d) &&
      solo(d, ["titolo", "testo"]) &&
      d.titolo === TITOLO_DELL_AVVISO &&
      typeof d.testo === "string"
      ? { tipo: "notifica", testo: d.testo }
      : null;
  }
  if (typeof x.action !== "string" || !solo(x, ["action", "target", "data"])) return null;
  if (x.target && !solo(x.target, ["entity_id"])) return null;
  const entita = x.target?.entity_id || [];
  const dati = x.data || {};
  const [dominio, servizio] = x.action.split(".");
  const tutteDi = (d) => entita.length > 0 && entita.every((e) => dominioDi(e) === d);
  const datiSolo = (chiavi) => solo(dati, chiavi);
  if (!entita.length)
    return { tipo: "servizio", servizio: x.action, entita: [], dati: { ...dati } };
  /* Accendi e spegni: il servizio del dominio, o `homeassistant` per gli
   * altri — come li sceglie `serviziDellAzione`. */
  if (SERVIZI_SULLE_COSE[servizio] && (tutteDi(dominio) || dominio === "homeassistant")) {
    const tipo = SERVIZI_SULLE_COSE[servizio];
    if (dominio === "light" && tipo === "accendi" && datiSolo(["brightness_pct"]))
      return { tipo, entita, ...(dati.brightness_pct ? { livello: dati.brightness_pct } : {}) };
    if (dominio === "climate" && tipo === "spegni" && datiSolo([]))
      return { tipo: "clima", entita, modo: "spegni" };
    if (datiSolo([])) return { tipo, entita };
  }
  if (["button", "input_button"].includes(dominio) && servizio === "press" && datiSolo([]))
    return { tipo: "accendi", entita };
  if (dominio === "cover" && tutteDi("cover")) {
    if (servizio === "open_cover" && datiSolo([]))
      return { tipo: "tapparella", entita, modo: "apri" };
    if (servizio === "close_cover" && datiSolo([]))
      return { tipo: "tapparella", entita, modo: "chiudi" };
    if (servizio === "set_cover_position" && datiSolo(["position"]))
      return { tipo: "tapparella", entita, modo: "posizione", posizione: dati.position };
  }
  if (dominio === "media_player" && tutteDi("media_player")) {
    const comando = {
      media_play: "play",
      media_pause: "pausa",
      media_stop: "stop",
      media_next_track: "successivo",
    }[servizio];
    if (comando && datiSolo([])) return { tipo: "media", entita, comando };
    if (servizio === "volume_set" && datiSolo(["volume_level"]))
      return {
        tipo: "media",
        entita,
        comando: "volume",
        valore: String(Math.round(dati.volume_level * 100)),
      };
    if (servizio === "select_source" && datiSolo(["source"]))
      return { tipo: "media", entita, comando: "sorgente", valore: String(dati.source) };
  }
  if (entita.length === 1 && DOMINI.imposta.includes(dominio) && tutteDi(dominio)) {
    if (["select_option"].includes(servizio) && datiSolo(["option"]))
      return { tipo: "imposta", entita: entita[0], valore: String(dati.option) };
    if (servizio === "set_value" && datiSolo(["value"]))
      return { tipo: "imposta", entita: entita[0], valore: String(dati.value) };
  }
  return { tipo: "servizio", servizio: x.action, entita, dati: { ...dati } };
}

function azioniDi(actions) {
  const fuori = [];
  for (let i = 0; i < actions.length; i += 1) {
    const x = actions[i];
    const dopo = actions[i + 1];
    /* «Clima a 21°» sono due passi: acceso, poi la temperatura. */
    if (
      x?.action === "homeassistant.turn_on" &&
      dopo?.action === "climate.set_temperature" &&
      firma(x.target) === firma(dopo.target) &&
      solo(dopo, ["action", "target", "data"]) &&
      solo(dopo.data || {}, ["temperature"]) &&
      typeof dopo.data?.temperature === "number"
    ) {
      fuori.push({
        tipo: "clima",
        entita: x.target.entity_id,
        modo: "temperatura",
        gradi: dopo.data.temperature,
      });
      i += 1;
      continue;
    }
    const letta = azioneDiUna(x);
    if (!letta) return null;
    fuori.push(letta);
  }
  return fuori;
}

/**
 * Un'automazione di Home Assistant nella forma della plancia, se ci sta
 * tutta: `null` vuol dire «complessa». `statoDi` aiuta solo a scegliere il
 * racconto piu' giusto — un sensore di movimento e' «c'e' movimento», non
 * «passa da off a on» — e la prova del ritorno non cambia.
 */
export function dallaHomeAssistant(config, { statoDi = null, azioni = [], stati = {} } = {}) {
  if (!eOggetto(config)) return null;
  const id = pulito(config.id);
  if (!id) return null;
  const n = normalizzata(config);
  if (n.altre.length) return null;
  const nome = pulito(config.alias).slice(0, 60);
  let modello = null;
  const crono = n.variables?.[VARIABILE_DEL_CRONO];
  const routine = n.variables?.[VARIABILE_DELLA_ROUTINE];
  const fasce = n.variables?.[VARIABILE_DELLE_FASCE];
  if (crono) {
    modello = { id, nome, attiva: true, tipo: "crono", crono: cronoPulito(crono) };
  } else if (fasce) {
    modello = { id, nome, attiva: true, tipo: "fasce", fasce: calendarioPulito(fasce) };
  } else if (routine) {
    /* I «solo se» della routine stanno dopo i giorni e il periodo. */
    const r = routinePulita(routine);
    const davanti = (r.giorni.every(Boolean) ? 0 : 1) + (r.periodo ? 1 : 0);
    const opzioni = opzioniDi(n.conditions.slice(davanti), { tipo: "routine" });
    if (!opzioni) return null;
    modello = {
      id,
      nome,
      attiva: true,
      tipo: "routine",
      routine: r,
      soloSe: opzioni.soloSe,
      tutte: opzioni.tutte,
    };
  } else {
    if (n.variables) return null;
    const quando = quandoDi(n.triggers, statoDi);
    if (!quando) return null;
    const opzioni = opzioniDi(n.conditions, quando);
    if (!opzioni) return null;
    if (opzioni.giorni) quando.giorni = opzioni.giorni;
    const allora = azioniDi(n.actions);
    if (!allora) return null;
    modello = {
      id,
      nome,
      attiva: true,
      tipo: "regola",
      quando,
      soloSe: opzioni.soloSe,
      tutte: opzioni.tutte,
      allora,
      modo: MODO_DA_HA[n.mode] || "ignora",
      pausa: opzioni.pausa,
      ...(opzioni.scadenza ? { scadenza: opzioni.scadenza } : {}),
    };
  }
  const pulita = automazionePulita(modello);
  if (!pulita) return null;
  /* La prova: ritradotta, deve tornare la stessa. */
  const ritorno = inHomeAssistant(pulita, { azioni, stati, descrizione: config.description });
  if (!ritorno || !stessaConfigurazione(ritorno, config)) return null;
  return pulita;
}

/* ── per l'elenco ───────────────────────────────────────────────────────── */

/* Tutte le entita' di un pezzo di configurazione, a qualunque profondita'. */
/* Tutte le entita' nominate, a qualunque profondita': anche quelle dentro
 * `target`, `data` e le scelte. (Prima l'«else» si attaccava all'«if»
 * sbagliato e dentro `target` non si guardava: un'automazione che inserisce
 * l'antifurto finiva fra le «Altre».) */
function entitaDentro(x, fuori = new Set()) {
  if (Array.isArray(x)) for (const y of x) entitaDentro(y, fuori);
  else if (eOggetto(x))
    for (const [k, v] of Object.entries(x)) {
      if (k === "entity_id") {
        for (const e of lista(v)) if (typeof e === "string") fuori.add(e);
      } else entitaDentro(v, fuori);
    }
  return fuori;
}

/* L'irrigazione si riconosce dal nome: di una valvola o di un interruttore,
 * o dell'automazione stessa. */
const IRRIGAZIONE = /irrig|sprinkl|annaff/i;

function serviziDentro(x, fuori = new Set()) {
  if (Array.isArray(x)) for (const y of x) serviziDentro(y, fuori);
  else if (eOggetto(x)) {
    const s = x.action ?? x.service;
    if (typeof s === "string" && s.includes(".")) fuori.add(s);
    if (x.event === EVENTO_AVVISA) fuori.add("gdahome.avvisa");
    for (const [k, v] of Object.entries(x))
      if (k !== "action" && k !== "service") serviziDentro(v, fuori);
  }
  return fuori;
}

const AVVISI = /^(notify|persistent_notification|tts|gdahome)\./;

/**
 * Il gruppo «Per tipo» di un'automazione, da cosa guarda e cosa fa: la
 * sicurezza prima di tutto (un antifurto che accende le luci e' sicurezza),
 * poi luci, clima e tapparelle dalle azioni, gli avvisi quando non fa altro,
 * l'energia quando guarda una potenza.
 */
export function categoriaDi(config, statoDi = null) {
  const n = normalizzata(config);
  const guarda = [...entitaDentro([n.triggers, n.conditions])];
  const fa = [...entitaDentro(n.actions)];
  const servizi = [...serviziDentro(n.actions)];
  const domini = (ids) => new Set(ids.map(dominioDi));
  const fatti = domini(fa);
  const tutti = domini([...guarda, ...fa]);
  for (const s of servizi)
    if (s.startsWith("alarm_control_panel.")) tutti.add("alarm_control_panel");
  if (["alarm_control_panel", "lock", "siren"].some((d) => tutti.has(d))) return "sicurezza";
  /* L'irrigazione: una valvola, o un interruttore che si chiama come lei. */
  const nomeDi = (id) => `${id} ${pulito(statoDi?.(id)?.attributes?.friendly_name)}`;
  if (
    fa.some((id) => ["valve", "switch"].includes(dominioDi(id)) && IRRIGAZIONE.test(nomeDi(id))) ||
    fa.some((id) => dominioDi(id) === "valve" && !/gas|acqua_?generale/i.test(nomeDi(id))) ||
    servizi.some((s) => IRRIGAZIONE.test(s))
  )
    return "irrigazione";
  for (const s of servizi) fatti.add(s.split(".")[0]);
  if (fatti.has("light")) return "luci";
  if (["climate", "humidifier", "fan"].some((d) => fatti.has(d))) return "clima";
  if (fatti.has("cover")) return "tapparelle";
  const avvisi = servizi.filter((s) => AVVISI.test(s));
  const altro = servizi.filter((s) => !AVVISI.test(s));
  if (avvisi.length && !altro.length) return "avvisi";
  const energia = guarda.some((id) => {
    const s = statoDi?.(id);
    const classe = pulito(s?.attributes?.device_class);
    const unita = pulito(s?.attributes?.unit_of_measurement).toLowerCase();
    return (
      ["power", "energy"].includes(classe) ||
      ["w", "kw", "kwh", "wh"].includes(unita) ||
      /solar|solare|fotovolt|pv_|energia|energy/.test(id)
    );
  });
  if (energia || fatti.has("water_heater")) return "energia";
  if (avvisi.length) return "avvisi";
  if (IRRIGAZIONE.test(pulito(config?.alias))) return "irrigazione";
  return "altre";
}

/** Da dove viene: «gdahome» (nata dalla plancia), «blueprint», o niente. */
export function origineDi(config) {
  if (!eOggetto(config)) return "";
  if (config.use_blueprint) return "blueprint";
  return pulito(config.description).includes(SEGNO_GDAHOME) ? "gdahome" : "";
}

/** Un id nuovo per Home Assistant: cifre, come quelli che scrive la sua pagina. */
export function nuovoIdHA(adesso = Date.now(), caso = Math.random()) {
  return `${Math.floor(adesso)}${String(Math.floor(caso * 1000)).padStart(3, "0")}`;
}

const ID_DI_HA = /^[A-Za-z0-9_-]{1,64}$/;
/** Un id che si puo' mettere in un indirizzo di Home Assistant. */
export const idBuono = (id) => ID_DI_HA.test(pulito(id));
