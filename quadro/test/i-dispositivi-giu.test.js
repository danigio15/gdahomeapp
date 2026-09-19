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

const QUI = dirname(fileURLToPath(import.meta.url));
const CONSOLE = readFileSync(join(QUI, "..", "console", "index.html"), "utf8");

test("la console legge tutte le chiavi che il ponte mette in «entita»", () => {
  const detto = leEntita([{ entity_id: "sensor.uno", state: "unavailable", attributes: {} }]);
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

test("il numero vero dei dispositivi giu' non si perde nel taglio a dodici", () => {
  /* Quaranta dispositivi giu' e dodici nomi mandati: la console deve dire
   * «e altri ventotto», se no dodici sembrano tutti quelli che ci sono — ed e'
   * la differenza fra «ho un guaio» e «ho un disastro». */
  const detto = leEntita(
    Array.from({ length: 40 }, (_, i) => ({
      entity_id: `sensor.n${i}`,
      state: "unavailable",
      attributes: {},
    })),
  );
  assert.equal(detto.dispositivi, 40);
  assert.equal(detto.nomi.length, 12);
  assert.match(CONSOLE, /e altri \$\{altri\}/, "la console non scrive quanti ne restano fuori");
});
