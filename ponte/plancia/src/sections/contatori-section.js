/* La pagina dell'acqua e del gas (#115, #135, #137).
 *
 * «Manca una sezione per monitorare portata e pressione dell'impianto idrico
 * di casa, magari anche una sezione per l'addolcitore per vedere il livello
 * del sale.» «Si potrebbero mettere sezioni come consumi e contatore acqua e
 * energia gas.» «Potresti creare una sezione consumo gas.»
 *
 * Una pagina sola per le tre richieste, fatta coi pezzi che le altre pagine
 * hanno già — niente di nuovo da imparare guardandola:
 *
 *   · in cima la risposta grande, il riquadro «In questo momento» dei Varchi:
 *     quanta acqua oggi, o — in rosso — da quanto scorre senza fermarsi;
 *   · la pressione sulla barra a forcella della Piscina, la stessa del pH;
 *   · la portata, il sale e i consumi del mese nelle righe delle Batterie;
 *   · e quando qualcosa non va, l'elenco a semaforo dei Varchi: ogni
 *     contatore una riga, verde se sta bene, rossa se è lui il guaio.
 *
 * Qui non si comanda niente: un contatore si guarda. I numeri che il Recorder
 * sa e lo stato no — oggi, ieri, il mese, la storia della portata — si chiedono
 * a Home Assistant quando la pagina o la sua tessera si vedono, ogni cinque
 * minuti al più, che è il passo con cui il Recorder li compila.
 */
import {
  CHIAVE_CONTATORI,
  comeSiDiceIlVolume,
  comeStannoIContatori,
  consumiDallaRisposta,
  contatoriConfigurati,
  contatoriDiCasa,
  domandaDeiConsumi,
  domandaDelleOre,
  domandaDelSale,
  oreDallaRisposta,
  saleInGiorni,
  serieDallaStoria,
  serieDalleStatistiche,
} from "../core/contatori-di-casa.js";
import { quantoTempoInParole } from "../core/da-quanto.js";
import { normalizePeople } from "../core/person-model.js";
import { domandaDellAvvio, righeDellaStoria } from "../core/quando-e-partito.js";
import { cEQualcunoInCasa } from "../core/telecamere-riservate.js";
import { forcellaMarkup } from "./pool-irrigation-scene-section.js";
import {
  allStates,
  chiediAHomeAssistant,
  disegnoDiCasa,
  doc,
  esc,
  formatNumber,
  installStyle,
  paginaVisibile,
  planciaVisibile,
  quandoSiCambiaPagina,
  readJson,
  root,
  t,
  senzaCadere,
  segnaContenuto,
} from "./shared.js";
import { nomeDaHomeAssistant } from "./editor-slots-section.js";

const KEY = "__DASHBOARDMODERN_CONTATORI__";
const state = (root[KEY] ||= {
  installed: false,
  frame: 0,
  firma: "",
  sveglia: 0,
  dati: null,
  inVolo: false,
  chiestoAlle: 0,
  fallitoAlle: 0,
  scorrevano: "",
});

export const CONTATORI_PAGE_ID = "page-contatori";
export const CONTATORI_TAB = "contatori";

/* L'avviso che i numeri del Recorder sono arrivati: la tessera in Home lo
 * ascolta, perché la risposta atterra quando la Home si è già disegnata. */
export const EVENTO_CONTATORI = "dashboardmodern:contatori-letti";

/* Il passo del Recorder: prima non c'è niente di nuovo da leggere. */
const OGNI_QUANTO_MS = 5 * 60_000;
/* Dopo una domanda andata male si aspetta: col socket giù il disegno
 * chiederebbe, fallirebbe, ridisegnerebbe, e richiederebbe a ogni giro. */
const DOPO_UN_ERRORE_MS = 60_000;
const ATTESA_MS = 30_000;
const H = 3600000;

/* ── cosa c'è da guardare ─────────────────────────────────────────────── */

function configurazione() {
  return readJson(CHIAVE_CONTATORI, {}) || {};
}

/** I contatori di casa, letti adesso dagli stati. */
export function contatoriInPlancia(states = allStates()) {
  return contatoriDiCasa(states, configurazione(), (entity) => nomeDaHomeAssistant(entity, states));
}

/** Se c'è almeno un contatore dichiarato. */
export function ciSonoContatori() {
  return contatoriConfigurati(configurazione());
}

/* Se in casa c'è qualcuno, dalle persone della sezione Persone: è la stessa
 * domanda — e la stessa risposta, `null` quando non si sa — delle telecamere
 * che si guardano solo a casa vuota (#81). */
function qualcunoInCasa(states) {
  return cEQualcunoInCasa(normalizePeople(readJson("cd_people", [])), states);
}

/**
 * Come stanno i contatori adesso: le righe lette e il giudizio di tutte
 * insieme. `dentro` toglie le entità che la tessera in Home non vuole.
 */
export function vistaDeiContatori(states = allStates(), { dentro } = {}) {
  const letture = contatoriInPlancia(states).filter(
    (lettura) => typeof dentro !== "function" || dentro(lettura.entity),
  );
  if (!letture.length) return null;
  const adesso = Date.now();
  return {
    letture,
    adesso,
    come: comeStannoIContatori(letture, state.dati || {}, {
      adesso,
      qualcunoInCasa: qualcunoInCasa(states),
    }),
  };
}

/* ── le domande al Recorder ───────────────────────────────────────────── */

function laTesseraSiVede() {
  if (!doc?.getElementById?.("page-home")?.classList?.contains("active")) return false;
  return Boolean(doc.querySelector?.(`.dm-tile[data-dm-widget="${CONTATORI_TAB}"]`));
}

/* Si chiede solo quando qualcuno guarda: la pagina aperta, o la Home con la
 * sua tessera. Un tablet appeso al muro sulla pagina delle luci non ha
 * bisogno dei metri cubi di ieri. */
function serveLeggere() {
  if (!planciaVisibile()) return false;
  const pagina = doc?.getElementById?.(CONTATORI_PAGE_ID);
  return Boolean(pagina?.classList.contains("active")) || laTesseraSiVede();
}

function chiedi(domanda) {
  return chiediAHomeAssistant(domanda, ATTESA_MS);
}

/* Cosa si chiede, per genere: i consumi dei contatori a un secchiello al
 * giorno; la storia della portata, che dice da quando scorre; le ore del
 * contatore quando una portata non c'è; e l'andamento del sale. */
async function leggiIlRecorder(letture, adesso) {
  const dati = { consumi: {}, ore: {}, portata: {}, sale: {} };
  const domande = [];
  const contatori = letture.filter((l) => l.genere === "acqua" || l.genere === "gas");
  if (contatori.length)
    domande.push(
      chiedi(
        domandaDeiConsumi(
          contatori.map((l) => l.entity),
          adesso,
        ),
      ).then((risposta) => {
        for (const l of contatori)
          dati.consumi[l.entity] = consumiDallaRisposta(risposta, l.entity, adesso);
      }),
    );
  const portate = letture.filter((l) => l.genere === "portata");
  for (const l of portate)
    domande.push(
      chiedi(domandaDellAvvio(l.entity, adesso, 24)).then((risposta) => {
        dati.portata[l.entity] = {
          righe: righeDellaStoria(risposta, l.entity),
          da: adesso - 24 * H,
        };
      }),
    );
  const acque = contatori.filter((l) => l.genere === "acqua");
  if (!portate.length && acque.length)
    domande.push(
      chiedi(
        domandaDelleOre(
          acque.map((l) => l.entity),
          adesso,
        ),
      ).then((risposta) => {
        for (const l of acque) dati.ore[l.entity] = oreDallaRisposta(risposta, l.entity);
      }),
    );
  const sali = letture.filter((l) => l.genere === "sale" && !saleInGiorni(l.unita));
  if (sali.length)
    domande.push(
      chiedi(
        domandaDelSale(
          sali.map((l) => l.entity),
          adesso,
        ),
      ).then(async (risposta) => {
        for (const l of sali) {
          const serie = serieDalleStatistiche(risposta, l.entity);
          if (serie.length) {
            dati.sale[l.entity] = serie;
            continue;
          }
          /* Un sensore senza `state_class` il Recorder non lo riassume: per
           * lui si legge la storia grezza di due settimane, che per un sale
           * che cambia qualche volta al giorno sono poche righe. */
          const storia = await chiedi(domandaDellAvvio(l.entity, adesso, 14 * 24)).catch(
            () => null,
          );
          dati.sale[l.entity] = serieDallaStoria(righeDellaStoria(storia, l.entity));
        }
      }),
    );
  const esiti = await Promise.allSettled(domande);
  if (esiti.length && esiti.every((esito) => esito.status === "rejected")) throw esiti[0].reason;
  return dati;
}

/* Quali portate scorrono adesso: quando una parte o si ferma, la storia chiesta
 * prima non basta più a dire da quando, e si richiede senza aspettare il
 * passo del Recorder. */
function firmaDellePortate(letture) {
  return letture
    .filter((l) => l.genere === "portata")
    .map((l) => `${l.entity}:${(l.valore ?? 0) > 0 ? 1 : 0}`)
    .join(",");
}

async function aggiornaIDati({ forza = false } = {}) {
  const letture = contatoriInPlancia();
  if (!letture.length || state.inVolo) return;
  const adesso = Date.now();
  const portate = firmaDellePortate(letture);
  /* Al più una volta al minuto, però: un sensore che balla fra zero e un
   * filo d'acqua cambierebbe la firma a ogni lettura, e ogni cambio sarebbe
   * una storia di ventiquattro ore chiesta al Recorder. */
  const cambiate =
    Boolean(state.dati) && portate !== state.scorrevano && adesso - state.chiestoAlle > 60_000;
  if (!forza && !cambiate) {
    if (state.dati && adesso - state.chiestoAlle < OGNI_QUANTO_MS) return;
    if (!state.dati && adesso - state.fallitoAlle < DOPO_UN_ERRORE_MS) return;
  }
  state.inVolo = true;
  state.chiestoAlle = adesso;
  state.scorrevano = portate;
  let riuscita = false;
  try {
    state.dati = await leggiIlRecorder(letture, adesso);
    state.fallitoAlle = 0;
    riuscita = true;
  } catch (errore) {
    /* Senza presa non si è chiesto niente a nessuno: la plancia si sta ancora
     * collegando, e l'annuncio che è pronta farà ridisegnare. Contarlo come un
     * errore vorrebbe dire una pagina aperta all'avvio con «—» per un minuto. */
    if (errore?.message === "socket") {
      state.chiestoAlle = 0;
      state.scorrevano = "";
    } else {
      state.fallitoAlle = Date.now();
      root.console?.warn?.("[DashboardModern] contatori", errore);
    }
  } finally {
    state.inVolo = false;
  }
  if (!riuscita) return;
  state.firma = "";
  schedule();
  root.dispatchEvent?.(new CustomEvent(EVENTO_CONTATORI));
}

/* Un appuntamento solo, al prossimo passo del Recorder: non un battito che
 * gira. Si prende dopo aver chiesto, e solo se qualcuno sta guardando. */
function prossimoGiro() {
  if (state.sveglia || !serveLeggere()) return;
  state.sveglia =
    root.setTimeout?.(() => {
      state.sveglia = 0;
      schedule();
    }, OGNI_QUANTO_MS) || 0;
}

/* ── la pagina e la sua voce nella barra ──────────────────────────────── */

function ultimaPagina() {
  const pagine = doc?.querySelectorAll?.(".page");
  return pagine?.length ? pagine[pagine.length - 1] : null;
}

export function ensureContatoriPage() {
  if (!doc) return null;
  let pagina = doc.getElementById(CONTATORI_PAGE_ID);
  if (pagina) return pagina;
  const sorella = ultimaPagina();
  if (!sorella?.parentElement) return null;
  pagina = doc.createElement("section");
  pagina.className = "page";
  pagina.id = CONTATORI_PAGE_ID;
  pagina.innerHTML = `<div class="dm-cont-wrap" id="contatori-wrap"></div>`;
  sorella.after(pagina);
  return pagina;
}

export function ensureContatoriTab() {
  if (!doc) return null;
  let voce = doc.querySelector(`.tab[data-tab="${CONTATORI_TAB}"]`);
  if (voce) return voce;
  const barra = doc.querySelector("nav.tabs");
  if (!barra) return null;
  /* Accanto all'irrigazione e alla piscina: sta con l'acqua di casa, come la
   * sua scheda sta nella famiglia «Clima e acqua» del Config. */
  const dopo =
    barra.querySelector('.tab[data-tab="irrigazione"]') ||
    barra.querySelector('.tab[data-tab="piscina"]') ||
    barra.querySelector('.tab[data-tab="energy"]') ||
    barra.querySelector('.tab[data-tab="home"]');
  voce = doc.createElement("button");
  voce.className = "tab";
  voce.dataset.tab = CONTATORI_TAB;
  voce.id = `tab-${CONTATORI_TAB}`;
  voce.innerHTML = `<span class="icon">💧</span><span class="text">${esc(t("Acqua e gas", "Water and gas"))}</span>`;
  voce.addEventListener("click", () => {
    for (const nodo of doc.querySelectorAll(".tab")) nodo.classList.remove("active");
    for (const nodo of doc.querySelectorAll(".page")) nodo.classList.remove("active");
    voce.classList.add("active");
    ensureContatoriPage()?.classList.add("active");
    const testata = doc.querySelector("header");
    if (testata) testata.style.display = "none";
    root.scrollTo?.({ top: 0, behavior: "instant" });
    if (root.navigator?.vibrate) root.navigator.vibrate(5);
    schedule();
  });
  if (dopo) dopo.after(voce);
  else barra.append(voce);
  return voce;
}

/* La voce si governa da sé, come i Varchi e le Batterie: c'è quando c'è una
 * riga dichiarata e nessuno l'ha spenta. */
function sezioneAccesa() {
  const sezioni = readJson("cd_sections", {});
  return !(sezioni && typeof sezioni === "object" && sezioni[CONTATORI_TAB] === false);
}

function accendiLaVoce() {
  const voce = ensureContatoriTab();
  if (!voce) return;
  const serve = segnaContenuto(CONTATORI_TAB, ciSonoContatori()) && sezioneAccesa();
  if (serve) voce.style.removeProperty("display");
  else voce.style.setProperty("display", "none", "important");
  const pagina = doc.getElementById(CONTATORI_PAGE_ID);
  if (!serve && pagina?.classList.contains("active"))
    doc.querySelector('.tab[data-tab="home"]')?.click();
}

/* ── le parole ────────────────────────────────────────────────────────── */

const SPAZIO = " ";

/** Un volume in litri detto come si pensa: litri sotto il metro cubo, metri cubi sopra. */
/* I decimali che dicono qualcosa: «74 m³», non «74,0 m³». Il decimale resta
 * quando c'è — «6,2 m³» — perché lì è la differenza fra un mese e l'altro. */
function cifreUtili(valore, cifre) {
  if (!cifre) return 0;
  const tondo = Math.round(valore * 10 ** cifre) / 10 ** cifre;
  return Number.isInteger(tondo) ? 0 : cifre;
}

export function volumeInParole(litri) {
  const come = comeSiDiceIlVolume(litri);
  if (!come) return "—";
  return `${formatNumber(come.valore, cifreUtili(come.valore, come.decimali))}${SPAZIO}${come.unita}`;
}

function metriCubiInParole(metri) {
  if (metri === null || metri === undefined) return "—";
  return `${formatNumber(metri, cifreUtili(metri, Math.abs(metri) < 100 ? 1 : 0))}${SPAZIO}m³`;
}

function euroInParole(valore) {
  return `${formatNumber(valore, 2)}${SPAZIO}€`;
}

function kwhInParole(valore) {
  return `${formatNumber(valore, cifreUtili(valore, Math.abs(valore) < 100 ? 1 : 0))}${SPAZIO}kWh`;
}

function barInParole(bar) {
  return `${formatNumber(bar, 1)}${SPAZIO}bar`;
}

function forcellaInParole(minimo, massimo) {
  const cifre = (valore) => (Number.isInteger(valore) ? 0 : 1);
  return `${formatNumber(minimo, cifre(minimo))} – ${formatNumber(massimo, cifre(massimo))}${SPAZIO}bar`;
}

function portataInParole(lettura) {
  if (lettura.muto) return "—";
  if (lettura.litriAlMinuto === null)
    return `${formatNumber(lettura.valore, 1)}${lettura.unita ? `${SPAZIO}${lettura.unita}` : ""}`;
  /* Un decimale solo sotto i dieci litri, e solo se c'è: «6 L/min», non
   * «6,0»; «0,4 L/min» per il filo d'acqua di un rubinetto che perde. */
  const valore = lettura.litriAlMinuto;
  const decimo = Math.round(valore * 10) / 10;
  return `${formatNumber(valore, valore < 10 && !Number.isInteger(decimo) ? 1 : 0)}${SPAZIO}L/min`;
}

function giorniInParole(giorni) {
  return giorni === 1
    ? `1${SPAZIO}${t("giorno", "day")}`
    : `${giorni}${SPAZIO}${t("giorni", "days")}`;
}

/** «214 litri oggi», o «6,2 m³ oggi» da un metro cubo in su. */
export function oggiInParole(litri) {
  if (litri === null || litri === undefined) return "—";
  if (Math.abs(litri) < 1000) {
    const quanti = formatNumber(Math.round(litri), 0);
    return t(`${quanti} litri oggi`, `${quanti} litres today`);
  }
  const quanti = formatNumber(litri / 1000, cifreUtili(litri / 1000, 1));
  return t(`${quanti} m³ oggi`, `${quanti} m³ today`);
}

/** «Scorre da 3 ore», dai minuti. */
export function scorreDaInParole(minuti) {
  const durata = quantoTempoInParole(minuti);
  return t(`Scorre da ${durata}`, `Flowing for ${durata}`);
}

function ieriInParole(quanto) {
  return t(`Ieri ${quanto}`, `Yesterday ${quanto}`);
}

function meseScorsoInParole(quanto) {
  return t(`Il mese scorso ${quanto}`, `Last month ${quanto}`);
}

function gasInParole(metri) {
  const quanti = formatNumber(metri, cifreUtili(metri, Math.abs(metri) < 100 ? 1 : 0));
  return t(`${quanti} m³ di gas`, `${quanti} m³ of gas`);
}

/* Quanto di una barra: questo periodo rispetto a quello di prima. Oggi contro
 * ieri intero, il mese contro il mese scorso intero: la barra dice «a che
 * punto sei», e piena vuol dire che hai già consumato quanto allora. */
function rapporto(adesso, prima) {
  if (adesso === null || adesso === undefined) return 0;
  if (prima === null || prima === undefined || prima <= 0) return adesso > 0 ? 100 : 0;
  return Math.max(0, Math.min(100, (adesso / prima) * 100));
}

/**
 * La risposta grande in cima: `{ stato, grande, nomi, sotto }`.
 *
 * L'ordine è quello dei guai: una perdita prima di tutto, poi la pressione
 * fuori forcella, poi — se va tutto bene — l'acqua di oggi, o il gas per chi
 * ha solo quello, o la lettura che c'è.
 */
export function testaDeiContatori(come, adesso = Date.now()) {
  const { acqua, gas } = come;
  if (come.perdita) {
    const perdita = come.perdita;
    let grande = scorreDaInParole(perdita.ore * 60);
    if (perdita.tipo === "contatore") grande = t("Mai ferma in 24 ore", "Never still in 24 hours");
    else if (perdita.certo === false)
      grande = t("Scorre da più di un giorno", "Flowing for over a day");
    return {
      stato: "perdita",
      grande,
      nomi: [
        t("Acqua", "Water"),
        come.nessunoInCasa ? t("e in casa non c'è nessuno", "and nobody is home") : "",
      ]
        .filter(Boolean)
        .join(" · "),
      sotto: acqua?.oggi !== null && acqua?.oggi !== undefined ? oggiInParole(acqua.oggi) : "",
    };
  }
  if (come.pressioneFuori) {
    const fuori = come.pressioneFuori;
    return {
      stato: "pressione",
      grande:
        fuori.verdetto === "low"
          ? t("Pressione bassa", "Low pressure")
          : t("Pressione alta", "High pressure"),
      nomi: `${t("Acqua", "Water")} · ${barInParole(fuori.bar)}`,
      sotto: `${t("ideale", "ideal")} ${forcellaInParole(fuori.minimo, fuori.massimo)}`,
    };
  }
  if (acqua) {
    return {
      stato: acqua.letto ? "bene" : "attesa",
      grande: oggiInParole(acqua.oggi),
      nomi: [
        t("Acqua", "Water"),
        gas?.oggi !== null && gas?.oggi !== undefined ? gasInParole(gas.oggi) : "",
      ]
        .filter(Boolean)
        .join(" · "),
      sotto: acqua.ieri !== null ? ieriInParole(volumeInParole(acqua.ieri)) : "",
    };
  }
  if (gas) {
    const quanti =
      gas.oggi === null
        ? ""
        : formatNumber(gas.oggi, cifreUtili(gas.oggi, Math.abs(gas.oggi) < 100 ? 1 : 0));
    return {
      stato: gas.letto ? "bene" : "attesa",
      grande: gas.oggi === null ? "—" : t(`${quanti} m³ oggi`, `${quanti} m³ today`),
      nomi: [t("Gas", "Gas"), gas.kwhOggi !== null ? kwhInParole(gas.kwhOggi) : ""]
        .filter(Boolean)
        .join(" · "),
      sotto: gas.ieri !== null ? ieriInParole(metriCubiInParole(gas.ieri)) : "",
    };
  }
  /* Senza contatori: la lettura che c'è, nell'ordine in cui si guarda. */
  const pressione = come.pressioni.find((voce) => voce.bar !== null);
  if (pressione)
    return {
      stato: "bene",
      grande: barInParole(pressione.bar),
      nomi: pressione.lettura.name,
      sotto: `${t("ideale", "ideal")} ${forcellaInParole(pressione.minimo, pressione.massimo)}`,
    };
  const sale = come.sali.find((voce) => voce.giorni !== null || voce.livello !== null);
  if (sale)
    return {
      stato: "bene",
      grande: sale.giorni !== null ? giorniInParole(sale.giorni) : `${Math.round(sale.livello)}%`,
      nomi: sale.lettura.name,
      sotto: sale.basso ? t("Da ricomprare", "Time to buy more") : "",
    };
  const portata = come.portate.find((voce) => !voce.lettura.muto);
  if (portata)
    return {
      stato: "bene",
      grande: portataInParole(portata.lettura),
      nomi: portata.lettura.name,
      sotto: parolaDellaPortata(portata, adesso),
    };
  return { stato: "attesa", grande: "—", nomi: "", sotto: "" };
}

function parolaDellaPortata(voce, adesso) {
  if (voce.lettura.muto) return t("Non risponde", "Not answering");
  if (voce.scorre === undefined) return "";
  if (!voce.scorre) return t("Non scorre", "Not flowing");
  if (voce.scorre.certo === false) return t("Scorre da più di un giorno", "Flowing for over a day");
  return scorreDaInParole((adesso - voce.scorre.quando) / 60000);
}

function parolaDelSale(voce) {
  if (voce.lettura.muto) return t("Non risponde", "Not answering");
  if (voce.basso) return t("Da ricomprare", "Time to buy more");
  if (voce.giorni !== null && voce.livello !== null && voce.lettura.unita === "%")
    return `${Math.round(voce.lettura.valore)}%`;
  if (voce.giorni !== null && voce.lettura.unita && !saleInGiorni(voce.lettura.unita))
    return `${formatNumber(voce.lettura.valore, 0)}${SPAZIO}${voce.lettura.unita}`;
  return "";
}

function valoreDelSale(voce) {
  if (voce.lettura.muto) return "—";
  if (voce.giorni !== null) return giorniInParole(voce.giorni);
  if (voce.livello !== null && voce.lettura.unita === "%") return `${Math.round(voce.livello)}%`;
  return `${formatNumber(voce.lettura.valore, 0)}${voce.lettura.unita ? `${SPAZIO}${voce.lettura.unita}` : ""}`;
}

/* ── il disegno ───────────────────────────────────────────────────────── */

/* Una riga come quelle delle Batterie: disegno, nome, barra, valore. La
 * didascalia sotto la barra dice con cosa si confronta. */
function rigaMarkup({ stato = "bene", icona, nome, barra = null, sotto = "", valore }) {
  return `<article class="dm-cont-riga" data-stato="${esc(stato)}">
    <span class="dm-cont-riga-ic" aria-hidden="true">${disegnoDiCasa(icona, { misura: 26, ripiego: "meter" })}</span>
    <div class="dm-cont-riga-testo">
      <strong>${esc(nome)}</strong>
      ${barra === null ? "" : `<span class="dm-cont-barra"><i style="width:${esc(String(Math.round(barra)))}%"></i></span>`}
      ${sotto ? `<small>${esc(sotto)}</small>` : ""}
    </div>
    <b class="dm-cont-riga-valore">${esc(valore)}</b>
  </article>`;
}

/* La pressione sulla barra a forcella della Piscina: stesse classi, stesso
 * foglio, e la stessa regola per la pista — la forcella nel terzo di mezzo. */
function forcellaDellaPressione(voce) {
  const { lettura, bar, minimo, massimo, verdetto } = voce;
  return forcellaMarkup({
    chiave: "pressione",
    etichetta: lettura.name,
    valore: bar,
    testo: barInParole(bar),
    minimo,
    massimo,
    verdetto,
    parola:
      verdetto === "low"
        ? t("troppo basso", "too low")
        : verdetto === "high"
          ? t("troppo alto", "too high")
          : t("nella norma", "in range"),
    forchetta: `${t("ideale", "ideal")} ${forcellaInParole(minimo, massimo)}`,
  });
}

function schedaMarkup(chiave, disegno, titolo, dentro) {
  if (!dentro) return "";
  return `<article class="dm-cont-scheda" data-dm-cont-scheda="${esc(chiave)}">
    <div class="dm-cont-scheda-testa">
      <span class="dm-cont-scheda-titolo"><i aria-hidden="true">${disegnoDiCasa(disegno, { misura: 22 })}</i>${esc(titolo)}</span>
    </div>
    ${dentro}
  </article>`;
}

function rigaDelMese(consumi, icona, comeSiDice) {
  const valore = [
    consumi.mese === null ? "—" : comeSiDice(consumi.mese),
    consumi.costoMese !== null ? euroInParole(consumi.costoMese) : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return rigaMarkup({
    icona,
    nome: t("Questo mese", "This month"),
    barra: consumi.letto ? rapporto(consumi.mese, consumi.meseScorso) : null,
    sotto: consumi.meseScorso !== null ? meseScorsoInParole(comeSiDice(consumi.meseScorso)) : "",
    valore,
  });
}

function schedaDellAcqua(come, adesso) {
  const forcelle = come.pressioni
    .filter((voce) => voce.bar !== null)
    .map(forcellaDellaPressione)
    .join("");
  const righe = [];
  /* Una pressione che non risponde non ha una forcella da disegnare: diventa
   * una riga smorta, come le batterie mute. */
  for (const voce of come.pressioni.filter((una) => una.bar === null))
    righe.push(
      rigaMarkup({
        stato: "muto",
        icona: voce.lettura.icon,
        nome: voce.lettura.name,
        sotto: t("Non risponde", "Not answering"),
        valore: "—",
      }),
    );
  if (come.acqua) righe.push(rigaDelMese(come.acqua, "calendar", volumeInParole));
  for (const voce of come.portate)
    righe.push(
      rigaMarkup({
        stato: voce.lettura.muto ? "muto" : voce.perdita?.perdita ? "allarme" : "bene",
        icona: voce.lettura.icon,
        nome: voce.lettura.name,
        sotto: parolaDellaPortata(voce, adesso),
        valore: portataInParole(voce.lettura),
      }),
    );
  for (const voce of come.sali)
    righe.push(
      rigaMarkup({
        stato: voce.lettura.muto ? "muto" : voce.basso ? "attenzione" : "bene",
        icona: voce.lettura.icon,
        nome: voce.lettura.name,
        barra: voce.livello,
        sotto: parolaDelSale(voce),
        valore: valoreDelSale(voce),
      }),
    );
  const dentro = `${forcelle ? `<div class="dm-cont-forcelle">${forcelle}</div>` : ""}${
    righe.length ? `<div class="dm-cont-righe">${righe.join("")}</div>` : ""
  }`;
  return schedaMarkup("acqua", "water", t("Acqua", "Water"), dentro);
}

function schedaDelGas(come) {
  const gas = come.gas;
  if (!gas) return "";
  const oggi = rigaMarkup({
    icona: gas.letture[0]?.icon || "flame",
    nome: t("Oggi", "Today"),
    barra: gas.letto ? rapporto(gas.oggi, gas.ieri) : null,
    sotto: gas.ieri !== null ? ieriInParole(metriCubiInParole(gas.ieri)) : "",
    valore: [metriCubiInParole(gas.oggi), gas.kwhOggi !== null ? kwhInParole(gas.kwhOggi) : ""]
      .filter(Boolean)
      .join(" · "),
  });
  const dentro = `<div class="dm-cont-righe">${oggi}${rigaDelMese(gas, "calendar", metriCubiInParole)}</div>`;
  return schedaMarkup("gas", "flame", t("Gas", "Gas"), dentro);
}

/* Il semaforo, quando qualcosa non va: ogni contatore una riga, come i
 * varchi — rosso chi è il guaio, verde chi sta bene, smorto chi non risponde.
 * Le schede coi numeri del mese tornano quando il guaio è passato: adesso
 * serve sapere cosa chiudere, non quanto è costato settembre. */
function semaforoMarkup(come, adesso) {
  const voci = [];
  const voce = ({ stato, icona, nome, sotto, valore }) =>
    `<article class="dm-cont-voce" data-stato="${esc(stato)}">
      <span class="dm-cont-voce-ic" aria-hidden="true">${disegnoDiCasa(icona, { misura: 30, ripiego: "meter" })}</span>
      <div class="dm-cont-voce-testo"><strong>${esc(nome)}</strong>${sotto ? `<small>${esc(sotto)}</small>` : ""}</div>
      <b class="dm-cont-voce-stato">${esc(valore)}</b>
    </article>`;
  const perdita = come.perdita;
  for (const lettura of come.acqua?.letture || []) {
    const colpevole = perdita?.tipo === "contatore" && perdita.lettura.entity === lettura.entity;
    voci.push(
      voce({
        stato: colpevole ? "allarme" : "bene",
        icona: lettura.icon,
        nome: lettura.name,
        sotto: colpevole ? t("Mai ferma in 24 ore", "Never still in 24 hours") : t("Oggi", "Today"),
        valore: volumeInParole(come.acqua.perContatore[lettura.entity]?.oggi ?? null),
      }),
    );
  }
  for (const una of come.portate)
    voci.push(
      voce({
        stato: una.lettura.muto ? "muto" : una.perdita?.perdita ? "allarme" : "bene",
        icona: una.lettura.icon,
        nome: una.lettura.name,
        sotto: parolaDellaPortata(una, adesso),
        valore: portataInParole(una.lettura),
      }),
    );
  for (const una of come.pressioni)
    voci.push(
      voce({
        stato: una.bar === null ? "muto" : una.verdetto === "ok" ? "bene" : "attenzione",
        icona: una.lettura.icon,
        nome: una.lettura.name,
        sotto:
          una.bar === null
            ? t("Non risponde", "Not answering")
            : una.verdetto === "low"
              ? t("troppo basso", "too low")
              : una.verdetto === "high"
                ? t("troppo alto", "too high")
                : t("nella norma", "in range"),
        valore: una.bar === null ? "—" : barInParole(una.bar),
      }),
    );
  for (const una of come.sali)
    voci.push(
      voce({
        stato: una.lettura.muto ? "muto" : una.basso ? "attenzione" : "bene",
        icona: una.lettura.icon,
        nome: una.lettura.name,
        sotto: parolaDelSale(una),
        valore: valoreDelSale(una),
      }),
    );
  for (const lettura of come.gas?.letture || [])
    voci.push(
      voce({
        stato: "bene",
        icona: lettura.icon,
        nome: lettura.name,
        sotto: t("Oggi", "Today"),
        valore: metriCubiInParole(come.gas.perContatore[lettura.entity]?.oggi ?? null),
      }),
    );
  return `<div class="dm-cont-elenco">${voci.join("")}</div>`;
}

function testaMarkup(testa) {
  return `<div class="dm-cont-testa" data-stato="${esc(testa.stato)}">
    <small>${esc(t("In questo momento", "Right now"))}</small>
    <strong>${esc(testa.grande)}</strong>
    ${testa.nomi ? `<span class="dm-cont-nomi">${esc(testa.nomi)}</span>` : ""}
    ${testa.sotto ? `<span class="dm-cont-sotto">${esc(testa.sotto)}</span>` : ""}
  </div>`;
}

function vuotoMarkup() {
  return `<div class="dm-cont-vuoto">
    <strong>${esc(t("Nessun contatore configurato", "No meter configured"))}</strong>
    <span>${esc(
      t(
        "Un contatore compare qui quando lo aggiungi nella scheda Acqua e gas della configurazione: i contatori dell'acqua e del gas, la pressione e la portata dell'acqua, il sale dell'addolcitore.",
        "A meter shows up here once you add it in the Water and gas tab of the settings: the water and gas meters, the water pressure and flow, the softener salt.",
      ),
    )}</span>
  </div>`;
}

/** La pagina intera, da quello che si sa adesso. */
export function paginaDeiContatori(vista) {
  if (!vista) return vuotoMarkup();
  const { come, adesso } = vista;
  const testa = testaDeiContatori(come, adesso);
  if (come.stato !== "normale") return `${testaMarkup(testa)}${semaforoMarkup(come, adesso)}`;
  const schede = `${schedaDellAcqua(come, adesso)}${schedaDelGas(come)}`;
  return `${testaMarkup(testa)}${schede ? `<div class="dm-cont-schede">${schede}</div>` : ""}`;
}

/* ── la tessera in Home ───────────────────────────────────────────────── */

/* Una riga della tessera per contatore: il numero che quel contatore dice
 * adesso, e il tono che lo colora. */
function rigaDellaTessera(lettura, come) {
  const riga = {
    entity: lettura.entity,
    name: lettura.name,
    glyph: disegnoDiCasa(lettura.icon, { misura: 20, ripiego: "meter" }),
    value: "—",
    tono: "quiete",
  };
  if (lettura.muto && lettura.genere !== "acqua" && lettura.genere !== "gas")
    return { ...riga, value: t("Non risponde", "Not answering"), tono: "" };
  if (lettura.genere === "acqua") {
    const colpevole =
      come.perdita?.tipo === "contatore" && come.perdita.lettura.entity === lettura.entity;
    return {
      ...riga,
      value: volumeInParole(come.acqua?.perContatore[lettura.entity]?.oggi ?? null),
      tono: colpevole ? "allarme" : "quiete",
    };
  }
  if (lettura.genere === "gas")
    return {
      ...riga,
      value: metriCubiInParole(come.gas?.perContatore[lettura.entity]?.oggi ?? null),
    };
  if (lettura.genere === "pressione") {
    const voce = come.pressioni.find((una) => una.lettura.entity === lettura.entity);
    return {
      ...riga,
      value: barInParole(lettura.bar),
      tono: voce?.verdetto === "ok" ? "quiete" : "acceso",
    };
  }
  if (lettura.genere === "portata") {
    const voce = come.portate.find((una) => una.lettura.entity === lettura.entity);
    return {
      ...riga,
      value: portataInParole(lettura),
      tono: voce?.perdita?.perdita ? "allarme" : voce?.scorre ? "acceso" : "quiete",
    };
  }
  const sale = come.sali.find((una) => una.lettura.entity === lettura.entity);
  return {
    ...riga,
    value: sale ? valoreDelSale(sale) : "—",
    tono: sale?.basso ? "acceso" : "quiete",
  };
}

/**
 * La tessera in Home, dalla stessa vista della pagina.
 *
 * Il numero grande è l'acqua di oggi — o il gas, per chi ha solo quello — e
 * la didascalia dice il resto; quando qualcosa non va, la didascalia è il guaio
 * con le stesse parole della pagina: «Scorre da 3 ore» detto in Home e taciuto
 * nella pagina, o il contrario, sarebbe peggio di non dirlo affatto.
 */
export function tesseraDeiContatori(vista) {
  if (!vista) return null;
  const { come, adesso } = vista;
  const testa = testaDeiContatori(come, adesso);
  const { acqua, gas } = come;
  let value = "—";
  if (acqua?.oggi !== null && acqua?.oggi !== undefined) value = volumeInParole(acqua.oggi);
  else if (gas?.oggi !== null && gas?.oggi !== undefined) value = metriCubiInParole(gas.oggi);
  else if (!acqua && !gas && come.stato === "normale") value = testa.grande;
  const caption =
    come.stato !== "normale"
      ? testa.grande
      : [
          acqua && gas?.oggi !== null && gas?.oggi !== undefined ? gasInParole(gas.oggi) : "",
          testa.sotto,
        ]
          .filter(Boolean)
          .join(" · ") || testa.nomi;
  return {
    key: CONTATORI_TAB,
    accent:
      come.stato === "perdita" ? "#dc2626" : come.stato === "pressione" ? "#f59e0b" : "#0ea5e9",
    icon: "💧",
    label: t("Acqua e gas", "Water and gas"),
    value,
    caption,
    ring: null,
    attiva: come.stato !== "normale" || come.saleBasso,
    alert: come.stato === "perdita",
    rows: vista.letture.map((lettura) => rigaDellaTessera(lettura, come)),
  };
}

function dipingi() {
  const pagina = ensureContatoriPage();
  const dove = pagina?.querySelector?.("#contatori-wrap");
  if (!dove) return;
  /* A pagina chiusa non si disegna: la voce nella barra si accende comunque,
   * ed è l'unica cosa che si vede da fuori. */
  if (!paginaVisibile(CONTATORI_PAGE_ID)) return;
  const markup = paginaDeiContatori(vistaDeiContatori());
  /* La firma è il disegno stesso: «scorre da 25 minuti» lo cambia l'orologio,
   * non lo stato, e una firma fatta dei soli stati lo lascerebbe fermo. */
  if (state.firma === markup && dove.firstElementChild) return;
  state.firma = markup;
  dove.innerHTML = markup;
}

function schedule() {
  if (state.frame) return;
  const giro = () => {
    state.frame = 0;
    try {
      accendiLaVoce();
      dipingi();
      if (serveLeggere()) {
        aggiornaIDati();
        prossimoGiro();
      }
    } catch (error) {
      root.console?.warn?.("[DashboardModern] contatori", error);
    }
  };
  state.frame = root.requestAnimationFrame?.(giro) || 0;
  if (!state.frame) giro();
}

/** Ridisegna adesso, saltando la firma: la usa chi cambia la configurazione. */
export function renderContatori() {
  state.firma = "";
  /* Righe nuove vogliono numeri nuovi: quelli di prima erano di altre
   * entità, e aspettare il passo del Recorder vorrebbe dire una riga appena
   * aggiunta con «—» per cinque minuti. */
  state.chiestoAlle = 0;
  schedule();
}

/* ── il foglio ────────────────────────────────────────────────────────── */

/* Le regole sono copie di quelle dei Varchi, delle Batterie e delle schede
 * della Piscina, legate a questa pagina. Una pagina che prendesse in prestito
 * le regole di un'altra si romperebbe il giorno che quell'altra cambia; la
 * forcella no — quella è di tutti, e sta nel foglio della Piscina apposta. */
function installStyles() {
  const P = `#${CONTATORI_PAGE_ID}`;
  installStyle(
    "dm-contatori-section-style",
    `
    ${P} .dm-cont-wrap{display:grid;gap:14px;padding:0 0 24px}
    ${P} .dm-cont-vuoto{display:grid;gap:6px;padding:22px 18px;text-align:center;
      border:1px dashed var(--divider-color,#dbe4ee);border-radius:18px;background:var(--card-bg,#fff)}
    ${P} .dm-cont-vuoto strong{font-size:14px;font-weight:900}
    ${P} .dm-cont-vuoto span{font-size:12px;font-weight:700;color:var(--secondary-text-color,#64748b)}

    /* La risposta grande, come quella dei Varchi. */
    ${P} .dm-cont-testa{
      display:grid;gap:4px;padding:20px 22px;border-radius:22px;
      border:1px solid var(--card-border,#e2e8f0);background:var(--card-bg,#fff);
      box-shadow:var(--shadow-glass,0 8px 30px rgba(0,0,0,.06))}
    ${P} .dm-cont-testa small{
      font-size:10.5px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;
      color:var(--text-dim,#64748b)}
    ${P} .dm-cont-testa strong{font-size:30px;font-weight:900;line-height:1.05;color:var(--text,#0f172a)}
    ${P} .dm-cont-testa[data-stato="perdita"] strong{color:#dc2626}
    ${P} .dm-cont-testa[data-stato="pressione"] strong{color:#b45309}
    ${P} .dm-cont-testa[data-stato="bene"] strong{color:#15803d}
    ${P} .dm-cont-nomi{font-size:13px;font-weight:800;color:var(--text,#0f172a)}
    ${P} .dm-cont-sotto{font-size:12px;font-weight:700;color:var(--text-dim,#64748b)}

    /* Le schede, come quelle della Piscina. */
    ${P} .dm-cont-schede{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(298px,100%),1fr));gap:12px;align-items:start}
    ${P} .dm-cont-scheda{box-sizing:border-box;display:grid;gap:12px;padding:16px;
      border:1px solid var(--card-border,#dbe4ee);border-radius:22px;background:var(--card-bg,#fff);
      box-shadow:var(--shadow-sculpted,0 6px 18px rgba(15,23,42,.07))}
    ${P} .dm-cont-scheda-testa{display:flex;align-items:center;justify-content:space-between;gap:10px}
    ${P} .dm-cont-scheda-titolo{display:flex;align-items:center;gap:8px;color:var(--text,#0f172a);font-size:14px;font-weight:900}
    ${P} .dm-cont-scheda-titolo i{font-style:normal;display:grid;place-items:center;line-height:0}
    ${P} .dm-cont-scheda-titolo svg{display:block;width:22px;height:22px}
    ${P} .dm-cont-forcelle{display:grid;gap:14px}
    ${P} .dm-cont-righe{display:grid;gap:10px}

    /* Le righe, come quelle delle Batterie, con la didascalia sotto la barra. */
    ${P} .dm-cont-riga{
      --dm-cont:#10b981;
      display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:12px;
      padding:12px 14px;border-radius:18px;
      border:1px solid color-mix(in srgb,var(--dm-cont) 34%,var(--card-border,rgba(0,0,0,.08)));
      background:var(--card-bg,#fff)}
    ${P} .dm-cont-riga[data-stato="attenzione"]{--dm-cont:#f59e0b}
    ${P} .dm-cont-riga[data-stato="allarme"]{--dm-cont:#dc2626}
    ${P} .dm-cont-riga[data-stato="muto"]{--dm-cont:#94a3b8;opacity:.72}
    ${P} .dm-cont-riga-ic .dm-catalogo-art{display:grid;place-items:center;line-height:0}
    ${P} .dm-cont-riga-ic svg{display:block;width:26px;height:26px}
    ${P} .dm-cont-riga-ic{display:grid;place-items:center;width:38px;height:38px;border-radius:12px;
      font-size:19px;background:color-mix(in srgb,var(--dm-cont) 20%,transparent)}
    ${P} .dm-cont-riga-testo{display:grid;gap:3px;min-width:0}
    ${P} .dm-cont-riga-testo strong{font-size:14px;font-weight:900;color:var(--text,#0f172a);
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    /* La didascalia va a capo invece di tagliarsi: «Il mese scorso 118 …»
       toglieva proprio il numero con cui ci si confronta. */
    ${P} .dm-cont-riga-testo small{font-size:10.5px;font-weight:700;line-height:1.3;
      color:var(--text-dim,#64748b);overflow-wrap:anywhere}
    ${P} .dm-cont-barra{display:block;height:5px;border-radius:999px;margin-top:2px;
      background:color-mix(in srgb,var(--dm-cont) 16%,transparent);overflow:hidden}
    ${P} .dm-cont-barra i{display:block;height:100%;border-radius:999px;background:var(--dm-cont)}
    ${P} .dm-cont-riga-valore{font-size:15px;font-weight:900;font-variant-numeric:tabular-nums;
      text-align:right;color:color-mix(in srgb,var(--dm-cont) 78%,var(--text,#0f172a))}

    /* Il semaforo, come le carte dei Varchi. */
    ${P} .dm-cont-elenco{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(260px,100%),1fr));gap:10px}
    ${P} .dm-cont-voce{
      display:grid;grid-template-columns:44px minmax(0,1fr) auto;align-items:center;gap:12px;
      padding:14px 16px;border-radius:18px;
      border:1px solid color-mix(in srgb,var(--dm-cont,#94a3b8) 42%,transparent);
      background:color-mix(in srgb,var(--dm-cont,#94a3b8) 10%,var(--card-bg,#fff))}
    ${P} .dm-cont-voce[data-stato="allarme"]{--dm-cont:#dc2626}
    ${P} .dm-cont-voce[data-stato="attenzione"]{--dm-cont:#f59e0b}
    ${P} .dm-cont-voce[data-stato="bene"]{--dm-cont:#16a34a}
    ${P} .dm-cont-voce[data-stato="muto"]{--dm-cont:#94a3b8}
    ${P} .dm-cont-voce-ic{
      display:grid;place-items:center;width:44px;height:44px;border-radius:14px;font-size:20px;
      background:color-mix(in srgb,var(--dm-cont,#94a3b8) 22%,transparent)}
    ${P} .dm-cont-voce-ic .dm-catalogo-art{display:grid;place-items:center;line-height:0}
    ${P} .dm-cont-voce-ic svg{display:block;width:30px;height:30px}
    ${P} .dm-cont-voce-testo{display:grid;gap:2px;min-width:0}
    ${P} .dm-cont-voce-testo strong{font-size:14px;font-weight:900;color:var(--text,#0f172a);
      display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2;
      overflow:hidden;overflow-wrap:anywhere;line-height:1.25}
    ${P} .dm-cont-voce-testo small{font-size:10.5px;font-weight:700;color:var(--text-dim,#64748b);
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    ${P} .dm-cont-voce-stato{
      font-size:11px;font-weight:900;letter-spacing:.03em;text-transform:uppercase;
      max-width:96px;text-align:right;line-height:1.25;
      color:color-mix(in srgb,var(--dm-cont,#94a3b8) 78%,var(--text,#0f172a))}

    @media(max-width:520px){
      ${P} .dm-cont-elenco,${P} .dm-cont-schede{grid-template-columns:minmax(0,1fr)}}
    `,
  );
}

export function installContatori() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  ensureContatoriPage();
  ensureContatoriTab();
  for (const nome of ["render", "cdApplyNavVis"]) {
    const precedente = root[nome];
    if (typeof precedente !== "function" || precedente.__dmContatori) continue;
    const avvolta = function (...args) {
      const esito = precedente.apply(this, args);
      schedule();
      return esito;
    };
    avvolta.__dmContatori = true;
    avvolta.__dmPrevious = precedente;
    root[nome] = avvolta;
  }
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:state-changed",
    "dashboardmodern:persistence-restored",
    /* La tessera in Home c'è solo dopo che la Home si è dipinta: è lì che si
     * sa se qualcuno la sta guardando. */
    "dashboardmodern:widgets-painted",
  ])
    root.addEventListener?.(evento, schedule);
  doc.addEventListener?.("visibilitychange", schedule);
  quandoSiCambiaPagina(schedule);
  schedule();
  return true;
}

senzaCadere(installContatori);
