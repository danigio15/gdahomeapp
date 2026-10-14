/* «Sull'audio hai guardato perche' non prende le aggiunte dei sensor. e
 * remote.?»
 *
 * Chi installa l'audio di una sala ha in Home Assistant anche i sensori del
 * livello e i telecomandi (`remote.*`) degli amplificatori e dei processori.
 * Il pannello a muro li lasciava cadere due volte: nella pagina Musica, dove
 * le «Altre letture» e il «Telecomando» scelti nella sezione Musica non
 * comparivano, e nel mixer, che accettava solo lettori e numeri.
 *
 * Qui si pretende quello che si vede e si tocca: la lettura col suo numero,
 * il telecomando che si accende e manda il suo comando, il canale-sensore che
 * si guarda e non si trascina, il canale-telecomando coi suoi ▲ / ▼, e nel
 * config i campi dei comandi quando si sceglie un telecomando.
 */
import { expect, test } from "@playwright/test";
import { STATI_DELLA_REGIA, apriLaCasaAMuro } from "./helpers/casa-a-muro.js";

const muro = (page) => page.locator("#dm-muro");
const servizi = (page) => page.evaluate(() => window.__SERVIZI__.slice());

const STATI = {
  ...STATI_DELLA_REGIA,
  "sensor.uscita_sala_livello": {
    state: "-18.5",
    attributes: { friendly_name: "Uscita sala", unit_of_measurement: "dB" },
  },
  "remote.amplificatore": { state: "on", attributes: { friendly_name: "Amplificatore" } },
  "sensor.amplificatore_volume": {
    state: "42",
    attributes: { friendly_name: "Amplificatore volume", unit_of_measurement: "%" },
  },
  "media_player.sala": {
    state: "playing",
    attributes: {
      friendly_name: "Sala",
      media_title: "Brano di prova",
      volume_level: 0.4,
      supported_features: 4 + 8 + 1 + 16384,
    },
  },
  "select.sala_equalizzatore": {
    state: "Voce",
    attributes: { friendly_name: "Sala equalizzatore", options: ["Voce", "Musica"] },
  },
};

const MIXER = {
  attiva: true,
  tema: "scuro",
  pagine: [
    {
      id: "audio",
      modello: "mixer",
      mixer: {
        gruppi: [
          {
            nome: "Sala",
            canali: [
              { entita: "number.mic_1", nome: "Mic 1", muto: "switch.mic_1_muto" },
              { entita: "sensor.uscita_sala_livello", nome: "Uscita sala" },
              {
                entita: "remote.amplificatore",
                nome: "Amplificatore",
                letto: "sensor.amplificatore_volume",
                suComando: "VOL_UP",
                dispositivo: "Ampli",
              },
            ],
          },
        ],
        master: { entita: "remote.amplificatore", nome: "Totale" },
      },
    },
  ],
};

test.describe("la regia prende i sensori e i telecomandi", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("la pagina Musica mostra le altre letture e il telecomando scelti nella sezione Musica", async ({
    page,
  }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, {
      muro: { attiva: true, pagine: [{ id: "m1", modello: "musica" }] },
      stati: STATI,
      caselle: {
        cd_media_player: [
          {
            entity: "media_player.sala",
            nome: "Sala",
            telecomando: "remote.amplificatore",
            comandi: ["remote.amplificatore:volume_up"],
            letture: ["sensor.uscita_sala_livello", "select.sala_equalizzatore"],
          },
        ],
      },
    });
    const letture = muro(page).locator(".mu-mp-lettura");
    await expect(letture).toHaveCount(2);
    await expect(letture.first()).toContainText("Uscita sala");
    await expect(letture.first()).toContainText("-18,5 dB");
    await expect(letture.nth(1)).toContainText("Voce");
    const comandi = muro(page).locator('.mu-mp-comandi [data-mu-fa="mp-accanto"]');
    await expect(comandi).toHaveCount(2);
    /* Il telecomando che la plancia non sa usare con le frecce: si accende e
     * si spegne. Accanto, il suo comando scritto. */
    await expect(comandi.first()).toHaveAttribute("aria-pressed", "true");
    await expect(comandi.nth(1)).toContainText("volume_up");
    await comandi.nth(1).click();
    await comandi.first().click();
    await expect
      .poll(() => servizi(page))
      .toEqual([
        {
          domain: "remote",
          service: "send_command",
          data: { entity_id: "remote.amplificatore", command: "volume_up" },
        },
        { domain: "remote", service: "toggle", data: { entity_id: "remote.amplificatore" } },
      ]);
  });

  test("il mixer: il sensore si guarda, il telecomando manda ▲ ▼ e il muto", async ({
    page,
  }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, { muro: MIXER, stati: STATI });
    const uscita = muro(page).locator('[data-mu-canale="sensor.uscita_sala_livello"]');
    await expect(uscita.locator(".mu-can-v")).toHaveText("-18,5 dB");
    /* Uno strumento, non un cursore: niente manopola, niente dito. */
    await expect(uscita.locator(".mu-metro")).toHaveAttribute("role", "meter");
    await expect(uscita.locator("[data-mu-cursore]")).toHaveCount(0);
    await expect(uscita.locator(".mu-can-muto.vuoto")).toHaveCount(1);
    const ampli = muro(page).locator('.mu-canale[data-mu-canale="remote.amplificatore"]');
    await expect(ampli.locator(".mu-can-v")).toHaveText("42 %");
    await expect(ampli.locator(".mu-metro")).toHaveCount(1);
    await ampli.locator('[data-mu-fa="passo"][data-mu-verso="su"]').click();
    await ampli.locator('[data-mu-fa="passo"][data-mu-verso="giu"]').click();
    await ampli.locator(".mu-can-muto").click();
    const master = muro(page).locator(".mu-mix-master");
    await master.locator('[data-mu-fa="passo"][data-mu-verso="su"]').click();
    await expect
      .poll(async () => (await servizi(page)).map((s) => s.data.command))
      .toEqual(["VOL_UP", "volume_down", "mute", "volume_up"]);
    const fatti = await servizi(page);
    expect(fatti[0]).toEqual({
      domain: "remote",
      service: "send_command",
      data: { entity_id: "remote.amplificatore", command: "VOL_UP", device: "Ampli" },
    });
    /* Il master scritto senza comandi ha quelli di sempre, e nessun device. */
    expect(fatti[3].data).toEqual({ entity_id: "remote.amplificatore", command: "volume_up" });
    if (process.env.DM_FOTO)
      await page.screenshot({ path: `${process.env.DM_FOTO}/mixer-sensori-telecomandi.png` });
  });

  test("nel config un canale-telecomando chiede i suoi comandi, un canale-sensore la scala", async ({
    page,
  }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, { muro: MIXER, stati: STATI });
    await page.evaluate(() => window.apriConfigEntita());
    await page.locator('.ed-tab[data-tab="muro"]').click();
    const body = page.locator("#ed-body");
    const campo = (via) => body.locator(`[data-mu-ed-campo="${via}"]`);
    const canale = "pagine.0.mixer.gruppi.0.canali";
    await expect(campo(`${canale}.2.suComando`)).toHaveValue("VOL_UP");
    await expect(campo(`${canale}.2.giuComando`)).toHaveValue("volume_down");
    await expect(campo(`${canale}.2.mutoComando`)).toHaveValue("mute");
    await expect(campo(`${canale}.2.dispositivo`)).toHaveValue("Ampli");
    await expect(campo(`${canale}.1.min`)).toBeVisible();
    await expect(campo(`${canale}.1.letto`)).toHaveCount(0, { timeout: 1000 });
    await expect(campo(`${canale}.0.suComando`)).toHaveCount(0);
    await expect(campo(`${canale}.0.letto`)).toHaveCount(1);
    /* Un comando scritto resta, e arriva al tablet dopo «Salva». */
    await campo(`${canale}.2.giuComando`).fill("VOL_DOWN");
    await campo(`${canale}.2.giuComando`).dispatchEvent("change");
    await body.locator("[data-dm-save-all]").click();
    await expect
      .poll(() =>
        page.evaluate(
          () => JSON.parse(localStorage.getItem("cd_muro")).pagine[0].mixer.gruppi[0].canali[2],
        ),
      )
      .toMatchObject({ entita: "remote.amplificatore", giuComando: "VOL_DOWN" });
    if (process.env.DM_FOTO) {
      await body.locator(".mu-ed-posto.pieno").nth(1).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${process.env.DM_FOTO}/editor-canali.png` });
    }
  });
});
