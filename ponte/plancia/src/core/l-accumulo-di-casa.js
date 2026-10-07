/* L'accumulo di casa: i pacchi di batterie e i loro BMS (#117).
 *
 * «Poter aggiungere tutte le entità dei BMS, per esempio ho due BMS JK con
 *  stati di carica, stati di salute, correnti e tensioni varie.»
 *
 * La pagina Energia sapeva della batteria una cosa sola: quanta potenza entra
 * o esce, e a che percento è. Un accumulo fatto in casa però non è una
 * batteria: sono due, tre pacchi, ognuno col suo BMS, e ognuno con sedici celle
 * che invecchiano ciascuna per conto suo. Chi lo ha costruito guarda tre cose
 * che un solo percento non dice:
 *
 *  - quanto è piena la CASA, non il pacco: due pacchi di taglia diversa non si
 *    mediano, si pesano sull'energia che tengono;
 *  - quanto manca — al pieno se carica, al vuoto se scarica — a questo ritmo;
 *  - le CELLE: la più bassa e la più alta, e quanto sono lontane. Oltre qualche
 *    decina di millivolt il bilanciatore non ce la fa più da solo, ed è la
 *    cosa che si vuole sapere prima che il BMS stacchi.
 *
 * Una riga della configurazione è un pacco: l'entità della riga è il suo stato
 * di carica, e accanto ci sono le altre — salute, tensione, corrente, potenza,
 * temperature, cicli, capacità, energia residua, le celle una per una, e il
 * delta se il BMS lo pubblica. Le righe le propone il rilevamento, che conosce
 * i nomi con cui i BMS più diffusi — JK, JBD, Daly — si presentano a Home
 * Assistant, e le raggruppa per il prefisso comune.
 *
 * È puro: entrano stati e righe, escono letture e giudizi. Niente DOM, niente
 * memoria, niente orologio.
 */
import { conLaRiga, conLeRighe, righeDichiarate, senzaLaRiga } from "./elenco-dichiarato.js";

const pulito = (valore) => String(valore ?? "").trim();

const numero = (valore) => {
  if (valore === "" || valore == null) return null;
  const n = Number(String(valore).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const MUTI = new Set(["", "unknown", "unavailable", "none", "nan"]);

/* ── la configurazione ───────────────────────────────────────────────────── */

/** Dove si scrive la configurazione dell'accumulo. */
export const CHIAVE_ACCUMULO = "cd_accumulo";

/* Oltre trenta millivolt fra la cella più alta e la più bassa un pacco di
 * LiFePO₄ a riposo è da bilanciare: è il numero che si legge nei forum dei
 * JK, ed è anche quello da cui quasi tutti i BMS fanno partire il bilanciatore
 * attivo. Chi ha celle diverse lo riscrive nel suo pacco. */
export const SOGLIA_DELTA_MV = 30;

/* Sotto questi numeri un pacco è a riposo: il BMS legge qualche decina di
 * milliampere anche fermo, e dire «in carica» per un decimo d'ampere sarebbe
 * dire una cosa che non succede. */
export const RIPOSO_W = 15;
export const RIPOSO_A = 0.3;

/* I BMS che il rilevamento sa riconoscere. «altro» è un BMS qualunque, messo a
 * mano: la pagina lo legge uguale, solo che non sa dirne la marca. */
export const TIPI = Object.freeze(["jk", "jbd", "daly", "altro"]);

/* Le entità di un pacco, oltre al suo stato di carica. */
export const CAMPI_DEL_PACCO = Object.freeze([
  "soh",
  "tensione",
  "corrente",
  "potenza",
  "temperatura",
  "mos",
  "cicli",
  "capacita",
  "energia",
  "delta",
]);

/* Quello che una riga tiene oltre a entità, nome e disegno: la marca del BMS,
 * le entità del pacco, l'unità di una capacità scritta a mano, l'elenco delle
 * celle e la soglia del delta. */
export const CAMPI_IN_PIU = Object.freeze(["tipo", ...CAMPI_DEL_PACCO, "unita", "celle", "soglia"]);

/** Il tipo, se è uno di quelli che si sanno dire. */
export function tipoValido(tipo) {
  const scritto = pulito(tipo).toLowerCase();
  return TIPI.includes(scritto) ? scritto : "";
}

/** Le righe dichiarate con la loro entità: i pacchi che la pagina mostra. */
export function pacchiDellAccumulo(config) {
  return (righeDichiarate(config, CAMPI_IN_PIU) || []).filter((riga) => riga.entity);
}

/**
 * Se c'è qualcosa da mostrare. Solo i pacchi dichiarati contano: la linguetta
 * in Energia nasce spenta, e la accende chi apre la scheda del Config.
 */
export function accumuloConfigurato(config) {
  return pacchiDellAccumulo(config).length > 0;
}

export { conLaRiga, conLeRighe, righeDichiarate, senzaLaRiga };

/* ── le celle scritte a mano ─────────────────────────────────────────────── */

const ENTITA = /^[a-z_]+\.[a-z0-9_]+$/;

/** Un'entità scritta per bene, o `""`. */
export function entitaScritta(valore) {
  const scritta = pulito(valore).toLowerCase();
  return ENTITA.test(scritta) ? scritta : "";
}

/**
 * Le celle da un testo: una per riga, o separate da virgole e spazi — com'è
 * quando le si incolla tutte insieme. Quello che non è un'entità si lascia
 * cadere, e una cella scritta due volte conta una volta sola.
 */
export function celleDaTesto(testo) {
  const viste = new Set();
  const celle = [];
  for (const pezzo of String(testo ?? "").split(/[\s,;]+/)) {
    const entity = entitaScritta(pezzo);
    if (!entity || viste.has(entity)) continue;
    viste.add(entity);
    celle.push(entity);
  }
  return celle;
}

/** Le celle di una riga, sempre come elenco. */
export function celleDellaRiga(riga) {
  const celle = riga?.celle;
  if (Array.isArray(celle)) return celleDaTesto(celle.join("\n"));
  return celleDaTesto(celle);
}

/* ── cosa dice un'entità di un BMS ───────────────────────────────────────── */

/*
 * I nomi con cui i BMS si presentano. L'entità è `sensor.<prefisso>_<coda>`, e
 * il prefisso è il pacco — `jk_bms`, `jk_bms_2`, `daly_bms_garage` — mentre la
 * coda dice cosa misura:
 *
 *   · esphome-jk-bms e jk_bms BLE: `state_of_charge`, `total_voltage`,
 *     `current`, `power`, `cell_voltage_1`…`_24`, `delta_cell_voltage`,
 *     `charging_cycles`, `temperature_sensor_1`, `power_tube_temperature`,
 *     `capacity_remaining`, `total_battery_capacity_setting`;
 *   · esphome-jbd-bms: le stesse, con `temperature_1` e `nominal_capacity`;
 *   · Daly (il componente di ESPHome): `battery_level`, `voltage`, `current`,
 *     `cell_1_voltage`…, `remaining_capacity`, `battery_cycles`;
 *   · bms_ble, che li parla tutti da Bluetooth: `battery`, `voltage`,
 *     `delta_voltage`, `stored_energy`, `cycles`.
 *
 * Il prefisso è il più corto che lascia una coda conosciuta, così
 * `jk_bms_delta_cell_voltage` è il delta di `jk_bms` e non la tensione di
 * `jk_bms_delta_cell`. Prima le code che si confonderebbero con altre: il
 * delta e le celle prima della tensione, la temperatura dei MOS prima della
 * temperatura. Quelle che si riconoscono ma non servono — la cella più alta,
 * la media — si mettono da parte, perché non finiscano lette come un'altra.
 */
const CODE = Object.freeze([
  ["scarta", /^(.+?)_(?:min|max|average|avg|highest|lowest)_cell_voltage$/],
  ["scarta", /^(.+?)_cell_voltage_(?:min|max|average|avg)$/],
  ["scarta", /^(.+?)_(?:min|max)_voltage_cell$/],
  [
    "delta",
    /^(.+?)_(?:delta_cell_voltage|cell_voltage_delta|cell_delta_voltage|delta_voltage|cell_voltage_difference|cell_delta)$/,
  ],
  ["cella", /^(.+?)_cell_voltage_?(\d{1,2})$/],
  ["cella", /^(.+?)_cell_?(\d{1,2})_voltage$/],
  ["soc", /^(.+?)_(?:state_of_charge|soc|battery_level)$/],
  ["soc", /^(.+?)_battery$/],
  ["soh", /^(.+?)_(?:state_of_health|soh)$/],
  ["tensione", /^(.+?)_(?:total_voltage|battery_voltage|pack_voltage|voltage)$/],
  ["corrente", /^(.+?)_(?:battery_current|current)$/],
  ["potenza", /^(.+?)_(?:battery_power|power)$/],
  ["mos", /^(.+?)_(?:power_tube_temperature|mosfet_temperature|mos_temperature|temperature_mos)$/],
  ["temperatura", /^(.+?)_(?:temperature_sensor_1|temperature_1|battery_temperature|temperature)$/],
  ["cicli", /^(.+?)_(?:charging_cycles|battery_cycles|cycle_count|cycles)$/],
  [
    "energia",
    /^(.+?)_(?:capacity_remaining|remaining_capacity|stored_energy|remaining_energy|energy_remaining)$/,
  ],
  [
    "capacita",
    /^(.+?)_(?:total_battery_capacity_setting|nominal_capacity|design_capacity|battery_capacity|total_capacity|capacity)$/,
  ],
]);

/* L'unità che ogni campo può avere. Un sensore che dichiara un'unità diversa
 * non è quel campo, anche se il nome lo farebbe pensare: `sensor.x_power` in
 * percento è la percentuale di qualcos'altro. Senza unità si accetta. */
const UNITA_DEL_CAMPO = Object.freeze({
  soc: /^%$/,
  soh: /^%$/,
  tensione: /^m?V$/,
  cella: /^m?V$/,
  delta: /^m?V$/,
  corrente: /^m?A$/,
  potenza: /^k?W$/,
  temperatura: /^°?[CF]$/,
  mos: /^°?[CF]$/,
  cicli: /^$|cycl|cicl/i,
  energia: /^(?:m?Ah|k?Wh)$/,
  capacita: /^(?:m?Ah|k?Wh)$/,
});

function unitaDi(stato) {
  return pulito(stato?.attributes?.unit_of_measurement);
}

function unitaAdatta(campo, stato) {
  const unita = unitaDi(stato);
  if (!unita) return campo !== "soc" || pulito(stato?.attributes?.device_class) === "battery";
  return UNITA_DEL_CAMPO[campo]?.test(unita) ?? true;
}

/**
 * Cosa è questa entità in un BMS: `{ campo, prefisso, indice? }`, oppure
 * `null` se non è niente che un BMS pubblichi.
 */
export function campoDelBms(entity, stato) {
  const id = pulito(entity);
  if (!id.startsWith("sensor.")) return null;
  const oggetto = id.slice("sensor.".length);
  for (const [campo, regola] of CODE) {
    const trovato = regola.exec(oggetto);
    if (!trovato) continue;
    if (campo === "scarta") return null;
    /* `soc` da un `_battery` nudo solo se Home Assistant lo dichiara una
     * batteria: altrimenti ogni telefono di casa sarebbe un pacco. */
    if (campo === "soc" && /_battery$/.test(oggetto) && !/_battery_level$/.test(oggetto)) {
      if (pulito(stato?.attributes?.device_class) !== "battery") continue;
    }
    if (!unitaAdatta(campo, stato)) continue;
    const fuori = { campo, prefisso: trovato[1] };
    if (campo === "cella") fuori.indice = Number(trovato[2]);
    return fuori;
  }
  return null;
}

/* La marca, da come si chiama. */
function tipoDaNomi(testo, gruppo) {
  const scritto = testo.toLowerCase();
  if (/(^|[^a-z])jk([^a-z]|$)|jkbms|jikong/.test(scritto)) return "jk";
  if (/jbd|xiaoxiang|overkill/.test(scritto)) return "jbd";
  if (/daly/.test(scritto)) return "daly";
  /* Senza la marca nel nome la dice la forma: il tubo di potenza è solo dei
   * JK, la cella col numero in mezzo solo dei Daly. */
  if (gruppo.jk) return "jk";
  if (gruppo.daly) return "daly";
  return "altro";
}

const SIGLE = new Set(["jk", "jbd", "bms", "ble", "soc", "lfp"]);

/* Il nome di un pacco dal suo prefisso, quando le entità non ne danno uno. */
function nomeDalPrefisso(prefisso) {
  return prefisso
    .split("_")
    .filter(Boolean)
    .map((parola) =>
      SIGLE.has(parola) ? parola.toUpperCase() : parola[0].toUpperCase() + parola.slice(1),
    )
    .join(" ");
}

/* Il nome comune: le parole con cui cominciano tutti i nomi del gruppo. È il
 * nome del dispositivo, che Home Assistant mette davanti a ogni entità. */
function nomeComune(nomi) {
  const parole = nomi.map((nome) => pulito(nome).split(/\s+/).filter(Boolean));
  if (parole.length < 2 || parole.some((voce) => !voce.length)) return "";
  const comuni = [];
  for (let i = 0; i < parole[0].length; i += 1) {
    const parola = parole[0][i];
    if (parole.every((voce) => voce[i] === parola)) comuni.push(parola);
    else break;
  }
  /* Un nome intero in comune vuol dire nomi tutti uguali: non è un prefisso. */
  if (comuni.length >= Math.min(...parole.map((voce) => voce.length))) return "";
  return comuni.join(" ");
}

/**
 * I pacchi che il rilevamento proporrebbe adesso, raggruppati per prefisso.
 *
 * Un gruppo è un pacco quando ha lo stato di carica e qualcos'altro che solo
 * un BMS pubblica: almeno due celle, o la tensione e la corrente insieme. Un
 * telefono ha lo stato di carica e basta, e non diventa un pacco. Quelli già
 * dichiarati non tornano.
 */
export function pacchiDaImportare(states = {}, config, nomeDi = (entity) => entity) {
  const gia = new Set(pacchiDellAccumulo(config).map((riga) => riga.entity));
  const gruppi = new Map();
  for (const [entity, stato] of Object.entries(states || {})) {
    const trovato = campoDelBms(entity, stato);
    if (!trovato) continue;
    const { prefisso, campo } = trovato;
    const gruppo = gruppi.get(prefisso) || {
      celle: [],
      campi: {},
      nomi: [],
      jk: false,
      daly: false,
    };
    gruppi.set(prefisso, gruppo);
    gruppo.nomi.push(pulito(stato?.attributes?.friendly_name));
    if (campo === "cella") {
      gruppo.celle.push({ entity, indice: trovato.indice });
      if (/_cell_?\d{1,2}_voltage$/.test(entity)) gruppo.daly = true;
      continue;
    }
    if (campo === "mos" && /power_tube/.test(entity)) gruppo.jk = true;
    /* Il primo che arriva tiene il posto: due `temperature_sensor_1` non ci
     * sono, ma `temperature_1` e `temperature` sì, e la sonda numerata è la
     * più precisa. */
    if (!gruppo.campi[campo]) gruppo.campi[campo] = entity;
    else if (campo === "temperatura" && /_1$/.test(entity)) gruppo.campi[campo] = entity;
  }
  const pacchi = [];
  for (const [prefisso, gruppo] of gruppi) {
    const soc = gruppo.campi.soc;
    if (!soc || gia.has(soc)) continue;
    const bms = gruppo.celle.length >= 2 || (gruppo.campi.tensione && gruppo.campi.corrente);
    if (!bms) continue;
    const nome =
      nomeComune(gruppo.nomi.filter(Boolean)) ||
      nomeDalPrefisso(prefisso) ||
      pulito(nomeDi(soc)) ||
      soc;
    const riga = {
      entity: soc,
      name: nome,
      icon: "battery",
      tipo: tipoDaNomi(`${prefisso} ${gruppo.nomi.join(" ")}`, gruppo),
    };
    for (const campo of CAMPI_DEL_PACCO) if (gruppo.campi[campo]) riga[campo] = gruppo.campi[campo];
    const celle = gruppo.celle.sort((a, b) => a.indice - b.indice).map((cella) => cella.entity);
    if (celle.length) riga.celle = celle;
    pacchi.push(riga);
  }
  /* Nell'ordine delle entità, coi numeri da numeri: il pacco 2 dopo l'1 e
   * prima del 10, come stanno sullo scaffale. */
  return pacchi.sort((a, b) => a.entity.localeCompare(b.entity, "en", { numeric: true }));
}

/**
 * Le celle di un pacco che Home Assistant ha, dal prefisso delle sue entità:
 * è il tasto «Trova le celle» della scheda, per chi il pacco l'ha scritto a
 * mano e le celle sono ventiquattro.
 */
export function celleDelPacco(states = {}, riga) {
  const prefissi = new Set();
  for (const entity of [riga?.entity, ...CAMPI_DEL_PACCO.map((campo) => riga?.[campo])]) {
    const id = entitaScritta(entity);
    if (!id) continue;
    const trovato = campoDelBms(id, states?.[id]);
    if (trovato) prefissi.add(trovato.prefisso);
  }
  if (!prefissi.size) return [];
  const celle = [];
  for (const [entity, stato] of Object.entries(states || {})) {
    const trovato = campoDelBms(entity, stato);
    if (trovato?.campo === "cella" && prefissi.has(trovato.prefisso))
      celle.push({ entity, indice: trovato.indice });
  }
  return celle.sort((a, b) => a.indice - b.indice).map((cella) => cella.entity);
}

/* ── un pacco, letto ─────────────────────────────────────────────────────── */

/* Il numero di un'entità con la sua unità, o `null` se tace. */
function misura(states, entity) {
  const id = entitaScritta(entity);
  if (!id) return null;
  const stato = states?.[id];
  const grezzo = pulito(stato?.state).toLowerCase();
  if (!stato || MUTI.has(grezzo)) return null;
  const valore = numero(stato.state);
  if (valore === null) return null;
  return { valore, unita: unitaDi(stato) };
}

/* Tutto in volt, ampere e watt: i BMS parlano in millivolt quanto in volt, e
 * in kilowatt quanto in watt. */
function inVolt(letta) {
  if (!letta) return null;
  return /^mV$/.test(letta.unita) ? letta.valore / 1000 : letta.valore;
}

function inAmpere(letta) {
  if (!letta) return null;
  return /^mA$/.test(letta.unita) ? letta.valore / 1000 : letta.valore;
}

function inWatt(letta) {
  if (!letta) return null;
  return /^kW$/.test(letta.unita) ? letta.valore * 1000 : letta.valore;
}

/* Il delta in millivolt. Senza unità lo dice il numero: nessun pacco ha le
 * celle a un volt di distanza, e nessun BMS scrive 0,012 millivolt. */
function inMillivolt(letta) {
  if (!letta) return null;
  if (/^mV$/.test(letta.unita)) return letta.valore;
  if (/^V$/.test(letta.unita) || Math.abs(letta.valore) < 1) return letta.valore * 1000;
  return letta.valore;
}

/* Un'energia in kWh. Gli amperora si portano in energia con la tensione del
 * pacco: è la stessa moltiplicazione che fa l'etichetta sul pacco. */
function inKwh(valore, unita, tensione) {
  if (valore === null || valore === undefined) return null;
  const u = pulito(unita);
  if (/^kWh$/i.test(u)) return valore;
  if (/^Wh$/i.test(u)) return valore / 1000;
  if (/^mAh$/i.test(u)) return tensione ? (valore / 1000) * (tensione / 1000) : null;
  if (/^Ah$/i.test(u)) return tensione ? (valore * tensione) / 1000 : null;
  return null;
}

/* La capacità: un'entità, oppure un numero scritto a mano con la sua unità —
 * quasi nessun BMS la pubblica, ed è scritta sull'etichetta del pacco. */
function capacitaScritta(riga, states) {
  const entity = entitaScritta(riga?.capacita);
  if (entity) {
    const letta = misura(states, entity);
    return letta ? { valore: letta.valore, unita: letta.unita } : null;
  }
  const valore = numero(riga?.capacita);
  if (valore === null || valore <= 0) return null;
  return { valore, unita: /kwh/i.test(pulito(riga?.unita)) ? "kWh" : "Ah" };
}

/** Il verso di un pacco, da quello che si sa: la potenza, o la corrente. */
export function versoDelPacco(potenza, corrente) {
  if (potenza !== null && potenza !== undefined) {
    if (potenza >= RIPOSO_W) return "carica";
    if (potenza <= -RIPOSO_W) return "scarica";
    return "riposo";
  }
  if (corrente !== null && corrente !== undefined) {
    if (corrente >= RIPOSO_A) return "carica";
    if (corrente <= -RIPOSO_A) return "scarica";
    return "riposo";
  }
  return null;
}

/**
 * Le celle lette: ognuna col suo numero e i volt, e poi la più bassa, la più
 * alta, la media e quanto sono lontane in millivolt. Una cella che tace resta
 * al suo posto con `volt: null`: toglierla vorrebbe dire rinumerare le altre.
 */
export function celleLette(states = {}, celle = []) {
  const lette = celle.map((entity, posto) => ({
    entity,
    numero: posto + 1,
    volt: inVolt(misura(states, entity)),
  }));
  const vive = lette.filter((cella) => cella.volt !== null);
  if (!vive.length) return { celle: lette, minima: null, massima: null, media: null, delta: null };
  let minima = vive[0];
  let massima = vive[0];
  for (const cella of vive) {
    if (cella.volt < minima.volt) minima = cella;
    if (cella.volt > massima.volt) massima = cella;
  }
  const media = vive.reduce((somma, cella) => somma + cella.volt, 0) / vive.length;
  return {
    celle: lette,
    minima,
    massima,
    media,
    delta: vive.length >= 2 ? Math.round((massima.volt - minima.volt) * 1000) : null,
  };
}

/**
 * Un pacco, letto adesso dagli stati.
 *
 * I numeri sono già nelle unità di casa: volt, ampere, watt, kWh, millivolt
 * per il delta. La corrente e la potenza sono col segno del BMS — positive in
 * carica — perché è così che le scrivono JK, JBD e Daly. Quello che il pacco
 * non pubblica resta `null`: la potenza si ricava da tensione e corrente,
 * l'energia residua dalla carica e dalla capacità, il delta dalle celle.
 */
export function letturaDelPacco(riga, states = {}, nomeDi = (entity) => entity) {
  const entity = pulito(riga?.entity);
  const soc = misura(states, entity)?.valore ?? null;
  const tensione = inVolt(misura(states, riga?.tensione));
  const corrente = inAmpere(misura(states, riga?.corrente));
  const scritta = inWatt(misura(states, riga?.potenza));
  const potenza =
    scritta ?? (tensione !== null && corrente !== null ? Math.round(tensione * corrente) : null);
  const temperatura = misura(states, riga?.temperatura);
  const mos = misura(states, riga?.mos);
  const celle = celleLette(states, celleDellaRiga(riga));
  /* La tensione per portare gli amperora in energia: quella letta, o le celle
   * messe in fila. */
  const tensionePerEnergia =
    tensione ??
    (celle.media !== null ? celle.media * celle.celle.filter((c) => c.volt !== null).length : null);
  const capacita = capacitaScritta(riga, states);
  const capacitaKwh = capacita ? inKwh(capacita.valore, capacita.unita, tensionePerEnergia) : null;
  const residua = misura(states, riga?.energia);
  const energiaLetta = residua ? inKwh(residua.valore, residua.unita, tensionePerEnergia) : null;
  const energiaKwh =
    energiaLetta ?? (soc !== null && capacitaKwh !== null ? (soc / 100) * capacitaKwh : null);
  const deltaBms = inMillivolt(misura(states, riga?.delta));
  const delta = deltaBms !== null ? Math.round(deltaBms) : celle.delta;
  const soglia = numero(riga?.soglia) ?? SOGLIA_DELTA_MV;
  return Object.freeze({
    entity,
    name: pulito(riga?.name) || pulito(nomeDi(entity)) || entity,
    icon: pulito(riga?.icon) || "battery",
    tipo: tipoValido(riga?.tipo) || "altro",
    muto: soc === null,
    soc,
    soh: misura(states, riga?.soh)?.valore ?? null,
    tensione,
    corrente,
    potenza,
    temperatura: temperatura?.valore ?? null,
    unitaTemperatura: temperatura?.unita || mos?.unita || "",
    mos: mos?.valore ?? null,
    cicli: misura(states, riga?.cicli)?.valore ?? null,
    capacitaKwh,
    capacitaAh:
      capacita && /^Ah$/i.test(capacita.unita)
        ? capacita.valore
        : capacita && /^mAh$/i.test(capacita.unita)
          ? capacita.valore / 1000
          : null,
    energiaKwh,
    celle: celle.celle,
    minima: celle.minima,
    massima: celle.massima,
    media: celle.media,
    delta,
    deltaDalBms: deltaBms !== null,
    soglia,
    sbilanciato: delta !== null && delta > soglia,
    verso: versoDelPacco(potenza, corrente),
  });
}

/** I pacchi dichiarati, letti, nell'ordine in cui li si è scritti. */
export function accumuloDiCasa(states = {}, config, nomeDi = (entity) => entity) {
  return pacchiDellAccumulo(config).map((riga) => letturaDelPacco(riga, states, nomeDi));
}

/* ── tutti insieme ───────────────────────────────────────────────────────── */

/**
 * Quanti minuti mancano, a questo ritmo: al pieno se carica, al vuoto se
 * scarica. `null` quando non si può dire — a riposo, o senza sapere quanta
 * energia c'è dentro e quanta ce ne sta.
 */
export function minutiAllaFine({ verso, potenza, energiaKwh, capacitaKwh }) {
  if (potenza === null || potenza === undefined || Math.abs(potenza) < RIPOSO_W) return null;
  const kw = Math.abs(potenza) / 1000;
  if (verso === "carica") {
    if (capacitaKwh === null || energiaKwh === null || capacitaKwh === undefined) return null;
    const mancano = Math.max(0, capacitaKwh - energiaKwh);
    return Math.round((mancano / kw) * 60);
  }
  if (verso === "scarica") {
    if (energiaKwh === null || energiaKwh === undefined) return null;
    return Math.round((Math.max(0, energiaKwh) / kw) * 60);
  }
  return null;
}

/**
 * Da dove arriva la carica, o dove va la scarica, se la pagina Energia lo sa.
 *
 * `casa` sono le letture di casa in watt: `solare`, `rete` (positiva quando si
 * preleva) e `casa`. Si dice una fonte solo quando porta almeno metà della
 * carica: con un sole debole e la rete che tira, «dal fotovoltaico» sarebbe
 * una mezza bugia.
 */
export function daDove(verso, potenza, casa = {}) {
  const watt = Math.abs(numero(potenza) ?? 0);
  if (!watt) return null;
  if (verso === "carica") {
    const solare = numero(casa?.solare);
    const rete = numero(casa?.rete);
    if (solare !== null && solare >= watt / 2) return "solare";
    if (rete !== null && rete >= watt / 2) return "rete";
    return null;
  }
  if (verso === "scarica") {
    const consumo = numero(casa?.casa);
    return consumo !== null && consumo > 0 ? "casa" : null;
  }
  return null;
}

/**
 * Come sta l'accumulo, tutti i pacchi insieme.
 *
 * La carica di tutto è pesata sull'energia quando ogni pacco sa quanta ne
 * tiene — un pacco da 5 kWh al 20% e uno da 15 al 90% fanno 72,5%, non 55 —
 * e altrimenti è la media: meglio un numero giusto a metà che nessun numero.
 */
export function comeStaLAccumulo(pacchi = [], casa = {}) {
  const vivi = pacchi.filter((pacco) => !pacco.muto);
  const sbilanciati = pacchi.filter((pacco) => !pacco.muto && pacco.sbilanciato);
  if (!vivi.length)
    return Object.freeze({
      stato: "muti",
      soc: null,
      pesata: false,
      potenza: null,
      verso: null,
      capacitaKwh: null,
      energiaKwh: null,
      minuti: null,
      daDove: null,
      sbilanciati,
      muti: pacchi,
      vivi,
    });
  const conCapacita = vivi.every((pacco) => pacco.capacitaKwh !== null && pacco.capacitaKwh > 0);
  const capacitaKwh = conCapacita
    ? vivi.reduce((somma, pacco) => somma + pacco.capacitaKwh, 0)
    : null;
  const soc = conCapacita
    ? vivi.reduce((somma, pacco) => somma + pacco.soc * pacco.capacitaKwh, 0) / capacitaKwh
    : vivi.reduce((somma, pacco) => somma + pacco.soc, 0) / vivi.length;
  const conEnergia = vivi.every((pacco) => pacco.energiaKwh !== null);
  const energiaKwh = conEnergia
    ? vivi.reduce((somma, pacco) => somma + pacco.energiaKwh, 0)
    : capacitaKwh !== null
      ? (soc / 100) * capacitaKwh
      : null;
  const potenze = vivi.map((pacco) => pacco.potenza).filter((watt) => watt !== null);
  const potenza = potenze.length ? potenze.reduce((somma, watt) => somma + watt, 0) : null;
  const correnti = vivi.map((pacco) => pacco.corrente).filter((ampere) => ampere !== null);
  const verso =
    potenza !== null
      ? versoDelPacco(potenza, null)
      : correnti.length
        ? versoDelPacco(
            null,
            correnti.reduce((somma, ampere) => somma + ampere, 0),
          )
        : null;
  return Object.freeze({
    stato: sbilanciati.length ? "sbilanciato" : "bene",
    soc,
    pesata: conCapacita,
    potenza,
    verso,
    capacitaKwh,
    energiaKwh,
    minuti: minutiAllaFine({ verso, potenza, energiaKwh, capacitaKwh }),
    daDove: daDove(verso, potenza, casa),
    sbilanciati,
    muti: pacchi.filter((pacco) => pacco.muto),
    vivi,
  });
}
