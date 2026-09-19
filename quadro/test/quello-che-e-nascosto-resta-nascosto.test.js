/* Quello che la pagina nasconde con `hidden` resta nascosto.
 *
 * `hidden` non e' un interruttore del browser: e' una riga di foglio di stile
 * che il browser scrive per conto suo — `[hidden] { display: none }` — e sta
 * in fondo alla fila. Qualunque `display` scritto nel documento la vince,
 * anche uno scritto mille righe piu' su e senza sapere che esiste.
 *
 * E' costato davvero. `.rinomina` aveva `display: flex`, e la casella col nome
 * e il tasto «Salva» stavano aperti nella scheda di **ogni** casa: il tasto
 * «Rinomina» sembrava non fare niente — premuto, toglieva un `hidden` che non
 * nascondeva — e chi apriva una casa si trovava una casella di testo che non
 * aveva chiesto. Nessuna prova se n'era accorta, perche' il programma era
 * giusto: `riga.hidden = !riga.hidden` fa quello che dice.
 *
 * Questa prova guarda la coppia, non i due pezzi separati: se un elemento
 * porta `hidden` addosso e una delle sue classi gli mette un `display`, allora
 * ci vuole anche la regola che lo richiude — `.classe[hidden] { display: none }`.
 *
 * E' la sorella di `vestito.test.js`: la' si controlla che ogni classe abbia
 * una regola, qui che la regola non disfi quello che il programma ha deciso.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const QUI = dirname(fileURLToPath(import.meta.url));

const PAGINE = ["console/index.html", "gestore/index.html"];

/** Lo stile della pagina: tutto quello che sta dentro i suoi `<style>`. */
const loStile = (pagina) =>
  [...pagina.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((uno) => uno[1]).join("\n");

/**
 * Le classi degli elementi che nascono con `hidden` addosso.
 *
 * Si guarda il tag intero — da `<` a `>` — perche' `class` e `hidden` possono
 * stare in quest'ordine o nell'altro, e su righe diverse. `aria-hidden` non
 * c'entra niente e non deve entrarci: quello dice una cosa a chi legge lo
 * schermo, e non nasconde niente.
 */
function leClassiNascoste(pagina) {
  const classi = new Set();
  for (const [tag] of pagina.matchAll(/<[a-z][^>]*>/gi)) {
    /* Via `aria-hidden` prima di cercare `hidden`, se no lo si trova dentro. */
    const senzaAria = tag.replace(/aria-hidden/g, "aria");
    if (!/(^|\s)hidden(\s|\/|>|$)/.test(senzaAria)) continue;
    const quali = /class="([^"$]*)"/.exec(tag);
    if (!quali) continue;
    for (const una of quali[1].split(/\s+/).filter(Boolean)) classi.add(una);
  }
  return [...classi];
}

/** Questa classe, da sola, mette un `display`? */
const mettonoUnDisplay = (stile, classe) => {
  const regole = [...stile.matchAll(/([^{}]+)\{([^}]*)\}/g)];
  return regole.some(([, dove, dentro]) => {
    if (!new RegExp(`\\.${classe}(?![\\w-])`).test(dove)) return false;
    if (/\[hidden\]/.test(dove)) return false;
    return /(^|[;\s])display\s*:/.test(dentro);
  });
};

/** E c'e' la regola che la richiude quando porta `hidden`? */
const laRichiude = (stile, classe) => {
  const regole = [...stile.matchAll(/([^{}]+)\{([^}]*)\}/g)];
  return regole.some(([, dove, dentro]) => {
    if (
      !new RegExp(`\\.${classe}(?![\\w-])\\[hidden\\]|\\[hidden\\]\\.${classe}(?![\\w-])`).test(
        dove,
      )
    )
      return false;
    return /display\s*:\s*none/.test(dentro);
  });
};

for (const quale of PAGINE) {
  test(`in ${quale} quello che nasce con hidden resta nascosto`, () => {
    const pagina = readFileSync(join(QUI, "..", quale), "utf8");
    const stile = loStile(pagina);

    for (const classe of leClassiNascoste(pagina)) {
      if (!mettonoUnDisplay(stile, classe)) continue;
      assert.ok(
        laRichiude(stile, classe),
        `«.${classe}» mette un display e sta su un elemento che nasce con hidden: ` +
          `il browser non riesce piu' a nasconderlo. Ci vuole «.${classe}[hidden] { display: none }».`,
      );
    }
  });
}
