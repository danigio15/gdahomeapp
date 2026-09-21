/* «Wallbox sta troppo attaccato a casa.»
 *
 * Non era attaccato: era SOPRA. Fra i 769 e gli 820 punti di larghezza la
 * bolla del carico si sovrapponeva al cerchio della Casa di quarantaquattro
 * punti, misurati, con la linea che le univa che spuntava di sotto.
 *
 * Due soglie per una stessa decisione. Il guscio cambia TUTTO a 768 —
 * l'altezza del palco (da 550 a 750), la misura dei cerchi (la Casa da 160 a
 * 125, un carico da 115 a 85), l'altezza della Casa (dal 50% al 46%) e quale
 * dei due disegni si vede — mentre il modulo dei carichi spostava le bolle
 * sulla riga stretta per conto suo a 820. Nella fascia in mezzo la bolla
 * saliva al 68% restando grande dentro un palco rimasto alto 550: la Casa
 * arriva a 360, la bolla comincia a 317.
 *
 * La soglia adesso e' una sola, quella del guscio. E siccome sul largo le
 * bolle stanno tutte su una riga, si e' aggiunta la seconda meta' della stessa
 * domanda: quanto ci sta DAVVERO nella larghezza del palco. Il modello sa
 * quante bolle ci sono e le stringe di conseguenza, ma la larghezza non la
 * sa — e' una domanda al documento, e quel modulo e' puro. Otto bolle da
 * novantadue punti ne chiedono settecentotrentasei, e in settecentoventicinque
 * si toccavano.
 *
 * Questa prova misura il vuoto, invece di guardare uno scatto: fra il bordo di
 * sotto della Casa e quello di sopra della bolla, e fra due bolle di fianco.
 * Sono numeri, e un numero negativo vuol dire sovrapposte.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const stato = (id, valore, unita, nome) => ({
  entity_id: id,
  state: String(valore),
  attributes: { friendly_name: nome, unit_of_measurement: unita },
});

const STATI = {
  "sensor.casa_w": stato("sensor.casa_w", 1331, "W", "Casa"),
  "sensor.carico_w": stato("sensor.carico_w", 300, "W", "Carico"),
};

const NOMI = ["Wallbox", "Boiler", "Clima", "Lavanderia", "Cucina", "Piscina", "Sauna", "Officina"];

const seme = (quanti) => ({
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    lights: [],
    climate: [],
    covers: [],
    ev: [],
    loads: NOMI.slice(0, quanti).map((nome, indice) => ({
      id: `load-${indice}`,
      name: nome,
      icon: "🔌",
      order: indice,
      power_entity: "sensor.carico_w",
    })),
    pool: {},
    irrigation: { zones: [] },
    energy: { house: { power: "sensor.casa_w" } },
    entityOverrides: {},
  },
  visibility: { home: true, energy: true },
});

/** I due vuoti che contano: sotto la Casa, e fra due bolle della stessa fila. */
const iVuoti = (page) =>
  page.evaluate(() => {
    const casa = document.querySelector("#view-ist #n-home");
    const bolle = [...document.querySelectorAll("#view-ist .dm-flow-node")].map((nodo) =>
      nodo.getBoundingClientRect(),
    );
    if (!casa || !bolle.length) return null;
    const suo = casa.getBoundingClientRect();
    const file = new Map();
    for (const b of bolle) {
      const fila = Math.round(b.top / 10);
      file.set(fila, [...(file.get(fila) || []), b]);
    }
    let diFianco = Infinity;
    for (const fila of file.values()) {
      fila.sort((a, b) => a.left - b.left);
      for (let i = 1; i < fila.length; i += 1)
        diFianco = Math.min(diFianco, Math.round(fila[i].left - fila[i - 1].right));
    }
    /* La bolla piu' in alto e' quella che rischia di toccare la Casa. */
    const piuAlta = bolle.reduce((a, b) => (a.top <= b.top ? a : b));
    return {
      quante: bolle.length,
      file: file.size,
      larga: Math.round(piuAlta.width),
      sottoLaCasa: Math.round(piuAlta.top - suo.bottom),
      diFianco: Number.isFinite(diFianco) ? diFianco : null,
    };
  });

async function apriLEnergia(page, testInfo, quanti, larghezza) {
  await page.setViewportSize({ width: larghezza, height: 900 });
  await page.route("https://**", (r) => r.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme(quanti));
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate((stati) => {
    const grezzi = eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    for (const [id, voce] of Object.entries(stati)) {
      if (grezzi) grezzi[id] = voce;
      if (typeof STATES !== "undefined") STATES[id] = voce;
    }
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, STATI);
  await page.locator('.tab[data-tab="energy"]').evaluate((nodo) => nodo.click());
  await expect.poll(() => page.locator("#view-ist .dm-flow-node").count()).toBe(quanti);
}

/* Le tre fasce, e i due bordi fra loro. 769 e 820 sono la fascia che era
 * rotta: il primo punto dopo la soglia del guscio, e l'ultimo prima della
 * soglia che il modulo si era scritto da solo. */
for (const larghezza of [700, 768, 769, 800, 820, 821, 900, 1400]) {
  test(`a ${larghezza} punti la bolla del carico non tocca la Casa`, async ({ page }, testInfo) => {
    test.setTimeout(150_000);
    await apriLEnergia(page, testInfo, 1, larghezza);
    const vuoti = await iVuoti(page);
    expect(vuoti, "la scena non ha disegnato").not.toBeNull();
    expect(
      vuoti.sottoLaCasa,
      `a ${larghezza} la bolla e' sopra la Casa invece che sotto (${vuoti.sottoLaCasa})`,
    ).toBeGreaterThan(0);
  });
}

for (const larghezza of [760, 769, 820, 900]) {
  test(`a ${larghezza} punti otto bolle non si toccano`, async ({ page }, testInfo) => {
    test.setTimeout(150_000);
    await apriLEnergia(page, testInfo, 8, larghezza);
    const vuoti = await iVuoti(page);
    expect(vuoti).not.toBeNull();
    expect(vuoti.sottoLaCasa, `sotto la Casa: ${vuoti.sottoLaCasa}`).toBeGreaterThan(0);
    expect(vuoti.diFianco, `di fianco: ${vuoti.diFianco}`).toBeGreaterThan(0);
    /* E stringere per farle stare non vuol dire ridurle a granelli: sotto i
     * cinquanta punti la scritta dentro non si legge piu', e una bolla che
     * non si legge non e' una bolla. */
    expect(vuoti.larga, `larghe ${vuoti.larga}`).toBeGreaterThanOrEqual(50);
  });
}
