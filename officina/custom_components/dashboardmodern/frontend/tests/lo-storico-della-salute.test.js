/* «Devi creare un popup al tap sulle card e sui giorni che mi fa vedere i
 * dati anche storici.» La finestra dello storico fa i conti con questi due:
 * il riassunto dei giorni e i punti con la fascia fra minimo e massimo. */
import assert from "node:assert/strict";
import test from "node:test";

import { puntiConFascia, riassuntoDeiGiorni } from "../src/core/salute.js";

const giorno = (n) => Date.parse("2026-11-01T00:00:00Z") + n * 86_400_000;

test("il riassunto: media, minimo, massimo, e il totale solo per quello che si somma", () => {
  const passi = [{ valore: 4000 }, { valore: 8000 }, { valore: 6000 }];
  assert.deepEqual(riassuntoDeiGiorni(passi, "total"), { media: 6000, minimo: 4000, massimo: 8000, totale: 18000, quanti: 3 });
  const battito = [{ valore: 60 }, { valore: 80 }];
  assert.equal(riassuntoDeiGiorni(battito, "measurement").totale, null);
  assert.equal(riassuntoDeiGiorni(battito, "measurement").media, 70);
  assert.equal(riassuntoDeiGiorni([], "total").quanti, 0);
  assert.equal(riassuntoDeiGiorni([{ valore: null }, { valore: 5 }], "measurement").quanti, 1);
});

test("il battito porta la fascia del giorno, i passi no", () => {
  const righe = [
    { start: giorno(0), mean: 70, min: 52, max: 120, state: 66 },
    { start: giorno(1), mean: 68, min: 50, max: 110, state: 64 },
  ];
  const battito = puntiConFascia(righe, "measurement");
  assert.deepEqual(battito[0], { inizio: giorno(0), valore: 70, minimo: 52, massimo: 120 });
  const passi = puntiConFascia([{ start: giorno(0), change: 6500, max: 6500, state: 6500 }], "total");
  assert.deepEqual(passi[0], { inizio: giorno(0), valore: 6500 });
});
