/* Più aree dell'antifurto insieme, col codice battuto una volta.
 *
 * «Quando uno ha più partizioni, si potrebbe selezionarne più di una tenendole
 * premute e digitare il codice una volta sola?» Qui due aree, tutte e due col
 * codice: si tiene premuta la seconda, si preme «Fuori», si batte il codice una
 * volta, e partono due comandi — uno per area, con lo stesso codice. Un tocco
 * normale resta quello di sempre: passa all'area e basta.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const GIORNO = "alarm_control_panel.giorno";
const NOTTE = "alarm_control_panel.notte";
const RIF = "dm.security_centrale_allarme";

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
    entityOverrides: { [RIF]: GIORNO },
  },
  visibility: { home: true, security: true },
};

const centrale = (entity_id, nome) => ({
  entity_id,
  state: "disarmed",
  attributes: { friendly_name: nome, supported_features: 3, code_format: "number" },
});

async function avvia(page, testInfo) {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript(
    (stati) => {
      window.__CHIAMATE__ = [];
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
          if (message.type === "get_states") result = stati;
          if (message.type === "frontend/get_user_data") result = { value: null };
          if (message.type === "call_service") window.__CHIAMATE__.push(message);
          queueMicrotask(() =>
            this.onmessage?.({
              data: JSON.stringify({ id: message.id, type: "result", success: true, result }),
            }),
          );
        }
        close() {}
      }
      window.WebSocket = PresaFinta;
    },
    [centrale(GIORNO, "Giorno"), centrale(NOTTE, "Notte")],
  );
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction((id) => Boolean(eval("_RAW_STATES")[id]), NOTTE);
  await page.evaluate(
    ({ giorno, notte, rif }) => {
      localStorage.setItem(
        "cd_centrali",
        JSON.stringify([
          { id: "centrale", nome: "Giorno", caselle: { [rif]: giorno } },
          { id: "centrale-2", nome: "Notte", caselle: { [rif]: notte } },
        ]),
      );
      /* Le chiamate della plancia nuova passano da qui: si raccolgono. */
      for (const nome of ["cdCallServiceJson", "dmCallHaService", "callService"])
        window[nome] = (domain, service, data) => {
          window.__CHIAMATE__.push({ domain, service, service_data: data });
          return Promise.resolve();
        };
      document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
      document.getElementById("page-security")?.classList.add("active");
      window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
      try {
        render();
      } catch (_errore) {}
    },
    { giorno: GIORNO, notte: NOTTE, rif: RIF },
  );
  await expect(page.locator(".dm-sec-area")).toHaveCount(2);
}

async function tieniPremuta(page, area) {
  /* Gli eventi partono sull'area stessa, non su un punto dello schermo: sotto
     carico la pagina finisce di disegnarsi mentre si misura, e un dito messo
     su coordinate calcolate un attimo prima cadeva fuori dal tasto. Un dito
     vero resta giu' piu' dei 550 ms che servono; qui di piu' ancora, perche'
     l'orologio della pagina puo' arrivare in ritardo. */
  await expect(area).toBeVisible();
  await area.dispatchEvent("pointerdown", { bubbles: true, clientX: 10, clientY: 10 });
  await page.waitForTimeout(1200);
  await area.dispatchEvent("pointerup", { bubbles: true });
  await area.dispatchEvent("click", { bubbles: true });
}

test("tenendo premuta un'area si comandano tutte e due, col codice una volta", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);
  await expect(page.locator(".dm-sec-aree-aiuto")).toBeVisible();

  await tieniPremuta(page, page.locator('.dm-sec-area[data-dm-area="centrale-2"]'));
  await expect(page.locator('.dm-sec-area[data-scelta="true"]')).toHaveCount(2);
  await expect(page.locator("[data-dm-aree-insieme]")).toContainText(/2 aree insieme|2 areas/);
  /* Il tocco che chiude la pressione lunga non ha cambiato area. */
  await expect(page.locator('.dm-sec-area[data-dm-area="centrale"]')).toHaveAttribute(
    "aria-selected",
    "true",
  );

  await page.evaluate(() => window.promptPinAndSet("alarm_arm_away"));
  await expect(page.locator("#custom-keypad")).toHaveClass(/show/);
  await page.evaluate(() => {
    for (const cifra of [1, 2, 3, 4]) window.kp(cifra);
    window.kpOk();
  });

  await expect
    .poll(() =>
      page.evaluate(() =>
        window.__CHIAMATE__
          .filter((c) => c.domain === "alarm_control_panel")
          .map((c) => `${c.service}|${c.service_data.entity_id}|${c.service_data.code}`)
          .sort(),
      ),
    )
    .toEqual([`alarm_arm_away|${GIORNO}|1234`, `alarm_arm_away|${NOTTE}|1234`]);
  /* Usato il gruppo, si scioglie. */
  await expect(page.locator('.dm-sec-area[data-scelta="true"]')).toHaveCount(0);
});

test("un tocco normale passa all'altra area, senza gruppo", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  await page.locator('.dm-sec-area[data-dm-area="centrale-2"]').click();
  await expect(page.locator('.dm-sec-area[data-dm-area="centrale-2"]')).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.locator('.dm-sec-area[data-scelta="true"]')).toHaveCount(0);
});

test("il gruppo si annulla", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  await tieniPremuta(page, page.locator('.dm-sec-area[data-dm-area="centrale-2"]'));
  await expect(page.locator('.dm-sec-area[data-scelta="true"]')).toHaveCount(2);
  await page.locator("[data-dm-aree-annulla]").click();
  await expect(page.locator('.dm-sec-area[data-scelta="true"]')).toHaveCount(0);
});
