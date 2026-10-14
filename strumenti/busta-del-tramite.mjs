/* La busta del tramite: un segreto che va da GitHub alla macchina del
 * tramite, senza che la macchina apra una porta e senza che passi in chiaro.
 *
 * La macchina del tramite non si fa raggiungere: e' lei che va a vedere, ogni
 * dieci minuti, a quale commit sta il segno `tramite` (`centralino/accendi.sh`).
 * Quindi il bottone «Il tramite» (`.github/workflows/il-tramite.yml`) non le
 * puo' consegnare niente — puo' solo lasciare qualcosa **dove lei guarda**: nel
 * messaggio del segno.
 *
 * Quel messaggio e' pubblico come la repository. Allora quello che ci va
 * dentro e' chiuso per la macchina e per nessun altro: la macchina ha una
 * chiave X25519 sua, fatta da `accendi.sh` e mai uscita da `/etc/tramite`, e
 * della quale GitHub conosce solo la meta' pubblica (la variabile
 * `TRAMITE_CHIAVE_DELLA_BUSTA`). Si fa uno scambio effimero con quella, se ne
 * ricava una chiave con HKDF, e si chiude con AES-256-GCM. E' lo stesso modo
 * in cui GitHub stesso chiude i segreti che gli si danno.
 *
 * Oggi ci va dentro una cosa sola: il conto di servizio di Firebase, con cui il
 * tramite manda le notifiche ai telefoni (`centralino/src/spinte.js`).
 *
 * Si usa cosi', dal bottone:
 *
 *     BUSTA_DENTRO="$segreto" CHIAVE_DELLA_MACCHINA="$pubblica" \
 *       node strumenti/busta-del-tramite.mjs chiudi > busta.txt
 *
 * Il segreto arriva da una variabile e non da un argomento: la riga di comando
 * la legge chiunque sia sulla macchina. E non si scrive mai: esce solo chiuso.
 *
 * Dalla parte della macchina la apre `apri-la-busta.mjs`, che `accendi.sh`
 * scrive in `/opt/tramite` e che fa lo stesso conto all'incontrario. Le due
 * meta' le prova insieme `centralino/test/busta-del-tramite.test.js`.
 */

import {
  createCipheriv,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
} from "node:crypto";
import { pathToFileURL } from "node:url";

export const ETICHETTA_DELLA_BUSTA = "gdahome/busta-del-tramite/v1";
export const INIZIO = "-----BEGIN GDAHOME BUSTA-----";
export const FINE = "-----END GDAHOME BUSTA-----";

/* Le chiavi X25519 nude sono trentadue byte; `node:crypto` le vuole vestite
 * da SPKI, che sono quei trentadue con dodici byte fissi davanti. */
const VESTITO_SPKI = Buffer.from("302a300506032b656e032100", "hex");

export function pubblicaDaNuda(nuda) {
  const byte = Buffer.from(String(nuda).trim(), "base64");
  if (byte.length !== 32) throw new Error("la chiave della macchina non e' una chiave X25519");
  return createPublicKey({ key: Buffer.concat([VESTITO_SPKI, byte]), format: "der", type: "spki" });
}

export const nudaDaPubblica = (pubblica) =>
  pubblica.export({ format: "der", type: "spki" }).subarray(VESTITO_SPKI.length);

/* Chiude `testo` per la macchina che ha quella chiave pubblica (32 byte in
 * base64). Torna il blocco da mettere nel messaggio del segno. */
export function chiudiPerLaMacchina(testo, chiaveDellaMacchina) {
  const macchina = pubblicaDaNuda(chiaveDellaMacchina);
  const effimera = generateKeyPairSync("x25519");
  const comune = diffieHellman({ privateKey: effimera.privateKey, publicKey: macchina });
  const sua = nudaDaPubblica(effimera.publicKey);
  const chiave = Buffer.from(
    hkdfSync(
      "sha256",
      comune,
      Buffer.concat([sua, nudaDaPubblica(macchina)]),
      ETICHETTA_DELLA_BUSTA,
      32,
    ),
  );
  const nonce = randomBytes(12);
  const cifratore = createCipheriv("aes-256-gcm", chiave, nonce);
  cifratore.setAAD(Buffer.from(ETICHETTA_DELLA_BUSTA));
  const dato = Buffer.concat([
    cifratore.update(String(testo), "utf8"),
    cifratore.final(),
    cifratore.getAuthTag(),
  ]);
  const dentro = Buffer.from(
    JSON.stringify({
      v: 1,
      eff: sua.toString("base64"),
      nonce: nonce.toString("base64"),
      dato: dato.toString("base64"),
    }),
  ).toString("base64");
  return [INIZIO, ...(dentro.match(/.{1,64}/g) ?? []), FINE].join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , cosa] = process.argv;
  if (cosa !== "chiudi") {
    process.stderr.write("si usa: node strumenti/busta-del-tramite.mjs chiudi\n");
    process.exit(2);
  }
  const dentro = process.env.BUSTA_DENTRO || "";
  const macchina = process.env.CHIAVE_DELLA_MACCHINA || "";
  if (!dentro || !macchina) {
    process.stderr.write("mancano BUSTA_DENTRO o CHIAVE_DELLA_MACCHINA\n");
    process.exit(2);
  }
  try {
    JSON.parse(dentro);
  } catch (_errore) {
    /* Del segreto non si dice niente: solo che non e' un JSON. */
    process.stderr.write("quello da chiudere non e' un JSON\n");
    process.exit(1);
  }
  process.stdout.write(`${chiudiPerLaMacchina(dentro, macchina)}\n`);
}
