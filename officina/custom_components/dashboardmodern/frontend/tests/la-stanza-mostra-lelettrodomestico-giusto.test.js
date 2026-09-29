/* «Nella pagina delle stanze, aprendone una qualsiasi, al suo interno gli
 * elettrodomestici non vengono visualizzati con la loro icona, a prescindere da
 * come li si configuri nella relativa pagina elettrodomestici: appaiono tutti
 * con l'icona del cestello.» (#404)
 *
 * Il riepilogo di una stanza mette una riga per cosa, con un glifo davanti, e
 * quel glifo lo prendeva dal BLOCCO. Il blocco «elettrodomestici» ne ha uno
 * solo — il cestello della lavatrice — e cosi' in cucina il forno, il frigo e
 * la lavastoviglie erano tre lavatrici in fila.
 *
 * E' lo stesso difetto che il fiocco di neve aveva gia' avuto sul clima, dove
 * era stato corretto: il tipo la configurazione lo sa gia'.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { canonicalArtworkType } from "../src/core/appliance-artwork.js";
import { iconaVoce } from "../src/sections/rooms-page-section.js";

/* Dalla 1.8.1 la riga porta un disegno del catalogo, non un'emoji: «non deve
 * esserci nulla che non sia nel nostro catalogo». `iconaVoce` dice quale. */
const ELETTRODOMESTICI = { key: "elettrodomestici" };
const EMOJI = /\p{Extended_Pictographic}/u;

test("ogni elettrodomestico porta il disegno del suo tipo, non quello del blocco", () => {
  const disegno = (item) => iconaVoce(item, ELETTRODOMESTICI);
  /* Come li scrive l'editor: la chiave del catalogo dei disegni, in tre campi. */
  assert.equal(disegno({ visual_key: "dishwasher" }), "dishwasher");
  assert.equal(disegno({ device_type: "fridge" }), "fridge");
  assert.equal(disegno({ type: "oven" }), "oven");
  /* E tre cose diverse non danno mai la stessa riga. */
  const tre = [
    disegno({ visual_key: "oven" }),
    disegno({ visual_key: "fridge" }),
    disegno({ visual_key: "dishwasher" }),
  ];
  assert.equal(new Set(tre).size, 3);
});

test("senza un tipo riconoscibile si legge il nome, e in ultima istanza il blocco", () => {
  assert.equal(iconaVoce({ name: "Lavastoviglie cucina" }, ELETTRODOMESTICI), "dishwasher");
  assert.equal(iconaVoce({ name: "Friggitrice aria" }, ELETTRODOMESTICI), "air-fryer");
  /* Quello che non si riconosce prende il disegno generico del blocco. */
  assert.equal(iconaVoce({ name: "Aggeggio" }, ELETTRODOMESTICI), "generic");
  assert.equal(iconaVoce({}, ELETTRODOMESTICI), "generic");
});

test("l'icona scelta a mano vince se il catalogo la sa disegnare, un'emoji no", () => {
  /* Un'emoji scelta a mano che il catalogo non conosce non esce: resta il
   * disegno del tipo. */
  assert.equal(iconaVoce({ emoji_icon: "🥐", visual_key: "oven" }, ELETTRODOMESTICI), "oven");
  /* La chiave del catalogo in `icon` adesso si disegna. */
  assert.equal(iconaVoce({ icon: "washer", visual_key: "oven" }, ELETTRODOMESTICI), "washer");
  assert.equal(
    iconaVoce({ icon: "mdi:fridge", visual_key: "oven" }, ELETTRODOMESTICI),
    "mdi:fridge",
  );
});

test("il disegno e' lo stesso della card della sezione", () => {
  for (const tipo of ["washer", "dryer", "dishwasher", "fridge", "oven", "microwave", "coffee"])
    assert.equal(iconaVoce({ visual_key: tipo }, ELETTRODOMESTICI), canonicalArtworkType(tipo));
});

test("il clima porta il suo disegno per tipo", () => {
  assert.equal(iconaVoce({ type: "termo" }, { key: "clima" }), "radiator");
  assert.equal(iconaVoce({ type: "pompa" }, { key: "clima" }), "heat-pump");
  assert.equal(iconaVoce({}, { key: "clima" }), "air-conditioner");
});

test("nessun blocco ripiega su un'emoji", () => {
  for (const key of [
    "clima",
    "luci",
    "prese",
    "coperture",
    "elettrodomestici",
    "media",
    "telecamere",
    "carichi",
    "robot",
    "irrigazione",
    "altro",
  ])
    assert.doesNotMatch(iconaVoce({ emoji_icon: "🍕" }, { key }), EMOJI, key);
});
