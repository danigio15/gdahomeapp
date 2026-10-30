/* Le notifiche dette dagli Echo di casa: la parte che decide.
 *
 * «Notifiche verso Alexa? O messaggi da app verso Alexa per comunicare
 * qualcosa a casa?» Qui si tiene ferma la scelta (quali Echo, quali
 * notifiche, quando stare zitti), le parole che si dicono e la chiamata che
 * il ponte fa a Home Assistant.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  ALEXA_DI_SERIE,
  AVVISI_AL_PIU,
  CHIAVE_ALEXA,
  altoparlantiAlexa,
  avvisiDaDire,
  chiamataAlexa,
  daDire,
  nelSilenzio,
  normalizzaAlexa,
  paroleDaDire,
} from "../src/core/alexa-annunci.js";

const alle = (ore, minuti = 0) => new Date(2026, 9, 27, ore, minuti);

test("la casella è della casa, e di serie Alexa sta zitta", () => {
  assert.equal(CHIAVE_ALEXA, "cd_alexa");
  const vuota = normalizzaAlexa(undefined);
  assert.equal(vuota.attivo, false);
  assert.deepEqual(vuota.categorie, ["urgenti"]);
  assert.deepEqual(vuota.silenzio, { da: "23:00", a: "07:00" });
  assert.equal(vuota.modo, "annuncio");
  assert.equal(ALEXA_DI_SERIE.attivo, false);
  assert.equal(normalizzaAlexa("non è json").attivo, false);
});

test("si tengono solo Echo veri, categorie conosciute e orari buoni", () => {
  const conf = normalizzaAlexa(
    JSON.stringify({
      attivo: true,
      altoparlanti: ["media_player.echo_cucina", "light.cucina", "media_player.echo_cucina", "x"],
      categorie: ["urgenti", "casa", "inventata"],
      silenzio: { da: "25:00", a: "07:00" },
      modo: "voce",
    }),
  );
  assert.deepEqual(conf.altoparlanti, ["media_player.echo_cucina"]);
  assert.deepEqual(conf.categorie, ["urgenti", "casa"]);
  assert.deepEqual(
    conf.silenzio,
    { da: "23:00", a: "07:00" },
    "un orario storto torna quello di serie",
  );
  assert.equal(conf.modo, "voce");
  /* Il silenzio si può togliere del tutto. */
  assert.equal(normalizzaAlexa({ silenzio: null }).silenzio, null);
});

test("il silenzio passa la mezzanotte", () => {
  const notte = { da: "23:00", a: "07:00" };
  assert.equal(nelSilenzio(notte, alle(23, 30)), true);
  assert.equal(nelSilenzio(notte, alle(3)), true);
  assert.equal(nelSilenzio(notte, alle(7)), false);
  assert.equal(nelSilenzio(notte, alle(12)), false);
  const pranzo = { da: "13:00", a: "15:00" };
  assert.equal(nelSilenzio(pranzo, alle(14)), true);
  assert.equal(nelSilenzio(pranzo, alle(16)), false);
  assert.equal(nelSilenzio(null, alle(3)), false);
});

test("si dice solo quello che si è scelto, e di notte solo l'urgente", () => {
  const conf = normalizzaAlexa({
    attivo: true,
    altoparlanti: ["media_player.echo_salotto"],
    categorie: ["urgenti", "casa"],
  });
  const lavatrice = { categoria: "casa", urgenza: "normale", tipo: "elettrodomestici" };
  const fumo = { categoria: "urgenti", urgenza: "urgente", tipo: "allarmi" };
  assert.equal(daDire(conf, lavatrice, alle(18)), true);
  assert.equal(daDire(conf, lavatrice, alle(2)), false, "di notte la lavatrice no");
  assert.equal(daDire(conf, fumo, alle(2)), true, "il fumo sì, anche di notte");
  assert.equal(daDire(conf, { categoria: "persone", urgenza: "normale" }, alle(18)), false);
  assert.equal(daDire(conf, { ...lavatrice, tipo: "riepilogo" }, alle(18)), false);
  assert.equal(daDire({ ...conf, attivo: false }, fumo, alle(18)), false);
  assert.equal(daDire({ ...conf, altoparlanti: [] }, fumo, alle(18)), false);
});

test("le parole si dicono senza figurine, e non troppo lunghe", () => {
  assert.equal(
    paroleDaDire("🔥 Fumo in cucina!", "Il sensore 💨 ha visto fumo."),
    "Fumo in cucina. Il sensore ha visto fumo.",
  );
  assert.equal(paroleDaDire("Lavatrice finita", ""), "Lavatrice finita");
  /* Le sigle delle unita' un Echo le legge lettera per lettera: si dicono per esteso. */
  assert.equal(
    paroleDaDire("Lavatrice finita", "In funzione 1 h 32 min · 0,85 kWh · 1500 W, 2,3kW"),
    "Lavatrice finita. In funzione 1 h 32 min, 0,85 chilowattora, 1500 watt, 2,3 chilowatt",
  );
  /* I puntini e gli a capo della notifica diventano virgole e punti. */
  assert.equal(paroleDaDire("Giornata", "Sole 12 kWh\nRete 3 kWh"), "Giornata. Sole 12 chilowattora. Rete 3 chilowattora");
  assert.equal(paroleDaDire("Washer done", "0.85 kWh", "en"), "Washer done. 0.85 kilowatt hours");
  /* Una parola che comincia per W non e' un'unita'. */
  assert.equal(paroleDaDire("Wallbox pronta", ""), "Wallbox pronta");
  const lunga = paroleDaDire("Titolo", "a".repeat(1000));
  assert.ok(lunga.length <= 280);
  assert.ok(lunga.endsWith("…"));
});

test("la chiamata è notify.alexa_media agli Echo scelti", () => {
  const conf = normalizzaAlexa({
    attivo: true,
    altoparlanti: ["media_player.echo_cucina", "media_player.echo_salotto"],
  });
  assert.deepEqual(chiamataAlexa(conf, "Ciao"), {
    type: "call_service",
    domain: "notify",
    service: "alexa_media",
    service_data: {
      message: "Ciao",
      target: ["media_player.echo_cucina", "media_player.echo_salotto"],
      data: { type: "announce" },
    },
  });
  assert.equal(chiamataAlexa({ ...conf, modo: "voce" }, "Ciao").service_data.data.type, "tts");
});

test("gli Echo si riconoscono da last_called, che hanno solo loro", () => {
  const stati = {
    "media_player.echo_cucina": {
      entity_id: "media_player.echo_cucina",
      state: "idle",
      attributes: { friendly_name: "Echo cucina", last_called: false },
    },
    "media_player.sonos": {
      entity_id: "media_player.sonos",
      state: "idle",
      attributes: { friendly_name: "Sonos" },
    },
    "media_player.echo_bagno": {
      entity_id: "media_player.echo_bagno",
      state: "unavailable",
      attributes: { friendly_name: "Echo bagno", last_called: true },
    },
  };
  assert.deepEqual(altoparlantiAlexa(stati), [
    { entita: "media_player.echo_bagno", nome: "Echo bagno", spento: true },
    { entita: "media_player.echo_cucina", nome: "Echo cucina", spento: false },
  ]);
  assert.deepEqual(altoparlantiAlexa(null), []);
});

/* ─── Gli avvisi personalizzati ──────────────────────────────────────── */

const ECHO = "media_player.echo_cucina";
const conAvvisi = (avvisi, altro = {}) =>
  normalizzaAlexa({ attivo: true, altoparlanti: [ECHO], avvisi, ...altro });
/* Martedi' 13 ottobre 2026, nell'ora di questa macchina. */
const il = (ore, minuti = 0, giorno = 13) => new Date(2026, 9, giorno, ore, minuti, 0);

test("un avviso si ripulisce: senza frase non c'e', i giorni restano giorni", () => {
  const conf = normalizzaAlexa({
    avvisi: [
      { frase: "  ", ora: "07:30" },
      { frase: "È ora di andare a scuola", ora: "7:30", giorni: [1, 9, "2", 2] },
      {
        frase: "Garage aperto",
        quando: "stato",
        entita: "cover.garage; rm",
        condizione: "boh",
        per: -4,
      },
    ],
  });
  assert.equal(conf.avvisi.length, 2);
  assert.deepEqual(conf.avvisi[0].giorni, [1, 2]);
  assert.equal(conf.avvisi[0].ora, "08:00");
  assert.equal(conf.avvisi[1].entita, "");
  assert.equal(conf.avvisi[1].condizione, "uguale");
  assert.equal(conf.avvisi[1].per, 0);
  const tanti = normalizzaAlexa({
    avvisi: Array.from({ length: 40 }, (_, i) => ({ frase: `n${i}` })),
  });
  assert.equal(tanti.avvisi.length, AVVISI_AL_PIU);
  assert.deepEqual(normalizzaAlexa(null).avvisi, []);
});

test("a un orario: nei giorni scelti, una volta sola, anche nel silenzio", () => {
  const conf = conAvvisi([{ id: "a_scuola", frase: "Scuola", ora: "07:30", giorni: [2] }], {
    silenzio: { da: "22:00", a: "08:00" },
  });
  const memoria = {};
  assert.equal(avvisiDaDire(conf, {}, il(7, 29), memoria).length, 0);
  const detti = avvisiDaDire(conf, {}, il(7, 31), memoria);
  assert.equal(detti.length, 1);
  assert.deepEqual(detti[0].altoparlanti, [ECHO]);
  assert.equal(avvisiDaDire(conf, {}, il(7, 32), memoria).length, 0);
  /* Troppo tardi: un ponte acceso alle 9 non dice l'avviso delle 7:30. */
  assert.equal(avvisiDaDire(conf, {}, il(9, 0, 20), {}).length, 0);
  /* Un altro giorno della settimana: niente. */
  assert.equal(avvisiDaDire(conf, {}, il(7, 31, 14), {}).length, 0);
  /* Il martedi' dopo, di nuovo. */
  assert.equal(avvisiDaDire(conf, {}, il(7, 31, 20), memoria).length, 1);
});

test("su una cosa di casa: quando resta vera abbastanza, poi solo dopo essere tornata", () => {
  const conf = conAvvisi([
    {
      id: "a_garage",
      frase: "Il garage è aperto",
      quando: "stato",
      entita: "cover.garage",
      condizione: "uguale",
      valore: "open",
      per: 10,
      altoparlanti: ["media_player.echo_sala"],
    },
  ]);
  const memoria = {};
  const stati = (state) => ({ "cover.garage": { state } });
  assert.equal(avvisiDaDire(conf, stati("open"), il(12, 0), memoria).length, 0);
  assert.equal(avvisiDaDire(conf, stati("open"), il(12, 9), memoria).length, 0);
  const detti = avvisiDaDire(conf, stati("open"), il(12, 10), memoria);
  assert.deepEqual(detti[0].altoparlanti, ["media_player.echo_sala"]);
  assert.equal(avvisiDaDire(conf, stati("open"), il(12, 30), memoria).length, 0);
  assert.equal(avvisiDaDire(conf, stati("closed"), il(12, 31), memoria).length, 0);
  assert.equal(avvisiDaDire(conf, stati("open"), il(12, 32), memoria).length, 0);
  assert.equal(avvisiDaDire(conf, stati("open"), il(12, 42), memoria).length, 1);
  /* Di notte sta zitto, e senza Alexa accesa non dice niente. */
  assert.equal(avvisiDaDire(conf, stati("open"), il(2, 0), {}).length, 0);
  assert.equal(avvisiDaDire({ ...conf, attivo: false }, stati("open"), il(12, 0), {}).length, 0);
});

test("le soglie sono numeri quando lo sono", () => {
  const conf = conAvvisi([
    {
      id: "a_caldo",
      frase: "Fa caldo",
      quando: "stato",
      entita: "sensor.t",
      condizione: "sopra",
      valore: "28,5",
    },
  ]);
  assert.equal(avvisiDaDire(conf, { "sensor.t": { state: "28.4" } }, il(12), {}).length, 0);
  assert.equal(avvisiDaDire(conf, { "sensor.t": { state: "29" } }, il(12), {}).length, 1);
  assert.equal(
    avvisiDaDire(conf, { "sensor.t": { state: "unavailable" } }, il(12), {}).length,
    0,
  );
});
