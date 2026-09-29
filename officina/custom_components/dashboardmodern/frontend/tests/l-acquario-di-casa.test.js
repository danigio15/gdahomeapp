/* L'acquario di casa (#127): il nucleo.
 *
 * «Si potrebbe inserire una sezione con l'acquario?» Qui si tiene fermo quello
 * che la pagina sa e un elenco di numeri no: cosa è ogni entità, le forcelle
 * di serie nell'unità del sensore, il galleggiante che dice «basso» in due
 * modi, i giorni al rabbocco dalla stessa retta del sale, e il cambio d'acqua
 * contato in giorni di calendario.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  CAMBIO_OGNI_GIORNI,
  FORCELLA_DEL_PH,
  FORCELLA_IN_CELSIUS,
  FORCELLA_IN_FAHRENHEIT,
  acquarioConfigurato,
  acquarioDiCasa,
  cambioDAcqua,
  comeStaLAcquario,
  conIlCambio,
  domandaDelLivello,
  genereDelSensore,
  giorniAlRabbocco,
  letturaDellaRiga,
  livelliDaSeguire,
  righeDaImportare,
  serieDelLivello,
} from "../src/core/l-acquario-di-casa.js";

const ADESSO = new Date(2026, 8, 28, 10, 0, 0).getTime();
const H = 3600000;
const GIORNO = 24 * H;

const stato = (valore, attributi = {}) => ({
  state: String(valore),
  last_changed: new Date(ADESSO - 10 * 60000).toISOString(),
  attributes: attributi,
});

/* La casa demo ha già un acquario, come sezione sua: quattro entità. */
const CASA = {
  "sensor.acquario_temperatura": stato(25.6, {
    friendly_name: "Acquario temperatura",
    device_class: "temperature",
    unit_of_measurement: "°C",
  }),
  "sensor.acquario_ph": stato(7.2, { friendly_name: "Acquario pH" }),
  "switch.acquario_luce": stato("on", { friendly_name: "Luce acquario" }),
  "switch.acquario_pompa": stato("on", { friendly_name: "Pompa acquario" }),
  "switch.acquario_riscaldatore": stato("off", { friendly_name: "Riscaldatore acquario" }),
  "sensor.acquario_tds": stato(180, { friendly_name: "Acquario TDS", unit_of_measurement: "ppm" }),
  "sensor.acquario_modello": stato("Juwel Rio 240", { friendly_name: "Acquario modello" }),
  "binary_sensor.acquario_livello": stato("off", {
    friendly_name: "Acquario livello basso",
    device_class: "problem",
  }),
  /* Quello che non è dell'acquario: l'umidità del soggiorno e la piscina. */
  "sensor.soggiorno_umidita": stato(46, { device_class: "humidity", unit_of_measurement: "%" }),
  "sensor.vasca_temperatura": stato(27.4, {
    friendly_name: "Vasca temperatura",
    device_class: "temperature",
    unit_of_measurement: "°C",
  }),
};

test("ogni entità dice cosa è: misura, livello o comando", () => {
  const genere = (entity) => genereDelSensore(entity, CASA[entity]);
  assert.equal(genere("sensor.acquario_temperatura"), "temperatura");
  assert.equal(genere("sensor.acquario_ph"), "ph");
  assert.equal(genere("sensor.acquario_tds"), "misura");
  assert.equal(genere("binary_sensor.acquario_livello"), "livello");
  assert.equal(genere("switch.acquario_luce"), "luci");
  assert.equal(genere("switch.acquario_pompa"), "filtro");
  assert.equal(genere("switch.acquario_riscaldatore"), "riscaldatore");
  assert.equal(genereDelSensore("light.plafoniera_acquario", {}), "luci");
  assert.equal(genereDelSensore("climate.acquario", {}), "riscaldatore");
  assert.equal(genereDelSensore("switch.acquario_co2", { attributes: {} }), "comando");
  assert.equal(genereDelSensore("sensor.reef_ph", { attributes: { device_class: "ph" } }), "ph");
});

test("la prima volta si prendono le entità dell'acquario, e solo quelle", () => {
  const righe = righeDaImportare(CASA, {}, (entity) => CASA[entity]?.attributes?.friendly_name);
  assert.deepEqual(
    righe.map((riga) => [riga.entity, riga.genere]),
    [
      ["sensor.acquario_temperatura", "temperatura"],
      ["sensor.acquario_ph", "ph"],
      ["sensor.acquario_tds", "misura"],
      ["binary_sensor.acquario_livello", "livello"],
      ["switch.acquario_luce", "luci"],
      ["switch.acquario_pompa", "filtro"],
      ["switch.acquario_riscaldatore", "riscaldatore"],
    ],
  );
  /* Il disegno segue il genere, e il nome è quello di Home Assistant. */
  assert.equal(righe[0].icon, "thermometer");
  assert.equal(righe[0].name, "Acquario temperatura");
  /* Quello che è già una riga non si ripropone. */
  const config = { righe: [{ entity: "sensor.acquario_ph", genere: "ph" }] };
  assert.ok(!righeDaImportare(CASA, config).some((riga) => riga.entity === "sensor.acquario_ph"));
  assert.equal(acquarioConfigurato({}), false);
  assert.equal(acquarioConfigurato(config), true);
});

test("le forcelle di serie stanno nell'unità del sensore, e si riscrivono nella riga", () => {
  const acqua = letturaDellaRiga(
    { entity: "sensor.acquario_temperatura", genere: "temperatura" },
    CASA,
  );
  assert.equal(acqua.valore, 25.6);
  assert.deepEqual(
    [acqua.minimo, acqua.massimo],
    [FORCELLA_IN_CELSIUS.minimo, FORCELLA_IN_CELSIUS.massimo],
  );
  const americana = letturaDellaRiga(
    { entity: "sensor.tank", genere: "temperatura" },
    { "sensor.tank": stato(78, { unit_of_measurement: "°F" }) },
  );
  assert.deepEqual(
    [americana.minimo, americana.massimo],
    [FORCELLA_IN_FAHRENHEIT.minimo, FORCELLA_IN_FAHRENHEIT.massimo],
  );
  const ph = letturaDellaRiga({ entity: "sensor.acquario_ph", genere: "ph" }, CASA);
  assert.deepEqual([ph.minimo, ph.massimo], [FORCELLA_DEL_PH.minimo, FORCELLA_DEL_PH.massimo]);
  /* Un marino ha la sua. */
  const marino = letturaDellaRiga(
    { entity: "sensor.acquario_ph", genere: "ph", minimo: "8,1", massimo: "8,4" },
    CASA,
  );
  assert.deepEqual([marino.minimo, marino.massimo], [8.1, 8.4]);
  /* Una misura qualunque una forcella non ce l'ha finché non gliela si dà. */
  const tds = letturaDellaRiga({ entity: "sensor.acquario_tds", genere: "misura" }, CASA);
  assert.deepEqual([tds.minimo, tds.massimo, tds.unita], [null, null, "ppm"]);
});

test("i comandi dicono se sono accesi, e chi tace è muto", () => {
  const luce = letturaDellaRiga({ entity: "switch.acquario_luce", genere: "luci" }, CASA);
  assert.equal(luce.acceso, true);
  const riscaldatore = letturaDellaRiga(
    { entity: "climate.acquario", genere: "riscaldatore" },
    { "climate.acquario": stato("heat") },
  );
  assert.equal(riscaldatore.acceso, true);
  const muto = letturaDellaRiga(
    { entity: "switch.acquario_pompa", genere: "filtro" },
    { "switch.acquario_pompa": stato("unavailable") },
  );
  assert.equal(muto.muto, true);
  assert.equal(muto.acceso, null);
});

test("il galleggiante dice «basso» in due modi, secondo la sua classe", () => {
  const problema = (valore) =>
    letturaDellaRiga(
      { entity: "binary_sensor.acquario_livello", genere: "livello" },
      { "binary_sensor.acquario_livello": stato(valore, { device_class: "problem" }) },
    ).basso;
  assert.equal(problema("on"), true);
  assert.equal(problema("off"), false);
  /* Con «moisture» acceso vuol dire bagnato: l'acqua c'è. */
  const bagnato = (valore) =>
    letturaDellaRiga(
      { entity: "binary_sensor.acquario_galleggiante", genere: "livello" },
      { "binary_sensor.acquario_galleggiante": stato(valore, { device_class: "moisture" }) },
    ).basso;
  assert.equal(bagnato("on"), false);
  assert.equal(bagnato("off"), true);
});

/* Dieci giorni di livello: rabboccato cinque giorni fa, poi giù di mezzo
 * punto al giorno. */
function giorniDiLivello({ dal = 5, parte = 98, alGiorno = 0.5 } = {}) {
  const secchielli = [];
  for (let ora = 240; ora >= 1; ora -= 1) {
    const quando = ADESSO - ora * H;
    const giorni = (ADESSO - quando) / GIORNO;
    const valore = giorni > dal ? 92 + giorni * 0.1 : parte - (dal - giorni) * alGiorno;
    secchielli.push({ start: quando, mean: valore });
  }
  return serieDelLivello({ "sensor.acquario_livello": secchielli }, "sensor.acquario_livello");
}

test("i giorni al rabbocco sono la retta dall'ultimo rabbocco in poi", () => {
  const serie = giorniDiLivello();
  const lettura = {
    genere: "livello",
    binario: false,
    valore: 95.5,
    soglia: 93,
    da: ADESSO - 60000,
  };
  /* Da 95,5 a 93 a mezzo punto al giorno: cinque giorni, o quasi. */
  const giorni = giorniAlRabbocco(serie, lettura);
  assert.ok(giorni === 4 || giorni === 5, `cinque giorni, o quasi: ${giorni}`);
  /* Senza soglia non c'è una risposta da dare. */
  assert.equal(giorniAlRabbocco(serie, { ...lettura, soglia: null }), null);
  /* E la domanda è quella delle piante: medie di ogni ora, dal ponte. */
  const domanda = domandaDelLivello(["sensor.acquario_livello"], ADESSO);
  assert.equal(domanda.type, "recorder/statistics_during_period");
  assert.equal(domanda.period, "hour");
  assert.deepEqual(domanda.types, ["mean"]);
});

test("il cambio d'acqua si conta in giorni di calendario, e senza data non è in ritardo", () => {
  const ieriSera = new Date(2026, 8, 27, 21, 0, 0).getTime();
  const cambio = cambioDAcqua({ cambio: new Date(ieriSera).toISOString() }, ADESSO);
  assert.equal(cambio.giorni, 1);
  assert.equal(cambio.ogni, CAMBIO_OGNI_GIORNI);
  assert.equal(cambio.fra, CAMBIO_OGNI_GIORNI - 1);
  assert.equal(cambio.scaduto, false);
  const vecchio = cambioDAcqua(
    { cambio: new Date(ADESSO - 16 * GIORNO).toISOString(), ogni: "14" },
    ADESSO,
  );
  assert.equal(vecchio.giorni, 16);
  assert.equal(vecchio.fra, -2);
  assert.equal(vecchio.scaduto, true);
  const mai = cambioDAcqua({}, ADESSO);
  assert.deepEqual([mai.ultimo, mai.giorni, mai.scaduto], [null, null, false]);
  /* Segnarlo e toglierlo lascia stare il resto della configurazione. */
  const config = { righe: [], vasca: "Vasca tropicale" };
  const segnato = conIlCambio(config, ADESSO);
  assert.equal(segnato.vasca, "Vasca tropicale");
  assert.equal(Date.parse(segnato.cambio), ADESSO);
  assert.equal(conIlCambio(segnato, "").cambio, undefined);
});

test("come sta l'acquario: prima la forcella, poi il livello, poi il cambio", () => {
  const config = {
    vasca: "Vasca tropicale",
    litri: "240",
    cambio: new Date(ADESSO - 11 * GIORNO).toISOString(),
    righe: [
      { entity: "sensor.acquario_temperatura", genere: "temperatura" },
      { entity: "sensor.acquario_ph", genere: "ph" },
      { entity: "binary_sensor.acquario_livello", genere: "livello" },
      { entity: "switch.acquario_luce", genere: "luci" },
    ],
  };
  const come = (stati, altro = {}) =>
    comeStaLAcquario(acquarioDiCasa(stati, { ...config, ...altro }), {
      config: { ...config, ...altro },
      adesso: ADESSO,
    });
  const bene = come(CASA);
  assert.equal(bene.stato, "bene");
  assert.equal(bene.vasca, "Vasca tropicale");
  assert.equal(bene.litri, 240);
  assert.equal(bene.cambio.giorni, 11);
  assert.equal(bene.comandi.length, 1);
  /* Il cambio da fare viene prima del bene... */
  assert.equal(come(CASA, { ogni: "10" }).stato, "cambio");
  /* ...il livello basso prima del cambio... */
  const basso = {
    ...CASA,
    "binary_sensor.acquario_livello": stato("on", { device_class: "problem" }),
  };
  assert.equal(come(basso, { ogni: "10" }).stato, "livello");
  /* ...e la temperatura fuori forcella prima di tutto. */
  const caldo = {
    ...basso,
    "sensor.acquario_temperatura": stato(29.1, {
      device_class: "temperature",
      unit_of_measurement: "°C",
    }),
  };
  const fuori = come(caldo, { ogni: "10" });
  assert.equal(fuori.stato, "fuori");
  assert.deepEqual(
    fuori.fuori.map((voce) => [voce.lettura.genere, voce.verdetto]),
    [["temperatura", "high"]],
  );
  /* Nessuno risponde: si dice, e non si inventa un «bene». */
  const spento = Object.fromEntries(Object.keys(CASA).map((id) => [id, stato("unavailable")]));
  assert.equal(come(spento).stato, "mute");
  assert.equal(comeStaLAcquario([], { config: {}, adesso: ADESSO }).stato, "vuoto");
});

test("la storia si chiede solo per i livelli che hanno una soglia", () => {
  const letture = acquarioDiCasa(
    {
      ...CASA,
      "sensor.acquario_livello_cm": stato(31.5, { unit_of_measurement: "cm" }),
    },
    {
      righe: [
        { entity: "sensor.acquario_livello_cm", genere: "livello", soglia: "30" },
        { entity: "binary_sensor.acquario_livello", genere: "livello" },
        { entity: "sensor.acquario_temperatura", genere: "temperatura" },
      ],
    },
  );
  assert.deepEqual(livelliDaSeguire(letture), ["sensor.acquario_livello_cm"]);
});
