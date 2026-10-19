/* Il nome di ogni voce della barra sta su una riga, intero.
 *
 * «Deve stare su una linea, mai testo a capo», e «distanzia di piu' le icone».
 * Il foglio del tocco teneva ogni voce dentro settantadue punti e tagliava il
 * resto coi puntini; mandarlo a capo su due righe («ELETTRO / DOMESTICI») era
 * peggio. Adesso ogni voce e' larga quanto il suo nome e fra una voce e
 * l'altra c'e' spazio vero; quello che non ci sta si raggiunge scorrendo.
 *
 * Le prove fingono l'app, come la foto: `gdahomeDice` e il foglio
 * «gdahome-config-fuori» (app/lib/plancia/premesse.dart).
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [
      { id: "r1", name: "Salotto", entities: [] },
      { id: "r2", name: "Cucina", entities: [] },
    ],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: {
    home: true,
    energy: true,
    appliances: true,
    ev: true,
    boiler: true,
    clima: true,
    temp: true,
    security: false,
    server: false,
    tapparelle: false,
    irrigazione: false,
    piscina: false,
  },
};
const NOMI = { appliances: "Elettrodomestici", boiler: "Gestione termica" };

async function apriLaPlancia(page, testInfo, larga, tema) {
  await page.setViewportSize({ width: larga, height: 844 });
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript((nomi) => {
    window.gdahomeDice = { postMessage() {} };
    const mettiIlFoglio = () => {
      if (document.getElementById("gdahome-config-fuori")) return true;
      const dove = document.head || document.documentElement;
      if (!dove) return false;
      const fuori = document.createElement("style");
      fuori.id = "gdahome-config-fuori";
      fuori.textContent = '#tab-config,.tab[data-tab="config"]{display:none!important}';
      dove.append(fuori);
      return true;
    };
    if (!mettiIlFoglio()) {
      const attesa = new MutationObserver(() => {
        if (mettiIlFoglio()) attesa.disconnect();
      });
      attesa.observe(document, { childList: true, subtree: true });
    }
    const dmi = new URLSearchParams(location.search).get("dmi");
    if (!dmi) return;
    const chiave = `cd_${dmi}_cd_section_names`;
    if (Storage.prototype.getItem.call(localStorage, chiave) === null)
      Storage.prototype.setItem.call(localStorage, chiave, JSON.stringify(nomi));
  }, NOMI);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate(
    (scelto) => document.documentElement.setAttribute("data-theme", scelto),
    tema,
  );
  const barra = page.locator("nav.tabs.bottom-nav-bar");
  await expect(barra).not.toHaveCSS("opacity", "0");
  for (const nome of Object.values(NOMI)) {
    await expect(barra.locator(".tab .text", { hasText: nome }).first()).toBeVisible();
  }
  return barra;
}

function leggiLaBarra(page) {
  return page.evaluate(() => {
    const barra = document.querySelector("nav.tabs.bottom-nav-bar");
    const voci = [...barra.querySelectorAll(".tab")]
      .filter((voce) => getComputedStyle(voce).display !== "none")
      .map((voce) => {
        const testo = voce.querySelector(".text");
        const stile = getComputedStyle(testo);
        const giro = document.createRange();
        giro.selectNodeContents(testo);
        const righe = new Set([...giro.getClientRects()].map((r) => Math.round(r.top))).size;
        const box = voce.getBoundingClientRect();
        return {
          nome: testo.textContent.trim(),
          righe,
          puntini: stile.textOverflow === "ellipsis",
          tagliato: testo.scrollWidth > testo.clientWidth + 1,
          left: box.left,
          right: box.right,
        };
      });
    return {
      voci,
      paginaLarga: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  });
}

test.describe("barra del telefono: un nome, una riga", () => {
  test.skip(({ isMobile }) => !isMobile, "solo sul telefono");

  for (const larga of [320, 390, 430]) {
    for (const tema of ["light", "dark"]) {
      test(`a ${larga} punti, tema ${tema}: nessun nome a capo o tagliato`, async ({
        page,
      }, testInfo) => {
        const barra = await apriLaPlancia(page, testInfo, larga, tema);
        const { voci, paginaLarga } = await leggiLaBarra(page);
        expect(voci.length).toBeGreaterThanOrEqual(6);
        for (const voce of voci) {
          expect(voce.righe, voce.nome).toBe(1);
          expect(voce.puntini, voce.nome).toBe(false);
          expect(voce.tagliato, voce.nome).toBe(false);
        }
        for (let i = 1; i < voci.length; i += 1) {
          expect(voci[i].left - voci[i - 1].right, voci[i].nome).toBeGreaterThanOrEqual(5);
        }
        expect(paginaLarga).toBe(false);
        if (process.env.DM_RENDER_DIR) {
          await page.screenshot({
            path: `${process.env.DM_RENDER_DIR}/barra-${larga}-${tema}.png`,
            clip: { x: 0, y: 844 - 160, width: larga, height: 160 },
          });
          await barra.evaluate((nav) => {
            nav.scrollLeft = nav.scrollWidth;
            nav.querySelector("*")?.scrollTo?.(1e4, 0);
          });
          await page.waitForTimeout(300);
          await page.screenshot({
            path: `${process.env.DM_RENDER_DIR}/barra-${larga}-${tema}-scorsa.png`,
            clip: { x: 0, y: 844 - 160, width: larga, height: 160 },
          });
        }
      });
    }
  }
});
