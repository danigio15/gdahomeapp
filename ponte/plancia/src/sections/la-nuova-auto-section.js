/* La nuova pagina Auto.
 *
 * «La sezione Auto continua a non piacermi la vuoi rivedere completamente.»
 * Dalle proposte e' stata scelta la divisione in tre linguette — Ricarica,
 * Viaggi, Stato auto — con sopra il garage, se le auto sono piu' d'una, e
 * l'auto in uso col suo logo, il modello e l'autonomia in grande.
 *
 * Approvata: e' la pagina Auto di tutti, e prende il posto del contenuto
 * classico sotto la testata. La pagina classica resta come riserva — la si
 * rivede solo scrivendo `cd_auto_nuova` = "0" nel deposito del browser — e
 * allora la carta della notte torna al suo posto. Il codice classico non se ne
 * va: lo usano ancora la scheda dell'auto nel config, le foto e il widget.
 *
 * Non rifa' niente che la plancia sappia gia' fare: i comandi sono quelli del
 * guscio (`setEVMode`, `setEVSempre`, `changeSelect`, `cdEvApplyCar`), la
 * lettura dell'auto e' `letturaTermica`, la carta della ricarica di notte e'
 * la stessa di prima spostata qui dentro. Nuovo e' solo lo storico, che si
 * chiede alle statistiche di Home Assistant (`core/la-nuova-auto.js`).
 */
import { carBrandVisual } from "../core/personalization-catalog.js";
import {
  comeStannoLeGomme,
  cosaFaLAuto,
  energiaDiOggi,
  istanteDetto,
  laSettimana,
  letturaTermica,
  linkDellaMappa,
  posizioneScritta,
  temperatureDellAuto,
} from "../core/auto-termica.js";
import { evccPresence } from "../core/ev-console.js";
import { CHIAVE_FASCE, normalizzaLeFasce, prezzoDellaFascia } from "../core/fasce-della-tariffa.js";
import {
  durataInParole,
  inKilowatt,
  quandoFinisce,
  tempoDellaRicarica,
} from "../core/il-tempo-della-ricarica.js";
import {
  finestraDelloStorico,
  giornoScritto,
  giorniDalleOre,
  kmAllaPercentuale,
  kmDeiGiorni,
  laPercentuale,
  leScorciatoie,
  lePercentualiBasse,
  meseAccanto,
  oreDiRicarica,
  percentualeConsentita,
  ricaricheDalleOre,
  totaliDelloStorico,
  unPasso,
} from "../core/la-nuova-auto.js";
import {
  iModiDiEvcc,
  iValoriDelSempre,
  ilModoAcceso,
  ilSempreEInVigore,
  ilValoreDelSempreAcceso,
} from "../core/le-modalita-di-evcc.js";
import { prezzoDellaNotte } from "../core/ricarica-di-notte.js";
import { codiceDellaRicarica, cavoDalloStato } from "../core/stato-della-ricarica.js";
import { capacitaDellaBatteria, siRicarica, vehiclePhoto } from "../core/vehicle-model.js";
import { activeVehicle, activeVehiclePhoto, profiles } from "./ev-section.js";
import { datiMarkup, laViaDellAuto, motoreInPagina } from "./auto-termica-section.js";
import { weeklySourcePlans } from "./energy-analysis-section.js";
import { renderRicaricaDiNotte } from "./ricarica-di-notte-section.js";
import {
  allStates,
  clean,
  doc,
  esc,
  formatNumber,
  installStyle,
  locale,
  planciaVisibile,
  quandoSiCambiaPagina,
  root,
  section,
  senzaCadere,
  t,
} from "./shared.js";

/** La riserva: con "0" si torna alla pagina classica. */
export const INTERRUTTORE_DI_PROVA = "cd_auto_nuova";
/** La linguetta aperta: una comodita' di chi guarda, per dispositivo. */
const CHIAVE_LINGUETTA = "dm_na_linguetta";

const KEY = "__DASHBOARDMODERN_LA_NUOVA_AUTO__";
const state = (root[KEY] ||= {
  installed: false,
  frame: 0,
  firma: "",
  /* Le ricariche a casa si aprono sull'ultima, poi la settimana. */
  vista: "ultima",
  mese: null,
  dal: "",
  al: "",
  viaggi: "7",
  tutte: false,
  storico: { chiave: "", stato: "vuoto", dati: null },
  km: { chiave: "", stato: "vuoto", dati: null },
  /* La percentuale scelta adesso: si mostra finche' l'entita' non la conferma. */
  voluta: null,
  volutaAlle: 0,
  altriAperti: false,
});

/* ── l'interruttore ──────────────────────────────────────────────────────── */

export function nuovaAutoAccesa() {
  try {
    return root.localStorage?.getItem?.(INTERRUTTORE_DI_PROVA) !== "0";
  } catch (_errore) {
    return true;
  }
}

function linguettaScelta() {
  try {
    return root.localStorage?.getItem?.(CHIAVE_LINGUETTA) || "";
  } catch (_errore) {
    return "";
  }
}

function scegliLinguetta(nome) {
  try {
    root.localStorage?.setItem?.(CHIAVE_LINGUETTA, nome);
  } catch (_errore) {}
}

/* ── leggere ─────────────────────────────────────────────────────────────── */

function risolvi(ref) {
  try {
    const id = clean(root.resolveEntity?.(ref));
    return id && id !== ref && !id.startsWith("dm.") ? id : "";
  } catch (_errore) {
    return "";
  }
}

/* Le caselle di un'auto: quella in uso passa dalla mappatura viva della
 * plancia, le altre dal loro profilo. */
function lettoreDi(car, inUso) {
  const ov = car?.ov || {};
  const stati = allStates();
  const entita = (ref) => clean(ov[ref]) || (inUso ? risolvi(ref) : "");
  const stato = (ref) => {
    const id = entita(ref);
    return id ? stati[id] || null : null;
  };
  const vivo = (ref) => {
    const s = stato(ref);
    const v = clean(s?.state);
    return s && !/^(unknown|unavailable|none|)$/i.test(v) ? s : null;
  };
  const numero = (ref) => {
    const n = Number(String(vivo(ref)?.state ?? "").replace(",", "."));
    return Number.isFinite(n) && vivo(ref) ? n : null;
  };
  return { entita, stato, vivo, numero, stati };
}

const PRIMA_CHE_C_E = (lettore, refs) => {
  for (const ref of refs) {
    const n = lettore.numero(ref);
    if (n !== null)
      return { ref, n, unita: clean(lettore.vivo(ref)?.attributes?.unit_of_measurement) };
  }
  return null;
};

/** Tutto quello che la pagina dice di un'auto, letto una volta. */
function letturaDellAuto(car, inUso) {
  const l = lettoreDi(car, inUso);
  /* Quella in uso ha il motore che dice la pagina: chi non ha profili lo
   * sceglie nella plancia. */
  const termica = inUso ? motoreInPagina() === "termica" : !siRicarica(car || {});
  const mappa = car?.ov || {};
  const resolve = inUso ? (ref) => risolvi(ref) || ref : null;
  const dati = letturaTermica(mappa, l.stati, resolve);
  const batteria = l.numero("dm.ev_batteria_auto");
  const autonomia = l.numero("dm.ev_autonomia");
  const potenzaLetta = PRIMA_CHE_C_E(l, [
    "dm.ev_potenza_wallbox",
    "dm.ev_charge_power",
    "dm.ev_potenza_ricarica",
  ]);
  const kw = potenzaLetta ? inKilowatt(potenzaLetta.n, potenzaLetta.unita) : null;
  const cavo = cavoDalloStato(clean(l.vivo("dm.ev_cavo_collegato")?.state));
  const codice = termica
    ? ""
    : codiceDellaRicarica({
        stato: clean(l.vivo("dm.ev_stato_ricarica")?.state),
        collegata: cavo,
        potenza: kw === null ? null : kw * 1000,
      });
  const target = l.numero("dm.ev_target_soc");
  const capacita = capacitaDellaBatteria(car || {}, l.stati) || null;
  const tempo = termica
    ? null
    : tempoDellaRicarica({
        codice,
        soc: batteria,
        target,
        kilowatt: kw,
        capacita: capacita || undefined,
        minutiDellAuto: l.numero("dm.ev_tempo_ricarica"),
      });
  return {
    car,
    inUso,
    termica,
    lettore: l,
    dati,
    batteria,
    carburante: dati.carburante ?? null,
    autonomia,
    kw,
    codice,
    target,
    tempo,
    sessione: l.numero("dm.ev_energia_sessione"),
    soleSessione: l.numero("dm.ev_percentuale_solare_sessione"),
  };
}

/* ── i prezzi ────────────────────────────────────────────────────────────── */

function prezzoUnico() {
  let costo = null;
  try {
    costo = root.cdCfg?.("cd_costo_kwh");
  } catch (_errore) {
    costo = null;
  }
  if (costo === undefined || costo === null || costo === "") {
    try {
      costo = root.localStorage?.getItem?.("cd_costo_kwh");
    } catch (_errore) {
      costo = null;
    }
  }
  return prezzoDellaNotte({ fasce: null, costo, stati: allStates() }).prezzo;
}

function fasceSalvate() {
  try {
    return normalizzaLeFasce(
      JSON.parse(root.localStorage?.getItem?.(CHIAVE_FASCE) || "null") || {},
    );
  } catch (_errore) {
    return normalizzaLeFasce({});
  }
}

/** Il prezzo di un'ora: la sua fascia, o la tariffa unica. */
function prezzoDellOra() {
  const fasce = fasceSalvate();
  const unico = prezzoUnico();
  return (istante) => prezzoDellaFascia(fasce, unico, new Date(istante)) ?? null;
}

/* ── le parole ───────────────────────────────────────────────────────────── */

const kwh = (n, cifre = 1) => (n === null || n === undefined ? "—" : formatNumber(n, cifre));
const euro = (n) => (n === null || n === undefined ? "—" : formatNumber(n, 2));
const intero = (n) =>
  n === null || n === undefined ? "—" : Math.round(n).toLocaleString(locale());
const percento = (quota) =>
  quota === null || quota === undefined ? "—" : String(Math.round(quota * 100));

function nomeDellAuto(car, indice) {
  return clean(car?.name) || clean(car?.model) || `${t("Auto", "Car")} ${indice + 1}`;
}

/* Il nome dell'auto, senza dire due volte la marca.
 *
 * «Esce due volte marchio auto leapmotor leapmotor»: la marca e' «Leapmotor» e
 * il modello scelto dall'elenco e' gia' «Leapmotor B10». Se il modello
 * comincia con la marca, il titolo e' il modello; e il nome dato all'auto va
 * sotto solo quando dice qualcosa in piu'. */
const stesso = (a, b) => clean(a).toLowerCase() === clean(b).toLowerCase();
function titoloDellAuto(car, indice) {
  const marca = clean(car?.brand);
  const modello = clean(car?.model);
  const nome = clean(car?.name);
  const giaConLaMarca = marca && modello.toLowerCase().startsWith(`${marca.toLowerCase()} `);
  const titolo =
    giaConLaMarca || stesso(marca, modello) ? modello : [marca, modello].filter(Boolean).join(" ");
  const sotto = titolo && nome && !stesso(nome, titolo) && !stesso(nome, modello) ? nome : "";
  return { titolo: titolo || nome || nomeDellAuto(car, indice), sotto };
}

function logoDellAuto(car, misura) {
  const marca = clean(car?.brand);
  if (marca) return carBrandVisual(marca, misura);
  try {
    return (
      root.cdIconMarkup?.(clean(car?.icon) || "mdi:car-electric", Math.round(misura * 0.8)) || "🚗"
    );
  } catch (_errore) {
    return "🚗";
  }
}

/** La pastiglia di quello che fa la ricarica: tono e parole. */
function statoDellaRicarica(lettura) {
  if (lettura.termica) return null;
  const c = lettura.codice;
  if (c === "C") {
    const kw = lettura.kw === null ? "" : ` · ${formatNumber(lettura.kw, 2)} kW`;
    return { tono: "carica", testo: `${t("In carica", "Charging")}${kw}` };
  }
  if (c === "B") return { tono: "collegata", testo: t("Collegata", "Plugged in") };
  if (c === "F") return { tono: "guasto", testo: t("Errore della wallbox", "Wallbox error") };
  if (c === "A") return { tono: "", testo: t("Non collegata", "Not plugged in") };
  return null;
}

/** Le pastiglie dell'eroe: marcia, portiere, freno, dove sta. */
function pastiglieDellAuto(lettura) {
  const d = lettura.dati;
  const fuori = [];
  const fa = cosaFaLAuto(d);
  if (fa === "marcia") fuori.push({ tono: "info", testo: `🚗 ${t("In marcia", "Driving")}` });
  else if (fa === "ferma") fuori.push({ tono: "", testo: `🅿️ ${t("Parcheggiata", "Parked")}` });
  if (d.portiere === "bloccate" || d.portiere === "chiuse")
    fuori.push({ tono: "ok", testo: `🔒 ${t("Chiusa", "Locked")}` });
  else if (d.portiere === "sbloccate")
    fuori.push({ tono: "attenzione", testo: `🔓 ${t("Aperta", "Unlocked")}` });
  else if (d.portiere === "aperte")
    fuori.push({ tono: "attenzione", testo: `🚪 ${t("Portiere aperte", "Doors open")}` });
  if (d.frenoStazionamento === true)
    fuori.push({ tono: "", testo: `✋ ${t("Freno tirato", "Handbrake on")}` });
  if (d.posizione || d.coordinate) {
    /* A casa resta «A casa»; fuori si dice dove, esatto: l'indirizzo o le
     * coordinate, e il tocco apre la mappa. */
    const via =
      d.posizione === "casa" ? "" : posizioneScritta(d.coordinate, laViaDellAuto(d.coordinate));
    const dove =
      d.posizione === "casa"
        ? t("A casa", "At home")
        : via || (d.posizione === "fuori" || !d.posizione ? t("Fuori casa", "Away") : d.posizione);
    fuori.push({
      tono: "",
      testo: `📍 ${dove}`,
      link: d.posizione === "casa" ? "" : linkDellaMappa(d.coordinate),
    });
  }
  return fuori;
}

const pastiglia = ({ tono, testo, link }) =>
  link
    ? `<a class="dm-na-pill dm-na-pill-mappa" data-tono="${esc(tono)}" href="${esc(link)}" target="_blank" rel="noopener noreferrer" title="© OpenStreetMap contributors">${esc(testo)}</a>`
    : `<span class="dm-na-pill" data-tono="${esc(tono)}">${esc(testo)}</span>`;

/* ── il disegno ──────────────────────────────────────────────────────────── */

function garage(auto, inUso) {
  if (auto.length < 2) return "";
  const voci = auto
    .map((car, i) => {
      const l = letturaDellAuto(car, i === inUso);
      const { titolo } = titoloDellAuto(car, i);
      const livello = l.termica ? l.carburante : l.batteria;
      const pezzi = [];
      if (livello !== null)
        pezzi.push(`${l.termica ? "⛽" : l.codice === "C" ? "⚡" : "🔋"} ${Math.round(livello)}%`);
      const stato = statoDellaRicarica(l);
      if (stato?.tono === "carica") pezzi.push(t("in carica", "charging"));
      else if (stato?.tono === "collegata") pezzi.push(t("collegata", "plugged in"));
      if (l.autonomia !== null) pezzi.push(`${intero(l.autonomia)} km`);
      const barra =
        livello === null ? "" : `<i style="width:${Math.max(0, Math.min(100, livello))}%"></i>`;
      return `<button type="button" class="dm-na-garage-auto" data-na-auto="${i}" aria-pressed="${i === inUso}"
        data-tipo="${l.termica ? "termica" : "elettrica"}">
        <span class="dm-na-logo">${logoDellAuto(car, 30)}</span>
        <span class="dm-na-garage-testo"><b>${esc(titolo)}</b><small>${esc(pezzi.join(" · "))}</small>
        <span class="dm-na-minibarra">${barra}</span></span></button>`;
    })
    .join("");
  return `<nav class="dm-na-garage" aria-label="${esc(t("Le auto di casa", "The household cars"))}">${voci}</nav>`;
}

/* La card in alto: la foto in copertina, pulita — «non sulla foto auto» — e
 * sotto la riga del marchio e del modello, poi in fila
 * quello che si guarda di un'auto — quanta strada fa, quanta carica ha, dove
 * arriva all'obiettivo — con le pastiglie di com'e' messa. */
function eroe(l, indice) {
  const car = l.car || {};
  const { titolo, sotto } = titoloDellAuto(car, indice);
  const capacita = capacitaDellaBatteria(car, l.lettore.stati);
  const sottotitolo = [sotto, capacita ? `${formatNumber(capacita, 0)} kWh` : ""]
    .filter(Boolean)
    .join(" · ");
  const livello = l.termica ? l.carburante : l.batteria;
  const stato = statoDellaRicarica(l);
  const foto = l.inUso
    ? activeVehiclePhoto()
    : vehiclePhoto(car, l.codice === "B" || l.codice === "C");
  const target = l.target;
  const kmTarget = l.termica ? null : kmAllaPercentuale(l.autonomia, l.batteria, target);
  const aggiornata = l.dati.ultimoAggiornamento;
  const quando = Number.isFinite(aggiornata) ? istanteDetto(aggiornata, { lingua: locale() }) : "";
  const pila = livello === null ? "" : Math.max(0, Math.min(100, livello));
  const dati = [
    `<div class="dm-na-dato dm-na-dato-km" data-dm-storico="${esc(l.lettore.entita("dm.ev_autonomia"))}">
      <span>${esc(t("Autonomia", "Range"))}</span>
      <div class="dm-na-autonomia"><b>${intero(l.autonomia)}</b><small>km</small></div></div>`,
    livello === null
      ? ""
      : `<div class="dm-na-dato" data-tipo="${l.termica ? "carburante" : "batteria"}">
      <span>${esc(l.termica ? t("Carburante", "Fuel") : t("Batteria", "Battery"))}</span>
      <div class="dm-na-livello"><b>${Math.round(livello)}<small>%</small></b>
        <span class="dm-na-pila"><i style="width:${pila}%"></i></span></div></div>`,
    kmTarget === null
      ? ""
      : `<div class="dm-na-dato">
      <span>${esc(t("Al", "At"))} ${Math.round(target)}%</span>
      <div class="dm-na-livello"><b>${intero(kmTarget)}<small>km</small></b></div></div>`,
  ].join("");
  return `<section class="dm-na-eroe dm-na-carta" data-stato="${esc(stato?.tono || "")}" data-tipo="${l.termica ? "termica" : "elettrica"}" data-foto="${foto ? "si" : "no"}">
    <div class="dm-na-copertina">
      ${foto ? `<img class="dm-na-sfondo" src="${esc(foto)}" alt="" aria-hidden="true" loading="lazy" decoding="async"><img class="dm-na-auto" src="${esc(foto)}" alt="" loading="lazy" decoding="async">` : `<span class="dm-na-foto-vuota">${logoDellAuto(car, 120)}</span>`}
      <div class="dm-na-copertina-sopra">
        ${stato ? `<span class="dm-na-stato" data-tono="${esc(stato.tono)}"><i></i>${esc(stato.testo)}</span>` : "<span></span>"}
        ${quando ? `<span class="dm-na-quando">🕒 ${esc(quando)}</span>` : ""}
      </div>
    </div>
    <div class="dm-na-eroe-lato">
    <div class="dm-na-eroe-nome"><span class="dm-na-logo dm-na-logo-grande">${logoDellAuto(car, 26)}</span>
      <span><b>${esc(titolo)}</b>${sottotitolo ? `<small>${esc(sottotitolo)}</small>` : ""}</span></div>
    <div class="dm-na-eroe-dati">${dati}</div>
    <div class="dm-na-pills dm-na-eroe-pills">${pastiglieDellAuto(l).map(pastiglia).join("")}</div>
    </div>
  </section>`;
}

function linguette(l, aperta) {
  const gomme = comeStannoLeGomme(l.dati);
  const attenzione = l.dati.attenzione || gomme.verdetto === "attento";
  const voci = [
    l.termica
      ? null
      : {
          id: "ricarica",
          icona: "⚡",
          nome: t("Ricarica", "Charging"),
          badge: l.codice === "C" ? t("in corso", "in progress") : "",
          tono: "carica",
        },
    { id: "viaggi", icona: "🛣️", nome: t("Viaggi", "Trips"), badge: "", tono: "" },
    {
      id: "stato",
      icona: "🚗",
      nome: t("Stato auto", "Car status"),
      badge: attenzione ? t("attenzione", "attention") : l.dati.qualcosa ? t("ok", "ok") : "",
      tono: attenzione ? "attenzione" : "ok",
    },
  ].filter(Boolean);
  return `<div class="dm-na-linguette" role="tablist">${voci
    .map(
      (
        v,
      ) => `<button type="button" role="tab" class="dm-na-linguetta" data-na-linguetta="${v.id}" aria-selected="${v.id === aperta}">
      <span aria-hidden="true">${v.icona}</span><span>${esc(v.nome)}</span>${
        v.badge ? `<em data-tono="${esc(v.tono)}">${esc(v.badge)}</em>` : ""
      }</button>`,
    )
    .join("")}</div>`;
}

/* ── Ricarica ── */

function cartaAdesso(l) {
  const info = laPercentuale(
    l.lettore.vivo("dm.ev_target_soc"),
    l.lettore.entita("dm.ev_target_soc"),
  );
  /* La percentuale appena scelta vale finche' l'entita' non risponde. */
  if (info && state.voluta !== null) {
    if (info.valore === state.voluta || Date.now() - state.volutaAlle > 15_000) state.voluta = null;
    else info.valore = state.voluta;
  }
  const obiettivo = info?.valore ?? l.target;
  const tempo = l.tempo;
  const inCarica = l.codice === "C";
  let pronta = "";
  let quando = "";
  if (tempo?.stato === "carica" && tempo.minuti) {
    const fine = quandoFinisce(tempo.minuti);
    pronta = fine?.ora || "";
    const giorno =
      fine?.giorno === "oggi"
        ? t("oggi", "today")
        : fine?.giorno === "domani"
          ? t("domani", "tomorrow")
          : "";
    quando = [giorno, `${t("tra", "in")} ${durataInParole(tempo.minuti)}`]
      .filter(Boolean)
      .join(" · ");
  } else if (tempo?.stato === "completa" || tempo?.stato === "raggiunto") {
    pronta = "✓";
    quando = t("Già carica", "Already charged");
  }
  const anello = inCarica && l.kw !== null ? l.kw : l.batteria;
  const quota = inCarica
    ? Math.min(1, (l.kw || 0) / 11)
    : Math.max(0, Math.min(1, (l.batteria || 0) / 100));
  const giro = 2 * Math.PI * 52;
  const kmObiettivo = kmAllaPercentuale(l.autonomia, l.batteria, obiettivo);
  const cursore = info
    ? `<div class="dm-na-obiettivo">
      <div class="dm-na-obiettivo-testa"><span>${esc(t("Carica fino a", "Charge up to"))}</span>
        <b><output data-na-pct>${Math.round(obiettivo ?? 0)}</output><small>%</small></b>
        <span class="dm-na-obiettivo-km" data-na-km>${kmObiettivo === null ? "" : `· ${intero(kmObiettivo)} km`}</span></div>
      <div class="dm-na-cursore" role="img" aria-label="${esc(`${t("Carica fino a", "Charge up to")} ${Math.round(obiettivo ?? info.max)}%`)}"
        style="--na-fino:${Math.max(0, Math.min(100, obiettivo ?? info.max))}%">
        <i class="dm-na-fino"></i>
      </div>
      <div class="dm-na-scala"><span>${info.min}%</span>${
        l.batteria === null
          ? ""
          : `<span class="dm-na-adesso">${Math.round(l.batteria)}% ${esc(t("adesso", "now"))}</span>`
      }<span>${info.max}%</span></div>
      ${
        info.scrivibile
          ? `<div class="dm-na-passi">${tendinaBassa(info, obiettivo)}<span class="dm-na-scorciatoie">${leScorciatoie(
              info,
            )
              .map(
                (n) =>
                  `<button type="button" data-na-pct-scelta="${n}" aria-pressed="${Math.round(obiettivo) === n}">${n}%</button>`,
              )
              .join("")}</span></div>`
          : `<p class="dm-na-nota">${esc(t("L'obiettivo si legge soltanto: l'entità non accetta comandi.", "The target is read-only: the entity accepts no commands."))}</p>`
      }
    </div>`
    : "";
  const prezzo = prezzoDellOra()(Date.now());
  const costoFinora =
    l.sessione !== null && prezzo !== null
      ? l.sessione * prezzo * (l.soleSessione === null ? 1 : 1 - l.soleSessione / 100)
      : null;
  const tessere = [
    l.sessione === null
      ? ""
      : tesseraStorica(
          l,
          "dm.ev_energia_sessione",
          t("Questa ricarica", "This session"),
          `${kwh(l.sessione)}<small>kWh</small>`,
        ),
    l.soleSessione === null
      ? ""
      : tesseraStorica(
          l,
          "dm.ev_percentuale_solare_sessione",
          t("Dal sole", "From the sun"),
          `${Math.round(l.soleSessione)}<small>%</small>`,
          "sole",
        ),
    costoFinora === null
      ? ""
      : `<div class="dm-na-tessera"><span>${esc(t("Costo finora", "Cost so far"))}</span><b>${euro(costoFinora)}<small>€</small></b></div>`,
  ].join("");
  return `<section class="dm-na-carta dm-na-adesso-carta">
    <h3 class="dm-na-titolo"><span>⚡</span>${esc(t("Adesso", "Now"))}</h3>
    <div class="dm-na-adesso">
      <div class="dm-na-anello" data-tono="${inCarica ? "carica" : ""}">
        <svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52"/><circle class="pieno" cx="60" cy="60" r="52"
          stroke-dasharray="${(giro * quota).toFixed(1)} ${giro.toFixed(1)}"/></svg>
        <div><b>${inCarica && l.kw !== null ? formatNumber(anello, 2) : anello === null ? "—" : Math.round(anello)}</b><small>${inCarica ? "kW" : "%"}</small></div>
      </div>
      <div class="dm-na-pronta">${
        pronta
          ? `<span>${esc(obiettivo !== null && obiettivo !== undefined ? `${t("Pronta al", "Ready at")} ${Math.round(obiettivo)}%` : t("Pronta", "Ready"))}</span><b>${esc(pronta)}</b><small>${esc(quando)}</small>`
          : `<span>${esc(t("Ricarica", "Charging"))}</span><b class="dm-na-pronta-ferma">${esc(statoDellaRicarica(l)?.testo || t("Ferma", "Idle"))}</b>`
      }</div>
    </div>
    ${cursore}
    ${tessere ? `<div class="dm-na-tessere">${tessere}</div>` : ""}
    ${wallbox(l)}
  </section>`;
}

/* I nomi scritti qui per esteso, e non presi da `iModiDiEvcc`: sono le stesse
 * parole dei tasti del guscio, e cosi' il catalogo delle lingue le vede. */
const NOMI_DEI_MODI = {
  off: () => t("Spento", "Off"),
  smart: () => t("Intelligente", "Smart"),
  pv: () => t("Intelligente", "Smart"),
  now: () => t("Fast", "Fast"),
  fast: () => t("Fast", "Fast"),
};
const NOMI_DEL_SEMPRE = {
  off: () => t("Mai", "Never"),
  on: () => t("Sempre", "Always"),
  once: () => t("Solo stavolta", "Just this time"),
};

const DESCRIZIONE_DEI_MODI = {
  off: () => t("Non carica", "Doesn't charge"),
  smart: () => t("Col sole e le fasce che costano meno", "With the sun and the cheapest hours"),
  pv: () => t("Col sole e le fasce che costano meno", "With the sun and the cheapest hours"),
  minpv: () => t("Il minimo, più il sole", "The minimum, plus the sun"),
  now: () => t("Al massimo, subito", "Full power, now"),
  fast: () => t("Al massimo, subito", "Full power, now"),
};

/* Un riquadro che, toccato, apre lo storico della sua entita'. */
function tesseraStorica(l, ref, nome, corpo, tono = "") {
  const entita = l.lettore.entita(ref);
  const apre = entita
    ? ` role="button" tabindex="0" data-dm-storico="${esc(entita)}" data-dm-nome="${esc(nome)}"`
    : "";
  return `<div class="dm-na-tessera"${tono ? ` data-tono="${tono}"` : ""}${apre}><span>${esc(nome)}</span><b>${corpo}</b></div>`;
}

/* Tensione e temperatura della wallbox, se il Config le ha: le stesse caselle
 * della sezione di prima (`dm.ev_tensione_wallbox`, `dm.ev_temperatura_wallbox`). */
function misureDellaWallbox(l) {
  const misura = (ref, nome, unitaDiSerie, cifre) => {
    const n = l.lettore.numero(ref);
    if (n === null) return "";
    const unita = clean(l.lettore.vivo(ref)?.attributes?.unit_of_measurement) || unitaDiSerie;
    return tesseraStorica(l, ref, nome, `${formatNumber(n, cifre)}<small>${esc(unita)}</small>`);
  };
  return [
    misura("dm.ev_tensione_wallbox", t("Tensione", "Voltage"), "V", 0),
    misura("dm.ev_temperatura_wallbox", t("Temperatura", "Temperature"), "°C", 1),
  ].join("");
}

function wallbox(l) {
  if (!l.inUso) return "";
  let resolve = (valore) => valore;
  if (typeof root.resolveEntity === "function") resolve = root.resolveEntity;
  const misure = misureDellaWallbox(l);
  const tessere = misure ? `<div class="dm-na-tessere">${misure}</div>` : "";
  if (!evccPresence(l.lettore.stati, resolve).mode) {
    return tessere
      ? `<div class="dm-na-wallbox"><h4 class="dm-na-sottotitolo">🔌 ${esc(t("Wallbox", "Wallbox"))}</h4>${tessere}</div>`
      : "";
  }
  const statoModo = l.lettore.vivo("dm.ev_modalita_ricarica_evcc");
  const modi = iModiDiEvcc(statoModo);
  const acceso = ilModoAcceso(statoModo, modi);
  const statoSempre = l.lettore.vivo("dm.ev_ricarica_sempre_evcc");
  const valori = iValoriDelSempre(statoSempre);
  const scelto = ilValoreDelSempreAcceso(statoSempre, valori);
  const vale = ilSempreEInVigore(acceso);
  const sempre = valori.length
    ? `<div class="dm-na-sempre" data-vigore="${vale}">
      <div><b>${esc(t("Tieni sempre un minimo", "Always keep a minimum"))}</b><small>${esc(
        vale
          ? t("anche senza sole", "even without sun")
          : t("vale solo in Intelligente", "only applies in Smart"),
      )}</small></div>
      <div class="dm-na-segmenti">${valori
        .map(
          (v) =>
            `<button type="button" data-na-sempre="${esc(v.id)}" aria-pressed="${v.id === scelto}">${esc(NOMI_DEL_SEMPRE[v.id.toLowerCase()]?.() || v.id)}</button>`,
        )
        .join("")}</div></div>`
    : "";
  return `<div class="dm-na-wallbox">
    <h4 class="dm-na-sottotitolo">🔌 ${esc(t("Wallbox · evcc", "Wallbox · evcc"))}</h4>
    <div class="dm-na-modi">${modi
      .map((m) => {
        const descrizione = DESCRIZIONE_DEI_MODI[m.id.toLowerCase()]?.() || "";
        return `<button type="button" class="dm-na-modo" data-na-modo="${esc(m.id)}" aria-pressed="${m.id === acceso}" style="--na-modo:${esc(m.colore)}">
          <b><span aria-hidden="true">${esc(m.icona)}</span> ${esc(NOMI_DEI_MODI[m.id.toLowerCase()]?.() || m.it)}</b>${descrizione ? `<small>${esc(descrizione)}</small>` : ""}</button>`;
      })
      .join("")}</div>
    ${sempre}
    ${tessere}
  </div>`;
}

const nomiDeiMesi = (anno, mese) =>
  new Date(anno, mese, 1).toLocaleDateString(locale(), { month: "long", year: "numeric" });

function selettoreDelPeriodo(vista, { mese, dal, al }, gruppo) {
  const viste = [
    ...(gruppo === "storico" ? [["ultima", t("Ultima", "Last")]] : []),
    ["7", t("7 giorni", "7 days")],
    ["mese", t("Mese", "Month")],
    ...(gruppo === "storico" ? [["periodo", t("Periodo", "Period")]] : []),
  ];
  const oggi = new Date();
  const m = mese || { anno: oggi.getFullYear(), mese: oggi.getMonth() };
  const ultimo = m.anno === oggi.getFullYear() && m.mese === oggi.getMonth();
  const naviga =
    vista === "mese"
      ? `<div class="dm-na-mese"><button type="button" data-na-mese="-1" data-na-gruppo="${gruppo}" aria-label="${esc(t("Mese prima", "Previous month"))}">‹</button>
      <b>${esc(nomiDeiMesi(m.anno, m.mese))}</b>
      <button type="button" data-na-mese="1" data-na-gruppo="${gruppo}" ${ultimo ? "disabled" : ""} aria-label="${esc(t("Mese dopo", "Next month"))}">›</button></div>`
      : vista === "periodo"
        ? `<div class="dm-na-date"><label>${esc(t("Dal", "From"))}<input type="date" data-na-dal value="${esc(dal)}" max="${giornoScritto(Date.now())}"></label>
        <label>${esc(t("Al", "To"))}<input type="date" data-na-al value="${esc(al)}" max="${giornoScritto(Date.now())}"></label></div>`
        : "";
  return `<div class="dm-na-periodo"><div class="dm-na-segmenti">${viste
    .map(
      ([id, nome]) =>
        `<button type="button" data-na-vista="${id}" data-na-gruppo="${gruppo}" aria-pressed="${id === vista}">${esc(nome)}</button>`,
    )
    .join("")}</div>${naviga}</div>`;
}

function etichettaDelGiorno(giorno, vista) {
  const d = new Date(giorno);
  if (vista === "7") return d.toLocaleDateString(locale(), { weekday: "short" }).replace(".", "");
  return String(d.getDate());
}

function grafico(giorni, vista, valore, { pila = null, unita = "kWh" } = {}) {
  const massimo = Math.max(0.0001, ...giorni.map(valore));
  const oggi = new Date().setHours(0, 0, 0, 0);
  const fitta = giorni.length > 16;
  return `<div class="dm-na-grafico" data-fitta="${fitta}">${giorni
    .map((g, i) => {
      const v = valore(g);
      const altezza = v > 0 ? Math.max(3, (v / massimo) * 100) : 0;
      const sole = pila ? pila(g) : null;
      const quotaSole = sole !== null && v > 0 ? Math.max(0, Math.min(1, sole / v)) : null;
      const futuro = g.giorno > oggi;
      const etichetta =
        !fitta || i % 2 === 0 || i === giorni.length - 1 ? etichettaDelGiorno(g.giorno, vista) : "";
      const titolo = `${new Date(g.giorno).toLocaleDateString(locale(), { weekday: "short", day: "numeric", month: "short" })}: ${formatNumber(v, 1)} ${unita}`;
      return `<div class="dm-na-colonna" data-futuro="${futuro}" title="${esc(titolo)}">
        <div class="dm-na-barra" style="height:${altezza.toFixed(1)}%">${
          quotaSole === null
            ? "<i></i>"
            : `<i class="rete" style="flex:${(1 - quotaSole).toFixed(3)}"></i><i class="sole" style="flex:${quotaSole.toFixed(3)}"></i>`
        }</div><small>${esc(etichetta)}</small></div>`;
    })
    .join("")}</div>`;
}

function rigaDellaRicarica(r) {
  const d = new Date(r.inizio);
  const ora = (x) =>
    new Date(x).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit", hour12: false });
  const sole = r.quotaSole;
  return `<div class="dm-na-ricarica">
    <div class="dm-na-ricarica-giorno"><b>${d.getDate()}</b><small>${esc(d.toLocaleDateString(locale(), { weekday: "short" }).replace(".", ""))}</small></div>
    <div class="dm-na-ricarica-corpo">
      <div><b>${kwh(r.kwh)} kWh</b> <span>· ${esc(ora(r.inizio))}–${esc(ora(r.fine))}</span></div>
      <span class="dm-na-quota">${sole === null ? "<i class='rete' style='flex:1'></i>" : `<i class="sole" style="flex:${sole.toFixed(3)}"></i><i class="rete" style="flex:${(1 - sole).toFixed(3)}"></i>`}</span>
    </div>
    <div class="dm-na-ricarica-costo"><b>${r.costo === null ? "—" : `${euro(r.costo)} €`}</b>${
      sole === null
        ? ""
        : `<small>${sole >= 0.995 ? esc(t("tutto sole", "all solar")) : `${percento(sole)}% ${esc(t("sole", "solar"))}`}</small>`
    }</div>
  </div>`;
}

function cartaStorico(l) {
  const finestra = finestraDelloStorico(state.vista, {
    mese: state.mese,
    dal: state.dal,
    al: state.al,
  });
  const s = state.storico;
  let corpo = "";
  if (!l.lettore.entita("dm.ev_energia_wallbox_oggi"))
    corpo = `<p class="dm-na-vuoto">${esc(
      t(
        "Per lo storico serve l'energia della wallbox: si sceglie nella scheda Auto del config.",
        "History needs the wallbox energy: choose it in the Car tab of the config.",
      ),
    )}</p>`;
  else if (s.stato === "carico" || s.stato === "vuoto")
    corpo = `<p class="dm-na-vuoto">${esc(t("Leggo lo storico di Home Assistant…", "Reading Home Assistant history…"))}</p>`;
  else if (s.stato === "errore")
    corpo = `<p class="dm-na-vuoto">${esc(t("Lo storico non ha risposto: riprovo fra poco.", "History didn't answer: retrying shortly."))}</p>`;
  else if (state.vista === "ultima") corpo = laUltima(s.dati);
  else {
    const { giorni, ricariche, totali, conRete } = s.dati;
    const pieni = state.vista === "mese" ? riempiIlMese(giorni, finestra) : giorni;
    const mostrate = state.tutte ? ricariche : ricariche.slice(0, 4);
    corpo = `<div class="dm-na-totali">
        <div class="dm-na-tessera"><span>${esc(t("Energia", "Energy"))}</span><b>${kwh(totali.kwh, totali.kwh >= 100 ? 0 : 1)}<small>kWh</small></b></div>
        <div class="dm-na-tessera" data-tono="sole"><span>${esc(t("Dal sole", "From the sun"))}</span><b>${percento(totali.quotaSole)}<small>%</small></b></div>
        <div class="dm-na-tessera"><span>${esc(t("Spesa", "Spent"))}</span><b>${euro(totali.costo)}<small>€</small></b></div>
        <div class="dm-na-tessera"><span>${esc(t("Ricariche", "Sessions"))}</span><b>${totali.ricariche}${
          totali.alKwh === null ? "" : `<small>· ${euro(totali.alKwh)} €/kWh</small>`
        }</b></div>
      </div>
      ${grafico(pieni, state.vista, (g) => g.kwh, { pila: conRete ? (g) => g.sole ?? 0 : null })}
      ${conRete ? `<div class="dm-na-legenda"><span><i class="sole"></i>${esc(t("dal sole", "from the sun"))}</span><span><i class="rete"></i>${esc(t("dalla rete", "from the grid"))}</span></div>` : ""}
      ${
        ricariche.length
          ? `<div class="dm-na-ricariche">${mostrate.map(rigaDellaRicarica).join("")}</div>${
              ricariche.length > 4
                ? `<button type="button" class="dm-na-tutte" data-na-tutte>${esc(
                    state.tutte
                      ? t("Mostra meno", "Show less")
                      : `${t("Vedi tutte le ricariche", "See all sessions")} (${ricariche.length})`,
                  )}</button>`
                : ""
            }`
          : `<p class="dm-na-vuoto">${esc(t("Nessuna ricarica in questo periodo.", "No charging in this period."))}</p>`
      }
      ${finestra.tagliato ? `<p class="dm-na-nota">${esc(t("Il periodo è tagliato a 62 giorni.", "The period is cut to 62 days."))}</p>` : ""}`;
  }
  return `<section class="dm-na-carta dm-na-storico">
    <div class="dm-na-storico-testa"><h3 class="dm-na-titolo"><span>🏠</span>${esc(t("Ricariche a casa", "Charging at home"))}</h3>
      ${selettoreDelPeriodo(state.vista, state, "storico")}</div>
    ${corpo}
  </section>`;
}

/* L'ultima ricarica: i suoi quattro numeri, e ora per ora quanto e' entrato
 * nell'auto, dal sole e dalla rete. Si cerca negli ultimi trenta giorni. */
function laUltima({ ricariche = [], ore = [], conRete } = {}) {
  const r = ricariche[0];
  if (!r)
    return `<p class="dm-na-vuoto">${esc(
      t("Nessuna ricarica negli ultimi 30 giorni.", "No charging in the last 30 days."),
    )}</p>`;
  /* Le ore della ricarica con un'ora vuota prima e dopo, e almeno otto
   * colonne: una ricarica di un'ora non resta una barra sola in mezzo al nulla. */
  const ORA = 3600000;
  const perOra = new Map(ore.map((o) => [o.inizio, o]));
  const colonneMinime = 8;
  const quante = Math.max(colonneMinime, Math.round((r.fine - r.inizio) / ORA) + 2);
  const prima = r.inizio - ORA * Math.max(1, Math.floor((quante - Math.round((r.fine - r.inizio) / ORA)) / 2));
  const sue = Array.from({ length: quante }, (_, i) => {
    const inizio = prima + i * ORA;
    return perOra.get(inizio) || { inizio, kwh: 0, sole: null };
  });
  const ora = (x) =>
    new Date(x).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit", hour12: false });
  const giorno = new Date(r.inizio).toLocaleDateString(locale(), {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const durata = Math.max(1, Math.round((r.fine - r.inizio) / 3600000));
  const massimo = Math.max(0.0001, ...sue.map((o) => o.kwh || 0));
  const colonne = sue
    .map((o) => {
      const v = o.kwh || 0;
      const quota = o.sole !== null && v > 0 ? Math.max(0, Math.min(1, o.sole / v)) : null;
      const titolo = `${ora(o.inizio)}: ${formatNumber(v, 1)} kWh`;
      return `<div class="dm-na-colonna" data-futuro="false" title="${esc(titolo)}">
        <div class="dm-na-barra" style="height:${(v > 0 ? Math.max(3, (v / massimo) * 100) : 0).toFixed(1)}%">${
          quota === null
            ? "<i></i>"
            : `<i class="rete" style="flex:${(1 - quota).toFixed(3)}"></i><i class="sole" style="flex:${quota.toFixed(3)}"></i>`
        }</div><small>${esc(ora(o.inizio).slice(0, 2))}</small></div>`;
    })
    .join("");
  const alKwh = r.costo === null || r.kwh <= 0 ? null : r.costo / r.kwh;
  return `<p class="dm-na-ultima-quando"><b>${esc(giorno.charAt(0).toLocaleUpperCase(locale()) + giorno.slice(1))}</b> · ${esc(
    ora(r.inizio),
  )}–${esc(ora(r.fine))}</p>
    <div class="dm-na-totali">
      <div class="dm-na-tessera"><span>${esc(t("Energia", "Energy"))}</span><b>${kwh(r.kwh, 1)}<small>kWh</small></b></div>
      <div class="dm-na-tessera" data-tono="sole"><span>${esc(t("Dal sole", "From the sun"))}</span><b>${r.quotaSole === null ? "—" : `${percento(r.quotaSole)}<small>%</small>`}</b></div>
      <div class="dm-na-tessera"><span>${esc(t("Spesa", "Spent"))}</span><b>${r.costo === null ? "—" : `${euro(r.costo)}<small>€</small>`}</b></div>
      <div class="dm-na-tessera"><span>${esc(t("Durata", "Duration"))}</span><b>${durata}<small>h${
        alKwh === null ? "" : ` · ${euro(alKwh)} €/kWh`
      }</small></b></div>
    </div>
    ${sue.length ? `<div class="dm-na-grafico" data-fitta="${sue.length > 16}">${colonne}</div>` : ""}
    ${conRete ? `<div class="dm-na-legenda"><span><i class="sole"></i>${esc(t("dal sole", "from the sun"))}</span><span><i class="rete"></i>${esc(t("dalla rete", "from the grid"))}</span></div>` : ""}`;
}

/* Il mese intero: i giorni che devono ancora venire tengono il loro posto. */
function riempiIlMese(giorni, finestra) {
  const fuori = [...giorni];
  const d = new Date(finestra.inizio);
  d.setDate(d.getDate() + fuori.length);
  while (fuori.length < finestra.giorni) {
    fuori.push({ giorno: d.getTime(), kwh: 0, sole: null });
    d.setDate(d.getDate() + 1);
  }
  return fuori;
}

function cartaNotte() {
  /* La carta della ricarica di notte e' quella di sempre: qui le si tiene
   * soltanto il posto, e il giro la sposta dentro. */
  return `<div class="dm-na-notte" data-na-posto="notte"></div>`;
}

function pannelloRicarica(l) {
  return `<div class="dm-na-griglia">${cartaAdesso(l)}${l.inUso ? cartaNotte() : ""}</div>${cartaStorico(l)}`;
}

/* ── Viaggi ── */

function pannelloViaggi(l) {
  const settimana = laSettimana(l.dati);
  const oggi = energiaDiOggi(l.dati);
  const s = state.km;
  const finestra = finestraDelloStorico(state.viaggi, { mese: state.meseViaggi });
  let grafo = "";
  if (!l.lettore.entita("dm.ev_odometro"))
    grafo = `<p class="dm-na-vuoto">${esc(t("Per i km di ogni giorno serve il contachilometri.", "Daily km need the odometer."))}</p>`;
  else if (s.stato === "pronto") {
    const giorni = state.viaggi === "mese" ? riempiIlMese(s.dati.giorni, finestra) : s.dati.giorni;
    const totale = s.dati.giorni.reduce((a, g) => a + g.km, 0);
    const conViaggi = s.dati.giorni.filter((g) => g.km > 0.5).length;
    grafo = `<div class="dm-na-totali dm-na-totali-tre">
        <div class="dm-na-tessera"><span>${esc(t("Percorsi", "Driven"))}</span><b>${intero(totale)}<small>km</small></b></div>
        <div class="dm-na-tessera"><span>${esc(t("Giorni in auto", "Driving days"))}</span><b>${conViaggi}</b></div>
        <div class="dm-na-tessera"><span>${esc(t("Media al giorno", "Daily average"))}</span><b>${intero(conViaggi ? totale / conViaggi : 0)}<small>km</small></b></div>
      </div>${grafico(giorni, state.viaggi, (g) => g.km, { unita: "km" })}`;
  } else if (s.stato === "errore")
    grafo = `<p class="dm-na-vuoto">${esc(t("Lo storico non ha risposto: riprovo fra poco.", "History didn't answer: retrying shortly."))}</p>`;
  else
    grafo = `<p class="dm-na-vuoto">${esc(t("Leggo lo storico di Home Assistant…", "Reading Home Assistant history…"))}</p>`;
  const consumo = settimana
    ? `<section class="dm-na-carta">
      <h3 class="dm-na-titolo"><span>📊</span>${esc(t("Ultimi 7 giorni", "Last 7 days"))}</h3>
      <div class="dm-na-totali dm-na-totali-tre">
        <div class="dm-na-tessera"><span>${esc(t("Percorsi", "Driven"))}</span><b>${intero(settimana.km)}<small>km</small></b></div>
        <div class="dm-na-tessera"><span>${esc(t("Energia", "Energy"))}</span><b>${kwh(settimana.kwh)}<small>kWh</small></b></div>
        <div class="dm-na-tessera"><span>${esc(t("Consumo", "Consumption"))}</span><b>${kwh(settimana.consumo)}<small>kWh/100 km</small></b></div>
      </div></section>`
    : "";
  const energia = oggi
    ? `<section class="dm-na-carta">
      <h3 class="dm-na-titolo"><span>🔋</span>${esc(t("Energia di oggi", "Energy today"))}<em>${kwh(oggi.totale)} kWh</em></h3>
      <div class="dm-na-parti">${oggi.parti.map((p) => `<i data-parte="${esc(p.parte)}" style="flex:${Math.max(0.02, p.quota).toFixed(3)}"></i>`).join("")}</div>
      <div class="dm-na-parti-voci">${oggi.parti
        .map((p) => {
          const nome =
            p.parte === "guida"
              ? t("Guida", "Driving")
              : p.parte === "clima"
                ? t("Clima", "Climate")
                : t("Resto", "Other");
          return `<span data-parte="${esc(p.parte)}"><i></i>${esc(nome)} <b>${kwh(p.kwh)} kWh</b></span>`;
        })
        .join("")}</div></section>`
    : "";
  const ultimo = l.dati.ultimoViaggio;
  return `<section class="dm-na-carta dm-na-storico">
      <div class="dm-na-storico-testa"><h3 class="dm-na-titolo"><span>🛣️</span>${esc(t("Km percorsi", "Km driven"))}</h3>
        ${selettoreDelPeriodo(state.viaggi, { mese: state.meseViaggi }, "viaggi")}</div>
      ${grafo}
      ${typeof ultimo === "number" ? `<p class="dm-na-nota">${esc(t("Ultimo viaggio", "Last trip"))}: <b>${kwh(ultimo)} km</b></p>` : ""}
    </section>
    <div class="dm-na-griglia">${consumo}${energia}</div>`;
}

/* ── Stato auto ── */

const NOMI_DELLE_RUOTE = {
  antSx: () => t("Ant. sx", "Front L"),
  antDx: () => t("Ant. dx", "Front R"),
  postSx: () => t("Post. sx", "Rear L"),
  postDx: () => t("Post. dx", "Rear R"),
};

function pannelloStato(l) {
  const d = l.dati;
  const gomme = comeStannoLeGomme(d);
  const ruote = gomme.ruote
    .map(
      (
        r,
      ) => `<div class="dm-na-ruota" data-tono="${esc(r.tono)}"><span>${esc(NOMI_DELLE_RUOTE[r.ruota]?.() || r.ruota)}</span>
      <b>${r.bar === null ? (r.avviso ? "!" : "✓") : formatNumber(r.bar, 1)}${r.bar === null ? "" : "<small>bar</small>"}</b></div>`,
    )
    .join("");
  const cartaGomme = gomme.verdetto
    ? `<section class="dm-na-carta">
      <h3 class="dm-na-titolo"><span>🛞</span>${esc(t("Pneumatici", "Tyres"))}<em data-tono="${gomme.verdetto === "bene" ? "ok" : "attenzione"}">${esc(
        gomme.verdetto === "bene" ? t("a posto", "fine") : t("da controllare", "check them"),
      )}</em></h3>
      ${ruote ? `<div class="dm-na-ruote">${ruote}</div>` : ""}</section>`
    : "";
  const aperture = [
    ["portiere", "🚪", t("Portiere", "Doors")],
    ["finestrini", "🪟", t("Finestrini", "Windows")],
    ["bagagliaio", "🧳", t("Bagagliaio", "Boot")],
    ["cofano", "🔧", t("Cofano", "Bonnet")],
    ["allarme", "🚨", t("Allarme", "Alarm")],
    ["motore", "🔑", t("Motore", "Engine")],
  ]
    .filter(([campo]) => d[campo] !== undefined && d[campo] !== null)
    .map(([campo, icona, nome]) => {
      const v = d[campo];
      const parola =
        v === true
          ? t("acceso", "on")
          : v === false
            ? t("spento", "off")
            : v === "bloccate"
              ? t("bloccate", "locked")
              : v === "sbloccate"
                ? t("sbloccate", "unlocked")
                : v === "aperte" || v === "aperto"
                  ? t("aperto", "open")
                  : v === "chiuse" || v === "chiuso"
                    ? t("chiuso", "closed")
                    : String(v);
      const male = v === "aperte" || v === "aperto" || v === "sbloccate" || v === "scattato";
      return `<div class="dm-na-voce" data-tono="${male ? "attenzione" : "ok"}"><span>${icona}</span><b>${esc(nome)}</b><em>${esc(parola)}</em></div>`;
    })
    .join("");
  const temperature = temperatureDellAuto(d)
    .map((v) => {
      const nome =
        {
          batteria: t("Batteria", "Battery"),
          abitacolo: t("Abitacolo", "Cabin"),
          esterna: t("Fuori", "Outside"),
          olio: t("Olio", "Oil"),
        }[v.chi] || v.chi;
      return `<div class="dm-na-tessera"><span>${esc(nome)}</span><b>${Math.round(v.gradi)}<small>°</small></b></div>`;
    })
    .join("");
  const altri = [
    d.odometro !== null && d.odometro !== undefined
      ? [t("Contachilometri", "Odometer"), `${intero(d.odometro)} km`]
      : null,
    typeof d.batteriaServizio === "number"
      ? [
          t("Batteria 12 V", "12 V battery"),
          `${formatNumber(d.batteriaServizio, 1)} ${d.batteriaServizioUnita}`,
        ]
      : null,
    Number.isFinite(d.ultimoAggiornamento)
      ? [t("Aggiornata", "Updated"), istanteDetto(d.ultimoAggiornamento, { lingua: locale() })]
      : null,
  ]
    .filter(Boolean)
    .map(
      ([nome, valore]) =>
        `<div class="dm-na-riga"><span>${esc(nome)}</span><b>${esc(valore)}</b></div>`,
    )
    .join("");
  /* Quello che la pagina classica diceva in piu' — l'auto che dorme, il clima
   * acceso, la ricarica programmata, e in fondo tutti gli altri dati mappati —
   * si legge con le sue stesse parole: nessun dato configurato si perde. */
  const extra = datiMarkup(d, {
    tipo: l.termica ? "termica" : "",
    aperti: state.altriAperti === true,
  });
  const accesi = extra.pillole.length
    ? `<section class="dm-na-carta dm-na-extra"><h3 class="dm-na-titolo"><span>🔔</span>${esc(t("In questo momento", "Right now"))}</h3><div class="dm-na-pills">${extra.pillole.join("")}</div></section>`
    : "";
  const vuoto = !cartaGomme && !aperture && !temperature && !altri && !accesi && !extra.altri;
  if (vuoto)
    return `<section class="dm-na-carta"><p class="dm-na-vuoto">${esc(
      t(
        "Nessun dato dell'auto: le caselle si scelgono nella scheda Auto del config.",
        "No car data: choose the fields in the Car tab of the config.",
      ),
    )}</p></section>`;
  return `<div class="dm-na-griglia dm-na-griglia-stato">
    ${cartaGomme}
    ${aperture ? `<section class="dm-na-carta"><h3 class="dm-na-titolo"><span>🔐</span>${esc(t("Aperture", "Openings"))}</h3><div class="dm-na-voci">${aperture}</div></section>` : ""}
    ${temperature ? `<section class="dm-na-carta"><h3 class="dm-na-titolo"><span>🌡️</span>${esc(t("Temperature", "Temperatures"))}</h3><div class="dm-na-totali dm-na-totali-due">${temperature}</div></section>` : ""}
    ${altri ? `<section class="dm-na-carta"><h3 class="dm-na-titolo"><span>🧾</span>${esc(t("L'auto", "The car"))}</h3>${altri}</section>` : ""}
    ${accesi}
  </div>${extra.altri ? `<div class="dm-na-extra">${extra.altri}</div>` : ""}`;
}

/* ── lo storico, chiesto a Home Assistant ───────────────────────────────── */

const RIPROVA_MS = 30_000;
const FRESCO_MS = 5 * 60_000;

async function chiediLeStatistiche(ids, inizio, fine) {
  const servizio = root.DashboardModernEnergyService;
  if (!servizio?.statisticsWithGrowth) throw new Error("statistics");
  return servizio.statisticsWithGrowth(ids, new Date(inizio), new Date(fine), "hour");
}

/* I contatori della casa da cui si capisce il sole: gli stessi che legge
 * l'Energia per le settimane — prima il contatore totale, poi quello del
 * periodo se e' cumulativo. Chi ha configurato solo il totale della rete non
 * ha il «prelevata oggi», e il sole dell'auto restava vuoto. */
function fontiDellaCasa() {
  let piani = [];
  try {
    const energia = section("energy", {});
    piani = weeklySourcePlans(
      energia && typeof energia === "object" ? energia : {},
      allStates(),
      root.resolveEntity || ((v) => v),
    );
  } catch (_errore) {
    piani = [];
  }
  const di = (chiave) => piani.find((p) => p.key === chiave)?.entity || "";
  return {
    rete: di("gridImport") || risolvi("dm.energy_energia_prelevata_oggi"),
    sole: di("solar") || risolvi("dm.energy_produzione_solare_oggi"),
    casa: di("house") || risolvi("dm.energy_consumo_casa_oggi"),
  };
}

function caricaLoStorico(l) {
  const ev = l.lettore.entita("dm.ev_energia_wallbox_oggi");
  if (!ev) return;
  const fonti = fontiDellaCasa();
  const finestra = finestraDelloStorico(state.vista, {
    mese: state.mese,
    dal: state.dal,
    al: state.al,
  });
  const chiave = `${ev}|${fonti.rete}|${fonti.sole}|${fonti.casa}|${finestra.inizio}|${finestra.fine}`;
  const s = state.storico;
  if (
    s.chiave === chiave &&
    (s.stato === "carico" ||
      Date.now() - (s.alle || 0) < (s.stato === "errore" ? RIPROVA_MS : FRESCO_MS))
  )
    return;
  const prima = s.chiave === chiave && s.stato === "pronto";
  state.storico = { ...s, chiave, stato: prima ? "pronto" : "carico", alle: Date.now() };
  const ids = [
    ...new Set(["dm.ev_energia_wallbox_oggi", fonti.rete, fonti.sole, fonti.casa].filter(Boolean)),
  ];
  chiediLeStatistiche(ids, finestra.inizio, finestra.fine)
    .then((righe) => {
      if (state.storico.chiave !== chiave) return;
      const di = (id) => (id ? righe[id] || [] : []);
      const ore = oreDiRicarica(di("dm.ev_energia_wallbox_oggi"), di(fonti.rete), prezzoDellOra(), {
        sole: di(fonti.sole),
        casa: di(fonti.casa),
      });
      const conRete = ore.some((ora) => ora.sole !== null);
      const giorni = giorniDalleOre(ore, finestra.inizio, finestra.fine);
      const ricariche = ricaricheDalleOre(ore);
      state.storico = {
        chiave,
        stato: "pronto",
        alle: Date.now(),
        dati: { giorni, ricariche, ore, totali: totaliDelloStorico(giorni, ricariche), conRete },
      };
      ridisegna();
    })
    .catch(() => {
      if (state.storico.chiave !== chiave) return;
      state.storico = {
        chiave,
        stato: prima ? "pronto" : "errore",
        alle: Date.now(),
        dati: state.storico.dati,
      };
      ridisegna();
    });
}

function caricaIKm(l) {
  const odo = l.lettore.entita("dm.ev_odometro");
  if (!odo) return;
  const finestra = finestraDelloStorico(state.viaggi, { mese: state.meseViaggi });
  const chiave = `${odo}|${finestra.inizio}|${finestra.fine}`;
  const s = state.km;
  if (
    s.chiave === chiave &&
    (s.stato === "carico" ||
      Date.now() - (s.alle || 0) < (s.stato === "errore" ? RIPROVA_MS : FRESCO_MS))
  )
    return;
  const prima = s.chiave === chiave && s.stato === "pronto";
  state.km = { ...s, chiave, stato: prima ? "pronto" : "carico", alle: Date.now() };
  const servizio = root.DashboardModernEnergyService;
  Promise.resolve()
    .then(() =>
      servizio.statisticsWithGrowth(
        ["dm.ev_odometro"],
        new Date(finestra.inizio),
        new Date(finestra.fine),
        "day",
      ),
    )
    .then((righe) => {
      if (state.km.chiave !== chiave) return;
      state.km = {
        chiave,
        stato: "pronto",
        alle: Date.now(),
        dati: {
          giorni: kmDeiGiorni(righe["dm.ev_odometro"] || [], finestra.inizio, finestra.fine),
        },
      };
      ridisegna();
    })
    .catch(() => {
      if (state.km.chiave !== chiave) return;
      state.km = {
        chiave,
        stato: prima ? "pronto" : "errore",
        alle: Date.now(),
        dati: state.km.dati,
      };
      ridisegna();
    });
}

/* ── il giro ─────────────────────────────────────────────────────────────── */

function pagina() {
  return doc?.getElementById?.("page-ev") || null;
}

function contenitore(page) {
  let box = doc.getElementById("dm-na");
  if (!box) {
    box = doc.createElement("div");
    box.id = "dm-na";
    box.className = "dm-na";
    box.addEventListener("click", alTocco);
    box.addEventListener("input", alCursore);
    box.addEventListener("change", alCambio);
    /* «Altri dati» aperto resta aperto: il disegno si rifa' a ogni stato. */
    box.addEventListener(
      "toggle",
      (evento) => {
        if (evento.target?.classList?.contains?.("dm-auto-altri"))
          state.altriAperti = Boolean(evento.target.open);
      },
      true,
    );
  }
  if (box.parentElement !== page) {
    const testata = page.querySelector(":scope > .dm-page-mast");
    if (testata) testata.after(box);
    else page.prepend(box);
  }
  return box;
}

/* La carta della notte torna dov'era: dopo la console di evcc. */
function rimettiLaNotte() {
  const carta = doc?.getElementById?.("dm-rn");
  if (!carta || !carta.closest("#dm-na")) return;
  const evcc = pagina()?.querySelector(".lm-evcc-card");
  if (evcc) evcc.insertAdjacentElement("afterend", carta);
}

function spegni() {
  const page = pagina();
  if (!page) return;
  rimettiLaNotte();
  page.removeAttribute("data-dm-nuova");
  doc.getElementById("dm-na")?.remove();
  state.firma = "";
}

/** Il giro: legge, disegna se qualcosa e' cambiato, chiede lo storico. */
export function renderLaNuovaAuto() {
  const page = pagina();
  if (!page) return false;
  if (!nuovaAutoAccesa()) {
    if (page.hasAttribute("data-dm-nuova")) spegni();
    return false;
  }
  if (!planciaVisibile() || !page.classList.contains("active")) return false;
  page.setAttribute("data-dm-nuova", "1");
  const box = contenitore(page);
  /* Chi sta trascinando il cursore non deve vederselo ridisegnare sotto il dito. */
  if (box.contains(doc.activeElement) && doc.activeElement?.matches?.("input")) return true;
  const auto = profiles();
  const scelta = activeVehicle(auto);
  const indice = Math.max(
    0,
    auto.findIndex((car) => car === scelta || (car?.uid && car.uid === scelta?.uid)),
  );
  const car = auto[indice] || scelta || {};
  const l = letturaDellAuto(car, true);
  let aperta = linguettaScelta();
  if (aperta === "ricarica" && l.termica) aperta = "viaggi";
  if (!["ricarica", "viaggi", "stato"].includes(aperta)) aperta = l.termica ? "viaggi" : "ricarica";
  let pannello = "";
  if (aperta === "ricarica") {
    caricaLoStorico(l);
    pannello = pannelloRicarica(l);
  } else if (aperta === "viaggi") {
    caricaIKm(l);
    pannello = pannelloViaggi(l);
  } else pannello = pannelloStato(l);
  const html = `${garage(auto, indice)}${eroe(l, indice)}${linguette(l, aperta)}
    <div class="dm-na-pannello" role="tabpanel" data-na-pannello="${aperta}">${pannello}</div>`;
  const firma = `${locale()}|${html}`;
  if (firma !== state.firma) {
    const notte = doc.getElementById("dm-rn");
    /* La carta della notte esce un attimo dal disegno vecchio, o se ne andrebbe con lui. */
    if (notte?.closest?.("#dm-na")) notte.remove();
    box.innerHTML = html;
    state.firma = firma;
  }
  const posto = box.querySelector('[data-na-posto="notte"]');
  if (posto) {
    renderRicaricaDiNotte();
    const notte = doc.getElementById("dm-rn");
    if (notte && notte.parentElement !== posto) posto.append(notte);
    posto.hidden = !notte || notte.hidden;
  } else rimettiLaNotte();
  return true;
}

function ridisegna() {
  state.firma = "";
  schedule();
}

export function schedule() {
  if (state.frame) return;
  const run = () => {
    state.frame = 0;
    try {
      renderLaNuovaAuto();
    } catch (errore) {
      root.console?.warn?.("[DashboardModern] nuova pagina Auto", errore);
    }
  };
  state.frame = root.requestAnimationFrame?.(run) || root.setTimeout?.(run, 0) || 0;
}

/* ── i gesti ─────────────────────────────────────────────────────────────── */

function scriviLaPercentuale(valore) {
  const l = letturaDellAuto(activeVehicle() || {}, true);
  const info = laPercentuale(
    l.lettore.vivo("dm.ev_target_soc"),
    l.lettore.entita("dm.ev_target_soc"),
  );
  if (!info?.scrivibile) return;
  const giusto = percentualeConsentita(info, valore);
  if (giusto === null) return;
  state.voluta = giusto;
  state.volutaAlle = Date.now();
  const voce = info.voci.find((v) => v.n === giusto);
  try {
    root.changeSelect?.("dm.ev_target_soc", voce ? voce.id : String(giusto));
  } catch (errore) {
    root.console?.warn?.("[DashboardModern] obiettivo di carica", errore);
  }
  ridisegna();
}

function alTocco(evento) {
  const bersaglio = evento.target;
  const auto = bersaglio?.closest?.("[data-na-auto]");
  if (auto) {
    try {
      root.cdEvApplyCar?.(Number(auto.dataset.naAuto));
    } catch (_errore) {}
    state.storico = { chiave: "", stato: "vuoto", dati: null };
    state.km = { chiave: "", stato: "vuoto", dati: null };
    ridisegna();
    return;
  }
  const linguetta = bersaglio?.closest?.("[data-na-linguetta]");
  if (linguetta) {
    scegliLinguetta(linguetta.dataset.naLinguetta);
    ridisegna();
    return;
  }
  const vista = bersaglio?.closest?.("[data-na-vista]");
  if (vista) {
    const id = vista.dataset.naVista;
    if (vista.dataset.naGruppo === "viaggi") state.viaggi = id;
    else {
      state.vista = id;
      state.tutte = false;
      if (id === "periodo" && !state.dal) {
        const f = finestraDelloStorico("mese", {});
        state.dal = giornoScritto(f.inizio);
        state.al = giornoScritto(Date.now());
      }
    }
    ridisegna();
    return;
  }
  const mese = bersaglio?.closest?.("[data-na-mese]");
  if (mese) {
    const oggi = new Date();
    const chiave = mese.dataset.naGruppo === "viaggi" ? "meseViaggi" : "mese";
    const adesso = state[chiave] || { anno: oggi.getFullYear(), mese: oggi.getMonth() };
    state[chiave] = meseAccanto(adesso, Number(mese.dataset.naMese));
    state.tutte = false;
    ridisegna();
    return;
  }
  if (bersaglio?.closest?.("[data-na-tutte]")) {
    state.tutte = !state.tutte;
    ridisegna();
    return;
  }
  const modo = bersaglio?.closest?.("[data-na-modo]");
  if (modo) {
    try {
      root.setEVMode?.(modo.dataset.naModo);
    } catch (_errore) {}
    return;
  }
  const sempre = bersaglio?.closest?.("[data-na-sempre]");
  if (sempre) {
    try {
      root.setEVSempre?.(sempre.dataset.naSempre);
    } catch (_errore) {}
    return;
  }
  const passo = bersaglio?.closest?.("[data-na-passo]");
  if (passo) {
    const l = letturaDellAuto(activeVehicle() || {}, true);
    const info = laPercentuale(
      l.lettore.vivo("dm.ev_target_soc"),
      l.lettore.entita("dm.ev_target_soc"),
    );
    if (info && state.voluta !== null) info.valore = state.voluta;
    const dopo = unPasso(info, Number(passo.dataset.naPasso));
    if (dopo !== null) scriviLaPercentuale(dopo);
    return;
  }
  const scelta = bersaglio?.closest?.("[data-na-pct-scelta]");
  if (scelta) {
    scriviLaPercentuale(Number(scelta.dataset.naPctScelta));
    return;
  }
  const misura = bersaglio?.closest?.("[data-dm-storico]");
  if (misura?.dataset.dmStorico) {
    try {
      root.apriStorico?.(evento, misura.dataset.dmStorico, misura.dataset.dmNome || "");
    } catch (_errore) {}
  }
}

/* Il cursore dice il numero mentre si trascina; scrive quando si lascia. */
function alCursore(evento) {
  const cursore = evento.target?.closest?.("[data-na-cursore]");
  if (!cursore) return;
  const box = doc.getElementById("dm-na");
  const l = letturaDellAuto(activeVehicle() || {}, true);
  const info = laPercentuale(
    l.lettore.vivo("dm.ev_target_soc"),
    l.lettore.entita("dm.ev_target_soc"),
  );
  const valore = percentualeConsentita(info, cursore.value) ?? Number(cursore.value);
  const uscita = box?.querySelector("[data-na-pct]");
  if (uscita) uscita.textContent = String(Math.round(valore));
  const km = kmAllaPercentuale(l.autonomia, l.batteria, valore);
  const riga = box?.querySelector("[data-na-km]");
  if (riga) riga.textContent = km === null ? "" : `· ${intero(km)} km`;
}

function alCambio(evento) {
  const bersaglio = evento.target;
  if (bersaglio?.matches?.("[data-na-pct-bassa]")) {
    bersaglio.blur?.();
    const n = Number(bersaglio.value);
    if (bersaglio.value && Number.isFinite(n)) scriviLaPercentuale(n);
    return;
  }
  if (bersaglio?.matches?.("[data-na-cursore]")) {
    bersaglio.blur?.();
    scriviLaPercentuale(Number(bersaglio.value));
    return;
  }
  if (bersaglio?.matches?.("[data-na-dal],[data-na-al]")) {
    if (bersaglio.matches("[data-na-dal]")) state.dal = bersaglio.value;
    else state.al = bersaglio.value;
    state.tutte = false;
    bersaglio.blur?.();
    ridisegna();
  }
}

/* Le percentuali sotto il 60%, in una tendina prima dei tasti. Quando
 * l'obiettivo e' una di queste, la tendina la mostra scelta e si accende come
 * un tasto premuto. */
function tendinaBassa(info, obiettivo) {
  const basse = lePercentualiBasse(info);
  if (!basse.length) return "";
  const scelta = basse.find((n) => Math.round(obiettivo ?? -1) === n);
  return `<select class="dm-na-bassa" data-na-pct-bassa aria-label="${esc(t("Meno del 60%", "Below 60%"))}"${
    scelta === undefined ? "" : ' data-scelta="1"'
  }>
      <option value=""${scelta === undefined ? " selected" : ""}>${esc(t("Meno…", "Less…"))}</option>
      ${basse.map((n) => `<option value="${n}"${n === scelta ? " selected" : ""}>${n}%</option>`).join("")}
    </select>`;
}

/* ── lo stile ────────────────────────────────────────────────────────────── */

function stile() {
  const P = "#page-ev[data-dm-nuova]";
  return `
  ${P} > :not(.dm-page-mast):not(#dm-na){display:none!important}
  ${P} #dm-na{--na-ev:#10b981;--na-sole:#f59e0b;--na-rete:#0ea5e9;--na-notte:#8b5cf6;--na-male:#ef4444;
    display:grid;gap:18px;padding:4px 0 40px;min-width:0}
  ${P} #dm-na *{box-sizing:border-box}
  ${P} .dm-na-carta{position:relative;min-width:0;border:1px solid var(--card-border,#e2e8f0);border-radius:22px;
    background:var(--card-bg,#fff);box-shadow:var(--shadow-sculpted,0 6px 18px rgba(15,23,42,.07));padding:18px 20px}
  ${P} .dm-na-titolo{display:flex;align-items:center;gap:9px;margin:0 0 14px;font-size:12px;font-weight:900;
    letter-spacing:1.6px;text-transform:uppercase;color:var(--text,#0f172a)}
  ${P} .dm-na-titolo>span{font-size:15px;letter-spacing:0}
  ${P} .dm-na-titolo em{margin-left:auto;font-style:normal;font-size:12px;letter-spacing:.3px;text-transform:none;
    color:var(--text,#0f172a);font-weight:900}
  ${P} .dm-na-titolo em[data-tono="ok"]{color:#16a34a}
  ${P} .dm-na-titolo em[data-tono="attenzione"]{color:var(--na-male)}
  ${P} .dm-na-sottotitolo{margin:18px 0 10px;font-size:11.5px;font-weight:900;letter-spacing:1.4px;text-transform:uppercase;
    color:var(--text-dim,#64748b);padding-top:16px;border-top:1px solid var(--card-border,#e2e8f0)}

  /* il garage */
  ${P} .dm-na-garage{display:flex;gap:10px;overflow-x:auto;padding:2px 2px 6px;scrollbar-width:none}
  ${P} .dm-na-garage::-webkit-scrollbar{display:none}
  ${P} .dm-na-garage-auto{flex:0 0 auto;display:flex;align-items:center;gap:10px;min-width:220px;max-width:290px;padding:10px 14px;
    border-radius:18px;border:1px solid var(--card-border,#e2e8f0);background:var(--card-bg,#fff);color:var(--text,#0f172a);
    font:inherit;text-align:left;cursor:pointer;box-shadow:var(--shadow-sculpted,0 6px 18px rgba(15,23,42,.07))}
  ${P} .dm-na-garage-auto[aria-pressed="true"]{border-color:var(--na-ev);
    background:color-mix(in srgb,var(--na-ev) 9%,var(--card-bg,#fff));box-shadow:0 0 0 2px color-mix(in srgb,var(--na-ev) 30%,transparent)}
  ${P} .dm-na-garage-auto[data-tipo="termica"][aria-pressed="true"]{border-color:var(--na-sole);
    background:color-mix(in srgb,var(--na-sole) 9%,var(--card-bg,#fff));box-shadow:0 0 0 2px color-mix(in srgb,var(--na-sole) 30%,transparent)}
  ${P} .dm-na-garage-testo{display:grid;gap:2px;min-width:0;flex:1}
  ${P} .dm-na-garage-testo b{font-size:14px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  ${P} .dm-na-garage-testo small{font-size:12px;font-weight:700;color:var(--text-dim,#64748b);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  ${P} .dm-na-minibarra{display:block;height:4px;border-radius:9px;background:color-mix(in srgb,var(--text,#0f172a) 10%,transparent);overflow:hidden;margin-top:4px}
  ${P} .dm-na-minibarra i{display:block;height:100%;border-radius:inherit;background:var(--na-ev)}
  ${P} [data-tipo="termica"] .dm-na-minibarra i{background:var(--na-sole)}
  ${P} .dm-na-logo{display:inline-grid;place-items:center;flex:0 0 auto;line-height:0}
  ${P} .dm-na-logo svg,${P} .dm-na-logo img{max-width:100%;height:auto}

  /* l'eroe */
  ${P} .dm-na-eroe{display:grid;gap:0;padding:0;overflow:hidden}
  ${P} .dm-na-eroe[data-tipo="termica"]{--na-ev:var(--na-sole)}
  ${P} .dm-na-copertina{position:relative;height:300px;overflow:hidden;border-radius:22px 22px 0 0;
    background:radial-gradient(80% 90% at 50% 60%,color-mix(in srgb,var(--na-ev) 22%,var(--card-bg,#fff)),var(--card-bg,#fff))}
  /* «Quando uso zfold 8 aperto la foto della macchina non entra tutta»: la
   * foto si vede intera su qualunque schermo (contain), e lo spazio che avanza
   * lo riempie la stessa foto sfocata, cosi' non restano bande vuote. */
  ${P} .dm-na-copertina img{position:absolute;inset:0;width:100%;height:100%}
  ${P} .dm-na-copertina img.dm-na-auto{object-fit:contain;object-position:center}
  ${P} .dm-na-copertina img.dm-na-sfondo{object-fit:cover;filter:blur(22px) saturate(1.15) brightness(.85);transform:scale(1.2)}
  ${P} .dm-na-copertina::after{content:"";position:absolute;inset:0;pointer-events:none;
    background:linear-gradient(180deg,rgba(2,6,23,.4) 0%,rgba(2,6,23,0) 28%)}
  ${P} .dm-na-foto-vuota{position:absolute;inset:0;display:grid;place-items:center;opacity:.5}
  ${P} .dm-na-copertina-sopra{position:absolute;z-index:1;top:16px;left:18px;right:18px;display:flex;align-items:center;justify-content:space-between;gap:10px}
  ${P} .dm-na-quando{padding:5px 11px;border-radius:999px;font-size:12px;font-weight:800;color:#e2e8f0;
    background:rgba(2,6,23,.45);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
  /* Il marchio e il modello: una riga sua sotto la foto, non sopra. */
  ${P} .dm-na-eroe-lato{display:grid;align-content:start;min-width:0}
  ${P} .dm-na-eroe-nome{display:flex;align-items:center;gap:14px;min-width:0;padding:18px 22px 14px;
    border-bottom:1px solid var(--card-border,#e2e8f0)}
  ${P} .dm-na-logo-grande{width:64px;height:54px;flex:0 0 auto;display:grid;place-items:center;border-radius:16px;
    background:var(--surface-2,#f8fafc);border:1px solid var(--card-border,#e2e8f0);padding:6px}
  ${P} .dm-na-logo-grande>*{max-width:100%;max-height:100%}
  ${P} .dm-na-eroe-nome>span:last-child{min-width:0}
  ${P} .dm-na-eroe-nome b{display:block;font-size:22px;font-weight:900;color:var(--text,#0f172a);line-height:1.15;letter-spacing:-.3px;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  ${P} .dm-na-eroe-nome small{display:block;font-size:13px;font-weight:700;color:var(--text-dim,#64748b);margin-top:3px}
  ${P} .dm-na-stato{display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:999px;font-size:12.5px;font-weight:900;
    color:#e2e8f0;background:rgba(2,6,23,.45);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
  ${P} .dm-na-stato i{width:8px;height:8px;border-radius:50%;background:currentColor}
  ${P} .dm-na-stato[data-tono="carica"]{color:#6ee7b7;background:rgba(6,78,59,.7)}
  ${P} .dm-na-stato[data-tono="carica"] i{box-shadow:0 0 0 0 currentColor;animation:dmNaPulsa 1.8s infinite}
  ${P} .dm-na-stato[data-tono="collegata"]{color:#7dd3fc;background:rgba(7,89,133,.65)}
  ${P} .dm-na-stato[data-tono="guasto"]{color:#fecaca;background:rgba(127,29,29,.7)}
  @keyframes dmNaPulsa{0%{box-shadow:0 0 0 0 color-mix(in srgb,currentColor 60%,transparent)}100%{box-shadow:0 0 0 9px transparent}}
  ${P} .dm-na-eroe-dati{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:0;padding:4px 8px 0}
  ${P} .dm-na-dato{display:grid;align-content:start;gap:4px;padding:16px 14px 12px;min-width:0}
  ${P} .dm-na-dato+.dm-na-dato{border-left:1px solid var(--card-border,#e2e8f0)}
  ${P} .dm-na-dato>span{font-size:11px;font-weight:900;letter-spacing:1.2px;text-transform:uppercase;color:var(--text-dim,#64748b)}
  ${P} .dm-na-dato-km{cursor:pointer}
  ${P} .dm-na-autonomia{display:flex;align-items:baseline;gap:5px;line-height:.9}
  ${P} .dm-na-autonomia b{font-family:'Oswald',system-ui,sans-serif;font-size:64px;font-weight:700;letter-spacing:-1.5px;color:var(--text,#0f172a)}
  ${P} .dm-na-autonomia small{font-size:20px;font-weight:800;color:var(--text-dim,#64748b)}
  ${P} .dm-na-livello{display:grid;gap:8px}
  ${P} .dm-na-livello b{font-family:'Oswald',system-ui,sans-serif;font-size:40px;font-weight:700;color:var(--text,#0f172a);line-height:1}
  ${P} .dm-na-livello b small{font-family:inherit;font-size:16px;color:var(--text-dim,#64748b);margin-left:3px}
  ${P} .dm-na-pila{position:relative;display:block;height:14px;border-radius:6px;border:2px solid color-mix(in srgb,var(--text,#0f172a) 20%,transparent);padding:2px;margin-right:6px}
  ${P} .dm-na-pila::after{content:"";position:absolute;right:-6px;top:3px;width:4px;height:4px;border-radius:0 2px 2px 0;background:color-mix(in srgb,var(--text,#0f172a) 20%,transparent)}
  ${P} .dm-na-pila i{display:block;height:100%;border-radius:3px;background:linear-gradient(90deg,#059669,#34d399)}
  ${P} [data-tipo="carburante"] .dm-na-pila i{background:linear-gradient(90deg,#d97706,#fbbf24)}
  ${P} .dm-na-eroe-pills{padding:4px 22px 20px}
  /* Sul computer la foto sta a sinistra, nella sua forma: allargata a tutta la
   * pagina una foto del telefono si sgrana, e l'auto resta tagliata. */
  @media (min-width:761px){
    ${P} .dm-na-eroe{grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);align-items:stretch}
    ${P} .dm-na-copertina{height:100%;min-height:300px;border-radius:22px 0 0 22px}
    ${P} .dm-na-eroe-nome{padding:22px 24px 16px}
    ${P} .dm-na-eroe-dati{grid-auto-flow:row;grid-template-columns:repeat(2,minmax(0,1fr));padding:14px 14px 0}
    ${P} .dm-na-dato-km{grid-column:1 / -1}
    ${P} .dm-na-dato+.dm-na-dato{border-left:0}
    ${P} .dm-na-dato:nth-child(3){border-left:1px solid var(--card-border,#e2e8f0)}
    ${P} .dm-na-autonomia b{font-size:88px}
    ${P} .dm-na-eroe-pills{align-self:end}
  }
  /* Uno schermo largo ma basso — il Fold aperto, un tablet in orizzontale — la
   * card deve stare tutta nello schermo: i numeri si fanno piu' piccoli. */
  @media (min-width:761px) and (max-height:900px){
    ${P} .dm-na-copertina{min-height:240px}
    ${P} .dm-na-eroe-nome{padding:16px 20px 12px}
    ${P} .dm-na-eroe-dati{padding:6px 10px 0}
    ${P} .dm-na-dato{padding:10px 12px 8px}
    ${P} .dm-na-autonomia b{font-size:clamp(52px,8vh,76px)}
    ${P} .dm-na-livello b{font-size:clamp(30px,5vh,38px)}
    ${P} .dm-na-eroe-pills{padding:4px 20px 14px}
  }
  ${P} .dm-na-eroe-pills:empty{display:none}
  ${P} .dm-na-pills{display:flex;flex-wrap:wrap;gap:7px}
  ${P} .dm-na-pill{display:inline-flex;align-items:center;gap:6px;padding:6px 11px;border-radius:999px;font-size:12px;font-weight:800;
    color:var(--text,#0f172a);background:var(--surface-2,#f8fafc);border:1px solid var(--card-border,#e8edf3)}
  ${P} a.dm-na-pill-mappa{color:#0ea5e9;text-decoration:none;cursor:pointer;overflow-wrap:anywhere}
  ${P} a.dm-na-pill-mappa::after{content:"↗";margin-left:2px;font-weight:900}
  ${P} .dm-na-pill[data-tono="ok"]{color:#15803d;border-color:color-mix(in srgb,#16a34a 30%,transparent);background:color-mix(in srgb,#16a34a 9%,transparent)}
  ${P} .dm-na-pill[data-tono="attenzione"]{color:#b91c1c;border-color:color-mix(in srgb,var(--na-male) 35%,transparent);background:color-mix(in srgb,var(--na-male) 9%,transparent)}

  /* le linguette */
  ${P} .dm-na-linguette{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:6px;padding:6px;border-radius:20px;
    border:1px solid var(--card-border,#e2e8f0);background:var(--card-bg,#fff);box-shadow:var(--shadow-sculpted,0 6px 18px rgba(15,23,42,.07))}
  ${P} .dm-na-linguetta{display:flex;align-items:center;justify-content:center;gap:8px;min-height:46px;padding:8px 10px;border-radius:14px;
    border:1px solid transparent;background:transparent;color:var(--text-dim,#64748b);font:inherit;font-size:15px;font-weight:900;cursor:pointer}
  ${P} .dm-na-linguetta[aria-selected="true"]{color:var(--text,#0f172a);border-color:color-mix(in srgb,var(--na-ev) 45%,transparent);
    background:color-mix(in srgb,var(--na-ev) 11%,var(--card-bg,#fff))}
  ${P} .dm-na-linguetta em{font-style:normal;font-size:11px;font-weight:900;padding:2px 8px;border-radius:999px;color:#047857;
    background:color-mix(in srgb,var(--na-ev) 18%,transparent)}
  ${P} .dm-na-linguetta em[data-tono="attenzione"]{color:#b91c1c;background:color-mix(in srgb,var(--na-male) 14%,transparent)}
  html[data-theme="dark"] ${P} .dm-na-linguetta em,body.dark-theme ${P} .dm-na-linguetta em{color:#6ee7b7}
  html[data-theme="dark"] ${P} .dm-na-linguetta em[data-tono="attenzione"],body.dark-theme ${P} .dm-na-linguetta em[data-tono="attenzione"]{color:#fca5a5}
  html[data-theme="dark"] ${P} .dm-na-pill[data-tono="ok"],body.dark-theme ${P} .dm-na-pill[data-tono="ok"]{color:#86efac}
  html[data-theme="dark"] ${P} .dm-na-pill[data-tono="attenzione"],body.dark-theme ${P} .dm-na-pill[data-tono="attenzione"]{color:#fca5a5}
  html[data-theme="dark"] ${P} .dm-na-stato[data-tono="carica"],body.dark-theme ${P} .dm-na-stato[data-tono="carica"]{color:#6ee7b7}
  ${P} .dm-na-pannello{display:grid;gap:18px;min-width:0}
  ${P} .dm-na-griglia{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr));gap:18px;align-items:start}
  ${P} .dm-na-griglia:empty{display:none}

  /* adesso */
  ${P} .dm-na-adesso{display:flex;align-items:center;gap:22px;flex-wrap:wrap}
  ${P} .dm-na-anello{position:relative;width:132px;height:132px;flex:0 0 auto}
  ${P} .dm-na-anello svg{width:100%;height:100%;transform:rotate(-90deg)}
  ${P} .dm-na-anello circle{fill:none;stroke-width:11;stroke:color-mix(in srgb,var(--text,#0f172a) 9%,transparent)}
  ${P} .dm-na-anello circle.pieno{stroke:var(--na-ev);stroke-linecap:round}
  ${P} .dm-na-anello>div{position:absolute;inset:0;display:grid;place-content:center;text-align:center}
  ${P} .dm-na-anello b{font-family:'Oswald',system-ui,sans-serif;font-size:32px;font-weight:700;color:var(--text,#0f172a);line-height:1}
  ${P} .dm-na-anello[data-tono="carica"] b{color:#059669}
  ${P} .dm-na-anello small{font-size:12px;font-weight:800;color:var(--text-dim,#64748b)}
  ${P} .dm-na-pronta{display:grid;gap:2px}
  ${P} .dm-na-pronta span{font-size:13px;font-weight:800;color:var(--text-dim,#64748b)}
  ${P} .dm-na-pronta b{font-family:'Oswald',system-ui,sans-serif;font-size:52px;font-weight:700;color:var(--text,#0f172a);line-height:1}
  ${P} .dm-na-pronta b.dm-na-pronta-ferma{font-family:inherit;font-size:22px;font-weight:900}
  ${P} .dm-na-pronta small{font-size:13px;font-weight:700;color:var(--text-dim,#64748b)}
  ${P} .dm-na-obiettivo{margin-top:18px}
  ${P} .dm-na-obiettivo-testa{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
  ${P} .dm-na-obiettivo-testa>span:first-child{font-size:13px;font-weight:800;color:var(--text-dim,#64748b);margin-right:auto}
  ${P} .dm-na-obiettivo-testa b{font-family:'Oswald',system-ui,sans-serif;font-size:34px;font-weight:700;color:var(--text,#0f172a);line-height:1}
  ${P} .dm-na-obiettivo-testa b small{font-size:16px;color:var(--text-dim,#64748b)}
  ${P} .dm-na-obiettivo-km{font-size:13px;font-weight:800;color:var(--text-dim,#64748b)}
  /* La barra dice soltanto fin dove si carichera'. Non si trascina: col
   * cursore, scorrendo la pagina col dito, l'obiettivo cambiava per sbaglio.
   * Si cambia coi tasti qui sotto. */
  ${P} .dm-na-cursore{position:relative;height:10px;margin:18px 0 12px;border-radius:9px;
    background:color-mix(in srgb,var(--text,#0f172a) 10%,transparent);overflow:hidden}
  ${P} .dm-na-cursore .dm-na-fino{position:absolute;left:0;top:0;bottom:0;width:var(--na-fino);border-radius:9px;
    background:linear-gradient(90deg,#059669,#34d399)}
  ${P} .dm-na-scala{display:flex;justify-content:space-between;font-size:11.5px;font-weight:800;color:var(--text-dim,#64748b)}
  ${P} .dm-na-adesso{color:#059669}
  ${P} .dm-na-scala .dm-na-adesso{color:#059669}
  ${P} .dm-na-passi{display:flex;align-items:center;gap:8px;margin-top:12px;flex-wrap:wrap}
  ${P} .dm-na-passi>button,${P} .dm-na-scorciatoie button,${P} .dm-na-segmenti button,${P} .dm-na-mese button{
    min-width:40px;min-height:36px;padding:6px 12px;border-radius:11px;border:1px solid var(--card-border,#e2e8f0);
    background:var(--surface-2,#f8fafc);color:var(--text,#0f172a);font:inherit;font-size:14px;font-weight:900;cursor:pointer}
  ${P} .dm-na-scorciatoie{display:flex;gap:6px;flex-wrap:wrap}
  /* La tendina delle percentuali basse: vestita come i tasti accanto, e
   * accesa come un tasto premuto quando l'obiettivo e' una delle sue. */
  ${P} .dm-na-bassa{min-height:36px;padding:6px 30px 6px 12px;border-radius:11px;border:1px solid var(--card-border,#e2e8f0);
    background:var(--surface-2,#f8fafc) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2364748b'/%3E%3C/svg%3E") no-repeat right 11px center;
    color:var(--text,#0f172a);font:inherit;font-size:14px;font-weight:900;cursor:pointer;-webkit-appearance:none;appearance:none}
  ${P} .dm-na-bassa[data-scelta]{background-color:var(--text,#0f172a);color:var(--card-bg,#fff);border-color:var(--text,#0f172a)}
  ${P} .dm-na-scorciatoie button[aria-pressed="true"],${P} .dm-na-segmenti button[aria-pressed="true"]{
    background:var(--text,#0f172a);color:var(--card-bg,#fff);border-color:var(--text,#0f172a)}
  ${P} .dm-na-tessere,${P} .dm-na-totali{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:10px;margin-top:16px}
  ${P} .dm-na-totali{grid-template-columns:repeat(4,minmax(0,1fr));margin:0 0 16px}
  ${P} .dm-na-totali-tre{grid-template-columns:repeat(3,minmax(0,1fr))}
  ${P} .dm-na-totali-due{grid-template-columns:repeat(auto-fit,minmax(110px,1fr))}
  ${P} .dm-na-tessera{display:grid;gap:4px;padding:11px 14px;border-radius:15px;background:var(--surface-2,#f8fafc);
    border:1px solid var(--card-border,#e8edf3);min-width:0}
  ${P} .dm-na-tessera[data-dm-storico]{cursor:pointer;transition:border-color .15s,transform .15s}
  ${P} .dm-na-tessera[data-dm-storico]:hover{border-color:var(--accent,#10b981)}
  ${P} .dm-na-tessera[data-dm-storico]:active{transform:scale(.98)}
  ${P} .dm-na-tessera>span{font-size:12px;font-weight:800;color:var(--text-dim,#64748b);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  ${P} .dm-na-tessera>b{font-family:'Oswald',system-ui,sans-serif;font-size:26px;font-weight:700;color:var(--text,#0f172a);line-height:1.05;white-space:nowrap}
  ${P} .dm-na-tessera>b small{font-family:inherit;font-size:13px;font-weight:700;color:var(--text-dim,#64748b);margin-left:4px}
  ${P} .dm-na-tessera[data-tono="sole"]>b{color:#d97706}
  ${P} .dm-na-nota{margin:12px 0 0;font-size:12.5px;font-weight:700;color:var(--text-dim,#64748b)}

  /* la wallbox */
  ${P} .dm-na-modi{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:8px}
  ${P} .dm-na-modo{display:grid;gap:3px;text-align:left;padding:12px 14px;border-radius:15px;border:1px solid var(--card-border,#e2e8f0);
    background:var(--surface-2,#f8fafc);color:var(--text,#0f172a);font:inherit;cursor:pointer}
  ${P} .dm-na-modo b{font-size:15px;font-weight:900}
  ${P} .dm-na-modo small{font-size:12px;font-weight:700;color:var(--text-dim,#64748b)}
  ${P} .dm-na-modo[aria-pressed="true"]{border-color:var(--na-modo);background:color-mix(in srgb,var(--na-modo) 13%,var(--card-bg,#fff));
    box-shadow:0 0 0 2px color-mix(in srgb,var(--na-modo) 28%,transparent)}
  ${P} .dm-na-sempre{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:10px;padding:12px 14px;border-radius:15px;
    border:1px dashed color-mix(in srgb,var(--na-sole) 55%,transparent);background:color-mix(in srgb,var(--na-sole) 7%,transparent)}
  ${P} .dm-na-sempre>div:first-child{display:grid;gap:2px;margin-right:auto}
  ${P} .dm-na-sempre b{font-size:14px;font-weight:900;color:var(--text,#0f172a)}
  ${P} .dm-na-sempre small{font-size:12px;font-weight:700;color:var(--text-dim,#64748b)}
  ${P} .dm-na-sempre[data-vigore="false"]{opacity:.65}
  ${P} .dm-na-sempre .dm-na-segmenti button[aria-pressed="true"]{background:var(--na-sole);border-color:var(--na-sole);color:#1c1917}
  ${P} .dm-na-segmenti{display:inline-flex;gap:4px;padding:4px;border-radius:14px;background:color-mix(in srgb,var(--text,#0f172a) 5%,transparent)}
  ${P} .dm-na-segmenti button{border-color:transparent;background:transparent;min-height:32px}

  /* la notte */
  ${P} .dm-na-notte[hidden]{display:none}
  ${P} .dm-na-notte>#dm-rn{margin:0}

  /* lo storico */
  ${P} .dm-na-storico-testa{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px}
  ${P} .dm-na-storico-testa .dm-na-titolo{margin:0;margin-right:auto}
  ${P} .dm-na-ultima-quando{margin:0 0 12px;font-size:14px;font-weight:700;color:var(--text-dim,#64748b)}
  ${P} .dm-na-ultima-quando b{color:var(--text,#0f172a)}
  ${P} .dm-na-periodo{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
  ${P} .dm-na-mese{display:flex;align-items:center;gap:8px}
  ${P} .dm-na-mese b{font-size:15px;font-weight:900;color:var(--text,#0f172a);text-transform:capitalize;min-width:120px;text-align:center}
  ${P} .dm-na-mese button:disabled{opacity:.35;cursor:default}
  ${P} .dm-na-date{display:flex;gap:8px;flex-wrap:wrap}
  ${P} .dm-na-date label{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:800;color:var(--text-dim,#64748b)}
  ${P} .dm-na-date input{min-height:36px;padding:4px 8px;border-radius:10px;border:1px solid var(--card-border,#e2e8f0);
    background:var(--surface-2,#f8fafc);color:var(--text,#0f172a);font:inherit;font-weight:800;color-scheme:light dark}
  ${P} .dm-na-grafico{display:flex;align-items:stretch;gap:5px;height:150px;padding-bottom:20px;
    border-bottom:1px solid var(--card-border,#e2e8f0)}
  ${P} .dm-na-grafico[data-fitta="true"]{gap:3px}
  ${P} .dm-na-colonna{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:flex-end;position:relative}
  ${P} .dm-na-barra{display:flex;flex-direction:column-reverse;align-self:center;width:min(100%,46px);
    border-radius:6px 6px 2px 2px;overflow:hidden;gap:2px;min-height:0}
  ${P} .dm-na-barra i{display:block;flex:1;background:var(--na-ev)}
  ${P} .dm-na-barra i.sole{background:var(--na-sole)}
  ${P} .dm-na-barra i.rete{background:var(--na-ev)}
  ${P} .dm-na-colonna::before{content:"";position:absolute;left:0;right:0;bottom:0;height:3px;border-radius:2px;
    background:color-mix(in srgb,var(--text,#0f172a) 8%,transparent)}
  ${P} .dm-na-colonna[data-futuro="true"]{opacity:.35}
  ${P} .dm-na-colonna small{position:absolute;left:-4px;right:-4px;bottom:-20px;text-align:center;font-size:11px;font-weight:800;
    color:var(--text-dim,#64748b);white-space:nowrap;text-transform:capitalize}
  ${P} .dm-na-legenda{display:flex;gap:16px;margin:10px 0 0;font-size:12px;font-weight:800;color:var(--text-dim,#64748b)}
  ${P} .dm-na-legenda span{display:inline-flex;align-items:center;gap:6px}
  ${P} .dm-na-legenda i{width:11px;height:11px;border-radius:3px;background:var(--na-ev)}
  ${P} .dm-na-legenda i.sole{background:var(--na-sole)}
  ${P} .dm-na-ricariche{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,330px),1fr));gap:10px;margin-top:16px}
  ${P} .dm-na-ricarica{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:14px;padding:10px 14px;
    border-radius:15px;background:var(--surface-2,#f8fafc);border:1px solid var(--card-border,#e8edf3)}
  ${P} .dm-na-ricarica-giorno{display:grid;justify-items:center;min-width:34px}
  ${P} .dm-na-ricarica-giorno b{font-family:'Oswald',system-ui,sans-serif;font-size:22px;color:var(--text,#0f172a);line-height:1}
  ${P} .dm-na-ricarica-giorno small{font-size:10.5px;font-weight:900;text-transform:uppercase;color:var(--text-dim,#64748b)}
  ${P} .dm-na-ricarica-corpo{display:grid;gap:7px;min-width:0;font-size:13px;color:var(--text-dim,#64748b);font-weight:700}
  ${P} .dm-na-ricarica-corpo b{color:var(--text,#0f172a);font-weight:900}
  ${P} .dm-na-quota{display:flex;height:6px;border-radius:9px;overflow:hidden;gap:2px;background:color-mix(in srgb,var(--text,#0f172a) 8%,transparent)}
  ${P} .dm-na-quota i{display:block;min-width:0}
  ${P} .dm-na-quota i.sole{background:var(--na-sole)}
  ${P} .dm-na-quota i.rete{background:var(--na-ev)}
  ${P} .dm-na-ricarica-costo{display:grid;justify-items:end;gap:2px}
  ${P} .dm-na-ricarica-costo b{font-size:15px;font-weight:900;color:var(--text,#0f172a);white-space:nowrap}
  ${P} .dm-na-ricarica-costo small{font-size:11px;font-weight:900;color:#d97706;white-space:nowrap}
  ${P} .dm-na-tutte{display:block;width:100%;margin-top:12px;padding:12px;border-radius:14px;border:1px solid var(--card-border,#e2e8f0);
    background:var(--surface-2,#f8fafc);color:#059669;font:inherit;font-size:14px;font-weight:900;cursor:pointer}
  ${P} .dm-na-vuoto{margin:8px 0;padding:18px;border-radius:15px;text-align:center;font-size:13.5px;font-weight:700;
    color:var(--text-dim,#64748b);background:var(--surface-2,#f8fafc)}

  /* viaggi e stato */
  ${P} .dm-na-parti{display:flex;height:12px;border-radius:9px;overflow:hidden;gap:2px}
  ${P} .dm-na-parti i{display:block;min-width:0}
  ${P} [data-parte="guida"] i,${P} i[data-parte="guida"]{background:#10b981}
  ${P} [data-parte="clima"] i,${P} i[data-parte="clima"]{background:#0ea5e9}
  ${P} [data-parte="altro"] i,${P} i[data-parte="altro"]{background:#f59e0b}
  ${P} .dm-na-parti-voci{display:flex;flex-wrap:wrap;gap:14px;margin-top:12px;font-size:13px;font-weight:700;color:var(--text-dim,#64748b)}
  ${P} .dm-na-parti-voci span{display:inline-flex;align-items:center;gap:6px}
  ${P} .dm-na-parti-voci i{width:10px;height:10px;border-radius:3px}
  ${P} .dm-na-parti-voci b{color:var(--text,#0f172a)}
  ${P} .dm-na-ruote{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
  ${P} .dm-na-ruota{display:grid;gap:3px;padding:12px 14px;border-radius:15px;background:var(--surface-2,#f8fafc);border:1px solid var(--card-border,#e8edf3)}
  ${P} .dm-na-ruota span{font-size:12px;font-weight:800;color:var(--text-dim,#64748b)}
  ${P} .dm-na-ruota b{font-family:'Oswald',system-ui,sans-serif;font-size:28px;font-weight:700;color:#16a34a;line-height:1}
  ${P} .dm-na-ruota b small{font-family:inherit;font-size:12px;color:var(--text-dim,#64748b);margin-left:3px}
  ${P} .dm-na-ruota[data-tono="bassa"] b,${P} .dm-na-ruota[data-tono="alta"] b,${P} .dm-na-ruota[data-tono="avviso"] b{color:var(--na-male)}
  ${P} .dm-na-ruota[data-tono="bassa"],${P} .dm-na-ruota[data-tono="avviso"]{border-color:color-mix(in srgb,var(--na-male) 40%,transparent)}
  ${P} .dm-na-voci{display:grid;gap:8px}
  ${P} .dm-na-voce{display:grid;grid-template-columns:28px minmax(0,1fr) auto;align-items:center;gap:10px;padding:10px 12px;border-radius:13px;
    background:var(--surface-2,#f8fafc)}
  ${P} .dm-na-voce b{font-size:14px;font-weight:800;color:var(--text,#0f172a)}
  ${P} .dm-na-voce em{font-style:normal;font-size:13px;font-weight:900;color:#16a34a}
  ${P} .dm-na-voce[data-tono="attenzione"] em{color:var(--na-male)}
  ${P} .dm-na-riga{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--card-border,#e2e8f0);font-size:14px}
  ${P} .dm-na-riga:last-child{border:0}
  ${P} .dm-na-riga span{font-weight:700;color:var(--text-dim,#64748b)}
  ${P} .dm-na-riga b{font-weight:900;color:var(--text,#0f172a);text-align:right}

  /* gli altri dati, con le vesti della pagina classica */
  ${P} .dm-na-extra details.dm-auto-altri{border-radius:22px}
  ${P} .dm-na-extra .dm-termica-pillola{font-size:12px}

  /* il telefono */
  @media (max-width:760px){
    ${P} #dm-na{gap:14px}
    ${P} .dm-na-carta{padding:16px;border-radius:20px}
    ${P} .dm-na-eroe{padding:0}
    ${P} .dm-na-copertina{height:auto;aspect-ratio:16/10;max-height:42vh;min-height:180px;border-radius:20px 20px 0 0}
    ${P} .dm-na-eroe-nome{padding:14px 16px 12px;gap:12px}
    ${P} .dm-na-eroe-nome b{font-size:19px}
    ${P} .dm-na-logo-grande{width:58px;height:48px;padding:5px}
    ${P} .dm-na-eroe-dati{padding:0 2px}
    ${P} .dm-na-dato{padding:14px 10px 10px}
    ${P} .dm-na-dato>span{font-size:10px;letter-spacing:.8px}
    ${P} .dm-na-autonomia b{font-size:44px}
    ${P} .dm-na-autonomia small{font-size:15px}
    ${P} .dm-na-livello b{font-size:28px}
    ${P} .dm-na-eroe-pills{padding:2px 14px 16px}
    ${P} .dm-na-linguetta{font-size:13.5px;gap:5px;padding:8px 4px;flex-wrap:wrap}
    ${P} .dm-na-linguetta em{display:none}
    ${P} .dm-na-totali{grid-auto-flow:row;grid-template-columns:repeat(2,minmax(0,1fr))}
    ${P} .dm-na-tessere .dm-na-tessera{padding:10px 11px}
    ${P} .dm-na-tessere .dm-na-tessera>b{font-size:22px}
    ${P} .dm-na-tessere .dm-na-tessera>span{white-space:normal;line-height:1.15}
    ${P} .dm-na-modo{padding:10px}
    ${P} .dm-na-modo b{font-size:13.5px}
    ${P} .dm-na-modo small{font-size:11px}
    ${P} .dm-na-totali-tre{grid-auto-flow:column;grid-template-columns:none}
    ${P} .dm-na-totali-tre .dm-na-tessera{padding:10px 11px}
    ${P} .dm-na-totali-tre .dm-na-tessera>b{font-size:21px}
    ${P} .dm-na-totali-tre .dm-na-tessera>b small{display:block;margin:2px 0 0;white-space:normal}
    ${P} .dm-na-pronta b{font-size:42px}
    ${P} .dm-na-anello{width:112px;height:112px}
    ${P} .dm-na-storico-testa .dm-na-titolo{width:100%}
    ${P} .dm-na-periodo{width:100%;justify-content:space-between}
    ${P} .dm-na-scorciatoie{margin-left:0}
    /* Sul telefono la tendina e i cinque tasti in due file da tre, tutte
     * larghe uguali: la tendina non resta da sola su una riga. */
    ${P} .dm-na-passi{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
    ${P} .dm-na-passi .dm-na-scorciatoie{display:contents}
    ${P} .dm-na-passi button,${P} .dm-na-bassa{width:100%}
  }`;
}

/* ── l'aggancio ──────────────────────────────────────────────────────────── */

export function installLaNuovaAuto() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyle("dm-la-nuova-auto-style", stile());
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:state-changed",
    "dashboardmodern:persistence-restored",
    "dashboardmodern:ricarica-notte",
  ])
    root.addEventListener?.(evento, schedule);
  root.addEventListener?.("storage", (evento) => {
    if (evento?.key === INTERRUTTORE_DI_PROVA) ridisegna();
  });
  doc.addEventListener?.("visibilitychange", schedule);
  quandoSiCambiaPagina(schedule);
  schedule();
  return true;
}

senzaCadere(installLaNuovaAuto);
