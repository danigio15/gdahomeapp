/* «Riquadri con l'immagine», nel browser.
 *
 * Si sceglie un disegno dal blocco «Immagine» dell'editor, e il riquadro lo
 * mostra: un posto «A muro» (la luce del tavolo, che col tocco
 * sull'interruttore in vetro si accende come sempre) e un riquadro dei
 * Dispositivi della Home, che il guscio disegna da se' e che qui cambia solo
 * vestito. Su desktop e su telefono. */
import { expect, test } from "@playwright/test";
import { disegnoDaRiquadro } from "../src/core/disegni-da-riquadro.js";
import { STATI_A_MURO, apriLaCasaAMuro } from "./helpers/casa-a-muro.js";

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
});
