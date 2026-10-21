/* La presa morta si rifa'.
 *
 * Dal campo: «Il Recorder di Home Assistant ci ha messo troppo a
 * rispondere… poi non si aggiorna, devo chiudere e riaprire l'app». Col
 * telefono in tasca la presa resta «aperta» per il browser, ma dall'altra
 * parte non c'e' piu' nessuno: ogni domanda scadeva, la colpa andava al
 * Recorder, e la presa non si rifaceva mai. Qui: una domanda scaduta su una
 * presa zitta fa partire un «ping»; se tace anche quello, la presa si butta.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { HomeAssistantBroker } from "../src/core/period-service.js";
import { spiegazioneDellErrore } from "../src/sections/energy-section.js";

function presaFinta(broker, { pong = false, parla = false } = {}) {
  const spedite = [];
  const socket = {
    readyState: 1,
    chiusa: false,
    close() {
      this.chiusa = true;
    },
    send(raw) {
      const m = JSON.parse(raw);
      spedite.push(m);
      if (m.type === "ping" && pong)
        queueMicrotask(() =>
          broker.handleMessage(
            JSON.stringify({ type: "pong", id: m.id }),
            () => {},
            () => {},
          ),
        );
      /* Una presa viva: gli eventi degli stati continuano ad arrivare. */
      if (parla)
        queueMicrotask(() =>
          broker.handleMessage(
            JSON.stringify({ type: "event", id: 999 }),
            () => {},
            () => {},
          ),
        );
    },
  };
  broker.connect = async () => {
    broker.socket = socket;
    broker.authenticated = true;
    return socket;
  };
  broker.socket = socket;
  broker.authenticated = true;
  return { socket, spedite };
}

const aspetta = (ms) => new Promise((r) => setTimeout(r, ms));

test("una presa che non risponde nemmeno al ping si butta", async () => {
  const broker = new HomeAssistantBroker({ timeout: 20 });
  const { socket, spedite } = presaFinta(broker);
  await assert.rejects(
    broker.request({ type: "recorder/statistics_during_period" }),
    /response timeout/,
  );
  /* Non e' il Recorder: la presa era zitta. */
  assert.equal(broker.recorderInAffanno(), false);
  await aspetta(60);
  assert.ok(spedite.some((m) => m.type === "ping"));
  assert.equal(broker.socket, null, "la presa morta si butta");
  assert.equal(socket.chiusa, true);
});

test("una presa che risponde al ping resta; il Recorder lento si segna come prima", async () => {
  const broker = new HomeAssistantBroker({ timeout: 20 });
  const { socket } = presaFinta(broker, { parla: true });
  await assert.rejects(
    broker.request({ type: "recorder/statistics_during_period" }),
    /response timeout/,
  );
  assert.equal(broker.recorderInAffanno(), true);
  assert.equal(broker.socket, socket);
});

test("tornando davanti si verifica la presa col ping", async () => {
  const broker = new HomeAssistantBroker({ timeout: 20 });
  presaFinta(broker, { pong: true });
  assert.equal(await broker.verificaLaPresa(20), true);
  const morta = new HomeAssistantBroker({ timeout: 20 });
  presaFinta(morta);
  assert.equal(await morta.verificaLaPresa(20), false);
  assert.equal(morta.socket, null);
});

test("la presa caduta non si dice colpa del Recorder", () => {
  assert.match(
    spiegazioneDellErrore("Home Assistant connection lost", {}),
    /connessione con Home Assistant si è interrotta/,
  );
  assert.match(spiegazioneDellErrore("Home Assistant response timeout", {}), /Recorder/);
});
