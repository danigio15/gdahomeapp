/* `GET /versioni` sulla nuvola: lo stesso numero, detto allo stesso modo del
 * centralino in Node (`centralino/test/versioni.test.js`). Qui il numero sta
 * fra le [vars] di `wrangler.toml`, e arriva al Worker in `env`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import centralino from "../src/index.js";

const chiedi = (via, env = {}, opzioni) =>
  centralino.fetch(new Request(`https://centralino.esempio${via}`, opzioni), env);

test("senza la variabile la minima e' zero: non si ferma nessuno", async () => {
  const risposta = await chiedi("/versioni");
  assert.equal(risposta.status, 200);
  assert.deepEqual(await risposta.json(), { gdahome: { minima: 0 } });
});

test("con VERSIONE_MINIMA_APP la dice a tutti, per cinque minuti", async () => {
  const risposta = await chiedi("/versioni", { VERSIONE_MINIMA_APP: "1070000" });
  assert.equal(risposta.status, 200);
  assert.deepEqual(await risposta.json(), { gdahome: { minima: 1070000 } });
  assert.equal(risposta.headers.get("cache-control"), "public, max-age=300");
  assert.equal(risposta.headers.get("access-control-allow-origin"), "*");

  const testa = await chiedi("/versioni", { VERSIONE_MINIMA_APP: "1070000" }, { method: "HEAD" });
  assert.equal(testa.status, 200);
  assert.equal(await testa.text(), "");
});

test("scritta male vale zero", async () => {
  const risposta = await chiedi("/versioni", { VERSIONE_MINIMA_APP: "domani" });
  assert.deepEqual(await risposta.json(), { gdahome: { minima: 0 } });
});

test("wrangler.toml la porta, spenta", () => {
  const toml = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
  /* Dentro [vars] e prima di [assets]: in TOML quello che sta dopo una
   * tabella ci finisce dentro. */
  const vars = toml.indexOf("\n[vars]");
  const assets = toml.indexOf("\n[assets]");
  const riga = toml.indexOf('\nVERSIONE_MINIMA_APP = "0"');
  assert.ok(vars > 0 && riga > vars && riga < assets, "VERSIONE_MINIMA_APP non sta in [vars]");
});
