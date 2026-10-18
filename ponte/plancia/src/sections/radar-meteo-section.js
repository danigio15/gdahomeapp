/* Il radar meteo accanto alle previsioni (#266).
 *
 * «Visualizzare il radar meteo riferito alla zona prescelta (tramite
 * longitudine e latitudine o comune) e nel relativo raggio di 30km… metterlo
 * assieme al meteo, affianco al meteo dei 7 giorni.»
 *
 * Il radar sta dove è stato chiesto: dentro la finestra delle previsioni,
 * sopra i sette giorni — si legge nell'ordine in cui passa il tempo, prima
 * dove piove adesso e poi cosa dicono i prossimi giorni.
 *
 * Il posto si sceglie, e in tre modi che coprono la domanda senza tirare
 * dentro nessuno:
 *
 *   · le coordinate scritte a mano, per chi le ha;
 *   · una zona di Home Assistant — hanno un nome e delle coordinate, e sono la
 *     risposta al «oppure il comune»: chi vuole vedere il paese dei suoceri ci
 *     crea una zona e la sceglie qui. Tradurre un nome di comune in un punto
 *     vorrebbe dire mandare a un servizio di terzi il nome del posto che
 *     interessa a chi guarda, per una cosa che Home Assistant sa gia' fare;
 *   · e se non si dice niente, casa — che e' il posto giusto per quasi tutti.
 *
 * Il raggio e' quello che si vuole vedere intorno, trenta chilometri di serie
 * come chiedeva la segnalazione. Da posto e raggio il motore in
 * `core/radar-mappa.js` ricava zoom e quadratini: e' aritmetica, e si prova
 * senza rete.
 *
 * Da dove arrivano i quadratini invece e' una scelta di chi installa, e ci
 * sono due strade.
 *
 * La prima non esce di casa: un'entita' `camera.*` o `image.*` del proprio
 * Home Assistant. Chi ha portato dentro il radar della Protezione Civile con
 * la sua integrazione ha gia' quell'entita', il fotogramma passa dal proprio
 * server col proprio token, e fuori non va niente.
 *
 * La seconda e' un servizio di mappe, scelto da una tendina. All'inizio la
 * tendina non c'era: l'indirizzo a modello — `{z}/{x}/{y}`, la convenzione
 * che usano tutti — lo scriveva chi installa, per non cablare un servizio mai
 * interrogato. Il risultato e' stato «se metto casa non si vede nulla»: il
 * radar sapeva DOVE guardare e non COSA, e per chi non sa scrivere un
 * indirizzo di tessere era una cornice vuota. Adesso i servizi che si
 * conoscono stanno in `core/radar-mappa.js` come dati — RainViewer per la
 * pioggia, OpenStreetMap per la mappa sotto — e di serie sono gia'
 * scelti: basta dire dove. Chi non vuole che la plancia bussi a nessun
 * servizio sceglie «Nessuno», e accanto alla tendina sta scritto cosa quel
 * servizio viene a sapere (la zona che si guarda). L'indirizzo proprio resta, per chi ne ha
 * un altro, e resta anche il pulsante che scarica un quadratino e dice se e'
 * arrivato: chi sceglie sa in un secondo se funziona, invece di scoprirlo la
 * prima volta che piove.
 *
 * E casa si chiede a Home Assistant — `get_config` — quando la zona
 * `zone.home` non e' fra gli stati: `hass.config`, l'altro ripiego, nella
 * plancia ospitata non esiste, e «Casa» finiva nel vuoto.
 */
import {
  FONDI_MAPPA,
  indirizzoRitirato,
  FONDO_DI_SERIE,
  NIENTE,
  SANDBOX_WINDY,
  SERVIZI_RADAR,
  SERVIZIO_DI_SERIE,
  SERVIZIO_WINDY,
  cornicePermessa,
  daIndirizzoWindy,
  indirizzoWindy,
  finestraDellaPioggia,
  finestraDiTessere,
  fotogrammaRainViewer,
  fotogrammiRainViewer,
  luogoDelRadar,
  attribuzioneDelFondo,
  modelloDelFondo,
  modelliDelServizio,
  modelloDelServizio,
  problemaDellIndirizzo,
  urlDellaTessera,
  zoomDellaPioggia,
  zoomPerRaggio,
  zoomWindy,
  zoneDisponibili,
} from "../core/radar-mappa.js";
import { loadCameraFrame } from "./live-ui-section.js";
import {
  allStates,
  chiediAHomeAssistant,
  clean,
  doc,
  esc,
  installStyle,
  readJson,
  root,
  scriviTestoSeCambia,
  t,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_RADAR_METEO__";
const state = (root[KEY] ||= {
  installed: false,
  timer: 0,
  provando: false,
  /* Casa, come la dice Home Assistant (`get_config`): si chiede una volta. */
  casa: null,
  casaChiesta: 0,
  /* La finestra del meteo che si sta guardando, e chi la guarda. */
  osservata: null,
  osservatore: null,
  /* Il fotogramma piu' recente di ogni servizio, e le richieste in volo. */
  fotogrammi: {},
  chiedendo: {},
  /* L'animazione: il passo che gira e quale fotogramma si sta guardando. */
  passo: 0,
  posto: 0,
});
state.fotogrammi ||= {};
state.chiedendo ||= {};
/* I posti fuori dalla finestra dove il radar si disegna anche (#206): la
 * pagina Meteo ne tiene uno, piu' grande. */
state.posti ||= new Set();

/* Come si legge il fotogramma di adesso dall'elenco di ogni servizio, e come
 * si leggono tutti quelli che servono ad animarlo. */
const FOTOGRAMMI = Object.freeze({ rainviewer: fotogrammaRainViewer });
const ELENCHI = Object.freeze({ rainviewer: fotogrammiRainViewer });

/* Quanto resta a schermo un fotogramma dell'animazione.
 *
 * Mezzo secondo: sei fotogrammi fanno tre secondi di pioggia che cammina, che
 * e' il tempo in cui si legge da che parte va un fronte. Piu' veloce diventa
 * uno sfarfallio, piu' lento non e' piu' un movimento. */
const PASSO_ANIMAZIONE = 500;

/* E quanto si resta fermi sull'ultimo prima di ricominciare: senza, il salto
 * dall'adesso a un'ora fa sembra un difetto invece che un giro finito. */
const PAUSA_SULL_ULTIMO = 1200;

/* Quanto si aspetta prima di richiedere un elenco che non e' arrivato. */
const RIPROVA_DOPO = 60_000;

export const CHIAVE_RADAR = "cd_radar_meteo";
const BLOCCO = "dm-radar-blocco";
const IMMAGINE = "dm-radar-img";
/* La classe del contenitore che ospita il radar fuori dalla finestra: il
 * foglio di stile del radar vale anche dentro di lui. */
export const POSTO_DEL_RADAR = "dm-radar-posto";

/* Ogni quanto si ripiglia il radar. I servizi nazionali si aggiornano ogni
 * cinque o dieci minuti: un minuto e' abbastanza fitto da non far aspettare
 * nessuno e abbastanza largo da non pesare. */
const OGNI = 60_000;

/* Il raggio di serie e' quello della segnalazione. */
export const RAGGIO_DI_SERIE = 30;

/* I domini che portano un'immagine. `entity_picture` ce l'hanno anche altri —
 * una persona, un media player — ma nessuno di quelli e' un radar. */
const CON_IMMAGINE = new Set(["camera", "image"]);

const configurazione = () => {
  const grezzo = readJson(CHIAVE_RADAR, {});
  return grezzo && typeof grezzo === "object" ? grezzo : {};
};

function salva(prossima) {
  try {
    root.localStorage?.setItem?.(CHIAVE_RADAR, JSON.stringify(prossima));
    root.cdMarkDirty?.();
    root.cdSyncPush?.();
  } catch (_errore) {}
}

/* Da dove arrivano i quadratini: un servizio della tendina, un indirizzo
 * proprio (`modello`), o niente.
 *
 * Chi aveva scritto un indirizzo prima che la tendina esistesse non ha
 * `servizio` salvato: l'indirizzo con i segnaposto basta a dire «il mio». */
export function servizioScelto(grezzo = {}) {
  const servizio = clean(grezzo?.servizio);
  if (NIENTE.includes(servizio.toLowerCase())) return "";
  if (SERVIZI_RADAR[servizio]) return servizio;
  if (servizio === SERVIZIO_WINDY) return SERVIZIO_WINDY;
  /* Un collegamento di Windy incollato al posto dell'indirizzo delle tessere
   * non e' un errore da correggere: e' Windy, detto con un collegamento. */
  if ((servizio === "modello" || !servizio) && daIndirizzoWindy(grezzo?.modello))
    return SERVIZIO_WINDY;
  /* Un indirizzo scritto a mano vale finche' il suo servizio risponde. Quello
   * di CARTO non risponde piu' — manda la scritta «Zoom Level Not Supported»
   * al posto della pioggia — e chi ce l'ha ancora scritto torna al servizio di
   * serie invece di vedersela stampata sopra la mappa. */
  const indirizzo = clean(grezzo?.modello);
  const scritto = /\{[zxy]\}/.test(indirizzo);
  const ritirato = scritto && indirizzoRitirato(indirizzo);
  /* «Un indirizzo mio» senza indirizzo non e' una scelta, e resta niente: chi
   * ha aperto la tendina e non ha scritto non vuole che si chieda la pioggia
   * a qualcun altro al posto suo. Se invece l'indirizzo c'e' ma e' di un
   * servizio ritirato, la scelta c'era: si torna a quello di serie. */
  if (servizio === "modello") return scritto ? (ritirato ? SERVIZIO_DI_SERIE : "modello") : "";
  if (!servizio) return scritto && !ritirato ? "modello" : SERVIZIO_DI_SERIE;
  return "";
}

/* Da chi arrivano i quadratini, in due parole.
 *
 * Il nome del servizio scelto, e per un indirizzo scritto a mano l'ospite a cui
 * la plancia sta bussando: prima li' non c'era scritto niente, e una plancia
 * che chiede la pioggia a un servizio sbagliato non aveva modo di dirlo. */
export function nomeDelServizio(scelto = {}) {
  if (scelto?.servizio === SERVIZIO_WINDY) return "Windy";
  const noto = SERVIZI_RADAR[scelto?.servizio]?.nome;
  if (noto) return noto;
  const indirizzo = clean(scelto?.modello);
  if (!indirizzo) return "";
  try {
    return new URL(indirizzo.replaceAll(/\{-?[a-z]\}/gi, "1")).hostname;
  } catch (_errore) {
    return "";
  }
}

/* L'ora del fotogramma che si sta guardando, come la direbbe un orologio. */
function oraDelFotogramma(secondi) {
  const quando = Number(secondi);
  if (!Number.isFinite(quando) || quando <= 0) return "";
  try {
    return new Date(quando * 1000).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (_errore) {
    return "";
  }
}

/* Il servizio della pioggia, e in che stato e'.
 *
 * «Non mi sembra di vedere le piogge» sono due frasi diverse dette uguale: il
 * servizio non risponde, oppure risponde e non sta piovendo. Senza
 * distinguerle non si puo' rispondere a nessuna delle due — e chi guarda un
 * cielo sereno sopra una mappa vuota non ha modo di sapere quale delle due
 * sta vedendo. L'ora del fotogramma le separa: se c'e', il radar e' vivo. */
export function etichettaDelServizio(scelto = {}, fotogramma = null, attesa = false) {
  const nome = nomeDelServizio(scelto);
  if (!nome) return "";
  /* Un indirizzo scritto a mano non ha un elenco di fotogrammi da aspettare:
   * il suo stato lo dicono i quadratini, non questa riga. */
  if (!SERVIZI_RADAR[scelto?.servizio]) return nome;
  const ora = oraDelFotogramma(fotogramma?.time);
  if (ora) return `${nome} ${ora}`;
  return `${nome} — ${
    attesa ? t("in attesa", "waiting") : t("nessuna risposta", "no answer")
  }`;
}

/* E da chi arriva la MAPPA sotto la pioggia.
 *
 * E' l'altra meta' della stessa domanda, e per un anno non c'e' stata: le
 * scritte al posto delle strade le manda il servizio del fondo, e la nota
 * diceva solo il nome di chi manda la pioggia. Un indirizzo scritto a mano
 * porta il suo ospite, che e' l'unica cosa che permette di riconoscere un
 * servizio che non risponde piu'. */
export function nomeDelFondo(scelto = {}) {
  const indirizzo = clean(scelto?.fondo);
  if (!indirizzo) return "";
  const noto = Object.values(FONDI_MAPPA).find((fondo) => fondo.modello === indirizzo);
  if (noto) return noto.nome;
  try {
    return new URL(indirizzo.replaceAll(/\{-?[a-z]\}/gi, "1")).hostname;
  } catch (_errore) {
    return "";
  }
}

/* Se qualcuno ha mai toccato il radar. Una casa che non l'ha configurato non
 * se lo trova nelle previsioni: il servizio di serie vale per chi ha aperto la
 * scheda e scelto un posto, non per tutti. */
function radarToccato(grezzo) {
  return Object.values(grezzo || {}).some((valore) => clean(valore) !== "");
}

/** Cosa e' stato scelto, ripulito. */
export function radarScelto(stored = configurazione()) {
  const grezzo = stored && typeof stored === "object" ? stored : {};
  const entity = clean(grezzo.entity);
  const modello = clean(grezzo.modello);
  const servizio = servizioScelto(grezzo);
  const raggio = Number(grezzo.raggio);
  const scelto = {
    entity,
    modello,
    servizio,
    fondo: modelloDelFondo(grezzo),
    /* Chi disegna la mappa di fondo: Esri lo chiede, OpenStreetMap pure, e la
     * legenda e' il posto dove si dice. */
    firmaDelFondo: attribuzioneDelFondo(grezzo),
    zona: clean(grezzo.zona),
    /* Il tetto dello zoom della pioggia, com'e' scritto: a interpretarlo ci
       pensa `zoomDellaPioggia`, che sa anche cosa fare quando e' vuoto. */
    zoomPioggia: clean(grezzo.zoomPioggia),
    lat: clean(grezzo.lat),
    lon: clean(grezzo.lon),
    raggio: Number.isFinite(raggio) && raggio > 0 ? Math.min(500, raggio) : RAGGIO_DI_SERIE,
    nome: clean(grezzo.nome),
    /* Il radar cammina, salvo che non lo si sia spento (#393).
     *
     * Acceso di serie perche' e' cio' che un radar e': una fotografia della
     * pioggia dice dove piove, il movimento dice dove va — ed e' la seconda la
     * domanda per cui lo si apre. Chi lo spegne torna al fotogramma solo, che
     * e' un giro di quadratini invece di sei: e' la ragione per cui
     * l'interruttore c'e'. */
    animato: clean(grezzo.animato) !== "no",
  };
  /* L'entita' vince quando c'e': non esce di casa, e chi l'ha compilata ha
   * gia' il radar dentro Home Assistant. */
  if (entity.includes(".") && CON_IMMAGINE.has(entity.split(".")[0]))
    return { ...scelto, modo: "entita" };
  /* Windy: un riquadro con la sua mappa. Se il collegamento incollato diceva
   * dove guardare e a che zoom, vale quello; se no il posto e' quello scelto
   * qui — casa, una zona, le coordinate — e lo zoom viene dal raggio. */
  if (servizio === SERVIZIO_WINDY && radarToccato(grezzo)) {
    const letto = daIndirizzoWindy(modello) || {};
    return {
      ...scelto,
      modo: "windy",
      windy: {
        lat: letto.lat ?? null,
        lon: letto.lon ?? null,
        zoom: letto.zoom ?? null,
        strato: letto.strato || "radar",
      },
    };
  }
  if (servizio && radarToccato(grezzo)) return { ...scelto, modo: "mappa" };
  return null;
}

/* ── casa, e il fotogramma di adesso ─────────────────────────────────────── */

/* Dove sta casa, per chi non ha `zone.home` sotto mano.
 *
 * «Se metto casa non si vede nulla.» Il posto di casa si leggeva dalla zona
 * `zone.home` fra gli stati, e in ripiego da `hass.config` — che nella plancia
 * ospitata non c'e': `hass` vive nel documento del padre, non in questo. Se la
 * zona per qualunque ragione non e' fra gli stati, «Casa» non era da nessuna
 * parte e il radar restava muto senza dire perche'. Home Assistant lo sa da
 * sempre dov'e' casa — e' la prima cosa che si scrive installandolo — e lo
 * dice a chi glielo chiede sul socket: `get_config`. Lo si chiede una volta. */
function casaNota() {
  return state.casa || root.hass?.config || {};
}

function chiediLaCasa({ aspetta = false } = {}) {
  if (state.casa) return aspetta ? Promise.resolve(state.casa) : true;
  const adesso = Date.now();
  if (state.casaInVolo) return aspetta ? state.casaInVolo : true;
  if (adesso - state.casaChiesta < RIPROVA_DOPO) return aspetta ? Promise.resolve(null) : false;
  state.casaChiesta = adesso;
  state.casaInVolo = chiediAHomeAssistant({ type: "get_config" })
    .then((config) => {
      const lat = Number(config?.latitude);
      const lon = Number(config?.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      state.casa = { latitude: lat, longitude: lon, location_name: clean(config?.location_name) };
      disegnaRadar();
      return state.casa;
    })
    .catch(() => null)
    .finally(() => {
      state.casaInVolo = null;
    });
  return aspetta ? state.casaInVolo : true;
}

/* Il fotogramma piu' recente del servizio scelto, e quando rileggerlo. */
function fotogrammaDi(servizio) {
  return state.fotogrammi[servizio] || null;
}

function inArrivo(scelto) {
  return Boolean(scelto?.servizio && state.chiedendo[scelto.servizio]);
}

/* Si rilegge l'elenco quando il fotogramma e' vecchio quanto il passo del
 * servizio, o presto se l'ultima volta non e' arrivato niente. */
function fotogrammaDaRileggere(servizio, adesso = Date.now()) {
  const dato = fotogrammaDi(servizio);
  if (!dato) return true;
  const passo = dato.fotogramma ? SERVIZI_RADAR[servizio]?.ogni || 600_000 : RIPROVA_DOPO;
  return adesso - dato.quando >= passo;
}

/* L'unica richiesta che esce di casa, e parte solo per il servizio che si e'
 * scelto: senza scelta questa funzione non viene mai chiamata. */
async function aggiornaFotogramma(servizio) {
  const dichiarato = SERVIZI_RADAR[servizio];
  const leggi = FOTOGRAMMI[servizio];
  if (!dichiarato || !leggi) return null;
  if (state.chiedendo[servizio]) return state.chiedendo[servizio];
  state.chiedendo[servizio] = (async () => {
    let fotogramma = null;
    let elenco = [];
    try {
      const risposta = await root.fetch(dichiarato.elenco, { cache: "no-store" });
      if (risposta?.ok) {
        const detto = await risposta.json();
        fotogramma = leggi(detto);
        elenco = ELENCHI[servizio]?.(detto) || [];
      }
    } catch (_errore) {
      fotogramma = null;
      elenco = [];
    }
    /* Una richiesta sola per tutti e due: l'ultimo fotogramma e la fila che lo
     * precede stanno nella stessa risposta, e chiederla due volte per leggerne
     * due pezzi sarebbe il doppio del traffico per lo stesso foglio. */
    state.fotogrammi[servizio] = { quando: Date.now(), fotogramma, elenco };
    delete state.chiedendo[servizio];
    disegnaRadar();
    return fotogramma;
  })();
  return state.chiedendo[servizio];
}

/** Il modello di indirizzo da usare adesso: il proprio, o quello del servizio
 * col suo fotogramma dentro. Vuoto se il fotogramma non e' ancora arrivato. */
export function modelloVivo(scelto) {
  if (!scelto || scelto.modo !== "mappa") return "";
  if (scelto.servizio === "modello") return scelto.modello;
  if (!SERVIZI_RADAR[scelto.servizio]) return "";
  if (fotogrammaDaRileggere(scelto.servizio)) aggiornaFotogramma(scelto.servizio);
  return modelloDelServizio(scelto.servizio, fotogrammaDi(scelto.servizio)?.fotogramma);
}

/**
 * I modelli da disegnare adesso, uno per fotogramma, dal piu' vecchio al piu'
 * recente — l'ultimo e' l'adesso.
 *
 * Con l'animazione spenta, o con un indirizzo scritto a mano che una fila di
 * fotogrammi non ce l'ha, e' uno solo: la fila e' una proprieta' del servizio,
 * non una cosa che si puo' inventare.
 */
export function modelliVivi(scelto) {
  const adesso = modelloVivo(scelto);
  if (!adesso) return [];
  const solo = [{ modello: adesso, fotogramma: fotogrammaDi(scelto.servizio)?.fotogramma || null }];
  if (!scelto?.animato) return solo;
  const elenco = fotogrammaDi(scelto.servizio)?.elenco;
  const tutti = modelliDelServizio(scelto.servizio, elenco);
  return tutti.length > 1 ? tutti : solo;
}

/** Se il radar a entita' sta rispondendo adesso. */
export function radarVivo(scelto, states = allStates()) {
  if (scelto?.modo !== "entita") return false;
  return Boolean(clean(states?.[scelto.entity]?.attributes?.entity_picture));
}

/* ── il blocco dentro la finestra del meteo ───────────────────────────── */

const finestra = () => doc?.getElementById?.("weather-modal") || null;

function laFinestraSiVede() {
  const modale = finestra();
  if (!modale) return false;
  if (modale.classList.contains("show") || modale.classList.contains("active")) return true;
  return modale.offsetParent !== null;
}

/* I posti fuori dalla finestra che adesso si vedono. Uno staccato dal
 * documento — la pagina ridisegnata da capo — si dimentica. */
function postiInVista() {
  const visti = [];
  for (const posto of state.posti) {
    if (!posto?.isConnected) {
      state.posti.delete(posto);
      continue;
    }
    if (posto.getClientRects?.().length) visti.push(posto);
  }
  return visti;
}

/* «Aperta» vuol dire che un radar si sta guardando: la finestra delle
 * previsioni, o la pagina Meteo (#206). Il giro che ridisegna e l'animazione
 * valgono per tutti e due, e si fermano quando nessuno dei due si vede. */
function finestraAperta() {
  return laFinestraSiVede() || postiInVista().length > 0;
}

/* Il blocco che c'e' gia', senza fabbricarlo. */
function bloccoEsistente() {
  return finestra()?.querySelector?.(`.${BLOCCO}`) || null;
}

function blocco() {
  const modale = finestra();
  if (!modale) return null;
  let nodo = modale.querySelector(`.${BLOCCO}`);
  if (nodo) return nodo;
  const elenco = modale.querySelector("#weather-forecast-list");
  if (!elenco) return null;
  nodo = nuovoBlocco();
  /* Sopra le previsioni: il radar dice adesso, le previsioni dicono dopo. */
  elenco.before(nodo);
  return nodo;
}

/* Il blocco del radar, vuoto: la testa, il quadro e la legenda. E' lo stesso
 * dentro la finestra e dentro la pagina Meteo — un disegno solo, due posti. */
function nuovoBlocco() {
  const nodo = doc.createElement("div");
  nodo.className = BLOCCO;
  nodo.innerHTML = `<div class="dm-radar-testa">
      <span aria-hidden="true">📡</span>
      <strong class="dm-radar-nome"></strong>
      <small class="dm-radar-nota"></small>
    </div>
    <div class="dm-radar-quadro">
      <div class="dm-radar-tessere"></div>
      <img class="${IMMAGINE}" alt="${esc(t("Radar meteo", "Weather radar"))}" decoding="async">
      <span class="dm-radar-mirino" aria-hidden="true"></span>
      <span class="dm-radar-ora" data-dm-radar-ora hidden></span>
      <span class="dm-radar-muto">${esc(
        t("Il radar non sta rispondendo.", "The radar is not reporting."),
      )}</span>
      <span class="dm-radar-fondo-muto">${esc(
        t(
          "La mappa di fondo non risponde. La pioggia c'è.",
          "The base map is not answering. The rain is there.",
        ),
      )}</span>
    </div>
    <div class="dm-radar-legenda" data-dm-radar-legenda>
      <small>${esc(t("Pioggia", "Rain"))}</small>
      <span class="dm-radar-scala" aria-hidden="true"></span>
      <small>${esc(t("leggera → forte", "light → heavy"))}</small>
      <small class="dm-radar-vuoto">${esc(
        t("Dove non c'è colore non piove.", "No colour means no rain."),
      )}</small>
      <small class="dm-radar-firma" data-dm-radar-firma-fondo></small>
    </div>`;
  return nodo;
}

/* ── il radar a entita' ───────────────────────────────────────────────── */

async function daEntita(scelto, nodo) {
  const immagine = nodo.querySelector(`.${IMMAGINE}`);
  if (!immagine) return;
  /* Qui la mappa di fondo non esiste: la disegna chi la vuole. Il blocco pero'
   * e' lo stesso di prima — si riusa, non si rifa' — e se il radar a tessere
   * aveva gia' detto «il fondo non risponde» quel verdetto resterebbe scritto
   * addosso al nodo, e la frase gialla comparirebbe sopra l'immagine della
   * telecamera che invece è arrivata benissimo. Un verdetto su una cosa che
   * non c'e' e' una bugia: si cancella entrando. */
  delete nodo.dataset.dmFondo;
  const preso = await loadCameraFrame({ entity: scelto.entity }, immagine);
  nodo.dataset.dmRadar = preso ? "vivo" : "muto";
}

/* ── il radar a tessere ───────────────────────────────────────────────── */

/* Quanto e' alto il riquadro come minimo. Lo dice il foglio di stile qui
 * sotto, e lo deve sapere anche il conto: sono la stessa misura. */
const ALTEZZA_MINIMA = 240;

/* Il riquadro e' largo quanto la finestra e alto quanto basta a non mangiarsi
 * le previsioni: due terzi della larghezza, che su un telefono resta un
 * quadrato schiacciato e su un tablet una striscia.
 *
 * Due misure, e tutte e due sbagliavano sul telefono (#351).
 *
 * La larghezza si chiedeva a `getBoundingClientRect`, che risponde con la
 * misura DIPINTA: mentre la finestra del meteo si apre e' ancora rimpicciolita
 * dall'animazione, e i quadratini venivano calcolati per un riquadro che non
 * esiste — poi la firma li teneva cosi'. `offsetWidth` risponde con la misura
 * dell'impaginazione, quella vera, animazione o no.
 *
 * L'altezza si fermava a 160, ma il riquadro non scende mai sotto i 240 del
 * foglio: su un telefono i due sesti di 344 fanno 213, e la mappa veniva
 * disegnata alta 213 dentro una scatola alta 240 — scentrata rispetto al
 * mirino, con una fascia vuota sotto. Su un computer il conto passava i 240 da
 * solo, ed e' per questo che di la' non si vedeva. */
function misureDelQuadro(quadro) {
  const largo = quadro.offsetWidth || Math.round(quadro.getBoundingClientRect().width) || 320;
  return { latoPx: largo, altoPx: Math.max(ALTEZZA_MINIMA, Math.round(largo * 0.62)) };
}

/* La riga sotto la mappa: dove si guarda, quanto largo, a che ingrandimento, e
 * da chi arrivano la pioggia e il fondo.
 *
 * Sta in una funzione sua perche' va scritta SEMPRE, e prima non succedeva
 * (#323): quando il servizio non rispondeva si usciva prima di arrivarci, e
 * restava vuota — proprio nel caso in cui e' l'unica cosa che dice cosa non va,
 * ed e' la riga che si chiede di mandare per capirlo. */
function scriviLaNota(nodo, scelto, luogo, finestraTessere, finestraPioggia) {
  const nota = nodo.querySelector(".dm-radar-nota");
  if (!nota) return;
  const posto = luogo
    ? luogo.nome || `${luogo.lat.toFixed(3)}, ${luogo.lon.toFixed(3)}`
    : t("posto sconosciuto", "place unknown");
  const zoom = !finestraTessere
    ? ""
    : !finestraPioggia || finestraPioggia.zoom === finestraTessere.zoom
      ? `z${finestraTessere.zoom}`
      : `z${finestraTessere.zoom} · ${t("pioggia", "rain")} z${finestraPioggia.zoom}`;
  const testo = [
    posto,
    `${scelto.raggio} km`,
    zoom,
    etichettaDelServizio(scelto, fotogrammaDi(scelto.servizio)?.fotogramma, inArrivo(scelto)),
    nomeDelFondo(scelto),
  ]
    .filter(Boolean)
    .join(" · ");
  if (nota.textContent !== testo) nota.textContent = testo;
}

function daTessere(scelto, nodo) {
  const quadro = nodo.querySelector(".dm-radar-quadro");
  const dove = nodo.querySelector(".dm-radar-tessere");
  if (!quadro || !dove) return;
  const luogo = luogoDelRadar(scelto, allStates(), casaNota());
  scriviLaNota(nodo, scelto, luogo, null, null);
  if (!luogo) {
    /* Casa non si sa ancora: la si chiede a Home Assistant, e nel frattempo il
     * riquadro dice «attesa» e non «muto» — un radar che sta cercando il posto
     * non e' un radar rotto. Muto solo se non c'e' piu' niente da aspettare. */
    nodo.dataset.dmRadar = chiediLaCasa() ? "attesa" : "muto";
    dove.replaceChildren();
    dove.dataset.dmFirma = "";
    return;
  }
  /* L'inquadratura si calcola PRIMA di sapere se il servizio risponde.
   *
   * Non costa niente — e' aritmetica — e serve alla riga sotto la mappa: lo
   * zoom e' il numero che si chiede di mandare quando qualcosa non torna
   * (#323), e proprio nel caso in cui non torna niente non veniva mai
   * calcolato, quindi non compariva. */
  const misure = misureDelQuadro(quadro);
  const finestraTessere = finestraDiTessere(luogo.lat, luogo.lon, {
    ...misure,
    raggioKm: scelto.raggio,
  });
  if (!finestraTessere) {
    nodo.dataset.dmRadar = "muto";
    return;
  }
  /* L'altezza della scatola e' quella per cui i quadratini sono stati
   * calcolati, e si scrive subito: erano due misure diverse — il foglio ne
   * imponeva 240, il conto ne disegnava 213 — e la mappa stava dentro una
   * scatola piu' alta di lei, scentrata rispetto al mirino. */
  quadro.style.height = `${finestraTessere.alto}px`;
  const modelli = modelliVivi(scelto);
  const modello = modelli.length ? modelli[modelli.length - 1].modello : "";
  if (!modello) {
    /* Il servizio non ha ancora detto qual e' il fotogramma di adesso: si
     * aspetta la sua risposta, e se non arriva il blocco lo dice — con lo zoom
     * e il posto scritti sotto, che sono cio' che serve per capire perche'. */
    scriviLaNota(nodo, scelto, luogo, finestraTessere, null);
    nodo.dataset.dmRadar = inArrivo(scelto) ? "attesa" : "muto";
    dove.replaceChildren();
    dove.dataset.dmFirma = "";
    return;
  }

  /* La pioggia si chiede al livello che il suo servizio serve davvero.
   *
   * «C'e' ancora quella scritta sullo zoom e non mi sembra di vedere le
   * piogge»: sono la stessa cosa. I quadratini della pioggia tornavano tutti
   * con la scritta «Zoom Level Not Supported» stampata dentro — che e'
   * un'immagine come le altre, quindi arrivava, quindi il blocco si diceva
   * «vivo» e la mappa si copriva di scritte. Sotto il tetto la pioggia si
   * chiede piu' larga e il quadratino si ingrandisce: stessa inquadratura,
   * pioggia un po' piu' grossa, nessuna scritta. */
  const finestraPioggia =
    finestraDellaPioggia(
      luogo.lat,
      luogo.lon,
      finestraTessere,
      zoomDellaPioggia(scelto, scelto.servizio),
    ) || finestraTessere;

  /* Si ridisegna solo se il quadro e' cambiato davvero: rifare le immagini a
   * ogni giro le farebbe lampeggiare mentre si guarda. */
  const firma = `${luogo.lat},${luogo.lon},${finestraTessere.zoom},${finestraPioggia.zoom},${misure.latoPx}x${misure.altoPx},${modelli.map((voce) => voce.modello).join("|")},${scelto.fondo}`;
  /* Si contano i quadratini della PIOGGIA, non quelli del fondo. Il fondo e'
   * un contorno: se OpenStreetMap arriva e RainViewer no, una mappa vuota passava per
   * un radar vivo — col primo quadratino del fondo il blocco si diceva
   * «vivo», e i buchi della pioggia non riuscivano piu' ne' a dirlo ne' a
   * far riprovare al giro dopo. */
  let attesi = 0;
  let arrivati = 0;
  let persi = 0;
  /* Il fondo ha un conto suo, e un verdetto suo.
   *
   * Tenerlo fuori dal verdetto del radar e' giusto — una mappa senza pioggia
   * non e' un radar vivo — ma fin qui «fuori dal verdetto» voleva dire muto:
   * il fondo spariva e nessuno lo diceva, e chi guardava vedeva la pioggia
   * sospesa sul nulla senza sapere perche'. E' la #529, che e' arrivata come
   * segnalazione invece che come due tocchi nella scheda proprio per questo.
   * Due conti separati, due frasi separate. */
  let attesiFondo = 0;
  let arrivatiFondo = 0;
  let persiFondo = 0;
  const segnala = (immagine, riuscito, dellaPioggia) => {
    if (!riuscito) immagine.remove();
    if (!dellaPioggia) {
      if (riuscito) arrivatiFondo += 1;
      else persiFondo += 1;
      if (arrivatiFondo) nodo.dataset.dmFondo = "vivo";
      else if (persiFondo >= attesiFondo) nodo.dataset.dmFondo = "muto";
      return;
    }
    if (riuscito) arrivati += 1;
    else persi += 1;
    if (arrivati) {
      nodo.dataset.dmRadar = "vivo";
      return;
    }
    /* Nessuno arrivato e nessuno piu' in volo: il radar non risponde, e la
     * firma si azzera perche' il giro dopo ci riprovi. */
    if (persi >= attesi) {
      nodo.dataset.dmRadar = "muto";
      dove.dataset.dmFirma = "";
    }
  };
  if (dove.dataset.dmFirma !== firma) {
    dove.dataset.dmFirma = firma;
    const pezzi = [];
    let attesiPioggia = 0;
    /* I quadratini di un fotogramma: il fondo li mette dritti nel riquadro, la
     * pioggia dentro il suo strato — cosi' i fotogrammi si accendono uno per
     * volta senza rifare le immagini a ogni passo. */
    const stendi = (strato, dentro, dellaPioggia) => {
      const suo = dellaPioggia ? finestraPioggia : finestraTessere;
      for (const tessera of suo.tessere) {
        const url = urlDellaTessera(strato, tessera, suo.zoom);
        if (!url) continue;
        const immagine = doc.createElement("img");
        immagine.className = dellaPioggia ? "dm-radar-t" : "dm-radar-t dm-radar-fondo";
        immagine.src = url;
        immagine.alt = "";
        immagine.decoding = "async";
        immagine.loading = "eager";
        immagine.style.cssText = `left:${tessera.sx}px;top:${tessera.sy}px;width:${tessera.lato}px;height:${tessera.lato}px`;
        /* Un quadratino che non arriva e' un buco, non un errore: il servizio
         * non copre tutto il mondo, e ai bordi manca per costruzione. */
        immagine.addEventListener("error", () => segnala(immagine, false, dellaPioggia), {
          once: true,
        });
        immagine.addEventListener("load", () => segnala(immagine, true, dellaPioggia), {
          once: true,
        });
        dentro.push(immagine);
        if (dellaPioggia) attesiPioggia += 1;
        else attesiFondo += 1;
      }
    };
    /* Il verdetto del fondo riparte da capo a ogni ridisegno, e chi il fondo
     * non lo vuole («nessuno» nella scheda) non ha niente da lamentare. */
    if (scelto.fondo) {
      nodo.dataset.dmFondo = "attesa";
      stendi(scelto.fondo, pezzi, false);
    } else delete nodo.dataset.dmFondo;
    scriviTestoSeCambia(
      nodo.querySelector("[data-dm-radar-firma-fondo]"),
      scelto.fondo ? clean(scelto.firmaDelFondo) : "",
    );
    /* Uno strato per fotogramma (#393). Con l'animazione spenta ce n'e' uno
     * solo, ed e' esattamente il disegno di prima dentro una scatola in piu'. */
    for (const [indice, voce] of modelli.entries()) {
      const strato = doc.createElement("div");
      strato.className = "dm-radar-strato";
      strato.dataset.dmFotogramma = String(indice);
      if (indice === modelli.length - 1) strato.dataset.dmVisto = "si";
      const dentro = [];
      stendi(voce.modello, dentro, true);
      strato.replaceChildren(...dentro);
      pezzi.push(strato);
    }
    dove.replaceChildren(...pezzi);
    /* Si riparte dall'adesso: l'ultimo e' quello che stava a schermo prima del
     * ridisegno, e ricominciare da un'ora fa sarebbe un salto all'indietro. */
    state.posto = Math.max(0, modelli.length - 1);
    /* «Vivo» quando un quadratino e' arrivato, non quando l'abbiamo chiesto.
     *
     * Qui si contavano le immagini create, che e' un'altra cosa: se il
     * servizio non risponde le immagini se ne vanno una per una dal loro
     * `error`, il riquadro resta vuoto — e il blocco continuava a dire
     * «vivo», che nasconde la frase che spiega. Un radar configurato che non
     * arriva mostrava un rettangolo grigio muto, senza una parola.
     *
     * E se non arriva nessuno si cancella la firma: senza, il giro
     * successivo troverebbe lo stesso disegno e non riproverebbe mai piu'. */
    attesi = attesiPioggia;
    arrivati = 0;
    persi = 0;
    nodo.dataset.dmRadar = attesi ? "attesa" : "muto";
    if (!attesi) dove.dataset.dmFirma = "";
  }

  /* La riga sotto la mappa la scrive una funzione sola, che sa dire anche
     quello che si sa a meta': qui c'e' tutto, mappa e pioggia. */
  scriviLaNota(nodo, scelto, luogo, finestraTessere, finestraPioggia);
}

/* ── il radar di Windy, in un riquadro ────────────────────────────────── */

const CORNICE = "dm-radar-windy";

/* Il riquadro di Windy se ne va quando si sceglie un'altra strada: le tessere
 * e la camera disegnano nello stesso quadro, e una pagina di Windy rimasta
 * sotto continuerebbe a girare senza che nessuno la veda. */
function togliLaCornice(nodo) {
  const dove = nodo?.querySelector?.(".dm-radar-tessere");
  const cornice = dove?.querySelector?.(`.${CORNICE}`);
  if (!cornice) return;
  cornice.remove();
  if (String(dove.dataset.dmFirma || "").startsWith("windy:")) dove.dataset.dmFirma = "";
}

/** Dove e a che zoom guarda Windy, o `null` se il posto non si sa ancora. */
export function vistaWindy(scelto, latoPx = 320, altoPx = ALTEZZA_MINIMA) {
  const detto = scelto?.windy || {};
  const luogo =
    detto.lat !== null && detto.lat !== undefined && detto.lon !== null && detto.lon !== undefined
      ? { lat: detto.lat, lon: detto.lon, nome: "", da: "collegamento" }
      : luogoDelRadar(scelto || {}, allStates(), casaNota());
  if (!luogo) return null;
  /* Lo zoom del collegamento vince; senza, quello che fa entrare il raggio nel
   * riquadro — lo stesso conto delle tessere. */
  const zoom =
    zoomWindy(detto.zoom) ??
    zoomWindy(zoomPerRaggio(luogo.lat, scelto?.raggio || RAGGIO_DI_SERIE, Math.min(latoPx, altoPx)));
  const src = indirizzoWindy({ lat: luogo.lat, lon: luogo.lon, zoom, strato: detto.strato });
  return { luogo, zoom, src };
}

function daWindy(scelto, nodo) {
  const quadro = nodo.querySelector(".dm-radar-quadro");
  const dove = nodo.querySelector(".dm-radar-tessere");
  if (!quadro || !dove) return;
  /* Qui la mappa di fondo e la legenda sono di Windy: il verdetto sul nostro
   * fondo, e la sua firma, non dicono niente. */
  delete nodo.dataset.dmFondo;
  scriviTestoSeCambia(nodo.querySelector("[data-dm-radar-firma-fondo]"), "");
  const nota = nodo.querySelector(".dm-radar-nota");
  const misure = misureDelQuadro(quadro);
  quadro.style.height = `${misure.altoPx}px`;
  const vista = vistaWindy(scelto, misure.latoPx, misure.altoPx);
  if (!vista) {
    nodo.dataset.dmRadar = chiediLaCasa() ? "attesa" : "muto";
    togliLaCornice(nodo);
    scriviTestoSeCambia(nota, [t("posto sconosciuto", "place unknown"), "Windy"].join(" · "));
    return;
  }
  const { luogo, zoom, src } = vista;
  scriviTestoSeCambia(
    nota,
    [luogo.nome || `${luogo.lat.toFixed(3)}, ${luogo.lon.toFixed(3)}`, `z${zoom}`, "Windy"].join(
      " · ",
    ),
  );
  /* L'ultimo cancello: nel riquadro va solo la pagina di Windy. */
  if (!cornicePermessa(src)) {
    togliLaCornice(nodo);
    nodo.dataset.dmRadar = "muto";
    return;
  }
  const firma = `windy:${src}`;
  if (dove.dataset.dmFirma === firma && dove.querySelector(`.${CORNICE}`)) return;
  const cornice = doc.createElement("iframe");
  cornice.className = CORNICE;
  cornice.setAttribute("sandbox", SANDBOX_WINDY);
  /* L'indirizzo della plancia non va a Windy: sotto l'ingress di Home
   * Assistant porta un gettone. */
  cornice.setAttribute("referrerpolicy", "no-referrer");
  cornice.setAttribute("loading", "lazy");
  cornice.setAttribute("title", t("Radar meteo di Windy", "Windy weather radar"));
  /* `load` dice che il riquadro ha finito, non che Windy ha risposto: se la
   * rete non ci arriva il browser mette la sua pagina d'errore li' dentro, e
   * da fuori non si puo' leggere. Fino ad allora si resta in attesa. */
  cornice.addEventListener(
    "load",
    () => {
      if (cornice.isConnected) nodo.dataset.dmRadar = "vivo";
    },
    { once: true },
  );
  cornice.src = src;
  dove.replaceChildren(cornice);
  dove.dataset.dmFirma = firma;
  nodo.dataset.dmRadar = "attesa";
}

export function disegnaRadar() {
  const scelto = radarScelto();
  /* Prima i posti fuori dalla finestra: la pagina Meteo ha il suo blocco, e
   * quello che si decide qui sotto per la finestra vale anche per lui. */
  disegnaNeiPosti(scelto);
  /* Senza radar configurato non si disegna niente — e non si fabbrica
   * nemmeno il posto dove disegnarlo.
   *
   * Prima il blocco nasceva comunque e poi si metteva `hidden`, e non
   * bastava: `hidden` e' l'ultima riga del foglio del browser, e qui sopra
   * c'e' una regola nostra con `display:grid` che la batte. Il risultato,
   * in una casa che il radar non l'ha mai configurato, era un riquadro
   * grigio dentro le previsioni con l'immagine rotta e scritto «il radar
   * non sta rispondendo» — un errore per una cosa che nessuno aveva
   * chiesto. Adesso se non c'e' niente da mostrare il blocco se ne va, e
   * la regola col `display:none` che vince e' li' sotto per il caso in cui
   * qualcuno lo lasci indietro. */
  if (!scelto) {
    const guasto = radarGuasto();
    if (!guasto) {
      bloccoEsistente()?.remove();
      return false;
    }
    /* Configurato, ma male: il blocco c'e' e dice cosa correggere. */
    const avviso = blocco();
    if (!avviso) return false;
    scriviIlGuasto(avviso, guasto);
    return false;
  }
  const nodo = blocco();
  if (!nodo) return false;
  return disegnaNelBlocco(nodo, scelto);
}

/* Il blocco che dice cosa correggere, al posto del radar. */
function scriviIlGuasto(avviso, guasto) {
  avviso.hidden = false;
  togliLaCornice(avviso);
  avviso.dataset.dmModo = "guasto";
  const titolo = avviso.querySelector(".dm-radar-nome");
  if (titolo) titolo.textContent = t("Radar meteo", "Weather radar");
  const spiegazione = avviso.querySelector(".dm-radar-nota");
  if (spiegazione && spiegazione.textContent !== guasto) spiegazione.textContent = guasto;
}

/* Un blocco, dovunque stia: la finestra delle previsioni o la pagina Meteo. */
function disegnaNelBlocco(nodo, scelto) {
  nodo.hidden = false;
  nodo.dataset.dmModo = scelto.modo;
  const nome = nodo.querySelector(".dm-radar-nome");
  if (nome) nome.textContent = scelto.nome || t("Radar meteo", "Weather radar");
  if (scelto.modo === "windy") {
    fermaLAnimazione();
    daWindy(scelto, nodo);
    return true;
  }
  togliLaCornice(nodo);
  if (scelto.modo === "entita") {
    const nota = nodo.querySelector(".dm-radar-nota");
    if (nota) nota.textContent = t("Dove piove adesso", "Where it is raining now");
    daEntita(scelto, nodo);
  } else {
    daTessere(scelto, nodo);
    /* Disegnato il quadro, si decide se farlo camminare: la fila degli strati
     * c'e' solo adesso, e prima di questo non c'era niente da animare. */
    regolaLAnimazione();
  }
  return true;
}

/* I posti fuori dalla finestra, uno per uno. Ognuno ha il suo blocco, nato
 * qui la prima volta: lo stesso disegno di quello della finestra, con le
 * stesse regole — niente radar, niente blocco; radar sbagliato, la frase che
 * dice cosa correggere. */
function disegnaNeiPosti(scelto) {
  for (const posto of [...state.posti]) {
    if (!posto?.isConnected) {
      state.posti.delete(posto);
      continue;
    }
    disegnaNelPosto(posto, scelto);
  }
}

function disegnaNelPosto(posto, scelto) {
  let nodo = posto.querySelector(`:scope > .${BLOCCO}`);
  if (!scelto) {
    const guasto = radarGuasto();
    if (!guasto) {
      nodo?.remove();
      return false;
    }
    if (!nodo) posto.append((nodo = nuovoBlocco()));
    scriviIlGuasto(nodo, guasto);
    return true;
  }
  if (!nodo) posto.append((nodo = nuovoBlocco()));
  return disegnaNelBlocco(nodo, scelto);
}

/**
 * Il radar dentro un contenitore qualsiasi (#206): la pagina Meteo lo vuole
 * piu' grande, con la legenda e l'ora del fotogramma, e con la stessa
 * configurazione della finestra delle previsioni. Il contenitore si ricorda:
 * il giro di ogni minuto e l'animazione lo trattano come la finestra, finche'
 * si vede. Torna se c'e' qualcosa da mostrare — un radar, o la frase che dice
 * cosa correggere.
 */
export function disegnaRadarIn(contenitore) {
  if (!contenitore || !doc) return false;
  contenitore.classList?.add?.(POSTO_DEL_RADAR);
  state.posti.add(contenitore);
  const mostrato = disegnaNelPosto(contenitore, radarScelto());
  /* Il giro riparte se il posto si vede: chi apre la pagina vuole il radar
   * che cammina, non la fotografia di quando la pagina e' nata. */
  if (finestraAperta()) avvia();
  regolaLAnimazione();
  return mostrato;
}

/* ── il giro, solo mentre si guarda ───────────────────────────────────── */

/* ── l'animazione: la pioggia che cammina (#393) ───────────────────────── */

/* «Un package del meteo possibilmente dinamico.»
 *
 * Il radar c'era gia', ma fermo: un fotogramma solo, l'ultimo misurato. Una
 * fotografia della pioggia dice DOVE piove; la domanda per cui si apre un
 * radar e' DOVE VA, e a quella risponde solo il movimento.
 *
 * I fotogrammi sono gia' tutti a schermo, uno per strato, disegnati una volta
 * sola: qui non si scarica e non si disegna niente, si accende uno strato e si
 * spengono gli altri. Ridisegnare a ogni passo vorrebbe dire chiedere gli
 * stessi quadratini sei volte al secondo. */

/** Chi ha chiesto meno movimento non ne riceve. */
function menoMovimento() {
  try {
    return Boolean(root.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
  } catch (_errore) {
    return false;
  }
}

function strati(nodo) {
  return [...(nodo?.querySelectorAll?.(".dm-radar-strato") || [])];
}

/* Accende il fotogramma numero `posto` e scrive la sua ora. Fuori
 * dall'animazione serve lo stesso: e' quella che accende l'adesso. */
function mostraIlFotogramma(nodo, posto) {
  const fila = strati(nodo);
  if (!fila.length) return;
  const quale = ((posto % fila.length) + fila.length) % fila.length;
  for (const [indice, strato] of fila.entries()) {
    if (indice === quale) strato.dataset.dmVisto = "si";
    else delete strato.dataset.dmVisto;
  }
  const orologio = nodo.querySelector("[data-dm-radar-ora]");
  if (!orologio) return;
  /* L'ora la porta il fotogramma, non l'orologio di chi guarda: e' l'unica
   * cosa che distingue «un'ora fa» da «adesso» mentre l'animazione gira. */
  const scelto = radarScelto();
  const elenco = modelliVivi(scelto);
  const ora = oraDelFotogramma(elenco[quale]?.fotogramma?.time);
  orologio.textContent = ora;
  orologio.hidden = !ora || fila.length < 2;
}

/* Un passo dell'animazione. Sull'ultimo — l'adesso — ci si ferma un attimo di
 * piu': senza, il ritorno indietro sembra un difetto invece che un giro
 * finito. */
/* I blocchi che qualcuno sta guardando: quello della finestra se e' aperta,
 * e quelli dei posti che si vedono. */
function blocchiInVista() {
  const nodi = [];
  if (laFinestraSiVede()) {
    const nodo = bloccoEsistente();
    if (nodo) nodi.push(nodo);
  }
  for (const posto of postiInVista()) {
    const nodo = posto.querySelector(`:scope > .${BLOCCO}`);
    if (nodo) nodi.push(nodo);
  }
  return nodi;
}

function passoDellAnimazione() {
  const nodi = blocchiInVista();
  const nodo = nodi.find((uno) => strati(uno).length > 1);
  const fila = strati(nodo);
  if (!nodo || fila.length < 2) return;
  state.posto = (state.posto + 1) % fila.length;
  for (const uno of nodi) mostraIlFotogramma(uno, state.posto);
  const ultimo = state.posto === fila.length - 1;
  riarma(ultimo ? PAUSA_SULL_ULTIMO : PASSO_ANIMAZIONE);
}

function riarma(fra) {
  if (state.passo) root.clearTimeout?.(state.passo);
  state.passo = root.setTimeout?.(passoDellAnimazione, fra) || 0;
}

function fermaLAnimazione() {
  if (!state.passo) return;
  root.clearTimeout?.(state.passo);
  state.passo = 0;
}

/* L'animazione gira solo se c'e' qualcosa da animare e se ha senso animarlo:
 * la finestra aperta, piu' di un fotogramma, e nessuno che abbia chiesto meno
 * movimento. Negli altri casi resta acceso l'adesso, che e' esattamente cio'
 * che si vedeva prima. */
function regolaLAnimazione() {
  const nodi = blocchiInVista();
  const nodo = nodi.find((uno) => strati(uno).length > 1) || nodi[0] || bloccoEsistente();
  const fila = strati(nodo);
  if (!nodo || fila.length < 2 || !finestraAperta() || menoMovimento()) {
    fermaLAnimazione();
    if (nodo && fila.length) {
      state.posto = fila.length - 1;
      for (const uno of nodi.length ? nodi : [nodo]) mostraIlFotogramma(uno, state.posto);
    }
    return;
  }
  if (!state.passo) riarma(PASSO_ANIMAZIONE);
}

function ferma() {
  fermaLAnimazione();
  if (!state.timer) return;
  root.clearInterval?.(state.timer);
  state.timer = 0;
}

function avvia() {
  if (state.timer) return;
  state.timer =
    root.setInterval?.(() => {
      if (!finestraAperta()) {
        ferma();
        return;
      }
      disegnaRadar();
    }, OGNI) || 0;
}

function guarda() {
  if (!finestraAperta()) {
    ferma();
    return;
  }
  disegnaRadar();
  avvia();
}

/* Il radar si accorge da solo che la finestra si e' aperta (#351).
 *
 * «Da mobile il radar non compare, da desktop si'.»
 *
 * Il disegno partiva da un TOCCO: qualunque clic sul documento riguardava la
 * finestra un decimo di secondo dopo. Funziona finche' il tocco arriva fin qui
 * — e sul telefono, dove la testata e' un'altra e in mezzo ci sono i gestori
 * della navigazione, un tocco fermato per strada e' un radar che non nasce mai.
 * La finestra aperta da qualunque altra strada — un'azione, un ritorno alla
 * pagina — non lo faceva nascere per niente.
 *
 * Adesso si guarda la finestra, che e' la cosa di cui si sta parlando: quando
 * si apre lo dice lei. Il secondo giro poco dopo non e' una ripetizione: la
 * finestra si apre con un'animazione, e finche' dura la larghezza vera del
 * riquadro non c'e' ancora — se si misura solo allora, i quadratini restano
 * calcolati per una misura che non esiste piu'. */
const RIGUARDA_DOPO = 380;

function osservaLaFinestra() {
  const modale = finestra();
  if (!modale || state.osservata === modale) return false;
  if (typeof root.MutationObserver !== "function") return false;
  state.osservatore?.disconnect?.();
  state.osservatore = new root.MutationObserver(() => {
    guarda();
    if (finestraAperta()) root.setTimeout?.(guarda, RIGUARDA_DOPO);
  });
  /* La classe e' come il guscio la apre; lo stile e' come potrebbe aprirla
   * chiunque altro, ed e' l'altra meta' di cio' che `finestraAperta` guarda. */
  state.osservatore.observe(modale, { attributes: true, attributeFilter: ["class", "style"] });
  state.osservata = modale;
  return true;
}

/* ── la prova dell'indirizzo ──────────────────────────────────────────── */

/* Un quadratino solo, scaricato davvero, e la risposta a schermo.
 *
 * E' il pezzo che sostituisce la promessa: chi incolla l'indirizzo di un
 * servizio sa subito se arriva, invece di scoprire che non arriva la prima
 * volta che piove. Si usa un'immagine e non `fetch` apposta: le tessere si
 * caricano come immagini, e un servizio che non manda le intestazioni per le
 * chiamate incrociate passa lo stesso — provarlo con `fetch` direbbe «non
 * funziona» di una cosa che funziona. */
export function provaLIndirizzo(modello, luogo, raggio = RAGGIO_DI_SERIE, tetto = null) {
  return new Promise((risolvi) => {
    /* Prima si guarda che COSA e' stato incollato: «non e' un modello» ha due
     * ragioni molto diverse, e dirle uguali lascia la persona ferma dov'era. */
    const problema = problemaDellIndirizzo(modello);
    if (problema) {
      risolvi({ ok: false, motivo: problema === "vuoto" ? "senza-indirizzo" : problema });
      return;
    }
    const perLaMappa = luogo && finestraDiTessere(luogo.lat, luogo.lon, { raggioKm: raggio });
    /* Il quadratino si chiede al livello a cui lo chiedera' il radar, non a
     * quello della mappa: sotto il tetto la pioggia si chiede piu' larga
     * (`finestraDellaPioggia`), e provarla un gradino piu' su vorrebbe dire
     * provare una cosa che nessuno chiedera' mai. Peggio: quello che torna da
     * sopra il tetto e' un quadratino con dentro stampato «Zoom Level Not
     * Supported», che e' un'immagine come le altre — arriva, e la prova
     * diceva «Arriva: il quadratino c'e'» di un servizio che a quel livello
     * non serve niente. */
    const finestraTessere = perLaMappa
      ? finestraDellaPioggia(luogo.lat, luogo.lon, perLaMappa, tetto) || perLaMappa
      : null;
    const tessera = finestraTessere?.tessere?.[0];
    const url = tessera ? urlDellaTessera(modello, tessera, finestraTessere.zoom) : "";
    if (!url) {
      risolvi({ ok: false, motivo: "senza-indirizzo" });
      return;
    }
    const prova = new root.Image();
    const fine = (esito) => {
      prova.onload = null;
      prova.onerror = null;
      risolvi(esito);
    };
    prova.onload = () => fine({ ok: prova.naturalWidth > 0, motivo: "", url });
    prova.onerror = () => fine({ ok: false, motivo: "non-arriva", url });
    root.setTimeout?.(() => fine({ ok: false, motivo: "troppo-lenta", url }), 8000);
    prova.src = url;
  });
}

/* ── la casella dove si sceglie ───────────────────────────────────────── */

function zoneMarkup(scelta) {
  const zone = zoneDisponibili(allStates());
  const voci = [
    `<option value=""${scelta ? "" : " selected"}>${esc(t("Casa", "Home"))}</option>`,
    ...zone.map(
      (zona) =>
        `<option value="${esc(zona.entity)}"${zona.entity === scelta ? " selected" : ""}>${esc(
          zona.nome,
        )}</option>`,
    ),
  ];
  return voci.join("");
}

/* Un numero da mettere in una casella: vuoto quando non c'e'. Una casella
 * con scritto «null» e' quello che si vedeva. */
function numeroScritto(valore) {
  const testo = clean(valore);
  return /^(null|undefined|nan)$/i.test(testo) ? "" : testo;
}

/* Cosa la tendina deve mostrare: la SCELTA, non il risultato.
 *
 * «Ho inserito il link con l'indirizzo e non lo legge nemmeno.» Chi sceglieva
 * «Un indirizzo mio» e incollava la pagina di un sito vedeva la tendina
 * tornare su «Nessuno»: la tendina mostrava `servizioScelto`, che per un
 * indirizzo non valido risponde «niente», e la scelta sembrava sparita. La
 * tendina resta su quello che si e' scelto, e sotto c'e' scritto cosa non va. */
function sceltaDelServizio(config) {
  const grezzo = clean(config?.servizio);
  if (grezzo === "modello" || grezzo === SERVIZIO_WINDY || SERVIZI_RADAR[grezzo]) return grezzo;
  return servizioScelto(config);
}

/* La frase per ogni esito, una volta sola: la scrive il tasto Prova e la
 * scrive la scheda quando si apre con un indirizzo che non va. */
function fraseDellEsito(motivo) {
  switch (motivo) {
    case "senza-posto":
      return t(
        "Non so dove sia casa: Home Assistant non ha risposto. Scegli una zona o scrivi le coordinate.",
        "I do not know where home is: Home Assistant did not answer. Pick a zone or write the coordinates.",
      );
    case "senza-fotogramma":
      return t(
        "L'elenco dei fotogrammi del servizio non arriva: riprova fra un momento.",
        "The service's list of frames does not arrive: try again in a moment.",
      );
    case "sito":
      return t(
        "Questo è l'indirizzo di una PAGINA, non dei quadratini della mappa: aprendolo si apre un sito, e un sito non si può disegnare qui dentro. Serve l'indirizzo con cui quel servizio pubblica le tessere, che ha {z}/{x}/{y} al posto dei numeri. Se non ce l'hai, scegli un servizio dalla tendina qui sopra.",
        "This is the address of a PAGE, not of the map tiles: opening it opens a website, and a website cannot be drawn in here. What is needed is the address that service publishes its tiles at, the one with {z}/{x}/{y} standing in for the numbers. If you do not have it, pick a service from the list above.",
      );
    case "segnaposto-a-meta":
      return t(
        "All'indirizzo manca un segnaposto: servono tutti e tre — {z} per l'ingrandimento, {x} e {y} per il quadratino. Con uno solo si chiederebbe sempre lo stesso pezzo di mondo.",
        "The address is missing a placeholder: all three are needed — {z} for the zoom, {x} and {y} for the tile. With only one it would always ask for the same piece of the world.",
      );
    case "senza-indirizzo":
    case "vuoto":
      return t(
        "Scegli un servizio dalla tendina, o scrivi un indirizzo con {z}/{x}/{y} dentro.",
        "Pick a service from the list, or write an address with {z}/{x}/{y} in it.",
      );
    case "troppo-lenta":
      return t("Nessuna risposta in otto secondi.", "No answer within eight seconds.");
    case "windy":
      return t(
        "Windy si mostra in un riquadro con la sua mappa, la sua pioggia e la sua legenda, centrato sul posto scelto qui sotto. A Windy arrivano solo il punto, lo zoom e lo strato: il riquadro non può leggere né la plancia né Home Assistant.",
        "Windy shows up in a frame with its own map, rain and legend, centred on the place chosen below. Windy only receives the point, the zoom and the layer: the frame cannot read the dashboard or Home Assistant.",
      );
    case "windy-collegamento":
      return t(
        "È un collegamento di Windy: il radar mostra la mappa di Windy in un riquadro, con il punto e lo zoom del collegamento se li ha. A Windy arrivano solo quelli.",
        "This is a Windy link: the radar shows the Windy map in a frame, with the link's point and zoom if it has them. Windy only receives those.",
      );
    case "windy-prova":
      return t(
        "Windy non si prova da qui: è una pagina dentro un riquadro, e il browser non dice alla plancia se è arrivata. Se il riquadro resta vuoto, questo dispositivo non raggiunge embed.windy.com.",
        "Windy cannot be tested from here: it is a page inside a frame, and the browser does not tell the dashboard whether it arrived. If the frame stays empty, this device cannot reach embed.windy.com.",
      );
    default:
      return t(
        "Non arriva. Controlla l'indirizzo, e che il servizio si lasci leggere da qui.",
        "It does not arrive. Check the address, and that the service lets this page read it.",
      );
  }
}

/* Quello che non va dell'indirizzo scritto a mano, se qualcosa non va. */
function problemaDellaScelta(config) {
  if (clean(config?.servizio) !== "modello") return "";
  if (daIndirizzoWindy(config?.modello)) return "";
  return problemaDellIndirizzo(clean(config?.modello));
}

/* Quale frase di Windy va sotto la tendina, se ce n'e' una. */
function fraseWindyDellaScelta(config) {
  const servizio = clean(config?.servizio);
  if (servizio === SERVIZIO_WINDY) return "windy";
  if (servizio === "modello" && daIndirizzoWindy(config?.modello)) return "windy-collegamento";
  return "";
}

/* La riga sotto la casella dice subito cosa non va, non solo dopo «Prova»:
 * chi incolla l'indirizzo di un sito lo sa mentre lo incolla. */
function mostraIlProblema(dentro, config) {
  const esito = dentro?.querySelector?.("[data-dm-radar-esito]");
  if (!esito || state.provando) return false;
  const problema = problemaDellaScelta(config);
  if (problema) {
    esito.dataset.dmEsito = "male";
    esito.textContent = fraseDellEsito(problema);
    return true;
  }
  const diWindy = fraseWindyDellaScelta(config);
  if (diWindy) {
    esito.dataset.dmEsito = "windy";
    scriviTestoSeCambia(esito, fraseDellEsito(diWindy));
    return false;
  }
  if (esito.dataset.dmEsito === "male" || esito.dataset.dmEsito === "windy") {
    delete esito.dataset.dmEsito;
    esito.textContent = FRASE_DI_SERIE();
  }
  return false;
}

/* Il radar configurato male, per la finestra delle previsioni.
 *
 * «Radar continua a non uscire.» Con «Un indirizzo mio» e l'indirizzo di un
 * sito il blocco non nasceva affatto, e chi lo cercava non trovava nemmeno
 * un perche'. Adesso il blocco c'e' e dice cosa correggere. Con «Nessuno»
 * scelto apposta non c'e' niente da dire, e infatti non si dice. */
function radarGuasto(grezzo = configurazione()) {
  const problema = problemaDellaScelta(grezzo);
  if (!problema) return "";
  return problema === "vuoto"
    ? t(
        "Hai scelto «Un indirizzo mio» ma non c'è un indirizzo.",
        "You picked «An address of mine» but there is no address.",
      )
    : t(
        "L'indirizzo del radar non è un indirizzo di tessere ({z}/{x}/{y}).",
        "The radar address is not a tile address ({z}/{x}/{y}).",
      );
}

const FRASE_DI_SERIE = () =>
  t(
    "Di serie la pioggia arriva da RainViewer e la mappa da OpenStreetMap: basta scegliere dove. Puoi cambiare servizio dalla tendina, oppure «Un indirizzo mio» e scrivere quello che pubblica il servizio che vuoi usare, con {z}/{x}/{y} al posto dei numeri del quadratino. Il tasto Prova ne scarica uno e ti dice se arriva.",
    "Out of the box the rain comes from RainViewer and the map from OpenStreetMap: just pick where. You can change the service from the list, or «An address of mine» and write the one your service publishes, with {z}/{x}/{y} standing in for the tile numbers. Test downloads one and tells you whether it arrives.",
  );

/* Le voci della tendina dei servizi: quelli che si conoscono, e «un indirizzo
 * mio» per chi ne ha un altro. I nomi dei servizi sono marchi, non parole da
 * tradurre. */
function serviziMarkup(scelta) {
  const voci = [
    `<option value="nessuno"${scelta ? "" : " selected"}>${esc(t("— Nessuno —", "— None —"))}</option>`,
    ...Object.entries(SERVIZI_RADAR).map(
      ([chiave, servizio]) =>
        `<option value="${esc(chiave)}"${chiave === scelta ? " selected" : ""}>${esc(servizio.nome)}</option>`,
    ),
    /* Windy non e' un servizio di tessere: e' la sua mappa in un riquadro. */
    `<option value="${SERVIZIO_WINDY}"${scelta === SERVIZIO_WINDY ? " selected" : ""}>${esc(
      t("Windy (mappa in un riquadro)", "Windy (map in a frame)"),
    )}</option>`,
    `<option value="modello"${scelta === "modello" ? " selected" : ""}>${esc(
      t("Un indirizzo mio ({z}/{x}/{y})", "An address of mine ({z}/{x}/{y})"),
    )}</option>`,
  ];
  return voci.join("");
}

/* La mappa di fondo scelta, come chiave della tendina. Un indirizzo scritto
 * dentro `fondo` prima della tendina e' «un indirizzo mio». */
function fondoScelto(config) {
  const fondo = clean(config.fondo);
  if (NIENTE.includes(fondo.toLowerCase())) return "";
  if (FONDI_MAPPA[fondo]) return fondo;
  if (fondo === "modello" || /\{[zxy]\}/.test(fondo) || clean(config.fondoModello))
    return "modello";
  return FONDO_DI_SERIE;
}

function fondoMio(config) {
  const fondo = clean(config.fondo);
  return clean(config.fondoModello) || (/\{[zxy]\}/.test(fondo) ? fondo : "");
}

function fondiMarkup(scelta) {
  const voci = [
    `<option value="nessuna"${scelta ? "" : " selected"}>${esc(t("Nessuna", "None"))}</option>`,
    ...Object.entries(FONDI_MAPPA).map(
      ([chiave, fondo]) =>
        `<option value="${esc(chiave)}"${chiave === scelta ? " selected" : ""}>${esc(fondo.nome)}</option>`,
    ),
    `<option value="modello"${scelta === "modello" ? " selected" : ""}>${esc(
      t("Un indirizzo mio ({z}/{x}/{y})", "An address of mine ({z}/{x}/{y})"),
    )}</option>`,
  ];
  return voci.join("");
}

/* Le caselle dell'indirizzo compaiono solo quando servono: con un servizio
 * scelto dalla tendina non c'e' niente da scrivere, e una casella vuota
 * sotto una scelta gia' fatta chiede di essere riempita. */
function aggiornaVisibilita(dentro) {
  const servizio = clean(dentro?.querySelector?.('[data-dm-radar-campo="servizio"]')?.value);
  const fondo = clean(dentro?.querySelector?.('[data-dm-radar-campo="fondo"]')?.value);
  const modello = dentro?.querySelector?.('[data-dm-radar-campo="modello"]')?.value;
  /* Con Windy — scelto o incollato — la mappa di fondo, il tetto della
   * pioggia, l'animazione e la prova dei quadratini non c'entrano: e' tutto
   * suo. */
  const diWindy =
    servizio === SERVIZIO_WINDY || (servizio === "modello" && Boolean(daIndirizzoWindy(modello)));
  for (const riga of dentro?.querySelectorAll?.("[data-dm-radar-solo]") || []) {
    const quando = clean(riga.dataset.dmRadarSolo);
    riga.hidden =
      quando === "modello"
        ? servizio !== "modello"
        : quando === "fondo-modello"
          ? fondo !== "modello" || diWindy
          : quando === "tessere"
            ? diWindy
            : false;
  }
}

/* ── le tre strade: nessuno, un servizio di mappe, una camera di casa ─────
 *
 * La casella stava sotto il meteo nella scheda Home, e chiedeva tutto in una
 * volta: l'entita', e «oppure» il servizio, la mappa, l'indirizzo, la zona, lo
 * zoom e le coordinate. Chi voleva solo spegnerlo doveva capire quale delle
 * dieci caselle lo spegneva. Adesso sta nella scheda Meteo (#206) e si
 * comincia dalla domanda vera — da dove arriva il radar — e si compila solo
 * la strada scelta. La configurazione e' la stessa di prima, `cd_radar_meteo`:
 * le tre strade sono tre modi di scriverla, non tre chiavi nuove. */

/** Da quale strada arriva il radar adesso: «entita», «mappa» o «nessuno». */
export function fonteDelRadar(config = configurazione()) {
  const scelto = radarScelto(config);
  /* Windy e' un servizio di mappe come gli altri, per chi sceglie: la sua
   * strada e' quella delle mappe. */
  if (scelto) return scelto.modo === "windy" ? "mappa" : scelto.modo;
  /* La camera scelta prima di avere scritto quale: la strada resta quella, e
   * la casella aspetta l'entita'. */
  if (clean(config?.strada) === "entita") return "entita";
  /* Un indirizzo sbagliato e' la strada delle mappe, presa male: la scheda la
   * tiene aperta, perche' e' li' che si corregge. */
  return problemaDellaScelta(config) ? "mappa" : "nessuno";
}

/** La camera o l'immagine di casa che sembra un radar, se ce n'e' una. */
export function radarDaProporre(states = allStates()) {
  for (const [entity, stato] of Object.entries(states || {})) {
    if (!CON_IMMAGINE.has(entity.split(".")[0])) continue;
    const nome = `${entity} ${clean(stato?.attributes?.friendly_name)}`.toLowerCase();
    if (/(radar|piogg|precipit|rain|meteo|weather)/.test(nome)) return entity;
  }
  return "";
}

/* La configurazione dopo aver scelto una strada. «Nessuno» si scrive come
 * l'ha sempre scritto la tendina; le mappe tornano al servizio di serie solo
 * se prima non ce n'era uno; la camera prende quella che c'era, o quella
 * proposta. */
function conLaFonte(config, fonte, proposta = "") {
  const prossima = { ...config, strada: fonte };
  if (fonte === "nessuno") {
    prossima.servizio = "nessuno";
    prossima.entity = "";
  } else if (fonte === "mappa") {
    prossima.entity = "";
    const servizio = clean(config.servizio);
    if (!SERVIZI_RADAR[servizio] && servizio !== "modello" && servizio !== SERVIZIO_WINDY)
      prossima.servizio = SERVIZIO_DI_SERIE;
  } else if (fonte === "entita") {
    prossima.entity = clean(config.entity) || proposta;
    /* Senza un'entita' la camera non c'e' ancora, e il radar resta spento:
     * le mappe di prima non devono continuare a comparire al suo posto. */
    if (!prossima.entity) prossima.servizio = "nessuno";
  }
  return prossima;
}

function fontiMarkup(fonte, proposta) {
  const voci = [
    [
      "nessuno",
      t("Nessuno", "None"),
      t("il blocco del radar non compare", "the radar block does not show"),
    ],
    [
      "mappa",
      t("Servizio di mappe", "Map service"),
      t("RainViewer, senza chiavi: basta dire dove", "RainViewer, no keys: just say where"),
    ],
    [
      "entita",
      t("Camera di Home Assistant", "Home Assistant camera"),
      proposta || t("un'entità camera o image che hai già", "a camera or image entity you already have"),
    ],
  ];
  /* Se in casa c'e' gia' un radar, la sua strada si propone per prima: e'
   * quella che non esce di casa. */
  if (proposta) voci.unshift(voci.pop());
  return `<div class="dm-radar-fonti" role="group" aria-label="${esc(t("Radar pioggia", "Rain radar"))}">${voci
    .map(
      ([chiave, nome, sotto]) =>
        `<button type="button" class="dm-radar-fonte" data-dm-radar-fonte="${chiave}" aria-pressed="${String(
          chiave === fonte,
        )}"><b>${chiave === fonte ? "● " : "○ "}${esc(nome)}</b><small>${esc(sotto)}</small></button>`,
    )
    .join("")}</div>`;
}

/** La scheda del radar, da mettere dove la vuole chi la ospita: la scheda Meteo. */
export function editorDelRadarMarkup(config = configurazione(), states = allStates()) {
  return `<div class="dm-radar-ed" data-dm-radar-ed>${casellaMarkup(config, states)}</div>`;
}

/** Dopo averla messa a schermo: le righe che si vedono e il problema, se c'e'. */
export function preparaLEditorDelRadar(dentro) {
  if (!dentro) return false;
  aggiornaVisibilita(dentro);
  mostraIlProblema(dentro, configurazione());
  return true;
}

function casellaMarkup(config, states = allStates()) {
  const fonte = fonteDelRadar(config);
  const proposta = radarDaProporre(states);
  const privacy = `<div class="dm-radar-privacy"><span aria-hidden="true">🔒</span><small>${esc(
    t(
      "Il browser chiede al servizio i quadratini della zona che guardi: quel servizio sa quindi che zona è. Scegli «Nessuno» e la plancia non bussa a nessuno.",
      "The browser asks the service for the tiles of the area you are looking at: that service then knows which area it is. Pick «None» and the dashboard knocks on nobody's door.",
    ),
  )}</small></div>`;
  return `${fontiMarkup(fonte, proposta)}${
    fonte === "entita" ? entitaMarkup(config, proposta) : fonte === "mappa" ? mappaMarkup(config) : ""
  }${privacy}`;
}

function entitaMarkup(config, proposta) {
  return `<span class="ed-form-row"><input id="dm-radar-entita" class="ed-input mono"
      data-dm-radar-campo="entity" value="${esc(clean(config.entity))}"
      placeholder="${esc(proposta || "camera.radar")}" autocomplete="off" spellcheck="false"><button type="button"
      class="dm-entity-picker" data-dm-radar-pick="dm-radar-entita"
      aria-label="${esc(t("Scegli entità", "Choose entity"))}">🔍</button></span>
    <small>${esc(
      t(
        "Un'entità camera o image del tuo Home Assistant: il fotogramma passa dal tuo server e da casa non esce niente. Chi ha portato dentro il radar con la sua integrazione ha già l'entità qui sotto.",
        "A camera or image entity of your own Home Assistant: the frame comes from your own server and nothing leaves the house. If you brought a radar in with its integration, the entity is already there.",
      ),
    )}</small>`;
}

function mappaMarkup(config) {
  return `<div class="dm-radar-dove">
      <label><span class="dm-radar-lbl">${esc(t("Servizio radar", "Radar service"))}</span>
        <select class="ed-input" data-dm-radar-campo="servizio">${serviziMarkup(sceltaDelServizio(config))}</select>
      </label>
      <label data-dm-radar-solo="tessere"><span class="dm-radar-lbl">${esc(t("Mappa di fondo", "Base map"))}</span>
        <select class="ed-input" data-dm-radar-campo="fondo">${fondiMarkup(fondoScelto(config))}</select>
      </label>
    </div>
    <span class="ed-form-row" data-dm-radar-solo="modello"><input id="dm-radar-modello" class="ed-input mono"
      data-dm-radar-campo="modello" value="${esc(clean(config.modello))}"
      placeholder="https://…/{z}/{x}/{y}.png" autocomplete="off" spellcheck="false"></span>
    <span class="ed-form-row" data-dm-radar-solo="fondo-modello"><input class="ed-input mono"
      data-dm-radar-campo="fondoModello" value="${esc(fondoMio(config))}"
      placeholder="https://…/{z}/{x}/{y}.png" autocomplete="off" spellcheck="false"></span>
    <span class="ed-form-row dm-radar-prova-riga" data-dm-radar-solo="tessere"><button
      type="button" class="dm-radar-prova" data-dm-radar-prova>${esc(t("Prova", "Test"))}</button></span>
    <small class="dm-radar-esito" data-dm-radar-esito>${esc(FRASE_DI_SERIE())}</small>
    <div class="dm-radar-dove">
      <label><span class="dm-radar-lbl">${esc(t("Dove", "Where"))}</span>
        <select class="ed-input" data-dm-radar-campo="zona">${zoneMarkup(clean(config.zona))}</select>
      </label>
      <label><span class="dm-radar-lbl">${esc(t("Raggio (km)", "Radius (km)"))}</span>
        <input class="ed-input" type="number" min="1" max="500" data-dm-radar-campo="raggio"
          value="${esc(String(config.raggio ?? RAGGIO_DI_SERIE))}"></label>
      <label data-dm-radar-solo="tessere"><span class="dm-radar-lbl">${esc(t("Zoom massimo della pioggia", "Rain zoom cap"))}</span>
        <input class="ed-input" type="number" min="0" max="12" step="1"
          data-dm-radar-campo="zoomPioggia" value="${esc(numeroScritto(config.zoomPioggia))}"
          placeholder="${esc(numeroScritto(zoomDellaPioggia({}, servizioScelto(config))))}"></label>
    </div>
    <label class="dm-radar-animato" data-dm-radar-solo="tessere"><input type="checkbox" data-dm-radar-campo="animato"
      ${clean(config.animato) === "no" ? "" : "checked"}><span>${esc(
        t("Radar animato", "Animated radar"),
      )}</span></label>
    <small data-dm-radar-solo="tessere">${esc(
      t(
        "Acceso, il radar mostra l'ultima ora di pioggia in movimento: si vede da che parte va il fronte, non solo dov'è adesso. Sono sei fotogrammi invece di uno, quindi sei giri di quadratini: spegnilo se la connessione è lenta o se preferisci una sola immagine.",
        "On, the radar plays the last hour of rain: you see which way the front is moving, not only where it is now. That is six frames instead of one, so six rounds of tiles: turn it off on a slow connection, or if you prefer a single image.",
      ),
    )}</small>
    <div class="dm-radar-dove">
      <label><span class="dm-radar-lbl">${esc(t("Latitudine", "Latitude"))}</span>
        <input class="ed-input mono" data-dm-radar-campo="lat" value="${esc(clean(config.lat))}"
          placeholder="41.9028" autocomplete="off"></label>
      <label><span class="dm-radar-lbl">${esc(t("Longitudine", "Longitude"))}</span>
        <input class="ed-input mono" data-dm-radar-campo="lon" value="${esc(clean(config.lon))}"
          placeholder="12.4964" autocomplete="off"></label>
    </div>
    <small>${esc(
      t(
        "Le coordinate scritte a mano vincono su tutto; se le lasci vuote vale la zona qui sopra, e se non scegli niente vale casa. Per un posto che non è casa tua, creagli una zona in Home Assistant: comparirà nella tendina col suo nome.",
        "Coordinates typed by hand win over everything; leave them empty and the zone above is used, and with no choice at all it is home. For somewhere that is not your house, give it a zone in Home Assistant: it shows up in the list under its own name.",
      ),
    )}</small>`;
}

/* La casella stava accanto a quelle del meteo, nella fisarmonica della scheda
 * Home: la stessa domanda — che tempo fa — in un posto solo. Adesso il posto
 * solo e' la scheda Meteo (#206), che la monta con `editorDelRadarMarkup`
 * insieme alle previsioni e alla stazione. */

function raccogli(dentro) {
  const prossima = { ...configurazione() };
  for (const campo of dentro.querySelectorAll("[data-dm-radar-campo]")) {
    /* Una spunta non ha un `value` che voglia dire qualcosa: dice si' o no.
     *
     * E il si' si scrive VUOTO, non "si": `radarToccato` guarda se qualcosa e'
     * stato scritto per decidere se questa casa il radar l'ha configurato, e
     * un valore di serie scritto dentro la farebbe passare per configurata a
     * chi non ha scelto niente. Il no invece e' una scelta, e si scrive. */
    const valore =
      campo.type === "checkbox" ? (campo.checked ? "" : "no") : clean(campo.value);
    prossima[clean(campo.dataset.dmRadarCampo)] = valore;
  }
  return prossima;
}

function onCambio(event) {
  const campo = event.target?.closest?.("[data-dm-radar-campo]");
  if (!campo) return;
  const dentro = campo.closest(".dm-radar-ed");
  if (!dentro) return;
  const config = raccogli(dentro);
  salva(config);
  aggiornaVisibilita(dentro);
  mostraIlProblema(dentro, config);
  disegnaRadar();
}

async function onClick(event) {
  /* Una strada scelta si scrive subito, e la scheda mostra le caselle di
   * quella strada e basta. */
  const strada = event.target?.closest?.("[data-dm-radar-fonte]");
  if (strada) {
    event.preventDefault();
    const dentro = strada.closest(".dm-radar-ed");
    if (!dentro) return;
    const config = conLaFonte(
      raccogli(dentro),
      clean(strada.dataset.dmRadarFonte),
      radarDaProporre(),
    );
    salva(config);
    dentro.innerHTML = casellaMarkup(config);
    preparaLEditorDelRadar(dentro);
    disegnaRadar();
    return;
  }
  const pick = event.target?.closest?.("[data-dm-radar-pick]");
  if (pick) {
    event.preventDefault();
    const input = doc?.getElementById?.(clean(pick.dataset.dmRadarPick));
    if (input) root.wzPickEntity?.(input);
    return;
  }

  const prova = event.target?.closest?.("[data-dm-radar-prova]");
  if (prova) {
    event.preventDefault();
    if (state.provando) return;
    const dentro = prova.closest(".dm-radar-ed");
    const esito = dentro?.querySelector("[data-dm-radar-esito]");
    if (!dentro || !esito) return;
    const config = raccogli(dentro);
    salva(config);
    /* Windy non ha un quadratino da scaricare: si dice perche', invece di
     * provare una cosa che non c'e'. */
    if (radarScelto(config)?.modo === "windy") {
      esito.dataset.dmEsito = "windy";
      esito.textContent = fraseDellEsito("windy-prova");
      disegnaRadar();
      return;
    }
    state.provando = true;
    esito.dataset.dmEsito = "prova";
    esito.textContent = t("Provo…", "Testing…");
    const scelto = radarScelto(config);
    /* Casa e il fotogramma del servizio si ASPETTANO, qui: chi preme «Prova»
     * vuole una risposta, non un «riprova fra un po'». */
    if (!luogoDelRadar(scelto || config, allStates(), casaNota()))
      await chiediLaCasa({ aspetta: true });
    if (scelto?.servizio && SERVIZI_RADAR[scelto.servizio] && !modelloVivo(scelto))
      await aggiornaFotogramma(scelto.servizio);
    const luogo = luogoDelRadar(scelto || config, allStates(), casaNota());
    const modello = scelto?.modo === "mappa" ? modelloVivo(scelto) : "";
    const risposta = !luogo
      ? { ok: false, motivo: "senza-posto" }
      : scelto?.servizio && SERVIZI_RADAR[scelto.servizio] && !modello
        ? { ok: false, motivo: "senza-fotogramma" }
        : await provaLIndirizzo(
            modello,
            luogo,
            Number(config.raggio),
            zoomDellaPioggia(config, servizioScelto(config)),
          );
    state.provando = false;
    esito.dataset.dmEsito = risposta.ok ? "bene" : "male";
    esito.textContent = risposta.ok
      ? t("Arriva: il quadratino c'è.", "It arrives: the tile is there.")
      : fraseDellEsito(risposta.motivo);
    disegnaRadar();
    return;
  }

  /* Qui non si riguarda piu' la finestra a ogni tocco del documento: adesso e'
   * la finestra stessa a dire quando si apre (`osservaLaFinestra`), e un tocco
   * che si perde per strada non lascia piu' il radar senza nascere. */
}

function installStyles() {
  /* Il foglio e' scritto per la finestra delle previsioni, e vale uguale per
   * ogni altro posto del radar (#206): si scrive una volta, e si allarga a
   * chi lo ospita al momento di montarlo. Due copie dello stesso foglio
   * sarebbero due radar che col tempo smettono di somigliarsi. */
  const foglio = `
      #weather-modal .dm-radar-blocco{display:grid;gap:8px;margin-bottom:14px}
      /* Una regola nostra col display batte l'attributo hidden del browser:
         senza questa riga, nascondere il blocco non lo nascondeva. */
      #weather-modal .dm-radar-blocco[hidden]{display:none!important}
      /* Mentre i quadratini arrivano non si dice ne' l'una ne' l'altra cosa:
         l'immagine rotta e la frase dell'errore restano tutte e due fuori. */
      #weather-modal .dm-radar-blocco[data-dm-radar="attesa"] .dm-radar-img{display:none}
      #weather-modal .dm-radar-blocco[data-dm-radar="attesa"] .dm-radar-muto{display:none}
      #weather-modal .dm-radar-testa{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
      #weather-modal .dm-radar-testa strong{
        font-size:13px;font-weight:900;letter-spacing:.04em;text-transform:uppercase;
        color:var(--text,#0f172a)}
      #weather-modal .dm-radar-nota{font-size:11px;color:var(--text-dim,#64748b)}
      /* La legenda sotto la mappa: senza, un radar su un cielo sereno e' una
         mappa e basta, e chi guarda pensa che manchi il radar. */
      #weather-modal .dm-radar-legenda{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px;font-size:11px;color:var(--text-dim,#64748b)}
      #weather-modal .dm-radar-scala{flex:0 0 96px;height:8px;border-radius:4px;background:linear-gradient(90deg,#a1d7ff,#3b8bff,#1d4ed8,#facc15,#f97316,#dc2626)}
      #weather-modal .dm-radar-vuoto{margin-left:auto;font-style:italic}
      #weather-modal .dm-radar-blocco[data-dm-modo="entita"] .dm-radar-legenda{display:none}
      /* Windy porta la sua legenda, il suo orologio e la sua mappa: le nostre
         sopra sarebbero un doppione che non corrisponde a quello che si vede.
         Il riquadro sta dentro la stessa cornice arrotondata del radar a
         tessere, chiaro o scuro che sia il tema. */
      #weather-modal .dm-radar-blocco[data-dm-modo="windy"] .dm-radar-legenda,
      #weather-modal .dm-radar-blocco[data-dm-modo="windy"] .dm-radar-mirino,
      #weather-modal .dm-radar-blocco[data-dm-modo="windy"] .dm-radar-img,
      #weather-modal .dm-radar-blocco[data-dm-modo="windy"] .dm-radar-ora,
      #weather-modal .dm-radar-blocco[data-dm-modo="windy"] .dm-radar-fondo-muto{display:none}
      /* color-scheme normale: con il tema scuro della plancia e una pagina
         dentro che non ne dichiara uno, il browser stende un fondo bianco
         opaco sotto il riquadro; cosi' finche' Windy non disegna si vede il
         fondo del quadro, scuro o chiaro come il resto. */
      #weather-modal .dm-radar-windy{position:absolute;inset:0;width:100%;height:100%;border:0;display:block;
        background:var(--bg-sculpted,#0b1220);color-scheme:normal}
      /* Configurato male: resta la testa con la spiegazione, il quadro no. */
      #weather-modal .dm-radar-blocco[data-dm-modo="guasto"] .dm-radar-quadro,
      #weather-modal .dm-radar-blocco[data-dm-modo="guasto"] .dm-radar-legenda{display:none}
      #weather-modal .dm-radar-blocco[data-dm-modo="guasto"] .dm-radar-nota{
        display:block;white-space:normal;color:#b45309;font-weight:700}
      #weather-modal .dm-radar-quadro{
        position:relative;display:grid;place-items:center;min-height:${ALTEZZA_MINIMA}px;overflow:hidden;
        border-radius:16px;background:var(--bg-sculpted,#0b1220);
        border:1px solid var(--card-border,#1e293b)}
      #weather-modal .dm-radar-tessere{position:absolute;inset:0}
      #weather-modal .dm-radar-t{position:absolute;display:block;image-rendering:auto}
      /* Il fondo sotto, la pioggia sopra: due strati, un ordine solo. */
      #weather-modal .dm-radar-fondo{opacity:.85;filter:saturate(.7)}
      /* Un fotogramma per strato, tutti impilati e uno solo acceso (#393).
         Si spengono con l'opacita' e non con display:none: il browser tiene
         le immagini decodificate e il passo non sfarfalla. Il velo dura meno
         del passo, altrimenti due fotogrammi si sovrappongono. */
      #weather-modal .dm-radar-strato{
        position:absolute;inset:0;opacity:0;transition:opacity 160ms linear;
        pointer-events:none}
      #weather-modal .dm-radar-strato[data-dm-visto="si"]{opacity:1}
      /* L'ora del fotogramma che si sta guardando: senza, «un'ora fa» e
         «adesso» si somigliano troppo per distinguerli. */
      #weather-modal .dm-radar-ora{
        position:absolute;right:8px;top:8px;padding:2px 8px;border-radius:999px;
        font-size:11px;font-weight:800;letter-spacing:.02em;
        color:#f8fafc;background:rgba(15,23,42,.72);
        font-variant-numeric:tabular-nums;pointer-events:none}
      #weather-modal .dm-radar-blocco[data-dm-modo="entita"] .dm-radar-ora{display:none}
      #weather-modal .dm-radar-blocco[data-dm-radar="muto"] .dm-radar-ora{display:none}
      /* Chi ha chiesto meno movimento vede il fotogramma di adesso e basta:
         lo decide anche il codice, ma il velo lo toglie comunque questa. */
      @media (prefers-reduced-motion: reduce){
        #weather-modal .dm-radar-strato{transition:none}
      }
      #weather-modal .dm-radar-img{width:100%;height:auto;display:block;position:relative}
      /* Il mirino al centro: senza, un radar e' una macchia e non si sa dove
         si sta guardando. */
      #weather-modal .dm-radar-blocco[data-dm-modo="mappa"] .dm-radar-mirino{
        position:absolute;left:50%;top:50%;width:13px;height:13px;margin:-7px 0 0 -7px;
        border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 2px rgba(15,23,42,.55);
        pointer-events:none}
      #weather-modal .dm-radar-blocco[data-dm-modo="entita"] .dm-radar-mirino{display:none}
      #weather-modal .dm-radar-blocco[data-dm-modo="mappa"] .dm-radar-img{display:none}
      #weather-modal .dm-radar-blocco[data-dm-radar="muto"] .dm-radar-img{display:none}
      #weather-modal .dm-radar-muto{
        font-size:12px;font-weight:700;color:var(--text-dim,#64748b);position:relative}
      #weather-modal .dm-radar-blocco[data-dm-radar="vivo"] .dm-radar-muto{display:none}
      /* Il fondo che non risponde si dice, ma senza rubare la scena: quando a
         mancare e' la pioggia parla l'altra frase, che e' la piu' grave delle
         due. Si vede solo a radar vivo e fondo muto — cioe' nel caso della
         segnalazione, «vedevo la perturbazione ma non la mappa». */
      #weather-modal .dm-radar-fondo-muto{display:none;
        position:absolute;left:8px;right:8px;bottom:8px;padding:6px 10px;border-radius:10px;
        font-size:11px;font-weight:700;line-height:1.35;
        color:#92400e;background:rgba(254,243,199,.94);border:1px solid #fcd34d}
      #weather-modal .dm-radar-blocco[data-dm-radar="vivo"][data-dm-fondo="muto"] .dm-radar-fondo-muto{
        display:block}
      /* Il nome di chi disegna la mappa: Esri lo chiede, OpenStreetMap pure. */
      #weather-modal .dm-radar-firma{color:var(--text-dim,#64748b);font-size:10px;font-weight:700}
      #weather-modal .dm-radar-firma:empty{display:none}
      #ed-body .dm-radar-ed small{
        display:block;margin:3px 2px 6px;font-size:11px;line-height:1.45;
        color:var(--text-dim,#64748b)}
      #ed-body .dm-radar-oppure{
        margin:10px 2px 4px;font-size:10.5px;font-weight:800;letter-spacing:.05em;
        text-transform:uppercase;color:var(--text-dim,#64748b)}
      /* L'interruttore dell'animazione: una riga con la spunta a sinistra,
         come le altre scelte a due valori della configurazione. */
      #ed-body .dm-radar-animato{
        display:flex;align-items:center;gap:9px;margin:10px 2px 2px;
        font-size:12.5px;font-weight:700;cursor:pointer}
      #ed-body .dm-radar-animato input{width:16px;height:16px;margin:0;cursor:pointer;flex:0 0 auto}
      #ed-body .dm-radar-prova{
        flex:0 0 auto;padding:0 14px;height:38px;border:1px solid var(--card-border,#e2e8f0);
        border-radius:10px;background:var(--card-background-color,#fff);cursor:pointer;
        font:inherit;font-size:12px;font-weight:800;color:var(--primary-color,#0ea5e9)}
      #ed-body .dm-radar-esito[data-dm-esito="bene"]{color:#059669;font-weight:700}
      #ed-body .dm-radar-esito[data-dm-esito="male"]{color:#dc2626;font-weight:700}
      #ed-body .dm-radar-esito[data-dm-esito="windy"]{color:var(--text,#0f172a);font-weight:600}
      #ed-body .dm-radar-dove{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:4px 0}
      /* Le caselle dell'indirizzo si vedono solo con «un indirizzo mio»: la
         riga del guscio ha un display suo, e hidden da solo non la batte. */
      #ed-body .dm-radar-ed [data-dm-radar-solo][hidden]{display:none!important}
      #ed-body .dm-radar-prova-riga{justify-content:flex-end;margin-top:4px}
      #ed-body .dm-radar-dove label{display:block;min-width:0}
      /* Le etichette qui dentro non sono caselle da rinominare: il foglio del
         guscio appende una matita a ogni ed-slot-lbl, e la matita direbbe
         «questo si puo' ribattezzare» di un campo che si compila e basta. */
      #ed-body .dm-radar-lbl{
        display:block;margin:0 2px 4px;font-size:11px;font-weight:800;letter-spacing:.04em;
        text-transform:uppercase;color:var(--text-dim,#64748b)}
      #ed-body .dm-radar-dove .ed-input{width:100%}
      /* Le tre strade, come tre tasti: si sceglie da dove arriva il radar
         prima di compilare qualcosa, e si compila solo quello che serve. */
      #ed-body .dm-radar-fonti{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:2px 0 10px}
      #ed-body .dm-radar-fonte{display:grid;gap:3px;padding:11px 12px;border-radius:14px;cursor:pointer;text-align:left;font:inherit;
        border:1px solid var(--card-border,#e2e8f0);background:var(--surface-2,#f8fafc);color:var(--text,#0f172a)}
      #ed-body .dm-radar-fonte b{font-size:13px;font-weight:900}
      #ed-body .dm-radar-ed .dm-radar-fonte small{margin:0;font-size:10.5px;font-weight:700;line-height:1.3}
      #ed-body .dm-radar-fonte[aria-pressed="true"]{border-color:#0ea5e9;
        background:color-mix(in srgb,#0ea5e9 10%,var(--card-bg,#fff));
        box-shadow:0 0 0 3px color-mix(in srgb,#0ea5e9 18%,transparent)}
      #ed-body .dm-radar-privacy{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-radius:12px;margin-top:8px;
        background:color-mix(in srgb,#16a34a 8%,transparent);border:1px solid color-mix(in srgb,#16a34a 26%,transparent)}
      #ed-body .dm-radar-ed .dm-radar-privacy small{margin:0;font-size:11.5px;font-weight:700;color:var(--text,#0f172a)}
      @media(max-width:760px){#ed-body .dm-radar-fonti{grid-template-columns:minmax(0,1fr)}}
    `;
  installStyle(
    "dm-radar-meteo",
    foglio.replaceAll("#weather-modal .dm-radar", `:is(#weather-modal,.${POSTO_DEL_RADAR}) .dm-radar`),
  );
}

export function installRadarMeteo() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  doc.addEventListener("change", onCambio);
  doc.addEventListener("input", onCambio);
  doc.addEventListener("click", onClick);
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:editor-rendered",
    "dashboardmodern:states-ready",
  ])
    root.addEventListener?.(evento, () => {
      osservaLaFinestra();
      guarda();
    });
  osservaLaFinestra();
  guarda();
  return true;
}
