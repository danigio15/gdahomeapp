/* La pagina dell'acqua e del gas (#115, #135, #137).
 *
 * «Manca una sezione per monitorare portata e pressione dell'impianto idrico
 * di casa, magari anche una sezione per l'addolcitore per vedere il livello
 * del sale.» «Si potrebbero mettere sezioni come consumi e contatore acqua e
 * energia gas.» «Potresti creare una sezione consumo gas.»
 *
 * Qui si tiene ferma la parte che si prova senza una casa vera: cosa dice la
 * risposta grande nei quattro casi — tutto bene, solo gas, pressione fuori
 * forcella, perdita — che la pagina in allarme diventa il semaforo dei Varchi,
 * che la tessera in Home dice il guaio con le stesse parole, e che le domande
 * al Recorder passano dal ponte senza un battito che gira.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { comeStannoIContatori, letturaDelContatore } from "../src/core/contatori-di-casa.js";

const { paginaDeiContatori, tesseraDeiContatori, testaDeiContatori } = await import(
  `../src/sections/contatori-section.js?acqua=${Date.now()}`
);

const leggi = (percorso) => readFileSync(new URL(percorso, import.meta.url), "utf8");
const sorgente = leggi("../src/sections/contatori-section.js");
const scheda = leggi("../src/sections/contatori-editor-section.js");

const ADESSO = new Date(2026, 8, 28, 10, 0, 0).getTime();
const H = 3600000;

const sensore = (valore, unita, attributi = {}) => ({
  state: String(valore),
  last_changed: new Date(ADESSO - 10 * 60000).toISOString(),
  attributes: { unit_of_measurement: unita, ...attributi },
});

const ACQUA = letturaDelContatore(
  { entity: "sensor.contatore_acqua", name: "Contatore acqua", genere: "acqua", prezzo: "1,9" },
  sensore(128.4, "m³"),
);
const GAS = letturaDelContatore(
  { entity: "sensor.contatore_gas", name: "Contatore gas", genere: "gas", prezzo: "0,924" },
  sensore(5210, "m³", { device_class: "gas" }),
);
const PRESSIONE = (bar) =>
  letturaDelContatore(
    { entity: "sensor.acqua_pressione", name: "Pressione", genere: "pressione" },
    sensore(bar, "bar"),
  );
const PORTATA = (valore) =>
  letturaDelContatore(
    { entity: "sensor.acqua_portata", name: "Portata", genere: "portata" },
    sensore(valore, "L/min"),
  );
const SALE = letturaDelContatore(
  { entity: "sensor.addolcitore_sale", name: "Sale addolcitore", genere: "sale" },
  sensore(18, "d"),
);

const CONSUMI = {
  "sensor.contatore_acqua": { oggi: 0.214, ieri: 0.268, mese: 6.2, meseScorso: 11.8 },
  "sensor.contatore_gas": { oggi: 3.4, ieri: 4.1, mese: 74, meseScorso: 118 },
};

const vista = (letture, dati, qualcunoInCasa = null) => ({
  letture,
  adesso: ADESSO,
  come: comeStannoIContatori(letture, dati, { adesso: ADESSO, qualcunoInCasa }),
});

const STORIA_DELLA_PERDITA = {
  "sensor.acqua_portata": {
    da: ADESSO - 24 * H,
    righe: [
      { stato: "0", quando: ADESSO - 24 * H },
      { stato: "6", quando: ADESSO - 3.2 * H },
    ],
  },
};

test("tutto bene: la risposta grande è l'acqua di oggi, e il gas sta accanto", () => {
  const casa = vista([ACQUA, GAS, PRESSIONE(2.8), PORTATA(0), SALE], {
    consumi: CONSUMI,
    portata: {
      "sensor.acqua_portata": {
        da: ADESSO - 24 * H,
        righe: [{ stato: "0", quando: ADESSO - 24 * H }],
      },
    },
  });
  const testa = testaDeiContatori(casa.come, ADESSO);
  assert.equal(testa.stato, "bene");
  assert.equal(testa.grande, "214 litri oggi");
  assert.equal(testa.nomi, "Acqua · 3,4 m³ di gas");
  assert.equal(testa.sotto, "Ieri 268 L");
  const pagina = paginaDeiContatori(casa);
  /* Le schede, coi pezzi delle altre pagine: la forcella della Piscina, le
   * righe delle Batterie. Il semaforo no: non c'è niente da chiudere. */
  assert.match(pagina, /class="dm-cont-schede"/);
  assert.match(pagina, /class="dm-gauge" data-dm-gauge="pressione" data-verdict="ok"/);
  assert.match(pagina, /Questo mese/);
  assert.match(pagina, /Il mese scorso 11,8 m³/);
  assert.match(pagina, /18 giorni/);
  assert.doesNotMatch(pagina, /dm-cont-elenco/);
});

test("solo il gas: la risposta grande sono i metri cubi, e i kilowattora accanto", () => {
  const casa = vista([GAS], { consumi: CONSUMI });
  const testa = testaDeiContatori(casa.come, ADESSO);
  assert.equal(testa.grande, "3,4 m³ oggi");
  assert.match(testa.nomi, /^Gas · 36,4 kWh$/);
  assert.match(paginaDeiContatori(casa), /data-dm-cont-scheda="gas"/);
});

test("prima dei numeri del Recorder si aspetta, e si dice «—»", () => {
  const casa = vista([ACQUA], {});
  const testa = testaDeiContatori(casa.come, ADESSO);
  assert.equal(testa.stato, "attesa");
  assert.equal(testa.grande, "—");
});

test("la pressione fuori forcella colora la pagina, e la pagina diventa il semaforo", () => {
  const casa = vista([ACQUA, PRESSIONE(1.2)], { consumi: CONSUMI });
  const testa = testaDeiContatori(casa.come, ADESSO);
  assert.equal(testa.stato, "pressione");
  assert.equal(testa.grande, "Pressione bassa");
  assert.equal(testa.nomi, "Acqua · 1,2 bar");
  const pagina = paginaDeiContatori(casa);
  assert.match(pagina, /class="dm-cont-elenco"/);
  assert.match(pagina, /class="dm-cont-voce" data-stato="attenzione"/);
  /* Il contatore sta bene: verde, col suo numero. */
  assert.match(pagina, /class="dm-cont-voce" data-stato="bene"/);
  assert.doesNotMatch(pagina, /dm-cont-schede/);
});

test("la perdita: da quanto scorre, e che in casa non c'è nessuno", () => {
  const casa = vista(
    [ACQUA, PORTATA(6)],
    { consumi: CONSUMI, portata: STORIA_DELLA_PERDITA },
    false,
  );
  const testa = testaDeiContatori(casa.come, ADESSO);
  assert.equal(testa.stato, "perdita");
  assert.equal(testa.grande, "Scorre da 3 ore");
  assert.equal(testa.nomi, "Acqua · e in casa non c'è nessuno");
  assert.equal(testa.sotto, "214 litri oggi");
  const pagina = paginaDeiContatori(casa);
  assert.match(pagina, /class="dm-cont-voce" data-stato="allarme"/);
  assert.match(pagina, /6 L\/min/);
  /* Con qualcuno in casa la frase non c'è: non si sa di più. */
  const conQualcuno = vista(
    [ACQUA, PORTATA(6)],
    { consumi: CONSUMI, portata: STORIA_DELLA_PERDITA },
    true,
  );
  assert.equal(testaDeiContatori(conQualcuno.come, ADESSO).nomi, "Acqua");
});

test("la tessera in Home dice il guaio con le parole della pagina", () => {
  const bene = tesseraDeiContatori(vista([ACQUA, GAS], { consumi: CONSUMI }));
  assert.equal(bene.value, "214 L");
  assert.equal(bene.caption, "3,4 m³ di gas · Ieri 268 L");
  assert.equal(bene.alert, false);
  const perdita = tesseraDeiContatori(
    vista([ACQUA, PORTATA(6)], { consumi: CONSUMI, portata: STORIA_DELLA_PERDITA }),
  );
  assert.equal(perdita.caption, "Scorre da 3 ore");
  assert.equal(perdita.alert, true);
  assert.equal(perdita.accent, "#dc2626");
  assert.deepEqual(
    perdita.rows.map((riga) => [riga.name, riga.tono]),
    [
      ["Contatore acqua", "quiete"],
      ["Portata", "allarme"],
    ],
  );
  assert.equal(tesseraDeiContatori(null), null);
});

test("le domande al Recorder passano dal ponte, e non c'è un battito che gira", () => {
  /* Il ponte e il pannello lasciano passare statistics_during_period al
   * plurale e la storia: la sorella al singolare morirebbe con «Message type
   * not permitted through the bridge». */
  assert.doesNotMatch(sorgente, /recorder\/statistic_during_period/);
  assert.match(sorgente, /chiediAHomeAssistant\(domanda, ATTESA_MS\)/);
  /* Un appuntamento al prossimo passo del Recorder, non un intervallo. */
  assert.doesNotMatch(sorgente, /setInterval/);
  assert.match(sorgente, /root\.setTimeout\?\.\(\(\) => \{\s*state\.sveglia = 0;/);
  /* E si chiede solo quando qualcuno guarda: la pagina, o la sua tessera. */
  assert.match(sorgente, /if \(serveLeggere\(\)\) \{\s*aggiornaIDati\(\);/);
  assert.match(sorgente, /\.dm-tile\[data-dm-widget="\$\{CONTATORI_TAB\}"\]/);
});

test("la scheda nel Config: il genere cambia le caselle, e i numeri di un altro genere se ne vanno", () => {
  assert.match(scheda, /data-dm-cont-genere="\$\{indice\}"/);
  assert.match(
    scheda,
    /acqua: \["prezzo"\],\s*gas: \["prezzo", "coefficiente"\],\s*pressione: \["minimo", "massimo"\],\s*portata: \[\],\s*sale: \["soglia"\],/,
  );
  assert.match(
    scheda,
    /if \(!CAMPI_DEL_GENERE\[genere\]\.includes\(nome\)\) delete fuori\[nome\];/,
  );
  /* È la scheda dichiarata di tutte le altre, non una copia. */
  assert.match(scheda, /costruisciSchedaDichiarata\(\{/);
});
