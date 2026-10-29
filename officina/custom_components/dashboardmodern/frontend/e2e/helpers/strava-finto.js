/* Le entita' che l'integrazione Strava di HACS (`ha_strava`) mette in Home
 * Assistant, con i nomi che da' lei: i dispositivi «Run», «Ride», «Recent
 * Activity», «Recent Activity 2»… e «Stats». Una settimana di fine ottobre
 * di chi corre e pedala; i numeri sono inventati, la forma no. */

const sensore = (state, attributes) => ({ state: String(state), attributes });

function attivita(radice, { id, titolo, tipo, luogo, data, misure }) {
  const stati = {
    [`sensor.${radice}`]: sensore(titolo, {
      friendly_name: radice.replace(/_/g, " "),
      activity_id: id,
      sport_type: tipo,
      location: luogo,
      activity_url: `https://www.strava.com/activities/${id}`,
      commute: false,
      private: false,
    }),
    [`sensor.${radice}_date`]: sensore(data, { activity_id: id, device_class: "timestamp" }),
  };
  for (const [coda, [valore, unita, extra]] of Object.entries(misure)) {
    stati[`sensor.${radice}_${coda}`] = sensore(valore, {
      activity_id: id,
      unit_of_measurement: unita,
      ...(extra || {}),
    });
  }
  return stati;
}

const CORSA = {
  id: "16234567890",
  titolo: "Corsa del mattino al parco",
  tipo: "Run",
  luogo: "Milano",
  data: "2026-10-28T06:42:11+00:00",
  misure: {
    distance: [10.42, "km"],
    moving_time: [3125, "s", { formatted_time: "52:05" }],
    elapsed_time: [3301, "s"],
    pace: [5.0, "min/km", { formatted_pace: "5:00 /km" }],
    elevation_gain: [64, "m"],
    average_heartrate: [148, "bpm"],
    max_heartrate: [171, "bpm"],
    calories: [712, "kcal"],
    kudos: [14, ""],
  },
};

const GIRO = {
  id: "16211111111",
  titolo: "Giro del lago con la squadra",
  tipo: "Ride",
  luogo: "Lecco",
  data: "2026-10-26T08:15:00+00:00",
  misure: {
    distance: [86.3, "km"],
    moving_time: [11040, "s", { formatted_time: "3:04:00" }],
    speed: [28.1, "km/h"],
    elevation_gain: [1120, "m"],
    average_heartrate: [139, "bpm"],
    power: [212, "W"],
    calories: [2140, "kcal"],
    kudos: [31, ""],
  },
};

const NUOTO = {
  id: "16200000001",
  titolo: "Vasche in piscina",
  tipo: "Swim",
  luogo: "",
  data: "2026-10-24T18:30:00+00:00",
  misure: {
    distance: [2.1, "km"],
    moving_time: [2820, "s", { formatted_time: "47:00" }],
    speed: [2.7, "km/h"],
    kudos: [5, ""],
  },
};

function statistiche() {
  const s = {};
  const metti = (periodo, sport, misura, valore, unita) => {
    const nome = `Stats ${periodo} ${sport} ${misura}`;
    s[`sensor.${nome.toLowerCase().replace(/ /g, "_")}`] = sensore(valore, {
      friendly_name: nome,
      unit_of_measurement: unita,
      state_class: "total",
    });
  };
  const dati = {
    Run: {
      Weekly: [31.6, 4, 9840, 210],
      Recent: [118.4, 15, 37200, 820],
      Ytd: [1284.7, 162, 401200, 9120],
      All: [6412.3, 811, 2004100, 45210],
    },
    Ride: {
      Weekly: [86.3, 1, 11040, 1120],
      Recent: [402.5, 6, 52100, 4870],
      Ytd: [3105.2, 58, 401900, 38200],
      All: [18450.9, 402, 2390400, 221300],
    },
    Swim: {
      Weekly: [2.1, 1, 2820, 0],
      Recent: [8.4, 4, 11300, 0],
      Ytd: [64.2, 31, 86400, 0],
      All: [210.5, 104, 283100, 0],
    },
  };
  for (const [sport, periodi] of Object.entries(dati))
    for (const [periodo, [km, quante, tempo, salita]] of Object.entries(periodi)) {
      metti(periodo, sport, "Distance", km, "km");
      metti(periodo, sport, "Count", quante, undefined);
      metti(periodo, sport, "Moving Time", tempo, "s");
      metti(periodo, sport, "Elevation Gain", salita, "m");
    }
  s["sensor.stats_biggest_ride_distance"] = sensore(184.2, {
    friendly_name: "Stats Biggest Ride Distance",
    unit_of_measurement: "km",
  });
  s["sensor.stats_biggest_climb_elevation_gain"] = sensore(1890, {
    friendly_name: "Stats Biggest Climb Elevation Gain",
    unit_of_measurement: "m",
  });
  return s;
}

/** Tutti gli stati di Strava: l'ultima di ogni sport, le recenti, le statistiche. */
export function statiStrava() {
  return {
    ...attivita("run", CORSA),
    ...attivita("ride", GIRO),
    ...attivita("swim", NUOTO),
    ...attivita("recent_activity", CORSA),
    ...attivita("recent_activity_2", GIRO),
    ...attivita("recent_activity_3", NUOTO),
    ...statistiche(),
  };
}

/** Le dodici settimane della corsa come le darebbe il Recorder: `change` e
 * `state` del totale «di sempre», settimana per settimana. */
export function settimaneDellaCorsa(fine = Date.parse("2026-10-29T10:00:00Z")) {
  return settimane(
    [22.4, 28.1, 0, 35.6, 30.2, 26.8, 41.3, 33.0, 18.5, 37.9, 29.4, 31.6],
    6412.3,
    fine,
  );
}

/** E quelle della bici. */
export function settimaneDellaBici(fine = Date.parse("2026-10-29T10:00:00Z")) {
  return settimane(
    [142.0, 0, 96.4, 188.1, 120.5, 64.0, 210.3, 0, 155.2, 98.7, 162.4, 86.3],
    18450.9,
    fine,
  );
}

function settimane(km, sempre, fine) {
  const lunedi = new Date(fine);
  lunedi.setUTCHours(0, 0, 0, 0);
  lunedi.setUTCDate(lunedi.getUTCDate() - ((lunedi.getUTCDay() + 6) % 7));
  let totale = sempre - km.reduce((a, b) => a + b, 0);
  return km.map((valore, i) => {
    totale += valore;
    return {
      start: lunedi.getTime() - (km.length - 1 - i) * 7 * 86_400_000,
      change: valore,
      state: Math.round(totale * 10) / 10,
    };
  });
}
