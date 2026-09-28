/* La pagina delle piante (#159).
 *
 * «Impostando una soglia minima ti avverte quando è ora di innaffiare, oppure
 * anche se è ora di innaffiare ma è prevista pioggia a breve eviti di farlo.»
 *
 * Qui si tiene ferma la parte che si prova senza una casa vera: cosa dice la
 * risposta grande — da innaffiare, ci pensa la pioggia, stanno tutte bene —,
 * che la pioggia conta solo per chi sta all'aperto, che le frasi con un'ora o
 * un giorno si dicono al singolare, che la tessera in Home chiede attenzione
 * solo per una pianta asciutta, e che le domande a Home Assistant passano dal
 * ponte senza un battito che gira — e non prima che gli stati ci siano.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { comeStannoLePiante, letturaDellaPianta } from "../src/core/le-piante-di-casa.js";

const {
  didascaliaDellaPianta,
  paginaDellePiante,
  parolaDellaPianta,
  pioggiaInParole,
  tesseraDellePiante,
  testaDellePiante,
} = await import(`../src/sections/piante-section.js?piante=${Date.now()}`);

const leggi = (percorso) => readFileSync(new URL(percorso, import.meta.url), "utf8");
const sorgente = leggi("../src/sections/piante-section.js");
const scheda = leggi("../src/sections/piante-editor-section.js");

/* La pagina mette uno spazio che non va a capo fra il numero e l'unità. */
const piano = (testo) => String(testo).replace(/ /g, " ");

const ADESSO = new Date(2026, 8, 28, 10, 0, 0).getTime();
const H = 3600000;
const GIORNO = 24 * H;

const sensore = (valore, attributi = {}) => ({
  state: String(valore),
  last_changed: new Date(ADESSO - 10 * 60000).toISOString(),
  attributes: { unit_of_measurement: "%", device_class: "moisture", ...attributi },
});

const pianta = (riga, valore) =>
  letturaDellaPianta(riga, {
    [riga.entity]: valore === null ? { state: "unavailable" } : sensore(valore),
  });

const FICUS = pianta({ entity: "sensor.ficus_moisture", name: "Ficus del salotto" }, 18);
const ORTO = pianta({ entity: "sensor.orto_moisture", name: "Orto sul balcone", fuori: true }, 21);
const MONSTERA = pianta({ entity: "sensor.monstera_moisture", name: "Monstera" }, 58);
const BASILICO = pianta({ entity: "sensor.basilico_moisture", name: "Basilico" }, null);

/* Il ficus è stato innaffiato sei giorni fa: la terra è salita di colpo, e da
 * lì è scesa fino a oggi. */
const SERIE_DEL_FICUS = [
  { quando: ADESSO - 7 * GIORNO, valore: 22 },
  { quando: ADESSO - 6.6 * GIORNO, valore: 20 },
  { quando: ADESSO - 6.5 * GIORNO, valore: 61 },
  { quando: ADESSO - 3 * GIORNO, valore: 38 },
  { quando: ADESSO - H, valore: 18 },
];

/* La monstera si asciuga di quattro punti al giorno da tre giorni: a 58 e con
 * la soglia a 25, ne mancano otto. */
const SERIE_DELLA_MONSTERA = [
  { quando: ADESSO - 3 * GIORNO - 2 * H, valore: 40 },
  ...Array.from({ length: 73 }, (_, ora) => ({
    quando: ADESSO - 3 * GIORNO + ora * H - 5 * 60000,
    valore: 70 - (ora / 24) * 4,
  })),
];

const PIOGGIA_FRA_4_ORE = { mm: 8, fra: 4, giornaliera: false };

const vista = (letture, dati = {}) => ({
  letture,
  adesso: ADESSO,
  come: comeStannoLePiante(letture, dati),
});

test("una pianta asciutta: la risposta grande è quante innaffiare, e quali", () => {
  const casa = vista([MONSTERA, FICUS], {
    serie: { "sensor.ficus_moisture": SERIE_DEL_FICUS },
  });
  const testa = testaDellePiante(casa.come);
  assert.equal(testa.stato, "sete");
  assert.equal(testa.grande, "1 da innaffiare");
  assert.equal(testa.nomi, "Ficus del salotto");
  assert.equal(testa.sotto, "1 sta bene");
  const pagina = piano(paginaDellePiante(casa));
  /* Il semaforo dei Varchi: prima la pianta asciutta, poi quella che sta bene. */
  assert.match(pagina, /class="dm-pian-voce" data-stato="asciutta"[\s\S]*data-stato="bene"/);
  assert.match(pagina, /Terra al 18 % · ultima acqua 6 giorni fa/);
  assert.match(pagina, />Asciutta</);
  /* E la scheda, con la forcella della Piscina. */
  assert.match(pagina, /class="dm-gauge" data-dm-gauge="terra" data-verdict="low"/);
  assert.match(pagina, /da innaffiare/);
  assert.match(pagina, /ideale 25 – 70 %/);
});

test("all'aperto con la pioggia in arrivo si aspetta; in salotto no", () => {
  const casa = vista([FICUS, ORTO], { pioggia: PIOGGIA_FRA_4_ORE });
  const come = casa.come;
  assert.deepEqual(
    come.piante.map((voce) => [voce.lettura.name, voce.stato]),
    [
      ["Ficus del salotto", "asciutta"],
      ["Orto sul balcone", "aspetta"],
    ],
  );
  /* Il ficus ha sete lo stesso: la risposta grande è sua. */
  assert.equal(testaDellePiante(come).grande, "1 da innaffiare");
  assert.equal(testaDellePiante(come).sotto, "1 aspetta la pioggia");

  const soloFuori = vista([ORTO], { pioggia: PIOGGIA_FRA_4_ORE });
  const testa = testaDellePiante(soloFuori.come);
  assert.equal(testa.stato, "pioggia");
  assert.equal(testa.grande, "Ci pensa la pioggia");
  assert.equal(testa.nomi, "Orto sul balcone");
  assert.equal(piano(testa.sotto), "Piove fra 4 ore: 8 mm");
  const pagina = piano(paginaDellePiante(soloFuori));
  assert.match(pagina, /class="dm-pian-voce" data-stato="aspetta"/);
  assert.match(pagina, /Piove fra 4 ore: 8 mm/);
  assert.equal(parolaDellaPianta("aspetta"), "Aspetta");

  /* Due millimetri non bagnano un vaso: l'orto torna ad avere sete. */
  const pocaPioggia = vista([ORTO], { pioggia: { mm: 2, fra: 3, giornaliera: false } });
  assert.equal(pocaPioggia.come.piante[0].stato, "asciutta");
});

test("stanno tutte bene: la risposta dice quale toccherà per prima, e fra quanto", () => {
  const casa = vista([MONSTERA], {
    serie: { "sensor.monstera_moisture": SERIE_DELLA_MONSTERA },
  });
  const testa = testaDellePiante(casa.come);
  assert.equal(testa.stato, "bene");
  assert.equal(testa.grande, "Stanno tutte bene");
  assert.equal(testa.nomi, "Monstera · acqua fra 8 giorni");
  assert.match(piano(paginaDellePiante(casa)), /Terra al 58 % · acqua fra 8 giorni/);
});

test("chi non risponde lo si dice, e se nessuna risponde non si inventa niente", () => {
  const casa = vista([MONSTERA, BASILICO]);
  assert.equal(testaDellePiante(casa.come).sotto, "1 non risponde");
  const pagina = paginaDellePiante(casa);
  assert.match(pagina, /class="dm-pian-voce" data-stato="muta"/);
  assert.match(pagina, />Non risponde</);
  /* Senza lettura non c'è la scheda con la forcella: niente numeri finti. */
  assert.doesNotMatch(pagina, /data-dm-pian-scheda="sensor\.basilico_moisture"/);
  const nessuna = testaDellePiante(vista([BASILICO]).come);
  assert.equal(nessuna.grande, "Nessuna risponde");
  assert.match(paginaDellePiante(null), /Nessuna pianta configurata/);
});

test("l'ora e il giorno si dicono al singolare, e mai «fra 0 giorni»", () => {
  assert.equal(
    piano(pioggiaInParole({ mm: 3, fra: 1, giornaliera: false })),
    "Piove entro un'ora: 3 mm",
  );
  assert.equal(
    piano(pioggiaInParole({ mm: 2.5, fra: 0, giornaliera: false })),
    "Sta per piovere: 2,5 mm",
  );
  assert.equal(
    piano(pioggiaInParole({ mm: 6, fra: null, giornaliera: true })),
    "Oggi pioggia prevista: 6 mm",
  );
  assert.equal(pioggiaInParole(null), "");

  const dopo = (ore) => ({
    stato: "asciutta",
    lettura: FICUS,
    ultimaAcqua: ADESSO - ore * H,
    giorni: null,
    pioggia: null,
  });
  assert.equal(
    piano(didascaliaDellaPianta(dopo(1.5), ADESSO)),
    "Terra al 18 % · ultima acqua un'ora fa",
  );
  assert.equal(
    piano(didascaliaDellaPianta(dopo(5), ADESSO)),
    "Terra al 18 % · ultima acqua 5 ore fa",
  );
  assert.equal(
    piano(didascaliaDellaPianta(dopo(30), ADESSO)),
    "Terra al 18 % · ultima acqua un giorno fa",
  );
  assert.equal(
    piano(didascaliaDellaPianta(dopo(0.2), ADESSO)),
    "Terra al 18 % · ultima acqua poco fa",
  );

  const fra = (giorni) => ({
    stato: "bene",
    lettura: MONSTERA,
    ultimaAcqua: null,
    giorni,
    pioggia: null,
  });
  assert.equal(piano(didascaliaDellaPianta(fra(0), ADESSO)), "Terra al 58 % · acqua a breve");
  assert.equal(piano(didascaliaDellaPianta(fra(1), ADESSO)), "Terra al 58 % · acqua fra un giorno");
});

test("la tessera in Home chiede attenzione per una pianta asciutta, come la batteria scarica", () => {
  const sete = tesseraDellePiante(vista([MONSTERA, FICUS]));
  assert.equal(sete.key, "piante");
  assert.equal(sete.value, "1");
  assert.equal(sete.caption, "Ficus del salotto");
  assert.equal(sete.attiva, true);
  assert.equal(sete.alert, true);
  assert.equal(sete.accent, "#dc2626");
  assert.deepEqual(
    sete.rows.map((riga) => [riga.name, riga.tono]),
    [
      ["Ficus del salotto", "allarme"],
      ["Monstera", "quiete"],
    ],
  );
  const bene = tesseraDellePiante(
    vista([MONSTERA], { serie: { "sensor.monstera_moisture": SERIE_DELLA_MONSTERA } }),
  );
  assert.equal(bene.value, "0");
  assert.equal(bene.attiva, false);
  assert.equal(bene.alert, false);
  assert.equal(bene.caption, "Stanno tutte bene · Monstera · acqua fra 8 giorni");
  /* L'orto che aspetta la pioggia non accende niente: è a posto. */
  const aspetta = tesseraDellePiante(vista([ORTO], { pioggia: PIOGGIA_FRA_4_ORE }));
  assert.equal(aspetta.attiva, false);
  assert.equal(aspetta.alert, false);
  assert.equal(aspetta.rows[0].value, "Aspetta");
  assert.equal(tesseraDellePiante(null), null);
});

test("le domande passano dal ponte, le previsioni solo per chi sta fuori, e non c'è un battito che gira", () => {
  /* Il ponte lascia passare statistics_during_period al plurale e il
   * servizio con la risposta indietro: le previsioni sono quelle. */
  assert.doesNotMatch(sorgente, /recorder\/statistic_during_period/);
  assert.match(sorgente, /chiediAHomeAssistant\(domanda, ATTESA_MS\)/);
  assert.match(
    sorgente,
    /letture\.some\(\(lettura\) => lettura\.fuori\) \? entitaDelMeteo\(states\) : ""/,
  );
  assert.doesNotMatch(sorgente, /setInterval/);
  assert.match(sorgente, /root\.setTimeout\?\.\(\(\) => \{\s*state\.sveglia = 0;/);
  assert.match(sorgente, /if \(serveLeggere\(\)\) \{\s*aggiornaIDati\(\);/);
  assert.match(sorgente, /\.dm-tile\[data-dm-widget="\$\{PIANTE_TAB\}"\]/);
  /* Prima degli stati non si chiede niente: il meteo di casa si trova fra
   * gli stati, e una risposta senza previsioni resterebbe lì mezz'ora. */
  assert.match(sorgente, /letture\.every\(\(lettura\) => lettura\.muta\)/);
});

test("la scheda nel Config: la spunta «all'aperto» è per pianta, e spenta di serie", () => {
  assert.match(scheda, /costruisciSchedaDichiarata\(\{/);
  /* La casella come quella di «Si vede ma non si comanda» delle Luci e delle
   * Prese: il titolo sopra come gli altri campi, la spiegazione accanto. */
  assert.match(scheda, /<label class="ed-slot dm-pian-fuori">/);
  assert.match(
    scheda,
    /<span class="ed-form-row dm-solo-lettura-riga"><input type="checkbox" data-dm-dich-campo="fuori"/,
  );
  assert.match(scheda, /\$\{fuori \? " checked" : ""\}/);
  assert.match(scheda, /const fuori = riga\.fuori === true \|\|/);
  assert.match(scheda, /rigaNuova: \{ icon: "plant" \}/);
});
