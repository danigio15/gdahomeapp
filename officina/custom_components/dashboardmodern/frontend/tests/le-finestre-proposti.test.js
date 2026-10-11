/* Le finestre di Energia, Temperatura, Auto e Solare termico.
 *
 * Ognuna e' disegnata sul suo mestiere (vedi `src/sections/finestre/
 * proposti.js`). Qui si chiamano con tessere finte e si guarda cio' che
 * conta: l'ordine, i pezzi che compaiono solo se il dato c'e', e nessun nome
 * grezzo delle integrazioni.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { finestraDi } from "../src/sections/finestre-dei-widget.js";
import {
  autoconsumoDiOggi,
  coloreDeiGradi,
  daDoveArriva,
  fraseDelSolare,
  ruotaDellaRiga,
} from "../src/sections/finestre/proposti.js";

const disegna = (chiave, widget) => finestraDi(chiave).disegna({ key: chiave, ...widget }, {});
const senzaTag = (html) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

test("le quattro finestre si registrano, ognuna col suo stile", () => {
  for (const chiave of ["energia", "temperatura", "ev", "solare"])
    assert.equal(typeof finestraDi(chiave)?.disegna, "function", chiave);
  assert.match(finestraDi("energia").stile, /\.dm-f-energia-eroe/);
});

test("Energia: la casa in grande, da dove arriva, le tre fonti", () => {
  const html = disegna("energia", {
    rows: [
      { group: "house", watts: 900 },
      { group: "solar", watts: 300 },
      { group: "grid", watts: 200 },
      { group: "battery", watts: 400, soc: 64 },
    ],
    oggi: { house: 6.4, solar: 4, gridExport: 1, gridImport: 2 },
  });
  assert.match(html, /dm-f-energia-eroe/);
  assert.equal((html.match(/class="dm-f-energia-fonte"/g) || []).length, 3);
  assert.match(html, /--p:64/);
  // Il sole prima, poi la batteria, poi la rete.
  const ordine = [...html.matchAll(/data-fonte="(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(ordine, ["solar", "grid", "battery"]);
  // 4 kWh prodotti, 1 dato via: tre quarti sono rimasti in casa.
  assert.match(senzaTag(html), /75%/);
  // Nessun prezzo scritto: la spesa non si inventa.
  assert.doesNotMatch(html, /Spesa stimata|Estimated cost|€/);
});

test("Energia: la spesa esce solo col prezzo scritto e il prelievo di oggi", () => {
  const conPrezzo = disegna("energia", {
    rows: [{ group: "house", watts: 500 }],
    oggi: { gridImport: 2 },
    prezzoKwh: 0.3,
  });
  assert.match(senzaTag(conPrezzo), /0[,.]60 €/);
  const senzaPrelievo = disegna("energia", {
    rows: [{ group: "house", watts: 500 }],
    oggi: {},
    prezzoKwh: 0.3,
  });
  assert.doesNotMatch(senzaPrelievo, /€/);
  // Senza i due numeri del giorno, la sezione «Oggi» non c'e' proprio.
  assert.doesNotMatch(senzaPrelievo, /dm-f-energia-giorno/);
});

test("da dove arriva: conta solo cio' che entra in casa", () => {
  // Il sole basta da solo: la batteria che si carica non e' una fonte.
  assert.deepEqual(
    daDoveArriva({ casa: 300, sole: 800, batteria: -400, rete: -100 }).map((q) => [
      q.fonte,
      Math.round(q.quota),
    ]),
    [["solar", 100]],
  );
  const misto = daDoveArriva({ casa: 1000, sole: 250, batteria: 500, rete: 250 });
  assert.deepEqual(
    misto.map((q) => [q.fonte, Math.round(q.quota)]),
    [
      ["solar", 25],
      ["battery", 50],
      ["grid", 25],
    ],
  );
  assert.deepEqual(daDoveArriva({ casa: 0, sole: null, batteria: null, rete: 0 }), []);
  assert.equal(autoconsumoDiOggi({ solar: 0, gridExport: 0 }), null);
  assert.equal(autoconsumoDiOggi({ solar: 5 }), null);
});

test("Temperatura: dalla piu' calda, con l'umidita' alta in arancio", () => {
  const html = disegna("temperatura", {
    rows: [
      { name: "Studio", temperature: 23.7, humidity: 61 },
      { name: "Locale tecnico", temperature: 18.4, humidity: 74 },
      { name: "Lavanderia", temperature: 25.5, humidity: null },
    ],
  });
  const nomi = [...html.matchAll(/dm-f-temperatura-nome"><b>([^<]+)</g)].map((m) => m[1]);
  assert.deepEqual(nomi, ["Lavanderia", "Studio", "Locale tecnico"]);
  assert.equal((html.match(/data-alta="true"/g) || []).length, 1);
  // Senza umidita' la goccia non c'e'.
  assert.equal((html.match(/💧/g) || []).length, 2);
  assert.equal(coloreDeiGradi(18.4), "#38bdf8");
  assert.equal(coloreDeiGradi(25.5), "#ef4444");
  assert.equal(coloreDeiGradi(78, true), "#ef4444");
});

const AUTO = {
  vetture: [
    {
      nome: "Leapmotor B10",
      percentuale: 32,
      km: 138,
      kw: 7.2,
      target: 80,
      inCarica: true,
      ricarica: "In carica",
      fine: "4H 40M alla fine",
    },
  ],
  rows: [
    { ruolo: "carica", name: "Carica", value: "32%", vettura: "Leapmotor B10" },
    { ruolo: "autonomia", name: "Autonomia", value: "138 km", vettura: "Leapmotor B10" },
    {
      rif: "dm.ev_pneumatico_ant_sx",
      name: "LEAPMOTOR B10 TIRE FL",
      raw: 2.2,
      value: "2,2 bar",
      vettura: "Leapmotor B10",
    },
    {
      rif: "dm.ev_pneumatici",
      entity: "sensor.leapmotor_b10_tire_rr",
      name: "LEAPMOTOR B10 TIRE RR",
      raw: 2.3,
      value: "2,3 bar",
      vettura: "Leapmotor B10",
    },
    {
      rif: "dm.ev_finestrini",
      name: "LEAPMOTOR B10 WINDOW FRONT",
      raw: 0,
      value: "0 %",
      vettura: "Leapmotor B10",
    },
    {
      rif: "dm.ev_posizione",
      name: "LEAPMOTOR B10 LOCATION",
      stato: "home",
      value: "In casa",
      vettura: "Leapmotor B10",
    },
    {
      rif: "dm.ev_temperatura_esterna",
      name: "LEAPMOTOR B10 OUTSIDE TEMPERATURE",
      raw: 14,
      value: "14 °C",
      vettura: "Leapmotor B10",
    },
    { rif: "dm.ev_potenza_wallbox", name: "Wallbox", raw: 7200, value: "7200 W", diCasa: true },
  ],
};

test("Auto: anello, chip della ricarica, gomme riconosciute e niente nomi grezzi", () => {
  const html = disegna("ev", AUTO);
  const testo = senzaTag(html);
  assert.match(html, /dm-f-ev-anello/);
  assert.match(testo, /7,2 kW/);
  // «4H 40M» della tessera, in mezzo a una frase si scrive piano.
  assert.match(testo, /4\sh\s40\smin alla fine/);
  // Due gomme riconosciute: dal riferimento e dal nome dell'entita'.
  assert.equal((html.match(/class="dm-f-ev-g"><|class="dm-f-ev-g">[^<]/g) || []).length, 2);
  assert.match(testo, /Ant\. sx 2,2 bar/);
  assert.match(testo, /Post\. dx 2,3 bar/);
  // Il finestrino chiuso non si dice.
  assert.doesNotMatch(testo, /WINDOW|Finestrini/);
  assert.doesNotMatch(testo, /LEAPMOTOR|TIRE/);
  assert.match(testo, /Fuori/);
  // La colonnina e' della casa: ha la sua sezione.
  assert.match(testo, /La wallbox/);
});

test("le gomme si riconoscono solo quando si capisce quale ruota sono", () => {
  assert.equal(ruotaDellaRiga({ rif: "dm.ev_pneumatico_post_dx" }), "rr");
  assert.equal(ruotaDellaRiga({ entity: "sensor.car_tire_fl" }), "fl");
  assert.equal(ruotaDellaRiga({ name: "Pressione pneumatico anteriore destro" }), "fr");
  assert.equal(ruotaDellaRiga({ name: "Tyre pressure rear left" }), "rl");
  assert.equal(ruotaDellaRiga({ name: "Tyre pressure" }), "");
  assert.equal(ruotaDellaRiga({ name: "Front left door" }), "");
});

test("Solare termico: schema, frase, stati coi nomi dei tasti, niente obiettivi inventati", () => {
  const html = disegna("solare", {
    rows: [
      { ref: "dm.boiler_sonda_temperatura_1", raw: 17.1, value: "17,1°", name: "Temp pannello" },
      { ref: "dm.boiler_sonda_temperatura_3", raw: 37.5, value: "37,5°", name: "Temp boiler" },
      { ref: "dm.boiler_delta_temperatura", raw: -21, value: "-21,0°", name: "BOILER_OFFSET" },
      { ref: "dm.boiler_pressione_acqua", raw: 2.5, value: "2,5 bar", name: "Pressione" },
      { ref: "dm.boiler_interruttore_boiler", on: true, value: "Acceso", name: "Boiler" },
      { ref: "dm.boiler_stato_pompa_solare", on: false, value: "Spento", name: "Solare Termico" },
      { ref: "dm.boiler_pompa_solare", on: false, value: "Spento", name: "Pompa (comando)" },
      {
        ref: "dm.boiler_valvola_di_sicurezza",
        on: false,
        value: "Spento",
        name: "Valvola di Sicurezza",
      },
    ],
  });
  const testo = senzaTag(html);
  assert.equal((html.match(/class="dm-f-solare-nodo"/g) || []).length, 2);
  assert.match(testo, /−21°/);
  assert.match(testo, /più freddo del boiler/);
  assert.doesNotMatch(testo, /BOILER_OFFSET|obiettivo|Delta acceso/i);
  // La pompa una volta sola, anche se ha due caselle.
  assert.equal((testo.match(/Pompa solare/g) || []).length, 1);
  const stati = [...html.matchAll(/<b>([^<]+)<\/b>\s*<span class="dm-f-solare-st-s">([^<]+)</g)].map(
    (m) => [m[1], m[2]],
  );
  assert.deepEqual(stati, [
    ["Boiler", "Acceso"],
    ["Pompa solare", "Ferma"],
    ["Valvola di sicurezza", "Chiusa"],
  ]);
});

test("Solare termico: senza pannello niente schema a due e niente frase", () => {
  const html = disegna("solare", {
    rows: [{ ref: "dm.boiler_temperatura", raw: 50, value: "50,0°", name: "Boiler" }],
  });
  assert.equal((html.match(/class="dm-f-solare-nodo"/g) || []).length, 1);
  assert.doesNotMatch(html, /dm-f-solare-frase|dm-f-solare-filo/);
  assert.equal(fraseDelSolare(null, 40, false), "");
});
