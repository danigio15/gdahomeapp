/* La pagina Meteo (#206), la parte che si prova a tavolino.
 *
 * Qui si tiene ferma la parte che non ha bisogno di una casa vera: quali
 * sensori sono di una stazione meteo, la tendenza della pressione nelle
 * ultime tre ore, il punto di rugiada, la frase sulle prossime ore, la
 * pioggia ora per ora da un contatore che si azzera a mezzanotte, i blocchi
 * che la pagina mostra, e le misure di adesso — dalla stazione quando c'è,
 * dall'entità weather quando no.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  BLOCCHI,
  blocchiDellaPagina,
  domandaDelleUltimeOre,
  fasciaUV,
  fraseDelleProssimeOre,
  gradiDelVento,
  inEttopascal,
  minimoEMassimo,
  misureDiAdesso,
  normalizzaMeteo,
  pioggiaOraPerOra,
  prossimeOre,
  prossimiGiorni,
  puntoDiRugiada,
  serieAPassoFisso,
  serieDallaStoria,
  spicchioDelVento,
  spostaIlBlocco,
  tendenzaDellaPressione,
  trovaLaStazione,
} from "../src/core/la-pagina-meteo.js";

const leggi = (percorso) => readFileSync(new URL(percorso, import.meta.url), "utf8");

const H = 3600000;
const ADESSO = new Date(2026, 9, 16, 17, 20, 0).getTime();

const sensore = (state, attributi = {}) => ({ state: String(state), attributes: attributi });

/* ── i blocchi ──────────────────────────────────────────────────────────── */

test("l'ordine dei blocchi tiene tutti e cinque una volta sola, e butta quelli che non conosce", () => {
  assert.deepEqual(normalizzaMeteo({}).ordine, [...BLOCCHI]);
  const scelta = normalizzaMeteo({ ordine: ["radar", "radar", "boh", "adesso"], spenti: ["ore", "ore", "x"] });
  assert.deepEqual(scelta.ordine, ["radar", "adesso", "stazione", "ore", "giorni"]);
  assert.deepEqual(scelta.spenti, ["ore"]);
  /* Un sensore scritto male non e' un sensore. */
  assert.equal(normalizzaMeteo({ pressione: "niente" }).pressione, "");
  assert.equal(normalizzaMeteo({ pressione: " sensor.p " }).pressione, "sensor.p");
});

test("un blocco si sposta di un posto, e ai bordi resta dov'e'", () => {
  assert.deepEqual(spostaIlBlocco(BLOCCHI, "ore", -1), ["adesso", "ore", "stazione", "giorni", "radar"]);
  assert.deepEqual(spostaIlBlocco(BLOCCHI, "adesso", -1), [...BLOCCHI]);
  assert.deepEqual(spostaIlBlocco(BLOCCHI, "radar", 1), [...BLOCCHI]);
});

test("un blocco senza dati non compare, e senza stazione non c'e' nessun invito al Config", () => {
  const tutto = { adesso: true, stazione: true, ore: true, giorni: true, radar: true };
  assert.deepEqual(blocchiDellaPagina({}, tutto), [...BLOCCHI]);
  /* Anche chi potrebbe configurare non vede piu' «Hai una stazione meteo?»:
   * le sezioni non rimandano al Config. */
  assert.deepEqual(blocchiDellaPagina({}, { ...tutto, stazione: false, invito: true }), [
    "adesso",
    "ore",
    "giorni",
    "radar",
  ]);
  assert.deepEqual(blocchiDellaPagina({}, { ...tutto, stazione: false, invito: false, radar: false }), [
    "adesso",
    "ore",
    "giorni",
  ]);
  /* Spento e' spento, anche se i dati ci sono. */
  assert.deepEqual(blocchiDellaPagina({ spenti: ["giorni"], ordine: ["radar"] }, tutto), [
    "radar",
    "adesso",
    "stazione",
    "ore",
  ]);
});

/* ── i sensori della stazione ───────────────────────────────────────────── */

const STATI_DI_UNA_CASA = {
  "weather.casa": sensore("sunny"),
  "sensor.gw1100a_outdoor_temperature": sensore(18.4, { device_class: "temperature", unit_of_measurement: "°C" }),
  "sensor.gw1100a_humidity": sensore(66, { device_class: "humidity", unit_of_measurement: "%" }),
  "sensor.gw1100a_feels_like_temperature": sensore(17.6, { device_class: "temperature", unit_of_measurement: "°C" }),
  "sensor.gw1100a_relative_pressure": sensore(1009, { device_class: "atmospheric_pressure", unit_of_measurement: "hPa" }),
  "sensor.gw1100a_absolute_pressure": sensore(1001, { device_class: "atmospheric_pressure", unit_of_measurement: "hPa" }),
  "sensor.gw1100a_wind_speed": sensore(14, { device_class: "wind_speed", unit_of_measurement: "km/h" }),
  "sensor.gw1100a_wind_gust": sensore(31, { device_class: "wind_speed", unit_of_measurement: "km/h" }),
  "sensor.gw1100a_wind_direction": sensore(225, { unit_of_measurement: "°" }),
  "sensor.gw1100a_daily_rain": sensore(2.8, { device_class: "precipitation", unit_of_measurement: "mm" }),
  "sensor.gw1100a_weekly_rain": sensore(9, { device_class: "precipitation", unit_of_measurement: "mm" }),
  "sensor.gw1100a_rain_rate": sensore(0, { device_class: "precipitation_intensity", unit_of_measurement: "mm/h" }),
  "sensor.gw1100a_uv_index": sensore(3, { unit_of_measurement: "UV index" }),
  "sensor.gw1100a_solar_radiation": sensore(312, { device_class: "irradiance", unit_of_measurement: "W/m²" }),
  "sensor.gw1100a_solar_lux": sensore(41000, { device_class: "illuminance", unit_of_measurement: "lx" }),
  /* La casa, che la stazione non e'. */
  "sensor.soggiorno_temperatura": sensore(21, { device_class: "temperature", unit_of_measurement: "°C" }),
  "sensor.bagno_umidita": sensore(70, { device_class: "humidity", unit_of_measurement: "%" }),
  "sensor.studio_illuminance": sensore(300, { device_class: "illuminance", unit_of_measurement: "lx" }),
  "sensor.caldaia_pressione": sensore(1.4, { device_class: "pressure", unit_of_measurement: "bar" }),
  "sensor.basilico_soil_moisture": sensore(30, { device_class: "moisture", unit_of_measurement: "%" }),
};

test("la stazione si riconosce dal device_class e dall'unita', e la casa resta fuori", () => {
  const trovate = trovaLaStazione(STATI_DI_UNA_CASA);
  assert.deepEqual(trovate, {
    temperatura: "sensor.gw1100a_outdoor_temperature",
    umidita: "sensor.gw1100a_humidity",
    percepita: "sensor.gw1100a_feels_like_temperature",
    pressione: "sensor.gw1100a_relative_pressure",
    vento: "sensor.gw1100a_wind_speed",
    raffica: "sensor.gw1100a_wind_gust",
    direzione: "sensor.gw1100a_wind_direction",
    pioggiaOggi: "sensor.gw1100a_daily_rain",
    intensita: "sensor.gw1100a_rain_rate",
    uv: "sensor.gw1100a_uv_index",
    radiazione: "sensor.gw1100a_solar_radiation",
    luminosita: "sensor.gw1100a_solar_lux",
  });
});

test("chi ha gia' scelto tiene la sua scelta, e un sensore preso non si propone due volte", () => {
  const trovate = trovaLaStazione(STATI_DI_UNA_CASA, {
    temperatura: "sensor.soggiorno_temperatura",
    vento: "sensor.gw1100a_wind_gust",
  });
  assert.equal(trovate.temperatura, undefined);
  assert.equal(trovate.vento, undefined);
  /* La raffica scelta come vento non torna come raffica. */
  assert.notEqual(trovate.raffica, "sensor.gw1100a_wind_gust");
});

test("senza una stazione non si inventa una temperatura esterna dal soggiorno", () => {
  const soloCasa = Object.fromEntries(
    Object.entries(STATI_DI_UNA_CASA).filter(([entity]) => !entity.includes("gw1100a")),
  );
  assert.deepEqual(trovaLaStazione(soloCasa), {});
});

/* ── le letture ─────────────────────────────────────────────────────────── */

test("la pressione si giudica in ettopascal, qualunque unita' arrivi", () => {
  assert.equal(inEttopascal(1013, "hPa"), 1013);
  assert.equal(inEttopascal(101.3, "kPa"), 1013);
  assert.ok(Math.abs(inEttopascal(29.92, "inHg") - 1013.2) < 0.1);
  assert.equal(inEttopascal("x"), null);
});

test("il punto di rugiada segue Magnus, anche in Fahrenheit", () => {
  assert.ok(Math.abs(puntoDiRugiada(18.4, 66) - 12.0) < 0.15);
  assert.ok(Math.abs(puntoDiRugiada(65.1, 66, "°F") - 53.6) < 0.3);
  assert.equal(puntoDiRugiada(20, 0), null);
  assert.equal(puntoDiRugiada(null, 50), null);
});

test("la pressione in tre ore: in calo, in aumento o stabile, e forte solo da tre ettopascal", () => {
  const serie = (prima, dopo) => [
    { quando: ADESSO - 4 * H, valore: prima },
    { quando: ADESSO - 3.2 * H, valore: prima },
    { quando: ADESSO - H, valore: (prima + dopo) / 2 },
    { quando: ADESSO, valore: dopo },
  ];
  const calo = tendenzaDellaPressione(serie(1012.2, 1009.1), { adesso: ADESSO });
  assert.equal(calo.verso, "calo");
  assert.equal(calo.forte, true);
  assert.ok(Math.abs(calo.differenzaHpa + 3.1) < 1e-9);
  assert.equal(tendenzaDellaPressione(serie(1009, 1011), { adesso: ADESSO }).verso, "aumento");
  assert.equal(tendenzaDellaPressione(serie(1009, 1011), { adesso: ADESSO }).forte, false);
  assert.equal(tendenzaDellaPressione(serie(1009, 1009.6), { adesso: ADESSO }).verso, "stabile");
  /* Una serie di mezz'ora non dice niente di tre ore. */
  assert.equal(
    tendenzaDellaPressione(
      [
        { quando: ADESSO - 0.5 * H, valore: 1015 },
        { quando: ADESSO, valore: 1009 },
      ],
      { adesso: ADESSO },
    ),
    null,
  );
  /* In pollici di mercurio il giudizio resta in ettopascal. */
  const pollici = tendenzaDellaPressione(serie(29.9, 29.8), { adesso: ADESSO, unita: "inHg" });
  assert.equal(pollici.verso, "calo");
  assert.equal(pollici.forte, true);
});

test("la storia di Home Assistant diventa una serie, e la serie una linea a passo fisso", () => {
  const risposta = {
    "sensor.t": [
      { s: "10", lu: (ADESSO - 30 * H) / 1000 },
      { s: "unavailable", lu: (ADESSO - 5 * H) / 1000 },
      { s: "12.5", lu: (ADESSO - 2 * H) / 1000 },
      { state: "14", last_updated: new Date(ADESSO - H).toISOString() },
    ],
  };
  const serie = serieDallaStoria(risposta, "sensor.t", { inizio: ADESSO - 24 * H });
  assert.deepEqual(
    serie.map((punto) => punto.valore),
    [10, 12.5, 14],
  );
  assert.equal(serie[0].quando, ADESSO - 24 * H);
  const linea = serieAPassoFisso(serie, { inizio: ADESSO - 24 * H, fine: ADESSO, punti: 5 });
  assert.deepEqual(linea, [10, 10, 10, 10, 14]);
  assert.deepEqual(serieAPassoFisso([], { inizio: 0, fine: 1 }), []);
  const estremi = minimoEMassimo(serie);
  assert.equal(estremi.minimo.valore, 10);
  assert.equal(estremi.massimo.valore, 14);
});

test("la domanda della storia chiede tutte le entita' insieme, una volta sola", () => {
  const domanda = domandaDelleUltimeOre(["sensor.b", "sensor.a", "sensor.b", ""], ADESSO);
  assert.equal(domanda.type, "history/history_during_period");
  assert.deepEqual(domanda.entity_ids, ["sensor.b", "sensor.a"]);
  assert.equal(Date.parse(domanda.end_time) - Date.parse(domanda.start_time), 24 * H);
  assert.equal(domanda.minimal_response, true);
});

test("la pioggia ora per ora da un contatore che si azzera a mezzanotte", () => {
  const ora = (quante) => Math.floor(ADESSO / H) * H - quante * H;
  const serie = [
    { quando: ora(14) + 60_000, valore: 3.0 },
    { quando: ora(13) + 60_000, valore: 4.0 },
    /* L'azzeramento: quello che segna dopo e' pioggia nuova. */
    { quando: ora(12) + 60_000, valore: 0.4 },
    { quando: ora(12) + 30 * 60_000, valore: 1.2 },
    { quando: ora(2) + 60_000, valore: 2.8 },
  ];
  const ore = pioggiaOraPerOra(serie, { adesso: ADESSO });
  assert.equal(ore.length, 24);
  assert.equal(ore[23].quando, Math.floor(ADESSO / H) * H);
  assert.ok(Math.abs(ore[23 - 13].mm - 1.0) < 1e-9);
  assert.ok(Math.abs(ore[23 - 12].mm - 1.2) < 1e-9);
  assert.ok(Math.abs(ore[23 - 2].mm - 1.6) < 1e-9);
  /* In pollici si conta in millimetri. */
  const pollici = pioggiaOraPerOra(
    [
      { quando: ora(1), valore: 0 },
      { quando: ora(0) + 60_000, valore: 0.1 },
    ],
    { adesso: ADESSO, unita: "in" },
  );
  assert.ok(Math.abs(pollici[23].mm - 2.54) < 1e-9);
});

/* ── il vento e l'UV ────────────────────────────────────────────────────── */

test("il vento: da dove arriva, in gradi o in sigla", () => {
  assert.equal(spicchioDelVento(225), 5);
  assert.equal(spicchioDelVento(350), 0);
  assert.equal(spicchioDelVento("SO"), 5);
  assert.equal(spicchioDelVento("NW"), 7);
  assert.equal(spicchioDelVento("boh"), null);
  assert.equal(gradiDelVento("SW"), 225);
  assert.equal(gradiDelVento(-90), 270);
});

test("l'indice UV nelle fasce dell'OMS", () => {
  assert.deepEqual([0, 3, 6, 8, 11, null].map(fasciaUV), [
    "basso",
    "moderato",
    "alto",
    "molto-alto",
    "estremo",
    "",
  ]);
});

/* ── le previsioni ──────────────────────────────────────────────────────── */

const ora = (quante, condition, precipitation_probability, precipitation = 0, temperature = 15) => ({
  datetime: new Date(Math.floor(ADESSO / H) * H + quante * H).toISOString(),
  condition,
  precipitation_probability,
  precipitation,
  temperature,
});

test("la pioggia in arrivo: la prima ora probabile, e quanta ne arriva", () => {
  const previsioni = [
    ora(-2, "sunny", 0),
    ora(0, "partlycloudy", 10),
    ora(1, "cloudy", 30),
    ora(2, "rainy", 70, 0.7),
    ora(3, "pouring", 85, 1.6),
    ora(4, "rainy", 55, 0.3),
  ];
  const frase = fraseDelleProssimeOre(previsioni, { adesso: ADESSO });
  assert.equal(frase.tipo, "arriva");
  assert.equal(frase.quando, Math.floor(ADESSO / H) * H + 2 * H);
  assert.equal(frase.probabilita, 70);
  assert.ok(Math.abs(frase.mm - 2.6) < 1e-9);
  /* Le ore passate non contano. */
  assert.equal(prossimeOre(previsioni, { adesso: ADESSO }).length, 5);
});

test("se piove adesso si dice quando smette, o che non smette", () => {
  const smette = fraseDelleProssimeOre([ora(0, "rainy", 80, 1), ora(1, "rainy", 60), ora(2, "cloudy", 20)], {
    adesso: ADESSO,
  });
  assert.equal(smette.tipo, "smette");
  assert.equal(smette.quando, Math.floor(ADESSO / H) * H + 2 * H);
  assert.equal(fraseDelleProssimeOre([ora(0, "pouring", 90), ora(1, "rainy", 80)], { adesso: ADESSO }).tipo, "continua");
});

test("niente pioggia: lo si dice, con la probabilita' piu' alta; senza previsioni niente frase", () => {
  const asciutto = fraseDelleProssimeOre([ora(0, "sunny", 0), ora(1, "cloudy", 20)], { adesso: ADESSO });
  assert.equal(asciutto.tipo, "asciutto");
  assert.equal(asciutto.probabilita, 20);
  assert.equal(fraseDelleProssimeOre([], { adesso: ADESSO }), null);
  /* La neve arriva come neve. */
  assert.equal(fraseDelleProssimeOre([ora(0, "cloudy", 10), ora(1, "snowy", 80)], { adesso: ADESSO }).neve, true);
});

test("i prossimi giorni partono da oggi, al piu' sette", () => {
  const giorno = (quanti) => {
    const data = new Date(ADESSO);
    data.setHours(0, 0, 0, 0);
    data.setDate(data.getDate() + quanti);
    return { datetime: data.toISOString(), condition: "rainy", temperature: 20, templow: 11 };
  };
  const giorni = prossimiGiorni(
    Array.from({ length: 10 }, (_, i) => giorno(i - 1)),
    { adesso: ADESSO },
  );
  assert.equal(giorni.length, 7);
  assert.equal(giorni[0].oggi, true);
  assert.equal(giorni[0].bassa, 11);
  assert.equal(giorni[1].oggi, false);
});

/* ── le misure di adesso ────────────────────────────────────────────────── */

test("le misure di adesso vengono dalla stazione, e dove manca dall'entita' weather", () => {
  const meteo = {
    state: "partlycloudy",
    attributes: {
      temperature: 18.6,
      apparent_temperature: 17.9,
      humidity: 64,
      pressure: 1014,
      pressure_unit: "hPa",
      wind_speed: 12,
      wind_speed_unit: "km/h",
      wind_bearing: 230,
      temperature_unit: "°C",
    },
  };
  const solo = misureDiAdesso({ meteo });
  assert.equal(solo.temperatura.valore, 18.6);
  assert.equal(solo.temperatura.fonte, "meteo");
  assert.equal(solo.direzione.valore, 230);
  assert.equal(solo.uv, undefined);
  const conStazione = misureDiAdesso({
    meteo,
    stazione: { temperatura: { valore: 18.4, unita: "°C" }, vento: { valore: 14, unita: "km/h" } },
  });
  assert.equal(conStazione.temperatura.valore, 18.4);
  assert.equal(conStazione.temperatura.fonte, "stazione");
  assert.equal(conStazione.umidita.fonte, "meteo");
  assert.equal(conStazione.vento.valore, 14);
});

/* ── la forma del modulo ────────────────────────────────────────────────── */

test("il nucleo e' puro: niente documento, niente rete, niente orologio di suo", () => {
  const sorgente = leggi("../src/core/la-pagina-meteo.js");
  assert.doesNotMatch(sorgente, /\bdocument\b|\bwindow\b|localStorage|fetch\(/);
  /* L'adesso lo passa chi chiama: Date.now() compare solo come valore di
   * serie dei parametri. */
  for (const riga of sorgente.split("\n").filter((linea) => linea.includes("Date.now()")))
    assert.match(riga, /adesso = Date\.now\(\)/);
  /* I millimetri passano dal modulo che li conosce. */
  assert.match(sorgente, /import \{ inMillimetri \} from "\.\/pioggia-caduta\.js";/);
});
