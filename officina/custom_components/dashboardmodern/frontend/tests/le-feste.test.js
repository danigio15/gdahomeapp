/* Le feste: la finestra, l'anno che arriva e le luci di Natale.
 *
 * La finestra e' la regola che conta di piu': tutto quello che e' festivo — la
 * neve, la ghirlanda, la scena sul tablet, il conto alla rovescia, le luci che
 * si accendono da sole — c'e' dall'8 dicembre a mezzanotte fino all'ultimo
 * secondo del 6 gennaio, e fuori non c'e' traccia. Un millisecondo sbagliato
 * sul bordo vuol dire una casa vestita a festa il 7 gennaio, o una Vigilia
 * spenta.
 *
 * Le date si costruiscono in ora locale, come le legge la plancia: le prove
 * valgono in qualunque fuso giri chi le lancia.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  CHIAVE_FESTE,
  LUCI_AL_MASSIMO,
  PAZIENZA_DOPO_L_ACCENSIONE,
  annoNuovo,
  chiamateDelleLuci,
  contoAllaRovescia,
  decidiLeLuci,
  eCapodanno,
  festePulite,
  finestraDelleFeste,
  giornoConUnNome,
  iconaDellaLuce,
  inFesta,
  intervalloDelGiorno,
  intervalloDiAdesso,
  luciAccese,
  luciDaProporre,
  memoriaPulita,
  momentoDelMuro,
  oraPulita,
  tramontoDelGiorno,
} from "../src/core/feste.js";
import { CONFIG_KEYS } from "../src/core/chiavi-di-configurazione.js";

const d = (anno, mese, giorno, ore = 0, minuti = 0, secondi = 0, ms = 0) =>
  new Date(anno, mese - 1, giorno, ore, minuti, secondi, ms);

/* ── la finestra ────────────────────────────────────────────────────────── */

test("la finestra: dall'8 dicembre a mezzanotte al 6 gennaio compreso", () => {
  assert.equal(inFesta(d(2026, 12, 7, 23, 59)), false);
  assert.equal(inFesta(d(2026, 12, 7, 23, 59, 59, 999)), false);
  assert.equal(inFesta(d(2026, 12, 8, 0, 0)), true);
  assert.equal(inFesta(d(2027, 1, 6, 23, 59)), true);
  assert.equal(inFesta(d(2027, 1, 6, 23, 59, 59, 999)), true);
  assert.equal(inFesta(d(2027, 1, 7, 0, 0)), false);
});

test("la finestra a cavallo d'anno e' una sola", () => {
  for (const giorno of [
    d(2026, 12, 8),
    d(2026, 12, 31, 23, 59),
    d(2027, 1, 1),
    d(2027, 1, 6, 12),
  ]) {
    const f = finestraDelleFeste(giorno);
    assert.ok(f, String(giorno));
    assert.equal(f.inizio.getTime(), d(2026, 12, 8).getTime());
    assert.equal(f.fine.getTime(), d(2027, 1, 7).getTime());
  }
  assert.equal(finestraDelleFeste(d(2026, 11, 22)), null);
  assert.equal(finestraDelleFeste(d(2026, 7, 15)), null);
  assert.equal(finestraDelleFeste(d(2027, 2, 1)), null);
});

test("la finestra in un anno bisestile e in un anno qualunque, senza anni scritti", () => {
  /* Il 2028 e' bisestile: il febbraio lungo non sposta niente, ma la prova
   * c'e' perche' chi conta i giorni dall'inizio dell'anno ci cascherebbe. */
  assert.equal(inFesta(d(2028, 2, 29)), false);
  assert.equal(inFesta(d(2028, 12, 7, 23, 59)), false);
  assert.equal(inFesta(d(2028, 12, 8)), true);
  assert.equal(inFesta(d(2029, 1, 6, 23, 59)), true);
  assert.equal(inFesta(d(2029, 1, 7)), false);
  assert.equal(inFesta(d(2041, 12, 24, 21, 47)), true);
  assert.equal(inFesta(d(2041, 1, 7)), false);
});

test("l'anno nuovo: il 31 dicembre e' quello dopo, dall'1 al 6 gennaio quello in corso", () => {
  assert.equal(annoNuovo(d(2026, 12, 31, 23, 59, 59)), 2027);
  assert.equal(annoNuovo(d(2026, 12, 8)), 2027);
  assert.equal(annoNuovo(d(2027, 1, 1)), 2027);
  assert.equal(annoNuovo(d(2027, 1, 6, 23)), 2027);
  assert.equal(annoNuovo(d(2028, 12, 31)), 2029);
});

test("niente anni scritti nel codice delle feste", () => {
  const sorgente = readFileSync(new URL("../src/core/feste.js", import.meta.url), "utf8");
  const codice = sorgente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(codice, /\b20\d\d\b/);
});

/* ── il conto alla rovescia e il tablet ─────────────────────────────────── */

test("il conto alla rovescia nella testata: dal 26 dicembre alla mezzanotte", () => {
  assert.equal(contoAllaRovescia(d(2026, 12, 25, 23, 59)), null);
  const conto = contoAllaRovescia(d(2026, 12, 27, 18, 43));
  assert.deepEqual(
    { anno: conto.anno, giorni: conto.giorni, ore: conto.ore, minuti: conto.minuti },
    { anno: 2027, giorni: 4, ore: 5, minuti: 17 },
  );
  const ultimo = contoAllaRovescia(d(2026, 12, 31, 23, 59, 50));
  assert.equal(ultimo.giorni, 0);
  assert.equal(ultimo.minuti, 0);
  assert.equal(ultimo.secondi, 10);
  assert.equal(contoAllaRovescia(d(2027, 1, 1, 0, 0)), null);
});

test("il tablet: la Vigilia, il conto dalle 23, i fuochi per dieci minuti", () => {
  assert.equal(momentoDelMuro(d(2026, 12, 7, 21)), null);
  assert.equal(momentoDelMuro(d(2026, 12, 24, 21, 47)), "vigilia");
  assert.equal(momentoDelMuro(d(2026, 12, 31, 22, 59, 59)), "vigilia");
  assert.equal(momentoDelMuro(d(2026, 12, 31, 23, 0)), "conto");
  assert.equal(momentoDelMuro(d(2026, 12, 31, 23, 59, 59, 999)), "conto");
  assert.equal(momentoDelMuro(d(2027, 1, 1, 0, 0)), "fuochi");
  assert.equal(momentoDelMuro(d(2027, 1, 1, 0, 9, 59)), "fuochi");
  assert.equal(momentoDelMuro(d(2027, 1, 1, 0, 10)), "vigilia");
  assert.equal(momentoDelMuro(d(2027, 1, 7, 0, 0)), null);
});

test("il primo dell'anno e i giorni con un nome", () => {
  assert.equal(eCapodanno(d(2027, 1, 1, 15)), true);
  assert.equal(eCapodanno(d(2027, 1, 2)), false);
  assert.equal(giornoConUnNome(d(2026, 12, 24, 21)), "vigilia");
  assert.equal(giornoConUnNome(d(2026, 12, 25)), "natale");
  assert.equal(giornoConUnNome(d(2027, 1, 6)), "epifania");
  assert.equal(giornoConUnNome(d(2026, 12, 20)), "");
});

/* ── la configurazione ──────────────────────────────────────────────────── */

test("la chiave viaggia con la configurazione", () => {
  assert.equal(CHIAVE_FESTE, "cd_feste");
  assert.ok(CONFIG_KEYS.includes("cd_feste"));
});

test("la configurazione ripulita: valori di serie, entita' buone, otto al massimo", () => {
  const vuota = festePulite(null);
  assert.deepEqual(vuota, {
    luci: [],
    accendi: { tipo: "tramonto", ora: "17:00", scarto: 0 },
    spegni: { ora: "23:30" },
    giorni: [0, 1, 2, 3, 4, 5, 6],
  });
  const luci = Array.from({ length: 12 }, (_, i) => ({ entity: `switch.presa_${i}` }));
  const piena = festePulite(
    JSON.stringify({
      luci: [
        { entity: "switch.presa_albero", nome: " Albero ", icona: "🎄" },
        { entity: "switch.presa_albero" },
        { entity: "sensor.temperatura" },
        "light.presepe",
        ...luci,
      ],
      accendi: { tipo: "ora", ora: "7:5", scarto: 999 },
      spegni: { ora: "25:00" },
      giorni: [5, 6, 6, 9, "0"],
      attive: "spento",
    }),
  );
  assert.equal(piena.luci.length, LUCI_AL_MASSIMO);
  assert.deepEqual(piena.luci[0], { entity: "switch.presa_albero", nome: "Albero", icona: "🎄" });
  assert.deepEqual(piena.luci[1], { entity: "light.presepe" });
  assert.deepEqual(piena.accendi, { tipo: "ora", ora: "07:05", scarto: 120 });
  assert.deepEqual(piena.spegni, { ora: "23:30" });
  assert.deepEqual(piena.giorni, [0, 5, 6]);
  assert.equal("attive" in piena, false);
  assert.equal(oraPulita("24:00"), "");
});

test("le luci proposte: quelle di casa che sembrano di Natale", () => {
  const stati = {
    "switch.presa_albero": { attributes: { friendly_name: "Presa albero" } },
    "light.presepe": { attributes: { friendly_name: "Presepe" } },
    "light.vetrina": { attributes: { friendly_name: "Vetrina natalizia" } },
    "light.stella": { attributes: { friendly_name: "Stella cometa" } },
    "input_boolean.xmas_mode": { attributes: { friendly_name: "Modo" } },
    "light.salone": { attributes: { friendly_name: "Salone" } },
    "sensor.albero_temperatura": { attributes: { friendly_name: "Albero" } },
  };
  const config = festePulite({ luci: [{ entity: "light.presepe" }] });
  assert.deepEqual(
    luciDaProporre(stati, config).map((l) => l.entity),
    ["input_boolean.xmas_mode", "switch.presa_albero", "light.stella", "light.vetrina"],
  );
  assert.equal(iconaDellaLuce({ entity: "switch.presa_albero" }), "🎄");
  assert.equal(iconaDellaLuce({ entity: "light.presepe" }), "⭐");
  assert.equal(iconaDellaLuce({ entity: "light.x", icona: "🔔" }), "🔔");
  assert.equal(iconaDellaLuce({ entity: "light.balcone" }), "✨");
});

/* ── gli orari ──────────────────────────────────────────────────────────── */

const ALBERO = festePulite({
  luci: [{ entity: "switch.presa_albero" }, { entity: "light.presepe" }],
});

test("il tramonto di oggi anche quando sun.sun dice gia' quello di domani", () => {
  const domani = d(2026, 12, 21, 16, 43).toISOString();
  assert.equal(tramontoDelGiorno(d(2026, 12, 20), domani), d(2026, 12, 20, 16, 43).getTime());
  assert.equal(tramontoDelGiorno(d(2026, 12, 20), null), null);
  assert.equal(tramontoDelGiorno(d(2026, 12, 20), "boh"), null);
});

test("l'intervallo: al tramonto con lo scarto, spente all'ora; dopo mezzanotte il giorno dopo", () => {
  const tramonto = d(2026, 12, 20, 16, 42).toISOString();
  const conScarto = festePulite({ ...ALBERO, accendi: { tipo: "tramonto", scarto: 15 } });
  const i = intervalloDelGiorno(conScarto, d(2026, 12, 20), tramonto);
  assert.equal(i.inizio, d(2026, 12, 20, 16, 57).getTime());
  assert.equal(i.fine, d(2026, 12, 20, 23, 30).getTime());
  const tardi = festePulite({
    ...ALBERO,
    accendi: { tipo: "ora", ora: "18:00" },
    spegni: { ora: "01:00" },
  });
  const n = intervalloDelGiorno(tardi, d(2026, 12, 20));
  assert.equal(n.fine, d(2026, 12, 21, 1, 0).getTime());
  assert.equal(intervalloDiAdesso(tardi, d(2026, 12, 21, 0, 30).getTime()).giorno, "2026-12-20");
  /* Senza sun.sun, l'ora scritta. */
  assert.equal(
    intervalloDelGiorno(ALBERO, d(2026, 12, 20), null).inizio,
    d(2026, 12, 20, 17).getTime(),
  );
});

test("l'intervallo solo nei giorni scelti e solo nelle feste, e non oltre il 6 gennaio", () => {
  const weekend = festePulite({ ...ALBERO, giorni: [0, 6] });
  assert.equal(intervalloDelGiorno(weekend, d(2026, 12, 18)), null); // venerdi'
  assert.ok(intervalloDelGiorno(weekend, d(2026, 12, 19))); // sabato
  assert.equal(intervalloDelGiorno(ALBERO, d(2026, 12, 7)), null);
  assert.ok(intervalloDelGiorno(ALBERO, d(2026, 12, 8)));
  assert.equal(intervalloDelGiorno(ALBERO, d(2027, 1, 7)), null);
  const tardi = festePulite({ ...ALBERO, spegni: { ora: "02:00" } });
  assert.equal(intervalloDelGiorno(tardi, d(2027, 1, 6)).fine, d(2027, 1, 7).getTime());
});

/* ── cosa fare ──────────────────────────────────────────────────────────── */

/* Un orologio finto: la memoria passa da un battito all'altro come nel ponte. */
function giornata(config, passi, { tramonto = null } = {}) {
  let memoria = {};
  return passi.map(([quando, accese = null]) => {
    const r = decidiLeLuci({ config, adesso: quando.getTime(), tramonto, accese, memoria });
    memoria = r.memoria;
    return r.azione;
  });
}

test("al tramonto si accendono, all'ora si spengono, una volta sola", () => {
  const tramonto = d(2026, 12, 20, 16, 42).toISOString();
  assert.deepEqual(
    giornata(
      ALBERO,
      [
        [d(2026, 12, 20, 16, 41), false],
        [d(2026, 12, 20, 16, 42), false],
        [d(2026, 12, 20, 16, 42, 30), false],
        [d(2026, 12, 20, 18), true],
        [d(2026, 12, 20, 23, 29, 59), true],
        [d(2026, 12, 20, 23, 30), true],
        [d(2026, 12, 20, 23, 30, 30), false],
        [d(2026, 12, 20, 23, 45), true],
      ],
      { tramonto },
    ),
    [null, "accendi", null, null, null, "spegni", null, null],
  );
});

test("l'intervallo aperto non si sposta quando sun.sun passa al tramonto di domani", () => {
  const oggi = d(2026, 12, 20, 16, 42).toISOString();
  const domani = d(2026, 12, 21, 16, 44).toISOString();
  let r = decidiLeLuci({
    config: ALBERO,
    adesso: d(2026, 12, 20, 16, 42, 10).getTime(),
    tramonto: oggi,
    accese: false,
  });
  assert.equal(r.azione, "accendi");
  r = decidiLeLuci({
    config: ALBERO,
    adesso: d(2026, 12, 20, 16, 43).getTime(),
    tramonto: domani,
    accese: true,
    memoria: r.memoria,
  });
  assert.equal(r.azione, null);
  assert.equal(r.memoria.stato, "acceso");
});

test("non combatte chi le spegne a mano: restano spente fino all'intervallo dopo", () => {
  const passi = [
    [d(2026, 12, 20, 17), false],
    [d(2026, 12, 20, 17, 0, 30), false],
    [d(2026, 12, 20, 17, 1), true],
    [d(2026, 12, 20, 20), false],
    [d(2026, 12, 20, 20, 0, 30), false],
    [d(2026, 12, 20, 22), false],
    [d(2026, 12, 20, 23, 30), false],
    [d(2026, 12, 21, 17), false],
  ];
  assert.deepEqual(giornata(ALBERO, passi), [
    "accendi",
    null,
    null,
    null,
    null,
    null,
    null,
    "accendi",
  ]);
  /* Spente subito dopo l'accensione: Home Assistant non l'ha ancora detto,
   * e non e' la mano di nessuno. */
  const subito = decidiLeLuci({
    config: ALBERO,
    adesso: d(2026, 12, 20, 17, 0, 30).getTime(),
    accese: false,
    memoria: {
      giorno: "2026-12-20",
      inizio: d(2026, 12, 20, 17).getTime(),
      stato: "acceso",
      accesoIl: d(2026, 12, 20, 17).getTime(),
    },
  });
  assert.equal(subito.memoria.stato, "acceso");
  assert.ok(PAZIENZA_DOPO_L_ACCENSIONE > 30_000);
});

test("niente fuori dalle feste: nessuna accensione dal 7 gennaio al 7 dicembre", () => {
  for (const giorno of [
    d(2026, 12, 7, 17, 30),
    d(2027, 1, 7, 18),
    d(2027, 3, 3, 18),
    d(2026, 11, 22, 20),
  ]) {
    const r = decidiLeLuci({ config: ALBERO, adesso: giorno.getTime(), accese: false });
    assert.equal(r.azione, null, String(giorno));
    assert.deepEqual(r.memoria, {});
  }
  assert.deepEqual(giornata(ALBERO, [[d(2026, 12, 8, 17)]]), ["accendi"]);
});

test("il 6 gennaio si spengono con la fine delle feste, e il 7 non si riaccendono", () => {
  const tardi = festePulite({ ...ALBERO, spegni: { ora: "01:00" } });
  assert.deepEqual(
    giornata(tardi, [
      [d(2027, 1, 6, 17), false],
      [d(2027, 1, 6, 23, 59, 30), true],
      [d(2027, 1, 7, 0, 0, 10), true],
      [d(2027, 1, 7, 0, 30), true],
      [d(2027, 1, 7, 17), false],
    ]),
    ["accendi", null, "spegni", null, null],
  );
});

test("un intervallo dimenticato da giorni si chiude senza spegnere", () => {
  const r = decidiLeLuci({
    config: ALBERO,
    adesso: d(2026, 12, 23, 10).getTime(),
    accese: true,
    memoria: { giorno: "2026-12-20", inizio: d(2026, 12, 20, 17).getTime(), stato: "acceso" },
  });
  assert.equal(r.azione, null);
  assert.equal(r.memoria.stato, "chiuso");
});

test("senza luci non si fa niente, e la memoria si ripulisce", () => {
  const r = decidiLeLuci({ config: festePulite({}), adesso: d(2026, 12, 20, 18).getTime() });
  assert.equal(r.azione, null);
  assert.deepEqual(memoriaPulita({ giorno: "x", inizio: 1, stato: "acceso" }), {});
});

test("le chiamate: una per dominio, e quante sono accese", () => {
  assert.deepEqual(chiamateDelleLuci(ALBERO, true), [
    { domain: "switch", service: "turn_on", data: { entity_id: ["switch.presa_albero"] } },
    { domain: "light", service: "turn_on", data: { entity_id: ["light.presepe"] } },
  ]);
  assert.equal(chiamateDelleLuci(ALBERO, false)[0].service, "turn_off");
  const stati = {
    "switch.presa_albero": { state: "on" },
    "light.presepe": { state: "unavailable" },
  };
  assert.deepEqual(
    luciAccese(ALBERO, (id) => stati[id]),
    { accese: 1, note: 1, totale: 2 },
  );
});
