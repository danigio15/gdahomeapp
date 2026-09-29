/* Le batterie di accumulo (#117): il nucleo.
 *
 * «Poter aggiungere tutte le entità dei BMS, per esempio ho due BMS JK con
 *  stati di carica, stati di salute, correnti e tensioni varie.» Qui si tiene
 * fermo quello che la linguetta sa e un elenco di numeri no: quali entità
 * sono di un BMS e di quale pacco, la carica di tutto pesata sull'energia, il
 * delta delle celle — dal BMS o dalle celle —, quanto manca al pieno e al
 * vuoto, e da dove arriva la carica.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  SOGLIA_DELTA_MV,
  accumuloConfigurato,
  accumuloDiCasa,
  campoDelBms,
  celleDaTesto,
  celleDelPacco,
  celleLette,
  comeStaLAccumulo,
  daDove,
  letturaDelPacco,
  minutiAllaFine,
  pacchiDaImportare,
  versoDelPacco,
} from "../src/core/l-accumulo-di-casa.js";

const stato = (valore, unita = "", altro = {}) => ({
  state: String(valore),
  attributes: { unit_of_measurement: unita, ...altro },
});

/* Un JK come lo pubblica esphome-jk-bms: il prefisso è il pacco. */
function jk(prefisso, { soc = 80, celle = [], corrente = 10, tensione = 53.2, nome = "" } = {}) {
  const fn = (coda) => ({ friendly_name: nome ? `${nome} ${coda}` : undefined });
  const stati = {
    [`sensor.${prefisso}_state_of_charge`]: stato(soc, "%", fn("State of charge")),
    [`sensor.${prefisso}_total_voltage`]: stato(tensione, "V", fn("Total voltage")),
    [`sensor.${prefisso}_current`]: stato(corrente, "A", fn("Current")),
    [`sensor.${prefisso}_power`]: stato(Math.round(tensione * corrente), "W", fn("Power")),
    [`sensor.${prefisso}_delta_cell_voltage`]: stato(0.012, "V", fn("Delta cell voltage")),
    [`sensor.${prefisso}_min_cell_voltage`]: stato(3.3, "V", fn("Min cell voltage")),
    [`sensor.${prefisso}_charging_cycles`]: stato(214, "", fn("Charging cycles")),
    [`sensor.${prefisso}_temperature_sensor_1`]: stato(27.1, "°C", fn("Temperature sensor 1")),
    [`sensor.${prefisso}_power_tube_temperature`]: stato(31, "°C", fn("Power tube temperature")),
    [`sensor.${prefisso}_capacity_remaining`]: stato(96, "Ah", fn("Capacity remaining")),
    [`sensor.${prefisso}_total_battery_capacity_setting`]: stato(120, "Ah", fn("Total capacity")),
    [`sensor.${prefisso}_charging_power`]: stato(500, "W", fn("Charging power")),
    [`sensor.${prefisso}_balancing_current`]: stato(0.2, "A", fn("Balancing current")),
  };
  celle.forEach((volt, i) => {
    stati[`sensor.${prefisso}_cell_voltage_${i + 1}`] = stato(
      volt,
      "V",
      fn(`Cell voltage ${i + 1}`),
    );
  });
  return stati;
}

const SEDICI = Array.from({ length: 16 }, (_, i) => 3.33 + (i % 3) * 0.004);

test("le code dei BMS si riconoscono, col prefisso più corto che lascia una coda nota", () => {
  assert.deepEqual(campoDelBms("sensor.jk_bms_state_of_charge", stato(80, "%")), {
    campo: "soc",
    prefisso: "jk_bms",
  });
  assert.deepEqual(campoDelBms("sensor.jk_bms_delta_cell_voltage", stato(0.01, "V")), {
    campo: "delta",
    prefisso: "jk_bms",
  });
  assert.deepEqual(campoDelBms("sensor.jk_bms_2_cell_voltage_12", stato(3.3, "V")), {
    campo: "cella",
    prefisso: "jk_bms_2",
    indice: 12,
  });
  /* Il Daly mette il numero in mezzo. */
  assert.deepEqual(campoDelBms("sensor.daly_bms_cell_3_voltage", stato(3.3, "V")), {
    campo: "cella",
    prefisso: "daly_bms",
    indice: 3,
  });
  assert.equal(campoDelBms("sensor.jk_bms_power_tube_temperature", stato(30, "°C")).campo, "mos");
  assert.equal(campoDelBms("sensor.daly_bms_battery_level", stato(50, "%")).campo, "soc");
  /* La cella più alta non è una cella, né una tensione del pacco. */
  assert.equal(campoDelBms("sensor.jk_bms_max_cell_voltage", stato(3.4, "V")), null);
  /* Un'unità sbagliata vuol dire un'altra cosa. */
  assert.equal(campoDelBms("sensor.jk_bms_power", stato(40, "%")), null);
  /* Un `_battery` nudo è un pacco solo se Home Assistant lo dice batteria. */
  assert.equal(campoDelBms("sensor.garage_battery", stato(90, "%")), null);
  assert.equal(
    campoDelBms("sensor.garage_battery", stato(90, "%", { device_class: "battery" })).campo,
    "soc",
  );
  assert.equal(campoDelBms("switch.jk_bms_charging", stato("on")), null);
});

test("il rilevamento raggruppa due JK per prefisso, con le celle in ordine", () => {
  const stati = {
    ...jk("jk_bms_1", { celle: [...SEDICI].reverse(), nome: "JK Pacco 1" }),
    ...jk("jk_bms_2", { celle: SEDICI, soc: 75 }),
    /* Un telefono con la batteria: niente celle, niente corrente. */
    "sensor.telefono_battery_level": stato(55, "%", { device_class: "battery" }),
  };
  /* Le celle in disordine nell'elenco degli stati: 10 prima di 2. */
  const pacchi = pacchiDaImportare(stati, {});
  assert.equal(pacchi.length, 2);
  const [uno, due] = pacchi;
  assert.equal(uno.entity, "sensor.jk_bms_1_state_of_charge");
  assert.equal(uno.name, "JK Pacco 1");
  assert.equal(uno.tipo, "jk");
  assert.equal(uno.tensione, "sensor.jk_bms_1_total_voltage");
  assert.equal(uno.corrente, "sensor.jk_bms_1_current");
  assert.equal(uno.potenza, "sensor.jk_bms_1_power");
  assert.equal(uno.delta, "sensor.jk_bms_1_delta_cell_voltage");
  assert.equal(uno.cicli, "sensor.jk_bms_1_charging_cycles");
  assert.equal(uno.temperatura, "sensor.jk_bms_1_temperature_sensor_1");
  assert.equal(uno.mos, "sensor.jk_bms_1_power_tube_temperature");
  assert.equal(uno.energia, "sensor.jk_bms_1_capacity_remaining");
  assert.equal(uno.capacita, "sensor.jk_bms_1_total_battery_capacity_setting");
  assert.equal(uno.celle.length, 16);
  assert.equal(uno.celle[0], "sensor.jk_bms_1_cell_voltage_1");
  assert.equal(uno.celle[9], "sensor.jk_bms_1_cell_voltage_10");
  /* Senza nomi comuni il nome viene dal prefisso. */
  assert.equal(due.name, "JK BMS 2");
  /* Quello già dichiarato non torna. */
  const dopo = pacchiDaImportare(stati, { righe: [{ entity: uno.entity, name: "Mio" }] });
  assert.deepEqual(
    dopo.map((pacco) => pacco.entity),
    ["sensor.jk_bms_2_state_of_charge"],
  );
});

test("il rilevamento riconosce anche un Daly e un JBD", () => {
  const stati = {
    "sensor.daly_bms_battery_level": stato(64, "%"),
    "sensor.daly_bms_voltage": stato(52.1, "V"),
    "sensor.daly_bms_current": stato(-8, "A"),
    "sensor.daly_bms_remaining_capacity": stato(64, "Ah"),
    "sensor.daly_bms_battery_cycles": stato(40),
    "sensor.daly_bms_cell_1_voltage": stato(3.25, "V"),
    "sensor.daly_bms_cell_2_voltage": stato(3.26, "V"),
    "sensor.cantina_state_of_charge": stato(40, "%"),
    "sensor.cantina_total_voltage": stato(13.1, "V"),
    "sensor.cantina_current": stato(1, "A"),
    "sensor.cantina_nominal_capacity": stato(100, "Ah"),
    "sensor.cantina_temperature_1": stato(20, "°C"),
  };
  const pacchi = pacchiDaImportare(stati, {});
  const daly = pacchi.find((pacco) => pacco.entity === "sensor.daly_bms_battery_level");
  assert.equal(daly.tipo, "daly");
  assert.equal(daly.tensione, "sensor.daly_bms_voltage");
  assert.equal(daly.energia, "sensor.daly_bms_remaining_capacity");
  assert.deepEqual(daly.celle, [
    "sensor.daly_bms_cell_1_voltage",
    "sensor.daly_bms_cell_2_voltage",
  ]);
  const cantina = pacchi.find((pacco) => pacco.entity === "sensor.cantina_state_of_charge");
  /* Senza marca nel nome e senza forme proprie: un BMS qualunque. */
  assert.equal(cantina.tipo, "altro");
  assert.equal(cantina.capacita, "sensor.cantina_nominal_capacity");
  assert.equal(cantina.temperatura, "sensor.cantina_temperature_1");
  assert.equal(
    pacchiDaImportare(
      {
        "sensor.jbd_bms_state_of_charge": stato(5, "%"),
        "sensor.jbd_bms_total_voltage": stato(12, "V"),
        "sensor.jbd_bms_current": stato(0, "A"),
      },
      {},
    )[0].tipo,
    "jbd",
  );
});

test("«Trova le celle» le prende dal prefisso delle altre entità del pacco", () => {
  const stati = { ...jk("jk_bms", { celle: SEDICI }), ...jk("jk_bms_2", { celle: [3.3, 3.31] }) };
  const celle = celleDelPacco(stati, { entity: "", tensione: "sensor.jk_bms_total_voltage" });
  assert.equal(celle.length, 16);
  assert.equal(celle[15], "sensor.jk_bms_cell_voltage_16");
  assert.deepEqual(celleDelPacco(stati, { entity: "sensor.nessuno" }), []);
});

test("le celle incollate tutte insieme diventano un elenco pulito", () => {
  assert.deepEqual(
    celleDaTesto(
      "sensor.a_cell_voltage_1, sensor.a_cell_voltage_2\nsensor.a_cell_voltage_2;  nonsense\n",
    ),
    ["sensor.a_cell_voltage_1", "sensor.a_cell_voltage_2"],
  );
});

test("le celle: la più bassa, la più alta, la media e il delta in millivolt", () => {
  const stati = {
    "sensor.c1": stato(3.33, "V"),
    "sensor.c2": stato(3342, "mV"),
    "sensor.c3": stato("unavailable", "V"),
    "sensor.c4": stato(3.303, "V"),
  };
  const lette = celleLette(stati, ["sensor.c1", "sensor.c2", "sensor.c3", "sensor.c4"]);
  assert.equal(lette.minima.numero, 4);
  assert.equal(lette.massima.numero, 2);
  assert.equal(lette.delta, 39);
  assert.equal(lette.celle[2].volt, null);
  assert.ok(Math.abs(lette.media - (3.33 + 3.342 + 3.303) / 3) < 1e-9);
});

test("un pacco letto: il delta del BMS vince su quello delle celle, e la soglia decide", () => {
  const stati = jk("jk_bms", { celle: [3.3, 3.342], soc: 75 });
  const riga = pacchiDaImportare(stati, {})[0];
  const pacco = letturaDelPacco(riga, stati);
  /* Il BMS dice 12 mV (0,012 V): è quello che vale, anche se le due celle
   * scritte qui sarebbero a 42. */
  assert.equal(pacco.delta, 12);
  assert.equal(pacco.deltaDalBms, true);
  assert.equal(pacco.sbilanciato, false);
  assert.equal(pacco.soglia, SOGLIA_DELTA_MV);
  /* Senza il delta del BMS si calcola dalle celle, e 42 > 30. */
  const senza = letturaDelPacco({ ...riga, delta: "" }, stati);
  assert.equal(senza.delta, 42);
  assert.equal(senza.sbilanciato, true);
  /* Con la soglia a 50 lo stesso pacco è in regola. */
  assert.equal(letturaDelPacco({ ...riga, delta: "", soglia: "50" }, stati).sbilanciato, false);
  /* Le altre letture, nelle unità di casa. */
  assert.equal(pacco.tensione, 53.2);
  assert.equal(pacco.corrente, 10);
  assert.equal(pacco.potenza, 532);
  assert.equal(pacco.cicli, 214);
  assert.equal(pacco.temperatura, 27.1);
  assert.equal(pacco.mos, 31);
  assert.equal(pacco.verso, "carica");
  /* 120 Ah a 53,2 V sono 6,384 kWh; 96 Ah dentro sono 5,1072. */
  assert.ok(Math.abs(pacco.capacitaKwh - 6.384) < 1e-9);
  assert.ok(Math.abs(pacco.energiaKwh - 5.1072) < 1e-9);
});

test("la potenza manca: la fanno tensione e corrente; la capacità si scrive a mano", () => {
  const stati = {
    "sensor.p_soc": stato(50, "%"),
    "sensor.p_v": stato(51200, "mV"),
    "sensor.p_a": stato(-20, "A"),
  };
  const pacco = letturaDelPacco(
    {
      entity: "sensor.p_soc",
      tensione: "sensor.p_v",
      corrente: "sensor.p_a",
      capacita: "10",
      unita: "kWh",
    },
    stati,
  );
  assert.equal(pacco.tensione, 51.2);
  assert.equal(pacco.potenza, -1024);
  assert.equal(pacco.verso, "scarica");
  assert.equal(pacco.capacitaKwh, 10);
  /* L'energia residua dalla carica e dalla capacità. */
  assert.equal(pacco.energiaKwh, 5);
  /* In amperora, portati in energia con la tensione del pacco. */
  const inAh = letturaDelPacco(
    { entity: "sensor.p_soc", tensione: "sensor.p_v", capacita: "200" },
    stati,
  );
  assert.ok(Math.abs(inAh.capacitaKwh - 10.24) < 1e-9);
  assert.equal(inAh.capacitaAh, 200);
  /* Uno stato di carica muto è un pacco muto. */
  assert.equal(letturaDelPacco({ entity: "sensor.nessuno" }, stati).muto, true);
});

test("il verso: carica, scarica o riposo, con la soglia del rumore del BMS", () => {
  assert.equal(versoDelPacco(500, null), "carica");
  assert.equal(versoDelPacco(-500, null), "scarica");
  assert.equal(versoDelPacco(5, 2), "riposo");
  assert.equal(versoDelPacco(null, 0.1), "riposo");
  assert.equal(versoDelPacco(null, -3), "scarica");
  assert.equal(versoDelPacco(null, null), null);
});

test("la carica di tutto: pesata sull'energia quando le capacità ci sono, altrimenti la media", () => {
  const pacco = (soc, capacitaKwh, potenza, altro = {}) => ({
    entity: `sensor.${soc}`,
    muto: false,
    soc,
    capacitaKwh,
    energiaKwh: capacitaKwh === null ? null : (soc / 100) * capacitaKwh,
    potenza,
    corrente: null,
    sbilanciato: false,
    ...altro,
  });
  const pesata = comeStaLAccumulo([pacco(20, 5, 300), pacco(90, 15, 700)]);
  assert.equal(pesata.pesata, true);
  assert.ok(Math.abs(pesata.soc - 72.5) < 1e-9);
  assert.equal(pesata.capacitaKwh, 20);
  assert.ok(Math.abs(pesata.energiaKwh - 14.5) < 1e-9);
  assert.equal(pesata.potenza, 1000);
  assert.equal(pesata.verso, "carica");
  /* 5,5 kWh mancanti a 1 kW: cinque ore e mezza. */
  assert.equal(pesata.minuti, 330);
  assert.equal(pesata.stato, "bene");

  const media = comeStaLAccumulo([pacco(20, null, -300), pacco(90, 15, -700)]);
  assert.equal(media.pesata, false);
  assert.equal(media.soc, 55);
  assert.equal(media.capacitaKwh, null);
  assert.equal(media.verso, "scarica");
  assert.equal(media.minuti, null);

  const sbilanciato = comeStaLAccumulo([
    pacco(50, 5, 0),
    pacco(50, 5, 0, { sbilanciato: true, delta: 42 }),
    { entity: "sensor.muto", muto: true, soc: null },
  ]);
  assert.equal(sbilanciato.stato, "sbilanciato");
  assert.equal(sbilanciato.sbilanciati.length, 1);
  assert.equal(sbilanciato.muti.length, 1);
  assert.equal(sbilanciato.verso, "riposo");
  assert.equal(sbilanciato.minuti, null);

  assert.equal(comeStaLAccumulo([{ entity: "x", muto: true, soc: null }]).stato, "muti");
});

test("quanto manca al pieno e al vuoto, a questo ritmo", () => {
  assert.equal(
    minutiAllaFine({ verso: "carica", potenza: 2000, energiaKwh: 6, capacitaKwh: 10 }),
    120,
  );
  assert.equal(
    minutiAllaFine({ verso: "scarica", potenza: -500, energiaKwh: 2, capacitaKwh: 10 }),
    240,
  );
  assert.equal(
    minutiAllaFine({ verso: "riposo", potenza: 5, energiaKwh: 2, capacitaKwh: 10 }),
    null,
  );
  assert.equal(
    minutiAllaFine({ verso: "carica", potenza: 800, energiaKwh: null, capacitaKwh: null }),
    null,
  );
});

test("da dove arriva la carica: la fonte che ne porta almeno la metà", () => {
  assert.equal(daDove("carica", 1000, { solare: 2500, rete: -1500 }), "solare");
  assert.equal(daDove("carica", 1000, { solare: 200, rete: 900 }), "rete");
  assert.equal(daDove("carica", 1000, { solare: 300, rete: 300 }), null);
  assert.equal(daDove("scarica", -800, { casa: 900 }), "casa");
  assert.equal(daDove("riposo", 0, { solare: 900 }), null);
});

test("la linguetta nasce spenta: conta solo un pacco dichiarato con la sua entità", () => {
  assert.equal(accumuloConfigurato({}), false);
  assert.equal(accumuloConfigurato({ righe: [{ entity: "", name: "Pacco nuovo" }] }), false);
  assert.equal(accumuloConfigurato({ righe: [{ entity: "sensor.jk_bms_state_of_charge" }] }), true);
  const stati = jk("jk_bms", { celle: SEDICI });
  const [riga] = pacchiDaImportare(stati, {});
  const letti = accumuloDiCasa(stati, { righe: [riga] });
  assert.equal(letti.length, 1);
  assert.equal(letti[0].celle.length, 16);
});
