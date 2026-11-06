/* Ogni parola della console ha la sua gemella inglese.
 *
 * Le parole inglesi della pagina stanno nella pagina, in `data-en` accanto
 * alle italiane (`laPaginaNellaSuaLingua` in `console.js`). Il guaio e' che una
 * frase nuova senza la sua gemella non si lamenta: chi legge in inglese si
 * trova una riga in italiano in mezzo alle altre, e nessuna prova se ne
 * accorge. Questa si': ogni testo che si legge — e ogni `placeholder`,
 * `aria-label`, `alt` — ha la sua traduzione su di se' o su chi lo contiene.
 *
 * Restano fuori i nomi, che si dicono uguali nelle due lingue. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const QUI = dirname(fileURLToPath(import.meta.url));
const pagina = readFileSync(join(QUI, "..", "console", "index.html"), "utf8");

/* Le parole che non si traducono: nomi di cose, e i segnaposto. */
const UGUALI = new Set(["GdAHome", "Home Assistant", "Zigbee", "Base", "Premium", "GdANav", "…"]);

const VUOTI = new Set(["img", "input", "meta", "link", "br", "hr", "source"]);
const DA_TRADURRE = ["placeholder", "aria-label", "alt", "title"];

function attributi(testo) {
  const detti = {};
  for (const m of testo.matchAll(/([^\s=]+)(?:=(?:"([^"]*)"|'([^']*)'))?/g))
    detti[m[1]] = m[2] ?? m[3] ?? "";
  return detti;
}

/* La pagina letta a pezzi: i commenti via, il disegno dei simboli via, poi
 * una pila di elementi aperti — basta per sapere chi contiene cosa. */
function iPezzi() {
  const pulita = pagina
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!doctype[^>]*>/i, "")
    .replace(/<svg[\s\S]*?<\/svg\s*>/g, " ")
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<title>[\s\S]*?<\/title>/g, "");
  const pila = [];
  const senza = [];
  const re = /<(\/?)([a-zA-Z0-9-]+)((?:\s+[^\s=>]+(?:=(?:"[^"]*"|'[^']*'))?)*)\s*(\/?)>|([^<]+)/g;
  for (const m of pulita.matchAll(re)) {
    if (m[5] !== undefined) {
      const parole = m[5].replace(/\s+/g, " ").trim();
      if (!/[a-zà-ù]/i.test(parole) || UGUALI.has(parole)) continue;
      if (!pila.some((uno) => "data-en" in uno.attr)) senza.push(parole);
      continue;
    }
    const [, chiude, nome, resto, solo] = m;
    if (chiude) {
      while (pila.length && pila.pop().nome !== nome) {
        /* un elemento lasciato aperto: si chiude con chi lo contiene */
      }
      continue;
    }
    const attr = attributi(resto || "");
    for (const quale of DA_TRADURRE) {
      const valore = attr[quale];
      if (!valore || !/[a-zà-ù]/i.test(valore) || UGUALI.has(valore)) continue;
      if (/^GDA-X/.test(valore)) continue;
      if (!(`data-en-${quale}` in attr)) senza.push(`${nome}[${quale}="${valore}"]`);
    }
    if (!solo && !VUOTI.has(nome.toLowerCase())) pila.push({ nome, attr });
  }
  return senza;
}

test("ogni testo della console ha la sua traduzione inglese", () => {
  assert.deepEqual(iPezzi(), [], "parole senza `data-en` (o `data-en-<attributo>`)");
});

test("nessuna traduzione e' vuota", () => {
  const vuote = Array.from(pagina.matchAll(/\sdata-en(-[a-z-]+)?=("\s*"|'\s*')/g), (m) => m[0]);
  assert.deepEqual(vuote, []);
});
