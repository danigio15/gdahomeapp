/* Sotto il pannello a muro la plancia non si ridisegna.
 *
 * Sul pannello vero (un NSPanel, quattro core lenti) la plancia nascosta sotto
 * il muro rifaceva a ogni mazzetto di stati i riquadri della Home, le persone
 * e l'assistente: un core intero sempre acceso, e i tocchi sul muro in coda.
 * `planciaVisibile` adesso dice di no finche' il muro copre la pagina. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { MURO_ACCESO, planciaVisibile } from "../src/sections/shared.js";

function documento(classi = []) {
  const insieme = new Set(classi);
  return {
    visibilityState: "visible",
    documentElement: { classList: { contains: (c) => insieme.has(c) } },
  };
}

test("la plancia si vede, finche' il muro non la copre", () => {
  assert.equal(planciaVisibile(documento()), true);
  assert.equal(planciaVisibile(documento([MURO_ACCESO])), false);
  assert.equal(planciaVisibile({ ...documento(), visibilityState: "hidden" }), false);
});
