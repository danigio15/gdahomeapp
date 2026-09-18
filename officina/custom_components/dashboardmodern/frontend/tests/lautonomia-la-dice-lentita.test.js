/* «Il mio UPS (CyberPower) mostra il tempo residuo in secondi invece dei
 *  minuti, sarebbe utile la possibilità di scegliere se far vedere il tempo
 *  residuo anche in secondi» (#9).
 *
 * La richiesta chiede una tendina; il difetto sotto non ne ha bisogno. La
 * casella si chiamava «Autonomia (minuti)» e il numero si prendeva così com'è:
 * un gruppo che dichiara 1800 secondi diceva «1800 min», cioè trenta ore di
 * autonomia su una batteria che ne fa mezz'ora. Non è un numero un po'
 * sbagliato: è la risposta opposta a quella che si cerca, e la si legge
 * proprio nel momento in cui è andata via la corrente.
 *
 * L'unità non c'è da chiederla — sta nell'entità, in `unit_of_measurement` —
 * e chiederla a chi configura vuol dire dargli un modo in più di sbagliarla.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { autonomiaInMinuti, letturaUps } from "../src/core/ups-model.js";
import { inMinuti } from "../src/core/quanto-dura.js";

const sensore = (state, unit) => ({
  state: String(state),
  attributes: unit ? { unit_of_measurement: unit } : {},
});

test("mezz'ora di batteria è mezz'ora, comunque la scriva l'integrazione", () => {
  assert.equal(autonomiaInMinuti(sensore(1800, "s")), 30);
  assert.equal(autonomiaInMinuti(sensore(30, "min")), 30);
  assert.equal(autonomiaInMinuti(sensore(0.5, "h")), 30);
});

test("chi non dichiara l'unità resta com'era: minuti", () => {
  /* È come si chiamava quella casella da sempre, e chi l'ha compilata con un
   * sensore muto non deve vedersi cambiare il numero sotto gli occhi. */
  assert.equal(autonomiaInMinuti(sensore(42)), 42);
  assert.equal(autonomiaInMinuti(sensore(42, "")), 42);
  /* E un'unità che non è un tempo non è una conversione: «50 m» sono metri. */
  assert.equal(autonomiaInMinuti(sensore(50, "m")), 50);
  assert.equal(inMinuti(50, "m"), null);
});

test("un sensore che non risponde non diventa zero minuti di autonomia", () => {
  for (const stato of [null, undefined, sensore("unavailable", "s"), sensore("", "s")])
    assert.equal(autonomiaInMinuti(stato), null);
});

test("l'autonomia non si scrive con quattro decimali", () => {
  /* 100 secondi sono un minuto e quaranta: sulla tessera si legge 1,7, non
   * 1,6666666666666667. */
  assert.equal(autonomiaInMinuti(sensore(100, "s")), 1.7);
});

test("nella lettura dell'UPS arriva già convertita", () => {
  /* Il conto deve stare dentro il modello: se restasse a chi disegna, la
   * pagina e la tessera lo farebbero ognuna a modo suo. */
  const lettura = letturaUps(
    { name: "Rack", autonomia: "sensor.ups_runtime" },
    { "sensor.ups_runtime": sensore(2700, "s") },
  );
  assert.equal(lettura.autonomia, 45);
});
