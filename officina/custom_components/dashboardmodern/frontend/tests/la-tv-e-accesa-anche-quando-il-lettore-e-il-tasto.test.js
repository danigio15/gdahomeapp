/* La TV accesa non risulta in standby, nemmeno quando il lettore e' il tasto
 * (#47).
 *
 * «Poi le tv anche se accese risultano sempre in stand-by.» La #354 aveva
 * insegnato alla card la lingua dei lettori, ma solo dal lato dello STATO:
 * `media_player.tv` messo in `state_entity` veniva tradotto, e la TV accesa
 * diceva IN FUNZIONE. Chi mappa una TV a mano, pero', il lettore lo mette nel
 * tasto — e' l'unica cosa che una TV porta da premere — e lasciando lo stato
 * vuoto finiva in una scheda sorda: la parola del lettore arrivava a un solo
 * bivio, quello dell'«acceso generico», che porta a STANDBY. La TV che
 * riproduceva diceva STANDBY, e la TV in standby, parola che nessuno
 * raccoglieva, diceva SPENTO.
 *
 * Qui si tiene fermo che la stessa entita' dice la stessa cosa da tutte e due
 * le parti, e che la prudenza per cui quel bivio esiste — un interruttore
 * generico acceso a 0 W non e' un elettrodomestico in funzione — resta intera
 * per gli interruttori, che lettori non sono.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { createApplianceViewModel } from "../src/core/appliance-view-model.js";

const LETTORE = "media_player.tv_salotto";

/* Come la mappa a mano chi ha una TV: il lettore e' il tasto, lo stato resta
 * vuoto perche' l'integrazione non porta un sensore di stato da metterci. */
const tvDalTasto = {
  id: "tv-1",
  name: "TV Salotto",
  visual_key: "tv",
  control_entity: LETTORE,
  entities: [LETTORE],
};

/* La stessa TV mappata dallo stato, che la #354 ha gia' sistemato. */
const tvDalloStato = { ...tvDalTasto, control_entity: "", state_entity: LETTORE };

const conIlLettoreA = (stato) => ({ [LETTORE]: { state: stato, attributes: {} } });

const letturaDi = (device, stato) => createApplianceViewModel(device, conIlLettoreA(stato)).mode;

test("la TV accesa dice IN FUNZIONE, non STANDBY", () => {
  assert.equal(letturaDi(tvDalTasto, "on"), "running");
  assert.equal(createApplianceViewModel(tvDalTasto, conIlLettoreA("on")).label, "IN FUNZIONE");
  for (const vivo of ["playing", "paused", "idle", "buffering"])
    assert.equal(letturaDi(tvDalTasto, vivo), "running", vivo);
});

test("la TV in attesa dice STANDBY, non SPENTO", () => {
  assert.equal(letturaDi(tvDalTasto, "standby"), "standby");
  assert.equal(createApplianceViewModel(tvDalTasto, conIlLettoreA("standby")).label, "STANDBY");
});

test("la TV spenta resta spenta, e quella muta resta muta", () => {
  assert.equal(letturaDi(tvDalTasto, "off"), "off");
  assert.equal(letturaDi(tvDalTasto, "unavailable"), "unavailable");
});

test("lo stesso lettore dice la stessa cosa dal tasto e dallo stato", () => {
  for (const parola of ["on", "playing", "paused", "idle", "buffering", "standby", "off"])
    assert.equal(letturaDi(tvDalTasto, parola), letturaDi(tvDalloStato, parola), parola);
});

test("il tasto accende chi e' in standby e spegne chi sta riproducendo", () => {
  const suona = createApplianceViewModel(tvDalTasto, conIlLettoreA("playing")).action;
  assert.equal(suona.pressed, true);
  assert.equal(suona.service, "turn_off");
  /* Una TV in standby si accende: il tasto non dice «Spegni» a chi e' gia'
   * in attesa. */
  const attende = createApplianceViewModel(tvDalTasto, conIlLettoreA("standby")).action;
  assert.equal(attende.pressed, false);
  assert.equal(attende.service, "turn_on");
});

test("un interruttore acceso a zero watt resta STANDBY: la prudenza vale per chi non e' un lettore", () => {
  const presa = {
    id: "forno-1",
    name: "Forno",
    control_entity: "switch.presa_forno",
    power_entity: "sensor.presa_forno_potenza",
    entities: ["switch.presa_forno", "sensor.presa_forno_potenza"],
  };
  const fermo = createApplianceViewModel(presa, {
    "switch.presa_forno": { state: "on", attributes: {} },
    "sensor.presa_forno_potenza": { state: "0", attributes: { unit_of_measurement: "W" } },
  });
  assert.equal(fermo.mode, "standby");
  /* E quando i watt salgono, e' la corrente a dire che lavora. */
  const lavora = createApplianceViewModel(presa, {
    "switch.presa_forno": { state: "on", attributes: {} },
    "sensor.presa_forno_potenza": { state: "1800", attributes: { unit_of_measurement: "W" } },
  });
  assert.equal(lavora.mode, "running");
});
