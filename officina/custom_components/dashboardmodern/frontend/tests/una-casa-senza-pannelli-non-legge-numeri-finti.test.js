/* «Uno switch che tolga completamente la gestione energetica casa con
 * fotovoltaico, pulendo da info errate la pagina energia» (#82, dal gruppo
 * Facebook).
 *
 * In una casa senza pannelli la pagina Energia mostrava lo stesso l'impianto:
 *
 *  · «Produzione FV 0,0 kWh» — che non è produzione zero, è che i pannelli non
 *    ci sono;
 *  · «Autosufficienza 100 %» — e questo è il numero sbagliato vero. Viene da
 *    `(consumo − prelievo) / consumo`, e in quella casa il prelievo è `0`
 *    perché nemmeno il contatore di rete è configurato: 85,4 kWh presi tutti
 *    dalla rete si leggevano come autosufficienza piena.
 *
 * Il consumo — l'unica cosa che quella casa misura davvero — si perdeva in
 * mezzo a due numeri finti.
 *
 * Queste prove tengono ferme due cose che sembrano una sola e non lo sono: se
 * i pannelli ci sono, e se l'autosufficienza si può dire. Il 100 % è sbagliato
 * anche in una casa CHE HA i pannelli, se le manca il contatore di rete.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  cEIlFotovoltaico,
  conIlFotovoltaico,
  SENZA_FOTOVOLTAICO,
  siPuoDireLAutosufficienza,
  spentoAMano,
} from "../src/core/il-fotovoltaico-di-questa-casa.js";
import { DashboardStore } from "../src/core/dashboard-store.js";
import { persistIlFotovoltaico } from "../src/core/energy-writer.js";
import { plantIsConfigured } from "../src/core/energy-plants.js";

const QUI = dirname(fileURLToPath(import.meta.url));
const sorgente = (...pezzi) => readFileSync(join(QUI, "..", ...pezzi), "utf8");

/* La casa della segnalazione: misura il consumo e nient'altro. */
const SENZA_PANNELLI = Object.freeze({
  house: { monthly_energy: "sensor.casa_mese" },
  grid: {},
  solar: {},
  battery: {},
});
const COMPLETA = Object.freeze({
  house: { monthly_energy: "sensor.casa_mese" },
  grid: { monthly_import_energy: "sensor.rete_mese" },
  solar: { monthly_energy: "sensor.fv_mese" },
  battery: {},
});

test("il numero sbagliato, scritto come conto", () => {
  /* Il difetto per quello che è, prima di qualunque correzione: è aritmetica,
   * non un caso raro. Con il prelievo a zero il conto dà sempre 100. */
  const autonomia = (casa, prelievo) => Math.round(((casa - prelievo) / casa) * 100);
  assert.equal(autonomia(85.4, 0), 100);
  /* E la regola nuova dice che in quella casa quel numero non si può dire. */
  assert.equal(siPuoDireLAutosufficienza(SENZA_PANNELLI), false);
});

test("senza nemmeno un'entità di produzione, i pannelli non ci sono", () => {
  assert.equal(cEIlFotovoltaico(SENZA_PANNELLI), false);
  assert.equal(cEIlFotovoltaico({}), false);
});

test("una sola entità di produzione basta, e non si guarda quanto produce", () => {
  /* Una giornata di pioggia produce zero, e zero di notte è la regola:
   * spegnere la pagina a ogni tramonto sarebbe peggio del difetto. */
  assert.equal(cEIlFotovoltaico({ solar: { power: "sensor.fv_w" } }), true);
  assert.equal(cEIlFotovoltaico({ solar: { total_energy: "sensor.fv_totale" } }), true);
});

test("la spunta vince sulle entità, in tutte e due i versi", () => {
  const spento = conIlFotovoltaico(COMPLETA, false);
  assert.equal(spentoAMano(spento), true);
  assert.equal(cEIlFotovoltaico(spento), false);
  assert.equal(siPuoDireLAutosufficienza(spento), false);
  /* Riacceso non scrive `false`: toglie la spunta, così una casa che non l'ha
   * mai toccata e una che l'ha rimessa com'era si scrivono uguali. */
  const riacceso = conIlFotovoltaico(spento, true);
  assert.equal(SENZA_FOTOVOLTAICO in riacceso.metadata, false);
  assert.equal(cEIlFotovoltaico(riacceso), true);
});

test("e non porta via il resto dei metadata", () => {
  const con = { ...COMPLETA, metadata: { semantics_version: 4, cooling_migrated: true } };
  const dopo = conIlFotovoltaico(con, false);
  assert.equal(dopo.metadata.semantics_version, 4);
  assert.equal(dopo.metadata.cooling_migrated, true);
  assert.equal(dopo.metadata[SENZA_FOTOVOLTAICO], true);
});

test("l'autosufficienza vuole tutte e tre le misure", () => {
  assert.equal(siPuoDireLAutosufficienza(COMPLETA), true);
  /* Pannelli ma niente contatore di rete: è l'altro caso in cui il 100 % è
   * sbagliato, e la spunta non c'entra niente. */
  assert.equal(siPuoDireLAutosufficienza({ ...COMPLETA, grid: {} }), false);
  assert.equal(siPuoDireLAutosufficienza({ ...COMPLETA, house: {} }), false);
  assert.equal(siPuoDireLAutosufficienza({ ...COMPLETA, solar: {} }), false);
});

test("la potenza della rete non è il prelievo dalla rete", () => {
  /* Il gruppo `grid` tiene tre cose: la potenza scambiata, quello che si
   * preleva e quello che si immette. Al conto serve il prelievo — la potenza
   * non è energia, e l'immissione è il verso opposto. */
  assert.equal(siPuoDireLAutosufficienza({ ...COMPLETA, grid: { power: "sensor.rete_w" } }), false);
  assert.equal(
    siPuoDireLAutosufficienza({ ...COMPLETA, grid: { daily_export_energy: "sensor.immessa" } }),
    false,
  );
  assert.equal(
    siPuoDireLAutosufficienza({ ...COMPLETA, grid: { total_import_energy: "sensor.presa" } }),
    true,
  );
});

test("la spunta non fa sembrare configurato un impianto vuoto", () => {
  /* È il motivo per cui sta nei `metadata` e non dentro `solar`:
   * `plantIsConfigured` guarda dentro i quattro gruppi, e una spunta lì
   * dentro farebbe passare per configurato un impianto in cui non c'è
   * scritta nessuna entità. */
  const vuoto = conIlFotovoltaico({ house: {}, grid: {}, solar: {}, battery: {} }, false);
  assert.equal(plantIsConfigured(vuoto), false);
});

test("un modello storto non fa cadere niente", () => {
  for (const storto of [null, undefined, [], "", 7]) {
    assert.equal(cEIlFotovoltaico(storto), false);
    assert.equal(siPuoDireLAutosufficienza(storto), false);
  }
});

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

test("la spunta sopravvive al salvataggio, e al giro dopo", async () => {
  /* La prova che conta: ogni scrittura sul modello Energia passa da
   * `withSemantics`, che rifà i `metadata`. Se quella mano non si portasse
   * dietro la spunta, spegnere il fotovoltaico durerebbe fino al primo campo
   * salvato — cioè un interruttore che si rimette da solo. */
  const store = new DashboardStore({ storage: new MemoryStorage(), sync: async () => {} });
  store.migrate();
  await store.replaceSection("energy", { ...COMPLETA });
  await persistIlFotovoltaico(store, false);
  assert.equal(cEIlFotovoltaico(store.getSection("energy")), false);
  assert.equal(store.getSection("energy").metadata.semantics_version > 0, true);
  await persistIlFotovoltaico(store, true);
  assert.equal(cEIlFotovoltaico(store.getSection("energy")), true);
});

test("la pagina Energia nasconde quello che in questa casa non esiste", () => {
  const pagina = sorgente("src", "sections", "energy-section.js");
  /* Si spegne con una classe, mai togliendo il nodo: il guscio e gli altri
   * moduli scrivono dentro queste caselle a ogni pacchetto, e un nodo sparito
   * li manderebbe a scrivere nel vuoto. */
  assert.match(pagina, /mostra\(ilRiquadroDi\("ed-kpi-prod"\), ilSole\)/);
  assert.match(pagina, /mostra\(ilRiquadroDi\("ed-kpi-auto"\), lAutosufficienza\)/);
  assert.match(pagina, /\.ed-auto-row.*lAutosufficienza|lAutosufficienza.*ed-auto-row/s);
  assert.match(pagina, /#page-energia \.dm-senza-fv\{display:none!important\}/);
  /* Il consumo resta sempre: è l'unica cosa che quella casa misura. */
  assert.equal(/mostra\([^)]*ed-kpi-cons/.test(pagina), false);
});

test("il grafico non disegna una linea che non c'è", () => {
  const grafico = sorgente("src", "sections", "energy-report-polish-section.js");
  assert.match(grafico, /const ilSole = cEIlFotovoltaico\(model\(\)\)/);
  assert.match(grafico, /\.\.\.\(ilSole/);
  /* E la legenda segue la linea: nominare un colore che nel grafico non c'è
   * è lo stesso difetto, scritto più piccolo. */
  assert.match(grafico, /legendaDellAndamento\(fasce, ilSole\)/);
});

test("l'interruttore sta accanto alle entità di produzione", () => {
  const disegno = sorgente("src", "core", "renderers.js");
  assert.match(disegno, /if \(group === "solar"\) body\.append\(createSolarPresenceField\(/);
  assert.match(disegno, /block\.dataset\.energyGroup = group/);
  /* Dice quello che C'È, non quello che si toglie: un interruttore che si
   * accende per togliere una cosa lo si legge due volte e la seconda si
   * sbaglia. */
  assert.match(disegno, /pick\("Impianto fotovoltaico", "Photovoltaic system", locale\)/);
});
