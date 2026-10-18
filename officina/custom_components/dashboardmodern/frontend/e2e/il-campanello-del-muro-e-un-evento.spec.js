/* Il campanello del muro e' un evento di Home Assistant.
 *
 * «Ho messo come campanello `event.door_d1b8_campanello_premuto`: quando
 * suonano, sul muro non succede niente.» Un `event.*` ha per stato l'ora
 * dell'ultima pressione, e a ogni squillo quell'ora cambia. Qui lo stato
 * arriva dalla stessa porta da cui arriva in casa (`broker.ingestState`, quella
 * che usano il ponte e l'app), e la pagina Ingresso non e' la prima. */
import { expect, test } from "@playwright/test";
import { MURO_DI_PROVA, STATI_A_MURO, apriLaCasaAMuro } from "./helpers/casa-a-muro.js";

const muro = (page) => page.locator("#dm-muro");
const CAMPANELLO = "event.door_d1b8_campanello_premuto";
const attributi = (tipo) => ({
  event_types: ["pressed", "ring"],
  event_type: tipo,
  device_class: "doorbell",
  friendly_name: "Door D1B8 Campanello premuto",
});

const MURO = {
  ...MURO_DI_PROVA,
  tema: "scuro",
  pagine: MURO_DI_PROVA.pagine.map((p) =>
    p.modello === "ingresso" ? { ...p, ingresso: { ...p.ingresso, campanello: CAMPANELLO } } : p,
  ),
};

/* Lo stato nuovo, come lo consegna Home Assistant: dal broker, col cancello. */
const arriva = (page, id, stato, attributes) =>
  page.evaluate(
    ([id, stato, attributes]) => {
      const broker = window.DashboardModernEnergyService?.broker;
      if (!broker?.__dmStateEventGate) return false;
      broker.ingestState({ entity_id: id, state: stato, attributes });
      return true;
    },
    [id, stato, attributes],
  );

test.describe("il campanello del muro e' un evento", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("un nuovo squillo dell'evento apre il citofono, anche dal riposo", async ({
    page,
  }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, {
      muro: MURO,
      stati: {
        ...STATI_A_MURO,
        [CAMPANELLO]: { state: "2026-10-17T18:02:11.204+00:00", attributes: attributi("pressed") },
      },
    });
    await expect(muro(page).locator(".mu-testa")).toBeVisible();
    await page.evaluate(() => window.dmMuro.riposa());
    await expect(muro(page).locator(".mu-riposo")).toBeVisible();
    /* Il primo sguardo non suona: l'ora vecchia e' solo ricordata. */
    await expect(muro(page).locator(".mu-squillo")).toHaveCount(0);

    expect(await arriva(page, CAMPANELLO, "2026-10-18T09:15:42.871+00:00", attributi("ring"))).toBe(
      true,
    );
    const squillo = muro(page).locator(".mu-squillo");
    await expect(squillo).toContainText("Suona il campanello", { timeout: 3000 });
    await expect(squillo).toHaveClass(/squilla/);
    await expect(muro(page).locator('[data-mu-pagina="2"]')).toHaveAttribute(
      "aria-selected",
      "true",
    );
    if (process.env.CAMPANELLO_RENDER)
      await page.screenshot({ path: `${process.env.CAMPANELLO_RENDER}/muro-squillo-evento.png` });
  });

  test("un evento che parte da «unknown» suona alla prima pressione", async ({
    page,
  }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, {
      muro: MURO,
      stati: { ...STATI_A_MURO, [CAMPANELLO]: { state: "unknown", attributes: attributi("") } },
    });
    await expect(muro(page).locator(".mu-testa")).toBeVisible();
    await arriva(page, CAMPANELLO, "2026-10-18T09:15:42.871+00:00", attributi("pressed"));
    await expect(muro(page).locator(".mu-squillo")).toContainText("Suona il campanello", {
      timeout: 3000,
    });
  });

  /* Un sensore che si accende, dalla stessa porta: anche lui passava solo se
   * qualcuno lo stava disegnando. */
  test("un binary_sensor che si accende suona anche lui", async ({ page }, testInfo) => {
    const sensore = "binary_sensor.citofono_suona";
    await apriLaCasaAMuro(page, testInfo, {
      muro: {
        ...MURO,
        pagine: MURO.pagine.map((p) =>
          p.modello === "ingresso" ? { ...p, ingresso: { ...p.ingresso, campanello: sensore } } : p,
        ),
      },
      stati: { ...STATI_A_MURO, [sensore]: { state: "off", attributes: {} } },
    });
    await expect(muro(page).locator(".mu-testa")).toBeVisible();
    await arriva(page, sensore, "on", {});
    await expect(muro(page).locator(".mu-squillo")).toContainText("Suona il campanello", {
      timeout: 3000,
    });
  });

  test("l'evento che torna da «unavailable» con la stessa ora non suona", async ({
    page,
  }, testInfo) => {
    const ora = "2026-10-17T18:02:11.204+00:00";
    await apriLaCasaAMuro(page, testInfo, {
      muro: MURO,
      stati: { ...STATI_A_MURO, [CAMPANELLO]: { state: ora, attributes: attributi("pressed") } },
    });
    await expect(muro(page).locator(".mu-testa")).toBeVisible();
    await arriva(page, CAMPANELLO, "unavailable", attributi("pressed"));
    await page.waitForTimeout(700);
    await arriva(page, CAMPANELLO, ora, attributi("pressed"));
    await page.waitForTimeout(1200);
    await expect(muro(page).locator(".mu-squillo")).toHaveCount(0);
  });
});

/* «Cosa si aspetta di entita'?» Il config lo dice sotto il campo, e la
 * ricerca propone per primo il campanello vero. */
test.describe("il campanello si sceglie nel config", () => {
  const STATI_DEL_CONFIG = {
    ...STATI_A_MURO,
    [CAMPANELLO]: { state: "2026-10-17T18:02:11.204+00:00", attributes: attributi("pressed") },
    "event.telecomando_tasto": {
      state: "unknown",
      attributes: { event_types: ["press"], device_class: "button", friendly_name: "Telecomando" },
    },
    "sensor.citofono_wifi": {
      state: "-61",
      attributes: { friendly_name: "Citofono wifi", unit_of_measurement: "dBm" },
    },
  };

  test("la riga dice quali entita' vanno e la ricerca propone il campanello", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.emulateMedia({ colorScheme: "dark" });
    await apriLaCasaAMuro(page, testInfo, { muro: MURO_DI_PROVA, stati: STATI_DEL_CONFIG });
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark";
      window.apriConfigEntita();
    });
    await page.locator('.ed-tab[data-tab="muro"]').click();
    const body = page.locator("#ed-body");
    await expect(body.locator(".mu-ed")).toBeVisible();
    await body.locator('[data-mu-ed-apri="2"]').click();
    const riga = body.locator("[data-mu-ed-campanello]");
    await expect(riga.locator("[data-mu-ed-campanello-aiuto]")).toContainText(
      "Un evento del citofono (event.*), o un sensore che si accende quando suona (binary_sensor)",
    );
    await expect(riga.locator("[data-mu-ed-campanello-avviso]")).toHaveCount(0);

    await riga.locator("[data-mu-ed-pick]").click();
    await expect(page.locator("#cd-entpick")).toBeVisible();
    await expect(page.locator("#cd-ep-list .dm-ep-row").first()).toHaveAttribute(
      "data-entity",
      CAMPANELLO,
    );
    if (process.env.CAMPANELLO_RENDER)
      await page.screenshot({
        path: `${process.env.CAMPANELLO_RENDER}/config-campanello-ricerca.png`,
      });
    await page.locator("#cd-ep-list .dm-ep-row").first().click();
    const campo = body.locator('[data-mu-ed-campo="pagine.2.ingresso.campanello"]');
    await expect(campo).toHaveValue(CAMPANELLO);
    await body.locator("[data-dm-save-all]").click();
    const salvato = await page.evaluate(() => JSON.parse(localStorage.getItem("cd_muro")));
    expect(salvato.pagine[2].ingresso.campanello).toBe(CAMPANELLO);
    if (process.env.CAMPANELLO_RENDER) {
      await riga.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${process.env.CAMPANELLO_RENDER}/config-campanello.png` });
    }
  });

  test("un'entita' che non sa fare da campanello lo dice", async ({ page }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, {
      muro: {
        ...MURO_DI_PROVA,
        pagine: MURO_DI_PROVA.pagine.map((p) =>
          p.modello === "ingresso"
            ? { ...p, ingresso: { ...p.ingresso, campanello: "sensor.citofono_wifi" } }
            : p,
        ),
      },
      stati: STATI_DEL_CONFIG,
    });
    await page.evaluate(() => window.apriConfigEntita());
    await page.locator('.ed-tab[data-tab="muro"]').click();
    const body = page.locator("#ed-body");
    await body.locator('[data-mu-ed-apri="2"]').click();
    await expect(body.locator("[data-mu-ed-campanello-avviso]")).toContainText(
      "non può fare da campanello",
    );
  });
});
