/* «Con più carichi assegnati le linee di flusso passano sopra le bolle degli
 * altri carichi» (#118).
 *
 * Il nucleo la geometria la prova da solo, e con più precisione di quanta ne
 * possa avere un browser. Qui si pretende la cosa che il nucleo non può
 * dimostrare: che sulla pagina vera, alla misura del telefono da cui è partita
 * la segnalazione, le bolle di sotto non stiano più incolonnate sotto quelle di
 * sopra — e che la linea che le raggiunge passi nel varco invece che dentro il
 * cerchio.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const CARICHI = [
  { id: "l1", name: "Boiler", power_entity: "sensor.l1", order: 1, icon: "🚿" },
  { id: "l2", name: "Wallbox", power_entity: "sensor.l2", order: 2, icon: "🔌" },
  { id: "l3", name: "Clima", power_entity: "sensor.l3", order: 3, icon: "❄️" },
  { id: "l4", name: "Lavatrice", power_entity: "sensor.l4", order: 4, icon: "🧺" },
  { id: "l5", name: "Cucina", power_entity: "sensor.l5", order: 5, icon: "🍳" },
  { id: "l6", name: "Pompa", power_entity: "sensor.l6", order: 6, icon: "💧" },
];

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: CARICHI,
    lights: [],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {
      house: { power: "sensor.casa_w" },
      solar: { power: "sensor.fv_w" },
      grid: { power: "sensor.rete_w" },
      battery: { power: "sensor.batt_w" },
      metadata: { semantics_version: 3 },
    },
    entityOverrides: {},
  },
  visibility: { home: true, energy: true },
};

test("sei carichi: le file si sfalsano e le linee passano nei varchi", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  /* La misura è quella della segnalazione: un telefono, dove la scena passa a
     due file. Su uno schermo largo la fila è una sola e questo non succede. */
  await page.setViewportSize({ width: 412, height: 915 });
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate((carichi) => {
    const scrivi = (id, valore) => {
      _RAW_STATES[id] = {
        entity_id: id,
        state: String(valore),
        attributes: { unit_of_measurement: "W" },
      };
      STATES[id] = _RAW_STATES[id];
    };
    scrivi("sensor.casa_w", 1240);
    scrivi("sensor.fv_w", 4180);
    scrivi("sensor.rete_w", -2940);
    scrivi("sensor.batt_w", 0);
    carichi.forEach((carico, indice) => scrivi(carico.power_entity, 300 + indice * 220));
    localStorage.setItem("cd_loads", JSON.stringify(carichi));
    window.render?.();
  }, CARICHI);
  await page.evaluate(() => document.getElementById("editor-modal")?.remove());
  await page
    .locator('.tab[data-tab="energy"]')
    .first()
    .evaluate((nodo) => nodo.click());

  const palco = page.locator(".flow-stage").first();
  await expect(palco.locator(".node.n-load[data-dm-flow-node]").first()).toBeVisible({
    timeout: 20_000,
  });
  await page.waitForTimeout(800);

  const scena = await page.evaluate(() => {
    const stage = document.querySelector(".flow-stage");
    const quadro = stage.getBoundingClientRect();
    const bolle = [...stage.querySelectorAll(".node.n-load[data-dm-flow-node]")]
      .filter((nodo) => nodo.getBoundingClientRect().width > 0)
      .map((nodo) => {
        const riga = nodo.getBoundingClientRect();
        return {
          nome: nodo.querySelector(".node-label")?.textContent?.trim(),
          cx: riga.x - quadro.x + riga.width / 2,
          cy: riga.y - quadro.y + riga.height / 2,
          raggio: riga.width / 2,
        };
      });
    const svg = [...stage.querySelectorAll("svg")].find(
      (uno) => getComputedStyle(uno).display !== "none",
    );
    const caselle = svg.viewBox.baseVal;
    const linee = [...svg.querySelectorAll("path.dm-flow-arc")].map((path) => {
      const lungo = path.getTotalLength();
      const punti = [];
      for (let passo = 0; passo <= 200; passo += 1) {
        const punto = path.getPointAtLength((lungo * passo) / 200);
        punti.push([
          (punto.x / caselle.width) * quadro.width,
          (punto.y / caselle.height) * quadro.height,
        ]);
      }
      return punti;
    });
    return { bolle, linee, quadro: { largo: quadro.width, alto: quadro.height } };
  });

  /* Sei bolle, due file. */
  expect(scena.bolle.length).toBe(6);
  const file = [...new Set(scena.bolle.map((b) => Math.round(b.cy)))].sort((a, b) => a - b);
  expect(file.length).toBe(2);

  /* Nessuna bolla di sotto sta incolonnata sotto una di sopra: è questo che
     costringeva la linea a passare dentro. */
  const sopra = scena.bolle.filter((b) => Math.round(b.cy) === file[0]);
  const sotto = scena.bolle.filter((b) => Math.round(b.cy) === file[1]);
  expect(sopra.length).toBe(3);
  expect(sotto.length).toBe(3);
  for (const giu of sotto) {
    for (const su of sopra) {
      expect(
        Math.abs(giu.cx - su.cx),
        `«${giu.nome}» sta incolonnata sotto «${su.nome}»`,
      ).toBeGreaterThan(su.raggio);
    }
  }

  /* E nessuna linea entra in una bolla. Il capo di una linea finisce dentro la
     bolla a cui va: si guardano solo le altre. */
  expect(scena.linee.length).toBeGreaterThanOrEqual(6);
  for (const linea of scena.linee) {
    const arrivo = linea.at(-1);
    const sua = scena.bolle.find(
      (b) => Math.hypot(arrivo[0] - b.cx, arrivo[1] - b.cy) <= b.raggio + 4,
    );
    for (const punto of linea) {
      for (const bolla of scena.bolle) {
        if (bolla === sua) continue;
        expect(
          Math.hypot(punto[0] - bolla.cx, punto[1] - bolla.cy),
          `una linea passa dentro «${bolla.nome}»`,
        ).toBeGreaterThanOrEqual(bolla.raggio);
      }
    }
  }

  /* E la barra dell'app non copre i numeri dell'ultima fila.
   *
   * La barra galleggia in fondo allo schermo e sta sopra tutto: sul telefono
   * arriva a coprire l'ultimo pezzo del palco. Con una fila sola i carichi non
   * la toccano — il disegno è nato così — ma la seconda, che nasce dal quinto
   * carico in poi, ci finiva dentro col numero. Chi apriva Energia vedeva i
   * watt dei suoi ultimi carichi coperti, e per leggerli doveva scorrere senza
   * sapere che ci fosse qualcosa da scorrere. */
  const laBarra = await page.evaluate(() => {
    const barra =
      document.querySelector("nav.tabs.bottom-nav-bar") || document.querySelector("nav.tabs");
    if (!barra || getComputedStyle(barra).position !== "fixed") return null;
    const stage = document.querySelector(".flow-stage").getBoundingClientRect();
    const numeri = [...document.querySelectorAll(".flow-stage .node.n-load .dm-flow-value")]
      .map((nodo) => nodo.getBoundingClientRect())
      .filter((riga) => riga.width > 0);
    return {
      comincia: barra.getBoundingClientRect().top,
      ultimoNumero: Math.max(...numeri.map((riga) => riga.bottom)),
      casa: document.querySelector("#n-home")?.getBoundingClientRect().bottom ?? null,
      /* Solo quelle disegnate: la scena si porta dietro i cerchi fissi del
         guscio storico, spenti, e un rettangolo di misura zero falserebbe il
         conto senza dirlo. */
      primaFila: Math.min(
        ...[...document.querySelectorAll(".flow-stage .node.n-load[data-dm-flow-node]")]
          .map((nodo) => nodo.getBoundingClientRect())
          .filter((riga) => riga.width > 0)
          .map((riga) => riga.top),
      ),
      alto: stage.height,
    };
  });
  expect(laBarra, "la barra in basso deve esserci, o questa prova non prova niente").not.toBeNull();
  expect(
    laBarra.ultimoNumero,
    "il numero dell'ultima fila finisce sotto la barra dell'app",
  ).toBeLessThanOrEqual(laBarra.comincia);
  /* E salendo non sono andate a finire addosso alla Casa. */
  expect(laBarra.casa, "la Casa deve essere disegnata").not.toBeNull();
  expect(laBarra.primaFila, "la prima fila tocca la Casa").toBeGreaterThan(laBarra.casa);

  await palco.screenshot({
    path: process.env.SCATTO_FLUSSI || "/tmp/flussi-dopo.png",
  });
});
