/* Quando i quattro numeri della mappa non possono essere veri tutti insieme
 * (#134).
 *
 * «Vedo tutto ma il flusso verso casa non va.» Il disegno era fedele: la
 * batteria diceva di caricarsi a 684 W, e con quell'ingresso le linee giuste
 * sono proprio quelle che si vedevano — il sole e la rete che riempiono la
 * batteria, verso casa niente. Ma entravano 24 W e ne uscivano 1346, e quella
 * casa non esiste.
 *
 * Qui si tiene fermo il giudizio, che e' aritmetica e si prova a tavolino: da
 * che parte si guarda, quanto si e' prudenti, e che il sospettato si dica solo
 * quando girargli il segno chiude davvero il conto.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  QUANTE_VOLTE_TROPPO,
  SCARTO_CHE_CONTA_W,
  laQuadraturaNonTorna,
} from "../src/core/energy-flow-truth.js";

/* I numeri veri della segnalazione: la batteria letta al contrario. */
const LA_SEGNALAZIONE = { solar: 5, grid: 19, battery: -684, home: 662 };

test("il caso della segnalazione si riconosce, e accusa la batteria", () => {
  const detto = laQuadraturaNonTorna(LA_SEGNALAZIONE);
  assert.ok(detto, "24 W che entrano e 1346 che escono non sono un impianto");
  assert.equal(detto.entra, 24);
  assert.equal(detto.esce, 1346);
  assert.equal(detto.manca, 1322);
  assert.equal(detto.chi, "battery");
});

test("e con la batteria nel verso giusto non si dice piu' niente", () => {
  /* Gli stessi numeri col segno rimesso a posto: entrano 708, ne escono 662,
   * e i 46 W di differenza sono la perdita dell'inverter. Un impianto sano non
   * deve sentirsi dire niente. */
  assert.equal(laQuadraturaNonTorna({ ...LA_SEGNALAZIONE, battery: 684 }), null);
});

test("le perdite non sono un errore: consumare meno di quanto arriva va bene", () => {
  /* Il verso che si guarda e' uno solo. Qui entrano 5000 W e la casa ne usa
   * 4000: mille watt di differenza, il venti per cento, e non c'e' niente da
   * dichiarare — l'energia che si perde per strada non e' energia inventata. */
  assert.equal(
    laQuadraturaNonTorna({ solar: 5000, grid: 0, battery: 0, home: 4000 }),
    null,
  );
});

test("una sorgente non dichiarata spegne il controllo", () => {
  /* La prima guardia, ed e' quella che evita il falso allarme peggiore: una
   * casa col fotovoltaico che non ha dichiarato il sensore del sole. Contarlo
   * zero farebbe sembrare impossibile un impianto sanissimo, quindi senza
   * tutti e quattro i numeri non si giudica. */
  assert.equal(laQuadraturaNonTorna({ grid: 19, battery: -684, home: 662 }), null);
  assert.equal(laQuadraturaNonTorna({ solar: 5, grid: 19, battery: -684 }), null);
  assert.equal(laQuadraturaNonTorna(), null);
});

test("e un sensore muto non vale zero", () => {
  /* Questa prova ha trovato un buco vero mentre nasceva. `Number(null)` fa
   * ZERO, e `null` e' proprio quello che torna la lettura di un sensore che
   * per un attimo non risponde: convertendo, un sole zitto sarebbe diventato
   * «zero watt», e zero watt dove ce n'erano duemila e' esattamente lo
   * sbilancio che questo controllo va a cercare. La guardia avrebbe fabbricato
   * il falso allarme che esiste per impedire. */
  for (const muto of [null, undefined, "", "5", NaN]) {
    assert.equal(
      laQuadraturaNonTorna({ solar: muto, grid: 19, battery: -684, home: 662 }),
      null,
      `«${String(muto)}» non e' una lettura, e non deve valere zero`,
    );
  }
});

test("sotto i trecento watt di scarto non si apre bocca", () => {
  /* La seconda guardia. Il solo rapporto griderebbe su una casa ferma: qui
   * esce venti volte quello che entra, ma sono dieci watt contro duecento, e
   * a quelle cifre tutto e' rumore del sensore. */
  const piccolo = { solar: 0, grid: 10, battery: 0, home: 200 };
  assert.ok(esceDaQuesta(piccolo) - entraInQuesta(piccolo) < SCARTO_CHE_CONTA_W);
  assert.equal(laQuadraturaNonTorna(piccolo), null);
});

test("e sotto il doppio nemmeno, per quanto grossi siano i numeri", () => {
  /* La terza. Qui mancano quattromila watt — molto piu' della soglia — ma ne
   * entrano seimila e ne escono diecimila: una volta e mezza, che una casa
   * grande con un sensore lento raggiunge senza essere rotta. */
  const grande = { solar: 6000, grid: 0, battery: 0, home: 10000 };
  assert.equal(esceDaQuesta(grande) / entraInQuesta(grande), 10000 / 6000);
  assert.ok(10000 / 6000 < QUANTE_VOLTE_TROPPO);
  assert.equal(laQuadraturaNonTorna(grande), null);
});

test("anche la rete girata si riconosce, e si accusa lei", () => {
  /* L'altro segno che si puo' sbagliare, e capita anche senza batteria: chi
   * preleva 3000 W letti come immissione. Escono 3000 di casa piu' 3000 che
   * si crede di regalare alla rete, e ne entrano 100 dal sole. */
  const detto = laQuadraturaNonTorna({ solar: 100, grid: -3000, battery: 0, home: 3000 });
  assert.ok(detto);
  assert.equal(detto.chi, "grid");
});

test("se girare un segno non chiude il conto, non si accusa nessuno", () => {
  /* Dire il nome sbagliato e' peggio che non dirlo: si manda chi legge a
   * cambiare una casella giusta, e il difetto resta dov'e'. Qui manca corrente
   * da qualche parte che non e' ne' la rete ne' la batteria — un sensore di
   * casa che conta il doppio, per dire — e l'avviso lo dice senza inventarsi
   * un colpevole. */
  const detto = laQuadraturaNonTorna({ solar: 0, grid: 100, battery: 0, home: 9000 });
  assert.ok(detto);
  assert.equal(detto.chi, "");
});

test("il verdetto porta i numeri che servono a scriverlo", () => {
  const detto = laQuadraturaNonTorna(LA_SEGNALAZIONE);
  assert.equal(detto.esce - detto.entra, detto.manca);
  assert.ok(detto.manca >= SCARTO_CHE_CONTA_W);
  assert.ok(detto.esce > detto.entra * QUANTE_VOLTE_TROPPO);
});

/* Gli stessi due conti del nucleo, rifatti qui: servono a dire nelle prove
 * quanto entra e quanto esce senza esportare due funzioni che alla plancia non
 * servono. Se un giorno divergessero, le prove sopra cadrebbero per prime. */
const entraInQuesta = ({ solar = 0, grid = 0, battery = 0 }) =>
  Math.max(solar, 0) + Math.max(grid, 0) + Math.max(battery, 0);
const esceDaQuesta = ({ grid = 0, battery = 0, home = 0 }) =>
  Math.max(home, 0) + Math.max(-grid, 0) + Math.max(-battery, 0);
