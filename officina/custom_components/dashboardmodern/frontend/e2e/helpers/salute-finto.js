/* I sensori della salute come li mette Home Assistant: il telefono Android di
 * Marco (l'app Home Assistant, da Health Connect) e la bilancia e il
 * misuratore di pressione Withings di Giulia. Accanto, i sensori che NON sono
 * il corpo e che la Salute deve lasciare stare: l'obiettivo dei passi, la
 * temperatura della stanza, il pellet della stufa. I numeri sono inventati, i
 * nomi e le unita' no. */

const ORA = "2026-10-29T09:40:00+00:00";

const sensore = (state, attributes, quando = ORA) => ({
  state: String(state),
  attributes,
  last_updated: quando,
  last_changed: quando,
});

export function statiSalute() {
  return {
    "sensor.pixel_8_steps": sensore(7842, {
      friendly_name: "Pixel 8 Steps",
      unit_of_measurement: "steps",
      state_class: "total",
      icon: "mdi:walk",
    }),
    "sensor.pixel_8_heart_rate": sensore(72, {
      friendly_name: "Pixel 8 Heart rate",
      unit_of_measurement: "bpm",
      state_class: "measurement",
    }),
    "sensor.pixel_8_resting_heart_rate": sensore(58, {
      friendly_name: "Pixel 8 Resting heart rate",
      unit_of_measurement: "bpm",
      state_class: "measurement",
    }),
    "sensor.pixel_8_weight": sensore(78.4, {
      friendly_name: "Pixel 8 Weight",
      unit_of_measurement: "kg",
      device_class: "weight",
      state_class: "measurement",
    }, "2026-10-28T07:05:00+00:00"),
    "sensor.pixel_8_sleep_duration": sensore(452, {
      friendly_name: "Pixel 8 Sleep duration",
      unit_of_measurement: "min",
      device_class: "duration",
    }, "2026-10-29T06:30:00+00:00"),
    "sensor.pixel_8_oxygen_saturation": sensore(97, {
      friendly_name: "Pixel 8 Oxygen saturation",
      unit_of_measurement: "%",
    }),
    "sensor.pixel_8_active_calories_burned": sensore(386, {
      friendly_name: "Pixel 8 Active calories burned",
      unit_of_measurement: "kcal",
      state_class: "total",
    }),
    "sensor.pixel_8_blood_pressure_systolic": sensore(124, {
      friendly_name: "Pixel 8 Blood pressure systolic",
      unit_of_measurement: "mmHg",
    }, "2026-10-28T20:10:00+00:00"),
    "sensor.pixel_8_blood_pressure_diastolic": sensore(81, {
      friendly_name: "Pixel 8 Blood pressure diastolic",
      unit_of_measurement: "mmHg",
    }, "2026-10-28T20:10:00+00:00"),
    "sensor.giulia_weight": sensore(61.2, {
      friendly_name: "Withings Giulia Weight",
      unit_of_measurement: "kg",
      device_class: "weight",
      state_class: "measurement",
    }, "2026-10-29T07:12:00+00:00"),
    "sensor.giulia_fat_ratio": sensore(24.8, {
      friendly_name: "Withings Giulia Fat ratio",
      unit_of_measurement: "%",
      state_class: "measurement",
    }, "2026-10-29T07:12:00+00:00"),
    "sensor.giulia_systolic_blood_pressure": sensore(142, {
      friendly_name: "Withings Giulia Systolic blood pressure",
      unit_of_measurement: "mmHg",
    }, "2026-10-28T21:00:00+00:00"),
    "sensor.giulia_diastolic_blood_pressure": sensore(88, {
      friendly_name: "Withings Giulia Diastolic blood pressure",
      unit_of_measurement: "mmHg",
    }, "2026-10-28T21:00:00+00:00"),
    "sensor.giulia_heart_pulse": sensore(66, {
      friendly_name: "Withings Giulia Heart pulse",
      unit_of_measurement: "bpm",
    }, "2026-10-28T21:00:00+00:00"),
    /* Quelli che il corpo non sono. */
    "sensor.pixel_8_steps_goal": sensore(10000, {
      friendly_name: "Pixel 8 Steps goal",
      unit_of_measurement: "steps",
    }),
    "sensor.soggiorno_temperatura": sensore(21.4, {
      friendly_name: "Soggiorno temperatura",
      unit_of_measurement: "°C",
      device_class: "temperature",
    }),
    "sensor.stufa_pellet_weight": sensore(12.5, {
      friendly_name: "Stufa pellet weight",
      unit_of_measurement: "kg",
      device_class: "weight",
    }),
  };
}

const GIORNO = 86_400_000;

function giorni(quanti, fine, valori, campo) {
  const oggi = new Date(fine);
  oggi.setUTCHours(0, 0, 0, 0);
  return valori.slice(-quanti).map((v, i, tutti) => ({
    start: oggi.getTime() - (tutti.length - 1 - i) * GIORNO,
    [campo]: v,
    ...(campo === "change" ? { max: v } : {}),
  }));
}

/** I passi degli ultimi sette giorni, oggi compreso. */
export function passiDellaSettimana(fine = Date.parse("2026-10-29T10:00:00Z")) {
  return giorni(7, fine, [9120, 11480, 6305, 12940, 8770, 10215, 7842], "change");
}

/** Il peso dell'ultimo mese, una media al giorno. */
export function pesoDelMese(fine = Date.parse("2026-10-29T10:00:00Z")) {
  const valori = Array.from({ length: 30 }, (_v, i) =>
    Math.round((80.6 - i * 0.075 + Math.sin(i / 2.3) * 0.35) * 10) / 10,
  );
  valori[29] = 78.4;
  return giorni(30, fine, valori, "mean");
}
