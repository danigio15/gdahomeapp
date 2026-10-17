/* Le foto delle notifiche elaborate: la casa le lascia sul suo filo, il
 * telefono le prende una volta, e dopo dieci minuti non ci sono piu'.
 *
 * Il contenuto qui e' un blocco di byte a caso: il centralino non lo apre, e
 * le prove controllano proprio che arrivi identico, senza che nessuno ci
 * guardi dentro.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Case } from "../src/case.js";
import { Centralino } from "../src/centralino.js";
import {
  FOTO_MASSIMA,
  FOTO_PER_CASA_AL_MINUTO,
  FotoDiPassaggio,
  VITA_DELLA_FOTO,
} from "../src/foto.js";
import { costruisciIlServer } from "../src/server.js";

const unTelefono = () => `dm_${randomBytes(8).toString("hex")}`;
const unaCasa = () => `casa_${randomBytes(16).toString("hex")}`;

test("una foto si lascia, si prende una volta, e poi non c'e' piu'", () => {
  const foto = new FotoDiPassaggio();
  const byte = randomBytes(5000);
  const { id } = foto.lascia(unaCasa(), { telefono: unTelefono(), dati: byte.toString("base64") });
  assert.match(id, /^[0-9a-f]{32}$/);
  assert.deepEqual(foto.prendi(id), byte, "arriva identica");
  assert.equal(foto.prendi(id), null, "una lettura sola");
  assert.equal(foto.quante, 0);
});

test("dopo dieci minuti scade, anche se nessuno l'ha presa", () => {
  let ora = 1_000_000;
  const foto = new FotoDiPassaggio({ adesso: () => ora });
  const { id } = foto.lascia(unaCasa(), {
    telefono: unTelefono(),
    dati: randomBytes(100).toString("base64"),
  });
  ora += VITA_DELLA_FOTO - 1;
  assert.equal(foto.quante, 1);
  ora += 2;
  assert.equal(foto.prendi(id), null);
  assert.equal(foto.conti.scadute, 1);
});

test("si rifiuta quello che non e' una foto per un telefono di una casa", () => {
  const foto = new FotoDiPassaggio();
  const dati = randomBytes(100).toString("base64");
  assert.deepEqual(foto.lascia("non-una-casa", { telefono: unTelefono(), dati }), {
    perche: "rifiutata",
  });
  assert.deepEqual(foto.lascia(unaCasa(), { telefono: "qualcuno", dati }), {
    perche: "rifiutata",
  });
  assert.deepEqual(foto.lascia(unaCasa(), { telefono: unTelefono(), dati: "non base64!" }), {
    perche: "rifiutata",
  });
  assert.deepEqual(
    foto.lascia(unaCasa(), {
      telefono: unTelefono(),
      dati: randomBytes(FOTO_MASSIMA + 1).toString("base64"),
    }),
    { perche: "troppo-grande" },
  );
  assert.equal(foto.prendi("../../etc/passwd"), null);
});

test("una casa non ne lascia piu' di sei al minuto, e la memoria ha un tetto", () => {
  const foto = new FotoDiPassaggio({ memoria: 10_000 });
  const casa = unaCasa();
  const telefono = unTelefono();
  const piccola = randomBytes(10).toString("base64");
  for (let i = 0; i < FOTO_PER_CASA_AL_MINUTO; i += 1) {
    assert.ok(foto.lascia(casa, { telefono, dati: piccola }).id);
  }
  assert.deepEqual(foto.lascia(casa, { telefono, dati: piccola }), { perche: "troppe" });
  assert.ok(foto.lascia(unaCasa(), { telefono, dati: piccola }).id, "un'altra casa si'");
  assert.deepEqual(
    foto.lascia(unaCasa(), { telefono, dati: randomBytes(9_999).toString("base64") }),
    { perche: "troppe" },
    "oltre la memoria in tutto, no",
  );
});

test("dal filo della casa alla via /foto: foto-ok, i byte, poi 404", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "centralino-"));
  const foto = new FotoDiPassaggio();
  const centralino = new Centralino({ case: new Case({ cartella }), chiaveLicenze: "", foto });
  const server = costruisciIlServer({ centralino, foto });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const porta = server.address().port;
  const presa = new WebSocket(`ws://127.0.0.1:${porta}/casa`);
  const detti = [];
  presa.addEventListener("message", (evento) => detti.push(JSON.parse(evento.data)));
  const aspetta = async (prova) => {
    for (let i = 0; i < 200; i += 1) {
      if (prova()) return;
      await new Promise((ok) => setTimeout(ok, 10));
    }
    throw new Error("non e' arrivato");
  };
  try {
    await new Promise((ok, no) => {
      presa.addEventListener("open", ok);
      presa.addEventListener("error", no);
    });
    presa.send(
      JSON.stringify({ t: "sono-io", casa: unaCasa(), segreto: randomBytes(32).toString("hex") }),
    );
    await aspetta(() => detti.some((d) => d.t === "bene"));

    const byte = randomBytes(120_000);
    presa.send(
      JSON.stringify({ t: "foto", n: 7, telefono: unTelefono(), dati: byte.toString("base64") }),
    );
    presa.send(JSON.stringify({ t: "foto", n: 8, telefono: "nessuno", dati: "AAAA" }));
    await aspetta(() => detti.filter((d) => d.t?.startsWith("foto")).length === 2);
    const ok = detti.find((d) => d.t === "foto-ok");
    assert.equal(ok.n, 7);
    assert.match(ok.id, /^[0-9a-f]{32}$/);
    assert.deepEqual(
      detti.find((d) => d.t === "foto-no"),
      { t: "foto-no", n: 8, perche: "rifiutata" },
    );

    const presa1 = await fetch(`http://127.0.0.1:${porta}/foto/${ok.id}`);
    assert.equal(presa1.status, 200);
    assert.equal(presa1.headers.get("content-type"), "application/octet-stream");
    assert.equal(presa1.headers.get("cache-control"), "no-store");
    assert.deepEqual(Buffer.from(await presa1.arrayBuffer()), byte);
    const presa2 = await fetch(`http://127.0.0.1:${porta}/foto/${ok.id}`);
    assert.equal(presa2.status, 404, "una lettura sola");
    await presa2.arrayBuffer();
    const nessuna = await fetch(`http://127.0.0.1:${porta}/foto/${"0".repeat(32)}`);
    assert.equal(nessuna.status, 404);
    await nessuna.arrayBuffer();
  } finally {
    presa.close();
    centralino.chiudiTutto();
    await new Promise((ok) => server.close(ok));
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("senza le foto accese il centralino dice «spente», e la casa manda senza", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "centralino-"));
  const centralino = new Centralino({ case: new Case({ cartella }), chiaveLicenze: "" });
  const server = costruisciIlServer({ centralino });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const presa = new WebSocket(`ws://127.0.0.1:${server.address().port}/casa`);
  const detti = [];
  presa.addEventListener("message", (evento) => detti.push(JSON.parse(evento.data)));
  try {
    await new Promise((ok, no) => {
      presa.addEventListener("open", ok);
      presa.addEventListener("error", no);
    });
    presa.send(
      JSON.stringify({ t: "sono-io", casa: unaCasa(), segreto: randomBytes(32).toString("hex") }),
    );
    for (let i = 0; i < 200 && !detti.some((d) => d.t === "bene"); i += 1)
      await new Promise((ok) => setTimeout(ok, 10));
    presa.send(JSON.stringify({ t: "foto", n: 1, telefono: unTelefono(), dati: "AAAA" }));
    for (let i = 0; i < 200 && !detti.some((d) => d.t === "foto-no"); i += 1)
      await new Promise((ok) => setTimeout(ok, 10));
    assert.deepEqual(
      detti.find((d) => d.t === "foto-no"),
      { t: "foto-no", n: 1, perche: "spente" },
    );
  } finally {
    presa.close();
    centralino.chiudiTutto();
    await new Promise((ok) => server.close(ok));
    rmSync(cartella, { recursive: true, force: true });
  }
});
