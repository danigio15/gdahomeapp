/* «Possibilità di inserire prezzi diversi per fasce diverse, tipo 2 fasce
 * impostabile con orario o anche 3 fasce con la possibilità di scegliere se 2
 * o 3 fasce impostabili» (#72).
 *
 * La regola di quale fascia vale quando sta nel nucleo e si prova senza un
 * documento. Qui si guarda il giro che una persona fa davvero: Configurazione
 * → Energia → Impostazioni, si scelgono tre fasce, si scrivono i prezzi, si
 * salva col tasto che salva i costi — lo stesso, perché è la stessa domanda —
 * e si va a vedere che quello che è stato scritto sia rimasto scritto.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { saveSection } from "./helpers/entity-field.js";

const SEME = {
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
    entityOverrides: {},
    people: [],
  },
  visibility: { home: true, energy: true },
};

const valori = (page, selettore) =>
  page.locator(selettore).evaluateAll((nodi) => nodi.map((nodo) => nodo.value));

async function apriLeImpostazioniEnergia(page, testInfo) {
  test.setTimeout(90_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate(() => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
  });
  await page.locator('.ed-tab[data-tab="sez1"]').first().click();
  await page
    .locator("#ed-body .ed-inner-tab", { hasText: /IMPOSTAZIONI|SETTINGS/i })
    .first()
    .click();
  await expect(page.locator(".dm-energy-cost-card [data-dm-fasce]")).toBeVisible({
    timeout: 20_000,
  });
}

test("tre fasce si scelgono, si scrivono e restano scritte", async ({ page }, testInfo) => {
  await apriLeImpostazioniEnergia(page, testInfo);
  /* Di serie non ce n'è nessuna: chi non le apre continua col prezzo unico. */
  await expect(page.locator("[data-dm-fascia]")).toHaveCount(0);

  await page.locator("[data-dm-fasce-quante]").selectOption("3");
  await expect(page.locator("[data-dm-fascia]")).toHaveCount(3);
  /* Le ore di serie sono quelle della bolletta italiana: chi apre le caselle
   * le trova già piene di qualcosa di sensato invece che di mezzanotte. */
  await expect
    .poll(() => valori(page, "[data-dm-fascia-dalle]"))
    .toEqual(["08:00", "19:00", "23:00"]);

  const righe = page.locator("[data-dm-fascia]");
  await righe.nth(0).locator("[data-dm-fascia-prezzo]").fill("0.35");
  await righe.nth(1).locator("[data-dm-fascia-prezzo]").fill("0.28");
  await righe.nth(2).locator("[data-dm-fascia-prezzo]").fill("0.20");
  /* Il fine settimana: in Italia sta tutto nella fascia più bassa, e senza
   * questa riga il sabato verrebbe contato come un mercoledì. */
  await page.locator("[data-dm-fasce-festivi]").selectOption("2");
  await page.locator("#ed-costo-kwh").fill("0.30");

  /* Un tasto solo, quello dei costi: le fasce rispondono alla stessa domanda,
   * e una scheda dove metà si salva e metà no è peggio di due tasti. */
  await saveSection(page);
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("cd_fasce_kwh") || "null")))
    .toEqual({
      quante: 3,
      voci: [
        { dalle: 480, prezzo: 0.35 },
        { dalle: 1140, prezzo: 0.28 },
        { dalle: 1380, prezzo: 0.2 },
      ],
      festivi: 2,
    });
  /* E il prezzo unico resta dov'era: è il ripiego delle fasce, non il loro
   * sostituto. */
  await expect.poll(() => page.evaluate(() => localStorage.getItem("cd_costo_kwh"))).toBe("0.3");
});

test("passando da tre fasce a due, le prime due restano scritte", async ({ page }, testInfo) => {
  await apriLeImpostazioniEnergia(page, testInfo);
  await page.locator("[data-dm-fasce-quante]").selectOption("3");
  const righe = page.locator("[data-dm-fascia]");
  await righe.nth(0).locator("[data-dm-fascia-prezzo]").fill("0.35");
  await righe.nth(1).locator("[data-dm-fascia-prezzo]").fill("0.28");
  await righe.nth(2).locator("[data-dm-fascia-prezzo]").fill("0.20");

  await page.locator("[data-dm-fasce-quante]").selectOption("2");
  await expect(page.locator("[data-dm-fascia]")).toHaveCount(2);
  /* Chi cambia idea non deve riscrivere quello che aveva già scritto. */
  await expect.poll(() => valori(page, "[data-dm-fascia-prezzo]")).toEqual(["0.35", "0.28"]);
  await expect.poll(() => valori(page, "[data-dm-fascia-dalle]")).toEqual(["08:00", "19:00"]);
});
