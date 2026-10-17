/* L'assistente di casa, accanto alle persone (#175).
 *
 * «Lo voglio molto molto intelligente, e sempre vivo.» La card dice la cosa
 * piu' importante da fare adesso come un messaggio della casa — con il tasto
 * che la fa, «Più tardi» e ✕ — e «vedi tutti» apre l'elenco intero in ordine
 * di urgenza, con in fondo «Chiedi alla casa…».
 *
 * «Chiedi alla casa…» risponde PRIMA da qui, con quello che la plancia sa
 * (`core/capire-le-domande.js`, `core/sapere-della-casa.js`,
 * `core/rispondere-alle-domande.js`): «Che temperatura è presente in casa»
 * mandato all'agente di serie di Home Assistant tornava «non conosco nessuna
 * area chiamata è presente in casa». Solo quello che qui non si capisce va ad
 * Assist — al modello linguistico, se in casa ce n'e' uno — e se anche Assist
 * non capisce, la casa lo dice gentilmente e propone cosa chiedere.
 *
 * Qui c'e' quello che sta fuori dal nucleo (`core/assistente-di-casa.js`):
 * mettere insieme il contesto con quello che la plancia sa gia' — le tessere
 * della Home, le letture dell'energia, le previsioni ora per ora — e
 * disegnarlo, e fare quello che si tocca. Il posto della card nella fila delle
 * persone lo decide `core/accanto-alle-persone.js`.
 *
 * SEMPRE VIVO. Si ricalcola a ogni cambio della casa (raccolto: dieci notizie
 * in un secondo sono un giro solo) e comunque una volta al minuto, anche senza
 * che nessuno tocchi niente e anche con la Home nascosta: sul tablet a muro lo
 * schermo resta acceso e nessuno lo tocca per ore. Il battito non dipende da
 * niente che si fermi a riposo.
 */
import {
  ACCANTO_DI_SERIE,
  CHIAVE_ACCANTO,
  normalizzaAccanto,
  postoAccanto,
} from "../core/accanto-alle-persone.js";
import {
  CHIAVE_ASSISTENTE,
  chiEInCasa,
  conIFiniti,
  conLaRisposta,
  finoA,
  memoriaDopo,
  memoriaPulita,
  opzioniDellAssistente,
  pioggiaFra,
  suggerimentiDellaCasa,
} from "../core/assistente-di-casa.js";
import { alarmCodeNeeded } from "../core/alarm-panel.js";
import {
  CHIAVE_ASSIST,
  CONVERSAZIONE_MS,
  agenteDaUsare,
  domandaPerHomeAssistant,
  filoDaMandare,
  linguaPerIlMicrofono,
  normalizzaAssist,
  rispostaDi,
} from "../core/assist-model.js";
import {
  esempi,
  nonHoCapito,
  rispondiDaCasa,
  rispostaAllAnnullo,
  rispostaCheNonRisponde,
} from "../core/rispondere-alle-domande.js";
import { sapereDellaCasa } from "../core/sapere-della-casa.js";
import { disegnoDelCatalogo } from "../core/catalogo-disegni.js";
import { comandoDelDispositivo, elencoComandi } from "../core/comandi-accanto.js";
import { SOGLIA_POTENZA_KEY, sogliaDellaPotenza } from "../core/la-soglia-della-potenza.js";
import { normalizePeople, personViewModel } from "../core/person-model.js";
import { VELO_DELLE_FINESTRE, tokenDelVelo } from "../core/il-velo-delle-finestre.js";
import { entitaDelMeteo, previsioniDeiGiorni } from "./la-card-del-meteo-section.js";
import { configuredLightGroups } from "./lights-alerts-section.js";
import {
  activeLocale,
  allStates,
  chiediAHomeAssistant,
  clean,
  doc,
  esc,
  installStyle,
  lexicalGlobal,
  readJson,
  root,
  section,
  siComanda,
  stanzaDiHomeAssistant,
  t,
  writeJsonIfChanged,
  senzaCadere,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_ASSISTENTE_DI_CASA__";
const state = (root[KEY] ||= {
  installed: false,
  firma: "",
  modelli: [],
  modelliIl: 0,
  fonti: null,
  energia: null,
  suggerimenti: [],
  previsioni: [],
  previsioniChieste: 0,
  battito: 0,
  raccolta: 0,
  aperto: false,
  rinvio: "",
  battute: [],
  inVolo: false,
  filo: "",
  filoIl: 0,
  /* La conversazione con la casa: di cosa si parlava, l'azione in attesa. */
  memoria: {},
  memoriaIl: 0,
  /* Le previsioni dei giorni, quando la card del meteo non le ha ancora. */
  giorni: [],
  giorniIl: 0,
  ascolto: null,
  osservatore: null,
  osservata: null,
});

/* Le macchine che finiscono: lo sa solo chi le ha viste lavorare, quindi
 * resta su questo dispositivo. */
const CHIAVE_FINITI = "dm_assistente_finiti";
const UN_MINUTO = 60_000;
const MEZZ_ORA = 30 * UN_MINUTO;

/** Cosa si e' scelto di mettere accanto alle persone. */
export function cosaAccanto() {
  return normalizzaAccanto(readJson(CHIAVE_ACCANTO, { mostra: ACCANTO_DI_SERIE })).mostra;
}

function scelte() {
  const dato = readJson(CHIAVE_ASSISTENTE, {}) || {};
  return {
    opzioni: opzioniDellAssistente(dato.opzioni),
    memoria: memoriaPulita(dato.memoria),
  };
}

function scrivi(memoria) {
  const dato = readJson(CHIAVE_ASSISTENTE, {}) || {};
  writeJsonIfChanged(CHIAVE_ASSISTENTE, { ...dato, memoria: memoriaPulita(memoria) });
}

/* ── il contesto: quello che la casa sa adesso ───────────────────────────── */

const modello = (chiave) => state.modelli.find((m) => clean(m?.key) === chiave) || null;
const elenco = (valore) => (Array.isArray(valore) ? valore.filter(Boolean) : []);

function daQuando(states, entity, adesso) {
  const quando = Date.parse(states?.[entity]?.last_changed || states?.[entity]?.last_updated || "");
  return Number.isFinite(quando) ? Math.max(0, adesso - quando) : null;
}

function persone(states, adesso) {
  const tutte = normalizePeople(readJson("cd_people", [])).filter((p) => p?.nascosta !== true);
  const viste = tutte.map((persona) => ({
    ...personViewModel(persona, states, adesso),
    entita: clean(persona.entity),
  }));
  const { totale, inCasa, incerte, fuori } = chiEInCasa(viste);
  let ultimaUscita = 0;
  for (const vista of fuori) {
    const uscita = Date.parse(states?.[vista.entita]?.last_changed || "");
    if (Number.isFinite(uscita)) ultimaUscita = Math.max(ultimaUscita, uscita);
  }
  return { totale, inCasa, incerte, ultimaUscita: inCasa || incerte ? 0 : ultimaUscita };
}

/* Il comando che fa partire un apparecchio, fra i suoi «Altri comandi»: un
 * tasto o uno script che si chiama come una partenza. Senza, l'assistente
 * non propone di avviarlo — dirlo senza poterlo fare sarebbe un consiglio a
 * meta'. */
const PARTENZA = /(start|avvi|inizia|run|play)/i;
const FERMATA = /(stop|ferma|pausa|pause|off|spegni)/i;
function comandoDiAvvio(dispositivo) {
  const voce = elencoComandi(dispositivo?.comandi).find(
    (entity) => PARTENZA.test(entity) && !FERMATA.test(entity),
  );
  if (!voce) return null;
  const comando = comandoDelDispositivo({ entity: voce });
  if (!comando) return null;
  const servizio = comando.service === "toggle" ? "turn_on" : comando.service;
  return { dominio: comando.domain, servizio, dati: comando.data };
}

function elettrodomestici() {
  const configurati = new Map(
    elenco(section("appliances", readJson("cd_appliances", []))).map((d) => [clean(d.id), d]),
  );
  return elenco(modello("elettrodomestici")?.rows).map((riga) => {
    const dispositivo = configurati.get(clean(riga.id)) || {};
    return {
      id: clean(riga.id),
      entity: clean(dispositivo.power_entity || dispositivo.entity || riga.id),
      name: clean(riga.name),
      mode: clean(riga.mode),
      tipo: clean(riga.type),
      avvia: comandoDiAvvio(dispositivo),
    };
  });
}

function finiti(macchine, adesso) {
  const prima = readJson(CHIAVE_FINITI, {}) || {};
  const dopo = conIFiniti(prima, macchine, adesso);
  writeJsonIfChanged(CHIAVE_FINITI, dopo, { sync: false });
  return macchine
    .filter((m) => dopo[m.id]?.finitoIl > 0)
    .map((m) => ({ ...m, finitoIl: dopo[m.id].finitoIl }));
}

const coperture = (states, classi) =>
  Object.entries(states || {})
    .filter(
      ([entity, stato]) =>
        entity.startsWith("cover.") &&
        classi.includes(clean(stato?.attributes?.device_class)) &&
        ["open", "opening"].includes(clean(stato?.state)),
    )
    .map(([entity, stato]) => ({
      entity,
      name: clean(stato?.attributes?.friendly_name) || entity,
      aperto: true,
      aperta: true,
    }));

const FRIGO = /(frig|freez|congel)/i;

function frighi(states, adesso) {
  return Object.entries(states || {})
    .filter(
      ([entity, stato]) =>
        entity.startsWith("binary_sensor.") &&
        ["door", "opening"].includes(clean(stato?.attributes?.device_class)) &&
        FRIGO.test(`${entity} ${clean(stato?.attributes?.friendly_name)}`),
    )
    .map(([entity, stato]) => ({
      entity,
      name: clean(stato?.attributes?.friendly_name) || entity,
      aperto: clean(stato?.state) === "on",
      daMs: daQuando(states, entity, adesso),
    }));
}

function stanze(states) {
  const fuori = elenco(modello("temperatura")?.rows).map((r) => ({
    name: clean(r.name),
    entity: clean(r.entity),
    temperatura: r.temperature,
    umidita: r.humidity,
    /* All'aperto (#251): il nucleo la legge, ma non propone di scaldarla,
     * rinfrescarla o arieggiarla. */
    fuori: r.fuori === true,
  }));
  for (const riga of elenco(modello("aria")?.rows)) {
    const stato = states?.[clean(riga.entity)];
    if (clean(stato?.attributes?.device_class) !== "carbon_dioxide") continue;
    const valore = Number(stato?.state);
    if (!Number.isFinite(valore)) continue;
    fuori.push({ name: clean(riga.name), co2: valore, entityCo2: clean(riga.entity) });
  }
  return fuori;
}

function antifurto(states) {
  const sicurezza = modello("sicurezza");
  let entity = "";
  try {
    entity = clean(root.resolveEntity?.("dm.security_centrale_allarme"));
  } catch (_errore) {}
  if (!entity || !states?.[entity] || !sicurezza?.alarm) return null;
  return {
    entity,
    inserito: Boolean(sicurezza.armed),
    scattato: Boolean(sicurezza.triggered),
    serveIlCodice: alarmCodeNeeded(states[entity], "alarm_arm_away"),
  };
}

function meteo(states, adesso) {
  const entita = entitaDelMeteo(states);
  const condizione = clean(states?.[entita]?.state);
  const prossime = state.previsioni.filter((voce) => {
    const quando = Date.parse(voce?.datetime || "");
    return (
      Number.isFinite(quando) && quando >= adesso - 3_600_000 && quando <= adesso + 3 * 3_600_000
    );
  });
  return {
    pioggiaFra: pioggiaFra(state.previsioni, adesso, condizione),
    soleNelleProssimeOre:
      prossime.length > 0 &&
      prossime.every((voce) => ["sunny", "partlycloudy"].includes(clean(voce?.condition))),
  };
}

/** Il contesto per il nucleo: tutto quello che la casa sa adesso. */
export function contestoDellaCasa(states = allStates(), adesso = Date.now()) {
  const varchi = modello("varchi");
  const finestre = new Map();
  for (const voce of [
    ...elenco(varchi?.finestreAperte),
    ...elenco(modello("tapparelle")?.contattiAperti),
  ])
    if (voce.entity && !finestre.has(voce.entity))
      finestre.set(voce.entity, {
        entity: voce.entity,
        name: clean(voce.name) || voce.entity,
        stanza: stanzaDiHomeAssistant(voce.entity),
      });
  const macchine = elettrodomestici();
  const allagamenti = modello("allagamenti");
  const presenza = modello("presenza");
  const energia = state.energia || {};
  return {
    adesso,
    ora: new Date(adesso).getHours(),
    persone: persone(states, adesso),
    /* Le luci delle sezioni che le possiedono (Animali: l'acquario, il
     * terrario): restano accese per conto loro. */
    lasciate: [
      ...new Set(
        JSON.stringify(readJson("cd_animali", []) || []).match(/\b(light|switch)\.[a-z0-9_]+/g) ||
          [],
      ),
    ],
    luci: elenco(modello("luci")?.rows).map((r) => ({
      entity: clean(r.entity),
      name: clean(r.name),
      stanza: clean(r.room),
      on: Boolean(r.on),
      daMs: daQuando(states, clean(r.entity), adesso),
    })),
    clima: elenco(modello("clima")?.rows).map((r) => ({
      entity: clean(r.entity),
      name: clean(r.name),
      stanza: clean(r.stanza),
      on: Boolean(r.on),
      mode: clean(r.mode),
    })),
    media: elenco(modello("media")?.suonano).map((r) => ({
      entity: clean(r.entity),
      name: clean(r.nome || r.name),
    })),
    finestre: [...finestre.values()],
    porte: elenco(varchi?.porteAperte).map((v) => ({ entity: v.entity, name: clean(v.name) })),
    serrature: elenco(modello("porte")?.open).map((p) => ({
      entity: clean(p.entity),
      name: clean(p.name),
      aperta: true,
    })),
    garage: coperture(states, ["garage", "gate"]),
    tende: coperture(states, ["awning"]),
    meteo: meteo(states, adesso),
    elettrodomestici: macchine,
    finiti: finiti(macchine, adesso),
    energia: {
      solare: energia.solare ?? null,
      rete: energia.rete ?? null,
      casa: energia.casa ?? null,
      /* La soglia scritta per il colore della potenza: la rossa se c'e'. */
      soglia: (() => {
        const soglia = sogliaDellaPotenza(readJson(SOGLIA_POTENZA_KEY, {}));
        return soglia.rossa ?? soglia.ambra ?? null;
      })(),
    },
    auto: elenco(modello("ev")?.vetture).map((v) => ({
      nome: clean(v.nome),
      attaccata: Boolean(v.inCarica),
      kw: v.kw,
      percentuale: v.percentuale,
      target: v.target,
    })),
    antifurto: antifurto(states),
    batterie: elenco(modello("batterie")?.low).map((b) => ({
      entity: b.entity,
      name: clean(b.name),
      level: b.level,
    })),
    nonRispondono: elenco(modello("nonrisponde")?.rows),
    aggiornamenti: elenco(modello("aggiornamenti")?.aggiornamenti),
    rifiuti: elenco(modello("rifiuti")?.rows).filter((r) => ["oggi", "domani"].includes(r.quando)),
    eventi: elenco(modello("agenda")?.eventi),
    allagamenti: elenco(allagamenti?.rows).filter((r) => r.on),
    valvole: elenco(allagamenti?.valvole).map((v) => ({
      entity: v.entity,
      name: v.name,
      aperta: v.state === "open",
      chiudi: { dominio: "valve", servizio: "close_valve", dati: { entity_id: v.entity } },
    })),
    fumo: elenco(modello("fumo")?.rows).filter((r) => r.on),
    stanze: stanze(states),
    frigo: frighi(states, adesso),
    stanzeOccupate: elenco(presenza?.occupate),
    ciSonoPresenze: Boolean(presenza),
  };
}

/* ── le previsioni ora per ora ───────────────────────────────────────────── */

/* Come la card del meteo, ma ora per ora: la pioggia che arriva fra un'ora
 * non sta nelle previsioni dei giorni. Una domanda ogni mezz'ora. */
function chiediLePrevisioni() {
  const adesso = Date.now();
  if (adesso - state.previsioniChieste < MEZZ_ORA) return;
  const entita = entitaDelMeteo();
  if (!entita) return;
  state.previsioniChieste = adesso;
  chiediAHomeAssistant({
    type: "call_service",
    domain: "weather",
    service: "get_forecasts",
    service_data: { type: "hourly" },
    target: { entity_id: entita },
    return_response: true,
  })
    .then((risposta) => {
      const ore = risposta?.response?.[entita]?.forecast;
      state.previsioni = Array.isArray(ore) ? ore : [];
      ricalcola();
    })
    .catch(() => {
      /* Un meteo senza previsioni orarie: si riprova fra cinque minuti. */
      state.previsioniChieste = adesso - MEZZ_ORA + 5 * UN_MINUTO;
    });
}

/* ── il giro ──────────────────────────────────────────────────────────────── */

/** I suggerimenti di adesso, in ordine. */
export function suggerimentiDiAdesso() {
  return state.suggerimenti;
}

/** Il primo, quello da dire: lo legge anche il tablet a muro. */
export function consiglioInCima() {
  return state.suggerimenti[0] || null;
}

/* Si ricalcola tutto: il contesto, l'elenco, e la card se e' cambiata. La
 * memoria si ripulisce da quello che non serve piu' — un «Fatto» di una cosa
 * che non c'e' piu', un rinvio scaduto — e si scrive solo se e' cambiata. */
export function ricalcola() {
  if (cosaAccanto() === "niente") {
    state.suggerimenti = [];
    sistemaIlPostoAccanto();
    return;
  }
  const adesso = Date.now();
  rinfrescaIModelli(adesso);
  const { opzioni, memoria } = scelte();
  let contesto;
  try {
    contesto = contestoDellaCasa(allStates() || {}, adesso);
  } catch (errore) {
    root.console?.warn?.("[DashboardModern] assistente", errore);
    return;
  }
  const tutti = suggerimentiDellaCasa(contesto, memoria, opzioni, activeLocale());
  /* La pulizia guarda anche quelli nascosti: per sapere se un «Fatto» vale
   * ancora serve sapere se la cosa c'e', non se si vede. */
  const presenti = suggerimentiDellaCasa(
    contesto,
    {},
    { ...opzioni, sensibilita: "tutto" },
    activeLocale(),
  ).map((s) => s.id);
  const pulita = memoriaDopo(memoria, presenti, adesso);
  if (JSON.stringify(pulita) !== JSON.stringify(memoria)) scrivi(pulita);
  state.suggerimenti = tutti;
  sistemaIlPostoAccanto();
  if (state.aperto) disegnaIlFoglio();
}

function raccogli() {
  if (state.raccolta) return;
  state.raccolta =
    root.setTimeout?.(() => {
      state.raccolta = 0;
      ricalcola();
    }, 600) || 0;
}

/* Le fonti dei modelli, date dalla Home quando si installa: cosi' l'assistente
 * non dipende dal fatto che la Home si stia disegnando. Su un'altra pagina, o
 * sul tablet a muro col riposo davanti, la Home non si ridisegna — e' giusto,
 * non la guarda nessuno — ma l'assistente deve sapere lo stesso che la casa
 * si e' svuotata. */
export function registraLeFontiDellAssistente(fonti) {
  state.fonti = fonti && typeof fonti.modelli === "function" ? fonti : null;
}

/* Se la Home ha disegnato da poco i modelli sono suoi, e si riusano: farli
 * due volte per la stessa casa sarebbe il doppio del lavoro. Se no, si fanno
 * qui. */
const MODELLI_FRESCHI = 5_000;
function rinfrescaIModelli(adesso) {
  if (!state.fonti || adesso - state.modelliIl < MODELLI_FRESCHI) return;
  try {
    const modelli = state.fonti.modelli();
    if (Array.isArray(modelli)) state.modelli = modelli;
    if (typeof state.fonti.energia === "function") state.energia = state.fonti.energia();
    state.modelliIl = adesso;
  } catch (errore) {
    root.console?.warn?.("[DashboardModern] assistente", errore);
  }
}

/**
 * Quello che la Home ha appena letto: i modelli delle tessere — tutte, anche
 * quelle spente nella scheda Widget — e le letture dell'energia, chieste solo
 * qui e solo se servono.
 */
export function disegnaAccantoAllePersone(modelli, { energia } = {}) {
  state.modelli = Array.isArray(modelli) ? modelli : [];
  state.modelliIl = Date.now();
  try {
    if (typeof energia === "function") state.energia = energia();
  } catch (_errore) {
    state.energia = null;
  }
  chiediLePrevisioni();
  raccogli();
  return true;
}

/* ── il posto nella fila ──────────────────────────────────────────────────── */

function corsieDellaFila(fila) {
  const tracce = clean(root.getComputedStyle?.(fila)?.gridTemplateColumns);
  if (!tracce || tracce === "none") return 0;
  return tracce.split(/\s+/).filter(Boolean).length;
}

function sulTelefono() {
  try {
    return Boolean(root.matchMedia?.("(max-width:520px)")?.matches);
  } catch (_errore) {
    return false;
  }
}

function liberaLaFila(fila) {
  fila.querySelector(":scope > .dm-assistente")?.remove();
  delete fila.dataset.accanto;
  const griglia = fila.querySelector(":scope > .dm-people-grid");
  if (griglia) {
    griglia.style.removeProperty("grid-column");
    griglia.style.removeProperty("grid-template-columns");
  }
  state.firma = "";
}

/**
 * Mette a posto la fila e scrive la card. Si chiama a ogni giro, dopo ogni
 * disegno delle persone e quando la fila cambia larghezza; il contenuto si
 * riscrive solo quando cambia, cosi' un tocco a meta' non va perso.
 */
export function sistemaIlPostoAccanto() {
  const fila = doc?.querySelector?.("#dm-people .dm-people-fila");
  if (!fila) return false;
  osservaLaFila(fila);
  const griglia = fila.querySelector(":scope > .dm-people-grid");
  if (cosaAccanto() === "niente" || !griglia) {
    liberaLaFila(fila);
    return false;
  }
  fila.querySelector(":scope > .dm-assistente")?.style.removeProperty("grid-column");
  griglia.style.removeProperty("grid-column");
  griglia.style.removeProperty("grid-template-columns");
  const posto = postoAccanto({
    colonne: corsieDellaFila(fila),
    persone: griglia.querySelectorAll(".dm-person-card").length,
    telefono: sulTelefono(),
  });
  if (!posto.accanto && !posto.sotto) {
    liberaLaFila(fila);
    return false;
  }
  let card = fila.querySelector(":scope > .dm-assistente");
  if (!card) {
    card = doc.createElement("aside");
    card.className = "dm-assistente";
    card.setAttribute("aria-live", "polite");
    fila.append(card);
  }
  card.style.removeProperty("height");
  if (posto.accanto) {
    fila.dataset.accanto = "true";
    /* Alta come le persone: la riga resta una riga, e il messaggio si stringe
     * in due righe invece di allungare la fila. */
    const persona = griglia.querySelector(".dm-person-card");
    const alta = Math.round(persona?.getBoundingClientRect?.().height || 0);
    if (alta > 0) card.style.height = `${alta}px`;
    griglia.style.gridColumn = `1 / span ${posto.persone}`;
    griglia.style.gridTemplateColumns = `repeat(${posto.persone},minmax(0,1fr))`;
    card.style.gridColumn = `${posto.persone + 1} / span ${posto.larghezza}`;
    card.dataset.larghezza = String(posto.larghezza);
    card.dataset.posto = "accanto";
  } else {
    delete fila.dataset.accanto;
    card.style.gridColumn = "1 / -1";
    card.dataset.larghezza = "tutta";
    card.dataset.posto = "sotto";
  }
  const dentro = cardMarkup();
  if (state.firma !== dentro || !card.childElementCount) {
    state.firma = dentro;
    card.innerHTML = dentro;
  }
  return true;
}

function osservaLaFila(fila) {
  if (state.osservata === fila || typeof root.ResizeObserver !== "function") return;
  state.osservatore?.disconnect?.();
  state.osservata = fila;
  let larghezza = 0;
  state.osservatore = new root.ResizeObserver((voci) => {
    const nuova = Math.round(voci[0]?.contentRect?.width || 0);
    if (nuova === larghezza) return;
    larghezza = nuova;
    root.requestAnimationFrame?.(() => sistemaIlPostoAccanto());
  });
  state.osservatore.observe(fila);
}

/* ── il disegno ───────────────────────────────────────────────────────────── */

const URGENZE = () => ({
  urgente: t("urgente", "urgent"),
  oggi: t("oggi", "today"),
  idea: t("idea", "idea"),
});

const scintilla = () =>
  `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.5l1.9 5.2 5.2 1.9-5.2 1.9L12 16.7l-1.9-5.2-5.2-1.9 5.2-1.9zM18.5 14l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9zM5.5 15l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/></svg>`;

function testaMarkup(quanti) {
  return `<div class="dm-ass-testa">
    <span class="dm-ass-scintilla" aria-hidden="true">${scintilla()}</span>
    <strong>${esc(t("Assistente di casa", "House assistant"))}</strong>
    ${
      quanti
        ? `<button type="button" class="dm-ass-conto" data-ass-fa="apri">${esc(
            quanti === 1
              ? t("1 cosa da fare", "1 thing to do")
              : t(`${quanti} cose da fare`, `${quanti} things to do`),
          )}</button>`
        : ""
    }
  </div>`;
}

function azioneMarkup(s, indice, classe = "dm-ass-tasto pieno") {
  const azione = s.azioni?.[0];
  if (!azione) return "";
  return `<button type="button" class="${classe}" data-ass-fa="azione" data-ass-id="${esc(s.id)}" data-ass-azione="${indice}">${esc(azione.etichetta)}</button>`;
}

function rinvioMarkup(s) {
  if (state.rinvio !== s.id)
    return `<button type="button" class="dm-ass-tasto" data-ass-fa="tardi" data-ass-id="${esc(s.id)}">${esc(t("Più tardi", "Later"))}</button>`;
  return `<span class="dm-ass-rinvio" role="group" aria-label="${esc(t("Più tardi", "Later"))}">${[
    ["ora", t("Fra 1 h", "In 1 h")],
    ["stasera", t("Stasera", "Tonight")],
    ["domani", t("Domani", "Tomorrow")],
  ]
    .map(
      ([fino, parola]) =>
        `<button type="button" class="dm-ass-tasto" data-ass-fa="rimanda" data-ass-fino="${fino}" data-ass-id="${esc(s.id)}">${esc(parola)}</button>`,
    )
    .join("")}</span>`;
}

/* Il titolo e il perche' stanno in un fumetto solo, come una frase detta:
 * fra i due ci vuole il punto, se il titolo non ne ha gia' uno suo. */
function conIlPunto(titolo) {
  const testo = clean(titolo);
  if (!testo || /[.!?…。！？]$/.test(testo)) return testo;
  return /^(ja|zh)/.test(activeLocale()) ? `${testo}。` : `${testo}.`;
}

function cardMarkup() {
  const tutti = state.suggerimenti;
  const primo = tutti[0];
  if (!primo)
    return `${testaMarkup(0)}
    <div class="dm-ass-calma"><span aria-hidden="true">${disegnoDelCatalogo("check", 28)}</span>
      <div><b>${esc(t("In casa è tutto in ordine.", "Everything is fine at home."))}</b>
      <small>${esc(t("Ti scrivo qui se c'è qualcosa da fare.", "I'll write here if something needs doing."))}</small></div>
      <button type="button" class="dm-ass-vedi" data-ass-fa="apri">${esc(t("Chiedi", "Ask"))} ›</button></div>`;
  const altri = tutti.slice(1);
  return `${testaMarkup(tutti.length)}
    <div class="dm-ass-messaggio" data-urgenza="${esc(primo.urgenza)}">
      <i class="dm-ass-punto" aria-hidden="true"></i>
      <p><b>${esc(conIlPunto(primo.titolo))}</b> ${esc(primo.motivo)}</p>
    </div>
    <div class="dm-ass-tasti">
      ${azioneMarkup(primo, 0)}
      ${primo.urgenza === "urgente" ? "" : rinvioMarkup(primo)}
      <button type="button" class="dm-ass-vedi" data-ass-fa="apri">${esc(t("vedi tutti", "see all"))} ›</button>
      <button type="button" class="dm-ass-x" data-ass-fa="no" data-ass-id="${esc(primo.id)}" aria-label="${esc(t("Non adesso", "Not now"))}" title="${esc(t("Non adesso", "Not now"))}">✕</button>
    </div>
    <div class="dm-ass-piede">${
      altri.length
        ? `<span class="dm-ass-ancora">${esc(t("Poi", "Next"))}: ${esc(altri[0].titolo)}</span>`
        : `<span class="dm-ass-ancora">${esc(t("Nient'altro per adesso", "Nothing else for now"))}</span>`
    }<button type="button" class="dm-ass-vedi" data-ass-fa="apri">${esc(t("vedi tutti", "see all"))} ›</button></div>`;
}

/* ── il foglio: tutti, e «Chiedi alla casa» ──────────────────────────────── */

function rigaMarkup(s) {
  return `<li class="dm-ass-riga" data-urgenza="${esc(s.urgenza)}">
    <i class="dm-ass-punto" aria-hidden="true"></i>
    <span class="dm-ass-riga-ic" aria-hidden="true">${disegnoDelCatalogo(s.disegno || "info", 24)}</span>
    <span class="dm-ass-riga-testo"><b>${esc(s.titolo)}</b><small>${esc(s.motivo)}</small></span>
    <span class="dm-ass-riga-tasti">${azioneMarkup(s, 0, "dm-ass-tasto pieno piccolo")}
      <button type="button" class="dm-ass-x" data-ass-fa="no" data-ass-id="${esc(s.id)}" aria-label="${esc(t("Non adesso", "Not now"))}">✕</button></span>
  </li>`;
}

function tastoMarkup(tasto, indice) {
  return `<button type="button" class="dm-ass-chip" data-tipo="${esc(tasto.tipo)}"${tasto.pericolo ? ' data-pericolo="true"' : ""} data-ass-fa="chip" data-ass-chip="${indice}">${esc(tasto.etichetta)}</button>`;
}

/* Le domande da provare, quando la conversazione e' ancora vuota: chi apre il
 * foglio per la prima volta non sa cosa la casa capisce. */
function provaMarkup() {
  let domande = [];
  try {
    domande = esempi(sapereDiAdesso(), linguaDellaPlancia(), 4);
  } catch (_errore) {
    domande = [];
  }
  if (!domande.length) return "";
  return `<div class="dm-ass-prova"><small>${esc(t("Prova a chiedere", "Try asking"))}</small><div class="dm-ass-chips">${domande
    .map(
      (d) =>
        `<button type="button" class="dm-ass-chip" data-tipo="chiedi" data-ass-fa="esempio" data-ass-testo-esempio="${esc(d)}">${esc(d)}</button>`,
    )
    .join("")}</div></div>`;
}

function chatMarkup() {
  if (!state.battute.length && !state.inVolo) return provaMarkup();
  const ultima = state.battute.length - 1;
  return `<div class="dm-ass-chat" aria-live="polite">${state.battute
    .map((b, i) => {
      const fumetto = `<p class="dm-ass-battuta" data-chi="${esc(b.chi)}"${b.errore ? ' data-errore="true"' : ""}>${esc(b.testo)}</p>`;
      const tasti =
        i === ultima && b.chi === "casa" && b.chips?.length
          ? `<div class="dm-ass-chips" data-ass-tasti>${b.chips.map(tastoMarkup).join("")}</div>`
          : "";
      return fumetto + tasti;
    })
    .join(
      "",
    )}${state.inVolo ? `<p class="dm-ass-battuta" data-chi="casa" data-attesa="true"><i></i><i></i><i></i></p>` : ""}</div>`;
}

function foglioMarkup() {
  const tutti = state.suggerimenti;
  const u = URGENZE();
  const parlare = Boolean(root.SpeechRecognition || root.webkitSpeechRecognition);
  return `<div class="dm-ass-foglio" role="dialog" aria-modal="true" aria-label="${esc(t("Assistente di casa", "House assistant"))}">
    <div class="dm-ass-foglio-testa">
      <span class="dm-ass-scintilla" aria-hidden="true">${scintilla()}</span>
      <strong>${esc(t("Assistente di casa", "House assistant"))}</strong>
      <span class="dm-ass-legenda"><i data-urgenza="urgente"></i>${esc(u.urgente)}<i data-urgenza="oggi"></i>${esc(u.oggi)}<i data-urgenza="idea"></i>${esc(u.idea)}</span>
      <button type="button" class="dm-ass-chiudi" data-ass-fa="chiudi" aria-label="${esc(t("Chiudi", "Close"))}">✕</button>
    </div>
    ${
      tutti.length
        ? `<ul class="dm-ass-elenco">${tutti.map(rigaMarkup).join("")}</ul>`
        : `<p class="dm-ass-vuoto">${esc(t("In casa è tutto in ordine.", "Everything is fine at home."))}</p>`
    }
    ${chatMarkup()}
    <form class="dm-ass-chiedi" data-ass-chiedi>
      ${
        state.memoria?.inAttesa?.codice
          ? `<input type="password" inputmode="numeric" data-ass-testo data-ass-codice autocomplete="off" placeholder="${esc(t("Scrivi il codice…", "Type the code…"))}" aria-label="${esc(t("Scrivi il codice…", "Type the code…"))}">`
          : `<input type="text" data-ass-testo autocomplete="off" enterkeyhint="send" placeholder="${esc(t("Chiedi alla casa…", "Ask the house…"))}" aria-label="${esc(t("Chiedi alla casa…", "Ask the house…"))}">`
      }
      ${
        /* Il codice non si detta ad alta voce. */
        parlare && !state.memoria?.inAttesa?.codice
          ? `<button type="button" class="dm-ass-mic${state.ascolto ? " si" : ""}" data-ass-fa="ascolta" aria-label="${esc(t("Parla", "Talk"))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg></button>`
          : ""
      }
      <button type="submit" class="dm-ass-manda" aria-label="${esc(t("Manda", "Send"))}">➤</button>
    </form>
  </div>`;
}

function disegnaIlFoglio() {
  let velo = doc.getElementById("dm-ass-velo");
  if (!state.aperto) {
    velo?.remove();
    return;
  }
  if (!velo) {
    velo = doc.createElement("div");
    velo.id = "dm-ass-velo";
    velo.className = "dm-ass-velo";
    velo.dataset.assFa = "fuori";
    doc.body.append(velo);
  }
  const casella = velo.querySelector("[data-ass-testo]");
  const scritto = casella?.value || "";
  const fuoco = doc.activeElement === casella;
  velo.innerHTML = foglioMarkup();
  const nuova = velo.querySelector("[data-ass-testo]");
  if (nuova) {
    nuova.value = scritto;
    if (fuoco) nuova.focus();
  }
  const chat = velo.querySelector(".dm-ass-chat");
  if (chat) chat.scrollTop = chat.scrollHeight;
}

/* ── «Chiedi alla casa…» ──────────────────────────────────────────────── */

/* Le aree di Home Assistant, dal registro che il guscio tiene gia'. */
function areeDiHomeAssistant() {
  try {
    const nomi = lexicalGlobal("WIZ")?.areaNames;
    return nomi && typeof nomi === "object" ? Object.values(nomi).map(clean).filter(Boolean) : [];
  } catch (_errore) {
    return [];
  }
}

const seCe = (valore) => (Array.isArray(valore) ? valore : undefined);

/**
 * Tutto quello che la casa sa adesso, per rispondere: gli stati di Home
 * Assistant, e sopra quello che la plancia ha scelto — i termometri delle
 * stanze, le persone, le telecamere, l'energia, le previsioni.
 */
/* Le luci come le ha chiamate chi usa la plancia, ognuna nella sua stanza.
 * Una luce senza stanza scelta resta senza: la stanza la dira' Home
 * Assistant, non «Altre zone». */
function luciDellaPlancia() {
  try {
    const stanze = readJson("cd_luci_rooms", {}) || {};
    return configuredLightGroups().flatMap((gruppo) =>
      gruppo.entities.map((entity) => ({
        entity,
        nome: clean(gruppo.lights?.[entity]),
        stanza: clean(stanze[entity]) ? clean(gruppo.room) : "",
      })),
    );
  } catch (_errore) {
    return [];
  }
}

export function sapereDiAdesso(states = allStates() || {}, adesso = Date.now()) {
  rinfrescaIModelli(adesso);
  const persone = normalizePeople(readJson("cd_people", []))
    .filter((p) => p?.nascosta !== true && clean(p?.entity))
    .map((p) => ({ name: clean(p.name) || clean(p.entity), entity: clean(p.entity) }));
  let telecamere;
  try {
    const scelte = root.getCameras?.();
    if (Array.isArray(scelte) && scelte.length)
      telecamere = scelte.map((c) => ({ entity: clean(c?.entity), name: clean(c?.name) }));
  } catch (_errore) {}
  let centrale = "";
  try {
    centrale = clean(root.resolveEntity?.("dm.security_centrale_allarme"));
  } catch (_errore) {}
  return sapereDellaCasa({
    states,
    adesso,
    lingua: activeLocale(),
    areaDi: stanzaDiHomeAssistant,
    aree: areeDiHomeAssistant(),
    stanze: seCe(root.getStanze?.()) || readJson("cd_stanze", []),
    temperature: seCe(modello("temperatura")?.rows),
    luci: luciDellaPlancia(),
    varchi: elenco(modello("varchi")?.rows).map((r) => ({
      entity: clean(r.entity),
      nome: clean(r.name),
      tipo: clean(r.tipo),
      stato: clean(r.stato),
    })),
    persone,
    meteo: entitaDelMeteo(states),
    previsioni: {
      giorni: previsioniDeiGiorni().length ? previsioniDeiGiorni() : state.giorni,
      ore: state.previsioni,
    },
    energia: state.energia || {},
    elettrodomestici: seCe(modello("elettrodomestici")?.rows),
    auto: seCe(modello("ev")?.vetture),
    telecamere,
    eventi: seCe(modello("agenda")?.eventi),
    rifiuti: seCe(modello("rifiuti")?.rows),
    batterieBasse: seCe(modello("batterie")?.low),
    nonRispondono: seCe(modello("nonrisponde")?.rows),
    aggiornamenti: seCe(modello("aggiornamenti")?.aggiornamenti),
    antifurto: centrale,
    comandabile: (entity) => siComanda(entity),
  });
}

/* Le previsioni dei giorni, chieste qui quando la card del meteo non le ha
 * ancora: «com'è il tempo domani» non aspetta il suo giro. Cinque secondi al
 * massimo, poi si risponde con quello che c'e'. */
async function previsioniPerRispondere() {
  if (previsioniDeiGiorni().length) return;
  if (state.giorni.length && Date.now() - state.giorniIl < MEZZ_ORA) return;
  const entita = entitaDelMeteo();
  if (!entita) return;
  try {
    const risposta = await chiediAHomeAssistant(
      {
        type: "call_service",
        domain: "weather",
        service: "get_forecasts",
        service_data: { type: "daily" },
        target: { entity_id: entita },
        return_response: true,
      },
      5000,
    );
    const giorni = risposta?.response?.[entita]?.forecast;
    state.giorni = Array.isArray(giorni) ? giorni : [];
    state.giorniIl = Date.now();
  } catch (_errore) {
    /* Senza previsioni la casa dice che non le ha. */
  }
}

/* La lingua delle risposte della casa: quella della domanda, se e' italiano o
 * inglese; per Assist, quella della plancia se la domanda non e' in nessuna
 * delle due. */
const linguaDellaPlancia = () => (/^en/i.test(activeLocale()) ? "en" : "it");

function aggiungi(battuta) {
  /* I tasti valgono solo sotto l'ultima risposta: quelli di prima non sono
   * piu' attuali, e un «Sì, spegni» di tre domande fa non deve partire. */
  state.battute = [...state.battute.map((b) => ({ ...b, chips: [] })), battuta].slice(-24);
}

/* La risposta letta ad alta voce, se la scheda Assist lo chiede. */
function leggi(testo, lingua) {
  if (!normalizzaAssist(readJson(CHIAVE_ASSIST, {})).voce || !testo) return;
  try {
    const voce = new root.SpeechSynthesisUtterance(testo);
    voce.lang = linguaPerIlMicrofono(lingua || activeLocale());
    root.speechSynthesis?.cancel?.();
    root.speechSynthesis?.speak?.(voce);
  } catch (_errore) {}
}

function esegui(servizi) {
  for (const s of Array.isArray(servizi) ? servizi : []) chiama({ servizio: s });
}

/* Una telecamera si apre con la finestra del guscio, come dalle Stanze: il
 * foglio si chiude, la conversazione resta. */
function apriLaTelecamera(entity) {
  if (typeof root.apriCamera !== "function" || typeof root.camSlug !== "function") return false;
  try {
    const lista = root.getCameras?.() || [];
    const indice = lista.findIndex((c) => clean(c?.entity) === clean(entity));
    if (indice < 0) return false;
    const riga = lista[indice];
    state.aperto = false;
    disegnaIlFoglio();
    root.apriCamera(
      root.camSlug(riga, indice),
      (clean(riga?.name) || clean(entity).split(".")[1]).toUpperCase(),
    );
    return true;
  } catch (_errore) {
    return false;
  }
}

/**
 * «Chiedi alla casa»: prima risponde la casa, con quello che sa; quello che
 * qui non si capisce va ad Assist di Home Assistant, all'agente scelto nella
 * scheda Assist o — se non se n'e' scelto uno — al modello linguistico che c'e'
 * in casa. Una domanda alla volta.
 */
export async function chiediAllaCasa(testo) {
  const frase = clean(testo);
  if (!frase || state.inVolo) return false;
  const adesso = Date.now();
  if (state.memoriaIl && adesso - state.memoriaIl > CONVERSAZIONE_MS) state.memoria = {};
  const inCodice = Boolean(state.memoria?.inAttesa?.codice);
  let sapere = null;
  let locale = null;
  const rispondi = () => {
    try {
      sapere = sapereDiAdesso(allStates() || {}, Date.now());
      locale = rispondiDaCasa(frase, sapere, state.memoria, { lingua: linguaDellaPlancia() });
    } catch (errore) {
      root.console?.warn?.("[DashboardModern] chiedi alla casa", errore);
    }
  };
  rispondi();
  /* Il codice dell'antifurto non resta scritto nella conversazione. */
  const nascosta = inCodice || locale?.nascondiDomanda;
  aggiungi({ chi: "io", testo: nascosta ? "••••" : frase });
  /* Una domanda sul tempo senza previsioni: le si chiede, e si risponde. */
  if (
    locale?.capita &&
    ["meteo", "temperatura_fuori"].includes(locale.intento) &&
    !sapere?.previsioni?.giorni?.length &&
    sapere?.fuori?.meteo
  ) {
    state.inVolo = true;
    disegnaIlFoglio();
    await previsioniPerRispondere();
    state.inVolo = false;
    rispondi();
  }
  if (locale?.capita) {
    state.memoria = locale.memoria || {};
    state.memoriaIl = adesso;
    aggiungi({ chi: "casa", testo: locale.testo, chips: locale.chips || [] });
    esegui(locale.esegui);
    disegnaIlFoglio();
    leggi(locale.testo, locale.lingua);
    if (locale.telecamera) apriLaTelecamera(locale.telecamera);
    if (locale.esegui?.length) raccogli();
    return true;
  }
  /* Un codice che la casa non ha preso non va ad Assist. */
  if (inCodice) {
    state.memoria = { ...state.memoria, inAttesa: null };
    disegnaIlFoglio();
    return false;
  }
  return chiediAdAssist(frase, sapere, locale?.lingua);
}

async function chiediAdAssist(frase, sapere, linguaRilevata) {
  const config = normalizzaAssist(readJson(CHIAVE_ASSIST, {}));
  const plancia = clean(activeLocale()).toLowerCase();
  const lingua =
    config.lingua || (/^(it|en)/.test(plancia) ? linguaRilevata || plancia : plancia) || "it";
  const richiesta = domandaPerHomeAssistant({
    testo: frase,
    lingua,
    agente: agenteDaUsare(config.agente, allStates() || {}),
    /* Lo stesso filo di prima, se e' fresco: «e quella della cucina?» vuol
     * dire qualcosa solo dopo la domanda di prima. */
    conversazione: filoDaMandare(state.filo, state.filoIl, Date.now()),
  });
  if (!richiesta) return false;
  const lingueDellaCasa = /^en/.test(lingua) ? "en" : "it";
  state.inVolo = true;
  disegnaIlFoglio();
  try {
    const risposta = rispostaDi(await chiediAHomeAssistant(richiesta, 20000));
    state.filo = risposta.conversazione || state.filo;
    state.filoIl = Date.now();
    if (rispostaCheNonRisponde(risposta)) {
      const gentile = nonHoCapito(sapere || {}, lingueDellaCasa);
      aggiungi({ chi: "casa", testo: gentile.testo, chips: gentile.chips });
      return false;
    }
    const parola = risposta.muta ? t("Fatto.", "Done.") : risposta.testo;
    aggiungi({ chi: "casa", testo: parola, chips: [] });
    leggi(parola, lingua);
    return true;
  } catch (_errore) {
    const gentile = nonHoCapito(sapere || {}, lingueDellaCasa, { senzaRisposta: true });
    aggiungi({ chi: "casa", testo: gentile.testo, chips: gentile.chips, errore: true });
    return false;
  } finally {
    state.inVolo = false;
    disegnaIlFoglio();
    /* Quello che si e' chiesto puo' aver cambiato la casa. */
    raccogli();
  }
}

/* Un tasto sotto la risposta: un'altra domanda, la conferma di un'azione,
 * «Annulla», una telecamera. */
function toccaIlTasto(indice) {
  const ultima = state.battute[state.battute.length - 1];
  const tasto = ultima?.chi === "casa" ? ultima.chips?.[indice] : null;
  if (!tasto) return;
  if (tasto.tipo === "chiedi") {
    chiediAllaCasa(tasto.testo || tasto.etichetta);
    return;
  }
  if (tasto.tipo === "telecamera") {
    apriLaTelecamera(tasto.entity);
    return;
  }
  const lingua = state.memoria?.lingua || linguaDellaPlancia();
  aggiungi({ chi: "io", testo: tasto.etichetta });
  state.memoria = { ...state.memoria, inAttesa: null };
  if (tasto.tipo === "fai") {
    esegui(tasto.servizi);
    aggiungi({ chi: "casa", testo: tasto.fatto || t("Fatto.", "Done."), chips: [] });
    leggi(tasto.fatto, lingua);
    raccogli();
  } else if (tasto.tipo === "annulla") {
    aggiungi({ chi: "casa", testo: rispostaAllAnnullo(lingua), chips: [] });
  }
  disegnaIlFoglio();
}

function ascolta() {
  const Motore = root.SpeechRecognition || root.webkitSpeechRecognition;
  if (!Motore) return;
  if (state.ascolto) {
    try {
      state.ascolto.stop();
    } catch (_errore) {}
    state.ascolto = null;
    disegnaIlFoglio();
    return;
  }
  try {
    const r = new Motore();
    r.lang = linguaPerIlMicrofono(activeLocale());
    r.continuous = false;
    r.interimResults = false;
    r.onresult = (evento) => {
      const frase = [...evento.results].map((v) => v[0]?.transcript || "").join("");
      state.ascolto = null;
      chiediAllaCasa(frase);
    };
    r.onend = () => {
      state.ascolto = null;
      disegnaIlFoglio();
    };
    r.start();
    state.ascolto = r;
  } catch (_errore) {
    state.ascolto = null;
  }
  disegnaIlFoglio();
}

/* ── i tocchi ─────────────────────────────────────────────────────────────── */

function chiama(azione) {
  const s = azione?.servizio;
  if (!s) return;
  try {
    if (typeof root.dmCallHaService === "function")
      return root.dmCallHaService(s.dominio, s.servizio, s.dati);
    if (typeof root.cdCallServiceJson === "function")
      return root.cdCallServiceJson(s.dominio, s.servizio, s.dati);
  } catch (errore) {
    root.console?.warn?.("[DashboardModern] assistente", errore);
  }
}

function vai(azione) {
  const { pagina, tessera } = azione?.vai || {};
  if (pagina) {
    const linguetta = doc.querySelector(`.tab[data-tab="${CSS.escape(pagina)}"]`);
    if (linguetta && !linguetta.hidden && root.getComputedStyle?.(linguetta)?.display !== "none") {
      linguetta.click();
      return;
    }
  }
  if (tessera) root.dmApriTessera?.(tessera);
}

function rispondi(id, risposta, fino = 0) {
  const s = state.suggerimenti.find((x) => x.id === id);
  if (!s) return;
  const { memoria } = scelte();
  scrivi(conLaRisposta(memoria, s, risposta, Date.now(), fino));
  state.rinvio = "";
  ricalcola();
}

function onClick(evento) {
  const tocco = evento.target?.closest?.("[data-ass-fa]");
  if (!tocco || !tocco.closest(".dm-assistente, #dm-ass-velo")) return;
  const fa = tocco.dataset.assFa;
  if (fa === "fuori" && evento.target !== tocco) return;
  evento.preventDefault();
  const id = clean(tocco.dataset.assId);
  if (fa === "apri") {
    state.aperto = true;
    disegnaIlFoglio();
    return;
  }
  if (fa === "chiudi" || fa === "fuori") {
    state.aperto = false;
    disegnaIlFoglio();
    return;
  }
  if (fa === "ascolta") {
    ascolta();
    return;
  }
  if (fa === "chip") {
    toccaIlTasto(Number(tocco.dataset.assChip) || 0);
    return;
  }
  if (fa === "esempio") {
    chiediAllaCasa(tocco.dataset.assTestoEsempio);
    return;
  }
  if (fa === "tardi") {
    state.rinvio = id;
    state.firma = "";
    sistemaIlPostoAccanto();
    return;
  }
  if (fa === "rimanda") {
    rispondi(id, "tardi", finoA(clean(tocco.dataset.assFino), Date.now()));
    return;
  }
  if (fa === "no") {
    rispondi(id, "no");
    return;
  }
  if (fa === "azione") {
    const s = state.suggerimenti.find((x) => x.id === id);
    const azione = s?.azioni?.[Number(tocco.dataset.assAzione) || 0];
    if (!azione) return;
    if (azione.vai) {
      state.aperto = false;
      disegnaIlFoglio();
      vai(azione);
      return;
    }
    chiama(azione);
    rispondi(id, azione.fatto ? "fatto" : "si");
  }
}

function onSubmit(evento) {
  const modulo = evento.target?.closest?.("[data-ass-chiedi]");
  if (!modulo) return;
  evento.preventDefault();
  const casella = modulo.querySelector("[data-ass-testo]");
  const testo = casella?.value || "";
  if (casella) casella.value = "";
  chiediAllaCasa(testo);
}

/* ── il vestito ───────────────────────────────────────────────────────────── */

function installStyles() {
  installStyle(
    "dm-assistente-style",
    `
    /* Il vestito delle card delle persone: sta nella loro fila. */
    #dm-people .dm-assistente{
      --ass:#7c3aed;box-sizing:border-box;min-width:0;align-self:start;display:flex;flex-direction:column;justify-content:space-between;gap:7px;padding:10px 14px;
      background:var(--card-bg,#fff);border:1px solid var(--card-border,#e8edf3);border-radius:22px;
      box-shadow:var(--shadow-sculpted,0 4px 14px rgba(15,23,42,.08));overflow:hidden;color:var(--text,#0f172a)}
    #dm-people .dm-ass-testa{display:flex;align-items:center;gap:8px;min-width:0}
    .dm-ass-scintilla{flex:0 0 auto;width:24px;height:24px;border-radius:8px;display:grid;place-items:center;color:#fff;
      background:linear-gradient(135deg,#8b5cf6,#2563eb);box-shadow:0 4px 10px -4px #7c3aed}
    .dm-ass-scintilla svg{width:15px;height:15px}
    #dm-people .dm-ass-testa strong{font-size:11px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;color:var(--text-dim,#64748b);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #dm-people .dm-ass-conto{margin-left:auto;flex:none;padding:3px 10px;border:0;border-radius:999px;font:inherit;font-size:11px;font-weight:900;cursor:pointer;
      color:#6d28d9;background:color-mix(in srgb,#8b5cf6 14%,transparent)}
    html[data-theme="dark"] #dm-people .dm-ass-conto{color:#c4b5fd}
    /* Il messaggio: un fumetto della casa, col punto dell'urgenza. */
    #dm-people .dm-ass-messaggio{position:relative;display:flex;gap:9px;align-items:flex-start;min-height:0;padding:8px 12px;border-radius:4px 16px 16px 16px;
      background:color-mix(in srgb,var(--ass) 7%,var(--card-bg,#fff));border:1px solid color-mix(in srgb,var(--ass) 22%,transparent)}
    #dm-people .dm-ass-messaggio p{margin:0;font-size:13px;line-height:1.35;font-weight:600;color:var(--text,#0f172a);
      display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}
    #dm-people .dm-ass-messaggio b{font-weight:850}
    .dm-ass-punto{flex:0 0 auto;width:9px;height:9px;border-radius:50%;margin-top:5px;background:var(--dot,#3b82f6);box-shadow:0 0 0 3px color-mix(in srgb,var(--dot,#3b82f6) 22%,transparent)}
    [data-urgenza="urgente"]{--dot:#dc2626}
    [data-urgenza="oggi"]{--dot:#f59e0b}
    [data-urgenza="idea"]{--dot:#3b82f6}
    #dm-people .dm-ass-tasti{display:flex;align-items:center;gap:6px;min-width:0;flex-wrap:nowrap}
    .dm-ass-tasto{flex:0 1 auto;min-width:0;padding:5px 12px;border-radius:999px;border:1px solid color-mix(in srgb,#8b5cf6 40%,transparent);
      background:var(--card-bg,#fff);color:#6d28d9;font:inherit;font-size:12px;font-weight:850;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .dm-ass-tasto.pieno{background:linear-gradient(135deg,#7c3aed,#6d28d9);border-color:transparent;color:#fff;box-shadow:0 6px 14px -8px #7c3aed}
    html[data-theme="dark"] .dm-ass-tasto:not(.pieno){color:#c4b5fd;background:transparent}
    .dm-ass-rinvio{display:inline-flex;gap:4px;min-width:0}
    .dm-ass-x{flex:none;margin-left:auto;width:28px;height:28px;border-radius:50%;border:1px solid var(--card-border,#e2e8f0);background:transparent;
      color:var(--text-dim,#64748b);font:inherit;font-size:12px;font-weight:900;cursor:pointer}
    /* Accanto alle persone l'altezza e' la loro: «Poi» sta nel foglio. Sotto,
       sul telefono, c'e' posto per una riga in piu'. */
    #dm-people .dm-ass-piede{display:none;align-items:center;gap:8px;min-width:0}
    #dm-people .dm-assistente[data-posto="sotto"] .dm-ass-piede{display:flex}
    #dm-people .dm-assistente[data-posto="sotto"] .dm-ass-tasti .dm-ass-vedi{display:none}
    #dm-people .dm-assistente[data-larghezza="1"] .dm-ass-tasti .dm-ass-vedi{display:none}
    #dm-people .dm-ass-tasti .dm-ass-vedi{margin-left:auto}
    #dm-people .dm-ass-tasti .dm-ass-vedi + .dm-ass-x{margin-left:0}
    #dm-people .dm-assistente[data-posto="sotto"] .dm-ass-tasti .dm-ass-x,
    #dm-people .dm-assistente[data-larghezza="1"] .dm-ass-tasti .dm-ass-x{margin-left:auto}
    #dm-people .dm-ass-ancora{flex:1 1 auto;min-width:0;font-size:11px;font-weight:750;color:var(--text-dim,#64748b);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .dm-ass-vedi{flex:none;border:0;background:none;padding:0;color:#6d28d9;font:inherit;font-size:11.5px;font-weight:900;cursor:pointer;white-space:nowrap}
    html[data-theme="dark"] .dm-ass-vedi{color:#c4b5fd}
    #dm-people .dm-ass-calma{flex:1;display:flex;align-items:center;gap:10px;min-width:0}
    #dm-people .dm-ass-calma>span{flex:none;width:28px;height:28px;line-height:0}
    #dm-people .dm-ass-calma svg{width:28px;height:28px}
    #dm-people .dm-ass-calma>div{flex:1;min-width:0;display:grid;gap:2px}
    #dm-people .dm-ass-calma b{font-size:13px;font-weight:850}
    #dm-people .dm-ass-calma small{font-size:11.5px;font-weight:650;color:var(--text-dim,#64748b)}
    /* Sotto le persone, sul telefono: la stessa card, piu' bassa. */
    #dm-people .dm-assistente[data-posto="sotto"]{padding:10px 12px;gap:7px}
    @media(max-width:520px){
      #dm-people .dm-ass-messaggio p{font-size:12.5px}
      #dm-people .dm-ass-tasti .dm-ass-tasto{padding:5px 10px;font-size:11.5px}
    }

    /* Il foglio: il velo di tutte le finestre, e un pannello che sale. */
    ${tokenDelVelo(".dm-ass-velo")}
    /* Sopra la barra delle pagine, come le finestre delle tessere: sul telefono
       la casella di «Chiedi alla casa» sta proprio dove sta la barra. */
    .dm-ass-velo{${VELO_DELLE_FINESTRE};z-index:9999;display:grid;place-items:center;padding:18px}
    .dm-ass-foglio{width:min(560px,100%);max-height:88dvh;display:flex;flex-direction:column;gap:12px;padding:18px;border-radius:26px;
      background:var(--card-bg,#fff);color:var(--text,#0f172a);border:1px solid var(--card-border,#e8edf3);box-shadow:0 30px 70px -30px rgba(9,14,24,.8)}
    .dm-ass-foglio-testa{display:flex;align-items:center;gap:9px;min-width:0}
    .dm-ass-foglio-testa strong{font-size:12px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;color:var(--text-dim,#64748b)}
    .dm-ass-legenda{margin-left:auto;display:flex;align-items:center;gap:5px;font-size:10.5px;font-weight:800;color:var(--text-dim,#64748b)}
    .dm-ass-legenda i{width:8px;height:8px;border-radius:50%;background:var(--dot);margin-left:6px}
    .dm-ass-chiudi{flex:none;width:32px;height:32px;border-radius:50%;border:1px solid var(--card-border,#e2e8f0);background:transparent;color:var(--text-dim,#64748b);font:inherit;font-weight:900;cursor:pointer}
    .dm-ass-elenco{list-style:none;margin:0;padding:0;display:grid;gap:7px;overflow:auto;min-height:0}
    .dm-ass-riga{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:15px;background:color-mix(in srgb,var(--dot) 6%,var(--card-bg,#fff));border:1px solid color-mix(in srgb,var(--dot) 18%,var(--card-border,#e8edf3))}
    .dm-ass-riga .dm-ass-punto{margin-top:0}
    .dm-ass-riga-ic{flex:none;width:24px;height:24px;line-height:0}
    .dm-ass-riga-ic svg{width:24px;height:24px}
    .dm-ass-riga-testo{flex:1 1 auto;min-width:0;display:grid;gap:2px}
    .dm-ass-riga-testo b{font-size:13px;font-weight:850;line-height:1.3}
    .dm-ass-riga-testo small{font-size:11.5px;font-weight:650;color:var(--text-dim,#64748b);line-height:1.35}
    .dm-ass-riga-tasti{flex:none;display:flex;align-items:center;gap:6px}
    .dm-ass-tasto.piccolo{padding:5px 11px;font-size:11.5px}
    .dm-ass-riga .dm-ass-x{margin-left:0}
    .dm-ass-vuoto{margin:0;font-size:13px;font-weight:700;color:var(--text-dim,#64748b)}
    .dm-ass-chat{display:flex;flex-direction:column;gap:7px;min-height:0;max-height:min(46dvh,420px);overflow:auto;overscroll-behavior:contain;padding:10px 2px 4px;
      -webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 14px);mask-image:linear-gradient(to bottom,transparent 0,#000 14px)}
    .dm-ass-chat:empty{display:none}
    .dm-ass-battuta{margin:0;max-width:86%;padding:8px 12px;border-radius:16px;font-size:13.5px;font-weight:600;line-height:1.42;overflow-wrap:anywhere}
    .dm-ass-battuta[data-chi="io"]{align-self:flex-end}
    .dm-ass-battuta[data-chi="casa"]{align-self:flex-start}
    .dm-ass-battuta[data-attesa="true"]{display:flex;gap:4px;padding:11px 14px}
    .dm-ass-battuta[data-attesa="true"] i{width:6px;height:6px;border-radius:50%;background:#8b5cf6;animation:dm-ass-pensa 1s infinite ease-in-out}
    .dm-ass-battuta[data-attesa="true"] i:nth-child(2){animation-delay:.15s}
    .dm-ass-battuta[data-attesa="true"] i:nth-child(3){animation-delay:.3s}
    @keyframes dm-ass-pensa{0%,80%,100%{opacity:.3;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}
    @media (prefers-reduced-motion:reduce){.dm-ass-battuta[data-attesa="true"] i{animation:none}}
    .dm-ass-chips{display:flex;flex-wrap:wrap;gap:6px;align-self:flex-start;max-width:100%}
    .dm-ass-chip{min-height:30px;padding:5px 12px;border-radius:999px;border:1px solid color-mix(in srgb,#8b5cf6 38%,transparent);background:var(--card-bg,#fff);
      color:#6d28d9;font:inherit;font-size:12.5px;font-weight:800;cursor:pointer;text-align:left;line-height:1.25;max-width:100%}
    .dm-ass-chip[data-tipo="fai"]{background:linear-gradient(135deg,#7c3aed,#6d28d9);border-color:transparent;color:#fff;box-shadow:0 6px 14px -8px #7c3aed}
    .dm-ass-chip[data-tipo="fai"][data-pericolo="true"]{background:linear-gradient(135deg,#dc2626,#b91c1c);box-shadow:0 6px 14px -8px #dc2626}
    .dm-ass-chip[data-tipo="annulla"]{color:var(--text-dim,#64748b);border-color:var(--card-border,#e2e8f0)}
    .dm-ass-chip[data-tipo="telecamera"]::before{content:"";display:inline-block;width:8px;height:8px;margin-right:6px;border-radius:50%;background:#dc2626;vertical-align:1px}
    html[data-theme="dark"] .dm-ass-chip:not([data-tipo="fai"]){color:#c4b5fd;background:transparent}
    html[data-theme="dark"] .dm-ass-chip[data-tipo="annulla"]{color:var(--text-dim,#94a3b8)}
    .dm-ass-prova{display:grid;gap:7px}
    .dm-ass-prova small{font-size:11px;font-weight:850;letter-spacing:.05em;text-transform:uppercase;color:var(--text-dim,#64748b)}
    .dm-ass-battuta[data-chi="io"]{justify-self:end;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;border-bottom-right-radius:4px}
    .dm-ass-battuta[data-chi="casa"]{justify-self:start;background:color-mix(in srgb,#8b5cf6 9%,var(--card-bg,#fff));border:1px solid color-mix(in srgb,#8b5cf6 22%,transparent);border-bottom-left-radius:4px}
    .dm-ass-battuta[data-errore="true"]{border-color:#dc262655}
    .dm-ass-chiedi input[data-ass-codice]{letter-spacing:.3em}
    .dm-ass-chiedi input[data-ass-codice]::placeholder{letter-spacing:normal}
    .dm-ass-chiedi{display:flex;gap:8px;align-items:center}
    .dm-ass-chiedi input{flex:1;min-width:0;height:42px;padding:0 14px;border-radius:999px;border:1px solid var(--card-border,#e2e8f0);
      background:color-mix(in srgb,var(--text,#0f172a) 3%,var(--card-bg,#fff));color:var(--text,#0f172a);font:inherit;font-size:14px}
    .dm-ass-mic,.dm-ass-manda{flex:none;width:42px;height:42px;border-radius:50%;border:0;display:grid;place-items:center;cursor:pointer;color:#fff;
      background:linear-gradient(135deg,#8b5cf6,#2563eb);font:inherit;font-size:16px}
    .dm-ass-mic svg{width:20px;height:20px}
    .dm-ass-mic.si{background:#dc2626}
    @media(max-width:520px){.dm-ass-velo{place-items:end center;padding:8px 8px max(8px,env(safe-area-inset-bottom))}.dm-ass-foglio{border-radius:24px 24px 18px 18px}.dm-ass-legenda{display:none}
      .dm-ass-chat{max-height:min(60dvh,560px)}}
    `,
  );
}

export function installAssistenteDiCasa() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  doc.addEventListener("click", onClick, true);
  doc.addEventListener("submit", onSubmit, true);
  doc.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape" && state.aperto) {
      state.aperto = false;
      disegnaIlFoglio();
    }
  });
  root.addEventListener?.("resize", () => sistemaIlPostoAccanto());
  /* Sempre vivo: ogni cambio della casa (raccolto), e un giro al minuto in
   * ogni caso — anche con la Home nascosta e nessuno che tocca. */
  for (const evento of [
    "dashboardmodern:state-changed",
    "dashboardmodern:states-ready",
    "dashboardmodern:persistence-restored",
  ])
    root.addEventListener?.(evento, raccogli);
  /* Chi torna a guardare trova il consiglio di adesso, non quello di quando
   * il browser ha rallentato il battito della scheda nascosta. */
  doc.addEventListener("visibilitychange", () => {
    if (!doc.hidden) raccogli();
  });
  state.battito =
    root.setInterval?.(() => {
      chiediLePrevisioni();
      ricalcola();
    }, UN_MINUTO) || 0;
  return true;
}

senzaCadere(installAssistenteDiCasa);
