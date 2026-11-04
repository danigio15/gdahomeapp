/* La disposizione si modifica sulla plancia (#379).
 *
 * «Il discorso drag & drop deve essere ovunque, non solo nei widget.» In testa
 * a ogni pagina c'e' il tasto ✏️: i riquadri e gli elementi degli elenchi si
 * trascinano li' dove sono, l'occhio li nasconde, «Salva» scrive
 * `cd_disposizione` e la pagina resta cosi' anche ricaricandola; «Ripristina»
 * la rimette com'era.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { clickBottomTab } from "./helpers/navigation.js";
import { SEME, SEME_LUCI, STATI_LUCI, lAuto, pontefinto } from "./helpers/disposizione-finta.js";

test.use({ timezoneId: "Europe/Rome", locale: "it-IT" });

const riquadri = (page) =>
  page.evaluate(() => window.dmDisposizione.elenchi().find((e) => e.chiave === "ev")?.voci || []);

test("sull'Auto i riquadri si trascinano, si salvano e restano dopo aver ricaricato", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await pontefinto(page);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await lAuto(page);
  await clickBottomTab(page, "ev", testInfo);
  await expect(page.locator("#page-ev [data-dm-disp-tasto]")).toBeVisible();
  await expect.poll(() => riquadri(page)).toContain("auto");
  const prima = await riquadri(page);
  expect(prima[0]).toBe("auto");

  await page.locator("#page-ev [data-dm-disp-tasto]").click();
  await expect(page.locator("html")).toHaveAttribute("data-dm-modifica", "ev");
  await expect(page.locator("[data-dm-disp-barra]")).toBeVisible();

  /* Il riquadro in cima, preso dalla sua maniglia col mouse e portato giu'. */
  const maniglia = page.locator("#lm-hero-card [data-dm-disp-ctrl] .dm-disp-maniglia");
  const ultimo = page.locator(`#page-ev [data-dm-disp-voce="${prima.at(-1)}"]`);
  await expect(maniglia).toBeVisible();
  await expect(ultimo).toBeVisible();
  /* La pagina puo' ridisegnarsi proprio adesso (lo stato dell'auto arriva dal
   * ponte finto): si aspetta che tutte e due abbiano una scatola vera. */
  let a = null;
  let b = null;
  await expect
    .poll(async () => {
      a = await maniglia.boundingBox().catch(() => null);
      b = await ultimo.boundingBox().catch(() => null);
      return Boolean(a && b && a.width > 0 && b.height > 0);
    })
    .toBe(true);
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 14; i += 1)
    await page.mouse.move(a.x + a.width / 2, a.y + ((b.y + b.height - a.y) * i) / 14);
  await page.mouse.up();
  await expect.poll(async () => (await riquadri(page)).indexOf("auto")).toBeGreaterThan(0);
  /* E dalla tastiera, fino in fondo. */
  for (let i = 0; i < prima.length; i += 1) {
    await page.locator("#lm-hero-card [data-dm-disp-ctrl] .dm-disp-maniglia").focus();
    await page.keyboard.press("ArrowDown");
  }
  await expect.poll(async () => (await riquadri(page)).at(-1)).toBe("auto");
  await expect(page.locator(".dm-disp-conta")).toContainText("1 modifica");

  /* In modifica un tocco non comanda niente: si nasconde un riquadro. */
  await page.locator(`#page-ev [data-dm-disp-voce="${prima[1]}"] [data-dm-disp-occhio]`).click();
  await expect(page.locator(`#page-ev [data-dm-disp-voce="${prima[1]}"]`)).toHaveAttribute(
    "data-dm-nascosto",
    "",
  );

  await page.locator('[data-dm-disp-azione="salva"]').click();
  await expect(page.locator("html")).not.toHaveAttribute("data-dm-modifica", /./);
  const scritta = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("cd_disposizione") || "{}"),
  );
  expect(scritta.ev.ordine.at(-1)).toBe("auto");
  expect(scritta.ev.nascosti).toEqual([prima[1]]);
  await expect(page.locator(`#page-ev [data-dm-nascosto]`).first()).toBeHidden();

  await page.reload();
  await lAuto(page);
  await clickBottomTab(page, "ev", testInfo);
  await expect.poll(async () => (await riquadri(page)).at(-1)).toBe("auto");

  /* Ripristina, Salva: la pagina com'era e niente scritto. */
  await page.locator("#page-ev [data-dm-disp-tasto]").click();
  await page.locator('[data-dm-disp-azione="ripristina"]').click();
  await page.locator('[data-dm-disp-azione="salva"]').click();
  /* Dopo il ricaricamento l'auto mostra anche i riquadri dei dati arrivati
   * nel frattempo: si guarda l'ordine di quelli di prima. */
  await expect
    .poll(async () => (await riquadri(page)).filter((id) => prima.includes(id)))
    .toEqual(prima);
  const dopo = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("cd_disposizione") || "{}"),
  );
  expect(dopo.ev).toBeUndefined();
  await expect(page.locator("#page-ev [data-dm-nascosto]")).toHaveCount(0);
});

test("Annulla rimette tutto com'era e non scrive niente", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await pontefinto(page);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await lAuto(page);
  await clickBottomTab(page, "ev", testInfo);
  await expect.poll(() => riquadri(page)).toContain("auto");
  const prima = await riquadri(page);
  await page.locator("#page-ev [data-dm-disp-tasto]").click();
  await page.locator(`#page-ev [data-dm-disp-voce="${prima[0]}"] [data-dm-disp-occhio]`).click();
  await page.locator('[data-dm-disp-azione="annulla"]').click();
  await expect(page.locator("[data-dm-disp-barra]")).toHaveCount(0);
  await expect(page.locator("#page-ev [data-dm-nascosto]")).toHaveCount(0);
  expect(await riquadri(page)).toEqual(prima);
  expect(await page.evaluate(() => localStorage.getItem("cd_disposizione"))).toBeNull();
});

/* Le luci di una stanza: un elenco dentro un riquadro. Si riordinano dalla
 * tastiera — Tab fino alla luce, poi le frecce — e l'ordine si scrive con gli
 * id delle entita', che restano gli stessi anche se la pagina cambia. */
test("le luci di una stanza si riordinano e l'ordine si scrive con le entita'", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (r) => r.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME_LUCI);
  await page.locator("#setup-wizard").evaluateAll((n) => n.forEach((x) => x.remove()));
  await page.evaluate((stati) => {
    window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...stati } };
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, stati);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, STATI_LUCI);
  await clickBottomTab(page, "luci", testInfo);
  const elencoDiLuci = () =>
    page.evaluate(
      () =>
        window.dmDisposizione
          .elenchi()
          .find((e) => e.voci.filter((v) => v.startsWith("light.")).length >= 2) || null,
    );
  await expect.poll(elencoDiLuci, { timeout: 15_000 }).not.toBeNull();
  await page.waitForTimeout(600);
  await page.locator("#page-luci [data-dm-disp-tasto]").click();
  /* La pagina delle luci si ridisegna quando arrivano gli stati: si aspetta
   * che stia ferma (nessun giro nuovo per mezzo secondo), se no la luce presa
   * dalla tastiera puo' essere quella di prima del ridisegno. */
  let giri = -1;
  await expect
    .poll(
      async () => {
        const ora = await page.evaluate(() => window.dmDisposizione.giri());
        const fermo = ora === giri;
        giri = ora;
        return fermo;
      },
      { intervals: [500] },
    )
    .toBe(true);
  const prima = await elencoDiLuci();
  const primaLuce = page.locator(`#page-luci [data-dm-disp-voce="${prima.voci[0]}"]`);
  await expect(primaLuce).toHaveAttribute("data-dm-maniglia", "");
  await primaLuce.focus();
  await page.keyboard.press("ArrowDown");
  await expect
    .poll(
      async () =>
        (
          await page.evaluate(
            (k) => window.dmDisposizione.elenchi().find((e) => e.chiave === k),
            prima.chiave,
          )
        )?.voci,
    )
    .toEqual([prima.voci[1], prima.voci[0], ...prima.voci.slice(2)]);
  await page.locator('[data-dm-disp-azione="salva"]').click();
  const scritta = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("cd_disposizione") || "{}"),
  );
  expect(scritta[prima.chiave].ordine.slice(0, 2)).toEqual([prima.voci[1], prima.voci[0]]);
});

test("in Home il tasto ✏️ porta all'anteprima delle tessere nel Config", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await pontefinto(page);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((n) => n.forEach((x) => x.remove()));
  const tasto = page.locator('#page-home [data-dm-disp-tasto="home"]');
  await expect(tasto).toBeVisible();
  await tasto.click();
  await expect(page.locator('[data-dm-anteprima="home"]').first()).toBeVisible({ timeout: 15_000 });
});
