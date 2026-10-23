/* «La visualizzazione dei nodi ha dei problemi, parlo di browser non APP» (#302).
 *
 * Nel browser il nome del nodo e la pastiglia «Acceso» uscivano dalla scheda
 * come una pastiglia gonfia, con un buco sotto. Era la regola globale
 * `header{}` della plancia legacy — quella della testata in cima — che
 * prendeva anche la testa della scheda del nodo, scritta come <header>.
 *
 * Qui si guarda che la testa sia una riga sottile, dentro la scheda, senza
 * l'imbottitura, gli angoli e il margine della testata.
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
    lights: [],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, server: true },
};

const stato = (entity_id, state, attributes = {}) => ({ entity_id, state, attributes });

const STATI = {
  "binary_sensor.nodo_uno_stato": stato("binary_sensor.nodo_uno_stato", "on"),
  "sensor.nodo_uno_cpu": stato("sensor.nodo_uno_cpu", "6", { unit_of_measurement: "%" }),
  "sensor.nodo_uno_ram": stato("sensor.nodo_uno_ram", "72", { unit_of_measurement: "%" }),
  "sensor.nodo_uno_disco": stato("sensor.nodo_uno_disco", "41", { unit_of_measurement: "%" }),
  "binary_sensor.nodo_due_stato": stato("binary_sensor.nodo_due_stato", "off"),
  "sensor.nodo_due_cpu": stato("sensor.nodo_due_cpu", "93", { unit_of_measurement: "%" }),
};

const NODI = [
  {
    id: "uno",
    nome: "LXC prova (100)",
    stato: "binary_sensor.nodo_uno_stato",
    cpu: "sensor.nodo_uno_cpu",
    ram: "sensor.nodo_uno_ram",
    disco: "sensor.nodo_uno_disco",
  },
  {
    id: "due",
    nome: "Nodo con un nome molto lungo che non ci sta",
    stato: "binary_sensor.nodo_due_stato",
    cpu: "sensor.nodo_due_cpu",
  },
];

async function avvia(page, testInfo) {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  /* I nodi si scrivono a plancia avviata, come le macchine: prima la memoria
   * non ha ancora il prefisso dell'istanza. */
  await page.evaluate(
    ({ stati, nodi }) => {
      localStorage.setItem("cd_nodi", JSON.stringify(nodi));
      window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...stati } };
      const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
      if (raw) Object.assign(raw, stati);
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
      document.querySelector('.tab[data-tab="server"]')?.click();
    },
    { stati: STATI, nodi: NODI },
  );
}

test("la testa del nodo è una riga dentro la scheda, non la testata", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);
  const schede = page.locator("#dm-nodi-fascia .dm-nodo");
  await expect(schede).toHaveCount(2, { timeout: 20_000 });

  /* Nessuna <header> nella fascia: la regola globale non ha niente da
   * prendere. */
  await expect(page.locator("#dm-nodi-fascia header")).toHaveCount(0);

  for (const scheda of await schede.all()) {
    const misure = await scheda.evaluate((nodo) => {
      const testa = nodo.querySelector(".dm-nodo-testa");
      const fuori = nodo.getBoundingClientRect();
      const dentro = testa.getBoundingClientRect();
      const stile = getComputedStyle(testa);
      return {
        alta: dentro.height,
        sinistra: dentro.left - fuori.left,
        destra: fuori.right - dentro.right,
        sopra: dentro.top - fuori.top,
        imbottitura: stile.paddingTop,
        angoli: stile.borderTopLeftRadius,
        margine: stile.marginBottom,
      };
    });
    expect(misure.alta).toBeLessThan(30);
    expect(misure.sinistra).toBeGreaterThanOrEqual(0);
    expect(misure.destra).toBeGreaterThanOrEqual(0);
    expect(misure.sopra).toBeGreaterThanOrEqual(0);
    expect(misure.imbottitura).toBe("0px");
    expect(misure.angoli).toBe("0px");
    expect(misure.margine).toBe("0px");
  }

  /* E il titolo della fascia sta sulla sua riga, sottile anche lui. */
  const titolo = await page
    .locator("#dm-nodi-fascia .dm-nodi-testa")
    .evaluate((nodo) => nodo.getBoundingClientRect().height);
  expect(titolo).toBeLessThan(30);

  const cartella = process.env.DM_FOTO;
  if (cartella)
    await page.locator("#dm-nodi-fascia").screenshot({
      path: `${cartella}/nodi-${testInfo.project.name}.png`,
      animations: "disabled",
    });
});
