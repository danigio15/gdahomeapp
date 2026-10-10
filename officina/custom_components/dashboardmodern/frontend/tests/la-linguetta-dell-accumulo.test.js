/* La linguetta «Batterie» di Energia e la tessera Accumulo (#117).
 *
 * Qui si tiene ferma la parte che si prova senza una casa vera: cosa dice la
 * risposta grande — in carica, da dove, fra quanto è piena —, l'avviso del
 * pacco da bilanciare, la striscia delle celle con la più bassa e la più
 * alta, la tessera che chiede attenzione solo per le celle, e che la
 * linguetta sta dentro Energia e non nella barra.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { accumuloDiCasa, comeStaLAccumulo } from "../src/core/l-accumulo-di-casa.js";

const {
  ACCUMULO_TAB,
  paginaDellAccumulo,
  potenzaInParole,
  tempoInParole,
  tesseraDellAccumulo,
  testaDellAccumulo,
} = await import(`../src/sections/accumulo-section.js?accumulo=${Date.now()}`);

const leggi = (percorso) => readFileSync(new URL(percorso, import.meta.url), "utf8");
const montaggio = leggi("../src/sections/accumulo-in-energia-section.js");
const scheda = leggi("../src/sections/accumulo-editor-section.js");
const parole = leggi("../src/sections/accumulo-section.js");

/* La pagina mette uno spazio che non va a capo fra il numero e l'unità. */
const piano = (testo) => String(testo).replace(/ /g, " ");

const stato = (valore, unita = "") => ({
  state: String(valore),
  attributes: { unit_of_measurement: unita },
});

function pacco(n, { soc, corrente, celle }) {
  const p = `sensor.jk_bms_${n}`;
  const stati = {
    [`${p}_state_of_charge`]: stato(soc, "%"),
    [`${p}_state_of_health`]: stato(98, "%"),
    [`${p}_total_voltage`]: stato(53.4, "V"),
    [`${p}_current`]: stato(corrente, "A"),
    [`${p}_power`]: stato(Math.round(53.4 * corrente), "W"),
    [`${p}_temperature_sensor_1`]: stato(27.1, "°C"),
    [`${p}_power_tube_temperature`]: stato(31, "°C"),
    [`${p}_charging_cycles`]: stato(214),
  };
  celle.forEach((volt, i) => (stati[`${p}_cell_voltage_${i + 1}`] = stato(volt, "V")));
  const riga = {
    entity: `${p}_state_of_charge`,
    name: `Pacco ${n}`,
    tipo: "jk",
    soh: `${p}_state_of_health`,
    tensione: `${p}_total_voltage`,
    corrente: `${p}_current`,
    potenza: `${p}_power`,
    temperatura: `${p}_temperature_sensor_1`,
    mos: `${p}_power_tube_temperature`,
    cicli: `${p}_charging_cycles`,
    capacita: "120",
    unita: "Ah",
    celle: celle.map((_v, i) => `${p}_cell_voltage_${i + 1}`),
  };
  return { stati, riga };
}

const BILANCIATE = Array.from({ length: 16 }, (_, i) => 3.33 + (i % 4) * 0.003);
const SBILANCIATE = BILANCIATE.map((volt, i) => (i === 12 ? 3.303 : i === 7 ? 3.345 : volt));

function vista({ casa = { solare: 2000, rete: 0, casa: 700 } } = {}) {
  const uno = pacco(1, { soc: 81, corrente: 12.6, celle: BILANCIATE });
  const due = pacco(2, { soc: 75, corrente: 10.7, celle: SBILANCIATE });
  const stati = { ...uno.stati, ...due.stati };
  const pacchi = accumuloDiCasa(stati, { righe: [uno.riga, due.riga] });
  return { pacchi, come: comeStaLAccumulo(pacchi, casa) };
}

test("il tempo a parole: minuti, ore a cinque minuti, giorni oltre i due", () => {
  assert.equal(piano(tempoInParole(42)), "42 min");
  assert.equal(piano(tempoInParole(130)), "2 h 10");
  assert.equal(piano(tempoInParole(121)), "2 h");
  assert.equal(tempoInParole(3 * 24 * 60), "3 giorni");
  assert.equal(tempoInParole(null), "");
  assert.equal(piano(potenzaInParole(1240)), "1,24 kW");
  assert.equal(piano(potenzaInParole(-673)), "673 W");
});

test("in cima: il verso, la carica di tutto, da dove e fra quanto è piena", () => {
  const casa = vista();
  const testa = testaDellAccumulo(casa);
  assert.equal(testa.stato, "carica");
  assert.equal(testa.grande, "In carica");
  /* Due pacchi uguali da 120 Ah: la carica pesata è la media, 78%. */
  assert.equal(Math.round(testa.soc), 78);
  assert.match(piano(testa.nomi), /^1,24 kW dal fotovoltaico · piena fra \d+ h/);
  assert.match(piano(testa.sotto), /di 12,8 kWh · 2 pacchi JK BMS da 16 celle$/);
  assert.equal(testa.avvisi.length, 1);
  assert.equal(piano(testa.avvisi[0]), "Pacco 2: celle da bilanciare (Δ 42 mV)");
});

test("la linguetta: una scheda per pacco, le celle con la più bassa e la più alta", () => {
  const markup = paginaDellAccumulo(vista());
  assert.equal((markup.match(/data-dm-accu-pacco=/g) || []).length, 2);
  assert.match(markup, /data-dm-accu-avviso/);
  assert.match(markup, /Da bilanciare/);
  /* Sedici barre per pacco, una ambra e una verde ciascuno. */
  assert.equal((markup.match(/class="dm-accu-cella"/g) || []).length, 32);
  assert.equal((markup.match(/data-tipo="min" title=/g) || []).length, 2);
  assert.equal((markup.match(/data-tipo="max" title=/g) || []).length, 2);
  assert.match(piano(markup), /min 3,303 V · cella 13/);
  assert.match(piano(markup), /max 3,345 V · cella 8/);
  /* Le letture del BMS, con la corrente col suo segno detto a parole. */
  assert.match(piano(markup), /\+12,6 A<\/b><small>in carica/);
  assert.match(markup, /MOS 31°/);
  assert.match(markup, /data-dm-accu-dato="cicli"/);
  /* Lo squilibrio sulla forcella, con la soglia di serie. */
  assert.match(piano(markup), /Δ 42 mV/);
  assert.match(piano(markup), /oltre la soglia di 30 mV/);
  /* Le icone sono le emoji della 1.8.0, come nelle altre sezioni. */
  assert.match(markup, /<i aria-hidden="true">🔋<\/i>/);
  assert.match(markup, /<i aria-hidden="true">⚠️<\/i>/);
});

test("la tessera in Home: la carica, il verso e l'attenzione solo per le celle", () => {
  const tessera = tesseraDellAccumulo(vista());
  assert.equal(tessera.key, ACCUMULO_TAB);
  assert.equal(tessera.value, "78%");
  assert.equal(tessera.ring, 78);
  assert.equal(tessera.alert, true);
  assert.equal(tessera.attiva, true);
  assert.match(piano(tessera.caption), /^In carica 1,24 kW · piena fra .* · Pacco 2 Δ 42 mV$/);
  assert.equal(tessera.rows.length, 2);
  assert.equal(tessera.rows[1].tono, "allarme");
  assert.equal(tessera.rows[0].tono, "quiete");

  /* Con le celle in regola la tessera sta zitta. */
  const uno = pacco(1, { soc: 40, corrente: -6, celle: BILANCIATE });
  const pacchi = accumuloDiCasa(uno.stati, { righe: [uno.riga] });
  const quieta = tesseraDellAccumulo({ pacchi, come: comeStaLAccumulo(pacchi, { casa: 400 }) });
  assert.equal(quieta.alert, false);
  assert.match(piano(quieta.caption), /^In scarica 320 W · vuota fra /);
  assert.equal(tesseraDellAccumulo(null), null);
});

test("la linguetta sta dentro Energia, in fondo dopo Temperature, e c'è solo coi pacchi", () => {
  assert.match(montaggio, /\.sub-tabs-energy/);
  /* «Batterie va in fondo dopo Temperature», e ci resta. */
  assert.match(montaggio, /function inFondoAllaFila\(linguetta\)/);
  assert.match(montaggio, /inFondoAllaFila\(linguetta\);\n\s+const serve = ciSonoPacchi\(\);/);
  assert.match(montaggio, /className = "flow-view"/);
  assert.match(montaggio, /ciSonoPacchi\(\)/);
  /* Nessuna voce nella barra in basso. */
  assert.doesNotMatch(montaggio, /nav\.tabs/);
  /* La scheda si riempie alla prima apertura dal rilevamento dei BMS. */
  assert.match(scheda, /pacchiDaImportare/);
  assert.match(scheda, /costruisciSchedaDichiarata/);
  /* La linguetta porta la batteria davanti al nome, come «☀️ Solare». */
  assert.match(montaggio, /`🔋 \$\{esc\(t\("Batterie", "Batteries"\)\)\}`/);
});
