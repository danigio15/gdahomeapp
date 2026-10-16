/* I balconi stanno all'aperto (#251).
 *
 * «Il balcone e' a 6 gradi e l'assistente mi dice di scaldarlo; e la media di
 * casa me la tira giu'.» Una stanza segnata «All'aperto» — balcone, terrazzo,
 * giardino — si legge come prima, ma l'assistente non propone di scaldarla,
 * rinfrescarla o arieggiarla, e non entra nella media della casa: ne' nella
 * tessera Temperatura della Home, ne' nelle risposte di «Chiedi alla casa».
 *
 * Dal nome non si deduce niente: un «Balcone» senza la spunta resta una stanza
 * come le altre.
 */
import assert from "node:assert/strict";
import test from "node:test";

const magazzino = new Map();
globalThis.localStorage = {
  getItem: (k) => (magazzino.has(k) ? magazzino.get(k) : null),
  setItem: (k, v) => magazzino.set(k, String(v)),
  removeItem: (k) => magazzino.delete(k),
};
globalThis.document = undefined;

const { primaLeStanzeDiCasa, stanzaAllAperto } = await import("../src/core/room-overview.js");
const { migrateRooms } = await import("../src/core/migrations.js");
const { suggerimentiDellaCasa } = await import("../src/core/assistente-di-casa.js");
const { sapereDellaCasa } = await import("../src/core/sapere-della-casa.js");
const { rispondiDaCasa } = await import("../src/core/rispondere-alle-domande.js");
const { temperatureModel } = await import("../src/sections/home-widgets-section.js");
const { fontiDiProva } = await import("./fixtures/casa-che-risponde.js");

const scrivi = (chiave, valore) => magazzino.set(chiave, JSON.stringify(valore));

/* ── la stanza ──────────────────────────────────────────────────────────── */

test("all'aperto lo dice la spunta, non il nome", () => {
  assert.equal(stanzaAllAperto({ name: "Balcone sud", outdoor: true }), true);
  assert.equal(stanzaAllAperto({ name: "Terrazzo", outdoor: "true" }), true);
  /* Un balcone chiuso a veranda e' una stanza: senza spunta, niente cambia. */
  assert.equal(stanzaAllAperto({ name: "Balcone" }), false);
  assert.equal(stanzaAllAperto({ name: "Giardino d'inverno", outdoor: false }), false);
  assert.equal(stanzaAllAperto(null), false);
});

test("le stanze all'aperto vanno in fondo, le altre restano dove sono", () => {
  const stanze = [
    { id: "a", name: "Soggiorno" },
    { id: "b", name: "Balcone sud", outdoor: true },
    { id: "c", name: "Camera" },
    { id: "d", name: "Balcone nord", outdoor: true },
  ];
  assert.deepEqual(
    primaLeStanzeDiCasa(stanze).map((s) => s.id),
    ["a", "c", "b", "d"],
  );
  const voci = stanze.map((room) => ({ room }));
  assert.deepEqual(
    primaLeStanzeDiCasa(voci, (voce) => voce.room).map((v) => v.room.id),
    ["a", "c", "b", "d"],
  );
});

test("il modello delle stanze tiene all'aperto come un si' o un no, e solo se c'era", () => {
  const [balcone, terrazzo, soggiorno, veranda] = migrateRooms([
    { id: "balcone", name: "Balcone", outdoor: true },
    { id: "terrazzo", name: "Terrazzo", outdoor: "true" },
    { id: "soggiorno", name: "Soggiorno" },
    { id: "veranda", name: "Veranda", outdoor: false },
  ]);
  assert.equal(balcone.outdoor, true);
  assert.equal(terrazzo.outdoor, true);
  assert.equal("outdoor" in soggiorno, false);
  assert.equal(veranda.outdoor, false);
});

/* ── l'assistente ───────────────────────────────────────────────────────── */

function casa(stanze) {
  return {
    adesso: new Date(2026, 0, 14, 10, 0, 0).getTime(),
    ora: 10,
    persone: { totale: 2, inCasa: 2, ultimaUscita: 0 },
    luci: [],
    clima: [],
    media: [],
    finestre: [],
    porte: [],
    serrature: [],
    garage: [],
    tende: [],
    meteo: { pioggiaFra: null, soleNelleProssimeOre: false },
    elettrodomestici: [],
    finiti: [],
    energia: {},
    auto: [],
    antifurto: null,
    batterie: [],
    nonRispondono: [],
    aggiornamenti: [],
    rifiuti: [],
    eventi: [],
    allagamenti: [],
    valvole: [],
    fumo: [],
    stanze,
    frigo: [],
    stanzeOccupate: [],
    ciSonoPresenze: false,
  };
}

const titoli = (suggerimenti, tipo) =>
  suggerimenti.filter((s) => s.tipo === tipo).map((s) => s.titolo);

test("il balcone a 6 gradi e al 79% non chiede di scaldare ne' di arieggiare", () => {
  const balcone = {
    name: "Balcone nord",
    entity: "sensor.balcone_nord_temperatura",
    temperatura: 5.9,
    umidita: 79,
    co2: 1500,
  };
  /* Senza la spunta l'assistente parla: e' la prova che misura la cosa giusta. */
  const prima = suggerimentiDellaCasa(casa([balcone]), {}, { sensibilita: "tutto" }, "it");
  assert.deepEqual(titoli(prima, "comfort"), ["Balcone nord è fredda: 5,9°"]);
  assert.equal(titoli(prima, "aria").length, 2);

  const dopo = suggerimentiDellaCasa(
    casa([{ ...balcone, fuori: true }]),
    {},
    { sensibilita: "tutto" },
    "it",
  );
  assert.deepEqual(titoli(dopo, "comfort"), []);
  assert.deepEqual(titoli(dopo, "aria"), []);
});

test("saltato il balcone, la stanza di casa fredda o umida si dice lo stesso", () => {
  const fuori = suggerimentiDellaCasa(
    casa([
      { name: "Balcone sud", temperatura: 6.8, umidita: 74, fuori: true },
      { name: "Camera", entity: "sensor.t_camera", temperatura: 15.5 },
      { name: "Bagno", umidita: 78 },
    ]),
    {},
    { sensibilita: "tutto" },
    "it",
  );
  assert.deepEqual(titoli(fuori, "comfort"), ["Camera è fredda: 15,5°"]);
  assert.deepEqual(titoli(fuori, "aria"), ["Bagno: umidità al 78%"]);
});

/* ── la media della casa ────────────────────────────────────────────────── */

const STATI = {
  "sensor.soggiorno_temperature": { state: "20.6" },
  "sensor.soggiorno_humidity": { state: "48" },
  "sensor.camera_temperature": { state: "19.4" },
  "sensor.camera_humidity": { state: "52" },
  "sensor.balcone_temperature": { state: "6.8" },
  "sensor.balcone_humidity": { state: "74" },
};

const STANZE = [
  { id: "soggiorno", name: "Soggiorno", temp: "sensor.soggiorno_temperature" },
  { id: "balcone", name: "Balcone sud", temp: "sensor.balcone_temperature", outdoor: true },
  { id: "camera", name: "Camera", temp: "sensor.camera_temperature" },
];

test("la tessera Temperatura fa la media delle sole stanze di casa", () => {
  scrivi("cd_widgets", {});
  scrivi("cd_stanze", STANZE);
  const tessera = temperatureModel(STATI);
  /* (20,6 + 19,4) / 2: il balcone a 6,8 avrebbe fatto 15,6. */
  assert.match(tessera.value, /^20[.,]0°$/);
  assert.match(tessera.caption, /50%/);
  /* Il balcone resta fra le righe, per la finestra e lo storico. */
  assert.deepEqual(
    tessera.rows.map((riga) => [riga.name, riga.fuori]),
    [
      ["Soggiorno", false],
      ["Balcone sud", true],
      ["Camera", false],
    ],
  );
});

test("senza spunta il balcone conta come prima", () => {
  scrivi("cd_widgets", {});
  scrivi(
    "cd_stanze",
    STANZE.map(({ outdoor, ...stanza }) => stanza),
  );
  assert.match(temperatureModel(STATI).value, /^15[.,]6°$/);
});

test("con le sole stanze all'aperto la casa non ha una media", () => {
  scrivi("cd_widgets", {});
  scrivi("cd_stanze", [STANZE[1]]);
  assert.equal(temperatureModel(STATI).value, "—");
});

/* ── «Chiedi alla casa» ─────────────────────────────────────────────────── */

const TERMOMETRI = [
  { name: "Soggiorno", entity: "sensor.soggiorno_temperature", temperature: 21, humidity: 50 },
  { name: "Camera", entity: "sensor.camera_temperature", temperature: 19, humidity: 54 },
  {
    name: "Balcone",
    entity: "sensor.balcone_temperature",
    temperature: 6,
    humidity: 80,
    fuori: true,
  },
];

const sapere = (temperature) =>
  sapereDellaCasa(fontiDiProva({ temperature, stanze: ["Soggiorno", "Camera", "Balcone"] }));

test("la casa sa che il balcone sta fuori, e lo tiene fra le stanze", () => {
  const s = sapere(TERMOMETRI);
  assert.deepEqual(
    s.dentro.map((r) => [r.stanza, r.fuori === true]),
    [
      ["Soggiorno", false],
      ["Camera", false],
      ["Balcone", true],
    ],
  );
});

test("«che temperatura c'è in casa?» non conta il balcone", () => {
  const s = sapere(TERMOMETRI);
  const r = rispondiDaCasa("Che temperatura c'è in casa?", s, {});
  assert.match(r.testo, /in media 20 °C/);
  assert.match(r.testo, /da 19° in Camera a 21° in Soggiorno/);
  assert.match(r.testo, /Umidità 52%/);
  assert.doesNotMatch(r.testo, /Balcone/);
  /* Senza la spunta, il balcone tirava giu' la media. */
  const prima = rispondiDaCasa(
    "Che temperatura c'è in casa?",
    sapere(TERMOMETRI.map(({ fuori, ...riga }) => riga)),
    {},
  );
  assert.match(prima.testo, /in media 15,3 °C/);
});

test("il balcone chiesto per nome risponde, senza dire di arieggiare", () => {
  const s = sapere(TERMOMETRI);
  const gradi = rispondiDaCasa("Che temperatura c'è sul balcone?", s, {});
  assert.match(gradi.testo, /In Balcone ci sono 6 °C/);
  const umido = rispondiDaCasa("Che umidità c'è sul balcone?", s, {});
  assert.match(umido.testo, /In Balcone l'umidità è/);
  assert.doesNotMatch(umido.testo, /arieggia/);
  const media = rispondiDaCasa("Che umidità c'è in casa?", s, {});
  assert.match(media.testo, /umidità media è al 52%; la più alta è in Camera/);
});
