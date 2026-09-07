/* La prova del difetto che si vedeva solo aspettando.
 *
 * Un telefono aperto ma zitto — l'app ferma sulla home, che riceve gli eventi
 * e non chiede niente — non manda un messaggio per minuti interi. Il ponte
 * contava il silenzio guardando solo i messaggi, e dopo un minuto e mezzo lo
 * buttava fuori pur essendo vivissimo.
 *
 * Nessuna delle altre prove poteva prenderlo: durano tutte meno di quel minuto
 * e mezzo. Questa lo prende perche' guarda il **meccanismo** invece di
 * aspettare l'orologio.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";

import { accetta, telaio } from "../src/presa.js";

/* Un telaio di pong come lo manderebbe un cliente: mascherato, opcode 0xA. */
function pongDalCliente() {
  const maschera = Buffer.from([0x11, 0x22, 0x33, 0x44]);
  return Buffer.concat([Buffer.from([0x8a, 0x80]), maschera]);
}

test("un pong arriva a chi ascolta, e non passa per i messaggi", async () => {
  const server = createServer((_r, risposta) => risposta.end());
  const sentiti = [];
  let pong = 0;
  let presa;
  server.on("upgrade", (richiesta, socket) => {
    presa = accetta(richiesta, socket, {
      onMessaggio: (testo) => sentiti.push(testo),
      onPong: () => (pong += 1),
    });
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));

  try {
    const cliente = new WebSocket(`ws://127.0.0.1:${server.address().port}`);
    await new Promise((ok) => cliente.addEventListener("open", ok));
    await attendi(() => presa != null);

    /* Il cliente vero risponde da solo ai ping: si manda un ping e si aspetta
     * il pong che torna. */
    presa.ping();
    await attendi(() => pong === 1);

    assert.equal(pong, 1);
    assert.deepEqual(sentiti, [], "un pong non e' un messaggio");
    cliente.close();
  } finally {
    presa?.chiudi();
    await new Promise((ok) => server.close(ok));
  }
});

test("il ponte conta il pong come segno di vita, non solo i messaggi", async () => {
  /* Qui non serve una rete: si guarda che il collegamento, ricevendo un pong,
   * sposti avanti l'ora dell'ultimo segno di vita. E' quella l'ora che decide
   * se buttare fuori qualcuno. */
  const { Ponte } = await import("../src/ponte.js");
  const ponte = new Ponte({ casa: null, dispositivi: null, registro: null });
  const presaFinta = {
    viva: true,
    mandati: [],
    manda(testo) {
      this.mandati.push(testo);
      return true;
    },
    ping() {},
    chiudi() {
      this.viva = false;
    },
  };

  const collegamento = ponte.accogli(presaFinta, { da: "prova" });
  try {
    collegamento.vistoIl = Date.now() - 60_000;
    const primaDelPong = collegamento.vistoIl;

    presaFinta.onPong();

    assert.ok(
      collegamento.vistoIl > primaDelPong,
      "il pong deve spostare avanti l'ultimo segno di vita",
    );
  } finally {
    collegamento.chiudi();
    ponte.chiudiTutto();
  }
});

const nuovoGiro = (millesimi = 5) => new Promise((ok) => setTimeout(ok, millesimi));

async function attendi(condizione, entro = 4000) {
  const fine = Date.now() + entro;
  while (Date.now() < fine) {
    if (condizione()) return;
    await nuovoGiro();
  }
  throw new Error("l'attesa e' scaduta");
}
