/* La fila «tutti» c'e', e' la prima, ed e' quella accesa di serie.
 *
 * Le tre file sotto l'anello — offline, da verificare, in ordine — si
 * premono e filtrano. A pagina aperta nessuna era accesa, e nessuno capiva
 * che erano tasti: chi tiene il cruscotto ha chiesto che tutti gli impianti
 * si vedano a prescindere dallo stato, che sia cosi' di serie, e che la fila
 * lo faccia vedere. Questa prova tiene le tre cose insieme.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const QUI = dirname(fileURLToPath(import.meta.url));
const PAGINA = readFileSync(join(QUI, "..", "console", "index.html"), "utf8");

test("la prima fila e' «tutti», e il filtro di serie e' «tutte»", () => {
  const da = PAGINA.indexOf("const LE_FILE = [");
  assert.ok(da > 0, "le file non ci sono piu'");
  const file = PAGINA.slice(da, PAGINA.indexOf("];", da));
  const prima = /\[\s*"([a-z]+)",\s*"[^"]*",\s*"([^"]+)"\s*\]/.exec(file);
  assert.deepEqual([prima?.[1], prima?.[2]], ["tutte", "tutti"], "la prima fila non e' «tutti»");
  assert.match(PAGINA, /let filtro = "tutte";/, "di serie non si vedono tutti");
});

test("la fila accesa e' quella del filtro, e «tutti» conta tutti gli impianti", () => {
  assert.match(
    PAGINA,
    /aria-pressed="\$\{filtro === chiave\}"/,
    "la fila del filtro non si accende",
  );
  assert.match(PAGINA, /chiave === "tutte" \? CASE\.length : quanti\[chiave\]/);
  /* E ha il suo colore, che e' l'azzurro: quello che si preme. */
  assert.match(PAGINA, /\[data-stato="tutte"\] \{\s*--tinta: var\(--accento\);/);
});
