/* La guida del Config: che ci sia per ogni scheda, che dica le stesse cose
 * del manuale, e che «Mostrami» sappia cosa cercare. */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  eLaParola,
  guidaDi,
  normalizza,
  paroleDelPasso,
  PERCORSO,
  percorsoPer,
  schedeConGuida,
} from "../plancia/src/core/guida-del-config.js";
import { SCHEDE } from "../plancia/src/core/alberatura-del-config.js";
import { ilFile, leGuide } from "../../strumenti/guida-dal-manuale.mjs";

const MANUALE = new URL("../../docs/MANUALE.md", import.meta.url);
const TESTI = new URL("../plancia/src/core/guida-del-config-testi.js", import.meta.url);

test("i testi della guida sono quelli del manuale, rifatti dallo script", () => {
  const atteso = ilFile(leGuide(readFileSync(MANUALE, "utf8")));
  assert.equal(
    readFileSync(TESTI, "utf8"),
    atteso,
    "il manuale e' cambiato: node strumenti/guida-dal-manuale.mjs",
  );
});

test("ogni scheda del Config ha la sua guida, con lo scopo e i passi", () => {
  /* Runtime e' diagnostica per l'assistenza; colpo d'occhio e gdanav si
   * spiegano nei capitoli loro; «avvisi» e' la linguetta storica che ora sta
   * in fondo ai Widget. */
  const senza = new Set(["runtime", "occhio", "gdanav", "avvisi"]);
  for (const scheda of Object.keys(SCHEDE)) {
    if (senza.has(scheda)) continue;
    const guida = guidaDi(scheda);
    assert.ok(guida, `manca la guida della scheda ${scheda}`);
    assert.ok(guida.scopo.length > 20, `${scheda}: manca «A cosa serve»`);
    assert.ok(guida.passi.length > 0, `${scheda}: mancano i passi`);
  }
  /* Le guide in piu' (Salute, Prese) sono di linguette vere che l'alberatura
   * mette nella famiglia di ripiego: vanno bene. */
  assert.ok(schedeConGuida().length >= Object.keys(SCHEDE).length - senza.size);
});

test("i testi della guida non portano HTML che non sia il loro", () => {
  for (const scheda of schedeConGuida()) {
    const guida = guidaDi(scheda);
    const tutto = [
      guida.scopo,
      ...guida.campi,
      ...guida.consigli,
      ...guida.passi.map((p) => p.html),
    ].join(" ");
    assert.doesNotMatch(tutto, /<(?!\/?(b|code)>)/, `${scheda}: tag inatteso`);
  }
});

test("«Mostrami» cerca le etichette fra virgolette, senza le icone", () => {
  assert.deepEqual(paroleDelPasso("Premi «💾 Salva sezione» e poi «Scegli entità»."), [
    "salva sezione",
    "scegli entità",
  ]);
  assert.deepEqual(paroleDelPasso({ testo: "Niente da mostrare" }), []);
  assert.equal(normalizza("  💾 SALVA   SEZIONE "), "salva sezione");
  assert.ok(eLaParola("💾 SALVA SEZIONE", "salva sezione"));
  assert.ok(eLaParola("Scegli entità ›", "scegli entità"));
  assert.ok(!eLaParola("Salva", "salva sezione"));
  assert.equal(guidaDi(""), null);
  assert.equal(guidaDi("non-esiste"), null);
});

test("il percorso porta solo a schede che ci sono", () => {
  for (const passo of PERCORSO) assert.ok(Object.hasOwn(SCHEDE, passo.scheda), passo.scheda);
  assert.equal(percorsoPer([]).length, PERCORSO.length);
  assert.deepEqual(
    percorsoPer(["visib", "luci"]).map((p) => p.scheda),
    ["visib", "luci"],
  );
});
