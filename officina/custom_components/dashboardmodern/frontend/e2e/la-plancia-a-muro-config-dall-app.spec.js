/* Dal menu dell'app, «Configurazione» su un tablet a muro apre il config del
 * muro.
 *
 * Dal video di un tester: l'app (nel browser di un tablet Windows, e uguale
 * sui telefoni) con la plancia scelta che e' un pannello a muro. Menu,
 * «Configurazione»: si tornava al pannello, e il config non si apriva. L'app
 * apriva la Config della plancia toccando la sua linguetta — che sta sotto il
 * pannello a tutto schermo.
 *
 * Qui la pagina ha addosso lo script VERO che l'app le mette in fondo
 * (`Premesse.laConfigFuoriDallaPlancia`, letto dal sorgente dell'app), e si
 * provano le tre porte con cui l'app la tira: la funzione chiamata dal
 * WebView del telefono, il messaggio del riquadro nel browser, e
 * `#gdahome-config` nell'indirizzo di una pagina appena nata. Per ognuna: si
 * apre il config del muro (con «Tutto il config»), l'app sente «config», e
 * «Plancia» dal menu riporta al pannello e l'app sente che se n'e' usciti.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { MURO_DI_PROVA, apriLaCasaAMuro } from "./helpers/casa-a-muro.js";

const QUI = dirname(fileURLToPath(import.meta.url));
const PREMESSE = join(QUI, "../../../../../app/lib/plancia/premesse.dart");

/* Lo script dell'app com'e' scritto nel suo sorgente: le stringhe Dart una
 * dopo l'altra, senza i commenti che ci stanno in mezzo. */
function loScriptDellApp() {
  const dart = readFileSync(PREMESSE, "utf8");
  const da = dart.indexOf("static const String laConfigFuoriDallaPlancia =");
  const a = dart.indexOf("'})();</script>';", da) + 17;
  const pezzo = dart.slice(da, a).replace(/\/\*[\s\S]*?\*\//g, "");
  const testo = [...pezzo.matchAll(/'((?:\\.|[^'\\])*)'/g)]
    .map((m) => m[1].replace(/\\(.)/g, "$1"))
    .join("");
  const stile = testo.slice(testo.indexOf("<style"), testo.indexOf("</style>") + 8);
  const script = testo.slice(testo.indexOf("<script>") + 8, testo.lastIndexOf("</script>"));
  return { stile, script };
}

async function conLApp(page) {
  const { stile, script } = loScriptDellApp();
  await page.addInitScript(
    ({ stile, script }) => {
      /* Il canale del telefono: quello che la pagina dice all'app. */
      window.__DETTI__ = [];
      window.gdahomeDice = { postMessage: (m) => window.__DETTI__.push(m) };
      document.addEventListener("DOMContentLoaded", () =>
        document.head.insertAdjacentHTML("beforeend", stile),
      );
      new Function(script)();
    },
    { stile, script },
  );
}

const muro = (page) => page.locator("#dm-muro");
const detti = (page) => page.evaluate(() => window.__DETTI__.slice());

async function siApreIlConfigDelMuro(page) {
  await expect(page.locator("#editor-modal")).toBeVisible();
  await expect(page.locator("html")).toHaveClass(/dm-solo-muro/);
  await expect(page.locator("#editor-modal [data-mu-tutto-il-config]")).toBeVisible();
  await expect(muro(page)).toHaveCount(0);
  /* La Config della plancia, sotto, non si e' aperta. */
  await expect(page.locator("#page-config")).not.toHaveClass(/active/);
  await expect.poll(() => detti(page)).toContain("config");
}

async function siTornaAlPannello(page) {
  await expect(page.locator("#editor-modal")).toHaveCount(0);
  await expect(muro(page)).toBeVisible();
  await expect(page.locator("html")).not.toHaveClass(/dm-solo-muro/);
  await expect.poll(async () => (await detti(page)).at(-1)).toBe("home");
}

test.describe("la plancia a muro: il config chiesto dall'app", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("dal telefono: la maniglia chiamata dal WebView", async ({ page }, testInfo) => {
    await conLApp(page);
    await apriLaCasaAMuro(page, testInfo, { muro: MURO_DI_PROVA });
    await expect(muro(page)).toBeVisible();
    /* Quello che fa `riquadro/sul_telefono.dart`. */
    await page.evaluate(() => window.gdahomeApriLaConfig && window.gdahomeApriLaConfig());
    await siApreIlConfigDelMuro(page);

    await page.evaluate(() => window.gdahomeTornaDallaConfig && window.gdahomeTornaDallaConfig());
    await siTornaAlPannello(page);
  });

  test("dal browser: il messaggio del riquadro", async ({ page }, testInfo) => {
    await conLApp(page);
    await apriLaCasaAMuro(page, testInfo, { muro: MURO_DI_PROVA });
    await expect(muro(page)).toBeVisible();
    /* Quello che fa `riquadro/sul_web.dart` quando la chiamata non passa:
     * qui chi ospita e' la pagina stessa (window.parent === window). */
    await page.evaluate(() => window.postMessage({ gdahome: "apri-la-config" }, "*"));
    await siApreIlConfigDelMuro(page);
    await page.evaluate(() => window.postMessage({ gdahome: "torna-dalla-config" }, "*"));
    await siTornaAlPannello(page);
  });

  test("da una pagina appena nata: #gdahome-config nell'indirizzo", async ({ page }, testInfo) => {
    await conLApp(page);
    await apriLaCasaAMuro(page, testInfo, { muro: MURO_DI_PROVA });
    await expect(muro(page)).toBeVisible();
    /* Il ripiego del telefono: la pagina si ricarica con l'ordine scritto. */
    await page.evaluate(() => {
      location.hash = "gdahome-config";
      location.reload();
    });
    await page.waitForLoadState("domcontentloaded");
    await siApreIlConfigDelMuro(page);
    /* L'ordine e' stato eseguito e cancellato. */
    expect(await page.evaluate(() => location.hash)).toBe("");
    await page.evaluate(() => window.gdahomeTornaDallaConfig());
    await siTornaAlPannello(page);
    /* E la plancia sotto non e' rimasta sulla Config. */
    await expect(page.locator("#page-config")).not.toHaveClass(/active/);
  });

  test("chiuso con la sua ✕, l'app sente che si e' tornati", async ({ page }, testInfo) => {
    await conLApp(page);
    await apriLaCasaAMuro(page, testInfo, { muro: MURO_DI_PROVA });
    await page.evaluate(() => window.gdahomeApriLaConfig());
    await siApreIlConfigDelMuro(page);
    await page.locator("#editor-modal .ed-head-close").click();
    await siTornaAlPannello(page);
  });

  test("senza pannello in scena la Config resta quella della plancia", async ({
    page,
  }, testInfo) => {
    await conLApp(page);
    await apriLaCasaAMuro(page, testInfo, { premium: false, muro: MURO_DI_PROVA });
    await page.evaluate(() => window.gdahomeApriLaConfig());
    await expect(page.locator("#page-config")).toHaveClass(/active/);
    await expect(page.locator("#editor-modal")).toHaveCount(0);
  });
});
