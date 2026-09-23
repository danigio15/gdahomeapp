import { applianceArtwork } from "../core/appliance-artwork.js";
import { applianceArtworkType } from "../core/appliance-card-view-model.js";
import { DEFAULT_EXPORT_RATE, DEFAULT_IMPORT_RATE, importRateEntity, resolveRate } from "../core/energy-calculations.js";
import { persistEnergyField } from "../core/energy-writer.js";
import { cEIlFotovoltaico } from "../core/il-fotovoltaico-di-questa-casa.js";
import {
  CHIAVE_FASCE,
  nomeDellaFascia,
  normalizzaLeFasce,
  orarioDellaFascia,
  prezzoMedioDelleFasce,
  tintaDellaFascia,
} from "../core/fasce-della-tariffa.js";
import { salvaLeFasceDellaScheda } from "./beta22-load-slots-hotfix-section.js";
import { allStates, clean, doc, formatNumber, installStyle, readJson, registraIlContoDelleFasce, root, scriviTestoSeCambia, t, wrapFunction } from "./shared.js";

const KEY = "__DASHBOARDMODERN_ENERGY_REPORT_POLISH__";
const state = (root[KEY] ||= { installed: false, frame: 0, dailyChart: null, legacyDailyChart: null, subscribed: false, contoAFasce: null });

/**
 * Chi sa il conto esatto delle fasce si presenta qui.
 *
 * E' il blocco «Come si divide il costo reale», che sta attaccato sotto la
 * griglia finanziaria: lui le ore del mese le ha chieste al Recorder e sa in
 * che fascia sono passati quei kilowattora.
 *
 * Si presenta invece di essere importato perche' l'import non si puo' fare: il
 * Report entra nella plancia dall'ingresso beta, che sta a monte della sezione
 * Energia; il blocco delle fasce l'Energia la usa — le ore le chiede dalla sua
 * porta — e importarlo da qui chiuderebbe un anello. Chi arriva dopo si
 * presenta a chi c'era prima: e' l'unico verso che quell'anello non lo chiude.
 */
export function registraIlContoAFasce(lettore) {
  state.contoAFasce = typeof lettore === "function" ? lettore : null;
  /* E lo stesso lettore va nel registro condiviso: quella casella la scrive
   * anche la sezione dell'Energia, e prima delle due vinceva chi passava per
   * ultima — cioe' la stima. Vedi «shared.js». */
  registraIlContoDelleFasce(lettore);
  return true;
}

function model() {
  try { return root.DashboardModernModules?.store?.getSection?.("energy") || {}; } catch (_error) { return {}; }
}

function appliances() {
  try {
    const store = root.DashboardModernModules?.store;
    // Le voci del Report arrivano da tre elenchi: gli elettrodomestici, i
    // carichi secondari e le voci aggiunte a mano. Cercandole solo nei primi
    // due, le ultime non venivano riconosciute e restavano con la faccina.
    return [
      ...(store?.getSection?.("appliances") || []),
      ...(store?.getSection?.("loads") || []),
      ...(store?.getSection?.("reportDevices") || []),
    ];
  } catch (_error) { return []; }
}

function resolved(value) {
  const id = clean(value);
  if (!id) return "";
  try { return clean(root.resolveEntity?.(id) || id); } catch (_error) { return id; }
}

function historySource(group) {
  if (!group) return "";
  return resolved(group.total_energy || group.total_import_energy || group.total_export_energy || group.total_charged_energy || group.total_discharged_energy || group.monthly_energy || group.annual_energy || group.daily_energy);
}

function sourceFor(kind) {
  const energy = model();
  return historySource(kind === "solar" ? energy.solar : energy.house);
}

function bucketMap(rows = [], daysInMonth = 31) {
  const values = Array.from({ length: daysInMonth }, () => 0);
  for (const row of Array.isArray(rows) ? rows : []) {
    const date = new Date(row?.start || row?.end || 0);
    const day = date.getDate();
    const change = Number(row?.change);
    if (!Number.isFinite(change) || day < 1 || day > daysInMonth) continue;
    values[day - 1] += Math.max(0, change);
  }
  return values;
}

/**
 * Le barre delle fasce: quello che hai COMPRATO quel giorno, diviso per fascia.
 *
 * Si aggiungono alle due linee, non le sostituiscono, e la ragione e' che
 * raccontano un'altra cosa. «Consumo» e' quello che la casa ha usato; le fasce
 * stanno sotto quello che si e' preso dalla RETE, che con il fotovoltaico e'
 * sempre meno. Mettere le tre fasce al posto della linea del consumo avrebbe
 * fatto sembrare che nei giorni di sole si consumasse meno, quando invece si
 * comprava meno: sarebbe stato un grafico che dice il falso proprio nei giorni
 * in cui l'impianto lavora bene.
 *
 * Le barre stanno dietro — `order` piu' alto — e si impilano fra loro: la
 * colonna alta quanto i kilowattora comprati, divisa nei colori delle fasce.
 * Le linee restano davanti e non si impilano, ognuna col suo gruppo.
 */
export function barreDelleFasce(giorniDelMese, mese, anno) {
  const conto = state.contoAFasce?.();
  const giorni = conto?.report?.giorni;
  if (!giorni?.length) return [];
  const quante = conto.report.fasce.length;
  const per = Array.from({ length: quante }, () =>
    Array.from({ length: giorniDelMese }, () => 0),
  );
  /* La chiave del giorno e' «2026-09-14», e va guardata TUTTA.
   *
   * Prendendo solo le ultime due cifre, il 5 ottobre finiva nella colonna del
   * 5 settembre: il numero del giorno da solo non dice di che mese sia. Nel
   * giro di tutti i giorni il conto copre un mese solo e la differenza non si
   * vede mai — ed e' proprio per questo che andava chiusa qui, invece di
   * aspettare il giorno in cui l'arco cambia e una colonna si gonfia senza che
   * nessuno capisca perche'. */
  const suo = `${anno}-${String(mese).padStart(2, "0")}-`;
  for (const voce of giorni) {
    const chiave = String(voce?.giorno || "");
    if (!chiave.startsWith(suo)) continue;
    const giorno = Number(chiave.slice(suo.length));
    if (!(giorno >= 1 && giorno <= giorniDelMese)) continue;
    (voce.per || []).forEach((kwh, indice) => {
      if (per[indice]) per[indice][giorno - 1] += Math.max(0, Number(kwh) || 0);
    });
  }
  return per.map((valori, indice) => ({
    label: nomeDellaFascia(indice),
    /* L'orario viaggia con la serie: nel riquadro che si apre passando sopra
     * una colonna «F2» da solo non dice niente, «F2 19:00–23:00» si'. */
    dmOrario: orarioDellaFascia({ voci: conto.report.fasce }, indice),
    data: valori,
    type: "bar",
    stack: "rete",
    backgroundColor: tintaDellaFascia(quante, indice),
    borderWidth: 0,
    order: 2,
  }));
}

/* La legenda del grafico sta nel guscio, scritta a mano: quando arrivano le
 * fasce ci vogliono i loro pallini accanto ai due di sempre. */
function legendaDellAndamento(fasce, ilSole = true) {
  const legenda = doc?.querySelector("#ed-pane-panoramica .ed-chart-legend");
  if (!legenda) return false;
  const voce = (tinta, testo) =>
    `<div class="ed-legend-item"><div class="ed-legend-dot" style="background:${tinta};"></div>${testo}</div>`;
  const markup = [
    /* La voce «Produzione» segue la sua linea: se la linea non si disegna,
       una legenda che la nomina promette un colore che nel grafico non c'e'. */
    ilSole ? voce("#16a34a", t("Produzione", "Production")) : "",
    voce("#0ea5e9", t("Consumo", "Consumption")),
    ...fasce.map((serie) => voce(serie.backgroundColor, serie.label)),
  ].join("");
  if (legenda.innerHTML !== markup) legenda.innerHTML = markup;
  legenda.dataset.dmFasce = String(fasce.length);
  return true;
}

function realDataPresent(values) {
  return values.some((value) => Number.isFinite(value) && value > 0);
}

function chartMessage(message) {
  const loading = doc?.getElementById("ed-chart-loading");
  const canvas = doc?.getElementById("ed-daily-canvas");
  if (canvas) canvas.style.display = "none";
  if (loading) {
    loading.style.display = "flex";
    loading.innerHTML = `<span aria-hidden="true">ℹ️</span> ${message}`;
  }
}

function destroyDailyChart(canvas) {
  try { root.Chart?.getChart?.(canvas)?.destroy?.(); } catch (_error) {}
  try { state.dailyChart?.destroy?.(); } catch (_error) {}
  state.dailyChart = null;
}

export async function renderActualDailyChart(daysInMonth, selMonth, selYear) {
  const loading = doc?.getElementById("ed-chart-loading");
  const canvas = doc?.getElementById("ed-daily-canvas");
  if (!loading || !canvas) return false;
  destroyDailyChart(canvas);
  loading.style.display = "flex";
  loading.textContent = t("Carico lo storico reale di Home Assistant…", "Loading real Home Assistant history…");
  canvas.style.display = "none";

  const solar = sourceFor("solar");
  const house = sourceFor("house");
  const ids = [...new Set([solar, house].filter(Boolean))];
  if (!ids.length || !root.DashboardModernEnergyService?.statisticsWithGrowth) {
    chartMessage(t("Storico giornaliero non disponibile: configura i contatori energia totali.", "Daily history unavailable: configure cumulative energy meters."));
    return false;
  }

  const year = Number(selYear) || new Date().getFullYear();
  const month = Math.max(1, Math.min(12, Number(selMonth) || new Date().getMonth() + 1));
  const days = Number(daysInMonth) || new Date(year, month, 0).getDate();
  const start = new Date(year, month - 1, 1);
  const next = new Date(year, month, 1);
  const now = new Date();
  const end = next > now ? now : next;
  if (end <= start) {
    chartMessage(t("Il periodo selezionato non contiene ancora dati.", "The selected period does not contain data yet."));
    return false;
  }

  try {
    const result = await root.DashboardModernEnergyService.statisticsWithGrowth(ids, start.toISOString(), end.toISOString(), "day");
    const production = bucketMap(result?.[solar] || [], days);
    const consumption = bucketMap(result?.[house] || [], days);
    if (!realDataPresent(production) && !realDataPresent(consumption)) {
      chartMessage(t("Nessuna statistica giornaliera reale disponibile per il periodo selezionato.", "No real daily statistics are available for the selected period."));
      return false;
    }
    if (!root.Chart) {
      chartMessage(t("Grafico non disponibile: Chart.js non è caricato.", "Chart unavailable: Chart.js is not loaded."));
      return false;
    }

    const labels = Array.from({ length: days }, (_, index) => String(index + 1));
    const fasce = barreDelleFasce(days, month, year);
    const ilSole = cEIlFotovoltaico(model());
    legendaDellAndamento(fasce, ilSole);
    loading.style.display = "none";
    canvas.style.display = "block";
    canvas.dataset.dmActualHistory = `${year}-${String(month).padStart(2, "0")}`;
    canvas.dataset.dmFasce = String(fasce.length);
    state.dailyChart = new root.Chart(canvas.getContext("2d"), {
      type: "line",
      data: {
        labels,
        datasets: [
          /* Ogni linea nel suo gruppo, e una sola per gruppo: con l'asse
           * impilato — che serve alle barre — due linee nello stesso gruppo si
           * sommerebbero, e il consumo apparirebbe sopra la produzione invece
           * che accanto. Un gruppo con dentro una cosa sola non si somma con
           * nessuno. */
          /* La produzione esce dal grafico dove i pannelli non ci sono (#82):
             una linea piatta sullo zero, con la sua voce in legenda, dice
             «oggi non ha prodotto» a una casa che non produce mai. */
          ...(ilSole
            ? [{ label: t("Produzione", "Production"), data: production, stack: "sole", order: 0, borderColor: "#16a34a", backgroundColor: "rgba(22,163,74,.15)", fill: true, tension: .3, pointRadius: 0, borderWidth: 2 }]
            : []),
          { label: t("Consumo", "Consumption"), data: consumption, stack: "casa", order: 1, borderColor: "#0ea5e9", backgroundColor: "rgba(14,165,233,.08)", fill: true, tension: .3, pointRadius: 0, borderWidth: 2 },
          ...fasce,
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { intersect: false, mode: "index" },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}${ctx.dataset.dmOrario ? ` ${ctx.dataset.dmOrario}` : ""}: ${formatNumber(ctx.parsed.y, 2)} kWh` } } },
        scales: {
          y: { beginAtZero: true, stacked: fasce.length > 0, title: { display: true, text: "kWh" } },
          x: { stacked: fasce.length > 0, grid: { display: false } },
        },
      },
    });
    return true;
  } catch (error) {
    root.console?.warn?.("[DashboardModern] real daily chart unavailable", error);
    if (typeof state.legacyDailyChart === "function") {
      try {
        destroyDailyChart(canvas);
        loading.style.display = "none";
        canvas.style.display = "block";
        await state.legacyDailyChart(daysInMonth, selMonth, selYear);
        canvas.dataset.dmHistoryFallback = "legacy-compatible";
        return true;
      } catch (fallbackError) {
        root.console?.warn?.("[DashboardModern] compatible daily chart fallback unavailable", fallbackError);
      }
    }
    chartMessage(t("Storico Home Assistant non raggiungibile per il periodo selezionato.", "Home Assistant history is unavailable for the selected period."));
    return false;
  }
}

function installDailyChartOverride() {
  const current = root.renderEdDailyChart;
  if (typeof current !== "function" || current.__dmActualHistory) return false;
  state.legacyDailyChart = current;
  const override = async (daysInMonth, selMonth, selYear) => renderActualDailyChart(daysInMonth, selMonth, selYear);
  override.__dmActualHistory = true;
  root.renderEdDailyChart = override;
  return true;
}

function deviceForRow(row, devices) {
  const direct = clean(row.dataset.entity || row.dataset.sensor);
  const name = clean(row.querySelector(".ed-dev-name")?.childNodes?.[0]?.textContent || row.querySelector(".ed-dev-name")?.textContent).toLowerCase();
  return devices.find((item) => {
    const refs = [item.entity, item.history, item.report_entity, item.history_entity, item.total_energy_entity, item.monthly_energy_entity, ...(item.entities || [])].map(clean);
    return (direct && refs.includes(direct)) || (name && clean(item.name).toLowerCase() === name);
  }) || null;
}

export function applyReportArtwork() {
  const rows = doc?.querySelectorAll?.("#ed-device-list .ed-device-row") || [];
  if (!rows.length) return false;
  const devices = appliances();
  rows.forEach((row) => {
    const item = deviceForRow(row, devices);
    if (!item) return;
    /* Lo stesso disegno che si vede in Elettrodomestici, per tutti.
     *
     * Il tipo si leggeva da quattro campi a caso e, se nessuno di quelli diceva
     * qualcosa di riconoscibile — un carico chiamato "Wallbox", una voce
     * aggiunta a mano — il disegno non usciva e la riga restava con la faccina:
     * nello stesso elenco convivevano due stili. Adesso il tipo lo decide la
     * stessa funzione della scheda, che quando non riconosce niente risponde
     * "generico" invece di non rispondere. Cosi' tutte le voci del catalogo
     * sono disegnate allo stesso modo, e le altre pure. */
    const artwork = applianceArtwork(applianceArtworkType(item), 56);
    const icon = row.querySelector(".ed-dev-icon");
    if (!artwork || !icon) return;
    if (icon.dataset.dmArtwork === clean(item.id || item.name)) return;
    icon.innerHTML = artwork;
    icon.dataset.dmArtwork = clean(item.id || item.name);
    icon.removeAttribute("style");
  });
  return true;
}

function applyAutonomy(bundle) {
  const house = Number(bundle?.month?.house);
  const grid = Number(bundle?.month?.gridImport);
  if (!Number.isFinite(house) || house <= 0 || !Number.isFinite(grid)) return;
  const value = Math.max(0, Math.min(100, Math.round(((house - grid) / house) * 100)));
  for (const id of ["ed-auto-big", "ed-auto-ring-val"]) {
    const node = doc?.getElementById(id);
    if (node) node.textContent = `${value}%`;
  }
  const kpi = doc?.getElementById("ed-kpi-auto");
  if (kpi) kpi.innerHTML = `${value} <small>%</small>`;
  const circle = doc?.getElementById("ed-auto-circle");
  if (circle) circle.setAttribute("stroke-dasharray", `${(201 * value) / 100} 201`);
  const card = doc?.querySelector?.(".ed-auto-card,.ed-self-card");
  if (card) card.dataset.dmAutonomyFormula = "(house-gridImport)/house";
}

function rateRaw(key) {
  const configured = root.cdCfg?.(key);
  return configured !== undefined && configured !== null && configured !== ""
    ? configured
    : root.localStorage?.getItem(key);
}

/* I default vivono in `resolveRate` e solo la'. Vedi `rates()` della sezione
 * Energia, che e' l'altro lettore delle stesse sorgenti: il prezzo di
 * acquisto puo' essere l'entita' scelta nel modello canonico — e allora si
 * legge il suo stato — oppure il numero salvato con la chiave di sempre. */
function rateOrDefault(key, fallback) {
  const entita = key === "cd_costo_kwh" ? importRateEntity(model()) : "";
  const sorgente = entita ? resolved(entita) : rateRaw(key);
  const unico = resolveRate(sorgente, allStates(), fallback);
  /* Le fasce valgono sul prezzo di acquisto e non su quello di vendita: quello
   * che si vende si vende allo stesso prezzo a qualunque ora. E qui si parla
   * di mesi e di anni, quindi la media pesata sulle ore — la stessa che usa
   * `rates()` della sezione Energia, dallo stesso modulo: due medie sulla
   * stessa bolletta sarebbero due bollette. */
  if (key !== "cd_costo_kwh") return unico;
  return prezzoMedioDelleFasce(normalizzaLeFasce(readJson(CHIAVE_FASCE, {})), unico);
}

function money(value) {
  return `${formatNumber(Math.max(0, Number(value) || 0), 2)} €`;
}

export function applyFinancialOverview(bundle) {
  if (!bundle?.month) return false;
  const importPrice = rateOrDefault("cd_costo_kwh", DEFAULT_IMPORT_RATE);
  const exportPrice = rateOrDefault("cd_prezzo_immissione", DEFAULT_EXPORT_RATE);
  const data = bundle.month;
  /* La spesa vera, quando le ore del mese si sanno (#72).
   *
   * Con le fasce accese `importPrice` e' una media pesata sulle ore che ogni
   * fascia copre: una stima onesta, ma pur sempre una stima. Il blocco qui
   * sotto le ore le ha chieste davvero al Recorder e sa in che fascia sono
   * passati quei kilowattora — e' lo stesso mese e lo stesso contatore, quindi
   * il suo totale e' questa casella fatta meglio.
   *
   * Preferirlo non e' un vezzo: il blocco delle fasce sta attaccato SOTTO
   * questa griglia e dice «com'e' fatto» il numero che sta qui. Due cifre
   * diverse per la stessa spesa, a tre centimetri di distanza, sarebbero il
   * difetto peggiore di tutta la storia. */
  const aFasce = state.contoAFasce?.() || null;
  const importCost = aFasce
    ? Math.max(0, aFasce.euro)
    : Math.max(0, Number(data.gridImport) || 0) * importPrice;
  const withoutSolar = Math.max(0, Number(data.house) || 0) * importPrice;
  const exportIncome = Math.max(0, Number(data.gridExport) || 0) * exportPrice;
  // "Venduto" is already reported separately. Subtracting that income from
  // purchase cost made COSTO REALE collapse to zero whenever export revenue was
  // higher than the bill. Real cost is therefore strictly imported kWh × rate.
  const realCost = importCost;
  const saved = Math.max(0, withoutSolar - importCost);

  /* Scrivere passando dal delegato lascia il cartello sul nodo: senza, il
   * guscio non sapeva che la griglia aveva un padrone e ci riscriveva sopra. */
  const set = (id, value) => scriviTestoSeCambia(doc?.getElementById(id), value);
  set("ed-fin-pagato", money(withoutSolar));
  set("ed-fin-pagato-sub", `${formatNumber(data.house, 1)} kWh`);
  set("ed-fin-costo", money(realCost));
  set("ed-fin-costo-sub", `${formatNumber(data.gridImport, 1)} kWh ${t("dalla rete", "from grid")}`);
  set("ed-fin-risp", money(saved));
  set("ed-fin-imm", money(exportIncome));

  if (bundle.year) {
    const annualImport = Math.max(0, Number(bundle.year.gridImport) || 0) * importPrice;
    const annualWithoutSolar = Math.max(0, Number(bundle.year.house) || 0) * importPrice;
    set("ed-year-pagato", money(annualImport));
    set("ed-year-risparmio", money(Math.max(0, annualWithoutSolar - annualImport)));
  }
  const overview = doc?.getElementById("view-panoramica");
  if (overview) {
    overview.dataset.dmFinancialFormula = aFasce ? "ore*prezzoDellaFascia" : "gridImport*importPrice";
    overview.dataset.dmImportPrice = String(importPrice);
    overview.dataset.dmExportPrice = String(exportPrice);
  }
  return true;
}

function installCostSettingsOwner() {
  const current = root.edSaveCosti;
  if (typeof current === "function" && current.__dmCanonicalEnergyRates) return true;
  function saveCanonicalEnergyRates() {
    const importInput = doc?.getElementById("ed-costo-kwh");
    const exportInput = doc?.getElementById("ed-prezzo-imm");
    const normalize = (input) => {
      const parsed = Number(String(input?.value ?? "").replace(",", "."));
      return Number.isFinite(parsed) && parsed >= 0 ? String(parsed) : "0";
    };
    const importRate = normalize(importInput);
    const exportRate = normalize(exportInput);
    root.localStorage?.setItem("cd_costo_kwh", importRate);
    root.localStorage?.setItem("cd_prezzo_immissione", exportRate);
    /* E le fasce orarie (#72), che stanno nella stessa scheda e rispondono
     * alla stessa domanda: quanto costa il kWh. Le scrive chi le ha disegnate
     * — un tasto «salva» che ne salvasse meta' sarebbe peggio di due tasti. */
    salvaLeFasceDellaScheda();
    /* La scelta «da entita'» del prezzo di acquisto (#217) abita nel modello
     * canonico, non in una chiave sciolta: in modalita' Entita' si salva l'id
     * scelto, in modalita' Numero lo si toglie — e' cosi' che si torna al
     * numero. Il prezzo di vendita resta numerico. */
    const card = doc?.querySelector?.(".dm-energy-cost-card");
    const entityInput = doc?.getElementById("ed-costo-kwh-entita");
    const entityId = clean(entityInput?.value);
    const entityMode = card?.dataset?.dmImportRateMode === "entity" && entityId;
    persistEnergyField(
      root.DashboardModernModules?.store,
      "rates",
      "import_entity",
      entityMode ? entityId : "",
    );
    root.cdMarkDirty?.();
    root.cdSyncPush?.();
    /* I prezzi sono appena cambiati: il pacchetto va rifatto anche se e' di
     * un secondo fa, e questa e' la porta di chi ha ragione di insistere. */
    root.DashboardModernEnergyService?.refreshNow?.();
    const runtimeBundle = root.__DASHBOARDMODERN_RUNTIME_ROOT__?.bundle;
    if (runtimeBundle) root.setTimeout?.(() => applyFinancialOverview(runtimeBundle), 0);
    return true;
  }
  saveCanonicalEnergyRates.__dmCanonicalEnergyRates = true;
  saveCanonicalEnergyRates.__dmPrevious = current;
  root.edSaveCosti = saveCanonicalEnergyRates;
  return true;
}

function removeWeeklyDash() {
  const diff = doc?.getElementById("ed-w-diff");
  if (diff) {
    diff.hidden = true;
    diff.setAttribute("aria-hidden", "true");
  }
}

function schedule() {
  if (state.frame) return;
  state.frame = root.requestAnimationFrame?.(() => {
    state.frame = 0;
    removeWeeklyDash();
    applyReportArtwork();
    installDailyChartOverride();
    installCostSettingsOwner();
    const bundle = root.__DASHBOARDMODERN_RUNTIME_ROOT__?.bundle;
    if (bundle?.month) applyFinancialOverview(bundle);
  }) || root.setTimeout?.(() => {
    state.frame = 0;
    removeWeeklyDash();
    applyReportArtwork();
    installDailyChartOverride();
    installCostSettingsOwner();
    const bundle = root.__DASHBOARDMODERN_RUNTIME_ROOT__?.bundle;
    if (bundle?.month) applyFinancialOverview(bundle);
  }, 0);
}

function subscribeStore() {
  if (state.subscribed) return;
  const store = root.DashboardModernModules?.store;
  if (typeof store?.subscribe !== "function") return;
  state.subscribed = true;
  store.subscribe((change) => {
    if (["appliances", "loads", "energy", "report", "snapshot"].includes(change?.section)) schedule();
  });
}

function installStyles() {
  installStyle("dm-energy-report-polish-style", `
    #ed-w-diff{display:none!important}
    #ed-device-list .ed-dev-icon[data-dm-artwork]{display:grid!important;place-items:center!important;width:58px!important;height:58px!important;min-width:58px!important;padding:0!important;border-radius:17px!important;background:transparent!important;overflow:hidden!important}
    #ed-device-list .ed-dev-icon[data-dm-artwork] .dm-appliance-art,#ed-device-list .ed-dev-icon[data-dm-artwork] svg{display:block!important;width:56px!important;height:56px!important;max-width:56px!important;max-height:56px!important}
    #ed-daily-canvas[data-dm-actual-history]{min-height:250px!important}

    /* La riga sotto «Mese / Anno» non cresce quando arrivano le pastiglie.
     *
     * «C'e' qualcosa che si aggiorna con layout differenti: la riga sotto a
     * mese e anno prima ha una grafica poi cambia.» Misurato: a 412 px di
     * larghezza la riga del periodo passa da 77 a 96 pixel nel momento in cui
     * il pacchetto arriva e le tre pastiglie vengono scritte. Su schermo largo
     * non si muove di un pixel, e per questo non si vede da un computer: li'
     * le pastiglie stanno in fila con le due tendine («margin-left:auto»),
     * mentre sotto ai 640 px la riga diventa una colonna e loro si prendono un
     * rigo tutto loro — un rigo che al primo disegno non c'e' ancora.
     *
     * Venti pixel: e' alta cosi' una pastiglia — quattro di margine sopra,
     * dodici di testo a dieci punti, quattro sotto. Si tiene il posto
     * da subito invece di riempirlo dopo, e cosi' quello che sta sotto non
     * scende piu'. La misura la difende una prova che apre la pagina larga 412
     * e confronta la riga vuota con la riga piena: il giorno che la pastiglia
     * cambia altezza, quella prova cade insieme a questa riga.
     *
     * Vuoto non si scrive niente, e non si mette nessun «—»: un numero finto
     * sotto al mese si legge come un numero. */
    @media (max-width:640px){
      #ed-yoy-chips{min-height:20px!important}
    }
  `);
}

export function installEnergyReportPolishSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  installCostSettingsOwner();
  root.addEventListener?.("dashboardmodern:legacy-ready", () => {
    installDailyChartOverride();
    installCostSettingsOwner();
    for (const name of ["renderEnergyDashboard", "renderEdDeviceList"]) wrapFunction(name, `__dmEnergyReport_${name}`, schedule);
    subscribeStore();
    schedule();
  });
  root.addEventListener?.("dashboardmodern:runtime-ready", () => { subscribeStore(); installCostSettingsOwner(); schedule(); });
  root.addEventListener?.("dashboardmodern:period-bundle", (event) => { applyAutonomy(event.detail); applyFinancialOverview(event.detail); schedule(); });
  root.addEventListener?.("dashboardmodern:energy-stable", (event) => { applyAutonomy(event.detail); applyFinancialOverview(event.detail); schedule(); });
  doc.addEventListener("click", (event) => {
    if (event.target?.closest?.("[data-energy-tab],.energy-tab,.sub-tab-btn,.ed-tab")) root.setTimeout?.(schedule, 0);
  }, true);
  schedule();
}

installEnergyReportPolishSection();