/* La pagina dell'acquario (#127).
 *
 * «Si potrebbe inserire una sezione con l'acquario?»
 *
 * Qui si tiene ferma la parte che si prova senza una casa vera: cosa dice la
 * risposta grande — tutto nella norma, l'acqua troppo calda, da rabboccare, il
 * cambio d'acqua da fare —, che le mattonelle sono quelle della Piscina ma non
 * i suoi comandi, che il cambio d'acqua ha l'anello e il tasto, che la tessera
 * in Home chiede attenzione solo quando c'è da fare, e che la storia del
 * livello passa dal ponte senza un battito che gira.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { acquarioDiCasa, comeStaLAcquario } from "../src/core/l-acquario-di-casa.js";

const {
  cambioInParole,
  paginaDellAcquario,
  prossimoCambioInParole,
  rabboccoInParole,
  tesseraDellAcquario,
  testaDellAcquario,
} = await import(`../src/sections/acquario-section.js?acquario=${Date.now()}`);

const leggi = (percorso) => readFileSync(new URL(percorso, import.meta.url), "utf8");
const sorgente = leggi("../src/sections/acquario-section.js");
const scheda = leggi("../src/sections/acquario-editor-section.js");

/* La pagina mette uno spazio che non va a capo fra il numero e l'unità. */
const piano = (testo) => String(testo).replace(/ /g, " ");

const ADESSO = new Date(2026, 8, 28, 10, 0, 0).getTime();
const GIORNO = 24 * 3600000;

const stato = (valore, attributi = {}) => ({
  state: String(valore),
  last_changed: new Date(ADESSO - 10 * 60000).toISOString(),
  attributes: attributi,
});

const CASA = {
  "sensor.acquario_temperatura": stato(25.6, {
    device_class: "temperature",
    unit_of_measurement: "°C",
  }),
  "sensor.acquario_ph": stato(7.2),
  "binary_sensor.acquario_livello": stato("off", { device_class: "problem" }),
  "switch.acquario_luce": stato("on"),
  "switch.acquario_pompa": stato("on"),
  "switch.acquario_riscaldatore": stato("off"),
};

const RIGHE = [
  { entity: "sensor.acquario_temperatura", name: "Temperatura", genere: "temperatura" },
  { entity: "sensor.acquario_ph", name: "pH", genere: "ph" },
  { entity: "binary_sensor.acquario_livello", name: "Livello", genere: "livello" },
  { entity: "switch.acquario_luce", name: "Luci", genere: "luci" },
  { entity: "switch.acquario_pompa", name: "Filtro", genere: "filtro" },
  { entity: "switch.acquario_riscaldatore", name: "Riscaldatore", genere: "riscaldatore" },
];

const vista = (stati = CASA, altro = {}) => {
  const config = {
    vasca: "Vasca tropicale",
    litri: "240",
    cambio: new Date(ADESSO - 11 * GIORNO).toISOString(),
    righe: RIGHE,
    ...altro,
  };
  const letture = acquarioDiCasa(stati, config);
  return { letture, adesso: ADESSO, come: comeStaLAcquario(letture, { config, adesso: ADESSO }) };
};

test("tutto nella norma: la vasca, i litri e da quanto è stata cambiata l'acqua", () => {
  const casa = vista();
  const testa = testaDellAcquario(casa.come);
  assert.equal(testa.stato, "bene");
  assert.equal(testa.grande, "Tutto nella norma");
  assert.equal(piano(testa.nomi), "Vasca tropicale · 240 L");
  assert.equal(testa.sotto, "Cambio d'acqua 11 giorni fa");
  const pagina = piano(paginaDellAcquario(casa));
  /* Le mattonelle della Piscina: la luce gialla, il filtro azzurro, il
   * riscaldatore spento. */
  assert.match(pagina, /class="dm-pool-tiles"/);
  assert.match(pagina, /data-dm-pool-tile="light" data-on="true"[\s\S]*?>accese</);
  assert.match(pagina, /data-dm-pool-tile="pump" data-on="true"[\s\S]*?>acceso</);
  assert.match(pagina, /data-dm-pool-tile="heat" data-on="false"[\s\S]*?>spento</);
  /* La qualità dell'acqua con la forcella della Piscina. */
  assert.match(pagina, /Qualità acqua/);
  assert.match(
    pagina,
    /class="dm-gauge" data-dm-gauge="acq-sensor-acquario-temperatura" data-verdict="ok"/,
  );
  assert.match(pagina, /ideale 24 – 27 °C/);
  assert.match(pagina, /ideale 6,5 – 7,5/);
  /* Il galleggiante a posto, come una riga delle Batterie. */
  assert.match(pagina, /class="dm-acq-livello" data-stato="bene"/);
  /* Il cambio d'acqua con l'anello e il tasto. */
  assert.match(pagina, /class="dm-ring" style="--pct:79"/);
  assert.match(pagina, /<b>11<\/b><i>\/ 14<\/i>/);
  /* Nella pagina l'apostrofo è scritto come entità, come ogni testo. */
  assert.match(pagina, /Cambio d&#39;acqua 11 giorni fa · il prossimo fra 3 giorni/);
  assert.match(pagina, /data-dm-acq-cambio>✓ Fatto oggi</);
  assert.match(pagina, /ogni 14 giorni/);
});

test("l'acqua troppo calda viene prima di tutto, con la sua forcella sotto", () => {
  const caldo = {
    ...CASA,
    "sensor.acquario_temperatura": stato(29.1, {
      device_class: "temperature",
      unit_of_measurement: "°C",
    }),
  };
  const testa = testaDellAcquario(vista(caldo, { ogni: "7" }).come);
  assert.equal(testa.stato, "fuori");
  assert.equal(testa.grande, "Acqua troppo calda");
  assert.equal(piano(testa.nomi), "Temperatura · 29,1 °C");
  assert.equal(piano(testa.sotto), "ideale 24 – 27 °C");
  assert.match(paginaDellAcquario(vista(caldo)), /data-verdict="high"/);
  /* Due misure fuori: si contano, e si dicono i nomi. */
  const due = testaDellAcquario(vista({ ...caldo, "sensor.acquario_ph": stato(8.3) }).come);
  assert.equal(due.grande, "2 valori fuori norma");
  assert.equal(due.nomi, "Temperatura · pH");
});

test("il galleggiante basso chiede il rabbocco, e il cambio in ritardo si conta", () => {
  const basso = {
    ...CASA,
    "binary_sensor.acquario_livello": stato("on", { device_class: "problem" }),
  };
  const livello = testaDellAcquario(vista(basso).come);
  assert.equal(livello.stato, "livello");
  assert.equal(livello.grande, "Da rabboccare");
  assert.equal(livello.nomi, "Livello");
  assert.match(paginaDellAcquario(vista(basso)), /data-stato="basso"[\s\S]*?da rabboccare/);

  const vecchio = vista(CASA, { cambio: new Date(ADESSO - 16 * GIORNO).toISOString() });
  const cambio = testaDellAcquario(vecchio.come);
  assert.equal(cambio.stato, "cambio");
  assert.equal(cambio.grande, "Cambio d'acqua da fare");
  assert.equal(cambio.nomi, "Vasca tropicale · Cambio d'acqua 16 giorni fa");
  assert.equal(cambio.sotto, "in ritardo di 2 giorni");
  assert.match(
    paginaDellAcquario(vecchio),
    /class="dm-pool-card dm-acq-cambio" data-stato="scaduto"/,
  );
  /* Senza una data segnata non si sa niente, e lo si dice. */
  const mai = paginaDellAcquario(vista(CASA, { cambio: "" }));
  assert.match(mai, /Non è ancora segnato/);
  assert.match(mai, /<b>—<\/b>/);
});

test("i giorni si dicono al singolare, e mai «fra 0 giorni»", () => {
  const cambio = (giorni, fra) => ({ giorni, fra });
  assert.equal(cambioInParole(cambio(0, 14)), "Cambio d'acqua fatto oggi");
  assert.equal(cambioInParole(cambio(1, 13)), "Cambio d'acqua fatto ieri");
  assert.equal(cambioInParole(cambio(null, null)), "");
  assert.equal(prossimoCambioInParole(cambio(13, 1)), "il prossimo domani");
  assert.equal(prossimoCambioInParole(cambio(14, 0)), "da fare oggi");
  assert.equal(prossimoCambioInParole(cambio(15, -1)), "in ritardo di un giorno");
  assert.equal(rabboccoInParole(0), "rabbocco a breve");
  assert.equal(rabboccoInParole(1), "rabbocco domani");
  assert.equal(rabboccoInParole(5), "rabbocco fra 5 giorni");
});

test("la tessera in Home dice la temperatura, e chiede attenzione solo quando c'è da fare", () => {
  const bene = tesseraDellAcquario(vista());
  assert.equal(bene.key, "acquario");
  assert.equal(bene.value, "25,6°");
  assert.equal(bene.caption, "Tutto nella norma · Cambio d'acqua 11 giorni fa");
  assert.equal(bene.alert, false);
  assert.equal(bene.accent, "#0ea5e9");
  const vecchio = tesseraDellAcquario(
    vista(CASA, { cambio: new Date(ADESSO - 16 * GIORNO).toISOString() }),
  );
  assert.equal(vecchio.alert, true);
  assert.equal(vecchio.attiva, true);
  assert.equal(vecchio.accent, "#f59e0b");
  assert.equal(
    vecchio.caption,
    "Cambio d'acqua da fare · Vasca tropicale · Cambio d'acqua 16 giorni fa",
  );
  assert.deepEqual(
    bene.rows.map((riga) => [riga.name, piano(riga.value)]),
    [
      ["Temperatura", "25,6 °C"],
      ["pH", "7,2"],
      ["Livello", "nella norma"],
      ["Luci", "accese"],
      ["Filtro", "acceso"],
      ["Riscaldatore", "spento"],
    ],
  );
  assert.equal(tesseraDellAcquario(null), null);
});

test("i comandi non sono quelli della piscina, e il lucchetto vale anche qui", () => {
  /* `data-act` è della piscina: un tocco qui la comanderebbe. */
  assert.doesNotMatch(sorgente, /data-act=/);
  assert.match(sorgente, /data-dm-acq-comando="\$\{esc\(lettura\.entity\)\}"/);
  assert.match(sorgente, /if \(!entity \|\| !siComanda\(entity\)\) return false;/);
  assert.match(sorgente, /service: lettura\.acceso \? "turn_off" : "turn_on"/);
});

test("la storia del livello passa dal ponte, e non c'è un battito che gira", () => {
  assert.doesNotMatch(sorgente, /recorder\/statistic_during_period/);
  assert.match(sorgente, /chiediAHomeAssistant\(domanda, ATTESA_MS\)/);
  assert.doesNotMatch(sorgente, /setInterval/);
  assert.match(sorgente, /root\.setTimeout\?\.\(\(\) => \{\s*state\.sveglia = 0;/);
  assert.match(sorgente, /if \(serveLeggere\(\)\) \{\s*aggiornaIDati\(\);/);
  assert.match(sorgente, /\.dm-tile\[data-dm-widget="\$\{ACQUARIO_TAB\}"\]/);
  /* Solo i livelli con una soglia hanno bisogno della storia, e prima degli
   * stati non si chiede niente. */
  assert.match(sorgente, /const livelli = livelliDaSeguire\(letture\);/);
  assert.match(sorgente, /letture\.every\(\(lettura\) => lettura\.muto\)/);
});

test("la scheda nel Config: la vasca in cima, e in ogni riga cosa è", () => {
  assert.match(scheda, /costruisciSchedaDichiarata\(\{/);
  assert.match(scheda, /inTesta: vascaMarkup,/);
  assert.match(scheda, /data-dm-acq-genere="\$\{indice\}"/);
  assert.match(
    scheda,
    /campoDellaVasca\(\s*"cambio",\s*t\("Ultimo cambio d'acqua", "Last water change"\)/,
  );
  assert.match(scheda, /tipo: "date"/);
  /* Il galleggiante non ha una soglia da scrivere. */
  assert.match(
    scheda,
    /genere === "livello" && !clean\(riga\?\.entity\)\.startsWith\("binary_sensor\."\)/,
  );
});
