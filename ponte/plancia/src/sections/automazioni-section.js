/* «Automazioni» (Premium): Quando · Solo se · Allora.
 *
 * «Quando succede qualcosa — un orario, una porta, un movimento, un valore,
 * chi arriva o esce — la casa fa da sola quello che le dici.» Le automazioni
 * sono quelle **vere di Home Assistant**: tutte, anche quelle scritte in Home
 * Assistant anni fa, a gruppi. Le esegue lui, e quelle create o modificate
 * qui si ritrovano in Impostazioni → Automazioni col segno «gdahome». La
 * plancia le racconta, le accende e le spegne (`automation.turn_on/off`), le
 * fa partire (`automation.trigger`), e le scrive passando dal ponte
 * (`ponte/automazioni/salva`, `ponte/src/automazioni.js`), che le traduce con
 * `core/automazioni-ha.js`.
 *
 * Due specie:
 *  - le **semplici**, che stanno tutte in Quando · Solo se · Allora: si
 *    modificano con l'editor di sempre, e si salvano in Home Assistant;
 *  - le **complesse** (template, scelte fra casi, blueprint…): una scheda col
 *    riassunto leggibile, l'interruttore, «Esegui ora», il nome e la stanza,
 *    e «Apri in Home Assistant ↗» per il resto. Modificarle qui vorrebbe dire
 *    perderne un pezzo senza dirlo.
 *
 * ── Tre porte ─────────────────────────────────────────────────────────────
 *
 *  - **La sezione della dashboard** (`automazioni-casa-section.js`): tutte,
 *    si guardano, si accendono e si spengono; si modificano nel config.
 *  - **Il config** (la plancia dentro Home Assistant): la voce «Automazioni»
 *    nel gruppo Plancia subito dopo «Azioni», col bollino PREMIUM, dove si
 *    creano e si modificano.
 *  - **Nell'app** la voce del config non c'e' e la linguetta nemmeno: tutto
 *    sta sotto «Automazioni» del menu dell'app, che apre la pagina a schermo
 *    pieno con `gdahomeApriLeAutomazioni` — una pagina sola con l'aspetto
 *    della dashboard, e qui dentro l'editor.
 *
 * Senza Premium tutto e' velato: niente elenco gratuito, niente interruttori.
 * Premium si compra solo dalle app gdahome: nel browser di Home Assistant
 * «Scopri Premium» lo dice e basta, e non chiede niente.
 *
 * Le proposte («Suggerite per la tua casa ✨») le calcola l'add-on in casa,
 * dai dispositivi e dalla loro storia (`core/automazioni-proposte.js`): qui
 * si raccontano, «Crea» ne apre una nell'editor gia' compilata — e finche'
 * non si salva in Home Assistant non c'e' niente — e «No, grazie» la scarta.
 *
 * Le automazioni scritte dalla versione di prova che le eseguiva l'add-on
 * (`cd_automazioni`) restano ferme nella configurazione: la lista invita a
 * convertirle in automazioni di Home Assistant, una volta, con un tasto.
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
import { CATEGORIE, EVENTO_AVVISA, normalizzata } from "../core/automazioni-ha.js";
import { proposteDaMostrare } from "../core/automazioni-proposte.js";
import {
  diventaInParole,
  nomeDaId,
  servizioInParole,
  statoInParole,
} from "../core/parole-dei-servizi.js";
import { oggettoWidget } from "../core/oggetti-widget.js";
import { ensureTitoloDellaSezione, riordinaLeLinguette } from "./alberatura-del-config-section.js";
import { premiumDellaCasa } from "./plancia-a-muro-section.js";
import {
  activeLocale,
  allStates,
  chiamaServizio,
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
  /* L'automazione di Home Assistant aperta (la voce dell'elenco): c'e' per
   * una che esiste, non c'e' per una nuova. */
  scheda: null,
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
  /* Un salvataggio in volo: il tasto non si ripreme. */
  salvando: false,
  /* L'ultima salvata, per il «Salvata in Home Assistant ✓» in cima. */
  salvata: null,
  /* «Per categoria» (le categorie di Home Assistant), «Per tipo» o «Per
   * stanza», e la ricerca. */
  per: "categoria",
  cerca: "",
  /* Gli interruttori appena toccati: valgono finche' Home Assistant non dice
   * lo stesso, al piu' dieci secondi. */
  toccate: {},
  /* «Eliminare?»: la voce da confermare. */
  conferma: null,
  /* La pagina a schermo pieno dell'app e' aperta. */
  inApp: false,
  doveEra: "",
  trascina: null,
  /* Le proposte della casa (`ponte/automazioni/proposte`), quella da cui
   * nasce la bozza aperta, e i «No, grazie» detti da qui e non ancora
   * tornati dalla casa. */
  proposte: null,
  proposta: null,
  scartateQui: [],
  /* Chi disegna la lista della pagina dell'app: la sezione della dashboard
   * (`automazioni-casa-section.js`), che la presta con la sua faccia. */
  listaDellApp: null,
});

export const AUTOMAZIONI_TAB = "automazioni";
const ID_PAGINA = "page-automazioni";
/* L'elenco della casa si richiede quando si apre la pagina, dopo un
 * salvataggio, e al ridisegno se e' piu' vecchio di un minuto. Nessun
 * orologio: la pagina non deve rincorrere niente. */
const VALE = 60_000;
const TOCCATA_VALE = 10_000;

const schedaAttiva = () => clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);

/* La plancia gira nell'app: lo dice il servitore dell'app, che le mette il
 * foglio `gdahome-config-fuori` (`app/lib/plancia/premesse.dart`) — sul
 * telefono e nel browser — e sul telefono anche il canale `gdahomeDice`. */
export function nellApp() {
  return Boolean(doc?.getElementById?.("gdahome-config-fuori") || root.gdahomeDice?.postMessage);
}

/** Lo stato della pagina, per la sezione della dashboard. */
export const statoDelleAutomazioni = () => state;

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
  return clean(s?.attributes?.friendly_name) || nomeDaId(id) || "—";
}

/* Le parole dei servizi e degli stati (`core/parole-dei-servizi.js`) sono in
 * italiano e in inglese: le altre lingue leggono l'inglese, come i nomi che
 * arrivano da Home Assistant. */
const detto = (coppia) => (activeLocale() === "it" ? coppia.it : coppia.en);

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

/* ── le automazioni di casa ──────────────────────────────────────────────── */

/** Quelle rimaste nella configurazione dalla versione di prova: ferme. */
export const rimasteNellaPlancia = () => automazioniPulite(readJson(CHIAVE_AUTOMAZIONI, []));

/**
 * Tutte le automazioni di Home Assistant, come le ha dette il ponte, con
 * quello che si sa di piu' fresco: acceso o spento e l'ultima volta li dice
 * lo stato vivo di Home Assistant, non l'elenco di un minuto fa.
 */
export function automazioniDiCasa() {
  const elenco = Array.isArray(state.ponte?.automazioni) ? state.ponte.automazioni : [];
  const vivi = stati();
  const ora = Date.now();
  return elenco.map((v) => {
    const s = vivi[v.entity_id];
    let attiva = s ? clean(s.state) === "on" : v.attiva === true;
    const toccata = state.toccate[v.entity_id];
    if (toccata) {
      if (ora - toccata.il > TOCCATA_VALE || toccata.attiva === attiva) delete state.toccate[v.entity_id];
      else attiva = toccata.attiva;
    }
    const ultima = Date.parse(s?.attributes?.last_triggered || "");
    return {
      ...v,
      attiva,
      nome: clean(s?.attributes?.friendly_name) || v.nome,
      ultima: Number.isFinite(ultima) ? ultima : v.ultima,
      modello: v.modello ? { ...v.modello, attiva } : null,
    };
  });
}

/* Le forme della plancia di tutte quelle che ci stanno, piu' quelle rimaste:
 * servono a non riproporre quello che c'e' gia'. */
const leFormeDiCasa = () => [
  ...rimasteNellaPlancia(),
  ...automazioniDiCasa()
    .map((v) => v.modello)
    .filter(Boolean),
];

const puoScrivere = () => state.ponte?.puoScrivere === true;

/* ── la casa ─────────────────────────────────────────────────────────────── */

export async function chiediAllaCasa({ forza = false } = {}) {
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
    state.ponte = await chiediAHomeAssistant({ type: "ponte/automazioni/stato" }, 25000);
    state.assente = false;
  } catch (errore) {
    /* «Non conosco»: questa plancia non sta dietro all'add-on, e l'elenco
     * non lo legge nessuno. Un filo non ancora aperto si riprova. */
    const detto = clean(errore?.message);
    state.assente = /non conosco|unknown/i.test(detto);
    if (detto === "socket") state.chiestoIl = adesso - VALE + 4000;
  }
  /* Le proposte: la prima volta del giorno la casa legge la storia, e puo'
   * metterci qualche secondo. Senza add-on non ce ne sono. */
  try {
    if (!state.assente) {
      ridisegnaTutto();
      state.proposte = await chiediAHomeAssistant({ type: "ponte/automazioni/proposte" }, 15000);
    }
  } catch (_errore) {
    /* Nessuna proposta e' meglio di un errore: il blocco semplicemente non
     * c'e'. */
  } finally {
    state.chiedendo = false;
  }
  ridisegnaTutto();
}

/* Chi ridisegna quando la casa risponde: questa pagina, e la sezione della
 * dashboard che si iscrive qui. */
const ascoltatori = new Set();
export const quandoCambiaLaCasa = (chi) => ascoltatori.add(chi);
function ridisegnaTutto() {
  ridisegna();
  for (const chi of ascoltatori) {
    try {
      chi();
    } catch (_errore) {}
  }
}

/* ── dire a Home Assistant ───────────────────────────────────────────────── */

/** Accende o spegne un'automazione di Home Assistant. */
export function alternaInCasa(voce, attiva = !voce?.attiva) {
  if (!voce?.entity_id) return false;
  state.toccate[voce.entity_id] = { attiva, il: Date.now() };
  chiamaServizio({
    domain: "automation",
    service: attiva ? "turn_on" : "turn_off",
    data: { entity_id: voce.entity_id },
  });
  ridisegnaTutto();
  return true;
}

/** «▶ Esegui ora»: le azioni, senza guardare il Solo se. */
export function eseguiOra(voce) {
  if (!voce?.entity_id) return false;
  const nome = voce.nome;
  chiamaServizio({
    domain: "automation",
    service: "trigger",
    data: { entity_id: voce.entity_id, skip_condition: true },
  });
  root.edToast?.(t(`▶ «${nome}» eseguita`, `▶ «${nome}» run`));
  return true;
}

/* Una domanda al ponte che scrive in Home Assistant. Il perche' di un no lo
 * dice chi ha detto no. */
async function scriviInCasa(comando) {
  return chiediAHomeAssistant(comando, 25000);
}

/* Home Assistant ricarica le automazioni dopo ogni scrittura, e l'entita'
 * nuova arriva un attimo dopo: si richiede l'elenco due volte. */
function rileggiPresto() {
  void chiediAllaCasa({ forza: true });
  root.setTimeout?.(() => void chiediAllaCasa({ forza: true }), 2500);
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
    /* Gli stati con le loro parole: «Quando Antifurto scatta», non
     * «diventa «triggered»». */
    const prima = da ? detto(statoInParole(da)) : "";
    const dopo = a ? detto(statoInParole(a)) : "";
    let frase = t(`Quando ${chi} cambia stato`, `When ${chi} changes state`);
    if (da && a)
      frase = t(`Quando ${chi} passa da ${prima} a ${dopo}`, `When ${chi} goes from ${prima} to ${dopo}`);
    else if (a) frase = `${t("Quando", "When")} ${detto(diventaInParole(chi, a))}`;
    else if (da) frase = t(`Quando ${chi} non è più ${prima}`, `When ${chi} is no longer ${prima}`);
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
    const valore = c.valore ? detto(statoInParole(c.valore)) : "…";
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
    /* «<60» e «>25» sono soglie: si leggono come una salita o una discesa. */
    const soglia = /^([<>])\s*(-?\d+(?:[.,]\d+)?)$/.exec(clean(stato));
    const limite = soglia ? soglia[2] : "";
    if (soglia?.[1] === "<")
      return t(
        `aspetta che ${chi} scenda sotto ${limite} (al massimo ${massimo} min)`,
        `wait until ${chi} drops below ${limite} (at most ${massimo} min)`,
      );
    if (soglia)
      return t(
        `aspetta che ${chi} salga sopra ${limite} (al massimo ${massimo} min)`,
        `wait until ${chi} rises above ${limite} (at most ${massimo} min)`,
      );
    const parola = detto(statoInParole(stato));
    return t(
      `aspetta che ${chi} diventi ${parola} (al massimo ${massimo} min)`,
      `wait until ${chi} becomes ${parola} (at most ${massimo} min)`,
    );
  }
  /* Un servizio col suo verbo: «imposta Termostato soggiorno a 21°», mai
   * «chiama climate.set_temperature». */
  if (a.tipo === "servizio")
    return detto(servizioInParole(a.servizio, { chi: (a.entita || []).length ? chi : "", dati: a.dati }));
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

/* ── le automazioni di Home Assistant, dette ──────────────────────────────── */

/** I gruppi «Per tipo»: simbolo, nome, disegno di casa e colore. */
export const CATEGORIA = () => ({
  luci: ["💡", t("Luci", "Lights"), "luci", "#f59e0b"],
  clima: ["🌡️", t("Clima", "Climate"), "clima", "#0ea5e9"],
  tapparelle: ["🪟", t("Tapparelle", "Shutters"), "tapparelle", "#6366f1"],
  irrigazione: ["💧", t("Irrigazione", "Irrigation"), "irrigazione", "#10b981"],
  sicurezza: ["🛡️", t("Sicurezza", "Security"), "sicurezza", "#16a34a"],
  avvisi: ["🔔", t("Avvisi", "Alerts"), "allerte", "#f97316"],
  energia: ["⚡", t("Energia", "Energy"), "energia", "#eab308"],
  altre: ["⚙️", t("Altre", "Other"), "impostazioni", "#64748b"],
});

const categoriaDi = (v) => (CATEGORIE.includes(v?.categoria) ? v.categoria : "altre");

/** La frase di una carta: il Quando (col primo Solo se) e l'Allora. `null` se e' complessa. */
export function fraseDellaVoce(v) {
  const m = v?.modello;
  if (!m) return null;
  if (m.tipo === "crono") return { quando: t("Cronotermostato", "Thermostat schedule"), allora: fraseDelCrono(m.crono) };
  const se = m.soloSe?.length ? `, ${fraseDellaCondizione(m.soloSe[0])}` : "";
  return { quando: `${fraseDelQuando(m.quando)}${se}`, allora: fraseDellAllora(m.allora) || "…" };
}

/** «ultima volta: oggi 07:15», o «mai». */
export const ultimaVoltaDi = (v) => (v?.ultima ? quandoFu(v.ultima) : t("mai", "never"));

/**
 * La riga di una voce, in parole: la frase della plancia («Alle 07:15 → apri
 * Tapparelle soggiorno») se ci sta, se no il riassunto che manda il ponte
 * («Quando si apre Porta ingresso · 2 azioni»), letto dalla configurazione
 * in Home Assistant. Al posto di «Avanzata…», che non diceva niente.
 */
export function rigaDellaVoce(v) {
  const f = fraseDellaVoce(v);
  if (f) return `${f.quando} → ${f.allora}`;
  const r = v?.riassunto;
  if (r && typeof r === "object") {
    /* Il ponte lo scrive in italiano e in inglese: le altre lingue leggono
     * l'inglese, come per i nomi che arrivano da Home Assistant. */
    const detto = clean(activeLocale() === "it" ? r.it : r.en) || clean(r.it);
    if (detto) return detto;
  }
  return t("Avanzata: usa template, scelte o blueprint", "Advanced: uses templates, choices or blueprints");
}

/** Le categorie salvate in Home Assistant, nell'ordine in cui le manda il ponte: per nome. */
export function categorieDiCasa() {
  const elenco = Array.isArray(state.ponte?.categorie) ? state.ponte.categorie : [];
  return elenco.filter((c) => clean(c?.id)).map((c) => ({ id: clean(c.id), nome: clean(c.nome) || clean(c.id) }));
}

/* La ricerca guarda il nome, la stanza, la categoria e la riga. */
function trovata(v, cerca, nomeDellaCategoria) {
  const q = clean(cerca).toLowerCase();
  if (!q) return true;
  return [v.nome, v.area, nomeDellaCategoria(v), rigaDellaVoce(v)].some((x) =>
    clean(x).toLowerCase().includes(q),
  );
}

/** I tre modi di raggruppare: le categorie di Home Assistant, il tipo, la stanza. */
export const RAGGRUPPA = ["categoria", "tipo", "stanza"];

/* «Per categoria» c'e' solo se chi abita ha delle categorie in Home
 * Assistant: senza, sarebbe un gruppo solo, «Senza categoria», e si torna
 * a «Per tipo». */
export const raggruppaDavvero = (per) =>
  per === "stanza" ? "stanza" : per === "tipo" || !categorieDiCasa().length ? "tipo" : "categoria";

/* Il tipo che conta di piu' in un gruppo: ne da' il disegno e il colore. */
function tipoDelGruppo(voci) {
  const conte = new Map();
  for (const v of voci) conte.set(categoriaDi(v), (conte.get(categoriaDi(v)) || 0) + 1);
  let meglio = "altre";
  let quante = 0;
  for (const k of CATEGORIE)
    if ((conte.get(k) || 0) > quante) {
      meglio = k;
      quante = conte.get(k);
    }
  return meglio;
}

/**
 * Le automazioni a gruppi. «Per categoria»: le categorie di Home Assistant
 * col loro nome e nel loro ordine (per nome, come le mostra Home Assistant),
 * e «Senza categoria» in fondo. «Per tipo»: nell'ordine dei tipi. «Per
 * stanza»: per nome, con quelle senza stanza in fondo. Solo i gruppi che
 * hanno qualcosa, e solo quello che la ricerca trova. Ogni gruppo porta il
 * disegno e il colore del tipo che ci conta di piu'.
 */
export function gruppiDelleAutomazioni(elenco, { per = "", perStanza = false, cerca = "" } = {}) {
  const modo = raggruppaDavvero(per || (perStanza ? "stanza" : "categoria"));
  const categorie = categorieDiCasa();
  const nomeDellaCategoria = (v) => categorie.find((c) => c.id === clean(v?.categoriaHa))?.nome || "";
  const trovate = elenco.filter((v) => trovata(v, cerca, nomeDellaCategoria));
  const nomi = CATEGORIA();
  const vestito = (g) => {
    /* Una categoria che si chiama come l'irrigazione ha la sua goccia,
     * qualunque cosa facciano le automazioni dentro. */
    const tipo =
      modo === "tipo"
        ? g.chiave
        : modo === "categoria" && /irrig|sprinkl|annaff/i.test(g.titolo)
          ? "irrigazione"
          : tipoDelGruppo(g.voci);
    return {
      ...g,
      chiave: `${modo}:${g.chiave}`,
      disegno: modo === "stanza" ? "stanze" : nomi[tipo][2],
      colore: modo === "stanza" ? "#7c3aed" : nomi[tipo][3],
    };
  };
  if (modo === "stanza") {
    const stanze = [...new Set(trovate.map((v) => clean(v.area)).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, locale()),
    );
    return [...stanze, ""]
      .map((stanza) => ({
        chiave: stanza || "-",
        titolo: stanza || t("Senza stanza", "No room"),
        voci: trovate.filter((v) => clean(v.area) === stanza),
      }))
      .filter((g) => g.voci.length)
      .map(vestito);
  }
  if (modo === "categoria") {
    const conosciute = new Set(categorie.map((c) => c.id));
    const senza = (v) => !conosciute.has(clean(v.categoriaHa));
    return [
      ...categorie.map((c) => ({
        chiave: c.id,
        titolo: c.nome,
        voci: trovate.filter((v) => clean(v.categoriaHa) === c.id),
      })),
      { chiave: "-", titolo: t("Senza categoria", "Uncategorized"), voci: trovate.filter(senza) },
    ]
      .filter((g) => g.voci.length)
      .map(vestito);
  }
  return CATEGORIE.map((k) => ({
    chiave: k,
    titolo: nomi[k][1],
    voci: trovate.filter((v) => categoriaDi(v) === k),
  }))
    .filter((g) => g.voci.length)
    .map(vestito);
}

/* ── i gruppi che si chiudono ───────────────────────────────────────────── *
 *
 * Come in Home Assistant: ▾ aperto, ▸ chiuso, e il numero accanto. Chi
 * guarda si ritrova i gruppi come li ha lasciati: lo ricorda questo browser
 * (o questo telefono), non la configurazione della casa — un gruppo chiuso
 * da uno non si chiude per tutti. */

export const CHIAVE_GRUPPI_CHIUSI = "dm_automazioni_gruppi_chiusi";

function gruppiChiusi() {
  try {
    const scritto = JSON.parse(root.localStorage?.getItem?.(CHIAVE_GRUPPI_CHIUSI) || "[]");
    return Array.isArray(scritto) ? scritto.map(String) : [];
  } catch (_errore) {
    return [];
  }
}

/** Apre o chiude un gruppo («categoria:<id>», «tipo:luci», «stanza:Cucina»). */
export function alternaIlGruppo(chiave) {
  const chiusi = new Set(gruppiChiusi());
  if (chiusi.has(chiave)) chiusi.delete(chiave);
  else chiusi.add(chiave);
  try {
    root.localStorage?.setItem?.(CHIAVE_GRUPPI_CHIUSI, JSON.stringify([...chiusi]));
  } catch (_errore) {}
}

/** «Per categoria · Per tipo · Per stanza»: `attributo` e' quello dei tocchi di chi lo disegna. */
export function scelteDelRaggruppa(per, attributo, classe = "") {
  const modo = raggruppaDavvero(per);
  const voci = [
    ["categoria", t("Per categoria", "By category")],
    ["tipo", t("Per tipo", "By type")],
    ["stanza", t("Per stanza", "By room")],
  ].filter(([k]) => k !== "categoria" || categorieDiCasa().length);
  return `<span class="${classe}" role="group">${voci
    .map(
      ([k, nome]) =>
        `<button type="button" ${attributo}="${k}" class="${modo === k ? "si" : ""}" aria-pressed="${modo === k}">${esc(nome)}</button>`,
    )
    .join("")}</span>`;
}

/**
 * I gruppi in righe compatte, la stessa faccia nella dashboard, nell'app e
 * nel config: una riga sola per automazione — il disegno, il nome, la riga
 * in parole, l'ultima volta e l'interruttore. Chi la usa dice come si chiama
 * (`prefisso`, che tiene unici i disegni) e cosa porta ogni riga
 * (`attributi(v)`, i suoi tocchi; `interruttore(v)`; `etichetta(v)`). Con
 * una ricerca in corso i gruppi stanno tutti aperti: quello che si cerca
 * non si nasconde.
 */
export function gruppiCompattiHtml(
  elenco,
  { per = "categoria", cerca = "", prefisso = "aug", attributi = () => "", interruttore = () => "", etichetta = () => "", classeRiga = "" } = {},
) {
  const gruppi = gruppiDelleAutomazioni(elenco, { per, cerca });
  if (!gruppi.length) return "";
  const chiusi = new Set(clean(cerca) ? [] : gruppiChiusi());
  const nomi = CATEGORIA();
  return `<div class="aug-griglia">${gruppi
    .map((g, gi) => {
      const chiuso = chiusi.has(g.chiave);
      const accese = g.voci.filter((v) => v.attiva).length;
      const righe = chiuso
        ? ""
        : `<div class="aug-righe">${g.voci
            .map((v, ri) => {
              const tipo = categoriaDi(v);
              const [, , oggetto, colore] = nomi[tipo];
              /* Il grigio delle «Altre» su un interruttore acceso si confonde
               * con lo spento: acceso, e' il viola delle automazioni. */
              const acceso = tipo === "altre" ? "#7c3aed" : colore;
              return `<div class="aug-riga${classeRiga ? ` ${classeRiga}` : ""}${v.attiva ? "" : " spenta"}" style="--c:${colore};--c-acceso:${acceso}"${attributi(v)}><span class="aug-orb">${oggettoWidget(
                oggetto,
                "",
                `${prefisso}-r${gi}-${ri}`,
              )}</span><span class="aug-testo"><b class="aug-nome"><span>${esc(v.nome)}</span>${etichetta(v)}</b><small class="aug-fr">${esc(
                rigaDellaVoce(v),
              )}</small></span><span class="aug-quando">${esc(ultimaVoltaDi(v))}</span>${interruttore(v)}</div>`;
            })
            .join("")}</div>`;
      return `<section class="aug${chiuso ? " chiuso" : ""}" style="--c:${g.colore}" data-aug="${esc(g.chiave)}"><button type="button" class="aug-testa" data-aug-apri="${esc(
        g.chiave,
      )}" aria-expanded="${!chiuso}"><span class="aug-freccia" aria-hidden="true">${chiuso ? "▸" : "▾"}</span><span class="aug-ico">${oggettoWidget(
        g.disegno,
        "",
        `${prefisso}-g${gi}`,
      )}</span><span class="aug-titolo">${esc(g.titolo)}</span><span class="aug-conta" data-on="${accese > 0}">${accese}/${g.voci.length}</span></button>${righe}</section>`;
    })
    .join("")}</div>`;
}

/** Cosa viene dopo: la prima delle accese che ha un'ora. */
export function prossimaDiCasa(elenco = automazioniDiCasa()) {
  const perId = new Map();
  const forme = [];
  for (const v of elenco)
    if (v.modello && v.attiva) {
      perId.set(v.modello.id, v);
      forme.push(v.modello);
    }
  const primo = prossimiEventi(forme, Date.now(), (id) => stati()[id] || null, 1)[0];
  return primo ? { alle: primo.alle, ora: oraBreve(primo.alle), voce: perId.get(primo.id) } : null;
}

/* ── il riassunto di una complessa ─────────────────────────────────────── *
 *
 * Una complessa non sta in una frase sola, ma si puo' leggere: una riga per
 * ogni pezzo, coi nomi delle cose di casa al posto degli id, e il codice
 * scritto a mano mostrato com'e', piccolo, per chi lo sa leggere. */

const nomiDentro = (v) => nomiDi((Array.isArray(v) ? v : v ? [v] : []).filter((x) => clean(x).includes(".")));
const comeCodice = (testo) => clean(testo).slice(0, 120);

const scritto = (v) => (v !== undefined && v !== null && typeof v !== "object" ? String(v) : "");
const testiDi = (azioni) =>
  [].concat(azioni || []).flatMap((y) => righeDellAzione(y)).map((r) => r.testo).join(", ");

function rigaDelTrigger(x) {
  const tipo = clean(x?.trigger);
  const quale = tipo || "?";
  const chi = nomiDentro(x?.entity_id);
  if (tipo === "time") {
    const ore = []
      .concat(x.at || [])
      .map((o) => String(o).replace(/^(\d{1,2}:\d{2}):00$/, "$1"))
      .join(", ");
    return { testo: t(`alle ${ore}`, `at ${ore}`) };
  }
  if (tipo === "sun")
    return { testo: x.event === "sunrise" ? t("all'alba", "at sunrise") : t("al tramonto", "at sunset") };
  if (tipo === "state") {
    const a = typeof x.to === "string" ? x.to : "";
    return {
      testo: a ? detto(diventaInParole(chi, a)) : t(`${chi} cambia stato`, `${chi} changes state`),
    };
  }
  if (tipo === "numeric_state") {
    const sopra = scritto(x.above);
    const sotto = scritto(x.below);
    if (sopra) return { testo: t(`${chi} supera ${sopra}`, `${chi} goes above ${sopra}`) };
    if (sotto) return { testo: t(`${chi} scende sotto ${sotto}`, `${chi} drops below ${sotto}`) };
    return { testo: t(`${chi} cambia valore`, `${chi} changes value`) };
  }
  if (tipo === "template")
    return {
      testo: t("una condizione scritta a mano", "a hand-written condition"),
      codice: comeCodice(x.value_template),
    };
  if (tipo === "event") {
    const evento = clean(x.event_type);
    return { testo: t(`arriva l'evento ${evento}`, `the ${evento} event arrives`) };
  }
  if (tipo === "homeassistant")
    return {
      testo:
        x.event === "shutdown"
          ? t("Home Assistant si spegne", "Home Assistant shuts down")
          : t("Home Assistant si avvia", "Home Assistant starts"),
    };
  if (tipo === "time_pattern") return { testo: t("a intervalli regolari", "at regular intervals") };
  if (tipo === "zone")
    return { testo: t(`${chi} entra o esce da una zona`, `${chi} enters or leaves a zone`) };
  if (tipo === "device") return { testo: t("un dispositivo fa qualcosa", "a device does something") };
  return { testo: t(`un trigger «${quale}»`, `a «${quale}» trigger`) };
}

function righeDellaCondizione(c, rientra = false) {
  const tipo = clean(c?.condition);
  const quale = tipo || "?";
  const chi = nomiDentro(c?.entity_id);
  if (["and", "or", "not"].includes(tipo)) {
    const testa = {
      and: t("tutte queste:", "all of these:"),
      or: t("una di queste:", "any of these:"),
      not: t("nessuna di queste:", "none of these:"),
    }[tipo];
    return [
      { testo: testa, sub: rientra },
      ...(Array.isArray(c.conditions) ? c.conditions : []).flatMap((x) =>
        righeDellaCondizione(x, true),
      ),
    ];
  }
  let riga;
  if (tipo === "state") {
    const stato = []
      .concat(c.state ?? "")
      .map((x) => detto(statoInParole(x)))
      .join(", ");
    riga = { testo: t(`${chi} è ${stato}`, `${chi} is ${stato}`) };
  } else if (tipo === "numeric_state") {
    const sopra = scritto(c.above);
    const sotto = scritto(c.below);
    riga = {
      testo: sopra
        ? t(`${chi} sopra ${sopra}`, `${chi} above ${sopra}`)
        : sotto
          ? t(`${chi} sotto ${sotto}`, `${chi} below ${sotto}`)
          : t(`un valore di ${chi}`, `a value of ${chi}`),
    };
  } else if (tipo === "time") {
    const da = clean(c.after) || "…";
    const a = clean(c.before) || "…";
    riga = {
      testo:
        c.after || c.before
          ? t(`fra ${da} e ${a}`, `between ${da} and ${a}`)
          : t("in certi giorni", "on certain days"),
    };
  } else if (tipo === "sun") riga = { testo: t("secondo il sole", "depending on the sun") };
  else if (tipo === "template")
    riga = {
      testo: t("una condizione scritta a mano", "a hand-written condition"),
      codice: comeCodice(c.value_template),
    };
  else if (tipo === "trigger")
    riga = { testo: t("secondo cosa l'ha fatta partire", "depending on what started it") };
  else riga = { testo: t(`una condizione «${quale}»`, `a «${quale}» condition`) };
  return [{ ...riga, sub: rientra }];
}

function rigaDelServizio(x) {
  const chi = nomiDentro(x.target?.entity_id ?? x.entity_id ?? x.data?.entity_id);
  const frase = detto(servizioInParole(x.action, { chi, dati: x.data || {} }));
  return !chi && x.target?.area_id ? t(`${frase} in una stanza`, `${frase} in a room`) : frase;
}

function righeDellAzione(x, sub = false) {
  if (!x || typeof x !== "object") return [];
  if (typeof x.action === "string") return [{ testo: rigaDelServizio(x), sub }];
  if (x.delay !== undefined) {
    const min = typeof x.delay === "number" ? Math.max(1, Math.round(x.delay / 60)) : 0;
    return [{ testo: min ? t(`aspetta ${min} min`, `wait ${min} min`) : t("aspetta un po'", "waits a while"), sub }];
  }
  if (x.event === EVENTO_AVVISA) return [{ testo: `📱 «${clean(x.event_data?.testo)}»`, sub }];
  if (x.event) {
    const evento = clean(x.event);
    return [{ testo: t(`manda l'evento ${evento}`, `fires the ${evento} event`), sub }];
  }
  if (x.wait_template !== undefined || x.wait_for_trigger !== undefined)
    return [
      {
        testo: t("aspetta che succeda qualcosa", "waits for something to happen"),
        sub,
        codice: comeCodice(x.wait_template),
      },
    ];
  if (Array.isArray(x.choose)) {
    const casi = x.choose.length;
    const righe = [
      {
        testo:
          casi === 1
            ? t("sceglie un caso:", "chooses one case:")
            : t(`sceglie fra ${casi} casi:`, `chooses between ${casi} cases:`),
        sub,
      },
    ];
    x.choose.forEach((caso, i) => {
      const n = i + 1;
      const cosa = testiDi(caso.sequence) || "…";
      righe.push({ testo: t(`caso ${n} → ${cosa}`, `case ${n} → ${cosa}`), sub: true });
    });
    const cosa = testiDi(x.default);
    if (cosa) righe.push({ testo: t(`altrimenti → ${cosa}`, `otherwise → ${cosa}`), sub: true });
    return righe;
  }
  if (x.if !== undefined) {
    const allora = testiDi(x.then) || "…";
    const altrimenti = testiDi(x.else);
    return [
      { testo: t("se succede una cosa:", "if something holds:"), sub },
      { testo: t(`allora → ${allora}`, `then → ${allora}`), sub: true },
      ...(altrimenti
        ? [{ testo: t(`altrimenti → ${altrimenti}`, `otherwise → ${altrimenti}`), sub: true }]
        : []),
    ];
  }
  if (x.repeat) return [{ testo: t("ripete alcune azioni", "repeats some actions"), sub }];
  if (x.parallel) return [{ testo: t("fa più cose insieme", "does several things at once"), sub }];
  if (x.variables) return [{ testo: t("si prepara dei valori", "prepares some values"), sub }];
  if (x.stop !== undefined) return [{ testo: t("si ferma", "stops"), sub }];
  if (x.scene) {
    const scena = nomeDi(x.scene);
    return [{ testo: t(`attiva la scena ${scena}`, `activates the ${scena} scene`), sub }];
  }
  if (x.device_id) return [{ testo: t("un'azione di un dispositivo", "a device action"), sub }];
  return [{ testo: t("un'altra azione", "another action"), sub }];
}

/** Il riassunto di una configurazione di Home Assistant, in tre blocchi. */
export function riassuntoDi(config) {
  const n = normalizzata(config);
  return {
    quando: n.triggers.map(rigaDelTrigger),
    soloSe: n.conditions.flatMap((c) => righeDellaCondizione(c)),
    allora: n.actions.flatMap((x) => righeDellAzione(x)),
    blueprint: Boolean(config?.use_blueprint),
  };
}

/* ── i disegni ───────────────────────────────────────────────────────────── */

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

function boxDellaCasa(elenco) {
  const prossima = prossimaDiCasa(elenco);
  const pross = prossima
    ? `<div class="au-pross"><b>${esc(prossima.ora)}</b><span>${esc(prossima.voce?.nome || "")}</span></div>`
    : `<div class="au-vuoto">${esc(t("Niente a un orario, per ora.", "Nothing on a schedule, for now."))}</div>`;
  const ultime = elenco
    .filter((v) => v.ultima)
    .sort((x, y) => y.ultima - x.ultima)
    .slice(0, 3);
  const ult = ultime.length
    ? `<div class="au-ult">${ultime
        .map((v) => `<div><em>${esc(oraBreve(v.ultima))}</em><span>${esc(v.nome)}</span><i>✓</i></div>`)
        .join("")}</div>`
    : `<div class="au-vuoto">${esc(t("Ancora nessuna.", "None yet."))}</div>`;
  return `<div class="au-due">
<div class="au-box blu"><div class="au-et">${esc(t("Prossimo", "Next"))}</div>${pross}</div>
<div class="au-box"><div class="au-et">${esc(t("Ultime eseguite", "Last run"))}</div>${ult}</div></div>`;
}

/* Da dove viene: nata dalla plancia, o da un blueprint. */
export const etichettaDiOrigine = (v) =>
  v?.origine === "gdahome"
    ? '<span class="ha-orig g">gdahome</span>'
    : v?.origine === "blueprint"
      ? '<span class="ha-orig b">Blueprint</span>'
      : "";

/* L'interruttore di una riga: la accende o la spegne in Home Assistant,
 * senza aprirla. */
const interruttoreDellaRiga = (v) =>
  `<button type="button" class="aug-int" role="switch" aria-checked="${v.attiva}" data-au-attiva="${esc(v.entity_id)}" aria-label="${esc(
    t(`Accendi o spegni ${v.nome}`, `Turn ${v.nome} on or off`),
  )}"></button>`;

/* Si apre (l'editor, o la scheda di una complessa) solo se la si puo' scrivere. */
const attributiDellaRiga = (v) =>
  puoScrivere() && v.modificabile ? ` data-au-apri="${esc(v.entity_id)}" role="button" tabindex="0"` : "";

function gruppiHtml(elenco) {
  const gruppi = gruppiCompattiHtml(elenco, {
    per: state.per,
    cerca: state.cerca,
    prefisso: "aug-au",
    attributi: attributiDellaRiga,
    interruttore: interruttoreDellaRiga,
    etichetta: etichettaDiOrigine,
    classeRiga: "ha-riga",
  });
  if (gruppi) return gruppi;
  return `<div class="au-lista au-lista-vuota"><p>${esc(
    elenco.length
      ? t("Nessuna automazione con queste parole.", "No automation matches these words.")
      : t("Nessuna automazione, per ora: comincia da un modello pronto.", "No automations yet: start from a ready-made template."),
  )}</p></div>`;
}

/* «Per categoria», «Per tipo» o «Per stanza», la ricerca e «＋ Nuova». */
function barraDellaLista(elenco, { chiuso = false } = {}) {
  const n = elenco.length;
  return `<div class="ha-barra au-testa"><h3>${esc(t("Le automazioni di casa", "The home's automations"))} <small>· ${esc(
    t(`${n}, da Home Assistant`, `${n}, from Home Assistant`),
  )}</small></h3>${scelteDelRaggruppa(state.per, "data-au-per", "ha-seg")}<label class="ha-cerca"><span aria-hidden="true">🔍</span><input type="search" data-au-cerca value="${esc(
    state.cerca,
  )}" placeholder="${esc(t("Cerca un'automazione…", "Search an automation…"))}"></label>${
    chiuso
      ? `<button type="button" class="au-piu chiuso" tabindex="-1">🔒 ${esc(t("Nuova", "Add new"))}</button>`
      : puoScrivere()
        ? `<button type="button" class="au-piu" data-au-vai="modelli">＋ ${esc(t("Nuova", "Add new"))}</button>`
        : ""
  }</div>`;
}

/* Dove la si ritrova in Home Assistant. Nell'app l'indirizzo di Home
 * Assistant non e' quello della pagina, e il collegamento non c'e'. */
const indirizzoInHA = (id) => `/config/automation/edit/${encodeURIComponent(id)}`;
const apriInHA = (id, testo) =>
  nellApp() || !id
    ? ""
    : `<a class="ha-link" href="${esc(indirizzoInHA(id))}" target="_top" rel="noopener">${esc(testo)}</a>`;

function salvataHtml() {
  const v = state.salvata;
  if (!v) return "";
  return `<div class="ha-ok" role="status"><span class="s">✓</span><div>${esc(
    t(`Salvata in Home Assistant ✓ «${v.nome}»`, `Saved in Home Assistant ✓ «${v.nome}»`),
  )}<small>${esc(
    t(
      "La ritrovi in Impostazioni → Automazioni, con l'etichetta gdahome.",
      "You'll find it in Settings → Automations, labelled gdahome.",
    ),
  )}</small></div>${apriInHA(v.id, t("Apri in HA ↗", "Open in HA ↗"))}</div>`;
}

/* Le automazioni della versione di prova, rimaste ferme nella plancia: un
 * tasto le scrive in Home Assistant, una volta. */
function inviteAConvertire() {
  const rimaste = rimasteNellaPlancia();
  if (!rimaste.length || !puoScrivere()) return "";
  const n = rimaste.length;
  return `<div class="ha-converti"><span aria-hidden="true">🔁</span><div><b>${esc(
    n === 1
      ? t("Un'automazione della versione di prova è ferma", "One automation from the trial version is idle")
      : t(`${n} automazioni della versione di prova sono ferme`, `${n} automations from the trial version are idle`),
  )}</b><small>${esc(
    t(
      "Adesso le automazioni le esegue Home Assistant: convertile e ripartono, con l'etichetta gdahome.",
      "Home Assistant runs automations now: convert them and they start again, labelled gdahome.",
    ),
  )}</small></div><button type="button" data-au-converti>${esc(t("Converti", "Convert"))}</button></div>`;
}

function noteDellaLista() {
  if (state.assente)
    return `<div class="au-nota">${esc(
      t(
        "L'elenco e i salvataggi passano dall'add-on gdahome: qui non c'è.",
        "The list and saving go through the gdahome add-on: it is not here.",
      ),
    )}</div>`;
  if (state.ponte && !puoScrivere())
    return `<div class="au-nota">${esc(
      t(
        "Le automazioni le crea e le modifica chi amministra Home Assistant: qui si accendono e si spengono.",
        "Automations are created and edited by whoever administers Home Assistant: here you turn them on and off.",
      ),
    )}</div>`;
  return "";
}

function lista() {
  const elenco = automazioniDiCasa();
  return `${salvataHtml()}${noteDellaLista()}${inviteAConvertire()}${boxDellaCasa(elenco)}${bloccoDelleProposte()}
${barraDellaLista(elenco)}<div class="ha-tutte">${gruppiHtml(elenco)}</div>`;
}

/* L'interruttore della sezione della dashboard: come per le altre, sta in
 * cima alla sua pagina del config. */
function interruttoreDellaSezione() {
  try {
    return root.cdSecToggleHtml?.("automazioni") || "";
  } catch (_errore) {
    return "";
  }
}

const INTRO = () =>
  `<p class="au-intro">${esc(
    t(
      "Tutte le automazioni di Home Assistant, a gruppi: le crei, le modifichi, le accendi e le spegni. Le esegue Home Assistant, anche con la plancia e l'app chiuse.",
      "All of Home Assistant's automations, in groups: you create them, edit them, turn them on and off. Home Assistant runs them, even with the dashboard and the app closed.",
    ),
  )} <span class="au-prem">PREMIUM</span></p>`;

/* La nota sotto ogni velo e ogni «Scopri Premium»: dove si compra. */
export const DOVE_SI_COMPRA = () =>
  t(
    "Si acquista solo dalle app gdahome su App Store e Google Play. Le app sono in arrivo.",
    "Only available from the gdahome apps on the App Store and Google Play. The apps are coming soon.",
  );

function velo(dentro) {
  return `<div class="au-velato"><div class="au-sotto" aria-hidden="true" inert>${dentro}</div><div class="au-velo"><span class="st">✨</span><span class="au-prem">${esc(
    t("PREMIUM · IN ARRIVO", "PREMIUM · COMING SOON"),
  )}</span><h3>${esc(t("Automazioni con Premium", "Automations with Premium"))}</h3><p>${esc(
    t(
      "Vedi tutte le automazioni di casa, le accendi e le spegni, ne crei di nuove in tre passi e ricevi le proposte pensate per la tua casa.",
      "See all the home's automations, turn them on and off, create new ones in three steps and get suggestions designed for your home.",
    ),
  )}</p><button type="button" data-au-scopri>${esc(t("Scopri Premium", "Discover Premium"))}</button><small>${esc(
    DOVE_SI_COMPRA(),
  )}</small></div></div>`;
}

/* ── «Premium arriva con le app» ───────────────────────────────────────────
 *
 * Toccato «Scopri Premium» dentro Home Assistant: Premium si compra solo
 * dalle app sugli store, e qui lo si dice — niente prezzi, niente moduli,
 * niente dati di pagamento. Nell'app invece si apre la pagina Premium
 * dell'app, che sa vendere (`diciAllApp("premium")`). */
const ID_DELLO_STORE = "au-store";

export function apriLoStore() {
  if (!doc?.body || doc.getElementById(ID_DELLO_STORE)) return;
  const velo = doc.createElement("div");
  velo.id = ID_DELLO_STORE;
  velo.className = "ps-velo";
  velo.dataset.auStoreChiudi = "";
  velo.innerHTML = `<div class="ps" role="dialog" aria-modal="true" aria-labelledby="au-store-titolo"><div class="man"></div><span class="ico" aria-hidden="true">✨</span><span class="tag">${esc(
    t("PREMIUM · IN ARRIVO", "PREMIUM · COMING SOON"),
  )}</span><h3 id="au-store-titolo">${esc(t("Premium arriva con le app", "Premium comes with the apps"))}</h3><p>${esc(
    t("Premium si acquista", "Premium is bought"),
  )} <b>${esc(t("esclusivamente dalle app gdahome", "only from the gdahome apps"))}</b> ${esc(
    t(
      "su App Store e Google Play. Qui in Home Assistant non si paga nulla e non si inseriscono dati di pagamento.",
      "on the App Store and Google Play. Here in Home Assistant you pay nothing and enter no payment details.",
    ),
  )}</p><div class="negozi"><span class="neg">App Store <small>${esc(t("in arrivo", "coming soon"))}</small></span><span class="neg">▶ Google Play <small>${esc(
    t("in arrivo", "coming soon"),
  )}</small></span></div><p>${esc(
    t(
      "Quando le app saranno sugli store, attivi Premium dall'app e qui le Automazioni si sbloccano da sole.",
      "When the apps are in the stores, you turn on Premium from the app and Automations unlock here by themselves.",
    ),
  )}</p><button type="button" class="ok" data-au-store-chiudi>${esc(t("Ho capito", "Got it"))}</button></div>`;
  doc.body.append(velo);
  velo.querySelector(".ok")?.focus?.();
}

const chiudiLoStore = () => doc?.getElementById?.(ID_DELLO_STORE)?.remove();

/** «Scopri Premium»: nell'app la pagina Premium dell'app, qui la finestra. */
export function scopriPremium() {
  if (nellApp()) diciAllApp("premium");
  else apriLoStore();
}

/* ── le proposte ─────────────────────────────────────────────────────────── */

/* Quelle da mostrare: le scarta anche la plancia, appena si dice «No,
 * grazie» o si salva, senza aspettare che la casa lo ridica. */
export function leProposte() {
  const tutte = Array.isArray(state.proposte?.proposte) ? state.proposte.proposte : [];
  return proposteDaMostrare(tutte, { automazioni: leFormeDiCasa(), scartate: state.scartateQui });
}

const settimaneDellaStoria = () => Math.max(1, Math.round((state.proposte?.giorni || 21) / 7));

/* Le parole di una proposta: il QUANDO, l'ALLORA, il perche' e il nome che
 * avra' l'automazione. La casa manda la regola e i nomi; la frase la fa la
 * plancia, nella lingua di chi guarda. */
function paroleDi(p) {
  const d = p.dati || {};
  const a = p.automazione || {};
  const prima = a.allora?.[0] || {};
  const cose = Array.isArray(prima.entita) ? prima.entita : prima.entita ? [prima.entita] : [];
  const cosa = cose.length === 1 ? nomeDi(cose[0]) : "";
  const quante = cose.length;
  const area = clean(d.area);
  const nome = clean(d.nome);
  if (p.chiave === "movimentoLuce") {
    const luce = cosa;
    return {
      quando: t(
        `Quando c'è movimento in ${area} di notte`,
        `When there is motion in ${area} at night`,
      ),
      allora: t(
        `accendi ${luce} al 20%, spegni dopo 2 min`,
        `turn on ${luce} at 20%, off after 2 min`,
      ),
      perche: t(
        `in ${area} ci sono un sensore di movimento e una luce.`,
        `${area} has a motion sensor and a light.`,
      ),
      nome: t(`Luce col movimento in ${area}`, `Motion light in ${area}`),
    };
  }
  if (p.chiave === "finestraClima") {
    const finestra = clean(d.finestra);
    const clima = cosa || t(`${quante} climatizzatori`, `${quante} climate devices`);
    return {
      quando: t(`Quando ${finestra} resta aperta 2 min`, `When ${finestra} stays open 2 min`),
      allora: t(
        `spegni ${clima}, riaccendi quando la chiudi`,
        `turn off ${clima}, back on when you close it`,
      ),
      perche: t(
        `finestra e clima sono nella stessa stanza (${area}).`,
        `the window and the climate are in the same room (${area}).`,
      ),
      nome: t(`Clima spento con ${finestra} aperta`, `Climate off with ${finestra} open`),
    };
  }
  if (p.chiave === "umiditaAspiratore") {
    const aspiratore = clean(d.aspiratore) || cosa;
    return {
      quando: t(
        `Quando l'umidità in ${area} supera 70%`,
        `When humidity in ${area} goes above 70%`,
      ),
      allora: t(
        `accendi ${aspiratore}, spegnilo sotto 60%`,
        `turn on ${aspiratore}, off below 60%`,
      ),
      perche: t(
        `in ${area} ci sono un sensore di umidità e un aspiratore.`,
        `${area} has a humidity sensor and an extractor fan.`,
      ),
      nome: t(`Aspiratore con l'umidità in ${area}`, `Extractor fan with humidity in ${area}`),
    };
  }
  if (p.chiave === "elettrodomestico")
    return {
      quando: t(`Quando ${nome} ha finito`, `When ${nome} has finished`),
      allora: t("avvisami sul telefono", "notify me on the phone"),
      perche: t(
        `${nome} misura la potenza: si vede quando il ciclo finisce.`,
        `${nome} measures power: you can tell when the cycle ends.`,
      ),
      nome: t(`${nome}: ha finito`, `${nome}: finished`),
      avviso: t(`${nome} ha finito`, `${nome} has finished`),
    };
  if (p.chiave === "fuoriLuci" || p.chiave === "abitudineFuoriLuci") {
    const volte = Number(d.volte) || 0;
    return {
      quando: t("Quando tutti escono", "When everyone leaves"),
      allora:
        p.chiave === "fuoriLuci"
          ? t(`spegni ${quante} luci`, `turn off ${quante} lights`)
          : t("spegni le luci rimaste accese", "turn off the lights left on"),
      perche:
        p.chiave === "fuoriLuci"
          ? t(
              "in casa ci sono persone e luci: nessuna resta accesa per niente.",
              "the home knows its people and lights: none stays on for nothing.",
            )
          : t(
              `questa settimana ${volte} volte sono rimaste accese senza nessuno in casa.`,
              `this week they were left on ${volte} times with nobody home.`,
            ),
      nome: t("Tutti fuori: luci spente", "Everyone out: lights off"),
    };
  }
  if (p.chiave === "vuotaClima")
    return {
      quando: t("Quando la casa è vuota da 30 min", "When the home has been empty for 30 min"),
      allora: t("spegni il clima", "turn off the climate"),
      perche: t(
        "il clima acceso con la casa vuota scalda o rinfresca per nessuno.",
        "climate running in an empty home heats or cools for nobody.",
      ),
      nome: t("Casa vuota: clima spento", "Empty home: climate off"),
    };
  if (p.chiave === "antifurtoLuci")
    return {
      quando: t("Quando l'antifurto si inserisce", "When the alarm is armed"),
      allora: t("spegni le luci", "turn off the lights"),
      perche: t(
        "chi inserisce l'antifurto di solito esce: le luci si possono spegnere.",
        "whoever arms the alarm usually leaves: the lights can go off.",
      ),
      nome: t("Antifurto inserito: luci spente", "Alarm armed: lights off"),
    };
  if (p.chiave === "tramontoTapparelle" || p.chiave === "abitudineTramonto") {
    const tapparella = nome || cosa;
    return {
      quando: t("Al tramonto", "At sunset"),
      allora: tapparella
        ? t(`chiudi ${tapparella}`, `close ${tapparella}`)
        : t(`chiudi ${quante} tapparelle`, `close ${quante} shutters`),
      perche:
        p.chiave === "abitudineTramonto"
          ? t(
              "la chiudi a mano quasi ogni sera, poco dopo il tramonto.",
              "you close it by hand almost every evening, just after sunset.",
            )
          : t(
              "le tapparelle chiuse la sera tengono il caldo dentro e la casa riservata.",
              "shutters closed in the evening keep the warmth in and the home private.",
            ),
      nome: tapparella
        ? t(`${tapparella} al tramonto`, `${tapparella} at sunset`)
        : t("Tapparelle al tramonto", "Shutters at sunset"),
    };
  }
  /* L'abitudine a un orario. */
  const ora = clean(d.ora);
  const da = clean(d.da);
  const fino = clean(d.a);
  const settimane = Number(d.settimane) || settimaneDellaStoria();
  const tapparella = prima.tipo === "tapparella";
  const accende = d.verso === "accende";
  const quando = d.festivi
    ? t(`Alle ${ora} nel fine settimana`, `At ${ora} at the weekend`)
    : t(`Alle ${ora} nei giorni feriali`, `At ${ora} on weekdays`);
  const allora = tapparella
    ? accende
      ? t(`apri ${nome}`, `open ${nome}`)
      : t(`chiudi ${nome}`, `close ${nome}`)
    : accende
      ? t(`accendi ${nome}`, `turn on ${nome}`)
      : t(`spegni ${nome}`, `turn off ${nome}`);
  const perche = tapparella
    ? accende
      ? t(
          `l'hai aperta quasi ogni giorno fra ${da} e ${fino}, nelle ultime ${settimane} settimane.`,
          `you opened it almost every day between ${da} and ${fino}, over the last ${settimane} weeks.`,
        )
      : t(
          `l'hai chiusa quasi ogni giorno fra ${da} e ${fino}, nelle ultime ${settimane} settimane.`,
          `you closed it almost every day between ${da} and ${fino}, over the last ${settimane} weeks.`,
        )
    : accende
      ? t(
          `l'hai accesa quasi ogni giorno fra ${da} e ${fino}, nelle ultime ${settimane} settimane.`,
          `you turned it on almost every day between ${da} and ${fino}, over the last ${settimane} weeks.`,
        )
      : t(
          `l'hai spenta quasi ogni giorno fra ${da} e ${fino}, nelle ultime ${settimane} settimane.`,
          `you turned it off almost every day between ${da} and ${fino}, over the last ${settimane} weeks.`,
        );
  return { quando, allora, perche, nome: `${nome} · ${ora}` };
}

const disegnoDellaProposta = (p) =>
  p.chiave === "abitudineOrario" ? "automazioni" : clean(p.disegno) || "automazioni";

const perche = (testo) =>
  `<div class="pro-perche"><b>${esc(t("Perché:", "Why:"))}</b> ${esc(testo)}</div>`;

function tastiDellaProposta(p) {
  if (!puoScrivere()) return "";
  return `<div class="pro-tasti"><button type="button" class="pro-crea" data-au-crea="${esc(p.id)}">${esc(
    t("Crea", "Create"),
  )}</button><button type="button" class="pro-no" data-au-scarta="${esc(p.id)}">${esc(
    t("No, grazie", "No, thanks"),
  )}</button></div>`;
}

function cartaDellaProposta(p) {
  const w = paroleDi(p);
  return `<div class="pro-carta" data-au-proposta="${esc(p.id)}"><div class="pro-su"><span class="au-ico">${disegno(
    disegnoDellaProposta(p),
    `pro-${p.id}`,
  )}</span><div><div class="pro-q">${esc(w.quando)}</div><div class="pro-a"><span class="fr">→</span>${esc(
    w.allora,
  )}</div></div></div>${perche(w.perche)}${tastiDellaProposta(p)}</div>`;
}

const testaDelleProposte = (destra = "") =>
  `<div class="pro-testa"><h3>${esc(t("Suggerite per la tua casa ✨", "Suggested for your home ✨"))}</h3><small>${esc(
    t("dai tuoi dispositivi e da come li usi", "from your devices and how you use them"),
  )}</small>${destra}</div>`;

/* Il blocco nella lista: tre carte e «Vedi tutte». Nell'app scorrono di
 * lato, coi puntini. Senza proposte il blocco non c'e'. */
function bloccoDelleProposte() {
  const proposte = leProposte();
  if (!proposte.length) return "";
  const n = proposte.length;
  const tre = proposte.slice(0, 3);
  return `<div class="pro">${testaDelleProposte(
    `<button type="button" class="pro-tutte" data-au-vai="proposte">${esc(t(`Vedi tutte (${n})`, `See all (${n})`))} ›</button>`,
  )}<div class="pro-carte">${tre.map((p) => cartaDellaProposta(p)).join("")}</div>${
    tre.length > 1
      ? `<div class="pro-punti" aria-hidden="true">${tre.map((_p, i) => `<i${i === 0 ? ' class="si"' : ""}></i>`).join("")}</div>`
      : ""
  }</div>`;
}

function rigaDellaProposta(p) {
  const w = paroleDi(p);
  return `<div class="au-riga" data-au-proposta="${esc(p.id)}"><span class="au-ico">${disegno(
    disegnoDellaProposta(p),
    `pro-r-${p.id}`,
  )}</span><div class="au-frase"><div class="au-quando">${esc(w.quando)}</div><div class="au-allora"><span class="fr">→</span>${esc(
    w.allora,
  )}</div>${perche(w.perche)}</div>${tastiDellaProposta(p)}</div>`;
}

/* La pagina di tutte le proposte: prima i dispositivi, poi le abitudini. */
function pagineDelleProposte({ app }) {
  const proposte = leProposte();
  const dispositivi = proposte.filter((p) => p.gruppo === "dispositivi");
  const abitudini = proposte.filter((p) => p.gruppo === "abitudini");
  const n = proposte.length;
  const nd = dispositivi.length;
  const na = abitudini.length;
  const settimane = settimaneDellaStoria();
  const indietro = app
    ? ""
    : `<button type="button" class="au-indietro" data-au-vai="lista">‹ ${esc(t("Automazioni", "Automations"))}</button>`;
  const intro = n
    ? t(
        `${n} automazioni pensate per la tua casa. «Crea» le apre già compilate: le controlli e le salvi. «No, grazie» non le ripropone più.`,
        `${n} automations designed for your home. «Create» opens them already filled in: you check them and save. «No, thanks» never suggests them again.`,
      )
    : t(
        "Per ora nessuna proposta: quando la casa ne trova una, la vedi qui.",
        "No suggestions for now: when the home finds one, you'll see it here.",
      );
  return `${indietro}<p class="au-intro">${esc(intro)}</p>${
    nd
      ? `<div class="pro-gruppo">🔌 ${esc(t("Dai tuoi dispositivi", "From your devices"))} <small>· ${nd}</small></div><div class="au-lista pro-elenco">${dispositivi.map(rigaDellaProposta).join("")}</div>`
      : ""
  }${
    na
      ? `<div class="pro-gruppo">📈 ${esc(t("Dalle tue abitudini", "From your habits"))} <small>· ${na} · ${esc(
          t(`ultime ${settimane} settimane`, `last ${settimane} weeks`),
        )}</small></div><div class="au-lista pro-elenco">${abitudini.map(rigaDellaProposta).join("")}</div>`
      : ""
  }<div class="pro-fondo"><span>🏠</span><div>${esc(
    t(
      "Le proposte nascono in casa: l'add-on guarda i tuoi dispositivi e la loro storia, niente esce di casa.",
      "Suggestions are born at home: the add-on looks at your devices and their history, nothing leaves the home.",
    ),
  )}</div></div>`;
}

/* «Crea»: l'editor gia' compilato, con l'etichetta «Proposta ✨». Non si
 * salva niente: finche' non si preme Salva non parte niente. */
export function creaDallaProposta(id) {
  const p = leProposte().find((x) => x.id === id);
  if (!p) return false;
  const w = paroleDi(p);
  const automazione = structuredClone(p.automazione);
  if (p.chiave === "elettrodomestico" && w.avviso)
    automazione.allora = (automazione.allora || []).map((a) =>
      a.tipo === "notifica" ? { ...a, testo: w.avviso } : a,
    );
  apriBozza({ ...automazione, id: nuovoId(), nome: w.nome.slice(0, 60) });
  state.proposta = { id: p.id, perche: w.perche };
  return true;
}

const etichettaDellaProposta = () =>
  state.proposta
    ? `<div class="pro-etichetta"><span class="pro-pill">${esc(t("Proposta ✨", "Suggestion ✨"))}</span><small><b>${esc(
        t("Perché:", "Why:"),
      )}</b> ${esc(state.proposta.perche)} ${esc(
        t(
          "Controlla e salva: finché non la salvi in Home Assistant non parte niente.",
          "Check and save: nothing runs until you save it in Home Assistant.",
        ),
      )}</small></div>`
    : "";

/* «No, grazie»: sparisce subito, e la casa se lo ricorda per sempre. */
async function scartaLaProposta(id) {
  if (!id) return;
  state.scartateQui = [...new Set([...state.scartateQui, id])];
  ridisegna();
  try {
    const detto = await chiediAHomeAssistant(
      { type: "ponte/automazioni/proposte/scarta", proposta: id },
      15000,
    );
    if (detto && Array.isArray(detto.proposte)) state.proposte = detto;
  } catch (_errore) {
    /* La casa non ha risposto: qui resta scartata, e la prossima volta
     * che si apre la pagina tornera' a chiederlo. */
    root.edToast?.(
      t("La casa non ha risposto: riprova più tardi.", "The home did not answer: try again later."),
    );
  }
  ridisegna();
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
      [1, 2, 5, 10, 15, 30, 60, 120, 240, 720].map((m) => [m, m < 720 ? `${m} min` : "12 h"]),
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

/* ── la scheda di un'automazione di Home Assistant ──────────────────────── */

function indietroDellaScheda(app) {
  if (app) return "";
  const aiModelli = state.daModelli && !state.scheda;
  return `<button type="button" class="au-indietro" data-au-vai="${aiModelli ? "modelli" : "lista"}">‹ ${esc(
    aiModelli ? t("Modelli", "Templates") : t("Automazioni", "Automations"),
  )}</button>`;
}

/* La testa di una che c'e' gia': il nome, l'interruttore, «Esegui ora»,
 * «Duplica», «Elimina», la stanza e dove sta in Home Assistant. Il nome di
 * una semplice si salva col resto; quello di una complessa subito, da solo. */
function testaDellaScheda(v, { nome = null } = {}) {
  const cat = CATEGORIA()[categoriaDi(v)];
  const campoDelNome =
    nome === null
      ? `data-au-rinomina value="${esc(v.nome)}"${v.modificabile ? "" : " disabled"}`
      : `data-au-testo="nome" value="${esc(nome || "")}"`;
  const aree = Array.isArray(state.ponte?.aree) ? state.ponte.aree : [];
  return `<div class="ha-testa"><div class="ha-testa-su"><span class="au-ico">${disegno(cat[2], `testa-${v.entity_id}`)}</span><label class="ha-in"><input type="text" maxlength="100" ${campoDelNome} aria-label="${esc(
    t("Nome", "Name"),
  )}"><i aria-hidden="true">✎</i></label><button type="button" class="au-int" role="switch" aria-checked="${v.attiva}" data-au-attiva="${esc(
    v.entity_id,
  )}" aria-label="${esc(t("Attiva o spenta", "On or off"))}"><i></i></button></div>
<div class="ha-sotto"><button type="button" class="ha-tasto esegui" data-au-esegui="${esc(v.entity_id)}">▶ ${esc(
    t("Esegui ora", "Run now"),
  )}</button>${
    v.modificabile
      ? `<button type="button" class="ha-tasto" data-au-duplica>${esc(t("Duplica", "Duplicate"))}</button><button type="button" class="ha-tasto elimina" data-au-elimina>${esc(
          t("Elimina", "Delete"),
        )}</button>`
      : ""
  }<select class="ha-chip" data-au-area aria-label="${esc(t("Stanza", "Room"))}"><option value="">🏠 ${esc(
    t("Nessuna stanza", "No room"),
  )}</option>${aree
    .map((a) => `<option value="${esc(a.id)}"${a.id === v.areaId ? " selected" : ""}>🏠 ${esc(a.nome)}</option>`)
    .join("")}</select><span class="ha-dove">${etichettaDiOrigine(v)}${esc(t("in HA come", "in HA as"))} <code>${esc(
    v.entity_id,
  )}</code></span></div></div>`;
}

/* Il tasto Salva, l'errore, e dove andra' a finire. */
function piedeDelSalva(pulita) {
  const nome = clean(pulita?.nome) || t("la nuova automazione", "the new automation");
  return `${state.errore ? `<div class="au-errore" role="alert">${esc(state.errore)}</div>` : ""}
<button type="button" class="au-salva" data-au-salva${state.salvando ? " disabled" : ""}>💾 ${esc(
    state.salvando ? t("SALVO…", "SAVING…") : t("SALVA IN HOME ASSISTANT", "SAVE IN HOME ASSISTANT"),
  )}</button>
<div class="ha-salva-dove"><span aria-hidden="true">🏠</span><span>${esc(t("Si salva in", "It is saved in"))} <b>${esc(
    t("Home Assistant → Impostazioni → Automazioni", "Home Assistant → Settings → Automations"),
  )}</b>, ${esc(t("come", "as"))} <b>“${esc(nome)}”</b>${
    state.scheda && state.scheda.origine !== "gdahome"
      ? ""
      : ` ${esc(t("con l'etichetta", "labelled"))} <b>gdahome</b>`
  }. ${esc(t("La trovi lì e la esegue Home Assistant.", "You'll find it there and Home Assistant runs it."))}</span></div>`;
}

function righeDelRiassunto(righe) {
  return `<ul>${righe
    .map(
      (r) =>
        `<li${r.sub ? ' class="sub"' : ""}>${esc(r.testo)}${r.codice ? ` <code>${esc(r.codice)}</code>` : ""}</li>`,
    )
    .join("")}</ul>`;
}

/* Una complessa: il riassunto, e il resto in Home Assistant. */
function complessa({ app }) {
  const v = state.scheda;
  const r = v?.config ? riassuntoDi(v.config) : null;
  const blocco = (classe, colore, titolo, righe, nota = "") =>
    righe.length
      ? `<div class="ha-riep ${classe}" style="--c:${colore}"><div class="au-et">${esc(titolo)}${
          nota ? ` <small>· ${esc(nota)}</small>` : ""
        }</div>${righeDelRiassunto(righe)}</div>`
      : "";
  const corpo = r
    ? `${blocco("q", "#0ea5e9", t("Quando", "When"), r.quando, r.quando.length > 1 ? t("una di queste", "any of these") : "")}${blocco(
        "s",
        "#8b5cf6",
        t("Solo se", "Only if"),
        r.soloSe,
      )}${blocco("a", "#16a34a", t("Allora", "Then do"), r.allora)}`
    : "";
  const perche = !v?.modificabile
    ? t(
        "Questa automazione sta in un file di Home Assistant: qui la accendi, la spegni e la esegui, e si cambia lì.",
        "This automation lives in a Home Assistant file: here you turn it on, off and run it, and it is changed there.",
      )
    : t(
        "Questa automazione usa funzioni avanzate (una scelta fra casi, un template, un blueprint…): qui puoi accenderla, spegnerla, eseguirla, rinominarla e cambiarle stanza. Per il resto:",
        "This automation uses advanced features (a choice between cases, a template, a blueprint…): here you can turn it on and off, run it, rename it and change its room. For the rest:",
      );
  const link = v?.id && !nellApp()
    ? `<a class="ha-apri" href="${esc(indirizzoInHA(v.id))}" target="_top" rel="noopener">${esc(t("Apri in Home Assistant ↗", "Open in Home Assistant ↗"))}</a>`
    : "";
  return `${indietroDellaScheda(app)}${v ? testaDellaScheda(v) : ""}${corpo}<div class="ha-av"><span class="i" aria-hidden="true">ℹ️</span><div>${esc(perche)}${
    link ? `<br>${link}` : ""
  }</div></div>${state.errore ? `<div class="au-errore" role="alert">${esc(state.errore)}</div>` : ""}`;
}

/* «Eliminare?»: si chiede sopra la pagina, con le parole di Home Assistant. */
const ID_DELLA_CONFERMA = "au-conferma";
export function apriLaConferma(v) {
  if (!doc?.body || !v) return;
  doc.getElementById(ID_DELLA_CONFERMA)?.remove();
  const velo = doc.createElement("div");
  velo.id = ID_DELLA_CONFERMA;
  velo.className = "ha-velo";
  velo.innerHTML = `<div class="ha-conferma" role="alertdialog" aria-modal="true"><h4>${esc(
    t(`Eliminare «${v.nome}»?`, `Delete «${v.nome}»?`),
  )}</h4><p>${esc(
    t(
      "Si toglie anche da Home Assistant, e non si può annullare. Se vuoi solo fermarla, spegnila con l'interruttore.",
      "It is removed from Home Assistant too, and it cannot be undone. If you only want to stop it, turn it off with the switch.",
    ),
  )}</p><div><button type="button" data-au-conferma-no>${esc(t("Annulla", "Cancel"))}</button><button type="button" class="r" data-au-conferma-si>${esc(
    t("Elimina", "Delete"),
  )}</button></div></div>`;
  doc.body.append(velo);
  state.conferma = v;
}

function editor({ app }) {
  const b = state.bozza;
  const q = b.quando;
  const pulita = pulitaDallaBozza(b);
  const v = state.scheda;
  return `${indietroDellaScheda(app)}${
    v
      ? testaDellaScheda(v, { nome: b.nome })
      : `<label class="au-nome">${esc(t("Nome", "Name"))} <input type="text" maxlength="60" data-au-testo="nome" value="${esc(b.nome || "")}" placeholder="${esc(t("Come la chiami", "What you call it"))}"></label>`
  }${etichettaDellaProposta()}
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
${piedeDelSalva(pulita)}`;
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
  const giorni = iniziali();
  return `${indietroDellaScheda(app)}${
    state.scheda
      ? testaDellaScheda(state.scheda, { nome: b.nome })
      : `<label class="au-nome">${esc(t("Nome", "Name"))} <input type="text" maxlength="60" data-au-testo="nome" value="${esc(b.nome || "")}"></label>`
  }
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
${piedeDelSalva(automazionePulita(b))}`;
}

/* ── la pagina ───────────────────────────────────────────────────────────── */

function titoloDellaVista() {
  if (state.vista === "modelli") return t("Nuova automazione", "New automation");
  if (state.vista === "proposte")
    return state.inApp
      ? t("Proposte", "Suggestions")
      : t("Proposte per la tua casa", "Suggestions for your home");
  if (state.vista === "complessa") return state.scheda?.nome || t("Automazione", "Automation");
  if (state.vista === "editor" || state.vista === "crono") {
    if (state.scheda) return state.bozza?.nome || state.scheda.nome || t("Automazione", "Automation");
    return state.vista === "crono"
      ? t("Cronotermostato", "Thermostat schedule")
      : t("Nuova automazione", "New automation");
  }
  return t("Automazioni", "Automations");
}

/* Sotto il velo: la lista vera, sfocata e senza tocchi; se la casa non ne
 * ha, i modelli. */
function sottoIlVelo() {
  const elenco = automazioniDiCasa();
  return elenco.length
    ? `${barraDellaLista(elenco, { chiuso: true })}<div class="ha-tutte">${gruppiHtml(elenco)}</div>`
    : modelli();
}

export function paginaHtml({ app = false } = {}) {
  if (!state.bozza && (state.vista === "editor" || state.vista === "crono")) state.vista = "lista";
  if (!state.scheda && state.vista === "complessa") state.vista = "lista";
  const premium = state.premium !== false;
  /* Nell'app la lista e il velo li disegna la sezione della dashboard: la
   * pagina dell'app e' la stessa faccia, con «＋ Nuova» in piu'. */
  if (app && (state.vista === "lista" || !premium) && state.listaDellApp) return state.listaDellApp();
  let dentro;
  if (!premium) dentro = velo(sottoIlVelo());
  else if (state.vista === "proposte") dentro = pagineDelleProposte({ app });
  else if (state.vista === "modelli")
    dentro = `${app ? "" : `<button type="button" class="au-indietro" data-au-vai="lista">‹ ${esc(t("Automazioni", "Automations"))}</button>`}${modelli()}`;
  else if (state.vista === "editor") dentro = editor({ app });
  else if (state.vista === "crono") dentro = crono({ app });
  else if (state.vista === "complessa") dentro = complessa({ app });
  else dentro = lista();
  if (!app)
    return `<div class="au au-web">${state.vista === "lista" || !premium ? `${interruttoreDellaSezione()}${INTRO()}` : ""}${dentro}</div>`;
  const aiModelli = state.vista !== "modelli" && state.daModelli && !state.scheda;
  const testa =
    state.vista === "lista" || !premium
      ? `<div class="au-titolo"><h1>${esc(t("Automazioni", "Automations"))}</h1><span class="au-prem">PREMIUM</span></div>`
      : `<button type="button" class="au-indietro" data-au-vai="${aiModelli ? "modelli" : "lista"}">‹ ${esc(
          aiModelli ? t("Modelli", "Templates") : t("Automazioni", "Automations"),
        )}</button><div class="au-titolo"><h1>${esc(titoloDellaVista())}</h1></div>`;
  return `<div class="au au-app">${testa}${dentro}</div>`;
}

function contenitore() {
  if (state.inApp) return doc?.getElementById?.(ID_PAGINA) || null;
  if (schedaAttiva() === AUTOMAZIONI_TAB) return doc?.getElementById?.("ed-body") || null;
  return null;
}

/* Il campo sotto le dita: dopo un ridisegno si torna li', col cursore dov'era. */
function campoAttivo() {
  const attivo = doc.activeElement;
  const d = attivo?.dataset || {};
  const quale =
    d.auTesto !== undefined
      ? `[data-au-testo="${CSS.escape(d.auTesto)}"]`
      : d.auCerca !== undefined
        ? "[data-au-cerca]"
        : d.auRinomina !== undefined
          ? "[data-au-rinomina]"
          : d.aucCerca !== undefined
            ? "[data-auc-cerca]"
            : "";
  return quale ? { quale, cursore: attivo.selectionStart ?? null } : null;
}

function rimettiIlCampo(dove, campo) {
  if (!campo) return;
  const nuovo = dove.querySelector(campo.quale);
  nuovo?.focus?.();
  if (campo.cursore !== null) {
    try {
      nuovo?.setSelectionRange?.(campo.cursore, campo.cursore);
    } catch (_errore) {}
  }
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
  if (dove.dataset.auScritto !== html || !dove.firstElementChild) {
    const campo = campoAttivo();
    if (app) dove.innerHTML = html;
    else {
      dove
        .querySelectorAll(":scope > .au, :scope > :not(.dm-alberatura-titolo)")
        .forEach((n) => n.remove());
      dove.insertAdjacentHTML("beforeend", html);
    }
    dove.dataset.auScritto = html;
    dove.dataset.renderer = AUTOMAZIONI_TAB;
    /* Chi stava scrivendo resta li': il ridisegno non gli ruba la casella
     * sotto le dita. */
    rimettiIlCampo(dove, campo);
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

/** La lista della pagina dell'app: la presta la sezione della dashboard. */
export function prestaLaListaDellApp(disegna) {
  state.listaDellApp = typeof disegna === "function" ? disegna : null;
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

function apriBozza(bozza, { daModelli = false, scheda = null } = {}) {
  state.bozza = structuredClone(bozza);
  state.scheda = scheda;
  state.salvata = null;
  state.proposta = null;
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

/**
 * Apre un'automazione di Home Assistant: l'editor se e' semplice, la scheda
 * col riassunto se e' complessa.
 */
export function apriPerModificare(voce) {
  if (!voce) return false;
  state.errore = "";
  state.salvata = null;
  if (voce.modello && voce.modificabile) apriBozza(voce.modello, { scheda: voce });
  else {
    state.bozza = null;
    state.scheda = voce;
    state.vista = "complessa";
  }
  return true;
}

const voceDi = (entity) => automazioniDiCasa().find((v) => v.entity_id === entity) || null;

const perCheNo = (errore) =>
  clean(errore?.message) || t("la casa non ha risposto", "the home did not answer");

async function salva() {
  if (state.salvando) return false;
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
  state.salvando = true;
  state.errore = "";
  ridisegna();
  try {
    const fatto = await scriviInCasa({
      type: "ponte/automazioni/salva",
      automazione: pulita,
      automazione_id: state.scheda?.id || "",
    });
    /* Una proposta salvata non si ripropone: lo dira' anche la casa, appena
     * rilegge l'elenco. */
    if (state.proposta?.id) state.scartateQui = [...new Set([...state.scartateQui, state.proposta.id])];
    state.salvata = { nome: clean(fatto?.alias) || pulita.nome, id: clean(fatto?.id) };
    state.bozza = null;
    state.scheda = null;
    state.proposta = null;
    state.vista = "lista";
    state.daModelli = false;
    root.edToast?.(t("💾 Salvata in Home Assistant", "💾 Saved in Home Assistant"));
    rileggiPresto();
  } catch (errore) {
    const no = perCheNo(errore);
    state.errore = t(
      `Home Assistant non l'ha salvata: ${no}`,
      `Home Assistant did not save it: ${no}`,
    );
  } finally {
    state.salvando = false;
    ridisegna();
  }
  return true;
}

async function eliminaDavvero() {
  const v = state.conferma;
  state.conferma = null;
  doc.getElementById(ID_DELLA_CONFERMA)?.remove();
  if (!v?.id) return;
  try {
    await scriviInCasa({ type: "ponte/automazioni/elimina", automazione_id: v.id });
    root.edToast?.(t(`🗑 «${v.nome}» eliminata`, `🗑 «${v.nome}» deleted`));
    state.bozza = null;
    state.scheda = null;
    state.vista = "lista";
    rileggiPresto();
  } catch (errore) {
    const no = perCheNo(errore);
    state.errore = t(`Non si è eliminata: ${no}`, `It was not deleted: ${no}`);
  }
  ridisegnaTutto();
}

async function duplica(v = state.scheda) {
  if (!v?.id) return;
  try {
    const fatto = await scriviInCasa({ type: "ponte/automazioni/duplica", automazione_id: v.id });
    const copia = clean(fatto?.alias);
    root.edToast?.(t(`📄 Copiata: «${copia}»`, `📄 Copied: «${copia}»`));
    rileggiPresto();
  } catch (errore) {
    const no = perCheNo(errore);
    state.errore = t(`Non si è copiata: ${no}`, `It was not copied: ${no}`);
    ridisegna();
  }
}

/** «Duplica», dalla carta della pagina dell'app. */
export const duplicaInCasa = (v) => duplica(v);

/* Il nome di una complessa, o la stanza di qualunque: subito, da soli. */
async function rinomina({ nome, area } = {}) {
  const v = state.scheda;
  if (!v?.id) return;
  try {
    await scriviInCasa({
      type: "ponte/automazioni/rinomina",
      automazione_id: v.id,
      ...(nome !== undefined ? { nome } : {}),
      ...(area !== undefined ? { area } : {}),
    });
    if (nome !== undefined) state.scheda = { ...v, nome };
    if (area !== undefined) {
      const stanza = (state.ponte?.aree || []).find((a) => a.id === area);
      state.scheda = { ...state.scheda, areaId: area, area: stanza?.nome || "" };
    }
    root.edToast?.(t("✓ Fatto", "✓ Done"));
    rileggiPresto();
  } catch (errore) {
    const no = perCheNo(errore);
    state.errore = t(`Non si è cambiata: ${no}`, `It was not changed: ${no}`);
  }
  ridisegna();
}

/* Le automazioni della versione di prova, scritte in Home Assistant una per
 * una; quelle andate si tolgono dalla plancia, quelle no restano. */
async function converti() {
  const rimaste = rimasteNellaPlancia();
  const restano = [];
  for (const a of rimaste) {
    try {
      await scriviInCasa({ type: "ponte/automazioni/salva", automazione: a, automazione_id: "" });
    } catch (_errore) {
      restano.push(a);
    }
  }
  writeJsonIfChanged(CHIAVE_AUTOMAZIONI, restano);
  const fatte = rimaste.length - restano.length;
  const no = restano.length;
  root.edToast?.(
    restano.length
      ? t(`🔁 ${fatte} convertite, ${no} no: riprova`, `🔁 ${fatte} converted, ${no} not: try again`)
      : t(`🔁 ${fatte} convertite in Home Assistant`, `🔁 ${fatte} converted into Home Assistant`),
  );
  rileggiPresto();
  ridisegna();
}

/* ── i tocchi ────────────────────────────────────────────────────────────── */

function dentroDiNoi(event) {
  const dove = contenitore();
  return dove && dove.contains(event.target) && event.target.closest?.(".au") ? dove : null;
}

/* I tocchi sulle finestre che stanno sopra la pagina, fuori da `.au`: la
 * finestra «Premium arriva con le app» e «Eliminare?». */
function toccoSopra(event) {
  const chiudi = event.target.closest?.("[data-au-store-chiudi]");
  if (chiudi && (chiudi.id !== ID_DELLO_STORE || event.target === chiudi)) {
    event.preventDefault();
    chiudiLoStore();
    return true;
  }
  if (event.target.closest?.(`#${ID_DELLO_STORE}`)) return true;
  if (event.target.closest?.("[data-au-conferma-si]")) {
    event.preventDefault();
    void eliminaDavvero();
    return true;
  }
  const conferma = doc.getElementById(ID_DELLA_CONFERMA);
  if (conferma && (event.target.closest?.("[data-au-conferma-no]") || event.target === conferma)) {
    event.preventDefault();
    conferma.remove();
    state.conferma = null;
    return true;
  }
  return Boolean(conferma?.contains(event.target));
}

function onClick(event) {
  if (toccoSopra(event)) return;
  const dove = dentroDiNoi(event);
  if (!dove) {
    if (state.tendina) {
      state.tendina = false;
      ridisegna();
    }
    return;
  }
  const el = event.target.closest(
    "[data-au-vai],[data-au-modello],[data-au-attiva],[data-au-apri],[data-au-tendina],[data-au-quando],[data-au-togli],[data-au-aggiungi],[data-au-giorno],[data-au-salva],[data-au-elimina],[data-au-gradi],[data-au-finestra],[data-au-scopri],[data-au-tendina-altro],[data-au-avanzate],[data-au-crea],[data-au-scarta],[data-au-per],[data-aug-apri],[data-au-esegui],[data-au-duplica],[data-au-converti]",
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
    scopriPremium();
    return;
  }
  if (state.premium === false) return;
  event.preventDefault();
  if (d.auAttiva) {
    event.stopPropagation();
    const v = voceDi(d.auAttiva);
    if (v) {
      alternaInCasa(v);
      if (state.scheda?.entity_id === v.entity_id) state.scheda = { ...state.scheda, attiva: !v.attiva };
      ridisegna();
    }
    return;
  }
  if (d.auEsegui) {
    eseguiOra(voceDi(d.auEsegui) || state.scheda);
    return;
  }
  if (d.auDuplica !== undefined) {
    void duplica();
    return;
  }
  if (d.auConverti !== undefined) {
    void converti();
    return;
  }
  if (d.auScarta) {
    void scartaLaProposta(d.auScarta);
    return;
  }
  if (d.auPer) {
    state.per = RAGGRUPPA.includes(d.auPer) ? d.auPer : "categoria";
  } else if (d.augApri) {
    alternaIlGruppo(d.augApri);
  } else if (d.auVai) {
    state.vista = d.auVai;
    state.salvata = null;
    if (d.auVai === "lista" || d.auVai === "proposte" || d.auVai === "modelli") {
      state.bozza = null;
      state.scheda = null;
      state.proposta = null;
      state.errore = "";
    }
    state.tendina = false;
  } else if (d.auCrea) creaDallaProposta(d.auCrea);
  else if (d.auModello) apriBozza(bozzaDelModello(d.auModello), { daModelli: true });
  else if (d.auApri) apriPerModificare(voceDi(d.auApri));
  else if (d.auTendinaAltro !== undefined) state.tendinaAltro = !state.tendinaAltro;
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
    void salva();
    return;
  } else if (d.auElimina !== undefined) {
    apriLaConferma(state.scheda);
    return;
  }
  ridisegna();
  /* Una vista nuova si apre dall'alto. */
  if (d.auApri || d.auVai || d.auModello || d.auCrea) {
    if (state.inApp) doc.getElementById(ID_PAGINA)?.scrollIntoView?.({ block: "start" });
    else contenitore()?.scrollTo?.(0, 0);
  }
}

function onChange(event) {
  if (!dentroDiNoi(event)) return;
  const dati = event.target?.dataset || {};
  if (dati.auArea !== undefined) {
    void rinomina({ area: event.target.value });
    return;
  }
  if (dati.auRinomina !== undefined) {
    const nome = clean(event.target.value);
    if (nome && nome !== state.scheda?.nome) void rinomina({ nome });
    return;
  }
  const via = dati.auCampo;
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
  /* La ricerca: si ridisegnano solo i gruppi, e la casella resta dov'e'. */
  if (event.target?.dataset?.auCerca !== undefined) {
    state.cerca = event.target.value;
    const tutte = contenitore()?.querySelector?.(".ha-tutte");
    if (tutte) tutte.innerHTML = gruppiHtml(automazioniDiCasa());
    return;
  }
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
  if (event.key === "Escape") {
    chiudiLoStore();
    doc.getElementById(ID_DELLA_CONFERMA)?.remove();
    state.conferma = null;
    return;
  }
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
      state.scheda = null;
    }
    return false;
  }
  if (state.premium === null && !state.chiedendo) void chiediAllaCasa({ forza: true });
  return ridisegna();
}

/** Va a una vista della pagina (la lista, i modelli, le proposte). */
export function vaiA(vista) {
  state.vista = vista;
  state.bozza = null;
  state.scheda = null;
  state.proposta = null;
  state.salvata = null;
  state.errore = "";
  ridisegna();
  if (state.inApp) root.scrollTo?.(0, 0);
}

/**
 * Apre il config sulle Automazioni — la lista, le proposte, o una aperta —
 * dalla sezione della dashboard, che si guarda e non si modifica. La voce
 * del config arriva quando il config si e' disegnato: la si aspetta un poco.
 */
export function apriNelConfig({ voce = null, vista = "lista" } = {}) {
  if (typeof root.apriConfigEntita !== "function") return false;
  root.apriConfigEntita();
  let volte = 0;
  const prova = () => {
    const voceDelConfig = doc.querySelector(`#editor-modal .ed-tab[data-tab="${AUTOMAZIONI_TAB}"]`);
    if (!voceDelConfig) {
      if ((volte += 1) < 40) root.setTimeout?.(prova, 50);
      return;
    }
    root.editorSwitch?.(AUTOMAZIONI_TAB);
    vaiA(vista);
    if (voce) apriPerModificare(voce);
    ridisegna();
  };
  prova();
  return true;
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
  state.scheda = null;
  state.salvata = null;
  ridisegna();
  void chiediAllaCasa({ forza: true });
  root.scrollTo?.(0, 0);
  diciAllApp("automazioni");
  return true;
}

function chiudiLaPagina() {
  state.inApp = false;
  state.bozza = null;
  state.scheda = null;
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
.au .au-velo .au-prem{margin-top:6px;font-size:10.5px;letter-spacing:.12em;padding:3px 10px;border-radius:999px}
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
.au .pro{margin:16px 0 4px}
.au .pro-testa{display:flex;align-items:baseline;gap:10px;margin:0 2px 8px}
.au .pro-testa h3{margin:0;font-size:15px;font-weight:900;text-transform:none;letter-spacing:0;font-family:inherit;color:var(--au-tx)}
.au .pro-testa small{font-size:12px;font-weight:600;color:var(--au-dim)}
.au .pro-tutte{margin-left:auto;border:0;background:none;padding:0;color:#0284c7;font-weight:900;font-size:13px;white-space:nowrap;cursor:pointer;font-family:inherit}
html[data-theme="dark"] .au .pro-tutte{color:#7dd3fc}
.au .pro-carte{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.au .pro-carta{position:relative;display:flex;flex-direction:column;gap:9px;padding:14px;border-radius:16px;border:1px solid color-mix(in srgb,#f59e0b 38%,var(--au-bordo));background:linear-gradient(160deg,color-mix(in srgb,#f59e0b 8%,var(--au-carta)),var(--au-carta) 60%);min-width:0}
.au .pro-su{display:flex;gap:11px;align-items:flex-start}
.au .pro-carta .au-ico{width:40px;height:40px;flex:none}
.au .pro-q{font-size:13.5px;font-weight:900;line-height:1.3;color:var(--au-tx)}
.au .pro-a{font-size:13px;font-weight:700;line-height:1.35;margin-top:2px;color:var(--au-tx)}
.au .pro-a .fr{color:#0ea5e9;font-weight:900;margin-right:5px}
.au .pro-perche{font-size:12px;line-height:1.45;font-weight:600;color:var(--au-dim);padding:7px 9px;border-radius:10px;background:var(--au-tenue)}
.au .pro-perche b{color:var(--au-tx);font-weight:800}
.au .pro-tasti{display:flex;gap:8px;margin-top:auto}
.au .pro-crea{flex:1;border:0;border-radius:11px;padding:9px 12px;background:var(--au-tx);color:var(--au-carta);font-weight:900;font-size:13px;cursor:pointer;font-family:inherit}
.au .pro-no{border:1px solid var(--au-bordo);border-radius:11px;padding:9px 12px;background:none;color:var(--au-dim);font-weight:800;font-size:13px;cursor:pointer;font-family:inherit}
.au .pro-gruppo{margin:16px 2px 8px;font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--au-dim);display:flex;gap:8px;align-items:center}
.au .pro-gruppo small{text-transform:none;letter-spacing:0;font-weight:600;font-size:12px}
.au .pro-elenco .au-riga{align-items:flex-start;cursor:default}
.au .pro-elenco .pro-perche{margin-top:6px;padding:5px 8px;display:inline-block}
.au .pro-elenco .pro-tasti{flex-direction:column;margin:0;gap:6px;flex:none}
.au .pro-elenco .pro-crea,.au .pro-elenco .pro-no{padding:7px 14px;font-size:12.5px}
.au .pro-fondo{display:flex;gap:12px;align-items:center;margin:18px 0 0;padding:14px 16px;border-radius:14px;background:color-mix(in srgb,#16a34a 8%,transparent);border:1px solid color-mix(in srgb,#16a34a 28%,transparent);font-size:13px;line-height:1.5;font-weight:700;color:var(--au-tx)}
.au .pro-fondo span{font-size:22px}
.au .pro-etichetta{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 12px;padding:10px 12px;border-radius:14px;border:1px solid color-mix(in srgb,#f59e0b 40%,var(--au-bordo));background:color-mix(in srgb,#f59e0b 8%,var(--au-carta))}
.au .pro-etichetta .pro-pill{font-size:11px;font-weight:900;letter-spacing:.06em;padding:3px 9px;border-radius:999px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff}
.au .pro-etichetta small{font-size:12.5px;font-weight:600;color:var(--au-dim);line-height:1.4;flex:1;min-width:200px}
.au .pro-etichetta small b{color:var(--au-tx)}
.au .pro-punti{display:none}
.au-app .pro-punti{display:flex;justify-content:center;gap:6px;margin-top:10px}
.au-app .pro-punti i{width:7px;height:7px;border-radius:50%;background:color-mix(in srgb,var(--au-tx) 20%,transparent);transition:width .2s}
.au-app .pro-punti i.si{width:18px;border-radius:4px;background:#f59e0b}
.au-app .pro-carte{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;gap:10px;margin-right:-14px;padding-right:14px}
.au-app .pro-carte::-webkit-scrollbar{display:none}
.au-app .pro-carta{flex:0 0 82%;scroll-snap-align:start}
.au-app .pro-testa{flex-wrap:wrap}
.au-app .pro-testa small{order:3;width:100%}
.au-app .pro-elenco .au-riga{flex-wrap:wrap}
.au-app .pro-elenco .pro-tasti{flex-direction:row;width:100%;padding-left:55px}
.au-app .pro-elenco .pro-crea{flex:1}
/* La lista di Home Assistant, a gruppi. */
.au .ha-barra{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:18px 0 10px}
.au .ha-barra h3{margin:0;font-size:15px;font-weight:900;text-transform:none;letter-spacing:0;font-family:inherit;color:var(--au-tx)}
.au .ha-barra h3 small{font-weight:700;color:var(--au-dim);font-size:12.5px;margin-left:4px}
.au .ha-seg{display:inline-flex;padding:3px;border-radius:11px;border:1px solid var(--au-bordo);background:var(--au-carta)}
.au .ha-seg button{border:0;background:none;padding:6px 11px;border-radius:8px;font-size:12px;font-weight:800;color:var(--au-dim)}
.au .ha-seg button.si{background:var(--au-tx);color:var(--au-carta)}
.au .ha-cerca{flex:1;min-width:170px;max-width:320px;display:flex;align-items:center;gap:8px;padding:0 12px;border-radius:11px;border:1px solid var(--au-bordo);background:var(--au-carta);font-size:13px;color:var(--au-dim)}
.au .ha-cerca input{flex:1;min-width:0;border:0;background:none;outline:none;padding:8px 0;font:inherit;font-weight:600;color:var(--au-tx)}
.au .ha-barra .au-piu{margin-left:auto}
.au .au-piu.chiuso{background:var(--au-tenue);color:var(--au-dim);cursor:default}
.au .ha-tutte{margin-top:4px}
/* I gruppi in righe compatte: gli stessi nella dashboard, nell'app e qui. */
.aug-griglia{--aug-carta:var(--card-bg,#fff);--aug-bordo:var(--divider-color,#e2e8f0);--aug-tx:var(--text,#0f172a);--aug-dim:var(--secondary-text-color,#64748b);display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr));gap:14px;align-items:start;min-width:0}
.aug{min-width:0;border:1px solid var(--aug-bordo);border-radius:20px;background:var(--aug-carta);box-shadow:0 12px 28px -24px rgba(15,23,42,.45);overflow:hidden}
.aug-testa{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:10px;width:100%;padding:11px 14px;cursor:pointer;font-family:inherit;color:var(--aug-tx)}
.aug-testa:focus-visible{outline:2px solid var(--c);outline-offset:-2px;border-radius:20px}
.aug-freccia{width:14px;flex:none;text-align:center;font-size:13px;line-height:1;color:var(--aug-dim)}
.aug-ico{width:32px;height:32px;flex:none;border-radius:10px;display:grid;place-items:center;background:color-mix(in srgb,var(--c) 15%,transparent)}
.aug-ico svg{width:22px;height:22px}
.aug-titolo{flex:1;min-width:0;font-size:15px;font-weight:800;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.aug-conta{flex:none;font-size:11.5px;font-weight:900;padding:2px 9px;border-radius:999px;color:var(--aug-dim);background:color-mix(in srgb,var(--aug-tx) 7%,transparent);font-variant-numeric:tabular-nums}
.aug-conta[data-on="true"]{color:color-mix(in srgb,var(--c) 78%,#000);background:color-mix(in srgb,var(--c) 15%,transparent)}
html[data-theme="dark"] .aug-conta[data-on="true"]{color:color-mix(in srgb,var(--c) 65%,#fff)}
.aug-righe{border-top:1px solid var(--aug-bordo)}
.aug-riga{display:flex;align-items:center;gap:11px;min-width:0;padding:9px 14px;border-top:1px solid var(--aug-bordo)}
.aug-riga:first-child{border-top:0}
.aug-riga[role="button"]{cursor:pointer}
.aug-riga[role="button"]:hover{background:color-mix(in srgb,var(--aug-tx) 4%,transparent)}
.aug-orb{width:32px;height:32px;flex:none;border-radius:50%;display:grid;place-items:center;background:color-mix(in srgb,var(--c) 14%,transparent)}
.aug-orb svg{width:22px;height:22px}
.aug-testo{flex:1;min-width:0;display:grid;gap:1px}
.aug-nome{display:flex;align-items:center;gap:6px;min-width:0;font-size:14px;font-weight:800;line-height:1.3;color:var(--aug-tx)}
.aug-nome>span{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.aug-nome>.ha-orig{flex:none;margin:0}
.aug-fr{font-size:12px;font-weight:600;line-height:1.35;color:var(--aug-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.aug-quando{flex:none;font-size:11.5px;font-weight:700;color:var(--aug-dim);white-space:nowrap;font-variant-numeric:tabular-nums}
.aug-int{flex:none;position:relative;width:40px;height:24px;border:0;padding:0;border-radius:999px;background:color-mix(in srgb,var(--aug-tx) 18%,transparent);cursor:pointer;transition:background .15s ease}
.aug-int[aria-checked="true"]{background:var(--c-acceso,var(--c))}
.aug-int::after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(15,23,42,.35);transition:transform .15s ease}
.aug-int[aria-checked="true"]::after{transform:translateX(16px)}
.aug-riga.spenta .aug-nome{color:var(--aug-dim)}
.aug-riga.spenta .aug-orb{filter:grayscale(1);opacity:.6}
.aug.chiuso .aug-righe{display:none}
/* Nel config la pagina e' piu' stretta: due colonne larghe invece di tre strette. */
.au .aug-griglia{grid-template-columns:repeat(auto-fill,minmax(min(100%,420px),1fr))}
/* Al telefono la riga in parole va a capo, al piu' due righe, e l'ora
 * dell'ultima volta lascia il posto (sta nel foglio). */
@media (max-width:560px){
  .aug-griglia{gap:12px}
  .aug-fr{white-space:normal;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2}
  .aug-quando{display:none}
}
.au .ha-orig{display:inline-block;margin-left:6px;vertical-align:1px;font-size:10px;font-weight:800;letter-spacing:.02em;padding:1px 7px;border-radius:6px;border:1px solid var(--au-bordo);color:var(--au-dim)}
.au .ha-orig.g{color:#0284c7;border-color:color-mix(in srgb,#0ea5e9 45%,transparent);background:color-mix(in srgb,#0ea5e9 8%,transparent)}
html[data-theme="dark"] .au .ha-orig.g{color:#7dd3fc}
.au .ha-orig.b{color:#7c3aed;border-color:color-mix(in srgb,#8b5cf6 45%,transparent);background:color-mix(in srgb,#8b5cf6 8%,transparent)}
html[data-theme="dark"] .au .ha-orig.b{color:#c4b5fd}
.au .ha-ok{display:flex;align-items:center;gap:12px;margin:0 0 14px;padding:12px 14px;border-radius:14px;border:1px solid color-mix(in srgb,#16a34a 40%,var(--au-bordo));background:color-mix(in srgb,#16a34a 9%,var(--au-carta));font-size:13px;font-weight:700;color:var(--au-tx)}
.au .ha-ok .s{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:#16a34a;color:#fff;font-weight:900;flex:none}
.au .ha-ok small{display:block;font-weight:600;color:var(--au-dim);font-size:12px;margin-top:1px}
.au .ha-ok .ha-link,.au .ha-link{margin-left:auto;color:#0284c7;font-weight:900;font-size:12.5px;white-space:nowrap;text-decoration:none}
html[data-theme="dark"] .au .ha-link{color:#7dd3fc}
.au .ha-converti{display:flex;align-items:center;gap:12px;margin:0 0 14px;padding:12px 14px;border-radius:14px;border:1px solid color-mix(in srgb,#7c3aed 35%,var(--au-bordo));background:color-mix(in srgb,#7c3aed 7%,var(--au-carta));font-size:13px;color:var(--au-tx)}
.au .ha-converti>span{font-size:20px}
.au .ha-converti b{display:block;font-weight:900}
.au .ha-converti small{display:block;font-weight:600;color:var(--au-dim);font-size:12px;margin-top:2px;line-height:1.4}
.au .ha-converti button{margin-left:auto;flex:none;border:0;border-radius:11px;padding:9px 14px;background:#7c3aed;color:#fff;font-weight:900;font-size:13px}
/* La scheda di una che c'e' gia'. */
.au .ha-testa{border:1px solid var(--au-bordo);border-radius:16px;background:var(--au-carta);padding:12px 14px;margin:0 0 12px}
.au .ha-testa-su{display:flex;align-items:center;gap:12px}
.au .ha-testa-su .au-ico{width:46px;height:46px}
.au .ha-in{flex:1;min-width:0;display:flex;align-items:center;gap:8px;padding:0 12px;border-radius:11px;border:1px solid var(--au-bordo)}
.au .ha-in input{flex:1;min-width:0;border:0;background:none;outline:none;padding:8px 0;font:inherit;font-size:16px;font-weight:900;color:var(--au-tx)}
.au .ha-in i{font-style:normal;font-size:13px;color:var(--au-dim)}
.au .ha-sotto{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:10px}
.au .ha-tasto{border:1px solid var(--au-bordo);background:var(--au-carta);border-radius:11px;padding:8px 13px;font-weight:800;font-size:12.5px;color:var(--au-tx)}
.au .ha-tasto.esegui{border-color:color-mix(in srgb,#16a34a 45%,var(--au-bordo));color:#15803d;background:color-mix(in srgb,#16a34a 8%,var(--au-carta))}
html[data-theme="dark"] .au .ha-tasto.esegui{color:#86efac}
.au .ha-tasto.elimina{color:#dc2626;border-color:color-mix(in srgb,#ef4444 40%,var(--au-bordo))}
.au select.ha-chip{appearance:none;-webkit-appearance:none;border:0;padding:7px 11px;border-radius:11px;background:var(--au-tenue);font:inherit;font-size:12.5px;font-weight:800;color:var(--au-tx);max-width:200px}
.au .ha-dove{font-size:11.5px;font-weight:600;color:var(--au-dim);margin-left:auto}
.au .ha-dove .ha-orig{margin:0 6px 0 0}
.au .ha-dove code{font-size:11px;padding:1px 5px;border-radius:5px;background:var(--au-tenue)}
.au .au-salva[disabled]{opacity:.6;cursor:progress}
.au .ha-salva-dove{display:flex;gap:8px;align-items:flex-start;margin:10px 4px 0;font-size:12.5px;line-height:1.45;font-weight:600;color:var(--au-dim)}
.au .ha-salva-dove b{color:var(--au-tx)}
.au .ha-riep{border:1px solid var(--au-bordo);border-radius:16px;background:var(--au-carta);padding:12px 14px 12px 18px;margin-bottom:10px;position:relative}
.au .ha-riep::before{content:"";position:absolute;left:0;top:14px;bottom:14px;width:4px;border-radius:0 4px 4px 0;background:var(--c)}
.au .ha-riep .au-et{color:var(--c);margin-bottom:6px}
.au .ha-riep .au-et small{font-weight:700;letter-spacing:0;text-transform:none;color:var(--au-dim)}
.au .ha-riep ul{margin:0;padding:0;list-style:none;display:grid;gap:6px}
.au .ha-riep li{display:flex;flex-wrap:wrap;gap:4px 9px;font-size:13.5px;font-weight:700;line-height:1.4;color:var(--au-tx)}
.au .ha-riep li::before{content:"•";color:var(--c);font-weight:900}
.au .ha-riep li.sub{margin-left:18px;font-weight:600}
.au .ha-riep li.sub::before{content:"↳"}
.au .ha-riep code{font-size:11.5px;padding:1px 6px;border-radius:6px;background:var(--au-tenue);color:var(--au-dim);font-weight:700;word-break:break-all}
.au .ha-av{display:flex;gap:12px;align-items:flex-start;margin-top:4px;padding:13px 15px;border-radius:14px;border:1px solid color-mix(in srgb,#0ea5e9 35%,var(--au-bordo));background:color-mix(in srgb,#0ea5e9 7%,var(--au-carta));font-size:13px;line-height:1.5;font-weight:600;color:var(--au-tx)}
.au .ha-av .i{font-size:20px}
.au .ha-av .ha-apri{display:inline-flex;margin-top:8px;padding:8px 13px;border-radius:11px;background:#0ea5e9;color:#fff;font-weight:900;font-size:12.5px;text-decoration:none}
.au-app .ha-testa-su .au-ico{display:none}
.au-app .ha-dove{margin-left:0;flex-basis:100%}
@media (max-width:640px){.au-web .ha-cerca{order:5;max-width:none;flex-basis:100%}}
/* «Eliminare?» */
.ha-velo{position:fixed;inset:0;z-index:100000;display:grid;place-items:center;background:rgba(15,23,42,.45)}
.ha-conferma{width:min(420px,calc(100vw - 32px));box-sizing:border-box;border-radius:20px;padding:20px;background:var(--card-bg,#fff);color:var(--text,#0f172a);box-shadow:0 30px 70px -20px rgba(0,0,0,.5);font-family:Inter,sans-serif}
.ha-conferma h4{margin:0 0 6px;font-size:17px;font-weight:900}
.ha-conferma p{margin:0 0 16px;font-size:13.5px;line-height:1.5;font-weight:600;color:var(--secondary-text-color,#64748b)}
.ha-conferma div{display:flex;gap:10px;justify-content:flex-end}
.ha-conferma button{border-radius:12px;padding:10px 16px;font:inherit;font-weight:900;font-size:13.5px;border:1px solid var(--divider-color,#e2e8f0);background:none;color:inherit;cursor:pointer}
.ha-conferma button.r{background:#dc2626;border-color:#dc2626;color:#fff}
/* «Premium arriva con le app» */
.ps-velo{position:fixed;inset:0;z-index:100000;background:rgba(15,23,42,.5);display:flex;align-items:flex-end;justify-content:center}
@media (min-width:700px){.ps-velo{align-items:center}}
.ps{width:min(460px,100vw);box-sizing:border-box;padding:14px 22px calc(24px + env(safe-area-inset-bottom,0px));border-radius:28px 28px 0 0;background:var(--card-bg,#fff);color:var(--text,#0f172a);font-family:Inter,sans-serif;display:grid;justify-items:center;text-align:center;gap:10px;box-shadow:0 -20px 60px -20px rgba(0,0,0,.45)}
@media (min-width:700px){.ps{border-radius:28px;padding:26px 26px 24px}}
.ps .man{width:42px;height:5px;border-radius:9px;background:var(--divider-color,#dbe4ee)}
@media (min-width:700px){.ps .man{display:none}}
.ps .ico{font-size:34px}
.ps .tag{font-size:10.5px;font-weight:900;letter-spacing:1.4px;color:#b45309;background:color-mix(in srgb,#f59e0b 16%,transparent);border-radius:999px;padding:4px 10px}
html[data-theme="dark"] .ps .tag{color:#fcd34d}
.ps h3{margin:0;font-family:Oswald,sans-serif;font-weight:700;font-size:23px;letter-spacing:1px;text-transform:uppercase}
.ps p{margin:0;font-size:13.5px;line-height:1.55;font-weight:600;color:var(--secondary-text-color,#64748b)}
.ps p b{color:var(--text,#0f172a)}
.ps .negozi{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin:4px 0}
.ps .neg{display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:14px;border:1px solid var(--divider-color,#dbe4ee);font-size:13px;font-weight:900}
.ps .neg small{font-size:10px;font-weight:900;letter-spacing:.8px;color:#b45309;text-transform:uppercase}
html[data-theme="dark"] .ps .neg small{color:#fcd34d}
.ps .ok{margin-top:6px;width:100%;border:0;border-radius:16px;padding:14px;background:#7c3aed;color:#fff;font:inherit;font-size:14px;font-weight:900;cursor:pointer}
@media (max-width:760px){.au-web .pro-carte{grid-template-columns:1fr}.au-web .pro-elenco .au-riga{flex-wrap:wrap}.au-web .pro-elenco .pro-tasti{flex-direction:row;width:100%}}
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
  /* I puntini delle proposte nell'app seguono la carta in vista: si
   * spostano qui, senza ridisegnare la pagina sotto il dito. */
  doc.addEventListener(
    "scroll",
    (evento) => {
      const carte = evento.target?.closest?.(".au .pro-carte");
      if (!carte) return;
      const prima = carte.firstElementChild;
      const passo = (prima?.offsetWidth || 1) + 10;
      const vista = Math.round(carte.scrollLeft / passo);
      carte.parentElement
        ?.querySelectorAll?.(".pro-punti i")
        .forEach((punto, i) => punto.classList.toggle("si", i === vista));
    },
    true,
  );
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
