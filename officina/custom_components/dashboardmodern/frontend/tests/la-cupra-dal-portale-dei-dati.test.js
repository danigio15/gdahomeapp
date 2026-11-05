/* L'auto che arriva dal portale dei dati europeo (EU Data Act).
 *
 * «Ho messo l'entita' della batteria ausiliaria, km, batteria elettrica,
 * temperatura esterna, freno di stazionamento e l'ultimo aggiornamento, ma non
 * li prende tutti.» Una Cupra letta da un'integrazione «garage»: la 12 V in
 * volt, finita nella casella «Batteria auto (%)»; il contachilometri senza
 * `state_class`, e quindi senza statistiche; il freno come binary_sensor; un
 * livello della batteria ausiliaria che e' un numero piccolo senza unita'.
 * Qui le regole, a tavolino; la pagina intera la guarda
 * `e2e/la-cupra-dal-portale-dei-dati.spec.js`.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { batteriaDalloStato, laBatteriaDellaCasella } from "../src/core/auto-termica.js";
import { legaLAutoAlDispositivo } from "../src/core/auto-device-binding.js";
import { finestraDelloStorico, kmDeiGiorniDallaStoria } from "../src/core/la-nuova-auto.js";

const C = "garage_cupra_031285";
const stato = (entity_id, state, attributes = {}) => ({ entity_id, state, attributes });

test("la 12 V nella casella della carica non e' la carica: e' la 12 V", () => {
  /* Com'e' nella sua casa: «Batteria 12V» a 12,25 volt. */
  const inVolt = laBatteriaDellaCasella(
    stato(`sensor.${C}_batteria_12v`, "12.25", {
      friendly_name: "Batteria 12V",
      unit_of_measurement: "V",
      device_class: "voltage",
    }),
  );
  assert.equal(inVolt.soc, null);
  assert.deepEqual(inVolt.servizio, { valore: 12.25, unita: "V" });
  /* Anche senza unita' e senza classe: il nome e i decimali la dicono. */
  const nuda = laBatteriaDellaCasella(
    stato(`sensor.${C}_batteria_12v`, "12.25", { friendly_name: "Batteria 12V" }),
  );
  assert.equal(nuda.soc, null);
  assert.deepEqual(nuda.servizio, { valore: 12.25, unita: "V" });
  /* E una tensione senza nomi resta una tensione. */
  assert.deepEqual(laBatteriaDellaCasella(stato("sensor.auto_x", "12.6")).servizio, {
    valore: 12.6,
    unita: "V",
  });
});

test("il livello della ausiliaria nella casella della carica non e' un 2%", () => {
  const livello = laBatteriaDellaCasella(
    stato(`sensor.${C}_livello_batteria_ausiliaria`, "2", {
      friendly_name: "Livello batteria ausiliaria",
    }),
  );
  assert.equal(livello.soc, null);
  assert.deepEqual(livello.servizio, { valore: 2, unita: "" });
});

test("la carica vera resta la carica", () => {
  const carica = laBatteriaDellaCasella(
    stato(`sensor.${C}_stato_di_carica`, "64", {
      unit_of_measurement: "%",
      device_class: "battery",
    }),
  );
  assert.deepEqual(carica, { soc: 64, servizio: null });
  /* Un intero senza unita' e' un livello, com'e' sempre stato. */
  assert.deepEqual(laBatteriaDellaCasella(stato("sensor.ev_soc", "80")), {
    soc: 80,
    servizio: null,
  });
  /* Muta, o non mappata: niente, e nessuno zero. */
  assert.deepEqual(laBatteriaDellaCasella(stato("sensor.ev_soc", "unavailable")), {
    soc: null,
    servizio: null,
  });
  assert.deepEqual(laBatteriaDellaCasella(null), { soc: null, servizio: null });
});

test("la casella della 12 V legge i volt anche quando non sono scritti", () => {
  assert.deepEqual(batteriaDalloStato("12.25", ""), { valore: 12.25, unita: "V" });
  assert.deepEqual(batteriaDalloStato("13", "", { classe: "voltage" }), {
    valore: 13,
    unita: "V",
  });
  /* «Livello batteria ausiliaria» a «2», senza unita': un gradino, non un 2%. */
  assert.deepEqual(batteriaDalloStato("2", ""), { valore: 2, unita: "" });
  assert.deepEqual(batteriaDalloStato("2", "", { classe: "battery" }), { valore: 2, unita: "%" });
  /* Un livello senza unita' resta un livello, fra zero e cento. */
  assert.deepEqual(batteriaDalloStato("86", ""), { valore: 86, unita: "%" });
  assert.deepEqual(batteriaDalloStato("120", ""), { valore: 100, unita: "%" });
});

test("senza statistiche, i km di ogni giorno vengono dalla storia", () => {
  /* I giorni sono quelli di casa sua: il fuso si fissa, o la divisione per
   * giorno cambierebbe con quello della macchina che fa la prova. */
  const prima = process.env.TZ;
  process.env.TZ = "Europe/Rome";
  try {
    contaIKm();
  } finally {
    if (prima === undefined) delete process.env.TZ;
    else process.env.TZ = prima;
  }
});

function contaIKm() {
  const adesso = new Date("2026-11-05T11:44:00+01:00").getTime();
  const finestra = finestraDelloStorico("7", { adesso });
  /* Il portale aggiorna il contachilometri di rado: cinque letture in undici
   * giorni, la prima prima della finestra (lo stato al bordo). */
  const righe = [
    ["2026-10-30T00:00:00+01:00", "5200"],
    ["2026-10-31T09:00:00+01:00", "5246"],
    ["2026-11-02T19:00:00+01:00", "5283"],
    ["2026-11-04T18:30:00+01:00", "5329"],
    ["2026-11-05T10:41:00+01:00", "5341"],
  ].map(([quando, s]) => ({ stato: s, quando: new Date(quando).getTime() }));
  const giorni = kmDeiGiorniDallaStoria(righe, finestra.inizio, finestra.fine);
  assert.equal(giorni.length, 7);
  assert.equal(
    giorni.reduce((a, g) => a + g.km, 0),
    141,
  );
  assert.deepEqual(
    giorni.filter((g) => g.km > 0).map((g) => g.km),
    [46, 37, 46, 12],
  );
  /* Le righe mute non fanno salti, e un contachilometri che torna indietro
   * non fa km negativi. */
  const sporche = [
    { stato: "5300", quando: finestra.inizio },
    { stato: "unavailable", quando: finestra.inizio + 3_600_000 },
    { stato: "5290", quando: finestra.inizio + 7_200_000 },
    { stato: "5310", quando: finestra.inizio + 10_800_000 },
  ];
  assert.equal(
    kmDeiGiorniDallaStoria(sporche, finestra.inizio, finestra.fine).reduce((a, g) => a + g.km, 0),
    20,
  );
  assert.equal(
    kmDeiGiorniDallaStoria([], finestra.inizio, finestra.fine).every((g) => g.km === 0),
    true,
  );
}

/* Il dispositivo come lo descrive Home Assistant. */
function dispositivo(righe) {
  const entities = righe.map(([entity_id, name, extra = {}]) => ({
    entity_id,
    name,
    device_class: extra.device_class || "",
    unit: extra.unit || "",
    category: "",
    disabled: false,
  }));
  const states = Object.fromEntries(
    righe.map(([entity_id, name, extra = {}]) => [
      entity_id,
      {
        state: extra.state ?? "1",
        attributes: {
          friendly_name: name,
          ...(extra.device_class ? { device_class: extra.device_class } : {}),
          ...(extra.unit ? { unit_of_measurement: extra.unit } : {}),
        },
      },
    ]),
  );
  return legaLAutoAlDispositivo({ entities, states });
}

test("dall'integrazione la Cupra arriva con la 12 V, i km e il freno al loro posto", () => {
  const { mappa, tipo } = dispositivo([
    [`binary_sensor.${C}_astina_olio_attiva`, "Astina olio attiva", { state: "on" }],
    [`binary_sensor.${C}_dati_obsoleti`, "Dati obsoleti", { state: "off" }],
    [`binary_sensor.${C}_fonte_eu_data_act_portal`, "Fonte: EU Data Act portal", { state: "on" }],
    [`binary_sensor.${C}_freno_di_stazionamento`, "Freno di stazionamento", { state: "on" }],
    ["button.garage_cupra_terramar_aggiorna_dati", "Aggiorna dati", { state: "unknown" }],
    [`calendar.${C}_programmazione_assistenza`, "Programmazione assistenza", { state: "off" }],
    ["event.garage_cupra_terramar_evento_push", "Evento push", { state: "unknown" }],
    [`sensor.${C}_avvisi_del_cruscotto_grezzi`, "Avvisi del cruscotto (grezzi)", { state: "1" }],
    [`sensor.${C}_batteria_12v`, "Batteria 12V", { state: "12.25" }],
    [
      `sensor.${C}_chiave_dataset`,
      "Chiave dataset",
      { state: "00000000-0000-4000-8000-000000000000" },
    ],
    [`sensor.${C}_contachilometri`, "Contachilometri", { state: "5341" }],
    [
      `sensor.${C}_data_del_tagliando`,
      "Data del tagliando",
      { state: "2028-05-09", device_class: "date" },
    ],
    [`sensor.${C}_livello_batteria_ausiliaria`, "Livello batteria ausiliaria", { state: "2" }],
    [`sensor.${C}_luci_di_posizione`, "Luci di posizione", { state: "off" }],
    [`sensor.${C}_minuti_dall_ultimo_snapshot`, "Minuti dall'ultimo snapshot", { state: "0" }],
    [
      `sensor.${C}_ora_di_allerta_batteria_ausiliaria`,
      "Ora di allerta batteria ausiliaria",
      { state: "2026-11-02T18:31:49+00:00", device_class: "timestamp" },
    ],
    [`sensor.${C}_prossimo_tagliando`, "Prossimo tagliando", { state: "24700" }],
    [
      `sensor.${C}_richiesta_dati_creata`,
      "Richiesta dati creata",
      { state: "2026-10-25T20:03:46+00:00", device_class: "timestamp" },
    ],
    [`sensor.${C}_stato_connessione`, "Stato connessione", { state: "online" }],
    [`sensor.${C}_stato_del_feed_del_portale`, "Stato del feed del portale", { state: "ok" }],
    [`sensor.${C}_tagliando_tra`, "Tagliando tra", { state: "551" }],
    [`sensor.${C}_temperatura_esterna`, "Temperatura esterna", { state: "7.0" }],
    [
      `sensor.${C}_ultimo_snapshot_ricevuto`,
      "Ultimo snapshot ricevuto",
      { state: "2026-11-05T10:45:18+00:00", device_class: "timestamp" },
    ],
    [
      `sensor.${C}_veicolo_ultimo_report`,
      "Veicolo ultimo report",
      { state: "2026-11-02T18:31:49+00:00", device_class: "timestamp" },
    ],
    [
      "sensor.garage_cupra_terramar_canale_sorgente_dati",
      "Canale sorgente dati",
      { state: "EU Data Act portal" },
    ],
  ]);
  assert.equal(mappa["dm.ev_batteria_servizio"], `sensor.${C}_batteria_12v`);
  assert.equal(mappa["dm.ev_odometro"], `sensor.${C}_contachilometri`);
  assert.equal(mappa["dm.ev_freno_stazionamento"], `binary_sensor.${C}_freno_di_stazionamento`);
  /* L'ora dei dati e' quella in cui li ha mandati l'auto, non quella in cui
   * sono arrivati. */
  assert.equal(mappa["dm.ev_ultimo_aggiornamento"], `sensor.${C}_veicolo_ultimo_report`);
  /* La temperatura di fuori, anche scritta senza unita'. */
  assert.equal(mappa["dm.ev_temperatura_esterna"], `sensor.${C}_temperatura_esterna`);
  /* Il livello della ausiliaria non e' la batteria di trazione, e niente di
   * questo e' uno stato della ricarica. */
  assert.equal(mappa["dm.ev_batteria_auto"], undefined);
  assert.equal(mappa["dm.ev_stato_ricarica"], undefined);
  assert.equal(tipo, "");
});

test("una ausiliaria in percento non si prende la casella della trazione", () => {
  const { mappa } = dispositivo([
    ["sensor.auto_livello_batteria_ausiliaria", "Livello batteria ausiliaria", { unit: "%" }],
    ["sensor.auto_batteria", "Batteria", { unit: "%", device_class: "battery" }],
  ]);
  assert.equal(mappa["dm.ev_batteria_servizio"], "sensor.auto_livello_batteria_ausiliaria");
  assert.equal(mappa["dm.ev_batteria_auto"], "sensor.auto_batteria");
});

test("la pagina Auto usa le due regole", async () => {
  const sezione = await readFile(
    new URL("../src/sections/la-nuova-auto-section.js", import.meta.url),
    "utf8",
  );
  assert.match(sezione, /laBatteriaDellaCasella\(/);
  assert.match(sezione, /kmDeiGiorniDallaStoria\(/);
});
