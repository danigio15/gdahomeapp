/* La finestra di una tessera ci sta dentro la sua card.
 *
 * Dal campo, con lo scatto: «Aggiusta i margini del popup allagamenti non
 * entra all'interno tutto». Nella finestra degli Allagamenti «Asciutto»
 * finiva oltre il bordo destro della card, l'ultima pastiglia era tagliata a
 * meta' e il titoletto «LO STATO» spariva a sinistra appena si sfiorava
 * l'elenco. Non era solo degli allagamenti: sul telefono sbordavano anche il
 * fumo e le tapparelle, e tutte e sei le finestre avevano dieci pixel di
 * margine invece dei quindici che il loro foglio dichiara.
 *
 * Erano due cose sole, e tutte e due si vedono solo misurando:
 *
 *  - il corpo della finestra e' una griglia senza colonne dichiarate, e una
 *    colonna «auto» e' larga almeno quanto il suo contenuto piu' largo: una
 *    riga con un nome di quaranta lettere chiedeva quattrocentoquaranta pixel
 *    in una finestra che ne ha trecentotrenta, e li otteneva;
 *
 *  - la regola della tessera aperta DENTRO la griglia della Home parlava anche
 *    alla finestra, e stando in fondo al foglio vinceva a parita' di peso su
 *    quella della finestra scritta piu' su: da li' i dieci pixel.
 *
 * Questa prova non guarda una schermata: misura. Per ogni tessera apre la
 * finestra e chiede se qualcosa sta fuori dal bordo — che e' esattamente la
 * domanda della segnalazione, e l'unica che una regressione non puo' aggirare.
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
    /* Una luce qualunque: garantisce che la striscia delle tessere esista. */
    lights: [
      { entity: "light.salotto", name: "Salotto" },
      { entity: "light.cucina", name: "Lampadario cucina grande" },
    ],
    climate: [],
    ev: [],
    covers: [{ entity: "cover.tapparella_camera", name: "Tapparella camera da letto" }],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true },
};

/* I nomi sono quelli veri della casa che ha segnalato: lunghi, e tutti che
 * cominciano allo stesso modo. Un nome corto non avrebbe mai fatto sbordare
 * niente, e la prova sarebbe stata verde su un difetto vivo. */
const ALLAGAMENTI = [
  ["binary_sensor.sensore_acqua_zanzare", "Sensore acqua zanzare Umidità"],
  ["binary_sensor.sensore_acqua_lavello_dependance", "Sensore acqua lavello dependance Umidità"],
  ["binary_sensor.sensore_perdita_acqua_lavatrice", "Sensore perdita acqua lavatrice Umidità"],
  [
    "binary_sensor.sensore_perdita_acqua_lavello_casa",
    "Sensore perdita acqua lavello casa Umidità",
  ],
  ["binary_sensor.perdita_piscina", "Perdita Piscina Umidità"],
];

const ALTRI = {
  "light.salotto": { state: "on", attributes: { friendly_name: "Salotto" } },
  "light.cucina": { state: "off", attributes: { friendly_name: "Lampadario cucina grande" } },
  "cover.tapparella_camera": {
    state: "open",
    attributes: {
      friendly_name: "Tapparella camera da letto",
      current_position: 60,
      device_class: "shutter",
    },
  },
  "binary_sensor.fumo_cucina": {
    state: "off",
    attributes: { friendly_name: "Rilevatore di fumo della cucina", device_class: "smoke" },
  },
  "sensor.batteria_telecomando": {
    state: "42",
    attributes: {
      friendly_name: "Batteria del telecomando del salotto",
      device_class: "battery",
      unit_of_measurement: "%",
    },
  },
};

test("nessuna finestra di tessera sborda dalla sua card", async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true, null, {
    timeout: 60000,
  });
  await page.evaluate(
    ({ allagamenti, altri }) => {
      localStorage.setItem(
        "cd_gruppi_extra",
        JSON.stringify({ allag: allagamenti.map(([id]) => id) }),
      );
      const stati = eval("_RAW_STATES");
      for (const [id, nome] of allagamenti)
        stati[id] = {
          entity_id: id,
          state: "off",
          attributes: { friendly_name: nome, device_class: "moisture" },
        };
      for (const [id, corpo] of Object.entries(altri))
        stati[id] = { entity_id: id, state: corpo.state, attributes: corpo.attributes };
      window.applyStates?.();
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    },
    { allagamenti: ALLAGAMENTI, altri: ALTRI },
  );
  await page.waitForTimeout(1500);

  const chiavi = await page.$$eval("#dm-widgets [data-dm-widget]", (nodi) =>
    nodi.map((n) => n.getAttribute("data-dm-widget")),
  );
  /* Se la Home non disegna tessere la prova non sta misurando niente. */
  expect(chiavi).toContain("allagamenti");

  const guai = [];
  for (const chiave of chiavi) {
    await page.click(`#dm-widgets [data-dm-widget="${chiave}"]`);
    await expect(page.locator("#dm-widget-popup .dm-widget-detail")).toBeVisible({ timeout: 8000 });
    await page.waitForTimeout(400);
    const misura = await page.evaluate(() => {
      const corpo = document.querySelector("#dm-widget-popup .dm-w-body");
      const stile = getComputedStyle(corpo);
      const suo = corpo.getBoundingClientRect();
      const destra = suo.right - parseFloat(stile.paddingRight);
      const fuori = [...corpo.querySelectorAll("*")]
        .map((nodo) => ({
          che: `${nodo.tagName.toLowerCase()}.${String(nodo.className).slice(0, 30)}`,
          quadro: nodo.getBoundingClientRect(),
        }))
        /* Un pixel di tolleranza: i bordi arrotondati e le ombre non sono un
         * difetto, e un mezzo pixel di arrotondamento nemmeno. */
        .filter(
          (voce) =>
            voce.quadro.width > 0 &&
            (voce.quadro.right > destra + 1 || voce.quadro.left < suo.left - 1),
        )
        .map(
          (voce) =>
            `${voce.che} [${Math.round(voce.quadro.left)}→${Math.round(voce.quadro.right)}]`,
        );
      /* E i nomi non si tagliano a meta' di una lettera: il nome e' una
       * griglia, e su una griglia i puntini di coda non arrivano mai. */
      const tagliati = [...corpo.querySelectorAll(".dm-w-row .dm-w-name")]
        .filter((nodo) => nodo.scrollWidth > nodo.clientWidth + 1)
        .map((nodo) => nodo.textContent.trim().slice(0, 40));
      return {
        scorre: corpo.scrollWidth,
        largo: corpo.clientWidth,
        margine: parseFloat(stile.paddingLeft),
        fuori: fuori.slice(0, 6),
        tagliati: tagliati.slice(0, 4),
      };
    });
    if (misura.scorre > misura.largo + 1)
      guai.push(`${chiave}: il corpo scorre di traverso (${misura.scorre} in ${misura.largo})`);
    if (misura.fuori.length) guai.push(`${chiave}: fuori dal bordo ${misura.fuori.join(", ")}`);
    if (misura.tagliati.length)
      guai.push(`${chiave}: nomi tagliati ${misura.tagliati.join(" / ")}`);
    /* Il margine della finestra, non quello della tessera in griglia: la
     * regola sbagliata ne metteva dieci, il foglio della finestra ne dichiara
     * quindici sul telefono e diciotto sopra. */
    if (misura.margine < 13) guai.push(`${chiave}: margine di ${misura.margine}px, troppo stretto`);
    await page.click("#dm-widget-popup .dm-w-close");
    await page.waitForTimeout(250);
  }
  expect(guai).toEqual([]);
});
