/* «Vorrei che sia possibile creare entità personalizzata di tipo switch»
 * (#406).
 *
 * Il giro intero, come lo fa una persona: dalla scheda «Le tue entità» si
 * aggiunge un interruttore, gli si scrive cosa fare all'accensione e allo
 * spegnimento e da dove leggere lo stato, lo si mette in una scheda; poi in
 * quella scheda lo si accende e lo si spegne. Il verdetto sono i servizi
 * chiamati — quelli scritti nella voce, non il `toggle` dell'entità che dice
 * lo stato — e la levetta, che segue lo stato letto.
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
  },
};

const FOTO = process.env.DM_FOTO_406 || "";

function cambiaStato(page, entity, stato) {
  return page.evaluate(
    ([id, valore]) => {
      const grezzi = eval("_RAW_STATES");
      grezzi[id] = { entity_id: id, state: valore, attributes: { friendly_name: id } };
      window.applyStates?.();
      window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
    },
    [entity, stato],
  );
}

test("un interruttore fatto a mano si crea, si mette in una scheda, si accende e si spegne", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.route("https://**", (r) => r.fulfill({ status: 200, body: "" }));

  await page.addInitScript(() => {
    window.__SERVIZI__ = [];
    class PonteFinto extends EventTarget {
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
      send(grezzo) {
        const messaggio = JSON.parse(grezzo);
        if (messaggio.type === "auth") return;
        if (messaggio.type === "call_service")
          window.__SERVIZI__.push({
            servizio: `${messaggio.domain}.${messaggio.service}`,
            dati: messaggio.service_data || {},
          });
        queueMicrotask(() =>
          this.onmessage?.({
            data: JSON.stringify({
              id: messaggio.id,
              type: "result",
              success: true,
              result: messaggio.type === "get_states" ? [] : null,
            }),
          }),
        );
      }
      close() {
        this.readyState = 3;
        this.onclose?.({});
      }
    }
    window.__DASHBOARDMODERN_BRIDGE_WS__ = PonteFinto;
    window.WebSocket = PonteFinto;
  });

  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((n) => n.forEach((x) => x.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_SECTION_RUNTIME__?.installed, null, {
    timeout: 60_000,
  });
  await cambiaStato(page, "input_boolean.pompa", "off");

  /* ── la scheda ────────────────────────────────────────────────────── */
  await page.evaluate(() => window.apriConfigEntita());
  await page.locator('.ed-tab[data-tab="entita"]').click();
  await page.locator('[data-mia-ent-add="interruttore"]').click();

  const riga = page.locator("[data-mia-ent]").last();
  await expect(riga.locator('[data-mia-ent-campo="tipo"]')).toHaveValue("interruttore");
  await riga.locator('[data-mia-ent-campo="sezione"]').selectOption("home");
  /* I campi entità sono pastiglie: l'id scritto a mano sta dietro la
   * matita, come in tutte le schede. */
  const scrivi = async (campo, valore) => {
    const casella = riga.locator(`[data-mia-ent-campo="${campo}"]`);
    if (!(await casella.isVisible()))
      await casella.locator("xpath=ancestor::label[1]").locator(".dm-chip-manual").first().click();
    await casella.fill(valore);
  };
  await scrivi("nome", "Pompa giardino");
  await scrivi("icona", "💧");
  await scrivi("accendi_servizio", "script.turn_on");
  await scrivi("accendi_entity", "script.pompa_accendi");
  await scrivi("accendi_dati", '{"variables": {"minuti": 20}}');
  await scrivi("spegni_servizio", "script.turn_on");
  await scrivi("spegni_entity", "script.pompa_spegni");
  await scrivi("entity", "input_boolean.pompa");
  await scrivi("acceso_se", "on");

  if (FOTO) {
    /* La foto per chi legge l'issue: alta abbastanza da tenere tutta la riga. */
    await page.setViewportSize({ width: 900, height: 2600 });
    await riga.screenshot({ path: `${FOTO}/editor.png` });
  }

  /* Un servizio che la plancia non chiama non si salva: si dice subito. */
  await scrivi("spegni_servizio", "shell_command.cancella");
  await page.locator("#ed-body [data-dm-save-all]").click();
  await expect(page.locator("#ed-toast")).toContainText("non lo chiama");
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("cd_entita_mie") || "[]").at(-1)?.spegni_servizio,
    ),
  ).toBe("");
  await scrivi("spegni_servizio", "script.turn_on");

  await page.locator("#ed-body [data-dm-save-all]").click();

  const scritta = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("cd_entita_mie")).at(-1),
  );
  expect(scritta).toMatchObject({
    tipo: "interruttore",
    nome: "Pompa giardino",
    sezione: "home",
    entity: "input_boolean.pompa",
    accendi_servizio: "script.turn_on",
    accendi_entity: "script.pompa_accendi",
    spegni_entity: "script.pompa_spegni",
  });

  /* ── la scheda della plancia ──────────────────────────────────────── */
  await page.evaluate(() => {
    document.getElementById("editor-modal")?.remove();
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  });
  await page.locator('.tab[data-tab="home"]').first().click();
  const voce = page.locator('#page-home [data-dm-mie-tipo="interruttore"]');
  await voce.waitFor({ state: "visible", timeout: 20_000 });
  await expect(voce).toContainText("Pompa giardino");
  await expect(voce).toContainText("Spento");
  const leva = voce.locator("[data-dm-mie-int]");
  await expect(leva).toHaveAttribute("aria-checked", "false");

  await leva.click();
  await expect
    .poll(() => page.evaluate(() => window.__SERVIZI__.at(-1)), { timeout: 15_000 })
    .toEqual({
      servizio: "script.turn_on",
      dati: { variables: { minuti: 20 }, entity_id: "script.pompa_accendi" },
    });

  /* Home Assistant dice «acceso»: la levetta lo segue. */
  await cambiaStato(page, "input_boolean.pompa", "on");
  await expect(voce).toContainText("Acceso");
  await expect(leva).toHaveAttribute("aria-checked", "true");
  if (FOTO) {
    await voce.scrollIntoViewIfNeeded();
    await page.locator("#page-home .dm-mie-ent").screenshot({ path: `${FOTO}/sezione.png` });
  }

  await page.locator('#page-home [data-dm-mie-tipo="interruttore"] [data-dm-mie-int]').click();
  await expect
    .poll(() => page.evaluate(() => window.__SERVIZI__.at(-1)), { timeout: 15_000 })
    .toEqual({ servizio: "script.turn_on", dati: { entity_id: "script.pompa_spegni" } });

  /* Mai il `toggle` dell'entità che dice lo stato. */
  const chiamati = await page.evaluate(() => window.__SERVIZI__.map((uno) => uno.servizio));
  expect(chiamati).not.toContain("input_boolean.toggle");
  expect(await page.evaluate(() => document.querySelector(".page.active")?.id)).toBe("page-home");
});
