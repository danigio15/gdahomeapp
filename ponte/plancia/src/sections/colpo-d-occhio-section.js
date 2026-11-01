/* «Colpo d'occhio»: la plancia di una pagina sola (vedi `core/colpo-d-occhio.js`).
 *
 * «Una pagina unica, senza sezioni, ma con popup diretti per vedere i dati.»
 * Quando il config della plancia lo accende (`cd_occhio.attiva`), una tela
 * copre la plancia classica come fa il pannello a muro: in cima il nome della
 * casa, se e' collegata e l'ora; il meteo, che apre le previsioni dei sette
 * giorni e da li' quelle di ogni ora; poi i riquadri grandi.
 *
 *   · Fotovoltaico: il flusso dell'energia — sole, casa, rete, batteria —
 *     adesso, oggi e questo mese, con le linee che si muovono dove passa.
 *   · Telecamere: la griglia delle istantanee; toccata una, il video dal vivo
 *     col motore della plancia (WebRTC, HLS, MJPEG, istantanee), l'audio e lo
 *     schermo intero.
 *   · Antifurto: i tasti grandi dei modi, accesi quando sono inseriti; con una
 *     centrale vera i suoi inserimenti, col tastierino della plancia.
 *   · Cancello (e ogni cosa che si apre): un tocco, la vibrazione e la scritta
 *     che dice che e' partito.
 *
 * Niente nomi e niente entita' scritte qui: viene tutto dal config. E niente
 * chiavi nella pagina: i comandi passano dalla presa di chi e' entrato.
 */
import {
  CHIAVE_OCCHIO,
  flussoDellEnergia,
  modoInserito,
  occhioPulito,
  periodiDellEnergia,
  servizioDelModo,
  servizioPerAprire,
} from "../core/colpo-d-occhio.js";
import { alarmActiveMode, alarmCodeNeeded, alarmModes } from "../core/alarm-panel.js";
import { disegnoDelCatalogo } from "../core/catalogo-disegni.js";
import {
  giorniCheVengono,
  oggiFraMassimaEMinima,
  segnoDelTempo,
} from "../core/la-card-del-meteo.js";
import { istantaneaInViaggio, loadCameraFrame, sorvegliaIFlussi } from "./live-ui-section.js";
import { chiediLeCapacita } from "./telecamera-capacita-section.js";
import { apriIlMenu, premiumDellaCasa, premiumRicordato } from "./plancia-a-muro-section.js";
import { fermaIVideo } from "./telecamera-webrtc-section.js";
import { CHIAVE_RISERVATE, telecamereVisibili } from "../core/telecamere-riservate.js";
import { normalizePeople } from "../core/person-model.js";
import { parolaDellaCondizione, previsioniDelMeteo } from "./meteo-section.js";
import { puoConfigurare } from "./la-config-e-di-chi-la-amministra-section.js";
import {
  allStates,
  chiamaServizio,
  clean,
  doc,
  esc,
  installStyle,
  lexicalGlobal,
  locale,
  readJson,
  root,
  scriviSeCambia,
  senzaCadere,
  t,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_COLPO_D_OCCHIO__";
const ID = "dm-occhio";
const state = (root[KEY] ||= {
  installed: false,
  frame: 0,
  cameraUrls: new Map(),
  premium: null,
  chiedendo: false,
  timer: 0,
  finestra: null,
  periodo: "adesso",
  avviso: null,
});

/** Il config di adesso. */
export function occhioDiQui() {
  return occhioPulito(readJson(CHIAVE_OCCHIO, null));
}

/* Il config da disegnare adesso: le telecamere riservate, quando in casa c'e'
 * qualcuno (o non si sa), non ci sono — la stessa regola della plancia
 * principale, che qui vale per la griglia, per il video e per il conto. */
function occhioDaMostrare(states) {
  const occhio = occhioDiQui();
  return {
    ...occhio,
    telecamere: telecamereVisibili(occhio.telecamere, {
      config: readJson(CHIAVE_RISERVATE, {}),
      persone: normalizePeople(readJson("cd_people", [])),
      states,
    }),
  };
}

/* ── le parole ────────────────────────────────────────────────────────── */

const lingua = () => locale() || "it";
const numero = (v, cifre = 0) =>
  Number(v).toLocaleString(lingua(), {
    maximumFractionDigits: cifre,
    minimumFractionDigits: cifre,
  });

function ora(iso, opzioni) {
  try {
    return new Date(iso).toLocaleString(lingua(), opzioni);
  } catch (_errore) {
    return "";
  }
}

const iniziale = (s) => s.charAt(0).toLocaleUpperCase(lingua()) + s.slice(1);

/* ── i pezzi ──────────────────────────────────────────────────────────── */

function segno(nome, misura = 30) {
  return disegnoDelCatalogo(nome, misura) || "";
}

function meteoDiQui(occhio, states) {
  const id = occhio.meteo || Object.keys(states || {}).find((e) => e.startsWith("weather.")) || "";
  return id ? { id, stato: states[id] } : null;
}

function testataMarkup(occhio, admin) {
  const nome = occhio.titolo || clean(root.__HASS__?.config?.location_name) || t("Casa", "Home");
  const adesso = new Date();
  const collegata = Object.keys(allStates() || {}).length > 0;
  return `<div class="oc-testa">
      <button type="button" class="oc-menu" data-oc="menu" aria-label="${esc(t("Apri il menu", "Open menu"))}"><span></span><span></span><span></span></button>
      <span class="oc-testa-ic" aria-hidden="true">${segno("home", 32)}</span>
      <div class="oc-testa-testo">
        <h1>${esc(nome)}</h1>
        <p>${esc(occhio.sottotitolo || t("Casa a colpo d'occhio", "Home at a glance"))}</p>
      </div>
      <div class="oc-testa-stato">
        <span class="oc-pill" data-su="${collegata}"><i aria-hidden="true"></i>${esc(
          collegata ? t("Connesso", "Connected") : t("Offline", "Offline"),
        )}</span>
        <span class="oc-ora">${esc(
          adesso.toLocaleTimeString(lingua(), { hour: "2-digit", minute: "2-digit" }),
        )}</span>
      </div>
      ${
        admin
          ? `<button type="button" class="oc-config" data-oc="config" aria-label="${esc(
              t("Config", "Config"),
            )}">${segno("tools", 22) || "⚙"}</button>`
          : ""
      }
    </div>`;
}

/* Il meteo come la card della plancia principale: il segno grosso, i gradi,
 * la condizione e la massima e la minima di oggi; le misure in pastiglie
 * larghe uguali (umidita', vento, pressione, tramonto); sotto un filo, i
 * quattro giorni che vengono. Le previsioni sono quelle del popup: una
 * domanda sola per tutti e due. */
function meteoMarkup(occhio, states) {
  const m = meteoDiQui(occhio, states);
  if (!m?.stato) return "";
  const a = m.stato.attributes || {};
  const p = previsioniDelMeteo(m.id, () => ridisegna());
  const gradi = (v) =>
    v == null || v === "" || !Number.isFinite(Number(v)) ? "" : `${numero(v)}°`;
  const oggi = oggiFraMassimaEMinima(p.giornaliere);
  const misure = [];
  const misura = (v) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
  if (misura(a.humidity) !== null)
    misure.push(["💧", t("Umidità", "Humidity"), `${numero(a.humidity)}%`]);
  if (misura(a.wind_speed) !== null)
    misure.push([
      "💨",
      t("Vento", "Wind"),
      `${numero(a.wind_speed)} ${clean(a.wind_speed_unit) || "km/h"}`,
    ]);
  if (misura(a.pressure) !== null)
    misure.push([
      "🧭",
      t("Pressione", "Pressure"),
      `${numero(a.pressure)} ${clean(a.pressure_unit) || "hPa"}`,
    ]);
  const tramonto = Date.parse(clean(states["sun.sun"]?.attributes?.next_setting));
  if (Number.isFinite(tramonto))
    misure.push([
      "🌅",
      t("Tramonto", "Sunset"),
      ora(tramonto, { hour: "2-digit", minute: "2-digit" }),
    ]);
  const giorni = giorniCheVengono(p.giornaliere, 4);
  return `<button type="button" class="oc-meteo" data-oc="meteo">
      <span class="oc-meteo-capo">
        <span class="oc-meteo-segno" aria-hidden="true">${segnoDelTempo(m.stato.state)}</span>
        <span class="oc-meteo-gradi">
          <b>${esc(gradi(a.temperature) || "—")}</b>
          <small>${esc(parolaDellaCondizione(m.stato.state) || m.stato.state)}</small>
          ${
            oggi
              ? `<em>${esc(t("Oggi", "Today"))} <b>${esc(gradi(oggi.alta))}</b>${
                  gradi(oggi.bassa) ? ` / ${esc(gradi(oggi.bassa))}` : ""
                }</em>`
              : ""
          }
        </span>
      </span>
      ${
        misure.length
          ? `<span class="oc-meteo-misure">${misure
              .map(
                ([segno, parola, valore]) =>
                  `<span>${segno} <i>${esc(parola)}</i> <b>${esc(valore)}</b></span>`,
              )
              .join("")}</span>`
          : ""
      }
      ${
        giorni.length
          ? `<span class="oc-meteo-giorni">${giorni
              .map(
                (g) => `<span class="oc-meteo-giorno">
                  <i>${esc(ora(g.quando, { weekday: "short" }).replace(/\./g, ""))}</i>
                  <span aria-hidden="true">${segnoDelTempo(g.condizione)}</span>
                  <b>${esc(gradi(g.alta))} <i>${esc(gradi(g.bassa))}</i></b>
                </span>`,
              )
              .join("")}</span>`
          : ""
      }
    </button>`;
}

/* La riga piccola sotto il nome di un riquadro: lo stato in due parole. */
function sottoDelRiquadro(r, occhio, states) {
  if (r.tipo === "energia") {
    const f = flussoDellEnergia(occhio, states, "adesso");
    if (f.nodi.solare == null) return t("Flusso energia", "Energy flow");
    if (f.nodi.solare < 30) return t("Sole spento", "No sun");
    return potenzaInParole(f.nodi.solare);
  }
  if (r.tipo === "telecamere") {
    const n = occhio.telecamere.length;
    return n
      ? t(`${n} telecamere · dal vivo`, `${n} cameras · live`)
      : t("Da scegliere", "To set up");
  }
  if (r.tipo === "antifurto") {
    const a = occhio.antifurto;
    if (a.modi.length) {
      const accesi = a.modi.filter((m) => modoInserito(m, states, a.modi));
      if (!accesi.length) return t("Disinserito", "Disarmed");
      if (accesi.length === 1) return accesi[0].nome || t("Inserito", "Armed");
      return t(`${accesi.length} modalità`, `${accesi.length} modes`);
    }
    if (a.centrale) {
      const s = clean(states?.[a.centrale]?.state);
      return s === "disarmed"
        ? t("Disinserito", "Disarmed")
        : s.startsWith("armed")
          ? t("Inserito", "Armed")
          : s === "triggered"
            ? t("Allarme!", "Alarm!")
            : "—";
    }
    return t("Da scegliere", "To set up");
  }
  if (r.tipo === "apri") {
    if (!r.entita) return t("Da scegliere", "To set up");
    return clean(states?.[r.entita]?.state) === "on"
      ? t("In funzione", "Running")
      : t("Tocca per aprire", "Tap to open");
  }
  return "";
}

function nomeDelRiquadro(r) {
  if (r.nome) return r.nome;
  return {
    energia: t("Fotovoltaico", "Solar"),
    telecamere: t("Telecamere", "Cameras"),
    antifurto: t("Antifurto", "Alarm"),
    apri: t("Cancello", "Gate"),
  }[r.tipo];
}

/* Se il riquadro ha qualcosa da dire che chiede attenzione: l'antifurto
 * inserito si accende del suo colore. */
function riquadroAcceso(r, occhio, states) {
  if (r.tipo !== "antifurto") return false;
  const a = occhio.antifurto;
  if (a.modi.some((m) => modoInserito(m, states, a.modi))) return true;
  return clean(states?.[a.centrale]?.state).startsWith("armed");
}

function riquadriMarkup(occhio, states) {
  if (!occhio.riquadri.length)
    return `<p class="oc-vuoto">${esc(
      t("Nessun riquadro: aggiungili dal Config.", "No tiles: add them from the Config."),
    )}</p>`;
  return `<h2 class="oc-titolo">${esc(t("Azioni rapide", "Quick actions"))}</h2>
    <div class="oc-riquadri">${occhio.riquadri
      .map(
        (
          r,
        ) => `<button type="button" class="oc-riquadro" data-oc="riquadro" data-oc-id="${esc(r.id)}"
          data-tipo="${esc(r.tipo)}" data-acceso="${riquadroAcceso(r, occhio, states)}" style="--oc:${esc(r.colore)}">
          <span class="oc-riquadro-ic" aria-hidden="true">${segno(r.disegno, 34)}</span>
          <strong>${esc(nomeDelRiquadro(r))}</strong>
          <small>${esc(sottoDelRiquadro(r, occhio, states))}</small>
        </button>`,
      )
      .join("")}</div>`;
}

/* ── le finestre ──────────────────────────────────────────────────────── */

function finestraMarkup(titolo, corpo, { larga = false } = {}) {
  return `<div class="oc-velo" data-oc="velo">
      <section class="oc-finestra${larga ? " oc-larga" : ""}" role="dialog" aria-modal="true">
        <div class="oc-finestra-testa">
          <h3>${titolo}</h3>
          <button type="button" class="oc-chiudi" data-oc="chiudi" aria-label="${esc(t("Chiudi", "Close"))}">✕</button>
        </div>
        <div class="oc-finestra-corpo">${corpo}</div>
      </section>
    </div>`;
}

/* Il meteo: i sette giorni, e un giorno toccato apre le sue ore. */
function meteoFinestra(occhio, states) {
  const m = meteoDiQui(occhio, states);
  if (!m) return "";
  const p = previsioniDelMeteo(m.id, () => ridisegna());
  const giorno = state.finestra?.giorno || "";
  if (giorno) {
    /* Oggi da adesso in poi: le ore gia' passate non sono previsioni. */
    const daOra = Date.now() - 3600_000;
    const ore = p.orarie.filter(
      (o) => clean(o.datetime).slice(0, 10) === giorno && Date.parse(o.datetime) >= daOra,
    );
    const titolo = `⏰ ${esc(iniziale(ora(`${giorno}T12:00:00`, { weekday: "long", day: "numeric", month: "long" })))}`;
    const corpo = ore.length
      ? `<ul class="oc-ore">${ore
          .map(
            (o) =>
              `<li><span>${segnoDelTempo(o.condition)}</span><b>${esc(
                ora(o.datetime, { hour: "2-digit", minute: "2-digit" }),
              )}</b><strong>${esc(numero(o.temperature))}°</strong>${
                o.precipitation
                  ? `<small>💧 ${esc(numero(o.precipitation, 1))} mm</small>`
                  : "<small></small>"
              }</li>`,
          )
          .join("")}</ul>`
      : `<p class="oc-vuoto">${esc(p.pronte ? t("Nessun dato orario", "No hourly data") : t("Arrivano le previsioni…", "Loading forecast…"))}</p>`;
    return finestraMarkup(
      `<button type="button" class="oc-indietro" data-oc="giorni" aria-label="${esc(t("Indietro", "Back"))}">←</button>${titolo}`,
      corpo,
    );
  }
  const giorni = p.giornaliere.slice(0, 7);
  const corpo = giorni.length
    ? `<ul class="oc-giorni">${giorni
        .map(
          (
            g,
          ) => `<li><button type="button" data-oc="giorno" data-oc-giorno="${esc(clean(g.datetime).slice(0, 10))}">
            <span class="oc-g-segno">${segnoDelTempo(g.condition)}</span>
            <span class="oc-g-nome">${esc(iniziale(ora(g.datetime, { weekday: "long", day: "numeric" })))}</span>
            <span class="oc-g-temp">${g.templow != null ? `<i>${esc(numero(g.templow))}°</i>` : ""}<b>${esc(
              numero(g.temperature),
            )}°</b></span>
          </button></li>`,
        )
        .join("")}</ul>`
    : `<p class="oc-vuoto">${esc(p.pronte ? t("Nessuna previsione", "No forecast") : t("Arrivano le previsioni…", "Loading forecast…"))}</p>`;
  return finestraMarkup(`🌤️ ${esc(t("Previsioni 7 giorni", "7-day forecast"))}`, corpo);
}

/* Il fotovoltaico: il flusso dell'energia, disegnato come quello della
 * plancia principale.
 *
 * «Parlavo solo del semplice disegno»: gli stessi cerchi — fondo da carta,
 * anello pieno del suo colore, il nome in alto dentro, l'icona, il numero
 * grande — la Casa piu' grande con l'anello blu, le linee tratteggiate che
 * corrono da un bordo all'altro, la luce attorno a chi sta lavorando. I numeri
 * sono quelli scelti nella scheda Colpo d'occhio. */
function energiaFinestra(occhio, states) {
  const periodi = periodiDellEnergia(occhio);
  if (!periodi.includes(state.periodo)) state.periodo = periodi[0] || "adesso";
  const nomi = {
    adesso: `⚡ ${t("Istantanea", "Live")}`,
    giorno: `📅 ${t("Giornaliera", "Daily")}`,
    mese: `📆 ${t("Mensile", "Monthly")}`,
  };
  const f = flussoDellEnergia(occhio, states, state.periodo);
  if (!f.configurato)
    return finestraMarkup(
      `${segno("solar", 22)} ${esc(t("Fotovoltaico", "Solar"))}`,
      `<p class="oc-vuoto">${esc(t("Le misure dell'energia si scelgono nel Config.", "Pick the energy sensors in the Config."))}</p>`,
    );
  const linguette =
    periodi.length > 1
      ? `<div class="oc-linguette-flusso">${periodi
          .map(
            (p) =>
              `<button type="button" data-oc="periodo" data-oc-periodo="${p}" aria-pressed="${p === state.periodo}">${esc(nomi[p])}</button>`,
          )
          .join("")}</div>`
      : "";
  return finestraMarkup(
    `${segno("solar", 22)} ${esc(t("Fotovoltaico", "Solar"))}`,
    `${linguette}${flussoMarkup(f)}`,
    { larga: true },
  );
}

/* Watt o kilowatt come li scrive il flusso della plancia: 850 W, 5,35 kW. */
function potenzaInParole(v) {
  if (v == null) return "—";
  return Math.abs(v) >= 1000 ? `${numero(v / 1000, 2)} kW` : `${numero(Math.round(v))} W`;
}

function valoreDelNodo(v, f) {
  if (f.unita === "W") return potenzaInParole(v);
  return v == null ? "—" : `${numero(v, 1)} kWh`;
}

/* Rete e batteria hanno due versi. Adesso se ne dice uno, con la freccia
 * come nella plancia (▼ entra, ▲ esce); nei periodi tutti e due. */
function dueVersi(f, entra, esce) {
  const a = f.nodi[entra];
  const b = f.nodi[esce];
  if (f.unita === "W") {
    const soglia = entra === "comprata" ? 50 : 30;
    if ((a ?? 0) > soglia) return `<span class="oc-n-val">▼ ${esc(potenzaInParole(a))}</span>`;
    if ((b ?? 0) > soglia) return `<span class="oc-n-val">▲ ${esc(potenzaInParole(b))}</span>`;
    return `<span class="oc-n-val">${a == null && b == null ? "—" : "0 W"}</span>`;
  }
  const n = (v) => (v == null ? "—" : numero(v, 1));
  return `<span class="oc-n-val oc-n-doppio"><b>▼ ${esc(n(a))}</b><b>▲ ${esc(n(b))}</b><small>kWh</small></span>`;
}

function flussoMarkup(f) {
  const l = f.linee;
  const nodi = f.nodi;
  const attivo = {
    solare: l.soleCasa || l.soleRete || l.soleBatteria,
    rete: l.reteCasa || l.soleRete,
    batteria: l.batteriaCasa || l.soleBatteria,
    casa: l.soleCasa || l.reteCasa || l.batteriaCasa,
  };
  const linea = (id, acceso, colore, d) =>
    `<path class="oc-linea" data-linea="${id}" data-acceso="${acceso}" style="--c:${colore}" d="${d}"/>`;
  const nodo = (chi, nome, icona, colore, corpo, extra = "") =>
    `<div class="oc-n" data-nodo="${chi}" data-attivo="${attivo[chi]}" style="--n:${colore}">
      <span class="oc-n-nome">${esc(nome)}</span><span class="oc-n-ic" aria-hidden="true">${icona}</span>${corpo}${extra}
    </div>`;
  return `<div class="oc-palco">
      <svg viewBox="0 0 1000 620" preserveAspectRatio="none" aria-hidden="true">
        ${linea("sole-casa", l.soleCasa, "#f59e0b", "M 500 118 L 500 453")}
        ${linea("sole-rete", l.soleRete, "#f59e0b", "M 500 118 Q 220 118 220 279")}
        ${linea("sole-batteria", l.soleBatteria, "#f59e0b", "M 500 118 Q 780 118 780 279")}
        ${linea("rete-casa", l.reteCasa, "#2563eb", "M 220 279 Q 260 453 500 453")}
        ${linea("batteria-casa", l.batteriaCasa, "#15803d", "M 780 279 Q 740 453 500 453")}
      </svg>
      ${nodo("solare", t("Solare", "Solar"), "☀️", "#f59e0b", `<span class="oc-n-val">${esc(valoreDelNodo(nodi.solare, f))}</span>`)}
      ${nodo("rete", t("Rete", "Grid"), "⚡", "#1e40af", dueVersi(f, "comprata", "venduta"))}
      ${nodo(
        "batteria",
        t("Batteria", "Battery"),
        "🔋",
        "#15803d",
        dueVersi(f, "carica", "scarica"),
        f.soc != null ? `<span class="oc-n-soc">${esc(numero(f.soc))}%</span>` : "",
      )}
      ${nodo("casa", t("Casa", "Home"), "🏠", "#3b82f6", `<span class="oc-n-val">${esc(valoreDelNodo(nodi.casa, f))}</span>`)}
    </div>`;
}

/* Le telecamere: la griglia delle istantanee. */
function telecamereFinestra(occhio) {
  const cam = occhio.telecamere;
  const corpo = cam.length
    ? `<div class="oc-cctv"><strong>${esc(t("TVCC dal vivo", "Live CCTV"))}</strong><span class="oc-pill" data-su="true"><i aria-hidden="true"></i>${esc(
        t("Attivo", "Active"),
      )}</span></div>
      <div class="oc-cam-griglia">${cam
        .map(
          (
            c,
            i,
          ) => `<button type="button" class="oc-cam" data-oc="telecamera" data-oc-cam="${esc(c.entity)}">
            <img alt="" data-oc-foto="${esc(c.entity)}" data-oc-vivo="${c.vivo}">
            <span class="oc-cam-attesa" aria-hidden="true">${esc(t("In attesa del fotogramma", "Waiting for a frame"))}</span>
            <span class="oc-cam-su"><b>CAM ${String(i + 1).padStart(2, "0")} // ${esc(
              (c.nome || c.entity.split(".")[1]).toUpperCase(),
            )}</b><i>REC</i></span>
            <span class="oc-cam-giu"><b data-oc-orologio></b><i>CH${i + 1}</i></span>
          </button>`,
        )
        .join("")}</div>`
    : `<p class="oc-vuoto">${esc(t("Le telecamere si scelgono nel Config.", "Pick the cameras in the Config."))}</p>`;
  return finestraMarkup(`${segno("camera", 22)} ${esc(t("Telecamere", "Cameras"))}`, corpo, {
    larga: true,
  });
}

/* Una telecamera dal vivo: lo spazio dove il motore della plancia mette il
 * video. Il motore lo riempie dopo il disegno (`accendiIlVideo`). */
function telecameraFinestra(occhio) {
  const c = occhio.telecamere.find((x) => x.entity === state.finestra?.cam);
  if (!c) return "";
  return finestraMarkup(
    `<button type="button" class="oc-indietro" data-oc="telecamere" aria-label="${esc(t("Indietro", "Back"))}">←</button>📹 ${esc(
      c.nome || c.entity,
    )}`,
    `<div class="oc-video" data-oc-video="${esc(c.entity)}"></div>`,
    { larga: true },
  );
}

/* L'antifurto: i tasti grandi. */
function antifurtoFinestra(occhio, states) {
  const a = occhio.antifurto;
  let tasti = "";
  if (a.modi.length) {
    tasti = a.modi
      .map((m, i) => {
        const acceso = modoInserito(m, states, a.modi);
        return `<button type="button" class="oc-modo" data-oc="modo" data-oc-modo="${i}" data-acceso="${acceso}" style="--oc:${esc(m.colore)}">
          <span class="oc-modo-ic" aria-hidden="true">${segno(m.disegno, 38)}</span>
          <strong>${esc(m.nome || m.entita)}</strong>
          <b class="oc-modo-stato">${esc(acceso ? t("Attivato", "On") : t("Disattivato", "Off"))}</b>
        </button>`;
      })
      .join("");
  } else if (a.centrale) {
    const stato = states?.[a.centrale];
    const modi = alarmModes(stato);
    const attivo = alarmActiveMode(
      stato?.state,
      modi.map((m) => m.mode),
    );
    const NOMI = {
      away: t("Totale", "Away"),
      home: t("Casa", "Home"),
      night: t("Notte", "Night"),
      vacation: t("Vacanza", "Vacation"),
      custom_bypass: t("Parziale", "Custom"),
      disarmed: t("Disinserisci", "Disarm"),
    };
    const COLORI = ["#7c3aed", "#06b6d4", "#f59e0b", "#e11d48", "#10b981"];
    tasti = modi
      .map((m, i) => {
        const disarma = m.service === "alarm_disarm";
        const acceso = attivo === m.mode;
        return `<button type="button" class="oc-modo" data-oc="centrale" data-oc-servizio="${esc(m.service)}" data-acceso="${acceso}"
          style="--oc:${disarma ? "#64748b" : COLORI[i % COLORI.length]}">
          <span class="oc-modo-ic" aria-hidden="true">${segno(disarma ? "unlock" : m.disegno || "security", 38)}</span>
          <strong>${esc(NOMI[m.mode] || m.mode)}</strong>
          <b class="oc-modo-stato">${esc(acceso ? t("Attivato", "On") : t("Disattivato", "Off"))}</b>
        </button>`;
      })
      .join("");
  }
  const corpo = tasti
    ? `<div class="oc-modi">${tasti}</div>`
    : `<p class="oc-vuoto">${esc(t("I modi dell'antifurto si scelgono nel Config.", "Pick the alarm modes in the Config."))}</p>`;
  return finestraMarkup(`${segno("security", 22)} ${esc(t("Antifurto", "Alarm"))}`, corpo);
}

/* Il PIN di un modo su misura: il tastierino, come quello della plancia
 * principale. Il codice si confronta qui; giusto, il modo parte. */
function codiceFinestra(occhio) {
  const f = state.finestra;
  const m = occhio.antifurto.modi[f?.modo];
  if (!m) return "";
  const punti = Array.from(
    { length: Math.max(4, (f.scritto || "").length) },
    (_x, i) => `<i class="${i < (f.scritto || "").length ? "si" : ""}"></i>`,
  ).join("");
  const tasti = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "✓"]
    .map(
      (k) =>
        `<button type="button" class="oc-cifra${k === "✓" ? " ok" : ""}" data-oc="cifra" data-oc-cifra="${k}" aria-label="${esc(k === "⌫" ? t("Cancella", "Delete") : k === "✓" ? "OK" : k)}">${k}</button>`,
    )
    .join("");
  return finestraMarkup(
    `<button type="button" class="oc-indietro" data-oc="antifurto" aria-label="${esc(t("Indietro", "Back"))}">←</button>🔒 ${esc(m.nome || m.entita)}`,
    `<div class="oc-codice${f.errore ? " sbagliato" : ""}"><p>${esc(f.errore ? t("Codice sbagliato", "Wrong code") : t("Scrivi il codice", "Enter the code"))}</p><div class="oc-punti">${punti}</div><div class="oc-cifre">${tasti}</div></div>`,
  );
}

/* Un modo su misura premuto: col codice, se ne ha uno, prima il tastierino. */
function premiIlModo(occhio, i, codice = null) {
  const a = occhio.antifurto;
  const m = a.modi[i];
  if (!m) return;
  if (m.pin && codice === null) return apriFinestra({ tipo: "codice", modo: i, scritto: "" });
  if (m.pin && codice !== m.pin) {
    state.finestra = { tipo: "codice", modo: i, scritto: "", errore: true };
    vibra([60, 40, 60]);
    return ridisegna();
  }
  const servizio = servizioDelModo(m, modoInserito(m, allStates(), a.modi));
  if (!servizio) {
    avviso(
      t(
        "Questo modo non sa cosa premere: guardalo nel Config",
        "This mode has nothing to press: check it in the Config",
      ),
      "male",
    );
    return;
  }
  try {
    chiamaServizio({ domain: servizio.domain, service: servizio.service, data: servizio.data });
  } catch (_errore) {
    avviso(t("⚠️ Non connesso", "⚠️ Not connected"), "male");
    return;
  }
  vibra(30);
  if (state.finestra?.tipo === "codice") state.finestra = { tipo: "antifurto" };
  const chi = m.nome || m.entita;
  avviso(t(`${chi}: comando inviato`, `${chi}: command sent`));
  ridisegna();
}

function finestraDiAdesso(occhio, states) {
  const f = state.finestra;
  if (!f) return "";
  if (f.tipo === "meteo") return meteoFinestra(occhio, states);
  if (f.tipo === "energia") return energiaFinestra(occhio, states);
  if (f.tipo === "telecamere") return telecamereFinestra(occhio);
  if (f.tipo === "telecamera") return telecameraFinestra(occhio);
  if (f.tipo === "antifurto") return antifurtoFinestra(occhio, states);
  if (f.tipo === "codice") return codiceFinestra(occhio);
  return "";
}

/* ── Premium ──────────────────────────────────────────────────────────────
 *
 * Come la plancia a muro: la pagina a colpo d'occhio si accende solo se il
 * ponte dice che la casa e' Premium. Con Base la plancia resta quella di
 * sempre, e il config resta scritto per il giorno dopo. La risposta del ponte
 * vale mezz'ora; nel frattempo vale quello che il dispositivo ha saputo
 * l'ultima volta, cosi' una casa Premium non vede la plancia classica prima
 * della sua. */
const MEZZ_ORA = 30 * 60 * 1000;

function eCasaPremium() {
  if (state.premium === null && premiumRicordato() === true) state.premium = true;
  /* Si richiede alla mezz'ora: una licenza scaduta spegne la pagina, una
   * comprata la accende, senza ricaricare. */
  if (state.premium === null || Date.now() - (state.chiestaIl || 0) > MEZZ_ORA) chiediLaLicenza();
  return state.premium === true;
}

function chiediLaLicenza() {
  if (state.chiedendo) return;
  state.chiedendo = true;
  state.chiestaIl = Date.now();
  premiumDellaCasa()
    .then((premium) => {
      const prima = state.premium;
      state.premium = premium === true;
      if (prima !== state.premium) ridisegna();
    })
    .catch(() => {})
    .finally(() => {
      state.chiedendo = false;
    });
}

/* ── il disegno ───────────────────────────────────────────────────────── */

function editorAperto() {
  return Boolean(doc?.getElementById("editor-modal"));
}

function tela() {
  let nodo = doc.getElementById(ID);
  if (!nodo) {
    nodo = doc.createElement("div");
    nodo.id = ID;
    nodo.innerHTML = `<div class="oc-pagina"></div><div class="oc-sopra"></div><div class="oc-avviso" role="status" aria-live="polite"></div>`;
    doc.body.appendChild(nodo);
    nodo.addEventListener("click", alClic);
  }
  return nodo;
}

function togliLaTela() {
  chiudiIlVideo();
  lasciaLeTelecamere();
  if (state.timer) root.clearInterval?.(state.timer);
  state.timer = 0;
  doc?.getElementById(ID)?.remove();
  doc?.documentElement?.classList?.remove("dm-occhio-acceso");
}

export function disegna() {
  if (!doc?.body) return;
  const states = allStates() || {};
  const occhio = occhioDaMostrare(states);
  /* Col Config aperto la pagina resta dov'e', nascosta dal foglio di stile
   * (`:has(#editor-modal)`): quando il Config si chiude ricompare da sola,
   * senza che nessuno debba accorgersene. */
  if (!occhio.attiva || !eCasaPremium()) {
    togliLaTela();
    return;
  }
  let admin = false;
  try {
    admin = puoConfigurare();
  } catch (_errore) {}
  const nodo = tela();
  doc.documentElement.classList.add("dm-occhio-acceso");
  nodo.dataset.tema = doc.documentElement.getAttribute("data-theme") || "light";
  scriviSeCambia(
    nodo.querySelector(".oc-pagina"),
    `${testataMarkup(occhio, admin)}${meteoMarkup(occhio, states)}${riquadriMarkup(occhio, states)}`,
  );
  /* Il video vivo non si ridisegna: la finestra della telecamera resta
   * com'e' finche' resta aperta, se no ogni stato che cambia lo riavvierebbe.
   * Una telecamera riservata che smette di potersi vedere — e' rientrato
   * qualcuno — invece si chiude subito. */
  const sopra = nodo.querySelector(".oc-sopra");
  const video = sopra.querySelector("[data-oc-video]");
  if (video && occhio.telecamere.some((c) => c.entity === video.dataset.ocVideo)) return;
  if (video) chiudiIlVideo();
  if (scriviSeCambia(sopra, finestraDiAdesso(occhio, states))) {
    if (!sopra.querySelector("img[data-oc-foto]")) lasciaLeTelecamere();
    aggiornaLeTelecamere();
    accendiIlVideo(occhio, sopra);
  }
  avviaIlBattito();
}

function ridisegna() {
  if (state.frame) return;
  const giro = () => {
    state.frame = 0;
    try {
      disegna();
    } catch (errore) {
      root.console?.warn?.("[DashboardModern] colpo d'occhio", errore);
    }
  };
  state.frame = root.requestAnimationFrame?.(giro) || 0;
  if (!state.frame) giro();
}

/* Il battito: l'ora in cima e gli orologi delle telecamere ogni secondo; le
 * telecamere della griglia al passo della plancia principale. */
function avviaIlBattito() {
  if (state.timer) return;
  let giri = 0;
  state.timer =
    root.setInterval?.(() => {
      giri += 1;
      const nodo = doc?.getElementById(ID);
      if (!nodo) {
        root.clearInterval?.(state.timer);
        state.timer = 0;
        return;
      }
      /* Nessuno guarda: la scheda del browser e' dietro, o c'e' il Config. */
      if (doc.hidden || editorAperto()) return;
      const adesso = new Date().toLocaleTimeString(lingua(), { hour12: false });
      for (const el of nodo.querySelectorAll("[data-oc-orologio]")) el.textContent = adesso;
      if (giri % 2 === 0 && nodo.querySelector("img[data-oc-foto]")) {
        sorvegliaIFlussi();
        aggiornaLeTelecamere();
      }
      if (giri % 20 === 0) ridisegna();
    }, 1000) || 0;
}

/* ── le telecamere della griglia ──────────────────────────────────────── */

/* Il motore e' quello della plancia principale (`loadCameraFrame`): la foto
 * si scarica a parte e si posa solo quando e' arrivata tutta, il fotogramma
 * di prima resta a schermo, chi e' «dal vivo» prende il flusso continuo (e se
 * il flusso si ferma si torna alle istantanee), e una telecamera che la foto
 * non la da' prova il video muto. Qui c'e' solo il passo, lo stesso della
 * Sicurezza e della tessera Telecamere:
 *
 *   · un fotogramma ogni quattro secondi per telecamera, non a ogni ridisegno;
 *   · una foto che sta arrivando non si interrompe, si aspetta quella;
 *   · due telecamere alla volta, cosi' la prima si vede subito;
 *   · una a cui la casa ha detto di no si riprova ogni due secondi. */
const PASSO_DELLE_TELECAMERE_MS = 4000;
const RIPROVA_LA_TELECAMERA_MS = 2000;
const TELECAMERE_IN_VOLO = 2;

function aggiornaLeTelecamere() {
  const nodo = doc?.getElementById(ID);
  const immagini = [...(nodo?.querySelectorAll?.("img[data-oc-foto]") || [])];
  if (!immagini.length) return false;
  const adesso = Date.now();
  state.chieste ||= new WeakMap();
  const coda = immagini.filter((image) => {
    if (istantaneaInViaggio(image, adesso)) return false;
    const ultima = state.chieste.get(image) || 0;
    const freno =
      image.dataset.dmCameraState === "ready"
        ? PASSO_DELLE_TELECAMERE_MS - 500
        : RIPROVA_LA_TELECAMERA_MS;
    if (adesso - ultima < freno) return false;
    state.chieste.set(image, adesso);
    return true;
  });
  /* Le capacita' (WebRTC, HLS) si chiedono una volta: una Ring che le foto
   * non le da' il video lo trova solo cosi'. Il freno e' quello del modulo. */
  for (const image of coda) chiediLeCapacita(clean(image.dataset.ocFoto), adesso).catch(() => {});
  const tira = async () => {
    while (coda.length) {
      const image = coda.shift();
      if (!image?.isConnected) continue;
      await loadCameraFrame(
        { entity: clean(image.dataset.ocFoto), vivo: image.dataset.ocVivo === "true" },
        image,
        state.cameraUrls,
      ).catch(() => false);
    }
  };
  Promise.all(Array.from({ length: Math.min(TELECAMERE_IN_VOLO, coda.length) }, tira)).catch(
    () => {},
  );
  return true;
}

/* Chiusa la griglia, i flussi si spengono e le foto scaricate si buttano. */
function lasciaLeTelecamere() {
  if (!state.cameraUrls.size) return;
  try {
    fermaIVideo();
  } catch (_errore) {}
  for (const url of state.cameraUrls.values()) {
    if (typeof url === "string" && url.startsWith("blob:")) {
      try {
        root.URL?.revokeObjectURL?.(url);
      } catch (_errore) {}
    }
  }
  state.cameraUrls.clear();
}

/* ── il video ─────────────────────────────────────────────────────────── */

function accendiIlVideo(occhio, sopra) {
  const posto = sopra.querySelector("[data-oc-video]");
  if (!posto) return;
  const c = occhio.telecamere.find((x) => x.entity === posto.dataset.ocVideo);
  const apri = lexicalGlobal("dmCamOpen");
  if (!c || typeof apri !== "function") {
    posto.innerHTML = `<p class="oc-vuoto">${esc(t("Il video non si apre da qui.", "The video cannot open here."))}</p>`;
    return;
  }
  try {
    apri({ entity: c.entity, stream: c.stream, name: c.nome }, c.nome || c.entity, posto);
    state.videoAperto = true;
  } catch (errore) {
    root.console?.warn?.("[DashboardModern] colpo d'occhio, video", errore);
  }
}

/* Chiude solo il video che ha aperto il Colpo d'occhio. Il motore delle
 * telecamere e' uno, e `dmCamCleanup` ferma qualunque video sia aperto:
 * chiamarlo a ogni ridisegno — e il Colpo d'occhio si ridisegna a ogni stato
 * che cambia in casa, anche quando e' spento — fermava la telecamera aperta
 * dalla plancia, a schermo intero compreso, al primo sensore che si muoveva. */
function chiudiIlVideo() {
  if (!state.videoAperto) return;
  state.videoAperto = false;
  try {
    lexicalGlobal("dmCamCleanup")?.();
  } catch (_errore) {}
}

/* ── i gesti ──────────────────────────────────────────────────────────── */

function vibra(quanto = 10) {
  try {
    root.navigator?.vibrate?.(quanto);
  } catch (_errore) {}
}

function avviso(testo, tipo = "bene") {
  const el = doc?.getElementById(ID)?.querySelector(".oc-avviso");
  if (!el) return;
  el.textContent = testo;
  el.dataset.tipo = tipo;
  el.classList.add("visto");
  root.clearTimeout?.(state.avviso);
  state.avviso = root.setTimeout?.(() => el.classList.remove("visto"), 2200);
}

function apriFinestra(finestra) {
  if (state.finestra?.tipo === "telecamera") chiudiIlVideo();
  state.finestra = finestra;
  vibra();
  ridisegna();
}

function chiudi() {
  if (state.finestra?.tipo === "telecamera") chiudiIlVideo();
  state.finestra = null;
  ridisegna();
}

function apriIlCancello(r, bottone) {
  const servizio = servizioPerAprire(r.entita);
  if (!servizio) {
    avviso(t("Scegli cosa apre nel Config", "Pick what it opens in the Config"), "male");
    return;
  }
  if (
    r.conferma &&
    typeof root.confirm === "function" &&
    !root.confirm(t(`Aprire ${nomeDelRiquadro(r)}?`, `Open ${nomeDelRiquadro(r)}?`))
  )
    return;
  try {
    chiamaServizio({
      domain: servizio.domain,
      service: servizio.service,
      data: { entity_id: r.entita },
    });
  } catch (_errore) {
    avviso(t("⚠️ Non connesso", "⚠️ Not connected"), "male");
    return;
  }
  vibra([40, 30, 40]);
  bottone?.classList.add("oc-pulsa");
  root.setTimeout?.(() => bottone?.classList.remove("oc-pulsa"), 1200);
  avviso(t(`${nomeDelRiquadro(r)}: comando inviato`, `${nomeDelRiquadro(r)}: command sent`));
}

function alClic(evento) {
  const el = evento.target?.closest?.("[data-oc]");
  if (!el) return;
  const cosa = el.dataset.oc;
  const occhio = occhioDiQui();
  if (cosa === "velo") {
    if (evento.target === el) chiudi();
    return;
  }
  if (cosa === "chiudi") return chiudi();
  /* Il ☰: come sulla plancia a muro, apre la barra laterale di Home
   * Assistant, o il menu dell'app GdAHome quando la plancia sta li'. */
  if (cosa === "menu") {
    apriIlMenu({ idTela: ID, tasto: '[data-oc="menu"]', rimisura: () => {} });
    return;
  }
  if (cosa === "config") {
    try {
      root.apriConfigEntita?.();
      root.setTimeout?.(() => root.editorSwitch?.("occhio"), 50);
      /* Il Config sta sopra: la pagina si fa da parte finche' e' aperto. */
      ridisegna();
    } catch (_errore) {}
    return;
  }
  if (cosa === "meteo") return apriFinestra({ tipo: "meteo" });
  if (cosa === "giorno") return apriFinestra({ tipo: "meteo", giorno: el.dataset.ocGiorno });
  if (cosa === "giorni") return apriFinestra({ tipo: "meteo" });
  if (cosa === "periodo") {
    state.periodo = el.dataset.ocPeriodo;
    vibra(6);
    return ridisegna();
  }
  if (cosa === "telecamere") return apriFinestra({ tipo: "telecamere" });
  if (cosa === "telecamera")
    return apriFinestra({ tipo: "telecamera", cam: clean(el.dataset.ocCam) });
  if (cosa === "riquadro") {
    const r = occhio.riquadri.find((x) => x.id === el.dataset.ocId);
    if (!r) return;
    if (r.tipo === "apri") return apriIlCancello(r, el);
    return apriFinestra({ tipo: r.tipo });
  }
  if (cosa === "modo") return premiIlModo(occhio, Number(el.dataset.ocModo));
  if (cosa === "antifurto") return apriFinestra({ tipo: "antifurto" });
  if (cosa === "cifra") {
    const f = state.finestra;
    if (f?.tipo !== "codice") return;
    const k = clean(el.dataset.ocCifra);
    if (k === "✓") return premiIlModo(occhio, f.modo, f.scritto || "");
    f.errore = false;
    f.scritto = k === "⌫" ? (f.scritto || "").slice(0, -1) : `${f.scritto || ""}${k}`.slice(0, 8);
    vibra(6);
    return ridisegna();
  }
  if (cosa === "centrale") {
    const servizio = clean(el.dataset.ocServizio);
    const id = occhio.antifurto.centrale;
    if (!id || !servizio) return;
    vibra(15);
    /* Con un codice si passa dal tastierino della plancia, che lo chiede e
     * lo manda insieme; senza, il comando parte subito. */
    if (alarmCodeNeeded(allStates()?.[id], servizio)) {
      const tastierino = lexicalGlobal("promptPinAndSet");
      if (typeof tastierino === "function") return tastierino(servizio);
    }
    chiamaServizio({ domain: "alarm_control_panel", service: servizio, data: { entity_id: id } });
  }
}

/* ── il foglio ────────────────────────────────────────────────────────── */

function installaLoStile() {
  const P = `#${ID}`;
  installStyle(
    "dm-occhio-style",
    `
    html.dm-occhio-acceso:not(:has(#editor-modal)),html.dm-occhio-acceso:not(:has(#editor-modal)) body{overflow:hidden!important}
    html:has(#editor-modal) #${ID}{display:none!important}
    html.dm-occhio-acceso #custom-keypad{z-index:2147483600!important}
    ${P}{--oc-bg:#eef2f7;--oc-card:#fff;--oc-bordo:#e2e8f0;--oc-testo:#0a0e17;--oc-fioco:#64748b;--oc-morbido:#f8fafc;
      --oc-ombra:0 1px 2px rgba(15,23,42,.04),0 4px 12px rgba(15,23,42,.06);--oc-ombra-su:0 6px 20px rgba(15,23,42,.10);
      position:fixed;inset:0;z-index:2147483000;overflow-y:auto;-webkit-overflow-scrolling:touch;
      background:var(--oc-bg);color:var(--oc-testo);font-family:'Inter',system-ui,sans-serif;-webkit-font-smoothing:antialiased}
    ${P}[data-tema="dark"]{--oc-bg:#0b1120;--oc-card:#111827;--oc-bordo:#1f2a44;--oc-testo:#e5e7eb;--oc-fioco:#94a3b8;--oc-morbido:#0f172a;
      --oc-ombra:0 1px 2px rgba(0,0,0,.3),0 6px 16px rgba(0,0,0,.35);--oc-ombra-su:0 10px 28px rgba(0,0,0,.45)}
    ${P} *{box-sizing:border-box}
    ${P} svg{display:block}
    ${P} .oc-pagina{max-width:1400px;margin:0 auto;padding:16px 16px 100px}
    ${P} button{font:inherit;color:inherit}

    ${P} .oc-testa{display:flex;align-items:center;gap:18px;margin-bottom:20px;padding:22px 26px;border-radius:28px;
      background:var(--oc-card);border:1px solid var(--oc-bordo);box-shadow:var(--oc-ombra)}
    ${P} .oc-testa-ic{display:grid;place-items:center;flex:0 0 auto;width:60px;height:60px;border-radius:20px;
      background:linear-gradient(135deg,#f59e0b,#ea580c);box-shadow:0 10px 24px rgba(245,158,11,.35)}
    ${P} .oc-testa-ic svg{width:34px;height:34px}
    ${P} .oc-testa-testo{flex:1;min-width:0}
    ${P} .oc-testa-testo h1{margin:0;font-family:'Oswald',system-ui,sans-serif;font-size:26px;font-weight:700;letter-spacing:1.2px;
      text-transform:uppercase;line-height:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    ${P} .oc-testa-testo p{margin:4px 0 0;font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:var(--oc-fioco)}
    ${P} .oc-testa-stato{display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex:0 0 auto}
    ${P} .oc-pill{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;font-size:11px;font-weight:800;
      letter-spacing:.8px;text-transform:uppercase;color:#065f46;background:#d1fae5}
    ${P} .oc-pill i{width:8px;height:8px;border-radius:50%;background:#10b981;animation:oc-batte 2s ease-in-out infinite}
    ${P} .oc-pill[data-su="false"]{color:#991b1b;background:#fee2e2}
    ${P} .oc-pill[data-su="false"] i{background:#dc2626;animation:none}
    @keyframes oc-batte{0%,100%{box-shadow:0 0 0 0 rgba(16,185,129,.5)}50%{box-shadow:0 0 0 6px rgba(16,185,129,0)}}
    ${P} .oc-ora{padding:6px 10px;border-radius:999px;font-family:'Oswald',system-ui,sans-serif;font-size:11px;font-weight:700;letter-spacing:1px;
      background:var(--oc-morbido);border:1px solid var(--oc-bordo)}
    ${P} .oc-menu{display:flex;flex-direction:column;justify-content:center;gap:5px;flex:0 0 auto;width:52px;height:52px;padding:0 14px;
      border-radius:16px;border:1px solid var(--oc-bordo);background:var(--oc-morbido);cursor:pointer;box-shadow:var(--oc-ombra)}
    ${P} .oc-menu span{display:block;height:3px;border-radius:3px;background:var(--oc-testo)}
    /* Col menu aperto la pagina scende sotto il cassetto (o si scosta, con
     * la barra di Home Assistant larga): lo fa \`apriIlMenu\`. */
    ${P}[data-mu-sotto-il-menu]{z-index:4!important}
    ${P}[data-mu-accanto-al-menu]{right:0}
    ${P} .oc-config{display:grid;place-items:center;flex:0 0 auto;width:42px;height:42px;border-radius:14px;border:1px solid var(--oc-bordo);
      background:var(--oc-morbido);cursor:pointer}
    ${P} .oc-config svg{width:22px;height:22px}

    /* Il meteo vestito come la card della plancia principale. */
    ${P} .oc-meteo{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);align-items:center;gap:14px 20px;width:100%;
      margin-bottom:20px;padding:20px 22px 16px;border-radius:22px;cursor:pointer;text-align:left;
      background:var(--oc-card);border:1px solid var(--oc-bordo);box-shadow:var(--oc-ombra);
      transition:transform .18s cubic-bezier(.16,1,.3,1),box-shadow .2s ease}
    ${P} .oc-meteo:hover{transform:translateY(-4px);box-shadow:var(--oc-ombra-su)}
    ${P} .oc-meteo-capo{display:flex;align-items:center;gap:16px;min-width:0}
    ${P} .oc-meteo-segno{font-size:52px;line-height:1;flex:0 0 auto;filter:drop-shadow(0 6px 14px rgba(15,23,42,.14))}
    ${P} .oc-meteo-gradi{display:grid;gap:3px;min-width:0}
    ${P} .oc-meteo-gradi>b{font-size:42px;font-weight:900;letter-spacing:-2px;line-height:1;font-variant-numeric:tabular-nums}
    ${P} .oc-meteo-gradi small{font-size:12px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--oc-fioco);
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    ${P} .oc-meteo-gradi em{font-style:normal;font-size:12px;font-weight:800;color:var(--oc-fioco);font-variant-numeric:tabular-nums}
    ${P} .oc-meteo-gradi em b{color:var(--oc-testo)}
    ${P} .oc-meteo-misure{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}
    ${P} .oc-meteo-misure>span{display:flex;align-items:center;gap:7px;padding:8px 12px;border-radius:12px;background:var(--oc-morbido);
      border:1px solid var(--oc-bordo);font-size:12px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    ${P} .oc-meteo-misure i{font-style:normal;color:var(--oc-fioco)}
    ${P} .oc-meteo-misure b{font-weight:900;font-variant-numeric:tabular-nums}
    ${P} .oc-meteo-giorni{grid-column:1/-1;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;
      border-top:1px dashed var(--oc-bordo);padding-top:13px}
    ${P} .oc-meteo-giorno{display:flex;flex-direction:column;align-items:center;gap:5px;padding:9px 4px;border-radius:13px;background:var(--oc-morbido)}
    ${P} .oc-meteo-giorno>i{font-style:normal;font-size:10px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--oc-fioco)}
    ${P} .oc-meteo-giorno>span{font-size:21px;line-height:1}
    ${P} .oc-meteo-giorno>b{font-size:12px;font-weight:800;font-variant-numeric:tabular-nums}
    ${P} .oc-meteo-giorno>b i{font-style:normal;color:var(--oc-fioco)}

    ${P} .oc-titolo{margin:18px 4px 14px;font-size:13px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:var(--oc-fioco)}
    ${P} .oc-riquadri{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
    @media(min-width:1000px){${P} .oc-riquadri{grid-template-columns:repeat(4,minmax(0,1fr))}}
    ${P} .oc-riquadro{--oc:#f59e0b;position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;
      min-height:140px;padding:28px 20px;border-radius:24px;cursor:pointer;text-align:center;background:var(--oc-card);
      border:1px solid var(--oc-bordo);box-shadow:var(--oc-ombra);transition:transform .3s cubic-bezier(.165,.84,.44,1),box-shadow .3s,border-color .3s}
    ${P} .oc-riquadro::before{content:"";position:absolute;inset:0;pointer-events:none;
      background:radial-gradient(circle at 50% 0%,color-mix(in srgb,var(--oc) 12%,transparent) 0%,transparent 70%)}
    ${P} .oc-riquadro:hover{transform:translateY(-4px);box-shadow:var(--oc-ombra-su);border-color:color-mix(in srgb,var(--oc) 40%,transparent)}
    ${P} .oc-riquadro:active{transform:translateY(-2px) scale(.98)}
    ${P} .oc-riquadro[data-acceso="true"]{border-color:var(--oc);box-shadow:0 12px 32px color-mix(in srgb,var(--oc) 25%,transparent)}
    ${P} .oc-riquadro-ic{position:relative;display:grid;place-items:center;width:64px;height:64px;margin-bottom:12px;border-radius:20px;
      background:linear-gradient(135deg,var(--oc),color-mix(in srgb,var(--oc) 70%,transparent));box-shadow:0 8px 20px color-mix(in srgb,var(--oc) 35%,transparent)}
    ${P} .oc-riquadro-ic svg{width:36px;height:36px}
    ${P} .oc-riquadro strong{position:relative;font-family:'Oswald',system-ui,sans-serif;font-size:18px;font-weight:700;letter-spacing:1.2px;
      text-transform:uppercase;line-height:1}
    ${P} .oc-riquadro small{position:relative;margin-top:6px;font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--oc-fioco)}
    ${P} .oc-pulsa{animation:oc-pulsa 1.2s ease-out}
    @keyframes oc-pulsa{0%{box-shadow:var(--oc-ombra),0 0 0 0 color-mix(in srgb,var(--oc) 50%,transparent);transform:scale(1)}
      30%{box-shadow:var(--oc-ombra),0 0 0 16px transparent;transform:scale(1.04)}100%{transform:scale(1)}}
    ${P} .oc-vuoto{margin:0;padding:28px 12px;text-align:center;font-size:13px;font-weight:800;color:var(--oc-fioco)}

    ${P} .oc-velo{position:fixed;inset:0;z-index:2;display:flex;align-items:center;justify-content:center;padding:20px;
      background:rgba(15,23,42,.65);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);animation:oc-entra .35s cubic-bezier(.4,0,.2,1)}
    @keyframes oc-entra{from{opacity:0}to{opacity:1}}
    ${P} .oc-finestra{display:flex;flex-direction:column;width:100%;max-width:520px;max-height:86vh;overflow:hidden;border-radius:28px;
      background:var(--oc-card);box-shadow:0 30px 80px rgba(0,0,0,.4);animation:oc-sale .45s cubic-bezier(.16,1,.3,1)}
    ${P} .oc-finestra.oc-larga{max-width:900px}
    @keyframes oc-sale{0%{transform:translateY(24px) scale(.94);opacity:0}60%{opacity:1}100%{transform:none;opacity:1}}
    ${P} .oc-finestra-testa{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:20px 24px;border-bottom:1px solid var(--oc-bordo)}
    ${P} .oc-finestra-testa h3{display:flex;align-items:center;gap:8px;margin:0;font-family:'Oswald',system-ui,sans-serif;font-size:19px;font-weight:700;
      letter-spacing:.8px;text-transform:uppercase}
    ${P} .oc-finestra-testa h3 svg{width:24px;height:24px}
    ${P} .oc-chiudi,${P} .oc-indietro{display:grid;place-items:center;flex:0 0 auto;width:36px;height:36px;border:0;border-radius:50%;cursor:pointer;
      font-size:14px;font-weight:800;color:var(--oc-fioco);background:var(--oc-morbido);transition:transform .3s}
    ${P} .oc-chiudi:hover{transform:rotate(90deg)}
    ${P} .oc-finestra-corpo{padding:16px 20px 20px;overflow-y:auto}

    ${P} .oc-giorni,${P} .oc-ore{display:grid;gap:8px;margin:0;padding:0;list-style:none}
    ${P} .oc-giorni button{display:flex;align-items:center;gap:16px;width:100%;padding:14px 18px;border-radius:16px;cursor:pointer;text-align:left;
      background:var(--oc-morbido);border:1px solid var(--oc-bordo);transition:transform .25s,background .25s}
    ${P} .oc-giorni button:hover{transform:translateX(4px);background:var(--oc-card)}
    ${P} .oc-g-segno{font-size:28px}
    ${P} .oc-g-nome{flex:1;font-size:12px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:var(--oc-fioco)}
    ${P} .oc-g-temp{font-family:'Oswald',system-ui,sans-serif;font-size:20px;font-weight:700}
    ${P} .oc-g-temp i{font-style:normal;color:#0ea5e9;margin-right:12px}
    ${P} .oc-g-temp b{color:#e11d48}
    ${P} .oc-ore li{display:grid;grid-template-columns:30px 60px 1fr auto;align-items:center;gap:12px;padding:10px 16px;border-radius:12px;
      background:var(--oc-morbido);border:1px solid var(--oc-bordo)}
    ${P} .oc-ore span{font-size:22px}
    ${P} .oc-ore b{font-size:13px;font-weight:800}
    ${P} .oc-ore strong{font-family:'Oswald',system-ui,sans-serif;font-size:18px;color:#e11d48}
    ${P} .oc-ore small{font-size:11px;font-weight:700;color:#0ea5e9}

    /* Il flusso come quello della plancia principale. */
    ${P} .oc-linguette-flusso{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;margin:0 0 16px}
    ${P} .oc-linguette-flusso button{padding:11px 20px;border-radius:999px;cursor:pointer;font-size:14px;font-weight:600;letter-spacing:1px;
      text-transform:uppercase;color:var(--oc-testo);background:var(--oc-card);border:1px solid var(--oc-bordo);transition:all .25s}
    ${P} .oc-linguette-flusso button[aria-pressed="true"]{color:var(--oc-testo);background:color-mix(in srgb,#0ea5e9 16%,var(--oc-card));
      border-color:color-mix(in srgb,#0ea5e9 45%,transparent);box-shadow:0 8px 22px color-mix(in srgb,#0ea5e9 22%,transparent)}
    /* Il disegno e' quello del flusso della plancia principale (.flow-stage,
     * .flow-line, .node): bordo pieno, e quando passa energia l'alone,
     * l'ingrandimento e l'anello tratteggiato che gira. */
    ${P} .oc-palco{position:relative;width:100%;height:560px;border-radius:36px;overflow:hidden;background:var(--oc-card);border:1px solid var(--oc-bordo);
      box-shadow:var(--oc-ombra)}
    ${P} .oc-palco>svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
    ${P} .oc-linea{fill:none;stroke:#cbd5e1;stroke-width:4;stroke-linecap:round;stroke-dasharray:10 10;opacity:.3;transition:all .5s ease}
    ${P} .oc-linea[data-acceso="true"]{opacity:1;stroke:var(--c);stroke-width:6;animation:oc-scorre 1s linear infinite;filter:drop-shadow(0 0 10px var(--c))}
    @keyframes oc-scorre{to{stroke-dashoffset:-20}}
    ${P} .oc-n{--n:#64748b;position:absolute;z-index:3;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;
      width:170px;height:170px;padding:5px;box-sizing:border-box;transform:translate(-50%,-50%);border-radius:50%;text-align:center;
      background:var(--oc-card);border:5px solid var(--n);box-shadow:var(--oc-ombra);transition:all .5s ease}
    ${P} .oc-n::after{content:"";position:absolute;inset:-12px;z-index:-1;border-radius:50%;pointer-events:none;
      border:3px dashed color-mix(in srgb,var(--n) 35%,transparent);opacity:0;transition:.5s;animation:oc-anello 10s linear infinite}
    @keyframes oc-anello{to{transform:rotate(360deg)}}
    ${P} .oc-n[data-attivo="true"]{transform:translate(-50%,-50%) scale(1.07);
      box-shadow:10px 15px 30px #d1d9e6,-10px -10px 20px #fff,0 15px 35px color-mix(in srgb,var(--n) 35%,transparent)}
    ${P} .oc-n[data-attivo="true"]::after{opacity:1}
    ${P} .oc-n[data-nodo="solare"]{left:50%;top:19%}
    ${P} .oc-n[data-nodo="rete"]{left:22%;top:45%}
    ${P} .oc-n[data-nodo="batteria"]{left:78%;top:45%}
    ${P} .oc-n[data-nodo="casa"]{left:50%;top:73%;width:210px;height:210px}
    ${P} .oc-n-nome{font-size:14px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:var(--oc-fioco)}
    ${P} .oc-n-ic{font-size:34px;line-height:1.1}
    ${P} .oc-n[data-nodo="casa"] .oc-n-ic{font-size:40px}
    ${P} .oc-n-val{font-family:'Oswald',system-ui,sans-serif;font-size:30px;font-weight:700;line-height:1.05;color:var(--oc-testo);white-space:nowrap}
    ${P} .oc-n[data-nodo="casa"] .oc-n-val{font-size:38px}
    ${P} .oc-n-doppio{display:flex;flex-direction:column;align-items:center;font-size:19px!important;line-height:1.15}
    ${P} .oc-n-doppio b{font-weight:700}
    ${P} .oc-n-doppio small{font-family:'Inter',system-ui,sans-serif;font-size:11px;font-weight:800;color:var(--oc-fioco)}
    ${P} .oc-n-soc{font-size:14px;font-weight:800;color:var(--oc-fioco)}
    ${P} .oc-cctv{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;padding:12px 16px;border-radius:16px;
      background:var(--oc-morbido);border:1px solid var(--oc-bordo)}
    ${P} .oc-cctv strong{font-family:'Oswald',system-ui,sans-serif;font-size:16px;letter-spacing:.8px;text-transform:uppercase}
    ${P} .oc-cam-griglia{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr));gap:14px}
    ${P} .oc-cam{position:relative;overflow:hidden;padding:0;padding-top:56.25%;border-radius:20px;cursor:pointer;background:#0f172a;
      border:1px solid var(--oc-bordo);box-shadow:var(--oc-ombra);transition:transform .3s,border-color .3s}
    ${P} .oc-cam:hover{transform:translateY(-3px) scale(1.01);border-color:#06b6d4}
    /* Come nella plancia principale: l'immagine si vede solo quando ha un
     * fotogramma vero, mai un'icona rotta o un lampo nero fra uno e l'altro. */
    ${P} .oc-cam img{position:absolute;inset:0;z-index:1;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .25s ease}
    ${P} .oc-cam img[data-dm-camera-state="ready"],${P} .oc-cam img[data-dm-camera-frame]{opacity:1}
    /* Il video dal vivo lo mette il motore della plancia accanto alla foto:
     * senza questo stava sotto di lei con la sua misura vera, allungava il
     * riquadro in una striscia alta e allargava la finestra mentre la si
     * guardava. Sta sopra la foto, nella stessa cornice 16:9. */
    ${P} .oc-cam>video.dm-cam-video{position:absolute;inset:0;z-index:1;width:100%;height:100%;object-fit:cover;opacity:0;
      pointer-events:none;background:#0b1220;transition:opacity .35s ease}
    ${P} .oc-cam[data-dm-video="on"]>video.dm-cam-video{opacity:1}
    ${P} .oc-cam-attesa{position:absolute;inset:0;display:grid;place-items:center;padding:0 16px;font-size:12px;font-weight:700;letter-spacing:.4px;
      color:rgba(226,232,240,.7);text-align:center}
    ${P} .oc-cam-su,${P} .oc-cam-giu{position:absolute;left:0;right:0;z-index:2;display:flex;justify-content:space-between;align-items:center;
      padding:9px 12px;font-family:ui-monospace,Menlo,monospace;font-size:10.5px;font-weight:800;letter-spacing:.8px;color:#fff}
    ${P} .oc-cam-su{top:0;background:linear-gradient(180deg,rgba(0,0,0,.7),transparent)}
    ${P} .oc-cam-giu{bottom:0;background:linear-gradient(0deg,rgba(0,0,0,.7),transparent)}
    ${P} .oc-cam-su b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    ${P} .oc-cam i{font-style:normal}
    ${P} .oc-cam-su i{color:#ef4444;animation:oc-rec 1.5s ease-in-out infinite}
    ${P} .oc-cam-su i::before{content:"● "}
    ${P} .oc-cam-giu i{color:#06b6d4}
    @keyframes oc-rec{50%{opacity:.5}}
    ${P} .oc-video{min-height:200px}

    ${P} .oc-modi{display:flex;flex-direction:column;gap:16px}
    ${P} .oc-codice{display:flex;flex-direction:column;align-items:center;gap:18px;padding:6px 0}
    ${P} .oc-codice p{margin:0;font-size:15px;font-weight:800;color:var(--oc-fioco)}
    ${P} .oc-codice.sbagliato p{color:#e11d48}
    ${P} .oc-punti{display:flex;gap:12px}
    ${P} .oc-punti i{width:14px;height:14px;border-radius:50%;border:2px solid var(--oc-fioco)}
    ${P} .oc-punti i.si{background:var(--oc-testo);border-color:var(--oc-testo)}
    ${P} .oc-codice.sbagliato .oc-punti i{border-color:#e11d48}
    ${P} .oc-cifre{display:grid;grid-template-columns:repeat(3,72px);gap:12px}
    ${P} .oc-cifra{height:72px;border-radius:50%;border:1px solid var(--oc-bordo);background:var(--oc-card);color:var(--oc-testo);
      font:700 26px/1 'Inter',system-ui,sans-serif;cursor:pointer;box-shadow:var(--oc-ombra)}
    ${P} .oc-cifra:active{transform:scale(.94)}
    ${P} .oc-cifra.ok{background:#10b981;border-color:#10b981;color:#fff}
    ${P} .oc-modo{--oc:#64748b;display:flex;align-items:center;gap:22px;width:100%;min-height:130px;padding:30px 26px;border-radius:26px;cursor:pointer;
      text-align:left;background:var(--oc-card);border:3px solid var(--oc-bordo);box-shadow:var(--oc-ombra);transition:transform .3s,box-shadow .3s}
    ${P} .oc-modo:hover{transform:translateY(-3px);box-shadow:var(--oc-ombra-su)}
    ${P} .oc-modo:active{transform:scale(.98)}
    ${P} .oc-modo-ic{display:grid;place-items:center;flex:0 0 auto;width:76px;height:76px;border-radius:24px;background:var(--oc-morbido)}
    ${P} .oc-modo-ic svg{width:40px;height:40px}
    ${P} .oc-modo strong{flex:1;min-width:0;overflow-wrap:anywhere;text-align:left;font-family:'Oswald',system-ui,sans-serif;font-size:32px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;line-height:1}
    ${P} .oc-modo-stato{display:flex;align-items:center;gap:8px;flex:0 0 auto;padding:14px 22px;border-radius:999px;font-size:14px;font-weight:800;
      letter-spacing:1.5px;text-transform:uppercase;white-space:nowrap;color:#94a3b8;background:var(--oc-morbido);border:2px solid var(--oc-bordo)}
    ${P} .oc-modo-stato::before{content:"";width:10px;height:10px;border-radius:50%;background:#94a3b8}
    ${P} .oc-modo[data-acceso="true"]{border-color:var(--oc);background:linear-gradient(135deg,var(--oc-card) 0%,color-mix(in srgb,var(--oc) 8%,var(--oc-card)) 100%);
      box-shadow:0 12px 32px color-mix(in srgb,var(--oc) 25%,transparent)}
    ${P} .oc-modo[data-acceso="true"] .oc-modo-ic{background:linear-gradient(135deg,var(--oc),color-mix(in srgb,var(--oc) 70%,transparent))}
    /* Il nome del modo acceso: il suo colore, ma schiarito o scurito verso il
     * testo — un blu pieno su un fondo blu notte non si leggeva. */
    ${P} .oc-modo[data-acceso="true"] strong{color:color-mix(in srgb,var(--oc) 45%,var(--oc-testo))}
    ${P} .oc-modo[data-acceso="true"] .oc-modo-stato{color:#fff;background:var(--oc);border-color:var(--oc)}
    ${P} .oc-modo[data-acceso="true"] .oc-modo-stato::before{background:#fff}

    ${P} .oc-avviso{position:fixed;bottom:30px;left:50%;z-index:3;transform:translateX(-50%) translateY(20px);padding:14px 24px;border-radius:999px;
      font-size:14px;font-weight:800;letter-spacing:.5px;white-space:nowrap;color:#fff;background:#059669;box-shadow:0 12px 32px rgba(0,0,0,.3);
      opacity:0;pointer-events:none;transition:all .4s cubic-bezier(.165,.84,.44,1)}
    ${P} .oc-avviso[data-tipo="male"]{background:#dc2626}
    ${P} .oc-avviso.visto{opacity:1;transform:translateX(-50%) translateY(0)}

    @media(max-width:768px){
      ${P} .oc-pagina{padding:12px 12px 80px}
      ${P} .oc-testa{padding:16px 18px;border-radius:22px;gap:12px}
      ${P} .oc-testa-ic{width:48px;height:48px;border-radius:16px}
      ${P} .oc-menu{width:44px;height:44px;padding:0 12px;border-radius:14px;gap:4px}
      /* Sul telefono il ☰ prende il posto dell'icona della casa. */
      ${P} .oc-menu + .oc-testa-ic{display:none}
      ${P} .oc-testa-ic svg{width:28px;height:28px}
      ${P} .oc-testa-testo h1{font-size:20px}
      ${P} .oc-testa-testo p{font-size:10px}
      ${P} .oc-pill{font-size:9px;padding:4px 8px}
      ${P} .oc-ora{font-size:10px;padding:4px 8px}
      ${P} .oc-meteo{grid-template-columns:1fr;padding:14px 14px 12px;gap:10px}
      ${P} .oc-meteo-segno{font-size:40px}
      ${P} .oc-meteo-gradi>b{font-size:32px;letter-spacing:-1.4px}
      ${P} .oc-meteo-gradi small{font-size:10.5px}
      ${P} .oc-meteo-misure{grid-template-columns:repeat(auto-fit,minmax(106px,1fr))}
      ${P} .oc-meteo-misure>span{padding:7px 9px;font-size:11px;gap:5px}
      ${P} .oc-meteo-misure i{display:none}
      ${P} .oc-meteo-giorno>span{font-size:19px}
      ${P} .oc-riquadro{padding:22px 12px;border-radius:20px;min-height:120px}
      ${P} .oc-riquadro-ic{width:52px;height:52px;border-radius:16px;margin-bottom:10px}
      ${P} .oc-riquadro-ic svg{width:30px;height:30px}
      ${P} .oc-riquadro strong{font-size:14px;letter-spacing:1px}
      ${P} .oc-riquadro small{font-size:9px;margin-top:4px}
      ${P} .oc-finestra{max-width:96vw;border-radius:22px}
      ${P} .oc-finestra-testa{padding:16px 18px}
      ${P} .oc-finestra-testa h3{font-size:16px}
      ${P} .oc-finestra-corpo{padding:12px 14px 16px}
      ${P} .oc-palco{height:470px;border-radius:22px}
      ${P} .oc-n{width:106px;height:106px;border-width:4px}
      ${P} .oc-n[data-nodo="casa"]{width:136px;height:136px}
      ${P} .oc-n-nome{font-size:9px;letter-spacing:.3px}
      ${P} .oc-n-ic{font-size:19px}
      ${P} .oc-n[data-nodo="casa"] .oc-n-ic{font-size:24px}
      ${P} .oc-n-val{font-size:16px}
      ${P} .oc-n[data-nodo="casa"] .oc-n-val{font-size:20px}
      ${P} .oc-n-doppio{font-size:13px!important}
      ${P} .oc-n-doppio small{font-size:9px}
      ${P} .oc-n-soc{font-size:10px}
      /* Nei periodi i numeri sono due: il disegno si fa piccolo per farli stare. */
      /* Nei periodi i due numeri stanno su una riga, l'unita' sotto. */
      ${P} .oc-n-doppio{flex-direction:row;flex-wrap:wrap;justify-content:center;gap:0 7px;line-height:1.1}
      ${P} .oc-n-doppio small{flex-basis:100%;text-align:center}
      ${P} .oc-n[data-nodo="rete"]{left:21%}
      ${P} .oc-n[data-nodo="batteria"]{left:79%}
      ${P} .oc-linguette-flusso button{padding:9px 14px;font-size:12px}
      ${P} .oc-modi{gap:12px}
      ${P} .oc-modo{padding:20px 16px;border-radius:22px;gap:12px;min-height:100px}
      ${P} .oc-modo-ic{width:52px;height:52px;border-radius:16px}
      ${P} .oc-modo-ic svg{width:28px;height:28px}
      ${P} .oc-modo strong{font-size:20px;letter-spacing:.5px}
      /* Il nome si stringe, la pastiglia dello stato resta intera dentro la scheda. */
      ${P} .oc-modo-stato{padding:9px 12px;font-size:10px;letter-spacing:.5px;gap:6px}
    }
    `,
  );
}

export function installColpoDOcchio() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installaLoStile();
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:state-changed",
    "dashboardmodern:persistence-restored",
  ])
    root.addEventListener?.(evento, ridisegna);
  root.addEventListener?.("storage", ridisegna);
  /* Chiudere il Config rimette la pagina: il Config si apre sopra di lei. */
  for (const nome of ["render", "chiudiEditor", "closeEditor"]) {
    const prima = root[nome];
    if (typeof prima !== "function" || prima.__dmOcchio) continue;
    const avvolta = function (...args) {
      const esito = prima.apply(this, args);
      ridisegna();
      return esito;
    };
    avvolta.__dmOcchio = true;
    avvolta.__dmPrevious = prima;
    root[nome] = avvolta;
  }
  doc.addEventListener?.("keydown", (evento) => {
    if (evento.key === "Escape" && state.finestra) chiudi();
  });
  ridisegna();
  return true;
}

senzaCadere(installColpoDOcchio);
