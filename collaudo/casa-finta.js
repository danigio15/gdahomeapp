/* Una Home Assistant finta, per guardare l'app dal vivo.
 *
 * Sta dietro al ponte vero e si comporta come Home Assistant quanto basta:
 * fa la stretta di mano, risponde a `get_states`, accetta i comandi e cambia
 * lo stato di conseguenza — cosi' premendo un interruttore nell'app la luce si
 * spegne davvero, e si vede.
 */

import { createServer } from "node:http";
import { createHash } from "node:crypto";

export const SEGNO_DEL_SUPERVISOR = "segno-finto-del-supervisor";

/* Una casa piccola ma con dentro tutto quello che la home sa raccontare:
 * luci accese e spente, una finestra aperta, due temperature, un antifurto,
 * una presa, e una cosa che non risponde. */
const CASA = [
  ent("light.cucina", "on", { friendly_name: "Luce cucina" }),
  ent("light.salotto", "on", { friendly_name: "Luce salotto" }),
  ent("light.camera", "off", { friendly_name: "Luce camera" }),
  ent("light.bagno", "off", { friendly_name: "Luce bagno" }),
  ent("binary_sensor.finestra_bagno", "on", {
    friendly_name: "Finestra bagno",
    device_class: "window",
  }),
  ent("binary_sensor.porta_ingresso", "off", {
    friendly_name: "Porta d'ingresso",
    device_class: "door",
  }),
  ent("sensor.soggiorno", "21.4", {
    friendly_name: "Temperatura soggiorno",
    device_class: "temperature",
    unit_of_measurement: "°C",
  }),
  ent("sensor.camera", "19.8", {
    friendly_name: "Temperatura camera",
    device_class: "temperature",
    unit_of_measurement: "°C",
  }),
  ent("alarm_control_panel.casa", "disarmed", { friendly_name: "Antifurto" }),
  ent("switch.lavatrice", "on", { friendly_name: "Presa lavatrice" }),
  ent("sensor.sonda_garage", "unavailable", { friendly_name: "Sonda garage" }),
];

function ent(entity_id, state, attributes = {}) {
  return {
    entity_id,
    state,
    attributes,
    last_changed: new Date().toISOString(),
  };
}

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
      case "subscribe_events":
        sottoscrizioni.set(socket, detto.id);
        ok();
        return;
      case "unsubscribe_events":
        sottoscrizioni.delete(socket);
        ok();
        return;
      case "call_service": {
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
