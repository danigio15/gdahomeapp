/* La pagina della console a chi non amministra non si serve: si guardava
 * `/` e `/index.html` com'erano scritti, e `servi` poi normalizzava. Con
 * `/.//index.html` il controllo non la riconosceva e `servi` la trovava lo
 * stesso: la pagina intera, a chiunque passasse dall'ingress. Adesso si
 * guarda il percorso normalizzato, come lo guarda `servi`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { request } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { costruisciLaConsole } from "../src/server.js";

const QUI = dirname(fileURLToPath(import.meta.url));
const CHI = "b".repeat(32);

function chiedi(porta, via) {
  return new Promise((fatto, fallito) => {
    const richiesta = request(
      { host: "127.0.0.1", port: porta, path: via, headers: { "x-remote-user-id": CHI } },
      (risposta) => {
        const pezzi = [];
        risposta.on("data", (pezzo) => pezzi.push(pezzo));
        risposta.on("end", () =>
          fatto({ stato: risposta.statusCode, corpo: Buffer.concat(pezzi).toString("utf8") }),
        );
      },
    );
    richiesta.on("error", fallito);
    richiesta.end();
  });
}

test("la pagina della console non esce a chi non amministra, comunque si scriva il percorso", async () => {
  const server = costruisciLaConsole({
    utenti: { amministratore: async () => false },
    cartellaDellaConsole: join(QUI, "..", "console"),
    proxyDellIngress: ["127.0.0.1"],
  });
  await new Promise((pronto) => server.listen(0, "127.0.0.1", pronto));
  const porta = server.address().port;
  try {
    for (const via of [
      "/",
      "/index.html",
      "/.//index.html",
      "//index.html",
      "/./",
      "/x/../index.html",
    ]) {
      const { stato } = await chiedi(porta, via);
      assert.equal(stato, 403, `«${via}» serviva la pagina della console`);
    }
  } finally {
    server.closeAllConnections?.();
    await new Promise((fatto) => server.close(fatto));
  }
});
