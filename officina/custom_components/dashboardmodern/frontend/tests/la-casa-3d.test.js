/* «Casa 3D»: la casa salvata, la pianta compressa, le entita' proposte per
 * ogni dispositivo e cosa fa un tocco. */

import assert from "node:assert/strict";
import test from "node:test";
import {
  CASA3D_VUOTA,
  CELLA,
  azioneDelTocco,
  casa3dPulita,
  comprimiGriglia,
  contaCollegati,
  dispositivoPulito,
  entitaCandidate,
  entitaProposta,
  espandiGriglia,
  ricampiona,
  statoDelDispositivo,
  faseDellElettrodomestico,
  ELETTRODOMESTICI_3D,
} from "../src/core/casa-3d.js";

function griglia(W, H) {
  const t = new Int16Array(W * H).fill(CELLA.fuori);
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) t[y * W + x] = x < W / 2 ? 1 : 2;
  for (let y = 2; y < H - 2; y++) t[y * W + Math.floor(W / 2)] = CELLA.muro;
  return t;
}

test("la pianta compressa torna identica, anche con corse lunghe", () => {
  const t = griglia(300, 220);
  const z = comprimiGriglia(t);
  assert.ok(z.length < t.length / 20, `troppo lunga: ${z.length}`);
  assert.deepEqual(Array.from(espandiGriglia(z, t.length)), Array.from(t));
});

test("una pianta rovinata non fa cadere niente: le celle che mancano sono fuori", () => {
  const t = espandiGriglia("!!!", 10);
  assert.equal(t.length, 10);
  assert.ok(Array.from(t).every((v) => v === CELLA.fuori || v >= -8));
});

test("ricampionare a 5 cm tiene le stanze intere", () => {
  const g = { W: 400, H: 300, passo: 0.03, tipo: griglia(400, 300) };
  const r = ricampiona(g, 0.05);
  assert.equal(r.W, 240);
  assert.equal(r.H, 180);
  assert.ok(new Set(r.tipo).has(1) && new Set(r.tipo).has(2));
});

test("la casa pulita butta quello che non va e tiene quello che serve", () => {
  const c = casa3dPulita({
    attiva: true,
    tipo: "palazzo",
    esterno: {
      facciata: "#ABCDEF",
      tetto: "boh",
      telecamere: [{ k: "telecamera", entity: "camera.ingresso", x: 1, y: 2 }, { k: "luce" }],
    },
    piani: [
      {
        k: "terra",
        W: 10,
        H: 10,
        griglia: comprimiGriglia(griglia(10, 10)),
        stanze: [{ id: 1, nome: "Salone", area: "salone" }, { id: 0 }],
        dispositivi: [
          { k: "luce", stanza: 1, x: 1, y: 1, entity: "light.salone" },
          { k: "razzo" },
          { k: "telecamera", entity: "non valida" },
        ],
        arredi: [{ k: "divano", stanza: 1, x: 2, y: 3, rot: 1.57 }, { k: "<script>" }],
      },
      { W: 0, H: 0 },
    ],
  });
  assert.equal(c.attiva, true);
  assert.equal(c.tipo, "palazzo");
  assert.equal(c.esterno.facciata, "#abcdef");
  assert.equal(c.esterno.tetto, "falde");
  assert.equal(c.esterno.telecamere.length, 1);
  assert.equal(c.piani.length, 1);
  assert.deepEqual(
    c.piani[0].stanze.map((s) => s.nome),
    ["Salone"],
  );
  assert.deepEqual(
    c.piani[0].dispositivi.map((d) => [d.k, d.entity]),
    [
      ["luce", "light.salone"],
      ["telecamera", ""],
    ],
  );
  assert.deepEqual(
    c.piani[0].arredi.map((a) => a.k),
    ["divano"],
  );
});

/* «Avevo selezionato 3D, ma quando faccio Aggiungi va la classica»: una
 * casa senza piani si spegneva da sola, e una plancia Casa 3D appena nata
 * ricadeva nella classica. Accesa resta accesa anche vuota: la plancia
 * mostra «Crea la tua casa». Spenta di serie, come prima. */
test("accesa anche senza piani, spenta di serie", () => {
  assert.equal(casa3dPulita({ attiva: true }).attiva, true);
  assert.deepEqual(casa3dPulita({ attiva: true }).piani, []);
  assert.equal(CASA3D_VUOTA.attiva, false);
});

const STATI = {
  "light.salone_faretti": {
    state: "on",
    attributes: { friendly_name: "Faretti salone", brightness: 128 },
  },
  "light.cucina": { state: "off", attributes: { friendly_name: "Luce cucina" } },
  "switch.presa_tv": {
    state: "on",
    attributes: { friendly_name: "Presa TV", device_class: "outlet" },
  },
  "binary_sensor.movimento_salone": {
    state: "off",
    attributes: { friendly_name: "Movimento salone", device_class: "motion" },
  },
  "binary_sensor.porta_ingresso": {
    state: "on",
    attributes: { friendly_name: "Porta ingresso", device_class: "door" },
  },
  "binary_sensor.finestra_cucina": {
    state: "off",
    attributes: { friendly_name: "Finestra cucina", device_class: "window" },
  },
  "cover.tapparella_salone": {
    state: "open",
    attributes: {
      friendly_name: "Tapparella salone",
      current_position: 70,
      device_class: "shutter",
    },
  },
  "camera.salone": { state: "idle", attributes: { friendly_name: "Telecamera salone" } },
  "sensor.temperatura_salone": {
    state: "21.4",
    attributes: { friendly_name: "Temperatura salone", device_class: "temperature" },
  },
  "sensor.umidita_salone": {
    state: "50",
    attributes: { friendly_name: "Umidità salone", device_class: "humidity" },
  },
};

test("per un punto luce del salone propone prima la luce del salone", () => {
  const c = entitaCandidate("luce", { stanza: "Salone", states: STATI });
  assert.equal(c[0].entity, "light.salone_faretti");
  assert.ok(c.every((x) => /^(light|switch)\./.test(x.entity)));
});

test("l'area di Home Assistant vale piu' del nome", () => {
  const c = entitaCandidate("luce", {
    stanza: "Cucina",
    area: "cucina",
    states: STATI,
    aree: { "light.salone_faretti": "cucina" },
  });
  assert.equal(c[0].entity, "light.salone_faretti");
});

test("i sensori si propongono per classe: il termometro non prende l'umidita'", () => {
  const c = entitaCandidate("termometro", { stanza: "Salone", states: STATI });
  assert.deepEqual(
    c.map((x) => x.entity),
    ["sensor.temperatura_salone"],
  );
  assert.deepEqual(
    entitaCandidate("finestra", { stanza: "Cucina", states: STATI }).map((x) => x.entity),
    ["binary_sensor.finestra_cucina"],
  );
});

test("un'entita' gia' usata va in fondo, e la proposta automatica la salta", () => {
  const c = entitaCandidate("telecamera", {
    stanza: "Salone",
    states: STATI,
    usate: ["camera.salone"],
  });
  assert.equal(c.at(-1).entity, "camera.salone");
  assert.equal(
    entitaProposta("telecamera", { stanza: "Salone", states: STATI, usate: ["camera.salone"] }),
    "",
  );
  assert.equal(entitaProposta("telecamera", { stanza: "Salone", states: STATI }), "camera.salone");
});

test("lo stato si legge: luce al 50%, tapparella al 70%, porta aperta, temperatura", () => {
  assert.equal(statoDelDispositivo("luce", STATI["light.salone_faretti"]).testo, "💡 50%");
  assert.equal(statoDelDispositivo("tapparella", STATI["cover.tapparella_salone"]).apertura, 0.7);
  assert.equal(statoDelDispositivo("porta", STATI["binary_sensor.porta_ingresso"]).tono, "allarme");
  assert.equal(
    statoDelDispositivo("termometro", STATI["sensor.temperatura_salone"]).testo,
    "🌡️ 21,4°",
  );
  assert.equal(statoDelDispositivo("luce", { state: "unavailable" }).disponibile, false);
});

test("un tocco accende la luce, apre la tapparella chiusa, apre la telecamera; i sensori non fanno niente", () => {
  assert.deepEqual(azioneDelTocco("luce", "light.cucina", STATI["light.cucina"]), {
    domain: "light",
    service: "toggle",
    data: { entity_id: "light.cucina" },
  });
  assert.equal(azioneDelTocco("tapparella", "cover.x", { state: "closed" }).service, "open_cover");
  assert.equal(azioneDelTocco("tapparella", "cover.x", { state: "open" }).service, "close_cover");
  assert.equal(azioneDelTocco("tapparella", "cover.x", { state: "opening" }).service, "stop_cover");
  assert.deepEqual(azioneDelTocco("telecamera", "camera.salone", {}), {
    pagina: "telecamera",
    entity: "camera.salone",
  });
  assert.equal(azioneDelTocco("movimento", "binary_sensor.movimento_salone", {}), null);
  assert.equal(azioneDelTocco("luce", "", {}), null);
});

test("si conta quanti dispositivi sono collegati", () => {
  const c = casa3dPulita({
    piani: [
      {
        W: 4,
        H: 4,
        griglia: comprimiGriglia(griglia(4, 4)),
        dispositivi: [{ k: "luce", entity: "light.a" }, { k: "luce" }],
      },
    ],
    esterno: { telecamere: [{ k: "telecamera" }] },
  });
  assert.deepEqual(contaCollegati(c), { tutti: 3, collegati: 1, mancano: 2 });
  assert.equal(dispositivoPulito({ k: "telecamera", fov: 500 }).fov, 180);
});

/* «Asciugatrice e lavastoviglie mi sembra che non c'e' da poter inserire» */
test("gli elettrodomestici: si inseriscono e dicono se lavorano", () => {
  assert.deepEqual([...ELETTRODOMESTICI_3D].sort(), [
    "asciugatrice",
    "forno",
    "lavastoviglie",
    "lavatrice",
  ]);
  const st = (state, attributes = {}) => ({ state, attributes });
  assert.equal(faseDellElettrodomestico(st("1250", { unit_of_measurement: "W" })), "lavora");
  assert.equal(faseDellElettrodomestico(st("2", { unit_of_measurement: "W" })), "fermo");
  assert.equal(faseDellElettrodomestico(st("Running")), "lavora");
  assert.equal(faseDellElettrodomestico(st("in funzione")), "lavora");
  assert.equal(faseDellElettrodomestico(st("Program finished")), "finito");
  assert.equal(faseDellElettrodomestico(st("off")), "fermo");
  assert.equal(faseDellElettrodomestico(st("35", { unit_of_measurement: "min" })), "lavora");
  const lavora = statoDelDispositivo("asciugatrice", st("on"));
  assert.equal(lavora.attivo, true);
  assert.match(lavora.testo, /in funzione/);
  assert.equal(statoDelDispositivo("lavastoviglie", st("finished")).tono, "ok");
  assert.equal(
    statoDelDispositivo("lavastoviglie", st("finished"), false).testo.includes("done"),
    true,
  );
});
