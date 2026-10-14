/* L'assistente di casa sta accanto alle persone (#175).
 *
 * Sul documento vero: la casa e' vuota da due ore e due luci sono rimaste
 * accese. La card a destra delle persone lo dice come un messaggio della
 * casa, col tasto che le spegne; «Più tardi» rimanda, ✕ scarta e se lo
 * ricorda per tutta la casa, «vedi tutti» apre l'elenco con «Chiedi alla
 * casa». E in Config › Persone la si spegne.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [
      { entity: "light.sala", name: "Sala" },
      { entity: "light.cucina", name: "Cucina" },
    ],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true },
};

const PERSONE = [
  { id: "persona-1", name: "Persona 1", entity: "person.persona_1" },
  { id: "persona-2", name: "Persona 2", entity: "person.persona_2" },
];

async function boot(page, testInfo, { larghezza = 1366 } = {}) {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: larghezza, height: 900 });
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true, null, {
    timeout: 60000,
  });
  await page.evaluate((persone) => {
    window.localStorage.setItem("cd_people", JSON.stringify(persone));
    const stati = eval("_RAW_STATES");
    const dueOreFa = new Date(Date.now() - 2 * 3600_000).toISOString();
    for (const p of persone)
      stati[p.entity] = {
        entity_id: p.entity,
        state: "not_home",
        last_changed: dueOreFa,
        attributes: { friendly_name: p.name },
      };
    for (const id of ["light.sala", "light.cucina"])
      stati[id] = { entity_id: id, state: "on", attributes: { friendly_name: id } };
    window.__comandi = [];
    window.dmCallHaService = (dominio, servizio, dati) => {
      const chi = [].concat(dati?.entity_id || []).join(",");
      window.__comandi.push(`${dominio}.${servizio} ${chi}`);
      return Promise.resolve(true);
    };
    window.applyStates?.();
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, PERSONE);
  await expect(page.locator("#dm-people .dm-person-card")).toHaveCount(2);
}

const card = (page) => page.locator("#dm-people .dm-assistente");

test("la casa vuota con le luci accese: la card lo dice e le spegne", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo);
  await expect(card(page)).toBeVisible();
  await expect(card(page)).toContainText("Assistente di casa");
  await expect(card(page).locator(".dm-ass-messaggio")).toContainText(
    "Non c'è nessuno in casa, ma 2 luci sono accese",
  );
  await expect(card(page).locator(".dm-ass-conto")).toHaveText("1 cosa da fare");

  /* Accanto alle persone, alla stessa altezza: e' il buco del #175. */
  const persona = await page.locator("#dm-people .dm-person-card").first().boundingBox();
  const lei = await card(page).boundingBox();
  expect(lei.x).toBeGreaterThan(persona.x + persona.width - 1);
  expect(Math.abs(lei.y - persona.y)).toBeLessThan(4);
  expect(Math.abs(lei.height - persona.height)).toBeLessThan(4);

  await card(page).locator('[data-ass-fa="azione"]').click();
  expect(await page.evaluate(() => window.__comandi)).toEqual([
    "light.turn_off light.sala,light.cucina",
  ]);
  /* Fatto: finche' la cosa resta vera non si ripropone. */
  await expect(card(page)).toContainText("In casa è tutto in ordine.");
  const memoria = await page.evaluate(() => JSON.parse(localStorage.getItem("cd_assistente")));
  expect(memoria.memoria.tipi["vuota-luci"].si).toBe(1);
});

test("«Più tardi» rimanda a domani, ✕ scarta e se lo ricorda", async ({ page }, testInfo) => {
  await boot(page, testInfo);
  await card(page).locator('[data-ass-fa="tardi"]').click();
  const scelte = card(page).locator('[data-ass-fa="rimanda"]');
  await expect(scelte).toHaveText(["Fra 1 h", "Stasera", "Domani"]);
  await scelte.filter({ hasText: "Domani" }).click();
  await expect(card(page)).toContainText("In casa è tutto in ordine.");
  let salvato = await page.evaluate(() => JSON.parse(localStorage.getItem("cd_assistente")));
  const [id, voce] = Object.entries(salvato.memoria.istanze)[0];
  expect(id).toBe("vuota-luci:light.cucina,light.sala");
  expect(voce.fino).toBeGreaterThan(Date.now() + 6 * 3600_000);
  /* Rimandare non e' scartare: il tipo non perde peso. */
  expect(salvato.memoria.tipi["vuota-luci"]).toBeUndefined();

  /* Si dimentica il rinvio e si scarta con ✕. */
  await page.evaluate(() => {
    localStorage.removeItem("cd_assistente");
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  });
  await expect(card(page).locator(".dm-ass-messaggio")).toBeVisible();
  await card(page).locator('[data-ass-fa="no"]').click();
  await expect(card(page)).toContainText("In casa è tutto in ordine.");
  salvato = await page.evaluate(() => JSON.parse(localStorage.getItem("cd_assistente")));
  expect(salvato.memoria.tipi["vuota-luci"].no).toBe(1);
});

test("«vedi tutti» apre l'elenco con «Chiedi alla casa»", async ({ page }, testInfo) => {
  await boot(page, testInfo);
  await card(page).locator('.dm-ass-tasti [data-ass-fa="apri"]').click();
  const foglio = page.locator("#dm-ass-velo .dm-ass-foglio");
  await expect(foglio).toBeVisible();
  await expect(foglio.locator(".dm-ass-riga")).toHaveCount(1);
  await expect(foglio.locator(".dm-ass-riga").first()).toHaveAttribute("data-urgenza", "oggi");
  await expect(foglio.locator("[data-ass-testo]")).toHaveAttribute(
    "placeholder",
    "Chiedi alla casa…",
  );
  /* Senza Home Assistant collegata la domanda non resta appesa: la casa
   * dice che non ha risposto. */
  await foglio.locator("[data-ass-testo]").fill("Accendi la luce in sala");
  await foglio.locator(".dm-ass-manda").click();
  await expect(foglio.locator('.dm-ass-battuta[data-chi="io"]')).toHaveText(
    "Accendi la luce in sala",
  );
  await expect(foglio.locator('.dm-ass-battuta[data-chi="casa"][data-errore="true"]')).toBeVisible({
    timeout: 25000,
  });
  await page.keyboard.press("Escape");
  await expect(page.locator("#dm-ass-velo")).toHaveCount(0);
});

test("sul telefono sta sotto le persone, a tutta larghezza", async ({ page }, testInfo) => {
  await boot(page, testInfo, { larghezza: 390 });
  await expect(card(page)).toHaveAttribute("data-posto", "sotto");
  const ultima = await page.locator("#dm-people .dm-person-card").last().boundingBox();
  const lei = await card(page).boundingBox();
  expect(lei.y).toBeGreaterThan(ultima.y + ultima.height - 1);
  const fila = await page.locator("#dm-people .dm-people-fila").boundingBox();
  expect(Math.abs(lei.width - fila.width)).toBeLessThan(2);
});

test("in Config › Persone si spegne, e si regola", async ({ page }, testInfo) => {
  await boot(page, testInfo);
  await page.evaluate(() => window.apriConfigEntita());
  await page.locator('.ed-tab[data-tab="people"]').click();
  const scelte = page.locator("#ed-body [data-person-accanto]");
  await expect(scelte).toHaveText(["Assistente di casa", "Niente"]);
  /* Le regolazioni: di cosa parla, quanto, e da che ora e' notte. */
  await page.locator('#ed-body [data-person-ass-categoria="comfort"]').click();
  await page.locator('#ed-body [data-person-ass-sensibilita="poco"]').click();
  await page.locator("#ed-body [data-person-ass-notte]").selectOption("21");
  const opzioni = await page.evaluate(
    () => JSON.parse(localStorage.getItem("cd_assistente")).opzioni,
  );
  expect(opzioni.categorie.comfort).toBe(false);
  expect(opzioni.sensibilita).toBe("poco");
  expect(opzioni.notteDalle).toBe(21);

  await scelte.filter({ hasText: "Niente" }).click();
  await expect(page.locator("#ed-body [data-person-assistente]")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("cd_people_accanto"))).toBe(
    JSON.stringify({ mostra: "niente" }),
  );
  await expect(card(page)).toHaveCount(0);
});
