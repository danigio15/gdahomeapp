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

/* Piu' voci nella barra: le sezioni che si mostrano anche senza niente
 * dentro, oltre all'Auto. */
const SEME_BARRA = {
  ...SEME,
  visibility: { home: true, ev: true, energy: true, security: true, server: true, temp: true },
};

/* La barra in basso: in modifica anche le sue voci si spostano, col mouse e
 * dalla tastiera. L'ordine si scrive dove l'ha sempre scritto il Config con le
 * frecce, `cd_navbar_order`, e Config resta l'ultima. */
test("in modifica la barra delle sezioni si riordina e resta cosi'", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await pontefinto(page);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME_BARRA);
  await lAuto(page);
  await clickBottomTab(page, "ev", testInfo);
  const ordine = () =>
    page.evaluate(() =>
      [...document.querySelectorAll("nav.tabs .tab[data-tab]")]
        .filter((t) => getComputedStyle(t).display !== "none")
        .map((t) => t.dataset.tab),
    );
  const prima = await ordine();
  expect(prima.length).toBeGreaterThanOrEqual(3);
  await page.locator("#page-ev [data-dm-disp-tasto]").click();
  await expect(page.locator("nav.tabs [data-dm-disp-barra-sezioni]")).toHaveCount(1);
  const mobili = prima.filter((k) => k !== "config");
  await expect(page.locator('nav.tabs .tab[data-tab="config"]')).not.toHaveAttribute(
    "data-dm-riordina-riga",
    /./,
  );

  /* Dalla tastiera la prima va un posto avanti. */
  await page.locator(`nav.tabs .tab[data-tab="${mobili[0]}"]`).focus();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(ordine)
    .toEqual(prima.map((k) => (k === mobili[0] ? mobili[1] : k === mobili[1] ? mobili[0] : k)));
  /* Un tocco sulla voce in modifica non cambia pagina. */
  await page.locator(`nav.tabs .tab[data-tab="${mobili[1]}"]`).click();
  await expect(page.locator("html")).toHaveAttribute("data-dm-modifica", "ev");
  await expect(page.locator(".dm-disp-conta")).toContainText("1 modifica");

  await page.locator('[data-dm-disp-azione="salva"]').click();
  const scritto = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("cd_navbar_order") || "[]"),
  );
  expect(scritto.at(-1)).toBe("config");
  expect(scritto.indexOf(mobili[0])).toBeGreaterThan(scritto.indexOf(mobili[1]));
  await expect(page.locator("[data-dm-disp-barra-sezioni]")).toHaveCount(0);

  await page.reload();
  await lAuto(page);
  /* L'ordine salvato lo rimette la plancia appena partita. */
  await expect
    .poll(async () => {
      const dopo = await ordine();
      return dopo.indexOf(mobili[0]) > dopo.indexOf(mobili[1]) && dopo.at(-1) === "config";
    })
    .toBe(true);
});

test("Annulla rimette la barra delle sezioni com'era", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await pontefinto(page);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME_BARRA);
  await lAuto(page);
  await clickBottomTab(page, "ev", testInfo);
  const ordine = () =>
    page.evaluate(() =>
      [...document.querySelectorAll("nav.tabs .tab[data-tab]")].map((t) => t.dataset.tab),
    );
  const prima = await ordine();
  await page.locator("#page-ev [data-dm-disp-tasto]").click();
  const prima_mobile = await page
    .locator("nav.tabs .tab[data-dm-riordina-riga]")
    .first()
    .getAttribute("data-tab");
  await page.locator(`nav.tabs .tab[data-tab="${prima_mobile}"]`).focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(ordine).not.toEqual(prima);
  /* E col mouse: la voce presa e portata due posti piu' in la'. */
  const mosse = await ordine();
  const voci = page.locator("nav.tabs .tab[data-dm-riordina-riga]");
  const da = await voci.nth(0).boundingBox();
  const a = await voci.nth(2).boundingBox();
  await page.mouse.move(da.x + da.width / 2, da.y + da.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(350);
  for (let i = 1; i <= 12; i += 1)
    await page.mouse.move(
      da.x + da.width / 2 + ((a.x + a.width * 0.75 - da.x - da.width / 2) * i) / 12,
      da.y + da.height / 2,
    );
  await page.mouse.up();
  await expect.poll(ordine).not.toEqual(mosse);
  await page.locator('[data-dm-disp-azione="annulla"]').click();
  await expect.poll(ordine).toEqual(prima);
  expect(await page.evaluate(() => localStorage.getItem("cd_navbar_order"))).toBeNull();
});

/* Sul telefono la barra delle sezioni scorre di lato, e le voci stanno in una
 * striscia senza scatola (`display:contents`): il fantasma si misurava su di
 * lei, finiva fuori dallo schermo, e intanto la pagina scorreva da sola perche'
 * il dito sta sempre vicino al bordo in basso. Col dito vero — tenere premuto,
 * poi trascinare — la voce si sposta e la pagina resta ferma. */
test("sul telefono una voce della barra si trascina col dito", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "il dito c'e' solo sul telefono");
  test.setTimeout(150_000);
  await pontefinto(page);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME_BARRA);
  await lAuto(page);
  await clickBottomTab(page, "ev", testInfo);
  const ordine = () =>
    page.evaluate(() =>
      [...document.querySelectorAll("nav.tabs .tab[data-tab]")]
        .filter((t) => getComputedStyle(t).display !== "none")
        .map((t) => t.dataset.tab),
    );
  await page.locator("#page-ev [data-dm-disp-tasto]").click();
  await expect(page.locator("nav.tabs [data-dm-disp-barra-sezioni]")).toHaveCount(1);
  const larghezza = page.viewportSize().width;
  const voci = page.locator("nav.tabs .tab[data-dm-riordina-riga]");
  const scatole = [];
  for (let i = 0; i < (await voci.count()); i += 1) {
    const b = await voci.nth(i).boundingBox();
    if (b && b.x >= 0 && b.x + b.width <= larghezza)
      scatole.push({ b, tab: await voci.nth(i).getAttribute("data-tab") });
  }
  expect(scatole.length).toBeGreaterThanOrEqual(3);
  const [presa, , arrivo] = scatole;
  const prima = await ordine();
  const scrollPrima = await page.evaluate(() => window.scrollY);
  const dito = await page.context().newCDPSession(page);
  const punto = (x, y) => [{ x, y, id: 1 }];
  const x0 = presa.b.x + presa.b.width / 2;
  const y0 = presa.b.y + presa.b.height / 2;
  const x1 = arrivo.b.x + arrivo.b.width * 0.75;
  await dito.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: punto(x0, y0) });
  /* Tenere premuto un attimo: un dito che scorre subito scorre la barra. */
  await page.waitForTimeout(450);
  for (let i = 1; i <= 12; i += 1) {
    await dito.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: punto(x0 + ((x1 - x0) * i) / 12, y0),
    });
    await page.waitForTimeout(16);
  }
  /* Il fantasma e' sotto il dito, dentro lo schermo. */
  const fantasma = await page.locator("nav.tabs [data-dm-fantasma]").boundingBox();
  expect(fantasma).not.toBeNull();
  expect(fantasma.x).toBeGreaterThan(0);
  expect(fantasma.x + fantasma.width).toBeLessThan(larghezza + 1);
  expect(Math.abs(fantasma.x + fantasma.width / 2 - x1)).toBeLessThan(fantasma.width);
  await dito.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  /* La pagina sotto non e' scesa da sola. */
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - scrollPrima)).toBeLessThan(4);
  const dopo = await ordine();
  expect(dopo).not.toEqual(prima);
  expect(dopo.indexOf(presa.tab)).toBeGreaterThan(prima.indexOf(presa.tab));
  await expect(page.locator(".dm-disp-conta")).toContainText("1 modifica");
});
