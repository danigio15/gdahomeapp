/* Il disegno di una stanza che un'immagine non ce l'ha.
 *
 * Dal campo: «perche' le altre stanze non esce l'immagine nei riquadri cosi'?
 * Esce solo l'ingresso». L'immagine di una stanza si sceglie a mano, una per
 * una (`immagine-del-riquadro.js`), e chi l'ha messa su una stanza sola vede
 * una Home a due facce: un riquadro col disegno e sette senza. Il catalogo ha
 * gia' i disegni delle stanze — la cucina, il bagno, la camera, il terrazzo —
 * e il nome della stanza dice quasi sempre quale: «Bagno piccolo» e' un
 * bagno, «Balcone cucina» e' un balcone, non una cucina.
 *
 * Le regole:
 * - ogni stanza ha il suo interruttore «Immagine», addosso alla stanza come
 *   la sua immagine (`mostraImmagine: true|false`), cosi' viaggia con lei
 *   fino al muro. Non scritto vuol dire «come prima»: acceso se la stanza ha
 *   un'immagine scelta a mano, spento se non ce l'ha — all'aggiornamento
 *   nessuno vede cambiare la sua Home;
 * - acceso: l'immagine scelta a mano, se c'e'; altrimenti il disegno che il
 *   nome dice. Spento: niente immagine da nessuna parte, ma quella scelta a
 *   mano resta salvata e torna quando si riaccende;
 * - il disegno automatico non si scrive in configurazione: si calcola quando
 *   si disegna. Cambiare nome alla stanza cambia il disegno, e nessuna
 *   immagine «vera» viene mai sporcata;
 * - un nome che non si capisce («Zona Pippo») resta senza: il riquadro di
 *   sempre e' meglio di un disegno sbagliato.
 *
 * Tutto puro: si prova senza browser. */

import { disegnoDaRiquadro } from "./disegni-da-riquadro.js";
import { immaginePulita } from "./immagine-del-riquadro.js";

/* Il nome come si confronta: minuscolo, senza accenti, con gli spazi al posto
 * di trattini e segni. «Cucina/Pranzo» e «cucina-pranzo» sono la stessa cosa. */
function piatto(testo) {
  return ` ${String(testo ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;
}

/* Dal nome al disegno. L'ordine conta: si prende la prima regola che
 * risponde.
 *
 * - Fuori prima di tutto: «Balcone cucina» e «Terrazzo camera» sono fuori,
 *   la cucina e la camera dicono solo da che parte stanno.
 * - Il garage, la cantina e la mansarda prima delle stanze: «Cantina vini»
 *   non e' una cucina, «Mansarda letto» si riconosce dalla mansarda.
 * - La lavanderia prima del bagno: ha la sua lavatrice.
 * - Il bagno prima della camera: «Bagno camera» e' un bagno.
 * - La cameretta prima della camera: «camera» sta dentro «cameretta».
 * - La cucina prima del soggiorno: «Cucina soggiorno» si cucina.
 * - Il soggiorno per ultimo: e' il nome piu' largo («sala», «living»). */
export const REGOLE_DELLE_STANZE = Object.freeze([
  Object.freeze({
    disegno: "terrazzo",
    parole:
      /\s(balcon|terrazz|veranda|loggi|patio|portic|giardin|cortil|lastric|solarium|terrace|balcon|porch|deck|garden|yard|backyard)\w*/,
  }),
  Object.freeze({
    disegno: "garage",
    parole: /\s(garag|box|autorimess|rimessa|carport|posto auto)\w*/,
  }),
  Object.freeze({
    disegno: "cantina",
    parole: /\s(cantin|taverna|seminterrat|scantinat|interrat|cellar|basement|wine)\w*/,
  }),
  Object.freeze({
    disegno: "mansarda",
    parole: /\s(mansard|soffitt|sottotett|attic|loft)\w*/,
  }),
  Object.freeze({
    disegno: "lavatrice",
    parole: /\s(lavanderi|laundry|utility)\w*/,
  }),
  Object.freeze({
    disegno: "bagno",
    parole: /\s(bagn|wc|toilet|toelett|servizi|doccia|antibagn|bath|bathroom|shower|restroom)\w*/,
  }),
  Object.freeze({
    disegno: "cinema",
    parole: /\s(cinema|home theat|theater|theatre|sala proiezion)\w*/,
  }),
  Object.freeze({
    disegno: "cameretta",
    parole: /\s(camerett|bimb|bambin|ragazz|figli|giochi|kid|kids|nursery|children|playroom)\w*/,
  }),
  Object.freeze({
    disegno: "camera-letto",
    parole:
      /\s(camer|letto|matrimonial|notte|ospit|dormitori|bedroom|bed|guest|master|sleeping)\w*/,
  }),
  Object.freeze({
    disegno: "stanza-cucina",
    parole: /\s(cucin|cottura|pranzo|kitchen|kitchenette|dining|cuisine)\w*/,
  }),
  Object.freeze({
    disegno: "studio",
    parole: /\s(studi|uffic|lavoro|office|study|workspace|scrivani)\w*/,
  }),
  Object.freeze({
    disegno: "ingresso",
    parole:
      /\s(ingress|corridoi|disimpegn|atrio|androne|entrata|hall|hallway|entrance|entry|foyer|corridor)\w*/,
  }),
  Object.freeze({
    disegno: "soggiorno",
    parole:
      /\s(soggiorn|salott|salone|sala|living|lounge|multimedia|tv|televisione|divan|family|relax|open space)\w*/,
  }),
]);

/* Dall'icona, quando il nome non dice niente: l'icona che chi ha configurato
 * ha scelto per la stanza (`mdi:bed`, `mdi:sofa`…) e' gia' una risposta. */
export const ICONE_DELLE_STANZE = Object.freeze(
  [
    ["terrazzo", "balcony|flower|flower-outline|tree|grass|pine-tree|deck|umbrella-beach"],
    ["garage", "garage|garage-variant|car|car-side|car-hatchback"],
    ["cantina", "glass-wine|bottle-wine|stairs-down|barrel"],
    ["lavatrice", "washing-machine|tumble-dryer"],
    ["bagno", "shower|shower-head|bathtub|bathtub-outline|toilet|paper-roll"],
    ["cinema", "projector|theater|filmstrip|movie|movie-open"],
    ["cameretta", "teddy-bear|baby|baby-carriage|toy-brick|human-child|puzzle"],
    ["camera-letto", "bed|bed-double|bed-king|bed-queen|bed-empty|bed-outline|bunk-bed"],
    ["stanza-cucina", "stove|silverware|silverware-fork-knife|fridge|chef-hat|pot-steam|food"],
    ["studio", "desk|desk-lamp|laptop|briefcase|bookshelf|book-open"],
    ["ingresso", "door|door-open|door-closed|coat-rack|key|key-variant"],
    ["soggiorno", "sofa|sofa-outline|television|television-classic|monitor|tv|couch|armchair|seat"],
  ].map(([disegno, nomi]) =>
    Object.freeze({ disegno, parole: new RegExp(`^(?:mdi|hass|si):(?:${nomi})$`) }),
  ),
);

/* I disegni che le regole possono dare: tutti del catalogo, controllati
 * dalle prove. */
export const DISEGNI_AUTOMATICI = Object.freeze([
  ...new Set([...REGOLE_DELLE_STANZE, ...ICONE_DELLE_STANZE].map((r) => r.disegno)),
]);

function dalNome(nome) {
  const n = piatto(nome);
  if (!n.trim()) return "";
  return REGOLE_DELLE_STANZE.find((r) => r.parole.test(n))?.disegno || "";
}

function dallIcona(icona) {
  const i = String(icona ?? "")
    .trim()
    .toLowerCase();
  if (!i || i === "mdi:home" || i === "mdi:home-outline") return "";
  return ICONE_DELLE_STANZE.find((r) => r.parole.test(i))?.disegno || "";
}

/**
 * La chiave del disegno che si addice alla stanza, o "".
 *
 * Prima il nome, poi l'icona. Un disegno che il catalogo non ha (non
 * dovrebbe succedere: lo dicono le prove) vale come niente.
 */
export function disegnoAutomaticoDellaStanza(stanza) {
  const chiave = dalNome(stanza?.name ?? stanza?.nome) || dallIcona(stanza?.icon ?? stanza?.icona);
  return chiave && disegnoDaRiquadro(chiave) ? chiave : "";
}

/**
 * Se l'immagine della stanza si mostra: quello che dice il suo interruttore,
 * o — se non l'ha mai toccato nessuno — si' solo per chi un'immagine se
 * l'era gia' scelta.
 */
export function immagineAccesa(stanza) {
  if (typeof stanza?.mostraImmagine === "boolean") return stanza.mostraImmagine;
  return Boolean(immaginePulita(stanza?.immagine));
}

/**
 * L'immagine con cui si disegna la stanza, o `null`: spenta niente; accesa
 * la sua, se l'ha, altrimenti il disegno che le si addice.
 */
export function immagineDellaStanza(stanza) {
  if (!immagineAccesa(stanza)) return null;
  const propria = immaginePulita(stanza?.immagine);
  if (propria) return propria;
  const chiave = disegnoAutomaticoDellaStanza(stanza);
  return chiave ? immaginePulita({ src: `disegno:${chiave}` }) : null;
}

/**
 * Cosa dice la riga della stanza nel config: «foto» o «disegno» (scelti a
 * mano), «automatico» (acceso, il disegno del nome), «spenta», o «nessuna»
 * (acceso, ma niente da mostrare: un nome che non si capisce).
 */
export function statoDellImmagine(stanza) {
  if (!immagineAccesa(stanza)) return "spenta";
  const propria = immaginePulita(stanza?.immagine);
  if (propria) return propria.src.startsWith("disegno:") ? "disegno" : "foto";
  return disegnoAutomaticoDellaStanza(stanza) ? "automatico" : "nessuna";
}
