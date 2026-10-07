/* Le azioni rapide, in gruppi (#139).
 *
 * «Utilizzando la plancia per tutto questo periodo ho notato la necessità di
 * poter avere una divisione delle azioni rapide in gruppi (tapparelle luci
 * clima…).»
 *
 * In Home il gruppo è un titolo dentro il vassoio, largo quanto il vassoio:
 * il segno della sua prima azione, il nome, e quante sono accese — così si
 * legge anche da chiuso. Un tocco sul titolo chiude il gruppo e lo riapre, e
 * il telefono se lo ricorda: è una cosa di chi guarda, non della casa.
 *
 * I titoli stanno nella stessa griglia dei tasti e i tasti non si spostano:
 * chi li colora, chi ci disegna il simbolo e chi ci posa la copertina li
 * riconosce dalla posizione. L'ordine a vista lo dà `order`, e il perché sta
 * in `core/gruppi-delle-azioni.js`.
 *
 * Nel Config il gruppo si scrive accanto all'azione, nella sua riga, coi nomi
 * già usati proposti: scritto uguale, finisce nello stesso gruppo.
 */
import { azioneAccesa } from "../core/azione-accesa.js";
import {
  LUNGHEZZA_DEL_GRUPPO,
  conIlGruppo,
  gruppiChiusi,
  gruppiDelleAzioni,
  gruppoDellAzione,
  inverti,
  nomiDeiGruppi,
} from "../core/gruppi-delle-azioni.js";
import {
  allStates,
  clean,
  doc,
  esc,
  installStyle,
  paginaVisibile,
  quandoSiCambiaPagina,
  root,
  t,
  tieniIlBloccoNellaScheda,
  wrapFunction,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_AZIONI_GRUPPI__";
const STYLE_ID = "dm-azioni-gruppi-style";
const state = (root[KEY] ||= { installed: false });

/** Dove il telefono si ricorda i gruppi chiusi: sta lì, non va nella configurazione. */
export const CHIAVE_GRUPPI_CHIUSI = "dm_azioni_gruppi_chiusi";

const DATALIST_ID = "dm-qa-gruppi-nomi";

function azioniDelGuscio() {
  try {
    const elenco = root.getQuickActions?.();
    return Array.isArray(elenco) ? elenco : [];
  } catch (_errore) {
    return [];
  }
}

function leggiChiusi() {
  try {
    const scritto = JSON.parse(root.localStorage?.getItem?.(CHIAVE_GRUPPI_CHIUSI) || "[]");
    return Array.isArray(scritto) ? scritto : [];
  } catch (_errore) {
    return [];
  }
}

function scriviChiusi(elenco) {
  try {
    root.localStorage?.setItem?.(CHIAVE_GRUPPI_CHIUSI, JSON.stringify(elenco));
  } catch (_errore) {}
}

/* ── le parole del titolo ─────────────────────────────────────────────── */

/**
 * Cosa dice il titolo accanto al nome: quante sono accese, e da chiuso
 * quante azioni ci sono dentro — un gruppo chiuso che non dice niente è un
 * cassetto senza etichetta.
 */
export function contaDelGruppo(gruppo, chiuso = false) {
  const accese = Number(gruppo?.accese) || 0;
  if (accese === 1) return t("1 accesa", "1 on");
  if (accese > 1) return t(`${accese} accese`, `${accese} on`);
  if (!chiuso) return "";
  const quante = gruppo?.indici?.length || 0;
  if (quante === 1) return t("1 azione", "1 action");
  return t(`${quante} azioni`, `${quante} actions`);
}

/* ── la Home ──────────────────────────────────────────────────────────── */

/* Il segno del gruppo è quello della sua prima azione, preso dal tasto già
 * disegnato: il motore delle icone l'ha appena scelto, e sceglierlo una
 * seconda volta vorrebbe dire due segni per la stessa azione. Si prende solo
 * il disegno, senza i contrassegni del motore, che non deve credere di dover
 * vestire anche il titolo. */
function segnoDaTasto(tasto) {
  const disegno = tasto?.querySelector?.(".icon svg");
  if (disegno) {
    const copia = disegno.cloneNode(true);
    copia.setAttribute("width", "20");
    copia.setAttribute("height", "20");
    return copia.outerHTML;
  }
  const scritto = clean(
    tasto?.querySelector?.(".icon")?.dataset?.dmBeta12DisplayGlyph ||
      tasto?.querySelector?.(".icon")?.textContent,
  );
  return esc(scritto.slice(0, 4));
}

function titoloMarkup(gruppo, chiuso, segno) {
  const conta = contaDelGruppo(gruppo, chiuso);
  return `<span class="dm-qa-gruppo-segno" aria-hidden="true">${segno}</span>
    <span class="dm-qa-gruppo-nome">${esc(gruppo.nome)}</span>
    <span class="dm-qa-gruppo-conta" data-dm-qa-gruppo-accese="${gruppo.accese > 0}">${esc(conta)}</span>
    <span class="dm-qa-gruppo-freccia" aria-hidden="true">▾</span>`;
}

/** Mette i titoli dei gruppi nella griglia delle azioni. Torna quanti gruppi ci sono. */
export function raggruppa() {
  const griglia = doc?.getElementById?.("qa-grid");
  if (!griglia) return 0;
  const azioni = azioniDelGuscio();
  const states = allStates();
  const struttura = gruppiDelleAzioni(azioni, (azione) =>
    azioneAccesa(azione, states, root.resolveEntity),
  );
  const tasti = [...griglia.children].filter((nodo) => nodo.classList?.contains("qa-btn"));
  const titoli = [...griglia.querySelectorAll(":scope > .dm-qa-gruppo")];

  /* Nessun gruppo: la fila di oggi, e di quello che avevamo messo non resta niente. */
  if (!struttura.gruppi.length) {
    for (const titolo of titoli) titolo.remove();
    for (const tasto of tasti) {
      tasto.style.removeProperty("order");
      delete tasto.dataset.dmQaChiuso;
      delete tasto.dataset.dmQaGruppo;
    }
    delete griglia.dataset.dmQaGruppi;
    return 0;
  }

  /* Si scrive solo quello che cambia: questo giro passa a ogni mazzetto di
   * stati, e riscrivere uguale lo stile di ogni tasto costa un ricalcolo della
   * pagina per non cambiare niente. */
  const metti = (nodo, campo, valore) => {
    if (valore === undefined) {
      if (campo in nodo.dataset) delete nodo.dataset[campo];
    } else if (nodo.dataset[campo] !== valore) nodo.dataset[campo] = valore;
  };
  const ordina = (nodo, valore) => {
    if (nodo.style.order !== valore) nodo.style.order = valore;
  };
  metti(griglia, "dmQaGruppi", String(struttura.gruppi.length));
  const chiusi = gruppiChiusi(leggiChiusi(), struttura.gruppi);
  const gruppoDi = new Map();
  for (const gruppo of struttura.gruppi)
    for (const indice of gruppo.indici) gruppoDi.set(indice, gruppo);

  tasti.forEach((tasto, indice) => {
    ordina(tasto, String(struttura.ordine.tasti[indice] ?? indice));
    const gruppo = gruppoDi.get(indice);
    metti(tasto, "dmQaGruppo", gruppo?.chiave);
    metti(tasto, "dmQaChiuso", gruppo && chiusi.has(gruppo.chiave) ? "true" : undefined);
  });

  const presenti = new Set(struttura.gruppi.map((gruppo) => gruppo.chiave));
  for (const titolo of titoli) if (!presenti.has(titolo.dataset.dmQaTitolo)) titolo.remove();

  struttura.gruppi.forEach((gruppo, posto) => {
    let titolo = griglia.querySelector(
      `:scope > .dm-qa-gruppo[data-dm-qa-titolo="${CSS.escape(gruppo.chiave)}"]`,
    );
    if (!titolo) {
      titolo = doc.createElement("button");
      titolo.type = "button";
      titolo.className = "dm-qa-gruppo";
      titolo.dataset.dmQaTitolo = gruppo.chiave;
      griglia.append(titolo);
    }
    const chiuso = chiusi.has(gruppo.chiave);
    const segno = segnoDaTasto(tasti[gruppo.indici[0]]);
    const { nome } = gruppo;
    /* Si riscrive solo quando cambia qualcosa: a ogni mazzetto di stati il
     * titolo sotto il dito non deve rinascere. */
    const firma = [nome, gruppo.accese, gruppo.indici.length, chiuso, segno].join("|");
    if (titolo.dataset.dmQaFirma !== firma) {
      titolo.dataset.dmQaFirma = firma;
      titolo.innerHTML = titoloMarkup(gruppo, chiuso, segno);
      titolo.setAttribute("aria-expanded", String(!chiuso));
      titolo.setAttribute(
        "aria-label",
        chiuso
          ? t(`Apri il gruppo ${nome}`, `Open the ${nome} group`)
          : t(`Chiudi il gruppo ${nome}`, `Close the ${nome} group`),
      );
    }
    ordina(titolo, String(struttura.ordine.titoli[gruppo.chiave]));
    metti(titolo, "dmQaPrimo", String(posto === 0 && !struttura.senzaGruppo.length));
  });
  return struttura.gruppi.length;
}

function ripassa() {
  if (!paginaVisibile("page-home")) return;
  try {
    raggruppa();
  } catch (errore) {
    root.console?.warn?.("[DashboardModern] gruppi delle azioni", errore);
  }
}

function onClick(evento) {
  const titolo = evento.target?.closest?.("#qa-grid > .dm-qa-gruppo[data-dm-qa-titolo]");
  if (!titolo) return;
  evento.preventDefault();
  scriviChiusi(inverti(leggiChiusi(), titolo.dataset.dmQaTitolo));
  root.navigator?.vibrate?.(6);
  raggruppa();
}

/* ── il Config ────────────────────────────────────────────────────────── */

/* Le righe delle azioni nella scheda: quelle dell'elenco che sta sopra il
 * modulo per aggiungerne una. Sono nell'ordine delle azioni, come i tasti. */
function righeDelleAzioni() {
  const tipo = doc?.getElementById?.("ed-qa-type");
  const cassetto = tipo?.closest?.("details");
  const elenco = cassetto?.querySelector?.(".ed-list");
  if (!elenco) return { cassetto: null, righe: [] };
  return {
    cassetto,
    righe: [...elenco.children].filter((nodo) => nodo.classList?.contains("ed-row")),
  };
}

function datalistMarkup(nomi) {
  return nomi.map((nome) => `<option value="${esc(nome)}"></option>`).join("");
}

/** Mette la casella del gruppo accanto a ogni azione. Torna quante righe l'hanno. */
export function caselleDeiGruppi() {
  const { cassetto, righe } = righeDelleAzioni();
  if (!cassetto || !righe.length) return 0;
  const azioni = azioniDelGuscio();
  const nomi = nomiDeiGruppi(azioni);
  let elenco = doc.getElementById(DATALIST_ID);
  if (!elenco) {
    elenco = doc.createElement("datalist");
    elenco.id = DATALIST_ID;
    cassetto.querySelector(".ed-acc-body")?.append(elenco);
  }
  const opzioni = datalistMarkup(nomi);
  if (elenco.innerHTML !== opzioni) elenco.innerHTML = opzioni;

  righe.forEach((riga, indice) => {
    /* La casella sta in fondo alla riga, larga quanto lei: la riga è una
     * griglia di simbolo, nome e tasti, e nella colonna del nome una casella
     * diventava un bottone di quattro lettere. */
    let casella = riga.querySelector(":scope > .dm-qa-gruppo-campo [data-dm-qa-gruppo-indice]");
    if (!casella) {
      const etichetta = doc.createElement("label");
      etichetta.className = "dm-qa-gruppo-campo";
      etichetta.innerHTML = `<span>${esc(t("Gruppo", "Group"))}</span><input class="ed-input dm-qa-gruppo-riga" data-dm-qa-gruppo-indice="${indice}" list="${DATALIST_ID}" maxlength="${LUNGHEZZA_DEL_GRUPPO}" autocomplete="off" placeholder="${esc(t("es. Luci, Tapparelle", "e.g. Lights, Shutters"))}">`;
      riga.append(etichetta);
      if (riga.style.flexWrap !== "wrap") riga.style.flexWrap = "wrap";
      casella = etichetta.querySelector("input");
      casella.value = gruppoDellAzione(azioni[indice]);
    }
    casella.dataset.dmQaGruppoIndice = String(indice);
    /* Chi sta scrivendo non si vede cambiare la casella sotto le dita. */
    if (doc.activeElement !== casella) casella.value = gruppoDellAzione(azioni[indice]);
  });

  if (!cassetto.querySelector(".dm-qa-gruppi-aiuto")) {
    const aiuto = doc.createElement("small");
    aiuto.className = "dm-qa-gruppi-aiuto";
    aiuto.textContent = t(
      "Il gruppo è facoltativo: le azioni con lo stesso gruppo stanno insieme in Home, sotto un titolo che dice quante sono accese e che si chiude con un tocco. Senza gruppi resta una fila sola.",
      "The group is optional: actions with the same group sit together on Home, under a title that says how many are on and closes with a tap. Without groups it stays a single row.",
    );
    cassetto.querySelector(".ed-list")?.after(aiuto);
  }
  return righe.length;
}

/* Si salva al cambio, non a ogni lettera: «Lu», «Luc» sono gruppi di una
 * lettera che nessuno ha chiesto. Si riscrive la sola azione della riga, con
 * tutto il resto com'era. */
function onChange(evento) {
  const casella = evento.target?.closest?.("[data-dm-qa-gruppo-indice]");
  if (!casella) return;
  const indice = Number(casella.dataset.dmQaGruppoIndice);
  const azioni = azioniDelGuscio().slice();
  if (!Number.isInteger(indice) || !azioni[indice]) return;
  const prossima = conIlGruppo(azioni[indice], casella.value);
  if (gruppoDellAzione(prossima) === gruppoDellAzione(azioni[indice])) {
    casella.value = gruppoDellAzione(prossima);
    return;
  }
  azioni[indice] = prossima;
  writeJsonIfChanged("cd_quick_actions", azioni);
  casella.value = gruppoDellAzione(prossima);
  try {
    root.buildQuickActions?.();
  } catch (_errore) {}
  caselleDeiGruppi();
  root.edToast?.(t("💾 Gruppo salvato", "💾 Group saved"));
}

/* ── stile ────────────────────────────────────────────────────────────── */

function installStyles() {
  installStyle(
    STYLE_ID,
    `
      /* Il titolo di un gruppo: largo quanto il vassoio, sopra i suoi tasti.
         Le parole sono quelle dei titoli della Home — maiuscole spaziate,
         grigie — e il conto delle accese sta in fondo, dove l'occhio lo
         cerca. */
      html body #page-home .dm-vassoio #qa-grid>.dm-qa-gruppo{
        grid-column:1/-1;display:flex;align-items:center;gap:9px;
        width:100%;margin:10px 0 -2px;padding:4px 4px 2px;border:0;background:none;
        font:inherit;text-align:left;cursor:pointer;color:var(--text-dim,#64748b)}
      html body #page-home .dm-vassoio #qa-grid>.dm-qa-gruppo[data-dm-qa-primo="true"]{margin-top:0}
      html body #page-home .dm-vassoio #qa-grid>.dm-qa-gruppo:focus-visible{
        outline:2px solid var(--accent,#0ea5e9);outline-offset:2px;border-radius:10px}
      .dm-qa-gruppo-segno{display:grid;place-items:center;width:22px;height:22px;flex:0 0 22px;font-size:16px;line-height:1}
      .dm-qa-gruppo-segno svg{width:22px!important;height:22px!important}
      .dm-qa-gruppo-nome{
        min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
        font-size:11.5px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}
      .dm-qa-gruppo-conta{
        margin-left:auto;flex:0 0 auto;font-size:10.5px;font-weight:900;letter-spacing:.08em;
        text-transform:uppercase;font-variant-numeric:tabular-nums}
      .dm-qa-gruppo-conta[data-dm-qa-gruppo-accese="true"]{color:var(--text,#0f172a)}
      .dm-qa-gruppo-freccia{flex:0 0 auto;font-size:12px;transition:transform .18s ease}
      .dm-qa-gruppo[aria-expanded="false"] .dm-qa-gruppo-freccia{transform:rotate(-90deg)}
      html body #page-home .dm-vassoio #qa-grid>.qa-btn[data-dm-qa-chiuso="true"]{display:none!important}
      /* Nel Config: la casella del gruppo in fondo alla riga dell'azione, su
         tutta la sua larghezza — sia che la riga sia la griglia del motore
         delle icone, sia che sia ancora la fila del guscio. */
      #editor-modal .ed-row>.dm-qa-gruppo-campo,
      #ed-body .ed-row>.dm-qa-gruppo-campo{
        grid-column:1/-1!important;flex:1 0 100%;
        display:flex!important;align-items:center;gap:10px;min-width:0!important;margin:2px 0 0}
      #ed-body .dm-qa-gruppo-campo>span{
        flex:0 0 auto;font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;
        color:var(--text-dim,#64748b)}
      #editor-modal #ed-body .dm-qa-gruppo-campo>input{
        flex:1 1 auto!important;width:auto!important;min-width:0!important;max-width:none!important;
        height:40px!important;min-height:40px!important;margin:0!important;padding:0 12px!important;
        border-radius:12px!important;font-size:13.5px!important;text-align:left!important}
      #ed-body .dm-qa-gruppi-aiuto{
        display:block;margin:6px 2px 10px;font-size:11px;line-height:1.45;font-weight:600;
        color:var(--text-dim,#64748b)}
      @media(prefers-reduced-motion:reduce){.dm-qa-gruppo-freccia{transition:none}}
    `,
  );
}

export function installAzioniRapideGruppi() {
  if (state.installed || !doc?.getElementById) return false;
  state.installed = true;
  installStyles();
  /* Dopo chi disegna i tasti e dopo chi ci mette il simbolo: il segno del
   * titolo si prende dal tasto finito. */
  wrapFunction("buildQuickActions", "__dmGruppiAzioni", () => root.setTimeout?.(ripassa, 0));
  for (const evento of ["dashboardmodern:states-ready", "dashboardmodern:state-changed"])
    root.addEventListener?.(evento, ripassa);
  quandoSiCambiaPagina(ripassa);
  doc.addEventListener("click", onClick);
  doc.addEventListener("change", onChange);
  tieniIlBloccoNellaScheda("__dmGruppiAzioniConfig", caselleDeiGruppi);
  ripassa();
  return true;
}
