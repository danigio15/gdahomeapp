/* «Se sposto la temperatura scambia in automatico da riscaldamento a
 * automatico e non riesce a prendere in modo corretto la temperatura» (#392).
 *
 * Dal video: il dito che lascia la barra fa un click, la card intera apriva
 * la finestra del Clima sotto il dito — coi tasti Spento / Auto / Programma —
 * e il numero tornava al vecchio finche' Home Assistant non rispondeva. */
import assert from "node:assert/strict";
import test from "node:test";
import { clickDopoLaPresa } from "../src/sections/climate-thermal-section.js";
import { obiettivoDaMostrare, obiettivoInVolo } from "../src/sections/home-widgets-section.js";

test("il click che segue una presa sulla barra non apre la finestra", () => {
  const card = { id: "sala" };
  const altra = { id: "matrimoniale" };
  const presa = { card, quando: 1_000 };
  assert.equal(clickDopoLaPresa(presa, card, 1_200), true, "subito dopo, sulla stessa card");
  assert.equal(clickDopoLaPresa(presa, altra, 1_200), false, "un'altra card si apre");
  assert.equal(clickDopoLaPresa(presa, card, 3_000), false, "un tocco vero, piu' tardi, apre");
  assert.equal(clickDopoLaPresa(null, card, 1_200), false, "senza presa la card si apre");
  assert.equal(clickDopoLaPresa(presa, null, 1_200), false, "fuori dalle card non si tocca niente");
});

test("su iPhone la card si e' gia' ridisegnata: e' la stessa, si riconosce dal termostato", () => {
  // «Questo avviene principalmente da telefono iOS.» Il click arriva dopo il
  // ridisegno: un elemento nuovo, lo stesso termostato.
  const prima = { dataset: { dmCl: "climate.sala" } };
  const ridisegnata = { dataset: { dmCl: "climate.sala" } };
  const altra = { dataset: { dmCl: "climate.camera" } };
  const presa = { card: prima, entity: "climate.sala", quando: 1_000 };
  assert.equal(clickDopoLaPresa(presa, ridisegnata, 1_400), true, "la stessa card, ridisegnata, non si apre");
  assert.equal(clickDopoLaPresa(presa, altra, 1_400), false, "un altro termostato si apre");
  assert.equal(clickDopoLaPresa(presa, ridisegnata, 2_000), false, "un tocco vero, piu' tardi, apre");
});

test("il grado lasciato sulla barra resta finche' Home Assistant dice il vecchio", () => {
  const entity = "climate.sala_prova_barra";
  obiettivoInVolo(entity, 21.5, 19);
  assert.equal(obiettivoDaMostrare({ entity, target: 19 }), 21.5, "Home Assistant non ha ancora preso");
  assert.equal(obiettivoDaMostrare({ entity, target: 21.5 }), 21.5, "preso");
  /* Una volta preso, il volo e' finito: vale quello che dice la casa. */
  assert.equal(obiettivoDaMostrare({ entity, target: 20 }), 20);
});
