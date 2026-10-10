/* «Mi dici CTRL SOLARE dove lo prende? Vedo un sacco di volte entità solare
 * termico da configurare e non riesco a capire cosa va: non si capisce nulla
 * in questa sezione.»
 *
 * Nella Gestione termica le caselle del solare stanno in due gruppi — le
 * misure e i tasti — ognuna con la riga che dice cosa muove in pagina; il
 * «Sensore pompa solare», che nessuno leggeva, non c'è più; e la Valvola, che
 * era scritta fissa su valve.chiave_solare_termico, ha la sua casella. */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

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
    energy: {},
    entityOverrides: {
      "dm.boiler_sonda_temperatura_1": "sensor.pannello",
      "dm.boiler_interruttore_solare_termico": "switch.chiave_solare_termico",
    },
  },
  visibility: { home: true, boiler: true },
};

async function avvia(page, testInfo) {
  test.setTimeout(120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
}

test("le caselle del solare stanno in due gruppi, e ognuna dice cosa muove", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);
  await page.evaluate(() => {
    window.apriConfigEntita();
    window.editorSwitch("sez3");
  });
  const corpo = page.locator("#ed-body details.ed-acc .ed-acc-body").first();
  await expect(corpo.locator("[data-dm-solare-gruppo]")).toHaveCount(2, { timeout: 20_000 });
  await expect(corpo.locator('[data-dm-solare-gruppo="misure"]')).toHaveText("🌡️ Le misure");
  await expect(corpo.locator('[data-dm-solare-gruppo="tasti"]')).toHaveText("🎛️ I tasti");

  /* «Ctrl Solare» si chiama come il tasto, e dice dove sta. */
  const ctrl = corpo
    .locator('.ed-slot-in[data-ref="dm.boiler_interruttore_solare_termico"]')
    .locator("xpath=ancestor::*[contains(concat(' ', @class, ' '), ' ed-slot ')][1]");
  await expect(ctrl.locator(".ed-slot-lbl input.wz-lbl-edit")).toHaveValue("Ctrl Solare");
  await expect(ctrl.locator("[data-dm-solare-aiuto]")).toContainText("CTRL SOLARE");

  /* Il sensore che nessuno leggeva non si offre più; la valvola sì. */
  await expect(corpo.locator('[data-ref="dm.boiler_sensore_pompa_solare"]')).toHaveCount(0);
  await expect(corpo.locator('.ed-slot-in[data-ref="dm.boiler_chiave_solare"]')).toHaveCount(1);

  /* Prima le misure, poi i tasti: la sonda del pannello sta sopra a Ctrl Solare. */
  const ordine = await corpo.evaluate((nodo) =>
    [...nodo.querySelectorAll("[data-dm-solare-gruppo], .ed-slot-in[data-ref^='dm.boiler_']")].map(
      (el) => el.dataset.dmSolareGruppo || el.dataset.ref,
    ),
  );
  expect(ordine.indexOf("misure")).toBeLessThan(ordine.indexOf("dm.boiler_sonda_temperatura_1"));
  expect(ordine.indexOf("dm.boiler_sonda_temperatura_1")).toBeLessThan(ordine.indexOf("tasti"));
  expect(ordine.indexOf("tasti")).toBeLessThan(
    ordine.indexOf("dm.boiler_interruttore_solare_termico"),
  );
  await corpo.locator('[data-dm-solare-gruppo="tasti"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("solare-config.png") });
});

test("la valvola segue l'entità scelta nella sua casella", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  await page.evaluate(() => {
    const sostituzioni = JSON.parse(localStorage.getItem("cd_entity_overrides") || "{}");
    sostituzioni["dm.boiler_chiave_solare"] = "switch.mia_chiave";
    localStorage.setItem("cd_entity_overrides", JSON.stringify(sostituzioni));
  });
  await page.reload();
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true, null, {
    timeout: 60_000,
  });
  await page.evaluate(() => {
    const grezzi = eval("_RAW_STATES");
    grezzi["switch.mia_chiave"] = { entity_id: "switch.mia_chiave", state: "on", attributes: {} };
    window.applyStates?.();
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  });
  expect(await page.evaluate(() => window.cdRefChiaveSolare())).toBe("dm.boiler_chiave_solare");
  await expect(page.locator("#b-c-valvola .state")).toHaveText("APERTA", { timeout: 15_000 });
});
