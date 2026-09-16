/* «In alcune voci non ci sono più o vanno e vengono» (#561).
 *
 * Le icone del menù in basso. Non è la riscrittura della configurazione
 * all'avvio né la caduta della connessione — quelle sono sparite col ritorno
 * alla versione precedente, e questa no.
 *
 * «Vanno e vengono» dice che è una cosa che si ridisegna, e il ridisegno c'è:
 * il guscio ripassa la barra ogni tre secondi, e a ogni giro la plancia ci
 * rimette i disegni di casa. Per non rifare il lavoro a vuoto chi dipinge si
 * segna sulla casella quale disegno ci ha messo, e al giro dopo salta.
 *
 * Il segno però sta sulla CASELLA e il disegno sta DENTRO. Chi svuota il dentro
 * — un giro di disegno del guscio, una voce riscritta a metà, una stranezza del
 * motore del telefono — lascia in piedi il fuori, e da quel momento chi dipinge
 * legge il proprio segno, si dichiara a posto, e non rimette più niente: il
 * ridisegno c'è ma non ridisegna. L'icona sparisce e non torna più, e torna
 * soltanto quando la voce intera viene rifatta da capo — che è la parte che
 * «va e viene».
 *
 * La domanda giusta non è «me lo ricordo?» ma «c'è?».
 *
 * Qui si prova la domanda. Che la barra la usi davvero, e che l'icona torni
 * entro il giro dopo, lo prova `e2e/le-icone-della-barra-tornano.spec.js` sulla
 * plancia vera.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  CLASSE_DELL_OGGETTO,
  disegnoGiaNellaCasella,
  oggettoWidget,
} from "../src/core/oggetti-widget.js";

const leggi = (rel) => readFile(new URL(rel, import.meta.url), "utf8");

/* Una casella con dentro quello che le si mette: il minimo che serve alla
 * domanda, e nient'altro. */
function casella(dentro = null, segno = undefined) {
  return {
    dataset: segno === undefined ? {} : { dmOggetto: segno },
    firstElementChild: dentro,
  };
}
const nostro = { classList: { contains: (nome) => nome === CLASSE_DELL_OGGETTO } };
const altrui = { classList: { contains: () => false } };

test("il disegno c'è: non si rifà", () => {
  assert.equal(disegnoGiaNellaCasella(casella(nostro, "energia"), "energia"), true);
});

test("la casella svuotata si ridipinge, anche se il segno dice di no", () => {
  /* È la #561 in una riga: il segno resta, il disegno no. Prima di questa
   * correzione qui si rispondeva «a posto», e l'icona non tornava mai più. */
  assert.equal(disegnoGiaNellaCasella(casella(null, "energia"), "energia"), false);
  /* E lo stesso se al posto del disegno ci finisce qualcos'altro. */
  assert.equal(disegnoGiaNellaCasella(casella(altrui, "energia"), "energia"), false);
});

test("un disegno diverso da quello che serve non vale", () => {
  assert.equal(disegnoGiaNellaCasella(casella(nostro, "luci"), "energia"), false);
  /* Una casella mai dipinta non ha segno. */
  assert.equal(disegnoGiaNellaCasella(casella(nostro), "energia"), false);
  /* E una casella che non c'è non fa cadere niente. */
  assert.equal(disegnoGiaNellaCasella(null, "energia"), false);
});

test("la classe che si cerca è quella che il disegno porta davvero", () => {
  /* Se le due si scollassero, la domanda risponderebbe sempre «no» e la barra
   * si ridipingerebbe per sempre — il difetto opposto, e altrettanto vero. */
  assert.match(oggettoWidget("luci"), new RegExp(`<svg class="${CLASSE_DELL_OGGETTO}"`));
});

test("chi dipinge le icone chiede se il disegno c'è, non se se lo ricorda", async () => {
  /* Le due colonne che portano i disegni di casa — la barra in basso e la
   * colonna della configurazione — avevano la stessa guardia e lo stesso
   * difetto. Si correggono in un posto solo, e questa prova pretende che
   * restino tutt'e due agganciate a quello. */
  for (const rel of [
    "../src/sections/navigation-section.js",
    "../src/sections/beta4-mobile-polish-section.js",
  ]) {
    const sorgente = await leggi(rel);
    assert.match(sorgente, /disegnoGiaNellaCasella\(/, rel);
    /* E che nessuna delle due torni a fidarsi del solo ricordo. */
    assert.doesNotMatch(sorgente, /dataset\.dmOggetto\s*(===|!==)/, rel);
  }
});
