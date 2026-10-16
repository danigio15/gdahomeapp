/* La pagina gdanav: i viaggi pianificati, da PC.
 *
 * «La stessa cosa dobbiamo pensarla anche su webapp e su Home Assistant,
 * cosi' da poter pianificare il viaggio da pc.» I viaggi non stanno qui: stanno
 * nella casa (`ponte/src/viaggi.js`), e questa pagina li legge e li scrive sul
 * filo coi comandi `ponte/viaggi/*`. Il navigatore sul telefono legge gli
 * stessi, e in auto — CarPlay, Android Auto — si trovano gia' li'.
 *
 * Ognuno vede i suoi: la casa sa chi sta guardando la pagina. Le mete si
 * cercano e la strada si stima dalla casa (Photon e OSRM, senza traffico e con
 * un margine); il traffico vero lo porta il navigatore quando si collega.
 *
 * E' di gdanav Premium. Senza, la pagina lo dice e non fa scrivere niente:
 * lo stesso che risponde la casa.
 */

import {
  bozzaNuova,
  durataDetta,
  durataStimata,
  GIORNI,
  nomeDelViaggio,
  oraDi,
  partenzaEArrivo,
  quandoDetto,
} from "../core/i-viaggi.js";
import { FONDI_MAPPA } from "../core/radar-mappa.js";
import {
  activeLocale,
  allStates,
  chiediAHomeAssistant,
  clean,
  doc,
  esc,
  installStyle,
  root,
  t,
  wrapFunction,
} from "./shared.js";

export const GDANAV_PAGE_ID = "page-gdanav";
export const GDANAV_TAB = "gdanav";

const KEY = "__DASHBOARDMODERN_GDANAV__";
const state = (root[KEY] ||= {
  installed: false,
  caricato: false,
  sbloccato: true,
  viaggi: [],
  bozza: null,
  scelto: "",
  proposte: [],
  cercando: "",
  /* Com'e' andata l'ultima ricerca: "" niente da dire, "cerco", "vuota"
   * (nessun posto con quel nome), "guasto" (il servizio non risponde). */
  ricerca: "",
  casa: null,
  linea: [],
  errore: "",
  salvando: false,
  frame: 0,
});

/* ── il logo, dove stanno i marchi ───────────────────────────────────────── */

function logo() {
  const qui = import.meta.url;
  const taglio = qui.indexOf("/dashboardmodern_static/");
  const cartella =
    taglio < 0 ? "../../brands/" : `${qui.slice(0, taglio)}/dashboardmodern_static/brands/`;
  return `${cartella}gdanav.webp`;
}

const lingua = () => (String(activeLocale?.() || "it").startsWith("en") ? "en" : "it");

/* ── la casa ─────────────────────────────────────────────────────────────── */

async function chiedi(tipo, dati = {}, attesa = 10000) {
  return chiediAHomeAssistant({ type: `ponte/viaggi/${tipo}`, ...dati }, attesa);
}

async function carica() {
  try {
    const risposta = await chiedi("elenco");
    state.sbloccato = risposta?.sbloccato !== false;
    state.viaggi = Array.isArray(risposta?.viaggi) ? risposta.viaggi : [];
    if (risposta?.casa) state.casa = risposta.casa;
    state.errore = "";
  } catch (errore) {
    state.errore = t(
      "La casa non risponde: riprova fra poco.",
      "The home is not answering: try again shortly.",
    );
  }
  state.caricato = true;
  disegna();
}

/* ── la pagina e la voce nella barra ─────────────────────────────────────── */

function lastPage() {
  const pages = doc?.querySelectorAll?.(".page");
  return pages?.length ? pages[pages.length - 1] : null;
}

export function ensureGdanavPage() {
  if (!doc) return null;
  let page = doc.getElementById(GDANAV_PAGE_ID);
  if (page) return page;
  const sorella = lastPage();
  if (!sorella?.parentElement) return null;
  page = doc.createElement("section");
  page.className = "page";
  page.id = GDANAV_PAGE_ID;
  page.innerHTML = `<div class="dm-gn" id="dm-gn"><div class="dm-gn-corpo"></div></div>`;
  sorella.after(page);
  return page;
}

function apri() {
  for (const node of doc.querySelectorAll(".tab")) node.classList.remove("active");
  for (const node of doc.querySelectorAll(".page")) node.classList.remove("active");
  doc.querySelector(`.tab[data-tab="${GDANAV_TAB}"]`)?.classList.add("active");
  ensureGdanavPage()?.classList.add("active");
  if (root.navigator?.vibrate) root.navigator.vibrate(5);
  void carica();
}

export function ensureGdanavTab() {
  if (!doc) return null;
  let tab = doc.querySelector(`.tab[data-tab="${GDANAV_TAB}"]`);
  if (tab) return tab;
  const nav = doc.querySelector("nav.tabs");
  if (!nav) return null;
  const dopo = nav.querySelector('.tab[data-tab="home"]');
  tab = doc.createElement("button");
  tab.className = "tab";
  tab.dataset.tab = GDANAV_TAB;
  tab.id = `tab-${GDANAV_TAB}`;
  tab.innerHTML = `<span class="icon"><img class="dm-gn-tab-logo" src="${esc(logo())}" alt=""></span><span class="text">gdanav</span>`;
  tab.addEventListener("click", apri);
  if (dopo) dopo.after(tab);
  else nav.prepend(tab);
  return tab;
}

/* La voce si nasconde come tutte le altre (vedi `robot-section.js`). */
function teachNavVisibility() {
  const previous = root.cdNavVisMap;
  if (typeof previous !== "function" || previous.__dmGdanav) return;
  const wrapped = function cdNavVisMap(...args) {
    const map = previous.apply(this, args) || {};
    return { ...map, [GDANAV_TAB]: GDANAV_TAB };
  };
  wrapped.__dmGdanav = true;
  root.cdNavVisMap = wrapped;
}

/* ── disegnare ───────────────────────────────────────────────────────────── */

const ICONE = { una: "📅", settimana: "🔁", tappe: "🗺️" };
const COLORI = { una: "#dbeafe", settimana: "#dcfce7", tappe: "#ede9fe" };

function pastiglia(testo, classe) {
  return `<span class="dm-gn-pill ${classe}">${esc(testo)}</span>`;
}

function rigaDelViaggio(v) {
  const l = lingua();
  const pezzi = [];
  if (v.prossima?.partenza)
    pezzi.push(pastiglia(`🕗 ${t("parti alle", "leave at")} ${oraDi(v.prossima.partenza)}`, "b"));
  if (v.stima?.km) pezzi.push(pastiglia(`${v.stima.km} km`, "b"));
  if (v.stima?.fonte === "traffico")
    pezzi.push(pastiglia(`🚦 ${t("col traffico", "with traffic")}`, "o"));
  if (v.prepara?.clima) pezzi.push(pastiglia(`❄️ ${t("clima prima", "climate first")}`, "v"));
  if (v.tipo === "tappe") pezzi.push(pastiglia(`${v.tappe.length} ${t("tappe", "stops")}`, "v"));
  return `<button type="button" class="dm-gn-viaggio${state.scelto === v.id ? " su" : ""}" data-gn-apri="${esc(v.id)}">
    <span class="dm-gn-ic" style="background:${COLORI[v.tipo] || COLORI.una}">${ICONE[v.tipo] || ICONE.una}</span>
    <span class="dm-gn-col"><span class="dm-gn-nome">${esc(nomeDelViaggio(v, l))}</span>
    <span class="dm-gn-sotto">${esc(quandoDetto(v, Date.now(), l))}</span>
    <span class="dm-gn-pills">${pezzi.join("")}</span></span></button>`;
}

function elenco() {
  const gruppi = [
    [t("Prossimi", "Upcoming"), state.viaggi.filter((v) => v.tipo === "una")],
    [t("Ogni settimana", "Every week"), state.viaggi.filter((v) => v.tipo === "settimana")],
    [t("Giri a tappe", "Multi-stop trips"), state.viaggi.filter((v) => v.tipo === "tappe")],
  ].filter(([, voci]) => voci.length);
  if (!gruppi.length)
    return `<div class="dm-gn-vuoto">${esc(t("Nessun viaggio ancora. Premi «Nuovo viaggio» per il primo.", "No trips yet. Press “New trip” for the first one."))}</div>`;
  return gruppi
    .map(
      ([titolo, voci]) =>
        `<div class="dm-gn-tit">${esc(titolo)}</div>${voci.map(rigaDelViaggio).join("")}`,
    )
    .join("");
}

/* La cartina sotto la strada.
 *
 * «Mappe non ha nulla»: sotto la linea c'era un fondo grigio, e una strada
 * disegnata nel vuoto non dice dove passa. Adesso sotto ci sono le tessere di
 * una mappa, scelte allo zoom piu' grande in cui tutta la strada ci sta, e
 * sopra la linea e le fermate negli stessi pixel. Niente libreria: sono
 * immagini messe in griglia e un disegno sopra. Senza meta la cartina mostra
 * la casa, se la si sa.
 *
 * Il fondo e' lo stesso del radar (`FONDI_MAPPA.esri`, in
 * `core/radar-mappa.js`), non `tile.openstreetmap.org`. La prima versione
 * prendeva le tessere da li', e sul campo la cartina era piena di «403 —
 * Access blocked. App is not following the tile usage policy of
 * OpenStreetMap's volunteer-run servers»: e' la stessa porta che il radar
 * aveva gia' trovato chiusa, e per la stessa ragione — il server dei
 * volontari non e' fatto per una plancia in centinaia di case. Esri da' i suoi
 * quadratini senza chiave e chiede che il suo nome si veda: sta nell'angolo. */
const TESSERA = 256;
const FONDO = FONDI_MAPPA.esri;
const ZOOM_MASSIMO = 16;

function inPixel(lon, lat, zoom) {
  const scala = TESSERA * 2 ** zoom;
  const fi = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180;
  return [
    ((lon + 180) / 360) * scala,
    ((1 - Math.log(Math.tan(fi) + 1 / Math.cos(fi)) / Math.PI) / 2) * scala,
  ];
}

export function inquadra(punti, larga, alta, margine = 36) {
  const buoni = punti.filter((p) => Number.isFinite(p?.[0]) && Number.isFinite(p?.[1]));
  if (!buoni.length) return null;
  for (let zoom = ZOOM_MASSIMO; zoom >= 2; zoom -= 1) {
    const px = buoni.map(([lon, lat]) => inPixel(lon, lat, zoom));
    const xs = px.map((p) => p[0]);
    const ys = px.map((p) => p[1]);
    const w = Math.max(...xs) - Math.min(...xs);
    const h = Math.max(...ys) - Math.min(...ys);
    if (w <= larga - 2 * margine && h <= alta - 2 * margine) {
      const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
      const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
      /* Un punto solo non ha misura: si sta a uno zoom da quartiere. */
      const z = buoni.length === 1 ? Math.min(zoom, 13) : zoom;
      const [ox, oy] = z === zoom ? [cx, cy] : inPixel(buoni[0][0], buoni[0][1], z);
      return { zoom: z, x0: ox - larga / 2, y0: oy - alta / 2 };
    }
  }
  return null;
}

function tessereSotto(vista, larga, alta) {
  const n = 2 ** vista.zoom;
  const prime = [Math.floor(vista.x0 / TESSERA), Math.floor(vista.y0 / TESSERA)];
  const ultime = [
    Math.floor((vista.x0 + larga) / TESSERA),
    Math.floor((vista.y0 + alta) / TESSERA),
  ];
  const fuori = [];
  for (let ty = prime[1]; ty <= ultime[1]; ty += 1) {
    if (ty < 0 || ty >= n) continue;
    for (let tx = prime[0]; tx <= ultime[0]; tx += 1) {
      const x = ((tx % n) + n) % n;
      fuori.push(
        `<image href="${esc(FONDO.modello.replace("{z}", vista.zoom).replace("{x}", x).replace("{y}", ty))}" x="${(tx * TESSERA - vista.x0).toFixed(1)}" y="${(ty * TESSERA - vista.y0).toFixed(1)}" width="${TESSERA}" height="${TESSERA}"/>`,
      );
    }
  }
  return fuori.join("");
}

function mappa(b) {
  const larga = 600;
  const alta = 280;
  const fermateLonLat = [b.da, ...b.tappe].filter(Boolean).map((p) => [p.lon, p.lat]);
  const linea = state.linea.length ? state.linea : fermateLonLat;
  const casa = state.casa ? [[state.casa.lon, state.casa.lat]] : [];
  const daMostrare = linea.length ? linea : fermateLonLat.length ? fermateLonLat : casa;
  const vista = inquadra(daMostrare.concat(fermateLonLat), larga, alta);
  if (!vista)
    return `<div class="dm-gn-mappa dm-gn-mappa-vuota">${esc(t("Scegli una meta: qui compare la strada.", "Pick a destination: the route shows here."))}</div>`;
  const qui = ([lon, lat]) => {
    const [x, y] = inPixel(lon, lat, vista.zoom);
    return [Number((x - vista.x0).toFixed(1)), Number((y - vista.y0).toFixed(1))];
  };
  const punti = linea.length >= 2 ? linea.map(qui) : [];
  const d = punti.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join(" ");
  const fermate = fermateLonLat.map(qui);
  const inizio = punti[0] || (b.da ? fermate[0] : null);
  const fine = punti[punti.length - 1] || fermate[fermate.length - 1] || null;
  const segnoCasa = !linea.length && !fermate.length && casa.length ? qui(casa[0]) : null;
  return `<div class="dm-gn-mappa"><svg viewBox="0 0 ${larga} ${alta}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(t("La strada", "The route"))}">
    <rect width="${larga}" height="${alta}" fill="var(--gn-mappa)"/>
    ${tessereSotto(vista, larga, alta)}
    ${d ? `<path d="${d}" stroke="#fff" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/><path d="${d}" stroke="#2563eb" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` : ""}
    ${fermate
      .slice(b.da ? 1 : 0, -1)
      .map(
        (p) =>
          `<circle cx="${p[0]}" cy="${p[1]}" r="6" fill="#6d28d9" stroke="#fff" stroke-width="3"/>`,
      )
      .join("")}
    ${inizio && punti.length ? `<circle cx="${inizio[0]}" cy="${inizio[1]}" r="9" fill="#16a34a" stroke="#fff" stroke-width="4"/>` : ""}
    ${fine ? `<circle cx="${fine[0]}" cy="${fine[1]}" r="10" fill="#dc2626" stroke="#fff" stroke-width="4"/>` : ""}
    ${segnoCasa ? `<circle cx="${segnoCasa[0]}" cy="${segnoCasa[1]}" r="9" fill="#16a34a" stroke="#fff" stroke-width="4"/>` : ""}
  </svg><span class="dm-gn-osm">© ${esc(FONDO.attribuzione)}</span></div>`;
}

/* Cosa dire sotto il campo, quando la ricerca non ha proposte da mostrare. */
function parolaDellaRicerca() {
  /* Scelta una meta, o svuotato il campo, la ricerca non ha piu' niente da dire. */
  if (state.proposte.length || !state.ricerca || !clean(state.cercando)) return "";
  const parole = {
    cerco: t("Cerco…", "Searching…"),
    vuota: t(
      "Nessun posto con questo nome. Prova ad aggiungere la città.",
      "No place with this name. Try adding the city.",
    ),
    guasto: t(
      "La ricerca degli indirizzi non risponde: riprova fra poco.",
      "Address search is not answering: try again shortly.",
    ),
  };
  return `<div class="dm-gn-ricerca" data-gn-ricerca="${esc(state.ricerca)}" role="status">${esc(parole[state.ricerca] || "")}</div>`;
}

function opzioniDiEntita(domini, scelta) {
  const stati = allStates() || {};
  const voci = Object.keys(stati)
    .filter((id) => domini.includes(id.split(".")[0]))
    .map((id) => [id, clean(stati[id]?.attributes?.friendly_name) || id])
    .sort((a, b) => a[1].localeCompare(b[1]));
  return [`<option value="">${esc(t("Nessuno", "None"))}</option>`]
    .concat(
      voci.map(
        ([id, nome]) =>
          `<option value="${esc(id)}"${id === scelta ? " selected" : ""}>${esc(nome)}</option>`,
      ),
    )
    .join("");
}

function editor() {
  const b = state.bozza;
  if (!b)
    return `<div class="dm-gn-vuoto grande">${esc(t("Scegli un viaggio a sinistra, o fanne uno nuovo.", "Pick a trip on the left, or make a new one."))}</div>`;
  const l = lingua();
  const tipi = [
    ["una", t("Una volta", "Once")],
    ["settimana", t("Ogni settimana", "Every week")],
    ["tappe", t("A tappe", "Multi-stop")],
  ];
  const giorno =
    b.tipo === "settimana"
      ? `<div class="dm-gn-campo"><span>📆 ${esc(t("Giorni", "Days"))}</span><span class="dm-gn-giorni">${GIORNI.map(
          (g) =>
            `<button type="button" class="${b.quando.giorni.includes(g.n) ? "on" : ""}" data-gn-giorno="${g.n}">${esc(l === "en" ? g.en : g.it)}</button>`,
        ).join("")}</span></div>`
      : `<label class="dm-gn-campo"><span>📅 ${esc(t("Quando", "When"))}</span><input type="date" data-gn-campo="giorno" value="${esc(b.quando.giorno || "")}"></label>`;
  const modo =
    b.tipo === "tappe"
      ? ""
      : `<div class="dm-gn-seg piccolo">${[
          ["arrivo", t("Arrivo entro", "Arrive by")],
          ["partenza", t("Parto alle", "Leave at")],
        ]
          .map(
            ([v, n]) =>
              `<button type="button" class="${b.quando.modo === v ? "on" : ""}" data-gn-modo="${v}">${esc(n)}</button>`,
          )
          .join("")}</div>`;
  const tappe = b.tappe.length
    ? `<div class="dm-gn-tappe">${b.tappe
        .map(
          (
            p,
            i,
          ) => `<div class="dm-gn-tappa"><span>${i === b.tappe.length - 1 ? "🏁" : "📍"} ${esc(p.nome)}</span>
          ${b.tipo === "tappe" && i < b.tappe.length - 1 ? `<label class="dm-gn-sosta">${esc(t("sosta", "stop"))} <input type="number" min="0" max="720" step="5" value="${esc(String(p.sostaMin || 0))}" data-gn-sosta="${i}"> min</label>` : ""}
          <button type="button" class="dm-gn-x" data-gn-togli-tappa="${i}" aria-label="${esc(t("Togli", "Remove"))}">✕</button></div>`,
        )
        .join("")}</div>`
    : "";
  const giornoDiConto =
    b.tipo === "settimana"
      ? (() => {
          const d = new Date();
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        })()
      : b.quando.giorno;
  const tempi = partenzaEArrivo(b, giornoDiConto);
  const durata = durataStimata(b);
  const righe = [];
  if (durata !== null) {
    righe.push(
      `🛣️ ${t("Strada", "Drive")}: ${durataDetta(durata, l)}${b.stima?.km ? ` · ${b.stima.km} km` : ""}`,
    );
    righe.push(
      b.stima?.fonte === "traffico"
        ? `🚦 ${t("Col traffico, stimato da gdanav", "With traffic, estimated by gdanav")}`
        : `🔄 ${t("Senza traffico, con un margine: gdanav lo ricalcola col traffico vero fino alla partenza", "Without traffic, with a margin: gdanav recalculates with live traffic until you leave")}`,
    );
  }
  const quandoPartire =
    tempi?.partenza != null
      ? `<div class="dm-gn-parti"><div class="dm-gn-parti-t">${esc(t("Parti alle", "Leave at"))}</div><div class="dm-gn-ora">${esc(oraDi(tempi.partenza))}</div>
        ${tempi.arrivo != null && !(b.quando.modo === "arrivo" && b.tipo !== "tappe") ? `<div class="dm-gn-riga">🏁 ${esc(t("Arrivi verso le", "You arrive around"))} ${esc(oraDi(tempi.arrivo))}</div>` : ""}
        ${righe.map((r) => `<div class="dm-gn-riga">${esc(r)}</div>`).join("")}</div>`
      : `<div class="dm-gn-parti"><div class="dm-gn-riga">${esc(t("Scegli la meta e l'ora: qui ti dico quando partire.", "Pick the destination and time: I will tell you when to leave."))}</div></div>`;
  const clima = b.prepara?.clima?.entity || "";
  const garage = b.prepara?.garage?.entity || "";
  return `
    <div class="dm-gn-dett">
      <div>
        <div class="dm-gn-seg">${tipi.map(([v, n]) => `<button type="button" class="${b.tipo === v ? "on" : ""}" data-gn-tipo="${v}">${esc(n)}</button>`).join("")}</div>
        <label class="dm-gn-nomecampo"><input type="text" maxlength="80" placeholder="${esc(t("Nome (facoltativo): «Giro clienti»", "Name (optional): “Client round”"))}" data-gn-campo="nome" value="${esc(b.nome || "")}"></label>
        ${tappe}
        <div class="dm-gn-cerca">🔎 <input type="search" autocomplete="off" placeholder="${esc(b.tipo === "tappe" ? t("Aggiungi una tappa…", "Add a stop…") : b.tappe.length ? t("Cambia la meta…", "Change destination…") : t("Dove vai?", "Where to?"))}" data-gn-cerca value="${esc(state.cercando)}"></div>
        ${parolaDellaRicerca()}
        ${state.proposte.length ? `<div class="dm-gn-proposte">${state.proposte.map((p, i) => `<button type="button" data-gn-proposta="${i}">📍 ${esc(p.nome)}</button>`).join("")}</div>` : ""}
        ${mappa(b)}
        ${giorno}
        ${modo}
        <label class="dm-gn-campo"><span>🏁 ${esc(b.tipo === "tappe" || b.quando.modo === "partenza" ? t("Parto alle", "Leave at") : t("Arrivo entro", "Arrive by"))}</span><input type="time" data-gn-campo="ora" value="${esc(b.quando.ora)}"></label>
      </div>
      <div>
        ${quandoPartire}
        <div class="dm-gn-tit">${esc(t("Avvisi", "Reminders"))}</div>
        <label class="dm-gn-int"><span>🔔</span><span class="dm-gn-col"><span class="dm-gn-t">${esc(t("Avvisami prima", "Remind me"))}</span><span class="dm-gn-s">${esc(t("Sul telefono, prima di partire", "On the phone, before leaving"))}</span></span>
          <select data-gn-campo="avvisoMin">${[5, 10, 15, 20, 30].map((m) => `<option value="${m}"${b.avviso.minuti === m ? " selected" : ""}>${m} min</option>`).join("")}</select>
          <input type="checkbox" class="dm-gn-sw" data-gn-campo="avviso"${b.avviso.acceso ? " checked" : ""}></label>
        <div class="dm-gn-tit">${esc(t("Prepara l'auto e la casa", "Get the car and home ready"))}</div>
        <label class="dm-gn-int"><span>❄️</span><span class="dm-gn-col"><span class="dm-gn-t">${esc(t("Clima dell'auto", "Car climate"))}</span><span class="dm-gn-s">${esc(t("Acceso 10 minuti prima di partire", "On 10 minutes before leaving"))}</span></span>
          <select data-gn-campo="clima">${opzioniDiEntita(["climate", "switch", "input_boolean", "fan"], clima)}</select></label>
        <label class="dm-gn-int"><span>🚪</span><span class="dm-gn-col"><span class="dm-gn-t">${esc(t("Il garage", "The garage"))}</span><span class="dm-gn-s">${esc(t("Un tasto nell'avviso per aprirlo: mai da solo", "A button in the reminder to open it: never by itself"))}</span></span>
          <select data-gn-campo="garage">${opzioniDiEntita(["cover"], garage)}</select></label>
        ${state.errore ? `<div class="dm-gn-errore">${esc(state.errore)}</div>` : ""}
        <button type="button" class="dm-gn-salva" data-gn-salva${state.salvando ? " disabled" : ""}>${esc(state.salvando ? t("Salvo…", "Saving…") : t("Salva il viaggio", "Save trip"))}</button>
        ${b.id ? `<button type="button" class="dm-gn-elimina" data-gn-elimina>${esc(t("Elimina il viaggio", "Delete trip"))}</button>` : ""}
        <div class="dm-gn-nota">${esc(t("Lo trovi subito in gdanav, sul telefono e in auto.", "You find it right away in gdanav, on the phone and in the car."))}</div>
      </div>
    </div>`;
}

function premium() {
  return `<div class="dm-gn-card dm-gn-premium"><img src="${esc(logo())}" alt=""><div>
    <div class="dm-gn-nome">${esc(t("Il pianificatore è di gdanav Premium", "The planner is part of gdanav Premium"))}</div>
    <div class="dm-gn-sotto">${esc(t("Pianifica i viaggi da qui e ritrovali sul telefono, su CarPlay e su Android Auto, con l'avviso per partire e il clima dell'auto acceso prima. Si sblocca dall'app gdahome, nella pagina Premium.", "Plan trips from here and find them on your phone, CarPlay and Android Auto, with a reminder to leave and the car climate on in advance. Unlock it in the gdahome app, on the Premium page."))}</div></div></div>`;
}

/* Si disegna dentro `.dm-gn-corpo`, non in `#dm-gn`.
 *
 * «L'intestazione compare e scompare continuamente»: la testata della pagina
 * (`page-masthead-section.js`) va a stare dentro `#dm-gn`, l'unico contenitore
 * della pagina, e questa sezione lo riscriveva da capo a ogni `render` di
 * Home Assistant, cioe' a ogni stato che cambia in casa. La testata spariva,
 * il suo guardiano la rimetteva, e di nuovo. Adesso il disegno sta in un
 * figlio suo, e si riscrive solo quando cambia davvero. */
function corpo() {
  const casa = doc?.getElementById?.("dm-gn");
  if (!casa) return null;
  let dentro = casa.querySelector(":scope > .dm-gn-corpo");
  if (!dentro) {
    dentro = doc.createElement("div");
    dentro.className = "dm-gn-corpo";
    casa.append(dentro);
  }
  return dentro;
}

function scrivi(posto, html) {
  if (state.scritto === html && posto.childElementCount) return false;
  state.scritto = html;
  posto.innerHTML = html;
  return true;
}

export function disegna() {
  const posto = corpo();
  if (!posto) return;
  const attivo = doc.getElementById(GDANAV_PAGE_ID)?.classList.contains("active");
  if (!attivo && state.caricato) return;
  const testa = `<div class="dm-gn-capo"><div class="dm-gn-chi"><img src="${esc(logo())}" alt="gdanav">
    <p>${esc(t("Pianifica i viaggi da qui: li ritrovi in gdanav sul telefono, su CarPlay e su Android Auto.", "Plan trips from here: you find them in gdanav on the phone, CarPlay and Android Auto."))}</p></div>
    ${state.sbloccato ? `<button type="button" class="dm-gn-nuovo" data-gn-nuovo>＋ ${esc(t("Nuovo viaggio", "New trip"))}</button>` : ""}</div>`;
  if (!state.caricato) {
    scrivi(
      posto,
      `${testa}<div class="dm-gn-card dm-gn-vuoto">${esc(t("Carico i viaggi…", "Loading trips…"))}</div>`,
    );
    return;
  }
  if (!state.sbloccato) {
    scrivi(posto, `${testa}${premium()}`);
    return;
  }
  /* Il campo di ricerca non si ridisegna sotto le dita: si tiene il fuoco. */
  const cerca = posto.querySelector("[data-gn-cerca]");
  const fuoco = cerca && doc.activeElement === cerca;
  const cursore = fuoco ? cerca.selectionStart : null;
  const html = `${testa}<div class="dm-gn-griglia"><div class="dm-gn-card">${elenco()}</div><div class="dm-gn-card">${editor()}</div></div>`;
  if (!scrivi(posto, html)) return;
  if (fuoco) {
    const nuovo = posto.querySelector("[data-gn-cerca]");
    nuovo?.focus();
    if (cursore !== null) nuovo?.setSelectionRange?.(cursore, cursore);
  }
}

/* ── gesti ───────────────────────────────────────────────────────────────── */

let cercaTimer = 0;
let quanteRicerche = 0;

async function cerca(testo) {
  const mia = ++quanteRicerche;
  if (clean(testo).length < 3) {
    state.proposte = [];
    state.ricerca = "";
    disegna();
    return;
  }
  state.ricerca = "cerco";
  disegna();
  try {
    const risposta = await chiedi("cerca", { testo }, 20000);
    if (mia !== quanteRicerche) return;
    state.proposte = Array.isArray(risposta?.posti) ? risposta.posti : [];
    state.ricerca = state.proposte.length ? "" : risposta?.guasto ? "guasto" : "vuota";
  } catch (_errore) {
    if (mia !== quanteRicerche) return;
    state.proposte = [];
    state.ricerca = "guasto";
  }
  disegna();
}

async function stimaLaStrada() {
  const b = state.bozza;
  if (!b?.tappe?.length) return;
  try {
    const risposta = await chiedi("strada", { da: b.da, tappe: b.tappe }, 15000);
    if (state.bozza !== b) return;
    if (risposta?.stima) {
      /* Una stima col traffico del navigatore non si butta per una senza. */
      if (b.stima?.fonte !== "traffico") b.stima = risposta.stima;
      state.linea = Array.isArray(risposta.linea) ? risposta.linea : [];
      if (!b.da && risposta.da) state.casa = risposta.da;
    }
  } catch (_errore) {
    /* Senza strada si salva lo stesso: la stima la portera' il navigatore. */
  }
  disegna();
}

function scegliIlViaggio(id) {
  const v = state.viaggi.find((x) => x.id === id);
  if (!v) return;
  state.scelto = id;
  state.bozza = structuredClone({
    id: v.id,
    tipo: v.tipo,
    nome: v.nome || "",
    da: v.da || null,
    tappe: v.tappe || [],
    quando: { ...v.quando, giorni: v.quando?.giorni || [] },
    avviso: v.avviso || { acceso: true, minuti: 10 },
    prepara: v.prepara || { clima: null, garage: null },
    stima: v.stima || null,
  });
  state.linea = [];
  state.proposte = [];
  state.cercando = "";
  state.errore = "";
  disegna();
  void stimaLaStrada();
}

async function salva() {
  const b = state.bozza;
  if (!b || state.salvando) return;
  if (!b.tappe.length) {
    state.errore = t("Manca la meta.", "The destination is missing.");
    disegna();
    return;
  }
  state.salvando = true;
  state.errore = "";
  disegna();
  try {
    const risposta = await chiedi("salva", { viaggio: b });
    state.scelto = risposta?.viaggio?.id || "";
    if (risposta?.viaggio) state.bozza.id = risposta.viaggio.id;
    await carica();
  } catch (errore) {
    const perche = clean(errore?.message);
    state.errore =
      perche === "premium-richiesto"
        ? t("Serve gdanav Premium.", "gdanav Premium is needed.")
        : perche === "troppi-viaggi"
          ? t("Hai già 50 viaggi: togline qualcuno.", "You already have 50 trips: remove some.")
          : t(
              "Il viaggio non si è salvato: controlla la meta, il giorno e l'ora.",
              "The trip was not saved: check destination, day and time.",
            );
  }
  state.salvando = false;
  disegna();
}

async function elimina() {
  const b = state.bozza;
  if (!b?.id) return;
  if (!root.confirm?.(t("Elimino questo viaggio?", "Delete this trip?"))) return;
  try {
    await chiedi("togli", { viaggio: b.id });
    state.bozza = null;
    state.scelto = "";
    await carica();
  } catch (_errore) {
    state.errore = t("Non sono riuscito a eliminarlo.", "Could not delete it.");
    disegna();
  }
}

function alClic(event) {
  const bersaglio = event.target?.closest?.(
    "#dm-gn [data-gn-nuovo], #dm-gn button[data-gn-apri], #dm-gn [data-gn-tipo], #dm-gn [data-gn-modo], #dm-gn [data-gn-giorno], #dm-gn [data-gn-proposta], #dm-gn [data-gn-togli-tappa], #dm-gn [data-gn-salva], #dm-gn [data-gn-elimina]",
  );
  if (!bersaglio) return;
  const d = bersaglio.dataset;
  if ("gnNuovo" in d) {
    state.bozza = bozzaNuova("una");
    state.scelto = "";
    state.linea = [];
    state.proposte = [];
    state.cercando = "";
    state.errore = "";
  } else if (d.gnApri) {
    scegliIlViaggio(d.gnApri);
    return;
  } else if (d.gnTipo && state.bozza) {
    const b = state.bozza;
    const nuova = bozzaNuova(d.gnTipo);
    b.tipo = d.gnTipo;
    b.quando = { ...nuova.quando, ora: b.quando.ora };
    if (b.tipo !== "tappe") b.tappe = b.tappe.slice(-1);
  } else if (d.gnModo && state.bozza) {
    state.bozza.quando.modo = d.gnModo;
  } else if (d.gnGiorno && state.bozza) {
    const n = Number(d.gnGiorno);
    const giorni = new Set(state.bozza.quando.giorni);
    if (giorni.has(n)) giorni.delete(n);
    else giorni.add(n);
    state.bozza.quando.giorni = [...giorni].sort();
  } else if (d.gnProposta && state.bozza) {
    const posto = state.proposte[Number(d.gnProposta)];
    if (posto) {
      if (state.bozza.tipo === "tappe") state.bozza.tappe.push(posto);
      else state.bozza.tappe = [posto];
      if (state.bozza.stima?.fonte !== "traffico" || state.bozza.tipo !== "tappe")
        state.bozza.stima = null;
      state.proposte = [];
      state.cercando = "";
      state.linea = [];
      void stimaLaStrada();
    }
  } else if (d.gnTogliTappa && state.bozza) {
    state.bozza.tappe.splice(Number(d.gnTogliTappa), 1);
    state.bozza.stima = null;
    state.linea = [];
    void stimaLaStrada();
  } else if ("gnSalva" in d) {
    void salva();
    return;
  } else if ("gnElimina" in d) {
    void elimina();
    return;
  }
  disegna();
}

function alCambio(event) {
  const campo = event.target;
  const b = state.bozza;
  if (!b || !campo?.closest?.("#dm-gn")) return;
  if (campo.dataset.gnSosta !== undefined) {
    const tappa = b.tappe[Number(campo.dataset.gnSosta)];
    if (tappa) tappa.sostaMin = Math.max(0, Math.min(720, Number(campo.value) || 0));
    disegna();
    return;
  }
  switch (campo.dataset.gnCampo) {
    case "nome":
      b.nome = campo.value;
      return;
    case "giorno":
      b.quando.giorno = campo.value;
      break;
    case "ora":
      b.quando.ora = campo.value;
      break;
    case "avviso":
      b.avviso.acceso = campo.checked;
      break;
    case "avvisoMin":
      b.avviso.minuti = Number(campo.value) || 10;
      break;
    case "clima":
      b.prepara.clima = campo.value ? { entity: campo.value, minuti: 10 } : null;
      break;
    case "garage":
      b.prepara.garage = campo.value ? { entity: campo.value } : null;
      break;
    default:
      return;
  }
  disegna();
}

function alTesto(event) {
  const campo = event.target;
  if (!campo?.matches?.("#dm-gn [data-gn-cerca]")) return;
  state.cercando = campo.value;
  root.clearTimeout?.(cercaTimer);
  cercaTimer = root.setTimeout?.(() => void cerca(state.cercando), 350);
}

/* ── lo stile ────────────────────────────────────────────────────────────── */

const STILE = `
.dm-gn{--gn-mappa:#e9eef2;--gn-card:#fff;--gn-bordo:#e2e8f0;--gn-testo:#0f172a;--gn-piano:#64748b;--gn-fondo:#f8fafc;max-width:1396px;margin:0 auto;padding:4px 0 24px;color:var(--gn-testo)}
body.dark-mode .dm-gn,html.dark .dm-gn{--gn-mappa:#1e293b;--gn-card:#111827;--gn-bordo:#273449;--gn-testo:#e5e7eb;--gn-piano:#94a3b8;--gn-fondo:#0f172a}
.dm-gn-tab-logo{width:26px;height:26px;border-radius:7px;display:block;object-fit:cover}
.dm-gn-capo{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:4px 4px 16px;flex-wrap:wrap}
.dm-gn-chi{display:flex;align-items:center;gap:14px}
.dm-gn-chi img{width:48px;height:48px;border-radius:13px;box-shadow:0 4px 12px #0f172a40}
.dm-gn-capo p{margin:0;color:var(--gn-piano);font-size:15px;max-width:640px}
.dm-gn-nuovo,.dm-gn-salva{background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;border:0;border-radius:14px;padding:12px 20px;font-weight:800;font-size:15px;cursor:pointer;box-shadow:0 8px 20px #2563eb40}
.dm-gn-salva{width:100%;margin-top:14px;padding:14px;font-size:16px}
.dm-gn-salva[disabled]{opacity:.6}
.dm-gn-elimina{width:100%;margin-top:8px;background:none;border:1px solid #fecaca;color:#dc2626;border-radius:14px;padding:10px;font-weight:700;cursor:pointer}
.dm-gn-griglia{display:grid;grid-template-columns:minmax(min(280px,100%),420px) 1fr;gap:22px}
.dm-gn-card{background:var(--gn-card);border-radius:22px;box-shadow:0 10px 30px #0f172a12;border:1px solid var(--gn-bordo);padding:18px}
.dm-gn-tit{font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--gn-piano);margin:18px 6px 8px}
.dm-gn-card>.dm-gn-tit:first-child{margin-top:2px}
.dm-gn-viaggio{display:flex;gap:12px;align-items:center;width:100%;text-align:left;font:inherit;color:inherit;padding:12px;border-radius:16px;border:1px solid var(--gn-bordo);margin-bottom:10px;background:var(--gn-fondo);cursor:pointer}
.dm-gn-viaggio.su{border-color:#93c5fd;box-shadow:0 0 0 3px #bfdbfe80}
.dm-gn-ic{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;font-size:20px;flex:none}
.dm-gn-col{display:flex;flex-direction:column;min-width:0;flex:1}
.dm-gn-nome{font-weight:800;font-size:16px}
.dm-gn-sotto{color:var(--gn-piano);font-size:13px;margin-top:2px}
.dm-gn-pills{display:flex;flex-wrap:wrap}
.dm-gn-pill{display:inline-flex;gap:5px;align-items:center;padding:4px 10px;border-radius:99px;font-size:12.5px;font-weight:700;margin:6px 6px 0 0}
.dm-gn-pill.b{background:#dbeafe;color:#1d4ed8}.dm-gn-pill.o{background:#fef3c7;color:#b45309}.dm-gn-pill.v{background:#ede9fe;color:#6d28d9}
.dm-gn-dett{display:grid;grid-template-columns:1fr minmax(min(260px,100%),360px);gap:18px}
.dm-gn-seg{display:flex;background:var(--gn-fondo);border:1px solid var(--gn-bordo);border-radius:14px;padding:4px;gap:4px;margin-bottom:12px}
.dm-gn-seg button{flex:1;padding:9px;border-radius:11px;font-weight:700;font-size:14px;color:var(--gn-piano);border:0;background:none;cursor:pointer;font-family:inherit}
.dm-gn-seg button.on{background:var(--gn-card);color:#2563eb;box-shadow:0 2px 6px #0f172a1a}
.dm-gn-seg.piccolo{margin:8px 0 0}
.dm-gn-nomecampo input,.dm-gn-cerca input{width:100%;border:0;background:none;font:inherit;font-size:15px;color:inherit;outline:none}
.dm-gn-nomecampo{display:block;border:1px solid var(--gn-bordo);border-radius:14px;padding:10px 14px;margin-bottom:10px}
.dm-gn-cerca{display:flex;align-items:center;gap:10px;border:2px solid #93c5fd;border-radius:14px;padding:10px 14px;background:var(--gn-card);margin-bottom:6px}
.dm-gn-proposte{border:1px solid var(--gn-bordo);border-radius:14px;margin-bottom:12px;overflow:hidden}
.dm-gn-proposte button{display:block;width:100%;text-align:left;padding:9px 14px;font:inherit;font-size:14px;border:0;border-bottom:1px solid var(--gn-bordo);background:var(--gn-card);color:inherit;cursor:pointer}
.dm-gn-proposte button:hover{background:#eff6ff}
.dm-gn-tappe{margin-bottom:8px}
.dm-gn-tappa{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:12px;background:var(--gn-fondo);margin-bottom:6px;font-size:14px}
.dm-gn-tappa>span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dm-gn-sosta{font-size:12.5px;color:var(--gn-piano)}
.dm-gn-sosta input{width:56px}
.dm-gn-x{border:0;background:none;color:var(--gn-piano);cursor:pointer;font-size:14px}
.dm-gn-mappa{position:relative;border-radius:18px;overflow:hidden;margin:8px 0}
.dm-gn-osm{position:absolute;right:8px;bottom:6px;padding:1px 6px;border-radius:6px;background:#ffffffd9;color:#334155;font-size:10px;font-weight:700}
.dm-gn-ricerca{padding:8px 14px;margin:-2px 0 10px;border-radius:12px;font-size:13px;font-weight:700;background:var(--gn-mappa);color:var(--gn-piano)}
.dm-gn-ricerca[data-gn-ricerca="guasto"]{background:#fef2f2;color:#b91c1c}
.dm-gn-mappa svg{display:block;width:100%;height:auto}
.dm-gn-mappa-vuota{height:140px;display:grid;place-items:center;background:var(--gn-mappa);color:var(--gn-piano);font-size:14px;padding:0 16px;text-align:center}
.dm-gn-campo{display:flex;align-items:center;gap:12px;padding:11px 4px;border-bottom:1px solid var(--gn-bordo);font-size:15px}
.dm-gn-campo>span:first-child{flex:1}
.dm-gn-campo input{font:inherit;font-size:16px;font-weight:700;border:1px solid var(--gn-bordo);border-radius:10px;padding:6px 8px;background:var(--gn-card);color:inherit}
.dm-gn-giorni{display:flex;gap:5px;flex-wrap:wrap}
.dm-gn-giorni button{width:32px;height:32px;border-radius:50%;border:0;font-weight:800;font-size:13px;background:var(--gn-fondo);color:var(--gn-piano);cursor:pointer}
.dm-gn-giorni button.on{background:#2563eb;color:#fff}
.dm-gn-parti{background:linear-gradient(160deg,#eff6ff,#e0e7ff);color:#0f172a;border-radius:18px;padding:16px 18px}
.dm-gn-parti-t{font-weight:700;color:#475569}
.dm-gn-ora{font-size:46px;font-weight:900;color:#1d4ed8;line-height:1.05}
.dm-gn-riga{font-size:14px;margin-top:6px;color:#334155}
.dm-gn-int{display:flex;align-items:center;gap:10px;padding:9px 2px}
.dm-gn-t{font-weight:700;font-size:15px}
.dm-gn-s{font-size:12.5px;color:var(--gn-piano)}
.dm-gn-int select{max-width:150px;font:inherit;font-size:13px;border:1px solid var(--gn-bordo);border-radius:10px;padding:6px;background:var(--gn-card);color:inherit}
.dm-gn-sw{width:40px;height:22px;accent-color:#2563eb}
.dm-gn-nota{font-size:12.5px;color:var(--gn-piano);margin-top:10px;text-align:center}
.dm-gn-errore{margin-top:10px;padding:10px 12px;border-radius:12px;background:#fef2f2;color:#b91c1c;font-size:14px;font-weight:600}
.dm-gn-vuoto{color:var(--gn-piano);font-size:14px;padding:12px 6px}
.dm-gn-vuoto.grande{display:grid;place-items:center;min-height:300px;text-align:center}
.dm-gn-premium{display:flex;gap:16px;align-items:center}
.dm-gn-premium img{width:72px;height:72px;border-radius:18px}
@media (max-width:980px){.dm-gn-griglia,.dm-gn-dett{grid-template-columns:1fr}}
`;

/* ── accensione ──────────────────────────────────────────────────────────── */

function schedule() {
  if (state.frame) return;
  state.frame =
    root.requestAnimationFrame?.(() => {
      state.frame = 0;
      ensureGdanavPage();
      ensureGdanavTab();
      disegna();
    }) || 0;
}

export function installGdanavSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyle("dm-gdanav-style", STILE);
  ensureGdanavPage();
  teachNavVisibility();
  ensureGdanavTab();
  doc.addEventListener("click", alClic);
  doc.addEventListener("change", alCambio);
  doc.addEventListener("input", alTesto);
  for (const name of ["render", "cdApplyNavVis"]) wrapFunction(name, "__dmGdanavSection", schedule);
  for (const event of ["dashboardmodern:legacy-ready", "dashboardmodern:states-ready"])
    root.addEventListener?.(event, schedule);
  schedule();
}
