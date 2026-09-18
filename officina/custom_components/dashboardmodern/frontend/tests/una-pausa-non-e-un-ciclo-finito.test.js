/* «La card mi crea dei mini cicli» (#26).
 *
 * > Sto provando le card degli elettrodomestici… sto facendo una prova con la
 * > lavatrice con una presa comandata, vedo che la card mi crea dei mini cicli
 * > perché ogni tanto il consumo va a 0 W e poi riparte con un nuovo ciclo.
 *
 * Una lavatrice a metà programma sta ferma davvero — fra il carico dell'acqua
 * e il lavaggio, nell'ammollo, prima della centrifuga — e una presa smart quei
 * minuti li vede come zero watt. La card fa bene a dire STANDBY: è la verità,
 * ed è quello che un'altra segnalazione aveva chiesto («una presa accesa a
 * zero watt è STANDBY»). Chi sbagliava era il conto dei cicli: a ogni pausa ne
 * chiudeva uno e al risveglio ne apriva un altro.
 *
 * Alla fine del bucato: quattro cicli da venti minuti invece di uno da un'ora
 * e mezza, con quattro consumi e quattro costi che non sono niente.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { createCycleTracker } from "../src/core/appliance-cycle-tracker.js";

function fakeStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
  };
}

function fakeClock(start) {
  let value = start;
  const now = () => value;
  now.advance = (ms) => {
    value += ms;
    return value;
  };
  return now;
}

const T0 = Date.parse("2026-09-18T09:00:00");
const MINUTO = 60000;

/** Gira il programma: `passi` minuti a quei watt, un campione al minuto. */
function gira(tracker, clock, minuti, watts) {
  for (let i = 0; i < minuti; i += 1) {
    clock.advance(MINUTO);
    tracker.update([{ id: "lavatrice", mode: watts > 0 ? "running" : "standby", watts }]);
  }
}

test("una pausa a zero watt non chiude il ciclo: il bucato è uno solo", () => {
  const clock = fakeClock(T0);
  const tracker = createCycleTracker({ storage: fakeStorage(), now: clock });

  tracker.update([{ id: "lavatrice", mode: "running", watts: 2000 }]);
  gira(tracker, clock, 20, 2000); // lavaggio
  gira(tracker, clock, 8, 0); // ammollo: la presa vede zero
  gira(tracker, clock, 20, 2000); // risciacquo
  gira(tracker, clock, 6, 0); // fermo prima della centrifuga
  gira(tracker, clock, 10, 1500); // centrifuga
  /* Finito davvero. */
  clock.advance(MINUTO);
  tracker.update([{ id: "lavatrice", mode: "off", watts: 0 }]);

  const ultimo = tracker.record("lavatrice").last;
  assert.ok(ultimo, "un ciclo c'è");
  /* Un'ora e cinque, non venti minuti: le pause stanno dentro, perché la
   * macchina in quei minuti il bucato ce l'aveva ancora dentro. */
  assert.equal(ultimo.durationMinutes, 65);
  assert.equal(ultimo.startMs, T0);
  /* E il consumo è quello di tutto il programma, non dell'ultimo pezzo. */
  assert.ok(ultimo.kwh > 0.8, `kwh: ${ultimo.kwh}`);
});

test("due bucati veri restano due bucati", () => {
  /* L'errore opposto, e sarebbe peggio: unire quello di stamattina con quello
   * del pomeriggio vuol dire un ciclo da sei ore e un costo che non è di
   * nessuno. Fra due carichi passa sempre più di venti minuti — bisogna
   * svuotare il cestello e rifare il carico. */
  const clock = fakeClock(T0);
  const tracker = createCycleTracker({ storage: fakeStorage(), now: clock });

  tracker.update([{ id: "lavatrice", mode: "running", watts: 2000 }]);
  gira(tracker, clock, 40, 2000);
  clock.advance(MINUTO);
  tracker.update([{ id: "lavatrice", mode: "off", watts: 0 }]);
  const primo = { ...tracker.record("lavatrice").last };

  clock.advance(90 * MINUTO);
  tracker.update([{ id: "lavatrice", mode: "running", watts: 2000 }]);
  gira(tracker, clock, 30, 2000);
  clock.advance(MINUTO);
  tracker.update([{ id: "lavatrice", mode: "off", watts: 0 }]);
  const secondo = tracker.record("lavatrice").last;

  assert.notEqual(secondo.startMs, primo.startMs);
  assert.equal(secondo.durationMinutes, 31);
});

test("durante la pausa la riga «ultimo ciclo» non racconta mezzo bucato", () => {
  /* Il pezzo già finito si ritira quando la macchina riparte: era un pezzo di
   * questo ciclo, non un ciclo. */
  const clock = fakeClock(T0);
  const tracker = createCycleTracker({ storage: fakeStorage(), now: clock });

  tracker.update([{ id: "lavatrice", mode: "running", watts: 2000 }]);
  gira(tracker, clock, 20, 2000);
  gira(tracker, clock, 5, 0);
  /* Qui, a macchina ferma, la riga c'è: per quanto ne sa, ha finito. */
  assert.ok(tracker.record("lavatrice").last);
  gira(tracker, clock, 10, 2000);
  /* Ripartita: la riga di prima se n'è andata, e il ciclo è tornato aperto. */
  assert.equal(tracker.record("lavatrice").last, undefined);
  assert.equal(tracker.record("lavatrice").active.startMs, T0);
});
