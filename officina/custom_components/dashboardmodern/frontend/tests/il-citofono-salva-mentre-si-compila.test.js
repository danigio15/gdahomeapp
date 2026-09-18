/* «Non salva il sensore aperto o chiuso inserito per gestire la cassetta» (#13).
 *
 * Non era una chiave scritta nel posto sbagliato — quella famiglia di difetti
 * l'abbiamo chiusa quattro volte, e qui il giro andata e ritorno è pulito.
 * Era che in questa scheda il salvataggio lo faceva soltanto il tasto.
 *
 * E c'è un dettaglio che lo rende invisibile: la lente scrive l'entità nella
 * casella e lancia un `change` fatto con `new Event('change')`, che NON
 * risale. Un ascoltatore sul documento in salita non lo sente mai. Quindi chi
 * sceglie il sensore con la lente vede il gesto finito — il nome è lì — e
 * quella casella non l'ha letta nessuno.
 *
 * Due cose si tengono ferme qui: che si salvi a ogni gesto, come in tutte le
 * altre schede di questa configurazione, e che si ascolti in DISCESA, o il
 * gesto della segnalazione resta quello di prima.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CAMPI_DELLA_CASSETTA,
  normalizzaCassette,
} from "../src/core/citofono-e-posta.js";

const scheda = readFileSync(
  new URL("../src/sections/citofono-editor-section.js", import.meta.url),
  "utf8",
);

test("ogni casella si salva mentre la si compila, non solo col tasto", () => {
  assert.match(scheda, /function onInput\(event\)/);
  assert.match(scheda, /prossime\[indice\] = leggiLaRiga\(riga, righe\[indice\]\);\s*\n\s*salva\(/);
});

test("si ascolta in discesa, se no il gesto della lente non si sente", () => {
  /* `new Event('change')` non risale: senza il `true` questa correzione non
   * correggerebbe proprio il caso della segnalazione. */
  assert.match(scheda, /doc\.addEventListener\("change", onInput, true\)/);
  assert.match(scheda, /doc\.addEventListener\("input", onInput, true\)/);
});

test("lo sportello della cassetta fa il giro andata e ritorno", () => {
  /* Che la chiave sia quella giusta si prova lo stesso: è la prima cosa da
   * escludere in questa famiglia di segnalazioni, e resta esclusa. */
  assert.ok(CAMPI_DELLA_CASSETTA.includes("ritiro"));
  const salvate = normalizzaCassette([
    { id: "c1", nome: "Cassetta", ritiro: "binary_sensor.sportello_cassetta" },
  ]);
  assert.equal(salvate[0].ritiro, "binary_sensor.sportello_cassetta");
  /* E una cassetta col solo sportello resta una cassetta: non serve anche il
   * rilevatore perché la riga valga. */
  assert.equal(salvate.length, 1);
});
