/* Ogni dato di GdAAuto ha la sua casella, e la casella sa leggerlo.
 *
 * «Ogni dato che GdAAuto espone deve avere la sua casella in GdAHome: piena da
 * sola quando l'auto arriva dall'integrazione, e da scegliere a mano nella
 * scheda.» Il contratto e' `docs/DATI-AUTO.md` di GdAAuto, e qui sta in
 * `CHIAVI_DI_GDAAUTO`: si prova che ogni casella di quella tabella stia nella
 * scheda, che la lettura la capisca, e che la capacita' e il consumo che
 * l'auto dice arrivino dove la plancia faceva i conti a occhio.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { CHIAVI_DI_GDAAUTO } from "../src/core/auto-device-binding.js";
import {
  CASELLE_DELL_AUTO,
  CASELLE_TERMICHE,
  RIFERIMENTI_DELL_AUTO,
  casellaDellAuto,
  istanteDetto,
  letturaTermica,
  marciaDalloStato,
  senzaParentesi,
} from "../src/core/auto-termica.js";
import { CONSUMO_DI_SERIE, consumoMisurato, consumoStimato } from "../src/core/i-viaggi.js";
import { codiceDellaRicarica } from "../src/core/stato-della-ricarica.js";
import {
  CASELLA_DELLA_CAPACITA,
  capacitaDellaBatteria,
  kilowattoraDalloStato,
} from "../src/core/vehicle-model.js";

const leggi = (percorso) => readFile(new URL(`../${percorso}`, import.meta.url), "utf8");
const stato = (state, attributes = {}) => ({ state, attributes });

/* Le caselle che il guscio disegna da se' nella scheda Veicoli. */
async function caselleDelGuscio(file) {
  const guscio = await leggi(`legacy/${file}`);
  const inizio = guscio.indexOf("ev: { label:");
  const blocco = guscio.slice(inizio, guscio.indexOf("]}", inizio));
  return new Set([...blocco.matchAll(/ref: '(dm\.ev_[a-z0-9_]+)'/g)].map((m) => m[1]));
}

test("ogni casella del contratto si sceglie anche a mano, nella scheda dell'auto", async () => {
  const nostre = new Set([...CASELLE_TERMICHE, ...CASELLE_DELL_AUTO].map((voce) => voce.ref));
  for (const file of ["dashboard-runtime-it.js", "dashboard-runtime-en.js"]) {
    const guscio = await caselleDelGuscio(file);
    assert.ok(guscio.has("dm.ev_batteria_auto"), `${file}: la scheda dell'auto non si trova`);
    for (const [chiave, ref] of CHIAVI_DI_GDAAUTO)
      assert.ok(nostre.has(ref) || guscio.has(ref), `${chiave} → ${ref}: nessuna casella`);
    /* E nessuna casella nuova rifa' una del guscio. */
    for (const ref of RIFERIMENTI_DELL_AUTO) assert.ok(!guscio.has(ref), `${ref} c'e' gia'`);
  }
  /* Una casella sola per riferimento. */
  const tutte = [...CASELLE_TERMICHE, ...CASELLE_DELL_AUTO].map((voce) => voce.ref);
  assert.equal(new Set(tutte).size, tutte.length);
});

test("ogni dato dell'auto connessa ha tipo, disegno ed etichetta nelle due lingue", () => {
  for (const voce of CASELLE_DELL_AUTO) {
    assert.match(voce.ref, /^dm\.ev_[a-z0-9_]+$/);
    assert.ok(voce.campo && voce.tipo && voce.glifo, voce.ref);
    assert.ok(["misura", "gradi", "acceso", "parola", "ora", "marcia"].includes(voce.tipo), voce.ref);
    assert.ok(voce.it && voce.en, voce.ref);
    /* La parentesi dice che entita' scegliere, e sulla pagina si toglie. */
    assert.match(voce.it, /\)$/, voce.ref);
    assert.match(voce.en, /\)$/, voce.ref);
    assert.equal(casellaDellAuto(voce.ref), voce);
  }
  assert.equal(casellaDellAuto("dm.ev_batteria_auto"), null);
  /* I nomi del contratto sono quelli di GdAAuto, e dicono la stessa cosa. */
  assert.equal(casellaDellAuto("dm.ev_consumo_medio").it, "Consumo medio (kWh/100 km)");
  assert.equal(casellaDellAuto("dm.ev_clima").tipo, "acceso");
  assert.equal(casellaDellAuto("dm.ev_marcia").tipo, "marcia");
});

test("l'etichetta sulla pagina e' quella della scheda, senza la parentesi", () => {
  assert.equal(senzaParentesi("Energia residua (kWh)"), "Energia residua");
  assert.equal(senzaParentesi("Corrente all'esterno, V2L (acceso/spento)"), "Corrente all'esterno, V2L");
  /* La parentesi larga del giapponese e del cinese. */
  assert.equal(senzaParentesi("残りエネルギー（kWh）"), "残りエネルギー");
  assert.equal(senzaParentesi("Senza parentesi"), "Senza parentesi");
});

test("la lettura capisce i dati nuovi: misure con l'unita', la marcia, gli orari, acceso e spento", () => {
  const mappa = {
    "dm.ev_energia_residua": "sensor.b10_energia_residua",
    "dm.ev_consumo_medio": "sensor.b10_consumo_medio",
    "dm.ev_temperatura_interna": "sensor.b10_temperatura_interna",
    "dm.ev_clima": "binary_sensor.b10_clima_acceso",
    "dm.ev_marcia": "sensor.b10_marcia",
    "dm.ev_ricarica_inizio": "sensor.b10_ricarica_inizio",
    "dm.ev_ultimo_aggiornamento": "sensor.b10_ultimo_aggiornamento",
    "dm.ev_in_sonno": "binary_sensor.b10_in_sonno",
  };
  const states = {
    "sensor.b10_energia_residua": stato("40.2", { unit_of_measurement: "kWh" }),
    "sensor.b10_consumo_medio": stato("15.8", { unit_of_measurement: "kWh/100 km" }),
    "sensor.b10_temperatura_interna": stato("21.5", { unit_of_measurement: "°C" }),
    "binary_sensor.b10_clima_acceso": stato("on"),
    "sensor.b10_marcia": stato("avanti"),
    "sensor.b10_ricarica_inizio": stato("23:30"),
    "sensor.b10_ultimo_aggiornamento": stato("2026-10-18T07:30:00+00:00"),
    "binary_sensor.b10_in_sonno": stato("unavailable"),
  };
  const lettura = letturaTermica(mappa, states);
  assert.equal(lettura.energiaResidua, 40.2);
  assert.equal(lettura.caselle.energiaResidua.unita, "kWh");
  assert.equal(lettura.consumoMedio, 15.8);
  assert.equal(lettura.interna, 21.5);
  assert.equal(lettura.clima, true);
  assert.equal(lettura.marcia, "D");
  assert.equal(lettura.ricaricaInizio, "23:30");
  assert.equal(lettura.ultimoAggiornamento, Date.parse("2026-10-18T07:30:00+00:00"));
  /* Un sensore muto non e' «spento»: non e' niente. */
  assert.equal(lettura.inSonno, null);
  /* Una casella non mappata non entra nella lettura. */
  assert.equal(lettura.potenzaRiscaldatore, undefined);
});

test("la marcia e' la lettera del cambio, in qualunque lingua", () => {
  assert.equal(marciaDalloStato("parcheggio"), "P");
  assert.equal(marciaDalloStato("retromarcia"), "R");
  assert.equal(marciaDalloStato("folle"), "N");
  assert.equal(marciaDalloStato("avanti"), "D");
  assert.equal(marciaDalloStato("Drive"), "D");
  assert.equal(marciaDalloStato("park"), "P");
  assert.equal(marciaDalloStato("boh"), null);
  assert.equal(marciaDalloStato(""), null);
});

test("un istante si dice con l'ora se e' di oggi, col giorno se no", () => {
  const adesso = new Date(2026, 9, 18, 12, 0).getTime();
  assert.match(istanteDetto(new Date(2026, 9, 18, 7, 30).getTime(), { lingua: "it", adesso }), /07:30/);
  assert.match(istanteDetto(new Date(2026, 9, 15, 7, 30).getTime(), { lingua: "it", adesso }), /15/);
  assert.equal(istanteDetto(Number.NaN), "");
});

test("la capacita': lo scritto vince, il sensore dell'auto quando non c'e'", () => {
  const states = {
    "sensor.b10_capacita": stato("67.1", { unit_of_measurement: "kWh" }),
    "sensor.b10_capacita_wh": stato("67100", { unit_of_measurement: "Wh" }),
  };
  const auto = { kwh: "", ov: { [CASELLA_DELLA_CAPACITA]: "sensor.b10_capacita" } };
  assert.equal(capacitaDellaBatteria(auto, states), 67.1);
  /* Senza gli stati si risponde come prima: la sola casella scritta. */
  assert.equal(capacitaDellaBatteria(auto), null);
  assert.equal(capacitaDellaBatteria({ ...auto, kwh: "52" }, states), 52);
  assert.equal(
    capacitaDellaBatteria({ ov: { [CASELLA_DELLA_CAPACITA]: "sensor.b10_capacita_wh" } }, states),
    67.1,
  );
  /* Un sensore muto, o un numero che non sta in piedi, non e' una capacita'. */
  assert.equal(kilowattoraDalloStato(stato("unavailable")), null);
  assert.equal(kilowattoraDalloStato(stato("0", { unit_of_measurement: "kWh" })), null);
  assert.equal(kilowattoraDalloStato(stato("4000", { unit_of_measurement: "kWh" })), null);
  assert.equal(capacitaDellaBatteria({ ov: { [CASELLA_DELLA_CAPACITA]: "sensor.manca" } }, states), null);
});

test("il consumo misurato dall'auto, da qualunque unita', vince sulla stima", () => {
  assert.equal(consumoMisurato(stato("15.8", { unit_of_measurement: "kWh/100 km" })), 15.8);
  assert.equal(consumoMisurato(stato("158", { unit_of_measurement: "Wh/km" })), 15.8);
  assert.equal(consumoMisurato(stato("6.25", { unit_of_measurement: "km/kWh" })), 16);
  assert.equal(consumoMisurato(stato("4", { unit_of_measurement: "mi/kWh" })), 15.5);
  assert.equal(consumoMisurato(stato("25.4", { unit_of_measurement: "kWh/100mi" })), 15.8);
  /* Un numero che non sta in piedi, o un'unita' che non e' un consumo, non
   * si inventa: resta la stima. */
  assert.equal(consumoMisurato(stato("2", { unit_of_measurement: "kWh/100 km" })), null);
  assert.equal(consumoMisurato(stato("6", { unit_of_measurement: "L/100 km" })), null);
  assert.equal(consumoMisurato(stato("unknown")), null);
  assert.equal(consumoMisurato(null), null);
  /* La stima resta quella di sempre. */
  assert.equal(consumoStimato({ kwh: 70, carica: 62 }), CONSUMO_DI_SERIE);
});

test("gli stati della ricarica di GdAAuto: chi non carica dal cavo non e' «in carica»", () => {
  for (const detto of ["completata", "in_pausa", "programmata", "rigenerazione", "non_in_carica"])
    assert.equal(codiceDellaRicarica({ stato: detto, collegata: true }), "B", detto);
  assert.equal(codiceDellaRicarica({ stato: "non_in_carica", collegata: false }), "A");
  assert.equal(codiceDellaRicarica({ stato: "in_carica" }), "C");
  assert.equal(codiceDellaRicarica({ stato: "errore" }), "F");
});

test("la pagina, la finestra in Home e gdanav leggono i dati nuovi", async () => {
  const termica = await leggi("src/sections/auto-termica-section.js");
  /* Le caselle entrano nella scheda dopo quelle termiche, dalla tabella. */
  assert.match(termica, /for \(const voce of CASELLE_DELL_AUTO\) aggiungi\(voce\);/);
  assert.match(termica, /const voce = casellaDellAuto\(ref\);/);
  /* La capacita' dell'auto in uso guarda il sensore prima dei settanta. */
  assert.match(termica, /capacitaDalSensore\(\) \?\?/);
  assert.match(termica, /export function datiMarkup/);

  const proposti = await leggi("src/sections/finestre/proposti.js");
  assert.match(proposti, /CASELLE_DELL_AUTO\.map\(\(voce\) => \[voce\.ref, \(\) => senzaParentesi/);
  assert.match(proposti, /esc\(valoreDellaRiga\(riga\)\)/);

  const gdanav = await leggi("src/sections/gdanav-section.js");
  /* Il consumo misurato vince sulla stima, e i dati vanno a gdanav coi nomi
   * del contratto. */
  assert.match(gdanav, /consumo: consumoMedio \?\? consumoStimato\(/);
  for (const nome of [
    "energia_kwh",
    "capacita_kwh",
    "consumo_medio_kwh100",
    "potenza_clima_w",
    "clima_acceso",
    "batteria_in_riscaldamento",
    "temperatura_interna_c",
  ])
    assert.match(gdanav, new RegExp(`\\b${nome}:`), nome);

  /* Una moto non ha un parabrezza da sbrinare ne' un clima. */
  const moto = await leggi("src/sections/auto-o-moto-section.js");
  for (const ref of ["dm.ev_sbrinamento", "dm.ev_clima", "dm.ev_comando_clima"])
    assert.match(moto, new RegExp(`"${ref.replace(/\./g, "\\.")}"`), ref);
});
