/* Il termostato col caldo e il freddo, sulla plancia vera.
 *
 * «Il termostato di Home Assistant mi vede le due mezze lune, da una parte
 * caldo e dall'altra freddo. Se lo inserisco nel clima tuo, invece, mi legge
 * solo la temperatura attuale, ma non mi gestisce il target.» Home Assistant
 * pubblica quei termostati con `target_temp_low` e `target_temp_high` — 22 e
 * 40 — e niente `temperature`.
 *
 * Poi la scelta: quei termostati non stanno ne' in Caldo ne' in Freddo, ma in
 * una terza linguetta, «Termostato», dove la card mostra i due numeri insieme
 * — «Caldo 22°» e «Freddo 40°» — ognuno col suo meno e il suo piu'.
 *
 * Qui, con due termostati di fantasia, un radiatore e un condizionatore a
 * obiettivo solo come testimoni:
 * - le linguette sono tre, nell'ordine Freddo · Caldo · Termostato, e i
 *   termostati a coppia stanno solo nella terza;
 * - i quattro tasti mandano sempre la coppia intera, e i tocchi si sommano;
 * - senza termostati a coppia la terza linguetta non c'e', e se era quella
 *   aperta la pagina torna su una che ha qualcosa;
 * - la finestra del Clima e la tessera della Home sanno lo stesso;
 * - i testimoni mandano `temperature`, come sempre.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "giorno", name: "Zona giorno", icon: "mdi:sofa" }],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [
      { name: "Termostato Living", entity: "climate.living", type: "termo", room: "giorno" },
      { name: "Termostato Camera", entity: "climate.camera", type: "termo", room: "giorno" },
      { name: "Radiatore Bagno", entity: "climate.bagno", type: "termo", room: "giorno" },
      { name: "Condizionatore Salone", entity: "climate.salone", type: "clima", room: "giorno" },
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

/* Il termostato delle foto: la coppia, la scala da 4 a 40, mezzo grado. */
const DOPPIO = {
  hvac_modes: ["off", "heat", "cool", "heat_cool"],
  supported_features: 1 | 2 | 128 | 256,
  current_temperature: 19.5,
  temperature: null,
  target_temp_low: 22,
  target_temp_high: 40,
  min_temp: 4,
  max_temp: 40,
  target_temp_step: 0.5,
};

async function avvia(page, testInfo, modoLiving = "off") {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript(() => {
    window.__DM_CHIAMATE__ = [];
    class MockBridgeSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;
      readyState = 1;
      onopen = null;
      onmessage = null;
      onclose = null;
      onerror = null;
      constructor() {
        queueMicrotask(() => {
          this.onopen?.({});
          this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
        });
      }
      send(raw) {
        const message = JSON.parse(raw);
        if (message.type === "auth") return;
        if (message.type === "call_service") window.__DM_CHIAMATE__.push(message);
        let result = null;
        if (message.type === "get_states") result = [];
        if (message.type === "frontend/get_user_data") result = { value: null };
        queueMicrotask(() =>
          this.onmessage?.({
            data: JSON.stringify({ id: message.id, type: "result", success: true, result }),
          }),
        );
      }
      close() {
        this.readyState = 3;
        this.onclose?.({});
      }
    }
    window.__DASHBOARDMODERN_HOSTED__ = true;
    window.__DASHBOARDMODERN_BRIDGE_WS__ = MockBridgeSocket;
    window.WebSocket = MockBridgeSocket;
  });
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate(
    ({ doppio, modoLiving }) => {
      const stati = eval("_RAW_STATES");
      stati["climate.living"] = {
        entity_id: "climate.living",
        state: modoLiving,
        attributes: { ...doppio, friendly_name: "Termostato Living", hvac_action: "idle" },
      };
      stati["climate.camera"] = {
        entity_id: "climate.camera",
        state: "heat",
        attributes: {
          ...doppio,
          friendly_name: "Termostato Camera",
          current_temperature: 20.5,
          target_temp_low: 21.5,
          target_temp_high: 26,
          hvac_action: "heating",
        },
      };
      stati["climate.salone"] = {
        entity_id: "climate.salone",
        state: "cool",
        attributes: {
          friendly_name: "Condizionatore Salone",
          current_temperature: 26,
          temperature: 24,
          // `heat_cool` col numero solo: e' il suo «automatico», resta in Freddo.
          hvac_modes: ["off", "cool", "heat", "heat_cool"],
          hvac_action: "cooling",
        },
      };
      stati["climate.bagno"] = {
        entity_id: "climate.bagno",
        state: "heat",
        attributes: {
          friendly_name: "Radiatore Bagno",
          current_temperature: 21,
          temperature: 23,
          hvac_modes: ["off", "heat"],
          hvac_action: "heating",
        },
      };
      document.querySelectorAll(".page").forEach((n) => n.classList.remove("active"));
      document.getElementById("page-clima")?.classList.add("active");
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
      window.render?.();
    },
    { doppio: DOPPIO, modoLiving },
  );
  await page.waitForFunction(
    () => document.querySelectorAll("#page-clima .dm-cl-shell .dm-cl-card").length >= 4,
    null,
    { timeout: 15000 },
  );
}

const temperature = (page) =>
  page.evaluate(() =>
    (window.__DM_CHIAMATE__ || [])
      .filter((c) => c.domain === "climate" && c.service === "set_temperature")
      .map((c) => c.service_data),
  );

const linguetta = (page, zona) => page.locator(`#page-clima #clima-page-mode-${zona}`);
const griglia = (page, zona) => page.locator(`#page-clima #clima-grid-${zona}`);

test("tre linguette, e i termostati a coppia stanno solo nella terza", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await avvia(page, testInfo, "off");
  // L'ordine: Freddo · Caldo · Termostato.
  const ordine = await page
    .locator("#page-clima .clima-page-mode-switch [data-dm-cl-zone]")
    .evaluateAll((tasti) =>
      tasti.filter((t) => getComputedStyle(t).display !== "none").map((t) => t.dataset.dmClZone),
    );
  expect(ordine).toEqual(["freddo", "caldo", "termostato"]);
  await expect(linguetta(page, "termostato")).toContainText("Termostato");
  await expect(linguetta(page, "termostato").locator("[data-dm-cl-count]")).toHaveText("2");
  // I due termostati a coppia sono nella terza griglia, e non nelle altre.
  for (const entita of ["climate.living", "climate.camera"]) {
    await expect(griglia(page, "termostato").locator(`[data-dm-cl="${entita}"]`)).toHaveCount(1);
    await expect(griglia(page, "caldo").locator(`[data-dm-cl="${entita}"]`)).toHaveCount(0);
    await expect(griglia(page, "freddo").locator(`[data-dm-cl="${entita}"]`)).toHaveCount(0);
  }
  await expect(griglia(page, "caldo").locator('[data-dm-cl="climate.bagno"]')).toHaveCount(1);
  await expect(griglia(page, "freddo").locator('[data-dm-cl="climate.salone"]')).toHaveCount(1);

  /* Il tocco sulla terza linguetta la accende, e spegne le altre due. */
  await linguetta(page, "termostato").click();
  await expect(linguetta(page, "termostato")).toHaveAttribute("aria-pressed", "true");
  await expect(linguetta(page, "freddo")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#page-clima .clima-zone-termostato")).toBeVisible();
  await expect(page.locator("#page-clima .clima-zone-freddo")).toBeHidden();
  await expect(page.locator("#page-clima .clima-zone-caldo")).toBeHidden();
  await expect(page.locator("#page-clima [data-dm-cl-sub]")).toContainText("Termostati");
  /* E dal Termostato si torna al Caldo con una griglia sola accesa. */
  await linguetta(page, "caldo").click();
  await expect(page.locator("#page-clima .clima-zone-caldo")).toBeVisible();
  await expect(page.locator("#page-clima .clima-zone-termostato")).toBeHidden();
  await expect(linguetta(page, "termostato")).toHaveAttribute("aria-pressed", "false");
});

test("la card del termostato: «Caldo 22°» e «Freddo 40°», ognuno coi suoi tasti", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await avvia(page, testInfo, "off");
  await linguetta(page, "termostato").click();
  const living = griglia(page, "termostato").locator('[data-dm-cl="climate.living"]');
  const caldo = living.locator('[data-dm-cl-estremo="basso"]');
  const freddo = living.locator('[data-dm-cl-estremo="alto"]');
  await expect(caldo).toContainText("Caldo");
  await expect(caldo.locator("[data-dm-cl-estremo-val]")).toHaveText("22°");
  await expect(freddo).toContainText("Freddo");
  await expect(freddo.locator("[data-dm-cl-estremo-val]")).toHaveText("40°");
  await expect(living.locator("[data-dm-cl-ambient]")).toHaveText("19.5°");
  // L'alto e' al massimo dichiarato (40): il suo piu' e' spento.
  await expect(freddo.locator('[data-dm-cl-verso="1"]')).toBeDisabled();

  /* Il piu' del caldo: parte la coppia, e la finestra non si apre. */
  await caldo.locator('[data-dm-cl-verso="1"]').click();
  await expect.poll(() => temperature(page), { timeout: 10000 }).toHaveLength(1);
  expect((await temperature(page))[0]).toEqual({
    entity_id: "climate.living",
    target_temp_low: 22.5,
    target_temp_high: 40,
  });
  await expect(page.locator("#clima-popup-overlay")).not.toHaveClass(/show/);
  await expect(caldo.locator("[data-dm-cl-estremo-val]")).toHaveText("22.5°");
  /* Un secondo tocco prima della risposta si somma al primo; il meno del
   * freddo muove il freddo, e il caldo resta quello appena mandato. */
  await caldo.locator('[data-dm-cl-verso="1"]').click();
  await freddo.locator('[data-dm-cl-verso="-1"]').click();
  await expect.poll(() => temperature(page), { timeout: 10000 }).toHaveLength(3);
  const chiamate = await temperature(page);
  expect(chiamate[1]).toEqual({
    entity_id: "climate.living",
    target_temp_low: 23,
    target_temp_high: 40,
  });
  expect(chiamate[2]).toEqual({
    entity_id: "climate.living",
    target_temp_low: 23,
    target_temp_high: 39.5,
  });
  expect(chiamate.every((dati) => !("temperature" in dati))).toBe(true);

  /* Il termostato in riscaldamento mostra lo stesso tutti e due i numeri. */
  const camera = griglia(page, "termostato").locator('[data-dm-cl="climate.camera"]');
  await expect(camera.locator('[data-dm-cl-estremo="basso"] [data-dm-cl-estremo-val]')).toHaveText(
    "21.5°",
  );
  await expect(camera.locator('[data-dm-cl-estremo="alto"] [data-dm-cl-estremo-val]')).toHaveText(
    "26°",
  );
});

test("i testimoni a obiettivo solo restano in Caldo e in Freddo, e mandano temperature", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await avvia(page, testInfo, "heat_cool");
  await linguetta(page, "caldo").click();
  const bagno = griglia(page, "caldo").locator('[data-dm-cl="climate.bagno"]');
  await expect(bagno.locator("[data-dm-cl-target]")).toHaveText("23°");
  await bagno.locator(".dm-cl-step").nth(1).click();
  await expect.poll(() => temperature(page), { timeout: 10000 }).toHaveLength(1);
  expect((await temperature(page))[0]).toEqual({ entity_id: "climate.bagno", temperature: 24 });
  await linguetta(page, "freddo").click();
  const salone = griglia(page, "freddo").locator('[data-dm-cl="climate.salone"]');
  await expect(salone.locator("[data-dm-cl-target]")).toHaveText("24°");
  await salone.locator(".dm-cl-step").first().click();
  await expect.poll(() => temperature(page), { timeout: 10000 }).toHaveLength(2);
  expect((await temperature(page))[1]).toEqual({ entity_id: "climate.salone", temperature: 23 });
});

test("senza termostati a coppia la terza linguetta non c'e', e la pagina torna indietro", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await avvia(page, testInfo, "off");
  await linguetta(page, "termostato").click();
  await expect(page.locator("#page-clima .clima-zone-termostato")).toBeVisible();
  /* I due termostati diventano a obiettivo solo: la linguetta se ne va, e la
   * pagina — che era li' — torna sulla prima che ha qualcosa. */
  await page.evaluate(() => {
    const stati = eval("_RAW_STATES");
    for (const id of ["climate.living", "climate.camera"]) {
      stati[id] = {
        entity_id: id,
        state: "heat",
        attributes: {
          friendly_name: id,
          current_temperature: 20,
          temperature: 21,
          hvac_modes: ["off", "heat"],
        },
      };
    }
    window.render?.();
  });
  await expect(linguetta(page, "termostato")).toBeHidden();
  await expect(page.locator("#page-clima .clima-zone-termostato")).toBeHidden();
  await expect(page.locator("#page-clima .clima-zone-freddo")).toBeVisible();
  await expect(linguetta(page, "freddo")).toHaveAttribute("aria-pressed", "true");
  await expect(griglia(page, "caldo").locator('[data-dm-cl="climate.living"]')).toHaveCount(1);
});

test("la finestra del Clima e la tessera della Home sanno dei due obiettivi", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await avvia(page, testInfo, "heat_cool");
  await page.evaluate(() => window.apriClimaPopup?.("climate.living", null));
  const gradi = page.locator("#cp-temp-val");
  await expect(gradi).toHaveAttribute("data-dm-cl-doppio", "entrambi");
  await expect(gradi.locator('[data-dm-cl-obj="basso"]')).toHaveText("22°");
  await expect(gradi.locator('[data-dm-cl-obj="alto"]')).toHaveText("40°");
  // Il meno e il piu' del guscio, che non dicono quale numero muovono, via.
  await expect(page.locator("#clima-popup-overlay .clima-temp-btn").first()).toBeHidden();
  // Il pannello della finestra: un passo per il caldo e uno per il freddo.
  const pannello = page.locator("#clima-popup-overlay [data-dm-cl-panel]");
  await expect(pannello.locator('[data-dm-w-obiettivo="basso"] b')).toHaveText("22,0°");
  await expect(pannello.locator('[data-dm-w-obiettivo="alto"] b')).toHaveText("40,0°");
  await pannello.locator('[data-dm-w-obj="alto"][data-dm-w-temp="-1"]').click();
  await expect.poll(() => temperature(page), { timeout: 10000 }).toHaveLength(1);
  expect((await temperature(page))[0]).toEqual({
    entity_id: "climate.living",
    target_temp_low: 22,
    target_temp_high: 39.5,
  });
  await pannello.locator('[data-dm-w-obj="basso"][data-dm-w-temp="1"]').click();
  await expect.poll(() => temperature(page), { timeout: 10000 }).toHaveLength(2);
  expect((await temperature(page))[1]).toEqual({
    entity_id: "climate.living",
    target_temp_low: 22.5,
    target_temp_high: 40,
  });
  // Il passo del guscio, se qualcuno lo chiama lo stesso, manda la coppia.
  await page.evaluate(() => window.cpSetTemp(-0.5));
  await expect.poll(() => temperature(page), { timeout: 10000 }).toHaveLength(3);
  expect((await temperature(page))[2]).not.toHaveProperty("temperature");
  await page.evaluate(() => window.chiudiClimaPopup?.());

  /* La tessera della Home: la riga scrive la coppia accanto all'ambiente. */
  await page.evaluate(() => {
    document.querySelectorAll(".page").forEach((n) => n.classList.remove("active"));
    document.getElementById("page-home")?.classList.add("active");
    window.render?.();
  });
  await page
    .locator('#dm-widgets .dm-tile[data-dm-widget="clima"]')
    .evaluate((nodo) => nodo.click());
  const riga = page.locator("#dm-widget-popup .dm-w-row", { hasText: "Termostato Living" });
  await expect(riga.locator(".dm-w-clima-gradi small")).toHaveText("→ 22–40°");
});
