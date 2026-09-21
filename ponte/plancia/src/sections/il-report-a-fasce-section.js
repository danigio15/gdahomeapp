/* Il blocco «Come si divide il costo reale», in Panoramica (#72).
 *
 * «Fai un report fatto bene ma lo voglio prima vedere nella sezione report
 *  suddiviso sulle 3 fasce che mostra andamento e costi.»
 *
 * ── Dove sta, e perche' li' ───────────────────────────────────────────────
 *
 * La Panoramica racconta il mese in quest'ordine: le tre cifre grosse, il
 * bilancio dell'anno, la griglia finanziaria, i distintivi, l'autosufficienza,
 * l'andamento giornaliero. Il blocco delle fasce va SUBITO DOPO la griglia
 * finanziaria, e non e' una scelta di spazio: la griglia dice quanto hai
 * pagato — «Costo Reale», 12,47 € — e le fasce dicono com'e' fatto quel
 * numero. Attaccato sotto e' una spiegazione; dieci centimetri piu' giu'
 * sarebbe un'altra tessera che parla di un'altra cosa.
 *
 * ── Il conto e' esatto, e prima dicevo di no ──────────────────────────────
 *
 * Quando le fasce sono nate avevo scritto, in `fasce-della-tariffa.js`, che
 * sul periodo si poteva dare solo una stima perche' «la plancia sa quanti kWh
 * sono passati, non in che ore». Era una limitazione mia: il Recorder le ore
 * le tiene, e questa sezione gliele chiede — la stessa porta da cui passa la
 * quota di sole di un apparecchio, `leOreDalRecorder`, con la stessa memoria
 * dei mesi gia' chiusi.
 *
 * Resta una stima solo per le ore che il Recorder ha buttato (`purge_keep_days`
 * tiene il passo orario per un pugno di giorni), e il blocco lo dice a parole
 * invece di spacciare tutto per un conto. Vedi `il-report-delle-fasce.js`, che
 * fa il conto e non tocca ne' la rete ne' il documento.
 *
 * ── Chi scrive «Costo Reale» ──────────────────────────────────────────────
 *
 * Il padrone di quella casella resta `energy-report-polish-section.js`: e' lui
 * che la scrive a ogni pacchetto. Quando qui c'e' un conto esatto per lo
 * stesso mese, lui lo preferisce alla media pesata — glielo chiede con
 * `ilCostoAFasce()`, e questa sezione gli batte un colpo quando il conto e'
 * pronto. Due numeri diversi per la stessa spesa sulla stessa schermata
 * sarebbero il difetto peggiore di tutta la storia.
 */

import { DEFAULT_IMPORT_RATE } from "../core/energy-calculations.js";
import {
  CHIAVE_FASCE,
  leFasceValgono,
  nomeDellaFascia,
  normalizzaLeFasce,
  orarioDellaFascia,
  tintaDellaFascia,
} from "../core/fasce-della-tariffa.js";
import { reportDelleFasce } from "../core/il-report-delle-fasce.js";
import { periodRange } from "../core/period-service.js";
import {
  entitaDelleFonti,
  leOreDalRecorder,
  pianiDelleFonti,
  prezzoUnicoDiAcquisto,
  secchielliNellArco,
} from "./energy-section.js";
import {
  applyFinancialOverview,
  registraIlContoAFasce,
  renderActualDailyChart,
} from "./energy-report-polish-section.js";
import {
  clean,
  doc,
  esc,
  formatNumber,
  installStyle,
  locale,
  readJson,
  root,
  selectedPeriod,
  t,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_REPORT_A_FASCE__";
const state = (root[KEY] ||= {
  installed: false,
  inCorso: false,
  giro: 0,
  chiave: "",
  letto: 0,
  report: null,
  periodo: null,
});

/** Quanto si tiene buono un conto del mese in corso: un quarto d'ora. */
export const SCADENZA_DEL_CONTO_MS = 15 * 60_000;

function soldi(valore) {
  return `${formatNumber(Math.max(0, Number(valore) || 0), 2)} €`;
}

/* Il mese per esteso, nella lingua della PLANCIA.
 *
 * Non in quella del browser: su un tablet appeso al muro con Chrome in inglese
 * e la plancia in italiano usciva «September 2026» in mezzo a una riga
 * italiana. La lingua scelta la sa `locale()`, ed e' la stessa che decide
 * tutto il resto di questa schermata. */
function ilMesePerEsteso(periodo) {
  const quando = new Date(periodo.year, periodo.month - 1, 1);
  try {
    return quando.toLocaleDateString(locale(), { month: "long", year: "numeric" });
  } catch (_errore) {
    return `${periodo.month}/${periodo.year}`;
  }
}

/**
 * Il blocco, come markup.
 *
 * Non legge niente e non tocca niente: entrano il report, la configurazione e
 * il mese, esce il disegno. E' la parte che si puo' provare senza un browser.
 */
export function ilBloccoDelleFasce(report, config, periodo) {
  if (!report || !config?.voci?.length) return "";
  const quante = config.voci.length;
  const barra = report.fasce
    .filter((fascia) => fascia.quota > 0.05)
    .map(
      (fascia) =>
        `<span class="dm-fasce-fetta" style="width:${fascia.quota.toFixed(2)}%;background:${tintaDellaFascia(quante, fascia.indice)}" title="${esc(nomeDellaFascia(fascia.indice))} ${fascia.quota.toFixed(0)}%"></span>`,
    )
    .join("");

  const righe = report.fasce
    .map((fascia) => {
      const festiva =
        config.festivi === fascia.indice
          ? `<small class="dm-fasce-festivi">${esc(t("+ sabato e domenica", "+ Saturday and Sunday"))}</small>`
          : "";
      /* Una fascia senza il suo prezzo non deve sembrare una fascia che costa
       * come tutte le altre per scelta: lo dice, e dice da dove viene. */
      const ripiego = fascia.suo
        ? ""
        : `<small class="dm-fasce-ripiego">${esc(t("prezzo unico", "single rate"))}</small>`;
      return `
        <div class="dm-fasce-riga">
          <span class="dm-fasce-nome" style="--dm-fascia:${tintaDellaFascia(quante, fascia.indice)}">${esc(nomeDellaFascia(fascia.indice))}</span>
          <span class="dm-fasce-ore">${esc(orarioDellaFascia(config, fascia.indice))}${festiva}</span>
          <span class="dm-fasce-kwh">${formatNumber(fascia.kwh, 1)} kWh</span>
          <span class="dm-fasce-quota">${formatNumber(fascia.quota, 0)}%</span>
          <span class="dm-fasce-prezzo">${formatNumber(fascia.prezzo, 3)} €/kWh${ripiego}</span>
          <span class="dm-fasce-euro">${soldi(fascia.euro)}</span>
        </div>`;
    })
    .join("");

  /* Il confronto che risponde alla domanda vera: le fasce mi convengono? Sugli
   * stessi kilowattora, col prezzo unico scritto nella stessa scheda.
   *
   * Le frasi sono INTERE, non pezzi incollati attorno a un numero: «in meno
   * di una tariffa unica» e' una frase in tutte le lingue, «in meno di» piu'
   * «una tariffa unica» lo e' solo in quelle che mettono le parole nello
   * stesso ordine dell'italiano. */
  let confronto = "";
  if (report.unico) {
    const meglio = report.risparmio > 0.005;
    const peggio = report.risparmio < -0.005;
    const verso = meglio
      ? t("in meno di una tariffa unica", "less than a single rate")
      : peggio
        ? t("in più di una tariffa unica", "more than a single rate")
        : t("come una tariffa unica", "the same as a single rate");
    confronto = `
      <div class="dm-fasce-confronto" data-verso="${meglio ? "meglio" : peggio ? "peggio" : "pari"}">
        <span aria-hidden="true">${meglio ? "💰" : peggio ? "⚠️" : "⚖️"}</span>
        <span>${meglio || peggio ? `<b>${esc(soldi(Math.abs(report.risparmio)))}</b> ` : ""}${esc(verso)} <small>${esc(t("Con una tariffa unica", "With a single rate"))} ${formatNumber(report.unico.prezzo, 3)} €/kWh → ${soldi(report.unico.euro)}</small></span>
      </div>`;
  }

  /* Quanta parte e' misurata e quanta e' stimata: chi legge deve saperlo. */
  const nota = report.tuttoMisurato
    ? `<span aria-hidden="true">✅</span> ${esc(t("Misurato ora per ora su tutto il mese.", "Measured hour by hour for the whole month."))}`
    : `<span aria-hidden="true">ℹ️</span> ${esc(t("Misurato ora per ora:", "Measured hour by hour:"))} <b>${formatNumber(report.misurato.kwh, 1)} kWh</b>. ${esc(t("Le ore più vecchie Home Assistant non le tiene.", "Home Assistant does not keep the oldest hours."))} ${esc(t("Stimati alla media delle fasce:", "Estimated at the average of the bands:"))} <b>${formatNumber(report.stimato.kwh, 1)} kWh</b> (${formatNumber(report.stimato.prezzo, 3)} €/kWh).`;

  return `
    <div class="dm-fasce-testata">
      <div class="dm-fasce-titolo">🕐 ${esc(t("Come si divide il costo reale", "How the real cost breaks down"))}</div>
      <div class="dm-fasce-totale"><b>${soldi(report.euro)}</b> <small>${formatNumber(report.kwh, 1)} kWh ${esc(t("dalla rete", "from grid"))} · ${esc(ilMesePerEsteso(periodo))}</small></div>
    </div>
    <div class="dm-fasce-barra">${barra}</div>
    <div class="dm-fasce-griglia">${righe}</div>
    ${confronto}
    <div class="dm-fasce-nota">${nota}</div>`;
}

/**
 * Il profilo delle ventiquattro ore, come markup.
 *
 * Risponde all'altra domanda dietro le fasce. Quanto costa si legge in
 * bolletta; a che ora si compra no, e sapendolo si decide — la lavastoviglie
 * alle undici di sera invece che alle quattro del pomeriggio, l'auto in carica
 * dopo mezzanotte. Ventiquattro colonne, alte quanto i kilowattora presi dalla
 * rete in quell'ora di tutto il mese, colorate come la fascia che le copre.
 *
 * Sta in ANALISI e non in Panoramica, e non e' una questione di spazio: la
 * Panoramica dice com'e' andato il mese, l'Analisi dice perche'. Qui si viene
 * per capire dove intervenire, e questa e' l'unica tessera che lo dice a
 * un'ora precisa.
 *
 * Le colonne non hanno numeri sopra: ventiquattro numeri da quattro cifre non
 * si leggono. Il numero sta sotto, e riguarda l'ora che conta — quella in cui
 * si compra di piu' — perche' e' da quella che si comincia a spostare.
 */
export function ilProfiloDelleOre(report, config) {
  const ore = report?.ore;
  if (!Array.isArray(ore) || !ore.length) return "";
  const quante = config?.voci?.length || 0;
  const massimo = ore.reduce((alto, ora) => Math.max(alto, ora.kwh), 0);
  if (!(massimo > 0)) return "";

  const colonne = ore
    .map((ora) => {
      const alta = Math.max(2, Math.round((ora.kwh / massimo) * 100));
      const tinta = ora.fascia >= 0 ? tintaDellaFascia(quante, ora.fascia) : "#94a3b8";
      const nome = ora.fascia >= 0 ? nomeDellaFascia(ora.fascia) : "";
      return `<span class="dm-profilo-colonna" style="height:${alta}%;background:${tinta}" title="${String(ora.ora).padStart(2, "0")}:00 ${esc(nome)} · ${formatNumber(ora.kwh, 2)} kWh · ${soldi(ora.euro)}"></span>`;
    })
    .join("");

  /* Le tacche: ogni tre ore, che e' la piu' fitta che si legge su un telefono
   * senza sovrapporsi. */
  const tacche = [0, 3, 6, 9, 12, 15, 18, 21]
    .map((ora) => `<span>${String(ora).padStart(2, "0")}</span>`)
    .join("");

  const pallini = (config?.voci || [])
    .map(
      (_voce, indice) =>
        `<span class="dm-profilo-voce"><i style="background:${tintaDellaFascia(quante, indice)}"></i>${esc(nomeDellaFascia(indice))} ${esc(orarioDellaFascia(config, indice))}</span>`,
    )
    .join("");

  const punta = ore.reduce((alta, ora) => (ora.kwh > alta.kwh ? ora : alta), ore[0]);
  const nomePunta = punta.fascia >= 0 ? `${nomeDellaFascia(punta.fascia)} · ` : "";
  const dettaglio = `${String(punta.ora).padStart(2, "0")}:00 · ${nomePunta}${formatNumber(punta.kwh, 1)} kWh · ${soldi(punta.euro)}`;

  return `
    <div class="dm-profilo-testata">
      <div class="dm-profilo-titolo">🕐 ${esc(t("A che ora compri dalla rete", "When you buy from the grid"))}</div>
      <div class="dm-profilo-legenda">${pallini}</div>
    </div>
    <div class="dm-profilo-grafico">${colonne}</div>
    <div class="dm-profilo-tacche">${tacche}</div>
    <div class="dm-profilo-punta">
      <span>${esc(t("L'ora in cui compri di più", "The hour you buy most"))}</span>
      <b>${esc(dettaglio)}</b>
    </div>`;
}

/* ── il giro alla rete ─────────────────────────────────────────────────── */

function laConfigurazione() {
  return normalizzaLeFasce(readJson(CHIAVE_FASCE, {}));
}

/* C'e' qualcuno che sta guardando il Report?
 *
 * La domanda e' sul REPORT, non sulla linguetta: il blocco del costo sta in
 * Panoramica e il profilo delle ore in Analisi, e sono lo stesso conto. Se si
 * guardasse solo la Panoramica, chi apre il Report direttamente su Analisi non
 * vedrebbe mai il profilo — e' proprio la meta' che si trova li'.
 *
 * `checkVisibility` e' la domanda giusta e la sanno i browser di oggi; dove non
 * c'e' basta `offsetParent`, che su una vista nascosta — `display: none`, che
 * e' come il guscio nasconde le viste — e' vuoto. */
function ilReportSiVede() {
  const vista = doc?.getElementById("view-panoramica");
  if (!vista) return false;
  if (typeof vista.checkVisibility === "function") return Boolean(vista.checkVisibility());
  return Boolean(vista.offsetParent);
}

function ilBlocco(crea = false) {
  const griglia = doc?.querySelector("#ed-pane-panoramica .ed-fin-grid");
  if (!griglia) return null;
  let blocco = doc.getElementById("dm-fasce-report");
  if (!blocco) {
    if (!crea) return null;
    blocco = doc.createElement("div");
    blocco.id = "dm-fasce-report";
    blocco.className = "dm-fasce-report";
  }
  /* Sempre subito dopo la griglia finanziaria, anche quando il guscio
   * ridisegna la Panoramica e rimette i figli al loro posto. */
  if (blocco.previousElementSibling !== griglia) griglia.after(blocco);
  return blocco;
}

/* Il profilo va fra il confronto settimanale e l'elenco dei dispositivi, ed e'
 * l'ordine del racconto: il confronto dice se hai usato piu' o meno, il profilo
 * dice QUANDO, l'elenco dice COSA. */
function ilProfilo(crea = false) {
  const prima = doc?.querySelector("#ed-pane-analisi .ed-weekly-card");
  if (!prima) return null;
  let riquadro = doc.getElementById("dm-fasce-profilo");
  if (!riquadro) {
    if (!crea) return null;
    riquadro = doc.createElement("div");
    riquadro.id = "dm-fasce-profilo";
    riquadro.className = "dm-fasce-profilo";
  }
  if (riquadro.previousElementSibling !== prima) prima.after(riquadro);
  return riquadro;
}

function togliIlBlocco() {
  doc?.getElementById("dm-fasce-report")?.remove();
  doc?.getElementById("dm-fasce-profilo")?.remove();
  state.report = null;
  state.chiave = "";
}

/** La chiave di un conto: stessa entita', stesso mese, stesso prezzo unico. */
function chiaveDelConto(entita, periodo, unico) {
  return `${entita}~${periodo.year}-${periodo.month}~${unico}`;
}

/** Il conto esatto in mano adesso, per chi scrive «Costo Reale». */
export function ilCostoAFasce(periodo = selectedPeriod()) {
  if (!state.report || !state.periodo) return null;
  if (state.periodo.year !== periodo.year || state.periodo.month !== periodo.month) return null;
  return { euro: state.report.euro, kwh: state.report.kwh, report: state.report };
}

function disegnaIlProfilo(report, config) {
  const markup = report ? ilProfiloDelleOre(report, config) : "";
  const riquadro = ilProfilo(Boolean(markup));
  if (!riquadro) return false;
  if (!markup) {
    riquadro.remove();
    return false;
  }
  riquadro.innerHTML = markup;
  riquadro.dataset.dmFasce = String(config.voci.length);
  return true;
}

function disegna(report, config, periodo) {
  /* Il profilo vive nell'altra linguetta e ha il suo posto: si disegna sempre,
   * anche a linguetta chiusa, cosi' chi ci arriva lo trova gia' li' invece di
   * vederlo comparire un attimo dopo. */
  disegnaIlProfilo(report, config);
  const blocco = ilBlocco(Boolean(report));
  if (!blocco) return false;
  if (!report) {
    blocco.remove();
    return false;
  }
  blocco.innerHTML = ilBloccoDelleFasce(report, config, periodo);
  blocco.dataset.dmFasce = String(config.voci.length);
  blocco.dataset.dmFasceMisurato = report.tuttoMisurato ? "tutto" : "in-parte";
  return true;
}

/**
 * Chiede le ore del mese scelto e rifa' il conto.
 *
 * Una domanda sola, per una entita' sola — il contatore di quello che si
 * prende dalla rete — a grana oraria sul mese: settecento righe, la stessa
 * misura della quota di sole di un apparecchio, e dalla stessa porta, che i
 * mesi chiusi se li tiene da parte. Il mese in corso si rifa' al massimo ogni
 * quarto d'ora, e solo se c'e' qualcuno che guarda la Panoramica.
 */
export async function aggiornaIlReportDelleFasce(bundle, { forza = false } = {}) {
  if (!doc) return false;
  const config = laConfigurazione();
  if (!leFasceValgono(config)) {
    togliIlBlocco();
    return false;
  }
  if (!forza && !ilReportSiVede()) return false;

  const periodo = selectedPeriod();
  const fonti = pianiDelleFonti("month");
  const { rete } = entitaDelleFonti(fonti);
  if (!rete) {
    togliIlBlocco();
    return false;
  }
  const unico = prezzoUnicoDiAcquisto() || DEFAULT_IMPORT_RATE;
  const chiave = chiaveDelConto(rete, periodo, unico);
  const fresco = chiave === state.chiave && Date.now() - state.letto < SCADENZA_DEL_CONTO_MS;
  if (!forza && fresco && state.report) return disegna(state.report, config, periodo);
  if (state.inCorso) return false;

  const giro = ++state.giro;
  state.inCorso = true;
  try {
    const unita = Object.fromEntries(
      fonti.filter((piano) => piano.entity).map((piano) => [piano.entity, piano.unita || ""]),
    );
    const arco = periodRange("month", new Date(periodo.year, periodo.month - 1, 1), new Date());
    const pezzo = { ...arco, kind: "month", period: "hour" };
    const righe = await leOreDalRecorder([rete], pezzo, unita);
    if (giro !== state.giro) return false;
    const ore = secchielliNellArco(righe?.[rete], pezzo);
    /* Il totale del mese arriva dal pacchetto, che lo sa per un'altra strada:
     * e' lo stesso numero che la griglia qui sopra chiama «dalla rete», ed e'
     * quello che rende visibile la differenza fra le ore che ci sono e i
     * kilowattora che il mese ha davvero avuto. */
    const totale = Number(bundle?.month?.gridImport);
    const report = reportDelleFasce(ore, config, {
      prezzoUnico: unico,
      totale: Number.isFinite(totale) ? totale : null,
    });
    state.report = report;
    state.periodo = periodo;
    state.chiave = chiave;
    state.letto = Date.now();
    const disegnato = disegna(report, config, periodo);
    /* Adesso il Report puo' dire due cose che prima non sapeva, e le dice lui:
     * «Costo Reale» diventa la spesa esatta invece della stima, e le colonne
     * dell'andamento giornaliero si dividono nei colori delle fasce. Le due
     * cose restano sue — qui non si scrive ne' in quella casella ne' in quel
     * grafico — e il conto glielo si porta col lettore lasciato all'avvio. */
    if (report) {
      if (bundle?.month) applyFinancialOverview(bundle);
      const giorni = new Date(periodo.year, periodo.month, 0).getDate();
      renderActualDailyChart(giorni, periodo.month, periodo.year);
    }
    return disegnato;
  } catch (errore) {
    if (giro === state.giro) {
      root.console?.warn?.("[dashboardmodern] ore non lette per il report a fasce", errore);
      togliIlBlocco();
    }
    return false;
  } finally {
    if (giro === state.giro) state.inCorso = false;
  }
}

function foglio() {
  installStyle(
    "dm-report-a-fasce-style",
    `
      .dm-fasce-report{margin:0 0 18px!important;padding:16px 18px!important;border-radius:20px!important;background:var(--card-background-color,#fff)!important;border:1px solid var(--divider-color,#e2e8f0)!important;display:grid!important;gap:13px!important}
      .dm-fasce-testata{display:flex!important;align-items:baseline!important;justify-content:space-between!important;gap:12px!important;flex-wrap:wrap!important}
      .dm-fasce-titolo{font-size:14px!important;font-weight:900!important;color:var(--primary-text-color,#0f172a)!important}
      .dm-fasce-totale{font-size:15px!important;font-weight:900!important;color:#f97316!important}
      .dm-fasce-totale small{display:block!important;font-size:11px!important;font-weight:700!important;color:var(--secondary-text-color,#64748b)!important}
      .dm-fasce-barra{display:flex!important;height:14px!important;border-radius:999px!important;overflow:hidden!important;background:var(--secondary-background-color,#eef2f7)!important}
      .dm-fasce-fetta{display:block!important;height:100%!important}
      .dm-fasce-griglia{display:grid!important;gap:6px!important}
      .dm-fasce-riga{display:grid!important;grid-template-columns:34px minmax(96px,1fr) 88px 52px 104px 82px!important;align-items:center!important;gap:10px!important;font-size:12px!important}
      .dm-fasce-nome{display:inline-grid!important;place-items:center!important;height:24px!important;border-radius:8px!important;background:var(--dm-fascia,#94a3b8)!important;color:#fff!important;font-size:11px!important;font-weight:900!important}
      .dm-fasce-ore{color:var(--secondary-text-color,#64748b)!important;font-weight:800!important}
      .dm-fasce-ore small,.dm-fasce-prezzo small{display:block!important;font-size:10px!important;font-weight:700!important;opacity:.8!important}
      .dm-fasce-kwh,.dm-fasce-euro{text-align:right!important;font-weight:900!important;color:var(--primary-text-color,#0f172a)!important}
      .dm-fasce-quota{text-align:right!important;font-weight:800!important;color:var(--secondary-text-color,#64748b)!important}
      .dm-fasce-prezzo{text-align:right!important;font-weight:700!important;color:var(--secondary-text-color,#64748b)!important}
      .dm-fasce-confronto{display:flex!important;align-items:center!important;gap:9px!important;padding:10px 12px!important;border-radius:13px!important;background:color-mix(in srgb,var(--secondary-text-color,#64748b) 8%,transparent)!important;font-size:12.5px!important;font-weight:800!important;color:var(--primary-text-color,#0f172a)!important}
      .dm-fasce-confronto[data-verso="meglio"]{background:color-mix(in srgb,var(--success-color,#10b981) 11%,transparent)!important}
      .dm-fasce-confronto[data-verso="peggio"]{background:color-mix(in srgb,var(--warning-color,#f59e0b) 13%,transparent)!important}
      .dm-fasce-confronto small{display:block!important;font-size:11px!important;font-weight:700!important;color:var(--secondary-text-color,#64748b)!important}
      .dm-fasce-nota{font-size:11px!important;line-height:1.5!important;color:var(--secondary-text-color,#64748b)!important}
      /* Sul telefono la riga sta su due piani invece che su sei colonne: sopra
       * la fascia col suo orario e i kilowattora, sotto la quota, il prezzo e
       * gli euro. La pastiglia della fascia tiene tutte e due le righe, cosi'
       * si capisce a colpo d'occhio dove finisce una fascia e comincia
       * l'altra. */
      .dm-fasce-profilo{margin:0 0 16px!important;padding:16px 18px!important;border-radius:20px!important;background:var(--card-background-color,#fff)!important;border:1px solid var(--divider-color,#e2e8f0)!important;display:grid!important;gap:9px!important}
      .dm-profilo-testata{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important;flex-wrap:wrap!important}
      .dm-profilo-titolo{font-size:14px!important;font-weight:900!important;color:var(--primary-text-color,#0f172a)!important}
      .dm-profilo-legenda{display:flex!important;gap:12px!important;flex-wrap:wrap!important;font-size:11px!important;font-weight:800!important;color:var(--secondary-text-color,#64748b)!important}
      .dm-profilo-voce{display:inline-flex!important;align-items:center!important;gap:5px!important}
      .dm-profilo-voce i{display:block!important;width:9px!important;height:9px!important;border-radius:999px!important}
      .dm-profilo-grafico{display:grid!important;grid-template-columns:repeat(24,1fr)!important;align-items:end!important;gap:3px!important;height:96px!important;padding:0 1px!important}
      .dm-profilo-colonna{display:block!important;width:100%!important;border-radius:4px 4px 2px 2px!important;min-height:2px!important}
      .dm-profilo-tacche{display:grid!important;grid-template-columns:repeat(8,1fr)!important;font-size:10px!important;font-weight:800!important;color:var(--secondary-text-color,#64748b)!important;opacity:.75!important}
      .dm-profilo-punta{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;flex-wrap:wrap!important;padding:9px 12px!important;border-radius:13px!important;background:var(--secondary-background-color,#eef2f7)!important;font-size:12px!important;font-weight:800!important;color:var(--secondary-text-color,#64748b)!important}
      .dm-profilo-punta b{color:var(--primary-text-color,#0f172a)!important}
      @media (max-width:760px){
        .dm-profilo-grafico{height:78px!important;gap:2px!important}
        .dm-profilo-punta{flex-direction:column!important;align-items:flex-start!important;gap:2px!important}
        .dm-fasce-riga{grid-template-columns:34px minmax(0,1fr) auto auto!important;gap:3px 10px!important}
        .dm-fasce-nome{grid-column:1!important;grid-row:1/3!important;align-self:start!important}
        .dm-fasce-ore{grid-column:2!important;grid-row:1!important}
        .dm-fasce-kwh{grid-column:3/5!important;grid-row:1!important}
        .dm-fasce-quota{grid-column:2!important;grid-row:2!important;text-align:left!important}
        .dm-fasce-prezzo{grid-column:3!important;grid-row:2!important}
        .dm-fasce-euro{grid-column:4!important;grid-row:2!important}
      }
    `,
  );
}

function agganci() {
  if (state.installed) return;
  state.installed = true;
  root.addEventListener?.("dashboardmodern:period-bundle", (evento) => {
    aggiornaIlReportDelleFasce(evento?.detail);
  });
  /* Chi cambia linguetta trova il suo pezzo gia' pronto — il conto e' in
   * memoria — ma il guscio puo' aver ridisegnato il pannello nel frattempo, e
   * allora il blocco e il profilo vanno rimessi al loro posto. Tutte e due le
   * linguette, perche' il conto e' lo stesso e i pezzi sono uno per parte. */
  doc?.addEventListener(
    "click",
    (evento) => {
      if (!evento.target?.closest?.("#ed-tab-pan,#ed-tab-ana")) return;
      root.setTimeout?.(
        () => aggiornaIlReportDelleFasce(root.__DASHBOARDMODERN_RUNTIME_ROOT__?.bundle),
        0,
      );
    },
    true,
  );
}

export function installReportAFasceSection() {
  if (!doc) return;
  /* Il padrone di «Costo Reale» adesso sa a chi chiedere il conto esatto. */
  registraIlContoAFasce(ilCostoAFasce);
  foglio();
  agganci();
  const bundle = root.__DASHBOARDMODERN_RUNTIME_ROOT__?.bundle;
  if (bundle?.month) aggiornaIlReportDelleFasce(bundle);
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installReportAFasceSection, { once: true });
else installReportAFasceSection();
