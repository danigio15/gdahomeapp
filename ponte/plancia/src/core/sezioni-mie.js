/* Le sezioni che si fa l'utente (#262).
 *
 * «Dare la possibilità di creare sezioni custom, dove poter inserire le
 * proprie entità a piacimento. Per esempio avrei potuto inserire le entità
 * dell'UPS senza attendere lo sviluppo della sezione apposita.»
 *
 * L'esempio dice tutto: fra il momento in cui uno ha in casa una cosa e il
 * momento in cui questa plancia impara a disegnarla passa del tempo, e in
 * quel tempo le sue entità non hanno un posto. Una sezione fatta a mano non
 * sostituisce quella disegnata — non sa cos'e' un gruppo di continuita', non
 * gli fa il grafico della carica — ma sa fare l'unica cosa che serve subito:
 * mettere insieme delle entita' sotto un titolo, dire come stanno, e
 * accenderle se si accendono.
 *
 * Questo modulo e' la parte pura: la forma di una sezione, la sua lettura
 * dagli stati di Home Assistant, e la chiave con cui la sua voce si spegne.
 * Le parole per dirlo a schermo stanno nelle sezioni, che e' dove il
 * raccoglitore delle traduzioni guarda.
 */

import { siPuoAbilitare, siPuoScegliere } from "./comandi-accanto.js";
import { getLocale, intlLocale, pick } from "./i18n.js";
import { STATI_ACCESI } from "./stato-acceso.js";

const pulito = (valore) => String(valore ?? "").trim();

/* Un limite alla barra, non alla fantasia. Otto sezioni proprie stanno in una
 * barra insieme alle sedici del guscio; la trentesima non si vedrebbe piu' e
 * il problema sarebbe piu' difficile da capire che da evitare. */
export const MASSIMO_SEZIONI = 8;

/* La casella del magazzino in cui vivono. Sta qui e non nella sezione perche'
 * a leggerla sono in due: la pagina che le disegna e la tessera che le porta in
 * Home. */
export const CHIAVE_SEZIONI_MIE = "cd_sezioni_mie";

/* Il prefisso che marca tutto quello che appartiene a una sezione propria: la
 * voce nella barra, la pagina, la tessera in Home. Sta scritto in un posto
 * solo perche' a riconoscerlo sono in piu' di uno, e una chiave costruita qui
 * e riconosciuta altrove a colpi di `startsWith` scritti a mano e' il modo in
 * cui i due si allontanano senza che nessuno se ne accorga. */
const PREFISSO = "mia-";

/* Come si dispongono le voci in pagina.
 *
 * «Si potrebbe poter scegliere il tipo di scheda? Magari averle piu' piccole»
 * (#515). Una riga a tutta larghezza per un interruttore che dice acceso o
 * spento e' una riga sprecata: chi ne ha dodici ne vede tre per schermata, e
 * per le altre nove scorre.
 *
 * Due formati e non cinque. A RIGHE e' quello di sempre — icona, nome, valore
 * e leva in fila, tutta la larghezza — e resta il difetto, perche' e' quello
 * che tutti hanno adesso e nessuno deve ritrovarsi la pagina cambiata senza
 * averlo chiesto. PICCOLE mette la stessa voce in una tessera, e le tessere
 * vanno a capo: la stessa roba, tre o quattro per riga. Un terzo modo nessuno
 * l'ha chiesto, e un terzo modo e' una scelta in piu' da fare per tutti. */
export const FORMATI_SEZIONE = Object.freeze(["righe", "piccole"]);

/** Il formato di una sezione, ripulito: quello di sempre se non si capisce. */
export function formatoDellaSezione(valore) {
  const detto = pulito(valore);
  return FORMATI_SEZIONE.includes(detto) ? detto : FORMATI_SEZIONE[0];
}

/** La chiave con cui la voce di una sezione si accende e si spegne. */
export const chiaveDellaSezione = (id) => `${PREFISSO}${pulito(id)}`;

/** Se questa chiave e' di una sezione che si e' fatto chi ha la casa. */
export const eUnaSezioneMia = (chiave) => pulito(chiave).startsWith(PREFISSO);

/* Gli stati che significano «non lo so», e che non vanno mostrati come se
 * fossero una lettura. */
const MUTI = new Set(["unavailable", "unknown", "none", ""]);

/* I domini che si accendono e si spengono con un tocco. Fuori da qui una
 * riga si legge e basta: chiamare `toggle` su un sensore non fa niente, e un
 * interruttore che non fa niente e' peggio di nessun interruttore. */
const COMANDABILI = new Set([
  "switch",
  "light",
  "fan",
  "input_boolean",
  "automation",
  "script",
  "scene",
  "siren",
  "humidifier",
]);

/* Gli stati che valgono «acceso» stanno in `core/stato-acceso.js`: la stessa
 * domanda la fanno anche le stanze in plancia, e due elenchi della stessa cosa
 * diventano due elenchi diversi al primo dominio nuovo. */

/* ── gli attributi (#256) ─────────────────────────────────────────────────
 *
 * «Nelle sezioni personalizzate non si vedono gli attributi.» Un sensore della
 * scuola dice la media nello stato, e il resto — l'ultimo voto, la materia, il
 * giorno — lo porta negli attributi: chi se l'e' messo in una sezione sua
 * vedeva un nome e basta. Adesso ogni voce dice quali attributi mostrare, con
 * che nome, e la sezione li mette sotto lo stato.
 *
 * Gli attributi tecnici non si offrono nemmeno: sono il modo in cui Home
 * Assistant disegna l'entita' — il nome, l'icona, l'unita', la classe — e non
 * qualcosa che l'entita' ha da dire. Mostrarli sarebbe chiedere a chi compila
 * di riconoscerli e scartarli uno per uno, a ogni voce. */
export const ATTRIBUTI_TECNICI = Object.freeze(
  new Set([
    "friendly_name",
    "icon",
    "unit_of_measurement",
    "device_class",
    "state_class",
    "attribution",
    "entity_picture",
    "supported_features",
    "supported_color_modes",
    "assumed_state",
    "restored",
    "editable",
  ]),
);

/* Quante voci di una lista si leggono prima del «e altri N»: una lista di
 * venti compiti non e' una riga, e' un'altra pagina. */
export const MASSIMO_VOCI_DI_LISTA = 3;

/** La chiave di un attributo resa leggibile: «ultimo_voto» → «Ultimo voto». */
export function nomeLeggibile(chiave) {
  const parole = pulito(chiave)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return parole ? parole.charAt(0).toUpperCase() + parole.slice(1) : "";
}

/* Le scelte di una voce, ripulite: una chiave vera, una volta sola, e niente
 * tecnici. L'ordine e' quello in cui sono state scelte — e' quello in cui si
 * leggono. Il nome resta com'e' scritto, anche vuoto: «senza nome si usa
 * quello dell'attributo» lo decide chi legge, non chi salva. */
export function normalizzaAttributi(lista) {
  const visti = new Set();
  const scelti = [];
  for (const voce of Array.isArray(lista) ? lista : []) {
    const chiave = pulito(typeof voce === "string" ? voce : voce?.chiave);
    if (!chiave || visti.has(chiave) || ATTRIBUTI_TECNICI.has(chiave)) continue;
    visti.add(chiave);
    scelti.push({ chiave, nome: pulito(typeof voce === "string" ? "" : voce?.nome) });
  }
  return scelti;
}

/* Un valore che non dice niente non fa una riga: un attributo a `null`, una
 * stringa vuota, una lista vuota. */
function vuoto(valore) {
  if (valore === null || valore === undefined) return true;
  if (typeof valore === "string") return valore.trim() === "";
  if (Array.isArray(valore)) return valore.every(vuoto);
  if (typeof valore === "object") return Object.values(valore).every(vuoto);
  return false;
}

const NUMERO_SCRITTO = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;
const DATA_ISO =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

/* Una data si legge come la si dice — «mer 14 ott» — e non va a capo: gli
 * spazi diventano spazi che non si spezzano, cosi' in una riga stretta va a
 * capo tutta insieme invece di lasciare il mese da solo sotto. L'ora si
 * aggiunge solo se c'e' davvero: mezzanotte scritta a mano e' «il giorno», e
 * tradurla nel fuso di casa la farebbe diventare un'ora che nessuno ha
 * detto. */
function dataLeggibile(testo, lingua) {
  const parti = DATA_ISO.exec(testo);
  if (!parti) return null;
  const [, anno, mese, giorno, ore, minuti] = parti;
  const conOra = ore !== undefined && !(ore === "00" && minuti === "00");
  /* Senza ora — o a mezzanotte — il giorno e' quello scritto, non quello che
   * diventa spostandolo nel fuso di casa. */
  const data = conOra
    ? new Date(testo.replace(" ", "T"))
    : new Date(Number(anno), Number(mese) - 1, Number(giorno));
  if (Number.isNaN(data.getTime())) return null;
  const forma = { weekday: "short", day: "numeric", month: "short" };
  if (conOra) Object.assign(forma, { hour: "2-digit", minute: "2-digit" });
  try {
    return data.toLocaleString(intlLocale(lingua), forma).replace(/\s+/g, " ");
  } catch (_errore) {
    return null;
  }
}

/** Un valore semplice in parole: numeri nella lingua di casa, Sì/No, date. */
export function testoSemplice(valore, lingua = getLocale()) {
  if (valore === null || valore === undefined) return "";
  if (typeof valore === "boolean")
    return valore ? pick("Sì", "Yes", lingua) : pick("No", "No", lingua);
  if (typeof valore === "number") {
    if (!Number.isFinite(valore)) return "";
    return new Intl.NumberFormat(intlLocale(lingua), { maximumFractionDigits: 2 }).format(valore);
  }
  if (Array.isArray(valore))
    return valore
      .map((voce) => testoSemplice(voce, lingua))
      .filter(Boolean)
      .join(", ");
  if (typeof valore === "object")
    return Object.values(valore)
      .map((voce) => testoSemplice(voce, lingua))
      .filter(Boolean)
      .join(" · ");
  const testo = pulito(valore);
  if (NUMERO_SCRITTO.test(testo)) return testoSemplice(Number(testo), lingua);
  return dataLeggibile(testo, lingua) ?? testo;
}

/* Un pezzo di valore: la testa, che si legge in grassetto, e il resto dopo.
 * Un elemento-oggetto di una lista — un compito, con materia, cosa e quando —
 * ha la materia in testa e il resto in fila; tutto il resto e' solo testa. */
function pezzo(valore, lingua) {
  if (valore && typeof valore === "object" && !Array.isArray(valore)) {
    const parti = Object.values(valore)
      .filter((voce) => !vuoto(voce))
      .map((voce) => testoSemplice(voce, lingua))
      .filter(Boolean);
    return { testa: parti[0] || "", resto: parti.slice(1) };
  }
  return { testa: testoSemplice(valore, lingua), resto: [] };
}

/**
 * Come si legge il valore di un attributo, adesso.
 *
 * Torna `null` se non c'e' niente da dire. Altrimenti i pezzi da mostrare —
 * uno solo per un valore semplice, al massimo tre per una lista — quanti ne
 * restano fuori, e lo stesso valore in una riga di testo, per dove c'e' posto
 * per una riga sola: le tessere piccole e l'anteprima nell'editor.
 */
export function valoreDellAttributo(valore, lingua = getLocale()) {
  if (vuoto(valore)) return null;
  if (Array.isArray(valore)) {
    const voci = valore.filter((voce) => !vuoto(voce));
    const pezzi = voci.slice(0, MASSIMO_VOCI_DI_LISTA).map((voce) => pezzo(voce, lingua));
    const altre = voci.length - pezzi.length;
    const riga = pezzi.map((p) => [p.testa, ...p.resto].join(" · ")).join(", ");
    const altriTesto = altre > 0 ? pick(`e altri ${altre}`, `and ${altre} more`, lingua) : "";
    return {
      lista: true,
      pezzi,
      altri: altre,
      altriTesto,
      testo: altriTesto ? `${riga} ${altriTesto}` : riga,
    };
  }
  const solo = pezzo(valore, lingua);
  return {
    lista: false,
    pezzi: [solo],
    altri: 0,
    altriTesto: "",
    testo: [solo.testa, ...solo.resto].join(" · "),
  };
}

/**
 * Gli attributi che un'entita' ha adesso e che si possono mostrare, nell'ordine
 * in cui li manda Home Assistant: e' l'elenco dell'editor.
 */
export function attributiDisponibili(stato, lingua = getLocale()) {
  const attributi = stato?.attributes;
  if (!attributi || typeof attributi !== "object") return [];
  return Object.keys(attributi)
    .filter((chiave) => !ATTRIBUTI_TECNICI.has(chiave))
    .map((chiave) => ({
      chiave,
      anteprima: valoreDellAttributo(attributi[chiave], lingua)?.testo || "",
    }));
}

function normalizzaVoce(voce, indice) {
  const entity = pulito(voce?.entity);
  if (!entity.includes(".")) return null;
  return {
    id: pulito(voce?.id) || `voce-${indice + 1}`,
    nome: pulito(voce?.nome ?? voce?.name),
    entity,
    icona: pulito(voce?.icona ?? voce?.icon),
    attributi: normalizzaAttributi(voce?.attributi),
  };
}

/**
 * L'elenco delle sezioni, ripulito.
 *
 * Una sezione senza titolo ne prende uno di serie col suo numero: senza, la
 * voce nella barra sarebbe vuota e non ci si potrebbe nemmeno cliccare sopra
 * per rimediare. Una sezione senza entita' invece resta: e' il primo momento
 * di ogni sezione, e cancellarla mentre la si sta compilando sarebbe il modo
 * piu' rapido di rendere la funzione inservibile. Chi disegna decide se una
 * sezione vuota merita una voce nella barra — qui non si butta via niente.
 */
export function normalizzaSezioni(stored) {
  const righe = Array.isArray(stored)
    ? stored
    : stored && typeof stored === "object"
      ? [stored]
      : [];
  return righe
    .filter((riga) => riga && typeof riga === "object")
    .slice(0, MASSIMO_SEZIONI)
    .map((riga, indice) => ({
      id: pulito(riga.id) || `sezione-${indice + 1}`,
      titolo: pulito(riga.titolo ?? riga.title),
      icona: pulito(riga.icona ?? riga.icon) || "⭐",
      formato: formatoDellaSezione(riga.formato),
      /* Si mostra nella barra a meno che non si sia detto di no: una sezione
       * appena creata deve comparire, o non si capisce che e' stata creata. */
      mostra: riga.mostra !== false,
      voci: (Array.isArray(riga.voci) ? riga.voci : Array.isArray(riga.rows) ? riga.rows : [])
        .map(normalizzaVoce)
        .filter(Boolean),
    }));
}

/** Le sezioni che meritano una voce nella barra: hanno qualcosa da mostrare. */
export function sezioniDaMostrare(stored) {
  return normalizzaSezioni(stored).filter((sezione) => sezione.mostra && sezione.voci.length);
}

/** Tutte le entita' nominate, senza doppioni: serve a chi ascolta gli stati. */
export function entitaDelleSezioni(stored) {
  const viste = new Set();
  for (const sezione of normalizzaSezioni(stored))
    for (const voce of sezione.voci) viste.add(voce.entity);
  return [...viste];
}

/**
 * Come sta una riga, adesso.
 *
 * `resolve` serve ai riferimenti virtuali della configurazione vecchia, che
 * non sono entity_id veri: chi chiama sa come si risolvono, questo modulo no.
 */
export function letturaDellaVoce(
  voce,
  states = {},
  resolve = (valore) => valore,
  lingua = getLocale(),
) {
  const entity = resolve(voce.entity) || voce.entity;
  const stato = states?.[entity];
  const grezzo = pulito(stato?.state).toLowerCase();
  const muto = MUTI.has(grezzo);
  const dominio = entity.split(".")[0] || "";
  const numero = Number(stato?.state);
  const presenti =
    stato?.attributes && typeof stato.attributes === "object" ? stato.attributes : {};
  /* Le righe sotto lo stato: etichetta e valore, nell'ordine scelto. Un
   * attributo che l'entita' non ha piu' non fa una riga vuota — non fa
   * niente: tornera' da se' quando l'entita' lo rimanda. */
  const attributi = [];
  for (const scelto of voce.attributi || []) {
    if (!Object.hasOwn(presenti, scelto.chiave)) continue;
    const valore = valoreDellAttributo(presenti[scelto.chiave], lingua);
    if (!valore) continue;
    attributi.push({
      chiave: scelto.chiave,
      etichetta: scelto.nome || nomeLeggibile(scelto.chiave),
      valore,
    });
  }
  return {
    id: voce.id,
    entity,
    dominio,
    /* Il nome scritto in configurazione vince, poi quello di Home Assistant,
     * e per ultimo l'entita': un id in mezzo alle parole e' quello che si
     * legge quando nessuno ha avuto niente da dire. */
    nome: voce.nome || pulito(stato?.attributes?.friendly_name) || entity,
    icona: voce.icona,
    muto,
    acceso: !muto && STATI_ACCESI.has(grezzo),
    /* Un numero con la sua unita' si mostra com'e'; il resto e' una parola di
     * stato, e la traduce chi disegna. */
    numero: Number.isFinite(numero) && grezzo !== "" && !MUTI.has(grezzo) ? numero : null,
    unita: pulito(stato?.attributes?.unit_of_measurement),
    stato: muto ? "" : pulito(stato?.state),
    comandabile: COMANDABILI.has(dominio),
    /* Un'automazione ha due gesti: si abilita e si fa partire (#552). Chi
     * disegna le da' una levetta E un tasto; per tutte le altre la levetta
     * basta, ed e' la levetta di sempre. Quali siano lo sa
     * `core/comandi-accanto.js`, che dei verbi e' il padrone. */
    avviabile: siPuoAbilitare(entity),
    /* E un terzo gesto, che non e' ne' accendere ne' far partire: scegliere.
     * Un `select` non ha due stati da scambiare, ha un elenco di voci — e
     * finiva nel «si legge e basta», perche' il dominio non e' fra quelli che
     * si accendono. Chi se l'era messo nella sua sezione ci trovava una riga
     * morta. Anche questa domanda la fa `core/comandi-accanto.js`. */
    tendina: siPuoScegliere(entity),
    attributi,
  };
}

/** Tutte le righe di una sezione, lette. */
export function lettureDellaSezione(
  sezione,
  states = {},
  resolve = (valore) => valore,
  lingua = getLocale(),
) {
  return (sezione?.voci || []).map((voce) => letturaDellaVoce(voce, states, resolve, lingua));
}

/**
 * Il riassunto di una sezione: quante ne rispondono e quante sono accese.
 *
 * Serve al sottotitolo della pagina, che senza direbbe solo il numero di
 * righe — un dato che si conta anche a occhio guardando la pagina.
 *
 * `comandabili` dice se c'e' qualcosa da accendere: in una sezione di soli
 * sensori «0 accese su 4» (#256) sembra un guasto, ed e' solo una domanda
 * che li' non ha senso.
 */
export function contoDellaSezione(letture = []) {
  const vive = letture.filter((riga) => !riga.muto);
  return {
    quante: letture.length,
    vive: vive.length,
    accese: vive.filter((riga) => riga.acceso).length,
    mute: letture.length - vive.length,
    comandabili: letture.filter((riga) => riga.comandabile).length,
  };
}
