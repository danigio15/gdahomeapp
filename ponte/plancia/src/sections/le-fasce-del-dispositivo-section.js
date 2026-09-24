/* In quale fascia consuma questo apparecchio, nella sua scheda (#111).
 *
 * «Mi aggiungi anche nel dispositivo le fasce per capire quanto quel
 * dispositivo assorbe di più e in quale fascia.»
 *
 * Il Report lo dice gia' per tutta la casa, in Panoramica. Ma la casa e' la
 * somma di tutto, e sapere che il 60% del mese e' passato in F3 non dice
 * quale apparecchio ce l'ha messo. La domanda utile e' l'altra — la wallbox,
 * il boiler, la lavatrice: ognuno in quale fascia pesa — perche' da li' si
 * decide cosa spostare, e spostare e' l'unica cosa che si puo' fare davvero.
 *
 * ── Dove sta, e perche' li' ───────────────────────────────────────────────
 *
 * Sotto le due tessere dell'anno, in fondo alla scheda del dispositivo. Non
 * in cima: chi apre quella scheda viene per il numero grande — quanti
 * kilowattora, quanto costano — e la divisione in fasce e' la risposta alla
 * domanda DOPO, quella che ci si fa guardando il numero grande.
 *
 * ── Il pannello e' stretto, e non solo al telefono ────────────────────────
 *
 * Le sei colonne del blocco della Panoramica qui non ci stanno nemmeno su un
 * tablet: la scheda del dispositivo vive dentro un pannello con dei margini
 * suoi, ed e' molto piu' stretta della pagina. La riga sta su due piani
 * SEMPRE, per il contenitore e non per la finestra — una media query guarda
 * lo schermo, e lo schermo qui non c'entra niente.
 *
 * ── Quando si chiede, e quanto costa ──────────────────────────────────────
 *
 * Sono settecento secchielli orari per tre entita': la stessa fetta di
 * database da cui esce gia' la quota di sole dello stesso apparecchio, e
 * infatti si chiede con la stessa mano (`leOreDalRecorder`, che i mesi chiusi
 * se li tiene da parte). Si chiede SOLO a scheda aperta e SOLO per
 * l'apparecchio scelto: chiederle per ogni riga del Report a ogni giro
 * vorrebbe dire mettere in ginocchio il Recorder per dei numeri che nessuno
 * sta guardando.
 *
 * Il conto vero non e' qui: sta in `core/le-fasce-del-dispositivo.js`, che
 * non tocca ne' la rete ne' l'orologio. Qui c'e' solo il giro.
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
import { leFasceDelDispositivo } from "../core/le-fasce-del-dispositivo.js";
import { periodRange } from "../core/period-service.js";
import {
  entitaDelleFonti,
  leOreDalRecorder,
  pianiDelleFonti,
  prezzoUnicoDiAcquisto,
  secchielliNellArco,
} from "./energy-section.js";
import {
  clean,
  doc,
  esc,
  formatNumber,
  installStyle,
  readJson,
  root,
  selectedPeriod,
  t,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_FASCE_DEL_DISPOSITIVO__";
const state = (root[KEY] ||= {
  installed: false,
  inCorso: false,
  /* Qualcuno ha chiesto mentre si aspettava: appena torna la risposta si
   * riparte. Vedi il giro alla rete, piu' sotto. */
  dopo: false,
  giro: 0,
  chiave: "",
  letto: 0,
  detto: null,
});

/* Un mese in corso si rifa' al massimo ogni quarto d'ora: e' la stessa
 * scadenza della quota di sole dello stesso apparecchio, e per la stessa
 * ragione — la proporzione si sposta a ogni notte di ricarica, il totale no. */
const SCADENZA_MS = 15 * 60_000;

const soldi = (valore) => `${formatNumber(valore, 2)} €`;

/* ── il disegno ────────────────────────────────────────────────────────── */

/**
 * Il blocco, come markup.
 *
 * Non legge niente e non tocca niente: entrano il conto, la configurazione e
 * il nome dell'apparecchio, esce il disegno. E' la parte che si puo' provare
 * senza un browser.
 */
export function ilBloccoDelDispositivo(detto, config, nome = "") {
  if (!detto || !config?.voci?.length) return "";
  const quante = config.voci.length;

  const barra = detto.fasce
    .filter((fascia) => fascia.quota > 0.05)
    .map(
      (fascia) =>
        `<span class="dm-fasce-fetta" style="width:${fascia.quota.toFixed(2)}%;background:${tintaDellaFascia(quante, fascia.indice)}" title="${esc(nomeDellaFascia(fascia.indice))} ${fascia.quota.toFixed(0)}%"></span>`,
    )
    .join("");

  const righe = detto.fasce
    .map((fascia) => {
      const ripiego = fascia.suo
        ? ""
        : `<small class="dm-fasce-ripiego">${esc(t("prezzo unico", "single rate"))}</small>`;
      return `
        <div class="dm-fasce-riga">
          <span class="dm-fasce-nome" style="--dm-fascia:${tintaDellaFascia(quante, fascia.indice)}">${esc(nomeDellaFascia(fascia.indice))}</span>
          <span class="dm-fasce-ore">${esc(orarioDellaFascia(config, fascia.indice))}</span>
          <span class="dm-fasce-kwh">${formatNumber(fascia.kwh, 1)} kWh</span>
          <span class="dm-fasce-quota">${formatNumber(fascia.quota, 0)}%</span>
          <span class="dm-fasce-prezzo">${formatNumber(fascia.prezzo, 3)} €/kWh${ripiego}</span>
          <span class="dm-fasce-euro">${soldi(fascia.euro)}</span>
        </div>`;
    })
    .join("");

  /* La risposta a parole, che e' la domanda che ha chiesto questo blocco.
   *
   * Una ETICHETTA e i suoi valori, non una frase spezzata attorno a un
   * numero. «F3 è la fascia in cui assorbe di più: 83% di quello che prende»
   * sembra innocente in italiano e si smonta in tredici lingue — «è la fascia
   * in cui assorbe di più» e «di quello che prende» non sono frasi, sono due
   * pezzi che tornano insieme solo dove le parole stanno nello stesso ordine
   * dell'italiano. Qui la parte tradotta e' un'etichetta intera, e i numeri le
   * stanno accanto senza entrarci dentro. */
  const meglio = detto.risparmio !== null && detto.risparmio > 0.005;
  const peggio = detto.risparmio !== null && detto.risparmio < -0.005;

  /* E quanto vale, in soldi, caricare in quell'ora invece che a caso.
   *
   * L'emoji del sacchetto promette un numero: senza scriverlo, la riga dice
   * «guarda che risparmi» e non dice quanto. Le tre frasi sono INTERE e sono
   * le stesse del blocco della casa — «in meno di una tariffa unica» e' una
   * frase in tutte le lingue, «in meno di» piu' «una tariffa unica» lo e'
   * solo dove le parole stanno nell'ordine dell'italiano — e qui si
   * riusano invece di riscriverle: sono la stessa cosa detta dello stesso
   * confronto. */
  const verso = meglio
    ? t("in meno di una tariffa unica", "less than a single rate")
    : peggio
      ? t("in più di una tariffa unica", "more than a single rate")
      : t("come una tariffa unica", "the same as a single rate");
  const confronto = detto.unico
    ? `<small><b>${esc(meglio || peggio ? soldi(Math.abs(detto.risparmio)) : "")}</b> ${esc(verso)} — ${formatNumber(detto.unico.prezzo, 3)} €/kWh → ${soldi(detto.unico.euro)}</small>`
    : "";
  const punta = `
    <div class="dm-fasce-confronto" data-verso="${meglio ? "meglio" : peggio ? "peggio" : "pari"}">
      <span aria-hidden="true">${meglio ? "💰" : peggio ? "⚠️" : "🕐"}</span>
      <span>${esc(t("La fascia in cui assorbe di più:", "The band it draws most in:"))} <b>${esc(nomeDellaFascia(detto.punta.indice))}</b> · <b>${formatNumber(detto.punta.quota, 0)}%</b>${confronto}</span>
    </div>`;

  /* Il profilo delle ventiquattro ore: a che ora si attacca. Le colonne non
   * hanno numeri sopra — ventiquattro numeri non si leggono — e il colore e'
   * quello della fascia, come nel profilo della casa. */
  const massimo = detto.ore.reduce((alto, ora) => Math.max(alto, ora.kwh), 0);
  const colonne = massimo
    ? detto.ore
        .map((ora) => {
          const alta = ora.kwh > 0 ? Math.max(3, Math.round((ora.kwh / massimo) * 100)) : 2;
          const tinta = ora.fascia >= 0 ? tintaDellaFascia(quante, ora.fascia) : "#94a3b8";
          return `<span class="dm-profilo-colonna" style="height:${alta}%;background:${tinta}${ora.kwh > 0 ? "" : ";opacity:.28"}" title="${String(ora.ora).padStart(2, "0")}:00 · ${formatNumber(ora.kwh, 2)} kWh"></span>`;
        })
        .join("")
    : "";
  const tacche = [0, 3, 6, 9, 12, 15, 18, 21]
    .map((ora) => `<span>${String(ora).padStart(2, "0")}</span>`)
    .join("");

  /* Il sole, detto a parte. E' la ragione per cui gli euro qui sotto sono
   * piu' bassi della somma dei kilowattora per il prezzo, e senza dirlo
   * sembrerebbe un conto sbagliato. */
  const dalSole =
    detto.sole > 0.05
      ? `<span aria-hidden="true">☀️</span> ${esc(t("Dal sole:", "From the sun:"))} <b>${formatNumber(detto.sole, 1)} kWh</b>. ${esc(t("Non costano niente a nessun'ora, e gli euro qui sopra sono solo su quello che ha preso dalla rete.", "They cost nothing at any hour, and the euros above are only on what it took from the grid."))}`
      : "";
  const spartito = detto.tuttoSpartito
    ? ""
    : `<span aria-hidden="true">ℹ️</span> ${esc(t("Non spartiti:", "Not split:"))} <b>${formatNumber(detto.spartito.senza, 1)} kWh</b>. ${esc(t("Per quelle ore Home Assistant non tiene il consumo della casa, e non si sa quanto venisse dal sole. La fascia però è quella giusta.", "For those hours Home Assistant doesn't keep the house consumption, so we can't tell how much came from the sun. The band is right all the same."))}`;
  const nota = [dalSole, spartito].filter(Boolean).join("<br>");

  return `
    <div class="dm-fasce-testata">
      <div class="dm-fasce-titolo">🕐 ${esc(t("In quale fascia consuma", "Which band it draws in"))}</div>
      <div class="dm-fasce-totale"><b>${soldi(detto.euro)}</b> <small>${formatNumber(detto.kwh, 1)} kWh${nome ? ` · ${esc(nome)}` : ""}</small></div>
    </div>
    <div class="dm-fasce-barra">${barra}</div>
    <div class="dm-fasce-griglia">${righe}</div>
    ${punta}
    ${colonne ? `<div class="dm-profilo-grafico">${colonne}</div><div class="dm-profilo-tacche">${tacche}</div>` : ""}
    ${nota ? `<div class="dm-fasce-nota">${nota}</div>` : ""}`;
}

/* ── dove si appende ───────────────────────────────────────────────────── */

/* Sotto le due tessere dell'anno: sono l'ultima cosa della scheda prima del
 * grafico, e il blocco parla dello stesso periodo di cui parla la card. */
function ilRiquadro(crea = false) {
  const titolo = doc?.getElementById("ed-dkpi-year-lbl");
  const dopo = titolo?.closest?.("div")?.nextElementSibling;
  const ultimo = dopo?.classList?.contains("ed-dev-cost-row")
    ? dopo
    : doc?.querySelector?.("#ed-dev-kpi-row ~ .ed-dev-cost-row:last-of-type");
  if (!ultimo) return null;
  let riquadro = doc.getElementById("dm-fasce-dispositivo");
  if (!riquadro) {
    if (!crea) return null;
    riquadro = doc.createElement("div");
    riquadro.id = "dm-fasce-dispositivo";
    riquadro.className = "dm-fasce-report dm-fasce-dispositivo";
  }
  /* Sempre subito dopo l'ultima riga di tessere, anche quando il guscio
   * ridisegna la scheda e rimette i figli al loro posto. Il grafico dei sette
   * giorni resta sotto: viene dopo nel documento. */
  if (riquadro.previousElementSibling !== ultimo) ultimo.after(riquadro);
  return riquadro;
}

/* Via il riquadro. E `scorda` dice se se ne va anche il conto.
 *
 * Sono due cose diverse e le si confondeva. Quando la scheda non si vede —
 * si e' appena toccata la linguetta e il guscio non l'ha ancora aperta — il
 * conto fatto un attimo prima e' ancora buono: e' dello stesso apparecchio e
 * dello stesso mese. Buttandolo, il ritorno sulla scheda voleva un altro giro
 * al Recorder, e nell'attesa non c'era niente da vedere.
 *
 * Si scorda quando il conto NON vale piu': un altro apparecchio, un altro
 * mese, le fasce spente, un giro finito male. */
function togliIlRiquadro(scorda = true) {
  doc?.getElementById("dm-fasce-dispositivo")?.remove();
  if (!scorda) return;
  state.detto = null;
  state.chiave = "";
}

/* C'e' qualcuno che sta guardando questa scheda?
 *
 * La stessa domanda che si fa la quota di sole dello stesso apparecchio, e
 * per la stessa ragione: una domanda a ore fatta a nessuno e' esattamente il
 * carico sul Recorder che non si vuole rifare. */
function laSchedaSiVede() {
  const selettore = doc?.getElementById("ed-dev-selector");
  if (!selettore) return false;
  if (typeof selettore.checkVisibility === "function")
    return Boolean(selettore.checkVisibility());
  return Boolean(selettore.offsetParent);
}

/** Come si chiama l'apparecchio scelto, come lo scrive la sua tendina. */
function nomeDelDispositivo(selettore) {
  const voce = selettore?.selectedOptions?.[0];
  return clean(voce?.textContent);
}

/** La chiave di un conto: stesso apparecchio, stesso mese, stesso prezzo. */
export function chiaveDelConto(entita, periodo, unico) {
  return `${entita}~${periodo.year}-${periodo.month}~${unico}`;
}

function disegna(detto, config, nome) {
  const markup = detto ? ilBloccoDelDispositivo(detto, config, nome) : "";
  const riquadro = ilRiquadro(Boolean(markup));
  if (!riquadro) return false;
  if (!markup) {
    riquadro.remove();
    return false;
  }
  riquadro.innerHTML = markup;
  riquadro.dataset.dmFasce = String(config.voci.length);
  return true;
}

/* ── il giro alla rete ─────────────────────────────────────────────────── */

/**
 * Chiede le ore del mese scelto per l'apparecchio aperto, e rifa' il conto.
 *
 * Tre entita' in una domanda sola — l'apparecchio, la casa, la rete — perche'
 * e' la stessa fetta di database e chiederla tre volte sarebbe tre giri
 * regalati al Recorder.
 */
export async function aggiornaLeFasceDelDispositivo({ forza = false } = {}) {
  if (!doc) return false;
  const config = normalizzaLeFasce(readJson(CHIAVE_FASCE, {}));
  if (!leFasceValgono(config)) {
    togliIlRiquadro();
    return false;
  }
  const selettore = doc.getElementById("ed-dev-selector");
  const scelto = clean(selettore?.value);
  if (!scelto || !laSchedaSiVede()) {
    /* Non si vede: il riquadro non ci va, ma il conto resta in tasca — al
     * ritorno si ridisegna senza chiedere niente a nessuno. */
    togliIlRiquadro(false);
    return false;
  }

  const periodo = selectedPeriod();
  const { casa, rete } = entitaDelleFonti(pianiDelleFonti("month"));
  if (!casa || !rete) {
    togliIlRiquadro();
    return false;
  }
  const unico = prezzoUnicoDiAcquisto() || DEFAULT_IMPORT_RATE;
  const nome = nomeDelDispositivo(selettore);
  const chiave = chiaveDelConto(scelto, periodo, unico);
  const fresco = chiave === state.chiave && Date.now() - state.letto < SCADENZA_MS;
  if (!forza && fresco && state.detto) return disegna(state.detto, config, nome);

  /* Quello che c'e' appeso adesso parla di un altro apparecchio, o di un
   * altro mese: si toglie subito, senza aspettare la risposta.
   *
   * Un blocco intestato «Boiler» sotto la scheda della wallbox e' peggio di
   * nessun blocco — dice il falso, e lo dice con dei numeri veri accanto, che
   * e' il modo piu' convincente di dirlo. Per il tempo del giro non c'e'
   * niente, e chi guarda capisce di stare aspettando. */
  if (state.chiave && state.chiave !== chiave) togliIlRiquadro();

  /* Uno per volta, ma l'ultimo vince.
   *
   * Qui c'era `if (state.inCorso) return false;`, e buttava via la domanda
   * appena arrivata. Cambiando apparecchio mentre il giro di quello di prima
   * era ancora per aria, la domanda nuova non partiva proprio, e il blocco
   * restava quello vecchio: «se metto ad esempio wallbox esce boiler». Il
   * boiler era il giro partito prima; la wallbox una domanda mai fatta.
   *
   * Uno per volta resta — sono tre entita' chieste a ore, e due giri insieme
   * sono due fette di Recorder in contemporanea — ma chi arriva mentre si
   * aspetta si mette in coda invece di sparire. */
  if (state.inCorso) {
    state.dopo = true;
    return false;
  }

  const giro = ++state.giro;
  state.inCorso = true;
  try {
    const fonti = pianiDelleFonti("month");
    const unita = Object.fromEntries(
      fonti.filter((piano) => piano.entity).map((piano) => [piano.entity, piano.unita || ""]),
    );
    const arco = periodRange("month", new Date(periodo.year, periodo.month - 1, 1), new Date());
    const pezzo = { ...arco, kind: "month", period: "hour" };
    const righe = await leOreDalRecorder([scelto, casa, rete], pezzo, unita);
    if (giro !== state.giro) return false;
    const detto = leFasceDelDispositivo(
      {
        dispositivo: secchielliNellArco(righe?.[scelto], pezzo),
        casa: secchielliNellArco(righe?.[casa], pezzo),
        rete: secchielliNellArco(righe?.[rete], pezzo),
      },
      config,
      { prezzoUnico: unico },
    );
    state.detto = detto;
    state.chiave = chiave;
    state.letto = Date.now();
    /* Fra la domanda e la risposta la tendina puo' essere cambiata. Il conto
     * si tiene lo stesso — e' buono, ed e' di quell'apparecchio — ma non si
     * disegna: a disegnare ci pensa il giro che sta gia' in coda, con
     * l'apparecchio che c'e' adesso. */
    if (clean(doc.getElementById("ed-dev-selector")?.value) !== scelto) return false;
    return disegna(detto, config, nome);
  } catch (errore) {
    if (giro === state.giro) {
      root.console?.warn?.("[dashboardmodern] ore non lette per le fasce del dispositivo", errore);
      togliIlRiquadro();
    }
    return false;
  } finally {
    if (giro === state.giro) {
      state.inCorso = false;
      if (state.dopo) {
        state.dopo = false;
        /* Fuori da questo giro e non qui dentro: dieci cambi di tendina di
         * fila diventerebbero dieci chiamate una dentro l'altra. */
        root.setTimeout?.(() => rifai(true), 0);
      }
    }
  }
}

/* ── il foglio ─────────────────────────────────────────────────────────── */

function foglio() {
  installStyle(
    "dm-fasce-del-dispositivo-style",
    `
    /* Il pannello del dispositivo e' stretto SEMPRE, non solo al telefono: le
     * sei colonne del blocco della Panoramica non ci stanno nemmeno su un
     * tablet. La riga va su due piani per contenitore, non per finestra. */
    .dm-fasce-dispositivo{margin:14px 0 0!important;padding:14px 15px!important}
    .dm-fasce-dispositivo .dm-fasce-riga{grid-template-columns:34px minmax(0,1fr) auto auto!important;gap:3px 10px!important}
    .dm-fasce-dispositivo .dm-fasce-nome{grid-column:1!important;grid-row:1/3!important;align-self:start!important}
    .dm-fasce-dispositivo .dm-fasce-ore{grid-column:2!important;grid-row:1!important}
    .dm-fasce-dispositivo .dm-fasce-kwh{grid-column:3/5!important;grid-row:1!important}
    .dm-fasce-dispositivo .dm-fasce-quota{grid-column:2!important;grid-row:2!important;text-align:left!important}
    .dm-fasce-dispositivo .dm-fasce-prezzo{grid-column:3!important;grid-row:2!important}
    .dm-fasce-dispositivo .dm-fasce-euro{grid-column:4!important;grid-row:2!important}
    .dm-fasce-dispositivo .dm-profilo-grafico{height:62px!important;gap:2px!important}
    .dm-fasce-dispositivo .dm-fasce-confronto{align-items:flex-start!important}
    .dm-fasce-dispositivo .dm-fasce-nota{line-height:1.55!important}
    `,
  );
}

/* ── il giro ───────────────────────────────────────────────────────────── */

function rifai(forza = false) {
  aggiornaLeFasceDelDispositivo({ forza }).catch(() => {});
}

export function installLeFasceDelDispositivo() {
  if (!doc || state.installed) return false;
  state.installed = true;
  foglio();
  /* Cambiare apparecchio cambia il conto: e' la tendina che decide di chi si
   * sta parlando, ed e' l'unico gesto che lo cambia da solo. */
  doc.addEventListener("change", (evento) => {
    if (evento.target?.id === "ed-dev-selector") rifai(true);
  });
  /* Il pacchetto del periodo e' il momento in cui la scheda del dispositivo
   * viene ridipinta: e' li' che il blocco va rimesso al suo posto, e li' che
   * un mese diverso vuole un conto diverso. E' lo stesso aggancio del blocco
   * della Panoramica. */
  root.addEventListener?.("dashboardmodern:period-bundle", () =>
    root.queueMicrotask?.(() => rifai()),
  );
  /* E chi arriva sulla scheda cliccando la linguetta la trova gia' pronta.
   *
   * La linguetta e' «Analisi», ed e' li' che sta il dettaglio del dispositivo.
   * Qui c'era scritto «#ed-tab-disp», che in questa plancia non esiste: le
   * linguette di Energia sono due, `ed-tab-pan` e `ed-tab-ana`, e una scheda
   * chiamata «disp» non c'e' mai stata. Quindi l'aggancio non scattava mai, e
   * il blocco spariva per davvero: stando in Panoramica la scheda non si vede,
   * `rifai` toglie il riquadro, e tornando su Analisi non lo rimetteva
   * nessuno. Riappariva solo cambiando apparecchio nella tendina — cioe' il
   * gesto che non si fa, perche' l'apparecchio e' gia' scelto da prima.
   *
   * Si ascoltano tutt'e due le linguette e non solo quella giusta: a decidere
   * se il blocco ci va e' `rifai`, che guarda se la scheda si vede, e cosi'
   * anche tornare in Panoramica passa di li' invece di lasciare il riquadro
   * appeso a una scheda nascosta. */
  doc.addEventListener(
    "click",
    (evento) => {
      if (!evento.target?.closest?.(".ed-inner-tab,#ed-tab-ana,#ed-tab-pan")) return;
      /* Tre volte, e non una.
       *
       * Il tocco si sente in cattura — prima che il guscio faccia qualunque
       * cosa — e subito dopo la scheda non si vede ancora: `rifai` trovava
       * tutto chiuso, non disegnava niente, e li' finiva. Il blocco tornava
       * solo cambiando apparecchio nella tendina, ed e' il gesto che dal
       * campo si e' dovuto inventare: «seleziono boiler e non lo porta, ne
       * scelgo un altro e torno su boiler, e allora lo carica».
       *
       * Quando la scheda si apra non lo dice nessuno, quindi si riprova:
       * subito, dopo un quarto di secondo e dopo un secondo scarso. Le
       * passate in piu' non costano niente — trovano il conto gia' fatto e al
       * massimo riappendono il riquadro — e quella buona e' la prima che
       * trova la scheda aperta. */
      for (const fra of [0, 250, 900]) root.setTimeout?.(() => rifai(), fra);
    },
    true,
  );
  rifai();
  return true;
}

installLeFasceDelDispositivo();
