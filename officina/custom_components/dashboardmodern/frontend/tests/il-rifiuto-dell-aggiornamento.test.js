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
