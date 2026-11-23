/* Lo sportello del polso: il filo di un orologio che ha solo `fetch`.
 *
 * Una casa vera (un WebSocket che si presenta), il centralino acceso, e
 * l'orologio fatto di richieste HTTP. Quello che si prova: le parole passano
 * com'erano in tutti e due i versi, la sessione continua lo stesso canale,
 * la casa che chiude chiude anche la sessione, e i tetti fermano chi esagera.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash, randomBytes } from "node:crypto";

import { Case } from "../src/case.js";
import { Centralino } from "../src/centralino.js";
import { costruisciIlServer } from "../src/server.js";
import { Freno } from "../src/freno.js";
import { RICHIESTA_MASSIMA, SportelloDelPolso } from "../src/polso.js";

const impronta = (cosa) => createHash("sha256").update(cosa).digest("hex");

async function attendi(condizione, entro = 3000) {
  const fine = Date.now() + entro;
  while (!condizione()) {
    if (Date.now() > fine) throw new Error("non e' successo in tempo");
    await new Promise((ok) => setTimeout(ok, 10));
  }
}

async function banco({ frenoPerChi = 900, registro = null } = {}) {
  const cartella = mkdtempSync(join(tmpdir(), "polso-"));
  const centralino = new Centralino({ case: new Case({ cartella }), chiaveLicenze: "" });
  const polso = new SportelloDelPolso({
    centralino,
    registro,
    freno: new Freno({ perChi: frenoPerChi }),
    attesaDellaRisposta: 400,
    codaDellaRisposta: 20,
    sessioneZitta: 300,
  });
  const server = costruisciIlServer({ centralino, polso });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const porta = server.address().port;
  return {
    centralino,
    polso,
    ws: `ws://127.0.0.1:${porta}`,
    http: `http://127.0.0.1:${porta}`,
    spegni: async () => {
      polso.chiudiTutto();
      centralino.chiudiTutto();
      await new Promise((ok) => server.close(ok));
      rmSync(cartella, { recursive: true, force: true });
    },
  };
}

/* Una casa che risponde a ogni parola con «eco:<parola>», e che chiude il
 * canale quando le si dice «basta». */
async function unaCasa(ws) {
  const id = `casa_${randomBytes(16).toString("hex")}`;
  const presa = new WebSocket(`${ws}/casa`);
  const detti = [];
  presa.addEventListener("message", (evento) => {
    const detto = JSON.parse(evento.data);
    detti.push(detto);
    if (detto.t === "d") {
      if (detto.m === "basta") presa.send(JSON.stringify({ c: detto.c, t: "chiudi" }));
      else presa.send(JSON.stringify({ c: detto.c, t: "d", m: `eco:${detto.m}` }));
    }
  });
  await new Promise((ok) => presa.addEventListener("open", ok));
  presa.send(JSON.stringify({ t: "sono-io", casa: id, segreto: randomBytes(32).toString("hex") }));
  await attendi(() => detti.some((uno) => uno.t === "bene"));
  return { id, presa, detti, chiudi: () => presa.close() };
}

async function chiedi(http, via, corpo) {
  const risposta = await fetch(`${http}${via}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof corpo === "string" ? corpo : JSON.stringify(corpo),
  });
  return {
    stato: risposta.status,
    corpo: await risposta.json().catch(() => null),
    intestazioni: risposta.headers,
  };
}

test("le parole dell'orologio arrivano alla casa com'erano, e tornano indietro nella stessa sessione", async () => {
  const b = await banco();
  const casa = await unaCasa(b.ws);
  try {
    const prima = await chiedi(b.http, `/polso/telefono/${casa.id}`, { m: ["ciao"] });
    assert.equal(prima.stato, 200);
    assert.match(prima.corpo.s, /^[0-9a-f]{32}$/);
    assert.deepEqual(prima.corpo.m, ["eco:ciao"]);
    assert.equal(prima.intestazioni.get("access-control-allow-origin"), "*");

    const apri = casa.detti.filter((uno) => uno.t === "apri");
    assert.equal(apri.length, 1);
    assert.equal(apri[0].via, "telefono");

    const dopo = await chiedi(b.http, `/polso/telefono/${casa.id}`, {
      s: prima.corpo.s,
      m: ["due", "tre"],
    });
    assert.deepEqual(dopo.corpo.m, ["eco:due", "eco:tre"]);
    assert.equal(casa.detti.filter((uno) => uno.t === "apri").length, 1, "lo stesso canale");

    /* Senza parole si aspetta, e si torna a mani vuote. */
    const vuota = await chiedi(b.http, `/polso/telefono/${casa.id}`, { s: prima.corpo.s, m: [] });
    assert.deepEqual(vuota.corpo.m, []);

    /* La casa chiude: la sessione lo dice, e poi non c'e' piu'. */
    const fine = await chiedi(b.http, `/polso/telefono/${casa.id}`, {
      s: prima.corpo.s,
      m: ["basta"],
    });
    assert.ok(fine.corpo.fine);
    const andata = await chiedi(b.http, `/polso/telefono/${casa.id}`, {
      s: prima.corpo.s,
      m: ["ci sei?"],
    });
    assert.equal(andata.stato, 410);
    assert.equal(b.polso.quanteSessioni(), 0);
  } finally {
    casa.chiudi();
    await b.spegni();
  }
});

test("una sessione zitta si chiude da sola, e la casa lo sa", async () => {
  const b = await banco();
  const casa = await unaCasa(b.ws);
  try {
    const prima = await chiedi(b.http, `/polso/telefono/${casa.id}`, { m: ["ciao"] });
    const canale = casa.detti.find((uno) => uno.t === "apri").c;
    await attendi(() => casa.detti.some((uno) => uno.t === "chiudi" && uno.c === canale));
    assert.equal(
      (await chiedi(b.http, `/polso/telefono/${casa.id}`, { s: prima.corpo.s, m: [] })).stato,
      410,
    );
  } finally {
    casa.chiudi();
    await b.spegni();
  }
});

test("una casa che non c'e' e un abbinamento che non c'e' finiscono subito", async () => {
  const b = await banco();
  try {
    const assente = await chiedi(b.http, `/polso/telefono/casa_${"0".repeat(32)}`, { m: ["ciao"] });
    assert.equal(assente.stato, 200);
    assert.equal(assente.corpo.fine.motivo, "casa non collegata");
    const nessuno = await chiedi(b.http, `/polso/abbinamento/${impronta("codice")}`, {
      m: ["ciao"],
    });
    assert.equal(nessuno.corpo.fine.motivo, "nessun abbinamento in corso");
  } finally {
    await b.spegni();
  }
});

test("l'abbinamento passa dall'impronta, come per un telefono", async () => {
  const b = await banco();
  const casa = await unaCasa(b.ws);
  try {
    const quale = impronta("ABCD");
    casa.presa.send(JSON.stringify({ t: "apri-abbinamento", impronta: quale }));
    await attendi(() => b.centralino.abbinamenti.has(quale));
    const detto = JSON.stringify({ v: 1, abbina: 2 });
    const risposta = await chiedi(b.http, `/polso/abbinamento/${quale}`, { m: [detto] });
    assert.deepEqual(risposta.corpo.m, [`eco:${detto}`]);
    assert.equal(casa.detti.find((uno) => uno.t === "apri").via, "abbinamento");
  } finally {
    casa.chiudi();
    await b.spegni();
  }
});

test("lo sportello del polso ha i suoi tetti, e non scrive quello che passa", async () => {
  const scritto = [];
  const registro = {
    info: (r) => scritto.push(r),
    attenzione: (r) => scritto.push(r),
    errore: (r) => scritto.push(r),
  };
  const b = await banco({ frenoPerChi: 3, registro });
  const casa = await unaCasa(b.ws);
  try {
    const via = `/polso/telefono/${casa.id}`;
    assert.equal((await chiedi(b.http, via, "non e' json")).stato, 400);
    assert.equal((await chiedi(b.http, via, { m: ["a", "b", "c", "d", "e"] })).stato, 400);
    const grande = await chiedi(b.http, via, { m: ["x".repeat(RICHIESTA_MASSIMA)] });
    assert.equal(grande.stato, 413);
    assert.equal((await chiedi(b.http, via, { m: ["segreto-che-non-si-scrive"] })).stato, 429);
    assert.equal((await chiedi(b.http, "/polso/telefono/non-una-casa!", { m: ["x"] })).stato, 404);
    assert.equal(JSON.stringify(scritto).includes("segreto-che-non-si-scrive"), false);
    const preflight = await fetch(`${b.http}${via}`, { method: "OPTIONS" });
    assert.equal(preflight.status, 204);
  } finally {
    casa.chiudi();
    await b.spegni();
  }
});
