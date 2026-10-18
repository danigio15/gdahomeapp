/* «Ultime 24 ore» (#269): si tocca la carta di una porta nei Varchi, o di un
 * rilevatore nella Presenza, e si apre il foglio con com'e' adesso, i conti
 * del giorno, la striscia delle 24 ore e l'elenco delle ultime volte.
 *
 * Lo storico arriva dal Recorder per la strada di sempre — il broker del
 * socket — e qui il broker e' finto: risponde con una giornata scritta a mano.
 * L'orologio della pagina e' fermo alle 18:30, cosi' i conti sono quelli.
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
  visibility: { home: true, varchi: true, presenza: true },
};

/* Oggi alle 18:30, nell'ora della macchina che fa girare la prova: il
 * browser sta nello stesso fuso. */
const ADESSO = new Date(2026, 9, 14, 18, 30, 0);

/* Minuti dalla mezzanotte di oggi: negativi sono ieri sera. */
const PORTA = {
  aperture: [
    [-295, -294],
    [-140, -139],
    [462, 465],
    [490, 491],
    [775, 778],
    [800, 801],
    [1022, 1029],
    [1096, 1098],
  ],
  muto: [[190, 204]],
};
const MOVIMENTI = [
  [-310, 1],
  [-282, 2],
  [-230, 1],
  [-166, 1],
  [-89, 2],
  [412, 2],
  [418, 1],
  [425, 1],
  [440, 1],
  [451, 1],
  [465, 1],
  [570, 2],
  [662, 1],
  [760, 1],
  [890, 3],
  [1050, 1],
  [1061, 2],
  [1078, 1],
  [1092, 2],
  [1100, 2],
  [1108, 1],
];

const STATI = (adesso) => {
  const mezzanotte = new Date(adesso);
  mezzanotte.setHours(0, 0, 0, 0);
  const alle = (minuti) => new Date(mezzanotte.getTime() + minuti * 60_000).toISOString();
  return {
    "binary_sensor.porta_ingresso": {
      entity_id: "binary_sensor.porta_ingresso",
      state: "off",
      last_changed: alle(1098),
      attributes: { friendly_name: "Ingresso", device_class: "door" },
    },
    "binary_sensor.corridoio": {
      entity_id: "binary_sensor.corridoio",
      state: "off",
      last_changed: alle(1109),
      attributes: { friendly_name: "Corridoio", device_class: "motion" },
    },
  };
};

async function avvia(page, testInfo, { rompi = false } = {}) {
  test.setTimeout(150_000);
  await page.clock.setFixedTime(ADESSO);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript(
    ({ porta, movimenti, rompi: guasto }) => {
      const mezzanotte = new Date(Date.now());
      mezzanotte.setHours(0, 0, 0, 0);
      const s = (minuti) => (mezzanotte.getTime() + minuti * 60_000) / 1000;
      const inizio = (Date.now() - 86_400_000) / 1000;
      const storia = {
        "binary_sensor.porta_ingresso": [
          { s: "off", lu: inizio },
          ...porta.aperture.flatMap(([da, a]) => [
            { s: "on", lu: s(da) },
            { s: "off", lu: s(a) },
          ]),
          ...porta.muto.flatMap(([da, a]) => [
            { s: "unavailable", lu: s(da) },
            { s: "off", lu: s(a) },
          ]),
        ].sort((x, y) => x.lu - y.lu),
        "binary_sensor.corridoio": [
          { s: "off", lu: inizio },
          ...movimenti.flatMap(([da, durata]) => [
            { s: "on", lu: s(da) },
            { s: "off", lu: s(da + durata) },
          ]),
        ],
      };
      window.__domandeDelloStorico = [];
      const broker = {
        request: async (messaggio) => {
          if (messaggio?.type !== "history/history_during_period") return null;
          const entita = messaggio.entity_ids?.[0];
          window.__domandeDelloStorico.push(entita);
          if (guasto) throw new Error("recorder spento");
          const da = Date.parse(messaggio.start_time) / 1000;
          const a = Date.parse(messaggio.end_time) / 1000;
          const righe = (storia[entita] || []).filter((riga) => riga.lu <= a);
          const prima = righe.filter((riga) => riga.lu <= da).pop();
          return {
            [entita]: [
              ...(prima ? [{ ...prima, lu: da }] : []),
              ...righe.filter((riga) => riga.lu > da),
            ],
          };
        },
      };
      let vero = null;
      Object.defineProperty(window, "DashboardModernEnergyService", {
        configurable: true,
        get: () => ({ ...(vero || {}), broker }),
        set: (valore) => {
          vero = valore;
        },
      });
    },
    { porta: PORTA, movimenti: MOVIMENTI, rompi },
  );
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate((stati) => {
    window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...stati } };
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, stati);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    window.renderHomeWidgets?.();
  }, STATI(ADESSO.getTime()));
}

async function apriLaPagina(page, voce) {
  const tasto = page.locator(`.tab[data-tab="${voce}"]`);
  await expect(tasto).toBeAttached({ timeout: 20_000 });
  /* Sul telefono la barra puo' essere scivolata via: si apre la pagina col
   * suo stesso tasto, senza doverlo vedere. */
  await tasto.evaluate((nodo) => nodo.click());
  await expect(page.locator(`#page-${voce}`)).toHaveClass(/active/);
}

test("la porta dei Varchi apre le sue ultime 24 ore", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  await apriLaPagina(page, "varchi");

  const carta = page.locator(
    '#page-varchi .dm-varco[data-dm-ultime="binary_sensor.porta_ingresso"]',
  );
  await expect(carta).toBeVisible({ timeout: 20_000 });
  await expect(carta).toHaveAttribute("role", "button");
  await carta.click();

  const foglio = page.locator("#dm-ultime .dm-ur-foglio");
  await expect(foglio).toBeVisible({ timeout: 20_000 });
  await expect(foglio).toHaveAttribute("role", "dialog");
  await expect(foglio).toHaveAttribute("aria-modal", "true");
  await expect(foglio.locator("h2")).toHaveText("Ingresso");
  /* Subito com'e' adesso; i conti quando arriva lo storico. */
  await expect(foglio.locator(".dm-ur-grande b")).toHaveText("Chiusa");
  await expect(foglio.locator(".dm-ur-grande span")).toHaveText("da 12 min");
  await expect(foglio.locator(".dm-ur-adesso p")).toContainText("Ultima chiusura oggi alle 18:18");
  await expect(foglio.locator(".dm-ur-adesso p")).toContainText("dopo 2 min aperta");

  const caselle = foglio.locator(".dm-ur-casella b");
  await expect(caselle.nth(0)).toHaveText("6 volte");
  await expect(foglio.locator(".dm-ur-casella span").nth(0)).toHaveText("2 ieri sera");
  await expect(caselle.nth(1)).toHaveText("17 min");
  await expect(caselle.nth(2)).toHaveText("7 min");
  await expect(foglio.locator(".dm-ur-casella span").nth(2)).toHaveText("alle 17:02");

  /* La striscia: otto tacche alte, e il quarto d'ora muto della notte. */
  await expect(foglio.locator("svg .dm-ur-aperta")).toHaveCount(8);
  await expect(foglio.locator(".dm-ur-legenda")).toContainText("Non rispondeva (03:10–03:24)");

  /* L'elenco, dalla piu' recente, diviso fra oggi e ieri sera. */
  const righe = foglio.locator(".dm-ur-riga");
  await expect(righe).toHaveCount(8);
  await expect(righe.first()).toContainText("18:16");
  await expect(righe.first()).toContainText("Aperta · per 2 min");
  await expect(righe.first()).toContainText("chiusa alle 18:18");
  await expect(foglio.locator(".dm-ur-gruppo")).toHaveText(["Oggi", "Ieri sera"]);
  await expect(foglio.locator("[data-ur-storico]")).toBeVisible();
  /* Fuori da Home Assistant il tasto della sua scheda non c'e': non farebbe
   * niente. */
  await expect(foglio.locator("[data-ur-ha]")).toHaveCount(0);
  await expect(foglio.locator(".dm-ur-nota")).toHaveText(
    "Dal Recorder di Home Assistant di casa · niente esce dalla rete",
  );

  /* Ieri, da mezzanotte a mezzanotte: un'altra domanda al Recorder. */
  await foglio.locator('[data-ur-modo="ieri"]').click();
  await expect(foglio.locator('[data-ur-modo="ieri"]')).toHaveAttribute("aria-pressed", "true");
  await expect(foglio.locator(".dm-ur-titoletto").first()).toHaveText("Aperta e chiusa ieri");
  await expect(caselle.nth(0)).toHaveText("2 volte");

  /* Esc chiude, e il fuoco torna alla carta. */
  await page.keyboard.press("Escape");
  await expect(page.locator("#dm-ultime")).toBeHidden();
  await expect(carta).toBeFocused();
});

test("il rilevatore della Presenza apre le sue ultime 24 ore", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  await apriLaPagina(page, "presenza");

  const carta = page.locator(
    '#page-presenza .dm-presenza[data-dm-ultime="binary_sensor.corridoio"]',
  );
  await expect(carta).toBeVisible({ timeout: 20_000 });
  /* Anche da tastiera. */
  await carta.focus();
  await page.keyboard.press("Enter");

  const foglio = page.locator("#dm-ultime .dm-ur-foglio");
  await expect(foglio).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("#dm-ultime")).toHaveAttribute("data-famiglia", "movimento");
  await expect(foglio.locator("h2")).toHaveText("Corridoio");
  await expect(foglio.locator(".dm-ur-grande b")).toHaveText("Fermo");
  await expect(foglio.locator(".dm-ur-adesso p")).toContainText("Ultimo movimento 2 min fa");

  const caselle = foglio.locator(".dm-ur-casella b");
  await expect(caselle.nth(0)).toHaveText("16");
  await expect(caselle.nth(1)).toHaveText("06:52");
  await expect(caselle.nth(2)).toHaveText("07–08");
  await expect(foglio.locator(".dm-ur-casella span").nth(2)).toHaveText("4 in un'ora");

  await expect(foglio.locator("svg .dm-ur-impulso")).toHaveCount(21);
  await expect(foglio.locator("svg .dm-ur-quiete")).toContainText("quiete");
  await expect(foglio.locator("svg .dm-ur-barra").first()).toBeAttached();

  /* Sette righe, poi «Mostra tutti». */
  await expect(foglio.locator(".dm-ur-riga")).toHaveCount(7);
  await expect(foglio.locator(".dm-ur-riga").first()).toContainText("poi libero");
  await foglio.locator("[data-ur-tutti]").click();
  await expect(foglio.locator(".dm-ur-riga")).toHaveCount(21);

  /* La crocetta chiude. */
  await foglio.locator(".dm-ur-x").click();
  await expect(page.locator("#dm-ultime")).toBeHidden();
});

test("se il Recorder non risponde lo dice, e si puo' riprovare", async ({ page }, testInfo) => {
  await avvia(page, testInfo, { rompi: true });
  await apriLaPagina(page, "varchi");
  await page
    .locator('#page-varchi .dm-varco[data-dm-ultime="binary_sensor.porta_ingresso"]')
    .click();
  const foglio = page.locator("#dm-ultime .dm-ur-foglio");
  /* Lo stato di adesso c'e' lo stesso: non dipende dallo storico. */
  await expect(foglio.locator(".dm-ur-grande b")).toHaveText("Chiusa");
  await expect(foglio.locator('[data-ur-esito="errore"]')).toBeVisible();
  const prima = await page.evaluate(() => window.__domandeDelloStorico.length);
  await foglio.locator("[data-ur-riprova]").click();
  await expect
    .poll(() => page.evaluate(() => window.__domandeDelloStorico.length))
    .toBeGreaterThan(prima);
});
