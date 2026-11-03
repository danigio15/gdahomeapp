/* I telefoni delle case, per versione dell'app: quello che il centralino
 * accetta, quello che somma, e quello che non dice mai (`telefoni.js`). */
import assert from "node:assert/strict";
import test from "node:test";

import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Case } from "../src/case.js";
import { Centralino } from "../src/centralino.js";
import { costruisciIlServer } from "../src/server.js";
import { iTelefoniDelleCase, iTelefoniDetti, VERSIONI_PER_CASA } from "../src/telefoni.js";

async function attendi(condizione, entro = 3000) {
  const fine = Date.now() + entro;
  while (Date.now() < fine) {
    if (condizione()) return;
    await new Promise((ok) => setTimeout(ok, 10));
  }
  throw new Error("non e' successo in tempo");
}

const detto = (versioni, altro = {}) => ({
  t: "telefoni",
  visti7gg: versioni.reduce((somma, una) => somma + una.quanti, 0),
  versioni,
  ...altro,
});
const iPhone = (quanti = 1) => ({
  negozio: "apple",
  versione: "1.18.8",
  costruzione: 1180800,
  quanti,
});
const android = (quanti = 1) => ({
  negozio: "google",
  versione: "1.16.12",
  costruzione: 1161200,
  quanti,
});

test("un conto pulito passa, e i campi che non si conoscono si lasciano", () => {
  const preso = iTelefoniDetti(detto([iPhone(2), android()], { modello: "iPhone 17" }));
  assert.deepEqual(preso, {
    visti7gg: 3,
    versioni: [
      { negozio: "apple", versione: "1.18.8", costruzione: 1180800, quanti: 2 },
      { negozio: "google", versione: "1.16.12", costruzione: 1161200, quanti: 1 },
    ],
    rapporto: false,
  });
  assert.equal(JSON.stringify(preso).includes("iPhone 17"), false);
});

test("una forma storta si butta intera", () => {
  for (const storto of [
    null,
    { visti7gg: -1, versioni: [] },
    { visti7gg: 1.5, versioni: [] },
    { visti7gg: 1, versioni: "tante" },
    detto([{ ...iPhone(), negozio: "huawei" }]),
    detto([{ ...iPhone(), versione: "<script>" }]),
    detto([{ ...iPhone(), versione: "x".repeat(41) }]),
    detto([{ ...iPhone(), costruzione: -3 }]),
    detto([{ ...iPhone(), quanti: 0 }]),
    /* Piu' telefoni nelle versioni che telefoni visti: un numero falso. */
    { visti7gg: 1, versioni: [iPhone(2)] },
    /* Troppe righe. */
    detto(Array.from({ length: VERSIONI_PER_CASA + 1 }, () => iPhone())),
  ])
    assert.equal(iTelefoniDetti(storto), null, JSON.stringify(storto)?.slice(0, 80));
});

test("si somma su tutte le case, senza quelle col rapporto e senza dire quali", () => {
  const conto = iTelefoniDelleCase([
    { id: "casa_a", telefoni: iTelefoniDetti(detto([iPhone(2), android()])) },
    { id: "casa_b", telefoni: iTelefoniDetti(detto([iPhone()])) },
    /* Col rapporto al quadro: i suoi telefoni il quadro li ha gia'. */
    { id: "casa_c", telefoni: iTelefoniDetti(detto([iPhone(5)], { rapporto: true })) },
    /* L'add-on di prima: non dice niente. */
    { id: "casa_d", telefoni: null },
  ]);
  assert.deepEqual(conto, {
    case: 3,
    col_rapporto: 1,
    mute: 1,
    visti7gg: 4,
    versioni: [
      { negozio: "apple", versione: "1.18.8", costruzione: 1180800, telefoni: 3, case: 2 },
      { negozio: "google", versione: "1.16.12", costruzione: 1161200, telefoni: 1, case: 1 },
    ],
  });
  assert.equal(JSON.stringify(conto).includes("casa_"), false);
});

test("dal filo della casa a /salute: i numeri si sommano, la casa non si vede", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "centralino-telefoni-"));
  const centralino = new Centralino({ case: new Case({ cartella }), chiaveLicenze: "" });
  const server = costruisciIlServer({ centralino });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const porta = server.address().port;
  const id = `casa_${randomBytes(16).toString("hex")}`;
  const presa = new WebSocket(`ws://127.0.0.1:${porta}/casa`);
  const detti = [];
  presa.addEventListener("message", (evento) => detti.push(JSON.parse(evento.data)));
  try {
    await new Promise((ok) => presa.addEventListener("open", ok));
    presa.send(
      JSON.stringify({ t: "sono-io", casa: id, segreto: randomBytes(32).toString("hex") }),
    );
    await attendi(() => detti.some((uno) => uno.t === "bene"));
    const salute = async () =>
      (await (await fetch(`http://127.0.0.1:${porta}/salute`)).json()).versioni_app;

    /* Entrata, e non ha ancora detto niente: e' muta. */
    assert.deepEqual(await salute(), {
      case: 0,
      col_rapporto: 0,
      mute: 1,
      visti7gg: 0,
      versioni: [],
    });

    presa.send(JSON.stringify(detto([iPhone(2), android()])));
    let adesso;
    const fine = Date.now() + 3000;
    while (Date.now() < fine) {
      adesso = await salute();
      if (adesso.case === 1) break;
      await new Promise((ok) => setTimeout(ok, 20));
    }
    assert.equal(adesso.case, 1);
    assert.equal(adesso.visti7gg, 3);

    /* Una riga storta dopo non cancella il conto buono. */
    presa.send(JSON.stringify({ t: "telefoni", visti7gg: "tanti", versioni: [] }));
    await new Promise((ok) => setTimeout(ok, 100));
    assert.equal((await salute()).visti7gg, 3);

    /* E in /salute mai l'identificativo della casa. */
    const tutta = await (await fetch(`http://127.0.0.1:${porta}/salute`)).text();
    assert.equal(tutta.includes(id), false);
  } finally {
    presa.close();
    centralino.chiudiTutto();
    await new Promise((ok) => server.close(ok));
    rmSync(cartella, { recursive: true, force: true });
  }
});
