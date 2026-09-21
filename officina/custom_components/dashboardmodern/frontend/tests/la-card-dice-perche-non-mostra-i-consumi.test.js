/* Chi mappa la potenza sbagliata lo viene a sapere dove l'ha mappata (#47).
 *
 * «Gli elettrodomestici non mostrano i consumi. Effettuata integrazione in
 * smarthings di samsung ma niente.» La card mostra i watt, e per mostrarli
 * pretende un sensore che li dichiari: W, kW o mW. Qualunque altra unità
 * veniva scartata senza una parola — `powerEntity` restava vuota, la card
 * muta — e la configurazione sembrava giusta a chi l'aveva fatta.
 *
 * Il caso vero è quasi sempre lo stesso: l'integrazione porta i kWh, che sono
 * un contatore («quanto ha consumato in tutto») e non una potenza («quanto
 * assorbe adesso»). Sono due domande diverse e due campi diversi. Qui si
 * tiene fermo che l'editor lo dica, che dica anche dove va quel sensore, e
 * che non dica niente quando non c'è niente da dire.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { percheLaPotenzaNonSiLegge } from "../src/sections/appliance-editor-section.js";

const source = await readFile(
  new URL("../src/sections/appliance-editor-section.js", import.meta.url),
  "utf8",
);
const sorgenteDellaCard = await readFile(
  new URL("../src/core/appliance-view-model.js", import.meta.url),
  "utf8",
);

const conUnita = (misura) => ({ attributes: { unit_of_measurement: misura } });

const CASA = {
  "sensor.forno_potenza": conUnita("W"),
  "sensor.forno_potenza_kw": conUnita("kW"),
  "sensor.forno_potenza_spaziata": conUnita(" w "),
  "sensor.tv_energia": conUnita("kWh"),
  "sensor.tv_energia_wh": conUnita("Wh"),
  "sensor.tv_temperatura": conUnita("°C"),
  "sensor.tv_stato": conUnita(""),
};

test("un sensore in watt non ha niente da farsi dire", () => {
  for (const buono of [
    "sensor.forno_potenza",
    "sensor.forno_potenza_kw",
    "sensor.forno_potenza_spaziata",
  ])
    assert.equal(percheLaPotenzaNonSiLegge(buono, CASA), "", buono);
});

test("il campo vuoto non è un errore", () => {
  assert.equal(percheLaPotenzaNonSiLegge("", CASA), "");
  assert.equal(percheLaPotenzaNonSiLegge(null, CASA), "");
  assert.equal(percheLaPotenzaNonSiLegge("   ", CASA), "");
});

test("i kWh dicono di essere un contatore, e dicono dove vanno", () => {
  for (const energia of ["sensor.tv_energia", "sensor.tv_energia_wh"]) {
    const motivo = percheLaPotenzaNonSiLegge(energia, CASA);
    assert.match(motivo, /contatore di energia/, energia);
    /* Non basta dire di no: deve dire dove va, o la card resta vuota
     * uguale. */
    assert.match(motivo, /Energia totale/, energia);
  }
});

test("un'altra unità viene detta per nome", () => {
  const motivo = percheLaPotenzaNonSiLegge("sensor.tv_temperatura", CASA);
  assert.match(motivo, /°C/);
  assert.match(motivo, /W o kW/);
});

test("un sensore senza unità, e un'entità che non c'è", () => {
  assert.match(percheLaPotenzaNonSiLegge("sensor.tv_stato", CASA), /non dichiara un'unità/);
  assert.match(percheLaPotenzaNonSiLegge("sensor.inventato", CASA), /non risulta in questa casa/);
});

test("le unità che la card accetta sono le stesse che l'editor accetta", () => {
  /* Due elenchi che devono restare uguali: se la card ne accetta una in più,
   * l'editor la segnerebbe come sbagliata mentre funziona. */
  const dallaCard =
    sorgenteDellaCard.match(/\/\^\(([a-z|]+)\)\$\/\.test\(unit\(states, id\)\.replaceAll/)?.[1] ||
    "";
  assert.equal(dallaCard, "w|kw|mw|watt|watts");
  for (const misura of dallaCard.split("|"))
    assert.equal(
      percheLaPotenzaNonSiLegge("sensor.prova", { "sensor.prova": conUnita(misura) }),
      "",
      misura,
    );
});

test("l'avviso è cablato al campo e si aggiorna da solo", () => {
  /* Disegnato sotto «Potenza istantanea», non altrove. */
  assert.match(source, /data-dm-power-warning/);
  assert.ok(
    source.includes('entityField("power_entity"') &&
      source.indexOf("data-dm-power-warning") > source.indexOf('entityField("power_entity"'),
  );
  /* E vivo: si scrive a mano e si sceglie con la lente, e la lente manda un
   * `change` (#70). Servono tutti e due gli ascolti. */
  assert.match(source, /powerField\.addEventListener\("input", ridiLAvviso\)/);
  assert.match(source, /powerField\.addEventListener\("change", ridiLAvviso\)/);
  /* Con il suo stile, e nascosto quando non ha niente da dire. */
  assert.match(source, /\.dm-appliance-power-warning\[hidden\]\{display:none!important\}/);
});
