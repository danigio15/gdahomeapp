/* La luminosita' dello schermo del tablet a muro (#224).
 *
 * Nella Config: «A muro» → Altre impostazioni → «Luminosita' dello schermo»,
 * spenta di serie, coi tre livelli, il tempo, giorno e notte, e sotto «Chi
 * c'e' vicino» col sensore che prima stava in «Si sveglia da solo». Sul
 * tablet: il pannello dice all'app `luce:<0-100>` e, quando qualcuno arriva,
 * la pillola verde dice chi e' stato. Il canale dell'app qui e' finto: si
 * annota quello che il pannello dice, e risponde come risponderebbe l'app. */
import { expect, test } from "@playwright/test";
import { MURO_DI_PROVA, STATI_A_MURO, apriLaCasaAMuro } from "./helpers/casa-a-muro.js";

const salvato = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("cd_muro") || "null"));
const detti = (page) => page.evaluate(() => window.__SCHERMO__.slice());

/* Il canale dello schermo dell'app, per finta. `capacita` e' quello che il
 * tablet direbbe di avere. */
async function conLApp(page, capacita) {
  await page.addInitScript((capacita) => {
    window.__SCHERMO__ = [];
    window.gdahomeSchermo = {
      postMessage: (detto) => {
        window.__SCHERMO__.push(detto);
        if (detto === "capacita?" && capacita)
          setTimeout(() => {
            window.__GDAHOME_SCHERMO__ = { ...(window.__GDAHOME_SCHERMO__ || {}), capacita };
            window.dispatchEvent(new CustomEvent("gdahome:schermo", { detail: { capacita } }));
          }, 0);
      },
    };
  }, capacita);
}

const cambia = (page, id, valore, attributi = {}) =>
  page.evaluate(
    ([id, valore, attributi]) => {
      eval("_RAW_STATES")[id] = { entity_id: id, state: valore, attributes: attributi };
      window.dispatchEvent(
        new CustomEvent("dashboardmodern:state-changed", { detail: { entity_ids: [id] } }),
      );
    },
    [id, valore, attributi],
  );

/* Il sole: sopra l'orizzonte, o tramontato da un'ora. */
const SOLE_ALTO = {
  state: "above_horizon",
  attributes: { next_setting: new Date(Date.now() + 3 * 3600e3).toISOString() },
};
const tramontoDiDomani = () => new Date(Date.now() - 3600e3 + 24 * 3600e3).toISOString();

test.describe("la luminosita' del tablet a muro", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  test("nella Config: spenta di serie, il sensore di prima resta, e si salva", async ({
    page,
  }, testInfo) => {
    await conLApp(page, { luce: false, prossimita: false, piattaforma: "ios" });
    await apriLaCasaAMuro(page, testInfo, {
      muro: {
        ...MURO_DI_PROVA,
        risveglio: { attivo: true, entita: "binary_sensor.presenza" },
      },
    });
    await page.evaluate(() => window.apriConfigEntita());
    await page.locator('.ed-tab[data-tab="muro"]').click();
    const body = page.locator("#ed-body");
    await body.locator("[data-mu-ed-altro]").click();
    const luce = body.locator("[data-mu-ed-luce]");
    await expect(luce).toContainText("Luminosità dello schermo");
    await expect(body.locator('[data-mu-ed-alterna="luce.attiva"]')).toHaveAttribute(
      "aria-checked",
      "false",
    );
    /* Spenta: niente livelli, ma le fonti di «Chi c'e' vicino» si'. Il
     * sensore di «Si sveglia da solo» e' la prima, acceso com'era. */
    await expect(body.locator('[data-mu-ed-campo="luce.vicino"]')).toHaveCount(0);
    await expect(body.getByText("Si sveglia da solo")).toHaveCount(0);
    const presenza = luce.locator('[data-mu-ed-fonte="presenza"]');
    await expect(presenza.locator('[data-mu-ed-campo="risveglio.entita"]')).toHaveValue(
      "binary_sensor.presenza",
    );
    await expect(presenza.locator('[data-mu-ed-alterna="risveglio.attivo"]')).toHaveAttribute(
      "aria-checked",
      "true",
    );
    /* Il sensore si vede una volta sola, nella casella; sotto la descrizione
     * come sta adesso, col suo nome e non con l'entita'. */
    const stato = presenza.locator("[data-mu-ed-stato-sensore]");
    await expect(stato).toHaveText("Presenza ingresso · nessuno");
    await expect(presenza.locator(".mu-ed-testo")).not.toContainText("binary_sensor.");
    /* L'app ha detto che e' un iPad: niente prossimita', niente luce della
     * stanza. */
    expect(await detti(page)).toContain("capacita?");
    const prossimita = luce.locator('[data-mu-ed-fonte="prossimita"]');
    await expect(prossimita).toContainText("Sull'iPad non c'è.");
    await expect(prossimita.locator("[data-mu-ed-alterna]")).toHaveCount(0);

    await body.locator('[data-mu-ed-alterna="luce.attiva"]').click();
    await expect(body.locator('[data-mu-ed-campo="luce.vicino"]')).toHaveValue("90");
    await expect(body.locator('[data-mu-ed-campo="luce.riposo"]')).toHaveValue("20");
    await expect(body.locator('[data-mu-ed-campo="luce.notte"]')).toHaveValue("3");
    await expect(
      body.locator('[data-mu-ed-metti="luce.giorno"][data-mu-ed-valore="stanza"]'),
    ).toBeDisabled();
    await expect(luce).toContainText("Sull'iPad la luce della stanza non si legge");
    await expect(luce.locator(".mu-ed-giornata svg path.luce")).toHaveCount(1);
    /* Il disegno prende tutta la larghezza della scheda, meno la colonna
     * delle percentuali. */
    const larghezze = await luce.locator(".mu-ed-giornata").evaluate((g) => ({
      scheda: g.clientWidth,
      disegno: g.querySelector("svg").getBoundingClientRect().width,
    }));
    expect(larghezze.disegno).toBeGreaterThan(larghezze.scheda * 0.85);
    /* Il cursore scrive al rilascio, e il numero accanto segue il dito. */
    await body.locator('[data-mu-ed-campo="luce.notte"]').evaluate((cursore) => {
      cursore.value = "0";
      cursore.dispatchEvent(new Event("input", { bubbles: true }));
      cursore.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await expect(
      body.locator('[data-mu-ed-campo="luce.notte"]').locator("xpath=..").locator("b"),
    ).toHaveText("0%");
    await body.locator('[data-mu-ed-campo="luce.dopo"]').selectOption("120");
    await body.locator('[data-mu-ed-metti="luce.giorno"][data-mu-ed-valore="orario"]').click();
    /* Con l'orario, le due ore della notte stanno anche qui. */
    await expect(luce.locator('[data-mu-ed-campo="notte.da"]')).toHaveValue("23:00");
    await body.locator("[data-dm-save-all]").click();
    const muro = await salvato(page);
    expect(muro.luce).toEqual({
      attiva: true,
      vicino: 90,
      riposo: 20,
      notte: 0,
      dopo: 120,
      giorno: "orario",
      prossimita: false,
    });
    expect(muro.risveglio).toEqual({ attivo: true, entita: "binary_sensor.presenza" });
  });

  test("su Android la prossimita' si accende, e la luce della stanza si sceglie", async ({
    page,
  }, testInfo) => {
    await conLApp(page, { luce: true, prossimita: true, piattaforma: "android" });
    await apriLaCasaAMuro(page, testInfo, { muro: { ...MURO_DI_PROVA, luce: { attiva: true } } });
    await page.evaluate(() => window.apriConfigEntita());
    await page.locator('.ed-tab[data-tab="muro"]').click();
    const body = page.locator("#ed-body");
    await body.locator("[data-mu-ed-altro]").click();
    const luce = body.locator("[data-mu-ed-luce]");
    await expect(luce.locator('[data-mu-ed-fonte="prossimita"]')).toContainText(
      "Questo tablet ce l'ha.",
    );
    await body.locator('[data-mu-ed-metti="luce.giorno"][data-mu-ed-valore="stanza"]').click();
    await expect(luce).toContainText("Col sensore di luce di questo tablet");
    await body.locator('[data-mu-ed-alterna="luce.prossimita"]').click();
    await body.locator("[data-dm-save-all]").click();
    expect((await salvato(page)).luce).toMatchObject({ giorno: "stanza", prossimita: true });
  });

  test("sul tablet: piena al tocco, bassa a riposo, quasi niente di notte, e chi arriva la rialza", async ({
    page,
  }, testInfo) => {
    await conLApp(page, null);
    await apriLaCasaAMuro(page, testInfo, {
      muro: {
        ...MURO_DI_PROVA,
        risveglio: { attivo: true, entita: "binary_sensor.presenza" },
        luce: { attiva: true, vicino: 90, riposo: 20, notte: 3, dopo: 15, prossimita: true },
      },
      stati: { ...STATI_A_MURO, "sun.sun": SOLE_ALTO },
    });
    const muro = page.locator("#dm-muro");
    await expect(muro.locator(".mu-testa")).toBeVisible();
    /* Appena acceso e' come un tocco: piena. E il pannello chiede all'app il
     * sensore di prossimita', che e' acceso fra le fonti. */
    await expect.poll(() => detti(page)).toContain("luce:90");
    const tutti = await detti(page);
    expect(tutti.indexOf("muro:si")).toBeLessThan(tutti.indexOf("luce:90"));
    expect(tutti).toContain("sensori:prossimita");
    /* Nessuno vicino da un po': a riposo di giorno. */
    const passaIlTempo = () =>
      page.evaluate(() => {
        window.__DASHBOARDMODERN_PLANCIA_A_MURO__.toccato = Date.now() - 60_000;
        window.dmMuro.rileggi();
      });
    await passaIlTempo();
    await expect.poll(() => detti(page)).toContain("luce:20");
    /* Il sole e' tramontato da un'ora: notte. */
    await cambia(page, "sun.sun", "below_horizon", { next_setting: tramontoDiDomani() });
    await passaIlTempo();
    await expect.poll(() => detti(page)).toContain("luce:3");
    expect(await detti(page)).not.toContain("spento:si");
    /* Qualcuno arriva: il sensore di presenza di casa la rialza, e la
     * pillola dice per due secondi chi e' stato. */
    await page.evaluate(() => window.dmMuro.riposa());
    await cambia(page, "binary_sensor.presenza", "on", { friendly_name: "Presenza ingresso" });
    const pillola = muro.locator(".mu-luce-pillola");
    await expect(pillola).toHaveText("Qualcuno vicino · Presenza ingresso · 90%");
    await expect(muro.locator(".mu-riposo")).toHaveCount(0);
    /* In alto al centro, appena sotto la testa: in basso copriva una card. */
    const dove = await muro.evaluate((m) => {
      const p = m.querySelector(".mu-luce-pillola").getBoundingClientRect();
      const testa = m.querySelector(".mu-testa").getBoundingClientRect();
      return { sopra: p.top - testa.bottom, centro: p.left + p.width / 2 - innerWidth / 2 };
    });
    expect(dove.sopra).toBeGreaterThan(0);
    expect(dove.sopra).toBeLessThan(30);
    expect(Math.abs(dove.centro)).toBeLessThan(2);
    expect((await detti(page)).at(-1)).toBe("luce:90");
    await expect(pillola).toHaveCount(0, { timeout: 4000 });
    /* Se ne va: dopo il tempo scelto si riabbassa. */
    await cambia(page, "binary_sensor.presenza", "off", { friendly_name: "Presenza ingresso" });
    await passaIlTempo();
    await expect.poll(async () => (await detti(page)).at(-1)).toBe("luce:3");
    /* La mano vicino allo schermo: il sensore di prossimita' del tablet. */
    await page.evaluate(() => {
      window.dmMuro.riposa();
      window.__GDAHOME_SCHERMO__ = { prossimita: "si" };
      window.dispatchEvent(new CustomEvent("gdahome:schermo", { detail: { prossimita: "si" } }));
    });
    await expect(pillola).toContainText("prossimità del tablet");
    await expect(muro.locator(".mu-riposo")).toHaveCount(0);
    /* Spento il pannello lo schermo torna del sistema e i sensori si fermano. */
    await page.evaluate(() => window.dmMuro.esci());
    await expect.poll(() => detti(page)).toContain("luce:no");
    expect(await detti(page)).toContain("sensori:no");
  });

  test("di notte lo 0% e' lo schermo nero", async ({ page }, testInfo) => {
    await conLApp(page, null);
    await apriLaCasaAMuro(page, testInfo, {
      muro: { ...MURO_DI_PROVA, luce: { attiva: true, notte: 0, dopo: 15 } },
      stati: {
        ...STATI_A_MURO,
        "sun.sun": { state: "below_horizon", attributes: { next_setting: tramontoDiDomani() } },
      },
    });
    const muro = page.locator("#dm-muro");
    await expect(muro.locator(".mu-testa")).toBeVisible();
    await page.evaluate(() => {
      window.__DASHBOARDMODERN_PLANCIA_A_MURO__.toccato = Date.now() - 60_000;
      window.dmMuro.rileggi();
    });
    await expect(muro.locator(".mu-riposo.notte")).toBeVisible();
    await expect.poll(async () => (await detti(page)).at(-1)).toBe("luce:0");
  });
});
