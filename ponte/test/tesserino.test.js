/* Le prove del tesserino.
 *
 * Quello che si prova davvero: che una firma di gdahome si riconosca, e che
 * **tutto il resto non passi**. Un controllo di licenza si giudica da quello
 * che rifiuta, non da quello che accetta: accettare un tesserino buono lo fa
 * anche una funzione che torna sempre `true`.
 *
 * Le chiavi qui se le fa la prova. Quella vera non sta nella repository, e una
 * prova che avesse bisogno del segreto di qualcuno per girare sarebbe una
 * prova che non gira.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";

import { leggiIlTesserino, TesserinoNoNo, verificaIlTesserino } from "../src/tesserino.js";

const GIORNO = 24 * 60 * 60 * 1000;
const ADESSO = Date.parse("2026-09-18T12:00:00Z");

/** Un albo finto: una coppia di chiavi, e di che firmare tesserini. */
function unAlbo() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const inRiga = publicKey.export({ type: "spki", format: "der" }).toString("base64url");
  return {
    chiavi: [inRiga],
    fai({
      chi = "rossi",
      dove = "quadro.impiantirossi.it",
      soglia = 40,
      fino = "2027-03-01",
    } = {}) {
      const firmato = Buffer.from(JSON.stringify({ i: chi, d: dove, s: soglia, f: fino })).toString(
        "base64url",
      );
      const firma = sign(null, Buffer.from(firmato, "ascii"), privateKey).toString("base64url");
      return `${firmato}.${firma}`;
    },
  };
}

const QUADRO = "https://quadro.impiantirossi.it";

test("un tesserino firmato dall'albo vale per il suo quadro", () => {
  const albo = unAlbo();
  const detto = verificaIlTesserino(albo.fai(), {
    dove: QUADRO,
    adesso: ADESSO,
    chiavi: albo.chiavi,
  });
  assert.equal(detto.chi, "rossi");
  assert.equal(detto.dove, "quadro.impiantirossi.it");
  assert.equal(detto.soglia, 40);
  assert.equal(detto.fino, "2027-03-01");
});

test("il tesserino di un installatore non vale nel quadro di un altro", () => {
  /* La riga che rende un tesserino una cosa sua. Senza, il tesserino di Rossi
   * — che passa in chiaro dentro ogni codice che genera — funzionerebbe nel
   * quadro di chiunque l'abbia visto una volta. */
  const albo = unAlbo();
  assert.throws(
    () =>
      verificaIlTesserino(albo.fai({ dove: "quadro.impiantirossi.it" }), {
        dove: "https://quadro.impiantibianchi.it",
        adesso: ADESSO,
        chiavi: albo.chiavi,
      }),
    (male) =>
      male instanceof TesserinoNoNo && /non per quadro\.impiantibianchi\.it/.test(male.message),
  );
});

test("la porta non conta: un quadro dietro a :8443 e' sempre la sua macchina", () => {
  const albo = unAlbo();
  const detto = verificaIlTesserino(albo.fai(), {
    dove: "https://quadro.impiantirossi.it:8443",
    adesso: ADESSO,
    chiavi: albo.chiavi,
  });
  assert.equal(detto.chi, "rossi");
});

test("un tesserino scaduto non vale piu'", () => {
  const albo = unAlbo();
  assert.throws(
    () =>
      verificaIlTesserino(albo.fai({ fino: "2026-09-17" }), {
        dove: QUADRO,
        adesso: ADESSO,
        chiavi: albo.chiavi,
      }),
    (male) => male instanceof TesserinoNoNo && /scaduto il 2026-09-17/.test(male.message),
  );
});

test("l'ultimo giorno vale tutto, non fino alla mezzanotte che lo apre", () => {
  /* «Fino al 18» vuol dire tutto il 18. E' come legge una scadenza chiunque, e
   * come non la legge quasi nessun programma. */
  const albo = unAlbo();
  const detto = verificaIlTesserino(albo.fai({ fino: "2026-09-18" }), {
    dove: QUADRO,
    adesso: ADESSO,
    chiavi: albo.chiavi,
  });
  assert.equal(detto.fino, "2026-09-18");
  assert.throws(
    () =>
      verificaIlTesserino(albo.fai({ fino: "2026-09-18" }), {
        dove: QUADRO,
        adesso: ADESSO + GIORNO,
        chiavi: albo.chiavi,
      }),
    TesserinoNoNo,
  );
});

test("un tesserino firmato da qualcun altro non passa", () => {
  const albo = unAlbo();
  const abusivo = unAlbo();
  assert.throws(
    () => verificaIlTesserino(abusivo.fai(), { dove: QUADRO, adesso: ADESSO, chiavi: albo.chiavi }),
    (male) => male instanceof TesserinoNoNo && /non e' di gdahome/.test(male.message),
  );
});

test("cambiare una cifra in quello che dice invalida la firma", () => {
  /* La prova che conta piu' di tutte: se si potesse alzare la soglia da 40 a
   * 400 ricopiando la firma, il tesserino non sarebbe un tesserino ma una
   * decorazione. */
  const albo = unAlbo();
  const buono = albo.fai({ soglia: 40 });
  const [detto, firma] = buono.split(".");
  const dentro = JSON.parse(Buffer.from(detto, "base64url").toString("utf8"));
  dentro.s = 400;
  const gonfiato = `${Buffer.from(JSON.stringify(dentro)).toString("base64url")}.${firma}`;

  assert.throws(
    () => verificaIlTesserino(gonfiato, { dove: QUADRO, adesso: ADESSO, chiavi: albo.chiavi }),
    (male) => male instanceof TesserinoNoNo && /non e' di gdahome/.test(male.message),
  );
});

test("una chiave vecchia continua a valere finche' non si toglie", () => {
  /* Il giorno che la chiave privata va cambiata, i tesserini in giro devono
   * restare buoni fino alla loro scadenza: si firma con la nuova e si tiene la
   * vecchia nella lista. */
  const vecchio = unAlbo();
  const nuovo = unAlbo();
  const tutte = [...nuovo.chiavi, ...vecchio.chiavi];

  for (const albo of [vecchio, nuovo]) {
    const detto = verificaIlTesserino(albo.fai(), { dove: QUADRO, adesso: ADESSO, chiavi: tutte });
    assert.equal(detto.chi, "rossi");
  }
});

test("un ponte senza nessuna chiave dice che e' lui a non poter giudicare", () => {
  /* E non «tesserino non valido»: e' un guasto di chi ha costruito l'add-on,
   * non di chi ha incollato il codice, e mandare l'installatore a rigenerare
   * codici buoni sarebbe una caccia al fantasma. */
  const albo = unAlbo();
  assert.throws(
    () => verificaIlTesserino(albo.fai(), { dove: QUADRO, adesso: ADESSO, chiavi: [] }),
    (male) => male instanceof TesserinoNoNo && /non ha nessuna chiave dell'albo/.test(male.message),
  );
});

test("quello che non e' un tesserino si riconosce senza esplodere", () => {
  const albo = unAlbo();
  const come = { dove: QUADRO, adesso: ADESSO, chiavi: albo.chiavi };
  for (const roba of ["", "   ", "senzapunto", "a.b.c", "non-base64url.firma", ".", "a."]) {
    assert.throws(() => verificaIlTesserino(roba, come), TesserinoNoNo, `con «${roba}»`);
  }
});

test("una chiave scritta storta nell'add-on non fa cadere il ponte", () => {
  /* Si comporta come una chiave che non torna, e le altre si provano lo
   * stesso: un carattere perso in un copia-incolla non deve spegnere l'albo
   * intero. */
  const albo = unAlbo();
  const detto = verificaIlTesserino(albo.fai(), {
    dove: QUADRO,
    adesso: ADESSO,
    chiavi: ["questa-non-e-una-chiave", ...albo.chiavi],
  });
  assert.equal(detto.chi, "rossi");
});

test("si puo' leggere un tesserino senza crederci, e si vede che e' un'altra cosa", () => {
  /* `leggiIlTesserino` spacchetta e basta: quello che torna e' leggibile, non
   * vero. Sono due funzioni diverse apposta, e quella che crede si chiama
   * «verifica». */
  const albo = unAlbo();
  const chiunque = unAlbo();
  const letto = leggiIlTesserino(chiunque.fai({ chi: "chiunque" }));
  assert.equal(letto.chi, "chiunque");
  assert.throws(
    () =>
      verificaIlTesserino(chiunque.fai({ chi: "chiunque" }), {
        dove: QUADRO,
        adesso: ADESSO,
        chiavi: albo.chiavi,
      }),
    TesserinoNoNo,
  );
});
