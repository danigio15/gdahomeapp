/* La disposizione delle sezioni, sulla plancia (#379).
 *
 * «Il discorso drag & drop deve essere ovunque, non solo nei widget.» Ogni
 * pagina della plancia ha un tasto ✏️ «Modifica disposizione» (per chi puo'
 * configurare): premuto, i riquadri della pagina e gli elementi dei suoi
 * elenchi — le luci di una stanza, le telecamere, le zone — si trascinano li'
 * dove sono, col mouse o tenendo premuto col dito; l'occhio li nasconde,
 * «↔» li fa larghi. In basso una barra: «N modifiche · Annulla · Ripristina ·
 * Salva». «Salva» scrive `cd_disposizione` (vedi `core/disposizione.js`), che
 * viaggia col ponte: la pagina e' cosi' su ogni dispositivo.
 *
 * Le pagine non sanno niente di tutto questo, e non devono: la disposizione
 * si applica DOPO che hanno disegnato, a ogni ridisegno, e senza scelta
 * salvata non si tocca niente — la pagina resta com'e' sempre stata.
 *
 * Come si trovano le cose da spostare, senza che ogni pagina le dichiari:
 *   - i RIQUADRI: sotto la testata della pagina, si scende finche' c'e' un
 *     solo figlio (l'involucro, la «shell»); il primo livello con due o piu'
 *     figli visibili sono i riquadri. Un titolo (h2/h3, `.section-title`) va
 *     insieme a quello che lo segue.
 *   - gli ELENCHI: dentro un riquadro, un contenitore con due o piu' figli
 *     dello stesso tipo, alti abbastanza da essere carte (non i pallini di un
 *     grafico o i tasti di una barra).
 * Una pagina che vuole decidere da se' scrive `data-dm-blocco="id"` su un
 * riquadro o `data-dm-disposizione` su un contenitore: vince quello.
 *
 * Gli id delle voci sono quelli di `idDellaVoce`: l'entita' di Home Assistant
 * quando c'e' (la stessa luce resta la stessa luce), se no l'id, un nome, il
 * titolo scritto.
 */
import {
  CHIAVE_DISPOSIZIONE,
  conLaScelta,
  disposizioneDelleVoci,
  disposizionePulita,
  idDellaVoce,
  idUnici,
} from "../core/disposizione.js";
import { puoConfigurare } from "./la-config-e-di-chi-la-amministra-section.js";
import { STILE_RIORDINA } from "./trascina-per-riordinare.js";
import { doc, esc, installStyle, readJson, root, senzaCadere, t, writeJsonIfChanged } from "./shared.js";

const KEY = "__DASHBOARDMODERN_DISPOSIZIONE__";
const state = (root[KEY] ||= {
  installed: false,
  osservatore: null,
  coda: 0,
  modifica: null,
  occupato: false,
});

/* Le pagine che hanno gia' il loro modo di riordinarsi, o che non sono
 * pagine da guardare: la Home ha le sue caselle (tessere, blocchi, stanze),
 * il Config e' il Config. */
const PAGINE_DA_SALTARE = new Set(["home", "config"]);

const TITOLO = "h1,h2,h3,h4,.section-title,.dm-sec-title";
const DATI_CHE_NOMINANO = /(^|-)(id|uid|key|entity|entita|room|stanza|zona|zone|nome|name|ref|cam|slug|chiave)$/i;
const NOSTRI = "[data-dm-disp-barra],[data-dm-disp-ctrl],[data-dm-disp-tasto]";

/* ── leggere e scrivere ─────────────────────────────────────────────────── */

function salvata() {
  return disposizionePulita(readJson(CHIAVE_DISPOSIZIONE, {}));
}

function nomeDellaPagina(pagina) {
  return String(pagina?.id || "").replace(/^page-/, "");
}

/* ── trovare le voci ────────────────────────────────────────────────────── */

function visibile(el) {
  if (!el || el.nodeType !== 1) return false;
  if (el.matches?.(`${NOSTRI},script,style,template,link,.dm-riordina-voce`)) return false;
  if (el.hasAttribute?.("data-dm-nascosto")) return true; /* nascosto da noi: c'e' */
  if (el.hidden) return false;
  const stile = root.getComputedStyle?.(el);
  if (!stile || stile.display === "none" || stile.visibility === "hidden") return false;
  if (stile.position === "fixed" || stile.position === "absolute") return false;
  const r = el.getBoundingClientRect?.();
  return Boolean(r && r.width > 0 && r.height > 0);
}

/* La testata di una pagina, o di un suo involucro («dm-cl-mast»): sta in cima
 * e non si sposta. */
const TESTATA = /(^|[-_\s])(page-)?mast($|[-_\s])|back-home-btn|sub-tabs/;
function eTestata(el) {
  return TESTATA.test(typeof el?.className === "string" ? el.className : "");
}

function eTitolo(el) {
  return Boolean(el?.matches?.(TITOLO));
}

/* Il titolo scritto di una voce: un'intestazione o un «titolo», mai un
 * valore — «67 %» cambia da un minuto all'altro, «Ricarica» no. */
function titoloDi(el) {
  const testa = el.matches?.(TITOLO)
    ? el
    : el.querySelector?.(`${TITOLO},[class*='title'],[class*='titolo'],[class*='name'],[class*='nome'],summary`);
  const testo = String(testa?.textContent || "")
    .replace(/\s+/g, " ")
    .trim();
  return /[a-zà-ü]{3,}/i.test(testo) ? testo.replace(/[\d.,:%°]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 48) : "";
}

function idDellElemento(el, titolo = "") {
  const attributi = [...(el.attributes || [])]
    .filter((a) => !/^(style|class|aria-|data-dm-)/.test(a.name))
    .map((a) => `${a.name}=${a.value}`)
    .join(" ");
  const dati = [...(el.attributes || [])]
    .filter((a) => /^data-/.test(a.name) && DATI_CHE_NOMINANO.test(a.name.slice(5)) && !/^data-dm-disp/.test(a.name))
    .map((a) => a.value);
  return idDellaVoce({
    dichiarato: el.getAttribute?.("data-dm-blocco") || "",
    id: el.id || "",
    attributi,
    dati,
    titolo: titolo || titoloDi(el),
    classi: typeof el.className === "string" ? el.className : "",
  });
}

/* Le voci di un contenitore: i figli visibili, coi titoli attaccati a quello
 * che segue. Ogni voce e' `{ id, nome, el, insieme }`: `el` e' quella che si
 * prende in mano, `insieme` tutto quello che si sposta con lei. */
function vociDi(contenitore) {
  const figli = [...contenitore.children].filter((el) => visibile(el) && !eTestata(el) && !el.matches("nav"));
  const voci = [];
  for (let i = 0; i < figli.length; i += 1) {
    const el = figli[i];
    if (eTitolo(el) && figli[i + 1] && !eTitolo(figli[i + 1])) {
      const dopo = figli[i + 1];
      const nome = titoloDi(el);
      voci.push({ id: idDellElemento(dopo, nome), nome, el: dopo, insieme: [el, dopo] });
      i += 1;
      continue;
    }
    voci.push({ id: idDellElemento(el), nome: titoloDi(el), el, insieme: [el] });
  }
  const unici = idUnici(voci.map((v) => v.id));
  voci.forEach((voce, i) => {
    voce.id = unici[i];
    if (!voce.nome) voce.nome = t("Riquadro", "Box");
  });
  return voci;
}

function testataDi(pagina) {
  return pagina.querySelector?.(":scope > .dm-page-mast");
}

/* Il contenitore dei riquadri: sotto la testata, giu' per gli involucri.
 * Se lungo la discesa si passa per una «vista» — un figlio scelto fra
 * fratelli che adesso non si vedono, come le linguette dell'Energia — la
 * vista entra nel nome: ogni vista ha la sua disposizione. */
function contenitoreDeiRiquadri(pagina) {
  const nome = nomeDellaPagina(pagina);
  const dichiarato = pagina.querySelector?.(`[data-dm-disposizione="${nome}"]`);
  if (dichiarato) return { contenitore: dichiarato, chiave: nome };
  let qui = pagina;
  let vista = "";
  for (let giro = 0; giro < 6; giro += 1) {
    const tutti = [...qui.children].filter((el) => !eTestata(el) && !el.matches("nav,script,style,template"));
    const figli = tutti.filter(visibile);
    /* Un figlio che fa quasi tutta la pagina, accanto a strisce sottili (la
     * scelta dell'auto sopra la sua scheda): i riquadri sono dentro di lui. */
    const altezze = figli.map((el) => el.getBoundingClientRect().height);
    const grande = altezze.indexOf(Math.max(...altezze, 0));
    const resto = altezze.reduce((a, h, i) => (i === grande ? a : a + h), 0);
    const selettore = (el) =>
      Boolean(el.querySelector?.("select,nav,[role=tablist]")) || /picker|selettore|tabs/i.test(String(el.className || el.id));
    const dominante =
      figli.length >= 2 &&
      altezze[grande] > 2 * resto &&
      figli.every((el, i) => i === grande || (altezze[i] < 120 && selettore(el)));
    if (figli.length >= 2 && !dominante) return { contenitore: qui, chiave: vista ? `${nome}@${vista}` : nome };
    if (!figli.length) return null;
    const giu = dominante ? figli[grande] : figli[0];
    if (tutti.length > 1 && giu.id && !dominante) vista = giu.id;
    qui = giu;
  }
  return null;
}

/* Un contenitore e' un elenco se ha almeno due figli dello stesso tipo, e
 * sono carte: alti abbastanza da toccarli, non pallini o tasti. */
function eUnElenco(el) {
  if (!el || el.matches?.("svg,canvas,select,ul.sub-tabs,[role=tablist],nav,form")) return false;
  const figli = [...el.children].filter(visibile);
  if (figli.length < 2) return false;
  const tipi = new Map();
  for (const figlio of figli) {
    if (/^(BUTTON|SPAN|I|B|SVG|INPUT|LABEL|A|IMG)$/.test(figlio.tagName)) return false;
    const r = figlio.getBoundingClientRect();
    if (!figlio.hasAttribute("data-dm-nascosto") && (r.height < 36 || r.width < 60)) return false;
    const cosa = String(figlio.className || "").split(/\s+/)[0] || figlio.tagName;
    tipi.set(cosa, (tipi.get(cosa) || 0) + 1);
  }
  const piuComune = Math.max(...tipi.values());
  return piuComune >= 2 && piuComune / figli.length >= 0.75;
}

function elenchiDentro(riquadro, prefisso, fuori, profondita = 0) {
  if (profondita > 5) return;
  for (const figlio of riquadro.children) {
    if (!visibile(figlio) || figlio.matches(NOSTRI)) continue;
    if (eUnElenco(figlio) || figlio.hasAttribute("data-dm-disposizione")) {
      const quale = figlio.getAttribute("data-dm-disposizione") || idDellElemento(figlio, "") || "elenco";
      fuori.push({ chiave: `${prefisso}>${quale}`, contenitore: figlio, riquadri: false });
      continue; /* dentro una carta non si cercano altri elenchi */
    }
    elenchiDentro(figlio, prefisso, fuori, profondita + 1);
  }
}

/** Tutto quello che si riordina in una pagina: i riquadri e gli elenchi. */
export function elenchiDellaPagina(pagina) {
  const nome = nomeDellaPagina(pagina);
  if (!nome || PAGINE_DA_SALTARE.has(nome)) return [];
  const fuori = [];
  const trovato = contenitoreDeiRiquadri(pagina);
  if (!trovato) return fuori;
  const { contenitore, chiave } = trovato;
  fuori.push({ chiave, contenitore, riquadri: true });
  for (const voce of vociDi(contenitore)) elenchiDentro(voce.el, `${chiave}:${voce.id}`, fuori);
  /* Due elenchi con la stessa chiave nello stesso riquadro si distinguono. */
  const unici = idUnici(fuori.map((e) => e.chiave));
  fuori.forEach((e, i) => (e.chiave = unici[i]));
  return fuori;
}

/* ── applicare ──────────────────────────────────────────────────────────── */

/* Nascosto davvero: con lo stile scritto addosso, che vince anche sulle
 * regole delle pagine che dicono `display:…!important`. In modifica si vede,
 * sbiadito, per poterlo riaccendere. */
function nascondi(el, si) {
  if (si) {
    el.setAttribute("data-dm-nascosto", "");
    if (state.modifica) el.style.removeProperty("display");
    else el.style.setProperty("display", "none", "important");
  } else if (el.hasAttribute("data-dm-nascosto")) {
    el.removeAttribute("data-dm-nascosto");
    el.style.removeProperty("display");
  }
}

function applicaAlContenitore(elenco, scelta) {
  const { contenitore } = elenco;
  const voci = vociDi(contenitore);
  if (voci.length < 2) return;
  const perId = new Map(voci.map((v) => [v.id, v]));
  /* L'ordine di serie: quello in cui la pagina le ha messe l'ultima volta che
   * le ha disegnate. Se l'insieme e' cambiato, ha ridisegnato: si rilegge. */
  const firma = voci
    .map((v) => v.id)
    .sort()
    .join("|");
  if (contenitore.__dmDispFirma !== firma) {
    contenitore.__dmDispFirma = firma;
    contenitore.__dmDispSerie = voci.map((v) => v.id);
  }
  const serie = contenitore.__dmDispSerie.filter((id) => perId.has(id));
  const disposte = disposizioneDelleVoci(serie, scelta);
  const attuale = voci.map((v) => v.id);
  const voluto = disposte.map((d) => d.id);
  if (attuale.join("|") !== voluto.join("|")) {
    /* In fondo, nell'ordine voluto: chi non e' una voce (un figlio nascosto
     * dalla pagina) resta davanti, dov'era. */
    for (const id of voluto) for (const el of perId.get(id).insieme) contenitore.appendChild(el);
  }
  for (const d of disposte) {
    const voce = perId.get(d.id);
    for (const el of voce.insieme) nascondi(el, d.nascosto);
    if (d.misura === "larga") voce.el.setAttribute("data-dm-misura", "larga");
    else voce.el.removeAttribute("data-dm-misura");
  }
}

function paginaAttiva() {
  return doc?.querySelector?.("section.page.active[id^='page-'], .page.active[id^='page-']") || null;
}

/** La disposizione salvata (o la bozza, in modifica) messa sulla pagina che
 * si guarda. */
export function applicaLaDisposizione(pagina = paginaAttiva()) {
  if (!pagina || state.occupato) return;
  /* Mentre una voce e' in mano non si rimette in fila niente. */
  if (doc.documentElement.hasAttribute("data-dm-trascinando")) return inCoda();
  const tutta = salvata();
  const nome = nomeDellaPagina(pagina);
  const inModifica = state.modifica?.pagina === pagina;
  const ce = inModifica || Object.keys(tutta).some((k) => k === nome || k.startsWith(`${nome}:`));
  if (!ce) return;
  state.occupato = true;
  try {
    for (const elenco of elenchiDellaPagina(pagina)) {
      const scelta = inModifica && state.modifica.bozze.has(elenco.chiave)
        ? state.modifica.bozze.get(elenco.chiave)
        : tutta[elenco.chiave];
      if (scelta || inModifica) applicaAlContenitore(elenco, scelta || {});
    }
    if (inModifica) segnaPerLaModifica(pagina);
  } finally {
    state.osservatore?.takeRecords?.();
    state.occupato = false;
  }
}

/* Si guardano le pagine, una per una, non tutto il documento: e' li' che le
 * sezioni ridisegnano, ed e' la loro classe a dire quale si vede. Una pagina
 * nata dopo (le pagine che si aggiungono da sole) si prende al giro dopo. */
function osservaLePagine() {
  if (!state.osservatore) return;
  state.osservate ||= new WeakSet();
  for (const pagina of doc.querySelectorAll("section.page[id^='page-']")) {
    if (state.osservate.has(pagina)) continue;
    state.osservate.add(pagina);
    state.osservatore.observe(pagina, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  }
}

function inCoda() {
  if (state.coda) return;
  state.coda = root.setTimeout?.(() => {
    state.coda = 0;
    osservaLePagine();
    applicaLaDisposizione();
    mettiITasti();
  }, 60);
}

/* ── la modalita' modifica ──────────────────────────────────────────────── */

function conta() {
  return state.modifica ? state.modifica.cambiate.size : 0;
}

function sceltaInMano(elenco) {
  const m = state.modifica;
  if (m.bozze.has(elenco.chiave)) return m.bozze.get(elenco.chiave);
  const s = salvata()[elenco.chiave];
  return s ? { ordine: [...s.ordine], nascosti: [...s.nascosti], misure: { ...s.misure } } : { ordine: [], nascosti: [], misure: {} };
}

function controlliMarkup(voce, elenco, scelta) {
  const nascosto = scelta.nascosti.includes(voce.id);
  const larga = scelta.misure[voce.id] === "larga";
  const griglia = root.getComputedStyle?.(elenco.contenitore)?.display?.includes("grid");
  const nome = esc(voce.nome);
  return `${elenco.riquadri ? `<button type="button" class="dm-disp-maniglia" data-dm-maniglia data-dm-tieni aria-label="${esc(
    t(`Sposta ${voce.nome}`, `Move ${voce.nome}`),
  )}">⠿ <span>${nome}</span></button>` : ""}
    <button type="button" class="dm-disp-occhio" data-dm-non-trascinare data-dm-disp-occhio
      aria-pressed="${!nascosto}" aria-label="${esc(nascosto ? t(`Mostra ${voce.nome}`, `Show ${voce.nome}`) : t(`Nascondi ${voce.nome}`, `Hide ${voce.nome}`))}">${nascosto ? "🙈" : "👁"}</button>${
      griglia && elenco.riquadri
        ? `<button type="button" class="dm-disp-larga" data-dm-non-trascinare data-dm-disp-larga aria-pressed="${larga}"
      aria-label="${esc(t(`Larghezza piena: ${voce.nome}`, `Full width: ${voce.nome}`))}">↔</button>`
        : ""
    }`;
}

function segnaPerLaModifica(pagina) {
  for (const vecchio of pagina.querySelectorAll("[data-dm-disp-ctrl]")) vecchio.remove();
  for (const el of pagina.querySelectorAll("[data-dm-disp-elenco]")) {
    el.removeAttribute("data-dm-disp-elenco");
    el.removeAttribute("data-dm-riordina");
  }
  for (const el of pagina.querySelectorAll("[data-dm-disp-voce]")) {
    for (const nome of ["data-dm-disp-voce", "data-dm-riordina-riga", "data-dm-maniglia", "data-dm-tieni"])
      el.removeAttribute(nome);
  }
  for (const elenco of elenchiDellaPagina(pagina)) {
    const voci = vociDi(elenco.contenitore);
    if (voci.length < 2) continue;
    const scelta = sceltaInMano(elenco);
    elenco.contenitore.setAttribute("data-dm-disp-elenco", elenco.chiave);
    elenco.contenitore.setAttribute("data-dm-riordina", "griglia");
    for (const voce of voci) {
      voce.el.setAttribute("data-dm-disp-voce", voce.id);
      voce.el.setAttribute("data-dm-riordina-riga", voce.id);
      if (!elenco.riquadri) {
        voce.el.setAttribute("data-dm-maniglia", "");
        voce.el.setAttribute("data-dm-tieni", "");
      }
      const ctrl = doc.createElement("div");
      ctrl.setAttribute("data-dm-disp-ctrl", elenco.riquadri ? "riquadro" : "voce");
      ctrl.innerHTML = controlliMarkup(voce, elenco, scelta);
      voce.el.prepend(ctrl);
    }
  }
}

function barraMarkup() {
  const n = conta();
  return `<div class="dm-disp-barra-dentro">
    <span class="dm-disp-conta">${esc(
      n === 0
        ? t("Trascina riquadri ed elementi dove li vuoi", "Drag boxes and items where you want them")
        : n === 1
          ? t("1 modifica", "1 change")
          : t(`${n} modifiche`, `${n} changes`),
    )}</span>
    <button type="button" data-dm-disp-azione="annulla">${esc(t("Annulla", "Cancel"))}</button>
    <button type="button" data-dm-disp-azione="ripristina">${esc(t("Ripristina", "Reset"))}</button>
    <button type="button" class="dm-disp-salva" data-dm-disp-azione="salva"${n === 0 ? " disabled" : ""}>${esc(
      t("Salva", "Save"),
    )}</button>
  </div>`;
}

function disegnaLaBarra() {
  let barra = doc.querySelector("[data-dm-disp-barra]");
  if (!state.modifica) {
    barra?.remove();
    return;
  }
  if (!barra) {
    barra = doc.createElement("div");
    barra.setAttribute("data-dm-disp-barra", "");
    barra.setAttribute("role", "toolbar");
    barra.setAttribute("aria-label", t("Modifica disposizione", "Edit layout"));
    doc.body.appendChild(barra);
  }
  barra.innerHTML = barraMarkup();
}

export function entraInModifica(pagina = paginaAttiva()) {
  if (!pagina || !puoConfigurare()) return;
  esciDallaModifica();
  state.modifica = { pagina, bozze: new Map(), cambiate: new Set() };
  doc.documentElement.setAttribute("data-dm-modifica", nomeDellaPagina(pagina));
  applicaLaDisposizione(pagina);
  disegnaLaBarra();
}

export function esciDallaModifica() {
  const m = state.modifica;
  if (!m) return;
  state.modifica = null;
  doc.documentElement.removeAttribute("data-dm-modifica");
  state.occupato = true;
  try {
    for (const vecchio of m.pagina.querySelectorAll("[data-dm-disp-ctrl]")) vecchio.remove();
    for (const el of m.pagina.querySelectorAll("[data-dm-disp-elenco]")) {
      el.removeAttribute("data-dm-disp-elenco");
      el.removeAttribute("data-dm-riordina");
    }
    for (const el of m.pagina.querySelectorAll("[data-dm-disp-voce]"))
      for (const nome of ["data-dm-disp-voce", "data-dm-riordina-riga", "data-dm-maniglia", "data-dm-tieni"])
        el.removeAttribute(nome);
  } finally {
    state.osservatore?.takeRecords?.();
    state.occupato = false;
  }
  disegnaLaBarra();
}

function elencoDi(contenitore) {
  const chiave = contenitore?.getAttribute?.("data-dm-disp-elenco");
  if (!chiave || !state.modifica) return null;
  return elenchiDellaPagina(state.modifica.pagina).find((e) => e.chiave === chiave) || null;
}

function cambiaLaBozza(elenco, muta) {
  const m = state.modifica;
  const scelta = sceltaInMano(elenco);
  const voci = vociDi(elenco.contenitore);
  scelta.ordine = voci.map((v) => v.id);
  muta(scelta, voci);
  m.bozze.set(elenco.chiave, scelta);
  m.cambiate.add(elenco.chiave);
  applicaLaDisposizione(m.pagina);
  disegnaLaBarra();
}

function onRiordina(event) {
  const elenco = elencoDi(event.target);
  if (!elenco) return;
  const { da, a } = event.detail || {};
  cambiaLaBozza(elenco, (scelta) => {
    const [presa] = scelta.ordine.splice(da, 1);
    if (presa) scelta.ordine.splice(Math.max(0, Math.min(a, scelta.ordine.length)), 0, presa);
  });
}

function salva() {
  const m = state.modifica;
  if (!m) return;
  let tutta = salvata();
  for (const elenco of elenchiDellaPagina(m.pagina)) {
    if (!m.bozze.has(elenco.chiave)) continue;
    const serie = elenco.contenitore.__dmDispSerie || vociDi(elenco.contenitore).map((v) => v.id);
    tutta = conLaScelta(tutta, elenco.chiave, m.bozze.get(elenco.chiave), serie);
  }
  writeJsonIfChanged(CHIAVE_DISPOSIZIONE, tutta);
  esciDallaModifica();
  applicaLaDisposizione();
}

function annulla() {
  const m = state.modifica;
  if (!m) return;
  esciDallaModifica();
  /* La pagina torna come la vuole la scelta salvata: chi era stato spostato
   * nella bozza torna al suo posto. */
  for (const elenco of elenchiDellaPagina(m.pagina)) applicaAlContenitore(elenco, salvata()[elenco.chiave] || {});
}

function ripristina() {
  const m = state.modifica;
  if (!m) return;
  for (const elenco of elenchiDellaPagina(m.pagina)) {
    m.bozze.set(elenco.chiave, { ordine: [...(elenco.contenitore.__dmDispSerie || [])], nascosti: [], misure: {} });
    m.cambiate.add(elenco.chiave);
  }
  applicaLaDisposizione(m.pagina);
  disegnaLaBarra();
}

function onClick(event) {
  const bersaglio = event.target;
  /* Un tocco qualunque puo' aver cambiato pagina: si riguarda. */
  if (!state.modifica) inCoda();
  const tasto = bersaglio?.closest?.("[data-dm-disp-tasto]");
  if (tasto) {
    event.preventDefault();
    event.stopPropagation();
    if (state.modifica) esciDallaModifica();
    else entraInModifica(tasto.closest(".page"));
    return;
  }
  const azione = bersaglio?.closest?.("[data-dm-disp-azione]")?.getAttribute("data-dm-disp-azione");
  if (azione === "salva") return salva();
  if (azione === "annulla") return annulla();
  if (azione === "ripristina") return ripristina();
  if (!state.modifica) return;
  const pagina = state.modifica.pagina;
  if (!pagina.contains(bersaglio)) return;
  /* In modifica la pagina non si comanda: un tocco su una luce non la
   * accende. Passano solo i nostri tasti. */
  const occhio = bersaglio.closest("[data-dm-disp-occhio]");
  const larga = bersaglio.closest("[data-dm-disp-larga]");
  event.preventDefault();
  event.stopPropagation();
  if (!occhio && !larga) return;
  const voceEl = bersaglio.closest("[data-dm-disp-voce]");
  const elenco = elencoDi(voceEl?.parentElement);
  if (!voceEl || !elenco) return;
  const id = voceEl.getAttribute("data-dm-disp-voce");
  cambiaLaBozza(elenco, (scelta) => {
    if (occhio) {
      const i = scelta.nascosti.indexOf(id);
      if (i >= 0) scelta.nascosti.splice(i, 1);
      else scelta.nascosti.push(id);
    } else if (scelta.misure[id] === "larga") delete scelta.misure[id];
    else scelta.misure[id] = "larga";
  });
}

function onKeyDown(event) {
  if (event.key === "Escape" && state.modifica && !doc.documentElement.hasAttribute("data-dm-trascinando")) annulla();
}

/* ── il tasto ✏️ in testa alle pagine ───────────────────────────────────── */

function testataPerIlTasto(pagina) {
  return (
    pagina.querySelector(":scope > .dm-page-mast") ||
    [...pagina.querySelectorAll("[class*='mast']")].find((el) => eTestata(el) && visibile(el)) ||
    null
  );
}

function mettiITasti() {
  const si = puoConfigurare();
  for (const pagina of doc.querySelectorAll("section.page[id^='page-']")) {
    const testata = testataPerIlTasto(pagina);
    if (!testata) continue;
    const nome = nomeDellaPagina(pagina);
    const ce = testata.querySelector(":scope > [data-dm-disp-tasto]");
    if (!si || PAGINE_DA_SALTARE.has(nome)) {
      ce?.remove();
      continue;
    }
    if (ce) continue;
    const tasto = doc.createElement("button");
    tasto.type = "button";
    tasto.setAttribute("data-dm-disp-tasto", "");
    tasto.className = "dm-disp-tasto";
    tasto.title = t("Modifica disposizione", "Edit layout");
    tasto.setAttribute("aria-label", t("Modifica disposizione", "Edit layout"));
    tasto.textContent = "✏️";
    testata.appendChild(tasto);
  }
  /* Si cambia pagina con la modifica aperta: la modifica si chiude, senza
   * salvare — quello che non si e' salvato non si e' voluto. */
  if (state.modifica && !state.modifica.pagina.classList.contains("active")) annulla();
}

/* ── installare ─────────────────────────────────────────────────────────── */

const STILE = `
${STILE_RIORDINA}
[data-dm-nascosto]{display:none!important}
html[data-dm-modifica] [data-dm-nascosto]{display:revert!important;opacity:.38;filter:grayscale(.6)}
[data-dm-misura="larga"]{grid-column:1/-1!important}
.dm-page-mast{position:relative}
.dm-disp-tasto{position:absolute;top:12px;right:12px;z-index:3;width:40px;height:40px;border-radius:14px;
  border:1px solid color-mix(in srgb,var(--text,#0f172a) 12%,transparent);background:var(--card-bg,#fff);
  font-size:18px;line-height:1;cursor:pointer;box-shadow:0 6px 16px -10px rgba(15,23,42,.4)}
html[data-dm-modifica] .dm-disp-tasto{background:var(--accent,#2563eb);color:#fff}
html[data-dm-modifica] [data-dm-disp-voce]{position:relative;outline:2px dashed color-mix(in srgb,var(--accent,#2563eb) 55%,transparent);
  outline-offset:2px;border-radius:16px}
html[data-dm-modifica] [data-dm-disp-elenco]>[data-dm-disp-voce]{cursor:grab}
[data-dm-disp-ctrl]{position:absolute;top:6px;right:6px;z-index:6;display:flex;gap:6px;align-items:center}
[data-dm-disp-ctrl="riquadro"]{left:6px;justify-content:space-between}
[data-dm-disp-ctrl] button{height:36px;min-width:36px;border-radius:12px;border:1px solid color-mix(in srgb,var(--text,#0f172a) 14%,transparent);
  background:var(--card-bg,#fff);color:var(--text,#0f172a);font:600 13px/1 inherit;cursor:pointer;
  box-shadow:0 4px 12px -8px rgba(15,23,42,.5);display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:0 10px}
[data-dm-disp-ctrl] .dm-disp-maniglia{margin-right:auto;cursor:grab;touch-action:none;max-width:70%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
[data-dm-disp-ctrl] .dm-disp-maniglia span{overflow:hidden;text-overflow:ellipsis}
[data-dm-disp-ctrl] button[aria-pressed="true"].dm-disp-larga{background:var(--accent,#2563eb);color:#fff}
[data-dm-disp-barra]{position:fixed;left:50%;bottom:calc(16px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:9990;
  max-width:calc(100vw - 24px)}
.dm-disp-barra-dentro{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center;padding:10px 12px;border-radius:20px;
  background:var(--card-bg,#fff);color:var(--text,#0f172a);box-shadow:0 18px 40px -16px rgba(15,23,42,.55);
  border:1px solid color-mix(in srgb,var(--text,#0f172a) 12%,transparent)}
.dm-disp-barra-dentro .dm-disp-conta{font:600 14px/1.2 inherit;padding:0 6px}
.dm-disp-barra-dentro button{min-height:44px;padding:0 16px;border-radius:14px;border:1px solid color-mix(in srgb,var(--text,#0f172a) 14%,transparent);
  background:transparent;color:inherit;font:600 14px/1 inherit;cursor:pointer}
.dm-disp-barra-dentro .dm-disp-salva{background:var(--accent,#2563eb);border-color:transparent;color:#fff}
.dm-disp-barra-dentro .dm-disp-salva[disabled]{opacity:.45;cursor:default}
`;

export function installDisposizione() {
  if (!doc?.body || state.installed) return;
  state.installed = true;
  installStyle("dm-disposizione-style", STILE);
  doc.addEventListener("click", onClick, true);
  doc.addEventListener("keydown", onKeyDown);
  doc.addEventListener("dm-riordina", onRiordina);
  if (root.MutationObserver) {
    state.osservatore = new root.MutationObserver(() => {
      if (!state.occupato) inCoda();
    });
    osservaLePagine();
  }
  root.addEventListener?.("storage", inCoda);
  root.addEventListener?.("dashboardmodern:config-synced", inCoda);
  inCoda();
}

/* Per le prove e per chi vuole guardare da fuori. */
root.dmDisposizione = {
  entraInModifica: () => entraInModifica(),
  esciDallaModifica,
  applicaLaDisposizione: () => applicaLaDisposizione(),
  elenchi: () => elenchiDellaPagina(paginaAttiva()).map((e) => ({ chiave: e.chiave, voci: vociDi(e.contenitore).map((v) => v.id) })),
};

senzaCadere(installDisposizione);
