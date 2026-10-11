/* Le finestre dei widget del gruppo «sicurezza» (vedi `../finestre-dei-widget.js`).
 * Ogni finestra si registra con la chiave della sua tessera.
 *
 * Sicurezza, Telecamere, Varchi, Presenza, Fumo e gas, Allagamenti, Non
 * rispondono, Batterie: otto tessere che rispondono tutte a «la casa e'
 * a posto?». La finestra generica le raccontava allo stesso modo — un verdetto,
 * «Le misure», «Lo stato» — e cioe' diceva tre volte il numero della tessera e
 * mai la cosa che serve: da quanto e' aperta quella porta, chi suona, quale
 * pila cambiare per prima.
 *
 * Qui ognuna dice prima la risposta, in grande, e sotto quello su cui si
 * agisce. Quello che la casa non sa — lo storico della centrale, le
 * registrazioni delle telecamere, l'ultimo stato di un dispositivo sparito —
 * non si inventa: la sua parte non compare.
 */
import { registraFinestra, tastoServizio } from "../finestre-dei-widget.js";
import {
  clean,
  disegnoDiCasa,
  esc,
  locale,
  readJson,
  stanzaDiHomeAssistant,
  t,
} from "../shared.js";
import { iDispositiviRicordati } from "../../core/i-dispositivi-di-home-assistant.js";
import { eUnaBatteria } from "../../core/batterie-di-casa.js";
import {
  CHIAVE_RILEVAMENTI,
  TIPI_RILEVAMENTO,
  normalizzaRilevamenti,
  parolaDelTipo,
  segnoDelTipo,
} from "../../core/rilevamenti-telecamera.js";
import { getLocale } from "../../core/i18n.js";

export const FINESTRE_SICUREZZA = Object.freeze([
  "sicurezza",
  "telecamere",
  "varchi",
  "presenza",
  "fumo",
  "allagamenti",
  "nonrisponde",
  "batterie",
]);

/* Dove stanno le finestre: le regole si scrivono una volta sola. */
const P = ":is(#dm-widget-popup,#dm-casa-popup,#dm-qa-popup)";

/* I toni che non cambiano con la sezione: il verde e' «a posto», il rosso e'
 * «vai a vedere adesso», l'ambra «fra poco». Mescolati con il fondo della
 * carta, cosi' sul tema scuro restano toni e non diventano lampadine. */
const VERDE = "#16a34a";
const ROSSO = "#dc2626";
const AMBRA = "#d97706";

/* ── piccoli attrezzi ─────────────────────────────────────────────────── */

const MINUTO = 60000;

/* Quanto tempo e' passato, corto: «12 min», «3 h», «2 giorni». Il numero
 * sta fuori dalle parole da tradurre. */
function durata(da, adesso = Date.now()) {
  const quando = Number(da);
  if (!Number.isFinite(quando) || quando <= 0) return "";
  const minuti = Math.max(1, Math.round((adesso - quando) / MINUTO));
  if (minuti < 60) return `${minuti} min`;
  const ore = Math.floor(minuti / 60);
  if (ore < 48) return `${ore} h`;
  return `${Math.floor(ore / 24)} ${t("giorni", "days")}`;
}

/* L'ora di un istante: oggi «08:31», ieri «ieri», prima la data corta. */
function ora(da, adesso = Date.now()) {
  const quando = Number(da);
  if (!Number.isFinite(quando) || quando <= 0) return "";
  const giorno = new Date(quando);
  const oggi = new Date(adesso);
  const stessoGiorno = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  const lingua = locale();
  try {
    if (stessoGiorno(giorno, oggi))
      return giorno.toLocaleTimeString(lingua, { hour: "2-digit", minute: "2-digit" });
    const ieri = new Date(adesso - 24 * 60 * MINUTO);
    if (stessoGiorno(giorno, ieri)) return t("ieri", "yesterday");
    return giorno.toLocaleDateString(lingua, { day: "numeric", month: "short" });
  } catch (_errore) {
    return "";
  }
}

const statoDi = (states, entity) => states?.[clean(entity)] || null;

const MUTO = /^(unavailable|unknown|none|)$/;
const tace = (stato) => MUTO.test(clean(stato?.state).toLowerCase());

/* La stanza di Home Assistant, quando la sa; vuoto altrimenti. */
function stanza(entity) {
  try {
    return clean(stanzaDiHomeAssistant(entity));
  } catch (_errore) {
    return "";
  }
}

/* La pila di un rilevatore o di una sonda: la sua, quando l'entita' la porta
 * addosso, oppure quella del suo stesso dispositivo. Se non si trova non si
 * dice niente: un rilevatore senza pila nota non e' un rilevatore «a rete». */
function pilaDi(entity, states) {
  const proprio = Number(statoDi(states, entity)?.attributes?.battery_level);
  if (Number.isFinite(proprio)) return Math.round(proprio);
  let di = {};
  try {
    di = iDispositiviRicordati().di || {};
  } catch (_errore) {
    di = {};
  }
  const suo = clean(di[clean(entity)]);
  if (!suo) return null;
  for (const [id, stato] of Object.entries(states || {})) {
    if (clean(di[id]) !== suo || !eUnaBatteria(stato)) continue;
    const livello = Number(stato?.state);
    if (Number.isFinite(livello)) return Math.round(livello);
  }
  return null;
}

/* Il titoletto di una parte della finestra. */
const titolo = (k, testo, conto = null) =>
  `<h4 class="dm-f-${k}-tit">${esc(testo)}${
    conto == null ? "" : ` <i>${esc(String(conto))}</i>`
  }</h4>`;

/* Le regole comuni, col prefisso della finestra: radice, titoletti, eroe. */
function stileComune(k) {
  return `
${P} .dm-f-${k}{display:grid;gap:9px;min-width:0}
${P} .dm-f-${k} *{box-sizing:border-box}
${P} .dm-f-${k}-tit{display:flex;align-items:center;gap:8px;margin:10px 2px 0;
  font-size:10.5px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:var(--text-dim,#64748b)}
${P} .dm-f-${k}-tit i{font-style:normal;padding:2px 8px;border-radius:999px;letter-spacing:.04em;
  background:color-mix(in srgb,var(--text-dim,#64748b) 14%,transparent);color:var(--text,#0f172a)}
${P} .dm-f-${k}-num{font-family:Oswald,var(--dm-font-display,sans-serif);font-weight:600;font-variant-numeric:tabular-nums}
${P} .dm-f-${k}-eroe{--tono:var(--dm-widget-accent,#0ea5e9);display:flex;align-items:center;gap:14px;
  padding:16px 18px;border-radius:24px;
  background:linear-gradient(155deg,color-mix(in srgb,var(--tono) 13%,var(--card-bg,#fff)),color-mix(in srgb,var(--tono) 6%,var(--card-bg,#fff)));
  border:1px solid color-mix(in srgb,var(--tono) 30%,transparent)}
${P} .dm-f-${k}-eroe[data-tono="ok"]{--tono:${VERDE}}
${P} .dm-f-${k}-eroe[data-tono="allarme"]{--tono:${ROSSO}}
${P} .dm-f-${k}-eroe[data-tono="ambra"]{--tono:${AMBRA}}
${P} .dm-f-${k}-eroe[data-tono="spento"]{--tono:#64748b}
${P} .dm-f-${k}-eroe > .dm-f-${k}-num{font-size:54px;line-height:1;color:color-mix(in srgb,var(--tono) 78%,var(--text,#0f172a))}
${P} .dm-f-${k}-eroe b{display:block;font-size:17px;font-weight:850;line-height:1.2;color:color-mix(in srgb,var(--tono) 60%,var(--text,#0f172a))}
${P} .dm-f-${k}-eroe span.dm-f-${k}-sotto{display:block;margin-top:3px;font-size:12.5px;font-weight:750;color:var(--text-dim,#64748b)}
${P} .dm-f-${k}-segno{flex:0 0 66px;width:66px;height:66px;border-radius:22px;display:grid;place-items:center;font-size:32px;
  background:var(--card-bg,#fff);box-shadow:0 0 0 6px color-mix(in srgb,var(--tono) 14%,transparent)}
${P} .dm-f-${k}-segno svg{width:34px;height:34px}
${P} .dm-f-${k}-muto{display:flex;align-items:center;gap:11px;padding:10px 12px;border-radius:16px;min-width:0;
  border:1px dashed color-mix(in srgb,var(--text-dim,#64748b) 45%,transparent);color:var(--text-dim,#64748b);font-size:13px;font-weight:800}
${P} .dm-f-${k}-muto > b{flex:1;min-width:0;font-weight:800;overflow-wrap:anywhere}
${P} .dm-f-${k}-muto > small{margin-left:auto;flex:none;font-size:11px;font-weight:900;letter-spacing:.06em;text-transform:uppercase}
${P} .dm-f-${k}-muto .dm-f-${k}-ic{display:grid;place-items:center;flex:none;width:22px;height:22px;opacity:.7}
${P} .dm-f-${k}-muto .dm-f-${k}-ic svg{width:20px;height:20px}`;
}

/* La spunta dell'eroe quando va tutto bene. */
const SPUNTA = `<svg viewBox="0 0 24 24" fill="none" stroke="${VERDE}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;

/* ── Sicurezza: l'antifurto ───────────────────────────────────────────── */

function disegnaSicurezza(widget) {
  const k = "sicurezza";
  const modi = Array.isArray(widget.modi) ? widget.modi : [];
  const attivo = modi.find((voce) => voce.on && voce.mode !== "disarm");
  const tono = widget.triggered ? "allarme" : widget.armed ? "ok" : "spento";
  const segno = widget.triggered ? "🚨" : widget.armed ? "🔒" : "🔓";
  const sotto = [
    attivo?.label ? `${t("Modo", "Mode")} ${attivo.label}` : "",
    widget.dalle ? `${t("dalle", "since")} ${ora(widget.dalle)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const eroe = `<div class="dm-f-${k}-eroe" data-tono="${tono}">
      <span class="dm-f-${k}-segno" aria-hidden="true">${segno}</span>
      <div><small class="dm-f-${k}-cosa">${esc(t("Antifurto", "Alarm"))}</small>
        <span class="dm-f-${k}-num dm-f-${k}-stato">${esc(widget.value)}</span>
        ${sotto ? `<span class="dm-f-${k}-sotto">${esc(sotto)}</span>` : ""}</div>
    </div>`;

  /* Da sapere prima di inserire: quello che e' aperto, e quello che
   * l'antifurto non sta guardando. */
  const avvisi = (Array.isArray(widget.daSapere) ? widget.daSapere : [])
    .map((riga) => {
      const aperto = riga.stato === "aperto";
      const cosa = [
        parolaDelTipo2(riga),
        aperto ? t("aperta", "open") : "",
        riga.escluso ? t("esclusa dall'antifurto", "bypassed by the alarm") : "",
      ]
        .filter(Boolean)
        .join(" · ");
      const quanto = aperto ? durata(riga.da) : "";
      return `<div class="dm-f-${k}-avviso" data-tono="${aperto ? "allarme" : "ambra"}">
          <span class="dm-f-${k}-ic" aria-hidden="true">${disegnoDiCasa(riga.glyph, { misura: 20, ripiego: "door" })}</span>
          <div><b>${esc(riga.name)}</b><span>${esc(cosa)}</span></div>
          ${quanto ? `<i>${esc(t("da", "for"))} ${esc(quanto)}</i>` : ""}
        </div>`;
    })
    .join("");

  /* I modi: schede grandi, con nome e spiegazione. Il tasto porta lo stesso
   * `data-dm-w-alarm` di sempre, cioe' lo stesso tastierino del codice della
   * pagina Sicurezza. */
  const inserimenti = modi.filter((voce) => voce.mode !== "disarm");
  const spegni = modi.find((voce) => voce.mode === "disarm");
  const scheda = (
    voce,
  ) => `<button type="button" class="dm-f-${k}-modo" data-dm-w-alarm="${esc(voce.service)}"
      data-on="${voce.on ? "true" : "false"}" aria-pressed="${voce.on ? "true" : "false"}">
      <span class="dm-f-${k}-ic" aria-hidden="true">${voce.disegno || ""}</span>
      <span class="dm-f-${k}-testo"><b>${esc(voce.label)}</b><small>${esc(
        voce.on ? t("Attivo", "Active") : voce.hint,
      )}</small></span>
    </button>`;
  const modiMarkup = inserimenti.length
    ? `${titolo(k, t("Cambia modo", "Change mode"))}
      <div class="dm-f-${k}-modi">${inserimenti.map(scheda).join("")}</div>`
    : "";
  const spegniMarkup =
    spegni && (widget.armed || widget.triggered)
      ? `<button type="button" class="dm-f-${k}-spegni" data-dm-w-alarm="${esc(spegni.service)}">
        <span class="dm-f-${k}-ic" aria-hidden="true">${spegni.disegno || "🔓"}</span>
        <span class="dm-f-${k}-testo"><b>${esc(t("Disinserisci", "Disarm"))}</b><small>${esc(
          spegni.codice
            ? t("Chiede il codice", "Asks for the code")
            : t("Senza codice", "No code needed"),
        )}</small></span>
      </button>`
      : "";

  return `<div class="dm-f-${k}">
      ${eroe}
      ${avvisi ? `${titolo(k, t("Da sapere", "Good to know"))}${avvisi}` : ""}
      ${modiMarkup}
      ${spegniMarkup}
    </div>`;
}

const STILE_SICUREZZA = `${stileComune("sicurezza")}
${P} .dm-f-sicurezza-eroe{padding:18px}
${P} .dm-f-sicurezza-eroe .dm-f-sicurezza-segno{flex-basis:76px;width:76px;height:76px;border-radius:24px;font-size:38px}
${P} .dm-f-sicurezza-cosa{display:block;font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;
  color:color-mix(in srgb,var(--tono) 75%,var(--text,#0f172a))}
${P} .dm-f-sicurezza-stato{display:block;font-size:38px;line-height:1.05;color:color-mix(in srgb,var(--tono) 70%,var(--text,#0f172a))}
${P} .dm-f-sicurezza-avviso{--tono:${ROSSO};display:flex;align-items:center;gap:11px;padding:12px 13px;border-radius:18px;
  background:color-mix(in srgb,var(--tono) 9%,var(--card-bg,#fff));border:1px solid color-mix(in srgb,var(--tono) 32%,transparent)}
${P} .dm-f-sicurezza-avviso[data-tono="ambra"]{--tono:${AMBRA}}
${P} .dm-f-sicurezza-avviso .dm-f-sicurezza-ic{flex:none;display:grid;place-items:center;width:24px;height:24px;color:var(--tono)}
${P} .dm-f-sicurezza-avviso > div{flex:1;min-width:0}
${P} .dm-f-sicurezza-avviso b{display:block;font-size:13.5px;font-weight:850;color:color-mix(in srgb,var(--tono) 70%,var(--text,#0f172a));overflow-wrap:anywhere}
${P} .dm-f-sicurezza-avviso span{display:block;font-size:12px;font-weight:700;color:var(--text-dim,#64748b)}
${P} .dm-f-sicurezza-avviso i{flex:none;font-style:normal;font-size:12px;font-weight:900;color:var(--tono);white-space:nowrap}
${P} .dm-f-sicurezza-modi{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:9px}
${P} .dm-f-sicurezza-modo,${P} .dm-f-sicurezza-spegni{font:inherit;color:inherit;text-align:left;cursor:pointer;
  display:flex;align-items:center;gap:11px;min-height:66px;min-width:0;padding:12px 13px;border-radius:20px;
  background:var(--card-bg,#fff);border:1px solid var(--card-border,#e8edf3);box-shadow:0 10px 22px -22px rgba(15,23,42,.6);
  transition:transform .15s ease,border-color .15s ease}
${P} .dm-f-sicurezza-modo:active,${P} .dm-f-sicurezza-spegni:active{transform:scale(.98)}
${P} .dm-f-sicurezza-modo .dm-f-sicurezza-ic,${P} .dm-f-sicurezza-spegni .dm-f-sicurezza-ic{flex:none;width:40px;height:40px;border-radius:13px;
  display:grid;place-items:center;font-size:19px;background:color-mix(in srgb,var(--text-dim,#64748b) 9%,var(--card-bg,#fff))}
${P} .dm-f-sicurezza-testo{min-width:0}
${P} .dm-f-sicurezza-testo b{display:block;font-size:14.5px;font-weight:850;line-height:1.2}
${P} .dm-f-sicurezza-testo small{display:block;margin-top:1px;font-size:11.5px;font-weight:750;color:var(--text-dim,#64748b)}
${P} .dm-f-sicurezza-modo[data-on="true"]{border-color:color-mix(in srgb,${VERDE} 55%,transparent);
  background:color-mix(in srgb,${VERDE} 9%,var(--card-bg,#fff));box-shadow:inset 0 0 0 2px color-mix(in srgb,${VERDE} 75%,transparent)}
${P} .dm-f-sicurezza-modo[data-on="true"] .dm-f-sicurezza-ic{background:color-mix(in srgb,${VERDE} 18%,var(--card-bg,#fff));color:${VERDE}}
${P} .dm-f-sicurezza-modo[data-on="true"] small{color:${VERDE}}
${P} .dm-f-sicurezza-spegni{justify-content:center;min-height:56px;margin-top:2px;background:#0f172a;border-color:#0f172a;color:#fff}
${P} .dm-f-sicurezza-spegni .dm-f-sicurezza-ic{width:34px;height:34px;background:rgba(255,255,255,.12);color:#fff}
${P} .dm-f-sicurezza-spegni small{color:#cbd5e1}
html[data-theme="dark"] ${P} .dm-f-sicurezza-spegni{background:#f8fafc;border-color:#f8fafc;color:#0f172a}
html[data-theme="dark"] ${P} .dm-f-sicurezza-spegni .dm-f-sicurezza-ic{background:rgba(15,23,42,.08);color:#0f172a}
html[data-theme="dark"] ${P} .dm-f-sicurezza-spegni small{color:#475569}`;

/* ── Telecamere ───────────────────────────────────────────────────────── */

/* L'ultimo rilevamento di ogni telecamera, acceso o gia' spento: e' la riga
 * «movimento 06:58» sotto la miniatura. Solo per chi i sensori li ha. */
function ultimiRilevamenti(states) {
  let scelte = {};
  try {
    scelte = normalizzaRilevamenti(readJson(CHIAVE_RILEVAMENTI, {}));
  } catch (_errore) {
    scelte = {};
  }
  const ultimi = new Map();
  for (const [camera, voci] of Object.entries(scelte)) {
    let migliore = null;
    for (const tipo of TIPI_RILEVAMENTO) {
      const stato = statoDi(states, voci[tipo]);
      if (!stato || tace(stato)) continue;
      const quando = Date.parse(clean(stato.last_changed) || clean(stato.last_updated) || "");
      if (!Number.isFinite(quando)) continue;
      const acceso = clean(stato.state).toLowerCase() === "on";
      if (
        !migliore ||
        (acceso && !migliore.acceso) ||
        (acceso === migliore.acceso && quando > migliore.quando)
      )
        migliore = { tipo, quando, acceso };
    }
    ultimi.set(camera, { conSensori: true, ...(migliore || {}) });
  }
  return ultimi;
}

function disegnaTelecamere(widget, states) {
  const k = "telecamere";
  const righe = Array.isArray(widget.rows) ? widget.rows : [];
  if (!righe.length) return "";
  const locale = getLocale();
  const ultimi = ultimiRilevamenti(states);
  const visto = Array.isArray(widget.visti) && widget.visti.length ? widget.visti[0] : null;
  /* La telecamera piu' interessante: quella che vede qualcosa adesso, poi
   * quella dell'ultimo rilevamento, altrimenti la prima. */
  const recente = [...ultimi.entries()]
    .filter(([camera, voce]) => voce.quando && righe.some((riga) => riga.entity === camera))
    .sort((a, b) => b[1].quando - a[1].quando)[0];
  const principale =
    righe.find((riga) => visto && riga.entity === visto.camera) ||
    righe.find((riga) => recente && riga.entity === recente[0]) ||
    righe[0];
  const apre = typeof globalThis.apriCamera === "function";
  const attributiApre = (riga) =>
    apre
      ? ` data-dm-w-apri-cam="${esc(riga.entity)}" role="button" tabindex="0" aria-label="${esc(
          `${t("Apri dal vivo", "Open live")}: ${riga.name}`,
        )}"`
      : "";

  const grande = `<figure class="dm-f-${k}-big" data-dm-w-cam="${esc(principale.entity)}"${attributiApre(principale)}>
      <img alt="" decoding="async" data-dm-camera-state="loading">
      <span class="dm-f-${k}-tag"><i aria-hidden="true"></i>${esc(t("Dal vivo", "Live"))}</span>
      <figcaption class="dm-f-${k}-giu"><b>${esc(principale.name)}</b></figcaption>
    </figure>`;

  /* La fascia del rilevamento: rossa se sta succedendo adesso, ambra se e'
   * l'ultimo visto. Senza sensori non c'e'. */
  let fascia = "";
  if (visto) {
    fascia = `<div class="dm-f-${k}-rileva" data-ora="true"><span aria-hidden="true">${esc(visto.segno)}</span>
        <b>${esc(visto.parola)} · ${esc(visto.nome)}</b><span class="dm-f-${k}-num">${esc(ora(visto.quando))}</span></div>`;
  } else if (recente) {
    const [camera, voce] = recente;
    const nome = righe.find((riga) => riga.entity === camera)?.name || camera;
    fascia = `<div class="dm-f-${k}-rileva"><span aria-hidden="true">${esc(segnoDelTipo(voce.tipo))}</span>
        <b>${esc(parolaDelTipo(voce.tipo, locale))} · ${esc(nome)}</b><span class="dm-f-${k}-num">${esc(ora(voce.quando))}</span></div>`;
  }

  const altre = righe.filter((riga) => riga !== principale);
  const mini = (riga) => {
    const voce = ultimi.get(riga.entity);
    const sotto = !voce
      ? ""
      : voce.acceso
        ? `${parolaDelTipo(voce.tipo, locale)} · ${t("adesso", "now")}`
        : voce.quando
          ? `${parolaDelTipo(voce.tipo, locale)} ${ora(voce.quando)}`
          : t("nessun movimento", "no motion");
    return `<figure class="dm-f-${k}-mini" data-dm-w-cam="${esc(riga.entity)}"${attributiApre(riga)}>
        <img alt="" decoding="async" data-dm-camera-state="loading">
        <figcaption class="dm-f-${k}-giu"><b>${esc(riga.name)}</b>${
          sotto ? `<span>${esc(sotto)}</span>` : ""
        }</figcaption>
      </figure>`;
  };

  const azioni = apre
    ? `<div class="dm-f-${k}-azioni"><button type="button" class="dm-f-${k}-az" data-dm-w-apri-cam="${esc(principale.entity)}">
        <span aria-hidden="true">⛶</span> ${esc(t("Tutto schermo", "Full screen"))}</button></div>`
    : "";

  return `<div class="dm-f-${k}">
      ${grande}
      ${fascia}
      ${altre.length ? `${titolo(k, t("Le altre", "The others"))}<div class="dm-f-${k}-griglia">${altre.map(mini).join("")}</div>` : ""}
      ${azioni}
    </div>`;
}

const STILE_TELECAMERE = `${stileComune("telecamere")}
${P} .dm-f-telecamere-big,${P} .dm-f-telecamere-mini{position:relative;margin:0;overflow:hidden;background:#0b1220;min-width:0}
${P} .dm-f-telecamere-big{border-radius:22px;aspect-ratio:16/10}
${P} .dm-f-telecamere-mini{border-radius:18px;aspect-ratio:16/11}
${P} .dm-f-telecamere-big[data-dm-w-apri-cam],${P} .dm-f-telecamere-mini[data-dm-w-apri-cam]{cursor:pointer}
${P} .dm-f-telecamere-big img,${P} .dm-f-telecamere-mini img{display:block;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .3s ease}
${P} .dm-f-telecamere-big img[data-dm-camera-state="ready"],${P} .dm-f-telecamere-mini img[data-dm-camera-state="ready"]{opacity:1}
${P} .dm-f-telecamere-tag{position:absolute;left:12px;top:12px;display:inline-flex;align-items:center;gap:6px;padding:6px 10px;
  border-radius:999px;background:rgba(15,23,42,.62);color:#fff;font-size:11px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;
  -webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
${P} .dm-f-telecamere-tag i{width:7px;height:7px;border-radius:50%;background:#ef4444;box-shadow:0 0 0 3px rgba(239,68,68,.3)}
${P} .dm-f-telecamere-giu{position:absolute;left:0;right:0;bottom:0;margin:0;padding:26px 14px 11px;color:#fff;
  background:linear-gradient(transparent,rgba(2,6,23,.8));display:flex;flex-direction:column;gap:1px}
${P} .dm-f-telecamere-giu b{font-family:Oswald,var(--dm-font-display,sans-serif);font-weight:600;font-size:21px;letter-spacing:.02em;
  line-height:1.1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${P} .dm-f-telecamere-mini .dm-f-telecamere-giu{padding:20px 11px 8px}
${P} .dm-f-telecamere-mini .dm-f-telecamere-giu b{font-size:15px}
${P} .dm-f-telecamere-giu span{font-size:10.5px;font-weight:800;opacity:.9;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${P} .dm-f-telecamere-rileva{--tono:${AMBRA};display:flex;align-items:center;gap:10px;padding:11px 13px;border-radius:16px;
  background:color-mix(in srgb,var(--tono) 10%,var(--card-bg,#fff));border:1px solid color-mix(in srgb,var(--tono) 35%,transparent);
  font-size:13px;color:color-mix(in srgb,var(--tono) 70%,var(--text,#0f172a))}
${P} .dm-f-telecamere-rileva[data-ora="true"]{--tono:${ROSSO}}
${P} .dm-f-telecamere-rileva b{flex:1;min-width:0;font-weight:800}
${P} .dm-f-telecamere-rileva .dm-f-telecamere-num{flex:none;font-size:16px}
${P} .dm-f-telecamere-griglia{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:9px}
${P} .dm-f-telecamere-azioni{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:9px;margin-top:4px}
${P} .dm-f-telecamere-az{font:inherit;cursor:pointer;padding:13px;border-radius:16px;text-align:center;font-size:13px;font-weight:850;
  color:var(--text,#334155);background:color-mix(in srgb,var(--text-dim,#64748b) 8%,var(--card-bg,#fff));border:1px solid var(--card-border,#eef2f7)}`;

/* ── Varchi ───────────────────────────────────────────────────────────── */

const icona = (riga, ripiego) =>
  `<span class="dm-f-ic-varco" aria-hidden="true">${disegnoDiCasa(riga.glyph, { misura: 22, ripiego })}</span>`;

function parolaDelTipo2(riga) {
  if (riga.tipo === "finestra") return t("Finestra", "Window");
  return t("Porta", "Door");
}

function disegnaVarchi(widget) {
  const k = "varchi";
  const righe = Array.isArray(widget.rows) ? widget.rows : [];
  const aperti = righe.filter((riga) => riga.stato === "aperto");
  const muti = righe.filter((riga) => !clean(riga.stato));
  const chiusi = righe.filter((riga) => riga.stato === "chiuso");
  const sotto = [
    chiusi.length
      ? `${chiusi.length} ${chiusi.length === 1 ? t("chiuso", "closed") : t("chiusi", "closed")}`
      : "",
    muti.length
      ? `${muti.length} ${muti.length === 1 ? t("non risponde", "not answering") : t("non rispondono", "not answering")}`
      : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const eroe = `<div class="dm-f-${k}-eroe" data-tono="${aperti.length ? "allarme" : "ok"}">
      <span class="dm-f-${k}-num">${aperti.length}</span>
      <div><b>${esc(
        aperti.length
          ? aperti.length === 1
            ? t("aperto adesso", "open now")
            : t("aperti adesso", "open now")
          : t("tutto chiuso", "all closed"),
      )}</b>${sotto ? `<span class="dm-f-${k}-sotto">${esc(sotto)}</span>` : ""}</div>
    </div>`;
  const aperto = (riga) => {
    const quanto = durata(riga.da);
    return `<div class="dm-f-${k}-aperto">
        <span class="dm-f-${k}-ic">${icona(riga, "door")}</span>
        <div class="dm-f-${k}-nome"><b>${esc(riga.name)}</b><span>${esc(parolaDelTipo2(riga))} · ${esc(
          t("aperta", "open"),
        )}${riga.escluso ? ` · ${esc(t("esclusa", "bypassed"))}` : ""}</span></div>
        ${
          quanto
            ? `<div class="dm-f-${k}-da"><small>${esc(t("da", "for"))}</small><span class="dm-f-${k}-num">${esc(quanto)}</span></div>`
            : ""
        }
      </div>`;
  };
  const chiuso = (riga) => `<div class="dm-f-${k}-ch"${riga.escluso ? ' data-escluso="true"' : ""}>
      <span class="dm-f-${k}-ic">${icona(riga, "door")}</span><b>${esc(riga.name)}</b>${
        riga.escluso ? `<small>${esc(t("esclusa", "bypassed"))}</small>` : ""
      }<i aria-hidden="true"></i></div>`;
  const muto = (riga) => {
    const quanto = durata(riga.da);
    return `<div class="dm-f-${k}-muto"><span class="dm-f-${k}-ic">${icona(riga, "door")}</span><b>${esc(
      riga.name,
    )}</b>${quanto ? `<small>${esc(t("da", "for"))} ${esc(quanto)}</small>` : ""}</div>`;
  };
  return `<div class="dm-f-${k}">
      ${eroe}
      ${aperti.length ? `${titolo(k, t("Aperti", "Open"))}${aperti.map(aperto).join("")}` : ""}
      ${chiusi.length ? `${titolo(k, t("Chiusi", "Closed"))}<div class="dm-f-${k}-chiusi">${chiusi.map(chiuso).join("")}</div>` : ""}
      ${muti.length ? `${titolo(k, muti.length === 1 ? t("Non risponde", "Not answering") : t("Non rispondono", "Not answering"))}${muti.map(muto).join("")}` : ""}
    </div>`;
}

const STILE_VARCHI = `${stileComune("varchi")}
${P} .dm-f-varchi .dm-f-ic-varco{display:grid;place-items:center}
${P} .dm-f-varchi .dm-f-ic-varco svg{width:22px;height:22px}
${P} .dm-f-varchi-aperto{display:flex;align-items:center;gap:12px;padding:12px;border-radius:18px;min-width:0;
  background:color-mix(in srgb,${ROSSO} 5%,var(--card-bg,#fff));border:1px solid color-mix(in srgb,${ROSSO} 35%,transparent)}
${P} .dm-f-varchi-aperto .dm-f-varchi-ic{flex:none;width:42px;height:42px;border-radius:14px;display:grid;place-items:center;
  color:${ROSSO};background:color-mix(in srgb,${ROSSO} 11%,var(--card-bg,#fff))}
${P} .dm-f-varchi-nome{flex:1;min-width:0}
${P} .dm-f-varchi-nome b{display:block;font-size:14.5px;font-weight:850;overflow-wrap:anywhere}
${P} .dm-f-varchi-nome span{display:block;margin-top:1px;font-size:12px;font-weight:750;color:color-mix(in srgb,${ROSSO} 80%,var(--text,#0f172a))}
${P} .dm-f-varchi-da{flex:none;text-align:right;display:flex;flex-direction:column;align-items:flex-end}
${P} .dm-f-varchi-da .dm-f-varchi-num{font-size:20px;line-height:1}
${P} .dm-f-varchi-da small{font-size:10.5px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--text-dim,#64748b)}
${P} .dm-f-varchi-chiusi{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
${P} .dm-f-varchi-ch{display:flex;align-items:center;gap:9px;padding:10px 11px;border-radius:16px;min-width:0;
  background:color-mix(in srgb,var(--text-dim,#64748b) 6%,var(--card-bg,#fff));border:1px solid var(--card-border,#eef2f7)}
${P} .dm-f-varchi-ch .dm-f-varchi-ic{flex:none;color:var(--dm-widget-accent,#0f766e)}
${P} .dm-f-varchi-ch b{flex:1;min-width:0;font-size:13px;font-weight:800;line-height:1.2;overflow-wrap:anywhere}
${P} .dm-f-varchi-ch small{flex:none;font-size:9.5px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;color:${AMBRA}}
${P} .dm-f-varchi-ch i{flex:0 0 8px;width:8px;height:8px;border-radius:50%;background:${VERDE}}
${P} .dm-f-varchi-ch[data-escluso="true"] i{background:${AMBRA}}`;

/* ── Presenza ─────────────────────────────────────────────────────────── */

function disegnaPresenza(widget) {
  const k = "presenza";
  const righe = Array.isArray(widget.rows) ? widget.rows : [];
  /* Per posto, come il conto della tessera: due rilevatori nella stessa
   * stanza sono una stanza. */
  const posti = new Map();
  for (const riga of righe) {
    const nome = clean(riga.stanza) || clean(riga.name);
    const chiave = (clean(riga.stanza) ? `s:${nome}` : `n:${nome}`).toLocaleLowerCase();
    const posto = posti.get(chiave) || { nome, righe: [] };
    posto.righe.push(riga);
    posti.set(chiave, posto);
  }
  const letti = [...posti.values()].map((posto) => {
    const attive = posto.righe.filter((riga) => riga.stato === "attivo");
    const libere = posto.righe.filter((riga) => riga.stato === "libero");
    const stato = attive.length ? "attivo" : libere.length ? "libero" : "";
    const quelle = attive.length ? attive : libere.length ? libere : posto.righe;
    /* Occupato da quando il primo si e' acceso; libero da quando l'ultimo si
     * e' spento. */
    const istanti = quelle
      .map((riga) => Number(riga.da))
      .filter((da) => Number.isFinite(da) && da > 0);
    const da = istanti.length
      ? attive.length
        ? Math.min(...istanti)
        : Math.max(...istanti)
      : null;
    return {
      nome: posto.nome,
      stato,
      da,
      stabile: quelle.some((riga) => riga.stabile),
      glyph: (attive[0] || posto.righe[0])?.glyph || "",
    };
  });
  const occupati = letti.filter((posto) => posto.stato === "attivo");
  const liberi = letti.filter((posto) => posto.stato === "libero");
  const muti = letti.filter((posto) => !posto.stato);
  const ultimo = Math.max(
    0,
    ...righe
      .filter((riga) => riga.stato === "attivo" || riga.stato === "libero")
      .map((riga) => Number(riga.da) || 0),
  );
  const frase = [
    occupati.map((posto) => posto.nome).join(" · "),
    ultimo ? `${t("ultimo movimento", "last motion")} ${durata(ultimo)} ${t("fa", "ago")}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const eroe = `<div class="dm-f-${k}-eroe">
      <div><small class="dm-f-${k}-cosa">${esc(t("Adesso", "Now"))}</small>
        <div class="dm-f-${k}-riga"><span class="dm-f-${k}-num">${occupati.length}</span><b>${esc(
          occupati.length === 1
            ? t("stanza occupata", "room occupied")
            : occupati.length
              ? t("stanze occupate", "rooms occupied")
              : t("casa libera", "nobody around"),
        )}</b></div>
        ${frase ? `<p>${esc(frase)}</p>` : ""}</div>
    </div>`;
  const piastrella = (posto) => {
    const quanto = durata(posto.da);
    const testo =
      posto.stato === "attivo"
        ? posto.stabile
          ? quanto
            ? `${t("Occupato da", "Occupied for")} ${quanto}`
            : t("Occupato", "Occupied")
          : t("Movimento adesso", "Motion now")
        : quanto
          ? `${t("Libero da", "Free for")} ${quanto}`
          : t("Libero", "Free");
    return `<div class="dm-f-${k}-st" data-on="${posto.stato === "attivo" ? "true" : "false"}">
        <span class="dm-f-${k}-ic" aria-hidden="true">${posto.glyph}</span>
        <b>${esc(posto.nome)}</b>
        <span class="dm-f-${k}-come">${posto.stato === "attivo" ? '<i aria-hidden="true"></i>' : ""}${esc(testo)}</span>
      </div>`;
  };
  const muto = (posto) => {
    const quanto = durata(posto.da);
    return `<div class="dm-f-${k}-muto"><span class="dm-f-${k}-ic" aria-hidden="true">${posto.glyph}</span><b>${esc(
      posto.nome,
    )}</b>${quanto ? `<small>${esc(t("da", "for"))} ${esc(quanto)}</small>` : ""}</div>`;
  };
  const stanze = [...occupati, ...liberi];
  return `<div class="dm-f-${k}">
      ${eroe}
      ${stanze.length ? `${titolo(k, t("Le stanze", "The rooms"))}<div class="dm-f-${k}-casa">${stanze.map(piastrella).join("")}</div>` : ""}
      ${muti.length ? `${titolo(k, muti.length === 1 ? t("Non risponde", "Not answering") : t("Non rispondono", "Not answering"))}${muti.map(muto).join("")}` : ""}
    </div>`;
}

const STILE_PRESENZA = `${stileComune("presenza")}
${P} .dm-f-presenza-eroe{display:block}
${P} .dm-f-presenza-cosa{font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;
  color:color-mix(in srgb,var(--tono) 75%,var(--text,#0f172a))}
${P} .dm-f-presenza-riga{display:flex;align-items:baseline;gap:10px;margin-top:2px}
${P} .dm-f-presenza-riga .dm-f-presenza-num{font-size:52px;line-height:1;color:color-mix(in srgb,var(--tono) 70%,var(--text,#0f172a))}
${P} .dm-f-presenza-eroe p{margin:6px 0 0;font-size:13px;font-weight:750;color:color-mix(in srgb,var(--tono) 55%,var(--text,#0f172a))}
${P} .dm-f-presenza-casa{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:9px}
${P} .dm-f-presenza-st{display:flex;flex-direction:column;min-height:96px;min-width:0;padding:13px;border-radius:20px;
  background:color-mix(in srgb,var(--text-dim,#64748b) 6%,var(--card-bg,#fff));border:1px solid var(--card-border,#eef2f7)}
${P} .dm-f-presenza-st .dm-f-presenza-ic{display:grid;place-items:start;opacity:.75;color:var(--text-dim,#64748b)}
${P} .dm-f-presenza-st .dm-f-presenza-ic svg{width:22px;height:22px}
${P} .dm-f-presenza-st b{margin-top:8px;font-size:14.5px;font-weight:850;line-height:1.2;color:var(--text-dim,#475569);overflow-wrap:anywhere}
${P} .dm-f-presenza-come{display:inline-flex;align-items:center;gap:6px;margin-top:2px;font-size:12px;font-weight:750;color:var(--text-dim,#94a3b8)}
${P} .dm-f-presenza-come i{flex:none;width:8px;height:8px;border-radius:50%;background:var(--dm-widget-accent,#7c3aed);
  box-shadow:0 0 0 4px color-mix(in srgb,var(--dm-widget-accent,#7c3aed) 22%,transparent)}
${P} .dm-f-presenza-st[data-on="true"]{background:var(--card-bg,#fff);border-color:color-mix(in srgb,var(--dm-widget-accent,#7c3aed) 45%,transparent);
  box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--dm-widget-accent,#7c3aed) 60%,transparent),0 14px 26px -22px color-mix(in srgb,var(--dm-widget-accent,#7c3aed) 90%,transparent)}
${P} .dm-f-presenza-st[data-on="true"] .dm-f-presenza-ic{opacity:1;color:var(--dm-widget-accent,#7c3aed)}
${P} .dm-f-presenza-st[data-on="true"] b{color:var(--text,#0f172a)}
${P} .dm-f-presenza-st[data-on="true"] .dm-f-presenza-come{color:color-mix(in srgb,var(--dm-widget-accent,#7c3aed) 80%,var(--text,#0f172a))}`;

/* ── Fumo e gas ───────────────────────────────────────────────────────── */

const GAS = new Set(["gas", "carbon_monoxide"]);

function disegnaFumo(widget, states) {
  const k = "fumo";
  const righe = (Array.isArray(widget.rows) ? widget.rows : []).map((riga) => {
    const stato = statoDi(states, riga.entity);
    return {
      ...riga,
      classe: clean(stato?.attributes?.device_class).toLowerCase(),
      muto: !riga.on && tace(stato),
      stanza: stanza(riga.entity),
      pila: pilaDi(riga.entity, states),
    };
  });
  const suonano = righe.filter((riga) => riga.on);
  const muti = righe.filter((riga) => riga.muto);
  const sotto = muti.length
    ? `${muti.length} ${muti.length === 1 ? t("non risponde", "not answering") : t("non rispondono", "not answering")}`
    : `${t("Rispondono tutti", "All answering")} · ${righe.length}`;
  const eroe = suonano.length
    ? `<div class="dm-f-${k}-eroe" data-tono="allarme"><span class="dm-f-${k}-segno" aria-hidden="true">🚨</span>
        <div><b>${esc(t("Allarme", "Alarm"))}: ${esc(suonano.map((riga) => riga.name).join(" · "))}</b>
        <span class="dm-f-${k}-sotto">${esc(sotto)}</span></div></div>`
    : `<div class="dm-f-${k}-eroe" data-tono="${muti.length ? "ambra" : "ok"}"><span class="dm-f-${k}-segno" aria-hidden="true">${
        muti.length ? "⚠️" : SPUNTA
      }</span>
        <div><b>${esc(t("Nessun allarme", "No alarm"))}</b><span class="dm-f-${k}-sotto">${esc(sotto)}</span></div></div>`;
  const riga = (voce) => {
    const segno = voce.classe === "carbon_monoxide" ? "♨️" : voce.classe === "gas" ? "🔥" : "💨";
    const come = voce.on
      ? t("Allarme", "Alarm")
      : voce.muto
        ? t("Non risponde", "Not answering")
        : t("Tranquillo", "Quiet");
    const dove =
      voce.stanza && !voce.name.toLocaleLowerCase().includes(voce.stanza.toLocaleLowerCase())
        ? voce.stanza
        : "";
    const pila =
      voce.pila == null
        ? ""
        : `<span class="dm-f-${k}-pila"${voce.pila <= 20 ? ' data-bassa="true"' : ""}>${voce.pila <= 20 ? "🪫" : "🔋"} ${voce.pila}%</span>`;
    return `<div class="dm-f-${k}-ril" data-come="${voce.on ? "allarme" : voce.muto ? "muto" : "quiete"}">
        <span class="dm-f-${k}-ic" aria-hidden="true">${segno}</span>
        <div class="dm-f-${k}-nome"><b>${esc(voce.name)}</b><span>${esc(come)}${dove ? ` · ${esc(dove)}` : ""}</span></div>
        ${pila}
      </div>`;
  };
  const fumo = righe.filter((voce) => !GAS.has(voce.classe));
  const gas = righe.filter((voce) => GAS.has(voce.classe));
  const gruppo = (nome, elenco) =>
    elenco.length ? `${titolo(k, nome, elenco.length)}${elenco.map(riga).join("")}` : "";
  return `<div class="dm-f-${k}">
      ${eroe}
      ${gruppo(t("Fumo", "Smoke"), fumo)}
      ${gruppo(t("Gas e monossido", "Gas and carbon monoxide"), gas)}
      <p class="dm-f-${k}-nota">${esc(
        t(
          "Se uno suona, la sua riga sale in cima in rosso e la tessera in Home lampeggia.",
          "If one goes off, its row moves to the top in red and the Home tile flashes.",
        ),
      )}</p>
    </div>`;
}

const STILE_FUMO = `${stileComune("fumo")}
${P} .dm-f-fumo-eroe b{font-size:20px;overflow-wrap:anywhere}
${P} .dm-f-fumo-ril{display:flex;align-items:center;gap:12px;padding:11px 12px;border-radius:18px;min-width:0;
  background:var(--card-bg,#fff);border:1px solid var(--card-border,#eef2f7);box-shadow:0 10px 22px -22px rgba(15,23,42,.6)}
${P} .dm-f-fumo-ril .dm-f-fumo-ic{flex:none;width:40px;height:40px;border-radius:13px;display:grid;place-items:center;font-size:19px;
  background:color-mix(in srgb,var(--text-dim,#64748b) 8%,var(--card-bg,#fff))}
${P} .dm-f-fumo-nome{flex:1;min-width:0}
${P} .dm-f-fumo-nome b{display:block;font-size:14.5px;font-weight:850;overflow-wrap:anywhere}
${P} .dm-f-fumo-nome span{display:block;margin-top:1px;font-size:12px;font-weight:750;color:${VERDE}}
${P} .dm-f-fumo-ril[data-come="muto"] .dm-f-fumo-nome span{color:var(--text-dim,#64748b)}
${P} .dm-f-fumo-ril[data-come="allarme"]{border-color:color-mix(in srgb,${ROSSO} 45%,transparent);background:color-mix(in srgb,${ROSSO} 7%,var(--card-bg,#fff))}
${P} .dm-f-fumo-ril[data-come="allarme"] .dm-f-fumo-nome span{color:${ROSSO};font-weight:900}
${P} .dm-f-fumo-pila{flex:none;margin-left:auto;font-size:12px;font-weight:850;color:var(--text-dim,#64748b);white-space:nowrap}
${P} .dm-f-fumo-pila[data-bassa="true"]{color:${AMBRA}}
${P} .dm-f-fumo-nota{margin:4px 0 0;padding:11px 13px;border-radius:16px;font-size:12.5px;font-weight:750;line-height:1.4;
  color:var(--text-dim,#475569);background:color-mix(in srgb,var(--text-dim,#64748b) 7%,var(--card-bg,#fff))}`;

/* ── Allagamenti ──────────────────────────────────────────────────────── */

/* «Perdita lavatrice», «Sensore perdita bagno»: la parola davanti la dice
 * gia' la finestra. Se togliendola non resta niente, il nome resta com'e'. */
function nomePulitoDellaSonda(nome) {
  const pulito = clean(nome)
    .replace(
      /^(sensore\s+)?(di\s+)?(perdita|perdite|allagamento|acqua|water\s+leak|leak|flood)(\s+(d'|di\s+)?acqua)?\s+/i,
      "",
    )
    .trim();
  return pulito ? pulito.charAt(0).toLocaleUpperCase() + pulito.slice(1) : clean(nome);
}

function disegnaAllagamenti(widget, states) {
  const k = "allagamenti";
  const righe = (Array.isArray(widget.rows) ? widget.rows : []).map((riga) => ({
    ...riga,
    muto: !riga.on && tace(statoDi(states, riga.entity)),
    stanza: stanza(riga.entity),
    pila: pilaDi(riga.entity, states),
  }));
  const bagnate = righe.filter((riga) => riga.on);
  const rispondono = righe.filter((riga) => !riga.muto).length;
  const sotto = `${t("Sonde che rispondono", "Probes answering")}: ${rispondono}/${righe.length}`;
  const eroe = `<div class="dm-f-${k}-eroe" data-tono="${bagnate.length ? "allarme" : ""}">
      <span class="dm-f-${k}-segno" aria-hidden="true">${bagnate.length ? "🚨" : "💧"}</span>
      <div><b>${esc(
        bagnate.length
          ? `${t("Acqua", "Water")}: ${bagnate.map((riga) => nomePulitoDellaSonda(riga.name)).join(" · ")}`
          : t("Tutto asciutto", "All dry"),
      )}</b><span class="dm-f-${k}-sotto">${esc(sotto)}</span></div>
    </div>`;
  const valvole = (Array.isArray(widget.valvole) ? widget.valvole : [])
    .map((valvola) => {
      const aperta = valvola.state === "open" || valvola.state === "opening";
      const chiusa = valvola.state === "closed" || valvola.state === "closing";
      const parola =
        valvola.state === "open"
          ? t("Aperta", "Open")
          : valvola.state === "closed"
            ? t("Chiusa", "Closed")
            : valvola.state === "opening"
              ? t("In apertura", "Opening")
              : valvola.state === "closing"
                ? t("In chiusura", "Closing")
                : t("Non risponde", "Not answering");
      const tasto = aperta
        ? tastoServizio(
            { domain: "valve", service: "close_valve", data: { entity_id: valvola.entity } },
            {
              classe: `dm-f-${k}-tasto`,
              testo: esc(t("Chiudi", "Close")),
              conferma: t("Tocca ancora per chiudere", "Tap again to close"),
            },
          )
        : chiusa
          ? tastoServizio(
              { domain: "valve", service: "open_valve", data: { entity_id: valvola.entity } },
              {
                classe: `dm-f-${k}-tasto`,
                testo: esc(t("Apri", "Open")),
                conferma: t("Tocca ancora per aprire", "Tap again to open"),
              },
            )
          : "";
      return `<div class="dm-f-${k}-valvola" data-aperta="${aperta ? "true" : "false"}">
          <span class="dm-f-${k}-ic" aria-hidden="true">🚰</span>
          <div class="dm-f-${k}-nome"><b>${esc(valvola.name)}</b><span>${esc(parola)}</span></div>
          ${tasto}
        </div>`;
    })
    .join("");
  const sonda = (riga) => {
    const come = riga.on
      ? t("Bagnato", "Wet")
      : riga.muto
        ? t("Non risponde", "Not answering")
        : t("Asciutto", "Dry");
    const sotto = [
      riga.stanza,
      riga.pila == null ? "" : `${riga.pila <= 20 ? "🪫" : "🔋"} ${riga.pila}%`,
    ]
      .filter(Boolean)
      .join(" · ");
    return `<div class="dm-f-${k}-sd" data-come="${riga.on ? "bagnato" : riga.muto ? "muto" : "asciutto"}">
        <div class="dm-f-${k}-top"><span class="dm-f-${k}-ic" aria-hidden="true">💧</span><span class="dm-f-${k}-pt"><i aria-hidden="true"></i>${esc(come)}</span></div>
        <b>${esc(nomePulitoDellaSonda(riga.name))}</b>
        ${sotto ? `<span class="dm-f-${k}-s">${esc(sotto)}</span>` : ""}
      </div>`;
  };
  return `<div class="dm-f-${k}">
      ${eroe}
      ${valvole ? `${titolo(k, t("Acqua di casa", "House water"))}${valvole}` : ""}
      ${titolo(k, t("Le sonde", "The probes"))}
      <div class="dm-f-${k}-sonde">${righe.map(sonda).join("")}</div>
    </div>`;
}

const STILE_ALLAGAMENTI = `${stileComune("allagamenti")}
${P} .dm-f-allagamenti-eroe:not([data-tono]),${P} .dm-f-allagamenti-eroe[data-tono=""]{--tono:#0284c7}
${P} .dm-f-allagamenti-eroe b{font-size:20px;overflow-wrap:anywhere}
${P} .dm-f-allagamenti-valvola{display:flex;align-items:center;gap:12px;padding:13px;border-radius:20px;min-width:0;
  background:var(--card-bg,#fff);border:1px solid color-mix(in srgb,#0284c7 35%,transparent);box-shadow:0 12px 24px -22px rgba(2,132,199,.9)}
${P} .dm-f-allagamenti-valvola .dm-f-allagamenti-ic{flex:none;width:46px;height:46px;border-radius:15px;display:grid;place-items:center;font-size:22px;
  background:color-mix(in srgb,#0284c7 12%,var(--card-bg,#fff))}
${P} .dm-f-allagamenti-nome{flex:1;min-width:0}
${P} .dm-f-allagamenti-nome b{display:block;font-size:14.5px;font-weight:850;overflow-wrap:anywhere}
${P} .dm-f-allagamenti-nome span{display:block;margin-top:1px;font-size:12px;font-weight:750;color:#0369a1}
${P} .dm-f-allagamenti-tasto{flex:none;font:inherit;cursor:pointer;padding:10px 16px;border-radius:14px;border:0;
  background:#0f172a;color:#fff;font-size:13px;font-weight:850}
${P} .dm-f-allagamenti-tasto[data-dm-w-armato="true"]{background:${ROSSO}}
html[data-theme="dark"] ${P} .dm-f-allagamenti-tasto{background:#f8fafc;color:#0f172a}
${P} .dm-f-allagamenti-sonde{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:9px}
${P} .dm-f-allagamenti-sd{min-width:0;padding:13px;border-radius:20px;background:var(--card-bg,#fff);
  border:1px solid var(--card-border,#eef2f7);box-shadow:0 10px 22px -22px rgba(15,23,42,.6)}
${P} .dm-f-allagamenti-top{display:flex;justify-content:space-between;align-items:center;gap:6px}
${P} .dm-f-allagamenti-sd .dm-f-allagamenti-ic{font-size:20px}
${P} .dm-f-allagamenti-pt{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:900;letter-spacing:.08em;
  text-transform:uppercase;color:#0369a1;white-space:nowrap}
${P} .dm-f-allagamenti-pt i{width:7px;height:7px;border-radius:50%;background:#38bdf8}
${P} .dm-f-allagamenti-sd b{display:block;margin-top:9px;font-size:14.5px;font-weight:850;line-height:1.2;overflow-wrap:anywhere}
${P} .dm-f-allagamenti-s{display:block;margin-top:2px;font-size:11.5px;font-weight:750;color:var(--text-dim,#64748b)}
${P} .dm-f-allagamenti-sd[data-come="bagnato"]{border-color:color-mix(in srgb,${ROSSO} 45%,transparent);background:color-mix(in srgb,${ROSSO} 7%,var(--card-bg,#fff))}
${P} .dm-f-allagamenti-sd[data-come="bagnato"] .dm-f-allagamenti-pt{color:${ROSSO}}
${P} .dm-f-allagamenti-sd[data-come="bagnato"] .dm-f-allagamenti-pt i{background:${ROSSO}}
${P} .dm-f-allagamenti-sd[data-come="muto"]{border-style:dashed;box-shadow:none}
${P} .dm-f-allagamenti-sd[data-come="muto"] .dm-f-allagamenti-pt{color:var(--text-dim,#64748b)}
${P} .dm-f-allagamenti-sd[data-come="muto"] .dm-f-allagamenti-pt i{background:var(--text-dim,#94a3b8)}`;

/* ── Non rispondono ───────────────────────────────────────────────────── */

const SEGNI_DEL_DOMINIO = Object.freeze({
  light: "💡",
  switch: "🔌",
  sensor: "🌡️",
  binary_sensor: "📟",
  climate: "❄️",
  camera: "📹",
  media_player: "🔊",
  cover: "🪟",
  lock: "🔒",
  vacuum: "🧹",
  fan: "🌀",
  valve: "🚰",
  water_heater: "♨️",
});

function tipoDelDominio(dominio) {
  switch (dominio) {
    case "light":
      return t("Luce", "Light");
    case "switch":
      return t("Presa", "Plug");
    case "sensor":
    case "binary_sensor":
      return t("Sensore", "Sensor");
    case "climate":
      return t("Clima", "Climate");
    case "camera":
      return t("Telecamera", "Camera");
    case "media_player":
      return t("Lettore", "Player");
    case "cover":
      return t("Tapparella", "Shutter");
    case "lock":
      return t("Serratura", "Lock");
    default:
      return "";
  }
}

const ORE_LUNGHE = 2;

function disegnaNonRisponde(widget) {
  const k = "nonrisponde";
  const righe = (Array.isArray(widget.rows) ? widget.rows : [])
    .map((riga) => {
      const entita = (Array.isArray(riga.entita) ? riga.entita : [riga.entity])
        .map(clean)
        .filter((id) => id.includes(".") && !id.startsWith("dispositivo:"));
      const dominio = (entita[0] || "").split(".")[0];
      const posto = entita.map(stanza).find(Boolean) || "";
      return { ...riga, entita, dominio, posto };
    })
    /* Dalla piu' lunga: chi tace da piu' tempo e' il guasto vero. */
    .sort((a, b) => (Number(a.da) || Infinity) - (Number(b.da) || Infinity));
  const posti = [...new Set(righe.map((riga) => riga.posto))];
  const insieme = righe.length > 1 && posti.length === 1 && posti[0];
  const sotto = insieme
    ? `${t("Tutti in", "All in")} ${posti[0]}`
    : righe.length === 1 && righe[0].posto
      ? righe[0].posto
      : "";
  const eroe = `<div class="dm-f-${k}-eroe" data-tono="allarme">
      <span class="dm-f-${k}-num">${righe.length}</span>
      <div><b>${esc(righe.length === 1 ? t("dispositivo muto", "silent device") : t("dispositivi muti", "silent devices"))}</b>${
        sotto ? `<span class="dm-f-${k}-sotto">${esc(sotto)}</span>` : ""
      }</div>
    </div>`;
  const adesso = Date.now();
  const riga = (voce) => {
    const quanto = durata(voce.da, adesso);
    const lungo = Number(voce.da) > 0 && adesso - Number(voce.da) > ORE_LUNGHE * 60 * MINUTO;
    const sottoRiga = [tipoDelDominio(voce.dominio), voce.posto].filter(Boolean).join(" · ");
    return `<div class="dm-f-${k}-dev"${lungo ? ' data-lungo="true"' : ""}>
        <span class="dm-f-${k}-ic" aria-hidden="true">${SEGNI_DEL_DOMINIO[voce.dominio] || "📡"}</span>
        <div class="dm-f-${k}-nome"><b>${esc(voce.name)}</b>${sottoRiga ? `<span>${esc(sottoRiga)}</span>` : ""}</div>
        ${quanto ? `<div class="dm-f-${k}-da"><small>${esc(t("da", "for"))}</small><span class="dm-f-${k}-num">${esc(quanto)}</span></div>` : ""}
      </div>`;
  };
  const tutte = [...new Set(righe.flatMap((voce) => voce.entita))];
  const consiglio = insieme
    ? `${titolo(k, t("Cosa provare", "What to try"))}<p class="dm-f-${k}-consiglio">${esc(
        t(
          "Stanno nella stessa zona: di solito è il segnale (Wi-Fi o Zigbee). Controlla il ripetitore più vicino, oppure spegni e riaccendi i dispositivi.",
          "They are in the same area: it is usually the signal (Wi-Fi or Zigbee). Check the nearest repeater, or power the devices off and on again.",
        ),
      )}</p>`
    : "";
  const riprova = tutte.length
    ? tastoServizio(
        { domain: "homeassistant", service: "update_entity", data: { entity_id: tutte } },
        {
          classe: `dm-f-${k}-tasto`,
          testo: `<span aria-hidden="true">↻</span> ${esc(t("Riprova a contattarli", "Try reaching them again"))}`,
        },
      )
    : "";
  return `<div class="dm-f-${k}">
      ${eroe}
      ${titolo(k, t("Dalla più lunga", "Longest first"))}
      ${righe.map(riga).join("")}
      ${consiglio}
      ${riprova}
    </div>`;
}

const STILE_NONRISPONDE = `${stileComune("nonrisponde")}
${P} .dm-f-nonrisponde-dev{display:flex;align-items:center;gap:12px;padding:12px;border-radius:18px;min-width:0;
  background:var(--card-bg,#fff);border:1px solid var(--card-border,#eef2f7);box-shadow:0 10px 22px -22px rgba(15,23,42,.6)}
${P} .dm-f-nonrisponde-dev .dm-f-nonrisponde-ic{flex:none;width:42px;height:42px;border-radius:14px;display:grid;place-items:center;font-size:20px;
  background:color-mix(in srgb,var(--text-dim,#64748b) 8%,var(--card-bg,#fff));filter:grayscale(.6)}
${P} .dm-f-nonrisponde-nome{flex:1;min-width:0}
${P} .dm-f-nonrisponde-nome b{display:block;font-size:14.5px;font-weight:850;overflow-wrap:anywhere}
${P} .dm-f-nonrisponde-nome span{display:block;margin-top:1px;font-size:12px;font-weight:750;color:var(--text-dim,#64748b)}
${P} .dm-f-nonrisponde-da{flex:none;display:flex;flex-direction:column;align-items:flex-end;text-align:right}
${P} .dm-f-nonrisponde-da .dm-f-nonrisponde-num{font-size:20px;line-height:1}
${P} .dm-f-nonrisponde-da small{font-size:10.5px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--text-dim,#64748b)}
${P} .dm-f-nonrisponde-dev[data-lungo="true"]{border-color:color-mix(in srgb,${ROSSO} 40%,transparent)}
${P} .dm-f-nonrisponde-dev[data-lungo="true"] .dm-f-nonrisponde-num{color:${ROSSO}}
${P} .dm-f-nonrisponde-consiglio{margin:0;padding:12px 13px;border-radius:16px;font-size:12.5px;font-weight:750;line-height:1.45;
  color:var(--text-dim,#475569);background:color-mix(in srgb,var(--text-dim,#64748b) 7%,var(--card-bg,#fff))}
${P} .dm-f-nonrisponde-tasto{font:inherit;cursor:pointer;margin-top:4px;padding:14px;border-radius:18px;border:0;
  background:#0f172a;color:#fff;font-size:14px;font-weight:850}
${P} .dm-f-nonrisponde-tasto[data-dm-w-in-corso="true"]{opacity:.6}
html[data-theme="dark"] ${P} .dm-f-nonrisponde-tasto{background:#f8fafc;color:#0f172a}`;

/* ── Batterie ─────────────────────────────────────────────────────────── */

/* «Sensore porta ingresso Batteria» → «Sensore porta ingresso»: in questa
 * finestra sono tutte batterie. */
function nomePulitoDellaPila(nome) {
  const pulito = clean(nome)
    .replace(/\b(livello\s+(della\s+)?)?(batteria|battery|batt)(\s+level)?\b/gi, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s·:,-]+|[\s·:,-]+$/g, "")
    .trim();
  return pulito ? pulito.charAt(0).toLocaleUpperCase() + pulito.slice(1) : clean(nome);
}

const PROSSIME = 60;

function disegnaBatterie(widget) {
  const k = "batterie";
  const soglia = Number.isFinite(Number(widget.soglia)) ? Number(widget.soglia) : 20;
  const righe = (Array.isArray(widget.rows) ? widget.rows : [])
    .filter((riga) => Number.isFinite(Number(riga.level)))
    .map((riga) => ({
      ...riga,
      livello: Math.round(Number(riga.level)),
      nome: nomePulitoDellaPila(riga.name),
      posto: stanza(riga.entity),
    }))
    .sort((a, b) => a.livello - b.livello);
  const giu = righe.filter((riga) => riga.livello <= soglia);
  const prossime = righe.filter((riga) => riga.livello > soglia && riga.livello < PROSSIME);
  const cariche = righe.filter((riga) => riga.livello >= PROSSIME && riga.livello > soglia);
  const altre = righe.length - giu.length;
  const eroe = `<div class="dm-f-${k}-eroe" data-tono="${giu.length ? "" : "ok"}">
      <span class="dm-f-${k}-num">${giu.length || righe.length}</span>
      <div><b>${esc(
        giu.length
          ? t("da cambiare", "to replace")
          : righe.length === 1
            ? t("batteria, carica", "battery, charged")
            : t("batterie, tutte cariche", "batteries, all charged"),
      )}</b><span class="dm-f-${k}-sotto">${esc(
        giu.length && altre
          ? `${altre} ${t("sopra la soglia", "above the threshold")} · ${t("soglia", "threshold")} ${soglia}%`
          : `${t("soglia", "threshold")} ${soglia}%`,
      )}</span></div>
    </div>`;
  const pila = (
    riga,
    colore,
    giuSi,
  ) => `<div class="dm-f-${k}-pila"${giuSi ? ' data-giu="true"' : ""}>
      <span class="dm-f-${k}-ic" aria-hidden="true">${giuSi ? "🪫" : "🔋"}</span>
      <span class="dm-f-${k}-nome"><b>${esc(riga.nome)}</b>${riga.posto ? `<small>${esc(riga.posto)}</small>` : ""}<i style="--w:${Math.max(
        3,
        Math.min(100, riga.livello),
      )}%;--c:${colore}"></i></span>
      <span class="dm-f-${k}-num">${riga.livello}%</span>
    </div>`;
  return `<div class="dm-f-${k}">
      ${eroe}
      ${giu.length ? `${titolo(k, t("Da cambiare", "To replace"))}${giu.map((riga) => pila(riga, ROSSO, true)).join("")}` : ""}
      ${prossime.length ? `${titolo(k, t("Le prossime", "Next ones"))}${prossime.map((riga) => pila(riga, "#eab308", false)).join("")}` : ""}
      ${
        cariche.length
          ? `${titolo(k, t("Cariche", "Charged"))}<div class="dm-f-${k}-ok">${cariche
              .map(
                (riga) =>
                  `<div><b>${esc(riga.nome)}</b><span class="dm-f-${k}-num">${riga.livello}%</span></div>`,
              )
              .join("")}</div>`
          : ""
      }
    </div>`;
}

const STILE_BATTERIE = `${stileComune("batterie")}
${P} .dm-f-batterie-eroe[data-tono=""]{--tono:#ca8a04}
${P} .dm-f-batterie-pila{display:flex;align-items:center;gap:12px;padding:11px 12px;border-radius:18px;min-width:0;
  background:var(--card-bg,#fff);border:1px solid var(--card-border,#eef2f7);box-shadow:0 10px 22px -22px rgba(15,23,42,.6)}
${P} .dm-f-batterie-pila .dm-f-batterie-ic{flex:none;width:40px;height:40px;border-radius:13px;display:grid;place-items:center;font-size:19px;
  background:color-mix(in srgb,var(--text-dim,#64748b) 8%,var(--card-bg,#fff))}
${P} .dm-f-batterie-nome{flex:1;min-width:0}
${P} .dm-f-batterie-nome b{display:block;font-size:14px;font-weight:850;overflow-wrap:anywhere}
${P} .dm-f-batterie-nome small{display:block;font-size:11.5px;font-weight:750;color:var(--text-dim,#64748b)}
${P} .dm-f-batterie-nome i{display:block;position:relative;overflow:hidden;height:6px;margin-top:6px;border-radius:999px;
  background:color-mix(in srgb,var(--text-dim,#64748b) 14%,transparent)}
${P} .dm-f-batterie-nome i::after{content:"";position:absolute;inset:0 auto 0 0;width:var(--w);border-radius:999px;background:var(--c)}
${P} .dm-f-batterie-pila .dm-f-batterie-num{flex:none;min-width:52px;text-align:right;font-size:22px}
${P} .dm-f-batterie-pila[data-giu="true"]{border-color:color-mix(in srgb,${ROSSO} 35%,transparent);background:color-mix(in srgb,${ROSSO} 4%,var(--card-bg,#fff))}
${P} .dm-f-batterie-pila[data-giu="true"] .dm-f-batterie-num{color:${ROSSO}}
${P} .dm-f-batterie-ok{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
${P} .dm-f-batterie-ok > div{display:flex;justify-content:space-between;align-items:center;gap:8px;min-width:0;padding:10px 12px;border-radius:15px;
  background:color-mix(in srgb,var(--text-dim,#64748b) 6%,var(--card-bg,#fff));border:1px solid var(--card-border,#eef2f7)}
${P} .dm-f-batterie-ok b{min-width:0;font-size:12.5px;font-weight:800;line-height:1.2;overflow-wrap:anywhere}
${P} .dm-f-batterie-ok .dm-f-batterie-num{flex:none;font-size:16px;color:${VERDE}}`;

/* ── la registrazione ─────────────────────────────────────────────────── */

registraFinestra("sicurezza", { disegna: disegnaSicurezza, stile: STILE_SICUREZZA });
registraFinestra("telecamere", { disegna: disegnaTelecamere, stile: STILE_TELECAMERE });
registraFinestra("varchi", { disegna: disegnaVarchi, stile: STILE_VARCHI });
registraFinestra("presenza", { disegna: disegnaPresenza, stile: STILE_PRESENZA });
registraFinestra("fumo", { disegna: disegnaFumo, stile: STILE_FUMO });
registraFinestra("allagamenti", { disegna: disegnaAllagamenti, stile: STILE_ALLAGAMENTI });
registraFinestra("nonrisponde", { disegna: disegnaNonRisponde, stile: STILE_NONRISPONDE });
registraFinestra("batterie", { disegna: disegnaBatterie, stile: STILE_BATTERIE });

/* Per le prove: i nomi ripuliti e il «da quanto». */
export { durata, nomePulitoDellaSonda, nomePulitoDellaPila };
