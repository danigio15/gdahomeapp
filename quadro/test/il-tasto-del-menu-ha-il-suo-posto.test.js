/* Il tasto del menu di Home Assistant, e lo spazio che gli spetta.
 *
 * Questo pezzo sta in tre file che non si conoscono: `ponte/carta/plancia.js`
 * disegna un tasto che **galleggia** sopra un riquadro, e dentro quel riquadro
 * ci sono le due pagine del quadro, che stanno in un altro documento e non
 * sanno di averlo addosso.
 *
 * Ci si e' gia' sbattuto due volte. Prima il tasto stava a sinistra e si
 * sedeva sopra il marchio della pagina; allora e' stato spostato a destra, e
 * li' si e' seduto sulla nav. Scansare non funziona: da una parte o
 * dall'altra, sotto c'e' sempre qualcosa.
 *
 * La regola che questa prova tiene ferma e' l'altra — **fargli spazio** — e ha
 * due meta' in due posti: il tasto si sa quanto e' grosso e da che parte sta,
 * e le pagine ne lasciano almeno altrettanto quando sono dentro un riquadro.
 * Se una delle due meta' si muove da sola, si torna a coprire qualcosa in
 * silenzio.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const QUI = dirname(fileURLToPath(import.meta.url));
const qua = (...pezzi) => readFileSync(join(QUI, "..", ...pezzi), "utf8");

const CARTA = readFileSync(join(QUI, "..", "..", "ponte", "carta", "plancia.js"), "utf8");
const PAGINE = [
  ["console/index.html", qua("console", "index.html")],
  ["gestore/index.html", qua("gestore", "index.html")],
];

test("il tasto galleggia a sinistra, dove sta l'hamburger di Home Assistant", () => {
  /* A destra e' stato un giro sbagliato: e' il posto dove nessuno lo cerca, e
   * dove per giunta c'era la nav. */
  assert.match(CARTA, /inset-inline-start: calc\(8px \+ env\(safe-area-inset-left, 0px\)\)/);
  assert.ok(
    !/\.menu\s*\{[^}]*inset-inline-end/s.test(CARTA),
    "il tasto e' tornato a destra senza che le pagine lo sappiano",
  );
});

test("le due pagine lasciano al tasto almeno lo spazio che occupa", () => {
  /* Otto di stacco piu' quaranta di tasto: sotto quel numero, qualcosa
   * finisce coperto. */
  const stacco = Number(/inset-inline-start: calc\((\d+)px/.exec(CARTA)?.[1]);
  const largo = Number(/\.menu\s*\{[^}]*?width: (\d+)px/s.exec(CARTA)?.[1]);
  assert.ok(Number.isFinite(stacco) && Number.isFinite(largo), "il tasto non si misura piu'");
  const serve = stacco + largo;

  for (const [quale, pagina] of PAGINE) {
    const lasciato = Number(
      /:root\[data-dentro\] \.testata \{\s*padding-inline-start: (\d+)px;/.exec(pagina)?.[1],
    );
    assert.ok(Number.isFinite(lasciato), `«${quale}» non lascia piu' spazio al tasto del menu`);
    assert.ok(
      lasciato >= serve,
      `«${quale}» lascia ${lasciato}px e il tasto ne occupa ${serve}: ci si siede sopra`,
    );
  }
});

test("lo spazio si lascia solo stando dentro un riquadro, non sempre", () => {
  /* Aperte nel browser quel tasto non c'e', e un buco in cima sarebbe solo un
   * buco. La domanda si fa in un `try`: `window.top` di un'altra origine non
   * si legge, e quel guasto e' esso stesso la risposta «si', sono dentro». */
  for (const [quale, pagina] of PAGINE) {
    assert.match(pagina, /window\.self !== window\.top/, `«${quale}» non si chiede se e' dentro`);
    assert.match(
      pagina,
      /catch \(_altroDominio\) \{\s*document\.documentElement\.dataset\.dentro = "sì";/,
      `«${quale}»: un'altra origine deve valere «sono dentro», non un guasto`,
    );
  }
});

test("in testata non c'e' piu' niente da coprire", () => {
  /* Il bollo del marchio stava proprio li' sotto. Toglierlo non e' la
   * soluzione — quella e' lo spazio qui sopra — ma rimetterlo vorrebbe dire
   * ridiscutere tutto, e allora che sia una scelta e non una svista. */
  for (const [quale, pagina] of PAGINE) {
    const testata = /<header>[\s\S]*?<\/header>/.exec(pagina)?.[0] ?? "";
    assert.ok(testata, `«${quale}» non ha piu' una testata`);
    assert.ok(!testata.includes('class="bollo"'), `«${quale}» ha di nuovo il bollo in testata`);
  }
});
