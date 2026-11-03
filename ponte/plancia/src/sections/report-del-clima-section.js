/* Il report del clima, nella pagina Clima.
 *
 * «Report giornaliero/mensile sulle varie stanze di quanto sono state
 * accese, con che media di apertura valvola, quanto e' stata accesa la
 * caldaia ecc. Un po' come per la parte energia.»
 *
 * Un tasto «📊 Report» nella testata del Clima apre un foglio: in alto
 * l'impianto (Riscaldamento, Raffrescamento), poi il periodo — giorno,
 * settimana, mese, con le frecce — le tessere coi totali, il grafico per ora o
 * per giorno e l'elenco delle stanze per ore di richiesta.
 *
 * I conti sono tutti di `core/report-del-clima.js`. Qui si chiede la storia a
 * Home Assistant, una domanda per entita' — cosi' una che non risponde non
 * spegne le altre — e si disegna. I periodi chiusi non cambiano piu': la loro
 * risposta si tiene finche' la pagina resta aperta.
 */
import {
  VISTE_DEL_REPORT,
  impiantiPresenti,
  inOre,
  oreScritte,
  periodoDelReport,
  reportDellImpianto,
  righeDellaStoria,
  spostaIlPeriodo,
  unitaDellImpianto,
} from "../core/report-del-clima.js";
import { normalizzaCaldaie } from "../core/impianti-termici.js";
import { climateUnits } from "./climate-thermal-section.js";
import { statiDelleCaldaie } from "./termico-del-caldo-section.js";
import { clean, doc, esc, installStyle, locale, root, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_REPORT_DEL_CLIMA__";
const STYLE_ID = "dm-report-clima-style";
const state = (root[KEY] ||= {
  installed: false,
  aperto: false,
  impianto: "caldo",
  vista: "mese",
  giorno: Date.now(),
  giro: 0,
  cache: new Map(),
});

/* ── le fonti ─────────────────────────────────────────────────────────── */

const risolvi = (entity) => {
  const id = clean(entity);
  if (!id) return "";
  try {
    return clean(root.resolveEntity?.(id)) || id;
  } catch (_errore) {
    return id;
  }
};

/* Le caldaie del report: quelle che la testata del Clima mostra gia'.
 *
 * Della Gestione termica (#281) si prende la casella che dice se lavora: lo
 * stato, o la fiamma, o la modulazione — la prima che c'e'. Le altre arrivano
 * dall'elenco libero dello Stato termico, riconosciute dal nome. */
export function caldaieDelReport() {
  const viste = new Set();
  const fuori = [];
  const aggiungi = (nome, entity) => {
    const vera = risolvi(entity);
    if (!vera || viste.has(vera)) return;
    viste.add(vera);
    fuori.push({ nome: clean(nome) || t("Caldaia", "Boiler"), entity: vera });
  };
  let righe = [];
  try {
    righe = normalizzaCaldaie(root.cdCfg?.("cd_caldaia"));
  } catch (_errore) {}
  for (const riga of righe) aggiungi(riga.name, riga.stato || riga.fiamma || riga.modulazione);
  try {
    for (const caldaia of statiDelleCaldaie()) aggiungi(caldaia.nome, caldaia.entity);
  } catch (_errore) {}
  return fuori;
}

function unitaDelReport() {
  try {
    return climateUnits().map((u) => ({ ...u, entity: risolvi(u.entity), valvola: risolvi(u.valvola) }));
  } catch (_errore) {
    return [];
  }
}

const broker = () => root.DashboardModernEnergyService?.broker || null;

/* Una domanda per entita', con gli attributi: `hvac_action`, le due
 * temperature e la valvola stanno li'. Per il giorno ogni cambio; per la
 * settimana e il mese i cambi significativi, che per un `climate` sono
 * proprio quelli — l'azione e le temperature. */
function domanda(entity, periodo) {
  return {
    type: "history/history_during_period",
    start_time: new Date(periodo.inizio).toISOString(),
    end_time: new Date(periodo.fine).toISOString(),
    entity_ids: [entity],
    include_start_time_state: true,
    significant_changes_only: periodo.vista !== "giorno",
    minimal_response: false,
    no_attributes: false,
  };
}

async function storiaDi(entity, periodo) {
  const chiave = `${entity}|${periodo.inizio}|${periodo.fine}`;
  if (!periodo.inCorso && state.cache.has(chiave)) return state.cache.get(chiave);
  const b = broker();
  if (!b?.request) throw new Error("broker");
  const attesa = periodo.vista === "giorno" ? 15_000 : 30_000;
  const risposta = await b.request(domanda(entity, periodo), attesa);
  const righe = righeDellaStoria(risposta, entity);
  if (!periodo.inCorso) state.cache.set(chiave, righe);
  return righe;
}

/* ── le parole ────────────────────────────────────────────────────────── */

const nomeDellImpianto = (id) =>
  id === "freddo" ? t("Raffrescamento", "Cooling") : t("Riscaldamento", "Heating");

const nomeDellaVista = (vista) =>
  vista === "giorno" ? t("Giorno", "Day") : vista === "settimana" ? t("Settimana", "Week") : t("Mese", "Month");

/* Solo la prima lettera: «sabato 31 ottobre» diventa «Sabato 31 ottobre»,
 * non «Sabato 31 Ottobre» come farebbe il foglio di stile. */
const maiuscola = (testo) => (testo ? testo[0].toLocaleUpperCase(locale()) + testo.slice(1) : testo);

function titoloDelPeriodo(periodo) {
  return maiuscola(dataDelPeriodo(periodo));
}

function dataDelPeriodo(periodo) {
  const da = new Date(periodo.inizio);
  if (periodo.vista === "giorno")
    return da.toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  if (periodo.vista === "mese") return da.toLocaleDateString(locale(), { month: "long", year: "numeric" });
  const al = new Date(periodo.prossimo - 1);
  const breve = { day: "numeric", month: "short" };
  return `${da.toLocaleDateString(locale(), breve)} – ${al.toLocaleDateString(locale(), { ...breve, year: "numeric" })}`;
}

const gradi = (valore) =>
  valore === null || valore === undefined
    ? "—"
    : `${valore.toLocaleString(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })}°`;

const percento = (valore) => (valore === null || valore === undefined ? "—" : `${Math.round(valore)}%`);

const ore = (ms) => oreScritte(ms);

const accensioniDette = (n) => t(`${n} accensioni`, `${n} starts`);

/* ── il disegno ───────────────────────────────────────────────────────── */

function tessera(icona, etichetta, valore, sotto = "", extra = "") {
  return `<div class="dm-rcl-tessera" ${extra}>
    <span class="dm-rcl-t-et"><i aria-hidden="true">${icona}</i>${esc(etichetta)}</span>
    <b>${esc(valore)}</b>
    ${sotto ? `<small>${esc(sotto)}</small>` : ""}
  </div>`;
}

function etichettaDelSecchiello(periodo, secchiello, indice) {
  const d = new Date(secchiello.inizio);
  if (periodo.vista === "giorno") return indice % 6 === 0 ? String(d.getHours()) : "";
  if (periodo.vista === "settimana")
    return d.toLocaleDateString(locale(), { weekday: "short" }).replace(".", "");
  const giorno = d.getDate();
  return giorno === 1 || giorno % 5 === 0 ? String(giorno) : "";
}

function graficoMarkup(report) {
  const { periodo, secchielli } = report;
  const massimo = Math.max(1, ...secchielli.map((s) => s.ms));
  const adesso = Date.now();
  const scala =
    periodo.vista === "giorno" ? t("minuti per ora", "minutes per hour") : t("ore per giorno", "hours per day");
  const colonne = secchielli
    .map((s, i) => {
      const altezza = s.ms > 0 ? Math.max(3, (s.ms / massimo) * 100) : 0;
      const quando = new Date(s.inizio);
      const detto =
        periodo.vista === "giorno"
          ? `${String(quando.getHours()).padStart(2, "0")}:00`
          : quando.toLocaleDateString(locale(), { weekday: "short", day: "numeric", month: "short" });
      return `<div class="dm-rcl-col" data-futuro="${s.inizio > adesso}" title="${esc(`${detto}: ${ore(s.ms)}`)}">
        <div class="dm-rcl-barra"><i style="height:${altezza.toFixed(1)}%"></i></div>
        <small>${esc(etichettaDelSecchiello(periodo, s, i))}</small>
      </div>`;
    })
    .join("");
  const picco =
    periodo.vista === "giorno" ? `${Math.round(massimo / 60_000)} min` : `${(inOre(massimo)).toLocaleString(locale(), { maximumFractionDigits: 1 })} h`;
  return `<div class="dm-rcl-grafico-box">
    <div class="dm-rcl-grafico-testa"><b>${esc(report.stima ? t("Impianto acceso (stima)", "System on (estimate)") : report.impianto === "freddo" ? t("Impianto acceso", "System on") : t("Caldaia accesa", "Boiler on"))}</b><span>${esc(scala)} · max ${esc(picco)}</span></div>
    <div class="dm-rcl-grafico" data-passo="${periodo.passo}" data-colonne="${secchielli.length}">${colonne}</div>
  </div>`;
}

function stanzeMarkup(report) {
  const massimo = Math.max(1, ...report.stanze.map((s) => s.msRichiesta));
  return report.stanze
    .map((s, i) => {
      const quota = (s.msRichiesta / massimo) * 100;
      const acceso = ore(s.msAccesa);
      const aperta = percento(s.valvola);
      const durata = ore(s.msRichiesta);
      const ambiente = gradi(s.ambienteComfort);
      const obiettivo = gradi(s.obiettivoComfort);
      /* La temperatura e l'obiettivo delle stesse ore, quelle di comfort; senza
       * comfort (mai accesa) solo la temperatura del periodo. */
      const temperatura =
        s.obiettivoComfort === null || s.ambienteComfort === null
          ? gradi(s.ambiente)
          : t(`${ambiente} su ${obiettivo} in comfort`, `${ambiente} for ${obiettivo} in comfort`);
      /* La stanza accanto al nome, se il nome non la dice gia'. */
      const nome =
        s.stanza && !s.nome.toLowerCase().includes(s.stanza.toLowerCase()) ? `${s.nome} · ${s.stanza}` : s.nome;
      const segni = [
        s.datiScarsi
          ? `<em class="dm-rcl-segno" data-dm-rcl-segno="dati">${esc(t("dati parziali", "partial data"))}</em>`
          : "",
        s.richiestaStimata && !s.datiScarsi
          ? `<em class="dm-rcl-segno" data-dm-rcl-segno="stima">${esc(t("stima", "estimate"))}</em>`
          : "",
      ].join("");
      return `<li class="dm-rcl-stanza" data-dm-rcl-stanza="${esc(s.entity)}">
        <span class="dm-rcl-pos">${i + 1}</span>
        <div class="dm-rcl-stanza-corpo">
          <div class="dm-rcl-stanza-testa"><b>${esc(nome)}</b>${segni}<strong>${esc(ore(s.msRichiesta))}</strong></div>
          <div class="dm-rcl-stanza-barra"><i style="width:${quota.toFixed(1)}%"></i></div>
          <div class="dm-rcl-stanza-dati">
            <span data-dm-rcl-richiesta>${esc(t(`${durata} di richiesta`, `${durata} of demand`))}</span>
            <span>⏻ ${esc(t(`accesa ${acceso}`, `on ${acceso}`))}</span>
            ${s.valvola === null ? "" : `<span data-dm-rcl-valvola>🔧 ${esc(t(`valvola ${aperta}`, `valve ${aperta}`))}</span>`}
            <span data-dm-rcl-temperatura>🌡️ ${esc(temperatura)}</span>
          </div>
        </div>
      </li>`;
    })
    .join("");
}

function generatoriMarkup(report) {
  if (report.stima || report.generatori.length < 2) return "";
  return `<ul class="dm-rcl-generatori">${report.generatori
    .map(
      (g) =>
        `<li><span>🔥 ${esc(g.nome)}</span><b>${esc(ore(g.ms))}</b><small>${esc(accensioniDette(g.accensioni))}</small></li>`,
    )
    .join("")}</ul>`;
}

/* Le unita' che nel periodo non hanno mai lavorato per questo impianto non
 * stanno in elenco: si dice quante, perche' contarle e non trovarle sarebbe
 * peggio. */
function nascosteDette(quante) {
  if (!quante) return "";
  return quante === 1
    ? t(
        "Un'unità non ha mai lavorato per questo impianto nel periodo e non è in elenco.",
        "One unit never worked for this system in the period and is not listed.",
      )
    : t(
        `${quante} unità non hanno mai lavorato per questo impianto nel periodo e non sono in elenco.`,
        `${quante} units never worked for this system in the period and are not listed.`,
      );
}

function notaMarkup(report) {
  const fonte = [
    t(
      "Dalla storia di Home Assistant: ogni stato vale fino al successivo, e i momenti senza dati non contano.",
      "From the Home Assistant history: each state lasts until the next one, and moments without data do not count.",
    ),
    report.impianto === "freddo"
      ? t(
          "In comfort: le ore accese con l'obiettivo sotto quello ridotto della stanza.",
          "In comfort: the hours on with a target below the room's setback.",
        )
      : t(
          "In comfort: le ore accese con l'obiettivo sopra quello ridotto della stanza (la notte abbassata non conta).",
          "In comfort: the hours on with a target above the room's setback (the lowered night does not count).",
        ),
    nascosteDette(report.nascoste),
  ]
    .filter(Boolean)
    .join(" ");
  if (!report.stima) return `<p class="dm-rcl-nota">${esc(fonte)}</p>`;
  const stima =
    report.impianto === "freddo"
      ? t(
          "Il tempo dell'impianto è una stima: è acceso quando almeno una stanza chiede fresco.",
          "The system time is an estimate: it counts as on whenever at least one room asks for cooling.",
        )
      : t(
          "Nessuna caldaia con una storia: il tempo è una stima, acceso quando almeno una stanza chiede calore. La caldaia si configura in Config › Gestione termica.",
          "No boiler with a history: the time is an estimate, on whenever at least one room asks for heat. Set the boiler up in Config › Thermal management.",
        );
  return `<p class="dm-rcl-nota" data-dm-rcl-stima>ⓘ ${esc(stima)}</p><p class="dm-rcl-nota">${esc(fonte)}</p>`;
}

function contenutoMarkup(report) {
  if (report.vuoto)
    return `<div class="dm-rcl-vuoto"><span aria-hidden="true">📭</span><b>${esc(t("Nessun dato in questo periodo", "No data in this period"))}</b><small>${esc(t("Home Assistant non ha registrato niente di questi termostati: prova un altro periodo.", "Home Assistant recorded nothing for these thermostats: try another period."))}</small></div>`;
  const tot = report.totali;
  const valvole = report.stanze.filter((s) => s.valvola !== null).length;
  const quante = report.stanze.length;
  const obiettivo = gradi(tot.obiettivoComfort);
  const inComfort = tot.ambienteComfort !== null && tot.obiettivoComfort !== null;
  const caldo = report.impianto !== "freddo";
  const titoloGeneratore = report.stima
    ? t("Impianto (stima)", "System (estimate)")
    : caldo
      ? report.generatori.length > 1
        ? t("Caldaie", "Boilers")
        : report.generatori[0]?.nome || t("Caldaia", "Boiler")
      : t("Impianto", "System");
  return `<div class="dm-rcl-tessere">
      ${tessera(caldo ? "🔥" : "❄️", titoloGeneratore, ore(tot.msGeneratore), accensioniDette(tot.accensioni), `data-dm-rcl-tessera="generatore"${report.stima ? " data-stima" : ""}`)}
      ${tessera("⏱️", t("Richiesta stanze", "Room demand"), ore(tot.msRichiesta), t(`${quante} stanze`, `${quante} rooms`), 'data-dm-rcl-tessera="richiesta"')}
      ${
        inComfort
          ? tessera("🌡️", t("Temperatura in comfort", "Comfort temperature"), gradi(tot.ambienteComfort), t(`obiettivo in comfort ${obiettivo}`, `comfort target ${obiettivo}`), 'data-dm-rcl-tessera="temperatura"')
          : tessera("🌡️", t("Temperatura media", "Average temperature"), gradi(tot.ambiente), "", 'data-dm-rcl-tessera="temperatura"')
      }
      ${tessera("🔧", t("Valvola media", "Average valve"), percento(tot.valvola), valvole ? t(`${valvole} valvole`, `${valvole} valves`) : t("nessuna valvola", "no valve"), 'data-dm-rcl-tessera="valvola"')}
    </div>
    ${generatoriMarkup(report)}
    ${graficoMarkup(report)}
    <div class="dm-rcl-sezione"><b>${esc(t("Le stanze", "The rooms"))}</b><span>${esc(t("per ore di richiesta", "by hours of demand"))}</span></div>
    <ol class="dm-rcl-stanze">${stanzeMarkup(report)}</ol>
    ${notaMarkup(report)}`;
}

function testataMarkup(impianti, periodo) {
  const linguette = impianti
    .map(
      (id) =>
        `<button type="button" data-dm-rcl-impianto="${id}" aria-pressed="${id === state.impianto}">${id === "freddo" ? "❄️" : "🔥"} ${esc(nomeDellImpianto(id))}</button>`,
    )
    .join("");
  const viste = VISTE_DEL_REPORT.map(
    (v) => `<button type="button" data-dm-rcl-vista="${v}" aria-pressed="${v === state.vista}">${esc(nomeDellaVista(v))}</button>`,
  ).join("");
  return `<div class="dm-rcl-testa">
      <span class="dm-rcl-ic" aria-hidden="true">📊</span>
      <div><h2 id="dm-rcl-titolo">${esc(t("Report del clima", "Climate report"))}</h2><p>${esc(nomeDellImpianto(state.impianto))}</p></div>
      <button type="button" class="dm-rcl-chiudi" data-dm-rcl-chiudi aria-label="${esc(t("Chiudi", "Close"))}">✕</button>
    </div>
    ${impianti.length > 1 ? `<div class="dm-rcl-impianti" role="tablist">${linguette}</div>` : ""}
    <div class="dm-rcl-periodo">
      <div class="dm-rcl-viste">${viste}</div>
      <div class="dm-rcl-naviga">
        <button type="button" data-dm-rcl-sposta="-1" aria-label="${esc(t("Periodo prima", "Previous period"))}">‹</button>
        <b data-dm-rcl-quando>${esc(titoloDelPeriodo(periodo))}</b>
        <button type="button" data-dm-rcl-sposta="1" ${periodo.inCorso ? "disabled" : ""} aria-label="${esc(t("Periodo dopo", "Next period"))}">›</button>
      </div>
    </div>`;
}

function velo() {
  let nodo = doc.getElementById("dm-rcl");
  if (nodo) return nodo;
  nodo = doc.createElement("div");
  nodo.id = "dm-rcl";
  nodo.className = "dm-rcl-velo";
  nodo.hidden = true;
  nodo.innerHTML = `<section class="dm-rcl-foglio" role="dialog" aria-modal="true" aria-labelledby="dm-rcl-titolo"><div data-dm-rcl-testa></div><div class="dm-rcl-corpo" data-dm-rcl-corpo></div></section>`;
  doc.body.appendChild(nodo);
  nodo.addEventListener("click", tocco);
  return nodo;
}

async function disegna() {
  const nodo = velo();
  const unita = unitaDelReport();
  const impianti = impiantiPresenti(unita);
  if (!impianti.includes(state.impianto)) state.impianto = impianti[0] || "caldo";
  const periodo = periodoDelReport(state.vista, new Date(state.giorno), new Date());
  nodo.dataset.dmRclZona = state.impianto;
  nodo.querySelector("[data-dm-rcl-testa]").innerHTML = testataMarkup(impianti, periodo);
  const corpo = nodo.querySelector("[data-dm-rcl-corpo]");
  const giro = ++state.giro;
  corpo.innerHTML = `<div class="dm-rcl-carica"><span class="dm-rcl-spin"></span>${esc(t("Leggo la storia…", "Reading the history…"))}</div>`;
  const delReport = unitaDellImpianto(state.impianto, unita);
  const generatori = state.impianto === "caldo" ? caldaieDelReport() : [];
  const entita = [
    ...new Set([
      ...delReport.map((u) => u.entity),
      ...delReport.map((u) => u.valvola).filter(Boolean),
      ...generatori.map((g) => g.entity),
    ]),
  ];
  const storie = {};
  let errori = 0;
  await Promise.all(
    entita.map(async (entity) => {
      try {
        storie[entity] = await storiaDi(entity, periodo);
      } catch (_errore) {
        errori += 1;
      }
    }),
  );
  if (giro !== state.giro || !state.aperto) return;
  if (errori && errori === entita.length) {
    corpo.innerHTML = `<div class="dm-rcl-vuoto"><span aria-hidden="true">⚠️</span><b>${esc(t("La storia non risponde", "The history does not answer"))}</b><small>${esc(t("Home Assistant non ha mandato la storia di questi termostati. Riprova fra poco.", "Home Assistant did not send the history of these thermostats. Try again shortly."))}</small></div>`;
    return;
  }
  const report = reportDellImpianto({ impianto: state.impianto, unita, storie, generatori, periodo });
  corpo.innerHTML = contenutoMarkup(report);
  root.__DM_REPORT_CLIMA_ULTIMO__ = report;
}

function tocco(evento) {
  const bersaglio = evento.target;
  if (bersaglio === evento.currentTarget || bersaglio.closest?.("[data-dm-rcl-chiudi]")) {
    chiudiIlReport();
    return;
  }
  /* Si cerca dentro la testata: il velo porta la sua zona in un attributo
   * suo, e un tocco qualunque non deve cambiare impianto. */
  const impianto = bersaglio.closest?.("button[data-dm-rcl-impianto]")?.dataset.dmRclImpianto;
  if (impianto) {
    state.impianto = impianto;
    disegna();
    return;
  }
  const vista = bersaglio.closest?.("[data-dm-rcl-vista]")?.dataset.dmRclVista;
  if (vista) {
    state.vista = vista;
    disegna();
    return;
  }
  const sposta = bersaglio.closest?.("[data-dm-rcl-sposta]");
  if (sposta && !sposta.disabled) {
    state.giorno = spostaIlPeriodo(state.vista, new Date(state.giorno), Number(sposta.dataset.dmRclSposta)).getTime();
    disegna();
  }
}

function tasto(evento) {
  if (evento.key === "Escape" && state.aperto) chiudiIlReport();
}

/** Apre il report: dell'impianto che la pagina sta mostrando, di serie. */
export function apriIlReportDelClima(impianto = "") {
  const zonaVista = doc.querySelector(".clima-zone-freddo.show") ? "freddo" : "caldo";
  const scelto = clean(impianto) || zonaVista;
  state.impianto = scelto === "freddo" ? "freddo" : "caldo";
  state.aperto = true;
  const nodo = velo();
  nodo.hidden = false;
  doc.documentElement.classList.add("dm-rcl-aperto");
  disegna();
  nodo.querySelector(".dm-rcl-chiudi")?.focus?.({ preventScroll: true });
  return true;
}

export function chiudiIlReport() {
  state.aperto = false;
  state.giro += 1;
  const nodo = doc.getElementById("dm-rcl");
  if (nodo) nodo.hidden = true;
  doc.documentElement.classList.remove("dm-rcl-aperto");
}

const CSS = `
html.dm-rcl-aperto{overflow:hidden}
.dm-rcl-velo{
  --rcl-card:var(--card-bg,#fff);--rcl-soft:var(--surface-2,#f7f9fc);--rcl-sunk:var(--surface-3,#eef2f8);
  --rcl-line:var(--card-border,#e6ecf3);--rcl-text:var(--text,#0f172a);--rcl-dim:var(--text-dim,#64748b);
  --rcl-c:234,88,12;
  position:fixed;inset:0;z-index:10050;display:flex;align-items:center;justify-content:center;
  padding:24px;background:rgba(15,23,42,.42);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)
}
.dm-rcl-velo[hidden]{display:none}
.dm-rcl-velo[data-dm-rcl-zona="freddo"]{--rcl-c:14,165,233}
html[data-theme="dark"] .dm-rcl-velo{
  --rcl-card:var(--card-bg,#151b26);--rcl-soft:var(--surface-2,#1b2230);--rcl-sunk:var(--surface-3,#232c3d);
  --rcl-line:var(--card-border,#2a3445);--rcl-text:var(--text,#e8edf5);--rcl-dim:var(--text-dim,#94a3b8);
  --rcl-c:251,146,60;background:rgba(0,0,0,.6)
}
html[data-theme="dark"] .dm-rcl-velo[data-dm-rcl-zona="freddo"]{--rcl-c:56,189,248}
.dm-rcl-foglio{
  width:min(760px,100%);max-height:min(900px,100%);overflow:auto;overscroll-behavior:contain;
  background:var(--rcl-card);color:var(--rcl-text);border:1px solid var(--rcl-line);border-radius:24px;
  box-shadow:0 30px 80px rgba(15,23,42,.28);padding:18px 20px 22px;box-sizing:border-box
}
.dm-rcl-testa{display:flex;align-items:center;gap:12px}
.dm-rcl-ic{display:grid;place-items:center;width:42px;height:42px;border-radius:14px;font-size:20px;background:rgba(var(--rcl-c),.14)}
.dm-rcl-testa div{flex:1;min-width:0}
.dm-rcl-testa h2{margin:0;padding:0;border:0;font-family:inherit;font-size:18px;font-weight:800;letter-spacing:-.3px;text-transform:none;color:var(--rcl-text)}
.dm-rcl-testa p{margin:1px 0 0;font-size:12px;font-weight:700;color:rgb(var(--rcl-c))}
.dm-rcl-chiudi{width:36px;height:36px;border-radius:12px;border:1px solid var(--rcl-line);background:var(--rcl-soft);color:var(--rcl-dim);font-size:15px;cursor:pointer}
.dm-rcl-impianti,.dm-rcl-viste{display:flex;gap:4px;padding:4px;border-radius:14px;background:var(--rcl-sunk)}
.dm-rcl-impianti{margin-top:14px}
.dm-rcl-impianti button,.dm-rcl-viste button{flex:1;border:0;border-radius:10px;padding:9px 10px;background:transparent;color:var(--rcl-dim);font:inherit;font-size:13px;font-weight:800;cursor:pointer}
.dm-rcl-impianti button[aria-pressed="true"],.dm-rcl-viste button[aria-pressed="true"]{background:var(--rcl-card);color:var(--rcl-text);box-shadow:0 1px 4px rgba(15,23,42,.12)}
.dm-rcl-impianti button[aria-pressed="true"]{color:rgb(var(--rcl-c))}
.dm-rcl-periodo{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:10px}
.dm-rcl-periodo .dm-rcl-viste{flex:1 1 260px}
.dm-rcl-naviga{display:flex;align-items:center;gap:6px;flex:1 1 260px}
.dm-rcl-naviga b{flex:1;text-align:center;font-size:14px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dm-rcl-naviga button{width:36px;height:36px;border-radius:12px;border:1px solid var(--rcl-line);background:var(--rcl-soft);color:var(--rcl-text);font-size:18px;font-weight:800;cursor:pointer}
.dm-rcl-naviga button:disabled{opacity:.35;cursor:default}
.dm-rcl-corpo{margin-top:14px}
.dm-rcl-tessere{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.dm-rcl-tessera{display:flex;flex-direction:column;gap:2px;padding:12px 13px;border-radius:16px;border:1px solid var(--rcl-line);background:var(--rcl-soft);min-width:0}
.dm-rcl-tessera[data-dm-rcl-tessera="generatore"]{background:rgba(var(--rcl-c),.1);border-color:rgba(var(--rcl-c),.3)}
.dm-rcl-t-et{display:flex;align-items:flex-start;gap:5px;font-size:10px;line-height:1.3;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:var(--rcl-dim)}
.dm-rcl-t-et i{font-style:normal;font-size:13px}
.dm-rcl-tessera b{font-size:20px;font-weight:800;letter-spacing:-.4px;font-variant-numeric:tabular-nums;white-space:nowrap}
.dm-rcl-tessera small{font-size:11px;font-weight:700;color:var(--rcl-dim)}
.dm-rcl-generatori{list-style:none;margin:10px 0 0;padding:0;display:grid;gap:6px}
.dm-rcl-generatori li{display:flex;align-items:baseline;gap:10px;padding:8px 12px;border-radius:12px;background:var(--rcl-soft);font-size:13px}
.dm-rcl-generatori li span{flex:1;font-weight:700}
.dm-rcl-generatori li small{color:var(--rcl-dim);font-weight:700}
.dm-rcl-grafico-box{margin-top:14px;padding:12px 14px 8px;border-radius:18px;border:1px solid var(--rcl-line)}
.dm-rcl-grafico-testa{display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px 10px;font-size:12px}
.dm-rcl-grafico-testa b{font-weight:800}
.dm-rcl-grafico-testa span{color:var(--rcl-dim);font-weight:700}
.dm-rcl-grafico{display:flex;align-items:stretch;gap:3px;height:150px;margin-top:10px}
.dm-rcl-col{flex:1;display:flex;flex-direction:column;align-items:stretch;min-width:0}
.dm-rcl-barra{flex:1;display:flex;align-items:flex-end;border-radius:6px;background:var(--rcl-sunk)}
.dm-rcl-barra i{display:block;width:100%;border-radius:6px;background:linear-gradient(180deg,rgba(var(--rcl-c),1),rgba(var(--rcl-c),.7))}
.dm-rcl-col[data-futuro="true"] .dm-rcl-barra{opacity:.4}
.dm-rcl-col small{height:16px;margin-top:4px;text-align:center;font-size:10px;font-weight:700;color:var(--rcl-dim);white-space:nowrap;overflow:visible}
.dm-rcl-sezione{display:flex;align-items:baseline;gap:8px;margin:18px 2px 8px}
.dm-rcl-sezione b{font-size:15px;font-weight:800}
.dm-rcl-sezione span{font-size:12px;color:var(--rcl-dim);font-weight:700}
.dm-rcl-stanze{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.dm-rcl-stanza{display:flex;gap:12px;align-items:flex-start;padding:12px 14px;border-radius:16px;border:1px solid var(--rcl-line);background:var(--rcl-card)}
.dm-rcl-pos{display:grid;place-items:center;flex:none;width:26px;height:26px;border-radius:9px;background:rgba(var(--rcl-c),.14);color:rgb(var(--rcl-c));font-size:12px;font-weight:800}
.dm-rcl-stanza-corpo{flex:1;min-width:0}
.dm-rcl-stanza-testa{display:flex;align-items:center;gap:8px}
.dm-rcl-stanza-testa b{font-size:14px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dm-rcl-stanza-testa strong{margin-left:auto;font-size:15px;font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap}
.dm-rcl-segno{flex:none;font-style:normal;font-size:10px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;padding:2px 7px;border-radius:999px;background:var(--rcl-sunk);color:var(--rcl-dim)}
.dm-rcl-segno[data-dm-rcl-segno="dati"]{background:rgba(234,179,8,.18);color:#a16207}
html[data-theme="dark"] .dm-rcl-segno[data-dm-rcl-segno="dati"]{color:#facc15}
.dm-rcl-stanza-barra{height:8px;margin:8px 0;border-radius:999px;background:var(--rcl-sunk);overflow:hidden}
.dm-rcl-stanza-barra i{display:block;height:100%;border-radius:999px;background:rgb(var(--rcl-c))}
.dm-rcl-stanza-dati{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12px;font-weight:700;color:var(--rcl-dim)}
.dm-rcl-stanza-dati span:first-child{color:rgb(var(--rcl-c))}
.dm-rcl-nota{margin:12px 2px 0;font-size:11.5px;line-height:1.45;color:var(--rcl-dim)}
.dm-rcl-nota[data-dm-rcl-stima]{padding:10px 12px;border-radius:12px;background:rgba(var(--rcl-c),.08);color:var(--rcl-text);font-weight:600}
.dm-rcl-carica,.dm-rcl-vuoto{display:flex;flex-direction:column;align-items:center;gap:8px;padding:48px 16px;text-align:center;color:var(--rcl-dim);font-size:13px;font-weight:700}
.dm-rcl-vuoto span{font-size:30px}
.dm-rcl-vuoto b{color:var(--rcl-text);font-size:15px}
.dm-rcl-spin{width:26px;height:26px;border-radius:50%;border:3px solid var(--rcl-sunk);border-top-color:rgb(var(--rcl-c));animation:dm-rcl-gira .8s linear infinite}
@keyframes dm-rcl-gira{to{transform:rotate(360deg)}}
@media (max-width:640px){
  .dm-rcl-velo{padding:0;align-items:stretch}
  .dm-rcl-foglio{width:100%;max-height:none;height:100%;border-radius:0;border:0;padding:max(14px,env(safe-area-inset-top)) 14px max(20px,env(safe-area-inset-bottom))}
  .dm-rcl-tessere{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
  .dm-rcl-tessera b{font-size:18px}
  .dm-rcl-grafico{height:130px;gap:2px}
  .dm-rcl-grafico[data-colonne="24"] .dm-rcl-col small,.dm-rcl-grafico[data-colonne="31"] .dm-rcl-col small{font-size:9px}
}
`;

export function installReportDelClima() {
  if (state.installed || !doc) return false;
  state.installed = true;
  installStyle(STYLE_ID, CSS);
  root.apriIlReportDelClima = apriIlReportDelClima;
  doc.addEventListener("click", (evento) => {
    if (evento.target?.closest?.("[data-dm-rcl-apri]")) apriIlReportDelClima();
  });
  doc.addEventListener("keydown", tasto);
  return true;
}
