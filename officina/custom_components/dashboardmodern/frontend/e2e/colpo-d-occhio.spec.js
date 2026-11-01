/* «Colpo d'occhio»: la plancia di una pagina sola.
 *
 * Dal campo: «una pagina unica, senza sezioni, ma con popup diretti per
 * vedere i dati». La casa qui sotto e' finta e coi nomi generici: un impianto
 * fotovoltaico con batteria, sei telecamere, un antifurto fatto di tre
 * interruttori (Notte, Giorno, Casa), un cancello da aprire con un tocco.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const ADESSO = Date.parse("2026-10-25T12:30:00Z");

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
  },
  visibility: { home: true, energy: true },
};

const TELECAMERE = ["strada", "ingresso", "cortile", "giardino", "garage", "terrazza"];

const OCCHIO = {
  attiva: true,
  titolo: "Casa",
  meteo: "weather.casa",
  riquadri: [
    { id: "r1", tipo: "energia" },
    { id: "r2", tipo: "telecamere" },
    { id: "r3", tipo: "antifurto" },
    { id: "r4", tipo: "apri", nome: "Cancello", entita: "switch.cancello" },
  ],
  energia: {
    solare: "sensor.fv_potenza",
    casa: "sensor.casa_potenza",
    rete: "sensor.rete_potenza",
    batteria: "sensor.batteria_potenza",
    soc: "sensor.batteria_soc",
    giorno: {
      solare: "sensor.fv_oggi",
      casa: "sensor.casa_oggi",
      comprata: "sensor.rete_comprata_oggi",
      venduta: "sensor.rete_venduta_oggi",
      carica: "sensor.batteria_carica_oggi",
      scarica: "sensor.batteria_scarica_oggi",
    },
    mese: {
      solare: "sensor.fv_mese",
      casa: "sensor.casa_mese",
      comprata: "sensor.rete_comprata_mese",
      venduta: "sensor.rete_venduta_mese",
      carica: "sensor.batteria_carica_mese",
      scarica: "sensor.batteria_scarica_mese",
    },
  },
  telecamere: TELECAMERE.map((n) => ({
    entity: `camera.${n}`,
    nome: n.charAt(0).toUpperCase() + n.slice(1),
  })),
  antifurto: {
    modi: [
      { entita: "input_boolean.antifurto_notte", nome: "Notte", disegno: "moon" },
      { entita: "input_boolean.antifurto_giorno", nome: "Giorno", disegno: "sun" },
      { entita: "input_boolean.antifurto_casa", nome: "Casa", disegno: "home" },
    ],
  },
};

const s = (state, attributes = {}) => ({ state: String(state), attributes });
function stati() {
  const fuori = {
    "weather.casa": s("partlycloudy", {
      temperature: 19.4,
      humidity: 62,
      wind_speed: 11,
      wind_speed_unit: "km/h",
      friendly_name: "Casa",
    }),
    "sensor.fv_potenza": s(3420, { unit_of_measurement: "W" }),
    "sensor.casa_potenza": s(1180, { unit_of_measurement: "W" }),
    "sensor.rete_potenza": s(-1540, { unit_of_measurement: "W" }),
    "sensor.batteria_potenza": s(-700, { unit_of_measurement: "W" }),
    "sensor.batteria_soc": s(78, { unit_of_measurement: "%" }),
    "sensor.fv_oggi": s(14.8, { unit_of_measurement: "kWh" }),
    "sensor.casa_oggi": s(9.3, { unit_of_measurement: "kWh" }),
    "sensor.rete_comprata_oggi": s(1.2, { unit_of_measurement: "kWh" }),
    "sensor.rete_venduta_oggi": s(4.6, { unit_of_measurement: "kWh" }),
    "sensor.batteria_carica_oggi": s(3.9, { unit_of_measurement: "kWh" }),
    "sensor.batteria_scarica_oggi": s(1.8, { unit_of_measurement: "kWh" }),
    "sensor.fv_mese": s(386.2, { unit_of_measurement: "kWh" }),
    "sensor.casa_mese": s(274.5, { unit_of_measurement: "kWh" }),
    "sensor.rete_comprata_mese": s(41.7, { unit_of_measurement: "kWh" }),
    "sensor.rete_venduta_mese": s(133.0, { unit_of_measurement: "kWh" }),
    "sensor.batteria_carica_mese": s(98.4, { unit_of_measurement: "kWh" }),
    "sensor.batteria_scarica_mese": s(87.1, { unit_of_measurement: "kWh" }),
    "input_boolean.antifurto_notte": s("on"),
    "input_boolean.antifurto_giorno": s("off"),
    "input_boolean.antifurto_casa": s("off"),
    "switch.cancello": s("off", { friendly_name: "Cancello" }),
  };
  for (const n of TELECAMERE)
    fuori[`camera.${n}`] = s("idle", {
      entity_picture: `/api/camera_proxy/camera.${n}?token=x`,
      friendly_name: n,
    });
  return Object.fromEntries(Object.entries(fuori).map(([id, v]) => [id, { entity_id: id, ...v }]));
}

/* Le previsioni, come le manda `weather.get_forecasts`. */
function previsioni(tipo) {
  const condizioni = [
    "partlycloudy",
    "sunny",
    "rainy",
    "cloudy",
    "sunny",
    "lightning-rainy",
    "sunny",
  ];
  if (tipo === "daily")
    return condizioni.map((c, i) => ({
      datetime: new Date(ADESSO + i * 86_400_000).toISOString().slice(0, 10) + "T10:00:00+00:00",
      condition: c,
      temperature: 21 - i,
      templow: 11 + (i % 3),
    }));
  return Array.from({ length: 24 }, (_, h) => ({
    datetime: `2026-10-25T${String(h).padStart(2, "0")}:00:00+00:00`,
    condition: h < 7 || h > 18 ? "clear-night" : h < 12 ? "sunny" : "partlycloudy",
    temperature: 12 + Math.round(7 * Math.sin(((h - 6) / 24) * Math.PI * 2)),
    precipitation: h === 16 ? 0.4 : 0,
  }));
}

/* Le istantanee: una scena disegnata per telecamera, cosi' la griglia si
 * legge come una griglia vera. */
const COLORI = ["#334155", "#1e3a5f", "#3f4d2e", "#2d4a3e", "#4a3b2d", "#3b2d4a"];
function scena(i) {
  return `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='360'>
    <defs><linearGradient id='c' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#94a3b8'/><stop offset='.55' stop-color='${COLORI[i]}'/><stop offset='1' stop-color='#0f172a'/></linearGradient></defs>
    <rect width='640' height='360' fill='url(#c)'/>
    <rect x='${60 + i * 30}' y='150' width='180' height='140' fill='#1f2937' opacity='.8'/>
    <rect x='${300 - i * 10}' y='120' width='220' height='170' fill='#475569' opacity='.7'/>
    <rect x='0' y='290' width='640' height='70' fill='#111827'/>
  </svg>`;
}

async function boot(page, testInfo, { tema = "light", config = OCCHIO, premium = true } = {}) {
  test.setTimeout(150_000);
  /* La licenza: il Colpo d'occhio e' Premium, come la plancia a muro. */
  await page.addInitScript((p) => {
    window.__GDAHOME_PREMIUM__ = p;
  }, premium);
  await page.clock.install({ time: ADESSO });
  await page.route("**/api/camera_proxy/**", (route) => {
    const n = TELECAMERE.findIndex((x) => route.request().url().includes(`camera.${x}`));
    route.fulfill({ contentType: "image/svg+xml", body: scena(Math.max(0, n)) });
  });
  await page.addInitScript(
    ({ giorni, ore }) => {
      window.__CHIAMATE = [];
      class MockSocket extends EventTarget {
        static OPEN = 1;
        readyState = 1;
        onopen = null;
        onmessage = null;
        constructor() {
          super();
          queueMicrotask(() => {
            this.onopen?.({});
            this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
          });
        }
        send(raw) {
          const m = JSON.parse(raw);
          if (m.type === "auth") return;
          let result = null;
          if (m.type === "get_states") result = [];
          else if (m.type === "frontend/get_user_data") result = { value: null };
          else if (m.type === "call_service" && m.service === "get_forecasts") {
            const id = m.target?.entity_id;
            result = {
              response: { [id]: { forecast: m.service_data?.type === "hourly" ? ore : giorni } },
            };
          } else if (m.type === "call_service") {
            window.__CHIAMATE.push([
              m.domain,
              m.service,
              m.service_data?.entity_id || m.target?.entity_id,
              ...(m.service_data?.option ? [m.service_data.option] : []),
            ]);
            result = {};
          }
          setTimeout(
            () =>
              this.onmessage?.({
                data: JSON.stringify({ id: m.id, type: "result", success: true, result }),
              }),
            10,
          );
        }
        close() {}
      }
      window.__DASHBOARDMODERN_BRIDGE_WS__ = MockSocket;
      window.WebSocket = MockSocket;
    },
    { giorni: previsioni("daily"), ore: previsioni("hourly") },
  );
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true, null, {
    timeout: 60_000,
  });
  await expect(page.locator("#cd-boot-overlay")).toHaveCount(0, { timeout: 30_000 });
  await page.evaluate(
    ({ stati, config, tema }) => {
      document.documentElement.setAttribute("data-theme", tema);
      Object.assign(_RAW_STATES, stati);
      window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...stati } };
      localStorage.setItem("cd_occhio", JSON.stringify(config));
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready"));
    },
    { stati: stati(), config, tema },
  );
  if (!premium) return;
  await expect(page.locator("#dm-occhio .oc-riquadro")).toHaveCount(config.riquadri.length, {
    timeout: 20_000,
  });
}

const foto = (testInfo, nome) =>
  process.env.DM_FOTO ? `${process.env.DM_FOTO}/${nome}-${testInfo.project.name}.png` : null;

async function scatta(page, testInfo, nome) {
  const dove = foto(testInfo, nome);
  if (!dove) return;
  await page.waitForTimeout(450);
  await page.screenshot({ path: dove, animations: "disabled" });
}

for (const tema of ["light", "dark"]) {
  test(`la pagina unica e i suoi popup (${tema})`, async ({ page }, testInfo) => {
    await boot(page, testInfo, { tema });
    const tela = page.locator("#dm-occhio");
    await expect(tela.locator(".oc-testa h1")).toHaveText("Casa");
    /* Il ☰ in cima, come sulla plancia a muro: apre il menu di chi ospita. */
    await page.evaluate(() => {
      window.__menuAperto = 0;
      window.apriMenuLaterale = () => (window.__menuAperto += 1);
    });
    await tela.locator('[data-oc="menu"]').click();
    expect(await page.evaluate(() => window.__menuAperto)).toBe(1);
    await expect(tela.locator(".oc-meteo")).toContainText("19°");
    await expect(tela.locator('.oc-riquadro[data-tipo="antifurto"]')).toContainText("Notte");
    await expect(tela.locator('.oc-riquadro[data-tipo="antifurto"]')).toHaveAttribute(
      "data-acceso",
      "true",
    );
    await scatta(page, testInfo, `occhio-home-${tema}`);

    /* Il meteo: i sette giorni, e un giorno apre le sue ore. */
    await tela.locator(".oc-meteo").click();
    await expect(tela.locator(".oc-giorni li")).toHaveCount(7, { timeout: 10_000 });
    await scatta(page, testInfo, `occhio-meteo-${tema}`);
    await tela.locator(".oc-giorni button").first().click();
    await expect(tela.locator(".oc-ore li").first()).toBeVisible({ timeout: 10_000 });
    await scatta(page, testInfo, `occhio-meteo-ore-${tema}`);
    await tela.locator('[data-oc="chiudi"]').click();

    /* Il fotovoltaico: il flusso coi cerchi della plancia, adesso, oggi e nel mese. */
    await expect(tela.locator('.oc-riquadro[data-tipo="energia"]')).toContainText("3,42 kW");
    await tela.locator('.oc-riquadro[data-tipo="energia"]').click();
    await expect(tela.locator('.oc-n[data-nodo="solare"]')).toContainText("3,42 kW");
    await expect(tela.locator('.oc-linea[data-linea="sole-rete"]')).toHaveAttribute(
      "data-acceso",
      "true",
    );
    await expect(tela.locator('.oc-linea[data-linea="sole-batteria"]')).toHaveAttribute(
      "data-acceso",
      "true",
    );
    await expect(tela.locator(".oc-n-soc")).toHaveText("78%");
    await scatta(page, testInfo, `occhio-energia-adesso-${tema}`);
    await tela.locator('[data-oc-periodo="giorno"]').click();
    await expect(tela.locator('.oc-n[data-nodo="solare"]')).toContainText("14,8");
    await scatta(page, testInfo, `occhio-energia-giorno-${tema}`);
    await tela.locator('[data-oc-periodo="mese"]').click();
    await expect(tela.locator('.oc-n[data-nodo="solare"]')).toContainText("386,2");
    await tela.locator('[data-oc="chiudi"]').click();

    /* Le telecamere: la griglia. */
    await tela.locator('.oc-riquadro[data-tipo="telecamere"]').click();
    await expect(tela.locator(".oc-cam")).toHaveCount(6);
    await expect(tela.locator(".oc-cam img").first()).toHaveAttribute("src", /.+/, {
      timeout: 10_000,
    });
    /* Il motore della plancia principale: la foto si posa quando e' arrivata. */
    await expect(tela.locator('.oc-cam img[data-dm-camera-state="ready"]')).toHaveCount(6, {
      timeout: 15_000,
    });
    await scatta(page, testInfo, `occhio-telecamere-${tema}`);
    await tela.locator('[data-oc="chiudi"]').click();

    /* L'antifurto: Notte accesa, gli altri spenti. */
    await tela.locator('.oc-riquadro[data-tipo="antifurto"]').click();
    await expect(tela.locator(".oc-modo")).toHaveCount(3);
    await expect(tela.locator('.oc-modo[data-acceso="true"]')).toContainText("Notte");
    await scatta(page, testInfo, `occhio-antifurto-${tema}`);
    await tela.locator(".oc-modo", { hasText: "Giorno" }).click();
    expect(await page.evaluate(() => window.__CHIAMATE.at(-1))).toEqual([
      "input_boolean",
      "turn_on",
      "input_boolean.antifurto_giorno",
    ]);
    await tela.locator('[data-oc="chiudi"]').click();

    /* Il cancello: un tocco, e la scritta. */
    await tela.locator('.oc-riquadro[data-tipo="apri"]').click();
    expect(await page.evaluate(() => window.__CHIAMATE.at(-1))).toEqual([
      "switch",
      "turn_on",
      "switch.cancello",
    ]);
    await expect(tela.locator(".oc-avviso")).toHaveClass(/visto/);
    await scatta(page, testInfo, `occhio-cancello-${tema}`);
  });
}

/* Il video del tablet: due modi sullo stesso select, «Totale notte» e
 * «Totale sensori», erano tutti e due «Attivato» e il tocco non mandava
 * niente. Ora se ne accende uno, il tocco sceglie la sua voce, e quello col
 * PIN chiede il codice. */
test("i modi su un select: uno solo acceso, il tocco sceglie la voce, il PIN si chiede", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "basta una misura");
  const config = {
    ...OCCHIO,
    antifurto: {
      modi: [
        {
          entita: "input_select.antifurto",
          opzione: "Totale notte",
          nome: "Totale notte",
          disegno: "moon",
          colore: "#2f2fff",
          pin: "2468",
        },
        { entita: "input_select.antifurto", opzione: "Totale sensori", nome: "Totale sensori" },
      ],
    },
  };
  await boot(page, testInfo, { tema: "dark", config });
  await page.evaluate(() => {
    const stato = { state: "Totale notte", attributes: {} };
    Object.assign(_RAW_STATES, { "input_select.antifurto": stato });
    window.__HASS__.states["input_select.antifurto"] = stato;
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready"));
  });
  const tela = page.locator("#dm-occhio");
  await tela.locator('.oc-riquadro[data-tipo="antifurto"]').click();
  await expect(tela.locator(".oc-modo")).toHaveCount(2);
  await expect(tela.locator('.oc-modo[data-acceso="true"]')).toHaveCount(1);
  await expect(tela.locator('.oc-modo[data-acceso="true"]')).toContainText("Totale notte");
  /* il nome del modo acceso si legge: non e' blu pieno su blu notte */
  const colore = await tela
    .locator('.oc-modo[data-acceso="true"] strong')
    .evaluate((el) => getComputedStyle(el).color);
  expect(colore).not.toBe("rgb(47, 47, 255)");
  await scatta(page, testInfo, "occhio-antifurto-select");
  await tela.locator(".oc-modo", { hasText: "Totale sensori" }).click();
  expect(await page.evaluate(() => window.__CHIAMATE.at(-1))).toEqual([
    "input_select",
    "select_option",
    "input_select.antifurto",
    "Totale sensori",
  ]);
  /* quello col PIN: il tastierino, il codice sbagliato non manda niente */
  const prima = await page.evaluate(() => window.__CHIAMATE.length);
  await tela.locator(".oc-modo", { hasText: "Totale notte" }).click();
  await expect(tela.locator(".oc-cifre")).toBeVisible();
  for (const k of ["1", "1", "1", "1", "✓"]) await tela.locator(`[data-oc-cifra="${k}"]`).click();
  await expect(tela.locator(".oc-codice.sbagliato")).toBeVisible();
  expect(await page.evaluate(() => window.__CHIAMATE.length)).toBe(prima);
  await scatta(page, testInfo, "occhio-antifurto-pin");
  for (const k of ["2", "4", "6", "8", "✓"]) await tela.locator(`[data-oc-cifra="${k}"]`).click();
  expect(await page.evaluate(() => window.__CHIAMATE.at(-1))).toEqual([
    "input_select",
    "select_option",
    "input_select.antifurto",
    "Totale notte",
  ]);
  await expect(tela.locator(".oc-cifre")).toHaveCount(0);
});

test("le telecamere riservate non si vedono quando in casa c'e' qualcuno", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo);
  await page.evaluate(() => {
    const ns = window.__DASHBOARDMODERN_STORAGE_NS__ || "";
    const scrivi = (chiave, valore) => {
      localStorage.setItem(chiave, JSON.stringify(valore));
      if (ns) localStorage.setItem(`${ns}${chiave}`, JSON.stringify(valore));
    };
    const stato = { entity_id: "person.uno", state: "home", attributes: {} };
    _RAW_STATES["person.uno"] = stato;
    window.__HASS__.states["person.uno"] = stato;
    scrivi("cd_people", [{ id: "p1", entity: "person.uno" }]);
    scrivi("cd_telecamere_riservate", { "camera.ingresso": true });
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready"));
  });
  const tela = page.locator("#dm-occhio");
  await tela.locator('.oc-riquadro[data-tipo="telecamere"]').click();
  await expect(tela.locator(".oc-cam")).toHaveCount(5, { timeout: 10_000 });
  await expect(tela.locator('.oc-cam[data-oc-cam="camera.ingresso"]')).toHaveCount(0);
});

test("con GdAHome Base la plancia resta quella di sempre, e la scheda del Config e' chiusa", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo, { premium: false });
  await page.waitForTimeout(1500);
  await expect(page.locator("#dm-occhio")).toHaveCount(0);
  /* Il config resta scritto per il giorno in cui la casa diventa Premium. */
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("cd_occhio")).attiva)).toBe(
    true,
  );
  await page.evaluate(() => {
    window.apriConfigEntita?.();
    setTimeout(() => window.editorSwitch?.("occhio"), 50);
  });
  const lucchetto = page.locator("#ed-body .dm-oc-ed-lucchetto");
  await expect(lucchetto).toBeVisible({ timeout: 20_000 });
  await expect(lucchetto).toContainText("Premium");
  /* Dietro il lucchetto i campi non si possono cambiare. */
  await expect(page.locator("#ed-body .dm-oc-ed-dietro")).toHaveAttribute("inert", "");
  const dove = foto(testInfo, "occhio-config-base");
  if (dove) {
    await page.waitForTimeout(300);
    await page.locator("#editor-modal").screenshot({ path: dove, animations: "disabled" });
  }
});

test("spenta, la plancia resta quella di sempre", async ({ page }, testInfo) => {
  await boot(page, testInfo);
  await page.evaluate(() => {
    localStorage.setItem("cd_occhio", JSON.stringify({ attiva: false }));
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready"));
  });
  await expect(page.locator("#dm-occhio")).toHaveCount(0, { timeout: 10_000 });
});

test("dal tasto in cima si apre la sua scheda del Config, e quello che si cambia si vede", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo);
  await page.locator('#dm-occhio [data-oc="config"]').click();
  const corpo = page.locator("#ed-body .dm-oc-ed");
  await expect(corpo).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.ed-tab[data-tab="occhio"]')).toHaveClass(/active/);
  /* Nel menu del Config sta sotto «Plancia», subito dopo «A muro». */
  const doveSta = foto(testInfo, "occhio-config-aperto");
  if (doveSta) {
    await page.waitForTimeout(400);
    await page.screenshot({ path: doveSta, animations: "disabled" });
  }
  /* Il Config sta sopra: la pagina si fa da parte finche' e' aperto. */
  await expect(page.locator("#dm-occhio")).toBeHidden();
  await expect(corpo.locator('[data-dm-oc-campo="energia.solare"]')).toHaveValue(
    "sensor.fv_potenza",
  );
  await expect(corpo.locator('[data-dm-oc-gruppo="telecamere"] .dm-oc-ed-voce')).toHaveCount(6);
  /* Le foto della scheda, un gruppo alla volta. */
  for (const gruppo of ["testata", "riquadri", "energia", "telecamere", "antifurto"]) {
    const dove = foto(testInfo, `occhio-config-${gruppo}`);
    if (!dove) break;
    const pezzo = corpo.locator(`[data-dm-oc-gruppo="${gruppo}"]`);
    await pezzo.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await pezzo.screenshot({ path: dove, animations: "disabled" });
  }
  /* Il nome della casa si cambia e resta. */
  await corpo.locator('[data-dm-oc-campo="titolo"]').fill("Villa");
  await corpo.locator('[data-dm-oc-campo="titolo"]').blur();
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("cd_occhio")).titolo))
    .toBe("Villa");
  /* Un riquadro in piu': un altro cancello. */
  await corpo.locator('[data-dm-oc-aggiungi="apri"]').click();
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("cd_occhio")).riquadri.length))
    .toBe(5);
  /* Chiuso il Config, la pagina torna da sola, col nome nuovo. */
  await page.locator("#editor-modal .ed-head-close").click();
  await expect(page.locator("#dm-occhio")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("#dm-occhio .oc-testa h1")).toHaveText("Villa", { timeout: 10_000 });
});

/* «Verifica apertura telecamere a colpo d'occhio, non va bene»: aperta la
 * griglia, la finestra nasceva giusta e un attimo dopo diventava grande, con
 * le telecamere in due strisce alte e strette e mezza finestra vuota. Era il
 * video dal vivo: il motore della plancia lo mette accanto alla foto, e qui
 * non aveva uno stile, cosi' stava sotto di lei con la sua misura vera. Qui
 * lo si mette come lo mette il motore, e verticale, per non fidarsi del caso. */
test("il video dal vivo non cambia la misura dei riquadri ne' della finestra", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo);
  const tela = page.locator("#dm-occhio");
  await tela.locator('.oc-riquadro[data-tipo="telecamere"]').click();
  await expect(tela.locator(".oc-cam")).toHaveCount(6);
  const misura = () =>
    page.evaluate(() => {
      const finestra = document.querySelector("#dm-occhio .oc-finestra");
      const cam = [...document.querySelectorAll("#dm-occhio .oc-cam")].map((c) => {
        const r = c.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height) };
      });
      return { finestra: Math.round(finestra.getBoundingClientRect().width), cam };
    });
  /* La finestra entra con un piccolo ingrandimento, e la telecamera sotto il
   * puntatore si solleva: si misura a fine corsa, col puntatore altrove. */
  await page.mouse.move(2, 2);
  await page.waitForTimeout(600);
  const prima = await misura();
  await page.evaluate(() => {
    for (const img of document.querySelectorAll("#dm-occhio .oc-cam img")) {
      const video = document.createElement("video");
      video.className = "dm-cam-video";
      video.width = 1080;
      video.height = 1920;
      img.after(video);
      img.parentElement.dataset.dmVideo = "on";
    }
  });
  const dopo = await misura();
  expect(dopo.finestra).toBe(prima.finestra);
  for (const [i, c] of dopo.cam.entries()) {
    expect(c).toEqual(prima.cam[i]);
    expect(Math.abs(c.w / c.h - 16 / 9)).toBeLessThan(0.05);
  }
  /* Il video sta sopra la foto, dentro la cornice. */
  const box = await tela.locator(".oc-cam").first().boundingBox();
  const vbox = await tela.locator(".oc-cam video.dm-cam-video").first().boundingBox();
  /* Dentro il bordo di un pixel della cornice. */
  expect(Math.abs(vbox.width - box.width)).toBeLessThanOrEqual(2.5);
  await scatta(page, testInfo, "occhio-telecamere-dal-vivo");
});

test("due telecamere riempiono la finestra, senza una colonna vuota", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo);
  await page.evaluate(() => {
    const ns = window.__DASHBOARDMODERN_STORAGE_NS__ || "";
    const occhio = JSON.parse(localStorage.getItem("cd_occhio"));
    occhio.telecamere = occhio.telecamere.slice(0, 2);
    localStorage.setItem("cd_occhio", JSON.stringify(occhio));
    if (ns) localStorage.setItem(`${ns}cd_occhio`, JSON.stringify(occhio));
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready"));
  });
  const tela = page.locator("#dm-occhio");
  await tela.locator('.oc-riquadro[data-tipo="telecamere"]').click();
  await expect(tela.locator(".oc-cam")).toHaveCount(2, { timeout: 10_000 });
  await page.mouse.move(2, 2);
  await page.waitForTimeout(600);
  const griglia = await tela.locator(".oc-cam-griglia").boundingBox();
  const ultima = await tela.locator(".oc-cam").nth(1).boundingBox();
  expect(Math.abs(griglia.x + griglia.width - (ultima.x + ultima.width))).toBeLessThan(2);
  await scatta(page, testInfo, "occhio-due-telecamere");
});
