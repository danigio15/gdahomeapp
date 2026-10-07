/* La cottura (#71).
 *
 * «Mi piacerebbe pilotare la mia friggitrice ad aria della Philips.»
 *
 * Una friggitrice ad aria la si guarda per due cose — quando e' pronta, e a che
 * gradi sta andando — e la si tocca per altre tre: fermarla un attimo per
 * girare le patatine, darle un minuto in piu', spegnerla. La scheda di un
 * elettrodomestico non sapeva fare niente di tutto questo: un anello che dice
 * «rimanenti» e un interruttore che accende e spegne una presa.
 *
 * Qui c'e' il nucleo della voce «Cottura» degli Elettrodomestici. E' puro:
 * niente DOM, niente Home Assistant, niente parole da mostrare — quelle le
 * sceglie la sezione, nella lingua di chi guarda. Dice cinque cose:
 *
 *  1. quali apparecchi stanno in cucina (friggitrice, forno, microonde, piano
 *     cottura, cappa, tostapane) e quali di questi hanno un tempo da contare;
 *  2. in che fase e' una cottura, dalla parola che l'integrazione pubblica:
 *     in cottura, in pausa, preriscaldamento, da avviare, pronta, spenta;
 *  3. quanto manca e quando e' pronta, che il tempo arrivi in secondi, in
 *     minuti, in «hh:mm» o come l'ora di fine;
 *  4. quali comandi ci sono davvero — un comando si mostra solo se e'
 *     configurato e se la sua entita' risponde, come i tasti del telecomando
 *     della TV — e quale servizio chiama ciascuno;
 *  5. come compilare le caselle da solo, per la friggitrice Philips
 *     (`philips_airfryer` da HACS, o Philips HomeID) e per un forno qualunque.
 *
 * ── Le due integrazioni Philips ──────────────────────────────────────────────
 *
 * `philips_airfryer` (HACS) pubblica i sensori `…_status`, `…_temp`,
 * `…_total_time`, `…_time_remaining`, `…_drawer_open`, `…_dialog`, con i tempi
 * in SECONDI, e si comanda solo con i servizi: `philips_airfryer.pause`,
 * `start_resume`, `stop`, `adjust_time` (secondi, `method: add`) e
 * `adjust_temp` (gradi, `method: add|subtract`), tutti con l'`entity_id` di
 * una sua entita'. I suoi stati sono `standby`, `precook`, `cooking`, `pause`,
 * `finish`, `powersave`, `offline`.
 *
 * Philips HomeID pubblica invece i tasti — `button.…_pause`, `…_start`,
 * `…_stop` — e i numeri `number.…_set_temperature` e `number.…_cook_time`,
 * con i tempi in MINUTI e gli stati `standby`, `preheat`, `cooking`,
 * `keeping_warm`, `finished`.
 *
 * Le due strade stanno nella stessa casella: un comando e' un'entita'
 * (`button.*`, `switch.*`, `number.*`, `script.*`…) oppure un servizio con i
 * suoi parametri scritti accanto — `philips_airfryer.adjust_time time=60
 * method=add`. Chi ha un'altra friggitrice, o un forno con Home Connect, ci
 * scrive i suoi.
 */
import { canonicalArtworkType } from "./appliance-artwork.js";
import { parseDurationSeconds, parseTimestampMs } from "./appliance-card-view-model.js";
import { letturaDelloStato } from "./appliance-view-model.js";

const pulito = (valore) => String(valore ?? "").trim();
const minuscolo = (valore) => pulito(valore).toLowerCase();
const finito = (valore) => {
  if (valore === "" || valore == null) return null;
  const numero = Number(String(valore).replace(",", "."));
  return Number.isFinite(numero) ? numero : null;
};
const senzaSeparatori = (valore) => minuscolo(valore).replace(/[\s_\-.]+/g, "");
const MUTO = /^(unknown|unavailable|none|null|)$/i;

/* ── 1. la cucina ─────────────────────────────────────────────────────── */

/** I tipi di apparecchio che stanno in «Cottura», nell'ordine della pagina. */
export const TIPI_DELLA_CUCINA = Object.freeze([
  "air-fryer",
  "oven",
  "microwave",
  "cooktop",
  "hood",
  "toaster",
]);

/* Quelli che cuociono a tempo: sono loro ad avere la scheda grande, con
 * l'anello che si svuota. Il piano cottura e la cappa si accendono e si
 * spengono, e stanno fra «gli altri in cucina». */
const A_TEMPO = new Set(["air-fryer", "oven", "microwave"]);

/* In italiano la friggitrice e la cappa sono femminili, e «Pronta» o «Spenta»
 * dipende da loro: la sezione lo chiede qui invece di indovinarlo dal nome, che
 * lo scrive chi abita la casa. */
const FEMMINILI = new Set(["air-fryer", "hood"]);

/** Il tipo di cucina di un apparecchio, o "" se non sta in cucina. */
export function tipoDellaCucina(apparecchio = {}) {
  for (const indizio of [
    apparecchio.visual_key,
    apparecchio.device_type,
    apparecchio.icon,
    apparecchio.type,
  ]) {
    const tipo = canonicalArtworkType(indizio);
    if (tipo) return TIPI_DELLA_CUCINA.includes(tipo) ? tipo : "";
  }
  return "";
}

export const cuoceATempo = (tipo) => A_TEMPO.has(pulito(tipo));
export const eFemminile = (tipo) => FEMMINILI.has(pulito(tipo));

/* ── le caselle ───────────────────────────────────────────────────────── */

/* Le caselle della cottura, nella configurazione dell'elettrodomestico. Stanno
 * accanto alle altre e non al loro posto: lo stato, il tempo rimanente e la
 * durata una scheda li ha gia' (`state_entity`, `remaining_entity`,
 * `cycle_duration_entity`, `door_entity`), e una casella della cottura vuota
 * legge quella. Scriverla qui serve a chi vuole che la cottura guardi un
 * sensore diverso da quello che accende la scheda. */
export const LETTURE_DELLA_COTTURA = Object.freeze([
  "cottura_stato",
  "cottura_programma",
  "cottura_temperatura",
  "cottura_temperatura_voluta",
  "cottura_tempo_totale",
  "cottura_tempo_rimanente",
  "cottura_cassetto",
]);

/** I comandi della cottura, nell'ordine dei tasti. */
export const COMANDI_DELLA_COTTURA = Object.freeze([
  "pausa",
  "riprendi",
  "stop",
  "piu_un_minuto",
  "piu_caldo",
  "meno_caldo",
]);

export const casellaDelComando = (chiave) => `cottura_${chiave}`;

/* Il bersaglio dei servizi: l'entita' che si passa come `entity_id` a un
 * servizio che non ne scrive una sua. */
export const CASELLA_DEL_BERSAGLIO = "cottura_bersaglio";

export const CASELLE_DELLA_COTTURA = Object.freeze([
  ...LETTURE_DELLA_COTTURA,
  ...COMANDI_DELLA_COTTURA.map(casellaDelComando),
  CASELLA_DEL_BERSAGLIO,
]);

const RIPIEGHI = Object.freeze({
  cottura_stato: "state_entity",
  cottura_tempo_totale: "cycle_duration_entity",
  cottura_tempo_rimanente: "remaining_entity",
  cottura_cassetto: "door_entity",
});

/** L'entita' di una lettura della cottura, con il ripiego sulla casella di sempre. */
export function entitaDellaLettura(apparecchio = {}, casella) {
  const sua = pulito(apparecchio?.[casella]);
  if (sua) return sua;
  const ripiego = RIPIEGHI[casella];
  return ripiego ? pulito(apparecchio?.[ripiego]) : "";
}

/* ── 2. la fase ───────────────────────────────────────────────────────── */

/** Le fasi, dalla piu' viva alla piu' spenta. */
export const FASI = Object.freeze([
  "cottura",
  "preriscaldamento",
  "pausa",
  "attesa",
  "pronta",
  "spenta",
]);

/* Le parole, come le scrivono le integrazioni vere. Si confrontano senza
 * spazi, trattini e sottolineature, come fa il vocabolario dei cicli. */
const PAROLE = Object.freeze({
  cottura: [
    "cooking",
    "cook",
    "baking",
    "roasting",
    "grilling",
    "frying",
    "airfrying",
    "steaming",
    "running",
    "run",
    "inuse",
    "active",
    "incottura",
    "cottura",
    "infunzione",
  ],
  preriscaldamento: ["preheat", "preheating", "preriscaldamento", "preriscaldo", "heatingup"],
  pausa: ["pause", "paused", "pausa", "inpausa", "hold", "onhold", "suspended"],
  /* `precook` e' la friggitrice Philips pronta a partire: tempo e gradi
   * scelti, il tasto non ancora premuto. Non cuoce, e non e' spenta. */
  attesa: [
    "precook",
    "setting",
    "programmed",
    "delayedstart",
    "waitingtostart",
    "useraction",
    "readytostart",
    "daavviare",
    "programmato",
  ],
  /* «Keeping warm» e' la friggitrice che ha finito e tiene in caldo: per chi
   * aspetta, le patatine sono pronte. */
  pronta: [
    "finish",
    "finished",
    "done",
    "complete",
    "completed",
    "end",
    "ended",
    "programended",
    "keepingwarm",
    "keepwarm",
    "pronta",
    "pronto",
    "finito",
    "finita",
    "terminato",
  ],
  spenta: [
    "standby",
    "off",
    "idle",
    "powersave",
    "offline",
    "sleep",
    "mainmenu",
    "inactive",
    "spenta",
    "spento",
    "ready",
  ],
});

const DIZIONARIO = new Map(
  Object.entries(PAROLE).flatMap(([fase, parole]) =>
    parole.map((parola) => [senzaSeparatori(parola), fase]),
  ),
);

/**
 * La fase detta da una parola di stato, o "" se la parola non si conosce.
 *
 * Per una parola che la cottura non conosce si chiede al vocabolario dei cicli,
 * che ne conosce molte di piu': cio' che lavora cuoce, cio' che aspetta e'
 * in pausa, cio' che e' fermo e' spento.
 */
export function faseDallaParola(parola) {
  const detta = senzaSeparatori(parola);
  if (!detta) return "";
  const ultimo = senzaSeparatori(pulito(parola).split(".").pop());
  const diretta = DIZIONARIO.get(detta) || DIZIONARIO.get(ultimo);
  if (diretta) return diretta;
  const ciclo = letturaDelloStato(parola);
  if (ciclo === "running") return "cottura";
  if (ciclo === "standby") return "pausa";
  if (ciclo === "off") return "spenta";
  return "";
}

/** Le fasi in cui c'e' qualcosa sul fuoco. */
export const faseViva = (fase) => ["cottura", "preriscaldamento", "pausa", "attesa"].includes(fase);

/* ── 3. il tempo ──────────────────────────────────────────────────────── */

const eUnOrario = (grezzo, classe) =>
  classe === "timestamp" || /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(grezzo);

/**
 * I secondi che mancano, da una lettura di Home Assistant.
 *
 * Tre forme: un numero con la sua unita' (secondi, minuti, ore — senza unita'
 * sono minuti, come per il resto delle schede), «hh:mm:ss» o «hh:mm», oppure
 * l'ora in cui finisce. Se la cottura sta andando, un numero letto qualche
 * secondo fa si fa scorrere fino ad adesso: un sensore che si aggiorna ogni
 * mezzo minuto altrimenti farebbe un anello a scatti. Fermo in pausa, fermo.
 */
export function secondiRimasti(lettura, adesso = Date.now(), { scorre = false } = {}) {
  const grezzo = pulito(lettura?.state);
  if (MUTO.test(grezzo)) return null;
  const attributi = lettura?.attributes || {};
  const classe = minuscolo(attributi.device_class);
  if (eUnOrario(grezzo, classe)) {
    const fine = parseTimestampMs(grezzo);
    return fine == null ? null : Math.max(0, Math.round((fine - adesso) / 1000));
  }
  const secondi = parseDurationSeconds(grezzo, pulito(attributi.unit_of_measurement));
  if (secondi == null) return null;
  if (!scorre) return secondi;
  const letto = Date.parse(lettura?.last_updated || lettura?.last_changed || "");
  if (!Number.isFinite(letto) || letto > adesso) return secondi;
  /* Non oltre dieci minuti: un sensore fermo da piu' di cosi' non e' un
   * conto alla rovescia, e' un'integrazione che ha smesso di parlare. */
  const passati = Math.min(600, Math.floor((adesso - letto) / 1000));
  return Math.max(0, secondi - passati);
}

/** I secondi di tutta la cottura, da una durata o da un numero. */
export function secondiTotali(lettura) {
  const grezzo = pulito(lettura?.state);
  if (MUTO.test(grezzo)) return null;
  const secondi = parseDurationSeconds(grezzo, pulito(lettura?.attributes?.unit_of_measurement));
  return secondi && secondi > 0 ? secondi : null;
}

/** «14:41», l'ora di un istante, sulle ventiquattro ore. */
export function orologio(ms) {
  const quando = new Date(ms);
  if (!Number.isFinite(quando.getTime())) return "";
  return `${String(quando.getHours()).padStart(2, "0")}:${String(quando.getMinutes()).padStart(2, "0")}`;
}

/** «7:32» sotto l'ora, «1:05:00» sopra. */
export function minutiESecondi(secondi) {
  const tutti = Math.max(0, Math.round(Number(secondi) || 0));
  const ore = Math.floor(tutti / 3600);
  const minuti = Math.floor((tutti % 3600) / 60);
  const resto = String(tutti % 60).padStart(2, "0");
  return ore ? `${ore}:${String(minuti).padStart(2, "0")}:${resto}` : `${minuti}:${resto}`;
}

/** I minuti che mancano, per le frasi: arrotondati in su, mai «fra 0 min». */
export const minutiCheMancano = (secondi) => Math.max(1, Math.ceil((Number(secondi) || 0) / 60));

/* ── la temperatura, il programma, il cassetto ────────────────────────── */

function gradiDi(lettura) {
  const valore = finito(lettura?.state);
  if (valore == null) return null;
  const unita = pulito(lettura?.attributes?.unit_of_measurement) || "°C";
  return { valore, unita: /f/i.test(unita) ? "°F" : "°C" };
}

/* Il programma com'e' scritto in Home Assistant, reso leggibile: le
 * integrazioni pubblicano spesso la chiave — `french_fries`, `0` — e non il
 * nome. Una chiave che e' solo un numero non dice niente, e non si mostra. */
export function programmaLeggibile(valore) {
  const grezzo = pulito(valore);
  if (MUTO.test(grezzo) || /^[-\d.]+$/.test(grezzo)) return "";
  if (/^(false|true|no|off|nessuno|nessuna|manual|manuale)$/i.test(grezzo)) return "";
  const parole = grezzo.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
  return parole.charAt(0).toUpperCase() + parole.slice(1);
}

/** Il cassetto (o la porta): `true` aperto, `false` chiuso, `null` non si sa. */
export function cassettoAperto(lettura) {
  const grezzo = minuscolo(lettura?.state);
  if (MUTO.test(grezzo)) return null;
  if (/^(on|open|opened|true|aperto|aperta|1)$/.test(grezzo)) return true;
  if (/^(off|closed|close|false|chiuso|chiusa|0)$/.test(grezzo)) return false;
  return null;
}

/* ── 4. i comandi ─────────────────────────────────────────────────────── */

/* I domini che si premono, e come. Un `number` non si preme: si sposta di un
 * passo, e il passo lo decide chi lo chiede — un minuto, cinque gradi. */
const COME_SI_PREME = Object.freeze({
  button: ["button", "press"],
  input_button: ["input_button", "press"],
  switch: ["switch", "toggle"],
  input_boolean: ["input_boolean", "toggle"],
  script: ["script", "turn_on"],
  scene: ["scene", "turn_on"],
  automation: ["automation", "trigger"],
});
const NUMERI = new Set(["number", "input_number"]);

const eUnEntita = (testo) => /^[a-z][a-z0-9_]*\.[a-z0-9_]+$/.test(testo);

function valoreDelParametro(grezzo) {
  const testo = pulito(grezzo);
  if (/^(true|false)$/i.test(testo)) return testo.toLowerCase() === "true";
  const numero = finito(testo);
  if (numero != null && /^-?\d+([.,]\d+)?$/.test(testo)) return numero;
  return testo;
}

/**
 * Cosa c'e' scritto in una casella di comando.
 *
 * `{ tipo: "entita", entita, dominio }` per un'entita' comandabile;
 * `{ tipo: "servizio", dominio, servizio, dati }` per un servizio, con i suoi
 * parametri `chiave=valore` scritti dopo; `null` per tutto il resto. Un
 * servizio si riconosce dalla forma e dal fatto che non e' un'entita' della
 * casa: `script.turn_on` e' un servizio, `script.cena_pronta` un'entita'.
 */
export function leggiIlComando(testo, states = {}) {
  const pezzi = pulito(testo).split(/\s+/).filter(Boolean);
  const primo = pezzi[0] || "";
  if (!eUnEntita(primo)) return null;
  const [dominio, nome] = primo.split(".");
  const siPreme = Boolean(COME_SI_PREME[dominio] || NUMERI.has(dominio));
  if (pezzi.length === 1 && siPreme) {
    /* `script.turn_on` da solo e' un servizio; `script.cena_pronta` e'
     * l'entita' di uno script. Nel dubbio decide la casa: se l'entita' c'e',
     * e' un'entita'. */
    const verbo = /^(turn_on|turn_off|toggle|press|trigger|set_value|reload)$/.test(nome);
    if (states?.[primo] || !verbo) return { tipo: "entita", entita: primo, dominio };
  }
  const dati = {};
  for (const pezzo of pezzi.slice(1)) {
    const uguale = pezzo.indexOf("=");
    if (uguale <= 0) return null;
    dati[pezzo.slice(0, uguale)] = valoreDelParametro(pezzo.slice(uguale + 1));
  }
  return { tipo: "servizio", dominio, servizio: nome, dati };
}

/* Il passo di un numero: un minuto in secondi o in minuti, secondo l'unita';
 * cinque gradi se il numero non ne dichiara uno suo. */
function passoDelNumero(chiave, lettura) {
  const attributi = lettura?.attributes || {};
  if (chiave === "piu_un_minuto") {
    const unita = minuscolo(attributi.unit_of_measurement);
    if (/^(s|sec|secs|seconds?)$/.test(unita)) return 60;
    if (/^(h|hr|hours?)$/.test(unita)) return 1 / 60;
    return 1;
  }
  const dichiarato = finito(attributi.step);
  const passo = dichiarato && dichiarato >= 1 ? dichiarato : 5;
  return chiave === "meno_caldo" ? -passo : passo;
}

/* Un comando che non puo' rispondere non si mostra. Un tasto di Home
 * Assistant dice «unknown» finche' nessuno l'ha mai premuto, e va bene lo
 * stesso: solo «unavailable», o l'entita' che non c'e', lo spengono. */
function risponde(entita, states) {
  const stato = states?.[entita];
  return Boolean(stato) && minuscolo(stato.state) !== "unavailable";
}

/**
 * L'azione di un comando: `{ dominio, servizio, dati }`, pronta per Home
 * Assistant, o `null` se il comando non c'e' o non puo' rispondere.
 */
export function azioneDelComando(testo, chiave, { states = {}, bersaglio = "" } = {}) {
  const comando = leggiIlComando(testo, states);
  if (!comando) return null;
  if (comando.tipo === "servizio") {
    const dati = { ...comando.dati };
    if (!("entity_id" in dati) && !("device_id" in dati) && pulito(bersaglio))
      dati.entity_id = pulito(bersaglio);
    return { dominio: comando.dominio, servizio: comando.servizio, dati };
  }
  if (!risponde(comando.entita, states)) return null;
  if (NUMERI.has(comando.dominio)) {
    if (!["piu_un_minuto", "piu_caldo", "meno_caldo"].includes(chiave)) return null;
    const lettura = states[comando.entita];
    const adesso = finito(lettura?.state);
    if (adesso == null) return null;
    const attributi = lettura?.attributes || {};
    let valore = adesso + passoDelNumero(chiave, lettura);
    const minimo = finito(attributi.min);
    const massimo = finito(attributi.max);
    if (minimo != null) valore = Math.max(minimo, valore);
    if (massimo != null) valore = Math.min(massimo, valore);
    if (valore === adesso) return null;
    return {
      dominio: comando.dominio,
      servizio: "set_value",
      dati: { entity_id: comando.entita, value: Math.round(valore * 100) / 100 },
    };
  }
  const [dominio, servizio] = COME_SI_PREME[comando.dominio] || [];
  if (!dominio) return null;
  return { dominio, servizio, dati: { entity_id: comando.entita } };
}

/* In quali fasi un tasto ha senso. Fuori dalla sua fase non si disegna: la
 * pausa di una friggitrice spenta e' un tasto che non fa niente. */
const FASI_DEL_COMANDO = Object.freeze({
  pausa: ["cottura", "preriscaldamento"],
  riprendi: ["pausa", "attesa"],
  stop: ["cottura", "preriscaldamento", "pausa", "attesa"],
  piu_un_minuto: ["cottura", "preriscaldamento", "pausa", "attesa"],
  piu_caldo: ["cottura", "preriscaldamento", "pausa", "attesa"],
  meno_caldo: ["cottura", "preriscaldamento", "pausa", "attesa"],
});

/**
 * I comandi che la scheda disegna adesso, con la loro azione.
 *
 * Un comando c'e' se e' scritto nella sua casella E se la fase lo vuole. Due
 * ripieghi soltanto, e tutti e due senza indovinare niente:
 *  - «Riprendi» senza casella sua usa la pausa, se la pausa e' un
 *    interruttore — che si inverte, quindi fa tutte e due le cose;
 *  - «+» e «−» della temperatura, senza casella loro, spostano il numero della
 *    temperatura voluta, se quello e' un `number` o un `input_number`.
 */
export function comandiDellaCottura(apparecchio = {}, states = {}, fase = "spenta") {
  const bersaglio =
    pulito(apparecchio[CASELLA_DEL_BERSAGLIO]) || entitaDellaLettura(apparecchio, "cottura_stato");
  const voluta = pulito(apparecchio.cottura_temperatura_voluta);
  const comandi = {};
  for (const chiave of COMANDI_DELLA_COTTURA) {
    if (!FASI_DEL_COMANDO[chiave].includes(fase)) continue;
    let testo = pulito(apparecchio[casellaDelComando(chiave)]);
    if (!testo && chiave === "riprendi") {
      const pausa = pulito(apparecchio.cottura_pausa);
      if (/^(switch|input_boolean)\./.test(pausa)) testo = pausa;
    }
    if (
      !testo &&
      (chiave === "piu_caldo" || chiave === "meno_caldo") &&
      /^(number|input_number)\./.test(voluta)
    )
      testo = voluta;
    if (!testo) continue;
    const azione = azioneDelComando(testo, chiave, { states, bersaglio });
    if (azione) comandi[chiave] = azione;
  }
  return comandi;
}

/* ── la lettura di una cottura ────────────────────────────────────────── */

/* Quanto resta «Pronta» dopo la fine, quando l'integrazione torna subito in
 * standby. E' anche quanto resta accesa la tessera in Home dopo la fine: poi
 * le patatine sono state mangiate, o sono fredde. */
export const PRONTA_PER_MS = 20 * 60 * 1000;

/**
 * Un passo della memoria di una cottura.
 *
 * Una friggitrice che finisce non sempre dice «finito»: quella con HomeID
 * torna in standby, e dire «spenta» a chi aspetta le patatine sarebbe dire
 * che non e' successo niente. Quindi si ricorda: una cottura che stava
 * andando e adesso e' spenta — col tempo che era arrivato alla fine, o quasi
 * — e' pronta, per `PRONTA_PER_MS`. Uno stop premuto a meta' non e' una fine:
 * il tempo che mancava era ancora tanto.
 *
 * `appenaFinita` e' vero soltanto nel passo in cui la cottura finisce: e' quello
 * che accende l'avviso, una volta sola.
 */
export function passoDellaFine(
  prima,
  { fase, rimasti = null, adesso = Date.now(), cambiatoIl = null } = {},
) {
  const eraViva = Boolean(prima) && faseViva(prima.fase);
  const quasiFinita = prima?.rimasti == null || prima.rimasti <= 90;
  let fineAt = prima?.fineAt ?? null;
  let finita = false;
  if (fase === "pronta") {
    if (!prima || prima.fase !== "pronta") {
      fineAt = eraViva ? adesso : Number.isFinite(cambiatoIl) ? cambiatoIl : adesso;
      finita = eraViva;
    }
  } else if (fase === "spenta" && eraViva && prima.fase !== "attesa" && quasiFinita) {
    fineAt = adesso;
    finita = true;
  } else if (faseViva(fase)) {
    fineAt = null;
  }
  const dentro = fineAt != null && adesso - fineAt < PRONTA_PER_MS;
  const pronta = fase === "pronta" || (fase === "spenta" && dentro);
  return {
    memoria: {
      fase: pronta ? "pronta" : fase,
      rimasti: faseViva(fase) ? rimasti : null,
      fineAt,
    },
    pronta,
    /* La tessera in Home si accende per la fine solo finche' e' fresca: una
     * friggitrice che dice «finish» da stamattina non e' una notizia. */
    fresca: pronta && dentro,
    appenaFinita: finita,
  };
}

/**
 * Tutto quello che la pagina e la tessera sanno di una cottura.
 *
 * `modo` e' quello che la scheda dell'elettrodomestico ha gia' deciso dai watt
 * o dall'interruttore (`running`, `standby`, `off`): serve a chi uno stato
 * suo non ce l'ha, come un forno su una presa.
 */
export function letturaDellaCottura(
  apparecchio = {},
  states = {},
  { adesso = Date.now(), modo = "", memoria = null } = {},
) {
  const tipo = tipoDellaCucina(apparecchio);
  const leggi = (casella) => {
    const entita = entitaDellaLettura(apparecchio, casella);
    return entita ? states?.[entita] || null : null;
  };
  const stato = leggi("cottura_stato");
  let fase = stato ? faseDallaParola(stato.state) : "";
  const muta = !stato || MUTO.test(pulito(stato?.state));
  /* Senza una parola sua, parla la scheda: acceso dai watt o
   * dall'interruttore. Un piano cottura acceso senza watt e' «acceso ma
   * fermo» per la scheda, e per chi cucina e' acceso e basta. */
  if (!fase)
    fase = modo === "running" || (modo === "standby" && !cuoceATempo(tipo)) ? "cottura" : "spenta";
  const scorre = fase === "cottura" || fase === "preriscaldamento";
  let rimasti = secondiRimasti(leggi("cottura_tempo_rimanente"), adesso, { scorre });
  let totali = secondiTotali(leggi("cottura_tempo_totale"));
  if (!faseViva(fase)) rimasti = null;
  if (rimasti != null && totali != null && totali < rimasti) totali = null;
  const passo = passoDellaFine(memoria, {
    fase,
    rimasti,
    adesso,
    cambiatoIl: Date.parse(stato?.last_changed || "") || null,
  });
  if (passo.pronta) fase = "pronta";
  const temperatura = gradiDi(leggi("cottura_temperatura"));
  const voluta = gradiDi(leggi("cottura_temperatura_voluta"));
  const cassetto = cassettoAperto(leggi("cottura_cassetto"));
  const frazione = rimasti != null && totali ? Math.max(0, Math.min(1, rimasti / totali)) : null;
  return {
    id: pulito(apparecchio.id),
    tipo,
    aTempo: cuoceATempo(tipo),
    femminile: eFemminile(tipo),
    fase,
    viva: faseViva(fase),
    muta,
    rimasti,
    totali,
    frazione,
    prontaAlle:
      fase === "cottura" || fase === "preriscaldamento"
        ? rimasti != null
          ? adesso + rimasti * 1000
          : null
        : null,
    avviataAlle:
      rimasti != null && totali != null && faseViva(fase) && fase !== "attesa"
        ? adesso + (rimasti - totali) * 1000
        : null,
    finitaAlle: fase === "pronta" ? passo.memoria.fineAt : null,
    programma: programmaLeggibile(leggi("cottura_programma")?.state),
    /* La temperatura grande e' quella scelta; quella misurata va sotto,
     * quando c'e' e dice un'altra cosa. */
    gradi: voluta || temperatura,
    dentro:
      voluta && temperatura && Math.round(voluta.valore) !== Math.round(temperatura.valore)
        ? temperatura
        : null,
    cassetto,
    haCassetto: Boolean(entitaDellaLettura(apparecchio, "cottura_cassetto")),
    comandi: comandiDellaCottura(apparecchio, states, fase === "pronta" ? "spenta" : fase),
    memoria: passo.memoria,
    appenaFinita: passo.appenaFinita,
    fresca: passo.fresca,
  };
}

/* ── la cucina intera ─────────────────────────────────────────────────── */

const RANGO = Object.freeze({
  cottura: 0,
  preriscaldamento: 1,
  pausa: 2,
  attesa: 3,
  pronta: 4,
  spenta: 5,
});

/**
 * Chi va in scheda grande e chi fra «gli altri in cucina».
 *
 * `voci` sono le letture, ognuna con il suo apparecchio. In scheda grande va
 * ogni apparecchio a tempo che ha qualcosa da dire — sul fuoco, in pausa,
 * pronto — e, se nessuno ne ha, il primo apparecchio a tempo che uno stato ce
 * l'ha: la friggitrice spenta resta dov'e', coi suoi comandi pronti per
 * quando si accende. Tutti gli altri vanno in fila sotto.
 */
export function laCucina(voci = []) {
  const aTempo = voci.filter((voce) => voce.lettura.aTempo);
  let grandi = aTempo.filter((voce) => voce.lettura.fase !== "spenta");
  if (!grandi.length) {
    const primo = aTempo.find((voce) => !voce.lettura.muta) || aTempo[0];
    grandi = primo ? [primo] : [];
  }
  grandi = [...grandi].sort(
    (a, b) =>
      RANGO[a.lettura.fase] - RANGO[b.lettura.fase] ||
      (a.lettura.rimasti ?? Infinity) - (b.lettura.rimasti ?? Infinity),
  );
  const scelti = new Set(grandi);
  const altri = voci.filter((voce) => !scelti.has(voce));
  const vive = voci.filter((voce) => voce.lettura.fase !== "spenta");
  return {
    grandi,
    altri,
    /* La prima e' quella di cui parla la risposta grande in cima. */
    prima: grandi.find((voce) => voce.lettura.fase !== "spenta") || null,
    vive: vive.length,
  };
}

/* ── 5. le caselle che si compilano da sole ───────────────────────────── */

const indizi = (voce, states) => {
  const id = pulito(voce?.entity_id ?? voce);
  const nome = pulito(voce?.name) || pulito(states?.[id]?.attributes?.friendly_name);
  return ` ${`${id.split(".").slice(1).join(".")} ${nome} ${pulito(voce?.translation_key)}`
    .toLowerCase()
    .replace(/[_\-./]+/g, " ")} `;
};
const dominioDi = (id) => pulito(id).split(".")[0];
const unitaDi = (voce, states) =>
  minuscolo(voce?.unit) ||
  minuscolo(states?.[pulito(voce?.entity_id ?? voce)]?.attributes?.unit_of_measurement);
const classeDi = (voce, states) =>
  minuscolo(voce?.device_class) ||
  minuscolo(states?.[pulito(voce?.entity_id ?? voce)]?.attributes?.device_class);

/* Una riga per casella: quali domini, e il punteggio dal nome. */
const PROPOSTE = Object.freeze([
  {
    casella: "cottura_stato",
    domini: ["sensor"],
    punti: (c) =>
      /\b(cooking status|machine status|operation state|status|stato)\b/.test(c) &&
      !/\b(previous|precedente|preheat|probe|error|firmware)\b/.test(c)
        ? /\bcooking status\b/.test(c)
          ? 10
          : 6
        : null,
  },
  {
    casella: "cottura_programma",
    domini: ["sensor", "select"],
    punti: (c) => {
      if (/\b(id|step|stage|autocook|my presets)\b/.test(c)) return null;
      if (/\b(recipe|preset|ricetta|programma|program|cooking method)\b/.test(c)) return 8;
      return /\bdialog\b/.test(c) ? 4 : null;
    },
  },
  {
    casella: "cottura_temperatura",
    domini: ["sensor"],
    punti: (c, voce, states) => {
      const gradi =
        classeDi(voce, states) === "temperature" ||
        /°/.test(unitaDi(voce, states)) ||
        /\btemp\b/.test(c);
      if (!gradi || /\b(probe|sonda|target|set|desired|voluta|keep warm)\b/.test(c)) return null;
      return /\b(current|attuale)\b/.test(c) ? 9 : 6;
    },
  },
  {
    casella: "cottura_temperatura_voluta",
    domini: ["number", "input_number"],
    punti: (c) =>
      /\b(temp|temperature|temperatura)\b/.test(c) && !/\b(probe|sonda|keep warm)\b/.test(c)
        ? 9
        : null,
  },
  {
    casella: "cottura_tempo_totale",
    domini: ["sensor"],
    punti: (c) =>
      /\b(total time|total cook time|cook time|cooking time|durata|tempo totale)\b/.test(c) &&
      !/\b(remaining|rimanente|keep warm)\b/.test(c)
        ? 8
        : null,
  },
  {
    casella: "cottura_tempo_rimanente",
    domini: ["sensor"],
    punti: (c) =>
      /\b(time remaining|remaining|rimanente|time left|tempo rimanente|end time|fine)\b/.test(c)
        ? 9
        : null,
  },
  {
    casella: "cottura_cassetto",
    domini: ["binary_sensor", "sensor"],
    punti: (c) => (/\b(drawer|cassetto|door|porta)\b/.test(c) ? 8 : null),
  },
  {
    casella: "cottura_pausa",
    domini: ["button", "input_button"],
    punti: (c) => (/\b(pause|pausa)\b/.test(c) ? 9 : null),
  },
  {
    casella: "cottura_riprendi",
    domini: ["button", "input_button"],
    punti: (c) => (/\b(resume|riprendi|start|avvia)\b/.test(c) && !/\b(stop)\b/.test(c) ? 7 : null),
  },
  {
    casella: "cottura_stop",
    domini: ["button", "input_button"],
    punti: (c) => (/\b(stop|ferma|cancel|annulla)\b/.test(c) ? 9 : null),
  },
  {
    /* Il tempo di cottura come numero (HomeID, in minuti): «+1 min» lo sposta
     * di un minuto. */
    casella: "cottura_piu_un_minuto",
    domini: ["number", "input_number"],
    punti: (c) =>
      /\b(cook time|cooking time|total time|tempo|durata)\b/.test(c) && !/\b(keep warm)\b/.test(c)
        ? 8
        : null,
  },
]);

/* I servizi della friggitrice Philips da HACS: i tasti non li pubblica, e si
 * comanda soltanto cosi'. Il passo della temperatura e' di cinque gradi, come
 * i tasti della friggitrice. */
export const SERVIZI_PHILIPS_AIRFRYER = Object.freeze({
  cottura_pausa: "philips_airfryer.pause",
  cottura_riprendi: "philips_airfryer.start_resume",
  cottura_stop: "philips_airfryer.stop",
  cottura_piu_un_minuto: "philips_airfryer.adjust_time time=60 method=add",
  cottura_piu_caldo: "philips_airfryer.adjust_temp temp=5 method=add",
  cottura_meno_caldo: "philips_airfryer.adjust_temp temp=5 method=subtract",
});

/**
 * Le caselle della cottura proposte dalle entita' di un dispositivo.
 *
 * `entita` sono i record del catalogo dei dispositivi (`entity_id`, `name`,
 * `unit`, `device_class`…) oppure semplici id. `integrazione` e' il dominio
 * dell'integrazione, quando si sa: con `philips_airfryer` i comandi sono i
 * suoi servizi, col bersaglio sul sensore di stato. Torna solo le caselle che
 * ha saputo riempire: chi chiama scrive quelle vuote e lascia le altre.
 */
export function proponiLaCottura(entita = [], states = {}, { integrazione = "" } = {}) {
  const voci = (Array.isArray(entita) ? entita : [])
    .filter((voce) => pulito(voce?.entity_id ?? voce).includes("."))
    .filter((voce) => !voce?.disabled);
  const prese = new Set();
  const proposta = {};
  for (const regola of PROPOSTE) {
    let meglio = null;
    for (const voce of voci) {
      const id = pulito(voce?.entity_id ?? voce);
      if (prese.has(id) || !regola.domini.includes(dominioDi(id))) continue;
      const punti = regola.punti(indizi(voce, states), voce, states);
      if (punti == null || punti <= 0) continue;
      if (
        !meglio ||
        punti > meglio.punti ||
        (punti === meglio.punti && id.length < meglio.id.length)
      )
        meglio = { id, punti };
    }
    if (!meglio) continue;
    prese.add(meglio.id);
    proposta[regola.casella] = meglio.id;
  }
  const philips =
    minuscolo(integrazione) === "philips_airfryer" ||
    voci.some((voce) => /^[a-z_]+\.philips_airfryer_/.test(pulito(voce?.entity_id ?? voce)));
  if (philips) {
    for (const [casella, servizio] of Object.entries(SERVIZI_PHILIPS_AIRFRYER))
      if (!proposta[casella]) proposta[casella] = servizio;
    if (proposta.cottura_stato) proposta[CASELLA_DEL_BERSAGLIO] = proposta.cottura_stato;
  }
  return proposta;
}
