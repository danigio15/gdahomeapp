import test from "node:test";
import assert from "node:assert/strict";
import { perchéNonSiInstalla } from "../src/core/come-si-spegne.js";

test("il rifiuto del Marketplace si riconosce, gli altri no", () => {
  const vero =
    "Open the Marketplace and read the warning first, installing and updating work once it is accepted";
  assert.equal(perchéNonSiInstalla(new Error(vero)), "marketplace");
  assert.equal(perchéNonSiInstalla(vero), "marketplace");
  assert.equal(perchéNonSiInstalla({ message: vero.toLowerCase() }), "marketplace");
  assert.equal(perchéNonSiInstalla(new Error("Entity update.x is not available")), "");
  assert.equal(perchéNonSiInstalla(null), "");
  assert.equal(perchéNonSiInstalla(undefined), "");
});

test("il rifiuto del Marketplace si riconosce anche dalla sua chiave, in ogni lingua", () => {
  /* Home Assistant manda `translation_key` accanto al messaggio: il testo
   * cambia con la lingua di chi lo scrive, la chiave no. */
  assert.equal(
    perchéNonSiInstalla({ translation_key: "warning_not_accepted", message: "Öffne zuerst" }),
    "marketplace",
  );
  assert.equal(perchéNonSiInstalla({ translation_key: "invalid_version", message: "x" }), "");
});
