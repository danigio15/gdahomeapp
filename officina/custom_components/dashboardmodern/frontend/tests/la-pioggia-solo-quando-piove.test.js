/* «Non è possibile far attivare la pioggia solo quando effettivamente la
 * misuri anziché sia sempre presente?» (#184)
 *
 * Sotto il meteo la pioggia si trattava come la temperatura: un numero c'era,
 * la pastiglia pure, e restava scritto «0,0 mm/h» tutto l'anno. Adesso
 * compare quando piove davvero — dalla stessa soglia con cui l'irrigazione
 * salta il giro — e quella di oggi quando è caduto qualcosa. La temperatura
 * resta com'era: zero gradi sono una misura, zero millimetri no.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { normalizzaBarra, pastiglieDellaCasa } from "../src/core/come-sta-la-casa.js";

const chiavi = (misure) =>
  pastiglieDellaCasa([], { barra: normalizzaBarra({}), misure }).map((p) => p.chiave);

test("senza pioggia la pastiglia della pioggia non c'è", () => {
  assert.deepEqual(
    chiavi({ pioggia: { valore: 0, unita: "mm/h" }, pioggiaOggi: { valore: 0, unita: "mm" } }),
    [],
  );
  /* Il rumore del pluviometro non è pioggia. */
  assert.deepEqual(chiavi({ pioggia: { valore: 0.1, unita: "mm/h" } }), []);
});

test("quando piove si vede, anche se il sensore misura in pollici", () => {
  assert.deepEqual(chiavi({ pioggia: { valore: 0.4, unita: "mm/h" } }), ["pioggia"]);
  /* 0,01 pollici l'ora sono 0,254 millimetri: pioggia vera. */
  assert.deepEqual(chiavi({ pioggia: { valore: 0.01, unita: "in/h" } }), ["pioggia"]);
});

test("la pioggia di oggi si vede quando è caduto qualcosa", () => {
  assert.deepEqual(chiavi({ pioggiaOggi: { valore: 1.2, unita: "mm" } }), ["pioggiaOggi"]);
});

test("zero gradi restano una misura", () => {
  assert.deepEqual(chiavi({ temperatura: { valore: 0, unita: "°C" } }), ["temperatura"]);
});
