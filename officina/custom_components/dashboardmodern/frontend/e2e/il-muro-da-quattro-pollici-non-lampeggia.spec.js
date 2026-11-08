/* Il pannello da 4" non lampeggia a ogni aggiornamento.
 *
 * Dal campo, con un video di un Sonoff da quattro pollici: «sono molto lenti e
 * hanno problemi di refresh». A ogni stato che arrivava, anche solo l'ora, il
 * pannello rifaceva tutto lo schermo da capo, e il processore piccolo non
 * faceva in tempo: per un attimo si vedeva il fondo vuoto, celeste, sopra un
 * pannello scuro. Adesso il ridisegno cambia solo quello che e' cambiato, il
 * fondo dietro e' quello del pannello, e la plancia di sotto non si disegna.
 */
import { expect, test } from "@playwright/test";
import { MURO_DI_PROVA, STATI_A_MURO, apriLaCasaAMuro } from "./helpers/casa-a-muro.js";

const muro = (page) => page.locator("#dm-muro");

const cambia = (page, id, stato, attributi) =>
  page.evaluate(
    ([id, stato, attributi]) => {
      const raw = eval("_RAW_STATES");
      raw[id] = { entity_id: id, state: stato, attributes: attributi ?? raw[id]?.attributes ?? {} };
      window.dispatchEvent(
        new CustomEvent("dashboardmodern:state-changed", { detail: { entity_ids: [id] } }),
      );
    },
    [id, stato, attributi],
  );

test("una temperatura che cambia cambia il suo numero, e il resto del pannello resta quello", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 480, height: 480 });
  await apriLaCasaAMuro(page, testInfo, { stati: STATI_A_MURO, muro: MURO_DI_PROVA });
  await expect(muro(page)).toHaveAttribute("data-compatto", "1");
  await expect(muro(page)).toHaveAttribute("data-leggero", "1");
  await expect(muro(page).locator(".mu-testa")).toBeVisible();
  /* Ogni pezzo del pannello si segna: dopo l'aggiornamento devono essere
   * ancora quelli, non copie nuove. */
  const pezzi = await page.evaluate(() => {
    const tela = document.querySelector("#dm-muro .mu-tela");
    window.__pezzi__ = [...tela.querySelectorAll("*")];
    window.__cambi__ = 0;
    new MutationObserver((elenco) => {
      for (const m of elenco) window.__cambi__ += m.addedNodes.length + m.removedNodes.length;
    }).observe(tela, { childList: true, subtree: true });
    return window.__pezzi__.length;
  });
  expect(pezzi).toBeGreaterThan(30);
  await cambia(page, "sensor.soggiorno_temperatura", "22.4");
  await expect(muro(page)).toContainText("22,4");
  const dopo = await page.evaluate(() => {
    const tela = document.querySelector("#dm-muro .mu-tela");
    const ora = new Set(tela.querySelectorAll("*"));
    return {
      restati: window.__pezzi__.filter((n) => ora.has(n)).length,
      cambi: window.__cambi__,
    };
  });
  /* Cambia un numero: i pezzi restano tutti, e i nodi messi o tolti si
   * contano sulle dita (il testo del numero). */
  expect(dopo.restati).toBe(pezzi);
  expect(dopo.cambi).toBeLessThan(10);
});

test("la telecamera dell'ingresso non si ricarica quando arriva uno stato", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await apriLaCasaAMuro(page, testInfo, {
    stati: STATI_A_MURO,
    muro: { attiva: true, pagine: [MURO_DI_PROVA.pagine[2]] },
  });
  const img = muro(page).locator("img[data-mu-telecamera]").first();
  await expect(img).toHaveCount(1);
  await img.evaluate((n) => {
    window.__telecamera__ = n;
  });
  await cambia(page, "alarm_control_panel.casa", "armed_away");
  await expect(muro(page).locator(".mu-allarme, .mu-pag-ingresso").first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.querySelector("#dm-muro img[data-mu-telecamera]") === window.__telecamera__,
    ),
  ).toBe(true);
});

test("col pannello acceso il fondo della pagina e' il suo, e la plancia di sotto non si disegna", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 480, height: 480 });
  await apriLaCasaAMuro(page, testInfo, { stati: STATI_A_MURO, muro: MURO_DI_PROVA });
  await expect(muro(page)).toBeVisible();
  const fondo = await page.evaluate(() => ({
    corpo: getComputedStyle(document.body).backgroundColor,
    tema: document.getElementById("dm-muro").dataset.tema,
    sfondo: getComputedStyle(document.querySelector(".animated-mesh-bg")).display,
    casa: getComputedStyle(document.querySelector("section.page.active")).visibility,
  }));
  expect(fondo.corpo).toBe(fondo.tema === "light" ? "rgb(240, 244, 248)" : "rgb(12, 19, 34)");
  expect(fondo.sfondo).toBe("none");
  expect(fondo.casa).toBe("hidden");
  /* Spento il pannello, la plancia torna com'era. */
  await page.evaluate(() => {
    localStorage.setItem("cd_muro", JSON.stringify({ attiva: false, pagine: [] }));
    window.dispatchEvent(new CustomEvent("dashboardmodern:muro"));
  });
  await expect(muro(page)).toHaveCount(0);
  expect(
    await page.evaluate(
      () => getComputedStyle(document.querySelector("section.page.active")).visibility,
    ),
  ).toBe("visible");
});
