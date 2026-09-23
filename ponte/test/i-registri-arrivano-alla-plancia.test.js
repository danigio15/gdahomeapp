/* I registri, dal ponte alla plancia.
 *
 * «Non devi mettere le entita' ma i dispositivi non connessi, cosi' come li
 * mostri nel cruscotto installatore.»
 *
 * Il cruscotto quei dispositivi li sa perche' glieli manda questo ponte, che i
 * registri li legge gia' per il rapporto. La plancia no: chiederli a Home
 * Assistant e' la porta che la #553 ha chiuso, quindi la regola e' «non si
 * chiede: si ricorda», e a lasciarli scritti e' chi ce li ha gia'. Dentro Home
 * Assistant e' il pannello; nell'app non era nessuno, e sul telefono l'avviso
 * tornava a contare le entita'.
 *
 * Qui si difende la porta che chiude quel buco, e le due cose che la rendono
 * innocua: si legge **una volta sola** anche se in due la chiedono insieme, e
 * da qui **non esce nessuno stato**.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { Commissioni } from "../src/commissioni.js";
import { leDueMappe, Registri } from "../src/registri.js";

/* Una casa che conta quante volte le si chiede ogni registro, e che puo'
 * prendersi tempo per rispondere. */
function casaFinta({ dispositivi = [], entita = [], lenta = false } = {}) {
  const chieste = [];
  return {
    chieste,
    async chiedi(detto) {
      chieste.push(detto.type);
      if (lenta) await new Promise((fatto) => setTimeout(fatto, 20));
      if (detto.type === "config/device_registry/list") return dispositivi;
      if (detto.type === "config/entity_registry/list") return entita;
      throw new Error(`la casa finta non sa ${detto.type}`);
    },
  };
}

const DISPOSITIVI = [
  { id: "asc1", name: "Dryer", name_by_user: "Asciugatrice" },
  { id: "giard1", name: "Presa giardino" },
  { id: "muto", name: "" },
];
const ENTITA = [
  { entity_id: "lock.asciugatrice_child_lock", device_id: "asc1" },
  { entity_id: "sensor.asciugatrice_programma", device_id: "asc1" },
  { entity_id: "switch.presa_giardino", device_id: "giard1" },
  { entity_id: "input_boolean.vacanza" },
];

test("le due mappe dicono di chi è ogni entità, e come si chiama quel qualcuno", () => {
  const mappe = leDueMappe({ dispositivi: DISPOSITIVI, entita: ENTITA });
  assert.equal(mappe.di["lock.asciugatrice_child_lock"], "asc1");
  assert.equal(mappe.di["switch.presa_giardino"], "giard1");
  /* Il nome che gli ha messo chi abita vince su quello di fabbrica: è quello
   * che uno riconosce. È la stessa regola di Home Assistant, ed è la stessa
   * che applica la plancia dall'altra parte. */
  assert.equal(mappe.nomi.asc1, "Asciugatrice");
  assert.equal(mappe.nomi.giard1, "Presa giardino");
  assert.ok(
    !("input_boolean.vacanza" in mappe.di),
    "un'entità senza dispositivo non entra: «non lo so» deve restare vuoto",
  );
  assert.ok(!("muto" in mappe.nomi), "un dispositivo senza nome non ne inventa uno");
});

test("i registri si leggono una volta sola, anche se in due li chiedono insieme", async () => {
  const casa = casaFinta({ dispositivi: DISPOSITIVI, entita: ENTITA, lenta: true });
  const registri = new Registri({ casa });
  /* Il rapporto e una plancia che si apre nello stesso istante sono due
   * domande alla stessa cosa. `config/entity_registry/list` è la risposta più
   * pesante che Home Assistant sappia dare: farla due volte insieme è
   * esattamente quello che la #553 ha chiuso. */
  const [una, altra] = await Promise.all([registri.chiedi(), registri.chiedi()]);
  assert.equal(una, altra, "la seconda aspetta la prima invece di aprirne un'altra");
  assert.deepEqual(casa.chieste.sort(), [
    "config/device_registry/list",
    "config/entity_registry/list",
  ]);
});

test("e poi si tengono da parte: la domanda dopo non torna a Home Assistant", async () => {
  const casa = casaFinta({ dispositivi: DISPOSITIVI, entita: ENTITA });
  const registri = new Registri({ casa });
  await registri.chiedi();
  await registri.chiedi();
  await registri.leMappe();
  assert.equal(casa.chieste.length, 2, "due letture in tutto, non sei");
});

test("passati cinque minuti si torna a chiedere: un nome nuovo si vede", async () => {
  let orologio = 0;
  const casa = casaFinta({ dispositivi: DISPOSITIVI, entita: ENTITA });
  const registri = new Registri({ casa, adesso: () => orologio });
  await registri.chiedi();
  orologio = 4 * 60 * 1000;
  await registri.chiedi();
  assert.equal(casa.chieste.length, 2, "dentro i cinque minuti vale quello che c'è");
  orologio = 5 * 60 * 1000 + 1;
  await registri.chiedi();
  assert.equal(casa.chieste.length, 4, "passati i cinque minuti si riguarda");
});

test("una casa che non risponde non fa cadere niente: escono mappe vuote", async () => {
  const registri = new Registri({
    casa: {
      async chiedi() {
        throw new Error("Home Assistant non risponde");
      },
    },
  });
  assert.deepEqual(await registri.leMappe(), { di: {}, nomi: {} });
});

/* ── E la porta che la plancia bussa ───────────────────────────────────── */

function commissioniCon(registri) {
  return new Commissioni({
    casa: { async chiedi() {} },
    registro: { debug() {}, info() {}, attenzione() {}, errore() {} },
    registri,
  });
}

test("la plancia chiede «ponte/registri» e si sente rispondere le due mappe", async () => {
  const casa = casaFinta({ dispositivi: DISPOSITIVI, entita: ENTITA });
  const commissioni = commissioniCon(new Registri({ casa }));
  assert.ok(
    commissioni.riconosce({ type: "ponte/registri" }),
    "comincia per «ponte/»: la fa il ponte, e non si gira a Home Assistant",
  );
  const detta = await commissioni.rispondi({ id: 7, type: "ponte/registri" });
  assert.equal(detta.id, 7);
  assert.equal(detta.success, true);
  assert.equal(detta.result.di["switch.presa_giardino"], "giard1");
  assert.equal(detta.result.nomi.giard1, "Presa giardino");
});

test("da quella porta non esce nessuno stato", async () => {
  const casa = casaFinta({ dispositivi: DISPOSITIVI, entita: ENTITA });
  const commissioni = commissioniCon(new Registri({ casa }));
  const detta = await commissioni.rispondi({ id: 1, type: "ponte/registri" });
  /* Due chiavi e basta. Che cosa stia facendo adesso quella presa non è roba
   * di questa porta, e non lo deve diventare: è la stessa riga che il
   * rapporto tiene da sempre. */
  assert.deepEqual(Object.keys(detta.result).sort(), ["di", "nomi"]);
  const scritto = JSON.stringify(detta.result);
  for (const proibito of ["state", '"on"', '"off"', "unavailable", "last_changed"])
    assert.ok(!scritto.includes(proibito), `${proibito} non deve uscire di qui`);
});

test("un ponte senza anagrafe risponde «non conosco», e la plancia se la cava", async () => {
  /* È quello che succede dentro Home Assistant, dove questo comando non
   * esiste: lì le mappe le ha già lasciate il pannello, e chiedere sarebbe
   * chiedere una cosa che non manca. */
  const commissioni = commissioniCon(null);
  const detta = await commissioni.rispondi({ id: 3, type: "ponte/registri" });
  assert.equal(detta.success, false);
  assert.equal(detta.error.code, "unknown_command");
});
