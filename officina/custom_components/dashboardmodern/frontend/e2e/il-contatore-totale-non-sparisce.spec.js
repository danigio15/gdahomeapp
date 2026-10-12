/* «Controlla bene i dati salvati nella sezione Giornaliera e Mensile degli
 *  elettrodomestici: ho impostato un sensore totale ma all'improvviso il
 *  valore sparisce.»
 *
 * Sul documento vero: un forno in Cucina misurato dal solo contatore totale,
 * che non si chiama «total». Il numero c'e' nella Giornaliera, nella Mensile e
 * nella tessera di oggi degli elettrodomestici; poi l'integrazione si
 * ricarica — il sensore sparisce dagli stati e il Recorder per un giro non ha
 * righe — e il numero deve restare dov'e', e la casella del contatore in
 * configurazione pure. Quando il sensore torna, si ricomincia a contare. */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { clickBottomTab } from "./helpers/navigation.js";

const CONTATORE = "sensor.forno_energia";

const STATI = [
  {
    entity_id: CONTATORE,
    state: "345.6",
    attributes: {
      friendly_name: "Forno energia",
      unit_of_measurement: "kWh",
      device_class: "energy",
      state_class: "total_increasing",
    },
  },
  { entity_id: "sensor.rete_w", state: "800", attributes: { unit_of_measurement: "W" } },
  { entity_id: "sensor.casa_w", state: "800", attributes: { unit_of_measurement: "W" } },
];

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "cucina", name: "Cucina", icon: "mdi:stove" }],
    cameras: [],
    appliances: [
      {
        id: "forno",
        name: "Forno",
        device_type: "forno",
        visual_key: "forno",
        room_id: "cucina",
        total_energy_entity: CONTATORE,
        history_entity: CONTATORE,
        report_entity: CONTATORE,
        entities: [CONTATORE],
      },
    ],
    loads: [],
    lights: [],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: { grid: { power: "sensor.rete_w" }, house: { power: "sensor.casa_w" } },
    entityOverrides: {},
  },
  visibility: { home: true, energy: true, appliances: true },
};

async function avvia(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript(
    ({ stati, contatore }) => {
      window.__dmSenzaRighe = false;
      window.__dmPacchetti = 0;
      window.addEventListener("dashboardmodern:period-bundle", () => {
        window.__dmPacchetti += 1;
      });
      /* Un contatore di vita vero: cresce di un decimo di kWh all'ora, e ogni
       * arco si prende le righe che gli toccano. */
      const PASSI = { "5minute": 3e5, hour: 36e5, day: 864e5, week: 6048e5, month: 26784e5 };
      const ORIGINE = Date.UTC(2026, 0, 1);
      const sommaAl = (t) => 100 + ((t - ORIGINE) / 36e5) * 0.1;
      class MockSocket extends EventTarget {
        static OPEN = 1;
        readyState = MockSocket.OPEN;
        onopen = null;
        onmessage = null;
        onclose = null;
        onerror = null;
        constructor() {
          super();
          queueMicrotask(() => {
            this.onopen?.({});
            this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
          });
        }
        send(raw) {
          const message = JSON.parse(raw);
          if (message.type === "auth") return;
          let result = null;
          if (message.type === "get_states") result = stati;
          else if (message.type === "frontend/get_user_data") result = { value: null };
          else if (message.type === "recorder/statistics_during_period") {
            const inizio = new Date(message.start_time).getTime();
            const fine = Math.min(new Date(message.end_time).getTime(), Date.now());
            const passo = PASSI[message.period] || 36e5;
            result = {};
            for (const id of message.statistic_ids || []) {
              if (id !== contatore || window.__dmSenzaRighe) {
                result[id] = [];
                continue;
              }
              const righe = [];
              for (let t = Math.ceil(inizio / passo) * passo; t < fine; t += passo)
                righe.push({ start: new Date(t).toISOString(), sum: sommaAl(t) });
              result[id] = righe;
            }
          }
          this.onmessage?.({
            data: JSON.stringify({ id: message.id, type: "result", success: true, result }),
          });
        }
        close() {
          this.onclose?.({});
        }
      }
      window.__DASHBOARDMODERN_BRIDGE_WS__ = MockSocket;
      window.WebSocket = MockSocket;
    },
    { stati: STATI, contatore: CONTATORE },
  );
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate((stati) => {
    for (const stato of stati) {
      _RAW_STATES[stato.entity_id] = structuredClone(stato);
      STATES[stato.entity_id] = structuredClone(stato);
    }
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, STATI);
}

/* L'integrazione che si ricarica: il sensore esce dagli stati e il Recorder,
 * per un giro, non ha righe da dare. */
async function ilSensoreSparisce(page) {
  await page.evaluate((contatore) => {
    window.__dmSenzaRighe = true;
    delete _RAW_STATES[contatore];
    delete STATES[contatore];
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, CONTATORE);
}

async function ilSensoreTorna(page) {
  await page.evaluate((stato) => {
    window.__dmSenzaRighe = false;
    _RAW_STATES[stato.entity_id] = structuredClone(stato);
    STATES[stato.entity_id] = structuredClone(stato);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, STATI[0]);
}

/* Un pacchetto nuovo dell'Energia, chiesto adesso e arrivato. */
async function unGiroDellEnergia(page) {
  const prima = await page.evaluate(() => window.__dmPacchetti);
  await page.evaluate(() => window.DashboardModernEnergyService.refreshNow());
  await expect.poll(() => page.evaluate(() => window.__dmPacchetti)).toBeGreaterThan(prima);
}

function valoreDelCerchio(page, vista, nome) {
  return page.evaluate(
    ({ vista, nome }) => {
      const nodo = [...document.querySelectorAll(`#view-${vista} [data-dm-flow-node]`)].find(
        (n) => (n.querySelector(".node-label")?.textContent || "").trim() === nome,
      );
      const testo = (nodo?.textContent || "").replace(/\s+/g, " ").trim();
      const numero = testo.match(/(\d+(?:[.,]\d+)?)\s*kWh/i);
      return numero ? Number(numero[1].replace(",", ".")) : null;
    },
    { vista, nome },
  );
}

async function apriLaVista(page, etichetta) {
  await page
    .locator("#page-energy .sub-tab-btn", { hasText: etichetta })
    .first()
    .evaluate((b) => b.click());
}

function totaleInConfigurazione(page) {
  return page.evaluate(
    () =>
      DashboardModernModules.store.getState().sections.appliances.find((a) => a.id === "forno")
        ?.total_energy_entity,
  );
}

test("Giornaliera e Mensile: il numero del contatore totale resta quando il sensore sparisce", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  await page
    .locator('.tab[data-tab="energy"]')
    .first()
    .evaluate((b) => b.click());

  await apriLaVista(page, /Giornaliera/i);
  await expect
    .poll(() => valoreDelCerchio(page, "day", "Cucina"), { timeout: 20_000 })
    .toBeGreaterThan(0);
  const giorno = await valoreDelCerchio(page, "day", "Cucina");
  await apriLaVista(page, /Mensile/i);
  await expect.poll(() => valoreDelCerchio(page, "month", "Cucina")).toBeGreaterThan(giorno);
  const mese = await valoreDelCerchio(page, "month", "Cucina");

  await ilSensoreSparisce(page);
  await unGiroDellEnergia(page);
  /* La passata dei contratti ha avuto il suo giro: la casella e' ancora li'. */
  await expect.poll(() => totaleInConfigurazione(page)).toBe(CONTATORE);
  await expect.poll(() => valoreDelCerchio(page, "month", "Cucina")).toBe(mese);
  await page.screenshot({ path: testInfo.outputPath("mensile-sensore-sparito.png") });
  await apriLaVista(page, /Giornaliera/i);
  await expect.poll(() => valoreDelCerchio(page, "day", "Cucina")).toBe(giorno);
  await page.screenshot({ path: testInfo.outputPath("giornaliera-sensore-sparito.png") });

  /* Torna il sensore: si riprende a contare dal Recorder. */
  await ilSensoreTorna(page);
  await unGiroDellEnergia(page);
  await expect.poll(() => valoreDelCerchio(page, "day", "Cucina")).toBeGreaterThanOrEqual(giorno);
  expect(await totaleInConfigurazione(page)).toBe(CONTATORE);
});

test("la tessera di oggi degli elettrodomestici non perde il contatore totale", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  await clickBottomTab(page, "appliances", testInfo);
  const tessera = page.locator('#appl-kpi-grid [data-dm-appliance-daily-total="true"]');
  await expect(tessera).toBeVisible();
  const kwh = async () => {
    const testo = (await tessera.locator(".g-val").textContent()) || "";
    const numero = testo.match(/(\d+(?:[.,]\d+)?)\s*kWh/i);
    return numero ? Number(numero[1].replace(",", ".")) : null;
  };
  await tessera.click();
  await expect.poll(kwh, { timeout: 20_000 }).toBeGreaterThan(0);
  const prima = await kwh();
  await page.locator("#dm-appliance-daily-popup [data-dm-daily-close]").click();

  await ilSensoreSparisce(page);
  /* Il tocco chiede subito un conto nuovo, senza aspettare il minuto. */
  await tessera.click();
  const finestra = page.locator("#dm-appliance-daily-popup");
  await expect(finestra.locator("[data-dm-daily-entity]")).toHaveCount(1);
  await expect(finestra.locator("[data-dm-daily-popup-total]")).not.toHaveText("…");
  expect(await kwh()).toBe(prima);
  await expect(finestra).toContainText("Forno");
  await page.screenshot({ path: testInfo.outputPath("tessera-di-oggi-sensore-sparito.png") });
  expect(await totaleInConfigurazione(page)).toBe(CONTATORE);
});
