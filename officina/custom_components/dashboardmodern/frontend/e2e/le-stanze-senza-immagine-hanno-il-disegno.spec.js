/* Le stanze col loro interruttore «Immagine», e il disegno del loro nome.
 *
 * Dal campo: «perche' le altre stanze non esce l'immagine nei riquadri cosi'?
 * Esce solo l'ingresso». L'ingresso aveva il disegno scelto a mano, le altre
 * stanze niente. Ora ogni stanza ha il suo interruttore «Immagine»
 * (`mostraImmagine`, addosso alla stanza): acceso, la sua immagine o il
 * disegno che il nome dice (`core/disegno-automatico-della-stanza.js`);
 * spento, niente. Di partenza e' acceso solo chi un'immagine se l'era scelta:
 * all'aggiornamento la Home non cambia. Qui si guarda che:
 * - all'inizio solo l'ingresso ha l'immagine;
 * - accese dal config, le stanze hanno il disegno in Home, nelle Stanze e
 *   nella Temperatura; i balconi spenti no; «Zona Pippo» accesa resta senza;
 * - il disegno non si scrive in configurazione, l'interruttore si';
 * - spenta, l'immagine scelta a mano sparisce ma resta salvata, e torna;
 * - lo stesso interruttore sta nella scheda della stanza;
 * - il muro fa lo stesso.
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

/* Le stanze che si accendono: i balconi restano spenti, «Zona Pippo» si
 * accende ma un disegno non ce l'ha. */
const ACCESE = ["cucina", "multimedia", "bagno_piccolo", "camera_letto", "cameretta", "zona_pippo"];
const ATTESI = {
  ingresso: "disegno:ingresso",
  cucina: "disegno:stanza-cucina",
  multimedia: "disegno:soggiorno",
  bagno_piccolo: "disegno:bagno",
  camera_letto: "disegno:camera-letto",
  cameretta: "disegno:cameretta",
};
const SENZA = ["balcone_cucina", "balcone_media", "zona_pippo"];
const indice = (id) => STANZE.findIndex((s) => s[0] === id);

function casaDiProva(accese = []) {
  const seme = structuredClone(SEME_A_MURO);
  seme.sections.rooms = STANZE.map(([id, name]) => ({
    id,
    name,
    temp: `sensor.${id}_temperatura`,
    hum: `sensor.${id}_umidita`,
    ...(id.startsWith("balcone") ? { outdoor: true } : {}),
    /* L'ingresso col disegno scelto a mano, come a casa del cliente. */
    ...(id === "ingresso" ? { immagine: { src: "disegno:ingresso" } } : {}),
    ...(accese.includes(id) ? { mostraImmagine: true } : {}),
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

async function apri(page, testInfo, tema, { caselle = {}, accese = [] } = {}) {
  const { seme, stati } = casaDiProva(accese);
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

const stanzeSalvate = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("dm_dashboard_state")).sections.rooms);

async function apriIlPannello(page) {
  await page.evaluate(() => window.apriConfigEntita());
  await page.evaluate(() => window.editorSwitch("sez0"));
  const pannello = page.locator("#ed-body [data-dm-rq-card-pannello]");
  await expect(pannello).toBeVisible();
  return pannello;
}
const rigaDi = (pannello, id) => pannello.locator(`[data-dm-rq-card="card:stanze:${indice(id)}"]`);
const chiudiIlConfig = (page) =>
  page.evaluate(() => document.getElementById("editor-modal")?.remove());

async function controllaLaHome(page) {
  await expect(tessera(page, "cucina")).toHaveClass(/dm-rq-fondo/, { timeout: 20_000 });
  for (const [id, src] of Object.entries(ATTESI))
    expect(await fondoDi(tessera(page, id)), id).toBe(src);
  for (const id of SENZA) await expect(tessera(page, id), id).not.toHaveClass(/dm-rq-fondo/);
}

for (const tema of ["light", "dark"])
  test(`all'aggiornamento solo l'ingresso; accese dal config, il disegno del nome (${tema})`, async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name === "webkit-ipad" ||
        (!process.env.DM_FOTO && testInfo.project.name !== "desktop"),
      "si prova sul computer; il telefono solo per le foto",
    );
    await apri(page, testInfo, tema);

    /* Come all'aggiornamento: l'ingresso col suo disegno, le altre spente. */
    await expect(tessera(page, "ingresso")).toHaveClass(/dm-rq-fondo/, { timeout: 20_000 });
    expect(await fondoDi(tessera(page, "ingresso"))).toBe("disegno:ingresso");
    for (const [id] of STANZE.slice(1))
      await expect(tessera(page, id), id).not.toHaveClass(/dm-rq-fondo/);
    if (process.env.DM_FOTO) {
      const blocco = page.locator("#page-home .dm-stanze-plancia-griglia").locator("xpath=..");
      await fotoDi(page, blocco, foto(testInfo, "01-home-all-aggiornamento", tema), 8);
    }

    /* Il config: Home › Immagini dei riquadri › Stanze, un interruttore a riga. */
    const pannello = await apriIlPannello(page);
    await expect(pannello.locator("[data-dm-rq-mostra]")).toHaveCount(STANZE.length);
    await expect(rigaDi(pannello, "ingresso").locator("[data-dm-rq-mostra]")).toBeChecked();
    await expect(rigaDi(pannello, "ingresso").locator(".ed-row-old")).toHaveText("Disegno");
    await expect(rigaDi(pannello, "cucina").locator("[data-dm-rq-mostra]")).not.toBeChecked();
    await expect(rigaDi(pannello, "cucina").locator(".ed-row-old")).toHaveText("Spenta");
    for (const id of ACCESE) {
      await rigaDi(pannello, id).locator("[data-dm-rq-mostra]").check();
      await expect(rigaDi(pannello, id).locator("[data-dm-rq-mostra]")).toBeChecked();
    }
    await expect(rigaDi(pannello, "cucina").locator(".ed-row-old")).toHaveText(
      "Disegno automatico",
    );
    await expect(rigaDi(pannello, "zona_pippo").locator(".ed-row-old")).toHaveText(
      "Senza immagine",
    );
    await expect(rigaDi(pannello, "balcone_cucina").locator(".ed-row-old")).toHaveText("Spenta");
    /* Si scrive l'interruttore, non il disegno. */
    const salvate = await stanzeSalvate(page);
    expect(salvate.filter((s) => s.mostraImmagine === true).map((s) => s.id)).toEqual(ACCESE);
    expect(salvate.filter((s) => s.immagine).map((s) => s.id)).toEqual(["ingresso"]);
    if (process.env.DM_FOTO) {
      /* Il config scorre dentro la sua finestra: la si fa alta il tempo della foto. */
      const prima = page.viewportSize();
      await page.setViewportSize({ width: prima.width, height: 2600 });
      const titolo = pannello.locator(".dm-rq-sub-titolo", { hasText: "Stanze" });
      await titolo.evaluate((n) => n.scrollIntoView({ block: "start" }));
      await page.waitForTimeout(400);
      const da = await titolo.boundingBox();
      const a = await rigaDi(pannello, "zona_pippo").boundingBox();
      const largo = await pannello.boundingBox();
      await page.screenshot({
        path: foto(testInfo, "05-config-interruttori-stanze", tema),
        clip: {
          x: Math.max(0, largo.x - 8),
          y: Math.max(0, da.y - 12),
          width: largo.width + 16,
          height: a.y + a.height - da.y + 24,
        },
      });
      await page.setViewportSize(prima);
    }
    await chiudiIlConfig(page);
    await vai(page, "home");

    /* La Home, le Stanze, la Temperatura: le accese col disegno. */
    await controllaLaHome(page);
    const colore = await tessera(page, "bagno_piccolo")
      .locator(".dm-stanza-plancia-nome")
      .evaluate((n) => getComputedStyle(n).color);
    expect(colore).toBe("rgb(255, 255, 255)");
    if (process.env.DM_FOTO) {
      const blocco = page.locator("#page-home .dm-stanze-plancia-griglia").locator("xpath=..");
      await fotoDi(page, blocco, foto(testInfo, "02-home-alcune-accese", tema), 8);
    }
    await vai(page, "stanze");
    const tesseraStanze = page.locator('.dm-stanze-tessera[data-dm-stanza="camera_letto"]');
    await expect(tesseraStanze).toHaveClass(/dm-rq-fondo/, { timeout: 10_000 });
    expect(await fondoDi(tesseraStanze)).toBe("disegno:camera-letto");
    await expect(
      page.locator('.dm-stanze-tessera[data-dm-stanza="balcone_cucina"]'),
    ).not.toHaveClass(/dm-rq-fondo/);
    if (process.env.DM_FOTO)
      await fotoDi(page, page.locator("#page-stanze"), foto(testInfo, "03-pagina-stanze", tema));
    await vai(page, "temp");
    const cartaTemp = page.locator('.temp-card[data-room-id="cucina"]');
    await expect(cartaTemp).toHaveClass(/dm-rq-fondo/, { timeout: 10_000 });
    expect(await fondoDi(cartaTemp)).toBe("disegno:stanza-cucina");
    await expect(page.locator('.temp-card[data-room-id="balcone_media"]')).not.toHaveClass(
      /dm-rq-fondo/,
    );
    if (process.env.DM_FOTO)
      await fotoDi(page, page.locator("#page-temp"), foto(testInfo, "04-temperatura", tema));
  });

test("spenta, l'immagine scelta a mano sparisce ma resta salvata; riaccesa torna", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "si prova una volta");
  await apri(page, testInfo, "light");
  await expect(tessera(page, "ingresso")).toHaveClass(/dm-rq-fondo/, { timeout: 20_000 });
  let pannello = await apriIlPannello(page);
  await rigaDi(pannello, "ingresso").locator("[data-dm-rq-mostra]").uncheck();
  await expect(rigaDi(pannello, "ingresso").locator(".ed-row-old")).toHaveText("Spenta");
  let ingresso = (await stanzeSalvate(page)).find((s) => s.id === "ingresso");
  expect(ingresso.mostraImmagine).toBe(false);
  expect(ingresso.immagine.src).toBe("disegno:ingresso");
  await chiudiIlConfig(page);
  await vai(page, "home");
  await expect(tessera(page, "ingresso")).not.toHaveClass(/dm-rq-fondo/, { timeout: 10_000 });

  pannello = await apriIlPannello(page);
  await rigaDi(pannello, "ingresso").locator("[data-dm-rq-mostra]").check();
  await expect(rigaDi(pannello, "ingresso").locator(".ed-row-old")).toHaveText("Disegno");
  ingresso = (await stanzeSalvate(page)).find((s) => s.id === "ingresso");
  expect(ingresso.mostraImmagine).toBe(true);
  await chiudiIlConfig(page);
  await vai(page, "home");
  await expect(tessera(page, "ingresso")).toHaveClass(/dm-rq-fondo/, { timeout: 10_000 });
  expect(await fondoDi(tessera(page, "ingresso"))).toBe("disegno:ingresso");
});

test("lo stesso interruttore sta nella scheda della stanza", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "si prova una volta");
  await apri(page, testInfo, "light");
  await expect(tessera(page, "ingresso")).toHaveClass(/dm-rq-fondo/, { timeout: 20_000 });
  await page.evaluate(() => {
    window.apriConfigEntita?.();
    window.editorSwitch?.("stanze");
  });
  await expect(page.locator("#dm-piani-pannello")).toBeVisible({ timeout: 20_000 });
  const posto = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("cd_stanze")).findIndex((s) => s.name === "Cucina"),
  );
  await page.locator(`[data-dm-edit-kind="room"][data-dm-edit-index="${posto}"]`).click();
  const finestra = page.locator("#dm-room-editor-modal");
  await expect(finestra).toBeVisible();
  const casella = finestra.locator('input[name="mostraImmagine"]');
  await expect(casella).not.toBeChecked();
  await casella.check();
  await finestra.locator(".ed-save-btn").click();
  await expect(finestra).toHaveCount(0);
  const cucina = (await stanzeSalvate(page)).find((s) => s.id === "cucina");
  expect(cucina.mostraImmagine).toBe(true);
  expect(cucina).not.toHaveProperty("immagine");
  /* Le altre, salvate senza toccarle, restano «come prima». */
  expect((await stanzeSalvate(page)).find((s) => s.id === "bagno_piccolo")).not.toHaveProperty(
    "mostraImmagine",
  );
  await chiudiIlConfig(page);
  await vai(page, "home");
  await expect(tessera(page, "cucina")).toHaveClass(/dm-rq-fondo/, { timeout: 10_000 });
  expect(await fondoDi(tessera(page, "cucina"))).toBe("disegno:stanza-cucina");
});

for (const tema of ["light", "dark"])
  test(`a muro le stanze seguono il loro interruttore (${tema})`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "il pannello si prova una volta");
    await page.setViewportSize({ width: 1280, height: 800 });
    const { seme, stati } = casaDiProva(ACCESE);
    await apriLaCasaAMuro(page, testInfo, {
      seme,
      stati,
      muro: {
        attiva: true,
        tema: tema === "dark" ? "scuro" : "chiaro",
        pagine: [{ id: "a", modello: "ambienti", griglia: 12 }],
      },
    });
    const carte = page.locator("#dm-muro .mu-ambiente");
    await expect(carte).toHaveCount(STANZE.length, { timeout: 20_000 });
    /* Sei con l'immagine: l'ingresso e le cinque accese col disegno. */
    await expect(page.locator("#dm-muro .mu-ambiente.mu-rq")).toHaveCount(6);
    for (const nome of ["Balcone cucina", "Balcone media", "Zona Pippo"])
      await expect(page.locator("#dm-muro .mu-ambiente.mu-rq", { hasText: nome })).toHaveCount(0);
    if (process.env.DM_FOTO) {
      await page.waitForTimeout(500);
      await page.screenshot({
        path: `${process.env.DM_FOTO}/06-muro-ambienti-tablet-${tema === "dark" ? "scuro" : "chiaro"}.png`,
      });
    }
  });
