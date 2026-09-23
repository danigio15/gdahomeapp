/* La cifratura fra le due punte.
 *
 * Il centralino sta in mezzo e instrada. Deve poter instradare **senza poter
 * leggere**: e' la differenza fra «mi fido di chi lo gestisce» e «non c'e'
 * niente di cui fidarsi», e la seconda e' l'unica che si possa promettere a
 * qualcuno che ci fa passare la propria casa.
 *
 * Niente di fatto in casa: tutto viene da `node:crypto` — X25519, HKDF,
 * AES-256-GCM. Scrivere primitive crittografiche a mano e' il modo piu' rapido
 * di costruire qualcosa che *sembra* cifrato.
 *
 * ─── Due situazioni, due chiavi ───────────────────────────────────────────
 *
 * **Dopo l'abbinamento** le due punte condividono gia' un segreto: il segno,
 * duecentocinquantasei bit di caso che al centralino non sono mai passati. La
 * chiave si deriva da li'. Il centralino non ha niente da cui partire.
 *
 * **Durante l'abbinamento** il segno non c'e' ancora: e' proprio quello che si
 * sta per consegnare. Quello che le due punte hanno in comune, li', e' il
 * **codice**: la casa lo ha fabbricato, il telefono lo ha letto dal QR code.
 * Al centralino non passa mai — passa la sua impronta, che serve a
 * instradare — e quindi e' il codice stesso a fare da segreto condiviso.
 *
 * La stretta di mano dell'abbinamento (la seconda versione, `abbina: 2`)
 * mescola nella chiave lo scambio effimero X25519 **e il codice**. Non la
 * sua impronta: quella il centralino la conosce, e una chiave fatta con
 * quella non difenderebbe da lui. Chi sta in mezzo senza il codice arriva a
 * un'altra chiave, e la prima busta non si apre.
 *
 * Poi c'e' la conferma: la prima busta del telefono ripete le due chiavi
 * pubbliche, e la casa consegna segno e chiave **solo dopo** averla aperta e
 * averci trovato le chiavi giuste. Un codice sbagliato, o qualcuno in mezzo,
 * falliscono li', prima che esca qualcosa di utile, e il tentativo si conta.
 *
 * Perche' basta un codice e non serve un protocollo apposta per le parole
 * corte (un PAKE): il codice e' di sedici lettere, ottanta bit. Chi vedesse
 * passare la conferma e volesse provare i codici uno per uno a casa sua ne
 * avrebbe per molto piu' dei cinque minuti in cui il codice vale. Con un
 * codice corto non sarebbe cosi', ed e' uno dei motivi per cui e' lungo.
 *
 * La prima versione — scambio effimero e basta, codice dentro il cifrato —
 * difendeva da chi guarda ma non da chi si mette in mezzo, e la casa adesso
 * la rifiuta dicendo di aggiornare l'app.
 */

import {
  createDecipheriv,
  createCipheriv,
  createPrivateKey,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
} from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";

import { codicePulito } from "./segreti.js";

/* Il numero di versione viaggia in chiaro nella prima riga. Serve a poter
 * cambiare idea fra qualche anno senza che le due punte si fraintendano in
 * silenzio: chi non riconosce la versione dice di no invece di provarci. */
export const VERSIONE = 1;

/* La versione della stretta di mano dell'abbinamento, dentro la prima riga
 * (`abbina: 2`). La prima versione era `abbina: true`, e non era legata al
 * codice: una casa di adesso la rifiuta. */
export const VERSIONE_DELL_ABBINAMENTO = 2;

const ETICHETTA_FILO = "gdahome/filo/v1";
const ETICHETTA_ABBINAMENTO = "gdahome/abbinamento/v2";

/* ─── La compressione, prima della cifratura ──────────────────────────────
 *
 * Quello che passa sul filo e' quasi tutto JSON di Home Assistant: un
 * `get_states` da un megabyte e mezzo, trecento risposte di storico da decine
 * di chilobyte l'una. E' testo che si ripete — gli stessi nomi di campo, gli
 * stessi identificativi, le stesse date — e compresso pesa cinque, otto volte
 * meno. Comprimere *dopo* aver cifrato non servirebbe a niente: i byte
 * cifrati non si distinguono dal caso, e il caso non si comprime. Quindi si
 * comprime prima, dentro la busta, e chi sta in mezzo vede solo buste piu'
 * piccole.
 *
 * Non e' una versione nuova del protocollo. Ognuna delle due punte dice nella
 * stretta di mano se **sa aprire** una busta compressa (`gzip: true`), e chi
 * manda comprime solo se l'altro l'ha detto: un ponte nuovo con un'app
 * vecchia, o il contrario, si parlano come prima. Il contenuto si riconosce
 * da solo — un gzip comincia con i due byte `1f 8b`, e un testo in UTF-8 non
 * comincia mai cosi', perche' `8b` da solo non e' un carattere — percio' chi
 * sa aprire il gzip apre tutto, sempre, senza dover sapere prima cosa gli
 * arrivera'.
 *
 * Sotto la soglia non si comprime: un evento da trecento byte compresso non
 * e' piu' piccolo, e' solo piu' lento.
 *
 * Una cosa da sapere, detta per non doverla riscoprire: comprimere prima di
 * cifrare fa si' che la lunghezza di una busta dipenda un poco da quello che
 * c'e' dentro. In teoria, chi potesse far entrare testo suo nello stesso
 * messaggio di un segreto e misurare le buste molte volte ne ricaverebbe
 * qualcosa. Qui il rischio e' teorico — i segreti veri (segno, chiave del
 * filo) non viaggiano mai compressi: l'abbinamento non comprime, e il segno
 * che entra sta in una busta piccola, sotto la soglia — e il formato resta
 * com'e'. Se un giorno dentro le buste finissero segreti accanto a testo
 * scelto da altri, la cura e' non comprimere quei messaggi. */
export const SOGLIA_DI_COMPRESSIONE = 1024;

/* Oltre questo, dentro una busta non c'e' la casa: c'e' una bomba. Vale
 * anche per un intero messaggio a pezzi, ed e' lo stesso numero di
 * `portiere.js`. */
export const APERTA_MASSIMA = 16 * 1024 * 1024;

/* Il livello: basso apposta. Il ponte gira spesso su una macchina piccola, e
 * fra il tre e il sei c'e' il doppio del tempo per un decimo di spazio. */
const LIVELLO_DI_COMPRESSIONE = 3;

const eGzip = (byte) => byte.length >= 2 && byte[0] === 0x1f && byte[1] === 0x8b;

/* Un nonce di dodici byte, come vuole GCM: il primo dice da che parte va il
 * messaggio, gli altri undici sono un contatore.
 *
 * La direzione dentro il nonce non e' un vezzo: senza, i due lati che contano
 * da zero userebbero lo stesso nonce con la stessa chiave, e in GCM riusare un
 * nonce non «indebolisce» — rompe. */
const DA_CHI = Object.freeze({ telefono: 0, casa: 1 });

function nonce(daChi, contatore) {
  const dodici = Buffer.alloc(12);
  dodici[0] = daChi;
  dodici.writeBigUInt64BE(BigInt(contatore), 4);
  return dodici;
}

/* ─── Le chiavi ──────────────────────────────────────────────────────────── */

/* Perche' non si deriva la chiave dal segno.
 *
 * Sembrerebbe la cosa ovvia: le due punte il segno ce l'hanno tutte e due, e
 * al centralino non passa mai. Ma **il ponte il segno non ce l'ha**. Sul disco
 * tiene solo la sua impronta, apposta: cosi' un file rubato non fa entrare
 * nessuno, perche' per autenticarsi serve la parola da cui l'impronta viene, e
 * dall'impronta non si torna indietro. Quella proprieta' vale piu' della
 * comodita' di riusare il segno.
 *
 * Quindi a ogni telefono, quando si abbina, si danno **due cose diverse**:
 *
 *   - il **segno**, che serve a entrare. Il ponte ne tiene l'impronta. Chi
 *     ruba il file non entra.
 *   - la **chiave del filo**, che serve a cifrare. Quella il ponte la tiene
 *     com'e', perche' per cifrare serve la chiave e non la sua impronta.
 *
 * Chi rubasse il file avrebbe la seconda e non la prima: potrebbe leggere del
 * traffico che avesse gia' registrato, ma non potrebbe entrare in casa. Sono
 * due danni diversi, e tenerli separati e' il motivo per cui sono due cose.
 *
 * E siccome «potrebbe leggere del traffico registrato» resta brutto, a ogni
 * collegamento si mescola dentro anche uno scambio effimero: le chiavi di quel
 * momento vivono quanto il collegamento e poi spariscono. Chi rubasse il file
 * domani non potrebbe leggere quello che e' passato ieri.
 */

/* La chiave di un collegamento.
 *
 * Mescola tre cose, e ognuna copre un buco delle altre:
 *
 *   - lo **scambio effimero**: chi guarda passare non ricava niente, e chi
 *     ruba le chiavi conservate domani non legge quello di ieri;
 *   - un **segreto che il centralino non ha**: la chiave del filo, per un
 *     telefono gia' abbinato, o il codice, per uno che si sta abbinando. Chi
 *     si mettesse in mezzo per davvero non puo' fabbricarlo, e arriva a
 *     un'altra chiave;
 *   - l'**apertura**: sedici byte di caso a ogni collegamento, cosi' due
 *     collegamenti non riusano mai gli stessi nonce con la stessa chiave.
 *
 * Uno dei due segreti ci deve essere, e uno solo: senza, la chiave verrebbe
 * dal solo scambio effimero, che e' la stretta di mano di una volta e non
 * difende da chi sta in mezzo. Quella non si fabbrica piu', nemmeno per
 * sbaglio.
 */
export function chiaveDiSessione({
  miaPrivata,
  suaPubblica,
  delTelefono,
  dellaCasa,
  apertura,
  chiaveDelFilo = null,
  codice = null,
}) {
  if (Boolean(chiaveDelFilo) === Boolean(codice)) {
    throw new Error("serve la chiave del filo oppure il codice, e uno solo dei due");
  }
  const daLloScambio = diffieHellman({
    privateKey: miaPrivata,
    publicKey: createPublicKey({
      key: Buffer.isBuffer(suaPubblica) ? suaPubblica : Buffer.from(suaPubblica, "base64"),
      type: "spki",
      format: "der",
    }),
  });
  /* Il codice entra **ripulito** — maiuscole, niente spazi ne' trattini —
   * perche' le due punte lo devono scrivere allo stesso modo byte per byte,
   * ed e' il modo in cui lo ripuliscono tutte e due. */
  const segreto = chiaveDelFilo
    ? Buffer.from(chiaveDelFilo, "hex")
    : Buffer.from(codicePulito(codice), "utf8");
  const materia = Buffer.concat([daLloScambio, segreto]);
  /* Le due chiavi pubbliche entrano nel sale in un ordine fisso: cosi' le due
   * punte arrivano alla stessa chiave, e la chiave dipende da *quale* stretta
   * di mano e' stata. */
  const sale = Buffer.concat([
    Buffer.from(apertura),
    Buffer.from(delTelefono),
    Buffer.from(dellaCasa),
  ]);
  return Buffer.from(
    hkdfSync("sha256", materia, sale, chiaveDelFilo ? ETICHETTA_FILO : ETICHETTA_ABBINAMENTO, 32),
  );
}

/* Una chiave del filo nuova, da consegnare a un telefono che si abbina. */
export function chiaveDelFiloNuova() {
  return randomBytes(32).toString("hex");
}

export function aperturaNuova() {
  return randomBytes(16);
}

/* Una coppia di chiavi effimera. Vive quanto la stretta di mano e poi si
 * butta. */
export function coppiaEffimera() {
  const { publicKey, privateKey } = generateKeyPairSync("x25519");
  return {
    pubblica: publicKey.export({ type: "spki", format: "der" }),
    privata: privateKey,
  };
}

export function chiavePrivataDaDer(der) {
  return createPrivateKey({ key: der, type: "pkcs8", format: "der" });
}

/* ─── Chiudere e aprire ──────────────────────────────────────────────────── */

/* Una busta: cifra e conta.
 *
 * Ogni busta ha il suo contatore per direzione, e non torna mai indietro.
 * Se torna indietro, o salta avanti, il messaggio si rifiuta: quello e' un
 * messaggio rigiocato, e in un canale che passa da un terzo va rifiutato senza
 * pensarci.
 */
export class Busta {
  /* `comprime`: l'altra punta ha detto di saper aprire il gzip. Aprire lo
   * si sa sempre, da questa parte. */
  constructor(chiave, { io = "telefono", comprime = false } = {}) {
    this.chiave = chiave;
    this.mio = io === "casa" ? DA_CHI.casa : DA_CHI.telefono;
    this.suo = this.mio === DA_CHI.casa ? DA_CHI.telefono : DA_CHI.casa;
    this.comprime = comprime === true;
    this.mando = 0;
    this.ricevo = 0;
  }

  chiudi(testo) {
    const dodici = nonce(this.mio, this.mando);
    let dentro = Buffer.from(String(testo), "utf8");
    if (this.comprime && dentro.length >= SOGLIA_DI_COMPRESSIONE) {
      dentro = gzipSync(dentro, { level: LIVELLO_DI_COMPRESSIONE });
    }
    const cifratore = createCipheriv("aes-256-gcm", this.chiave, dodici);
    const cifrato = Buffer.concat([cifratore.update(dentro), cifratore.final()]);
    this.mando += 1;
    return Buffer.concat([dodici, cifrato, cifratore.getAuthTag()]).toString("base64");
  }

  /* Torna il testo, o solleva. Non torna mai `null` per un messaggio guasto:
   * un messaggio che non si apre su un canale cifrato non e' un inciampo da
   * ignorare — o e' rotto o e' stato toccato, e in tutti e due i casi si
   * chiude. */
  apri(base64) {
    const tutto = Buffer.from(String(base64), "base64");
    if (tutto.length < 12 + 16) throw new BustaGuasta("busta troppo corta");

    const dodici = tutto.subarray(0, 12);
    if (dodici[0] !== this.suo) throw new BustaGuasta("busta dalla direzione sbagliata");

    const contatore = Number(dodici.readBigUInt64BE(4));
    if (contatore !== this.ricevo) throw new BustaGuasta("busta fuori ordine");

    const marchio = tutto.subarray(tutto.length - 16);
    const dentro = tutto.subarray(12, tutto.length - 16);
    const decifratore = createDecipheriv("aes-256-gcm", this.chiave, dodici);
    decifratore.setAuthTag(marchio);
    let byte;
    try {
      byte = Buffer.concat([decifratore.update(dentro), decifratore.final()]);
    } catch (_errore) {
      throw new BustaGuasta("la busta non si apre");
    }
    /* Il marchio ha gia' detto che e' roba nostra: se e' compressa, si
     * scompatta. Con un tetto, perche' un gzip da venti chilobyte puo'
     * contenere gigabyte di niente. */
    if (eGzip(byte)) {
      try {
        byte = gunzipSync(byte, { maxOutputLength: APERTA_MASSIMA });
      } catch (_errore) {
        throw new BustaGuasta("la busta compressa non si apre");
      }
    }
    this.ricevo += 1;
    return byte.toString("utf8");
  }
}

export class BustaGuasta extends Error {}
