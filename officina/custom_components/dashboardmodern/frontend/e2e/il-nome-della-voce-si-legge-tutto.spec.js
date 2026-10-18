/* Il nome di ogni voce della barra si legge tutto.
 *
 * Dal campo, una foto da iPhone: in fondo alla plancia HOME, ENERGIA,
 * «ELETTRO…», AUTO, «GESTIONE…», CLIMA, STANZE. «Il nome deve leggersi.» Il
 * foglio del tocco teneva ogni voce dentro settantadue punti e quello che non
 * ci stava lo tagliava coi puntini.
 *
 * Adesso un nome lungo va a capo su due righe, si rimpicciolisce un poco se le
 * voci non ci stanno (mai sotto i nove punti e mezzo), e una parola sola troppo
 * lunga si spezza fra due sillabe. Qui si guarda la barra disegnata, ai tre
 * telefoni che contano — 320, 390, 430 — piu' il telefono che si apre: nessun
 * nome tagliato, nessun puntino, nessun pezzo di testo fuori dalla sua voce, e
 * la pagina che non scappa di lato. Che la barra scorra quando le voci sono
 * tante e' voluto, ed e' l'unico modo in cui puo' essere piu' larga dello
 * schermo.
 *
 * Le prove fingono l'app, perche' la foto viene da li': l'app porta
 * `gdahomeDice` e il foglio «gdahome-config-fuori» (app/lib/plancia/
 * premesse.dart), e nella sua barra non ci sono GdANav, le Automazioni e la
 * Config, che stanno nel menu dell'app.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SPENTE = {
  temp: false,
  security: false,
  server: false,
  tapparelle: false,
  irrigazione: false,
  piscina: false,
};

function seme(accese) {
  return {
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
    visibility: { ...SPENTE, ...accese },
  };
}

/* Le sette voci della foto: HOME, ENERGIA, ELETTRODOMESTICI, AUTO,
 * GESTIONE …, CLIMA, STANZE. */
const SETTE = seme({
  home: true,
  energy: true,
  appliances: true,
  ev: true,
  boiler: true,
  clima: true,
});
const NOMI_DELLA_FOTO = { appliances: "Elettrodomestici", boiler: "Gestione della casa" };

async function apriLaPlancia(page, testInfo, { larga, alta, nomi, semeDellaCasa, tema }) {
  await page.setViewportSize({ width: larga, height: alta });
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript((nomiDelleSezioni) => {
    window.gdahomeDice = { postMessage() {} };
    /* Il foglio arriva prima della barra, come lo mette l'app. */
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
      Storage.prototype.setItem.call(localStorage, chiave, JSON.stringify(nomiDelleSezioni));
  }, nomi);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, semeDellaCasa);
  if (tema) {
    await page.evaluate(
      (scelto) => document.documentElement.setAttribute("data-theme", scelto),
      tema,
    );
  }
  const barra = page.locator("nav.tabs.bottom-nav-bar");
  await expect(barra).not.toHaveCSS("opacity", "0");
  for (const nome of Object.values(nomi)) {
    await expect(barra.locator(".tab .text", { hasText: nome }).first()).toBeVisible();
  }
}

/* Tutto quello che serve per dire se un nome si legge, letto in un colpo. */
function leggiLaBarra(page) {
  return page.evaluate(() => {
    const barra = document.querySelector("nav.tabs.bottom-nav-bar");
    const riquadroBarra = barra.getBoundingClientRect();
    const stileBarra = getComputedStyle(barra);
    const voci = [...barra.querySelectorAll(".tab")]
      .filter((voce) => getComputedStyle(voce).display !== "none")
      .map((voce) => {
        const nome = voce.querySelector(".text");
        const stile = getComputedStyle(nome);
        const riquadroVoce = voce.getBoundingClientRect();
        const intervallo = document.createRange();
        intervallo.selectNodeContents(nome);
        const righe = [...intervallo.getClientRects()].filter((r) => r.width > 0);
        const icona = voce.querySelector(".icon").getBoundingClientRect();
        const altezzaRiga = parseFloat(stile.lineHeight) || parseFloat(stile.fontSize) * 1.2;
        return {
          voce: voce.dataset.tab,
          attiva: voce.classList.contains("active"),
          testo: nome.textContent,
          ellissi: stile.textOverflow,
          corpo: parseFloat(stile.fontSize),
          scrollW: nome.scrollWidth,
          clientW: nome.clientWidth,
          scrollH: nome.scrollHeight,
          clientH: nome.clientHeight,
          righe: Math.round(nome.getBoundingClientRect().height / altezzaRiga),
          voceSx: riquadroVoce.left,
          voceDx: riquadroVoce.right,
          voceSu: riquadroVoce.top,
          voceGiu: riquadroVoce.bottom,
          testoSx: Math.min(...righe.map((r) => r.left)),
          testoDx: Math.max(...righe.map((r) => r.right)),
          testoSu: Math.min(...righe.map((r) => r.top)),
          testoGiu: Math.max(...righe.map((r) => r.bottom)),
          iconaSu: icona.top,
        };
      });
    return {
      larga: window.innerWidth,
      pagina: document.documentElement.scrollWidth,
      barraSx: riquadroBarra.left,
      barraDx: riquadroBarra.right,
      scorre: barra.scrollWidth > barra.clientWidth + 1,
      scorrimento: stileBarra.overflowX,
      voci,
    };
  });
}

async function laBarraSiLegge(page) {
  /* I nomi si misurano al fotogramma dopo ogni cambio: si aspetta che le
   * misure stiano ferme. */
  let prima = "";
  await expect
    .poll(async () => {
      const adesso = JSON.stringify(await leggiLaBarra(page));
      const ferma = adesso === prima;
      prima = adesso;
      return ferma;
    })
    .toBe(true);
  const barra = await leggiLaBarra(page);

  expect(barra.pagina, "la pagina scappa di lato").toBeLessThanOrEqual(barra.larga);
  expect(barra.barraSx).toBeGreaterThanOrEqual(-0.5);
  expect(barra.barraDx).toBeLessThanOrEqual(barra.larga + 0.5);
  if (barra.scorre) expect(["auto", "scroll"]).toContain(barra.scorrimento);

  for (const voce of barra.voci) {
    const chi = `«${voce.testo}» (${voce.voce})`;
    expect(voce.ellissi, `${chi} si taglia coi puntini`).not.toBe("ellipsis");
    expect(voce.scrollW, `${chi} esce di lato dal suo riquadro`).toBeLessThanOrEqual(voce.clientW);
    expect(voce.scrollH, `${chi} esce di sotto dal suo riquadro`).toBeLessThanOrEqual(
      voce.clientH + 1,
    );
    expect(voce.corpo, `${chi} e' scritto troppo piccolo`).toBeGreaterThanOrEqual(9.5);
    expect(voce.righe, `${chi} va su troppe righe`).toBeLessThanOrEqual(3);
    expect(voce.testoSx, `${chi} esce a sinistra dalla sua voce`).toBeGreaterThanOrEqual(
      voce.voceSx - 0.5,
    );
    expect(voce.testoDx, `${chi} esce a destra dalla sua voce`).toBeLessThanOrEqual(
      voce.voceDx + 0.5,
    );
    expect(voce.testoGiu, `${chi} esce di sotto dalla sua voce`).toBeLessThanOrEqual(
      voce.voceGiu + 0.5,
    );
  }
  /* Le voci stanno in fila, senza montarsi addosso. */
  for (let i = 1; i < barra.voci.length; i += 1) {
    expect(
      barra.voci[i].voceSx,
      `«${barra.voci[i].testo}» sta sopra «${barra.voci[i - 1].testo}»`,
    ).toBeGreaterThanOrEqual(barra.voci[i - 1].voceDx - 0.5);
  }
  /* E i disegni restano allineati, anche quando un nome va su due righe. La
   * voce aperta si alza di proposito di qualche punto: non conta. */
  const ferme = barra.voci.filter((voce) => !voce.attiva);
  const cime = ferme.map((voce) => voce.iconaSu);
  expect(Math.max(...cime) - Math.min(...cime), "i disegni non sono allineati").toBeLessThanOrEqual(
    1,
  );
  return barra;
}

test.describe("sul telefono", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "le misure sono quelle di un telefono");
  });

  for (const [larga, alta, tema, ciStanno] of [
    [320, 640, "dark", false],
    [390, 844, "dark", true],
    [430, 932, "light", true],
  ]) {
    test(`a ${larga} punti i nomi della foto si leggono tutti`, async ({ page }, testInfo) => {
      await apriLaPlancia(page, testInfo, {
        larga,
        alta,
        tema,
        nomi: NOMI_DELLA_FOTO,
        semeDellaCasa: SETTE,
      });
      const lePrevisteDellaFoto = [
        "home",
        "energy",
        "appliances-main",
        "ev",
        "boiler",
        "clima",
        "stanze",
      ];
      /* La barra prende la sua forma quando arriva la configurazione: si
       * aspetta quella, poi si misura. */
      await expect
        .poll(() =>
          page.evaluate(() =>
            [...document.querySelectorAll("nav.tabs.bottom-nav-bar .tab")]
              .filter((voce) => getComputedStyle(voce).display !== "none")
              .map((voce) => voce.dataset.tab),
          ),
        )
        .toEqual(lePrevisteDellaFoto);
      const barra = await laBarraSiLegge(page);
      expect(barra.voci.map((voce) => voce.voce)).toEqual(lePrevisteDellaFoto);
      const testi = Object.fromEntries(barra.voci.map((voce) => [voce.voce, voce.testo]));
      /* Il nome resta il nome: i punti in cui va a capo non sono testo. */
      expect(testi["appliances-main"]).toBe("Elettrodomestici");
      expect(testi.boiler).toBe("Gestione della casa");
      /* Sui telefoni da 390 in su le sette voci della foto stanno tutte in
       * fila, senza scorrere; a 320 la barra scorre come ha sempre fatto. */
      if (ciStanno) expect(barra.scorre, "le sette voci non stanno nella riga").toBe(false);
      const elettro = barra.voci.find((voce) => voce.voce === "appliances-main");
      expect(elettro.righe, "«ELETTRODOMESTICI» non va a capo fra due sillabe").toBe(2);
    });
  }

  test("nomi lunghissimi e nove voci: niente si taglia", async ({ page }, testInfo) => {
    await apriLaPlancia(page, testInfo, {
      larga: 390,
      alta: 844,
      tema: "dark",
      nomi: {
        appliances: "Elettrodomestici",
        boiler: "Gestione della casa",
        clima: "Climatizzazione e riscaldamento centralizzato",
        ev: "Precipitevolissimevolmente",
        energy: "Fotovoltaico",
      },
      semeDellaCasa: seme({
        home: true,
        energy: true,
        appliances: true,
        ev: true,
        boiler: true,
        clima: true,
        temp: true,
        security: true,
      }),
    });
    const barra = await laBarraSiLegge(page);
    expect(barra.voci.length).toBeGreaterThanOrEqual(9);
    expect(barra.scorre, "nove voci lunghe a 390 punti devono scorrere").toBe(true);
  });

  test("cinque voci a 320 punti stanno in fila senza scorrere", async ({ page }, testInfo) => {
    await apriLaPlancia(page, testInfo, {
      larga: 320,
      alta: 640,
      tema: "light",
      nomi: { appliances: "Elettrodomestici" },
      semeDellaCasa: seme({
        home: true,
        energy: true,
        appliances: true,
        ev: true,
        boiler: false,
        clima: false,
      }),
    });
    const barra = await laBarraSiLegge(page);
    expect(barra.voci.length).toBe(5);
    expect(barra.scorre).toBe(false);
  });

  test("un nome cambiato mentre la plancia e' aperta si rimisura", async ({ page }, testInfo) => {
    await apriLaPlancia(page, testInfo, {
      larga: 390,
      alta: 844,
      tema: "dark",
      nomi: NOMI_DELLA_FOTO,
      semeDellaCasa: SETTE,
    });
    await laBarraSiLegge(page);
    /* Come fa la personalizzazione: riscrive il testo della voce. */
    await page.evaluate(() => {
      document.querySelector('nav.tabs .tab[data-tab="ev"] .text').textContent = "Auto elettriche";
    });
    await expect(page.locator('nav.tabs .tab[data-tab="ev"] .text')).toHaveText("Auto elettriche");
    await laBarraSiLegge(page);
  });

  for (const [come, larga, alta] of [
    ["chiuso", 344, 882],
    ["aperto", 884, 1104],
    ["girato", 844, 390],
  ]) {
    test(`telefono ${come} (${larga}x${alta}): i nomi si leggono`, async ({ page }, testInfo) => {
      await apriLaPlancia(page, testInfo, {
        larga,
        alta,
        tema: "dark",
        nomi: NOMI_DELLA_FOTO,
        semeDellaCasa: SETTE,
      });
      await laBarraSiLegge(page);
    });
  }
});

test("sul tablet il nome resta su una riga e intero", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "webkit-ipad", "e' la misura di un tablet");
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript((nomi) => {
    const dmi = new URLSearchParams(location.search).get("dmi");
    if (!dmi) return;
    Storage.prototype.setItem.call(
      localStorage,
      `cd_${dmi}_cd_section_names`,
      JSON.stringify(nomi),
    );
  }, NOMI_DELLA_FOTO);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SETTE);
  await expect(
    page.locator("nav.tabs.bottom-nav-bar .tab .text", { hasText: "Elettrodomestici" }),
  ).toBeVisible();
  const barra = await laBarraSiLegge(page);
  for (const voce of barra.voci) expect(voce.righe, voce.testo).toBe(1);
});
