/* Le prove della presa che chiama.
 *
 * Questo pezzo esiste perche' il `WebSocket` di Node non c'e' dove il ponte
 * gira davvero, e il difetto non si vedeva da nessuna parte: le prove giravano
 * su una versione di Node che ce l'ha, e i finti che si iniettano non sono mai
 * il vero. Quindi qui il finto non c'e': si accende un server vero — quello
 * scritto in `presa.js` — e ci si parla sopra.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHash } from "node:crypto";

import { accetta, staccaIlTelaio } from "../src/presa.js";
import { Chiamante, APERTA, CHIUSA } from "../src/chiamante.js";

/* Un server che accetta e fa quello che gli si dice. */
async function unServer({ appenaAperto = null, rispondi = null } = {}) {
  const prese = [];
  const arrivati = [];
  const server = createServer((_r, risposta) => risposta.end("non qui"));

  server.on("upgrade", (richiesta, socket) => {
    const presa = accetta(richiesta, socket, {
      onMessaggio: (testo) => {
        arrivati.push(testo);
        if (rispondi) presa.manda(rispondi(testo));
      },
    });
    if (!presa) return;
    prese.push(presa);
    /* Il caso che conta: il primo messaggio parte **subito**, e finisce nello
     * stesso pezzo di rete della risposta 101. */
    if (appenaAperto) presa.manda(appenaAperto);
  });

  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  return {
    dove: `ws://127.0.0.1:${server.address().port}/qualcosa`,
    prese,
    arrivati,
    spegni: async () => {
      for (const presa of prese) presa.chiudi();
      await new Promise((ok) => server.close(ok));
    },
  };
}

/* Un server che risponde a mano, per provare le strette di mano storte. */
async function unServerStorto(risposta) {
  const socket_ = [];
  const server = createServer((_r, r) => r.end("non qui"));
  server.on("upgrade", (_richiesta, socket) => {
    socket_.push(socket);
    socket.write(risposta);
    if (!risposta.includes("101")) socket.end();
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  return {
    dove: `ws://127.0.0.1:${server.address().port}/`,
    /* I socket saliti a WebSocket non li chiude piu' nessuno: il server HTTP
     * se li e' tolti di mezzo quando sono saliti, e chi ha chiamato ha buttato
     * giu' solo la propria meta'. Se non li si stacca a mano, `server.close`
     * aspetta per sempre e la prova non finisce mai. */
    spegni: async () => {
      for (const socket of socket_) socket.destroy();
      await new Promise((ok) => server.close(ok));
    },
  };
}

const attendi = (condizione, entro = 4000) =>
  new Promise((riuscito, fallito) => {
    const fine = Date.now() + entro;
    const giro = setInterval(() => {
      if (condizione()) {
        clearInterval(giro);
        riuscito();
      } else if (Date.now() > fine) {
        clearInterval(giro);
        fallito(new Error("l'attesa e' scaduta"));
      }
    }, 5);
  });

/* ─── Il giro normale ────────────────────────────────────────────────────── */

test("si collega, e i messaggi vanno avanti e indietro", async () => {
  const s = await unServer({ rispondi: (testo) => `eco: ${testo}` });
  try {
    const c = new Chiamante(s.dove);
    const detti = [];
    c.addEventListener("message", (evento) => detti.push(evento.data));
    await attendi(() => c.readyState === APERTA);

    c.send("ciao");
    await attendi(() => detti.length === 1);
    assert.deepEqual(s.arrivati, ["ciao"]);
    assert.deepEqual(detti, ["eco: ciao"]);

    c.close();
    await attendi(() => c.readyState === CHIUSA);
  } finally {
    await s.spegni();
  }
});

test("il primo messaggio non si perde quando arriva insieme alla risposta", async () => {
  /* La prova del difetto vero.
   *
   * La risposta 101 e il primo telaio partono a un millesimo di distanza,
   * quindi quasi sempre arrivano nello stesso pezzo di rete. Chi legge le
   * intestazioni e butta il resto perde `auth_required` — cioe' la parola che
   * fa cominciare tutto — e la stretta di mano con Home Assistant si ferma li',
   * senza un errore da nessuna parte.
   *
   * E c'era anche il rovescio: se il messaggio si legge **prima** di
   * dichiararsi aperti, chi risponde risponde a un filo che per noi non e'
   * ancora aperto, e la risposta viene buttata in silenzio. Percio' qui si
   * guarda tutte e due le cose: che il messaggio arrivi, e che si possa
   * rispondere subito. */
  const s = await unServer({
    appenaAperto: JSON.stringify({ type: "auth_required" }),
    rispondi: () => JSON.stringify({ type: "auth_ok" }),
  });
  try {
    const c = new Chiamante(s.dove);
    const detti = [];
    let apertoQuando = -1;

    c.addEventListener("open", () => {
      apertoQuando = detti.length;
    });
    c.addEventListener("message", (evento) => {
      detti.push(evento.data);
      /* Si risponde dentro il gestore, come fa `casa.js`. */
      if (JSON.parse(evento.data).type === "auth_required") c.send("eccomi");
    });

    await attendi(() => detti.length === 2);
    assert.deepEqual(JSON.parse(detti[0]), { type: "auth_required" });
    assert.deepEqual(JSON.parse(detti[1]), { type: "auth_ok" });
    assert.equal(apertoQuando, 0, "«aperto» arriva prima del primo messaggio");
    assert.deepEqual(s.arrivati, ["eccomi"]);

    c.close();
  } finally {
    await s.spegni();
  }
});

test("quello che manda e' mascherato, come vuole il protocollo", async () => {
  /* Non e' pignoleria: un server che riceve un telaio senza maschera da un
   * cliente chiude il filo, ed e' giusto. Qui si guarda il telaio grezzo. */
  const s = await unServer();
  try {
    const c = new Chiamante(s.dove);
    await attendi(() => c.readyState === APERTA);

    const scritti = [];
    const vero = c._presa.socket.write.bind(c._presa.socket);
    c._presa.socket.write = (byte) => {
      scritti.push(Buffer.from(byte));
      return vero(byte);
    };
    c.send("mascherami");
    await attendi(() => scritti.length > 0);

    /* Il secondo byte porta il bit della maschera. */
    assert.equal((scritti[0][1] & 0x80) !== 0, true, "il bit della maschera e' acceso");
    /* E si riapre solo leggendolo come lo legge un server. */
    const letto = staccaIlTelaio(scritti[0], 1024, { vuoleLaMaschera: true });
    assert.equal(letto.carico.toString("utf8"), "mascherami");

    c.close();
  } finally {
    await s.spegni();
  }
});

test("un colpetto del server riceve la risposta, e il filo resta su", async () => {
  const s = await unServer();
  try {
    const c = new Chiamante(s.dove);
    await attendi(() => c.readyState === APERTA);

    let pong = false;
    s.prese[0].onPong = () => {
      pong = true;
    };
    s.prese[0].ping();

    await attendi(() => pong);
    assert.equal(c.readyState, APERTA);
    c.close();
  } finally {
    await s.spegni();
  }
});

test("chiudere lo dice una volta sola", async () => {
  const s = await unServer();
  try {
    const c = new Chiamante(s.dove);
    await attendi(() => c.readyState === APERTA);

    let quante = 0;
    c.addEventListener("close", () => {
      quante += 1;
    });
    c.close();
    c.close();
    await attendi(() => c.readyState === CHIUSA);
    await new Promise((ok) => setTimeout(ok, 100));
    assert.equal(quante, 1);
  } finally {
    await s.spegni();
  }
});

test("quando il server se ne va, chi ha chiamato lo sa", async () => {
  const s = await unServer();
  try {
    const c = new Chiamante(s.dove);
    await attendi(() => c.readyState === APERTA);
    s.prese[0].chiudi();
    await attendi(() => c.readyState === CHIUSA);
  } finally {
    await s.spegni();
  }
});

/* ─── Quando dall'altra parte non c'e' quello che pensiamo ──────────────── */

test("un indirizzo dove non risponde nessuno finisce in errore, non appeso", async () => {
  const c = new Chiamante("ws://127.0.0.1:1/niente");
  const guai = [];
  c.addEventListener("error", (evento) => guai.push(evento.message));
  await attendi(() => c.readyState === CHIUSA);
  assert.equal(guai.length, 1);
});

test("una pagina web al posto di un WebSocket non passa per buona", async () => {
  const s = await unServerStorto("HTTP/1.1 200 OK\r\ncontent-length: 4\r\n\r\nciao");
  try {
    const c = new Chiamante(s.dove);
    const guai = [];
    c.addEventListener("error", (evento) => guai.push(evento.message));
    await attendi(() => c.readyState === CHIUSA);
    assert.match(guai[0], /200/);
  } finally {
    await s.spegni();
  }
});

test("un 101 con la firma sbagliata non passa", async () => {
  /* Quella firma non e' un segreto e non difende da niente: dice soltanto che
   * dall'altra parte c'e' qualcuno che il protocollo lo conosce davvero. */
  const finta = createHash("sha256").update("non la chiave giusta").digest("base64");
  const s = await unServerStorto(
    `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${finta}\r\n\r\n`,
  );
  try {
    const c = new Chiamante(s.dove);
    const guai = [];
    c.addEventListener("error", (evento) => guai.push(evento.message));
    await attendi(() => c.readyState === CHIUSA);
    assert.match(guai[0], /firma/);
  } finally {
    await s.spegni();
  }
});

test("un indirizzo che non e' un indirizzo non esplode in faccia a chi chiama", async () => {
  const c = new Chiamante("questo non e' un indirizzo");
  const guai = [];
  c.addEventListener("error", (evento) => guai.push(evento.message));
  await attendi(() => c.readyState === CHIUSA);
  assert.equal(guai.length, 1);
});

test("uno schema che non conosciamo si rifiuta subito", async () => {
  const c = new Chiamante("ftp://127.0.0.1/qualcosa");
  const guai = [];
  c.addEventListener("error", (evento) => guai.push(evento.message));
  await attendi(() => c.readyState === CHIUSA);
  assert.match(guai[0], /ftp/);
});

test("scrivere su un filo non ancora aperto non fa danni", async () => {
  const s = await unServer();
  try {
    const c = new Chiamante(s.dove);
    /* Prima che sia aperto: si perde, e va bene — ma non deve sollevare. */
    c.send("troppo presto");
    await attendi(() => c.readyState === APERTA);
    c.send("adesso si");
    await attendi(() => s.arrivati.length === 1);
    assert.deepEqual(s.arrivati, ["adesso si"]);
    c.close();
  } finally {
    await s.spegni();
  }
});
