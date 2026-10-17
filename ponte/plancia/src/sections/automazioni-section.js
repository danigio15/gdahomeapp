/* «Automazioni» (Premium): Quando · Solo se · Allora.
 *
 * «Quando succede qualcosa — un orario, una porta, un movimento, un valore,
 * chi arriva o esce — la casa fa da sola quello che le dici.» Qui si scrivono
 * e si guardano; a farle e' la casa (`ponte/src/automazioni.js`), che gira
 * anche quando nessuna pagina e' aperta. Le regole sono una sola, in
 * `core/automazioni.js`, e le leggono tutte e due: la frase «Si legge così»
 * dice esattamente quello che la casa fara'.
 *
 * Le automazioni stanno in `cd_automazioni`, una casella della configurazione
 * come le altre: viaggia fra i dispositivi e la casa la legge dalla plancia
 * principale. Le scrive solo chi ha un utente (`ponte/src/commissioni.js`).
 * Quello che la casa ha fatto — cosa viene dopo, le ultime eseguite, l'ultima
 * volta di ognuna — lo si chiede con `ponte/automazioni/stato`, in sola
 * lettura.
 *
 * ── Due porte, una pagina ─────────────────────────────────────────────────
 *
 *  - **Sul web** (la plancia dentro Home Assistant) e' una voce del config,
 *    nel gruppo Plancia subito dopo «Azioni», col bollino PREMIUM. Senza
 *    Premium la voce ha il lucchetto, e la pagina un velo che dice cosa fa.
 *  - **Nell'app** la voce del config non c'e': le automazioni sono una voce
 *    del menu dell'app, e la pagina si apre a schermo pieno quando l'app la
 *    chiede — la maniglia `gdahomeApriLeAutomazioni`, o il messaggio
 *    `apri-le-automazioni`, come fa la Configurazione con le sue.
 *
 * Le viste sono quattro: la lista, i modelli pronti, l'editor (Quando · Solo
 * se · Allora) e il cronotermostato. Una bozza alla volta: si salva col suo
 * tasto, e solo se sta in piedi.
 */
import {
  AZIONI_AL_MASSIMO,
  CHIAVE_AUTOMAZIONI,
  CONDIZIONI_AL_MASSIMO,
  DOMINI,
  ENTITA_AL_MASSIMO,
  ORARI_AL_MASSIMO,
  TERMOSTATI_AL_MASSIMO,
  automazionePulita,
  automazioniPulite,
  cronoPulito,
  eCompleta,
  fasceDalleMezzore,
  mezzoreDelleFasce,
  nuovoId,
  prossimiEventi,
  servizioPermesso,
} from "../core/automazioni.js";
import { oggettoWidget } from "../core/oggetti-widget.js";
import { ensureTitoloDellaSezione, riordinaLeLinguette } from "./alberatura-del-config-section.js";
import { currentProfile } from "./config-persistence-section.js";
import { premiumDellaCasa } from "./plancia-a-muro-section.js";
import {
  allStates,
  chiediAHomeAssistant,
  clean,
  doc,
  esc,
  installStyle,
  locale,
  onEditorRedraw,
  readJson,
  root,
  t,
  wrapFunction,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_AUTOMAZIONI__";
const state = (root[KEY] ||= {
  installed: false,
  vista: "lista",
  bozza: null,
  /* Da dove si e' arrivati all'editor: i modelli, o la lista (una che c'era). */
  daModelli: false,
  premium: null,
  chiedendo: false,
  ponte: null,
  assente: false,
  chiestoIl: 0,
  /* La tendina del QUANDO aperta. */
  tendina: false,
  tendinaAltro: false,
  avanzate: false,
  errore: "",
  scopri: false,
  /* La pagina a schermo pieno dell'app e' aperta. */
  inApp: false,
  doveEra: "",
  trascina: null,
});

export const AUTOMAZIONI_TAB = "automazioni";
const ID_PAGINA = "page-automazioni";
/* Lo stato della casa si richiede quando si apre la pagina, dopo un
 * salvataggio, e al ridisegno se e' piu' vecchio di un minuto. Nessun
 * orologio: la pagina non deve rincorrere niente. */
const VALE = 60_000;

const schedaAttiva = () => clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);

/* La plancia gira nell'app: lo dice il servitore dell'app, che le mette il
 * foglio `gdahome-config-fuori` (`app/lib/plancia/premesse.dart`) — sul
 * telefono e nel browser — e sul telefono anche il canale `gdahomeDice`. */
export function nellApp() {
  return Boolean(doc?.getElementById?.("gdahome-config-fuori") || root.gdahomeDice?.postMessage);
}

/* ── cosa c'e' in casa ───────────────────────────────────────────────────── */

const stati = () => {
  try {
    return allStates() || {};
  } catch (_errore) {
    return {};
  }
};

function nomeDi(id) {
  const s = stati()[id];
  return clean(s?.attributes?.friendly_name) || clean(id).split(".").slice(1).join(".") || "—";
}

const dominio = (id) => clean(id).split(".")[0];
const classe = (s) => clean(s?.attributes?.device_class);
const unita = (s) => clean(s?.attributes?.unit_of_measurement);

/* Quali entita' propone ogni tendina: quelle che quella cosa sa fare. */
const SCELTE = {
  accendi: (id) => DOMINI.accendi.includes(dominio(id)),
  spegni: (id) => DOMINI.spegni.includes(dominio(id)),
  luce: (id) => dominio(id) === "light",
  tapparella: (id) => dominio(id) === "cover",
  clima: (id) => dominio(id) === "climate",
  apertura: (id, s) =>
    (dominio(id) === "binary_sensor" &&
      ["door", "window", "garage_door", "opening"].includes(classe(s))) ||
    dominio(id) === "cover" ||
    dominio(id) === "lock",
  finestra: (id, s) =>
    dominio(id) === "binary_sensor" && ["window", "door", "opening"].includes(classe(s)),
  movimento: (id, s) =>
    dominio(id) === "binary_sensor" && ["motion", "occupancy", "presence"].includes(classe(s)),
  valore: (id, s) =>
    DOMINI.valore.includes(dominio(id)) && (Boolean(unita(s)) || Number.isFinite(Number(s?.state))),
  potenza: (id, s) =>
    dominio(id) === "sensor" && (classe(s) === "power" || /^k?w$/i.test(unita(s))),
  antifurto: (id) => dominio(id) === "alarm_control_panel",
  persona: (id) => dominio(id) === "person",
  /* Qualunque entita' di Home Assistant: per i QUANDO e i SOLO SE generici. */
  tutte: () => true,
  imposta: (id) => DOMINI.imposta.includes(dominio(id)),
  media: (id) => dominio(id) === "media_player",
  stato: (id) =>
    [
      "light",
      "switch",
      "binary_sensor",
      "cover",
      "climate",
      "fan",
      "input_boolean",
      "media_player",
      "person",
      "lock",
    ].includes(dominio(id)),
};

function opzioni(quale) {
  const prova = SCELTE[quale] || (() => false);
  return Object.entries(stati())
    .filter(([id, s]) => prova(id, s))
    .map(([id]) => [id, nomeDi(id)])
    .sort((a, b) => a[1].localeCompare(b[1], locale()));
}

const primaDi = (quale, preferita = null) => {
  const tutte = opzioni(quale);
  return (
    (preferita ? tutte.find(([, nome]) => preferita.test(nome))?.[0] : "") || tutte[0]?.[0] || ""
  );
};

function azioniDellaPlancia() {
  const tutte = readJson("cd_quick_actions", []);
  return (Array.isArray(tutte) ? tutte : [])
    .filter(
      (a) =>
        a?.name &&
        a.entity &&
        !["builtin", "luci_group"].includes(a.type) &&
        a.confirm !== true &&
        !/^(lock|alarm_control_panel)\./.test(a.entity),
    )
    .map((a) => clean(a.name));
}

/* ── le automazioni salvate ──────────────────────────────────────────────── */

export const leAutomazioni = () => automazioniPulite(readJson(CHIAVE_AUTOMAZIONI, []));

function salvaLElenco(elenco) {
  writeJsonIfChanged(CHIAVE_AUTOMAZIONI, automazioniPulite(elenco));
  try {
    root.dispatchEvent?.(new CustomEvent("dashboardmodern:automazioni"));
  } catch (_errore) {}
}

/* ── la casa ─────────────────────────────────────────────────────────────── */

async function chiediAllaCasa({ forza = false } = {}) {
  if (state.chiedendo) return;
  const adesso = Date.now();
  if (!forza && adesso - state.chiestoIl < VALE) return;
  state.chiedendo = true;
  state.chiestoIl = adesso;
  try {
    state.premium = await premiumDellaCasa({ forza });
  } catch (_errore) {
    state.premium = state.premium === true;
  }
  try {
    state.ponte = await chiediAHomeAssistant({ type: "ponte/automazioni/stato" }, 8000);
    state.assente = false;
  } catch (errore) {
    /* «Non conosco»: questa plancia non sta dietro all'add-on, e le
     * automazioni non le fa nessuno. Un filo non ancora aperto si riprova. */
    const detto = clean(errore?.message);
    state.assente = /non conosco|unknown/i.test(detto);
    if (detto === "socket") state.chiestoIl = adesso - VALE + 4000;
  } finally {
    state.chiedendo = false;
  }
  ridisegna();
}

/* ── le parole ───────────────────────────────────────────────────────────── */

const oraBreve = (ms) =>
  new Date(ms).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });

function quandoFu(ms) {
  const quando = new Date(ms);
  const oggi = new Date();
  const ieri = new Date();
  ieri.setDate(oggi.getDate() - 1);
  const alle = oraBreve(ms);
  if (quando.toDateString() === oggi.toDateString()) return t(`oggi ${alle}`, `today ${alle}`);
  if (quando.toDateString() === ieri.toDateString()) return t(`ieri ${alle}`, `yesterday ${alle}`);
  const giorni = Math.max(2, Math.round((oggi - quando) / 86_400_000));
  return t(`${giorni} giorni fa`, `${giorni} days ago`);
}

function iniziali() {
  const lunedi = new Date(2026, 9, 12);
  return Array.from({ length: 7 }, (_v, i) => {
    const d = new Date(lunedi);
    d.setDate(lunedi.getDate() + i);
    return {
      breve: d.toLocaleDateString(locale(), { weekday: "narrow" }),
      corto: d.toLocaleDateString(locale(), { weekday: "short" }),
    };
  });
}

function giorniDetti(giorni) {
  const g = Array.isArray(giorni) ? giorni : [];
  const quanti = g.filter(Boolean).length;
  if (quanti === 7) return "";
  const nomi = iniziali();
  if (g.slice(0, 5).every(Boolean) && !g[5] && !g[6]) return `${nomi[0].corto}–${nomi[4].corto}`;
  if (!g.slice(0, 5).some(Boolean) && g[5] && g[6]) return `${nomi[5].corto}–${nomi[6].corto}`;
  return g
    .map((si, i) => (si ? nomi[i].corto : ""))
    .filter(Boolean)
    .join(" ");
}

function eDetti(parti) {
  const pulite = parti.filter(Boolean);
  if (pulite.length < 2) return pulite[0] || "";
  return `${pulite.slice(0, -1).join(", ")} ${t("e", "and")} ${pulite.at(-1)}`;
}

function misuraDi(id) {
  const u = unita(stati()[id]);
  return u ? ` ${u}` : "";
}

/* I nomi di un elenco di entita' (o di una sola), detti come una frase. */
const nomiDi = (elenco) =>
  eDetti((Array.isArray(elenco) ? elenco : elenco ? [elenco] : []).map(nomeDi));

/** Il QUANDO in una frase: «Quando c'è movimento in Corridoio». */
export function fraseDelQuando(q) {
  const nomi = nomiDi;
  if (q.tipo === "orario") {
    if (q.sole) {
      const scarto = Math.abs(q.scarto);
      const base = q.sole === "alba" ? t("All'alba", "At sunrise") : t("Al tramonto", "At sunset");
      if (!q.scarto) return base;
      return q.scarto < 0
        ? t(`${base}, ${scarto} min prima`, `${base}, ${scarto} min before`)
        : t(`${base}, ${scarto} min dopo`, `${base}, ${scarto} min after`);
    }
    const ore = eDetti(q.ore.map((o) => t(`alle ${o}`, `at ${o}`)));
    return `${ore.charAt(0).toUpperCase()}${ore.slice(1)}`;
  }
  if (q.tipo === "ogni") return t(`Ogni ${q.minuti} min`, `Every ${q.minuti} min`);
  if (q.tipo === "apertura") {
    const chi = q.entita.length ? nomi(q.entita) : t("una porta o finestra", "a door or window");
    return q.verso === "chiude"
      ? t(`Quando ${chi} si chiude`, `When ${chi} closes`)
      : t(`Quando ${chi} si apre`, `When ${chi} opens`);
  }
  if (q.tipo === "movimento") {
    const dove = q.entita.length ? nomi(q.entita) : "…";
    return q.verso === "no"
      ? t(
          `Quando non c'è movimento in ${dove} da ${q.minuti} min`,
          `When there is no motion in ${dove} for ${q.minuti} min`,
        )
      : t(`Quando c'è movimento in ${dove}`, `When there is motion in ${dove}`);
  }
  if (q.tipo === "valore") {
    const chi = q.entita ? nomeDi(q.entita) : "…";
    const soglia = `${q.soglia}${misuraDi(q.entita)}`;
    return q.verso === "sotto"
      ? t(`Quando ${chi} scende sotto ${soglia}`, `When ${chi} drops below ${soglia}`)
      : t(`Quando ${chi} sale sopra ${soglia}`, `When ${chi} rises above ${soglia}`);
  }
  if (q.tipo === "persone") {
    if (q.verso === "tuttiFuori") return t("Quando tutti sono fuori", "When everyone is out");
    const chi = q.chi.length ? nomi(q.chi) : t("qualcuno", "someone");
    return q.verso === "esce"
      ? t(`Quando ${chi} esce di casa`, `When ${chi} leaves home`)
      : t(`Quando ${chi} arriva a casa`, `When ${chi} gets home`);
  }
  if (q.tipo === "antifurto") {
    if (q.verso === "suona") return t("Quando l'antifurto suona", "When the alarm goes off");
    return q.verso === "disinserito"
      ? t("Quando l'antifurto si disinserisce", "When the alarm is disarmed")
      : t("Quando l'antifurto si inserisce", "When the alarm is armed");
  }
  if (q.tipo === "stato") {
    const chi = q.entita.length ? nomi(q.entita) : "…";
    const da = q.da;
    const a = q.a;
    let frase = t(`Quando ${chi} cambia stato`, `When ${chi} changes state`);
    if (da && a)
      frase = t(
        `Quando ${chi} passa da «${da}» a «${a}»`,
        `When ${chi} goes from «${da}» to «${a}»`,
      );
    else if (a) frase = t(`Quando ${chi} diventa «${a}»`, `When ${chi} becomes «${a}»`);
    else if (da) frase = t(`Quando ${chi} non è più «${da}»`, `When ${chi} is no longer «${da}»`);
    const per = q.per;
    return per ? t(`${frase} da ${per} min`, `${frase} for ${per} min`) : frase;
  }
  if (q.tipo === "attributo") {
    const chi = q.entita ? nomeDi(q.entita) : "…";
    const attributo = q.attributo || "…";
    const valore = q.valore;
    return valore
      ? t(
          `Quando ${attributo} di ${chi} diventa «${valore}»`,
          `When ${attributo} of ${chi} becomes «${valore}»`,
        )
      : t(`Quando cambia ${attributo} di ${chi}`, `When ${attributo} of ${chi} changes`);
  }
  if (q.tipo === "evento") {
    const evento = q.evento || "…";
    return t(`Quando arriva l'evento ${evento}`, `When the ${evento} event arrives`);
  }
  const chi = q.entita ? nomeDi(q.entita) : "…";
  return t(`Quando ${chi} ha finito`, `When ${chi} has finished`);
}

/** Il SOLO SE, corto: la pastiglia accanto alla frase. */
export function fraseDellaCondizione(c) {
  if (c.tipo === "notte") {
    if (c.da && c.a) return t(`di notte (${c.da}–${c.a})`, `at night (${c.da}–${c.a})`);
    return t("di notte", "at night");
  }
  if (c.tipo === "fascia") return t(`fra ${c.da} e ${c.a}`, `between ${c.da} and ${c.a}`);
  if (c.tipo === "giorni") return giorniDetti(c.giorni) || t("tutti i giorni", "every day");
  if (c.tipo === "sole")
    return c.posizione === "sotto"
      ? t("col sole sotto l'orizzonte", "with the sun below the horizon")
      : t("col sole sopra l'orizzonte", "with the sun above the horizon");
  if (c.tipo === "casa")
    return c.chi === "nessuno"
      ? t("nessuno in casa", "nobody home")
      : t("qualcuno in casa", "someone home");
  const chi = nomeDi(c.entita);
  if (c.tipo === "stato")
    return c.vale === "spento" ? t(`${chi} spento`, `${chi} off`) : t(`${chi} acceso`, `${chi} on`);
  if (c.tipo === "uguale") {
    const valore = c.valore || "…";
    return c.non
      ? t(`${chi} non è «${valore}»`, `${chi} is not «${valore}»`)
      : t(`${chi} è «${valore}»`, `${chi} is «${valore}»`);
  }
  if (c.tipo === "attributo") {
    const attributo = c.attributo || "…";
    const valore = c.valore || "…";
    if (c.confronto === "sopra")
      return t(`${attributo} di ${chi} sopra ${valore}`, `${attributo} of ${chi} above ${valore}`);
    if (c.confronto === "sotto")
      return t(`${attributo} di ${chi} sotto ${valore}`, `${attributo} of ${chi} below ${valore}`);
    return t(`${attributo} di ${chi} è «${valore}»`, `${attributo} of ${chi} is «${valore}»`);
  }
  const soglia = `${c.soglia}${misuraDi(c.entita)}`;
  return c.verso === "sotto"
    ? t(`${chi} sotto ${soglia}`, `${chi} below ${soglia}`)
    : t(`${chi} sopra ${soglia}`, `${chi} above ${soglia}`);
}

const SI_ATTIVANO = ["script", "scene", "button", "input_button"];

/** Un'azione dell'ALLORA, detta: «accendi Luce corridoio al 20%». */
export function fraseDellAzione(a) {
  const chi = nomiDi(a.entita);
  if (a.tipo === "aspetta") return t(`aspetta ${a.minuti} min`, `wait ${a.minuti} min`);
  if (a.tipo === "notifica") return `📱 «${a.testo}»`;
  if (a.tipo === "azione") return t(`lancia «${a.nome}»`, `run «${a.nome}»`);
  if (a.tipo === "accendi") {
    const elenco = Array.isArray(a.entita) ? a.entita : [a.entita];
    if (elenco.length && elenco.every((e) => SI_ATTIVANO.includes(dominio(e))))
      return t(`attiva ${chi}`, `activate ${chi}`);
    return a.livello
      ? t(`accendi ${chi} al ${a.livello}%`, `turn on ${chi} at ${a.livello}%`)
      : t(`accendi ${chi}`, `turn on ${chi}`);
  }
  if (a.tipo === "spegni") return t(`spegni ${chi}`, `turn off ${chi}`);
  if (a.tipo === "tapparella") {
    if (a.modo === "chiudi") return t(`chiudi ${chi}`, `close ${chi}`);
    if (a.modo === "posizione")
      return t(`porta ${chi} al ${a.posizione}%`, `set ${chi} to ${a.posizione}%`);
    return t(`apri ${chi}`, `open ${chi}`);
  }
  if (a.tipo === "imposta") {
    const valore = a.valore;
    return t(`metti ${chi} a «${valore}»`, `set ${chi} to «${valore}»`);
  }
  if (a.tipo === "media") {
    const valore = a.valore;
    if (a.comando === "pausa") return t(`metti in pausa ${chi}`, `pause ${chi}`);
    if (a.comando === "stop") return t(`ferma ${chi}`, `stop ${chi}`);
    if (a.comando === "successivo") return t(`brano dopo su ${chi}`, `next track on ${chi}`);
    if (a.comando === "volume")
      return t(`${chi} al volume ${valore}%`, `${chi} at volume ${valore}%`);
    if (a.comando === "sorgente") return t(`${chi} su «${valore}»`, `${chi} on «${valore}»`);
    return t(`fai suonare ${chi}`, `play ${chi}`);
  }
  if (a.tipo === "aspettaChe") {
    const stato = a.stato;
    const massimo = a.massimo;
    return t(
      `aspetta che ${chi} diventi «${stato}» (al massimo ${massimo} min)`,
      `wait until ${chi} becomes «${stato}» (at most ${massimo} min)`,
    );
  }
  if (a.tipo === "servizio") {
    const servizio = a.servizio;
    return chi
      ? t(`chiama ${servizio} su ${chi}`, `call ${servizio} on ${chi}`)
      : t(`chiama ${servizio}`, `call ${servizio}`);
  }
  if (a.modo === "spegni") return t(`spegni ${chi}`, `turn off ${chi}`);
  return t(`${chi} a ${a.gradi}°`, `${chi} to ${a.gradi}°`);
}

export const fraseDellAllora = (allora) => eDetti(allora.map(fraseDellAzione));

function fraseDelCrono(c) {
  return t(
    `${c.inCasa}° in casa · ${c.fuori}° di notte e fuori`,
    `${c.inCasa}° at home · ${c.fuori}° at night and away`,
  );
}

/** «Si legge così: …», dalla bozza ripulita. */
export function siLeggeCosi(a) {
  if (!a) return "";
  if (a.tipo === "crono")
    return `${a.nome || t("Cronotermostato", "Thermostat schedule")}: ${fraseDelCrono(a.crono)}`;
  const quando = fraseDelQuando(a.quando);
  const condizioni = a.tutte
    ? eDetti(a.soloSe.map(fraseDellaCondizione))
    : a.soloSe.map(fraseDellaCondizione).join(` ${t("o", "or")} `);
  const se = a.soloSe.length ? t(`, solo se ${condizioni}`, `, only if ${condizioni}`) : "";
  const allora = a.allora.length ? fraseDellAllora(a.allora) : "…";
  return `<b>${esc(quando.charAt(0).toLowerCase() + quando.slice(1))}</b>${esc(se)}, <b>${esc(allora)}</b>.`;
}

/* ── i disegni ───────────────────────────────────────────────────────────── */

const DISEGNO_DEL_QUANDO = {
  orario: "automazioni",
  ogni: "automazioni",
  apertura: "finestra",
  movimento: "presenza",
  valore: "temperatura",
  persone: "persone",
  antifurto: "sicurezza",
  elettrodomestico: "elettrodomestici",
  stato: "evidenza",
  attributo: "impostazioni",
  evento: "azioni",
  crono: "caldo",
};
let disegni = 0;
const disegno = (chiave, dove = "") =>
  oggettoWidget(chiave, "", `au-${dove || chiave}-${disegni++ % 64}`);

const QUANDO_DELLA_TENDINA = () => [
  [
    "orario",
    "⏰",
    t("a un orario", "at a time"),
    t("anche alba e tramonto", "sunrise and sunset too"),
  ],
  [
    "apertura",
    "🚪",
    t("una porta o finestra", "a door or window"),
    t("si apre / si chiude", "opens / closes"),
  ],
  [
    "movimento",
    "🏃",
    t("c'è movimento", "there is motion"),
    t("o nessuno da X min", "or none for X min"),
  ],
  [
    "valore",
    "🌡️",
    t("un valore sale o scende", "a value rises or falls"),
    t("temperatura, potenza…", "temperature, power…"),
  ],
  [
    "persone",
    "🏠",
    t("qualcuno arriva o esce", "someone arrives or leaves"),
    t("o tutti fuori", "or everyone out"),
  ],
  ["antifurto", "🛡️", t("l'antifurto", "the alarm"), t("si inserisce / suona", "armed / goes off")],
  [
    "elettrodomestico",
    "🔌",
    t("un elettrodomestico finisce", "an appliance finishes"),
    t("lavatrice, lavastoviglie…", "washer, dishwasher…"),
  ],
];

/* I QUANDO per chi vuole tutta Home Assistant: dietro «Altro…», chiusi di
 * serie, perche' la porta d'ingresso resta quella delle sette cose di casa. */
const QUANDO_ALTRO = () => [
  [
    "stato",
    "🔁",
    t("un'entità cambia stato", "an entity changes state"),
    t("qualsiasi, da → a", "any, from → to"),
  ],
  [
    "attributo",
    "🏷️",
    t("un attributo cambia", "an attribute changes"),
    t("sorgente, modalità…", "source, mode…"),
  ],
  [
    "evento",
    "⚡",
    t("un evento di Home Assistant", "a Home Assistant event"),
    t("tasti Zigbee, tag…", "Zigbee buttons, tags…"),
  ],
  ["ogni", "🔂", t("ogni tot minuti", "every few minutes"), t("dalla mezzanotte", "from midnight")],
];

/* ── la lista ────────────────────────────────────────────────────────────── */

function nomeDellAutomazione(a) {
  if (a.nome) return a.nome;
  return a.tipo === "crono"
    ? t("Cronotermostato", "Thermostat schedule")
    : fraseDelQuando(a.quando);
}

function boxDellaCasa(elenco) {
  const ponte = state.ponte;
  const perId = new Map(elenco.map((a) => [a.id, a]));
  /* Cosa viene dopo: lo dice la casa; senza la casa lo si calcola qui con gli
   * stessi conti, perche' «prossimo» e' una domanda d'orologio. */
  const prossimi = (
    ponte?.prossimi?.length
      ? ponte.prossimi
      : prossimiEventi(elenco, Date.now(), (id) => stati()[id] || null)
  ).filter((p) => perId.has(p.id));
  const detto = (p) => {
    const a = perId.get(p.id);
    if (a.tipo === "crono") return `${nomeDellAutomazione(a)}: ${p.crono}°`;
    return a.nome || fraseDellAllora(a.allora);
  };
  const primo = prossimi[0];
  const poi = prossimi[1];
  const poiAlle = poi ? oraBreve(poi.alle) : "";
  const poiCosa = poi ? detto(poi) : "";
  const pross = primo
    ? `<div class="au-pross"><b>${esc(oraBreve(primo.alle))}</b><span>${esc(detto(primo))}${
        poi
          ? `<small>${esc(t(`poi alle ${poiAlle}: ${poiCosa}`, `then at ${poiAlle}: ${poiCosa}`))}</small>`
          : ""
      }</span></div>`
    : `<div class="au-vuoto">${esc(t("Niente a un orario, per ora.", "Nothing on a schedule, for now."))}</div>`;
  const ultime = (ponte?.ultime || []).filter((u) => perId.has(u.id)).slice(0, 3);
  const ult = ultime.length
    ? `<div class="au-ult">${ultime
        .map(
          (u) =>
            `<div><em>${esc(oraBreve(u.alle))}</em><span>${esc(nomeDellAutomazione(perId.get(u.id)))}</span>${
              u.esito === "ok" ? "<i>✓</i>" : u.esito === "errore" ? '<i class="no">✕</i>' : ""
            }</div>`,
        )
        .join("")}</div>`
    : `<div class="au-vuoto">${esc(
        state.assente
          ? t(
              "Le esegue l'add-on gdahome: qui non c'è.",
              "The gdahome add-on runs them: it is not here.",
            )
          : t("Ancora nessuna.", "None yet."),
      )}</div>`;
  return `<div class="au-due">
<div class="au-box blu"><div class="au-et">${esc(t("Prossimo", "Next"))}</div>${pross}</div>
<div class="au-box"><div class="au-et">${esc(t("Ultime eseguite", "Last run"))}</div>${ult}</div></div>`;
}

function rigaDellaLista(a) {
  const ultima = state.ponte?.perAutomazione?.[a.id];
  const se = a.tipo === "regola" && a.soloSe.length ? fraseDellaCondizione(a.soloSe[0]) : "";
  const giorni =
    a.tipo === "regola" && a.quando.tipo === "orario" ? giorniDetti(a.quando.giorni) : "";
  const pastiglia = [giorni, se].filter(Boolean).join(" · ");
  const quando = a.tipo === "crono" ? nomeDellAutomazione(a) : a.nome || fraseDelQuando(a.quando);
  const sotto = a.tipo === "crono" ? fraseDelCrono(a.crono) : fraseDellAllora(a.allora);
  const sopra = a.tipo === "regola" && a.nome ? fraseDelQuando(a.quando) : "";
  const fu = ultima?.alle ? quandoFu(ultima.alle) : "";
  return `<div class="au-riga${a.attiva ? "" : " spenta"}" data-au-apri="${esc(a.id)}" role="button" tabindex="0">
<span class="au-ico">${disegno(DISEGNO_DEL_QUANDO[a.tipo === "crono" ? "crono" : a.quando.tipo], `riga-${a.id}`)}</span>
<div class="au-frase"><div class="au-quando">${esc(quando)}${pastiglia ? `<span class="au-se">${esc(pastiglia)}</span>` : ""}</div>
${sopra ? `<div class="au-sopra">${esc(sopra)}</div>` : ""}
<div class="au-allora"><span class="fr">→</span>${esc(sotto || "…")}</div>
<div class="au-ultima">${esc(
    ultima?.alle
      ? t(`ultima volta: ${fu}`, `last time: ${fu}`)
      : t("ultima volta: mai", "last time: never"),
  )}${ultima?.esito === "errore" ? ` · <b class="au-male">${esc(t("non è andata", "it failed"))}</b>` : ""}</div></div>
<button type="button" class="au-int" role="switch" aria-checked="${a.attiva}" data-au-attiva="${esc(a.id)}" aria-label="${esc(t("Attiva o spenta", "On or off"))}"><i></i></button><span class="au-fr" aria-hidden="true">›</span></div>`;
}

function lista({ app }) {
  const elenco = leAutomazioni();
  const nonPrincipale = currentProfile() !== "primary";
  const nota = nonPrincipale
    ? `<div class="au-nota">${esc(
        t(
          "La casa esegue solo le automazioni della plancia principale: quelle scritte qui restano ferme.",
          "The home only runs the main dashboard's automations: the ones written here stay idle.",
        ),
      )}</div>`
    : "";
  const righe = elenco.length
    ? `<div class="au-lista">${elenco.map(rigaDellaLista).join("")}</div>`
    : `<div class="au-lista au-lista-vuota"><p>${esc(t("Nessuna automazione: comincia da un modello pronto.", "No automations: start from a ready-made template."))}</p><button type="button" class="au-piu" data-au-vai="modelli">＋ ${esc(t("Nuova", "Add new"))}</button></div>`;
  return `${nota}${boxDellaCasa(elenco)}
<div class="au-testa"><h3>${esc(t("Le tue automazioni", "Your automations"))}</h3>${
    app && !elenco.length
      ? ""
      : `<button type="button" class="au-piu" data-au-vai="modelli">＋ ${esc(t("Nuova", "Add new"))}</button>`
  }</div>${righe}`;
}

const INTRO = () =>
  `<p class="au-intro">${esc(
    t(
      "Quando succede qualcosa — un orario, una porta, un movimento, un valore, chi arriva o esce — la casa fa da sola quello che le dici. Le esegue l'add-on, anche con la plancia e l'app chiuse.",
      "When something happens — a time, a door, motion, a value, someone arriving or leaving — the home does what you told it, by itself. The add-on runs them, even with the dashboard and the app closed.",
    ),
  )} <span class="au-prem">PREMIUM</span></p>`;

function velo(dentro) {
  return `<div class="au-velato"><div class="au-sotto" aria-hidden="true" inert>${dentro}</div><div class="au-velo"><span class="st">✨</span><h3>${esc(
    t("Automazioni con Premium", "Automations with Premium"),
  )}</h3><p>${esc(
    t(
      "Luci, tapparelle, clima e avvisi che partono da soli: a un orario, quando si apre una porta, quando c'è movimento o quando esci di casa.",
      "Lights, shutters, climate and alerts that start by themselves: at a time, when a door opens, when there is motion or when you leave home.",
    ),
  )}</p><button type="button" data-au-scopri>${esc(t("Scopri Premium", "Discover Premium"))}</button><small>${esc(
    t("Premium si attiva dall'app gdahome.", "Premium is turned on from the gdahome app."),
  )}</small>${
    state.scopri
      ? `<small class="au-scopri-di-piu">${esc(
          t(
            "Le automazioni che scrivi restano salvate: la casa le esegue dal giorno in cui è Premium.",
            "The automations you write stay saved: the home runs them from the day it is Premium.",
          ),
        )}</small>`
      : ""
  }</div></div>`;
}

/* ── i modelli ───────────────────────────────────────────────────────────── */

const MODELLI = () => [
  [
    "luce",
    "presenza",
    t("Luce col movimento", "Light with motion"),
    t(
      "Accende quando passi, spegne dopo qualche minuto",
      "Turns on when you walk by, off a few minutes later",
    ),
  ],
  [
    "tapparelle",
    "tapparelle",
    t("Tapparelle a orario", "Shutters on a schedule"),
    t(
      "Apri e chiudi agli orari che scegli, o con alba e tramonto",
      "Open and close at the times you choose, or with sunrise and sunset",
    ),
  ],
  [
    "finestra",
    "finestra",
    t("Clima spento con finestra aperta", "Climate off with the window open"),
    t(
      "Si spegne quando apri, riparte quando chiudi",
      "Turns off when you open, back on when you close",
    ),
  ],
  [
    "lavatrice",
    "elettrodomestici",
    t("Avvisami quando la lavatrice ha finito", "Tell me when the washer is done"),
    t("Una notifica sull'app a fine ciclo", "A notification on the app at the end of the cycle"),
  ],
  [
    "fuori",
    "persone",
    t("Tutti fuori: spegni tutto", "Everyone out: turn it all off"),
    t(
      "Luci, prese e clima quando esce l'ultimo",
      "Lights, plugs and climate when the last one leaves",
    ),
  ],
  [
    "bentornato",
    "home",
    t("Bentornato a casa", "Welcome home"),
    t("Luci e clima quando arriva qualcuno", "Lights and climate when someone arrives"),
  ],
  [
    "crono",
    "caldo",
    t("Cronotermostato", "Thermostat schedule"),
    t("Due temperature e due giornate tipo", "Two temperatures and two typical days"),
  ],
];

function modelli() {
  return `<p class="au-intro">${esc(t("Parti da un modello pronto e cambia quello che vuoi, oppure da zero.", "Start from a ready-made template and change what you like, or from scratch."))}</p>
<div class="au-modelli">${MODELLI()
    .map(
      ([k, d, b, s]) =>
        `<button type="button" class="au-mod" data-au-modello="${k}"><span class="au-ico">${disegno(d, `mod-${k}`)}</span><b>${esc(b)}</b><small>${esc(s)}</small></button>`,
    )
    .join(
      "",
    )}<button type="button" class="au-mod zero" data-au-modello="zero"><span class="au-ico">＋</span><b>${esc(
    t("Da zero", "From scratch"),
  )}</b><small>${esc(t("Quando, solo se, allora: scegli tu", "When, only if, then: you choose"))}</small></button></div>`;
}

/* Le bozze dei modelli: precompilate con le prime cose della casa che
 * fanno al caso, e tutto si cambia nell'editor. */
function bozzaDelModello(chiave) {
  const id = nuovoId();
  const luce = primaDi("luce");
  const clima = primaDi("clima");
  if (chiave === "crono")
    return {
      id,
      nome: t("Cronotermostato", "Thermostat schedule"),
      attiva: true,
      tipo: "crono",
      crono: {
        ...cronoPulito({}),
        termostati: clima ? [clima] : [],
        finestre: primaDi("finestra") ? [primaDi("finestra")] : [],
      },
    };
  const base = { id, attiva: true, tipo: "regola", soloSe: [], allora: [] };
  if (chiave === "luce")
    return {
      ...base,
      nome: t("Luce col movimento", "Light with motion"),
      quando: {
        tipo: "movimento",
        entita: [primaDi("movimento")].filter(Boolean),
        verso: "si",
        minuti: 5,
      },
      soloSe: [{ tipo: "notte", da: "", a: "" }],
      allora: [
        { tipo: "accendi", entita: luce, livello: 30 },
        { tipo: "aspetta", minuti: 2 },
        { tipo: "spegni", entita: luce },
      ],
    };
  if (chiave === "tapparelle")
    return {
      ...base,
      nome: t("Tapparelle a orario", "Shutters on a schedule"),
      quando: {
        tipo: "orario",
        ore: ["07:15"],
        sole: "",
        scarto: 0,
        giorni: [true, true, true, true, true, true, true],
      },
      allora: [{ tipo: "tapparella", entita: primaDi("tapparella"), modo: "apri" }],
    };
  if (chiave === "finestra")
    return {
      ...base,
      nome: t("Clima spento con finestra aperta", "Climate off with the window open"),
      quando: { tipo: "apertura", entita: [primaDi("finestra")].filter(Boolean), verso: "apre" },
      allora: [{ tipo: "clima", entita: clima, modo: "spegni" }],
    };
  if (chiave === "lavatrice")
    return {
      ...base,
      nome: t("La lavatrice ha finito", "The washer is done"),
      quando: {
        tipo: "elettrodomestico",
        entita: primaDi("potenza", /lavatric|washing|washer/i),
        soglia: 5,
        minuti: 3,
      },
      allora: [{ tipo: "notifica", testo: t("La lavatrice ha finito", "The washer is done") }],
    };
  if (chiave === "fuori")
    return {
      ...base,
      nome: t("Tutti fuori: spegni tutto", "Everyone out: turn it all off"),
      quando: { tipo: "persone", verso: "tuttiFuori", chi: [] },
      allora: [
        ...(opzioni("luce").length
          ? [
              {
                tipo: "spegni",
                entita: opzioni("luce")
                  .slice(0, 8)
                  .map(([e]) => e),
              },
            ]
          : []),
        ...(clima ? [{ tipo: "clima", entita: [clima], modo: "spegni" }] : []),
      ],
    };
  if (chiave === "bentornato")
    return {
      ...base,
      nome: t("Bentornato a casa", "Welcome home"),
      quando: { tipo: "persone", verso: "arriva", chi: [] },
      soloSe: [{ tipo: "notte", da: "", a: "" }],
      allora: [
        ...(luce ? [{ tipo: "accendi", entita: luce }] : []),
        ...(clima ? [{ tipo: "clima", entita: clima, modo: "temperatura", gradi: 21 }] : []),
      ],
    };
  return {
    ...base,
    nome: "",
    quando: {
      tipo: "orario",
      ore: ["07:00"],
      sole: "",
      scarto: 0,
      giorni: [true, true, true, true, true, true, true],
    },
    allora: [{ tipo: "accendi", entita: luce }],
  };
}

/* ── l'editor ────────────────────────────────────────────────────────────── */

/* Una tendina. Con `cerca` in fondo c'e' «🔍 Tutte le entità…»: apre la
 * ricerca del config su TUTTE le entita' di Home Assistant, non solo quelle
 * proposte qui — la tendina propone, la ricerca trova. La scelta torna nella
 * casella nascosta accanto, e da li' nella bozza come una scelta qualunque. */
const sel = (via, valore, voci, { vuota = null, classe: c = "", cerca = false } = {}) =>
  `<select class="au-sel${c ? ` ${c}` : ""}" data-au-campo="${esc(via)}">${
    vuota !== null ? `<option value="">${esc(vuota)}</option>` : ""
  }${voci
    .map(
      ([v, testo]) =>
        `<option value="${esc(v)}"${String(v) === String(valore) ? " selected" : ""}>${esc(testo)}</option>`,
    )
    .join("")}${
    valore && !voci.some(([v]) => String(v) === String(valore))
      ? `<option value="${esc(valore)}" selected>${esc(dominio(valore) && valore.includes(".") ? nomeDi(valore) : valore)}</option>`
      : ""
  }${cerca ? `<option value="__cerca__">🔍 ${esc(t("Tutte le entità…", "All entities…"))}</option>` : ""}</select>${
    cerca
      ? `<input type="text" hidden class="au-cerca-in" data-au-campo="${esc(via)}" data-au-cerca-di="${esc(via)}" value="">`
      : ""
  }`;

const numeroIn = (via, valore, { passo = 1, min = "", max = "", largo = 70 } = {}) =>
  `<input class="au-sel au-num-in" type="number" inputmode="decimal" step="${passo}" min="${min}" max="${max}" style="width:${largo}px" data-au-campo="${esc(via)}" value="${esc(valore)}">`;

const oraIn = (via, valore, segnaposto = "") =>
  `<input class="au-sel au-ora-in" type="time" data-au-campo="${esc(via)}" value="${esc(valore)}" placeholder="${esc(segnaposto)}">`;

/* Una scritta a mano: uno stato, un attributo, un evento. Si scrive senza
 * ridisegnare la riga (la frase sotto si', `onInput`). */
const testoIn = (via, valore, segnaposto = "", largo = 130, lista = "") =>
  `<input class="au-sel au-scritto-in" type="text" autocomplete="off" spellcheck="false" style="width:${largo}px" data-au-testo="${esc(via)}" value="${esc(valore ?? "")}" placeholder="${esc(segnaposto)}"${lista ? ` list="${lista}"` : ""}>`;

const togli = (via) =>
  `<button type="button" class="au-x" data-au-togli="${esc(via)}" aria-label="${esc(t("Togli", "Remove"))}">✕</button>`;

const nessuna = () => t("— scegli —", "— choose —");

/** Una entita', con la ricerca su tutta la casa in fondo alla tendina. */
const unaEntita = (via, valore, quale, vuota = nessuna()) =>
  sel(via, valore || "", opzioni(quale), { vuota, cerca: true });

function entitaMolte(via, elenco, quale, massimo = ENTITA_AL_MASSIMO) {
  const lista = Array.isArray(elenco) ? elenco : elenco ? [elenco] : [];
  const tutte = opzioni(quale);
  const scelte = lista.map(
    (id, i) =>
      `<span class="au-coppia">${sel(`${via}.${i}`, id, tutte, { cerca: true })}${lista.length > 1 ? togli(`${via}.${i}`) : ""}</span>`,
  );
  if (lista.length < massimo)
    scelte.push(
      sel(`${via}.+`, "", tutte, {
        vuota: lista.length ? "＋" : nessuna(),
        classe: lista.length ? "au-sel-piu" : "",
        cerca: true,
      }),
    );
  return scelte.join(` <span class="au-o">${esc(t("o", "or"))}</span> `);
}

/* Per le azioni «e» e non «o»: accendi questa e questa. */
const entitaInsieme = (via, elenco, quale) =>
  entitaMolte(via, elenco, quale).replaceAll(
    ` <span class="au-o">${esc(t("o", "or"))}</span> `,
    ` <span class="au-o">${esc(t("e", "and"))}</span> `,
  );

function chipGiorni(via, giorni) {
  const nomi = iniziali();
  return `<span class="au-gg">${nomi
    .map(
      (g, i) =>
        `<button type="button" class="${giorni?.[i] ? "si" : ""}" data-au-giorno="${esc(`${via}.${i}`)}" aria-pressed="${Boolean(giorni?.[i])}" aria-label="${esc(g.corto)}">${esc(g.breve)}</button>`,
    )
    .join("")}</span>`;
}

/* Gli attributi che un'entita' ha adesso: la tendina li propone, e si puo'
 * scrivere anche uno che adesso non c'e'. */
function attributiDi(id) {
  return Object.keys(stati()[id]?.attributes || {})
    .filter((k) => k !== "friendly_name")
    .sort()
    .map((k) => [k, k]);
}

/* Gli stati che un'entita' puo' avere, se li dice (le opzioni di una
 * tendina, le sorgenti di un lettore), da proporre accanto alla scritta. */
function statiPossibili(id) {
  const s = stati()[id];
  const a = s?.attributes || {};
  const d = dominio(id);
  if (Array.isArray(a.options)) return a.options.map(String);
  if (["light", "switch", "fan", "input_boolean", "binary_sensor", "automation"].includes(d))
    return ["on", "off"];
  if (d === "cover") return ["open", "closed", "opening", "closing"];
  if (d === "person" || d === "device_tracker") return ["home", "not_home"];
  if (d === "media_player") return ["playing", "paused", "idle", "off", "on"];
  if (d === "climate" && Array.isArray(a.hvac_modes)) return a.hvac_modes.map(String);
  if (d === "alarm_control_panel")
    return ["disarmed", "armed_home", "armed_away", "armed_night", "triggered"];
  return s?.state ? [String(s.state)] : [];
}

let liste = 0;
/* Una scritta con i suggerimenti sotto (`datalist`): si sceglie o si scrive. */
function scrittoConSuggerimenti(via, valore, suggeriti, segnaposto = "", largo = 130) {
  const id = `au-lista-${liste++ % 200}`;
  return `${testoIn(via, valore, segnaposto, largo, id)}<datalist id="${id}">${[
    ...new Set(suggeriti),
  ]
    .slice(0, 60)
    .map((v) => `<option value="${esc(v)}"></option>`)
    .join("")}</datalist>`;
}

const EVENTI_NOTI = [
  "zha_event",
  "deconz_event",
  "hue_event",
  "shelly.click",
  "tag_scanned",
  "mobile_app_notification_action",
  "ios.action_fired",
  "lutron_caseta_button_event",
  "knx_event",
  "esphome.button_pressed",
];

function campiDelQuando(q) {
  if (q.tipo === "orario") {
    const modo = sel("quando.sole", q.sole || "", [
      ["", t("all'ora", "at the time")],
      ["alba", t("all'alba", "at sunrise")],
      ["tramonto", t("al tramonto", "at sunset")],
    ]);
    const ore = q.sole
      ? sel(
          "quando.scarto",
          q.scarto || 0,
          [-60, -30, -15, 0, 15, 30, 60].map((m) => [
            m,
            m === 0
              ? t("in punto", "exactly")
              : m < 0
                ? t(`${Math.abs(m)} min prima`, `${Math.abs(m)} min before`)
                : t(`${m} min dopo`, `${m} min after`),
          ]),
        )
      : `${(q.ore || [])
          .map(
            (o, i) =>
              `<span class="au-coppia">${oraIn(`quando.ore.${i}`, o)}${q.ore.length > 1 ? togli(`quando.ore.${i}`) : ""}</span>`,
          )
          .join(` <span class="au-o">${esc(t("e", "and"))}</span> `)}${
          (q.ore || []).length < ORARI_AL_MASSIMO
            ? ` <button type="button" class="au-agg-pic" data-au-aggiungi="quando.ore">＋ ${esc(t("ora", "time"))}</button>`
            : ""
        }`;
    return `${modo} ${ore}</div><div class="au-rf">${chipGiorni("quando.giorni", q.giorni)}`;
  }
  if (q.tipo === "ogni")
    return sel(
      "quando.minuti",
      q.minuti,
      [5, 10, 15, 20, 30, 60, 120, 180, 360, 720, 1440].map((m) => [m, `${m} min`]),
    );
  if (q.tipo === "apertura")
    return `${entitaMolte("quando.entita", q.entita, "apertura")} ${sel("quando.verso", q.verso, [
      ["apre", t("si apre", "opens")],
      ["chiude", t("si chiude", "closes")],
    ])}`;
  if (q.tipo === "movimento")
    return `<span class="au-o">${esc(t("in", "in:"))}</span> ${entitaMolte("quando.entita", q.entita, "movimento")} ${sel(
      "quando.verso",
      q.verso,
      [
        ["si", t("appena c'è", "as soon as there is")],
        ["no", t("nessuno da…", "none for…")],
      ],
    )}${
      q.verso === "no"
        ? ` ${sel(
            "quando.minuti",
            q.minuti,
            [2, 5, 10, 15, 20, 30, 45, 60, 120].map((m) => [m, `${m} min`]),
          )}`
        : ""
    }`;
  if (q.tipo === "valore")
    return `${unaEntita("quando.entita", q.entita, "valore")} ${sel("quando.verso", q.verso, [
      ["sopra", t("sale sopra", "rises above")],
      ["sotto", t("scende sotto", "drops below")],
    ])} ${numeroIn("quando.soglia", q.soglia, { passo: "any" })}<span class="au-o">${esc(misuraDi(q.entita))}</span>`;
  if (q.tipo === "persone")
    return `${sel("quando.verso", q.verso, [
      ["arriva", t("arriva a casa", "gets home")],
      ["esce", t("esce di casa", "leaves home")],
      ["tuttiFuori", t("tutti sono fuori", "everyone is out")],
    ])}${
      q.verso === "tuttiFuori"
        ? ""
        : ` <span class="au-o">${esc(t("chi", "who"))}</span> ${sel(
            "quando.chi.0",
            q.chi?.[0] || "",
            opzioni("persona"),
            { vuota: t("chiunque", "anyone") },
          )}`
    }`;
  if (q.tipo === "antifurto")
    return `${unaEntita("quando.entita", q.entita, "antifurto")} ${sel("quando.verso", q.verso, [
      ["inserito", t("si inserisce", "is armed")],
      ["disinserito", t("si disinserisce", "is disarmed")],
      ["suona", t("suona", "goes off")],
    ])}`;
  if (q.tipo === "stato") {
    const possibili = (q.entita || []).flatMap(statiPossibili);
    return `${entitaMolte("quando.entita", q.entita, "tutte")}</div><div class="au-rf"><span class="au-o">${esc(
      t("da", "from"),
    )}</span> ${scrittoConSuggerimenti("quando.da", q.da, possibili, t("qualsiasi", "any"), 110)} <span class="au-o">${esc(
      t("a", "to"),
    )}</span> ${scrittoConSuggerimenti("quando.a", q.a, possibili, t("qualsiasi", "any"), 110)} ${sel(
      "quando.per",
      q.per || 0,
      [0, 1, 2, 5, 10, 15, 30, 60, 120].map((m) => [
        m,
        m ? t(`da ${m} min`, `for ${m} min`) : t("subito", "right away"),
      ]),
    )}`;
  }
  if (q.tipo === "attributo")
    return `${unaEntita("quando.entita", q.entita, "tutte")} ${sel(
      "quando.attributo",
      q.attributo || "",
      attributiDi(q.entita),
      {
        vuota: t("— attributo —", "— attribute —"),
      },
    )} <span class="au-o">${esc(t("diventa", "becomes"))}</span> ${testoIn(
      "quando.valore",
      q.valore,
      t("qualsiasi", "any"),
      110,
    )}`;
  if (q.tipo === "evento") {
    const filtro = Array.isArray(q.filtroRighe) ? q.filtroRighe : Object.entries(q.filtro || {});
    const righe = filtro
      .map(
        ([k, v], i) =>
          `<span class="au-coppia">${testoIn(`quando.filtroRighe.${i}.0`, k, t("campo", "event field"), 100)}<span class="au-o">=</span>${testoIn(`quando.filtroRighe.${i}.1`, v, t("valore", "value"), 110)}${togli(`quando.filtroRighe.${i}`)}</span>`,
      )
      .join(" ");
    return `${scrittoConSuggerimenti("quando.evento", q.evento, EVENTI_NOTI, "zha_event", 170)}</div><div class="au-rf"><span class="au-o">${esc(
      t("con", "with"),
    )}</span> ${righe} ${
      filtro.length < 6
        ? `<button type="button" class="au-agg-pic" data-au-aggiungi="quando.filtroRighe">＋ ${esc(t("campo", "event field"))}</button>`
        : ""
    }<small class="au-nota-in">${esc(t("Lo vedi in Strumenti per sviluppatori → Eventi.", "You can see it in Developer tools → Events."))}</small>`;
  }
  return `${unaEntita("quando.entita", q.entita, "potenza")} <span class="au-o">${esc(
    t("sotto", "below"),
  )}</span> ${numeroIn("quando.soglia", q.soglia, { passo: "any", largo: 64 })}<span class="au-o">W ${esc(
    t("per", "for"),
  )}</span> ${sel(
    "quando.minuti",
    q.minuti,
    [1, 2, 3, 5, 10, 15].map((m) => [m, `${m} min`]),
  )}`;
}

function tendinaDelQuando(q) {
  const voci = QUANDO_DELLA_TENDINA();
  const altre = QUANDO_ALTRO();
  const scelta = [...voci, ...altre].find(([k]) => k === q.tipo) || voci[0];
  const etichetta =
    q.tipo === "movimento" && q.verso === "no" ? t("nessun movimento", "no motion") : scelta[2];
  const riga = ([k, e, testo, nota]) =>
    `<button type="button" role="option" class="${k === q.tipo ? "si" : ""}" data-au-quando="${k}" aria-selected="${k === q.tipo}">${e} ${esc(testo)}<small>${esc(nota)}</small></button>`;
  const altroAperto = state.tendinaAltro || altre.some(([k]) => k === q.tipo);
  return `<span class="au-tendina-qui"><button type="button" class="au-sel au-sel-quando" data-au-tendina aria-expanded="${state.tendina}">${scelta[1]} ${esc(etichetta)}</button>${
    state.tendina
      ? `<div class="au-tendina" role="listbox">${voci.map(riga).join("")}<button type="button" class="au-altro" data-au-tendina-altro aria-expanded="${altroAperto}">${esc(
          t("Altro…", "More…"),
        )}<small>${altroAperto ? "▾" : "▸"}</small></button>${altroAperto ? altre.map(riga).join("") : ""}</div>`
      : ""
  }</span>`;
}

const TIPI_DELLE_CONDIZIONI = () => [
  ["notte", `🌙 ${t("è notte", "it is night")}`],
  ["fascia", `🕐 ${t("fra due orari", "between two times")}`],
  ["giorni", `📅 ${t("certi giorni", "certain days")}`],
  ["casa", `🏠 ${t("chi è in casa", "who is home")}`],
  ["stato", `💡 ${t("un'entità è…", "an entity is…")}`],
  ["valore", `🌡️ ${t("un valore è…", "a value is…")}`],
  ["uguale", `🔣 ${t("un'entità è in uno stato…", "an entity is in a state…")}`],
  ["attributo", `🏷️ ${t("un attributo è…", "an attribute is…")}`],
  ["sole", `☀️ ${t("il sole è…", "the sun is…")}`],
];

function campiDellaCondizione(c, i) {
  const via = `soloSe.${i}`;
  if (c.tipo === "notte")
    return `<span class="au-o">${esc(t("fra le", "from"))}</span> ${oraIn(`${via}.da`, c.da)} <span class="au-o">${esc(
      t("e", "and"),
    )}</span> ${oraIn(`${via}.a`, c.a)}${
      c.da && c.a
        ? ""
        : `<small class="au-nota-in">${esc(t("vuoti: dal tramonto all'alba", "empty: sunset to sunrise"))}</small>`
    }`;
  if (c.tipo === "fascia")
    return `${oraIn(`${via}.da`, c.da)} <span class="au-o">${esc(t("e", "and"))}</span> ${oraIn(`${via}.a`, c.a)}`;
  if (c.tipo === "giorni") return chipGiorni(`${via}.giorni`, c.giorni);
  if (c.tipo === "casa")
    return sel(`${via}.chi`, c.chi, [
      ["qualcuno", t("qualcuno in casa", "someone home")],
      ["nessuno", t("nessuno in casa", "nobody home")],
    ]);
  if (c.tipo === "sole")
    return sel(`${via}.posizione`, c.posizione || "sopra", [
      ["sopra", t("sopra l'orizzonte", "above the horizon")],
      ["sotto", t("sotto l'orizzonte", "below the horizon")],
    ]);
  if (c.tipo === "stato")
    return `${unaEntita(`${via}.entita`, c.entita, "stato")} ${sel(`${via}.vale`, c.vale, [
      ["acceso", t("è acceso / aperto", "is on / open")],
      ["spento", t("è spento / chiuso", "is off / closed")],
    ])}`;
  if (c.tipo === "uguale")
    return `${unaEntita(`${via}.entita`, c.entita, "tutte")} ${sel(
      `${via}.non`,
      c.non ? "si" : "",
      [
        ["", t("è", "equals")],
        ["si", t("non è", "is not")],
      ],
    )} ${scrittoConSuggerimenti(`${via}.valore`, c.valore, statiPossibili(c.entita), t("stato, o più con la virgola", "state, or several with commas"), 170)}`;
  if (c.tipo === "attributo")
    return `${unaEntita(`${via}.entita`, c.entita, "tutte")} ${sel(
      `${via}.attributo`,
      c.attributo || "",
      attributiDi(c.entita),
      {
        vuota: t("— attributo —", "— attribute —"),
      },
    )} ${sel(`${via}.confronto`, c.confronto || "uguale", [
      ["uguale", t("è", "equals")],
      ["sopra", t("sopra", "above")],
      ["sotto", t("sotto", "below")],
    ])} ${testoIn(`${via}.valore`, c.valore, t("valore", "value"), 100)}`;
  return `${unaEntita(`${via}.entita`, c.entita, "valore")} ${sel(`${via}.verso`, c.verso, [
    ["sopra", t("sopra", "above")],
    ["sotto", t("sotto", "below")],
  ])} ${numeroIn(`${via}.soglia`, c.soglia, { passo: "any" })}`;
}

const TIPI_DELLE_AZIONI = () => [
  ["accendi", `💡 ${t("accendi", "turn on")}`],
  ["spegni", `⏻ ${t("spegni", "turn off")}`],
  ["tapparella", `🪟 ${t("tapparella", "shutter")}`],
  ["clima", `🌡️ ${t("clima", "climate")}`],
  ["azione", `⚡ ${t("azione della plancia", "dashboard action")}`],
  ["notifica", `📱 ${t("notifica", "notification")}`],
  ["aspetta", `⏱ ${t("aspetta", "wait")}`],
];
/* Le azioni per chi vuole tutta Home Assistant: nella stessa tendina, in un
 * gruppo «Altro…» in fondo. */
const TIPI_ALTRI = () => [
  ["imposta", `🎚️ ${t("imposta un valore", "set a value")}`],
  ["media", `🎵 ${t("lettore multimediale", "media player")}`],
  ["aspettaChe", `⏳ ${t("aspetta finché…", "wait until…")}`],
  ["servizio", `🧰 ${t("chiama un servizio", "call a service")}`],
];

function tendinaDellAzione(via, tipo) {
  const voce = ([v, testo]) =>
    `<option value="${esc(v)}"${v === tipo ? " selected" : ""}>${esc(testo)}</option>`;
  return `<select class="au-sel" data-au-campo="${esc(via)}">${TIPI_DELLE_AZIONI().map(voce).join("")}<optgroup label="${esc(
    t("Altro…", "More…"),
  )}">${TIPI_ALTRI().map(voce).join("")}</optgroup></select>`;
}

function campiDellAzione(a, i) {
  const via = `allora.${i}`;
  if (a.tipo === "aspetta")
    return sel(
      `${via}.minuti`,
      a.minuti,
      [1, 2, 3, 5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240].map((m) => [m, `${m} min`]),
    );
  if (a.tipo === "notifica")
    return `<input class="au-sel au-testo-in" type="text" maxlength="160" data-au-testo="${via}.testo" value="${esc(a.testo || "")}" placeholder="${esc(t("Cosa ti dice l'app", "What the app tells you"))}">`;
  if (a.tipo === "azione") {
    const azioni = azioniDellaPlancia();
    return azioni.length
      ? sel(
          `${via}.nome`,
          a.nome || "",
          azioni.map((n) => [n, n]),
          { vuota: nessuna() },
        )
      : `<small class="au-nota-in">${esc(t("Nessuna azione della plancia che parta da sola: si aggiungono in «Azioni».", "No dashboard action that can start by itself: add them in «Actions»."))}</small>`;
  }
  if (a.tipo === "accendi") {
    const elenco = Array.isArray(a.entita) ? a.entita : [];
    const luce = elenco.some((e) => dominio(e) === "light");
    return `${entitaInsieme(`${via}.entita`, elenco, "accendi")}${
      luce
        ? ` <span class="au-o">${esc(t("al", "at level"))}</span> ${sel(
            `${via}.livello`,
            a.livello || "",
            [10, 20, 30, 50, 70, 100].map((p) => [p, `${p}%`]),
            { vuota: t("come prima", "as before") },
          )}`
        : ""
    }`;
  }
  if (a.tipo === "spegni") return entitaInsieme(`${via}.entita`, a.entita, "spegni");
  if (a.tipo === "tapparella")
    return `${entitaInsieme(`${via}.entita`, a.entita, "tapparella")} ${sel(
      `${via}.modo`,
      a.modo || "apri",
      [
        ["apri", t("apri", "open it")],
        ["chiudi", t("chiudi", "close")],
        ["posizione", t("al…", "to…")],
      ],
    )}${
      a.modo === "posizione"
        ? ` ${sel(
            `${via}.posizione`,
            a.posizione ?? 50,
            [10, 20, 30, 40, 50, 60, 70, 80, 90].map((p) => [p, `${p}%`]),
          )}`
        : ""
    }`;
  if (a.tipo === "imposta") {
    const possibili = Array.isArray(stati()[a.entita]?.attributes?.options)
      ? stati()[a.entita].attributes.options.map(String)
      : [];
    return `${unaEntita(`${via}.entita`, a.entita, "imposta")} <span class="au-o">${esc(t("a", "to"))}</span> ${
      possibili.length
        ? sel(
            `${via}.valore`,
            a.valore || "",
            possibili.map((v) => [v, v]),
            { vuota: nessuna() },
          )
        : testoIn(`${via}.valore`, a.valore, t("valore", "value"), 110)
    }`;
  }
  if (a.tipo === "media") {
    const primo = Array.isArray(a.entita) ? a.entita[0] : "";
    const sorgenti = stati()[primo]?.attributes?.source_list;
    return `${entitaInsieme(`${via}.entita`, a.entita, "media")} ${sel(
      `${via}.comando`,
      a.comando || "play",
      [
        ["play", `▶ ${t("riproduci", "play")}`],
        ["pausa", `⏸ ${t("pausa", "pause")}`],
        ["stop", `⏹ ${t("ferma", "stop playback")}`],
        ["successivo", `⏭ ${t("brano dopo", "next track")}`],
        ["volume", `🔊 ${t("volume", "volume")}`],
        ["sorgente", `🎛️ ${t("sorgente", "input source")}`],
      ],
    )}${
      a.comando === "volume"
        ? ` ${sel(
            `${via}.valore`,
            a.valore || "30",
            [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((v) => [String(v), `${v}%`]),
          )}`
        : a.comando === "sorgente"
          ? ` ${
              Array.isArray(sorgenti) && sorgenti.length
                ? sel(
                    `${via}.valore`,
                    a.valore || "",
                    sorgenti.map((v) => [String(v), String(v)]),
                    { vuota: nessuna() },
                  )
                : testoIn(`${via}.valore`, a.valore, t("sorgente", "input source"), 120)
            }`
          : ""
    }`;
  }
  if (a.tipo === "aspettaChe")
    return `${unaEntita(`${via}.entita`, a.entita, "tutte")} <span class="au-o">${esc(
      t("diventa", "becomes"),
    )}</span> ${scrittoConSuggerimenti(`${via}.stato`, a.stato, statiPossibili(a.entita), "off", 100)} <span class="au-o">${esc(
      t("al massimo", "at most"),
    )}</span> ${sel(
      `${via}.massimo`,
      a.massimo || 10,
      [1, 2, 5, 10, 15, 30, 60, 120, 240].map((m) => [m, `${m} min`]),
    )}`;
  if (a.tipo === "servizio") {
    const scritto = clean(a.servizio);
    const chiuso = scritto && !servizioPermesso(scritto);
    return `${scrittoConSuggerimenti(`${via}.servizio`, a.servizio, ["notify.notify", "light.turn_on", "switch.toggle", "scene.turn_on", "script.turn_on", "input_boolean.toggle", "tts.speak", "persistent_notification.create"], "dominio.servizio", 190)}</div><div class="au-rf"><span class="au-o">${esc(
      t("su", "on"),
    )}</span> ${entitaInsieme(`${via}.entita`, a.entita, "tutte")}</div><div class="au-rf au-rf-dati"><textarea class="au-sel au-dati-in" rows="2" spellcheck="false" data-au-testo="${via}.dati" placeholder='{"message": "…"}'>${esc(
      typeof a.dati === "string"
        ? a.dati
        : a.dati && Object.keys(a.dati).length
          ? JSON.stringify(a.dati)
          : "",
    )}</textarea>${
      chiuso
        ? `<small class="au-nota-in au-male">${esc(t("Questo servizio la casa non lo chiama da sola.", "The home does not call this service by itself."))}</small>`
        : ""
    }`;
  }
  return `${entitaInsieme(`${via}.entita`, a.entita, "clima")} ${sel(
    `${via}.modo`,
    a.modo || "temperatura",
    [
      ["temperatura", t("a una temperatura", "to a temperature")],
      ["spegni", t("spegni", "turn off")],
    ],
  )}${a.modo === "spegni" ? "" : ` ${numeroIn(`${via}.gradi`, a.gradi ?? 21, { passo: 0.5, min: 5, max: 35, largo: 64 })}<span class="au-o">°</span>`}`;
}

/* Le opzioni dell'automazione, chiuse di serie: cosa fare se riscatta mentre
 * e' ancora in corso, una pausa minima fra due volte, e una data in cui si
 * accende o si spegne da sola. */
function avanzate(b) {
  const scadenza = b.scadenza || { data: "", stato: "spenta" };
  return `<button type="button" class="au-avanzate" data-au-avanzate aria-expanded="${state.avanzate}"><span>⚙️ ${esc(
    t("Avanzate", "Advanced"),
  )}</span><small>${esc(t("Se riscatta, pausa, fino a una data", "If it fires again, pause, until a date"))}</small><span class="au-fr">${state.avanzate ? "▾" : "▸"}</span></button>${
    state.avanzate
      ? `<div class="au-blocco au-v"><div class="au-rf"><span class="au-o">${esc(
          t("Se riscatta mentre è in corso", "If it fires while running"),
        )}</span> ${sel("modo", b.modo || "ricomincia", [
          ["ricomincia", t("ricomincia da capo", "start over")],
          ["ignora", t("ignora", "ignore")],
          ["coda", t("mettila in coda", "queue it")],
        ])}</div><div class="au-rf"><span class="au-o">${esc(t("Non più di una volta ogni", "No more than once every"))}</span> ${sel(
          "pausa",
          b.pausa || 0,
          [0, 1, 5, 10, 15, 30, 60, 120, 240, 720, 1440].map((m) => [
            m,
            m ? `${m} min` : t("— sempre —", "— always —"),
          ]),
        )}</div><div class="au-rf">${sel("scadenza.stato", b.scadenza ? scadenza.stato : "", [
          ["", t("Sempre come dice l'interruttore", "Always as the switch says")],
          ["spenta", t("Spenta fino al", "Off until")],
          ["attiva", t("Attiva fino al", "On until")],
        ])}${
          b.scadenza
            ? ` <input class="au-sel au-data-in" type="date" data-au-campo="scadenza.data" value="${esc(scadenza.data || "")}">`
            : ""
        }</div>${
          b.soloSe.length > 1
            ? `<div class="au-rf"><span class="au-o">${esc(t("Le condizioni", "Conditions"))}</span> ${sel(
                "tutte",
                b.tutte === false ? "no" : "si",
                [
                  ["si", t("tutte", "all")],
                  ["no", t("almeno una", "at least one")],
                ],
              )}</div>`
            : ""
        }</div>`
      : ""
  }`;
}

function editor({ app }) {
  const b = state.bozza;
  const q = b.quando;
  const pulita = pulitaDallaBozza(b);
  const esistente = leAutomazioni().some((a) => a.id === b.id);
  return `${
    app
      ? ""
      : `<button type="button" class="au-indietro" data-au-vai="${state.daModelli ? "modelli" : "lista"}">‹ ${esc(state.daModelli ? t("Modelli", "Templates") : t("Automazioni", "Automations"))}</button>`
  }<label class="au-nome">${esc(t("Nome", "Name"))} <input type="text" maxlength="60" data-au-testo="nome" value="${esc(b.nome || "")}" placeholder="${esc(t("Come la chiami", "What you call it"))}"></label>
<div class="au-blocco au-q"><div class="au-et">${esc(t("Quando", "When"))} <small>· ${esc(t("una cosa sola", "one thing only"))}</small></div>
<div class="au-rf">${tendinaDelQuando(q)} ${campiDelQuando(q)}</div></div>
<div class="au-blocco au-s"><div class="au-et">${esc(t("Solo se", "Only if"))} <small>· ${esc(
    b.soloSe.length > 1
      ? b.tutte === false
        ? t("basta una", "any one is enough")
        : t("tutte insieme", "all together")
      : t("facoltativo", "optional"),
  )}</small></div>
${b.soloSe
  .map(
    (c, i) =>
      `<div class="au-rf">${sel(`soloSe.${i}.tipo`, c.tipo, TIPI_DELLE_CONDIZIONI())} ${campiDellaCondizione(c, i)}${togli(`soloSe.${i}`)}</div>`,
  )
  .join("")}${
    b.soloSe.length < CONDIZIONI_AL_MASSIMO
      ? `<button type="button" class="au-agg" data-au-aggiungi="soloSe">＋ ${esc(
          b.soloSe.length
            ? t("Un'altra condizione", "Another condition")
            : t("Una condizione", "A condition"),
        )}</button>`
      : ""
  }</div>
<div class="au-blocco au-a"><div class="au-et">${esc(t("Allora", "Then do"))} <small>· ${esc(t("una o più, in ordine", "one or more, in order"))}</small></div>
${b.allora
  .map(
    (a, i) =>
      `<div class="au-rf"><span class="au-num">${i + 1}</span>${tendinaDellAzione(`allora.${i}.tipo`, a.tipo)} ${campiDellAzione(a, i)}${togli(`allora.${i}`)}</div>`,
  )
  .join("")}${
    b.allora.length < AZIONI_AL_MASSIMO
      ? `<button type="button" class="au-agg" data-au-aggiungi="allora">＋ ${esc(t("Aggiungi un'azione", "Add an action"))}</button>`
      : ""
  }</div>
${avanzate(b)}
<div class="au-leggi" data-au-leggi>${esc(t("Si legge così:", "It reads:"))} ${siLeggeCosi(pulita)}</div>
${state.errore ? `<div class="au-errore" role="alert">${esc(state.errore)}</div>` : ""}
<button type="button" class="au-salva" data-au-salva>💾 ${esc(t("SALVA", "SAVE"))}</button>
${esistente ? `<button type="button" class="au-elimina" data-au-elimina>🗑 ${esc(t("Elimina questa automazione", "Delete this automation"))}</button>` : ""}`;
}

/* ── il cronotermostato ──────────────────────────────────────────────────── */

function barra(via, fasce) {
  const mezzore = mezzoreDelleFasce(fasce);
  return `<div class="au-barra" data-au-barra="${via}" role="group" aria-label="${esc(t("Trascina per dire quando serve il caldo", "Drag to say when heating is needed"))}">${mezzore
    .map((si, i) => `<i class="${si ? "si" : ""}" data-au-mezzora="${i}"></i>`)
    .join(
      "",
    )}</div><div class="au-tac"><span>0</span><span>6</span><span>12</span><span>18</span><span>24</span></div>`;
}

function crono({ app }) {
  const b = state.bozza;
  const c = b.crono;
  const primo = c.termostati[0];
  const s = primo ? stati()[primo] : null;
  const ora = s?.attributes?.current_temperature;
  const oraLetta = Number.isFinite(Number(ora)) ? Number(ora).toLocaleString(locale()) : ora;
  const fa = clean(s?.attributes?.hvac_action);
  const nomiDelleAzioni = {
    heating: t("sta scaldando", "heating"),
    idle: t("fermo", "idle"),
    off: t("spento", "off"),
  };
  const finestra = c.finestre[0] || "";
  const esistente = leAutomazioni().some((a) => a.id === b.id);
  const giorni = iniziali();
  return `${
    app
      ? ""
      : `<button type="button" class="au-indietro" data-au-vai="${state.daModelli ? "modelli" : "lista"}">‹ ${esc(state.daModelli ? t("Modelli", "Templates") : t("Automazioni", "Automations"))}</button>`
  }<label class="au-nome">${esc(t("Nome", "Name"))} <input type="text" maxlength="60" data-au-testo="nome" value="${esc(b.nome || "")}"></label>
<div class="au-blocco au-q"><div class="au-et">${esc(t("Cosa", "What"))}</div><div class="au-rf"><span class="au-ico au-ico-p">${disegno("caldo", "crono")}</span>${entitaMolte(
    "crono.termostati",
    c.termostati,
    "clima",
    TERMOSTATI_AL_MASSIMO,
  )}${
    ora !== undefined && ora !== null
      ? `<small class="au-nota-in">${esc(t(`ora ${oraLetta}°`, `now ${oraLetta}°`))}${fa && nomiDelleAzioni[fa] ? ` · ${esc(nomiDelleAzioni[fa])}` : ""}</small>`
      : ""
  }</div></div>
<div class="au-blocco au-s"><div class="au-et">${esc(t("Temperature", "Temperatures"))}</div><div class="au-temp">
<div class="c"><div><small>${esc(t("IN CASA", "AT HOME"))}</small><b>${esc(String(c.inCasa).replace(".", ","))}°</b></div><span class="pm"><button type="button" data-au-gradi="inCasa" data-au-passo="-0.5" aria-label="−">−</button><button type="button" data-au-gradi="inCasa" data-au-passo="0.5" aria-label="+">+</button></span></div>
<div class="e"><div><small>${esc(t("NOTTE / FUORI", "NIGHT / AWAY"))}</small><b>${esc(String(c.fuori).replace(".", ","))}°</b></div><span class="pm"><button type="button" data-au-gradi="fuori" data-au-passo="-0.5" aria-label="−">−</button><button type="button" data-au-gradi="fuori" data-au-passo="0.5" aria-label="+">+</button></span></div></div></div>
<div class="au-blocco au-a"><div class="au-et">${esc(t("Quando serve il caldo", "When heating is needed"))} <small>· ${esc(t("trascina sulle barre", "drag on the bars"))}</small></div>
<div class="au-giorno"><small>${esc(`${giorni[0].corto} – ${giorni[4].corto}`)}</small>${barra("feriali", c.feriali)}</div>
<div class="au-giorno"><small>${esc(`${giorni[5].corto} – ${giorni[6].corto}`)}</small>${barra("festivi", c.festivi)}</div>
<div class="au-rf">${sel("crono.finestre.0", finestra, opzioni("finestra"), { vuota: t("🪟 nessuna finestra", "🪟 no window"), cerca: true })} <span class="au-o">→ ${esc(
    t("si spegne, riparte quando la chiudi", "turns off, restarts when you close it"),
  )}</span><button type="button" class="au-int au-int-dx" role="switch" aria-checked="${c.finestraSpegne}" data-au-finestra aria-label="${esc(t("Finestra aperta, si spegne", "Window open, turns off"))}"><i></i></button></div></div>
<div class="au-leggi" data-au-leggi>${esc(t("Si legge così:", "It reads:"))} ${esc(siLeggeCosi(automazionePulita(b)))}</div>
${state.errore ? `<div class="au-errore" role="alert">${esc(state.errore)}</div>` : ""}
<button type="button" class="au-salva" data-au-salva>💾 ${esc(t("SALVA", "SAVE"))}</button>
${esistente ? `<button type="button" class="au-elimina" data-au-elimina>🗑 ${esc(t("Elimina questa automazione", "Delete this automation"))}</button>` : ""}`;
}

/* ── la pagina ───────────────────────────────────────────────────────────── */

function titoloDellaVista() {
  if (state.vista === "modelli") return t("Nuova automazione", "New automation");
  if (state.vista === "crono") return t("Cronotermostato", "Thermostat schedule");
  if (state.vista === "editor") {
    const esistente = leAutomazioni().some((a) => a.id === state.bozza?.id);
    return esistente
      ? state.bozza.nome || t("Automazione", "Automation")
      : t("Nuova automazione", "New automation");
  }
  return t("Automazioni", "Automations");
}

export function paginaHtml({ app = false } = {}) {
  if (!state.bozza && (state.vista === "editor" || state.vista === "crono")) state.vista = "lista";
  const premium = state.premium !== false;
  let dentro;
  if (!premium) dentro = velo(leAutomazioni().length ? lista({ app }) : modelli());
  else if (state.vista === "modelli")
    dentro = `${app ? "" : `<button type="button" class="au-indietro" data-au-vai="lista">‹ ${esc(t("Automazioni", "Automations"))}</button>`}${modelli()}`;
  else if (state.vista === "editor") dentro = editor({ app });
  else if (state.vista === "crono") dentro = crono({ app });
  else dentro = lista({ app });
  if (!app)
    return `<div class="au au-web">${state.vista === "lista" || !premium ? INTRO() : ""}${dentro}</div>`;
  const testa =
    state.vista === "lista" || !premium
      ? `<div class="au-titolo"><h1>${esc(t("Automazioni", "Automations"))}</h1><span class="au-prem">PREMIUM</span>${
          premium
            ? `<button type="button" class="au-piu" data-au-vai="modelli" aria-label="${esc(t("Nuova", "Add new"))}">＋</button>`
            : ""
        }</div>`
      : `<button type="button" class="au-indietro" data-au-vai="${state.vista === "modelli" || !state.daModelli ? "lista" : "modelli"}">‹ ${esc(
          state.vista === "modelli" || !state.daModelli
            ? t("Automazioni", "Automations")
            : t("Modelli", "Templates"),
        )}</button><div class="au-titolo"><h1>${esc(titoloDellaVista())}</h1></div>`;
  return `<div class="au au-app">${testa}${dentro}</div>`;
}

function contenitore() {
  if (state.inApp) return doc?.getElementById?.(ID_PAGINA) || null;
  if (schedaAttiva() === AUTOMAZIONI_TAB) return doc?.getElementById?.("ed-body") || null;
  return null;
}

export function ridisegna() {
  const dove = contenitore();
  if (!dove) return false;
  /* La ricerca delle entita' aperta sopra scrive in una casella di questa
   * pagina: ridisegnarla adesso le toglierebbe la casella da sotto. */
  if (doc.getElementById("cd-entpick") && dove.querySelector("[data-au-cerca-di]")) return true;
  const app = state.inApp;
  if (Date.now() - state.chiestoIl > VALE && !state.chiedendo) void chiediAllaCasa();
  const html = paginaHtml({ app });
  if (dove.dataset.auScritto !== html || !dove.querySelector(":scope > .au, .au")) {
    const attivo = doc.activeElement;
    const campo = attivo?.dataset?.auTesto;
    const cursore = campo ? attivo.selectionStart : null;
    if (app) dove.innerHTML = html;
    else {
      dove
        .querySelectorAll(":scope > .au, :scope > :not(.dm-alberatura-titolo)")
        .forEach((n) => n.remove());
      dove.insertAdjacentHTML("beforeend", html);
    }
    dove.dataset.auScritto = html;
    dove.dataset.renderer = AUTOMAZIONI_TAB;
    /* Chi stava scrivendo il nome resta li': il ridisegno non gli ruba la
     * casella sotto le dita. */
    if (campo) {
      const nuovo = dove.querySelector(`[data-au-testo="${CSS.escape(campo)}"]`);
      nuovo?.focus?.();
      if (cursore !== null) nuovo?.setSelectionRange?.(cursore, cursore);
    }
  }
  if (!app) {
    ensureTitoloDellaSezione();
    const nome = dove.querySelector(":scope > .dm-alberatura-titolo .dm-alberatura-titolo-nome");
    const voluto = titoloDellaVista();
    if (nome && nome.textContent !== voluto) nome.textContent = voluto;
    doc.documentElement.classList.add("au-su");
  }
  return true;
}

/* ── scrivere nella bozza ────────────────────────────────────────────────── */

function nuovaCondizione(tipo) {
  if (tipo === "notte") return { tipo, da: "", a: "" };
  if (tipo === "fascia") return { tipo, da: "08:00", a: "20:00" };
  if (tipo === "giorni") return { tipo, giorni: [true, true, true, true, true, false, false] };
  if (tipo === "casa") return { tipo, chi: "qualcuno" };
  if (tipo === "sole") return { tipo, posizione: "sotto" };
  if (tipo === "stato") return { tipo, entita: primaDi("stato"), vale: "acceso" };
  if (tipo === "uguale") return { tipo, entita: "", valore: "", non: false };
  if (tipo === "attributo")
    return { tipo, entita: "", attributo: "", confronto: "uguale", valore: "" };
  return { tipo: "valore", entita: primaDi("valore"), verso: "sopra", soglia: 25 };
}

const unaLista = (id) => (id ? [id] : []);

function nuovaAzione(tipo) {
  if (tipo === "aspetta") return { tipo, minuti: 2 };
  if (tipo === "notifica") return { tipo, testo: "" };
  if (tipo === "azione") return { tipo, nome: azioniDellaPlancia()[0] || "" };
  if (tipo === "spegni") return { tipo, entita: unaLista(primaDi("luce") || primaDi("spegni")) };
  if (tipo === "tapparella") return { tipo, entita: unaLista(primaDi("tapparella")), modo: "apri" };
  if (tipo === "clima")
    return { tipo, entita: unaLista(primaDi("clima")), modo: "temperatura", gradi: 21 };
  if (tipo === "imposta") return { tipo, entita: primaDi("imposta"), valore: "" };
  if (tipo === "media") return { tipo, entita: unaLista(primaDi("media")), comando: "play" };
  if (tipo === "aspettaChe") return { tipo, entita: "", stato: "off", massimo: 10 };
  if (tipo === "servizio") return { tipo, servizio: "", entita: [], dati: "" };
  return { tipo: "accendi", entita: unaLista(primaDi("luce") || primaDi("accendi")) };
}

function nuovoQuando(tipo) {
  const tutti = [true, true, true, true, true, true, true];
  if (tipo === "apertura")
    return { tipo, entita: [primaDi("apertura")].filter(Boolean), verso: "apre" };
  if (tipo === "movimento")
    return { tipo, entita: [primaDi("movimento")].filter(Boolean), verso: "si", minuti: 5 };
  if (tipo === "valore") return { tipo, entita: primaDi("valore"), verso: "sopra", soglia: 25 };
  if (tipo === "persone") return { tipo, verso: "arriva", chi: [] };
  if (tipo === "antifurto") return { tipo, entita: primaDi("antifurto"), verso: "inserito" };
  if (tipo === "elettrodomestico")
    return { tipo, entita: primaDi("potenza"), soglia: 5, minuti: 3 };
  if (tipo === "stato") return { tipo, entita: [], da: "", a: "", per: 0 };
  if (tipo === "attributo") return { tipo, entita: "", attributo: "", valore: "" };
  if (tipo === "evento") return { tipo, evento: "", filtro: {}, filtroRighe: [] };
  if (tipo === "ogni") return { tipo, minuti: 30 };
  return { tipo: "orario", ore: ["07:00"], sole: "", scarto: 0, giorni: tutti };
}

/* La bozza tiene due cose in un modo comodo da scrivere, e il salvato in un
 * altro: il filtro di un evento come righe «campo = valore», e le azioni
 * sulle cose con un'entita' sola come stringa (le automazioni di prima). */
function pulitaDallaBozza(b) {
  if (!b) return null;
  if (b.tipo === "crono") return automazionePulita(b);
  const quando = { ...(b.quando || {}) };
  if (Array.isArray(quando.filtroRighe))
    quando.filtro = Object.fromEntries(quando.filtroRighe.filter(([k]) => clean(k)));
  const pulita = automazionePulita({
    ...b,
    quando,
    scadenza: b.scadenza?.stato ? b.scadenza : null,
  });
  return pulita;
}

const NUMERI = /\.(soglia|minuti|livello|posizione|gradi|scarto|per|massimo|pausa)$/;

function metti(via, valore) {
  const b = structuredClone(state.bozza);
  const pezzi = via.split(".");
  const ultimo = pezzi.pop();
  /* Le opzioni dell'automazione, in cima alla bozza. */
  if (via === "tutte") {
    b.tutte = valore !== "no";
    state.bozza = b;
    return;
  }
  if (via === "scadenza.stato") {
    b.scadenza = valore ? { data: b.scadenza?.data || "", stato: valore } : null;
    state.bozza = b;
    return;
  }
  if (via === "scadenza.data") {
    b.scadenza = { stato: b.scadenza?.stato || "spenta", data: valore };
    state.bozza = b;
    return;
  }
  let dove = b;
  for (const p of pezzi) {
    dove = dove?.[Number.isInteger(+p) ? +p : p];
    if (dove === undefined) return;
  }
  if (!dove) return;
  /* Un elenco di entita' con la tendina «＋» in fondo. */
  if (ultimo === "+") {
    if (valore && Array.isArray(dove) && !dove.includes(valore)) dove.push(valore);
  } else if (ultimo === "tipo" && pezzi[0] === "soloSe") {
    b.soloSe[+pezzi[1]] = nuovaCondizione(valore);
  } else if (ultimo === "tipo" && pezzi[0] === "allora") {
    b.allora[+pezzi[1]] = nuovaAzione(valore);
  } else {
    const chiave = Number.isInteger(+ultimo) ? +ultimo : ultimo;
    let v = valore;
    if (NUMERI.test(`.${ultimo}`))
      v = valore === "" ? "" : Number(String(valore).replace(",", "."));
    if (ultimo === "non") v = valore === "si";
    if (Array.isArray(dove) && v === "") dove.splice(chiave, 1);
    else dove[chiave] = v;
    if (via === "quando.verso" && b.quando.tipo === "persone" && v === "tuttiFuori")
      b.quando.chi = [];
    /* Un'altra entita': l'attributo scelto era dell'altra. */
    if (/^(quando|soloSe\.\d+)\.entita$/.test(via) && dove.attributo !== undefined)
      dove.attributo = "";
  }
  state.bozza = b;
  state.errore = "";
}

function togliDa(via) {
  const b = structuredClone(state.bozza);
  const pezzi = via.split(".");
  const indice = +pezzi.pop();
  const elenco = pezzi.reduce((d, p) => d?.[Number.isInteger(+p) ? +p : p], b);
  if (!Array.isArray(elenco)) return;
  elenco.splice(indice, 1);
  state.bozza = b;
}

function aggiungiA(via) {
  const b = structuredClone(state.bozza);
  if (via === "soloSe" && b.soloSe.length < CONDIZIONI_AL_MASSIMO) {
    const gia = new Set(b.soloSe.map((c) => c.tipo));
    b.soloSe.push(
      nuovaCondizione(["notte", "casa", "giorni", "fascia"].find((x) => !gia.has(x)) || "notte"),
    );
  } else if (via === "allora" && b.allora.length < AZIONI_AL_MASSIMO) {
    b.allora.push(nuovaAzione(b.allora.length ? "aspetta" : "accendi"));
  } else if (via === "quando.ore" && b.quando.ore.length < ORARI_AL_MASSIMO) {
    b.quando.ore.push("21:30");
  } else if (via === "quando.filtroRighe" && (b.quando.filtroRighe || []).length < 6) {
    b.quando.filtroRighe = [...(b.quando.filtroRighe || []), ["", ""]];
  }
  state.bozza = b;
}

const SULLE_COSE = ["accendi", "spegni", "tapparella", "clima", "media"];

function apriBozza(bozza, { daModelli = false } = {}) {
  state.bozza = structuredClone(bozza);
  /* Una regola che arriva dal salvato ha gia' la forma pulita; i campi che le
   * mancano per l'editor — `ore`, `chi`, le righe del filtro — li rimette
   * qui, e le azioni sulle cose con un'entita' sola tornano un elenco. */
  if (state.bozza.tipo !== "crono") {
    const q = { ...nuovoQuando(state.bozza.quando?.tipo), ...(state.bozza.quando || {}) };
    if (q.tipo === "evento") q.filtroRighe = Object.entries(q.filtro || {});
    state.bozza.quando = q;
    state.bozza.soloSe ||= [];
    state.bozza.allora = (state.bozza.allora || []).map((a) =>
      SULLE_COSE.includes(a.tipo) && !Array.isArray(a.entita)
        ? { ...a, entita: unaLista(a.entita) }
        : a.tipo === "servizio" && a.dati && typeof a.dati === "object"
          ? { ...a, dati: Object.keys(a.dati).length ? JSON.stringify(a.dati) : "" }
          : a,
    );
  } else state.bozza.crono = cronoPulito(state.bozza.crono);
  state.vista = state.bozza.tipo === "crono" ? "crono" : "editor";
  state.daModelli = daModelli;
  state.tendina = false;
  state.tendinaAltro = false;
  state.avanzate = Boolean(
    state.bozza.scadenza ||
    state.bozza.pausa ||
    (state.bozza.modo && state.bozza.modo !== "ricomincia"),
  );
  state.errore = "";
}

function salva() {
  const pulita = pulitaDallaBozza(state.bozza);
  /* Un servizio scritto che la casa non chiamera' si dice, invece di
   * sparire in silenzio al salvataggio. */
  const servizioChiuso = (state.bozza?.allora || []).some(
    (a) => a.tipo === "servizio" && clean(a.servizio) && !servizioPermesso(a.servizio),
  );
  if (!pulita || !eCompleta(pulita) || servizioChiuso) {
    state.errore = servizioChiuso
      ? t(
          "Questo servizio la casa non lo chiama da sola.",
          "The home does not call this service by itself.",
        )
      : pulita?.tipo === "crono"
        ? t("Scegli almeno un termostato.", "Choose at least one thermostat.")
        : t(
            "Manca qualcosa: scegli cosa la fa partire e almeno un'azione.",
            "Something is missing: choose what starts it and at least one action.",
          );
    ridisegna();
    return false;
  }
  if (!pulita.nome)
    pulita.nome =
      pulita.tipo === "crono"
        ? t("Cronotermostato", "Thermostat schedule")
        : fraseDelQuando(pulita.quando).slice(0, 60);
  const elenco = leAutomazioni();
  const i = elenco.findIndex((a) => a.id === pulita.id);
  if (i >= 0) elenco[i] = pulita;
  else elenco.push(pulita);
  salvaLElenco(elenco);
  root.edToast?.(t("💾 Automazione salvata", "💾 Automation saved"));
  state.bozza = null;
  state.vista = "lista";
  state.daModelli = false;
  void chiediAllaCasa({ forza: true });
  ridisegna();
  return true;
}

function elimina() {
  const id = state.bozza?.id;
  if (!id) return;
  const conferma = root.confirm?.(t("Eliminare questa automazione?", "Delete this automation?"));
  if (conferma === false) return;
  salvaLElenco(leAutomazioni().filter((a) => a.id !== id));
  state.bozza = null;
  state.vista = "lista";
  ridisegna();
}

function alternaAttiva(id) {
  const elenco = leAutomazioni().map((a) => (a.id === id ? { ...a, attiva: !a.attiva } : a));
  salvaLElenco(elenco);
  ridisegna();
}

/* ── i tocchi ────────────────────────────────────────────────────────────── */

function dentroDiNoi(event) {
  const dove = contenitore();
  return dove && dove.contains(event.target) && event.target.closest?.(".au") ? dove : null;
}

function onClick(event) {
  const dove = dentroDiNoi(event);
  if (!dove) {
    if (state.tendina) {
      state.tendina = false;
      ridisegna();
    }
    return;
  }
  const el = event.target.closest(
    "[data-au-vai],[data-au-modello],[data-au-attiva],[data-au-apri],[data-au-tendina],[data-au-quando],[data-au-togli],[data-au-aggiungi],[data-au-giorno],[data-au-salva],[data-au-elimina],[data-au-gradi],[data-au-finestra],[data-au-scopri],[data-au-tendina-altro],[data-au-avanzate]",
  );
  if (!el) {
    if (state.tendina) {
      state.tendina = false;
      ridisegna();
    }
    return;
  }
  const d = el.dataset;
  if (d.auScopri !== undefined) {
    event.preventDefault();
    /* Nell'app la pagina Premium la apre l'app; sul web si dice di piu'. */
    if (nellApp()) diciAllApp("premium");
    else {
      state.scopri = !state.scopri;
      ridisegna();
    }
    return;
  }
  if (state.premium === false) return;
  event.preventDefault();
  if (d.auAttiva) {
    event.stopPropagation();
    alternaAttiva(d.auAttiva);
    return;
  }
  if (d.auVai) {
    state.vista = d.auVai;
    if (d.auVai === "lista") state.bozza = null;
    state.tendina = false;
  } else if (d.auModello) apriBozza(bozzaDelModello(d.auModello), { daModelli: true });
  else if (d.auApri) {
    const a = leAutomazioni().find((x) => x.id === d.auApri);
    if (a) apriBozza(a);
  } else if (d.auTendinaAltro !== undefined) state.tendinaAltro = !state.tendinaAltro;
  else if (d.auAvanzate !== undefined) state.avanzate = !state.avanzate;
  else if (d.auTendina !== undefined) state.tendina = !state.tendina;
  else if (d.auQuando) {
    if (d.auQuando !== state.bozza.quando.tipo)
      state.bozza = { ...state.bozza, quando: nuovoQuando(d.auQuando) };
    state.tendina = false;
  } else if (d.auTogli) togliDa(d.auTogli);
  else if (d.auAggiungi) aggiungiA(d.auAggiungi);
  else if (d.auGiorno) {
    const pezzi = d.auGiorno.split(".");
    const i = +pezzi.pop();
    const giorni = pezzi.reduce((x, p) => x?.[Number.isInteger(+p) ? +p : p], state.bozza);
    if (Array.isArray(giorni)) {
      giorni[i] = !giorni[i];
      /* Almeno un giorno: un orario senza giorni non scatta mai. */
      if (!giorni.some(Boolean)) giorni[i] = true;
    }
  } else if (d.auGradi) {
    const c = state.bozza.crono;
    c[d.auGradi] = Math.max(
      5,
      Math.min(30, Math.round((Number(c[d.auGradi]) + Number(d.auPasso)) * 2) / 2),
    );
  } else if (d.auFinestra !== undefined)
    state.bozza.crono.finestraSpegne = !state.bozza.crono.finestraSpegne;
  else if (d.auSalva !== undefined) {
    salva();
    return;
  } else if (d.auElimina !== undefined) {
    elimina();
    return;
  }
  ridisegna();
  if (state.inApp) doc.getElementById(ID_PAGINA)?.scrollIntoView?.({ block: "start" });
}

function onChange(event) {
  if (!dentroDiNoi(event)) return;
  const via = event.target?.dataset?.auCampo;
  if (!via || !state.bozza) return;
  /* «🔍 Tutte le entità…»: la tendina torna com'era, e si apre la ricerca
   * del config sulla casella nascosta accanto; la scelta torna qui come un
   * «change» di quella casella. */
  if (event.target.value === "__cerca__") {
    const prima = event.target.querySelector("option[selected]")?.value ?? "";
    event.target.value = prima;
    const casella = event.target.parentElement?.querySelector(
      `[data-au-cerca-di="${CSS.escape(via)}"]`,
    );
    if (casella && typeof root.wzPickEntity === "function") root.wzPickEntity(casella);
    return;
  }
  metti(via, event.target.value);
  ridisegna();
}

function onInput(event) {
  if (!dentroDiNoi(event)) return;
  const via = event.target?.dataset?.auTesto;
  if (!via || !state.bozza) return;
  const pezzi = via.split(".");
  const ultimo = pezzi.pop();
  const dove = pezzi.reduce((x, p) => x?.[Number.isInteger(+p) ? +p : p], state.bozza);
  if (!dove) return;
  dove[ultimo] = event.target.value;
  /* Solo la frase sotto: i campi restano dove sono. */
  const leggi = contenitore()?.querySelector?.("[data-au-leggi]");
  const pulita = pulitaDallaBozza(state.bozza);
  if (leggi)
    leggi.innerHTML = `${esc(t("Si legge così:", "It reads:"))} ${
      pulita?.tipo === "crono" ? esc(siLeggeCosi(pulita)) : siLeggeCosi(pulita)
    }`;
}

function onKey(event) {
  if (event.key !== "Enter" && event.key !== " ") return;
  const riga = event.target?.closest?.("[data-au-apri]");
  if (!riga || event.target !== riga || !dentroDiNoi(event)) return;
  event.preventDefault();
  riga.click();
}

/* Le barre del cronotermostato: si trascina il dito, e le mezz'ore che passa
 * diventano «caldo» o «fresco» — il verso lo decide la prima toccata. */
function mezzoraSotto(event) {
  const barraEl = event.target?.closest?.("[data-au-barra]");
  if (!barraEl) return null;
  const r = barraEl.getBoundingClientRect();
  const x = (event.clientX ?? 0) - r.left;
  return {
    via: barraEl.dataset.auBarra,
    i: Math.max(0, Math.min(47, Math.floor((x / r.width) * 48))),
    barraEl,
  };
}

function dipingi(via, i, si, barraEl) {
  const c = state.bozza?.crono;
  if (!c) return;
  const mezzore = mezzoreDelleFasce(c[via]);
  if (mezzore[i] === si) return;
  mezzore[i] = si;
  c[via] = fasceDalleMezzore(mezzore);
  barraEl.children[i]?.classList?.toggle("si", si);
}

function onPointerDown(event) {
  if (!dentroDiNoi(event) || !state.bozza?.crono) return;
  const sotto = mezzoraSotto(event);
  if (!sotto) return;
  event.preventDefault();
  const si = !mezzoreDelleFasce(state.bozza.crono[sotto.via])[sotto.i];
  state.trascina = { via: sotto.via, si, barraEl: sotto.barraEl };
  try {
    sotto.barraEl.setPointerCapture?.(event.pointerId);
  } catch (_errore) {}
  dipingi(sotto.via, sotto.i, si, sotto.barraEl);
}

function onPointerMove(event) {
  const tr = state.trascina;
  if (!tr) return;
  const r = tr.barraEl.getBoundingClientRect();
  const i = Math.max(0, Math.min(47, Math.floor((((event.clientX ?? 0) - r.left) / r.width) * 48)));
  dipingi(tr.via, i, tr.si, tr.barraEl);
}

function onPointerUp() {
  if (!state.trascina) return;
  state.trascina = null;
  ridisegna();
}

/* ── la voce del config (web) ────────────────────────────────────────────── */

const LUCCHETTO = `<span class="au-lucchetto" aria-hidden="true"><svg viewBox="0 0 16 16" width="11" height="11"><rect x="3" y="7" width="10" height="7.5" rx="1.8" fill="#fff"/><path d="M5.2 7V5.2a2.8 2.8 0 0 1 5.6 0V7" stroke="#fff" stroke-width="1.8" fill="none"/></svg></span>`;

export function ensureLaVoce() {
  const linguette = doc?.querySelector?.("#editor-modal .ed-tab")?.parentElement;
  if (!linguette) return false;
  let voce = linguette.querySelector(`.ed-tab[data-tab="${AUTOMAZIONI_TAB}"]`);
  /* Nell'app la voce del config non c'e': le automazioni sono una voce del
   * menu dell'app, che apre la loro pagina a schermo pieno. */
  if (nellApp()) {
    voce?.remove();
    return false;
  }
  if (!voce) {
    voce = doc.createElement("button");
    voce.type = "button";
    voce.className = "ed-tab";
    voce.dataset.tab = AUTOMAZIONI_TAB;
    const nome = t("Automazioni", "Automations");
    voce.title = nome;
    voce.setAttribute("aria-label", nome);
    voce.innerHTML = `<span class="dm-beta4-tab-icon" aria-hidden="true" data-dm-oggetto="automazioni">${oggettoWidget(
      "automazioni",
      "",
      `config-${AUTOMAZIONI_TAB}`,
    )}</span><span data-dm-config-name="true" class="dm-beta4-tab-label">${esc(nome)}</span><span class="au-tab-prem">PREMIUM</span>`;
    voce.addEventListener("click", () => root.editorSwitch?.(AUTOMAZIONI_TAB));
    const azioni = linguette.querySelector('.ed-tab[data-tab="sez8"]');
    if (azioni) azioni.after(voce);
    else
      linguette.querySelector('.ed-tab[data-tab="runtime"]')?.before(voce) ??
        linguette.append(voce);
    riordinaLeLinguette();
  }
  const chiusa = state.premium === false;
  voce.classList.toggle("au-chiusa", chiusa);
  const icona = voce.querySelector(".dm-beta4-tab-icon");
  const lucchetto = icona?.querySelector(".au-lucchetto");
  if (chiusa && icona && !lucchetto) icona.insertAdjacentHTML("beforeend", LUCCHETTO);
  if (!chiusa && lucchetto) lucchetto.remove();
  if (!voce.querySelector(".au-tab-prem"))
    voce.insertAdjacentHTML("beforeend", '<span class="au-tab-prem">PREMIUM</span>');
  return true;
}

export function ensureLaScheda() {
  if (state.inApp) return ridisegna();
  if (schedaAttiva() !== AUTOMAZIONI_TAB) {
    doc?.documentElement?.classList?.remove("au-su");
    /* Usciti dalla scheda si riparte dalla lista: una bozza lasciata a meta'
     * si butta come si butta chiudendo una finestra. */
    if (!doc?.getElementById?.("editor-modal")) {
      state.vista = "lista";
      state.bozza = null;
    }
    return false;
  }
  if (state.premium === null && !state.chiedendo) void chiediAllaCasa({ forza: true });
  return ridisegna();
}

/* ── la pagina a schermo pieno (app) ─────────────────────────────────────── */

function diciAllApp(quale) {
  try {
    if (root.gdahomeDice?.postMessage) root.gdahomeDice.postMessage(quale);
  } catch (_errore) {}
  try {
    if (root.parent && root.parent !== root)
      root.parent.postMessage({ gdahome: "pagina", dove: quale }, "*");
  } catch (_errore) {}
}

const linguetta = (quale) =>
  [...(doc?.querySelectorAll?.(".tab") || [])].find((v) => v.getAttribute("data-tab") === quale);

/** Apre la pagina Automazioni a schermo pieno: e' la maniglia dell'app. */
export function apriLeAutomazioni() {
  if (!doc?.body) return false;
  /* Una Config aperta sopra si chiude: si e' chiesto un'altra cosa. */
  doc.getElementById("editor-modal")?.querySelector?.(".ed-head-close")?.click?.();
  const attiva = doc.querySelector(".tab.active")?.getAttribute("data-tab") || "";
  if (!state.inApp) state.doveEra = attiva && attiva !== "config" ? attiva : "home";
  doc.querySelectorAll(".page.active").forEach((p) => p.classList.remove("active"));
  doc.querySelectorAll(".tab.active").forEach((p) => p.classList.remove("active"));
  doc.body.classList.remove("gdahome-in-config");
  let pagina = doc.getElementById(ID_PAGINA);
  if (!pagina) {
    pagina = doc.createElement("section");
    pagina.id = ID_PAGINA;
    pagina.className = "page";
    const config = doc.getElementById("page-config");
    const casa = doc.getElementById("page-home");
    if (config) config.before(pagina);
    else if (casa?.parentElement) casa.parentElement.append(pagina);
    else doc.body.append(pagina);
  }
  pagina.classList.add("active");
  state.inApp = true;
  state.vista = "lista";
  state.bozza = null;
  ridisegna();
  void chiediAllaCasa({ forza: true });
  root.scrollTo?.(0, 0);
  diciAllApp("automazioni");
  return true;
}

function chiudiLaPagina() {
  state.inApp = false;
  state.bozza = null;
  state.vista = "lista";
  doc?.getElementById?.(ID_PAGINA)?.remove();
}

/** Torna alla plancia, dov'era: la maniglia dell'altro verso. */
export function tornaDalleAutomazioni() {
  if (!state.inApp) return false;
  chiudiLaPagina();
  const dove = linguetta(state.doveEra || "home") || linguetta("home");
  try {
    dove?.click?.();
  } catch (_errore) {}
  if (!doc.querySelector(".page.active")) doc.getElementById("page-home")?.classList?.add("active");
  diciAllApp(doc.querySelector(".tab.active")?.getAttribute("data-tab") || "home");
  return true;
}

function prendiLeManiglie() {
  root.gdahomeApriLeAutomazioni = apriLeAutomazioni;
  root.gdahomeTornaDalleAutomazioni = tornaDalleAutomazioni;
  /* Nel browser l'app sta fuori dal riquadro e bussa con un messaggio: si
   * accetta solo da chi ospita la pagina. */
  root.addEventListener?.("message", (evento) => {
    const detto = evento?.data;
    if (!detto || typeof detto !== "object" || evento.source !== root.parent) return;
    if (detto.gdahome === "apri-le-automazioni") apriLeAutomazioni();
    else if (detto.gdahome === "torna-dalle-automazioni") tornaDalleAutomazioni();
  });
  /* Una linguetta della barra della plancia toccata con la pagina aperta:
   * si va li', e la pagina delle automazioni si chiude. */
  doc.addEventListener(
    "click",
    (evento) => {
      if (!state.inApp) return;
      const voce = evento.target?.closest?.(".tab");
      if (voce && !voce.closest(`#${ID_PAGINA}`)) chiudiLaPagina();
    },
    true,
  );
}

/* ── lo stile ────────────────────────────────────────────────────────────── */

function stili() {
  installStyle(
    "dm-automazioni-style",
    `
html.au-su #ed-body>[data-dm-save-footer]{display:none!important}
.ed-tab[data-tab="automazioni"]{position:relative}
.ed-tab[data-tab="automazioni"] .au-tab-prem{position:absolute;top:2px;right:6px;font-size:7.5px;font-weight:900;letter-spacing:.08em;padding:1px 5px;border-radius:5px;color:#b45309;border:1px solid #f59e0b88;background:color-mix(in srgb,#f59e0b 14%,var(--card-bg,#fff));line-height:1.3;pointer-events:none}
html[data-theme="dark"] .ed-tab[data-tab="automazioni"] .au-tab-prem{color:#fbbf24}
.ed-tab[data-tab="automazioni"].au-chiusa .dm-beta4-tab-icon svg.dm-oggetto,.ed-tab[data-tab="automazioni"].au-chiusa .dm-beta4-tab-label{opacity:.5}
.ed-tab[data-tab="automazioni"] .dm-beta4-tab-icon{position:relative;overflow:visible}
.ed-tab[data-tab="automazioni"] .au-lucchetto{position:absolute;right:-6px;bottom:-5px;width:17px;height:17px;border-radius:50%;background:#d97706;display:grid;place-items:center;box-shadow:0 0 0 2px var(--card-bg,#fff)}
@media (max-width:700px){.ed-tab[data-tab="automazioni"] .au-tab-prem{display:none}}
.au{--au-bordo:var(--divider-color,#e2e8f0);--au-carta:var(--card-bg,#fff);--au-tx:var(--text,#0f172a);--au-dim:var(--text-dim,#64748b);--au-tenue:color-mix(in srgb,var(--text,#0f172a) 5%,transparent);color:var(--au-tx);display:block}
.au *{box-sizing:border-box}
.au button{font:inherit;cursor:pointer}
.au .au-prem{display:inline-block;font-size:9.5px;font-weight:900;letter-spacing:.08em;padding:2px 7px;border-radius:6px;color:#b45309;border:1px solid #f59e0b88;background:#f59e0b18;vertical-align:middle}
html[data-theme="dark"] .au .au-prem{color:#fbbf24}
.au .au-intro{font-size:13px;line-height:1.5;color:var(--au-dim);margin:0 0 14px}
.au .au-nota{padding:10px 12px;margin:0 0 12px;border-radius:12px;font-size:12.5px;line-height:1.5;font-weight:700;color:var(--au-dim);background:color-mix(in srgb,#0ea5e9 9%,transparent)}
.au .au-due{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:6px}
.au .au-box{border:1px solid var(--au-bordo);border-radius:16px;padding:12px 14px;background:var(--au-carta);min-width:0}
.au .au-box.blu{border-color:color-mix(in srgb,#0ea5e9 35%,var(--au-bordo));background:color-mix(in srgb,#0ea5e9 6%,var(--au-carta))}
.au .au-et{font-size:10.5px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--au-dim);margin-bottom:6px}
.au .au-pross{display:flex;align-items:center;gap:12px}
.au .au-pross b{font-family:Oswald,sans-serif;font-weight:500;font-size:30px;line-height:1}
.au .au-pross span{font-weight:800;font-size:13.5px;line-height:1.3;min-width:0}
.au .au-pross small{display:block;font-weight:600;font-size:11.5px;color:var(--au-dim);margin-top:2px}
.au .au-vuoto{font-size:12.5px;font-weight:600;color:var(--au-dim)}
.au .au-ult{display:grid;gap:5px}
.au .au-ult div{display:flex;gap:10px;font-size:12.5px;font-weight:700;align-items:baseline}
.au .au-ult span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.au .au-ult em{font-style:normal;min-width:44px;font-variant-numeric:tabular-nums;color:var(--au-dim);font-weight:800;font-size:11.5px}
.au .au-ult i{font-style:normal;color:#16a34a;font-weight:900}
.au .au-ult i.no{color:#dc2626}
.au .au-testa{display:flex;align-items:center;gap:10px;margin:18px 2px 8px}
.au .au-testa h3{margin:0;font-size:15px;font-weight:900;text-transform:none;letter-spacing:0;font-family:inherit}
.au .au-piu{margin-left:auto;display:inline-flex;align-items:center;gap:6px;border:0;border-radius:12px;padding:9px 14px;background:var(--au-tx);color:var(--au-carta);font-weight:900;font-size:13px}
.au .au-lista{border:1px solid var(--au-bordo);border-radius:16px;background:var(--au-carta);overflow:hidden}
.au .au-lista-vuota{padding:22px;text-align:center;display:grid;gap:12px;justify-items:center}
.au .au-lista-vuota p{margin:0;font-weight:700;color:var(--au-dim)}
.au .au-lista-vuota .au-piu{margin:0}
.au .au-riga{display:flex;align-items:center;gap:13px;padding:12px 14px;border-top:1px solid var(--au-bordo);cursor:pointer}
.au .au-riga:first-child{border-top:0}
.au .au-riga:hover{background:var(--au-tenue)}
.au .au-ico{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;flex:none;background:var(--au-tenue)}
.au .au-ico svg{width:30px;height:30px}
.au .au-ico-p{width:36px;height:36px}
.au .au-frase{flex:1;min-width:0}
.au .au-quando{font-size:14px;font-weight:900;line-height:1.3}
.au .au-sopra{font-size:12px;font-weight:700;color:var(--au-dim);margin-top:1px}
.au .au-allora{font-size:13px;font-weight:700;line-height:1.35;margin-top:2px}
.au .au-allora .fr{color:#0ea5e9;font-weight:900;margin-right:5px;font-size:16px;line-height:1}
.au .au-se{display:inline-block;font-size:11px;font-weight:800;padding:1px 7px;border-radius:999px;background:var(--au-tenue);color:var(--au-dim);margin-left:6px;vertical-align:1px}
.au .au-ultima{font-size:11.5px;font-weight:600;color:var(--au-dim);margin-top:4px}
.au .au-male{color:#dc2626}
.au .au-riga.spenta .au-quando,.au .au-riga.spenta .au-allora{color:var(--au-dim)}
.au .au-riga.spenta .au-ico{opacity:.5}
.au .au-int{flex:none;position:relative;width:44px;height:26px;border-radius:999px;border:0;padding:0;background:color-mix(in srgb,var(--au-tx) 18%,transparent)}
.au .au-int[aria-checked="true"]{background:#0ea5e9}
.au .au-int i{position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:left .15s ease}
.au .au-int[aria-checked="true"] i{left:21px}
.au .au-int-dx{margin-left:auto}
.au .au-fr{color:var(--au-dim);font-size:16px;margin-left:2px}
.au .au-velato{position:relative;min-height:520px}
.au .au-sotto{filter:blur(3px);opacity:.55;pointer-events:none;user-select:none}
.au .au-velo{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:90px 20px 0;text-align:center;background:linear-gradient(180deg,color-mix(in srgb,var(--au-carta) 55%,transparent),var(--au-carta) 75%)}
.au .au-velo .st{font-size:34px}
.au .au-velo h3{font-family:Oswald,sans-serif;font-weight:500;font-size:28px;margin:8px 0;text-transform:none;letter-spacing:.01em;color:var(--au-tx)}
.au .au-velo p{margin:0 0 18px;max-width:460px;font-size:14px;line-height:1.55;font-weight:600;color:var(--au-dim)}
.au .au-velo button{border:0;border-radius:14px;padding:13px 26px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;font-weight:900;font-size:15px;box-shadow:0 8px 22px -8px #d97706aa}
.au .au-velo small{margin-top:12px;font-size:12px;color:var(--au-dim);font-weight:600;max-width:420px}
.au .au-indietro{display:inline-flex;border:0;background:none;color:#0284c7;font-weight:800;font-size:13px;padding:0;margin:0 0 8px}
html[data-theme="dark"] .au .au-indietro{color:#7dd3fc}
.au .au-modelli{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.au .au-mod{border:1px solid var(--au-bordo);border-radius:18px;background:var(--au-carta);color:var(--au-tx);padding:16px 14px 14px;display:flex;flex-direction:column;align-items:flex-start;text-align:left;gap:8px;min-height:150px;box-shadow:0 6px 18px -14px rgba(15,23,42,.4)}
.au .au-mod:hover{border-color:color-mix(in srgb,#0ea5e9 45%,var(--au-bordo))}
.au .au-mod .au-ico{width:52px;height:52px;border-radius:15px}
.au .au-mod .au-ico svg{width:38px;height:38px}
.au .au-mod b{font-size:14.5px;font-weight:900;line-height:1.25}
.au .au-mod small{font-size:12px;font-weight:600;line-height:1.4;color:var(--au-dim)}
.au .au-mod.zero{border-style:dashed;background:none;box-shadow:none}
.au .au-mod.zero .au-ico{font-size:28px;font-weight:300;color:var(--au-dim)}
.au .au-blocco{border:1px solid var(--au-bordo);border-radius:16px;background:var(--au-carta);padding:12px 14px 14px 18px;margin-bottom:10px;position:relative}
.au .au-blocco::before{content:"";position:absolute;left:0;top:14px;bottom:14px;width:4px;border-radius:0 4px 4px 0;background:var(--c)}
.au .au-blocco .au-et{display:flex;align-items:center;gap:8px;color:var(--c);margin-bottom:8px}
.au .au-blocco .au-et small{font-weight:700;letter-spacing:0;text-transform:none;color:var(--au-dim);font-size:11.5px}
.au .au-q{--c:#0ea5e9}.au .au-s{--c:#8b5cf6}.au .au-a{--c:#16a34a}
.au .au-rf{display:flex;flex-wrap:wrap;align-items:center;gap:7px;font-size:14px;font-weight:700;line-height:1.2;padding:4px 0}
.au .au-rf+.au-rf{border-top:1px dashed var(--au-bordo);padding-top:9px;margin-top:5px}
.au .au-num{width:22px;height:22px;border-radius:7px;display:grid;place-items:center;font-size:11px;font-weight:900;background:var(--au-tenue);color:var(--au-dim)}
.au .au-o{font-size:13px;font-weight:700;color:var(--au-dim)}
.au .au-coppia{display:inline-flex;align-items:center;gap:4px}
.au .au-sel{appearance:none;-webkit-appearance:none;display:inline-flex;align-items:center;gap:6px;max-width:100%;padding:7px 26px 7px 11px;border-radius:11px;border:1px solid color-mix(in srgb,var(--c,#0ea5e9) 40%,var(--au-bordo));background:color-mix(in srgb,var(--c,#0ea5e9) 9%,var(--au-carta)) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath d='M0 0h10L5 6z' fill='%2394a3b8'/%3E%3C/svg%3E") no-repeat right 9px center/8px 5px;font-weight:800;font-size:13.5px;color:var(--au-tx);white-space:nowrap;text-overflow:ellipsis;min-height:34px}
.au input.au-sel{padding-right:11px;background-image:none;font-family:inherit}
.au .au-sel-quando{background-color:color-mix(in srgb,#0ea5e9 9%,var(--au-carta))}
.au .au-sel-piu{width:58px;color:var(--au-dim)}
.au .au-testo-in{min-width:200px;flex:1;white-space:normal}
.au .au-x{margin-left:auto;border:0;background:none;color:var(--au-dim);font-size:13px;font-weight:900;opacity:.7;padding:6px}
.au .au-rf:has(>.au-x){position:relative;padding-right:30px}
.au .au-rf>.au-x{position:absolute;right:-4px;top:50%;transform:translateY(-50%)}
.au select.au-sel{field-sizing:content}
#editor-modal .au select.au-sel,.au select.au-sel{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath d='M0 0h10L5 6z' fill='%2394a3b8'/%3E%3C/svg%3E")!important;background-repeat:no-repeat!important;background-position:right 9px center!important;background-size:8px 5px!important}
.au input.au-ora-in{width:118px}
.au .au-coppia .au-x{margin-left:0}
.au .au-agg{display:inline-block;margin-top:8px;border:0;background:none;padding:0;color:var(--c);font-weight:900;font-size:13px}
.au .au-agg-pic{border:1px dashed var(--au-bordo);background:none;border-radius:10px;padding:6px 10px;color:var(--au-dim);font-weight:800;font-size:12.5px}
.au .au-gg{display:inline-flex;gap:5px;flex-wrap:wrap}
.au .au-gg button{width:34px;height:32px;border-radius:10px;border:1px solid var(--au-bordo);background:none;font-weight:900;font-size:12.5px;color:var(--au-dim)}
.au .au-gg button.si{background:var(--au-tx);border-color:var(--au-tx);color:var(--au-carta)}
.au .au-nota-in{font-size:11.5px;font-weight:600;color:var(--au-dim)}
.au .au-leggi{border-radius:14px;padding:12px 14px;margin:4px 0 12px;background:var(--au-tenue);font-size:13.5px;line-height:1.5;font-weight:600}
.au .au-leggi b{font-weight:900}
.au .au-errore{padding:10px 14px;margin:0 0 10px;border-radius:12px;font-size:12.5px;font-weight:800;color:#991b1b;background:#fee2e2;border:1px solid #f8717188}
html[data-theme="dark"] .au .au-errore{color:#fecaca;background:#7f1d1d55}
.au .au-nome{display:flex;align-items:center;gap:10px;margin:0 0 12px;font-size:13px;font-weight:800;color:var(--au-dim)}
.au .au-nome input{flex:1;min-width:0;padding:9px 12px;border-radius:11px;border:1px solid var(--au-bordo);background:var(--au-carta);color:var(--au-tx);font:inherit;font-weight:800;font-size:13.5px}
.au .au-salva{width:100%;border:0;border-radius:14px;padding:14px;font-weight:900;font-size:14px;letter-spacing:.04em;color:#fff;background:linear-gradient(135deg,#10b981,#059669);box-shadow:0 10px 24px -14px #059669}
.au .au-elimina{display:block;margin:12px auto 0;border:0;background:none;color:#dc2626;font-weight:800;font-size:13px}
.au .au-tendina-qui{position:relative;display:inline-flex}
.au .au-tendina{position:absolute;z-index:20;top:calc(100% + 6px);left:0;width:min(420px,calc(100vw - 48px));border-radius:16px;border:1px solid var(--au-bordo);background:var(--au-carta);box-shadow:0 22px 50px -18px rgba(15,23,42,.45);padding:6px;display:grid}
.au .au-tendina button{display:flex;align-items:center;gap:10px;padding:9px 10px;border:0;border-radius:10px;background:none;color:var(--au-tx);font-size:13.5px;font-weight:800;text-align:left;white-space:nowrap}
.au .au-tendina button small{margin-left:auto;font-weight:600;font-size:11px;color:var(--au-dim)}
.au .au-tendina button.si,.au .au-tendina button:hover{background:color-mix(in srgb,#0ea5e9 12%,transparent)}
.au .au-tendina .au-altro{border-top:1px dashed var(--au-bordo);border-radius:0 0 10px 10px;margin-top:4px;color:var(--au-dim);font-weight:900}
.au .au-avanzate{display:grid;grid-template-columns:1fr auto;align-items:center;width:100%;margin:0 0 10px;padding:12px 14px;border-radius:14px;border:1px solid var(--au-bordo);background:var(--au-carta);color:var(--au-tx);text-align:left}
.au .au-avanzate>span:first-child{font-weight:900;font-size:13.5px}
.au .au-avanzate small{grid-column:1;font-size:11.5px;font-weight:600;color:var(--au-dim)}
.au .au-avanzate .au-fr{grid-row:1/span 2;grid-column:2}
.au .au-v{--c:#64748b}
.au .au-dati-in{width:100%;min-height:54px;white-space:pre-wrap;font-family:ui-monospace,Menlo,monospace;font-size:12.5px;padding-right:11px;background-image:none;resize:vertical}
.au .au-rf-dati{padding-right:0}
.au input.au-data-in{padding-right:11px;background-image:none;font-family:inherit}
.au .au-cerca-in{display:none}
.au .au-temp{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.au .au-temp>div{border-radius:14px;padding:12px 14px;display:flex;align-items:center;gap:10px}
.au .au-temp small{display:block;font-size:10.5px;font-weight:900;letter-spacing:.08em}
.au .au-temp b{display:block;font-family:Oswald,sans-serif;font-weight:500;font-size:34px;line-height:1.05}
.au .au-temp .c{background:color-mix(in srgb,#f97316 12%,transparent);color:#c2410c;border:1px solid color-mix(in srgb,#f97316 30%,transparent)}
.au .au-temp .e{background:color-mix(in srgb,#3b82f6 12%,transparent);color:#1d4ed8;border:1px solid color-mix(in srgb,#3b82f6 30%,transparent)}
html[data-theme="dark"] .au .au-temp .c{color:#fdba74}html[data-theme="dark"] .au .au-temp .e{color:#93c5fd}
.au .au-temp .pm{margin-left:auto;display:flex;gap:6px}
.au .au-temp .pm button{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;font-weight:900;border:1px solid currentColor;background:none;color:inherit;opacity:.8}
.au .au-giorno{margin:0 0 10px}
.au .au-giorno>small{display:block;font-size:12px;font-weight:800;margin-bottom:6px}
.au .au-barra{position:relative;height:36px;border-radius:10px;background:color-mix(in srgb,#3b82f6 16%,transparent);display:grid;grid-template-columns:repeat(48,1fr);overflow:hidden;touch-action:none;cursor:crosshair}
.au .au-barra i{display:block;height:100%}
.au .au-barra i.si{background:#fb923c}
.au .au-barra i.si+i.si{box-shadow:none}
.au .au-tac{display:flex;justify-content:space-between;font-size:10.5px;font-weight:800;color:var(--au-dim);margin-top:4px}
#${ID_PAGINA}{padding:0}
.au-app{padding:8px 14px 130px}
.au-app .au-titolo{display:flex;align-items:center;gap:10px;margin:6px 2px 12px}
.au-app .au-titolo h1{margin:0;font-family:Oswald,sans-serif;font-weight:500;font-size:30px;line-height:1.1;letter-spacing:.01em;text-transform:uppercase;color:var(--au-tx)}
.au-app .au-titolo .au-piu{margin-left:auto;width:44px;height:44px;padding:0;justify-content:center;font-size:22px;border-radius:14px}
.au-app .au-modelli{grid-template-columns:1fr 1fr;gap:10px}
.au-app .au-mod{min-height:132px;padding:14px 12px 12px}
.au-app .au-mod b{font-size:14px}
.au-app .au-rf{font-size:13.5px}
.au-app .au-sel{font-size:13px}
@media (max-width:760px){.au .au-due{grid-template-columns:1fr}.au-web .au-modelli{grid-template-columns:1fr 1fr}}
@media (max-width:420px){.au .au-temp>div{flex-wrap:wrap}.au .au-temp b{font-size:28px}}
`,
  );
}

/* ── installare ──────────────────────────────────────────────────────────── */

export function installAutomazioniSection() {
  if (!doc || state.installed) return false;
  state.installed = true;
  stili();
  doc.addEventListener("click", onClick);
  doc.addEventListener("change", onChange);
  doc.addEventListener("input", onInput);
  doc.addEventListener("keydown", onKey);
  doc.addEventListener("pointerdown", onPointerDown);
  doc.addEventListener("pointermove", onPointerMove);
  doc.addEventListener("pointerup", onPointerUp);
  doc.addEventListener("pointercancel", onPointerUp);
  prendiLeManiglie();
  const ancora = () =>
    root.queueMicrotask?.(() => {
      ensureLaVoce();
      ensureLaScheda();
    });
  wrapFunction("apriConfigEntita", "__dmAutomazioni", () => {
    ensureLaVoce();
    ensureLaScheda();
    /* La licenza si chiede all'apertura del config: la voce porta il
     * lucchetto senza Premium anche prima di essere toccata. */
    if (!nellApp()) void chiediAllaCasa();
  });
  onEditorRedraw("__dmAutomazioni", ancora);
  for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:editor-rendered"])
    root.addEventListener?.(evento, ancora);
  /* Gli stati nuovi cambiano i nomi e le letture accanto: si ridisegna solo
   * la pagina che si vede, e solo se e' cambiata. */
  root.addEventListener?.("dashboardmodern:states-ready", () => {
    if (contenitore() && !state.trascina && !doc.activeElement?.dataset?.auCampo) ridisegna();
  });
  ensureLaVoce();
  ensureLaScheda();
  return true;
}

/* Per le prove: lo stato della pagina. */
export const _statoDelleAutomazioni = state;
