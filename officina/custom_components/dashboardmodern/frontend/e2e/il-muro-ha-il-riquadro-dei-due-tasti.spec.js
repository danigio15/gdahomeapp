/* Il riquadro dei due tasti, nel browser.
 *
 * «Se ci fosse un on e off di uno switch che sono due entita' separate, si
 * potrebbe nei riquadri smezzarlo e fare in uno unico on e off? Unico nome,
 * ma con ON e OFF uno a destra e uno a sinistra.» Qui si prova quello che il
 * tablet fa davvero: ogni tasto manda il comando alla sua entita' e non apre
 * la finestra; lo stato, quando c'e' da dove leggerlo, accende il disco e il
 * tasto giusto; senza stato il riquadro dice «Comando» e, premuto, «Inviato»;
 * sul telefono tutto sta dentro il riquadro; nel config il posto diventa «Due
 * tasti» e si salva. */
import { expect, test } from "@playwright/test";
import { STATI_A_MURO, apriLaCasaAMuro } from "./helpers/casa-a-muro.js";

const muro = (page) => page.locator("#dm-muro");
const servizi = (page) => page.evaluate(() => window.__SERVIZI__.slice());

const STATI = {
  ...STATI_A_MURO,
  "button.led_salone_on": { state: "unknown", attributes: { friendly_name: "Led salone ON" } },
  "button.led_salone_off": { state: "unknown", attributes: { friendly_name: "Led salone OFF" } },
  "binary_sensor.led_salone": { state: "off", attributes: { friendly_name: "Led salone" } },
  "switch.led_cucina_on": { state: "on", attributes: { friendly_name: "Led cucina" } },
  "switch.led_cucina_off": { state: "off", attributes: { friendly_name: "Led cucina spento" } },
  "script.tenda_apri": { state: "off", attributes: { friendly_name: "Apri tenda" } },
  "script.tenda_chiudi": { state: "off", attributes: { friendly_name: "Chiudi tenda" } },
};

const MURO = {
  attiva: true,
  pagine: [
    {
      id: "p1",
      modello: "personale",
      titolo: "Luci",
      comandi: [
        {
          tipo: "duetasti",
          nome: "Led salone",
          entita: "button.led_salone_on",
          entitaOff: "button.led_salone_off",
          stato: "binary_sensor.led_salone",
        },
        {
          tipo: "duetasti",
          nome: "Led cucina",
          entita: "switch.led_cucina_on",
          entitaOff: "switch.led_cucina_off",
        },
        {
          tipo: "duetasti",
          nome: "Tenda terrazzo",
          entita: "script.tenda_apri",
          entitaOff: "script.tenda_chiudi",
          disegno: "tapparelle",
        },
        { tipo: "entita", entita: "light.tavolo" },
      ],
    },
  ],
};

const riquadro = (page, nome) => muro(page).locator(".mu-duetasti", { hasText: nome });

test.describe("il riquadro dei due tasti", () => {
  test("con lo stato: Spenta col tasto OFF, ON preme il suo pulsante e diventa Accesa", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await apriLaCasaAMuro(page, testInfo, { muro: MURO, stati: STATI });
    const salone = riquadro(page, "Led salone");
    await expect(salone).toBeVisible();
    await expect(salone.locator(".mu-stato")).toHaveText(/Spenta/i);
    await expect(salone.locator(".mu-tasto-off")).toHaveClass(/\bsi\b/);
    await expect(salone.locator(".mu-tasto-on")).not.toHaveClass(/\bsi\b/);
    await expect(salone.locator(".mu-tasto-on")).toHaveAttribute(
      "aria-label",
      "Accendi Led salone",
    );
    await expect(salone.locator(".mu-tasto-off")).toHaveAttribute(
      "aria-label",
      "Spegni Led salone",
    );
    await expect(salone.locator(".mu-fam-nome")).toHaveText("Led salone");

    await salone.locator(".mu-tasto-on").click();
    expect(await servizi(page)).toEqual([
      { domain: "button", service: "press", data: { entity_id: "button.led_salone_on" } },
    ]);
    /* Il tocco sul tasto non apre la finestra della card. */
    await expect(muro(page).locator(".mu-finestra")).toHaveCount(0);
    await expect(salone.locator(".mu-stato")).toHaveText(/Accesa/i);
    await expect(salone.locator(".mu-disco")).toHaveClass(/\bon\b/);
    await expect(salone.locator(".mu-tasto-on")).toHaveClass(/\bsi\b/);

    /* Lo stato vero arriva dal sensore: spento di nuovo, OFF evidenziato. */
    await salone.locator(".mu-tasto-off").click();
    expect((await servizi(page))[1]).toEqual({
      domain: "button",
      service: "press",
      data: { entity_id: "button.led_salone_off" },
    });
    await expect(salone.locator(".mu-stato")).toHaveText(/Spenta/i);
    await expect(salone.locator(".mu-tasto-off")).toHaveClass(/\bsi\b/);
  });

  test("senza stato: l'interruttore del tasto ON dice lo stato, e i pulsanti dicono Inviato", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await apriLaCasaAMuro(page, testInfo, { muro: MURO, stati: STATI });
    const cucina = riquadro(page, "Led cucina");
    await expect(cucina.locator(".mu-stato")).toHaveText(/Accesa/i);
    await expect(cucina.locator(".mu-tasto-on")).toHaveClass(/\bsi\b/);
    /* OFF accende la sua entita', non spegne quella dell'ON. */
    await cucina.locator(".mu-tasto-off").click();
    expect(await servizi(page)).toEqual([
      { domain: "switch", service: "turn_on", data: { entity_id: "switch.led_cucina_off" } },
    ]);

    const tenda = riquadro(page, "Tenda terrazzo");
    await expect(tenda.locator(".mu-stato")).toHaveText(/Comando/i);
    await expect(tenda.locator(".mu-tasto.si")).toHaveCount(0);
    await tenda.locator(".mu-tasto-on").click();
    expect((await servizi(page))[1]).toEqual({
      domain: "script",
      service: "turn_on",
      data: { entity_id: "script.tenda_apri" },
    });
    await expect(tenda.locator(".mu-stato")).toHaveText(/Inviato/i);
    await expect(tenda.locator(".mu-tasto-on")).toHaveClass(/premuto/);
    await expect(muro(page).locator(".mu-finestra")).toHaveCount(0);
    /* Dopo un paio di secondi torna «Comando». */
    await expect(tenda.locator(".mu-stato")).toHaveText(/Comando/i, { timeout: 4000 });
  });

  test("sul telefono il riquadro sta in piedi: i tasti dentro, il nome coi puntini", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const lungo = structuredClone(MURO);
    lungo.pagine[0].comandi[0].nome = "Led del salone grande accanto alla finestra";
    await apriLaCasaAMuro(page, testInfo, { muro: lungo, stati: STATI });
    for (const carta of await muro(page).locator(".mu-duetasti").all()) {
      await expect(carta).toBeVisible();
      const fuori = await carta.evaluate((c) => {
        const box = c.getBoundingClientRect();
        return [...c.querySelectorAll(".mu-tasto,.mu-fam-nome,.mu-disco")]
          .filter((e) => getComputedStyle(e).display !== "none")
          .filter((e) => {
            const r = e.getBoundingClientRect();
            return (
              r.left < box.left - 0.5 ||
              r.right > box.right + 0.5 ||
              r.top < box.top - 0.5 ||
              r.bottom > box.bottom + 0.5
            );
          })
          .map((e) => e.className);
      });
      expect(fuori).toEqual([]);
      const tasti = await carta
        .locator(".mu-tasto")
        .evaluateAll((t) => t.map((e) => e.getBoundingClientRect().height));
      for (const altezza of tasti) expect(altezza).toBeGreaterThanOrEqual(28);
    }
    const nome = riquadro(page, "Led del salone").locator(".mu-fam-nome");
    expect(await nome.evaluate((n) => n.scrollWidth > n.clientWidth)).toBe(true);
    expect(await nome.evaluate((n) => getComputedStyle(n).textOverflow)).toBe("ellipsis");
  });

  test("nel config il posto diventa «Due tasti: ON e OFF» e si salva", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await apriLaCasaAMuro(page, testInfo, {
      stati: STATI,
      muro: {
        attiva: true,
        pagine: [
          {
            id: "p1",
            modello: "personale",
            comandi: [{ tipo: "entita", entita: "light.tavolo" }],
          },
        ],
      },
    });
    await page.evaluate(() => window.apriConfigEntita());
    await page.locator('.ed-tab[data-tab="muro"]').click();
    const body = page.locator("#ed-body");
    await expect(body.locator(".mu-ed")).toBeVisible();
    const via = "pagine.0.comandi.1";
    await body.locator(`[data-mu-ed-campo="${via}.tipo"]`).selectOption("duetasti");
    /* Le caselle delle entita' diventano le righe «Scegli entità» del config:
     * la casella vera c'e', nascosta, e si scrive come fa la ricerca. */
    await expect(body.locator(`[data-mu-ed-campo="${via}.entitaOff"]`)).toHaveCount(1);
    await body.locator(`[data-mu-ed-campo="${via}.nome"]`).fill("Led salone");
    for (const [campo, valore] of [
      ["entita", "button.led_salone_on"],
      ["entitaOff", "button.led_salone_off"],
      ["stato", "binary_sensor.led_salone"],
    ]) {
      const casella = body.locator(`[data-mu-ed-campo="${via}.${campo}"]`);
      await casella.evaluate((e, v) => {
        e.value = v;
        e.dispatchEvent(new Event("change", { bubbles: true }));
      }, valore);
    }
    await body.locator(`[data-mu-ed-campo="${via}.disegno"]`).selectOption("luci");
    await expect(body.locator(".mu-ed-aiuto")).toContainText("tasto ON");
    await body.locator("[data-dm-save-all]").click();
    const salvato = await page.evaluate(() => JSON.parse(localStorage.getItem("cd_muro")));
    expect(salvato.pagine[0].comandi[1]).toEqual({
      tipo: "duetasti",
      entita: "button.led_salone_on",
      entitaOff: "button.led_salone_off",
      stato: "binary_sensor.led_salone",
      nome: "Led salone",
      sotto: "",
      disegno: "luci",
    });
    /* E tornando a «Entita' o azione» resta il solo tasto ON. */
    await body.locator(`[data-mu-ed-campo="${via}.tipo"]`).selectOption("");
    await expect(body.locator(`[data-mu-ed-campo="${via}.entitaOff"]`)).toHaveCount(0);
    await expect(body.locator(`[data-mu-ed-campo="${via}.entita"]`)).toHaveValue(
      "button.led_salone_on",
    );
  });
});
