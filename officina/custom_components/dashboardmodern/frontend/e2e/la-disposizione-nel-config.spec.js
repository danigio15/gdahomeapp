/* La disposizione nel Config (#379).
 *
 * L'«Ordine navbar» aveva solo le frecce ▲▼: adesso le righe si trascinano
 * dalla loro maniglia (o dalle frecce della tastiera), e l'ordine si scrive
 * dove l'hanno sempre scritto le frecce. Sotto, le «Disposizioni salvate»: le
 * pagine cambiate col ✏️, ognuna col suo «Ripristina».
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { SEME, lAuto, pontefinto } from "./helpers/disposizione-finta.js";

test.use({ timezoneId: "Europe/Rome", locale: "it-IT" });

const SEME_CONFIG = {
  ...SEME,
  visibility: { home: true, ev: true, energy: true, security: true, server: true },
};

async function apriLeImpostazioni(page) {
  await page.evaluate(() => {
    apriConfigEntita();
    editorSwitch("visib");
  });
  await expect(page.locator("[data-dm-ordine-barra]")).toBeVisible({ timeout: 15_000 });
}

const righe = (page) =>
  page
    .locator("[data-dm-ordine-barra] > [data-dm-riordina-riga]")
    .evaluateAll((n) => n.map((r) => r.dataset.dmRiordinaRiga));

test("nel Config l'ordine della barra si trascina e Config resta in fondo", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await pontefinto(page);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME_CONFIG);
  await lAuto(page);
  await apriLeImpostazioni(page);
  const prima = await righe(page);
  expect(prima.length).toBeGreaterThan(3);
  expect(prima).not.toContain("config");

  /* Dalla tastiera: la prima giu' di un posto. */
  await page.locator(`[data-dm-riordina-riga="${prima[0]}"] [data-dm-maniglia]`).focus();
  await page.keyboard.press("ArrowDown");
  await expect.poll(() => righe(page)).toEqual([prima[1], prima[0], ...prima.slice(2)]);
  let scritto = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("cd_navbar_order") || "[]"),
  );
  expect(scritto.slice(0, 2)).toEqual([prima[1], prima[0]]);
  expect(scritto.at(-1)).toBe("config");
  /* Il fuoco resta sulla maniglia di chi si e' spostato. */
  await expect(
    page.locator(`[data-dm-riordina-riga="${prima[0]}"] [data-dm-maniglia]`),
  ).toBeFocused();

  /* Col mouse: la terza portata in cima. */
  const presa = page.locator(`[data-dm-riordina-riga="${prima[2]}"] [data-dm-maniglia]`);
  const cima = page.locator(`[data-dm-riordina-riga="${prima[1]}"]`);
  await presa.scrollIntoViewIfNeeded();
  const da = await presa.boundingBox();
  const a = await cima.boundingBox();
  await page.mouse.move(da.x + da.width / 2, da.y + da.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 12; i += 1)
    await page.mouse.move(
      da.x + da.width / 2,
      da.y + da.height / 2 + ((a.y + 4 - da.y - da.height / 2) * i) / 12,
    );
  await page.mouse.up();
  await expect.poll(async () => (await righe(page))[0]).toBe(prima[2]);
  scritto = await page.evaluate(() => JSON.parse(localStorage.getItem("cd_navbar_order") || "[]"));
  expect(scritto[0]).toBe(prima[2]);
  expect(scritto.at(-1)).toBe("config");
  /* E la barra vera segue. */
  await expect
    .poll(() =>
      page.evaluate(() =>
        [...document.querySelectorAll("nav.tabs .tab[data-tab]")].map((t) => t.dataset.tab),
      ),
    )
    .toEqual(expect.arrayContaining([prima[2]]));
  const barra = await page.evaluate(() =>
    [...document.querySelectorAll("nav.tabs .tab[data-tab]")].map((t) => t.dataset.tab),
  );
  expect(barra[0]).toBe(prima[2]);
  expect(barra.at(-1)).toBe("config");
  /* Le frecce di prima ci sono ancora. */
  await expect(
    page.locator('[data-dm-ordine-barra] [onclick="edNavMove(this)"]').first(),
  ).toBeAttached();
});

test("le disposizioni salvate si vedono nel Config e si ripristinano una per una", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await pontefinto(page);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME_CONFIG);
  await page.evaluate(() => {
    localStorage.setItem(
      "cd_disposizione",
      JSON.stringify({
        ev: { ordine: ["batteria", "auto"], nascosti: ["sessione"] },
        energy: { ordine: ["conti", "numeri"] },
      }),
    );
  });
  await lAuto(page);
  await apriLeImpostazioni(page);
  const salvate = page.locator("[data-dm-disp-salvata]");
  await expect(salvate).toHaveCount(2);
  await expect(page.locator('[data-dm-disp-salvata="ev"]')).toContainText("Auto");
  await expect(page.locator('[data-dm-disp-salvata="ev"]')).toContainText("Riquadri nascosti: 1");
  await page.locator('[data-dm-disp-ripristina="ev"]').click();
  await expect(salvate).toHaveCount(1);
  const dopo = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("cd_disposizione") || "{}"),
  );
  expect(Object.keys(dopo)).toEqual(["energy"]);
  /* L'ultima: «Ripristina tutte» c'e' solo con piu' di una. */
  await expect(page.locator("[data-dm-disp-ripristina-tutte]")).toHaveCount(0);
  await page.locator('[data-dm-disp-ripristina="energy"]').click();
  await expect(page.locator("[data-dm-disp-salvate]")).toContainText("Nessuna pagina cambiata");
  expect(await page.evaluate(() => localStorage.getItem("cd_disposizione"))).toBe("{}");
});

test("i disegni salvati si vedono nel Config, e si ripristinano uno per uno", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "il computer");
  test.setTimeout(150_000);
  await pontefinto(page);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME_CONFIG);
  await page.evaluate(() => {
    localStorage.setItem(
      "cd_disegni",
      JSON.stringify({
        "energia:computer": { solare: { x: 30, y: 20 }, "carico:frigo": { x: 70, y: 80 } },
        "energia:telefono": { batteria: { x: 60, y: 50 } },
        "irrigazione:computer": { "zona:switch.orto": { x: 40, y: 60 } },
      }),
    );
  });
  await lAuto(page);
  await apriLeImpostazioni(page);
  const disegni = page.locator("[data-dm-disegno-salvato]");
  await expect(disegni).toHaveCount(3);
  /* Ogni disegno col suo nome, lo schermo e quanti pezzi si sono spostati. */
  const computer = page.locator('[data-dm-disegno-salvato="energia:computer"]');
  await expect(computer).toContainText("Flusso energetico");
  await expect(computer).toContainText("Disegno del computer");
  await expect(computer).toContainText("Pezzi spostati: 2");
  await expect(page.locator('[data-dm-disegno-salvato="energia:telefono"]')).toContainText(
    "Disegno del telefono",
  );
  await expect(page.locator('[data-dm-disegno-salvato="irrigazione:computer"]')).toContainText(
    "Prato dell'irrigazione",
  );
  /* Il disegno del computer se ne va, quello del telefono resta. */
  await page.locator('[data-dm-disegno-ripristina-salvato="energia:computer"]').click();
  await expect(disegni).toHaveCount(2);
  expect(
    Object.keys(await page.evaluate(() => JSON.parse(localStorage.getItem("cd_disegni") || "{}"))),
  ).toEqual(["energia:telefono", "irrigazione:computer"]);
  /* E tutti insieme. */
  await page.locator("[data-dm-disegno-ripristina-tutti]").click();
  await expect(page.locator("[data-dm-disegni-salvati]")).toContainText("Nessun disegno cambiato");
  expect(await page.evaluate(() => localStorage.getItem("cd_disegni"))).toBe("{}");
  /* Le disposizioni delle pagine non si toccano. */
  await expect(page.locator("[data-dm-disp-salvate]")).toBeVisible();
});
