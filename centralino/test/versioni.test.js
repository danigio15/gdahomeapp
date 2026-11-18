/* `GET /versioni`: da quale numero di costruzione in su l'app si puo' usare.
 *
 * E' l'interruttore del giorno dei pagamenti (`docs/LICENZE.md`). Di serie e'
 * zero e non ferma nessuno; acceso, lo leggono l'app e l'add-on. Qui si
 * guarda che dica il numero giusto, che una riga scritta male valga zero
 * invece di fermare tutti, e che un browser da un'altra origine lo possa
 * leggere.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Case } from "../src/case.js";
import { Centralino } from "../src/centralino.js";
import { alzaIlCentralino } from "../src/index.js";
import { costruisciIlServer } from "../src/server.js";
import { MINIMA_DI_SERIE, laMinimaCheVale, leVersioni, versioneMinimaDa } from "../src/versioni.js";

async function banco(opzioni = {}) {
  const cartella = mkdtempSync(join(tmpdir(), "versioni-"));
  const case_ = new Case({ cartella });
  /* Qui si prova il centralino, non la licenza: senza chiave, come oggi,
   * qualunque sia quella scritta nel codice (`docs/LICENZE.md`). */
  const centralino = new Centralino({ case: case_, chiaveLicenze: "" });
  const server = costruisciIlServer({ centralino, ...opzioni });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  return {
    http: `http://127.0.0.1:${server.address().port}`,
    spegni: async () => {
      centralino.chiudiTutto();
      await new Promise((ok) => server.close(ok));
      case_.chiudi();
      rmSync(cartella, { recursive: true, force: true });
    },
  };
}

/* Quello che dice il centralino senza una minima sua, o con una piu' bassa:
 * le minime dei negozi (App Store 1.19.0, Play Store 1.16.12), e per le app
 * di prima la piu' bassa delle due. */
const DEI_NEGOZI = { gdahome: { minima: 1161200, ios: 1190000, android: 1161200 } };

test("di serie le minime dei negozi: nessuno resta senza la versione da prendere", async () => {
  const b = await banco();
  try {
    const risposta = await fetch(`${b.http}/versioni`);
    assert.equal(risposta.status, 200);
    assert.deepEqual(await risposta.json(), DEI_NEGOZI);
  } finally {
    await b.spegni();
  }
});

test("detta la minima, la dice a tutti: per poco, e a ogni origine", async () => {
  const b = await banco({ versioneMinima: 1070000 });
  try {
    const risposta = await fetch(`${b.http}/versioni`, {
      headers: { origin: "https://tramite.esempio" },
    });
    assert.equal(risposta.status, 200);
    assert.deepEqual(
      await risposta.json(),
      DEI_NEGOZI,
      "piu' bassa di quelle dei negozi: valgono quelle",
    );
    assert.equal(risposta.headers.get("cache-control"), "public, max-age=300");
    assert.equal(risposta.headers.get("access-control-allow-origin"), "*");
    assert.match(risposta.headers.get("content-type"), /^application\/json/);
    /* Le regole di sempre restano. */
    assert.equal(risposta.headers.get("x-content-type-options"), "nosniff");

    const testa = await fetch(`${b.http}/versioni`, { method: "HEAD" });
    assert.equal(testa.status, 200);
    assert.equal(await testa.text(), "");

    /* Scrivere non si scrive: non c'e' niente da mandare. */
    const scritta = await fetch(`${b.http}/versioni`, { method: "POST", body: "{}" });
    assert.equal(scritta.status, 404);
  } finally {
    await b.spegni();
  }
});

test("una riga scritta male vale zero, non ferma tutti", () => {
  assert.equal(versioneMinimaDa("1070000"), 1070000);
  assert.equal(versioneMinimaDa(" 1070000 "), 1070000);
  assert.equal(versioneMinimaDa(1070000), 1070000);
  for (const male of ["", undefined, null, "zero", "-5", "1.5", "1e6", "10700000000000"]) {
    assert.equal(versioneMinimaDa(male), 0, String(male));
  }
  assert.deepEqual(leVersioni("abc"), DEI_NEGOZI);
});

test("il centralino acceso legge VERSIONE_MINIMA_APP", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "versioni-alzato-"));
  const vecchio = process.env.VERSIONE_MINIMA_APP;
  process.env.VERSIONE_MINIMA_APP = "1070000";
  try {
    const acceso = await alzaIlCentralino({
      porta: 0,
      cartella,
      livello: "errore",
      dellaRevoche: "",
    });
    try {
      const risposta = await fetch(`http://127.0.0.1:${acceso.server.address().port}/versioni`);
      assert.deepEqual(await risposta.json(), DEI_NEGOZI);
    } finally {
      await acceso.abbassa();
    }
  } finally {
    if (vecchio === undefined) delete process.env.VERSIONE_MINIMA_APP;
    else process.env.VERSIONE_MINIMA_APP = vecchio;
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("la minima scritta nel codice: la macchina puo' alzarla, non abbassarla", () => {
  // Con la riga di serie a 1191400 (la 1.19.14 nei negozi), una macchina
  // rimasta a «0» o a un numero vecchio non riapre le app di prima.
  assert.equal(laMinimaCheVale("0", 1191400), 1191400);
  assert.equal(laMinimaCheVale("1070000", 1191400), 1191400);
  assert.equal(laMinimaCheVale("1200000", 1191400), 1200000);
  assert.equal(laMinimaCheVale("non un numero", 1191400), 1191400);
  // E quella di oggi: la piu' bassa delle due dei negozi.
  assert.equal(MINIMA_DI_SERIE, 1161200);
  assert.equal(laMinimaCheVale(""), 1161200);
});

test("una minima per negozio, e quella di tutti per le app di prima", () => {
  assert.deepEqual(leVersioni(1161200), {
    gdahome: { minima: 1161200, ios: 1190000, android: 1161200 },
  });
  // La macchina che alza la minima per tutti alza anche quelle dei negozi.
  assert.deepEqual(leVersioni(1191400), {
    gdahome: { minima: 1191400, ios: 1191400, android: 1191400 },
  });
});
