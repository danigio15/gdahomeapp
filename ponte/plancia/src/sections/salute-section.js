/* La pagina Salute (#227), con Strava dentro (#344).
 *
 * «Una sezione salute che importa i dati da una app della persona: peso,
 * passi, frequenza cardiaca, pressione, sonno.» Le misure le mette in Home
 * Assistant chi le prende — il telefono con Health Connect, la bilancia
 * Withings, l'orologio Garmin — e `core/salute.js` le riconosce da solo, per
 * persona. Strava ha la sua linguetta, coi pezzi di `strava-pezzi.js`.
 *
 * La pagina, dall'alto: Il corpo e Strava (se ci sono tutti e due); le
 * persone (se sono piu' d'una); i passi di oggi in grande con l'anello
 * dell'obiettivo e gli ultimi sette giorni; poi una scheda per misura — il
 * battito, la pressione con la sua fascia, il peso con l'ultimo mese, il
 * sonno, l'ossigeno, le calorie — ognuna con l'ora in cui e' arrivata.
 *
 * Gli ultimi sette giorni dei passi e l'ultimo mese del peso vengono dalle
 * statistiche a lungo termine di Home Assistant, chieste una volta ogni
 * mezz'ora. Niente va da nessun'altra parte.
 */
import { vistaDiStrava } from "../core/strava.js";
import {
  CHIAVE_SALUTE,
  configurazioneSalute,
  durataSonno,
  fasciaPressione,
  giorniDalleStatistiche,
  personeDellaSalute,
} from "../core/salute.js";
import { registraTitoloDiPagina } from "./page-masthead-section.js";
import {
  chiediLeSettimaneStrava,
  finestraStravaMarkup,
  foglioStrava,
  paginaStravaMarkup,
  sportScelto,
  tesseraStrava,
} from "./strava-pezzi.js";
import {
  allStates,
  chiediAHomeAssistant,
  clean,
  doc,
  esc,
  installStyle,
  lexicalGlobal,
  locale,
  paginaVisibile,
  quandoSiCambiaPagina,
  readJson,
  root,
  scriviSeCambia,
  segnaContenuto,
  senzaCadere,
  t,
} from "./shared.js";

export const SALUTE_TAB = "salute";
export const SALUTE_PAGE_ID = "page-salute";
const ROSSO = "#e11d48";
const OGNI = 30 * 60_000;
const GIORNO = 86_400_000;

const KEY = "__DASHBOARDMODERN_SALUTE__";
const state = (root[KEY] ||= {
  installed: false,
  frame: 0,
  /* «corpo» o «strava»; vuoto = il primo che c'e'. */
  vista: "",
  chi: "",
  sport: "",
  /* Le settimane di Strava per sport, e lo storico per entita':
   * `{righe, chieste, chiedendo}`. */
  settimane: {},
  storico: {},
});

/* ── le parole ─────────────────────────────────────────────────────────── */

const NOMI = () => ({
  passi: t("Passi", "Steps"),
  battito: t("Battito", "Heart rate"),
  battitoRiposo: t("A riposo", "Resting"),
  pressione: t("Pressione", "Blood pressure"),
  peso: t("Peso", "Weight"),
  grasso: t("Massa grassa", "Body fat"),
  sonno: t("Sonno", "Sleep"),
  ossigeno: t("Ossigeno", "Blood oxygen"),
  calorie: t("Calorie", "Calories"),
});
const SEGNI = {
  passi: "👟",
  battito: "❤️",
  pressione: "🩺",
  peso: "⚖️",
  sonno: "🌙",
  ossigeno: "🫁",
  calorie: "🔥",
};
const FASCE = () => ({
  ottimale: t("Ottimale", "Optimal"),
  "normale-alta": t("Normale-alta", "High-normal"),
  alta: t("Alta", "High"),
  bassa: t("Bassa", "Low"),
});

const numeroBello = (valore, cifre = 0) =>
  Number.isFinite(valore) ? valore.toLocaleString(locale(), { maximumFractionDigits: cifre }) : "—";

/* «alle 09:40», «ieri alle 22:10», «28 ott». */
function quandoArrivato(iso, adesso = Date.now()) {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  const d = new Date(ms);
  const ora = d.toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });
  const oggi = new Date(adesso);
  oggi.setHours(0, 0, 0, 0);
  if (ms >= oggi.getTime()) return t(`alle ${ora}`, `at ${ora}`);
  if (ms >= oggi.getTime() - GIORNO) return t(`ieri alle ${ora}`, `yesterday at ${ora}`);
  return d.toLocaleDateString(locale(), { day: "numeric", month: "short" });
}

/* ── la vista ──────────────────────────────────────────────────────────── */

/** La Salute com'e' adesso — le persone e Strava — o `null` se non c'e' niente. */
export function vistaSalute(states = allStates() || {}) {
  const config = configurazioneSalute(readJson(CHIAVE_SALUTE, {}));
  const persone = personeDellaSalute(states, config);
  const strava = vistaDiStrava(states);
  if (!persone.length && !strava) return null;
  return { persone, strava, config };
}

function personaScelta(vista) {
  return vista.persone.find((p) => p.chi === state.chi) || vista.persone[0] || null;
}

function vistaScelta(vista) {
  if (state.vista === "strava" && vista.strava) return "strava";
  if (state.vista === "corpo" && vista.persone.length) return "corpo";
  return vista.persone.length ? "corpo" : "strava";
}

/** La tessera della Home: i passi di oggi, se no Strava, se no la prima misura. */
export function tesseraSalute(vista) {
  const persona = vista.persone[0];
  const passi = persona?.misure.passi;
  if (passi) {
    const quota = Math.round((passi.valore / vista.config.obiettivoPassi) * 100);
    return {
      valore: numeroBello(passi.valore),
      riga: `👟 ${t("passi oggi", "steps today")} · ${quota}%${vista.persone.length > 1 ? ` · ${persona.nome}` : ""}`,
    };
  }
  if (vista.strava) {
    const s = tesseraStrava(vista.strava);
    return { valore: s.valore, riga: s.riga };
  }
  const [chiave, m] = Object.entries(persona?.misure || {})[0] || [];
  return { valore: m ? `${numeroBello(m.valore, 1)} ${m.unita}` : "—", riga: NOMI()[chiave] || "" };
}

/** Il sottotitolo della finestra: chi c'e', corto perche' si legga intero. */
export function sottotitoloSalute(vista) {
  if (!vista) return "";
  const parti = vista.persone.map((p) => p.nome);
  if (vista.strava) parti.push("Strava");
  return parti.join(" · ");
}

/* ── i pezzi ───────────────────────────────────────────────────────────── */

function anelloMarkup(quota) {
  const r = 46;
  const giro = 2 * Math.PI * r;
  const pieno = Math.max(0, Math.min(1, quota)) * giro;
  return `<svg class="dm-salute-anello" viewBox="0 0 108 108" aria-hidden="true">
    <circle cx="54" cy="54" r="${r}" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="10"/>
    <circle cx="54" cy="54" r="${r}" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round"
      stroke-dasharray="${pieno.toFixed(1)} ${giro.toFixed(1)}" transform="rotate(-90 54 54)"/>
  </svg>`;
}

function storicoDi(misura) {
  return misura ? state.storico[misura.entity]?.righe : undefined;
}

/* Gli ultimi sette giorni dei passi: oggi a destra, la linea dell'obiettivo. */
function settimanaPassiMarkup(misura, obiettivo) {
  if (!misura?.statistiche) return "";
  const righe = storicoDi(misura);
  if (!Array.isArray(righe))
    return `<div class="dm-salute-giorni dm-salute-attesa">${esc(t("Carico i giorni…", "Loading the days…"))}</div>`;
  const giorni = giorniDalleStatistiche(righe, misura.classe).slice(-7);
  if (!giorni.length) return "";
  /* Oggi si legge dal sensore: le statistiche dell'ultimo giorno arrivano
   * all'ora piena. */
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  if (giorni.at(-1).inizio >= oggi.getTime()) giorni.at(-1).valore = misura.valore;
  const massimo = Math.max(obiettivo, ...giorni.map((g) => g.valore), 1);
  const linea = Math.round((obiettivo / massimo) * 100);
  return `<div class="dm-salute-giorni" style="--obiettivo:${linea}%">
    ${giorni
      .map((g, i) => {
        const altezza = Math.max(2, Math.round((g.valore / massimo) * 100));
        const giorno = new Date(g.inizio).toLocaleDateString(locale(), { weekday: "short" });
        const etichetta = `${giorno}: ${numeroBello(g.valore)} ${t("passi", "steps")}`;
        return `<span class="dm-salute-giorno${i === giorni.length - 1 ? " ora" : ""}${g.valore >= obiettivo ? " fatto" : ""}" title="${esc(etichetta)}" aria-label="${esc(etichetta)}" role="img">
          <span class="dm-salute-colonna"><i style="height:${altezza}%"></i></span>
          <small>${esc(giorno)}</small>
        </span>`;
      })
      .join("")}
  </div>`;
}

/* Il peso dell'ultimo mese: una linea, il primo e l'ultimo valore. */
function meseDelPesoMarkup(misura) {
  if (!misura?.statistiche) return "";
  const righe = storicoDi(misura);
  if (!Array.isArray(righe)) return `<div class="dm-salute-linea dm-salute-attesa">${esc(t("Carico il mese…", "Loading the month…"))}</div>`;
  const giorni = giorniDalleStatistiche(righe, misura.classe);
  if (giorni.length < 2) return "";
  const valori = giorni.map((g) => g.valore);
  const minimo = Math.min(...valori);
  const massimo = Math.max(...valori);
  const campo = Math.max(massimo - minimo, 0.5);
  const L = 300;
  const A = 70;
  const x = (i) => (i / (giorni.length - 1)) * (L - 8) + 4;
  const y = (v) => A - 6 - ((v - minimo) / campo) * (A - 14);
  const punti = giorni.map((g, i) => `${x(i).toFixed(1)},${y(g.valore).toFixed(1)}`).join(" ");
  const ultimo = giorni.at(-1);
  const differenza = ultimo.valore - giorni[0].valore;
  const segno = differenza > 0 ? "+" : differenza < 0 ? "−" : "±";
  return `<figure class="dm-salute-linea">
    <svg viewBox="0 0 ${L} ${A}" preserveAspectRatio="none" role="img" aria-label="${esc(
      t(`Peso negli ultimi ${giorni.length} giorni`, `Weight over the last ${giorni.length} days`),
    )}">
      <polyline points="${punti}" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
    </svg>
    <i class="dm-salute-punto" style="left:${((x(giorni.length - 1) / L) * 100).toFixed(1)}%;top:${((y(ultimo.valore) / A) * 100).toFixed(1)}%"></i>
    <figcaption>${esc(
      t(`${giorni.length} giorni · ${segno}${numeroBello(Math.abs(differenza), 1)} ${misura.unita}`, `${giorni.length} days · ${segno}${numeroBello(Math.abs(differenza), 1)} ${misura.unita}`),
    )}</figcaption>
  </figure>`;
}

function schedaMarkup(chiave, { valore, unita, sotto = "", quando = "", extra = "", largo = false, nota = "" }) {
  return `<article class="dm-salute-scheda${largo ? " larga" : ""}" data-dm-salute-misura="${chiave}">
    <div class="dm-salute-testa"><span class="dm-salute-segno" aria-hidden="true">${SEGNI[chiave] || "•"}</span><span>${esc(NOMI()[chiave])}</span></div>
    <b>${esc(valore)}${unita ? `<small> ${esc(unita)}</small>` : ""}</b>
    ${nota ? `<em class="dm-salute-fascia" data-fascia="${esc(nota)}">${esc(FASCE()[nota] || nota)}</em>` : ""}
    ${sotto ? `<span class="dm-salute-sotto">${esc(sotto)}</span>` : ""}
    ${extra}
    ${quando ? `<time>${esc(quando)}</time>` : ""}
  </article>`;
}

function schedeMarkup(persona) {
  const m = persona.misure;
  const schede = [];
  if (m.battito || m.battitoRiposo) {
    const principale = m.battito || m.battitoRiposo;
    schede.push(
      schedaMarkup("battito", {
        valore: numeroBello(principale.valore),
        unita: "bpm",
        sotto: m.battito && m.battitoRiposo ? `${NOMI().battitoRiposo}: ${numeroBello(m.battitoRiposo.valore)} bpm` : m.battito ? "" : NOMI().battitoRiposo,
        quando: quandoArrivato(principale.quando),
      }),
    );
  }
  if (m.sistolica && m.diastolica) {
    schede.push(
      schedaMarkup("pressione", {
        valore: `${numeroBello(m.sistolica.valore)}/${numeroBello(m.diastolica.valore)}`,
        unita: "mmHg",
        nota: fasciaPressione(m.sistolica.valore, m.diastolica.valore),
        quando: quandoArrivato(m.sistolica.quando),
      }),
    );
  }
  if (m.peso) {
    schede.push(
      schedaMarkup("peso", {
        valore: numeroBello(m.peso.valore, 1),
        unita: m.peso.unita,
        sotto: m.grasso ? `${NOMI().grasso}: ${numeroBello(m.grasso.valore, 1)}%` : "",
        quando: quandoArrivato(m.peso.quando),
        extra: meseDelPesoMarkup(m.peso),
        largo: Boolean(m.peso.statistiche),
      }),
    );
  } else if (m.grasso) {
    schede.push(schedaMarkup("peso", { valore: numeroBello(m.grasso.valore, 1), unita: "%", sotto: NOMI().grasso, quando: quandoArrivato(m.grasso.quando) }));
  }
  if (m.sonno)
    schede.push(schedaMarkup("sonno", { valore: durataSonno(m.sonno.valore), unita: "", sotto: t("stanotte", "last night"), quando: quandoArrivato(m.sonno.quando) }));
  if (m.ossigeno)
    schede.push(schedaMarkup("ossigeno", { valore: numeroBello(m.ossigeno.valore), unita: "%", sotto: "SpO₂", quando: quandoArrivato(m.ossigeno.quando) }));
  if (m.calorie)
    schede.push(schedaMarkup("calorie", { valore: numeroBello(m.calorie.valore), unita: m.calorie.unita || "kcal", sotto: t("oggi", "today"), quando: quandoArrivato(m.calorie.quando) }));
  return schede.length ? `<div class="dm-salute-schede">${schede.join("")}</div>` : "";
}

function eroeMarkup(persona, obiettivo, { finestra = false } = {}) {
  const passi = persona.misure.passi;
  if (!passi) return "";
  const quota = passi.valore / obiettivo;
  return `<section class="dm-salute-eroe">
    <div class="dm-salute-eroe-testa">
      <div class="dm-salute-eroe-anello">${anelloMarkup(quota)}<span>${Math.round(quota * 100)}%</span></div>
      <div class="dm-salute-eroe-dati">
        <span class="dm-salute-eroe-nome">👟 ${esc(t("Passi di oggi", "Today's steps"))}</span>
        <b class="dm-salute-eroe-num">${esc(numeroBello(passi.valore))}</b>
        <span class="dm-salute-eroe-sotto">${esc(
          quota >= 1
            ? t(`Obiettivo di ${numeroBello(obiettivo)} raggiunto`, `${numeroBello(obiettivo)} goal reached`)
            : t(`Ne mancano ${numeroBello(obiettivo - passi.valore)} a ${numeroBello(obiettivo)}`, `${numeroBello(obiettivo - passi.valore)} to go to ${numeroBello(obiettivo)}`),
        )}</span>
      </div>
    </div>
    ${finestra ? "" : settimanaPassiMarkup(passi, obiettivo)}
  </section>`;
}

function corpoMarkup(vista) {
  const persona = personaScelta(vista);
  if (!persona) return "";
  const persone =
    vista.persone.length > 1
      ? `<div class="dm-salute-persone" role="tablist">${vista.persone
          .map(
            (p) =>
              `<button type="button" role="tab" aria-selected="${p.chi === persona.chi}" data-dm-salute-chi="${esc(p.chi)}">${esc(p.nome)}</button>`,
          )
          .join("")}</div>`
      : "";
  return `${persone}${eroeMarkup(persona, vista.config.obiettivoPassi)}${schedeMarkup(persona)}
    <p class="dm-salute-fonte">${esc(
      t(
        "Le misure arrivano in Home Assistant dal telefono (Health Connect), dalla bilancia, dall'orologio. Non sono un parere medico.",
        "Readings reach Home Assistant from the phone (Health Connect), the scale, the watch. They are not medical advice.",
      ),
    )}</p>`;
}

/** La pagina intera. */
export function paginaSaluteMarkup(vista) {
  const quale = vistaScelta(vista);
  const linguette =
    vista.persone.length && vista.strava
      ? `<div class="dm-salute-viste" role="tablist">
          <button type="button" role="tab" aria-selected="${quale === "corpo"}" data-dm-salute-vista="corpo">❤️ ${esc(t("Il corpo", "Body"))}</button>
          <button type="button" role="tab" aria-selected="${quale === "strava"}" data-dm-salute-vista="strava">🏃 Strava</button>
        </div>`
      : "";
  const sport = vista.strava ? sportScelto(vista.strava, state.sport) : "";
  const corpo =
    quale === "strava"
      ? paginaStravaMarkup(vista.strava, { sport, settimane: state.settimane[sport]?.righe ?? null })
      : `<div class="dm-salute-corpo">${corpoMarkup(vista)}</div>`;
  return `<div class="dm-salute">${linguette}${corpo}</div>`;
}

/** La finestra della tessera: i passi, le misure della prima persona, Strava. */
export function finestraSaluteMarkup(vista) {
  if (!vista) return "";
  const persona = vista.persone[0];
  return `<div class="dm-salute dm-salute-finestra">
    ${persona ? `${eroeMarkup(persona, vista.config.obiettivoPassi, { finestra: true })}${schedeMarkup({ ...persona, misure: { ...persona.misure, peso: persona.misure.peso && { ...persona.misure.peso, statistiche: false } } })}` : ""}
    ${vista.strava ? finestraStravaMarkup(vista.strava) : ""}
  </div>`;
}

/* ── lo storico ────────────────────────────────────────────────────────── */

async function chiediLoStorico(misura, giorni, tipi) {
  if (!misura?.statistiche) return;
  const voce = (state.storico[misura.entity] ||= { righe: null, chieste: 0, chiedendo: false });
  if (voce.chiedendo || Date.now() - voce.chieste < OGNI) return;
  voce.chiedendo = true;
  voce.chieste = Date.now();
  const inizio = new Date();
  inizio.setHours(0, 0, 0, 0);
  inizio.setDate(inizio.getDate() - (giorni - 1));
  try {
    const risposta = await chiediAHomeAssistant(
      {
        type: "recorder/statistics_during_period",
        start_time: inizio.toISOString(),
        end_time: new Date().toISOString(),
        statistic_ids: [misura.entity],
        period: "day",
        types: tipi,
      },
      20_000,
    );
    voce.righe = Array.isArray(risposta?.[misura.entity]) ? risposta[misura.entity] : [];
  } catch (_errore) {
    voce.righe = voce.righe || [];
  } finally {
    voce.chiedendo = false;
    schedule();
  }
}

/* ── la pagina e la voce ───────────────────────────────────────────────── */

function ultimaPagina() {
  const pagine = doc?.querySelectorAll?.(".page");
  return pagine?.length ? pagine[pagine.length - 1] : null;
}

function ensurePagina() {
  if (!doc) return null;
  let pagina = doc.getElementById(SALUTE_PAGE_ID);
  if (pagina) return pagina;
  const sorella = ultimaPagina();
  if (!sorella?.parentElement) return null;
  pagina = doc.createElement("section");
  pagina.className = "page";
  pagina.id = SALUTE_PAGE_ID;
  pagina.innerHTML = `<div class="dm-salute-wrap" id="salute-wrap"></div>`;
  sorella.after(pagina);
  return pagina;
}

function apriLaPagina(voce) {
  for (const nodo of doc.querySelectorAll(".tab")) nodo.classList.remove("active");
  for (const nodo of doc.querySelectorAll(".page")) nodo.classList.remove("active");
  voce?.classList.add("active");
  ensurePagina()?.classList.add("active");
  root.scrollTo?.({ top: 0, behavior: "instant" });
  if (root.navigator?.vibrate) root.navigator.vibrate(5);
  schedule();
}

function ensureVoce() {
  if (!doc) return null;
  let voce = doc.querySelector(`.tab[data-tab="${SALUTE_TAB}"]`);
  if (voce) return voce;
  const barra = doc.querySelector("nav.tabs");
  if (!barra) return null;
  /* Dopo lo sport: e' tempo per se' anche lei. */
  const dopo =
    barra.querySelector('.tab[data-tab="sport"]') ||
    barra.querySelector('.tab[data-tab="media"]') ||
    barra.querySelector('.tab[data-tab="home"]');
  voce = doc.createElement("button");
  voce.className = "tab";
  voce.dataset.tab = SALUTE_TAB;
  voce.id = `tab-${SALUTE_TAB}`;
  voce.innerHTML = `<span class="icon">❤️</span><span class="text">${esc(t("Salute", "Health"))}</span>`;
  voce.addEventListener("click", () => apriLaPagina(voce));
  if (dopo) dopo.after(voce);
  else barra.append(voce);
  try {
    lexicalGlobal("cdApplyNavOrder")?.();
  } catch (_errore) {}
  return voce;
}

function sezioneAccesa() {
  const sezioni = readJson("cd_sections", {});
  return !(sezioni && typeof sezioni === "object" && sezioni[SALUTE_TAB] === false);
}

function accendiLaVoce(vista) {
  if (!vista && !doc.querySelector(`.tab[data-tab="${SALUTE_TAB}"]`)) {
    segnaContenuto(SALUTE_TAB, false);
    return false;
  }
  const voce = ensureVoce();
  if (!voce) return false;
  const serve = segnaContenuto(SALUTE_TAB, Boolean(vista)) && sezioneAccesa();
  if (serve) voce.style.removeProperty("display");
  else voce.style.setProperty("display", "none", "important");
  const pagina = doc.getElementById(SALUTE_PAGE_ID);
  if (!serve && pagina?.classList.contains("active")) doc.querySelector('.tab[data-tab="home"]')?.click();
  return serve;
}

function dipingi(vista) {
  const pagina = ensurePagina();
  const dove = pagina?.querySelector?.("#salute-wrap");
  if (!dove || !paginaVisibile(SALUTE_PAGE_ID)) return;
  if (vistaScelta(vista) === "strava") {
    const sport = sportScelto(vista.strava, state.sport);
    if (vista.strava.statistiche.sport[sport]) void chiediLeSettimaneStrava(vista.strava, sport, state.settimane, schedule);
  } else {
    const persona = personaScelta(vista);
    void chiediLoStorico(persona?.misure.passi, 7, ["change", "max", "state"]);
    void chiediLoStorico(persona?.misure.peso, 30, ["mean", "max", "state"]);
  }
  scriviSeCambia(dove, paginaSaluteMarkup(vista));
}

function schedule() {
  if (state.frame) return;
  const giro = () => {
    state.frame = 0;
    try {
      const vista = vistaSalute();
      if (accendiLaVoce(vista) && vista) dipingi(vista);
    } catch (errore) {
      root.console?.warn?.("[DashboardModern] salute", errore);
    }
  };
  state.frame = root.requestAnimationFrame?.(giro) || 0;
  if (!state.frame) giro();
}

function alTocco(evento) {
  const vista = evento.target?.closest?.("[data-dm-salute-vista]");
  const chi = evento.target?.closest?.("[data-dm-salute-chi]");
  const sport = evento.target?.closest?.(`#${SALUTE_PAGE_ID} [data-dm-strava-sport]`);
  if (vista) state.vista = clean(vista.dataset.dmSaluteVista);
  else if (chi) state.chi = clean(chi.dataset.dmSaluteChi);
  else if (sport) state.sport = clean(sport.dataset.dmStravaSport);
  else return;
  schedule();
}

function titoloDellaPagina() {
  const vista = vistaSalute();
  if (!vista) return null;
  const parti = [];
  if (vista.persone.length) parti.push(vista.persone.map((p) => p.nome).join(" · "));
  if (vista.strava) parti.push("Strava");
  return { subtitle: parti.join(" · ") };
}

/* ── il foglio ─────────────────────────────────────────────────────────── */

export function foglioSalute(P) {
  return `
  ${foglioStrava(P)}
  ${P} .dm-salute{display:grid;gap:14px;--sal:${ROSSO}}
  ${P} .dm-salute-corpo{display:grid;gap:14px}
  ${P} .dm-salute-viste,${P} .dm-salute-persone{display:flex;gap:8px;flex-wrap:wrap}
  ${P} .dm-salute-viste button,${P} .dm-salute-persone button{padding:9px 14px;border-radius:999px;font:inherit;font-size:14px;font-weight:800;
    cursor:pointer;color:var(--text,#0f172a);background:var(--card-background-color,#fff);border:1px solid var(--card-border,#e2e8f0)}
  ${P} .dm-salute-viste button[aria-selected="true"]{color:#fff;background:var(--sal);border-color:var(--sal)}
  ${P} .dm-salute-persone button{font-size:13px;padding:7px 12px}
  ${P} .dm-salute-persone button[aria-selected="true"]{color:var(--sal);border-color:var(--sal);background:color-mix(in srgb,var(--sal) 10%,var(--card-background-color,#fff))}
  ${P} .dm-salute-eroe{display:grid;gap:12px;padding:18px;border-radius:24px;color:#fff;
    background:linear-gradient(150deg,#f43f5e,#e11d48 55%,#9f1239);box-shadow:0 18px 40px -26px rgba(225,29,72,.9)}
  ${P} .dm-salute-eroe-testa{display:flex;align-items:center;gap:16px}
  ${P} .dm-salute-eroe-anello{position:relative;width:96px;height:96px;flex:0 0 auto}
  ${P} .dm-salute-anello{width:100%;height:100%}
  ${P} .dm-salute-eroe-anello span{position:absolute;inset:0;display:grid;place-items:center;font-size:17px;font-weight:900}
  ${P} .dm-salute-eroe-dati{display:grid;gap:2px;min-width:0}
  ${P} .dm-salute-eroe-nome{font-size:12px;font-weight:850;letter-spacing:.08em;text-transform:uppercase;opacity:.92}
  ${P} .dm-salute-eroe-num{font-size:44px;font-weight:900;line-height:1.05;letter-spacing:-.02em}
  ${P} .dm-salute-eroe-sotto{font-size:14px;font-weight:700;opacity:.92;overflow-wrap:break-word}
  ${P} .dm-salute-giorni{position:relative;display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px;padding:10px 10px 4px;
    border-radius:16px;background:rgba(255,255,255,.12)}
  ${P} .dm-salute-attesa{display:block;font-size:13px;font-weight:700;opacity:.9;padding:14px}
  ${P} .dm-salute-giorno{display:flex;flex-direction:column;align-items:center;gap:4px}
  ${P} .dm-salute-colonna{position:relative;display:block;width:100%;height:96px}
  ${P} .dm-salute-colonna::after{content:"";position:absolute;left:-4px;right:-4px;bottom:var(--obiettivo);border-top:1px dashed rgba(255,255,255,.55)}
  ${P} .dm-salute-giorno i{position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:100%;max-width:30px;border-radius:5px 5px 0 0;
    background:rgba(255,255,255,.45)}
  ${P} .dm-salute-giorno.fatto i{background:rgba(255,255,255,.75)}
  ${P} .dm-salute-giorno.ora i{background:#fff}
  ${P} .dm-salute-giorno small{font-size:11px;font-weight:800;opacity:.9;text-transform:capitalize}
  ${P} .dm-salute-schede{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}
  ${P} .dm-salute-scheda{display:grid;gap:3px;align-content:start;padding:14px;border-radius:18px;background:var(--card-background-color,#fff);
    border:1px solid var(--card-border,#e2e8f0);min-width:0}
  ${P} .dm-salute-scheda.larga{grid-column:span 2}
  ${P} .dm-salute-testa{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:12px;font-weight:850;
    color:var(--text-dim,#64748b);text-transform:uppercase;letter-spacing:.05em}
  ${P} .dm-salute-segno{font-size:16px}
  ${P} .dm-salute-scheda > b{font-size:26px;font-weight:900;color:var(--text,#0f172a);line-height:1.15;white-space:nowrap}
  ${P} .dm-salute-finestra .dm-salute-scheda > b{font-size:22px}
  ${P} .dm-salute-scheda > b small{font-size:13px;font-weight:800;color:var(--text-dim,#64748b)}
  ${P} .dm-salute-sotto{font-size:13px;font-weight:700;color:var(--text,#0f172a);opacity:.8}
  ${P} .dm-salute-scheda time{font-size:11.5px;font-weight:700;color:var(--text-dim,#64748b)}
  ${P} .dm-salute-fascia{justify-self:start;font-style:normal;font-size:11px;font-weight:850;letter-spacing:.02em;text-transform:none;
    padding:3px 8px;border-radius:999px;color:#047857;background:color-mix(in srgb,#10b981 16%,transparent)}
  ${P} .dm-salute-fascia[data-fascia="normale-alta"]{color:#b45309;background:color-mix(in srgb,#f59e0b 18%,transparent)}
  ${P} .dm-salute-fascia[data-fascia="alta"]{color:#b91c1c;background:color-mix(in srgb,#ef4444 16%,transparent)}
  ${P} .dm-salute-fascia[data-fascia="bassa"]{color:#1d4ed8;background:color-mix(in srgb,#3b82f6 16%,transparent)}
  ${P} .dm-salute-linea{position:relative;margin:8px 0 0;color:var(--sal)}
  ${P} .dm-salute-linea svg{display:block;width:100%;height:70px}
  ${P} .dm-salute-punto{position:absolute;width:9px;height:9px;margin:-4.5px 0 0 -4.5px;border-radius:50%;background:var(--sal);
    box-shadow:0 0 0 3px var(--card-background-color,#fff)}
  ${P} .dm-salute-linea figcaption{font-size:11.5px;font-weight:700;color:var(--text-dim,#64748b);margin-top:2px}
  ${P} .dm-salute-linea.dm-salute-attesa{color:var(--text-dim,#64748b);padding:6px 0}
  ${P} .dm-salute-fonte{margin:0;font-size:11.5px;font-weight:700;color:var(--text-dim,#64748b);text-align:center}
  ${P} .dm-salute-finestra .dm-strava{gap:10px}
  @media (max-width:640px){
    ${P} .dm-salute-schede{grid-template-columns:repeat(2,minmax(0,1fr))}
    ${P} .dm-salute-scheda.larga{grid-column:1 / -1}
    ${P} .dm-salute-eroe-num{font-size:38px}
    ${P} .dm-salute-eroe-anello{width:84px;height:84px}
  }
  `;
}

/* ── l'installazione ───────────────────────────────────────────────────── */

export function installSalute() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyle("dm-salute-style", foglioSalute(`#${SALUTE_PAGE_ID}`));
  registraTitoloDiPagina(SALUTE_PAGE_ID, titoloDellaPagina);
  /* Come lo sport: quando la plancia ridisegna la barra, la voce si rimette
   * com'era (accesa o spenta). */
  for (const nome of ["render", "cdApplyNavVis"]) {
    const precedente = root[nome];
    if (typeof precedente !== "function" || precedente.__dmSalute) continue;
    const avvolta = function (...args) {
      const esito = precedente.apply(this, args);
      schedule();
      return esito;
    };
    avvolta.__dmSalute = true;
    avvolta.__dmPrevious = precedente;
    root[nome] = avvolta;
  }
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:state-changed",
    "dashboardmodern:persistence-restored",
  ])
    root.addEventListener?.(evento, schedule);
  doc.addEventListener?.("click", alTocco);
  quandoSiCambiaPagina(schedule);
  schedule();
  return true;
}

senzaCadere(installSalute);
