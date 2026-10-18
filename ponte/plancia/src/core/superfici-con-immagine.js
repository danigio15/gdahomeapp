/* Dove la plancia mette un'immagine: l'elenco delle card che si configurano.
 *
 * «Lo devi aggiungere a tutti la possibilita' di inserire immagini o
 * disegni, altrimenti e' inutile.» Ogni card che chi configura sceglie — una
 * luce, un clima, una tapparella, una telecamera, una stanza, un'azione
 * rapida, un dispositivo, una presa — puo' portare una foto di casa o un
 * disegno da riquadro (`immagine-del-riquadro.js`). L'immagine sta addosso
 * alla cosa, nel posto dove la cosa e' gia' scritta: `immagine` sul
 * dispositivo della sezione, sulla stanza, sull'azione. Cosi' viaggia con lei
 * — fra i dispositivi, e fino al muro, che legge le stesse sezioni.
 *
 * Qui c'e' solo l'elenco e le regole per trovare la cosa di una card: niente
 * pagina, si prova senza browser. Chi disegna (`riquadri-con-immagine-section`)
 * vede le card della pagina con `selettore`, legge da `idDellaCard` di chi
 * sono, e posa l'immagine dentro (`dentro`, se non va sulla card intera). Una
 * card nuova la prende gratis aggiungendo una riga qui.
 *
 * - `sezione`: la sezione del deposito (`lights`, `climate`…) dove sta
 *   l'elenco; oppure `casella`: la chiave di configurazione che lo tiene;
 * - `chiaveDellaVoce`: come si riconosce una voce — `entity`, `id`, o
 *   `indice` (la posizione nell'elenco, per le azioni rapide);
 * - `forma: "righe"`: la casella e' un elenco dichiarato (`{ righe: [...] }`,
 *   `elenco-dichiarato.js`), non un elenco semplice;
 * - `pagine`: le pagine della plancia dove quelle card stanno. Si guardano
 *   loro, non tutto il documento: e' li' che il guscio le rifa';
 * - `propria`: la superficie si veste da se' (i Dispositivi e le Prese hanno
 *   la loro card con l'immagine, e il loro blocco nel config).
 */

export const SUPERFICI_CON_IMMAGINE = Object.freeze([
  Object.freeze({
    chiave: "luci",
    pagine: Object.freeze(["page-luci", "page-home", "page-stanze"]),
    nome: Object.freeze({ it: "Luci", en: "Lights" }),
    sezione: "lights",
    chiaveDellaVoce: "entity",
    selettore: ".dm-lucip-card[data-dm-lucip]",
    attributi: Object.freeze(["data-dm-lucip"]),
  }),
  Object.freeze({
    chiave: "clima",
    pagine: Object.freeze(["page-clima", "page-stanze"]),
    nome: Object.freeze({ it: "Clima", en: "Climate" }),
    sezione: "climate",
    chiaveDellaVoce: "entity",
    selettore: ".dm-cl-card[data-dm-cl]",
    attributi: Object.freeze(["data-dm-cl"]),
  }),
  Object.freeze({
    chiave: "tapparelle",
    pagine: Object.freeze(["page-tapparelle", "page-stanze"]),
    nome: Object.freeze({ it: "Tapparelle", en: "Blinds" }),
    sezione: "covers",
    chiaveDellaVoce: "entity",
    selettore: ".tapp-card[data-tapp]",
    attributi: Object.freeze(["data-tapp"]),
  }),
  Object.freeze({
    chiave: "telecamere",
    pagine: Object.freeze(["page-security", "page-citofono"]),
    nome: Object.freeze({ it: "Telecamere", en: "Cameras" }),
    sezione: "cameras",
    chiaveDellaVoce: "entity",
    selettore: ".cam-card[data-dm-entity]",
    attributi: Object.freeze(["data-dm-entity"]),
    /* Il fondo del video: si vede quando la telecamera non manda niente. */
    dentro: ".dm-cam-feed",
  }),
  Object.freeze({
    chiave: "stanze",
    pagine: Object.freeze(["page-stanze", "page-temp"]),
    nome: Object.freeze({ it: "Stanze", en: "Rooms" }),
    sezione: "rooms",
    chiaveDellaVoce: "id",
    /* La stessa stanza e' due card: la tessera delle Stanze e quella della
     * Temperatura. L'immagine e' una, della stanza. */
    selettore: ".dm-stanze-tessera[data-dm-stanza],.temp-card[data-room-id]",
    attributi: Object.freeze(["data-dm-stanza", "data-room-id"]),
  }),
  Object.freeze({
    chiave: "elettrodomestici",
    pagine: Object.freeze(["page-appliances-main"]),
    nome: Object.freeze({ it: "Elettrodomestici", en: "Appliances" }),
    sezione: "appliances",
    chiaveDellaVoce: "id",
    selettore: ".dm-ap-card[data-appliance-id]",
    attributi: Object.freeze(["data-appliance-id"]),
  }),
  Object.freeze({
    chiave: "robot",
    pagine: Object.freeze(["page-robot"]),
    nome: Object.freeze({ it: "Robot", en: "Robots" }),
    sezione: "robots",
    chiaveDellaVoce: "entity",
    selettore: ".dm-robot-card[data-dm-robot]",
    attributi: Object.freeze(["data-dm-robot"]),
  }),
  Object.freeze({
    chiave: "varchi",
    pagine: Object.freeze(["page-varchi"]),
    nome: Object.freeze({ it: "Varchi", en: "Openings" }),
    casella: "cd_varchi",
    forma: "righe",
    chiaveDellaVoce: "entity",
    selettore: ".dm-varco[data-dm-ultime]",
    attributi: Object.freeze(["data-dm-ultime"]),
  }),
  Object.freeze({
    chiave: "presenza",
    pagine: Object.freeze(["page-presenza"]),
    nome: Object.freeze({ it: "Presenza", en: "Presence" }),
    casella: "cd_presenza",
    forma: "righe",
    chiaveDellaVoce: "entity",
    selettore: ".dm-presenza[data-dm-ultime]",
    attributi: Object.freeze(["data-dm-ultime"]),
  }),
  Object.freeze({
    chiave: "azioni",
    pagine: Object.freeze(["page-home"]),
    nome: Object.freeze({ it: "Azioni rapide", en: "Quick actions" }),
    casella: "cd_quick_actions",
    chiaveDellaVoce: "indice",
    selettore: "#qa-grid .qa-btn",
    attributi: Object.freeze([]),
  }),
  Object.freeze({
    chiave: "dispositivi",
    nome: Object.freeze({ it: "Dispositivi", en: "Devices" }),
    casella: "cd_devices",
    chiaveDellaVoce: "indice",
    propria: true,
  }),
  Object.freeze({
    chiave: "prese",
    nome: Object.freeze({ it: "Prese", en: "Sockets" }),
    casella: "cd_prese",
    chiaveDellaVoce: "entity",
    propria: true,
  }),
]);

/** La superficie con questa chiave, o `null`. */
export function superficieConImmagine(chiave) {
  return SUPERFICI_CON_IMMAGINE.find((s) => s.chiave === chiave) || null;
}

/** Le superfici che la plancia veste posando l'immagine sulla card del guscio. */
export const SUPERFICI_DA_VESTIRE = Object.freeze(
  SUPERFICI_CON_IMMAGINE.filter((s) => !s.propria && s.selettore),
);

/** Di chi e' la card: il valore del primo attributo che c'e', o "". */
export function idDellaCard(superficie, card) {
  for (const nome of superficie?.attributi || []) {
    const valore = String(card?.getAttribute?.(nome) ?? "").trim();
    if (valore) return valore;
  }
  return "";
}

/**
 * La voce dell'elenco che corrisponde a questa card. `indice` e' la posizione
 * della card fra le sue sorelle, per le superfici che si riconoscono cosi'.
 */
export function voceDellaCard(superficie, elenco, card, indice = -1) {
  const voci = Array.isArray(elenco) ? elenco : [];
  if (superficie?.chiaveDellaVoce === "indice") return voci[indice] || null;
  const id = idDellaCard(superficie, card);
  if (!id) return null;
  const campo = superficie?.chiaveDellaVoce === "id" ? "id" : "entity";
  return voci.find((v) => String(v?.[campo] ?? "") === id) || null;
}

/** Il nome di una voce, per la riga del config. */
export function nomeDellaVoce(voce, ripiego = "") {
  return (
    String(voce?.name || voce?.nome || "").trim() ||
    String(voce?.entity || voce?.id || "").trim() ||
    ripiego
  );
}

/** Le pagine da guardare: quelle di tutte le superfici da vestire, una volta. */
export const PAGINE_CON_IMMAGINI = Object.freeze([
  ...new Set(SUPERFICI_DA_VESTIRE.flatMap((s) => s.pagine || [])),
]);
