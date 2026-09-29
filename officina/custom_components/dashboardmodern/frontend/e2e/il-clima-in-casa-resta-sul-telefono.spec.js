import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { clickBottomTab } from "./helpers/navigation.js";

/* «La sezione clima da App si vede solo la prima volta entrando e poi
 * spariscono i widget interni. Solo da Cell» (#168).
 *
 * Una vecchia toppa del beta16 cercava nelle griglie del Clima i titoli delle
 * stanze della scheda `cp-*`, e riconosceva un titolo dal 🏠 nel testo. La
 * scheda di oggi e' `dm-cl-card`, e con la modalita' «In casa» — TADO HOME —
 * il 🏠 ce l'ha nella pastiglia: la card diventava un titolo, e sotto i 760px
 * i titoli si nascondono. La prima volta si vedeva; al primo tocco nella
 * pagina no, e tornando la griglia non si ridisegnava. */
const seed = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [
      {
        id: "cl-salone",
        type: "clima",
        name: "Salone",
        entity: "climate.salone",
        modo: "select.tado_casa",
      },
      { id: "cl-camera", type: "clima", name: "Camera", entity: "climate.camera" },
    ],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, clima: true },
};

const STATI = [
  {
    entity_id: "climate.salone",
    state: "heat",
    attributes: { friendly_name: "Salone", temperature: 21, current_temperature: 19.5 },
  },
  {
    entity_id: "climate.camera",
    state: "off",
    attributes: { friendly_name: "Camera", temperature: 20, current_temperature: 19.1 },
  },
  {
    entity_id: "select.tado_casa",
    state: "HOME",
    attributes: { friendly_name: "Tado", options: ["HOME", "AWAY"] },
  },
];

test("la card «In casa» resta una card, e si vede anche la seconda volta", async ({
  page,
}, testInfo) => {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
  await page.evaluate((haStati) => {
    window.dmCallHaService = () => Promise.resolve();
    haStati.forEach((voce) => {
      _RAW_STATES[voce.entity_id] = structuredClone(voce);
      STATES[voce.entity_id] = structuredClone(voce);
    });
  }, STATI);
  await clickBottomTab(page, "clima", testInfo);
  const salone = page.locator("#card-climate-salone");
  await expect(salone).toBeVisible();
  await expect(salone.locator("[data-dm-cl-modo]")).toHaveText(/In casa/);

  /* Un tocco qualunque nella pagina: e' quello che faceva partire la toppa. */
  await page.locator("#page-clima").click({ position: { x: 5, y: 5 } });
  await page.waitForTimeout(400);
  await clickBottomTab(page, "home", testInfo);
  await clickBottomTab(page, "clima", testInfo);

  await expect(salone).toBeVisible();
  await expect(page.locator("#card-climate-camera")).toBeVisible();
  await expect(salone).not.toHaveClass(/dm-beta16-climate-group-heading/);
});
