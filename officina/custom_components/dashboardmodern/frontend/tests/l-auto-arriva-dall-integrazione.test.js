/* Quale entita' del dispositivo va in quale casella dell'auto.
 *
 * «Vogliamo cercare di fare la stessa cosa integrazione anche su auto, cosi'
 * viene piu' pulita.» L'assegnazione e' una funzione pura su un elenco di
 * entita': si prova a tavolino, con le entita' di auto vere, senza accendere
 * niente.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  CHIAVI_DI_GDAAUTO,
  legaLAutoAlDispositivo,
  motoreDalleCaselle,
} from "../src/core/auto-device-binding.js";
import { VEHICLE_KEY_FIELD, accogliAutoDalDispositivo } from "../src/core/vehicle-model.js";

/* Un dispositivo come lo descrive Home Assistant: l'elenco delle entita' e la
 * tabella degli stati, che e' dove stanno `device_class` e unita'. */
function dispositivo(righe) {
  const entities = righe.map(([entity_id, name, extra = {}]) => ({
    entity_id,
    name,
    device_class: extra.device_class || "",
    unit: extra.unit || "",
    category: extra.category || "",
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

test("un'auto a benzina: serbatoio, autonomia, contachilometri e il resto", () => {
  const { mappa, tipo } = dispositivo([
    ["sensor.tucson_fuel_level", "TUCSON Fuel level", { unit: "%" }],
    ["sensor.tucson_range", "TUCSON Range", { device_class: "distance", unit: "km" }],
    ["sensor.tucson_odometer", "TUCSON Odometer", { unit: "km" }],
    ["sensor.tucson_battery_12v", "TUCSON 12V battery level", { unit: "%" }],
    ["binary_sensor.tucson_doors", "TUCSON Doors", { device_class: "door" }],
    ["binary_sensor.tucson_trunk", "TUCSON Trunk", { device_class: "opening" }],
    ["binary_sensor.tucson_hood", "TUCSON Hood", { device_class: "opening" }],
    ["device_tracker.tucson", "TUCSON Location"],
  ]);
  assert.equal(mappa["dm.ev_carburante"], "sensor.tucson_fuel_level");
  assert.equal(mappa["dm.ev_autonomia"], "sensor.tucson_range");
  assert.equal(mappa["dm.ev_odometro"], "sensor.tucson_odometer");
  assert.equal(mappa["dm.ev_portiere"], "binary_sensor.tucson_doors");
  assert.equal(mappa["dm.ev_bagagliaio"], "binary_sensor.tucson_trunk");
  assert.equal(mappa["dm.ev_cofano"], "binary_sensor.tucson_hood");
  assert.equal(mappa["dm.ev_posizione"], "device_tracker.tucson");
  /* Un serbatoio senza batteria di trazione e' un'auto a benzina. */
  assert.equal(tipo, "termica");
});

test("la batteria da 12 V non si prende il posto di quella di trazione", () => {
  /* Sono tutte e due percentuali, e la prima che passa vincerebbe: la
   * distinzione la fanno le parole, e si chiede prima quella di servizio. */
  const { mappa, tipo } = dispositivo([
    ["sensor.auto_batteria_12v", "Auto Batteria di servizio", { unit: "%" }],
    ["sensor.auto_soc", "Auto Battery", { device_class: "battery", unit: "%" }],
  ]);
  assert.equal(mappa["dm.ev_batteria_servizio"], "sensor.auto_batteria_12v");
  assert.equal(mappa["dm.ev_batteria_auto"], "sensor.auto_soc");
  assert.equal(tipo, "");
});

test("un'ibrida ha tutti e due, e lo dice", () => {
  const { tipo } = dispositivo([
    ["sensor.ibrida_fuel", "Livello carburante", { unit: "%" }],
    ["sensor.ibrida_soc", "Batteria", { device_class: "battery", unit: "%" }],
  ]);
  assert.equal(tipo, "ibrida");
});

test("le impostazioni del dispositivo non entrano nell'auto", () => {
  /* Il volume dell'avvisatore sta nel pannello del dispositivo, non sulla card
   * di chi guarda quanta benzina ha. */
  const { mappa } = dispositivo([
    ["number.auto_volume", "Volume", { category: "config" }],
    ["sensor.auto_fuel", "Fuel level", { unit: "%", category: "config" }],
  ]);
  assert.deepEqual(mappa, {});
});

test("un'entita' presa non finisce anche in un'altra casella", () => {
  /* «Odometer» e «Last trip» sono tutti e due chilometri: se la prima
   * domanda non togliesse l'entita' dal mazzo, lo stesso sensore sarebbe
   * insieme il contachilometri e l'ultimo viaggio. */
  const { mappa } = dispositivo([
    ["sensor.auto_odometer", "Odometer", { unit: "km" }],
    ["sensor.auto_last_trip", "Last trip distance", { unit: "km" }],
  ]);
  assert.equal(mappa["dm.ev_odometro"], "sensor.auto_odometer");
  assert.equal(mappa["dm.ev_ultimo_viaggio"], "sensor.auto_last_trip");
  const presi = Object.values(mappa);
  assert.equal(new Set(presi).size, presi.length, "nessuna entita' in due caselle");
});

test("il target comandabile dell'auto deve parlare di carica", () => {
  /* Un `number.cabin_target_temperature` e' un «target» anche lui: la
   * tendina del target gli manderebbe un limite di carica. */
  const { mappa } = dispositivo([
    ["number.b10_cabin_target_temperature", "Cabin target temperature", { unit: "°C" }],
    ["sensor.b10_target_soc", "Target SoC", { unit: "%" }],
  ]);
  assert.equal(mappa["dm.ev_target_soc"], "sensor.b10_target_soc");
  /* Ma un limite di carica comandabile vince sul sensore. */
  const comandabile = dispositivo([
    ["sensor.b10_target_soc", "Target SoC", { unit: "%" }],
    ["number.b10_charge_limit", "Charge limit target", { unit: "%" }],
  ]);
  assert.equal(comandabile.mappa["dm.ev_target_soc"], "number.b10_charge_limit");
  /* Anche una tendina senza unita', se parla di SoC. */
  const tendina = dispositivo([["select.b10_target_soc", "Target SoC"]]);
  assert.equal(tendina.mappa["dm.ev_target_soc"], "select.b10_target_soc");
});

test("un'auto che c'e' gia' con quel nome si aggiorna, e tiene la foto", () => {
  /* «La foto dell'auto si e' persa con gli aggiornamenti: l'ho riassociata e
   * funziona.» Il dispositivo si chiamava come la vettura gia' in elenco, e
   * ne nasceva una seconda, nuda: la foto stava sull'altra. */
  const elenco = [
    {
      [VEHICLE_KEY_FIELD]: "b10",
      name: "B10",
      brand: "Leapmotor",
      model: "B10",
      tipo: "",
      img: "/local/ev/b10.png",
      imgPlugged: "/local/ev/b10-cavo.png",
      ov: { "dm.ev_batteria_auto": "sensor.vecchia_batteria", "dm.ev_odometro": "sensor.b10_km" },
    },
  ];
  const mappa = {
    "dm.ev_batteria_auto": "sensor.b10_battery",
    "dm.ev_autonomia": "sensor.b10_range",
  };
  const stessa = accogliAutoDalDispositivo(elenco, { name: "B10", mappa, tipo: "termica" });
  assert.equal(stessa.nuova, false);
  assert.equal(stessa.uid, "b10");
  assert.equal(stessa.cars.length, 1, "nessuna seconda B10");
  const auto = stessa.cars[0];
  assert.equal(auto.img, "/local/ev/b10.png");
  assert.equal(auto.imgPlugged, "/local/ev/b10-cavo.png");
  assert.equal(auto.brand, "Leapmotor");
  /* Le caselle che l'integrazione riconosce si riscrivono, le altre restano. */
  assert.equal(auto.ov["dm.ev_batteria_auto"], "sensor.b10_battery");
  assert.equal(auto.ov["dm.ev_autonomia"], "sensor.b10_range");
  assert.equal(auto.ov["dm.ev_odometro"], "sensor.b10_km");
  /* Il motore non dichiarato lo dice l'integrazione; uno dichiarato resta. */
  assert.equal(auto.tipo, "termica");
  const ibrida = accogliAutoDalDispositivo([{ ...elenco[0], tipo: "ibrida" }], {
    name: "B10",
    mappa,
    tipo: "termica",
  });
  assert.equal(ibrida.cars[0].tipo, "ibrida");

  /* L'auto aperta con la matita vince sul nome del dispositivo. */
  const aperta = accogliAutoDalDispositivo(elenco, {
    name: "Leapmotor B10 EV",
    mappa,
    aperta: "b10",
  });
  assert.equal(aperta.nuova, false);
  assert.equal(aperta.cars.length, 1);
  assert.equal(aperta.cars[0].name, "B10", "il nome resta il suo");

  /* Un nome che nessuno porta fa nascere una vettura nuova, senza foto. */
  const nuova = accogliAutoDalDispositivo(elenco, { name: "Zoe", mappa, tipo: "" });
  assert.equal(nuova.nuova, true);
  assert.equal(nuova.cars.length, 2);
  assert.equal(nuova.cars[1].name, "Zoe");
  assert.equal(nuova.cars[1].img, "");
  assert.notEqual(nuova.uid, "b10");
});

test("le quattro gomme vanno ognuna alla sua ruota", () => {
  const { mappa } = dispositivo([
    ["sensor.auto_tyre_fl", "Tyre pressure front left", { unit: "bar" }],
    ["sensor.auto_tyre_fr", "Tyre pressure front right", { unit: "bar" }],
    ["sensor.auto_tyre_rl", "Tyre pressure rear left", { unit: "bar" }],
    ["sensor.auto_tyre_rr", "Tyre pressure rear right", { unit: "bar" }],
  ]);
  assert.equal(mappa["dm.ev_pneumatico_ant_sx"], "sensor.auto_tyre_fl");
  assert.equal(mappa["dm.ev_pneumatico_ant_dx"], "sensor.auto_tyre_fr");
  assert.equal(mappa["dm.ev_pneumatico_post_sx"], "sensor.auto_tyre_rl");
  assert.equal(mappa["dm.ev_pneumatico_post_dx"], "sensor.auto_tyre_rr");
});

test("le parole si leggono nelle lingue che le integrazioni usano davvero", () => {
  /* Il costruttore tedesco scrive «Reichweite», quello francese «Autonomie»:
   * un vocabolario di solo inglese lascerebbe vuote meta' delle caselle. */
  const tedesca = dispositivo([
    ["sensor.auto_reichweite", "Reichweite", { unit: "km" }],
    ["sensor.auto_kilometerstand", "Kilometerstand", { unit: "km" }],
    ["binary_sensor.auto_kofferraum", "Kofferraum"],
    ["binary_sensor.auto_motorhaube", "Motorhaube"],
  ]).mappa;
  assert.equal(tedesca["dm.ev_autonomia"], "sensor.auto_reichweite");
  assert.equal(tedesca["dm.ev_odometro"], "sensor.auto_kilometerstand");
  assert.equal(tedesca["dm.ev_bagagliaio"], "binary_sensor.auto_kofferraum");
  assert.equal(tedesca["dm.ev_cofano"], "binary_sensor.auto_motorhaube");

  const italiana = dispositivo([
    ["sensor.auto_autonomia", "Autonomia", { unit: "km" }],
    ["sensor.auto_contachilometri", "Contachilometri", { unit: "km" }],
  ]).mappa;
  assert.equal(italiana["dm.ev_autonomia"], "sensor.auto_autonomia");
  assert.equal(italiana["dm.ev_odometro"], "sensor.auto_contachilometri");
});

test("da un dispositivo che non e' un'auto non esce nessuna casella", () => {
  /* Chi sceglie il dispositivo sbagliato deve sentirselo dire, non ritrovarsi
   * un'auto vuota. */
  const { mappa } = dispositivo([
    ["switch.presa_cucina", "Presa cucina"],
    ["sensor.presa_cucina_potenza", "Presa cucina Power", { device_class: "power", unit: "W" }],
  ]);
  assert.deepEqual(mappa, {});
});

test("il motore lo dicono le caselle, e nel dubbio si tace", () => {
  assert.equal(motoreDalleCaselle({ "dm.ev_carburante": "sensor.a" }), "termica");
  assert.equal(
    motoreDalleCaselle({ "dm.ev_carburante": "sensor.a", "dm.ev_batteria_auto": "sensor.b" }),
    "ibrida",
  );
  /* «» e' «elettrica», che e' il valore di sempre: dichiarare un motore
   * sbagliato nasconderebbe meta' della pagina. */
  assert.equal(motoreDalleCaselle({ "dm.ev_batteria_auto": "sensor.b" }), "");
  assert.equal(motoreDalleCaselle({}), "");
});

/* ── GdAAuto: per chiave ────────────────────────────────────────────────
 *
 * Un'entita' di GdAAuto si riconosce da `platform` e `translation_key`, come
 * dice il contratto delle sorelle (`docs/DATI-AUTO.md` di GdAAuto): non dal
 * nome, che dipende dalla lingua di Home Assistant, e non dall'entity_id, che
 * dipende da come uno chiama l'auto. */

/* Un'auto di GdAAuto chiamata «Bolide», coi nomi in una lingua che le parole
 * non conoscono: solo la chiave puo' riconoscerle. */
function diGdaauto(righe) {
  const entities = righe.map(([dominio, chiave, extra = {}]) => ({
    entity_id: `${dominio}.bolide_${chiave}`,
    name: `Xq ${chiave.length}`,
    platform: "gdaauto",
    translation_key: chiave,
    device_class: extra.device_class || "",
    unit: extra.unit || "",
    category: extra.category || "",
    disabled: false,
  }));
  return legaLAutoAlDispositivo({ entities, states: {} });
}

test("GdAAuto: ogni chiave del contratto va nella sua casella, in qualunque lingua", () => {
  const { mappa } = diGdaauto([
    ["sensor", "batteria"],
    ["sensor", "autonomia"],
    ["sensor", "energia_residua"],
    ["sensor", "capacita_batteria", { category: "diagnostic" }],
    ["sensor", "consumo_medio"],
    ["sensor", "temperatura_esterna"],
    ["sensor", "temperatura_batteria"],
    ["sensor", "temperatura_interna"],
    ["sensor", "potenza_riscaldatore"],
    ["binary_sensor", "clima_acceso"],
    ["binary_sensor", "batteria_in_riscaldamento"],
    ["sensor", "velocita"],
    ["sensor", "potenza"],
    ["sensor", "odometro"],
    ["sensor", "autonomia_nominale"],
    ["sensor", "stato_ricarica"],
    ["binary_sensor", "cavo_collegato"],
    ["sensor", "potenza_ricarica"],
    ["sensor", "tempo_ricarica"],
    ["number", "limite_ricarica"],
    ["binary_sensor", "ricarica_rapida"],
    ["binary_sensor", "ricarica_programmata"],
    ["sensor", "ricarica_inizio"],
    ["sensor", "ricarica_fine"],
    ["binary_sensor", "v2l"],
    ["switch", "comando_ricarica"],
    ["sensor", "energia_oggi_guida"],
    ["sensor", "energia_oggi_clima"],
    ["sensor", "energia_oggi_altro"],
    ["sensor", "km_7_giorni"],
    ["sensor", "energia_7_giorni"],
    ["sensor", "ultima_ricarica_energia"],
    ["sensor", "ultima_ricarica_tipo"],
    ["sensor", "ultima_ricarica_inizio"],
    ["sensor", "ultima_ricarica_fine"],
    ["lock", "serratura"],
    ["binary_sensor", "bagagliaio"],
    ["binary_sensor", "finestrini"],
    ["binary_sensor", "quadro"],
    ["sensor", "marcia"],
    ["device_tracker", "posizione"],
    ["sensor", "pneumatici_ant_sx"],
    ["sensor", "pneumatici_ant_dx"],
    ["sensor", "pneumatici_post_sx"],
    ["sensor", "pneumatici_post_dx"],
    ["binary_sensor", "pneumatici_allarme"],
    ["binary_sensor", "antifurto"],
    ["binary_sensor", "sentinella"],
    ["binary_sensor", "freno_stazionamento"],
    ["binary_sensor", "sbrinamento"],
    ["binary_sensor", "in_sonno"],
    ["sensor", "ultimo_aggiornamento", { category: "diagnostic" }],
    ["switch", "clima"],
    ["sensor", "carburante"],
    ["sensor", "autonomia_carburante"],
    ["sensor", "autonomia_totale"],
  ]);
  const attese = {
    "dm.ev_batteria_auto": "sensor.bolide_batteria",
    "dm.ev_autonomia": "sensor.bolide_autonomia",
    "dm.ev_energia_residua": "sensor.bolide_energia_residua",
    "dm.ev_capacita_batteria": "sensor.bolide_capacita_batteria",
    "dm.ev_consumo_medio": "sensor.bolide_consumo_medio",
    "dm.ev_temperatura_esterna": "sensor.bolide_temperatura_esterna",
    "dm.ev_temperatura_batteria": "sensor.bolide_temperatura_batteria",
    "dm.ev_temperatura_interna": "sensor.bolide_temperatura_interna",
    "dm.ev_potenza_riscaldatore": "sensor.bolide_potenza_riscaldatore",
    "dm.ev_clima": "binary_sensor.bolide_clima_acceso",
    "dm.ev_batteria_in_riscaldamento": "binary_sensor.bolide_batteria_in_riscaldamento",
    "dm.ev_velocita": "sensor.bolide_velocita",
    "dm.ev_potenza_istantanea": "sensor.bolide_potenza",
    "dm.ev_odometro": "sensor.bolide_odometro",
    "dm.ev_autonomia_nominale": "sensor.bolide_autonomia_nominale",
    "dm.ev_stato_ricarica": "sensor.bolide_stato_ricarica",
    "dm.ev_cavo_collegato": "binary_sensor.bolide_cavo_collegato",
    "dm.ev_potenza_ricarica": "sensor.bolide_potenza_ricarica",
    "dm.ev_tempo_ricarica": "sensor.bolide_tempo_ricarica",
    "dm.ev_target_soc": "number.bolide_limite_ricarica",
    "dm.ev_ricarica_rapida": "binary_sensor.bolide_ricarica_rapida",
    "dm.ev_ricarica_programmata": "binary_sensor.bolide_ricarica_programmata",
    "dm.ev_ricarica_inizio": "sensor.bolide_ricarica_inizio",
    "dm.ev_ricarica_fine": "sensor.bolide_ricarica_fine",
    "dm.ev_v2l": "binary_sensor.bolide_v2l",
    "dm.ev_comando_ricarica": "switch.bolide_comando_ricarica",
    "dm.ev_energia_oggi_guida": "sensor.bolide_energia_oggi_guida",
    "dm.ev_energia_oggi_clima": "sensor.bolide_energia_oggi_clima",
    "dm.ev_energia_oggi_altro": "sensor.bolide_energia_oggi_altro",
    "dm.ev_km_7_giorni": "sensor.bolide_km_7_giorni",
    "dm.ev_energia_7_giorni": "sensor.bolide_energia_7_giorni",
    "dm.ev_ultima_ricarica_energia": "sensor.bolide_ultima_ricarica_energia",
    "dm.ev_ultima_ricarica_tipo": "sensor.bolide_ultima_ricarica_tipo",
    "dm.ev_ultima_ricarica_inizio": "sensor.bolide_ultima_ricarica_inizio",
    "dm.ev_ultima_ricarica_fine": "sensor.bolide_ultima_ricarica_fine",
    "dm.ev_portiere": "lock.bolide_serratura",
    "dm.ev_bagagliaio": "binary_sensor.bolide_bagagliaio",
    "dm.ev_finestrini": "binary_sensor.bolide_finestrini",
    "dm.ev_motore": "binary_sensor.bolide_quadro",
    "dm.ev_marcia": "sensor.bolide_marcia",
    "dm.ev_posizione": "device_tracker.bolide_posizione",
    "dm.ev_pneumatico_ant_sx": "sensor.bolide_pneumatici_ant_sx",
    "dm.ev_pneumatico_ant_dx": "sensor.bolide_pneumatici_ant_dx",
    "dm.ev_pneumatico_post_sx": "sensor.bolide_pneumatici_post_sx",
    "dm.ev_pneumatico_post_dx": "sensor.bolide_pneumatici_post_dx",
    "dm.ev_pneumatici": "binary_sensor.bolide_pneumatici_allarme",
    "dm.ev_allarme": "binary_sensor.bolide_antifurto",
    "dm.ev_sentinella": "binary_sensor.bolide_sentinella",
    "dm.ev_freno_stazionamento": "binary_sensor.bolide_freno_stazionamento",
    "dm.ev_sbrinamento": "binary_sensor.bolide_sbrinamento",
    "dm.ev_in_sonno": "binary_sensor.bolide_in_sonno",
    "dm.ev_ultimo_aggiornamento": "sensor.bolide_ultimo_aggiornamento",
    "dm.ev_comando_clima": "switch.bolide_clima",
    "dm.ev_carburante": "sensor.bolide_carburante",
    "dm.ev_autonomia_carburante": "sensor.bolide_autonomia_carburante",
    "dm.ev_autonomia_totale": "sensor.bolide_autonomia_totale",
  };
  assert.deepEqual(mappa, attese);
  /* E ogni chiave del contratto ha la sua casella: nessuna resta fuori. */
  const caselle = new Set(CHIAVI_DI_GDAAUTO.map(([, ref]) => ref));
  assert.deepEqual(new Set(Object.keys(attese)), caselle);
});

test("GdAAuto: dove due chiavi dicono la stessa casella, vince quella del contratto", () => {
  /* Lo stato della ricarica prima di «in carica», la serratura comandabile
   * prima di quella di sola lettura, e tutte e due prima delle portiere. */
  const { mappa } = diGdaauto([
    ["binary_sensor", "in_carica"],
    ["binary_sensor", "portiere", { device_class: "door" }],
    ["binary_sensor", "serratura", { device_class: "lock" }],
    ["lock", "serratura"],
    ["sensor", "stato_ricarica"],
  ]);
  assert.equal(mappa["dm.ev_stato_ricarica"], "sensor.bolide_stato_ricarica");
  assert.equal(mappa["dm.ev_portiere"], "lock.bolide_serratura");
  /* Senza lo stato, «in carica» lo dice; senza serratura, le portiere. */
  const senza = diGdaauto([
    ["binary_sensor", "in_carica"],
    ["binary_sensor", "portiere", { device_class: "door" }],
  ]).mappa;
  assert.equal(senza["dm.ev_stato_ricarica"], "binary_sensor.bolide_in_carica");
  assert.equal(senza["dm.ev_portiere"], "binary_sensor.bolide_portiere");
  /* La serratura di sola lettura, quando quella che si comanda non c'e'. */
  const solaLettura = diGdaauto([["binary_sensor", "serratura", { device_class: "lock" }]]).mappa;
  assert.equal(solaLettura["dm.ev_portiere"], "binary_sensor.bolide_serratura");
});

test("GdAAuto: una chiave che non e' del contratto non si indovina dalle parole", () => {
  /* Il pulsante «Aggiorna» parla di ricarica in qualche lingua: non e' lo
   * stato della ricarica, e un'entita' di GdAAuto si riconosce per chiave o
   * non si riconosce. */
  const entities = [
    {
      entity_id: "button.bolide_aggiorna",
      name: "Charging refresh",
      platform: "gdaauto",
      translation_key: "aggiorna",
    },
    {
      entity_id: "sensor.bolide_batteria",
      name: "Battery",
      platform: "gdaauto",
      translation_key: "batteria",
      device_class: "battery",
      unit: "%",
    },
  ];
  const { mappa } = legaLAutoAlDispositivo({ entities, states: {} });
  assert.deepEqual(mappa, { "dm.ev_batteria_auto": "sensor.bolide_batteria" });
  /* Un'altra integrazione con la stessa chiave non e' GdAAuto: per lei valgono
   * le parole, come prima. */
  const altra = legaLAutoAlDispositivo({
    entities: [
      { entity_id: "sensor.x_tempo", name: "Boh", platform: "altra", translation_key: "batteria" },
    ],
  }).mappa;
  assert.deepEqual(altra, {});
});

/* ── le catture sbagliate (resoconto, 2d) ─────────────────────────────────
 *
 * Le entita' sono in ordine di entity_id, come le manda il catalogo: e' quello
 * l'ordine in cui la prima che risponde si prende la casella. */

test("l'autonomia di omologazione, a carburante e totale non sono l'autonomia", () => {
  const italiana = dispositivo([
    ["sensor.zoe_autonomia_di_omologazione", "Autonomia di omologazione", { device_class: "distance", unit: "km" }],
    ["sensor.zoe_autonomia_stimata", "Autonomia stimata", { device_class: "distance", unit: "km" }],
  ]).mappa;
  assert.equal(italiana["dm.ev_autonomia"], "sensor.zoe_autonomia_stimata");
  assert.equal(italiana["dm.ev_autonomia_nominale"], "sensor.zoe_autonomia_di_omologazione");
  const inglese = dispositivo([
    ["sensor.car_range", "Range", { device_class: "distance", unit: "km" }],
    ["sensor.car_rated_range", "Rated range", { device_class: "distance", unit: "km" }],
  ]).mappa;
  assert.equal(inglese["dm.ev_autonomia"], "sensor.car_range");
  assert.equal(inglese["dm.ev_autonomia_nominale"], "sensor.car_rated_range");
  /* L'ibrida: tre autonomie, tre caselle. */
  const ibrida = dispositivo([
    ["sensor.phev_autonomia_a_carburante", "Autonomia a carburante", { device_class: "distance", unit: "km" }],
    ["sensor.phev_autonomia_elettrica", "Autonomia elettrica", { device_class: "distance", unit: "km" }],
    ["sensor.phev_autonomia_totale", "Autonomia totale", { device_class: "distance", unit: "km" }],
    ["sensor.phev_batteria", "Batteria", { device_class: "battery", unit: "%" }],
    ["sensor.phev_carburante", "Carburante", { unit: "%" }],
  ]);
  assert.equal(ibrida.mappa["dm.ev_autonomia"], "sensor.phev_autonomia_elettrica");
  assert.equal(ibrida.mappa["dm.ev_autonomia_carburante"], "sensor.phev_autonomia_a_carburante");
  assert.equal(ibrida.mappa["dm.ev_autonomia_totale"], "sensor.phev_autonomia_totale");
  assert.equal(ibrida.tipo, "ibrida");
  /* L'autonomia al limite di carica ha la sua casella da sempre. */
  const alLimite = dispositivo([
    ["sensor.ev_range", "Range", { device_class: "distance", unit: "km" }],
    ["sensor.ev_range_at_charge_limit", "Range at charge limit", { device_class: "distance", unit: "km" }],
  ]).mappa;
  assert.equal(alLimite["dm.ev_autonomia"], "sensor.ev_range");
  assert.equal(alLimite["dm.ev_autonomia_al_limite_di_carica"], "sensor.ev_range_at_charge_limit");
  /* Su un'auto a benzina l'autonomia a carburante e' l'autonomia e basta. */
  const benzina = dispositivo([
    ["sensor.panda_autonomia_carburante", "Autonomia carburante", { device_class: "distance", unit: "km" }],
    ["sensor.panda_carburante", "Carburante", { unit: "%" }],
  ]);
  assert.equal(benzina.mappa["dm.ev_autonomia"], "sensor.panda_autonomia_carburante");
  assert.equal(benzina.mappa["dm.ev_autonomia_carburante"], undefined);
  /* E l'AdBlue non e' ne' il serbatoio ne' l'autonomia (#444). */
  const diesel = dispositivo([
    ["sensor.d_adblue_range", "AdBlue range", { device_class: "distance", unit: "km" }],
    ["sensor.d_adblue_tank_level", "AdBlue tank level", { unit: "%" }],
    ["sensor.d_fuel_level", "Fuel level", { unit: "%" }],
    ["sensor.d_range", "Range", { device_class: "distance", unit: "km" }],
  ]).mappa;
  assert.equal(diesel["dm.ev_carburante"], "sensor.d_fuel_level");
  assert.equal(diesel["dm.ev_autonomia"], "sensor.d_range");
});

test("la batteria da 12 V di Kia e Hyundai non diventa quella di trazione", () => {
  /* «Car Battery Level» e' la 12 V, «EV Battery Level» la trazione: «car»
   * viene prima di «ev», e la classe `battery` ce l'hanno tutte e due. */
  const { mappa } = dispositivo([
    ["sensor.kona_car_battery_level", "Car Battery Level", { device_class: "battery", unit: "%" }],
    ["sensor.kona_ev_battery_level", "EV Battery Level", { device_class: "battery", unit: "%" }],
  ]);
  assert.equal(mappa["dm.ev_batteria_servizio"], "sensor.kona_car_battery_level");
  assert.equal(mappa["dm.ev_batteria_auto"], "sensor.kona_ev_battery_level");
  /* E il traguardo con la classe `battery` non e' la batteria. */
  const traguardo = dispositivo([
    ["sensor.ev_soc", "SoC", { device_class: "battery", unit: "%" }],
    ["sensor.ev_aaa_target_soc", "Target SoC", { device_class: "battery", unit: "%" }],
  ]).mappa;
  assert.equal(traguardo["dm.ev_batteria_auto"], "sensor.ev_soc");
  assert.equal(traguardo["dm.ev_target_soc"], "sensor.ev_aaa_target_soc");
});

test("la potenza, il tempo che manca e i pulsanti non sono lo stato della ricarica", () => {
  const { mappa } = dispositivo([
    ["button.kona_start_charging", "Start charging"],
    ["sensor.kona_charging_power", "Charging power", { device_class: "power", unit: "kW" }],
    ["sensor.kona_charging_state", "Charging state", { state: "Charging" }],
    ["sensor.kona_charging_time_remaining", "Charging time remaining", { device_class: "duration", unit: "min" }],
  ]);
  assert.equal(mappa["dm.ev_stato_ricarica"], "sensor.kona_charging_state");
  assert.equal(mappa["dm.ev_potenza_ricarica"], "sensor.kona_charging_power");
  assert.equal(mappa["dm.ev_tempo_ricarica"], "sensor.kona_charging_time_remaining");
  assert.ok(!Object.values(mappa).includes("button.kona_start_charging"));
  /* E nemmeno la serratura del cavo, che e' un `lock` e parla di «cable». */
  const tesla = dispositivo([
    ["lock.model_y_charge_cable_lock", "Charge cable lock"],
    ["lock.model_y_lock", "Lock"],
    ["sensor.model_y_charging", "Charging", { state: "Charging" }],
  ]).mappa;
  assert.equal(tesla["dm.ev_stato_ricarica"], "sensor.model_y_charging");
  assert.equal(tesla["dm.ev_portiere"], "lock.model_y_lock");
});

test("l'inizio della ricarica programmata non e' lo stato della ricarica", () => {
  for (const [id, nome] of [
    ["sensor.car_inizio_ricarica_programmata", "Inizio ricarica programmata"],
    ["sensor.car_scheduled_charging_start", "Scheduled charging start"],
  ]) {
    const solo = dispositivo([[id, nome, { device_class: "timestamp" }]]).mappa;
    assert.equal(solo["dm.ev_stato_ricarica"], undefined, nome);
    const conLoStato = dispositivo([
      [id, nome, { device_class: "timestamp" }],
      ["sensor.car_stato_ricarica", "Stato ricarica", { state: "charging" }],
    ]).mappa;
    assert.equal(conLoStato["dm.ev_stato_ricarica"], "sensor.car_stato_ricarica", nome);
  }
  /* Anche senza classe: un orario si riconosce dalle parole. */
  const senzaClasse = dispositivo([["sensor.car_scheduled_charging_start", "Scheduled charging start"]]).mappa;
  assert.equal(senzaClasse["dm.ev_stato_ricarica"], undefined);
});

test("«Consumo ultimo viaggio» non e' l'ultimo viaggio", () => {
  const { mappa } = dispositivo([
    ["sensor.auto_consumo_ultimo_viaggio", "Consumo ultimo viaggio", { unit: "kWh/100 km" }],
    ["sensor.auto_ultimo_viaggio", "Ultimo viaggio", { device_class: "distance", unit: "km" }],
  ]);
  assert.equal(mappa["dm.ev_ultimo_viaggio"], "sensor.auto_ultimo_viaggio");
  assert.ok(!Object.values(mappa).includes("sensor.auto_consumo_ultimo_viaggio"));
  const inglese = dispositivo([
    ["sensor.car_last_trip_consumption", "Last trip consumption", { unit: "kWh/100km" }],
  ]).mappa;
  assert.deepEqual(inglese, {});
  /* Il carburante dell'ultimo viaggio non e' ne' l'ultimo viaggio ne' il totale. */
  const benzina = dispositivo([
    ["sensor.x_carburante_consumato_ultimo_viaggio", "Carburante consumato ultimo viaggio", { unit: "L" }],
    ["sensor.x_carburante_totale", "Carburante totale", { unit: "L" }],
  ]).mappa;
  assert.equal(benzina["dm.ev_ultimo_viaggio"], undefined);
  assert.equal(benzina["dm.ev_carburante_totale"], "sensor.x_carburante_totale");
  /* Il consumo medio, invece, ha la sua casella. */
  const medio = dispositivo([
    ["sensor.de_durchschnittsverbrauch", "Durchschnittsverbrauch", { unit: "kWh/100km" }],
    ["sensor.de_verbrauch_letzte_fahrt", "Verbrauch letzte Fahrt", { unit: "kWh/100km" }],
  ]).mappa;
  assert.equal(medio["dm.ev_consumo_medio"], "sensor.de_durchschnittsverbrauch");
  assert.equal(medio["dm.ev_carburante_totale"], undefined);
});

test("la temperatura di una gomma non e' la sua pressione", () => {
  const { mappa } = dispositivo([
    ["sensor.ev_tire_pressure_front_left", "Tire pressure front left", { device_class: "pressure", unit: "bar" }],
    ["sensor.ev_tire_temperature_front_left", "Tire temperature front left", { device_class: "temperature", unit: "°C" }],
  ]);
  assert.equal(mappa["dm.ev_pneumatico_ant_sx"], "sensor.ev_tire_pressure_front_left");
  assert.ok(!Object.values(mappa).includes("sensor.ev_tire_temperature_front_left"));
  /* Anche quando la temperatura viene prima in ordine alfabetico. */
  const prima = dispositivo([
    ["sensor.ev_a_tire_temp_fl", "Tire temp front left", { unit: "°C" }],
    ["sensor.ev_b_tire_fl", "Tire front left", { unit: "bar" }],
  ]).mappa;
  assert.equal(prima["dm.ev_pneumatico_ant_sx"], "sensor.ev_b_tire_fl");
  assert.equal(prima["dm.ev_pneumatici"], undefined);
});

test("un limite di corrente in ampere non e' il traguardo della carica", () => {
  const { mappa } = dispositivo([
    ["number.ev_limite_corrente_di_ricarica", "Limite corrente di ricarica", { unit: "A" }],
    ["number.ev_limite_di_carica", "Limite di carica", { unit: "%" }],
  ]);
  assert.equal(mappa["dm.ev_target_soc"], "number.ev_limite_di_carica");
  const solo = dispositivo([
    ["number.ev_charging_current_limit", "Charging current limit", { unit: "A" }],
  ]).mappa;
  assert.equal(solo["dm.ev_target_soc"], undefined);
  /* «Charge limit» di Tesla, che prima non si riconosceva. */
  const tesla = dispositivo([["number.model_y_charge_limit", "Charge limit", { unit: "%" }]]).mappa;
  assert.equal(tesla["dm.ev_target_soc"], "number.model_y_charge_limit");
});

test("la temperatura del motore e il suo pulsante non sono il motore acceso", () => {
  const { mappa } = dispositivo([
    ["binary_sensor.ev_engine", "Engine"],
    ["button.ev_aa_remote_engine_start", "Remote engine start"],
    ["sensor.ev_engine_coolant_temperature", "Engine coolant temperature", { device_class: "temperature", unit: "°C" }],
    ["sensor.ev_engine_oil_temperature", "Engine oil temperature", { device_class: "temperature", unit: "°C" }],
  ]);
  assert.equal(mappa["dm.ev_motore"], "binary_sensor.ev_engine");
  assert.equal(mappa["dm.ev_temperatura_olio"], "sensor.ev_engine_oil_temperature");
  /* E il lunotto termico non e' un finestrino aperto. */
  const lunotto = dispositivo([["switch.car_rear_window_heater", "Rear window heater"]]).mappa;
  assert.equal(lunotto["dm.ev_finestrini"], undefined);
});
