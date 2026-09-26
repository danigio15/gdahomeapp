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

import { applianceGlyph } from "../src/core/appliance-artwork.js";
import { iconaVoce } from "../src/sections/rooms-page-section.js";

const ELETTRODOMESTICI = { key: "elettrodomestici" };

test("ogni elettrodomestico porta il glifo del suo tipo, non quello del blocco", () => {
  const glifo = (item) => iconaVoce(item, ELETTRODOMESTICI);
  /* Come li scrive l'editor: la chiave del catalogo dei disegni, in tre campi. */
  assert.equal(glifo({ visual_key: "dishwasher" }), "🍽️");
  assert.equal(glifo({ device_type: "fridge" }), "🧊");
  assert.equal(glifo({ type: "oven" }), "🍕");
  /* E tre cose diverse non danno mai la stessa riga. */
  const tre = [
    glifo({ visual_key: "oven" }),
    glifo({ visual_key: "fridge" }),
    glifo({ visual_key: "dishwasher" }),
  ];
  assert.equal(new Set(tre).size, 3);
});

test("senza un tipo riconoscibile si legge il nome, e in ultima istanza il blocco", () => {
  /* Chi ha scritto solo il nome ha detto comunque qualcosa. */
  assert.equal(iconaVoce({ name: "Lavastoviglie cucina" }, ELETTRODOMESTICI), "🍽️");
  /* E quello che non si riconosce non prende un glifo a caso: resta il
   * cestello del blocco, che e' quello che c'era prima. */
  assert.equal(iconaVoce({ name: "Aggeggio" }, ELETTRODOMESTICI), "🧺");
  assert.equal(iconaVoce({}, ELETTRODOMESTICI), "🧺");
});

test("l'icona scelta a mano vince, se e' un glifo o un token che si sa disegnare", () => {
  assert.equal(iconaVoce({ emoji_icon: "🥐", visual_key: "oven" }, ELETTRODOMESTICI), "🥐");
  /* `icon` sugli elettrodomestici tiene la CHIAVE del catalogo, non un'emoji:
   * scriverla nella riga vorrebbe dire stampare «washer» a video. Questa
   * continua a non passare, ed e' l'unica delle tre forme che non passa. */
  assert.equal(iconaVoce({ icon: "washer", visual_key: "oven" }, ELETTRODOMESTICI), "🍕");
  /* Una `mdi:` invece adesso passa, e non perche' sia cambiata l'idea: e'
   * cambiato cosa sa fare la riga. Prima qui usciva testo e un token stampato
   * sarebbe stato la scritta «mdi:fridge» sopra il nome; adesso il segno lo
   * mette `iconGlyphHtml`, che la differenza la sa e il token lo disegna.
   *
   * Buttarla costava l'icona scelta: chi si fa un'azione rapida la sceglie
   * dall'editor, che di serie ci mette un `mdi:`, e nella stanza quell'icona
   * non arrivava mai. Dal campo, con la foto: «deve uscire icona dell'azione
   * rapida». */
  assert.equal(
    iconaVoce({ icon: "mdi:fridge", visual_key: "oven" }, ELETTRODOMESTICI),
    "mdi:fridge",
  );
});

test("il glifo e' lo stesso che sceglie il disegno grande della sezione", () => {
  /* Una riga della stanza e la card della sezione non devono poter dire due
   * cose diverse dello stesso apparecchio: la fonte e' una sola. */
  for (const tipo of ["washer", "dryer", "dishwasher", "fridge", "oven", "microwave"])
    assert.equal(iconaVoce({ visual_key: tipo }, ELETTRODOMESTICI), applianceGlyph(tipo));
});

test("gli altri blocchi non cambiano: il clima resta com'era", () => {
  assert.equal(iconaVoce({ type: "termo" }, { key: "clima" }), "🔥");
  assert.equal(iconaVoce({ type: "pompa" }, { key: "clima" }), "♨️");
  assert.equal(iconaVoce({}, { key: "clima" }), "❄️");
});
