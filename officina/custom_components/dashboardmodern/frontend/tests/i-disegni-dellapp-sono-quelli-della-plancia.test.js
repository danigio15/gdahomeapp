/* I disegni dell'app sono quelli della plancia, non somiglianti.
 *
 * L'app non ha il foglio unico delle sfumature e non ne ha bisogno: ogni
 * disegno sta in un file suo, in `app/assets/oggetti`, e un file e' un
 * documento a se' — un riferimento fra due elementi diversi, che e' il difetto
 * da cui viene tutta questa storia, la' non e' nemmeno possibile.
 *
 * Il difetto che resta possibile e' un altro, e non fa fallire niente: che
 * quei file restino indietro. Un disegno che sulla plancia cambia e nell'app
 * no, e da quel momento la stessa cosa ha due facce — «chi passa dal telefono
 * alla dashboard deve riconoscere le sue cose». Peggio: da quella cartella le
 * icone le prende anche il sito (vedi `strumenti/porta-nel-sito.mjs`), quindi
 * un disegno vecchio finisce anche in vetrina.
 *
 * Qui si confrontano uno per uno. Il confronto salta lo spazio bianco e il
 * ripiego di colore — `url(#x) currentColor` — che la plancia aggiunge quando
 * serve il markup e nel file non c'e'.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { haOggettoWidget, oggettoWidget } from "../src/core/oggetti-widget.js";

const CARTELLA = fileURLToPath(new URL("../../../../../app/assets/oggetti/", import.meta.url));

/* Il nome del file non e' sempre quello del disegno: la cartella dell'app
 * chiama «animali» quello che il catalogo chiama «animale». */
const COME_SI_CHIAMA = Object.freeze({ animali: "animale" });

const dentroAllSvg = (markup) =>
  String(markup)
    .replace(/^[\s\S]*?<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "");

const confrontabile = (markup) =>
  dentroAllSvg(markup).replace(/\s+/g, " ").replaceAll(" currentColor", "").trim();

test("la cartella dei disegni dell'app c'e' dove ci si aspetta", () => {
  /* Se un domani l'app si sposta, questa prova deve dirlo invece di passare
   * senza guardare niente. */
  assert.ok(existsSync(CARTELLA), `non trovo ${CARTELLA}`);
});

test("ogni disegno dell'app e' quello della plancia", () => {
  const files = readdirSync(CARTELLA).filter((nome) => nome.endsWith(".svg"));
  assert.ok(files.length > 40, `pochi disegni nell'app: ${files.length}`);
  const sconosciuti = [];
  const diversi = [];
  for (const file of files.sort()) {
    const nome = file.replace(/\.svg$/, "");
    const quale = COME_SI_CHIAMA[nome] || nome;
    if (!haOggettoWidget(quale)) {
      sconosciuti.push(file);
      continue;
    }
    const suo = confrontabile(readFileSync(CARTELLA + file, "utf8"));
    if (suo !== confrontabile(oggettoWidget(quale))) diversi.push(file);
  }
  assert.deepEqual(
    sconosciuti,
    [],
    "l'app ha un disegno che il catalogo della plancia non conosce: o va aggiunto al catalogo, o va chiamato col nome che ha la' (vedi COME_SI_CHIAMA)",
  );
  assert.deepEqual(
    diversi,
    [],
    "questo disegno nell'app non e' piu' quello della plancia: ricopia il contenuto di `oggettoWidget(<nome>)` dentro `app/assets/oggetti/<nome>.svg`, o la stessa cosa avra' due facce — e una finira' anche sul sito",
  );
});

test("un disegno dell'app si basta da se'", () => {
  /* La controprova dell'altro lato: nell'app non c'e' nessun foglio da cui
   * prendere le sfumature, quindi un nome chiesto e non dichiarato vuol dire
   * una figura trasparente. Lo guarda anche una prova dell'app
   * (`app/test/vestito/oggetti_test.dart`), che e' dove si romperebbe; questa
   * tiene il conto dal lato del catalogo. */
  const files = readdirSync(CARTELLA).filter((nome) => nome.endsWith(".svg"));
  let riferimenti = 0;
  const fuori = [];
  for (const file of files) {
    const testo = readFileSync(CARTELLA + file, "utf8");
    const dichiarati = new Set([...testo.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => id));
    const chiesti = new Set([...testo.matchAll(/url\(#([^)\s]+)\)/g)].map(([, id]) => id));
    riferimenti += chiesti.size;
    for (const id of chiesti) if (!dichiarati.has(id)) fuori.push(`${file} → ${id}`);
  }
  assert.ok(riferimenti > 40, `pochi riferimenti: ${riferimenti}`);
  assert.deepEqual(fuori, [], "questo disegno dell'app chiede una sfumatura che non dichiara");
});
