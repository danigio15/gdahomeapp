/* «In alcune voci non ci sono più o vanno e vengono» (#561).
 *
 * Il guscio ripassa la barra ogni tre secondi e a ogni giro la plancia ci
 * rimette i disegni di casa. Per non rifare il lavoro a vuoto, chi dipinge si
 * segnava sulla casella quale disegno ci aveva messo e al giro dopo saltava —
 * ma il segno sta sulla casella e il disegno sta dentro. Svuotato il dentro, il
 * segno restava, il ridisegno si dichiarava a posto, e l'icona non tornava
 * più: tornava soltanto quando la voce intera veniva rifatta da capo, che è la
 * parte che «va e viene».
 *
 * Qui si svuota una casella e si guarda se il disegno torna da solo. Prima
 * della correzione, dopo sette secondi e due passate del guscio, non tornava.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const seed = {
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
  visibility: { home: true, energy: true, security: true, config: true },
};

async function boot(page, testInfo) {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript(() => {
    class MockBridgeSocket extends EventTarget {
      static OPEN = 1;
      readyState = 1;
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
        queueMicrotask(() =>
          this.onmessage?.({
            data: JSON.stringify({
              id: message.id,
              type: "result",
              success: true,
              result: message.type === "get_states" ? [] : null,
            }),
          }),
        );
      }
      close() {}
    }
    window.__DASHBOARDMODERN_HOSTED__ = true;
    window.__DASHBOARDMODERN_BRIDGE_WS__ = MockBridgeSocket;
    window.WebSocket = MockBridgeSocket;
  });
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
}

const disegnoDi = (page, voce) =>
  page.evaluate((tab) => {
    const casella = document.querySelector(`nav.tabs .tab[data-tab="${tab}"] > .icon`);
    return {
      nostro: casella?.firstElementChild?.classList?.contains("dm-oggetto") === true,
      segno: casella?.dataset?.dmOggetto || "",
    };
  }, voce);

test("l'icona svuotata torna al giro dopo, senza rifare la voce", async ({ page }, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  await boot(page, testInfo);

  /* Il disegno di casa c'è: è il punto di partenza. */
  await expect.poll(() => disegnoDi(page, "energy")).toEqual({ nostro: true, segno: "energia" });

  /* Qualcuno svuota la casella e lascia in piedi il segno. Non importa chi: è
   * la condizione in cui la barra si trovava, e da cui non usciva più.
   *
   * Si svuota e si rilegge nello stesso giro, senza tornare di qua: fra le due
   * cose la barra fa in tempo a ripassare, ed è proprio quello che deve fare.
   * Guardare da fuori vorrebbe dire una prova che cade quando la correzione
   * funziona in fretta. */
  const svuotata = await page.evaluate(() => {
    const casella = document.querySelector('nav.tabs .tab[data-tab="energy"] > .icon');
    casella.innerHTML = "⚡";
    return {
      nostro: casella.firstElementChild?.classList?.contains("dm-oggetto") === true,
      segno: casella.dataset.dmOggetto || "",
    };
  });
  expect(svuotata).toEqual({ nostro: false, segno: "energia" });

  /* E se lo ritrova SUBITO — nel fotogramma dopo, non al prossimo avvenimento
   * fortunato.
   *
   * Il tetto stretto e' il punto della prova. Agganciarsi alle funzioni del
   * guscio non basta: misurato sulla plancia vera, in dieci secondi il giro di
   * visibilita' passa dalla plancia una volta e `render` nessuna, perche' il
   * guscio quelle funzioni le richiama per nome dal proprio ambiente. Con un
   * tetto largo questa prova passerebbe ogni tanto, quando capita qualcosa —
   * ed e' proprio «ogni tanto» il difetto da non lasciarsi dietro. */
  await expect
    .poll(() => disegnoDi(page, "energy"), { timeout: 2000 })
    .toEqual({ nostro: true, segno: "energia" });
});

test("e a barra ferma non si muove piu' niente: il sorvegliante non si rincorre", async ({
  page,
}, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  await boot(page, testInfo);
  await expect.poll(() => disegnoDi(page, "energy")).toEqual({ nostro: true, segno: "energia" });

  /* Chi ridipinge e' svegliato dai cambiamenti della barra, e ridipingendo la
   * cambia: se non si fermasse da solo sarebbe un giro infinito — il difetto
   * peggiore dei due, perche' non si vede e si sente solo sul termometro.
   *
   * Si ferma perche' `disegniNellaBarra` non scrive niente quando e' tutto a
   * posto: la passata nata dalle nostre scritture non ne genera una terza. */
  await page.evaluate(() => {
    window.__dmMosse = 0;
    new MutationObserver((righe) => {
      window.__dmMosse += righe.length;
    }).observe(document.querySelector("nav.tabs"), { childList: true, subtree: true });
  });
  await page.waitForTimeout(6000);
  expect(await page.evaluate(() => window.__dmMosse)).toBe(0);
});
