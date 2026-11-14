/* La spunta «si vede solo a casa vuota» si trova sotto le telecamere (#81).
 *
 * «Non trovo la spunta o l'impostazione sotto telecamere.» Ed era vero: i tre
 * blocchi che stanno sotto il riquadro delle telecamere — i rilevamenti, le
 * telecamere riservate e l'interruttore che le spegne tutte — cercavano quel
 * riquadro con due segni che la scheda Sicurezza non scrive. Non trovandolo,
 * si toglievano di mezzo in silenzio. Questa prova apre la scheda come la apre
 * chi la usa e guarda che ci siano, nell'ordine, e che la spunta salvi.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [{ id: "cam-1", name: "Soggiorno", entity: "camera.soggiorno", stream: "" }],
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
  },
  visibility: { home: true },
};

test("sotto le telecamere ci sono i rilevamenti, le riservate e l'interruttore", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  /* Una persona: senza, la spunta resta spenta apposta (non si saprebbe mai
   * se in casa c'e' qualcuno). */
  await page.evaluate(() =>
    localStorage.setItem("cd_people", JSON.stringify([{ name: "Anna", entity: "person.anna" }])),
  );
  await page.evaluate(() => window.apriConfigEntita());
  await page.evaluate(() => {
    const tab = [...document.querySelectorAll(".ed-tab")].find((voce) =>
      /sicurezza|security/i.test(voce.textContent || ""),
    );
    tab?.click();
  });

  const riservate = page.locator("#ed-body #dm-cam-privata");
  await expect(riservate).toBeAttached({ timeout: 15_000 });
  await expect(page.locator("#ed-body #dm-rilevamenti")).toBeAttached();
  await expect(page.locator("#ed-body #dm-cam-spenta")).toBeAttached();

  /* Stanno subito sotto il riquadro delle telecamere, in quest'ordine. */
  const ordine = await page.evaluate(() => {
    const riquadro = document.querySelector("#ed-body #ed-cam-ent")?.closest("details.ed-acc");
    const dopo = [];
    let nodo = riquadro?.nextElementSibling;
    while (nodo && dopo.length < 3) {
      dopo.push(nodo.id);
      nodo = nodo.nextElementSibling;
    }
    return dopo;
  });
  expect(ordine).toEqual(["dm-rilevamenti", "dm-cam-privata", "dm-cam-spenta"]);

  /* La spunta c'e', si accende e si salva per quella telecamera. */
  const spunta = riservate.locator('[data-dm-camp="camera.soggiorno"]');
  await expect(spunta).toBeEnabled();
  await spunta.check();
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem("cd_telecamere_riservate") || "{}")),
    )
    .toMatchObject({ "camera.soggiorno": true });
});
