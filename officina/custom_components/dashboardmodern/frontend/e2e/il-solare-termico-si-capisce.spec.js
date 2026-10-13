/* «Mi dici CTRL SOLARE dove lo prende? Vedo un sacco di volte entità solare
 * termico da configurare e non riesco a capire cosa va: non si capisce nulla
 * in questa sezione.»
 *
 * Nella Gestione termica le caselle del solare stanno nei gruppi della pagina
 * — pannello, circuito, accumulo, comandi — ognuna col nome che ha in pagina
 * e con la riga che dice che entità si aspetta; il «Sensore pompa solare»,
 * che nessuno leggeva, non c'è più; e la Valvola, che era scritta fissa su
 * valve.chiave_solare_termico, ha la sua casella.
 *
 * «Adeguami nel config i nomi dove vanno inserite le entità, ad esempio non
 * trovo Boost ed altro»: Boost, PdC e Ricircolo, tasti della pagina, adesso
 * hanno anche loro la casella. */
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

test("le caselle del solare stanno nei gruppi della pagina, coi nomi della pagina", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);
  await page.evaluate(() => {
    window.apriConfigEntita();
    window.editorSwitch("sez3");
  });
  const corpo = page.locator("#ed-body details.ed-acc .ed-acc-body").first();
  await expect(corpo.locator("[data-dm-solare-gruppo]")).toHaveCount(4, { timeout: 20_000 });
  await expect(corpo.locator('[data-dm-solare-gruppo="pannello"]')).toHaveText("☀️ Pannello");
  await expect(corpo.locator('[data-dm-solare-gruppo="circuito"]')).toHaveText("🔁 Circuito");
  await expect(corpo.locator('[data-dm-solare-gruppo="accumulo"]')).toHaveText("🛢️ Accumulo");
  await expect(corpo.locator('[data-dm-solare-gruppo="comandi"]')).toHaveText("🎛️ Comandi");

  /* «Ctrl Solare» si chiama come il tasto, e dice dove sta. */
  const ctrl = corpo
    .locator('.ed-slot-in[data-ref="dm.boiler_interruttore_solare_termico"]')
    .locator("xpath=ancestor::*[contains(concat(' ', @class, ' '), ' ed-slot ')][1]");
  await expect(ctrl.locator(".ed-slot-lbl input.wz-lbl-edit")).toHaveValue("Ctrl Solare");
  await expect(ctrl.locator("[data-dm-solare-aiuto]")).toContainText("switch");
  await expect(ctrl.locator(".dm-solare-icona")).toHaveText("♨️");

  /* Il sensore che nessuno leggeva non si offre più; la valvola sì. */
  await expect(corpo.locator('[data-ref="dm.boiler_sensore_pompa_solare"]')).toHaveCount(0);
  await expect(corpo.locator('.ed-slot-in[data-ref="dm.boiler_chiave_solare"]')).toHaveCount(1);

  /* Boost, PdC e Ricircolo hanno la loro casella, col nome del tasto. */
  for (const [ref, nome] of [
    ["dm.core_048", "Boost"],
    ["dm.core_050", "PdC"],
    ["dm.core_051", "Ricircolo"],
  ]) {
    const casella = corpo
      .locator(`.ed-slot-in[data-ref="${ref}"]`)
      .locator("xpath=ancestor::*[contains(concat(' ', @class, ' '), ' ed-slot ')][1]");
    await expect(casella.locator(".ed-slot-lbl input.wz-lbl-edit")).toHaveValue(nome);
  }

  /* Nell'ordine della pagina: il pannello, il circuito, l'accumulo e poi la
   * fila dei comandi, nell'ordine delle pillole. */
  const ordine = await corpo.evaluate((nodo) =>
    [...nodo.querySelectorAll("[data-dm-solare-gruppo], .ed-slot-in[data-ref^='dm.']")].map(
      (el) => el.dataset.dmSolareGruppo || el.dataset.ref,
    ),
  );
  expect(ordine).toEqual([
    "pannello",
    "dm.boiler_sonda_temperatura_1",
    "circuito",
    "dm.boiler_stato_pompa_solare",
    "dm.boiler_delta_temperatura",
    "dm.boiler_pressione_acqua",
    "accumulo",
    "dm.boiler_sonda_temperatura_3",
    "dm.boiler_sonda_temperatura_2",
    "dm.boiler_potenza_resistenza_boiler",
    "comandi",
    "dm.boiler_pompa_solare",
    "dm.core_051",
    "dm.boiler_centralina_solare_termico",
    "dm.boiler_interruttore_solare_termico",
    "dm.boiler_chiave_solare",
    "dm.boiler_interruttore_boiler",
    "dm.core_050",
    "dm.core_048",
    "dm.boiler_valvola_di_sicurezza",
  ]);
  await corpo.locator('[data-dm-solare-gruppo="comandi"]').scrollIntoViewIfNeeded();
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
