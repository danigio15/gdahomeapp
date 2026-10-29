/* Strava dentro la Salute (#344).
 *
 * «Un widget con relativa pagina dedicata con grafici e storico per Strava»:
 * e Strava sta nella Salute, nella sua linguetta. Qui i pezzi che la pagina
 * Salute, la sua tessera e la sua finestra disegnano: lo sport (corsa, bici,
 * nuoto), questa settimana in grande, le ultime dodici settimane in barre, la
 * settimana, le ultime quattro, l'anno e sempre, i record, e le ultime
 * attivita' — ognuna apre la sua pagina su Strava. I dati li legge
 * `core/strava.js` dall'integrazione «Strava Home Assistant» di HACS.
 *
 * Le dodici settimane vengono dalle statistiche a lungo termine di Home
 * Assistant del totale «di sempre» (quanto e' cresciuto ogni settimana):
 * chieste una volta ogni mezz'ora, per lo sport che si guarda.
 */
import {
  PERIODI_STRAVA,
  SPORT_STRAVA,
  durataStrava,
  settimaneDalleStatistiche,
  vistaDiStrava,
} from "../core/strava.js";
import { allStates, chiediAHomeAssistant, esc, locale, t } from "./shared.js";

const ARANCIO = "#fc4c02";
const SETTIMANE = 12;
const OGNI = 30 * 60_000;

/* ── le parole ─────────────────────────────────────────────────────────── */

const NOMI_SPORT = () => ({
  run: t("Corsa", "Run"),
  ride: t("Bici", "Ride"),
  swim: t("Nuoto", "Swim"),
});
const SEGNI_SPORT = { run: "🏃", ride: "🚴", swim: "🏊" };
const NOMI_PERIODI = () => ({
  weekly: t("Questa settimana", "This week"),
  recent: t("Ultime 4 settimane", "Last 4 weeks"),
  ytd: t("Quest'anno", "This year"),
  all: t("Da sempre", "All time"),
});

const numeroBello = (valore, cifre = 1) =>
  Number.isFinite(valore) ? valore.toLocaleString(locale(), { maximumFractionDigits: cifre }) : "—";

function misura(m, cifre = 1) {
  if (!m || m.valore === null || m.valore === undefined) return "";
  if (m.unita === "s") return durataStrava(m.valore);
  return `${numeroBello(m.valore, cifre)}${m.unita ? ` ${m.unita}` : ""}`;
}

function quando(iso) {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  return new Date(ms).toLocaleDateString(locale(), {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/* ── la vista ──────────────────────────────────────────────────────────── */

/** Strava com'e' adesso, o `null` se in casa non c'e'. */
export function vistaStrava(states = allStates() || {}) {
  return vistaDiStrava(states);
}

/** Lo sport che si guarda: quello scelto se c'e', se no il principale. */
export function sportScelto(vista, scelto = "") {
  const presenti = SPORT_STRAVA.filter((s) => vista.statistiche.sport[s]);
  return presenti.includes(scelto) ? scelto : vista.principale;
}

/** La tessera della Home: questa settimana dello sport principale. */
export function tesseraStrava(vista) {
  const sport = vista.principale;
  const settimana = vista.statistiche.sport[sport]?.weekly || {};
  const ultima = vista.attivita[0];
  return {
    valore: misura(settimana.distanza) || (ultima ? misura(ultima.misure.distanza) : "—"),
    riga: ultima
      ? `${SEGNI_SPORT[ultima.famiglia] || "🏅"} ${ultima.titolo}${ultima.data ? ` · ${quando(ultima.data)}` : ""}`
      : NOMI_PERIODI().weekly,
    sport,
  };
}

/* ── i pezzi ───────────────────────────────────────────────────────────── */

function attivitaMarkup(a) {
  const m = a.misure;
  const dati = [
    m.distanza && [t("Distanza", "Distance"), misura(m.distanza, 2)],
    m.tempo && [t("Tempo", "Time"), m.tempo.testo || misura(m.tempo)],
    a.famiglia === "ride" || a.famiglia === "swim"
      ? m.velocita && [t("Velocità", "Speed"), misura(m.velocita)]
      : m.passo && [t("Passo", "Pace"), m.passo.testo || misura(m.passo, 2)],
    m.dislivello && [t("Dislivello", "Elevation"), misura(m.dislivello, 0)],
    m.battito && [t("Battito", "Heart rate"), misura(m.battito, 0)],
    m.calorie && [t("Calorie", "Calories"), misura(m.calorie, 0)],
  ].filter((x) => x && x[1]);
  return `<a class="dm-strava-att" href="${esc(a.url)}" target="_blank" rel="noopener noreferrer" data-famiglia="${esc(a.famiglia)}">
    <span class="dm-strava-att-segno" aria-hidden="true">${SEGNI_SPORT[a.famiglia] || "🏅"}</span>
    <span class="dm-strava-att-testa"><b>${esc(a.titolo)}</b><small>${esc(
      [a.tipo, a.data ? quando(a.data) : "", a.luogo].filter(Boolean).join(" · "),
    )}</small></span>
    ${
      dati.length
        ? `<span class="dm-strava-att-dati">${dati
            .map(([n, v]) => `<span><small>${esc(n)}</small><b>${esc(v)}</b></span>`)
            .join("")}</span>`
        : ""
    }
    ${m.kudos?.valore ? `<span class="dm-strava-kudos">👍 ${esc(numeroBello(m.kudos.valore, 0))}</span>` : ""}
  </a>`;
}

function periodiMarkup(vista, sport) {
  const per = vista.statistiche.sport[sport] || {};
  const nomi = NOMI_PERIODI();
  const righe = PERIODI_STRAVA.filter((p) => per[p]).map((p) => {
    const x = per[p];
    return `<div class="dm-strava-periodo">
      <span class="dm-strava-periodo-nome">${esc(nomi[p])}</span>
      <b>${esc(misura(x.distanza) || "—")}</b>
      <small>${esc(
        [
          x.quante ? `${numeroBello(x.quante.valore, 0)} ${t("attività", "activities")}` : "",
          x.tempo ? misura(x.tempo) : "",
          x.dislivello ? `↗ ${misura(x.dislivello, 0)}` : "",
        ]
          .filter(Boolean)
          .join(" · "),
      )}</small>
    </div>`;
  });
  return righe.length ? `<div class="dm-strava-periodi">${righe.join("")}</div>` : "";
}

/* Le dodici settimane in barre: la piu' recente a destra. Ogni barra dice
 * la sua settimana e la sua distanza a chi ci passa sopra; la piu' lunga e
 * l'ultima la scrivono sopra di se'. */
function graficoMarkup(dati, unita) {
  if (!Array.isArray(dati))
    return `<div class="dm-strava-grafico dm-strava-attesa">${esc(t("Carico le settimane…", "Loading the weeks…"))}</div>`;
  const settimane = dati.slice(-SETTIMANE);
  if (!settimane.length)
    return `<div class="dm-strava-grafico dm-strava-attesa">${esc(
      t(
        "Le settimane si vedono quando Home Assistant ne ha le statistiche.",
        "The weeks show once Home Assistant has statistics for them.",
      ),
    )}</div>`;
  const massimo = Math.max(...settimane.map((s) => s.valore), 0.0001);
  const piuLunga = settimane.findIndex((s) => s.valore === massimo);
  const barre = settimane
    .map((s, i) => {
      const altezza = Math.max(2, Math.round((s.valore / massimo) * 100));
      const etichetta = `${new Date(s.inizio).toLocaleDateString(locale(), { day: "numeric", month: "short" })}: ${numeroBello(s.valore)} ${unita}`;
      const scritta = i === piuLunga || i === settimane.length - 1;
      return `<span class="dm-strava-barra${i === settimane.length - 1 ? " ora" : ""}" title="${esc(etichetta)}" aria-label="${esc(etichetta)}" role="img">
        <span class="dm-strava-colonna">
          <i style="height:${altezza}%"></i>
          ${scritta && s.valore > 0 ? `<em style="bottom:calc(${altezza}% + 3px)">${esc(numeroBello(s.valore, s.valore >= 100 ? 0 : 1))}</em>` : ""}
        </span>
        <small>${esc(new Date(s.inizio).toLocaleDateString(locale(), { day: "numeric", month: "numeric" }))}</small>
      </span>`;
    })
    .join("");
  return `<div class="dm-strava-grafico"><div class="dm-strava-barre">${barre}</div></div>`;
}

function recordMarkup(vista, sport) {
  if (sport !== "ride") return "";
  const { giro, salita } = vista.statistiche.lunghe;
  const voci = [
    giro && [t("Giro più lungo", "Longest ride"), misura(giro)],
    salita && [t("Salita più alta", "Biggest climb"), misura(salita, 0)],
  ].filter(Boolean);
  if (!voci.length) return "";
  return `<div class="dm-strava-record">${voci
    .map(([n, v]) => `<span><small>🏆 ${esc(n)}</small><b>${esc(v)}</b></span>`)
    .join("")}</div>`;
}

/** La linguetta Strava della Salute: `settimane` sono le righe dello sport
 * che si guarda, o `null` mentre arrivano. */
export function paginaStravaMarkup(vista, { sport: scelto = "", settimane = null } = {}) {
  const sport = sportScelto(vista, scelto);
  const nomi = NOMI_SPORT();
  const presenti = SPORT_STRAVA.filter((s) => vista.statistiche.sport[s]);
  const settimana = vista.statistiche.sport[sport]?.weekly || {};
  const unita =
    settimana.distanza?.unita || vista.statistiche.sport[sport]?.all?.distanza?.unita || "km";
  const scelte =
    presenti.length > 1
      ? `<div class="dm-strava-sport" role="tablist">${presenti
          .map(
            (s) =>
              `<button type="button" role="tab" aria-selected="${s === sport}" data-dm-strava-sport="${s}">${SEGNI_SPORT[s]} ${esc(nomi[s])}</button>`,
          )
          .join("")}</div>`
      : "";
  const attivita = vista.attivita.slice(0, 8);
  return `<div class="dm-strava">
    ${scelte}
    ${
      presenti.length
        ? `<section class="dm-strava-eroe">
      <span class="dm-strava-eroe-nome">${SEGNI_SPORT[sport] || ""} ${esc(nomi[sport] || "")} · ${esc(NOMI_PERIODI().weekly)}</span>
      <b class="dm-strava-eroe-km">${esc(misura(settimana.distanza) || "—")}</b>
      <span class="dm-strava-eroe-dati">${esc(
        [
          settimana.quante
            ? `${numeroBello(settimana.quante.valore, 0)} ${t("attività", "activities")}`
            : "",
          settimana.tempo ? misura(settimana.tempo) : "",
          settimana.dislivello ? `↗ ${misura(settimana.dislivello, 0)}` : "",
        ]
          .filter(Boolean)
          .join(" · "),
      )}</span>
      ${graficoMarkup(settimane, unita)}
    </section>
    ${periodiMarkup(vista, sport)}
    ${recordMarkup(vista, sport)}`
        : ""
    }
    ${
      attivita.length
        ? `<h3 class="dm-strava-titolo">${esc(t("Le ultime attività", "Latest activities"))}</h3>
    <div class="dm-strava-attivita">${attivita.map(attivitaMarkup).join("")}</div>`
        : ""
    }
    <p class="dm-strava-fonte">${esc(t("Dati di Strava, tramite Home Assistant", "Strava data, via Home Assistant"))}</p>
  </div>`;
}

/** Il sottotitolo della finestra: gli sport, corto perche' si legga intero. */
export function sottotitoloStrava(vista) {
  if (!vista) return "";
  const nomi = NOMI_SPORT();
  return SPORT_STRAVA.filter((s) => vista.statistiche.sport[s])
    .map((s) => nomi[s])
    .join(" · ");
}

/** La finestra della tessera: questa settimana e le ultime tre attivita'. */
export function finestraStravaMarkup(vista) {
  if (!vista) return "";
  const sport = vista.principale;
  const settimana = vista.statistiche.sport[sport]?.weekly || {};
  return `<div class="dm-strava dm-strava-finestra">
    ${
      settimana.distanza
        ? `<section class="dm-strava-eroe"><span class="dm-strava-eroe-nome">${SEGNI_SPORT[sport] || ""} ${esc(NOMI_SPORT()[sport] || "")} · ${esc(NOMI_PERIODI().weekly)}</span>
      <b class="dm-strava-eroe-km">${esc(misura(settimana.distanza))}</b>
      <span class="dm-strava-eroe-dati">${esc(
        [
          settimana.quante
            ? `${numeroBello(settimana.quante.valore, 0)} ${t("attività", "activities")}`
            : "",
          settimana.tempo ? misura(settimana.tempo) : "",
        ]
          .filter(Boolean)
          .join(" · "),
      )}</span></section>`
        : ""
    }
    <div class="dm-strava-attivita">${vista.attivita.slice(0, 3).map(attivitaMarkup).join("")}</div>
  </div>`;
}

/* ── le settimane ──────────────────────────────────────────────────────── */

function inizioDellaSettimana(ms) {
  const d = new Date(ms);
  const giorno = (d.getDay() + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - giorno);
  return d.getTime();
}

/**
 * Chiede al Recorder le dodici settimane dello sport, se non le ha chieste da
 * mezz'ora. `cache` e' di chi chiama — `{[sport]: {righe, chieste,
 * chiedendo}}` — e `poi` lo avvisa quando arrivano.
 */
export async function chiediLeSettimaneStrava(vista, sport, cache, poi = () => {}) {
  const totale = vista.statistiche.sport[sport]?.all?.distanza?.entity;
  const voce = (cache[sport] ||= { righe: null, chieste: 0, chiedendo: false });
  if (!totale) {
    voce.righe = [];
    return;
  }
  if (voce.chiedendo || Date.now() - voce.chieste < OGNI) return;
  voce.chiedendo = true;
  voce.chieste = Date.now();
  const fine = Date.now();
  const inizio = inizioDellaSettimana(fine - SETTIMANE * 7 * 86_400_000);
  try {
    const risposta = await chiediAHomeAssistant(
      {
        type: "recorder/statistics_during_period",
        start_time: new Date(inizio).toISOString(),
        end_time: new Date(fine).toISOString(),
        statistic_ids: [totale],
        period: "week",
        types: ["change", "state"],
      },
      20_000,
    );
    voce.righe = settimaneDalleStatistiche(risposta?.[totale]);
  } catch (_errore) {
    voce.righe = voce.righe || [];
  } finally {
    voce.chiedendo = false;
    poi();
  }
}

/* ── il foglio ─────────────────────────────────────────────────────────── */

export function foglioStrava(P) {
  return `
  ${P} .dm-strava{display:grid;gap:14px;--str:${ARANCIO}}
  ${P} .dm-strava-sport{display:flex;gap:8px;flex-wrap:wrap}
  ${P} .dm-strava-sport button{padding:9px 14px;border-radius:999px;font:inherit;font-size:14px;font-weight:800;cursor:pointer;
    color:var(--text,#0f172a);background:var(--card-background-color,#fff);border:1px solid var(--card-border,#e2e8f0)}
  ${P} .dm-strava-sport button[aria-selected="true"]{color:#fff;background:var(--str);border-color:var(--str)}
  ${P} .dm-strava-eroe{display:grid;gap:4px;padding:18px;border-radius:24px;color:#fff;
    background:linear-gradient(150deg,#fc4c02,#c2410c 60%,#7c2d12);box-shadow:0 18px 40px -26px rgba(194,65,12,.9)}
  ${P} .dm-strava-eroe-nome{font-size:12px;font-weight:850;letter-spacing:.08em;text-transform:uppercase;opacity:.9}
  ${P} .dm-strava-eroe-km{font-size:44px;font-weight:900;line-height:1.05;letter-spacing:-.02em}
  ${P} .dm-strava-eroe-dati{font-size:14px;font-weight:700;opacity:.92}
  ${P} .dm-strava-grafico{margin-top:12px;padding:10px 6px 2px;border-radius:16px;background:rgba(255,255,255,.12)}
  ${P} .dm-strava-attesa{font-size:13px;font-weight:700;opacity:.9;padding:14px}
  ${P} .dm-strava-barre{display:grid;grid-template-columns:repeat(${SETTIMANE},minmax(0,1fr));gap:4px;align-items:end;padding-top:18px}
  ${P} .dm-strava-barra{display:flex;flex-direction:column;align-items:center;gap:3px}
  /* L'altezza delle barre e' tutta loro: il numero sta sopra, fuori. */
  ${P} .dm-strava-colonna{position:relative;display:block;width:100%;height:110px}
  ${P} .dm-strava-barra i{position:absolute;left:50%;bottom:0;transform:translateX(-50%);display:block;width:100%;max-width:26px;
    border-radius:4px 4px 0 0;background:rgba(255,255,255,.55)}
  ${P} .dm-strava-barra.ora i{background:#fff}
  ${P} .dm-strava-barra em{position:absolute;left:50%;transform:translateX(-50%);font-style:normal;font-size:11px;font-weight:850;white-space:nowrap}
  ${P} .dm-strava-barra small{font-size:10px;font-weight:700;opacity:.85}
  /* Sul telefono dodici date non ci stanno: una ogni tre, l'ultima compresa.
   * Le altre restano nel tocco (il titolo della barra). */
  @media (max-width:640px){${P} .dm-strava-barra:not(:nth-child(3n)) small{visibility:hidden}}
  ${P} .dm-strava-periodi{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
  ${P} .dm-strava-periodo{display:grid;gap:2px;padding:14px;border-radius:18px;background:var(--card-background-color,#fff);
    border:1px solid var(--card-border,#e2e8f0)}
  ${P} .dm-strava-periodo-nome{font-size:12px;font-weight:850;color:var(--text-dim,#64748b);text-transform:uppercase;letter-spacing:.05em}
  ${P} .dm-strava-periodo b{font-size:22px;font-weight:900;color:var(--text,#0f172a)}
  ${P} .dm-strava-periodo small{font-size:12.5px;font-weight:700;color:var(--text-dim,#64748b)}
  ${P} .dm-strava-record{display:flex;gap:10px;flex-wrap:wrap}
  ${P} .dm-strava-record span{display:grid;gap:2px;flex:1 1 150px;padding:12px 14px;border-radius:16px;
    background:color-mix(in srgb,var(--str) 10%,var(--card-background-color,#fff));border:1px solid color-mix(in srgb,var(--str) 30%,transparent)}
  ${P} .dm-strava-record small{font-size:12px;font-weight:800;color:var(--text-dim,#64748b)}
  ${P} .dm-strava-record b{font-size:18px;font-weight:900;color:var(--text,#0f172a)}
  ${P} .dm-strava-titolo{margin:6px 2px 0;font-size:15px;font-weight:900;color:var(--text,#0f172a)}
  ${P} .dm-strava-attivita{display:grid;gap:10px}
  ${P} .dm-strava-att{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:6px 12px;align-items:center;padding:14px;border-radius:18px;
    text-decoration:none;color:var(--text,#0f172a);background:var(--card-background-color,#fff);border:1px solid var(--card-border,#e2e8f0)}
  ${P} .dm-strava-att-segno{grid-row:span 2;width:44px;height:44px;border-radius:14px;display:grid;place-items:center;font-size:24px;
    background:color-mix(in srgb,var(--str) 14%,transparent)}
  ${P} .dm-strava-att-testa{min-width:0;display:grid}
  ${P} .dm-strava-att-testa b{font-size:15px;font-weight:850;overflow-wrap:break-word}
  ${P} .dm-strava-att-testa small{font-size:12px;font-weight:700;color:var(--text-dim,#64748b)}
  ${P} .dm-strava-kudos{font-size:12.5px;font-weight:800;color:var(--str);white-space:nowrap}
  ${P} .dm-strava-att-dati{grid-column:2 / -1;display:flex;flex-wrap:wrap;gap:6px 16px}
  ${P} .dm-strava-att-dati span{display:grid}
  ${P} .dm-strava-att-dati small{font-size:11px;font-weight:700;color:var(--text-dim,#64748b)}
  ${P} .dm-strava-att-dati b{font-size:14.5px;font-weight:850}
  ${P} .dm-strava-fonte{margin:0;font-size:11.5px;font-weight:700;color:var(--text-dim,#64748b);text-align:center}
  `;
}
