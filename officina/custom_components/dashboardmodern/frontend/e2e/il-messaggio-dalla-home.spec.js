/* «💬 Messaggio»: la card della Home per mandare una frase agli Echo di casa
 * e ai telefoni di famiglia, nella stessa finestra.
 *
 * Il ponte e' finto: dice chi puo' ricevere e quanti l'hanno avuto. Si
 * guarda cosa la plancia gli manda — la frase, gli Echo, a chi — e cosa dice
 * dopo a chi scrive.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [{ id: "l1", name: "Cucina", entity: "light.cucina" }],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true },
};

const STATI = {
  "media_player.echo_cucina": {
    entity_id: "media_player.echo_cucina",
    state: "idle",
    attributes: { friendly_name: "Echo Cucina", last_called: false },
  },
  "media_player.echo_camerette": {
    entity_id: "media_player.echo_camerette",
    state: "idle",
    attributes: { friendly_name: "Echo Camerette", last_called: false },
  },
  "media_player.echo_sala": {
    entity_id: "media_player.echo_sala",
    state: "unavailable",
    attributes: { friendly_name: "Echo Sala", last_called: true },
  },
  "light.cucina": {
    entity_id: "light.cucina",
    state: "off",
    attributes: { friendly_name: "Cucina" },
  },
};

async function boot(page, testInfo, tema = "light") {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    window.__messaggi = [];
    class MockSocket extends EventTarget {
      static OPEN = 1;
      readyState = 1;
      onopen = null;
      onmessage = null;
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
        if (message.type === "get_states") result = [];
        else if (message.type === "frontend/get_user_data") result = { value: null };
        else if (message.type === "ponte/messaggio/chi")
          result = {
            persone: [
              { id: "u_giulia", nome: "Giulia" },
              { id: "u_marco", nome: "Marco" },
              { id: "u_sofia", nome: "Sofia" },
            ],
          };
        else if (message.type === "ponte/messaggio/manda") {
          window.__messaggi.push(message);
          result = {
            telefoni: message.telefoni ? message.persone.length || 3 : 0,
            echo: message.echo.length,
          };
        }
        setTimeout(() => {
          this.onmessage?.({
            data: JSON.stringify({ id: message.id, type: "result", success: true, result }),
          });
        }, 10);
      }
      close() {}
    }
    window.__DASHBOARDMODERN_BRIDGE_WS__ = MockSocket;
    window.WebSocket = MockSocket;
  });
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate(
    ({ stati, tema }) => {
      document.documentElement.setAttribute("data-theme", tema);
      Object.assign(_RAW_STATES, stati);
      window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...stati } };
      window.render?.();
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready"));
    },
    { stati: STATI, tema },
  );
}

for (const tema of ["light", "dark"]) {
  test(`la card Messaggio: agli Echo e ai telefoni (${tema})`, async ({ page }, testInfo) => {
    await boot(page, testInfo, tema);
    await page.locator('.tab[data-tab="home"]').evaluate((n) => n.click());
    const tessera = page.locator('#dm-widgets .dm-tile[data-dm-widget="messaggio"]');
    await expect(tessera).toBeVisible({ timeout: 30_000 });
    await expect(tessera).toContainText("3 persone", { timeout: 20_000 });
    await tessera.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`messaggio-home-${tema}.png`) });

    await tessera.click();
    const finestra = page.locator("#dm-widget-popup");
    await expect(finestra.locator("[data-dm-msg]")).toBeVisible();
    // Gli Echo: di serie quelli accesi; la Sala e' spenta e non e' scelta.
    await expect(finestra.locator("[data-dm-msg-echo][aria-pressed='true']")).toHaveCount(2);
    await finestra.locator("[data-dm-msg-echo='media_player.echo_camerette']").click();
    await finestra.locator("[data-dm-msg-persona='u_marco']").click();
    await finestra.locator("[data-dm-msg-pronta='0']").click();
    await expect(finestra.locator("[data-dm-msg-testo]")).toHaveValue("🍝 A tavola!");
    // Il volume degli Echo: di serie «Com'è»; si sceglie il 70%.
    await expect(finestra.locator("[data-dm-msg-volume=''][aria-pressed='true']")).toHaveCount(1);
    await finestra.locator("[data-dm-msg-volume='70']").click();
    await expect(finestra.locator("[data-dm-msg-volume='70']")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.waitForTimeout(300);
    await finestra.screenshot({ path: testInfo.outputPath(`messaggio-finestra-${tema}.png`) });

    await finestra.locator("[data-dm-msg-invia]").click();
    await expect(finestra.locator(".dm-msg-esito")).toContainText("Inviato a 1 Echo e 1 telefono");
    const mandati = await page.evaluate(() => window.__messaggi);
    expect(mandati).toHaveLength(1);
    expect(mandati[0]).toMatchObject({
      type: "ponte/messaggio/manda",
      testo: "🍝 A tavola!",
      echo: ["media_player.echo_cucina"],
      telefoni: true,
      persone: ["u_marco"],
      volume: 70,
    });
    await expect(finestra.locator("[data-dm-msg-testo]")).toHaveValue("");
    await page.waitForTimeout(300);
    await finestra.screenshot({ path: testInfo.outputPath(`messaggio-inviato-${tema}.png`) });

    // Scritto a mano, Invio manda; solo ai telefoni, a tutti.
    await finestra.locator("[data-dm-msg-dest='echo']").click();
    await finestra.locator("[data-dm-msg-tutti]").click();
    await finestra.locator("[data-dm-msg-testo]").fill("Torno alle 8");
    await finestra.locator("[data-dm-msg-testo]").press("Enter");
    await expect.poll(() => page.evaluate(() => window.__messaggi.length)).toBe(2);
    const secondo = await page.evaluate(() => window.__messaggi[1]);
    expect(secondo).toMatchObject({ testo: "Torno alle 8", echo: [], telefoni: true, persone: [] });
    // Senza Echo il volume non parte.
    expect(secondo.volume).toBeUndefined();
  });
}
