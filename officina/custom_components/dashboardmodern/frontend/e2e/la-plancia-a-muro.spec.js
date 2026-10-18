/* La plancia a muro, nel browser.
 *
 * «Crea una plancia prettamente per dispositivi a muro: minimal, con comandi
 * ben precisi», e poi: «per Base non deve funzionare». Qui si prova quello che
 * il tablet fa davvero: con Premium il pannello copre la plancia, con Base no;
 * i tasti mandano i servizi giusti; le linguette cambiano pagina; il riposo si
 * sveglia col tocco; l'antifurto chiede il codice; per uscire, con il blocco,
 * serve il PIN; in verticale la griglia diventa di due colonne. */
import { expect, test } from "@playwright/test";
import {
  MURO_DELLA_REGIA,
  MURO_DI_PROVA,
  SEME_A_MURO,
  STATI_A_MURO,
  STATI_DELLA_REGIA,
  apriLaCasaAMuro,
} from "./helpers/casa-a-muro.js";

const muro = (page) => page.locator("#dm-muro");
const servizi = (page) => page.evaluate(() => window.__SERVIZI__.slice());
/* Quanto c'e' fra il disegno del meteo, in alto, e il numero accanto. */
const distanzaDalNumero = (page) =>
  muro(page)
    .locator(".mu-meteo")
    .evaluate((m) => {
      const disegno = m.querySelector(".mu-meteo-su > :first-child").getBoundingClientRect();
      const numero = m.querySelector("b").getBoundingClientRect();
      return numero.left - disegno.right;
    });

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
    await expect(muro(page).locator(".mu-stato-allarme")).toHaveText(/Disattivo/i);
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

  /* «Stato e modalita' antifurto deve seguire quelle della plancia.» Il
   * pannello mostrava tutti gli inserimenti che la centrale dichiara coi nomi
   * suoi, e come «Aperte» ogni sensore con la classe finestra — anche i
   * «Stato finestra» dei termosifoni. Adesso legge la configurazione della
   * plancia: i tasti tolti, quelli scritti a mano, gli ingressi dichiarati. */
  test("l'antifurto segue i tasti e gli ingressi della plancia", async ({ page }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, {
      muro: MURO_DI_PROVA,
      stati: {
        ...STATI_A_MURO,
        "binary_sensor.termosifone_finestra": {
          state: "on",
          attributes: { friendly_name: "Termosifone Stato finestra", device_class: "window" },
        },
        "switch.giardino": { state: "off", attributes: { friendly_name: "Giardino" } },
      },
      caselle: {
        cd_antifurto_modi: ["night"],
        cd_antifurto_su_misura: [{ id: "giardino", nome: "Giardino", entita: "switch.giardino" }],
        cd_centrali: [
          {
            id: "casa",
            nome: "Casa",
            caselle: { "dm.security_centrale_allarme": "alarm_control_panel.casa" },
            ingressi: ["binary_sensor.finestra_cucina"],
          },
        ],
      },
    });
    await muro(page).locator('[data-mu-pagina="2"]').click();
    const tasti = muro(page).locator('.mu-modi [data-mu-fa="allarme"]');
    await expect(tasti).toHaveText(["Casa", "Fuori", "Sblocca", "Giardino"]);
    await expect(muro(page).locator('.mu-modi [data-mu-modo="disarm"]')).toHaveClass(/si/);
    const aperte = muro(page).locator(".mu-avviso-finestre");
    await expect(aperte).toContainText("Finestra cucina");
    await expect(aperte).not.toContainText("Termosifone");
    await muro(page).locator('[data-mu-fa="allarme"][data-mu-modo="giardino"]').click();
    await expect
      .poll(() => servizi(page))
      .toEqual([{ domain: "switch", service: "turn_on", data: { entity_id: "switch.giardino" } }]);
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

  /* «Orario e le altre info si muovono nello schermo per non restare sempre
   * allo stesso punto.» Due minuti diversi, due posti diversi; e passando
   * davanti si legge chi c'e' e cosa e' rimasto aperto. */
  test("il riposo si sposta ogni minuto e dice chi c'e' e cosa e' aperto", async ({
    page,
  }, testInfo) => {
    await page.clock.install({ time: new Date("2026-10-10T21:40:10") });
    await apriLaCasaAMuro(page, testInfo, { muro: MURO_DI_PROVA });
    await page.evaluate(() => window.dmMuro.riposa());
    const blocco = muro(page).locator(".mu-deriva");
    await expect(blocco).toBeVisible();
    await expect(blocco.locator('[data-mu-riposo="persone"]')).toHaveText(/Anna · Marco/);
    await expect(blocco.locator('[data-mu-riposo="aperte"]')).toHaveText(/1 finestra aperta/);
    const dove = () => blocco.evaluate((n) => n.getAttribute("style"));
    const prima = await dove();
    await page.clock.runFor(4000);
    await page.screenshot({ path: testInfo.outputPath("riposo-1.png") });
    await page.clock.runFor(60_000);
    await expect.poll(dove).not.toBe(prima);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: testInfo.outputPath("riposo-2.png") });
    /* Il blocco resta dentro lo schermo. */
    const box = await blocco.boundingBox();
    const vista = page.viewportSize();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(vista.width);
    expect(box.y + box.height).toBeLessThanOrEqual(vista.height);
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

  /* «Se uno volesse andare nella config generale, lo deve fare col pc su
   * un'altra plancia?» No: «Tutto il config» toglie il recinto. */
  /* Dentro l'app le barre di Android e la luminosita' le comanda l'app: il
   * pannello le dice se c'e' e se e' notte, e solo quando cambia. */
  test("nell'app il pannello chiede lo schermo intero, e di notte lo spegne", async ({
    page,
  }, testInfo) => {
    await page.addInitScript(() => {
      window.__SCHERMO__ = [];
      window.gdahomeSchermo = { postMessage: (m) => window.__SCHERMO__.push(m) };
    });
    await apriLaCasaAMuro(page, testInfo, {
      muro: { ...MURO_DI_PROVA, notte: { attiva: true, da: "00:00", a: "23:59" } },
    });
    const detti = () => page.evaluate(() => window.__SCHERMO__.slice());
    await expect.poll(detti).toContain("muro:si");
    await page.evaluate(() => window.dmMuro.riposa());
    await expect.poll(detti).toContain("spento:si");
    await muro(page).locator(".mu-riposo").click();
    await expect.poll(detti).toContain("spento:no");
    const tutti = await detti();
    expect(tutti.filter((d) => d === "muro:si")).toHaveLength(1);
  });

  test("dal config del tablet si passa a tutto il config", async ({ page }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, { muro: MURO_DI_PROVA });
    await page.evaluate(() => window.dmMuro.configDelMuro?.());
    await expect(page.locator("#editor-modal .ed-tabs")).toBeHidden();
    const tutto = page.locator("#editor-modal [data-mu-tutto-il-config]");
    await expect(tutto).toBeVisible();
    await tutto.click();
    await expect(page.locator("#editor-modal .ed-tabs")).toBeVisible();
    await expect(tutto).toHaveCount(0);
  });

  /* «Nel pannello da muro, nella sezione clima, mi dai la possibilità di
   * scegliere i Comandi Rapidi del clima.» Il ⏻ diventa la pastiglia del
   * comando rapido di quella stanza: da spento lo accende coi passi della
   * plancia — modalita', gradi, ventola — e da acceso spegne. */
  test("sul clima il ⏻ accende col comando rapido della plancia, e rispegne", async ({
    page,
  }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, {
      muro: { attiva: true, pagine: [{ id: "p1", modello: "clima" }] },
      stati: {
        ...STATI_A_MURO,
        "climate.soggiorno": {
          ...STATI_A_MURO["climate.soggiorno"],
          state: "off",
          attributes: { ...STATI_A_MURO["climate.soggiorno"].attributes, hvac_action: "off" },
        },
      },
      caselle: {
        cd_clima_rapido_unita: {
          "climate.soggiorno": { mode: "cool", temperature: 24, fan: "low" },
        },
      },
    });
    const pastiglia = muro(page).locator('.mu-rapido[data-mu-entita="climate.soggiorno"]');
    await expect(pastiglia).toContainText("24°");
    if (process.env.DM_FOTO)
      await page.screenshot({ path: `${process.env.DM_FOTO}/fatta-muro-clima-spento.png` });
    await expect(pastiglia).toContainText("bassa");
    await pastiglia.click();
    await expect
      .poll(
        async () => (await servizi(page)).map((s) => `${s.service}:${JSON.stringify(s.data)}`),
        {
          timeout: 5000,
        },
      )
      .toEqual([
        'set_hvac_mode:{"entity_id":"climate.soggiorno","hvac_mode":"cool"}',
        'set_temperature:{"entity_id":"climate.soggiorno","temperature":24}',
        'set_fan_mode:{"entity_id":"climate.soggiorno","fan_mode":"low"}',
      ]);
    if (process.env.DM_FOTO)
      await page.screenshot({ path: `${process.env.DM_FOTO}/fatta-muro-clima.png` });
  });

  /* «Se metto i comandi clima non funziona bene come la pagina.» In una pagina
   * Personale non c'e' la linguetta Caldo/Freddo, e il comando rapido
   * ripiegava sul freddo: un termostato spento si accendeva a raffrescare.
   * Fuori dalla pagina Clima la zona la dice l'unita'. */
  test("in una pagina Personale il termostato si accende a scaldare, come nella pagina Clima", async ({
    page,
  }, testInfo) => {
    const seme = JSON.parse(JSON.stringify(SEME_A_MURO));
    seme.sections.climate[0].type = "termo";
    await apriLaCasaAMuro(page, testInfo, {
      seme,
      muro: {
        attiva: true,
        pagine: [
          {
            id: "p1",
            modello: "personale",
            comandi: [{ tipo: "clima", entita: "climate.soggiorno" }],
          },
        ],
      },
      stati: {
        ...STATI_A_MURO,
        "climate.soggiorno": {
          ...STATI_A_MURO["climate.soggiorno"],
          state: "off",
          attributes: { ...STATI_A_MURO["climate.soggiorno"].attributes, hvac_action: "off" },
        },
      },
    });
    const pastiglia = muro(page).locator('.mu-rapido[data-mu-entita="climate.soggiorno"]');
    await expect(pastiglia).toContainText(/Caldo/i);
    await pastiglia.click();
    await expect
      .poll(async () => (await servizi(page))[0]?.data?.hvac_mode, { timeout: 5000 })
      .toBe("heat");
  });

  /* «Il tasto di accensione no, a parte che scrive freddo ed invece sono
   * caldo.» Un riscaldamento messo in casa come clima qualunque: non e'
   * dichiarato termostato, ma i suoi modi dicono che non raffresca. Il tasto
   * propone il caldo e accende col caldo. */
  test("un riscaldamento che non raffresca si accende col caldo anche senza essere dichiarato termostato", async ({
    page,
  }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, {
      muro: {
        attiva: true,
        pagine: [
          {
            id: "p1",
            modello: "personale",
            comandi: [{ tipo: "clima", entita: "climate.soggiorno" }],
          },
        ],
      },
      stati: {
        ...STATI_A_MURO,
        "climate.soggiorno": {
          state: "off",
          attributes: {
            ...STATI_A_MURO["climate.soggiorno"].attributes,
            hvac_action: "off",
            hvac_modes: ["off", "heat"],
          },
        },
      },
    });
    const pastiglia = muro(page).locator('.mu-rapido[data-mu-entita="climate.soggiorno"]');
    await expect(pastiglia).toContainText(/Caldo/i);
    await pastiglia.click();
    await expect
      .poll(async () => (await servizi(page))[0]?.data?.hvac_mode, { timeout: 5000 })
      .toBe("heat");
  });

  /* Il cambio di stato come lo manda la plancia: lo stato nuovo, e l'evento. */
  const cambia = (page, id, valore) =>
    page.evaluate(
      ([id, valore]) => {
        eval("_RAW_STATES")[id] = { entity_id: id, state: valore, attributes: {} };
        window.dispatchEvent(
          new CustomEvent("dashboardmodern:state-changed", { detail: { entity_ids: [id] } }),
        );
      },
      [id, valore],
    );

  /* «Il cancello sembra una tapparella.» Un cancello ha il suo riquadro: il
   * suo stato in parole giuste e un tasto solo, che apre se e' chiuso. */
  test("un cancello ha il suo riquadro, e il tasto grande lo apre", async ({ page }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, {
      muro: {
        attiva: true,
        pagine: [
          {
            id: "p1",
            modello: "personale",
            comandi: [{ tipo: "tapparella", entita: "cover.cancello" }],
          },
        ],
      },
      stati: {
        ...STATI_A_MURO,
        "cover.cancello": {
          state: "closed",
          attributes: { friendly_name: "Cancello", device_class: "gate" },
        },
      },
    });
    const carta = muro(page).locator('.mu-varco[data-mu-entita="cover.cancello"]');
    await expect(carta).toContainText("Chiuso");
    await carta.locator(".mu-varco-tasto").click();
    await expect
      .poll(async () => (await servizi(page)).map((s) => s.service), { timeout: 5000 })
      .toEqual(["open_cover"]);
  });

  /* «Quando suona il campanello il pannello si sveglia e mostra la
   * telecamera.» Anche dal riposo, e sulla pagina Ingresso giusta. */
  test("il campanello sveglia il pannello e apre il citofono", async ({ page }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, {
      muro: {
        ...MURO_DI_PROVA,
        pagine: MURO_DI_PROVA.pagine.map((p) =>
          p.modello === "ingresso"
            ? { ...p, ingresso: { ...p.ingresso, campanello: "binary_sensor.campanello" } }
            : p,
        ),
      },
      stati: { ...STATI_A_MURO, "binary_sensor.campanello": { state: "off", attributes: {} } },
    });
    await expect(muro(page).locator(".mu-testa")).toBeVisible();
    /* Il canale dello schermo dell'app, per finta: si annota quello che dice. */
    await page.evaluate(() => {
      window.__SCHERMO__ = [];
      window.gdahomeSchermo = { postMessage: (detto) => window.__SCHERMO__.push(detto) };
      window.dmMuro.riposa();
    });
    await expect(muro(page).locator(".mu-riposo")).toBeVisible();
    await cambia(page, "binary_sensor.campanello", "on");
    /* Come una chiamata: a tutto schermo, col video e i tasti. */
    const squillo = muro(page).locator(".mu-squillo");
    await expect(squillo).toContainText("Suona il campanello");
    await expect(squillo).toHaveClass(/squilla/);
    await expect(squillo.locator('[data-mu-telecamera="camera.cancello"]')).toHaveCount(1);
    await expect(squillo).toContainText(/Squilla da 0:0\d/);
    await expect(squillo.locator('[data-mu-fa="citofono-silenzia"]')).toBeVisible();
    /* «Parla» si accende a mano: di serie non c'e'. */
    await expect(squillo.locator('[data-mu-fa="citofono-parla"]')).toHaveCount(0);
    await expect(muro(page).locator('[data-mu-pagina="2"]')).toHaveAttribute(
      "aria-selected",
      "true",
    );
    /* L'app ha saputo: lo schermo resta acceso, e lo squillo l'ha svegliato. */
    const detto = await page.evaluate(() => window.__SCHERMO__.slice());
    expect(detto).toContain("acceso:si");
    expect(detto).toContain("sveglia");
    /* «Silenzia»: lo squillo finisce, la finestra dice quando ha suonato e
     * tiene «Apri» e «Chiudi». */
    await squillo.locator('[data-mu-fa="citofono-silenzia"]').click();
    await expect(squillo).toContainText("Ha suonato alle");
    await expect(squillo).not.toHaveClass(/squilla/);
    await expect(squillo.locator('[data-mu-fa="citofono-silenzia"]')).toHaveCount(0);
    await expect(squillo.locator(".mu-sq-squillo")).toHaveCount(1);
    await squillo.locator('[data-mu-fa="apri"][data-mu-entita="button.apri_cancello"]').click();
    await expect
      .poll(() => servizi(page))
      .toEqual([
        { domain: "button", service: "press", data: { entity_id: "button.apri_cancello" } },
      ]);
    await squillo.locator('[data-mu-fa="chiudi"]').click();
    await expect(muro(page).locator(".mu-squillo")).toHaveCount(0);
  });

  /* «Allagamento, fumo, allarme a tutto schermo con un tasto Ho visto.» */
  test("un avviso che si accende prende tutto lo schermo finche' si tocca Ho visto", async ({
    page,
  }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, {
      muro: MURO_DI_PROVA,
      stati: { ...STATI_A_MURO, "binary_sensor.acqua": { state: "off", attributes: {} } },
      caselle: {
        cd_avvisi_custom: [
          { name: "Allagamento in lavanderia", entity: "binary_sensor.acqua", cond: "on" },
        ],
      },
    });
    const grande = muro(page).locator(".mu-avviso-grande");
    await expect(muro(page).locator(".mu-testa")).toBeVisible();
    await expect(grande).toHaveCount(0);
    await page.evaluate(() => window.dmMuro.riposa());
    await cambia(page, "binary_sensor.acqua", "on");
    await expect(grande).toContainText("Allagamento in lavanderia");
    await grande.locator('[data-mu-fa="avviso-visto"]').click();
    await expect(grande).toHaveCount(0);
    /* Spento e riacceso, torna a farsi vedere. */
    await cambia(page, "binary_sensor.acqua", "off");
    await cambia(page, "binary_sensor.acqua", "on");
    await expect(grande).toHaveCount(1);
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
    /* Senza termostati a coppia la terza linguetta non c'e'. */
    await expect(muro(page).locator('[data-mu-zona="termostato"]')).toHaveCount(0);
  });

  /* «Il termostato di Home Assistant mi vede le due mezze lune, da una parte
   * caldo e dall'altra freddo»: i termostati a coppia (`target_temp_low` e
   * `target_temp_high`, senza `temperature`) sul muro scrivevano «—», e il
   * meno e il piu' mandavano `temperature`, che Home Assistant a loro
   * rifiuta. Ora stanno in una terza linguetta, «Termostato», e non in Caldo
   * o in Freddo: la card ha due righe — «Caldo 22°» e «Freddo 26°» — ognuna
   * col suo meno e il suo piu', che mandano sempre la coppia intera. Un clima
   * a obiettivo solo, accanto, resta com'era. */
  test("un termostato a coppia sta nella linguetta Termostato, con un meno e un piu' per numero", async ({
    page,
  }, testInfo) => {
    const seme = structuredClone(SEME_A_MURO);
    seme.sections.climate.push({
      id: "c2",
      name: "Termostato",
      entity: "climate.termostato",
      type: "pompa",
      room_id: "soggiorno",
      room: "Soggiorno",
    });
    await apriLaCasaAMuro(page, testInfo, {
      seme,
      muro: { attiva: true, pagine: [{ id: "p1", modello: "clima", zona: "caldo" }] },
      stati: {
        ...STATI_A_MURO,
        "climate.soggiorno": {
          ...STATI_A_MURO["climate.soggiorno"],
          attributes: { ...STATI_A_MURO["climate.soggiorno"].attributes },
        },
        "climate.termostato": {
          state: "heat_cool",
          attributes: {
            friendly_name: "Termostato",
            hvac_modes: ["off", "heat", "cool", "heat_cool"],
            hvac_action: "idle",
            current_temperature: 21.4,
            temperature: null,
            target_temp_low: 22,
            target_temp_high: 26,
            min_temp: 4,
            max_temp: 40,
            target_temp_step: 0.5,
          },
        },
      },
    });
    const zona = (z) => muro(page).locator(`[data-mu-zona="${z}"]`);
    const carta = muro(page).locator('.mu-card[data-mu-entita="climate.termostato"]');
    /* Tre linguette, nell'ordine; dal Caldo il termostato non si vede. */
    await expect(muro(page).locator("[data-mu-zona]")).toHaveCount(3);
    expect(
      await muro(page)
        .locator("[data-mu-zona]")
        .evaluateAll((tasti) => tasti.map((t) => t.dataset.muZona)),
    ).toEqual(["freddo", "caldo", "termostato"]);
    await expect(zona("caldo")).toHaveAttribute("aria-selected", "true");
    await expect(carta).toHaveCount(0);
    await zona("freddo").click();
    await expect(carta).toHaveCount(0);
    await expect(muro(page).locator('.mu-card[data-mu-entita="climate.soggiorno"]')).toBeVisible();

    await zona("termostato").click();
    await expect(zona("termostato")).toHaveAttribute("aria-selected", "true");
    await expect(carta).toBeVisible();
    await expect(muro(page).locator('.mu-card[data-mu-entita="climate.soggiorno"]')).toHaveCount(0);
    const caldo = carta.locator('.mu-est[data-mu-estremo="basso"]');
    const freddo = carta.locator('.mu-est[data-mu-estremo="alto"]');
    await expect(caldo.locator(".mu-est-v")).toHaveText("22°");
    await expect(freddo.locator(".mu-est-v")).toHaveText("26°");

    await caldo.locator('[data-mu-fa="piu"]').click();
    await expect(caldo.locator(".mu-est-v")).toHaveText("22,5°");
    await expect.poll(async () => (await servizi(page)).length).toBe(1);
    expect((await servizi(page))[0]).toEqual({
      domain: "climate",
      service: "set_temperature",
      data: { entity_id: "climate.termostato", target_temp_low: 22.5, target_temp_high: 26 },
    });

    /* Il meno del freddo muove il freddo, e il caldo resta quello appena
     * mandato. */
    await freddo.locator('[data-mu-fa="meno"]').click();
    await expect(freddo.locator(".mu-est-v")).toHaveText("25,5°");
    await expect.poll(async () => (await servizi(page)).length).toBe(2);
    expect((await servizi(page))[1].data).toEqual({
      entity_id: "climate.termostato",
      target_temp_low: 22.5,
      target_temp_high: 25.5,
    });

    /* Nella finestra le stesse due righe, grandi, coi loro tasti. */
    await carta.locator(".mu-nome").click();
    const finestra = muro(page).locator(".mu-fin-clima");
    await expect(finestra.locator(".mu-est")).toHaveCount(2);
    await finestra.locator('.mu-est[data-mu-estremo="basso"] [data-mu-fa="meno"]').click();
    await expect.poll(async () => (await servizi(page)).length).toBe(3);
    expect((await servizi(page))[2].data).toEqual({
      entity_id: "climate.termostato",
      target_temp_low: 22,
      target_temp_high: 25.5,
    });
    await finestra.locator('[data-mu-fa="chiudi"]').first().click();

    /* Il clima a obiettivo solo, nella linguetta Freddo, manda `temperature`
     * come sempre. */
    await zona("freddo").click();
    await muro(page)
      .locator('.mu-card[data-mu-entita="climate.soggiorno"] [data-mu-fa="piu"]')
      .click();
    await expect.poll(async () => (await servizi(page)).length).toBe(4);
    expect((await servizi(page))[3].data).toEqual({
      entity_id: "climate.soggiorno",
      temperature: 22,
    });
  });

  test("nella pagina Luci una presa ha la stessa card delle luci, e si comanda", async ({
    page,
  }, testInfo) => {
    const seme = structuredClone(SEME_A_MURO);
    seme.sections.lights.push({
      id: "l4",
      name: "Faretti cucina",
      entity: "switch.faretti_cucina",
      room_id: "cucina",
      room: "Cucina",
    });
    await apriLaCasaAMuro(page, testInfo, {
      seme,
      stati: {
        ...STATI_A_MURO,
        "switch.faretti_cucina": { state: "on", attributes: { friendly_name: "Faretti cucina" } },
      },
      muro: { attiva: true, pagine: [{ id: "p1", modello: "luci" }] },
    });
    const presa = muro(page).locator('.mu-card[data-mu-entita="switch.faretti_cucina"]');
    await expect(presa).toBeVisible();
    /* La stessa card della luce: il disco, il nome, lo stato e l'interruttore. */
    await expect(presa.locator(".mu-disco")).toHaveCount(1);
    await expect(presa.locator(".mu-stato")).toHaveText(/Accesa/i);
    await page.screenshot({ path: testInfo.outputPath("luci-a-muro.png") });
    await presa.locator('[data-mu-fa="interruttore"]').click();
    await presa.click({ position: { x: 40, y: 120 } });
    await expect
      .poll(() => servizi(page).then((s) => s.map((x) => `${x.domain}.${x.service}`)))
      .toEqual(["switch.toggle", "switch.toggle"]);
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

  /* «Metti l'hamburger in alto come la dashboard main: in Home Assistant apre
   * la barra laterale, nell'app il menu di gdahome.» E poi, dal campo:
   * «hamburger ancora non va: quando clicco si e' aperta la navbar». Il ☰
   * premeva quello della plancia, che col chiosco fa uscire la barra in basso.
   * Adesso il menu lo si chiede direttamente a chi lo ha. */
  const spiaDellApp = (page) =>
    page.evaluate(() => {
      window.__DETTO__ = [];
      window.gdahomeDice = { postMessage: (m) => window.__DETTO__.push(m) };
      window.__BARRA__ = 0;
      document.querySelector("body>header .ha-menu-btn").onclick = () => (window.__BARRA__ += 1);
    });

  test("nell'app il ☰ apre il menu di GdAHome, non la barra", async ({ page }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, { muro: MURO_DI_PROVA });
    await spiaDellApp(page);
    await muro(page).locator('[data-mu-fa="menu"]').click();
    await expect.poll(() => page.evaluate(() => window.__DETTO__)).toEqual(["gdahome:menu"]);
    expect(await page.evaluate(() => window.__BARRA__)).toBe(0);
  });

  test("dentro Home Assistant il ☰ apre il suo menu laterale", async ({ page }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, { muro: MURO_DI_PROVA });
    await page.evaluate(() => {
      window.__CASSETTO__ = 0;
      window.__BARRA__ = 0;
      const ha = document.createElement("home-assistant");
      ha.addEventListener("hass-toggle-menu", () => (window.__CASSETTO__ += 1));
      document.body.appendChild(ha);
      document.querySelector("body>header .ha-menu-btn").onclick = () => (window.__BARRA__ += 1);
    });
    await muro(page).locator('[data-mu-fa="menu"]').click();
    await expect.poll(() => page.evaluate(() => window.__CASSETTO__)).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.__BARRA__)).toBe(0);
  });

  /* «Su Z Fold aperto premo l'hamburger del pannello e non va.» Largo, Home
   * Assistant tiene la barra laterale di lato: il pannello si scosta e la
   * lascia vedere aperta; un tocco sul pannello lo rimette a tutto schermo. */
  test("Home Assistant largo: il ☰ apre la barra laterale accanto al pannello", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1100, height: 800 });
    await apriLaCasaAMuro(page, testInfo, { muro: MURO_DI_PROVA });
    await page.evaluate(() => {
      window.__APERTO__ = [];
      const ha = document.createElement("home-assistant");
      ha.attachShadow({ mode: "open" });
      const main = document.createElement("home-assistant-main");
      main.attachShadow({ mode: "open" });
      const barra = document.createElement("ha-sidebar");
      barra.style.cssText =
        "position:fixed;left:0;top:0;bottom:0;width:256px;background:#1e293b;z-index:1";
      main.shadowRoot.append(barra);
      ha.shadowRoot.append(main);
      main.addEventListener("hass-toggle-menu", (e) => window.__APERTO__.push(e.detail));
      document.body.appendChild(ha);
    });
    await muro(page).locator('[data-mu-fa="menu"]').click();
    await expect.poll(() => page.evaluate(() => window.__APERTO__)).toEqual([{ open: true }]);
    await expect(muro(page)).toHaveAttribute("data-mu-accanto-al-menu", "true");
    await expect
      .poll(() => muro(page).evaluate((n) => Math.round(n.getBoundingClientRect().left)))
      .toBe(256);
    /* Il pannello non scende sotto la plancia: niente barra in basso. */
    await expect(muro(page)).not.toHaveAttribute("data-mu-sotto-il-menu", "true");
    await expect(page.locator("nav.tabs.bottom-nav-bar")).toBeHidden();
    /* E il pannello si stringe nello spazio che resta, non esce a destra. */
    expect(
      await muro(page).evaluate((n) => Math.round(n.getBoundingClientRect().right - innerWidth)),
    ).toBeLessThanOrEqual(0);
    expect(await muro(page).evaluate((n) => n.scrollWidth - n.clientWidth)).toBeLessThanOrEqual(1);
    if (process.env.DM_FOTO) {
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${process.env.DM_FOTO}/muro-menu-largo.png` });
    }
    /* Un tocco sulla barra non lo rimette; un tocco sul pannello si'. */
    await page.waitForTimeout(400);
    await page.mouse.click(100, 400);
    await expect(muro(page)).toHaveAttribute("data-mu-accanto-al-menu", "true");
    await page.mouse.click(700, 400);
    await expect(muro(page)).not.toHaveAttribute("data-mu-accanto-al-menu", "true");
    await expect
      .poll(() => muro(page).evaluate((n) => Math.round(n.getBoundingClientRect().left)))
      .toBe(0);
  });

  /* «L'icona hamburger non funziona, non si apre il menu laterale»: il menu si
   * apriva, ma sotto il pannello, che sta sopra a tutto. */
  test("il menu aperto dal ☰ si vede sopra il pannello", async ({ page }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, { muro: MURO_DI_PROVA });
    await muro(page).locator('[data-mu-fa="menu"]').click();
    const menu = page.locator("#cd-app-menu");
    await expect(menu).toBeVisible();
    const inCima = () =>
      page.evaluate(() => {
        const sotto = document.elementFromPoint(innerWidth / 2, innerHeight - 30);
        return sotto?.closest?.("#cd-app-menu")
          ? "menu"
          : sotto?.closest?.("#dm-muro")
            ? "muro"
            : "";
      });
    await expect.poll(inCima).toBe("menu");
    /* Chiuso il menu, il primo tocco rimette il pannello sopra. */
    await page.waitForTimeout(400);
    await page.mouse.click(20, 20);
    await expect(menu).toHaveCount(0);
    await expect(muro(page)).not.toHaveAttribute("data-mu-sotto-il-menu", "true");
  });

  /* «Su wall quando premo l'hamburger da telefono aperto si alza la navbar,
   * che sul pannello a muro non deve esserci.» Il pannello scende sotto il
   * menu, e la barra della plancia gli passava davanti. */
  test("col pannello acceso la barra della plancia non si vede, nemmeno dopo il ☰", async ({
    page,
  }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, { muro: MURO_DI_PROVA });
    await page.evaluate(() => {
      document.body.classList.add("cd-nav-fixed", "nav-visible");
      document.querySelector("nav.tabs.bottom-nav-bar")?.classList.add("visible");
    });
    await muro(page).locator('[data-mu-fa="menu"]').click();
    await expect(muro(page)).toHaveAttribute("data-mu-sotto-il-menu", "true");
    await expect(page.locator("nav.tabs.bottom-nav-bar")).toBeHidden();
    await expect(page.locator(".bottom-nav-handle")).toBeHidden();
  });

  test("col blocco il ☰ vuole il PIN", async ({ page }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, {
      muro: { ...MURO_DI_PROVA, blocco: { attivo: true, pin: "2468" } },
    });
    await spiaDellApp(page);
    await muro(page).locator('[data-mu-fa="menu"]').click();
    await expect(muro(page).locator(".mu-fin-codice")).toBeVisible();
    expect(await page.evaluate(() => window.__DETTO__)).toEqual([]);
    for (const k of ["2", "4", "6", "8", "✓"])
      await muro(page).locator(`[data-mu-cifra="${k}"]`).click();
    await expect.poll(() => page.evaluate(() => window.__DETTO__)).toEqual(["gdahome:menu"]);
    /* Il pannello resta: il menu si apre sopra, non si esce dal muro. */
    await expect(muro(page)).toBeVisible();
    await expect(muro(page).locator(".mu-fin-codice")).toHaveCount(0);
  });

  /* «Sul muro le persone non prendono il nome corretto.» Il nome di casa,
   * quello della scheda Persone, e non quello dell'account di Home Assistant:
   * nell'Ingresso, sul riposo, e sulla card di una persona spenta in Home. */
  test("le persone sul muro hanno il nome della scheda Persone", async ({ page }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, {
      muro: {
        ...MURO_DI_PROVA,
        pagine: [
          ...MURO_DI_PROVA.pagine,
          {
            id: "p4",
            modello: "personale",
            comandi: [{ tipo: "entita", entita: "person.luca" }],
          },
        ],
      },
      caselle: {
        cd_people: [
          { entity: "person.anna", name: "Mamma" },
          { entity: "person.marco", name: "Papà" },
          { entity: "person.luca", name: "Zio", nascosta: true },
        ],
      },
    });
    await muro(page).locator('[data-mu-pagina="2"]').click();
    await expect(muro(page).locator('[data-mu-dove="persone"], .mu-piede')).toContainText(
      "Mamma, Papà",
    );
    await muro(page).locator('[data-mu-pagina="3"]').click();
    await expect(muro(page).locator('[data-mu-entita="person.luca"]')).toContainText("Zio");
    await expect(muro(page).locator('[data-mu-entita="person.luca"]')).not.toContainText("Luca");
    await page.evaluate(() => window.dmMuro.riposa());
    await expect(muro(page).locator('[data-mu-riposo="persone"]')).toHaveText(/Mamma · Papà/);
  });

  /* L'assistente di casa (#175) e' sempre vivo anche sul tablet a muro: il
   * riposo dice in una riga la cosa piu' importante da fare, col punto del
   * suo colore. Qui la casa e' vuota e le luci del soggiorno sono accese. */
  test("il riposo dice il consiglio dell'assistente di casa", async ({ page }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, {
      muro: MURO_DI_PROVA,
      stati: {
        ...STATI_A_MURO,
        "person.anna": { state: "not_home", attributes: { friendly_name: "Anna" } },
        "person.marco": { state: "not_home", attributes: { friendly_name: "Marco" } },
      },
    });
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.dmMuro.riposa());
    const consiglio = muro(page).locator('[data-mu-riposo="assistente"]');
    await expect(consiglio).toContainText("Non c'è nessuno in casa", { timeout: 20000 });
    await expect(consiglio).toHaveAttribute("data-urgenza", "oggi");
    /* Spento in Config › Persone, sul riposo non c'e' piu'. */
    await page.evaluate(() => {
      localStorage.setItem("cd_people_accanto", JSON.stringify({ mostra: "niente" }));
      window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
    });
    await expect(consiglio).toHaveCount(0, { timeout: 20000 });
  });

  /* «Nella schermata idle mettere la possibilita' di visualizzare la % di
   * carica della batteria e/o se e' sotto carica o no.» */
  const pilaFinta = (page, livello, inCarica) =>
    page.addInitScript(
      ({ livello, inCarica }) => {
        const ascolti = {};
        const pila = {
          level: livello,
          charging: inCarica,
          addEventListener: (nome, fn) => (ascolti[nome] ||= []).push(fn),
        };
        window.__PILA__ = (l, c) => {
          pila.level = l;
          pila.charging = c;
          for (const fn of [...(ascolti.levelchange || []), ...(ascolti.chargingchange || [])])
            fn();
        };
        Object.defineProperty(Navigator.prototype, "getBattery", {
          configurable: true,
          value: () => Promise.resolve(pila),
        });
      },
      { livello, inCarica },
    );
  const batteria = (page) => muro(page).locator('[data-mu-riposo="batteria"]');

  test("di serie il riposo non dice la batteria", async ({ page }, testInfo) => {
    await pilaFinta(page, 0.8, true);
    await apriLaCasaAMuro(page, testInfo, { muro: MURO_DI_PROVA });
    await page.evaluate(() => window.dmMuro.riposa());
    await expect(muro(page).locator(".mu-orologione")).toBeVisible();
    await expect(batteria(page)).toHaveCount(0);
  });

  test("accesa, la batteria del browser va sul riposo, col fulmine quando carica", async ({
    page,
  }, testInfo) => {
    await pilaFinta(page, 0.82, true);
    await apriLaCasaAMuro(page, testInfo, {
      muro: { ...MURO_DI_PROVA, batteria: { attiva: true } },
    });
    await page.evaluate(() => window.dmMuro.riposa());
    await expect(batteria(page)).toHaveText("82%");
    await expect(batteria(page)).toHaveClass(/carica/);
    await expect(batteria(page).locator(".mu-pila-fulmine")).toHaveCount(1);
    /* Staccata e quasi scarica: niente fulmine, e il colore dell'attenzione. */
    await page.evaluate(() => window.__PILA__(0.15, false));
    await expect(batteria(page)).toHaveText("15%");
    await expect(batteria(page)).toHaveClass(/bassa/);
    await expect(batteria(page).locator(".mu-pila-fulmine")).toHaveCount(0);
  });

  test("l'entita' scelta vince sul browser", async ({ page }, testInfo) => {
    await pilaFinta(page, 0.9, true);
    await apriLaCasaAMuro(page, testInfo, {
      stati: {
        ...STATI_A_MURO,
        "sensor.tablet_battery_level": { state: "47", attributes: { unit_of_measurement: "%" } },
        "sensor.tablet_battery_state": { state: "discharging", attributes: {} },
      },
      muro: {
        ...MURO_DI_PROVA,
        batteria: {
          attiva: true,
          livello: "sensor.tablet_battery_level",
          carica: "sensor.tablet_battery_state",
        },
      },
    });
    await page.evaluate(() => window.dmMuro.riposa());
    await expect(batteria(page)).toHaveText("47%");
    await expect(batteria(page).locator(".mu-pila-fulmine")).toHaveCount(0);
  });

  test("nel config la batteria del tablet si accende e si sceglie l'entita'", async ({
    page,
  }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, {
      stati: {
        ...STATI_A_MURO,
        "sensor.tablet_battery_level": {
          state: "47",
          attributes: { friendly_name: "Tablet batteria", unit_of_measurement: "%" },
        },
      },
      muro: MURO_DI_PROVA,
    });
    await page.evaluate(() => window.apriConfigEntita());
    await page.locator('.ed-tab[data-tab="muro"]').click();
    const body = page.locator("#ed-body");
    await body.locator("[data-mu-ed-altro]").click();
    const riga = (campo) => body.locator(`.mu-ed-riga:has([data-mu-ed-campo="${campo}"])`);
    await expect(riga("batteria.livello")).toHaveCount(0);
    await body.locator('[data-mu-ed-alterna="batteria.attiva"]').click();
    await expect(riga("batteria.livello")).toBeVisible();
    await expect(riga("batteria.carica")).toBeVisible();
    /* L'entita' si sceglie con la stessa ricerca del resto del config. */
    await riga("batteria.livello").locator("[data-mu-ed-pick]").first().click();
    await expect(page.locator("#cd-entpick")).toBeVisible();
    await page.locator("#cd-ep-search").fill("sensor.tablet_battery_level");
    await page.locator("#cd-entpick").getByText("sensor.tablet_battery_level").first().click();
    await expect(body.locator('[data-mu-ed-campo="batteria.livello"]')).toHaveValue(
      "sensor.tablet_battery_level",
    );
    await body.locator("[data-dm-save-all]").click();
    await expect
      .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("cd_muro")).batteria))
      .toEqual({ attiva: true, livello: "sensor.tablet_battery_level", carica: "" });
  });

  /* «Schermi piccoli e griglia 3x3: le scritte sotto sono tagliate», «anche
   * quando resta in 4x3 in questo widget la parte sotto e' tagliata», e «la
   * grafica dei due sensori e' diversa, con il nome grande sotto: forse meglio
   * la seconda». Su ogni misura nessuna riga esce dal suo riquadro, e un
   * interruttore e un sensore nella stessa pagina hanno la stessa forma. */
  const UNITA = [
    "Soggiorno",
    "Cucina",
    "Studio",
    "Camera",
    "Cameretta",
    "Bagno",
    "Corridoio",
    "Taverna",
    "Lavanderia",
    "Ospiti",
  ];
  const chiave = (n) => n.toLowerCase();
  function casaFitta() {
    const seme = structuredClone(SEME_A_MURO);
    const stati = structuredClone(STATI_A_MURO);
    seme.sections.rooms = UNITA.map((n) => ({
      id: chiave(n),
      name: n,
      temp: `sensor.t_${chiave(n)}`,
    }));
    seme.sections.lights = UNITA.map((n) => ({
      id: `l-${chiave(n)}`,
      name: n,
      entity: `light.${chiave(n)}`,
      room_id: chiave(n),
      room: n,
    }));
    seme.sections.climate = UNITA.map((n) => ({
      id: `c-${chiave(n)}`,
      name: n,
      entity: `climate.${chiave(n)}`,
      room_id: chiave(n),
      room: n,
    }));
    UNITA.forEach((n, i) => {
      stati[`sensor.t_${chiave(n)}`] = { state: "21.5", attributes: { unit_of_measurement: "°C" } };
      stati[`light.${chiave(n)}`] = {
        state: i ? "off" : "on",
        attributes: { friendly_name: n, brightness: 120, supported_color_modes: ["brightness"] },
      };
      stati[`climate.${chiave(n)}`] = {
        state: "heat",
        attributes: {
          friendly_name: n,
          current_temperature: 20.4,
          temperature: 21,
          hvac_modes: ["off", "heat"],
          hvac_action: "heating",
        },
      };
    });
    /* Lo studio ha un termostato a coppia, coi decimali: sta nella linguetta
     * Termostato, con le due righe e i quattro tasti, e non deve uscire. */
    stati["climate.studio"] = {
      state: "heat_cool",
      attributes: {
        friendly_name: "Studio",
        current_temperature: 20.4,
        temperature: null,
        target_temp_low: 21.5,
        target_temp_high: 24.5,
        hvac_modes: ["off", "heat", "cool", "heat_cool"],
        hvac_action: "idle",
        target_temp_step: 0.5,
      },
    };
    for (const n of ["cancello", "garage_1", "portoncino"])
      stati[`switch.${n}`] = { state: "off", attributes: { friendly_name: n } };
    stati["binary_sensor.garage_1"] = {
      state: "on",
      attributes: { friendly_name: "Garage 1", device_class: "garage_door" },
    };
    stati["cover.carraio"] = {
      state: "closed",
      attributes: { friendly_name: "Carraio", device_class: "gate" },
    };
    const caselle = {
      cd_clima_units: UNITA.map((n) => ({
        entity: `climate.${chiave(n)}`,
        type: "termo",
        name: n,
      })),
      cd_clima_rapido_unita: Object.fromEntries(
        UNITA.map((n) => [`climate.${chiave(n)}`, { mode: "heat", temperature: 26, fan: "auto" }]),
      ),
    };
    const muroFitto = {
      attiva: true,
      pagine: [
        {
          id: "p1",
          modello: "personale",
          titolo: "Esterno",
          griglia: 12,
          comandi: [
            { tipo: "entita", entita: "switch.cancello", nome: "Cancello", disegno: "varchi" },
            { tipo: "entita", entita: "switch.garage_1", nome: "Garage 1", sotto: "Apre/chiude" },
            { tipo: "entita", entita: "switch.portoncino", nome: "Portoncino" },
            { tipo: "entita", entita: "binary_sensor.garage_1", nome: "Garage 1", sotto: "Aperto" },
            { tipo: "tapparella", entita: "cover.carraio", nome: "Carraio" },
            { tipo: "entita", entita: "lock.porta", nome: "Porta" },
          ],
        },
        { id: "p2", modello: "luci", griglia: 12 },
        { id: "p3", modello: "ambienti", griglia: 12 },
        { id: "p4", modello: "clima", zona: "caldo", griglia: 12 },
        MURO_DI_PROVA.pagine[2],
      ],
    };
    return { seme, stati, caselle, muro: muroFitto };
  }
  /* Ogni pezzo visibile di ogni riquadro sta dentro il riquadro. */
  const fuoriDalRiquadro = (page) =>
    page.evaluate(() => {
      const fuori = [];
      for (const card of document.querySelectorAll("#dm-muro .mu-card")) {
        const r = card.getBoundingClientRect();
        for (const el of card.querySelectorAll("*")) {
          if (el.closest("svg") && el.tagName.toLowerCase() !== "svg") continue;
          const s = getComputedStyle(el);
          if (s.display === "none" || s.visibility === "hidden") continue;
          const b = el.getBoundingClientRect();
          if (!b.width || !b.height) continue;
          if (b.bottom > r.bottom + 0.5 || b.top < r.top - 0.5 || b.right > r.right + 0.5) {
            fuori.push(
              `${card.dataset.muEntita || card.className}: ${(el.textContent || el.className).toString().trim().slice(0, 24)}`,
            );
            break;
          }
        }
      }
      return fuori;
    });

  for (const [larghezza, altezza] of [
    [1280, 800],
    [1024, 600],
    [800, 480],
    [844, 390],
  ])
    test(`a ${larghezza}x${altezza} nessuna scritta esce dal suo riquadro`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width: larghezza, height: altezza });
      await apriLaCasaAMuro(page, testInfo, casaFitta());
      for (const indice of [0, 1, 2, 3, 4]) {
        if (indice) await muro(page).locator(`[data-mu-pagina="${indice}"]`).click();
        await expect(muro(page).locator(".mu-card").first()).toBeVisible();
        expect(await fuoriDalRiquadro(page), `pagina ${indice}`).toEqual([]);
      }
      /* La linguetta Termostato della pagina Clima: le due righe coi loro
       * quattro tasti stanno nel riquadro anche sul pannello piccolo. */
      await muro(page).locator('[data-mu-pagina="3"]').click();
      await muro(page).locator('[data-mu-zona="termostato"]').click();
      const termostato = muro(page).locator('.mu-card[data-mu-entita="climate.studio"]');
      await expect(termostato).toBeVisible();
      await expect(termostato.locator(".mu-est-t")).toHaveCount(4);
      for (const tasto of await termostato.locator(".mu-est-t").all())
        await expect(tasto).toBeVisible();
      expect(await fuoriDalRiquadro(page), "linguetta Termostato").toEqual([]);
    });

  test("su uno schermo piccolo l'interruttore e il sensore hanno la stessa forma, col nome grande in fondo", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 800, height: 480 });
    await apriLaCasaAMuro(page, testInfo, casaFitta());
    await expect(muro(page)).toHaveAttribute("data-compatto", "1");
    const interruttore = muro(page).locator('.mu-card[data-mu-entita="switch.garage_1"]');
    const sensore = muro(page).locator('.mu-card[data-mu-entita="binary_sensor.garage_1"]');
    const carraio = muro(page).locator('.mu-card[data-mu-entita="cover.carraio"]');
    const forma = (carta) =>
      carta.evaluate((c) => {
        const nome = c.querySelector(".mu-fam-nome");
        const r = c.getBoundingClientRect();
        const n = nome.getBoundingClientRect();
        return {
          famiglia: c.classList.contains("mu-fam"),
          inAlto: [...c.querySelector(".mu-riga1").children]
            .slice(0, 2)
            .map((x) =>
              [...x.classList].find((k) => ["mu-chip", "mu-disco", "mu-stato"].includes(k)),
            ),
          nomeInFondo: r.bottom - n.bottom < r.height * 0.3,
          corpo: getComputedStyle(nome).fontSize,
        };
      });
    const a = await forma(interruttore);
    const b = await forma(sensore);
    expect(a.famiglia && b.famiglia).toBe(true);
    expect(a.inAlto).toEqual(["mu-chip", "mu-stato"]);
    expect(b.inAlto).toEqual(["mu-chip", "mu-stato"]);
    expect(a.nomeInFondo && b.nomeInFondo).toBe(true);
    expect(a.corpo).toBe(b.corpo);
    expect((await forma(carraio)).inAlto).toEqual(["mu-chip", "mu-stato"]);
    /* L'interruttore si vede anche qui, e il tocco su tutto il riquadro
     * resta quello di sempre. */
    await expect(interruttore.locator(".mu-inter")).toBeVisible();
    await interruttore.click();
    expect(await servizi(page)).toEqual([
      { domain: "homeassistant", service: "toggle", data: { entity_id: "switch.garage_1" } },
    ]);
  });

  /* «Sulla personalizzata la modifica del clima serve anche sulle tapparelle,
   * per far comparire i pulsanti diretti senza entrarci dentro», e lo stesso
   * nelle pagine di una stanza. I tasti ▲ ■ ▼ stanno su ogni card di una
   * tapparella, a ogni misura e in ogni griglia, dentro il riquadro e grandi
   * quanto un dito; una tenda che sa solo aprire e chiudere ha ▲ e ▼. */
  function casaDelleTapparelle() {
    const seme = structuredClone(SEME_A_MURO);
    const stati = structuredClone(STATI_A_MURO);
    const tapparelle = [
      /* id, stato, posizione, supported_features */
      ["serranda_piccola", "closed", 0, 15],
      ["serranda_grande", "open", 60, 15],
      ["tenda_scale", "open", null, 3],
      ["schermo_video", "closed", null, 11],
    ];
    for (const [id, s, pos, f] of tapparelle) {
      const nome = id.replace("_", " ").replace(/^./, (x) => x.toUpperCase());
      seme.sections.covers.push({
        id,
        name: nome,
        entity: `cover.${id}`,
        room_id: "soggiorno",
        room: "Soggiorno",
      });
      stati[`cover.${id}`] = {
        state: s,
        attributes: {
          friendly_name: nome,
          supported_features: f,
          ...(pos === null ? {} : { current_position: pos }),
        },
      };
    }
    const posti = [
      ...tapparelle.map(([id]) => ({ tipo: "tapparella", entita: `cover.${id}` })),
      { tipo: "luce", entita: "light.tavolo" },
      { tipo: "azione", azione: "Cinema", nome: "Luci cinema" },
    ];
    const muroDelleTapparelle = {
      attiva: true,
      pagine: [
        { id: "p6", modello: "personale", titolo: "Sei", griglia: 6, comandi: posti },
        {
          id: "p8",
          modello: "stanza",
          stanza: "Soggiorno",
          griglia: 8,
          scelti: true,
          comandi: posti,
        },
        { id: "p12", modello: "personale", titolo: "Dodici", griglia: 12, comandi: posti },
      ],
    };
    return { seme, stati, muro: muroDelleTapparelle };
  }
  const TASTI_ATTESI = {
    "cover.serranda_piccola": ["su", "ferma", "giu"],
    "cover.serranda_grande": ["su", "ferma", "giu"],
    "cover.tenda_scale": ["su", "giu"],
    "cover.schermo_video": ["su", "ferma", "giu"],
  };
  /* I tasti di ogni tapparella a schermo: quali sono, se si vedono, se
   * stanno nella card e quanto sono alti in pixel veri (lo zoom del
   * pannello compreso). */
  const tastiDelleTapparelle = (page) =>
    page.evaluate(() =>
      [...document.querySelectorAll("#dm-muro .mu-card.mu-tapparella")].map((card) => {
        const r = card.getBoundingClientRect();
        const tasti = [...card.querySelectorAll(".mu-tap-tasti>button")];
        return {
          entita: card.dataset.muEntita,
          tasti: tasti.map((b) => b.dataset.muFa),
          visibili: tasti.every((b) => {
            const s = getComputedStyle(b);
            const box = b.getBoundingClientRect();
            return s.display !== "none" && s.visibility !== "hidden" && box.width > 0;
          }),
          dentro: tasti.every((b) => {
            const box = b.getBoundingClientRect();
            return (
              box.top >= r.top - 0.5 &&
              box.bottom <= r.bottom + 0.5 &&
              box.left >= r.left - 0.5 &&
              box.right <= r.right + 0.5
            );
          }),
          alti: Math.min(...tasti.map((b) => b.getBoundingClientRect().height)),
          larghi: Math.min(...tasti.map((b) => b.getBoundingClientRect().width)),
          nome: getComputedStyle(card.querySelector(".mu-fam-nome")).display !== "none",
        };
      }),
    );

  for (const [larghezza, altezza] of [
    [1280, 800],
    [1024, 600],
    [960, 540],
    [800, 480],
    [844, 390],
    [600, 960],
  ])
    test(`a ${larghezza}x${altezza} le tapparelle hanno ▲ ■ ▼ sulla card, in ogni griglia`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width: larghezza, height: altezza });
      await apriLaCasaAMuro(page, testInfo, casaDelleTapparelle());
      for (const indice of [0, 1, 2]) {
        if (indice) await muro(page).locator(`[data-mu-pagina="${indice}"]`).click();
        await expect(muro(page).locator(".mu-card.mu-tapparella").first()).toBeVisible();
        const carte = await tastiDelleTapparelle(page);
        expect(carte.length, `pagina ${indice}`).toBe(4);
        for (const c of carte) {
          const dove = `pagina ${indice}, ${c.entita}`;
          expect(c.tasti, dove).toEqual(TASTI_ATTESI[c.entita]);
          expect(c.visibili, dove).toBe(true);
          expect(c.dentro, dove).toBe(true);
          expect(c.nome, dove).toBe(true);
          /* Un dito: mai sotto i trenta pixel veri. */
          expect(c.alti, dove).toBeGreaterThanOrEqual(29.5);
          expect(c.larghi, dove).toBeGreaterThanOrEqual(29.5);
        }
        expect(await fuoriDalRiquadro(page), `pagina ${indice}`).toEqual([]);
      }
    });

  test("i tasti della card della tapparella comandano, e il tocco sulla card apre la finestra", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 800, height: 480 });
    await apriLaCasaAMuro(page, testInfo, casaDelleTapparelle());
    await muro(page).locator('[data-mu-pagina="2"]').click();
    const carta = muro(page).locator('.mu-card[data-mu-entita="cover.serranda_piccola"]');
    for (const fa of ["su", "ferma", "giu"])
      await carta.locator(`.mu-tap-tasti [data-mu-fa="${fa}"]`).click();
    expect(await servizi(page)).toEqual(
      ["open_cover", "stop_cover", "close_cover"].map((service) => ({
        domain: "cover",
        service,
        data: { entity_id: "cover.serranda_piccola" },
      })),
    );
    await expect(muro(page).locator(".mu-finestra")).toHaveCount(0);
    /* Fuori dai tasti, il tocco apre la finestra con la barra e i tasti. */
    await carta.locator(".mu-fam-nome").click();
    await expect(muro(page).locator(".mu-finestra .mu-seg-alto")).toBeVisible();
    /* La tenda che sa solo aprire e chiudere: nella finestra niente ■. */
    await muro(page).locator('[data-mu-fa="chiudi"]').first().click();
    await muro(page).locator('.mu-card[data-mu-entita="cover.tenda_scale"] .mu-fam-nome').click();
    await expect(muro(page).locator(".mu-finestra .mu-seg-alto [data-mu-fa]")).toHaveCount(2);
    expect((await servizi(page)).length).toBe(3);
  });

  /* «Il meteo lo possiamo scegliere, ma la temperatura no, perche' e' quella
   * geolocalizzata del weather.» Con «Temperatura mostrata: da un sensore in
   * casa» in alto c'e' quella del sensore, con «in casa» e la parola del
   * meteo accanto; sul riposo il meteo resta come disegno e parola, e la
   * temperatura di casa una volta sola. */
  test("la temperatura in alto e sul riposo puo' essere quella di un sensore in casa", async ({
    page,
  }, testInfo) => {
    const stati = {
      ...STATI_A_MURO,
      "sensor.corridoio_t": {
        state: "23.4",
        attributes: { unit_of_measurement: "°C", device_class: "temperature" },
      },
    };
    await apriLaCasaAMuro(page, testInfo, { stati, muro: MURO_DI_PROVA });
    await expect(muro(page).locator(".mu-meteo b")).toHaveText("17°");
    await expect(muro(page).locator(".mu-meteo .mu-et")).toHaveText(/poco nuvoloso/i);
    /* Il disegno sta attaccato al numero, con ogni temperatura: una scritta
     * lunga sotto non deve allargare la colonna e staccarlo. */
    const fra = await distanzaDalNumero(page);
    expect(fra).toBeGreaterThanOrEqual(0);
    expect(fra).toBeLessThanOrEqual(16);

    await apriLaCasaAMuro(page, testInfo, {
      stati,
      muro: {
        ...MURO_DI_PROVA,
        temperatura: "casa",
        riposo: { attivo: true, minuti: 2, torna: true, sensore: "sensor.corridoio_t" },
      },
    });
    await expect(muro(page).locator(".mu-meteo b")).toHaveText("23,4°");
    await expect(muro(page).locator(".mu-meteo .mu-et")).toHaveText(/in casa · poco nuvoloso/i);
    const fraInCasa = await distanzaDalNumero(page);
    expect(fraInCasa).toBeGreaterThanOrEqual(0);
    expect(fraInCasa).toBeLessThanOrEqual(16);
    /* La scritta sta su una riga sola, accanto all'ora. */
    const et = await muro(page)
      .locator(".mu-meteo .mu-et")
      .evaluate((e) => ({
        alta: e.getBoundingClientRect().height,
        lettera: parseFloat(getComputedStyle(e).fontSize),
      }));
    expect(et.alta).toBeLessThan(et.lettera * 2);
    await page.evaluate(() => window.dmMuro.riposa());
    const riga = muro(page).locator(".mu-riposo-riga");
    await expect(riga).toContainText("23,4° in casa");
    await expect(riga).toContainText(/poco nuvoloso/i);
    await expect(riga).not.toContainText("17°");

    /* Senza sensore scelto: quella della stanza della prima pagina. */
    await apriLaCasaAMuro(page, testInfo, {
      stati,
      muro: { ...MURO_DI_PROVA, temperatura: "casa" },
    });
    await expect(muro(page).locator(".mu-meteo b")).toHaveText("21,2°");
  });

  test("nel config «Temperatura mostrata» sceglie fra il meteo e un sensore in casa", async ({
    page,
  }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, { muro: MURO_DI_PROVA });
    await page.evaluate(() => window.apriConfigEntita());
    await page.locator('.ed-tab[data-tab="muro"]').click();
    const body = page.locator("#ed-body");
    await body.locator("[data-mu-ed-altro]").click();
    const scelta = body.locator('.mu-ed-riga:has([data-mu-ed-metti="temperatura"])');
    await expect(scelta).toContainText("Temperatura mostrata");
    await expect(scelta.locator('[data-mu-ed-valore="meteo"]')).toHaveClass(/si/);
    /* Dal meteo: il sensore e' quello del riposo, nella sua riga. */
    await expect(scelta.locator('[data-mu-ed-campo="riposo.sensore"]')).toHaveCount(0);
    await expect(body.locator('[data-mu-ed-campo="riposo.sensore"]')).toHaveCount(1);
    await scelta.locator('[data-mu-ed-valore="casa"]').click();
    /* Da un sensore: lo stesso campo sale nella riga, e quella del riposo
     * non si ripete. */
    const ora = body.locator('.mu-ed-riga:has([data-mu-ed-metti="temperatura"])');
    await expect(ora.locator('[data-mu-ed-campo="riposo.sensore"]')).toHaveCount(1);
    await expect(body.locator('[data-mu-ed-campo="riposo.sensore"]')).toHaveCount(1);
    /* Il sensore si sceglie con la stessa ricerca del resto del config. */
    await ora.locator("[data-mu-ed-pick]").first().click();
    await expect(page.locator("#cd-entpick")).toBeVisible();
    await page.locator("#cd-ep-search").fill("sensor.soggiorno_temperatura");
    await page.locator("#cd-entpick").getByText("sensor.soggiorno_temperatura").first().click();
    await expect(body.locator('[data-mu-ed-campo="riposo.sensore"]')).toHaveValue(
      "sensor.soggiorno_temperatura",
    );
    await body.locator("[data-dm-save-all]").click();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const m = JSON.parse(localStorage.getItem("cd_muro"));
          return [m.temperatura, m.riposo.sensore];
        }),
      )
      .toEqual(["casa", "sensor.soggiorno_temperatura"]);
  });

  /* ── la regia ─────────────────────────────────────────────────────────
   *
   * «Cerca di creare una cosa del genere per wall»: il mixer coi cursori in
   * piedi, la telecamera con le frecce e i preset, i comandi d'avvio, e le
   * pagine in una colonna di tasti a sinistra. */
  const regia = (page, testInfo, muroScelto = MURO_DELLA_REGIA) =>
    apriLaCasaAMuro(page, testInfo, { muro: muroScelto, stati: STATI_DELLA_REGIA });
  /* Trascina il cursore di un canale fino a una quota (0 in fondo, 1 in cima). */
  async function trascina(page, cursore, quota, sdraiato = false) {
    const traccia = await cursore.locator(".mu-fad-traccia").boundingBox();
    const x0 = traccia.x + traccia.width / 2;
    const y0 = traccia.y + traccia.height / 2;
    await page.mouse.move(x0, y0);
    await page.mouse.down();
    const x = sdraiato ? traccia.x + traccia.width * quota : x0;
    const y = sdraiato ? y0 : traccia.y + traccia.height * (1 - quota);
    await page.mouse.move(x, y, { steps: 6 });
    await page.mouse.up();
  }

  test("il mixer: i cursori mandano il livello, e il muto si accende e si spegne", async ({
    page,
  }, testInfo) => {
    await regia(page, testInfo);
    await expect(muro(page).locator(".mu-mix-gruppo")).toHaveCount(3);
    await expect(muro(page).locator(".mu-mix-tit").first()).toHaveText(/Microfoni/i);
    const mic2 = muro(page).locator('[data-mu-canale="number.mic_2"]');
    await expect(mic2.locator(".mu-can-v")).toHaveText("-12,5 dB");
    /* Mic 3 e' muto: il suo tasto e' acceso. */
    await expect(
      muro(page).locator('[data-mu-canale="number.mic_3"] .mu-can-muto'),
    ).toHaveAttribute("aria-pressed", "true");
    await trascina(page, mic2.locator(".mu-fader"), 1);
    await expect(mic2.locator(".mu-can-v")).toHaveText("10 dB");
    await expect
      .poll(async () => (await servizi(page)).at(-1))
      .toEqual({
        domain: "number",
        service: "set_value",
        data: { entity_id: "number.mic_2", value: 10 },
      });
    /* Mentre si trascina parte, ma al massimo quattro volte al secondo. */
    expect((await servizi(page)).length).toBeLessThanOrEqual(3);
    await page.evaluate(() => (window.__SERVIZI__.length = 0));
    await muro(page).locator('[data-mu-canale="number.mic_3"] .mu-can-muto').click();
    await muro(page).locator('[data-mu-canale="media_player.ingresso_pc"] .mu-can-muto').click();
    await expect(muro(page).locator('[data-mu-canale="media_player.ingresso_pc"]')).toHaveClass(
      /mu-muto/,
    );
    const master = muro(page).locator(".mu-mix-master");
    await trascina(page, master.locator(".mu-fader"), 0.5, true);
    await expect(master.locator(".mu-can-v")).toHaveText("50%");
    await expect
      .poll(async () => (await servizi(page)).map((x) => `${x.domain}.${x.service}`))
      .toEqual(["switch.turn_off", "media_player.volume_mute", "media_player.volume_set"]);
    const fatti = await servizi(page);
    expect(fatti[0].data).toEqual({ entity_id: "switch.mic_3_muto" });
    expect(fatti[1].data).toEqual({ entity_id: "media_player.ingresso_pc", is_volume_muted: true });
    expect(fatti[2].data).toEqual({ entity_id: "media_player.volume_totale", volume_level: 0.5 });
  });

  test("la telecamera: le frecce, lo stop, lo zoom e i preset premono le loro entita'", async ({
    page,
  }, testInfo) => {
    await regia(page, testInfo);
    await muro(page).locator('.mu-lato [data-mu-pagina="1"]').click();
    await expect(muro(page).locator(".mu-ptz img[data-mu-telecamera]")).toHaveCount(1);
    for (const tasto of ["su", "sinistra", "stop"])
      await muro(page).locator(`[data-mu-tasto="${tasto}"]`).click();
    await muro(page).locator('[data-mu-fa="preset"]').first().click();
    await trascina(page, muro(page).locator(".mu-ptz-zoom .mu-fader"), 1);
    /* Lo zoom parte mentre si trascina e quando si lascia: l'ultimo e' in cima. */
    await expect.poll(async () => (await servizi(page)).at(-1)?.data?.value).toBe(100);
    const fatti = (await servizi(page)).map((x) => `${x.domain}.${x.service}:${x.data.entity_id}`);
    expect(fatti.slice(0, 4)).toEqual([
      "button.press:button.ptz_su",
      "button.press:button.ptz_sinistra",
      "button.press:button.ptz_stop",
      "button.press:button.ptz_home",
    ]);
    expect(new Set(fatti.slice(4))).toEqual(new Set(["number.set_value:number.zoom_sala"]));
    expect((await servizi(page)).at(-1).data.value).toBe(100);
    /* Un tasto senza entita' resta spento. */
    await expect(muro(page).locator('[data-mu-tasto="zoomPiu"]')).toHaveCount(0);
  });

  test("i comandi: la tessera avvia, la sala si ferma, e ferma tutto ferma tutte", async ({
    page,
  }, testInfo) => {
    await regia(page, testInfo);
    await muro(page).locator('.mu-lato [data-mu-pagina="2"]').click();
    const tessere = muro(page).locator(".mu-reg-tasto");
    await expect(tessere).toHaveCount(2);
    /* «Avvio» e' acceso: lo dice il suo sensore di stato. */
    await expect(tessere.first()).toHaveClass(/mu-accesa/);
    await tessere.nth(1).click();
    await muro(page).locator('.mu-lato [data-mu-pagina="3"]').click();
    const sale = muro(page).locator(".mu-reg-coppia");
    await expect(sale).toHaveCount(5);
    await expect(sale.nth(1)).toHaveClass(/mu-accesa/);
    await sale.nth(0).locator(".mu-reg-avvio").click();
    await expect(sale.nth(0)).toHaveClass(/mu-accesa/);
    await sale.nth(1).locator(".mu-reg-stop").click();
    await expect(sale.nth(1)).not.toHaveClass(/mu-accesa/);
    await muro(page).locator('[data-mu-fa="ferma-tutto"]').click();
    const fatti = (await servizi(page)).map((x) => `${x.domain}.${x.service}:${x.data.entity_id}`);
    expect(fatti.slice(0, 3)).toEqual([
      "script.turn_on:script.spegnimento",
      "switch.turn_on:switch.sala_1",
      "switch.turn_off:switch.sala_2",
    ]);
    expect(fatti.slice(3)).toEqual([1, 2, 3, 4, 5].map((n) => `switch.turn_off:switch.sala_${n}`));
  });

  test("il menu di lato: i tasti a sinistra cambiano pagina, e in verticale tornano le linguette", async ({
    page,
  }, testInfo) => {
    await regia(page, testInfo);
    const lato = muro(page).locator(".mu-lato");
    await expect(lato).toBeVisible();
    await expect(muro(page).locator(".mu-pagine")).toHaveCount(0);
    await expect(lato.locator(".mu-lato-tasto")).toHaveCount(5);
    await expect(lato.locator(".mu-lato-tasto.si")).toHaveText(/Audio/i);
    await lato.locator('[data-mu-pagina="4"]').click();
    await expect(muro(page).locator(".mu-tit")).toHaveText(/Soggiorno/i);
    await expect(lato.locator(".mu-lato-tasto.si")).toHaveText(/Soggiorno/i);
    /* Il ☰ sta in cima alla colonna. */
    await expect(lato.locator('[data-mu-fa="menu"]')).toBeVisible();
    await page.setViewportSize({ width: 800, height: 1280 });
    await expect(muro(page)).toHaveAttribute("data-verso", "verticale");
    await expect(muro(page).locator(".mu-lato")).toHaveCount(0);
    await expect(muro(page).locator(".mu-pagine")).toBeVisible();
    /* Spento, il pannello e' quello di sempre. */
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.evaluate(() => {
      const m = JSON.parse(localStorage.getItem("cd_muro"));
      localStorage.setItem("cd_muro", JSON.stringify({ ...m, menuDiLato: false }));
      window.dispatchEvent(new CustomEvent("dashboardmodern:muro"));
    });
    await expect(muro(page).locator(".mu-lato")).toHaveCount(0);
    await expect(muro(page).locator(".mu-pagine")).toBeVisible();
  });

  /* Niente esce dal suo riquadro ne' dallo schermo, su ogni misura. */
  const fuoriDallaRegia = (page) =>
    page.evaluate(() => {
      const fuori = [];
      const vista = { w: innerWidth, h: innerHeight };
      for (const carta of document.querySelectorAll(
        "#dm-muro .mu-carta, #dm-muro .mu-lato, #dm-muro .mu-canale",
      )) {
        const r = carta.getBoundingClientRect();
        if (r.right > vista.w + 0.5 || r.bottom > vista.h + 0.5 || r.left < -0.5 || r.top < -0.5)
          fuori.push(`schermo: ${carta.className}`);
        for (const el of carta.querySelectorAll("*")) {
          if (el.closest("svg") && el.tagName.toLowerCase() !== "svg") continue;
          const s = getComputedStyle(el);
          if (s.display === "none" || s.visibility === "hidden") continue;
          const b = el.getBoundingClientRect();
          if (!b.width || !b.height) continue;
          if (
            b.bottom > r.bottom + 0.5 ||
            b.top < r.top - 0.5 ||
            b.right > r.right + 0.5 ||
            b.left < r.left - 0.5
          ) {
            fuori.push(
              `${carta.className}: ${(el.textContent || el.className).toString().trim().slice(0, 24)}`,
            );
            break;
          }
        }
      }
      return fuori;
    });

  for (const [larghezza, altezza] of [
    [1280, 800],
    [1024, 600],
    [800, 480],
  ])
    test(`a ${larghezza}x${altezza} la regia sta nei suoi riquadri`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: larghezza, height: altezza });
      await regia(page, testInfo);
      for (const indice of [0, 1, 2, 3, 4]) {
        await muro(page).locator(`[data-mu-pagina="${indice}"]`).first().click();
        await expect(muro(page).locator(".mu-pagina")).toBeVisible();
        await page.waitForTimeout(150);
        expect(await fuoriDallaRegia(page), `pagina ${indice}`).toEqual([]);
      }
    });

  test("nel config si aggiungono le pagine della regia, coi loro canali e comandi", async ({
    page,
  }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, { muro: MURO_DI_PROVA, stati: STATI_DELLA_REGIA });
    await page.evaluate(() => window.apriConfigEntita());
    await page.locator('.ed-tab[data-tab="muro"]').click();
    const body = page.locator("#ed-body");
    await body.locator('[data-mu-ed-nuova="mixer"]').click();
    const campo = (via) => body.locator(`[data-mu-ed-campo="${via}"]`);
    /* L'entita' si sceglie con la ricerca del config, come ovunque. */
    const scegli = async (via, id) => {
      await body.locator(`.mu-ed-cerca:has([data-mu-ed-campo="${via}"]) [data-mu-ed-pick]`).click();
      await page.locator("#cd-ep-search").fill(id);
      await page.locator("#cd-entpick").getByText(id).first().click();
      await expect(campo(via)).toHaveValue(id);
    };
    await campo("pagine.3.mixer.gruppi.0.nome").fill("Microfoni");
    await scegli("pagine.3.mixer.gruppi.0.canali.0.entita", "number.mic_1");
    await scegli("pagine.3.mixer.gruppi.0.canali.0.muto", "switch.mic_1_muto");
    await body.locator('[data-mu-ed-aggiungi-voce="pagine.3.mixer.gruppi"]').click();
    await expect(campo("pagine.3.mixer.gruppi.1.nome")).toBeVisible();
    await body.locator('[data-mu-ed-nuova="comandi"]').click();
    await scegli("pagine.4.pulsanti.0.avvio", "script.avvio");
    await campo("pagine.4.pulsanti.0.nome").fill("Avvio");
    await campo("pagine.4.pulsanti.0.nome").dispatchEvent("change");
    await body.locator("[data-mu-ed-altro]").click();
    await body.locator('[data-mu-ed-alterna="menuDiLato"]').click();
    await body.locator("[data-dm-save-all]").click();
    await expect
      .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("cd_muro"))))
      .toMatchObject({
        menuDiLato: true,
        pagine: [
          {},
          {},
          {},
          {
            modello: "mixer",
            mixer: {
              gruppi: [
                {
                  nome: "Microfoni",
                  canali: [{ entita: "number.mic_1", nome: "", muto: "switch.mic_1_muto" }],
                },
                { nome: "", canali: [] },
              ],
            },
          },
          { modello: "comandi", pulsanti: [{ nome: "Avvio", avvio: "script.avvio" }] },
        ],
      });
  });
});
