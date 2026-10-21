/* «Guarda la navbar ora e vedi se secondo te e' corretta.»
 *
 * Home Assistant su Android, coi tre tasti: sotto i nomi della barra in fondo
 * restava una striscia vuota alta quanto i tasti. L'app accorcia gia' da se'
 * la finestra fin dove cominciano i tasti, ma alla pagina dice lo stesso
 * `env(safe-area-inset-bottom)` = 48, e la plancia se li aggiungeva di nuovo.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { fondoDiSistema, fuoriDallaFinestra } from "../src/core/fondo-di-sistema.js";

test("la fascia che la finestra ha gia' lasciato fuori non si scansa due volte", () => {
  /* Il vetro e' 880, la finestra 832: i 48 dei tasti sono fuori. */
  const fuori = fuoriDallaFinestra(
    { width: 393, height: 880 },
    { innerWidth: 393, innerHeight: 832 },
  );
  assert.equal(fuori, 48);
  assert.equal(fondoDiSistema(48, 0, 0, fuori), 0);
  assert.equal(fondoDiSistema(0, 48, 0, fuori), 0, "anche detta dal documento in cima");
});

test("una finestra a tutto vetro la fascia la tiene", () => {
  /* L'app di Home Assistant su iPhone, un telefono a gesti a tutto schermo:
   * la finestra arriva al bordo e la fascia e' sua. */
  const iphone = fuoriDallaFinestra(
    { width: 393, height: 852 },
    { innerWidth: 393, innerHeight: 852 },
  );
  assert.equal(fondoDiSistema(34, 0, 0, iphone), 34);
  assert.equal(fondoDiSistema(0, 24, 0, 0), 24);
});

test("una finestra piu' corta per altre ragioni non toglie la fascia", () => {
  /* Un browser con la barra degli indirizzi in cima e la pagina sotto i
   * tasti: mancano 80 punti, ma non sono quelli dei tasti. */
  assert.equal(fondoDiSistema(48, 0, 0, 80), 48);
  /* La tastiera aperta: la finestra e' meta', e la fascia resta com'era. */
  assert.equal(fondoDiSistema(24, 0, 0, 300), 24);
});

test("il telefono coricato si conta nel verso giusto", () => {
  /* Coricato, coi gesti in fondo: 24 fuori, che lo schermo sia detto in
   * orizzontale o rimasto detto in verticale. */
  assert.equal(
    fuoriDallaFinestra({ width: 880, height: 393 }, { innerWidth: 880, innerHeight: 369 }),
    24,
  );
  assert.equal(
    fuoriDallaFinestra({ width: 393, height: 880 }, { innerWidth: 880, innerHeight: 369 }),
    24,
  );
  /* Coricato coi tre tasti di fianco: in altezza non manca niente. */
  assert.equal(
    fuoriDallaFinestra({ width: 393, height: 880 }, { innerWidth: 832, innerHeight: 393 }),
    0,
  );
  assert.equal(fuoriDallaFinestra(null, null), 0);
});
