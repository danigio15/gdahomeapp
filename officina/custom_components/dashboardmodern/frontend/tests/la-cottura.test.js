/* La cottura (#71): il nucleo.
 *
 * «Mi piacerebbe pilotare la mia friggitrice ad aria della Philips.» Qui si
 * tiene fermo quello che la voce «Cottura» degli Elettrodomestici sa: la fase
 * dalla parola dell'integrazione, quanto manca in qualunque forma arrivi, quando
 * e' pronta, quali tasti ci sono davvero e quale servizio chiama ciascuno, la
 * fine che si ricorda anche quando l'integrazione torna in standby, e le
 * caselle che si compilano da sole per le due integrazioni Philips.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  CASELLE_DELLA_COTTURA,
  PRONTA_PER_MS,
  SERVIZI_PHILIPS_AIRFRYER,
  azioneDelComando,
  cassettoAperto,
  comandiDellaCottura,
  faseDallaParola,
  laCucina,
  leggiIlComando,
  letturaDellaCottura,
  minutiCheMancano,
  minutiESecondi,
  orologio,
  passoDellaFine,
  programmaLeggibile,
  proponiLaCottura,
  secondiRimasti,
  secondiTotali,
  tipoDellaCucina,
} from "../src/core/la-cottura.js";

const ADESSO = new Date(2026, 8, 29, 14, 33, 28).getTime();
const quando = (ms) => new Date(ms).toISOString();
const stato = (valore, attributi = {}, fa = 0) => ({
  state: String(valore),
  attributes: attributi,
  last_changed: quando(ADESSO - fa),
  last_updated: quando(ADESSO - fa),
});

/* La friggitrice Philips da HACS: tempi in secondi, comandi come servizi. */
const PHILIPS = {
  "sensor.philips_airfryer_status": stato("cooking"),
  "sensor.philips_airfryer_temp": stato("180", {
    unit_of_measurement: "°C",
    device_class: "temperature",
  }),
  "sensor.philips_airfryer_total_time": stato("900", { unit_of_measurement: "s" }),
  "sensor.philips_airfryer_time_remaining": stato("452", { unit_of_measurement: "s" }),
  "sensor.philips_airfryer_dialog": stato("french_fries"),
  "binary_sensor.philips_airfryer_drawer_open": stato("off"),
};

const FRIGGITRICE = {
  id: "frig",
  name: "Friggitrice",
  visual_key: "friggitrice",
  ...proponiLaCottura(Object.keys(PHILIPS), PHILIPS),
};

test("la cucina: friggitrice, forno, piano cottura e cappa sì, la lavatrice no", () => {
  assert.equal(tipoDellaCucina({ visual_key: "friggitrice" }), "air-fryer");
  assert.equal(tipoDellaCucina({ device_type: "forno" }), "oven");
  assert.equal(tipoDellaCucina({ icon: "piano_cottura" }), "cooktop");
  assert.equal(tipoDellaCucina({ visual_key: "cappa" }), "hood");
  assert.equal(tipoDellaCucina({ visual_key: "microonde" }), "microwave");
  assert.equal(tipoDellaCucina({ visual_key: "lavatrice" }), "");
  assert.equal(tipoDellaCucina({}), "");
});

test("la fase dalla parola di ogni integrazione", () => {
  // philips_airfryer (HACS)
  assert.equal(faseDallaParola("cooking"), "cottura");
  assert.equal(faseDallaParola("pause"), "pausa");
  assert.equal(faseDallaParola("precook"), "attesa");
  assert.equal(faseDallaParola("finish"), "pronta");
  assert.equal(faseDallaParola("standby"), "spenta");
  assert.equal(faseDallaParola("powersave"), "spenta");
  assert.equal(faseDallaParola("offline"), "spenta");
  // Philips HomeID
  assert.equal(faseDallaParola("preheat"), "preriscaldamento");
  assert.equal(faseDallaParola("keeping_warm"), "pronta");
  assert.equal(faseDallaParola("user_action"), "attesa");
  // Home Connect: l'indirizzo lungo, e le parole del vocabolario dei cicli.
  assert.equal(faseDallaParola("BSH.Common.EnumType.OperationState.Run"), "cottura");
  assert.equal(faseDallaParola("BSH.Common.EnumType.OperationState.Finished"), "pronta");
  assert.equal(faseDallaParola("delayed_start"), "attesa");
  assert.equal(faseDallaParola(""), "");
  assert.equal(faseDallaParola("chissà"), "");
});

test("quanto manca: secondi, minuti, hh:mm o l'ora di fine", () => {
  assert.equal(secondiRimasti(stato("452", { unit_of_measurement: "s" }), ADESSO), 452);
  assert.equal(secondiRimasti(stato("8", { unit_of_measurement: "min" }), ADESSO), 480);
  assert.equal(secondiRimasti(stato("8"), ADESSO), 480, "senza unità sono minuti");
  assert.equal(secondiRimasti(stato("0:15"), ADESSO), 900);
  assert.equal(secondiRimasti(stato("0:07:32"), ADESSO), 452);
  const fine = stato(quando(ADESSO + 452_000), { device_class: "timestamp" });
  assert.equal(secondiRimasti(fine, ADESSO), 452);
  assert.equal(secondiRimasti(stato(quando(ADESSO - 60_000)), ADESSO), 0, "mai sotto zero");
  assert.equal(secondiRimasti(stato("unavailable"), ADESSO), null);
  assert.equal(secondiRimasti(null, ADESSO), null);
});

test("un numero letto qualche secondo fa scorre, ma solo se sta cuocendo", () => {
  const letto = stato("452", { unit_of_measurement: "s" }, 20_000);
  assert.equal(secondiRimasti(letto, ADESSO, { scorre: true }), 432);
  assert.equal(secondiRimasti(letto, ADESSO, { scorre: false }), 452);
  /* Un sensore fermo da un'ora non e' un conto alla rovescia: al piu' dieci
   * minuti di scorrimento. */
  const vecchio = stato("3600", { unit_of_measurement: "s" }, 3_600_000);
  assert.equal(secondiRimasti(vecchio, ADESSO, { scorre: true }), 3000);
});

test("il tempo totale, e le parole dei minuti", () => {
  assert.equal(secondiTotali(stato("900", { unit_of_measurement: "s" })), 900);
  assert.equal(secondiTotali(stato("15", { unit_of_measurement: "min" })), 900);
  assert.equal(secondiTotali(stato("0", { unit_of_measurement: "s" })), null);
  assert.equal(minutiESecondi(452), "7:32");
  assert.equal(minutiESecondi(3900), "1:05:00");
  assert.equal(minutiCheMancano(452), 8, "in su: meglio un minuto di margine");
  assert.equal(minutiCheMancano(10), 1, "mai «fra 0 min»");
  assert.equal(orologio(new Date(2026, 8, 29, 9, 5).getTime()), "09:05");
});

test("il programma leggibile, e il cassetto", () => {
  assert.equal(programmaLeggibile("french_fries"), "French fries");
  assert.equal(programmaLeggibile("Patatine"), "Patatine");
  assert.equal(programmaLeggibile("0"), "", "una chiave numerica non dice niente");
  assert.equal(programmaLeggibile("unknown"), "");
  assert.equal(cassettoAperto(stato("on")), true);
  assert.equal(cassettoAperto(stato("True")), true);
  assert.equal(cassettoAperto(stato("off")), false);
  assert.equal(cassettoAperto(stato("unavailable")), null);
});

test("un comando: un'entità, o un servizio coi suoi parametri", () => {
  assert.deepEqual(leggiIlComando("button.friggitrice_pause"), {
    tipo: "entita",
    entita: "button.friggitrice_pause",
    dominio: "button",
  });
  assert.deepEqual(leggiIlComando("philips_airfryer.adjust_time time=60 method=add"), {
    tipo: "servizio",
    dominio: "philips_airfryer",
    servizio: "adjust_time",
    dati: { time: 60, method: "add" },
  });
  assert.deepEqual(leggiIlComando("script.turn_on"), {
    tipo: "servizio",
    dominio: "script",
    servizio: "turn_on",
    dati: {},
  });
  assert.equal(leggiIlComando("niente"), null);
  assert.equal(leggiIlComando("philips_airfryer.pause senza_uguale"), null);
});

test("ogni comando diventa il servizio giusto", () => {
  const states = {
    "button.p": stato("unknown"),
    "switch.p": stato("off"),
    "number.gradi": stato("180", { min: 40, max: 200, step: 10 }),
    "number.minuti": stato("15", { unit_of_measurement: "min" }),
    "button.rotto": stato("unavailable"),
  };
  const bersaglio = "sensor.philips_airfryer_status";
  assert.deepEqual(azioneDelComando("button.p", "pausa", { states }), {
    dominio: "button",
    servizio: "press",
    dati: { entity_id: "button.p" },
  });
  assert.deepEqual(azioneDelComando("switch.p", "pausa", { states }), {
    dominio: "switch",
    servizio: "toggle",
    dati: { entity_id: "switch.p" },
  });
  assert.deepEqual(azioneDelComando("number.gradi", "piu_caldo", { states }), {
    dominio: "number",
    servizio: "set_value",
    dati: { entity_id: "number.gradi", value: 190 },
  });
  assert.deepEqual(azioneDelComando("number.minuti", "piu_un_minuto", { states }), {
    dominio: "number",
    servizio: "set_value",
    dati: { entity_id: "number.minuti", value: 16 },
  });
  assert.deepEqual(
    azioneDelComando("philips_airfryer.adjust_temp temp=5 method=subtract", "meno_caldo", {
      states,
      bersaglio,
    }),
    {
      dominio: "philips_airfryer",
      servizio: "adjust_temp",
      dati: { temp: 5, method: "subtract", entity_id: bersaglio },
    },
  );
  /* Un tasto che non risponde, o che non c'e', non si disegna. */
  assert.equal(azioneDelComando("button.rotto", "stop", { states }), null);
  assert.equal(azioneDelComando("button.mancante", "stop", { states }), null);
  /* Al massimo il numero non sale piu': il + non ha niente da fare. */
  const alMassimo = { "number.gradi": stato("200", { max: 200, step: 10 }) };
  assert.equal(azioneDelComando("number.gradi", "piu_caldo", { states: alMassimo }), null);
});

test("i tasti ci sono solo se configurati, e solo nella loro fase", () => {
  const cuoce = comandiDellaCottura(FRIGGITRICE, PHILIPS, "cottura");
  assert.deepEqual(Object.keys(cuoce), [
    "pausa",
    "stop",
    "piu_un_minuto",
    "piu_caldo",
    "meno_caldo",
  ]);
  assert.deepEqual(cuoce.pausa, {
    dominio: "philips_airfryer",
    servizio: "pause",
    dati: { entity_id: "sensor.philips_airfryer_status" },
  });
  const ferma = comandiDellaCottura(FRIGGITRICE, PHILIPS, "pausa");
  assert.ok(ferma.riprendi && !ferma.pausa, "da ferma: Riprendi, non Pausa");
  assert.deepEqual(comandiDellaCottura(FRIGGITRICE, PHILIPS, "spenta"), {});
  /* Senza caselle, nessun tasto: nemmeno uno indovinato. */
  assert.deepEqual(comandiDellaCottura({ visual_key: "friggitrice" }, PHILIPS, "cottura"), {});
});

test("i due ripieghi: Riprendi dall'interruttore della pausa, − e + dal numero voluto", () => {
  const states = {
    "switch.pausa": stato("on"),
    "number.gradi": stato("180", { step: 5 }),
  };
  const apparecchio = { cottura_pausa: "switch.pausa", cottura_temperatura_voluta: "number.gradi" };
  const ferma = comandiDellaCottura(apparecchio, states, "pausa");
  assert.deepEqual(ferma.riprendi.dati, { entity_id: "switch.pausa" });
  assert.deepEqual(ferma.meno_caldo.dati, { entity_id: "number.gradi", value: 175 });
  /* Un tasto (button) non si inverte: senza la sua casella, Riprendi non c'e'. */
  const conTasto = comandiDellaCottura(
    { cottura_pausa: "button.p" },
    { "button.p": stato("unknown") },
    "pausa",
  );
  assert.equal(conTasto.riprendi, undefined);
});

test("la lettura di una friggitrice che cuoce", () => {
  const lettura = letturaDellaCottura(FRIGGITRICE, PHILIPS, { adesso: ADESSO });
  assert.equal(lettura.tipo, "air-fryer");
  assert.equal(lettura.fase, "cottura");
  assert.equal(lettura.rimasti, 452);
  assert.equal(lettura.totali, 900);
  assert.equal(lettura.prontaAlle, ADESSO + 452_000);
  assert.equal(lettura.avviataAlle, ADESSO - 448_000);
  assert.equal(orologio(lettura.prontaAlle), "14:41");
  assert.equal(orologio(lettura.avviataAlle), "14:26");
  assert.equal(lettura.programma, "French fries");
  assert.deepEqual(lettura.gradi, { valore: 180, unita: "°C" });
  assert.equal(lettura.cassetto, false);
  assert.ok(Math.abs(lettura.frazione - 452 / 900) < 1e-9, "l'anello si svuota col tempo");
});

test("senza una parola sua, un forno parla coi watt della scheda", () => {
  const forno = { visual_key: "forno", cottura_temperatura: "sensor.forno" };
  const states = { "sensor.forno": stato("24", { unit_of_measurement: "°C" }) };
  assert.equal(letturaDellaCottura(forno, states, { modo: "running" }).fase, "cottura");
  assert.equal(letturaDellaCottura(forno, states, { modo: "off" }).fase, "spenta");
  const piano = { visual_key: "piano_cottura" };
  assert.equal(letturaDellaCottura(piano, {}, { modo: "standby" }).fase, "cottura");
});

test("la fine: detta dall'integrazione, o ricordata quando torna in standby", () => {
  const cuoceva = { fase: "cottura", rimasti: 30, fineAt: null };
  /* HomeID torna in standby: con il tempo quasi finito, e' pronta. */
  const passo = passoDellaFine(cuoceva, { fase: "spenta", adesso: ADESSO });
  assert.equal(passo.pronta, true);
  assert.equal(passo.appenaFinita, true);
  assert.equal(passo.fresca, true);
  /* Il giro dopo resta pronta, ma non e' piu' «appena» finita. */
  const dopo = passoDellaFine(passo.memoria, { fase: "spenta", adesso: ADESSO + 60_000 });
  assert.equal(dopo.pronta, true);
  assert.equal(dopo.appenaFinita, false);
  /* Passato il tempo, e' spenta e basta. */
  const tardi = passoDellaFine(dopo.memoria, {
    fase: "spenta",
    adesso: ADESSO + PRONTA_PER_MS + 1,
  });
  assert.equal(tardi.pronta, false);
  /* Uno stop premuto a meta' cottura non e' una fine. */
  const fermata = passoDellaFine(
    { fase: "cottura", rimasti: 400 },
    { fase: "spenta", adesso: ADESSO },
  );
  assert.equal(fermata.pronta, false);
  /* «finish» detto dall'integrazione vale, ma la tessera si accende solo se la
   * fine e' fresca: quella di stamattina non e' una notizia. */
  const stamattina = passoDellaFine(null, {
    fase: "pronta",
    adesso: ADESSO,
    cambiatoIl: ADESSO - 5 * 3_600_000,
  });
  assert.equal(stamattina.pronta, true);
  assert.equal(stamattina.fresca, false);
  assert.equal(stamattina.appenaFinita, false, "il primo sguardo non ha un «prima»");
});

test("chi va nella scheda grande e chi fra gli altri", () => {
  const voce = (id, tipo, fase, rimasti = null) => ({
    id,
    lettura: {
      aTempo: ["air-fryer", "oven", "microwave"].includes(tipo),
      fase,
      rimasti,
      muta: false,
    },
  });
  const friggitrice = voce("f", "air-fryer", "cottura", 300);
  const forno = voce("o", "oven", "spenta");
  const piano = voce("p", "cooktop", "spenta");
  const cucina = laCucina([forno, friggitrice, piano]);
  assert.deepEqual(cucina.grandi, [friggitrice]);
  assert.deepEqual(cucina.altri, [forno, piano]);
  assert.equal(cucina.prima, friggitrice);
  assert.equal(cucina.vive, 1);
  /* Tutto spento: la prima a tempo resta in scheda, coi suoi comandi pronti. */
  const spenta = laCucina([voce("f", "air-fryer", "spenta"), piano]);
  assert.equal(spenta.grandi.length, 1);
  assert.equal(spenta.prima, null);
});

test("le caselle si compilano da sole: philips_airfryer da HACS", () => {
  const proposta = proponiLaCottura(Object.keys(PHILIPS), PHILIPS);
  assert.equal(proposta.cottura_stato, "sensor.philips_airfryer_status");
  assert.equal(proposta.cottura_temperatura, "sensor.philips_airfryer_temp");
  assert.equal(proposta.cottura_tempo_totale, "sensor.philips_airfryer_total_time");
  assert.equal(proposta.cottura_tempo_rimanente, "sensor.philips_airfryer_time_remaining");
  assert.equal(proposta.cottura_cassetto, "binary_sensor.philips_airfryer_drawer_open");
  assert.equal(proposta.cottura_programma, "sensor.philips_airfryer_dialog");
  for (const [casella, servizio] of Object.entries(SERVIZI_PHILIPS_AIRFRYER))
    assert.equal(proposta[casella], servizio, casella);
  assert.equal(proposta.cottura_bersaglio, "sensor.philips_airfryer_status");
  for (const casella of Object.keys(proposta)) assert.ok(CASELLE_DELLA_COTTURA.includes(casella));
});

test("le caselle si compilano da sole: Philips HomeID, coi tasti e i numeri", () => {
  const entita = [
    { entity_id: "sensor.airfryer_cooking_status", name: "Cooking Status" },
    { entity_id: "sensor.airfryer_target_temperature", name: "Target Temperature", unit: "°C" },
    { entity_id: "sensor.airfryer_current_temperature", name: "Current Temperature", unit: "°C" },
    { entity_id: "sensor.airfryer_total_cook_time", name: "Total Cook Time", unit: "min" },
    { entity_id: "sensor.airfryer_time_remaining", name: "Time Remaining", unit: "min" },
    { entity_id: "sensor.airfryer_recipe", name: "Recipe" },
    { entity_id: "sensor.airfryer_recipe_id", name: "Recipe ID" },
    { entity_id: "binary_sensor.airfryer_drawer", name: "Drawer" },
    { entity_id: "button.airfryer_start", name: "Start" },
    { entity_id: "button.airfryer_pause", name: "Pause" },
    { entity_id: "button.airfryer_stop", name: "Stop" },
    { entity_id: "number.airfryer_set_temperature", name: "Set Temperature" },
    { entity_id: "number.airfryer_cook_time", name: "Cook Time" },
  ];
  const proposta = proponiLaCottura(entita, {}, { integrazione: "philips_homeid" });
  assert.equal(proposta.cottura_stato, "sensor.airfryer_cooking_status");
  assert.equal(proposta.cottura_temperatura, "sensor.airfryer_current_temperature");
  assert.equal(proposta.cottura_temperatura_voluta, "number.airfryer_set_temperature");
  assert.equal(proposta.cottura_tempo_totale, "sensor.airfryer_total_cook_time");
  assert.equal(proposta.cottura_tempo_rimanente, "sensor.airfryer_time_remaining");
  assert.equal(proposta.cottura_programma, "sensor.airfryer_recipe");
  assert.equal(proposta.cottura_cassetto, "binary_sensor.airfryer_drawer");
  assert.equal(proposta.cottura_pausa, "button.airfryer_pause");
  assert.equal(proposta.cottura_riprendi, "button.airfryer_start");
  assert.equal(proposta.cottura_stop, "button.airfryer_stop");
  assert.equal(proposta.cottura_piu_un_minuto, "number.airfryer_cook_time");
  /* Niente servizi inventati: HomeID i tasti ce li ha. */
  assert.equal(proposta.cottura_piu_caldo, undefined);
});

test("un forno qualunque: lo stato e la temperatura", () => {
  const entita = [
    { entity_id: "sensor.forno_operation_state", name: "Operation State" },
    { entity_id: "sensor.forno_temperatura", name: "Temperatura", unit: "°C" },
    { entity_id: "binary_sensor.forno_porta", name: "Porta" },
    { entity_id: "switch.forno", name: "Forno" },
  ];
  const proposta = proponiLaCottura(entita, {});
  assert.equal(proposta.cottura_stato, "sensor.forno_operation_state");
  assert.equal(proposta.cottura_temperatura, "sensor.forno_temperatura");
  assert.equal(proposta.cottura_cassetto, "binary_sensor.forno_porta");
  assert.equal(proposta.cottura_pausa, undefined);
});
