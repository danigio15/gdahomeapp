/* «Che significa sto messaggio»: sopra i dispositivi di un mese passato il
 * guscio scriveva «Produzione e consumi principali non disponibili per questo
 * mese», anche quando i moduli quei numeri li avevano dal Recorder e li
 * usavano per la ripartizione ☀️/🔌 delle stesse righe. Se il mese ha i suoi
 * numeri l'avviso va via; se non li ha, resta. */
import assert from "node:assert/strict";
import test from "node:test";
import { togliLAvvisoDelGuscio } from "../src/sections/energy-section.js";

function elenco() {
  const figli = [];
  const nodo = (testo, riga) => ({
    textContent: testo,
    classList: { contains: (c) => riga && c === "ed-device-row" },
    remove() {
      figli.splice(figli.indexOf(this), 1);
    },
  });
  figli.push(nodo("⚠️ Produzione e consumi principali non disponibili per questo mese…", false));
  figli.push(nodo("Wallbox ☀️ 173,9 kWh 🔌 104,4 kWh 278,3 kWh", true));
  figli.push(nodo("Lavatrice 8,0 kWh", true));
  return { children: figli };
}

test("il mese ha produzione e consumi: l'avviso del guscio se ne va, le righe restano", () => {
  const list = elenco();
  togliLAvvisoDelGuscio(list, { house: 412.6, solar: 389.1 });
  assert.equal(list.children.length, 2);
  assert.ok(list.children.every((n) => n.classList.contains("ed-device-row")));
});

test("il mese non ha numeri: l'avviso resta, perche' e' vero", () => {
  const list = elenco();
  togliLAvvisoDelGuscio(list, { house: 0, solar: 0 });
  assert.equal(list.children.length, 3);
  togliLAvvisoDelGuscio(list, undefined);
  assert.equal(list.children.length, 3);
});
