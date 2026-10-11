/* Che cosa e' un sensore, per disegnarlo: dal suo tipo, non dal suo dominio.
 *
 * «Simbolo temperatura su un sensore che è finestra, che c'entra?» Nella
 * finestra dei dispositivi non connessi il segno veniva dal dominio di Home
 * Assistant: `sensor` voleva dire 🌡️, `binary_sensor` 📟. Ma il dominio dice
 * come Home Assistant tiene il dato, non che cosa misura: un contatto della
 * finestra e' un `binary_sensor` come il rilevatore di fumo, e la pila di una
 * porta e' un `sensor` come il termometro del salotto. Il tipo vero sta nella
 * `device_class` — `window`, `door`, `motion`, `temperature` — ed e' quella che
 * va disegnata. «Idem batteria: mostra icone, non solo testo»: la stessa
 * regola serve alle batterie, dove la pila e' di un dispositivo e il disegno
 * giusto e' quello del dispositivo, non quello della pila.
 *
 * Qui c'e' solo la regola: da classe, dominio e nome al disegno del catalogo
 * (`catalogo-disegni.js`) e a una chiave del tipo, che le parole da mostrare le
 * mette chi disegna (la finestra traduce, il nucleo no). E' puro: nessun DOM,
 * nessuna memoria — gli stati e la mappa dei dispositivi li passa chi chiama.
 */

const pulito = (valore) => String(valore ?? "").trim();
const minuscolo = (valore) => pulito(valore).toLowerCase();

/* Le classi che si sanno disegnare, con il tipo che diventa la parola. Sono
 * le classi di Home Assistant per `binary_sensor` e `sensor`: le stesse
 * parole valgono per entrambi i domini, e non si confondono — `battery` di un
 * binary_sensor e' «pila scarica», ma resta una pila. */
const PER_CLASSE = Object.freeze({
  window: { disegno: "window", tipo: "finestra" },
  door: { disegno: "door", tipo: "porta" },
  garage_door: { disegno: "door", tipo: "porta" },
  opening: { disegno: "door", tipo: "porta" },
  motion: { disegno: "motion", tipo: "movimento" },
  occupancy: { disegno: "motion", tipo: "movimento" },
  presence: { disegno: "motion", tipo: "movimento" },
  smoke: { disegno: "smoke", tipo: "fumo" },
  gas: { disegno: "smoke", tipo: "fumo" },
  carbon_monoxide: { disegno: "smoke", tipo: "fumo" },
  moisture: { disegno: "humidity", tipo: "perdita" },
  temperature: { disegno: "thermometer", tipo: "temperatura" },
  humidity: { disegno: "humidity", tipo: "umidita" },
  power: { disegno: "power", tipo: "potenza" },
  energy: { disegno: "power", tipo: "potenza" },
  current: { disegno: "power", tipo: "potenza" },
  voltage: { disegno: "power", tipo: "potenza" },
  battery: { disegno: "battery", tipo: "batteria" },
  lock: { disegno: "lock", tipo: "serratura" },
  illuminance: { disegno: "sun", tipo: "luce-ambiente" },
  pressure: { disegno: "gauge", tipo: "pressione" },
  atmospheric_pressure: { disegno: "gauge", tipo: "pressione" },
  carbon_dioxide: { disegno: "wind", tipo: "aria" },
  pm25: { disegno: "wind", tipo: "aria" },
  pm10: { disegno: "wind", tipo: "aria" },
  volatile_organic_compounds: { disegno: "wind", tipo: "aria" },
});

/* Quando la classe non c'e', il dominio dice almeno che genere di cosa e'.
 * `sensor` e `binary_sensor` senza classe non sono termometri: sono sensori e
 * basta, e prendono il disegno del sensore a muro. */
const PER_DOMINIO = Object.freeze({
  light: { disegno: "lights", tipo: "luce" },
  switch: { disegno: "socket", tipo: "presa" },
  sensor: { disegno: "radar", tipo: "sensore" },
  binary_sensor: { disegno: "radar", tipo: "sensore" },
  climate: { disegno: "radiator", tipo: "clima" },
  camera: { disegno: "camera", tipo: "telecamera" },
  media_player: { disegno: "speaker", tipo: "lettore" },
  cover: { disegno: "shutters", tipo: "tapparella" },
  lock: { disegno: "lock", tipo: "serratura" },
  vacuum: { disegno: "robot", tipo: "aspirapolvere" },
  fan: { disegno: "wind", tipo: "ventilatore" },
  valve: { disegno: "water", tipo: "valvola" },
  water_heater: { disegno: "boiler", tipo: "boiler" },
});

/* L'ultima spiaggia: il nome. Un'entita' che non risponde puo' aver perso
 * gli attributi, e una pila spesso non ha fratelli noti; ma chi l'ha chiamata
 * «Sensore porta ingresso» il tipo l'ha gia' detto. L'ordine conta: «porta
 * finestra» e' una finestra, «termostato» non e' una porta. */
const PER_NOME = Object.freeze([
  [/finestr|window|lucernari|velux/, "window"],
  [/\bport[ae]\b|portone|portoncin|\bdoor|cancell|basculante|garage/, "door"],
  [/moviment|motion|\bpir\b|presenz|occupan|presence/, "motion"],
  [/fumo|smoke|incendi|\bgas\b|monossido/, "smoke"],
  [/perdit|allag|\bleak|flood|moisture/, "moisture"],
  [/umidit|humidity/, "humidity"],
  [/temperatur|termometr|termostat|thermo|\btemp\b/, "temperature"],
  [/serratur|\block\b|nuki/, "lock"],
]);

/**
 * Il disegno e il tipo di un sensore.
 *
 * @param {{entity?:string, classe?:string, nome?:string}} voce
 * @returns {{disegno:string, tipo:string}} la chiave del catalogo e il tipo
 *   (`finestra`, `porta`, `movimento`…), `{disegno:"radar", tipo:""}` se non
 *   si sa proprio niente.
 */
export function tipoDelSensore({ entity = "", classe = "", nome = "" } = {}) {
  const daClasse = PER_CLASSE[minuscolo(classe)];
  if (daClasse) return { ...daClasse };
  const dominio = minuscolo(entity).split(".")[0];
  /* Un sensore senza classe col nome che parla: il nome vince sul dominio,
   * che di un sensore direbbe solo «sensore». */
  const parlante = classeDalNome(nome || entity);
  if (parlante && (!PER_DOMINIO[dominio] || dominio.endsWith("sensor")))
    return { ...PER_CLASSE[parlante] };
  if (PER_DOMINIO[dominio]) return { ...PER_DOMINIO[dominio] };
  if (parlante) return { ...PER_CLASSE[parlante] };
  return { disegno: "radar", tipo: "" };
}

/** La classe che il nome lascia intendere, o `""`. */
export function classeDalNome(nome) {
  const testo = minuscolo(nome).replace(/[_.]+/g, " ");
  if (!testo) return "";
  for (const [regola, classe] of PER_NOME) if (regola.test(testo)) return classe;
  return "";
}

/* Le classi che dicono di un dispositivo piu' delle altre: una porta ha il
 * contatto, la pila e magari la temperatura del chip, ed e' una porta. */
const PRIORITA = Object.freeze([
  "window",
  "door",
  "garage_door",
  "opening",
  "smoke",
  "gas",
  "carbon_monoxide",
  "moisture",
  "lock",
  "motion",
  "occupancy",
  "presence",
  "temperature",
  "humidity",
  "power",
  "energy",
]);

/**
 * Il tipo di un dispositivo fatto di piu' entita': fra le loro classi vince
 * quella che dice di piu' (`PRIORITA`), poi il nome, poi la prima entita'.
 *
 * Serve a «Non connessi», dove una riga e' un dispositivo intero — il
 * contatto della finestra, la sua pila, la temperatura del chip — e il segno
 * deve essere quello della finestra.
 *
 * @param {string[]} entita
 * @param {{states?:object, nome?:string}} contesto
 */
export function tipoFraLeEntita(entita, { states = {}, nome = "" } = {}) {
  const elenco = (Array.isArray(entita) ? entita : [entita]).map(pulito).filter(Boolean);
  let migliore = -1;
  let scelta = null;
  for (const id of elenco) {
    const classe = minuscolo(states?.[id]?.attributes?.device_class);
    const posto = PRIORITA.indexOf(classe);
    if (posto >= 0 && (migliore < 0 || posto < migliore)) {
      migliore = posto;
      scelta = { entity: id, classe };
    }
  }
  if (scelta) return tipoDelSensore(scelta);
  const primo = elenco[0] || "";
  return tipoDelSensore({
    entity: primo,
    classe: states?.[primo]?.attributes?.device_class,
    nome: nome || states?.[primo]?.attributes?.friendly_name || primo,
  });
}

/**
 * Il tipo del dispositivo a cui appartiene un'entita' — per una pila, la
 * cosa che la pila alimenta.
 *
 * Si guardano i fratelli: le entita' dello stesso dispositivo (`di`, la mappa
 * entita' → dispositivo che la plancia ricorda), e fra le loro classi vince
 * quella che dice di piu'. Senza fratelli noti si prova col nome; senza
 * niente resta la classe dell'entita' stessa.
 *
 * @param {string} entity
 * @param {{states?:object, di?:object, nome?:string}} contesto
 */
export function tipoDelDispositivo(entity, { states = {}, di = {}, nome = "" } = {}) {
  const id = pulito(entity);
  const suo = pulito(di?.[id]);
  if (suo) {
    const fratelli = Object.entries(di || {})
      .filter(([altra, dispositivo]) => altra !== id && pulito(dispositivo) === suo)
      .map(([altra]) => altra)
      .filter((altra) => PRIORITA.includes(minuscolo(states?.[altra]?.attributes?.device_class)));
    if (fratelli.length) return tipoFraLeEntita(fratelli, { states });
  }
  const parlante = classeDalNome(nome || states?.[id]?.attributes?.friendly_name || id);
  if (parlante) return { ...PER_CLASSE[parlante] };
  return tipoDelSensore({ entity: id, classe: states?.[id]?.attributes?.device_class });
}
