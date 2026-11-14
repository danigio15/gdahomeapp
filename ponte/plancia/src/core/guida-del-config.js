/* La guida del Config: le regole, senza il disegno.
 *
 * «Pensa a come creare direttamente dal config delle plance un manuale
 * interattivo che spiega come fare le configurazioni e tutto.»
 *
 * Il manuale d'uso (`docs/MANUALE.md`, capitolo 27) spiega scheda per scheda
 * come si configura la plancia. Quelle stesse parole stanno qui, in
 * `guida-del-config-testi.js`, che non si scrive a mano: lo rifà
 * `strumenti/guida-dal-manuale.mjs` leggendo il manuale. Un testo solo, due
 * posti dove leggerlo — il manuale stampato e la guida dentro il Config — e
 * nessuna delle due copie può restare indietro rispetto all'altra.
 *
 * Questo file decide tre cose, ed è puro (nessun DOM, nessuna memoria):
 *
 *  - quale guida vale per una linguetta (`guidaDi`);
 *  - quali parole cercare sullo schermo per un passo (`paroleDelPasso`): sono
 *    le etichette fra «virgolette basse», le stesse che la scheda mostra, ed è
 *    con quelle che «Mostrami» trova il campo giusto;
 *  - l'ordine in cui conviene configurare una casa nuova (`PERCORSO`).
 */

import { GUIDE, GUIDE_3D } from "./guida-del-config-testi.js";

const pulito = (valore) => String(valore ?? "").trim();

/** La guida di una linguetta del Config (`visib`, `sez1`, `luci`…), o `null`. */
export function guidaDi(scheda) {
  const chiave = pulito(scheda);
  if (!chiave) return null;
  return Object.prototype.hasOwnProperty.call(GUIDE, chiave) ? GUIDE[chiave] : null;
}

/** La guida di un passo di «Crea la tua casa» (0 = Planimetria … 7 = Casa
 * 3D), dal capitolo 28 del manuale, o `null`. */
export function guida3dDi(passo) {
  const chiave = String(Number.isInteger(passo) ? passo : pulito(passo));
  return Object.prototype.hasOwnProperty.call(GUIDE_3D, chiave) ? GUIDE_3D[chiave] : null;
}

/** I passi della Casa 3D che hanno una guida. */
export function passi3dConGuida() {
  return Object.keys(GUIDE_3D).map(Number);
}

/** Le linguette che hanno una guida, nell'ordine del manuale. */
export function schedeConGuida() {
  return Object.keys(GUIDE);
}

/* Le etichette fra «virgolette basse», senza le icone davanti: sullo schermo
 * «💾 Salva sezione» può essere scritto «💾 SALVA SEZIONE», e un'icona in più
 * o in meno non deve far perdere il campo. */
const ICONE = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu;

export function normalizza(testo) {
  return pulito(String(testo ?? "").replace(ICONE, " "))
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("it");
}

/** Le parole da cercare sullo schermo per un passo, dalla più precisa. */
export function paroleDelPasso(passo) {
  const testo = typeof passo === "string" ? passo : pulito(passo?.testo);
  const trovate = [];
  for (const pezzo of testo.matchAll(/«([^»]{2,80})»/g)) {
    const parola = normalizza(pezzo[1]);
    if (parola && !trovate.includes(parola)) trovate.push(parola);
  }
  return trovate;
}

/** Se un testo dello schermo è quello che il passo nomina. Basta l'inizio:
 * «Scegli entità ›» è «Scegli entità». */
export function eLaParola(testoDelloSchermo, parola) {
  const visto = normalizza(testoDelloSchermo);
  const cercato = normalizza(parola);
  if (!visto || !cercato) return false;
  return visto === cercato || visto.startsWith(`${cercato} `) || visto.startsWith(cercato);
}

/** Il percorso consigliato per una casa nuova: dall'autorilevamento, che
 * riempie quasi tutto da solo, alle rifiniture della Home. Ogni passo è una
 * linguetta e una frase che dice perché viene lì. */
export const PERCORSO = Object.freeze([
  Object.freeze({
    scheda: "visib",
    it: "Avvia l'autorilevamento: riempie da solo luci, clima, stanze e telecamere.",
    en: "Run auto-detection: it fills in lights, climate, rooms and cameras by itself.",
  }),
  Object.freeze({
    scheda: "stanze",
    it: "Controlla le stanze e il loro ordine: tutte le altre sezioni le usano.",
    en: "Check the rooms and their order: every other section uses them.",
  }),
  Object.freeze({
    scheda: "luci",
    it: "Sistema le luci, ognuna nella sua stanza.",
    en: "Arrange the lights, each one in its room.",
  }),
  Object.freeze({
    scheda: "sez9",
    it: "Clima: termostati e condizionatori.",
    en: "Climate: thermostats and air conditioners.",
  }),
  Object.freeze({
    scheda: "tapp",
    it: "Finestre e tapparelle.",
    en: "Windows and shutters.",
  }),
  Object.freeze({
    scheda: "sez4",
    it: "Sicurezza: centrale d'allarme, telecamere, sensori di fumo e gas.",
    en: "Security: alarm panel, cameras, smoke and gas sensors.",
  }),
  Object.freeze({
    scheda: "sez1",
    it: "Energia: contatore della rete, fotovoltaico e tariffe.",
    en: "Energy: grid meter, solar and tariffs.",
  }),
  Object.freeze({
    scheda: "people",
    it: "Le persone della famiglia, per sapere chi è in casa.",
    en: "The family members, to know who is home.",
  }),
  Object.freeze({
    scheda: "sez0",
    it: "La Home: l'ordine dei blocchi e le stanze in vista.",
    en: "Home: the order of the blocks and the rooms on show.",
  }),
  Object.freeze({
    scheda: "todo",
    it: "I widget della Home: quali tessere e in che ordine.",
    en: "Home widgets: which tiles and in which order.",
  }),
  Object.freeze({
    scheda: "sez8",
    it: "Le azioni rapide: i tasti che fanno più cose insieme.",
    en: "Quick actions: buttons that do several things at once.",
  }),
  Object.freeze({
    scheda: "backup",
    it: "Fai un backup, adesso che è tutto a posto.",
    en: "Make a backup, now that everything is in place.",
  }),
]);

/** I passi del percorso che hanno una linguetta presente in questo Config:
 * una plancia vecchia, o senza una sezione, non deve mandare nel vuoto. */
export function percorsoPer(linguettePresenti = []) {
  const presenti = new Set((linguettePresenti || []).map(pulito));
  return PERCORSO.filter((passo) => presenti.size === 0 || presenti.has(passo.scheda));
}
