/* Le modalità di ricarica, dopo che evcc le ha rifatte.
 *
 * «Ha cambiato la funzionalità sulle modalità di ricarica: ora si chiama
 * intelligente e poi ha messo always.»
 *
 * `pv` è diventato `smart` e `minpv` è sparito (evcc-io/evcc#32490). Il guscio
 * accendeva il tasto cercando `m-btn-<stato>`: da quel giorno `m-btn-smart` non
 * esisteva e non si accendeva più niente — mentre il comando partiva lo stesso,
 * perché evcc accetta ancora `pv` come scrittura deprecata. Un tasto che fa
 * quello che deve e sembra rotto.
 *
 * Qui si guarda quello che vede chi apre la pagina dell'auto: quanti tasti ci
 * sono, come si chiamano, quale è acceso, e cosa parte premendone uno.
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
    ev: [{ id: "ev-uno", name: "La macchina", brand: "Leapmotor", icon: "mdi:car-electric" }],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, energy: true, ev: true },
};

/** Avvia la plancia con un evcc che dichiara `options` e risponde `stato`. */
async function conEvcc(page, testInfo, { stato, options }) {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate(
    ({ stato, options }) => {
      const stati = {
        "number.target": { state: "80", attributes: {} },
        "select.modo": { state: stato, attributes: options ? { options } : {} },
      };
      const mappa = {
        "dm.ev_target_soc": "number.target",
        "dm.ev_modalita_ricarica_evcc": "select.modo",
      };
      const precedente = window.resolveEntity;
      window.resolveEntity = (riferimento) =>
        mappa[riferimento] || precedente?.(riferimento) || riferimento;
      window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...stati } };
      const raw = window.eval("typeof STATES !== 'undefined' ? STATES : null");
      if (raw) Object.assign(raw, stati);
      /* Quello che parte premendo si raccoglie invece di volare via: non c'è
       * nessuna wallbox dall'altra parte, e quello che si deve provare è COSA
       * si manda. */
      window.__MANDATO__ = [];
      /* `ws` nel guscio e' un `let` di livello globale: non sta su `window`, e
       * assegnarlo da li' non lo tocca. Si passa da un eval globale, che e'
       * l'unico posto da cui quel binding si vede. */
      window.eval(
        "ws = { readyState: 1, send: function(t){ try { window.__MANDATO__.push(JSON.parse(t)); } catch(e){} } };",
      );
      document.querySelectorAll(".page").forEach((n) => n.classList.remove("active"));
      document.getElementById("page-ev")?.classList.add("active");
      window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
    },
    { stato, options },
  );
  return page.locator(".lm-evcc-grid");
}

const nomi = (griglia) => griglia.locator(".lm-evcc-btn .ev-lbl").allTextContents();

test("un evcc di oggi: tre tasti, e «Intelligente» al posto di Solar", async ({
  page,
}, testInfo) => {
  const griglia = await conEvcc(page, testInfo, {
    stato: "smart",
    options: ["off", "smart", "now"],
  });
  await expect(griglia.locator(".lm-evcc-btn")).toHaveCount(3);
  expect(await nomi(griglia)).toEqual(["Spento", "Intelligente", "Subito"]);
  /* Il difetto da cui si è partiti: questo tasto restava spento. */
  await expect(griglia.locator("#m-btn-smart")).toHaveClass(/active/);
  await expect(griglia.locator("#m-btn-minpv")).toHaveCount(0);
});

test("un evcc di ieri resta com'era, con i suoi quattro", async ({ page }, testInfo) => {
  /* Chi non ha aggiornato evcc non deve vedersi cambiare niente. */
  const griglia = await conEvcc(page, testInfo, {
    stato: "minpv",
    options: ["off", "pv", "minpv", "now"],
  });
  await expect(griglia.locator(".lm-evcc-btn")).toHaveCount(4);
  expect(await nomi(griglia)).toEqual(["Spento", "Solar", "Min+Sol", "Subito"]);
  await expect(griglia.locator("#m-btn-minpv")).toHaveClass(/active/);
});

test("e chi le options non le dichiara si tiene i quattro di sempre", async ({
  page,
}, testInfo) => {
  const griglia = await conEvcc(page, testInfo, { stato: "smart", options: null });
  await expect(griglia.locator(".lm-evcc-btn")).toHaveCount(4);
  /* Tasti vecchi, evcc nuovo: senza l'equivalenza `pv` ≡ `smart` resterebbe
   * spento tutto, che è esattamente il difetto. */
  await expect(griglia.locator("#m-btn-pv")).toHaveClass(/active/);
});

test("premendo un tasto parte il nome che evcc ha dichiarato", async ({ page }, testInfo) => {
  const griglia = await conEvcc(page, testInfo, {
    stato: "off",
    options: ["off", "smart", "now"],
  });
  await griglia.locator("#m-btn-smart").click();
  await expect
    .poll(() => page.evaluate(() => window.__MANDATO__.at(-1)), { timeout: 10_000 })
    .toMatchObject({
      type: "call_service",
      domain: "select",
      service: "select_option",
      service_data: { entity_id: "select.modo", option: "smart" },
    });
});

test("una modalità che non conosciamo si vede lo stesso, col nome che ha", async ({
  page,
}, testInfo) => {
  /* evcc i nomi li ha già cambiati una volta. Nasconderne una vorrebbe dire una
   * modalità che evcc offre e che da qui non si può scegliere da nessuna parte. */
  const griglia = await conEvcc(page, testInfo, {
    stato: "turbo",
    options: ["off", "smart", "turbo"],
  });
  await expect(griglia.locator(".lm-evcc-btn")).toHaveCount(3);
  expect(await nomi(griglia)).toEqual(["Spento", "Intelligente", "turbo"]);
  await expect(griglia.locator("#m-btn-turbo")).toHaveClass(/active/);
});
