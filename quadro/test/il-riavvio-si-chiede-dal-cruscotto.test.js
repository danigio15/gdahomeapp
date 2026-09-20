/* Il tasto «Riavvia Home Assistant» nella scheda di una casa.
 *
 * E' un tasto che spegne e riaccende la casa di qualcun altro, quindi le
 * regole che contano sono le condizioni: c'e' solo con la manutenzione
 * aperta, solo se in quella casa non sta gia' succedendo qualcosa, e chiede
 * conferma in due tempi. E chiama la porta giusta: `/riavvia`, non
 * `/installa` con un corpo strano.
 *
 * Le funzioni della pagina stanno in un `<script>`: si guarda il sorgente.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const QUI = dirname(fileURLToPath(import.meta.url));
const PAGINA = readFileSync(join(QUI, "..", "console", "index.html"), "utf8");

test("il tasto c'e', chiede conferma in due tempi e chiama la sua porta", () => {
  assert.match(PAGINA, /data-riavvia="\$\{testo\(casa\.casa\)\}"/, "il tasto non c'e' piu'");
  assert.match(PAGINA, /Riavvia Home Assistant/);
  const gancio = PAGINA.slice(PAGINA.indexOf('querySelectorAll("[data-riavvia]")'));
  const pezzo = gancio.slice(0, gancio.indexOf('querySelectorAll("[data-lascia-stare]")'));
  assert.match(
    pezzo,
    /Premi ancora per confermare/,
    "senza il secondo tempo un tocco storto riavvia una casa",
  );
  assert.match(pezzo, /\/casa\/\$\{tasto\.dataset\.riavvia\}\/riavvia`, \{ method: "POST" \}/);
});

test("il tasto c'e' solo con la manutenzione aperta, e mai mentre sta succedendo altro", () => {
  const dove = PAGINA.indexOf('data-riavvia="${testo(casa.casa)}"');
  const prima = PAGINA.slice(Math.max(0, dove - 900), dove);
  assert.match(prima, /c\.manutenzione && !staLavorando\(c\) && !casa\.chiesto/);
});

test("un riavvio finito si dice «fatto», non «installato»", () => {
  assert.match(PAGINA, /l\.riavvio \? "fatto" : "installato"/);
});

test("un riavvio appena chiesto si annuncia col suo nome, non con un salto di versione vuoto", () => {
  /* `chiesto` per un riavvio non ha nome, `da` ne' `a`: il cartello che li
   * scrive uguali per tutti direbbe « → », che non e' niente. */
  const da = PAGINA.indexOf("function ilCartello(");
  const pezzo = PAGINA.slice(da, PAGINA.indexOf("const l = c.lavoro;", da));
  assert.match(pezzo, /chiesto\.cosa === "riavvia"/);
  assert.match(pezzo, /Il riavvio di Home Assistant/);
});
