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
 *  - con «riduci animazioni»: calmo ma vivo. Non fermo: su Windows con
 *    «Effetti di animazione» spenti Chrome ed Edge chiedono di ridurre le
 *    animazioni, e il velo fermo sembrava una plancia bloccata (la prova del
 *    titolare dentro Home Assistant). Niente che si sposti, cresca o giri;
 *    luci che si accendono sul posto, tre punti che pulsano, e se ne va
 *    sfumando. E senza l'ellisse azzurra: il foglio grande della plancia
 *    vestiva ancora quei punti da rotella di una volta. */
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

test("con «riduci animazioni» il velo e' calmo ma vivo, e se ne va sfumando", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const contesto = await browser.newContext({ reducedMotion: "reduce" });
  const page = await contesto.newPage();
  /* Il foglio grande si lascia arrivare (e' quello che vestiva i punti da
   * rotella); la plancia invece si tiene ferma finche' non si e' guardato. */
  let lascia;
  const trattenuta = new Promise((ok) => (lascia = ok));
  await page.route("**/dashboard-runtime-it.js", async (rotta) => {
    await trattenuta;
    await rotta.continue();
  });
  await page.goto("http://127.0.0.1:4173/legacy/dashboard.html?dmi=velo-calmo", {
    waitUntil: "commit",
  });
  const velo = page.locator("#cd-boot-overlay");
  await expect(velo).toHaveClass(/gv-calmo/, { timeout: 15_000 });
  await page.waitForFunction(
    () =>
      [...document.styleSheets].some(
        (f) => /dashboard-runtime-it\.css/.test(f.href || "") && f.media.mediaText !== "print",
      ),
    null,
    { timeout: 30_000 },
  );
  /* Il marchio intero e fermo dal primo istante; niente iniziali, anello,
   * granelli, onda d'urto. */
  await expect(velo.locator("img")).toHaveCSS("opacity", "1");
  for (const via of [".gv-ini", ".gv-anello", ".gv-g", ".gv-onda", ".s"]) {
    expect(
      await velo
        .locator(via)
        .first()
        .evaluate((n) => getComputedStyle(n).display),
      via,
    ).toBe("none");
  }
  /* Vivo: ci sono animazioni in corsa, e nessuna sposta, ingrandisce o gira
   * niente — solo luce. L'unica che trasla e' la luce che passa sul marchio,
   * dentro il marchio. */
  const animazioni = await page.evaluate(() =>
    document
      .getElementById("cd-boot-overlay")
      .getAnimations({ subtree: true })
      .map((a) => {
        const chi = a.effect.target;
        const muove = a.effect
          .getKeyframes()
          .some((k) => (k.transform && k.transform !== "none") || k.scale || k.rotate);
        return {
          nome: a.animationName,
          viva: a.playState === "running" && a.effect.getComputedTiming().iterations === Infinity,
          muove,
          dentroIlMarchio: Boolean(chi.closest(".gv-luc")),
        };
      }),
  );
  expect(animazioni.filter((a) => a.viva).length, "luci che restano accese").toBeGreaterThan(10);
  expect(animazioni.filter((a) => a.muove && !a.dentroIlMarchio)).toEqual([]);
  expect(animazioni.map((a) => a.nome)).toEqual(
    expect.arrayContaining(["gvPulsa", "gvRespiraCalmo", "gvRaggiCalmi", "gvLampoCalmo", "gvFinR"]),
  );
  /* I tre punti: tre, rotondi e piccoli — non l'ellisse azzurra. */
  const punti = await velo.locator(".gv-punti > i").evaluateAll((tutti) =>
    tutti.map((p) => {
      const s = getComputedStyle(p);
      const r = p.getBoundingClientRect();
      return {
        tondo: s.borderRadius === "50%",
        bordo: s.borderTopWidth,
        quadrato: Math.abs(r.width - r.height) < 0.5,
      };
    }),
  );
  expect(punti).toEqual(Array(3).fill({ tondo: true, bordo: "0px", quadrato: true }));
  await expect(velo.locator(".gv-punti")).toBeVisible();
  /* Se ne va sfumando, senza il cerchio. */
  await guardaIlVelo(page);
  lascia();
  await pronta(page);
  const cerchio = await page.evaluate(() => {
    const o = document.getElementById("cd-boot-overlay");
    globalThis.cdHideBoot();
    return Boolean(o && /radial-gradient/.test(o.style.maskImage || o.style.webkitMaskImage || ""));
  });
  expect(cerchio).toBe(false);
  await expect(velo).toHaveCount(0, { timeout: 15_000 });
  await contesto.close();
});
