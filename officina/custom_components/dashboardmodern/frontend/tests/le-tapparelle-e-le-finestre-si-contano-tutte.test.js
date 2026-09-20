/* «Il widget finestre è troppo equivoco» (#64).
 *
 * «Ho provato ad associare oltre che alla tapparella anche il sensore finestra
 *  della stessa, ma facendo cosi' il widget mostra solo 1, ma ci sono 4
 *  tapparelle aperte e 1 sensore della finestra aperto: dovrebbe mostrare
 *  entrambi, tipo 4 tapparelle e 1 finestra.»
 *
 * Era il prezzo della #442 pagato dall'altra parte. Per non chiamare «finestre
 * aperte» quattro tapparelle tirate su, il numero grande aveva smesso di
 * contarle: con quattro su e una finestra aperta la tessera diceva «1», e con
 * quattro su e nessuna aperta diceva «0» sopra la scritta «4 alzate».
 *
 * Adesso dove ci sono tutte e due le cose la tessera le conta tutte e due e
 * nel nome lo dice; la pastiglia sotto il meteo, che fa una notizia e non un
 * inventario, continua a dire le finestre aperte e basta. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { contoDelleAperture } from "../src/core/cover-kind.js";

const leggi = (nome) => readFileSync(new URL(`../src/${nome}`, import.meta.url), "utf8");

const motore = (nome, open) => ({ name: nome, entity: `cover.${nome}`, open, soloSensore: false });
const contatto = (nome, open) => ({
  name: nome,
  entity: `binary_sensor.${nome}`,
  open,
  soloSensore: true,
});

test("quattro tapparelle su e una finestra aperta: la tessera conta cinque, non una", () => {
  const conto = contoDelleAperture([
    motore("t1", true),
    motore("t2", true),
    motore("t3", true),
    motore("t4", true),
    contatto("camera", true),
  ]);
  assert.equal(conto.miste, true);
  assert.equal(conto.soloMotori, false);
  assert.equal(conto.tutte.length, 5, "il numero grande dice quello che la tessera elenca");
  /* E le due cose restano due: la notizia sono le ante aperte. */
  assert.equal(conto.aperte.length, 1);
  assert.equal(conto.alzate.length, 4);
  assert.equal(conto.contate.length, 1, "la pastiglia sotto il meteo conta le finestre aperte");
});

test("quattro su e nessuna aperta: non dice piu' zero sopra «4 alzate»", () => {
  const conto = contoDelleAperture([
    motore("t1", true),
    motore("t2", true),
    motore("t3", true),
    motore("t4", true),
    contatto("camera", false),
  ]);
  assert.equal(conto.tutte.length, 4);
  assert.equal(conto.contate.length, 0, "di finestre aperte non ce n'e' nessuna, ed e' vero");
});

test("dove c'e' una cosa sola non cambia niente", () => {
  const soloTapparelle = contoDelleAperture([motore("t1", true), motore("t2", false)]);
  assert.equal(soloTapparelle.soloMotori, true);
  assert.equal(soloTapparelle.miste, false);
  assert.deepEqual(soloTapparelle.tutte, soloTapparelle.alzate);

  const soloFinestre = contoDelleAperture([contatto("c1", true), contatto("c2", false)]);
  assert.equal(soloFinestre.soloMotori, false);
  assert.equal(soloFinestre.miste, false);
  assert.deepEqual(soloFinestre.tutte, soloFinestre.aperte);
  assert.deepEqual(soloFinestre.tutte, soloFinestre.contate);
});

test("la tessera si chiama come quello che conta, e la pastiglia resta la notizia", () => {
  const sorgente = leggi("sections/home-widgets-section.js");
  const tessera = sorgente.slice(sorgente.indexOf('key: "tapparelle",'));
  const corpo = tessera.slice(0, tessera.indexOf("\n  };\n"));
  assert.match(corpo, /miste\s*\?\s*t\("Finestre e tapparelle", "Windows and shutters"\)/);
  assert.match(corpo, /value: String\(tutte\.length\)/);
  /* `open` non si tocca: e' il campo che legge la fascia sotto il meteo, e
   * li' una tapparella alzata non e' una finestra aperta (#442). */
  assert.match(corpo, /\n\s+open: contate,/);
  assert.match(corpo, /aperteEAlzate: tutte,/);
});
