#!/usr/bin/env node
/* Fa le chiavi dell'albo, e firma i tesserini.
 *
 * Finche' gli installatori sono dieci, l'albo si tiene su un foglio e i
 * tesserini si firmano da qui. Il server verra' dopo, e firmera' con lo stesso
 * pezzo di programma — questo strumento e' il pezzo che conta, non un
 * provvisorio da buttare.
 *
 * ─── La chiave privata non entra nella repository ────────────────────────
 *
 * Mai. E' l'unico segreto di tutto l'albo: chi ce l'ha firma tesserini a nome
 * di gdahome, e nessun ponte al mondo se ne accorge. Sta in un file suo, fuori
 * dalla cartella del programma, e si passa di qui con `ALBO_CHIAVE` o con
 * `--chiave`.
 *
 * Non si passa mai sulla riga di comando **il contenuto** della chiave: la
 * riga di comando la legge chiunque abbia un terminale su quella macchina, e
 * resta scritta nella storia della shell. Si passa il **percorso** del file.
 *
 *   node albo/strumenti/firma.mjs chiavi --scrivi
 *
 *       Fa una coppia nuova. Scrive la privata dove si dice (`--dentro`, di
 *       serie `./albo-chiave-privata.pem`) e con `--scrivi` mette la pubblica
 *       in `ponte/src/tesserino.js`, dove il ponte la va a leggere.
 *
 *   node albo/strumenti/firma.mjs tesserino --chi rossi \
 *        --dove quadro.impiantirossi.it --soglia 40 --mesi 3
 *
 *       Stampa il tesserino, e la riga intera da incollare se gli si da'
 *       anche `--chiave-del-quadro`.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { createPrivateKey, generateKeyPairSync, sign } from "node:crypto";

const detto = leggiLaRiga(process.argv.slice(2));
const cosa = detto._[0] || "";

if (cosa === "chiavi") faiLeChiavi();
else if (cosa === "tesserino") faiIlTesserino();
else {
  console.error(
    "Si usa cosi':\n" +
      "  firma.mjs chiavi [--dentro <file.pem>] [--scrivi]\n" +
      "  firma.mjs tesserino --chi <nome> --dove <macchina> [--soglia N] [--mesi N]\n" +
      "                      [--chiave <file.pem>] [--chiave-del-quadro <CHIAVE>]\n",
  );
  process.exit(2);
}

function faiLeChiavi() {
  const dentro = detto.dentro || "./albo-chiave-privata.pem";
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");

  /* `0600`: la legge solo chi l'ha fatta. Una chiave privata scritta coi
   * permessi di serie su una macchina condivisa e' una chiave pubblica con
   * qualche passaggio in piu'. */
  writeFileSync(dentro, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });

  const pubblica = inRiga(publicKey);
  console.log(`La chiave privata sta in ${dentro}. Non finisca in nessuna repository.`);
  console.log(`La pubblica e': ${pubblica}`);

  if (!detto.scrivi) {
    console.log("\nVa messa in CHIAVI_DELL_ALBO, in ponte/src/tesserino.js.");
    console.log("Con --scrivi ce la mette questo strumento.");
    return;
  }

  const dove = new URL("../../ponte/src/tesserino.js", import.meta.url);
  const testo = readFileSync(dove, "utf8");
  /* In **cima** alla lista, non in fondo: si firma sempre con la piu' nuova, e
   * le vecchie restano sotto a tenere buoni i tesserini gia' in giro. */
  const dopo = testo.replace(
    /export const CHIAVI_DELL_ALBO = \[([\s\S]*?)\];/,
    (_tutto, dentroLaLista) => {
      const cEra = dentroLaLista.trim();
      return `export const CHIAVI_DELL_ALBO = [\n  "${pubblica}",\n${cEra ? `  ${cEra}\n` : ""}];`;
    },
  );
  if (dopo === testo) {
    console.error("\nNon ho trovato CHIAVI_DELL_ALBO in ponte/src/tesserino.js: mettila a mano.");
    process.exit(1);
  }
  writeFileSync(dove, dopo);
  console.log("\nMessa in ponte/src/tesserino.js. Ricostruisca l'add-on.");
}

function faiIlTesserino() {
  const chi = String(detto.chi || "").trim();
  const dove = String(detto.dove || "")
    .trim()
    .toLowerCase();
  if (!chi || !dove) {
    console.error("Servono --chi e --dove. Il --dove e' la macchina del quadro, senza https://");
    process.exit(2);
  }
  if (dove.includes("/")) {
    console.error(`--dove e' un nome di macchina, non un indirizzo: «${dove.split("/")[0]}»`);
    process.exit(2);
  }

  const mesi = Number(detto.mesi) || 3;
  const fino = new Date(Date.now() + mesi * 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  /* I nomi dei campi sono di una lettera perche' questa roba finisce in una
   * riga che qualcuno incolla a mano in una casella di Home Assistant. */
  const detto_ = { i: chi, d: dove, s: Number(detto.soglia) || 0, f: fino };
  const firmato = Buffer.from(JSON.stringify(detto_), "utf8").toString("base64url");
  const firma = sign(null, Buffer.from(firmato, "ascii"), laPrivata()).toString("base64url");
  const tesserino = `${firmato}.${firma}`;

  console.log(`${chi} · ${dove} · ${detto_.s || "senza"} soglia · fino al ${fino}\n`);
  console.log(tesserino);

  const chiaveDelQuadro = String(detto["chiave-del-quadro"] || "").trim();
  if (chiaveDelQuadro) {
    console.log(`\nLa riga intera, da incollare nella casella «quadro» dell'add-on:\n`);
    console.log(`quadro|2|https://${dove}|${chiaveDelQuadro}|${tesserino}`);
  }
}

function laPrivata() {
  const da = detto.chiave || process.env.ALBO_CHIAVE || "./albo-chiave-privata.pem";
  try {
    return createPrivateKey(readFileSync(da, "utf8"));
  } catch (errore) {
    console.error(`Non riesco a leggere la chiave privata da ${da}: ${errore.message}`);
    console.error(
      "Si passa con --chiave <file> o con ALBO_CHIAVE, e si fa con «firma.mjs chiavi».",
    );
    process.exit(1);
  }
}

/* Dichiarata, non assegnata a una costante: qui sopra la si chiama prima di
 * questa riga, e una `const` a quel punto non esiste ancora.
 *
 * Prende l'oggetto chiave che `generateKeyPairSync` da' gia' fatto e lo
 * esporta: passarlo per `createPublicKey` non si puo', perche' quello vuole
 * una chiave privata da cui ricavare la pubblica, non una pubblica. */
function inRiga(pubblica) {
  return pubblica.export({ type: "spki", format: "der" }).toString("base64url");
}

/* Un lettore di argomenti da venti righe invece di una dipendenza: qui si
 * leggono cinque opzioni, e una libreria per farlo andrebbe aggiornata per
 * sempre. */
function leggiLaRiga(argomenti) {
  const fuori = { _: [] };
  for (let i = 0; i < argomenti.length; i += 1) {
    const pezzo = argomenti[i];
    if (!pezzo.startsWith("--")) {
      fuori._.push(pezzo);
      continue;
    }
    const nome = pezzo.slice(2);
    const dopo = argomenti[i + 1];
    if (dopo === undefined || dopo.startsWith("--")) {
      fuori[nome] = true;
    } else {
      fuori[nome] = dopo;
      i += 1;
    }
  }
  return fuori;
}
