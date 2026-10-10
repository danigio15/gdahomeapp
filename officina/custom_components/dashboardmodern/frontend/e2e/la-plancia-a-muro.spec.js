/* La plancia a muro, nel browser.
 *
 * «Crea una plancia prettamente per dispositivi a muro: minimal, con comandi
 * ben precisi», e poi: «per Base non deve funzionare». Qui si prova quello che
 * il tablet fa davvero: con Premium il pannello copre la plancia, con Base no;
 * i tasti mandano i servizi giusti; le linguette cambiano pagina; il riposo si
 * sveglia col tocco; l'antifurto chiede il codice; per uscire, con il blocco,
 * serve il PIN; in verticale la griglia diventa di due colonne. */
import { expect, test } from "@playwright/test";
import { MURO_DI_PROVA, STATI_A_MURO, apriLaCasaAMuro } from "./helpers/casa-a-muro.js";

const muro = (page) => page.locator("#dm-muro");
const servizi = (page) => page.evaluate(() => window.__SERVIZI__.slice());

test.describe("la plancia a muro", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("con Base il pannello non c'e' e la plancia resta quella di sempre", async ({
    page,
  }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, { premium: false, muro: MURO_DI_PROVA });
    await page.waitForTimeout(800);
    await expect(muro(page)).toHaveCount(0);
  });

  test("con Premium il pannello copre la plancia, e i tasti comandano", async ({
    page,
  }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, { muro: MURO_DI_PROVA });
    await expect(muro(page)).toBeVisible();
    await expect(muro(page).locator(".mu-tit")).toHaveText(/Soggiorno/i);
    /* La stanza propone da sola le sue luci, il clima e la tapparella. */
    await expect(muro(page).locator('[data-mu-entita="light.soggiorno"].mu-card')).toBeVisible();
    await expect(muro(page).locator('[data-mu-entita="climate.soggiorno"].mu-card')).toBeVisible();
    await expect(muro(page).locator('[data-mu-entita="cover.soggiorno"].mu-card')).toBeVisible();

    await muro(page).locator('[data-mu-fa="interruttore"][data-mu-entita="light.tavolo"]').click();
    await muro(page).locator('[data-mu-fa="su"][data-mu-entita="cover.soggiorno"]').click();
    await muro(page).locator('[data-mu-fa="piu"][data-mu-entita="climate.soggiorno"]').click();
    await expect(muro(page).locator('[data-mu-entita="climate.soggiorno"] .mu-grande')).toHaveText(
      "22°",
    );
    await expect
      .poll(async () => (await servizi(page)).map((s) => `${s.domain}.${s.service}`))
      .toEqual(["light.toggle", "cover.open_cover", "climate.set_temperature"]);
    expect((await servizi(page))[2].data).toEqual({
      entity_id: "climate.soggiorno",
      temperature: 22,
    });
  });

  test("le linguette cambiano pagina, e la scena parte con un tocco", async ({
    page,
  }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, { muro: MURO_DI_PROVA });
    await muro(page).locator('[data-mu-pagina="1"]').click();
    await expect(muro(page).locator(".mu-tit")).toHaveText(/Scene/i);
    await muro(page).locator('[data-mu-azione="Cinema"]').click();
    await expect(muro(page).locator('[data-mu-azione="Cinema"] .mu-pasti')).toBeVisible();
    expect(await servizi(page)).toEqual([
      { domain: "scene", service: "turn_on", data: { entity_id: "scene.cinema" } },
    ]);
  });

  test("l'antifurto chiede il codice prima di inserire", async ({ page }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, { muro: MURO_DI_PROVA });
    await muro(page).locator('[data-mu-pagina="2"]').click();
    await expect(muro(page).locator(".mu-stato-allarme")).toHaveText(/Spento/i);
    await expect(muro(page).locator(".mu-avviso-finestre")).toContainText("Finestra cucina");
    await muro(page).locator('[data-mu-fa="allarme"][data-mu-modo="away"]').click();
    await expect(muro(page).locator(".mu-fin-codice")).toBeVisible();
    expect(await servizi(page)).toEqual([]);
    for (const k of ["1", "2", "3", "4", "✓"])
      await muro(page).locator(`[data-mu-cifra="${k}"]`).click();
    await expect(muro(page).locator(".mu-fin-codice")).toHaveCount(0);
    expect(await servizi(page)).toEqual([
      {
        domain: "alarm_control_panel",
        service: "alarm_arm_away",
        data: { entity_id: "alarm_control_panel.casa", code: "1234" },
      },
    ]);
  });

  test("il riposo mostra l'orologio e il tocco sveglia", async ({ page }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, { muro: MURO_DI_PROVA });
    await muro(page).locator('[data-mu-pagina="1"]').click();
    await page.evaluate(() => window.dmMuro.riposa());
    await expect(muro(page).locator(".mu-orologione")).toBeVisible();
    await muro(page).locator(".mu-riposo").click();
    await expect(muro(page).locator(".mu-orologione")).toHaveCount(0);
    /* Dal riposo si torna alla prima pagina, quella di casa per il tablet. */
    await expect(muro(page).locator(".mu-tit")).toHaveText(/Soggiorno/i);
    expect(await servizi(page)).toEqual([]);
  });

  test("col blocco, per uscire dal pannello serve il PIN", async ({ page }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, {
      muro: { ...MURO_DI_PROVA, blocco: { attivo: true, pin: "2468" } },
    });
    const orologio = muro(page).locator("[data-mu-orologio]");
    const box = await orologio.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(2300);
    await page.mouse.up();
    await expect(muro(page).locator(".mu-fin-codice")).toBeVisible();
    for (const k of ["1", "1", "1", "1", "✓"])
      await muro(page).locator(`[data-mu-cifra="${k}"]`).click();
    await expect(muro(page).locator(".mu-fin-codice")).toContainText(/sbagliato/i);
    for (const k of ["2", "4", "6", "8", "✓"])
      await muro(page).locator(`[data-mu-cifra="${k}"]`).click();
    await expect(muro(page)).toHaveCount(0);
  });

  test("in verticale la griglia ha due colonne e riempie lo schermo", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 800, height: 1280 });
    await apriLaCasaAMuro(page, testInfo, { muro: MURO_DI_PROVA });
    await expect(muro(page)).toHaveAttribute("data-verso", "verticale");
    const colonne = await muro(page)
      .locator(".mu-g6")
      .evaluate((g) => getComputedStyle(g).gridTemplateColumns.split(" ").length);
    expect(colonne).toBe(2);
    const fondo = await muro(page)
      .locator(".mu-g6")
      .evaluate((g) => g.getBoundingClientRect().bottom);
    expect(fondo).toBeGreaterThan(1180);
    expect(fondo).toBeLessThanOrEqual(1280);
  });

  test("su un NSPanel la forma e' compatta: la luce si accende col tocco, la finestra si apre tenendo", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 480, height: 480 });
    await apriLaCasaAMuro(page, testInfo, { muro: MURO_DI_PROVA });
    await expect(muro(page)).toHaveAttribute("data-compatto", "1");
    await expect(muro(page).locator(".mu-pillole")).toBeHidden();
    const tavolo = muro(page).locator('[data-mu-card][data-mu-entita="light.tavolo"]');
    await tavolo.click();
    expect(await servizi(page)).toEqual([
      { domain: "light", service: "toggle", data: { entity_id: "light.tavolo" } },
    ]);
    const box = await tavolo.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(900);
    await page.mouse.up();
    await expect(muro(page).locator(".mu-fin-luce")).toBeVisible();
    expect((await servizi(page)).length).toBe(1);
    /* Le scritte restano leggibili: il nome della luce non scende sotto i
     * quindici pixel veri. */
    const corpo = await tavolo.locator(".mu-n").evaluate((n) => {
      const zoom = Number(getComputedStyle(n.closest(".mu-tela")).zoom) || 1;
      return parseFloat(getComputedStyle(n).fontSize) * zoom;
    });
    expect(corpo).toBeGreaterThanOrEqual(15);
    /* Il dito si e' alzato sulla finestra, non sulla card: il tocco dopo la
     * pressione lunga non va perso, e il clima si apre al primo tocco. */
    await muro(page).locator('[data-mu-fa="chiudi"]').first().click();
    await muro(page).locator('[data-mu-card][data-mu-entita="climate.soggiorno"]').click();
    await expect(muro(page).locator(".mu-fin-clima")).toBeVisible();
  });

  test("pagine scelte a mano: qualunque entita' col suo nome, e il clima che scalda ha la fiamma", async ({
    page,
  }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, {
      stati: {
        ...STATI_A_MURO,
        "switch.presa_tv": { state: "off", attributes: { friendly_name: "Presa TV" } },
      },
      muro: {
        attiva: true,
        pagine: [
          {
            id: "p1",
            modello: "personale",
            titolo: "Ingresso mio",
            comandi: [
              { tipo: "entita", entita: "lock.porta", nome: "Portone", disegno: "varchi" },
              { tipo: "vuoto" },
              { tipo: "entita", entita: "switch.presa_tv" },
            ],
          },
          { id: "p2", modello: "caldo" },
        ],
      },
    });
    await expect(muro(page).locator(".mu-tit")).toHaveText(/Ingresso mio/i);
    const portone = muro(page).locator('[data-mu-fa="entita"][data-mu-entita="lock.porta"]');
    await expect(portone).toContainText("Portone");
    /* Il secondo posto e' rimasto libero apposta. */
    await expect(muro(page).locator(".mu-g6 > *").nth(1)).toHaveClass(/mu-vuoto/);
    await portone.click();
    await muro(page).locator('[data-mu-fa="entita"][data-mu-entita="switch.presa_tv"]').click();
    expect(await servizi(page)).toEqual([
      { domain: "lock", service: "unlock", data: { entity_id: "lock.porta" } },
      { domain: "homeassistant", service: "toggle", data: { entity_id: "switch.presa_tv" } },
    ]);
    /* La pagina del caldo: il clima messo nel caldo (un termostato, nella
     * scheda Clima) ci sta, e porta la fiamma. */
    await page.evaluate(async () => {
      localStorage.setItem(
        "cd_clima_units",
        JSON.stringify([{ entity: "climate.soggiorno", type: "termo", name: "Clima" }]),
      );
      await window.dmMuro.rileggi({ forza: true });
    });
    await muro(page).locator('[data-mu-pagina="1"]').click();
    await expect(
      muro(page).locator('[data-mu-card][data-mu-entita="climate.soggiorno"]'),
    ).toHaveAttribute("data-mu-lato", "caldo");
  });

  test("l'orologio tenuto apre solo il config del tablet, e chiuso torna il pannello", async ({
    page,
  }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, { muro: MURO_DI_PROVA });
    await expect(muro(page)).toBeVisible();
    const orologio = muro(page).locator("[data-mu-orologio]");
    const box = await orologio.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(2300);
    await page.mouse.up();
    /* Solo la scheda «A muro»: la colonna delle altre schede non si vede. */
    await expect(page.locator("#editor-modal")).toBeVisible();
    await expect(page.locator("#ed-body .mu-ed")).toBeVisible();
    await expect(page.locator("#editor-modal .ed-tabs")).toBeHidden();
    await expect(muro(page)).toHaveCount(0);
    /* Chiuso il config, il pannello torna: la plancia classica non si vede. */
    await page.locator("#editor-modal .ed-head-close").last().click();
    await expect(muro(page)).toBeVisible();
    await expect(page.locator("#editor-modal")).toHaveCount(0);
  });

  test("le pagine si cambiano solo dalle linguette, e il clima ha caldo e freddo dentro", async ({
    page,
  }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, {
      muro: {
        attiva: true,
        pagine: [
          { id: "p1", modello: "luci" },
          { id: "p2", modello: "clima" },
        ],
      },
    });
    /* Uno swipe non cambia pagina. */
    await page.mouse.move(1000, 450);
    await page.mouse.down();
    await page.mouse.move(250, 460, { steps: 12 });
    await page.mouse.up();
    await expect(muro(page).locator(".mu-tit")).toHaveText(/Luci/i);
    await muro(page).locator('[data-mu-pagina="1"]').click();
    await expect(muro(page).locator(".mu-tit")).toHaveText(/Clima/i);
    await expect(muro(page).locator('[data-mu-zona="freddo"]')).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(
      muro(page).locator('[data-mu-card][data-mu-entita="climate.soggiorno"]'),
    ).toBeVisible();
    await muro(page).locator('[data-mu-zona="caldo"]').click();
    await expect(muro(page).locator('[data-mu-zona="caldo"]')).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("il config aperto col pannello sopra (dal menu dell'app) toglie il pannello subito", async ({
    page,
  }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, { muro: MURO_DI_PROVA });
    await expect(muro(page)).toBeVisible();
    await page.evaluate(() => window.apriConfigEntita());
    await expect(muro(page)).toHaveCount(0, { timeout: 1500 });
    await expect(page.locator("#editor-modal")).toBeVisible();
    /* E chiuso, il pannello torna. */
    await page.evaluate(() => document.getElementById("editor-modal").remove());
    await expect(muro(page)).toBeVisible();
  });
});
