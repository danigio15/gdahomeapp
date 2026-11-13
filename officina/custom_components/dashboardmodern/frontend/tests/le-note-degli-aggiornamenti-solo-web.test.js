/* Revisione di sicurezza: «Note» di un aggiornamento con `release_url`
 * «javascript:…» faceva girare quel codice dentro la plancia. Il link si
 * scrive solo per le pagine web. */

import assert from "node:assert/strict";
import test from "node:test";
import { aggiornamentiDaFare, indirizzoWeb } from "../src/core/aggiornamenti-da-fare.js";

test("solo http e https diventano un link", () => {
  assert.equal(indirizzoWeb("https://github.com/x/releases"), "https://github.com/x/releases");
  assert.equal(indirizzoWeb("http://esempio.it/note"), "http://esempio.it/note");
  assert.equal(indirizzoWeb("javascript:alert(1)"), "");
  assert.equal(indirizzoWeb(" JavaScript:alert(1)"), "");
  assert.equal(indirizzoWeb("data:text/html,<script>1</script>"), "");
  assert.equal(indirizzoWeb("note.html"), "");
  assert.equal(indirizzoWeb(undefined), "");
});

test("un aggiornamento con release_url javascript: resta senza note", () => {
  const [uno] = aggiornamentiDaFare({
    "update.finto": {
      entity_id: "update.finto",
      state: "on",
      attributes: {
        friendly_name: "Finto",
        installed_version: "1.0",
        latest_version: "2.0",
        release_url: "javascript:alert(document.cookie)",
      },
    },
  });
  assert.equal(uno.note, "");
});
