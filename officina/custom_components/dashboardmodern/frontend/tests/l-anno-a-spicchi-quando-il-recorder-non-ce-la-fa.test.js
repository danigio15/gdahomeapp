/* L'anno a spicchi, quando il Recorder non ce la fa.
 *
 * «Sto ancora leggendo le statistiche del Recorder · 3/4», e poi «Il Recorder
 * di Home Assistant ci ha messo troppo a rispondere», a ogni apertura
 * dell'Energia. La quarta domanda era l'anno: dieci mesi di righe di tutte le
 * entita' in una domanda sola, che su quella casa non stava nel minuto. Non
 * arrivando mai, non si teneva mai, e la volta dopo si cadeva uguale.
 *
 * Qui: l'arco lungo che scade si rifa' un mese alla volta (le stesse righe), i
 * mesi chiusi si tengono sul dispositivo per quella casa, e alla volta dopo il
 * Recorder non si richiama per niente.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { HomeAssistantBroker } from "../src/core/period-service.js";
import {
  StatisticheTenute,
  improntaDellaCasa,
  spicchiDellArco,
  unisciLeRighe,
} from "../src/core/statistiche-tenute.js";

function dispensa() {
  const dentro = new Map();
  return {
    getItem: (chiave) => (dentro.has(chiave) ? dentro.get(chiave) : null),
    setItem: (chiave, valore) => dentro.set(chiave, String(valore)),
    dentro,
  };
}

/* Un Recorder finto: una riga al giorno, il contatore sale di 1 kWh al giorno.
 * Le domande piu' lunghe di `oltre` giorni scadono. */
function brokerFinto({ storage, oltre = 40, casa = "casa-a" } = {}) {
  const domande = [];
  const tenute = new StatisticheTenute({ storage, impronta: () => casa });
  const broker = new HomeAssistantBroker({ tenute });
  broker.request = async (payload) => {
    domande.push(payload);
    const da = Date.parse(payload.start_time);
    const a = Date.parse(payload.end_time);
    if ((a - da) / 86400000 > oltre) throw new Error("Home Assistant response timeout");
    const righe = [];
    for (let t = new Date(da); t.getTime() < a; t.setDate(t.getDate() + 1)) {
      const giorni = Math.round((t.getTime() - Date.UTC(2025, 0, 1)) / 86400000);
      righe.push({ start: t.getTime(), end: t.getTime() + 86400000, sum: giorni, state: giorni });
    }
    return Object.fromEntries(payload.statistic_ids.map((id) => [id, righe]));
  };
  return { broker, domande };
}

const INIZIO = new Date(2025, 11, 1);
const FINE = new Date(2026, 10, 1);

test("gli spicchi si toccano senza sovrapporsi e coprono l'arco intero", () => {
  const spicchi = spicchiDellArco(INIZIO, FINE);
  assert.equal(spicchi.length, 11);
  assert.deepEqual(spicchi[0].start, INIZIO);
  assert.deepEqual(spicchi.at(-1).end, FINE);
  for (let i = 1; i < spicchi.length; i += 1)
    assert.deepEqual(spicchi[i].start, spicchi[i - 1].end);
  /* Un arco dentro un mese resta uno. */
  assert.equal(spicchiDellArco(new Date(2026, 10, 3), new Date(2026, 10, 9)).length, 1);
});

test("le righe di piu' spicchi tornano in ordine, una volta sola", () => {
  const unite = unisciLeRighe([
    { "sensor.a": [{ start: 3 }, { start: 1 }] },
    { "sensor.a": [{ start: 2 }, { start: 3 }] },
  ]);
  assert.deepEqual(
    unite["sensor.a"].map((riga) => riga.start),
    [1, 2, 3],
  );
});

test("l'anno che scade si rifa' a mesi, con le stesse righe dell'arco intero", async () => {
  const storage = dispensa();
  const { broker, domande } = brokerFinto({ storage });
  const righe = await broker.statistics(["sensor.casa_totale"], INIZIO, FINE, "day");
  /* Una domanda intera (scaduta) e undici mesi. */
  assert.equal(domande.length, 12);
  const giorni = righe["sensor.casa_totale"];
  assert.equal(giorni.length, Math.round((FINE - INIZIO) / 86400000));
  assert.ok(
    giorni.every((riga, i) => i === 0 || riga.start > giorni[i - 1].start),
    "righe in ordine e senza doppioni",
  );
});

test("la volta dopo i mesi chiusi arrivano dal dispositivo, senza chiedere", async () => {
  const storage = dispensa();
  const primo = brokerFinto({ storage });
  await primo.broker.statistics(["sensor.casa_totale"], INIZIO, FINE, "day");
  /* Una plancia nuova sullo stesso dispositivo: la memoria del broker e'
   * vuota, quella del dispositivo no. */
  const secondo = brokerFinto({ storage });
  const righe = await secondo.broker.statistics(["sensor.casa_totale"], INIZIO, FINE, "day");
  assert.equal(secondo.domande.length, 0, "il Recorder non si richiama per dei mesi chiusi");
  assert.equal(righe["sensor.casa_totale"].length, Math.round((FINE - INIZIO) / 86400000));
});

test("un'altra casa sullo stesso dispositivo non legge le righe della prima", async () => {
  const storage = dispensa();
  await brokerFinto({ storage, casa: "casa-a" }).broker.statistics(
    ["sensor.casa_totale"],
    INIZIO,
    FINE,
    "day",
  );
  const altra = brokerFinto({ storage, casa: "casa-b" });
  await altra.broker.statistics(["sensor.casa_totale"], INIZIO, FINE, "day");
  assert.ok(altra.domande.length > 0, "la seconda casa chiede le sue");
});

test("senza sapere che casa e' non si tiene niente sul dispositivo", async () => {
  const storage = dispensa();
  const tenute = new StatisticheTenute({ storage, impronta: () => "" });
  assert.equal(tenute.metti("k", { result: { a: [1] } }), false);
  assert.equal(storage.dentro.size, 0);
  assert.equal(improntaDellaCasa({ STATES: {} }), "");
  const una = improntaDellaCasa({
    STATES: { "zone.home": { attributes: { latitude: 10.5, longitude: 20.25 } } },
  });
  const altra = improntaDellaCasa({
    STATES: { "zone.home": { attributes: { latitude: 11.5, longitude: 20.25 } } },
  });
  assert.ok(una && altra && una !== altra);
});

test("le righe tenute non superano lo spazio: escono le piu' vecchie", () => {
  const storage = dispensa();
  const tenute = new StatisticheTenute({ storage, impronta: () => "c", spazio: 400 });
  for (let i = 0; i < 10; i += 1) tenute.metti(`k${i}`, { result: { a: [i, i, i, i, i] } });
  assert.ok(storage.getItem("dm_statistiche_tenute_v1").length <= 400);
  assert.ok(tenute.prendi("k9"), "l'ultima c'e'");
  assert.equal(tenute.prendi("k0"), null, "la prima e' uscita");
});
