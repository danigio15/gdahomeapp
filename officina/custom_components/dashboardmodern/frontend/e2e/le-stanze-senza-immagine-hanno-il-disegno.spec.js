/* Le stanze senza immagine hanno il disegno del loro nome.
 *
 * Dal campo: «perche' le altre stanze non esce l'immagine nei riquadri cosi'?
 * Esce solo l'ingresso». L'ingresso aveva il disegno scelto a mano, le altre
 * stanze niente. Ora una stanza senza immagine prende il disegno che il suo
 * nome dice (`core/disegno-automatico-della-stanza.js`): «Bagno piccolo» il
 * bagno, «Balcone cucina» il terrazzo. Qui si guarda che:
 * - in Home, nelle Stanze e nella Temperatura le stanze hanno il disegno, e
 *   una dal nome che non si capisce («Zona Pippo») resta com'era;
 * - il disegno scelto a mano vince;
 * - il disegno non si scrive in configurazione;
 * - spento l'interruttore nel config, le stanze tornano senza, tranne quella
 *   con l'immagine scelta.
 *
 * Con `DM_FOTO=<cartella>` fa anche le foto, per chi le deve approvare. */
import { expect, test } from "@playwright/test";
import { SEME_A_MURO, STATI_A_MURO, apriLaCasaAMuro } from "./helpers/casa-a-muro.js";

if (process.env.DM_FOTO) test.use({ deviceScaleFactor: 2 });

const STANZE = [
  ["ingresso", "Ingresso", 20.6, 52],
  ["cucina", "Cucina", 22.8, 53],
  ["multimedia", "Multimedia", 22.3, 53],
  ["balcone_cucina", "Balcone cucina", 14.2, 78],
  ["balcone_media", "Balcone media", 13.8, 74],
  ["bagno_piccolo", "Bagno piccolo", 20.7, 60],
  ["camera_letto", "Camera letto", 21.6, 55],
  ["cameretta", "Cameretta", 21.3, 53],
  ["zona_pippo", "Zona Pippo", 19.9, 48],
];

const ATTESI = {
  ingresso: "disegno:ingresso",
  cucina: "disegno:stanza-cucina",
  multimedia: "disegno:soggiorno",
  balcone_cucina: "disegno:terrazzo",
  balcone_media: "disegno:terrazzo",
  bagno_piccolo: "disegno:bagno",
  camera_letto: "disegno:camera-letto",
  cameretta: "disegno:cameretta",
};

function casaDiProva() {
  const seme = structuredClone(SEME_A_MURO);
  seme.sections.rooms = STANZE.map(([id, name]) => ({
    id,
    name,
    temp: `sensor.${id}_temperatura`,
    hum: `sensor.${id}_umidita`,
    ...(id.startsWith("balcone") ? { outdoor: true } : {}),
    /* L'ingresso col disegno scelto a mano, come a casa del cliente. */
    ...(id === "ingresso" ? { immagine: { src: "disegno:ingresso" } } : {}),
  }));
  seme.sections.lights = [
    ["l1", "Luce cucina", "light.cucina", "cucina"],
    ["l2", "Led multimedia", "light.multimedia", "multimedia"],
    ["l3", "Luce camera", "light.camera", "camera_letto"],
    ["l4", "Abat-jour cameretta", "light.cameretta", "cameretta"],
    ["l5", "Specchio bagno", "light.bagno", "bagno_piccolo"],
  ].map(([id, name, entity, room_id]) => ({
    id,
    name,
    entity,
    room_id,
    room: STANZE.find((s) => s[0] === room_id)[1],
  }));
  seme.sections.covers = [
    ["t1", "Tapparella cucina", "cover.cucina", "cucina"],
    ["t2", "Tapparella camera", "cover.camera", "camera_letto"],
  ].map(([id, name, entity, room_id]) => ({
    id,
    name,
    entity,
    room_id,
    room: STANZE.find((s) => s[0] === room_id)[1],
  }));
  seme.sections.climate = [];
  const stati = { ...STATI_A_MURO };
  for (const [id, , gradi, umido] of STANZE) {
    stati[`sensor.${id}_temperatura`] = {
      state: String(gradi),
      attributes: { unit_of_measurement: "°C", device_class: "temperature" },
    };
    stati[`sensor.${id}_umidita`] = {
      state: String(umido),
      attributes: { unit_of_measurement: "%", device_class: "humidity" },
    };
  }
  for (const [entity, state] of [
    ["light.cucina", "on"],
    ["light.multimedia", "off"],
    ["light.camera", "off"],
    ["light.cameretta", "on"],
    ["light.bagno", "off"],
  ])
    stati[entity] = {
      state,
      attributes: { friendly_name: entity, supported_color_modes: ["brightness"] },
    };
  stati["cover.cucina"] = { state: "open", attributes: { current_position: 100 } };
  stati["cover.camera"] = { state: "closed", attributes: { current_position: 0 } };
  return { seme, stati };
}

async function apri(page, testInfo, tema, caselle = {}) {
  const { seme, stati } = casaDiProva();
  await apriLaCasaAMuro(page, testInfo, {
    muro: null,
    seme,
    stati,
    caselle: { cd_home_stanze: STANZE.map((s) => s[0]), ...caselle },
  });
  await page.evaluate((tema) => document.documentElement.setAttribute("data-theme", tema), tema);
}

const tessera = (page, id) =>
  page.locator(`#page-home .dm-stanza-plancia[data-dm-stanza-plancia="${id}"]`);

/* L'immagine posata su una card: la firma che il vestito scrive. */
async function fondoDi(card) {
  return card.evaluate((n) => {
    const firma = n.dataset.dmRqFondo;
    return firma ? JSON.parse(firma).src : "";
  });
}

/* La foto di un pezzo di pagina. La plancia scorre dentro i suoi contenitori,
 * non nella finestra: per avere il pezzo intero, e lontano dalla testata e
 * dalla barra in fondo che stanno ferme sullo schermo, la finestra si fa alta
 * il tempo della foto e il pezzo si mette nel mezzo. */
async function fotoDi(page, locator, path, margine = 0) {
  const prima = page.viewportSize();
  await page.setViewportSize({ width: prima.width, height: 3400 });
  await locator.evaluate((n) => n.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(500);
  const box = await locator.boundingBox();
  await page.screenshot({
    path,
    clip: {
      x: Math.max(0, box.x - margine),
      y: Math.max(0, box.y - margine),
      width: Math.min(prima.width, box.width + margine * 2),
      height: box.height + margine * 2,
    },
  });
  await page.setViewportSize(prima);
}

const vai = (page, tab) => page.locator(`.tab[data-tab="${tab}"]`).evaluate((n) => n.click());
const foto = (testInfo, nome, tema) =>
  `${process.env.DM_FOTO}/${nome}-${testInfo.project.name === "mobile" ? "telefono" : "computer"}-${tema === "dark" ? "scuro" : "chiaro"}.png`;

for (const tema of ["light", "dark"])
  test(`le stanze senza immagine prendono il disegno del nome (${tema})`, async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name === "webkit-ipad" ||
        (!process.env.DM_FOTO && testInfo.project.name !== "desktop"),
      "si prova sul computer; il telefono solo per le foto",
    );
    await apri(page, testInfo, tema);

    /* In Home: ogni stanza col suo disegno, l'ingresso col suo, Pippo senza. */
    await expect(tessera(page, "cucina")).toHaveClass(/dm-rq-fondo/, { timeout: 20_000 });
    for (const [id, src] of Object.entries(ATTESI))
      expect(await fondoDi(tessera(page, id)), id).toBe(src);
    await expect(tessera(page, "zona_pippo")).not.toHaveClass(/dm-rq-fondo/);
    await expect(tessera(page, "zona_pippo").locator(":scope > .dm-rq-img")).toHaveCount(0);
    /* Le scritte restano bianche sul velo. */
    const colore = await tessera(page, "bagno_piccolo")
      .locator(".dm-stanza-plancia-nome")
      .evaluate((n) => getComputedStyle(n).color);
    expect(colore).toBe("rgb(255, 255, 255)");
    /* Il disegno non si scrive: in configurazione l'immagine ce l'ha solo l'ingresso. */
    const scritte = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("dm_dashboard_state"))
        .sections.rooms.filter((s) => s.immagine)
        .map((s) => s.id),
    );
    expect(scritte).toEqual(["ingresso"]);
    if (process.env.DM_FOTO) {
      const blocco = page.locator("#page-home .dm-stanze-plancia-griglia").locator("xpath=..");
      await fotoDi(page, blocco, foto(testInfo, "01-home-stanze", tema), 8);
    }

    /* La pagina Stanze e la Temperatura: lo stesso disegno. */
    await vai(page, "stanze");
    const tesseraStanze = page.locator('.dm-stanze-tessera[data-dm-stanza="balcone_cucina"]');
    await expect(tesseraStanze).toHaveClass(/dm-rq-fondo/, { timeout: 10_000 });
    expect(await fondoDi(tesseraStanze)).toBe("disegno:terrazzo");
    await expect(page.locator('.dm-stanze-tessera[data-dm-stanza="zona_pippo"]')).not.toHaveClass(
      /dm-rq-fondo/,
    );
    if (process.env.DM_FOTO) {
      await fotoDi(page, page.locator("#page-stanze"), foto(testInfo, "02-pagina-stanze", tema));
    }
    await vai(page, "temp");
    const cartaTemp = page.locator('.temp-card[data-room-id="camera_letto"]');
    await expect(cartaTemp).toHaveClass(/dm-rq-fondo/, { timeout: 10_000 });
    expect(await fondoDi(cartaTemp)).toBe("disegno:camera-letto");
    if (process.env.DM_FOTO) {
      await fotoDi(page, page.locator("#page-temp"), foto(testInfo, "03-temperatura", tema));
    }

    /* Il config: Home › Immagini dei riquadri › Stanze. */
    await page.evaluate(() => window.apriConfigEntita());
    await page.evaluate(() => window.editorSwitch("sez0"));
    const pannello = page.locator("#ed-body [data-dm-rq-card-pannello]");
    await expect(pannello).toBeVisible();
    const interruttore = pannello.locator("[data-dm-rq-disegni-stanze]");
    await expect(interruttore).toBeChecked();
    await expect(pannello.locator('[data-dm-rq-automatico="true"]')).toHaveCount(7);
    await expect(pannello.locator('[data-dm-rq-card="card:stanze:1"] .ed-row-old')).toHaveText(
      "Disegno automatico",
    );
    await expect(pannello.locator('[data-dm-rq-card="card:stanze:0"] .ed-row-old')).toHaveText(
      "Disegno",
    );
    await expect(pannello.locator('[data-dm-rq-card="card:stanze:8"] .ed-row-old')).toHaveText(
      "Senza immagine",
    );
    if (process.env.DM_FOTO) {
      /* Il config scorre dentro la sua finestra: per vederci tutte le stanze
       * la si fa alta abbastanza, il tempo della foto. */
      const prima = page.viewportSize();
      await page.setViewportSize({ width: prima.width, height: 2600 });
      const titolo = pannello.locator(".dm-rq-sub-titolo", { hasText: "Stanze" });
      await titolo.evaluate((n) => n.scrollIntoView({ block: "start" }));
      await page.waitForTimeout(400);
      const da = await titolo.boundingBox();
      const a = await pannello.locator('[data-dm-rq-card="card:stanze:8"]').boundingBox();
      const largo = await pannello.boundingBox();
      await page.screenshot({
        path: foto(testInfo, "04-config-immagini-stanze", tema),
        clip: {
          x: Math.max(0, largo.x - 8),
          y: Math.max(0, da.y - 12),
          width: largo.width + 16,
          height: a.y + a.height - da.y + 24,
        },
      });
      await page.setViewportSize(prima);
    }

    /* Spento: le stanze tornano senza, l'ingresso tiene il suo. */
    await interruttore.uncheck();
    await expect(pannello.locator('[data-dm-rq-automatico="true"]')).toHaveCount(0);
    expect(
      await page.evaluate(() => JSON.parse(localStorage.getItem("cd_widgets")).disegniDelleStanze),
    ).toBe(false);
    await page.evaluate(() => document.getElementById("editor-modal")?.remove());
    await vai(page, "home");
    await expect(tessera(page, "cucina")).not.toHaveClass(/dm-rq-fondo/, { timeout: 10_000 });
    await expect(tessera(page, "ingresso")).toHaveClass(/dm-rq-fondo/);
    expect(await fondoDi(tessera(page, "ingresso"))).toBe("disegno:ingresso");
    if (process.env.DM_FOTO) {
      const blocco = page.locator("#page-home .dm-stanze-plancia-griglia").locator("xpath=..");
      await fotoDi(page, blocco, foto(testInfo, "05-home-stanze-interruttore-spento", tema), 8);
    }
  });

test("con l'interruttore spento dal ripristino le stanze restano come prima", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "si prova una volta");
  await apri(page, testInfo, "light", { cd_widgets: { disegniDelleStanze: false } });
  await expect(tessera(page, "ingresso")).toHaveClass(/dm-rq-fondo/, { timeout: 20_000 });
  for (const id of ["cucina", "bagno_piccolo", "zona_pippo"])
    await expect(tessera(page, id)).not.toHaveClass(/dm-rq-fondo/);
});

for (const tema of ["light", "dark"])
  test(`a muro le stanze hanno lo stesso disegno (${tema})`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "il pannello si prova una volta");
    await page.setViewportSize({ width: 1280, height: 800 });
    const { seme, stati } = casaDiProva();
    await apriLaCasaAMuro(page, testInfo, {
      seme,
      stati,
      muro: {
        attiva: true,
        tema: tema === "dark" ? "scuro" : "chiaro",
        pagine: [{ id: "a", modello: "ambienti", griglia: 12 }],
      },
    });
    await page.evaluate((tema) => document.documentElement.setAttribute("data-theme", tema), tema);
    const carte = page.locator("#dm-muro .mu-ambiente");
    await expect(carte).toHaveCount(STANZE.length, { timeout: 20_000 });
    /* Otto con l'immagine (l'ingresso col suo disegno), Pippo senza. */
    await expect(page.locator("#dm-muro .mu-ambiente.mu-rq")).toHaveCount(8);
    const srcDi = (nome) =>
      page
        .locator("#dm-muro .mu-ambiente.mu-rq", { hasText: nome })
        .first()
        .locator("img")
        .first()
        .getAttribute("src");
    expect(await srcDi("Bagno piccolo")).toMatch(/^data:image\/svg\+xml/);
    if (process.env.DM_FOTO) {
      await page.waitForTimeout(500);
      await page.screenshot({
        path: `${process.env.DM_FOTO}/06-muro-ambienti-tablet-${tema === "dark" ? "scuro" : "chiaro"}.png`,
      });
    }
  });
