/* I pezzi delle macchine si spostano dentro le loro scene (#379).
 *
 * «Vedi come poter spostare le cose anche nei disegni.» Dopo il solare termico
 * e il flusso dell'energia: lo scaldabagno, la caldaia, la stufa a pellet e il
 * gruppo di continuita'. Con ✏️ ogni pezzo ha la sua maniglia; i tubi (e i
 * cavi dell'UPS) che toccano un pezzo spostato si rifanno, gli altri restano
 * quelli disegnati a mano. Salva scrive `cd_disegni` («caldaia:computer»,
 * «ups:computer», …). Senza una scelta la scena e' quella di sempre: nessuno
 * stile e nessun tubo toccato.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

test.use({ timezoneId: "Europe/Rome", locale: "it-IT" });

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
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
  visibility: { home: true, ups: true },
};
const s = (id, state, attributes = {}) => [id, { entity_id: id, state, attributes }];
const STATI = Object.fromEntries([
  s("switch.sb", "on"),
  s("sensor.sb_t", "52", { unit_of_measurement: "°C" }),
  s("sensor.sb_obj", "60", { unit_of_measurement: "°C" }),
  s("sensor.k_stato", "on"),
  s("sensor.k_mandata", "62", { unit_of_measurement: "°C" }),
  s("sensor.k_ritorno", "48", { unit_of_measurement: "°C" }),
  s("sensor.k_pressione", "1.4", { unit_of_measurement: "bar" }),
  s("climate.stufa", "heat", {
    temperature: 21,
    current_temperature: 20.5,
    hvac_modes: ["off", "heat"],
    hvac_action: "heating",
  }),
  s("sensor.s_temp", "20.5", { unit_of_measurement: "°C" }),
  s("sensor.s_fumi", "142", { unit_of_measurement: "°C" }),
  s("sensor.u_stato", "OL"),
  s("sensor.u_batt", "96", { unit_of_measurement: "%" }),
  s("sensor.u_carico", "31", { unit_of_measurement: "%" }),
]);
const CONF = {
  cd_impianti_termici: { solare: false, scaldabagno: true, caldaia: true, stufa: true },
  cd_scaldabagni: [
    {
      name: "Scaldabagno",
      interruttore: "switch.sb",
      temperatura: "sensor.sb_t",
      obiettivo: "sensor.sb_obj",
    },
  ],
  cd_caldaia: [
    {
      id: "k",
      name: "Caldaia",
      stato: "sensor.k_stato",
      mandata: "sensor.k_mandata",
      ritorno: "sensor.k_ritorno",
      pressione: "sensor.k_pressione",
    },
  ],
  cd_stufe: [
    { name: "Stufa", clima: "climate.stufa", temperatura: "sensor.s_temp", fumi: "sensor.s_fumi" },
  ],
  cd_ups: [
    {
      uid: "ups-1",
      name: "UPS",
      stato: "sensor.u_stato",
      batteria: "sensor.u_batt",
      carico: "sensor.u_carico",
    },
  ],
};

async function avvia(page, testInfo) {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.locator("#setup-wizard").evaluateAll((n) => n.forEach((x) => x.remove()));
  await page.evaluate(
    ({ stati, conf }) => {
      Object.assign(eval("_RAW_STATES"), stati);
      if (typeof STATES !== "undefined")
        for (const [id, voce] of Object.entries(stati)) STATES[id] = structuredClone(voce);
      for (const [k, v] of Object.entries(conf)) localStorage.setItem(k, JSON.stringify(v));
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    },
    { stati: STATI, conf: CONF },
  );
}

async function apriLaMacchina(page, tipo) {
  await page.evaluate(() => {
    document.querySelectorAll(".page").forEach((n) => n.classList.remove("active"));
    document.getElementById("page-boiler")?.classList.add("active");
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  });
  const tab = page.locator(".dm-it-tab", { hasText: new RegExp(tipo, "i") }).first();
  await expect(tab).toBeVisible({ timeout: 20_000 });
  await tab.click();
  await expect(page.locator(`.dm-it-scena[data-dm-it-scena="${tipo}"]`)).toBeVisible({
    timeout: 20_000,
  });
}

async function apriLUps(page) {
  await page.evaluate(() => {
    document.querySelectorAll(".page").forEach((n) => n.classList.remove("active"));
    document.getElementById("page-ups")?.classList.add("active");
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  });
  await expect(page.locator("#page-ups .dm-ups-scena")).toHaveCount(1, { timeout: 20_000 });
}

async function entra(page, pagina, disegno) {
  await page.evaluate(() => window.dmDisposizione.entraInModifica());
  await expect(page.locator("html")).toHaveAttribute("data-dm-modifica", pagina);
  await expect(page.locator(`[data-dm-disegno-strato='${disegno}']`)).toBeAttached();
}

async function trascina(page, nodo, dx, dy) {
  const maniglia = page.locator(`[data-dm-disegno-nodo="${nodo}"]`);
  await maniglia.scrollIntoViewIfNeeded();
  await expect(maniglia).toBeVisible();
  const box = await maniglia.boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i += 1) await page.mouse.move(x + (dx * i) / 10, y + (dy * i) / 10);
  await page.mouse.up();
}

/* I `d` di tutti i tubi di una scena, nell'ordine in cui sono scritti. */
const tubi = (page, scena) =>
  page
    .locator(scena)
    .evaluate((n) =>
      Object.fromEntries(
        [...n.querySelectorAll("[data-dm-tubo]")].map((p, i) => [
          `${i}:${p.getAttribute("data-dm-tubo")}`,
          p.getAttribute("d"),
        ]),
      ),
    );
const salvata = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("cd_disegni") || "{}"));
/* Il centro di un pezzo in percento della sua scena. */
const centro = (page, scena, pezzo) =>
  page.locator(`${scena} [data-dm-pezzo="${pezzo}"]`).evaluate((n) => {
    const s = n.closest(".dm-it-scena,.dm-ups-scena").getBoundingClientRect();
    const r = n.getBoundingClientRect();
    return {
      x: ((r.left + r.width / 2 - s.left) / s.width) * 100,
      y: ((r.top + r.height / 2 - s.top) / s.height) * 100,
    };
  });

const CALDAIA = '.dm-it-scena[data-dm-it-scena="caldaia"]';
const SCALDABAGNO = '.dm-it-scena[data-dm-it-scena="scaldabagno"]';
const STUFA = '.dm-it-scena[data-dm-it-scena="stufa"]';
const UPS = "#page-ups .dm-ups-scena";

test("senza scelta le scene sono quelle di sempre: nessuno stile e nessun tubo toccato", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "il computer");
  await avvia(page, testInfo);
  await apriLaMacchina(page, "caldaia");
  expect(await tubi(page, CALDAIA)).toEqual({
    "0:mandata": "M 300 296 L 640 296 L 720 336 L 800 336",
    "1:mandata": "M 300 296 L 640 296 L 720 336 L 800 336",
    "2:mandata": "M 300 296 L 640 296 L 720 336 L 800 336",
    "3:ritorno": "M 300 384 L 660 384 L 700 364 L 800 364",
    "4:ritorno": "M 300 384 L 660 384 L 700 364 L 800 364",
    "5:ritorno": "M 800 364 L 700 364 L 660 384 L 300 384",
  });
  await expect(page.locator("#page-boiler [data-dm-serie]")).toHaveCount(0);
  await apriLUps(page);
  await expect(page.locator("#page-ups [data-dm-serie]")).toHaveCount(0);
});

test("la caldaia si trascina, mandata e ritorno la seguono; Salva la tiene, Ripristina la rimette", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "il computer");
  await avvia(page, testInfo);
  await apriLaMacchina(page, "caldaia");
  const diSerie = await tubi(page, CALDAIA);
  await entra(page, "boiler", "caldaia");
  await expect(page.locator("[data-dm-disegno-strato]").first()).toHaveAttribute(
    "data-dm-variante",
    "computer",
  );
  for (const nodo of ["caldaia", "impianto", "mandata", "ritorno", "pressione"])
    await expect(page.locator(`[data-dm-disegno-nodo="${nodo}"]`)).toHaveCount(1);
  await trascina(page, "caldaia", 160, 140);
  const spostati = await tubi(page, CALDAIA);
  for (const [chiave, d] of Object.entries(spostati)) expect(d, chiave).not.toBe(diSerie[chiave]);
  /* La mandata e il ritorno non corrono uno sopra l'altro. */
  expect(spostati["0:mandata"]).not.toBe(spostati["3:ritorno"]);
  await expect(page.locator(".dm-disp-conta")).toContainText("1 modifica");
  await page.locator('[data-dm-disp-azione="salva"]').click();
  await expect(page.locator("html")).not.toHaveAttribute("data-dm-modifica", /./);
  const scritta = await salvata(page);
  expect(Object.keys(scritta)).toEqual(["caldaia:computer"]);
  const posto = scritta["caldaia:computer"].caldaia;
  const qui = await centro(page, CALDAIA, "caldaia");
  expect(Math.abs(qui.x - posto.x)).toBeLessThan(1);
  expect(Math.abs(qui.y - posto.y)).toBeLessThan(1);
  expect(await tubi(page, CALDAIA)).toEqual(spostati);

  /* Ripristina: i tubi tornano quelli scritti a mano, lettera
   * per lettera, e gli stili di serie. */
  await entra(page, "boiler", "caldaia");
  await page.locator('[data-dm-disp-azione="ripristina"]').click();
  await expect.poll(() => tubi(page, CALDAIA)).toEqual(diSerie);
  await page.locator('[data-dm-disp-azione="salva"]').click();
  expect(await salvata(page)).toEqual({});
  await expect(page.locator("#page-boiler [data-dm-serie]")).toHaveCount(0);
});

test("lo scaldabagno si sposta col suo tubo caldo e freddo; Annulla rimette tutto", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "il computer");
  await avvia(page, testInfo);
  await apriLaMacchina(page, "scaldabagno");
  const diSerie = await tubi(page, SCALDABAGNO);
  const daDove = await centro(page, SCALDABAGNO, "serbatoio");
  await entra(page, "boiler", "scaldabagno");
  await trascina(page, "serbatoio", -260, 30);
  await expect
    .poll(async () => (await centro(page, SCALDABAGNO, "serbatoio")).x)
    .toBeLessThan(daDove.x - 10);
  const spostati = await tubi(page, SCALDABAGNO);
  expect(spostati["0:caldo"]).not.toBe(diSerie["0:caldo"]);
  expect(spostati["3:freddo"]).not.toBe(diSerie["3:freddo"]);
  /* Il caldo arriva ancora in cima, dove va in casa. */
  expect(spostati["0:caldo"]).toMatch(/ L 700 58$/);
  await page.locator('[data-dm-disp-azione="annulla"]').click();
  await expect(page.locator("html")).not.toHaveAttribute("data-dm-modifica", /./);
  await expect.poll(() => tubi(page, SCALDABAGNO)).toEqual(diSerie);
  expect(Math.abs((await centro(page, SCALDABAGNO, "serbatoio")).x - daDove.x)).toBeLessThan(0.5);
  expect(await salvata(page)).toEqual({});
});

test("la stufa si porta dietro la canna fumaria e l'aria calda fino alla stanza", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "il computer");
  await avvia(page, testInfo);
  await apriLaMacchina(page, "stufa");
  const diSerie = await tubi(page, STUFA);
  await entra(page, "boiler", "stufa");
  await trascina(page, "stufa", 240, 20);
  await page.locator('[data-dm-disp-azione="salva"]').click();
  const scritta = await salvata(page);
  expect(Object.keys(scritta)).toEqual(["stufa:computer"]);
  const spostati = await tubi(page, STUFA);
  expect(spostati["0:canna"]).not.toBe(diSerie["0:canna"]);
  expect(spostati["0:canna"]).toMatch(/ -20$/);
  const aria = Object.entries(spostati).filter(([k]) => k.endsWith(":aria"));
  expect(aria.length).toBeGreaterThan(0);
  for (const [k, d] of aria) expect(d, k).toMatch(/^M [\d.]+ [\d.]+ C /);
});

test("l'UPS: la casa si sposta e il cavo che esce la segue, quello della rete no", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "il computer");
  await avvia(page, testInfo);
  await apriLUps(page);
  const diSerie = await tubi(page, UPS);
  await entra(page, "ups", "ups");
  for (const nodo of ["rete", "scatola", "casa", "carico"])
    await expect(page.locator(`[data-dm-disegno-nodo="${nodo}"]`)).toHaveCount(1);
  await trascina(page, "casa", -150, 170);
  await page.locator('[data-dm-disp-azione="salva"]').click();
  expect(Object.keys(await salvata(page))).toEqual(["ups:computer"]);
  const spostati = await tubi(page, UPS);
  expect(spostati["3:uscita"]).not.toBe(diSerie["3:uscita"]);
  expect(spostati["0:rete"]).toBe(diSerie["0:rete"]);
});

test("una scelta che arriva da un altro dispositivo si posa senza entrare in modifica", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "il computer");
  await avvia(page, testInfo);
  await apriLaMacchina(page, "caldaia");
  const diSerie = await tubi(page, CALDAIA);
  await page.evaluate(() => {
    localStorage.setItem(
      "cd_disegni",
      JSON.stringify({ "caldaia:computer": { impianto: { x: 70, y: 25 } } }),
    );
    window.dispatchEvent(new CustomEvent("dashboardmodern:config-synced"));
  });
  await expect.poll(async () => Math.round((await centro(page, CALDAIA, "impianto")).y)).toBe(25);
  expect((await tubi(page, CALDAIA))["0:mandata"]).not.toBe(diSerie["0:mandata"]);
});

test("sul telefono la scelta e' del telefono, e l'UPS in colonna non ha maniglie", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "il telefono");
  await avvia(page, testInfo);
  await apriLaMacchina(page, "stufa");
  await page.evaluate(() => document.querySelector("section.page.active")?.scrollIntoView());
  await entra(page, "boiler", "stufa");
  await expect(page.locator("[data-dm-disegno-strato]").first()).toHaveAttribute(
    "data-dm-variante",
    "telefono",
  );
  await trascina(page, "stufa", 60, 30);
  await page.locator('[data-dm-disp-azione="salva"]').click();
  expect(Object.keys(await salvata(page))).toEqual(["stufa:telefono"]);

  /* L'UPS sul telefono si alza in colonna: li' non c'e' un posto da scegliere. */
  await apriLUps(page);
  await page.evaluate(() => window.dmDisposizione.entraInModifica());
  await expect(page.locator("html")).toHaveAttribute("data-dm-modifica", "ups");
  await expect(page.locator("[data-dm-disegno-strato='ups']")).toHaveCount(0);
});
