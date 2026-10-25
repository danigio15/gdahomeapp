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
  scuderiaValida,
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
  [/soccer\/uefa\.champions\/standings$/, "calcio-champions-classifica"],
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
    (u) => (u.includes(SPRINT) ? "moto-sprint" : u.includes(Q2) ? "moto-q2" : "moto-gara"),
  ],
  [/results\/standings\?/, "moto-classifica"],
  [/soccer\/ita\.1\/summary\?event=\d+$/, "calcio-partita"],
  [/f1\/current\/17\/qualifying\.json$/, "f1-ultime-qualifiche"],
];
const SPRINT = campione("moto-sessioni").find((s) => s.type === "SPR").id;
const Q2 = campione("moto-sessioni").find((s) => s.type === "Q" && s.number === 2).id;

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
  /* I nomi brevi come si dicono qui: Inter, Milan, Roma. */
  assert.equal(inter.squadra.breve, "Inter");
  assert.ok(inter.classifica.some((r) => r.breve === "Milan"));
  assert.ok(inter.classifica.some((r) => r.breve === "Roma"));
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

test("una fonte che non si raggiunge (rete giu', tempo scaduto) non cancella quello che si sapeva", async () => {
  let giu = false;
  let ora = SABATO;
  const buona = fonteFinta();
  const sport = creaSport({
    scarica: async (u, o) => {
      if (giu && u.includes("jolpi")) throw new TypeError("fetch failed");
      return buona(u, o);
    },
    orologio: () => ora,
  });
  const [prima] = await sport.risultati([{ tipo: "f1" }]);
  assert.equal(prima.ultima.nome, "Singapore Grand Prix");
  giu = true;
  ora += 60 * 60_000;
  const [dopo] = await sport.risultati([{ tipo: "f1" }]);
  assert.equal(dopo.errore, undefined);
  assert.equal(dopo.ultima.nome, "Singapore Grand Prix");
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

/* «Se clicco sulla sessione di qualifica trascorsa voglio vedere i risultati;
 * idem sulle ultime partite: chi ha segnato, eccetera.» */
test("il dettaglio di una partita: marcatori, cartellini, cambi, formazioni, statistiche", async () => {
  const sport = creaSport({ scarica: fonteFinta(), orologio: () => SABATO });
  const p = await sport.dettaglio({ tipo: "calcio", lega: "ita.1", id: "740000" });
  assert.equal(p.casa.breve, "Inter");
  assert.equal(`${p.casa.gol}-${p.ospite.gol}`, "4-1");
  assert.equal(p.fase, "finita");
  assert.equal(p.stadio, "San Siro");
  const gol = p.eventi.filter((e) => e.tipo === "gol");
  assert.equal(gol.length, 5);
  assert.deepEqual(gol[0], {
    minuto: "6'",
    tipo: "gol",
    lato: "casa",
    chi: "Hakan Çalhanoglu",
    assist: "Andy Diouf",
  });
  assert.equal(gol[1].lato, "ospite");
  assert.ok(p.eventi.some((e) => e.tipo === "giallo"));
  assert.ok(p.eventi.some((e) => e.tipo === "cambio" && e.entra && e.esce));
  assert.equal(p.formazioni.casa.modulo, "3-5-2");
  assert.equal(p.formazioni.casa.titolari.length, 11);
  assert.equal(p.formazioni.casa.titolari[0].ruolo, "G");
  assert.deepEqual(p.statistiche[0], { chiave: "possesso", casa: "70.5", ospite: "29.5" });
});

test("il dettaglio di una sessione: qualifiche di F1 coi tre turni, Q2 di MotoGP coi distacchi", async () => {
  const sport = creaSport({ scarica: fonteFinta(), orologio: () => SABATO });
  const q = await sport.dettaglio({ tipo: "f1", giro: 17, sessione: "Q" });
  assert.equal(q.nome, "Singapore Grand Prix");
  assert.equal(q.risultati[0].cognome, "Verstappen");
  assert.equal(q.risultati[0].q3, "1:31.373");
  assert.equal(q.risultati[0].tempo, "1:31.373");
  const m = await sport.dettaglio({ tipo: "motogp", sessione: Q2 });
  assert.equal(m.risultati[0].nome, "Marc Marquez");
  assert.equal(m.risultati[1].distacco, "+1.494");
});

test("il dettaglio: dalla plancia passano solo leghe, numeri, giri e identificativi di sessione", async () => {
  const chiamate = [];
  const sport = creaSport({ scarica: fonteFinta({ chiamate }), orologio: () => SABATO });
  for (const storto of [
    { tipo: "calcio", lega: "../x", id: "1" },
    { tipo: "calcio", lega: "ita.1", id: "1&x=2" },
    { tipo: "f1", giro: 99, sessione: "Q" },
    { tipo: "f1", giro: 17, sessione: "FP1" },
    { tipo: "motogp", sessione: "../../x" },
    { tipo: "altro" },
  ])
    await assert.rejects(sport.dettaglio(storto));
  assert.equal(chiamate.length, 0);
});

test("dal ponte: il dettaglio lo vede solo chi e' entrato", async () => {
  const sport = creaSport({ scarica: fonteFinta(), orologio: () => SABATO });
  const commissioni = new Commissioni({ sport });
  const domanda = {
    id: 11,
    type: "ponte/sport/dettaglio",
    cosa: { tipo: "f1", giro: 17, sessione: "Q" },
  };
  const anonimo = await commissioni.rispondi(domanda, { chiChiede: "" });
  assert.equal(anonimo.error.code, "unauthorized");
  const entrato = await commissioni.rispondi(domanda, { chiChiede: "utente-1" });
  assert.equal(entrato.result.dettaglio.risultati[0].cognome, "Verstappen");
});

test("MotoGP: le sessioni del fine settimana si possono toccare, coi loro identificativi", async () => {
  const sport = creaSport({ scarica: fonteFinta(), orologio: () => SABATO });
  const m = await sport.motogp();
  const sigle = m.ultima.tutte.map((s) => s.sigla);
  assert.deepEqual(sigle, ["FP1", "PR", "FP2", "Q1", "Q2", "S", "G"]);
  assert.ok(m.ultima.tutte.every((s) => /^[0-9a-f-]{36}$/.test(s.id)));
});

test("calcio: la squadra che gioca la Champions ha il suo blocco, con la classifica e le partite di coppa", async () => {
  const chiamate = [];
  const sport = creaSport({ scarica: fonteFinta({ chiamate }), orologio: () => SABATO });
  const [inter] = await sport.risultati([{ tipo: "calcio", campionato: "ita.1", squadra: "110" }]);
  assert.equal(inter.coppe.length, 1);
  const [coppa] = inter.coppe;
  assert.equal(coppa.lega, "uefa.champions");
  assert.equal(coppa.nome, "Champions League");
  assert.equal(coppa.classifica.length, 36);
  assert.equal(coppa.posizione.id, "110");
  assert.ok(coppa.posizione.posizione >= 1 && coppa.posizione.posizione <= 36);
  /* Le zone: chi passa agli ottavi, chi va agli spareggi, chi esce. */
  assert.equal(coppa.classifica[0].zona.chiave, "ottavi");
  assert.equal(coppa.classifica[12].zona.chiave, "spareggi");
  assert.equal(coppa.classifica[35].zona.chiave, "fuori");
  assert.match(coppa.classifica[0].zona.colore, /^#[0-9a-f]{6}$/i);
  /* Solo partite di coppa, la piu' recente prima. */
  assert.ok(coppa.ultime.length >= 1);
  assert.ok([...coppa.ultime, ...coppa.prossime].every((p) => p.lega === "uefa.champions"));
  assert.ok(Date.parse(coppa.ultime[0].quando) >= Date.parse(coppa.ultime.at(-1).quando));
  /* Le coppe che non gioca non si chiedono nemmeno. */
  assert.ok(chiamate.some((u) => u.endsWith("/uefa.champions/standings")));
  assert.ok(!chiamate.some((u) => u.includes("uefa.europa")));
  /* Anche la classifica del campionato ha le sue zone. */
  assert.equal(inter.classifica[0].zona.chiave, "champions");
});

test("calcio: senza la classifica della coppa il blocco c'e' lo stesso, con le partite", async () => {
  const sport = creaSport({
    scarica: fonteFinta({ manca: (u) => u.includes("uefa.champions/standings") }),
    orologio: () => SABATO,
  });
  const [inter] = await sport.risultati([{ tipo: "calcio", campionato: "ita.1", squadra: "110" }]);
  assert.equal(inter.coppe[0].classifica.length, 0);
  assert.equal(inter.coppe[0].posizione, null);
  assert.ok(inter.coppe[0].ultime.length >= 1);
});

test("il simbolo di una scuderia di F1: solo quelle dell'elenco, l'anno prima se quest'anno manca", async () => {
  for (const no of ["f1:", "f1:topolino", "f1:../x", "f1:MERCEDES", "mercedes", null, 42])
    assert.equal(scuderiaValida(no), false);
  assert.equal(scuderiaValida("f1:red_bull"), true);

  const chiamate = [];
  const scarica = async (indirizzo) => {
    chiamate.push(indirizzo);
    if (!indirizzo.startsWith("https://media.formula1.com/") || indirizzo.includes("/2026/"))
      return { ok: false, status: 404 };
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () => new Uint8Array([82, 73, 70, 70]).buffer,
    };
  };
  const sport = creaSport({ scarica, orologio: () => SABATO });
  const simbolo = await sport.logo("f1:red_bull");
  assert.equal(simbolo.tipo, "image/webp");
  assert.equal(Buffer.from(simbolo.base64, "base64")[0], 82);
  assert.deepEqual(
    chiamate.map((u) => u.replace(/^.*\/common\/f1\//, "")),
    [
      "2026/redbullracing/2026redbullracinglogowhite.webp",
      "2025/redbullracing/2025redbullracinglogowhite.webp",
    ],
  );
  /* La seconda volta non si chiede di nuovo, e uno che non c'e' non va fuori. */
  await sport.logo("f1:red_bull");
  await assert.rejects(sport.logo("f1:topolino"));
  assert.equal(chiamate.length, 3);
});

test("una sessione di F1 non ancora pubblicata non e' un guasto: la plancia lo dice", async () => {
  const scarica = async (indirizzo) =>
    /f1\/current\/18\/qualifying\.json$/.test(indirizzo)
      ? {
          ok: true,
          status: 200,
          json: async () => ({ MRData: { RaceTable: { season: "2026", round: "18", Races: [] } } }),
        }
      : { ok: false, status: 404, json: async () => ({}) };
  const sport = creaSport({ scarica, orologio: () => SABATO });
  const d = await sport.dettaglio({ tipo: "f1", giro: 18, sessione: "Q" });
  assert.deepEqual(d, { tipo: "f1", sessione: "Q", giro: 18, risultati: [], nonAncora: true });
  /* Una fonte che non risponde resta un errore. */
  await assert.rejects(sport.dettaglio({ tipo: "f1", giro: 19, sessione: "Q" }));
});
