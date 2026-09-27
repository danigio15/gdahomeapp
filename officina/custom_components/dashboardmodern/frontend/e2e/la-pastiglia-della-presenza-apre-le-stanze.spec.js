/* «Con le "presenze" attive, sulla home sotto il meteo, la riga che fa vedere
 *  le cose in casa accese, ecc.... su "2 stanze occupate" se ci premo non mi
 *  apre niente, rispetto a luci o varchi ecc.»
 *
 * Era esatto. Le pastiglie che contano si portano dietro l'elenco di quello che
 * contano — le due luci accese, i due varchi aperti — e toccandole si apre
 * quello. Questa no: le stanze occupate sono NOMI di posti e non entita', e
 * l'elenco si costruiva solo da righe con un'entita' dentro. Restava vuoto, e
 * il tocco ripiegava sulla tessera della Presenza: chi quella tessera l'aveva
 * nascosta dalla Home non apriva niente.
 *
 * Qui si guarda col browser vero quello che le prove del nucleo non possono
 * vedere: che la finestra si apra davvero, e che dentro ci siano le due stanze.
 * Senza il tasto «spegni» — una stanza non si spegne — e la riga sotto il
 * titolo non lo promette.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

/* Una sezione configurata ci vuole: una plancia vuota non disegna la Home, e
 * senza Home non c'e' nessuna riga sotto il meteo. I rilevatori invece non si
 * configurano — li dichiara Home Assistant con la loro `device_class`. */
const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [{ id: "l1", name: "Lampada", entity: "light.lampada" }],
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

/* Un rilevatore non si dichiara: lo dichiara Home Assistant con la sua
 * `device_class`, ed e' per questo che chi ne ha uno se lo ritrova senza
 * configurare niente. Due accesi e uno spento: le stanze occupate sono due. */
const RILEVATORI = [
  { entity: "binary_sensor.salone_movimento", nome: "Salone", classe: "motion", stato: "on" },
  { entity: "binary_sensor.studio_presenza", nome: "Studio", classe: "occupancy", stato: "on" },
  { entity: "binary_sensor.bagno_movimento", nome: "Bagno", classe: "motion", stato: "off" },
];

async function avvia(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate((rilevatori) => {
    const stati = eval("_RAW_STATES");
    stati["light.lampada"] = {
      entity_id: "light.lampada",
      state: "off",
      attributes: { friendly_name: "Lampada" },
    };
    for (const uno of rilevatori)
      stati[uno.entity] = {
        entity_id: uno.entity,
        state: uno.stato,
        attributes: { friendly_name: uno.nome, device_class: uno.classe },
        last_changed: new Date(Date.now() - 60_000).toISOString(),
      };
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, RILEVATORI);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await expect(page.locator('#dm-casa-riga [data-dm-casa="presenza"]')).toBeVisible();
}

test("la pastiglia delle stanze occupate apre l'elenco delle stanze", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);

  const pastiglia = page.locator('#dm-casa-riga [data-dm-casa="presenza"]');
  await expect(pastiglia.locator(".dm-casa-testa")).toHaveText("2");
  await pastiglia.click();

  const elenco = page.locator("#dm-casa-popup");
  await expect(elenco).toBeVisible();
  await expect(elenco.locator(".dm-casa-voce")).toHaveCount(2);
  const testo = (await elenco.locator(".dm-casa-voce").allTextContents()).join(" | ");
  expect(testo).toContain("Salone");
  expect(testo).toContain("Studio");
  /* Il terzo e' spento: in un elenco di stanze occupate non ci sta. */
  expect(testo).not.toContain("Bagno");
});

test("le stanze non hanno il tasto che non serve, e la riga sotto non lo promette", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  await page.locator('#dm-casa-riga [data-dm-casa="presenza"]').click();

  const elenco = page.locator("#dm-casa-popup");
  await expect(elenco).toBeVisible();
  /* Una stanza non si spegne: il tasto non c'e'. */
  await expect(elenco.locator(".dm-casa-spegni")).toHaveCount(0);
  /* E chi legge non lo va a cercare, perche' la riga sotto il titolo dice cos'e'
     questo elenco invece di invitare a un gesto che non esiste. */
  const sotto = await elenco.locator("[data-dm-casa-sotto]").textContent();
  expect(sotto).toContain("stanze");
  expect(sotto).not.toContain("spegnere");
  /* Il titolo e' la frase che si e' toccata: chi ha premuto «2 stanze occupate»
     la ritrova in cima, o non sa di aver aperto lei. */
  const titolo = await elenco.locator("[data-dm-casa-titolo]").textContent();
  expect(titolo?.toLowerCase()).toContain("stanze occupate");
});
