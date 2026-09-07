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
 * sta per consegnare. Li' si fa uno scambio di chiavi effimero (X25519): il
 * centralino vede passare due chiavi pubbliche e non puo' ricavarne il
 * segreto condiviso. Un centralino che *guarda* non capisce niente.
 *
 * Il limite, detto chiaro perche' vada scritto e non scoperto: un centralino
 * riscritto per **attaccare** — non che guarda, ma che si mette in mezzo —
 * potrebbe intromettersi nell'abbinamento di un telefono nuovo. I telefoni
 * gia' abbinati restano al sicuro comunque, perche' il loro segno non e' mai
 * passato di li'. La strada per chiudere anche quella e' il codice mostrato
 * come QR: duecentocinquantasei bit invece di otto lettere, e l'attacco non
 * ha piu' niente da indovinare.
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

/* Il numero di versione viaggia in chiaro nella prima riga. Serve a poter
 * cambiare idea fra qualche anno senza che le due punte si fraintendano in
 * silenzio: chi non riconosce la versione dice di no invece di provarci. */
export const VERSIONE = 1;

const ETICHETTA_FILO = "gdahome/filo/v1";
const ETICHETTA_ABBINAMENTO = "gdahome/abbinamento/v1";

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
 *   - la **chiave del filo**: chi si mettesse in mezzo per davvero non puo'
 *     fabbricarla, perche' non ce l'ha. Nell'abbinamento non c'e' ancora, e
 *     li' quella difesa manca — e' scritto in cima al file;
 *   - l'**apertura**: sedici byte di caso a ogni collegamento, cosi' due
 *     collegamenti non riusano mai gli stessi nonce con la stessa chiave.
 */
export function chiaveDiSessione({
  miaPrivata,
  suaPubblica,
  delTelefono,
  dellaCasa,
  apertura,
  chiaveDelFilo = null,
}) {
  const daLloScambio = diffieHellman({
    privateKey: miaPrivata,
    publicKey: createPublicKey({
      key: Buffer.isBuffer(suaPubblica) ? suaPubblica : Buffer.from(suaPubblica, "base64"),
      type: "spki",
      format: "der",
    }),
  });
  const materia = chiaveDelFilo
    ? Buffer.concat([daLloScambio, Buffer.from(chiaveDelFilo, "hex")])
    : daLloScambio;
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

/* Una coppia di chiavi effimera per l'abbinamento. Vive quanto la stretta di
 * mano e poi si butta. */
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
  constructor(chiave, { io = "telefono" } = {}) {
    this.chiave = chiave;
    this.mio = io === "casa" ? DA_CHI.casa : DA_CHI.telefono;
    this.suo = this.mio === DA_CHI.casa ? DA_CHI.telefono : DA_CHI.casa;
    this.mando = 0;
    this.ricevo = 0;
  }

  chiudi(testo) {
    const dodici = nonce(this.mio, this.mando);
    const cifratore = createCipheriv("aes-256-gcm", this.chiave, dodici);
    const dentro = Buffer.concat([
      cifratore.update(Buffer.from(String(testo), "utf8")),
      cifratore.final(),
    ]);
    this.mando += 1;
    return Buffer.concat([dodici, dentro, cifratore.getAuthTag()]).toString("base64");
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
    let testo;
    try {
      testo = Buffer.concat([decifratore.update(dentro), decifratore.final()]).toString("utf8");
    } catch (_errore) {
      throw new BustaGuasta("la busta non si apre");
    }
    this.ricevo += 1;
    return testo;
  }
}

export class BustaGuasta extends Error {}
