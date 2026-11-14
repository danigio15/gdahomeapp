/* La plancia ospitata non prende un gettone dal salvataggio del collegamento.
 *
 * «Da qualche aggiornamento, quando apro la plancia su HA mi arriva sempre la
 * notifica di "login fallito", anche se di fatto poi funziona tutto.» Un
 * gettone vecchio in `cd_connection` — un backup della plancia autonoma, la
 * sincronizzazione di una volta — diventava `Authorization: Bearer <vecchio>`
 * sulle istantanee delle telecamere e sui calendari, e Home Assistant contava
 * ognuna come un tentativo di entrare. Ospitata (dentro Home Assistant
 * dall'add-on, o dentro l'app) la plancia un gettone suo non ce l'ha mai.
 *
 * La catena intera, con il ponte vero e una Home Assistant finta che conta le
 * notifiche, e' in `e2e/dentro-home-assistant-nessun-login-fallito.spec.js`. */
import assert from "node:assert/strict";
import test from "node:test";

const salvato = new Map();
globalThis.localStorage = {
  getItem: (chiave) => (salvato.has(chiave) ? salvato.get(chiave) : null),
  setItem: (chiave, valore) => salvato.set(chiave, String(valore)),
  removeItem: (chiave) => salvato.delete(chiave),
};
salvato.set("cd_connection", JSON.stringify({ token: "gettone-lungo-revocato" }));

const { gettoneDiAccesso } = await import("../src/sections/shared.js");
const { HomeAssistantBroker } = await import("../src/core/period-service.js");

test("fuori da un ospite il gettone salvato resta quello della plancia autonoma", () => {
  delete globalThis.__DASHBOARDMODERN_HOSTED__;
  assert.equal(gettoneDiAccesso(), "gettone-lungo-revocato");
});

test("ospitata, nessun gettone: ne' dal salvataggio ne' dalle variabili", () => {
  globalThis.__DASHBOARDMODERN_HOSTED__ = true;
  globalThis.HA_TOKEN = "un-altro-vecchio";
  try {
    assert.equal(gettoneDiAccesso(), "");
    assert.equal(HomeAssistantBroker.prototype.token.call({}), "");
  } finally {
    delete globalThis.__DASHBOARDMODERN_HOSTED__;
    delete globalThis.HA_TOKEN;
  }
});
