/* «La casella c'è ma manca nel config dove inserire l'entità.»
 *
 * La casella c'era davvero, e la ricerca la trovava. Quello che non
 * funzionava era il salto: il risultato usciva come «MiniPC ·
 * dm.energy_interruttore_ventola_inverter» e un tocco portava nella scheda
 * del MiniPC, dove di ventole non se ne parla. Chi cerca dove mettere
 * l'entita' della ventola e finisce nel MiniPC conclude — giustamente — che
 * quella casella non esiste.
 *
 * Veniva da un'attribuzione fatta sul CASSETTO invece che sulla CASELLA:
 * `cd_entity_overrides` tiene le mappature di tutta la plancia, e stava in
 * tabella come «MiniPC» — giusto per `dm.server_*` e sbagliato per tutti gli
 * altri. Queste prove fissano che la scheda la dice la casella, e che dove
 * non c'e' una scheda da aprire non se ne inventa una.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { cercaNelConfig } from "../src/core/cerca-nel-config.js";
import { schedaDelRisultato } from "../src/sections/cerca-nel-config-section.js";

/* Le schede sono quelle vere del guscio: sez0 Home, sez1 Energia, sez2 EV,
 * sez3 Solare, sez4 Sicurezza, sez6 MiniPC. */
const MAPPATE = Object.freeze({
  "dm.energy_interruttore_ventola_inverter": "switch.ventola_inverter",
  "dm.energy_potenza_ventola_inverter": "sensor.ventola_potenza",
  "dm.ev_batteria_auto": "sensor.soc_auto",
  "dm.boiler_pompa_solare": "switch.pompa_solare",
  "dm.security_centrale_allarme": "alarm_control_panel.casa",
  "dm.home_meteo": "weather.casa",
  "dm.server_cpu": "sensor.cpu_minipc",
});

const dove = (ago, magazzino) =>
  cercaNelConfig(ago, magazzino).map((esito) => `${esito.campo}|${schedaDelRisultato(esito)}`);

test("l'entita' della ventola apre Energia, non il MiniPC", () => {
  assert.deepEqual(dove("interruttore_ventola", { cd_entity_overrides: MAPPATE }), [
    "dm.energy_interruttore_ventola_inverter|sez1",
  ]);
});

test("ogni famiglia va nella sua scheda", () => {
  const atteso = {
    "dm.energy_potenza_ventola_inverter": "sez1",
    "dm.ev_batteria_auto": "sez2",
    "dm.boiler_pompa_solare": "sez3",
    "dm.security_centrale_allarme": "sez4",
    "dm.home_meteo": "sez0",
    "dm.server_cpu": "sez6",
  };
  for (const [casella, scheda] of Object.entries(atteso)) {
    const [esito] = cercaNelConfig(MAPPATE[casella], { cd_entity_overrides: MAPPATE });
    assert.equal(esito.campo, casella);
    assert.equal(schedaDelRisultato(esito), scheda, casella);
  }
});

test("la stessa regola vale nel magazzino dei moduli", () => {
  /* Le mappature stanno in due posti che sono lo stesso posto: la casella
   * storica e `sections.entityOverrides` dentro `dm_dashboard_state`. Se la
   * regola vivesse in uno solo, la meta' delle case salterebbe nel MiniPC. */
  const magazzino = { dm_dashboard_state: { sections: { entityOverrides: MAPPATE } } };
  /* L'ordine dei risultati lo decide la ricerca e lo fissano le sue prove:
   * qui conta che tutt'e due sappiano dove portare. */
  assert.deepEqual(dove("ventola_inverter", magazzino).sort(), [
    "dm.energy_interruttore_ventola_inverter|sez1",
    "dm.energy_potenza_ventola_inverter|sez1",
  ]);
});

test("una casella che non si riconosce esce senza salto", () => {
  /* Un salto nella scheda sbagliata e' peggio di nessun salto: manda a
   * cercare dove non c'e' niente, ed e' esattamente il danno da cui si
   * viene. Il risultato si vede lo stesso, col nome della casella. */
  const magazzino = { cd_entity_overrides: { "dm.lavagna_misteriosa": "sensor.mistero" } };
  assert.deepEqual(dove("mistero", magazzino), ["dm.lavagna_misteriosa|"]);
});

test("le caselle della lavatrice non hanno una scheda da aprire", () => {
  /* La loro fisarmonica sarebbe la sesta, cioe' `sez5`, e una linguetta
   * `sez5` non esiste: quelle caselle si aprono dal popup della lavatrice. */
  const magazzino = { cd_entity_overrides: { "dm.lavatrice_programma": "select.programma" } };
  assert.deepEqual(dove("select.programma", magazzino), ["dm.lavatrice_programma|"]);
});

test("una casella in pensione non manda davanti a una riga nascosta", () => {
  /* Il guscio disegna queste due righe e poi le nasconde. Chi ce le ha
   * ancora mappate le trova scritte — il valore non si tocca — ma il salto
   * porterebbe in una scheda dove la riga non si vede. */
  const magazzino = {
    cd_entity_overrides: { "dm.home_script_apertura_cancello": "script.cancello" },
  };
  assert.deepEqual(dove("cancello", magazzino), ["dm.home_script_apertura_cancello|"]);
});

test("le altre caselle non hanno perso il loro salto", () => {
  /* La correzione tocca solo il cassetto delle mappature: tutto il resto
   * della configurazione deve saltare dove saltava prima. */
  const magazzino = {
    cd_appliances: [{ id: "a1", name: "Lavatrice", total_energy_entity: "sensor.lavatrice_kwh" }],
    cd_stanze: [{ id: "r1", name: "Cucina" }],
    cd_fasce_kwh: { f1: 0.25 },
    dm_dashboard_state: { sections: { cameras: [{ name: "Ingresso" }] } },
  };
  assert.deepEqual(dove("lavatrice_kwh", magazzino), ["total_energy_entity|appliances"]);
  assert.deepEqual(dove("cucina", magazzino), ["name|stanze"]);
  assert.deepEqual(dove("ingresso", magazzino), ["name|sez4"]);
});
