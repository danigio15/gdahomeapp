/* Una voce che entra deve poter uscire.
 *
 * L'elenco degli avvisi lo stampa il runtime da una mappa di gruppi scritta a
 * mano che si ferma ai suoi cinque: un allagamento salvato contava nel quadro e
 * si apriva nel popup, ma dalla configurazione spariva — non si poteva piu'
 * rinominare, e soprattutto non si poteva piu' togliere.
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
  visibility: { home: true },
};

const STATI = {
  "binary_sensor.perdita_lavanderia": {
    entity_id: "binary_sensor.perdita_lavanderia",
    state: "on",
    attributes: { device_class: "moisture", friendly_name: "Perdita lavanderia" },
  },
  "binary_sensor.perdita_caldaia": {
    entity_id: "binary_sensor.perdita_caldaia",
    state: "off",
    attributes: { device_class: "moisture", friendly_name: "Locale caldaia" },
  },
};

async function apriAvvisi(page) {
  await page.evaluate(() => {
    globalThis.apriConfigEntita?.();
    globalThis.editorSwitch?.("avvisi");
  });
}

test("l'allagamento si vede in configurazione e si puo' togliere", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate((valori) => {
    window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...valori } };
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, valori);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, STATI);

  await apriAvvisi(page);

  // La fisarmonica degli allagamenti c'e', con dentro i due sensori rilevati.
  const acc = page.locator("[data-dm-flood-acc]");
  await expect(acc).toHaveCount(1, { timeout: 20_000 });
  await expect(acc.locator("[data-dm-flood-row]")).toHaveCount(2);
  await expect(acc).toContainText("Perdita lavanderia");
  await expect(acc).toContainText("Locale caldaia");

  // Il gruppo si sceglie anche quando se ne aggiunge uno a mano.
  await expect(page.locator('#ed-avv-grp option[value="allag"]')).toHaveCount(1);

  // Il cestino toglie davvero, e quello che si toglie resta tolto. La
  // fisarmonica nasce chiusa come tutte le altre: prima si apre.
  await acc.locator("summary").click();
  await acc.locator('[data-dm-flood-del="binary_sensor.perdita_caldaia"]').click();
  await apriAvvisi(page);
  await expect(page.locator("[data-dm-flood-row]")).toHaveCount(1, { timeout: 20_000 });
  await expect(page.locator("[data-dm-flood-acc]")).not.toContainText("Locale caldaia");

  // E resta tolto anche ricaricando: non torna al giro dopo.
  await page.reload();
  await page.evaluate((valori) => {
    window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...valori } };
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, valori);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, STATI);
  await apriAvvisi(page);
  await expect(page.locator("[data-dm-flood-row]")).toHaveCount(1, { timeout: 20_000 });
});

/* Una voce che in quella lista non ci dovrebbe stare si vede.
 *
 * Dal campo, con lo scatto del popup: «continua ad uscire questo allarme
 * bagnato ma non c'è nessuna entità allarme, sono 5 i sensori configurati,
 * questo 6 non esiste». Il sesto stava nella lista degli Allagamenti — ce
 * l'aveva messo la scheda degli avvisi, col nome scritto a mano — ma non era
 * una sonda: la tessera lo leggeva come legge tutti, acceso vuol dire bagnato,
 * e diceva «Bagnato» di una cosa che l'acqua non la misura.
 *
 * Toglierla d'ufficio sarebbe peggio — c'è chi mette lì un sensore fatto in
 * casa che la classe non la dichiara — quindi si fa vedere, nella scheda che
 * si compila, accanto al cestino che la toglie.
 */
test("nella scheda si vede quale voce non è un sensore di allagamento", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate((valori) => {
    /* Una sonda vera, un avviso che sonda non è, e uno rimasto in lista dopo
     * che il dispositivo è stato tolto da Home Assistant. */
    localStorage.setItem(
      "cd_gruppi_extra",
      JSON.stringify({
        allag: [
          "binary_sensor.perdita_lavanderia",
          "binary_sensor.allarme_casa",
          "binary_sensor.sonda_sparita",
        ],
      }),
    );
    localStorage.setItem("cd_allag_rilevato", "true");
    localStorage.setItem(
      "cd_avvisi_names_extra",
      JSON.stringify({ "binary_sensor.allarme_casa": "allarme" }),
    );
    const altri = {
      ...valori,
      "binary_sensor.allarme_casa": {
        entity_id: "binary_sensor.allarme_casa",
        state: "on",
        attributes: { friendly_name: "Allarme casa", device_class: "safety" },
      },
    };
    window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...altri } };
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, altri);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, STATI);

  await apriAvvisi(page);
  const acc = page.locator("[data-dm-flood-acc]");
  await expect(acc).toHaveCount(1, { timeout: 20_000 });
  await expect(acc.locator("[data-dm-flood-row]")).toHaveCount(3);

  const laSonda = acc.locator('[data-dm-flood-row="binary_sensor.perdita_lavanderia"]');
  const lAvviso = acc.locator('[data-dm-flood-row="binary_sensor.allarme_casa"]');
  const laSparita = acc.locator('[data-dm-flood-row="binary_sensor.sonda_sparita"]');

  /* La sonda vera non porta nessun avvertimento: se lo portasse, quello sotto
   * non vorrebbe dire più niente. */
  await expect(laSonda.locator("[data-dm-flood-dubbia]")).toHaveCount(0);
  /* Le altre due sì, e dicono due cose diverse. */
  await expect(lAvviso.locator("[data-dm-flood-dubbia]")).toContainText(
    "non è un sensore di allagamento",
  );
  await expect(laSparita.locator("[data-dm-flood-dubbia]")).toContainText(
    "in Home Assistant non c'è",
  );
  /* E il nome scritto a mano resta quello che si legge, minuscolo com'è stato
   * battuto: è da lì che veniva l'«allarme» dello scatto. */
  await expect(lAvviso).toContainText("allarme");
});
