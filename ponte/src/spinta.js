/* La busta di una notifica: chiusa qui, aperta solo sul telefono.
 *
 * Una notifica, per arrivare a un telefono con l'app chiusa, deve passare da
 * tre mani che non sono nostre: il centralino, Google (Firebase Cloud
 * Messaging) e, per l'iPhone, Apple. Nessuna delle tre deve poter leggere
 * «antifurto scattato in soggiorno» o «la porta del garage e' aperta e in
 * casa non c'e' nessuno»: sono esattamente le cose che non si dicono a chi
 * passa.
 *
 * Quindi la notifica si chiude **qui**, per ogni telefono con la sua chiave,
 * e viaggia come un blocco di byte che fuori da quel telefono non significa
 * niente. Quello che le tre mani vedono e' il blocco, l'identificativo del
 * telefono (`dm_…`, che non e' un segreto) e, sull'iPhone, una frase sempre
 * uguale — «gdahome: nuova notifica» — perche' Apple una frase da mostrare la
 * vuole comunque.
 *
 * ─── La chiave ────────────────────────────────────────────────────────────
 *
 * Non se ne inventa una nuova: il telefono e la casa ne condividono gia' una,
 * la **chiave del filo** che il telefono ha ricevuto abbinandosi
 * (`dispositivi.js`) e che al centralino non e' mai passata. Da quella se ne
 * ricava un'altra, solo per le notifiche, con HKDF e un'etichetta sua: cosi'
 * una busta di notifica e una busta del filo non sono mai fatte con la stessa
 * chiave, nemmeno per sbaglio, e i due contatori del filo (`cifra.js`) restano
 * del filo.
 *
 * Il nonce qui non e' un contatore: una notifica non ha un ordine garantito —
 * Google le puo' consegnare in disordine, o due volte — e il telefono non ha
 * un filo aperto su cui tenere il conto. Sono dodici byte di caso per busta,
 * che con AES-GCM e una chiave per telefono stanno lontanissimi da qualunque
 * rischio di ripetersi. Contro chi rigioca una busta vecchia c'e' altro: ogni
 * notifica ha un identificativo e una scadenza **dentro** il cifrato, e
 * l'app le ricorda.
 *
 * Il telefono entra nei dati autenticati (`AAD`): una busta fatta per un
 * telefono e girata a un altro non si apre, anche se per assurdo i due
 * avessero la stessa chiave.
 *
 * Cosa NON da' questa busta, detto chiaro: il segreto in avanti. La chiave del
 * filo vive quanto l'abbinamento, e chi rubasse domani il file dei telefoni
 * (`/data/dispositivi.json`) e avesse registrato oggi le notifiche passate da
 * Google potrebbe aprirle. Il filo vero ha lo scambio effimero per questo; una
 * notifica non puo' averlo — parte quando il telefono e' spento — ed e' un
 * prezzo che si paga per avere la notifica.
 */

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

export const ETICHETTA_DELLA_SPINTA = "gdahome/spinta/v1";

/* Il primo byte della busta. Chi non lo riconosce non prova ad aprire. */
export const VERSIONE_DELLA_SPINTA = 1;

/* Quanto puo' pesare quello che c'e' dentro. Un messaggio di Firebase porta
 * al massimo quattro chilobyte di dati, e la busta in base64 pesa un terzo in
 * piu' del contenuto: tremila byte lasciano posto all'identificativo del
 * telefono e a quello che il centralino ci aggiunge attorno. */
export const CONTENUTO_MASSIMO = 2200;

const chiaveValida = (chiave) => typeof chiave === "string" && /^[0-9a-f]{64}$/i.test(chiave);

/* La chiave delle notifiche di un telefono, ricavata dalla sua chiave del
 * filo. Il telefono fa lo stesso conto (`app/lib/notifiche/busta.dart`). */
export function chiaveDellaSpinta(chiaveDelFilo, telefono) {
  if (!chiaveValida(chiaveDelFilo)) throw new Error("la chiave del filo non e' buona");
  return Buffer.from(
    hkdfSync(
      "sha256",
      Buffer.from(chiaveDelFilo, "hex"),
      Buffer.from(ETICHETTA_DELLA_SPINTA, "utf8"),
      `${ETICHETTA_DELLA_SPINTA}|${telefono}`,
      32,
    ),
  );
}

const datiAutenticati = (telefono) =>
  Buffer.from(`${ETICHETTA_DELLA_SPINTA}|${String(telefono)}`, "utf8");

/* Chiude il contenuto (un oggetto) per quel telefono. Torna la busta in
 * base64: un byte di versione, dodici di nonce, il cifrato e i sedici del
 * marchio. */
export function chiudiLaSpinta({ chiaveDelFilo, telefono, contenuto }) {
  const testo = Buffer.from(JSON.stringify(contenuto), "utf8");
  if (testo.length > CONTENUTO_MASSIMO) throw new SpintaTroppoGrande(testo.length);
  const chiave = chiaveDellaSpinta(chiaveDelFilo, telefono);
  const nonce = randomBytes(12);
  const cifratore = createCipheriv("aes-256-gcm", chiave, nonce);
  cifratore.setAAD(datiAutenticati(telefono));
  const cifrato = Buffer.concat([cifratore.update(testo), cifratore.final()]);
  return Buffer.concat([
    Buffer.from([VERSIONE_DELLA_SPINTA]),
    nonce,
    cifrato,
    cifratore.getAuthTag(),
  ]).toString("base64");
}

/* Il contrario, per le prove e per chi volesse controllare: l'app fa lo
 * stesso in Dart. Solleva se la busta non e' di quel telefono, o e' stata
 * toccata. */
export function apriLaSpinta({ chiaveDelFilo, telefono, busta }) {
  const tutto = Buffer.from(String(busta ?? ""), "base64");
  if (tutto.length < 1 + 12 + 16) throw new SpintaGuasta("busta troppo corta");
  if (tutto[0] !== VERSIONE_DELLA_SPINTA) throw new SpintaGuasta("versione sconosciuta");
  const nonce = tutto.subarray(1, 13);
  const marchio = tutto.subarray(tutto.length - 16);
  const dentro = tutto.subarray(13, tutto.length - 16);
  const decifratore = createDecipheriv(
    "aes-256-gcm",
    chiaveDellaSpinta(chiaveDelFilo, telefono),
    nonce,
  );
  decifratore.setAAD(datiAutenticati(telefono));
  decifratore.setAuthTag(marchio);
  let byte;
  try {
    byte = Buffer.concat([decifratore.update(dentro), decifratore.final()]);
  } catch (_errore) {
    throw new SpintaGuasta("la busta non si apre");
  }
  return JSON.parse(byte.toString("utf8"));
}

export class SpintaGuasta extends Error {}

export class SpintaTroppoGrande extends Error {
  constructor(quanto) {
    super(`una notifica da ${quanto} byte non ci sta in una spinta`);
  }
}

/* ─── La foto di una notifica ─────────────────────────────────────────────
 *
 * «Quando il motion delle telecamere rileva un movimento ti fanno una foto e
 * ti mandano la foto.» Una foto in una spinta non ci sta — Firebase porta
 * quattro chilobyte — e allora viaggia a parte: la casa la chiude per quel
 * telefono, con LA STESSA chiave delle notifiche, e la lascia al centralino
 * per dieci minuti; nella busta va solo il suo numero. Il telefono la prende,
 * la apre e la mette nella notifica.
 *
 * Il centralino tiene un blocco di byte che non sa aprire, e lo da' una volta
 * sola. Le etichette dei dati autenticati sono diverse da quelle della busta
 * («gdahome/foto/v1»): una foto non si puo' far passare per una notifica, ne'
 * il contrario. E parte solo per chi ha scelto le notifiche «elaborate»: con
 * le semplici nessuna foto lascia la casa. */

export const ETICHETTA_DELLA_FOTO = "gdahome/foto/v1";

/* Quanto puo' pesare una foto: il centralino non ne tiene di piu'. */
export const FOTO_MASSIMA = 300 * 1024;

/* E prima di chiuderla: la busta aggiunge ventinove byte (versione, nonce,
 * marchio), e il tetto del centralino e dei telefoni vale per la busta. Una
 * foto di 300 KB esatti passava di qui e veniva rifiutata la'. */
export const FOTO_CHIARA_MASSIMA = FOTO_MASSIMA - (1 + 12 + 16);

const datiAutenticatiDellaFoto = (telefono) =>
  Buffer.from(`${ETICHETTA_DELLA_FOTO}|${String(telefono)}`, "utf8");

/* Chiude i byte di una foto per quel telefono. Torna la busta in base64. */
export function chiudiLaFoto({ chiaveDelFilo, telefono, byte }) {
  const dati = Buffer.isBuffer(byte) ? byte : Buffer.from(byte || []);
  if (!dati.length) throw new Error("una foto vuota non si manda");
  if (dati.length > FOTO_CHIARA_MASSIMA) throw new SpintaTroppoGrande(dati.length);
  const nonce = randomBytes(12);
  const cifratore = createCipheriv(
    "aes-256-gcm",
    chiaveDellaSpinta(chiaveDelFilo, telefono),
    nonce,
  );
  cifratore.setAAD(datiAutenticatiDellaFoto(telefono));
  const cifrato = Buffer.concat([cifratore.update(dati), cifratore.final()]);
  return Buffer.concat([
    Buffer.from([VERSIONE_DELLA_SPINTA]),
    nonce,
    cifrato,
    cifratore.getAuthTag(),
  ]).toString("base64");
}

/* Il contrario, per le prove: l'app fa lo stesso in Dart, l'iPhone in Swift. */
export function apriLaFoto({ chiaveDelFilo, telefono, busta }) {
  const tutto = Buffer.from(String(busta ?? ""), "base64");
  if (tutto.length < 1 + 12 + 16 || tutto[0] !== VERSIONE_DELLA_SPINTA)
    throw new SpintaGuasta("foto guasta");
  const decifratore = createDecipheriv(
    "aes-256-gcm",
    chiaveDellaSpinta(chiaveDelFilo, telefono),
    tutto.subarray(1, 13),
  );
  decifratore.setAAD(datiAutenticatiDellaFoto(telefono));
  decifratore.setAuthTag(tutto.subarray(tutto.length - 16));
  try {
    return Buffer.concat([
      decifratore.update(tutto.subarray(13, tutto.length - 16)),
      decifratore.final(),
    ]);
  } catch (_errore) {
    throw new SpintaGuasta("la foto non si apre");
  }
}
