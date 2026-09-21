/* Il riquadro dei dispositivi che non rispondono, fra le due macchine.
 *
 * Questo pezzo passa per due file che non si importano a vicenda: il ponte
 * riempie `entita` in `ponte/src/salute.js`, la console lo disegna in
 * `quadro/console/index.html`. Fra i due non c'e' nessun contratto scritto —
 * c'e' un oggetto JSON che viaggia — e una chiave ribattezzata da una parte
 * sola non rompe niente: fa sparire il riquadro, in silenzio, e nessuno se ne
 * accorge finche' un installatore non chiede perche' quella casa non dice piu'
 * cosa e' giu'.
 *
 * Qui i due si guardano in faccia una volta.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { leEntita } from "../../ponte/src/salute.js";
import { iControlli, lePastiglie, loStato } from "../src/controlli.js";

const QUI = dirname(fileURLToPath(import.meta.url));
const CONSOLE = readFileSync(join(QUI, "..", "console", "index.html"), "utf8");

/* I registri di Home Assistant, che qui servono sempre: dalla 1.5.9.2 il ponte
 * guarda **solo le entita' di un dispositivo vero** — quelle che stanno in
 * «Dispositivi e integrazioni», Zigbee compreso — e senza i registri non
 * risponde affatto. Il perche' sta in cima a `ponte/src/salute.js`. */
const iRegistri = (quanti) => ({
  dispositivi: Array.from({ length: quanti }, (_, i) => ({ id: `d${i}`, name: `Sonda ${i}` })),
  entita: Array.from({ length: quanti }, (_, i) => ({
    entity_id: `sensor.n${i}`,
    device_id: `d${i}`,
  })),
});

test("la console legge tutte le chiavi che il ponte mette in «entita»", () => {
  const detto = leEntita([{ entity_id: "sensor.n0", state: "unavailable", attributes: {} }], {
    registri: iRegistri(1),
  });
  /* `totali`, `giu`, `dispositivi`, `nomi`: se il ponte ne aggiunge una e la
   * console non la guarda, e' roba che viaggia per niente; se ne ribattezza
   * una, e' il riquadro che sparisce. */
  for (const chiave of Object.keys(detto)) {
    assert.ok(
      new RegExp(`entita\\??\\.${chiave}\\b`).test(CONSOLE),
      `la console non legge «${chiave}», che il ponte manda`,
    );
  }
});

test("una casa ferma alla 1.5.6 mostra quello che sa, invece di un riquadro vuoto", () => {
  /* Le case si aggiornano quando gli pare, e fino a quel momento mandano le
   * quattro cifre di prima. Queste due righe valgono il tempo che ci mette
   * l'ultima casa; toglierle prima vuol dire un buco senza nessun messaggio. */
  assert.match(CONSOLE, /entita\?\.sparite/, "la console non sa piu' leggere una casa vecchia");
  assert.match(CONSOLE, /entita\?\.impronte/, "le quattro cifre di prima non si disegnano piu'");
});

const giuPerFinta = (quanti) =>
  Array.from({ length: quanti }, (_, i) => ({
    entity_id: `sensor.n${i}`,
    state: "unavailable",
    attributes: {},
  }));

test("chi installa li legge tutti, non i primi dodici", () => {
  /* «Non escono i nomi completi dei dispositivi nel cruscotto installatore,
   * inoltre li deve mostrare tutti, non con la scritta “e altri…” ma senza
   * poterli leggere.»
   *
   * Il tetto del ponte era dodici, ed era una scelta di impaginazione: dodici
   * pastiglie stanno in tre righe. Ma quel riquadro non si legge di colpo, ci
   * si va a cercare dentro — quali cose sono giu' decide se si prende la
   * macchina — e «e altri 31» quella domanda non la risponde. */
  const detto = leEntita(giuPerFinta(43), { registri: iRegistri(43) });
  assert.equal(detto.dispositivi, 43);
  assert.equal(detto.nomi.length, 43);
});

test("e se un giorno il tetto taglia davvero, il numero vero non si perde", () => {
  /* Il tetto resta — e' la guardia contro un rapporto che cresce senza fine —
   * e il giorno che tocca a una casa enorme la console deve dire «e altri
   * ventotto», se no quelli mandati sembrano tutti quelli che ci sono, ed e'
   * la differenza fra «ho un guaio» e «ho un disastro». Qui il taglio si
   * chiede apposta, invece di aspettare la casa che lo faccia scattare. */
  const detto = leEntita(giuPerFinta(40), { quante: 12, registri: iRegistri(40) });
  assert.equal(detto.dispositivi, 40);
  assert.equal(detto.nomi.length, 12);
  assert.match(CONSOLE, /e altri \$\{altri\}/, "la console non scrive quanti ne restano fuori");
});

/* ─── I controlli leggono lo stesso numero della console ──────────────────── */

test("i controlli giudicano il rapporto di adesso, non quello di ieri", () => {
  /* Questa prova esiste per un guasto vero, trovato guardando la pagina e non
   * le prove: rinominando `sparite` in `giu` nel ponte, le regole erano
   * rimasto indietro e la spunta diceva **«undefined su 180»** — rossa per
   * sempre, e senza che niente si rompesse.
   *
   * Le loro prove non se ne sono accorte perche' gli davano tutte la
   * forma vecchia. Qui il rapporto lo fabbrica il **ponte**, cosi' il giorno
   * che cambia di la' si rompe di qua. */
  const registri = {
    dispositivi: [
      { id: "d1", name: "Lampada" },
      { id: "d2", name: "Presa garage" },
    ],
    entita: [
      { entity_id: "light.una", device_id: "d1" },
      { entity_id: "switch.presa", device_id: "d2" },
    ],
  };
  const carta = {
    entita: leEntita(
      [
        { entity_id: "light.una", state: "on", attributes: {} },
        { entity_id: "switch.presa", state: "unavailable", attributes: {} },
      ],
      { registri },
    ),
  };
  const controlli = iControlli(carta).controlli;
  const quella = controlli.find((uno) => uno.cosa === "I collegamenti");
  assert.ok(quella, "fra i controlli non c'e' piu' quello dei collegamenti");
  assert.equal(quella.va, false);
  assert.ok(
    !String(quella.dettaglio).includes("undefined"),
    `«${quella.dettaglio}» dice «undefined»`,
  );
  assert.match(quella.dettaglio, /1 dispositivo/);

  /* E con tutto collegato la spunta e' verde, col totale giusto. */
  const aPosto = {
    entita: leEntita([{ entity_id: "light.una", state: "on", attributes: {} }], { registri }),
  };
  const buona = iControlli(aPosto).controlli.find((uno) => uno.cosa === "I collegamenti");
  assert.equal(buona.va, true);
  assert.match(buona.dettaglio, /1 entità/);
});

test("le pastiglie e lo stato non dicono «undefined» col rapporto di adesso", () => {
  const carta = {
    entita: leEntita(
      [
        { entity_id: "sensor.uno", state: "unavailable", attributes: {} },
        { entity_id: "sensor.due", state: "unavailable", attributes: {} },
      ],
      {
        registri: {
          dispositivi: [
            { id: "d1", name: "Sonda cantina" },
            { id: "d2", name: "Sonda garage" },
          ],
          entita: [
            { entity_id: "sensor.uno", device_id: "d1" },
            { entity_id: "sensor.due", device_id: "d2" },
          ],
        },
      },
    ),
  };
  const scritto = JSON.stringify([lePastiglie(carta), loStato({ carta, vistaIl: Date.now() })]);
  assert.ok(!scritto.includes("undefined"), scritto);
  assert.match(scritto, /non collegati/);
});

test("una casa ferma a un ponte di ieri si giudica lo stesso", () => {
  /* Le case si aggiornano quando gli pare: finche' ne resta una che manda
   * `sparite`, i controlli la devono saper leggere. */
  const quello = iControlli({ entita: { totali: 180, sparite: 3, impronte: [] } }).controlli.find(
    (uno) => uno.cosa === "I collegamenti",
  );
  assert.equal(quello.va, false);
  assert.match(quello.dettaglio, /3 dispositivi/);
});
