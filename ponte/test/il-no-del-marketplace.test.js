/* Il «no» del Marketplace di Home Assistant, detto giusto.
 *
 * «L'ho già fatto nel Marketplace ma non mi fa installare gli aggiornamenti.»
 * Power Flow Card Plus, da v0.6.2-beta.1 a v0.6.2-beta.2: l'app scriveva
 * l'inglese di Home Assistant, «accetta l'avviso», e l'avviso era gia'
 * accettato. Da Home Assistant 2026.11 l'accettazione e' di ogni utente, e
 * dall'app installa l'utente del ponte (il Supervisor), non il suo.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { Aggiornamenti } from "../src/aggiornamenti.js";
import { Casa, RispostaNegativa } from "../src/casa.js";
import { Commissioni } from "../src/commissioni.js";
import { comeDirloDelMarketplace, eIlMarketplace } from "../src/il-no-del-marketplace.js";

const ZITTO = { info() {}, attenzione() {}, errore() {} };
const CHI_DI_PROVA = "c0ffee00c0ffee00c0ffee00c0ffee00";

/* Le parole vere, come le manda Home Assistant 2026.11
 * (`homeassistant/components/marketplace/strings.json`). */
const QUELLA_VERA =
  "Open the Marketplace and read the warning first, installing and updating work once it is accepted.";

const LA_SCHEDA = {
  entity_id: "update.power_flow_card_plus_update",
  state: "on",
  attributes: {
    supported_features: 1,
    title: "Power Flow Card Plus",
    installed_version: "v0.6.2-beta.1",
    latest_version: "v0.6.2-beta.2",
  },
};

/* Una Home Assistant che fa come la 2026.11 col Supervisor: l'avviso
 * l'utente del ponte non l'ha accettato, e ogni `update.install` torna
 * indietro. */
function casaColMarketplace() {
  const chieste = [];
  return {
    chieste,
    async chiedi(comando) {
      chieste.push(comando);
      if (comando.type === "get_states") return [LA_SCHEDA];
      if (comando.type === "call_service" && comando.service === "install") {
        const no = new RispostaNegativa("home_assistant_error", QUELLA_VERA);
        no.chiave = "warning_not_accepted";
        throw no;
      }
      return null;
    },
  };
}

test("il no del Marketplace si riconosce, dalla chiave o dalle parole", () => {
  assert.equal(eIlMarketplace({ chiave: "warning_not_accepted", message: "qualunque" }), true);
  assert.equal(eIlMarketplace(new Error(QUELLA_VERA)), true);
  assert.equal(eIlMarketplace(QUELLA_VERA.toLowerCase()), true);
  assert.equal(eIlMarketplace(new Error("Unauthorized")), false);
  assert.equal(eIlMarketplace(null), false);
  assert.equal(comeDirloDelMarketplace(new Error("Entity not found")), null);
});

test("dall'app si dice che averlo accettato non basta, e dove si aggiorna", async () => {
  const casa = casaColMarketplace();
  const quali = new Aggiornamenti({ casa, registro: ZITTO });
  await assert.rejects(
    () => quali.installa("update.power_flow_card_plus_update"),
    (errore) => {
      assert.ok(errore instanceof RispostaNegativa);
      /* Il codice e la chiave restano quelli di Home Assistant. */
      assert.equal(errore.code, "home_assistant_error");
      assert.equal(errore.chiave, "warning_not_accepted");
      assert.match(errore.message, /^Il Marketplace di Home Assistant/);
      assert.match(errore.message, /utente per utente/);
      assert.match(errore.message, /averlo accettato col tuo utente non basta/);
      assert.match(errore.message, /Impostazioni → Aggiornamenti/);
      /* Le parole di Home Assistant in coda, esatte. */
      assert.ok(errore.message.includes(`(Home Assistant dice: ${QUELLA_VERA})`));
      return true;
    },
  );
  /* Il servizio e' stato chiesto una volta, e l'avviso non l'ha accettato
   * nessuno al posto della persona: un consenso non si da' da soli. */
  assert.equal(casa.chieste.filter((una) => una.service === "install").length, 1);
  assert.equal(
    casa.chieste.some((una) => String(una.type).startsWith("marketplace/")),
    false,
  );
});

test("sul filo dell'app arriva la frase in italiano", async () => {
  const casa = casaColMarketplace();
  const commissioni = new Commissioni({
    casa,
    registro: ZITTO,
    aggiornamenti: new Aggiornamenti({ casa, registro: ZITTO }),
  });
  const detto = await commissioni.rispondi(
    {
      id: 7,
      type: "ponte/aggiornamenti/installa",
      entity_id: "update.power_flow_card_plus_update",
    },
    { chiChiede: CHI_DI_PROVA, puoAmministrare: true },
  );
  assert.equal(detto.success, false);
  assert.equal(detto.error.code, "home_assistant_error");
  assert.match(detto.error.message, /averlo accettato col tuo utente non basta/);
});

test("la chiave del messaggio di Home Assistant arriva fino al no", () => {
  /* Home Assistant rifiuta con `translation_key`: il filo del ponte se la
   * tiene, cosi' il no si riconosce in qualunque lingua lo scriva. */
  let preso = null;
  const filo = {
    _domande: new Map([[5, { riuscito() {}, fallito: (e) => (preso = e), scadenza: null }]]),
  };
  Casa.prototype._rispostaMia.call(
    filo,
    JSON.stringify({
      id: 5,
      type: "result",
      success: false,
      error: {
        code: "home_assistant_error",
        message: QUELLA_VERA,
        translation_key: "warning_not_accepted",
        translation_domain: "marketplace",
      },
    }),
  );
  assert.ok(preso instanceof RispostaNegativa);
  assert.equal(preso.chiave, "warning_not_accepted");
  assert.equal(eIlMarketplace(preso), true);
});

test("gli altri no di Home Assistant passano come prima", async () => {
  const severa = {
    async chiedi(comando) {
      if (comando.type === "get_states") return [LA_SCHEDA];
      throw new RispostaNegativa("unauthorized", "non ti e' permesso");
    },
  };
  const quali = new Aggiornamenti({ casa: severa, registro: ZITTO });
  await assert.rejects(
    () => quali.installa("update.power_flow_card_plus_update"),
    /^Error: non ti e' permesso$|non ti e' permesso/,
  );
});
