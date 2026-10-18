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
 *
 * Con un'auto elettrica (o ibrida) nella pagina Auto c'e' il riquadro
 * «L'auto»: la batteria, con quanta carica si parte, e le soste di ricarica
 * che la casa calcola sulla strada con l'archivio delle colonnine rapide —
 * in elenco sotto la cartina, coi fulmini sulla cartina, e nell'ora in cui
 * partire. Senza un'auto cosi', chi amministra la casa trova l'invito a
 * collegarla; gli altri niente.
 */

import {
  bozzaNuova,
  caricaAllaPartenza,
  caricaDopo,
  consumoStimato,
  durataDetta,
  durataStimata,
  GIORNI,
  laStradaInFila,
  minutiDiRicarica,
  MINIME_ALL_ARRIVO,
  nomeDelViaggio,
  oraDi,
  partenzaEArrivo,
  POTENZE_DELLE_COLONNINE,
  quandoDetto,
  sosteDi,
} from "../core/i-viaggi.js";
import {
  CAPACITA_DI_SERIE,
  inKilowatt,
  tempoDellaRicarica,
} from "../core/il-tempo-della-ricarica.js";
import { FONDI_MAPPA } from "../core/radar-mappa.js";
import {
  capacitaDellaBatteria,
  siRicarica,
  VEHICLE_KEY_FIELD,
  vehicleLabel,
} from "../core/vehicle-model.js";
import { capacitaDellAutoInUso } from "./auto-termica-section.js";
import { nellApp } from "./automazioni-section.js";
import { activeVehicle, profiles, vehicleBatteryEntity, vehiclePlugged } from "./ev-section.js";
import { codiceDellaRicaricaAdesso, kilowattDellaColonnina } from "./ev-stato-e-target-section.js";
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
  /* Dalla strada con l'auto: dove cadono le tappe, se le colonnine vengono
   * dall'archivio e le sue fonti, e se il conto e' in corso. */
  tappeKm: [],
  archivio: null,
  calcolo: false,
  /* Le scelte dell'auto si mostrano quando servono — ci sono soste — o quando
   * qualcuno le ha gia' toccate. */
  opzioniAperte: false,
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

/* La linguetta, subito dopo Home. Nell'app non c'e': i viaggi si pianificano
 * dentro il navigatore, da «Pianifica i viaggi» del menu laterale e dalla
 * scheda sulla mappa di gdanav. Nel browser di Home Assistant resta qui. */
export function ensureGdanavTab() {
  if (!doc) return null;
  let tab = doc.querySelector(`.tab[data-tab="${GDANAV_TAB}"]`);
  if (nellApp()) {
    tab?.remove();
    return null;
  }
  if (tab) return tab;
  const nav = doc.querySelector("nav.tabs");
  if (!nav) return null;
  const dopo = nav.querySelector('.tab[data-tab="home"]');
  tab = doc.createElement("button");
  tab.className = "tab";
  tab.dataset.tab = GDANAV_TAB;
  tab.id = `tab-${GDANAV_TAB}`;
  tab.innerHTML = `<span class="icon"><img class="dm-gn-tab-logo" src="${esc(logo())}" alt=""></span><span class="text">GdANav</span>`;
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
  /* Le soste di ricarica: pallini arancio col fulmine, e il loro numero. */
  const ricariche = (leAuto().length ? sosteDi(b) : [])
    .filter(
      (s) => Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lon)) && s.lat !== null,
    )
    .map((s, i) => {
      const [x, y] = qui([Number(s.lon), Number(s.lat)]);
      return `<g class="dm-gn-fulmine" data-gn-fulmine="${i + 1}" transform="translate(${x} ${y})">
        <circle r="11" fill="#f59e0b" stroke="#fff" stroke-width="3"/>
        <path d="M1.6 -7 L-4.4 1.2 H-0.4 L-1.6 7 L4.4 -1.4 H0.4 Z" fill="#fff"/>
        <circle cx="11" cy="-10" r="7" fill="#111827" stroke="#fff" stroke-width="1.5"/>
        <text x="11" y="-7" text-anchor="middle" font-size="9" font-weight="800" fill="#fff">${i + 1}</text></g>`;
    })
    .join("");
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
    ${ricariche}
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

/* ── l'auto elettrica ────────────────────────────────────────────────────────
 *
 * «Arrivo a Milano con la carica che ho?» La plancia l'auto la conosce gia':
 * i profili della pagina Auto (`ev-section.js`), con la batteria, l'autonomia,
 * l'obiettivo e la potenza della carica di casa. Qui si legge l'auto scelta per
 * il viaggio, si dice con quanta carica si parte, e la casa — che sa la strada
 * e le colonnine rapide — risponde con le soste (`ponte/src/soste.js`). Il
 * consumo non lo dice nessuna entita': lo si ricava dalla batteria e
 * dall'autonomia che l'auto stima, o sono 17 kWh ogni 100 km.
 *
 * Le auto che contano sono quelle che si ricaricano: elettriche e ibride. Una
 * plancia senza profili ma con la batteria mappata ha un'auto sola, la sua. */

function leAuto() {
  const tutte = profiles().filter((car) => siRicarica(car));
  if (tutte.length) return tutte;
  if (profiles().length) return [];
  return vehicleBatteryEntity({}) ? [{ [VEHICLE_KEY_FIELD]: "", name: "" }] : [];
}

function nomeDellAuto(car, indice = 0) {
  return car?.[VEHICLE_KEY_FIELD] || car?.name
    ? vehicleLabel(car, indice, t("La tua auto", "Your car"))
    : t("La tua auto", "Your car");
}

function statoDi(id) {
  return id ? allStates()?.[id] || null : null;
}

function numeroDi(stato) {
  const n = Number.parseFloat(String(stato?.state ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/* L'entita' di una casella per quest'auto: la sua, o — se e' l'auto in uso —
 * quella della mappatura generale. */
function entitaDi(car, ref, inUso) {
  const propria = clean((car?.ov || car?.overrides || {})[ref]);
  if (propria) return propria;
  if (!inUso) return "";
  let risolta = "";
  try {
    risolta = clean(root.resolveEntity?.(ref));
  } catch (_errore) {
    risolta = "";
  }
  return risolta && risolta !== ref ? risolta : "";
}

/** Quello che si sa dell'auto adesso. */
function datiDellAuto(car) {
  const auto = leAuto();
  const uid = car?.[VEHICLE_KEY_FIELD] || "";
  const inUso = !profiles().length || uid === (activeVehicle()?.[VEHICLE_KEY_FIELD] || "");
  const carica = numeroDi(statoDi(vehicleBatteryEntity(car)));
  const autonomia = numeroDi(statoDi(entitaDi(car, "dm.ev_autonomia", inUso)));
  const obiettivo = numeroDi(statoDi(entitaDi(car, "dm.ev_target_soc", inUso)));
  const potenzaPropria = statoDi(entitaDi(car, "dm.ev_potenza_ricarica", inUso));
  let kw = inKilowatt(potenzaPropria?.state, potenzaPropria?.attributes?.unit_of_measurement);
  let inCarica = false;
  let collegata = false;
  if (inUso) {
    try {
      inCarica = codiceDellaRicaricaAdesso() === "C";
      kw = kw ?? kilowattDellaColonnina();
      collegata = vehiclePlugged() === true;
    } catch (_errore) {
      inCarica = false;
    }
  } else {
    const detto = clean(statoDi(entitaDi(car, "dm.ev_stato_ricarica", false))?.state);
    inCarica = /^[cd]$|charg|in carica|ricaric/i.test(detto);
  }
  const kwh =
    capacitaDellaBatteria(car) ??
    (profiles().length ? null : capacitaDellAutoInUso()) ??
    CAPACITA_DI_SERIE;
  const fine =
    inCarica && carica !== null && obiettivo !== null
      ? tempoDellaRicarica({
          codice: "C",
          soc: carica,
          target: obiettivo,
          kilowatt: kw,
          capacita: kwh,
        })
      : null;
  return {
    uid,
    nome: nomeDellAuto(car, Math.max(0, auto.indexOf(car))),
    carica,
    autonomia,
    obiettivo,
    kw: inCarica && kw !== null && kw > 0 ? kw : null,
    inCarica,
    collegata,
    fineAlle: fine?.stato === "carica" ? Date.now() + fine.minuti * 60_000 : null,
    kwh,
    consumo: consumoStimato({ kwh, carica, autonomia }),
  };
}

/** L'auto del viaggio: quella scelta, o quella in uso, o la prima. */
function lAutoDelViaggio(b) {
  const auto = leAuto();
  if (!auto.length) return null;
  const scelta = b?.auto?.uid;
  const inUso = activeVehicle()?.[VEHICLE_KEY_FIELD];
  return (
    auto.find((car) => scelta && car[VEHICLE_KEY_FIELD] === scelta) ||
    auto.find((car) => inUso && car[VEHICLE_KEY_FIELD] === inUso) ||
    auto[0]
  );
}

/** Le scelte dell'auto per il viaggio, con quelle di serie: si parte con
 * l'obiettivo se l'auto e' in carica, se no con quello che ha. */
function opzioniDellAuto(b, dati) {
  const dette = b?.auto || {};
  return {
    uid: dati?.uid ?? "",
    partenza: ["adesso", "obiettivo", 100].includes(dette.partenza)
      ? dette.partenza
      : dati?.inCarica && dati.obiettivo !== null
        ? "obiettivo"
        : "adesso",
    minimaArrivo: MINIME_ALL_ARRIVO.includes(dette.minimaArrivo) ? dette.minimaArrivo : 15,
    kwColonnine: POTENZE_DELLE_COLONNINE.includes(dette.kwColonnine) ? dette.kwColonnine : 100,
  };
}

/** L'auto come la vuole la casa per la strada, o `null` se non si sa la carica. */
function autoPerLaStrada(b) {
  const car = lAutoDelViaggio(b);
  if (!car) return null;
  const dati = datiDellAuto(car);
  const scelte = opzioniDellAuto(b, dati);
  const batteria = caricaAllaPartenza(scelte.partenza, dati.carica, dati.obiettivo);
  if (batteria === null) return null;
  return {
    batteria: Math.round(batteria),
    kwh: dati.kwh,
    consumo: dati.consumo,
    kwMax: null,
    minimaArrivo: scelte.minimaArrivo,
    kwColonnine: scelte.kwColonnine,
  };
}

const cifre = (n, massimo = 0) =>
  Number(n).toLocaleString(activeLocale?.() || "it", { maximumFractionDigits: massimo });

const pct = (n) => `${Math.round(n)}%`;

function statoDettoDellAuto(dati) {
  if (dati.inCarica) {
    if (dati.fineAlle && dati.obiettivo !== null) {
      const ora = oraDi(dati.fineAlle);
      const fino = pct(dati.obiettivo);
      return `⚡ ${t(`In carica a casa · ${fino} alle ${ora}`, `Charging at home · ${fino} at ${ora}`)}`;
    }
    return `⚡ ${t("In carica", "Charging")}`;
  }
  return dati.collegata
    ? `🔌 ${t("Ferma a casa · non in carica", "Parked at home · not charging")}`
    : `🔌 ${t("Ferma · non in carica", "Parked · not charging")}`;
}

function sosteDette(n) {
  return n === 1
    ? t("con 1 sosta di ricarica", "with 1 charging stop")
    : t(`con ${n} soste di ricarica`, `with ${n} charging stops`);
}

/* Il riquadro «L'auto», nella colonna di destra. */
function riquadroDellAuto(b) {
  const auto = leAuto();
  if (!auto.length) return invitoACollegare();
  const car = lAutoDelViaggio(b);
  const dati = datiDellAuto(car);
  const scelte = opzioniDellAuto(b, dati);
  const partenza = caricaAllaPartenza(scelte.partenza, dati.carica, dati.obiettivo);
  const soste = sosteDi(b);
  const conto = b.soste && b.tappe.length ? b.soste : null;
  const arrivo = Number.isFinite(Number(conto?.arrivo)) ? Number(conto.arrivo) : null;
  const scelta =
    auto.length > 1
      ? `<select class="dm-gn-auto-scelta" data-gn-campo="autoUid" aria-label="${esc(t("Quale auto", "Which car"))}">${auto
          .map(
            (c, i) =>
              `<option value="${esc(c[VEHICLE_KEY_FIELD] || "")}"${c === car ? " selected" : ""}>${esc(nomeDellAuto(c, i))}</option>`,
          )
          .join("")}</select>`
      : "";
  /* La barra: adesso, il tratto che si caricera' prima di partire, e la tacca
   * della partenza; o, se si parte con quello che c'e', la tacca dell'arrivo. */
  const adesso = dati.carica ?? 0;
  const siCarica = partenza !== null && partenza > adesso + 0.5;
  const tacca = siCarica ? partenza : arrivo;
  const misura = (n) => Math.max(0, Math.min(100, n));
  const ora = pct(adesso);
  const via = partenza !== null ? pct(partenza) : "";
  const fine = arrivo !== null ? pct(arrivo) : "";
  const barra =
    dati.carica === null && partenza === null
      ? ""
      : `<div class="dm-gn-barra" role="img" aria-label="${esc(t(`Batteria dell'auto: ${ora}`, `Car battery: ${ora}`))}">
        <i class="dm-gn-barra-ora" style="width:${misura(adesso).toFixed(1)}%"></i>
        ${siCarica ? `<i class="dm-gn-barra-poi" style="left:${misura(adesso).toFixed(1)}%;width:${misura(partenza - adesso).toFixed(1)}%"></i>` : ""}
        ${tacca !== null ? `<b class="dm-gn-barra-tacca" style="left:${misura(tacca).toFixed(1)}%"></b>` : ""}
      </div>
      <div class="dm-gn-barra-dida">${
        siCarica
          ? `<span>${esc(t(`adesso ${ora}`, `now ${ora}`))}</span><span>${esc(t(`alla partenza ${via}`, `at departure ${via}`))}</span>`
          : `<span>${arrivo !== null ? esc(t(`all'arrivo ${fine}`, `on arrival ${fine}`)) : ""}</span><span>${esc(t(`adesso ${ora}`, `now ${ora}`))}</span>`
      }</div>`;
  const casella = (valore, etichetta, classe = "") =>
    `<div class="dm-gn-num${classe}"><b>${esc(valore)}</b><span>${esc(etichetta)}</span></div>`;
  const terzo =
    dati.kw !== null
      ? casella(`${cifre(dati.kw, 1)} kW`, t("in carica", "charging"), " verde")
      : casella(b.stima?.km ? `${cifre(b.stima.km)} km` : "—", t("il viaggio", "the trip"));
  const numeri = `<div class="dm-gn-numeri">${casella(dati.carica === null ? "—" : pct(dati.carica), t("adesso", "now"))}${casella(dati.autonomia === null ? "—" : `${cifre(dati.autonomia)} km`, t("autonomia", "range"))}${terzo}</div>`;
  let esito = "";
  if (!b.tappe.length) esito = "";
  else if (partenza === null)
    esito = `<div class="dm-gn-esito grigio"><span>🔋</span><span class="dm-gn-col"><b>${esc(t("La batteria non risponde", "The battery is not answering"))}</b><small>${esc(t("Per le soste scegli 100% alla partenza.", "For the stops, choose 100% at departure."))}</small></span></div>`;
  else if (!conto)
    esito = `<div class="dm-gn-esito grigio"><span>⚡</span><span class="dm-gn-col"><b>${esc(state.calcolo ? t("Calcolo le soste…", "Working out the stops…") : t("Le soste arrivano con la strada", "The stops come with the route"))}</b></span></div>`;
  else if (soste.length) {
    const minuti = minutiDiRicarica(b);
    esito = `<div class="dm-gn-esito giallo" data-gn-esito="soste"><span>⚡</span><span class="dm-gn-col"><b>${esc(t(`Arrivi col ${fine}`, `You arrive with ${fine}`))} ${esc(sosteDette(soste.length))}</b><small>${esc(t(`${minuti} minuti di ricarica in tutto`, `${minuti} minutes of charging in all`))}</small></span></div>`;
  } else {
    const ritorno = arrivo !== null ? arrivo - (partenza - arrivo) : null;
    const resta = ritorno !== null ? pct(ritorno) : "";
    const basta =
      ritorno !== null && ritorno >= 10
        ? t(
            `Al ritorno ti resta il ${resta}: basta senza ricaricare`,
            `For the way back you still have ${resta}: no need to charge`,
          )
        : t("Per il ritorno servirà una ricarica", "You will need to charge for the way back");
    esito = `<div class="dm-gn-esito verde" data-gn-esito="nessuna"><span>🏁</span><span class="dm-gn-col"><b>${esc(t(`Arrivi col ${fine} · nessuna sosta`, `You arrive with ${fine} · no stops`))}</b><small>${esc(basta)}</small></span></div>`;
  }
  /* Le scelte si vedono quando servono: ci sono soste, la batteria non
   * risponde, qualcuno le ha toccate o non sono piu' quelle di serie. */
  const diSerie = opzioniDellAuto({}, dati);
  const mostraLeScelte =
    state.opzioniAperte ||
    soste.length > 0 ||
    partenza === null ||
    ["partenza", "minimaArrivo", "kwColonnine"].some((k) => scelte[k] !== diSerie[k]);
  const bottone = (valore, testo) =>
    `<button type="button" class="${scelte.partenza === valore ? "on" : ""}" data-gn-partenza="${esc(String(valore))}">${esc(testo)}</button>`;
  const obiettivo = dati.obiettivo !== null ? pct(dati.obiettivo) : "";
  const sottoPartenza =
    scelte.partenza === "obiettivo" && dati.obiettivo !== null
      ? t(`${obiettivo} = l'obiettivo di stanotte`, `${obiettivo} = tonight's target`)
      : scelte.partenza === 100
        ? t("Piena", "Full")
        : t("Con la carica di adesso", "With the charge it has now");
  const scelteHtml = mostraLeScelte
    ? `<div class="dm-gn-scelte">
        <div class="dm-gn-scelta"><span class="dm-gn-col"><span class="dm-gn-t">${esc(t("Alla partenza", "At departure"))}</span><span class="dm-gn-s">${esc(sottoPartenza)}</span></span>
          <span class="dm-gn-seg mini">${dati.carica !== null ? bottone("adesso", pct(dati.carica)) : ""}${dati.obiettivo !== null && dati.obiettivo > (dati.carica ?? -1) ? bottone("obiettivo", pct(dati.obiettivo)) : ""}${bottone(100, "100%")}</span></div>
        <label class="dm-gn-scelta"><span class="dm-gn-col"><span class="dm-gn-t">${esc(t("Carica minima all'arrivo", "Minimum charge on arrival"))}</span><span class="dm-gn-s">${esc(t("E alle colonnine mai sotto il 10%", "And never below 10% at chargers"))}</span></span>
          <select data-gn-campo="minimaArrivo">${MINIME_ALL_ARRIVO.map((n) => `<option value="${n}"${scelte.minimaArrivo === n ? " selected" : ""}>${n}%</option>`).join("")}</select></label>
        <label class="dm-gn-scelta"><span class="dm-gn-col"><span class="dm-gn-t">${esc(t("Colonnine", "Chargers"))}</span><span class="dm-gn-s">${esc(t("La potenza minima per fermarsi", "The minimum power to stop at"))}</span></span>
          <select data-gn-campo="kwColonnine">${POTENZE_DELLE_COLONNINE.map((n) => `<option value="${n}"${scelte.kwColonnine === n ? " selected" : ""}>${esc(t(`Da ${n} kW`, `From ${n} kW`))}</option>`).join("")}</select></label>
      </div>`
    : "";
  return `<div class="dm-gn-tit">${esc(t("L'auto", "The car"))}</div>
    <div class="dm-gn-auto" data-gn-auto="${esc(dati.uid)}">
      <div class="dm-gn-auto-capo"><span class="dm-gn-auto-ic" aria-hidden="true">🚙</span>
        <span class="dm-gn-col"><span class="dm-gn-auto-nome">${esc(dati.nome)}</span><span class="dm-gn-auto-stato">${esc(statoDettoDellAuto(dati))}</span></span>
        ${scelta}</div>
      ${barra}${numeri}${esito}${scelteHtml}
    </div>`;
}

/* Senza un'auto che si ricarica: a chi amministra la casa si dice dove
 * collegarla; agli altri niente, perche' non potrebbero farlo. */
function invitoACollegare() {
  let amministra = false;
  try {
    amministra = root.dmPuoConfigurare?.() === true;
  } catch (_errore) {
    amministra = false;
  }
  if (!amministra) return "";
  return `<div class="dm-gn-invito" data-gn-invito><span class="dm-gn-invito-ic" aria-hidden="true">🔌</span>
    <span class="dm-gn-col"><span class="dm-gn-t">${esc(t("Collega l'auto per vedere batteria e soste", "Connect the car to see battery and stops"))}</span>
    <span class="dm-gn-s">${esc(t("Batteria e autonomia dell'auto elettrica, e le soste di ricarica se non basta.", "The electric car's battery and range, and the charging stops if it is not enough."))}</span>
    <small>${esc(t("Lo vedi solo tu, che amministri la casa", "Only you see this, as the home's administrator"))}</small></span>
    <button type="button" class="dm-gn-collega" data-gn-collega>${esc(t("Collega", "Connect"))}</button></div>`;
}

/* L'elenco delle soste di ricarica, sotto la cartina: la strada in fila, con
 * le ore e la carica. */
function elencoDelleSoste(b, partenza) {
  const soste = sosteDi(b);
  if (!soste.length || !Number.isFinite(partenza)) return "";
  const conTappe = { ...b, soste: { ...b.soste, tappeKm: state.tappeKm } };
  const fila = laStradaInFila(conTappe, partenza);
  const corto = (posto) => String(posto?.nome || "").split(" · ")[0];
  const minuti = minutiDiRicarica(b);
  const arrivo = Number(b.soste?.arrivo);
  const auto = autoPerLaStrada(b);
  const pillola = (testo, classe = "") =>
    `<span class="dm-gn-batt${classe}">🔋 ${esc(testo)}</span>`;
  const destra = (alle, sotto) =>
    `<span class="dm-gn-fila-ora"><b>${alle ? esc(oraDi(alle)) : ""}</b><small>${esc(sotto)}</small></span>`;
  const riparti = (r) => {
    if (!r.riparte || r.riparte === r.alle) return "";
    const alle = oraDi(r.riparte);
    return t(`riparti ${alle}`, `leave ${alle}`);
  };
  const righe = fila.map((r) => {
    if (r.tipo === "partenza")
      return `<li class="dm-gn-fila partenza"><span class="dm-gn-pallino verde">●</span><span class="dm-gn-col"><b>${esc(corto(b.da) || t("Casa", "Home"))}</b>${auto ? pillola(pct(auto.batteria)) : ""}</span>${destra(r.alle, t("parti", "leave"))}</li>`;
    if (r.tipo === "tappa") {
      const km = r.km !== null ? cifre(r.km) : "";
      return `<li class="dm-gn-fila tappa"><span class="dm-gn-pallino viola">${r.n + 1}</span><span class="dm-gn-col"><b>${esc(corto(r.posto))}</b><small>${km ? esc(t(`dopo ${km} km`, `after ${km} km`)) : ""}</small></span>${destra(r.alle, riparti(r))}</li>`;
    }
    if (r.tipo === "sosta") {
      const s = r.sosta;
      const n = r.n;
      const km = cifre(s.km);
      const min = s.min;
      const kw = s.kw;
      const titolo = s.nome
        ? t(`Sosta ${n} · dopo ${km} km`, `Stop ${n} · after ${km} km`)
        : t(
            `Sosta intorno al km ${km} · circa ${min} min`,
            `Stop around km ${km} · about ${min} min`,
          );
      const sotto = s.nome
        ? [
            s.nome,
            s.operatore && s.operatore !== s.nome ? s.operatore : "",
            kw ? t(`fino a ${kw} kW`, `up to ${kw} kW`) : "",
          ]
            .filter(Boolean)
            .join(" · ")
        : t("La colonnina la sceglie GdANav in viaggio", "GdANav picks the charger on the way");
      const da = pct(s.da);
      const a = pct(s.a);
      const carica =
        Number.isFinite(Number(s.da)) && Number.isFinite(Number(s.a)) && s.da !== null
          ? pillola(
              t(`dal ${da} all'${a} · ${min} min`, `from ${da} to ${a} · ${min} min`),
              " gialla",
            )
          : "";
      return `<li class="dm-gn-fila sosta" data-gn-sosta-di-ricarica="${n}"><span class="dm-gn-pallino arancio">⚡</span><span class="dm-gn-col"><b>${esc(titolo)}</b><small>${esc(sotto)}</small>${carica}</span>${destra(r.alle, riparti(r))}</li>`;
    }
    return `<li class="dm-gn-fila arrivo"><span class="dm-gn-pallino rosso">🏁</span><span class="dm-gn-col"><b>${esc(corto(r.posto))}</b>${Number.isFinite(arrivo) ? pillola(pct(arrivo)) : ""}</span>${destra(r.alle, t("arrivi", "arrive"))}</li>`;
  });
  const fonti =
    b.soste?.fonte === "gdanav"
      ? t(
          "Soste scelte da GdANav in viaggio, con le colonnine libere.",
          "Stops picked by GdANav on the way, with free chargers.",
        )
      : state.archivio
        ? t(
            "Colonnine: © OpenStreetMap e Piattaforma Unica Nazionale, nella casa. In viaggio GdANav guarda se sono libere e, se serve, cambia sosta.",
            "Chargers: © OpenStreetMap and Piattaforma Unica Nazionale, in the home. On the way GdANav checks they are free and, if needed, changes the stop.",
          )
        : t(
            "Le colonnine non ci sono ancora in casa: le soste sono a chilometro. In viaggio GdANav sceglie le colonnine e guarda se sono libere.",
            "The chargers are not in the home yet: stops are by kilometre. On the way GdANav picks the chargers and checks they are free.",
          );
  const n = soste.length;
  const quante = n === 1 ? t("1 sosta", "1 stop") : t(`${n} soste`, `${n} stops`);
  const fine = Number.isFinite(arrivo) ? pct(arrivo) : "";
  return `<div class="dm-gn-soste" data-gn-soste><div class="dm-gn-soste-capo"><b>⚡ ${esc(t("Soste di ricarica", "Charging stops"))}</b>
    <small>${esc(quante)} · ${esc(`${minuti} min`)}${fine ? ` · ${esc(t(`arrivi col ${fine}`, `arrive with ${fine}`))}` : ""}</small></div>
    <ol>${righe.join("")}</ol>
    <div class="dm-gn-fonti">${esc(fonti)}</div></div>`;
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
  /* Le soste di ricarica stanno in una riga loro: la «Strada» resta la
   * guida, con le soste delle tappe. */
  const soste = leAuto().length ? sosteDi(b) : [];
  const ricarica = soste.length ? minutiDiRicarica(b) : 0;
  const righe = [];
  if (durata !== null) {
    righe.push(
      `🛣️ ${t("Strada", "Drive")}: ${durataDetta(durata - ricarica * 60_000, l)}${b.stima?.km ? ` · ${b.stima.km} km` : ""}`,
    );
    if (soste.length) {
      const n = soste.length;
      const minuti = durataDetta(ricarica * 60_000, l);
      righe.push(
        `⚡ ${n === 1 ? t(`Ricarica: ${minuti} in 1 sosta`, `Charging: ${minuti} in 1 stop`) : t(`Ricarica: ${minuti} in ${n} soste`, `Charging: ${minuti} in ${n} stops`)}`,
      );
    }
    righe.push(
      b.stima?.fonte === "traffico"
        ? `🚦 ${t("Col traffico, stimato da GdANav", "With traffic, estimated by GdANav")}`
        : `🔄 ${t("Senza traffico, con un margine: GdANav lo ricalcola col traffico vero fino alla partenza", "Without traffic, with a margin: GdANav recalculates with live traffic until you leave")}`,
    );
  }
  const arrivoDetto =
    tempi?.arrivo != null && !(b.quando.modo === "arrivo" && b.tipo !== "tappe")
      ? `<div class="dm-gn-riga" data-gn-arrivo>🏁 ${esc(t("Arrivi verso le", "You arrive around"))} <b>${esc(oraDi(tempi.arrivo))}</b>${soste.length ? ` ${esc(sosteDette(soste.length))}` : ""}</div>`
      : "";
  const quandoPartire =
    tempi?.partenza != null
      ? `<div class="dm-gn-parti"><div class="dm-gn-parti-t">${esc(t("Parti alle", "Leave at"))}</div><div class="dm-gn-ora">${esc(oraDi(tempi.partenza))}</div>
        ${arrivoDetto}
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
        ${soste.length ? elencoDelleSoste(b, tempi?.partenza) : ""}
        ${giorno}
        ${modo}
        <label class="dm-gn-campo"><span>🏁 ${esc(b.tipo === "tappe" || b.quando.modo === "partenza" ? t("Parto alle", "Leave at") : t("Arrivo entro", "Arrive by"))}</span><input type="time" data-gn-campo="ora" value="${esc(b.quando.ora)}"></label>
      </div>
      <div>
        ${quandoPartire}
        ${riquadroDellAuto(b)}
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
        <div class="dm-gn-nota">${esc(t("Lo trovi subito in GdANav, sul telefono e in auto.", "You find it right away in GdANav, on the phone and in the car."))}</div>
      </div>
    </div>`;
}

function premium() {
  return `<div class="dm-gn-card dm-gn-premium"><img src="${esc(logo())}" alt=""><div>
    <div class="dm-gn-nome">${esc(t("Il pianificatore è di GdANav Premium", "The planner is part of GdANav Premium"))}</div>
    <div class="dm-gn-sotto">${esc(t("Pianifica i viaggi da qui e ritrovali sul telefono, su CarPlay e su Android Auto, con l'avviso per partire e il clima dell'auto acceso prima. Si sblocca dall'app GdAHome, nella pagina Premium.", "Plan trips from here and find them on your phone, CarPlay and Android Auto, with a reminder to leave and the car climate on in advance. Unlock it in the GdAHome app, on the Premium page."))}</div></div></div>`;
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
  const testa = `<div class="dm-gn-capo"><div class="dm-gn-chi"><img src="${esc(logo())}" alt="GdANav">
    <p>${esc(t("Pianifica i viaggi da qui: li ritrovi in GdANav sul telefono, su CarPlay e su Android Auto.", "Plan trips from here: you find them in GdANav on the phone, CarPlay and Android Auto."))}</p></div>
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
  sosteQuandoLAutoRisponde();
  if (!scrivi(posto, html)) return;
  if (fuoco) {
    const nuovo = posto.querySelector("[data-gn-cerca]");
    nuovo?.focus();
    if (cursore !== null) nuovo?.setSelectionRange?.(cursore, cursore);
  }
}

/* La strada si chiede appena scelto il viaggio, e a volte la batteria non ha
 * ancora risposto: quando risponde, si richiede una volta, con l'auto. */
function sosteQuandoLAutoRisponde() {
  const b = state.bozza;
  if (!b?.tappe?.length || b.soste || state.calcolo || state.sosteChiestePer === b) return;
  if (!leAuto().length || !autoPerLaStrada(b)) return;
  state.sosteChiestePer = b;
  void stimaLaStrada();
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

let quanteStrade = 0;

async function stimaLaStrada() {
  const b = state.bozza;
  if (!b?.tappe?.length) return;
  const mia = ++quanteStrade;
  /* Con un'auto elettrica la strada porta anche le soste di ricarica. */
  const auto = autoPerLaStrada(b);
  state.calcolo = Boolean(auto);
  if (auto) state.sosteChiestePer = b;
  try {
    const risposta = await chiedi(
      "strada",
      { da: b.da, tappe: b.tappe, ...(auto ? { auto } : {}) },
      20000,
    );
    if (state.bozza !== b || mia !== quanteStrade) return;
    if (risposta?.stima) {
      /* Una stima col traffico del navigatore non si butta per una senza. */
      if (b.stima?.fonte !== "traffico") b.stima = risposta.stima;
      state.linea = Array.isArray(risposta.linea) ? risposta.linea : [];
      if (!b.da && risposta.da) state.casa = risposta.da;
    }
    const soste = risposta?.soste;
    if (soste && Array.isArray(soste.elenco)) {
      state.tappeKm = Array.isArray(soste.tappeKm) ? soste.tappeKm : [];
      state.archivio = soste.archivio === true;
      /* Allo stesso modo le soste del navigatore, che sa quali colonnine
       * sono libere, restano: finche' non si cambia l'auto o le scelte. */
      if (b.soste?.fonte !== "gdanav")
        b.soste = {
          elenco: soste.elenco,
          arrivo: soste.arrivo,
          partenza: soste.partenza,
          fonte: "casa",
        };
    }
  } catch (_errore) {
    /* Senza strada si salva lo stesso: la stima la portera' il navigatore. */
  }
  if (mia === quanteStrade) state.calcolo = false;
  disegna();
}

/* Una scelta dell'auto cambiata: le soste di prima — anche quelle del
 * navigatore — non valgono piu', e si richiede la strada. */
function cambiaLAuto(cambio) {
  const b = state.bozza;
  if (!b) return;
  const car = lAutoDelViaggio(b);
  b.auto = { ...opzioniDellAuto(b, car ? datiDellAuto(car) : null), ...cambio };
  b.soste = null;
  state.opzioniAperte = true;
  disegna();
  void stimaLaStrada();
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
    auto: v.auto || null,
    soste: v.soste || null,
  });
  state.linea = [];
  state.tappeKm = [];
  state.archivio = null;
  state.opzioniAperte = false;
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
  /* Con un'auto che si ricarica il viaggio porta le sue scelte e le soste
   * calcolate: la casa le conta nell'ora di partenza. Senza, niente. */
  const car = lAutoDelViaggio(b);
  const viaggio = { ...b };
  delete viaggio.auto;
  delete viaggio.soste;
  if (car) {
    viaggio.auto = opzioniDellAuto(b, datiDellAuto(car));
    if (b.soste?.fonte === "casa" && Array.isArray(b.soste.elenco))
      viaggio.soste = { elenco: b.soste.elenco, arrivo: b.soste.arrivo };
  }
  try {
    const risposta = await chiedi("salva", { viaggio });
    state.scelto = risposta?.viaggio?.id || "";
    if (risposta?.viaggio) state.bozza.id = risposta.viaggio.id;
    await carica();
  } catch (errore) {
    const perche = clean(errore?.message);
    state.errore =
      perche === "premium-richiesto"
        ? t("Serve GdANav Premium.", "GdANav Premium is needed.")
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
    "#dm-gn [data-gn-nuovo], #dm-gn button[data-gn-apri], #dm-gn [data-gn-tipo], #dm-gn [data-gn-modo], #dm-gn [data-gn-giorno], #dm-gn [data-gn-proposta], #dm-gn [data-gn-togli-tappa], #dm-gn [data-gn-salva], #dm-gn [data-gn-elimina], #dm-gn [data-gn-partenza], #dm-gn [data-gn-collega]",
  );
  if (!bersaglio) return;
  const d = bersaglio.dataset;
  if (d.gnPartenza && state.bozza) {
    cambiaLAuto({ partenza: d.gnPartenza === "100" ? 100 : d.gnPartenza });
    return;
  }
  if ("gnCollega" in d) {
    /* La pagina Auto si configura nel Config, sulla scheda dei veicoli. */
    try {
      root.apriConfigEntita?.();
      root.setTimeout?.(() => {
        try {
          root.editorSwitch?.("sez2");
        } catch (_errore) {}
      }, 0);
    } catch (_errore) {}
    return;
  }
  if ("gnNuovo" in d) {
    state.bozza = bozzaNuova("una");
    state.scelto = "";
    state.linea = [];
    state.tappeKm = [];
    state.archivio = null;
    state.opzioniAperte = false;
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
      /* Un'altra strada, altre soste. */
      state.bozza.soste = null;
      state.tappeKm = [];
      state.proposte = [];
      state.cercando = "";
      state.linea = [];
      void stimaLaStrada();
    }
  } else if (d.gnTogliTappa && state.bozza) {
    state.bozza.tappe.splice(Number(d.gnTogliTappa), 1);
    state.bozza.stima = null;
    state.bozza.soste = null;
    state.tappeKm = [];
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
    case "autoUid":
      /* Un'altra auto: le sue scelte di serie, la sua batteria. */
      b.auto = { ...(b.auto || {}), uid: campo.value, partenza: null };
      b.auto = opzioniDellAuto(b, datiDellAuto(lAutoDelViaggio(b)));
      b.soste = null;
      disegna();
      void stimaLaStrada();
      return;
    case "minimaArrivo":
    case "kwColonnine":
      cambiaLAuto({ [campo.dataset.gnCampo]: Number(campo.value) });
      return;
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
.dm-gn-riga b{font-weight:800}
.dm-gn-auto{border:1px solid var(--gn-bordo);border-radius:18px;padding:14px;background:var(--gn-card)}
.dm-gn-auto-capo{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.dm-gn-auto-capo>.dm-gn-col{flex:1 1 0;min-width:0}
.dm-gn-auto-ic{width:44px;height:44px;border-radius:13px;display:grid;place-items:center;font-size:24px;background:#dcfce7;flex:none}
.dm-gn-auto-nome{font-weight:800;font-size:16px}
.dm-gn-auto-stato{font-size:12.5px;color:var(--gn-piano)}
.dm-gn-auto-scelta{flex:none;margin-left:auto;max-width:140px;font:inherit;font-size:13px;border:1px solid var(--gn-bordo);border-radius:10px;padding:6px 8px;background:var(--gn-card);color:inherit}
.dm-gn-barra{position:relative;height:10px;border-radius:99px;background:#e2e8f0;margin:16px 0 4px;overflow:visible}
.dm-gn-barra>i{position:absolute;top:0;bottom:0;border-radius:99px}
.dm-gn-barra-ora{left:0;background:linear-gradient(90deg,#16a34a,#22c55e)}
.dm-gn-barra-poi{background:repeating-linear-gradient(135deg,#bbf7d0 0 6px,#86efac 6px 12px);border-radius:0 99px 99px 0!important}
.dm-gn-barra-tacca{position:absolute;top:-4px;bottom:-4px;width:3px;margin-left:-1.5px;border-radius:2px;background:#15803d}
.dm-gn-barra-dida{display:flex;justify-content:space-between;font-size:11.5px;font-weight:700;color:var(--gn-piano)}
.dm-gn-numeri{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}
.dm-gn-num{background:var(--gn-fondo);border-radius:12px;padding:9px 10px;display:flex;flex-direction:column;min-width:0}
.dm-gn-num b{font-size:19px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dm-gn-num span{font-size:11.5px;font-weight:700;color:var(--gn-piano)}
.dm-gn-num.verde b{color:#15803d}
.dm-gn-esito{display:flex;gap:10px;align-items:center;margin-top:12px;padding:10px 14px;border-radius:14px;font-size:14px}
.dm-gn-esito b{font-weight:800}
.dm-gn-esito small{font-size:12px;font-weight:700}
.dm-gn-esito.giallo{background:#fef3c7;color:#92400e}
.dm-gn-esito.verde{background:#dcfce7;color:#166534}
.dm-gn-esito.grigio{background:var(--gn-fondo);color:var(--gn-piano)}
.dm-gn-scelte{border-top:1px solid var(--gn-bordo);margin-top:14px;padding-top:6px}
.dm-gn-scelta{display:flex;align-items:center;gap:10px;padding:7px 0}
.dm-gn-scelta select{font:inherit;font-size:13px;border:1px solid var(--gn-bordo);border-radius:10px;padding:6px;background:var(--gn-card);color:inherit}
.dm-gn-seg.mini{margin:0;padding:3px;border-radius:12px;flex:none}
.dm-gn-seg.mini button{padding:6px 10px;font-size:13px}
.dm-gn-invito{display:flex;align-items:center;gap:12px;border:1.5px dashed #cbd5e1;border-radius:18px;padding:14px;margin-top:14px;background:var(--gn-fondo)}
.dm-gn-invito-ic{font-size:26px;flex:none}
.dm-gn-invito small{font-size:11.5px;color:var(--gn-piano);margin-top:4px}
.dm-gn-collega{flex:none;border:1px solid #93c5fd;color:#1d4ed8;background:var(--gn-card);border-radius:12px;padding:8px 14px;font-weight:800;cursor:pointer;font-family:inherit}
.dm-gn-soste{border:1px solid var(--gn-bordo);border-radius:18px;padding:14px;margin:4px 0 8px}
.dm-gn-soste-capo{display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.dm-gn-soste-capo b{font-size:16px;font-weight:800}
.dm-gn-soste-capo small{font-size:12.5px;font-weight:700;color:var(--gn-piano)}
.dm-gn-soste ol{list-style:none;margin:0;padding:0}
.dm-gn-fila{position:relative;display:flex;gap:12px;align-items:flex-start;padding:9px 8px;border-radius:12px}
.dm-gn-fila:not(:last-child)::before{content:"";position:absolute;left:21px;top:34px;bottom:-10px;width:3px;background:#cbd5e1;border-radius:2px}
.dm-gn-fila.sosta{background:#fffbeb;margin:4px 0}
.dm-gn-fila>.dm-gn-col b{font-weight:800;font-size:14.5px}
.dm-gn-fila>.dm-gn-col small{font-size:12.5px;color:var(--gn-piano)}
.dm-gn-pallino{position:relative;z-index:1;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;flex:none;font-size:13px;font-weight:800;color:#fff;border:3px solid var(--gn-card)}
.dm-gn-pallino.verde{background:#16a34a;font-size:9px}.dm-gn-pallino.viola{background:#6d28d9}.dm-gn-pallino.arancio{background:#f59e0b}.dm-gn-pallino.rosso{background:#dc2626;font-size:12px}
.dm-gn-fila-ora{display:flex;flex-direction:column;align-items:flex-end;text-align:right;flex:none}
.dm-gn-fila-ora b{font-weight:800;font-size:14.5px}
.dm-gn-fila-ora small{font-size:12px;font-weight:700;color:var(--gn-piano)}
.dm-gn-batt{align-self:flex-start;white-space:nowrap;display:inline-flex;margin-top:4px;padding:2px 8px;border-radius:99px;background:#dcfce7;color:#166534;font-size:12px;font-weight:800}
.dm-gn-batt.gialla{background:#fef3c7;color:#92400e}
.dm-gn-fonti{font-size:11.5px;color:var(--gn-piano);margin-top:8px;line-height:1.45}
body.dark-mode .dm-gn-fila.sosta,html.dark .dm-gn-fila.sosta{background:#422006}
body.dark-mode .dm-gn-auto-ic,html.dark .dm-gn-auto-ic{background:#14532d}
@media (max-width:980px){.dm-gn-griglia,.dm-gn-dett{grid-template-columns:1fr}}
@media (max-width:560px){.dm-gn-auto-scelta{order:3;flex:1 1 100%;max-width:none;margin-left:0}.dm-gn-scelta{flex-wrap:wrap}}
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
