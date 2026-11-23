/* Lo sportello di WHOOP: lo scambio dei token col secret che sta qui.
 *
 * Davanti un centralino vero, dietro un WHOOP finto — un server HTTP su
 * questa macchina che scrive cosa gli arriva e risponde come risponderebbe
 * WHOOP. Quello che si prova: lo scambio del codice e il rinnovo arrivano a
 * WHOOP con `client_id` e `client_secret` aggiunti qui, e la risposta torna
 * com'era; un ritorno che non e' quello dell'app, o una domanda che non e'
 * nessuna delle due, non arriva a WHOOP; senza secret lo sportello dice che
 * non e' configurato; il freno ferma chi esagera; e nel registro non finisce
 * mai ne' il secret, ne' un codice, ne' un token.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Case } from "../src/case.js";
import { Centralino } from "../src/centralino.js";
import { Freno } from "../src/freno.js";
import { alzaIlCentralino } from "../src/index.js";
import { costruisciIlServer } from "../src/server.js";
import { CORPO_MASSIMO, RITORNO_DI_SERIE, SportelloDiWhoop } from "../src/whoop.js";

const CLIENT_ID = "client-di-prova-1234";
const SECRET = "secret-di-prova-che-non-deve-uscire-mai";
const CODICE = "codice-di-prova-abcdef0123456789";
const VERIFICATORE = "v".repeat(43);
const ACCESSO = "accesso-di-prova-0123456789";
const RINNOVO = "rinnovo-di-prova-9876543210";
const RINNOVO_NUOVO = "rinnovo-nuovo-di-prova-1357";

/* Il WHOOP finto: tiene le domande che riceve, e risponde con `risponde`. */
async function whoopFinto(
  risponde = () => ({
    stato: 200,
    corpo: {
      access_token: ACCESSO,
      refresh_token: RINNOVO_NUOVO,
      expires_in: 3600,
      scope: "offline read:recovery",
      token_type: "bearer",
    },
  }),
) {
  const domande = [];
  const server = createServer(async (richiesta, risposta) => {
    const pezzi = [];
    for await (const pezzo of richiesta) pezzi.push(pezzo);
    const testo = Buffer.concat(pezzi).toString("utf8");
    const domanda = {
      metodo: richiesta.method,
      via: richiesta.url,
      tipo: richiesta.headers["content-type"],
      campi: Object.fromEntries(new URLSearchParams(testo)),
    };
    domande.push(domanda);
    const { stato, corpo } = risponde(domanda);
    const uscita = JSON.stringify(corpo);
    risposta.writeHead(stato, { "content-type": "application/json;charset=UTF-8" });
    risposta.end(uscita);
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  return {
    domande,
    dove: `http://127.0.0.1:${server.address().port}/oauth/oauth2/token`,
    spegni: () => new Promise((ok) => server.close(ok)),
  };
}

/* Un registro che tiene tutto quello che gli si dice. */
function unRegistro() {
  const righe = [];
  const scrivi = (livello) => (messaggio) => righe.push(`${livello} ${messaggio}`);
  return {
    righe,
    debug: scrivi("debug"),
    info: scrivi("info"),
    attenzione: scrivi("attenzione"),
    errore: scrivi("errore"),
  };
}

async function banco({ whoop: opzioni = {}, finto = null } = {}) {
  const cartella = mkdtempSync(join(tmpdir(), "whoop-"));
  const centralino = new Centralino({ case: new Case({ cartella }), chiaveLicenze: "" });
  const registro = unRegistro();
  const whoop = new SportelloDiWhoop({
    clientId: CLIENT_ID,
    clientSecret: SECRET,
    dove: finto?.dove,
    registro,
    ...opzioni,
  });
  const server = costruisciIlServer({ centralino, whoop, registro });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const http = `http://127.0.0.1:${server.address().port}`;
  return {
    whoop,
    registro,
    http,
    chiedi: (corpo, { tipo = "application/json", metodo = "POST", da } = {}) =>
      fetch(`${http}/whoop/token`, {
        method: metodo,
        headers: {
          ...(tipo ? { "content-type": tipo } : {}),
          ...(da ? { "x-forwarded-for": da } : {}),
        },
        body:
          metodo === "POST" || metodo === "PUT"
            ? typeof corpo === "string"
              ? corpo
              : JSON.stringify(corpo)
            : undefined,
      }),
    spegni: async () => {
      centralino.chiudiTutto();
      await new Promise((ok) => server.close(ok));
      await finto?.spegni();
      rmSync(cartella, { recursive: true, force: true });
    },
  };
}

const loScambio = {
  grant_type: "authorization_code",
  code: CODICE,
  redirect_uri: RITORNO_DI_SERIE,
  code_verifier: VERIFICATORE,
};

const ilRinnovo = { grant_type: "refresh_token", refresh_token: RINNOVO, scope: "offline" };

test("lo scambio del codice arriva a WHOOP col client, e torna com'era", async () => {
  const finto = await whoopFinto();
  const b = await banco({ finto });
  try {
    const risposta = await b.chiedi(loScambio);
    assert.equal(risposta.status, 200);
    assert.equal(risposta.headers.get("cache-control"), "no-store");
    assert.match(risposta.headers.get("content-type"), /application\/json/);
    assert.deepEqual(await risposta.json(), {
      access_token: ACCESSO,
      refresh_token: RINNOVO_NUOVO,
      expires_in: 3600,
      scope: "offline read:recovery",
      token_type: "bearer",
    });

    assert.equal(finto.domande.length, 1);
    const [domanda] = finto.domande;
    assert.equal(domanda.metodo, "POST");
    assert.equal(domanda.via, "/oauth/oauth2/token");
    assert.equal(domanda.tipo, "application/x-www-form-urlencoded");
    assert.deepEqual(domanda.campi, {
      grant_type: "authorization_code",
      code: CODICE,
      redirect_uri: RITORNO_DI_SERIE,
      code_verifier: VERIFICATORE,
      client_id: CLIENT_ID,
      client_secret: SECRET,
    });
  } finally {
    await b.spegni();
  }
});

test("senza code_verifier lo scambio passa lo stesso, senza inventarlo", async () => {
  const finto = await whoopFinto();
  const b = await banco({ finto });
  try {
    const { code_verifier: _via, ...senza } = loScambio;
    assert.equal((await b.chiedi(senza)).status, 200);
    assert.equal("code_verifier" in finto.domande[0].campi, false);
  } finally {
    await b.spegni();
  }
});

test("il rinnovo col refresh token, anche da un modulo", async () => {
  const finto = await whoopFinto();
  const b = await banco({ finto });
  try {
    const risposta = await b.chiedi(ilRinnovo);
    assert.equal(risposta.status, 200);
    assert.equal((await risposta.json()).access_token, ACCESSO);
    assert.deepEqual(finto.domande[0].campi, {
      grant_type: "refresh_token",
      refresh_token: RINNOVO,
      scope: "offline",
      client_id: CLIENT_ID,
      client_secret: SECRET,
    });

    /* Lo stesso, come lo manderebbe un modulo. */
    const daModulo = await b.chiedi(new URLSearchParams(ilRinnovo).toString(), {
      tipo: "application/x-www-form-urlencoded",
    });
    assert.equal(daModulo.status, 200);
    assert.equal(finto.domande[1].campi.refresh_token, RINNOVO);
  } finally {
    await b.spegni();
  }
});

test("il no di WHOOP torna all'app com'e', stato e corpo", async () => {
  /* Un refresh token che WHOOP non accetta piu': l'app su 400 chiude il
   * collegamento, quindi lo stato deve arrivare uguale. */
  const finto = await whoopFinto(() => ({
    stato: 400,
    corpo: { error: "invalid_grant", error_description: "token non valido" },
  }));
  const b = await banco({ finto });
  try {
    const risposta = await b.chiedi(ilRinnovo);
    assert.equal(risposta.status, 400);
    assert.deepEqual(await risposta.json(), {
      error: "invalid_grant",
      error_description: "token non valido",
    });
  } finally {
    await b.spegni();
  }
});

test("un ritorno che non e' quello dell'app non arriva a WHOOP", async () => {
  const finto = await whoopFinto();
  const b = await banco({ finto });
  try {
    for (const ritorno of [
      "https://altrove.esempio.it/whoop",
      "gdahome://whoop/",
      "gdahome://whoop?x=1",
      "",
    ]) {
      const risposta = await b.chiedi({ ...loScambio, redirect_uri: ritorno });
      assert.equal(risposta.status, 400, `«${ritorno}» e' passato`);
    }
    const senza = { ...loScambio };
    delete senza.redirect_uri;
    assert.equal((await b.chiedi(senza)).status, 400);
    assert.equal(
      (await (await b.chiedi({ ...loScambio, redirect_uri: "gdahome://altro" })).json()).errore,
      "ritorno-non-permesso",
    );
    assert.equal(finto.domande.length, 0);
  } finally {
    await b.spegni();
  }
});

test("il ritorno permesso si cambia dalla configurazione", async () => {
  const finto = await whoopFinto();
  const b = await banco({ finto, whoop: { ritorno: "gdahome-prova://whoop" } });
  try {
    assert.equal((await b.chiedi(loScambio)).status, 400);
    assert.equal(
      (await b.chiedi({ ...loScambio, redirect_uri: "gdahome-prova://whoop" })).status,
      200,
    );
    assert.equal(finto.domande.length, 1);
  } finally {
    await b.spegni();
  }
});

test("solo il codice e il rinnovo: il resto non passa, e il client non si cambia", async () => {
  const finto = await whoopFinto();
  const b = await banco({ finto });
  try {
    for (const corpo of [
      { grant_type: "client_credentials" },
      { grant_type: "password", username: "a", password: "b" },
      { grant_type: "authorization_code", redirect_uri: RITORNO_DI_SERIE },
      { grant_type: "refresh_token" },
      { grant_type: "refresh_token", refresh_token: 12 },
      { grant_type: "refresh_token", refresh_token: "x".repeat(5000) },
      { ...loScambio, code_verifier: "corto" },
      { ...ilRinnovo, scope: "offline\nrubata" },
      {},
    ]) {
      const risposta = await b.chiedi(corpo);
      assert.equal(risposta.status, 400, JSON.stringify(corpo).slice(0, 80));
    }
    assert.equal((await b.chiedi("non e' json")).status, 400);
    assert.equal((await b.chiedi("[1,2]")).status, 400);
    assert.equal(finto.domande.length, 0);

    /* Un client mandato dall'app non prende il posto di quello di qui, e i
     * campi in piu' non passano. */
    const risposta = await b.chiedi({
      ...ilRinnovo,
      client_id: "un-altro",
      client_secret: "un-altro-secret",
      extra: "niente",
    });
    assert.equal(risposta.status, 200);
    assert.equal(finto.domande[0].campi.client_id, CLIENT_ID);
    assert.equal(finto.domande[0].campi.client_secret, SECRET);
    assert.equal("extra" in finto.domande[0].campi, false);
  } finally {
    await b.spegni();
  }
});

test("senza client id o senza secret risponde 503, e non chiede a WHOOP", async () => {
  for (const mancante of [
    { clientSecret: "" },
    { clientId: "" },
    { clientId: "", clientSecret: "" },
  ]) {
    const finto = await whoopFinto();
    const b = await banco({ finto, whoop: mancante });
    try {
      assert.equal(b.whoop.pronto, false);
      const risposta = await b.chiedi(loScambio);
      assert.equal(risposta.status, 503);
      const corpo = await risposta.json();
      assert.equal(corpo.errore, "whoop-non-configurato");
      assert.match(corpo.spiegazione, /non e' configurato/);
      assert.equal(finto.domande.length, 0);
    } finally {
      await b.spegni();
    }
  }
});

test("il freno ferma chi esagera, un indirizzo alla volta", async () => {
  const finto = await whoopFinto();
  const b = await banco({ finto, whoop: { freno: new Freno({ perChi: 3, inTutto: 5 }) } });
  try {
    /* Dietro Caddy l'indirizzo vero arriva in `x-forwarded-for`. */
    for (let i = 0; i < 3; i += 1) {
      assert.equal((await b.chiedi(ilRinnovo, { da: "203.0.113.7" })).status, 200);
    }
    const fermato = await b.chiedi(ilRinnovo, { da: "203.0.113.7" });
    assert.equal(fermato.status, 429);
    assert.ok(Number(fermato.headers.get("retry-after")) > 0);
    assert.equal((await fermato.json()).errore, "troppe-richieste");

    /* Un altro indirizzo passa, finche' c'e' posto in tutto. */
    assert.equal((await b.chiedi(ilRinnovo, { da: "198.51.100.9" })).status, 200);
    assert.equal((await b.chiedi(ilRinnovo, { da: "198.51.100.9" })).status, 200);
    assert.equal((await b.chiedi(ilRinnovo, { da: "192.0.2.44" })).status, 429);

    assert.equal(finto.domande.length, 5);
    assert.deepEqual(b.whoop.conti, { richieste: 7, fermate: 2, senza_risposta: 0 });
  } finally {
    await b.spegni();
  }
});

test("un corpo troppo grande si ferma prima di WHOOP", async () => {
  const finto = await whoopFinto();
  const b = await banco({ finto });
  try {
    const risposta = await b.chiedi({ ...ilRinnovo, riempi: "x".repeat(CORPO_MASSIMO) });
    assert.equal(risposta.status, 413);
    assert.equal(finto.domande.length, 0);
  } finally {
    await b.spegni();
  }
});

test("solo POST, e le domande del browser hanno la loro risposta", async () => {
  const finto = await whoopFinto();
  const b = await banco({ finto });
  try {
    const prima = await fetch(`${b.http}/whoop/token`, {
      method: "OPTIONS",
      headers: { origin: "https://esempio.it", "access-control-request-method": "POST" },
    });
    assert.equal(prima.status, 204);
    assert.equal(prima.headers.get("access-control-allow-origin"), "*");
    assert.match(prima.headers.get("access-control-allow-methods"), /POST/);

    const get = await fetch(`${b.http}/whoop/token`);
    assert.equal(get.status, 405);

    /* Le altre vie sotto /whoop non ci sono. */
    assert.equal((await fetch(`${b.http}/whoop/revoca`, { method: "POST" })).status, 404);
    assert.equal(finto.domande.length, 0);
  } finally {
    await b.spegni();
  }
});

test("WHOOP che non risponde fa un 502, e nel registro non c'e' niente di suo", async () => {
  /* Un indirizzo dove non ascolta nessuno. */
  const spento = await whoopFinto();
  await spento.spegni();
  const b = await banco({ whoop: { dove: spento.dove } });
  try {
    const risposta = await b.chiedi(loScambio);
    assert.equal(risposta.status, 502);
    assert.equal((await risposta.json()).errore, "whoop-non-risponde");
    assert.equal(b.whoop.conti.senza_risposta, 1);
    assert.ok(b.registro.righe.some((riga) => /WHOOP non risponde/.test(riga)));
    const tutto = b.registro.righe.join("\n");
    for (const segreto of [SECRET, CODICE, VERIFICATORE, CLIENT_ID]) {
      assert.equal(tutto.includes(segreto), false, "nel registro c'e' un segreto");
    }
  } finally {
    await b.spegni();
  }
});

test("il centralino acceso davvero: niente secret, codici o token nel registro ne' in /salute", async () => {
  const finto = await whoopFinto();
  const cartella = mkdtempSync(join(tmpdir(), "whoop-acceso-"));
  /* Tutto quello che il centralino scrive, al livello piu' chiacchierone. */
  const scritto = [];
  const scrivi = process.stdout.write;
  process.stdout.write = (pezzo, ...resto) => {
    scritto.push(String(pezzo));
    return scrivi.call(process.stdout, "", ...resto);
  };
  let acceso;
  try {
    acceso = await alzaIlCentralino({
      porta: 0,
      cartella,
      livello: "debug",
      dellaRevoche: "",
      chiaveDiFirebase: null,
      whoopClientId: CLIENT_ID,
      whoopClientSecret: SECRET,
      whoopToken: finto.dove,
    });
    const http = `http://127.0.0.1:${acceso.server.address().port}`;
    const chiedi = (corpo) =>
      fetch(`${http}/whoop/token`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(corpo),
      });
    assert.equal((await chiedi(loScambio)).status, 200);
    assert.equal((await chiedi(ilRinnovo)).status, 200);
    assert.equal(
      (await chiedi({ ...loScambio, redirect_uri: "https://altrove.esempio.it" })).status,
      400,
    );
    assert.equal(finto.domande.length, 2);
    assert.equal(finto.domande[0].campi.client_secret, SECRET);

    /* `/salute` da dentro dice che lo sportello e' acceso, e i conti. */
    const salute = await (await fetch(`${http}/salute`)).json();
    assert.equal(salute.whoop.pronto, true);
    assert.equal(salute.whoop.richieste, 3);

    const tutto = scritto.join("") + JSON.stringify(salute);
    assert.match(tutto, /sportello di WHOOP e' acceso/);
    for (const segreto of [SECRET, CODICE, VERIFICATORE, ACCESSO, RINNOVO, RINNOVO_NUOVO]) {
      assert.equal(
        tutto.includes(segreto),
        false,
        "un segreto e' finito nel registro o in /salute",
      );
    }
  } finally {
    process.stdout.write = scrivi;
    await acceso?.abbassa();
    await finto.spegni();
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("acceso senza variabili, lo sportello c'e' e dice che e' spento", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "whoop-spento-"));
  const vecchi = [process.env.WHOOP_CLIENT_ID, process.env.WHOOP_CLIENT_SECRET];
  delete process.env.WHOOP_CLIENT_ID;
  delete process.env.WHOOP_CLIENT_SECRET;
  let acceso;
  try {
    acceso = await alzaIlCentralino({
      porta: 0,
      cartella,
      livello: "errore",
      dellaRevoche: "",
      chiaveDiFirebase: null,
    });
    const http = `http://127.0.0.1:${acceso.server.address().port}`;
    const risposta = await fetch(`${http}/whoop/token`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(loScambio),
    });
    assert.equal(risposta.status, 503);
    assert.equal((await (await fetch(`${http}/salute`)).json()).whoop.pronto, false);
  } finally {
    if (vecchi[0] !== undefined) process.env.WHOOP_CLIENT_ID = vecchi[0];
    if (vecchi[1] !== undefined) process.env.WHOOP_CLIENT_SECRET = vecchi[1];
    await acceso?.abbassa();
    rmSync(cartella, { recursive: true, force: true });
  }
});
