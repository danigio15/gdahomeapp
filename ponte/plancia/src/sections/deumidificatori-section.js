/* I deumidificatori, dentro il Clima (#205).
 *
 * «Problemi di comunicazione con dei deumidificatori Comfee tramite Midea: non
 * riconosciuti con tutti i comandi del dispositivo. Li ho integrati su Home
 * Assistant e funzionano benissimo.»
 *
 * L'unico posto in cui metterli era un'unita' del Clima, e una card del clima
 * sa fare il termostato: gradi, caldo e freddo. Un deumidificatore vuole altre
 * cose — l'umidita' che c'e', quella che deve raggiungere, la sua modalita', il
 * serbatoio da svuotare — e qui ha una card sua, sotto la ventilazione.
 *
 * Come la VMC, la pagina ha UN padrone — `climate-thermal-section.js` — e
 * resta lui: qui ci sono il markup, la mano che lo dipinge e il tocco, e li
 * chiama lui insieme al resto. Le regole (chi e' configurato, cosa dice,
 * quale servizio chiamare) stanno in `core/deumidificatori.js`, che e' puro.
 */
import {
  CHIAVE_DEUMIDIFICATORI,
  comandoDeumidificatore,
  deumidificatoriDaMostrare,
  letturaDeumidificatore,
  obiettivoVicino,
} from "../core/deumidificatori.js";
import {
  allStates,
  chiamaServizio,
  clean,
  esc,
  readJson,
  root,
  roomLabel,
  siComanda,
  t,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_DEUMIDIFICATORI__";
const state = (root[KEY] ||= { attese: new Map() });

/* Quanto si aspetta Home Assistant dopo un tocco su − o +.
 *
 * Il servizio parte subito, ma il nuovo obiettivo torna indietro con lo stato
 * successivo, e una macchina sul cloud Midea ci mette anche un paio di
 * secondi. Senza ricordarselo, il secondo tocco ripartirebbe dal valore
 * vecchio: due volte + da 50 farebbe 55 e poi ancora 55. */
const ATTESA_MS = 6000;

function obiettivoInAttesa(lettura) {
  const attesa = state.attese.get(lettura.entita);
  if (!attesa) return null;
  if (Date.now() - attesa.quando > ATTESA_MS || attesa.valore === lettura.obiettivo) {
    state.attese.delete(lettura.entita);
    return null;
  }
  return attesa.valore;
}

/* La lettura, con l'obiettivo appena chiesto al posto di quello vecchio. */
function letturaConLAttesa(lettura) {
  const atteso = obiettivoInAttesa(lettura);
  return atteso === null ? lettura : { ...lettura, obiettivo: atteso };
}

/** Le macchine da mostrare: le sue, e quelle rimaste fra le unita' del Clima. */
export function deumidificatoriConfigurati(unitaDelClima = []) {
  return deumidificatoriDaMostrare(readJson(CHIAVE_DEUMIDIFICATORI, []), unitaDelClima);
}

/** Le letture di adesso. Una macchina che non risponde resta: va detto. */
export function letturaDeiDeumidificatori(states = allStates(), unitaDelClima = []) {
  return deumidificatoriConfigurati(unitaDelClima).map((unita) =>
    letturaConLAttesa(letturaDeumidificatore(unita, states)),
  );
}

/* ── le parole ────────────────────────────────────────────────────────── */

const chiaveDi = (valore) =>
  clean(valore)
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const maiuscola = (valore) => {
  const testo = clean(valore).replace(/_/g, " ");
  return testo ? testo[0].toUpperCase() + testo.slice(1) : "";
};

/* Le modalita' come le scrivono le integrazioni: Midea dice «Set», «Continuous»,
 * «Clothes-Dry»; altre dicono `dry_clothes` o `normal`. Quelle che non
 * conosciamo si mostrano come arrivano, con la maiuscola: meglio la parola
 * della macchina che una traduzione sbagliata. */
export function parolaModo(modo) {
  switch (chiaveDi(modo)) {
    case "auto":
    case "automatic":
    case "smart":
      return t("Auto", "Auto");
    case "continuous":
    case "continuo":
    case "cont":
      return t("Continuo", "Continuous");
    case "set":
    case "manual":
    case "manuale":
    case "target":
      return t("Manuale", "Manual");
    case "clothes_dry":
    case "dry_clothes":
    case "clothes":
    case "laundry":
      return t("Asciuga bucato", "Clothes drying");
    case "shoes_dry":
    case "dry_shoes":
    case "shoes":
      return t("Asciuga scarpe", "Shoe drying");
    case "dry":
    case "drying":
      return t("Asciuga", "Dry");
    case "normal":
    case "normale":
      return t("Normale", "Normal");
    case "eco":
      return t("Eco", "Eco");
    case "boost":
    case "turbo":
      return t("Boost", "Boost");
    case "sleep":
    case "night":
      return t("Notte", "Sleep");
    case "comfort":
      return t("Comfort", "Comfort");
    case "baby":
      return t("Bambino", "Baby");
    case "home":
      return t("Casa", "Home");
    case "away":
      return t("Fuori casa", "Away");
    case "purify":
    case "purifier":
      return t("Purifica", "Purify");
    case "fan":
    case "fan_only":
      return t("Solo ventola", "Fan only");
    default:
      return maiuscola(modo);
  }
}

/* Le velocita' della ventola, nello stesso modo. */
export function parolaVentola(velocita) {
  switch (chiaveDi(velocita)) {
    case "low":
    case "bassa":
      return t("Bassa", "Low");
    case "medium":
    case "mid":
    case "middle":
    case "media":
      return t("Media", "Medium");
    case "high":
    case "alta":
      return t("Alta", "High");
    case "silent":
    case "quiet":
      return t("Silenziosa", "Silent");
    case "turbo":
    case "full":
    case "max":
      return t("Massima", "Max");
    case "auto":
      return t("Auto", "Auto");
    default:
      return maiuscola(velocita);
  }
}

/* Cosa sta facendo, in una riga.
 *
 * «In pausa» e «spento» sono due notizie diverse: un deumidificatore acceso
 * che sta fermo perche' l'aria e' gia' secca sta facendo esattamente il suo
 * lavoro, e chi lo guarda deve saperlo prima di pensare che sia rotto. */
export function statoInParole(lettura) {
  if (lettura.muto) return t("Non risponde", "Not responding");
  if (lettura.acceso === false || lettura.azione === "off") return t("Spento", "Off");
  switch (lettura.azione) {
    case "drying":
      return t("Sta deumidificando", "Drying the air");
    case "humidifying":
      return t("Sta umidificando", "Humidifying");
    case "idle":
      return lettura.tipo === "umidificatore"
        ? t("In pausa: aria già umida", "Paused: the air is already humid")
        : t("In pausa: aria già asciutta", "Paused: the air is already dry");
    default:
      return t("Acceso", "On");
  }
}

const percento = (valore) =>
  valore === null || valore === undefined ? "--%" : `${Math.round(valore)}%`;
const gradi = (valore) => (valore === null ? "" : `${Math.round(valore * 10) / 10}°`);
const watt = (valore) => (valore === null ? "" : `${Math.round(valore)} W`);

/* ── il markup ────────────────────────────────────────────────────────── */

function pastiglieMarkup(voci, scelta, azione, parola, disabilitate) {
  return voci
    .map(
      (voce) =>
        `<button type="button" class="dm-deum-pill" data-dm-deum-azione="${esc(azione)}" data-dm-deum-valore="${esc(voce)}" aria-pressed="${voce === scelta}"${disabilitate ? " disabled" : ""}>${esc(parola(voce))}</button>`,
    )
    .join("");
}

function schedaMarkup(lettura) {
  const comandabile = !lettura.muto && siComanda(lettura.entita);
  const sotto = roomLabel(lettura.stanza);
  const ventola = lettura.ventola && lettura.ventola.opzioni.length ? lettura.ventola : null;
  const piccoli = [
    lettura.temperatura !== null
      ? `<span data-dm-deum-num="temperatura"><span aria-hidden="true">🌡️</span><b>${esc(gradi(lettura.temperatura))}</b></span>`
      : "",
    lettura.consumo !== null
      ? `<span data-dm-deum-num="consumo"><span aria-hidden="true">⚡</span><b>${esc(watt(lettura.consumo))}</b></span>`
      : "",
  ].join("");
  return `<article class="dm-deum-card" data-dm-deum="${esc(lettura.id)}" data-acceso="${lettura.acceso === true}" data-muto="${lettura.muto}" data-avvisa="${lettura.avvisi.length > 0}">
    <div class="dm-deum-head">
      <span class="dm-deum-ic" aria-hidden="true">${lettura.tipo === "umidificatore" ? "💦" : "💧"}</span>
      <span class="dm-deum-titolo"><strong>${esc(lettura.nome)}</strong>${sotto ? `<small>${esc(sotto)}</small>` : ""}</span>
      <button type="button" class="dm-deum-power" data-dm-deum-azione="commuta" aria-pressed="${lettura.acceso === true}" aria-label="${esc(t("Accendi o spegni", "Turn on or off"))}"${comandabile ? "" : " disabled"}>⏻</button>
    </div>
    <p class="dm-deum-stato" data-dm-deum-stato>${esc(statoInParole(lettura))}</p>
    ${
      lettura.serbatoioPieno === true
        ? `<span class="dm-deum-avviso" data-dm-deum-serbatoio><span aria-hidden="true">🪣</span>${esc(t("Serbatoio pieno — svuotalo", "Tank full — empty it"))}</span>`
        : ""
    }
    <div class="dm-deum-misure">
      <span class="dm-deum-adesso"><small>${esc(t("Umidità adesso", "Humidity now"))}</small><b data-dm-deum-attuale>${esc(percento(lettura.attuale))}</b></span>
      <span class="dm-deum-obiettivo">
        <small>${esc(t("Obiettivo", "Target"))}</small>
        <span class="dm-deum-passi">
          <button type="button" data-dm-deum-azione="meno" aria-label="${esc(t("Meno umidità", "Less humidity"))}"${comandabile ? "" : " disabled"}>−</button>
          <b data-dm-deum-obiettivo>${esc(percento(lettura.obiettivo))}</b>
          <button type="button" data-dm-deum-azione="piu" aria-label="${esc(t("Più umidità", "More humidity"))}"${comandabile ? "" : " disabled"}>+</button>
        </span>
      </span>
    </div>
    ${
      lettura.modi.length
        ? `<div class="dm-deum-riga"><small>${esc(t("Modalità", "Mode"))}</small><div class="dm-deum-pills" data-dm-deum-gruppo="modo">${pastiglieMarkup(lettura.modi, lettura.modo, "modo", parolaModo, !comandabile)}</div></div>`
        : ""
    }
    ${
      ventola
        ? `<div class="dm-deum-riga"><small>${esc(t("Ventola", "Fan"))}</small><div class="dm-deum-pills" data-dm-deum-gruppo="ventola">${pastiglieMarkup(ventola.opzioni, ventola.scelta, "ventola", parolaVentola, ventola.muto || !siComanda(ventola.entita))}</div></div>`
        : ""
    }
    ${piccoli ? `<div class="dm-deum-piccoli">${piccoli}</div>` : ""}
  </article>`;
}

/**
 * La fascia dei deumidificatori, o stringa vuota se non ce n'e'.
 *
 * La chiama il padrone della pagina del Clima insieme al resto: qui non si
 * tocca il documento.
 */
export function deumidificatoriMarkup(letture) {
  if (!letture.length) return "";
  return `<section class="dm-deum" data-dm-deum-fascia>
    <h3 class="dm-deum-titolo-fascia">💧 ${esc(t("Deumidificatori", "Dehumidifiers"))}</h3>
    <div class="dm-deum-griglia">${letture.map(schedaMarkup).join("")}</div>
  </section>`;
}

/** L'impronta di quello che cambia la FORMA della fascia, non i numeri. */
export function firmaDeiDeumidificatori(letture) {
  return letture
    .map((lettura) =>
      [
        lettura.id,
        lettura.nome,
        lettura.stanza,
        lettura.tipo,
        lettura.muto,
        siComanda(lettura.entita),
        lettura.modi.join("+"),
        lettura.ventola ? `${lettura.ventola.muto}:${lettura.ventola.opzioni.join("+")}` : "",
        lettura.serbatoioPieno === true,
        lettura.temperatura === null ? "" : "t",
        lettura.consumo === null ? "" : "w",
      ].join("~"),
    )
    .join("|");
}

function scrivi(nodo, testo) {
  if (nodo && nodo.textContent !== testo) nodo.textContent = testo;
}

function premuti(card, gruppo, scelta) {
  for (const tasto of card.querySelectorAll(
    `[data-dm-deum-gruppo="${gruppo}"] [data-dm-deum-valore]`,
  )) {
    const giusto = String(tasto.dataset.dmDeumValore === scelta);
    if (tasto.getAttribute("aria-pressed") !== giusto) tasto.setAttribute("aria-pressed", giusto);
  }
}

/** I numeri e gli stati che cambiano dentro una fascia gia' disegnata. */
export function sincronizzaIDeumidificatori(host, letture) {
  for (const lettura of letture) {
    const card = host?.querySelector?.(`[data-dm-deum="${CSS.escape(lettura.id)}"]`);
    if (!card) continue;
    const acceso = String(lettura.acceso === true);
    if (card.dataset.acceso !== acceso) card.dataset.acceso = acceso;
    const power = card.querySelector('[data-dm-deum-azione="commuta"]');
    if (power && power.getAttribute("aria-pressed") !== acceso)
      power.setAttribute("aria-pressed", acceso);
    scrivi(card.querySelector("[data-dm-deum-stato]"), statoInParole(lettura));
    scrivi(card.querySelector("[data-dm-deum-attuale]"), percento(lettura.attuale));
    scrivi(card.querySelector("[data-dm-deum-obiettivo]"), percento(lettura.obiettivo));
    premuti(card, "modo", lettura.modo);
    if (lettura.ventola) premuti(card, "ventola", lettura.ventola.scelta);
    scrivi(card.querySelector('[data-dm-deum-num="temperatura"] b'), gradi(lettura.temperatura));
    scrivi(card.querySelector('[data-dm-deum-num="consumo"] b'), watt(lettura.consumo));
  }
}

/* ── il tocco ─────────────────────────────────────────────────────────── */

/**
 * Un tocco su un tasto di un deumidificatore. Torna `true` se era suo.
 *
 * La lettura si rifa' adesso, dagli stati di adesso: quella con cui e' stata
 * disegnata la card puo' avere qualche secondo, e un + deve partire
 * dall'obiettivo vero (o da quello appena chiesto), non da quello di allora.
 */
export function toccaUnDeumidificatore(event, unitaDelClima = [], states = allStates()) {
  const tasto = event?.target?.closest?.("[data-dm-deum-azione]");
  if (!tasto) return false;
  const card = tasto.closest("[data-dm-deum]");
  if (!card) return false;
  event.preventDefault();
  if (tasto.disabled) return true;
  const unita = deumidificatoriConfigurati(unitaDelClima).find(
    (voce) => voce.id === card.dataset.dmDeum,
  );
  if (!unita) return true;
  const lettura = letturaConLAttesa(letturaDeumidificatore(unita, states));
  const azione = clean(tasto.dataset.dmDeumAzione);
  let comando = null;
  if (azione === "meno" || azione === "piu") {
    const voluto = obiettivoVicino(lettura, azione === "piu" ? 1 : -1);
    comando = comandoDeumidificatore(lettura, "umidita", voluto);
    if (comando) {
      state.attese.set(lettura.entita, { valore: comando.data.humidity, quando: Date.now() });
      scrivi(card.querySelector("[data-dm-deum-obiettivo]"), percento(comando.data.humidity));
    }
  } else {
    comando = comandoDeumidificatore(lettura, azione, tasto.dataset.dmDeumValore);
    /* La pastiglia si accende subito: il tocco deve vedersi anche se la
     * macchina risponde fra due secondi. Lo stato vero la rimette a posto. */
    if (comando && (azione === "modo" || azione === "ventola"))
      premuti(card, azione, clean(tasto.dataset.dmDeumValore));
  }
  if (comando) chiamaServizio(comando);
  return true;
}

/** Il foglio di stile della fascia: lo installa il padrone della pagina. */
export const STILE_DEUMIDIFICATORI = `
.dm-deum{display:grid;gap:10px;margin-top:14px}
.dm-deum-titolo-fascia{margin:0;font-size:11px;font-weight:900;letter-spacing:.07em;text-transform:uppercase;color:var(--secondary-text-color,#64748b)}
.dm-deum-griglia{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr))}
.dm-deum-card{display:grid;gap:10px;padding:14px;border:1px solid var(--divider-color,#dbe4ee);border-radius:20px;background:var(--card-bg,#fff);box-shadow:0 18px 34px -28px rgba(15,23,42,.55)}
.dm-deum-card[data-avvisa="true"]{border-color:color-mix(in srgb,#f59e0b 55%,transparent)}
.dm-deum-card[data-muto="true"]{opacity:.7}
.dm-deum-head{display:flex;align-items:center;gap:10px;min-width:0}
.dm-deum-ic{flex:0 0 38px;width:38px;height:38px;border-radius:12px;display:grid;place-items:center;font-size:19px;background:var(--secondary-background-color,#eef3f8)}
.dm-deum-card[data-acceso="true"] .dm-deum-ic{background:color-mix(in srgb,#0ea5e9 16%,transparent)}
.dm-deum-titolo{display:grid;min-width:0;flex:1 1 auto}
.dm-deum-titolo strong{font-size:14px;font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dm-deum-titolo small{font-size:11px;font-weight:750;color:var(--secondary-text-color,#64748b)}
.dm-deum-card button{font:inherit;color:inherit;cursor:pointer}
.dm-deum-card button:disabled{cursor:default;opacity:.5}
.dm-deum-power{flex:0 0 40px;width:40px;height:40px;border-radius:50%;border:1px solid var(--divider-color,#dbe4ee);background:transparent;font-size:17px;font-weight:900}
.dm-deum-power[aria-pressed="true"]{border-color:transparent;background:#0ea5e9;color:#fff!important}
.dm-deum-stato{margin:0;font-size:12px;font-weight:800;color:var(--secondary-text-color,#64748b)}
.dm-deum-card[data-acceso="true"] .dm-deum-stato{color:#0369a1}
.dm-deum-avviso{justify-self:start;display:inline-flex;align-items:center;gap:6px;padding:6px 11px;border-radius:999px;font-size:12px;font-weight:900;background:color-mix(in srgb,#f59e0b 18%,transparent);color:#b45309}
.dm-deum-misure{display:grid;grid-template-columns:1fr auto;align-items:end;gap:10px;padding:10px 12px;border-radius:14px;background:color-mix(in srgb,#0ea5e9 9%,transparent)}
.dm-deum-misure small,.dm-deum-riga small{font-size:9.5px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;color:var(--secondary-text-color,#64748b)}
.dm-deum-adesso,.dm-deum-obiettivo{display:grid;gap:2px}
.dm-deum-adesso b{font-size:30px;line-height:1.05;font-weight:900;font-variant-numeric:tabular-nums}
.dm-deum-obiettivo{justify-items:end}
.dm-deum-passi{display:inline-flex;align-items:center;gap:8px}
.dm-deum-passi b{min-width:3.2ch;text-align:center;font-size:20px;font-weight:900;font-variant-numeric:tabular-nums}
.dm-deum-passi button{width:36px;height:36px;border-radius:12px;border:1px solid var(--divider-color,#dbe4ee);background:var(--card-bg,#fff);font-size:19px;font-weight:900;line-height:1}
.dm-deum-riga{display:grid;gap:5px}
.dm-deum-pills{display:flex;flex-wrap:wrap;gap:6px}
.dm-deum-pill{padding:6px 11px;border:1px solid var(--divider-color,#dbe4ee);border-radius:999px;background:transparent;font-size:12px!important;font-weight:800;color:var(--secondary-text-color,#64748b)!important}
.dm-deum-pill[aria-pressed="true"]{border-color:transparent;background:color-mix(in srgb,#0ea5e9 16%,transparent);color:#0369a1!important}
.dm-deum-piccoli{display:flex;flex-wrap:wrap;gap:14px;font-size:12px;color:var(--secondary-text-color,#64748b)}
.dm-deum-piccoli span{display:inline-flex;align-items:center;gap:4px}
.dm-deum-piccoli b{font-weight:900;font-variant-numeric:tabular-nums;color:var(--primary-text-color,#0f172a)}
`;
