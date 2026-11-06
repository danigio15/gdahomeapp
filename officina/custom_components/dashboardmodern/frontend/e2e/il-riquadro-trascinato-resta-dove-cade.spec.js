/* Un riquadro trascinato col mouse o col dito resta dove lo si lascia.
 *
 * Nel video delle novita', nella casa demo: in Sicurezza il riquadro dei
 * rilevatori di fumo portato sopra l'antifurto tornava sotto appena lo si
 * lasciava, la barra contava «1 modifica» e Salva scriveva `{}`. Dodici prove
 * su dodici, sul computer e sul telefono.
 *
 * La griglia della modifica sposta la voce **mentre** si trascina (il posto
 * di arrivo tratteggiato) e al rilascio dice «da 1 a 0». La disposizione
 * rileggeva l'ordine dal DOM — gia' spostato — e rifaceva lo spostamento: due
 * volte. Di un posto tornava indietro; di due finiva nel posto sbagliato. Le
 * prove di prima trascinavano un riquadro fino in fondo e guardavano solo che
 * non fosse piu' primo, e cosi' passavano lo stesso.
 *
 * Qui si guarda il posto esatto, dopo che la pagina si e' ridisegnata da sola
 * (come fa la Sicurezza a ogni stato che arriva), dopo Salva e dopo una
 * ricarica. */
import { expect, test } from "@playwright/test";
import { apri, nellaCasaDemo } from "./helpers/casa-demo.js";

test.use({ timezoneId: "Europe/Rome", locale: "it-IT" });

const riquadri = (page, pagina) =>
  page.evaluate(
    (p) =>
      [
        ...document.querySelectorAll(
          `#page-${p} [data-dm-disp-tipo="riquadri"] > [data-dm-disp-voce]`,
        ),
      ].map((el) => el.getAttribute("data-dm-disp-voce")),
    pagina,
  );

/* Fuori dalla modifica: i riquadri dichiarati, nell'ordine in cui stanno. */
const riquadriFuori = (page, pagina) =>
  page.evaluate((p) => {
    const tutti = [...document.querySelectorAll(`#page-${p} [data-dm-blocco]`)];
    return tutti
      .filter((el) => !tutti.some((altro) => altro !== el && altro.contains(el)))
      .filter((el) => getComputedStyle(el).display !== "none")
      .map((el) => el.getAttribute("data-dm-blocco"));
  }, pagina);

const ordineVisto = (page, pagina) =>
  page.evaluate((p) => {
    const tutta = JSON.parse(localStorage.getItem("cd_disposizione") || "{}");
    return tutta[p]?.ordine || null;
  }, pagina);

async function inModifica(page, pagina) {
  await apri(page, pagina);
  await page.evaluate(() => window.dmDisposizione.entraInModifica());
  await expect(page.locator("html")).toHaveAttribute("data-dm-modifica", pagina);
  await expect(page.locator(`#page-${pagina} [data-dm-disp-tipo="riquadri"]`)).toBeVisible();
}

/* Il punto in cui posare: dentro la parte visibile del riquadro d'arrivo. */
async function dentro(page, locator) {
  const b = await locator.boundingBox();
  const alto = Math.max(b.y, 80);
  const basso = Math.min(b.y + b.height, page.viewportSize().height - 120);
  return { x: b.x + Math.min(b.width / 2, 260), y: (alto + basso) / 2 };
}

async function colMouse(page, da, a) {
  await page.mouse.move(da.x, da.y);
  await page.mouse.down();
  await page.waitForTimeout(120);
  for (let i = 1; i <= 24; i += 1) {
    await page.mouse.move(da.x + ((a.x - da.x) * i) / 24, da.y + ((a.y - da.y) * i) / 24);
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(150);
  await page.mouse.up();
}

async function colDito(page, da, a) {
  const dito = await page.context().newCDPSession(page);
  const punto = (x, y) => [{ x, y, id: 1 }];
  await dito.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: punto(da.x, da.y),
  });
  await page.waitForTimeout(450);
  for (let i = 1; i <= 24; i += 1)
    await dito.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: punto(da.x + ((a.x - da.x) * i) / 24, da.y + ((a.y - da.y) * i) / 24),
    });
  await page.waitForTimeout(150);
  await dito.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await dito.detach();
}

/* La pagina rifa' i suoi riquadri da sola, come quando arriva uno stato:
 * ogni riquadro sostituito da una copia nuova, nell'ordine di serie. */
async function laPaginaSiRidisegna(page, pagina) {
  await page.evaluate((p) => {
    const c = document.querySelector(`#page-${p} [data-dm-disp-tipo="riquadri"]`);
    for (const el of [...c.children]) {
      if (!el.hasAttribute("data-dm-blocco")) continue;
      const nuovo = el.cloneNode(true);
      for (const a of [...nuovo.attributes])
        if (a.name.startsWith("data-dm-disp") || a.name.startsWith("data-dm-riordina"))
          nuovo.removeAttribute(a.name);
      nuovo.querySelector(":scope > [data-dm-disp-ctrl]")?.remove();
      el.replaceWith(nuovo);
    }
  }, pagina);
}

async function salvaERicarica(page) {
  await page.locator('[data-dm-disp-azione="salva"]').click();
  await expect(page.locator("html")).not.toHaveAttribute("data-dm-modifica", /./);
  await page.reload();
}

test.describe("sul computer", () => {
  test.skip(({ isMobile }) => isMobile, "col mouse");

  test("Sicurezza: il fumo sopra l'antifurto resta sopra, anche dopo un ridisegno", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    await nellaCasaDemo(page);
    await inModifica(page, "security");
    const prima = await riquadri(page, "security");
    expect(prima.slice(0, 2)).toEqual(["antifurto", "fumo"]);

    const maniglia = page.locator(
      '#page-security [data-dm-disp-voce="fumo"] > [data-dm-disp-ctrl] .dm-disp-maniglia',
    );
    const m = await maniglia.boundingBox();
    await colMouse(
      page,
      { x: m.x + m.width / 2, y: m.y + m.height / 2 },
      await dentro(page, page.locator('#page-security [data-dm-disp-voce="antifurto"]')),
    );
    await expect
      .poll(() => riquadri(page, "security"))
      .toEqual(["fumo", "antifurto", ...prima.slice(2)]);
    await expect(page.locator(".dm-disp-conta")).toContainText("1 modifica");

    await laPaginaSiRidisegna(page, "security");
    await expect
      .poll(() => riquadri(page, "security"))
      .toEqual(["fumo", "antifurto", ...prima.slice(2)]);

    await salvaERicarica(page);
    expect((await ordineVisto(page, "security")).slice(0, 2)).toEqual(["fumo", "antifurto"]);
    await apri(page, "security");
    await expect
      .poll(() => riquadriFuori(page, "security"))
      .toEqual(["fumo", "antifurto", ...prima.slice(2)]);
  });

  test("Sicurezza: l'ultimo portato in cima va in cima, non a meta'", async ({ page }) => {
    test.setTimeout(150_000);
    await nellaCasaDemo(page);
    await inModifica(page, "security");
    const prima = await riquadri(page, "security");
    expect(prima.length).toBeGreaterThanOrEqual(3);
    const ultimo = prima.at(-1);

    const maniglia = page.locator(
      `#page-security [data-dm-disp-voce="${ultimo}"] > [data-dm-disp-ctrl] .dm-disp-maniglia`,
    );
    await maniglia.scrollIntoViewIfNeeded();
    const primo = page.locator(`#page-security [data-dm-disp-voce="${prima[0]}"]`);
    /* Il primo riquadro deve stare nello schermo insieme alla maniglia. */
    await page.evaluate(() => window.scrollBy(0, -200));
    const m2 = await maniglia.boundingBox();
    await colMouse(
      page,
      { x: m2.x + m2.width / 2, y: m2.y + m2.height / 2 },
      await dentro(page, primo),
    );
    await expect.poll(() => riquadri(page, "security")).toEqual([ultimo, ...prima.slice(0, -1)]);

    await salvaERicarica(page);
    await apri(page, "security");
    await expect
      .poll(() => riquadriFuori(page, "security"))
      .toEqual([ultimo, ...prima.slice(0, -1)]);
  });

  test("Sport: la Formula 1 sopra il calcio resta sopra", async ({ page }) => {
    test.setTimeout(150_000);
    await nellaCasaDemo(page);
    await inModifica(page, "sport");
    await expect.poll(async () => (await riquadri(page, "sport")).length).toBeGreaterThanOrEqual(2);
    const prima = await riquadri(page, "sport");

    /* I riquadri dello Sport sono piu' alti dello schermo: si porta la
     * maniglia del secondo in basso, col primo che si vede sopra. */
    const maniglia = page.locator(
      `#page-sport [data-dm-disp-voce="${prima[1]}"] > [data-dm-disp-ctrl] .dm-disp-maniglia`,
    );
    await maniglia.evaluate((el) => {
      const r = el.getBoundingClientRect();
      window.scrollBy(0, r.top - (window.innerHeight - 240));
    });
    const m = await maniglia.boundingBox();
    await colMouse(
      page,
      { x: m.x + m.width / 2, y: m.y + m.height / 2 },
      await dentro(page, page.locator(`#page-sport [data-dm-disp-voce="${prima[0]}"]`)),
    );
    await expect
      .poll(() => riquadri(page, "sport"))
      .toEqual([prima[1], prima[0], ...prima.slice(2)]);

    await laPaginaSiRidisegna(page, "sport");
    await expect
      .poll(() => riquadri(page, "sport"))
      .toEqual([prima[1], prima[0], ...prima.slice(2)]);

    await salvaERicarica(page);
    expect((await ordineVisto(page, "sport")).slice(0, 2)).toEqual([prima[1], prima[0]]);
    await apri(page, "sport");
    await expect
      .poll(() => riquadriFuori(page, "sport"))
      .toEqual([prima[1], prima[0], ...prima.slice(2)]);
  });
});

test.describe("sul telefono", () => {
  test.skip(({ isMobile }) => !isMobile, "col dito");

  test("Sicurezza: col dito il fumo sopra l'antifurto resta sopra", async ({ page }) => {
    test.setTimeout(150_000);
    await nellaCasaDemo(page);
    await inModifica(page, "security");
    const prima = await riquadri(page, "security");
    expect(prima.slice(0, 2)).toEqual(["antifurto", "fumo"]);

    const maniglia = page.locator(
      '#page-security [data-dm-disp-voce="fumo"] > [data-dm-disp-ctrl] .dm-disp-maniglia',
    );
    await maniglia.evaluate((el) => {
      const r = el.getBoundingClientRect();
      window.scrollBy(0, r.top - (window.innerHeight - 260));
    });
    const m = await maniglia.boundingBox();
    await colDito(
      page,
      { x: m.x + m.width / 2, y: m.y + m.height / 2 },
      await dentro(page, page.locator('#page-security [data-dm-disp-voce="antifurto"]')),
    );
    await expect
      .poll(() => riquadri(page, "security"))
      .toEqual(["fumo", "antifurto", ...prima.slice(2)]);

    await laPaginaSiRidisegna(page, "security");
    await expect
      .poll(() => riquadri(page, "security"))
      .toEqual(["fumo", "antifurto", ...prima.slice(2)]);

    await salvaERicarica(page);
    expect((await ordineVisto(page, "security")).slice(0, 2)).toEqual(["fumo", "antifurto"]);
  });
});
