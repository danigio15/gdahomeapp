/* Ogni classe scritta nella pagina ha una regola che la veste.
 *
 * Questa prova nasce da un difetto vero, e di quelli che nessun'altra prova
 * qui dentro avrebbe preso. Rinominando la cartolina in rapporto e' cambiato
 * il nome della classe nella pagina e **non** quello della regola nel foglio
 * di stile: `<pre class="rapporto">` e' rimasto senza fondo, senza altezza
 * massima e senza scorrimento, cioe' un rapporto lungo allargava la pagina.
 *
 * Il guaio e' che una classe che non esiste non si lamenta. Il browser non
 * dice niente, le prove passano tutte, e il difetto si vede solo aprendo
 * quella scheda con dentro un testo lungo — che nelle prove non succede mai.
 * Quindi lo chiede questa: le due meta' di un rinominare si tengono per mano.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const QUI = dirname(fileURLToPath(import.meta.url));
const CONSOLE = join(QUI, "..", "console");

const pagina = readFileSync(join(CONSOLE, "index.html"), "utf8");
const stile = readFileSync(join(CONSOLE, "stile.css"), "utf8");
const programma = readFileSync(join(CONSOLE, "console.js"), "utf8");

/* Le classi che il foglio di stile nomina, in qualunque punto di qualunque
 * selettore: `.minuta`, `a.bottone`, `.passi > li`, `.apribile + .minuta`. */
const vestite = new Set(Array.from(stile.matchAll(/\.([a-z][a-z0-9-]*)/gi), (m) => m[1]));

/* Quelle che il programma appiccica o toglie da solo: `classList.add("x")`,
 * `classList.toggle("x", …)`, e le classi scritte dentro i pezzi di HTML che
 * fabbrica. Non sono nella pagina, ma esistono lo stesso. */
for (const m of programma.matchAll(/classList\.(?:add|remove|toggle)\(\s*"([^"]+)"/g)) {
  for (const una of m[1].split(/\s+/)) vestite.add(una);
}

/* Le due che stanno nude apposta, e il motivo scritto qui perche' non si
 * debba indovinare. Sono i due lati della griglia di `.abbinamento`: la loro
 * posizione gliela da' il genitore, e una regola propria non avrebbero cosa
 * dirla. Il nome serve a chi legge il markup, non al browser.
 *
 * Stanno scritte una per una, e non e' pignoleria: una lista di eccezioni che
 * si allunga da sola non e' piu' una lista di eccezioni. Aggiungercene una
 * deve costare un pensiero. */
const NUDE_APPOSTA = new Set(["qr-suo", "parole"]);

test("ogni classe della pagina ha una regola nel foglio di stile", () => {
  const nude = new Set();
  for (const m of pagina.matchAll(/\sclass="([^"]*)"/g)) {
    for (const una of m[1].trim().split(/\s+/)) {
      if (una && !vestite.has(una) && !NUDE_APPOSTA.has(una)) nude.add(una);
    }
  }
  assert.deepEqual(
    [...nude].sort(),
    [],
    "classi scritte nella pagina che nessuna regola veste: o e' un refuso, o e' meta' di un rinominare",
  );
});

test("ogni classe che il programma appiccica ha una regola nel foglio di stile", () => {
  const nude = new Set();
  for (const m of programma.matchAll(/classList\.(?:add|toggle)\(\s*"([^"]+)"/g)) {
    for (const una of m[1].trim().split(/\s+/)) {
      if (una && !vestite.has(una)) nude.add(una);
    }
  }
  assert.deepEqual([...nude].sort(), []);
});
