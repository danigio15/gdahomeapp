/* Il piu' e il meno della card del Clima vanno di mezzo grado, come il popup.
 *
 * Dal campo: «se fai piu' o meno ti cambia la temperatura a un grado e non
 * mezzo; invece se la apri fa i mezzi gradi». La card della pagina Clima
 * passava dal `setTemp()` del guscio, che va al grado intero; il popup della
 * stessa unita' andava al mezzo grado. Adesso il passo e' uno solo: quello che
 * l'unita' dichiara, o mezzo grado.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "sala", name: "Sala", icon: "mdi:sofa" }],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [
      { name: "Sala", entity: "climate.sala", type: "termo", room: "sala" },
      { name: "Studio", entity: "climate.studio", type: "termo", room: "sala" },
    ],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, clima: true },
};

async function avvia(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript(() => {
    window.__DM_CHIAMATE__ = [];
    class MockBridgeSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;
      readyState = 1;
      onopen = null;
      onmessage = null;
      onclose = null;
      onerror = null;
      constructor() {
        queueMicrotask(() => {
          this.onopen?.({});
          this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
        });
      }
      send(raw) {
        const message = JSON.parse(raw);
        if (message.type === "auth") return;
        if (message.type === "call_service") window.__DM_CHIAMATE__.push(message);
        let result = null;
        if (message.type === "get_states") result = [];
        if (message.type === "frontend/get_user_data") result = { value: null };
        queueMicrotask(() =>
          this.onmessage?.({
            data: JSON.stringify({ id: message.id, type: "result", success: true, result }),
          }),
        );
      }
      close() {
        this.readyState = 3;
        this.onclose?.({});
      }
    }
    window.__DASHBOARDMODERN_HOSTED__ = true;
    window.__DASHBOARDMODERN_BRIDGE_WS__ = MockBridgeSocket;
    window.WebSocket = MockBridgeSocket;
  });
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate(() => {
    const stati = eval("_RAW_STATES");
    /* La sala della segnalazione: un termostato che non dichiara il passo,
     * obiettivo 19 gradi. Lo studio dichiara il suo: un grado intero. */
    stati["climate.sala"] = {
      entity_id: "climate.sala",
      state: "heat",
      attributes: {
        friendly_name: "Sala",
        current_temperature: 20,
        temperature: 19,
        min_temp: 4,
        max_temp: 35,
        hvac_modes: ["off", "heat"],
        hvac_action: "idle",
      },
    };
    stati["climate.studio"] = {
      entity_id: "climate.studio",
      state: "heat",
      attributes: {
        friendly_name: "Studio",
        current_temperature: 20,
        temperature: 21,
        target_temp_step: 1,
        hvac_modes: ["off", "heat"],
      },
    };
    document.querySelectorAll(".page").forEach((n) => n.classList.remove("active"));
    document.getElementById("page-clima")?.classList.add("active");
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    window.render?.();
  });
  await page.waitForFunction(
    () => Boolean(document.querySelector('#page-clima [data-dm-cl="climate.sala"]')),
    null,
    { timeout: 15000 },
  );
}

const chiamate = (page) =>
  page.evaluate(() =>
    (window.__DM_CHIAMATE__ || [])
      .filter((c) => c.domain === "climate" && c.service === "set_temperature")
      .map((c) => c.service_data),
  );

test("il piu' della card porta 19 a 19,5, e la card lo dice subito", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  const card = page.locator('#page-clima [data-dm-cl="climate.sala"]');
  await expect(card.locator("[data-dm-cl-target]")).toHaveText(/^19/);

  await card.locator(".dm-cl-actions .dm-cl-step").nth(1).click();
  await expect.poll(() => chiamate(page), { timeout: 10000 }).toHaveLength(1);
  expect((await chiamate(page))[0]).toEqual({ entity_id: "climate.sala", temperature: 19.5 });
  // Il numero chiesto si vede sulla card prima che Home Assistant risponda.
  await expect(card.locator("[data-dm-cl-target]")).toHaveText(/^19\.5/);
  // E il secondo tocco parte da li': fa 20, non di nuovo 19,5.
  await card.locator(".dm-cl-actions .dm-cl-step").nth(1).click();
  await expect.poll(() => chiamate(page), { timeout: 10000 }).toHaveLength(2);
  expect((await chiamate(page))[1].temperature).toBe(20);
  // Nessun tocco ha aperto il popup.
  await expect(page.locator("#clima-popup.show, #hvac-popup.show")).toHaveCount(0);
});

test("il meno va di mezzo grado, e chi dichiara un grado intero va di un grado", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  const sala = page.locator('#page-clima [data-dm-cl="climate.sala"]');
  await sala.locator(".dm-cl-actions .dm-cl-step").nth(0).click();
  await expect.poll(() => chiamate(page), { timeout: 10000 }).toHaveLength(1);
  expect((await chiamate(page))[0].temperature).toBe(18.5);

  const studio = page.locator('#page-clima [data-dm-cl="climate.studio"]');
  await studio.locator(".dm-cl-actions .dm-cl-step").nth(1).click();
  await expect.poll(() => chiamate(page), { timeout: 10000 }).toHaveLength(2);
  expect((await chiamate(page))[1]).toEqual({ entity_id: "climate.studio", temperature: 22 });
});
