/* «Questa pagina, ci metterei piu' cose di scelta.»
 *
 * L'Ingresso del pannello a muro mostrava una centrale sola, mentre sul
 * telefono la sezione Sicurezza ha le sue aree. E sotto l'antifurto mancava
 * quello che si guarda prima di uscire: «tipo se ci sono finestre aperte.
 * Magari allo stesso modo come sull'audio».
 *
 * Qui si pretende: tutte le aree della plancia, ognuna col suo stato e i suoi
 * tasti, ognuna col suo codice quando la centrale lo chiede; le altre letture
 * con le finestre in un conto solo, «Finestre aperte: 2», che al tocco le
 * elenca; gli altri comandi che fanno il loro gesto; e nel config le righe
 * che lo scrivono.
 */
import { expect, test } from "@playwright/test";
import { SEME_A_MURO, STATI_A_MURO, apriLaCasaAMuro } from "./helpers/casa-a-muro.js";

const muro = (page) => page.locator("#dm-muro");
const servizi = (page) => page.evaluate(() => window.__SERVIZI__.slice());

const centrale = (stato, nome, extra = {}) => ({
  state: stato,
  attributes: {
    friendly_name: nome,
    supported_features: 1 + 2 + 4,
    code_format: "number",
    code_arm_required: true,
    ...extra,
  },
});

const STATI = {
  ...STATI_A_MURO,
  "alarm_control_panel.perimetrale": centrale("armed_away", "Perimetrale"),
  "alarm_control_panel.interno": centrale("disarmed", "Interno"),
  /* Il garage non ha codice e sa solo «Fuori». */
  "alarm_control_panel.garage": centrale("arming", "Garage", {
    supported_features: 2,
    code_format: null,
  }),
  "binary_sensor.finestra_cucina": {
    state: "on",
    attributes: { friendly_name: "Finestra cucina", device_class: "window" },
  },
  "binary_sensor.finestra_bagno": {
    state: "on",
    attributes: { friendly_name: "Finestra bagno", device_class: "window" },
  },
  "binary_sensor.finestra_camera": {
    state: "off",
    attributes: { friendly_name: "Finestra camera", device_class: "window" },
  },
  "sensor.temperatura_ingresso": {
    state: "19.4",
    attributes: { friendly_name: "Temperatura ingresso", unit_of_measurement: "°C" },
  },
  "lock.porta_ingresso": { state: "locked", attributes: { friendly_name: "Porta ingresso" } },
  "remote.cancellino": { state: "on", attributes: { friendly_name: "Cancellino" } },
  "switch.luce_vialetto": { state: "off", attributes: { friendly_name: "Luce vialetto" } },
};

const area = (id, nome, entita) => ({
  id,
  nome,
  caselle: { "dm.security_centrale_allarme": entita },
});
const CASELLE = {
  cd_centrali: [
    area("a1", "Perimetrale", "alarm_control_panel.perimetrale"),
    area("a2", "Interno", "alarm_control_panel.interno"),
    area("a3", "Garage", "alarm_control_panel.garage"),
  ],
  cd_entity_overrides: { "dm.security_centrale_allarme": "alarm_control_panel.perimetrale" },
};
const SEME = {
  ...SEME_A_MURO,
  sections: {
    ...SEME_A_MURO.sections,
    entityOverrides: { "dm.security_centrale_allarme": "alarm_control_panel.perimetrale" },
  },
};

const MURO = (ingresso = {}) => ({
  attiva: true,
  pagine: [
    {
      id: "ing",
      modello: "ingresso",
      ingresso: { telecamera: "camera.cancello", apri: "button.apri_cancello", ...ingresso },
    },
  ],
});

const apri = (page, testInfo, ingresso) =>
  apriLaCasaAMuro(page, testInfo, {
    muro: MURO(ingresso),
    stati: STATI,
    seme: SEME,
    caselle: CASELLE,
  });

async function scriviIlCodice(page, codice) {
  await expect(muro(page).locator(".mu-fin-codice")).toBeVisible();
  for (const k of [...codice, "✓"]) await muro(page).locator(`[data-mu-cifra="${k}"]`).click();
  await expect(muro(page).locator(".mu-fin-codice")).toHaveCount(0);
}

test.describe("l'ingresso ha le partizioni e le altre letture", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("tutte le aree della plancia, ognuna coi suoi tasti e il suo codice", async ({
    page,
  }, testInfo) => {
    await apri(page, testInfo);
    const aree = muro(page).locator(".mu-area");
    await expect(aree).toHaveCount(3);
    await expect(aree.locator(".mu-area-nome")).toHaveText(["Perimetrale", "Interno", "Garage"]);
    await expect(aree.locator(".mu-area-stato")).toHaveText([
      /Fuori/i,
      /Disattivo/i,
      /Inserimento/i,
    ]);
    await expect(muro(page).locator(".mu-stato-allarme")).toHaveText("1 di 3 inserite");
    const tasti = (entita) =>
      muro(page).locator(`.mu-area[data-mu-area="${entita}"] [data-mu-fa="allarme"]`);
    await expect(tasti("alarm_control_panel.interno")).toHaveText([
      "Casa",
      "Fuori",
      "Notte",
      "Sblocca",
    ]);
    await expect(tasti("alarm_control_panel.garage")).toHaveText(["Fuori", "Sblocca"]);
    await expect(
      muro(page).locator('[data-mu-area="alarm_control_panel.perimetrale"] [data-mu-modo="away"]'),
    ).toHaveClass(/si/);

    /* Ogni tasto va alla sua area, col codice quando la centrale lo chiede. */
    await muro(page)
      .locator('[data-mu-area="alarm_control_panel.interno"] [data-mu-modo="home"]')
      .click();
    await scriviIlCodice(page, "1234");
    await muro(page)
      .locator('[data-mu-area="alarm_control_panel.interno"] [data-mu-modo="night"]')
      .click();
    await scriviIlCodice(page, "4321");
    await muro(page)
      .locator('[data-mu-area="alarm_control_panel.perimetrale"] [data-mu-modo="disarm"]')
      .click();
    await scriviIlCodice(page, "1111");
    /* Il garage non ha codice: parte subito. */
    await muro(page)
      .locator('[data-mu-area="alarm_control_panel.garage"] [data-mu-modo="away"]')
      .click();
    await muro(page)
      .locator('[data-mu-area="alarm_control_panel.perimetrale"] [data-mu-modo="away"]')
      .click();
    await scriviIlCodice(page, "2222");
    await expect
      .poll(() => servizi(page))
      .toEqual([
        {
          domain: "alarm_control_panel",
          service: "alarm_arm_home",
          data: { entity_id: "alarm_control_panel.interno", code: "1234" },
        },
        {
          domain: "alarm_control_panel",
          service: "alarm_arm_night",
          data: { entity_id: "alarm_control_panel.interno", code: "4321" },
        },
        {
          domain: "alarm_control_panel",
          service: "alarm_disarm",
          data: { entity_id: "alarm_control_panel.perimetrale", code: "1111" },
        },
        {
          domain: "alarm_control_panel",
          service: "alarm_arm_away",
          data: { entity_id: "alarm_control_panel.garage" },
        },
        {
          domain: "alarm_control_panel",
          service: "alarm_arm_away",
          data: { entity_id: "alarm_control_panel.perimetrale", code: "2222" },
        },
      ]);
  });

  test("le aree scelte nella pagina, nel loro ordine; la centrale di prima resta una", async ({
    page,
  }, testInfo) => {
    await apri(page, testInfo, {
      aree: ["alarm_control_panel.garage", "alarm_control_panel.interno"],
    });
    await expect(muro(page).locator(".mu-area-nome")).toHaveText(["Garage", "Interno"]);
    await apri(page, testInfo, { centrale: "alarm_control_panel.interno" });
    await expect(muro(page).locator(".mu-area")).toHaveCount(0);
    await expect(muro(page).locator(".mu-stato-allarme")).toHaveText(/Disattivo/i);
    await expect(muro(page).locator('.mu-modi [data-mu-fa="allarme"]')).toHaveText([
      "Casa",
      "Fuori",
      "Notte",
      "Sblocca",
    ]);
  });

  test("le altre letture: le finestre in un conto, un tocco le elenca; i comandi fanno il loro gesto", async ({
    page,
  }, testInfo) => {
    await apri(page, testInfo, {
      letture: [
        "binary_sensor.finestra_cucina",
        "binary_sensor.finestra_bagno",
        "binary_sensor.finestra_camera",
        "sensor.temperatura_ingresso",
      ],
      comandi: ["lock.porta_ingresso", "remote.cancellino:apri", "switch.luce_vialetto"],
    });
    const conto = muro(page).locator(".mu-ing-conto");
    await expect(conto).toHaveText(/Finestre aperte:\s*2/);
    await expect(conto).toHaveClass(/guarda/);
    await expect(
      muro(page).locator('.mu-ing-lettura[data-mu-entita="sensor.temperatura_ingresso"]'),
    ).toContainText("19,4 °C");
    /* Chi ha scelto le sue finestre le vede nel conto, non due volte. */
    await expect(muro(page).locator(".mu-avviso-finestre")).toHaveCount(0);
    /* «Ricordati di mettere le finestre sul riquadro antifurto»: le letture
     * stanno dentro la sua card, non nella striscia in fondo. */
    await expect(muro(page).locator(".mu-allarme .mu-allarme-letture .mu-ing-lettura")).toHaveCount(
      2,
    );
    await expect(muro(page).locator(".mu-ing-striscia .mu-ing-lettura")).toHaveCount(0);
    if (process.env.DM_FOTO)
      await page.screenshot({
        path: `${process.env.DM_FOTO}/ingresso-finestre-nell-antifurto.png`,
      });
    await conto.click();
    const righe = muro(page).locator(".mu-ing-riga");
    await expect(righe).toHaveCount(3);
    await expect(righe.first()).toHaveClass(/guarda/);
    await expect(
      muro(page).locator('[data-mu-lettura="binary_sensor.finestra_camera"]'),
    ).toContainText("Chiusa");
    await muro(page).locator('.mu-finestra [data-mu-fa="chiudi"]').click();
    const comandi = muro(page).locator('.mu-ing-comando[data-mu-fa="ing-comando"]');
    await expect(comandi).toHaveCount(3);
    await expect(comandi.first()).toContainText("Porta ingresso");
    await expect(comandi.first()).toContainText("Chiusa");
    await expect(comandi.nth(1)).toContainText("Cancellino · apri");
    await comandi.first().click();
    await comandi.nth(1).click();
    await comandi.nth(2).click();
    await expect
      .poll(() => servizi(page))
      .toEqual([
        { domain: "lock", service: "unlock", data: { entity_id: "lock.porta_ingresso" } },
        {
          domain: "remote",
          service: "send_command",
          data: { entity_id: "remote.cancellino", command: "apri" },
        },
        { domain: "switch", service: "toggle", data: { entity_id: "switch.luce_vialetto" } },
      ]);
  });

  test("sul pannello piccolo le aree e le letture stanno nella finestra dell'antifurto", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 800, height: 480 });
    await apri(page, testInfo, {
      letture: ["binary_sensor.finestra_cucina", "binary_sensor.finestra_bagno"],
    });
    await expect(
      muro(page).locator('[data-mu-fa="ing-lettura"][data-mu-gruppo="1"]'),
    ).toContainText("2");
    await muro(page).locator('[data-mu-fa="finestra-antifurto"]').click();
    await expect(muro(page).locator(".mu-finestra .mu-area")).toHaveCount(3);
    await expect(muro(page).locator(".mu-finestra .mu-ing-conto")).toHaveText(
      /Finestre aperte:\s*2/,
    );
    await muro(page)
      .locator('.mu-finestra [data-mu-area="alarm_control_panel.garage"] [data-mu-modo="disarm"]')
      .click();
    await expect
      .poll(() => servizi(page))
      .toEqual([
        {
          domain: "alarm_control_panel",
          service: "alarm_disarm",
          data: { entity_id: "alarm_control_panel.garage" },
        },
      ]);
  });

  test("nel config: le partizioni, le altre letture e gli altri comandi si scrivono e si salvano", async ({
    page,
  }, testInfo) => {
    await apri(page, testInfo, { centrale: "alarm_control_panel.interno" });
    await page.evaluate(() => window.apriConfigEntita());
    await page.locator('.ed-tab[data-tab="muro"]').click();
    const body = page.locator("#ed-body");
    const campo = (via) => body.locator(`[data-mu-ed-campo="${via}"]`);
    const via = "pagine.0.ingresso";
    /* La centrale di prima e' la prima partizione; sotto, il posto per un'altra. */
    await expect(campo(`${via}.aree.0`)).toHaveValue("alarm_control_panel.interno");
    await expect(campo(`${via}.aree.1`)).toHaveValue("");
    /* Le caselle entita' stanno dietro la riga «Scegli entità»: si scrive
     * come scrive la ricerca del config, il valore e poi «change». */
    const scrivi = (dove, valore) =>
      campo(dove).evaluate((casella, scritto) => {
        casella.value = scritto;
        casella.dispatchEvent(new Event("change", { bubbles: true }));
      }, valore);
    await scrivi(`${via}.aree.1`, "alarm_control_panel.garage");
    await body
      .locator(`[data-mu-ed-sposta="${via}.aree"][data-mu-ed-da="1"][data-mu-ed-verso="-1"]`)
      .click();
    await expect(campo(`${via}.aree.0`)).toHaveValue("alarm_control_panel.garage");
    await scrivi(`${via}.letture.0`, "binary_sensor.finestra_cucina");
    await scrivi(`${via}.letture.1`, "binary_sensor.finestra_bagno");
    await scrivi(`${via}.comandi.0`, "remote.cancellino:apri");
    await body.locator("[data-dm-save-all]").click();
    await expect
      .poll(() =>
        page.evaluate(() => JSON.parse(localStorage.getItem("cd_muro")).pagine[0].ingresso),
      )
      .toMatchObject({
        centrale: "",
        aree: ["alarm_control_panel.garage", "alarm_control_panel.interno"],
        letture: ["binary_sensor.finestra_cucina", "binary_sensor.finestra_bagno"],
        comandi: ["remote.cancellino:apri"],
      });
    /* Svuotate le partizioni, la pagina torna a tutte quelle della plancia. */
    await scrivi(`${via}.aree.1`, "");
    await scrivi(`${via}.aree.0`, "");
    await expect(campo(`${via}.aree.0`)).toHaveValue("");
    await expect(body).toContainText("Perimetrale, Interno, Garage");
  });
});
