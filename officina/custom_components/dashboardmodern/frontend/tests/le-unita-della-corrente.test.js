/* «Quando sono 1000 W devi poi esporli in kWh [kW]; quando si arriva a 1000 kWh
 *  devi mettere 1 MWh. Usa le unità di misura corrette.»
 *
 * Con la foto della pagina Energia: le bolle dicevano «6011 W», «5251 W»,
 * «5095 W», «1211 W». Watt veri, ma non è come si scrive una potenza — e
 * quattro cifre in un cerchio si contano invece di leggerle.
 *
 * Qui si tiene ferma la regola, che adesso sta in un posto solo e la usano
 * tutti: le bolle del flusso, l'analisi, le finestre dei carichi e le tessere
 * degli elettrodomestici.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  IL_SALTO,
  SCALA_ENERGIA,
  SCALA_POTENZA,
  conLUnitaGiusta,
  iDecimaliDellaScala,
  inScala,
  lEnergiaInParole,
  laPotenzaInParole,
} from "../src/core/le-unita-della-corrente.js";

test("il salto è a mille, e le due scale arrivano fino al giga", () => {
  assert.equal(IL_SALTO, 1000);
  assert.deepEqual([...SCALA_POTENZA], ["W", "kW", "MW", "GW"]);
  assert.deepEqual([...SCALA_ENERGIA], ["Wh", "kWh", "MWh", "GWh"]);
});

test("i watt salgono al chilowatt al migliaio, e al megawatt al milione", () => {
  /* I numeri della foto. */
  assert.equal(laPotenzaInParole(114), "114 W");
  assert.equal(laPotenzaInParole(1211), "1,21 kW");
  assert.equal(laPotenzaInParole(5095), "5,10 kW");
  assert.equal(laPotenzaInParole(5251), "5,25 kW");
  assert.equal(laPotenzaInParole(6011), "6,01 kW");

  /* Il gradino, preciso. */
  assert.equal(laPotenzaInParole(999), "999 W");
  assert.equal(laPotenzaInParole(1000), "1,00 kW");
  assert.equal(laPotenzaInParole(1000000), "1,00 MW");

  /* Lo zero non sale: «0,00 kW» sarebbe un modo pomposo di dire niente. */
  assert.equal(laPotenzaInParole(0), "0 W");
});

test("si sale guardando il numero come si vedrà, non come arriva", () => {
  /* 999,6 W coi watt interi si scriverebbe «1000 W», ed è proprio la scritta
   * che non si vuole vedere: si arrotonda prima, e poi si sale. */
  assert.equal(laPotenzaInParole(999.4), "999 W");
  assert.equal(laPotenzaInParole(999.6), "1,00 kW");
  /* E un gradino sopra vale lo stesso: 999.600 W sono 999,6 kW, che scritti
   * interi sarebbero «1000 kW». */
  assert.equal(laPotenzaInParole(999600), "1,00 MW");
  assert.equal(laPotenzaInParole(999999), "1,00 MW");
});

test("tre cifre che contano, sopra il primo gradino", () => {
  assert.equal(iDecimaliDellaScala(6.011), 2);
  assert.equal(iDecimaliDellaScala(12.345), 1);
  assert.equal(iDecimaliDellaScala(123.45), 0);
  assert.equal(laPotenzaInParole(12345), "12,3 kW");
  assert.equal(laPotenzaInParole(123456), "123 kW");
  assert.equal(laPotenzaInParole(1234567), "1,23 MW");
});

test("il segno resta: una batteria che si carica è un numero negativo", () => {
  assert.equal(laPotenzaInParole(-1500), "-1,50 kW");
  assert.equal(laPotenzaInParole(-800), "-800 W");
});

test("i chilowattora salgono al megawattora, e non scendono mai al wattora", () => {
  /* Mezzo chilowattora resta in kWh: «450 Wh» di un consumo giornaliero non
   * lo scrive nessuno, ed è l'unità in cui è scritta la bolletta. */
  assert.equal(lEnergiaInParole(0.45), "0,5 kWh");
  assert.equal(lEnergiaInParole(12.3), "12,3 kWh");
  assert.equal(lEnergiaInParole(999), "999,0 kWh");
  assert.equal(lEnergiaInParole(1000), "1,00 MWh");
  assert.equal(lEnergiaInParole(12345), "12,3 MWh");
  assert.equal(lEnergiaInParole(1234567), "1,23 GWh");
});

test("i decimali del primo gradino li decide chi scrive", () => {
  /* Una potenza istantanea si legge intera, un consumo di giornata col
   * decimo: sono due grandezze diverse e chi chiama sa quale sta scrivendo.
   * Sopra il gradino comandano le tre cifre, e il conto di chi chiama sparisce
   * — se no «6,0114 kW». */
  assert.equal(laPotenzaInParole(4.5, { decimali: 1 }), "4,5 W");
  assert.equal(laPotenzaInParole(4.5), "5 W");
  assert.equal(laPotenzaInParole(6011, { decimali: 1 }), "6,01 kW");
});

test("la lingua arriva da fuori: una finestra inglese non scrive la virgola", () => {
  assert.equal(laPotenzaInParole(6011, { lingua: "en-US" }), "6.01 kW");
  assert.equal(lEnergiaInParole(1234.5, { lingua: "en-US" }), "1.23 MWh");
});

test("quello che non è un numero non diventa un'unità", () => {
  assert.equal(laPotenzaInParole(null), "—");
  assert.equal(laPotenzaInParole(undefined), "—");
  assert.equal(laPotenzaInParole("non un numero"), "—");
  assert.equal(laPotenzaInParole(Number.POSITIVE_INFINITY), "—");
  assert.equal(laPotenzaInParole(null, { vuoto: "" }), "");
  assert.equal(inScala("non un numero"), null);
});

test("un'unità che la scala non conosce resta dov'è", () => {
  /* Non si inventa un multiplo di qualcosa che non si è capito. */
  const fermo = inScala(5000, SCALA_POTENZA, "cavalli");
  assert.deepEqual(fermo, { valore: 5000, unita: "cavalli", passo: 0, saliti: 0 });
  assert.equal(conLUnitaGiusta(5000, { da: "cavalli" }), "5000 cavalli");
});

test("inScala dice quanti gradini ha fatto, non a che altezza è", () => {
  /* L'energia parte già dal secondo gradino — i contatori parlano in kWh — e
   * guardare l'altezza diceva «è salita» a un numero che non si era mosso:
   * 999,9 kWh usciva «1000 kWh», arrotondato coi decimali di chi cambia
   * unità. */
  const ferma = inScala(999.9, SCALA_ENERGIA, "kWh");
  assert.equal(ferma.saliti, 0);
  assert.equal(ferma.passo, 1);
  assert.equal(lEnergiaInParole(999.9), "999,9 kWh");

  const salita = inScala(2500, SCALA_ENERGIA, "kWh");
  assert.equal(salita.saliti, 1);
  assert.equal(salita.unita, "MWh");
});
