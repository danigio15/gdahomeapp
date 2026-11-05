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
 * E lo stesso per una gdanav della casa: il centralino la trova fra le gdanav
 * tolte, dice alla casa di ricontrollare, e la casa la perde al giro del
 * minuto — ma il fuori casa non si chiude, e una casa che ha ancora il suo
 * gdahome resta Premium com'era.
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

/* I tre pezzi veri: il quadro con la sua privata, il centralino che impone e
 * chiede le tolte proprio a quel quadro, e la casa — le sue licenze e il suo
 * filo, attaccati come in `ponte/src/index.js`.
 *
 * L'orologio delle licenze della casa si puo' spostare avanti: la casa non
 * richiede prima di quindici secondi dalla domanda di prima (`ANCORA_FRESCA`),
 * e la prova non li aspetta. */
async function iTrePezzi() {
  const cartella = mkdtempSync(join(tmpdir(), "revoca-subito-"));
  const casa = `casa_${randomBytes(16).toString("hex")}`;
  const segretoPerIlQuadro = randomBytes(32).toString("hex");
  const segretoPerIlCentralino = randomBytes(32).toString("hex");

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
  const diLaLicenza = () =>
    chiamata.diLaLicenza(licenze.gettonePerIlCentralino, licenze.gettoneGdanavPerIlCentralino);
  diLaLicenza();
  licenze.on("cambio", diLaLicenza);
  chiamata.alRicontrollo = () => licenze.richiamata();
  const richieste = [];
  const richiamata = licenze.richiamata.bind(licenze);
  licenze.richiamata = () => {
    richieste.push(Date.now());
    richiamata();
  };

  /* Un regalo dalla Gestione, e torna la sua licenza. */
  const regala = async (app) => {
    const regalo = await gestore("/licenze", "POST", { app, casa, mesi: 12 });
    assert.equal(regalo.stato, 200);
    return regalo.detto.licenza;
  };
  const telefoni = [];
  return {
    casa,
    gestore,
    regala,
    revoche,
    centralino,
    licenze,
    chiamata,
    orologio,
    richieste,
    telefono: () => {
      const uno = unTelefono(`${alCentralino}/telefono/${casa}`);
      telefoni.push(uno);
      return uno;
    },
    spegni: async () => {
      for (const uno of telefoni) uno.chiudi();
      chiamata.spegni();
      licenze.ferma();
      centralino.chiudiTutto();
      await new Promise((ok) => server.close(ok));
      await quadro.spegni();
      rmSync(cartella, { recursive: true, force: true });
    },
  };
}

test("revocata dalla Gestione: il fuori casa si chiude e la casa torna Base, senza aspettare", async () => {
  const b = await iTrePezzi();
  const { casa, centralino, licenze, chiamata, revoche, richieste } = b;
  try {
    /* 1. Il regalo, e la casa Premium anche per il centralino. */
    const lic = await b.regala("gdahome");
    await licenze.rinnova();
    assert.equal(licenze.premium, true);
    chiamata.avvia();
    await attendi(() => chiamata.dentro && centralino.ePremium(casa));

    const telefono = b.telefono();
    await attendi(() => chiamata.canali.size === 1);
    assert.equal(telefono.eChiuso(), false);

    /* 2. «Revoca». */
    b.orologio.avanti = 60 * 1000;
    assert.equal((await b.gestore(`/licenze/${lic}`, "DELETE")).stato, 200);

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
    const dopo = b.telefono();
    assert.deepEqual(await dopo.chiusa, PREMIUM_RICHIESTO);
  } finally {
    await b.spegni();
  }
});

test("gdanav revocata dalla Gestione: la casa la perde al giro del minuto", async () => {
  const b = await iTrePezzi();
  const { casa, centralino, licenze, chiamata, revoche, richieste } = b;
  try {
    /* Una casa con gdanav e basta: il pianificatore dei viaggi e' aperto
     * (`Viaggi.sbloccato` guarda `licenze.gdanav`), il fuori casa no. */
    const lic = await b.regala("gdanav");
    await licenze.rinnova();
    assert.equal(licenze.gdanav, true);
    assert.equal(licenze.premium, false);
    chiamata.avvia();
    /* La casa la dice al centralino accanto al gettone gdahome, che e' vuoto. */
    await attendi(() => chiamata.dentro && centralino.gdanavDi.get(casa) === lic);
    assert.equal(centralino.ePremium(casa), false);

    b.orologio.avanti = 60 * 1000;
    assert.equal((await b.gestore(`/licenze/${lic}`, "DELETE")).stato, 200);

    /* Il giro del minuto: e' fra le gdanav tolte, non fra le gdahome. */
    assert.equal(await revoche.aggiorna(), true);
    assert.equal(revoche.toltaGdanav(lic), true);
    assert.equal(revoche.tolta(lic), false);

    /* La casa ricontrolla, e il quadro la gdanav non gliela da' piu'. */
    await attendi(() => richieste.length === 1);
    await attendi(() => licenze.gdanav === false);
    assert.deepEqual(licenze.stato().gettoni, {});
    assert.equal(licenze.stato().gdanav.attiva, false);
    /* E lo ridice al centralino: la gdanav non c'e' piu' nemmeno li'. */
    await attendi(() => !centralino.gdanavDi.has(casa));
  } finally {
    await b.spegni();
  }
});

test("gdanav revocata a una casa che tiene gdahome: gdahome non si tocca", async () => {
  const b = await iTrePezzi();
  const { casa, centralino, licenze, chiamata, revoche, richieste } = b;
  try {
    const home = await b.regala("gdahome");
    const nav = await b.regala("gdanav");
    await licenze.rinnova();
    assert.equal(licenze.premium, true);
    assert.equal(licenze.stato().gdanav.compresa, false, "la gdanav e' la sua");
    chiamata.avvia();
    await attendi(
      () => chiamata.dentro && centralino.ePremium(casa) && centralino.gdanavDi.get(casa) === nav,
    );
    const telefono = b.telefono();
    await attendi(() => chiamata.canali.size === 1);

    b.orologio.avanti = 60 * 1000;
    assert.equal((await b.gestore(`/licenze/${nav}`, "DELETE")).stato, 200);
    assert.equal(await revoche.aggiorna(), true);
    assert.equal(revoche.toltaGdanav(nav), true);
    assert.equal(revoche.tolta(home), false);

    /* La casa ricontrolla e il gettone gdanav se ne va... */
    await attendi(() => richieste.length === 1);
    await attendi(() => licenze.stato().gettoni.gdanav === undefined);
    await attendi(() => !centralino.gdanavDi.has(casa));
    /* ...ma gdahome resta: Premium in casa, gdanav compreso, e il telefono da
     * fuori e' ancora dentro. Anche dopo il giro di controllo. */
    assert.equal(licenze.premium, true);
    assert.equal(licenze.gdanav, true);
    assert.equal(licenze.stato().gdanav.compresa, true);
    assert.equal(typeof licenze.stato().gettoni.gdahome, "string");
    centralino._giroDiControllo();
    await new Promise((ok) => setTimeout(ok, 50));
    assert.equal(telefono.eChiuso(), false);
    assert.equal(centralino.ePremium(casa), true);
    assert.equal(centralino.licenzaDi.get(casa), home);

    /* E un telefono nuovo da fuori entra. */
    const dopo = b.telefono();
    await attendi(() => chiamata.canali.size === 2);
    assert.equal(dopo.eChiuso(), false);
  } finally {
    await b.spegni();
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
  assert.match(GESTORE, /fatto: "Licenza revocata: il fuori casa si chiude entro un minuto"/);
  assert.match(GESTORE, /avvisa\(fatto\);/);
  /* Quella del negozio dice anche che al rinnovo torna. */
  assert.match(
    GESTORE,
    /`\$\{spiega\} È del negozio: se l'abbonamento è pagato, al rinnovo torna da sola\.`/,
  );
});

test("per gdanav la Gestione e il cruscotto dicono subito, e che il fuori casa non si chiude", () => {
  /* Una gdanav di una casa: entro un minuto, come la strada di sopra, e senza
   * toccare il fuori casa ne' GdAHome. Una di un telefono: la richiede GdANav
   * da se', ogni quarto d'ora e quando torna aperta. */
  assert.match(GESTORE, /tasto\.dataset\.app !== "gdanav"/);
  assert.match(GESTORE, /data-app="\$\{testo\(una\.app\)\}"/);
  assert.match(GESTORE, /startsWith\("tel_"\) \? " data-del-telefono"/);
  assert.match(
    GESTORE,
    /la casa perde GdANav Premium entro un minuto, appena ricontrolla\. Il fuori casa e GdAHome Premium, se la casa ce l'ha, restano come sono\./,
  );
  assert.match(
    GESTORE,
    /GdANav la perde appena ricontrolla, quando torna aperta e comunque entro un quarto d'ora\./,
  );
  assert.match(GESTORE, /fatto: "Licenza revocata: la casa perde GdANav entro un minuto"/);
  assert.match(
    CRUSCOTTO,
    /GdANav Premium: l'impianto lo perde entro un minuto, senza toccare il fuori casa né GdAHome Premium; un telefono lo perde appena GdANav ricontrolla, entro un quarto d'ora\./,
  );
  /* E nessuna delle due dice che per gdanav si aspettano le sei ore. */
  for (const pagina of [GESTORE, CRUSCOTTO]) assert.doesNotMatch(pagina, /GdANav[^.]*sei ore/);
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
