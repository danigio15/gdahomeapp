/* Le piante di casa: la terra, e quando innaffiare (#159).
 *
 * «Impostando una soglia minima ti avverte quando è ora di innaffiare, oppure
 * anche se è ora di innaffiare ma è prevista pioggia a breve eviti di farlo.»
 *
 * Qui si tiene ferma la parte che si prova a tavolino: quali sensori sono
 * della terra, la temperatura che sta accanto, la soglia, la pioggia che
 * conta solo per chi sta fuori, l'ultima innaffiata e i giorni che restano.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  CAMPI_IN_PIU,
  PIOGGIA_CHE_BASTA_MM,
  comeStaLaPianta,
  comeStannoLePiante,
  domandaDellaTerra,
  domandaDellePrevisioni,
  eUnaPianta,
  giorniAllaSete,
  letturaDellaPianta,
  pianteConfigurate,
  pianteDaImportare,
  pioggiaInArrivo,
  previsioniDallaRisposta,
  serieDellaTerra,
  temperaturaAccanto,
  ultimaAcqua,
} from "../src/core/le-piante-di-casa.js";
import { giorniAllaSoglia } from "../src/core/giorni-alla-soglia.js";

const ADESSO = new Date(2026, 8, 28, 10, 0, 0).getTime();
const H = 3600000;

const sensore = (valore, unita, attributi = {}) => ({
  state: String(valore),
  last_changed: new Date(ADESSO - 5 * 60000).toISOString(),
  attributes: { unit_of_measurement: unita, ...attributi },
});

/* ── cosa è un sensore della terra ──────────────────────────────────────── */

test("un sensore della terra ha la classe moisture, o lo dice il nome", () => {
  assert.equal(
    eUnaPianta("sensor.soil_moisture_1", sensore(38, "%", { device_class: "moisture" })),
    true,
  );
  /* Qualche Tuya scrive la classe dell'aria: conta solo se il nome dice terra. */
  assert.equal(
    eUnaPianta("sensor.umidita_terreno_orto", sensore(40, "%", { device_class: "humidity" })),
    true,
  );
  assert.equal(
    eUnaPianta("sensor.umidita_soggiorno", sensore(55, "%", { device_class: "humidity" })),
    false,
  );
  /* La sonda di allagamento e il sensore della pioggia sono binari: no. */
  assert.equal(
    eUnaPianta("binary_sensor.pioggia", { state: "off", attributes: { device_class: "moisture" } }),
    false,
  );
  /* Senza percento non è un'umidità. */
  assert.equal(eUnaPianta("sensor.soil_ec_1", sensore(820, "µS/cm")), false);
});

test("la temperatura della stessa pianta si trova togliendo la parola che cambia", () => {
  const states = {
    "sensor.soil_moisture_1": sensore(38, "%", { device_class: "moisture" }),
    "sensor.soil_temperature_1": sensore(19.4, "°C", { device_class: "temperature" }),
    "sensor.soil_temperature_2": sensore(21, "°C", { device_class: "temperature" }),
    "sensor.ficus_moisture": sensore(40, "%", { device_class: "moisture" }),
    "sensor.ficus_temperature": sensore(22, "°C", { device_class: "temperature" }),
  };
  assert.equal(temperaturaAccanto("sensor.soil_moisture_1", states), "sensor.soil_temperature_1");
  assert.equal(temperaturaAccanto("sensor.ficus_moisture", states), "sensor.ficus_temperature");
  const importate = pianteDaImportare(states, undefined, (entity) => entity);
  assert.deepEqual(
    importate.map((riga) => [riga.entity, riga.temperatura, riga.icon]),
    [
      ["sensor.ficus_moisture", "sensor.ficus_temperature", "plant"],
      ["sensor.soil_moisture_1", "sensor.soil_temperature_1", "plant"],
    ],
  );
});

test("la sezione nasce vuota, e i campi in più passano per nome", () => {
  assert.equal(pianteConfigurate(undefined), false);
  assert.equal(pianteConfigurate({ righe: [] }), false);
  assert.equal(pianteConfigurate({ righe: [{ entity: "sensor.soil_moisture_1" }] }), true);
  assert.deepEqual(CAMPI_IN_PIU, ["temperatura", "minimo", "massimo", "fuori"]);
});

test("una riga letta: la forcella di serie, e «fuori» come lo salva una spunta", () => {
  const states = { "sensor.orto": sensore(18, "%"), "sensor.orto_t": sensore(19.4, "°C") };
  const letta = letturaDellaPianta(
    { entity: "sensor.orto", name: "Orto", temperatura: "sensor.orto_t", fuori: "true" },
    states,
  );
  assert.equal(letta.umidita, 18);
  assert.equal(letta.gradi, 19.4);
  assert.equal(letta.minimo, 25);
  assert.equal(letta.massimo, 70);
  assert.equal(letta.fuori, true);
  /* Una forcella scritta al contrario non diventa una forcella vuota. */
  const storta = letturaDellaPianta({ entity: "sensor.orto", minimo: "40", massimo: "30" }, states);
  assert.ok(storta.massimo > storta.minimo);
  /* Chi non risponde è muta, non asciutta. */
  assert.equal(
    letturaDellaPianta({ entity: "sensor.x" }, { "sensor.x": { state: "unavailable" } }).muta,
    true,
  );
});

/* ── la pioggia ─────────────────────────────────────────────────────────── */

const ORARIE = [0, 1, 2, 3, 4, 5, 6].map((ora) => ({
  datetime: new Date(ADESSO + ora * H).toISOString(),
  precipitation: ora >= 4 ? 2.5 : 0,
  precipitation_probability: ora >= 4 ? 80 : 10,
}));

test("la pioggia per ora: quanta, e fra quanto comincia", () => {
  const pioggia = pioggiaInArrivo(ORARIE, { adesso: ADESSO });
  assert.equal(pioggia.fra, 4);
  assert.equal(pioggia.mm, 7.5);
  assert.equal(pioggia.giornaliera, false);
  /* Una pioggia poco probabile non si aspetta. */
  const incerta = ORARIE.map((voce) => ({ ...voce, precipitation_probability: 20 }));
  assert.equal(pioggiaInArrivo(incerta, { adesso: ADESSO }), null);
  /* Chi ha scelto i pollici li ha anche nelle previsioni. */
  const pollici = ORARIE.map((voce) => ({ ...voce, precipitation: voce.precipitation / 25.4 }));
  assert.ok(Math.abs(pioggiaInArrivo(pollici, { adesso: ADESSO, unita: "in" }).mm - 7.5) < 1e-9);
});

test("la pioggia per giorno: si sa quanta oggi, non fra quanto", () => {
  const giornaliere = [0, 1, 2].map((giorno) => ({
    datetime: new Date(ADESSO + giorno * 24 * H).toISOString(),
    precipitation: giorno === 0 ? 8 : 0,
    precipitation_probability: 70,
  }));
  assert.deepEqual(pioggiaInArrivo(giornaliere, { adesso: ADESSO }), {
    mm: 8,
    fra: null,
    giornaliera: true,
  });
});

test("le domande: la terra al Recorder, le previsioni al servizio del meteo", () => {
  const terra = domandaDellaTerra(["sensor.a", "sensor.a"], ADESSO);
  assert.equal(terra.type, "recorder/statistics_during_period");
  assert.deepEqual(terra.statistic_ids, ["sensor.a"]);
  assert.deepEqual(terra.types, ["mean"]);
  const previsioni = domandaDellePrevisioni("weather.casa");
  assert.equal(previsioni.type, "call_service");
  assert.equal(previsioni.service, "get_forecasts");
  assert.deepEqual(previsioni.service_data, { type: "hourly" });
  assert.equal(previsioni.return_response, true);
  assert.deepEqual(
    previsioniDallaRisposta({ response: { "weather.casa": { forecast: ORARIE } } }, "weather.casa")
      .length,
    7,
  );
});

/* ── l'acqua data ───────────────────────────────────────────────────────── */

/* Dieci giorni di terra: innaffiata sei giorni fa, poi giù di cinque punti al
 * giorno, con il ballo di un punto fra il giorno e la notte. */
function giorniDiTerra({ dal = 6, parte = 60, alGiorno = 5 } = {}) {
  const serie = [];
  for (let ora = 240; ora >= 1; ora -= 1) {
    const quando = ADESSO - ora * H;
    const giorni = (ADESSO - quando) / (24 * H);
    const valore =
      giorni > dal ? 20 : parte - (dal - giorni) * alGiorno + (ora % 24 < 12 ? 0.8 : -0.8);
    serie.push({ start: quando, mean: valore });
  }
  return serieDellaTerra({ "sensor.orto": serie }, "sensor.orto");
}

test("l'ultima innaffiata è il salto dell'umidità, non il ballo fra giorno e notte", () => {
  const serie = giorniDiTerra();
  const quando = ultimaAcqua(serie);
  assert.ok(Math.abs((ADESSO - quando) / (24 * H) - 6) < 0.1, "sei giorni fa");
  /* Senza salti non c'è un'innaffiata da raccontare. */
  assert.equal(ultimaAcqua(serie.filter((punto) => punto.quando > quando)), null);
});

test("l'innaffiata è il primo punto della salita, non l'ora dopo", () => {
  const ore = (...valori) =>
    valori.map((valore, i) => ({ quando: ADESSO - (valori.length - i) * H, valore }));
  /* Di colpo: l'ora dopo guarda ancora la terra asciutta di due ore prima. */
  const secca = ore(22, 20, 61, 60, 59);
  assert.equal(ultimaAcqua(secca), secca[2].quando);
  /* Piano, dal sottovaso: la salita passa il salto alla seconda ora. */
  const lenta = ore(20, 20, 26, 36, 35, 34);
  assert.equal(ultimaAcqua(lenta), lenta[3].quando);
});

test("i giorni che restano prima della sete, al passo di adesso", () => {
  const serie = giorniDiTerra({ dal: 2, parte: 60, alGiorno: 5 });
  const lettura = { umidita: 50, minimo: 25, da: ADESSO - 60000 };
  /* Da 50 a 25 a cinque punti al giorno: cinque giorni. */
  const giorni = giorniAllaSete(serie, lettura);
  assert.ok(giorni === 4 || giorni === 5, `cinque giorni, o quasi: ${giorni}`);
  /* Appena innaffiata non c'è ancora un passo: niente numero inventato. */
  assert.equal(giorniAllaSete(serie.slice(-6), lettura), null);
  /* E la regola è quella del sale, scritta una volta sola. */
  assert.equal(giorniAllaSoglia([], { soglia: 10 }), null);
});

/* ── come stanno ────────────────────────────────────────────────────────── */

test("asciutta è asciutta; all'aperto con la pioggia in arrivo, aspetta", () => {
  const states = { "sensor.a": sensore(18, "%") };
  const dentro = letturaDellaPianta({ entity: "sensor.a", name: "Ficus" }, states);
  const fuori = letturaDellaPianta({ entity: "sensor.a", name: "Orto", fuori: true }, states);
  const pioggia = { mm: 8, fra: 4, giornaliera: false };
  /* Il salotto la pioggia non lo raggiunge. */
  assert.equal(comeStaLaPianta(dentro, { pioggia }).stato, "asciutta");
  assert.equal(comeStaLaPianta(fuori, { pioggia }).stato, "aspetta");
  /* Due gocce non innaffiano. */
  assert.equal(
    comeStaLaPianta(fuori, { pioggia: { mm: PIOGGIA_CHE_BASTA_MM - 1, fra: 2 } }).stato,
    "asciutta",
  );
  /* Senza previsioni non si aspetta niente. */
  assert.equal(comeStaLaPianta(fuori, {}).stato, "asciutta");
});

test("tutte insieme: prima le asciutte, poi chi aspetta, chi non risponde, e chi sta bene", () => {
  const states = {
    "sensor.monstera": sensore(54, "%"),
    "sensor.orto": sensore(20, "%"),
    "sensor.ficus": sensore(18, "%"),
    "sensor.muto": { state: "unavailable", attributes: {} },
  };
  const letture = [
    letturaDellaPianta({ entity: "sensor.monstera", name: "Monstera" }, states),
    letturaDellaPianta({ entity: "sensor.orto", name: "Orto sul balcone", fuori: true }, states),
    letturaDellaPianta({ entity: "sensor.muto", name: "Basilico" }, states),
    letturaDellaPianta({ entity: "sensor.ficus", name: "Ficus del salotto" }, states),
  ];
  const come = comeStannoLePiante(letture, { pioggia: { mm: 8, fra: 4, giornaliera: false } });
  assert.deepEqual(
    come.piante.map((pianta) => [pianta.lettura.name, pianta.stato]),
    [
      ["Ficus del salotto", "asciutta"],
      ["Orto sul balcone", "aspetta"],
      ["Basilico", "muta"],
      ["Monstera", "bene"],
    ],
  );
  assert.equal(come.stato, "sete");
  assert.equal(come.daInnaffiare.length, 1);
  /* Senza la sete, è la pioggia a dire cosa succede. */
  const senzaFicus = comeStannoLePiante(
    letture.filter((l) => l.name !== "Ficus del salotto"),
    {
      pioggia: { mm: 8, fra: 4 },
    },
  );
  assert.equal(senzaFicus.stato, "pioggia");
});
