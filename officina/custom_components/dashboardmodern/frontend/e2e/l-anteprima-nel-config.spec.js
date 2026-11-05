/* L'anteprima della plancia nel Config (#379).
 *
 * «Il drag e drop non deve essere sulla plancia: ti avevo detto di creare
 * un'anteprima nel Config dove si fa questa cosa. Nella plancia non voglio
 * vedere alcuna matita con modifica.»
 *
 * Qui, nella casa demo:
 *  - sulla plancia non c'e' nessuna matita, su nessuna pagina;
 *  - nel Config, nella scheda dell'Energia, la sezione vera dentro una cornice
 *    larga quanto il computer o quanto il telefono: il cerchio della batteria
 *    si trascina, la linea lo segue, Salva lo scrive — per quello schermo
 *    soltanto — e la plancia e' cosi';
 *  - sul telefono la fila in fondo del flusso si vede tutta e si prende;
 *  - nella scheda della Sicurezza un riquadro portato sopra un altro resta
 *    li', anche se la pagina si ridisegna, e la plancia lo mostra cosi';
 *  - con delle modifiche aperte, lasciare la scheda chiede prima;
 *  - dentro l'anteprima un comando alla casa non parte.
 */
import { expect, test } from "@playwright/test";
import { apri, nellaCasaDemo } from "./helpers/casa-demo.js";

test.use({ timezoneId: "Europe/Rome", locale: "it-IT" });

async function apriLaScheda(page, scheda) {
  await page.evaluate((s) => {
    apriConfigEntita();
    editorSwitch(s);
  }, scheda);
  const pannello = page.locator("[data-dm-anteprima-pannello]");
  await expect(pannello).toBeVisible({ timeout: 20_000 });
  return pannello;
}

/* Apre l'anteprima della scheda sullo schermo voluto e aspetta che dentro
 * la modifica sia accesa. Torna il documento della cornice. */
async function lAnteprima(page, scheda, dispositivo) {
  const pannello = await apriLaScheda(page, scheda);
  await pannello.locator(`[data-dm-ant-dispositivo="${dispositivo}"]`).click();
  await expect
    .poll(() => page.evaluate(() => window.dmAnteprimaDellaPlancia.stato().pronta), {
      timeout: 90_000,
    })
    .toBe(true);
  const cornice = await page.locator("iframe.dm-ant-cornice").elementHandle();
  const dentro = await cornice.contentFrame();
  await expect(dentro.locator("html")).toHaveAttribute("data-dm-modifica", /./);
  return { pannello, dentro };
}

const scritta = (page, chiave) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "{}"), chiave);

/* Lo schermo dell'anteprima davanti, e dentro il pezzo da prendere. */
async function davanti(page, maniglia) {
  await page
    .locator("[data-dm-ant-schermo]")
    .evaluate((el) => el.scrollIntoView({ block: "start" }));
  await maniglia.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(250);
}

async function trascina(page, maniglia, dx, dy) {
  await davanti(page, maniglia);
  await expect(maniglia).toBeVisible();
  const box = await maniglia.boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(120);
  for (let i = 1; i <= 16; i += 1) {
    await page.mouse.move(x + (dx * i) / 16, y + (dy * i) / 16);
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(120);
  await page.mouse.up();
}

/* ── sulla plancia ────────────────────────────────────────────────────── */

test("sulla plancia non c'e' nessuna matita, su nessuna pagina", async ({ page }) => {
  test.setTimeout(150_000);
  await nellaCasaDemo(page);
  const conMatita = await page.evaluate(async () => {
    const matite = () =>
      document.querySelectorAll(
        '[data-dm-disp-tasto],[aria-label="Modifica disposizione"],[aria-label="Edit layout"],[data-dm-disp-barra]',
      ).length;
    const fuori = [];
    if (matite()) fuori.push("home");
    for (const voce of [...document.querySelectorAll(".tab[data-tab]")]) {
      const quale = voce.dataset.tab;
      if (quale === "config") continue;
      voce.click();
      await new Promise((fatto) => setTimeout(fatto, 300));
      if (matite()) fuori.push(quale);
    }
    return fuori;
  });
  expect(conMatita).toEqual([]);
  /* E la modifica sulla pagina, da sola, non si accende. */
  await expect(page.locator("html")).not.toHaveAttribute("data-dm-modifica", /./);
});

/* ── Energia ──────────────────────────────────────────────────────────── */

test.describe("sul computer", () => {
  test.skip(({ isMobile }) => isMobile, "il Config sul computer");

  test("Energia: nell'anteprima del computer la batteria si sposta, la linea la segue, Salva la tiene sulla plancia", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await nellaCasaDemo(page);
    const { pannello, dentro } = await lAnteprima(page, "sez1", "computer");
    await expect(dentro.locator("[data-dm-disegno-strato='energia']")).toBeAttached();
    await expect(dentro.locator(".dm-dis-variante").first()).toContainText("computer");
    expect(await dentro.evaluate(() => innerWidth)).toBe(1280);

    const linea = () => dentro.locator("#line-solar-battery").getAttribute("d");
    const prima = await linea();
    await trascina(page, dentro.locator('[data-dm-disegno-nodo="batteria"]'), 130, 90);
    await expect.poll(linea).not.toBe(prima);
    expect(await linea()).toMatch(/^M [\d.-]+ [\d.-]+ C /);
    await expect(pannello.locator(".dm-ant-conta")).toContainText("1 modifica");
    /* Finche' non si salva non si scrive niente. */
    expect(await scritta(page, "cd_disegni")).toEqual({});

    await pannello.locator('[data-dm-ant-azione="salva"]').click();
    await expect
      .poll(() => scritta(page, "cd_disegni"))
      .toHaveProperty(["energia:computer", "batteria"]);
    const salvata = await scritta(page, "cd_disegni");
    expect(Object.keys(salvata)).toEqual(["energia:computer"]);
    /* Salvato, la modifica nell'anteprima resta accesa e il conto torna a zero. */
    await expect(pannello.locator(".dm-ant-conta")).not.toContainText("modific");
    await expect(dentro.locator("html")).toHaveAttribute("data-dm-modifica", "energy");

    /* La plancia: la batteria sta dove la si e' lasciata. */
    await page.locator(".ed-head-close").first().click();
    await apri(page, "energy");
    const posto = salvata["energia:computer"].batteria;
    await expect
      .poll(() =>
        page.locator("#view-ist #n-battery").evaluate((n, x) => {
          const palco = n.closest(".flow-stage").getBoundingClientRect();
          const r = n.getBoundingClientRect();
          return Math.abs(((r.left + r.width / 2 - palco.left) / palco.width) * 100 - x);
        }, posto.x),
      )
      .toBeLessThan(1.5);
    await expect(page.locator("[data-dm-disp-tasto],[data-dm-disp-barra]")).toHaveCount(0);
  });

  test("Energia: l'anteprima del telefono e' larga quanto un telefono e salva solo il disegno del telefono", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await nellaCasaDemo(page);
    const { pannello, dentro } = await lAnteprima(page, "sez1", "telefono");
    expect(await dentro.evaluate(() => innerWidth)).toBe(390);
    await expect(dentro.locator(".dm-dis-variante").first()).toContainText("telefono");
    await trascina(page, dentro.locator('[data-dm-disegno-nodo="batteria"]'), -20, 60);
    await expect(pannello.locator(".dm-ant-conta")).toContainText("1 modifica");
    await pannello.locator('[data-dm-ant-azione="salva"]').click();
    await expect
      .poll(() => scritta(page, "cd_disegni"))
      .toHaveProperty(["energia:telefono", "batteria"]);
    expect(Object.keys(await scritta(page, "cd_disegni"))).toEqual(["energia:telefono"]);
  });

  test("Energia: nell'anteprima del telefono la fila in fondo del flusso si vede e si prende", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await nellaCasaDemo(page);
    const { dentro } = await lAnteprima(page, "sez1", "telefono");
    /* Dentro l'anteprima si scorre come su un telefono: in fondo al disegno
     * la fila dei carichi c'e' tutta, non tagliata. */
    await dentro
      .locator("#page-energy .flow-stage")
      .first()
      .evaluate((el) => el.scrollIntoView({ block: "end" }));
    const fondo = () =>
      dentro.evaluate(() =>
        [...document.querySelectorAll("#page-energy .flow-stage .node.n-load")]
          .filter((n) => n.getBoundingClientRect().width > 0)
          .map((n) => {
            const r = n.getBoundingClientRect();
            const visto = document.elementFromPoint(r.left + r.width / 2, r.top + r.height * 0.7);
            return {
              dentro: r.top >= 0 && r.bottom <= innerHeight,
              disegnato: Boolean(
                visto &&
                (n.contains(visto) ||
                  visto.closest?.(".flow-stage") ||
                  visto.closest?.(".dm-dis-maniglia")),
              ),
            };
          }),
      );
    await expect.poll(async () => (await fondo()).length).toBeGreaterThanOrEqual(3);
    await expect.poll(async () => (await fondo()).every((c) => c.dentro && c.disegnato)).toBe(true);
  });

  /* ── Sicurezza ──────────────────────────────────────────────────────── */

  test("Sicurezza: il fumo portato sopra l'antifurto resta sopra, anche se la pagina si ridisegna, e la plancia e' cosi'", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await nellaCasaDemo(page);
    const { pannello, dentro } = await lAnteprima(page, "sez4", "computer");
    const riquadri = () =>
      dentro.evaluate(() =>
        [
          ...document.querySelectorAll(
            '#page-security [data-dm-disp-tipo="riquadri"] > [data-dm-disp-voce]',
          ),
        ].map((el) => el.getAttribute("data-dm-disp-voce")),
      );
    await expect.poll(async () => (await riquadri()).slice(0, 2)).toEqual(["antifurto", "fumo"]);
    const prima = await riquadri();

    const maniglia = dentro.locator(
      '#page-security [data-dm-disp-voce="fumo"] > [data-dm-disp-ctrl] .dm-disp-maniglia',
    );
    await davanti(page, dentro.locator('#page-security [data-dm-disp-voce="antifurto"]'));
    const m = await maniglia.boundingBox();
    const arrivo = await dentro
      .locator('#page-security [data-dm-disp-voce="antifurto"]')
      .boundingBox();
    await trascina(
      page,
      maniglia,
      0,
      arrivo.y + Math.min(arrivo.height / 2, 120) - (m.y + m.height / 2),
    );
    await expect.poll(riquadri).toEqual(["fumo", "antifurto", ...prima.slice(2)]);
    await expect(pannello.locator(".dm-ant-conta")).toContainText("1 modifica");

    /* La pagina dentro rifa' i suoi riquadri da sola, come a ogni stato. */
    await dentro.evaluate(() => {
      const c = document.querySelector('#page-security [data-dm-disp-tipo="riquadri"]');
      for (const el of [...c.children]) {
        if (!el.hasAttribute("data-dm-blocco")) continue;
        const nuovo = el.cloneNode(true);
        for (const a of [...nuovo.attributes])
          if (a.name.startsWith("data-dm-disp") || a.name.startsWith("data-dm-riordina"))
            nuovo.removeAttribute(a.name);
        nuovo.querySelector(":scope > [data-dm-disp-ctrl]")?.remove();
        el.replaceWith(nuovo);
      }
    });
    await expect.poll(riquadri).toEqual(["fumo", "antifurto", ...prima.slice(2)]);

    await pannello.locator('[data-dm-ant-azione="salva"]').click();
    await expect
      .poll(async () => (await scritta(page, "cd_disposizione")).security?.ordine?.slice(0, 2))
      .toEqual(["fumo", "antifurto"]);

    await page.locator(".ed-head-close").first().click();
    await apri(page, "security");
    await expect
      .poll(() =>
        page.evaluate(() => {
          const tutti = [...document.querySelectorAll("#page-security [data-dm-blocco]")];
          return tutti
            .filter((el) => !tutti.some((altro) => altro !== el && altro.contains(el)))
            .filter((el) => getComputedStyle(el).display !== "none")
            .map((el) => el.getAttribute("data-dm-blocco"));
        }),
      )
      .toEqual(["fumo", "antifurto", ...prima.slice(2)]);
  });

  test("con delle modifiche aperte, lasciare la scheda chiede prima", async ({ page }) => {
    test.setTimeout(180_000);
    await nellaCasaDemo(page);
    const { pannello, dentro } = await lAnteprima(page, "sez4", "computer");
    const maniglia = dentro.locator(
      '#page-security [data-dm-disp-voce="fumo"] > [data-dm-disp-ctrl] .dm-disp-occhio,#page-security [data-dm-disp-voce="fumo"] [data-dm-disp-occhio]',
    );
    await davanti(page, maniglia.first());
    await maniglia.first().click();
    await expect(pannello.locator(".dm-ant-conta")).toContainText("1 modifica");

    let chiesto = 0;
    page.once("dialog", (d) => {
      chiesto += 1;
      d.dismiss();
    });
    await page.locator('.ed-tab[data-tab="sez1"]').first().click();
    expect(chiesto).toBe(1);
    await expect(page.locator('[data-dm-anteprima-pannello="security"]')).toBeVisible();

    page.once("dialog", (d) => {
      chiesto += 1;
      d.accept();
    });
    await page.locator('.ed-tab[data-tab="sez1"]').first().click();
    expect(chiesto).toBe(2);
    await expect(page.locator('[data-dm-anteprima-pannello="energy"]')).toBeVisible();
    expect(await scritta(page, "cd_disposizione")).toEqual({});
  });

  test("dentro l'anteprima un comando alla casa non parte", async ({ page }) => {
    test.setTimeout(180_000);
    await nellaCasaDemo(page);
    const { dentro } = await lAnteprima(page, "sez4", "computer");
    const luce = await page.evaluate(() => {
      for (const [id, e] of window.__CASA_IN_PAGINA__.entita)
        if (id.startsWith("light.") && e.state === "off") return id;
      return null;
    });
    expect(luce).toBeTruthy();
    /* Dallo stesso filo dell'anteprima: il comando diventa un ping. */
    await dentro.evaluate(
      (id) =>
        new Promise((fatto) => {
          const presa = new WebSocket("ws://casa-demo/api/websocket");
          presa.onmessage = (m) => {
            const detto = JSON.parse(m.data);
            if (detto.type === "auth_required" || detto.type === "auth_ok") {
              presa.send(JSON.stringify({ type: "auth", access_token: "x" }));
              presa.send(
                JSON.stringify({
                  id: 9001,
                  type: "call_service",
                  domain: "light",
                  service: "turn_on",
                  target: { entity_id: id },
                }),
              );
              setTimeout(fatto, 600);
            }
          };
        }),
      luce,
    );
    expect(await page.evaluate((id) => window.__CASA_IN_PAGINA__.entita.get(id).state, luce)).toBe(
      "off",
    );
  });
});

/* ── sul telefono ─────────────────────────────────────────────────────── */

test.describe("sul telefono", () => {
  test.skip(({ isMobile }) => !isMobile, "il Config sul telefono");

  test("il Config sul telefono apre l'anteprima del telefono, e ci sta", async ({ page }) => {
    test.setTimeout(180_000);
    await nellaCasaDemo(page);
    const pannello = await apriLaScheda(page, "sez1");
    await pannello.locator("[data-dm-ant-apri]").click();
    await expect
      .poll(() => page.evaluate(() => window.dmAnteprimaDellaPlancia.stato()), { timeout: 90_000 })
      .toMatchObject({ dispositivo: "telefono", pronta: true });
    const schermo = await pannello.locator("[data-dm-ant-schermo]").boundingBox();
    const viewport = page.viewportSize();
    expect(schermo.x).toBeGreaterThanOrEqual(0);
    expect(schermo.x + schermo.width).toBeLessThanOrEqual(viewport.width + 1);
  });

  test("Sicurezza: col dito, nell'anteprima, il fumo sopra l'antifurto resta sopra", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await nellaCasaDemo(page);
    const { pannello, dentro } = await lAnteprima(page, "sez4", "telefono");
    const riquadri = () =>
      dentro.evaluate(() =>
        [
          ...document.querySelectorAll(
            '#page-security [data-dm-disp-tipo="riquadri"] > [data-dm-disp-voce]',
          ),
        ].map((el) => el.getAttribute("data-dm-disp-voce")),
      );
    await expect.poll(async () => (await riquadri()).slice(0, 2)).toEqual(["antifurto", "fumo"]);
    const prima = await riquadri();
    const maniglia = dentro.locator(
      '#page-security [data-dm-disp-voce="fumo"] > [data-dm-disp-ctrl] .dm-disp-maniglia',
    );
    await davanti(page, dentro.locator('#page-security [data-dm-disp-voce="antifurto"]'));
    const m = await maniglia.boundingBox();
    const a = await dentro.locator('#page-security [data-dm-disp-voce="antifurto"]').boundingBox();
    const da = { x: m.x + m.width / 2, y: m.y + m.height / 2 };
    const verso = { x: da.x, y: Math.max(a.y + 10, a.y + Math.min(a.height / 2, 60)) };
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
        touchPoints: punto(da.x + ((verso.x - da.x) * i) / 24, da.y + ((verso.y - da.y) * i) / 24),
      });
    await page.waitForTimeout(150);
    await dito.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await dito.detach();
    await expect.poll(riquadri).toEqual(["fumo", "antifurto", ...prima.slice(2)]);
    await pannello.locator('[data-dm-ant-azione="salva"]').click();
    await expect
      .poll(async () => (await scritta(page, "cd_disposizione")).security?.ordine?.slice(0, 2))
      .toEqual(["fumo", "antifurto"]);
  });
});
