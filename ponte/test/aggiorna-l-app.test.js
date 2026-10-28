/* «Aggiorna l'app»: la casa avvisa una volta i telefoni rimasti indietro.
 *
 * La versione nuova la scrive il quadro, negozio per negozio, firmata
 * (`quadro/src/ultime-dell-app.js`); la casa la verifica e avvisa chi ha una
 * build piu' vecchia dell'ultima del **suo** negozio (`ultime-dell-app.js`).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createPrivateKey, sign } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { UltimeDellApp, leggiLeUltime, paroleDellAggiornamento } from "../src/ultime-dell-app.js";
import { doveApre } from "../src/notifiche.js";

/* La coppia **di prova** del contratto. Non va mai in un file di produzione. */
const PUBBLICA = "6P9sdqQtlHcmH7Ve_SgzmyJmxJS28CNORRJJfjI3rnI";
const PRIVATA = "Q2Iu3eKMxw3Y1GS9MypZjXvjPfHB959KImNldY80xr0";

function firmato(corpo, privata = PRIVATA, pubblica = PUBBLICA) {
  const pezzo = Buffer.from(JSON.stringify(corpo)).toString("base64url");
  const chiave = createPrivateKey({
    key: { kty: "OKP", crv: "Ed25519", d: privata, x: pubblica },
    format: "jwk",
  });
  return `${pezzo}.${sign(null, Buffer.from(pezzo, "ascii"), chiave).toString("base64url")}`;
}

const ULTIME = {
  v: 1,
  tipo: "ultime",
  emesso: 1000,
  apple: { costruzione: 1180801, versione: "1.18.8" },
  google: { costruzione: 1180802, versione: "1.18.8" },
};

test("l'elenco vale solo firmato giusto, col suo tipo e i numeri buoni", () => {
  assert.deepEqual(leggiLeUltime(firmato(ULTIME), PUBBLICA), {
    emesso: 1000,
    apple: { costruzione: 1180801, versione: "1.18.8" },
    google: { costruzione: 1180802, versione: "1.18.8" },
  });
  const [pezzo, firma] = firmato(ULTIME).split(".");
  const toccato = Buffer.from(
    JSON.stringify({ ...ULTIME, apple: { costruzione: 9999999 } }),
  ).toString("base64url");
  assert.equal(leggiLeUltime(`${toccato}.${firma}`, PUBBLICA), null, "un pezzo cambiato");
  assert.equal(leggiLeUltime(`${pezzo}.${firma}`, ""), null, "senza chiave");
  assert.equal(leggiLeUltime(firmato({ ...ULTIME, tipo: "revoche" }), PUBBLICA), null);
  assert.deepEqual(
    leggiLeUltime(firmato({ ...ULTIME, apple: { costruzione: "x", versione: "<b>" } }), PUBBLICA)
      .apple,
    undefined,
  );
});

function unaCasa({ telefoni, risposte = [firmato(ULTIME)] }) {
  const cartella = mkdtempSync(join(tmpdir(), "aggiorna-app-"));
  const mandate = [];
  let giro = 0;
  const casa = {
    cartella,
    mandate,
    ultime: null,
    via: () => rmSync(cartella, { recursive: true, force: true }),
  };
  casa.crea = () =>
    new UltimeDellApp({
      dove: "https://quadro.esempio/v1/app/ultime",
      chiave: PUBBLICA,
      cartella,
      dispositivi: { elenco: () => telefoni },
      notifiche: {
        consegna: async (evento, { soloA }) => {
          mandate.push({ a: soloA, ...evento });
          return 1;
        },
      },
      fetch: async () => {
        const ultime = risposte[Math.min(giro, risposte.length - 1)];
        giro += 1;
        return { ok: true, json: async () => ({ ultime }) };
      },
    });
  return casa;
}

test("si avvisa chi e' indietro nel suo negozio, una volta sola, anche dopo un riavvio", async () => {
  const casa = unaCasa({
    telefoni: [
      { id: "iphone-vecchio", sistema: "ios", costruzione: "1180715" },
      { id: "iphone-nuovo", sistema: "ios", costruzione: "1180801" },
      { id: "android-vecchio", sistema: "android", costruzione: "1180801" },
      { id: "android-senza-numero", sistema: "android", app: "1.18.7" },
      { id: "browser", sistema: "web", costruzione: "1" },
    ],
  });
  try {
    const una = casa.crea();
    await una.chiedi();
    assert.deepEqual(
      casa.mandate.map((m) => [m.a, m.chiave, m.negozio]),
      [
        ["iphone-vecchio", "aggiorna_app|1180801", "apple"],
        ["android-vecchio", "aggiorna_app|1180802", "google"],
      ],
    );
    assert.equal(casa.mandate[0].tipo, "aggiorna_app");
    assert.equal(casa.mandate[0].categoria, "manutenzione");
    /* Un altro giro, e un riavvio: niente di nuovo. */
    await una.avvisa();
    await casa.crea().chiedi();
    assert.equal(casa.mandate.length, 2);
  } finally {
    casa.via();
  }
});

test("una versione piu' nuova avvisa di nuovo; un elenco piu' vecchio no", async () => {
  const piuNuova = { ...ULTIME, emesso: 2000, apple: { costruzione: 1180901, versione: "1.18.9" } };
  const vecchio = { ...ULTIME, emesso: 500, apple: { costruzione: 1170000, versione: "1.17" } };
  const casa = unaCasa({
    telefoni: [{ id: "iphone", sistema: "ios", costruzione: "1180715" }],
    risposte: [firmato(ULTIME), firmato(piuNuova), firmato(vecchio)],
  });
  try {
    const una = casa.crea();
    await una.chiedi();
    await una.chiedi();
    await una.chiedi();
    assert.deepEqual(
      casa.mandate.map((m) => m.chiave),
      ["aggiorna_app|1180801", "aggiorna_app|1180901"],
    );
    assert.equal(una.ultime.apple.costruzione, 1180901);
  } finally {
    casa.via();
  }
});

test("una notifica che non parte si riprova; un elenco non firmato non avvisa nessuno", async () => {
  const casa = unaCasa({
    telefoni: [{ id: "iphone", sistema: "ios", costruzione: "1180715" }],
    risposte: ["non.firmato"],
  });
  try {
    const una = casa.crea();
    await una.chiedi();
    assert.equal(casa.mandate.length, 0);
    assert.equal(una.ultime, null);
  } finally {
    casa.via();
  }
  const zitta = unaCasa({ telefoni: [{ id: "iphone", sistema: "ios", costruzione: "1180715" }] });
  try {
    const una = zitta.crea();
    let volte = 0;
    una.notifiche = { consegna: async () => (volte++ === 0 ? 0 : 1) };
    await una.chiedi();
    await una.avvisa();
    assert.equal(volte, 2, "la prima non e' partita, la seconda si'");
    await una.avvisa();
    assert.equal(volte, 2);
  } finally {
    zitta.via();
  }
});

test("le parole dicono versione e negozio, e il tocco apre il negozio", () => {
  const parole = paroleDellAggiornamento({ negozio: "apple", versione: "1.18.8" });
  assert.equal(parole.it.titolo, "⬆️ GdAHome 1.18.8 è disponibile");
  assert.match(parole.it.testo, /App Store/);
  assert.match(
    paroleDellAggiornamento({ negozio: "google", versione: "" }).en.testo,
    /Google Play/,
  );
  assert.deepEqual(doveApre({ tipo: "aggiorna_app" }), { sezione: "negozio" });
});
