/* I gettoni delle prove, firmati con la coppia **di prova** del contratto.
 *
 * `docs/LICENZE.md` la scrive in chiaro apposta: serve a questo, e non deve
 * mai finire in un file di produzione. Qui sta in un file di prova, e le prove
 * la passano a chi verifica — `chiave:` al ponte, `chiaveLicenze:` al
 * centralino — invece di scriverla in `chiave-licenze.js`.
 */

import { createPrivateKey, generateKeyPairSync, sign } from "node:crypto";

export const PUBBLICA_DI_PROVA = "6P9sdqQtlHcmH7Ve_SgzmyJmxJS28CNORRJJfjI3rnI";
const PRIVATA_DI_PROVA = "Q2Iu3eKMxw3Y1GS9MypZjXvjPfHB959KImNldY80xr0";

const privata = createPrivateKey({
  key: { kty: "OKP", crv: "Ed25519", x: PUBBLICA_DI_PROVA, d: PRIVATA_DI_PROVA },
  format: "jwk",
});

/* Un'altra chiave, per i gettoni firmati da qualcuno che non e' il quadro:
 * fatta dal caso a ogni giro, che e' tutto quello che serve. */
const estranea = generateKeyPairSync("ed25519").privateKey;

const GIORNO = 24 * 60 * 60 * 1000;

/* Un gettone come lo fa il quadro. Quello che non si dice prende il valore
 * di una licenza gdahome regalata per sempre, con un gettone da otto giorni. */
export function unGettone(dentro = {}, { adesso = Date.now(), firmatoDa = "quadro" } = {}) {
  const detto = {
    v: 1,
    app: "gdahome",
    sog: "casa_00000000000000000000000000000000",
    lic: "lic_prova",
    origine: "regalo",
    scade: null,
    fino: adesso + 8 * GIORNO,
    emesso: adesso,
    ...dentro,
  };
  const primo = Buffer.from(JSON.stringify(detto), "utf8").toString("base64url");
  const firma = sign(
    null,
    Buffer.from(primo, "ascii"),
    firmatoDa === "quadro" ? privata : estranea,
  ).toString("base64url");
  return `${primo}.${firma}`;
}

export { GIORNO };
