/* I balconi stanno all'aperto (#251).
 *
 * Sul documento vero: due stanze di casa e due balconi, con le persone in
 * casa. Il balcone a 6 gradi e al 79% fa dire all'assistente «è fredda» e
 * «arieggia», e nella tessera Temperatura della Home tira giu' la media.
 *
 * In Config › Stanze, la matita del balcone ha la casella «All'aperto»: spunta,
 * salva, e l'assistente tace sul balcone, la media torna quella della casa,
 * l'elenco delle stanze lo dice accanto al nome e la pagina Temperature lo
 * mette in fondo, sotto il suo separatore, con la card neutra.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const STANZE = [
  {
    id: "soggiorno",
    name: "Soggiorno",
    icon: "🛋️",
    floor: "Piano terra",
    temp: "sensor.soggiorno_temperature",
    hum: "sensor.soggiorno_humidity",
  },
  {
    id: "balcone-sud",
    name: "Balcone sud",
    icon: "🌿",
    floor: "Piano terra",
    temp: "sensor.balcone_sud_temperature",
    hum: "sensor.balcone_sud_humidity",
  },
  {
    id: "camera",
    name: "Camera",
    icon: "🛏️",
    floor: "Primo piano",
    temp: "sensor.camera_temperature",
    hum: "sensor.camera_humidity",
  },
  {
    id: "balcone-nord",
    name: "Balcone nord",
    icon: "🌿",
    floor: "Primo piano",
    temp: "sensor.balcone_nord_temperature",
    hum: "sensor.balcone_nord_humidity",
  },
];

const LETTURE = {
  soggiorno: [20.6, 48],
  balcone_sud: [6.8, 74],
  camera: [19.4, 52],
  balcone_nord: [5.9, 79],
};

const PERSONE = [
  { id: "persona-1", name: "Persona 1", entity: "person.persona_1" },
  { id: "persona-2", name: "Persona 2", entity: "person.persona_2" },
];

const SEME = {
  schema_version: 4,
  sections: {
    rooms: STANZE,
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
  visibility: { home: true, temp: true },
};

async function avvia(page, testInfo, { balconiFuori = false } = {}) {
  test.setTimeout(180_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true, null, {
    timeout: 60_000,
  });
  await page.evaluate(
    ({ stanze, letture, persone, balconiFuori: fuori }) => {
      const salvate = stanze.map((stanza) =>
        fuori && stanza.id.startsWith("balcone") ? { ...stanza, outdoor: true } : stanza,
      );
      window.localStorage.setItem("cd_stanze", JSON.stringify(salvate));
      window.localStorage.setItem("cd_floors", JSON.stringify(["Piano terra", "Primo piano"]));
      window.localStorage.setItem("cd_people", JSON.stringify(persone));
      const stati = window.eval("_RAW_STATES");
      const unOraFa = new Date(Date.now() - 3600_000).toISOString();
      for (const p of persone)
        stati[p.entity] = {
          entity_id: p.entity,
          state: "home",
          last_changed: unOraFa,
          attributes: { friendly_name: p.name },
        };
      for (const [chi, [gradi, umidita]] of Object.entries(letture)) {
        stati[`sensor.${chi}_temperature`] = {
          entity_id: `sensor.${chi}_temperature`,
          state: String(gradi),
          attributes: { unit_of_measurement: "°C", device_class: "temperature" },
        };
        stati[`sensor.${chi}_humidity`] = {
          entity_id: `sensor.${chi}_humidity`,
          state: String(umidita),
          attributes: { unit_of_measurement: "%", device_class: "humidity" },
        };
      }
      window.applyStates?.();
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
      window.renderHomeWidgets?.();
    },
    { stanze: STANZE, letture: LETTURE, persone: PERSONE, balconiFuori },
  );
  await expect(page.locator("#dm-people .dm-person-card")).toHaveCount(2);
}

const assistente = (page) => page.locator("#dm-people .dm-assistente");
const tessera = (page) => page.locator('.dm-tile[data-dm-widget="temperatura"]').first();

/* I suggerimenti dell'assistente, letti dall'elenco completo. */
async function suggerimenti(page) {
  await assistente(page).locator('[data-ass-fa="apri"]').first().click();
  const foglio = page.locator("#dm-ass-velo .dm-ass-foglio");
  await expect(foglio).toBeVisible();
  const righe = await foglio.locator(".dm-ass-riga").allInnerTexts();
  await page.keyboard.press("Escape");
  await expect(page.locator("#dm-ass-velo")).toHaveCount(0);
  return righe.join("\n");
}

async function apriLeStanze(page) {
  await page.evaluate(() => {
    window.apriConfigEntita?.();
    window.editorSwitch?.("stanze");
  });
  await expect(page.locator("#dm-piani-pannello")).toBeVisible({ timeout: 20_000 });
}

test("la spunta «All'aperto» zittisce l'assistente sul balcone e lo toglie dalla media", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);

  /* Prima: il balcone e' «una stanza fredda e umida», e la media lo conta. */
  await expect(assistente(page).locator(".dm-ass-conto")).toBeVisible({ timeout: 20_000 });
  const prima = await suggerimenti(page);
  expect(prima).toMatch(/Balcone (sud|nord) è fredda/);
  expect(prima).toMatch(/Balcone (sud|nord): umidità al/);
  /* (20,6 + 6,8 + 19,4 + 5,9) / 4 = 13,2 */
  await expect(tessera(page)).toContainText("13,2", { timeout: 20_000 });

  /* La matita di ciascun balcone, la casella, salva. */
  await apriLeStanze(page);
  for (const nome of ["Balcone sud", "Balcone nord"]) {
    const indice = await page.evaluate(
      (cercato) =>
        JSON.parse(localStorage.getItem("cd_stanze")).findIndex((s) => s.name === cercato),
      nome,
    );
    await page.locator(`[data-dm-edit-kind="room"][data-dm-edit-index="${indice}"]`).click();
    const finestra = page.locator("#dm-room-editor-modal");
    await expect(finestra).toBeVisible();
    const casella = finestra.locator('input[name="outdoor"]');
    /* Spenta di serie: dal nome «Balcone» non si deduce niente. */
    await expect(casella).not.toBeChecked();
    await expect(finestra).toContainText("All'aperto");
    await expect(finestra).toContainText("non entra nella media della casa");
    await casella.check();
    await finestra.locator(".ed-save-btn").click();
    await expect(finestra).toHaveCount(0);
  }

  const salvate = await page.evaluate(() => JSON.parse(localStorage.getItem("cd_stanze")));
  expect(salvate.map((s) => [s.name, s.outdoor === true])).toEqual([
    ["Soggiorno", false],
    ["Balcone sud", true],
    ["Camera", false],
    ["Balcone nord", true],
  ]);
  expect(salvate.find((s) => s.name === "Soggiorno")).not.toHaveProperty("outdoor");

  /* L'elenco delle stanze lo dice accanto al nome, solo sui balconi. */
  await expect(page.locator("#ed-body .dm-stanza-fuori")).toHaveCount(2);
  await expect(
    page.locator("#ed-body .ed-row", { hasText: "Balcone nord" }).locator(".dm-stanza-fuori"),
  ).toHaveText("🌿 All'aperto");
  await expect(
    page.locator("#ed-body .ed-row", { hasText: "Soggiorno" }).locator(".dm-stanza-fuori"),
  ).toHaveCount(0);

  /* L'assistente tace sul balcone, e la media e' quella della casa. */
  await page.evaluate(() => {
    window.chiudiConfigEntita?.();
    document.getElementById("editor-modal")?.classList.remove("open");
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
    window.renderHomeWidgets?.();
  });
  await expect(assistente(page)).toContainText("In casa è tutto in ordine.", { timeout: 20_000 });
  /* (20,6 + 19,4) / 2 = 20,0, umidita' (48 + 52) / 2 = 50 */
  await expect(tessera(page)).toContainText("20,0", { timeout: 20_000 });
  await expect(tessera(page)).toContainText("Umidità 50%");
});

test("la pagina Temperature mette i balconi in fondo, neutri, sotto il loro separatore", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo, { balconiFuori: true });
  /* Gia' salvati all'aperto: dall'avvio l'assistente tace e la media e' di casa. */
  await expect(assistente(page)).toContainText("In casa è tutto in ordine.", { timeout: 20_000 });
  await expect(tessera(page)).toContainText("20,0", { timeout: 20_000 });
  await page.evaluate(() => {
    document.querySelectorAll(".page").forEach((nodo) => nodo.classList.remove("active"));
    document.getElementById("page-temp")?.classList.add("active");
    window.buildTempCards?.();
  });
  const griglia = page.locator("#temp-grid");
  await expect(griglia.locator(".temp-card")).toHaveCount(4, { timeout: 20_000 });

  /* L'ordine: prima la casa, poi il separatore, poi i balconi. */
  const ordine = await griglia.evaluate((nodo) =>
    [...nodo.children].map((figlio) =>
      figlio.matches("[data-dm-temp-fuori-sep]")
        ? "—"
        : figlio.querySelector(".cp-name")?.textContent?.trim(),
    ),
  );
  expect(ordine).toEqual(["Soggiorno", "Camera", "—", "Balcone sud", "Balcone nord"]);
  const separatore = griglia.locator("[data-dm-temp-fuori-sep]");
  await expect(separatore).toContainText("All'aperto");
  await expect(separatore).toContainText("non contano nella media della casa");

  /* Il balcone: cartellino «All'aperto» al posto di Freddo, niente scala. */
  const balcone = griglia.locator('.temp-card[data-room-id="balcone-nord"]');
  await expect(balcone).toHaveAttribute("data-dm-fuori", "true");
  await expect(balcone.locator(".temp-comfort-badge")).toHaveAttribute(
    "data-comfort",
    "all-aperto",
  );
  await expect(balcone.locator(".temp-value")).toHaveText("5.9");
  await expect(balcone.locator(".temp-hum-val")).toHaveText("79%");
  const stile = await balcone.evaluate((nodo) => ({
    bordo: getComputedStyle(nodo).borderTopStyle,
    scala: getComputedStyle(nodo, "::after").display,
  }));
  expect(stile).toEqual({ bordo: "dashed", scala: "none" });
  /* Una nuova lettura non rimette «Freddo» sul balcone. */
  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent("dashboardmodern:state-changed", {
        detail: { entity_ids: ["sensor.balcone_nord_temperature"] },
      }),
    );
    window.buildTempCards?.();
  });
  await expect(balcone.locator(".temp-comfort-badge")).toHaveAttribute(
    "data-comfort",
    "all-aperto",
  );
  /* La stanza di casa resta col suo comfort. */
  await expect(
    griglia.locator('.temp-card[data-room-id="soggiorno"] .temp-comfort-badge'),
  ).toHaveAttribute("data-comfort", "comfort");

  /* Le pastiglie dei filtri seguono le card: i balconi in fondo. */
  const pastiglie = await page
    .locator("#dm-beta16-temperature-tabs [data-room-filter]")
    .evaluateAll((nodi) => nodi.map((nodo) => nodo.dataset.roomFilter));
  expect(pastiglie).toEqual(["all", "soggiorno", "camera", "balcone-sud", "balcone-nord"]);
});
