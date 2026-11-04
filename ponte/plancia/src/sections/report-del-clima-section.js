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
  righeDellaStoria,
  spostaIlPeriodo,
  unitaDellImpianto,
} from "../core/report-del-clima.js";
import { normalizzaCaldaie } from "../core/impianti-termici.js";
import { temperatureEntries } from "../core/room-overview.js";
import {
  CASELLE_CHE_LAVORANO,
  GIORNI_CON_LE_ORE,
  domandaStatisticheDelClima,
  giorniDelPeriodo,
  oreDelleStatistiche,
  reportDaiGiorni,
  riassuntoDalleStatistiche,
  unitaDelleStatistiche,
  riassuntoDelGiorno,
} from "../core/storico-del-clima.js";
import { conIlConsumoTrovato } from "../core/consumo-trovato-del-clima.js";
import { iDispositiviRicordati } from "../core/i-dispositivi-di-home-assistant.js";
import { climateUnits } from "./climate-thermal-section.js";
import { statiDelleCaldaie } from "./termico-del-caldo-section.js";
import { allStates, clean, doc, esc, installStyle, locale, root, section, t } from "./shared.js";

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
  const aggiungi = (nome, entity, statistiche = []) => {
    const vera = risolvi(entity);
    if (!vera || viste.has(vera)) return;
    viste.add(vera);
    fuori.push({
      nome: clean(nome) || t("Caldaia", "Boiler"),
      entity: vera,
      /* Per i giorni che la storia non ha piu': le caselle numeriche della
       * caldaia hanno statistiche (la modulazione, i watt, le ore), lo stato
       * acceso/spento no. */
      statistiche: [...new Set([vera, ...statistiche.map(risolvi).filter(Boolean)])],
    });
  };
  let righe = [];
  try {
    righe = normalizzaCaldaie(root.cdCfg?.("cd_caldaia"));
  } catch (_errore) {}
  for (const riga of righe)
    aggiungi(
      riga.name,
      riga.stato || riga.fiamma || riga.modulazione,
      CASELLE_CHE_LAVORANO.map((campo) => riga[campo]).filter(Boolean),
    );
  try {
    for (const caldaia of statiDelleCaldaie()) aggiungi(caldaia.nome, caldaia.entity);
  } catch (_errore) {}
  return fuori;
}

/* Il sensore di temperatura della stanza di un'unita': per i giorni vecchi e'
 * l'unica temperatura che Home Assistant ha conservato — un `climate` non ha
 * statistiche, un sensore con `state_class` si'. */
function sensoreDellaStanza(unita, stanze) {
  const nome = clean(unita?.room).toLowerCase();
  if (!nome) return "";
  const stanza = stanze.find(
    (r) => clean(r?.name).toLowerCase() === nome || clean(r?.id).toLowerCase() === nome,
  );
  return stanza ? risolvi(temperatureEntries(stanza).find((e) => clean(e.temp))?.temp) : "";
}

/* Le unita' del report, coi loro sensori. Chi non ha scritto la presa nella
 * scheda e non ha la valvola prende i consumi che il climatizzatore stesso
 * pubblica, dal suo dispositivo (`core/consumo-trovato-del-clima.js`): sono
 * quelli che le statistiche conservano per i mesi passati. */
function unitaDelReport() {
  let stanze = [];
  try {
    stanze = section("rooms", []) || [];
  } catch (_errore) {}
  try {
    const unita = climateUnits().map((u) => ({
      ...u,
      entity: risolvi(u.entity),
      valvola: risolvi(u.valvola),
      consumo: risolvi(u.consumo),
      temperatura: sensoreDellaStanza(u, Array.isArray(stanze) ? stanze : []),
    }));
    let di = {};
    let stati = {};
    try {
      di = iDispositiviRicordati().di || {};
      stati = allStates() || {};
    } catch (_errore) {}
    return conIlConsumoTrovato(unita, { di, stato: (id) => stati[id] || null });
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

/* L'archivio del ponte: i giorni che ha messo da parte, per chiave. Chi apre
 * la plancia fuori dal ponte (o con un ponte vecchio) non ce l'ha: si va
 * avanti con la storia e le statistiche, senza dirlo come un errore. */
async function archivioDelPonte(giorni) {
  const chiusi = giorni.filter((g) => g.chiuso);
  if (!chiusi.length) return {};
  const da = chiusi[0].chiave;
  const a = chiusi.at(-1).chiave;
  const chiave = `archivio|${da}|${a}`;
  if (state.cache.has(chiave)) return state.cache.get(chiave);
  const b = broker();
  if (!b?.request) return {};
  try {
    const risposta = await b.request({ type: "ponte/clima/storico", da, a }, 6_000);
    const dentro = risposta?.giorni && typeof risposta.giorni === "object" ? risposta.giorni : {};
    state.cache.set(chiave, dentro);
    return dentro;
  } catch (_errore) {
    return {};
  }
}

/* Le statistiche a lungo termine, un'ora alla volta, di tutte le entita'
 * insieme: una domanda sola al Recorder. */
async function statisticheDi(ids, da, a) {
  if (!ids.length || a <= da) return {};
  const chiave = `statistiche|${ids.join(",")}|${da}|${a}`;
  if (state.cache.has(chiave)) return state.cache.get(chiave);
  const b = broker();
  if (!b?.request) throw new Error("broker");
  const risposta = await b.request(domandaStatisticheDelClima(ids, da, a), 30_000);
  const serie = Object.fromEntries(ids.map((id) => [id, oreDelleStatistiche(risposta, id)]));
  state.cache.set(chiave, serie);
  return serie;
}

/* L'unita' in cui arrivano le statistiche di un'entita': la domanda le
 * chiede gia' in W e kWh (`domandaStatisticheDelClima`), e dall'unita' di
 * adesso si capisce solo di che specie sono. */
function unitaDi(id) {
  try {
    return unitaDelleStatistiche(clean(allStates()?.[id]?.attributes?.unit_of_measurement));
  } catch (_errore) {
    return "";
  }
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

/* «—» quando non si sa: zero sarebbe una misura. */
const ore = (ms) => (ms === null || ms === undefined ? "—" : oreScritte(ms));

const accensioniDette = (n) =>
  n === null || n === undefined
    ? t("accensioni non note", "starts unknown")
    : n === 1
      ? t("1 accensione", "1 start")
      : t(`${n} accensioni`, `${n} starts`);

/* «1 stanze», «1 valvole»: un numero solo si dice al singolare. */
const stanzeDette = (n) => (n === 1 ? t("1 stanza", "1 room") : t(`${n} stanze`, `${n} rooms`));
const valvoleDette = (n) =>
  n === 0 ? t("nessuna valvola", "no valve") : n === 1 ? t("1 valvola", "1 valve") : t(`${n} valvole`, `${n} valves`);

const numeroDetto = (valore, cifre = 1) =>
  valore.toLocaleString(locale(), { minimumFractionDigits: 0, maximumFractionDigits: cifre });

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

/* Il grafico quando nessuna fonte sa le ore dell'impianto: barre vuote
 * sembrerebbero «spento ogni giorno». Si dice invece che non si sa, e cosa
 * servirebbe per saperlo. */
function graficoIgnotoMarkup(report) {
  const freddo = report.impianto === "freddo";
  return `<div class="dm-rcl-grafico-box" data-dm-rcl-grafico-ignoto>
    <div class="dm-rcl-grafico-testa"><b>${esc(freddo ? t("Impianto acceso", "System on") : t("Caldaia accesa", "Boiler on"))}</b><span>${esc(t("non noto", "unknown"))}</span></div>
    <div class="dm-rcl-ignoto"><span aria-hidden="true">❔</span><p>${esc(
      freddo
        ? t(
            "Per questo periodo Home Assistant non ha dati sull'accensione dei climatizzatori: né la storia, né statistiche di consumo.",
            "For this period Home Assistant has no data on when the air conditioners ran: no history and no power statistics.",
          )
        : t(
            "Per questo periodo Home Assistant non ha dati sull'accensione dell'impianto: né la storia, né statistiche di valvole, consumi o caldaia.",
            "For this period Home Assistant has no data on when the system ran: no history and no valve, power or boiler statistics.",
          ),
    )}</p></div>
  </div>`;
}

function graficoMarkup(report) {
  if (report.totali?.msGeneratore === null) return graficoIgnotoMarkup(report);
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
      /* Una colonna che nessuna fonte sa non e' zero: si disegna tratteggiata. */
      const ignota = s.noto === false && s.inizio <= adesso;
      return `<div class="dm-rcl-col" data-futuro="${s.inizio > adesso}"${ignota ? " data-ignota" : ""} title="${esc(`${detto}: ${ignota ? t("non noto", "unknown") : ore(s.ms)}`)}">
        <div class="dm-rcl-barra"><i style="height:${altezza.toFixed(1)}%"></i></div>
        <small>${esc(etichettaDelSecchiello(periodo, s, i))}</small>
      </div>`;
    })
    .join("");
  const picco =
    periodo.vista === "giorno" ? `${Math.round(massimo / 60_000)} min` : `${(inOre(massimo)).toLocaleString(locale(), { maximumFractionDigits: 1 })} h`;
  /* Un grafico vuoto deve dire perche' e' vuoto: a righe grigie, senza una
   * parola, sembrava rotto. Si contano le colonne passate: quelle che nessuna
   * fonte sa (a righe) e quelle che si sanno e sono zero. */
  const passate = secchielli.filter((s) => s.inizio <= adesso);
  const ignote = passate.filter((s) => s.noto === false).length;
  const accese = passate.filter((s) => s.noto !== false && s.ms > 0).length;
  const avviso =
    passate.length && ignote === passate.length
      ? t("Nessun dato per questo periodo: le colonne a righe non sono zero, non si sanno.", "No data for this period: the striped columns are not zero, they are unknown.")
      : !accese && passate.length
        ? report.impianto === "freddo"
          ? t("Nessuna accensione in questo periodo.", "Nothing ran in this period.")
          : t("La caldaia non si è mai accesa in questo periodo.", "The boiler never ran in this period.")
        : "";
  const n = ignote;
  const senzaDati =
    periodo.vista === "giorno"
      ? n === 1
        ? t("1 ora senza dati", "1 hour without data")
        : t(`${n} ore senza dati`, `${n} hours without data`)
      : n === 1
        ? t("1 giorno senza dati", "1 day without data")
        : t(`${n} giorni senza dati`, `${n} days without data`);
  const legenda =
    ignote && ignote < passate.length
      ? `<p class="dm-rcl-legenda"><i aria-hidden="true"></i>${esc(senzaDati)}</p>`
      : "";
  return `<div class="dm-rcl-grafico-box">
    <div class="dm-rcl-grafico-testa"><b>${esc(report.stima ? t("Impianto acceso (stima)", "System on (estimate)") : report.impianto === "freddo" ? t("Impianto acceso", "System on") : t("Caldaia accesa", "Boiler on"))}</b><span>${esc(scala)}${accese ? ` · max ${esc(picco)}` : ""}</span></div>
    <div class="dm-rcl-grafico-area">
      <div class="dm-rcl-grafico" data-passo="${periodo.passo}" data-colonne="${secchielli.length}">${colonne}</div>
      ${avviso ? `<p class="dm-rcl-grafico-vuoto" data-dm-rcl-grafico-vuoto>${esc(avviso)}</p>` : ""}
    </div>
    ${legenda}
  </div>`;
}

function stanzeMarkup(report) {
  const massimo = Math.max(1, ...report.stanze.map((s) => s.msRichiesta || 0));
  return report.stanze
    .map((s, i) => {
      const quota = ((s.msRichiesta || 0) / massimo) * 100;
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
      /* «dati parziali» anche quando la richiesta si sa solo per alcuni giorni
       * del periodo: gli altri vengono dalle statistiche e non la dicono. */
      const parziali = s.datiScarsi || s.richiestaParziale;
      const segni = [
        parziali
          ? `<em class="dm-rcl-segno" data-dm-rcl-segno="dati">${esc(t("dati parziali", "partial data"))}</em>`
          : "",
        s.richiestaStimata && !parziali
          ? `<em class="dm-rcl-segno" data-dm-rcl-segno="stima">${esc(t("stima", "estimate"))}</em>`
          : "",
      ].join("");
      /* Da dove viene la richiesta, quando non e' la storia: la valvola, i
       * watt, o — per una pompa di calore conosciuta solo dai watt — la
       * stagione. Senza nessuna delle tre, la richiesta non si sa. */
      const richiestaDetta =
        s.msRichiesta === null
          ? t("richiesta non nota", "demand unknown")
          : s.stimaDa?.includes("valvola")
            ? t(`${durata} di richiesta, dalla valvola`, `${durata} of demand, from the valve`)
            : s.stimaDa?.includes("dispositivo")
              ? t(
                  `${durata} di richiesta, dai consumi del climatizzatore`,
                  `${durata} of demand, from the air conditioner's power draw`,
                )
              : s.stimaDa?.length
              ? t(`${durata} di richiesta, dai consumi`, `${durata} of demand, from the power draw`)
              : t(`${durata} di richiesta`, `${durata} of demand`);
      const kwh =
        s.kwh === null || s.kwh === undefined
          ? ""
          : `<span data-dm-rcl-kwh>⚡ ${esc(`${numeroDetto(s.kwh)} kWh`)}</span>`;
      return `<li class="dm-rcl-stanza" data-dm-rcl-stanza="${esc(s.entity)}">
        <span class="dm-rcl-pos">${i + 1}</span>
        <div class="dm-rcl-stanza-corpo">
          <div class="dm-rcl-stanza-testa"><b>${esc(nome)}</b>${segni}<strong>${esc(ore(s.msRichiesta))}</strong></div>
          <div class="dm-rcl-stanza-barra"><i style="width:${quota.toFixed(1)}%"></i></div>
          <div class="dm-rcl-stanza-dati">
            <span data-dm-rcl-richiesta${s.msRichiesta === null ? " data-ignota" : ""}>${esc(richiestaDetta)}</span>
            ${s.msAccesa === null ? "" : `<span>⏻ ${esc(t(`accesa ${acceso}`, `on ${acceso}`))}</span>`}
            ${s.valvola === null ? "" : `<span data-dm-rcl-valvola>🔧 ${esc(t(`valvola ${aperta}`, `valve ${aperta}`))}</span>`}
            <span data-dm-rcl-temperatura>🌡️ ${esc(temperatura)}</span>
            ${kwh}
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
        `<li><span>🔥 ${esc(g.nome)}</span><b>${esc(ore(g.ms))}</b><small>${esc(g.accensioni === null && g.consumo !== null ? `${numeroDetto(g.consumo)} ${g.unitaConsumo}` : accensioniDette(g.accensioni))}</small></li>`,
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

/* Da dove vengono i numeri: una riga per fonte, solo per quelle usate. Un
 * giorno solo si dice al singolare: «1 giorni» non lo scrive nessuno. */
function fontiDette(report) {
  const f = report.fonti || {};
  const archivio = f.archivio || 0;
  const righe = [];
  if (archivio === 1)
    righe.push(
      t(
        "Un giorno dall'archivio di GdAHome, che ogni notte mette da parte il giorno prima.",
        "One day from the GdAHome archive, which sets the previous day aside every night.",
      ),
    );
  else if (archivio)
    righe.push(
      t(
        `${archivio} giorni dall'archivio di GdAHome, che ogni notte mette da parte il giorno prima.`,
        `${archivio} days from the GdAHome archive, which sets the previous day aside every night.`,
      ),
    );
  if (f.storia || archivio)
    righe.push(
      t(
        "Dalla storia di Home Assistant: ogni stato vale fino al successivo, e i momenti senza dati non contano.",
        "From the Home Assistant history: each state lasts until the next one, and moments without data do not count.",
      ),
    );
  return righe;
}

/* Da cosa sono stimate le ore nei giorni delle statistiche — o, se non c'e'
 * niente da cui stimarle, che cosa servirebbe. Solo quello che e' vero per
 * questo report: «dai watt della presa» detto a chi la presa non ce l'ha
 * era il contrario di un aiuto. */
function fontiDellaStima(report) {
  const da = new Set(report.stanze.flatMap((s) => s.stimaDa || []));
  const freddo = report.impianto === "freddo";
  const parti = [];
  if (da.has("valvola")) parti.push(t("dalla valvola aperta", "from the open valve"));
  if (da.has("consumo") || da.has("stagione"))
    parti.push(t("dai watt della presa", "from the plug's watts"));
  if (da.has("dispositivo"))
    parti.push(
      t(
        "dai consumi che il climatizzatore stesso pubblica in Home Assistant",
        "from the power draw the air conditioner itself publishes in Home Assistant",
      ),
    );
  const ignote = report.stanze.filter((s) => s.msRichiesta === null).length;
  const frasi = [];
  const fonti = parti.join(", ");
  if (parti.length)
    frasi.push(
      t(
        `Le ore di richiesta sono stimate ${fonti}, e il comfort non si conosce.`,
        `The hours of demand are estimated ${fonti}, and the comfort is unknown.`,
      ),
    );
  if (!freddo)
    frasi.push(
      t(
        "Le accensioni della caldaia, dalle statistiche, non si possono contare.",
        "The boiler starts cannot be counted from the statistics.",
      ),
    );
  if (ignote)
    frasi.push(
      freddo
        ? t(
            "Per le stanze con «richiesta non nota» Home Assistant ha conservato solo la temperatura: le ore dei mesi passati si possono avere solo da un sensore di consumo del climatizzatore, o da una presa smart da indicare nella sua scheda (Config › Clima). Da adesso GdAHome conserva ogni giorno le ore vere.",
            "For the rooms with «demand unknown» Home Assistant only kept the temperature: past months' hours can only come from an air conditioner power sensor, or from a smart plug set in its card (Config › Climate). From now on GdAHome keeps the real hours every day.",
          )
        : t(
            "Per le stanze con «richiesta non nota» Home Assistant ha conservato solo la temperatura: le ore dei mesi passati si possono avere solo da una valvola, da un sensore di consumo o da una presa smart da indicare nella scheda dell'unità (Config › Clima). Da adesso GdAHome conserva ogni giorno le ore vere.",
            "For the rooms with «demand unknown» Home Assistant only kept the temperature: past months' hours can only come from a valve, a power sensor or a smart plug set in the unit's card (Config › Climate). From now on GdAHome keeps the real hours every day.",
          ),
    );
  return frasi.join(" ");
}

function notaStatistiche(report) {
  const statistiche = report.fonti?.statistiche || 0;
  if (!statistiche) return "";
  const stagione = report.stanze.some((s) => s.stimaDa?.includes("stagione"));
  const frasi = [
    statistiche === 1
      ? t(
          "Un giorno dalle statistiche orarie di Home Assistant, perché la storia dettagliata non c'è più.",
          "One day from the Home Assistant hourly statistics, because the detailed history is gone.",
        )
      : t(
          `${statistiche} giorni dalle statistiche orarie di Home Assistant, perché la storia dettagliata non c'è più.`,
          `${statistiche} days from the Home Assistant hourly statistics, because the detailed history is gone.`,
        ),
    fontiDellaStima(report),
    stagione
      ? t(
          "Per le pompe di calore conosciute solo dai watt decide la stagione: da maggio a settembre raffrescano.",
          "For heat pumps known only from their watts the season decides: from May to September they cool.",
        )
      : "",
  ].filter(Boolean);
  const testo = frasi.map((frase) => `<span>${esc(frase)}</span>`).join(" ");
  return `<p class="dm-rcl-nota" data-dm-rcl-statistiche>${testo}</p>`;
}

/* Un sensore di tutta la macchina (piu' zone sullo stesso dispositivo): non
 * e' di nessuna stanza, e non si divide inventando. Lo si dice. */
function condivisiDetti() {
  let sensori = [];
  try {
    sensori = [...new Set(unitaDelReport().map((u) => clean(u.consumoCondiviso)).filter(Boolean))];
  } catch (_errore) {
    sensori = [];
  }
  if (!sensori.length) return "";
  const quali = sensori.join(", ");
  return t(
    `${quali} misura tutta la macchina, non una stanza sola: il report non lo divide fra le zone, e per quelle stanze le ore restano «non note».`,
    `${quali} measures the whole machine, not a single room: the report does not split it between zones, and for those rooms the hours stay "unknown".`,
  );
}

function notaMarkup(report) {
  const f = report.fonti || {};
  const nessuna = f.nessuna || 0;
  const senzaCaldaia = report.giorniSenzaCaldaia || 0;
  const giorniConLeOre = GIORNI_CON_LE_ORE;
  const fonte = [
    ...fontiDette(report),
    f.storia || f.archivio
      ? report.impianto === "freddo"
        ? t(
            "In comfort: le ore accese con l'obiettivo sotto quello ridotto della stanza.",
            "In comfort: the hours on with a target below the room's setback.",
          )
        : t(
            "In comfort: le ore accese con l'obiettivo sopra quello ridotto della stanza (la notte abbassata non conta).",
            "In comfort: the hours on with a target above the room's setback (the lowered night does not count).",
          )
      : "",
    nascosteDette(report.nascoste),
    condivisiDetti(),
    nessuna === 1
      ? t("Un giorno senza nessun dato: non conta.", "One day without any data: it does not count.")
      : nessuna
        ? t(
            `${nessuna} giorni senza nessun dato: non contano.`,
            `${nessuna} days without any data: they do not count.`,
          )
        : "",
    senzaCaldaia === 1
      ? t(
          "Un giorno senza dati della caldaia: il suo tempo è quello degli altri giorni.",
          "One day without boiler data: its time is that of the other days.",
        )
      : senzaCaldaia
        ? t(
            `${senzaCaldaia} giorni senza dati della caldaia: il suo tempo è quello degli altri giorni.`,
            `${senzaCaldaia} days without boiler data: its time is that of the other days.`,
          )
        : "",
    report.oreMancanti
      ? t(
          `Ora per ora si conserva solo per gli ultimi ${giorniConLeOre} giorni: di questo giorno restano i totali.`,
          `Hour by hour is kept only for the last ${giorniConLeOre} days: for this day only the totals remain.`,
        )
      : "",
  ]
    .filter(Boolean)
    .map((frase) => `<span>${esc(frase)}</span>`)
    .join(" ");
  const statistiche = notaStatistiche(report);
  /* La nota lunga, a scomparsa: «Come si calcola», una frase per riga. Chi
   * vuole sapere da dove vengono i numeri la apre; gli altri vedono i numeri. */
  const base =
    statistiche || fonte
      ? `<details class="dm-rcl-come"><summary>${esc(t("Come si calcola", "How it's calculated"))}</summary>${statistiche}${fonte ? `<p class="dm-rcl-nota">${fonte}</p>` : ""}</details>`
      : "";
  /* Una stima che non c'e' non si spiega: il grafico dice gia' «non noto». */
  if (!report.stima || report.totali?.msGeneratore === null) return base;
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
  return `<p class="dm-rcl-nota" data-dm-rcl-stima>${esc(stima)}</p>${base}`;
}

/* Il vuoto vero: nessuna fonte sa niente di questo periodo. Si dice perche',
 * e che da adesso non succede piu'. */
function vuotoMarkup() {
  return `<div class="dm-rcl-vuoto"><span aria-hidden="true">📭</span><b>${esc(t("Nessun dato in questo periodo", "No data in this period"))}</b><small>${esc(
    t(
      "Home Assistant tiene la storia dettagliata solo pochi giorni (di serie 10), e per questi termostati non ci sono statistiche a lungo termine: per i mesi passati servono un sensore di temperatura nella stanza, la valvola o i watt della presa. Da oggi GdAHome mette da parte ogni notte il riassunto del clima, e questi periodi resteranno.",
      "Home Assistant keeps the detailed history only a few days (10 by default), and these thermostats have no long-term statistics: past months need a temperature sensor in the room, the valve or the plug's watts. From today GdAHome sets the climate summary aside every night, and these periods will stay.",
    ),
  )}</small></div>`;
}

/** Il corpo del report per un report gia' fatto: lo usa il disegno, e le prove. */
export function contenutoMarkup(report) {
  if (report.vuoto) return vuotoMarkup();
  const tot = report.totali;
  const valvole = report.stanze.filter((s) => s.valvola !== null).length;
  const quante = report.stanze.length;
  const obiettivo = gradi(tot.obiettivoComfort);
  const inComfort = tot.ambienteComfort !== null && tot.obiettivoComfort !== null;
  const caldo = report.impianto !== "freddo";
  const ignoto = tot.msGeneratore === null;
  const titoloGeneratore = ignoto
    ? t("Impianto", "System")
    : report.stima
      ? t("Impianto (stima)", "System (estimate)")
    : caldo
      ? report.generatori.length > 1
        ? t("Caldaie", "Boilers")
        : report.generatori[0]?.nome || t("Caldaia", "Boiler")
      : t("Impianto", "System");
  /* Sotto la caldaia le accensioni; dalle statistiche non si contano, e al
   * loro posto va quello che la caldaia ha consumato, se lo dice. */
  const sottoGeneratore =
    tot.msGeneratore === null
      ? t("non noto", "unknown")
      : tot.accensioni === null && tot.consumo
        ? `${numeroDetto(tot.consumo.valore)} ${tot.consumo.unita}`
        : tot.accensioni === null && tot.kwhStanze !== null && report.stima
          ? `${numeroDetto(tot.kwhStanze)} kWh`
          : accensioniDette(tot.accensioni);
  return `<div class="dm-rcl-tessere">
      ${tessera(caldo ? "🔥" : "❄️", titoloGeneratore, ore(tot.msGeneratore), sottoGeneratore, `data-dm-rcl-tessera="generatore"${report.stima && !ignoto ? " data-stima" : ""}${ignoto ? " data-ignoto" : ""}`)}
      ${tessera("⏱️", t("Richiesta stanze", "Room demand"), ore(tot.msRichiesta), stanzeDette(quante), 'data-dm-rcl-tessera="richiesta"')}
      ${
        inComfort
          ? tessera("🌡️", t("Temperatura in comfort", "Comfort temperature"), gradi(tot.ambienteComfort), t(`obiettivo in comfort ${obiettivo}`, `comfort target ${obiettivo}`), 'data-dm-rcl-tessera="temperatura"')
          : tessera("🌡️", t("Temperatura media", "Average temperature"), gradi(tot.ambiente), t("nel periodo", "over the period"), 'data-dm-rcl-tessera="temperatura"')
      }
      ${tessera("🔧", t("Valvola media", "Average valve"), percento(tot.valvola), valvoleDette(valvole), 'data-dm-rcl-tessera="valvola"')}
    </div>
    ${generatoriMarkup(report)}
    ${graficoMarkup(report)}
    <div class="dm-rcl-sezione"><b>${esc(t("Le stanze", "The rooms"))}</b><span>${esc(t("per ore di richiesta", "by hours of demand"))}</span></div>
    <ol class="dm-rcl-stanze">${stanzeMarkup(report)}</ol>
    ${notaMarkup(report)}`;
}

/* La testata della scheda: il titolo, l'impianto, il periodo. Niente X: il
 * report non e' piu' una finestra sopra la pagina ma una linguetta della
 * pagina Clima, come il Report nell'Energia — si torna alle stanze con le
 * linguette accanto. */
function testataMarkup(impianti, periodo) {
  const linguette = impianti
    .map(
      (id) =>
        `<button type="button" data-dm-rcl-impianto="${id}" aria-pressed="${id === state.impianto}"><span aria-hidden="true">${id === "freddo" ? "❄️" : "🔥"}</span>${esc(nomeDellImpianto(id))}</button>`,
    )
    .join("");
  const viste = VISTE_DEL_REPORT.map(
    (v) => `<button type="button" data-dm-rcl-vista="${v}" aria-pressed="${v === state.vista}">${esc(nomeDellaVista(v))}</button>`,
  ).join("");
  return `<div class="dm-rcl-testa">
      <div class="dm-rcl-titoli"><h2 id="dm-rcl-titolo">${esc(t("Report del clima", "Climate report"))}</h2><p>${esc(t("Quanto hanno lavorato l'impianto e le stanze", "How long the system and the rooms ran"))}</p></div>
      ${impianti.length > 1 ? `<div class="dm-rcl-impianti" role="group" aria-label="${esc(t("Impianto", "System"))}">${linguette}</div>` : ""}
    </div>
    <div class="dm-rcl-periodo">
      <div class="dm-rcl-viste" role="group" aria-label="${esc(t("Periodo", "Period"))}">${viste}</div>
      <div class="dm-rcl-naviga">
        <button type="button" data-dm-rcl-sposta="-1" aria-label="${esc(t("Periodo prima", "Previous period"))}">‹</button>
        <b data-dm-rcl-quando>${esc(titoloDelPeriodo(periodo))}</b>
        <button type="button" data-dm-rcl-sposta="1" ${periodo.inCorso ? "disabled" : ""} aria-label="${esc(t("Periodo dopo", "Next period"))}">›</button>
      </div>
    </div>`;
}

/* Il posto della scheda: dentro la pagina Clima, sotto le linguette. La
 * pagina la ridisegna chi la possiede, e la scheda ci si rimette da sola. */
function velo() {
  const posto = doc.querySelector("#page-clima [data-dm-rcl-posto]");
  let nodo = doc.getElementById("dm-rcl");
  if (nodo && posto && nodo.parentElement !== posto) posto.appendChild(nodo);
  if (nodo) return nodo;
  nodo = doc.createElement("section");
  nodo.id = "dm-rcl";
  nodo.className = "dm-rcl-scheda";
  nodo.hidden = true;
  nodo.setAttribute("aria-labelledby", "dm-rcl-titolo");
  nodo.innerHTML = `<div class="dm-rcl-foglio"><div class="dm-rcl-barra-testa" data-dm-rcl-testa></div><div class="dm-rcl-corpo" data-dm-rcl-corpo></div></div>`;
  (posto || doc.body).appendChild(nodo);
  nodo.addEventListener("click", tocco);
  return nodo;
}

/* I giorni del periodo, ognuno dalla prima fonte che lo sa: l'archivio del
 * ponte, poi la storia, poi le statistiche (`core/storico-del-clima.js`). */
async function giorniDelReport({ impianto, unita, generatori, periodo }) {
  const adesso = Date.now();
  const giorni = giorniDelPeriodo(periodo).map((g) => ({ ...g, record: null }));
  const archivio = await archivioDelPonte(giorni);
  for (const g of giorni) {
    const record = g.chiuso ? archivio?.[g.chiave]?.[impianto] : null;
    if (record) g.record = { ...record, fonte: "archivio" };
  }
  let errori = 0;
  let domande = 0;

  const mancanti = giorni.filter((g) => !g.record);
  if (mancanti.length) {
    const delReport = unitaDellImpianto(impianto, unita);
    const entita = [
      ...new Set([
        ...delReport.map((u) => u.entity),
        ...delReport.map((u) => u.valvola).filter(Boolean),
        /* I watt: per gli split che non dicono `hvac_action`. */
        ...delReport.map((u) => u.consumo).filter(Boolean),
        ...generatori.map((g) => g.entity),
      ]),
    ];
    const tratto = { ...periodo, inizio: mancanti[0].inizio };
    const storie = {};
    domande += entita.length;
    await Promise.all(
      entita.map(async (entity) => {
        try {
          storie[entity] = await storiaDi(entity, tratto);
        } catch (_errore) {
          errori += 1;
        }
      }),
    );
    for (const g of mancanti)
      g.record = riassuntoDelGiorno({ impianto, unita, storie, generatori, giorno: g, adesso });
  }

  const ancora = giorni.filter((g) => !g.record);
  if (ancora.length) {
    const delReport = unitaDellImpianto(impianto, unita);
    const ids = [
      ...new Set(
        [
          ...delReport.flatMap((u) => [u.temperatura, u.valvola, u.consumo, u.entity]),
          ...generatori.flatMap((g) => g.statistiche || [g.entity]),
        ].filter(Boolean),
      ),
    ].sort();
    domande += 1;
    try {
      const serie = await statisticheDi(ids, ancora[0].inizio, ancora.at(-1).fine);
      for (const g of ancora)
        g.record = riassuntoDalleStatistiche({
          impianto,
          unita,
          generatori,
          serie,
          unitaDi,
          giorno: g,
          adesso,
        });
    } catch (_errore) {
      errori += 1;
    }
  }
  return { giorni, errori, domande };
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
  const generatori = state.impianto === "caldo" ? caldaieDelReport() : [];
  const { giorni, errori, domande } = await giorniDelReport({
    impianto: state.impianto,
    unita,
    generatori,
    periodo,
  });
  if (giro !== state.giro || !state.aperto) return;
  if (errori && errori === domande && !giorni.some((g) => g.record)) {
    corpo.innerHTML = `<div class="dm-rcl-vuoto"><span aria-hidden="true">⚠️</span><b>${esc(t("La storia non risponde", "The history does not answer"))}</b><small>${esc(t("Home Assistant non ha mandato la storia di questi termostati. Riprova fra poco.", "Home Assistant did not send the history of these thermostats. Try again shortly."))}</small></div>`;
    return;
  }
  const report = reportDaiGiorni({ impianto: state.impianto, unita, generatori, periodo, giorni });
  corpo.innerHTML = contenutoMarkup(report);
  root.__DM_REPORT_CLIMA_ULTIMO__ = report;
}

function tocco(evento) {
  const bersaglio = evento.target;
  if (bersaglio.closest?.("[data-dm-rcl-chiudi]")) {
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

/* La pagina Clima sa che il report e' aperto: nasconde le stanze e i
 * comandi di tutta la casa, e la linguetta Report e' quella premuta. */
function segnaLaPagina(aperto) {
  const guscio = doc.querySelector("#page-clima .dm-cl-shell");
  if (guscio) {
    if (aperto) guscio.setAttribute("data-dm-rcl-aperto", "");
    else guscio.removeAttribute("data-dm-rcl-aperto");
  }
  for (const linguetta of doc.querySelectorAll("#page-clima [data-dm-rcl-apri]"))
    linguetta.setAttribute("aria-pressed", String(aperto));
}

/** Apre il report: dell'impianto che la pagina sta mostrando, di serie. */
export function apriIlReportDelClima(impianto = "") {
  const zonaVista = doc.querySelector(".clima-zone-freddo.show") ? "freddo" : "caldo";
  const scelto = clean(impianto) || zonaVista;
  state.impianto = scelto === "freddo" ? "freddo" : "caldo";
  state.aperto = true;
  const nodo = velo();
  nodo.hidden = false;
  segnaLaPagina(true);
  disegna();
  return true;
}

export function chiudiIlReport() {
  state.aperto = false;
  state.giro += 1;
  const nodo = doc.getElementById("dm-rcl");
  if (nodo) nodo.hidden = true;
  segnaLaPagina(false);
}

const CSS = `
/* Il report come scheda della pagina Clima: niente velo, niente finestra.
 * Le card sono quelle della pagina (lo stesso fondo, bordo, ombra e raggio
 * della pagina Clima e del Report dell'Energia), e i colori quelli
 * dell'impianto: arancio il riscaldamento, azzurro il raffrescamento. */
.dm-rcl-scheda{
  --rcl-card:var(--card-bg,#fff);--rcl-soft:var(--surface-2,#f7f9fc);--rcl-sunk:var(--surface-3,#eef2f8);
  --rcl-line:var(--card-border,#e6ecf3);--rcl-text:var(--text,#0f172a);--rcl-dim:var(--text-dim,#64748b);
  --rcl-shadow:0 4px 20px rgba(15,23,42,.06),0 1px 4px rgba(15,23,42,.04);
  --rcl-c:234,88,12;color:var(--rcl-text)
}
.dm-rcl-scheda[hidden]{display:none}
.dm-rcl-scheda[data-dm-rcl-zona="freddo"]{--rcl-c:2,132,199}
html[data-theme="dark"] .dm-rcl-scheda{
  --rcl-card:var(--card-bg,#151b26);--rcl-soft:var(--surface-2,#1b2230);--rcl-sunk:var(--surface-3,#232c3d);
  --rcl-line:var(--card-border,#2a3445);--rcl-text:var(--text,#e8edf5);--rcl-dim:var(--text-dim,#94a3b8);
  --rcl-shadow:0 4px 20px rgba(0,0,0,.38),0 1px 4px rgba(0,0,0,.26);--rcl-c:251,146,60
}
html[data-theme="dark"] .dm-rcl-scheda[data-dm-rcl-zona="freddo"]{--rcl-c:56,189,248}
.dm-rcl-scheda button{font:inherit}
.dm-rcl-foglio{display:flex;flex-direction:column;gap:14px}
.dm-rcl-carta,.dm-rcl-barra-testa,.dm-rcl-tessera,.dm-rcl-grafico-box,.dm-rcl-elenco,.dm-rcl-come,.dm-rcl-carica,.dm-rcl-vuoto{
  background:var(--rcl-card);border:1px solid var(--rcl-line);border-radius:22px;box-shadow:var(--rcl-shadow)}

/* La testata: titolo e impianto, poi il periodo. */
.dm-rcl-barra-testa{display:flex;flex-direction:column;gap:14px;padding:16px 18px}
.dm-rcl-testa{display:flex;align-items:center;justify-content:space-between;gap:12px 16px;flex-wrap:wrap}
.dm-rcl-titoli{min-width:0}
.dm-rcl-titoli h2{margin:0;padding:0;border:0;font-family:"Oswald",system-ui,sans-serif;font-size:22px;font-weight:700;letter-spacing:.6px;text-transform:none;color:var(--rcl-text)}
.dm-rcl-titoli p{margin:2px 0 0;font-size:12.5px;font-weight:600;color:var(--rcl-dim)}
.dm-rcl-impianti,.dm-rcl-viste{display:flex;gap:4px;padding:4px;border-radius:14px;background:var(--rcl-sunk)}
.dm-rcl-impianti{flex:0 1 auto}
.dm-rcl-impianti button,.dm-rcl-viste button{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:40px;border:0;border-radius:11px;padding:0 14px;background:transparent;color:var(--rcl-dim);font-size:13px;font-weight:750;cursor:pointer;white-space:nowrap}
.dm-rcl-impianti button[aria-pressed="true"],.dm-rcl-viste button[aria-pressed="true"]{background:var(--rcl-card);color:var(--rcl-text);box-shadow:0 1px 4px rgba(15,23,42,.12)}
.dm-rcl-impianti button[aria-pressed="true"]{color:rgb(var(--rcl-c))}
.dm-rcl-scheda :is(button):focus-visible{outline:2px solid rgb(var(--rcl-c));outline-offset:2px}
.dm-rcl-periodo{display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px}
.dm-rcl-periodo .dm-rcl-viste{flex:1 1 280px}
.dm-rcl-naviga{display:flex;align-items:center;gap:8px;flex:1 1 280px}
.dm-rcl-naviga b{flex:1;text-align:center;font-size:15px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dm-rcl-naviga button{width:44px;height:44px;flex:0 0 44px;border-radius:14px;border:1px solid var(--rcl-line);background:var(--rcl-soft);color:var(--rcl-text);font-size:20px;font-weight:800;cursor:pointer}
.dm-rcl-naviga button:disabled{opacity:.35;cursor:default}
.dm-rcl-corpo{display:flex;flex-direction:column;gap:14px}

/* I numeri in alto: quattro card, due per riga sul telefono. */
.dm-rcl-tessere{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.dm-rcl-tessera{display:flex;flex-direction:column;gap:4px;padding:14px 16px;min-width:0}
.dm-rcl-tessera[data-dm-rcl-tessera="generatore"]{background:linear-gradient(180deg,rgba(var(--rcl-c),.12),rgba(var(--rcl-c),.04)),var(--rcl-card);border-color:rgba(var(--rcl-c),.32)}
.dm-rcl-t-et{display:flex;align-items:center;gap:6px;font-size:12.5px;line-height:1.3;font-weight:700;letter-spacing:0;text-transform:none;color:var(--rcl-dim)}
.dm-rcl-t-et i{font-style:normal;font-size:14px}
.dm-rcl-tessera b{font-size:24px;font-weight:800;letter-spacing:-.5px;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dm-rcl-tessera small{font-size:12px;font-weight:650;color:var(--rcl-dim)}
.dm-rcl-tessera[data-ignoto]{background:var(--rcl-card);border-color:var(--rcl-line)}
.dm-rcl-generatori{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.dm-rcl-generatori li{display:flex;align-items:baseline;gap:10px;padding:12px 16px;border-radius:16px;background:var(--rcl-card);border:1px solid var(--rcl-line);font-size:13.5px}
.dm-rcl-generatori li span{flex:1;font-weight:700}
.dm-rcl-generatori li small{color:var(--rcl-dim);font-weight:650}

/* Il grafico. Vuoto, dice perche'. */
.dm-rcl-grafico-box{padding:16px 18px 12px}
.dm-rcl-grafico-testa{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:4px 12px;font-size:12.5px}
.dm-rcl-grafico-testa b{font-size:15px;font-weight:800}
.dm-rcl-grafico-testa span{color:var(--rcl-dim);font-weight:650}
.dm-rcl-grafico-area{position:relative;margin-top:12px}
.dm-rcl-grafico{display:flex;align-items:stretch;gap:3px;height:170px}
.dm-rcl-col{flex:1;display:flex;flex-direction:column;align-items:stretch;min-width:0}
.dm-rcl-barra{flex:1;display:flex;align-items:flex-end;border-radius:6px;background:var(--rcl-soft)}
.dm-rcl-barra i{display:block;width:100%;border-radius:6px;background:linear-gradient(180deg,rgba(var(--rcl-c),1),rgba(var(--rcl-c),.72))}
.dm-rcl-col[data-futuro="true"] .dm-rcl-barra{opacity:.45}
.dm-rcl-col[data-ignota] .dm-rcl-barra{background:repeating-linear-gradient(135deg,var(--rcl-sunk) 0 4px,transparent 4px 8px);box-shadow:inset 0 0 0 1px var(--rcl-line)}
.dm-rcl-col small{height:16px;margin-top:6px;text-align:center;font-size:11px;font-weight:650;color:var(--rcl-dim);white-space:nowrap;overflow:visible}
.dm-rcl-grafico-vuoto{position:absolute;left:50%;top:calc(50% - 11px);transform:translate(-50%,-50%);max-width:calc(100% - 24px);margin:0;padding:10px 14px;border-radius:14px;background:var(--rcl-card);border:1px solid var(--rcl-line);box-shadow:var(--rcl-shadow);font-size:13px;font-weight:700;line-height:1.4;text-align:center;color:var(--rcl-text)}
.dm-rcl-legenda{display:flex;align-items:center;gap:8px;margin:10px 0 0;font-size:12px;font-weight:650;color:var(--rcl-dim)}
.dm-rcl-legenda i{width:16px;height:12px;border-radius:4px;background:repeating-linear-gradient(135deg,var(--rcl-sunk) 0 3px,transparent 3px 6px);box-shadow:inset 0 0 0 1px var(--rcl-line)}
.dm-rcl-ignoto{display:flex;align-items:center;gap:12px;margin-top:12px;padding:18px 16px;border-radius:16px;background:var(--rcl-soft);border:1px dashed var(--rcl-line)}
.dm-rcl-ignoto span{font-size:22px}
.dm-rcl-ignoto p{margin:0;font-size:13px;line-height:1.5;font-weight:650;color:var(--rcl-dim)}

/* Le stanze: una card sola, una riga per stanza. */
.dm-rcl-sezione{display:flex;align-items:baseline;gap:8px;margin:6px 4px -4px}
.dm-rcl-sezione b{font-size:16px;font-weight:800}
.dm-rcl-sezione span{font-size:12.5px;color:var(--rcl-dim);font-weight:650}
.dm-rcl-stanze{list-style:none;margin:0;padding:4px 0;display:block;background:var(--rcl-card);border:1px solid var(--rcl-line);border-radius:22px;box-shadow:var(--rcl-shadow)}
.dm-rcl-stanza{display:flex;gap:12px;align-items:flex-start;padding:14px 16px}
.dm-rcl-stanza + .dm-rcl-stanza{border-top:1px solid var(--rcl-line)}
.dm-rcl-pos{display:grid;place-items:center;flex:none;width:28px;height:28px;border-radius:10px;background:rgba(var(--rcl-c),.14);color:rgb(var(--rcl-c));font-size:12.5px;font-weight:800}
.dm-rcl-stanza-corpo{flex:1;min-width:0}
.dm-rcl-stanza-testa{display:flex;align-items:center;gap:8px}
.dm-rcl-stanza-testa b{font-size:14.5px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dm-rcl-stanza-testa strong{margin-left:auto;font-size:15px;font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap}
.dm-rcl-segno{flex:none;font-style:normal;font-size:11px;font-weight:750;padding:2px 8px;border-radius:999px;background:var(--rcl-sunk);color:var(--rcl-dim)}
.dm-rcl-segno[data-dm-rcl-segno="dati"]{background:rgba(234,179,8,.18);color:#a16207}
html[data-theme="dark"] .dm-rcl-segno[data-dm-rcl-segno="dati"]{color:#facc15}
.dm-rcl-stanza-barra{height:8px;margin:9px 0;border-radius:999px;background:var(--rcl-soft);overflow:hidden}
.dm-rcl-stanza-barra i{display:block;height:100%;border-radius:999px;background:rgb(var(--rcl-c))}
.dm-rcl-stanza-dati{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12.5px;font-weight:650;color:var(--rcl-dim)}
.dm-rcl-stanza-dati span:first-child{color:rgb(var(--rcl-c));font-weight:750}
.dm-rcl-stanza-dati span[data-ignota]{color:var(--rcl-dim);font-weight:650}

/* In fondo: la stima, se c'e', in vista; il resto a scomparsa. */
.dm-rcl-nota{margin:0;font-size:13px;line-height:1.5;color:var(--rcl-dim)}
.dm-rcl-nota[data-dm-rcl-stima]{padding:12px 14px;border-radius:16px;background:rgba(var(--rcl-c),.09);border:1px solid rgba(var(--rcl-c),.22);color:var(--rcl-text);font-weight:600}
.dm-rcl-come{padding:0;overflow:hidden}
.dm-rcl-come summary{display:flex;align-items:center;gap:8px;min-height:48px;padding:0 16px;cursor:pointer;list-style:none;font-size:14px;font-weight:800;color:var(--rcl-text)}
.dm-rcl-come summary::-webkit-details-marker{display:none}
.dm-rcl-come summary::before{content:"";width:8px;height:8px;margin-right:4px;border-right:2px solid var(--rcl-dim);border-bottom:2px solid var(--rcl-dim);transform:rotate(-45deg);transition:transform .2s}
.dm-rcl-come[open] summary::before{transform:rotate(45deg)}
.dm-rcl-come .dm-rcl-nota{padding:0 16px 14px}
.dm-rcl-come .dm-rcl-nota span{display:block;position:relative;padding-left:14px;margin-top:6px;max-width:68ch}
.dm-rcl-come .dm-rcl-nota span::before{content:"";position:absolute;left:2px;top:.62em;width:5px;height:5px;border-radius:50%;background:var(--rcl-dim);opacity:.6}

.dm-rcl-carica,.dm-rcl-vuoto{display:flex;flex-direction:column;align-items:center;gap:8px;padding:48px 18px;text-align:center;color:var(--rcl-dim);font-size:13px;font-weight:650;line-height:1.5}
.dm-rcl-vuoto span{font-size:30px}
.dm-rcl-vuoto b{color:var(--rcl-text);font-size:16px}
.dm-rcl-vuoto small{max-width:62ch;font-size:13px}
.dm-rcl-spin{width:26px;height:26px;border-radius:50%;border:3px solid var(--rcl-sunk);border-top-color:rgb(var(--rcl-c));animation:dm-rcl-gira .8s linear infinite}
@keyframes dm-rcl-gira{to{transform:rotate(360deg)}}
@media (max-width:640px){
  .dm-rcl-barra-testa{padding:14px}
  .dm-rcl-impianti{flex:1 1 100%}
  .dm-rcl-tessere{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
  .dm-rcl-tessera{padding:12px 14px}
  .dm-rcl-tessera b{font-size:20px}
  .dm-rcl-grafico-box{padding:14px 14px 10px}
  .dm-rcl-stanza{padding:12px 14px}
  /* Sul telefono il segno («stima», «dati parziali») va sotto il nome: accanto
   * gli toglieva lo spazio e «Termosifone Sala» diventava «Termosifone …». */
  .dm-rcl-stanza-testa{flex-wrap:wrap;row-gap:4px}
  .dm-rcl-stanza-testa b{flex:1 1 0;order:1}
  .dm-rcl-stanza-testa strong{order:1}
  .dm-rcl-stanza-testa:has(.dm-rcl-segno)::after{content:"";order:2;flex-basis:100%;height:0}
  .dm-rcl-segno{order:3}
  .dm-rcl-grafico{height:140px;gap:2px}
  .dm-rcl-grafico[data-colonne="24"] .dm-rcl-col small,.dm-rcl-grafico[data-colonne="31"] .dm-rcl-col small{font-size:9.5px}
}
`;

export function installReportDelClima() {
  if (state.installed || !doc) return false;
  state.installed = true;
  installStyle(STYLE_ID, CSS);
  root.apriIlReportDelClima = apriIlReportDelClima;
  doc.addEventListener("click", (evento) => {
    if (evento.target?.closest?.("[data-dm-rcl-apri]")) {
      apriIlReportDelClima();
      return;
    }
    /* Una linguetta delle stanze (Freddo, Caldo, Termostato) torna alle
     * stanze: il report si chiude come si lascia una linguetta. */
    if (state.aperto && evento.target?.closest?.("#page-clima .clima-page-mode-btn[data-dm-cl-zone]"))
      chiudiIlReport();
  });
  /* La pagina si ridisegna: la scheda aperta resta al suo posto. */
  root.addEventListener?.("dashboardmodern:state-changed", () => {
    if (!state.aperto) return;
    const nodo = doc.getElementById("dm-rcl");
    const posto = doc.querySelector("#page-clima [data-dm-rcl-posto]");
    if (nodo && posto && nodo.parentElement !== posto) posto.appendChild(nodo);
    segnaLaPagina(true);
  });
  doc.addEventListener("keydown", tasto);
  return true;
}
