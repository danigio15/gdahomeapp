/* La telecamera aperta resta la telecamera quando una luce cambia.
 *
 * «Se clicco su apertura telecamera, dopo un po' compaiono le luci, ma sopra
 * c'è ancora la camera.» La finestra dei dettagli e' una sola e la riusano in
 * tanti: la telecamera, la gestione luci, gli avvisi, gli elettrodomestici.
 * Il ridisegno delle luci partiva a ogni cambio di stato di una luce e
 * controllava soltanto che la finestra fosse aperta, non che fosse la sua: con
 * la telecamera davanti, al primo faretto acceso in casa il corpo diventava
 * l'elenco delle luci, sotto il titolo «📹 Ingresso», e il video restava acceso
 * dietro, senza piu' un posto dove mostrarsi.
 */
import { expect, test } from "@playwright/test";
import { apri, nellaCasaDemo } from "./helpers/casa-demo.js";

async function apriLaTelecamera(page, { sopra = false } = {}) {
  await apri(page, "security");
  const tessera = page.locator("#page-security .dm-cam[data-dm-cam]").first();
  await expect(tessera).toBeVisible();
  /* Con un'altra finestra gia' aperta la tessera non si tocca: la telecamera
     la apre chi la apre da sopra (l'assistente, la stanza, il campanello),
     con la stessa `apriCamera`. */
  if (sopra)
    await tessera.evaluate((nodo) => window.apriCamera(nodo.dataset.dmCam, nodo.dataset.dmTitle));
  else await tessera.click();
  await expect(page.locator("#details-modal")).toHaveClass(/\bshow\b/);
  await expect(page.locator("#details-title")).toContainText("📹");
}

/* Una luce di casa cambia come cambierebbe davvero: qualcun altro in casa la
 * accende, da un filo suo verso la casa finta, e alla plancia arriva soltanto
 * il `state_changed`. */
async function unaLuceCambia(page, entita) {
  const prima = await page.evaluate((id) => window.__CASA_IN_PAGINA__.entita.get(id).state, entita);
  await page.evaluate(
    (id) =>
      new Promise((fatto) => {
        const presa = new WebSocket("ws://casa-demo/api/websocket");
        let mandato = false;
        presa.onmessage = (m) => {
          const detto = JSON.parse(m.data);
          if (!mandato && (detto.type === "auth_required" || detto.type === "auth_ok")) {
            mandato = true;
            presa.send(JSON.stringify({ type: "auth", access_token: "x" }));
            presa.send(
              JSON.stringify({
                id: 9001,
                type: "call_service",
                domain: "light",
                service: "toggle",
                target: { entity_id: id },
              }),
            );
          }
          if (detto.id === 9001) fatto();
        };
      }),
    entita,
  );
  await expect
    .poll(() => page.evaluate((id) => eval("_RAW_STATES")[id]?.state, entita))
    .not.toBe(prima);
  /* In Home Assistant lo stesso `state_changed` arriva anche alla presa del
   * servizio dell'energia, che e' quella che annuncia alle sezioni il
   * `dashboardmodern:state-changed` (passando dal cancello degli eventi). La
   * casa finta a quella presa non risponde — la plancia ospitata non ha un
   * gettone da darle — quindi qui lo stato nuovo glielo si porta a mano, per
   * la stessa porta. */
  await page.evaluate((id) => {
    const nuovo = window.__CASA_IN_PAGINA__.entita.get(id);
    window.DashboardModernEnergyService.broker.ingestState(nuovo);
  }, entita);
  /* Il ridisegno delle luci passa da un cambio di stato (il mazzetto parte
     dopo mezzo secondo) e dal battito del guscio, ogni due secondi: si lascia
     il tempo a tutti e due. */
  await page.waitForTimeout(3000);
}

test("una luce che cambia non riempie la finestra della telecamera", async ({ page }) => {
  test.setTimeout(120_000);
  await nellaCasaDemo(page);
  await apriLaTelecamera(page);
  const titolo = await page.locator("#details-title").textContent();

  await unaLuceCambia(page, "light.camera_plafoniera");
  await unaLuceCambia(page, "light.cucina_led");

  const corpo = page.locator("#details-list");
  await expect(corpo.locator("[data-dm-light]")).toHaveCount(0);
  await expect(corpo.locator(".dm-lightx-bar, .lgx-bar")).toHaveCount(0);
  await expect(page.locator("#details-title")).toHaveText(titolo);
  await expect(page.locator("#details-modal")).toHaveClass(/\bshow\b/);
});

test("le luci aperte dopo la telecamera prendono titolo e corpo, e fermano il video", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await nellaCasaDemo(page);
  await apriLaTelecamera(page);
  await expect
    .poll(() => page.evaluate(() => Boolean(eval("_dmCurrentCam"))), { timeout: 10_000 })
    .toBe(true);

  /* Le luci si aprono sopra la telecamera, come da un tocco. */
  await page.evaluate(() => window.apriGestioneLuci(true));
  await expect(page.locator("#details-title")).toContainText("💡");
  await expect(page.locator("#details-list [data-dm-light]").first()).toBeVisible();
  /* La telecamera non resta a girare dietro un corpo che non e' piu' suo. */
  expect(await page.evaluate(() => eval("_dmCurrentCam"))).toBeNull();

  /* E da qui in poi le luci seguono le luci. */
  await unaLuceCambia(page, "light.camera_plafoniera");
  await expect(page.locator("#details-title")).toContainText("💡");
  await expect(page.locator("#details-list [data-dm-light]").first()).toBeVisible();
});

test("la telecamera riaperta sopra le luci si riprende il corpo", async ({ page }) => {
  test.setTimeout(120_000);
  await nellaCasaDemo(page);
  await page.evaluate(() => window.apriGestioneLuci(true));
  await expect(page.locator("#details-list [data-dm-light]").first()).toBeVisible();
  await apriLaTelecamera(page, { sopra: true });
  await unaLuceCambia(page, "light.studio_scrivania");
  await expect(page.locator("#details-list [data-dm-light]")).toHaveCount(0);
  await expect(page.locator("#details-title")).toContainText("📹");
});

test("la risposta di una telecamera arrivata tardi non scrive sulle luci", async ({ page }) => {
  test.setTimeout(120_000);
  await nellaCasaDemo(page);
  /* Ogni strada del motore risponde dopo un secondo e mezzo e scrive nel corpo
     che le e' stato dato, come fanno l'HLS e l'MJPEG dopo la loro firma. */
  await page.evaluate(() => {
    const tardi = async (...argomenti) => {
      const corpo = argomenti.find((a) => a && typeof a === "object" && "innerHTML" in a);
      await new Promise((ok) => setTimeout(ok, 1500));
      corpo.innerHTML = '<div id="arrivata-tardi">video</div>';
    };
    for (const nome of ["dmCamWebRTC", "dmCamHLS", "dmCamMJPEG", "dmCamPolling"])
      window[nome] = tardi;
  });
  await apriLaTelecamera(page);
  /* Prima che la strada risponda, le luci prendono la finestra. */
  await page.evaluate(() => window.apriGestioneLuci(true));
  await expect(page.locator("#details-title")).toContainText("💡");
  await page.waitForTimeout(3500);
  await expect(page.locator("#details-list #arrivata-tardi")).toHaveCount(0);
  await expect(page.locator("#details-list [data-dm-light]").first()).toBeVisible();
  await expect(page.locator("#details-title")).toContainText("💡");
});
