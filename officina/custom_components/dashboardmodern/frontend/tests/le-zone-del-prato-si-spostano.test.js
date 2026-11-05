/* Le zone sul prato dell'irrigazione si spostano (#379): il nome del pezzo.
 *
 * Una zona si riconosce dalla sua elettrovalvola, non dal posto nell'elenco:
 * riordinando le zone nel Config ognuna resta dove l'ha messa l'utente. Il
 * nome deve passare la pulizia di `cd_disegni`, o la scelta si perderebbe in
 * silenzio al salvataggio (com'e' successo ai carichi del flusso).
 */
import assert from "node:assert/strict";
import test from "node:test";

import { pezzoDellaZona, posizioniPulite } from "../src/core/posizioni-nei-disegni.js";

test("una zona si chiama con la sua valvola", () => {
  assert.equal(pezzoDellaZona({ entity: "switch.irr_orto" }, 2), "zona:switch.irr_orto");
  assert.equal(pezzoDellaZona({ entity: " Valve.Irr_Prato " }, 0), "zona:valve.irr_prato");
});

test("il nome non cambia col posto nell'elenco", () => {
  const z = { name: "Orto", entity: "valve.orto" };
  assert.equal(pezzoDellaZona(z, 0), pezzoDellaZona(z, 5));
});

test("senza valvola la zona si chiama col suo posto", () => {
  assert.equal(pezzoDellaZona({ name: "Siepe" }, 0), "zona-1");
  assert.equal(pezzoDellaZona({}, 3), "zona-4");
  assert.equal(pezzoDellaZona({ entity: "  " }, 1), "zona-2");
});

test("due zone con la stessa valvola restano due", () => {
  const visti = new Set();
  const a = pezzoDellaZona({ entity: "switch.irr" }, 0, visti);
  const b = pezzoDellaZona({ entity: "switch.irr" }, 1, visti);
  assert.equal(a, "zona:switch.irr");
  assert.equal(b, "zona:switch.irr@2");
});

test("ogni nome passa la pulizia di cd_disegni", () => {
  const visti = new Set();
  const nomi = [
    pezzoDellaZona({ entity: "switch.irr_prato" }, 0, visti),
    pezzoDellaZona({ entity: "switch.irr_prato" }, 1, visti),
    pezzoDellaZona({}, 2, visti),
    pezzoDellaZona({ entity: `switch.${"x".repeat(200)}` }, 3, visti),
    pezzoDellaZona({ entity: "switch.irr è strano!" }, 4, visti),
  ];
  const posizioni = Object.fromEntries(nomi.map((n, i) => [n, { x: 10 + i, y: 20 }]));
  assert.deepEqual(Object.keys(posizioniPulite(posizioni)), nomi);
});
