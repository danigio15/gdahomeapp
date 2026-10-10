/* La plancia parte impacchettata: una ventina di file invece di quattrocento.
 *
 * «Velocizza il caricamento delle plance, sia su Home Assistant che su gdahome
 * app.» La pagina chiedeva quattrocentotrentotto file a ogni apertura; il
 * ponte adesso la serve coi moduli del pacchetto al posto dei sorgenti
 * sciolti — ma solo se il pacchetto e' fatto da quei sorgenti. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  APERTURA_DEL_PACCO,
  ilPaccoDi,
  improntaDeiSorgenti,
  laPaginaImpacchettata,
} from "../src/pacco-della-plancia.js";
import { Plancia } from "../src/plancia.js";

const PAGINA = `<!DOCTYPE html><html><head>
<link rel="modulepreload" href="./build-info.js">
<link rel="modulepreload" href="./modules-entry.js">
<link rel="modulepreload" href="../src/core/uno.js">
<link rel="modulepreload" href="../src/sections/due.js">
<script type="module" src="./modules-entry.js"></script>
<script src="config.js"></script>
</head><body></body></html>
`;

function planciaFinta({ pacco = true } = {}) {
  const cartella = mkdtempSync(join(tmpdir(), "plancia-pacco-"));
  mkdirSync(join(cartella, "legacy"), { recursive: true });
  mkdirSync(join(cartella, "src", "sections"), { recursive: true });
  writeFileSync(join(cartella, "legacy", "dashboard.html"), PAGINA);
  writeFileSync(join(cartella, "legacy", "modules-entry.js"), "export const e = 1;");
  writeFileSync(join(cartella, "src", "sections", "section-runtime.js"), "export const s = 1;");
  if (pacco) {
    mkdirSync(join(cartella, "pacco", "legacy"), { recursive: true });
    mkdirSync(join(cartella, "pacco", "src", "sections"), { recursive: true });
    writeFileSync(join(cartella, "pacco", "legacy", "modules-entry.js"), "export {};");
    writeFileSync(join(cartella, "pacco", "src", "sections", "section-runtime.js"), "export {};");
    writeFileSync(join(cartella, "pacco", "chunk-ABC.js"), "export {};");
    writeFileSync(
      join(cartella, "pacco", "sorgenti.json"),
      JSON.stringify({ sorgenti: improntaDeiSorgenti(cartella) }),
    );
  }
  return cartella;
}

test("il pacchetto nel deposito e' fatto dai sorgenti di adesso", () => {
  /* Se questa cade: si e' toccata la plancia senza risigillarla. Il ponte
   * servirebbe i moduli sciolti — giusto, ma lento come prima. */
  const plancia = new Plancia();
  const { pacco, perche } = ilPaccoDi(plancia.cartella);
  assert.ok(
    pacco,
    `il pacchetto della plancia ${perche}: rifallo con «node strumenti/sigilla-la-plancia.mjs»`,
  );
  assert.ok(pacco.file.includes("pacco/legacy/modules-entry.js"));
  assert.ok(pacco.file.includes("pacco/src/sections/section-runtime.js"));
});

test("la pagina vera esce impacchettata: niente moduli sciolti da precaricare", () => {
  const plancia = new Plancia();
  const pagina = plancia.leggi(`${plancia.base}/legacy/dashboard.html`).corpo.toString("utf8");
  assert.ok(pagina.includes(APERTURA_DEL_PACCO));
  assert.doesNotMatch(pagina, /rel="modulepreload" href="\.\.\/src\//);
  const precarichi = pagina.match(/rel="modulepreload"/g) || [];
  assert.ok(precarichi.length < 20, `${precarichi.length} precarichi: dovrebbero essere pochi`);
  /* Quello che non e' un modulo resta dov'era. */
  assert.match(pagina, /bridge-prelude\.js/);
  assert.match(pagina, /dashboard-runtime-it\.js/);
  /* E i moduli del pacchetto si servono, sotto la stessa impronta. */
  const ingresso = plancia.leggi(`${plancia.base}/pacco/legacy/modules-entry.js`);
  assert.equal(ingresso.stato, 200);
  assert.match(ingresso.tipo, /^text\/javascript/);
  const inglese = plancia.leggi(`${plancia.base}/legacy/dashboard-en.html`).corpo.toString("utf8");
  assert.ok(inglese.includes(APERTURA_DEL_PACCO));
});

test("la pagina riscritta: i precarichi del pacchetto, gli indirizzi fissati, il ripiego", () => {
  const fatta = laPaginaImpacchettata(PAGINA, [
    "pacco/chunk-ABC.js",
    "pacco/legacy/modules-entry.js",
    "pacco/src/sections/section-runtime.js",
  ]);
  assert.doesNotMatch(fatta, /\.\.\/src\/core\/uno\.js/);
  assert.doesNotMatch(fatta, /href="\.\/modules-entry\.js"/);
  /* Il primo precaricato e' l'ingresso, poi gli altri. */
  const precarichi = [...fatta.matchAll(/rel="modulepreload" href="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(precarichi, [
    "./build-info.js",
    "../pacco/legacy/modules-entry.js",
    "../pacco/chunk-ABC.js",
    "../pacco/src/sections/section-runtime.js",
  ]);
  assert.match(
    fatta,
    /__DASHBOARDMODERN_PACCO_SEZIONI__ = new URL\("\.\.\/pacco\/src\/sections\/section-runtime\.js", document\.baseURI\)/,
  );
  assert.match(
    fatta,
    /__DASHBOARDMODERN_CATALOGHI__ = new URL\("\.\.\/src\/i18n\/", document\.baseURI\)/,
  );
  assert.match(
    fatta,
    /<script type="module" src="\.\.\/pacco\/legacy\/modules-entry\.js" onerror="/,
  );
  /* Il ripiego torna all'ingresso di sempre. */
  assert.match(fatta, /s\.src='\.\/modules-entry\.js'/);
  /* Due volte non si riscrive. */
  assert.equal(laPaginaImpacchettata(fatta, ["pacco/chunk-ABC.js"]), fatta);
  /* Una pagina d'altra forma resta com'era: meglio sciolta che a meta'. */
  const strana = "<html><script src='x.js'></script></html>";
  assert.equal(laPaginaImpacchettata(strana, []), strana);
});

test("un pacchetto rimasto indietro non si usa: la pagina esce coi moduli sciolti", () => {
  const cartella = planciaFinta();
  try {
    assert.ok(new Plancia({ cartella }).pacco.pacco, "appena fatto, regge");
    /* Si corregge un sorgente, e non si rifa' il pacchetto. */
    writeFileSync(join(cartella, "src", "sections", "section-runtime.js"), "export const s = 2;");
    const plancia = new Plancia({ cartella });
    assert.equal(plancia.pacco.pacco, null);
    assert.match(plancia.paccoInDueParole, /sorgenti diversi/);
    const pagina = plancia.leggi(`${plancia.base}/legacy/dashboard.html`).corpo.toString("utf8");
    assert.ok(!pagina.includes(APERTURA_DEL_PACCO));
    assert.match(pagina, /href="\.\.\/src\/core\/uno\.js"/);
  } finally {
    rmSync(cartella, { recursive: true });
  }
});

test("senza pacchetto, o lasciato da parte apposta, la plancia parte come prima", () => {
  const senza = planciaFinta({ pacco: false });
  const con = planciaFinta();
  try {
    const plancia = new Plancia({ cartella: senza });
    assert.equal(plancia.pacco.pacco, null);
    assert.equal(
      plancia.leggi(`${plancia.base}/legacy/dashboard.html`).corpo.toString("utf8"),
      readFileSync(join(senza, "legacy", "dashboard.html"), "utf8"),
    );
    process.env.PONTE_PLANCIA_SCIOLTA = "1";
    try {
      assert.equal(new Plancia({ cartella: con }).pacco.pacco, null);
    } finally {
      delete process.env.PONTE_PLANCIA_SCIOLTA;
    }
    const impacchettata = new Plancia({ cartella: con });
    assert.match(impacchettata.paccoInDueParole, /^impacchettata \(3 moduli\)$/);
  } finally {
    rmSync(senza, { recursive: true });
    rmSync(con, { recursive: true });
  }
});
