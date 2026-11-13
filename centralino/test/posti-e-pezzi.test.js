/* I posti del centralino e i pezzi dei messaggi.
 *
 * Due modi di stancare il centralino senza dire niente di sbagliato: mandare
 * un messaggio lungo in pezzi piccolissimi, perche' ogni pezzo costi una
 * copia di tutto quello che e' gia' arrivato; e occupare i posti — da un /48
 * intero, con telefoni che tacciono, con fili che non sono case.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { setImmediate as nuovoGiro } from "node:timers/promises";

import { Case } from "../src/case.js";
import { Centralino, PRESENTAZIONE_MASSIMA } from "../src/centralino.js";
import { reteDi, reteLargaDi } from "../src/indirizzo.js";
import { Presa, telaio } from "../src/presa.js";
import { costruisciIlServer } from "../src/server.js";

async function attendi(condizione, entro = 5000) {
  const fine = Date.now() + entro;
  while (Date.now() < fine) {
    if (condizione()) return;
    await new Promise((ok) => setTimeout(ok, 5));
    await nuovoGiro();
  }
  throw new Error("l'attesa e' scaduta");
}

/* Un socket finto: quello che basta alla presa. */
function unSocket() {
  const socket = new EventEmitter();
  socket.setTimeout = () => {};
  socket.setNoDelay = () => {};
  socket.scritti = [];
  socket.write = (cosa) => (socket.scritti.push(cosa), true);
  socket.end = () => {};
  return socket;
}

/* ─── I pezzi ───────────────────────────────────────────────────────────── */

test("un messaggio in pezzi piccoli non si ricopia a ogni pezzo", () => {
  const socket = unSocket();
  const arrivati = [];
  const presa = new Presa(socket, {
    messaggioMassimo: 1024 * 1024,
    onMessaggio: (testo) => arrivati.push(testo),
  });
  const carico = "x".repeat(1000 * 1024);
  const tutto = Buffer.concat([
    telaio(1, carico, { maschera: true }),
    telaio(1, "dopo", { maschera: true }),
  ]);

  /* Si contano i byte che passano da `Buffer.concat`: prima erano la somma
   * di tutto l'arrivato a ogni pezzo, cioe' qualche gigabyte. */
  const vero = Buffer.concat;
  let copiati = 0;
  Buffer.concat = function (elenco, ...resto) {
    const fatto = vero.call(this, elenco, ...resto);
    copiati += fatto.length;
    return fatto;
  };
  try {
    for (let i = 0; i < tutto.length; i += 200) socket.emit("data", tutto.subarray(i, i + 200));
  } finally {
    Buffer.concat = vero;
  }
  assert.equal(presa.viva, true);
  assert.deepEqual(
    arrivati.map((uno) => uno.length),
    [carico.length, 4],
  );
  assert.equal(arrivati[0], carico);
  assert.ok(copiati < 4 * tutto.length, `copiati ${copiati} byte per ${tutto.length}`);
});

test("un telaio a meta' non lascia passare un messaggio troppo lungo", () => {
  const socket = unSocket();
  const presa = new Presa(socket, { messaggioMassimo: 1000 });
  const lungo = telaio(1, "y".repeat(5000), { maschera: true });
  /* La testa arriva da sola: annuncia troppo, e si chiude subito. */
  socket.emit("data", lungo.subarray(0, 3));
  assert.equal(presa.viva, true);
  socket.emit("data", lungo.subarray(3, 20));
  assert.equal(presa.viva, false);
  assert.equal(presa.motivo, "telaio troppo grande");
});

test("prima di presentarsi una presa dice poco; dopo, quanto vuole", () => {
  const socket = unSocket();
  const arrivati = [];
  const presa = new Presa(socket, {
    messaggioMassimo: 64 * 1024,
    primaDiPresentarsi: 4096,
    onMessaggio: (testo) => arrivati.push(testo),
  });
  socket.emit("data", telaio(1, "a".repeat(4000), { maschera: true }));
  presa.presentata();
  socket.emit("data", telaio(1, "b".repeat(20_000), { maschera: true }));
  assert.equal(presa.viva, true);
  assert.deepEqual(
    arrivati.map((uno) => uno.length),
    [4000, 20_000],
  );

  const altro = unSocket();
  const muta = new Presa(altro, { messaggioMassimo: 64 * 1024, primaDiPresentarsi: 4096 });
  altro.emit("data", telaio(1, "c".repeat(5000), { maschera: true }));
  assert.equal(muta.viva, false, "oltre il tetto prima della presentazione si chiude");
});

/* ─── Il banco ──────────────────────────────────────────────────────────── */

async function banco(opzioni = {}) {
  const cartella = mkdtempSync(join(tmpdir(), "posti-"));
  const case_ = new Case({ cartella });
  const centralino = new Centralino({ case: case_, chiaveLicenze: "", ...opzioni });
  const server = costruisciIlServer({ centralino });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  return {
    centralino,
    dove: `ws://127.0.0.1:${server.address().port}`,
    spegni: async () => {
      centralino.chiudiTutto();
      await new Promise((ok) => server.close(ok));
      case_.chiudi();
      rmSync(cartella, { recursive: true, force: true });
    },
  };
}

function unFilo(indirizzo) {
  const presa = new WebSocket(indirizzo);
  const detti = [];
  let chiusura = null;
  presa.addEventListener("message", (evento) => detti.push(evento.data));
  const aperta = new Promise((ok, no) => {
    presa.addEventListener("open", ok);
    presa.addEventListener("error", () => no(new Error("non e' entrato")));
  });
  aperta.catch(() => {});
  const chiusa = new Promise((ok) =>
    presa.addEventListener("close", (evento) => {
      chiusura = { codice: evento.code, perche: evento.reason };
      ok(chiusura);
    }),
  );
  return {
    presa,
    detti,
    aperta,
    chiusa,
    chiusura: () => chiusura,
    manda: (cosa) => presa.send(typeof cosa === "string" ? cosa : JSON.stringify(cosa)),
  };
}

async function unaCasaDentro(dove) {
  const id = `casa_${randomBytes(16).toString("hex")}`;
  const filo = unFilo(`${dove}/casa/${id}`);
  await filo.aperta;
  filo.manda({ t: "sono-io", casa: id, segreto: randomBytes(32).toString("hex") });
  await attendi(() => filo.detti.some((uno) => JSON.parse(uno).t === "bene"));
  return { ...filo, id };
}

/* ─── I posti ───────────────────────────────────────────────────────────── */

test("in IPv6 i posti si contano per /48: cambiare /64 non da' posti nuovi", () => {
  assert.equal(reteLargaDi("2001:db8:1:2:3:4:5:6"), "2001:db8:1::/48");
  assert.equal(reteLargaDi("2001:db8:1:ffff::9"), "2001:db8:1::/48");
  assert.equal(reteLargaDi("::ffff:203.0.113.7"), "203.0.113.7");
  assert.equal(reteLargaDi("203.0.113.7"), "203.0.113.7");
  /* I freni di chi riprova restano per /64. */
  assert.equal(reteDi("2001:db8:1:2:3:4:5:6"), "2001:db8:1:2::/64");

  const centralino = new Centralino({ chiaveLicenze: "", presePerIndirizzo: 2 });
  try {
    for (const da of ["2001:db8:1:1::1", "2001:db8:1:2::1"]) {
      assert.ok(centralino.cePostoPer(reteLargaDi(da)));
      centralino.unaPresaIn(reteLargaDi(da));
    }
    assert.equal(centralino.cePostoPer(reteLargaDi("2001:db8:1:3::1")), false);
    assert.equal(centralino.cePostoPer(reteLargaDi("2001:db8:2:3::1")), true);
  } finally {
    centralino.chiudiTutto();
  }
});

test("una presentazione troppo lunga chiude la casa prima che entri", async () => {
  const b = await banco();
  try {
    const filo = unFilo(`${b.dove}/casa`);
    await filo.aperta;
    filo.manda({ t: "sono-io", zavorra: "z".repeat(PRESENTAZIONE_MASSIMA + 1) });
    assert.equal((await filo.chiusa).codice, 1009);

    /* Una casa entrata invece manda messaggi lunghi quanto vuole. */
    const casa = await unaCasaDentro(b.dove);
    casa.manda({ t: "telefoni", zavorra: "z".repeat(PRESENTAZIONE_MASSIMA * 4) });
    casa.manda({ t: "battito", n: 1 });
    await attendi(() => casa.detti.some((uno) => JSON.parse(uno).t === "battito"));
    assert.equal(casa.chiusura(), null);
    casa.presa.close();
  } finally {
    await b.spegni();
  }
});

test("un telefono zitto da troppo libera il suo posto; uno che batte resta", async () => {
  let ora = Date.now();
  const b = await banco({ adesso: () => ora, silenzioDelTelefono: 60_000 });
  try {
    const casa = await unaCasaDentro(b.dove);
    const zitto = unFilo(`${b.dove}/telefono/${casa.id}`);
    const batte = unFilo(`${b.dove}/telefono/${casa.id}`);
    await Promise.all([zitto.aperta, batte.aperta]);
    zitto.manda("ciao");
    batte.manda("ciao");
    const quantiD = () => casa.detti.filter((uno) => JSON.parse(uno).t === "d").length;
    await attendi(() => quantiD() === 2);

    ora += 45_000;
    batte.manda(JSON.stringify({ id: 1, type: "ping" }));
    await attendi(() => quantiD() === 3);
    ora += 45_000;
    /* La casa batte anche lei, se no e' lei a essere chiusa. */
    casa.manda({ t: "battito" });
    await attendi(() => casa.detti.some((uno) => JSON.parse(uno).t === "battito"));
    b.centralino._giroDiControllo();

    const chiusura = await Promise.race([
      zitto.chiusa,
      new Promise((ok) => setTimeout(() => ok(null), 2000)),
    ]);
    assert.equal(chiusura?.perche, "nessun segno dal telefono");
    await attendi(() => b.centralino.quantiCollegamenti() === 1);
    assert.equal(batte.chiusura(), null);
    batte.presa.close();
    casa.presa.close();
  } finally {
    await b.spegni();
  }
});

test("i telefoni non prendono i posti tenuti per le case", async () => {
  const b = await banco({ preseInTutto: 3, riservaPerLeCase: 1 });
  try {
    const casa = await unaCasaDentro(b.dove);
    const uno = unFilo(`${b.dove}/telefono/${casa.id}`);
    await uno.aperta;
    /* Due posti presi su tre: il terzo e' di una casa, non di un telefono. */
    const due = unFilo(`${b.dove}/telefono/${casa.id}`);
    await assert.rejects(due.aperta);
    const abbinamento = unFilo(`${b.dove}/abbinamento/${"a".repeat(64)}`);
    await assert.rejects(abbinamento.aperta);
    const altra = await unaCasaDentro(b.dove);
    assert.equal(b.centralino.quanteCase(), 2);
    altra.presa.close();
    uno.presa.close();
    casa.presa.close();
  } finally {
    await b.spegni();
  }
});
