/* «Sulla sezione stampanti riesce a mettere i 4 colori? che poi va sulla home
 * sotto il meteo quando c'e' un sottosoglia?»
 *
 * I quattro colori la sezione li aveva (#469: nero, ciano, magenta, giallo,
 * ognuno con la sua barra e il suo colore vero) e la tessera in Home contava
 * gia' le stampanti da guardare. Sotto il meteo, no: la fascia non aveva una
 * voce per le stampanti. Adesso ce l'ha, e si accende come le altre notizie:
 * solo quando c'e' qualcosa da dire. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { VOCI_DELLA_BARRA, pastiglieDellaCasa } from "../src/core/come-sta-la-casa.js";
import { TINTE_DELLE_CARTUCCE } from "../src/core/stampanti-model.js";

const leggi = (nome) => readFileSync(new URL(`../src/${nome}`, import.meta.url), "utf8");

/* Il modello della tessera in Home, come lo fa `stampantiModel`. */
const MODELLO = {
  key: "stampanti",
  icon: "🖨️",
  accent: "#f59e0b",
  daDire: 1,
  ferme: 0,
  rows: [
    { entity: "sensor.laser_ufficio", name: "Laser ufficio", daDire: true },
    { entity: "sensor.inkjet_studio", name: "Inkjet studio", daDire: false },
  ],
};

test("i quattro colori ci sono, e sono quelli veri delle cartucce", () => {
  const tinte = TINTE_DELLE_CARTUCCE.map((voce) => voce.tinta);
  assert.deepEqual(tinte.slice(0, 4), ["nero", "ciano", "magenta", "giallo"]);
  /* E due in piu' per chi le ha: la cartuccia a tre colori e il nero foto. */
  assert.deepEqual(tinte.slice(4), ["colore", "foto"]);
  for (const voce of TINTE_DELLE_CARTUCCE) assert.match(voce.colore, /^#[0-9a-f]{6}$/i);
});

test("la fascia ha una voce per le stampanti, fra le notizie", () => {
  const chiavi = VOCI_DELLA_BARRA.map((voce) => voce.chiave);
  assert.ok(chiavi.includes("stampanti"));
  /* Dopo i varchi e prima delle luci: una cartuccia finita e' una cosa
   * successa, non una cosa rimasta accesa. */
  assert.ok(chiavi.indexOf("stampanti") > chiavi.indexOf("varchi"));
  assert.ok(chiavi.indexOf("stampanti") < chiavi.indexOf("luci"));
  assert.equal(VOCI_DELLA_BARRA.find((voce) => voce.chiave === "stampanti").tessera, "stampanti");
});

test("sotto soglia la pastiglia compare, col conto che ha fatto la tessera", () => {
  const [pastiglia, ...altre] = pastiglieDellaCasa([MODELLO]);
  assert.deepEqual(altre, []);
  assert.equal(pastiglia.chiave, "stampanti");
  assert.equal(pastiglia.id, "stampanti");
  assert.equal(pastiglia.conto, 1);
  assert.equal(pastiglia.tinta, "#f59e0b");
  assert.equal(pastiglia.icona, "🖨️");
  assert.equal(pastiglia.avviso, false);
  /* Toccandola si apre la tessera, non un elenco «tocca per spegnere». */
  assert.equal(pastiglia.tessera, "stampanti");
  assert.equal(pastiglia.voci, undefined);
});

test("una stampante ferma e' un avviso, rosso come la sua tessera", () => {
  const [pastiglia] = pastiglieDellaCasa([{ ...MODELLO, accent: "#dc2626", daDire: 2, ferme: 1 }]);
  assert.equal(pastiglia.conto, 2);
  assert.equal(pastiglia.avviso, true);
  assert.equal(pastiglia.tinta, "#dc2626");
});

test("con tutte pronte e le cartucce piene, niente pastiglia", () => {
  assert.deepEqual(pastiglieDellaCasa([{ ...MODELLO, daDire: 0 }]), []);
  assert.deepEqual(pastiglieDellaCasa([{ ...MODELLO, daDire: undefined }]), []);
  /* E senza stampanti configurate la tessera non c'e' proprio. */
  assert.deepEqual(pastiglieDellaCasa([]), []);
});

test("si spegne dalla configurazione della barra, come le altre voci", () => {
  assert.deepEqual(pastiglieDellaCasa([MODELLO], { barra: { voci: { stampanti: false } } }), []);
});

test("la tessera dice quante hanno qualcosa da dire, e quante sono ferme", () => {
  const sorgente = leggi("sections/home-widgets-section.js");
  const modello = sorgente.slice(sorgente.indexOf("function stampantiModel("));
  const corpo = modello.slice(0, modello.indexOf("\n}\n"));
  assert.match(corpo, /\n\s+daDire,\n/);
  assert.match(corpo, /ferme: riassunto\.ferme\.length,/);
  /* E ogni riga dice se e' lei ad avere qualcosa da dire: la stessa soglia
   * del riassunto, non una seconda. */
  assert.match(
    corpo,
    /daDire: Boolean\(lettura\.ferma \|\| lettura\.piuScarica\?\.agliSgoccioli\)/,
  );
});

test("la sezione ha le parole per dirla, e il nome nell'elenco della scheda", () => {
  const sorgente = leggi("sections/come-sta-la-casa-section.js");
  assert.match(sorgente, /if \(chiave === "stampanti"\)/);
  assert.match(sorgente, /t\("stampante da guardare", "printer to check"\)/);
  assert.match(sorgente, /t\("stampanti da guardare", "printers to check"\)/);
  assert.match(sorgente, /\n\s+stampanti: t\("Stampanti", "Printers"\),\n/);
});
