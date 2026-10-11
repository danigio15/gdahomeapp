/* «Problemi di comunicazione con dei deumidificatori di marca Comfee tramite
 * Midea: non riconosciuti con tutti i comandi del dispositivo. Li ho integrati
 * su Home Assistant e funzionano benissimo.» (#205)
 *
 * La prova fa quello che ha fatto chi ha aperto la segnalazione: mette il
 * deumidificatore fra le unità del Clima, l'unico posto che c'era. Il Clima
 * adesso non gli disegna una card dei gradi che non sa comandarlo: lo porta
 * nella fascia dei deumidificatori, e i tasti chiamano i servizi giusti.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { clickBottomTab } from "./helpers/navigation.js";

const seed = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [
      { id: "cl-salone", type: "clima", name: "Salone", entity: "climate.salone" },
      {
        id: "cl-comfee",
        type: "clima",
        name: "Comfee taverna",
        entity: "humidifier.deumidificatore_taverna",
      },
    ],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, clima: true },
};

const STATI = [
  {
    entity_id: "climate.salone",
    state: "cool",
    attributes: { friendly_name: "Salone", temperature: 24, current_temperature: 26.1 },
  },
  {
    entity_id: "humidifier.deumidificatore_taverna",
    state: "on",
    attributes: {
      friendly_name: "Comfee taverna",
      device_class: "dehumidifier",
      humidity: 50,
      current_humidity: 64,
      min_humidity: 35,
      max_humidity: 85,
      available_modes: ["Set", "Continuous", "Smart", "Clothes-Dry"],
      mode: "Set",
      action: "drying",
    },
  },
];

async function apriIlClima(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
  await page.evaluate(
    (haStati) =>
      haStati.forEach((voce) => {
        _RAW_STATES[voce.entity_id] = structuredClone(voce);
        STATES[voce.entity_id] = structuredClone(voce);
      }),
    STATI,
  );
  await page.evaluate(() => {
    window.__CHIAMATE__ = [];
    window.dmCallHaService = (dominio, servizio, dati) => {
      window.__CHIAMATE__.push([dominio, servizio, dati]);
      return Promise.resolve();
    };
  });
  await clickBottomTab(page, "clima", testInfo);
  await page.waitForSelector("#page-clima [data-dm-deum]");
}

test("il deumidificatore messo nel Clima ha la sua card, e i tasti partono", async ({
  page,
}, testInfo) => {
  await apriIlClima(page, testInfo);

  /* Fra le card dei gradi c'è solo il condizionatore. */
  await expect(page.locator("#page-clima .dm-cl-card")).toHaveCount(1);
  const card = page.locator("#page-clima [data-dm-deum]");
  await expect(card).toHaveCount(1);
  await expect(card).toContainText("Comfee taverna");
  await expect(card).toContainText("64%");
  await expect(card).toContainText("Sta deumidificando");
  await expect(card.locator('[data-dm-deum-valore="Clothes-Dry"]')).toHaveText("Asciuga bucato");

  await card.locator('[data-dm-deum-azione="piu"]').click();
  await card.locator('[data-dm-deum-valore="Continuous"]').click();
  await card.locator('[data-dm-deum-azione="commuta"]').click();
  await expect
    .poll(() => page.evaluate(() => window.__CHIAMATE__))
    .toEqual([
      [
        "humidifier",
        "set_humidity",
        { entity_id: "humidifier.deumidificatore_taverna", humidity: 55 },
      ],
      [
        "humidifier",
        "set_mode",
        { entity_id: "humidifier.deumidificatore_taverna", mode: "Continuous" },
      ],
      ["humidifier", "turn_off", { entity_id: "humidifier.deumidificatore_taverna" }],
    ]);
  /* Il nuovo obiettivo si vede subito, senza aspettare il giro di Midea. */
  await expect(card.locator("[data-dm-deum-obiettivo]")).toHaveText("55%");
});
