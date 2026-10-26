/* L'hockey nello Sport: la NHL, da ESPN come il calcio.
 *
 * `test/sport/hockey-florida.json` e' il calendario dei Florida Panthers del
 * 26 ottobre 2026 (sei giocate e sei prossime), `hockey-classifica.json` la
 * classifica NHL dello stesso giorno, `hockey-squadre.json` le 32 squadre:
 * alleggeriti, con solo quello che si legge. Le leghe italiane non ci sono:
 * non hanno una fonte pubblica coi dati.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  classificaDiHockey,
  creaSport,
  hockeyDaEspn,
  legaHockeyValida,
  partitaDiHockey,
  stemmaHockeyValido,
} from "../src/sport.js";

const campione = (nome) =>
  JSON.parse(readFileSync(new URL(`./sport/${nome}.json`, import.meta.url)));

const FLORIDA = "26";

test("la squadra di hockey: le ultime, le prossime, il posto nella sua conference", () => {
  const r = hockeyDaEspn({
    id: FLORIDA,
    calendario: campione("hockey-florida"),
    classifica: campione("hockey-classifica"),
  });
  assert.equal(r.tipo, "hockey");
  assert.deepEqual(r.campionato, { id: "nhl", nome: "NHL · Eastern Conference" });
  assert.equal(r.squadra.nome, "Florida Panthers");
  assert.equal(r.squadra.stemma, "nhl:fla");
  assert.equal(r.ultime.length, 5);
  assert.deepEqual(
    r.ultime.map((p) => [p.casa.sigla, p.casa.gol, p.fuori.sigla, p.fuori.gol, p.esito]),
    [
      ["CHI", 2, "FLA", 3, "V"],
      ["PIT", 4, "FLA", 0, "P"],
      ["OTT", 5, "FLA", 1, "P"],
      ["FLA", 8, "SEA", 3, "V"],
      ["FLA", 3, "VAN", 2, "V"],
    ],
  );
  /* Vinta ai supplementari: si dice. */
  assert.equal(r.ultime[4].supplementari, "OT");
  assert.equal(r.prossime.length, 5);
  assert.ok(r.prossime.every((p) => p.fase === "prima" && p.competizione === "NHL"));
  /* La classifica e' quella della sua conference, per punti. */
  assert.equal(r.classifica.length, 16);
  assert.deepEqual(
    r.classifica.slice(0, 3).map((x) => [x.posizione, x.sigla, x.punti]),
    [
      [1, "CAR", 20],
      [2, "BOS", 19],
      [3, "OTT", 16],
    ],
  );
  assert.equal(r.posizione.posizione, 9);
  assert.equal(r.posizione.punti, 14);
  /* Di una partita di hockey il dettaglio non c'e': senza lega non si tocca. */
  assert.ok(r.ultime.every((p) => p.lega === ""));
});

test("la classifica di una squadra dell'ovest e' l'ovest", () => {
  const ovest = classificaDiHockey(campione("hockey-classifica"), "25");
  assert.equal(ovest.nome, "Western Conference");
  assert.ok(ovest.righe.some((r) => r.sigla === "ANA"));
  assert.ok(!ovest.righe.some((r) => r.sigla === "FLA"));
});

test("una partita in corso dice il periodo, e il dettaglio della lega non si tocca", () => {
  const evento = structuredClone(campione("hockey-florida").events.at(-1));
  const gara = evento.competitions[0];
  gara.status.type = {
    name: "STATUS_IN_PROGRESS",
    state: "in",
    shortDetail: "12:34 - 2nd",
  };
  for (const c of gara.competitors) c.score = "1";
  const p = partitaDiHockey(evento, FLORIDA);
  assert.equal(p.fase, "in");
  assert.equal(p.minuto, "12:34 - 2nd");
  assert.equal(p.casa.gol, 1);
  assert.equal(p.lega, "");
});

test("solo la NHL, e gli stemmi solo con la sigla", () => {
  assert.equal(legaHockeyValida("nhl"), true);
  assert.equal(legaHockeyValida("ita.1"), false);
  assert.equal(legaHockeyValida("khl"), false);
  assert.equal(stemmaHockeyValido("nhl:fla"), true);
  assert.equal(stemmaHockeyValido("nhl:../x"), false);
  assert.equal(stemmaHockeyValido("26"), false);
});

test("dal ponte: le squadre della NHL, i risultati, e lo stemma per sigla", async () => {
  const chiamate = [];
  const RISPOSTE = [
    [/hockey\/nhl\/teams$/, "hockey-squadre"],
    [/hockey\/nhl\/teams\/26\/schedule$/, "hockey-florida"],
    [/hockey\/nhl\/standings$/, "hockey-classifica"],
  ];
  const scarica = async (indirizzo) => {
    chiamate.push(indirizzo);
    if (indirizzo.endsWith("/nhl/500/fla.png"))
      return { ok: true, status: 200, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
    const trovata = RISPOSTE.find(([re]) => re.test(indirizzo));
    if (!trovata) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => campione(trovata[1]) };
  };
  const sport = creaSport({ scarica, orologio: () => Date.UTC(2026, 9, 26, 12) });
  const squadre = await sport.squadre("nhl");
  assert.equal(squadre.length, 32);
  assert.equal(squadre.find((s) => s.sigla === "FLA").stemma, "nhl:fla");

  const [r] = await sport.risultati([{ tipo: "hockey", campionato: "nhl", squadra: "26" }]);
  assert.equal(r.tipo, "hockey");
  assert.equal(r.squadra.nome, "Florida Panthers");

  const [no] = await sport.risultati([{ tipo: "hockey", campionato: "ita.1", squadra: "26" }]);
  assert.equal(no.errore, "non-risponde");

  const logo = await sport.logo("nhl:fla");
  assert.deepEqual(logo, { tipo: "image/png", base64: "AQID" });
  assert.ok(chiamate.includes("https://a.espncdn.com/i/teamlogos/nhl/500/fla.png"));
  await assert.rejects(sport.logo("nhl:../../x"));
});
