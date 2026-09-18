/* Il tesserino: la riga firmata che dice chi e' l'installatore di questa casa.
 *
 * Un quadro lo accende chi vuole, su una macchina sua. Fin qui il ponte si
 * fidava di chiunque: bastava scrivere un indirizzo `https` nella casella e le
 * cartoline partivano. Il tesserino e' come gdahome riconosce i quadri che ha
 * iscritto all'albo — e non riconosce gli altri.
 *
 * ─── Perche' a verificare e' il ponte, e non il quadro ───────────────────
 *
 * E' **tutto** il disegno, e va capito prima di toccare questo file.
 *
 * Il quadro sta su una macchina dell'installatore. Un controllo scritto la'
 * dentro non controlla niente: e' programma suo, su ferro suo, e chi vuole
 * piu' case di quelle che ha pagato lo toglie in trenta secondi. Un controllo
 * che vive nel programma ospitato da chi deve essere controllato e' un dosso,
 * non una serratura.
 *
 * Il ponte invece gira in casa del cliente, e viene dal negozio di gdahome.
 * Quello e' l'unico posto in tutta la catena dove una verifica sta in mano a
 * chi la deve fare.
 *
 * ─── E non chiama nessuno ────────────────────────────────────────────────
 *
 * Qui non si apre nessuna connessione. Si controlla una firma contro una
 * chiave pubblica che sta gia' in questo file: l'abbinamento funziona col
 * server dell'albo spento, non aggiunge nessuna dipendenza di rete in casa di
 * nessuno, e il centralino resta fuori dal giro. Un controllo di licenza che
 * per funzionare deve telefonare a casa e' un controllo che un giorno lascia a
 * piedi un cliente perche' era in manutenzione una macchina dall'altra parte
 * del paese.
 *
 * ─── Le chiavi stanno scritte qui, e non sono un'opzione ─────────────────
 *
 * Non c'e' — e non si aggiunga — nessun modo di cambiarle da fuori: ne'
 * un'opzione dell'add-on, ne' una variabile d'ambiente, ne' un file. Chi
 * installa gdahome in casa di qualcuno ha in mano Home Assistant, e quindi le
 * opzioni e l'ambiente: una chiave che si puo' sostituire da li' e' la stessa
 * serratura di prima con una vite in piu'.
 *
 * Chi si rifa' gdahome per se' — il suo centralino, il suo albo — cambia
 * questa riga e ricostruisce l'add-on, che e' esattamente giusto: sta
 * costruendo un altro prodotto.
 */

import { createPublicKey, verify } from "node:crypto";

/* Le chiavi pubbliche dell'albo, in base64url dello SPKI.
 *
 * **Sono piu' di una apposta.** Il giorno che quella privata va cambiata — per
 * scadenza, per sospetto, per un portatile perso — i tesserini gia' in giro
 * devono restare buoni finche' non scadono da soli: si aggiunge la nuova in
 * cima, si lascia la vecchia sotto, e la si toglie quando l'ultimo tesserino
 * firmato con quella e' scaduto. Una lista costa tre righe adesso e ne salva
 * trecento il giorno che serve.
 *
 * Vuota, questo ponte non abbina nessun quadro e lo dice chiaro. Per
 * riempirla:
 *
 *     node albo/strumenti/firma.mjs chiavi --scrivi
 */
export const CHIAVI_DELL_ALBO = [];

/** Il tesserino non va bene, e il perche' e' scritto nel messaggio. */
export class TesserinoNoNo extends Error {}

const PEZZI = 2;

/* Un nome di macchina e basta: finisce in un confronto, non in una pagina, ma
 * un `d` che non e' un nome non e' un tesserino. */
const NOME_BUONO = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

const GIORNO_BUONO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Spacchetta un tesserino **senza verificarlo**.
 *
 * Sono due funzioni separate apposta, e quella che crede si chiama «verifica».
 * Questa spacchetta e basta: quello che torna di qui e' leggibile, non vero, e
 * chi lo usa per decidere qualcosa sta sbagliando. Serve a chi un tesserino lo
 * deve **guardare** — uno strumento, un messaggio d'errore che dice per quale
 * quadro era — e a tenere il lavoro di lettura fuori dalla funzione che
 * giudica, dove ogni riga in piu' e' una riga da fidarsi.
 */
export function leggiIlTesserino(scritto) {
  const pezzi = String(scritto ?? "")
    .trim()
    .split(".");
  if (pezzi.length !== PEZZI || !pezzi[0] || !pezzi[1]) {
    throw new TesserinoNoNo("questo non e' un tesserino");
  }
  let detto;
  try {
    detto = JSON.parse(Buffer.from(pezzi[0], "base64url").toString("utf8"));
  } catch (_errore) {
    throw new TesserinoNoNo("questo tesserino non si legge");
  }
  if (!detto || typeof detto !== "object" || Array.isArray(detto)) {
    throw new TesserinoNoNo("questo tesserino non si legge");
  }
  return {
    chi: String(detto.i ?? ""),
    dove: String(detto.d ?? "").toLowerCase(),
    soglia: Number(detto.s) || 0,
    fino: String(detto.f ?? ""),
    /* Il pezzo su cui sta la firma: **il testo come e' scritto**, non il JSON
     * riscritto da capo. Rigenerarlo vorrebbe dire che l'ordine dei campi, gli
     * spazi e il modo di scrivere i numeri diventano parte del segreto — e un
     * giorno una versione di Node li scrive mezzo millimetro diversi e tutti i
     * tesserini del mondo smettono di valere. */
    firmato: pezzi[0],
    firma: pezzi[1],
  };
}

/**
 * Questo tesserino vale, per questo quadro, oggi?
 *
 * Torna quello che dice, oppure alza. Non torna mai `false`: un «no» muto e'
 * un «no» che qualcuno prima o poi dimentica di guardare.
 */
export function verificaIlTesserino(
  scritto,
  { dove, adesso = Date.now(), chiavi = CHIAVI_DELL_ALBO } = {},
) {
  if (!Array.isArray(chiavi) || chiavi.length === 0) {
    /* Non «tesserino non valido»: questo ponte non e' in condizione di
     * giudicare, ed e' un guasto di chi l'ha costruito, non di chi lo usa. */
    throw new TesserinoNoNo(
      "questo ponte non ha nessuna chiave dell'albo, e non puo' riconoscere nessun quadro",
    );
  }

  const tesserino = leggiIlTesserino(scritto);

  if (!NOME_BUONO.test(tesserino.dove)) {
    throw new TesserinoNoNo("questo tesserino non dice per quale quadro vale");
  }
  if (!GIORNO_BUONO.test(tesserino.fino)) {
    throw new TesserinoNoNo("questo tesserino non dice fino a quando vale");
  }

  /* Prima la firma, poi tutto il resto. Quello che c'e' scritto dentro non
   * vuol dire niente finche' non si sa chi l'ha scritto: giudicare la scadenza
   * di una riga che puo' aver scritto chiunque e' teatro. */
  const messaggio = Buffer.from(tesserino.firmato, "ascii");
  let firma;
  try {
    firma = Buffer.from(tesserino.firma, "base64url");
  } catch (_errore) {
    throw new TesserinoNoNo("la firma di questo tesserino non si legge");
  }
  if (!chiavi.some((chiave) => laFirmaTorna(messaggio, firma, chiave))) {
    throw new TesserinoNoNo("la firma di questo tesserino non e' di gdahome");
  }

  /* Il tesserino vale per **un** quadro. Senza questa riga, il tesserino di
   * Rossi aperto una volta sola funzionerebbe nel quadro di chiunque l'abbia
   * visto passare: si controlla il nome della macchina, che e' la cosa che
   * l'installatore possiede davvero. La porta no — un quadro dietro a `:8443`
   * e' sempre la sua macchina. */
  let suo;
  try {
    suo = new URL(String(dove ?? "")).hostname.toLowerCase();
  } catch (_errore) {
    throw new TesserinoNoNo("l'indirizzo di questo quadro non e' un indirizzo");
  }
  if (suo !== tesserino.dove) {
    throw new TesserinoNoNo(`questo tesserino e' per ${tesserino.dove}, non per ${suo}`);
  }

  /* Scaduto **oggi** vale ancora: `fino: 2027-03-01` vuol dire tutto il primo
   * di marzo, non fino alla mezzanotte che lo apre. E' il modo in cui le date
   * di scadenza le legge chiunque, e il modo in cui non le legge quasi nessun
   * programma. */
  if (ilGiorno(adesso) > tesserino.fino) {
    throw new TesserinoNoNo(`questo tesserino e' scaduto il ${tesserino.fino}`);
  }

  return {
    chi: tesserino.chi,
    dove: tesserino.dove,
    soglia: tesserino.soglia,
    fino: tesserino.fino,
  };
}

const ilGiorno = (quando) => new Date(quando).toISOString().slice(0, 10);

function laFirmaTorna(messaggio, firma, chiave) {
  try {
    return verify(
      null,
      messaggio,
      createPublicKey({
        key: Buffer.from(String(chiave), "base64url"),
        format: "der",
        type: "spki",
      }),
      firma,
    );
  } catch (_errore) {
    /* Una chiave scritta storta in questo file non deve far cadere il ponte:
     * si comporta come una chiave che non torna, e le altre si provano lo
     * stesso. */
    return false;
  }
}
