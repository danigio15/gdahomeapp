/* La pagina delle piante: la terra, e quando innaffiare (#159).
 *
 * «Servirebbe a monitorare i sensori umidità e temperatura suolo. Impostando
 * una soglia minima ti avverte quando è ora di innaffiare, oppure anche se è
 * ora di innaffiare ma è prevista pioggia a breve eviti di farlo.»
 *
 * Fatta coi pezzi delle altre pagine, come nel render che si è visto prima di
 * scriverla:
 *
 *   · in cima la risposta grande, il riquadro «In questo momento» dei Varchi:
 *     quante sono da innaffiare, o che ci pensa la pioggia, o che stanno bene;
 *   · sotto l'elenco a semaforo dei Varchi, una pianta per riga: rossa se è
 *     asciutta, tratteggiata se aspetta la pioggia, verde se sta bene;
 *   · e per ogni pianta la sua scheda, con la barra a forcella della Piscina
 *     per l'umidità della terra e, quando c'è, per la sua temperatura.
 *
 * Qui non si comanda niente: una pianta si guarda, e poi si innaffia a mano —
 * la issue lo dice, è per chi un impianto non ce l'ha. Le medie delle ultime
 * ore e le previsioni si chiedono a Home Assistant quando la pagina o la sua
 * tessera si vedono, al più ogni mezz'ora: la terra si asciuga in giorni, e le
 * previsioni cambiano due volte al giorno.
 */
import {
  CHIAVE_PIANTE,
  TERRA_CALDA,
  TERRA_FREDDA,
  comeStannoLePiante,
  domandaDellaTerra,
  domandaDellePrevisioni,
  pianteConfigurate,
  pianteDiCasa,
  pioggiaInArrivo,
  previsioniDallaRisposta,
  serieDellaTerra,
} from "../core/le-piante-di-casa.js";
import { entitaDelMeteo } from "./la-card-del-meteo-section.js";
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
} from "./shared.js";
import { nomeDaHomeAssistant } from "./editor-slots-section.js";

const KEY = "__DASHBOARDMODERN_PIANTE__";
const state = (root[KEY] ||= {
  installed: false,
  frame: 0,
  firma: "",
  sveglia: 0,
  dati: null,
  inVolo: false,
  chiestoAlle: 0,
  fallitoAlle: 0,
});

export const PIANTE_PAGE_ID = "page-piante";
export const PIANTE_TAB = "piante";

/* L'avviso che le medie e le previsioni sono arrivate: la tessera in Home lo
 * ascolta, perché la risposta atterra quando la Home si è già disegnata. */
export const EVENTO_PIANTE = "dashboardmodern:piante-lette";

/* Mezz'ora: la terra si asciuga in giorni, e le previsioni cambiano due volte
 * al giorno. Chiedere più spesso sarebbe lavoro per il Recorder in cambio di
 * niente. */
const OGNI_QUANTO_MS = 30 * 60_000;
const DOPO_UN_ERRORE_MS = 60_000;
const ATTESA_MS = 30_000;

/* ── cosa c'è da guardare ─────────────────────────────────────────────── */

function configurazione() {
  return readJson(CHIAVE_PIANTE, {}) || {};
}

/** Le piante di casa, lette adesso dagli stati. */
export function pianteInPlancia(states = allStates()) {
  return pianteDiCasa(states, configurazione(), (entity) => nomeDaHomeAssistant(entity, states));
}

/** Se c'è almeno una pianta dichiarata. */
export function ciSonoPiante() {
  return pianteConfigurate(configurazione());
}

/**
 * Come stanno le piante adesso: le righe lette e il giudizio di tutte insieme.
 * `dentro` toglie le entità che la tessera in Home non vuole.
 */
export function vistaDellePiante(states = allStates(), { dentro } = {}) {
  const letture = pianteInPlancia(states).filter(
    (lettura) => typeof dentro !== "function" || dentro(lettura.entity),
  );
  if (!letture.length) return null;
  return { letture, adesso: Date.now(), come: comeStannoLePiante(letture, state.dati || {}) };
}

/* ── le domande a Home Assistant ──────────────────────────────────────── */

function laTesseraSiVede() {
  if (!doc?.getElementById?.("page-home")?.classList?.contains("active")) return false;
  return Boolean(doc.querySelector?.(`.dm-tile[data-dm-widget="${PIANTE_TAB}"]`));
}

/* Si chiede solo quando qualcuno guarda: la pagina aperta, o la Home con la
 * sua tessera. */
function serveLeggere() {
  if (!planciaVisibile()) return false;
  const pagina = doc?.getElementById?.(PIANTE_PAGE_ID);
  return Boolean(pagina?.classList.contains("active")) || laTesseraSiVede();
}

function chiedi(domanda) {
  return chiediAHomeAssistant(domanda, ATTESA_MS);
}

/* Le previsioni del meteo di casa: prima per ora, che dicono fra quanto piove;
 * chi non le ha risponde con quelle del giorno; e chi non ha il servizio —
 * Home Assistant di prima del 2024 — le teneva negli attributi. */
async function lePrevisioni(entita, states) {
  for (const tipo of ["hourly", "daily"]) {
    try {
      const previsioni = previsioniDallaRisposta(
        await chiedi(domandaDellePrevisioni(entita, tipo)),
        entita,
      );
      if (previsioni.length) return previsioni;
    } catch (errore) {
      if (errore?.message === "socket") throw errore;
    }
  }
  const vecchie = states?.[entita]?.attributes?.forecast;
  return Array.isArray(vecchie) ? vecchie : [];
}

async function leggiLaCasa(letture, adesso) {
  const dati = { serie: {}, pioggia: null };
  const states = allStates();
  const domande = [
    chiedi(
      domandaDellaTerra(
        letture.map((lettura) => lettura.entity),
        adesso,
      ),
    ).then((risposta) => {
      for (const lettura of letture)
        dati.serie[lettura.entity] = serieDellaTerra(risposta, lettura.entity);
    }),
  ];
  /* La pioggia serve solo a chi sta fuori: una casa con le piante tutte in
   * salotto non chiede le previsioni a nessuno. */
  const meteo = letture.some((lettura) => lettura.fuori) ? entitaDelMeteo(states) : "";
  if (meteo)
    domande.push(
      lePrevisioni(meteo, states).then((previsioni) => {
        dati.pioggia = pioggiaInArrivo(previsioni, {
          adesso,
          unita: states?.[meteo]?.attributes?.precipitation_unit || "mm",
        });
      }),
    );
  const esiti = await Promise.allSettled(domande);
  if (esiti.every((esito) => esito.status === "rejected")) throw esiti[0].reason;
  return dati;
}

async function aggiornaIDati({ forza = false } = {}) {
  const letture = pianteInPlancia();
  /* Nessuna pianta risponde: di solito gli stati non sono ancora arrivati. Il
   * meteo di casa si trova fra gli stati, e chiedere adesso vorrebbe dire
   * chiedere senza previsioni e tenersi quella risposta per mezz'ora: l'orto
   * asciutto chiederebbe acqua mentre sta per piovere. */
  if (!letture.length || letture.every((lettura) => lettura.muta) || state.inVolo) return;
  const adesso = Date.now();
  if (!forza) {
    if (state.dati && adesso - state.chiestoAlle < OGNI_QUANTO_MS) return;
    if (!state.dati && adesso - state.fallitoAlle < DOPO_UN_ERRORE_MS) return;
  }
  state.inVolo = true;
  state.chiestoAlle = adesso;
  let riuscita = false;
  try {
    state.dati = await leggiLaCasa(letture, adesso);
    state.fallitoAlle = 0;
    riuscita = true;
  } catch (errore) {
    /* Senza presa non si è chiesto niente a nessuno: la plancia si sta ancora
     * collegando, e l'annuncio che è pronta farà ridisegnare. */
    if (errore?.message === "socket") state.chiestoAlle = 0;
    else {
      state.fallitoAlle = Date.now();
      root.console?.warn?.("[DashboardModern] piante", errore);
    }
  } finally {
    state.inVolo = false;
  }
  if (!riuscita) return;
  state.firma = "";
  schedule();
  root.dispatchEvent?.(new CustomEvent(EVENTO_PIANTE));
}

/* Un appuntamento solo, alla prossima mezz'ora: non un battito che gira. */
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

export function ensurePiantePage() {
  if (!doc) return null;
  let pagina = doc.getElementById(PIANTE_PAGE_ID);
  if (pagina) return pagina;
  const sorella = ultimaPagina();
  if (!sorella?.parentElement) return null;
  pagina = doc.createElement("section");
  pagina.className = "page";
  pagina.id = PIANTE_PAGE_ID;
  pagina.innerHTML = `<div class="dm-pian-wrap" id="piante-wrap"></div>`;
  sorella.after(pagina);
  return pagina;
}

export function ensurePianteTab() {
  if (!doc) return null;
  let voce = doc.querySelector(`.tab[data-tab="${PIANTE_TAB}"]`);
  if (voce) return voce;
  const barra = doc.querySelector("nav.tabs");
  if (!barra) return null;
  /* Accanto all'irrigazione: è la stessa domanda — quando dare l'acqua — per
   * chi un impianto non ce l'ha. */
  const dopo =
    barra.querySelector('.tab[data-tab="irrigazione"]') ||
    barra.querySelector('.tab[data-tab="piscina"]') ||
    barra.querySelector('.tab[data-tab="home"]');
  voce = doc.createElement("button");
  voce.className = "tab";
  voce.dataset.tab = PIANTE_TAB;
  voce.id = `tab-${PIANTE_TAB}`;
  voce.innerHTML = `<span class="icon">🪴</span><span class="text">${esc(t("Piante", "Plant care"))}</span>`;
  voce.addEventListener("click", () => {
    for (const nodo of doc.querySelectorAll(".tab")) nodo.classList.remove("active");
    for (const nodo of doc.querySelectorAll(".page")) nodo.classList.remove("active");
    voce.classList.add("active");
    ensurePiantePage()?.classList.add("active");
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

/* La voce si governa da sé, come quella dell'acqua e del gas: c'è quando c'è
 * una pianta dichiarata e nessuno l'ha spenta. */
function sezioneAccesa() {
  const sezioni = readJson("cd_sections", {});
  return !(sezioni && typeof sezioni === "object" && sezioni[PIANTE_TAB] === false);
}

function accendiLaVoce() {
  const voce = ensurePianteTab();
  if (!voce) return;
  const serve = ciSonoPiante() && sezioneAccesa();
  if (serve) voce.style.removeProperty("display");
  else voce.style.setProperty("display", "none", "important");
  const pagina = doc.getElementById(PIANTE_PAGE_ID);
  if (!serve && pagina?.classList.contains("active"))
    doc.querySelector('.tab[data-tab="home"]')?.click();
}

/* ── le parole ────────────────────────────────────────────────────────── */

const SPAZIO = " ";

function percento(valore) {
  return `${Math.round(valore)}${SPAZIO}%`;
}

function gradiInParole(valore) {
  return `${formatNumber(valore, 1)}${SPAZIO}°C`;
}

function millimetri(valore) {
  const decimali = valore < 10 && Math.round(valore) !== valore ? 1 : 0;
  return `${formatNumber(valore, decimali)}${SPAZIO}mm`;
}

/* Le ore e i giorni stanno dentro la frase, e l'uno ha la sua: «fra 1 ore» e
 * «1 giorni fa» si leggono subito, e «in 3 Tage» pure — il numero messo accanto
 * a una parola tradotta a parte non si accorda in nessuna lingua. */

/** «Piove fra 4 ore: 8 mm», o quanta ne arriva oggi quando le ore non si sanno. */
export function pioggiaInParole(pioggia) {
  if (!pioggia) return "";
  const quanta = millimetri(pioggia.mm);
  if (pioggia.giornaliera)
    return t(`Oggi pioggia prevista: ${quanta}`, `Rain expected today: ${quanta}`);
  if (!pioggia.fra) return t(`Sta per piovere: ${quanta}`, `Rain on its way: ${quanta}`);
  const ore = Math.round(pioggia.fra);
  if (ore <= 1) return t(`Piove entro un'ora: ${quanta}`, `Rain within the hour: ${quanta}`);
  return t(`Piove fra ${ore} ore: ${quanta}`, `Rain in ${ore} hours: ${quanta}`);
}

function terraInParole(lettura) {
  const quanto = percento(lettura.umidita);
  return t(`Terra al ${quanto}`, `Soil at ${quanto}`);
}

function ultimaAcquaInParole(quando, adesso) {
  const ore = Math.floor((adesso - quando) / 3_600_000);
  if (ore < 1) return t("ultima acqua poco fa", "watered just now");
  if (ore === 1) return t("ultima acqua un'ora fa", "last watered an hour ago");
  if (ore < 24) return t(`ultima acqua ${ore} ore fa`, `last watered ${ore} hours ago`);
  const giorni = Math.floor(ore / 24);
  if (giorni === 1) return t("ultima acqua un giorno fa", "last watered a day ago");
  return t(`ultima acqua ${giorni} giorni fa`, `last watered ${giorni} days ago`);
}

function fraGiorniInParole(giorni) {
  /* Zero giorni è «prima di domani», al passo di adesso: non «fra 0 giorni». */
  if (giorni < 1) return t("acqua a breve", "needs water soon");
  if (giorni === 1) return t("acqua fra un giorno", "needs water in a day");
  return t(`acqua fra ${giorni} giorni`, `needs water in ${giorni} days`);
}

/** La riga sotto il nome di una pianta: cosa si sa della sua terra. */
export function didascaliaDellaPianta(pianta, adesso = Date.now()) {
  if (pianta.stato === "muta") return "";
  if (pianta.stato === "aspetta") return pioggiaInParole(pianta.pioggia);
  const pezzi = [terraInParole(pianta.lettura)];
  if (pianta.stato === "bene" && pianta.giorni !== null)
    pezzi.push(fraGiorniInParole(pianta.giorni));
  else if (pianta.ultimaAcqua !== null) pezzi.push(ultimaAcquaInParole(pianta.ultimaAcqua, adesso));
  return pezzi.join(" · ");
}

/** La parola in fondo alla riga, come «Aperto» e «Chiuso» nei Varchi. */
export function parolaDellaPianta(stato) {
  if (stato === "asciutta") return t("Asciutta", "Dry soil");
  if (stato === "aspetta") return t("Aspetta", "Waiting");
  if (stato === "bene") return t("Sta bene", "Doing well");
  return t("Non risponde", "Not answering");
}

function quanteStannoBene(quante) {
  return quante === 1
    ? t("1 sta bene", "1 doing well")
    : t(`${quante} stanno bene`, `${quante} doing well`);
}

function quanteAspettano(quante) {
  return quante === 1
    ? t("1 aspetta la pioggia", "1 waiting for rain")
    : t(`${quante} aspettano la pioggia`, `${quante} waiting for rain`);
}

function quanteMute(quante) {
  return quante === 1
    ? t("1 non risponde", "1 not answering")
    : `${quante} ${t("non rispondono", "not answering")}`;
}

/**
 * La risposta grande in cima: `{ stato, grande, nomi, sotto }`.
 *
 * Quante sono da innaffiare, prima di tutto. Se nessuna, ma qualcuna è
 * asciutta e la pioggia sta arrivando: ci pensa la pioggia. Se stanno tutte
 * bene, quale toccherà per prima.
 */
export function testaDellePiante(come) {
  const conti = (senza) =>
    [
      senza !== "bene" && come.bene.length ? quanteStannoBene(come.bene.length) : "",
      senza !== "aspetta" && come.aspettano.length ? quanteAspettano(come.aspettano.length) : "",
      come.mute.length ? quanteMute(come.mute.length) : "",
    ]
      .filter(Boolean)
      .join(" · ");
  const nomi = (piante) => piante.map((pianta) => pianta.lettura.name).join(" · ");
  if (come.daInnaffiare.length) {
    const quante = come.daInnaffiare.length;
    return {
      stato: "sete",
      grande:
        quante === 1
          ? t("1 da innaffiare", "1 needs water")
          : t(`${quante} da innaffiare`, `${quante} need water`),
      nomi: nomi(come.daInnaffiare),
      sotto: conti(""),
    };
  }
  if (come.aspettano.length)
    return {
      stato: "pioggia",
      grande: t("Ci pensa la pioggia", "The rain will see to it"),
      nomi: nomi(come.aspettano),
      sotto: [pioggiaInParole(come.pioggia), conti("aspetta")].filter(Boolean).join(" · "),
    };
  if (come.bene.length)
    return {
      stato: "bene",
      grande: t("Stanno tutte bene", "All doing well"),
      nomi: come.prossima
        ? `${come.prossima.lettura.name} · ${fraGiorniInParole(come.prossima.giorni)}`
        : "",
      sotto: come.mute.length ? quanteMute(come.mute.length) : "",
    };
  return { stato: "attesa", grande: t("Nessuna risponde", "None answering"), nomi: "", sotto: "" };
}

/* ── il disegno ───────────────────────────────────────────────────────── */

function testaMarkup(testa) {
  return `<div class="dm-pian-testa" data-stato="${esc(testa.stato)}">
    <small>${esc(t("In questo momento", "Right now"))}</small>
    <strong>${esc(testa.grande)}</strong>
    ${testa.nomi ? `<span class="dm-pian-nomi">${esc(testa.nomi)}</span>` : ""}
    ${testa.sotto ? `<span class="dm-pian-sotto">${esc(testa.sotto)}</span>` : ""}
  </div>`;
}

/* Una pianta per riga, come i contatti dei Varchi: il colore lo dice prima
 * della parola. Quella che aspetta la pioggia è tratteggiata come il varco
 * escluso dall'antifurto: è a posto, ma per una ragione che va detta. */
function rigaMarkup(pianta, adesso) {
  const sotto = didascaliaDellaPianta(pianta, adesso);
  return `<article class="dm-pian-voce" data-stato="${esc(pianta.stato)}">
    <span class="dm-pian-voce-ic" aria-hidden="true">${disegnoDiCasa(pianta.lettura.icon, { misura: 30, ripiego: "plant" })}</span>
    <div class="dm-pian-voce-testo"><strong>${esc(pianta.lettura.name)}</strong>${
      sotto ? `<small>${esc(sotto)}</small>` : ""
    }</div>
    <b class="dm-pian-voce-stato">${esc(parolaDellaPianta(pianta.stato))}</b>
  </article>`;
}

/* La scheda di una pianta, come quelle della Piscina: la terra sulla sua
 * forcella, e la temperatura quando c'è il sensore. */
function schedaMarkup(pianta) {
  const { lettura } = pianta;
  if (lettura.muta) return "";
  const terra = forcellaMarkup({
    chiave: "terra",
    etichetta: t("Umidità della terra", "Soil moisture"),
    valore: lettura.umidita,
    testo: percento(lettura.umidita),
    minimo: lettura.minimo,
    massimo: lettura.massimo,
    verdetto: pianta.terra,
    parola:
      pianta.terra === "low"
        ? t("da innaffiare", "needs water")
        : pianta.terra === "high"
          ? t("troppa acqua", "too wet")
          : t("nella norma", "in range"),
    forchetta: `${t("ideale", "ideal")} ${lettura.minimo} – ${lettura.massimo}${SPAZIO}%`,
  });
  const caldo =
    lettura.gradi === null
      ? ""
      : forcellaMarkup({
          chiave: "caldo",
          etichetta: t("Temperatura della terra", "Soil temperature"),
          valore: lettura.gradi,
          testo: gradiInParole(lettura.gradi),
          minimo: TERRA_FREDDA,
          massimo: TERRA_CALDA,
          verdetto: pianta.caldo,
          parola:
            pianta.caldo === "low"
              ? t("troppo basso", "too low")
              : pianta.caldo === "high"
                ? t("troppo alto", "too high")
                : t("nella norma", "in range"),
          forchetta: `${t("ideale", "ideal")} ${TERRA_FREDDA} – ${TERRA_CALDA}${SPAZIO}°C`,
        });
  return `<article class="dm-pian-scheda" data-dm-pian-scheda="${esc(lettura.entity)}">
    <div class="dm-pian-scheda-testa">
      <span class="dm-pian-scheda-titolo"><i aria-hidden="true">${disegnoDiCasa(lettura.icon, { misura: 22, ripiego: "plant" })}</i>${esc(lettura.name)}</span>
    </div>
    <div class="dm-pian-forcelle">${terra}${caldo}</div>
  </article>`;
}

function vuotoMarkup() {
  return `<div class="dm-pian-vuoto">
    <strong>${esc(t("Nessuna pianta configurata", "No plant configured"))}</strong>
    <span>${esc(
      t(
        "Una pianta compare qui quando aggiungi il suo sensore nella scheda Piante della configurazione: l'umidità della terra, e se c'è la sua temperatura.",
        "A plant shows up here once you add its sensor in the Plant care tab of the settings: the soil moisture, and its temperature if there is one.",
      ),
    )}</span>
  </div>`;
}

/** La pagina intera, da quello che si sa adesso. */
export function paginaDellePiante(vista) {
  if (!vista) return vuotoMarkup();
  const { come, adesso } = vista;
  const schede = come.piante.map(schedaMarkup).join("");
  return `${testaMarkup(testaDellePiante(come))}
    <div class="dm-pian-elenco">${come.piante.map((pianta) => rigaMarkup(pianta, adesso)).join("")}</div>
    ${schede ? `<div class="dm-pian-schede">${schede}</div>` : ""}`;
}

/* ── la tessera in Home ───────────────────────────────────────────────── */

/**
 * La tessera in Home, dalla stessa vista della pagina: quante sono da
 * innaffiare, e quali. Quando ce n'è una chiede attenzione, come la batteria
 * da cambiare: è il «ti avverte quando è ora di innaffiare» della issue, e il
 * suo nome finisce nella riga in cima alla Home. Chi aspetta la pioggia no: è
 * a posto, e una tessera che chiede attenzione per una cosa da non fare
 * insegnerebbe a non guardarla più.
 */
export function tesseraDellePiante(vista) {
  if (!vista) return null;
  const { come } = vista;
  const testa = testaDellePiante(come);
  const sete = come.daInnaffiare.length > 0;
  return {
    key: PIANTE_TAB,
    accent: sete ? "#dc2626" : "#16a34a",
    icon: "🪴",
    label: t("Piante", "Plant care"),
    value: String(come.daInnaffiare.length),
    caption: sete ? testa.nomi : [testa.grande, testa.nomi].filter(Boolean).join(" · "),
    ring: null,
    attiva: sete,
    alert: sete,
    rows: come.piante.map((pianta) => ({
      entity: pianta.lettura.entity,
      name: pianta.lettura.name,
      glyph: disegnoDiCasa(pianta.lettura.icon, { misura: 20, ripiego: "plant" }),
      value:
        pianta.stato === "muta"
          ? t("Non risponde", "Not answering")
          : pianta.stato === "aspetta"
            ? parolaDellaPianta("aspetta")
            : percento(pianta.lettura.umidita),
      tono: pianta.stato === "asciutta" ? "allarme" : pianta.stato === "muta" ? "" : "quiete",
    })),
  };
}

function dipingi() {
  const pagina = ensurePiantePage();
  const dove = pagina?.querySelector?.("#piante-wrap");
  if (!dove) return;
  if (!paginaVisibile(PIANTE_PAGE_ID)) return;
  const markup = paginaDellePiante(vistaDellePiante());
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
      root.console?.warn?.("[DashboardModern] piante", error);
    }
  };
  state.frame = root.requestAnimationFrame?.(giro) || 0;
  if (!state.frame) giro();
}

/** Ridisegna adesso, saltando la firma: la usa chi cambia la configurazione. */
export function renderPiante() {
  state.firma = "";
  /* Una pianta nuova vuole la sua storia, e una appena messa «all'aperto» le
   * previsioni: quelle di prima erano di un'altra casa. */
  state.chiestoAlle = 0;
  schedule();
}

/* ── il foglio ────────────────────────────────────────────────────────── */

/* Copie delle regole dei Varchi e delle schede della Piscina, legate a questa
 * pagina; la forcella no — quella è di tutti, e sta nel foglio della Piscina. */
function installStyles() {
  const P = `#${PIANTE_PAGE_ID}`;
  installStyle(
    "dm-piante-section-style",
    `
    ${P} .dm-pian-wrap{display:grid;gap:14px;padding:0 0 24px}
    ${P} .dm-pian-vuoto{display:grid;gap:6px;padding:22px 18px;text-align:center;
      border:1px dashed var(--divider-color,#dbe4ee);border-radius:18px;background:var(--card-bg,#fff)}
    ${P} .dm-pian-vuoto strong{font-size:14px;font-weight:900}
    ${P} .dm-pian-vuoto span{font-size:12px;font-weight:700;color:var(--secondary-text-color,#64748b)}

    /* La risposta grande, come quella dei Varchi. */
    ${P} .dm-pian-testa{
      display:grid;gap:4px;padding:20px 22px;border-radius:22px;
      border:1px solid var(--card-border,#e2e8f0);background:var(--card-bg,#fff);
      box-shadow:var(--shadow-glass,0 8px 30px rgba(0,0,0,.06))}
    ${P} .dm-pian-testa small{
      font-size:10.5px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;
      color:var(--text-dim,#64748b)}
    ${P} .dm-pian-testa strong{font-size:30px;font-weight:900;line-height:1.05;color:var(--text,#0f172a)}
    ${P} .dm-pian-testa[data-stato="sete"] strong{color:#dc2626}
    ${P} .dm-pian-testa[data-stato="pioggia"] strong{color:#2563eb}
    ${P} .dm-pian-testa[data-stato="bene"] strong{color:#15803d}
    ${P} .dm-pian-nomi{font-size:13px;font-weight:800;color:var(--text,#0f172a)}
    ${P} .dm-pian-sotto{font-size:12px;font-weight:700;color:var(--text-dim,#64748b)}

    /* Il semaforo, come le carte dei Varchi. */
    ${P} .dm-pian-elenco{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(260px,100%),1fr));gap:10px}
    ${P} .dm-pian-voce{
      display:grid;grid-template-columns:44px minmax(0,1fr) auto;align-items:center;gap:12px;
      padding:14px 16px;border-radius:18px;
      border:1px solid color-mix(in srgb,var(--dm-pian,#94a3b8) 42%,transparent);
      background:color-mix(in srgb,var(--dm-pian,#94a3b8) 10%,var(--card-bg,#fff))}
    ${P} .dm-pian-voce[data-stato="asciutta"]{--dm-pian:#dc2626}
    ${P} .dm-pian-voce[data-stato="bene"],${P} .dm-pian-voce[data-stato="aspetta"]{--dm-pian:#16a34a}
    ${P} .dm-pian-voce[data-stato="muta"]{--dm-pian:#94a3b8}
    /* Chi aspetta la pioggia lo dice anche da lontano: il tratteggio del varco
       escluso vuol dire «a posto, ma per una ragione». */
    ${P} .dm-pian-voce[data-stato="aspetta"]{border-style:dashed;border-color:#f59e0b}
    ${P} .dm-pian-voce-ic{
      display:grid;place-items:center;width:44px;height:44px;border-radius:14px;font-size:20px;
      background:color-mix(in srgb,var(--dm-pian,#94a3b8) 22%,transparent)}
    ${P} .dm-pian-voce-ic .dm-catalogo-art{display:grid;place-items:center;line-height:0}
    ${P} .dm-pian-voce-ic svg{display:block;width:30px;height:30px}
    ${P} .dm-pian-voce-testo{display:grid;gap:2px;min-width:0}
    ${P} .dm-pian-voce-testo strong{font-size:14px;font-weight:900;color:var(--text,#0f172a);
      display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2;
      overflow:hidden;overflow-wrap:anywhere;line-height:1.25}
    ${P} .dm-pian-voce-testo small{font-size:10.5px;font-weight:700;line-height:1.3;
      color:var(--text-dim,#64748b);overflow-wrap:anywhere}
    ${P} .dm-pian-voce-stato{
      font-size:11px;font-weight:900;letter-spacing:.03em;text-transform:uppercase;
      max-width:96px;text-align:right;line-height:1.25;
      color:color-mix(in srgb,var(--dm-pian,#94a3b8) 78%,var(--text,#0f172a))}

    /* Le schede, come quelle della Piscina. */
    ${P} .dm-pian-schede{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(298px,100%),1fr));gap:12px;align-items:start}
    ${P} .dm-pian-scheda{box-sizing:border-box;display:grid;gap:12px;padding:16px;
      border:1px solid var(--card-border,#dbe4ee);border-radius:22px;background:var(--card-bg,#fff);
      box-shadow:var(--shadow-sculpted,0 6px 18px rgba(15,23,42,.07))}
    ${P} .dm-pian-scheda-testa{display:flex;align-items:center;justify-content:space-between;gap:10px}
    ${P} .dm-pian-scheda-titolo{display:flex;align-items:center;gap:8px;color:var(--text,#0f172a);font-size:14px;font-weight:900}
    ${P} .dm-pian-scheda-titolo i{font-style:normal;display:grid;place-items:center;line-height:0}
    ${P} .dm-pian-scheda-titolo svg{display:block;width:22px;height:22px}
    ${P} .dm-pian-forcelle{display:grid;gap:14px}

    @media(max-width:520px){
      ${P} .dm-pian-elenco,${P} .dm-pian-schede{grid-template-columns:minmax(0,1fr)}}
    `,
  );
}

export function installPiante() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  ensurePiantePage();
  ensurePianteTab();
  for (const nome of ["render", "cdApplyNavVis"]) {
    const precedente = root[nome];
    if (typeof precedente !== "function" || precedente.__dmPiante) continue;
    const avvolta = function (...args) {
      const esito = precedente.apply(this, args);
      schedule();
      return esito;
    };
    avvolta.__dmPiante = true;
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

installPiante();
