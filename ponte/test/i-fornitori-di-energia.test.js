/* I fornitori di energia, dal ponte: collegarli, leggerne le bollette,
 * scollegarli.
 *
 * Il fornitore vero non si chiama mai: E.ON ed ENGIE sono finti, ma finti
 * come sono loro — l'accesso di E.ON e' una catena di pagine che si passano i
 * biscotti, quello di ENGIE un ritorno con `state` e un `id_token` firmato.
 * Quello che si prova e' nostro: chi puo' chiamare i comandi, che la password
 * non resta da nessuna parte, che i sensori nascono coi nomi che la linguetta
 * Bollette sa leggere, e che un fornitore che non rinnova i gettoni fa dire
 * «da ricollegare» invece di sparire.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Commissioni } from "../src/commissioni.js";
import { Fornitori, copri } from "../src/fornitori.js";
import { RITORNO as RITORNO_EON } from "../src/fornitori/eon.js";
import { API as API_OCTOPUS, lUltimoConsumo } from "../src/fornitori/octopus.js";

const ZITTO = { info() {}, attenzione() {}, errore() {} };
const EMAIL = "persona-1@example.invalid";
const PASSWORD = "una-password-che-non-deve-restare";
const POD_EON = "IT001E12345678";
const POD_ENGIE = "IT002E99887766";
const ADESSO = Date.UTC(2026, 9, 21, 9, 0, 0);
const API_EON = "https://api-finta.eon.it";

const b64 = (oggetto) => Buffer.from(JSON.stringify(oggetto)).toString("base64url");
/* Un gettone con la sola scadenza: E.ON lo legge per sapere quando
 * rinnovare. Si costruisce qui, pezzo per pezzo, e non sta scritto intero. */
const gettoneEon = (nome, scade = ADESSO / 1000 + 7200) =>
  [b64({ alg: "none" }), b64({ exp: scade, n: nome }), "firma"].join(".");

function risposta(corpo, { status = 200, headers = [] } = {}) {
  const testo = corpo === null ? "" : typeof corpo === "string" ? corpo : JSON.stringify(corpo);
  return new Response(status === 204 ? null : testo, { status, headers });
}

/* ─── E.ON finto ─────────────────────────────────────────────────────────── */

function eonFinto({ mfa = true, controllo = false, rifiutaIlRinnovo = false } = {}) {
  const visti = [];
  /* Lo `state` e la sfida PKCE dell'ultimo `/authorize`: Auth0 rimanda lo
   * `state` sul ritorno, e allo scambio vuole il segreto che da' la sfida. */
  const stato = { rinnovi: 0, rifiutaIlRinnovo, state: "", sfida: "", scambi: [] };
  const ritorno = () =>
    `${RITORNO_EON}?code=CODICE-EON-12345678901&state=${encodeURIComponent(stato.state)}`;
  const pagina = (campi, azione = "") =>
    `<html><form method="post" action="${azione}">${Object.entries(campi)
      .map(([n, v]) => `<input type="hidden" name="${n}" value="${v}">`)
      .join("")}</form></html>`;
  const prendi = async (indirizzo, opzioni = {}) => {
    const url = new URL(String(indirizzo));
    const metodo = opzioni.method || "GET";
    const corpo = opzioni.body ? String(opzioni.body) : "";
    visti.push({ url: url.toString(), metodo, corpo, cookie: opzioni.headers?.cookie || "" });
    if (url.hostname === "myeon.eon-energia.com")
      return risposta(
        `window.env={"apicrm.url":"${API_EON.replace(/\//g, "\\/")}","subscription.key":"0123456789abcdef0123456789abcdef"};`,
      );
    if (url.hostname === "auth.eon-energia.com") {
      if (url.pathname === "/authorize") {
        stato.state = url.searchParams.get("state") || "";
        stato.sfida = url.searchParams.get("code_challenge") || "";
      }
      if (url.pathname === "/authorize")
        return risposta("", {
          status: 302,
          headers: [
            ["location", "/u/login/identifier?state=S1"],
            ["set-cookie", "auth0=uno; Path=/; HttpOnly"],
          ],
        });
      if (url.pathname === "/u/login/identifier" && metodo === "GET")
        return risposta(pagina({ csrf: "c1" }));
      if (url.pathname === "/u/login/identifier")
        return risposta("", {
          status: 302,
          headers: [["location", "/u/login/password?state=S1"]],
        });
      if (url.pathname === "/u/login/password" && metodo === "GET")
        return risposta(pagina(controllo ? { captcha: "" } : { csrf: "c2" }));
      if (url.pathname === "/u/login/password") {
        const giusta = new URLSearchParams(corpo).get("password") === PASSWORD;
        return risposta("", {
          status: 302,
          headers: [
            [
              "location",
              giusta ? "/authorize/resume?state=S1" : "/u/login/password?state=S1&error=1",
            ],
          ],
        });
      }
      if (url.pathname === "/authorize/resume")
        return risposta("", {
          status: 302,
          headers: [["location", mfa ? "/u/mfa-sms-challenge?state=S1" : ritorno()]],
        });
      if (url.pathname === "/u/mfa-sms-challenge" && metodo === "GET")
        return risposta(pagina({ state: "S1" }, "/u/mfa-sms-challenge?state=S1") + "Enter code");
      if (url.pathname === "/u/mfa-sms-challenge") {
        const giusto = new URLSearchParams(corpo).get("code") === "123456";
        return risposta("", {
          status: 302,
          headers: [
            ["location", giusto ? "/authorize/resume2?state=S1" : "/u/mfa-sms-challenge?state=S1"],
          ],
        });
      }
      if (url.pathname === "/authorize/resume2")
        return risposta("", {
          status: 302,
          headers: [["location", ritorno()]],
        });
      if (url.pathname === "/oauth/token") {
        if (corpo.includes("refresh_token")) {
          stato.rinnovi += 1;
          if (stato.rifiutaIlRinnovo) return risposta({ error: "invalid_grant" }, { status: 403 });
          return risposta({
            access_token: gettoneEon(`rinnovato-${stato.rinnovi}`),
            refresh_token: `rinnovo-${stato.rinnovi}`,
            expires_in: 7200,
          });
        }
        const scambio = JSON.parse(corpo);
        stato.scambi.push(scambio);
        const sfida = createHash("sha256")
          .update(String(scambio.code_verifier || ""))
          .digest("base64url");
        if (!stato.sfida || sfida !== stato.sfida)
          return risposta({ error: "invalid_grant" }, { status: 403 });
        return risposta({ access_token: gettoneEon("primo"), refresh_token: "rinnovo-0" });
      }
    }
    if (url.origin === API_EON) {
      /* E.ON risponde 500, e non 401, a un gettone scaduto. */
      const gettone = String(opzioni.headers?.authorization || "").replace(/^Bearer /, "");
      let corpoDelGettone = {};
      try {
        corpoDelGettone = JSON.parse(Buffer.from(gettone.split(".")[1], "base64url").toString());
      } catch (_errore) {
        corpoDelGettone = {};
      }
      const autorizzato =
        /^(primo|rinnovato-\d+)$/.test(corpoDelGettone.n || "") &&
        corpoDelGettone.exp > ADESSO / 1000;
      if (!autorizzato) return risposta("Internal server error", { status: 500 });
      if (url.pathname === "/scsi/point-of-deliveries/v1.0")
        return risposta([
          { PODID: "PDR-GAS", Installation: { Type: "GAS", Status: "ACTIVE" } },
          { PODID: POD_EON, Installation: { Type: "POWER", Status: "ACTIVE" } },
        ]);
      if (url.pathname === `/scsi/point-of-deliveries/v1.0/${POD_EON}`)
        return risposta({
          PODID: POD_EON,
          TechDataElectricity: { ContractualPower: "3,0" },
          ProductInformation: { EndDate: "31/12/2027 00:00:00" },
        });
      if (url.pathname === "/scsi/invoices/v1.0/getInvoiceDvc")
        return risposta(
          {
            ListaFatture: [
              {
                Importo: "81.40",
                ImportoResiduo: "81.40",
                DataEmissione: "16/10/2026",
                DataScadenza: "05/11/2026",
                StatoPagamento: "NOT_PAID",
                ListaForniture: [{ CodiceFornitura: POD_EON }],
              },
              {
                Importo: "70,00",
                ImportoResiduo: "0",
                DataEmissione: "16/08/2026",
                DataScadenza: "05/09/2026",
                StatoPagamento: "PAID",
                ListaForniture: [{ CodicePDR_POD: POD_EON }],
              },
              {
                Importo: "40.00",
                ImportoResiduo: "40.00",
                DataEmissione: "16/10/2026",
                StatoPagamento: "NOT_PAID",
                ListaForniture: [{ CodiceFornitura: "PDR-GAS" }],
              },
            ],
          },
          { status: 202 },
        );
      if (url.pathname === "/DeeperConsumption/v1.0/ExtDailyConsumption")
        return risposta([
          { data: "2026-10-18", valore_h01: "3,0", valore_h02: "3,1" },
          { data: "2026-10-19", valore_h01: "3,5", valore_h02: "3,75" },
        ]);
    }
    return risposta({ errore: "non_trovato" }, { status: 404 });
  };
  return { prendi, visti, stato };
}

/* ─── ENGIE finto ────────────────────────────────────────────────────────── */

function engieFinto({ firmaFalsa = false } = {}) {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const altra = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
  const jwk = { ...publicKey.export({ format: "jwk" }), kid: "k1", alg: "RS256", use: "sig" };
  const visti = [];
  let nonce = "";
  const idToken = () => {
    const testa = b64({ alg: "RS256", kid: "k1", typ: "JWT" });
    const corpo = b64({
      iss: "https://login.engie.it/",
      aud: "vevw1dcH7a8Dheq4zWDDkoNwqtKWWlYF",
      sub: "auth0|persona-1",
      iat: ADESSO / 1000,
      exp: ADESSO / 1000 + 3600,
      nonce,
    });
    const firma = sign(
      "RSA-SHA256",
      Buffer.from(`${testa}.${corpo}`),
      firmaFalsa ? altra : privateKey,
    );
    return `${testa}.${corpo}.${firma.toString("base64url")}`;
  };
  const prendi = async (indirizzo, opzioni = {}) => {
    const url = new URL(String(indirizzo));
    visti.push({ url: url.toString(), metodo: opzioni.method || "GET", corpo: opzioni.body || "" });
    if (url.hostname === "login.engie.it" && url.pathname === "/.well-known/jwks.json")
      return risposta({ keys: [jwk] });
    if (url.hostname === "login.engie.it" && url.pathname === "/oauth/token")
      return risposta({
        token_type: "Bearer",
        expires_in: 3600,
        access_token: "acc-engie",
        refresh_token: "rin-engie",
        id_token: idToken(),
      });
    if (url.hostname === "api-mobileapp2022-prod.aws.engie.it") {
      if (url.pathname === "/contracts/v2/user")
        return risposta({
          code: "OK",
          listaContratti: [
            {
              codContr: "C1",
              forniture: [
                {
                  commodity: "Luce",
                  attiva: "y",
                  punto: { pod: POD_ENGIE, potenzaImpegnata: 4.5 },
                  fineCE: "2027-03-31",
                },
                { commodity: "Gas", attiva: "y", punto: { pdr: "PDR-1" } },
              ],
            },
          ],
        });
      if (url.pathname === "/contracts/v2/invoices")
        return risposta({
          code: "OK",
          response: {
            invoices: [
              {
                fiscalNumber: "F-1",
                amount: 60,
                unpaidRemainingAmount: 0,
                emissionDate: "2026-09-11",
                expiryDate: "2026-10-01",
                invoiceStatus: "PAID",
              },
              {
                fiscalNumber: "F-2",
                amount: 55.5,
                unpaidRemainingAmount: 55.5,
                emissionDate: "2026-10-18",
                expiryDate: "2026-11-07",
                invoiceStatus: "NOT_PAID",
              },
            ],
          },
        });
    }
    return risposta({ errore: "non_trovato" }, { status: 404 });
  };
  return {
    prendi,
    visti,
    perIlLink(link) {
      nonce = new URL(link).searchParams.get("nonce");
    },
  };
}

/* ─── la casa ────────────────────────────────────────────────────────────── */

function casaFinta() {
  const stati = new Map();
  const chiamate = [];
  return {
    stati,
    chiamate,
    async api(metodo, via, corpo) {
      chiamate.push({ metodo, via });
      const entita = via.replace(/^states\//, "");
      if (metodo === "POST") stati.set(entita, corpo);
      if (metodo === "DELETE") stati.delete(entita);
      return {};
    },
  };
}

function preparati(prendi) {
  const cartella = mkdtempSync(join(tmpdir(), "fornitori-"));
  const casa = casaFinta();
  const fornitori = new Fornitori({
    cartella,
    casa,
    registro: ZITTO,
    prendi,
    adesso: () => ADESSO,
  });
  const commissioni = new Commissioni({ casa: {}, registro: ZITTO, fornitori });
  let n = 0;
  const chiedi = (corpo, { amministra = true, chi = "utente-1" } = {}) =>
    commissioni.rispondi({ id: ++n, ...corpo }, { chiChiede: chi, puoAmministrare: amministra });
  const file = () => readFileSync(join(cartella, "fornitori.json"), "utf8");
  return {
    cartella,
    casa,
    fornitori,
    commissioni,
    chiedi,
    file,
    via: () => rmSync(cartella, { recursive: true, force: true }),
  };
}

const T = "dashboardmodern/fornitori/";

/* ─── chi puo' ───────────────────────────────────────────────────────────── */

test("i comandi dei fornitori sono del ponte, e solo per chi amministra", async () => {
  const eon = eonFinto();
  const p = preparati(eon.prendi);
  try {
    assert.equal(p.commissioni.riconosce({ type: `${T}stato` }), true);
    for (const corpo of [
      { type: `${T}stato` },
      { type: `${T}inizia`, fornitore: "engie" },
      { type: `${T}collega`, fornitore: "eon", email: EMAIL, password: PASSWORD },
      { type: `${T}scollega`, collegamento: "0123456789ab" },
    ]) {
      const detto = await p.chiedi(corpo, { amministra: false });
      assert.equal(detto.success, false);
      assert.equal(detto.error.code, "unauthorized");
    }
    assert.equal(eon.visti.length, 0, "chi non amministra non fa partire niente verso E.ON");
    const stato = await p.chiedi({ type: `${T}stato` });
    assert.equal(stato.success, true);
    assert.deepEqual(stato.result.collegati, []);
    assert.deepEqual(Object.fromEntries(stato.result.disponibili.map((f) => [f.id, f.pronto])), {
      eon: true,
      engie: true,
      enel: false,
      octopus: true,
    });
  } finally {
    p.via();
  }
});

/* ─── E.ON ───────────────────────────────────────────────────────────────── */

test("E.ON col codice SMS: si collega, e la password non resta", async () => {
  const eon = eonFinto();
  const p = preparati(eon.prendi);
  try {
    const primo = await p.chiedi({
      type: `${T}collega`,
      fornitore: "eon",
      email: EMAIL,
      password: PASSWORD,
    });
    assert.deepEqual(primo.result, { serve: "codice" });
    /* I biscotti di Auth0 passano da una pagina all'altra. */
    const identita = eon.visti.find(
      (v) => v.url.includes("/u/login/identifier") && v.metodo === "POST",
    );
    assert.match(identita.cookie, /auth0=uno/);

    const sbagliato = await p.chiedi({ type: `${T}codice`, fornitore: "eon", codice: "999999" });
    assert.equal(sbagliato.success, false);
    assert.equal(sbagliato.error.message, "codice");

    const fatto = await p.chiedi({ type: `${T}codice`, fornitore: "eon", codice: "123456" });
    assert.equal(fatto.success, true, JSON.stringify(fatto.error));
    const [collegato] = fatto.result.stato.collegati;
    assert.equal(collegato.fornitore, "eon");
    assert.equal(collegato.stato, "ok");
    assert.equal(collegato.pod, "IT001E••••5678");
    assert.equal(collegato.aggiornato, ADESSO);

    /* Niente segreti verso la plancia, niente password ne' email sul disco. */
    assert.doesNotMatch(JSON.stringify(fatto), /rinnovo|primo|eyJ/);
    assert.doesNotMatch(p.file(), new RegExp(PASSWORD));
    assert.doesNotMatch(p.file(), new RegExp(EMAIL));
    assert.equal(statSync(join(p.cartella, "fornitori.json")).mode & 0o777, 0o600);
    /* La password e' andata solo a E.ON, nella pagina della password. */
    const conLaPassword = eon.visti.filter((v) => v.corpo.includes(encodeURIComponent(PASSWORD)));
    assert.deepEqual(
      conLaPassword.map((v) => new URL(v.url).origin + new URL(v.url).pathname),
      ["https://auth.eon-energia.com/u/login/password"],
    );

    const stato = (nome) => p.casa.stati.get(`sensor.eon_${nome}`);
    assert.equal(stato("unpaid_invoices").state, "81.4");
    assert.equal(stato("unpaid_invoices").attributes.unit_of_measurement, "EUR");
    assert.equal(stato("unpaid_invoices").attributes.quante, 1);
    assert.equal(stato("payment_status").state, "unpaid");
    assert.equal(stato("latest_invoice").state, "81.4");
    assert.equal(stato("latest_invoice").attributes.scadenza, "2026-11-05");
    assert.equal(stato("total_invoiced").state, "151.4");
    assert.equal(stato("contracted_power").state, "3");
    assert.equal(stato("offer_end").state, "2027-12-31");
    assert.equal(stato("daily_consumption").state, "7.25");
    assert.equal(stato("daily_consumption").attributes.giorno, "2026-10-19");
    assert.match(stato("unpaid_invoices").attributes.friendly_name, /E\.ON Energia/);
  } finally {
    p.via();
  }
});

test("E.ON con la password sbagliata dice «credenziali» e non collega niente", async () => {
  const p = preparati(eonFinto({ mfa: false }).prendi);
  try {
    const detto = await p.chiedi({
      type: `${T}collega`,
      fornitore: "eon",
      email: EMAIL,
      password: "no",
    });
    assert.equal(detto.success, false);
    assert.equal(detto.error.message, "credenziali");
    assert.deepEqual(p.fornitori.stato().collegati, []);
  } finally {
    p.via();
  }
});

test("E.ON col controllo «non sei un robot» passa dal browser", async () => {
  const eon = eonFinto({ controllo: true });
  const p = preparati(eon.prendi);
  try {
    const passo = await p.chiedi({
      type: `${T}collega`,
      fornitore: "eon",
      email: EMAIL,
      password: PASSWORD,
    });
    assert.equal(passo.result.serve, "incolla");
    assert.equal(passo.result.perche, "captcha");
    assert.match(passo.result.link, /^https:\/\/auth\.eon-energia\.com\/authorize\?/);
    const link = new URL(passo.result.link);
    assert.ok(link.searchParams.get("state"), "il link porta lo state");
    assert.equal(link.searchParams.get("code_challenge_method"), "S256");
    const state = link.searchParams.get("state");
    /* E' il browser di chi usa la casa ad aprire il link, non il ponte. */
    await eon.prendi(link.toString());
    /* Quello che non e' il ritorno di questo accesso non passa: un indirizzo
     * qualsiasi, il codice da solo, il ritorno di un altro accesso, un
     * ritorno incollato dentro un indirizzo di qualcun altro senza lo state. */
    for (const indirizzo of [
      "https://esempio.invalid/",
      "CODICE-DELL-ATTACCANTE-0001",
      "https://evil.example/qualunque?code=CODICE-DELL-ATTACCANTE-0001",
      `${RITORNO_EON}?code=CODICE-DELL-ATTACCANTE-0001`,
      `${RITORNO_EON}?code=CODICE-DELL-ATTACCANTE-0001&state=un-altro-accesso`,
      `${RITORNO_EON}?code=A1234567890&code=B1234567890&state=${state}`,
      `${RITORNO_EON}?error=access_denied&state=${state}`,
    ]) {
      const niente = await p.chiedi({ type: `${T}incolla`, fornitore: "eon", indirizzo });
      assert.equal(niente.error?.message, "link", indirizzo);
    }
    assert.equal(eon.stato.scambi.length, 0, "nessun codice sbagliato arriva allo scambio");
    const fatto = await p.chiedi({
      type: `${T}incolla`,
      fornitore: "eon",
      indirizzo: `Failed to launch '${RITORNO_EON}?code=CODICE-EON-12345678901&state=${state}' because the scheme does not have a registered handler.`,
    });
    assert.equal(fatto.success, true, JSON.stringify(fatto.error));
    assert.equal(fatto.result.stato.collegati[0].fornitore, "eon");
  } finally {
    p.via();
  }
});

test("il codice senza un accesso a meta' e' «scaduto», e vale solo per chi l'ha cominciato", async () => {
  const p = preparati(eonFinto().prendi);
  try {
    const subito = await p.chiedi({ type: `${T}codice`, fornitore: "eon", codice: "123456" });
    assert.equal(subito.error.message, "scaduto");
    await p.chiedi({ type: `${T}collega`, fornitore: "eon", email: EMAIL, password: PASSWORD });
    const unAltro = await p.chiedi(
      { type: `${T}codice`, fornitore: "eon", codice: "123456" },
      { chi: "utente-2" },
    );
    assert.equal(unAltro.error.message, "scaduto");
  } finally {
    p.via();
  }
});

test("quando E.ON non rinnova i gettoni il collegamento chiede di ricollegarsi", async () => {
  const eon = eonFinto({ mfa: false });
  const p = preparati(eon.prendi);
  try {
    const fatto = await p.chiedi({
      type: `${T}collega`,
      fornitore: "eon",
      email: EMAIL,
      password: PASSWORD,
    });
    const chiave = fatto.result.stato.collegati[0].id;
    assert.match(chiave, /^[0-9a-f]{12}$/);
    /* Il gettone scade, il rinnovo viene rifiutato. */
    const voce = p.fornitori.collegati[chiave];
    voce.segreti.gettoni.access_token = gettoneEon("scaduto", ADESSO / 1000 - 10);
    eon.stato.rifiutaIlRinnovo = true;
    const dopo = await p.chiedi({ type: `${T}aggiorna`, collegamento: chiave });
    assert.equal(dopo.result.stato.collegati[0].stato, "da-ricollegare");
    /* L'ultima bolletta letta resta. */
    assert.equal(p.casa.stati.get("sensor.eon_unpaid_invoices").state, "81.4");

    /* Ricollegarsi rimette a posto lo stesso collegamento, non uno nuovo. */
    eon.stato.rifiutaIlRinnovo = false;
    const ancora = await p.chiedi({
      type: `${T}collega`,
      fornitore: "eon",
      email: EMAIL,
      password: PASSWORD,
    });
    const [collegato] = ancora.result.stato.collegati;
    assert.equal(collegato.id, chiave);
    assert.equal(collegato.stato, "ok");
  } finally {
    p.via();
  }
});

test("i gettoni che E.ON ruota si scrivono subito", async () => {
  const eon = eonFinto({ mfa: false });
  const p = preparati(eon.prendi);
  try {
    const fatto = await p.chiedi({
      type: `${T}collega`,
      fornitore: "eon",
      email: EMAIL,
      password: PASSWORD,
    });
    const chiave = fatto.result.stato.collegati[0].id;
    p.fornitori.collegati[chiave].segreti.gettoni.access_token = gettoneEon(
      "vecchio",
      ADESSO / 1000 + 60,
    );
    await p.chiedi({ type: `${T}aggiorna`, collegamento: chiave });
    assert.match(p.file(), /rinnovo-1/);
  } finally {
    p.via();
  }
});

/* ─── ENGIE ──────────────────────────────────────────────────────────────── */

test("ENGIE dal browser: il ritorno giusto collega, un altro no", async () => {
  const engie = engieFinto();
  const p = preparati(engie.prendi);
  try {
    const inizio = await p.chiedi({ type: `${T}inizia`, fornitore: "engie" });
    const link = inizio.result.link;
    assert.match(link, /^https:\/\/login\.engie\.it\/authorize\?/);
    assert.match(link, /code_challenge_method=S256/);
    engie.perIlLink(link);
    const stato = new URL(link).searchParams.get("state");
    const ritorno = (s) =>
      `https://login.engie.it/android/it.engie.appengie/callback?code=abc&state=${encodeURIComponent(s)}`;

    const altro = await p.chiedi({
      type: `${T}incolla`,
      fornitore: "engie",
      indirizzo: ritorno("sbagliato"),
    });
    assert.equal(altro.error.message, "link");
    assert.equal(engie.visti.length, 0, "un ritorno di un altro tentativo non va da ENGIE");

    const fatto = await p.chiedi({
      type: `${T}incolla`,
      fornitore: "engie",
      indirizzo: ritorno(stato),
    });
    assert.equal(fatto.success, true, JSON.stringify(fatto.error));
    const [collegato] = fatto.result.stato.collegati;
    assert.equal(collegato.fornitore, "engie");
    assert.equal(collegato.pod, "IT002E••••7766");
    /* Il verifier di PKCE e' partito con lo scambio. */
    const scambio = engie.visti.find((v) => v.url.endsWith("/oauth/token"));
    assert.match(String(scambio.corpo), /code_verifier/);

    const s = (nome) => p.casa.stati.get(`sensor.engie_${nome}`);
    assert.equal(s("unpaid_invoices").state, "55.5");
    assert.equal(s("payment_status").state, "unpaid");
    assert.equal(s("latest_invoice").state, "55.5");
    assert.equal(s("total_invoiced").state, "115.5");
    assert.equal(s("contracted_power").state, "4.5");
    assert.equal(s("offer_end").state, "2027-03-31");
    /* ENGIE non da' il consumo del giorno: il sensore non c'e'. */
    assert.equal(s("daily_consumption"), undefined);
  } finally {
    p.via();
  }
});

test("ENGIE con un'identita' firmata da altri non collega", async () => {
  const engie = engieFinto({ firmaFalsa: true });
  const p = preparati(engie.prendi);
  try {
    const inizio = await p.chiedi({ type: `${T}inizia`, fornitore: "engie" });
    engie.perIlLink(inizio.result.link);
    const stato = new URL(inizio.result.link).searchParams.get("state");
    const detto = await p.chiedi({
      type: `${T}incolla`,
      fornitore: "engie",
      indirizzo: `https://login.engie.it/android/it.engie.appengie/callback?code=abc&state=${encodeURIComponent(stato)}`,
    });
    assert.equal(detto.success, false);
    assert.equal(detto.error.message, "link");
    assert.deepEqual(p.fornitori.stato().collegati, []);
  } finally {
    p.via();
  }
});

/* ─── scollegare, e i sensori dopo un riavvio ────────────────────────────── */

test("scollegare toglie gettoni e sensori", async () => {
  const p = preparati(eonFinto({ mfa: false }).prendi);
  try {
    const fatto = await p.chiedi({
      type: `${T}collega`,
      fornitore: "eon",
      email: EMAIL,
      password: PASSWORD,
    });
    const chiave = fatto.result.stato.collegati[0].id;
    assert.ok(p.casa.stati.has("sensor.eon_unpaid_invoices"));
    const via = await p.chiedi({ type: `${T}scollega`, collegamento: chiave });
    assert.deepEqual(via.result.stato.collegati, []);
    assert.equal(p.casa.stati.size, 0);
    assert.doesNotMatch(p.file(), /rinnovo/);
  } finally {
    p.via();
  }
});

test("Home Assistant riparte: i sensori si riscrivono dall'ultima lettura", async () => {
  const eon = eonFinto({ mfa: false });
  const p = preparati(eon.prendi);
  try {
    await p.chiedi({ type: `${T}collega`, fornitore: "eon", email: EMAIL, password: PASSWORD });
    p.casa.stati.clear();
    const prima = eon.visti.length;
    /* Un ponte nuovo, sullo stesso disco: come dopo un riavvio. */
    const dopo = new Fornitori({
      cartella: p.cartella,
      casa: p.casa,
      registro: ZITTO,
      prendi: eon.prendi,
    });
    await dopo.rimettiGliStati();
    assert.equal(p.casa.stati.get("sensor.eon_unpaid_invoices").state, "81.4");
    assert.equal(eon.visti.length, prima, "riscrivere non chiede niente a E.ON");
  } finally {
    p.via();
  }
});

test("due collegamenti dello stesso fornitore hanno sensori diversi", async () => {
  const p = preparati(eonFinto({ mfa: false }).prendi);
  try {
    p.fornitori.collegati.aaaaaaaaaaaa = { fornitore: "eon", prefisso: "eon", pod: "ALTRO" };
    assert.equal(p.fornitori._prefisso("eon"), "eon_2");
  } finally {
    p.via();
  }
});

test("la fornitura si copre a meta'", () => {
  assert.equal(copri("IT001E12345678"), "IT001E••••5678");
  assert.equal(copri("1234"), "1234");
  assert.equal(copri(""), "");
});

/* ─── Octopus ─────────────────────────────────────────────────────────────── */

const POD_OCTOPUS = "IT001E55554444";

/* Kraken finto: GraphQL, gli errori dentro una risposta 200. Il gettone
 * d'accesso e quello di rinnovo cambiano a ogni rinnovo. */
function octopusFinto({ saldo = -4250, rifiutaIlRinnovo = false } = {}) {
  const visti = [];
  const stato = { rinnovi: 0, rifiutaIlRinnovo, saldo };
  const errore = (codice) =>
    risposta({ errors: [{ message: "no", extensions: { errorCode: codice } }] });
  const prendi = async (indirizzo, opzioni = {}) => {
    assert.equal(String(indirizzo), API_OCTOPUS);
    const corpo = JSON.parse(String(opzioni.body || "{}"));
    const chi = opzioni.headers?.authorization || "";
    visti.push({ query: corpo.query, variabili: corpo.variables, chi });
    if (corpo.query.includes("obtainKrakenToken")) {
      const input = corpo.variables?.input || {};
      if (input.refreshToken) {
        if (stato.rifiutaIlRinnovo) return errore("KT-CT-1135");
        stato.rinnovi += 1;
      } else if (input.email !== EMAIL || input.password !== PASSWORD) return errore("KT-CT-1138");
      return risposta({
        data: {
          obtainKrakenToken: {
            token: `accesso-${stato.rinnovi}`,
            payload: { exp: ADESSO / 1000 + 3600 },
            refreshToken: `rinnovo-${stato.rinnovi}`,
            refreshExpiresIn: ADESSO / 1000 + 7 * 86400,
          },
        },
      });
    }
    if (!chi.startsWith("accesso-")) return errore("KT-CT-1111");
    if (corpo.query.includes("viewer"))
      return risposta({ data: { viewer: { accounts: [{ number: "A-1234ABCD", ledgers: [] }] } } });
    if (corpo.query.includes("account(")) {
      assert.equal(corpo.variables.accountNumber, "A-1234ABCD");
      return risposta({
        data: {
          account: {
            ledgers: [{ ledgerType: "ELECTRICITY_LEDGER", balance: stato.saldo }],
            properties: [
              {
                id: "casa-1",
                electricitySupplyPoints: [
                  {
                    pod: POD_OCTOPUS,
                    status: "ON_SUPPLY",
                    product: {
                      __typename: "ElectricityProductType",
                      displayName: "Octopus Fissa",
                      validTo: null,
                      prices: { consumptionCharge: "0.1180", consumptionChargeUnits: "EUR/kWh" },
                    },
                    agreements: {
                      edges: [
                        {
                          node: {
                            validFrom: "2025-12-01",
                            validTo: "2026-11-30T23:00:00+00:00",
                            isActive: true,
                          },
                        },
                      ],
                    },
                  },
                ],
              },
            ],
          },
        },
      });
    }
    if (corpo.query.includes("property(")) {
      assert.equal(corpo.variables.pod, POD_OCTOPUS);
      return risposta({
        data: {
          property: {
            measurements: {
              edges: [
                { node: { value: "10234.5", unit: "kWh", readAt: "2026-10-19T00:00:00+02:00" } },
                { node: { value: "10243.25", unit: "kWh", readAt: "2026-10-20T00:00:00+02:00" } },
              ],
            },
          },
        },
      });
    }
    return errore("KT-CT-0000");
  };
  return { prendi, visti, stato };
}

test("Octopus: email e password una volta, poi solo il gettone di rinnovo", async () => {
  const octo = octopusFinto();
  const p = preparati(octo.prendi);
  try {
    const sbagliata = await p.chiedi({
      type: `${T}collega`,
      fornitore: "octopus",
      email: EMAIL,
      password: "no",
    });
    assert.equal(sbagliata.success, false);
    assert.equal(sbagliata.error.message, "credenziali");

    const fatto = await p.chiedi({
      type: `${T}collega`,
      fornitore: "octopus",
      email: EMAIL,
      password: PASSWORD,
    });
    assert.equal(fatto.success, true, JSON.stringify(fatto.error));
    const [collegato] = fatto.result.stato.collegati;
    assert.equal(collegato.fornitore, "octopus");
    assert.equal(collegato.nome, "Octopus Energy");
    assert.equal(collegato.pod, "IT001E••••4444");
    assert.equal(collegato.stato, "ok");

    /* La password e' andata solo nella domanda che entra. */
    const conLaPassword = octo.visti.filter((v) => JSON.stringify(v.variabili).includes(PASSWORD));
    assert.equal(conLaPassword.length, 1);
    assert.ok(conLaPassword.every((v) => v.query.includes("obtainKrakenToken")));
    assert.doesNotMatch(p.file(), new RegExp(PASSWORD));
    assert.doesNotMatch(p.file(), new RegExp(EMAIL));
    assert.match(p.file(), /rinnovo-0/);
    assert.doesNotMatch(JSON.stringify(fatto), /rinnovo-|accesso-/);

    const stato = (nome) => p.casa.stati.get(`sensor.octopus_${nome}`);
    assert.equal(stato("account_balance").state, "-42.5");
    assert.equal(stato("unpaid_invoices").state, "42.5");
    assert.equal(stato("payment_status").state, "unpaid");
    assert.equal(stato("energy_price").state, "0.118");
    assert.equal(stato("energy_price").attributes.unit_of_measurement, "EUR/kWh");
    assert.equal(stato("offer_end").state, "2026-11-30");
    assert.equal(stato("daily_consumption").state, "8.75");
    assert.equal(stato("daily_consumption").attributes.giorno, "2026-10-20");
    assert.equal(p.casa.stati.has("sensor.octopus_latest_invoice"), false);
  } finally {
    p.via();
  }
});

test("Octopus: col saldo in credito non c'e' niente da pagare, e un rinnovo rifiutato fa ricollegare", async () => {
  const octo = octopusFinto({ saldo: 1200 });
  const p = preparati(octo.prendi);
  try {
    const fatto = await p.chiedi({
      type: `${T}collega`,
      fornitore: "octopus",
      email: EMAIL,
      password: PASSWORD,
    });
    const chiave = fatto.result.stato.collegati[0].id;
    assert.equal(p.casa.stati.get("sensor.octopus_unpaid_invoices").state, "0");
    assert.equal(p.casa.stati.get("sensor.octopus_payment_status").state, "paid");

    /* Il gettone scade: si rinnova, e il rinnovo nuovo si scrive subito. */
    p.fornitori.collegati[chiave].segreti.gettoni.scade = ADESSO - 1;
    await p.chiedi({ type: `${T}aggiorna`, collegamento: chiave });
    assert.equal(octo.stato.rinnovi, 1);
    assert.match(p.file(), /rinnovo-1/);

    p.fornitori.collegati[chiave].segreti.gettoni.scade = ADESSO - 1;
    octo.stato.rifiutaIlRinnovo = true;
    const dopo = await p.chiedi({ type: `${T}aggiorna`, collegamento: chiave });
    assert.equal(dopo.result.stato.collegati[0].stato, "da-ricollegare");
    assert.equal(p.casa.stati.get("sensor.octopus_account_balance").state, "12");
  } finally {
    p.via();
  }
});

test("il consumo di Octopus viene da due letture, e una lettura che torna indietro non vale", () => {
  assert.equal(lUltimoConsumo([]), null);
  assert.deepEqual(
    lUltimoConsumo([
      { value: "5", readAt: "2026-10-02T00:00:00Z" },
      { value: "2", readAt: "2026-10-01T00:00:00Z" },
    ]),
    { totale: 3, giorno: "2026-10-02" },
  );
  assert.equal(
    lUltimoConsumo([
      { value: "5", readAt: "2026-10-01T00:00:00Z" },
      { value: "2", readAt: "2026-10-02T00:00:00Z" },
    ]),
    null,
  );
});
