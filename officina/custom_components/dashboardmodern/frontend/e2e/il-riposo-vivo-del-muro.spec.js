/* Il riposo vivo del tablet a muro, nel browser.
 *
 * «Stile del riposo»: l'orologio di sempre, il «Cielo di casa» che segue
 * l'ora e il meteo veri, la «Cornice foto» con le foto che tiene il ponte.
 * Qui si guarda quello che il tablet fa davvero: il cielo si dipinge su due
 * tele, con la luna di notte e la pioggia quando piove; la cornice senza foto
 * e' il cielo, con le foto le fa passare; di notte resta il nero, salvo «al
 * minimo»; e dal config le foto si caricano, si vedono e si tolgono.
 *
 * Le foto sono disegnate qui, su una tela: paesaggi finti, nessuna foto vera.
 * Con `RIPOSO_FOTOGRAFIE=1` le prove lasciano anche le fotografie delle
 * schermate fra i loro risultati. */
import { expect, test } from "@playwright/test";
import { MURO_DI_PROVA, STATI_A_MURO, apriLaCasaAMuro } from "./helpers/casa-a-muro.js";

const muro = (page) => page.locator("#dm-muro");
const fotografa = async (page, testInfo, nome) => {
  if (!process.env.RIPOSO_FOTOGRAFIE) return;
  /* Il velo d'avvio della plancia, se c'e' ancora, non e' la schermata. */
  await page
    .locator("#cd-boot-overlay")
    .waitFor({ state: "hidden", timeout: 15_000 })
    .catch(() => {});
  await page.screenshot({ path: testInfo.outputPath(`${nome}.png`) });
};

/* Il sole di casa come lo scrive Home Assistant, attorno al giorno della prova. */
function ilSole(adesso, { alba = "07:20", tramonto = "18:35", elevazione }) {
  const giorno = (hhmm, dopo = 0) => {
    const [h, m] = hhmm.split(":").map(Number);
    const d = new Date(adesso);
    d.setHours(h, m, 0, 0);
    if (dopo) d.setDate(d.getDate() + dopo);
    return d;
  };
  const a = giorno(alba);
  const t = giorno(tramonto);
  return {
    "sun.sun": {
      state: elevazione > 0 ? "above_horizon" : "below_horizon",
      attributes: {
        next_rising: (adesso >= a ? giorno(alba, 1) : a).toISOString(),
        next_setting: (adesso >= t ? giorno(tramonto, 1) : t).toISOString(),
        elevation: elevazione,
        rising: adesso < giorno("12:50"),
      },
    },
  };
}

const conIlTempo = (adesso, condizione, gradi, elevazione) => ({
  ...STATI_A_MURO,
  ...ilSole(adesso, { elevazione }),
  "weather.casa": { state: condizione, attributes: { temperature: gradi } },
});

const MURO = (riposo = {}, extra = {}) => ({
  ...MURO_DI_PROVA,
  meteo: "weather.casa",
  riposo: { attivo: true, minuti: 2, ...riposo },
  ...extra,
});

/* Il ponte finto: tiene le foto della cornice in memoria e risponde ai
 * quattro comandi come il ponte vero (`ponte/src/le-foto-del-riposo.js`). Le
 * foto sono paesaggi dipinti qui, su una tela. `amministra: false` e' chi
 * guarda e basta: caricare e togliere gli rispondono di no. */
async function ilPonteDelleFoto(page, { quante = 0, amministra = true } = {}) {
  await page.evaluate(
    async ({ quante, amministra }) => {
      const tavolozze = [
        ["#f6c28b", "#f08a5d", "#b83b5e", "#6a2c70", "#2a1f3d"],
        ["#9ad0ec", "#5fa8d3", "#2e6f95", "#1b4965", "#0f2c3f"],
        ["#e8f1c8", "#a7c957", "#6a994e", "#386641", "#1f3b29"],
        ["#fde2e4", "#cdb4db", "#9d8fc4", "#5e548e", "#2f2850"],
      ];
      async function paesaggio(n, w, h) {
        const tela = new OffscreenCanvas(w, h);
        const x = tela.getContext("2d");
        const [cielo, sole, monti, vicini, lago] = tavolozze[n % tavolozze.length];
        const g = x.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, cielo);
        g.addColorStop(0.62, sole);
        g.addColorStop(1, monti);
        x.fillStyle = g;
        x.fillRect(0, 0, w, h);
        x.fillStyle = "rgba(255,250,235,.85)";
        x.beginPath();
        x.arc(w * (0.25 + 0.18 * n), h * 0.36, h * 0.09, 0, Math.PI * 2);
        x.fill();
        const fila = (colore, base, alto, onde, fase) => {
          x.fillStyle = colore;
          x.beginPath();
          x.moveTo(0, h);
          for (let i = 0; i <= 80; i += 1) {
            const t = i / 80;
            const y =
              base -
              alto *
                (0.5 + 0.5 * Math.sin(t * Math.PI * onde + fase)) *
                (0.7 + 0.3 * Math.sin(t * 9 + fase));
            x.lineTo(t * w, y);
          }
          x.lineTo(w, h);
          x.fill();
        };
        fila(monti, h * 0.72, h * 0.3, 3 + n, n);
        fila(vicini, h * 0.84, h * 0.2, 5 + n, n * 2);
        x.fillStyle = lago;
        x.fillRect(0, h * 0.86, w, h * 0.14);
        x.fillStyle = "rgba(255,255,255,.12)";
        for (let i = 0; i < 9; i += 1)
          x.fillRect(w * (0.1 + i * 0.09), h * (0.89 + (i % 3) * 0.03), w * 0.05, 2);
        const blob = await tela.convertToBlob({ type: "image/jpeg", quality: 0.86 });
        const byte = new Uint8Array(await blob.arrayBuffer());
        let s = "";
        for (let i = 0; i < byte.length; i += 0x8000)
          s += String.fromCharCode(...byte.subarray(i, i + 0x8000));
        return btoa(s);
      }
      const foto = [];
      for (let i = 0; i < quante; i += 1)
        foto.push({
          id: `fotofinta${String(i + 1).padStart(7, "0")}`,
          data: await paesaggio(i, 1600, 1000),
          mini: await paesaggio(i, 320, 200),
          quando: 1000 + i,
        });
      window.__FOTO_FINTE__ = foto;
      window.__DOMANDE_DEL_RIPOSO__ = [];
      class PonteFinto {
        static OPEN = 1;
        readyState = 1;
        constructor() {
          queueMicrotask(() => {
            this.onopen?.({});
            this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
          });
        }
        send(grezzo) {
          const m = JSON.parse(grezzo);
          if (m.type === "auth") return;
          let risultato = null;
          let errore = null;
          if (m.type.startsWith("ponte/riposo/foto/")) window.__DOMANDE_DEL_RIPOSO__.push(m.type);
          const elenco = () =>
            foto.map((f) => ({
              id: f.id,
              tipo: "image/jpeg",
              peso: f.data.length,
              quando: f.quando,
              mini: true,
            }));
          if (m.type === "ponte/riposo/foto/elenco") risultato = { foto: elenco(), al_massimo: 60 };
          else if (m.type === "ponte/riposo/foto/leggi") {
            const f = foto.find((uno) => uno.id === m.foto);
            if (f) risultato = { foto: f.id, tipo: "image/jpeg", data: m.mini ? f.mini : f.data };
            else errore = { code: "not_found", message: "Questa foto non c'e'." };
          } else if (
            m.type === "ponte/riposo/foto/carica" ||
            m.type === "ponte/riposo/foto/togli"
          ) {
            if (!amministra)
              errore = {
                code: "unauthorized",
                message: "questo lo fa solo chi amministra la casa",
              };
            else if (m.type === "ponte/riposo/foto/carica") {
              const id = `caricata${String(foto.length + 1).padStart(8, "0")}`;
              foto.push({ id, data: m.data, mini: m.mini || m.data, quando: Date.now() });
              risultato = { id, tipo: m.tipo, peso: m.data.length };
            } else {
              const i = foto.findIndex((uno) => uno.id === m.foto);
              if (i >= 0) foto.splice(i, 1);
              risultato = { tolta: i >= 0 };
            }
          }
          queueMicrotask(() =>
            this.onmessage?.({
              data: JSON.stringify(
                errore
                  ? { id: m.id, type: "result", success: false, error: errore }
                  : { id: m.id, type: "result", success: true, result: risultato },
              ),
            }),
          );
        }
        close() {}
      }
      window.__DASHBOARDMODERN_BRIDGE_WS__ = PonteFinto;
      window.__DASHBOARDMODERN_HOSTED__ = true;
    },
    { quante, amministra },
  );
}

async function riposa(page) {
  await page.evaluate(() => window.dmMuro.riposa());
}

const tablet = { width: 1280, height: 800 };

test.describe("il riposo vivo del tablet a muro", () => {
  test.use({ deviceScaleFactor: 2 });
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(tablet);
  });

  test("di serie il riposo resta l'orologio di sempre", async ({ page }, testInfo) => {
    await page.clock.install({ time: new Date("2026-10-14T12:30:00") });
    await apriLaCasaAMuro(page, testInfo, { muro: MURO() });
    await riposa(page);
    await expect(muro(page).locator(".mu-orologione")).toBeVisible();
    await expect(muro(page).locator(".mu-vivo")).toHaveCount(0);
  });

  test("il cielo di casa a mezzogiorno sereno: azzurro, col sole, l'ora grande", async ({
    page,
  }, testInfo) => {
    const adesso = new Date("2026-10-14T12:30:00");
    await page.clock.install({ time: adesso });
    await apriLaCasaAMuro(page, testInfo, {
      muro: MURO({ stile: "cielo" }),
      stati: conIlTempo(adesso, "sunny", 19, 38),
    });
    await riposa(page);
    const cielo = muro(page).locator(".mu-riposo.mu-cielo");
    await expect(cielo).toBeVisible();
    await expect(cielo).toHaveAttribute("data-mu-vivo-fase", "giorno");
    await expect(cielo.locator("canvas.mu-vivo-tela")).toHaveCount(2);
    await expect(cielo.locator(".mu-vivo-ora")).toBeVisible();
    await expect(cielo.locator('[data-mu-riposo="meteo"]')).toContainText("19°");
    /* Il fondo e' dipinto, e in alto e' azzurro. */
    await expect
      .poll(() =>
        cielo.locator('canvas[data-mu-vivo="cielo-fondo"]').evaluate((tela) => {
          if (!tela.dataset.dipinta) return "";
          const [r, g, b] = tela.getContext("2d").getImageData(tela.width / 2, 4, 1, 1).data;
          return b > r + 40 && b > g ? "azzurro" : `${r},${g},${b}`;
        }),
      )
      .toBe("azzurro");
    await page.waitForTimeout(2200);
    await fotografa(page, testInfo, "cielo-mezzogiorno-sereno");
  });

  test("al tramonto nuvoloso le nuvole passano piano", async ({ page }, testInfo) => {
    const adesso = new Date("2026-10-14T18:28:00");
    await page.clock.install({ time: adesso });
    await apriLaCasaAMuro(page, testInfo, {
      muro: MURO({ stile: "cielo" }),
      stati: conIlTempo(adesso, "cloudy", 14, 1.2),
    });
    await riposa(page);
    const cielo = muro(page).locator(".mu-riposo.mu-cielo");
    await expect(cielo).toHaveAttribute("data-mu-vivo-fase", "tramonto");
    /* Le nuvole sono sulla tela davanti, che si muove. */
    const moto = cielo.locator('canvas[data-mu-vivo="cielo-moto"]');
    const quanto = () =>
      moto.evaluate((tela) => {
        const dati = tela.getContext("2d").getImageData(0, 0, tela.width, tela.height).data;
        let pieni = 0;
        for (let i = 3; i < dati.length; i += 64) if (dati[i] > 10) pieni += 1;
        return pieni;
      });
    await expect.poll(quanto).toBeGreaterThan(200);
    await page.waitForTimeout(2200);
    await fotografa(page, testInfo, "cielo-tramonto-nuvoloso");
  });

  test("di notte le stelle e la luna nella sua fase", async ({ page }, testInfo) => {
    const adesso = new Date("2026-10-22T21:40:00");
    await page.clock.install({ time: adesso });
    await apriLaCasaAMuro(page, testInfo, {
      muro: MURO({ stile: "cielo" }),
      stati: conIlTempo(adesso, "clear-night", 11, -40),
    });
    await riposa(page);
    const cielo = muro(page).locator(".mu-riposo.mu-cielo");
    await expect(cielo).toHaveAttribute("data-mu-vivo-fase", "notte");
    await page.waitForTimeout(2200);
    await fotografa(page, testInfo, "cielo-notte-luna");
  });

  test("con la pioggia cade la pioggia", async ({ page }, testInfo) => {
    const adesso = new Date("2026-10-14T15:10:00");
    await page.clock.install({ time: adesso });
    await apriLaCasaAMuro(page, testInfo, {
      muro: MURO({ stile: "cielo" }),
      stati: conIlTempo(adesso, "rainy", 13, 24),
    });
    await riposa(page);
    await expect(muro(page).locator(".mu-riposo.mu-cielo")).toBeVisible();
    await page.waitForTimeout(2200);
    await fotografa(page, testInfo, "cielo-pioggia");
  });

  test("con meno movimento il cielo e' un'immagine ferma", async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const adesso = new Date("2026-10-14T15:10:00");
    await page.clock.install({ time: adesso });
    await apriLaCasaAMuro(page, testInfo, {
      muro: MURO({ stile: "cielo" }),
      stati: conIlTempo(adesso, "rainy", 13, 24),
    });
    await riposa(page);
    const moto = muro(page).locator('canvas[data-mu-vivo="cielo-moto"]');
    await expect(moto).toHaveCount(1);
    const firma = () =>
      moto.evaluate((tela) => tela.toDataURL().length + ":" + tela.toDataURL().slice(-64));
    await page.waitForTimeout(600);
    const prima = await firma();
    await page.waitForTimeout(1200);
    expect(await firma()).toBe(prima);
  });

  test("la cornice senza foto ripiega sul cielo", async ({ page }, testInfo) => {
    const adesso = new Date("2026-10-14T12:30:00");
    await page.clock.install({ time: adesso });
    await apriLaCasaAMuro(page, testInfo, {
      muro: MURO({ stile: "foto" }),
      stati: conIlTempo(adesso, "sunny", 19, 38),
    });
    await ilPonteDelleFoto(page, { quante: 0 });
    await riposa(page);
    await expect(muro(page).locator(".mu-riposo.mu-cielo")).toBeVisible();
    await expect(muro(page).locator(".mu-cornice")).toHaveCount(0);
  });

  test("la cornice fa passare le foto del ponte, una dopo l'altra", async ({ page }, testInfo) => {
    const adesso = new Date("2026-10-14T16:05:00");
    await page.clock.install({ time: adesso });
    await apriLaCasaAMuro(page, testInfo, {
      muro: MURO({ stile: "foto", ogni: 30 }),
      stati: conIlTempo(adesso, "partlycloudy", 17, 18),
    });
    await ilPonteDelleFoto(page, { quante: 4 });
    await riposa(page);
    const cornice = muro(page).locator(".mu-riposo.mu-cornice");
    await expect(cornice).toBeVisible();
    const foto = cornice.locator("img[data-mu-foto]").last();
    await expect(foto).toHaveAttribute("src", /^blob:/);
    await expect(cornice.locator(".mu-cornice-ora")).toBeVisible();
    await expect(cornice.locator('[data-mu-riposo="meteo"]')).toContainText("17°");
    const prima = await foto.getAttribute("data-mu-foto");
    await page.waitForTimeout(3500);
    await fotografa(page, testInfo, "cornice-foto");
    await page.clock.runFor(31_000);
    await expect
      .poll(() => cornice.locator("img[data-mu-foto]").last().getAttribute("data-mu-foto"))
      .not.toBe(prima);
    /* Le foto vengono dal ponte, e da nessun'altra parte. */
    const domande = await page.evaluate(() => window.__DOMANDE_DEL_RIPOSO__);
    expect(domande).toContain("ponte/riposo/foto/elenco");
    expect(domande).toContain("ponte/riposo/foto/leggi");
  });

  test("di notte resta il nero; «al minimo» resta acceso, appena visibile", async ({
    page,
  }, testInfo) => {
    const adesso = new Date("2026-10-14T23:30:00");
    await page.clock.install({ time: adesso });
    const notte = { notte: { attiva: true, da: "22:00", a: "06:30" } };
    await apriLaCasaAMuro(page, testInfo, {
      muro: MURO({ stile: "cielo" }, notte),
      stati: conIlTempo(adesso, "clear-night", 9, -45),
    });
    await riposa(page);
    await expect(muro(page).locator(".mu-riposo.notte")).toBeVisible();
    await expect(muro(page).locator(".mu-cielo")).toHaveCount(0);
    await page.evaluate(
      (m) => {
        localStorage.setItem("cd_muro", JSON.stringify(m));
        window.dispatchEvent(new CustomEvent("dashboardmodern:muro"));
      },
      MURO({ stile: "cielo", notteAlMinimo: true }, notte),
    );
    await riposa(page);
    const minimo = muro(page).locator(".mu-riposo.mu-cielo.minimo");
    await expect(minimo).toBeVisible();
    const luce = await minimo
      .locator(".mu-vivo-blocco")
      .evaluate((n) => Number(/brightness\(([\d.]+)\)/.exec(getComputedStyle(n).filter)?.[1] ?? 1));
    expect(luce).toBeLessThan(0.3);
    await page.waitForTimeout(1500);
    await fotografa(page, testInfo, "cielo-notte-al-minimo");
  });

  test("dove il periodo ha gia' una scena sua, il riposo vivo non si mette davanti", async ({
    page,
  }, testInfo) => {
    const adesso = new Date("2026-12-15T12:30:00");
    await page.clock.install({ time: adesso });
    await apriLaCasaAMuro(page, testInfo, {
      muro: MURO({ stile: "cielo" }),
      stati: conIlTempo(adesso, "sunny", 4, 20),
    });
    await riposa(page);
    await expect(muro(page).locator(".mu-riposo[data-mu-scena]")).toBeVisible();
    await expect(muro(page).locator(".mu-vivo")).toHaveCount(0);
  });
});

/* ── il config ──────────────────────────────────────────────────────────── */

/* La riga dello stile in cima alla vista, sotto la ricerca che resta ferma. */
const allaRigaDelloStile = (body) =>
  body
    .locator('[data-mu-ed-metti="riposo.stile"]')
    .first()
    .evaluate((tasto) => {
      const riga = tasto.closest(".mu-ed-riga");
      riga.style.scrollMarginTop = "250px";
      riga.scrollIntoView({ block: "start" });
    });

async function apriLAltro(page) {
  await page.evaluate(() => window.apriConfigEntita());
  await page.locator('.ed-tab[data-tab="muro"]').click();
  const body = page.locator("#ed-body");
  await expect(body.locator(".mu-ed")).toBeVisible();
  await body.locator("[data-mu-ed-altro]").click();
  return body;
}

/* Un PNG vero, piccolo, fatto qui: quello che sceglie chi carica. */
async function unaFotoDaCaricare(page) {
  const base64 = await page.evaluate(async () => {
    const tela = new OffscreenCanvas(800, 500);
    const x = tela.getContext("2d");
    const g = x.createLinearGradient(0, 0, 0, 500);
    g.addColorStop(0, "#7dd3fc");
    g.addColorStop(1, "#f59e0b");
    x.fillStyle = g;
    x.fillRect(0, 0, 800, 500);
    const blob = await tela.convertToBlob({ type: "image/png" });
    const byte = new Uint8Array(await blob.arrayBuffer());
    let s = "";
    for (const b of byte) s += String.fromCharCode(b);
    return btoa(s);
  });
  return { name: "finta.png", mimeType: "image/png", buffer: Buffer.from(base64, "base64") };
}

test.describe("lo stile del riposo nel config", () => {
  test.use({ deviceScaleFactor: 2 });
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  test("si sceglie lo stile; la cornice senza foto invita a caricarne", async ({
    page,
  }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, { muro: MURO() });
    await ilPonteDelleFoto(page, { quante: 0 });
    const body = await apriLAltro(page);
    await expect(
      body.locator('[data-mu-ed-metti="riposo.stile"][data-mu-ed-valore="orologio"]'),
    ).toHaveClass(/si/);
    await body.locator('[data-mu-ed-metti="riposo.stile"][data-mu-ed-valore="foto"]').click();
    await expect(body.locator(".mu-ed-foto-invito")).toBeVisible();
    await expect(body.locator('[data-mu-ed-metti="riposo.ogni"]')).toHaveCount(3);
    await body.locator('[data-mu-ed-metti="riposo.ogni"][data-mu-ed-valore="300"]').click();
    await body.locator('[data-mu-ed-alterna="riposo.notteAlMinimo"]').click();
    await body.locator("[data-dm-save-all]").click();
    const salvato = await page.evaluate(() => JSON.parse(localStorage.getItem("cd_muro")).riposo);
    expect(salvato.stile).toBe("foto");
    expect(salvato.ogni).toBe(300);
    expect(salvato.notteAlMinimo).toBe(true);
  });

  test("le foto si caricano dal config, si vedono e si tolgono col secondo tocco", async ({
    page,
  }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, { muro: MURO({ stile: "foto" }) });
    await ilPonteDelleFoto(page, { quante: 3 });
    const body = await apriLAltro(page);
    await expect(body.locator(".mu-ed-foto-voce")).toHaveCount(3);
    await body.locator("[data-mu-ed-foto-file]").setInputFiles(await unaFotoDaCaricare(page));
    await expect(body.locator(".mu-ed-foto-voce")).toHaveCount(4);
    await expect(body.locator("[data-mu-ed-foto-stato]")).toContainText(/caricata/i);
    /* Quello che e' arrivato al ponte e' un JPEG rimpicciolito, con la miniatura. */
    const caricata = await page.evaluate(() => window.__FOTO_FINTE__.at(-1));
    expect(caricata.data.slice(0, 4)).toBe("/9j/");
    expect(caricata.mini.slice(0, 4)).toBe("/9j/");
    await expect(body.locator(".mu-ed-foto-voce img").first()).toHaveAttribute("src", /^blob:/);
    await page.waitForTimeout(600);
    await allaRigaDelloStile(body);
    await fotografa(page, testInfo, "configuratore-chiaro");
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
    await page.waitForTimeout(400);
    await fotografa(page, testInfo, "configuratore-scuro");
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
    const togli = body.locator("[data-mu-ed-foto-togli]").first();
    await togli.click();
    await expect(body.locator(".mu-ed-foto-voce.togli")).toHaveCount(1);
    await body.locator("[data-mu-ed-foto-togli]").first().click();
    await expect(body.locator(".mu-ed-foto-voce")).toHaveCount(3);
  });

  test("chi non amministra si sente dire perche' non carica", async ({ page }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, { muro: MURO({ stile: "foto" }) });
    await ilPonteDelleFoto(page, { quante: 1, amministra: false });
    const body = await apriLAltro(page);
    await body.locator("[data-mu-ed-foto-file]").setInputFiles(await unaFotoDaCaricare(page));
    await expect(body.locator("[data-mu-ed-foto-stato]")).toContainText(/amministra/i);
    await expect(body.locator(".mu-ed-foto-voce")).toHaveCount(1);
  });
});

/* ── sul telefono ───────────────────────────────────────────────────────── */

test.describe("il riposo vivo su uno schermo piccolo", () => {
  test.use({
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });

  test("il cielo e la cornice in verticale", async ({ page }, testInfo) => {
    const adesso = new Date("2026-10-14T18:28:00");
    await page.clock.install({ time: adesso });
    await apriLaCasaAMuro(page, testInfo, {
      muro: MURO({ stile: "cielo" }),
      stati: conIlTempo(adesso, "partlycloudy", 15, 1.2),
    });
    await riposa(page);
    await expect(muro(page).locator(".mu-riposo.mu-cielo")).toBeVisible();
    await page.waitForTimeout(2200);
    await fotografa(page, testInfo, "telefono-cielo-tramonto");
    await ilPonteDelleFoto(page, { quante: 4 });
    await page.evaluate(
      (m) => {
        localStorage.setItem("cd_muro", JSON.stringify(m));
        window.dispatchEvent(new CustomEvent("dashboardmodern:muro"));
      },
      MURO({ stile: "foto" }),
    );
    await riposa(page);
    await expect(muro(page).locator(".mu-riposo.mu-cornice img[data-mu-foto]")).toHaveCount(1);
    await page.waitForTimeout(3000);
    await fotografa(page, testInfo, "telefono-cornice");
  });

  test("il config del riposo sul telefono", async ({ page }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, { muro: MURO({ stile: "foto" }) });
    await ilPonteDelleFoto(page, { quante: 4 });
    const body = await apriLAltro(page);
    await expect(body.locator(".mu-ed-foto-voce")).toHaveCount(4);
    await page.waitForTimeout(600);
    await allaRigaDelloStile(body);
    await fotografa(page, testInfo, "telefono-configuratore-chiaro");
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
    await page.waitForTimeout(400);
    await fotografa(page, testInfo, "telefono-configuratore-scuro");
  });
});
