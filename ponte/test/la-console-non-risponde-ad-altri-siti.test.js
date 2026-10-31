/* La console si apre dall'ingress, con la sessione di Home Assistant: ma il
 * browser quella sessione la porta anche a una richiesta fatta partire da una
 * pagina qualsiasi. Una richiesta che cambia qualcosa, o un WebSocket, che il
 * browser dice partiti da un altro sito non passano; e un corpo che non e'
 * JSON (un modulo, un testo: quelli che il browser manda senza chiedere) non e'
 * un corpo della console. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { connect } from "node:net";

import { corpoNonDiJson, costruisciLaConsole, daUnAltroSito } from "../src/server.js";

const CHI_AMMINISTRA = "a".repeat(32);

test("da dove parte la richiesta, secondo il browser", () => {
  const con = (headers) => ({ headers });
  assert.equal(daUnAltroSito(con({ "sec-fetch-site": "cross-site" })), true);
  assert.equal(daUnAltroSito(con({ "sec-fetch-site": "same-site" })), true);
  assert.equal(daUnAltroSito(con({ "sec-fetch-site": "same-origin" })), false);
  assert.equal(daUnAltroSito(con({ "sec-fetch-site": "none" })), false);
  assert.equal(daUnAltroSito(con({})), false);
  assert.equal(corpoNonDiJson(con({ "content-type": "text/plain", "content-length": "5" })), true);
  assert.equal(
    corpoNonDiJson(
      con({ "content-type": "application/x-www-form-urlencoded", "content-length": "5" }),
    ),
    true,
  );
  assert.equal(
    corpoNonDiJson(con({ "content-type": "application/json", "content-length": "5" })),
    false,
  );
  assert.equal(corpoNonDiJson(con({})), false, "senza corpo non c'e' niente da guardare");
});

test("la console dice di no a un'altra pagina, anche a chi amministra", async () => {
  const console_ = costruisciLaConsole({
    registro: null,
    opzioni: {},
    utenti: { amministratore: async () => true },
    proxyDellIngress: ["127.0.0.1"],
  });
  await new Promise((ok) => console_.listen(0, "127.0.0.1", ok));
  const porta = console_.address().port;
  try {
    const manda = (headers, corpo = "{}") =>
      fetch(`http://127.0.0.1:${porta}/api/codice`, {
        method: "POST",
        headers: { "x-remote-user-id": CHI_AMMINISTRA, ...headers },
        body: corpo,
      });
    for (const headers of [
      { "content-type": "application/json", "sec-fetch-site": "cross-site" },
      { "content-type": "text/plain" },
      { "content-type": "application/x-www-form-urlencoded" },
    ]) {
      const risposta = await manda(headers);
      assert.equal(risposta.status, 403, JSON.stringify(headers));
      assert.match(await risposta.text(), /non parte da Home Assistant/);
    }
    /* Il WebSocket della plancia, aperto da un'altra pagina: no. */
    const risposta = await new Promise((ok) => {
      const presa = connect(porta, "127.0.0.1", () =>
        presa.write(
          "GET /plancia/api/websocket HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\n" +
            "Connection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n" +
            "Sec-WebSocket-Version: 13\r\nSec-Fetch-Site: cross-site\r\n\r\n",
        ),
      );
      let detto = "";
      presa.on("data", (pezzo) => (detto += pezzo));
      presa.on("close", () => ok(detto));
      presa.on("error", () => ok(detto));
    });
    assert.match(risposta, /^HTTP\/1\.1 403/);
  } finally {
    await new Promise((ok) => console_.close(ok));
  }
});
