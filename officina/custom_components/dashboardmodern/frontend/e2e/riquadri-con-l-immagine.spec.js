/* «Riquadri con l'immagine», nel browser.
 *
 * Si sceglie un disegno dal blocco «Immagine» dell'editor, e il riquadro lo
 * mostra: un posto «A muro» (la luce del tavolo, che col tocco
 * sull'interruttore in vetro si accende come sempre) e un riquadro dei
 * Dispositivi della Home, che il guscio disegna da se' e che qui cambia solo
 * vestito. Su desktop e su telefono. */
import { expect, test } from "@playwright/test";
import { disegnoDaRiquadro } from "../src/core/disegni-da-riquadro.js";
import { SEME_A_MURO, STATI_A_MURO, apriLaCasaAMuro } from "./helpers/casa-a-muro.js";

const MURO_PERSONALE = {
  attiva: true,
  pagine: [
    {
      id: "p1",
      modello: "personale",
      titolo: "Sera in salotto",
      scelti: true,
      comandi: [
        { tipo: "luce", entita: "light.tavolo", nome: "Tavolo" },
        { tipo: "azione", azione: "Cinema" },
      ],
    },
  ],
};

const STATI = {
  ...STATI_A_MURO,
  "switch.proiettore": { state: "off", attributes: { friendly_name: "Proiettore" } },
};

const servizi = (page) => page.evaluate(() => window.__SERVIZI__.slice());

/* «Lo devi aggiungere a tutti»: il camino coi due tasti, la batteria che dice
 * il suo numero, la serranda coi suoi tre tasti, il condizionatore coi gradi.
 * Tutti con un disegno del catalogo. */
const disegno = (chiave) => ({ src: `disegno:${chiave}` });
const STATI_DI_TUTTI = {
  ...STATI,
  "script.accendi_caminetto": { state: "off", attributes: { friendly_name: "Accendi caminetto" } },
  "script.spegni_caminetto": { state: "off", attributes: { friendly_name: "Spegni caminetto" } },
  "sensor.casa_battery_soc": {
    state: "76",
    attributes: { friendly_name: "Batteria", unit_of_measurement: "%", device_class: "battery" },
  },
  "cover.serranda_soggiorno": {
    state: "open",
    attributes: {
      friendly_name: "Serranda soggiorno",
      current_position: 40,
      supported_features: 15,
    },
  },
  "climate.condizionatore": {
    state: "cool",
    attributes: {
      friendly_name: "Condizionatore",
      current_temperature: 26.5,
      temperature: 24,
      hvac_modes: ["off", "cool", "heat"],
      hvac_action: "cooling",
      target_temp_step: 0.5,
      min_temp: 16,
      max_temp: 30,
    },
  },
};
const CAMINO = {
  tipo: "duetasti",
  nome: "Camino",
  entita: "script.accendi_caminetto",
  entitaOff: "script.spegni_caminetto",
};
const MURO_DI_TUTTI = {
  attiva: true,
  tema: "scuro",
  pagine: [
    {
      id: "p1",
      modello: "personale",
      titolo: "Casa",
      scelti: true,
      comandi: [
        { ...CAMINO, immagine: disegno("camino") },
        {
          tipo: "entita",
          entita: "sensor.casa_battery_soc",
          nome: "Batteria",
          immagine: disegno("batteria-casa"),
        },
        {
          tipo: "tapparella",
          entita: "cover.serranda_soggiorno",
          nome: "Serranda soggiorno",
          immagine: disegno("tapparella"),
        },
        {
          tipo: "clima",
          entita: "climate.condizionatore",
          nome: "Condizionatore",
          immagine: disegno("condizionatore"),
        },
        {
          tipo: "luce",
          entita: "light.soggiorno",
          nome: "Soggiorno",
          immagine: disegno("lampione"),
        },
        { tipo: "azione", azione: "Cinema", immagine: disegno("proiettore") },
      ],
    },
  ],
};

async function scegliIlDisegno(blocco, chiave, cerca) {
  await blocco.locator("[data-dm-rqi-disegni]").click();
  await blocco.locator("[data-dm-rqi-cerca]").fill(cerca);
  /* Il catalogo e' grande: la ricerca stringe, e quello cercato c'e'. */
  await expect(blocco.locator(`[data-dm-rqi-scegli="${chiave}"]`)).toHaveCount(1);
  await blocco.locator(`[data-dm-rqi-scegli="${chiave}"]`).click();
  /* Scelto: l'inquadratura c'e', e c'e' il «Togli immagine». */
  await expect(blocco.locator("[data-dm-rqi-tela]")).toBeVisible();
  await expect(blocco.locator("[data-dm-rqi-togli]")).toBeVisible();
}

test.describe("i riquadri con l'immagine", () => {
  test("a muro: si sceglie un disegno per la luce, e il riquadro lo mostra", async ({
    page,
  }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, { muro: MURO_PERSONALE, stati: STATI });
    await page.evaluate(() => window.apriConfigEntita());
    await page.locator('.ed-tab[data-tab="muro"]').click();
    const body = page.locator("#ed-body");
    await expect(body.locator(".mu-ed")).toBeVisible();
    const blocco = body.locator('[data-dm-rqi="pagine.0.comandi.0"]');
    await blocco.scrollIntoViewIfNeeded();
    await scegliIlDisegno(blocco, "albero", "natale");
    /* Lo zoom si muove e si scrive. */
    await blocco.locator("[data-dm-rqi-zoom]").fill("150");
    await body.locator("[data-dm-save-all]").click();
    const salvato = await page.evaluate(() => JSON.parse(localStorage.getItem("cd_muro")));
    expect(salvato.pagine[0].comandi[0].immagine).toEqual({
      src: "disegno:albero",
      fuoco: [...disegnoDaRiquadro("albero").fuoco],
      zoom: 1.5,
    });
    expect(salvato.pagine[0].comandi[1].immagine).toBeUndefined();

    await page.evaluate(() => document.getElementById("editor-modal")?.remove());
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("dashboardmodern:muro")));
    const muro = page.locator("#dm-muro");
    await expect(muro).toBeVisible();
    const riquadro = muro.locator('.dm-rq[data-mu-entita="light.tavolo"]');
    await expect(riquadro).toBeVisible();
    await expect(riquadro.locator("img.dm-rq-img")).toHaveAttribute("src", /^data:image\/svg\+xml/);
    await expect(riquadro.locator("img.dm-rq-img")).toHaveAttribute(
      "style",
      /transform:scale\(1\.5\)/,
    );
    await expect(riquadro.locator(".dm-rq-nome")).toHaveText("Tavolo");
    /* Il nome si legge: bianco, sopra l'immagine. */
    const colore = await riquadro.locator(".dm-rq-nome").evaluate((n) => getComputedStyle(n).color);
    expect(colore).toBe("rgb(255, 255, 255)");
    /* Il posto senza immagine e' quello di sempre. */
    await expect(muro.locator('[data-mu-azione="Cinema"].mu-fam')).toBeVisible();
    /* L'interruttore in vetro comanda come sempre. */
    await riquadro.locator('[data-mu-fa="interruttore"]').click();
    await expect
      .poll(async () => (await servizi(page)).map((s) => `${s.domain}.${s.service}`))
      .toEqual(["light.toggle"]);
  });

  test("Prese da schermo largo: la card con l'immagine sta nella fila come le altre", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "la fila larga e' del computer");
    await apriLaCasaAMuro(page, testInfo, { premium: false, muro: null, stati: STATI });
    await page.evaluate(() => {
      localStorage.setItem(
        "cd_prese",
        JSON.stringify([
          {
            id: "p1",
            name: "TV",
            entity: "switch.tv",
            icon: "📺",
            room_id: "",
            immagine: { src: "disegno:tv" },
          },
          { id: "p2", name: "Modem", entity: "switch.modem", icon: "📡", room_id: "" },
        ]),
      );
      const stati = eval("_RAW_STATES");
      for (const id of ["switch.tv", "switch.modem"])
        stati[id] = { entity_id: id, state: "on", attributes: {} };
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    });
    await page.locator('.tab[data-tab="prese"]').evaluate((nodo) => nodo.click());
    const conImmagine = page.locator('#page-prese .dm-rq[data-dm-lucip="switch.tv"]');
    const senza = page.locator('#page-prese .dm-lucip-card[data-dm-lucip="switch.modem"]');
    await expect(conImmagine).toBeVisible({ timeout: 20_000 });
    await expect(senza).toBeVisible();
    /* Prima prendeva la fila intera: 1400 px di cartellone 16:9. Si misura
     * finche' il disegno della pagina non si e' fermato. */
    await expect
      .poll(async () => {
        const larga = (await conImmagine.boundingBox())?.width ?? 0;
        const altra = (await senza.boundingBox())?.width ?? 0;
        return larga > 0 && larga <= 400 && Math.abs(larga - altra) < 2;
      })
      .toBe(true);
  });

  test("Dispositivi: si sceglie un disegno nella Home del config, e la card lo mostra", async ({
    page,
  }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, {
      premium: false,
      muro: null,
      stati: STATI,
      caselle: {
        cd_devices: [{ name: "Proiettore", icon: "📽️", switch: "switch.proiettore" }],
      },
    });
    await page.evaluate(() => window.buildDeviceCards());
    const card = page.locator("#dev-card-0");
    await expect(card).toBeAttached();
    await expect(card).not.toHaveClass(/dm-rq/);

    await page.evaluate(() => window.apriConfigEntita());
    await page.evaluate(() => window.editorSwitch("sez0"));
    const pannello = page.locator("#ed-body [data-dm-rq-dispositivi]");
    await expect(pannello).toBeVisible();
    await pannello.locator('[data-dm-rq-apri="0"]').click();
    const blocco = pannello.locator('[data-dm-rqi="dispositivo-0"]');
    await expect(blocco).toBeVisible();
    await scegliIlDisegno(blocco, "proiettore", "proiet");
    const salvati = await page.evaluate(() => JSON.parse(localStorage.getItem("cd_devices")));
    expect(salvati[0].immagine).toEqual({
      src: "disegno:proiettore",
      fuoco: [...disegnoDaRiquadro("proiettore").fuoco],
      zoom: 1,
    });
    expect(salvati[0].switch).toBe("switch.proiettore");

    await page.evaluate(() => document.getElementById("editor-modal")?.remove());
    await expect(card).toHaveClass(/dm-rq/);
    await expect(card.locator("img.dm-rq-img")).toHaveAttribute("src", /^data:image\/svg\+xml/);
    await expect(card.locator(".dm-rq-nome")).toHaveText("Proiettore");
    /* Lo stato resta quello che il guscio aggiorna per id. */
    await expect(card.locator("#dev-st-0")).toBeAttached();
    await expect(card.locator(".dev-pwr.dm-rq-int")).toBeAttached();
    /* Togliendo l'immagine torna la card di sempre. */
    await page.evaluate(() => {
      const d = JSON.parse(localStorage.getItem("cd_devices"));
      delete d[0].immagine;
      localStorage.setItem("cd_devices", JSON.stringify(d));
      window.buildDeviceCards();
    });
    await expect(card).not.toHaveClass(/dm-rq/);
  });

  test("a muro: il camino coi due tasti prende il disegno dall'editor, e ON e OFF chiamano i loro script", async ({
    page,
  }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, {
      stati: STATI_DI_TUTTI,
      muro: {
        attiva: true,
        pagine: [{ id: "p1", modello: "personale", scelti: true, comandi: [CAMINO] }],
      },
    });
    await page.evaluate(() => window.apriConfigEntita());
    await page.locator('.ed-tab[data-tab="muro"]').click();
    const body = page.locator("#ed-body");
    await expect(body.locator(".mu-ed")).toBeVisible();
    /* «Qui non c'e' per scegliere»: adesso c'e', sotto l'Icona. */
    const blocco = body.locator('[data-dm-rqi="pagine.0.comandi.0"]');
    await blocco.scrollIntoViewIfNeeded();
    await expect(blocco).toBeVisible();
    await scegliIlDisegno(blocco, "camino", "camino");
    /* L'anteprima e' quella del tablet: ON e OFF, non «Acceso». */
    const anteprima = blocco.locator("[data-dm-rqi-anteprima] .dm-rq");
    await expect(anteprima.locator('[data-mu-verso="on"]')).toHaveText("ON");
    await expect(anteprima.locator('[data-mu-verso="off"]')).toHaveText("OFF");
    await expect(anteprima.locator(".dm-rq-stato")).not.toContainText(/Acces/i);
    await body.locator("[data-dm-save-all]").click();
    const salvato = await page.evaluate(() => JSON.parse(localStorage.getItem("cd_muro")));
    expect(salvato.pagine[0].comandi[0]).toMatchObject({
      tipo: "duetasti",
      entita: "script.accendi_caminetto",
      entitaOff: "script.spegni_caminetto",
      immagine: { src: "disegno:camino", zoom: 1 },
    });

    await page.evaluate(() => document.getElementById("editor-modal")?.remove());
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("dashboardmodern:muro")));
    const riquadro = page.locator("#dm-muro .dm-rq.mu-duetasti");
    await expect(riquadro).toBeVisible();
    await expect(riquadro.locator("img.dm-rq-img")).toHaveAttribute("src", /^data:image\/svg\+xml/);
    await expect(riquadro.locator(".dm-rq-nome")).toHaveText("Camino");
    await riquadro.locator('[data-mu-verso="on"]').click();
    await riquadro.locator('[data-mu-verso="off"]').click();
    expect(await servizi(page)).toEqual([
      { domain: "script", service: "turn_on", data: { entity_id: "script.accendi_caminetto" } },
      { domain: "script", service: "turn_on", data: { entity_id: "script.spegni_caminetto" } },
    ]);
    /* Nessuna finestra: i tasti fanno il loro comando e basta. */
    await expect(page.locator("#dm-muro .mu-finestra")).toHaveCount(0);
  });

  test("a muro: la batteria con l'immagine dice 76 %, la serranda e il condizionatore comandano sopra l'immagine", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await apriLaCasaAMuro(page, testInfo, { stati: STATI_DI_TUTTI, muro: MURO_DI_TUTTI });
    const muro = page.locator("#dm-muro");
    await expect(muro).toBeVisible();
    /* Sei riquadri con l'immagine, nessuno col disco di sempre. */
    await expect(muro.locator(".mu-g6 > .dm-rq")).toHaveCount(6);
    const batteria = muro.locator('.dm-rq[data-mu-entita="sensor.casa_battery_soc"]');
    await expect(batteria.locator("img.dm-rq-img")).toBeVisible();
    await expect(batteria.locator(".dm-rq-stato")).toHaveText("76 %");
    await expect(batteria.locator(".dm-rq-nome")).toHaveText("Batteria");

    const serranda = muro.locator('.dm-rq[data-mu-entita="cover.serranda_soggiorno"]');
    await expect(serranda.locator(".dm-rq-stato")).toContainText("40%");
    for (const [fa, servizio] of [
      ["su", "open_cover"],
      ["ferma", "stop_cover"],
      ["giu", "close_cover"],
    ]) {
      const prima = (await servizi(page)).length;
      await serranda.locator(`[data-mu-fa="${fa}"]`).click();
      await expect
        .poll(async () => (await servizi(page)).slice(prima).map((s) => s.service))
        .toContain(servizio);
    }

    const clima = muro.locator('.dm-rq[data-mu-entita="climate.condizionatore"]');
    await expect(clima.locator(".dm-rq-gradi > b")).toHaveText("24°");
    await expect(clima.locator(".dm-rq-stato")).toContainText("26,5°");
    await expect(clima.locator('[data-mu-fa="modo"]')).toBeVisible();
    await clima.locator('[data-mu-fa="piu"]').click();
    await expect(clima.locator(".dm-rq-gradi > b")).toHaveText("24,5°");
    await expect
      .poll(async () =>
        (await servizi(page)).some(
          (s) => s.service === "set_temperature" && s.data.entity_id === "climate.condizionatore",
        ),
      )
      .toBe(true);
    /* I tasti si leggono: bianchi sul vetro scuro. */
    const colore = await clima
      .locator('[data-mu-fa="meno"]')
      .evaluate((n) => getComputedStyle(n).color);
    expect(colore).toBe("rgb(255, 255, 255)");
  });

  test("plancia: ogni card configurata prende l'immagine dal config, e i suoi comandi restano", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "il pannello si prova una volta");
    const seme = structuredClone(SEME_A_MURO);
    seme.sections.climate[0].immagine = disegno("condizionatore");
    seme.sections.covers[0].immagine = disegno("tapparella");
    seme.sections.cameras[0].immagine = disegno("cancello");
    seme.sections.rooms[0].immagine = disegno("soggiorno");
    await apriLaCasaAMuro(page, testInfo, { premium: false, muro: null, stati: STATI, seme });
    /* Dal config: «Immagini dei riquadri», la luce del soggiorno. */
    await page.evaluate(() => window.apriConfigEntita());
    await page.evaluate(() => window.editorSwitch("sez0"));
    const pannello = page.locator("#ed-body [data-dm-rq-card-pannello]");
    await expect(pannello).toBeVisible();
    for (const gruppo of ["Luci", "Clima", "Tapparelle", "Telecamere", "Stanze", "Azioni rapide"])
      await expect(pannello).toContainText(gruppo);
    await pannello.locator('[data-dm-rq-apri-card="card:luci:0"]').click();
    const blocco = pannello.locator('[data-dm-rqi="card:luci:0"]');
    await expect(blocco).toBeVisible();
    await scegliIlDisegno(blocco, "lampione", "lampione");
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            JSON.parse(localStorage.getItem("dm_dashboard_state")).sections.lights[0].immagine?.src,
        ),
      )
      .toBe("disegno:lampione");
    /* E un'azione rapida, che sta in un'altra casella. */
    await pannello.locator('[data-dm-rq-apri-card="card:azioni:4"]').click();
    await scegliIlDisegno(
      pannello.locator('[data-dm-rqi="card:azioni:4"]'),
      "proiettore",
      "proiet",
    );
    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("cd_quick_actions"))[4].immagine.src,
      ),
    ).toBe("disegno:proiettore");
    await page.evaluate(() => document.getElementById("editor-modal")?.remove());

    /* Le card del guscio col fondo: la foto, il velo, e i loro comandi. */
    const vai = (tab) => page.locator(`.tab[data-tab="${tab}"]`).evaluate((n) => n.click());
    await vai("luci");
    const luce = page.locator('.dm-lucip-card[data-dm-lucip="light.soggiorno"]');
    await expect(luce).toHaveClass(/dm-rq-fondo/);
    await expect(luce.locator(":scope > img.dm-rq-img")).toHaveAttribute(
      "src",
      /^data:image\/svg\+xml/,
    );
    await expect(luce.locator("[data-dm-lucip-brightness]")).toBeVisible();
    await expect(page.locator('.dm-lucip-card[data-dm-lucip="light.cucina"]')).not.toHaveClass(
      /dm-rq-fondo/,
    );
    await vai("clima");
    await expect(page.locator('.dm-cl-card[data-dm-cl="climate.soggiorno"]')).toHaveClass(
      /dm-rq-fondo/,
    );
    await vai("tapparelle");
    const tapparella = page.locator('.tapp-card[data-tapp="cover.soggiorno"]');
    await expect(tapparella).toHaveClass(/dm-rq-fondo/);
    await vai("security");
    await expect(
      page.locator('.cam-card[data-dm-entity="camera.cancello"] .dm-cam-feed'),
    ).toHaveClass(/dm-rq-fondo/);
    await vai("stanze");
    await expect(page.locator('.dm-stanze-tessera[data-dm-stanza="soggiorno"]')).toHaveClass(
      /dm-rq-fondo/,
    );
    await expect(page.locator(".qa-btn").nth(4)).toHaveClass(/dm-rq-fondo/);
    /* Il testo sul velo e' bianco. */
    const colore = await page
      .locator('.dm-stanze-tessera[data-dm-stanza="soggiorno"] .dm-stanze-tessera-nome')
      .evaluate((n) => getComputedStyle(n).color);
    expect(colore).toBe("rgb(255, 255, 255)");
  });

  test("a muro senza eccezioni: energia, musica e preset prendono l'immagine dall'editor", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "l'editor si prova una volta");
    const stati = {
      ...STATI_DI_TUTTI,
      "sensor.casa_power": { state: "1840", attributes: { unit_of_measurement: "W" } },
      "media_player.sala": { state: "playing", attributes: { friendly_name: "Sala" } },
      "button.preset_porta": { state: "unknown", attributes: { friendly_name: "Porta" } },
    };
    await apriLaCasaAMuro(page, testInfo, {
      stati,
      muro: {
        attiva: true,
        pagine: [
          { id: "e", modello: "energia", energia: { casa: "sensor.casa_power" } },
          { id: "m", modello: "musica", lettori: ["media_player.sala"] },
          {
            id: "t",
            modello: "telecamera",
            telecamera: { entita: "camera.cancello", preset: [{ entita: "button.preset_porta" }] },
          },
        ],
      },
    });
    await page.evaluate(() => window.apriConfigEntita());
    await page.locator('.ed-tab[data-tab="muro"]').click();
    const body = page.locator("#ed-body");
    for (const [i, chiave, disegnoScelto, cerca] of [
      [0, "casa", "soggiorno", "soggiorno"],
      [1, "lettore:media_player.sala", "giradischi", "giradischi"],
      [2, "preset:0", "portone", "portone"],
    ]) {
      const apri = body.locator(`[data-mu-ed-apri="${i}"]`);
      if ((await apri.getAttribute("aria-expanded")) !== "true") await apri.click();
      const via = `pagine.${i}.immagini.${chiave}`;
      await body.locator(`[data-mu-ed-tessera="${via}"]`).click();
      await scegliIlDisegno(body.locator(`[data-dm-rqi="${via}"]`), disegnoScelto, cerca);
    }
    await body.locator("[data-dm-save-all]").click();
    const salvato = await page.evaluate(() => JSON.parse(localStorage.getItem("cd_muro")));
    expect(salvato.pagine[0].immagini.casa.src).toBe("disegno:soggiorno");
    expect(salvato.pagine[1].immagini["lettore:media_player.sala"].src).toBe("disegno:giradischi");
    expect(salvato.pagine[2].immagini["preset:0"].src).toBe("disegno:portone");

    await page.evaluate(() => document.getElementById("editor-modal")?.remove());
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("dashboardmodern:muro")));
    const muro = page.locator("#dm-muro");
    await expect(
      muro.locator('.mu-energia.dm-rq-fondo[data-mu-misura="casa"] > img.dm-rq-img'),
    ).toBeVisible();
    await muro.locator('[data-mu-pagina="1"]').first().click();
    await expect(muro.locator('.mu-mp.dm-rq-fondo[data-mu-mp="media_player.sala"]')).toBeVisible();
    await muro.locator('[data-mu-pagina="2"]').first().click();
    const preset = muro.locator('.mu-ptz-preset-t.dm-rq-fondo[data-mu-indice="0"]');
    await expect(preset).toBeVisible();
    await preset.click();
    await expect
      .poll(async () => (await servizi(page)).map((s) => s.data?.entity_id))
      .toContain("button.preset_porta");
  });

  test("plancia senza eccezioni: Home, energia, irrigazione, piscina e l'auto col blocco Immagine", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "il pannello si prova una volta");
    const seme = structuredClone(SEME_A_MURO);
    seme.sections.ev = [{ id: "ev-uno", name: "Prima", brand: "Leapmotor", icon: "mdi:car" }];
    seme.sections.irrigation = { zones: [{ id: "z1", name: "Prato", entity: "switch.prato" }] };
    seme.sections.energyLoads = [{ id: "l1", name: "Forno", entity: "sensor.forno_power" }];
    seme.sections.pool = { id: "vasca", name: "Piscina", pumpEnt: "switch.pompa" };
    seme.visibility = {
      ...seme.visibility,
      ev: true,
      energy: true,
      piscina: true,
      irrigazione: true,
    };
    await apriLaCasaAMuro(page, testInfo, {
      premium: false,
      muro: null,
      seme,
      stati: {
        ...STATI,
        "switch.pompa": { state: "on", attributes: {} },
        "switch.prato": { state: "off", attributes: { friendly_name: "Prato" } },
        "sensor.forno_power": { state: "1200", attributes: { unit_of_measurement: "W" } },
      },
      caselle: {
        cd_immagini_riquadri: {
          "energia:l1": disegno("forno"),
          "irrigazione:0": disegno("irrigatore"),
          "piscina:vasca": disegno("piscina"),
        },
      },
    });
    const vai = (tab) => page.locator(`.tab[data-tab="${tab}"]`).evaluate((n) => n.click());
    await vai("energy");
    await expect(page.locator('.dm-flow-node[data-dm-flow-node="l1"]').first()).toHaveClass(
      /dm-rq-fondo/,
    );
    await vai("irrigazione");
    await expect(page.locator('.dm-irr-card[data-dm-irr-card="0"]')).toHaveClass(/dm-rq-fondo/);
    await vai("piscina");
    await expect(page.locator(".dm-pool-block [data-dm-pool-stage]")).toHaveClass(/dm-rq-fondo/);

    /* La tessera Luci della Home, dal pannello del config. */
    await vai("home");
    await page.evaluate(() => window.apriConfigEntita());
    await page.evaluate(() => window.editorSwitch("sez0"));
    const pannello = page.locator("#ed-body [data-dm-rq-card-pannello]");
    await pannello.locator('[data-dm-rq-apri-card="card:home:0"]').click();
    await scegliIlDisegno(
      pannello.locator('[data-dm-rqi="card:home:0"]'),
      "lampadario",
      "lampadario",
    );
    const sciolte = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("cd_immagini_riquadri")),
    );
    expect(Object.values(sciolte).some((v) => v.src === "disegno:lampadario")).toBe(true);

    /* L'auto: il blocco «Immagine» sta nella scheda dell'auto, e la foto
     * dell'auto diventa il disegno. */
    await page.evaluate(() => window.editorSwitch("sez2"));
    await page.locator("#ed-body [data-ev-edit]").first().click();
    const blocco = page.locator('#ed-body [data-ev-photos] [data-dm-rqi^="auto:"]');
    await blocco.scrollIntoViewIfNeeded();
    await scegliIlDisegno(blocco, "auto-elettrica", "auto");
    await expect(page.locator('[data-ev-photo="idle"] [data-ev-photo-input]')).toHaveValue(
      "disegno:auto-elettrica",
    );
    await page.evaluate(() => document.getElementById("editor-modal")?.remove());
    await vai("ev");
    await expect(page.locator("#ev-mod-car-img")).toHaveAttribute("src", /^data:image\/svg\+xml/);
    await vai("home");
    await expect(page.locator(".dm-tile.dm-rq-fondo")).toHaveCount(1);
  });
});
