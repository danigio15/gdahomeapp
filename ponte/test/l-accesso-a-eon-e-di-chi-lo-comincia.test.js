/* L'accesso a E.ON dal browser e' legato a chi l'ha cominciato.
 *
 * Il link porta uno `state` e una sfida PKCE; il ritorno incollato vale solo
 * se ha quello `state`, una volta sola, e lo scambio porta il segreto che
 * risponde alla sfida. Cosi' un codice preso da qualcun altro — o rubato
 * dallo schema del ritorno, che un'altra app sul telefono puo' registrare —
 * non collega la casa a un altro conto e non da' il conto a nessuno. E i
 * biscotti di Auth0 non lasciano mai il dominio di Auth0. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  AccessoEon,
  AccessoNegato,
  Biscotti,
  RITORNO,
  TentativoEon,
  leggiLaConfigurazione,
  unIndirizzoDiEon,
} from "../src/fornitori/eon.js";

const configurazione = {
  leggi: async () => ({ base_url: "https://api-mmi.eon.it", subscription_key: "0".repeat(32) }),
};

test("il link porta uno state e una sfida S256 diversi a ogni accesso", async () => {
  const accesso = new AccessoEon({ prendi: async () => assert.fail(), configurazione });
  const uno = new TentativoEon();
  const due = new TentativoEon();
  const link = new URL(await accesso.linkDelBrowser(uno));
  assert.equal(link.searchParams.get("state"), uno.state);
  assert.equal(link.searchParams.get("code_challenge_method"), "S256");
  assert.equal(
    link.searchParams.get("code_challenge"),
    createHash("sha256").update(uno.verifier).digest("base64url"),
  );
  assert.notEqual(uno.state, due.state);
  assert.notEqual(uno.verifier, due.verifier);
  await assert.rejects(() => accesso.linkDelBrowser(), /tentativo/);
});

test("vale solo il ritorno di questo accesso, intero, e una volta sola", () => {
  const t = new TentativoEon();
  const buono = `${RITORNO}?code=CODICE-BUONO-123&state=${t.state}`;
  assert.equal(t.ilCodice(buono), "CODICE-BUONO-123");
  assert.equal(t.ilCodice(`Failed to launch '${buono}' because…`), "CODICE-BUONO-123");
  for (const cattivo of [
    "CODICE-NUDO-1234567890",
    `https://evil.example/?code=X1234567890&state=${t.state}`,
    `${RITORNO}?code=X1234567890`,
    `${RITORNO}?code=X1234567890&state=${t.state}x`,
    `${RITORNO}?code=X1234567890&state=${t.state}&state=${t.state}`,
    `${RITORNO}?code=X1234567890&state=${t.state}#frammento`,
    `${RITORNO}/altro?code=X1234567890&state=${t.state}`,
    `${RITORNO}?error=access_denied&code=X1234567890&state=${t.state}`,
    `${RITORNO}?code=<script>&state=${t.state}`,
    null,
    "x".repeat(9000),
  ])
    assert.throws(() => t.ilCodice(cattivo), AccessoNegato, String(cattivo).slice(0, 80));
  assert.ok(t.consuma());
  assert.throws(() => t.ilCodice(buono), /tentativo finito/);
  assert.throws(() => t.consuma(), /tentativo finito/);
});

test("lo scambio porta il segreto PKCE e il codice di un altro accesso non arriva allo scambio", async () => {
  const visti = [];
  const prendi = async (indirizzo, opzioni = {}) => {
    visti.push({
      indirizzo: String(indirizzo),
      corpo: opzioni.body ? JSON.parse(opzioni.body) : null,
    });
    return new Response(JSON.stringify({ access_token: "a", refresh_token: "r" }), { status: 200 });
  };
  const accesso = new AccessoEon({ prendi, configurazione });
  const mio = new TentativoEon();
  const suo = new TentativoEon();
  const verifier = mio.verifier;
  await assert.rejects(
    () => accesso.completaDalBrowser(mio, `${RITORNO}?code=CODICE-SUO-1234&state=${suo.state}`),
    AccessoNegato,
  );
  assert.equal(visti.length, 0);
  await accesso.completaDalBrowser(mio, `${RITORNO}?code=CODICE-MIO-1234&state=${mio.state}`);
  assert.equal(visti.length, 1);
  assert.equal(visti[0].corpo.code, "CODICE-MIO-1234");
  assert.equal(visti[0].corpo.code_verifier, verifier);
  await assert.rejects(
    () => accesso.completaDalBrowser(mio, `${RITORNO}?code=CODICE-MIO-1234&state=${mio.state}`),
    /tentativo finito/,
  );
});

test("i biscotti di Auth0 non seguono un rimando fuori dal suo dominio", async () => {
  const visti = [];
  const prendi = async (indirizzo, opzioni = {}) => {
    visti.push({ indirizzo: String(indirizzo), cookie: opzioni.headers?.cookie || "" });
    return new Response("", {
      status: 302,
      headers: [["location", "https://evil.example/raccogli"]],
    });
  };
  const accesso = new AccessoEon({ prendi, configurazione });
  const biscotti = new Biscotti({ auth0: "SEGRETO-DI-SESSIONE" });
  await assert.rejects(
    () => accesso._segui("https://auth.eon-energia.com/authorize", biscotti),
    /fuori dal dominio/,
  );
  assert.deepEqual(
    visti.map((v) => new URL(v.indirizzo).host),
    ["auth.eon-energia.com"],
  );
  await assert.rejects(
    () => accesso._chiedi("https://auth.eon-energia.com.evil.example/u/login", biscotti),
    /fuori dal dominio/,
  );
});

test("l'indirizzo dell'API letto dalla pagina vale solo se e' di E.ON e in https", () => {
  assert.equal(unIndirizzoDiEon("https://api-mmi.eon.it"), true);
  assert.equal(unIndirizzoDiEon("https://myeon.eon-energia.com/scsi"), true);
  for (const no of [
    "http://api-mmi.eon.it",
    "https://evil.example",
    "https://eon.it.evil.example",
    "https://user:pw@api-mmi.eon.it",
    "nonunindirizzo",
  ])
    assert.equal(unIndirizzoDiEon(no), false, no);
  const chiave = "a".repeat(32);
  assert.equal(
    leggiLaConfigurazione(`{"apicrm.url":"https://evil.example","subscription.key":"${chiave}"}`),
    null,
  );
  assert.deepEqual(
    leggiLaConfigurazione(
      `{"apicrm.url":"https:\\/\\/api-mmi.eon.it","subscription.key":"${chiave}"}`,
    ),
    { base_url: "https://api-mmi.eon.it", subscription_key: chiave },
  );
});
