/* La pastiglia dei rifiuti guarda a domani dopo l'ora scelta (#565).
 *
 * «Preferirei che la pillola sotto la barra del meteo mostrasse i rifiuti che
 * devo uscire la sera non quelli che passano a ritirare il giorno stesso» —
 * e, da un'altra persona sullo stesso filo: «magari si potrebbe pensare di far
 * vedere l'odierno fino ad una certa ora dopo di che si passa alla
 * visualizzazione del giorno dopo».
 *
 * Il bidone si mette fuori la sera prima. Un ritiro delle sette di mattina,
 * alle otto di sera, e' una cosa gia' successa: la pastiglia che la ripete fa
 * credere che ci sia ancora qualcosa da fare. La stessa pastiglia alle sei di
 * mattina, pero', e' l'ultimo avviso utile a chi il bidone non l'ha messo
 * fuori — quindi non si sostituisce un giorno con l'altro, si dichiara a che
 * ora quella giornata e' finita.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  giorniDelRitiro,
  normalizzaBarra,
  normalizzaOraDelRitiro,
  pastiglieDellaCasa,
} from "../src/core/come-sta-la-casa.js";

const alle = (ora) => new Date(2026, 8, 16, ora, 30, 0);

const MODELLO_RIFIUTI = Object.freeze({
  key: "rifiuti",
  icon: "♻️",
  accent: "#16a34a",
  rows: [
    { quando: "oggi", name: "Organico", glyph: "🥬", entity: "sensor.organico" },
    { quando: "domani", name: "Carta e cartone", glyph: "📦", entity: "sensor.carta" },
    { quando: "fra 3 giorni", name: "Vetro", glyph: "🍾", entity: "sensor.vetro" },
  ],
});

function nomiDeiRifiuti(pastiglie) {
  return pastiglie.filter((p) => p.chiave === "rifiuti").map((p) => p.nome);
}

test("l'ora si legge solo se e' un'ora vera", () => {
  assert.equal(normalizzaOraDelRitiro("20"), "20");
  assert.equal(normalizzaOraDelRitiro(0), "0");
  assert.equal(normalizzaOraDelRitiro("23"), "23");
  /* Fuori dal quadrante, o non un numero: vale come «mai». */
  assert.equal(normalizzaOraDelRitiro("24"), "");
  assert.equal(normalizzaOraDelRitiro("-1"), "");
  assert.equal(normalizzaOraDelRitiro("20:30"), "");
  assert.equal(normalizzaOraDelRitiro("sera"), "");
  assert.equal(normalizzaOraDelRitiro(""), "");
  assert.equal(normalizzaOraDelRitiro(null), "");
});

test("senza ora scelta la fascia resta quella di sempre", () => {
  assert.deepEqual(giorniDelRitiro("", alle(23)), ["oggi", "domani"]);
  assert.deepEqual(giorniDelRitiro(null, alle(3)), ["oggi", "domani"]);
  /* La configurazione nasce vuota: chi non l'ha aperta non cambia niente. */
  assert.equal(normalizzaBarra({}).rifiutiDalleOre, "");
  assert.equal(normalizzaBarra({ rifiutiDalleOre: "20" }).rifiutiDalleOre, "20");
  assert.equal(normalizzaBarra({ rifiutiDalleOre: "mezzanotte" }).rifiutiDalleOre, "");
});

test("prima dell'ora si guarda a oggi, dopo si guarda a domani", () => {
  assert.deepEqual(giorniDelRitiro("20", alle(19)), ["oggi", "domani"]);
  /* L'ora scelta e' inclusa: «dalle 20» vuol dire che alle 20 e' gia' domani. */
  assert.deepEqual(giorniDelRitiro("20", alle(20)), ["domani"]);
  assert.deepEqual(giorniDelRitiro("20", alle(23)), ["domani"]);
  /* E la mattina dopo si riparte da oggi, che e' quello che si mette fuori
   * adesso o che si e' appena mancato. */
  assert.deepEqual(giorniDelRitiro("20", alle(6)), ["oggi", "domani"]);
});

test("la pastiglia della sera annuncia il bidone di domani, non quello di stamattina", () => {
  const barra = { rifiutiDalleOre: "20" };
  const diGiorno = pastiglieDellaCasa([MODELLO_RIFIUTI], { barra, adesso: alle(9) });
  assert.deepEqual(nomiDeiRifiuti(diGiorno), ["Organico"], "di giorno vale il ritiro di oggi");

  const diSera = pastiglieDellaCasa([MODELLO_RIFIUTI], { barra, adesso: alle(21) });
  assert.deepEqual(
    nomiDeiRifiuti(diSera),
    ["Carta e cartone"],
    "la sera vale quello che si mette fuori adesso",
  );
});

test("se domani non passa nessuno, la sera non si torna al bidone gia' ritirato", () => {
  const soloOggi = {
    key: "rifiuti",
    rows: [{ quando: "oggi", name: "Organico", glyph: "🥬", entity: "sensor.organico" }],
  };
  const diSera = pastiglieDellaCasa([soloOggi], {
    barra: { rifiutiDalleOre: "20" },
    adesso: alle(21),
  });
  assert.deepEqual(
    nomiDeiRifiuti(diSera),
    [],
    "rimettere in mano la cosa gia' fatta e' quello che si voleva togliere",
  );
});

test("tutti i bidoni della stessa uscita, anche la sera (#567 non si perde)", () => {
  const dueDomani = {
    key: "rifiuti",
    rows: [
      { quando: "oggi", name: "Organico", glyph: "🥬", entity: "sensor.organico" },
      { quando: "domani", name: "Vetro", glyph: "🍾", entity: "sensor.vetro" },
      { quando: "domani", name: "Plastica", glyph: "🧴", entity: "sensor.plastica" },
    ],
  };
  const diSera = pastiglieDellaCasa([dueDomani], {
    barra: { rifiutiDalleOre: "20" },
    adesso: alle(22),
  });
  assert.deepEqual(nomiDeiRifiuti(diSera), ["Vetro", "Plastica"]);
});

test("la sezione porta l'orologio al nucleo, e la scelta arriva dalla casella", () => {
  const sezione = readFileSync(
    new URL("../src/sections/come-sta-la-casa-section.js", import.meta.url),
    "utf8",
  );
  /* Il nucleo non guarda l'orologio da solo: glielo porta chi disegna. */
  assert.match(sezione, /adesso: new Date\(\),/);
  /* E la casella finisce nella configurazione passando dall'unico normalizzatore. */
  assert.match(sezione, /data-dm-casa-ritiro/);
  assert.match(
    sezione,
    /normalizzaBarra\(\{ voci, posta, rifiutiDalleOre, \.\.\.misure \}\)/,
  );
});
