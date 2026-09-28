/* I contatori di casa: l'acqua e il gas (#115, #135, #137).
 *
 * «Manca una sezione per monitorare portata e pressione dell'impianto idrico di
 * casa, magari anche l'addolcitore per vedere il livello del sale.» «Si
 * potrebbero mettere sezioni come consumi e contatore acqua e energia gas.»
 * «Potresti creare una sezione consumo gas.»
 *
 * Qui si tiene ferma la parte che si prova a tavolino: le unità dei volumi,
 * come si dice un volume, il gas in kilowattora e in euro, la perdita, i giorni
 * di sale che restano.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  CAMPI_IN_PIU,
  KWH_PER_METRO_CUBO,
  ORE_PRIMA_DELLA_PERDITA,
  comeSiDiceIlVolume,
  comeStaIlSale,
  comeStannoIContatori,
  consumiDallaRisposta,
  contatoreDaProporre,
  contatoriConfigurati,
  contatoriDaImportare,
  contatoriDiCasa,
  domandaDeiConsumi,
  domandaDelleOre,
  genereDelSensore,
  giorniDiSale,
  giudizioDellaPerdita,
  giudizioDellaPressione,
  inBar,
  inLitri,
  inLitriAlMinuto,
  kwhDelGas,
  letturaDelContatore,
  litriPerUnita,
  nessunaOraFerma,
  oreDallaRisposta,
  quantoCosta,
  scorreDa,
  serieDallaStoria,
  serieDalleStatistiche,
} from "../src/core/contatori-di-casa.js";

const ORA = Date.parse("2026-09-28T12:00:00Z");
const H = 3600000;
const GIORNO = 24 * H;

/* ── i volumi ───────────────────────────────────────────────────────────── */

test("un contatore si legge in litri, qualunque unità dichiari", () => {
  assert.equal(inLitri("128.4", "m³"), 128400);
  /* Il metro cubo arriva anche senza esponente, e la virgola dalle
   * integrazioni scritte in italiano. */
  assert.equal(inLitri("1,5", "m3"), 1500);
  assert.equal(inLitri(5, "L"), 5);
  assert.ok(Math.abs(inLitri(1, "gal") - 3.785) < 0.001);
  /* Quello che non è un volume non diventa un numero finto. */
  assert.equal(inLitri("12", "kWh"), null);
  assert.equal(inLitri("unavailable", "m³"), null);
  assert.equal(litriPerUnita(""), null);
});

test("una giornata d'acqua si dice in litri, un mese in metri cubi", () => {
  /* «214 litri oggi» è come si pensa una giornata; «6,2 m³» è la bolletta. */
  assert.deepEqual(comeSiDiceIlVolume(214.4), { valore: 214, unita: "L", decimali: 0 });
  assert.deepEqual(comeSiDiceIlVolume(6200), { valore: 6.2, unita: "m³", decimali: 1 });
  /* Oltre i cento metri cubi i decimali non dicono più niente. */
  assert.deepEqual(comeSiDiceIlVolume(128400), { valore: 128.4, unita: "m³", decimali: 0 });
  assert.equal(comeSiDiceIlVolume(null), null);
});

/* ── il gas ─────────────────────────────────────────────────────────────── */

test("il gas si confronta in kilowattora, col coefficiente della bolletta", () => {
  assert.equal(kwhDelGas(10), 10 * KWH_PER_METRO_CUBO);
  /* Chi copia il suo dalla bolletta lo ritrova. */
  assert.equal(kwhDelGas(10, 10.57), 105.7);
  /* Un coefficiente scritto male non azzera il gas: vale quello di default. */
  assert.equal(kwhDelGas(10, 0), 10 * KWH_PER_METRO_CUBO);
  assert.equal(kwhDelGas(null), null);
});

test("il costo c'è solo col prezzo", () => {
  assert.ok(Math.abs(quantoCosta(74, 0.924) - 68.376) < 1e-9);
  /* Senza prezzo non si inventa: niente euro, invece di zero euro. */
  assert.equal(quantoCosta(74, null), null);
  assert.equal(quantoCosta(74, 0), null);
});

/* ── la perdita ─────────────────────────────────────────────────────────── */

const portata = (...voci) =>
  voci.map(([ore, valore]) => ({ stato: String(valore), quando: ORA - ore * H }));

test("l'acqua che scorre da tre ore senza fermarsi è una perdita", () => {
  const righe = portata([10, 0], [3.5, 6], [2, 5.5], [0.5, 6.2]);
  const scorre = scorreDa(righe, { adesso: ORA, da: ORA - GIORNO });
  assert.equal(scorre.quando, ORA - 3.5 * H);
  const giudizio = giudizioDellaPerdita(scorre, { adesso: ORA });
  assert.equal(giudizio.perdita, true);
  assert.equal(giudizio.ore, 3.5);
  assert.equal(ORE_PRIMA_DELLA_PERDITA, 3);
});

test("l'acqua che si ferma anche solo per un po' è acqua usata, non una perdita", () => {
  /* La doccia, poi niente per mezz'ora, poi la lavatrice: fra un colpo e
   * l'altro la portata torna a zero, e una perdita non ci torna mai. */
  const righe = portata([10, 0], [3.5, 6], [1.5, 0], [1, 6]);
  const giudizio = giudizioDellaPerdita(scorreDa(righe, { adesso: ORA, da: ORA - GIORNO }), {
    adesso: ORA,
  });
  assert.equal(giudizio.perdita, false);
  assert.equal(giudizio.ore, 1);
});

test("uno zero di pochi secondi è una lettura persa, non un rubinetto chiuso", () => {
  const righe = [
    { stato: "0", quando: ORA - 10 * H },
    { stato: "4", quando: ORA - 4 * H },
    { stato: "0", quando: ORA - 2 * H },
    { stato: "4", quando: ORA - 2 * H + 20_000 },
  ];
  const giudizio = giudizioDellaPerdita(scorreDa(righe, { adesso: ORA, da: ORA - GIORNO }), {
    adesso: ORA,
  });
  assert.equal(giudizio.perdita, true);
  assert.equal(giudizio.ore, 4);
});

test("adesso ferma vuol dire nessuna perdita, qualunque cosa sia successo prima", () => {
  const righe = portata([10, 5], [0.2, 0]);
  assert.equal(scorreDa(righe, { adesso: ORA, da: ORA - GIORNO }), null);
  assert.deepEqual(giudizioDellaPerdita(null, { adesso: ORA }), { perdita: false, ore: 0 });
});

test("se scorreva già all'inizio della storia, l'ora è un «da prima di»", () => {
  const righe = portata([24, 3], [5, 4]);
  const scorre = scorreDa(righe, { adesso: ORA, da: ORA - GIORNO });
  assert.equal(scorre.certo, false);
  assert.equal(giudizioDellaPerdita(scorre, { adesso: ORA }).certo, false);
});

test("senza sensore di portata: un giorno intero senza un'ora ferma", () => {
  /* Di notte una casa ha sempre un'ora senz'acqua. Chi non ce l'ha per
   * ventiquattro ore di fila ha qualcosa che scorre mentre dormono tutti. */
  assert.equal(nessunaOraFerma(Array(24).fill(0.004)), true);
  assert.equal(nessunaOraFerma([...Array(23).fill(12), 0]), false);
  /* Meno di un giorno di storia non basta a dirlo. */
  assert.equal(nessunaOraFerma(Array(20).fill(5)), false);
  /* Un'ora senza dato non conta come un'ora che scorre. */
  assert.equal(nessunaOraFerma([...Array(23).fill(3), null]), false);
});

/* ── il sale ────────────────────────────────────────────────────────────── */

test("il sale si dice in giorni: quando ricomprarlo", () => {
  /* Tre punti al giorno, da 60 a 42: a quel passo, dieci giorni al 10%. */
  const serie = [0, 1, 2, 3, 4, 5, 6].map((giorno) => ({
    quando: ORA - (6 - giorno) * GIORNO,
    valore: 60 - giorno * 3,
  }));
  assert.equal(giorniDiSale(serie), 10);
  assert.equal(giorniDiSale(serie, { soglia: 30 }), 4);
});

test("dopo un carico di sale la retta riparte da lì", () => {
  /* Il carico di tre giorni fa farebbe salire la retta: si guarda da lì in
   * poi, e da lì in poi scende di due al giorno. */
  const serie = [
    { quando: ORA - 6 * GIORNO, valore: 14 },
    { quando: ORA - 5 * GIORNO, valore: 12 },
    { quando: ORA - 3 * GIORNO, valore: 90 },
    { quando: ORA - 2 * GIORNO, valore: 88 },
    { quando: ORA - 1 * GIORNO, valore: 86 },
    { quando: ORA, valore: 84 },
  ];
  assert.equal(giorniDiSale(serie), 37);
});

test("senza abbastanza giorni, o col sale che non scende, non si inventa", () => {
  assert.equal(giorniDiSale([]), null);
  assert.equal(
    giorniDiSale([
      { quando: ORA - GIORNO, valore: 50 },
      { quando: ORA, valore: 49 },
    ]),
    null,
  );
  const fermo = [0, 1, 2, 3].map((g) => ({ quando: ORA - g * GIORNO, valore: 40 }));
  assert.equal(giorniDiSale(fermo), null);
});

/* ── cosa misura un sensore ─────────────────────────────────────────────── */

const sensore = (unita, attributi = {}, stato = "1") => ({
  state: stato,
  attributes: { unit_of_measurement: unita, ...attributi },
});

test("il genere lo dice la classe, poi l'unità, e per ultimo il nome", () => {
  assert.equal(genereDelSensore("sensor.x", sensore("m³", { device_class: "gas" })), "gas");
  assert.equal(genereDelSensore("sensor.x", sensore("L", { device_class: "water" })), "acqua");
  assert.equal(genereDelSensore("sensor.x", sensore("L/min")), "portata");
  assert.equal(genereDelSensore("sensor.x", sensore("bar")), "pressione");
  assert.equal(genereDelSensore("sensor.addolcitore_sale", sensore("%")), "sale");
  /* Un metro cubo senza classe è acqua, a meno che il nome non dica gas. */
  assert.equal(genereDelSensore("sensor.contatore", sensore("m³")), "acqua");
  assert.equal(genereDelSensore("sensor.contatore_metano", sensore("m³")), "gas");
  /* Il barometro non è l'impianto: l'ettopascal resta fuori. */
  assert.equal(
    genereDelSensore("sensor.pressione_aria", sensore("hPa", { device_class: "pressure" })),
    "",
  );
});

test("si propone un contatore che conta, e mai la pressione della caldaia", () => {
  const conta = { state_class: "total_increasing" };
  /* Il contatore della casa demo: metri cubi, nessuna classe, «acqua» nel nome. */
  assert.equal(contatoreDaProporre("sensor.contatore_acqua", sensore("m³", conta)), "acqua");
  /* Un metro cubo qualunque senza classe e senza nome che lo dica no. */
  assert.equal(contatoreDaProporre("sensor.volume_cisterna", sensore("m³", conta)), "");
  /* Una lettura che non conta — un livello, una misura — non è un contatore. */
  assert.equal(
    contatoreDaProporre("sensor.acqua_cisterna", sensore("m³", { state_class: "measurement" })),
    "",
  );
  assert.equal(
    contatoreDaProporre("sensor.gas", sensore("m³", { device_class: "gas", ...conta })),
    "gas",
  );
  assert.equal(
    contatoreDaProporre("sensor.acqua_pressione", sensore("bar", { device_class: "pressure" })),
    "pressione",
  );
  assert.equal(
    contatoreDaProporre(
      "sensor.caldaia_pressione_acqua",
      sensore("bar", { device_class: "pressure" }),
    ),
    "",
  );
  /* Un bar senza «acqua» nel nome può essere qualunque cosa: non si propone. */
  assert.equal(
    contatoreDaProporre("sensor.impianto_pressione", sensore("bar", { device_class: "pressure" })),
    "",
  );
  assert.equal(
    contatoreDaProporre("sensor.portata", sensore("L/min", { device_class: "volume_flow_rate" })),
    "portata",
  );
  assert.equal(contatoreDaProporre("binary_sensor.acqua", sensore("", {})), "");
});

test("l'importazione porta i generi in ordine, e non ripropone quello che c'è già", () => {
  const states = {
    "sensor.contatore_gas": sensore("m³", {
      device_class: "gas",
      state_class: "total_increasing",
      friendly_name: "Contatore gas",
    }),
    "sensor.contatore_acqua": sensore("m³", {
      state_class: "total_increasing",
      friendly_name: "Contatore acqua",
    }),
    "sensor.addolcitore_sale": sensore("%", { friendly_name: "Sale" }),
    "sensor.acqua_pressione": sensore("bar", {
      device_class: "pressure",
      friendly_name: "Pressione",
    }),
  };
  const nome = (entity) => states[entity].attributes.friendly_name;
  assert.deepEqual(
    contatoriDaImportare(states, undefined, nome).map((riga) => [
      riga.entity,
      riga.genere,
      riga.icon,
    ]),
    [
      ["sensor.contatore_acqua", "acqua", "meter"],
      ["sensor.contatore_gas", "gas", "flame"],
      ["sensor.acqua_pressione", "pressione", "gauge"],
      ["sensor.addolcitore_sale", "sale", "softener"],
    ],
  );
  const config = { righe: [{ entity: "sensor.contatore_gas", name: "Gas", genere: "gas" }] };
  assert.ok(
    !contatoriDaImportare(states, config, nome).some(
      (riga) => riga.entity === "sensor.contatore_gas",
    ),
  );
});

test("la sezione nasce vuota: la accende una riga dichiarata, non un metro cubo trovato", () => {
  assert.equal(contatoriConfigurati(undefined), false);
  assert.equal(contatoriConfigurati({ righe: [] }), false);
  /* Una riga cominciata e non finita non basta. */
  assert.equal(contatoriConfigurati({ righe: [{ entity: "", name: "Contatore nuovo" }] }), false);
  assert.equal(contatoriConfigurati({ righe: [{ entity: "sensor.acqua" }] }), true);
  /* I campi in più passano per nome, e restano. */
  assert.deepEqual(CAMPI_IN_PIU, [
    "genere",
    "prezzo",
    "coefficiente",
    "minimo",
    "massimo",
    "soglia",
  ]);
});

test("una riga letta: il genere scritto vince, e le unità si riportano a bar e litri al minuto", () => {
  const riga = { entity: "sensor.p", name: "Pressione", genere: "pressione", minimo: "1,5" };
  const letta = letturaDelContatore(riga, sensore("psi", {}, "43.5"));
  assert.ok(Math.abs(letta.bar - 3) < 0.01);
  assert.equal(letta.minimo, 1.5);
  assert.equal(letta.icon, "gauge");
  assert.ok(Math.abs(inLitriAlMinuto("0.36", "m³/h") - 6) < 1e-9);
  assert.equal(inBar("2.8", "bar"), 2.8);
  assert.equal(inBar("1013", "hPa"), null);
  /* Chi non risponde è muto, non zero. */
  assert.equal(letturaDelContatore(riga, { state: "unavailable", attributes: {} }).muto, true);
  /* Senza genere scritto lo dice il sensore. */
  assert.equal(letturaDelContatore({ entity: "sensor.q" }, sensore("L/min")).genere, "portata");
});

test("le righe si leggono nell'ordine dei generi, e dentro come le si è scritte", () => {
  const config = {
    righe: [
      { entity: "sensor.sale", genere: "sale" },
      { entity: "sensor.gas", genere: "gas" },
      { entity: "sensor.acqua_2", genere: "acqua" },
      { entity: "sensor.acqua_1", genere: "acqua" },
    ],
  };
  assert.deepEqual(
    contatoriDiCasa({}, config).map((lettura) => lettura.entity),
    ["sensor.acqua_2", "sensor.acqua_1", "sensor.gas", "sensor.sale"],
  );
});

/* ── le domande al Recorder ─────────────────────────────────────────────── */

const ALLE_DIECI = new Date(2026, 8, 28, 10, 0, 0).getTime();
const giorno = (mese, numero) => new Date(2026, mese, numero, 0, 0, 0).getTime();

test("le domande passano dal ponte: statistics_during_period, al plurale", () => {
  /* Il ponte e il pannello lasciano passare questa sola. */
  const consumi = domandaDeiConsumi(["sensor.acqua", "sensor.acqua", "sensor.gas"], ALLE_DIECI);
  assert.equal(consumi.type, "recorder/statistics_during_period");
  assert.deepEqual(consumi.statistic_ids, ["sensor.acqua", "sensor.gas"]);
  assert.equal(consumi.period, "day");
  assert.deepEqual(consumi.types, ["change"]);
  /* Dal primo del mese scorso: serve il mese scorso per il confronto. */
  assert.equal(Date.parse(consumi.start_time), giorno(7, 1));
  const ore = domandaDelleOre(["sensor.acqua"], ALLE_DIECI);
  assert.equal(ore.type, "recorder/statistics_during_period");
  assert.equal(ore.period, "hour");
});

test("oggi, ieri, il mese e il mese scorso, dai secchielli di un giorno", () => {
  const risposta = {
    "sensor.acqua": [
      { start: giorno(7, 30), change: 0.3 },
      { start: giorno(7, 31), change: 0.25 },
      /* Le versioni vecchie scrivono l'inizio come data. */
      { start: new Date(giorno(8, 1)).toISOString(), change: 0.2 },
      { start: giorno(8, 27), change: 0.268 },
      { start: giorno(8, 28), change: 0.214 },
    ],
  };
  const consumi = consumiDallaRisposta(risposta, "sensor.acqua", ALLE_DIECI);
  assert.ok(Math.abs(consumi.oggi - 0.214) < 1e-9);
  assert.ok(Math.abs(consumi.ieri - 0.268) < 1e-9);
  assert.ok(Math.abs(consumi.mese - 0.682) < 1e-9);
  assert.ok(Math.abs(consumi.meseScorso - 0.55) < 1e-9);
});

test("dopo mezzanotte oggi è zero, non un buco", () => {
  /* Il Recorder non ha ancora compilato la prima ora: c'è ieri, oggi no. */
  const risposta = { "sensor.acqua": [{ start: giorno(8, 27), change: 0.3 }] };
  assert.equal(consumiDallaRisposta(risposta, "sensor.acqua", ALLE_DIECI).oggi, 0);
  /* Senza nessun secchiello non si sa niente, e si dice. */
  assert.equal(consumiDallaRisposta({}, "sensor.acqua", ALLE_DIECI).oggi, null);
});

test("le ore, le medie del sale e la storia grezza si leggono in fila", () => {
  const ore = {
    "sensor.acqua": [
      { start: 2 * H, change: 5 },
      { start: H, change: 0 },
    ],
  };
  assert.deepEqual(oreDallaRisposta(ore, "sensor.acqua"), [0, 5]);
  const medie = {
    "sensor.sale": [
      { start: giorno(8, 26), mean: 50 },
      { start: giorno(8, 27), mean: null },
    ],
  };
  assert.deepEqual(serieDalleStatistiche(medie, "sensor.sale"), [
    { quando: giorno(8, 26) + 12 * H, valore: 50 },
  ]);
  const storia = [
    { stato: "60", quando: giorno(8, 26) + H },
    { stato: "58", quando: giorno(8, 26) + 20 * H },
    { stato: "unavailable", quando: giorno(8, 27) + H },
    { stato: "55", quando: giorno(8, 27) + 2 * H },
  ];
  assert.deepEqual(
    serieDallaStoria(storia).map((punto) => punto.valore),
    [58, 55],
  );
});

/* ── il sale, e tutti insieme ───────────────────────────────────────────── */

test("il sale in giorni è già la risposta; in chili si misura sull'ultimo carico", () => {
  assert.deepEqual(comeStaIlSale({ valore: 18, unita: "d", soglia: null }), {
    giorni: 18,
    livello: null,
    basso: false,
  });
  const chili = comeStaIlSale({ valore: 20, unita: "kg", soglia: 10 }, [
    { quando: giorno(8, 25), valore: 40 },
    { quando: giorno(8, 26), valore: 30 },
    { quando: giorno(8, 27), valore: 20 },
  ]);
  assert.equal(chili.livello, 50);
  assert.equal(chili.giorni, 1);
  assert.equal(comeStaIlSale({ valore: 8, unita: "%", soglia: null }).basso, true);
});

test("tutti insieme: la perdita dalla portata, con lo stato di adesso in fondo alla storia", () => {
  const letture = [
    letturaDelContatore(
      { entity: "sensor.portata", genere: "portata" },
      {
        state: "6",
        last_changed: new Date(ALLE_DIECI - 10 * 60000).toISOString(),
        attributes: { unit_of_measurement: "L/min" },
      },
    ),
  ];
  /* La storia l'ha vista partire tre ore e mezza fa; adesso scorre ancora. */
  const dati = {
    portata: {
      "sensor.portata": {
        da: ALLE_DIECI - 24 * H,
        righe: [
          { stato: "0", quando: ALLE_DIECI - 24 * H },
          { stato: "5.5", quando: ALLE_DIECI - 3.5 * H },
        ],
      },
    },
  };
  const come = comeStannoIContatori(letture, dati, { adesso: ALLE_DIECI, qualcunoInCasa: false });
  assert.equal(come.stato, "perdita");
  assert.equal(come.perdita.tipo, "portata");
  assert.equal(come.perdita.ore, 3.5);
  assert.equal(come.nessunoInCasa, true);
  /* Se adesso si è fermata, la storia di prima non conta più. */
  const ferma = letturaDelContatore(
    { entity: "sensor.portata", genere: "portata" },
    {
      state: "0",
      last_changed: new Date(ALLE_DIECI - 60000).toISOString(),
      attributes: { unit_of_measurement: "L/min" },
    },
  );
  assert.equal(comeStannoIContatori([ferma], dati, { adesso: ALLE_DIECI }).perdita, null);
  /* E senza storia non si giudica: si aspetta. */
  assert.equal(
    comeStannoIContatori(letture, {}, { adesso: ALLE_DIECI }).portate[0].scorre,
    undefined,
  );
});

test("tutti insieme: senza portata la perdita la dice il contatore, e la pressione fuori forcella", () => {
  const acqua = letturaDelContatore(
    { entity: "sensor.acqua", genere: "acqua", prezzo: "1,9" },
    sensore("m³", {}, "128.4"),
  );
  const pressione = letturaDelContatore(
    { entity: "sensor.pressione", genere: "pressione" },
    sensore("bar", {}, "1.2"),
  );
  const dati = {
    consumi: { "sensor.acqua": { oggi: 0.412, ieri: 0.268, mese: 6.2, meseScorso: 11.8 } },
    ore: { "sensor.acqua": Array(24).fill(0.018) },
  };
  const come = comeStannoIContatori([acqua, pressione], dati, { adesso: ALLE_DIECI });
  assert.equal(come.perdita.tipo, "contatore");
  assert.equal(come.stato, "perdita");
  assert.equal(come.pressioneFuori.verdetto, "low");
  /* L'acqua in litri, e il mese in euro col prezzo della riga. */
  assert.ok(Math.abs(come.acqua.oggi - 412) < 1e-9);
  assert.ok(Math.abs(come.acqua.costoMese - 11.78) < 1e-9);
  /* Senza la perdita, è la pressione a colorare la pagina. */
  const senza = comeStannoIContatori(
    [acqua, pressione],
    { consumi: dati.consumi },
    { adesso: ALLE_DIECI },
  );
  assert.equal(senza.stato, "pressione");
});

test("tutti insieme: il gas in metri cubi, in kilowattora e in euro", () => {
  const gas = letturaDelContatore(
    { entity: "sensor.gas", genere: "gas", prezzo: "0,924", coefficiente: "10,57" },
    sensore("m³", { device_class: "gas" }, "5210"),
  );
  const come = comeStannoIContatori([gas], {
    consumi: { "sensor.gas": { oggi: 3.4, ieri: 4.1, mese: 74, meseScorso: 118 } },
  });
  assert.ok(Math.abs(come.gas.oggi - 3.4) < 1e-9);
  assert.ok(Math.abs(come.gas.kwhOggi - 35.938) < 1e-9);
  assert.ok(Math.abs(come.gas.costoMese - 68.376) < 1e-9);
  assert.equal(come.acqua, null);
  assert.equal(come.stato, "normale");
  /* Prima che arrivino i dati il gas c'è, ma non è ancora letto. */
  assert.equal(comeStannoIContatori([gas], {}).gas.letto, false);
});

test("la forcella della pressione: fra due e quattro bar, se nessuno dice altro", () => {
  assert.equal(giudizioDellaPressione(2.8), "ok");
  assert.equal(giudizioDellaPressione(1.2), "low");
  assert.equal(giudizioDellaPressione(4.6), "high");
  assert.equal(giudizioDellaPressione(4.6, { massimo: 5 }), "ok");
  assert.equal(giudizioDellaPressione(null), "");
});
