/* «Ma poi si toglie quel messaggio e mostra i dati corretti — c'è qualcosa che
 * parte prima e poi aggiorna.»
 *
 * Aveva ragione. «Statistiche a lungo termine mancanti» è una frase che manda
 * a controllare la configurazione dei sensori, e veniva scritta alla PRIMA
 * lettura in cui una casella tornava vuota. Ma vuota non vuol dire
 * sconfigurata: vuol dire che il Recorder, in quel momento, non ha risposto —
 * ed è esattamente quello che fa appena l'add-on riparte, col database ancora
 * freddo. Un attimo dopo la stessa domanda la riempie, l'avviso sparisce da
 * solo, e chi l'ha letto è già andato a cercare un guasto che non c'era.
 *
 * Adesso ne servono due di fila. Un contatore che le statistiche non ce le ha
 * davvero resta vuoto anche al giro dopo — che arriva comunque entro un minuto
 * — e allora lo si dice, con un minuto di ritardo e la certezza di dire il
 * vero.
 */
import assert from "node:assert/strict";
import test from "node:test";

const magazzino = new Map();
globalThis.localStorage = {
  getItem: (k) => (magazzino.has(k) ? magazzino.get(k) : null),
  setItem: (k, v) => magazzino.set(k, String(v)),
  removeItem: (k) => magazzino.delete(k),
};
globalThis.document = undefined;

const { confermaIMancanti, ragioneDelPacchetto } =
  await import("../src/sections/energy-section.js");

const vuota = (entity, key = "total_energy", group = "solar", kind = "day") => ({
  kind,
  plan: { group, key, entity },
});

test("alla prima lettura non si dice niente: potrebbe essere il Recorder freddo", () => {
  const mancanti = [vuota("sensor.somma_produzione_solare")];
  const { confermati, adesso } = confermaIMancanti(mancanti, undefined);
  assert.deepEqual(confermati, [], "la prima volta non si accusa nessuno");
  assert.equal(adesso.size, 1, "ma ci si ricorda cos'era vuoto");
});

test("se al giro dopo si riempie, l'avviso non esce mai", () => {
  const prima = confermaIMancanti([vuota("sensor.somma_produzione_solare")], undefined);
  const dopo = confermaIMancanti([], prima.adesso);
  assert.deepEqual(dopo.confermati, []);
  assert.equal(ragioneDelPacchetto({ mancanti: dopo.confermati }), "");
});

test("se resta vuota due volte di fila, allora si dice", () => {
  const mancanti = [vuota("sensor.somma_produzione_solare")];
  const prima = confermaIMancanti(mancanti, undefined);
  const dopo = confermaIMancanti(mancanti, prima.adesso);
  assert.equal(dopo.confermati.length, 1);
  assert.match(
    ragioneDelPacchetto({ mancanti: dopo.confermati }),
    /sensor\.somma_produzione_solare/,
  );
});

test("si conferma casella per casella, non tutto o niente", () => {
  /* Il caso vero di casa: cinque contatori vuoti al primo giro, e al secondo
   * ne resta uno solo. Gli altri quattro non devono comparire. */
  const cinque = [
    vuota("sensor.somma_produzione_solare"),
    vuota("sensor.invertermodbus_battery_charge_total", "battery_in", "battery"),
    vuota("sensor.invertermodbus_battery_discharge_total", "battery_out", "battery"),
    vuota("sensor.foxess_a", "battery_in", "battery", "month"),
    vuota("sensor.foxess_b", "battery_out", "battery", "year"),
  ];
  const prima = confermaIMancanti(cinque, undefined);
  const dopo = confermaIMancanti([cinque[2]], prima.adesso);
  assert.equal(dopo.confermati.length, 1);
  const riga = ragioneDelPacchetto({ mancanti: dopo.confermati });
  assert.match(riga, /battery_discharge_total/);
  assert.doesNotMatch(riga, /somma_produzione_solare/, "gli altri quattro si sono riempiti");
});

test("la domanda caduta si dice subito: quella non è una casella vuota", () => {
  /* Un errore di collegamento non ha niente a che vedere con le statistiche,
   * e la sua ragione non passa da questa conferma. */
  assert.match(ragioneDelPacchetto({ caduta: "timeout", mancanti: [] }), /timeout/);
});
