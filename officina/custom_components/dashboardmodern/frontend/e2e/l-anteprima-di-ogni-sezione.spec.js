/* L'anteprima del Config, sezione per sezione (#379).
 *
 * «Sì va bene così, fallo per tutte le sezioni.» Ogni scheda del Config che ha
 * una pagina con riquadri, elenchi o disegni da spostare ha la sua anteprima.
 * Qui, nella casa demo, per ognuna: si apre l'anteprima del computer, la
 * modifica dentro e' accesa sulla pagina giusta, si sposta qualcosa dalla
 * tastiera (il primo riquadro sotto il secondo, o un pezzo di un disegno a
 * destra), la barra conta la modifica e Salva la scrive nella configurazione
 * vera — quella della plancia di fuori.
 */
import { expect, test } from "@playwright/test";
import { nellaCasaDemo } from "./helpers/casa-demo.js";

test.use({ timezoneId: "Europe/Rome", locale: "it-IT" });
test.skip(({ isMobile }) => isMobile, "il Config sul computer");

/* La scheda, la pagina che mostra, e cosa ci si sposta. */
const SEZIONI = [
  ["sez2", "ev", "elenco"],
  ["ups", "ups", "disegno"],
  ["sez9", "clima", "elenco"],
  ["sez7", "temp", "elenco"],
  ["sez3", "boiler", "disegno"],
  ["sez3", "boiler", "elenco"],
  ["pool", "piscina", "elenco"],
  ["irr", "irrigazione", "disegno"],
  ["irr", "irrigazione", "elenco"],
  ["contatori", "contatori", "elenco"],
  ["stanze", "stanze", "elenco"],
  ["luci", "luci", "elenco"],
  ["tapp", "tapparelle", "elenco"],
  ["appliances", "appliances-main", "elenco"],
  ["media", "media", "elenco"],
  ["sport", "sport", "elenco"],
  ["robot", "robot", "elenco"],
  ["animali", "animali", "elenco"],
  ["batterie", "batterie", "elenco"],
  ["salute", "salute", "elenco"],
  ["prese", "prese", "elenco"],
  ["varchi", "varchi", "elenco"],
  ["presenza", "presenza", "elenco"],
  ["doors", "porte", "elenco"],
  ["agenda", "calendario", "elenco"],
  ["rifiuti", "rifiuti", "elenco"],
  ["sez6", "server", "elenco"],
];

const scritta = (page, chiave) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "{}"), chiave);

async function lAnteprima(page, scheda) {
  await page.evaluate(() => apriConfigEntita());
  await page
    .locator(`.ed-tab[data-tab="${scheda}"]`)
    .first()
    .evaluate((b) => b.click());
  const pannello = page.locator("[data-dm-anteprima-pannello]");
  await expect(pannello).toBeVisible({ timeout: 20_000 });
  await pannello.locator('[data-dm-ant-dispositivo="computer"]').click();
  await expect
    .poll(() => page.evaluate(() => window.dmAnteprimaDellaPlancia.stato().pronta), {
      timeout: 90_000,
    })
    .toBe(true);
  const dentro = await (await page.locator("iframe.dm-ant-cornice").elementHandle()).contentFrame();
  return { pannello, dentro };
}

for (const [scheda, pagina, cosa] of SEZIONI) {
  test(`${pagina}: nell'anteprima del Config ${cosa === "disegno" ? "un pezzo del disegno" : "un riquadro"} si sposta e Salva lo scrive`, async ({
    page,
  }) => {
    test.setTimeout(150_000);
    await nellaCasaDemo(page);
    const { pannello, dentro } = await lAnteprima(page, scheda);
    await expect(dentro.locator("html")).toHaveAttribute("data-dm-modifica", pagina);
    await expect(dentro.locator(`#page-${pagina}`)).toHaveClass(/active/);

    if (cosa === "disegno") {
      const maniglia = dentro.locator("[data-dm-disegno-strato] [data-dm-disegno-nodo]").first();
      await expect(maniglia).toBeAttached({ timeout: 20_000 });
      const disegno = await maniglia.evaluate((el) =>
        el.closest("[data-dm-disegno-strato]").getAttribute("data-dm-disegno-strato"),
      );
      await maniglia.focus();
      for (let i = 0; i < 4; i += 1) await page.keyboard.press("ArrowRight");
      await expect(pannello.locator(".dm-ant-conta")).toContainText("1 modifica");
      await pannello.locator('[data-dm-ant-azione="salva"]').click();
      await expect
        .poll(async () => Object.keys(await scritta(page, "cd_disegni")))
        .toContain(`${disegno}:computer`);
      return;
    }

    /* Il primo elenco con almeno due voci: i riquadri della pagina, se ce ne
     * sono due, se no il primo elenco dentro. */
    await expect
      .poll(() =>
        dentro.evaluate(() => window.dmDisposizione.elenchi().some((e) => e.voci.length >= 2)),
      )
      .toBe(true);
    const elenco = await dentro.evaluate((p) => {
      const tutti = window.dmDisposizione.elenchi().filter((e) => e.voci.length >= 2);
      return tutti.find((e) => e.chiave === p) || tutti[0];
    }, pagina);
    const [primo, secondo] = elenco.voci;
    const voce = dentro.locator(
      `[data-dm-disp-elenco="${elenco.chiave}"] > [data-dm-disp-voce="${primo}"]`,
    );
    const presa = (await voce.locator(":scope > [data-dm-disp-ctrl] [data-dm-maniglia]").count())
      ? voce.locator(":scope > [data-dm-disp-ctrl] [data-dm-maniglia]")
      : voce;
    await presa.focus();
    await page.keyboard.press("ArrowDown");
    await expect
      .poll(() =>
        dentro.evaluate(
          (k) =>
            window.dmDisposizione
              .elenchi()
              .find((e) => e.chiave === k)
              ?.voci.slice(0, 2),
          elenco.chiave,
        ),
      )
      .toEqual([secondo, primo]);
    await expect(pannello.locator(".dm-ant-conta")).toContainText("1 modifica");
    await pannello.locator('[data-dm-ant-azione="salva"]').click();
    await expect
      .poll(async () =>
        (await scritta(page, "cd_disposizione"))[elenco.chiave]?.ordine?.slice(0, 2),
      )
      .toEqual([secondo, primo]);
  });
}
