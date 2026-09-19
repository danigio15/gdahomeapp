/* Il programma dentro le due pagine si legge.
 *
 * Sembra la prova piu' inutile del mucchio, e invece e' quella che mancava
 * quando serviva. Queste pagine sono un file solo — HTML, stile e programma —
 * e il programma sta dentro un `<script>`: nessuno lo importa, nessuno lo
 * costruisce, quindi finora **niente lo leggeva mai** prima del browser di
 * chi apre la pagina.
 *
 * Il guasto vero: un backtick dentro un commento HTML, dentro un template
 * literal.
 *
 *     <!-- Prima era un `window.prompt`: funzionava, e sul telefono … -->
 *
 * Quel commento e' dentro una stringa a backtick, quindi i due apici intorno a
 * `window.prompt` la chiudono a meta'. Da li' in poi il file non e' piu' un
 * programma, e il browser si ferma alla prima riga che non capisce: pagina
 * bianca, nav vuota, e nel registro niente — perche' il registro e' dell'add-on
 * e questo succede nel browser.
 *
 * 678 prove sono passate su quel file. La prova dello stile lo legge come
 * testo, quella dei tempi ci cerca dei numeri, nessuna ha provato a **leggerlo
 * come codice**. La differenza fra le due cose e' tutta qui.
 *
 * `new Function` e non `eval`: compila e basta, non esegue niente — e qui
 * serve sapere se si legge, non cosa fa.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const QUI = dirname(fileURLToPath(import.meta.url));

for (const pagina of ["console/index.html", "gestore/index.html"]) {
  test(`il programma dentro ${pagina} si legge`, () => {
    const dentro = readFileSync(join(QUI, "..", pagina), "utf8");
    const pezzi = [...dentro.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((una) => una[1]);
    assert.ok(pezzi.length > 0, `in «${pagina}» non c'e' nessuno <script>`);

    for (const [quale, pezzo] of pezzi.entries()) {
      try {
        new Function(pezzo);
      } catch (errore) {
        assert.fail(
          `lo <script> n° ${quale + 1} di «${pagina}» non si legge: ${errore.message}\n` +
            "Quasi sempre e' un backtick dentro un commento che sta dentro un template literal.",
        );
      }
    }
  });
}
