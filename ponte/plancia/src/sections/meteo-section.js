/* La pagina Meteo (#206).
 *
 * «Una pagina tutta per il meteo: com'è adesso, cosa misura la mia stazione,
 * e cosa arriva.» La plancia il meteo ce l'aveva già, ma a pezzi: la striscia
 * nella testata della Home, la finestra delle previsioni con il radar, e i
 * sensori della stazione che leggevano la testata, l'irrigazione e la riga
 * «Come sta la casa». Qui stanno insieme, come nel render approvato:
 *
 *   · Adesso: l'icona e i gradi grandi, la condizione, la percepita, la
 *     minima e la massima di oggi; accanto la frase sulle prossime ore —
 *     «Pioggia in arrivo verso le 19:00» — e le pastiglie dell'umidità, del
 *     vento, della pressione, dell'alba e del tramonto;
 *   · La mia stazione: una tessera per sensore, ognuna con le sue ultime
 *     ventiquattro ore chieste alla cronologia di Home Assistant. Una tessera
 *     senza sensore non compare; senza nessun sensore, a chi configura la
 *     plancia si propone di aggiungerli;
 *   · Prossime 24 ore e Prossimi giorni, da `weather.get_forecasts`;
 *   · il Radar pioggia, lo stesso della finestra delle previsioni e con la
 *     stessa configurazione, più grande.
 *
 * La voce nella barra sta accanto a Temperatura e compare da sola quando c'è
 * un'entità weather: senza, la pagina non avrebbe niente da dire. Le domande a
 * Home Assistant partono solo mentre la pagina si vede: le previsioni ogni
 * mezz'ora, la cronologia ogni cinque minuti.
 */
import {
  CHIAVE_METEO,
  MISURE_DELLA_STAZIONE,
  blocchiDellaPagina,
  domandaDelleUltimeOre,
  fasciaUV,
  gradiDelVento,
  letturaDellaStazione,
  minimoEMassimo,
  normalizzaMeteo,
  pioggiaOraPerOra,
  puntoDiRugiada,
  serieAPassoFisso,
  serieDallaStoria,
  spicchioDelVento,
  tendenzaDellaPressione,
  vistaDelMeteoDa,
} from "../core/la-pagina-meteo.js";
import { inMillimetri, stapiovendo } from "../core/pioggia-caduta.js";
import { quantoTempoInParole } from "../core/da-quanto.js";
import { disegnoDelCatalogo } from "../core/catalogo-disegni.js";
import { segnoDelTempo } from "../core/la-card-del-meteo.js";
import {
  accogliLePrevisioniDeiGiorni,
  entitaDelMeteo,
  previsioniDeiGiorniFresche,
} from "./la-card-del-meteo-section.js";
import { disegnaRadarIn, radarScelto } from "./radar-meteo-section.js";
import { puoConfigurare } from "./la-config-e-di-chi-la-amministra-section.js";
import { registraTitoloDiPagina } from "./page-masthead-section.js";
import {
  allStates,
  chiediAHomeAssistant,
  clean,
  doc,
  esc,
  formatNumber,
  installStyle,
  lexicalGlobal,
  locale,
  paginaVisibile,
  planciaVisibile,
  quandoSiCambiaPagina,
  readJson,
  root,
  scriviSeCambia,
  segnaContenuto,
  senzaCadere,
  t,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_METEO_PAGE__";
const state = (root[KEY] ||= {
  installed: false,
  frame: 0,
  sveglia: 0,
  /* Le previsioni: di chi sono, quando sono arrivate, e le due file. */
  previsioni: { entita: "", chieste: 0, fallite: 0, inVolo: false, orarie: [], giornaliere: [] },
  /* La cronologia delle ultime ventiquattro ore, per entita'. */
  storia: { firma: "", chiesta: 0, fallita: 0, inVolo: false, serie: {} },
});

export const METEO_PAGE_ID = "page-meteo";
export const METEO_TAB = "meteo";

/* Mezz'ora per le previsioni, come la card del meteo: cambiano due volte al
 * giorno. Cinque minuti per la cronologia: le tessere dicono «ultime 24 ore»,
 * e una linea ferma da un'ora mentre il numero sopra cambia sembrerebbe un
 * errore. Un minuto quando una domanda e' caduta. */
const OGNI_PREVISIONI = 30 * 60_000;
const OGNI_STORIA = 5 * 60_000;
const DOPO_UN_ERRORE = 60_000;
const ATTESA = 20_000;
/* Il battito mentre la pagina si vede: rinfresca «aggiornate 2 minuti fa» e
 * fa ripartire le domande quando e' ora. */
const BATTITO = 60_000;
const H = 3_600_000;

/* ── cosa e' configurato ──────────────────────────────────────────────── */

/* Le caselle della testata: quelle scritte e quelle che il guscio tiene in
 * memoria, che sono le stesse appena salvate. */
function mappature() {
  const scritte = readJson("cd_entity_overrides", {}) || {};
  const vive = lexicalGlobal("ENTITY_OVERRIDES");
  return { ...(scritte && typeof scritte === "object" ? scritte : {}), ...(vive && typeof vive === "object" ? vive : {}) };
}

/** I sensori della stazione: `{ misura: entità }`, solo quelli scelti. */
export function sensoriDellaStazione() {
  const caselle = mappature();
  const barra = readJson("cd_barra_casa", {}) || {};
  const pagina = normalizzaMeteo(readJson(CHIAVE_METEO, {}));
  const fuori = {};
  for (const misura of MISURE_DELLA_STAZIONE) {
    const entita = clean(
      misura.casella ? caselle[misura.casella] : misura.barra ? barra?.[misura.barra] : pagina[misura.pagina],
    );
    if (entita.includes(".") && entita !== misura.casella) fuori[misura.chiave] = entita;
  }
  return fuori;
}

/* ── le domande a Home Assistant ──────────────────────────────────────── */

function serveLeggere() {
  if (!planciaVisibile()) return false;
  return Boolean(doc?.getElementById?.(METEO_PAGE_ID)?.classList?.contains("active"));
}

function chiediLePrevisioni(entita, tipo) {
  return chiediAHomeAssistant(
    {
      type: "call_service",
      domain: "weather",
      service: "get_forecasts",
      service_data: { type: tipo },
      target: { entity_id: entita },
      return_response: true,
    },
    ATTESA,
  ).then((risposta) => {
    const elenco = risposta?.response?.[entita]?.forecast;
    return Array.isArray(elenco) ? elenco : [];
  });
}

async function aggiornaLePrevisioni(entita) {
  const p = state.previsioni;
  const adesso = Date.now();
  if (p.inVolo) return;
  if (p.entita === entita && p.chieste && adesso - p.chieste < OGNI_PREVISIONI) return;
  if (p.entita === entita && p.fallite && adesso - p.fallite < DOPO_UN_ERRORE) return;
  if (p.entita !== entita) {
    p.entita = entita;
    p.orarie = [];
    p.giornaliere = [];
  }
  p.inVolo = true;
  try {
    /* I giorni, se la card del meteo li ha appena chiesti, sono gia' qui. */
    const giornaliere = previsioniDeiGiorniFresche(entita);
    const [orarie, giorni] = await Promise.allSettled([
      chiediLePrevisioni(entita, "hourly"),
      giornaliere ? Promise.resolve(giornaliere) : chiediLePrevisioni(entita, "daily"),
    ]);
    if (orarie.status === "rejected" && giorni.status === "rejected") throw orarie.reason;
    p.orarie = orarie.status === "fulfilled" ? orarie.value : [];
    p.giornaliere = giorni.status === "fulfilled" ? giorni.value : [];
    /* Chi ha Home Assistant di prima del 2024 le teneva negli attributi. */
    const vecchie = allStates()?.[entita]?.attributes?.forecast;
    if (!p.giornaliere.length && Array.isArray(vecchie)) p.giornaliere = vecchie;
    if (!giornaliere && p.giornaliere.length) accogliLePrevisioniDeiGiorni(entita, p.giornaliere);
    p.chieste = Date.now();
    p.fallite = 0;
    avvisaChiAspetta();
  } catch (errore) {
    /* Senza presa non si e' chiesto niente: la plancia si sta collegando, e
     * il suo annuncio fara' ridisegnare. */
    if (errore?.message !== "socket") p.fallite = Date.now();
    p.chieste = 0;
  } finally {
    p.inVolo = false;
  }
  schedule();
}

async function aggiornaLaStoria(entita) {
  const s = state.storia;
  const elenco = [...new Set(entita)].sort();
  if (!elenco.length || s.inVolo) return;
  const firma = elenco.join(",");
  const adesso = Date.now();
  if (s.firma === firma && s.chiesta && adesso - s.chiesta < OGNI_STORIA) return;
  if (s.firma === firma && s.fallita && adesso - s.fallita < DOPO_UN_ERRORE) return;
  s.inVolo = true;
  try {
    const risposta = await chiediAHomeAssistant(domandaDelleUltimeOre(elenco, adesso), ATTESA);
    const serie = {};
    for (const entity of elenco)
      serie[entity] = serieDallaStoria(risposta, entity, { inizio: adesso - 24 * H });
    s.serie = serie;
    s.firma = firma;
    s.chiesta = Date.now();
    s.fallita = 0;
    const tutti = [...chiAspettaLaStoria];
    chiAspettaLaStoria.clear();
    for (const avvisa of tutti) {
      try {
        avvisa();
      } catch (_errore) {}
    }
  } catch (errore) {
    if (errore?.message !== "socket") s.fallita = Date.now();
    s.firma = firma;
    s.chiesta = 0;
  } finally {
    s.inVolo = false;
  }
  schedule();
}

/* Le previsioni per chi le mostra fuori da questa pagina: la pagina Meteo
 * della plancia a muro. «Usa le previsioni come le prende gia' la sezione
 * meteo»: la stessa domanda, la stessa mezz'ora, lo stesso minuto dopo un
 * errore, e i giorni divisi con la card. Due pagine che chiedessero ognuna
 * per conto suo farebbero due giri sul socket per le stesse righe.
 *
 * Restituisce quelle che ci sono adesso (vuote se sono di un'altra entita');
 * `quandoArrivano` si chiama una volta, quando le prossime sono arrivate. */
const chiAspetta = new Set();
function avvisaChiAspetta() {
  const tutti = [...chiAspetta];
  chiAspetta.clear();
  for (const avvisa of tutti) {
    try {
      avvisa();
    } catch (_errore) {}
  }
}
export function previsioniDelMeteo(entita, quandoArrivano = null) {
  const nessuna = { orarie: [], giornaliere: [], pronte: false };
  if (!clean(entita)) return nessuna;
  if (typeof quandoArrivano === "function") chiAspetta.add(quandoArrivano);
  aggiornaLePrevisioni(entita).catch(() => {});
  const p = state.previsioni;
  /* `pronte`: la domanda e' gia' tornata, e quello che manca manca davvero. */
  return p.entita === entita
    ? { orarie: p.orarie, giornaliere: p.giornaliere, pronte: Boolean(p.chieste) }
    : nessuna;
}

/* La cronologia della stazione per chi la mostra fuori da questa pagina: la
 * pagina Meteo della plancia a muro. La stessa domanda di qui, la stessa
 * cache, gli stessi cinque minuti e lo stesso minuto dopo un errore: chiamata
 * a ogni ridisegno del tablet, a Home Assistant si chiede solo quando e' ora.
 * Nessun giro in piu': la chiama il battito che il tablet ha gia'.
 * `quandoArriva` si chiama una volta, quando la prossima e' arrivata. */
const chiAspettaLaStoria = new Set();
export function storiaDellaStazione(sensori, quandoArriva = null) {
  const elenco = Object.values(sensori || {}).filter((entity) => clean(entity).includes("."));
  if (!elenco.length) return false;
  if (typeof quandoArriva === "function") chiAspettaLaStoria.add(quandoArriva);
  aggiornaLaStoria(elenco).catch(() => {});
  return Boolean(state.storia.chiesta);
}

/* La serie di un'entita', con il valore di adesso in fondo: la cronologia e'
 * di cinque minuti fa, lo stato e' di adesso. */
function serieDi(entity, lettura, adesso = Date.now()) {
  const serie = Array.isArray(state.storia.serie?.[entity]) ? [...state.storia.serie[entity]] : [];
  if (lettura && Number.isFinite(lettura.valore)) serie.push({ quando: adesso, valore: lettura.valore });
  return serie;
}

/* ── la pagina e la sua voce nella barra ──────────────────────────────── */

function ultimaPagina() {
  const pagine = doc?.querySelectorAll?.(".page");
  return pagine?.length ? pagine[pagine.length - 1] : null;
}

export function ensureMeteoPage() {
  if (!doc) return null;
  let pagina = doc.getElementById(METEO_PAGE_ID);
  if (pagina) return pagina;
  const sorella = ultimaPagina();
  if (!sorella?.parentElement) return null;
  pagina = doc.createElement("section");
  pagina.className = "page";
  pagina.id = METEO_PAGE_ID;
  pagina.innerHTML = `<div class="dm-meteo-wrap" id="meteo-wrap"></div>`;
  sorella.after(pagina);
  return pagina;
}

function apriLaPagina(voce) {
  for (const nodo of doc.querySelectorAll(".tab")) nodo.classList.remove("active");
  for (const nodo of doc.querySelectorAll(".page")) nodo.classList.remove("active");
  voce?.classList.add("active");
  ensureMeteoPage()?.classList.add("active");
  const testata = doc.querySelector("header");
  if (testata) testata.style.display = "none";
  root.scrollTo?.({ top: 0, behavior: "instant" });
  if (root.navigator?.vibrate) root.navigator.vibrate(5);
  schedule();
}

export function ensureMeteoTab() {
  if (!doc) return null;
  let voce = doc.querySelector(`.tab[data-tab="${METEO_TAB}"]`);
  if (voce) return voce;
  const barra = doc.querySelector("nav.tabs");
  if (!barra) return null;
  /* Accanto alla Temperatura: e' la stessa domanda — che aria fa — guardata
   * fuori invece che stanza per stanza. */
  const dopo =
    barra.querySelector('.tab[data-tab="temp"]') ||
    barra.querySelector('.tab[data-tab="clima"]') ||
    barra.querySelector('.tab[data-tab="home"]');
  voce = doc.createElement("button");
  voce.className = "tab";
  voce.dataset.tab = METEO_TAB;
  voce.id = `tab-${METEO_TAB}`;
  voce.innerHTML = `<span class="icon">🌦️</span><span class="text">${esc(t("Meteo", "Weather"))}</span>`;
  voce.addEventListener("click", () => apriLaPagina(voce));
  if (dopo) dopo.after(voce);
  else barra.append(voce);
  return voce;
}

function sezioneAccesa() {
  const sezioni = readJson("cd_sections", {});
  return !(sezioni && typeof sezioni === "object" && sezioni[METEO_TAB] === false);
}

/* La voce si governa da se': c'e' quando c'e' un'entita' weather e nessuno
 * l'ha spenta. */
function accendiLaVoce(entita) {
  const voce = ensureMeteoTab();
  if (!voce) return false;
  const serve = segnaContenuto(METEO_TAB, Boolean(entita)) && sezioneAccesa();
  if (serve) voce.style.removeProperty("display");
  else voce.style.setProperty("display", "none", "important");
  const pagina = doc.getElementById(METEO_PAGE_ID);
  if (!serve && pagina?.classList.contains("active"))
    doc.querySelector('.tab[data-tab="home"]')?.click();
  return serve;
}

/* Il Config, aperto sulla scheda Meteo: l'invito della stazione porta li'. */
export function apriMeteoNelConfig() {
  if (typeof root.apriConfigEntita !== "function") return false;
  root.apriConfigEntita();
  let giri = 0;
  const vai = () => {
    if (doc?.querySelector?.(`#editor-modal .ed-tab[data-tab="${METEO_TAB}"]`)) {
      try {
        root.editorSwitch?.(METEO_TAB);
      } catch (_errore) {}
      return;
    }
    if (giri++ < 60) (root.requestAnimationFrame || root.setTimeout)?.(vai, 16);
  };
  vai();
  return true;
}

/* ── le parole ────────────────────────────────────────────────────────── */

const SPAZIO = " ";

/* Quante cifre dopo la virgola: le misure piccole ne vogliono una, le grandi
 * nessuna — «1009 hPa», non «1009,2». */
function numeroBello(valore, cifre = null) {
  const n = Number(valore);
  if (!Number.isFinite(n)) return "—";
  const quante = cifre ?? (Math.abs(n) < 100 && Math.round(n) !== n ? 1 : 0);
  /* Senza il separatore delle migliaia: «1.009 hPa» sembra un ettopascal e
   * nove millesimi a chi legge in fretta, e nessun barometro lo scrive. */
  try {
    return new Intl.NumberFormat(locale(), {
      minimumFractionDigits: quante,
      maximumFractionDigits: quante,
      useGrouping: false,
    }).format(n);
  } catch (_errore) {
    return formatNumber(n, quante);
  }
}

function oraDi(quando) {
  if (!Number.isFinite(quando)) return "";
  try {
    return new Date(quando).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });
  } catch (_errore) {
    return "";
  }
}

function soloLOra(quando) {
  try {
    return new Date(quando).toLocaleTimeString(locale(), { hour: "2-digit" }).replace(/\D+$/, "");
  } catch (_errore) {
    return String(new Date(quando).getHours()).padStart(2, "0");
  }
}

function nomeDelGiorno(voce) {
  if (voce.oggi) return t("Oggi", "Today");
  try {
    const nome = new Intl.DateTimeFormat(locale(), { weekday: "short", day: "numeric" }).format(
      new Date(voce.quando),
    );
    return nome.charAt(0).toLocaleUpperCase(locale()) + nome.slice(1);
  } catch (_errore) {
    return "";
  }
}

export function parolaDellaCondizione(condizione) {
  const parole = {
    "clear-night": t("Sereno", "Clear"),
    cloudy: t("Nuvoloso", "Cloudy"),
    exceptional: t("Eccezionale", "Exceptional"),
    fog: t("Nebbia", "Fog"),
    hail: t("Grandine", "Hail"),
    lightning: t("Temporale", "Thunderstorm"),
    "lightning-rainy": t("Temporale con pioggia", "Thunderstorm and rain"),
    partlycloudy: t("Poco nuvoloso", "Partly cloudy"),
    pouring: t("Pioggia forte", "Heavy rain"),
    rainy: t("Pioggia", "Rain"),
    snowy: t("Neve", "Snow"),
    "snowy-rainy": t("Neve e pioggia", "Sleet"),
    sunny: t("Soleggiato", "Sunny"),
    windy: t("Ventoso", "Windy"),
    "windy-variant": t("Ventoso e nuvoloso", "Windy and cloudy"),
  };
  return parole[clean(condizione).toLowerCase()] || clean(condizione);
}

/* Gli otto spicchi della rosa, con la sigla e il nome. */
function spicchi() {
  return [
    [t("N", "N"), t("nord", "north")],
    [t("NE", "NE"), t("nord-est", "north-east")],
    [t("E", "E"), t("est", "east")],
    [t("SE", "SE"), t("sud-est", "south-east")],
    [t("S", "S"), t("sud", "south")],
    [t("SO", "SW"), t("sud-ovest", "south-west")],
    [t("O", "W"), t("ovest", "west")],
    [t("NO", "NW"), t("nord-ovest", "north-west")],
  ];
}

function parolaDellUV(fascia) {
  return (
    {
      basso: t("basso", "low"),
      moderato: t("moderato", "moderate"),
      alto: t("alto", "high"),
      "molto-alto": t("molto alto", "very high"),
      estremo: t("estremo", "extreme"),
    }[fascia] || ""
  );
}

/** La frase sulle prossime ore, in parole: `{ titolo, sotto, stato, segno }`. */
export function fraseInParole(frase) {
  if (!frase) return null;
  const ora = oraDi(frase.quando);
  /* I millimetri sono gia' millimetri: il nucleo li ha convertiti. */
  const quanta = frase.mm >= 0.1 ? `${numeroBello(frase.mm)}${SPAZIO}mm` : "";
  const probabile = Number.isFinite(frase.probabilita) ? `${Math.round(frase.probabilita)}%` : "";
  if (frase.tipo === "arriva")
    return {
      stato: "pioggia",
      segno: frase.neve ? "❄️" : "☔",
      titolo: frase.neve
        ? t(`Neve in arrivo verso le ${ora}`, `Snow coming around ${ora}`)
        : t(`Pioggia in arrivo verso le ${ora}`, `Rain coming around ${ora}`),
      sotto: [
        probabile ? t(`${probabile} di probabilità`, `${probabile} chance`) : "",
        quanta ? t(`circa ${quanta} nelle prossime 24 ore`, `about ${quanta} in the next 24 hours`) : "",
      ]
        .filter(Boolean)
        .join(" · "),
    };
  if (frase.tipo === "smette")
    return {
      stato: "pioggia",
      segno: "🌦️",
      titolo: t(`Smette di piovere verso le ${ora}`, `Rain stops around ${ora}`),
      sotto: quanta ? t(`circa ${quanta} nelle prossime 24 ore`, `about ${quanta} in the next 24 hours`) : "",
    };
  if (frase.tipo === "continua")
    return {
      stato: "pioggia",
      segno: "🌧️",
      titolo: t("Pioggia per tutte le prossime ore", "Rain for all the coming hours"),
      sotto: quanta ? t(`circa ${quanta} nelle prossime 24 ore`, `about ${quanta} in the next 24 hours`) : "",
    };
  return {
    stato: "asciutto",
    segno: "🌤️",
    titolo: t("Niente pioggia nelle prossime 24 ore", "No rain in the next 24 hours"),
    sotto: probabile ? t(`al massimo ${probabile} di probabilità`, `at most ${probabile} chance`) : "",
  };
}

/* ── i pezzi del disegno ──────────────────────────────────────────────── */

const icona = (nome, misura = 26) => disegnoDelCatalogo(nome, misura) || "";

function spark(valori, { colore, alto = 46, secondo = null, id = "s", prefisso = "" } = {}) {
  const tutti = (secondo ? valori.concat(secondo) : valori).filter(Number.isFinite);
  if (valori.length < 2 || !tutti.length) return "";
  const basso = Math.min(...tutti);
  const sopra = Math.max(...tutti);
  const W = 300;
  const bordo = 3;
  const y = (v) => bordo + (alto - 2 * bordo) * (1 - (v - basso) / (sopra - basso || 1));
  const x = (i, n) => (i / (n - 1)) * W;
  const linea = (vv) =>
    vv.map((v, i) => `${i ? "L" : "M"}${x(i, vv.length).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const area = `${linea(valori)}L${W},${alto}L0,${alto}Z`;
  return `<svg class="dm-meteo-spark" viewBox="0 0 ${W} ${alto}" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="dm-meteo-g-${prefisso}${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${colore}" stop-opacity=".28"/><stop offset="1" stop-color="${colore}" stop-opacity="0"/></linearGradient></defs>
      <path d="${area}" fill="url(#dm-meteo-g-${prefisso}${id})"/>
      ${secondo && secondo.length > 1 ? `<path d="${linea(secondo)}" fill="none" stroke="${colore}" stroke-opacity=".38" stroke-width="1.6" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>` : ""}
      <path d="${linea(valori)}" fill="none" stroke="${colore}" stroke-width="2.2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
      <circle cx="${W}" cy="${y(valori[valori.length - 1]).toFixed(1)}" r="3.2" fill="${colore}"/>
    </svg>`;
}

function barre(valori, colore, alto = 46) {
  if (!valori.length) return "";
  const sopra = Math.max(1, ...valori);
  const W = 300;
  const passo = W / valori.length;
  return `<svg class="dm-meteo-spark" viewBox="0 0 ${W} ${alto}" preserveAspectRatio="none" aria-hidden="true">
      <line x1="0" y1="${alto - 0.5}" x2="${W}" y2="${alto - 0.5}" stroke="currentColor" stroke-opacity=".12"/>
      ${valori
        .map((v, i) => {
          const a = Math.max(v > 0 ? 3 : 0, (v / sopra) * (alto - 6));
          return `<rect x="${(i * passo + 2).toFixed(1)}" y="${(alto - a).toFixed(1)}" width="${Math.max(1, passo - 4).toFixed(1)}" height="${a.toFixed(1)}" rx="2" fill="${colore}"/>`;
        })
        .join("")}
    </svg>`;
}

/* La rosa dei venti. La freccia dice DOVE VA il vento: i gradi della
 * meteorologia dicono da dove arriva, e per questo si gira di mezzo giro. */
function bussola(gradi) {
  const tacche = Array.from({ length: 12 }, (_, i) => {
    const a = (i * 30 * Math.PI) / 180;
    const r1 = i % 3 ? 40 : 37;
    return `<line x1="${(50 + Math.sin(a) * r1).toFixed(1)}" y1="${(50 - Math.cos(a) * r1).toFixed(1)}" x2="${(50 + Math.sin(a) * 44).toFixed(1)}" y2="${(50 - Math.cos(a) * 44).toFixed(1)}" stroke="currentColor" stroke-opacity=".35" stroke-width="${i % 3 ? 1 : 2}"/>`;
  }).join("");
  const [n, , e, , s, , o] = spicchi().map((voce) => esc(voce[0]));
  const freccia = Number.isFinite(gradi)
    ? `<g data-dm-meteo-freccia="${Math.round((gradi + 180) % 360)}" transform="rotate(${(gradi + 180) % 360} 50 50)">
        <path d="M50 16 L57 34 L50 30 L43 34 Z" fill="var(--dm-meteo-c)"/>
        <line x1="50" y1="30" x2="50" y2="76" stroke="var(--dm-meteo-c)" stroke-width="4" stroke-linecap="round"/>
        <circle cx="50" cy="76" r="4" fill="none" stroke="var(--dm-meteo-c)" stroke-width="2.5"/>
      </g>`
    : "";
  return `<svg class="dm-meteo-bussola" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="46" fill="color-mix(in srgb,var(--dm-meteo-c) 10%,transparent)" stroke="color-mix(in srgb,var(--dm-meteo-c) 40%,transparent)" stroke-width="1.5"/>
      ${tacche}
      <text x="50" y="22" text-anchor="middle">${n}</text><text x="81" y="54" text-anchor="middle">${e}</text>
      <text x="50" y="86" text-anchor="middle">${s}</text><text x="19" y="54" text-anchor="middle">${o}</text>
      ${freccia}
    </svg>`;
}

function scalaUV(uv) {
  const posto = Math.max(0, Math.min(100, (uv / 11) * 100));
  return `<div class="dm-meteo-uv"><span class="dm-meteo-uv-barra"><i style="left:${posto.toFixed(1)}%"></i></span>
      <span class="dm-meteo-uv-tacche"><em>0</em><em>3</em><em>6</em><em>8</em><em>11+</em></span></div>`;
}

function tessera({ chiave, disegno, nome, valore, unita, sotto, grafico, stato, colore, largo, extra = "" }) {
  return `<article class="dm-meteo-tessera${largo ? " dm-meteo-larga" : ""}" data-dm-meteo-misura="${chiave}" style="--dm-meteo-c:${colore}">
      <div class="dm-meteo-tessera-testa">
        <span class="dm-meteo-ic" aria-hidden="true">${icona(disegno, 26)}</span>
        <span class="dm-meteo-nome">${esc(nome)}</span>
        ${stato ? `<span class="dm-meteo-stato">${esc(stato)}</span>` : ""}
      </div>
      ${extra}
      <div class="dm-meteo-valore"><b>${esc(valore)}</b><i>${esc(unita)}</i></div>
      <small class="dm-meteo-sotto">${sotto || ""}</small>
      ${grafico ? `<div class="dm-meteo-grafico">${grafico}<span class="dm-meteo-24">24 h</span></div>` : ""}
    </article>`;
}

function titoloMarkup(disegno, titolo, sotto = "") {
  return `<h3 class="dm-meteo-titolo"><span aria-hidden="true">${icona(disegno, 20)}</span><span>${esc(titolo)}</span>${
    sotto ? `<small>${esc(sotto)}</small>` : ""
  }</h3>`;
}

const b = (testo) => `<b>${esc(testo)}</b>`;

/* ── i blocchi ────────────────────────────────────────────────────────── */

function adessoMarkup(vista) {
  const { meteo, entita, misure, frase, oggi, sole } = vista;
  const temperatura = misure.temperatura;
  const unitaT = clean(temperatura?.unita) || "°C";
  const gradi = (valore) => `${numeroBello(valore, 0)}°`;
  const sotto = [
    misure.percepita ? `${esc(t("Percepita", "Feels like"))} ${b(`${numeroBello(misure.percepita.valore, 1)}°`)}` : "",
    oggi?.bassa != null ? `${esc(t("Min", "Min"))} ${b(gradi(oggi.bassa))}` : "",
    oggi?.alta != null ? `${esc(t("Max", "Max"))} ${b(gradi(oggi.alta))}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const parole = fraseInParole(frase);
  const pastiglia = (segno, testo) =>
    `<span class="dm-meteo-pill"><span aria-hidden="true">${segno}</span><span>${testo}</span></span>`;
  const pastiglie = [];
  if (misure.umidita)
    pastiglie.push(pastiglia("💧", `${esc(t("Umidità", "Humidity"))} ${b(`${numeroBello(misure.umidita.valore, 0)}%`)}`));
  if (misure.vento) {
    const spicchio = spicchioDelVento(misure.direzione?.valore);
    pastiglie.push(
      pastiglia(
        "💨",
        `${esc(t("Vento", "Wind"))} ${b(`${numeroBello(misure.vento.valore, 0)} ${misure.vento.unita}`)}${
          spicchio === null ? "" : ` ${esc(spicchi()[spicchio][0])}`
        }`,
      ),
    );
  }
  if (misure.pressione)
    pastiglie.push(
      pastiglia("⏲️", `${esc(t("Pressione", "Pressure"))} ${b(`${numeroBello(misure.pressione.valore, 0)} ${misure.pressione.unita}`)}`),
    );
  if (sole)
    pastiglie.push(
      pastiglia(
        "🌅",
        [
          sole.alba ? `${esc(t("Alba", "Sunrise"))} ${b(sole.alba)}` : "",
          sole.tramonto ? `${esc(t("Tramonto", "Sunset"))} ${b(sole.tramonto)}` : "",
        ]
          .filter(Boolean)
          .join(" · "),
      ),
    );
  const nome = clean(meteo?.attributes?.friendly_name) || entita;
  const daStazione = Object.values(misure).some((misura) => misura.fonte === "stazione");
  const fonte = daStazione
    ? `${t("Misure: la tua stazione", "Readings: your station")} · ${t("Previsioni", "Forecast")}: ${nome} (${entita})`
    : `${t("Misure e previsioni", "Readings and forecast")}: ${nome} (${entita})`;
  return `<section class="dm-meteo-adesso" data-dm-meteo-blocco="adesso">
      <div class="dm-meteo-adesso-sx">
        <span class="dm-meteo-adesso-ic" aria-hidden="true">${segnoDelTempo(meteo?.state)}</span>
        <div class="dm-meteo-adesso-gradi">
          <b data-dm-meteo-gradi>${temperatura ? esc(numeroBello(temperatura.valore, 1)) : "—"}<i>${esc(unitaT.startsWith("°") ? "°" : unitaT)}</i></b>
          <span class="dm-meteo-adesso-cond">${esc(parolaDellaCondizione(meteo?.state))}</span>
          ${sotto ? `<small>${sotto}</small>` : ""}
        </div>
      </div>
      <div class="dm-meteo-adesso-dx">
        ${
          parole
            ? `<div class="dm-meteo-frase" data-stato="${parole.stato}" data-dm-meteo-frase>
          <span aria-hidden="true">${parole.segno}</span>
          <div><strong>${esc(parole.titolo)}</strong>${parole.sotto ? `<small>${esc(parole.sotto)}</small>` : ""}</div>
        </div>`
            : ""
        }
        ${pastiglie.length ? `<div class="dm-meteo-pills">${pastiglie.join("")}</div>` : ""}
        <small class="dm-meteo-fonte" data-dm-meteo-fonte>${esc(fonte)}</small>
      </div>
    </section>`;
}

function stazioneMarkup(vista) {
  const { stazione, adesso } = vista;
  /* Il muro mette la sua pagina accanto a questa: i gradienti delle linee
   * hanno un nome loro, o il secondo dipingerebbe col primo, nascosto. */
  const prefisso = clean(vista.prefisso);
  const inizio = adesso - 24 * H;
  const passo = (lettura) => serieAPassoFisso(serieDi(lettura.entity, lettura, adesso), { inizio, fine: adesso });
  const tessere = [];
  const quando = (punto) => oraDi(punto?.quando);

  const temp = stazione.temperatura;
  if (temp) {
    const estremi = minimoEMassimo(serieDi(temp.entity, temp, adesso), { da: inizio });
    tessere.push(
      tessera({
        chiave: "temperatura",
        disegno: "thermometer",
        nome: t("Temperatura esterna", "Outdoor temperature"),
        valore: numeroBello(temp.valore, 1),
        unita: temp.unita || "°C",
        sotto: estremi
          ? `${esc(t("min", "min"))} ${b(`${numeroBello(estremi.minimo.valore, 1)}°`)} ${esc(t("alle", "at"))} ${esc(quando(estremi.minimo))} · ${esc(t("max", "max"))} ${b(`${numeroBello(estremi.massimo.valore, 1)}°`)} ${esc(t("alle", "at"))} ${esc(quando(estremi.massimo))}`
          : "",
        grafico: spark(passo(temp), { colore: "#f97316", id: "temperatura", prefisso }),
        colore: "#f97316",
      }),
    );
  }

  const umidita = stazione.umidita;
  if (umidita) {
    const tGradi = temp || vista.misure.temperatura;
    const rugiada = tGradi ? puntoDiRugiada(tGradi.valore, umidita.valore, tGradi.unita || "°C") : null;
    tessere.push(
      tessera({
        chiave: "umidita",
        disegno: "humidity",
        nome: t("Umidità", "Humidity"),
        valore: numeroBello(umidita.valore, 0),
        unita: umidita.unita || "%",
        sotto: rugiada === null ? "" : `${esc(t("punto di rugiada", "dew point"))} ${b(`${numeroBello(rugiada, 1)}°`)}`,
        grafico: spark(passo(umidita), { colore: "#0ea5e9", id: "umidita", prefisso }),
        colore: "#0ea5e9",
      }),
    );
  }

  const pressione = stazione.pressione;
  if (pressione) {
    const tendenza = tendenzaDellaPressione(serieDi(pressione.entity, pressione, adesso), {
      adesso,
      unita: pressione.unita || "hPa",
    });
    const stato = !tendenza
      ? ""
      : tendenza.verso === "calo"
        ? `↘ ${t("in calo", "falling")}`
        : tendenza.verso === "aumento"
          ? `↗ ${t("in aumento", "rising")}`
          : `→ ${t("stabile", "steady")}`;
    const differenza = tendenza
      ? `${tendenza.differenzaHpa > 0 ? "+" : tendenza.differenzaHpa < 0 ? "−" : ""}${numeroBello(Math.abs(tendenza.differenzaHpa), 0)} hPa`
      : "";
    const giudizio = !tendenza?.forte
      ? ""
      : tendenza.verso === "calo"
        ? `: ${t("tempo in peggioramento", "weather getting worse")}`
        : `: ${t("tempo in miglioramento", "weather improving")}`;
    tessere.push(
      tessera({
        chiave: "pressione",
        disegno: "gauge",
        nome: t("Pressione", "Pressure"),
        valore: numeroBello(pressione.valore, /hpa|mbar/i.test(pressione.unita) || !pressione.unita ? 0 : null),
        unita: pressione.unita || "hPa",
        stato,
        sotto: tendenza ? `${b(differenza)} ${esc(t("nelle ultime 3 ore", "in the last 3 hours"))}${esc(giudizio)}` : "",
        grafico: spark(passo(pressione), { colore: "#8b5cf6", id: "pressione", prefisso }),
        colore: "#8b5cf6",
      }),
    );
  }

  const oggi = stazione.pioggiaOggi;
  const intensita = stazione.intensita;
  if (oggi || intensita) {
    const adessoMmH = intensita ? inMillimetri(intensita.valore, intensita.unita) : null;
    const piove = adessoMmH !== null && stapiovendo(adessoMmH);
    const ore = oggi ? pioggiaOraPerOra(serieDi(oggi.entity, oggi, adesso), { adesso, unita: oggi.unita || "mm" }) : [];
    const ultima = [...ore].reverse().find((casella) => casella.mm > 0);
    const valore = oggi ? inMillimetri(oggi.valore, oggi.unita) : adessoMmH;
    tessere.push(
      tessera({
        chiave: "pioggia",
        disegno: "water",
        nome: t("Pioggia", "Rain"),
        valore: numeroBello(valore, 1),
        unita: oggi ? t("mm oggi", "mm today") : "mm/h",
        stato: intensita ? (piove ? t("piove", "raining") : t("asciutto", "dry")) : "",
        sotto: [
          intensita && oggi ? `${esc(t("adesso", "now"))} ${b(`${numeroBello(adessoMmH, 1)} mm/h`)}` : "",
          ultima ? `${esc(t("ultima pioggia alle", "last rain at"))} ${esc(oraDi(ultima.quando))}` : "",
        ]
          .filter(Boolean)
          .join(" · "),
        grafico: oggi
          ? barre(
              ore.map((casella) => casella.mm),
              "#0284c7",
            )
          : spark(passo(intensita), { colore: "#0284c7", id: "pioggia", prefisso }),
        colore: "#0284c7",
      }),
    );
  }

  const vento = stazione.vento;
  if (vento) {
    const raffica = stazione.raffica;
    const direzione = stazione.direzione;
    const gradi = direzione ? gradiDelVento(direzione.valore) : null;
    const spicchio = gradi === null ? null : spicchioDelVento(gradi);
    tessere.push(
      tessera({
        chiave: "vento",
        disegno: "wind",
        nome: t("Vento", "Wind"),
        largo: true,
        valore: numeroBello(vento.valore, 0),
        unita: vento.unita || "km/h",
        sotto: [
          raffica ? `${esc(t("raffica", "gust"))} ${b(`${numeroBello(raffica.valore, 0)} ${raffica.unita || vento.unita}`)}` : "",
          spicchio === null
            ? ""
            : `${esc(t("da", "from"))} ${b(spicchi()[spicchio][1])} (${Math.round(gradi)}°)`,
        ]
          .filter(Boolean)
          .join(" · "),
        grafico: spark(passo(vento), {
          colore: "#14b8a6",
          id: "vento",
          prefisso,
          secondo: raffica ? passo(raffica) : null,
        }),
        colore: "#14b8a6",
        extra: direzione ? bussola(gradi) : "",
      }),
    );
  }

  const uv = stazione.uv;
  if (uv) {
    const mezzanotte = new Date(adesso);
    mezzanotte.setHours(0, 0, 0, 0);
    const estremi = minimoEMassimo(serieDi(uv.entity, uv, adesso), { da: mezzanotte.getTime() });
    tessere.push(
      tessera({
        chiave: "uv",
        disegno: "sun",
        nome: t("Indice UV", "UV index"),
        valore: numeroBello(uv.valore),
        unita: parolaDellUV(fasciaUV(uv.valore)),
        sotto: estremi
          ? `${esc(t("massimo di oggi", "today's peak"))} ${b(numeroBello(estremi.massimo.valore))} ${esc(t("alle", "at"))} ${esc(quando(estremi.massimo))}`
          : "",
        grafico: scalaUV(uv.valore),
        colore: "#eab308",
      }),
    );
  }

  const radiazione = stazione.radiazione;
  const luce = stazione.luminosita;
  if (radiazione || luce) {
    const principale = radiazione || luce;
    const lux = (lettura) =>
      /^lx$/i.test(lettura.unita) && lettura.valore >= 1000
        ? `${numeroBello(lettura.valore / 1000, 0)} klx`
        : `${numeroBello(lettura.valore, 0)} ${lettura.unita || "lx"}`;
    const picco = minimoEMassimo(serieDi(principale.entity, principale, adesso), { da: inizio })?.massimo;
    const valoreLuce = !radiazione && /^lx$/i.test(luce.unita) && luce.valore >= 1000;
    tessere.push(
      tessera({
        chiave: "sole",
        disegno: "solar",
        nome: t("Sole", "Sun"),
        valore: valoreLuce ? numeroBello(luce.valore / 1000, 0) : numeroBello(principale.valore, 0),
        unita: valoreLuce ? "klx" : principale.unita || (radiazione ? "W/m²" : "lx"),
        sotto: [
          radiazione && luce ? `${esc(t("luminosità", "brightness"))} ${b(lux(luce))}` : "",
          picco && picco.valore > 0
            ? `${esc(t("picco", "peak"))} ${b(`${numeroBello(picco.valore, 0)} ${principale.unita}`)} ${esc(t("alle", "at"))} ${esc(quando(picco))}`
            : "",
        ]
          .filter(Boolean)
          .join(" · "),
        grafico: spark(passo(principale), { colore: "#f59e0b", id: "sole", prefisso }),
        colore: "#f59e0b",
      }),
    );
  }

  const ultimo = Math.max(0, ...Object.values(stazione).map((lettura) => lettura.quando || 0));
  const minuti = ultimo ? (adesso - ultimo) / 60_000 : NaN;
  /* Sotto l'ora si dicono i minuti col loro simbolo, «1 min»: la parola
   * intera al plurale direbbe «1 minuti». */
  const daQuanto = !Number.isFinite(minuti)
    ? ""
    : minuti < 60
      ? `${Math.max(1, Math.round(minuti))} min`
      : quantoTempoInParole(minuti);
  return `<section class="dm-meteo-blocco" data-dm-meteo-blocco="stazione">
      ${titoloMarkup(
        "thermometer",
        t("La mia stazione", "My station"),
        [t("misure di casa", "readings from home"), daQuanto ? t(`aggiornate ${daQuanto} fa`, `updated ${daQuanto} ago`) : ""]
          .filter(Boolean)
          .join(" · "),
      )}
      <div class="dm-meteo-tessere">${tessere.join("")}</div>
    </section>`;
}

function invitoMarkup() {
  return `<section class="dm-meteo-blocco" data-dm-meteo-blocco="invito">
      <div class="dm-meteo-invito">
        <span class="dm-meteo-ic" aria-hidden="true">${icona("thermometer", 30)}</span>
        <div><strong>${esc(t("Hai una stazione meteo?", "Do you have a weather station?"))}</strong>
        <span>${esc(
          t(
            "Aggiungi i suoi sensori in ⚙️ Config › Meteo: qui compaiono le misure di casa tua, con le ultime 24 ore. Senza, la pagina usa solo il servizio meteo.",
            "Add its sensors under ⚙️ Config › Weather: your home's readings show up here, with the last 24 hours. Without them, the page uses the weather service only.",
          ),
        )}</span></div>
        <button type="button" class="dm-meteo-invito-tasto" data-dm-meteo-apri-config>${esc(
          t("Apri Meteo nel Config", "Open Weather in Config"),
        )}</button>
      </div>
    </section>`;
}

function oreMarkup(vista) {
  const ore = vista.ore;
  const temperature = ore.map((voce) => voce.temperatura).filter(Number.isFinite);
  const basso = Math.min(...temperature) - 1;
  const sopra = Math.max(...temperature) + 1;
  const n = ore.length;
  const W = n * 100;
  const alto = 60;
  const punti = ore
    .map((voce, i) =>
      Number.isFinite(voce.temperatura)
        ? [(i + 0.5) * 100, 8 + (alto - 16) * (1 - (voce.temperatura - basso) / (sopra - basso || 1))]
        : null,
    )
    .filter(Boolean);
  const curva = punti.map(([x, y], i) => `${i ? "L" : "M"}${x},${y.toFixed(1)}`).join("");
  const colonne = ore
    .map((voce, i) => {
      const probabilita = Number.isFinite(voce.probabilita) ? Math.round(voce.probabilita) : null;
      return `<div class="dm-meteo-ora${i === 0 ? " dm-meteo-ora-ora" : ""}" data-dm-meteo-ora="${voce.quando}">
        <span class="dm-meteo-ora-h">${esc(soloLOra(voce.quando))}</span>
        <span class="dm-meteo-ora-ic" aria-hidden="true">${segnoDelTempo(voce.condizione)}</span>
        <b class="dm-meteo-ora-t">${Number.isFinite(voce.temperatura) ? `${Math.round(voce.temperatura)}°` : "—"}</b>
        <span class="dm-meteo-ora-p" style="--p:${probabilita ?? 0}%"><i></i></span>
        <small class="dm-meteo-ora-pp">${probabilita === null ? "—" : `${probabilita}%`}</small>
      </div>`;
    })
    .join("");
  return `<section class="dm-meteo-blocco" data-dm-meteo-blocco="ore">
      ${titoloMarkup("timer", t("Prossime 24 ore", "Next 24 hours"), t("temperatura e probabilità di pioggia", "temperature and chance of rain"))}
      <div class="dm-meteo-scheda dm-meteo-ore-scheda">
        <div class="dm-meteo-ore" style="--n:${n}">
          ${curva ? `<svg class="dm-meteo-ore-curva" viewBox="0 0 ${W} ${alto}" preserveAspectRatio="none" aria-hidden="true"><path d="${curva}" fill="none" stroke="#f97316" stroke-width="2.4" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>` : ""}
          ${colonne}
        </div>
      </div>
    </section>`;
}

function giorniMarkup(vista) {
  const giorni = vista.giorni;
  const bassi = giorni.map((voce) => voce.bassa ?? voce.temperatura).filter(Number.isFinite);
  const alti = giorni.map((voce) => voce.temperatura).filter(Number.isFinite);
  const basso = Math.min(...bassi, ...alti);
  const sopra = Math.max(...alti, ...bassi);
  const righe = giorni
    .map((voce) => {
      const min = voce.bassa ?? voce.temperatura;
      const max = voce.temperatura ?? voce.bassa;
      const a = Number.isFinite(min) ? ((min - basso) / (sopra - basso || 1)) * 100 : 0;
      const z = Number.isFinite(max) ? ((max - basso) / (sopra - basso || 1)) * 100 : 100;
      const probabilita = Number.isFinite(voce.probabilita) && voce.probabilita > 0 ? Math.round(voce.probabilita) : null;
      const mm = voce.mm > 0 ? `${numeroBello(voce.mm, 1)}${SPAZIO}mm` : "";
      const pioggia =
        probabilita !== null
          ? `💧 ${probabilita}%${mm ? `<em> · ${esc(mm)}</em>` : ""}`
          : mm
            ? `💧 <em>${esc(mm)}</em>`
            : "";
      return `<div class="dm-meteo-giorno" data-dm-meteo-giorno="${voce.quando}">
        <span class="dm-meteo-giorno-nome">${esc(nomeDelGiorno(voce))}</span>
        <span class="dm-meteo-giorno-ic" aria-hidden="true">${segnoDelTempo(voce.condizione)}</span>
        <span class="dm-meteo-giorno-p">${pioggia}</span>
        <b class="dm-meteo-giorno-mn">${Number.isFinite(min) ? `${Math.round(min)}°` : ""}</b>
        <span class="dm-meteo-giorno-barra"><i style="left:${a.toFixed(1)}%;right:${(100 - z).toFixed(1)}%"></i></span>
        <b class="dm-meteo-giorno-mx">${Number.isFinite(max) ? `${Math.round(max)}°` : ""}</b>
      </div>`;
    })
    .join("");
  return `<section class="dm-meteo-blocco" data-dm-meteo-blocco="giorni">
      ${titoloMarkup("calendar", t("Prossimi giorni", "Next days"))}
      <div class="dm-meteo-scheda dm-meteo-giorni">${righe}</div>
    </section>`;
}

function sottotitoloDelRadar() {
  const scelto = radarScelto();
  if (!scelto) return "";
  if (scelto.modo === "entita") return t("dalla tua camera", "from your camera");
  if (scelto.modo === "windy") return "Windy";
  return [
    scelto.animato ? t("l'ultima ora", "the last hour") : t("adesso", "now"),
    `${scelto.raggio}${SPAZIO}km`,
  ].join(" · ");
}

/* ── la vista: tutto quello che serve a disegnare, letto una volta ─────── */

function soleDiOggi(states) {
  const sole = states?.["sun.sun"]?.attributes;
  if (!sole) return null;
  const alba = oraDi(Date.parse(clean(sole.next_rising)));
  const tramonto = oraDi(Date.parse(clean(sole.next_setting)));
  return alba || tramonto ? { alba, tramonto } : null;
}

/**
 * La vista della pagina: `vistaDelMeteoDa` (nel nucleo) con le cose di qui —
 * i sensori scelti nella configurazione, le previsioni e il sole. La usa
 * anche la pagina Meteo della plancia a muro, con la sua entita' weather
 * (`entita`) e il suo `prefisso` per i nomi dei gradienti: le misure, le
 * tessere e le parole sono le stesse.
 */
export function vistaDelMeteo(states = allStates(), adesso = Date.now(), { entita = "", prefisso = "" } = {}) {
  const scelta = clean(entita) || entitaDelMeteo(states);
  if (!scelta) return null;
  const sensori = sensoriDellaStazione();
  const p = state.previsioni.entita === scelta ? state.previsioni : { orarie: [], giornaliere: [] };
  const vista = vistaDelMeteoDa({
    entita: scelta,
    meteo: states?.[scelta] || null,
    stazione: letturaDellaStazione(sensori, states),
    orarie: p.orarie,
    giornaliere: p.giornaliere,
    sole: soleDiOggi(states),
    adesso,
  });
  return vista ? { ...vista, sensori, prefisso: clean(prefisso) } : null;
}

/** I blocchi che la pagina mostra con questa vista, nell'ordine scelto. */
export function blocchiDellaVista(vista, { radar = true, invito = puoConfigurareAdesso() } = {}) {
  if (!vista) return [];
  return blocchiDellaPagina(readJson(CHIAVE_METEO, {}), {
    adesso: true,
    stazione: Object.keys(vista.stazione).length > 0,
    invito,
    ore: vista.ore.length > 0,
    giorni: vista.giorni.length > 0,
    radar,
  });
}

function puoConfigurareAdesso() {
  try {
    return puoConfigurare() !== false;
  } catch (_errore) {
    return true;
  }
}

/* ── il disegno ───────────────────────────────────────────────────────── */

/* «Adesso» e «La mia stazione» come li disegna questa pagina, per la pagina
 * Meteo del muro: le stesse parole, le stesse tessere, le stesse linee. */
export const adessoDelMeteo = (vista) => adessoMarkup(vista);
export const stazioneDelMeteo = (vista) => stazioneMarkup(vista);

const DISEGNI = Object.freeze({
  adesso: adessoMarkup,
  stazione: stazioneMarkup,
  invito: invitoMarkup,
  ore: oreMarkup,
  giorni: giorniMarkup,
});

/* Ogni blocco ha il suo posto, che nasce una volta e poi si sposta e basta.
 * Il radar soprattutto: i suoi quadratini sono immagini che arrivano da
 * fuori, e rifarle a ogni stato che cambia le farebbe lampeggiare. */
function postoDi(dove, blocco) {
  let posto = dove.querySelector(`:scope > [data-dm-meteo-posto="${blocco}"]`);
  if (posto) return posto;
  posto = doc.createElement("div");
  posto.className = "dm-meteo-posto";
  posto.dataset.dmMeteoPosto = blocco;
  if (blocco === "radar")
    posto.innerHTML = `<section class="dm-meteo-blocco" data-dm-meteo-blocco="radar">
        <div class="dm-meteo-radar-testa"></div>
        <div class="dm-meteo-scheda dm-meteo-radar-scheda"><div class="dm-meteo-radar-posto"></div></div>
      </section>`;
  dove.append(posto);
  return posto;
}

/* Il radar si ridisegna da se' ogni minuto finche' la pagina si vede: qui lo
 * si chiama quando nasce, quando la sua configurazione cambia e quando si
 * torna sulla pagina. Un radar da camera chiamato a ogni stato che cambia
 * riscaricherebbe il fotogramma decine di volte al minuto. */
function radarDellaPagina(posto, { forza = false } = {}) {
  if (!posto) return false;
  const firma = JSON.stringify(radarScelto() || {});
  if (!forza && state.radarFirma === firma && posto.isConnected)
    return Boolean(posto.querySelector(".dm-radar-blocco"));
  state.radarFirma = firma;
  return disegnaRadarIn(posto);
}

function dipingi() {
  const pagina = ensureMeteoPage();
  const dove = pagina?.querySelector?.("#meteo-wrap");
  if (!dove || !paginaVisibile(METEO_PAGE_ID)) {
    state.inVista = false;
    return;
  }
  /* Tornati sulla pagina, il radar riparte da capo: mentre non si vedeva il
   * suo giro si era fermato. */
  const appenaArrivati = !state.inVista;
  state.inVista = true;
  const vista = vistaDelMeteo();
  if (!vista) {
    for (const posto of dove.children) posto.hidden = true;
    return;
  }
  const radar = postoDi(dove, "radar");
  scriviSeCambia(
    radar.querySelector(".dm-meteo-radar-testa"),
    titoloMarkup("radar", t("Radar pioggia", "Rain radar"), sottotitoloDelRadar()),
  );
  /* Prima si impagina come se il radar ci fosse quando e' configurato, poi lo
   * si disegna: i suoi quadratini si calcolano sulla larghezza del riquadro,
   * e il riquadro e' largo giusto solo a pagina impaginata. Se poi il radar
   * dice che non ha niente da mostrare, si impagina di nuovo senza. */
  const previsto =
    Boolean(radarScelto()) || Boolean(radar.querySelector(".dm-radar-blocco[data-dm-modo]"));
  impagina(dove, vista, previsto);
  const mostraRadar = radarDellaPagina(radar.querySelector(".dm-meteo-radar-posto"), {
    forza: appenaArrivati,
  });
  if (mostraRadar !== previsto) impagina(dove, vista, mostraRadar);
}

function impagina(dove, vista, mostraRadar) {
  const blocchi = blocchiDellaVista(vista, { radar: mostraRadar });
  const ordine = [];
  for (const blocco of blocchi) {
    const posto = postoDi(dove, blocco);
    if (blocco !== "radar") scriviSeCambia(posto, DISEGNI[blocco](vista));
    posto.hidden = false;
    ordine.push(posto);
  }
  for (const posto of dove.children) if (!ordine.includes(posto)) posto.hidden = true;
  /* L'ordine scelto: si spostano i posti, non si rifanno. */
  let prima = null;
  for (const posto of ordine) {
    const atteso = prima ? prima.nextElementSibling : dove.firstElementChild;
    if (atteso !== posto) dove.insertBefore(posto, prima ? prima.nextElementSibling : dove.firstElementChild);
    prima = posto;
  }
  /* I giorni e il radar si affiancano quando stanno uno dopo l'altro. */
  const iGiorni = blocchi.indexOf("giorni");
  const ilRadar = blocchi.indexOf("radar");
  dove.dataset.dmMeteoCoppia = String(iGiorni >= 0 && ilRadar >= 0 && Math.abs(iGiorni - ilRadar) === 1);
  dove.dataset.dmMeteoBlocchi = blocchi.join(" ");
}

function leggiSeServe() {
  if (!serveLeggere()) return;
  const entita = entitaDelMeteo();
  if (!entita) return;
  aggiornaLePrevisioni(entita);
  const sensori = Object.values(sensoriDellaStazione());
  if (sensori.length) aggiornaLaStoria(sensori);
}

function battito() {
  if (state.sveglia || !serveLeggere()) return;
  state.sveglia =
    root.setTimeout?.(() => {
      state.sveglia = 0;
      schedule();
    }, BATTITO) || 0;
}

function schedule() {
  if (state.frame) return;
  const giro = () => {
    state.frame = 0;
    try {
      const entita = entitaDelMeteo();
      if (accendiLaVoce(entita)) {
        dipingi();
        leggiSeServe();
        battito();
      }
    } catch (errore) {
      root.console?.warn?.("[DashboardModern] meteo", errore);
    }
  };
  state.frame = root.requestAnimationFrame?.(giro) || 0;
  if (!state.frame) giro();
}

/** Ridisegna adesso: la usa la scheda del Config quando salva. */
export function renderMeteo() {
  state.storia.chiesta = 0;
  schedule();
}

/* Il sottotitolo dice i blocchi che ci sono: «La mia stazione» solo se c'e'. */
function titoloDellaPagina() {
  const vista = vistaDelMeteo();
  if (!vista) return null;
  const nomi = {
    adesso: t("Adesso", "Now"),
    stazione: t("La mia stazione", "My station"),
    ore: t("Previsioni", "Forecast"),
    giorni: t("Previsioni", "Forecast"),
    radar: t("Radar", "Radar"),
  };
  const voci = [];
  for (const blocco of blocchiDellaVista(vista, { invito: false })) {
    const nome = nomi[blocco];
    if (nome && !voci.includes(nome)) voci.push(nome);
  }
  return voci.length ? { subtitle: voci.join(" · ") } : null;
}

/* ── il foglio ────────────────────────────────────────────────────────── */

/**
 * Il foglio della pagina, per un contenitore `P`. Questa pagina lo usa con
 * `#page-meteo`; il muro con il suo contenitore e senza le misure dello
 * schermo (`media: false`), che li' decide il tablet.
 */
export function foglioDelMeteo(P, { media = true } = {}) {
  return `
  ${P}{--dm-meteo-gap:16px}
  ${P} .dm-meteo-wrap{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);gap:22px;padding:0 0 40px}
  ${P} .dm-meteo-posto{grid-column:1/-1;min-width:0}
  ${P} .dm-meteo-posto[hidden]{display:none!important}
  ${P} .dm-meteo-wrap[data-dm-meteo-coppia="true"] .dm-meteo-posto:is([data-dm-meteo-posto="giorni"],[data-dm-meteo-posto="radar"]){grid-column:auto}
  ${P} .dm-meteo-blocco{min-width:0}
  ${P} .dm-meteo-titolo{display:flex;align-items:center;flex-wrap:wrap;gap:9px;margin:0 0 10px 2px;
    font-size:12px;font-weight:900;letter-spacing:1.6px;text-transform:uppercase;color:var(--text,#0f172a)}
  ${P} .dm-meteo-titolo>span{display:inline-flex;align-items:center;line-height:0}
  ${P} .dm-meteo-titolo>span:nth-child(2){line-height:1.2}
  ${P} .dm-meteo-titolo svg{width:20px;height:20px;display:block}
  ${P} .dm-meteo-titolo small{font-size:10.5px;font-weight:700;letter-spacing:.4px;text-transform:none;
    color:var(--text-dim,#64748b);margin-left:2px}
  ${P} .dm-meteo-scheda,${P} .dm-meteo-adesso,${P} .dm-meteo-tessera{
    box-sizing:border-box;border:1px solid var(--card-border,#e2e8f0);border-radius:22px;
    background:var(--card-bg,#fff);box-shadow:var(--shadow-sculpted,0 6px 18px rgba(15,23,42,.07))}

  /* Adesso */
  ${P} .dm-meteo-adesso{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.25fr);gap:22px;
    padding:22px 26px;position:relative;overflow:hidden;
    background:radial-gradient(120% 160% at 0% 0%,rgba(14,165,233,.13),transparent 55%),var(--card-bg,#fff)}
  ${P} .dm-meteo-adesso-sx{display:flex;align-items:center;gap:18px;min-width:0}
  ${P} .dm-meteo-adesso-ic{font-size:76px;line-height:1;filter:drop-shadow(0 8px 14px rgba(15,23,42,.14))}
  ${P} .dm-meteo-adesso-gradi{display:grid;gap:4px;min-width:0}
  ${P} .dm-meteo-adesso-gradi>b{font-family:'Oswald',system-ui,sans-serif;font-size:64px;font-weight:700;line-height:.95;color:var(--text,#0f172a);letter-spacing:-1px}
  ${P} .dm-meteo-adesso-gradi>b i{font-style:normal;font-size:36px;vertical-align:top;margin-left:2px;color:var(--text-dim,#64748b)}
  ${P} .dm-meteo-adesso-cond{font-size:13px;font-weight:900;letter-spacing:1.4px;text-transform:uppercase;color:#0ea5e9}
  ${P} .dm-meteo-adesso-gradi small{font-size:12px;font-weight:700;color:var(--text-dim,#64748b)}
  ${P} .dm-meteo-adesso-gradi small b{color:var(--text,#0f172a)}
  ${P} .dm-meteo-adesso-dx{display:grid;gap:12px;align-content:center;min-width:0}
  ${P} .dm-meteo-frase{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:16px;
    border:1px solid color-mix(in srgb,#0284c7 30%,transparent);background:color-mix(in srgb,#0284c7 9%,var(--card-bg,#fff))}
  ${P} .dm-meteo-frase[data-stato="asciutto"]{border-color:color-mix(in srgb,#16a34a 28%,transparent);background:color-mix(in srgb,#16a34a 8%,var(--card-bg,#fff))}
  ${P} .dm-meteo-frase>span{font-size:24px}
  ${P} .dm-meteo-frase strong{display:block;font-size:14px;font-weight:900;color:var(--text,#0f172a)}
  ${P} .dm-meteo-frase small{font-size:11.5px;font-weight:700;color:var(--text-dim,#64748b)}
  ${P} .dm-meteo-pills{display:flex;flex-wrap:wrap;gap:8px}
  ${P} .dm-meteo-pill{display:inline-flex;align-items:center;gap:6px;padding:6px 11px;border-radius:999px;
    font-size:11.5px;font-weight:700;color:var(--text-dim,#64748b);
    background:var(--surface-2,#f8fafc);border:1px solid var(--card-border,#e8edf3)}
  ${P} .dm-meteo-pill b{color:var(--text,#0f172a);font-weight:900}
  ${P} .dm-meteo-fonte{font-size:10.5px;font-weight:700;color:var(--text-dim,#64748b);opacity:.85}

  /* La mia stazione */
  ${P} .dm-meteo-tessere{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--dm-meteo-gap)}
  ${P} .dm-meteo-tessera{--dm-meteo-c:#0ea5e9;display:grid;grid-template-columns:minmax(0,1fr);align-content:start;gap:6px;
    padding:16px 16px 12px;position:relative;overflow:hidden}
  ${P} .dm-meteo-tessera::before{content:"";position:absolute;inset:0 0 auto 0;height:3px;
    background:linear-gradient(90deg,var(--dm-meteo-c),transparent 80%);opacity:.75}
  ${P} .dm-meteo-tessera-testa{display:flex;align-items:center;gap:10px;min-width:0}
  ${P} .dm-meteo-ic{display:grid;place-items:center;width:38px;height:38px;border-radius:12px;flex:0 0 auto;
    background:color-mix(in srgb,var(--dm-meteo-c,#0ea5e9) 16%,transparent);line-height:0}
  ${P} .dm-meteo-ic svg{width:26px;height:26px;display:block}
  ${P} .dm-meteo-nome{font-size:10.5px;font-weight:900;letter-spacing:1.2px;text-transform:uppercase;
    color:var(--text-dim,#64748b);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  ${P} .dm-meteo-stato{margin-left:auto;padding:3px 9px;border-radius:999px;font-size:10px;font-weight:900;
    letter-spacing:.6px;text-transform:uppercase;white-space:nowrap;
    color:color-mix(in srgb,var(--dm-meteo-c) 80%,var(--text,#0f172a));background:color-mix(in srgb,var(--dm-meteo-c) 14%,transparent)}
  ${P} .dm-meteo-valore{display:flex;align-items:baseline;gap:6px;margin-top:4px}
  ${P} .dm-meteo-valore b{font-family:'Oswald',system-ui,sans-serif;font-size:40px;font-weight:700;line-height:1;color:var(--text,#0f172a)}
  ${P} .dm-meteo-valore i{font-style:normal;font-size:13px;font-weight:800;color:var(--text-dim,#64748b)}
  ${P} .dm-meteo-sotto{font-size:11px;font-weight:700;line-height:1.35;color:var(--text-dim,#64748b);min-height:30px}
  ${P} .dm-meteo-sotto b{color:var(--text,#0f172a);font-weight:900}
  ${P} .dm-meteo-grafico{position:relative;height:46px;margin:4px -4px 0;color:var(--text,#0f172a)}
  ${P} .dm-meteo-spark{display:block;width:100%;height:46px;overflow:visible}
  ${P} .dm-meteo-24{position:absolute;right:4px;top:-14px;font-size:9px;font-weight:900;letter-spacing:.8px;color:var(--text-dim,#94a3b8)}
  ${P} .dm-meteo-larga{grid-column:span 2;grid-template-columns:auto minmax(0,1fr);column-gap:18px}
  ${P} .dm-meteo-larga>*{grid-column:2}
  ${P} .dm-meteo-larga>.dm-meteo-bussola{grid-column:1;grid-row:1/span 4;align-self:center}
  ${P} .dm-meteo-bussola{width:118px;height:118px;color:var(--text,#0f172a)}
  ${P} .dm-meteo-bussola text{font-size:10px;font-weight:900;fill:var(--text-dim,#64748b)}
  ${P} .dm-meteo-uv{padding:10px 2px 2px}
  ${P} .dm-meteo-uv-barra{position:relative;display:block;height:8px;border-radius:999px;
    background:linear-gradient(90deg,#22c55e 0%,#22c55e 22%,#eab308 30%,#f97316 58%,#ef4444 76%,#a855f7 100%)}
  ${P} .dm-meteo-uv-barra i{position:absolute;top:50%;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;
    background:var(--card-bg,#fff);border:3px solid var(--text,#0f172a);box-sizing:border-box}
  ${P} .dm-meteo-uv-tacche{display:flex;justify-content:space-between;margin-top:6px;font-size:9.5px;font-weight:800;color:var(--text-dim,#94a3b8)}
  ${P} .dm-meteo-uv-tacche em{font-style:normal}

  /* L'invito, senza stazione */
  ${P} .dm-meteo-invito{display:flex;align-items:center;gap:14px;padding:16px 18px;border-radius:20px;
    border:1px dashed var(--card-border,#cbd5e1);background:var(--surface-2,#f8fafc)}
  ${P} .dm-meteo-invito>div{display:grid;gap:3px;flex:1;min-width:0}
  ${P} .dm-meteo-invito strong{font-size:14px;font-weight:900;color:var(--text,#0f172a)}
  ${P} .dm-meteo-invito span{font-size:12px;font-weight:700;color:var(--text-dim,#64748b)}
  ${P} .dm-meteo-invito .dm-meteo-ic{--dm-meteo-c:#f97316;width:46px;height:46px}
  ${P} .dm-meteo-invito .dm-meteo-ic svg{width:30px;height:30px}
  ${P} .dm-meteo-invito-tasto{flex:0 0 auto;padding:10px 16px;border-radius:999px;border:0;cursor:pointer;
    font:inherit;font-size:12px;font-weight:900;color:#fff;background:linear-gradient(135deg,#0ea5e9,#0369a1)}

  /* Prossime ore */
  ${P} .dm-meteo-ore-scheda{padding:14px 10px 12px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}
  ${P} .dm-meteo-ore-scheda::-webkit-scrollbar{display:none}
  ${P} .dm-meteo-ore{position:relative;display:grid;grid-template-columns:repeat(var(--n),minmax(46px,1fr));min-width:calc(var(--n) * 46px)}
  ${P} .dm-meteo-ore-curva{position:absolute;left:0;right:0;top:56px;width:100%;height:60px;pointer-events:none;opacity:.55}
  ${P} .dm-meteo-ora{display:grid;justify-items:center;gap:4px;padding:2px 0;border-radius:14px}
  ${P} .dm-meteo-ora-ora{background:color-mix(in srgb,#0ea5e9 9%,transparent)}
  ${P} .dm-meteo-ora-h{font-size:11px;font-weight:900;color:var(--text-dim,#64748b)}
  ${P} .dm-meteo-ora-ic{font-size:22px;line-height:1.2;height:28px}
  ${P} .dm-meteo-ora-t{font-family:'Oswald',system-ui,sans-serif;font-size:17px;font-weight:700;color:var(--text,#0f172a);margin:44px 0 6px;position:relative}
  ${P} .dm-meteo-ora-p{position:relative;display:block;width:8px;height:34px;border-radius:999px;
    background:color-mix(in srgb,#0284c7 12%,transparent);overflow:hidden}
  ${P} .dm-meteo-ora-p i{position:absolute;inset:auto 0 0 0;height:var(--p);background:#0284c7;border-radius:999px}
  ${P} .dm-meteo-ora-pp{font-size:10px;font-weight:800;color:#0284c7}

  /* Prossimi giorni */
  ${P} .dm-meteo-giorni{display:grid;padding:6px 16px}
  ${P} .dm-meteo-giorno{display:grid;grid-template-columns:76px 36px minmax(0,1fr) 34px minmax(70px,1.2fr) 34px;
    align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--card-border,#eef2f7)}
  ${P} .dm-meteo-giorno:last-child{border-bottom:0}
  ${P} .dm-meteo-giorno-nome{font-size:13px;font-weight:900;color:var(--text,#0f172a)}
  ${P} .dm-meteo-giorno-ic{font-size:24px;line-height:1}
  ${P} .dm-meteo-giorno-p em{font-style:normal}
  ${P} .dm-meteo-giorno-p{font-size:11px;font-weight:800;color:#0284c7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  ${P} .dm-meteo-giorno-mn,${P} .dm-meteo-giorno-mx{font-family:'Oswald',system-ui,sans-serif;font-size:17px;font-weight:700;text-align:right}
  ${P} .dm-meteo-giorno-mn{color:#0ea5e9}
  ${P} .dm-meteo-giorno-mx{color:#e11d48;text-align:left}
  ${P} .dm-meteo-giorno-barra{position:relative;height:6px;border-radius:999px;background:var(--surface-2,#eef2f7)}
  ${P} .dm-meteo-giorno-barra i{position:absolute;top:0;bottom:0;border-radius:999px;background:linear-gradient(90deg,#0ea5e9,#f59e0b,#e11d48)}

  /* Il radar: lo stesso della finestra delle previsioni, piu' grande. Il
     titolo lo dice la pagina; resta la testa solo quando c'e' da dire cosa
     correggere. */
  ${P} .dm-meteo-radar-scheda{padding:14px}
  ${P} .dm-meteo-radar-posto .dm-radar-blocco{margin:0}
  ${P} .dm-meteo-radar-posto .dm-radar-blocco:not([data-dm-modo="guasto"]) .dm-radar-testa{display:none}
${media ? foglioDelleMisure(P) : ""}`;
}

function foglioDelleMisure(P) {
  return `
  @media(max-width:1100px){
    ${P} .dm-meteo-tessere{grid-template-columns:repeat(2,minmax(0,1fr))}
    ${P} .dm-meteo-wrap{grid-template-columns:minmax(0,1fr)}
    ${P} .dm-meteo-wrap[data-dm-meteo-coppia="true"] .dm-meteo-posto{grid-column:1/-1}
  }
  @media(max-width:700px){
    ${P} .dm-meteo-adesso{grid-template-columns:minmax(0,1fr);padding:18px;gap:14px}
    ${P} .dm-meteo-adesso-ic{font-size:60px}
    ${P} .dm-meteo-adesso-gradi>b{font-size:54px}
    ${P} .dm-meteo-tessere{gap:10px}
    ${P} .dm-meteo-tessera{padding:13px 12px 10px}
    ${P} .dm-meteo-valore b{font-size:32px}
    ${P} .dm-meteo-nome{font-size:9.5px;letter-spacing:.6px;white-space:normal;line-height:1.2}
    ${P} .dm-meteo-ic{width:32px;height:32px;border-radius:10px}
    ${P} .dm-meteo-ic svg{width:22px;height:22px}
    ${P} .dm-meteo-stato{display:none}
    ${P} .dm-meteo-larga{grid-template-columns:auto minmax(0,1fr);column-gap:12px}
    ${P} .dm-meteo-bussola{width:92px;height:92px}
    ${P} .dm-meteo-giorno{grid-template-columns:58px 28px minmax(0,1fr) 28px minmax(40px,.9fr) 28px;gap:7px}
    ${P} .dm-meteo-giorno-ic{font-size:20px}
    ${P} .dm-meteo-giorno-p{font-size:10px}
    ${P} .dm-meteo-giorno-p em{display:none}
    ${P} .dm-meteo-invito{flex-wrap:wrap}
    ${P} .dm-meteo-wrap{gap:18px}
  }
    `;
}

function installStyles() {
  installStyle("dm-meteo-section-style", foglioDelMeteo(`#${METEO_PAGE_ID}`));
}

function onClick(evento) {
  if (!evento.target?.closest?.("[data-dm-meteo-apri-config]")) return;
  evento.preventDefault();
  apriMeteoNelConfig();
}

export function installMeteo() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  ensureMeteoPage();
  ensureMeteoTab();
  registraTitoloDiPagina(METEO_PAGE_ID, titoloDellaPagina);
  doc.addEventListener?.("click", onClick);
  for (const nome of ["render", "cdApplyNavVis"]) {
    const precedente = root[nome];
    if (typeof precedente !== "function" || precedente.__dmMeteo) continue;
    const avvolta = function (...args) {
      const esito = precedente.apply(this, args);
      schedule();
      return esito;
    };
    avvolta.__dmMeteo = true;
    avvolta.__dmPrevious = precedente;
    root[nome] = avvolta;
  }
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:state-changed",
    "dashboardmodern:persistence-restored",
  ])
    root.addEventListener?.(evento, schedule);
  doc.addEventListener?.("visibilitychange", schedule);
  quandoSiCambiaPagina(schedule);
  schedule();
  return true;
}

senzaCadere(installMeteo);
