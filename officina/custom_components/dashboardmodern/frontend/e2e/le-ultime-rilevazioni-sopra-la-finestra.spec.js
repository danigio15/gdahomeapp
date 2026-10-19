/* «Selezionando il sensore si blocca» (#279).
 *
 * Il foglio «Ultime 24 ore» (#269) si apre anche toccando una riga della
 * finestra di una tessera della Home — Varchi, Presenza. Quella finestra, a
 * ogni giro, mette in pausa le animazioni di tutto quello che crede le stia
 * dietro, e il foglio — che vive fuori dalla finestra ma le sta SOPRA — veniva
 * fermato al fotogramma zero della sua entrata: opacita' zero. Invisibile,
 * steso su tutto lo schermo, si prendeva ogni tocco: la finestra sotto non
 * rispondeva piu' e la plancia sembrava piantata.
 *
 * Qui la casa arriva da un socket finto, come in Home Assistant: gli stati
 * all'avvio e lo storico del Recorder a richiesta, una giornata lunga e fitta.
 * L'orologio e' quello vero: il foglio deve funzionare mentre il tempo passa.
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
    /* Con una centrale la Home ha le sue tessere: senza, la plancia dice
     * ancora «quasi pronta» e le nasconde. */
    entityOverrides: { "dm.security_centrale_allarme": "alarm_control_panel.casa" },
  },
  visibility: { home: true, security: true, varchi: true, presenza: true },
};

async function avvia(page, testInfo) {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript(() => {
    const ora = Date.now();
    const iso = (ms) => new Date(ms).toISOString();
    const stati = [
      {
        entity_id: "alarm_control_panel.casa",
        state: "disarmed",
        last_changed: iso(ora - 3600_000),
        attributes: { friendly_name: "Centrale", supported_features: 3 },
      },
      {
        entity_id: "binary_sensor.porta_ingresso",
        state: "off",
        last_changed: iso(ora - 10 * 60_000),
        attributes: { friendly_name: "Ingresso", device_class: "door" },
      },
      {
        entity_id: "binary_sensor.corridoio",
        state: "off",
        last_changed: iso(ora - 2 * 60_000),
        attributes: { friendly_name: "Corridoio", device_class: "motion" },
      },
      {
        entity_id: "binary_sensor.cantina",
        state: "unavailable",
        last_changed: iso(ora - 40 * 60_000),
        attributes: { friendly_name: "Cantina", device_class: "door" },
      },
      {
        entity_id: "sensor.temperatura_salotto",
        state: "21.4",
        last_changed: iso(ora - 5 * 60_000),
        attributes: { friendly_name: "Temperatura", unit_of_measurement: "°C" },
      },
    ];
    /* Una giornata fitta: un rilevatore che scatta ogni mezzo minuto e una
     * porta che si apre ogni dieci, piu' un buco in cui non rispondevano. */
    const storia = (entity, da, a) => {
      const righe = [{ s: "off", lu: da / 1000 }];
      if (entity === "binary_sensor.corridoio")
        for (let t = da + 20_000; t < ora - 3 * 60_000; t += 30_000)
          righe.push({ s: "on", lu: t / 1000 }, { s: "off", lu: (t + 8_000) / 1000 });
      if (entity === "binary_sensor.porta_ingresso") {
        for (let t = da + 60_000; t < ora - 11 * 60_000; t += 10 * 60_000)
          righe.push({ s: "on", lu: t / 1000 }, { s: "off", lu: (t + 90_000) / 1000 });
        righe.push({ s: "unavailable", lu: (ora - 5 * 3600_000) / 1000 });
        righe.push({ s: "off", lu: (ora - 5 * 3600_000 + 600_000) / 1000 });
        righe.sort((x, y) => x.lu - y.lu);
      }
      if (entity === "sensor.temperatura_salotto")
        return Array.from({ length: 300 }, (_, i) => ({
          s: String(20 + (i % 7) / 3),
          lu: (da + i * 280_000) / 1000,
        }));
      if (entity === "binary_sensor.cantina") return [];
      return righe.filter((riga) => riga.lu * 1000 <= a);
    };
    window.__domandeDelloStorico = [];
    class SocketDiCasa extends EventTarget {
      static OPEN = 1;
      readyState = 1;
      onopen = null;
      onmessage = null;
      onclose = null;
      constructor() {
        super();
        queueMicrotask(() => {
          this.onopen?.({});
          this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
        });
      }
      send(raw) {
        const messaggio = JSON.parse(raw);
        if (messaggio.type === "auth") return;
        let result = null;
        if (messaggio.type === "get_states") result = stati;
        if (messaggio.type === "frontend/get_user_data") result = { value: null };
        if (messaggio.type === "history/history_during_period") {
          const entita = messaggio.entity_ids?.[0];
          window.__domandeDelloStorico.push(entita);
          result = {
            [entita]: storia(
              entita,
              Date.parse(messaggio.start_time),
              Date.parse(messaggio.end_time),
            ),
          };
        }
        queueMicrotask(() =>
          this.onmessage?.({
            data: JSON.stringify({ id: messaggio.id, type: "result", success: true, result }),
          }),
        );
      }
      close() {}
    }
    window.WebSocket = SocketDiCasa;
  });
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() =>
    Boolean(window.eval("_RAW_STATES")["binary_sensor.porta_ingresso"]),
  );
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate(() => {
    document.querySelectorAll(".page").forEach((nodo) => nodo.classList.remove("active"));
    document.getElementById("page-home")?.classList.add("active");
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  });
}

/* Com'e' il foglio davvero, a occhio: quanto si vede, se la sua entrata e'
 * ferma, e chi c'e' sotto il dito in mezzo allo schermo. */
const comeSiVede = (page) =>
  page.evaluate(() => {
    const nodo = document.getElementById("dm-ultime");
    const foglio = nodo?.querySelector(".dm-ur-foglio");
    const velo = nodo?.querySelector(".dm-ur-velo");
    const sotto = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
    return {
      aperto: Boolean(nodo && !nodo.hidden),
      foglio: foglio ? Number(getComputedStyle(foglio).opacity) : 0,
      velo: velo ? Number(getComputedStyle(velo).opacity) : 0,
      ferme: (nodo?.getAnimations?.({ subtree: true }) || []).filter(
        (anim) => anim.playState === "paused",
      ).length,
      sottoIlDito: Boolean(foglio && sotto && foglio.contains(sotto)),
    };
  });

async function apriLaTessera(page, chiave) {
  await page.locator(`#dm-widgets .dm-tile[data-dm-widget="${chiave}"]`).click();
  await expect(page.locator("#dm-widget-popup")).toBeVisible();
}

test("la riga della finestra Varchi apre un foglio che si vede e risponde", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);
  await apriLaTessera(page, "varchi");
  const riga = page.locator('#dm-widget-popup [data-dm-ultime="binary_sensor.porta_ingresso"]');
  await expect(riga).toBeVisible();
  await riga.click();

  const foglio = page.locator("#dm-ultime .dm-ur-foglio");
  await expect(foglio.locator("h2")).toHaveText("Ingresso");
  /* Un cambio della casa rifa' la finestra sotto: e' li' che il foglio si
   * fermava. */
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("dashboardmodern:state-changed", {
        detail: { entity_id: "binary_sensor.corridoio" },
      }),
    ),
  );
  await expect
    .poll(() => comeSiVede(page), { timeout: 10_000 })
    .toEqual({ aperto: true, foglio: 1, velo: 1, ferme: 0, sottoIlDito: true });

  /* La storia arriva e i conti ci sono. */
  await expect(page.locator("#dm-ultime")).toHaveAttribute("data-esito", "pronta");
  await expect(foglio.locator(".dm-ur-casella b").first()).toHaveText(/\d+ volte|1 volta/);
  await expect(foglio.locator(".dm-ur-legenda")).toContainText("Non rispondeva");

  /* Il foglio risponde: Ieri, e poi la crocetta. */
  await foglio.locator('[data-ur-modo="ieri"]').click();
  await expect(foglio.locator('[data-ur-modo="ieri"]')).toHaveAttribute("aria-pressed", "true");
  await foglio.locator(".dm-ur-x").click();
  await expect(page.locator("#dm-ultime")).toBeHidden();

  /* E la finestra sotto e' ancora viva: la stessa riga, di nuovo. */
  await expect(page.locator("#dm-widget-popup")).toBeVisible();
  await riga.click();
  await expect.poll(() => comeSiVede(page)).toMatchObject({ aperto: true, foglio: 1, ferme: 0 });
  await page.keyboard.press("Escape");
  await expect(page.locator("#dm-ultime")).toBeHidden();
  await page.locator("#dm-widget-popup [data-dm-widget-close]").first().click();
  await expect(page.locator("#dm-widget-popup")).toBeHidden();
});

test("il rilevatore della finestra Presenza, con una giornata fitta, non pianta la pagina", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);
  await apriLaTessera(page, "presenza");
  const riga = page.locator('#dm-widget-popup [data-dm-ultime="binary_sensor.corridoio"]');
  await expect(riga).toBeVisible();
  await riga.click();
  await expect(page.locator("#dm-ultime")).toHaveAttribute("data-esito", "pronta", {
    timeout: 20_000,
  });
  await expect
    .poll(() => comeSiVede(page), { timeout: 10_000 })
    .toEqual({ aperto: true, foglio: 1, velo: 1, ferme: 0, sottoIlDito: true });
  /* Quasi tremila movimenti: la pagina risponde in fretta lo stesso. */
  const quanto = await page.evaluate(async () => {
    const prima = performance.now();
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
    await new Promise((fatto) => requestAnimationFrame(() => setTimeout(fatto, 0)));
    return performance.now() - prima;
  });
  expect(quanto).toBeLessThan(3_000);
  await expect(page.locator("#dm-ultime .dm-ur-casella b").first()).toHaveText(/^\d+$/);
});

test("i sensori strani aprono il foglio senza piantarsi", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  const foglio = page.locator("#dm-ultime .dm-ur-foglio");
  const casi = [
    /* Non risponde, e il Recorder non ha niente. */
    ["binary_sensor.cantina", { famiglia: "varco" }, "Non risponde"],
    /* Un numero non e' una porta: si legge come muto, non si pianta. */
    ["sensor.temperatura_salotto", { famiglia: "varco" }, "Non risponde"],
    /* Un'entita' che non c'e' piu'. */
    ["binary_sensor.tolto", { famiglia: "movimento", nome: "Tolto" }, "Non risponde"],
  ];
  for (const [entita, detto, parola] of casi) {
    await page.evaluate(([id, d]) => window.apriUltimeRilevazioni(id, d), [entita, detto]);
    await expect(foglio.locator(".dm-ur-grande b")).toHaveText(parola);
    await expect(page.locator("#dm-ultime")).not.toHaveAttribute("data-esito", "attesa", {
      timeout: 20_000,
    });
    await page.keyboard.press("Escape");
    await expect(page.locator("#dm-ultime")).toBeHidden();
  }
  /* Lo stesso sensore due volte di fila: una domanda sola al Recorder. */
  for (let volta = 0; volta < 2; volta += 1) {
    await page.evaluate(() =>
      window.apriUltimeRilevazioni("binary_sensor.porta_ingresso", { famiglia: "varco" }),
    );
    await expect(page.locator("#dm-ultime")).toHaveAttribute("data-esito", "pronta");
  }
  const domande = await page.evaluate(() =>
    window.__domandeDelloStorico.filter((e) => e === "binary_sensor.porta_ingresso"),
  );
  expect(domande.length).toBeLessThanOrEqual(1);
});
