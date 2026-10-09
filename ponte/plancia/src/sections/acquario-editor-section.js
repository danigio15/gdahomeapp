/* La vasca in configurazione: acquari e terrari, dentro la scheda Animali (#127).
 *
 * L'Acquario aveva una scheda sua nel Config, con una vasca sola. Adesso una
 * vasca è una voce degli Animali — si sceglie «Acquario» o «Terrario» nella
 * tendina del tipo — e la sua riga, aperta, ha al posto della ciotola e della
 * lettiera quello che di una vasca è davvero proprio:
 *
 *   · in cima la vasca, che vale per tutte le righe: i litri, ogni quanti
 *     giorni si cambia l'acqua e quando è stata cambiata l'ultima volta — per
 *     un terrario la pulizia, che è facoltativa;
 *   · sotto un'entità per riga, e in ogni riga cosa è, come nell'Acqua e gas:
 *     una misura con la sua forcella, il livello con la soglia del rabbocco, o
 *     un comando — e dentro la riga solo le caselle di quel genere. I generi
 *     sono quelli del tipo: il terrario ha l'umidità, la lampada calda, l'UVB
 *     e il nebulizzatore; l'acquario il pH e il filtro.
 *
 * Qui ci sono i pezzi; li monta la scheda degli Animali, che li salva insieme
 * al resto della voce con lo stesso 💾.
 */
import {
  CAMBIO_OGNI_GIORNI,
  MISURE,
  disegnoDelGenere,
  forcellaDiSerie,
  genereDelSensore,
  genereValido,
  generiDelTipo,
  righeDaImportare,
  tipoValido,
} from "../core/l-acquario-di-casa.js";
import { allStates, clean, disegnoDiCasa, esc, formatNumber, installStyle, t } from "./shared.js";
import { nomeDaHomeAssistant } from "./editor-slots-section.js";

/* I numeri di ogni genere: quelli che la riga tiene, gli altri se ne vanno
 * quando il genere cambia. */
const NUMERI = Object.freeze(["minimo", "massimo", "soglia"]);

function numeriDelGenere(genere, entity = "") {
  if (MISURE.includes(genere)) return ["minimo", "massimo"];
  if (genere === "livello" && !clean(entity).startsWith("binary_sensor.")) return ["soglia"];
  return [];
}

/** Come si chiama ogni genere nella tendina, per questo tipo. */
export function nomeDelGenere(genere, tipo = "acquario") {
  const terrario = tipoValido(tipo) === "terrario";
  switch (genere) {
    case "temperatura":
      return terrario
        ? t("Temperatura (lato caldo)", "Temperature (warm side)")
        : t("Temperatura dell'acqua", "Water temperature");
    case "temperatura_fresca":
      return t("Temperatura (lato fresco)", "Temperature (cool side)");
    case "umidita":
      return t("Umidità", "Humidity");
    case "ph":
      return "pH";
    case "misura":
      return terrario
        ? t("Altra misura", "Other reading")
        : t("Altro valore dell'acqua", "Other water reading");
    case "livello":
      return terrario
        ? t("Livello del serbatoio", "Reservoir level")
        : t("Livello dell'acqua", "Water level");
    case "luci":
      return t("Luci", "Lights");
    case "lampada":
      return t("Lampada calda o riscaldamento", "Heat lamp or heating");
    case "uvb":
      return t("Lampada UVB", "UVB lamp");
    case "nebulizzatore":
      return t("Nebulizzatore", "Mister");
    case "filtro":
      return t("Filtro o pompa", "Filter or pump");
    case "riscaldatore":
      return t("Riscaldatore", "Heater");
    default:
      return t("Altro comando", "Other switch");
  }
}

/* Il genere di una riga: quello scritto, o quello che dice l'entità. */
function genereDellaRiga(riga, tipo, states = allStates()) {
  const generi = generiDelTipo(tipo);
  const scritto = genereValido(riga?.genere);
  if (scritto && generi.includes(scritto)) return scritto;
  const letto = genereDelSensore(riga?.entity, states?.[riga?.entity], tipo);
  return generi.includes(letto) ? letto : generi[0];
}

/* ── la vasca, in cima ────────────────────────────────────────────────── */

/* La data, per la casella del calendario: il giorno di casa, non quello di
 * Greenwich. */
function giornoDi(valore) {
  const quando = Date.parse(clean(valore));
  if (!Number.isFinite(quando)) return "";
  const giorno = new Date(quando);
  const due = (n) => String(n).padStart(2, "0");
  return `${giorno.getFullYear()}-${due(giorno.getMonth() + 1)}-${due(giorno.getDate())}`;
}

/* A mezzogiorno del giorno scelto: lontano dalla mezzanotte, così nessun fuso
 * orario lo sposta a ieri. */
function istanteDi(giorno) {
  const [anno, mese, di] = clean(giorno).split("-").map(Number);
  if (!anno || !mese || !di) return "";
  return new Date(anno, mese - 1, di, 12, 0, 0).toISOString();
}

function campoDellaVasca(indice, campo, etichetta, valore, esempio, { tipo = "text", aiuto = "" } = {}) {
  return `<label class="ed-slot dm-animale-field"><span class="ed-slot-lbl">${esc(etichetta)}</span>
    <span class="ed-form-row"><input id="dm-animale-${indice}-vasca-${esc(campo)}" class="ed-input${tipo === "text" ? "" : " mono"}" type="${esc(tipo)}"
      data-vasca-dato="${esc(campo)}" value="${esc(valore)}" placeholder="${esc(esempio)}"
      ${tipo === "number" ? 'inputmode="numeric" min="1" step="1"' : ""} autocomplete="off" spellcheck="false"></span>
    ${aiuto ? `<small>${esc(aiuto)}</small>` : ""}</label>`;
}

function vascaInTestaMarkup(animale, indice) {
  if (tipoValido(animale.specie) === "terrario")
    return `<div class="dm-animale-gruppo">
      <span class="dm-animale-gruppo-lbl">${esc(t("🧽 Pulizia", "🧽 Cleaning"))}</span>
      ${campoDellaVasca(indice, "ogni", t("Pulizia ogni (giorni)", "Clean every (days)"), clean(animale.ogni), "30", {
        tipo: "number",
        aiuto: t(
          "Facoltativo: vuoto, il terrario non ricorda la pulizia a nessuno. Con un numero la scheda dice quando tocca.",
          "Optional: left empty, the terrarium reminds nobody to clean it. With a number the card says when it is due.",
        ),
      })}
      ${campoDellaVasca(indice, "pulizia", t("Ultima pulizia", "Last cleaning"), giornoDi(animale.pulizia), "", {
        tipo: "date",
        aiuto: t(
          "Si segna dalla pagina con «Fatto oggi»; qui si corregge.",
          "It is recorded from the page with “Done today”; here you can correct it.",
        ),
      })}
    </div>`;
  return `<div class="dm-animale-gruppo">
    <span class="dm-animale-gruppo-lbl">${esc(t("🪣 La vasca", "🪣 The tank"))}</span>
    ${campoDellaVasca(indice, "litri", t("Litri", "Litres"), clean(animale.litri), "240", { tipo: "number" })}
    ${campoDellaVasca(
      indice,
      "ogni",
      t("Cambio d'acqua ogni (giorni)", "Water change every (days)"),
      clean(animale.ogni),
      String(CAMBIO_OGNI_GIORNI),
      {
        tipo: "number",
        aiuto: t(
          "Dopo questi giorni la pagina e la tessera in Home dicono che il cambio d'acqua è da fare.",
          "After this many days the page and the Home tile say the water change is due.",
        ),
      },
    )}
    ${campoDellaVasca(indice, "cambio", t("Ultimo cambio d'acqua", "Last water change"), giornoDi(animale.cambio), "", {
      tipo: "date",
      aiuto: t(
        "Si segna dalla pagina con «Fatto oggi»; qui si corregge.",
        "It is recorded from the page with “Done today”; here you can correct it.",
      ),
    })}
  </div>`;
}

/* ── le righe ─────────────────────────────────────────────────────────── */

function campoNumerico(indice, posto, nome, riga, etichetta, esempio) {
  return `<label class="ed-slot dm-animale-field"><span class="ed-slot-lbl">${esc(etichetta)}</span>
    <span class="ed-form-row"><input id="dm-animale-${indice}-riga-${posto}-${nome}" class="ed-input mono"
      data-vasca-campo="${esc(nome)}" value="${esc(clean(riga[nome]))}" placeholder="${esc(esempio)}"
      inputmode="decimal" autocomplete="off" spellcheck="false"></span></label>`;
}

function rigaMarkup(riga, posto, indice, tipo, states) {
  const genere = genereDellaRiga(riga, tipo, states);
  const numeri = numeriDelGenere(genere, riga.entity);
  const unita = clean(states?.[riga?.entity]?.attributes?.unit_of_measurement);
  const serie = forcellaDiSerie(genere, unita, tipo);
  const esempio = (quale) => (serie ? formatNumber(serie[quale], 1) : "");
  const id = `dm-animale-${indice}-riga-${posto}-entity`;
  const valore = states?.[riga.entity];
  const adesso =
    valore && clean(valore.state) && !/^(unknown|unavailable)$/i.test(clean(valore.state))
      ? `${clean(valore.state)}${unita ? ` ${unita}` : ""}`
      : "";
  return `<div class="dm-vasca-ed-riga" data-vasca-riga="${posto}" data-vasca-genere="${esc(genere)}">
    <div class="dm-vasca-ed-testa">
      <span class="dm-vasca-ed-ic" aria-hidden="true">${disegnoDiCasa(clean(riga.icon) || disegnoDelGenere(genere, tipo), { misura: 28, ripiego: disegnoDelGenere(genere, tipo) })}</span>
      <span class="dm-vasca-ed-nome"><strong>${esc(clean(riga.name) || nomeDelGenere(genere, tipo))}</strong><small class="mono">${esc(clean(riga.entity) || t("nessuna entità", "no entity"))}</small></span>
      ${adesso ? `<b class="dm-vasca-ed-val">${esc(adesso)}</b>` : ""}
      <button type="button" class="ed-del" data-vasca-togli="${posto}" aria-label="${esc(t("Elimina", "Remove"))}">🗑️</button>
    </div>
    <div class="dm-vasca-ed-campi">
      <label class="ed-slot dm-animale-field dm-vasca-ed-largo"><span class="ed-slot-lbl">${esc(t("Entità", "Entity"))}</span>
        <span class="ed-form-row"><input id="${id}" class="ed-input mono" data-vasca-campo="entity" value="${esc(clean(riga.entity))}"
          placeholder="${esc(tipoValido(tipo) === "terrario" ? "sensor.terrario_temperatura" : "sensor.acquario_temperatura")}" autocomplete="off" spellcheck="false"><button type="button" class="dm-animale-pick" data-animale-pick="${id}" aria-label="${esc(t("Scegli entità", "Choose entity"))}">🔍</button></span></label>
      <label class="ed-slot dm-animale-field"><span class="ed-slot-lbl">${esc(t("Nome", "Name"))}</span>
        <span class="ed-form-row"><input id="dm-animale-${indice}-riga-${posto}-name" class="ed-input" data-vasca-campo="name" value="${esc(clean(riga.name))}" placeholder="${esc(nomeDelGenere(genere, tipo))}"></span></label>
      <label class="ed-slot dm-animale-field"><span class="ed-slot-lbl">${esc(t("Cosa è", "What it is"))}</span>
        <span class="ed-form-row"><select id="dm-animale-${indice}-riga-${posto}-genere" class="ed-input" data-vasca-campo="genere">${generiDelTipo(tipo)
          .map(
            (voce) =>
              `<option value="${esc(voce)}"${voce === genere ? " selected" : ""}>${esc(nomeDelGenere(voce, tipo))}</option>`,
          )
          .join("")}</select></span></label>
      ${numeri.includes("minimo") ? campoNumerico(indice, posto, "minimo", riga, t("Ideale da", "Ideal from"), esempio("minimo")) : ""}
      ${numeri.includes("massimo") ? campoNumerico(indice, posto, "massimo", riga, t("Ideale fino a", "Ideal up to"), esempio("massimo")) : ""}
      ${numeri.includes("soglia") ? campoNumerico(indice, posto, "soglia", riga, t("Da rabboccare sotto", "Top up below"), "") : ""}
      <input type="hidden" data-vasca-campo="icon" value="${esc(clean(riga.icon))}">
    </div>
  </div>`;
}

/** Le righe che Home Assistant propone per questa vasca, meno quelle già prese da un'altra. */
export function daPrendereNellaVasca(animale, esclusi = []) {
  const states = allStates();
  return righeDaImportare(
    states,
    { righe: animale?.righe || [] },
    (entity) => nomeDaHomeAssistant(entity, states),
    { tipo: tipoValido(animale?.specie), esclusi },
  );
}

/**
 * Il corpo di una voce che è una vasca: la vasca in cima, le righe sotto, e i
 * tasti per aggiungerne. `esclusi` sono le entità che stanno già in un'altra
 * vasca: non si ripropongono.
 */
export function vascaEditorMarkup(animale, indice, { esclusi = [] } = {}) {
  const tipo = tipoValido(animale.specie);
  const states = allStates();
  const righe = Array.isArray(animale.righe) ? animale.righe : [];
  const mancano = daPrendereNellaVasca(animale, esclusi);
  const quante = mancano.length;
  const terrario = tipo === "terrario";
  return `${vascaInTestaMarkup(animale, indice)}
    <div class="dm-animale-gruppo dm-vasca-ed">
      <span class="dm-animale-gruppo-lbl">${esc(terrario ? t("🦎 Le entità del terrario", "🦎 The terrarium's entities") : t("🐠 Le entità dell'acquario", "🐠 The aquarium's entities"))}</span>
      <small class="dm-vasca-ed-intro">${esc(
        terrario
          ? t(
              "Una riga per entità: le temperature del lato caldo e del lato fresco, l'umidità, le luci, la lampada calda, l'UVB, il nebulizzatore. Le forcelle vuote valgono quelle di serie: 28–35 °C sul lato caldo, 22–28 °C sul fresco, umidità 40–80 %.",
              "One row per entity: warm-side and cool-side temperatures, humidity, lights, heat lamp, UVB, mister. Empty ranges use the defaults: 28–35 °C on the warm side, 22–28 °C on the cool side, humidity 40–80 %.",
            )
          : t(
              "Una riga per entità: la temperatura e il pH con la loro forcella, il livello dell'acqua, le luci, il filtro e il riscaldatore. Le forcelle vuote valgono quelle di serie: 24–27 °C e pH 6,5–7,5.",
              "One row per entity: temperature and pH with their ideal range, the water level, the lights, the filter and the heater. Empty ranges use the defaults: 24–27 °C and pH 6.5–7.5.",
            ),
      )}</small>
      ${
        righe.length
          ? righe.map((riga, posto) => rigaMarkup(riga, posto, indice, tipo, states)).join("")
          : `<div class="ed-empty">${esc(t("Nessuna entità", "No entity"))}</div>`
      }
      <button type="button" class="ed-btn-add" data-vasca-aggiungi>＋ ${esc(t("Aggiungi entità", "Add entity"))}</button>
      ${
        mancano.length
          ? `<button type="button" class="ed-btn-add dm-vasca-ed-prendi" data-vasca-prendi>⤓ ${esc(
              terrario
                ? t(
                    `Prendi le ${quante} entità del terrario che Home Assistant ha trovato`,
                    `Take the ${quante} terrarium entities Home Assistant found`,
                  )
                : t(
                    `Prendi le ${quante} entità dell'acquario che Home Assistant ha trovato`,
                    `Take the ${quante} aquarium entities Home Assistant found`,
                  ),
            )}</button>`
          : ""
      }
    </div>`;
}

/**
 * Quello che la riga aperta ha nelle sue caselle adesso: i dati della vasca e
 * le righe, ognuna col genere dalla tendina e solo i numeri di quel genere.
 */
export function leggiLaVasca(nodo, animale) {
  const fuori = { ...animale };
  const tipo = tipoValido(animale.specie);
  for (const casella of nodo.querySelectorAll("[data-vasca-dato]")) {
    const campo = clean(casella.dataset.vascaDato);
    const valore = clean(casella.value);
    const scritto = campo === "cambio" || campo === "pulizia" ? istanteDi(valore) : valore;
    if (scritto) fuori[campo] = scritto;
    else delete fuori[campo];
  }
  const righe = [];
  for (const blocco of nodo.querySelectorAll("[data-vasca-riga]")) {
    const posto = Number(blocco.dataset.vascaRiga);
    const prima = (Array.isArray(animale.righe) ? animale.righe : [])[posto] || {};
    const riga = { ...prima };
    for (const casella of blocco.querySelectorAll("[data-vasca-campo]"))
      riga[clean(casella.dataset.vascaCampo)] = clean(casella.value);
    const generi = generiDelTipo(tipo);
    riga.genere = generi.includes(riga.genere) ? riga.genere : genereDellaRiga(riga, tipo);
    /* Il disegno di serie segue il genere, se era quello di serie del genere
     * di prima: chi l'ha scelto a mano se lo tiene. */
    const diPrima = genereValido(prima.genere);
    if (!riga.icon || (diPrima && riga.icon === disegnoDelGenere(diPrima, tipo)))
      riga.icon = disegnoDelGenere(riga.genere, tipo);
    const tiene = numeriDelGenere(riga.genere, riga.entity);
    for (const nome of NUMERI) if (!tiene.includes(nome) || riga[nome] === "") delete riga[nome];
    righe.push(riga);
  }
  if (nodo.querySelector("[data-vasca-riga]") || Array.isArray(animale.righe)) fuori.righe = righe;
  return fuori;
}

/** La riga nuova che «＋ Aggiungi entità» mette in fondo. */
export function rigaNuovaDellaVasca(tipo) {
  const [genere] = generiDelTipo(tipo);
  return {
    entity: "",
    name: t("Entità nuova", "New entity"),
    icon: disegnoDelGenere(genere, tipo),
    genere,
  };
}

let stileMesso = false;

/** Il foglio delle righe della vasca, una volta sola. */
export function installaStileDellaVasca() {
  if (stileMesso) return false;
  stileMesso = true;
  installStyle(
    "dm-vasca-editor-style",
    `
      #ed-body .dm-vasca-ed{gap:8px}
      #ed-body .dm-vasca-ed-intro{font-size:11px;line-height:1.45;color:var(--text-dim,#64748b);font-weight:600}
      #ed-body .dm-vasca-ed-riga{display:grid;gap:8px;padding:9px 10px;border:1px solid var(--card-border,#dbe4ee);
        border-left:4px solid var(--dm-vasca-ed,#0ea5e9);border-radius:12px;background:var(--card-bg,#fff)}
      #ed-body .dm-vasca-ed-riga[data-vasca-genere="lampada"],
      #ed-body .dm-vasca-ed-riga[data-vasca-genere="riscaldatore"]{--dm-vasca-ed:#f97316}
      #ed-body .dm-vasca-ed-riga[data-vasca-genere="uvb"]{--dm-vasca-ed:#a855f7}
      #ed-body .dm-vasca-ed-riga[data-vasca-genere="luci"]{--dm-vasca-ed:#f59e0b}
      #ed-body .dm-vasca-ed-riga[data-vasca-genere="umidita"],
      #ed-body .dm-vasca-ed-riga[data-vasca-genere="nebulizzatore"]{--dm-vasca-ed:#06b6d4}
      #ed-body .dm-vasca-ed-riga[data-vasca-genere="temperatura"]{--dm-vasca-ed:#ef4444}
      #ed-body .dm-vasca-ed-riga[data-vasca-genere="temperatura_fresca"]{--dm-vasca-ed:#3b82f6}
      #ed-body .dm-vasca-ed-testa{display:flex;align-items:center;gap:9px;min-width:0}
      #ed-body .dm-vasca-ed-ic{flex:0 0 28px;display:grid;place-items:center;line-height:0}
      #ed-body .dm-vasca-ed-ic svg{display:block;width:28px;height:28px}
      #ed-body .dm-vasca-ed-nome{display:grid;gap:1px;min-width:0;flex:1 1 auto}
      #ed-body .dm-vasca-ed-nome strong{font-size:13px;font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      #ed-body .dm-vasca-ed-nome small{font-size:10.5px;opacity:.72;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      #ed-body .dm-vasca-ed-val{flex:0 0 auto;font-size:12.5px;font-weight:900}
      #ed-body .dm-vasca-ed-campi{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
      #ed-body .dm-vasca-ed-largo{grid-column:1/-1}
      #ed-body .dm-vasca-ed-prendi{background:transparent!important;border:1px dashed var(--card-border,#dbe4ee)!important;color:var(--text-dim,#64748b)!important}
    `,
  );
  return true;
}
