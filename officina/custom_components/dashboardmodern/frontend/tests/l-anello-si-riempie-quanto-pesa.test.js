/* L'anello intorno a ogni cerchio del flusso si riempie quanto pesa il suo
 * numero. Il numero si rilegge dal testo della bolla, nelle forme in cui la
 * plancia lo scrive: «101 W», «5,30 kW», «1.234,5 kWh», con la freccia
 * davanti per la batteria. Qui si tiene fermo il conto. */
import assert from "node:assert/strict";
import test from "node:test";

import {
  numeroDellaBolla,
  numeroScrittoNellaBolla,
  quotaDellAnello,
} from "../src/sections/energy-flow-section.js";

test("il numero della bolla si legge in tutte le forme della plancia", () => {
  assert.equal(numeroDellaBolla("101 W"), 101);
  assert.equal(numeroDellaBolla("5,30 kW"), 5300);
  assert.equal(numeroDellaBolla("▼ 20 W"), 20);
  assert.equal(numeroDellaBolla("▲ 5,10 kW"), 5100);
  assert.equal(numeroDellaBolla("1.234,5 kWh"), 1234500);
  assert.equal(numeroDellaBolla("0 W"), 0);
  assert.equal(numeroDellaBolla("—"), null);
  assert.equal(numeroDellaBolla(""), null);
});

test("l'anello va da vuoto a pieno, con un filo se c'e' qualcosa", () => {
  assert.equal(quotaDellAnello(0, 5000), 0);
  assert.equal(quotaDellAnello(null, 5000), 0);
  assert.equal(quotaDellAnello(5000, 5000), 1);
  assert.equal(quotaDellAnello(2500, 5000), 0.5);
  /* Sei watt contro cinque chilowatt non sono zero: un filo si vede. */
  assert.equal(quotaDellAnello(6, 5000), 0.04);
  assert.equal(quotaDellAnello(100, 0), 0);
});

test("nei carichi l'anello legge il numero, non l'icona", () => {
  /* L'icona di una stanza e' uno span, e viene prima del numero: leggendo
   * «il primo span» l'anello dei carichi restava vuoto. */
  const span = (testo, classe = "") => ({ tagName: "SPAN", textContent: testo, classe });
  const icona = span("", "dm-icon-engine-glyph");
  const valore = span("121,9 kWh", "dm-flow-value");
  const carico = {
    children: [{ tagName: "DIV" }, { tagName: "DIV", children: [icona] }, valore],
    querySelector: (sel) => (sel === ".dm-flow-value" ? valore : icona),
  };
  assert.equal(numeroScrittoNellaBolla(carico), valore);
  /* I cerchioni: il numero e' lo span figlio diretto. */
  const numero = span("5,30 kW");
  const casa = {
    children: [{ tagName: "DIV" }, { tagName: "DIV" }, numero],
    querySelector: () => null,
  };
  assert.equal(numeroScrittoNellaBolla(casa), numero);
});
