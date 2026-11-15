/* «L'ho già fatto nel Marketplace ma non mi fa installare gli aggiornamenti.»
 *
 * Power Flow Card Plus, da v0.6.2-beta.1 a v0.6.2-beta.2. Da Home Assistant
 * 2026.11 il Marketplace vuole il suo avviso accettato da chi installa, utente
 * per utente: `update.install` guarda l'utente della chiamata. La plancia
 * dentro Home Assistant installava passando dal ponte, cioe' col Supervisor,
 * che l'avviso non l'ha accettato mai: ogni installazione tornava indietro, e
 * la plancia diceva «accettalo», che era gia' fatto.
 *
 * Qui una Home Assistant finta fa come la vera: accetta l'installazione solo
 * da chi ha accettato l'avviso.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  apriIlMarketplace,
  homeAssistantDiChiGuarda,
  installaConChiGuarda,
} from "../src/core/installa-con-chi-guarda.js";
import { perchéNonSiInstalla } from "../src/core/come-si-spegne.js";
import { ilRifiutoDetto } from "../src/sections/come-sta-la-casa-section.js";

const QUELLA_VERA =
  "Open the Marketplace and read the warning first, installing and updating work once it is accepted.";
const LA_SCHEDA = "update.power_flow_card_plus_update";

/* Come risponde Home Assistant 2026.11 a un `call_service` rifiutato: un
 * oggetto, non un Error (home-assistant-js-websocket rifiuta con
 * `message.error`). */
const ilNoDiHomeAssistant = () => ({
  code: "home_assistant_error",
  message: QUELLA_VERA,
  translation_key: "warning_not_accepted",
  translation_domain: "marketplace",
});

/* Una Home Assistant con un utente: ha accettato l'avviso o no. */
function homeAssistantFinta({ accettato, amministra = true }) {
  const chieste = [];
  const hass = {
    user: { is_admin: amministra },
    connection: {
      async sendMessagePromise(messaggio) {
        chieste.push(messaggio);
        if (messaggio.type === "call_service" && messaggio.service === "install" && !accettato)
          throw ilNoDiHomeAssistant();
        return { context: { id: "1" } };
      },
    },
  };
  return { hass, chieste };
}

/* L'ingress: la plancia in un riquadro, Home Assistant nella pagina che lo
 * contiene, allo stesso indirizzo. */
function riquadroDentro(hass) {
  const eventi = [];
  const indirizzi = [];
  const padre = {
    document: { querySelector: (cosa) => (cosa === "home-assistant" ? { hass } : null) },
    history: { pushState: (_s, _t, dove) => indirizzi.push(dove) },
    dispatchEvent: (evento) => eventi.push(evento),
    CustomEvent: class {
      constructor(tipo, init) {
        this.type = tipo;
        this.detail = init?.detail;
      }
    },
  };
  padre.parent = padre;
  const riquadro = { document: { querySelector: () => null }, parent: padre };
  return { riquadro, padre, eventi, indirizzi };
}

test("dentro Home Assistant si installa con l'utente di chi guarda, non col ponte", async () => {
  const { hass, chieste } = homeAssistantFinta({ accettato: true });
  const { riquadro } = riquadroDentro(hass);
  let dalPonte = 0;
  await installaConChiGuarda(LA_SCHEDA, {
    finestra: riquadro,
    ripiego: () => {
      dalPonte += 1;
      throw new Error(QUELLA_VERA);
    },
  });
  assert.equal(dalPonte, 0, "il ponte (cioe' il Supervisor) non si chiama");
  assert.deepEqual(chieste, [
    {
      type: "call_service",
      domain: "update",
      service: "install",
      service_data: { entity_id: LA_SCHEDA },
    },
  ]);
  /* Nessuno accetta l'avviso al posto della persona. */
  assert.equal(
    chieste.some((una) => String(una.type).startsWith("marketplace/")),
    false,
  );
});

test("anche il pannello che sta nella stessa pagina ha la sua Home Assistant", () => {
  const { hass } = homeAssistantFinta({ accettato: true });
  const pagina = { document: { querySelector: () => ({ hass }) } };
  pagina.parent = pagina;
  assert.equal(homeAssistantDiChiGuarda(pagina)?.hass, hass);
  /* Un riquadro di un altro indirizzo: il padre non si tocca. */
  const estraneo = {
    document: { querySelector: () => null },
    get parent() {
      return {
        get document() {
          throw new Error("SecurityError");
        },
      };
    },
  };
  assert.equal(homeAssistantDiChiGuarda(estraneo), null);
  assert.equal(homeAssistantDiChiGuarda(null), null);
});

test("se l'utente che guarda non l'ha accettato, glielo si dice e si offre il Marketplace", async () => {
  const { hass } = homeAssistantFinta({ accettato: false });
  const { riquadro, padre, eventi, indirizzi } = riquadroDentro(hass);
  const errore = await installaConChiGuarda(LA_SCHEDA, { finestra: riquadro }).catch((e) => e);
  assert.ok(errore instanceof Error);
  assert.equal(errore.strada, "utente");
  assert.equal(errore.translation_key, "warning_not_accepted");
  assert.equal(perchéNonSiInstalla(errore), "marketplace");
  const detto = ilRifiutoDetto(errore);
  assert.match(detto, /con l'utente con cui sei entrato non risulta accettato/);
  assert.doesNotMatch(detto, /Open the Marketplace/);
  /* Il Marketplace si apre nella finestra di Home Assistant, come lo apre
   * lei: l'avviso lo legge e lo accetta la persona. */
  assert.equal(apriIlMarketplace(riquadro), true);
  assert.deepEqual(indirizzi, ["/marketplace"]);
  assert.equal(eventi[0].type, "location-changed");
  assert.equal(padre.history !== undefined, true);
});

test("fuori da Home Assistant passa dal ponte, e il no dice che il tuo utente non basta", async () => {
  /* L'app, o la plancia aperta da sola: Home Assistant attorno non c'e'. */
  const daSola = { document: { querySelector: () => null } };
  daSola.parent = daSola;
  let dalPonte = 0;
  const errore = await installaConChiGuarda(LA_SCHEDA, {
    finestra: daSola,
    ripiego: async () => {
      dalPonte += 1;
      throw new Error(QUELLA_VERA);
    },
  }).catch((e) => e);
  assert.equal(dalPonte, 1);
  assert.equal(errore.strada, "ponte");
  const detto = ilRifiutoDetto(errore);
  assert.match(detto, /averlo accettato col tuo utente non basta/);
  assert.match(detto, /Impostazioni → Aggiornamenti/);
  assert.doesNotMatch(detto, /Open the Marketplace/);
  assert.equal(apriIlMarketplace(daSola), false);
});

test("gli altri no restano come li manda Home Assistant", async () => {
  const hass = {
    user: { is_admin: true },
    connection: {
      sendMessagePromise: async () => {
        throw { code: "unauthorized", message: "Unauthorized" };
      },
    },
  };
  const { riquadro } = riquadroDentro(hass);
  const errore = await installaConChiGuarda(LA_SCHEDA, { finestra: riquadro }).catch((e) => e);
  assert.equal(perchéNonSiInstalla(errore), "");
  assert.match(ilRifiutoDetto(errore), /: Unauthorized$/);
});

test("chi non amministra resta sulla strada del ponte, con le sue regole", async () => {
  /* Il ponte installa solo per chi amministra (`dogana.js`): la connessione
   * di chi guarda non deve diventare una porta di servizio. */
  const { hass, chieste } = homeAssistantFinta({ accettato: true, amministra: false });
  const { riquadro } = riquadroDentro(hass);
  let dalPonte = 0;
  await installaConChiGuarda(LA_SCHEDA, {
    finestra: riquadro,
    ripiego: async () => {
      dalPonte += 1;
    },
  });
  assert.equal(dalPonte, 1);
  assert.deepEqual(chieste, []);
});
