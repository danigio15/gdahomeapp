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
 *    in configurazione ci sono delle luci: quante sono accese, quando si
 *    spengono, una tessera per luce e «Spegni tutte». Questo NON aspetta le
 *    feste: l'albero si monta prima, e il riquadro c'e' tutto l'anno finche'
 *    non lo si spegne dalla scheda «Luci di Natale» (`riquadro`);
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
  iconaDellaLuce,
  inFesta,
  intervalloDelGiorno,
  oraDi,
} from "../core/feste.js";
import {
  NeveLeggera,
  disegnaLaGhirlanda,
  disegnaLeLucine,
  giraIFotogrammi,
  preparaLaTela,
} from "./disegni-delle-feste.js";
import { corsiaDegliAvvisi } from "./come-sta-la-casa-section.js";
import {
  allStates,
  chiamaServizio,
  clean,
  doc,
  esc,
  ilCambioTocca,
  installStyle,
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

/**
 * Le due righe del riquadro: quante sono accese e quando si spengono, poi
 * l'orario di oggi.
 */
export function righeDelleLuci(config, states, adesso = new Date()) {
  const accese = config.luci.filter((l) => clean(states?.[l.entity]?.state) === "on").length;
  const spegni = config.spegni.ora;
  const oggi = intervalloDelGiorno(config, adesso, prossimoTramonto(states));
  const da = oggi ? oraDi(oggi.inizio) : "";
  const prima = oggi && adesso.getTime() < oggi.inizio;
  let titolo;
  if (accese === 1) titolo = t(`1 accesa · si spengono alle ${spegni}`, `1 on · off at ${spegni}`);
  else if (accese > 1)
    titolo = t(`${accese} accese · si spengono alle ${spegni}`, `${accese} on · off at ${spegni}`);
  else if (prima) titolo = t(`Tutte spente · si accendono alle ${da}`, `All off · on at ${da}`);
  else titolo = t("Tutte spente", "All off");
  let sotto;
  if (!oggi)
    sotto = t("Oggi non si accendono da sole", "They do not switch on by themselves today");
  else if (config.accendi.tipo === "tramonto" && prossimoTramonto(states))
    sotto = t(`Dal tramonto (${da}) alle ${spegni}`, `From sunset (${da}) to ${spegni}`);
  else sotto = t(`Dalle ${da} alle ${spegni}`, `From ${da} to ${spegni}`);
  return { accese, titolo, sotto };
}

/* ── il riquadro delle luci ─────────────────────────────────────────────── */

function nomeDellaLuce(luce, states) {
  return (
    clean(luce.nome) ||
    clean(states?.[luce.entity]?.attributes?.friendly_name) ||
    luce.entity.split(".")[1].replace(/_/g, " ")
  );
}

/** Una tessera: l'icona, il nome, acceso o spento. Il tocco l'accende o la spegne. */
export function tesseraDellaLuce(luce, states) {
  const valore = clean(states?.[luce.entity]?.state);
  const accesa = valore === "on";
  const muta = !valore || valore === "unavailable" || valore === "unknown";
  const nome = nomeDellaLuce(luce, states);
  const stato = muta
    ? t("Non risponde", "Not responding")
    : accesa
      ? t("Acceso", "On")
      : t("Spento", "Off");
  return `<button type="button" class="dm-feste-tessera${accesa ? " accesa" : ""}${muta ? " muta" : ""}"
    data-feste-luce="${esc(luce.entity)}" aria-pressed="${accesa}" title="${esc(nome)}">
    <span class="dm-feste-tessera-ic" aria-hidden="true">${esc(iconaDellaLuce(luce, nome))}</span>
    <span class="dm-feste-tessera-tx"><b>${esc(nome)}</b><small>${esc(stato)}</small></span>
  </button>`;
}

export function riquadroDelleLuci(config, states, adesso = new Date()) {
  const { accese, titolo, sotto } = righeDelleLuci(config, states, adesso);
  const tutte = accese > 0 ? "spegni" : "accendi";
  return `<div class="dm-feste-luci-testo">
      <div class="dm-feste-cap">${esc(t("Luci di Natale", "Christmas lights"))}</div>
      <div class="dm-feste-titolo">${esc(titolo)}</div>
      <div class="dm-feste-sotto">${esc(sotto)}</div>
    </div>
    <div class="dm-feste-tessere">${config.luci.map((l) => tesseraDellaLuce(l, states)).join("")}
      <button type="button" class="dm-feste-tutte" data-feste-tutte="${tutte}">${esc(
        tutte === "spegni" ? t("Spegni tutte", "Turn all off") : t("Accendi tutte", "Turn all on"),
      )}</button>
    </div>`;
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
    riquadro?.remove();
    return false;
  }
  const sopra = postoInHome();
  if (!sopra) return false;
  if (!riquadro) {
    riquadro = doc.createElement("section");
    riquadro.id = ID_LUCI;
    riquadro.className = "dm-feste-luci";
    riquadro.innerHTML = `<canvas class="dm-feste-lucine" aria-hidden="true"></canvas><div class="dm-feste-luci-dentro"></div>`;
  }
  mettiDopo(doc.getElementById(ID_AUGURI) || sopra, riquadro);
  const dentro = riquadro.querySelector(".dm-feste-luci-dentro");
  const markup = riquadroDelleLuci(config, states, adesso);
  if (dentro && dentro.dataset.scritto !== markup) {
    dentro.dataset.scritto = markup;
    dentro.innerHTML = markup;
  }
  disegnaLeLucineDelRiquadro(riquadro);
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

function onClick(event) {
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

const agganciaIlTema = () => wrapFunction("applyTheme", "__dmFeste", schedule);

export function installFeste() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyle(STYLE_ID, css());
  doc.addEventListener("click", onClick);
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
  /* Un cambio di stato conta solo se tocca le luci di Natale o il sole, e
   * solo nelle feste: fuori, questa sezione non legge nemmeno il deposito. */
  root.addEventListener?.("dashboardmodern:state-changed", (event) => {
    if (!state.accese) return;
    if (ilCambioTocca(event, [...entitaDelleLuci(configurazioneDelleFeste()), "sun.sun"]))
      schedule();
  });
  root.addEventListener?.("resize", schedule, { passive: true });
  doc.addEventListener("visibilitychange", () => {
    if (!doc.hidden) schedule();
  });
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

    /* Il riquadro delle luci di Natale e gli auguri: dal verde del bosco al
       bordeaux, l'oro nei titoli, le lucine sul bordo alto. */
    .dm-feste-luci,.dm-feste-auguri{position:relative;overflow:hidden;margin:0 0 14px;padding:22px 26px 20px;
      border-radius:18px;color:#fff;
      background:linear-gradient(120deg,#0c2b1e 0%,#123d2a 45%,#3b0f17 100%);
      box-shadow:0 14px 34px rgba(12,43,30,.28)}
    html[data-theme="dark"] .dm-feste-luci,html[data-theme="dark"] .dm-feste-auguri{
      box-shadow:0 0 0 1px rgba(255,214,140,.12),0 14px 34px rgba(0,0,0,.35)}
    .dm-feste-lucine{position:absolute;left:0;top:0;pointer-events:none}
    .dm-feste-luci-dentro{position:relative;display:flex;align-items:center;gap:18px 26px;flex-wrap:wrap}
    .dm-feste-luci-testo{flex:1 1 280px;min-width:0}
    .dm-feste-cap{font-size:12px;font-weight:600;letter-spacing:5px;text-transform:uppercase;
      background:linear-gradient(180deg,#fff7d6 0%,#f5d27a 45%,#c9952e 100%);
      -webkit-background-clip:text;background-clip:text;color:transparent;width:max-content;max-width:100%}
    .dm-feste-titolo{margin-top:8px;font-size:22px;font-weight:600;line-height:1.25}
    .dm-feste-sotto{margin-top:4px;font-size:13px;opacity:.68}
    .dm-feste-tessere{display:flex;flex-wrap:wrap;gap:12px;justify-content:flex-end;flex:0 1 auto;min-width:0}
    .dm-feste-tessera{display:flex;align-items:center;gap:10px;width:142px;height:68px;padding:10px 12px;
      border-radius:16px;cursor:pointer;text-align:left;font:inherit;color:#fff;min-width:0;
      background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);
      transition:background .25s ease,box-shadow .25s ease,border-color .25s ease}
    .dm-feste-tessera.accesa{background:rgba(255,214,140,.14);border-color:rgba(255,214,140,.45);
      box-shadow:0 0 24px rgba(255,190,90,.25),inset 0 0 18px rgba(255,190,90,.12)}
    .dm-feste-tessera.muta{opacity:.5}
    .dm-feste-tessera.in-attesa{opacity:.7}
    .dm-feste-tessera:active{transform:scale(.98)}
    .dm-feste-tessera:focus-visible,.dm-feste-tutte:focus-visible{outline:2px solid #f5d27a;outline-offset:2px}
    .dm-feste-tessera-ic{font-size:24px;line-height:1;opacity:.5;flex:0 0 auto}
    .dm-feste-tessera.accesa .dm-feste-tessera-ic{opacity:1;filter:drop-shadow(0 0 8px rgba(255,200,110,.8))}
    .dm-feste-tessera-tx{display:grid;min-width:0}
    .dm-feste-tessera-tx b{font-size:14px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .dm-feste-tessera-tx small{font-size:12px;opacity:.55}
    .dm-feste-tessera.accesa .dm-feste-tessera-tx small{opacity:1;color:#fcd88a}
    .dm-feste-tutte{height:68px;padding:0 18px;border:0;border-radius:16px;cursor:pointer;font:inherit;
      font-weight:700;font-size:13.5px;background:rgba(255,255,255,.95);color:#0c2b1e;white-space:nowrap}
    .dm-feste-tutte.in-attesa{opacity:.7}
    .dm-feste-auguri{text-align:center;padding:26px 24px 22px}
    .dm-feste-auguri .dm-feste-cap{margin:0 auto}
    .dm-feste-auguri-titolo{margin-top:8px;font-family:"Inter Display",Inter,sans-serif;font-weight:200;
      font-size:44px;letter-spacing:-1px;line-height:1.05;
      background:linear-gradient(180deg,#fff7d6 0%,#f5d27a 45%,#c9952e 100%);
      -webkit-background-clip:text;background-clip:text;color:transparent}
    @media (max-width:700px){
      .dm-feste-luci{padding:20px 16px 16px}
      .dm-feste-titolo{font-size:19px}
      .dm-feste-tessere{display:grid;grid-template-columns:1fr 1fr;width:100%;gap:10px}
      .dm-feste-tessera{width:auto;height:60px}
      .dm-feste-tutte{grid-column:1/-1;height:48px}
      .dm-feste-auguri-titolo{font-size:32px}}
    @media (prefers-reduced-motion:reduce){.dm-feste-tessera{transition:none}}
  `;
}
