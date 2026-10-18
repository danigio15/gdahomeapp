/* Il foglio «Ultime 24 ore» di un contatto o di un rilevatore (#269).
 *
 * Si tocca la carta di una porta nella pagina Varchi — o di un rilevatore
 * nella Presenza, o una riga delle loro finestre in Home — e si apre un
 * foglio: dal basso sul telefono, in mezzo allo schermo sul computer, a due
 * colonne. In cima com'è adesso e da quanto; sotto, le ultime ventiquattro
 * ore (o ieri, da mezzanotte a mezzanotte): quante volte si è aperta, quanto
 * in tutto, la più lunga; la striscia del giorno; l'elenco, dalla più recente.
 * Per il movimento le rilevazioni, la prima del mattino, l'ora più fitta, le
 * barre ora per ora e la quiete della notte.
 *
 * Il foglio si apre SUBITO con quello che la plancia sa già — lo stato di
 * adesso e da quando — e la storia arriva dopo, dal Recorder di Home
 * Assistant di casa, per la stessa strada di ogni altro storico della plancia
 * (`storico-condiviso-section.js`: una domanda sola, in memoria nove minuti).
 * Finché non arriva lo si dice; se non arriva lo si dice, e si può riprovare.
 *
 * I conti li fa `core/ultime-rilevazioni.js`, che è puro e si prova da solo:
 * qui ci sono le parole e il disegno.
 *
 * ── I colori ─────────────────────────────────────────────────────────────
 *
 * Aperta e chiusa non si distinguono solo per il rosso e il verde, che un
 * occhio su dodici confonde: l'apertura è una tacca ALTA e SCURA che esce
 * dalla striscia, la chiusura è la striscia bassa e chiara. Nel tema scuro le
 * luminosità si scambiano — la striscia scura, la tacca chiara — e la
 * differenza resta. «Non rispondeva» è un tratteggio, che non è un colore.
 */
import {
  ATTIVO,
  MUTO,
  eDiSera,
  famigliaDelSensore,
  finestraDelleUltime24,
  finestraDiIeri,
  letturaDelloStato,
  mezzanotteDi,
  orario,
  pezziDellaDurata,
  tacche,
  ultimeRilevazioni,
} from "../core/ultime-rilevazioni.js";
import { CHIAVE_VERSI, insiemeInvertiti } from "../core/verso-aperture.js";
import { eUnaPresenzaStabile } from "../core/presenza-in-casa.js";
import { quandoCambiaIlDaQuando, quantoTempoInParole } from "../core/da-quanto.js";
import { openHistory } from "./history-section.js";
import { apriLaSchedaDellEntita, dentroHomeAssistant } from "./la-scheda-di-home-assistant.js";
import {
  dimenticaLoStorico,
  quandoArrivaLoStorico,
  serieDi,
  storicoFallito,
} from "./storico-condiviso-section.js";
import {
  allStates,
  clean,
  disegnoDiCasa,
  doc,
  esc,
  installStyle,
  locale,
  readJson,
  root,
  senzaCadere,
  stanzaDiHomeAssistant,
  t,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_ULTIME_RILEVAZIONI__";
const state = (root[KEY] ||= {
  installed: false,
  aperto: null,
  frame: 0,
  sveglia: 0,
});

export const ULTIME_ID = "dm-ultime";

/* L'attributo che una carta porta per aprire il foglio. Lo scrivono la pagina
 * Varchi, la Presenza e le loro finestre in Home: chi lo trova sotto il dito
 * apre il foglio di quell'entità. */
export const ATTRIBUTO = "data-dm-ultime";

/* Quante righe si vedono prima di «Mostra tutti»: quelle del disegno. */
const RIGHE_DEL_VARCO = 8;
const RIGHE_DEL_MOVIMENTO = 7;

const W = 360;
/* Le etichette dell'asse (10px, grassetto), in unita' del viewBox: quanto e'
 * larga una lettera (misurata: «ieri 14:38» ne prende una quarantina), e
 * mezza etichetta «00:00» con lo spazio fra due etichette. */
const LETTERA = 4.4;
const MEZZA_TACCA = 16;

/* ── chi è il sensore ─────────────────────────────────────────────────── */

function invertiti() {
  return insiemeInvertiti(readJson(CHIAVE_VERSI, {}));
}

/**
 * Quello che il foglio deve sapere di un sensore: lo dice la carta da cui lo
 * si apre — nome, disegno, porta o finestra — e il resto lo si chiede agli
 * stati di Home Assistant.
 */
function sensore(entity, detto = {}) {
  const states = allStates() || {};
  const stato = states[entity];
  const classe = clean(stato?.attributes?.device_class);
  const famiglia = famigliaDelSensore({ classe, origine: detto.famiglia }) || "varco";
  return {
    entity,
    famiglia,
    classe,
    nome: clean(detto.nome) || clean(stato?.attributes?.friendly_name) || entity,
    glifo: clean(detto.glifo) || (famiglia === "movimento" ? "motion" : "door"),
    tipo: clean(detto.tipo),
    stanza: stanzaDiHomeAssistant(entity),
    invertito: famiglia === "varco" && invertiti().has(entity),
    stabile: famiglia === "movimento" && eUnaPresenzaStabile(classe),
  };
}

function vivoDi(entity) {
  const stato = (allStates() || {})[entity];
  if (!stato) return null;
  const quando = Date.parse(clean(stato.last_changed) || clean(stato.last_updated) || "");
  return { state: stato.state, time: Number.isFinite(quando) ? quando : null };
}

/* ── le parole ────────────────────────────────────────────────────────── */

/** Una durata breve: «< 1 min», «7 min», «1 h 20 min», «3 giorni». */
export function durataTesto(ms) {
  const p = pezziDellaDurata(ms);
  if (p.totaleMinuti < 1) return `< 1 ${t("min", "min")}`;
  if (p.totaleMinuti >= 48 * 60) return quantoTempoInParole(p.totaleMinuti);
  const ore = p.giorni * 24 + p.ore;
  if (!ore) return `${p.minuti} ${t("min", "min")}`;
  return p.minuti
    ? `${ore} ${t("h", "h")} ${p.minuti} ${t("min", "min")}`
    : `${ore} ${t("h", "h")}`;
}

function stessoGiorno(a, b) {
  return mezzanotteDi(a) === mezzanotteDi(b);
}

function dataBreve(ms) {
  try {
    return new Date(ms).toLocaleDateString(locale(), {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  } catch (_errore) {
    return new Date(ms).toDateString();
  }
}

/** «oggi alle 18:18», «ieri alle 21:40», o la data. */
function quandoTesto(ms, adesso) {
  const ora = orario(ms);
  if (stessoGiorno(ms, adesso)) return t(`oggi alle ${ora}`, `today at ${ora}`);
  if (stessoGiorno(ms, adesso - 86_400_000)) return t(`ieri alle ${ora}`, `yesterday at ${ora}`);
  return `${dataBreve(ms)} ${ora}`;
}

function alleOre(ora) {
  return t(`alle ${ora}`, `at ${ora}`);
}

function inUnOra(n) {
  return t(`${n} in un'ora`, `${n} in one hour`);
}

function ultimoCambioTesto(ms, adesso) {
  const quando = quandoTesto(ms, adesso);
  return t(`Ultimo cambio ${quando}`, `Last change ${quando}`);
}

function faTesto(ms) {
  const quanto = durataTesto(ms);
  return t(`${quanto} fa`, `${quanto} ago`);
}

function parolaDelloStato(dati, lettura) {
  if (lettura === MUTO) return t("Non risponde", "Not answering");
  if (dati.famiglia === "movimento") {
    if (lettura === ATTIVO)
      return dati.stabile ? t("Occupato", "Occupied") : t("Movimento", "Movement");
    return dati.stabile ? t("Libero", "Free") : t("Fermo", "Still");
  }
  return lettura === ATTIVO ? t("Aperta", "Open") : t("Chiusa", "Closed");
}

function tipoTesto(dati) {
  if (dati.famiglia === "movimento")
    return dati.stabile ? t("Presenza", "Presence") : t("Movimento", "Movement");
  if (dati.classe === "garage_door") return t("Portone", "Garage door");
  if (dati.tipo === "finestra" || (!dati.tipo && dati.classe === "window"))
    return t("Finestra", "Window");
  return t("Porta", "Door");
}

function tonoDi(dati, lettura) {
  if (lettura === MUTO) return "muto";
  if (dati.famiglia === "movimento") return "movimento";
  return lettura === ATTIVO ? "aperto" : "chiuso";
}

/* ── i dati ───────────────────────────────────────────────────────────── */

function sceltaDelPeriodo(modo, adesso) {
  if (modo === "ieri") {
    const finestra = finestraDiIeri(adesso);
    return { finestra, chiesta: { start: finestra.start, end: finestra.end } };
  }
  return { finestra: finestraDelleUltime24(adesso), chiesta: 24 };
}

/**
 * La storia letta: `{ esito, analisi }`, dove l'esito è `attesa`, `errore`,
 * `vuoto` o `pronta`.
 */
function letta(dati, modo, adesso) {
  const { finestra, chiesta } = sceltaDelPeriodo(modo, adesso);
  const righe = serieDi(dati.entity, chiesta);
  if (righe === null) return { esito: "attesa", finestra, chiesta };
  if (!righe.length)
    return {
      esito: storicoFallito(dati.entity, chiesta) ? "errore" : "vuoto",
      finestra,
      chiesta,
    };
  const leggi = (grezzo) => letturaDelloStato(grezzo, { invertito: dati.invertito });
  const analisi = ultimeRilevazioni(righe, {
    famiglia: dati.famiglia,
    finestra,
    adesso,
    leggi,
    /* Lo stato vivo si cuce in coda solo alle ultime 24 ore: ieri è finito. */
    vivo: modo === "ieri" ? null : vivoDi(dati.entity),
  });
  if (analisi.vuoto) return { esito: "vuoto", finestra, chiesta };
  return { esito: "pronta", finestra, chiesta, analisi };
}

/* ── il disegno: la testa e l'adesso ──────────────────────────────────── */

function testaMarkup(dati) {
  const briciole = [
    tipoTesto(dati),
    dati.stanza && dati.stanza !== dati.nome ? dati.stanza : "",
    dati.famiglia === "varco" ? t("contatto", "contact") : "",
  ].filter(Boolean);
  return `<div class="dm-ur-testa">
    <span class="dm-ur-ic" aria-hidden="true">${disegnoDiCasa(dati.glifo, {
      misura: 32,
      ripiego: dati.famiglia === "movimento" ? "motion" : "door",
    })}</span>
    <div class="dm-ur-nome">
      <h2 id="dm-ur-titolo">${esc(dati.nome)}</h2>
      <div class="dm-ur-briciole">${briciole.map(esc).join(" · ")}</div>
    </div>
    <button type="button" class="dm-ur-x" data-ur-chiudi aria-label="${esc(t("Chiudi", "Close"))}">
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
    </button>
  </div>`;
}

/* La riga sotto il numero grande: l'ultima chiusura, l'ultimo movimento. Si
 * scrive dalla storia delle ultime 24 ore anche quando si guarda ieri: dice
 * com'è adesso, e adesso non è ieri. */
function sottoLAdesso(dati, lettura, vivo, adesso) {
  const oggi = letta(dati, "24h", adesso);
  const eventi = oggi.analisi?.eventi || [];
  const ultimo = eventi[eventi.length - 1] || null;
  const cambio = Number.isFinite(vivo?.time) ? vivo.time : null;
  const evidenzia = (frase, pezzo) =>
    pezzo ? esc(frase).replace(esc(pezzo), `<b>${esc(pezzo)}</b>`) : esc(frase);
  if (lettura === MUTO)
    return cambio
      ? esc(ultimoCambioTesto(cambio, adesso))
      : "";
  if (dati.famiglia === "movimento") {
    if (lettura === ATTIVO && cambio) {
      const quando = quandoTesto(cambio, adesso);
      return esc(t(`Iniziato ${quando}`, `Started ${quando}`));
    }
    if (ultimo && !ultimo.inCorso) {
      const fa = faTesto(adesso - ultimo.da);
      const ora = orario(ultimo.da);
      const quanto = durataTesto(ultimo.durata);
      const frase = `${t(`Ultimo movimento ${fa}`, `Last movement ${fa}`)}, ${t(`alle ${ora}`, `at ${ora}`)} · ${t(`durato ${quanto}`, `lasted ${quanto}`)}`;
      return evidenzia(frase, fa);
    }
    if (oggi.esito === "pronta" || oggi.esito === "vuoto")
      return esc(t("Nessun movimento nelle ultime 24 ore", "No movement in the last 24 hours"));
    return cambio
      ? esc(ultimoCambioTesto(cambio, adesso))
      : "";
  }
  if (lettura === ATTIVO && cambio) {
    const quando = quandoTesto(cambio, adesso);
    return evidenzia(t(`Aperta ${quando}`, `Opened ${quando}`), orario(cambio));
  }
  if (ultimo && !ultimo.inCorso) {
    const quando = quandoTesto(ultimo.a, adesso);
    const quanto = durataTesto(ultimo.durata);
    const frase = `${t(`Ultima chiusura ${quando}`, `Last closed ${quando}`)}, ${t(`dopo ${quanto} aperta`, `after ${quanto} open`)}`;
    return evidenzia(frase, orario(ultimo.a));
  }
  if (oggi.esito === "pronta" || oggi.esito === "vuoto")
    return esc(t("Nessuna apertura nelle ultime 24 ore", "Not opened in the last 24 hours"));
  return cambio
    ? esc(ultimoCambioTesto(cambio, adesso))
    : "";
}

function adessoMarkup(dati, lettura, vivo, adesso) {
  const da = Number.isFinite(vivo?.time) ? durataTesto(adesso - vivo.time) : "";
  const sotto = sottoLAdesso(dati, lettura, vivo, adesso);
  return `<div class="dm-ur-adesso" aria-live="polite">
    <small>${esc(t("Adesso", "Now"))}</small>
    <div class="dm-ur-grande"><b>${esc(parolaDelloStato(dati, lettura))}</b>${
      da ? `<span>${esc(t(`da ${da}`, `for ${da}`))}</span>` : ""
    }</div>
    ${sotto ? `<p>${sotto}</p>` : ""}
  </div>`;
}

function periodoMarkup(modo, finestra) {
  const quando =
    modo === "ieri"
      ? dataBreve(finestra.start)
      : `${t("ieri", "yesterday")} ${orario(finestra.start)} → ${t("oggi", "today")} ${orario(finestra.end)}`;
  const tasto = (quale, parola) =>
    `<button type="button" data-ur-modo="${quale}" aria-pressed="${modo === quale}"${
      modo === quale ? ' class="on"' : ""
    }>${esc(parola)}</button>`;
  return `<div class="dm-ur-periodo">
    <div class="dm-ur-seg" role="group" aria-label="${esc(t("Periodo", "Period"))}">
      ${tasto("24h", t("Ultime 24 ore", "Last 24 hours"))}${tasto("ieri", t("Ieri", "Yesterday"))}
    </div>
    <div class="dm-ur-quando">${esc(quando)}</div>
  </div>`;
}

/* ── le tre caselle ───────────────────────────────────────────────────── */

function casella(etichetta, valore, sotto) {
  return `<div class="dm-ur-casella"><small>${esc(etichetta)}</small><b>${esc(valore)}</b><span>${esc(
    sotto,
  )}</span></div>`;
}

function caselleMarkup(dati, modo, lettura) {
  const pronta = lettura.esito === "pronta" ? lettura.analisi : null;
  const vuota = lettura.esito === "vuoto";
  const ieri = modo === "ieri";
  if (dati.famiglia === "movimento") {
    const conti = pronta?.conti;
    const volte = conti ? conti.volte : vuota ? 0 : null;
    const primo = conti?.primo;
    const fitta = conti?.fitta;
    const ore = (ms) => String(new Date(ms).getHours()).padStart(2, "0");
    return `<div class="dm-ur-caselle">
      ${casella(
        ieri ? t("Ieri", "Yesterday") : t("Oggi", "Today"),
        volte === null ? "—" : String(volte),
        volte === 1 ? t("rilevazione", "detection") : t("rilevazioni", "detections"),
      )}
      ${casella(
        t("Il primo", "The first"),
        primo ? orario(primo.da) : "—",
        !primo
          ? t("nessuno", "none")
          : ieri
            ? t("ieri", "yesterday")
            : new Date(primo.da).getHours() < 12
              ? t("stamattina", "this morning")
              : t("oggi", "today"),
      )}
      ${casella(
        t("Più fitto", "Busiest"),
        fitta ? `${ore(fitta.da)}–${ore(fitta.a)}` : "—",
        fitta ? inUnOra(fitta.conto) : t("nessuno", "none"),
      )}
    </div>`;
  }
  const conti = pronta?.conti;
  const volte = conti ? conti.volte : vuota ? 0 : null;
  const prima = conti ? conti.prima : 0;
  const lunga = conti?.piuLunga;
  const valoreVolte =
    volte === null ? "—" : volte === 1 ? t("1 volta", "1 time") : t(`${volte} volte`, `${volte} times`);
  const sottoVolte = ieri
    ? t("nelle 24 ore", "over 24 hours")
    : eDiSera((pronta?.elenco || []).filter((evento) => evento.gruppo === "prima"))
      ? t(`${prima} ieri sera`, `${prima} yesterday evening`)
      : t(`${prima} ieri`, `${prima} yesterday`);
  const quota = Math.round((conti?.quota || 0) * 100);
  return `<div class="dm-ur-caselle">
    ${casella(ieri ? t("Aperta ieri", "Opened yesterday") : t("Aperta oggi", "Opened today"), valoreVolte, sottoVolte)}
    ${casella(
      t("In tutto", "In total"),
      conti?.totale ? durataTesto(conti.totale) : conti || vuota ? `0 ${t("min", "min")}` : "—",
      ieri ? t(`${quota}% del giorno`, `${quota}% of the day`) : t("da mezzanotte", "since midnight"),
    )}
    ${casella(
      t("La più lunga", "The longest"),
      lunga ? durataTesto(lunga.durata) : "—",
      lunga ? alleOre(orario(lunga.da)) : t("nessuna", "none"),
    )}
  </div>`;
}

/* ── i disegni ────────────────────────────────────────────────────────── */

function asse(finestra, modo, y) {
  const x = (ms) => ((ms - finestra.start) / (finestra.end - finestra.start)) * W;
  const tacca = (ms, parola, ancora) =>
    `<line x1="${x(ms).toFixed(1)}" x2="${x(ms).toFixed(1)}" y1="${y - 4}" y2="${y}" class="dm-ur-tacca"/>
    <text x="${x(ms).toFixed(1)}" y="${y + 12}" text-anchor="${ancora}" class="dm-ur-asse">${esc(parola)}</text>`;
  const inizio =
    modo === "ieri" ? "00:00" : `${t("ieri", "yesterday")} ${orario(finestra.start)}`;
  const fine = modo === "ieri" ? "24:00" : t("adesso", "now");
  /* Quanto tempo coprono le etichette dei due capi, piu' mezza etichetta di
   * una tacca e un respiro. Il testo sta nello stesso viewBox della striscia,
   * quindi la misura in unita' del disegno vale a ogni larghezza. «ieri
   * 14:38» copriva da sola tre ore e mezza, e la tacca delle 18 ci finiva
   * sopra; «adesso» si mangiava le 12. */
  const perUnita = (finestra.end - finestra.start) / W;
  const coperto = (parola) => (String(parola).length * LETTERA + MEZZA_TACCA) * perUnita;
  return [
    tacca(finestra.start, inizio, "start"),
    ...tacche(finestra.start, finestra.end, {
      margineInizio: coperto(inizio),
      margineFine: coperto(fine),
    }).map((ms) => tacca(ms, orario(ms), "middle")),
    tacca(finestra.end, fine, "end"),
  ].join("");
}

function mezzanotteMarkup(finestra, modo, y1, y2) {
  if (modo === "ieri") return "";
  const m = mezzanotteDi(finestra.end);
  if (m <= finestra.start) return "";
  const x = (((m - finestra.start) / (finestra.end - finestra.start)) * W).toFixed(1);
  return `<line x1="${x}" x2="${x}" y1="${y1}" y2="${y2}" class="dm-ur-mezzanotte"/>
    <text x="${Number(x) + 4}" y="${y1 + 8}" class="dm-ur-oggi">${esc(t("Oggi", "Today").toLocaleUpperCase(locale()))}</text>`;
}

const TRATTEGGIO = `<defs><pattern id="dm-ur-tratteggio" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" class="dm-ur-sfondo"/><line x1="0" y1="0" x2="0" y2="5" class="dm-ur-righina"/></pattern></defs>`;

function silenziMarkup(analisi, x, y, h) {
  return analisi.silenzi
    .map(({ da, a }) => {
      const quando = `${orario(da)}–${orario(a)}`;
      return `<rect x="${x(da).toFixed(1)}" y="${y}" width="${Math.max(4, x(a) - x(da)).toFixed(1)}" height="${h}" fill="url(#dm-ur-tratteggio)"><title>${esc(
        t(`Non rispondeva (${quando})`, `Not answering (${quando})`),
      )}</title></rect>`;
    })
    .join("");
}

function strisciaDelVarco(analisi, finestra, modo) {
  const x = (ms) => ((ms - finestra.start) / (finestra.end - finestra.start)) * W;
  const binario = analisi.tratti
    .filter((tratto) => tratto.stato !== MUTO)
    .map(
      (tratto) =>
        `<rect x="${x(tratto.da).toFixed(1)}" y="26" width="${Math.max(0.5, x(tratto.a) - x(tratto.da)).toFixed(1)}" height="16" class="dm-ur-chiusa"/>`,
    )
    .join("");
  const aperture = analisi.eventi
    .map((apertura) => {
      const quando = `${orario(apertura.da)}–${orario(apertura.a)}`;
      return `<rect x="${(x(apertura.da) - 1).toFixed(1)}" y="14" width="${Math.max(3, x(apertura.a) - x(apertura.da)).toFixed(1)}" height="40" rx="1.5" class="dm-ur-aperta"><title>${esc(
        t(`Aperta ${quando}`, `Opened ${quando}`),
      )} · ${esc(durataTesto(apertura.durata))}</title></rect>`;
    })
    .join("");
  const lunga = analisi.conti.piuLunga;
  let etichetta = "";
  if (lunga) {
    const cx = x(lunga.da);
    const ancora = cx > W - 50 ? "end" : cx < 50 ? "start" : "middle";
    etichetta = `<text x="${Math.min(W, Math.max(0, cx)).toFixed(1)}" y="8" text-anchor="${ancora}" class="dm-ur-picco">${esc(
      `${orario(lunga.da)} · ${durataTesto(lunga.durata)}`,
    )}</text>`;
  }
  return `<svg viewBox="-2 -4 ${W + 4} 82" role="img" aria-labelledby="dm-ur-t-striscia">${TRATTEGGIO}${mezzanotteMarkup(
    finestra,
    modo,
    4,
    60,
  )}${binario}${silenziMarkup(analisi, x, 26, 16)}${aperture}${etichetta}${asse(finestra, modo, 70)}</svg>`;
}

function strisciaDelMovimento(analisi, finestra, modo, dati) {
  const x = (ms) => ((ms - finestra.start) / (finestra.end - finestra.start)) * W;
  const fondo = analisi.tratti
    .filter((tratto) => tratto.stato !== MUTO)
    .map(
      (tratto) =>
        `<rect x="${x(tratto.da).toFixed(1)}" y="22" width="${Math.max(0.5, x(tratto.a) - x(tratto.da)).toFixed(1)}" height="20" class="dm-ur-quieto"/>`,
    )
    .join("");
  const parola = dati.stabile ? t("Occupato", "Occupied") : t("Movimento", "Movement");
  const impulsi = analisi.eventi
    .map((movimento) => {
      const quando = orario(movimento.da);
      return `<rect x="${(x(movimento.da) - 1).toFixed(1)}" y="12" width="${Math.max(2.5, x(movimento.a) - x(movimento.da)).toFixed(1)}" height="40" rx="1.2" class="dm-ur-impulso"><title>${esc(
        dati.stabile ? `${parola} ${quando}` : t(`Movimento ${quando}`, `Movement ${quando}`),
      )} · ${esc(durataTesto(movimento.durata))}</title></rect>`;
    })
    .join("");
  let quiete = "";
  if (analisi.quiete) {
    const { da, a } = analisi.quiete;
    const larga = x(a) - x(da);
    if (larga > 96) {
      const cx = (x(da) + x(a)) / 2;
      const quando = `${orario(da)}–${orario(a)}`;
      const testo = t(`quiete ${quando}`, `quiet ${quando}`);
      quiete = `<rect x="${(cx - 46).toFixed(1)}" y="27" width="92" height="11" class="dm-ur-quieto"/><text x="${cx.toFixed(1)}" y="35.3" text-anchor="middle" class="dm-ur-quiete">${esc(testo)}</text>`;
    }
  }
  return `<svg viewBox="-2 -2 ${W + 4} 78" role="img" aria-labelledby="dm-ur-t-striscia">${TRATTEGGIO}${mezzanotteMarkup(
    finestra,
    modo,
    2,
    58,
  )}${fondo}${silenziMarkup(analisi, x, 22, 20)}${impulsi}${quiete}${asse(finestra, modo, 66)}</svg>`;
}

function barreOrarie(analisi, finestra, modo) {
  const x = (ms) => ((ms - finestra.start) / (finestra.end - finestra.start)) * W;
  const H = 54;
  const massimo = Math.max(0, ...analisi.perOra.map((ora) => ora.conto));
  let fuori = "";
  let detto = false;
  for (const ora of analisi.perOra) {
    const sx = x(ora.da) + 1;
    const largo = Math.max(2, x(ora.a) - x(ora.da) - 2);
    if (!ora.conto || !massimo) {
      fuori += `<rect x="${sx.toFixed(1)}" y="${H - 1.5}" width="${largo.toFixed(1)}" height="1.5" class="dm-ur-griglia"/>`;
      continue;
    }
    const alto = (ora.conto / massimo) * (H - 14);
    const r = Math.min(3, largo / 2);
    fuori += `<path d="M${sx.toFixed(1)} ${H}V${(H - alto + r).toFixed(1)}q0-${r} ${r}-${r}h${(largo - 2 * r).toFixed(1)}q${r} 0 ${r} ${r}V${H}z" class="dm-ur-barra"><title>${esc(
      `${orario(ora.inizio)}–${orario(ora.inizio + 3_600_000)}: ${ora.conto}`,
    )}</title></path>`;
    if (ora.conto === massimo && !detto) {
      detto = true;
      fuori += `<text x="${(sx + largo / 2).toFixed(1)}" y="${(H - alto - 4).toFixed(1)}" text-anchor="middle" class="dm-ur-picco">${ora.conto}</text>`;
    }
  }
  return `<svg viewBox="-2 -2 ${W + 4} ${H + 22}" role="img" aria-labelledby="dm-ur-t-ore"><line x1="0" x2="${W}" y1="${H}" y2="${H}" class="dm-ur-asse-linea"/>${fuori}${asse(
    finestra,
    modo,
    H + 10,
  )}</svg>`;
}

function legendaDelVarco(analisi) {
  const silenzi = analisi?.silenzi || [];
  let muti = "";
  if (silenzi.length) {
    const quando =
      silenzi.length === 1
        ? `${orario(silenzi[0].da)}–${orario(silenzi[0].a)}`
        : silenzi
            .slice(0, 2)
            .map(({ da, a }) => `${orario(da)}–${orario(a)}`)
            .join(", ") + (silenzi.length > 2 ? "…" : "");
    muti = `<span><i class="dm-ur-l-muto"></i>${esc(t(`Non rispondeva (${quando})`, `Not answering (${quando})`))}</span>`;
  }
  return `<div class="dm-ur-legenda">
    <span><i class="dm-ur-l-aperta"></i>${esc(t("Aperta", "Open"))}</span>
    <span><i class="dm-ur-l-chiusa"></i>${esc(t("Chiusa", "Closed"))}</span>
    ${muti}
  </div>`;
}

function avvisoMarkup(lettura, dati) {
  if (lettura.esito === "attesa")
    return `<div class="dm-ur-avviso" role="status"><span class="dm-ur-giro" aria-hidden="true"></span>${esc(
      t("Leggo lo storico dal Recorder…", "Reading the history from the Recorder…"),
    )}</div>`;
  if (lettura.esito === "errore")
    return `<div class="dm-ur-avviso" role="alert" data-ur-esito="errore"><span>${esc(
      t(
        "Il Recorder non ha risposto: lo storico non è arrivato.",
        "The Recorder did not answer: the history did not arrive.",
      ),
    )}</span><button type="button" data-ur-riprova>${esc(t("Riprova", "Try again"))}</button></div>`;
  if (lettura.esito === "vuoto")
    return `<div class="dm-ur-avviso" role="status" data-ur-esito="vuoto">${esc(
      t("Nessun cambio registrato in questo periodo", "No change recorded in this period"),
    )}</div>`;
  return "";
}

function graficiMarkup(dati, modo, lettura) {
  const { finestra } = lettura;
  const analisi = lettura.esito === "pronta" ? lettura.analisi : null;
  if (dati.famiglia === "movimento") {
    const titolo1 = t("Quando c'è stato movimento", "When there was movement");
    const titolo2 = t("Rilevazioni per ora", "Detections per hour");
    if (!analisi)
      return `<div class="dm-ur-titoletto" id="dm-ur-t-striscia">${esc(titolo1)}</div>
        <div class="dm-ur-grafico">${avvisoMarkup(lettura, dati)}</div>`;
    return `<div class="dm-ur-titoletto" id="dm-ur-t-striscia">${esc(titolo1)}</div>
      <div class="dm-ur-grafico">${strisciaDelMovimento(analisi, finestra, modo, dati)}
        <div class="dm-ur-legenda">
          <span><i class="dm-ur-l-impulso"></i>${esc(t("Movimento rilevato", "Movement detected"))}</span>
          <span><i class="dm-ur-l-quieto"></i>${esc(t("Nessun movimento", "No movement"))}</span>
        </div></div>
      <div class="dm-ur-titoletto" id="dm-ur-t-ore">${esc(titolo2)}</div>
      <div class="dm-ur-grafico">${barreOrarie(analisi, finestra, modo)}
        <div class="dm-ur-legenda">
          <span><i class="dm-ur-l-barra"></i>${esc(t("Rilevazioni nell'ora", "Detections in the hour"))}</span>
          <span><i class="dm-ur-l-nessuna"></i>${esc(t("Nessuna", "None"))}</span>
        </div></div>`;
  }
  const titolo =
    modo === "ieri"
      ? t("Aperta e chiusa ieri", "Open and closed yesterday")
      : t("Aperta e chiusa nelle 24 ore", "Open and closed over 24 hours");
  if (!analisi)
    return `<div class="dm-ur-titoletto" id="dm-ur-t-striscia">${esc(titolo)}</div>
      <div class="dm-ur-grafico">${avvisoMarkup(lettura, dati)}</div>`;
  return `<div class="dm-ur-titoletto" id="dm-ur-t-striscia">${esc(titolo)}</div>
    <div class="dm-ur-grafico">${strisciaDelVarco(analisi, finestra, modo)}${legendaDelVarco(analisi)}</div>`;
}

/* ── l'elenco ─────────────────────────────────────────────────────────── */

function rigaMarkup(dati, evento, primo, modo, adesso) {
  const ora = orario(evento.da);
  let grande;
  let sotto;
  if (dati.famiglia === "movimento") {
    const parola = dati.stabile ? t("Occupato", "Occupied") : t("Movimento", "Movement");
    grande = `${parola} · ${durataTesto(evento.durata)}`;
    const fine = orario(evento.a);
    sotto = evento.inCorso
      ? t("in corso", "ongoing")
      : primo && modo !== "ieri"
        ? t("poi libero", "then clear")
        : t(`libero alle ${fine}`, `clear at ${fine}`);
  } else {
    const quanto = durataTesto(evento.durata);
    grande = t(`Aperta · per ${quanto}`, `Open · ${quanto}`);
    const fine = orario(evento.a);
    sotto = evento.inCorso
      ? t("ancora aperta", "still open")
      : t(`chiusa alle ${fine}`, `closed at ${fine}`);
  }
  /* «12 min fa» sulla riga piu' recente: per una porta da quando si e'
   * richiusa — e' lo stesso numero del «Chiusa da 12 min» qui sopra —, per un
   * movimento da quando e' cominciato. */
  const riferimento = dati.famiglia === "varco" && !evento.inCorso ? evento.a : evento.da;
  const fa = primo && modo !== "ieri" ? faTesto(adesso - riferimento) : "";
  return `<li class="dm-ur-riga"><span class="dm-ur-ora">${esc(ora)}</span><i class="dm-ur-punto" aria-hidden="true"></i>
    <div><b>${esc(grande)}</b><span>${esc(sotto)}</span></div><em>${esc(fa)}</em></li>`;
}

function elencoMarkup(dati, modo, lettura, adesso) {
  const titolo =
    dati.famiglia === "movimento"
      ? t("Gli ultimi movimenti", "The latest movements")
      : t("Le ultime aperture", "The latest openings");
  const testa = `<div class="dm-ur-titoletto">${esc(titolo)}</div>`;
  if (lettura.esito !== "pronta")
    return `${testa}<div class="dm-ur-eventi dm-ur-eventi-vuoti">${
      lettura.esito === "vuoto" ? avvisoMarkup(lettura, dati) : `<div class="dm-ur-segnaposto" aria-hidden="true"></div>`.repeat(3)
    }</div>`;
  const elenco = lettura.analisi.elenco;
  if (!elenco.length)
    return `${testa}<div class="dm-ur-eventi"><div class="dm-ur-avviso" data-ur-esito="nessuno">${esc(
      dati.famiglia === "movimento"
        ? t("Nessun movimento in questo periodo", "No movement in this period")
        : t("Mai aperta in questo periodo", "Never opened in this period"),
    )}</div></div>`;
  const quante = dati.famiglia === "movimento" ? RIGHE_DEL_MOVIMENTO : RIGHE_DEL_VARCO;
  const tutte = state.aperto?.tutti === true;
  const viste = tutte ? elenco : elenco.slice(0, quante);
  const oggi = viste.filter((evento) => evento.gruppo === "oggi");
  const prima = viste.filter((evento) => evento.gruppo === "prima");
  const nomeOggi = modo === "ieri" ? t("Ieri", "Yesterday") : t("Oggi", "Today");
  const nomePrima = eDiSera(elenco.filter((evento) => evento.gruppo === "prima"))
    ? t("Ieri sera", "Yesterday evening")
    : t("Ieri", "Yesterday");
  let indice = 0;
  const righe = (gruppo) =>
    gruppo.map((evento) => rigaMarkup(dati, evento, indice++ === 0, modo, adesso)).join("");
  const blocchi = [
    oggi.length
      ? `<li class="dm-ur-gruppo" role="presentation">${esc(nomeOggi)}</li>${righe(oggi)}`
      : "",
    prima.length
      ? `<li class="dm-ur-gruppo" role="presentation">${esc(nomePrima)}</li>${righe(prima)}`
      : "",
  ].join("");
  const altro =
    elenco.length > quante
      ? `<button type="button" class="dm-ur-altro" data-ur-tutti aria-expanded="${tutte}">${esc(
          tutte ? t("Mostra meno", "Show less") : `${t("Mostra tutti", "Show all")} (${elenco.length})`,
        )}</button>`
      : "";
  return `${testa}<ul class="dm-ur-eventi" aria-label="${esc(titolo)}">${blocchi}</ul>${altro}`;
}

function tastiMarkup() {
  const ha = dentroHomeAssistant()
    ? `<button type="button" class="dm-ur-tasto" data-ur-ha>${esc(t("In Home Assistant", "Open in Home Assistant"))}</button>`
    : "";
  return `<div class="dm-ur-tasti${ha ? "" : " dm-ur-tasti-uno"}">${ha}<button type="button" class="dm-ur-tasto dm-ur-primo" data-ur-storico>${esc(
    t("Storico completo", "Full history"),
  )}</button></div>`;
}

/* ── il foglio ────────────────────────────────────────────────────────── */

function contenitore() {
  let nodo = doc.getElementById(ULTIME_ID);
  if (nodo) return nodo;
  nodo = doc.createElement("div");
  nodo.id = ULTIME_ID;
  nodo.hidden = true;
  nodo.innerHTML = `<div class="dm-ur-velo" data-ur-chiudi></div>
    <section class="dm-ur-foglio" role="dialog" aria-modal="true" aria-labelledby="dm-ur-titolo" tabindex="-1"></section>`;
  doc.body.append(nodo);
  nodo.addEventListener("click", alClic);
  return nodo;
}

function disegna() {
  const aperto = state.aperto;
  if (!aperto || !doc) return;
  const nodo = contenitore();
  const foglio = nodo.querySelector(".dm-ur-foglio");
  const adesso = Date.now();
  const dati = sensore(aperto.entity, aperto.detto);
  const vivo = vivoDi(dati.entity);
  const lettura = letturaDelloStato(vivo?.state, { invertito: dati.invertito });
  const storia = letta(dati, aperto.modo, adesso);
  nodo.dataset.famiglia = dati.famiglia;
  nodo.dataset.tono = tonoDi(dati, lettura);
  nodo.dataset.esito = storia.esito;
  /* Chi aveva il fuoco su un tasto del foglio lo ritrova sullo stesso tasto:
   * il foglio si riscrive intero, e il fuoco altrimenti cadrebbe nel vuoto. */
  const attivo = doc.activeElement;
  const fuoco =
    attivo && foglio.contains(attivo)
      ? [...attivo.attributes].find((a) => a.name.startsWith("data-ur-"))
      : null;
  const chiaveFuoco = fuoco ? `[${fuoco.name}${fuoco.value ? `="${fuoco.value}"` : ""}]` : "";
  const scorso = foglio.scrollTop;
  foglio.innerHTML = `<div class="dm-ur-maniglia" aria-hidden="true"></div>
    ${testaMarkup(dati)}
    <div class="dm-ur-corpo">
      <div class="dm-ur-sx">
        ${adessoMarkup(dati, lettura, vivo, adesso)}
        ${periodoMarkup(aperto.modo, storia.finestra)}
        ${caselleMarkup(dati, aperto.modo, storia)}
        ${graficiMarkup(dati, aperto.modo, storia)}
      </div>
      <div class="dm-ur-dx">
        ${elencoMarkup(dati, aperto.modo, storia, adesso)}
        ${tastiMarkup()}
      </div>
    </div>
    <p class="dm-ur-nota">${esc(
      t(
        "Dal Recorder di Home Assistant di casa · niente esce dalla rete",
        "From the Home Assistant Recorder at home · nothing leaves the network",
      ),
    )}</p>`;
  foglio.scrollTop = scorso;
  if (chiaveFuoco) foglio.querySelector(chiaveFuoco)?.focus?.({ preventScroll: true });
  sveglia(vivo, adesso);
}

/* Una sveglia sola, quando il «da 12 min» cambia scritta: a foglio chiuso
 * non c'e'. Al massimo un minuto, perche' anche le ultime 24 ore scorrono. */
function sveglia(vivo, adesso) {
  if (state.sveglia) root.clearTimeout?.(state.sveglia);
  state.sveglia = 0;
  if (!state.aperto) return;
  const fra = Math.min(
    60_000 - (adesso % 60_000),
    quandoCambiaIlDaQuando(vivo?.time, adesso) ?? 60_000,
  );
  state.sveglia =
    root.setTimeout?.(
      () => {
        state.sveglia = 0;
        ridisegna();
      },
      Math.max(1000, fra + 50),
    ) || 0;
}

function ridisegna() {
  if (!state.aperto || state.frame) return;
  const giro = () => {
    state.frame = 0;
    try {
      disegna();
    } catch (errore) {
      root.console?.warn?.("[DashboardModern] ultime rilevazioni", errore);
    }
  };
  state.frame = root.requestAnimationFrame?.(giro) || 0;
  if (!state.frame) giro();
}

/**
 * Apre il foglio di un'entità.
 *
 * `detto` è quello che sa chi lo apre: `famiglia` (`varco` o `movimento`),
 * `nome`, `glifo`, `tipo`. Torna `false` se non c'è niente da aprire.
 */
export function apriUltimeRilevazioni(entity, detto = {}) {
  const id = clean(entity);
  if (!doc || !id.includes(".")) return false;
  const tornaA = detto.tornaA || doc.activeElement;
  state.aperto = { entity: id, detto, modo: "24h", tutti: false, tornaA };
  const nodo = contenitore();
  nodo.hidden = false;
  doc.documentElement.dataset.dmUltimeAperto = "si";
  disegna();
  nodo.querySelector("[data-ur-chiudi].dm-ur-x")?.focus?.({ preventScroll: true });
  if (root.navigator?.vibrate) root.navigator.vibrate(8);
  return true;
}

export function chiudiUltimeRilevazioni() {
  const aperto = state.aperto;
  if (!aperto) return false;
  state.aperto = null;
  if (state.sveglia) root.clearTimeout?.(state.sveglia);
  state.sveglia = 0;
  const nodo = doc?.getElementById(ULTIME_ID);
  if (nodo) {
    nodo.hidden = true;
    nodo.querySelector(".dm-ur-foglio").innerHTML = "";
  }
  if (doc?.documentElement) delete doc.documentElement.dataset.dmUltimeAperto;
  const torna = aperto.tornaA;
  if (torna?.isConnected) torna.focus?.({ preventScroll: true });
  return true;
}

/** Se il foglio è aperto, e di chi. */
export function ultimeRilevazioniAperte() {
  return state.aperto ? state.aperto.entity : "";
}

function alClic(evento) {
  const bersaglio = evento.target;
  const aperto = state.aperto;
  if (!aperto) return;
  if (bersaglio?.closest?.("[data-ur-chiudi]")) {
    evento.preventDefault();
    chiudiUltimeRilevazioni();
    return;
  }
  const modo = bersaglio?.closest?.("[data-ur-modo]");
  if (modo) {
    evento.preventDefault();
    const quale = modo.dataset.urModo === "ieri" ? "ieri" : "24h";
    if (quale !== aperto.modo) {
      aperto.modo = quale;
      aperto.tutti = false;
      disegna();
    }
    return;
  }
  if (bersaglio?.closest?.("[data-ur-tutti]")) {
    evento.preventDefault();
    aperto.tutti = !aperto.tutti;
    disegna();
    return;
  }
  if (bersaglio?.closest?.("[data-ur-riprova]")) {
    evento.preventDefault();
    const { chiesta } = sceltaDelPeriodo(aperto.modo, Date.now());
    dimenticaLoStorico(aperto.entity, chiesta);
    disegna();
    return;
  }
  if (bersaglio?.closest?.("[data-ur-ha]")) {
    evento.preventDefault();
    const entity = aperto.entity;
    if (apriLaSchedaDellEntita(entity)) chiudiUltimeRilevazioni();
    return;
  }
  if (bersaglio?.closest?.("[data-ur-storico]")) {
    evento.preventDefault();
    const dati = sensore(aperto.entity, aperto.detto);
    const { chiesta } = sceltaDelPeriodo(aperto.modo, Date.now());
    /* Lo storico del guscio sta sotto questo foglio: prima si chiude il
     * foglio, poi si apre lui. */
    chiudiUltimeRilevazioni();
    openHistory(null, dati.entity, dati.nome, chiesta);
  }
}

/* Il tasto Esc chiude, e il fuoco non esce dal foglio con Tab. Si ascolta
 * sulla finestra e prima di tutti: sotto c'è magari la finestra di una
 * tessera, che con lo stesso Esc si chiuderebbe anche lei. */
function allaTastiera(evento) {
  if (!state.aperto) return;
  if (evento.key === "Escape") {
    evento.preventDefault();
    evento.stopPropagation();
    chiudiUltimeRilevazioni();
    return;
  }
  if (evento.key !== "Tab") return;
  const foglio = doc.querySelector(`#${ULTIME_ID} .dm-ur-foglio`);
  if (!foglio) return;
  const presi = [...foglio.querySelectorAll("button:not([disabled]),[href],[tabindex]:not([tabindex='-1'])")];
  if (!presi.length) return;
  const primo = presi[0];
  const ultimo = presi[presi.length - 1];
  if (!foglio.contains(doc.activeElement)) {
    evento.preventDefault();
    primo.focus();
  } else if (evento.shiftKey && doc.activeElement === primo) {
    evento.preventDefault();
    ultimo.focus();
  } else if (!evento.shiftKey && doc.activeElement === ultimo) {
    evento.preventDefault();
    primo.focus();
  }
}

/* ── chi apre il foglio ───────────────────────────────────────────────── */

function cartaSotto(evento) {
  const carta = evento.target?.closest?.(`[${ATTRIBUTO}]`);
  if (!carta) return null;
  /* Un tasto dentro la carta fa il suo mestiere: lo scudo dell'antifurto, il
   * velo della domanda. Il foglio si apre solo dal resto della carta. */
  const tasto = evento.target.closest("button,a,input,select,textarea,[data-dm-varco-velo]");
  if (tasto && tasto !== carta && carta.contains(tasto)) return null;
  return carta;
}

function apriDallaCarta(carta) {
  apriUltimeRilevazioni(carta.getAttribute(ATTRIBUTO), {
    famiglia: carta.dataset.dmUltimeFamiglia,
    nome: carta.dataset.dmUltimeNome,
    glifo: carta.dataset.dmUltimeGlifo,
    tipo: carta.dataset.dmUltimeTipo,
    tornaA: carta,
  });
}

function alClicSullaCarta(evento) {
  if (evento.defaultPrevented) return;
  const carta = cartaSotto(evento);
  if (!carta) return;
  evento.preventDefault();
  apriDallaCarta(carta);
}

function alTastoSullaCarta(evento) {
  if (evento.key !== "Enter" && evento.key !== " ") return;
  const carta = evento.target?.matches?.(`[${ATTRIBUTO}]`) ? evento.target : null;
  if (!carta) return;
  evento.preventDefault();
  apriDallaCarta(carta);
}

/**
 * Gli attributi che fanno di una carta l'apertura del foglio. Li scrivono
 * chi disegna le carte, ognuno col suo `esc`: qui sta solo la forma, cosi'
 * le tre pagine scrivono la stessa cosa.
 */
export function attributiPerLeUltime({ entity, famiglia, nome = "", glifo = "", tipo = "" } = {}) {
  const id = clean(entity);
  if (!id) return "";
  const etichetta = `${t("Ultime 24 ore", "Last 24 hours")} · ${clean(nome) || id}`;
  return ` ${ATTRIBUTO}="${esc(id)}" data-dm-ultime-famiglia="${esc(famiglia)}" data-dm-ultime-nome="${esc(
    nome,
  )}" data-dm-ultime-glifo="${esc(glifo)}" data-dm-ultime-tipo="${esc(tipo)}" role="button" tabindex="0" aria-haspopup="dialog" aria-label="${esc(etichetta)}"`;
}

/* ── lo stile ─────────────────────────────────────────────────────────── */

function installStyles() {
  const R = `#${ULTIME_ID}`;
  installStyle(
    "dm-ultime-rilevazioni-style",
    `
    ${R}{--ur-card:#fff;--ur-card2:#f4f6f9;--ur-border:#e2e8f0;--ur-text:#0f172a;--ur-dim:#64748b;--ur-mute:#94a3b8;
      --ur-accent:#7c3aed;--ur-closed-track:#bbf7d0;--ur-closed-ink:#15803d;--ur-open:#b91c1c;
      --ur-motion:#1d4ed8;--ur-motion-soft:#dbeafe;--ur-motion-bar:#93c5fd;--ur-grid:#e2e8f0;--ur-unav:#94a3b8;
      --ur-veil:rgba(15,23,42,.42);--ur-tone:#16a34a;
      position:fixed;inset:0;z-index:10001;color:var(--ur-text);font-family:inherit;-webkit-font-smoothing:antialiased}
    html[data-theme="dark"] ${R}{--ur-card:#131c31;--ur-card2:#1a243b;--ur-border:#26324b;--ur-text:#e5e7eb;--ur-dim:#94a3b8;
      --ur-mute:#64748b;--ur-accent:#8b5cf6;--ur-closed-track:#14532d;--ur-closed-ink:#4ade80;--ur-open:#f87171;
      --ur-motion:#60a5fa;--ur-motion-soft:#172554;--ur-motion-bar:#2b4c8a;--ur-grid:#26324b;--ur-unav:#64748b;
      --ur-veil:rgba(2,6,16,.62)}
    ${R}[hidden]{display:none}
    ${R}[data-tono="chiuso"]{--ur-tone:#16a34a;--ur-ink:var(--ur-closed-ink)}
    ${R}[data-tono="aperto"]{--ur-tone:#dc2626;--ur-ink:var(--ur-open)}
    ${R}[data-tono="movimento"]{--ur-tone:#2563eb;--ur-ink:var(--ur-motion)}
    ${R}[data-tono="muto"]{--ur-tone:#94a3b8;--ur-ink:var(--ur-dim)}
    ${R} .dm-ur-velo{position:absolute;inset:0;background:var(--ur-veil);animation:dmUrVelo .18s ease-out}
    ${R} .dm-ur-foglio{position:absolute;left:0;right:0;bottom:0;box-sizing:border-box;
      max-height:calc(100dvh - max(28px, env(safe-area-inset-top, 0px) + 12px));overflow:auto;overscroll-behavior:contain;
      background:var(--ur-card);color:var(--ur-text);border-radius:28px 28px 0 0;
      padding:10px 18px calc(22px + env(safe-area-inset-bottom, 0px));box-shadow:0 -10px 40px rgba(0,0,0,.2);
      animation:dmUrSu .24s cubic-bezier(.2,.8,.2,1);outline:none}
    ${R} *{box-sizing:border-box}
    @keyframes dmUrSu{from{transform:translateY(40px);opacity:.4}to{transform:none;opacity:1}}
    @keyframes dmUrVelo{from{opacity:0}to{opacity:1}}
    @media (prefers-reduced-motion:reduce){${R} .dm-ur-foglio,${R} .dm-ur-velo{animation:none}}
    ${R} .dm-ur-maniglia{width:42px;height:5px;border-radius:9px;background:var(--ur-border);margin:2px auto 14px}
    ${R} .dm-ur-testa{display:grid;grid-template-columns:54px minmax(0,1fr) auto;gap:14px;align-items:center}
    ${R} .dm-ur-ic{width:54px;height:54px;border-radius:18px;display:grid;place-items:center;color:var(--ur-ink);
      background:color-mix(in srgb,var(--ur-tone) 18%,var(--ur-card))}
    ${R} .dm-ur-ic svg{width:32px;height:32px;display:block}
    ${R} .dm-ur-ic .dm-catalogo-art{display:grid;place-items:center;line-height:0}
    ${R} .dm-ur-nome{min-width:0}
    ${R} .dm-ur-nome h2{margin:0;padding:0;font-family:inherit;font-size:21px;font-weight:900;line-height:1.15;letter-spacing:normal;text-transform:none;text-align:left;color:var(--ur-text);background:none;border:0;overflow-wrap:anywhere}
    ${R} .dm-ur-briciole{margin-top:3px;font-size:10.5px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:var(--ur-dim)}
    ${R} .dm-ur-x{width:40px;height:40px;border-radius:50%;border:1px solid var(--ur-border);background:var(--ur-card);color:var(--ur-dim);
      display:grid;place-items:center;cursor:pointer;padding:0}
    ${R} button:focus-visible,${R} .dm-ur-foglio:focus-visible{outline:3px solid var(--ur-accent);outline-offset:2px}
    ${R} .dm-ur-adesso{margin-top:16px;padding:16px 18px;border-radius:20px;
      background:color-mix(in srgb,var(--ur-tone) 10%,var(--ur-card));border:1px solid color-mix(in srgb,var(--ur-tone) 35%,transparent)}
    ${R} .dm-ur-adesso small{font-size:10.5px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:var(--ur-dim)}
    ${R} .dm-ur-grande{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-top:2px}
    ${R} .dm-ur-grande b{font-size:30px;font-weight:900;line-height:1.05;color:color-mix(in srgb,var(--ur-tone) 75%,var(--ur-text))}
    ${R} .dm-ur-grande span{font-size:30px;font-weight:900;line-height:1.05}
    ${R} .dm-ur-adesso p{margin:6px 0 0;font-size:13px;font-weight:700;color:var(--ur-dim)}
    ${R} .dm-ur-adesso p b{color:var(--ur-text)}
    ${R} .dm-ur-periodo{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:16px}
    ${R} .dm-ur-seg{display:inline-flex;padding:4px;border-radius:999px;background:var(--ur-card2);border:1px solid var(--ur-border)}
    ${R} .dm-ur-seg button{font:inherit;border:0;background:transparent;cursor:pointer;padding:8px 16px;border-radius:999px;
      font-size:11.5px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--ur-dim)}
    ${R} .dm-ur-seg button.on{background:var(--ur-accent);color:#fff;box-shadow:0 4px 14px color-mix(in srgb,var(--ur-accent) 40%,transparent)}
    ${R} .dm-ur-quando{font-size:11.5px;font-weight:700;color:var(--ur-dim)}
    ${R} .dm-ur-caselle{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:14px}
    ${R} .dm-ur-casella{padding:11px 12px;border-radius:16px;background:var(--ur-card2);border:1px solid var(--ur-border);min-width:0}
    ${R} .dm-ur-casella small{display:block;font-size:9.5px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:var(--ur-dim);
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    ${R} .dm-ur-casella b{display:block;font-family:Oswald,sans-serif;font-weight:700;font-size:24px;line-height:1.1;
      margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--ur-text)}
    ${R} .dm-ur-casella span{display:block;font-size:11px;font-weight:700;color:var(--ur-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    ${R} .dm-ur-titoletto{margin:18px 2px 8px;font-size:10.5px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:var(--ur-dim)}
    ${R} .dm-ur-grafico{padding:14px 14px 10px;border-radius:18px;background:var(--ur-card2);border:1px solid var(--ur-border)}
    ${R} .dm-ur-grafico svg{display:block;width:100%;height:auto;overflow:visible;font-family:inherit}
    ${R} .dm-ur-asse{font-size:10px;font-weight:700;fill:var(--ur-dim)}
    ${R} .dm-ur-tacca{stroke:var(--ur-mute);stroke-width:1}
    ${R} .dm-ur-mezzanotte{stroke:var(--ur-mute);stroke-width:1;stroke-dasharray:3 3}
    ${R} .dm-ur-oggi{font-size:9px;font-weight:900;letter-spacing:1px;fill:var(--ur-dim)}
    ${R} .dm-ur-picco{font-size:10px;font-weight:800;fill:var(--ur-text)}
    ${R} .dm-ur-quiete{font-size:9px;font-weight:800;fill:var(--ur-dim)}
    ${R} .dm-ur-chiusa{fill:var(--ur-closed-track)}
    ${R} .dm-ur-aperta{fill:var(--ur-open);stroke:var(--ur-card2);stroke-width:1}
    ${R} .dm-ur-quieto{fill:var(--ur-motion-soft)}
    ${R} .dm-ur-impulso{fill:var(--ur-motion)}
    ${R} .dm-ur-barra{fill:var(--ur-motion-bar)}
    ${R} .dm-ur-griglia{fill:var(--ur-grid)}
    ${R} .dm-ur-asse-linea{stroke:var(--ur-grid)}
    ${R} .dm-ur-sfondo{fill:var(--ur-card2)}
    ${R} .dm-ur-righina{stroke:var(--ur-unav);stroke-width:2}
    ${R} .dm-ur-legenda{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:12px;font-size:11.5px;font-weight:700;color:var(--ur-dim)}
    ${R} .dm-ur-legenda i{display:inline-block;vertical-align:-2px;margin-right:6px;border-radius:3px}
    ${R} .dm-ur-l-aperta{width:10px;height:14px;background:var(--ur-open)}
    ${R} .dm-ur-l-chiusa{width:18px;height:10px;background:var(--ur-closed-track)}
    ${R} .dm-ur-l-muto{width:18px;height:10px;border:1px solid var(--ur-unav);
      background:repeating-linear-gradient(45deg,var(--ur-unav) 0 2px,transparent 2px 5px)}
    ${R} .dm-ur-l-impulso{width:4px;height:14px;background:var(--ur-motion)}
    ${R} .dm-ur-l-quieto{width:18px;height:10px;background:var(--ur-motion-soft);border:1px solid var(--ur-border)}
    ${R} .dm-ur-l-barra{width:12px;height:12px;background:var(--ur-motion-bar)}
    ${R} .dm-ur-l-nessuna{width:16px;height:2px;background:var(--ur-grid);vertical-align:3px!important}
    ${R} .dm-ur-avviso{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:10px;min-height:86px;padding:12px;
      text-align:center;font-size:12.5px;font-weight:700;color:var(--ur-dim)}
    ${R} .dm-ur-avviso button{font:inherit;font-size:12px;font-weight:900;cursor:pointer;padding:8px 14px;border-radius:999px;
      border:1px solid var(--ur-border);background:var(--ur-card);color:var(--ur-text)}
    ${R} .dm-ur-giro{width:16px;height:16px;border-radius:50%;border:2px solid var(--ur-border);border-top-color:var(--ur-accent);
      animation:dmUrGiro .8s linear infinite}
    @keyframes dmUrGiro{to{transform:rotate(360deg)}}
    ${R} .dm-ur-eventi{list-style:none;margin:0;padding:0;display:grid;border-radius:18px;border:1px solid var(--ur-border);overflow:hidden;background:var(--ur-card)}
    ${R} .dm-ur-riga{display:grid;grid-template-columns:52px 12px minmax(0,1fr) auto;gap:10px;align-items:center;padding:11px 14px;
      border-top:1px solid var(--ur-border);background:var(--ur-card)}
    ${R} .dm-ur-riga:first-child{border-top:0}
    ${R} .dm-ur-ora{font-family:Oswald,sans-serif;font-weight:700;font-size:18px;letter-spacing:.02em}
    ${R} .dm-ur-punto{width:10px;height:10px;border-radius:50%;background:var(--ur-open)}
    ${R}[data-famiglia="movimento"] .dm-ur-punto{background:var(--ur-motion)}
    ${R} .dm-ur-riga div b{display:block;font-size:13.5px;font-weight:800;overflow-wrap:anywhere}
    ${R} .dm-ur-riga div span{display:block;font-size:11.5px;font-weight:700;color:var(--ur-dim)}
    ${R} .dm-ur-riga em{font-style:normal;font-size:11.5px;font-weight:800;color:var(--ur-dim);white-space:nowrap}
    ${R} .dm-ur-gruppo{padding:8px 14px;font-size:10px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:var(--ur-dim);
      background:var(--ur-card2);border-top:1px solid var(--ur-border)}
    ${R} .dm-ur-gruppo:first-child{border-top:0}
    ${R} .dm-ur-segnaposto{height:52px;border-top:1px solid var(--ur-border);
      background:linear-gradient(90deg,var(--ur-card) 0 64px,var(--ur-card2) 64px 46%,var(--ur-card) 46%)}
    ${R} .dm-ur-segnaposto:first-child{border-top:0}
    ${R} .dm-ur-altro{display:block;margin:8px auto 0;font:inherit;font-size:12.5px;font-weight:800;color:var(--ur-accent);
      background:none;border:0;cursor:pointer;padding:6px 10px;border-radius:999px}
    ${R} .dm-ur-tasti{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px}
    ${R} .dm-ur-tasti-uno{grid-template-columns:1fr}
    ${R} .dm-ur-tasto{font:inherit;cursor:pointer;padding:14px 10px;border-radius:999px;border:1px solid var(--ur-border);text-align:center;
      font-size:14px;font-weight:800;background:var(--ur-card);color:var(--ur-text)}
    ${R} .dm-ur-primo{background:var(--ur-accent);border-color:var(--ur-accent);color:#fff}
    ${R} .dm-ur-nota{margin:12px 0 0;text-align:center;font-size:11px;font-weight:700;color:var(--ur-mute)}
    @media (min-width:860px){
      ${R} .dm-ur-foglio{left:50%;right:auto;top:50%;bottom:auto;transform:translate(-50%,-50%);
        width:min(1000px,calc(100vw - 48px));max-height:calc(100dvh - 48px);border-radius:28px;
        padding:22px 26px 24px;box-shadow:0 30px 80px rgba(0,0,0,.35);animation:dmUrDentro .2s ease-out}
      ${R} .dm-ur-maniglia{display:none}
      ${R} .dm-ur-corpo{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:26px;align-items:start}
      ${R} .dm-ur-dx > .dm-ur-titoletto:first-child{margin-top:16px}
      ${R} .dm-ur-dx .dm-ur-riga{padding:9px 14px}
      @keyframes dmUrDentro{from{opacity:0;transform:translate(-50%,-48%)}to{opacity:1;transform:translate(-50%,-50%)}}
    }
    /* Le carte che lo aprono si dicono toccabili. */
    [${ATTRIBUTO}]{cursor:pointer}
    [${ATTRIBUTO}]:focus-visible{outline:3px solid #7c3aed;outline-offset:2px}
    `,
  );
}

export function installUltimeRilevazioni() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  doc.addEventListener("click", alClicSullaCarta);
  doc.addEventListener("keydown", alTastoSullaCarta);
  root.addEventListener?.("keydown", allaTastiera, true);
  quandoArrivaLoStorico((entity) => {
    if (state.aperto && entity === state.aperto.entity) ridisegna();
  });
  for (const evento of ["dashboardmodern:state-changed", "dashboardmodern:states-ready"])
    root.addEventListener?.(evento, () => {
      if (state.aperto) ridisegna();
    });
  root.apriUltimeRilevazioni = apriUltimeRilevazioni;
  return true;
}

senzaCadere(installUltimeRilevazioni);
