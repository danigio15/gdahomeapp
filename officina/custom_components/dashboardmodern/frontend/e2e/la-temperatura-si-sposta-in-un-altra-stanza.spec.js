/* «Se vado a cambiarle la stanza e ne metto un'altra, faccio associa
 * sensori e salva sezione, mi ritorna alla stanza di prima.»
 *
 * Aprendo una temperatura con la matita la tendina della stanza si puo'
 * cambiare, ma il salvataggio scriveva i sensori sempre nella stanza da cui
 * si era partiti: la scelta nuova si perdeva. Adesso cambiare stanza in
 * modifica sposta l'associazione: via dalla vecchia, nella nuova, col suo
 * nome e i suoi sensori.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const vuote = {
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
  energyLoads: [],
  entityOverrides: {},
};

const SEED = {
  schema_version: 4,
  sections: {
    rooms: [
      {
        id: "room-sala",
        name: "Sala",
        icon: "🛋️",
        temp: "sensor.temperatura_casa",
        hum: "sensor.salone_salone_umidita",
        temp_name: "Temperatura sala",
        metadata: {},
      },
      { id: "room-cucina", name: "Cucina", icon: "🍳", metadata: {} },
    ],
    ...vuote,
  },
  visibility: { home: true, temperature: true },
};

test("cambiando stanza in modifica, i sensori vanno nella stanza nuova", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEED);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true, null, {
    timeout: 20_000,
  });
  await page.evaluate(() => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
    editorSwitch("sez7");
  });
  await expect(page.locator("[data-beta25-temperature-editor]")).toBeVisible({ timeout: 15_000 });

  await page.locator("[data-beta25-temperature-edit]").first().click();
  const stanza = page.locator("[data-beta25-temperature-form] #dm-temperature-room");
  await expect(stanza).toBeEnabled();
  await stanza.selectOption("room-cucina");
  await page.locator("[data-beta25-temperature-submit]").click();

  await expect
    .poll(() =>
      page.evaluate(() =>
        DashboardModernModules.store
          .getSection("rooms")
          .map((r) => `${r.id}:${r.temp || "-"}:${r.hum || "-"}:${r.temp_name || "-"}`)
          .join(" "),
      ),
    )
    .toBe(
      "room-sala:-:-:- room-cucina:sensor.temperatura_casa:sensor.salone_salone_umidita:Temperatura sala",
    );
  // E nell'elenco la temperatura sta sotto la Cucina, una volta sola.
  const righe = page.locator("[data-beta25-temperature-row]");
  await expect(righe).toHaveCount(1);
  await expect(righe.first()).toHaveAttribute("data-room-id", "room-cucina");
});

test("restando nella stessa stanza, la modifica resta li'", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEED);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true, null, {
    timeout: 20_000,
  });
  await page.evaluate(() => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
    editorSwitch("sez7");
  });
  await expect(page.locator("[data-beta25-temperature-editor]")).toBeVisible({ timeout: 15_000 });
  await page.locator("[data-beta25-temperature-edit]").first().click();
  await page.locator("[data-beta25-temperature-form] #dm-temperature-name").fill("Termometro sala");
  await page.locator("[data-beta25-temperature-submit]").click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        DashboardModernModules.store
          .getSection("rooms")
          .map((r) => `${r.id}:${r.temp || "-"}:${r.temp_name || "-"}`)
          .join(" "),
      ),
    )
    .toBe("room-sala:sensor.temperatura_casa:Termometro sala room-cucina:-:-");
});
