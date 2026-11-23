/* Le feste sulla plancia: la ghirlanda, la neve, il conto alla rovescia, le
 * luci di Natale e gli auguri.
 *
 * E' una sorpresa. Nessun interruttore, nessuna data scritta da qualche parte:
 * l'8 dicembre la plancia si sveglia vestita a festa su tutti i dispositivi, e
 * dopo l'Epifania torna com'era senza lasciare traccia. Quando, lo decide
 * `core/feste.js` (`inFesta`); qui si guarda l'orologio una volta al minuto,
 * si mette o si toglie, e si disegna.
 *
 * Quattro cose solo dentro le feste, e una tutto l'anno:
 *
 *  - la GHIRLANDA dorata lungo il bordo alto della testata, con le lampadine
 *    calde a bokeh: una tela ferma, ridisegnata solo quando la testata cambia
 *    larghezza o tema;
 *  - la NEVE leggera su tutta la pagina: una tela sola, pochi fiocchi
 *    azzurrini col loro filo d'ombra (sul tema chiaro un fiocco bianco non si
 *    vedrebbe), trenta fotogrammi al massimo;
 *  - il CONTO ALLA ROVESCIA nella testata, dal 26 dicembre alla mezzanotte
 *    del 31: una pillola scura con «AL 2027 · 4g 05:17» in oro;
 *  - il riquadro LUCI DI NATALE in Home, sotto la barra dei conteggi, solo se
 *    in configurazione ci sono delle luci: una scena d'inverno dove ogni luce
 *    e' la cosa vera (l'albero, il presepe, la casa con le lucine fuori: la
 *    disegna `la-scena-delle-luci.js`, col cielo dell'ora del giorno), e
 *    accanto quante sono accese, quando si spengono, un interruttore per luce
 *    e «Spegni tutte». Questo NON aspetta le feste: l'albero si monta prima,
 *    e il riquadro c'e' tutto l'anno finche' non lo si spegne dalla scheda
 *    «Luci di Natale» (`riquadro`);
 *  - il primo gennaio, nello stesso posto, gli AUGURI.
 *
 * ── Non deve rallentare la plancia ────────────────────────────────────────
 *
 * Le plance a muro sono spesso tablet da cento euro. Per questo: un solo giro
 * di fotogrammi (quello della neve), fermo quando la pagina non si vede e
 * quando il pannello a muro la copre; densita' dei pixel tenuta a due;
 * fiocchi gia' disegnati una volta e solo copiati. Chi ha chiesto meno
 * movimento (`prefers-reduced-motion`) ha la decorazione ferma: la neve c'e',
 * un fotogramma solo, e non cade.
 *
 * I comandi delle luci passano da `chiamaServizio`, come ogni altro tasto
 * della plancia: e' lo stesso filo, con lo stesso riguardo per i rifiuti.
 */
import {
  CHIAVE_FESTE,
  annoNuovo,
  contoAllaRovescia,
  eCapodanno,
  entitaDelleLuci,
  festePulite,
  inFesta,
  intervalloDelGiorno,
  oraDi,
  tipoDellaLuce,
} from "../core/feste.js";
import {
  chiamateDelTocco,
  cieloDellaScena,
  coseDellaScena,
  etichetteDellaScena,
} from "../core/scena-delle-luci.js";
import {
  NeveLeggera,
  disegnaLaGhirlanda,
  disegnaLeLucine,
  giraIFotogrammi,
  preparaLaTela,
} from "./disegni-delle-feste.js";
import { corsiaDegliAvvisi } from "./come-sta-la-casa-section.js";
import { entitaDelMeteo } from "./la-card-del-meteo-section.js";
import { cssDellaScena, iconaDelTipo, mettiLaScena } from "./la-scena-delle-luci.js";
import {
  allStates,
  chiamaServizio,
  clean,
  doc,
  esc,
  ilCambioTocca,
  installStyle,
  planciaVisibile,
  quandoSiCambiaPagina,
  readJson,
  root,
  t,
  wrapFunction,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_FESTE__";
const STYLE_ID = "dm-feste-style";
const CLASSE = "dm-feste";
const ID_NEVE = "dm-feste-neve";
const ID_GHIRLANDA = "dm-feste-ghirlanda";
const ID_CONTO = "dm-feste-conto";
const ID_LUCI = "dm-feste-luci";
const ID_AUGURI = "dm-feste-auguri";
const state = (root[KEY] ||= {
  installed: false,
  accese: false,
  frame: 0,
  minuto: 0,
  neve: null,
  giro: null,
  misuraGhirlanda: "",
  attese: new Map(),
  /* Le entita' delle luci dell'ultimo disegno: quelle i cui cambi di stato
   * rifanno il riquadro. */
  luci: [],
  /* Chi guarda se il riquadro delle luci e' sullo schermo, e se lo e'. */
  osservatore: null,
  inVista: true,
  misuratore: null,
  larghezzaDelRiquadro: 0,
});

export const configurazioneDelleFeste = () => festePulite(readJson(CHIAVE_FESTE, null));

const menoMovimento = () => Boolean(root.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
const temaChiaro = () => doc?.documentElement?.getAttribute?.("data-theme") === "light";

/* ── le parole ──────────────────────────────────────────────────────────── */

const due = (n) => String(n).padStart(2, "0");

/** «4g 05:17»: i giorni, poi le ore e i minuti che mancano alla mezzanotte. */
export function contoInParole(conto) {
  if (!conto) return "";
  const ore = `${due(conto.ore)}:${due(conto.minuti)}`;
  if (!conto.giorni) return ore;
  const giorni = conto.giorni;
  return `${t(`${giorni}g`, `${giorni}d`)} ${ore}`;
}

/* Il tramonto che `sun.sun` dice adesso, se lo dice. */
function prossimoTramonto(states) {
  return states?.["sun.sun"]?.attributes?.next_setting || null;
}

/* Un'ora dentro una frase, in grassetto: la frase si scrive intera nella
 * lingua di chi guarda, e l'ora poi si ritrova e si mette in evidenza. */
function conLOra(frase, ora) {
  const testo = esc(frase);
  return ora ? testo.replace(esc(ora), `<b>${esc(ora)}</b>`) : testo;
}

/**
 * Le parole del riquadro: quante sono accese (il titolo) e la riga
 * dell'orario, gia' in HTML con le ore in grassetto.
 */
export function paroleDelleLuci(config, states, adesso = new Date()) {
  const totale = config.luci.length;
  const accese = config.luci.filter((l) => clean(states?.[l.entity]?.state) === "on").length;
  let titolo;
  if (!accese) titolo = totale === 1 ? t("Spenta", "Off") : t("Tutte spente", "All off");
  else if (totale === 1) titolo = t("Accesa", "On");
  else if (accese === totale) titolo = t("Tutte accese", "All on");
  else if (accese === 1) titolo = t("1 accesa", "1 on");
  else titolo = t(`${accese} accese`, `${accese} on`);
  const spegni = config.spegni.ora;
  const tramonto = prossimoTramonto(states);
  const alTramonto = config.accendi.tipo === "tramonto" && Boolean(tramonto);
  const oggi = intervalloDelGiorno(config, adesso, tramonto);
  const da = oggi ? oraDi(oggi.inizio) : "";
  let orario;
  if (config.automatico === false)
    orario = esc(t("Si accendono e si spengono a mano", "Switched on and off by hand"));
  else if (accese) orario = conLOra(t(`Si spengono alle ${spegni}`, `Off at ${spegni}`), spegni);
  else if (oggi && adesso.getTime() < oggi.inizio)
    orario = alTramonto
      ? conLOra(t(`Si accendono al tramonto, alle ${da}`, `On at sunset, at ${da}`), da)
      : conLOra(t(`Si accendono alle ${da}`, `On at ${da}`), da);
  else {
    const domani = new Date(adesso.getFullYear(), adesso.getMonth(), adesso.getDate() + 1);
    const prossimo = intervalloDelGiorno(config, domani, tramonto);
    const ora = prossimo ? oraDi(prossimo.inizio) : "";
    orario = prossimo
      ? conLOra(t(`Si riaccendono domani alle ${ora}`, `Back on tomorrow at ${ora}`), ora)
      : esc(t("Oggi non si accendono da sole", "They do not switch on by themselves today"));
  }
  return { accese, totale, titolo, orario };
}

/* ── il riquadro delle luci ─────────────────────────────────────────────── */

function nomeDellaLuce(luce, states) {
  return (
    clean(luce.nome) ||
    clean(states?.[luce.entity]?.attributes?.friendly_name) ||
    luce.entity.split(".")[1].replace(/_/g, " ")
  );
}

const nomiDiCasa = (config, states) =>
  Object.fromEntries(
    config.luci.map((l) => [l.entity, clean(states?.[l.entity]?.attributes?.friendly_name)]),
  );

/** Un interruttore: l'icona del tipo, il nome, l'interruttore. */
export function interruttoreDellaLuce(luce, states) {
  const nome = nomeDellaLuce(luce, states);
  const tipo = tipoDellaLuce(luce, clean(states?.[luce.entity]?.attributes?.friendly_name));
  return `<button type="button" class="dm-luci-int" data-feste-luce="${esc(luce.entity)}" aria-pressed="false" title="${esc(nome)}">
    <span class="dm-luci-int-ic">${iconaDelTipo(tipo, 18)}</span><span class="dm-luci-int-nome">${esc(nome)}</span><i class="dm-luci-int-sw" aria-hidden="true"></i>
  </button>`;
}

/* I comandi: si scrivono quando cambiano le luci (quali, come si chiamano);
 * ai cambi di stato si cambiano solo le parole e le classi. */
function comandiDelleLuci(config, states) {
  return `<div class="dm-feste-cap">${esc(t("Luci di Natale", "Christmas lights"))}</div>
    <div class="dm-luci-titolo" aria-live="polite"></div>
    <div class="dm-luci-orario"></div>
    <div class="dm-luci-ints">${config.luci.map((l) => interruttoreDellaLuce(l, states)).join("")}</div>
    <button type="button" class="dm-luci-tutte" data-feste-tutte="accendi"></button>`;
}

/** Le entita' accese, fra quelle delle luci. */
export function luciAcceseOra(config, states) {
  return new Set(
    config.luci.map((l) => l.entity).filter((e) => clean(states?.[e]?.state) === "on"),
  );
}

/** Il cielo di adesso per la scena, col tempo dell'entita' meteo di Home. */
export function cieloDiCasa(states, adesso = new Date()) {
  const meteo = entitaDelMeteo(states);
  return cieloDellaScena({
    stati: states,
    condizione: meteo ? states?.[meteo]?.state : "",
    adesso,
  });
}

/* Sotto questa larghezza i comandi scendono sotto la scena. */
const STRETTO = 700;

function aggiornaIlRiquadro(riquadro, config, states, adesso) {
  const scena = riquadro.querySelector(".dm-luci-scena");
  const comandi = riquadro.querySelector(".dm-luci-comandi");
  if (!scena || !comandi) return;
  const firmaComandi = JSON.stringify([
    config.luci,
    config.luci.map((l) => states?.[l.entity]?.attributes?.friendly_name || ""),
    t("Luci di Natale", "Christmas lights"),
  ]);
  if (comandi.dataset.firma !== firmaComandi) {
    comandi.dataset.firma = firmaComandi;
    comandi.innerHTML = comandiDelleLuci(config, states);
  }
  const { accese, titolo, orario } = paroleDelleLuci(config, states, adesso);
  const titoloNodo = comandi.querySelector(".dm-luci-titolo");
  if (titoloNodo && titoloNodo.textContent !== titolo) titoloNodo.textContent = titolo;
  const orarioNodo = comandi.querySelector(".dm-luci-orario");
  if (orarioNodo && orarioNodo.dataset.scritto !== orario) {
    orarioNodo.dataset.scritto = orario;
    orarioNodo.innerHTML = orario;
  }
  for (const int of comandi.querySelectorAll("[data-feste-luce]")) {
    const valore = clean(states?.[int.dataset.festeLuce]?.state);
    const accesa = valore === "on";
    int.setAttribute("aria-pressed", String(accesa));
    int.classList.toggle("acceso", accesa);
    int.classList.toggle("muta", !valore || valore === "unavailable" || valore === "unknown");
    int.classList.remove("in-attesa");
  }
  const tutte = comandi.querySelector("[data-feste-tutte]");
  if (tutte) {
    const verso = accese ? "spegni" : "accendi";
    const parola = accese ? t("Spegni tutte", "Turn all off") : t("Accendi tutte", "Turn all on");
    tutte.dataset.festeTutte = verso;
    tutte.classList.toggle("spegni", Boolean(accese));
    if (tutte.textContent !== parola) tutte.textContent = parola;
    tutte.classList.remove("in-attesa");
  }
  /* La scena: accanto ai comandi sullo schermo largo, sopra sullo stretto. */
  const stretto = riquadro.clientWidth > 0 && riquadro.clientWidth < STRETTO;
  riquadro.classList.toggle("stretto", stretto);
  const cielo = cieloDiCasa(states, adesso);
  riquadro.dataset.fase = cielo.fase;
  riquadro.classList.toggle("testo-scuro", stretto ? cielo.pannelloChiaro : cielo.chiaro);
  riquadro.style.setProperty("--dm-luci-pannello", cielo.colori.pannello);
  const cose = coseDellaScena(config.luci, nomiDiCasa(config, states));
  mettiLaScena(scena, {
    cose,
    cielo,
    accese: luciAcceseOra(config, states),
    etichette: etichetteDellaScena(cose, (e) =>
      nomeDellaLuce(config.luci.find((l) => l.entity === e) || { entity: e }, states),
    ),
    prefisso: "dmlh",
    da: stretto ? 12 : comandi.offsetLeft + comandi.offsetWidth + 8,
    riserva: stretto ? 12 : 96,
    astro: null,
  });
}

/* La scena si ferma quando non si vede: fuori dallo schermo, o con la
 * plancia messa da parte. */
function osservaIlRiquadro(riquadro) {
  /* La larghezza cambia anche senza che la finestra cambi (il menu di lato
   * che si chiude): la scena si ridisegna per la misura nuova. */
  if (!state.misuratore && root.ResizeObserver) {
    state.misuratore = new root.ResizeObserver((voci) => {
      const larga = Math.round(voci[0]?.contentRect?.width || 0);
      if (larga && larga !== state.larghezzaDelRiquadro) {
        state.larghezzaDelRiquadro = larga;
        schedule();
      }
    });
  }
  state.misuratore?.observe(riquadro);
  if (state.osservatore || !root.IntersectionObserver) return;
  state.osservatore = new root.IntersectionObserver((voci) => {
    for (const voce of voci) {
      state.inVista = voce.isIntersecting;
      voce.target
        .querySelector(".dm-luci-scena")
        ?.classList.toggle("dm-sc-fermo", !voce.isIntersecting || !planciaVisibile());
    }
  });
  state.osservatore.observe(riquadro);
}

/* Il posto in Home: sotto la barra dei conteggi, e sotto i testi della
 * sicurezza quando ci sono — quelli sono avvisi, e un avviso sta sopra una
 * decorazione. La corsia la da' chi la possiede (`corsiaDegliAvvisi`). */
function postoInHome() {
  const corsia = corsiaDegliAvvisi();
  if (!corsia) return null;
  const testi = doc.getElementById("dm-sic-testi");
  return testi && testi.previousElementSibling === corsia ? testi : corsia;
}

function mettiDopo(sopra, nodo) {
  if (nodo.previousElementSibling !== sopra) sopra.after(nodo);
}

function disegnaLeLuciInHome(config, states, adesso) {
  let riquadro = doc.getElementById(ID_LUCI);
  if (!config.luci.length || config.riquadro === false) {
    if (riquadro) {
      state.osservatore?.unobserve?.(riquadro);
      state.misuratore?.unobserve?.(riquadro);
      riquadro.remove();
    }
    return false;
  }
  const sopra = postoInHome();
  if (!sopra) return false;
  if (!riquadro) {
    riquadro = doc.createElement("section");
    riquadro.id = ID_LUCI;
    riquadro.className = "dm-feste-luci";
    riquadro.setAttribute("aria-label", t("Luci di Natale", "Christmas lights"));
    riquadro.innerHTML = `<div class="dm-luci-scena"></div><div class="dm-luci-comandi"></div>`;
  }
  mettiDopo(doc.getElementById(ID_AUGURI) || sopra, riquadro);
  osservaIlRiquadro(riquadro);
  if (state.osservatore) state.osservatore.observe(riquadro);
  aggiornaIlRiquadro(riquadro, config, states, adesso);
  riquadro
    .querySelector(".dm-luci-scena")
    ?.classList.toggle("dm-sc-fermo", !planciaVisibile() || state.inVista === false);
  return true;
}

function disegnaLeLucineDelRiquadro(riquadro) {
  const tela = riquadro.querySelector(".dm-feste-lucine");
  const w = Math.round(riquadro.clientWidth);
  if (!tela || !w) return;
  const firma = `${w}`;
  if (tela.dataset.misura === firma) return;
  tela.dataset.misura = firma;
  tela.style.width = `${w}px`;
  tela.style.height = "20px";
  const x = preparaLaTela(tela, w, 20, root);
  if (x) disegnaLeLucine(x, w);
}

/* ── gli auguri del primo gennaio ───────────────────────────────────────── */

function disegnaGliAuguri(adesso) {
  let auguri = doc.getElementById(ID_AUGURI);
  if (!eCapodanno(adesso)) {
    auguri?.remove();
    return false;
  }
  const sopra = postoInHome();
  if (!sopra) return false;
  if (!auguri) {
    auguri = doc.createElement("section");
    auguri.id = ID_AUGURI;
    auguri.className = "dm-feste-auguri";
  }
  mettiDopo(sopra, auguri);
  const anno = annoNuovo(adesso);
  const markup = `<canvas class="dm-feste-lucine" aria-hidden="true"></canvas>
    <div class="dm-feste-cap">${esc(t("Capodanno", "New Year's Day"))}</div>
    <div class="dm-feste-auguri-titolo">${esc(t(`Buon ${anno} da GdAHome`, `Happy ${anno} from GdAHome`))}</div>
    <div class="dm-feste-sotto">${esc(t("Tanti auguri a tutta la casa", "Best wishes to the whole home"))}</div>`;
  if (auguri.dataset.scritto !== markup) {
    auguri.dataset.scritto = markup;
    auguri.innerHTML = markup;
  }
  disegnaLeLucineDelRiquadro(auguri);
  return true;
}

/* ── la testata ─────────────────────────────────────────────────────────── */

function testata() {
  return (
    doc?.querySelector?.("body > header") ||
    doc?.querySelector?.("#page-home > header") ||
    doc?.querySelector?.("header")
  );
}

function disegnaLaGhirlandaInTestata() {
  const header = testata();
  if (!header) return;
  let tela = doc.getElementById(ID_GHIRLANDA);
  if (!tela) {
    tela = doc.createElement("canvas");
    tela.id = ID_GHIRLANDA;
    tela.setAttribute("aria-hidden", "true");
  }
  if (tela.parentElement !== header) header.prepend(tela);
  const w = Math.round(header.clientWidth);
  if (!w) return;
  const chiaro = temaChiaro();
  const firma = `${w}|${chiaro}`;
  if (state.misuraGhirlanda === firma && tela.width) return;
  state.misuraGhirlanda = firma;
  tela.style.width = `${w}px`;
  tela.style.height = "44px";
  const x = preparaLaTela(tela, w, 44, root);
  if (x) disegnaLaGhirlanda(x, w, { chiaro });
}

/* La pillola del conto alla rovescia sta in alto a destra nella testata,
 * accanto al pallino della connessione. Non entra nella fila della testata —
 * li' spingerebbe il titolo fuori dal centro — ma le si appoggia sopra, alla
 * sinistra del pallino: dove sia il pallino lo si misura, perche' la testata
 * cambia forma dal telefono al computer. */
function disegnaIlConto(adesso) {
  const header = testata();
  let pillola = doc.getElementById(ID_CONTO);
  const conto = contoAllaRovescia(adesso);
  if (!header || !conto) {
    pillola?.remove();
    return;
  }
  if (!pillola) {
    pillola = doc.createElement("div");
    pillola.id = ID_CONTO;
    pillola.className = "dm-feste-conto";
    pillola.setAttribute("role", "timer");
  }
  if (pillola.parentElement !== header) header.append(pillola);
  const anno = conto.anno;
  const markup = `<span class="dm-feste-conto-ic" aria-hidden="true">✨</span><span class="dm-feste-conto-al">${esc(
    t(`Al ${anno}`, `To ${anno}`),
  )}</span><b class="dm-feste-conto-n">${esc(contoInParole(conto))}</b>`;
  if (pillola.dataset.scritto !== markup) {
    pillola.dataset.scritto = markup;
    pillola.innerHTML = markup;
  }
  const pallino = header.querySelector(":scope > .status-pill");
  const box = header.getBoundingClientRect();
  /* Sul telefono la testata e' una riga sola e piena: la pillola scende e
   * si appende al bordo basso della testata, al centro (lo dice il foglio). */
  if ((root.innerWidth || 0) <= 700) {
    pillola.style.removeProperty("right");
    pillola.style.removeProperty("top");
  } else if (pallino && box.width) {
    const suo = pallino.getBoundingClientRect();
    const destra = Math.max(12, Math.round(box.right - suo.left + 10));
    pillola.style.right = `${destra}px`;
    pillola.style.top = `${Math.max(8, Math.round(suo.top - box.top + suo.height / 2 - 18))}px`;
  }
}

/* ── la neve ────────────────────────────────────────────────────────────── */

function neveFerma() {
  /* Il pannello a muro copre la pagina: la sua neve, se c'e', e' la sua. */
  return doc.documentElement.classList.contains("dm-muro-acceso");
}

function accendiLaNeve() {
  let tela = doc.getElementById(ID_NEVE);
  if (!tela) {
    tela = doc.createElement("canvas");
    tela.id = ID_NEVE;
    tela.setAttribute("aria-hidden", "true");
    doc.body.append(tela);
  }
  const w = root.innerWidth || doc.documentElement.clientWidth || 0;
  const h = root.innerHeight || doc.documentElement.clientHeight || 0;
  if (!w || !h) return;
  const fermo = menoMovimento();
  const firma = `${w}x${h}|${fermo}`;
  if (state.giro && tela.dataset.misura === firma) return;
  tela.dataset.misura = firma;
  state.giro?.ferma();
  tela.style.width = `${w}px`;
  tela.style.height = `${h}px`;
  const x = preparaLaTela(tela, w, h, root);
  if (!x) return;
  /* Pochi fiocchi: una quarantina sul telefono, una novantina sul computer.
   * E' una neve leggera, non una bufera davanti ai numeri. */
  if (!state.neve) state.neve = new NeveLeggera({ quanti: w < 700 ? 40 : 90, documento: doc });
  state.neve.misura(w, h);
  state.giro = giraIFotogrammi(
    (dt) => {
      if (neveFerma()) {
        x.clearRect(0, 0, w, h);
        state.giro = null;
        delete tela.dataset.misura;
        return false;
      }
      state.neve.passo(dt);
      state.neve.disegna(x);
      return true;
    },
    { finestra: root, fermo },
  );
}

function spegniLaNeve() {
  state.giro?.ferma();
  state.giro = null;
  state.neve = null;
  doc.getElementById(ID_NEVE)?.remove();
}

/* ── il giro ────────────────────────────────────────────────────────────── */

/* Via la festa: ghirlanda, neve, conto e auguri. Il riquadro delle luci no,
 * che c'e' tutto l'anno. */
function togliTutto() {
  spegniLaNeve();
  for (const id of [ID_GHIRLANDA, ID_CONTO, ID_AUGURI]) doc.getElementById(id)?.remove();
  doc.documentElement.classList.remove(CLASSE);
  state.misuraGhirlanda = "";
  state.accese = false;
}

export function disegnaLeFeste(adesso = new Date()) {
  state.frame = 0;
  if (!doc?.body) return false;
  const config = configurazioneDelleFeste();
  state.luci = config.riquadro === false ? [] : entitaDelleLuci(config);
  const states = allStates() || {};
  if (!inFesta(adesso)) {
    if (state.accese || doc.getElementById(ID_NEVE)) togliTutto();
    disegnaLeLuciInHome(config, states, adesso);
    return false;
  }
  state.accese = true;
  doc.documentElement.classList.add(CLASSE);
  disegnaLaGhirlandaInTestata();
  disegnaIlConto(adesso);
  disegnaGliAuguri(adesso);
  disegnaLeLuciInHome(config, states, adesso);
  if (neveFerma()) {
    state.giro?.ferma();
    state.giro = null;
    const tela = doc.getElementById(ID_NEVE);
    if (tela) delete tela.dataset.misura;
  } else accendiLaNeve();
  return true;
}

function schedule() {
  if (state.frame) return;
  state.frame =
    root.requestAnimationFrame?.(() => disegnaLeFeste()) ||
    root.setTimeout?.(() => disegnaLeFeste(), 0) ||
    0;
}

/* Una volta al minuto, al minuto giusto: e' il passo del conto alla
 * rovescia, e quello con cui le feste cominciano e finiscono. */
function alMinuto() {
  root.clearTimeout?.(state.minuto);
  const adesso = new Date();
  const mancano = 60_000 - (adesso.getSeconds() * 1000 + adesso.getMilliseconds()) + 50;
  state.minuto = root.setTimeout?.(() => {
    schedule();
    alMinuto();
  }, mancano);
}

/* ── i tocchi ───────────────────────────────────────────────────────────── */

function servizio(entity, verso) {
  const dominio = entity.split(".")[0];
  return { domain: dominio, service: verso, data: { entity_id: entity } };
}

/* Un tocco su una cosa della scena: l'albero, il presepe, la casa. Accende
 * o spegne tutte le sue luci, e la cosa si abbassa un attimo sotto il dito. */
function toccaLaScena(cosa) {
  const entita = clean(cosa.dataset.festeEntita).split(" ").filter(Boolean);
  if (!entita.length) return;
  const states = allStates() || {};
  for (const chiamata of chiamateDelTocco(entita, (e) => clean(states?.[e]?.state) === "on"))
    chiamaServizio(chiamata);
  cosa.classList.add("in-attesa", "toccata");
  root.setTimeout?.(() => cosa.classList.remove("toccata"), 240);
}

function onClick(event) {
  const cosa = event.target?.closest?.(`#${ID_LUCI} [data-feste-entita]`);
  if (cosa) {
    event.preventDefault();
    toccaLaScena(cosa);
    return;
  }
  const tessera = event.target?.closest?.(`#${ID_LUCI} [data-feste-luce]`);
  if (tessera) {
    event.preventDefault();
    const entity = clean(tessera.dataset.festeLuce);
    const accesa = tessera.getAttribute("aria-pressed") === "true";
    chiamaServizio(servizio(entity, accesa ? "turn_off" : "turn_on"));
    tessera.classList.add("in-attesa");
    return;
  }
  const tutte = event.target?.closest?.(`#${ID_LUCI} [data-feste-tutte]`);
  if (!tutte) return;
  event.preventDefault();
  const verso = tutte.dataset.festeTutte === "spegni" ? "turn_off" : "turn_on";
  const perDominio = new Map();
  for (const id of entitaDelleLuci(configurazioneDelleFeste())) {
    const dominio = id.split(".")[0];
    perDominio.set(dominio, [...(perDominio.get(dominio) || []), id]);
  }
  for (const [domain, entity_id] of perDominio)
    chiamaServizio({ domain, service: verso, data: { entity_id } });
  tutte.classList.add("in-attesa");
}

/* Le cose della scena si accendono anche dalla tastiera, come un tasto. */
function onKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") return;
  const cosa = event.target?.closest?.(`#${ID_LUCI} [data-feste-entita]`);
  if (!cosa) return;
  event.preventDefault();
  toccaLaScena(cosa);
}

const agganciaIlTema = () => wrapFunction("applyTheme", "__dmFeste", schedule);

export function installFeste() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyle(STYLE_ID, css());
  doc.addEventListener("click", onClick);
  doc.addEventListener("keydown", onKeydown);
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:persistence-restored",
    "dashboardmodern:config-reset",
    "dashboardmodern:persistence-saved",
    "dashboardmodern:store-user-write",
  ])
    root.addEventListener?.(evento, () => {
      agganciaIlTema();
      schedule();
    });
  /* Un cambio di stato conta solo se tocca le luci di Natale o il sole.
   * Anche fuori dalle feste: il riquadro delle luci c'e' tutto l'anno, e
   * «premo l'albero, si accende, ma la card non cambia stato, e' lentissima»
   * era questo — fuori dalle feste il cambio si ignorava, e il riquadro si
   * rifaceva solo al giro del minuto. Le luci si tengono da parte a ogni
   * disegno (`state.luci`), cosi' qui non si legge il deposito a ogni cambio
   * di stato della casa. */
  root.addEventListener?.("dashboardmodern:state-changed", (event) => {
    if (!state.luci?.length) return;
    if (ilCambioTocca(event, [...state.luci, "sun.sun"])) schedule();
  });
  root.addEventListener?.("resize", schedule, { passive: true });
  doc.addEventListener("visibilitychange", () => {
    if (!doc.hidden) schedule();
  });
  /* Tornando in Home il riquadro riprende misura: la scena si mette allora. */
  quandoSiCambiaPagina(schedule);
  /* Il tema cambia la ghirlanda: l'oro sul bianco ha bisogno del punto
   * pieno. Il tema lo mette il guscio con `applyTheme` (dai tre tasti, e
   * quando il telefono passa da chiaro a scuro in «automatico»): ci si
   * aggancia a lei invece di guardare la radice del documento, che cambia di
   * continuo per tutt'altro. Il pannello a muro che si accende ferma la neve
   * da solo, al primo fotogramma (`neveFerma`); quando si spegne, la neve
   * riparte al giro del minuto o al primo cambio. */
  agganciaIlTema();
  root.matchMedia?.("(prefers-color-scheme: dark)")?.addEventListener?.("change", schedule);
  root.matchMedia?.("(prefers-reduced-motion: reduce)")?.addEventListener?.("change", () => {
    const tela = doc.getElementById(ID_NEVE);
    if (tela) delete tela.dataset.misura;
    schedule();
  });
  alMinuto();
  schedule();
  return true;
}

/* ── stile ──────────────────────────────────────────────────────────────── */

function css() {
  return `
    /* La testata fa da riferimento alla ghirlanda e alla pillola: senza, le
       due cose si appoggerebbero alla pagina. Col peso piu' basso che ci sia
       (\`:where\`): la testa ferma (\`testa-fissa-section.js\`) la vuole
       \`sticky\`, che fa da riferimento lo stesso, e deve vincere lei. */
    :where(html.${CLASSE}) body > header,:where(html.${CLASSE}) #page-home > header{position:relative}
    #${ID_GHIRLANDA}{position:absolute;left:0;top:0;pointer-events:none;z-index:1;
      border-top-left-radius:inherit;border-top-right-radius:inherit}

    /* La neve: sopra la pagina e sotto ogni finestra che si apre, e non
       ferma mai un tocco. */
    #${ID_NEVE}{position:fixed;left:0;top:0;pointer-events:none;z-index:60}

    /* La pillola del conto alla rovescia: scura, l'anno smorto, i numeri
       in oro. */
    .dm-feste-conto{position:absolute;z-index:2;display:inline-flex;align-items:center;gap:8px;
      height:36px;padding:0 14px 0 8px;border-radius:999px;white-space:nowrap;
      background:linear-gradient(135deg,#0f0c29,#24243e);color:#fff;
      font-size:12.5px;font-weight:600;box-shadow:0 6px 18px rgba(15,12,41,.3)}
    .dm-feste-conto-ic{display:grid;place-items:center;width:22px;height:22px;border-radius:50%;
      background:rgba(255,214,140,.16);font-size:12px}
    .dm-feste-conto-al{opacity:.72;text-transform:uppercase;letter-spacing:.04em}
    .dm-feste-conto-n{font-family:Oswald,Inter,sans-serif;font-weight:700;font-size:16px;letter-spacing:.5px;
      background:linear-gradient(180deg,#fff7d6 0%,#f5d27a 45%,#c9952e 100%);
      -webkit-background-clip:text;background-clip:text;color:transparent;font-variant-numeric:tabular-nums}
    html[data-theme="dark"] .dm-feste-conto{box-shadow:0 0 0 1px rgba(255,214,140,.22),0 6px 18px rgba(0,0,0,.4)}
    @media (max-width:700px){
      .dm-feste-conto{left:50%;bottom:-15px;transform:translateX(-50%);height:30px;font-size:11.5px}
      .dm-feste-conto-ic{width:20px;height:20px}
      .dm-feste-conto-n{font-size:14px}}

    /* Gli auguri: dal verde del bosco al bordeaux, l'oro nel titolo, le
       lucine sul bordo alto. */
    .dm-feste-auguri{position:relative;overflow:hidden;margin:0 0 14px;padding:26px 24px 22px;
      border-radius:18px;color:#fff;text-align:center;
      background:linear-gradient(120deg,#0c2b1e 0%,#123d2a 45%,#3b0f17 100%);
      box-shadow:0 14px 34px rgba(12,43,30,.28)}
    html[data-theme="dark"] .dm-feste-auguri{
      box-shadow:0 0 0 1px rgba(255,214,140,.12),0 14px 34px rgba(0,0,0,.35)}
    .dm-feste-lucine{position:absolute;left:0;top:0;pointer-events:none}
    .dm-feste-cap{font-size:12px;font-weight:600;letter-spacing:5px;text-transform:uppercase;
      background:linear-gradient(180deg,#fff7d6 0%,#f5d27a 45%,#c9952e 100%);
      -webkit-background-clip:text;background-clip:text;color:transparent;width:max-content;max-width:100%}
    .dm-feste-sotto{margin-top:4px;font-size:13px;opacity:.68}
    .dm-feste-auguri .dm-feste-cap{margin:0 auto}
    .dm-feste-auguri-titolo{margin-top:8px;font-family:"Inter Display",Inter,sans-serif;font-weight:200;
      font-size:44px;letter-spacing:-1px;line-height:1.05;
      background:linear-gradient(180deg,#fff7d6 0%,#f5d27a 45%,#c9952e 100%);
      -webkit-background-clip:text;background-clip:text;color:transparent}
    @media (max-width:700px){.dm-feste-auguri-titolo{font-size:32px}}

    /* Il riquadro delle luci: la scena d'inverno sul fondo, i comandi a
       sinistra sopra un velo che li fa leggere (scuro sul cielo di notte,
       chiaro su quello di giorno). Sullo stretto la scena sta sopra e i
       comandi sotto, su un fondo del colore della scena. */
    ${cssDellaScena(`#${ID_LUCI} .dm-luci-scena`)}
    #${ID_LUCI}{position:relative;overflow:hidden;margin:0 0 14px;min-height:300px;border-radius:22px;
      color:#fff;background:var(--dm-luci-pannello,#0d1838);isolation:isolate;
      box-shadow:0 18px 40px rgba(8,20,40,.24);-webkit-tap-highlight-color:transparent}
    html[data-theme="dark"] #${ID_LUCI}{box-shadow:0 0 0 1px rgba(255,255,255,.06),0 18px 40px rgba(0,0,0,.45)}
    #${ID_LUCI} .dm-luci-scena{position:absolute;inset:0;z-index:0}
    #${ID_LUCI} .dm-luci-scena::after{content:"";position:absolute;inset:0;pointer-events:none;
      background:linear-gradient(90deg,rgba(5,11,32,.74) 0,rgba(5,11,32,.46) 300px,rgba(5,11,32,0) 540px)}
    #${ID_LUCI}.testo-scuro .dm-luci-scena::after{
      background:linear-gradient(90deg,rgba(247,250,255,.86) 0,rgba(247,250,255,.55) 300px,rgba(247,250,255,0) 540px)}
    #${ID_LUCI} .sc-cosa{transition:transform .2s ease;transform-box:fill-box;transform-origin:50% 100%}
    #${ID_LUCI} .sc-cosa.toccata{transform:scale(.97)}
    #${ID_LUCI} .dm-luci-comandi{position:relative;z-index:2;width:min(430px,44%);padding:30px 0 28px 34px;
      pointer-events:none}
    #${ID_LUCI} .dm-luci-comandi>*{pointer-events:auto}
    #${ID_LUCI} .dm-feste-cap{font-weight:700;letter-spacing:.34em}
    #${ID_LUCI} .dm-luci-titolo{margin-top:8px;font-size:32px;font-weight:700;line-height:1.08;letter-spacing:-.6px;
      text-shadow:0 2px 16px rgba(0,0,0,.4)}
    #${ID_LUCI} .dm-luci-orario{margin-top:6px;font-size:14px;font-weight:500;color:#d3def2;line-height:1.4}
    #${ID_LUCI} .dm-luci-orario b{color:#ffdf9e;font-weight:700}
    #${ID_LUCI} .dm-luci-ints{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
    #${ID_LUCI} .dm-luci-int{display:inline-flex;align-items:center;gap:8px;height:40px;max-width:100%;min-width:0;
      padding:0 10px;border-radius:13px;border:1px solid rgba(255,255,255,.16);background:rgba(10,20,45,.62);
      color:#fff;font:inherit;font-size:13.5px;font-weight:600;cursor:pointer;
      transition:background .3s ease,border-color .3s ease,box-shadow .3s ease}
    #${ID_LUCI} .dm-luci-int-ic{display:grid;place-items:center;flex:none;color:rgba(255,255,255,.82)}
    #${ID_LUCI} .dm-luci-int-nome{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    #${ID_LUCI} .dm-luci-int-sw{position:relative;flex:none;width:30px;height:18px;border-radius:99px;
      background:rgba(255,255,255,.24);transition:background .25s ease}
    #${ID_LUCI} .dm-luci-int-sw::after{content:"";position:absolute;top:3px;left:3px;width:12px;height:12px;
      border-radius:50%;background:#fff;transition:transform .25s ease;box-shadow:0 1px 2px rgba(0,0,0,.25)}
    #${ID_LUCI} .dm-luci-int.acceso{border-color:rgba(255,214,140,.62);background:rgba(92,62,12,.6);
      box-shadow:0 0 20px rgba(255,190,90,.22)}
    #${ID_LUCI} .dm-luci-int.acceso .dm-luci-int-sw{background:#f0b65a}
    #${ID_LUCI} .dm-luci-int.acceso .dm-luci-int-sw::after{transform:translateX(12px)}
    #${ID_LUCI} .dm-luci-int.muta{opacity:.55}
    #${ID_LUCI} .dm-luci-int.in-attesa,#${ID_LUCI} .dm-luci-tutte.in-attesa{opacity:.7}
    #${ID_LUCI} .dm-luci-tutte{display:inline-flex;align-items:center;margin-top:14px;height:44px;padding:0 20px;
      border-radius:14px;border:1px solid transparent;font:inherit;font-size:14.5px;font-weight:700;cursor:pointer;
      background:linear-gradient(180deg,#ffe6ae,#eeb054);color:#3a2408;
      box-shadow:0 10px 24px rgba(240,182,90,.32),inset 0 1px 0 rgba(255,255,255,.65);
      transition:background .3s ease,box-shadow .3s ease}
    #${ID_LUCI} .dm-luci-tutte.spegni{background:rgba(10,20,45,.62);color:#fff;border-color:rgba(255,255,255,.22);box-shadow:none}
    #${ID_LUCI} .dm-luci-int:focus-visible,#${ID_LUCI} .dm-luci-tutte:focus-visible{outline:2px solid #f5d27a;outline-offset:2px}
    #${ID_LUCI} .dm-luci-int:active,#${ID_LUCI} .dm-luci-tutte:active{transform:scale(.97)}

    /* Sul cielo chiaro (o sul fondo chiaro dello stretto) il testo e' scuro. */
    #${ID_LUCI}.testo-scuro{color:#12213d}
    #${ID_LUCI}.testo-scuro .dm-feste-cap{background:none;color:#946210}
    #${ID_LUCI}.testo-scuro .dm-luci-titolo{text-shadow:none}
    #${ID_LUCI}.testo-scuro .dm-luci-orario{color:#3a4864}
    #${ID_LUCI}.testo-scuro .dm-luci-orario b{color:#875400}
    #${ID_LUCI}.testo-scuro .dm-luci-int{background:rgba(255,255,255,.8);border-color:rgba(20,40,80,.14);color:#14233f}
    #${ID_LUCI}.testo-scuro .dm-luci-int-ic{color:#40506e}
    #${ID_LUCI}.testo-scuro .dm-luci-int-sw{background:rgba(20,40,80,.2)}
    #${ID_LUCI}.testo-scuro .dm-luci-int.acceso{background:#fff3d6;border-color:#e3ad4f;box-shadow:0 4px 14px rgba(227,173,79,.25)}
    #${ID_LUCI}.testo-scuro .dm-luci-int.acceso .dm-luci-int-sw{background:#e8a63a}
    #${ID_LUCI}.testo-scuro .dm-luci-tutte.spegni{background:rgba(255,255,255,.82);color:#14233f;border-color:rgba(20,40,80,.16)}

    /* Lo stretto: la scena sopra, i comandi sotto. */
    #${ID_LUCI}.stretto{min-height:0;display:flex;flex-direction:column}
    #${ID_LUCI}.stretto .dm-luci-scena{position:relative;inset:auto;flex:none;height:clamp(176px,50vw,240px)}
    #${ID_LUCI}.stretto .dm-luci-scena::after{background:linear-gradient(180deg,rgba(0,0,0,0) 78%,var(--dm-luci-pannello,#0d1838) 100%)}
    #${ID_LUCI}.stretto .dm-luci-comandi{width:auto;padding:14px 16px 18px}
    #${ID_LUCI}.stretto .dm-luci-titolo{font-size:26px}
    #${ID_LUCI}.stretto .dm-luci-ints{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    #${ID_LUCI}.stretto .dm-luci-int{height:44px}
    #${ID_LUCI}.stretto .dm-luci-int-sw{margin-left:auto}
    #${ID_LUCI}.stretto .dm-luci-tutte{width:100%;justify-content:center;height:46px}
    @media (prefers-reduced-motion:reduce){
      #${ID_LUCI} .dm-luci-int,#${ID_LUCI} .dm-luci-int-sw,#${ID_LUCI} .dm-luci-int-sw::after,
      #${ID_LUCI} .dm-luci-tutte,#${ID_LUCI} .sc-cosa{transition:none}}
  `;
}
