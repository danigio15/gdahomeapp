/* La finestra del termostato, dopo la revisione.
 *
 * Sei cose che la prima versione rifatta sbagliava, provate a 360, a 390 e
 * sul computer:
 *
 *   1. il meno e il piu' grandi usavano il passo del guscio — un grado intero
 *      fra 10 e 35 — e una pompa di calore a 45° col piu' andava a 35;
 *   2. coi due obiettivi la coppia stava grande in cima («20.5° – 24.5°», col
 *      punto) e di nuovo nel pannello: adesso sta una volta sola, nella
 *      testata, con i suoi due meno e piu';
 *   3. un'unita' «non disponibile» si diceva «Spento» con «Accendi»;
 *   4. la pastiglia del Programma a 360 diventava «Attivo · dom…»;
 *   6. due zone e il Report sul telefono: linguette di larghezze diverse e il
 *      fiocco contro il bordo;
 *  13. i preset: «none» contava, un'unita' col solo «boost» restava senza
 *      riga, e «sleep» delle modalita' stava fra i preset accanto a un altro
 *      «Notte».
 *
 * Con DM_RENDER=<cartella> le stesse prove lasciano le foto «dopo-*».
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SCHERMI = [
  { nome: "telefono360", width: 360, height: 780 },
  { nome: "telefono390", width: 390, height: 844 },
  { nome: "computer", width: 1280, height: 900 },
];

const seme = (climate) => ({
  schema_version: 4,
  sections: {
    rooms: [
      { id: "room-salone", name: "Salone", icon: "🛋️", metadata: {} },
      { id: "room-bagno", name: "Bagno", icon: "🛁", metadata: {} },
      { id: "room-locale", name: "Locale tecnico", icon: "🔧", metadata: {} },
    ],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate,
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { clima: true },
});

const UNITA = [
  {
    id: "c1",
    name: "Pompa di calore",
    entity: "climate.pompa",
    room: "room-locale",
    type: "pompa",
  },
  { id: "c2", name: "Split Salone", entity: "climate.doppio", room: "room-salone", type: "clima" },
  { id: "c3", name: "Valvola Bagno", entity: "climate.morto", room: "room-bagno", type: "termo" },
  { id: "c4", name: "Camera", entity: "climate.notte", room: "room-salone", type: "clima" },
];

const STATI = {
  "climate.pompa": {
    state: "heat",
    attributes: {
      friendly_name: "Pompa di calore",
      hvac_modes: ["off", "heat"],
      hvac_action: "heating",
      current_temperature: 44,
      temperature: 45,
      min_temp: 5,
      max_temp: 60,
      target_temp_step: 0.5,
      preset_modes: ["boost"],
      preset_mode: null,
    },
  },
  "climate.doppio": {
    state: "heat_cool",
    attributes: {
      friendly_name: "Split Salone",
      hvac_modes: ["off", "heat_cool", "heat", "cool"],
      hvac_action: "idle",
      current_temperature: 22.4,
      target_temp_low: 20.5,
      target_temp_high: 24.5,
      min_temp: 16,
      max_temp: 30,
      target_temp_step: 0.5,
    },
  },
  "climate.morto": { state: "unavailable", attributes: { friendly_name: "Valvola Bagno" } },
  "climate.notte": {
    state: "cool",
    attributes: {
      friendly_name: "Camera",
      hvac_modes: ["off", "cool", "heat", "sleep"],
      hvac_action: "cooling",
      current_temperature: 25,
      temperature: 24,
      min_temp: 16,
      max_temp: 30,
      target_temp_step: 1,
      preset_modes: ["none", "sleep", "eco"],
      preset_mode: "none",
    },
  },
};

async function avvia(page, testInfo, schermo, climate = UNITA, stati = STATI) {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: schermo.width, height: schermo.height });
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme(climate));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate((stati) => {
    const grezzi = window.eval("_RAW_STATES");
    for (const [id, stato] of Object.entries(stati)) grezzi[id] = { entity_id: id, ...stato };
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, stati);
  await page.waitForTimeout(900);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate(() => {
    window.__chiamate = [];
    window.dmCallHaService = (dominio, servizio, dati) => {
      window.__chiamate.push({ dominio, servizio, dati });
      return Promise.resolve(true);
    };
  });
}

const chiamate = (page) =>
  page.evaluate(() => window.__chiamate.filter((c) => c.servizio === "set_temperature"));
const finestra = (page) => page.locator("#clima-popup-overlay .clima-popup");

async function apri(page, entita) {
  await page.evaluate(() => {
    window.__chiamate = [];
  });
  await page.evaluate((e) => window.apriClimaPopup?.(e, null), entita);
  await expect(finestra(page)).toHaveAttribute("data-dm-cpf", "1");
}

async function senzaStrabordare(page) {
  const misure = await finestra(page).evaluate((nodo) => {
    const r = nodo.getBoundingClientRect();
    const fuori = [...nodo.querySelectorAll("*")].filter((n) => {
      const q = n.getBoundingClientRect();
      return (
        q.width &&
        getComputedStyle(n).visibility !== "hidden" &&
        (q.right > r.right + 1 || q.left < r.left - 1)
      );
    });
    return {
      scorre: nodo.scrollWidth - nodo.clientWidth,
      fuori: fuori.map((n) => n.className || n.tagName),
    };
  });
  expect(misure.scorre).toBeLessThanOrEqual(1);
  expect(misure.fuori).toEqual([]);
}

async function foto(page, nome, quale = finestra(page)) {
  if (!process.env.DM_RENDER) return;
  await page.waitForTimeout(250);
  await quale.screenshot({ path: `${process.env.DM_RENDER}/${nome}.png` });
}

for (const schermo of SCHERMI) {
  test.describe(`${schermo.nome}`, () => {
    test(`1 · il meno e il piu' grandi seguono il passo e la scala dell'unita' (${schermo.nome})`, async ({
      page,
    }, testInfo) => {
      await avvia(page, testInfo, schermo);
      await apri(page, "climate.pompa");
      const gradi = page.locator("#cp-temp-val");
      await expect(gradi).toHaveText("45°");
      const piu = finestra(page).locator(".clima-temp-btn").last();
      const meno = finestra(page).locator(".clima-temp-btn").first();
      await piu.click();
      await expect.poll(() => chiamate(page)).toHaveLength(1);
      expect((await chiamate(page))[0].dati).toEqual({
        entity_id: "climate.pompa",
        temperature: 45.5,
      });
      await expect(gradi).toHaveText("45,5°");
      await foto(page, `dopo-pompa-di-calore-45-${schermo.nome}`);
      // Un tocco dopo l'altro parte da quello sullo schermo, non da quello vecchio.
      await piu.click();
      await expect.poll(() => chiamate(page)).toHaveLength(2);
      expect((await chiamate(page))[1].dati.temperature).toBe(46);
      // Al tetto (60°) si arriva e non si passa.
      await page.evaluate(() => {
        window.eval("_RAW_STATES")["climate.pompa"].attributes.temperature = 59.5;
        window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
      });
      await page.waitForTimeout(400);
      await page.evaluate(() => window.apriClimaPopup?.("climate.pompa", null));
      await expect(gradi).toHaveText("59,5°");
      await page.evaluate(() => {
        window.__chiamate = [];
      });
      await piu.click();
      await expect.poll(() => chiamate(page)).toHaveLength(1);
      expect((await chiamate(page))[0].dati.temperature).toBe(60);
      await piu.click();
      await page.waitForTimeout(300);
      expect(await chiamate(page)).toHaveLength(1);
      // E al pavimento (5°) lo stesso.
      await page.evaluate(() => {
        window.eval("_RAW_STATES")["climate.pompa"].attributes.temperature = 5;
        window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
      });
      await page.waitForTimeout(400);
      await page.evaluate(() => window.apriClimaPopup?.("climate.pompa", null));
      await expect(gradi).toHaveText("5°");
      await page.evaluate(() => {
        window.__chiamate = [];
      });
      await meno.click();
      await page.waitForTimeout(300);
      expect(await chiamate(page)).toHaveLength(0);
      await senzaStrabordare(page);
    });

    test(`2 · i due obiettivi stanno una volta sola, nella testata, con la virgola (${schermo.nome})`, async ({
      page,
    }, testInfo) => {
      await avvia(page, testInfo, schermo);
      await apri(page, "climate.doppio");
      const coppia = finestra(page).locator("[data-dm-cpf-coppia]");
      await expect(coppia).toBeVisible();
      await expect(coppia.locator('[data-dm-w-obiettivo="basso"]')).toContainText("Minima (caldo)");
      await expect(coppia.locator('[data-dm-w-obiettivo="alto"]')).toContainText(
        "Massima (freddo)",
      );
      await expect(coppia.locator('[data-dm-w-obiettivo="basso"] b')).toHaveText("20,5°");
      await expect(coppia.locator('[data-dm-w-obiettivo="alto"] b')).toHaveText("24,5°");
      // Il numero non si ripete: niente gradi grandi del guscio, niente passi nel pannello.
      await expect(page.locator("#cp-temp-val")).toBeHidden();
      await expect(finestra(page).locator(".clima-temp-btn").first()).toBeHidden();
      await expect(finestra(page).locator("[data-dm-cl-panel] [data-dm-w-temp]")).toHaveCount(0);
      expect(await finestra(page).innerText()).not.toMatch(/\d\.\d°/);
      // «Caldo e freddo» si chiama «Auto», e non si taglia.
      const auto = finestra(page).locator('.dm-cpf-modo[data-dm-w-mode="heat_cool"] span');
      await expect(auto).toHaveText("Auto");
      expect(await auto.evaluate((n) => n.scrollWidth <= n.clientWidth)).toBe(true);
      for (const tasto of await coppia.locator("button").all()) {
        const box = await tasto.boundingBox();
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
      await coppia.locator('[data-dm-w-obj="alto"][data-dm-w-temp="1"]').click();
      await expect.poll(() => chiamate(page)).toHaveLength(1);
      expect((await chiamate(page))[0].dati).toEqual({
        entity_id: "climate.doppio",
        target_temp_low: 20.5,
        target_temp_high: 25,
      });
      await senzaStrabordare(page);
      await foto(page, `dopo-doppio-obiettivo-${schermo.nome}`);
    });

    test(`3 · un'unita' che non risponde e' «Non disponibile», senza comandi (${schermo.nome})`, async ({
      page,
    }, testInfo) => {
      await avvia(page, testInfo, schermo);
      await apri(page, "climate.morto");
      await expect(finestra(page).locator(".dm-cpf-stato")).toHaveText("Non disponibile");
      await expect(finestra(page)).not.toContainText("Spento");
      await expect(page.locator("#cp-btn-on")).toBeHidden();
      await expect(page.locator("#cp-btn-off")).toBeHidden();
      await expect(finestra(page).locator(".clima-temp-btn").first()).toBeHidden();
      await expect(page.locator("#cp-temp-val")).toBeHidden();
      await expect(finestra(page).locator("[data-dm-w-mode]")).toHaveCount(0);
      await expect(page.locator("#cp-mode-section")).toBeHidden();
      await senzaStrabordare(page);
      await foto(page, `dopo-non-disponibile-${schermo.nome}`);
    });

    test(`13 · preset: «none» non conta, mai due «Notte» (${schermo.nome})`, async ({
      page,
    }, testInfo) => {
      await avvia(page, testInfo, schermo);
      // Un'unita' col solo «boost» ha la riga.
      await apri(page, "climate.pompa");
      const riga = finestra(page).locator(".dm-cpf-riga", { hasText: "Preimpostazione" });
      await expect(riga).toBeVisible();
      await expect(riga.locator("[data-dm-w-preset]")).toHaveText(["Boost"]);
      await expect(finestra(page)).not.toContainText("Preset");

      // «sleep» fra le modalita' sta in «Altre modalità», e il preset omonimo non si offre.
      await apri(page, "climate.notte");
      const altre = finestra(page).locator(".dm-cpf-riga", { hasText: "Altre modalità" });
      await expect(altre.locator('[data-dm-w-mode="sleep"]')).toHaveText("Notte");
      const preset = finestra(page).locator(".dm-cpf-riga", { hasText: "Preimpostazione" });
      await expect(preset.locator("[data-dm-w-preset]")).toHaveText(["Nessuno", "Eco"]);
      expect((await finestra(page).innerText()).match(/Notte/g)).toHaveLength(1);
      // Nel segmentato solo le modalita' di Home Assistant.
      await expect(finestra(page).locator(".dm-cpf-modo")).toHaveText([
        "Spento",
        "Caldo",
        "Freddo",
      ]);
      await altre.locator('[data-dm-w-mode="sleep"]').click();
      await expect
        .poll(() =>
          page.evaluate(() => window.__chiamate.filter((c) => c.servizio === "set_hvac_mode")),
        )
        .toEqual([
          {
            dominio: "climate",
            servizio: "set_hvac_mode",
            dati: { entity_id: "climate.notte", hvac_mode: "sleep" },
          },
        ]);
      await senzaStrabordare(page);
    });

    test(`6 · due zone e il Report: linguette pari, nessuna contro il bordo (${schermo.nome})`, async ({
      page,
    }, testInfo) => {
      await avvia(
        page,
        testInfo,
        schermo,
        [
          {
            id: "c1",
            name: "Split Salone",
            entity: "climate.split",
            room: "room-salone",
            type: "clima",
          },
          {
            id: "c2",
            name: "Termosifone Bagno",
            entity: "climate.termo",
            room: "room-bagno",
            type: "termo",
          },
        ],
        {
          "climate.split": STATI["climate.notte"],
          "climate.termo": STATI["climate.pompa"],
        },
      );
      await page.evaluate(() => {
        document.querySelectorAll(".page").forEach((n) => n.classList.remove("active"));
        document.getElementById("page-clima")?.classList.add("active");
        window.buildClimaCards?.();
      });
      const commutatore = page.locator("#page-clima .clima-page-mode-switch");
      await expect(commutatore).toBeVisible();
      await expect(page.locator("#page-clima .dm-cl-tab-report")).toBeVisible();
      await expect(page.locator("#page-clima .dm-cl-shell")).toHaveAttribute(
        "data-dm-cl-report",
        "1",
      );
      const misure = await commutatore.evaluate((nodo) => {
        const r = nodo.getBoundingClientRect();
        const tasti = [...nodo.querySelectorAll(".clima-page-mode-btn")].filter(
          (t) => t.offsetParent,
        );
        return {
          scorre: nodo.scrollWidth - nodo.clientWidth,
          zone: tasti
            .filter((t) => t.dataset.dmClZone)
            .map((t) => {
              const q = t.getBoundingClientRect();
              const icona = t.querySelector(".dm-cl-tab-ic");
              const testo = t.querySelector(".dm-cl-tab-tx");
              return {
                largo: Math.round(q.width),
                dentro: q.left >= r.left - 0.5 && q.right <= r.right + 0.5,
                icona: icona ? getComputedStyle(icona).display !== "none" : false,
                taglia: testo ? testo.scrollWidth > testo.clientWidth + 1 : false,
                tocca: [...t.children].some((c) => {
                  const z = c.getBoundingClientRect();
                  return z.width && (z.left < q.left + 2 || z.right > q.right - 2);
                }),
              };
            }),
          report: (() => {
            const t = nodo.querySelector(".dm-cl-tab-report");
            const q = t.getBoundingClientRect();
            return {
              largo: Math.round(q.width),
              dentro: q.left >= r.left - 0.5 && q.right <= r.right + 0.5,
            };
          })(),
        };
      });
      expect(misure.scorre).toBeLessThanOrEqual(0);
      expect(misure.zone).toHaveLength(2);
      expect(Math.abs(misure.zone[0].largo - misure.zone[1].largo)).toBeLessThanOrEqual(1);
      for (const zona of misure.zone) {
        expect(zona.dentro).toBe(true);
        expect(zona.taglia).toBe(false);
        expect(zona.tocca).toBe(false);
        // Sotto i 400 px il disegno se ne va: il nome basta.
        expect(zona.icona).toBe(schermo.width > 400);
      }
      expect(misure.report.dentro).toBe(true);
      if (schermo.width <= 400) expect(misure.report.largo).toBeLessThanOrEqual(56);
      // Le linguette dicono la scelta: aria-selected, anche col Report aperto.
      await expect(page.locator("#clima-page-mode-freddo")).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await page.locator("#page-clima .dm-cl-tab-report").click();
      await expect(page.locator("#page-clima .dm-cl-tab-report")).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await expect(page.locator("#clima-page-mode-freddo")).toHaveAttribute(
        "aria-selected",
        "false",
      );
      // Esc chiude il report solo se davanti non c'e' una finestra.
      await page.evaluate(() => window.apriClimaPopup?.("climate.split", null));
      await page.keyboard.press("Escape");
      await expect(page.locator("#dm-rcl")).toBeVisible();
      await page.evaluate(() =>
        document.getElementById("clima-popup-overlay").classList.remove("show"),
      );
      await page.keyboard.press("Escape");
      await expect(page.locator("#dm-rcl")).toBeHidden();
      if (schermo.width === 360) {
        await page.locator("#page-clima .dm-cl-tab-report").click();
        await page.locator("#clima-page-mode-freddo").click();
        await foto(
          page,
          `dopo-linguette-due-zone-${schermo.nome}`,
          page.locator("#page-clima .dm-cl-shell .clima-page-mode-switch"),
        );
      }
    });
  });
}
