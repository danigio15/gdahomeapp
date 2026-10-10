/* «Sezione auto: se e' gia' configurata una vettura non mi devi far vedere
 * tutte le entita' sempre, ma solo quelle salvate e il tasto Aggiungi, e in
 * quel momento escono le entita'. Se devo modificarne una gia' creata premo la
 * matita accanto al nome e compaiono le entita'.»
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
  visibility: { home: true, ev: true },
};

const DUE_AUTO = [
  {
    name: "B10",
    uid: "b10",
    brand: "Leapmotor",
    model: "B10",
    ov: { "dm.ev_batteria_auto": "sensor.b10_battery" },
    img: "/local/ev/b10-idle.png",
    imgPlugged: "/local/ev/b10-cavo.png",
  },
  {
    name: "T03",
    uid: "t03",
    brand: "Leapmotor",
    model: "T03",
    ov: { "dm.ev_batteria_auto": "sensor.t03_battery" },
    img: "/local/ev/t03-idle.png",
    imgPlugged: "/local/ev/t03-cavo.png",
  },
];

async function avvia(page, testInfo) {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => Boolean(window.cdEvApplyCar?.__dmEvSection), null, {
    timeout: 40_000,
  });
  await page.evaluate((elenco) => {
    localStorage.setItem("cd_ev_cars", JSON.stringify(elenco));
    /* La B10 e' quella in uso: la seconda si apre solo con la matita, ed e'
     * proprio quella la differenza che si prova qui. */
    window.cdEvApplyCar(0);
  }, DUE_AUTO);
  await page.waitForTimeout(800);
}

async function apriIVeicoli(page) {
  await page.evaluate(() => {
    window.apriConfigEntita();
    window.editorSwitch("sez2");
  });
  await expect(page.locator("#ed-body [data-ev-add-new]")).toBeVisible();
  await page.waitForTimeout(1500);
}

const entita = (page) => page.locator('#ed-body .ed-slot-in[data-ref^="dm.ev_"]').first();
const modulo = (page) => page.locator("#ed-body details.ed-acc.dm-ev-modulo");
const nome = (page) => page.locator("#ed-evcar-name");

test("coi veicoli salvati si vede l'elenco, non le entità", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  await apriIVeicoli(page);
  await expect(page.locator("#ed-body [data-ev-edit]")).toHaveCount(2);
  await expect(modulo(page)).toBeHidden();
  await expect(nome(page)).toBeHidden();
  await expect(page.locator("#ed-body [data-ev-add-new]")).toBeVisible();
});

test("la matita apre le entità di quel veicolo", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  await apriIVeicoli(page);
  await page.locator("#ed-body [data-ev-edit]").nth(1).click();
  await expect(modulo(page)).toBeVisible();
  await expect(nome(page)).toHaveValue("T03");
  await expect(page.locator("#ed-body [data-ev-save-car]")).toBeVisible();
  /* Aprire non e' modificare: cambiando scheda non chiede di salvare. */
  await page.locator('#editor-modal .ed-tab[data-tab="luci"]').click();
  await expect(page.locator("#dm-ricordati-di-salvare")).toHaveCount(0);
  /* E tornando ai veicoli si riparte dall'elenco. */
  await page.locator('#editor-modal .ed-tab[data-tab="sez2"]').click();
  await expect(page.locator("#ed-body [data-ev-add-new]")).toBeVisible();
  await expect(modulo(page)).toBeHidden();
});

test("＋ Nuovo veicolo apre le entità, vuote", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  await apriIVeicoli(page);
  await page.locator("#ed-body [data-ev-add-new]").click();
  await expect(modulo(page)).toBeVisible();
  await expect(nome(page)).toBeVisible();
  await expect(nome(page)).toHaveValue("");
  await expect(entita(page)).toHaveValue("");
});

test("senza nessun veicolo il modulo è aperto da subito", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  await page.evaluate(() => localStorage.setItem("cd_ev_cars", "[]"));
  await apriIVeicoli(page);
  await expect(nome(page)).toBeVisible();
});
