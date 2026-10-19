/* La tessera Agenda e le domande che falliscono all'avvio.
 *
 * (Ponte finto preso dalla prova dell'agenda di chi la guarda, #344.)
 *
 * «Il calendario mostrato vari in base alla persona che lo sta
 * visualizzando» (#344).
 *
 *     «Utente 1 visualizza calendar.utente1, Utente 2 visualizza
 *      calendar.utente2, con la possibilità di scegliere quale calendario
 *      verrà mostrato ad ogni utente.»
 *
 * Dentro il pannello di Home Assistant chi è collegato lo sa il documento
 * ospite, non quello della plancia: `hass.user` vive di là. Finché l'ospite
 * non lo consegna, la plancia lo chiede — una riga sola in cima all'agenda — e
 * scrive la risposta nel profilo di Home Assistant di CHI E' COLLEGATO, non su
 * questo dispositivo.
 *
 * Qui si guarda quello che uno vede: l'agenda di casa finché nessuno dice chi
 * è, e l'agenda di Persona 6 appena lo dice.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const stato = (entity_id, state, attributes = {}) => ({ entity_id, state, attributes });

const STATI = [
  stato("person.persona_6", "home", { friendly_name: "Persona 6", user_id: "u-persona-6" }),
  stato("person.persona_2", "not_home", { friendly_name: "Persona 2", user_id: "u-persona-2" }),
  stato("calendar.famiglia", "off", { friendly_name: "Famiglia" }),
  stato("calendar.persona_6", "off", { friendly_name: "Persona 6" }),
];

/* Due calendari: quello di casa, e quello di Persona 6. */
const CALENDARI = [
  { id: "cal-casa", entity: "calendar.famiglia", name: "Famiglia" },
  {
    id: "cal-persona-6",
    entity: "calendar.persona_6",
    name: "Persona 6",
    persone: ["u-persona-6"],
  },
];

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: { "dm.core_055": "calendar.famiglia" },
  },
  visibility: { home: true, calendario: true },
};

/* Gli eventi come li restituisce `calendar.get_events`: uno per calendario,
 * con un titolo che si riconosce a colpo d'occhio. */
function eventiDi(entity) {
  const domani = new Date(Date.now() + 26 * 3600000);
  const fine = new Date(domani.getTime() + 3600000);
  const titolo = entity === "calendar.persona_6" ? "Dentista di Persona 6" : "Cena di famiglia";
  return {
    response: {
      [entity]: {
        events: [{ start: domani.toISOString(), end: fine.toISOString(), summary: titolo }],
      },
    },
  };
}

async function boot(page, testInfo, profilo = null, prima = "") {
  if (prima) await page.addInitScript(prima);
  test.setTimeout(120_000);
  /* Il profilo di Home Assistant di chi apre la plancia, com'e' PRIMA che la
   * plancia parta: e' cosi' che si arriva da un altro schermo, con la scelta
   * gia' fatta un'altra volta. */
  if (profilo) await page.addInitScript(`window.__profilo = ${JSON.stringify(profilo)}`);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  /* La porta HTTP dei calendari non risponde nella prova: il filo ricade sul
   * servizio, che e' la strada che questo ponte finto conosce. */
  await page.route("**/api/calendars/**", (route) => route.fulfill({ status: 404, body: "" }));
  await page.addInitScript((haStates) => {
    class PonteFinto extends EventTarget {
      static OPEN = 1;
      readyState = 1;
      onopen = null;
      onmessage = null;
      onclose = null;
      constructor() {
        super();
        queueMicrotask(() => {
          this.onopen?.({});
          this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
        });
      }
      send(grezzo) {
        const messaggio = JSON.parse(grezzo);
        if (messaggio.type === "auth") return;
        let risultato = null;
        if (messaggio.type === "get_states") risultato = haStates;
        else if (messaggio.type === "frontend/get_user_data") {
          /* Il profilo dell'utente collegato: la plancia ci scrive chi guarda,
           * e da li' se lo rilegge. */
          risultato = { value: window.__profilo?.[messaggio.key] ?? null };
        } else if (messaggio.type === "frontend/set_user_data") {
          (window.__profilo ||= {})[messaggio.key] = messaggio.value;
          (window.__scritture ||= []).push(messaggio);
          risultato = {};
        } else if (messaggio.type === "call_service") {
          (window.__comandi ||= []).push(messaggio);
          const entity = messaggio.target?.entity_id;
          if (messaggio.domain === "calendar" && messaggio.service === "get_events") {
            window.__chieste = (window.__chieste || 0) + 1;
            if (window.__fallisci && window.__chieste <= window.__fallisci) {
              queueMicrotask(() =>
                this.onmessage?.({
                  data: JSON.stringify({
                    id: messaggio.id,
                    type: "result",
                    success: false,
                    error: { message: "no" },
                  }),
                }),
              );
              return;
            }
            risultato = window.__eventiDi?.(entity) ?? null;
          } else risultato = {};
        }
        queueMicrotask(() =>
          this.onmessage?.({
            data: JSON.stringify({
              id: messaggio.id,
              type: "result",
              success: true,
              result: risultato,
            }),
          }),
        );
      }
      close() {
        this.readyState = 3;
        this.onclose?.({});
      }
    }
    window.__DASHBOARDMODERN_BRIDGE_WS__ = PonteFinto;
    window.WebSocket = PonteFinto;
  }, STATI);
  await page.addInitScript(`window.__eventiDi = ${eventiDi.toString()}`);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate(
    ({ haStates, calendari }) => {
      for (const voce of haStates) {
        _RAW_STATES[voce.entity_id] = structuredClone(voce);
        STATES[voce.entity_id] = structuredClone(voce);
      }
      localStorage.setItem("cd_calendari", JSON.stringify(calendari));
      window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
    },
    { haStates: STATI, calendari: CALENDARI },
  );
}

/* «Ad ogni apertura di HA bisogna aprire la sezione agenda per vedere gli
 * eventi dei widget, altrimenti mette il trattino.» All'avvio le prime domande
 * falliscono — la presa non e' ancora pronta — e la tessera deve riprovare da
 * sola, presto, senza aspettare che qualcuno apra la sezione. */
test("la tessera Agenda si riempie da sola anche se le prime domande falliscono", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo, null, "window.__fallisci = 2");
  const tessere = page.locator("#dm-widgets");
  await expect(tessere).toContainText(/domani/i, { timeout: 20000 });
  await expect(page.locator("#page-calendario")).not.toHaveClass(/active/);
  expect(await page.evaluate(() => window.__chieste)).toBe(3);
});
