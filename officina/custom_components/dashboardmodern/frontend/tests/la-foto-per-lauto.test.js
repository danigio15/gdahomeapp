/* La fotografia che il telefono lascia all'auto.
 *
 * In macchina si guarda, non si studia: tre numeri, chi c'è in casa, sei
 * tasti. Quello che conta qui è che non esca mai una schermata che sembra
 * piena e non lo è — in auto chi guarda non ha modo di accorgersene.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  AZIONI_AL_MASSIMO,
  MISURE_AL_MASSIMO,
  eInCasa,
  firmaDellaFoto,
  laFotoPerLAuto,
} from "../src/core/la-foto-per-lauto.js";

const leggi = (quale) => readFileSync(new URL(quale, import.meta.url), "utf8");

const ENERGIA = {
  nome: "Energia",
  valore: "725 W",
  righe: [
    { nome: "Casa", valore: "725 W" },
    { nome: "Solare", valore: "485 W" },
    { nome: "Rete", valore: "240 W" },
    { nome: "Batteria", valore: "0 W · 87%" },
  ],
};

test("senza niente da mostrare non si scrive nessuna fotografia", () => {
  /* Un file vuoto farebbe credere all'auto di avere una fotografia quando non
   * ce l'ha: la schermata direbbe «casa» e sotto non ci sarebbe niente, e non
   * si capirebbe se la casa è spenta o se il telefono non ha mandato. */
  assert.equal(laFotoPerLAuto(), null);
  assert.equal(laFotoPerLAuto({ casa: "Casa mia" }), null);
  assert.equal(laFotoPerLAuto({ casa: "Casa mia", energia: { valore: "" }, persone: [] }), null);
});

test("in auto vanno le sorgenti, non lo stesso numero due volte", () => {
  const foto = laFotoPerLAuto({ casa: "Casa mia", energia: ENERGIA });
  assert.equal(foto.casa, "Casa mia");
  /* Il numero grande della tessera E' la potenza della casa, ed e' la stessa
   * cosa che dice la prima riga: messo anche in cima usciva «Energia 725 W»
   * sopra «Casa 725 W» — lo stesso numero due volte su tre righe — e la rete
   * restava fuori per fargli posto. */
  assert.deepEqual(foto.fotovoltaico, [
    { nome: "Casa", valore: "725 W" },
    { nome: "Solare", valore: "485 W" },
    { nome: "Rete", valore: "240 W" },
  ]);
  /* Tre: la quarta non si legge, e il pannello di Android ne mette comunque
   * due grosse in cima. */
  assert.equal(foto.fotovoltaico.length, MISURE_AL_MASSIMO);
});

test("senza righe resta il numero grande, che e' meglio di niente", () => {
  /* Una casa con un contatore solo e nient'altro mappato: una riga sola, e
   * quella. */
  assert.deepEqual(laFotoPerLAuto({ energia: { nome: "Energia", valore: "725 W" } }).fotovoltaico, [
    { nome: "Energia", valore: "725 W" },
  ]);
  /* E senza nome non esce una riga anonima. */
  assert.deepEqual(laFotoPerLAuto({ energia: { nome: " ", valore: "725 W" } }).fotovoltaico, [
    { nome: "Energia", valore: "725 W" },
  ]);
});

test("una riga senza nome o senza valore non entra", () => {
  const foto = laFotoPerLAuto({
    energia: {
      nome: "Energia",
      valore: "725 W",
      righe: [{ nome: "Solare", valore: "" }, { nome: "", valore: "485 W" }, null],
    },
  });
  /* Nessuna riga buona: resta il numero grande. */
  assert.deepEqual(foto.fotovoltaico, [{ nome: "Energia", valore: "725 W" }]);
});

test("chi è in casa lo dice lo stato, non l'elenco", () => {
  const states = {
    "person.gio": { state: "home" },
    "person.ada": { state: "not_home" },
    "person.leo": { state: "Ufficio" },
    "device_tracker.nina": { state: "HOME" },
  };
  assert.equal(eInCasa("person.gio", states), true);
  assert.equal(eInCasa("person.ada", states), false);
  /* Il nome di una zona vuol dire «non è qui»: è fuori, in un posto che ha un
   * nome. */
  assert.equal(eInCasa("person.leo", states), false);
  assert.equal(eInCasa("device_tracker.nina", states), true);
  /* Una persona senza entità, o un'entità che non c'è, non è in casa: e non
   * solleva niente. */
  assert.equal(eInCasa("", states), false);
  assert.equal(eInCasa("person.chi", states), false);
  assert.equal(eInCasa("person.gio"), false);
});

test("chi è nascosto in Home resta nascosto anche in auto", () => {
  /* È una scelta già fatta nella plancia: rifarla qui vorrebbe dire chiederla
   * due volte, e il giorno che si scostano uno sparisce da una parte sola. */
  const foto = laFotoPerLAuto({
    persone: [
      { name: "Gio", entity: "person.gio" },
      { name: "Chi non c'è più", entity: "person.ex", nascosta: true },
      { name: "", entity: "person.senza" },
    ],
    states: { "person.gio": { state: "home" } },
  });
  assert.deepEqual(foto.persone, [{ nome: "Gio", inCasa: true }]);
});

test("le azioni sono sei, con l'id che serve a premerle", () => {
  const azioni = Array.from({ length: 9 }, (_, i) => ({
    id: `a${i}`,
    name: `Azione ${i}`,
    icon: "💡",
  }));
  const foto = laFotoPerLAuto({ azioni });
  assert.equal(foto.azioni.length, AZIONI_AL_MASSIMO);
  /* Le prime sei: sono quelle che chi ha la casa ha messo davanti. */
  assert.deepEqual(foto.azioni[0], { id: "a0", nome: "Azione 0", segno: "💡" });
  assert.equal(foto.azioni.at(-1).id, "a5");
});

test("un tasto che non si può premere non si disegna", () => {
  /* Senza id non si può chiedere niente, e un tasto che si preme e non fa
   * niente è peggio di un tasto che non c'è: in macchina si preme e si torna
   * a guardare la strada, non si controlla se è successo. */
  const foto = laFotoPerLAuto({
    azioni: [
      { id: "", name: "Muta" },
      { id: "vera", name: "Vera" },
      { id: "vera", name: "La stessa due volte" },
      { id: "senza-nome", name: " " },
    ],
  });
  assert.deepEqual(foto.azioni, [{ id: "vera", nome: "Vera", segno: "" }]);
});

test("la fotografia porta il momento in cui è stata scattata", () => {
  /* Invecchia in fretta, e una schermata che mostra numeri di mezz'ora fa
   * facendo credere che siano adesso è peggio di una schermata vuota: magari
   * uno decide di non passare da casa. */
  const foto = laFotoPerLAuto({ energia: ENERGIA, adesso: 1_700_000_000_000 });
  assert.equal(foto.quando, 1_700_000_000_000);
  const adesso = laFotoPerLAuto({ energia: ENERGIA, adesso: NaN });
  assert.ok(Number.isFinite(adesso.quando) && adesso.quando > 0);
});

test("si rimanda solo quando cambia davvero", () => {
  /* Gli stati arrivano a mazzetti più volte al secondo: riscrivere il file a
   * ogni mazzetto vorrebbe dire scrivere sul disco tutto il giorno per dire la
   * stessa cosa. */
  const prima = laFotoPerLAuto({ casa: "Casa mia", energia: ENERGIA, adesso: 1000 });
  const dopo = laFotoPerLAuto({ casa: "Casa mia", energia: ENERGIA, adesso: 999_000 });
  assert.equal(firmaDellaFoto(prima), firmaDellaFoto(dopo));
  const cambiata = laFotoPerLAuto({
    casa: "Casa mia",
    energia: {
      ...ENERGIA,
      righe: [{ nome: "Casa", valore: "1,2 kW" }, ...ENERGIA.righe.slice(1)],
    },
    adesso: 1000,
  });
  assert.notEqual(firmaDellaFoto(prima), firmaDellaFoto(cambiata));
  assert.equal(firmaDellaFoto(null), "");
});

test("il nucleo non legge il deposito e non scrive niente", () => {
  /* È puro: entrano le misure già scritte, esce l'oggetto che diventa un
   * file. Chi legge la plancia e chi scrive il file stanno nella sezione. */
  const nucleo = leggi("../src/core/la-foto-per-lauto.js");
  assert.doesNotMatch(nucleo, /readJson|localStorage|postMessage|document/);
});

test("quello che esce è la forma che l'auto sa leggere", () => {
  /* Dall'altra parte c'è Kotlin, e legge campo per campo: un nome cambiato qui
   * è una schermata vuota in macchina, senza nessun errore da nessuna parte. */
  const auto = leggi(
    "../../../../../app/android/app/src/main/kotlin/com/gdahome/gdahome/auto/LaFotoDellaCasa.kt",
  );
  const foto = laFotoPerLAuto({
    casa: "Casa mia",
    energia: ENERGIA,
    persone: [{ name: "Gio", entity: "person.gio" }],
    states: { "person.gio": { state: "home" } },
    azioni: [{ id: "buonanotte", name: "Buonanotte", icon: "🌙" }],
  });
  for (const campo of ["casa", "quando", "fotovoltaico", "persone", "azioni"])
    assert.match(auto, new RegExp(`"${campo}"`), `l'auto deve leggere ${campo}`);
  for (const campo of Object.keys(foto.fotovoltaico[0])) assert.match(auto, new RegExp(`"${campo}"`));
  for (const campo of Object.keys(foto.persone[0])) assert.match(auto, new RegExp(`"${campo}"`));
  for (const campo of Object.keys(foto.azioni[0])) assert.match(auto, new RegExp(`"${campo}"`));
});
