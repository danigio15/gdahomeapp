/* Le entità di Energia sparivano appena scritte.
 *
 * Trovata inseguendo «manca nel config dove inserire l'entità» della ventola:
 * la casella c'era, ma nel punto in cui la plancia adotta una mappatura fatta
 * a mano l'energia veniva buttata via.
 *
 * `projectEnergySlots` proietta il modello energia sui `dm.energy_*`: il
 * modello è la verità, gli slot sono la sua ombra, e uno slot che il modello
 * non copre viene tolto. È giusto finché la mappatura nasce dal modello — è
 * così che si svuota un campo. È una perdita quando la mappatura arriva da
 * fuori ed è l'unica copia che esiste.
 *
 * Da fuori ci arriva la cosa più importante di tutte: la procedura guidata.
 * Alla fine versa tutto quello che ha trovato dentro `cd_entity_overrides` in
 * un colpo solo, il negozio lo adotta, proietta, e un microtask dopo di ⚡
 * Energia non resta niente — mentre `dm.ev_*` e `dm.server_*`, che nessuno
 * proietta, sopravvivono. Nemmeno il ricaricamento che la procedura fa subito
 * dopo rimedia: quando la migrazione va a leggere `cd_entity_overrides` per
 * travasarlo nel modello, lì dentro non c'è più niente da travasare.
 *
 * Misurata sulla plancia vera prima della correzione: delle sei mappature
 * scritte ne restavano due, e tutte e quattro quelle di Energia erano sparite
 * con il modello ancora vuoto.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { DashboardStore } from "../src/core/dashboard-store.js";
import { adoptEnergySlots, projectEnergySlots } from "../src/core/energy-projection.js";

class MemoryStorage {
  values = new Map();
  getItem(key) {
    return this.values.get(key) ?? null;
  }
  setItem(key, value) {
    this.values.set(key, String(value));
  }
  removeItem(key) {
    this.values.delete(key);
  }
}

function setup() {
  const storage = new MemoryStorage();
  const store = new DashboardStore({ storage, sync: async () => {} });
  store.migrate();
  store.installLegacyWriteBridge();
  return { store, storage };
}

/* Quello che la procedura guidata scrive alla fine: un po' di tutto, in una
 * chiave sola. Le due in coda non sono proiettate da nessuno e fanno da
 * testimone — se sopravvivono solo loro, la perdita è tornata. */
const DALLA_PROCEDURA = Object.freeze({
  "dm.energy_potenza_consumo_casa": "sensor.casa_potenza",
  "dm.energy_potenza_fotovoltaico": "sensor.fv_potenza",
  "dm.energy_stato_carica_batteria": "sensor.batteria_soc",
  "dm.energy_interruttore_ventola_inverter": "switch.ventola_inverter",
  "dm.ev_batteria_auto": "sensor.auto_soc",
  "dm.server_cpu": "sensor.cpu",
});

const attesa = () => new Promise((resolve) => setTimeout(resolve, 0));

test("quello che la procedura guidata mappa lo prende il modello energia", () => {
  const energia = adoptEnergySlots({}, DALLA_PROCEDURA);
  assert.equal(energia.house.power, "sensor.casa_potenza");
  assert.equal(energia.solar.power, "sensor.fv_potenza");
  assert.equal(energia.battery.soc, "sensor.batteria_soc");
  /* Il raffreddamento vive fuori dai gruppi di impianto, e il gruppo si apre
   * se non c'era. */
  assert.equal(energia.cooling.fan_switch, "switch.ventola_inverter");
});

test("quello che il modello ha già non si tocca", () => {
  /* Fra le due copie ha ragione il modello: è la sola che sa di impianti, e
   * una mappatura a mano di impianti non sa niente. */
  const prima = { solar: { power: "sensor.quella_giusta" } };
  const dopo = adoptEnergySlots(prima, { "dm.energy_potenza_fotovoltaico": "sensor.quella_vecchia" });
  assert.equal(dopo.solar.power, "sensor.quella_giusta");
});

test("senza niente da adottare torna lo stesso identico oggetto", () => {
  /* È così che il negozio sa se deve aprire un gesto: senza questo,
   * ogni scrittura di una luce avrebbe salvato anche l'energia. */
  const energia = { house: { power: "sensor.casa" } };
  assert.equal(adoptEnergySlots(energia, { "dm.ev_batteria_auto": "sensor.auto" }), energia);
  assert.equal(adoptEnergySlots(energia, {}), energia);
  assert.equal(adoptEnergySlots(energia, { "dm.energy_potenza_consumo_casa": "  " }), energia);
});

test("un magazzino storto non fa cadere niente", () => {
  assert.deepEqual(adoptEnergySlots(null, null), {});
  assert.deepEqual(adoptEnergySlots([], []), {});
  assert.deepEqual(adoptEnergySlots(undefined, { "dm.energy_potenza_consumo_casa": "sensor.x" }), {
    house: { power: "sensor.x" },
  });
});

test("la legge: dopo aver adottato, la proiezione non perde più niente", () => {
  /* È il difetto scritto come proprietà, non come esempio. Proiettare su un
   * modello che ha già assorbito quelle mappature le deve restituire tutte. */
  const proiettate = projectEnergySlots(adoptEnergySlots({}, DALLA_PROCEDURA), DALLA_PROCEDURA);
  for (const [slot, entita] of Object.entries(DALLA_PROCEDURA))
    assert.equal(proiettate[slot], entita, slot);
});

test("la procedura guidata finisce e Energia è ancora lì", async () => {
  const { store, storage } = setup();
  storage.setItem("cd_entity_overrides", JSON.stringify(DALLA_PROCEDURA));
  await attesa();
  await attesa();
  const rimaste = JSON.parse(storage.getItem("cd_entity_overrides"));
  for (const [slot, entita] of Object.entries(DALLA_PROCEDURA))
    assert.equal(rimaste[slot], entita, slot);
  const energia = store.getSection("energy");
  assert.equal(energia.house.power, "sensor.casa_potenza");
  assert.equal(energia.cooling.fan_switch, "switch.ventola_inverter");
});

test("svuotare un campo lo svuota davvero, l'adozione non lo resuscita", async () => {
  /* L'altra metà della legge. L'adozione scatta solo su una scrittura che
   * arriva da fuori: se scattasse anche sulla proiezione, un campo svuotato
   * dall'editor tornerebbe pieno al primo salvataggio e non si potrebbe più
   * togliere niente. */
  const { store, storage } = setup();
  storage.setItem("cd_entity_overrides", JSON.stringify(DALLA_PROCEDURA));
  await attesa();
  await attesa();
  await store.replaceSection("energy", {
    ...store.getSection("energy"),
    cooling: { ...store.getSection("energy").cooling, fan_switch: "" },
  });
  assert.equal(store.getSection("energy").cooling.fan_switch, "");
  assert.equal(
    JSON.parse(storage.getItem("cd_entity_overrides"))[
      "dm.energy_interruttore_ventola_inverter"
    ],
    undefined,
  );
});
