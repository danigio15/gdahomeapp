/* «Guarda la navbar ora e vedi se secondo te e' corretta.»
 *
 * Android coi tre tasti, il vetro alto 880 e la finestra 832: i 48 dei tasti
 * li ha gia' lasciati fuori chi ospita la plancia. In Home Assistant la
 * pagina si sentiva dire lo stesso 48 da `env(safe-area-inset-bottom)` e se
 * li aggiungeva sotto la barra: una striscia vuota sotto i nomi. E scorrendo,
 * in Home Assistant come nell'app, le card passavano sotto l'orologio. E il
 * tasto dell'assistente, che galleggiava sopra le card, ne copriva sempre una.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const UNITA = ["risc", "acs", "salone", "camera"].map((n, i) => ({
  id: `c${i}`,
  name: n,
  entity: `climate.${n}`,
  type: "termo",
}));
const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [{ id: "l1", name: "Cucina", entity: "light.cucina" }],
    climate: UNITA,
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, clima: true },
};

test.use({ viewport: { width: 393, height: 832 } });

for (const dove of ["home-assistant", "app"])
  test(`${dove}: la barra senza vuoto sotto, l'assistente dentro, niente sotto l'orologio`, async ({
    page,
    browserName,
  }, testInfo) => {
    test.skip(browserName !== "chromium", "le fasce si fingono con il protocollo di Chromium");
    test.setTimeout(120_000);
    await page.addInitScript(() => {
      Object.defineProperty(Screen.prototype, "height", { get: () => 880 });
      Object.defineProperty(Screen.prototype, "width", { get: () => 393 });
    });
    if (dove === "home-assistant") {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 24, bottom: 48 } });
    }
    await page.route("https://**", (r) => r.fulfill({ status: 200, body: "" }));
    await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
    await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
    await page.evaluate(
      ({ unita, app }) => {
        document.documentElement.setAttribute("data-theme", "dark");
        localStorage.setItem("cd_clima_units", JSON.stringify(unita));
        const stati = eval("_RAW_STATES");
        for (const u of unita)
          stati[u.entity] = {
            entity_id: u.entity,
            state: "heat",
            attributes: { hvac_modes: ["off", "heat"], current_temperature: 20, temperature: 21 },
          };
        window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
        if (app) {
          /* Come la scrive l'app (`premesse.dart`). */
          const foglio = document.createElement("style");
          foglio.id = "gdahome-misure";
          foglio.textContent =
            ":root{--gdahome-alto:24px;--gdahome-basso:0px}html body{padding-top:var(--gdahome-alto)!important}";
          document.body.appendChild(foglio);
          document.documentElement.style.setProperty("--dm-fondo-di-sistema", "0px");
        }
        window.dispatchEvent(new Event("resize"));
      },
      { unita: UNITA, app: dove === "app" },
    );
    await page.locator("#setup-wizard").evaluateAll((n) => n.forEach((x) => x.remove()));
    await page.evaluate(() => document.querySelector('[data-tab="clima"]')?.click());

    /* La barra: i nomi e poco sotto, non la fascia dei tasti un'altra volta. */
    const barra = page.locator("nav.tabs.bottom-nav-bar");
    await expect
      .poll(() => barra.evaluate((n) => Math.round(n.getBoundingClientRect().height)))
      .toBeLessThan(80);
    await expect
      .poll(() => barra.evaluate((n) => Math.round(n.getBoundingClientRect().bottom)))
      .toBe(832);

    /* Scorrendo, la fascia dell'orologio resta del colore della plancia. */
    await page.mouse.move(200, 500);
    await page.mouse.wheel(0, 640);
    const fascia = page.locator("#dm-fascia-dell-orologio");
    await expect
      .poll(() => fascia.evaluate((n) => Math.round(n.getBoundingClientRect().height)))
      .toBe(24);
    /* Chi si vede in cima. La fascia non prende i tocchi, e `elementFromPoint`
     * salta chi non li prende: per guardarla glieli si accende un momento. */
    const sopra = await page.evaluate(() => {
      const f = document.getElementById("dm-fascia-dell-orologio");
      f.style.pointerEvents = "auto";
      const chi = document.elementFromPoint(200, 10);
      f.style.pointerEvents = "";
      return chi?.id || "";
    });
    expect(sopra).toBe("dm-fascia-dell-orologio");
    /* Il tasto dell'assistente sta dentro la barra, non sopra le card: sopra
     * copriva l'accensione di un termostato. E l'ultima voce, scorsa la barra
     * fino in fondo, gli si ferma accanto e non sotto. */
    const posti = await page.evaluate(() => {
      const barra = document.querySelector("nav.tabs.bottom-nav-bar");
      barra.scrollLeft = barra.scrollWidth;
      const tasto = document.getElementById("dm-assist-tasto")?.getBoundingClientRect();
      const voci = [...barra.querySelectorAll(".tab")].filter((v) => v.offsetParent);
      return {
        barra: barra.getBoundingClientRect().toJSON(),
        tasto: tasto?.toJSON(),
        ultima: voci.at(-1)?.getBoundingClientRect().right,
      };
    });
    expect(posti.tasto.top).toBeGreaterThanOrEqual(posti.barra.top);
    expect(posti.tasto.bottom).toBeLessThanOrEqual(posti.barra.bottom);
    expect(posti.ultima).toBeLessThanOrEqual(posti.tasto.left);
    if (process.env.DM_FOTO)
      await page.screenshot({ path: `${process.env.DM_FOTO}/navbar-orologio-${dove}.png` });
  });
