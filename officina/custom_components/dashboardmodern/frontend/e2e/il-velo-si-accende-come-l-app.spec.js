/* Il velo d'avvio si accende come l'attesa dell'app, e se ne va aprendosi.
 *
 * «Bellissimo cosi', lo devi mettere anche su HA quando carica la plancia.»
 * Il velo della pagina (`legacy/caricamento/velo.js`) rifa' l'attesa
 * dell'app: le iniziali che si srotolano su una tela, il marchio, l'anello, i
 * granelli, il nome lettera per lettera, la riga che cambia, e l'uscita in un
 * cerchio dal logo. Qui si sorvegliano le tre strade:
 *
 *  - nel browser (Home Assistant): il velo si accende, e quando la plancia e'
 *    pronta se ne va con il cerchio, poi sparisce;
 *  - nell'app: non si accende niente — sopra c'e' l'attesa dell'app — e se ne
 *    va sfumando, che e' quello che l'app ascolta (`premesse.dart`);
 *  - con «riduci animazioni»: fermo, con i tre punti, e la riga cambia lo
 *    stesso. */
import { expect, test } from "@playwright/test";

const pronta = (page) =>
  page.waitForFunction(() => typeof globalThis.cdHideBoot === "function", null, {
    timeout: 60_000,
  });

/* Quello che fa il velo fino all'ultimo, guardato dal primo istante: la
 * maschera del cerchio e lo sfumare. */
const guardaIlVelo = (page) =>
  page.addInitScript(() => {
    window.__velo = { cerchio: false, sfumato: false };
    const guarda = () => {
      const o = document.getElementById("cd-boot-overlay");
      if (o) {
        if (/radial-gradient/.test(o.style.maskImage || o.style.webkitMaskImage || ""))
          window.__velo.cerchio = true;
        if (o.style.opacity === "0") window.__velo.sfumato = true;
      }
      requestAnimationFrame(guarda);
    };
    requestAnimationFrame(guarda);
  });

test("nel browser il velo si accende, e se ne va aprendosi in un cerchio", async ({ page }) => {
  test.setTimeout(90_000);
  await guardaIlVelo(page);
  await page.goto("/legacy/dashboard.html?dmi=velo-che-si-accende", { waitUntil: "commit" });
  const velo = page.locator("#cd-boot-overlay");
  await expect(velo).toHaveClass(/gv-vivo/, { timeout: 15_000 });
  await expect(velo).toHaveClass(/gv-nostro/);
  const dentro = await velo.evaluate((o) => ({
    tela: Boolean(o.querySelector(".gv-ini canvas")),
    granelli: o.querySelectorAll(".gv-g").length,
    lettere: o.querySelectorAll("b > span > span").length,
    righe: [...o.querySelectorAll("small > span")].map((r) => r.textContent),
    stile: Boolean(document.getElementById("gv-velo")),
  }));
  expect(dentro).toEqual({
    tela: true,
    granelli: 22,
    lettere: "GDAHOME".length,
    righe: ["Caricamento…", "Mi collego a casa…", "Quasi pronto…", "Ancora un attimo…"],
    stile: true,
  });
  /* L'uscita la fa il velo: il cerchio (una maschera che si apre) e poi via. */
  await pronta(page);
  await page.evaluate(() => globalThis.cdHideBoot());
  await expect(velo).toHaveCount(0, { timeout: 15_000 });
  expect(await page.evaluate(() => window.__velo)).toEqual({ cerchio: true, sfumato: false });
});

test("nell'app il velo resta fermo e se ne va sfumando, come prima", async ({ page }) => {
  test.setTimeout(90_000);
  await guardaIlVelo(page);
  await page.addInitScript(() => {
    window.gdahomeDice = { postMessage() {} };
  });
  await page.goto("/legacy/dashboard.html?dmi=velo-nell-app", { waitUntil: "commit" });
  const velo = page.locator("#cd-boot-overlay");
  await expect(velo).toHaveCount(1, { timeout: 15_000 });
  await page.waitForFunction(() => document.readyState !== "loading", null, { timeout: 60_000 });
  expect(await page.evaluate(() => Boolean(window.__gdahomeVelo))).toBe(false);
  const acceso = await page.evaluate(
    () => document.getElementById("cd-boot-overlay")?.classList.contains("gv-vivo") ?? false,
  );
  expect(acceso).toBe(false);
  await pronta(page);
  await page.evaluate(() => globalThis.cdHideBoot());
  await expect(velo).toHaveCount(0, { timeout: 15_000 });
  expect(await page.evaluate(() => window.__velo)).toEqual({ cerchio: false, sfumato: true });
});

test("con «riduci animazioni» il velo e' fermo, coi tre punti", async ({ browser }) => {
  test.setTimeout(90_000);
  const contesto = await browser.newContext({ reducedMotion: "reduce" });
  const page = await contesto.newPage();
  await page.route("**/dashboard-runtime-it.js", () => new Promise(() => {}));
  await page.goto("http://127.0.0.1:4173/legacy/dashboard.html?dmi=velo-fermo", {
    waitUntil: "commit",
  });
  const velo = page.locator("#cd-boot-overlay");
  await expect(velo).toHaveClass(/gv-fermo/, { timeout: 15_000 });
  await expect(velo.locator(".s")).toBeVisible();
  await expect(velo.locator("img")).toHaveCSS("opacity", "1");
  expect(await velo.locator(".gv-ini").evaluate((n) => getComputedStyle(n).display)).toBe("none");
  await contesto.close();
});
