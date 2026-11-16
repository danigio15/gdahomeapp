/* Le entità che uno si aggiunge dove vuole (#271).
 *
 * «In alcune schede non è possibile inserire entità o sensori personalizzati.
 * Sarebbe carino avere la possibilità d'aggiungere le entità o sensori
 * personalizzati in ogni scheda del progetto, modificando il nome, icona,
 * stanza di destinazione.»
 *
 * Alcune sezioni sono elenchi — Luci, Prese, Telecamere, Robot — e lì aggiungere
 * un'entità si è sempre potuto: l'elenco è la sezione. Altre sono fatte di
 * caselle con un ruolo preciso — l'Energia ha una rete e un fotovoltaico, la
 * Sicurezza una centrale, il MiniPC una CPU — e lì non c'era posto per un
 * sensore in più: quello che non ha un ruolo non si poteva scrivere da nessuna
 * parte, e restava fuori dalla plancia anche se in casa c'era.
 *
 * Qui c'è quel posto. Una voce dice quattro cose: quale entità, in quale
 * sezione farla comparire, come chiamarla e con che icona — più la stanza,
 * facoltativa, che serve a farla comparire anche nella sua stanza.
 *
 * Il modulo è puro: entrano le voci scritte e gli stati di Home Assistant,
 * escono le righe da disegnare. Chi disegna non decide niente.
 */
import { siPuoScegliere } from "./comandi-accanto.js";
import { servizioPermesso } from "./automazioni.js";

const pulito = (valore) => String(valore ?? "").trim();

export const CHIAVE_ENTITA_MIE = "cd_entita_mie";

/* Un tetto, come per le sezioni proprie: dodici entità in più su una pagina
 * sono già un elenco, e oltre non è più «qualcosa in più», è un'altra
 * sezione — che infatti si può fare, ed è #262. */
export const MASSIMO_PER_SEZIONE = 12;

/* Le entità che si comandano col tocco, e quelle che si guardano e basta.
 * È lo stesso elenco delle sezioni proprie, e per la stessa ragione: un
 * interruttore sotto un sensore di temperatura è un tasto che non fa niente. */
const COMANDABILI = new Set([
  "switch",
  "light",
  "fan",
  "input_boolean",
  "scene",
  "script",
  "automation",
]);

/* ── l'interruttore fatto a mano (#406) ─────────────────────────────────
 *
 * «Vorrei che sia possibile creare entità personalizzata di tipo switch.
 * L'azione di uno switch se fosse possibile configurarla come fosse
 * un'entità ma come switch, e assegnarla alla maschera che voglio.»
 *
 * Un'entità mia fa vedere una cosa che in Home Assistant c'è già. Un
 * interruttore mio è una cosa che in Home Assistant NON c'è: una levetta
 * che all'accensione fa una cosa — uno script, una scena, un servizio
 * qualsiasi — e allo spegnimento un'altra, e che si dice accesa leggendo
 * un'entità a scelta. Senza un'entità da leggere è un tasto a impulso: ogni
 * tocco fa l'accensione.
 *
 * Vive nello stesso cassetto delle entità mie, con un campo in più —
 * `tipo: "interruttore"` — e i campi piatti che scrive la scheda:
 *
 *   { id, tipo: "interruttore", nome, icona, sezione,
 *     entity, acceso_se,                       ← da dove si legge lo stato
 *     accendi_servizio, accendi_entity, accendi_dati,
 *     spegni_servizio,  spegni_entity,  spegni_dati }
 *
 * Piatti e non annidati perché è la forma in cui li scrive e li rilegge la
 * scheda, campo per campo, come tutte le altre righe della configurazione.
 *
 * I servizi passano dalla stessa porta da cui passa «Chiama un servizio»
 * delle automazioni (`servizioPermesso`): fuori le serrature che si aprono,
 * l'antifurto che si disinserisce, i riavvii, il Supervisor, le shell. Poi,
 * sul filo, c'è comunque la dogana del ponte. L'unica eccezione è una
 * serratura che fra le porte ha già il suo PIN: quella si apre come si apre
 * dalle azioni rapide, col tastierino (`pin: true`). */
export const TIPO_INTERRUTTORE = "interruttore";

const SERVIZIO_SCRITTO = /^([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)$/;
const ENTITA_SCRITTA = /^[a-z_]+\.[a-z0-9_]+$/;
/* Le chiavi che puntano a qualcosa che non è un'entità: un'area, un piano,
 * un dispositivo. `homeassistant.turn_off` su un'area apre le serrature che
 * ci stanno dentro, e da qui non si vedrebbe. Si scrivono le entità. */
const BERSAGLI_LARGHI = ["target", "area_id", "device_id", "floor_id", "label_id"];
/* I domini che non si toccano senza chiedere: sono quelli che chiudono e
 * aprono la casa. */
const DELICATI = new Set(["lock", "alarm_control_panel"]);
const APRE_LA_SERRATURA = new Set(["lock.unlock", "lock.open"]);
const ENTITA_PER_TASTO = 10;

function datiScritti(valore) {
  if (valore && typeof valore === "object" && !Array.isArray(valore)) return { ...valore };
  const testo = pulito(valore);
  if (!testo) return {};
  try {
    const letto = JSON.parse(testo);
    return letto && typeof letto === "object" && !Array.isArray(letto) ? letto : null;
  } catch (_errore) {
    return null;
  }
}

function elencoEntita(valore) {
  const grezzo = Array.isArray(valore) ? valore : pulito(valore).split(/[\s,;]+/);
  return [...new Set(grezzo.map((uno) => pulito(uno).toLowerCase()).filter(Boolean))];
}

function parteDellInterruttore(dato, verso) {
  return {
    servizio: pulito(dato[`${verso}_servizio`] ?? dato[verso]?.servizio).toLowerCase(),
    entity: pulito(
      Array.isArray(dato[`${verso}_entity`])
        ? dato[`${verso}_entity`].join(", ")
        : (dato[`${verso}_entity`] ?? dato[verso]?.entity),
    ),
    dati: dato[`${verso}_dati`] ?? dato[verso]?.dati ?? "",
  };
}

/** Una voce, ripulita. Senza entità non è una voce — un interruttore sì, se sa cosa fare. */
export function normalizzaVoce(stored, indice = 0) {
  const dato = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  const entity = pulito(dato.entity);
  const voce = {
    id: pulito(dato.id) || `mia-${indice + 1}`,
    entity,
    nome: pulito(dato.nome || dato.name),
    icona: pulito(dato.icona || dato.icon),
    sezione: pulito(dato.sezione || dato.tab),
    room_id: pulito(dato.room_id || dato.room),
  };
  if (pulito(dato.tipo) !== TIPO_INTERRUTTORE) return voce;
  return {
    ...voce,
    tipo: TIPO_INTERRUTTORE,
    /* Un interruttore non va in una stanza: la stanza disegna l'entità con
     * la sua levetta, che chiamerebbe i servizi di quell'entità e non i
     * suoi. */
    room_id: "",
    acceso_se: pulito(dato.acceso_se) || "on",
    accendi: parteDellInterruttore(dato, "accendi"),
    spegni: parteDellInterruttore(dato, "spegni"),
  };
}

const eInterruttore = (voce) => voce?.tipo === TIPO_INTERRUTTORE;
const saCosaFare = (parte) => Boolean(parte?.servizio || parte?.entity);

/** Tutte le voci scritte, ripulite e senza quelle a metà. */
export function entitaMie(stored) {
  const righe = Array.isArray(stored) ? stored : [];
  return righe
    .map((riga, indice) => normalizzaVoce(riga, indice))
    .filter((riga) => (eInterruttore(riga) ? saCosaFare(riga.accendi) : riga.entity));
}

/**
 * Il servizio che una metà dell'interruttore chiede, già passato dai
 * controlli. Puro: si prova.
 *
 * Torna `{ok: true, domain, service, data, entita, conferma, pin}` oppure
 * `{ok: false, perche}`, con `perche` una parola fissa che chi disegna
 * traduce: `vuoto`, `servizio`, `chiuso`, `dati`, `bersaglio`, `entita`,
 * `serratura`.
 *
 * Senza servizio ma con un'entità, il verbo lo sa la plancia: uno script e
 * una scena si fanno partire, un'automazione si esegue (`trigger`, non
 * `turn_on`, che la riabiliterebbe e basta), un pulsante si preme, e il resto
 * si accende o si spegne secondo la metà.
 */
export function servizioDellInterruttore(parte, verso = "accendi") {
  const entita = elencoEntita(parte?.entity);
  let scritto = pulito(parte?.servizio).toLowerCase();
  if (!scritto && !entita.length) return { ok: false, perche: "vuoto" };
  if (entita.length > ENTITA_PER_TASTO || entita.some((id) => !ENTITA_SCRITTA.test(id)))
    return { ok: false, perche: "entita" };
  if (!scritto) {
    if (entita.length !== 1) return { ok: false, perche: "servizio" };
    const dominio = entita[0].split(".")[0];
    if (verso === "spegni") scritto = `${dominio}.turn_off`;
    else if (dominio === "automation") scritto = "automation.trigger";
    else if (dominio === "button" || dominio === "input_button") scritto = `${dominio}.press`;
    else scritto = `${dominio}.turn_on`;
  }
  const m = SERVIZIO_SCRITTO.exec(scritto);
  if (!m) return { ok: false, perche: "servizio" };
  const [, domain, service] = m;
  const dati = datiScritti(parte?.dati);
  if (dati === null) return { ok: false, perche: "dati" };
  if (BERSAGLI_LARGHI.some((chiave) => chiave in dati)) return { ok: false, perche: "bersaglio" };
  const nominate = elencoEntita(dati.entity_id);
  if (nominate.some((id) => !ENTITA_SCRITTA.test(id))) return { ok: false, perche: "entita" };
  const tutte = [...new Set([...entita, ...nominate])];
  if (tutte.length > ENTITA_PER_TASTO) return { ok: false, perche: "entita" };
  /* Una serratura o una centrale si comandano coi loro servizi, e basta:
   * `homeassistant.turn_off` su una serratura la apre, e la porta qui sotto
   * guarda il servizio, non l'entità. */
  if (tutte.some((id) => DELICATI.has(id.split(".")[0]) && id.split(".")[0] !== domain))
    return { ok: false, perche: "chiuso" };
  const nome = `${domain}.${service}`;
  const pin = APRE_LA_SERRATURA.has(nome);
  if (pin) {
    /* Un tastierino apre una porta: con due serrature dietro lo stesso tasto
     * non si saprebbe di quale PIN chiedere. */
    if (tutte.length !== 1) return { ok: false, perche: "serratura" };
  } else if (!servizioPermesso(nome)) return { ok: false, perche: "chiuso" };
  const data = { ...dati };
  delete data.entity_id;
  if (tutte.length) data.entity_id = tutte.length === 1 ? tutte[0] : tutte;
  return {
    ok: true,
    domain,
    service,
    data,
    entita: tutte,
    conferma: DELICATI.has(domain),
    pin,
  };
}

/* Gli stati che vogliono dire «acceso», scritti dall'utente: uno o più,
 * separati da virgola, senza badare alle maiuscole. */
function statiAccesi(scritto) {
  const elenco = pulito(scritto)
    .split(",")
    .map((uno) => pulito(uno).toLowerCase())
    .filter(Boolean);
  return elenco.length ? elenco : ["on"];
}

/**
 * Cosa dice un interruttore adesso, e cosa farebbe il tocco.
 *
 * `impulso` vuol dire che non legge niente: è un tasto, e ogni tocco fa
 * l'accensione. `muto` vale come per le entità: l'entità che dice lo stato
 * non risponde, ed è diverso da «spento».
 */
export function letturaDellInterruttore(voce, states = {}, resolve = (valore) => valore) {
  const entity = pulito(voce?.entity);
  let risolta = entity;
  try {
    risolta = entity ? pulito(resolve(entity)) || entity : "";
  } catch (_error) {
    risolta = entity;
  }
  const stato = entity ? states?.[risolta] || states?.[entity] || null : null;
  const grezzo = pulito(stato?.state);
  const impulso = !entity;
  const muto =
    !impulso && (!stato || grezzo === "" || grezzo === "unavailable" || grezzo === "unknown");
  const acceso = !impulso && !muto && statiAccesi(voce?.acceso_se).includes(grezzo.toLowerCase());
  const spegnimento = saCosaFare(voce?.spegni);
  return {
    id: pulito(voce?.id) || entity,
    tipo: TIPO_INTERRUTTORE,
    entity,
    /* Senza nome scritto, quello di Home Assistant: dell'entità che dice lo
     * stato, o di quella che l'accensione comanda. Senza nemmeno quello resta
     * vuoto, e la parola la mette chi disegna — un nome tecnico in pagina no. */
    nome:
      pulito(voce?.nome) ||
      pulito(stato?.attributes?.friendly_name) ||
      pulito(states?.[elencoEntita(voce?.accendi?.entity)[0]]?.attributes?.friendly_name),
    icona: pulito(voce?.icona),
    room_id: "",
    muto,
    impulso,
    stato: grezzo,
    numero: null,
    unita: "",
    acceso,
    comandabile: true,
    tendina: false,
    /* Il tocco: spegne solo se è acceso e lo spegnimento è scritto. Un
     * interruttore senza spegnimento è uno che si accende e basta — uno
     * script che si spegne da sé, una scena — e ogni tocco lo riaccende. */
    verso: acceso && spegnimento ? "spegni" : "accendi",
  };
}

/** La metà dell'interruttore che il tocco chiede adesso, coi suoi controlli. */
export function toccoDellInterruttore(voce, states = {}, resolve) {
  const lettura = letturaDellInterruttore(voce, states, resolve);
  return { lettura, ...servizioDellInterruttore(voce?.[lettura.verso], lettura.verso) };
}

/** Le voci di una sezione, nell'ordine in cui sono scritte e col tetto. */
export function entitaDellaSezione(stored, sezione) {
  const quale = pulito(sezione);
  if (!quale) return [];
  return entitaMie(stored)
    .filter((riga) => riga.sezione === quale)
    .slice(0, MASSIMO_PER_SEZIONE);
}

/** Le sezioni che hanno almeno una voce. */
export function sezioniConEntita(stored) {
  return [
    ...new Set(
      entitaMie(stored)
        .map((riga) => riga.sezione)
        .filter(Boolean),
    ),
  ];
}

/** Tutte le entità nominate, per chi si iscrive agli aggiornamenti. */
export function entitaDaGuardare(stored) {
  return [...new Set(entitaMie(stored).map((riga) => riga.entity))].filter(Boolean);
}

const numero = (valore) => {
  if (valore === null || valore === undefined || pulito(valore) === "") return null;
  const n = Number(valore);
  return Number.isFinite(n) ? n : null;
};

/**
 * Cosa dice una voce adesso.
 *
 * `muto` vuol dire che Home Assistant non la conosce o non risponde: è una
 * cosa diversa da «spento», e dirla spenta sarebbe inventare una lettura.
 */
export function letturaDellaVoce(voce, states = {}, resolve = (valore) => valore) {
  if (eInterruttore(voce)) return letturaDellInterruttore(voce, states, resolve);
  const entity = pulito(voce?.entity);
  let risolta = entity;
  try {
    risolta = pulito(resolve(entity)) || entity;
  } catch (_error) {
    risolta = entity;
  }
  const stato = states?.[risolta] || states?.[entity] || null;
  const grezzo = pulito(stato?.state);
  const muto = !stato || grezzo === "" || grezzo === "unavailable" || grezzo === "unknown";
  const dominio = entity.split(".")[0];
  return {
    id: voce?.id || entity,
    entity,
    nome: pulito(voce?.nome) || pulito(stato?.attributes?.friendly_name) || entity,
    icona: pulito(voce?.icona),
    room_id: pulito(voce?.room_id),
    muto,
    stato: grezzo,
    numero: muto ? null : numero(grezzo),
    unita: pulito(stato?.attributes?.unit_of_measurement),
    acceso:
      !muto &&
      ["on", "open", "home", "playing", "heat", "cool", "unlocked"].includes(grezzo.toLowerCase()),
    comandabile: COMANDABILI.has(dominio),
    /* E quello che non si accende, ma si sceglie: un `select`, un
     * `input_select`. Non e' comandabile nel senso della levetta — non ha due
     * stati — ma non e' neanche roba da guardare e basta: ha delle voci. Il
     * dominio lo riconosce `core/comandi-accanto.js`, che e' il padrone dei
     * generi in tutta la plancia. */
    tendina: siPuoScegliere(entity),
  };
}

/** Le letture di una sezione, pronte da disegnare. */
export function lettureDellaSezione(stored, sezione, states = {}, resolve) {
  return entitaDellaSezione(stored, sezione).map((voce) => letturaDellaVoce(voce, states, resolve));
}
