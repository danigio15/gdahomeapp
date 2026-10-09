/* Acquari e terrari stanno negli Animali.
 *
 * «Una sezione sola, Animali, dove ogni voce ha il suo tipo: cane, gatto,
 * altro animale, acquario, terrario.» E di vasche ce ne possono essere tante:
 * «ho tre terrari». La sezione Acquario se ne va dal menu, e la sua vasca —
 * `cd_acquario` — si travasa da sola negli Animali, una volta sola, senza
 * perdere niente.
 *
 * Qui si tiene fermo: il travaso, le vasche multiple, i generi e le forcelle
 * del terrario, le pastiglie dei tipi in cima alla pagina, l'elenco delle
 * sezioni senza l'Acquario, e la tessera in Home.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  MASSIMO_ANIMALI,
  SPECIE,
  animaliDisegnabili,
  eUnaVasca,
  normalizzaAnimali,
  travasaLAcquario,
} from "../src/core/animali-model.js";
import {
  FORCELLA_DELL_UMIDITA,
  FORCELLA_DEL_LATO_CALDO,
  FORCELLA_DEL_LATO_FRESCO,
  FORCELLA_IN_CELSIUS,
  comeStaLAcquario,
  acquarioDiCasa,
  forcellaDiSerie,
  genereDelSensore,
  generiDelTipo,
  righeDaImportare,
} from "../src/core/l-acquario-di-casa.js";
import { SEZIONI, CHIAVI_PER_SCHEDA } from "../src/core/lelenco-delle-sezioni.js";

const { corpoDellaVasca, tesseraDellAcquario, vistaDellaVasca } = await import(
  `../src/sections/acquario-section.js?vasche=${Date.now()}`
);
const { filtriPresenti, filtriMarkup } = await import(
  `../src/sections/animali-section.js?vasche=${Date.now()}`
);

const leggi = (percorso) => readFileSync(new URL(percorso, import.meta.url), "utf8");
const piano = (testo) => String(testo).replace(/ /g, " ");

const ADESSO = new Date(2026, 9, 9, 10, 0, 0).getTime();
const GIORNO = 86400000;

const stato = (valore, attributi = {}) => ({
  state: String(valore),
  last_changed: new Date(ADESSO - 10 * 60000).toISOString(),
  attributes: attributi,
});
const gradi = (nome) => ({ device_class: "temperature", unit_of_measurement: "°C", friendly_name: nome });
const umido = (nome) => ({ device_class: "humidity", unit_of_measurement: "%", friendly_name: nome });

const ACQUARIO_DI_PRIMA = Object.freeze({
  vasca: "Vasca tropicale",
  litri: "240",
  ogni: "10",
  cambio: new Date(ADESSO - 3 * GIORNO).toISOString(),
  righe: [
    { entity: "sensor.acquario_temperatura", name: "Temperatura", icon: "thermometer", genere: "temperatura", minimo: "25", massimo: "28" },
    { entity: "binary_sensor.acquario_livello", name: "Livello", icon: "water", genere: "livello" },
    { entity: "switch.acquario_luce", name: "Luci", icon: "lights", genere: "luci" },
  ],
});

/* ── il travaso ───────────────────────────────────────────────────────── */

test("il travaso porta la vasca di cd_acquario negli Animali, senza perdere niente", () => {
  const prima = [{ id: "rex", nome: "Rex", specie: "cane" }];
  const fatto = travasaLAcquario(prima, ACQUARIO_DI_PRIMA);
  assert.ok(fatto);
  assert.equal(fatto.animali.length, 2);
  assert.equal(fatto.animali[0].id, "rex", "gli animali restano dove erano");
  const [, voce] = normalizzaAnimali(fatto.animali);
  assert.equal(voce.id, "acquario");
  assert.equal(voce.specie, "acquario");
  assert.equal(voce.nome, "Vasca tropicale");
  assert.equal(voce.litri, "240");
  assert.equal(voce.ogni, "10");
  assert.equal(voce.cambio, ACQUARIO_DI_PRIMA.cambio);
  assert.equal(voce.origine, "cd_acquario");
  /* Le righe intere: il genere, la forcella scritta a mano, il disegno. */
  assert.deepEqual(voce.righe, ACQUARIO_DI_PRIMA.righe);
  /* Il segno sta in cd_acquario, che resta intero per le plance di prima. */
  assert.equal(fatto.acquario.travasato, true);
  assert.deepEqual(fatto.acquario.righe, ACQUARIO_DI_PRIMA.righe);
  assert.equal(fatto.acquario.vasca, "Vasca tropicale");
});

test("il travaso si fa una volta: col segno non riparte, nemmeno se la voce è stata eliminata", () => {
  const primo = travasaLAcquario([], ACQUARIO_DI_PRIMA);
  assert.equal(travasaLAcquario(primo.animali, primo.acquario), null);
  /* Chi elimina l'acquario dagli Animali non se lo vede tornare. */
  assert.equal(travasaLAcquario([], primo.acquario), null);
  /* Già portato da un altro vetro, ma il segno non è ancora arrivato: non lo
   * si porta due volte, si mette solo il segno. */
  const altrove = travasaLAcquario(primo.animali, ACQUARIO_DI_PRIMA);
  assert.equal(altrove.animali.length, 1);
  assert.equal(altrove.acquario.travasato, true);
});

test("niente da travasare: un acquario vuoto o mai configurato non diventa una voce", () => {
  assert.equal(travasaLAcquario([], {}), null);
  assert.equal(travasaLAcquario([], { righe: [] }), null);
  assert.equal(travasaLAcquario([], null), null);
  /* Col tetto pieno si aspetta, intero, invece di buttare fuori un animale. */
  const pieni = Array.from({ length: MASSIMO_ANIMALI }, (_v, i) => ({ id: `a${i}`, nome: `A${i}` }));
  assert.equal(travasaLAcquario(pieni, ACQUARIO_DI_PRIMA), null);
  /* L'id non si scontra con uno che c'è già. */
  const doppio = travasaLAcquario([{ id: "acquario", nome: "Nemo", specie: "altro" }], ACQUARIO_DI_PRIMA);
  assert.equal(doppio.animali[1].id, "acquario-2");
});

test("la sezione chiama il travaso all'avvio e quando arriva la configurazione", () => {
  const sezione = leggi("../src/sections/acquario-section.js");
  assert.match(sezione, /travasaLAcquario\(\s*readJson\(CHIAVE_ANIMALI, \[\]\),\s*readJson\(CHIAVE_ACQUARIO, \{\}\)/);
  assert.match(sezione, /"dashboardmodern:persistence-restored"\]\)\s*root\.addEventListener\?\.\(evento, \(\) => senzaCadere\(travasaSeServe\)\)/);
});

/* ── tante vasche ─────────────────────────────────────────────────────── */

test("un acquario e tre terrari stanno insieme agli animali, ognuno con le sue righe", () => {
  const elenco = normalizzaAnimali([
    { id: "micio", nome: "Micio", specie: "gatto" },
    { id: "acq", nome: "Vasca", specie: "acquario", righe: [{ entity: "sensor.a", genere: "temperatura" }] },
    { id: "t1", nome: "Pogona", specie: "terrario", righe: [{ entity: "sensor.t1", genere: "umidita" }] },
    { id: "t2", nome: "Gechi", specie: "terrario", righe: [{ entity: "sensor.t2", genere: "temperatura" }] },
    { id: "t3", nome: "Pitone", specie: "terrario", righe: [{ entity: "switch.t3", genere: "nebulizzatore" }], ogni: "30" },
  ]);
  assert.deepEqual(elenco.map((voce) => voce.specie), ["gatto", "acquario", "terrario", "terrario", "terrario"]);
  assert.deepEqual(elenco.filter(eUnaVasca).map((voce) => voce.righe[0].entity), ["sensor.a", "sensor.t1", "sensor.t2", "switch.t3"]);
  assert.equal(elenco[4].ogni, "30");
  /* Il gatto non si porta dietro righe che non ha. */
  assert.equal(elenco[0].righe, undefined);
  /* Una vasca senza nome ma con le sue righe si disegna lo stesso. */
  assert.equal(animaliDisegnabili([{ specie: "terrario", righe: [{ entity: "sensor.x" }] }]).length, 1);
  assert.ok(MASSIMO_ANIMALI >= 24, "con le vasche il tetto di dodici era stretto");
});

test("i tipi sono cinque, nell'ordine della tendina", () => {
  assert.deepEqual(SPECIE.map((voce) => voce.chiave), ["gatto", "cane", "altro", "acquario", "terrario"]);
  assert.equal(SPECIE.find((voce) => voce.chiave === "terrario").disegno, "terrarium");
});

/* ── il terrario ──────────────────────────────────────────────────────── */

test("il terrario ha i suoi generi: umidità, lampada calda, UVB, nebulizzatore", () => {
  const terrario = generiDelTipo("terrario");
  for (const genere of ["temperatura", "temperatura_fresca", "umidita", "lampada", "uvb", "nebulizzatore"])
    assert.ok(terrario.includes(genere), genere);
  assert.ok(!terrario.includes("ph"));
  assert.ok(!terrario.includes("filtro"));
  const acquario = generiDelTipo("acquario");
  assert.ok(!acquario.includes("uvb"));
  assert.ok(!acquario.includes("nebulizzatore"));
  const g = (entity, attributi = {}) => genereDelSensore(entity, { attributes: attributi }, "terrario");
  assert.equal(g("switch.pogona_uvb"), "uvb");
  assert.equal(g("switch.pogona_lampada_calda"), "lampada");
  assert.equal(g("switch.gechi_tappetino"), "lampada");
  assert.equal(g("switch.pitone_nebulizzatore"), "nebulizzatore");
  assert.equal(g("light.pogona_led"), "luci");
  assert.equal(g("sensor.pogona_umidita", { device_class: "humidity", unit_of_measurement: "%" }), "umidita");
  assert.equal(g("sensor.pogona_lato_freddo", { device_class: "temperature" }), "temperatura_fresca");
  assert.equal(g("sensor.pogona_caldo", { device_class: "temperature" }), "temperatura");
});

test("le forcelle di serie dipendono dal tipo", () => {
  assert.deepEqual(forcellaDiSerie("temperatura", "°C", "acquario"), FORCELLA_IN_CELSIUS);
  assert.deepEqual(forcellaDiSerie("temperatura", "°C", "terrario"), FORCELLA_DEL_LATO_CALDO);
  assert.deepEqual(FORCELLA_DEL_LATO_CALDO, { minimo: 28, massimo: 35 });
  assert.deepEqual(forcellaDiSerie("temperatura_fresca", "°C", "terrario"), FORCELLA_DEL_LATO_FRESCO);
  assert.deepEqual(forcellaDiSerie("umidita", "%", "terrario"), FORCELLA_DELL_UMIDITA);
  assert.deepEqual(FORCELLA_DELL_UMIDITA, { minimo: 40, massimo: 80 });
  /* Lo stesso 31 gradi: nel terrario va bene, nell'acquario è una zuppa. */
  const casa = { "sensor.t": stato(31, gradi("Temperatura")) };
  const righe = [{ entity: "sensor.t", genere: "temperatura" }];
  const nel = (specie) =>
    comeStaLAcquario(acquarioDiCasa(casa, { specie, righe }), { config: { specie }, adesso: ADESSO });
  assert.equal(nel("terrario").stato, "bene");
  assert.equal(nel("acquario").stato, "fuori");
});

test("il terrario non ha il cambio d'acqua: la pulizia è facoltativa", () => {
  const casa = { "sensor.u": stato(55, umido("Umidità")) };
  const righe = [{ entity: "sensor.u", genere: "umidita" }];
  const come = (config) =>
    comeStaLAcquario(acquarioDiCasa(casa, { specie: "terrario", righe }), {
      config: { specie: "terrario", ...config },
      adesso: ADESSO,
    });
  /* Senza ritmo e senza data: niente pulizia, e niente ritardo. */
  assert.equal(come({}).cambio, null);
  assert.equal(come({}).stato, "bene");
  /* Con una data e basta: da quanto, ma non scade. */
  const soloData = come({ pulizia: new Date(ADESSO - 90 * GIORNO).toISOString() });
  assert.equal(soloData.cambio.giorni, 90);
  assert.equal(soloData.stato, "bene");
  /* Col ritmo scritto, in ritardo lo dice. */
  const scaduta = come({ ogni: "30", pulizia: new Date(ADESSO - 34 * GIORNO).toISOString() });
  assert.equal(scaduta.stato, "cambio");
  assert.equal(scaduta.cambio.fra, -4);
});

test("la proposta di un terrario non ripropone quello che sta già in un'altra vasca", () => {
  const casa = {
    "sensor.terrario_pogona_umidita": stato(50, umido("Terrario pogona umidità")),
    "switch.terrario_pogona_uvb": stato("on", { friendly_name: "Terrario pogona UVB" }),
    "switch.terrario_gechi_uvb": stato("off", { friendly_name: "Terrario gechi UVB" }),
    "sensor.acquario_ph": stato(7, { friendly_name: "Acquario pH" }),
  };
  const righe = righeDaImportare(casa, {}, undefined, {
    tipo: "terrario",
    esclusi: ["switch.terrario_gechi_uvb"],
  });
  assert.deepEqual(
    righe.map((riga) => [riga.entity, riga.genere]),
    [
      ["sensor.terrario_pogona_umidita", "umidita"],
      ["switch.terrario_pogona_uvb", "uvb"],
    ],
  );
});

/* ── la scheda e la tessera ───────────────────────────────────────────── */

const CASA = {
  "sensor.pogona_caldo": stato(33.4, gradi("Lato caldo")),
  "sensor.pogona_umidita": stato(34, umido("Umidità")),
  "switch.pogona_lampada": stato("on"),
  "switch.pogona_uvb": stato("off"),
  "sensor.gechi_caldo": stato(30.8, gradi("Lato caldo")),
  "sensor.acquario_temperatura": stato(25.6, gradi("Temperatura")),
};

const POGONA = normalizzaAnimali([
  {
    id: "pogona",
    nome: "Pogona",
    specie: "terrario",
    righe: [
      { entity: "sensor.pogona_caldo", name: "Lato caldo", genere: "temperatura" },
      { entity: "sensor.pogona_umidita", name: "Umidità", genere: "umidita" },
      { entity: "switch.pogona_lampada", name: "Lampada calda", genere: "lampada" },
      { entity: "switch.pogona_uvb", name: "UVB", genere: "uvb" },
    ],
  },
])[0];
const GECHI = normalizzaAnimali([
  { id: "gechi", nome: "Gechi", specie: "terrario", righe: [{ entity: "sensor.gechi_caldo", name: "Lato caldo", genere: "temperatura" }] },
])[0];
const VASCA = normalizzaAnimali([
  { id: "acquario", nome: "Vasca tropicale", specie: "acquario", ogni: "14", cambio: new Date(ADESSO - 2 * GIORNO).toISOString(), righe: [{ entity: "sensor.acquario_temperatura", name: "Temperatura", genere: "temperatura" }] },
])[0];

const vista = (voce) => vistaDellaVasca(voce, CASA, { adesso: ADESSO });

test("la scheda del terrario: il clima, le lampade, e niente cambio d'acqua", () => {
  const corpo = piano(corpoDellaVasca(vista(POGONA)));
  assert.match(corpo, /Umidità troppo bassa/);
  assert.match(corpo, /Clima del terrario/);
  assert.match(corpo, /ideale 28 – 35 °C/);
  assert.match(corpo, /ideale 40 – 80 %/);
  assert.match(corpo, /data-dm-pool-tile="heat" data-on="true"[\s\S]*?>accesa</);
  assert.match(corpo, /data-dm-acq-comando="switch\.pogona_uvb"[\s\S]*?>spenta</);
  assert.doesNotMatch(corpo, /Cambio d&#39;acqua/);
  assert.doesNotMatch(corpo, /data-dm-acq-cambio/);
});

test("le pastiglie dei tipi: solo quelli che ci sono, e solo quando sono più d'uno", () => {
  const voci = [{ specie: "cane" }, { specie: "gatto" }, { specie: "terrario" }, { specie: "terrario" }, { specie: "acquario" }];
  assert.deepEqual(filtriPresenti(voci), [
    { filtro: "tutti", quante: 5 },
    { filtro: "cane", quante: 1 },
    { filtro: "gatto", quante: 1 },
    { filtro: "acquario", quante: 1 },
    { filtro: "terrario", quante: 2 },
  ]);
  assert.deepEqual(filtriPresenti([{ specie: "terrario" }, { specie: "terrario" }]), []);
  const markup = filtriMarkup(filtriPresenti(voci), "terrario");
  assert.match(markup, /data-dm-animali-filtro="terrario"\s*aria-pressed="true">Terrari<b>2<\/b>/);
  assert.match(markup, /data-dm-animali-filtro="tutti"\s*aria-pressed="false">Tutti<b>5<\/b>/);
});

test("la tessera in Home: una riga per vasca, e chiede attenzione per chi vuole qualcosa", () => {
  const tessera = tesseraDellAcquario([vista(POGONA), vista(GECHI), vista(VASCA)]);
  assert.equal(tessera.key, "acquario", "la chiave di prima: chi l'aveva spostata la ritrova");
  assert.equal(tessera.label, "Acquari e terrari");
  assert.equal(tessera.value, "3");
  assert.equal(tessera.alert, true);
  assert.equal(tessera.vasche, 3);
  assert.equal(tessera.daGuardare, 1);
  assert.equal(tessera.caption, "Pogona: umidità troppo bassa");
  assert.deepEqual(
    tessera.rows.map((riga) => [riga.name, piano(riga.value), riga.tono]),
    [
      ["Pogona", "Umidità troppo bassa", "allarme"],
      ["Gechi", "30,8°", "quiete"],
      ["Vasca tropicale", "25,6°", "quiete"],
    ],
  );
  /* Solo terrari: si chiama Terrari, e il disegno è il geco. */
  const terrari = tesseraDellAcquario([vista(GECHI), vista(GECHI)]);
  assert.equal(terrari.label, "Terrari");
  assert.equal(terrari.icon, "🦎");
  /* Un terrario solo: la sua temperatura, come la vecchia tessera dell'acquario. */
  const solo = tesseraDellAcquario([vista(GECHI)]);
  assert.equal(solo.label, "Terrario");
  assert.equal(solo.value, "30,8°");
  assert.equal(tesseraDellAcquario([]), null);
});

test("in Home la tessera c'è ancora e porta agli Animali", () => {
  const home = leggi("../src/sections/home-widgets-section.js");
  assert.match(home, /tesseraDellAcquario\(\s*vistaDelleVasche\(states/);
  assert.match(home, /\n  acquario: "animali",/);
  assert.match(home, /widgetExcludedEntities\("animali"\)/);
});

/* ── l'elenco delle sezioni ───────────────────────────────────────────── */

test("l'Acquario non è più una sezione: niente voce, niente scheda, niente pagina", async () => {
  assert.equal(SEZIONI.some((voce) => voce.chiave === "acquario" || voce.scheda === "acquario"), false);
  assert.equal("acquario" in CHIAVI_PER_SCHEDA, false);
  assert.ok(SEZIONI.some((voce) => voce.chiave === "animali"));
  const { famigliaDellaScheda } = await import("../src/core/alberatura-del-config.js");
  assert.equal(famigliaDellaScheda?.("acquario") ?? null, famigliaDellaScheda?.("non-esiste") ?? null);
  const runtime = leggi("../src/sections/section-runtime.js");
  assert.doesNotMatch(runtime, /installAcquarioEditor/);
  assert.doesNotMatch(runtime, /"acquario-editor"/);
  const vasche = leggi("../src/sections/acquario-section.js");
  assert.doesNotMatch(vasche, /ensureAcquarioTab|ACQUARIO_PAGE_ID|"page-acquario"/);
  const testate = leggi("../src/sections/page-masthead-section.js");
  assert.doesNotMatch(testate, /id: "page-acquario"/);
  /* La chiave di configurazione resta: la leggono le plance di prima, ed è lì
   * che sta il segno del travaso. */
  const { CONFIG_KEYS } = await import("../src/sections/config-persistence-section.js");
  assert.ok(CONFIG_KEYS.includes("cd_acquario"));
  assert.ok(CONFIG_KEYS.includes("cd_animali"));
});
