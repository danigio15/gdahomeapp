/* «Se aggiorno un'entità nella plancia, nella plancia wall non si aggiorna:
 * gli aggiornamenti devono essere in tempo reale.» Il ponte dice sul bus di
 * casa quale plancia ha salvato; il pannello rilegge solo se è quella da cui
 * legge. */
import assert from "node:assert/strict";
import test from "node:test";
import {
  EVENTO_DELLA_CONFIGURAZIONE,
  eCambiataLaFonte,
} from "../src/sections/plancia-a-muro-section.js";

const evento = (data) => ({
  type: "event",
  event: { event_type: EVENTO_DELLA_CONFIGURAZIONE, data },
});

test("il pannello rilegge quando cambia la plancia da cui legge, e solo quella", () => {
  assert.equal(EVENTO_DELLA_CONFIGURAZIONE, "dashboardmodern_config");
  assert.equal(eCambiataLaFonte(evento({ profile: "primary" }), "primary"), true);
  assert.equal(eCambiataLaFonte(evento({ profile: "primary" }), undefined), true);
  assert.equal(eCambiataLaFonte(evento({ profile: "cucina" }), "cucina"), true);
  assert.equal(eCambiataLaFonte(evento({ profile: "cucina" }), "primary"), false);
  assert.equal(
    eCambiataLaFonte({ type: "event", event: { event_type: "state_changed" } }, "primary"),
    false,
  );
  assert.equal(eCambiataLaFonte({ type: "result" }, "primary"), false);
});
