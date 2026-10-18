/* Le notifiche che raccontano: il costo di un ciclo col sole, la giornata
 * della sera, la corrente che va via, il movimento con la foto, l'antifurto
 * su misura. E le impostazioni: semplici o elaborate, e ogni voce su misura.
 *
 * Come nelle altre prove delle notifiche la casa e' finta e l'orologio si
 * sposta a comando, ma i telefoni sono veri e la busta si apre come la apre
 * l'app.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Dispositivi } from "../src/dispositivi.js";
import {
  cieloDiDomani,
  esempioDi,
  impostazioniPulite,
  Notifiche,
  stileDi,
} from "../src/notifiche.js";
import { EVENTI, Sentinella, categoriaDi } from "../src/sentinella.js";
import { apriLaFoto, apriLaSpinta, CONTENUTO_MASSIMO } from "../src/spinta.js";
import {
  curvaCompatta,
  prezzoAllOra,
  quoteDelMomento,
  TaccuinoDellEnergia,
} from "../src/l-energia-di-casa.js";
import { gliUps, reteDi } from "../src/gli-ups.js";
import {
  paroleDelBlackout,
  paroleDelCiclo,
  paroleDelRiepilogo,
} from "../src/parole-delle-notifiche.js";

const MINUTO = 60 * 1000;
const UTENTE_A = "a".repeat(32);

const mezzogiorno = () => new Date(2026, 9, 14, 12, 0, 0).getTime();

const stato = (entity_id, state, attributes = {}, last_changed = null) => ({
  entity_id,
  state,
  attributes,
  ...(last_changed ? { last_changed } : {}),
});

const W = { unit_of_measurement: "W" };

/* Le fasce come le scrive la plancia: tre, F1 di giorno, F3 la notte. */
const TRE_FASCE = JSON.stringify({
  quante: 3,
  voci: [
    { dalle: 480, prezzo: 0.2 },
    { dalle: 1140, prezzo: 0.15 },
    { dalle: 1380, prezzo: 0.1 },
  ],
});

/* ─── Il prezzo e la quota di sole ────────────────────────────────────── */

test("il prezzo e' quello della fascia in vigore, poi la tariffa unica, poi nessuno", () => {
  const giorno = new Date(2026, 9, 14, 12, 0).getTime();
  const notte = new Date(2026, 9, 14, 23, 30).getTime();
  assert.equal(prezzoAllOra({ fasce: TRE_FASCE }, giorno).prezzo, 0.2);
  assert.equal(prezzoAllOra({ fasce: TRE_FASCE }, giorno).fascia, "F1");
  assert.equal(prezzoAllOra({ fasce: TRE_FASCE }, notte).prezzo, 0.1);
  assert.equal(prezzoAllOra({ fasce: "", costo: 0.18 }, giorno).prezzo, 0.18);
  assert.equal(
    prezzoAllOra(
      {
        costo: "sensor.prezzo",
        stato: (id) => (id === "sensor.prezzo" ? { state: "0.21" } : null),
      },
      giorno,
    ).prezzo,
    0.21,
  );
  assert.equal(prezzoAllOra({}, giorno).prezzo, null);
});

test("la quota di sole: prima la rete, poi il sole, poi la batteria", () => {
  /* 2000 W di lavatrice, la casa preleva 500 W: 500 la rete, 1500 il sole. */
  assert.deepEqual(quoteDelMomento({ app: 2000, sole: 3000, rete: 500 }), {
    sole: 1500,
    batteria: 0,
    rete: 500,
  });
  /* Di notte: niente sole, la rete a zero → la batteria. */
  assert.deepEqual(quoteDelMomento({ app: 800, sole: 0, rete: 0 }), {
    sole: 0,
    batteria: 800,
    rete: 0,
  });
  /* Senza rete ma con sole e casa: l'eccedenza. */
  assert.deepEqual(quoteDelMomento({ app: 1000, sole: 1500, casa: 1300 }), {
    sole: 1000,
    batteria: 0,
    rete: 0,
  });
  /* Senza niente: tutto alla rete, che e' la risposta prudente. */
  assert.deepEqual(quoteDelMomento({ app: 1000 }), { sole: 0, batteria: 0, rete: 1000 });
  assert.deepEqual(curvaCompatta([1, 2, 3, 4], 2), [2, 4]);
});

/* Un taccuino col suo orologio, che campiona come il battito della sentinella. */
function unTaccuino(adesso = mezzogiorno()) {
  const orologio = { ora: adesso };
  const taccuino = new TaccuinoDellEnergia({ adesso: () => orologio.ora });
  const passa = (minuti, letture, prezzo) => {
    for (let i = 0; i < minuti * 2; i += 1) {
      orologio.ora += 30 * 1000;
      taccuino.campiona(letture, prezzo);
    }
  };
  return { taccuino, orologio, passa };
}

test("il costo di un ciclo col sole: quanto ha messo la rete, a che prezzo, e senza sole", () => {
  const { taccuino, passa } = unTaccuino();
  const prezzo = () => ({ prezzo: 0.2, indice: 0 });
  taccuino.campiona({ sole: 2500, rete: -500, apparecchi: { "sensor.lavatrice_w": 2000 } }, prezzo);
  /* Un'ora tutta col sole, poi un'ora con la rete che ne mette la meta'. */
  passa(60, { sole: 2500, rete: -500, apparecchi: { "sensor.lavatrice_w": 2000 } }, prezzo);
  passa(60, { sole: 1000, rete: 1000, apparecchi: { "sensor.lavatrice_w": 2000 } }, prezzo);
  const ciclo = taccuino.chiudiIlCiclo("sensor.lavatrice_w");
  assert.equal(ciclo.kwh, 4);
  assert.equal(ciclo.sole, 0.75);
  assert.equal(ciclo.rkwh, 1);
  assert.equal(ciclo.eur, 0.2);
  assert.equal(ciclo.senza, 0.8);
  assert.equal(ciclo.min, 120);
  assert.ok(ciclo.w.length <= 32 && ciclo.s.length === ciclo.w.length);
  /* Chiuso, non c'e' piu'. */
  assert.equal(taccuino.chiudiIlCiclo("sensor.lavatrice_w"), null);
});

test("di notte il ciclo va con la batteria; senza sole e con le fasce c'e' il consiglio", () => {
  const { taccuino, passa } = unTaccuino(new Date(2026, 9, 14, 21, 0).getTime());
  taccuino.campiona({ sole: 0, rete: 0, apparecchi: { "sensor.asciugatrice_w": 1000 } });
  passa(60, { sole: 0, rete: 0, apparecchi: { "sensor.asciugatrice_w": 1000 } }, () => ({
    prezzo: 0.15,
    indice: 1,
  }));
  const conBatteria = taccuino.chiudiIlCiclo("sensor.asciugatrice_w");
  assert.equal(conBatteria.batt, 1);
  assert.equal(conBatteria.eur, 0);

  /* Senza fotovoltaico: tutto dalla rete in F1, e la F3 costava la meta'. */
  const altro = unTaccuino();
  altro.taccuino.campiona({ casa: 1000, apparecchi: { "sensor.lavatrice_w": 1000 } });
  altro.passa(60, { casa: 1000, apparecchi: { "sensor.lavatrice_w": 1000 } }, () => ({
    prezzo: 0.2,
    indice: 0,
  }));
  const ciclo = altro.taccuino.chiudiIlCiclo("sensor.lavatrice_w", {
    prezzoMigliore: { prezzo: 0.1, dalle: 1380, nome: "F3" },
  });
  assert.equal(ciclo.eur, 0.2);
  assert.deepEqual(ciclo.meglio, { eur: 0.1, dalle: "23:00", fascia: "F3" });
  const parole = paroleDelCiclo(
    { nome: "Lavatrice", genere: "lavatrice", ciclo, conSole: false, fascia: "F1" },
    "it",
  );
  assert.match(parole.testo, /Costo 0,20 € · fascia F1 a 0,20 €\/kWh/);
  assert.match(parole.testo, /Partita dopo le 23:00 sarebbe costata 0,10 €/);
  /* «Dentro» decide cosa si scrive. */
  const corto = paroleDelCiclo(
    { nome: "Lavatrice", genere: "lavatrice", ciclo, conSole: false },
    "it",
    { dentro: ["durata"] },
  );
  assert.equal(corto.testo, "In funzione 1 h");
});

test("la lavatrice che finisce dice durata, kWh e costo col sole, e la scheda per le elaborate", () => {
  const orologio = { ora: mezzogiorno() };
  const dette = [];
  const sentinella = new Sentinella({ adesso: () => orologio.ora, quando: (e) => dette.push(e) });
  sentinella.taccuino = new TaccuinoDellEnergia({ adesso: () => orologio.ora });
  sentinella.valori = () => ({
    cd_entity_overrides: JSON.stringify({
      "dm.energy_potenza_fotovoltaico": "sensor.pv",
      "dm.energy_potenza_scambio_rete": "sensor.rete",
    }),
    cd_costo_kwh: 0.2,
  });
  sentinella.carica([
    stato("sensor.pv", "3000", W),
    stato("sensor.rete", "-1000", W),
    stato("sensor.lavatrice_potenza", "0", { ...W, friendly_name: "Lavatrice potenza" }),
  ]);
  sentinella.battito();
  sentinella.cambia(
    "sensor.lavatrice_potenza",
    stato("sensor.lavatrice_potenza", "2000", { ...W, friendly_name: "Lavatrice potenza" }),
  );
  for (let i = 0; i < 80; i += 1) {
    orologio.ora += 30 * 1000;
    sentinella.battito();
  }
  sentinella.cambia(
    "sensor.lavatrice_potenza",
    stato("sensor.lavatrice_potenza", "1", { ...W, friendly_name: "Lavatrice potenza" }),
  );
  for (let i = 0; i < 12; i += 1) {
    orologio.ora += 30 * 1000;
    sentinella.battito();
  }
  const finita = dette.find((d) => d.tipo === "elettrodomestici");
  assert.ok(finita, "la lavatrice ha finito");
  assert.equal(finita.parole.it.titolo, "🫧 Lavatrice finita");
  assert.match(finita.parole.it.testo, /^In funzione 4\d min · 1,\d\d kWh/);
  assert.match(finita.parole.it.testo, /☀️ 100% dal sole|tutta col sole/);
  assert.equal(finita.misura.euro, 0);
  const elaborata = paroleDelCiclo(finita.componi.dati, "it", { stile: "elaborata" });
  assert.equal(elaborata.scheda.t, "ciclo");
  assert.equal(elaborata.scheda.i, "lavatrice");
  assert.match(elaborata.titolo, /· gratis$/);
});

/* ─── Il riepilogo della sera ─────────────────────────────────────────── */

const giornata = (extra = {}) => ({
  d: "2026-10-17",
  sole: 18.4,
  casa: 16.7,
  presi: 3.1,
  ceduti: 4.8,
  usato: 13.6,
  quotaInCasa: 0.74,
  euroRete: 0.52,
  risparmio: 2.41,
  picco: 4.9,
  piccoIl: "13:10",
  p: Array(24).fill(10),
  c: Array(24).fill(8),
  perFascia: {},
  cicli: [],
  ...extra,
});

test("il riepilogo col fotovoltaico: sole, soldi, record, domani e da sistemare", () => {
  const dati = {
    giornata: giornata(),
    conSole: true,
    ieri: 16.4,
    media: 15,
    record: "mese",
    colSole: ["Lavatrice", "Lavastoviglie"],
    batteria: 62,
    domani: { met: [[9, "sole"]], soleFino: "15:00", pioggia: false },
    fasce: { nomi: {}, piuBassa: null },
    daSistemare: { batterie: 1, spenti: 0, aggiornamenti: 1 },
    inCoda: [],
  };
  const it = paroleDelRiepilogo(dati, "it");
  assert.equal(it.titolo, "☀️ La tua giornata · 18,4 kWh dal sole");
  assert.deepEqual(it.testo.split("\n"), [
    "Usati in casa il 74% · risparmiati 2,41 €",
    "Rete 3,1 kWh · 0,52 € · ceduti 4,8 kWh",
    "Picco 4,9 kW alle 13:10 · +12% su ieri",
    "🏆 La giornata più solare di ottobre",
    "🫧 Lavatrice e Lavastoviglie: tutte col sole",
    "🔋 Batteria di casa al 62% per la notte",
    "🌤️ Domani sole fino alle 15:00: lavatrice entro le 15:00",
    "⚠️ Da sistemare: 1 batteria scarica, 1 aggiornamento",
  ]);
  const elaborata = paroleDelRiepilogo(dati, "it", { stile: "elaborata" });
  assert.equal(elaborata.titolo, "☀️ La tua giornata · 18,4 kWh dal sole");
  assert.deepEqual(elaborata.testo.split("\n"), [
    "💶 Rete 0,52 € · risparmiati 2,41 €",
    "⚠️ Da sistemare: 1 batteria scarica, 1 aggiornamento",
  ]);
  assert.equal(elaborata.scheda.t, "giornata");
  assert.equal(elaborata.scheda.rec, "ottobre");
  assert.equal(elaborata.scheda.p.length, 24);
});

test("il riepilogo senza fotovoltaico: consumi e costo per fascia, e il piu' acceso", () => {
  const dati = {
    giornata: giornata({
      sole: null,
      quotaInCasa: null,
      casa: 11.6,
      euroRete: 1.84,
      perFascia: { 0: 6.9, 2: 4.7 },
    }),
    conSole: false,
    ieri: 12.7,
    piuAcceso: { nome: "Lavatrice", kwh: 1.9 },
    batteria: null,
    domani: { met: [], soleFino: null, pioggia: true },
    fasce: { nomi: { 0: "F1", 2: "F3" }, piuBassa: { nome: "F3", dalle: "23:00" } },
    daSistemare: { batterie: 0, spenti: 0, aggiornamenti: 0 },
  };
  const it = paroleDelRiepilogo(dati, "it");
  assert.equal(it.titolo, "⚡ La tua giornata · 11,6 kWh");
  assert.match(it.testo, /^Costo 1,84 € · 6,9 kWh in F1 · 4,7 kWh in F3/);
  assert.match(it.testo, /−9% su ieri/);
  assert.match(it.testo, /💡 Il più acceso: Lavatrice, 1,9 kWh/);
  assert.match(it.testo, /🌧️ Domani pioggia: lavatrice dopo le 23:00, costa meno/);
  /* Niente da raccontare e niente da sistemare: niente riepilogo. */
  assert.equal(paroleDelRiepilogo({ giornata: null, daSistemare: {} }, "it"), null);
});

test("il record si conserva sul disco con i giorni passati", () => {
  const cartella = mkdtempSync(join(tmpdir(), "energia-"));
  try {
    const orologio = { ora: new Date(2026, 9, 1, 12, 0).getTime() };
    const taccuino = new TaccuinoDellEnergia({ cartella, adesso: () => orologio.ora });
    for (let giorno = 1; giorno <= 7; giorno += 1) {
      orologio.ora = new Date(2026, 9, giorno, 12, 0).getTime();
      taccuino.campiona({ sole: 1000 * giorno, soleOggi: giorno * 2 });
    }
    taccuino.scrivi();
    const riletto = new TaccuinoDellEnergia({ cartella, adesso: () => orologio.ora });
    assert.equal(riletto.giorniPassati().length, 6);
    assert.equal(riletto.giorniPassati().at(-1).pk, 12);
    assert.equal(riletto.laGiornata().d, "2026-10-07");
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("il cielo di domani: il sole fino a che ora, e la pioggia", () => {
  const adesso = new Date(2026, 9, 17, 20, 30).getTime();
  const ore = (h, condition) => ({
    datetime: new Date(2026, 9, 18, h, 0).toISOString(),
    condition,
  });
  const cielo = cieloDiDomani(
    [
      ore(9, "sunny"),
      ore(11, "sunny"),
      ore(13, "sunny"),
      ore(14, "partlycloudy"),
      ore(15, "cloudy"),
      ore(17, "rainy"),
    ],
    adesso,
  );
  assert.equal(cielo.soleFino, "15:00");
  assert.equal(cielo.pioggia, true);
  assert.deepEqual(cielo.met[0], [9, "sole"]);
  assert.equal(cieloDiDomani([], adesso), null);
});

/* ─── La corrente ─────────────────────────────────────────────────────── */

test("gli UPS si trovano da soli: NUT e la frase che ricarica", () => {
  assert.equal(reteDi("Online Battery Charging"), true);
  assert.equal(reteDi("OB DISCHRG"), false);
  const stati = new Map(
    [
      stato("sensor.myups_status_data", "OL CHRG", { friendly_name: "myups Status Data" }),
      stato("sensor.myups_battery_charge", "100"),
      stato("sensor.myups_battery_runtime", "1500"),
      stato("sensor.stampante_status", "on"),
    ].map((s) => [s.entity_id, { state: s.state, attributes: s.attributes, dal: 0 }]),
  );
  const elenco = gliUps(stati, {});
  assert.equal(elenco.length, 1, "la stampante non e' un UPS");
  assert.equal(elenco[0].rete, true);
  assert.equal(elenco[0].autonomia, 25);
});

test("la corrente che va via, la batteria al 30% e il ritorno: tre notifiche, solo i cambi veri", () => {
  const orologio = { ora: mezzogiorno() };
  const dette = [];
  const sentinella = new Sentinella({ adesso: () => orologio.ora, quando: (e) => dette.push(e) });
  const ups = (status, carica) => [
    stato("sensor.myups_status_data", status),
    stato("sensor.myups_battery_charge", String(carica)),
    stato("sensor.myups_battery_runtime", String(carica * 15)),
    stato("sensor.myups_ups_realpower", "180"),
  ];
  const metti = (status, carica) => {
    for (const s of ups(status, carica)) sentinella.cambia(s.entity_id, s);
    sentinella.battito();
  };
  sentinella.carica(ups("OL", 100));
  sentinella.battito();
  assert.equal(dette.length, 0, "all'avvio non si dice niente");
  orologio.ora += MINUTO;
  metti("OB DISCHRG", 96);
  const via = dette.find((d) => d.tipo === "blackout");
  assert.equal(via.urgenza, "urgente");
  assert.equal(via.parole.it.titolo, "⚡ Manca la corrente");
  assert.equal(via.parole.it.testo, "La casa va con l'UPS · carica 96%, circa 24 min");
  assert.equal(via.ancora(), true);
  orologio.ora += 10 * MINUTO;
  metti("OB DISCHRG", 29);
  assert.match(dette.at(-1).parole.it.titolo, /UPS al 29%/);
  orologio.ora += 2 * MINUTO;
  metti("OL CHRG", 35);
  const torna = dette.at(-1);
  assert.equal(torna.parole.it.titolo, "✅ Corrente tornata");
  assert.equal(torna.parole.it.testo, "Dopo 12 min · l'UPS si ricarica (35%)");
  assert.equal(torna.urgenza, "normale");
  assert.equal(dette.filter((d) => d.tipo === "blackout").length, 3);
  const scheda = paroleDelBlackout({ ...via.componi.dati }, "it", { stile: "elaborata" }).scheda;
  assert.equal(scheda.t, "ups");
  assert.equal(scheda.w, 180);
});

/* ─── L'antifurto su misura ───────────────────────────────────────────── */

test("l'interruttore «scattato» su misura: urgente, con zona, sirena e i tasti per spegnere", () => {
  const orologio = { ora: mezzogiorno() };
  const dette = [];
  const sentinella = new Sentinella({ adesso: () => orologio.ora, quando: (e) => dette.push(e) });
  sentinella.valori = () => ({
    cd_antifurto_scattato: JSON.stringify({
      entita: "switch.antifurto_scattato",
      sirena: "switch.sirena",
    }),
    cd_antifurto_su_misura: JSON.stringify([
      {
        id: "totale",
        nome: "Totale",
        entita: "script.inserisci_totale",
        stato: "input_boolean.totale",
      },
      { id: "spento", nome: "Disinserito", entita: "script.disinserisci" },
    ]),
  });
  sentinella.carica([
    stato("switch.antifurto_scattato", "off"),
    stato("switch.sirena", "on"),
    stato("input_boolean.totale", "on"),
    stato("binary_sensor.finestra_cucina", "off", {
      device_class: "window",
      friendly_name: "Finestra cucina",
    }),
  ]);
  sentinella.cambia(
    "binary_sensor.finestra_cucina",
    stato("binary_sensor.finestra_cucina", "on", {
      device_class: "window",
      friendly_name: "Finestra cucina",
    }),
  );
  orologio.ora += MINUTO;
  sentinella.cambia("switch.antifurto_scattato", stato("switch.antifurto_scattato", "on"));
  const scattato = dette.find((d) => d.tipo === "antifurto");
  assert.ok(scattato);
  assert.equal(scattato.urgenza, "urgente");
  assert.equal(scattato.parole.it.titolo, "🚨 Antifurto scattato");
  assert.equal(scattato.parole.it.testo, "Finestra cucina · 12:01 · sirena accesa");
  assert.deepEqual(
    scattato.azioni.map((a) => a.id),
    ["spegni-sirena", "disinserisci", "guarda"],
  );
  assert.deepEqual(scattato.azioni[0].servizio, {
    dominio: "switch",
    servizio: "turn_off",
    entita: ["switch.sirena"],
  });
  assert.deepEqual(scattato.azioni[1].servizio, {
    dominio: "script",
    servizio: "turn_on",
    entita: ["script.disinserisci"],
  });
  assert.equal(scattato.componi.dati.modo, "Totale");
  /* Restare scattato non e' scattare di nuovo. */
  sentinella.cambia("switch.antifurto_scattato", stato("switch.antifurto_scattato", "on"));
  assert.equal(dette.filter((d) => d.tipo === "antifurto").length, 1);
});

test("il movimento con la casa vuota propone «Inserisci» col modo su misura; col PIN apre l'app", () => {
  const orologio = { ora: mezzogiorno() };
  const dette = [];
  const sentinella = new Sentinella({ adesso: () => orologio.ora, quando: (e) => dette.push(e) });
  let pin = "";
  sentinella.valori = () => ({
    cd_antifurto_su_misura: JSON.stringify([
      { id: "totale", nome: "Totale", entita: "select.modo", opzione: "Totale", pin },
      { id: "spento", nome: "Disinserito", entita: "select.modo", opzione: "Spento" },
    ]),
  });
  sentinella.carica([
    stato("person.uno", "not_home", { user_id: UTENTE_A }),
    stato("select.modo", "Spento"),
    stato("binary_sensor.pir_ingresso", "off", { device_class: "motion" }),
    stato("camera.ingresso", "idle"),
  ]);
  const muovi = () => {
    sentinella.cambia(
      "binary_sensor.pir_ingresso",
      stato("binary_sensor.pir_ingresso", "off", { device_class: "motion" }),
    );
    sentinella.cambia(
      "binary_sensor.pir_ingresso",
      stato("binary_sensor.pir_ingresso", "on", { device_class: "motion" }),
    );
    return dette.at(-1);
  };
  const mosso = muovi();
  assert.equal(mosso.tipo, "movimento");
  assert.equal(mosso.camera, "camera.ingresso");
  assert.equal(mosso.conFoto, true);
  assert.equal(mosso.perche, "casa-vuota");
  const inserisci = mosso.azioni.find((a) => a.id === "inserisci");
  assert.deepEqual(inserisci.servizio, {
    dominio: "select",
    servizio: "select_option",
    entita: ["select.modo"],
    dati: { option: "Totale" },
  });
  assert.equal(inserisci.parole.it, "Inserisci · Totale");
  pin = "1234";
  orologio.ora += MINUTO;
  sentinella._suMisuraCache = null;
  const conPin = muovi();
  assert.equal(conPin.azioni.find((a) => a.id === "inserisci").apre, true);
});

/* ─── A chi arriva, e come ────────────────────────────────────────────── */

function unBanco({ adesso = mezzogiorno() } = {}) {
  const cartella = mkdtempSync(join(tmpdir(), "notifiche-parlanti-"));
  const orologio = { ora: adesso };
  const dispositivi = new Dispositivi({ cartella, adesso: () => orologio.ora });
  const a = dispositivi.abbina({ nome: "Telefono A", utente: UTENTE_A });
  const utenti = {
    elenco: async () => [{ id: UTENTE_A, nome: "Persona 1", amministratore: true, attivo: true }],
    eVivo: async () => true,
  };
  const spinte = [];
  const foto = [];
  const chiamate = [];
  let scatti = 0;
  const postino = {
    pronto: true,
    spingi: (spinta) => {
      spinte.push(spinta);
      return true;
    },
    mandaLaFoto: async (una) => {
      const id = String(foto.length + 1).padStart(32, "0");
      foto.push({ ...una, id });
      return id;
    },
    diIGettoni: () => {},
  };
  const casa = {
    chiedi: async (comando) => {
      chiamate.push(comando);
      return [];
    },
    ascolta: async () => () => {},
    immagine: async () => {
      scatti += 1;
      return Buffer.from([0xff, 0xd8, 0xff, 1, 2, 3, 4]);
    },
  };
  const notifiche = new Notifiche({
    cartella,
    dispositivi,
    utenti,
    casa,
    commissioni: { telecamereChiuse: () => new Set() },
    postino,
    adesso: () => orologio.ora,
  });
  const apri = (spinta) =>
    apriLaSpinta({ chiaveDelFilo: a.chiave, telefono: a.dispositivo.id, busta: spinta.busta });
  const imposta = (impostazioni) =>
    notifiche.rispondi(
      { id: 9, type: "ponte/notifiche/imposta", impostazioni },
      { dispositivo: a.dispositivo },
    );
  return {
    cartella,
    orologio,
    notifiche,
    spinte,
    foto,
    chiamate,
    a,
    apri,
    imposta,
    scatti: () => scatti,
    registra: () =>
      notifiche.rispondi(
        { id: 1, type: "ponte/notifiche/registra", gettone: `gettone-${"x".repeat(30)}` },
        { dispositivo: a.dispositivo },
      ),
    spegni: () => {
      notifiche.ferma();
      rmSync(cartella, { recursive: true, force: true });
    },
  };
}

const movimento = (perche = "casa-vuota") => ({
  tipo: "movimento",
  urgenza: "normale",
  chiave: `m:${Math.random()}`,
  entita: "binary_sensor.pir_ingresso",
  camera: "camera.ingresso",
  conFoto: true,
  perche,
  componi: {
    tipo: "movimento",
    dati: {
      nome: "Ingresso",
      cam: "Ingresso",
      ora: "12:00",
      secondi: "12:00:07",
      vuota: perche === "casa-vuota",
      notte: perche === "notte",
    },
  },
  parole: { it: { titolo: "Movimento", testo: "" } },
  azioni: [],
});

test("le impostazioni: semplici di serie, elaborate a scelta, e ogni voce su misura", () => {
  const di = impostazioniPulite();
  assert.equal(di.stile, "semplici");
  assert.deepEqual(di.su, {});
  const scelte = impostazioniPulite({
    stile: "elaborate",
    su: {
      elettrodomestici: {
        stile: "semplice",
        soglia: "0.1",
        dentro: ["costo", "inventato"],
        come: "riepilogo",
      },
      movimento: { quando: "notte", quali: ["camera.ingresso", "non va"] },
      inventato: { stile: "elaborata" },
    },
  });
  assert.equal(scelte.stile, "elaborate");
  assert.deepEqual(scelte.su.elettrodomestici, {
    stile: "semplice",
    soglia: 0.1,
    dentro: ["costo"],
    come: "riepilogo",
  });
  assert.deepEqual(scelte.su.movimento, { quando: "notte", quali: ["camera.ingresso"] });
  assert.equal(scelte.su.inventato, undefined);
  assert.equal(stileDi(scelte, "elettrodomestici"), "semplice");
  assert.equal(stileDi(scelte, "riepilogo"), "elaborata");
  /* `null` toglie la voce; il resto resta. */
  const tolta = impostazioniPulite({ su: { movimento: null } }, scelte);
  assert.equal(tolta.su.movimento, undefined);
  assert.ok(tolta.su.elettrodomestici);
});

test("con le semplici nessuna foto lascia la casa; con le elaborate parte chiusa, prima della busta", async () => {
  const banco = unBanco();
  try {
    await banco.registra();
    assert.equal(await banco.notifiche.consegna(movimento()), 1);
    assert.equal(banco.foto.length, 0, "semplici: niente foto");
    assert.equal(banco.scatti(), 0, "e nemmeno la si chiede alla telecamera");
    const semplice = banco.apri(banco.spinte.at(-1));
    assert.equal(semplice.stile, "s");
    assert.equal(semplice.scheda, undefined);
    assert.equal(semplice.titolo, "📷 Movimento · Ingresso");

    await banco.imposta({ stile: "elaborate" });
    banco.orologio.ora += 2 * MINUTO;
    assert.equal(await banco.notifiche.consegna(movimento()), 1);
    assert.equal(banco.foto.length, 1);
    const contenuto = banco.apri(banco.spinte.at(-1));
    assert.equal(contenuto.stile, "e");
    assert.deepEqual(contenuto.foto, { id: banco.foto[0].id, t: "image/jpeg" });
    assert.equal(contenuto.scheda.t, "movimento");
    /* La foto si apre solo con la chiave di quel telefono. */
    const byte = apriLaFoto({
      chiaveDelFilo: banco.a.chiave,
      telefono: banco.a.dispositivo.id,
      busta: banco.foto[0].dati,
    });
    assert.deepEqual([...byte.subarray(0, 3)], [0xff, 0xd8, 0xff]);
    /* Una al minuto per telecamera: il secondo movimento subito dopo va
     * senza foto. */
    assert.equal(await banco.notifiche.consegna(movimento()), 1);
    assert.equal(banco.foto.length, 1);
  } finally {
    banco.spegni();
  }
});

test("il movimento: «solo di notte» non vuole quello con la casa vuota di giorno", async () => {
  const banco = unBanco();
  try {
    await banco.registra();
    await banco.imposta({ su: { movimento: { quando: "notte" } } });
    assert.equal(await banco.notifiche.consegna(movimento("casa-vuota")), 0);
    assert.equal(await banco.notifiche.consegna(movimento("notte")), 1);
    await banco.imposta({ su: { movimento: { quali: ["camera.giardino"], quando: "sempre" } } });
    assert.equal(
      await banco.notifiche.consegna(movimento("casa-vuota")),
      0,
      "non e' fra quelle scelte",
    );
  } finally {
    banco.spegni();
  }
});

test("«nel riepilogo della sera»: non parte, e la sera si legge in fondo", async () => {
  const banco = unBanco({ adesso: new Date(2026, 9, 14, 18, 0).getTime() });
  try {
    await banco.registra();
    await banco.imposta({ su: { elettrodomestici: { come: "riepilogo" } } });
    const lavatrice = esempioDi("elettrodomestici", banco.orologio.ora);
    lavatrice.tipo = "elettrodomestici";
    lavatrice.chiave = "elettrodomestici:x";
    assert.equal(await banco.notifiche.consegna(lavatrice), 0);
    banco.orologio.ora = new Date(2026, 9, 14, 20, 31).getTime();
    await banco.notifiche._riepiloghi();
    assert.equal(banco.spinte.length, 1);
    const sera = banco.apri(banco.spinte[0]);
    assert.equal(sera.tipo, "riepilogo");
    assert.match(sera.testo, /🫧 Lavatrice finita/);
  } finally {
    banco.spegni();
  }
});

test("la soglia della lavatrice: sotto i 10 centesimi non si dice", async () => {
  const banco = unBanco();
  try {
    await banco.registra();
    await banco.imposta({ su: { elettrodomestici: { soglia: 0.1 } } });
    const evento = (euro) => ({
      tipo: "elettrodomestici",
      urgenza: "normale",
      chiave: `e:${euro}`,
      misura: { euro },
      parole: { it: { titolo: "Lavatrice", testo: "" } },
    });
    assert.equal(await banco.notifiche.consegna(evento(0.05)), 0);
    assert.equal(await banco.notifiche.consegna(evento(0.3)), 1);
  } finally {
    banco.spegni();
  }
});

test("il blackout «oltre 5 minuti»: aspetta, e parte solo se la corrente e' ancora via", async () => {
  const banco = unBanco();
  try {
    await banco.registra();
    await banco.imposta({ su: { blackout: { soglia: 5 } } });
    let via = true;
    const blackout = {
      tipo: "blackout",
      urgenza: "urgente",
      chiave: "blackout:x",
      misura: { fase: "via", dal: banco.orologio.ora },
      ancora: () => via,
      componi: {
        tipo: "blackout",
        dati: { nome: "UPS", carica: 96, minuti: 25, fase: "via", dalle: "12:00" },
      },
      parole: { it: { titolo: "⚡", testo: "" } },
    };
    assert.equal(await banco.notifiche.consegna(blackout), 0);
    banco.orologio.ora += 6 * MINUTO;
    await banco.notifiche._leAttese();
    assert.equal(banco.spinte.length, 1);
    assert.equal(banco.apri(banco.spinte[0]).titolo, "⚡ Manca la corrente");
    /* Un secondo blackout che finisce prima: non si dice, ne' via ne' torna. */
    via = false;
    assert.equal(
      await banco.notifiche.consegna({
        ...blackout,
        chiave: "blackout:y",
        misura: { fase: "via", dal: banco.orologio.ora },
      }),
      0,
    );
    banco.orologio.ora += 6 * MINUTO;
    await banco.notifiche._leAttese();
    assert.equal(banco.spinte.length, 1);
    assert.equal(
      await banco.notifiche.consegna({
        ...blackout,
        urgenza: "normale",
        chiave: "blackout-torna:y",
        misura: { fase: "torna", durata: 3 },
      }),
      0,
    );
  } finally {
    banco.spegni();
  }
});

test("le elaborate stanno nella busta: ogni esempio sotto il limite, la scheda c'e'", async () => {
  const banco = unBanco();
  try {
    await banco.registra();
    await banco.imposta({ stile: "elaborate" });
    for (const tipo of ["elettrodomestici", "riepilogo", "blackout", "movimento", "antifurto"]) {
      const risposta = await banco.notifiche.rispondi(
        { id: 3, type: "ponte/notifiche/prova", tipo },
        { dispositivo: banco.a.dispositivo },
      );
      assert.equal(risposta.success, true, tipo);
      const contenuto = banco.apri(banco.spinte.at(-1));
      assert.ok(Buffer.byteLength(JSON.stringify(contenuto)) <= CONTENUTO_MASSIMO, tipo);
      assert.equal(contenuto.stile, "e", tipo);
      assert.ok(contenuto.scheda, `${tipo}: la scheda c'e'`);
      banco.orologio.ora += 10 * MINUTO;
    }
    /* Un tipo che non racconta niente non ha esempio. */
    const no = await banco.notifiche.rispondi(
      { id: 4, type: "ponte/notifiche/prova", tipo: "inventato" },
      { dispositivo: banco.a.dispositivo },
    );
    assert.equal(no.success, false);
  } finally {
    banco.spegni();
  }
});

/* «Prova: mandamela adesso» c'e' nel foglio di ogni voce della pagina
 * Notifiche. La personalizzata si prova dal suo editor (con la regola), e
 * le notifiche di Home Assistant non hanno una prova per voce. */
const CON_UN_ESEMPIO = EVENTI.filter((tipo) => !["personalizzata", "ha_notify"].includes(tipo));

test("ogni voce ha il suo esempio, in italiano e in inglese, nella sua categoria", () => {
  const adesso = mezzogiorno();
  for (const tipo of CON_UN_ESEMPIO) {
    const esempio = esempioDi(tipo, adesso);
    assert.ok(esempio, `${tipo}: l'esempio c'e'`);
    /* Una prova: non ha limiti, non conta fra le vere, non ha pause. */
    assert.equal(esempio.tipo, "prova", tipo);
    assert.equal(esempio.chiave, "prova", tipo);
    assert.equal(esempio.categoria, categoriaDi(tipo), tipo);
    for (const lingua of ["it", "en"]) {
      assert.ok(String(esempio.parole?.[lingua]?.titolo || "").trim(), `${tipo} ${lingua}: titolo`);
      assert.ok(String(esempio.parole?.[lingua]?.testo || "").trim(), `${tipo} ${lingua}: testo`);
    }
    /* I tasti si vedono, ma non portano niente da eseguire. */
    for (const tasto of esempio.azioni)
      assert.deepEqual(
        Object.keys(tasto).filter((k) => !["id", "parole", "apre"].includes(k)),
        [],
        `${tipo}: ${tasto.id}`,
      );
    /* Niente entita' ne' nomi di persone: «Persona 1». */
    assert.doesNotMatch(JSON.stringify(esempio), /person\.|light\.|cover\.|alarm_control/, tipo);
  }
});

test("gli esempi hanno le parole, l'urgenza e i tasti delle notifiche vere", () => {
  const adesso = mezzogiorno();
  const campanello = esempioDi("campanello", adesso);
  assert.equal(campanello.urgenza, "urgente");
  assert.equal(campanello.chiamata, true, "il campanello arriva come una chiamata");
  assert.equal(campanello.parole.it.titolo, "🔔 Suona il campanello");
  assert.deepEqual(
    campanello.azioni.map((t) => t.id),
    ["apri", "ignora"],
  );
  assert.equal(esempioDi("allarmi", adesso).urgenza, "urgente");
  assert.equal(esempioDi("antifurto", adesso).urgenza, "urgente");
  assert.equal(esempioDi("arrivi", adesso).urgenza, "bassa");
  assert.equal(esempioDi("suggerimenti", adesso).urgenza, "bassa");
  assert.equal(esempioDi("viaggi", adesso).parole.it.titolo, "Parti fra 10 minuti");
  assert.deepEqual(
    esempioDi("viaggi", adesso).azioni.map((t) => t.parole.it),
    ["Apri il garage"],
  );
  assert.deepEqual(
    esempioDi("aperture", adesso).azioni.map((t) => t.parole.it),
    ["Chiudi", "Va bene così", "Più tardi"],
  );
  assert.deepEqual(
    esempioDi("uscito", adesso).azioni.map((t) => t.parole.it),
    ["Inserisci", "Più tardi"],
  );
  assert.equal(esempioDi("ha_notify", adesso), null);
  assert.equal(esempioDi("personalizzata", adesso), null);
});

test("«Prova: mandamela adesso» parte per ogni voce, e i suoi tasti non comandano niente", async () => {
  const banco = unBanco();
  try {
    await banco.registra();
    for (const [i, tipo] of CON_UN_ESEMPIO.entries()) {
      const risposta = await banco.notifiche.rispondi(
        { id: 100 + i, type: "ponte/notifiche/prova", tipo },
        { dispositivo: banco.a.dispositivo },
      );
      assert.equal(risposta.success, true, `${tipo}: ${JSON.stringify(risposta.error)}`);
      assert.doesNotMatch(JSON.stringify(risposta), /non c'e' un esempio/, tipo);
      const contenuto = banco.apri(banco.spinte.at(-1));
      assert.equal(contenuto.tipo, "prova", tipo);
      assert.equal(contenuto.cat, categoriaDi(tipo), tipo);
      assert.ok(contenuto.titolo.trim() && contenuto.testo.trim(), tipo);
      const esempio = esempioDi(tipo, banco.orologio.ora);
      assert.equal(contenuto.urg, esempio.urgenza, tipo);
      assert.equal(banco.spinte.at(-1).urgente, esempio.urgenza === "urgente", tipo);
      assert.equal(contenuto.chiamata === true, tipo === "campanello", tipo);
      assert.equal(contenuto.azioni.length, esempio.azioni.length, tipo);
      /* Premuto, un tasto di prova non tocca la casa. */
      for (const tasto of contenuto.azioni) {
        const prima = banco.chiamate.length;
        const premuto = await banco.notifiche.rispondi(
          { id: 1, type: "ponte/notifiche/azione", notifica: contenuto.id, azione: tasto.id },
          { dispositivo: banco.a.dispositivo, utente: UTENTE_A },
        );
        assert.equal(premuto.success, false, `${tipo}: ${tasto.id}`);
        assert.match(premuto.error.message, /prova/, `${tipo}: ${tasto.id}`);
        assert.equal(banco.chiamate.length, prima, `${tipo}: ${tasto.id}`);
      }
    }
    /* Quelle che non hanno una prova per voce. */
    for (const tipo of ["ha_notify", "personalizzata"]) {
      const no = await banco.notifiche.rispondi(
        { id: 200, type: "ponte/notifiche/prova", tipo },
        { dispositivo: banco.a.dispositivo },
      );
      assert.equal(no.success, false, tipo);
    }
  } finally {
    banco.spegni();
  }
});

test("«Quando partire» di prova solo col pianificatore dei viaggi sbloccato", async () => {
  for (const [licenze, parte] of [
    [null, true],
    [{ attive: true, premium: true, gdanav: true }, true],
    [{ attive: true, premium: false, gdanav: true }, true],
    [{ attive: true, premium: false, gdanav: false }, false],
  ]) {
    const banco = unBanco();
    try {
      banco.notifiche.licenze = licenze;
      await banco.registra();
      const risposta = await banco.notifiche.rispondi(
        { id: 3, type: "ponte/notifiche/prova", tipo: "viaggi" },
        { dispositivo: banco.a.dispositivo },
      );
      assert.equal(risposta.success, parte, JSON.stringify(licenze));
      if (!parte) assert.equal(risposta.error.code, "premium-richiesto");
      /* In Base, le altre voci si provano: semplici. */
      const campanello = await banco.notifiche.rispondi(
        { id: 4, type: "ponte/notifiche/prova", tipo: "campanello" },
        { dispositivo: banco.a.dispositivo },
      );
      assert.equal(campanello.success, true);
      assert.equal(banco.apri(banco.spinte.at(-1)).stile, "s");
    } finally {
      banco.spegni();
    }
  }
});

test("le prove di fila: nessun limite, e non tolgono posto alle vere", async () => {
  const banco = unBanco();
  try {
    await banco.registra();
    /* Si provano le voci una dopo l'altra, nello stile semplice: prima dalla
     * quarta in poi «non e' partita». */
    const tipi = ["elettrodomestici", "blackout", "movimento", "antifurto"];
    for (let i = 0; i < 40; i += 1) {
      const risposta = await banco.notifiche.rispondi(
        { id: 10 + i, type: "ponte/notifiche/prova", tipo: tipi[i % tipi.length] },
        { dispositivo: banco.a.dispositivo },
      );
      assert.equal(risposta.success, true, `prova ${i + 1}`);
      assert.equal(banco.apri(banco.spinte.at(-1)).stile, "s");
    }
    assert.equal(banco.spinte.length, 40);
    /* Le prove non contano fra le trenta dell'ora: una notifica vera parte. */
    assert.ok(banco.notifiche._cePosto(banco.a.dispositivo.id, { tipo: "movimento" }));
  } finally {
    banco.spegni();
  }
});

test("il tasto di un menu porta la sua voce, e solo quella", async () => {
  const banco = unBanco();
  try {
    await banco.registra();
    await banco.notifiche.consegna({
      tipo: "movimento",
      urgenza: "normale",
      chiave: "m",
      perche: "casa-vuota",
      parole: { it: { titolo: "x", testo: "y" } },
      azioni: [
        {
          id: "inserisci",
          parole: { it: "Inserisci" },
          servizio: {
            dominio: "select",
            servizio: "select_option",
            entita: ["select.modo"],
            dati: { option: "Totale" },
          },
        },
      ],
    });
    const contenuto = banco.apri(banco.spinte.at(-1));
    const detto = await banco.notifiche.rispondi(
      { id: 5, type: "ponte/notifiche/azione", notifica: contenuto.id, azione: "inserisci" },
      { dispositivo: banco.a.dispositivo },
    );
    assert.equal(detto.success, true);
    assert.deepEqual(banco.chiamate.at(-1), {
      type: "call_service",
      domain: "select",
      service: "select_option",
      target: { entity_id: ["select.modo"] },
      service_data: { option: "Totale" },
    });
  } finally {
    banco.spegni();
  }
});
