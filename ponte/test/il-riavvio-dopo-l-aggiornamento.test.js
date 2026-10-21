/* «Quando fai gli aggiornamenti tipo di Alexa Media Player HA ti richiede il
 * riavvio dopo, e su GdAHome non viene proposto.» Home Assistant lo scrive
 * fra le sue riparazioni; il ponte le legge e dice chi aspetta il riavvio. */
import { test } from "node:test";
import assert from "node:assert/strict";

import { Aggiornamenti, chiAspettaIlRiavvio } from "../src/aggiornamenti.js";

const HACS = {
  domain: "hacs",
  issue_id: "restart_required_123",
  translation_key: "restart_required",
  translation_placeholders: { name: "Alexa Media Player" },
  ignored: false,
  dismissed_version: null,
};

test("la riparazione di HACS dice chi aspetta il riavvio", () => {
  assert.deepEqual(chiAspettaIlRiavvio([HACS]), { serve: true, chi: ["Alexa Media Player"] });
});

test("ignorate, gia' chiuse o d'altro tipo: niente riavvio", () => {
  assert.deepEqual(
    chiAspettaIlRiavvio([
      { ...HACS, ignored: true },
      { ...HACS, dismissed_version: "2026.10.2" },
      { domain: "zha", issue_id: "inconsistent_network", translation_key: "x" },
    ]),
    { serve: false, chi: [] },
  );
  assert.deepEqual(chiAspettaIlRiavvio(null), { serve: false, chi: [] });
});

test("senza nome vale il dominio, e lo stesso nome si dice una volta", () => {
  const senzaNome = { ...HACS, translation_placeholders: {} };
  assert.deepEqual(chiAspettaIlRiavvio([senzaNome, senzaNome]), { serve: true, chi: ["hacs"] });
});

test("il ponte chiede le riparazioni; se non si possono leggere non inventa", async () => {
  const chieste = [];
  const casa = {
    chiedi: async (comando) => {
      chieste.push(comando.type);
      return { issues: [HACS] };
    },
  };
  assert.deepEqual(await new Aggiornamenti({ casa }).serveIlRiavvio(), {
    serve: true,
    chi: ["Alexa Media Player"],
    sappiamo: true,
  });
  assert.deepEqual(chieste, ["repairs/list_issues"]);
  const muta = {
    chiedi: async () => {
      throw new Error("unauthorized");
    },
  };
  assert.deepEqual(await new Aggiornamenti({ casa: muta }).serveIlRiavvio(), {
    serve: false,
    chi: [],
    sappiamo: false,
  });
});
