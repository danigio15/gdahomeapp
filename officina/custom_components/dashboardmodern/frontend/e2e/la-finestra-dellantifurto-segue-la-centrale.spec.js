/* La finestra rapida dell'antifurto segue la centrale.
 *
 * «Se tolgo antifurto da widget si toglie correttamente ma il widget non si
 * aggiorna.» Si disinseriva davvero, e la finestra restava su «CASA»: il
 * guscio la ridisegnava solo se l'entita' cambiata si chiamava
 * `dm.security_centrale_allarme`, e Home Assistant manda il nome vero. Qui la
 * finestra e' aperta, la centrale cambia, e la finestra lo deve dire senza
 * essere chiusa e riaperta.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const CENTRALE = "alarm_control_panel.casa";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: { "dm.security_centrale_allarme": CENTRALE },
  },
  visibility: { home: true, security: true },
};

const centrale = (stato) => ({
  entity_id: CENTRALE,
  state: stato,
  attributes: { friendly_name: "Centrale", supported_features: 63, code_format: "number" },
});

async function scrivi(page, stato) {
  await page.evaluate((valore) => {
    for (const nome of ["_RAW_STATES", "STATES"]) {
      const registro = window.eval(`typeof ${nome} !== 'undefined' ? ${nome} : null`);
      if (registro) registro[valore.entity_id] = structuredClone(valore);
    }
    window.__HASS__ = {
      states: { ...(window.__HASS__?.states || {}), [valore.entity_id]: valore },
    };
  }, stato);
}

test("disinserita da fuori, la finestra aperta passa da CASA a DISINSERITO", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  /* La centrale arriva dall'elenco che Home Assistant manda all'avvio, come
     in «la centrale mostra i suoi tasti»: scritta dopo a mano, il primo giro
     del runtime la cancellerebbe. */
  await page.addInitScript((iniziale) => {
    class PresaFinta extends EventTarget {
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
      send(raw) {
        const message = JSON.parse(raw);
        if (message.type === "auth") return;
        let result = null;
        if (message.type === "get_states") result = [iniziale];
        if (message.type === "frontend/get_user_data") result = { value: null };
        queueMicrotask(() =>
          this.onmessage?.({
            data: JSON.stringify({ id: message.id, type: "result", success: true, result }),
          }),
        );
      }
      close() {}
    }
    window.WebSocket = PresaFinta;
  }, centrale("armed_home"));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction((id) => Boolean(eval("_RAW_STATES")[id]), CENTRALE);
  await page.evaluate(() => window.apriQuickAntifurto());
  const finestra = page.locator("#quick-alarm-modal");
  await expect(finestra).toHaveClass(/show/);
  const scritta = finestra.locator("#qa-alarm-state-text");
  await expect(scritta).toContainText(/CASA|HOME/);

  /* La centrale si disinserisce: arriva il cambio di stato, la finestra resta
   * aperta e lo dice. */
  await scrivi(page, centrale("disarmed"));
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("dashboardmodern:state-changed", {
        detail: { entity_id: "alarm_control_panel.casa" },
      }),
    ),
  );
  await expect(finestra).toHaveClass(/show/);
  await expect(scritta).not.toContainText(/CASA|HOME/);
  await expect(scritta).toContainText(/DISINSERITO|DISARMED/);
});
