/* Le copie prese dal ponte devono restare identiche.
 *
 * `archivio.js`, `segreti.js`, `registro.js` — e dalla 1.5.9.14 `presa.js`,
 * `marchio.js`, `inventario.js` e `catalogo.js` — sono copie di quelli del ponte,
 * per lo stesso motivo per cui il centralino ne ha le sue: il ponte e' un
 * add-on, e un add-on si costruisce con la sua cartella come unico contesto —
 * non puo' importare niente che stia fuori da li'.
 *
 * Il rischio delle copie e' che divergano in silenzio: si corregge un difetto
 * da una parte e dall'altra resta. Questa prova fa in modo che non succeda in
 * silenzio, che e' la parte che conta.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const QUI = dirname(fileURLToPath(import.meta.url));
const QUADRO = join(QUI, "..", "src");
const PONTE = join(QUI, "..", "..", "ponte", "src");

const COPIATI = [
  "archivio.js",
  "segreti.js",
  "registro.js",
  /* Dalla 1.5.9.14, per l'editor della plancia dentro il cruscotto: il
   * server WebSocket, la vestizione della pagina, il setaccio
   * dell'inventario e il catalogo delle integrazioni. */
  "presa.js",
  "marchio.js",
  "inventario.js",
  "catalogo.js",
];

test("le copie prese dal ponte sono ancora identiche", () => {
  for (const nome of COPIATI) {
    assert.equal(
      readFileSync(join(QUADRO, nome), "utf8"),
      readFileSync(join(PONTE, nome), "utf8"),
      `«${nome}» non e' piu' uguale a quello del ponte: cp ponte/src/${nome} quadro/src/`,
    );
  }
});
