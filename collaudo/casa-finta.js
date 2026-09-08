/* Una Home Assistant finta, per guardare l'app dal vivo.
 *
 * Sta dietro al ponte vero e si comporta come Home Assistant quanto basta:
 * fa la stretta di mano, risponde a `get_states`, accetta i comandi e cambia
 * lo stato di conseguenza — cosi' premendo un interruttore nell'app la luce si
 * spegne davvero, e si vede.
 */

import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const SEGNO_DEL_SUPERVISOR = "segno-finto-del-supervisor";

/* La casa demo di DashboardModern: la stessa casa inventata con cui la plancia
 * web disegna le sue anteprime, con dentro tutto — persone, luci, clima,
 * energia, elettrodomestici, auto, piscina — e la configurazione della plancia
 * gia' fatta. Cosi' quello che si fotografa qui si confronta con quelle
 * anteprime, tessera per tessera.
 *
 * Le date delle entita' si rimettono a «un minuto e mezzo fa» a ogni
 * accensione: nel file sono ferme al giorno in cui e' stato scritto, e le
 * persone direbbero «visto 40 giorni fa». */
const DEMO = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "casa-demo.json"), "utf8"));
const ADESSO = new Date(Date.now() - 90_000).toISOString();
const CASA = DEMO.entita.map((una) => ({ ...una, last_changed: ADESSO, last_updated: ADESSO }));
const CONFIGURAZIONE = DEMO.configurazione;

/* Gli appuntamenti e le cose da fare non stanno negli stati.
 *
 * Lo stato di un `calendar.*` dice soltanto se c'e' qualcosa in corso, quello
 * di un `todo.*` soltanto quante voci restano: le voci vere si chiedono coi
 * servizi `calendar.get_events` e `todo.get_items`, e solo con
 * `return_response`. Qui si risponde come risponderebbe Home Assistant.
 *
 * Le date sono relative a oggi, se no dopo una settimana l'agenda del
 * collaudo sarebbe tutta scaduta. */
function fraQuanto(giorni, ore, minuti = 0) {
  const quando = new Date();
  quando.setDate(quando.getDate() + giorni);
  quando.setHours(ore, minuti, 0, 0);
  return quando;
}

/* Senza fuso, come li scrive Home Assistant per gli eventi con un'ora. */
const scritto = (data) =>
  `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-` +
  `${String(data.getDate()).padStart(2, "0")}T` +
  `${String(data.getHours()).padStart(2, "0")}:` +
  `${String(data.getMinutes()).padStart(2, "0")}:00`;

const soloIlGiorno = (data) =>
  `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-` +
  `${String(data.getDate()).padStart(2, "0")}`;

const EVENTI = {
  "calendar.famiglia": [
    {
      summary: "Dentista — Laura",
      start: scritto(fraQuanto(0, 17, 30)),
      end: scritto(fraQuanto(0, 18, 30)),
      location: "Studio Bianchi",
    },
    {
      summary: "Cena dai nonni",
      start: scritto(fraQuanto(0, 20, 0)),
      end: scritto(fraQuanto(0, 22, 30)),
    },
    {
      summary: "Saggio di Marco",
      start: scritto(fraQuanto(1, 16, 0)),
      end: scritto(fraQuanto(1, 18, 0)),
      location: "Teatro comunale",
    },
    {
      summary: "Gita in montagna",
      start: soloIlGiorno(fraQuanto(3, 0)),
      end: soloIlGiorno(fraQuanto(4, 0)),
    },
  ],
  "calendar.lavoro": [
    {
      summary: "Riunione settimanale",
      start: scritto(fraQuanto(0, 9, 0)),
      end: scritto(fraQuanto(0, 10, 0)),
    },
    {
      summary: "Consegna preventivo",
      start: scritto(fraQuanto(2, 11, 0)),
      end: scritto(fraQuanto(2, 12, 0)),
    },
  ],
};

const COSE = {
  "todo.spesa": [
    { uid: "1", summary: "Pane e latte", status: "needs_action" },
    { uid: "2", summary: "Caffe'", status: "needs_action" },
    { uid: "3", summary: "Detersivo piatti", status: "needs_action" },
    { uid: "4", summary: "Frutta", status: "needs_action" },
    { uid: "5", summary: "Pasta", status: "completed" },
  ],
  "todo.casa": [
    {
      uid: "6",
      summary: "Revisione auto",
      status: "needs_action",
      due: soloIlGiorno(fraQuanto(2, 0)),
    },
    {
      uid: "7",
      summary: "Cambiare filtro cappa",
      status: "needs_action",
      due: soloIlGiorno(fraQuanto(-3, 0)),
    },
  ],
};

/* ─── La presa WebSocket, la stessa del ponte ─────────────────────────────── */

const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

function firma(chiave) {
  return createHash("sha1").update(chiave + GUID).digest("base64");
}

function telaio(carico) {
  const dati = Buffer.from(carico, "utf8");
  let testa;
  if (dati.length < 126) {
    testa = Buffer.alloc(2);
    testa[1] = dati.length;
  } else if (dati.length < 65536) {
    testa = Buffer.alloc(4);
    testa[1] = 126;
    testa.writeUInt16BE(dati.length, 2);
  } else {
    testa = Buffer.alloc(10);
    testa[1] = 127;
    testa.writeBigUInt64BE(BigInt(dati.length), 2);
  }
  testa[0] = 0x81;
  return Buffer.concat([testa, dati]);
}

function stacca(buffer) {
  if (buffer.length < 2) return null;
  const tipo = buffer[0] & 0x0f;
  let lunghezza = buffer[1] & 0x7f;
  let inizio = 2;
  if (lunghezza === 126) {
    if (buffer.length < 4) return null;
    lunghezza = buffer.readUInt16BE(2);
    inizio = 4;
  } else if (lunghezza === 127) {
    if (buffer.length < 10) return null;
    lunghezza = Number(buffer.readBigUInt64BE(2));
    inizio = 10;
  }
  const finaMaschera = inizio + 4;
  if (buffer.length < finaMaschera + lunghezza) return null;
  const maschera = buffer.subarray(inizio, finaMaschera);
  const carico = Buffer.from(buffer.subarray(finaMaschera, finaMaschera + lunghezza));
  for (let i = 0; i < carico.length; i += 1) carico[i] ^= maschera[i & 3];
  return { tipo, carico, consumati: finaMaschera + lunghezza };
}

/* ─── La casa ─────────────────────────────────────────────────────────────── */

export function alzaLaCasaFinta() {
  const entita = new Map(CASA.map((una) => [una.entity_id, structuredClone(una)]));
  const prese = new Set();
  const sottoscrizioni = new Map();

  const server = createServer((_richiesta, risposta) => {
    risposta.writeHead(200, { "content-type": "application/json" });
    risposta.end('{"message":"API running."}');
  });

  server.on("upgrade", (richiesta, socket) => {
    const chiave = richiesta.headers["sec-websocket-key"];
    if (!chiave) {
      socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
      return;
    }
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\nupgrade: websocket\r\n" +
        `connection: Upgrade\r\nsec-websocket-accept: ${firma(chiave)}\r\n\r\n`,
    );
    prese.add(socket);
    let avanzo = Buffer.alloc(0);
    const manda = (cosa) => {
      try {
        socket.write(telaio(JSON.stringify(cosa)));
      } catch (_errore) {
        /* Chiusa. */
      }
    };
    manda({ type: "auth_required", ha_version: "2025.1.0 (finta)" });

    socket.on("data", (pezzo) => {
      avanzo = Buffer.concat([avanzo, pezzo]);
      for (;;) {
        const letto = stacca(avanzo);
        if (!letto) return;
        avanzo = avanzo.subarray(letto.consumati);
        if (letto.tipo === 0x8) {
          socket.end();
          return;
        }
        if (letto.tipo !== 0x1) continue;
        let detto;
        try {
          detto = JSON.parse(letto.carico.toString("utf8"));
        } catch (_errore) {
          continue;
        }
        rispondi(manda, socket, detto);
      }
    });
    socket.on("close", () => prese.delete(socket));
    socket.on("error", () => prese.delete(socket));
  });

  function rispondi(manda, socket, detto) {
    if (detto.type === "auth") {
      const buono = detto.access_token === SEGNO_DEL_SUPERVISOR;
      manda(buono ? { type: "auth_ok" } : { type: "auth_invalid" });
      if (!buono) socket.end();
      return;
    }
    const ok = (result = null) => manda({ id: detto.id, type: "result", success: true, result });

    switch (detto.type) {
      case "get_states":
        ok([...entita.values()]);
        return;
      /* La configurazione della plancia, come la da' DashboardModern. */
      case "dashboardmodern/config/get":
        ok(CONFIGURAZIONE);
        return;
      case "subscribe_events":
        sottoscrizioni.set(socket, detto.id);
        ok();
        return;
      case "unsubscribe_events":
        sottoscrizioni.delete(socket);
        ok();
        return;
      case "call_service": {
        /* I servizi che rispondono: si chiamano con `return_response`, e la
         * risposta e' l'unico modo di sapere cosa c'e' in un calendario o in
         * una lista. */
        const chiesto = [detto.target?.entity_id].flat().filter(Boolean)[0];
        if (detto.domain === "calendar" && detto.service === "get_events") {
          ok({ response: { [chiesto]: { events: EVENTI[chiesto] || [] } } });
          return;
        }
        if (detto.domain === "todo" && detto.service === "get_items") {
          ok({ response: { [chiesto]: { items: COSE[chiesto] || [] } } });
          return;
        }
        if (detto.domain === "todo" && detto.service === "update_item") {
          const voci = COSE[chiesto] || [];
          const quale = voci.find(
            (una) => una.uid === detto.service_data?.item || una.summary === detto.service_data?.item,
          );
          if (quale) quale.status = detto.service_data?.status || "completed";
          ok();
          return;
        }
        ok();
        /* Il comando cambia davvero lo stato, e il cambiamento torna
         * indietro: cosi' nell'app l'interruttore si muove per conto suo,
         * come farebbe in casa. */
        const chi = detto.target?.entity_id;
        const nuovo =
          detto.service === "turn_on" ? "on" : detto.service === "turn_off" ? "off" : null;
        for (const id of [chi].flat().filter(Boolean)) {
          const una = entita.get(id);
          if (!una) continue;
          una.state = nuovo ?? (una.state === "on" ? "off" : "on");
          una.last_changed = new Date().toISOString();
          racconta(una);
        }
        return;
      }
      default:
        ok();
    }
  }

  function racconta(una) {
    for (const [socket, numero] of sottoscrizioni) {
      if (socket.destroyed) continue;
      try {
        socket.write(
          telaio(
            JSON.stringify({
              id: numero,
              type: "event",
              event: {
                event_type: "state_changed",
                data: { entity_id: una.entity_id, new_state: una },
              },
            }),
          ),
        );
      } catch (_errore) {
        /* Chiusa. */
      }
    }
  }

  return {
    server,
    ascolta: () =>
      new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(server.address().port))),
    spegni: () =>
      new Promise((ok) => {
        for (const presa of prese) presa.destroy();
        server.close(ok);
      }),
  };
}
