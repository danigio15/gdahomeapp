/* Una telecamera che si vede solo quando in casa non c'è nessuno (#81).
 *
 * «Pensavo a una possibilità di mettere un'impostazione aggiuntiva sulle
 *  telecamere. Tipo io ne ho una interna ma vorrei si potesse vedere solo se a
 *  casa non c'è nessuno per una questione di privacy.»
 *
 * Qui si prova quello che decide: chi è in casa, quali telecamere passano, e
 * cosa succede quando la risposta non c'è.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  cEQualcunoInCasa,
  conLaRiservata,
  eRiservata,
  normalizzaRiservate,
  telecamereVisibili,
} from "../src/core/telecamere-riservate.js";

const SORGENTI = fileURLToPath(new URL("../src/", import.meta.url));

const PERSONE = [{ entity: "person.giovanni" }, { entity: "person.marta" }];
const CAMERE = [
  { entity: "camera.ingresso", name: "Ingresso" },
  { entity: "camera.salotto", name: "Salotto" },
];
const RISERVATE = { "camera.salotto": true };

test("in casa c'è qualcuno solo se qualcuno dice «home»", () => {
  assert.equal(
    cEQualcunoInCasa(PERSONE, {
      "person.giovanni": { state: "home" },
      "person.marta": { state: "not_home" },
    }),
    true,
  );
  assert.equal(
    cEQualcunoInCasa(PERSONE, {
      "person.giovanni": { state: "not_home" },
      "person.marta": { state: "not_home" },
    }),
    false,
  );
  /* Una zona col nome è fuori: chi è «in palestra» non è in casa. */
  assert.equal(
    cEQualcunoInCasa(PERSONE, {
      "person.giovanni": { state: "palestra" },
      "person.marta": { state: "ufficio" },
    }),
    false,
  );
});

test("e quando non si sa, la risposta è «non si sa» — non «non c'è nessuno»", () => {
  /* Tre modi di non sapere, e nessuno dei tre è un no. */
  assert.equal(cEQualcunoInCasa([], {}), null);
  assert.equal(cEQualcunoInCasa(PERSONE, {}), null);
  assert.equal(
    cEQualcunoInCasa(PERSONE, {
      "person.giovanni": { state: "unknown" },
      "person.marta": { state: "unavailable" },
    }),
    null,
  );
  /* Ma basta UNA che risponde perché si sappia. */
  assert.equal(
    cEQualcunoInCasa(PERSONE, {
      "person.giovanni": { state: "unknown" },
      "person.marta": { state: "not_home" },
    }),
    false,
  );
});

test("la riservata si vede solo a casa vuota", () => {
  const vuota = {
    "person.giovanni": { state: "not_home" },
    "person.marta": { state: "not_home" },
  };
  const abitata = { "person.giovanni": { state: "home" } };

  assert.deepEqual(
    telecamereVisibili(CAMERE, { config: RISERVATE, persone: PERSONE, states: vuota }).map(
      (c) => c.entity,
    ),
    ["camera.ingresso", "camera.salotto"],
  );
  assert.deepEqual(
    telecamereVisibili(CAMERE, { config: RISERVATE, persone: PERSONE, states: abitata }).map(
      (c) => c.entity,
    ),
    ["camera.ingresso"],
  );
});

test("e davanti a un «non si so» resta nascosta", () => {
  /* La scelta che conta, e la ragione per cui è questa: fra i due sbagli
   * possibili — una telecamera nascosta a chi poteva vederla, e una accesa in
   * salotto mentre qualcuno ci passa davanti — il primo si scopre subito e si
   * rimedia con una spunta, il secondo non lo scopri mai. Chi accende questa
   * opzione sta chiedendo quella garanzia, e una garanzia che si arrende
   * quando il dato manca non è una garanzia. */
  for (const stati of [{}, { "person.giovanni": { state: "unknown" } }])
    assert.deepEqual(
      telecamereVisibili(CAMERE, { config: RISERVATE, persone: PERSONE, states: stati }).map(
        (c) => c.entity,
      ),
      ["camera.ingresso"],
      "senza sapere chi c'è, la riservata non si disegna",
    );
  /* E senza nessuna persona configurata, lo stesso. */
  assert.deepEqual(
    telecamereVisibili(CAMERE, { config: RISERVATE, persone: [], states: {} }).map((c) => c.entity),
    ["camera.ingresso"],
  );
});

test("chi non ha nessuna riservata non paga niente", () => {
  /* La stragrande maggioranza delle case sta qui: senza questa scorciatoia si
   * leggerebbero le persone a ogni giro di disegno per scartare zero
   * telecamere. */
  const stesse = telecamereVisibili(CAMERE, { config: {}, persone: PERSONE, states: {} });
  assert.equal(stesse, CAMERE, "torna proprio l'elenco che gli è stato dato");
});

test("l'elenco si scrive e si cancella, e quello che è rotto non entra", () => {
  assert.deepEqual(normalizzaRiservate({ "camera.a": true, "camera.b": false, "": true }), {
    "camera.a": true,
  });
  assert.deepEqual(normalizzaRiservate(null), {});
  assert.deepEqual(normalizzaRiservate(["camera.a"]), {});
  assert.equal(eRiservata("camera.a", { "camera.a": true }), true);
  assert.equal(eRiservata("camera.b", { "camera.a": true }), false);
  assert.deepEqual(conLaRiservata({}, "camera.a", true), { "camera.a": true });
  assert.deepEqual(conLaRiservata({ "camera.a": true }, "camera.a", false), {});
});

test("chi rientra la fa sparire subito, non al prossimo cambio pagina", () => {
  /* Questo è il motivo per cui qui non c'è nessuna «firma della presenza» da
   * infilare nei guardiani del ridisegno, e sarebbe stato il modo sbagliato di
   * ottenerlo.
   *
   * I tre posti che disegnano telecamere ridisegnano quando l'elenco che
   * disegnano cambia — la vetrina confronta `cardsSignature(models)`, le stanze
   * la loro `signature(pagine…)`, e il proprietario dei fotogrammi rilegge ogni
   * giro. Siccome tutti e tre partono dall'elenco GIÀ filtrato, una persona che
   * rientra accorcia l'elenco e quindi cambia la firma che ognuno si calcola
   * già. Non serve aggiungergliene una: basta che il filtro stia PRIMA.
   *
   * E la persona che rientra arriva davvero fin qui: `cd_people` è una chiave
   * di configurazione, quindi le sue `person.*` stanno fra le entità
   * configurate e il cancello degli eventi non le butta. */
  const fuori = telecamereVisibili(CAMERE, {
    config: RISERVATE,
    persone: PERSONE,
    states: { "person.giovanni": { state: "not_home" } },
  });
  const dentro = telecamereVisibili(CAMERE, {
    config: RISERVATE,
    persone: PERSONE,
    states: { "person.giovanni": { state: "home" } },
  });
  assert.deepEqual(
    fuori.map((c) => c.entity),
    ["camera.ingresso", "camera.salotto"],
  );
  assert.deepEqual(
    dentro.map((c) => c.entity),
    ["camera.ingresso"],
    "rientrando, il salotto esce dall'elenco — ed è l'elenco che fa ridisegnare",
  );
});

test("nessuno legge l'elenco crudo delle telecamere per disegnarlo", () => {
  /* La prova che vale davvero, e non è «il filtro è citato da qualche parte».
   *
   * Ogni pagina ha il suo modo di leggere le telecamere configurate — la
   * vetrina `securityCameras()`, il proprietario dei fotogrammi
   * `configuredCameras()`, le stanze la chiave `cd_cameras` — e sono quelle
   * tre letture il punto pericoloso: una quarta pagina, o una riga tolta dalla
   * parentesi per comodità, e la telecamera riservata torna a disegnarsi. Non
   * lo scoprirebbe nessuno guardando le pagine: lo scoprirebbe chi si trova la
   * telecamera accesa mentre è in casa, cioè esattamente la cosa che tutto
   * questo esiste per impedire.
   *
   * Quindi: ogni riga che legge l'elenco crudo deve avere il filtro sulla
   * stessa riga. La sola eccezione è la riga che dichiara il lettore. */
  const crudi = [
    ["sections/security-showcase-section.js", "securityCameras()", "telecamereDaMostrare"],
    ["sections/live-ui-section.js", "configuredCameras()", "telecamereVisibili("],
    ["sections/rooms-page-section.js", '"cd_cameras"', "telecamereVisibili("],
  ];
  for (const [file, lettura, filtro] of crudi) {
    const righe = readFileSync(SORGENTI + file, "utf8")
      .split("\n")
      .filter((riga) => riga.includes(lettura))
      /* Né la dichiarazione del lettore, né le righe di commento che lo
       * nominano per spiegare perché resta intero. */
      .filter((riga) => !/^\s*(\*|\/\*|\/\/)/.test(riga))
      .filter((riga) => !new RegExp(`function\\s+${lettura.replace("()", "")}\\s*\\(`).test(riga));
    assert.ok(righe.length, `${file} non legge più le telecamere con ${lettura}: prova da rifare`);
    for (const riga of righe)
      assert.ok(
        riga.includes(filtro),
        `${file} legge ${lettura} senza ${filtro}:\n    ${riga.trim()}`,
      );
  }
});

test("la vetrina disegna il filtrato, e l'editor l'elenco intero", () => {
  /* Le due metà della stessa regola. Se `cameraModels` tornasse a partire da
   * `securityCameras()` la spunta non varrebbe più niente; se l'editor
   * leggesse il filtrato, una telecamera nascosta non si potrebbe più
   * riconfigurare — sparirebbe anche dalla riga che serve a smarcarla. */
  const vetrina = readFileSync(SORGENTI + "sections/security-showcase-section.js", "utf8");
  assert.ok(
    vetrina.includes("function cameraModels(cameras = telecamereDaMostrare())"),
    "chi disegna la parete deve partire dalle telecamere da mostrare adesso",
  );
  const editor = readFileSync(SORGENTI + "sections/telecamere-riservate-editor-section.js", "utf8");
  assert.ok(
    editor.includes("securityCameras()") && !editor.includes("telecamereDaMostrare"),
    "il foglietto delle spunte elenca tutte le telecamere, anche quelle nascoste adesso",
  );
});
