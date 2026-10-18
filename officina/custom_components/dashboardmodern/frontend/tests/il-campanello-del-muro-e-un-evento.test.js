/* Il campanello del muro e' un evento di Home Assistant.
 *
 * «Ho messo come campanello `event.door_d1b8_campanello_premuto`: quando
 * suonano, sul muro non succede niente. Cosa si aspetta di entita'?»
 *
 * Due cause, e qui si tengono ferme tutte e due:
 *  - il cancello degli stati nasceva senza le chiavi della configurazione
 *    (lo arma il servizio dell'energia, prima che arrivino), e la seconda
 *    installazione — quella con le chiavi vere — tornava indietro: il
 *    campanello, che sta solo in `cd_muro`, veniva buttato come chiacchiera;
 *  - le regole dello squillo, con gli stati veri di un `event.*`: l'ora
 *    dell'ultima pressione, «unknown» appena creato, «unavailable» quando cade.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { CONFIG_KEYS } from "../src/core/chiavi-di-configurazione.js";
import {
  DOMINI_DEL_CAMPANELLO,
  campanelloSuona,
  ricordoDelCampanello,
  tipoDelCampanello,
} from "../src/core/il-campanello-a-muro.js";
import { fieldHints } from "../src/core/entity-search-index.js";
import { installStateEventGate } from "../src/core/state-event-gate.js";

const EVENTO = "event.door_d1b8_campanello_premuto";
const PRIMA = "2026-10-17T18:02:11.204+00:00";
const DOPO = "2026-10-18T09:15:42.871+00:00";

/* ── quali entita' ────────────────────────────────────────────────────────── */

test("le entita' che fanno da campanello: a ora e accese", () => {
  assert.equal(tipoDelCampanello(EVENTO), "ora");
  assert.equal(tipoDelCampanello("button.citofono_ding"), "ora");
  assert.equal(tipoDelCampanello("input_button.campanello_finto"), "ora");
  assert.equal(tipoDelCampanello("binary_sensor.citofono_ding"), "acceso");
  assert.equal(tipoDelCampanello("input_boolean.campanello"), "acceso");
  assert.equal(tipoDelCampanello("switch.citofono_suona"), "acceso");
  /* Un sensore qualunque no: cambia valore di continuo. */
  assert.equal(tipoDelCampanello("sensor.citofono_wifi"), "");
  assert.equal(tipoDelCampanello("light.ingresso"), "");
  assert.equal(tipoDelCampanello(""), "");
  assert.deepEqual(
    [...DOMINI_DEL_CAMPANELLO].sort(),
    ["binary_sensor", "button", "event", "input_boolean", "input_button", "switch"].sort(),
  );
});

/* ── lo squillo di un evento ─────────────────────────────────────────────── */

test("un evento suona a ogni ora nuova, e il primo sguardo no", () => {
  assert.equal(campanelloSuona(EVENTO, undefined, PRIMA), false, "primo sguardo");
  assert.equal(campanelloSuona(EVENTO, PRIMA, PRIMA), false, "stessa ora");
  assert.equal(campanelloSuona(EVENTO, PRIMA, DOPO), true, "ora nuova");
  /* Appena creato e' «unknown»: il tablet lo ricorda come «visto, senza ora»,
   * e la prima pressione suona. */
  const visto = ricordoDelCampanello(undefined, "unknown");
  assert.equal(visto, "");
  assert.equal(campanelloSuona(EVENTO, visto, DOPO), true);
  /* «unknown» e «unavailable» non sono uno squillo. */
  assert.equal(campanelloSuona(EVENTO, PRIMA, "unknown"), false);
  assert.equal(campanelloSuona(EVENTO, PRIMA, "unavailable"), false);
  assert.equal(campanelloSuona(EVENTO, PRIMA, ""), false);
});

test("un evento che cade e torna con la stessa ora non suona", () => {
  let ricordo = ricordoDelCampanello(undefined, PRIMA);
  for (const [stato, atteso] of [
    ["unavailable", false],
    [PRIMA, false],
    ["unknown", false],
    [DOPO, true],
    [DOPO, false],
  ]) {
    assert.equal(campanelloSuona(EVENTO, ricordo, stato), atteso, `${ricordo} → ${stato}`);
    ricordo = ricordoDelCampanello(ricordo, stato);
  }
  assert.equal(ricordo, DOPO);
});

test("un button e un input_button suonano come un evento", () => {
  assert.equal(campanelloSuona("button.citofono_ding", "unknown", DOPO), true);
  assert.equal(campanelloSuona("input_button.campanello", PRIMA, DOPO), true);
});

/* ── lo squillo di un sensore ────────────────────────────────────────────── */

test("un sensore suona quando si accende, non quando si spegne", () => {
  const id = "binary_sensor.citofono_ding";
  assert.equal(campanelloSuona(id, undefined, "on"), false, "primo sguardo");
  assert.equal(campanelloSuona(id, "off", "on"), true);
  assert.equal(campanelloSuona(id, "on", "off"), false);
  assert.equal(campanelloSuona(id, "on", "on"), false);
  /* Acceso, caduto e tornato acceso: e' lo stesso squillo. */
  let ricordo = ricordoDelCampanello(undefined, "on");
  ricordo = ricordoDelCampanello(ricordo, "unavailable");
  assert.equal(campanelloSuona(id, ricordo, "on"), false);
  assert.equal(campanelloSuona("switch.citofono", "off", "on"), true);
  assert.equal(campanelloSuona("input_boolean.campanello", "off", "on"), true);
});

test("un'entita' che non sa fare da campanello non suona mai", () => {
  assert.equal(campanelloSuona("sensor.citofono_wifi", "-61", "-58"), false);
  assert.equal(campanelloSuona("light.ingresso", "off", "on"), false);
});

/* ── il cancello degli stati ─────────────────────────────────────────────── */

function casaFinta(deposito) {
  const eventi = [];
  class FintoEvento {
    constructor(tipo, init = {}) {
      this.type = tipo;
      this.detail = init.detail;
    }
  }
  const root = {
    CustomEvent: FintoEvento,
    addEventListener() {},
    dispatchEvent(evento) {
      eventi.push(evento);
      return true;
    },
    localStorage: {
      getItem: (chiave) => deposito[chiave] ?? null,
      setItem(chiave, valore) {
        deposito[chiave] = String(valore);
      },
      removeItem(chiave) {
        delete deposito[chiave];
      },
    },
    setTimeout,
    queueMicrotask,
  };
  const broker = {
    ingestState(_stato, { emitEvent = true } = {}) {
      if (emitEvent) root.dispatchEvent(new FintoEvento("dashboardmodern:state-changed", {}));
      return true;
    },
  };
  return { root, broker, eventi, FintoEvento };
}

const attendi = () => new Promise((risolvi) => setTimeout(risolvi, 12));

test("il cancello armato all'avvio prende le chiavi quando arrivano", async () => {
  const deposito = {
    cd_muro: JSON.stringify({
      attiva: true,
      pagine: [{ id: "p1", modello: "ingresso", ingresso: { campanello: EVENTO } }],
    }),
  };
  const { root, broker, eventi } = casaFinta(deposito);
  /* Come in casa: prima l'arma il servizio dell'energia, senza chiavi; il
   * negozio ha gia' una sezione, quindi l'elenco non e' vuoto. */
  root.DashboardModernModules = {
    store: { getState: () => ({ sections: { lights: [{ entity: "light.soggiorno" }] } }) },
  };
  assert.equal(installStateEventGate(broker, root, { delay: 1 }), true);
  broker.ingestState({ entity_id: EVENTO, state: DOPO, attributes: {} });
  await attendi();
  assert.equal(eventi.length, 0, "senza chiavi il campanello non passa: era il guasto");

  /* Poi `section-runtime.js` lo installa con le chiavi vere. */
  assert.equal(installStateEventGate(broker, root, { delay: 1, chiavi: CONFIG_KEYS }), true);
  broker.ingestState({ entity_id: EVENTO, state: PRIMA, attributes: {} });
  await attendi();
  assert.deepEqual(eventi.at(-1)?.detail?.entity_ids, [EVENTO]);

  /* E una chiave scritta dopo si guarda: il campanello cambiato nel config
   * passa subito. */
  root.localStorage.setItem(
    "cd_muro",
    JSON.stringify({
      attiva: true,
      pagine: [{ id: "p1", modello: "ingresso", ingresso: { campanello: "event.altro_citofono" } }],
    }),
  );
  broker.ingestState({ entity_id: "event.altro_citofono", state: DOPO, attributes: {} });
  await attendi();
  assert.deepEqual(eventi.at(-1)?.detail?.entity_ids, ["event.altro_citofono"]);

  /* Le stesse chiavi una seconda volta non cambiano niente. */
  assert.equal(installStateEventGate(broker, root, { chiavi: CONFIG_KEYS }), false);
});

/* ── la ricerca del config ───────────────────────────────────────────────── */

test("il campo Campanello propone eventi doorbell e nomi da campanello", () => {
  const indizi = fieldHints({
    domain: DOMINI_DEL_CAMPANELLO.join(","),
    placeholder: "event.campanello",
  });
  assert.ok(indizi.domains.has("event"), "event e' un dominio conosciuto");
  assert.ok(indizi.domains.has("binary_sensor"));
  assert.ok(indizi.domains.has("input_button"));
  assert.ok(indizi.deviceClasses.has("doorbell"));
  for (const parola of ["campanello", "doorbell", "citofono"])
    assert.ok(indizi.keywords.includes(parola), parola);
});
