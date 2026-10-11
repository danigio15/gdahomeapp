/* I deumidificatori, dentro il Clima (#205).
 *
 * «Problemi di comunicazione con dei deumidificatori Comfee tramite Midea: non
 * riconosciuti con tutti i comandi del dispositivo. Li ho integrati su Home
 * Assistant e funzionano benissimo.»
 *
 * Funzionavano in Home Assistant e non qui perche' qui l'unico posto per loro
 * era un'unita' del Clima, cioe' un termostato: la card chiedeva i gradi, la
 * modalita' caldo/freddo e il `climate.set_hvac_mode`, e un deumidificatore non
 * ha niente di tutto questo. Ha un'entita' `humidifier`, con l'umidita' che
 * vuole, quella che c'e', le sue modalita' (Auto, Continuo, Asciuga bucato…),
 * e intorno il serbatoio pieno, la ventola, la temperatura e i watt.
 *
 * Qui c'e' la regola: chi e' configurato, cosa dice adesso, e quale servizio
 * chiamare per ogni tasto. E' puro — entrano la configurazione e gli stati,
 * escono la lettura e il comando — cosi' si prova a tavolino invece che con un
 * deumidificatore acceso in salotto.
 */

const pulito = (valore) => String(valore ?? "").trim();
/* Gli stati con cui Home Assistant dice «non lo so». */
const MUTI = /^(unknown|unavailable|none|null|)$/i;

/** La chiave in cui vive la configurazione. */
export const CHIAVE_DEUMIDIFICATORI = "cd_deumidificatori";

/* Sei bastano a una casa: uno per piano e qualcuno in cantina. */
export const MASSIMO_DEUMIDIFICATORI = 6;

/* Le caselle di una macchina. `entita` e' l'`humidifier`, l'unica che serve;
 * le altre sono quello che le integrazioni pubblicano accanto, ognuna come
 * entita' a parte. */
export const CAMPI_DEUMIDIFICATORE = Object.freeze([
  "entita",
  "umidita",
  "temperatura",
  "serbatoio",
  "ventola",
  "consumo",
]);

/* Senza un passo dichiarato si va di cinque: e' quello dei Midea, dei Comfee e
 * della maggior parte dei deumidificatori, che sul pannello saltano 40, 45,
 * 50. Un passo da uno vorrebbe dire dieci tocchi per andare da 40 a 50. */
export const PASSO_DI_SERIE = 5;

const numero = (valore) => {
  const letto = Number.parseFloat(valore);
  return Number.isFinite(letto) ? letto : null;
};

export function normalizzaDeumidificatore(input = {}, indice = 0) {
  const grezzo = input && typeof input === "object" ? input : {};
  const unita = {
    id: pulito(grezzo.id) || `deum-${indice + 1}`,
    nome: pulito(grezzo.nome ?? grezzo.name),
    stanza: pulito(grezzo.stanza ?? grezzo.room ?? grezzo.room_id),
  };
  for (const campo of CAMPI_DEUMIDIFICATORE) unita[campo] = pulito(grezzo[campo]);
  if (!unita.entita) unita.entita = pulito(grezzo.entity ?? grezzo.entity_id);
  return unita;
}

/** L'elenco, senza doppioni di identificativo e senza passare il tetto. */
export function normalizzaDeumidificatori(input = []) {
  const elenco = Array.isArray(input) ? input : input && typeof input === "object" ? [input] : [];
  const visti = new Set();
  const fuori = [];
  for (const [indice, voce] of elenco.entries()) {
    const unita = normalizzaDeumidificatore(voce, indice);
    let id = unita.id;
    let scarto = 2;
    while (visti.has(id)) id = `${unita.id}-${scarto++}`;
    visti.add(id);
    fuori.push({ ...unita, id });
    if (fuori.length >= MASSIMO_DEUMIDIFICATORI) break;
  }
  return fuori;
}

/** Se un'entita' e' un deumidificatore (o un umidificatore) di Home Assistant. */
export const eUnUmidificatore = (entita) => pulito(entita).startsWith("humidifier.");

/* Chi l'aveva gia' messo fra le unita' del Clima.
 *
 * E' quello che ha fatto chi ha aperto la #205, ed era l'unica strada che
 * c'era: rifargli la configurazione da capo per una cosa che aveva gia'
 * scritto sarebbe stato un altro difetto. Quelle unita' escono dalle card del
 * clima — dove non sapevano fare niente — ed entrano qui col loro nome e la
 * loro stanza. */
export function deumidificatoriDalClima(unitaDelClima = []) {
  const elenco = Array.isArray(unitaDelClima) ? unitaDelClima : [];
  const visti = new Set();
  const fuori = [];
  for (const unita of elenco) {
    const entita = pulito(unita?.entity ?? unita?.entity_id);
    if (!eUnUmidificatore(entita) || visti.has(entita)) continue;
    visti.add(entita);
    fuori.push(
      normalizzaDeumidificatore({
        id: `clima-${entita}`,
        nome: unita?.name,
        stanza: pulito(unita?.room) || pulito(unita?.room_id),
        entita,
        consumo: unita?.consumo,
      }),
    );
  }
  return fuori;
}

/** Tutti quelli da mostrare: i suoi, e poi quelli rimasti nel Clima. */
export function deumidificatoriDaMostrare(config = [], unitaDelClima = []) {
  const suoi = normalizzaDeumidificatori(config).filter((unita) => unita.entita);
  const gia = new Set(suoi.map((unita) => unita.entita));
  const dalClima = deumidificatoriDalClima(unitaDelClima).filter((unita) => !gia.has(unita.entita));
  return [...suoi, ...dalClima].slice(0, MASSIMO_DEUMIDIFICATORI);
}

/** Tutte le entita' nominate, senza doppioni. */
export function entitaDeiDeumidificatori(config = []) {
  const viste = new Set();
  for (const unita of normalizzaDeumidificatori(config))
    for (const campo of CAMPI_DEUMIDIFICATORE)
      if (unita[campo].includes(".")) viste.add(unita[campo]);
  return [...viste];
}

/* ── quello che si legge ──────────────────────────────────────────────── */

function stato(entita, states) {
  const id = pulito(entita);
  if (!id) return null;
  const voce = states?.[id];
  const grezzo = pulito(voce?.state);
  return { id, voce, grezzo, muto: !voce || MUTI.test(grezzo) };
}

function numeroDi(entita, states) {
  const letto = stato(entita, states);
  if (!letto || letto.muto) return null;
  return numero(letto.grezzo);
}

/* La ventola, se c'e': un `fan` con le sue velocita' preimpostate, o un
 * `select` con le sue voci. Tutti e due si scelgono da un elenco, e la card li
 * disegna allo stesso modo. */
function letturaVentola(entita, states) {
  const letto = stato(entita, states);
  if (!letto) return null;
  const dominio = letto.id.split(".")[0];
  const attributi = letto.voce?.attributes || {};
  if (dominio === "fan") {
    const opzioni = Array.isArray(attributi.preset_modes) ? attributi.preset_modes.map(pulito) : [];
    return {
      entita: letto.id,
      dominio,
      muto: letto.muto,
      opzioni: opzioni.filter(Boolean),
      scelta: pulito(attributi.preset_mode),
      percentuale: numero(attributi.percentage),
    };
  }
  if (dominio === "select" || dominio === "input_select") {
    const opzioni = Array.isArray(attributi.options) ? attributi.options.map(pulito) : [];
    return {
      entita: letto.id,
      dominio,
      muto: letto.muto,
      opzioni: opzioni.filter(Boolean),
      scelta: letto.muto ? "" : letto.grezzo,
      percentuale: null,
    };
  }
  return null;
}

/* Il serbatoio pieno: un `binary_sensor` acceso, o un sensore che lo dice a
 * parole. Torna `null` quando non lo si sa, che non e' «vuoto». */
function serbatoioPieno(entita, states) {
  const letto = stato(entita, states);
  if (!letto || letto.muto) return null;
  return /^(on|true|full|pieno|si|yes|1)$/i.test(letto.grezzo);
}

/**
 * Quello che una macchina deve dire, adesso.
 *
 * L'umidita' di adesso la dice l'entita' stessa (`current_humidity`, da Home
 * Assistant 2023.8) e, se non la dice, il sensore messo accanto. Il passo e i
 * limiti vengono dall'entita'; dove mancano, quelli di un deumidificatore
 * qualunque.
 */
export function letturaDeumidificatore(unita = {}, states = {}) {
  const sua = normalizzaDeumidificatore(unita, 0);
  const letto = stato(sua.entita, states);
  const attributi = letto?.voce?.attributes || {};
  const muto = !letto || letto.muto;
  const acceso = muto ? null : letto.grezzo === "on";
  const minimo = numero(attributi.min_humidity) ?? 30;
  const massimo = numero(attributi.max_humidity) ?? 80;
  const passo = numero(attributi.target_humidity_step) ?? PASSO_DI_SERIE;
  const attuale = numero(attributi.current_humidity) ?? numeroDi(sua.umidita, states);
  const modi = Array.isArray(attributi.available_modes)
    ? attributi.available_modes.map(pulito).filter(Boolean)
    : [];
  const pieno = serbatoioPieno(sua.serbatoio, states);
  const avvisi = [];
  if (pieno === true) avvisi.push({ chiave: "serbatoio_pieno", gravita: "attenzione" });
  return {
    id: sua.id,
    nome: sua.nome || pulito(attributi.friendly_name) || sua.entita,
    stanza: sua.stanza,
    entita: sua.entita,
    muto,
    acceso,
    /* Umidificatore o deumidificatore: la stessa entita' in Home Assistant, ma
     * uno toglie acqua dall'aria e l'altro ce la mette, e la card lo dice. */
    tipo: pulito(attributi.device_class) === "humidifier" ? "umidificatore" : "deumidificatore",
    /* Cosa sta facendo: `drying`, `humidifying`, `idle`, `off`. Un acceso che
     * sta fermo perche' l'aria e' gia' secca e' una notizia diversa da uno che
     * lavora. */
    azione: pulito(attributi.action),
    attuale,
    obiettivo: numero(attributi.humidity),
    minimo,
    massimo,
    passo,
    modi,
    modo: pulito(attributi.mode),
    serbatoioPieno: pieno,
    temperatura: numeroDi(sua.temperatura, states),
    consumo: numeroDi(sua.consumo, states),
    ventola: letturaVentola(sua.ventola, states),
    avvisi,
  };
}

/** L'obiettivo un passo piu' su o piu' giu', dentro i limiti e sul passo. */
export function obiettivoVicino(lettura, verso) {
  const passo = lettura?.passo > 0 ? lettura.passo : PASSO_DI_SERIE;
  const minimo = lettura?.minimo ?? 30;
  const massimo = lettura?.massimo ?? 80;
  const partenza = lettura?.obiettivo ?? lettura?.attuale ?? 50;
  /* Prima si mette sul passo, poi si sposta: un 47 ereditato da un'altra app
   * col meno va a 45, non a 42. */
  const sulPasso = Math.round(partenza / passo) * passo;
  let prossimo = sulPasso;
  if (verso > 0) prossimo = sulPasso > partenza ? sulPasso : sulPasso + passo;
  else if (verso < 0) prossimo = sulPasso < partenza ? sulPasso : sulPasso - passo;
  return Math.max(minimo, Math.min(massimo, prossimo));
}

/**
 * Il servizio da chiamare per un tasto della card.
 *
 * Torna `{ domain, service, data }`, o `null` quando quel tasto adesso non ha
 * senso: una modalita' che la macchina non ha, un'umidita' fuori dai limiti.
 */
export function comandoDeumidificatore(lettura, azione, valore) {
  const entita = pulito(lettura?.entita);
  if (!entita) return null;
  switch (azione) {
    case "accendi":
      return { domain: "humidifier", service: "turn_on", data: { entity_id: entita } };
    case "spegni":
      return { domain: "humidifier", service: "turn_off", data: { entity_id: entita } };
    case "commuta":
      return comandoDeumidificatore(lettura, lettura?.acceso ? "spegni" : "accendi");
    case "umidita": {
      const voluta = numero(valore);
      if (voluta === null) return null;
      const giusta = Math.max(
        lettura.minimo ?? 0,
        Math.min(lettura.massimo ?? 100, Math.round(voluta)),
      );
      return {
        domain: "humidifier",
        service: "set_humidity",
        data: { entity_id: entita, humidity: giusta },
      };
    }
    case "modo": {
      const modo = pulito(valore);
      if (!modo || !(lettura.modi || []).includes(modo)) return null;
      return { domain: "humidifier", service: "set_mode", data: { entity_id: entita, mode: modo } };
    }
    case "ventola": {
      const ventola = lettura?.ventola;
      const scelta = pulito(valore);
      if (!ventola || !scelta || !ventola.opzioni.includes(scelta)) return null;
      if (ventola.dominio === "fan")
        return {
          domain: "fan",
          service: "set_preset_mode",
          data: { entity_id: ventola.entita, preset_mode: scelta },
        };
      return {
        domain: ventola.dominio,
        service: "select_option",
        data: { entity_id: ventola.entita, option: scelta },
      };
    }
    default:
      return null;
  }
}

/* ── le caselle che si compilano da sole ─────────────────────────────────
 *
 * Le integrazioni mettono le entita' di una macchina tutte con lo stesso
 * inizio: `humidifier.deumidificatore_sala`, e accanto
 * `binary_sensor.deumidificatore_sala_tank_full`,
 * `sensor.deumidificatore_sala_humidity`. Da quell'inizio si trovano le altre,
 * e chi configura sceglie l'humidifier e basta. */
const PAROLE = Object.freeze({
  serbatoio: /(tank|bucket|water_full|full_water|serbatoio|tanica|vaschetta)/i,
  umidita: /(humidity|umidita)/i,
  temperatura: /(temperature|temperatura)/i,
  consumo: /(power|potenza|watt)/i,
});

function oggetto(entita) {
  return pulito(entita).split(".").slice(1).join(".");
}

export function caselleProposte(entita, states = {}) {
  const radice = oggetto(entita);
  if (!radice) return {};
  /* Lo stesso inizio e poi un trattino basso, o il nome intero: con due
   * macchine, `deumidificatore_sala` non deve prendersi i sensori di
   * `deumidificatore_sala_2`: cominciano col nome di un'altra macchina, e sono
   * suoi. */
  const sue = (id) =>
    id !== entita && (oggetto(id) === radice || oggetto(id).startsWith(`${radice}_`));
  const altre = new Set(
    Object.keys(states || {})
      .filter(
        (id) =>
          id !== entita && id.startsWith("humidifier.") && oggetto(id).startsWith(`${radice}_`),
      )
      .map(oggetto),
  );
  const vicine = Object.keys(states || {}).filter(
    (id) =>
      sue(id) &&
      ![...altre].some((altra) => oggetto(id) === altra || oggetto(id).startsWith(`${altra}_`)),
  );
  const prima = (filtro) => vicine.find(filtro) || "";
  const dominio = (id) => id.split(".")[0];
  const unita = (id) => pulito(states[id]?.attributes?.unit_of_measurement);
  const proposte = {
    serbatoio: prima(
      (id) =>
        ["binary_sensor", "sensor"].includes(dominio(id)) && PAROLE.serbatoio.test(oggetto(id)),
    ),
    umidita: prima(
      (id) =>
        dominio(id) === "sensor" &&
        (pulito(states[id]?.attributes?.device_class) === "humidity" ||
          (PAROLE.umidita.test(oggetto(id)) && unita(id) === "%")),
    ),
    temperatura: prima(
      (id) =>
        dominio(id) === "sensor" &&
        (pulito(states[id]?.attributes?.device_class) === "temperature" ||
          PAROLE.temperatura.test(oggetto(id))),
    ),
    ventola:
      prima((id) => dominio(id) === "fan") ||
      prima((id) => dominio(id) === "select" && /fan|ventola|speed|velocita/i.test(oggetto(id))),
    consumo: prima(
      (id) =>
        dominio(id) === "sensor" &&
        (pulito(states[id]?.attributes?.device_class) === "power" ||
          (PAROLE.consumo.test(oggetto(id)) && /^k?W$/.test(unita(id)))),
    ),
  };
  return Object.fromEntries(Object.entries(proposte).filter(([, valore]) => valore));
}

/** Le caselle vuote riempite con le proposte; quelle scritte restano. */
export function completaDeumidificatore(unita, states = {}) {
  const sua = normalizzaDeumidificatore(unita, 0);
  const proposte = caselleProposte(sua.entita, states);
  for (const [campo, valore] of Object.entries(proposte)) if (!sua[campo]) sua[campo] = valore;
  return sua;
}
