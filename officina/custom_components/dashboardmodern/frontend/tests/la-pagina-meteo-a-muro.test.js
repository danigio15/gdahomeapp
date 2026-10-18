/* La pagina Meteo della plancia a muro.
 *
 * «La sezione meteo della plancia su un tablet grande e' bella: la vorrei a
 * muro come pagina intera.» Qui si tengono ferme le scelte del modello: il
 * tipo di pagina c'e' e sopravvive alla pulizia, nasce senza niente da
 * configurare, il meteo e' quello che il tablet mostra gia' in alto, e le
 * previsioni diventano le dodici ore e i sette giorni della pagina. */
import assert from "node:assert/strict";
import test from "node:test";
import {
  GIORNI_DEL_METEO,
  MODELLI,
  ORE_DEL_METEO,
  POSTI,
  entitaDelMeteoDelMuro,
  meteoDelMuro,
  muroPulito,
  nuovaPagina,
  paginaPulita,
} from "../src/core/plancia-a-muro.js";

const H = 3_600_000;

test("il tipo di pagina Meteo c'e', e resta Meteo dopo la pulizia", () => {
  assert.ok(MODELLI.includes("meteo"));
  const pagina = paginaPulita({ id: "tempo", modello: "meteo", titolo: "Fuori" });
  assert.equal(pagina.modello, "meteo");
  assert.equal(pagina.titolo, "Fuori");
  const muro = muroPulito({ attiva: true, pagine: [{ modello: "meteo" }, { modello: "scene" }] });
  assert.deepEqual(
    muro.pagine.map((p) => p.modello),
    ["meteo", "scene"],
  );
});

test("una pagina Meteo nuova nasce senza niente da scegliere", () => {
  const pagina = nuovaPagina("meteo", { stanze: [{ name: "Soggiorno" }] });
  assert.equal(pagina.modello, "meteo");
  /* Il titolo, il disegno e il colore vuoti: quelli del tipo di pagina. */
  assert.equal(pagina.titolo, "");
  assert.equal(pagina.disegno, "");
  assert.equal(pagina.colore, "");
  /* Niente stanza, niente posti: il meteo e' quello del tablet. */
  assert.equal(pagina.stanza, "");
  assert.deepEqual(pagina.comandi, []);
  assert.equal(pagina.griglia, POSTI);
});

test("il meteo della pagina e' quello del tablet: muro, poi plancia, poi weather.home", () => {
  const stati = {
    "weather.altro": { state: "sunny" },
    "weather.home": { state: "cloudy" },
    "weather.config": { state: "rainy" },
    "weather.muro": { state: "fog" },
  };
  assert.equal(
    entitaDelMeteoDelMuro({ meteo: "weather.muro" }, { meteo: "weather.config" }, stati),
    "weather.muro",
  );
  assert.equal(entitaDelMeteoDelMuro({ meteo: "" }, { meteo: "weather.config" }, stati), "weather.config");
  /* Uno scelto che non c'e' piu' non lascia la pagina vuota. */
  assert.equal(entitaDelMeteoDelMuro({ meteo: "weather.sparito" }, {}, stati), "weather.home");
  assert.equal(entitaDelMeteoDelMuro({}, {}, { "weather.altro": { state: "sunny" } }), "weather.altro");
  /* Nessun meteo in Home Assistant: vuoto, e la pagina lo dice. */
  assert.equal(entitaDelMeteoDelMuro({}, {}, { "sensor.x": { state: "1" } }), "");
  assert.equal(entitaDelMeteoDelMuro(null, null, null), "");
});

test("la pagina Meteo legge adesso, dodici ore e sette giorni", () => {
  const adesso = new Date(2026, 9, 18, 10, 20).getTime();
  const ora = Math.floor(adesso / H) * H;
  const orarie = Array.from({ length: 30 }, (_, i) => ({
    datetime: new Date(ora + i * H).toISOString(),
    condition: i >= 5 && i <= 8 ? "rainy" : "partlycloudy",
    temperature: 17 + Math.sin(i / 4) * 3,
    precipitation_probability: i >= 5 && i <= 8 ? 70 : 10,
    precipitation: i >= 5 && i <= 8 ? 0.6 : 0,
  }));
  const mezzanotte = new Date(adesso);
  mezzanotte.setHours(0, 0, 0, 0);
  const giornaliere = Array.from({ length: 9 }, (_, i) => {
    const giorno = new Date(mezzanotte);
    giorno.setDate(giorno.getDate() + i);
    return {
      datetime: giorno.toISOString(),
      condition: i === 1 ? "rainy" : "sunny",
      temperature: 21 + i,
      templow: 11 + (i % 3),
      precipitation_probability: i === 1 ? 80 : 0,
    };
  });
  const stato = {
    state: "partlycloudy",
    attributes: {
      temperature: 18.4,
      apparent_temperature: 17.6,
      humidity: 64,
      pressure: 1014,
      pressure_unit: "hPa",
      wind_speed: 12,
      wind_speed_unit: "km/h",
      wind_bearing: 225,
      temperature_unit: "°C",
    },
  };
  const v = meteoDelMuro(stato, { orarie, giornaliere, adesso });
  assert.equal(v.condizione, "partlycloudy");
  assert.equal(v.disponibile, true);
  assert.equal(v.misure.temperatura.valore, 18.4);
  assert.equal(v.misure.percepita.valore, 17.6);
  assert.equal(v.misure.umidita.valore, 64);
  assert.deepEqual(
    [v.misure.pressione.valore, v.misure.pressione.unita],
    [1014, "hPa"],
  );
  assert.deepEqual([v.misure.vento.valore, v.misure.vento.unita], [12, "km/h"]);
  /* 225° e' sud-ovest: il sesto spicchio della rosa. */
  assert.equal(v.spicchio, 5);
  assert.equal(v.ore.length, ORE_DEL_METEO);
  assert.equal(v.ore[0].quando, ora);
  assert.equal(v.giorni.length, GIORNI_DEL_METEO);
  assert.equal(v.giorni[0].oggi, true);
  assert.deepEqual(v.oggi, { alta: 21, bassa: 11 });
  assert.equal(v.frase.tipo, "arriva");
  assert.equal(v.frase.quando, ora + 5 * H);
});

test("senza previsioni la pagina ha adesso, e senza meteo non ha niente", () => {
  const v = meteoDelMuro({ state: "unavailable", attributes: {} });
  assert.equal(v.disponibile, false);
  assert.deepEqual(v.ore, []);
  assert.deepEqual(v.giorni, []);
  assert.equal(v.oggi, null);
  assert.equal(v.frase, null);
  assert.equal(v.spicchio, null);
  assert.equal(meteoDelMuro(null), null);
});
