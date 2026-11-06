/* La pagina davanti che si riscrive da sola resta come l'ha messa l'utente
 * (#379).
 *
 * Lo Sport, quando arrivano i risultati, rifa' i suoi riquadri da capo, e
 * nascono nell'ordine di serie. La disposizione li rimetteva in fila al giro in
 * coda, sessanta millesimi dopo: per tre o quattro fotogrammi la pagina si
 * vedeva di serie e poi tornava, a scatto. La prova «un riquadro spostato e
 * salvato resta dov'e' dopo aver ricaricato» ogni tanto cadeva proprio li'
 * dentro. Adesso la pagina si rimette nel momento in cui si riscrive, prima
 * del disegno: nessun fotogramma la mostra di serie.
 */
import { expect, test } from "@playwright/test";
import { apri, nellaCasaDemo, pronta } from "./helpers/casa-demo.js";

test.use({ timezoneId: "Europe/Rome", locale: "it-IT" });

const ordineSport = (page) =>
  page.evaluate(() => window.dmDisposizione.elenchi().find((e) => e.chiave === "sport")?.voci);

test("lo Sport riscritto non si vede mai di serie", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "il computer");
  test.setTimeout(180_000);
  await nellaCasaDemo(page);
  await apri(page, "sport");
  await expect
    .poll(async () => (await ordineSport(page))?.length || 0, { timeout: 20_000 })
    .toBeGreaterThan(1);
  const prima = await ordineSport(page);
  const atteso = [...prima.slice(1), prima[0]];
  await page.evaluate((ordine) => {
    const tutta = JSON.parse(localStorage.getItem("cd_disposizione") || "{}");
    tutta.sport = { ordine };
    localStorage.setItem("cd_disposizione", JSON.stringify(tutta));
  }, atteso);

  /* Ogni fotogramma, da quando la pagina si accende: l'ordine dei riquadri
   * dello Sport come si vede, riconosciuti dal loro titolo e non dall'id che
   * gli da' la disposizione (un riquadro appena rifatto non ce l'ha ancora). */
  await page.addInitScript(() => {
    window.__dmFotogrammi = [];
    const giro = () => {
      const pagina = document.getElementById("page-sport");
      const contenitore = pagina?.querySelector(".dm-sport-blocco")?.parentElement;
      if (pagina?.classList.contains("active") && contenitore) {
        const ordine = [...contenitore.children]
          .filter((el) => el.offsetHeight > 0)
          .map(
            (el) => el.querySelector("h3,.dm-sport-titolo")?.textContent?.trim().slice(0, 12) || "",
          )
          .join(" | ");
        if (window.__dmFotogrammi.at(-1) !== ordine) window.__dmFotogrammi.push(ordine);
      }
      requestAnimationFrame(giro);
    };
    requestAnimationFrame(giro);
  });
  await page.reload();
  await pronta(page);
  await apri(page, "sport");
  await expect.poll(() => ordineSport(page), { timeout: 15_000 }).toEqual(atteso);
  await page.waitForTimeout(2_000);

  /* E la pagina che si riscrive da capo mentre la si guarda, come fa la
   * sezione: i riquadri rifatti nell'ordine di serie, senza gli id. */
  await page.evaluate((serie) => {
    const contenitore = document.querySelector("#page-sport [data-dm-blocco]").parentElement;
    const figli = [...contenitore.children];
    const rifatti = serie.map((id) => {
      const copia = figli.find((el) => el.getAttribute("data-dm-blocco") === id).cloneNode(true);
      copia.removeAttribute("data-dm-blocco");
      copia.removeAttribute("data-dm-disp-nome");
      return copia;
    });
    contenitore.replaceChildren(
      ...rifatti,
      ...figli.filter((el) => !serie.includes(el.getAttribute("data-dm-blocco"))),
    );
  }, prima);
  await page.evaluate(
    () => new Promise((fatto) => requestAnimationFrame(() => requestAnimationFrame(fatto))),
  );
  expect(await ordineSport(page)).toEqual(atteso);

  const fotogrammi = await page.evaluate(() => window.__dmFotogrammi);
  const giusto = fotogrammi.at(-1);
  const pieni = fotogrammi.filter((o) => o.split(" | ").length === atteso.length);
  expect(pieni.length).toBeGreaterThan(0);
  /* Ogni fotogramma con tutti i riquadri li ha in quell'ordine. */
  expect(pieni.filter((o) => o !== giusto)).toEqual([]);
});
