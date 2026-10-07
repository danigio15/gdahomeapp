/* Le licenze della casa: il gettone, chi lo chiede al quadro, e i limiti di
 * gdahome Base.
 *
 * Il contratto sta in `docs/LICENZE.md`. Le prove qui dentro tengono tre cose:
 *
 *   - il gettone si verifica con le regole del contratto, e con nessun'altra;
 *   - la casa chiede i suoi gettoni al quadro con `{casa, segreto}` e basta, li
 *     tiene in `/data/licenze.json`, e un quadro che non risponde non le toglie
 *     niente;
 *   - **con la chiave vuota non cambia niente**: nessuna domanda al quadro,
 *     nessun limite. E' la riga che tiene in piedi tutte le altre prove.
 *
 * La chiave e' quella di prova del contratto, passata a mano: in
 * `chiave-licenze.js` non ci va.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { CHIAVE_PUBBLICA_LICENZE } from "../src/chiave-licenze.js";
import { leggiGettone, verificaGettone } from "../src/gettone.js";
import { codiceRegaloPulito, LicenzaNo, Licenze } from "../src/licenze.js";
import { Plance, PremiumRichiesto } from "../src/plance.js";
import { Commissioni } from "../src/commissioni.js";
import { GIORNO, PUBBLICA_DI_PROVA, unGettone } from "./gettoni-di-prova.js";

const CASA = "casa_0123456789abcdef0123456789abcdef";
const ADESSO = 1_760_000_000_000;
const ZITTO = { debug() {}, info() {}, attenzione() {}, errore() {} };

const vale = (gettone, altro = {}) =>
  verificaGettone(gettone, {
    chiave: PUBBLICA_DI_PROVA,
    sog: CASA,
    app: "gdahome",
    adesso: ADESSO,
    ...altro,
  });

function unPosto() {
  return mkdtempSync(join(tmpdir(), "licenze-"));
}

/* ─── Il gettone ─────────────────────────────────────────────────────────── */

test("con la chiave vuota le licenze sono spente, e nessun gettone vale", () => {
  /* Vuota oggi; il giorno che si accende, una pubblica vera. Mai quella di
   * prova dei documenti: con lei chiunque si firma da se' un gettone. */
  assert.ok(
    CHIAVE_PUBBLICA_LICENZE === "" || /^[A-Za-z0-9_-]{43}$/.test(CHIAVE_PUBBLICA_LICENZE),
    "la chiave del codice e' vuota o 32 byte in base64url",
  );
  assert.notEqual(CHIAVE_PUBBLICA_LICENZE, PUBBLICA_DI_PROVA);
  /* Un gettone firmato con la coppia di prova non vale con la chiave del
   * codice, qualunque sia; e con la chiave vuota non vale nemmeno uno buono. */
  const buono = unGettone({ sog: CASA }, { adesso: ADESSO });
  assert.equal(vale(buono, { chiave: CHIAVE_PUBBLICA_LICENZE }), null);
  assert.equal(vale(buono, { chiave: "" }), null);
  assert.equal(new Licenze({ casa: CASA, chiave: "" }).attive, false);
});

test("un gettone del quadro, per questa casa, vale; e dice cosa c'e' dentro", () => {
  const detto = vale(unGettone({ sog: CASA, origine: "negozio" }, { adesso: ADESSO }));
  assert.equal(detto.app, "gdahome");
  assert.equal(detto.origine, "negozio");
  assert.equal(detto.sog, CASA);
});

test("un gettone gdahome vale anche per gdanav, uno gdanav non vale per gdahome", () => {
  const gdahome = unGettone({ sog: CASA }, { adesso: ADESSO });
  const gdanav = unGettone({ sog: CASA, app: "gdanav" }, { adesso: ADESSO });
  assert.ok(vale(gdahome, { app: "gdanav" }));
  assert.ok(vale(gdanav, { app: "gdanav" }));
  assert.equal(vale(gdanav, { app: "gdahome" }), null);
});

test("le regole del contratto: soggetto, versione, fino, scade, firma", () => {
  const conQuesto = (dentro, altro) =>
    vale(unGettone({ sog: CASA, ...dentro }, { adesso: ADESSO, ...altro }));
  /* Di un'altra casa. */
  assert.equal(conQuesto({ sog: "casa_ffffffffffffffffffffffffffffffff" }), null);
  /* Una versione che non si conosce. */
  assert.equal(conQuesto({ v: 2 }), null);
  /* Il gettone e' finito, anche se la licenza no. */
  assert.equal(conQuesto({ fino: ADESSO }), null);
  assert.equal(conQuesto({ fino: ADESSO - 1 }), null);
  /* La licenza e' finita, anche se il gettone no. */
  assert.equal(conQuesto({ scade: ADESSO - GIORNO }), null);
  assert.equal(conQuesto({ scade: ADESSO }), null);
  /* `scade` che non e' ne' un numero ne' null non e' «per sempre». */
  assert.equal(conQuesto({ scade: "mai" }), null);
  assert.ok(conQuesto({ scade: ADESSO + GIORNO }));
  assert.ok(conQuesto({ scade: null }));
  /* Firmato da qualcuno che non e' il quadro. */
  assert.equal(conQuesto({}, { firmatoDa: "estraneo" }), null);
});

test("un gettone toccato non vale: ne' il payload ne' la firma", () => {
  const buono = unGettone({ sog: CASA }, { adesso: ADESSO });
  const [primo, firma] = buono.split(".");
  const altro = Buffer.from(
    JSON.stringify({ ...leggiGettone(buono), scade: null, origine: "negozio" }),
  ).toString("base64url");
  assert.equal(vale(`${altro}.${firma}`), null);
  assert.equal(vale(`${primo}.${firma.slice(0, -4)}AAAA`), null);
  assert.equal(vale(`${primo}.`), null);
  assert.equal(vale(`${primo}=.${firma}`), null);
  assert.equal(vale("niente"), null);
  assert.equal(vale(null), null);
  assert.equal(vale(buono, { chiave: "chiave-storta" }), null);
});

/* ─── Chi chiede al quadro ───────────────────────────────────────────────── */

/* Un quadro finto: risponde quello che gli si dice, e si ricorda cosa gli
 * hanno chiesto. */
function quadroFinto(risposte = {}) {
  const chieste = [];
  const fetch = async (dove, opzioni) => {
    const corpo = JSON.parse(opzioni.body);
    chieste.push({ dove, corpo, metodo: opzioni.method });
    const via = new URL(dove).pathname;
    const risposta = typeof risposte[via] === "function" ? risposte[via](corpo) : risposte[via];
    if (risposta instanceof Error) throw risposta;
    const { stato = 200, detto = {} } = risposta ?? { stato: 404, detto: { errore: "via" } };
    return { ok: stato >= 200 && stato < 300, status: stato, json: async () => detto };
  };
  return { fetch, chieste };
}

function leLicenze({ cartella = "", risposte = {}, chiave = PUBBLICA_DI_PROVA, adesso } = {}) {
  const quadro = quadroFinto(risposte);
  const licenze = new Licenze({
    casa: CASA,
    segreto: () => "s".repeat(64),
    cartella,
    chiave,
    dove: "https://quadro.prova",
    fetch: quadro.fetch,
    adesso: adesso ?? (() => ADESSO),
    registro: ZITTO,
  });
  return { licenze, quadro };
}

const conGettoni = (gettoni, licenze = []) => ({ stato: 200, detto: { gettoni, licenze } });

test("la casa chiede i suoi gettoni con casa e segreto, e basta", async () => {
  const { licenze, quadro } = leLicenze({
    risposte: {
      "/v1/licenze/casa": conGettoni({ gdahome: unGettone({ sog: CASA }, { adesso: ADESSO }) }),
    },
  });
  await licenze.rinnova();
  assert.equal(quadro.chieste.length, 1);
  assert.equal(quadro.chieste[0].dove, "https://quadro.prova/v1/licenze/casa");
  assert.equal(quadro.chieste[0].metodo, "POST");
  assert.deepEqual(quadro.chieste[0].corpo, { casa: CASA, segreto: "s".repeat(64) });
  assert.equal(licenze.premium, true);
  assert.equal(licenze.limitata, false);
});

test("lo stato per l'app ha la forma del contratto, e gdanav e' compreso", async () => {
  const scade = ADESSO + 30 * GIORNO;
  const gettone = unGettone({ sog: CASA, origine: "installatore", scade }, { adesso: ADESSO });
  const { licenze } = leLicenze({
    risposte: {
      "/v1/licenze/casa": conGettoni({ gdahome: gettone }, [
        { lic: "lic_1", app: "gdahome", origine: "installatore", scade },
      ]),
    },
  });
  await licenze.rinnova();
  const stato = licenze.stato();
  assert.equal(stato.attive, true);
  assert.deepEqual(
    { attiva: stato.gdahome.attiva, scade: stato.gdahome.scade, origine: stato.gdahome.origine },
    { attiva: true, scade, origine: "installatore" },
  );
  assert.equal(stato.gdanav.attiva, true);
  assert.equal(stato.gdanav.compresa, true);
  assert.deepEqual(stato.gettoni, { gdahome: gettone });
  assert.equal(stato.licenze[0].lic, "lic_1");
  assert.equal(stato.ultima.andata, true);
});

test("un abbonamento nei giorni del margine vale, e si scrive la fine del periodo pagato", async () => {
  /* Il periodo pagato e' finito ieri e il rinnovo non e' ancora arrivato: il
   * quadro da' il gettone fino a tre giorni dopo, e dice in `pagato` fino a
   * quando era pagato. La casa non fa niente di speciale: verifica `scade`
   * come sempre, e passa `pagato` a chi lo scrive. */
  const pagato = ADESSO - GIORNO;
  const gettone = unGettone(
    {
      sog: CASA,
      origine: "negozio",
      scade: pagato + 3 * GIORNO,
      fino: pagato + 3 * GIORNO,
      pagato,
    },
    { adesso: ADESSO - 2 * GIORNO },
  );
  const { licenze } = leLicenze({
    risposte: { "/v1/licenze/casa": conGettoni({ gdahome: gettone }) },
  });
  await licenze.rinnova();
  assert.equal(licenze.premium, true, "chi paga resta Premium mentre il rinnovo arriva");
  const stato = licenze.stato();
  assert.equal(stato.gdahome.attiva, true);
  assert.equal(stato.gdahome.pagato, pagato);
  assert.equal(stato.gdahome.scade, pagato + 3 * GIORNO);

  /* Un regalo il campo non ce l'ha. */
  const { licenze: regalo } = leLicenze({
    risposte: {
      "/v1/licenze/casa": conGettoni({ gdahome: unGettone({ sog: CASA }, { adesso: ADESSO }) }),
    },
  });
  await regalo.rinnova();
  assert.equal(regalo.stato().gdahome.pagato, null);
});

test("i gettoni stanno in licenze.json, e restano dopo un riavvio", async () => {
  const cartella = unPosto();
  try {
    const gettone = unGettone({ sog: CASA }, { adesso: ADESSO });
    const { licenze } = leLicenze({
      cartella,
      risposte: { "/v1/licenze/casa": conGettoni({ gdahome: gettone }) },
    });
    await licenze.rinnova();
    const scritto = JSON.parse(readFileSync(join(cartella, "licenze.json"), "utf8"));
    assert.equal(scritto.gettoni.gdahome, gettone);

    /* Riacceso, senza rete: e' Premium lo stesso, col gettone di prima. */
    const { licenze: dopo } = leLicenze({
      cartella,
      risposte: { "/v1/licenze/casa": new TypeError("fetch failed") },
    });
    assert.equal(dopo.premium, true);
    await dopo.rinnova();
    assert.equal(dopo.premium, true, "un quadro che non risponde non toglie niente");
    assert.equal(dopo.stato().ultima.andata, false);
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("un gettone che scade fa tornare Base senza che arrivi niente", async () => {
  let ora = ADESSO;
  const { licenze } = leLicenze({
    adesso: () => ora,
    risposte: {
      "/v1/licenze/casa": conGettoni({ gdahome: unGettone({ sog: CASA }, { adesso: ADESSO }) }),
    },
  });
  await licenze.rinnova();
  assert.equal(licenze.premium, true);
  ora = ADESSO + 9 * GIORNO;
  assert.equal(licenze.premium, false);
  /* Base, e la casa resta aperta lo stesso: i lucchetti non sono suoi. */
  assert.equal(licenze.limitata, false);
});

test("il gettone di un'altra casa non si tiene nemmeno sul disco", async () => {
  const { licenze } = leLicenze({
    risposte: {
      "/v1/licenze/casa": conGettoni({
        gdahome: unGettone({ sog: "casa_ffffffffffffffffffffffffffffffff" }, { adesso: ADESSO }),
      }),
    },
  });
  await licenze.rinnova();
  assert.deepEqual(licenze.gettoni, {});
  assert.equal(licenze.premium, false);
});

test("un gettone nuovo si annuncia: e' cosi' che il centralino lo riceve", async () => {
  let giro = 0;
  const { licenze } = leLicenze({
    risposte: {
      "/v1/licenze/casa": () => {
        giro += 1;
        return conGettoni({ gdahome: unGettone({ sog: CASA, emesso: giro }, { adesso: ADESSO }) });
      },
    },
  });
  const sentiti = [];
  licenze.on("cambio", (stato) => sentiti.push(stato));
  await licenze.rinnova();
  await licenze.rinnova();
  assert.equal(sentiti.length, 2, "ogni rinnovo porta un gettone nuovo, e si dice");
  assert.equal(sentiti[1].gdahome.attiva, true);
});

test("con la chiave vuota non parte niente e non si limita niente", async () => {
  const { licenze, quadro } = leLicenze({
    chiave: "",
    risposte: { "/v1/licenze/casa": conGettoni({}) },
  });
  licenze.parti();
  await licenze.rinnova();
  licenze.ferma();
  assert.equal(quadro.chieste.length, 0);
  assert.equal(licenze.attive, false);
  assert.equal(licenze.limitata, false);
  await assert.rejects(licenze.riscatta("GDA-AAAA-BBBB-CCCC"), (errore) => {
    assert.equal(errore.codice, "licenze-spente");
    return true;
  });
});

test("con la chiave la casa tiene la licenza e gira le ricevute, ma non limita niente", async () => {
  /* Base o Premium, la casa resta aperta: Home Assistant, le plance e i
   * telefoni che arrivano restano come sempre. I lucchetti di Base li mettono
   * l'app e il browser, leggendo la licenza da qui; il fuori casa lo chiude
   * il centralino. La casa fa la sua parte e basta: chi compra dall'app
   * diventa Premium davvero. */
  const gettone = unGettone({ sog: CASA, origine: "negozio" }, { adesso: ADESSO });
  const { licenze, quadro } = leLicenze({
    risposte: {
      "/v1/licenze/casa": conGettoni({}),
      "/v1/licenze/negozio": conGettoni({ gdahome: gettone }),
    },
  });
  await licenze.rinnova();
  assert.equal(quadro.chieste[0].dove, "https://quadro.prova/v1/licenze/casa");
  assert.equal(licenze.attive, true);
  assert.equal(licenze.premium, false);
  assert.equal(licenze.limitata, false, "con Base la casa non si limita");
  const base = licenze.stato();
  assert.equal(base.attive, true);
  assert.equal(base.limitata, false);
  assert.equal(base.gdahome.attiva, false);
  assert.equal("soloSullIPhone" in base, false);

  /* E la ricevuta dell'app arriva al quadro, e torna Premium. */
  const dopo = await licenze.negozio({
    app: "gdahome",
    piattaforma: "ios",
    prodotto: "gdahome_premium_mensile",
    ricevuta: "2000000123456789",
  });
  assert.equal(quadro.chieste[1].dove, "https://quadro.prova/v1/licenze/negozio");
  assert.equal(dopo.gdahome.attiva, true);
  assert.equal(licenze.premium, true);
  assert.equal(licenze.limitata, false);
});

test("un rinnovo lento non scavalca un acquisto: le domande al quadro vanno in fila", async () => {
  /* Il rinnovo di ogni sei ore parte, il quadro e' lento; intanto arriva la
   * ricevuta di chi ha appena pagato. Senza la fila la risposta del rinnovo —
   * partita prima dell'acquisto, coi gettoni di prima — arrivava dopo, e la
   * casa tornava Base fino al giro seguente. */
  const premium = unGettone({ sog: CASA, origine: "negozio" }, { adesso: ADESSO });
  let pagato = false;
  const { licenze, quadro } = leLicenze({
    risposte: {
      "/v1/licenze/casa": () => conGettoni(pagato ? { gdahome: premium } : {}),
      "/v1/licenze/negozio": () => {
        pagato = true;
        return conGettoni({ gdahome: premium });
      },
    },
  });
  /* Il quadro risponde al rinnovo subito — coi gettoni di prima, perche'
   * l'acquisto non c'e' ancora — ma la risposta ci mette un po' ad arrivare. */
  const fetchVero = licenze.prendi;
  licenze.prendi = async (dove, opzioni) => {
    const risposta = await fetchVero(dove, opzioni);
    if (dove.endsWith("/v1/licenze/casa")) await new Promise((ok) => setTimeout(ok, 40));
    return risposta;
  };
  const rinnovo = licenze.rinnova();
  const acquisto = licenze.negozio({
    app: "gdahome",
    piattaforma: "ios",
    prodotto: "gdahome_premium_mensile",
    ricevuta: "2000000123456789",
  });
  await Promise.all([rinnovo, acquisto]);
  assert.equal(licenze.premium, true, "il Premium appena pagato resta");
  assert.deepEqual(
    quadro.chieste.map((una) => new URL(una.dove).pathname),
    ["/v1/licenze/casa", "/v1/licenze/negozio"],
  );
});

test("un si' del quadro che non e' la sua risposta non toglie i gettoni", async () => {
  const gettone = unGettone({ sog: CASA }, { adesso: ADESSO });
  let giro = 0;
  const { licenze } = leLicenze({
    risposte: {
      "/v1/licenze/casa": () => {
        giro += 1;
        /* Il primo e' buono; il secondo e' un 200 senza gettoni, come lo
         * darebbe una pagina messa in mezzo da qualcuno. */
        return giro === 1 ? conGettoni({ gdahome: gettone }) : { stato: 200, detto: { ciao: 1 } };
      },
    },
  });
  await licenze.rinnova();
  assert.equal(licenze.premium, true);
  await licenze.rinnova();
  assert.equal(licenze.premium, true, "i gettoni di prima restano");
  assert.equal(licenze.stato().ultima.andata, false);
});

test("il codice regalo si accetta scritto come capita, e si manda giusto", async () => {
  assert.equal(codiceRegaloPulito("gda-abcd-efgh-jkmn"), "GDA-ABCD-EFGH-JKMN");
  assert.equal(codiceRegaloPulito(" GDA ABCD EFGH JKMN "), "GDA-ABCD-EFGH-JKMN");
  assert.equal(codiceRegaloPulito("GDAABCDEFGHJKMN"), "GDA-ABCD-EFGH-JKMN");
  /* Le lettere che si confondono non ci sono: un codice con dentro una O o
   * un 1 non e' un codice. */
  assert.equal(codiceRegaloPulito("GDA-OOOO-1111-IIII"), "");
  assert.equal(codiceRegaloPulito("GDA-ABCD-EFGH"), "");

  const gettone = unGettone({ sog: CASA, origine: "regalo" }, { adesso: ADESSO });
  const { licenze, quadro } = leLicenze({
    risposte: { "/v1/licenze/riscatta": conGettoni({ gdahome: gettone }) },
  });
  const stato = await licenze.riscatta("gda abcd efgh jkmn");
  assert.deepEqual(quadro.chieste[0].corpo, {
    codice: "GDA-ABCD-EFGH-JKMN",
    casa: CASA,
    segreto: "s".repeat(64),
  });
  assert.equal(stato.gdahome.attiva, true);
  assert.equal(stato.gdahome.origine, "regalo");
});

test("i no del quadro arrivano col loro codice", async () => {
  const { licenze } = leLicenze({
    risposte: {
      "/v1/licenze/riscatta": (corpo) =>
        corpo.codice === "GDA-AAAA-AAAA-AAAA"
          ? { stato: 404, detto: { errore: "codice-inesistente" } }
          : { stato: 409, detto: { errore: "gia-usato" } },
      "/v1/licenze/negozio": { stato: 402, detto: { errore: "ricevuta-non-valida" } },
    },
  });
  const conCodice = (codice) => (errore) => {
    assert.ok(errore instanceof LicenzaNo);
    assert.equal(errore.codice, codice);
    return true;
  };
  await assert.rejects(licenze.riscatta("GDA-AAAA-AAAA-AAAA"), conCodice("codice-inesistente"));
  await assert.rejects(licenze.riscatta("GDA-BBBB-BBBB-BBBB"), conCodice("codice-gia-usato"));
  await assert.rejects(licenze.riscatta("non e' un codice"), conCodice("codice-storto"));
  await assert.rejects(
    licenze.negozio({ app: "gdahome", piattaforma: "android", prodotto: "p", ricevuta: "r" }),
    conCodice("ricevuta-non-valida"),
  );
  await assert.rejects(
    licenze.negozio({ app: "gdahome", piattaforma: "windows", prodotto: "p", ricevuta: "r" }),
    conCodice("piattaforma-sconosciuta"),
  );
});

test("la ricevuta del negozio va al quadro con tutto quello che serve", async () => {
  const gettone = unGettone({ sog: CASA, origine: "negozio" }, { adesso: ADESSO });
  const { licenze, quadro } = leLicenze({
    risposte: { "/v1/licenze/negozio": conGettoni({ gdahome: gettone }) },
  });
  const stato = await licenze.negozio({
    app: "gdahome",
    piattaforma: "ios",
    prodotto: "gdahome_premium_annuale",
    ricevuta: "2000000123456789",
  });
  assert.deepEqual(quadro.chieste[0].corpo, {
    app: "gdahome",
    piattaforma: "ios",
    prodotto: "gdahome_premium_annuale",
    ricevuta: "2000000123456789",
    casa: CASA,
    segreto: "s".repeat(64),
  });
  assert.equal(stato.gdahome.attiva, true);
});

/* ─── I limiti di Base ───────────────────────────────────────────────────── */

test("con Base la seconda plancia non nasce; con Premium, o a licenze spente, si'", () => {
  const cartella = unPosto();
  try {
    let limitata = true;
    const plance = new Plance({ cartella, registro: ZITTO, limitata: () => limitata });
    assert.throws(
      () => plance.aggiungi("Casa al mare"),
      (errore) => errore instanceof PremiumRichiesto && errore.codice === "premium-richiesto",
    );
    assert.equal(plance.quante, 1);
    /* Nemmeno quella voluta dal cruscotto di chi installa. */
    assert.equal(plance._nasce("mare", "Mare"), false);

    limitata = false;
    assert.equal(plance.aggiungi("Casa al mare").titolo, "Casa al mare");

    /* E senza dire niente — com'e' con la chiave vuota — tutto come ieri. */
    const libere = new Plance({ cartella: unPosto(), registro: ZITTO });
    assert.equal(libere.aggiungi("Una").titolo, "Una");
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});

function commissioniCon({ limitata, cartella }) {
  const plance = new Plance({ cartella, registro: ZITTO, limitata: () => limitata });
  const plancia = {
    cE: true,
    descrizione: (quale) => ({ profilo: quale?.profilo ?? "primary" }),
  };
  const licenze = {
    limitata,
    stato: () => ({ attive: true, gdahome: { attiva: !limitata } }),
  };
  return { commissioni: new Commissioni({ plance, plancia, licenze, registro: ZITTO }), plance };
}

test("con Base l'app vede solo la plancia principale; dentro Home Assistant tutte", async () => {
  const cartella = unPosto();
  try {
    /* Due plance fatte quando la casa era Premium: restano sul disco. */
    const prima = commissioniCon({ limitata: false, cartella });
    prima.plance.aggiungi("Mare");
    const { commissioni } = commissioniCon({ limitata: true, cartella });

    const dallApp = { dalTelefono: true };
    const elenco = await commissioni.rispondi({ id: 1, type: "ponte/plance/elenco" }, dallApp);
    assert.deepEqual(
      elenco.result.plance.map((una) => una.profilo),
      ["primary"],
    );
    const laPlancia = await commissioni.rispondi({ id: 2, type: "ponte/plancia" }, dallApp);
    assert.deepEqual(
      laPlancia.result.plance.map((una) => una.profilo),
      ["primary"],
    );
    const laSeconda = await commissioni.rispondi(
      { id: 3, type: "ponte/plancia", profilo: "mare" },
      dallApp,
    );
    assert.equal(laSeconda.success, false);
    assert.equal(laSeconda.error.code, "premium-richiesto");

    /* Aggiungere: il no del contratto, anche a chi amministra. */
    const aggiunta = await commissioni.rispondi(
      { id: 4, type: "ponte/plance/aggiungi", titolo: "Monti" },
      { ...dallApp, puoAmministrare: true },
    );
    assert.equal(aggiunta.error.code, "premium-richiesto");

    /* Dentro Home Assistant le plance stanno fra le Dashboard: l'elenco e'
     * quello intero. */
    const inCasa = await commissioni.rispondi({ id: 5, type: "ponte/plance/elenco" });
    assert.deepEqual(
      inCasa.result.plance.map((una) => una.profilo),
      ["primary", "mare"],
    );
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("senza limiti l'app vede tutte le plance, com'era", async () => {
  const cartella = unPosto();
  try {
    const { commissioni, plance } = commissioniCon({ limitata: false, cartella });
    plance.aggiungi("Mare");
    const elenco = await commissioni.rispondi(
      { id: 1, type: "ponte/plance/elenco" },
      { dalTelefono: true },
    );
    assert.deepEqual(
      elenco.result.plance.map((una) => una.profilo),
      ["primary", "mare"],
    );
    const laSeconda = await commissioni.rispondi(
      { id: 2, type: "ponte/plancia", profilo: "mare" },
      { dalTelefono: true },
    );
    assert.equal(laSeconda.success, true);
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("ponte/licenza/* li chiede qualunque telefono abbinato, non solo chi amministra", async () => {
  const chiesti = [];
  const licenze = {
    limitata: true,
    stato: () => ({ attive: true, gdahome: { attiva: false } }),
    riscatta: async (codice) => {
      chiesti.push(codice);
      return { attive: true, gdahome: { attiva: true } };
    },
    negozio: async () => {
      throw new LicenzaNo("ricevuta-non-valida", "no", 402);
    },
  };
  const commissioni = new Commissioni({ licenze, registro: ZITTO });
  const chi = { dalTelefono: true, puoAmministrare: false };

  const stato = await commissioni.rispondi({ id: 1, type: "ponte/licenza/stato" }, chi);
  assert.equal(stato.success, true);
  assert.equal(stato.result.gdahome.attiva, false);

  const riscatto = await commissioni.rispondi(
    { id: 2, type: "ponte/licenza/riscatta", codice: "GDA-AAAA-BBBB-CCCC" },
    chi,
  );
  assert.equal(riscatto.success, true);
  assert.deepEqual(chiesti, ["GDA-AAAA-BBBB-CCCC"]);

  const negozio = await commissioni.rispondi(
    { id: 3, type: "ponte/licenza/negozio", app: "gdahome", piattaforma: "ios" },
    chi,
  );
  assert.equal(negozio.success, false);
  assert.equal(negozio.error.code, "ricevuta-non-valida");

  /* Un ponte senza licenze risponde lo stesso: spente. */
  const senza = new Commissioni({ registro: ZITTO });
  const spente = await senza.rispondi({ id: 4, type: "ponte/licenza/stato" }, chi);
  assert.equal(spente.success, true);
  assert.equal(spente.result.attive, false);
});

test("ponte/licenza/*: al telefono della casa di prova si dice che e' di prova, agli altri no", async () => {
  /* Chi rivede l'app per i negozi entra col codice della casa di prova, e la
   * casa di prova e' Premium: l'app, solo su quel telefono, lascia in vista
   * gli abbonamenti. Si dice in ogni risposta, anche dopo un codice o una
   * ricevuta, perche' l'app ridisegna la pagina da quella. */
  const premium = () => ({ attive: true, gdahome: { attiva: true, origine: "regalo" } });
  const licenze = {
    limitata: false,
    stato: premium,
    riscatta: async () => premium(),
    negozio: async () => premium(),
  };
  const commissioni = new Commissioni({ licenze, registro: ZITTO });
  const comandi = [
    { type: "ponte/licenza/stato" },
    { type: "ponte/licenza/riscatta", codice: "GDA-AAAA-BBBB-CCCC" },
    {
      type: "ponte/licenza/negozio",
      app: "gdahome",
      piattaforma: "ios",
      prodotto: "gdahome_premium_annuale",
      ricevuta: "ricevuta",
    },
  ];
  for (const [id, comando] of comandi.entries()) {
    const diProva = await commissioni.rispondi(
      { id, ...comando },
      { dalTelefono: true, diProva: true },
    );
    assert.equal(diProva.success, true, comando.type);
    assert.equal(diProva.result.telefonoDiProva, true, comando.type);
    assert.equal(diProva.result.gdahome.attiva, true, comando.type);

    const diCasa = await commissioni.rispondi({ id, ...comando }, { dalTelefono: true });
    assert.equal(diCasa.success, true, comando.type);
    assert.equal("telefonoDiProva" in diCasa.result, false, comando.type);
  }
});
