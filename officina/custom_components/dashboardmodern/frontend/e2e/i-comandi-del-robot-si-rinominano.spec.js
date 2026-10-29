/* «Sarebbe possibile personalizzare le scritte delle scorciatoie o
 * eliminare la parola Scorciatoia? Come posso personalizzare i comandi o
 * crearne io alcuni?» (#340). */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const stati = {
  "vacuum.dreame": {
    entity_id: "vacuum.dreame",
    state: "docked",
    attributes: { friendly_name: "Dreame", battery_level: 90, supported_features: 8192 + 4 + 16 },
  },
  "button.dreame_scorciatoia_1": {
    entity_id: "button.dreame_scorciatoia_1",
    state: "unknown",
    attributes: { friendly_name: "Dreame Scorciatoia Pulizia completa" },
  },
  "button.dreame_scorciatoia_2": {
    entity_id: "button.dreame_scorciatoia_2",
    state: "unknown",
    attributes: { friendly_name: "Dreame Scorciatoia 2" },
  },
  "script.lava_il_bagno": {
    entity_id: "script.lava_il_bagno",
    state: "off",
    attributes: { friendly_name: "Lava il bagno" },
  },
};

const seme = {
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
    robots: [
      {
        id: "robot-1",
        name: "Dreame",
        entity: "vacuum.dreame",
        comandi: [
          "button.dreame_scorciatoia_1",
          "button.dreame_scorciatoia_2",
          "script.lava_il_bagno",
        ],
      },
    ],
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, robot: true },
};

async function semina(page) {
  await page.evaluate((valori) => {
    window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...valori } };
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, valori);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, stati);
}

test("i comandi del robot: senza «Scorciatoia», e col nome che si vuole", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme);
  await semina(page);

  /* Sulla scheda, «Scorciatoia» davanti non c'e' piu'. */
  await page.locator('nav.tabs .tab[data-tab="robot"]').dispatchEvent("click");
  await semina(page);
  const tasto = (entita) => page.locator(`[data-dm-robot-cmd="${entita}"]`);
  await expect(tasto("button.dreame_scorciatoia_1")).toContainText("Pulizia completa");
  await expect(page.locator(".dm-robot-cmd", { hasText: "Scorciatoia" })).toHaveCount(0);
  await page.waitForTimeout(300);
  await page
    .locator("[data-dm-robot='vacuum.dreame']")
    .screenshot({ path: testInfo.outputPath("robot-prima-dei-nomi.png") });

  /* Nel Config, ogni comando ha il suo nome. */
  await page.evaluate(() => window.apriConfigEntita());
  await page.locator('.ed-tab[data-tab="robot"]').click();
  await page.locator("[data-robot-index] [data-robot-edit]").first().click();
  const nome = page.locator('[data-robot-nome="button.dreame_scorciatoia_2"]');
  await expect(nome).toBeVisible();
  await expect(nome).toHaveAttribute("placeholder", "2");
  await nome.fill("Aspira il salotto");
  await page.waitForTimeout(300);
  await page
    .locator(".dm-robot-nomi")
    .screenshot({ path: testInfo.outputPath("robot-nomi-nel-config.png") });
  await page.locator("#ed-body .dm-save-footer-btn").click();
  await expect
    .poll(() =>
      page.evaluate(() => window.DashboardModernModules?.store?.getSection?.("robots")?.[0]?.nomi),
    )
    .toEqual({ "button.dreame_scorciatoia_2": "Aspira il salotto" });

  /* E sulla scheda si chiama cosi'. */
  await page.evaluate(
    () => window.chiudiConfigEntita?.() ?? window.edClose?.() ?? window.chiudiConfig?.(),
  );
  await page.locator('nav.tabs .tab[data-tab="robot"]').dispatchEvent("click");
  await semina(page);
  await expect(tasto("button.dreame_scorciatoia_2")).toContainText("Aspira il salotto");
  await expect(tasto("script.lava_il_bagno")).toContainText("Lava il bagno");
  await page.waitForTimeout(300);
});

test("la scheda del robot coi nomi scritti nel Config", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  const [robot] = seme.sections.robots;
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, {
    ...seme,
    sections: {
      ...seme.sections,
      robots: [{ ...robot, nomi: { "button.dreame_scorciatoia_2": "Aspira il salotto" } }],
    },
  });
  await semina(page);
  await page.locator('nav.tabs .tab[data-tab="robot"]').dispatchEvent("click");
  await semina(page);
  const scheda = page.locator("[data-dm-robot='vacuum.dreame']");
  await expect(scheda.locator('[data-dm-robot-cmd="button.dreame_scorciatoia_2"]')).toContainText(
    "Aspira il salotto",
  );
  await page.waitForTimeout(300);
  await scheda.screenshot({ path: testInfo.outputPath("robot-coi-nomi.png") });
});
