/* Le vasche di casa: gli acquari e i terrari, dentro gli Animali (#127).
 *
 * «Si potrebbe inserire una sezione con l'acquario?» — e poi: «ho tre
 * terrari». L'Acquario era una pagina sua, con una vasca sola. Adesso è una
 * voce degli Animali come il cane e il gatto, e di vasche ce ne possono essere
 * quante se ne hanno: ognuna ha la sua scheda nella pagina degli Animali, e qui
 * c'è quello che una scheda di vasca sa fare e quella di una bestia no.
 *
 * Fatta coi pezzi delle altre pagine, come la vecchia pagina dell'Acquario:
 *
 *   · in cima la risposta, «In questo momento»: tutto nella norma, o la cosa
 *     da guardare — l'acqua troppo calda, il terrario troppo secco, il livello
 *     da rabboccare, il cambio d'acqua da fare;
 *   · le mattonelle di comando della Piscina: le luci, la lampada calda, l'UVB,
 *     il nebulizzatore, il filtro, che si accendono e si spengono con un tocco;
 *   · le misure sulla loro forcella, con la barra della Piscina, e il livello
 *     come una riga delle Batterie, coi giorni al rabbocco;
 *   · e il cambio d'acqua — o la pulizia, per un terrario — con l'anello e il
 *     tasto per segnarlo.
 *
 * Il cambio d'acqua non lo misura nessun sensore: è una data che si segna qui,
 * e sta nella voce degli Animali — così il telefono che la segna e il tablet
 * in cucina contano gli stessi giorni.
 *
 * Qui sta anche il TRAVASO: chi aveva l'Acquario configurato in `cd_acquario`
 * se lo ritrova, una volta sola, come voce degli Animali (vedi
 * `travasaLAcquario` nel nucleo degli animali).
 */
import {
  CHIAVE_ANIMALI,
  animaliDisegnabili,
  eUnaVasca,
  normalizzaAnimali,
  travasaLAcquario,
} from "../core/animali-model.js";
import {
  CHIAVE_ACQUARIO,
  acquarioDiCasa,
  comeStaLAcquario,
  conIlCambio,
  disegnoDelTipo,
  domandaDelLivello,
  livelliDaSeguire,
  serieDelLivello,
  tipoValido,
} from "../core/l-acquario-di-casa.js";
import { forcellaMarkup } from "./pool-irrigation-scene-section.js";
import {
  allStates,
  chiamaServizio,
  chiediAHomeAssistant,
  disegnoDiCasa,
  doc,
  esc,
  formatNumber,
  installStyle,
  planciaVisibile,
  quandoSiCambiaPagina,
  readJson,
  root,
  siComanda,
  t,
  writeJsonIfChanged,
  senzaCadere,
} from "./shared.js";
import { nomeDaHomeAssistant } from "./editor-slots-section.js";

const KEY = "__DASHBOARDMODERN_ACQUARIO__";
const state = (root[KEY] ||= {
  installed: false,
  frame: 0,
  sveglia: 0,
  dati: null,
  inVolo: false,
  chiestoAlle: 0,
  fallitoAlle: 0,
  annulla: null,
});

/* La pagina dove le vasche si vedono adesso: quella degli Animali. La tessera
 * in Home porta lì. */
export const VASCHE_PAGE_ID = "page-animali";

/* La tessera in Home tiene la chiave che aveva: chi l'aveva spostata, spenta o
 * tolta dalla Home se la ritrova come l'aveva lasciata. */
export const TESSERA_DELLE_VASCHE = "acquario";

/* L'avviso che le vasche sono cambiate — le medie del livello sono arrivate,
 * un cambio d'acqua è stato segnato —: la pagina degli Animali e la tessera in
 * Home lo ascoltano, perché la risposta atterra quando si sono già disegnate. */
export const EVENTO_ACQUARIO = "dashboardmodern:acquario-letto";

/* Mezz'ora: l'acqua evapora in giorni. Chiedere più spesso sarebbe lavoro per
 * il Recorder in cambio di niente. */
const OGNI_QUANTO_MS = 30 * 60_000;
const DOPO_UN_ERRORE_MS = 60_000;
const ATTESA_MS = 30_000;

/* Quanto resta il tasto per tornare indietro dopo «Fatto oggi». */
const ANNULLA_MS = 5_000;

/* ── cosa c'è da guardare ─────────────────────────────────────────────── */

function tuttiGliAnimali() {
  return normalizzaAnimali(readJson(CHIAVE_ANIMALI, []));
}

/** Le vasche configurate: le voci degli Animali che sono un acquario o un terrario. */
export function vascheConfigurate() {
  return animaliDisegnabili(readJson(CHIAVE_ANIMALI, [])).filter(eUnaVasca);
}

/**
 * Come sta una vasca adesso: le righe lette e il giudizio di tutto insieme.
 * `dentro` toglie le entità che la tessera in Home non vuole. `null` senza
 * righe da leggere.
 */
export function vistaDellaVasca(voce, states = allStates(), { dentro, adesso = Date.now() } = {}) {
  const letture = acquarioDiCasa(states, voce, (entity) =>
    nomeDaHomeAssistant(entity, states),
  ).filter((lettura) => typeof dentro !== "function" || dentro(lettura.entity));
  return {
    voce,
    tipo: tipoValido(voce?.specie),
    letture,
    adesso,
    come: comeStaLAcquario(letture, { serie: state.dati?.serie || {}, config: voce, adesso }),
  };
}

/** Tutte le vasche con qualcosa da leggere, per la tessera in Home. */
export function vistaDelleVasche(states = allStates(), opzioni = {}) {
  return vascheConfigurate()
    .map((voce) => vistaDellaVasca(voce, states, opzioni))
    .filter((vista) => vista.letture.length);
}

/* ── le domande a Home Assistant ──────────────────────────────────────── */

function laTesseraSiVede() {
  if (!doc?.getElementById?.("page-home")?.classList?.contains("active")) return false;
  return Boolean(doc.querySelector?.(`.dm-tile[data-dm-widget="${TESSERA_DELLE_VASCHE}"]`));
}

/* Si chiede solo quando qualcuno guarda: la pagina aperta, o la Home con la
 * sua tessera. */
function serveLeggere() {
  if (!planciaVisibile()) return false;
  const pagina = doc?.getElementById?.(VASCHE_PAGE_ID);
  return Boolean(pagina?.classList.contains("active")) || laTesseraSiVede();
}

async function aggiornaIDati({ forza = false } = {}) {
  /* Le serie si tengono per entità: un'entità è di una vasca sola, e così una
   * domanda sola porta la storia di tutti i livelli di tutte le vasche. */
  const states = allStates();
  const letture = vascheConfigurate().flatMap((voce) => vistaDellaVasca(voce, states).letture);
  /* La storia serve solo ai livelli con una soglia: una vasca senza non
   * chiede niente a nessuno. E nessuno che risponde vuol dire, di solito, gli
   * stati non ancora arrivati: si aspetta loro. */
  const livelli = livelliDaSeguire(letture);
  if (!livelli.length || letture.every((lettura) => lettura.muto) || state.inVolo) return;
  const adesso = Date.now();
  if (!forza) {
    if (state.dati && adesso - state.chiestoAlle < OGNI_QUANTO_MS) return;
    if (!state.dati && adesso - state.fallitoAlle < DOPO_UN_ERRORE_MS) return;
  }
  state.inVolo = true;
  state.chiestoAlle = adesso;
  let riuscita = false;
  try {
    const domanda = domandaDelLivello(livelli, adesso);
    const risposta = await chiediAHomeAssistant(domanda, ATTESA_MS);
    state.dati = {
      serie: Object.fromEntries(
        livelli.map((entity) => [entity, serieDelLivello(risposta, entity)]),
      ),
    };
    state.fallitoAlle = 0;
    riuscita = true;
  } catch (errore) {
    /* Senza presa non si è chiesto niente a nessuno: la plancia si sta ancora
     * collegando, e l'annuncio che è pronta farà ridisegnare. */
    if (errore?.message === "socket") state.chiestoAlle = 0;
    else {
      state.fallitoAlle = Date.now();
      root.console?.warn?.("[DashboardModern] acquario", errore);
    }
  } finally {
    state.inVolo = false;
  }
  if (!riuscita) return;
  annuncia();
}

function annuncia() {
  root.dispatchEvent?.(new CustomEvent(EVENTO_ACQUARIO));
}

/* Un appuntamento solo, alla prossima mezz'ora: non un battito che gira. */
function prossimoGiro() {
  if (state.sveglia || !serveLeggere()) return;
  state.sveglia =
    root.setTimeout?.(() => {
      state.sveglia = 0;
      schedule();
    }, OGNI_QUANTO_MS) || 0;
}

/* ── i comandi e il cambio d'acqua ────────────────────────────────────── */

/* Una mattonella accende o spegne: il verbo è quello del suo dominio, come
 * nelle Stanze. Quello chiuso col lucchetto si vede e basta. */
function commuta(entity) {
  if (!entity || !siComanda(entity)) return false;
  const states = allStates();
  const lettura = vascheConfigurate()
    .flatMap((voce) => vistaDellaVasca(voce, states).letture)
    .find((voce) => voce.entity === entity);
  if (!lettura || lettura.muto) return false;
  chiamaServizio({
    domain: entity.split(".")[0],
    service: lettura.acceso ? "turn_off" : "turn_on",
    data: { entity_id: entity },
  });
  if (root.navigator?.vibrate) root.navigator.vibrate(5);
  return true;
}

/* La voce `id` con questa modifica, salvata. */
function cambiaLaVoce(id, cambia) {
  const animali = tuttiGliAnimali();
  const posto = animali.findIndex((voce) => voce.id === id);
  if (posto < 0) return null;
  const prima = animali[posto];
  const next = animali.slice();
  next[posto] = cambia(prima);
  writeJsonIfChanged(CHIAVE_ANIMALI, normalizzaAnimali(next));
  return prima;
}

/* «Fatto oggi» segna la data, e per cinque secondi lascia il modo di tornare
 * indietro: un tocco per sbaglio non deve costare la data di prima. */
function segnaIlCambio(id) {
  const prima = cambiaLaVoce(id, (voce) => conIlCambio(voce, Date.now()));
  if (!prima) return;
  const campo = tipoValido(prima.specie) === "terrario" ? "pulizia" : "cambio";
  state.annulla = { id, quando: prima[campo] ?? "" };
  annuncia();
  root.setTimeout?.(() => {
    if (state.annulla?.id !== id) return;
    state.annulla = null;
    annuncia();
  }, ANNULLA_MS);
}

function annullaIlCambio(id) {
  if (state.annulla?.id !== id) return;
  const { quando } = state.annulla;
  state.annulla = null;
  cambiaLaVoce(id, (voce) => conIlCambio(voce, quando));
  annuncia();
}

/* ── il travaso dell'Acquario di prima ────────────────────────────────── */

/**
 * Porta `cd_acquario` negli Animali, se c'è da farlo. Si chiama a ogni
 * configurazione che arriva: le volte dopo la prima non fa niente, perché il
 * segno sta dentro `cd_acquario` stesso.
 */
export function travasaSeServe() {
  const fatto = travasaLAcquario(
    readJson(CHIAVE_ANIMALI, []),
    readJson(CHIAVE_ACQUARIO, {}) || {},
  );
  if (!fatto) return false;
  writeJsonIfChanged(CHIAVE_ANIMALI, normalizzaAnimali(fatto.animali));
  writeJsonIfChanged(CHIAVE_ACQUARIO, fatto.acquario);
  annuncia();
  return true;
}

/* ── le parole ────────────────────────────────────────────────────────── */

const SPAZIO = " ";

/* Le cifre che il sensore dà, fino a due: un pH si legge a 7,25, una
 * temperatura a 25,6, i ppm interi. */
function cifreDi(valore) {
  const dopo = String(valore).split(".")[1] || "";
  return Math.min(2, dopo.length);
}

function numeroInParole(valore) {
  return formatNumber(valore, cifreDi(valore));
}

function valoreInParole(lettura) {
  if (lettura.valore === null) return "—";
  return `${numeroInParole(lettura.valore)}${lettura.unita ? `${SPAZIO}${lettura.unita}` : ""}`;
}

function forchettaInParole(lettura) {
  const unita = lettura.unita ? `${SPAZIO}${lettura.unita}` : "";
  return `${t("ideale", "ideal")} ${numeroInParole(lettura.minimo)} – ${numeroInParole(lettura.massimo)}${unita}`;
}

/** Come si dice il tipo di una vasca. */
export function parolaDelTipo(tipo) {
  return tipoValido(tipo) === "terrario" ? t("Terrario", "Terrarium") : t("Acquario", "Aquarium");
}

/* I giorni stanno dentro la frase, e l'uno e lo zero hanno la loro: «fra 1
 * giorni» e «0 giorni fa» si leggono subito. */

/** Da quanto è stata cambiata l'acqua — o pulito il terrario —; vuoto se non è mai stato segnato. */
export function cambioInParole(cambio, tipo = "acquario") {
  if (!cambio || cambio.giorni === null) return "";
  const { giorni } = cambio;
  if (tipoValido(tipo) === "terrario") {
    if (giorni === 0) return t("Pulito oggi", "Cleaned today");
    if (giorni === 1) return t("Pulito ieri", "Cleaned yesterday");
    return t(`Pulito ${giorni} giorni fa`, `Cleaned ${giorni} days ago`);
  }
  if (giorni === 0) return t("Cambio d'acqua fatto oggi", "Water changed today");
  if (giorni === 1) return t("Cambio d'acqua fatto ieri", "Water changed yesterday");
  return t(`Cambio d'acqua ${giorni} giorni fa`, `Water changed ${giorni} days ago`);
}

/** Quando tocca il prossimo, o di quanto è in ritardo. */
export function prossimoCambioInParole(cambio) {
  if (!cambio || cambio.fra === null || cambio.fra === undefined) return "";
  const { fra } = cambio;
  if (fra > 1) return t(`il prossimo fra ${fra} giorni`, `next one in ${fra} days`);
  if (fra === 1) return t("il prossimo domani", "next one tomorrow");
  if (fra === 0) return t("da fare oggi", "due today");
  if (fra === -1) return t("in ritardo di un giorno", "one day late");
  const ritardo = -fra;
  return t(`in ritardo di ${ritardo} giorni`, `${ritardo} days late`);
}

function ogniInParole(ogni) {
  return ogni === 1
    ? t("ogni giorno", "every day")
    : t(`ogni ${ogni} giorni`, `every ${ogni} days`);
}

/** Fra quanti giorni si rabbocca. */
export function rabboccoInParole(giorni) {
  if (giorni === null || giorni === undefined) return "";
  if (giorni < 1) return t("rabbocco a breve", "top-up soon");
  if (giorni === 1) return t("rabbocco domani", "top-up tomorrow");
  return t(`rabbocco fra ${giorni} giorni`, `top-up in ${giorni} days`);
}

/* Acceso e spento si accordano con quello che comandano: le luci sono
 * accese, la lampada è accesa, il filtro è acceso. */
function statoDelComando(lettura) {
  if (lettura.muto) return t("Non risponde", "Not answering");
  if (lettura.genere === "luci") return lettura.acceso ? t("accese", "on") : t("spente", "off");
  if (lettura.genere === "lampada" || lettura.genere === "uvb")
    return lettura.acceso ? t("accesa", "on") : t("spenta", "off");
  return lettura.acceso ? t("acceso", "on") : t("spento", "off");
}

/* Cosa dice la risposta di una misura fuori forcella: l'acqua troppo calda,
 * il terrario troppo secco, il pH troppo alto. Una misura qualunque dice solo
 * che è fuori, e il suo nome sta sotto. */
function fuoriInParole({ lettura, verdetto }, tipo = "acquario") {
  const alto = verdetto === "high";
  const terrario = tipoValido(tipo) === "terrario";
  if (lettura.genere === "temperatura" || lettura.genere === "temperatura_fresca") {
    if (terrario) return alto ? t("Troppo caldo", "Too hot") : t("Troppo freddo", "Too cold");
    return alto
      ? t("Acqua troppo calda", "Water too warm")
      : t("Acqua troppo fredda", "Water too cold");
  }
  if (lettura.genere === "umidita")
    return alto
      ? t("Umidità troppo alta", "Humidity too high")
      : t("Umidità troppo bassa", "Humidity too low");
  if (lettura.genere === "ph")
    return alto ? t("pH troppo alto", "pH too high") : t("pH troppo basso", "pH too low");
  return t("Fuori norma", "Out of range");
}

function quanteMute(quante) {
  return quante === 1
    ? t("1 non risponde", "1 not answering")
    : `${quante} ${t("non rispondono", "not answering")}`;
}

function vascaInParole(come) {
  return [come.vasca, come.litri ? `${formatNumber(come.litri, 0)}${SPAZIO}L` : ""]
    .filter(Boolean)
    .join(" · ");
}

/**
 * La risposta in cima: `{ stato, grande, nomi, sotto }`.
 *
 * Una cosa sola, la più importante: una misura fuori forcella, poi l'acqua da
 * rabboccare, poi il cambio d'acqua — o la pulizia — da fare. Se va tutto bene
 * lo dice, con la vasca e da quanto è stata cambiata l'acqua.
 */
export function testaDellAcquario(come) {
  const tipo = come.tipo || "acquario";
  const mute = come.mute.length ? quanteMute(come.mute.length) : "";
  if (come.stato === "fuori") {
    if (come.fuori.length === 1) {
      const [voce] = come.fuori;
      return {
        stato: "fuori",
        grande: fuoriInParole(voce, tipo),
        nomi: `${voce.lettura.name} · ${valoreInParole(voce.lettura)}`,
        sotto: [forchettaInParole(voce.lettura), mute].filter(Boolean).join(" · "),
      };
    }
    const quante = come.fuori.length;
    return {
      stato: "fuori",
      grande: t(`${quante} valori fuori norma`, `${quante} readings out of range`),
      nomi: come.fuori.map((voce) => voce.lettura.name).join(" · "),
      sotto: mute,
    };
  }
  if (come.stato === "livello") {
    const [voce] = come.bassi;
    return {
      stato: "livello",
      grande: t("Da rabboccare", "Top up the water"),
      nomi: voce.lettura.binario
        ? voce.lettura.name
        : `${voce.lettura.name} · ${valoreInParole(voce.lettura)}`,
      sotto: [vascaInParole(come), mute].filter(Boolean).join(" · "),
    };
  }
  if (come.stato === "cambio")
    return {
      stato: "cambio",
      grande:
        tipoValido(tipo) === "terrario"
          ? t("Pulizia da fare", "Cleaning due")
          : t("Cambio d'acqua da fare", "Water change due"),
      nomi: [come.vasca, cambioInParole(come.cambio, tipo)].filter(Boolean).join(" · "),
      sotto: [prossimoCambioInParole(come.cambio), mute].filter(Boolean).join(" · "),
    };
  if (come.stato === "mute")
    return { stato: "mute", grande: t("Nessuna risponde", "None answering"), nomi: "", sotto: "" };
  return {
    stato: "bene",
    grande: t("Tutto nella norma", "All in range"),
    nomi: vascaInParole(come),
    sotto: [
      cambioInParole(come.cambio, tipo),
      come.rabbocco ? rabboccoInParole(come.rabbocco.giorni) : "",
      mute,
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

/** Quanto pesa una vasca, nella stessa scala delle schede degli animali. */
export function gravitaDellaVasca(come) {
  if (come.stato === "fuori") return "urgente";
  if (come.stato === "livello" || come.stato === "cambio") return "attenzione";
  return "quiete";
}

/* ── il disegno ───────────────────────────────────────────────────────── */

/* Dentro la scheda la vasca ha già il suo nome in testa: la risposta non lo
 * ripete, dice solo come sta. */
function testaMarkup(testa) {
  return `<div class="dm-acq-testa" data-stato="${esc(testa.stato)}">
    <small>${esc(t("In questo momento", "Right now"))}</small>
    <strong>${esc(testa.grande)}</strong>
    ${testa.nomi ? `<span class="dm-acq-nomi">${esc(testa.nomi)}</span>` : ""}
    ${testa.sotto ? `<span class="dm-acq-sotto">${esc(testa.sotto)}</span>` : ""}
  </div>`;
}

/* Le mattonelle della Piscina: la luce gialla, la lampada calda arancio, il
 * resto azzurro. Il comando non sta in `data-act`, che è della piscina. */
const MATTONELLA = Object.freeze({
  luci: { vestito: "light", glifo: "💡" },
  lampada: { vestito: "heat", glifo: "🔆" },
  uvb: { vestito: "light", glifo: "☀️" },
  nebulizzatore: { vestito: "pump", glifo: "💦" },
  filtro: { vestito: "pump", glifo: "🌀" },
  riscaldatore: { vestito: "heat", glifo: "🔥" },
  comando: { vestito: "pump", glifo: "🔌" },
});

function mattonellaMarkup(lettura) {
  const { vestito, glifo } = MATTONELLA[lettura.genere] || MATTONELLA.comando;
  const acceso = lettura.acceso === true;
  const comandabile = !lettura.muto && siComanda(lettura.entity);
  return `<button type="button" class="dm-pool-tile" data-dm-pool-tile="${vestito}" data-on="${acceso}"
      aria-pressed="${acceso}" data-dm-acq-comando="${esc(lettura.entity)}"${comandabile ? "" : ' aria-disabled="true"'}>
    <span class="dm-pool-tile-icon" aria-hidden="true">${glifo}</span>
    <span class="dm-pool-tile-label">${esc(lettura.name)}</span>
    <span class="dm-pool-tile-state">${esc(statoDelComando(lettura))}</span>
  </button>`;
}

function chiaveDellaMisura(lettura) {
  return `acq-${lettura.entity.replace(/[^a-z0-9]+/gi, "-")}`;
}

/* Una misura sulla sua forcella, con la barra della Piscina. Senza forcella —
 * una misura a cui non la si è data — resta la riga di testa, col numero. */
function misuraMarkup({ lettura, verdetto }) {
  if (lettura.muto || lettura.minimo === null)
    return `<div class="dm-gauge" data-dm-gauge="${esc(chiaveDellaMisura(lettura))}" data-verdict="">
      <div class="dm-gauge-head">
        <span class="dm-gauge-label">${esc(lettura.name)}</span>
        <span class="dm-gauge-value">${esc(lettura.muto ? "—" : valoreInParole(lettura))}</span>
      </div>
      ${lettura.muto ? `<div class="dm-gauge-foot"><span class="dm-gauge-range">${esc(t("Non risponde", "Not answering"))}</span></div>` : ""}
    </div>`;
  return forcellaMarkup({
    chiave: chiaveDellaMisura(lettura),
    etichetta: lettura.name,
    valore: lettura.valore,
    testo: valoreInParole(lettura),
    minimo: lettura.minimo,
    massimo: lettura.massimo,
    verdetto,
    parola:
      verdetto === "low"
        ? t("troppo basso", "too low")
        : verdetto === "high"
          ? t("troppo alto", "too high")
          : t("nella norma", "in range"),
    forchetta: forchettaInParole(lettura),
  });
}

/* Il livello come una riga delle Batterie: il disegno, il nome, la barra
 * quando è in percento, e a destra quello che conta — fra quanti giorni si
 * rabbocca. */
function livelloMarkup({ lettura, basso, giorni }) {
  const stato = lettura.muto ? "muta" : basso ? "basso" : "bene";
  const percento =
    !lettura.binario && lettura.valore !== null && /%/.test(lettura.unita)
      ? Math.max(0, Math.min(100, lettura.valore))
      : null;
  const destra = lettura.muto
    ? t("Non risponde", "Not answering")
    : basso
      ? t("da rabboccare", "to top up")
      : giorni !== null
        ? rabboccoInParole(giorni)
        : lettura.binario
          ? t("nella norma", "in range")
          : valoreInParole(lettura);
  const sotto =
    percento !== null
      ? `<span class="dm-acq-livello-barra"><i style="width:${esc(String(percento))}%"></i></span>`
      : !lettura.binario && !lettura.muto && giorni !== null
        ? `<small>${esc(valoreInParole(lettura))}</small>`
        : "";
  return `<div class="dm-acq-livello" data-stato="${esc(stato)}">
    <span class="dm-acq-livello-ic" aria-hidden="true">${disegnoDiCasa(lettura.icon, { misura: 26, ripiego: "water" })}</span>
    <div class="dm-acq-livello-testo"><strong>${esc(lettura.name)}</strong>${sotto}</div>
    <b class="dm-acq-livello-stato">${esc(destra)}</b>
  </div>`;
}

function qualitaMarkup(come) {
  const misure = come.misure.map(misuraMarkup).join("");
  const livelli = come.livelli.map(livelloMarkup).join("");
  if (!misure && !livelli) return "";
  const terrario = come.tipo === "terrario";
  return `<section class="dm-acq-blocco dm-acq-qualita">
    <h4><span aria-hidden="true">${terrario ? "🌡️" : "🧪"}</span>${esc(terrario ? t("Clima del terrario", "Terrarium climate") : t("Qualità acqua", "Water quality"))}</h4>
    ${misure ? `<div class="dm-pool-gauges">${misure}</div>` : ""}
    ${livelli}
  </section>`;
}

/* Il cambio d'acqua — o la pulizia del terrario — con l'anello: quanti giorni
 * sono passati su quanti ne vanno, e il tasto per segnarlo. Un terrario senza
 * pulizia non ha il blocco: non è una cosa che manca, è una cosa che non fa. */
function cambioMarkup(come, id) {
  const { cambio } = come;
  if (!cambio) return "";
  const terrario = come.tipo === "terrario";
  const ogni = cambio.ogni;
  const pieno =
    cambio.giorni === null || !ogni ? 0 : Math.min(100, Math.round((cambio.giorni / ogni) * 100));
  const nota =
    cambio.ultimo === null
      ? terrario
        ? t(
            "Non è ancora segnata: tocca «Fatto oggi» il giorno che lo pulisci, e da lì la scheda conta i giorni.",
            "Not recorded yet: tap “Done today” on the day you clean it, and from then on the card counts the days.",
          )
        : t(
            "Non è ancora segnato: tocca «Fatto oggi» il giorno che lo fai, e da lì la pagina conta i giorni.",
            "Not recorded yet: tap “Done today” on the day you do it, and from then on the page counts the days.",
          )
      : [cambioInParole(cambio, come.tipo), prossimoCambioInParole(cambio)]
          .filter(Boolean)
          .join(" · ");
  const tasto =
    state.annulla?.id === id
      ? `<button type="button" class="dm-btn dm-ghost" data-dm-acq-annulla="${esc(id)}">↶ ${esc(t("Annulla", "Undo"))}</button>`
      : `<button type="button" class="dm-btn dm-primary" data-dm-acq-cambio="${esc(id)}">✓ ${esc(t("Fatto oggi", "Done today"))}</button>`;
  return `<section class="dm-acq-blocco dm-acq-cambio" data-stato="${cambio.scaduto ? "scaduto" : "ok"}">
    <h4><span aria-hidden="true">${terrario ? "🧽" : "🪣"}</span>${esc(terrario ? t("Pulizia", "Cleaning") : t("Cambio d'acqua", "Water change"))}${ogni ? `<span class="dm-pool-badge">${esc(ogniInParole(ogni))}</span>` : ""}</h4>
    <div class="dm-pool-filtration-body">
      <div class="dm-ring" style="--pct:${pieno}">
        <span class="dm-ring-core"><b>${esc(cambio.giorni === null ? "—" : String(cambio.giorni))}</b>${ogni ? `<i>/ ${esc(String(ogni))}</i>` : `<i>${esc(t("giorni", "days"))}</i>`}</span>
      </div>
      <div class="dm-pool-filtration-copy">
        <p class="dm-pool-note">${esc(nota)}</p>
        <div class="dm-pool-actions dm-acq-azioni">${tasto}</div>
      </div>
    </div>
  </section>`;
}

/**
 * Il corpo della scheda di una vasca, da quello che si sa adesso: la risposta,
 * le mattonelle, le misure e il cambio d'acqua. La testa — la foto, il nome,
 * la stanza — la mette la pagina degli Animali, uguale a quella delle bestie.
 */
export function corpoDellaVasca(vista) {
  const { come } = vista;
  const id = vista.voce?.id || "";
  if (!vista.letture.length)
    return `<p class="dm-animale-nulla">${esc(
      come.tipo === "terrario"
        ? t(
            "Nessuna entità: apri la configurazione e aggiungi la temperatura, l'umidità e le lampade del terrario.",
            "No entity yet: open the settings and add the terrarium's temperature, humidity and lamps.",
          )
        : t(
            "Nessuna entità: apri la configurazione e aggiungi la temperatura, il pH, il livello, le luci e il filtro dell'acquario.",
            "No entity yet: open the settings and add the aquarium's temperature, pH, level, lights and filter.",
          ),
    )}</p>${cambioMarkup(come, id)}`;
  const mattonelle = come.comandi.map(mattonellaMarkup).join("");
  /* Quando va tutto bene la risposta direbbe il nome e i litri della vasca,
   * che la testa della scheda dice già. */
  const testa = testaDellAcquario(come);
  const nomi =
    testa.stato === "bene"
      ? ""
      : testa.stato === "cambio"
        ? cambioInParole(come.cambio, come.tipo)
        : testa.nomi;
  return `${testaMarkup({ ...testa, nomi })}
    ${mattonelle ? `<div class="dm-pool-tiles dm-acq-mattonelle">${mattonelle}</div>` : ""}
    ${qualitaMarkup(come)}${cambioMarkup(come, id)}`;
}

/* ── la tessera in Home ───────────────────────────────────────────────── */

/* La lettura che una vasca mostra in una riga: la temperatura — del lato
 * caldo, per un terrario — e, se c'è, l'umidità accanto. */
function temperaturaDi(come) {
  return come.misure.find((voce) => voce.lettura.genere === "temperatura" && !voce.lettura.muto)
    ?.lettura;
}

function inBreve(come) {
  const caldo = temperaturaDi(come);
  const umido = come.misure.find(
    (voce) => voce.lettura.genere === "umidita" && !voce.lettura.muto,
  )?.lettura;
  return [
    caldo ? `${formatNumber(caldo.valore, 1)}°` : "",
    umido ? `${formatNumber(umido.valore, 0)}${SPAZIO}%` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Come si chiama la tessera, da cosa c'è in casa. */
function nomeDellaTessera(viste) {
  const tipi = new Set(viste.map((vista) => vista.tipo));
  if (tipi.size > 1) return t("Acquari e terrari", "Aquariums and terrariums");
  const [tipo] = tipi;
  if (viste.length > 1)
    return tipo === "terrario" ? t("Terrari", "Terrariums") : t("Acquari", "Aquariums");
  return parolaDelTipo(tipo);
}

/**
 * La tessera in Home, dalle stesse viste della pagina.
 *
 * Con una vasca sola dice quello che diceva la vecchia tessera dell'Acquario:
 * la temperatura, e sotto la cosa da guardare. Con più vasche dice quante sono
 * e quali vogliono qualcosa, e porta una riga per vasca. Chiede attenzione
 * quando c'è da fare — la forcella, il rabbocco, il cambio — come la batteria
 * da cambiare.
 *
 * Accetta anche una vista sola, com'era prima.
 */
export function tesseraDellAcquario(viste) {
  const elenco = (Array.isArray(viste) ? viste : viste ? [viste] : []).filter(
    (vista) => vista?.letture?.length,
  );
  if (!elenco.length) return null;
  const daFareIn = (vista) =>
    vista.come.stato === "fuori" || vista.come.stato === "livello" || vista.come.stato === "cambio";
  const daFare = elenco.filter(daFareIn);
  const soloTerrari = elenco.every((vista) => vista.tipo === "terrario");
  const base = {
    key: TESSERA_DELLE_VASCHE,
    accent: daFare.length ? "#f59e0b" : soloTerrari ? "#16a34a" : "#0ea5e9",
    icon: soloTerrari ? "🦎" : "🐠",
    label: nomeDellaTessera(elenco),
    ring: null,
    attiva: daFare.length > 0,
    alert: daFare.length > 0,
    /* Per la frase della finestra: quante vasche, e quante vogliono qualcosa. */
    vasche: elenco.length,
    daGuardare: daFare.length,
  };
  if (elenco.length === 1) {
    const [{ come }] = elenco;
    const testa = testaDellAcquario(come);
    const caldo = temperaturaDi(come);
    return {
      ...base,
      value: caldo ? `${formatNumber(caldo.valore, 1)}°` : "—",
      caption: [testa.grande, daFare.length ? testa.nomi : cambioInParole(come.cambio, come.tipo)]
        .filter(Boolean)
        .join(" · "),
      rows: righeDellaVasca(come),
    };
  }
  return {
    ...base,
    value: String(elenco.length),
    caption: daFare.length
      ? daFare
          .map((vista) => `${nomeDellaVista(vista)}: ${testaDellAcquario(vista.come).grande.toLowerCase()}`)
          .join(" · ")
      : elenco.map(nomeDellaVista).join(" · "),
    rows: elenco.map((vista) => {
      const testa = testaDellAcquario(vista.come);
      const prima = vista.come.fuori[0]?.lettura || temperaturaDi(vista.come) || vista.letture[0];
      return {
        entity: prima?.entity || "",
        name: nomeDellaVista(vista),
        glyph: disegnoDiCasa(disegnoDelTipo(vista.tipo), { misura: 20, ripiego: "aquarium" }),
        value: daFareIn(vista) ? testa.grande : inBreve(vista.come) || testa.grande,
        tono:
          vista.come.stato === "fuori"
            ? "allarme"
            : daFareIn(vista)
              ? "acceso"
              : vista.come.stato === "mute"
                ? ""
                : "quiete",
      };
    }),
  };
}

function nomeDellaVista(vista) {
  return vista.come.vasca || parolaDelTipo(vista.tipo);
}

/* Le righe di una vasca sola: le sue misure, i livelli, i comandi. */
function righeDellaVasca(come) {
  return [
    ...come.misure.map(({ lettura, verdetto }) => ({
      entity: lettura.entity,
      name: lettura.name,
      glyph: disegnoDiCasa(lettura.icon, { misura: 20, ripiego: "aquarium" }),
      value: lettura.muto ? t("Non risponde", "Not answering") : valoreInParole(lettura),
      tono:
        verdetto === "low" || verdetto === "high" ? "allarme" : verdetto === "ok" ? "quiete" : "",
    })),
    ...come.livelli.map(({ lettura, basso, giorni }) => ({
      entity: lettura.entity,
      name: lettura.name,
      glyph: disegnoDiCasa(lettura.icon, { misura: 20, ripiego: "water" }),
      value: lettura.muto
        ? t("Non risponde", "Not answering")
        : basso
          ? t("da rabboccare", "to top up")
          : giorni !== null
            ? rabboccoInParole(giorni)
            : lettura.binario
              ? t("nella norma", "in range")
              : valoreInParole(lettura),
      tono: lettura.muto ? "" : basso ? "allarme" : "quiete",
    })),
    ...come.comandi.map((lettura) => ({
      entity: lettura.entity,
      name: lettura.name,
      glyph: disegnoDiCasa(lettura.icon, { misura: 20, ripiego: "toggle" }),
      value: statoDelComando(lettura),
      tono: lettura.muto ? "" : "quiete",
    })),
  ];
}

/* ── il giro ──────────────────────────────────────────────────────────── */

function schedule() {
  if (state.frame) return;
  const giro = () => {
    state.frame = 0;
    try {
      if (serveLeggere()) {
        aggiornaIDati();
        prossimoGiro();
      }
    } catch (error) {
      root.console?.warn?.("[DashboardModern] acquario", error);
    }
  };
  state.frame = root.requestAnimationFrame?.(giro) || 0;
  if (!state.frame) giro();
}

/** Ridisegna adesso: la usa chi cambia la configurazione di una vasca. */
export function renderAcquario() {
  /* Un livello nuovo, o una soglia nuova, vuole la sua storia. */
  state.chiestoAlle = 0;
  annuncia();
  schedule();
}

/* ── il foglio ────────────────────────────────────────────────────────── */

/* Le regole delle vasche dentro la pagina degli Animali. Le mattonelle, la
 * forcella e l'anello no — quelli sono di tutti, e stanno nel foglio della
 * Piscina. */
function installStyles() {
  const P = `#${VASCHE_PAGE_ID}`;
  installStyle(
    "dm-acquario-section-style",
    `
    /* La risposta, come quella dei Varchi ma della misura di una scheda. */
    ${P} .dm-acq-testa{
      display:grid;gap:3px;padding:12px 14px;border-radius:16px;
      border:1px solid var(--card-border,#e2e8f0);
      background:color-mix(in srgb,var(--dm-acq-tinta,#16a34a) 8%,var(--card-bg,#fff))}
    ${P} .dm-acq-testa small{
      font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;
      color:var(--text-dim,#64748b)}
    ${P} .dm-acq-testa strong{font-size:19px;font-weight:900;line-height:1.1;color:var(--dm-acq-tinta,#15803d)}
    ${P} .dm-acq-testa[data-stato="fuori"],
    ${P} .dm-acq-testa[data-stato="livello"],
    ${P} .dm-acq-testa[data-stato="cambio"]{--dm-acq-tinta:#b45309}
    ${P} .dm-acq-testa[data-stato="mute"]{--dm-acq-tinta:#64748b}
    ${P} .dm-acq-nomi{font-size:12.5px;font-weight:800;color:var(--text,#0f172a)}
    ${P} .dm-acq-sotto{font-size:11.5px;font-weight:700;color:var(--text-dim,#64748b)}

    /* Le mattonelle in una scheda stretta: due per riga, un po' più basse. */
    ${P} .dm-acq-mattonelle{grid-template-columns:repeat(auto-fill,minmax(min(132px,100%),1fr));gap:8px}
    /* I posti si scrivono tutti: sul telefono i tasti della pagina prendono
       un'altra disposizione, e la mattonella si sfalsava. */
    ${P} .dm-acq-mattonelle .dm-pool-tile{display:grid;min-height:56px;padding:9px 10px;gap:1px 9px;
      grid-template-columns:36px minmax(0,1fr);grid-template-rows:auto auto;align-content:center;
      text-align:left;border-radius:15px}
    ${P} .dm-acq-mattonelle .dm-pool-tile-icon{grid-column:1;grid-row:1/3;width:36px;height:36px;border-radius:11px;font-size:17px}
    /* Il nome va a capo invece di finire in tre puntini: «Lampada calda» e
       «Luce del giorno» sono nomi, e mezzi non si capiscono. */
    ${P} .dm-acq-mattonelle .dm-pool-tile-label,
    ${P} .dm-acq-mattonelle .dm-pool-tile-state{justify-self:start;text-align:left}
    ${P} .dm-acq-mattonelle .dm-pool-tile-label{grid-column:2;grid-row:1;align-self:end;font-size:12.5px;line-height:1.15;
      overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow-wrap:break-word;hyphens:auto}
    ${P} .dm-acq-mattonelle .dm-pool-tile-state{grid-column:2;grid-row:2;align-self:start;font-size:10.5px}
    /* Chi è chiuso col lucchetto si vede, ma non si tocca. */
    ${P} .dm-pool-tile[aria-disabled="true"]{cursor:default}
    ${P} .dm-pool-tile[aria-disabled="true"]:hover{transform:none}

    /* I blocchi della scheda: le fasce delle schede degli animali. */
    ${P} .dm-acq-blocco{display:grid;gap:10px;padding:11px 12px;border:1px solid var(--divider-color,#dbe4ee);
      border-radius:14px;background:color-mix(in srgb,var(--secondary-background-color,#eef3f8) 45%,transparent)}
    ${P} .dm-acq-blocco h4{display:flex;align-items:center;gap:6px;margin:0;font-size:10.5px;font-weight:900;
      letter-spacing:.06em;text-transform:uppercase;color:var(--secondary-text-color,#64748b)}
    ${P} .dm-acq-blocco h4 .dm-pool-badge{margin-left:auto;font-size:10px;padding:3px 9px}
    ${P} .dm-acq-blocco .dm-gauge-value{font-size:17px}

    /* Il livello, come una riga delle Batterie. */
    ${P} .dm-acq-livello{
      display:grid;grid-template-columns:34px minmax(0,1fr) auto;align-items:center;gap:10px;
      padding:9px 11px;border-radius:14px;
      border:1px solid color-mix(in srgb,var(--dm-acq,#10b981) 36%,transparent);
      background:color-mix(in srgb,var(--dm-acq,#10b981) 7%,var(--card-bg,#fff))}
    ${P} .dm-acq-livello[data-stato="basso"]{--dm-acq:#f59e0b}
    ${P} .dm-acq-livello[data-stato="muta"]{--dm-acq:#94a3b8;opacity:.72}
    ${P} .dm-acq-livello-ic{display:grid;place-items:center;width:34px;height:34px;border-radius:11px;
      background:color-mix(in srgb,var(--dm-acq,#10b981) 18%,transparent)}
    ${P} .dm-acq-livello-ic .dm-catalogo-art{display:grid;place-items:center;line-height:0}
    ${P} .dm-acq-livello-ic svg{display:block;width:24px;height:24px}
    ${P} .dm-acq-livello-testo{display:grid;gap:3px;min-width:0}
    ${P} .dm-acq-livello-testo strong{font-size:13px;font-weight:900;color:var(--text,#0f172a);
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    ${P} .dm-acq-livello-testo small{font-size:11px;font-weight:700;color:var(--text-dim,#64748b)}
    ${P} .dm-acq-livello-barra{display:block;height:5px;border-radius:999px;margin-top:2px;
      background:color-mix(in srgb,var(--dm-acq,#10b981) 18%,transparent);overflow:hidden}
    ${P} .dm-acq-livello-barra i{display:block;height:100%;border-radius:999px;background:var(--dm-acq,#10b981)}
    ${P} .dm-acq-livello-stato{font-size:12.5px;font-weight:900;text-align:right;line-height:1.2;
      color:color-mix(in srgb,var(--dm-acq,#10b981) 78%,var(--text,#0f172a))}

    /* Il cambio d'acqua: un anello più piccolo, un tasto solo largo quanto la
       colonna; e quando è in ritardo l'anello si scalda come la risposta. */
    ${P} .dm-acq-cambio .dm-pool-filtration-body{gap:12px}
    ${P} .dm-acq-cambio .dm-ring{width:76px;height:76px}
    ${P} .dm-acq-cambio .dm-ring-core{width:58px;height:58px}
    ${P} .dm-acq-cambio .dm-ring-core b{font-size:18px}
    ${P} .dm-acq-cambio .dm-ring-core i{font-size:10px}
    ${P} .dm-acq-azioni{grid-template-columns:minmax(0,1fr)}
    ${P} .dm-acq-cambio[data-stato="scaduto"] .dm-ring{
      background:conic-gradient(from -90deg,#f59e0b 0 calc(var(--pct,0) * 1%),var(--surface-3,#e2e8f0) 0)}
    `,
  );
}

export function installAcquario() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  travasaSeServe();
  doc.addEventListener?.("click", (evento) => {
    const dentro = evento.target?.closest?.(`#${VASCHE_PAGE_ID}`);
    if (!dentro) return;
    const mattonella = evento.target.closest("[data-dm-acq-comando]");
    if (mattonella) {
      evento.preventDefault();
      commuta(mattonella.dataset.dmAcqComando);
      return;
    }
    const cambio = evento.target.closest("[data-dm-acq-cambio]");
    if (cambio) {
      evento.preventDefault();
      segnaIlCambio(cambio.dataset.dmAcqCambio);
      return;
    }
    const annulla = evento.target.closest("[data-dm-acq-annulla]");
    if (annulla) {
      evento.preventDefault();
      annullaIlCambio(annulla.dataset.dmAcqAnnulla);
    }
  });
  /* La configurazione arriva da Home Assistant dopo l'avvio: è lì che
   * `cd_acquario` c'è davvero, ed è lì che il travaso ha qualcosa da fare. */
  for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:persistence-restored"])
    root.addEventListener?.(evento, () => senzaCadere(travasaSeServe));
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:persistence-restored",
    /* La tessera in Home c'è solo dopo che la Home si è dipinta: è lì che si
     * sa se qualcuno la sta guardando. */
    "dashboardmodern:widgets-painted",
  ])
    root.addEventListener?.(evento, schedule);
  doc.addEventListener?.("visibilitychange", schedule);
  quandoSiCambiaPagina(schedule);
  schedule();
  return true;
}

senzaCadere(installAcquario);
