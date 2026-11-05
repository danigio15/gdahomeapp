/* La revoca dalla Gestione e' subito, per una casa collegata.
 *
 * «Sto revocando una licenza: dice dopo otto giorni, se la revoco deve essere
 * immediata». Lo e': otto giorni li tiene soltanto una casa senza internet,
 * col suo gettone firmato. Questa prova accende i tre pezzi veri, ognuno col
 * suo codice — il quadro, il centralino e il ponte di una casa — e fa la
 * strada intera, quella che fanno davvero:
 *
 *   1. il gestore regala Premium a una casa, la casa chiede il gettone al
 *      quadro, lo dice al centralino, e un telefono da fuori entra;
 *   2. il gestore preme «Revoca» (`DELETE /gestore/licenze/<lic>`);
 *   3. il centralino chiede al quadro le licenze tolte, al suo giro del
 *      minuto (`revoche.js`, qui chiamato a mano), e trova quella;
 *   4. il telefono da fuori esce subito, e la casa si sente dire
 *      `ricontrolla-licenza`;
 *   5. la casa richiede la licenza al quadro, che di gettoni non ne da' piu':
 *      la casa e' Base adesso, e lo ridice al centralino.
 *
 * Se uno dei pezzi smette di fare la sua parte, la scritta della Gestione
 * («smette di valere subito») torna a essere una bugia: qui si vede prima.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

import { alzaIlQuadro } from "../src/index.js";
import { Negozi } from "../src/negozi.js";
import { Case } from "../../centralino/src/case.js";
import { Centralino, PREMIUM_RICHIESTO } from "../../centralino/src/centralino.js";
import { Revoche } from "../../centralino/src/revoche.js";
import { costruisciIlServer } from "../../centralino/src/server.js";
import { Chiamata } from "../../ponte/src/chiamata.js";
import { Licenze as LicenzeDiCasa } from "../../ponte/src/licenze.js";

const QUI = dirname(fileURLToPath(import.meta.url));

/* La coppia **di prova** del contratto. Non va mai in un file di produzione. */
const PUBBLICA = "6P9sdqQtlHcmH7Ve_SgzmyJmxJS28CNORRJJfjI3rnI";
const PRIVATA = "Q2Iu3eKMxw3Y1GS9MypZjXvjPfHB959KImNldY80xr0";
const CHIAVE = "una-chiave-lunga-abbastanza-per-il-gestore";

const muto = { debug() {}, info() {}, attenzione() {}, errore() {} };

async function attendi(condizione, entro = 5000) {
  const fine = Date.now() + entro;
  while (Date.now() < fine) {
    if (await condizione()) return;
    await new Promise((ok) => setTimeout(ok, 10));
  }
  throw new Error("non e' successo in tempo");
}

function unTelefono(dove) {
  const presa = new WebSocket(dove);
  let finita = null;
  const chiusa = new Promise((ok) =>
    presa.addEventListener("close", (evento) => {
      finita = { codice: evento.code, motivo: evento.reason };
      ok(finita);
    }),
  );
  presa.addEventListener("error", () => {});
  return { chiusa, eChiuso: () => finita !== null, chiudi: () => presa.close() };
}

test("revocata dalla Gestione: il fuori casa si chiude e la casa torna Base, senza aspettare", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "revoca-subito-"));
  const casa = `casa_${randomBytes(16).toString("hex")}`;
  const segretoPerIlQuadro = randomBytes(32).toString("hex");
  const segretoPerIlCentralino = randomBytes(32).toString("hex");

  /* Il quadro, con la sua privata. */
  const quadro = await alzaIlQuadro({
    porta: 0,
    cartella: join(cartella, "quadro"),
    livello: "errore",
    chiaveDelGestore: CHIAVE,
    chiaveDelleLicenze: PRIVATA,
    negozi: new Negozi({ ambiente: {} }),
  });
  const alQuadro = `http://127.0.0.1:${quadro.porta}`;
  const gestore = async (via, metodo = "GET", corpo) => {
    const risposta = await fetch(`${alQuadro}/gestore${via}`, {
      method: metodo,
      headers: { authorization: `Bearer ${CHIAVE}`, "content-type": "application/json" },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    return { stato: risposta.status, detto: await risposta.json() };
  };

  /* Il centralino, che impone, e chiede le tolte proprio a quel quadro. */
  const revoche = new Revoche({
    dove: `${alQuadro}/v1/licenze/revocate`,
    chiave: PUBBLICA,
    registro: muto,
  });
  const centralino = new Centralino({
    case: new Case({ cartella: join(cartella, "centralino") }),
    chiaveLicenze: PUBBLICA,
    modoLicenze: "impone",
    revoche,
    registro: muto,
  });
  const server = costruisciIlServer({ centralino });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const alCentralino = `ws://127.0.0.1:${server.address().port}`;

  /* La casa: le sue licenze e il suo filo, attaccati come in `ponte/src/index.js`.
   * L'orologio delle licenze si puo' spostare avanti: la casa non richiede
   * prima di quindici secondi dalla domanda di prima (`ANCORA_FRESCA`), e la
   * prova non li aspetta. */
  const orologio = { avanti: 0 };
  const licenze = new LicenzeDiCasa({
    casa,
    segreto: () => segretoPerIlQuadro,
    cartella: join(cartella, "casa"),
    chiave: PUBBLICA,
    dove: alQuadro,
    adesso: () => Date.now() + orologio.avanti,
    registro: muto,
  });
  const chiamata = new Chiamata({
    dove: alCentralino,
    identita: { casa, segreto: segretoPerIlCentralino },
    portiere: { accogli() {} },
    registro: muto,
  });
  chiamata.diLaLicenza(licenze.gettonePerIlCentralino);
  licenze.on("cambio", () => chiamata.diLaLicenza(licenze.gettonePerIlCentralino));
  chiamata.alRicontrollo = () => licenze.richiamata();
  const richieste = [];
  const richiamata = licenze.richiamata.bind(licenze);
  licenze.richiamata = () => {
    richieste.push(Date.now());
    richiamata();
  };

  let telefono = null;
  try {
    /* 1. Il regalo, e la casa Premium anche per il centralino. */
    const regalo = await gestore("/licenze", "POST", { app: "gdahome", casa, mesi: 12 });
    assert.equal(regalo.stato, 200);
    const lic = regalo.detto.licenza;
    await licenze.rinnova();
    assert.equal(licenze.premium, true);
    chiamata.avvia();
    await attendi(() => chiamata.dentro && centralino.ePremium(casa));

    telefono = unTelefono(`${alCentralino}/telefono/${casa}`);
    await attendi(() => chiamata.canali.size === 1);
    assert.equal(telefono.eChiuso(), false);

    /* 2. «Revoca». */
    orologio.avanti = 60 * 1000;
    assert.equal((await gestore(`/licenze/${lic}`, "DELETE")).stato, 200);

    /* 3. Il giro del minuto del centralino. */
    assert.equal(await revoche.aggiorna(), true);
    assert.equal(revoche.tolta(lic), true);

    /* 4. Il telefono da fuori esce, e la casa ricontrolla. */
    assert.deepEqual(await telefono.chiusa, PREMIUM_RICHIESTO);
    assert.equal(centralino.ePremium(casa), false);
    await attendi(() => richieste.length === 1);

    /* 5. La casa ha richiesto, il quadro non ha dato gettoni: Base adesso.
     * E il centralino lo sa dalla casa, non solo dall'elenco. */
    await attendi(() => licenze.premium === false);
    assert.deepEqual(licenze.stato().gettoni, {});
    assert.equal(licenze.stato().ultima?.andata, true);
    await attendi(() => !centralino.premiumFino.has(casa));

    /* Un telefono che riprova da fuori resta fuori. */
    const dopo = unTelefono(`${alCentralino}/telefono/${casa}`);
    assert.deepEqual(await dopo.chiusa, PREMIUM_RICHIESTO);
  } finally {
    telefono?.chiudi();
    chiamata.spegni();
    licenze.ferma();
    centralino.chiudiTutto();
    await new Promise((ok) => server.close(ok));
    await quadro.spegni();
    rmSync(cartella, { recursive: true, force: true });
  }
});

/* E la Gestione lo dice: «subito», non «entro otto giorni». Gli otto giorni
 * restano detti, ma solo per quello che sono: la casa senza internet. */
const GESTORE = readFileSync(join(QUI, "..", "gestore", "index.html"), "utf8");
const CRUSCOTTO = readFileSync(join(QUI, "..", "console", "index.html"), "utf8");

test("la Gestione e il cruscotto dicono che la revoca e' subito", () => {
  for (const pagina of [GESTORE, CRUSCOTTO]) {
    assert.doesNotMatch(pagina, /smette di valere (<b>)?entro otto giorni/);
    assert.match(pagina, /smette di valere (<b>)?subito/);
    assert.match(pagina, /il fuori casa si chiude entro un minuto/);
    assert.match(
      pagina,
      /senza internet resta Premium finché non torna in rete, al massimo otto giorni/,
    );
  }
  assert.match(GESTORE, /avvisa\("Licenza revocata: il fuori casa si chiude entro un minuto"\)/);
  /* Quella del negozio dice anche che al rinnovo torna. */
  assert.match(
    GESTORE,
    /`\$\{LA_REVOCA\} È del negozio: se l'abbonamento è pagato, al rinnovo torna da sola\.`/,
  );
});

test("la spiegazione della conferma va a capo sotto la riga, in ogni elenco", () => {
  /* Stava accanto al testo, come una colonna, e il testo della riga si
   * stringeva a una lettera per riga (la schermata Licenze, a 790 px). */
  assert.match(GESTORE, /\.elenco > li\[data-spiega\] \{\s*flex-wrap: wrap;/);
  assert.match(GESTORE, /\.elenco > li\[data-spiega\] > \.spiega \{\s*flex-basis: 100%;/);
  /* E a tasto armato il testo tiene il suo posto: il tasto lungo va a capo. */
  assert.match(GESTORE, /\.elenco > li\.in-conferma > \.riga-testo \{\s*flex: 1 1 12rem;/);
  assert.match(GESTORE, /riga\?\.classList\.add\("in-conferma"\);/);
  assert.match(GESTORE, /riga\?\.classList\.remove\("in-conferma"\);/);
});
