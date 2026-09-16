/* Firma la plancia portata dentro l'add-on.
 *
 * `sigilla-la-plancia.mjs` scrive in `ORIGINE.json` l'impronta di ogni file e
 * un **sigillo**, che e' l'impronta della lista. Questo script firma il
 * sigillo con una chiave Ed25519 e scrive la firma accanto.
 *
 * A cosa serve, in una riga: chiunque puo' modificare la sua copia della
 * plancia e rifare le impronte, ma **non puo' rifare la firma**. Una copia
 * rimaneggiata resta «non firmata» per sempre, e il ponte lo scrive nella sua
 * console. Non impedisce niente a nessuno — rende una copia rimaneggiata
 * riconoscibile, che e' quello che serve quando si difende la paternita' di
 * un lavoro e non un incasso.
 *
 * ── Fabbricare la chiave, una volta sola ──────────────────────────────────
 *
 *     node strumenti/firma-la-plancia.mjs --fabbrica
 *
 * Stampa due cose. La **pubblica** va incollata in
 * `ponte/src/provenienza.js`, alla voce `CHIAVE_DI_CHI_PUBBLICA`: e' quella
 * che verifica, e sta dentro l'add-on di tutti. La **privata** va messa al
 * sicuro e non esce mai da li': su GitHub, in Impostazioni → Secrets and
 * variables → Actions, con nome `CHIAVE_DELLA_PLANCIA`.
 *
 * Se la privata si perde non si firma piu': se ne fabbrica un'altra e si
 * cambia la pubblica. Se la privata **esce**, chiunque puo' firmare copie a
 * nome tuo: allora si cambia subito, e le copie vecchie diventano non
 * firmate.
 *
 * ── Firmare ──────────────────────────────────────────────────────────────
 *
 *     CHIAVE_DELLA_PLANCIA="$(cat chiave.pem)" node strumenti/firma-la-plancia.mjs
 *
 * Si rilancia ogni volta che si aggiorna la plancia: sigillo nuovo, firma
 * nuova. Il modo giusto e' dentro il flusso che pubblica l'add-on, cosi' non
 * ci si deve pensare e la chiave non tocca mai un computer.
 */

import { generateKeyPairSync, sign } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { sigilloDi } from "../ponte/src/provenienza.js";

const QUI = dirname(fileURLToPath(import.meta.url));
const ORIGINE = join(dirname(QUI), "ponte", "plancia", "ORIGINE.json");

if (process.argv.includes("--fabbrica")) {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const pubblica = publicKey.export({ type: "spki", format: "pem" }).toString();
  const privata = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  process.stdout.write(
    "\n── La pubblica: incollala in ponte/src/provenienza.js ────────────────\n\n" +
      `export const CHIAVE_DI_CHI_PUBBLICA = \`${pubblica.trim()}\`;\n` +
      "\n── La privata: mettila nel segreto CHIAVE_DELLA_PLANCIA e cancellala ──\n" +
      "   da qui. Chi ce l'ha puo' firmare a nome tuo.\n\n" +
      `${privata}\n`,
  );
  process.exit(0);
}

const privata = process.env.CHIAVE_DELLA_PLANCIA;
if (!privata) {
  process.stderr.write(
    "Manca la chiave privata.\n" +
      '  CHIAVE_DELLA_PLANCIA="..." node strumenti/firma-la-plancia.mjs\n' +
      "Non ne hai una? node strumenti/firma-la-plancia.mjs --fabbrica\n",
  );
  process.exit(64);
}

const origine = JSON.parse(readFileSync(ORIGINE, "utf8"));
if (!origine.impronte || typeof origine.impronte !== "object") {
  process.stderr.write(
    "Questa plancia non porta le impronte dei suoi file: rilancia prima\n" +
      "  node strumenti/sigilla-la-plancia.mjs\n",
  );
  process.exit(65);
}

/* Il sigillo si ricalcola, non si prende per buono.
 *
 * Firmare quello che c'e' scritto vorrebbe dire firmare anche una lista che
 * col sigillo non torna, e sarebbe una firma che dice il falso. */
const sigillo = sigilloDi(origine.impronte);
if (sigillo !== String(origine.sigillo || "")) {
  process.stderr.write(
    `Il sigillo scritto non torna con le impronte (atteso ${sigillo.slice(0, 16)}…).\n` +
      "Rilancia sigilla-la-plancia.mjs.\n",
  );
  process.exit(65);
}

origine.firma = sign(null, Buffer.from(sigillo, "utf8"), privata).toString("base64");
writeFileSync(ORIGINE, `${JSON.stringify(origine, null, 2)}\n`);
process.stdout.write(
  `Firmata la plancia ${origine.versione || origine.commit.slice(0, 10)}, ` +
    `sigillo ${sigillo.slice(0, 16)}…\n`,
);
