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
  /* La scatola resta in mano: le funzioni dichiarate in cima al file
   * diventano sue, e una di quelle — `quantoSiTiene` — decide se un file si
   * tiene, che e' l'altra cosa che questa prova guarda. */
  const scatola = {
    self: finto,
    URL,
    Response,
    setTimeout,
    Map,
    Promise,
    Error,
  };
  runInNewContext(readFileSync(SW, "utf8"), scatola);
  return {
    decide: (indirizzo) => {
      let risposto = false;
      ascolti.get("fetch")({
        request: { url: indirizzo },
        respondWith: () => {
          risposto = true;
        },
      });
      return risposto;
    },
    quantoSiTiene: scatola.quantoSiTiene,
  };
}

test("dietro l'ingress non si tocca quello che l'app chiede di suo", () => {
  const davanti = "/api/hassio_ingress/un-gettone-qualunque/app/";
  const { decide } = accendi(davanti);
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
  const { decide } = accendi("/");
  assert.equal(decide("https://casa.esempio/main.dart.js"), false);
  assert.equal(decide("https://casa.esempio/dashboardmodern_static/x.js"), true);
  assert.equal(decide("https://casa.esempio/api/history/period/oggi"), true);
  /* Un service worker risponde solo alle pagine della sua origine. */
  assert.equal(decide("https://fonts.gstatic.com/s/roboto/x.woff2"), false);
});

test("quello che non cambia mai si tiene, e il resto no", () => {
  /* La seconda apertura della plancia. I file hanno l'impronta nel percorso —
   * `/dashboardmodern_static/<impronta>/…` — e a quell'indirizzo il contenuto
   * non cambiera' mai: aggiornare la plancia cambia l'impronta e quindi i
   * percorsi. Tenerli vuol dire che la seconda volta la plancia si apre senza
   * chiedere niente, che da fuori casa e' tutto il tempo che ci metteva.
   *
   * Sbagliare da questo lato costa una plancia vecchia che non si aggiorna
   * piu', e allora le tre eccezioni vanno provate una per una. */
  const { quantoSiTiene } = accendi("/");
  const impronta = "/dashboardmodern_static/a521678057b7d342";
  const perSempre = "public, max-age=31536000, immutable";

  assert.equal(quantoSiTiene(`${impronta}/src/core/i18n.js`, "text/javascript"), perSempre);
  assert.equal(quantoSiTiene(`${impronta}/legacy/dashboard-runtime-it.js`, ""), perSempre);
  assert.equal(quantoSiTiene("/dashboardmodern_static/brands/tesla.png", "image/png"), perSempre);

  /* La pagina no: porta le premesse, e quelle cambiano con la casa. */
  assert.equal(
    quantoSiTiene(`${impronta}/legacy/dashboard.html`, "text/html; charset=utf-8"),
    "no-store",
  );
  /* Le foto caricate dalla plancia no: il nome lo scegli tu, e ricaricarne
   * una col nome di prima e' una cosa normale. */
  assert.equal(quantoSiTiene("/dashboardmodern_static/www/casa.jpg", "image/jpeg"), "no-store");
  /* E lo stato di adesso, meno che mai. */
  assert.equal(quantoSiTiene("/api/history/period/oggi", "application/json"), "no-store");
  assert.equal(quantoSiTiene("/local/auto.png", "image/png"), "no-store");
});
