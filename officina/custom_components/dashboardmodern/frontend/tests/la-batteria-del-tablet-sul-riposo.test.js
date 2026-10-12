/* «Nella schermata idle della plancia a muro mettere la possibilita' di
 * visualizzare la % di carica della batteria e/o se e' sotto carica o no.»
 *
 * Il riposo dice la batteria del tablet solo se qualcuno lo ha chiesto, la
 * legge prima dalle entita' scelte e poi dal browser, e senza un numero non
 * mostra niente. */
import assert from "node:assert/strict";
import test from "node:test";
import {
  MURO_VUOTO,
  batteriaDalBrowser,
  batteriaDelTablet,
  inCaricaDaStato,
  muroPulito,
} from "../src/core/plancia-a-muro.js";

const LIVELLO = "sensor.tablet_cucina_battery_level";
const CARICA = "binary_sensor.tablet_cucina_is_charging";
const STATO = "sensor.tablet_cucina_battery_state";

const acceso = (batteria = {}) => muroPulito({ batteria: { attiva: true, ...batteria } });

test("la batteria parte spenta e si pulisce come il resto del muro", () => {
  assert.deepEqual(MURO_VUOTO.batteria, { attiva: false, livello: "", carica: "" });
  assert.deepEqual(muroPulito({}).batteria, { attiva: false, livello: "", carica: "" });
  assert.deepEqual(
    muroPulito({ batteria: { attiva: true, livello: ` ${LIVELLO.toUpperCase()} `, carica: "boh" } })
      .batteria,
    { attiva: true, livello: LIVELLO, carica: "" },
  );
  assert.equal(muroPulito({ batteria: { attiva: "si" } }).batteria.attiva, false);
});

test("spenta, il riposo non dice niente anche se i dati ci sono", () => {
  const muro = muroPulito({ batteria: { attiva: false, livello: LIVELLO } });
  assert.equal(
    batteriaDelTablet(muro, { [LIVELLO]: { state: "80" } }, { livello: 50, inCarica: true }),
    null,
  );
});

test("in carica: il sensore binario, lo stato della Companion App, o niente", () => {
  assert.equal(inCaricaDaStato("on"), true);
  assert.equal(inCaricaDaStato("off"), false);
  assert.equal(inCaricaDaStato("charging"), true);
  assert.equal(inCaricaDaStato("Charging"), true);
  assert.equal(inCaricaDaStato("full"), true);
  assert.equal(inCaricaDaStato("not_charging"), false);
  assert.equal(inCaricaDaStato("Not Charging"), false);
  assert.equal(inCaricaDaStato("discharging"), false);
  assert.equal(inCaricaDaStato("unavailable"), null);
  assert.equal(inCaricaDaStato(""), null);
  assert.equal(inCaricaDaStato("boh"), null);
});

test("il browser: livello da 0 a 1, e la spina", () => {
  assert.deepEqual(batteriaDalBrowser({ level: 0.734, charging: false }), {
    livello: 73,
    inCarica: false,
  });
  assert.deepEqual(batteriaDalBrowser({ level: 1, charging: true }), {
    livello: 100,
    inCarica: true,
  });
  assert.equal(batteriaDalBrowser(null), null);
  assert.equal(batteriaDalBrowser({ level: "x" }), null);
});

test("senza entita' scelte la dice il browser", () => {
  assert.deepEqual(batteriaDelTablet(acceso(), {}, { livello: 64, inCarica: true }), {
    livello: 64,
    inCarica: true,
    bassa: false,
    fonte: "browser",
  });
  assert.deepEqual(batteriaDelTablet(acceso(), {}, { livello: 12, inCarica: false }), {
    livello: 12,
    inCarica: false,
    bassa: true,
    fonte: "browser",
  });
});

test("l'entita' scelta vince sul browser, con la sua carica", () => {
  const stati = { [LIVELLO]: { state: "41.6" }, [CARICA]: { state: "on" } };
  assert.deepEqual(
    batteriaDelTablet(acceso({ livello: LIVELLO, carica: CARICA }), stati, {
      livello: 99,
      inCarica: false,
    }),
    { livello: 42, inCarica: true, bassa: false, fonte: "entita" },
  );
  /* Lo stato a parole della Companion App va bene uguale. */
  assert.equal(
    batteriaDelTablet(
      acceso({ livello: LIVELLO, carica: STATO }),
      { [LIVELLO]: { state: "15" }, [STATO]: { state: "discharging" } },
      null,
    ).bassa,
    true,
  );
});

test("col livello dell'entita' la spina non si prende dal browser di un altro schermo", () => {
  const b = batteriaDelTablet(
    acceso({ livello: LIVELLO }),
    { [LIVELLO]: { state: "55" } },
    { livello: 100, inCarica: true },
  );
  assert.deepEqual(b, { livello: 55, inCarica: null, bassa: false, fonte: "entita" });
  /* Ma se il sensore la porta negli attributi, si legge. */
  assert.equal(
    batteriaDelTablet(
      acceso({ livello: LIVELLO }),
      { [LIVELLO]: { state: "55", attributes: { is_charging: true } } },
      null,
    ).inCarica,
    true,
  );
});

test("un'entita' che non risponde lascia la parola al browser, e senza niente non si mostra", () => {
  const muro = acceso({ livello: LIVELLO });
  assert.equal(
    batteriaDelTablet(muro, { [LIVELLO]: { state: "unavailable" } }, { livello: 70 }).fonte,
    "browser",
  );
  assert.equal(batteriaDelTablet(muro, { [LIVELLO]: { state: "unavailable" } }, null), null);
  assert.equal(batteriaDelTablet(acceso(), {}, null), null);
});

test("il livello resta fra 0 e 100", () => {
  assert.equal(
    batteriaDelTablet(acceso({ livello: LIVELLO }), { [LIVELLO]: { state: "130" } }).livello,
    100,
  );
  assert.equal(
    batteriaDelTablet(acceso({ livello: LIVELLO }), { [LIVELLO]: { state: "-4" } }).livello,
    0,
  );
});
