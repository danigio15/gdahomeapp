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
  giorniUniti,
  personeDellaSalute,
  puntiConFascia,
  riassuntoDeiGiorni,
} from "../core/salute.js";
import { normalizePeople, personInitials, personViewModel } from "../core/person-model.js";
import { registraTitoloDiPagina } from "./page-masthead-section.js";
import { fermaRitrattiPersi, installAvatar3dStyle, ritrattoVivo } from "./person-avatar-section.js";
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
  /* La finestra dello storico: `{misura, periodo, giorno, da}` o `null`, e le
   * statistiche che chiede, per chiave della domanda. */
  dettaglio: null,
  dati: {},
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
  calorieRiposo: t("A riposo", "Resting"),
  distanza: t("Distanza", "Distance"),
  piani: t("Piani saliti", "Flights climbed"),
  attivita: t("Attività", "Activity"),
  movimento: t("Movimento", "Move"),
  esercizio: t("Esercizio", "Exercise"),
  inPiedi: t("In piedi", "Stand"),
});
const SEGNI = {
  passi: "👟",
  battito: "❤️",
  pressione: "🩺",
  peso: "⚖️",
  sonno: "🌙",
  ossigeno: "🫁",
  calorie: "🔥",
  attivita: "🏃",
  distanza: "🚶",
  piani: "🪜",
};

/* I colori degli anelli, come li conosce chi ha un Apple Watch. */
const ANELLI = { movimento: "#fa114f", esercizio: "#65c51b", inPiedi: "#0fb5d6" };

/* «6 piani», «1 piano». */
const pianiTesto = (n) =>
  `${numeroBello(n)} ${n === 1 ? t("piano", "flight") : t("piani", "flights")}`;

/* Il piu' recente fra gli istanti di piu' misure. */
const piuRecente = (...misure) =>
  misure
    .filter(Boolean)
    .map((m) => m.quando)
    .sort((a, b) => (Date.parse(b) || 0) - (Date.parse(a) || 0))[0] || "";
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

/* I giorni di una misura, coi sensori che le stanno dietro (`altre`, lo
 * stesso telefono visto dall'app di Home Assistant): `null` finche' il
 * principale non e' arrivato. */
function giorniDi(misura) {
  const righe = storicoDi(misura);
  if (misura?.statistiche && !Array.isArray(righe)) return null;
  const altri = (misura?.altre || [])
    .filter((a) => a.statistiche)
    .map((a) => giorniDalleStatistiche(storicoDi(a) || [], a.classe));
  return giorniUniti(giorniDalleStatistiche(righe || [], misura?.classe), altri, misura?.classe);
}

/* Lo storico c'e' se ce l'ha il sensore o uno di quelli dietro. */
const conStorico = (misura) =>
  Boolean(misura?.statistiche || misura?.altre?.some((a) => a.statistiche));

/* Gli ultimi sette giorni dei passi: oggi a destra, la linea dell'obiettivo. */
function settimanaPassiMarkup(misura, obiettivo) {
  if (!conStorico(misura)) return "";
  const tutti = giorniDi(misura);
  if (!tutti)
    return `<div class="dm-salute-giorni dm-salute-attesa">${esc(t("Carico i giorni…", "Loading the days…"))}</div>`;
  const giorni = tutti.slice(-7);
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
        return `<span class="dm-salute-giorno${i === giorni.length - 1 ? " ora" : ""}${g.valore >= obiettivo ? " fatto" : ""}" title="${esc(etichetta)}" aria-label="${esc(etichetta)}" role="button" tabindex="0" data-dm-salute-giorno="${g.inizio}">
          <span class="dm-salute-colonna"><i style="height:${altezza}%"></i></span>
          <small>${esc(giorno)}</small>
        </span>`;
      })
      .join("")}
  </div>`;
}

/* Il peso dell'ultimo mese: una linea, il primo e l'ultimo valore. */
function meseDelPesoMarkup(misura) {
  if (!conStorico(misura)) return "";
  const giorni = giorniDi(misura);
  if (!giorni) return `<div class="dm-salute-linea dm-salute-attesa">${esc(t("Carico il mese…", "Loading the month…"))}</div>`;
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
  return `<article class="dm-salute-scheda${largo ? " larga" : ""}" data-dm-salute-misura="${chiave}" role="button" tabindex="0">
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
  /* Senza i passi, la distanza e i piani non hanno la fascia rossa in cui
   * stare: hanno la loro scheda. */
  if (!m.passi && m.distanza)
    schede.push(schedaMarkup("distanza", { valore: numeroBello(m.distanza.valore, 2), unita: "km", sotto: t("oggi", "today"), quando: quandoArrivato(m.distanza.quando) }));
  if (!m.passi && m.piani)
    schede.push(schedaMarkup("piani", { valore: numeroBello(m.piani.valore), unita: "", sotto: t("oggi", "today"), quando: quandoArrivato(m.piani.quando) }));
  if (m.esercizio || m.inPiedi) schede.push(attivitaMarkup(m));
  else if (m.calorie || m.calorieRiposo) {
    const principale = m.calorie || m.calorieRiposo;
    const riposo =
      m.calorie && m.calorieRiposo ? ` · ${NOMI().calorieRiposo.toLowerCase()} ${numeroBello(m.calorieRiposo.valore)} kcal` : "";
    schede.push(
      schedaMarkup("calorie", {
        valore: numeroBello(principale.valore),
        unita: principale.unita || "kcal",
        sotto: m.calorie ? `${t("oggi", "today")}${riposo}` : t("a riposo, oggi", "resting, today"),
        quando: quandoArrivato(piuRecente(m.calorie, m.calorieRiposo)),
      }),
    );
  }
  return schede.length ? `<div class="dm-salute-schede">${schede.join("")}</div>` : "";
}

/* L'anello Attivita' dell'Apple Watch: Movimento, Esercizio, In piedi, coi
 * loro colori, e sotto le calorie a riposo. Niente anelli disegnati: gli
 * obiettivi li sceglie ognuno sull'orologio, e Salute non li da'. */
function attivitaMarkup(m) {
  const voce = (chiave, misura, unita) =>
    `<div class="dm-salute-anello-voce" style="--anello:${ANELLI[chiave]}">
      <span>${esc(NOMI()[chiave])}</span>
      <b>${misura ? esc(numeroBello(Math.floor(misura.valore))) : "—"}<small> ${esc(unita)}</small></b>
    </div>`;
  /* Come gli anelli dell'orologio: i numeri interi, troncati (4,6 kcal e'
   * «4»). */
  const totale =
    m.calorie && m.calorieRiposo ? Math.floor(m.calorie.valore + m.calorieRiposo.valore) : null;
  const riposo = m.calorieRiposo
    ? `<span class="dm-salute-sotto">${esc(
        `${NOMI().calorieRiposo}: ${numeroBello(Math.floor(m.calorieRiposo.valore))} kcal${
          totale === null ? "" : ` · ${t("totale", "total")} ${numeroBello(totale)} kcal`
        }`,
      )}</span>`
    : "";
  const quando = quandoArrivato(piuRecente(m.calorie, m.esercizio, m.inPiedi, m.calorieRiposo));
  return `<article class="dm-salute-scheda larga dm-salute-attivita" data-dm-salute-misura="attivita" role="button" tabindex="0">
    <div class="dm-salute-testa"><span class="dm-salute-segno" aria-hidden="true">${SEGNI.attivita}</span><span>${esc(NOMI().attivita)}</span></div>
    <div class="dm-salute-anelli">
      ${voce("movimento", m.calorie, "kcal")}
      ${voce("esercizio", m.esercizio, "min")}
      ${voce("inPiedi", m.inPiedi, "h")}
    </div>
    ${riposo}
    ${quando ? `<time>${esc(quando)}</time>` : ""}
  </article>`;
}

/* Sotto i passi: quanta strada, quanti piani. */
function stradaMarkup(m) {
  const parti = [];
  if (m.distanza) parti.push(`<span>${SEGNI.distanza} ${esc(numeroBello(m.distanza.valore, 2))} km</span>`);
  if (m.piani) parti.push(`<span>${SEGNI.piani} ${esc(pianiTesto(m.piani.valore))}</span>`);
  return parti.length ? `<span class="dm-salute-eroe-strada">${parti.join("")}</span>` : "";
}

function eroeMarkup(persona, obiettivo, { finestra = false } = {}) {
  const passi = persona.misure.passi;
  if (!passi) return "";
  const quota = passi.valore / obiettivo;
  return `<section class="dm-salute-eroe"${finestra ? "" : ' data-dm-salute-misura="passi" role="button" tabindex="0"'}>
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
        ${stradaMarkup(persona.misure)}
      </div>
    </div>
    ${finestra ? "" : settimanaPassiMarkup(passi, obiettivo)}
  </section>`;
}

/* ── di chi sono le misure ────────────────────────────────────────────────
 *
 * «Sposta il nome sotto, non nell'etichetta della sezione, e riporta lo
 * stesso avatar configurato di quella persona.» Il nome stava nel
 * sottotitolo della pagina, in maiuscoletto sotto «Salute», dove sembrava il
 * nome della sezione. Adesso apre il corpo della pagina, col ritratto che la
 * persona ha in «Persone»: la foto, l'avatar costruito, l'emoji, o le
 * iniziali sul suo colore. Chi in «Persone» non c'e' ha le iniziali sul
 * rosso della Salute.
 */

const senzaSegni = (testo) =>
  clean(testo)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/** Le persone di «Persone», ognuna con come si vede adesso e i nomi con cui si riconosce. */
function genteDiCasa(states) {
  return normalizePeople(readJson("cd_people", [])).map((persona) => {
    const vista = personViewModel(persona, states, Date.now());
    const nomi = [vista.name, persona.name, clean(persona.entity).split(".")[1]?.replace(/_/g, " ")]
      .map(senzaSegni)
      .filter(Boolean);
    return { persona, vista, nomi };
  });
}

/**
 * Chi, in «Persone», e' la persona di queste misure: stesso nome (o stessa
 * entita'), senza badare a maiuscole e accenti; se no, lo stesso primo nome —
 * «Giovanni» e «Giovanni Rossi» —, ma solo se in casa ce n'e' uno solo.
 */
export function personaDiCasa(persona, gente) {
  const cerco = [persona?.nome, persona?.chi].map(senzaSegni).filter(Boolean);
  if (!cerco.length) return null;
  const precisa = gente.find((g) => g.nomi.some((n) => cerco.includes(n)));
  if (precisa) return precisa;
  const primo = (nome) => nome.split(/\s+/)[0];
  const simili = gente.filter((g) => g.nomi.some((n) => cerco.some((c) => primo(n) === primo(c))));
  return simili.length === 1 ? simili[0] : null;
}

function ritrattoMarkup(persona, casa) {
  const vista = casa?.vista;
  const avatar = vista?.avatar || {};
  const dentro = avatar.face
    ? ""
    : clean(avatar.emoji)
      ? esc(avatar.emoji)
      : `<b>${esc(vista?.initials || personInitials(persona.nome))}</b>`;
  const foto = vista?.photo ? `<img src="${esc(vista.photo)}" alt="" loading="lazy" data-dm-salute-foto>` : "";
  return `<span class="dm-salute-ritratto" style="--dm-person-color:${esc(clean(avatar.color) || ROSSO)}"><span class="dm-salute-avatar"${
    avatar.face ? ` data-ritratto="${esc(casa.persona.id)}"` : ""
  }>${dentro}</span>${foto}</span>`;
}

/** Chi e': una persona sola ha il suo ritratto e il nome; piu' persone, le linguette coi ritratti. */
function chiMarkup(vista, persona, states) {
  const gente = genteDiCasa(states);
  if (vista.persone.length > 1) {
    return `<div class="dm-salute-persone" role="tablist">${vista.persone
      .map(
        (p) =>
          `<button type="button" role="tab" aria-selected="${p.chi === persona.chi}" data-dm-salute-chi="${esc(p.chi)}">${ritrattoMarkup(p, personaDiCasa(p, gente))}<span>${esc(p.nome)}</span></button>`,
      )
      .join("")}</div>`;
  }
  return `<div class="dm-salute-chi">${ritrattoMarkup(persona, personaDiCasa(persona, gente))}<b>${esc(persona.nome)}</b></div>`;
}

function corpoMarkup(vista, states = allStates() || {}) {
  const persona = personaScelta(vista);
  if (!persona) return "";
  const persone = chiMarkup(vista, persona, states);
  return `${persone}${eroeMarkup(persona, vista.config.obiettivoPassi)}${schedeMarkup(persona)}
    <p class="dm-salute-fonte">${esc(
      t(
        "Le misure arrivano in Home Assistant dal telefono (Apple Salute o Health Connect), dalla bilancia, dall'orologio. Non sono un parere medico.",
        "Readings reach Home Assistant from the phone (Apple Health or Health Connect), the scale, the watch. They are not medical advice.",
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

/* ── la finestra dello storico ─────────────────────────────────────────────
 *
 * «Devi creare un popup al tap sulle card e sui giorni che mi fa vedere i dati
 * anche storici.» Toccando una scheda si apre la sua storia: 7, 30 o 90
 * giorni, media, minimo e massimo (e il totale per quello che si somma), il
 * grafico e i giorni uno per uno. Toccando un giorno — nella finestra o nelle
 * colonne dei passi — si apre quel giorno: tutte le misure, e passi e battito
 * ora per ora. Tutto dalle statistiche di Home Assistant, chieste quando
 * servono.
 */

const PERIODI = [7, 30, 90];
const ORA = 3_600_000;

/* Le misure di ogni scheda: la prima ha il grafico grande. */
const GRUPPI = {
  passi: ["passi", "distanza", "piani"],
  battito: ["battito", "battitoRiposo"],
  pressione: ["sistolica", "diastolica"],
  peso: ["peso", "grasso"],
  sonno: ["sonno"],
  ossigeno: ["ossigeno"],
  calorie: ["calorie", "calorieRiposo"],
  attivita: ["calorie", "esercizio", "inPiedi", "calorieRiposo"],
  distanza: ["distanza"],
  piani: ["piani"],
};

const nomeDellaMisura = (chiave) =>
  ({
    sistolica: t("Massima", "Systolic"),
    diastolica: t("Minima", "Diastolic"),
    calorieRiposo: t("Calorie a riposo", "Resting calories"),
    battitoRiposo: t("Battito a riposo", "Resting heart rate"),
  })[chiave] ||
  NOMI()[chiave] ||
  chiave;

const segnoDellaScheda = (chiave) => SEGNI[chiave] || (chiave === "pressione" ? SEGNI.pressione : "•");

/* Il valore detto come lo dice la scheda. */
function valoreDetto(chiave, valore, unita = "") {
  if (!Number.isFinite(valore)) return "—";
  if (chiave === "sonno") return durataSonno(valore);
  const cifre = chiave === "distanza" ? 2 : chiave === "peso" || chiave === "grasso" ? 1 : 0;
  const u = chiave === "grasso" ? "%" : chiave === "passi" ? t("passi", "steps") : chiave === "piani" ? "" : unita;
  return `${numeroBello(valore, cifre)}${u ? ` ${u}` : ""}`;
}

/* Tutti i sensori di una misura (lei e quelli dietro), con lo storico. */
const sensoriDi = (misura) => [misura, ...(misura?.altre || [])].filter((m) => m?.statistiche);

/* Le statistiche di [ids] fra [inizio] e [fine], per [periodo]: si chiedono
 * una volta (e di nuovo dopo mezz'ora); `null` finche' non arrivano. */
function statistiche(ids, inizio, fine, periodo) {
  const chiave = `${periodo}|${inizio}|${ids.join(",")}`;
  const voce = (state.dati[chiave] ||= { righe: null, chieste: 0 });
  if (!voce.chiedendo && Date.now() - voce.chieste > OGNI && ids.length) {
    voce.chiedendo = true;
    voce.chieste = Date.now();
    chiediAHomeAssistant(
      {
        type: "recorder/statistics_during_period",
        start_time: new Date(inizio).toISOString(),
        end_time: new Date(fine).toISOString(),
        statistic_ids: ids,
        period: periodo,
        types: ["change", "max", "mean", "min", "state"],
      },
      20_000,
    )
      .then((risposta) => {
        voce.righe = risposta && typeof risposta === "object" ? risposta : {};
      })
      .catch(() => {
        voce.righe = voce.righe || {};
      })
      .finally(() => {
        voce.chiedendo = false;
        dipingiIlDettaglio();
      });
  }
  if (!ids.length) return {};
  return voce.righe;
}

/* I punti di una misura dalle righe chieste, coi sensori dietro uniti come fa
 * la scheda ([giorniDi]). */
function puntiDi(misura, righe) {
  if (!misura || !righe) return [];
  const [principale, ...altri] = sensoriDi(misura);
  if (!principale) return [];
  const suoi = puntiConFascia(righe[principale.entity] || [], principale.classe);
  const degliAltri = altri.map((a) => puntiConFascia(righe[a.entity] || [], a.classe));
  return giorniUniti(suoi, degliAltri, misura.classe);
}

const mezzanotte = (ms) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const giornoDetto = (ms, lungo = false) =>
  new Date(ms).toLocaleDateString(
    locale(),
    lungo ? { weekday: "long", day: "numeric", month: "long" } : { weekday: "short", day: "numeric" },
  );

/* Le colonne: [punti] con `valore`, toccabili se [tocca]. */
function colonneMarkup(chiave, punti, { tocca = false, etichetta = (p) => giornoDetto(p.inizio) } = {}) {
  if (!punti.length) return "";
  const massimo = Math.max(...punti.map((p) => p.valore), 1);
  const fitte = punti.length > 16;
  return `<div class="dm-sd-colonne${fitte ? " fitte" : ""}" style="--n:${punti.length}">${punti
    .map((p) => {
      const altezza = Math.max(2, Math.round((p.valore / massimo) * 100));
      const detto = `${etichetta(p)}: ${valoreDetto(chiave, p.valore)}`;
      return `<span class="dm-sd-colonna"${tocca ? ` role="button" tabindex="0" data-dm-salute-giorno="${p.inizio}"` : ""} title="${esc(detto)}" aria-label="${esc(detto)}">
        <span><i style="height:${altezza}%"></i></span>${fitte ? "" : `<small>${esc(etichetta(p))}</small>`}
      </span>`;
    })
    .join("")}</div>`;
}

/* La linea, con la fascia fra minimo e massimo dove c'e'. */
function lineaMarkup(chiave, punti) {
  if (punti.length < 2) return punti.length ? `<p class="dm-sd-vuoto">${esc(t("Un solo valore, per ora.", "Just one value so far."))}</p>` : "";
  const valori = punti.flatMap((p) => [p.valore, p.minimo ?? p.valore, p.massimo ?? p.valore]);
  const basso = Math.min(...valori);
  const alto = Math.max(...valori);
  const campo = Math.max(alto - basso, 1);
  const L = 320;
  const A = 120;
  const x = (i) => 6 + (i / (punti.length - 1)) * (L - 12);
  const y = (v) => A - 10 - ((v - basso) / campo) * (A - 24);
  const linea = punti.map((p, i) => `${x(i).toFixed(1)},${y(p.valore).toFixed(1)}`).join(" ");
  const conFascia = punti.every((p) => Number.isFinite(p.minimo));
  const fascia = conFascia
    ? `<polygon points="${[
        ...punti.map((p, i) => `${x(i).toFixed(1)},${y(p.massimo).toFixed(1)}`),
        ...punti.map((p, i) => `${x(i).toFixed(1)},${y(p.minimo).toFixed(1)}`).reverse(),
      ].join(" ")}" fill="currentColor" opacity=".14"/>`
    : "";
  return `<figure class="dm-sd-linea"><svg viewBox="0 0 ${L} ${A}" preserveAspectRatio="none" role="img" aria-label="${esc(nomeDellaMisura(chiave))}">
    ${fascia}<polyline points="${linea}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
  </svg><figcaption><span>${esc(valoreDetto(chiave, alto))}</span><span>${esc(valoreDetto(chiave, basso))}</span></figcaption></figure>`;
}

const siSomma = (misura) => /^total/.test(clean(misura?.classe));

function graficoMarkup(chiave, misura, punti, tocca) {
  return siSomma(misura) || chiave === "sonno" ? colonneMarkup(chiave, punti, { tocca }) : lineaMarkup(chiave, punti);
}

function riassuntoMarkup(chiave, misura, punti) {
  const r = riassuntoDeiGiorni(punti, misura?.classe);
  if (!r.quanti) return "";
  const u = misura?.unita || "";
  const voci = [
    [t("Media", "Average"), valoreDetto(chiave, r.media, u)],
    [t("Minimo", "Min"), valoreDetto(chiave, r.minimo, u)],
    [t("Massimo", "Max"), valoreDetto(chiave, r.massimo, u)],
  ];
  if (r.totale !== null) voci.push([t("Totale", "Total"), valoreDetto(chiave, r.totale, u)]);
  return `<div class="dm-sd-riassunto">${voci.map(([n, v]) => `<span><small>${esc(n)}</small><b>${esc(v)}</b></span>`).join("")}</div>`;
}

/* La finestra di una scheda. */
function dettaglioDellaSchedaMarkup(persona, quale, periodo) {
  const chiavi = (GRUPPI[quale] || [quale]).filter((c) => persona.misure[c]);
  if (!chiavi.length) return "";
  const fine = Date.now();
  const inizio = mezzanotte(fine) - (periodo - 1) * GIORNO;
  const ids = chiavi.flatMap((c) => sensoriDi(persona.misure[c]).map((s) => s.entity));
  const righe = statistiche(ids, inizio, fine, "day");
  const periodi = `<div class="dm-sd-periodi" role="tablist">${PERIODI.map(
    (n) =>
      `<button type="button" role="tab" aria-selected="${n === periodo}" data-dm-salute-periodo="${n}">${esc(t(`${n} giorni`, `${n} days`))}</button>`,
  ).join("")}</div>`;
  if (!ids.length)
    return `${periodi}<p class="dm-sd-vuoto">${esc(t("Questo sensore non tiene lo storico in Home Assistant.", "This sensor keeps no history in Home Assistant."))}</p>`;
  if (!righe) return `${periodi}<p class="dm-sd-vuoto">${esc(t("Carico lo storico…", "Loading the history…"))}</p>`;
  /* Oggi si legge dal sensore: le statistiche arrivano all'ora piena. */
  const puntiDiOggi = (misura) => {
    const punti = puntiDi(misura, righe);
    if (siSomma(misura) && punti.at(-1)?.inizio === mezzanotte(fine) && Number.isFinite(misura.valore))
      punti.at(-1).valore = misura.valore;
    return punti;
  };
  const blocchi = chiavi.map((c, i) => {
    const misura = persona.misure[c];
    const punti = puntiDiOggi(misura);
    if (!punti.length)
      return i
        ? ""
        : `<p class="dm-sd-vuoto">${esc(t("Ancora niente storico: arriva un giorno alla volta.", "No history yet: it builds up one day at a time."))}</p>`;
    return `<section class="dm-sd-blocco${i ? " piccolo" : ""}">
      ${i ? `<h4>${esc(nomeDellaMisura(c))}</h4>` : ""}
      ${riassuntoMarkup(c, misura, punti)}
      ${graficoMarkup(c, misura, punti, i === 0)}
    </section>`;
  });
  const principale = persona.misure[chiavi[0]];
  const punti = puntiDiOggi(principale);
  const elenco = punti
    .slice()
    .reverse()
    .map(
      (p) =>
        `<button type="button" class="dm-sd-riga" data-dm-salute-giorno="${p.inizio}"><span>${esc(giornoDetto(p.inizio, true))}</span><b>${esc(
          valoreDetto(chiavi[0], p.valore, principale.unita),
        )}</b></button>`,
    )
    .join("");
  return `${periodi}${blocchi.join("")}${elenco ? `<div class="dm-sd-elenco">${elenco}</div>` : ""}`;
}

/* La finestra di un giorno: tutte le misure di quel giorno, e passi e battito
 * ora per ora. */
function dettaglioDelGiornoMarkup(persona, giorno) {
  const m = persona.misure;
  const chiavi = Object.keys(m).filter((c) => sensoriDi(m[c]).length);
  const fine = Math.min(giorno + GIORNO, Date.now());
  const ids = chiavi.flatMap((c) => sensoriDi(m[c]).map((s) => s.entity));
  const delGiorno = statistiche(ids, giorno, giorno + GIORNO, "day");
  const orarie = ["passi", "battito"].filter((c) => m[c] && sensoriDi(m[c]).length);
  const perOra = statistiche(orarie.flatMap((c) => sensoriDi(m[c]).map((s) => s.entity)), giorno, fine, "hour");
  if (!ids.length) return `<p class="dm-sd-vuoto">${esc(t("Questi sensori non tengono lo storico in Home Assistant.", "These sensors keep no history in Home Assistant."))}</p>`;
  if (!delGiorno) return `<p class="dm-sd-vuoto">${esc(t("Carico il giorno…", "Loading the day…"))}</p>`;
  const oggi = giorno === mezzanotte(Date.now());
  const caselle = chiavi
    .map((c) => {
      const punto = puntiDi(m[c], delGiorno).find((p) => p.inizio === giorno);
      const valore = oggi && siSomma(m[c]) && Number.isFinite(m[c].valore) ? m[c].valore : punto?.valore;
      if (!Number.isFinite(valore)) return "";
      const fascia = punto && Number.isFinite(punto.minimo) ? `${valoreDetto(c, punto.minimo)} – ${valoreDetto(c, punto.massimo)}` : "";
      return `<span class="dm-sd-casella"><small>${esc(nomeDellaMisura(c))}</small><b>${esc(valoreDetto(c, valore, m[c].unita))}</b>${
        fascia ? `<em>${esc(fascia)}</em>` : ""
      }</span>`;
    })
    .filter(Boolean)
    .join("");
  const ore = orarie
    .map((c) => {
      if (!perOra) return `<p class="dm-sd-vuoto">${esc(t("Carico le ore…", "Loading the hours…"))}</p>`;
      const punti = puntiDi(m[c], perOra);
      if (!punti.length) return "";
      const etichetta = (p) => new Date(p.inizio).toLocaleTimeString(locale(), { hour: "2-digit" });
      return `<section class="dm-sd-blocco piccolo"><h4>${esc(`${nomeDellaMisura(c)} · ${t("ora per ora", "hour by hour")}`)}</h4>${
        siSomma(m[c]) ? colonneMarkup(c, punti, { etichetta }) : lineaMarkup(c, punti)
      }</section>`;
    })
    .join("");
  return `${caselle ? `<div class="dm-sd-caselle">${caselle}</div>` : `<p class="dm-sd-vuoto">${esc(t("Nessuna misura in questo giorno.", "No readings on this day."))}</p>`}${ore}`;
}

function dettaglioMarkup(vista) {
  const d = state.dettaglio;
  const persona = d && personaScelta(vista);
  if (!persona) return "";
  const giorno = Number.isFinite(d.giorno);
  const titolo = giorno
    ? giornoDetto(d.giorno, true)
    : `${segnoDellaScheda(d.misura)} ${d.misura === "passi" ? NOMI().passi : NOMI()[d.misura] || nomeDellaMisura(d.misura)}`;
  const corpo = giorno ? dettaglioDelGiornoMarkup(persona, d.giorno) : dettaglioDellaSchedaMarkup(persona, d.misura, d.periodo);
  const indietro = giorno && d.da ? `<button type="button" class="dm-sd-indietro" data-dm-salute-indietro aria-label="${esc(t("Indietro", "Back"))}">‹</button>` : "";
  return `<div class="dm-sd-velo" data-dm-salute-chiudi></div>
    <div class="dm-sd-foglio" role="dialog" aria-modal="true" aria-label="${esc(titolo)}">
      <header>${indietro}<div><small>${esc(persona.nome)}</small><b>${esc(titolo)}</b></div>
        <button type="button" class="dm-sd-chiudi" data-dm-salute-chiudi aria-label="${esc(t("Chiudi", "Close"))}">✕</button></header>
      <div class="dm-sd-dentro">${corpo}</div>
    </div>`;
}

/* La finestra sta nel corpo della pagina, non dentro la sezione: una pagina
 * che scorre o si sposta portava con se' anche lei, e restava a meta' schermo. */
const DETTAGLIO_ID = "dm-salute-dettaglio";

function dipingiIlDettaglio() {
  const pagina = doc?.body;
  if (!pagina) return;
  let finestra = doc.getElementById(DETTAGLIO_ID);
  if (!state.dettaglio) {
    finestra?.remove();
    return;
  }
  const vista = vistaSalute();
  const markup = vista ? dettaglioMarkup(vista) : "";
  if (!markup) {
    state.dettaglio = null;
    finestra?.remove();
    return;
  }
  if (!finestra) {
    finestra = doc.createElement("div");
    finestra.className = "dm-sd";
    finestra.id = DETTAGLIO_ID;
    pagina.append(finestra);
  }
  const dentro = finestra.querySelector(".dm-sd-dentro");
  const giu = dentro ? dentro.scrollTop : 0;
  scriviSeCambia(finestra, markup);
  const nuovo = finestra.querySelector(".dm-sd-dentro");
  if (nuovo && giu) nuovo.scrollTop = giu;
}

function apriIlDettaglio(cosa) {
  state.dettaglio = cosa;
  if (root.navigator?.vibrate) root.navigator.vibrate(5);
  dipingiIlDettaglio();
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
  if (!dove || !paginaVisibile(SALUTE_PAGE_ID)) {
    if (state.dettaglio) apriIlDettaglio(null);
    return;
  }
  if (vistaScelta(vista) === "strava") {
    const sport = sportScelto(vista.strava, state.sport);
    if (vista.strava.statistiche.sport[sport]) void chiediLeSettimaneStrava(vista.strava, sport, state.settimane, schedule);
  } else {
    const persona = personaScelta(vista);
    for (const m of [persona?.misure.passi, ...(persona?.misure.passi?.altre || [])])
      void chiediLoStorico(m, 7, ["change", "max", "state"]);
    for (const m of [persona?.misure.peso, ...(persona?.misure.peso?.altre || [])])
      void chiediLoStorico(m, 30, ["mean", "max", "state"]);
  }
  scriviSeCambia(dove, paginaSaluteMarkup(vista));
  ravvivaIRitratti(dove);
  if (state.dettaglio) dipingiIlDettaglio();
}

/* I ritratti costruiti sono tele: si compongono dopo che il markup e' a
 * schermo, e solo dove la tela non c'e' ancora. Una foto che non si carica
 * (un file rinominato) si toglie, e sotto resta l'avatar. */
function ravvivaIRitratti(dove) {
  const tele = [...(dove.querySelectorAll?.(".dm-salute-avatar[data-ritratto]") || [])];
  if (tele.length) {
    const gente = normalizePeople(readJson("cd_people", []));
    for (const host of tele) {
      if (host.querySelector("canvas")) continue;
      const faccia = gente.find((p) => p.id === host.dataset.ritratto)?.avatar?.face;
      if (faccia) void ritrattoVivo(host, faccia, "sveglio");
    }
  }
  for (const foto of dove.querySelectorAll?.("img[data-dm-salute-foto]") || []) {
    if (foto.dataset.dmAscolta) continue;
    foto.dataset.dmAscolta = "1";
    foto.addEventListener("error", () => foto.remove(), { once: true });
  }
  fermaRitrattiPersi();
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
  const dentro = evento.target?.closest?.(`#${SALUTE_PAGE_ID},#${DETTAGLIO_ID}`);
  if (dentro) {
    const chiudi = evento.target.closest("[data-dm-salute-chiudi]");
    const indietro = evento.target.closest("[data-dm-salute-indietro]");
    const periodo = evento.target.closest("[data-dm-salute-periodo]");
    const giorno = evento.target.closest("[data-dm-salute-giorno]");
    const misura = evento.target.closest("[data-dm-salute-misura]");
    if (chiudi) return apriIlDettaglio(null);
    if (indietro && state.dettaglio?.da) return apriIlDettaglio(state.dettaglio.da);
    if (periodo && state.dettaglio) return apriIlDettaglio({ ...state.dettaglio, periodo: Number(periodo.dataset.dmSalutePeriodo) || 30 });
    if (giorno) {
      const da = state.dettaglio && !Number.isFinite(state.dettaglio.giorno) ? state.dettaglio : null;
      return apriIlDettaglio({ giorno: Number(giorno.dataset.dmSaluteGiorno), da });
    }
    if (misura && !evento.target.closest(".dm-sd"))
      return apriIlDettaglio({ misura: clean(misura.dataset.dmSaluteMisura), periodo: 30 });
  }
  const vista = evento.target?.closest?.("[data-dm-salute-vista]");
  const chi = evento.target?.closest?.("[data-dm-salute-chi]");
  const sport = evento.target?.closest?.(`#${SALUTE_PAGE_ID} [data-dm-strava-sport]`);
  if (vista) state.vista = clean(vista.dataset.dmSaluteVista);
  else if (chi) {
    state.chi = clean(chi.dataset.dmSaluteChi);
    state.dettaglio = null;
  }
  else if (sport) state.sport = clean(sport.dataset.dmStravaSport);
  else return;
  schedule();
}

/* Il sottotitolo della pagina dice cosa c'e', non di chi: il nome sta nel
 * corpo, col ritratto ([chiMarkup]). Sotto «Salute», in maiuscoletto,
 * «Giovanni» sembrava il nome della sezione. */
function titoloDellaPagina() {
  const vista = vistaSalute();
  if (!vista) return null;
  const NOMI_ORA = NOMI();
  const ordine = ["passi", "battito", "sistolica", "peso", "sonno", "calorie"];
  const cosa = new Set();
  for (const p of vista.persone) for (const chiave of ordine) if (p.misure[chiave]) cosa.add(chiave);
  const parti = ordine.filter((chiave) => cosa.has(chiave)).map((chiave) => NOMI_ORA[chiave]);
  if (vista.strava) parti.push("Strava");
  /* Una voce sola non e' un sottotitolo: resta quello di serie. */
  return parti.length > 1 ? { subtitle: parti.join(" · ") } : null;
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
  ${P} .dm-salute-persone button{display:inline-flex;align-items:center;gap:8px;font-size:13px;padding:5px 13px 5px 5px}
  ${P} .dm-salute-chi{display:flex;align-items:center;gap:12px;min-width:0}
  ${P} .dm-salute-chi > b{font-size:21px;font-weight:900;letter-spacing:-.01em;color:var(--text,#0f172a);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  ${P} .dm-salute-ritratto{position:relative;flex:0 0 auto;width:54px;height:54px;border-radius:50%;overflow:hidden;
    box-shadow:0 0 0 2px var(--card-background-color,#fff),0 0 0 4px color-mix(in srgb,var(--sal) 55%,transparent)}
  ${P} .dm-salute-persone .dm-salute-ritratto{width:30px;height:30px;box-shadow:none}
  ${P} .dm-salute-avatar{position:absolute;inset:0;display:grid;place-items:center;font-size:28px;line-height:1;border-radius:50%;
    color:var(--dm-person-color,${ROSSO});
    background:radial-gradient(circle at 32% 26%,color-mix(in srgb,var(--dm-person-color,${ROSSO}) 10%,var(--card-background-color,#fff)),color-mix(in srgb,var(--dm-person-color,${ROSSO}) 30%,var(--card-background-color,#fff)))}
  ${P} .dm-salute-avatar b{font-size:19px;font-weight:900;letter-spacing:.5px}
  ${P} .dm-salute-persone .dm-salute-avatar{font-size:16px}
  ${P} .dm-salute-persone .dm-salute-avatar b{font-size:11px}
  ${P} .dm-salute-ritratto img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:50%}
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
  ${P} .dm-salute-eroe-strada{display:flex;flex-wrap:wrap;gap:6px 12px;margin-top:4px;font-size:13.5px;font-weight:800}
  ${P} .dm-salute-eroe-strada span{padding:3px 9px;border-radius:999px;background:rgba(255,255,255,.18);white-space:nowrap}
  ${P} .dm-salute-anelli{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;margin:6px 0 2px}
  ${P} .dm-salute-anello-voce{display:grid;gap:1px;padding-left:10px;border-left:3px solid var(--anello);min-width:0}
  ${P} .dm-salute-anello-voce + .dm-salute-anello-voce{margin-left:6px}
  ${P} .dm-salute-anello-voce span{font-size:12.5px;font-weight:850;color:var(--anello);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  ${P} .dm-salute-anello-voce b{font-size:24px;font-weight:900;color:var(--text,#0f172a);line-height:1.15;white-space:nowrap}
  ${P} .dm-salute-anello-voce b small{font-size:13px;font-weight:800;color:var(--text-dim,#64748b)}
  ${P} .dm-salute-fonte{margin:0;font-size:11.5px;font-weight:700;color:var(--text-dim,#64748b);text-align:center}
  ${P} .dm-salute-finestra .dm-strava{gap:10px}
  ${P} [data-dm-salute-misura][role="button"],${P} [data-dm-salute-giorno]{cursor:pointer;-webkit-tap-highlight-color:transparent}
  ${P} .dm-salute-scheda[role="button"]{transition:transform .12s ease,box-shadow .12s ease}
  ${P} .dm-salute-scheda[role="button"]:active{transform:scale(.98)}
  @media (max-width:640px){
    ${P} .dm-salute-schede{grid-template-columns:repeat(2,minmax(0,1fr))}
    ${P} .dm-salute-scheda.larga{grid-column:1 / -1}
    ${P} .dm-salute-eroe-num{font-size:38px}
    ${P} .dm-salute-eroe-anello{width:84px;height:84px}
    ${P} .dm-salute-anello-voce b{font-size:20px}
  }
  `;
}


/* Il foglio della finestra dello storico, che sta nel corpo della pagina. */
export function foglioDettaglio(P = `#${DETTAGLIO_ID}`) {
  return `
  ${P}.dm-sd{--sal:${ROSSO};position:fixed;inset:0;z-index:2147483000;display:flex;align-items:flex-end;justify-content:center}
  ${P} .dm-sd-velo{position:absolute;inset:0;background:rgba(15,23,42,.45);backdrop-filter:blur(2px)}
  ${P} .dm-sd-foglio{position:relative;display:flex;flex-direction:column;width:min(560px,100%);max-height:88vh;
    border-radius:24px 24px 0 0;background:var(--card-background-color,#fff);color:var(--text,#0f172a);
    box-shadow:0 -20px 50px -20px rgba(15,23,42,.45);padding-bottom:env(safe-area-inset-bottom,0)}
  @media (min-width:700px){${P}.dm-sd{--sal:${ROSSO};align-items:center}${P} .dm-sd-foglio{border-radius:24px}}
  ${P} .dm-sd-foglio header{display:flex;align-items:center;gap:10px;padding:16px 16px 10px;border-bottom:1px solid var(--card-border,#e2e8f0)}
  ${P} .dm-sd-foglio header div{display:grid;flex:1;min-width:0}
  ${P} .dm-sd-foglio header small{font-size:12px;font-weight:800;color:var(--text-dim,#64748b);text-transform:uppercase;letter-spacing:.06em}
  ${P} .dm-sd-foglio header b{font-size:20px;font-weight:900;text-transform:capitalize;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  ${P} .dm-sd-chiudi,${P} .dm-sd-indietro{flex:0 0 auto;width:36px;height:36px;border-radius:50%;border:0;font:inherit;font-size:18px;font-weight:900;
    cursor:pointer;color:var(--text,#0f172a);background:color-mix(in srgb,var(--text,#0f172a) 8%,transparent)}
  ${P} .dm-sd-indietro{font-size:26px;line-height:1}
  ${P} .dm-sd-dentro{display:grid;gap:14px;padding:14px 16px 20px;overflow:auto;-webkit-overflow-scrolling:touch}
  ${P} .dm-sd-periodi{display:flex;gap:6px}
  ${P} .dm-sd-periodi button{flex:1;padding:8px 10px;border-radius:999px;font:inherit;font-size:13px;font-weight:800;cursor:pointer;
    color:var(--text,#0f172a);background:transparent;border:1px solid var(--card-border,#e2e8f0)}
  ${P} .dm-sd-periodi button[aria-selected="true"]{color:#fff;background:var(--sal);border-color:var(--sal)}
  ${P} .dm-sd-blocco{display:grid;gap:10px}
  ${P} .dm-sd-blocco h4{margin:4px 0 0;font-size:12px;font-weight:850;text-transform:uppercase;letter-spacing:.05em;color:var(--text-dim,#64748b)}
  ${P} .dm-sd-riassunto{display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:8px}
  ${P} .dm-sd-riassunto span,${P} .dm-sd-casella{display:grid;gap:2px;padding:10px 12px;border-radius:14px;
    background:color-mix(in srgb,var(--sal) 7%,var(--card-background-color,#fff));border:1px solid color-mix(in srgb,var(--sal) 14%,transparent)}
  ${P} .dm-sd-riassunto small,${P} .dm-sd-casella small{font-size:11px;font-weight:800;color:var(--text-dim,#64748b);text-transform:uppercase;letter-spacing:.04em}
  ${P} .dm-sd-riassunto b,${P} .dm-sd-casella b{font-size:18px;font-weight:900;white-space:nowrap}
  ${P} .dm-sd-casella em{font-style:normal;font-size:12px;font-weight:700;color:var(--text-dim,#64748b)}
  ${P} .dm-sd-caselle{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px}
  ${P} .dm-sd-colonne{display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr));gap:4px;align-items:end;color:var(--sal)}
  ${P} .dm-sd-colonne.fitte{gap:2px}
  ${P} .dm-sd-colonna{display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0}
  ${P} .dm-sd-colonna > span{position:relative;display:block;width:100%;height:120px}
  ${P} .dm-sd-colonna i{position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:100%;max-width:28px;border-radius:4px 4px 0 0;
    background:currentColor;opacity:.8}
  ${P} .dm-sd-colonna[role="button"]:hover i,${P} .dm-sd-colonna[role="button"]:active i{opacity:1}
  ${P} .dm-sd-colonna small{font-size:10.5px;font-weight:800;color:var(--text-dim,#64748b);text-transform:capitalize;white-space:nowrap;overflow:hidden;max-width:100%}
  ${P} .dm-sd-linea{margin:0;color:var(--sal)}
  ${P} .dm-sd-linea svg{display:block;width:100%;height:120px}
  ${P} .dm-sd-linea figcaption{display:flex;justify-content:space-between;font-size:11.5px;font-weight:700;color:var(--text-dim,#64748b)}
  ${P} .dm-sd-elenco{display:grid;border-top:1px solid var(--card-border,#e2e8f0)}
  ${P} .dm-sd-riga{display:flex;justify-content:space-between;gap:10px;padding:11px 2px;border:0;border-bottom:1px solid var(--card-border,#e2e8f0);
    background:transparent;font:inherit;font-size:14px;color:var(--text,#0f172a);cursor:pointer;text-align:left}
  ${P} .dm-sd-riga span{text-transform:capitalize;font-weight:700}
  ${P} .dm-sd-riga b{font-weight:900;white-space:nowrap}
  ${P} .dm-sd-vuoto{margin:0;padding:16px 4px;font-size:14px;font-weight:700;color:var(--text-dim,#64748b);text-align:center}
  `;
}

/* ── l'installazione ───────────────────────────────────────────────────── */

export function installSalute() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyle("dm-salute-style", foglioSalute(`#${SALUTE_PAGE_ID}`));
  installStyle("dm-salute-dettaglio-style", foglioDettaglio());
  installAvatar3dStyle();
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
