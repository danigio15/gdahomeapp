/* «Inserisco l'entità caldaia ma non la salva e non viene mostrata nella
 * pagina.»
 *
 * La casa ha già una voce nello Stato termico — il Termocamino — e la sua
 * caldaia si chiama proprio `switch.caldaia`, come la casella. Sceglierla la
 * deve tenere nella casella e portarla nel popup Caldo. */
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
    climate: [{ id: "c1", name: "Bagno", entity: "input_boolean.termo_bagno", type: "termo" }],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true },
};

test("la caldaia scelta resta nella casella e compare nel popup Caldo", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate(() => {
    const grezzi = eval("_RAW_STATES");
    for (const id of ["switch.caldaia", "switch.termocamino"])
      grezzi[id] = { entity_id: id, state: "on", attributes: {} };
    window.localStorage.setItem(
      "cd_termico_caldo",
      JSON.stringify([{ name: "Termocamino", entity: "switch.termocamino", icon: "🔥" }]),
    );
  });

  await page.evaluate(() => window.apriConfigEntita());
  await page.evaluate(() => {
    const clima = [...document.querySelectorAll(".ed-tab")].find((tab) =>
      /clima/i.test(tab.textContent || ""),
    );
    clima?.click();
  });
  const carta = page.locator("#editor-modal [data-dm-termico-caldo]");
  await expect(carta).toBeAttached({ timeout: 20000 });
  await expect(carta.locator(".dm-termico-riga")).toHaveCount(1);

  /* Si sceglie la caldaia, come fa la lente: scritta e annunciata. */
  await page.locator('#ed-body [data-ref="switch.caldaia"]').evaluate((campo) => {
    campo.value = "switch.caldaia";
    campo.dispatchEvent(new Event("input", { bubbles: true }));
    campo.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(carta.locator(".dm-termico-riga")).toHaveCount(2);
  await expect(carta.locator(".dm-termico-nome").first()).toHaveValue("Caldaia");
  const voci = await page.evaluate(() => JSON.parse(localStorage.getItem("cd_termico_caldo")));
  expect(voci.map((voce) => voce.entity)).toEqual(["switch.caldaia", "switch.termocamino"]);

  /* Riaperta la scheda, la casella dice ancora quale caldaia. */
  await page.locator('#editor-modal .ed-tab[data-tab="luci"]').click();
  const ricordati = page.locator('#dm-ricordati-di-salvare [data-dm-rds="esci"]');
  if (await ricordati.count()) await ricordati.click();
  await page.evaluate(() => {
    const clima = [...document.querySelectorAll(".ed-tab")].find((tab) =>
      /clima/i.test(tab.textContent || ""),
    );
    clima?.click();
  });
  await expect(page.locator('#ed-body [data-ref="switch.caldaia"]')).toHaveValue("switch.caldaia");

  /* E il popup Caldo la mostra. */
  await page.evaluate(() => document.getElementById("editor-modal")?.remove());
  await page.evaluate(() => {
    window.apriQuickClima?.();
    window.setQuickClimaMode?.("caldo");
  });
  const pannello = page.locator("#ns-thermal-panel");
  await expect(pannello).toBeVisible({ timeout: 20000 });
  await expect(pannello).toContainText("Caldaia");
  await expect(pannello).toContainText("Termocamino");
});
