/* «🔊 Alexa»: una sezione del Config tutta sua, con le schede «Notifiche» e
 * «Avvisi personalizzati».
 *
 * Gli Echo sono quelli di Alexa Media Player, riconosciuti da `last_called`;
 * un lettore qualunque non compare. Le scelte si salvano in `cd_alexa`, e
 * senza Echo il riquadro spiega dove si installa l'integrazione.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

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
  },
  visibility: { home: true },
};

const ECHO = {
  "media_player.echo_cucina": {
    entity_id: "media_player.echo_cucina",
    state: "idle",
    attributes: { friendly_name: "Echo Cucina", last_called: false },
  },
  "media_player.echo_camera": {
    entity_id: "media_player.echo_camera",
    state: "unavailable",
    attributes: { friendly_name: "Echo Camera", last_called: true },
  },
  "cover.garage": {
    entity_id: "cover.garage",
    state: "open",
    attributes: { friendly_name: "Garage" },
  },
  "media_player.tv_sala": {
    entity_id: "media_player.tv_sala",
    state: "off",
    attributes: { friendly_name: "TV Sala" },
  },
};

async function conStati(page, valori) {
  await page.evaluate((valori) => {
    window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...valori } };
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, valori);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, valori);
}

async function apriAvvisi(page, scheda = "alexa") {
  await page.evaluate(() => globalThis.apriConfigEntita?.());
  await page.locator(`.ed-tab[data-tab="${scheda}"]`).click();
}

test("gli Echo si scelgono nella scheda Avvisi e la scelta si salva", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await conStati(page, ECHO);
  await apriAvvisi(page);

  const blocco = page.locator("[data-dm-alexa-ed]");
  await expect(blocco).toHaveCount(1, { timeout: 20_000 });
  await expect(blocco.locator("[data-dm-alexa-echo]")).toHaveCount(2);
  await page.screenshot({ path: testInfo.outputPath("alexa-sezione.png") });
  await expect(blocco).toContainText("Echo Cucina");
  await expect(blocco).not.toContainText("TV Sala");

  await blocco.locator("[data-dm-alexa-attivo]").click();
  await page.locator("[data-dm-alexa-echo='media_player.echo_cucina']").click();
  await page.locator("[data-dm-alexa-categoria='casa']").click();
  const salvata = await page.evaluate(() => JSON.parse(localStorage.getItem("cd_alexa")));
  expect(salvata.attivo).toBe(true);
  expect(salvata.altoparlanti).toEqual(["media_player.echo_cucina"]);
  expect(salvata.categorie).toEqual(["urgenti", "casa"]);

  await expect(page.locator("[data-dm-alexa-prova]")).toBeEnabled();
  await expect(page.locator(".ed-tab.active")).toContainText("Notifiche");
  // La sezione e' sua: la famiglia «Alexa» fra quelle in alto, non dentro
  // gli Avvisi.
  await expect(page.locator('[data-dm-famiglia="alexa"]')).toHaveCount(1);
  await expect(page.locator(".dm-alberatura-titolo, #ed-body h2").first()).toContainText("Alexa");
  await page.screenshot({
    path: testInfo.outputPath("alexa-nelle-notifiche.png"),
    fullPage: false,
  });
  await page.locator("[data-dm-alexa-prova]").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("alexa-in-fondo.png") });
});

test("senza Echo il riquadro dice dove si installa Alexa Media Player", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await apriAvvisi(page);
  const blocco = page.locator("[data-dm-alexa-ed]");
  await expect(blocco).toHaveCount(1, { timeout: 20_000 });
  await expect(blocco).toContainText("Alexa Media Player");
  await expect(blocco.locator("[data-dm-alexa-prova]")).toHaveCount(0);
});

test("gli avvisi personalizzati: uno a orario e uno sul garage", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate(() =>
    localStorage.setItem(
      "cd_alexa",
      JSON.stringify({ attivo: true, altoparlanti: ["media_player.echo_cucina"] }),
    ),
  );
  await conStati(page, ECHO);
  await apriAvvisi(page, "alexa_avvisi");
  const blocco = page.locator("[data-dm-alexa-avvisi]");
  await expect(blocco).toHaveCount(1, { timeout: 20_000 });

  // A un orario, dal lunedi' al venerdi'.
  await blocco.locator("[data-dm-av-nuovo]").click();
  await page.locator("[data-dm-av-frase]").fill("È ora di andare a scuola");
  await page.locator("[data-dm-av-ora]").fill("07:30");
  await page.locator("[data-dm-av-giorno='6']").click();
  await page.locator("[data-dm-av-giorno='0']").click();
  await page.locator("[data-dm-av-salva]").click();

  // Quando il garage resta aperto 10 minuti.
  await blocco.locator("[data-dm-av-nuovo]").click();
  await page.locator("[data-dm-av-frase]").fill("Il garage è aperto");
  await page.locator("[data-dm-av-quando='stato']").click();
  // Il campo lo veste il selettore della plancia («Scegli entità»): si
  // scrive come fa lui, nel campo, con un «change».
  await page.evaluate(() => {
    const campo = document.querySelector("[data-dm-av-entita]");
    campo.value = "cover.garage";
    campo.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.locator("[data-dm-av-valore]").fill("open");
  await page.locator("[data-dm-av-per]").fill("10");
  await expect(page.locator("[data-dm-av-bozza]")).toContainText("open");
  await page.locator("[data-dm-av-salva]").click();

  const salvata = await page.evaluate(() => JSON.parse(localStorage.getItem("cd_alexa")));
  expect(salvata.avvisi).toHaveLength(2);
  expect(salvata.avvisi[0]).toMatchObject({
    frase: "È ora di andare a scuola",
    quando: "orario",
    ora: "07:30",
    giorni: [1, 2, 3, 4, 5],
  });
  expect(salvata.avvisi[1]).toMatchObject({
    quando: "stato",
    entita: "cover.garage",
    condizione: "uguale",
    valore: "open",
    per: 10,
  });
  await expect(blocco).toContainText("Garage è «open» · da almeno 10 min");

  await blocco.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("avvisi-elenco.png") });
  // E com'e' quando se ne scrive uno.
  await blocco.locator("[data-dm-av-apri]").last().click();
  await page.locator("[data-dm-av-bozza]").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("avvisi-bozza.png") });
});
