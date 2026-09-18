/* «Nella sezione varchi mi sta ripetendo quello che è su finestre» (#19).
 *
 * > Se vado su la configurazione «varchi», c'è «nessun contatto trovato»
 * > (perché li ho tutti tolti e sono con le X). Invece nella home me li mette
 * > tutte e due ripetuti.
 *
 * Le due frasi insieme sono la diagnosi. I contatti scritti dentro una riga
 * delle Finestre entrano fra i varchi — ed è giusto, perché chi li ha battuti
 * ha dichiarato che quelle sono finestre — ma quella riunione la faceva UNA
 * SOLA delle tre viste: la tessera della Home, da sé, al momento di disegnarsi.
 * La pagina Varchi e la scheda dei Varchi leggevano solo `cd_varchi`.
 *
 * Il risultato è la stessa casa con due elenchi di varchi a seconda di dove la
 * si guarda, e — peggio — una X che non si può mettere: la scheda non li
 * elencava, quindi non c'era niente da togliere. L'esclusione vince su tutto,
 * ma vince solo su quello che si vede.
 *
 * Adesso la riunione la fa `varchiConLeFinestre`, in un posto solo, e la
 * leggono tutte e tre.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  contattiDichiaratiNelleFinestre,
  varchiConLeFinestre,
  varchiDiCasa,
} from "../src/core/varchi-di-casa.js";

const FINESTRE = [
  { id: "cam", name: "Camera", entity: "cover.camera", contact: "binary_sensor.finestra_camera" },
  { id: "sala", name: "Sala", entity: "cover.sala", contact: "binary_sensor.finestra_sala" },
  { id: "bagno", name: "Bagno", entity: "cover.bagno", inferriata: "binary_sensor.inferriata_bagno" },
  { id: "nuda", name: "Studio", entity: "cover.studio" },
];

const aperto = (nome) => ({
  state: "on",
  attributes: { friendly_name: nome, device_class: "window" },
});

test("i contatti dichiarati nelle Finestre sono quelli, e senza doppioni", () => {
  assert.deepEqual(contattiDichiaratiNelleFinestre(FINESTRE), [
    "binary_sensor.finestra_camera",
    "binary_sensor.finestra_sala",
    "binary_sensor.inferriata_bagno",
  ]);
  /* Una riga senza contatto non dichiara niente, e due righe che dichiarano lo
   * stesso contatto lo dichiarano una volta sola. */
  assert.deepEqual(contattiDichiaratiNelleFinestre([{ entity: "cover.x" }]), []);
  assert.deepEqual(
    contattiDichiaratiNelleFinestre([{ contact: "binary_sensor.a" }, { contact: "binary_sensor.a" }]),
    ["binary_sensor.a"],
  );
  assert.deepEqual(contattiDichiaratiNelleFinestre(null), []);
});

test("entrano fra gli aggiunti, come quelli messi a mano nella scheda", () => {
  const riunita = varchiConLeFinestre({ aggiunte: ["binary_sensor.porta"] }, FINESTRE);
  assert.deepEqual(riunita.aggiunte, [
    "binary_sensor.porta",
    "binary_sensor.finestra_camera",
    "binary_sensor.finestra_sala",
    "binary_sensor.inferriata_bagno",
  ]);
  /* Senza finestre dichiarate la configurazione resta quella che era: non si
   * inventa una chiave per non dire niente. */
  assert.deepEqual(varchiConLeFinestre({ aggiunte: ["binary_sensor.porta"] }, []), {
    aggiunte: ["binary_sensor.porta"],
  });
});

test("una X messa nella scheda vale anche per il contatto che viene dalle Finestre", () => {
  /* È il punto della segnalazione: prima non si poteva nemmeno provare,
   * perché la scheda non lo elencava. */
  const stati = {
    "binary_sensor.finestra_camera": aperto("Finestra camera"),
    "binary_sensor.finestra_sala": aperto("Finestra sala"),
  };
  const tutte = varchiDiCasa(stati, varchiConLeFinestre({}, FINESTRE), new Set());
  assert.deepEqual(
    tutte.map((riga) => riga.entity),
    ["binary_sensor.finestra_camera", "binary_sensor.finestra_sala"],
  );
  const senzaLaCamera = varchiDiCasa(
    stati,
    varchiConLeFinestre({ escluse: ["binary_sensor.finestra_camera"] }, FINESTRE),
    new Set(),
  );
  assert.deepEqual(
    senzaLaCamera.map((riga) => riga.entity),
    ["binary_sensor.finestra_sala"],
  );
});

const sorgente = (dove) => readFileSync(new URL(dove, import.meta.url), "utf8");

test("la Home, la pagina e la scheda leggono lo stesso elenco", () => {
  /* Il difetto era proprio che una sola delle tre lo faceva: se domani
   * qualcuna torna a leggere `cd_varchi` da sola, questa prova cade. */
  for (const dove of [
    "../src/sections/home-widgets-section.js",
    "../src/sections/varchi-section.js",
    "../src/sections/varchi-editor-section.js",
  ])
    assert.match(sorgente(dove), /varchiConLeFinestre\(/, dove);
  /* E la copia che la tessera si era fatta in casa non c'è più. */
  assert.ok(!sorgente("../src/sections/home-widgets-section.js").includes("contattiDelleFinestre"));
});

test("la scheda salva solo la configurazione dei Varchi, non una copia delle Finestre", () => {
  /* Elencare i contatti delle Finestre e poi riscriverli fra gli «aggiunti»
   * ne farebbe una copia, che il giorno che si cambia la riga delle Finestre
   * non si aggiorna più. Quello che si mostra è la lista riunita; quello che
   * si scrive è solo la propria. */
  const scheda = sorgente("../src/sections/varchi-editor-section.js");
  assert.match(scheda, /function configurazioneSalvata\(\)/);
  for (const dentro of scheda.split(/\n(?=function |export function )/)) {
    if (!/writeJsonIfChanged\(CHIAVE_VARCHI|salva\(\{/.test(dentro)) continue;
    assert.ok(
      !/\bconst scelte = configurazione\(\)/.test(dentro),
      "chi salva deve partire da configurazioneSalvata()",
    );
  }
});
