/* «I dati sono tutti popolati ma non si vede.»
 *
 * Dal campo, con lo scatto accanto: nella configurazione la vettura c'e' —
 * «B10 ✓ attiva, 13 entita' mappate» — e la pagina dell'auto e' vuota.
 * Batteria a zero, autonomia e odometro a «—», sessione a «—». Si vedevano
 * benissimo, invece, tensione e temperatura della colonnina.
 *
 * Sono le due meta' della stessa storia. La pagina non legge i profili: legge
 * UNA mappa, `cd_entity_overrides`, e ogni vettura ne tiene la sua copia. Le
 * due si allineavano in un momento solo — quando si salva un veicolo o si
 * preme «Usa» — e a un ricaricamento della pagina nessuno riapplicava niente.
 * Nella mappa viva restava quello che c'era: le caselle della colonnina, che
 * sono della casa e nessuno le cancella, e della vettura nemmeno una.
 *
 * Lo stesso buco era gia' stato tappato per le FOTO, e il commento di
 * `seedActiveProfilePhotos` dice la stessa frase: «a un ricaricamento della
 * pagina pero' nessuno la tocca». Alle entita' quella pezza non era mai
 * arrivata.
 *
 * Qui si difende la regola, che adesso sta nel modello: cosa entra nella mappa
 * viva, e cosa il profilo adotta prima di riapplicarsi.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { laMappaViva, leCaselleDaAdottare } from "../src/core/vehicle-model.js";

const VIVA = Object.freeze({
  "dm.ev_batteria_auto": "sensor.b10_soc",
  "dm.ev_autonomia": "sensor.b10_km",
  "dm.ev_potenza_wallbox": "sensor.wallbox_potenza",
  "dm.ev_temperatura_wallbox": "sensor.wallbox_temp",
  "dm.luci_salone": "light.salone",
});

test("l'auto in uso rimette le sue entità nella mappa da cui la pagina disegna", () => {
  const prossima = laMappaViva(VIVA, {
    "dm.ev_batteria_auto": "sensor.leapmotor_battery",
    "dm.ev_odometro": "sensor.leapmotor_odometer",
  });
  assert.equal(prossima["dm.ev_batteria_auto"], "sensor.leapmotor_battery");
  assert.equal(prossima["dm.ev_odometro"], "sensor.leapmotor_odometer");
  /* Quella dell'auto di prima se ne va: e' di quell'altra vettura. */
  assert.equal(prossima["dm.ev_autonomia"], undefined);
});

test("la colonnina è della casa: non se la porta via nessuna vettura", () => {
  const prossima = laMappaViva(VIVA, { "dm.ev_batteria_auto": "sensor.leapmotor_battery" });
  assert.equal(prossima["dm.ev_potenza_wallbox"], "sensor.wallbox_potenza");
  assert.equal(prossima["dm.ev_temperatura_wallbox"], "sensor.wallbox_temp");
});

test("quello che non è dell'auto non si tocca: la mappa è di tutta la plancia", () => {
  const prossima = laMappaViva(VIVA, {});
  assert.equal(prossima["dm.luci_salone"], "light.salone");
});

test("una casella di casa vuota la può riempire la vettura", () => {
  const prossima = laMappaViva(
    { ...VIVA, "dm.ev_target_soc": "" },
    { "dm.ev_target_soc": "number.tesla_limite" },
  );
  assert.equal(prossima["dm.ev_target_soc"], "number.tesla_limite");
});

test("con una vettura sola il profilo adotta quello che sta solo nella mappa viva", () => {
  const adottate = leCaselleDaAdottare(VIVA, { "dm.ev_batteria_auto": "sensor.leapmotor_battery" });
  /* L'autonomia stava solo di là, e con una macchina sola è sua comunque. */
  assert.deepEqual(adottate, { "dm.ev_autonomia": "sensor.b10_km" });
  /* La colonnina no: quella resta della casa. */
  assert.ok(!("dm.ev_potenza_wallbox" in adottate));
  /* E quello che il profilo ha già non si tocca: comanda la vettura. */
  assert.ok(!("dm.ev_batteria_auto" in adottate));
});

test("l'auto attiva si riapplica all'avvio, come già facevano le foto", async () => {
  const sezione = await readFile(new URL("../src/sections/ev-section.js", import.meta.url), "utf8");
  /* Dove si semina la foto si semina anche la mappa: e' la stessa ferita. */
  const semine = [...sezione.matchAll(/seedActiveProfilePhotos\(\);\s*seedActiveProfileOverrides\(\)/g)];
  assert.ok(
    semine.length >= 3,
    "l'avvio, il runtime pronto e la configurazione condivisa: tutti e tre i momenti",
  );
  /* E la regola non e' riscritta qui dentro: e' quella del modello. */
  assert.match(sezione, /laMappaViva\(/);
  assert.match(sezione, /leCaselleDaAdottare\(/);
});
