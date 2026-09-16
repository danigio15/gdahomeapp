/* Le stanze in plancia dicono COSA è acceso, non solo quanto (#546).
 *
 * «Rooms must be displayed with the room icon and name centered. Small icons
 * should appear on the card to indicate the status or count of lights, climate
 * control, power outlets, alerts, doors, windows and temperature.»
 *
 * Il conto era uno solo — «3 accese» — e non distingueva una luce da un
 * condizionatore: proprio la distinzione che serve a decidere se valga la pena
 * entrare nella stanza. Adesso c'è una pastiglia per genere, col disegno di
 * casa e quante ne sono, e il disegno con il nome stanno in mezzo.
 *
 * I generi sono quelli che la stanza ha davvero — gli stessi blocchi che la
 * sua pagina elenca — e non un elenco parallelo: due conti della stessa cosa
 * diventano due conti diversi al primo blocco nuovo.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const sorgente = readFileSync(
  new URL("../src/sections/stanze-in-plancia-section.js", import.meta.url),
  "utf8",
);

const { riassuntoDellaStanza } = await import(
  `../src/sections/stanze-in-plancia-section.js?fix=${Date.now()}`
);

const STANZA = Object.freeze({
  id: "soggiorno",
  name: "Soggiorno",
  temp: "sensor.soggiorno_temp",
  hum: "sensor.soggiorno_hum",
  blocchi: [
    {
      key: "clima",
      voci: [{ entity: "climate.soggiorno" }, { entity: "climate.veranda" }],
    },
    {
      key: "luci",
      voci: [
        { entity: "light.piantana" },
        { entity: "light.faretti" },
        { entity: "light.lettura" },
      ],
    },
    { key: "prese", voci: [{ entity: "switch.presa_tv" }] },
    { key: "media", voci: [{ entity: "media_player.cassa" }] },
  ],
});

const STATI = Object.freeze({
  "sensor.soggiorno_temp": { state: "21.4" },
  "sensor.soggiorno_hum": { state: "47" },
  "climate.soggiorno": { state: "heat" },
  "climate.veranda": { state: "off" },
  "light.piantana": { state: "on" },
  "light.faretti": { state: "on" },
  "light.lettura": { state: "off" },
  "switch.presa_tv": { state: "off" },
  "media_player.cassa": { state: "playing" },
});

test("il conto si divide per genere, e i generi spenti non escono", () => {
  const riassunto = riassuntoDellaStanza(STANZA, STATI);
  assert.equal(riassunto.accese, 4, "il totale resta quello di prima");
  assert.deepEqual(
    riassunto.perTipo.map((voce) => [voce.chiave, voce.quante]),
    [
      ["clima", 1],
      ["luci", 2],
      ["media", 1],
    ],
    "le prese spente non meritano una pastiglia",
  );
  /* E i gradi e l'umidità restano quelli di sempre, arrotondati da chi disegna. */
  assert.equal(riassunto.gradi, 21.4);
  assert.equal(riassunto.umidita, 47);
});

test("ogni genere porta il disegno di casa, non un'emoji", () => {
  const riassunto = riassuntoDellaStanza(STANZA, STATI);
  assert.deepEqual(
    riassunto.perTipo.map((voce) => voce.oggetto),
    ["clima", "luci", "media"],
  );
  /* Le pastiglie si disegnano con il catalogo degli oggetti, che è lo stesso
   * delle tessere e della fascia sotto il meteo. */
  assert.match(sorgente, /import \{ oggettoWidget \} from "\.\.\/core\/oggetti-widget\.js";/);
  assert.match(sorgente, /oggettoWidget\(\s*voce\.oggetto,?\s*\)/);
});

test("una stanza spenta non mostra nessuna pastiglia", () => {
  const spenta = riassuntoDellaStanza(STANZA, {
    ...STATI,
    "climate.soggiorno": { state: "off" },
    "light.piantana": { state: "off" },
    "light.faretti": { state: "off" },
    "media_player.cassa": { state: "idle" },
  });
  assert.equal(spenta.accese, 0);
  assert.deepEqual(spenta.perTipo, []);
});

test("il disegno e il nome della stanza stanno in mezzo", () => {
  const stile = sorgente.slice(sorgente.indexOf(".dm-stanza-plancia{"));
  assert.match(stile, /flex-direction:column;align-items:center/);
  assert.match(stile, /text-align:center/);
  assert.match(
    sorgente,
    /\.dm-stanza-plancia-testo\{\s*display:flex;flex-direction:column;align-items:center/,
  );
});

test("la firma del blocco cambia anche quando cambia un solo genere", () => {
  /* Il totale può restare identico — una luce spenta e un clima acceso — e
   * senza il conto per genere nella firma la card resterebbe a dire «luce»
   * fino al cambio di stato dopo. */
  assert.match(sorgente, /riassunto\.perTipo\.map\(\(tipo\) => `\$\{tipo\.chiave\}:\$\{tipo\.quante\}`\)/);
});
