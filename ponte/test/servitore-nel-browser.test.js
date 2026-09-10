/* Il servitore dentro il browser: **cosa** si mette in mezzo, e cosa no.
 *
 * Sta fra le prove del ponte perche' questo e' l'unico banco Node del
 * progetto, e la regola che prova e' di quelle che si rompono in silenzio: se
 * il service worker si mette in mezzo a una cosa che non e' sua, quella cosa
 * non arriva e a schermo non compare nessun errore — compare una schermata a
 * meta'.
 *
 * Ed e' successo davvero. Dietro l'ingress di Home Assistant l'app sta su un
 * indirizzo che comincia con `/api/hassio_ingress/<gettone>/app/`: col
 * confronto «il percorso CONTIENE /api/» finivano al ponte anche i caratteri
 * dell'app, i suoi disegni e `caselle.json` — l'elenco delle cento caselle
 * della configurazione. Il ponte le girava a Home Assistant, che rispondeva
 * 404, e nella scheda di un'auto le diciassette entita' semplicemente non
 * c'erano.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const QUI = dirname(fileURLToPath(import.meta.url));
const SW = join(dirname(dirname(QUI)), "app", "web", "plancia-sw.js");

/* Accende il service worker in una scatola, con l'ambito che gli darebbe il
 * browser, e torna la funzione che decide cosa fare di ogni richiesta. */
function accendi(ambito) {
  const ascolti = new Map();
  const finto = {
    addEventListener: (che, quale) => ascolti.set(che, quale),
    skipWaiting: () => {},
    clients: { claim: () => {}, matchAll: async () => [] },
    registration: { scope: `https://casa.esempio${ambito}` },
    location: { origin: "https://casa.esempio" },
  };
  runInNewContext(readFileSync(SW, "utf8"), {
    self: finto,
    URL,
    Response,
    setTimeout,
    Map,
    Promise,
    Error,
  });
  return (indirizzo) => {
    let risposto = false;
    ascolti.get("fetch")({
      request: { url: indirizzo },
      respondWith: () => {
        risposto = true;
      },
    });
    return risposto;
  };
}

test("dietro l'ingress non si tocca quello che l'app chiede di suo", () => {
  const davanti = "/api/hassio_ingress/un-gettone-qualunque/app/";
  const decide = accendi(davanti);
  const dove = `https://casa.esempio${davanti}`;

  /* Le cose dell'app: passano. Sono dentro un indirizzo che contiene `/api/`,
   * ed e' esattamente il caso che prima si rompeva. */
  assert.equal(decide(`${dove}assets/assets/plancia/caselle.json`), false);
  assert.equal(decide(`${dove}main.dart.js`), false);
  assert.equal(decide(`${dove}canvaskit/canvaskit.wasm`), false);
  assert.equal(decide(`${dove}assets/fonts/MaterialIcons-Regular.otf`), false);

  /* Le cose della plancia: si servono. */
  assert.equal(decide(`${dove}dashboardmodern_static/src/core/i18n.js`), true);
  assert.equal(decide(`${dove}api/history/period/oggi`), true);
  assert.equal(decide(`${dove}local/auto.png`), true);
});

test("senza prefisso vale lo stesso, e da un'altra origine non si tocca niente", () => {
  const decide = accendi("/");
  assert.equal(decide("https://casa.esempio/main.dart.js"), false);
  assert.equal(decide("https://casa.esempio/dashboardmodern_static/x.js"), true);
  assert.equal(decide("https://casa.esempio/api/history/period/oggi"), true);
  /* Un service worker risponde solo alle pagine della sua origine. */
  assert.equal(decide("https://fonts.gstatic.com/s/roboto/x.woff2"), false);
});
