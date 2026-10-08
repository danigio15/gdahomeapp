/* «Se clicco sulla stanza, entra ma non vedo le entità all'interno» (#190).
 *
 * La 1.10.0 ha tolto dalla pagina Stanze la funzione `disegnoDellaStanza` e
 * ne ha aggiornato due chiamate su tre. La terza stava nella testata della
 * stanza aperta: nella vista a tessere — quella di serie — ogni stanza
 * aperta si fermava su un nome che non c'era più, e la pagina restava vuota.
 * Dalla card della stanza in Home si arrivava su una pagina bianca; dalla
 * lista delle stanze il tocco non faceva niente. Non era l'iPad: era ogni
 * schermo, e la vista a righe, che non passa da lì, funzionava.
 *
 * Qui si disegna la stanza aperta come la disegna la pagina, nelle due viste:
 * se un nome manca, la prova cade come cadeva la pagina.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { roomPageMarkup, testaDellaStanza } from "../src/sections/rooms-page-section.js";

const pagina = {
  id: "room-salone",
  name: "Salone",
  icon: "mdi:sofa",
  floor: "Piano terra",
  count: 1,
  blocchi: [{ key: "luci", voci: [{ entity: "light.faretti", name: "Faretti" }] }],
};

test("la testata della stanza aperta si disegna, col segno della stanza", () => {
  const html = testaDellaStanza(pagina, {});
  assert.match(html, /dm-stanze-testa/);
  assert.match(html, /dm-stanze-testa-orb/);
  assert.match(html, /Salone/);
});

test("la stanza aperta nella vista a tessere si disegna con le sue entità", () => {
  const html = roomPageMarkup([pagina], "room-salone", {});
  assert.match(html, /dm-stanze-tavola/);
  assert.match(html, /Faretti/);
});

test("anche la stanza dei «senza stanza» ha la sua testata", () => {
  const html = testaDellaStanza({ ...pagina, id: "senza-stanza", senzaStanza: true }, {});
  assert.match(html, /📦/);
});
