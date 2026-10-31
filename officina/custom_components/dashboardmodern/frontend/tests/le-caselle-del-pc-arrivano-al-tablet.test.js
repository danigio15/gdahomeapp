/* «La plancia che apro dal PC e la stessa aperta sul tablet hanno
 * configurazioni diverse? Ho configurato il MiniPC dal PC ma sul tablet, pur
 * riavviando, non vedo le modifiche.» E prima era successo col meteo.
 *
 * MiniPC e meteo scrivono nella stessa chiave, `cd_entity_overrides`: una
 * mappa di caselle dove ogni sezione ha le sue. Il tablet aveva una copia
 * vecchia della mappa e, alla prima casella che scriveva lui (un'area
 * dell'antifurto, una linguetta del solare), la sua mappa intera passava sopra
 * quella del PC. Le caselle del MiniPC tornavano vuote per tutti.
 *
 * Qui si pretende la fusione casella per casella: le caselle che il tablet ha
 * davvero cambiato vincono, tutte le altre le decide la copia condivisa.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  conLeModificheInSospeso,
  fondiLeCaselle,
} from "../src/sections/config-persistence-section.js";

const BASE = JSON.stringify({ "dm.antifurto_area": "alarm_control_panel.casa" });
const DAL_PC = JSON.stringify({
  "dm.antifurto_area": "alarm_control_panel.casa",
  "dm.server_cpu": "sensor.minipc_cpu",
  "dm.server_ram": "sensor.minipc_ram",
  "dm.meteo": "weather.casa",
});
const DAL_TABLET = JSON.stringify({ "dm.antifurto_area": "alarm_control_panel.notte" });

test("il tablet che cambia una casella non cancella il MiniPC salvato dal PC", () => {
  const fusa = JSON.parse(fondiLeCaselle(DAL_PC, DAL_TABLET, BASE));
  assert.equal(fusa["dm.server_cpu"], "sensor.minipc_cpu");
  assert.equal(fusa["dm.server_ram"], "sensor.minipc_ram");
  assert.equal(fusa["dm.meteo"], "weather.casa");
  assert.equal(fusa["dm.antifurto_area"], "alarm_control_panel.notte");
});

test("una casella tolta sul tablet resta tolta, le altre restano del PC", () => {
  const base = JSON.stringify({ "dm.vecchia": "sensor.a", "dm.meteo": "weather.vecchio" });
  const pc = JSON.stringify({ "dm.vecchia": "sensor.a", "dm.meteo": "weather.casa" });
  const tablet = JSON.stringify({ "dm.meteo": "weather.vecchio" });
  const fusa = JSON.parse(fondiLeCaselle(pc, tablet, base));
  assert.equal("dm.vecchia" in fusa, false);
  assert.equal(fusa["dm.meteo"], "weather.casa");
});

test("senza una base si tiene la copia condivisa e si aggiungono le caselle di qui", () => {
  const fusa = JSON.parse(fondiLeCaselle(DAL_PC, JSON.stringify({ "dm.nuova": "sensor.x" })));
  assert.equal(fusa["dm.server_cpu"], "sensor.minipc_cpu");
  assert.equal(fusa["dm.nuova"], "sensor.x");
});

test("la fusione dei valori in sospeso usa le caselle per cd_entity_overrides", () => {
  const remoti = { cd_entity_overrides: DAL_PC, cd_titolo: "Casa" };
  const locali = { cd_entity_overrides: DAL_TABLET, cd_titolo: "Vecchio" };
  const fusi = conLeModificheInSospeso(remoti, locali, ["cd_entity_overrides"], {
    cd_entity_overrides: BASE,
  });
  const mappa = JSON.parse(fusi.cd_entity_overrides);
  assert.equal(mappa["dm.server_cpu"], "sensor.minipc_cpu");
  assert.equal(mappa["dm.antifurto_area"], "alarm_control_panel.notte");
  assert.equal(fusi.cd_titolo, "Casa");
});

test("una mappa illeggibile non rompe niente: vince quella di qui come prima", () => {
  assert.equal(fondiLeCaselle("non json", DAL_TABLET, BASE), DAL_TABLET);
});
