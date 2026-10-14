/* Le telecamere nell'app non restano nere.
 *
 * «Nell'app le telecamere sono tutte nere, a casa e fuori.» Nell'app la
 * plancia e' ospitata (niente gettone: i cookie del servitore bastano) e ogni
 * fotogramma passa dal filo, dal ponte e dal Supervisor: secondi, non decimi.
 * Intanto la casa parla, la Home si ridisegna a ogni cambio di stato, e ogni
 * ridisegno chiedeva di nuovo tutte le telecamere con un indirizzo nuovo —
 * che interrompe quello di prima. Nessuna foto arrivava mai in fondo.
 *
 * Qui la casa e' lenta come dall'app (un secondo e mezzo per fotogramma) e
 * chiacchierona (un cambio di stato ogni trecento millisecondi): le foto
 * devono arrivare, e le domande restare poche.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [
      { id: "cam1", name: "Cancello", entity: "camera.cancello" },
      { id: "cam2", name: "Cortile", entity: "camera.cortile" },
    ],
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

/* Un GIF di un pixel: nessuno dentro. */
const FOTO = Buffer.from("R0lGODlhAQABAIAAAP///wAAACwAAAAAAQABAAACAkQBADs=", "base64");

/* La plancia nell'app, con la finestra delle telecamere aperta e la casa che
 * parla: un cambio di stato ogni trecento millisecondi, per sei secondi.
 * `rispondi` decide cosa dice la casa a ogni fotogramma, dopo un secondo e
 * mezzo. Torna le domande arrivate durante la chiacchiera. */
async function chiacchieraConLaFinestraAperta(page, testInfo, rispondi) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  const domande = [];
  await page.route("**/api/camera_proxy/**", async (route) => {
    domande.push(route.request().url());
    await new Promise((fatto) => setTimeout(fatto, 1500));
    await route.fulfill(rispondi(route.request())).catch(() => {});
  });
  /* La plancia ospitata, come nell'app: il gettone e' il segnale «bastano i
   * cookie». Va messo prima che la plancia parta, al posto di quello finto
   * che semina l'aiutante. */
  await page.addInitScript(() => {
    const scrivi = Storage.prototype.setItem;
    Storage.prototype.setItem = function soloOspitata(chiave, valore) {
      if (String(chiave).endsWith("_cd_connection"))
        valore = JSON.stringify({ token: "__dashboardmodern_hosted__" });
      return scrivi.call(this, chiave, valore);
    };
  });
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate(() => {
    const stati = eval("_RAW_STATES");
    for (const entity of ["camera.cancello", "camera.cortile"])
      stati[entity] = {
        entity_id: entity,
        state: "idle",
        attributes: { entity_picture: `/api/camera_proxy/${entity}?token=abc` },
      };
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  });
  await page.waitForTimeout(800);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.locator('#dm-widgets .dm-tile[data-dm-widget="telecamere"]').click();
  await expect(page.locator("#dm-widget-popup [data-dm-w-cam] img").first()).toBeAttached();
  domande.length = 0;

  const fino = Date.now() + 6000;
  while (Date.now() < fino) {
    await page.evaluate((n) => {
      const stati = eval("_RAW_STATES");
      stati["sensor.potenza_casa"] = {
        entity_id: "sensor.potenza_casa",
        state: String(n),
        attributes: {},
      };
      window.dispatchEvent(
        new CustomEvent("dashboardmodern:state-changed", {
          detail: { entity_ids: ["sensor.potenza_casa"] },
        }),
      );
    }, Date.now());
    await page.waitForTimeout(300);
  }
  return domande;
}

test("dall'app, con la casa lenta e chiacchierona, le foto arrivano", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const domande = await chiacchieraConLaFinestraAperta(page, testInfo, (richiesta) =>
    /* Il servitore non ha nessun Bearer da guardare: chi lo manda sbaglia. */
    richiesta.headers().authorization
      ? { status: 401, body: "401" }
      : { contentType: "image/gif", body: FOTO },
  );

  const immagini = page.locator("#dm-widget-popup [data-dm-w-cam] img");
  const quante = await immagini.count();
  expect(quante).toBeGreaterThanOrEqual(2);
  for (let i = 0; i < quante; i += 1)
    await expect(immagini.nth(i)).toHaveAttribute("data-dm-camera-state", "ready");
  const larghezze = await immagini.evaluateAll((tutte) => tutte.map((img) => img.naturalWidth));
  expect(
    larghezze.every((larga) => larga > 0),
    JSON.stringify(larghezze),
  ).toBe(true);

  /* Venti ridisegni in sei secondi; per due telecamere bastano poche domande
   * (una per foto in viaggio, e il giro dei dieci secondi). Prima erano una
   * per telecamera a ogni ridisegno. */
  expect(domande.length, domande.join("\n")).toBeLessThanOrEqual(6);
});

test("una telecamera che la casa nega resta negata, e non si richiede a ogni ridisegno", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  /* Il no del ponte, come lo gira il servitore: niente immagine. */
  const domande = await chiacchieraConLaFinestraAperta(page, testInfo, () => ({
    status: 403,
    contentType: "text/plain",
    body: "le telecamere si mostrano solo a chi e' entrato in casa",
  }));

  const immagini = page.locator("#dm-widget-popup [data-dm-w-cam] img");
  const stati = await immagini.evaluateAll((tutte) =>
    tutte.map((img) => [img.dataset.dmCameraState, img.naturalWidth]),
  );
  for (const [stato, larga] of stati) {
    expect(stato).not.toBe("ready");
    expect(larga).toBe(0);
  }
  /* Un tentativo ogni due secondi al piu', per telecamera — non uno per
   * ridisegno, che sarebbero una quarantina. */
  expect(domande.length, domande.join("\n")).toBeLessThanOrEqual(10);
});
