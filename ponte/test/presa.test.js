/* Le prove della presa.
 *
 * La presa la mette alla prova il WebSocket *cliente* di Node, che e' quello
 * vero: se la nostra stretta di mano o il nostro telaio fossero sbagliati, lui
 * chiuderebbe. Nessuna rete esce di qui — server e cliente stanno sullo stesso
 * processo, su una porta effimera.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { connect } from "node:net";

import {
  accetta,
  eUnaSalita,
  firmaDellaChiave,
  staccaIlTelaio,
  telaio,
  ErroreDiProtocollo,
  ErroreDiCarico,
} from "../src/presa.js";

/* ─── Le parti, guardate da sole ─────────────────────────────────────────── */

test("la stretta di mano da' il risultato scritto nella RFC 6455", () => {
  assert.equal(firmaDellaChiave("dGhlIHNhbXBsZSBub25jZQ=="), "s3pPLMBiTxaQ9kYGzzhZRbK+xOo=");
});

test("una richiesta normale non e' una salita", () => {
  assert.equal(eUnaSalita({ method: "GET", headers: {} }), false);
  assert.equal(eUnaSalita({ method: "POST", headers: { upgrade: "websocket" } }), false);
  assert.equal(eUnaSalita({ method: "GET", headers: { upgrade: "WebSocket" } }), true);
});

/* Un telaio mascherato come lo manderebbe un cliente. */
function telaioDalCliente(tipo, carico, { finito = true } = {}) {
  const dati = Buffer.from(carico);
  const maschera = Buffer.from([0x11, 0x22, 0x33, 0x44]);
  let testa;
  if (dati.length < 126) {
    testa = Buffer.alloc(2);
    testa[1] = 0x80 | dati.length;
  } else if (dati.length < 65536) {
    testa = Buffer.alloc(4);
    testa[1] = 0x80 | 126;
    testa.writeUInt16BE(dati.length, 2);
  } else {
    testa = Buffer.alloc(10);
    testa[1] = 0x80 | 127;
    testa.writeBigUInt64BE(BigInt(dati.length), 2);
  }
  testa[0] = (finito ? 0x80 : 0x00) | tipo;
  const coperti = Buffer.from(dati);
  for (let i = 0; i < coperti.length; i += 1) coperti[i] ^= maschera[i & 3];
  return Buffer.concat([testa, maschera, coperti]);
}

test("il telaio si stacca, e i byte che avanzano restano", () => {
  const due = Buffer.concat([telaioDalCliente(0x1, "uno"), telaioDalCliente(0x1, "due")]);
  const primo = staccaIlTelaio(due);
  assert.equal(primo.carico.toString(), "uno");
  const secondo = staccaIlTelaio(due.subarray(primo.consumati));
  assert.equal(secondo.carico.toString(), "due");
});

test("i byte che non bastano danno null, non un errore", () => {
  const intero = telaioDalCliente(0x1, "abbastanza lungo da spezzarsi");
  for (let taglio = 0; taglio < intero.length; taglio += 1) {
    assert.equal(staccaIlTelaio(intero.subarray(0, taglio)), null, `tagliato a ${taglio}`);
  }
  assert.equal(staccaIlTelaio(intero).carico.toString(), "abbastanza lungo da spezzarsi");
});

test("le tre lunghezze del telaio si leggono tutte", () => {
  for (const quanti of [0, 125, 126, 700, 65535, 65536, 70000]) {
    const dati = "x".repeat(quanti);
    assert.equal(staccaIlTelaio(telaioDalCliente(0x1, dati)).carico.length, quanti, `${quanti}`);
  }
});

test("un telaio senza maschera si rifiuta", () => {
  assert.throws(() => staccaIlTelaio(telaio(0x1, "senza maschera")), ErroreDiProtocollo);
});

test("i bit riservati accesi si rifiutano", () => {
  const t = telaioDalCliente(0x1, "ciao");
  t[0] |= 0x40;
  assert.throws(() => staccaIlTelaio(t), ErroreDiProtocollo);
});

test("un telaio di servizio spezzato si rifiuta", () => {
  assert.throws(
    () => staccaIlTelaio(telaioDalCliente(0x9, "ping", { finito: false })),
    ErroreDiProtocollo,
  );
});

test("un carico annunciato piu' grande del limite si rifiuta senza metterlo da parte", () => {
  const testa = Buffer.alloc(10);
  testa[0] = 0x81;
  testa[1] = 0x80 | 127;
  testa.writeBigUInt64BE(BigInt(5 * 1024 * 1024), 2);
  assert.throws(() => staccaIlTelaio(Buffer.concat([testa, Buffer.alloc(4)])), ErroreDiCarico);
});

/* ─── La presa intera, con un cliente vero ───────────────────────────────── */

async function conUnaPresa(opzioni, prova) {
  const server = createServer((_richiesta, risposta) => risposta.end());
  const prese = [];
  server.on("upgrade", (richiesta, socket) => {
    const presa = accetta(richiesta, socket, opzioni(prese));
    if (presa) prese.push(presa);
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const porta = server.address().port;
  try {
    await prova(`ws://127.0.0.1:${porta}`, prese);
  } finally {
    for (const presa of prese) presa.chiudi();
    await new Promise((ok) => server.close(ok));
  }
}

test("un cliente vero si collega, parla, e viene risposto", async () => {
  const sentiti = [];
  await conUnaPresa(
    () => ({ onMessaggio: (testo) => sentiti.push(testo) }),
    async (indirizzo, prese) => {
      const cliente = new WebSocket(indirizzo);
      const risposte = [];
      cliente.addEventListener("message", (evento) => risposte.push(evento.data));
      await new Promise((ok, no) => {
        cliente.addEventListener("open", ok);
        cliente.addEventListener("error", () => no(new Error("il cliente non e' entrato")));
      });

      cliente.send("buongiorno");
      await attendi(() => sentiti.length === 1);
      assert.deepEqual(sentiti, ["buongiorno"]);

      prese[0].manda("buonasera");
      await attendi(() => risposte.length === 1);
      assert.deepEqual(risposte, ["buonasera"]);
      cliente.close();
    },
  );
});

test("un messaggio lungo torna intero", async () => {
  const lungo = "z".repeat(300_000);
  const sentiti = [];
  await conUnaPresa(
    () => ({ onMessaggio: (testo) => sentiti.push(testo) }),
    async (indirizzo, prese) => {
      const cliente = new WebSocket(indirizzo);
      const risposte = [];
      cliente.addEventListener("message", (evento) => risposte.push(evento.data));
      await new Promise((ok) => cliente.addEventListener("open", ok));

      cliente.send(lungo);
      await attendi(() => sentiti.length === 1);
      assert.equal(sentiti[0].length, lungo.length);

      prese[0].manda(lungo);
      await attendi(() => risposte.length === 1);
      assert.equal(risposte[0].length, lungo.length);
      cliente.close();
    },
  );
});

test("la chiusura si annuncia una volta sola", async () => {
  let chiusure = 0;
  await conUnaPresa(
    () => ({ onChiusa: () => (chiusure += 1) }),
    async (indirizzo) => {
      const cliente = new WebSocket(indirizzo);
      await new Promise((ok) => cliente.addEventListener("open", ok));
      cliente.close();
      await attendi(() => chiusure > 0);
      await nuovoGiro(60);
      assert.equal(chiusure, 1);
    },
  );
});

test("un messaggio oltre il limite chiude la presa invece di ingoiarlo", async () => {
  let chiusa = false;
  await conUnaPresa(
    () => ({ messaggioMassimo: 1024, onChiusa: () => (chiusa = true) }),
    async (indirizzo) => {
      const cliente = new WebSocket(indirizzo);
      await new Promise((ok) => cliente.addEventListener("open", ok));
      cliente.send("y".repeat(4096));
      await attendi(() => chiusa);
      assert.equal(chiusa, true);
    },
  );
});

test("una salita senza chiave non diventa una presa", async () => {
  /* Qui serve un socket nudo, non `fetch`: le intestazioni di salita sono
   * proibite dentro fetch, che le toglie, e la richiesta arriverebbe come una
   * GET qualunque senza mai passare dalla stretta di mano. */
  const server = createServer((_r, risposta) => risposta.end());
  let esito = "mai chiamato";
  server.on("upgrade", (richiesta, socket) => {
    esito = accetta(richiesta, socket, {});
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const porta = server.address().port;
  try {
    const detto = await bussa(
      porta,
      "GET / HTTP/1.1\r\nhost: 127.0.0.1\r\nconnection: Upgrade\r\nupgrade: websocket\r\n\r\n",
    );
    assert.equal(esito, null);
    assert.match(detto, /^HTTP\/1\.1 400 /);
  } finally {
    await new Promise((ok) => server.close(ok));
  }
});

test("una salita con la chiave giusta riceve il 101 e la firma", async () => {
  const server = createServer((_r, risposta) => risposta.end());
  const prese = [];
  server.on("upgrade", (richiesta, socket) => {
    const presa = accetta(richiesta, socket, {});
    if (presa) prese.push(presa);
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const porta = server.address().port;
  try {
    const chiave = "dGhlIHNhbXBsZSBub25jZQ==";
    const detto = await bussa(
      porta,
      "GET / HTTP/1.1\r\nhost: 127.0.0.1\r\nconnection: Upgrade\r\nupgrade: websocket\r\n" +
        `sec-websocket-key: ${chiave}\r\nsec-websocket-version: 13\r\n\r\n`,
    );
    assert.match(detto, /^HTTP\/1\.1 101 /);
    assert.match(detto.toLowerCase(), /sec-websocket-accept: s3ppLMBiTxaQ9kYGzzhZRbK\+xOo=/i);
    assert.equal(prese.length, 1);
  } finally {
    for (const presa of prese) presa.chiudi();
    await new Promise((ok) => server.close(ok));
  }
});

/* ─── Attese ─────────────────────────────────────────────────────────────── */

/* Manda una richiesta grezza e torna quello che il server risponde. */
function bussa(porta, richiesta) {
  return new Promise((ok, no) => {
    const socket = connect(porta, "127.0.0.1", () => socket.write(richiesta));
    let detto = "";
    socket.on("data", (pezzo) => {
      detto += pezzo.toString("latin1");
      if (detto.includes("\r\n\r\n")) {
        socket.destroy();
        ok(detto);
      }
    });
    socket.on("error", no);
    socket.setTimeout(3000, () => {
      socket.destroy();
      no(new Error("il server non ha risposto"));
    });
  });
}

const nuovoGiro = (millesimi = 5) => new Promise((ok) => setTimeout(ok, millesimi));

async function attendi(condizione, entro = 4000) {
  const fine = Date.now() + entro;
  while (Date.now() < fine) {
    if (condizione()) return;
    await nuovoGiro();
  }
  throw new Error("l'attesa e' scaduta");
}
