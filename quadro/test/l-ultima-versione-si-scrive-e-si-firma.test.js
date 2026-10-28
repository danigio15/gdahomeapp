/* L'ultima versione dell'app nei negozi: la scrive la gestione, la leggono
 * le case, firmata.
 *
 * «Ipotizza una notifica: quando è disponibile la nuova versione sugli store,
 * avvisare di aggiornare l'app.» Chi tiene il quadro scrive, negozio per
 * negozio, la build che e' davvero uscita (`ultime-dell-app.js`); le case la
 * chiedono a `/v1/app/ultime` e avvisano i telefoni rimasti indietro.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createPublicKey, verify } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { alzaIlQuadro } from "../src/index.js";
import { UltimeDellApp } from "../src/ultime-dell-app.js";

/* La coppia **di prova** del contratto. Non va mai in un file di produzione. */
const PUBBLICA = "6P9sdqQtlHcmH7Ve_SgzmyJmxJS28CNORRJJfjI3rnI";
const PRIVATA = "Q2Iu3eKMxw3Y1GS9MypZjXvjPfHB959KImNldY80xr0";
const GESTORE = "una-chiave-lunga-abbastanza-per-il-gestore";

test("si scrive per negozio, coi numeri buoni, e vuota si toglie", () => {
  const cartella = mkdtempSync(join(tmpdir(), "ultime-"));
  try {
    const ultime = new UltimeDellApp({ cartella, adesso: () => 1000 });
    assert.deepEqual(ultime.tutte(), { apple: null, google: null });
    ultime.imposta("apple", { costruzione: "1180801", versione: "1.18.8" });
    assert.deepEqual(ultime.tutte().apple, { costruzione: 1180801, versione: "1.18.8", il: 1000 });
    for (const [detto, codice] of [
      [["windows", { costruzione: 1 }], "negozio-non-valido"],
      [["apple", { costruzione: "11a" }], "costruzione-non-valida"],
      [["apple", { costruzione: -3 }], "costruzione-non-valida"],
      [["apple", { costruzione: 5, versione: "<b>" }], "versione-non-valida"],
    ])
      assert.throws(
        () => ultime.imposta(...detto),
        (e) => e.codice === codice,
      );
    /* Riletta dal disco, e' la stessa. */
    assert.equal(new UltimeDellApp({ cartella }).tutte().apple.costruzione, 1180801);
    ultime.imposta("apple", { costruzione: "" });
    assert.equal(ultime.tutte().apple, null);
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("la gestione la scrive, e le case la leggono firmata, senza chiave", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "ultime-quadro-"));
  const quadro = await alzaIlQuadro({
    porta: 0,
    cartella,
    livello: "errore",
    chiaveDelGestore: GESTORE,
    chiaveDelleLicenze: PRIVATA,
    saluteDelTramite: "",
  });
  const base = `http://127.0.0.1:${quadro.porta}`;
  try {
    const senza = await fetch(`${base}/gestore/ultime-dell-app/google`, {
      method: "PUT",
      body: JSON.stringify({ costruzione: 1180802 }),
    });
    assert.equal(senza.status, 401, "la gestione vuole la sua chiave");

    const scritta = await fetch(`${base}/gestore/ultime-dell-app/google`, {
      method: "PUT",
      headers: { authorization: `Bearer ${GESTORE}`, "content-type": "application/json" },
      body: JSON.stringify({ costruzione: "1180802", versione: "1.18.8" }),
    });
    assert.equal(scritta.status, 200);
    assert.equal((await scritta.json()).ultimeDellApp.google.costruzione, 1180802);

    const letta = await (await fetch(`${base}/v1/app/ultime`)).json();
    const [pezzo, firma] = letta.ultime.split(".");
    const pubblica = createPublicKey({
      key: { kty: "OKP", crv: "Ed25519", x: PUBBLICA },
      format: "jwk",
    });
    assert.ok(verify(null, Buffer.from(pezzo, "ascii"), pubblica, Buffer.from(firma, "base64url")));
    const detto = JSON.parse(Buffer.from(pezzo, "base64url").toString("utf8"));
    assert.equal(detto.tipo, "ultime");
    assert.deepEqual(detto.google, { costruzione: 1180802, versione: "1.18.8" });
    assert.equal("apple" in detto, false);

    const abbonamenti = await (
      await fetch(`${base}/gestore/abbonamenti`, {
        headers: { authorization: `Bearer ${GESTORE}` },
      })
    ).json();
    assert.equal(abbonamenti.ultimeDellApp.google.costruzione, 1180802);
  } finally {
    await quadro.spegni();
    rmSync(cartella, { recursive: true, force: true });
  }
});
