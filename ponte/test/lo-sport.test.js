/* Lo sport, dal ponte: calcio, Formula 1 e MotoGP dalle fonti pubbliche.
 *
 * Le fonti non si chiamano mai: le risposte in `test/sport/` sono quelle vere
 * di un sabato di fine ottobre 2026 (scaricate da GitHub con
 * `strumenti/sport-campioni`), alleggerite dei collegamenti. Quello che si
 * prova e' nostro: che tutto arrivi nella stessa forma, che la squadra
 * seguita sappia se ha vinto, che una partita in corso si legga dalla
 * giornata, che dalla plancia non passi mai un indirizzo.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  CAMPIONATI,
  campionatoValido,
  creaSport,
  partitaDaEspn,
  squadraValida,
} from "../src/sport.js";
import { Commissioni } from "../src/commissioni.js";

const campione = (nome) =>
  JSON.parse(readFileSync(new URL(`./sport/${nome}.json`, import.meta.url)));
/* Sabato 24 ottobre 2026, sera: l'Inter gioca domani alle 12:30. */
const SABATO = Date.UTC(2026, 9, 24, 20, 0, 0);

const RISPOSTE = [
  [/soccer\/all\/teams\/110\/schedule\?fixture=true$/, "calcio-inter-tutte-prossime"],
  [/soccer\/all\/teams\/110\/schedule$/, "calcio-inter-tutte"],
  [/soccer\/ita\.1\/standings$/, "calcio-serie-a-classifica"],
  [/soccer\/ita\.1\/teams$/, "calcio-serie-a-squadre"],
  [/soccer\/ita\.1\/scoreboard\?dates=20261025$/, "calcio-serie-a-giorno"],
  [/f1\/current\/last\/results\.json$/, "f1-ultima-gara"],
  [/f1\/current\/last\/sprint\.json$/, "f1-sprint"],
  [/f1\/current\.json$/, "f1-calendario"],
  [/f1\/current\/driverStandings\.json$/, "f1-piloti"],
  [/f1\/current\/constructorStandings\.json$/, "f1-costruttori"],
  [/results\/seasons$/, "moto-stagioni"],
  [/results\/events\?seasonUuid=[^&]+$/, "moto-eventi"],
  [/results\/categories\?eventUuid=/, "moto-categorie"],
  [/results\/sessions\?eventUuid=/, "moto-sessioni"],
  [
    /results\/session\/[^/]+\/classification/,
    (u) => (u.includes(SPRINT) ? "moto-sprint" : "moto-gara"),
  ],
  [/results\/standings\?/, "moto-classifica"],
];
const SPRINT = campione("moto-sessioni").find((s) => s.type === "SPR").id;

function fonteFinta({ chiamate = [], manca = () => false } = {}) {
  return async (indirizzo) => {
    chiamate.push(indirizzo);
    if (manca(indirizzo)) return { ok: false, status: 503, json: async () => ({}) };
    if (indirizzo.startsWith("https://a.espncdn.com/")) {
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => new Uint8Array([137, 80, 78, 71]).buffer,
      };
    }
    const trovata = RISPOSTE.find(([re]) => re.test(indirizzo));
    if (!trovata) return { ok: false, status: 404, json: async () => ({}) };
    const nome = typeof trovata[1] === "function" ? trovata[1](indirizzo) : trovata[1];
    return { ok: true, status: 200, json: async () => campione(nome) };
  };
}

test("calcio: la squadra seguita, le ultime con l'esito, le prossime e il posto in classifica", async () => {
  const sport = creaSport({ scarica: fonteFinta(), orologio: () => SABATO });
  const [inter] = await sport.risultati([{ tipo: "calcio", campionato: "ita.1", squadra: "110" }]);
  assert.equal(inter.tipo, "calcio");
  assert.equal(inter.squadra.id, "110");
  assert.equal(inter.squadra.nome, "Internazionale");
  assert.equal(inter.campionato.nome, "Serie A");
  /* L'ultima giocata e' la Champions col Shakhtar del 21; prima Bologna-Inter 1-3. */
  assert.equal(inter.ultime[0].competizione, "Champions League");
  const bologna = inter.ultime.find((p) => p.casa.breve === "Bologna");
  assert.equal(bologna.casa.gol, 1);
  assert.equal(bologna.fuori.gol, 3);
  assert.equal(bologna.esito, "V");
  assert.ok(inter.ultime.length <= 5);
  assert.ok(
    inter.ultime.every((p, i, a) => i === 0 || Date.parse(a[i - 1].quando) >= Date.parse(p.quando)),
  );
  /* Domani Inter-Fiorentina alle 11:30 UTC. */
  assert.equal(inter.prossime[0].casa.id, "110");
  assert.equal(inter.prossime[0].fuori.breve, "Fiorentina");
  assert.equal(inter.prossime[0].fase, "prima");
  assert.equal(inter.prossime[0].casa.gol, null);
  assert.equal(inter.posizione.posizione, 1);
  assert.equal(inter.posizione.punti, 19);
  assert.equal(inter.classifica.length, 20);
  assert.equal(inter.dalVivo, null);
});

test("calcio: una partita vicina si rilegge dalla giornata, che dice se e' in corso", async () => {
  const chiamate = [];
  const domani = Date.UTC(2026, 9, 25, 12, 10, 0);
  const giorno = campione("calcio-serie-a-giorno");
  const evento = giorno.events.find((e) => e.shortName === "FIO @ INT");
  /* La partita a meta' del secondo tempo, 2-1. */
  evento.competitions[0].status = {
    displayClock: "67'",
    type: { name: "STATUS_SECOND_HALF", state: "in", shortDetail: "67'" },
  };
  for (const c of evento.competitions[0].competitors) c.score = c.homeAway === "home" ? "2" : "1";
  const base = fonteFinta({ chiamate });
  const scarica = async (u, o) =>
    /scoreboard\?dates=20261025$/.test(u)
      ? { ok: true, status: 200, json: async () => giorno }
      : base(u, o);
  const sport = creaSport({ scarica, orologio: () => domani });
  const inter = await sport.calcio("ita.1", "110");
  assert.ok(chiamate.length >= 3);
  assert.equal(inter.dalVivo.fase, "in");
  assert.equal(inter.dalVivo.minuto, "67'");
  assert.equal(inter.dalVivo.casa.gol, 2);
  assert.equal(inter.dalVivo.fuori.gol, 1);
  assert.notEqual(inter.prossime[0]?.id, inter.dalVivo.id);
});

test("calcio: le squadre di un campionato, in ordine di nome", async () => {
  const sport = creaSport({ scarica: fonteFinta(), orologio: () => SABATO });
  const squadre = await sport.squadre("ita.1");
  assert.equal(squadre.length, 20);
  assert.ok(squadre.some((s) => s.id === "110" && s.nome === "Internazionale"));
  assert.deepEqual(
    squadre.map((s) => s.nome),
    [...squadre.map((s) => s.nome)].sort((a, b) => a.localeCompare(b, "it")),
  );
});

test("Formula 1: ultima gara, sprint, prossimo gran premio con le sessioni, classifiche", async () => {
  const sport = creaSport({ scarica: fonteFinta(), orologio: () => SABATO });
  const [f1] = await sport.risultati([{ tipo: "f1" }]);
  assert.equal(f1.tipo, "f1");
  assert.equal(f1.ultima.nome, "Singapore Grand Prix");
  assert.equal(f1.ultima.risultati[0].sigla, "VER");
  assert.equal(f1.ultima.risultati[0].punti, 25);
  assert.equal(f1.ultima.risultati[0].tempo, "1:42:00.785");
  assert.ok(f1.prossima, "il prossimo gran premio");
  assert.ok(Date.parse(f1.prossima.quando) > SABATO);
  assert.equal(f1.prossima.sessioni.at(-1).sigla, "G");
  assert.ok(f1.prossima.sessioni.some((s) => s.sigla === "Q"));
  assert.equal(f1.piloti[0].cognome, "Antonelli");
  assert.equal(f1.piloti[0].punti, 340);
  assert.equal(f1.costruttori[0].nome, "Mercedes");
  assert.equal(f1.gare, 23);
});

test("MotoGP: la sprint di oggi quando la gara non c'e' ancora, il prossimo GP, la classifica", async () => {
  const sport = creaSport({ scarica: fonteFinta(), orologio: () => SABATO });
  const [moto] = await sport.risultati([{ tipo: "motogp" }]);
  assert.equal(moto.tipo, "motogp");
  assert.equal(moto.ultima.tipo, "SPR");
  assert.equal(moto.ultima.paese, "Australia");
  assert.equal(moto.ultima.risultati[0].nome, "Marc Marquez");
  assert.equal(moto.ultima.risultati[0].numero, "93");
  /* L'evento in corso e' ancora «il prossimo»: la gara e' domani. */
  assert.equal(moto.prossima.paese, "Australia");
  assert.deepEqual(
    moto.prossima.sessioni.map((x) => x.sigla),
    ["Q", "S", "G"],
  );
  assert.equal(moto.ultima.quando, "2026-10-24T15:00:00+00:00");
  assert.ok(moto.piloti.length > 10);
  assert.equal(moto.piloti[0].posizione, 1);
});

test("una fonte che non risponde: le altre arrivano lo stesso, e quello che si sapeva resta", async () => {
  let giu = false;
  let ora = SABATO;
  const sport = creaSport({
    scarica: fonteFinta({ manca: (u) => giu && u.includes("jolpi") }),
    orologio: () => ora,
  });
  const prima = await sport.risultati([{ tipo: "f1" }]);
  assert.equal(prima[0].ultima.nome, "Singapore Grand Prix");
  giu = true;
  ora += 60 * 60_000;
  const dopo = await sport.risultati([
    { tipo: "f1" },
    { tipo: "calcio", campionato: "ita.1", squadra: "110" },
  ]);
  assert.equal(dopo[0].ultima.nome, "Singapore Grand Prix");
  assert.equal(dopo[1].squadra.nome, "Internazionale");
  const nuova = creaSport({
    scarica: fonteFinta({ manca: (u) => u.includes("jolpi") }),
    orologio: () => ora,
  });
  const [rotta, calcio] = await nuova.risultati([
    { tipo: "f1" },
    { tipo: "calcio", campionato: "ita.1", squadra: "110" },
  ]);
  assert.deepEqual(rotta, { tipo: "f1", errore: "non-risponde" });
  assert.equal(calcio.squadra.id, "110");
});

test("la stessa domanda due volte in pochi minuti va fuori una volta sola", async () => {
  const chiamate = [];
  const sport = creaSport({ scarica: fonteFinta({ chiamate }), orologio: () => SABATO });
  await sport.risultati([{ tipo: "f1" }]);
  const dopoLaPrima = chiamate.length;
  await sport.risultati([{ tipo: "f1" }]);
  assert.equal(chiamate.length, dopoLaPrima);
});

test("dalla plancia non passa mai un indirizzo: solo campionati dell'elenco e numeri di squadra", async () => {
  const chiamate = [];
  const sport = creaSport({ scarica: fonteFinta({ chiamate }), orologio: () => SABATO });
  assert.ok(campionatoValido("ita.1"));
  assert.ok(!campionatoValido("ita.1/../../x"));
  assert.ok(!campionatoValido("toString"));
  assert.ok(!campionatoValido("https://altrove.invalid"));
  assert.ok(squadraValida("110"));
  assert.ok(!squadraValida("110/../../x"));
  assert.ok(!squadraValida("110?x=1"));
  assert.ok(!squadraValida(""));
  await assert.rejects(sport.squadre("../../altro"));
  await assert.rejects(sport.logo("1/../../x"));
  const r = await sport.risultati([
    { tipo: "calcio", campionato: "ita.1", squadra: "110#x" },
    { tipo: "calcio", campionato: "http://altrove.invalid", squadra: "110" },
    { tipo: "qualcosa" },
  ]);
  assert.deepEqual(
    r.map((x) => x.errore),
    ["non-risponde", "non-risponde", "sconosciuto"],
  );
  assert.equal(chiamate.length, 0);
  assert.ok(Object.keys(CAMPIONATI).every(campionatoValido));
});

test("al massimo otto cose seguite per domanda", async () => {
  const sport = creaSport({ scarica: fonteFinta(), orologio: () => SABATO });
  const r = await sport.risultati(Array.from({ length: 20 }, () => ({ tipo: "f1" })));
  assert.equal(r.length, 8);
});

test("il logo di una squadra: i byte da ESPN, solo per numero", async () => {
  const chiamate = [];
  const sport = creaSport({ scarica: fonteFinta({ chiamate }), orologio: () => SABATO });
  const logo = await sport.logo("110");
  assert.equal(logo.tipo, "image/png");
  assert.equal(Buffer.from(logo.base64, "base64")[1], 80);
  assert.deepEqual(chiamate, [
    "https://a.espncdn.com/combiner/i?img=/i/teamlogos/soccer/500/110.png&h=128&w=128",
  ]);
});

test("una partita finita ai rigori: vince chi ne ha segnati di piu'", () => {
  const evento = {
    id: "1",
    date: "2026-05-13T19:00Z",
    league: { slug: "ita.coppa_italia" },
    competitions: [
      {
        status: { type: { state: "post", name: "STATUS_FINAL_PEN" } },
        competitors: [
          {
            homeAway: "home",
            score: "1",
            shootoutScore: 4,
            team: { id: "110", displayName: "Internazionale" },
          },
          {
            homeAway: "away",
            score: "1",
            shootoutScore: 5,
            team: { id: "103", displayName: "AC Milan" },
          },
        ],
      },
    ],
  };
  const p = partitaDaEspn(evento, "110");
  assert.equal(p.competizione, "Coppa Italia");
  assert.equal(p.esito, "P");
  assert.equal(partitaDaEspn(evento, "103").esito, "V");
});

test("dal ponte: lo sport risponde solo a chi e' entrato", async () => {
  const chiamate = [];
  const sport = creaSport({ scarica: fonteFinta({ chiamate }), orologio: () => SABATO });
  const commissioni = new Commissioni({ sport });
  const domanda = { id: 7, type: "ponte/sport/risultati", seguiti: [{ tipo: "f1" }] };
  const anonimo = await commissioni.rispondi(domanda, { chiChiede: "" });
  assert.equal(anonimo.success, false);
  assert.equal(anonimo.error.code, "unauthorized");
  assert.equal(chiamate.length, 0);
  const entrato = await commissioni.rispondi(domanda, { chiChiede: "utente-1" });
  assert.equal(entrato.success, true);
  assert.equal(entrato.result.risultati[0].ultima.nome, "Singapore Grand Prix");
  const squadre = await commissioni.rispondi(
    { id: 8, type: "ponte/sport/squadre", campionato: "ita.1" },
    { chiChiede: "utente-1" },
  );
  assert.equal(squadre.result.squadre.length, 20);
  const logo = await commissioni.rispondi(
    { id: 9, type: "ponte/sport/logo", squadra: "110" },
    { chiChiede: "utente-1" },
  );
  assert.deepEqual(Object.keys(logo.result).sort(), ["corpo", "stato", "tipo"]);
  assert.equal(logo.result.stato, 200);
  const storta = await commissioni.rispondi(
    { id: 10, type: "ponte/sport/squadre", campionato: "../../x" },
    { chiChiede: "utente-1" },
  );
  assert.equal(storta.success, false);
  const senzaSport = await new Commissioni({}).rispondi(domanda, { chiChiede: "utente-1" });
  assert.equal(senzaSport.error.code, "unknown_command");
});
