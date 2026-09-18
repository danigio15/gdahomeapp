/* Ogni classe scritta nelle pagine ha una regola che la veste.
 *
 * Le due pagine del quadro portano il loro stile dentro, in un `<style>`: non
 * c'e' un foglio condiviso, e non e' una svista — sono due pagine sole, e un
 * file in piu' da servire per risparmiare qualche riga non vale il giro.
 *
 * Il prezzo pero' e' questo: una classe copiata da un'altra pagina arriva
 * **senza** la sua regola, e non se ne lamenta nessuno. E' successo davvero.
 * `class="minuta"` veniva dalla console del ponte, che il suo foglio ce l'ha;
 * qui quelle quattro righe si vedevano grandi come il resto del testo, e il
 * difetto si notava solo guardando la pagina con l'occhio giusto.
 *
 * La stessa prova sta anche in `ponte/test/vestito.test.js`, dove la classe
 * rimasta senza regola era `.rapporto`, dopo un rinominare fatto a meta'.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const QUI = dirname(fileURLToPath(import.meta.url));

/* Via i pezzi calcolati, `${…}`, prima di guardare le classi.
 *
 * Meta' di questi `class="…"` sono dentro template literal, e il pezzo in
 * mezzo e' codice: `class="pastiglia ${uno.pieno ? "al limite" : ""}"`. Senza
 * toglierlo, quello che resta in mano sono `?`, `:` e il nome di una
 * costante — e una prova che deve inventarsi delle eccezioni per non
 * inciampare nei propri errori non prova piu' niente.
 *
 * Si conta la parentesi, perche' dentro ce n'e' un'altra: `${a ? `${b}` : ""}`.
 * Quello che sta fuori resta, e su quello si giudica. */
function senzaIPezziCalcolati(testo) {
  let fuori = "";
  for (let i = 0; i < testo.length; i += 1) {
    if (testo[i] === "$" && testo[i + 1] === "{") {
      let profondo = 1;
      i += 2;
      while (i < testo.length && profondo > 0) {
        if (testo[i] === "{") profondo += 1;
        else if (testo[i] === "}") profondo -= 1;
        i += 1;
      }
      i -= 1;
      fuori += " ";
      continue;
    }
    fuori += testo[i];
  }
  return fuori;
}

function guarda(pagina) {
  const testo = senzaIPezziCalcolati(readFileSync(join(QUI, "..", pagina), "utf8"));
  const dentro = (tag) =>
    [...testo.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g"))]
      .map((m) => m[1])
      .join("\n");

  /* Tutto quello che lo stile nomina, in qualunque punto di qualunque
   * selettore: `.minuta`, `ul.installatori > li`, `.pastiglia.male`. */
  const vestite = new Set(Array.from(dentro("style").matchAll(/\.([a-zA-Z][\w-]*)/g), (m) => m[1]));

  /* E quelle che il programma appiccica da solo, che nella pagina non ci sono. */
  for (const m of dentro("script").matchAll(/classList\.(?:add|remove|toggle)\(\s*["`]([^"`]+)/g)) {
    for (const una of m[1].split(/\s+/)) vestite.add(una);
  }

  const nude = new Set();
  for (const m of testo.matchAll(/class="([^"]*)"/g)) {
    for (const una of m[1].split(/\s+/)) {
      if (una && !vestite.has(una)) nude.add(una);
    }
  }
  return [...nude].sort();
}

for (const pagina of ["console/index.html", "gestore/index.html"]) {
  test(`in ${pagina} ogni classe ha la sua regola`, () => {
    assert.deepEqual(
      guarda(pagina),
      [],
      "classi scritte nella pagina che nessuna regola veste: o e' un refuso, o e' una classe arrivata da un'altra pagina senza il suo stile",
    );
  });
}
