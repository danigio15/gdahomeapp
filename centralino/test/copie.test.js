/* Le copie prese dal ponte devono restare identiche.
 *
 * `presa.js`, `segreti.js`, `archivio.js` e `registro.js` sono copie di quelli
 * del ponte. Non sono una libreria condivisa perche' non possono esserlo: il
 * ponte e' un add-on, e un add-on si costruisce con la sua cartella come unico
 * contesto — non puo' importare niente che stia fuori da li'.
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
const CENTRALINO = join(QUI, "..", "src");
const PONTE = join(QUI, "..", "..", "ponte", "src");

const COPIATI = ["presa.js", "segreti.js", "archivio.js", "registro.js"];

test("le copie prese dal ponte sono ancora identiche", () => {
  for (const nome of COPIATI) {
    assert.equal(
      readFileSync(join(CENTRALINO, nome), "utf8"),
      readFileSync(join(PONTE, nome), "utf8"),
      `«${nome}» e' diverso da quello del ponte. Si riallineano cosi':\n` +
        `  cp ponte/src/{${COPIATI.map((uno) => uno.replace(".js", "")).join(",")}}.js centralino/src/`,
    );
  }
});
