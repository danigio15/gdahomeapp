/* Le prove della plancia dentro l'add-on: i file si servono da disco, con
 * un'impronta che cambia solo se cambiano loro, e non si esce dalla
 * cartella. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { BASE, Plancia } from "../src/plancia.js";

/* Una plancia piccola, scritta apposta: cosi' le prove non dipendono da
 * quella vera, che cambia a ogni aggiornamento. */
function planciaFinta() {
  const cartella = mkdtempSync(join(tmpdir(), "plancia-"));
  mkdirSync(join(cartella, "legacy", "vendor"), { recursive: true });
  mkdirSync(join(cartella, "src", "core"), { recursive: true });
  mkdirSync(join(cartella, "avatars"), { recursive: true });
  mkdirSync(join(cartella, "brands"), { recursive: true });
  writeFileSync(
    join(cartella, "legacy", "dashboard.html"),
    "<!DOCTYPE html><html><head></head></html>",
  );
  writeFileSync(
    join(cartella, "legacy", "dashboard-en.html"),
    "<!DOCTYPE html><html lang='en'></html>",
  );
  writeFileSync(join(cartella, "legacy", "vendor", "caratteri.css"), "@font-face{}");
  writeFileSync(join(cartella, "legacy", "appunti.md"), "non si serve");
  writeFileSync(join(cartella, "src", "core", "uno.js"), "export const uno = 1;");
  writeFileSync(join(cartella, "avatars", "1.png"), Buffer.from([137, 80, 78, 71]));
  writeFileSync(join(cartella, "brands", "fiat.svg"), "<svg/>");
  writeFileSync(
    join(cartella, "ORIGINE.json"),
    JSON.stringify({ commit: "abc123", portata_il: "2026-09-08T00:00:00Z" }),
  );
  return cartella;
}

test("la plancia vera portata dentro c'e', e ha la pagina in due lingue", () => {
  const plancia = new Plancia();
  assert.equal(plancia.cE, true);
  assert.match(plancia.impronta, /^[0-9a-f]{16}$/);
  assert.deepEqual(plancia.varianti(), ["dashboard-en.html", "dashboard.html"]);
  const descritta = plancia.descrizione();
  assert.equal(descritta.base, `${BASE}/${plancia.impronta}`);
  assert.equal(descritta.profilo, "primary");
  assert.equal(descritta.istanza, "gdahome");
  assert.ok(descritta.file > 200, "sono centinaia di file: la pagina e i moduli");
  assert.match(descritta.commit, /^[0-9a-f]{40}$/);

  const pagina = plancia.leggi(`${descritta.base}/legacy/dashboard.html`);
  assert.equal(pagina.stato, 200);
  assert.match(pagina.tipo, /^text\/html/);
  assert.match(pagina.corpo.toString("utf8"), /bridge-prelude\.js/);
  const modulo = plancia.leggi(`${descritta.base}/src/core/i18n.js`);
  assert.equal(modulo.stato, 200);
  assert.match(modulo.tipo, /^text\/javascript/);
  const ritratti = readdirSync(join(plancia.cartella, "avatars")).filter((nome) =>
    nome.endsWith(".webp"),
  );
  assert.ok(ritratti.length > 100, "i ritratti ci sono");
  assert.equal(plancia.leggi(`${BASE}/avatars/${ritratti[0]}`).stato, 200);

  /* E accanto ai ritratti la loro licenza, che si apre: distribuire delle
   * immagini di qualcun altro tenendo chiusa la carta che dice a che patto si
   * possono usare sarebbe il contrario di quello che quella carta e'. */
  const licenza = plancia.leggi(`${BASE}/avatars/LICENSE.txt`);
  assert.equal(licenza.stato, 200);
  assert.match(licenza.tipo, /^text\/plain/);
});

test("l'impronta dipende dal contenuto, e cambia quando cambia un file", () => {
  const cartella = planciaFinta();
  const prima = new Plancia({ cartella }).impronta;
  assert.match(prima, /^[0-9a-f]{16}$/);
  assert.equal(new Plancia({ cartella }).impronta, prima, "stessi file, stessa impronta");

  writeFileSync(join(cartella, "src", "core", "uno.js"), "export const uno = 2;");
  assert.notEqual(new Plancia({ cartella }).impronta, prima);

  /* I ritratti stanno fuori dall'impronta: aggiungerne uno non cambia niente. */
  const dopo = new Plancia({ cartella }).impronta;
  writeFileSync(join(cartella, "avatars", "2.png"), Buffer.from([1, 2, 3]));
  assert.equal(new Plancia({ cartella }).impronta, dopo);
  rmSync(cartella, { recursive: true, force: true });
});

test("i file si leggono dai loro percorsi, e da nessun altro", () => {
  const cartella = planciaFinta();
  const plancia = new Plancia({ cartella });
  const base = plancia.base;

  const pagina = plancia.leggi(`${base}/legacy/dashboard.html?ingresso=x`);
  assert.equal(pagina.stato, 200);
  assert.equal(pagina.tipo, "text/html; charset=utf-8");
  assert.equal(
    plancia.leggi(`${base}/legacy/vendor/caratteri.css`).tipo,
    "text/css; charset=utf-8",
  );
  assert.equal(plancia.leggi(`${base}/src/core/uno.js`).corpo.toString(), "export const uno = 1;");
  assert.equal(plancia.leggi(`${BASE}/avatars/1.png`).tipo, "image/png");
  assert.equal(plancia.leggi(`${BASE}/brands/fiat.svg`).tipo, "image/svg+xml");

  for (const percorso of [
    `${base}/legacy/manca.html`,
    `${base}/legacy/appunti.md`,
    `${BASE}/altra-impronta/legacy/dashboard.html`,
    `${base}/ORIGINE.json`,
    `${base}/../ORIGINE.json`,
    `${base}/legacy/../../ORIGINE.json`,
    `${BASE}/avatars/../legacy/dashboard.html`,
    `${base}/legacy/%2e%2e/x.js`,
    "/etc/passwd",
    "",
    undefined,
  ]) {
    assert.equal(plancia.leggi(percorso).stato, 404, `doveva dire di no a ${percorso}`);
  }
  rmSync(cartella, { recursive: true, force: true });
});

test("senza la cartella, la plancia non c'e' e lo dice", () => {
  const cartella = mkdtempSync(join(tmpdir(), "plancia-vuota-"));
  const plancia = new Plancia({ cartella });
  assert.equal(plancia.cE, false);
  assert.deepEqual(plancia.varianti(), []);
  assert.equal(plancia.leggi(`${BASE}/x/legacy/dashboard.html`).stato, 404);
  rmSync(cartella, { recursive: true, force: true });
});
