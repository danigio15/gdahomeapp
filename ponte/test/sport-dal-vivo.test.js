/* Lo sport dal vivo: «se l'evento e' iniziato devi mostrare i dati live».
 *
 * `test/sport/f1-dal-vivo.json` e' ESPN durante il gran premio degli Stati
 * Uniti del 25 ottobre 2026, al giro 36 (alleggerito: solo quello che si
 * legge). `moto-dal-vivo-prima.json` e' il cronometraggio della MotoGP prima
 * della gara di Phillip Island: nessuno ha ancora fatto un giro.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  creaSport,
  f1DalVivoDaEspn,
  motoDalVivoDaPulselive,
  sessioneDaGuardare,
} from "../src/sport.js";

const campione = (nome) =>
  JSON.parse(readFileSync(new URL(`./sport/${nome}.json`, import.meta.url)));

/* Domenica 25 ottobre 2026, 21:06 UTC: la gara di Austin e' partita alle 20. */
const IN_GARA = Date.UTC(2026, 9, 25, 21, 6, 0);

const PILOTI = [
  {
    id: "antonelli",
    nome: "Andrea Kimi Antonelli",
    cognome: "Antonelli",
    numero: "12",
    scuderia: "Mercedes",
    scuderiaId: "mercedes",
  },
  {
    id: "leclerc",
    nome: "Charles Leclerc",
    cognome: "Leclerc",
    numero: "16",
    scuderia: "Ferrari",
    scuderiaId: "ferrari",
  },
  {
    id: "hamilton",
    nome: "Lewis Hamilton",
    cognome: "Hamilton",
    numero: "44",
    scuderia: "Ferrari",
    scuderiaId: "ferrari",
  },
];

test("F1 dal vivo da ESPN: la sessione in corso, il giro, l'ordine coi dati del mondiale", () => {
  const v = f1DalVivoDaEspn(campione("f1-dal-vivo"), PILOTI);
  assert.equal(v.tipo, "f1");
  assert.equal(v.sessione, "G");
  assert.equal(v.giro, 36);
  assert.equal(v.ordine.length, 22);
  assert.deepEqual(
    v.ordine.slice(0, 3).map((x) => [x.posizione, x.cognome, x.scuderiaId]),
    [
      [1, "Antonelli", "mercedes"],
      [2, "Leclerc", "ferrari"],
      [3, "Hamilton", "ferrari"],
    ],
  );
  /* Chi non e' nel mondiale resta col nome di ESPN. */
  assert.ok(v.ordine[3].nome && !v.ordine[3].scuderiaId);
});

test("F1 dal vivo: senza una sessione in corso non c'e' niente", () => {
  const finito = structuredClone(campione("f1-dal-vivo"));
  for (const c of finito.events[0].competitions) c.status.type.state = "post";
  assert.equal(f1DalVivoDaEspn(finito, PILOTI), null);
  assert.equal(f1DalVivoDaEspn(null), null);
  /* Le prove libere in corso: l'ordine si', il giro no. */
  const libere = structuredClone(campione("f1-dal-vivo"));
  for (const c of libere.events[0].competitions)
    c.status.type.state = c.type.abbreviation === "FP2" ? "in" : "post";
  const v = f1DalVivoDaEspn(libere, PILOTI);
  assert.equal(v.sessione, "L2");
  assert.equal(v.giro, null);
});

test("MotoGP dal vivo: prima del via niente, poi ordine, distacchi e giri", () => {
  const prima = campione("moto-dal-vivo-prima");
  assert.equal(motoDalVivoDaPulselive(prima), null);
  const corsa = structuredClone(prima);
  const piloti = Object.values(corsa.rider);
  piloti.forEach((x, i) => {
    x.pos = i + 1;
    x.num_lap = 12;
    x.gap_first = i ? (i * 0.731).toFixed(3) : "0.000";
  });
  piloti[2].on_pit = true;
  const v = motoDalVivoDaPulselive(corsa);
  assert.equal(v.sessione, "G");
  assert.equal(v.giro, 12);
  assert.equal(v.giri, 27);
  assert.equal(v.ordine[0].nome, "Marc Marquez");
  assert.equal(v.ordine[0].distacco, "");
  assert.equal(v.ordine[1].distacco, "+0.731");
  assert.equal(v.ordine[2].aiBox, true);
  /* Le classi minori girano sulla stessa pista: non sono la MotoGP. */
  corsa.head.category = "Moto2";
  assert.equal(motoDalVivoDaPulselive(corsa), null);
});

test("la sessione da guardare: dieci minuti prima del via, fino alla fine", () => {
  const sessioni = [
    { sigla: "Q", quando: "2026-10-24T21:00:00Z" },
    { sigla: "G", quando: "2026-10-25T20:00:00Z" },
  ];
  assert.equal(sessioneDaGuardare(sessioni, IN_GARA)?.sigla, "G");
  assert.equal(sessioneDaGuardare(sessioni, Date.UTC(2026, 9, 25, 19, 55))?.sigla, "G");
  assert.equal(sessioneDaGuardare(sessioni, Date.UTC(2026, 9, 25, 19, 0)), null);
  assert.equal(sessioneDaGuardare(sessioni, Date.UTC(2026, 9, 25, 23, 30)), null);
});

test("dal ponte: in gara la F1 porta l'ordine dal vivo; fuori dalle sessioni ESPN non si chiama", async () => {
  const chiamate = [];
  const RISPOSTE = [
    [/f1\/current\/last\/results\.json$/, "f1-ultima-gara"],
    [/f1\/current\/last\/sprint\.json$/, "f1-sprint"],
    [/f1\/current\.json$/, "f1-calendario"],
    [/f1\/current\/driverStandings\.json$/, "f1-piloti"],
    [/f1\/current\/constructorStandings\.json$/, "f1-costruttori"],
    [/racing\/f1\/scoreboard$/, "f1-dal-vivo"],
  ];
  const scarica = async (indirizzo) => {
    chiamate.push(indirizzo);
    const trovata = RISPOSTE.find(([re]) => re.test(indirizzo));
    if (!trovata) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => campione(trovata[1]) };
  };
  const r = await creaSport({ scarica, orologio: () => IN_GARA }).f1();
  assert.equal(r.dalVivo?.sessione, "G");
  assert.equal(r.dalVivo.giro, 36);
  assert.equal(r.dalVivo.ordine[0].scuderiaId, "mercedes");
  assert.ok(chiamate.some((u) => u.includes("racing/f1/scoreboard")));

  const fuori = [];
  const lunedi = Date.UTC(2026, 9, 26, 12, 0);
  const r2 = await creaSport({
    scarica: async (u) => (fuori.push(u), scarica(u)),
    orologio: () => lunedi,
  }).f1();
  assert.equal(r2.dalVivo, undefined);
  assert.ok(!fuori.some((u) => u.includes("racing/f1/scoreboard")));
});
