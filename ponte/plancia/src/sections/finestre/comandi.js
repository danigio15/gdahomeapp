/* Le finestre dei widget del gruppo «comandi» (vedi `../finestre-dei-widget.js`).
 *
 * Finestre e tapparelle, Prese, Apri porte, Musica, Citofono e posta, Robot:
 * le tessere da cui si comanda qualcosa. La finestra generica le apriva tutte
 * allo stesso modo — un verdetto arancione «In corso», «Le misure» con il
 * numero della tessera ripetuto, le pillole de «Lo stato» — e i comandi in
 * fondo, quando c'erano. Qui ognuna ha la sua: in cima la cosa che conta,
 * subito sotto i tasti, e niente nomi grezzi.
 *
 * I dati arrivano dal modello della tessera (`xxxModel` in
 * `home-widgets-section.js`), che per queste finestre porta qualche campo in
 * piu': la stanza, i watt, da quando una cosa sta com'e'. Quello che la casa
 * non sa non si inventa — una sezione senza il suo dato non compare.
 *
 * I tasti parlano le lingue che la plancia ascolta gia' sul documento:
 * `data-dm-w-cover` per le tapparelle (sa anche dei rele'), `data-dm-door`
 * per le porte (PIN e conferma), `data-dm-mp` per la musica,
 * `data-dm-cassetta-presa` per la posta, `data-dm-w-light` per le prese. Dove
 * una lingua non c'e', `tastoServizio`.
 */
import { registraFinestra, tastoServizio } from "../finestre-dei-widget.js";
import { clean, esc, formatNumber, locale, section, siComanda, t } from "../shared.js";
import { iconGlyphMarkup } from "../icon-engine-section.js";
import { quantoTempoInParole } from "../../core/da-quanto.js";
import { ilTastoCentrale, orologio, posizioneOra } from "../../core/media-player.js";
import { robotActions, robotCommand, robotStateLabel } from "../../core/robot-model.js";
import { coverKindLabel } from "../../core/cover-kind.js";
import { disegnoDelCatalogo } from "../../core/catalogo-disegni.js";

export const FINESTRE_COMANDI = Object.freeze([
  "tapparelle",
  "prese",
  "porte",
  "media",
  "citofono",
  "robot",
]);

const P = ":is(#dm-widget-popup,#dm-casa-popup,#dm-qa-popup)";

/* ── le parole del tempo ──────────────────────────────────────────────── */

const minutiDa = (da, adesso = Date.now()) =>
  Number.isFinite(da) ? Math.max(0, (adesso - da) / 60000) : null;

/** «da 12 minuti», o «appena adesso»: mai «da appena adesso». */
export function daQuanto(da, adesso = Date.now()) {
  const minuti = minutiDa(da, adesso);
  if (minuti == null) return "";
  if (minuti < 1) return quantoTempoInParole(0);
  return `${t("da", "for")} ${quantoTempoInParole(minuti)}`;
}

/** «30 minuti fa», o «appena adesso». */
export function quantoFa(da, adesso = Date.now()) {
  const minuti = minutiDa(da, adesso);
  if (minuti == null) return "";
  if (minuti < 1) return quantoTempoInParole(0);
  return `${quantoTempoInParole(minuti)} ${t("fa", "ago")}`;
}

/** L'ora di un momento: «10:42», «ieri 19:40», «3 ott 08:12». */
export function orario(quando, adesso = Date.now()) {
  if (!Number.isFinite(quando)) return "";
  const data = new Date(quando);
  let ora = "";
  try {
    ora = data.toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });
  } catch (_error) {
    ora = `${String(data.getHours()).padStart(2, "0")}:${String(data.getMinutes()).padStart(2, "0")}`;
  }
  const giorno = (istante) => {
    const d = new Date(istante);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  const giorni = Math.round((giorno(adesso) - giorno(quando)) / 86400000);
  if (giorni === 0) return ora;
  if (giorni === 1) return `${t("ieri", "yesterday")} ${ora}`;
  let quale = "";
  try {
    quale = data.toLocaleDateString(locale(), { day: "numeric", month: "short" });
  } catch (_error) {
    quale = `${data.getDate()}/${data.getMonth() + 1}`;
  }
  return `${quale} ${ora}`;
}

/** «Cucina e Bagno», nella lingua di chi guarda. */
function elenco(nomi) {
  const voci = nomi.filter(Boolean);
  try {
    return new Intl.ListFormat(locale(), { style: "long", type: "conjunction" }).format(voci);
  } catch (_error) {
    return voci.join(", ");
  }
}

const titolo = (testo) => `<p class="dm-f-tit">${esc(testo)}</p>`;

/* I tratti dei comandi: gli stessi della plancia, disegnati e non scritti. */
const TRATTO =
  'viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" focusable="false" fill="none" ' +
  'stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"';
const SU = `<svg ${TRATTO}><path d="M12 19V6"/><path d="M6 11.5 12 5.5l6 6"/></svg>`;
const GIU = `<svg ${TRATTO}><path d="M12 5v13"/><path d="M6 12.5 12 18.5l6-6"/></svg>`;
const FERMA =
  '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" focusable="false" ' +
  'fill="currentColor"><rect x="6.5" y="6.5" width="11" height="11" rx="2.4"/></svg>';
const SPUNTA = `<svg ${TRATTO}><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>`;
const CASA = `<svg ${TRATTO}><path d="M4.4 11.4 12 4.9l7.6 6.5"/><path d="M6.8 9.8v9.3h10.4V9.8"/></svg>`;
const ACCENSIONE =
  '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" fill="none" ' +
  'stroke="currentColor" stroke-width="2.3" stroke-linecap="round">' +
  '<path d="M12 3v8"/><path d="M6.8 6.6a7.5 7.5 0 1 0 10.4 0"/></svg>';
const GLIFI_MP = Object.freeze({
  precedente:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5.5v13" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M18.5 6.4v11.2a.8.8 0 0 1-1.24.67l-8.4-5.6a.8.8 0 0 1 0-1.34l8.4-5.6a.8.8 0 0 1 1.24.67Z" fill="currentColor"/></svg>',
  successivo:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 5.5v13" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M5.5 6.4v11.2a.8.8 0 0 0 1.24.67l8.4-5.6a.8.8 0 0 0 0-1.34l-8.4-5.6a.8.8 0 0 0-1.24.67Z" fill="currentColor"/></svg>',
  suona:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 4.9v14.2a.9.9 0 0 0 1.38.76l11-7.1a.9.9 0 0 0 0-1.52l-11-7.1a.9.9 0 0 0-1.38.76Z" fill="currentColor"/></svg>',
  pausa:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.6" y="4.8" width="4.2" height="14.4" rx="1.6" fill="currentColor"/><rect x="13.2" y="4.8" width="4.2" height="14.4" rx="1.6" fill="currentColor"/></svg>',
  accendi: ACCENSIONE,
  voce: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.4h3.4L12 5.2v13.6L7.4 14.6H4Z" fill="currentColor"/><path d="M15.6 9.2a4 4 0 0 1 0 5.6" stroke="currentColor" stroke-width="1.9" fill="none" stroke-linecap="round"/></svg>',
});

/* ── Finestre e tapparelle ────────────────────────────────────────────── */

const eUnMotore = (riga) => !riga.soloSensore;
const eUnaGrata = (riga) => riga.soloSensore && riga.grata === true;

/** La posizione in parole: «Tutta su», «60% su», «Giù». */
export function posizioneInParole(riga) {
  const tapparella = !riga.kind || riga.kind === "tapparella";
  if (riga.muta) return t("Non risponde", "Not responding");
  if (riga.position == null) {
    if (tapparella) return riga.open ? t("Su", "Up") : t("Giù", "Down");
    return riga.open ? t("Aperta", "Open") : t("Chiusa", "Closed");
  }
  if (riga.position >= 100)
    return tapparella ? t("Tutta su", "All the way up") : t("Aperta", "Open");
  if (riga.position <= 0) return tapparella ? t("Giù", "Down") : t("Chiusa", "Closed");
  return `${riga.position}% ${tapparella ? t("su", "up") : t("aperta", "open")}`;
}

function tastoTapparella(riga, servizio, glifo, parola) {
  return `<button type="button" class="dm-f-tapparelle-freccia" data-dm-w-cover="${esc(riga.entity)}"
    data-dm-w-down="${esc(riga.down)}" data-svc="${servizio}" title="${esc(parola)}"
    aria-label="${esc(`${parola}: ${riga.stanza || riga.name}`)}">${glifo}</button>`;
}

function frecce(riga) {
  if (!(riga.isCover || riga.relay)) return "";
  return `<span class="dm-f-tapparelle-frecce">${tastoTapparella(riga, "open_cover", SU, t("Alza", "Raise"))}${tastoTapparella(
    riga,
    "stop_cover",
    FERMA,
    t("Ferma", "Stop"),
  )}${tastoTapparella(riga, "close_cover", GIU, t("Abbassa", "Lower"))}</span>`;
}

/* La tendina della posizione (#200), per chi la accetta. */
function posizioneScelta(riga) {
  if (!riga.settable) return "";
  const invito = t("Scegli la posizione", "Choose the position");
  const voci = [0, 25, 50, 75, 100]
    .map((valore) => `<option value="${valore}">${valore}%</option>`)
    .join("");
  return `<select class="dm-f-tapparelle-pos" data-dm-w-position="${esc(riga.entity)}"
    data-dm-w-verso="${riga.invertita ? "1" : ""}" aria-label="${esc(invito)}" title="${esc(invito)}"><option value="">↕</option>${voci}</select>`;
}

/* Il disegno della stanza, quello scelto nel catalogo della plancia.
 *
 * «Metti un'icona vicino alle cose, non lasciare solo testo», e poi «le icone
 * non sono quelle del mio catalogo»: la stanza porta l'icona che le si e'
 * data nella configurazione delle Stanze — la cucina col suo forno, il bagno
 * con la sua doccia — disegnata dallo stesso motore che la disegna in tutta
 * la plancia. Una stanza che un'icona non ce l'ha ha la casetta. */
function disegnoDellaStanza(nome, misura) {
  const chi = clean(nome).toLowerCase();
  const stanza = (section("rooms", []) || []).find(
    (voce) => clean(voce?.name).toLowerCase() === chi || clean(voce?.id).toLowerCase() === chi,
  );
  const icona = clean(stanza?.icon);
  if (icona) {
    try {
      return iconGlyphMarkup("room", icona, { size: misura });
    } catch (_errore) {}
  }
  return disegnoDelCatalogo("home", misura);
}

/** Le righe della tessera raccolte per stanza, nell'ordine in cui arrivano. */
export function stanzeDelleFinestre(righe = []) {
  const stanze = new Map();
  for (const riga of righe) {
    const chiave = clean(riga.stanza || riga.name);
    if (!stanze.has(chiave)) stanze.set(chiave, { nome: chiave, ante: [], motori: [] });
    const stanza = stanze.get(chiave);
    (eUnMotore(riga) ? stanza.motori : stanza.ante).push(riga);
  }
  return [...stanze.values()].map((stanza) => ({
    ...stanza,
    aperta: stanza.ante.some((riga) => riga.open),
    su: stanza.motori.some((riga) => riga.open),
  }));
}

function antaPill(riga) {
  const grata = eUnaGrata(riga);
  const parola = riga.muta
    ? t("Non risponde", "Not responding")
    : riga.open
      ? grata
        ? t("Inferriata aperta", "Grate open")
        : t("Finestra aperta", "Window open")
      : grata
        ? t("Inferriata chiusa", "Grate closed")
        : t("Finestra chiusa", "Window closed");
  return `<span class="dm-f-tapparelle-anta" data-aperta="${riga.open === true}">${
    riga.open ? '<i aria-hidden="true"></i>' : ""
  }${esc(parola)}</span>`;
}

function motoreMarkup(riga, conFrecce) {
  const quota = riga.position != null ? riga.position : riga.open ? 100 : 0;
  return `<div class="dm-f-tapparelle-motore">
    ${conFrecce ? `<div class="dm-f-tapparelle-riga"><b class="dm-f-tapparelle-tipo">${esc(coverKindLabel(riga.kind))}</b>${frecce(riga)}</div>` : ""}
    <span class="dm-f-tapparelle-barra" aria-hidden="true"><i style="width:${Math.max(0, Math.min(100, quota))}%"></i></span>
    <span class="dm-f-tapparelle-sotto"><span>${conFrecce ? "" : esc(coverKindLabel(riga.kind))}</span>${posizioneScelta(riga)}<b>${esc(posizioneInParole(riga))}</b></span>
  </div>`;
}

/* La stanza col suo disegno, e sopra il segno di cosa la tiene in elenco:
 * la finestra, o la tapparella quando di finestre non ne ha. */
function iconaDellaStanza(stanza) {
  const segno = stanza.ante.length ? "window" : "shutters";
  return `<span class="dm-f-tapparelle-ic" data-viva="${Boolean(stanza.aperta || stanza.su)}" aria-hidden="true">${disegnoDellaStanza(
    stanza.nome,
    32,
  )}<i>${disegnoDelCatalogo(segno, 16)}</i></span>`;
}

function stanzaMarkup(stanza) {
  const viva = stanza.aperta || stanza.su;
  const unMotore = stanza.motori.length === 1 ? stanza.motori[0] : null;
  const ante = stanza.ante.map(antaPill).join("");
  /* Una stanza tutta chiusa sta su una riga sola: «Tapparella giù · tenda da
   * sole chiusa». Quella con qualcosa di aperto mostra le barre. */
  if (!viva) {
    const riassunto = stanza.motori
      .map((riga) => `${coverKindLabel(riga.kind)} ${posizioneInParole(riga).toLowerCase()}`)
      .join(" · ");
    return `<article class="dm-f-tapparelle-stanza" data-viva="false">
      <div class="dm-f-tapparelle-riga">
        ${iconaDellaStanza(stanza)}
        <span class="dm-f-tapparelle-nome"><b>${esc(stanza.nome)}</b>${
          ante ? `<span class="dm-f-tapparelle-ante">${ante}</span>` : ""
        }${riassunto ? `<small>${disegnoDelCatalogo("shutters", 16)}${esc(riassunto)}</small>` : ""}</span>
        ${unMotore ? frecce(unMotore) : ""}
      </div>
      ${
        stanza.motori.length > 1
          ? stanza.motori
              .map(
                (riga) =>
                  `<div class="dm-f-tapparelle-riga dm-f-tapparelle-piccola"><small>${esc(coverKindLabel(riga.kind))}</small>${frecce(riga)}</div>`,
              )
              .join("")
          : ""
      }
    </article>`;
  }
  return `<article class="dm-f-tapparelle-stanza" data-viva="true">
    <div class="dm-f-tapparelle-riga">
      ${iconaDellaStanza(stanza)}
      <span class="dm-f-tapparelle-nome"><b>${esc(stanza.nome)}</b>${
        ante ? `<span class="dm-f-tapparelle-ante">${ante}</span>` : ""
      }${
        !stanza.motori.length
          ? `<small>${disegnoDelCatalogo("radar", 16)}${esc(t("Solo sensore sull'anta · nessun motore", "Window sensor only · no motor"))}</small>`
          : ""
      }</span>
      ${unMotore ? frecce(unMotore) : ""}
    </div>
    ${stanza.motori.map((riga) => motoreMarkup(riga, !unMotore)).join("")}
  </article>`;
}

function finestraTapparelle(widget) {
  const righe = Array.isArray(widget.rows) ? widget.rows : [];
  const ante = righe.filter((riga) => !eUnMotore(riga));
  const motori = righe.filter(eUnMotore);
  const aperte = ante.filter((riga) => riga.open);
  const alzate = motori.filter((riga) => riga.open);
  const nomiDi = (lista) => [...new Set(lista.map((riga) => clean(riga.stanza || riga.name)))];
  const eroi = [];
  if (ante.length) {
    const prima = aperte
      .map((riga) => riga.da)
      .filter(Number.isFinite)
      .sort((a, b) => a - b)[0];
    /* Le stanze aperte una per una, col loro disegno, invece di una riga di
     * nomi separati da virgole. */
    const stanzeAperte = nomiDi(aperte)
      .map(
        (nome) =>
          `<span class="dm-f-tapparelle-chip">${disegnoDellaStanza(nome, 20)}${esc(nome)}</span>`,
      )
      .join("");
    eroi.push(`<div class="dm-f-tapparelle-eroe dm-f-tapparelle-eroe-ic" data-tono="${aperte.length ? "aperte" : "quiete"}">
      <span class="dm-f-tapparelle-vetro" aria-hidden="true">${disegnoDelCatalogo("window", 50)}${
        aperte.length ? `<b>${aperte.length}</b>` : ""
      }</span>
      <span class="dm-f-tapparelle-eroe-testo">
        <small>${esc(t("Finestre aperte", "Open windows"))}</small>
        <b class="dm-f-num">${aperte.length}<span>${esc(t("su", "of"))} ${ante.length}</span></b>
        <em>${
          aperte.length ? (prima ? esc(daQuanto(prima)) : "") : esc(t("Tutte chiuse", "All closed"))
        }</em>
        ${stanzeAperte ? `<span class="dm-f-tapparelle-chips">${stanzeAperte}</span>` : ""}
      </span>
    </div>`);
  }
  if (motori.length) {
    eroi.push(`<div class="dm-f-tapparelle-eroe">
      <small>${esc(t("Tapparelle su", "Shutters up"))}</small>
      <b class="dm-f-num">${alzate.length}</b>
      <em>${esc(
        [`${t("su", "of")} ${motori.length}`, alzate.length ? nomiDi(alzate).join(", ") : ""]
          .filter(Boolean)
          .join(" · "),
      )}</em>
    </div>`);
  }
  /* I tasti per tutte: solo le coperture vere — un rele' si comanda per
   * conto suo — e solo quelle che da qui si possono comandare. */
  const comandabili = motori
    .filter((riga) => riga.isCover && !riga.relay && siComanda(riga.entity))
    .map((riga) => riga.entity);
  const tutte =
    comandabili.length > 1
      ? `<div class="dm-f-tapparelle-tutte">
      ${tastoServizio(
        { domain: "cover", service: "close_cover", data: { entity_id: comandabili } },
        { classe: "dm-f-tasto dm-f-pieno", testo: `${GIU} ${esc(t("Giù tutte", "All down"))}` },
      )}
      ${tastoServizio(
        { domain: "cover", service: "open_cover", data: { entity_id: comandabili } },
        { classe: "dm-f-tasto", testo: `${SU} ${esc(t("Su tutte", "All up"))}` },
      )}
      ${tastoServizio(
        { domain: "cover", service: "stop_cover", data: { entity_id: comandabili } },
        {
          classe: "dm-f-tasto dm-f-tasto-quadro",
          testo: FERMA,
          attributi: `aria-label="${esc(t("Ferma tutte", "Stop all"))}" title="${esc(t("Ferma tutte", "Stop all"))}"`,
        },
      )}
    </div>`
      : "";
  /* Prima le stanze con qualcosa aperto o su, poi le altre. */
  const stanze = stanzeDelleFinestre(righe).sort(
    (a, b) =>
      Number(b.aperta || b.su) - Number(a.aperta || a.su) || Number(b.aperta) - Number(a.aperta),
  );
  return `<div class="dm-f-tapparelle">
    <div class="dm-f-tapparelle-eroi" data-quanti="${eroi.length}">${eroi.join("")}</div>
    ${tutte}
    ${titolo(t("Per stanza · prima le aperte", "By room · open first"))}
    <div class="dm-f-tapparelle-stanze">${stanze.map(stanzaMarkup).join("")}</div>
  </div>`;
}

/* ── Prese ────────────────────────────────────────────────────────────── */

function presaMarkup(riga) {
  const watt = riga.on && Number.isFinite(riga.watt) ? `${formatNumber(riga.watt, 0)} W` : "";
  const sotto = !riga.disponibile
    ? [
        riga.stanza,
        riga.da
          ? `${t("Non risponde", "Not responding")} ${daQuanto(riga.da)}`
          : t("Non risponde", "Not responding"),
      ]
    : riga.on
      ? [riga.stanza, watt]
      : [riga.stanza, riga.da ? `${t("spenta", "off")} ${daQuanto(riga.da)}` : ""];
  const comando = riga.comando
    ? `<button type="button" class="dm-f-prese-int" data-dm-w-light="${esc(riga.entity)}" data-on="${riga.on === true}"
        role="switch" aria-checked="${riga.on === true}" aria-label="${esc(riga.name)}"><i></i></button>`
    : riga.protetta
      ? `<span class="dm-f-prese-lucchetto" title="${esc(t("Si vede ma non si comanda da qui", "Visible but not controlled from here"))}">🔒 ${esc(t("protetta", "protected"))}</span>`
      : "";
  return `<article class="dm-f-prese-presa" data-on="${riga.on === true}" data-muta="${!riga.disponibile}">
    <span class="dm-f-prese-ic" aria-hidden="true">${riga.glyph || "🔌"}</span>
    ${comando}
    <b>${esc(riga.name)}</b>
    <small>${esc(sotto.filter(Boolean).join(" · "))}</small>
  </article>`;
}

function finestraPrese(widget) {
  const righe = Array.isArray(widget.rows) ? widget.rows : [];
  const accese = righe.filter((riga) => riga.on);
  const spente = [
    ...righe.filter((riga) => !riga.on && riga.disponibile),
    ...righe.filter((riga) => !riga.on && !riga.disponibile),
  ];
  const watt = Number.isFinite(widget.watt)
    ? `<span class="dm-f-prese-watt"><b class="dm-f-num">${esc(formatNumber(widget.watt, 0))} W</b><small>${esc(
        t("assorbiti adesso", "drawn right now"),
      )}</small></span>`
    : "";
  return `<div class="dm-f-prese">
    <div class="dm-f-eroe dm-f-prese-eroe">
      <span class="dm-f-prese-conto"><small>${esc(t("Accese", "On"))}</small><b class="dm-f-num">${accese.length}<em> / ${righe.length}</em></b></span>
      ${watt}
    </div>
    ${accese.length ? `${titolo(t("Accese", "On"))}<div class="dm-f-griglia">${accese.map(presaMarkup).join("")}</div>` : ""}
    ${spente.length ? `${titolo(t("Spente", "Off"))}<div class="dm-f-griglia">${spente.map(presaMarkup).join("")}</div>` : ""}
  </div>`;
}

/* ── Apri porte ───────────────────────────────────────────────────────── */

function tastoPorta(riga, gesto, parola, leggero = false) {
  const chiede = riga.pin && gesto !== "blocca";
  const invito = chiede ? `${parola} · ${t("chiede il PIN", "asks for the PIN")}` : parola;
  return `<button type="button" class="dm-f-porte-tasto" data-leggero="${leggero}" data-dm-door="${esc(riga.id)}"
    data-dm-door-gesto="${esc(gesto)}" title="${esc(invito)}" aria-label="${esc(`${invito}: ${riga.name}`)}">${esc(parola)}${
      chiede ? ' <span aria-hidden="true">🔐</span>' : ""
    }</button>`;
}

/** I tasti di un'apertura: quello che serve adesso, largo quanto la scheda. */
export function tastiDellaPorta(riga) {
  const gesti = Array.isArray(riga.gesti) ? riga.gesti : [];
  if (riga.dominio === "cover") {
    if (riga.aperta)
      return tastoServizio(
        { domain: "cover", service: "close_cover", data: { entity_id: riga.entity } },
        { classe: "dm-f-porte-tasto", testo: esc(t("Chiudi", "Close")) },
      );
    const apri = gesti.find((voce) => voce.gesto === "apri");
    return apri ? tastoPorta(riga, "apri", apri.parola) : "";
  }
  if (riga.dominio === "lock") {
    /* Tutti i gesti che la serratura offre (#34: sblocca, apri, blocca), in
     * quell'ordine. Pieno quello che serve adesso — chiudere se e' aperta, il
     * primo che apre se e' chiusa —, gli altri piu' leggeri. */
    const adesso = riga.aperta
      ? gesti.find((voce) => voce.gesto === "blocca")
      : gesti.find((voce) => voce.gesto !== "blocca");
    return gesti.map((voce) => tastoPorta(riga, voce.gesto, voce.parola, voce !== adesso)).join("");
  }
  /* Un impulso — pulsante, rele', script — non ha uno stato da invertire: il
   * tasto e' piu' leggero, perche' non dice «adesso e' chiuso». */
  return gesti.map((voce) => tastoPorta(riga, voce.gesto, voce.parola, true)).join("");
}

function statoDellaPorta(riga) {
  if (riga.muta) return { testo: t("Non risponde", "Not responding"), tono: "muta" };
  if (riga.aperta)
    return { testo: [riga.parola, daQuanto(riga.da)].filter(Boolean).join(" "), tono: "ko" };
  if (riga.chiusaAChiave) return { testo: `🔒 ${riga.parola}`, tono: "ok" };
  if (riga.dichiara) return { testo: riga.parola, tono: "" };
  return {
    testo: riga.ultima
      ? `${t("Ultima volta", "Last time")} ${orario(riga.ultima)}`
      : t("Impulso", "Pulse"),
    tono: "",
  };
}

function finestraPorte(widget) {
  const righe = Array.isArray(widget.righe) ? widget.righe : [];
  const aperte = righe.filter((riga) => riga.aperta);
  const dichiarano = righe.some((riga) => riga.dichiara);
  const avviso = aperte.length
    ? aperte
        .map(
          (riga) => `<div class="dm-f-porte-avviso" data-tono="ko">
        <span class="dm-f-porte-avviso-ic" aria-hidden="true">${riga.icona}</span>
        <span><b>${esc(riga.name)} · ${esc(riga.parola || t("Aperta", "Open"))}</b><small>${esc(
          [
            daQuanto(riga.da),
            aperte.length === 1 ? t("l'unica cosa aperta", "the only thing open") : "",
          ]
            .filter(Boolean)
            .join(" · "),
        )}</small></span>
      </div>`,
        )
        .join("")
    : dichiarano
      ? `<div class="dm-f-porte-avviso" data-tono="ok"><span class="dm-f-porte-avviso-ic" aria-hidden="true">✓</span><span><b>${esc(
          t("Tutto chiuso", "All closed"),
        )}</b></span></div>`
      : "";
  const schede = righe
    .map((riga) => {
      const stato = statoDellaPorta(riga);
      return `<article class="dm-f-porte-porta" data-tono="${stato.tono}">
        <span class="dm-f-porte-ic" aria-hidden="true">${riga.icona}</span>
        <b>${esc(riga.name)}</b>
        <small data-tono="${stato.tono}">${esc(stato.testo)}</small>
        <span class="dm-f-porte-tasti">${tastiDellaPorta(riga)}</span>
      </article>`;
    })
    .join("");
  const nota = [
    widget.conferma
      ? t("Chiede conferma prima di aprire", "Asks for confirmation before opening")
      : "",
    righe.some((riga) => riga.pin) ? `🔐 ${t("chiede il PIN", "asks for the PIN")}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const storia = righe
    .filter((riga) => Number.isFinite(riga.ultima))
    .sort((a, b) => b.ultima - a.ultima)
    .slice(0, 3);
  return `<div class="dm-f-porte">
    ${avviso}
    ${titolo(t("Le aperture", "The openers"))}
    <div class="dm-f-griglia dm-f-porte-griglia">${schede}</div>
    ${nota ? `<p class="dm-f-nota">${esc(nota)}</p>` : ""}
    ${
      storia.length
        ? `${titolo(t("Ultime aperture", "Latest openings"))}<div class="dm-f-storia">${storia
            .map(
              (riga) =>
                `<div><span>${esc([riga.name, riga.dichiara ? clean(riga.parola).toLowerCase() : ""].filter(Boolean).join(" · "))}</span><b class="dm-f-num">${esc(
                  orario(riga.ultima),
                )}</b></div>`,
            )
            .join("")}</div>`
        : ""
    }
  </div>`;
}

/* ── Musica ───────────────────────────────────────────────────────────── */

function tastoMp(riga, comando, etichetta, glifo, classe = "", centro = "") {
  return `<button type="button" class="dm-f-media-tasto ${esc(classe)}" data-dm-mp="${esc(comando)}"${
    centro ? ` data-centro="${esc(centro)}"` : ""
  } data-dm-mp-entity="${esc(riga.entity)}" aria-label="${esc(etichetta)}" title="${esc(etichetta)}">${glifo}</button>`;
}

const parolaDelCentro = (centro) =>
  centro === "accendi"
    ? t("Accendi", "Turn on")
    : centro === "pausa"
      ? t("Pausa", "Pause")
      : t("Riproduci", "Play");

/** Cosa fa una cassa, in parole: mai l'entity_id. */
export function statoDellaCassa(riga) {
  const stato = riga.muto
    ? t("Non risponde", "Not responding")
    : riga.suona
      ? t("In riproduzione", "Playing")
      : riga.inPausa
        ? t("In pausa", "Paused")
        : riga.spento
          ? t("Spenta", "Off")
          : t("Ferma", "Idle");
  const cosa = riga.spento || riga.muto ? "" : riga.titolo || riga.sorgente || riga.applicazione;
  return [stato, cosa].filter(Boolean).join(" · ");
}

function eroeMedia(riga) {
  const dove = [riga.nome, riga.sorgente || riga.applicazione].filter(Boolean).join(" · ");
  const sotto = [riga.artista, riga.album].filter(Boolean).join(" · ");
  const punto = posizioneOra(riga);
  const centro = ilTastoCentrale(riga);
  const percento = Math.round((riga.volume ?? 0) * 100);
  return `<div class="dm-f-media-eroe">
    <div class="dm-f-media-testa">
      ${
        riga.copertina
          ? `<img class="dm-f-media-arte" src="${esc(riga.copertina)}" alt="" aria-hidden="true">`
          : `<span class="dm-f-media-arte" aria-hidden="true">${riga.icona ? esc(riga.icona) : "🎵"}</span>`
      }
      <span class="dm-f-media-cosa">
        <small>${esc(dove)}</small>
        <b>${esc(riga.titolo || riga.sorgente || riga.applicazione || statoDellaCassa(riga))}</b>
        ${sotto ? `<em>${esc(sotto)}</em>` : ""}
      </span>
    </div>
    ${
      punto
        ? `<span class="dm-f-media-barra" aria-hidden="true"><i style="width:${(punto.quota * 100).toFixed(1)}%"></i></span>
           <span class="dm-f-media-tempi"><span>${esc(orologio(punto.secondi))}</span><span>${esc(orologio(punto.durata))}</span></span>`
        : ""
    }
    <div class="dm-f-media-cmd">
      ${riga.puo?.precedente ? tastoMp(riga, "precedente", t("Brano precedente", "Previous track"), GLIFI_MP.precedente) : ""}
      ${centro ? tastoMp(riga, "centro", parolaDelCentro(centro), GLIFI_MP[centro], "dm-f-media-centro") : ""}
      ${riga.puo?.successivo ? tastoMp(riga, "successivo", t("Brano successivo", "Next track"), GLIFI_MP.successivo) : ""}
    </div>
    ${
      riga.puo?.volume
        ? `<label class="dm-f-media-volume"><span aria-hidden="true">${GLIFI_MP.voce}</span>
            <input type="range" min="0" max="100" step="1" value="${percento}" style="--v:${percento}%" data-dm-mp-volume="${esc(riga.entity)}"
              aria-label="${esc(t("Volume", "Volume"))}">
            <b class="dm-f-num" data-dm-mp-percento>${percento}%</b></label>`
        : ""
    }
  </div>`;
}

function cassaMarkup(riga) {
  const centro = ilTastoCentrale(riga);
  return `<article class="dm-f-media-cassa" data-spenta="${riga.spento || riga.muto}">
    <span class="dm-f-media-ic" aria-hidden="true">${
      riga.copertina && !riga.spento
        ? `<img src="${esc(riga.copertina)}" alt="">`
        : esc(riga.icona || (riga.spento ? "📺" : "🔊"))
    }</span>
    <span class="dm-f-media-nome"><b>${esc(riga.nome)}</b><small>${esc(statoDellaCassa(riga))}</small></span>
    ${centro ? tastoMp(riga, "centro", parolaDelCentro(centro), GLIFI_MP[centro], "dm-f-media-uno", centro) : ""}
  </article>`;
}

function finestraMedia(widget) {
  const lettori = Array.isArray(widget.lettori) ? widget.lettori : [];
  const eroe = lettori.find((riga) => riga.suona) || null;
  const altre = lettori.filter((riga) => riga !== eroe);
  return `<div class="dm-f-media">
    ${eroe ? eroeMedia(eroe) : ""}
    ${
      altre.length
        ? `${titolo(eroe ? t("Le altre casse", "The other speakers") : t("Le casse", "Speakers"))}${altre
            .map(cassaMarkup)
            .join("")}`
        : ""
    }
  </div>`;
}

/* ── Citofono e posta ─────────────────────────────────────────────────── */

function parolaDellaCassetta(voce) {
  if (voce.muta) return t("Non risponde", "Not answering");
  if (voce.aperta === true) return t("Aperta", "Open");
  if (voce.ce === true) return t("C'è posta", "Mail inside");
  if (voce.ce === false) return t("Vuota", "Empty");
  return t("Non si sa", "Unknown");
}

function cassettaMarkup(voce, sola) {
  const arrivata =
    voce.ce === true && Number.isFinite(voce.arrivata)
      ? `${t("arrivata alle", "arrived at")} ${orario(voce.arrivata)} · ${quantoFa(voce.arrivata)}`
      : "";
  return `<div class="dm-f-citofono-eroe" data-tono="${voce.ce === true ? "posta" : "quiete"}">
    <div class="dm-f-citofono-riga">
      <span class="dm-f-citofono-ic" aria-hidden="true">${voce.ce === true ? "📬" : "📭"}</span>
      <span><small>${esc(sola || !voce.nome ? t("Cassetta", "Mailbox") : voce.nome)}</small><b>${esc(
        parolaDellaCassetta(voce),
      )}</b>${arrivata ? `<em>${esc(arrivata)}</em>` : ""}</span>
    </div>
    ${
      voce.ce === true
        ? `<button type="button" class="dm-f-citofono-presa" data-dm-cassetta-presa="${esc(voce.id)}">${SPUNTA} ${esc(
            t("L'ho presa", "Got it"),
          )}</button>`
        : ""
    }
  </div>`;
}

function citofonoMarkup(voce, solo) {
  const suona = voce.suona === true;
  const apri =
    voce.puoAprire && voce.comando
      ? tastoServizio(voce.comando, {
          classe: "dm-f-citofono-apri",
          conferma: t("Tocca ancora per aprire", "Tap again to open"),
          testo: `<span class="dm-f-citofono-apri-ic" aria-hidden="true">🔓</span><span><b>${esc(
            solo ? t("Apri il cancello", "Open the gate") : `${t("Apri", "Open")} · ${voce.nome}`,
          )}</b><small>${esc(t("Due tocchi per aprire", "Two taps to open"))}</small></span>`,
        })
      : "";
  if (!suona) return apri;
  return `<div class="dm-f-citofono-eroe" data-tono="suona">
    <div class="dm-f-citofono-riga">
      <span class="dm-f-citofono-ic" aria-hidden="true">🔔</span>
      <span><small>${esc(voce.nome || t("Citofono", "Intercom"))}</small><b>${esc(
        t("C'è qualcuno alla porta", "Someone is at the door"),
      )}</b>${Number.isFinite(voce.squillo) ? `<em>${esc(quantoFa(voce.squillo))}</em>` : ""}</span>
    </div>
    ${apri}
  </div>`;
}

function finestraCitofono(widget) {
  const citofoni = Array.isArray(widget.citofoni) ? widget.citofoni : [];
  const cassette = Array.isArray(widget.cassette) ? widget.cassette : [];
  const suonano = citofoni.filter((voce) => voce.suona === true);
  const quieti = citofoni.filter((voce) => voce.suona !== true);
  const cose = [
    ...citofoni
      .filter((voce) => Number.isFinite(voce.squillo))
      .map((voce) => ({
        quando: voce.squillo,
        ic: "🔔",
        cosa: t("Hanno suonato", "Someone rang"),
        dove: citofoni.length > 1 ? voce.nome : "",
      })),
    ...cassette.flatMap((voce) => [
      ...(Number.isFinite(voce.arrivata)
        ? [
            {
              quando: voce.arrivata,
              ic: "📬",
              cosa: t("Posta arrivata", "Mail arrived"),
              dove: cassette.length > 1 ? voce.nome : "",
            },
          ]
        : []),
      ...(Number.isFinite(voce.ritirata)
        ? [
            {
              quando: voce.ritirata,
              ic: "📭",
              cosa: t("Posta ritirata", "Mail collected"),
              dove: voce.ritiroAMano
                ? t("Segnata a mano", "Marked by hand")
                : t("Cassetta aperta", "Mailbox opened"),
            },
          ]
        : []),
    ]),
  ]
    .sort((a, b) => b.quando - a.quando)
    .slice(0, 4);
  const cancelli = quieti
    .map((voce) => citofonoMarkup(voce, citofoni.length === 1))
    .filter(Boolean);
  return `<div class="dm-f-citofono">
    ${suonano.map((voce) => citofonoMarkup(voce, citofoni.length === 1)).join("")}
    ${cassette.map((voce) => cassettaMarkup(voce, cassette.length === 1)).join("")}
    ${cancelli.length ? `${titolo(t("Cancello", "Gate"))}${cancelli.join("")}` : ""}
    ${
      cose.length
        ? `${titolo(t("Ultime cose", "Latest events"))}${cose
            .map(
              (cosa) => `<div class="dm-f-citofono-cosa"><span aria-hidden="true">${cosa.ic}</span>
          <span><b>${esc(cosa.cosa)}</b>${cosa.dove ? `<small>${esc(cosa.dove)}</small>` : ""}</span>
          <b class="dm-f-num">${esc(orario(cosa.quando))}</b></div>`,
            )
            .join("")}`
        : ""
    }
  </div>`;
}

/* ── Robot ────────────────────────────────────────────────────────────── */

const SCARICA = 20;

function tastoRobot(riga, azione, testo, classe) {
  const comando = robotCommand(azione, riga);
  if (!comando) return "";
  return tastoServizio(comando, { classe, testo });
}

const saFare = (riga, azione) => robotActions(riga).some((voce) => voce.act === azione);

function disegnoDelRobot(riga, misura) {
  return (
    disegnoDelCatalogo(
      riga.species === "lawn_mower" ? "mower" : riga.cleaning ? "broom" : "robot",
      misura,
    ) || "🤖"
  );
}

function eroeRobot(riga) {
  const batteria = Number.isFinite(riga.battery) ? Math.round(riga.battery) : null;
  const dettagli = [
    riga.room,
    daQuanto(riga.da),
    riga.fanSpeed ? `${t("Potenza", "Power")} ${riga.fanSpeed}` : "",
  ].filter(Boolean);
  const tasti = [
    saFare(riga, "pause")
      ? tastoRobot(
          riga,
          "pause",
          `${GLIFI_MP.pausa} ${esc(t("Pausa", "Pause"))}`,
          "dm-f-tasto dm-f-pieno",
        )
      : "",
    saFare(riga, "return")
      ? tastoRobot(riga, "return", `${CASA} ${esc(t("Alla base", "Dock"))}`, "dm-f-tasto")
      : "",
  ].filter(Boolean);
  return `<div class="dm-f-robot-eroe">
    <div class="dm-f-robot-riga">
      ${
        batteria == null
          ? `<span class="dm-f-robot-anello" data-vuoto="true" aria-hidden="true">${disegnoDelRobot(riga, 40)}</span>`
          : `<span class="dm-f-robot-anello" data-scarica="${batteria < SCARICA}" style="--p:${batteria}"><span><b class="dm-f-num">${batteria}%</b><small>${esc(
              t("batteria", "battery"),
            )}</small></span></span>`
      }
      <span class="dm-f-robot-chi">
        <span class="dm-f-robot-chip"><i aria-hidden="true"></i>${esc(robotStateLabel(riga.state))}</span>
        <b>${esc(riga.name)}</b>
        ${dettagli.length ? `<small>${esc(dettagli.join(" · "))}</small>` : ""}
      </span>
    </div>
    ${tasti.length ? `<div class="dm-f-robot-tasti" data-quanti="${tasti.length}">${tasti.join("")}</div>` : ""}
  </div>`;
}

function robotMarkup(riga) {
  const batteria = Number.isFinite(riga.battery) ? Math.round(riga.battery) : null;
  const stato = [
    robotStateLabel(riga.state),
    batteria == null ? "" : `${batteria}%`,
    riga.state === "error" && riga.error ? riga.error : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const avvia =
    riga.available && saFare(riga, "start")
      ? tastoRobot(
          riga,
          "start",
          `${GLIFI_MP.suona} ${esc(t("Avvia", "Start"))}`,
          "dm-f-robot-avvia",
        )
      : "";
  return `<article class="dm-f-robot-robot">
    <span class="dm-f-robot-ic" aria-hidden="true">${disegnoDelRobot(riga, 24)}</span>
    <span class="dm-f-robot-nome"><b>${esc(riga.name)}</b><small>${esc(stato)}</small>${
      batteria == null
        ? ""
        : `<span class="dm-f-robot-bat" data-scarica="${batteria < SCARICA}" aria-hidden="true"><i style="width:${batteria}%"></i></span>`
    }</span>
    ${avvia}
  </article>`;
}

function finestraRobot(widget) {
  const righe = Array.isArray(widget.rows) ? widget.rows : [];
  const eroe = righe.find((riga) => riga.cleaning || riga.mowing) || null;
  const altri = righe.filter((riga) => riga !== eroe);
  return `<div class="dm-f-robot">
    ${eroe ? eroeRobot(eroe) : ""}
    ${altri.length ? `${titolo(eroe ? t("Gli altri", "The others") : t("I robot", "The robots"))}${altri.map(robotMarkup).join("")}` : ""}
  </div>`;
}

/* ── lo stile ─────────────────────────────────────────────────────────── */

const A = "var(--dm-widget-accent,#6366f1)";
const tinta = (quanto) => `color-mix(in srgb,${A} ${quanto}%,var(--card-bg,#fff))`;
const bordo = (quanto) => `color-mix(in srgb,${A} ${quanto}%,var(--card-border,#e2e8f0))`;
const FONDO = "var(--card-bg,#fff)";
const TESTO = "var(--text,#0f172a)";
const SPENTO = "var(--text-dim,#64748b)";
const LINEA = "var(--card-border,#e8edf3)";

const STILE = `
${P} .dm-f-num{font-family:'Oswald',sans-serif;font-weight:600;font-variant-numeric:tabular-nums}
${P} .dm-f-tit{margin:18px 2px 9px;font-size:10.5px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:${SPENTO}}
${P} .dm-f-griglia{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:9px}
${P} .dm-f-nota{margin:12px 2px 0;font-size:12px;font-weight:700;line-height:1.4;color:${SPENTO};text-align:center}
${P} .dm-f-tasto{display:flex;align-items:center;justify-content:center;gap:8px;min-height:50px;padding:0 12px;border-radius:16px;
  font:inherit;font-size:14px;font-weight:850;cursor:pointer;background:${FONDO};border:1px solid ${bordo(40)};color:${A}}
${P} .dm-f-tasto.dm-f-pieno{background:${A};border-color:${A};color:#fff}
${P} .dm-f-tasto svg{flex:0 0 auto;width:18px;height:18px}
${P} .dm-f-storia{border-radius:18px;background:${tinta(4)};border:1px solid ${LINEA};padding:2px 14px}
${P} .dm-f-storia>div{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:10px 0;font-size:13px;font-weight:750;color:${TESTO};border-bottom:1px solid ${LINEA}}
${P} .dm-f-storia>div:last-child{border-bottom:0}
${P} .dm-f-storia .dm-f-num{color:${SPENTO};font-size:14px;white-space:nowrap}

/* Finestre e tapparelle */
${P} .dm-f-tapparelle-eroi{display:grid;grid-template-columns:1fr 1fr;gap:9px}
${P} .dm-f-tapparelle-eroi[data-quanti="1"]{grid-template-columns:1fr}
${P} .dm-f-tapparelle-eroe{min-width:0;border-radius:22px;padding:14px 15px;background:linear-gradient(155deg,${tinta(6)},${tinta(13)});border:1px solid ${bordo(32)}}
${P} .dm-f-tapparelle-eroe small{display:block;font-size:10.5px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:${A}}
${P} .dm-f-tapparelle-eroe .dm-f-num{display:block;font-size:44px;line-height:1;margin:6px 0 4px;color:${TESTO}}
${P} .dm-f-tapparelle-eroe em{display:block;font-style:normal;font-size:12.5px;font-weight:750;line-height:1.35;color:${SPENTO};overflow-wrap:anywhere}
${P} .dm-f-tapparelle-eroe-ic{display:flex;align-items:center;gap:14px;grid-column:1/-1}
${P} .dm-f-tapparelle-vetro{position:relative;flex:0 0 auto;width:74px;height:74px;border-radius:22px;display:grid;place-items:center;background:${FONDO};box-shadow:0 10px 22px -12px ${bordo(60)}}
${P} .dm-f-tapparelle-vetro b{position:absolute;right:-7px;top:-7px;min-width:28px;padding:1px 8px;border-radius:999px;background:${A};color:#fff;border:3px solid ${FONDO};font-family:'Oswald',sans-serif;font-size:15px;text-align:center}
${P} .dm-f-tapparelle-eroe-testo{flex:1;min-width:0}
${P} .dm-f-tapparelle-eroe .dm-f-num span{font-size:20px;margin-left:8px;color:${SPENTO}}
${P} .dm-f-tapparelle-chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}
${P} .dm-f-tapparelle-chip{display:inline-flex;align-items:center;gap:5px;padding:3px 10px 3px 4px;border-radius:999px;background:${FONDO};border:1px solid ${bordo(30)};font-size:12px;font-weight:850;color:${TESTO}}
${P} .dm-f-tapparelle-chip>*:first-child{flex:0 0 22px;width:22px!important;height:22px!important;min-width:0!important;padding:0!important;margin:0!important;border:0!important;background:none!important;box-shadow:none!important;display:grid;place-items:center;overflow:hidden}
${P} .dm-f-tapparelle-eroi:has(.dm-f-tapparelle-eroe-ic){grid-template-columns:1fr}
${P} .dm-f-tapparelle-ic{position:relative;flex:0 0 auto;width:50px;height:50px;border-radius:16px;display:grid;place-items:center;background:color-mix(in srgb,${SPENTO} 9%,${FONDO})}
${P} .dm-f-tapparelle-ic[data-viva="true"]{background:${tinta(9)}}
${P} .dm-f-tapparelle-ic>i{position:absolute;right:-6px;bottom:-6px;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;background:${FONDO};box-shadow:0 2px 6px rgba(15,23,42,.18)}
${P} .dm-f-tapparelle-nome small{display:inline-flex;align-items:center;gap:5px}
${P} .dm-f-tapparelle-tutte{display:grid;grid-template-columns:1fr 1fr 60px;gap:8px;margin-top:10px}
${P} .dm-f-tapparelle-stanza{padding:12px 12px 12px 14px;border-radius:20px;background:${FONDO};border:1px solid ${LINEA};margin-bottom:8px;box-shadow:0 10px 22px -22px rgba(15,23,42,.6)}
${P} .dm-f-tapparelle-stanza[data-viva="true"]{border-color:${bordo(32)};background:linear-gradient(180deg,${tinta(3)},${FONDO})}
${P} .dm-f-tapparelle-riga{display:flex;align-items:center;gap:10px}
${P} .dm-f-tapparelle-piccola{margin-top:8px;justify-content:space-between}
${P} .dm-f-tapparelle-piccola small,${P} .dm-f-tapparelle-tipo{font-size:12px;font-weight:750;color:${SPENTO}}
${P} .dm-f-tapparelle-motore .dm-f-tapparelle-riga{justify-content:space-between;margin-top:10px}
${P} .dm-f-tapparelle-nome{flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:3px}
${P} .dm-f-tapparelle-nome b{font-size:15px;font-weight:850;color:${TESTO};overflow-wrap:anywhere}
${P} .dm-f-tapparelle-nome small{font-size:12px;font-weight:750;color:${SPENTO}}
${P} .dm-f-tapparelle-ante{display:flex;flex-wrap:wrap;gap:4px}
${P} .dm-f-tapparelle-anta{display:inline-flex;align-items:center;gap:6px;padding:3px 9px;border-radius:999px;font-size:11.5px;font-weight:850;background:color-mix(in srgb,${SPENTO} 12%,transparent);color:${SPENTO}}
${P} .dm-f-tapparelle-anta[data-aperta="true"]{background:${tinta(14)};color:${A}}
${P} .dm-f-tapparelle-anta i{width:8px;height:8px;border-radius:50%;background:currentColor}
${P} .dm-f-tapparelle-frecce{display:flex;gap:6px;flex:0 0 auto}
${P} .dm-f-tapparelle-freccia{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;padding:0;cursor:pointer;
  background:${tinta(6)};border:1px solid ${bordo(25)};color:${A}}
${P} .dm-f-tapparelle-barra{display:block;height:6px;border-radius:999px;background:color-mix(in srgb,${SPENTO} 14%,transparent);margin-top:10px;overflow:hidden}
${P} .dm-f-tapparelle-barra i{display:block;height:100%;border-radius:999px;background:${A}}
${P} .dm-f-tapparelle-sotto{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:5px;font-size:11.5px;font-weight:750;color:${SPENTO}}
${P} .dm-f-tapparelle-sotto>span{flex:1}
${P} .dm-f-tapparelle-sotto b{font-family:'Oswald',sans-serif;font-weight:600;font-size:14px;color:${TESTO}}
${P} .dm-f-tapparelle-pos{height:26px;border-radius:9px;border:1px solid ${bordo(25)};background:${FONDO};color:${A};font:inherit;font-size:12px;font-weight:800;padding:0 4px}

/* Prese */
${P} .dm-f-eroe{display:flex;align-items:center;gap:16px;border-radius:24px;padding:16px 18px;background:linear-gradient(155deg,${tinta(3)},${tinta(11)});border:1px solid ${bordo(30)}}
${P} .dm-f-prese-eroe small{display:block;font-size:10.5px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:${SPENTO}}
${P} .dm-f-prese-conto .dm-f-num{font-size:46px;line-height:1;color:${TESTO}}
${P} .dm-f-prese-eroe em{font-style:normal;font-size:22px;color:${SPENTO}}
${P} .dm-f-prese-watt{margin-left:auto;text-align:right}
${P} .dm-f-prese-watt .dm-f-num{display:block;font-size:26px;color:${TESTO}}
${P} .dm-f-prese-watt small{letter-spacing:0;text-transform:none;font-size:12px;font-weight:750}
${P} .dm-f-prese-presa{position:relative;display:flex;flex-direction:column;min-height:112px;padding:13px;border-radius:20px;background:${FONDO};border:1px solid ${LINEA};box-shadow:0 10px 22px -22px rgba(15,23,42,.6)}
/* La presa accesa si colora come la luce accesa nella finestra Luci: il
   giallo dice «acceso» in tutta la plancia, e sul colore della sezione (un
   grigio) le prese accese non si distinguevano dalle spente. Il fondo e'
   chiaro in tutti e due i temi, quindi le scritte sopra vanno scure. */
${P} .dm-f-prese-presa[data-on="true"]{border-color:color-mix(in srgb,#f59e0b 45%,transparent);
  background:radial-gradient(120% 90% at 18% 0%,rgba(253,224,71,.55),transparent 62%),linear-gradient(160deg,#fffbeb,#fef3c7);
  box-shadow:0 14px 26px -18px rgba(217,119,6,.75)}
${P} .dm-f-prese-presa[data-on="true"] b{color:#451a03}
${P} .dm-f-prese-presa[data-on="true"] small,${P} .dm-f-prese-presa[data-on="true"] .dm-f-prese-lucchetto{color:#b45309}
${P} .dm-f-prese-presa[data-muta="true"]{opacity:.6;border-style:dashed;box-shadow:none}
${P} .dm-f-prese-ic{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;font-size:19px;background:color-mix(in srgb,${SPENTO} 10%,transparent);color:${SPENTO}}
${P} .dm-f-prese-presa[data-on="true"] .dm-f-prese-ic{background:#fff;color:#b45309;box-shadow:0 0 0 4px rgba(253,224,71,.35),0 0 18px rgba(250,204,21,.8)}
${P} .dm-f-prese-presa b{margin-top:auto;padding-top:10px;font-size:14.5px;font-weight:850;line-height:1.2;color:${TESTO};overflow-wrap:anywhere}
${P} .dm-f-prese-presa small{margin-top:2px;font-size:12px;font-weight:750;color:${SPENTO}}
${P} .dm-f-prese-int{position:absolute;top:13px;right:13px;width:46px;height:28px;padding:0;border:0;border-radius:999px;cursor:pointer;background:color-mix(in srgb,${SPENTO} 25%,transparent)}
${P} .dm-f-prese-int i{position:absolute;top:4px;left:4px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:left .18s}
${P} .dm-f-prese-int[data-on="true"]{background:#f59e0b}
${P} .dm-f-prese-int[data-on="true"] i{left:22px}
${P} .dm-f-prese-lucchetto{position:absolute;top:15px;right:13px;font-size:11px;font-weight:850;color:${SPENTO}}

/* Apri porte */
${P} .dm-f-porte-avviso{display:flex;align-items:center;gap:13px;margin-bottom:8px;border-radius:22px;padding:14px 16px;border:1px solid #fecaca;background:linear-gradient(155deg,color-mix(in srgb,#dc2626 5%,${FONDO}),color-mix(in srgb,#dc2626 13%,${FONDO}))}
${P} .dm-f-porte-avviso[data-tono="ok"]{border-color:color-mix(in srgb,#16a34a 35%,${LINEA});background:color-mix(in srgb,#16a34a 8%,${FONDO})}
${P} .dm-f-porte-avviso-ic{flex:0 0 auto;font-size:24px;line-height:1;display:grid;place-items:center}
${P} .dm-f-porte-avviso[data-tono="ok"] .dm-f-porte-avviso-ic{font-size:18px;font-weight:900;color:#15803d}
${P} .dm-f-porte-avviso b{display:block;font-size:16px;font-weight:850;color:#b91c1c}
${P} .dm-f-porte-avviso[data-tono="ok"] b{color:#15803d;font-size:15px}
${P} .dm-f-porte-avviso small{font-size:12.5px;font-weight:750;color:#dc2626}
${P} .dm-f-porte-porta{display:flex;flex-direction:column;min-height:168px;padding:14px;border-radius:22px;background:${FONDO};border:1px solid ${LINEA};box-shadow:0 12px 24px -22px rgba(15,23,42,.6)}
${P} .dm-f-porte-porta[data-tono="ko"]{border-color:#fecaca}
${P} .dm-f-porte-ic{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;font-size:21px;background:color-mix(in srgb,var(--dm-f-porte-tasto) 11%,${FONDO})}
${P} .dm-f-porte-porta>b{margin-top:12px;font-size:15px;font-weight:850;color:${TESTO};overflow-wrap:anywhere}
${P} .dm-f-porte-porta>small{margin-top:2px;font-size:12px;font-weight:750;color:${SPENTO}}
${P} .dm-f-porte-porta>small[data-tono="ok"]{color:#15803d}
${P} .dm-f-porte-porta>small[data-tono="ko"]{color:#b91c1c}
${P} .dm-f-porte-tasti{display:grid;gap:6px;margin-top:auto;padding-top:12px}
/* I tasti hanno il colore dei comandi, non quello della tessera: la tessera si
 * fa rossa quando qualcosa e' aperto, e un «Sblocca» rosso sembra un allarme. */
${P} .dm-f-porte{--dm-f-porte-tasto:#0284c7}
${P} .dm-f-porte-tasto{display:flex;align-items:center;justify-content:center;gap:6px;min-height:46px;border:0;border-radius:14px;cursor:pointer;font:inherit;font-size:14px;font-weight:850;background:var(--dm-f-porte-tasto);color:#fff}
${P} .dm-f-porte-tasto[data-leggero="true"]{background:color-mix(in srgb,var(--dm-f-porte-tasto) 13%,${FONDO});color:var(--dm-f-porte-tasto)}
:root[data-theme="dark"] ${P} .dm-f-porte-avviso b,:root[data-theme="dark"] ${P} .dm-f-porte-porta>small[data-tono="ko"]{color:#fca5a5}
:root[data-theme="dark"] ${P} .dm-f-porte-avviso small{color:#fecaca}

/* Musica */
${P} .dm-f-media-eroe{border-radius:26px;padding:16px;color:#fff;background:linear-gradient(160deg,color-mix(in srgb,${A} 45%,#0b0420),color-mix(in srgb,${A} 80%,#1e0b3d) 60%,${A});box-shadow:0 20px 40px -28px color-mix(in srgb,${A} 90%,#000)}
${P} .dm-f-media-testa{display:flex;gap:14px;align-items:center}
${P} .dm-f-media-arte{flex:0 0 96px;width:96px;height:96px;border-radius:18px;object-fit:cover;display:grid;place-items:center;font-size:40px;background:rgba(255,255,255,.14);box-shadow:0 10px 24px -12px rgba(0,0,0,.6)}
${P} .dm-f-media-cosa{min-width:0;display:flex;flex-direction:column}
${P} .dm-f-media-cosa small{font-size:10.5px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.72)}
${P} .dm-f-media-cosa b{margin:3px 0 2px;font-size:22px;font-weight:850;line-height:1.15;overflow-wrap:anywhere}
${P} .dm-f-media-cosa em{font-style:normal;font-size:13.5px;font-weight:700;color:rgba(255,255,255,.82)}
${P} .dm-f-media-barra{display:block;margin-top:16px;height:5px;border-radius:999px;background:rgba(255,255,255,.22);overflow:hidden}
${P} .dm-f-media-barra i{display:block;height:100%;border-radius:999px;background:#fff}
${P} .dm-f-media-tempi{display:flex;justify-content:space-between;margin-top:5px;font-size:11.5px;font-weight:750;color:rgba(255,255,255,.72)}
${P} .dm-f-media-cmd{display:flex;justify-content:center;align-items:center;gap:20px;margin-top:10px}
${P} .dm-f-media-tasto{width:48px;height:48px;border-radius:50%;display:grid;place-items:center;padding:0;border:0;cursor:pointer;color:#fff;background:rgba(255,255,255,.14)}
${P} .dm-f-media-tasto svg{width:20px;height:20px}
${P} .dm-f-media-centro{width:66px;height:66px;background:#fff;color:color-mix(in srgb,${A} 70%,#000)}
${P} .dm-f-media-centro svg{width:26px;height:26px}
${P} .dm-f-media-volume{display:flex;align-items:center;gap:10px;margin-top:14px}
${P} .dm-f-media-volume svg{width:18px;height:18px}
${P} .dm-f-media-volume input{flex:1;min-width:0;height:6px;margin:0;border-radius:999px;-webkit-appearance:none;appearance:none;
  background:linear-gradient(90deg,#fff var(--v,0%),rgba(255,255,255,.22) var(--v,0%))}
${P} .dm-f-media-volume input::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.35)}
${P} .dm-f-media-volume input::-moz-range-thumb{width:18px;height:18px;border:0;border-radius:50%;background:#fff}
${P} .dm-f-media-volume .dm-f-num{width:42px;text-align:right;font-size:15px}
${P} .dm-f-media-cassa{display:flex;align-items:center;gap:12px;padding:11px 12px;margin-bottom:8px;border-radius:18px;background:${FONDO};border:1px solid ${LINEA};box-shadow:0 10px 22px -22px rgba(15,23,42,.6)}
${P} .dm-f-media-cassa[data-spenta="true"]{opacity:.75}
${P} .dm-f-media-ic{flex:0 0 44px;width:44px;height:44px;border-radius:13px;display:grid;place-items:center;font-size:20px;overflow:hidden;background:${tinta(12)}}
${P} .dm-f-media-ic img{width:100%;height:100%;object-fit:cover}
${P} .dm-f-media-nome{flex:1;min-width:0}
${P} .dm-f-media-nome b{display:block;font-size:14.5px;font-weight:850;color:${TESTO}}
${P} .dm-f-media-nome small{display:block;font-size:12px;font-weight:750;color:${SPENTO};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${P} .dm-f-media-uno{width:44px;height:44px;background:${A};color:#fff}
${P} .dm-f-media-uno[data-centro="accendi"]{background:color-mix(in srgb,${SPENTO} 12%,transparent);color:${SPENTO}}
${P} .dm-f-media-uno svg{width:17px;height:17px}

/* Citofono e posta */
${P} .dm-f-citofono-eroe{margin-bottom:8px;border-radius:24px;padding:18px;background:linear-gradient(155deg,${tinta(5)},${tinta(14)});border:1px solid ${bordo(35)}}
${P} .dm-f-citofono-eroe[data-tono="quiete"]{background:${FONDO};border-color:${LINEA}}
${P} .dm-f-citofono-riga{display:flex;align-items:center;gap:14px}
${P} .dm-f-citofono-ic{flex:0 0 60px;width:60px;height:60px;border-radius:18px;display:grid;place-items:center;font-size:30px;background:${FONDO};box-shadow:inset 0 0 0 1px ${bordo(30)}}
${P} .dm-f-citofono-riga>span:last-child{min-width:0;display:flex;flex-direction:column}
${P} .dm-f-citofono-riga small{font-size:10.5px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:${A}}
${P} .dm-f-citofono-riga b{margin-top:2px;font-size:24px;font-weight:850;line-height:1.15;color:${TESTO}}
${P} .dm-f-citofono-riga em{font-style:normal;font-size:13px;font-weight:750;color:${A}}
${P} .dm-f-citofono-presa{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;height:48px;margin-top:14px;border-radius:15px;cursor:pointer;font:inherit;font-size:14.5px;font-weight:850;background:${FONDO};border:1px solid ${bordo(35)};color:${A}}
${P} .dm-f-citofono-apri{display:flex;align-items:center;gap:14px;width:100%;margin:0 0 8px;padding:16px 18px;border:0;border-radius:24px;cursor:pointer;font:inherit;text-align:left;background:${A};color:#fff;box-shadow:0 16px 30px -20px ${A}}
${P} .dm-f-citofono-eroe .dm-f-citofono-apri{margin:14px 0 0}
${P} .dm-f-citofono-apri-ic{flex:0 0 52px;width:52px;height:52px;border-radius:16px;display:grid;place-items:center;font-size:24px;background:rgba(255,255,255,.18)}
${P} .dm-f-citofono-apri b{display:block;font-size:19px;font-weight:850}
${P} .dm-f-citofono-apri small{font-size:12.5px;font-weight:750;color:rgba(255,255,255,.85)}
${P} .dm-f-citofono-cosa{display:flex;align-items:center;gap:12px;margin-bottom:8px;padding:12px 14px;border-radius:18px;background:${FONDO};border:1px solid ${LINEA}}
${P} .dm-f-citofono-cosa>span:first-child{font-size:20px}
${P} .dm-f-citofono-cosa>span:nth-child(2){flex:1;min-width:0;display:flex;flex-direction:column}
${P} .dm-f-citofono-cosa>span b{font-size:14.5px;font-weight:850;color:${TESTO}}
${P} .dm-f-citofono-cosa small{font-size:12px;font-weight:750;color:${SPENTO}}
${P} .dm-f-citofono-cosa>.dm-f-num{font-size:15px;color:${SPENTO};white-space:nowrap}

/* Robot */
${P} .dm-f-robot-eroe{border-radius:26px;padding:16px;background:linear-gradient(160deg,${tinta(4)},${tinta(14)});border:1px solid ${bordo(35)}}
${P} .dm-f-robot-riga{display:flex;align-items:center;gap:14px}
${P} .dm-f-robot-anello{--p:0;position:relative;flex:0 0 96px;width:96px;height:96px;border-radius:50%;display:grid;place-items:center;
  background:conic-gradient(${A} calc(var(--p)*1%),${tinta(18)} 0)}
${P} .dm-f-robot-anello[data-scarica="true"]{background:conic-gradient(#dc2626 calc(var(--p)*1%),color-mix(in srgb,#dc2626 15%,${FONDO}) 0)}
${P} .dm-f-robot-anello::after{content:"";position:absolute;inset:9px;border-radius:50%;background:${tinta(4)}}
${P} .dm-f-robot-anello[data-vuoto="true"]{background:${tinta(14)}}
${P} .dm-f-robot-anello>*{position:relative;z-index:1}
${P} .dm-f-robot-anello>span{display:flex;flex-direction:column;align-items:center}
${P} .dm-f-robot-anello .dm-f-num{font-size:26px;line-height:1;color:${TESTO}}
${P} .dm-f-robot-anello small{font-size:9.5px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:${SPENTO}}
${P} .dm-f-robot-chi{min-width:0;display:flex;flex-direction:column;align-items:flex-start}
${P} .dm-f-robot-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;font-size:11.5px;font-weight:850;background:${FONDO};color:${A}}
${P} .dm-f-robot-chip i{width:8px;height:8px;border-radius:50%;background:${A};box-shadow:0 0 0 4px ${tinta(25)}}
${P} .dm-f-robot-chi b{margin-top:7px;font-size:18px;font-weight:850;line-height:1.2;color:${TESTO};overflow-wrap:anywhere}
${P} .dm-f-robot-chi small{margin-top:3px;font-size:12.5px;font-weight:750;color:${SPENTO}}
${P} .dm-f-robot-tasti{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}
${P} .dm-f-robot-tasti[data-quanti="1"]{grid-template-columns:1fr}
${P} .dm-f-robot-robot{display:flex;align-items:center;gap:12px;margin-bottom:8px;padding:12px;border-radius:20px;background:${FONDO};border:1px solid ${LINEA};box-shadow:0 10px 22px -22px rgba(15,23,42,.6)}
${P} .dm-f-robot-ic{flex:0 0 46px;width:46px;height:46px;border-radius:14px;display:grid;place-items:center;font-size:22px;background:${tinta(10)};color:${A}}
${P} .dm-f-robot-nome{flex:1;min-width:0;display:flex;flex-direction:column}
${P} .dm-f-robot-nome b{font-size:14.5px;font-weight:850;color:${TESTO};overflow-wrap:anywhere}
${P} .dm-f-robot-nome small{margin-top:2px;font-size:12px;font-weight:750;color:${SPENTO}}
${P} .dm-f-robot-bat{display:block;width:56px;height:6px;margin-top:6px;border-radius:999px;overflow:hidden;background:color-mix(in srgb,${SPENTO} 18%,transparent)}
${P} .dm-f-robot-bat i{display:block;height:100%;background:${A}}
${P} .dm-f-robot-bat[data-scarica="true"] i{background:#dc2626}
${P} .dm-f-robot-avvia{display:flex;align-items:center;gap:6px;flex:0 0 auto;padding:12px 15px;border:0;border-radius:14px;cursor:pointer;font:inherit;font-size:13.5px;font-weight:850;background:${tinta(12)};color:${A}}
${P} .dm-f-robot-avvia svg,${P} .dm-f-robot-tasti svg{width:16px;height:16px}
`;

/* ── la registrazione ─────────────────────────────────────────────────── */

registraFinestra("tapparelle", { disegna: finestraTapparelle, stile: STILE });
registraFinestra("prese", { disegna: finestraPrese });
registraFinestra("porte", { disegna: finestraPorte });
registraFinestra("media", { disegna: finestraMedia });
registraFinestra("citofono", { disegna: finestraCitofono });
registraFinestra("robot", { disegna: finestraRobot });
