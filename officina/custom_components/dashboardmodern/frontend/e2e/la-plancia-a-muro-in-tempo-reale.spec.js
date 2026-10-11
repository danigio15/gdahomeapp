/* La plancia a muro in tempo reale.
 *
 * «Devi vedere gia' il cambio stato entita': se clicco per spegnere la luce in
 * casa si spegne istantaneamente, ma sulla wall il cambio stato non e'
 * immediato.» Il tablet prende le luci da un'altra plancia, e nella
 * configurazione sua quelle luci non ci sono: il cancello degli stati le
 * buttava, e la card cambiava solo al battito, ogni quindici secondi. Qui lo
 * stato arriva dalla stessa porta di Home Assistant (`broker.ingestState`) e
 * la card deve cambiare ben prima. */
import { expect, test } from "@playwright/test";
import { STATI_A_MURO, apriLaCasaAMuro } from "./helpers/casa-a-muro.js";

const muro = (page) => page.locator("#dm-muro");

/* La plancia da cui il tablet legge: una stanza con una luce che nella
 * configurazione di questa plancia non c'e'. */
const FONTE = {
  dm_dashboard_state: JSON.stringify({
    schema_version: 4,
    sections: {
      rooms: [{ id: "studio", name: "Studio" }],
      lights: [{ id: "s1", name: "Lampada studio", entity: "light.studio", room_id: "studio" }],
    },
  }),
  cd_quick_actions: "[]",
};

const STATI = {
  ...STATI_A_MURO,
  "light.studio": {
    state: "on",
    attributes: { friendly_name: "Lampada studio", supported_color_modes: ["onoff"] },
  },
};

const MURO = { attiva: true, pagine: [{ id: "p1", modello: "stanza", stanza: "Studio" }] };

test.describe("la plancia a muro in tempo reale", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript((fonte) => {
      window.__DM_MURO_FONTE__ = fonte;
    }, FONTE);
  });

  test("la luce spenta da un'altra parte si spegne subito anche sul tablet", async ({
    page,
  }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, { muro: MURO, stati: STATI });
    const card = muro(page).locator('[data-mu-entita="light.studio"].mu-card');
    await expect(card).toHaveClass(/mu-accesa/);

    const passata = await page.evaluate(() => {
      const broker = window.DashboardModernEnergyService?.broker;
      if (!broker?.__dmStateEventGate) return false;
      broker.ingestState({
        entity_id: "light.studio",
        state: "off",
        attributes: { friendly_name: "Lampada studio", supported_color_modes: ["onoff"] },
      });
      return true;
    });
    expect(passata, "il broker col cancello c'e'").toBe(true);
    /* Il battito e' ogni quindici secondi: un secondo e mezzo basta solo se
     * lo stato passa davvero dal cancello. */
    await expect(card).not.toHaveClass(/mu-accesa/, { timeout: 1500 });
  });

  test("il tocco sul tablet cambia la card prima che Home Assistant risponda", async ({
    page,
  }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, { muro: MURO, stati: STATI });
    const card = muro(page).locator('[data-mu-entita="light.studio"].mu-card');
    await expect(card).toHaveClass(/mu-accesa/);
    /* Home Assistant qui non risponde mai: lo stato vero resta «on». */
    await muro(page).locator('[data-mu-fa="interruttore"][data-mu-entita="light.studio"]').click();
    await expect(card).not.toHaveClass(/mu-accesa/, { timeout: 500 });
    await expect
      .poll(() => page.evaluate(() => window.__SERVIZI__.map((s) => `${s.domain}.${s.service}`)))
      .toEqual(["light.toggle"]);
    /* E se non risponde davvero, dopo l'attesa torna quello vero. */
    await expect(card).toHaveClass(/mu-accesa/, { timeout: 6000 });
  });
});
