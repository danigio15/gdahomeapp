/* La pagina Auto si legge a colpo d'occhio: i conti, senza browser.
 *
 * «Nella sezione Auto riesci a fare qualcosa di piu' bello con tutti sti dati,
 * cosi' non si capisce niente.» I dati dell'auto non stanno piu' in una
 * griglia di tessere uguali: si mettono insieme per quello che dicono. Qui si
 * prova il nucleo di quei blocchi — il tempo detto in ore, l'energia di oggi
 * divisa in tre, la settimana, le gomme con il loro colore, cosa sta facendo
 * l'auto — e che il tempo dell'auto vinca sul conto della plancia.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  CASELLE_DELL_AUTO,
  FORCELLA_DELLE_GOMME,
  RIFERIMENTI_IN_BLOCCO,
  comeStannoLeGomme,
  cosaFaLAuto,
  energiaDiOggi,
  laSettimana,
  letturaTermica,
  temperatureDellAuto,
} from "../src/core/auto-termica.js";
import {
  durataInParole,
  minutiDallaDurata,
  quandoFinisce,
  tempoDellaRicarica,
} from "../src/core/il-tempo-della-ricarica.js";
import {
  fineCorta,
  paroleCorteDelTempo,
} from "../src/sections/il-popup-dell-auto-racconta-section.js";

const stato = (state, unit = "") => ({
  state: String(state),
  attributes: unit ? { unit_of_measurement: unit } : {},
});

/* Un'auto che arriva da GdAAuto, come quella della fotografia del campo. */
function lettura(valori) {
  const mappa = {};
  const stati = {};
  for (const [ref, [valore, unita]] of Object.entries(valori)) {
    const entita = `sensor.${ref.slice(6)}`;
    mappa[ref] = entita;
    stati[entita] = stato(valore, unita);
  }
  return letturaTermica(mappa, stati);
}

test("i minuti si dicono in ore e minuti, mai «1045 min»", () => {
  assert.equal(durataInParole(803), "13 h 23 min");
  assert.equal(durataInParole(1045), "17 h 25 min");
  assert.equal(durataInParole(120), "2 h");
  assert.equal(durataInParole(45), "45 min");
  assert.equal(durataInParole(0), "0 min");
  assert.equal(durataInParole(59.6), "1 h");
  for (const niente of [null, undefined, "", -5, "boh"]) assert.equal(durataInParole(niente), "");
});

test("un sensore di durata si legge nella sua unita'", () => {
  assert.equal(minutiDallaDurata("1045", "min"), 1045);
  assert.equal(minutiDallaDurata("1045"), 1045);
  assert.equal(minutiDallaDurata("2.5", "h"), 150);
  assert.equal(minutiDallaDurata("600", "s"), 10);
  assert.equal(minutiDallaDurata("1", "d"), 1440);
  assert.equal(minutiDallaDurata("unknown", "min"), null);
  assert.equal(minutiDallaDurata("-3", "min"), null);
});

test("la fine della carica: oggi, domani, o il giorno della settimana", () => {
  const sera = new Date(2026, 9, 18, 22, 10).getTime();
  assert.deepEqual(
    { ...quandoFinisce(30, sera), fine: undefined },
    { giorno: "oggi", ora: "22:40", fine: undefined },
  );
  assert.equal(quandoFinisce(803, sera).giorno, "domani");
  assert.equal(quandoFinisce(803, sera).ora, "11:33");
  assert.equal(quandoFinisce(3000, sera).giorno, "poi");
  assert.equal(quandoFinisce(null, sera), null);
  /* In parole, accanto all'anello: minuscolo, senza «RIM.». */
  assert.equal(fineCorta({ stato: "carica", minuti: 803 }, sera), "fine domani alle 11:33");
  assert.equal(fineCorta({ stato: "carica", minuti: 30 }, sera), "fine alle 22:40");
  assert.equal(fineCorta({ stato: "attesa", minuti: null }, sera), "");
  assert.equal(paroleCorteDelTempo({ stato: "carica", minuti: 803 }), "13 h 23 min");
  assert.equal(paroleCorteDelTempo({ stato: "attesa", minuti: null }), "In attesa");
  assert.equal(paroleCorteDelTempo({ stato: "completa", minuti: null }), "Carica completa");
});

test("quando l'auto dice quanto manca, si crede a lei", () => {
  /* La colonnina conterebbe 13 h 23 min, l'auto dice 1045 minuti. */
  assert.deepEqual(
    tempoDellaRicarica({
      codice: "C",
      soc: 67.8,
      target: 100,
      kilowatt: 1.61,
      minutiDellAuto: 1045,
    }),
    { stato: "carica", minuti: 1045 },
  );
  /* Senza colonnina il tempo dell'auto basta da solo. */
  assert.equal(
    tempoDellaRicarica({ codice: "C", soc: 67.8, target: 100, minutiDellAuto: 1045 }).minuti,
    1045,
  );
  /* Ferma, o col target gia' raggiunto, il numero dell'auto non vale. */
  assert.equal(
    tempoDellaRicarica({ codice: "B", soc: 67.8, target: 100, minutiDellAuto: 1045 }).stato,
    "attesa",
  );
  assert.equal(
    tempoDellaRicarica({ codice: "C", soc: 100, target: 100, minutiDellAuto: 5 }).stato,
    "completa",
  );
  /* Zero minuti non e' una risposta: resta il conto. */
  assert.equal(
    tempoDellaRicarica({
      codice: "C",
      soc: 30,
      target: 80,
      kilowatt: 10,
      capacita: 40,
      minutiDellAuto: 0,
    }).minuti,
    120,
  );
});

test("l'energia di oggi: una barra divisa in tre, con il totale", () => {
  const oggi = energiaDiOggi(
    lettura({
      "dm.ev_energia_oggi_guida": ["4.2", "kWh"],
      "dm.ev_energia_oggi_clima": ["800", "Wh"],
      "dm.ev_energia_oggi_altro": ["0.3", "kWh"],
    }),
  );
  assert.equal(Math.round(oggi.totale * 10) / 10, 5.3);
  assert.deepEqual(
    oggi.parti.map((parte) => parte.parte),
    ["guida", "clima", "altro"],
  );
  /* I wattora sono kilowattora divisi per mille. */
  assert.equal(oggi.parti[1].kwh, 0.8);
  const quote = oggi.parti.reduce((somma, parte) => somma + parte.quota, 0);
  assert.ok(Math.abs(quote - 1) < 1e-9);

  /* La fotografia del campo: 0,1 di guida e due zeri. */
  const poco = energiaDiOggi(
    lettura({
      "dm.ev_energia_oggi_guida": ["0.1", "kWh"],
      "dm.ev_energia_oggi_clima": ["0", "kWh"],
      "dm.ev_energia_oggi_altro": ["0", "kWh"],
    }),
  );
  assert.equal(poco.totale, 0.1);
  assert.equal(poco.parti[0].quota, 1);
  /* Tutto a zero: niente divisioni per niente, la barra resta vuota. */
  const zero = energiaDiOggi(lettura({ "dm.ev_energia_oggi_guida": ["0", "kWh"] }));
  assert.deepEqual(zero, {
    totale: 0,
    parti: [{ parte: "guida", ref: "dm.ev_energia_oggi_guida", kwh: 0, quota: 0 }],
  });
  /* Un sensore muto non e' uno zero, e senza sensori non c'e' blocco. */
  const muto = energiaDiOggi(
    letturaTermica(
      { "dm.ev_energia_oggi_guida": "sensor.g", "dm.ev_energia_oggi_clima": "sensor.c" },
      { "sensor.g": stato("unavailable"), "sensor.c": stato("1.5", "kWh") },
    ),
  );
  assert.deepEqual(
    muto.parti.map((parte) => parte.parte),
    ["clima"],
  );
  assert.equal(energiaDiOggi(lettura({})), null);
});

test("la settimana: chilometri, energia e consumo, anche calcolato", () => {
  const dichiarata = laSettimana(
    lettura({
      "dm.ev_km_7_giorni": ["411", "km"],
      "dm.ev_energia_7_giorni": ["57", "kWh"],
      "dm.ev_consumo_medio": ["16", "kWh/100 km"],
    }),
  );
  assert.deepEqual(dichiarata, { km: 411, kwh: 57, consumo: 16, calcolato: false });
  /* Il consumo in Wh/km si porta in kWh/100 km. */
  assert.equal(laSettimana(lettura({ "dm.ev_consumo_medio": ["158", "Wh/km"] })).consumo, 15.8);
  /* Senza consumo dichiarato si fa la divisione, e lo si dice. */
  const calcolata = laSettimana(
    lettura({ "dm.ev_km_7_giorni": ["400", "km"], "dm.ev_energia_7_giorni": ["60", "kWh"] }),
  );
  assert.equal(calcolata.consumo, 15);
  assert.equal(calcolata.calcolato, true);
  assert.equal(laSettimana(lettura({})), null);
});

test("le gomme: verdi a posto, ambra basse, alte o in avviso", () => {
  const giuste = comeStannoLeGomme(
    lettura({
      "dm.ev_pneumatico_ant_sx": ["2.3", "bar"],
      "dm.ev_pneumatico_ant_dx": ["2.3", "bar"],
      "dm.ev_pneumatico_post_sx": ["2.3", "bar"],
      "dm.ev_pneumatico_post_dx": ["2.3", "bar"],
    }),
  );
  assert.equal(giuste.verdetto, "bene");
  assert.deepEqual(
    giuste.ruote.map((ruota) => ruota.tono),
    ["bene", "bene", "bene", "bene"],
  );

  const una = comeStannoLeGomme(
    lettura({
      "dm.ev_pneumatico_ant_sx": ["2.4", "bar"],
      "dm.ev_pneumatico_ant_dx": ["2.4", "bar"],
      "dm.ev_pneumatico_post_sx": ["1.7", "bar"],
      "dm.ev_pneumatico_post_dx": ["3.9", "bar"],
    }),
  );
  assert.deepEqual(
    una.ruote.map((ruota) => ruota.tono),
    ["bene", "bene", "bassa", "alta"],
  );
  assert.equal(una.verdetto, "attento");

  /* Una gomma che sta 0,3 bar sotto le altre si sta sgonfiando, anche se il
   * numero da solo sembrerebbe a posto. */
  const lenta = comeStannoLeGomme(
    lettura({
      "dm.ev_pneumatico_ant_sx": ["2.5", "bar"],
      "dm.ev_pneumatico_ant_dx": ["2.2", "bar"],
    }),
  );
  assert.deepEqual(
    lenta.ruote.map((ruota) => ruota.tono),
    ["bene", "bassa"],
  );
  assert.equal(FORCELLA_DELLE_GOMME.scarto, 0.3);

  /* In psi e in kPa: 33 psi e 230 kPa sono pressioni normali. */
  const psi = comeStannoLeGomme(
    lettura({
      "dm.ev_pneumatico_ant_sx": ["33", "psi"],
      "dm.ev_pneumatico_ant_dx": ["230", "kPa"],
    }),
  );
  assert.deepEqual(
    psi.ruote.map((ruota) => ruota.tono),
    ["bene", "bene"],
  );

  /* Il sensore che dice solo «problema», e l'avviso unico dell'auto. */
  const avviso = comeStannoLeGomme(
    letturaTermica(
      { "dm.ev_pneumatico_post_dx": "binary_sensor.pd", "dm.ev_pneumatici": "binary_sensor.tpms" },
      { "binary_sensor.pd": stato("on"), "binary_sensor.tpms": stato("off") },
    ),
  );
  assert.equal(avviso.ruote[0].tono, "avviso");
  assert.equal(avviso.verdetto, "attento");
  const soloAvviso = comeStannoLeGomme(
    letturaTermica(
      { "dm.ev_pneumatici": "binary_sensor.tpms" },
      { "binary_sensor.tpms": stato("off") },
    ),
  );
  assert.equal(soloAvviso.verdetto, "bene");
  assert.equal(comeStannoLeGomme(lettura({})).verdetto, "");
});

test("cosa sta facendo l'auto: parcheggiata, in marcia, o non si sa", () => {
  assert.equal(cosaFaLAuto(lettura({ "dm.ev_marcia": ["parcheggio"] })), "ferma");
  assert.equal(cosaFaLAuto(lettura({ "dm.ev_marcia": ["avanti"] })), "marcia");
  assert.equal(cosaFaLAuto(lettura({ "dm.ev_marcia": ["R"] })), "marcia");
  assert.equal(cosaFaLAuto(lettura({ "dm.ev_velocita": ["48", "km/h"] })), "marcia");
  assert.equal(
    cosaFaLAuto(
      letturaTermica(
        { "dm.ev_freno_stazionamento": "binary_sensor.f" },
        { "binary_sensor.f": stato("on") },
      ),
    ),
    "ferma",
  );
  assert.equal(cosaFaLAuto(lettura({})), "");
});

test("le temperature stanno insieme, nell'ordine dell'auto", () => {
  const gradi = temperatureDellAuto(
    lettura({
      "dm.ev_temperatura_esterna": ["14", "°C"],
      "dm.ev_temperatura_batteria": ["21", "°C"],
      "dm.ev_temperatura_interna": ["24", "°C"],
    }),
  );
  assert.deepEqual(
    gradi.map((voce) => [voce.chi, voce.gradi]),
    [
      ["batteria", 21],
      ["abitacolo", 24],
      ["esterna", 14],
    ],
  );
});

test("ogni dato ha un posto: un blocco suo, una pillola, o gli altri dati", () => {
  /* Quello che ha un blocco non si ripete fra gli altri dati; quello che non
   * ce l'ha ci finisce, cosi' niente di configurato si perde. */
  for (const ref of RIFERIMENTI_IN_BLOCCO)
    assert.ok(
      CASELLE_DELL_AUTO.some((voce) => voce.ref === ref) || /temperatura_(esterna|olio)/.test(ref),
      `${ref} non e' un dato dell'auto`,
    );
  for (const ref of [
    "dm.ev_energia_oggi_guida",
    "dm.ev_km_7_giorni",
    "dm.ev_consumo_medio",
    "dm.ev_tempo_ricarica",
    "dm.ev_temperatura_batteria",
  ])
    assert.ok(RIFERIMENTI_IN_BLOCCO.has(ref), ref);
  for (const ref of ["dm.ev_energia_residua", "dm.ev_capacita_batteria", "dm.ev_velocita"])
    assert.ok(!RIFERIMENTI_IN_BLOCCO.has(ref), `${ref} deve restare fra gli altri dati`);
});
