/* «Selezionando il sensore si blocca» (#279).
 *
 * Il foglio «Ultime 24 ore» (#269) si apre anche dalle righe della finestra di
 * una tessera della Home. Quella finestra ferma, a ogni giro, le animazioni di
 * tutto quello che non sta dentro di lei — e il foglio, che le sta sopra ma
 * vive fuori, veniva fermato al fotogramma zero della sua entrata: opacita'
 * zero, invisibile, steso su tutto lo schermo a prendersi ogni tocco.
 *
 * Due difese, provate qui: chi ferma sa chi sta sopra, e il foglio, se lo
 * trova fermo, riparte da solo.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const SORGENTE_FOGLIO = readFileSync(
  new URL("../src/sections/ultime-rilevazioni-section.js", import.meta.url),
  "utf8",
);

/* Un nodo finto che risponde a `closest` come il DOM: sale fino a un padre
 * che porta uno dei segni dati. */
function nodo(segni = [], padre = null) {
  return {
    segni,
    padre,
    closest(selettore) {
      const voluti = selettore.split(",").map((s) => s.trim());
      for (let n = this; n; n = n.padre) if (n.segni.some((s) => voluti.includes(s))) return n;
      return null;
    },
  };
}

const anim = (nome, playState, target) => ({
  animationName: nome,
  playState,
  effect: { target },
});

test("la finestra non ferma chi le sta sopra", async () => {
  const { animazioniDaFermare, SOPRA_LA_FINESTRA } = await import(
    "../src/sections/home-widgets-section.js"
  );
  assert.ok(SOPRA_LA_FINESTRA.includes("[data-dm-sopra-la-finestra]"));

  const finestra = nodo();
  const dentro = (n) => n === finestra;
  const foglio = nodo(["[data-dm-sopra-la-finestra]"]);
  const velo = nodo([], foglio);
  const tessera = nodo(["#dm-widgets"]);
  const conferma = nodo(["#confirm-modal"]);

  const scelte = animazioniDaFermare(
    [
      /* Dietro: si ferma, come prima. */
      anim("floatBlob", "running", tessera),
      /* Il foglio e il suo velo stanno sopra: non si toccano. */
      anim("dmUrDentro", "running", foglio),
      anim("dmUrVelo", "running", velo),
      /* La conferma che sta sopra la finestra apposta (#275): nemmeno. */
      anim("dmConfermaIn", "running", conferma),
      /* Dentro la finestra si continua a muovere. */
      anim("dmWidgetIn", "running", finestra),
    ],
    dentro,
  );
  assert.deepEqual(
    scelte.map((a) => a.animationName),
    ["floatBlob"],
  );

  /* Un bersaglio senza `closest` — un nodo di testo, un oggetto strano — non
   * rompe niente: e' dietro, e si ferma. */
  assert.equal(animazioniDaFermare([anim("x", "running", {})], dentro).length, 1);
  /* Uno il cui `closest` lancia nemmeno. */
  const rotto = {
    closest() {
      throw new Error("selettore");
    },
  };
  assert.equal(animazioniDaFermare([anim("y", "running", rotto)], dentro).length, 1);
});

test("il foglio trovato fermo riparte da solo", async () => {
  const { nonRestareFermo } = await import("../src/sections/ultime-rilevazioni-section.js");
  const fatte = [];
  const una = (playState) => ({
    playState,
    play() {
      fatte.push(playState);
      this.playState = "running";
    },
  });
  const animazioni = [una("paused"), una("running"), una("finished"), una("paused")];
  let chiesta = null;
  const contenitore = {
    getAnimations(opzioni) {
      chiesta = opzioni;
      return animazioni;
    },
  };
  assert.equal(nonRestareFermo(contenitore), 2);
  /* Tutte quelle del foglio, non solo le sue: il velo e il foglio sono figli. */
  assert.deepEqual(chiesta, { subtree: true });
  assert.deepEqual(fatte, ["paused", "paused"]);
  assert.ok(animazioni.every((a) => a.playState !== "paused"));

  /* Senza animazioni, senza nodo, o con un browser che non le sa: niente. */
  assert.equal(nonRestareFermo(null), 0);
  assert.equal(nonRestareFermo({}), 0);
  assert.equal(
    nonRestareFermo({
      getAnimations() {
        throw new Error("non supportato");
      },
    }),
    0,
  );
  /* Una che non vuole ripartire non ferma le altre. */
  const testarda = {
    playState: "paused",
    play() {
      throw new Error("no");
    },
  };
  const buona = una("paused");
  assert.equal(nonRestareFermo({ getAnimations: () => [testarda, buona] }), 1);
});

test("il foglio si dichiara sopra la finestra e si controlla a ogni disegno", () => {
  assert.match(SORGENTE_FOGLIO, /setAttribute\("data-dm-sopra-la-finestra", ""\)/);
  assert.match(SORGENTE_FOGLIO, /nonRestareFermo\(nodo\);\s*\n\s*sveglia\(vivo, adesso\);/);
  /* Le ultime 24 ore lette una volta sola per disegno: «sotto l'adesso» usa
   * la stessa lettura quando il periodo e' quello. */
  assert.match(SORGENTE_FOGLIO, /aperto\.modo === "ieri" \? null : storia/);
});
