/* La scheda dice perche' la lavatrice fa i mini cicli (#26).
 *
 * La scheda del tester: soglia in funzione 0,1 W, standby 0,1 W, ritardo di
 * fine ciclo 5 minuti. Aprendola, l'avviso sta sotto le tre caselle e dice
 * cosa non va; «Usa i valori consigliati» scrive 10 / 2 / 20 e l'avviso se ne
 * va; salvando, i numeri sono quelli. Una lavatrice nuova con le caselle vuote
 * mostra i consigliati in grigio e non avvisa.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const LAVATRICE = {
  id: "appliance-lavatrice",
  name: "Lavatrice",
  visual_type: "asset",
  visual_key: "lavatrice",
  device_type: "lavatrice",
  icon: "lavatrice",
  power_entity: "sensor.lavatrice_w",
  control_entity: "switch.lavatrice",
  entities: ["sensor.lavatrice_w", "switch.lavatrice"],
  threshold_run: 0.1,
  threshold_standby: 0.1,
  off_delay_minutes: 5,
  show_in_dashboard: true,
};

const seme = (appliance) => ({
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [appliance],
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
  },
  visibility: { home: true, appliances: true },
});

async function apriLaScheda(page, testInfo, appliance) {
  test.setTimeout(90_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme(appliance));
  await page.evaluate(() => {
    const s = {
      "sensor.lavatrice_w": { state: "0", attributes: { unit_of_measurement: "W" } },
      "switch.lavatrice": { state: "on", attributes: {} },
    };
    window.__HASS__ = { states: s };
    window._RAW_STATES = s;
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready"));
  });
  await page.evaluate(() => {
    window.apriConfigEntita();
    window.editorSwitch("appliances");
    window.edApplEdit(0);
  });
  const scheda = page.locator("#dm-appliance-editor-modal");
  await expect(scheda).toBeVisible();
  return scheda;
}

test("0,1 / 0,1 / 5: l'avviso c'e', e «Usa i valori consigliati» li scrive", async ({
  page,
}, testInfo) => {
  const scheda = await apriLaScheda(page, testInfo, LAVATRICE);
  const avviso = scheda.locator("[data-appl-ciclo-avviso]");
  await expect(avviso).toBeVisible();
  await expect(avviso).toContainText("mini cicli");
  await expect(avviso.locator("li")).toHaveCount(3);
  await expect(avviso).toContainText("in funzione 10 W, standby 2 W, ritardo 20 min");

  await avviso.locator("[data-appl-ciclo-consigliati]").click();
  await expect(scheda.locator('input[name="threshold_run"]')).toHaveValue("10");
  await expect(scheda.locator('input[name="threshold_standby"]')).toHaveValue("2");
  await expect(scheda.locator('input[name="off_delay_minutes"]')).toHaveValue("20");
  await expect(avviso).toBeHidden();

  /* Scrivere di nuovo un ritardo corto lo fa tornare, mentre si scrive. */
  await scheda.locator('input[name="off_delay_minutes"]').fill("8");
  await expect(avviso).toBeVisible();
  await expect(avviso.locator("li")).toHaveCount(1);
  await scheda.locator('input[name="off_delay_minutes"]').fill("20");
  await expect(avviso).toBeHidden();

  await scheda.locator(".ed-save-btn").click();
  await expect(scheda).toHaveCount(0);
  const salvata = await page.evaluate(() => {
    const store = window.dashboardStore?.() || window.__DASHBOARDMODERN_STORE__;
    const elenco =
      store?.getSection?.("appliances") ||
      JSON.parse(localStorage.getItem("cd_appliances") || "[]");
    return elenco[0];
  });
  expect(Number(salvata.threshold_run)).toBe(10);
  expect(Number(salvata.threshold_standby)).toBe(2);
  expect(Number(salvata.off_delay_minutes)).toBe(20);
});

test("con le caselle vuote si vedono i consigliati in grigio, e nessun avviso", async ({
  page,
}, testInfo) => {
  const vuota = { ...LAVATRICE };
  delete vuota.threshold_run;
  delete vuota.threshold_standby;
  delete vuota.off_delay_minutes;
  const scheda = await apriLaScheda(page, testInfo, vuota);
  const run = scheda.locator('input[name="threshold_run"]');
  await expect(run).toHaveValue("");
  await expect(run).toHaveAttribute("placeholder", "10");
  await expect(scheda.locator('input[name="threshold_standby"]')).toHaveAttribute(
    "placeholder",
    "2",
  );
  await expect(scheda.locator('input[name="off_delay_minutes"]')).toHaveAttribute(
    "placeholder",
    "20",
  );
  await expect(scheda.locator("[data-appl-ciclo-avviso]")).toBeHidden();
});
