/* Quattro piccole cose chieste da chi usa la plancia, e le prove che le tengono.
 *
 *  - #307: un dispositivo che torna entro cinque minuti non era scollegato;
 *  - #334: le righe di una finestra non saltano sotto il dito;
 *  - #337: il citofono a muro solo dove serve, e si puo' togliere.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { TACE_DA_ALMENO, taceDaAbbastanza } from "../src/core/i-dispositivi-scollegati.js";
import { ciEIlCitofono, muroPulito } from "../src/core/plancia-a-muro.js";
import { dimenticaLOrdine, inOrdineFermo } from "../src/sections/finestre-dei-widget.js";

test("non connessi: solo chi tace da almeno cinque minuti (#307)", () => {
  const adesso = Date.parse("2026-10-28T08:00:00Z");
  assert.equal(TACE_DA_ALMENO, 5 * 60 * 1000);
  assert.equal(taceDaAbbastanza({ da: adesso - 60 * 1000 }, adesso), false);
  assert.equal(taceDaAbbastanza({ da: adesso - 5 * 60 * 1000 }, adesso), true);
  assert.equal(taceDaAbbastanza({ da: adesso - 2 * 86400000 }, adesso), true);
  /* Da quando non si sa: si dice, come prima. */
  assert.equal(taceDaAbbastanza({ da: null }, adesso), true);
});

test("l'ordine di una finestra si decide all'apertura e resta quello (#334)", () => {
  const accesePrima = (righe) => righe.sort((a, b) => Number(b.on) - Number(a.on));
  const chiave = (riga) => riga.entity;
  dimenticaLOrdine();
  const prima = [
    { entity: "light.a", on: false },
    { entity: "light.b", on: true },
    { entity: "light.c", on: false },
  ];
  assert.deepEqual(inOrdineFermo("luci", prima, chiave, accesePrima).map(chiave), [
    "light.b",
    "light.a",
    "light.c",
  ]);
  /* Si accende la C e si spegne la B: nessuno si sposta. */
  const dopo = [
    { entity: "light.a", on: false },
    { entity: "light.b", on: false },
    { entity: "light.c", on: true },
  ];
  assert.deepEqual(inOrdineFermo("luci", dopo, chiave, accesePrima).map(chiave), [
    "light.b",
    "light.a",
    "light.c",
  ]);
  /* Una luce nuova va in fondo. */
  assert.deepEqual(
    inOrdineFermo("luci", [...dopo, { entity: "light.d", on: true }], chiave, accesePrima).map(
      chiave,
    ),
    ["light.b", "light.a", "light.c", "light.d"],
  );
  /* Chiusa e riaperta la finestra, l'ordine si rifa': accese in cima. */
  dimenticaLOrdine();
  assert.deepEqual(inOrdineFermo("luci", dopo, chiave, accesePrima).map(chiave), [
    "light.c",
    "light.a",
    "light.b",
  ]);
  /* Un'altra finestra non eredita l'ordine di questa. */
  assert.deepEqual(inOrdineFermo("clima", prima, chiave, accesePrima).map(chiave), [
    "light.b",
    "light.a",
    "light.c",
  ]);
  dimenticaLOrdine();
});

test("il citofono a muro solo se c'e' qualcosa da mostrare, e si puo' togliere (#337)", () => {
  assert.equal(ciEIlCitofono({}), false, "senza telecamera e senza tasti non c'e'");
  assert.equal(ciEIlCitofono({ telecamera: "camera.ingresso" }), true);
  assert.equal(ciEIlCitofono({ apri: "button.cancello" }), true);
  assert.equal(ciEIlCitofono({ telecamera: "camera.ingresso", citofono: false }), false);
  /* Di serie c'e', e la scelta si salva. */
  const muro = muroPulito({
    pagine: [{ modello: "ingresso", ingresso: { telecamera: "camera.ingresso" } }],
  });
  assert.equal(muro.pagine[0].ingresso.citofono, true);
  const tolto = muroPulito({
    pagine: [{ modello: "ingresso", ingresso: { telecamera: "camera.ingresso", citofono: false } }],
  });
  assert.equal(tolto.pagine[0].ingresso.citofono, false);
});
