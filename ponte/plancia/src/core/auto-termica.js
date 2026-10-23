/* L'auto che va a benzina (#208).
 *
 * «Ho la mia auto che ha i sensori di livello carburante, odometro, autonomia
 * e portiere: e' possibile scegliere a monte se visualizzare un'auto
 * elettrica o classica con i sensori disponibili?» E, dal campo: «anche lo
 * stato dei finestrini e la pressione dei pneumatici».
 *
 * La pagina Auto era nata elettrica: batteria, wallbox, sessione di ricarica.
 * Un'auto a benzina ha un altro quadro — quanto carburante, quanti chilometri,
 * se e' chiusa, se il motore gira — e quello che le integrazioni dicono lo
 * dicono ognuna a modo suo: «locked» e «bloccato», «on» e «running», un
 * allarme che e' «in esecuzione». Questo modulo legge quei dialetti e li
 * riduce a numeri e a codici; le parole per dirli stanno nella sezione.
 *
 * Le caselle sono `dm.ev_*` come le altre della pagina Auto: entrano nel
 * profilo della vettura per la stessa strada, e il salvataggio non deve
 * imparare niente di nuovo.
 */

const pulito = (valore) => String(valore ?? "").trim();
const minuscolo = (valore) => pulito(valore).toLowerCase();

const numero = (valore) => {
  if (valore === null || valore === undefined || pulito(valore) === "") return null;
  const n = Number(valore);
  return Number.isFinite(n) ? n : null;
};

/* Le caselle dell'auto termica, con il tipo di lettura di ognuna. Il glifo e'
 * quello che la tessera in Home e la pagina usano: una famiglia sola.
 *
 * `autonomia` e `odometro` non stanno qui: sono `dm.ev_autonomia` e
 * `dm.ev_odometro`, che la pagina ha gia' e che valgono per qualunque motore. */
export const CASELLE_TERMICHE = Object.freeze([
  Object.freeze({ ref: "dm.ev_carburante", campo: "carburante", tipo: "percento", glifo: "⛽" }),
  Object.freeze({ ref: "dm.ev_motore", campo: "motore", tipo: "acceso", glifo: "🔑" }),
  Object.freeze({ ref: "dm.ev_portiere", campo: "portiere", tipo: "serratura", glifo: "🚪" }),
  Object.freeze({ ref: "dm.ev_finestrini", campo: "finestrini", tipo: "apertura", glifo: "🪟" }),
  /* Il bagagliaio e il cofano (#326).
   *
   * «Allo stesso modo delle portiere (bloccate/aperte) e' possibile inserire un
   * binary_sensor per il "Bagagliaio" e per il "Cofano motore"
   * (chiuso/aperto)?» Sono due aperture come i finestrini — un binary_sensor
   * che dice aperto o chiuso — e leggono lo stesso dialetto: chi resta aperto
   * si vede, chi e' chiuso sta zitto. */
  Object.freeze({ ref: "dm.ev_bagagliaio", campo: "bagagliaio", tipo: "apertura", glifo: "🧳" }),
  Object.freeze({ ref: "dm.ev_cofano", campo: "cofano", tipo: "apertura", glifo: "🔧" }),
  /* Dove sta l'auto (#326).
   *
   * «Perche' non inserire una voce tipo "location" dove come entita' si
   * inserisce un "device_tracker." che verra' utilizzata per mostrare dove si
   * trova l'auto?» Non e' un numero e non e' un interruttore: e' una parola —
   * «casa», «lavoro», «in viaggio» — e si legge come tale. */
  Object.freeze({ ref: "dm.ev_posizione", campo: "posizione", tipo: "luogo", glifo: "📍" }),
  Object.freeze({ ref: "dm.ev_allarme", campo: "allarme", tipo: "allarme", glifo: "🚨" }),
  /* La batteria di servizio (#348).
   *
   * «Nella sezione batteria 12 V in questo momento e' a 14 V, mi da' 14%.»
   * La casella era una percentuale e basta: un sensore in volt — che e' la
   * forma in cui la meta' delle integrazioni pubblica la batteria da 12 V —
   * veniva letto come un livello, e i quattordici volt di un alternatore che
   * carica diventavano un quattordici per cento di batteria quasi a terra.
   * Adesso la casella legge l'unita' che il sensore dichiara: percento e'
   * un livello, volt e' una tensione, e si mostra quello che si e' letto. */
  Object.freeze({
    ref: "dm.ev_batteria_servizio",
    campo: "batteriaServizio",
    tipo: "batteria",
    glifo: "🔋",
  }),
  Object.freeze({ ref: "dm.ev_temperatura_olio", campo: "olio", tipo: "gradi", glifo: "🛢️" }),
  Object.freeze({ ref: "dm.ev_temperatura_esterna", campo: "esterna", tipo: "gradi", glifo: "🌡️" }),
  Object.freeze({ ref: "dm.ev_ultimo_viaggio", campo: "ultimoViaggio", tipo: "km", glifo: "🧭" }),
  Object.freeze({
    ref: "dm.ev_carburante_totale",
    campo: "carburanteTotale",
    tipo: "litri",
    glifo: "⛽",
  }),
  Object.freeze({ ref: "dm.ev_pneumatici", campo: "pneumatici", tipo: "pressione", glifo: "🛞" }),
  /* Le quattro ruote, una casella per ognuna.
   *
   * «E' possibile inserire un solo pneumatico, spero al prossimo rilascio sia
   * possibile inserirne 4» (#319). Chi ha il TPMS ha quattro sensori, uno per
   * ruota, e ne poteva mappare uno. La casella di prima resta dov'e' e vale
   * quello che ha sempre valso — un sensore riepilogativo, o l'avviso unico
   * dell'auto — cosi' chi l'ha compilata non si accorge di niente. */
  Object.freeze({
    ref: "dm.ev_pneumatico_ant_sx",
    campo: "pneumaticoAntSx",
    tipo: "pressione",
    glifo: "🛞",
    ruota: "antSx",
  }),
  Object.freeze({
    ref: "dm.ev_pneumatico_ant_dx",
    campo: "pneumaticoAntDx",
    tipo: "pressione",
    glifo: "🛞",
    ruota: "antDx",
  }),
  Object.freeze({
    ref: "dm.ev_pneumatico_post_sx",
    campo: "pneumaticoPostSx",
    tipo: "pressione",
    glifo: "🛞",
    ruota: "postSx",
  }),
  Object.freeze({
    ref: "dm.ev_pneumatico_post_dx",
    campo: "pneumaticoPostDx",
    tipo: "pressione",
    glifo: "🛞",
    ruota: "postDx",
  }),
]);

/* L'ordine in cui le ruote si leggono e si disegnano: come si guarda l'auto
 * dall'alto, davanti in alto. */
export const RUOTE = Object.freeze([
  Object.freeze({ ruota: "antSx", campo: "pneumaticoAntSx", ref: "dm.ev_pneumatico_ant_sx" }),
  Object.freeze({ ruota: "antDx", campo: "pneumaticoAntDx", ref: "dm.ev_pneumatico_ant_dx" }),
  Object.freeze({ ruota: "postSx", campo: "pneumaticoPostSx", ref: "dm.ev_pneumatico_post_sx" }),
  Object.freeze({ ruota: "postDx", campo: "pneumaticoPostDx", ref: "dm.ev_pneumatico_post_dx" }),
]);

/** I riferimenti, per chi deve sapere se uno stato riguarda un'auto termica. */
export const RIFERIMENTI_TERMICI = Object.freeze(CASELLE_TERMICHE.map((voce) => voce.ref));

/* I dati che un'auto connessa racconta, di qualunque motore.
 *
 * «Ogni dato di GdAAuto deve avere la sua casella in GdAHome.» Sono le chiavi
 * del contratto delle tre sorelle (`docs/DATI-AUTO.md` di GdAAuto), ognuna
 * con la casella `dm.ev_<chiave>` che il legame riempie da solo e che si puo'
 * scegliere anche a mano, nella stessa scheda delle altre. Valgono anche per
 * un'auto che arriva da un'altra integrazione: la casella e' della vettura,
 * non di chi la riempie.
 *
 * `misura` e' un numero con l'unita' che il sensore dichiara — kWh, W, km,
 * minuti — e si scrive quella, come per la batteria di servizio (#348).
 * `parola` e' un testo da mostrare com'e' («07:30», «dc»), `ora` un istante,
 * `marcia` la lettera del cambio. */
export const CASELLE_DELL_AUTO = Object.freeze([
  /* La batteria e il consumo. */
  Object.freeze({
    ref: "dm.ev_energia_residua",
    campo: "energiaResidua",
    tipo: "misura",
    glifo: "🔋",
    it: "Energia residua (kWh)",
    en: "Remaining energy (kWh)",
  }),
  Object.freeze({
    ref: "dm.ev_capacita_batteria",
    campo: "capacitaBatteria",
    tipo: "misura",
    glifo: "🔋",
    it: "Capacità della batteria (dal sensore, kWh)",
    en: "Battery capacity (from the sensor, kWh)",
  }),
  Object.freeze({
    ref: "dm.ev_consumo_medio",
    campo: "consumoMedio",
    tipo: "misura",
    glifo: "📉",
    it: "Consumo medio (kWh/100 km)",
    en: "Average consumption (kWh/100 km)",
  }),
  Object.freeze({
    ref: "dm.ev_temperatura_batteria",
    campo: "temperaturaBatteria",
    tipo: "gradi",
    glifo: "🌡️",
    it: "Temperatura della batteria (°C)",
    en: "Battery temperature (°C)",
  }),
  Object.freeze({
    ref: "dm.ev_temperatura_interna",
    campo: "interna",
    tipo: "gradi",
    glifo: "🌡️",
    it: "Temperatura nell'abitacolo (°C)",
    en: "Cabin temperature (°C)",
  }),
  Object.freeze({
    ref: "dm.ev_potenza_riscaldatore",
    campo: "potenzaRiscaldatore",
    tipo: "misura",
    glifo: "♨️",
    it: "Potenza del riscaldatore (W)",
    en: "Heater power (W)",
  }),
  Object.freeze({
    ref: "dm.ev_clima",
    campo: "clima",
    tipo: "acceso",
    glifo: "❄️",
    it: "Clima acceso (acceso/spento)",
    en: "Climate on (on/off)",
  }),
  Object.freeze({
    ref: "dm.ev_batteria_in_riscaldamento",
    campo: "batteriaInRiscaldamento",
    tipo: "acceso",
    glifo: "♨️",
    it: "Batteria in riscaldamento (acceso/spento)",
    en: "Battery heating (on/off)",
  }),
  Object.freeze({
    ref: "dm.ev_velocita",
    campo: "velocita",
    tipo: "misura",
    glifo: "🏁",
    it: "Velocità (km/h)",
    en: "Speed (km/h)",
  }),
  Object.freeze({
    ref: "dm.ev_potenza_istantanea",
    campo: "potenzaIstantanea",
    tipo: "misura",
    glifo: "⚡",
    it: "Potenza in uso (kW)",
    en: "Power in use (kW)",
  }),
  Object.freeze({
    ref: "dm.ev_autonomia_nominale",
    campo: "autonomiaNominale",
    tipo: "misura",
    glifo: "🛣️",
    it: "Autonomia di omologazione (km)",
    en: "Rated range (km)",
  }),
  Object.freeze({
    ref: "dm.ev_autonomia_carburante",
    campo: "autonomiaCarburante",
    tipo: "misura",
    glifo: "🛣️",
    it: "Autonomia a carburante (km)",
    en: "Fuel range (km)",
  }),
  Object.freeze({
    ref: "dm.ev_autonomia_totale",
    campo: "autonomiaTotale",
    tipo: "misura",
    glifo: "🛣️",
    it: "Autonomia totale (km)",
    en: "Total range (km)",
  }),
  /* La ricarica. */
  Object.freeze({
    ref: "dm.ev_potenza_ricarica",
    campo: "potenzaRicarica",
    tipo: "misura",
    glifo: "⚡",
    it: "Potenza di ricarica dell'auto (kW)",
    en: "Car charging power (kW)",
  }),
  Object.freeze({
    ref: "dm.ev_tempo_ricarica",
    campo: "tempoRicarica",
    tipo: "misura",
    glifo: "⏱️",
    it: "Tempo alla fine della ricarica (min)",
    en: "Time to the end of charging (min)",
  }),
  Object.freeze({
    ref: "dm.ev_ricarica_rapida",
    campo: "ricaricaRapida",
    tipo: "acceso",
    glifo: "⚡",
    it: "Ricarica rapida (acceso/spento)",
    en: "Fast charging (on/off)",
  }),
  Object.freeze({
    ref: "dm.ev_ricarica_programmata",
    campo: "ricaricaProgrammata",
    tipo: "acceso",
    glifo: "🕒",
    it: "Ricarica programmata (acceso/spento)",
    en: "Scheduled charging (on/off)",
  }),
  Object.freeze({
    ref: "dm.ev_ricarica_inizio",
    campo: "ricaricaInizio",
    tipo: "parola",
    glifo: "🕒",
    it: "Inizio della ricarica programmata (ora)",
    en: "Scheduled charging start (time)",
  }),
  Object.freeze({
    ref: "dm.ev_ricarica_fine",
    campo: "ricaricaFine",
    tipo: "parola",
    glifo: "🕒",
    it: "Fine della ricarica programmata (ora)",
    en: "Scheduled charging end (time)",
  }),
  Object.freeze({
    ref: "dm.ev_v2l",
    campo: "v2l",
    tipo: "acceso",
    glifo: "🔌",
    it: "Corrente all'esterno, V2L (acceso/spento)",
    en: "Power outlet, V2L (on/off)",
  }),
  Object.freeze({
    ref: "dm.ev_comando_ricarica",
    campo: "comandoRicarica",
    tipo: "acceso",
    glifo: "🔌",
    it: "Comando della ricarica (switch)",
    en: "Charging control (switch)",
  }),
  /* Lo storico: oggi, la settimana, l'ultima ricarica. */
  Object.freeze({
    ref: "dm.ev_energia_oggi_guida",
    campo: "energiaOggiGuida",
    tipo: "misura",
    glifo: "⚡",
    it: "Energia di oggi per la guida (kWh)",
    en: "Energy today for driving (kWh)",
  }),
  Object.freeze({
    ref: "dm.ev_energia_oggi_clima",
    campo: "energiaOggiClima",
    tipo: "misura",
    glifo: "⚡",
    it: "Energia di oggi per il clima (kWh)",
    en: "Energy today for climate (kWh)",
  }),
  Object.freeze({
    ref: "dm.ev_energia_oggi_altro",
    campo: "energiaOggiAltro",
    tipo: "misura",
    glifo: "⚡",
    it: "Energia di oggi per il resto (kWh)",
    en: "Energy today for everything else (kWh)",
  }),
  Object.freeze({
    ref: "dm.ev_km_7_giorni",
    campo: "km7Giorni",
    tipo: "misura",
    glifo: "🛣️",
    it: "Km degli ultimi 7 giorni (km)",
    en: "Distance in the last 7 days (km)",
  }),
  Object.freeze({
    ref: "dm.ev_energia_7_giorni",
    campo: "energia7Giorni",
    tipo: "misura",
    glifo: "⚡",
    it: "Energia degli ultimi 7 giorni (kWh)",
    en: "Energy in the last 7 days (kWh)",
  }),
  Object.freeze({
    ref: "dm.ev_ultima_ricarica_energia",
    campo: "ultimaRicaricaEnergia",
    tipo: "misura",
    glifo: "🔌",
    it: "Energia dell'ultima ricarica (kWh)",
    en: "Energy of the last charge (kWh)",
  }),
  Object.freeze({
    ref: "dm.ev_ultima_ricarica_tipo",
    campo: "ultimaRicaricaTipo",
    tipo: "parola",
    glifo: "🔌",
    it: "Tipo dell'ultima ricarica (AC/DC)",
    en: "Type of the last charge (AC/DC)",
  }),
  Object.freeze({
    ref: "dm.ev_ultima_ricarica_inizio",
    campo: "ultimaRicaricaInizio",
    tipo: "ora",
    glifo: "🕒",
    it: "Inizio dell'ultima ricarica (data e ora)",
    en: "Start of the last charge (date and time)",
  }),
  Object.freeze({
    ref: "dm.ev_ultima_ricarica_fine",
    campo: "ultimaRicaricaFine",
    tipo: "ora",
    glifo: "🕒",
    it: "Fine dell'ultima ricarica (data e ora)",
    en: "End of the last charge (date and time)",
  }),
  /* L'auto. */
  Object.freeze({
    ref: "dm.ev_marcia",
    campo: "marcia",
    tipo: "marcia",
    glifo: "⚙️",
    it: "Marcia (P/R/N/D)",
    en: "Gear (P/R/N/D)",
  }),
  Object.freeze({
    ref: "dm.ev_sentinella",
    campo: "sentinella",
    tipo: "acceso",
    glifo: "👁️",
    it: "Modalità sentinella (acceso/spento)",
    en: "Sentry mode (on/off)",
  }),
  Object.freeze({
    ref: "dm.ev_freno_stazionamento",
    campo: "frenoStazionamento",
    tipo: "acceso",
    glifo: "🅿️",
    it: "Freno di stazionamento (tirato/rilasciato)",
    en: "Parking brake (on/off)",
  }),
  Object.freeze({
    ref: "dm.ev_sbrinamento",
    campo: "sbrinamento",
    tipo: "acceso",
    glifo: "❄️",
    it: "Sbrinamento del parabrezza (acceso/spento)",
    en: "Windscreen defrost (on/off)",
  }),
  Object.freeze({
    ref: "dm.ev_in_sonno",
    campo: "inSonno",
    tipo: "acceso",
    glifo: "💤",
    it: "Auto in sonno (sì/no)",
    en: "Car asleep (yes/no)",
  }),
  Object.freeze({
    ref: "dm.ev_ultimo_aggiornamento",
    campo: "ultimoAggiornamento",
    tipo: "ora",
    glifo: "🕒",
    it: "Ultimo aggiornamento dell'auto (data e ora)",
    en: "Car's last update (date and time)",
  }),
  Object.freeze({
    ref: "dm.ev_comando_clima",
    campo: "comandoClima",
    tipo: "acceso",
    glifo: "❄️",
    it: "Comando del clima (switch)",
    en: "Climate control (switch)",
  }),
]);

/** I riferimenti dei dati dell'auto, come quelli termici. */
export const RIFERIMENTI_DELL_AUTO = Object.freeze(CASELLE_DELL_AUTO.map((voce) => voce.ref));

/** La voce di un dato dell'auto, o `null` se il riferimento non e' fra questi. */
export function casellaDellAuto(ref) {
  const cercato = pulito(ref);
  return CASELLE_DELL_AUTO.find((voce) => voce.ref === cercato) || null;
}

/* L'etichetta senza la parentesi in fondo: «Energia residua (kWh)» nella
 * scheda dice che entita' scegliere, sulla pagina basta «Energia residua» —
 * l'unita' la scrive il numero. Anche la parentesi larga del giapponese e del
 * cinese, «（kWh）». */
export function senzaParentesi(etichetta) {
  return pulito(etichetta).replace(/\s*[(（][^()（）]*[)）]$/, "");
}

/* ── i dialetti ───────────────────────────────────────────────────────── */

/* Dove sta l'auto, in parole (#326).
 *
 * Un `device_tracker` risponde `home`, `not_home` o il nome di una zona.
 * `home` e `not_home` sono parole di Home Assistant, non italiano: si
 * traducono. Il nome di una zona invece e' gia' una parola scritta da
 * qualcuno — «Lavoro», «Palestra» — e si lascia com'e'.
 *
 * Uno stato che non dice niente — vuoto, sconosciuto, non disponibile — non
 * diventa la parola «sconosciuto» sulla card: diventa niente, e la pillola
 * non si disegna. */
/**
 * La posizione esatta dell'auto, dagli attributi del suo `device_tracker`.
 *
 * «Mi recuperi la posizione attuale del veicolo e non fuori casa: voglio la
 * posizione esatta.» Lo stato del tracker dice solo `home`, `not_home` o il
 * nome di una zona; il punto vero sta negli attributi — `latitude`,
 * `longitude`, `gps_accuracy` — e alcune integrazioni ci mettono anche
 * l'indirizzo. Qui si leggono, e basta: niente va a un servizio di fuori per
 * trasformare le coordinate in una via. `null` se il tracker non le ha.
 */
export function coordinateDelLuogo(attributi) {
  const a = attributi && typeof attributi === "object" ? attributi : {};
  const lat = numero(a.latitude ?? a.lat);
  const lon = numero(a.longitude ?? a.lon ?? a.lng);
  if (lat === null || lon === null) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180 || (lat === 0 && lon === 0)) return null;
  const testo = (valore) => (typeof valore === "string" ? valore.trim() : "");
  const via = [testo(a.street), testo(a.house_number)].filter(Boolean).join(" ");
  const indirizzo =
    testo(a.address) ||
    testo(a.formatted_address) ||
    testo(a.indirizzo) ||
    [via, testo(a.city) || testo(a.town)].filter(Boolean).join(", ");
  const precisione = numero(a.gps_accuracy);
  return { lat, lon, precisione: precisione === null ? null : Math.max(0, precisione), indirizzo };
}

/** Il link per aprire quel punto nelle mappe del telefono o del computer. */
export function linkDellaMappa(coordinate) {
  if (!coordinate) return "";
  const punto = `${coordinate.lat.toFixed(6)},${coordinate.lon.toFixed(6)}`;
  return `https://www.google.com/maps/search/?api=1&query=${punto}`;
}

/** Come si scrive la posizione: l'indirizzo, se c'e', se no le coordinate. */
export function posizioneScritta(coordinate) {
  if (!coordinate) return "";
  if (coordinate.indirizzo) return coordinate.indirizzo;
  return `${coordinate.lat.toFixed(5)}, ${coordinate.lon.toFixed(5)}`;
}

export function luogoDalloStato(grezzo) {
  const voce = String(grezzo ?? "").trim();
  if (!voce) return "";
  const basso = voce.toLowerCase();
  if (["unknown", "unavailable", "none", "null"].includes(basso)) return "";
  if (basso === "home") return "casa";
  if (basso === "not_home") return "fuori";
  return voce;
}

/* Acceso o spento, comunque lo dica l'integrazione: il motore di una
 * Stellantis e' «Spento», quello di una Hyundai «off», un binary_sensor «on». */
const ACCESO = /^(on|true|1|running|started|acceso|acceso[_ ]?motore|in[_ ]moto|on_running)$/;
const SPENTO = /^(off|false|0|stopped|spento|fermo|idle|parked)$/;

export function accesoDalloStato(stato) {
  const voce = minuscolo(stato);
  if (!voce) return null;
  if (ACCESO.test(voce)) return true;
  if (SPENTO.test(voce)) return false;
  return null;
}

/* Le portiere: bloccate, sbloccate, aperte, chiuse. Un `lock.*` dice
 * «locked»; un sensore di apertura dice «open». */
export function serraturaDalloStato(stato) {
  const voce = minuscolo(stato);
  if (!voce) return null;
  if (/^(locked|bloccat[oae]|chius[oae]\s+a\s+chiave|closed_locked)$/.test(voce)) return "bloccate";
  if (/^(unlocked|sbloccat[oae]|unlocking|locking)$/.test(voce)) return "sbloccate";
  if (/^(open|aperta|aperte|aperto|on|opening)$/.test(voce)) return "aperte";
  if (/^(closed|chius[oae]|off)$/.test(voce)) return "chiuse";
  return null;
}

/* I finestrini: aperti o chiusi, da un binary_sensor o da una parola. */
export function aperturaDalloStato(stato) {
  const voce = minuscolo(stato);
  if (!voce) return null;
  if (/^(open|on|true|apert[oaie]|opened|partially_open|semi)$/.test(voce)) return "aperti";
  if (/^(closed|off|false|chius[oaie])$/.test(voce)) return "chiusi";
  return null;
}

/* L'allarme: inserito, disinserito, scattato. «In esecuzione» e' come lo
 * scrive Stellantis quando e' inserito. */
export function allarmeDalloStato(stato) {
  const voce = minuscolo(stato);
  if (!voce) return null;
  if (/^(triggered|scattat[oa]|alarm|allarme)$/.test(voce)) return "scattato";
  if (
    /^(armed|armed_away|armed_home|on|true|1|attiv[oa]|inserit[oa]|in[_ ]esecuzione|running|enabled)$/.test(
      voce,
    )
  )
    return "inserito";
  if (/^(disarmed|off|false|0|spent[oa]|disinserit[oa]|disabled)$/.test(voce)) return "disinserito";
  return null;
}

/* La batteria di servizio: un livello in percento, o una tensione in volt.
 *
 * Decide l'unita' che il sensore dichiara, non la casella: «%» (o niente,
 * com'era sempre stato) e' un livello e si tiene fra zero e cento; «V» e
 * «mV» sono una tensione, e una tensione non si taglia a cento — sono i
 * numeri di un alternatore. Torna il numero e l'unita' con cui mostrarlo, o
 * null se non c'e' un numero. */
export function batteriaDalloStato(stato, unita = "") {
  const n = numero(minuscolo(stato));
  if (n === null) return null;
  const dichiarata = pulito(unita);
  if (/^mv$/i.test(dichiarata)) return { valore: n / 1000, unita: "V" };
  if (/^v$/i.test(dichiarata)) return { valore: n, unita: "V" };
  if (!dichiarata || dichiarata === "%")
    return { valore: Math.max(0, Math.min(100, n)), unita: "%" };
  return { valore: n, unita: dichiarata };
}

/* La marcia, comunque la scriva l'integrazione: la lettera del cambio, che si
 * legge uguale in tutte le lingue. GdAAuto dice `parcheggio`, `avanti`,
 * `folle`, `retromarcia`. */
export function marciaDalloStato(stato) {
  const voce = minuscolo(stato).replace(/[\s_-]+/g, " ");
  if (!voce) return null;
  if (/^(p|park\w*|parcheggi\w*|parken)$/.test(voce)) return "P";
  if (/^(r|reverse|retromarcia|retro|rückwärts)$/.test(voce)) return "R";
  if (/^(n|neutral|folle|neutro|leerlauf)$/.test(voce)) return "N";
  if (/^(d|drive|avanti|marcia avanti|fahren|b)$/.test(voce)) return "D";
  return null;
}

/* Un istante, come lo scrive Home Assistant: i millisecondi, o null. */
export function istanteDalloStato(stato) {
  const voce = pulito(stato);
  if (!voce) return null;
  const quando = Date.parse(voce);
  return Number.isFinite(quando) ? quando : null;
}

/**
 * Un istante detto come lo si dice: l'ora se e' di oggi, se no anche il
 * giorno. Vuoto se non e' un istante.
 */
export function istanteDetto(quando, { lingua = "it", adesso = Date.now() } = {}) {
  if (!Number.isFinite(quando)) return "";
  const data = new Date(quando);
  const oggi = new Date(adesso).toDateString() === data.toDateString();
  try {
    return oggi
      ? data.toLocaleTimeString(lingua, { hour: "2-digit", minute: "2-digit" })
      : data.toLocaleString(lingua, {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        });
  } catch (_error) {
    return data.toISOString().slice(0, 16).replace("T", " ");
  }
}

/* I pneumatici: una pressione con la sua unita', oppure un avviso si'/no. */
export function pneumaticiDalloStato(stato, unita = "") {
  const voce = minuscolo(stato);
  if (!voce) return null;
  const n = numero(voce);
  if (n !== null) return { pressione: n, unita: pulito(unita) || "bar", avviso: null };
  if (/^(on|true|low|bass[ao]|warning|avviso|problem)$/.test(voce))
    return { pressione: null, unita: "", avviso: true };
  if (/^(off|false|ok|normal|normale|good)$/.test(voce))
    return { pressione: null, unita: "", avviso: false };
  return null;
}

/**
 * Le ruote mappate, nell'ordine in cui stanno sull'auto.
 *
 * Chi ne ha mappata una sola non ha una ruota: ha il riepilogo di prima, che
 * resta nella sua casella. Questa risponde solo di quelle vere.
 *
 * @returns {Array<{ruota:string,ref:string,pressione:number|null,unita:string,avviso:boolean|null}>}
 */
export function ruoteDellAuto(lettura = {}) {
  const fuori = [];
  for (const voce of RUOTE) {
    const valore = lettura?.[voce.campo];
    if (!valore) continue;
    fuori.push({ ruota: voce.ruota, ref: voce.ref, ...valore });
  }
  return fuori;
}

/** Se una qualunque delle gomme chiede attenzione: l'avviso, da dove arriva. */
export function pneumaticiInAvviso(lettura = {}) {
  if (lettura?.pneumatici?.avviso === true) return true;
  return ruoteDellAuto(lettura).some((ruota) => ruota.avviso === true);
}

/* ── la lettura ───────────────────────────────────────────────────────── */

/**
 * Il quadro dell'auto termica, adesso.
 *
 * `mappa` e' la mappatura della vettura — `{ "dm.ev_carburante": "sensor.x" }`
 * — come sta nel suo profilo; `resolve` e' il ripiego per chi legge le chiavi
 * globali. Quello che manca resta `null`, e chi disegna non lo disegna: una
 * casella non mappata non e' un valore a zero.
 */
export function letturaTermica(mappa = {}, states = {}, resolve = null) {
  const statoDi = (ref) => {
    let entity = pulito(mappa?.[ref]);
    if (!entity && typeof resolve === "function") {
      try {
        const risolto = pulito(resolve(ref));
        if (risolto && risolto !== ref) entity = risolto;
      } catch (_error) {
        entity = "";
      }
    }
    if (!entity) return { entity: "", stato: null };
    return { entity, stato: states?.[entity] || null };
  };
  const fuori = { caselle: {} };
  for (const voce of [...CASELLE_TERMICHE, ...CASELLE_DELL_AUTO]) {
    const { entity, stato } = statoDi(voce.ref);
    if (!entity) continue;
    const grezzo = stato ? pulito(stato.state) : "";
    const unita = pulito(stato?.attributes?.unit_of_measurement);
    const muto = !stato || /^(unknown|unavailable|none|)$/i.test(grezzo);
    let valore = null;
    if (!muto)
      switch (voce.tipo) {
        case "percento": {
          const n = numero(grezzo);
          valore = n === null ? null : Math.max(0, Math.min(100, n));
          break;
        }
        case "batteria":
          valore = batteriaDalloStato(grezzo, unita);
          break;
        case "gradi":
        case "km":
        case "litri":
        case "misura":
          valore = numero(grezzo);
          break;
        case "marcia":
          valore = marciaDalloStato(grezzo);
          break;
        case "ora":
          valore = istanteDalloStato(grezzo);
          break;
        case "acceso":
          valore = accesoDalloStato(grezzo);
          break;
        case "serratura":
          valore = serraturaDalloStato(grezzo);
          break;
        case "apertura":
          valore = aperturaDalloStato(grezzo);
          break;
        case "allarme":
          valore = allarmeDalloStato(grezzo);
          break;
        case "luogo":
          valore = luogoDalloStato(grezzo);
          break;
        case "pressione":
          valore = pneumaticiDalloStato(grezzo, unita);
          break;
        default:
          valore = grezzo;
      }
    /* Del tracker si tiene anche il punto esatto: lo stato dice solo «fuori». */
    if (voce.tipo === "luogo") fuori.coordinate = coordinateDelLuogo(stato?.attributes);
    fuori.caselle[voce.campo] = {
      ref: voce.ref,
      entity,
      grezzo,
      unita,
      muto,
      valore,
      tipo: voce.tipo,
      glifo: voce.glifo,
    };
    fuori[voce.campo] = valore;
  }
  /* La batteria di servizio si legge come le altre misure con un'unita':
   * un numero e, accanto, in che cosa e' scritto. Chi la disegna scrive
   * quello che c'e' qui, non un «%» deciso a tavolino (#348). */
  const servizio = fuori.batteriaServizio;
  fuori.batteriaServizio = servizio ? servizio.valore : servizio === undefined ? undefined : null;
  fuori.batteriaServizioUnita = servizio ? servizio.unita : "%";
  /* Le due caselle che la pagina ha gia' e che valgono per ogni motore. */
  const autonomia = statoDi("dm.ev_autonomia");
  const odometro = statoDi("dm.ev_odometro");
  fuori.autonomia = autonomia.entity ? numero(autonomia.stato?.state) : null;
  fuori.autonomiaUnita = pulito(autonomia.stato?.attributes?.unit_of_measurement) || "km";
  fuori.odometro = odometro.entity ? numero(odometro.stato?.state) : null;
  fuori.odometroUnita = pulito(odometro.stato?.attributes?.unit_of_measurement) || "km";
  /* Quando l'auto chiede attenzione: l'allarme scattato, le portiere aperte
   * col motore spento, i pneumatici in avviso, il carburante in riserva. */
  fuori.attenzione =
    fuori.allarme === "scattato" ||
    (fuori.portiere === "aperte" && fuori.motore === false) ||
    pneumaticiInAvviso(fuori) ||
    (fuori.carburante !== null && fuori.carburante !== undefined && fuori.carburante <= 10);
  fuori.qualcosa = Object.keys(fuori.caselle).length > 0;
  return fuori;
}

/* ── i dati in blocchi, per la pagina ─────────────────────────────────── */

/* «Nella sezione Auto riesci a fare qualcosa di piu' bello con tutti sti dati,
 * cosi' non si capisce niente.» La pagina li metteva in fila — una tessera
 * per ogni dato, tutte uguali — e il consumo stava accanto alla marcia,
 * l'energia di oggi in tre caselle separate, la temperatura della batteria
 * fra due tempi di ricarica. Qui i dati si mettono insieme per quello che
 * dicono: l'energia di oggi e' UNA cosa divisa in tre, la settimana sono tre
 * numeri che si leggono insieme, le temperature stanno con le temperature.
 * Quello che non entra in nessun blocco finisce in «Altri dati»: niente di
 * configurato si perde. */

/* Le tre parti dell'energia di oggi, nell'ordine in cui si disegnano. */
export const PARTI_DELL_ENERGIA = Object.freeze([
  Object.freeze({ parte: "guida", campo: "energiaOggiGuida", ref: "dm.ev_energia_oggi_guida" }),
  Object.freeze({ parte: "clima", campo: "energiaOggiClima", ref: "dm.ev_energia_oggi_clima" }),
  Object.freeze({ parte: "altro", campo: "energiaOggiAltro", ref: "dm.ev_energia_oggi_altro" }),
]);

/* Le temperature, nell'ordine in cui si leggono: prima quelle dell'auto. */
export const TEMPERATURE_DELL_AUTO = Object.freeze([
  Object.freeze({
    chi: "batteria",
    campo: "temperaturaBatteria",
    ref: "dm.ev_temperatura_batteria",
  }),
  Object.freeze({ chi: "abitacolo", campo: "interna", ref: "dm.ev_temperatura_interna" }),
  Object.freeze({ chi: "esterna", campo: "esterna", ref: "dm.ev_temperatura_esterna" }),
  Object.freeze({ chi: "olio", campo: "olio", ref: "dm.ev_temperatura_olio" }),
]);

const valoreDi = (lettura, campo) => {
  const v = lettura?.caselle?.[campo]?.valore;
  return v === undefined ? null : v;
};
const unitaDi = (lettura, campo) => pulito(lettura?.caselle?.[campo]?.unita);

/* I kilowattora di un sensore d'energia, in qualunque unita'. */
function inKilowattora(valore, unita) {
  if (valore === null || valore === undefined) return null;
  const nome = pulito(unita).toLowerCase();
  if (nome === "wh") return valore / 1000;
  if (nome === "mwh") return valore * 1000;
  return valore;
}

/**
 * L'energia di oggi, divisa per cosa l'ha usata.
 *
 * Torna `null` se nessuna delle tre parti e' mappata. Le parti mappate ma mute
 * restano fuori dal totale e dalla barra: un sensore che non risponde non e'
 * uno zero. `quota` e' la parte del totale, fra 0 e 1, e con il totale a zero
 * e' zero per tutte — la barra resta vuota invece di dividere per niente.
 *
 * @returns {null|{totale:number, parti:Array<{parte:string, ref:string, kwh:number, quota:number}>}}
 */
export function energiaDiOggi(lettura = {}) {
  const parti = [];
  for (const voce of PARTI_DELL_ENERGIA) {
    const kwh = inKilowattora(valoreDi(lettura, voce.campo), unitaDi(lettura, voce.campo));
    if (kwh === null) continue;
    parti.push({ parte: voce.parte, ref: voce.ref, kwh: Math.max(0, kwh) });
  }
  if (!parti.length) return null;
  const totale = parti.reduce((somma, voce) => somma + voce.kwh, 0);
  for (const voce of parti) voce.quota = totale > 0 ? voce.kwh / totale : 0;
  return { totale, parti };
}

/* Il consumo in kWh/100 km da un sensore che lo dice in un'altra unita':
 * Wh/km, km/kWh, mi/kWh. `null` se non si capisce. */
function consumoInKwh100(valore, unita) {
  if (valore === null || valore === undefined || valore <= 0) return null;
  const nome = pulito(unita).toLowerCase().replace(/\s+/g, "");
  if (!nome || nome === "kwh/100km") return valore;
  if (nome === "wh/km") return valore / 10;
  if (nome === "km/kwh") return 100 / valore;
  if (nome === "mi/kwh") return 100 / (valore * 1.609344);
  if (nome === "kwh/100mi") return valore / 1.609344;
  return null;
}

/**
 * La settimana dell'auto: quanti chilometri, quanta energia, e il consumo.
 *
 * Il consumo e' quello che l'auto dichiara; se non lo dichiara ma ci sono i
 * chilometri e l'energia della settimana, si fa la divisione e si dice che e'
 * calcolato. `null` se non c'e' nessuno dei tre.
 */
export function laSettimana(lettura = {}) {
  const km = valoreDi(lettura, "km7Giorni");
  const kwh = inKilowattora(
    valoreDi(lettura, "energia7Giorni"),
    unitaDi(lettura, "energia7Giorni"),
  );
  const dichiarato = consumoInKwh100(
    valoreDi(lettura, "consumoMedio"),
    unitaDi(lettura, "consumoMedio"),
  );
  let consumo = dichiarato;
  let calcolato = false;
  if (consumo === null && km !== null && km > 0 && kwh !== null && kwh > 0) {
    consumo = (kwh / km) * 100;
    calcolato = true;
  }
  if (km === null && kwh === null && consumo === null) return null;
  return { km, kwh, consumo, calcolato };
}

/** Le temperature mappate, con il loro posto: `[{ chi, ref, gradi }]`. */
export function temperatureDellAuto(lettura = {}) {
  const fuori = [];
  for (const voce of TEMPERATURE_DELL_AUTO) {
    const gradi = valoreDi(lettura, voce.campo);
    if (gradi === null || typeof gradi !== "number") continue;
    fuori.push({ chi: voce.chi, ref: voce.ref, gradi });
  }
  return fuori;
}

/* ── le gomme: com'e' la pressione ────────────────────────────────────── */

/* Quanti bar fa un'unita' di pressione. */
function inBar(valore, unita) {
  const nome = pulito(unita).toLowerCase();
  if (!nome || nome === "bar") return valore;
  if (nome === "psi") return valore * 0.0689476;
  if (nome === "kpa") return valore / 100;
  if (nome === "mbar") return valore / 1000;
  if (nome === "pa") return valore / 100000;
  return null;
}

/* La forcella di una gomma d'auto, in bar. Le pressioni di targa di quasi
 * tutte le auto stanno fra 2 e 3 bar: sotto 1,9 una gomma e' sgonfia, sopra
 * 3,6 e' gonfiata male. E una gomma che sta 0,3 bar sotto le altre si sta
 * sgonfiando, anche se il numero da solo sembrerebbe a posto: e' cosi' che
 * comincia una foratura lenta. */
export const FORCELLA_DELLE_GOMME = Object.freeze({ min: 1.9, max: 3.6, scarto: 0.3 });

/**
 * Come stanno le gomme, una per una e tutte insieme.
 *
 * Ogni ruota mappata ha il suo `tono`: «bene», «bassa», «alta», o «avviso»
 * quando il sensore dice solo che c'e' un problema. Il verdetto generale e'
 * «bene» se nessuna si lamenta (e nemmeno l'avviso unico dell'auto, se c'e'),
 * «attento» altrimenti, `""` se di gomme non si sa niente.
 */
export function comeStannoLeGomme(lettura = {}, forcella = FORCELLA_DELLE_GOMME) {
  const ruote = ruoteDellAuto(lettura).map((voce) => {
    const bar = voce.pressione === null ? null : inBar(voce.pressione, voce.unita);
    return {
      ...voce,
      bar,
      tono: voce.avviso === true ? "avviso" : voce.avviso === false ? "bene" : "",
    };
  });
  /* Il riferimento e' la gomma piu' gonfia fra quelle nella forcella: una
   * gonfiata troppo e' gia' un problema suo, e non deve far sembrare basse le
   * altre. */
  const nellaForcella = ruote
    .map((voce) => voce.bar)
    .filter((bar) => bar !== null && bar >= forcella.min && bar <= forcella.max);
  const riferimento = nellaForcella.length > 1 ? Math.max(...nellaForcella) : null;
  for (const voce of ruote) {
    if (voce.bar === null) continue;
    if (voce.bar < forcella.min) voce.tono = "bassa";
    else if (voce.bar > forcella.max) voce.tono = "alta";
    else if (riferimento !== null && riferimento - voce.bar >= forcella.scarto - 1e-9)
      voce.tono = "bassa";
    else voce.tono = "bene";
  }
  const riepilogo = lettura?.pneumatici || null;
  const sapute = ruote.length > 0 || Boolean(riepilogo);
  const lamentano =
    riepilogo?.avviso === true || ruote.some((voce) => voce.tono && voce.tono !== "bene");
  return { ruote, verdetto: !sapute ? "" : lamentano ? "attento" : "bene" };
}

/* ── l'auto adesso: ferma, in marcia ──────────────────────────────────── */

/**
 * Cosa sta facendo l'auto, da quello che si sa: «marcia» se la marcia e'
 * D, R o N o la velocita' e' sopra zero; «ferma» se la marcia e' P o il
 * freno di stazionamento e' tirato; `""` se non si sa.
 */
export function cosaFaLAuto(lettura = {}) {
  const marcia = valoreDi(lettura, "marcia");
  const velocita = valoreDi(lettura, "velocita");
  if ((typeof velocita === "number" && velocita > 0) || ["D", "R", "N"].includes(marcia))
    return "marcia";
  if (marcia === "P" || valoreDi(lettura, "frenoStazionamento") === true) return "ferma";
  return "";
}

/* I riferimenti che la pagina mette in un blocco suo — la ricarica accanto
 * all'anello, la settimana, l'energia di oggi, le temperature, le pillole —
 * e che quindi non vanno ripetuti fra gli altri dati. */
export const RIFERIMENTI_IN_BLOCCO = Object.freeze(
  new Set([
    ...PARTI_DELL_ENERGIA.map((voce) => voce.ref),
    ...TEMPERATURE_DELL_AUTO.map((voce) => voce.ref),
    "dm.ev_km_7_giorni",
    "dm.ev_energia_7_giorni",
    "dm.ev_consumo_medio",
    "dm.ev_autonomia_nominale",
    "dm.ev_autonomia_carburante",
    "dm.ev_autonomia_totale",
    "dm.ev_potenza_ricarica",
    "dm.ev_tempo_ricarica",
    "dm.ev_marcia",
    "dm.ev_ultimo_aggiornamento",
    "dm.ev_ultima_ricarica_energia",
    "dm.ev_ultima_ricarica_tipo",
    "dm.ev_ultima_ricarica_inizio",
    "dm.ev_ultima_ricarica_fine",
    "dm.ev_ricarica_inizio",
    "dm.ev_ricarica_fine",
  ]),
);
