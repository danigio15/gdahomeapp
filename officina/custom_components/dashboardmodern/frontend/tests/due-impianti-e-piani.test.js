/* «Come sai ho la casa divisa in due impianti, questo è quello della zona
 *  giorno e mi ha messo in automatico anche il bagno dove c'è la lavatrice e
 *  l'esterno, ma non sono configurati.» — «Poi le soglie ho visto che sono in
 *  comune, anche queste andrebbero divise, io ho due contatori.»
 *
 * Tre cose da difendere:
 *  · un elettrodomestico va nel flusso del SUO impianto — scritto, dedotto dal
 *    carico con la stessa potenza, o dal piano coperto — e uno che non si sa
 *    dove stia non va in nessuno;
 *  · ogni contatore ha la sua soglia, confrontata coi suoi numeri: la vecchia
 *    resta al primo livello ed è del primo impianto;
 *  · i piani, se l'impianto li chiede, fondono le stanze in un cerchio solo.
 * E chi ha un impianto solo non si accorge di niente.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  DA_CARICO,
  DA_PIANO,
  DA_SCRITTO,
  DA_UNICO,
  PRIMO_IMPIANTO,
  assegnaElettrodomestico,
  cerchiDalleStanzeAccesi,
  elettrodomesticiDaAssegnare,
  elettrodomesticiDellImpianto,
  impiantoDellElettrodomestico,
  pianiDellImpianto,
  pianiNelFlusso,
  plantList,
} from "../src/core/energy-plants.js";
import {
  LIVELLO_AMBRA,
  LIVELLO_QUIETE,
  LIVELLO_ROSSA,
  SOGLIE_PER_IMPIANTO,
  conLaSogliaDellImpianto,
  ilVerdettoPeggiore,
  qualcheSogliaScritta,
  sogliaDellImpianto,
  verdettiDegliImpianti,
} from "../src/core/la-soglia-della-potenza.js";
import { CERCHIO_ALTRO, cerchiDelleStanze } from "../src/core/i-cerchi-delle-stanze.js";

const DUE = plantList({
  name: "Zona Giorno",
  house: { power: "sensor.giorno_w" },
  plants: [
    {
      id: "impianto-2",
      name: "Zona Notte",
      house: { power: "sensor.notte_w" },
      metadata: { piani: ["Primo piano"] },
    },
  ],
});

const STANZE = [
  { id: "soggiorno", name: "Soggiorno", floor: "Piano terra" },
  { id: "cucina", name: "Cucina", floor: "Piano terra" },
  { id: "bagno", name: "Bagno", floor: "Primo piano" },
  { id: "esterno", name: "Esterno" },
];

const CARICHI = [
  { id: "lava", name: "Lavatrice", power_entity: "sensor.lava_w", plant: "impianto-2" },
  { id: "server", name: "Server", power_entity: "sensor.server_w" },
];

const contesto = { impianti: DUE, carichi: CARICHI, stanze: STANZE };

test("con un impianto solo ogni elettrodomestico è suo, come sempre", () => {
  const uno = plantList({ house: { power: "sensor.casa" } });
  const voce = { name: "Lavatrice", room_id: "bagno" };
  assert.deepEqual(impiantoDellElettrodomestico(voce, { impianti: uno }), {
    id: PRIMO_IMPIANTO,
    da: DA_UNICO,
  });
  assert.equal(elettrodomesticiDellImpianto([voce], uno[0], { impianti: uno }).length, 1);
  assert.deepEqual(elettrodomesticiDaAssegnare([voce], { impianti: uno }), []);
});

test("scritto, dal carico, dal piano: in quest'ordine", () => {
  assert.deepEqual(
    impiantoDellElettrodomestico({ name: "Frigo", plant: PRIMO_IMPIANTO, room_id: "bagno" }, contesto),
    { id: PRIMO_IMPIANTO, da: DA_SCRITTO },
  );
  assert.deepEqual(
    impiantoDellElettrodomestico(
      { name: "Lavatrice", power_entity: "sensor.lava_w", room_id: "soggiorno" },
      contesto,
    ),
    { id: "impianto-2", da: DA_CARICO },
  );
  /* Un carico senza campo è del primo: la stessa potenza porta lì. */
  assert.deepEqual(
    impiantoDellElettrodomestico({ name: "Server", power_entity: "sensor.server_w" }, contesto),
    { id: PRIMO_IMPIANTO, da: DA_CARICO },
  );
  assert.deepEqual(
    impiantoDellElettrodomestico({ name: "Phon", power_entity: "sensor.phon_w", room_id: "bagno" }, contesto),
    { id: "impianto-2", da: DA_PIANO },
  );
});

test("senza niente non si indovina: l'elettrodomestico non va in nessun flusso", () => {
  const pompa = { name: "Pompa", power_entity: "sensor.pompa_w", room_id: "esterno" };
  assert.deepEqual(impiantoDellElettrodomestico(pompa, contesto), { id: "", da: "" });
  for (const impianto of DUE)
    assert.equal(elettrodomesticiDellImpianto([pompa], impianto, contesto).length, 0);
  /* E il config lo chiede: senza impianto, e quelli solo dedotti da confermare. */
  const lista = [
    pompa,
    { name: "Lavatrice", power_entity: "sensor.lava_w", room_id: "bagno" },
    { name: "Frigo", plant: PRIMO_IMPIANTO },
  ];
  const daFare = elettrodomesticiDaAssegnare(lista, contesto);
  assert.deepEqual(
    daFare.map((voce) => [voce.device.name, voce.id, voce.da]),
    [
      ["Pompa", "", ""],
      ["Lavatrice", "impianto-2", DA_CARICO],
    ],
  );
  /* Confermato, l'impianto è scritto. */
  const confermata = assegnaElettrodomestico(lista, 1, "impianto-2");
  assert.equal(confermata[1].plant, "impianto-2");
  assert.equal(impiantoDellElettrodomestico(confermata[1], contesto).da, DA_SCRITTO);
});

test("il bagno con la lavatrice non entra più nella zona giorno", () => {
  /* Il caso del tester: lavatrice nel bagno (zona notte), pompa fuori. */
  const apparecchi = [
    { name: "Lavatrice", power_entity: "sensor.lava_w", room_id: "bagno" },
    { name: "Pompa", power_entity: "sensor.pompa_w", room_id: "esterno" },
    { name: "Forno", power_entity: "sensor.forno_w", room_id: "cucina", plant: PRIMO_IMPIANTO },
  ];
  const giorno = cerchiDelleStanze({
    loads: CARICHI.filter((voce) => !voce.plant),
    appliances: elettrodomesticiDellImpianto(apparecchi, DUE[0], contesto),
    rooms: STANZE,
  });
  const nomi = giorno.loads.filter((voce) => voce.metadata?.cerchio_della_stanza).map((voce) => voce.name);
  assert.ok(nomi.includes("Cucina"));
  assert.ok(!nomi.includes("Bagno"));
  assert.ok(!nomi.includes("Esterno"));
  const notte = elettrodomesticiDellImpianto(apparecchi, DUE[1], contesto);
  assert.deepEqual(
    notte.map((voce) => voce.name),
    ["Lavatrice"],
  );
});

test("i metadati dell'impianto: piani, cerchi automatici, piani nel flusso", () => {
  assert.deepEqual(pianiDellImpianto(DUE[1]), ["Primo piano"]);
  assert.deepEqual(pianiDellImpianto(DUE[0]), []);
  assert.equal(cerchiDalleStanzeAccesi(DUE[0]), true);
  assert.equal(cerchiDalleStanzeAccesi({ metadata: { cerchi_dalle_stanze: false } }), false);
  assert.equal(pianiNelFlusso(DUE[0]), false);
  assert.equal(pianiNelFlusso({ metadata: { piani_nel_flusso: true } }), true);
});

test("per piano: le stanze dello stesso piano fanno un cerchio solo, coi filtri", () => {
  const apparecchi = [
    { name: "TV", power_entity: "sensor.tv", room_id: "soggiorno" },
    { name: "Forno", power_entity: "sensor.forno", room_id: "cucina" },
    { name: "Phon", power_entity: "sensor.phon", room_id: "bagno" },
    { name: "Pompa", power_entity: "sensor.pompa", room_id: "esterno" },
  ];
  const { loads } = cerchiDelleStanze({ appliances: apparecchi, rooms: STANZE, perPiano: true });
  const cerchi = loads.filter((voce) => voce.metadata?.cerchio_della_stanza);
  assert.deepEqual(
    cerchi.map((voce) => voce.name),
    ["Piano terra", "Primo piano", "Esterno"],
  );
  const terra = cerchi[0];
  assert.equal(terra.metadata.cerchio_del_piano, true);
  assert.deepEqual(
    terra.metadata.stanze.map((stanza) => stanza.nome),
    ["Soggiorno", "Cucina"],
  );
  /* Senza la scelta, le stanze di sempre. */
  const diSempre = cerchiDelleStanze({ appliances: apparecchi, rooms: STANZE });
  assert.deepEqual(
    diSempre.loads.filter((voce) => voce.metadata?.cerchio_della_stanza).map((voce) => voce.name),
    ["Soggiorno", "Cucina", "Bagno", "Esterno"],
  );
  assert.ok(!diSempre.loads.some((voce) => voce.id === CERCHIO_ALTRO));
});

test("la soglia di sempre è del primo impianto, le altre stanno accanto", () => {
  const vecchia = { sorgente: "casa", ambra: 2000, rossa: 3000 };
  assert.deepEqual(sogliaDellImpianto(vecchia, PRIMO_IMPIANTO, 0), {
    sorgente: "casa",
    ambra: 2000,
    rossa: 3000,
  });
  /* Il secondo non eredita la soglia del primo. */
  assert.deepEqual(sogliaDellImpianto(vecchia, "impianto-2", 1), {
    sorgente: "casa",
    ambra: null,
    rossa: null,
  });
  const nuova = conLaSogliaDellImpianto(vecchia, "impianto-2", 1, {
    sorgente: "rete",
    ambra: "1500",
    rossa: "3300",
  });
  assert.equal(nuova.ambra, 2000, "il primo resta dov'era");
  assert.deepEqual(nuova[SOGLIE_PER_IMPIANTO]["impianto-2"], {
    sorgente: "rete",
    ambra: 1500,
    rossa: 3300,
  });
  assert.deepEqual(sogliaDellImpianto(JSON.stringify(nuova), "impianto-2", 1).rossa, 3300);
  assert.equal(qualcheSogliaScritta({}), false);
  assert.equal(qualcheSogliaScritta({ [SOGLIE_PER_IMPIANTO]: { x: { ambra: 1 } } }), true);
});

test("ogni contatore coi suoi numeri: due che stanno sotto non fanno un sovraccarico", () => {
  /* 1,97 + 1,80 = 3,77 kW: la somma passava i 3 kW; i due contatori no. */
  const soglie = {
    sorgente: "casa",
    ambra: 2000,
    rossa: 3000,
    [SOGLIE_PER_IMPIANTO]: { "impianto-2": { sorgente: "casa", ambra: 2000, rossa: 3000 } },
  };
  const quiete = verdettiDegliImpianti(soglie, [
    { id: PRIMO_IMPIANTO, index: 0, nome: "Zona Giorno", letture: { casa: 1970 } },
    { id: "impianto-2", index: 1, nome: "Zona Notte", letture: { casa: 1800 } },
  ]);
  assert.deepEqual(
    quiete.map((verdetto) => verdetto.livello),
    [LIVELLO_QUIETE, LIVELLO_QUIETE],
  );
  assert.equal(ilVerdettoPeggiore(quiete).livello, LIVELLO_QUIETE);

  const verdetti = verdettiDegliImpianti(soglie, [
    { id: PRIMO_IMPIANTO, index: 0, nome: "Zona Giorno", letture: { casa: 2120 } },
    { id: "impianto-2", index: 1, nome: "Zona Notte", letture: { casa: 3100 } },
  ]);
  assert.equal(verdetti[0].livello, LIVELLO_AMBRA);
  assert.equal(verdetti[1].livello, LIVELLO_ROSSA);
  const peggiore = ilVerdettoPeggiore(verdetti);
  assert.equal(peggiore.nome, "Zona Notte");
  assert.equal(peggiore.limite, 3000);
});
