/* Quante case sono pronte, prima di accendere le licenze qui.
 *
 * Il giorno in cui su questa macchina si scrive `CHIAVE_PUBBLICA_LICENZE`, il
 * controllo si accende per tutti insieme: una casa senza un gettone gdahome
 * valido si vede chiudere i telefoni che arrivano da fuori, con `4402`.
 *
 * Il guaio non e' chi non paga — quello e' il punto. Il guaio e' **chi ha
 * l'add-on vecchio**: un gettone non ce l'ha e non sa nemmeno di doverlo
 * chiedere, perche' quella versione del ponte le licenze non le conosce. Si
 * chiuderebbe fuori da sola, pagante o no, e la sera che succede sono
 * telefonate.
 *
 * Quindi serve un numero, e serve **prima**: quante delle case collegate
 * adesso dicono la loro licenza. Finche' e' sotto il totale, accendere qui
 * vuol dire togliere l'accesso da fuori a quella differenza.
 *
 * Si conta anche — anzi, soprattutto — a controllo spento, che e' com'e'
 * oggi: se si contasse solo con la chiave scritta, il numero arriverebbe il
 * giorno dopo averne avuto bisogno.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { Centralino } from "../src/centralino.js";

const CASA = `casa_${"a".repeat(32)}`;
const ALTRA = `casa_${"b".repeat(32)}`;

/* Il minimo che serve a `quantePronteAllaLicenza`: una casa con un
 * identificativo, e il segno di aver detto (o non detto) la sua licenza. */
function centralinoCon(case_) {
  const centralino = new Centralino({ case: null, registro: null, chiaveLicenze: "" });
  for (const una of case_) centralino.collegate.set(una.id, una);
  return centralino;
}

const casa = (id) => ({ id, canali: new Map(), dicelaLicenza: false });

test("una casa che non ha mai detto la licenza non e' pronta", () => {
  const vecchia = casa(CASA);
  const centralino = centralinoCon([vecchia]);
  assert.equal(centralino.quanteCase(), 1);
  assert.equal(centralino.quantePronteAllaLicenza(), 0);
});

test("dirla la rende pronta, anche a controllo spento", () => {
  /* E' il caso di oggi: la chiave e' vuota, il controllo non c'e', e il
   * numero deve esserci lo stesso — se no lo si avrebbe il giorno dopo
   * averne avuto bisogno. */
  const nuova = casa(CASA);
  const centralino = centralinoCon([nuova]);
  assert.equal(centralino.chiaveLicenze, "");
  centralino.laLicenzaDi(nuova, "");
  assert.equal(centralino.quantePronteAllaLicenza(), 1);
});

test("si segna anche quando il gettone e' storto: e' l'add-on che si conta, non la licenza", () => {
  /* La domanda e' «il suo ponte sa che le licenze esistono», non «ha pagato».
   * Una casa Base col ponte nuovo manda un gettone vuoto, ed e' pronta:
   * quando si accende, lei diventa Base e lo sa — non sparisce da fuori
   * senza capire perche'. */
  const nuova = casa(CASA);
  const centralino = new Centralino({ case: null, registro: null, chiaveLicenze: "xy" });
  centralino.collegate.set(nuova.id, nuova);
  nuova.chiudiITelefoni = () => {};
  assert.equal(centralino.laLicenzaDi(nuova, "non-un-gettone"), false);
  assert.equal(centralino.quantePronteAllaLicenza(), 1);
});

test("il conto sta su quelle collegate adesso, e le mescola giuste", () => {
  const vecchia = casa(CASA);
  const nuova = casa(ALTRA);
  const centralino = centralinoCon([vecchia, nuova]);
  centralino.laLicenzaDi(nuova, "");
  assert.equal(centralino.quanteCase(), 2);
  assert.equal(centralino.quantePronteAllaLicenza(), 1);
  /* Ed e' questa la lettura: una casa su due si chiuderebbe fuori. */
  assert.equal(centralino.quanteCase() - centralino.quantePronteAllaLicenza(), 1);
});

test("una casa che se ne va esce anche dal conto", () => {
  const nuova = casa(CASA);
  const centralino = centralinoCon([nuova]);
  centralino.laLicenzaDi(nuova, "");
  assert.equal(centralino.quantePronteAllaLicenza(), 1);
  centralino.collegate.delete(nuova.id);
  assert.equal(centralino.quantePronteAllaLicenza(), 0);
});

test("la casa vera nasce non pronta, e lo diventa dicendo la sua licenza", () => {
  /* Le prove di sopra girano su una casa finta, che e' quello che serve al
   * conto. Questa invece prende la `CasaCollegata` vera, quella che nasce
   * quando un ponte bussa: se domani il campo si perdesse nel costruttore, il
   * conto direbbe zero per sempre e nessuno se ne accorgerebbe. */
  const centralino = new Centralino({ case: null, registro: null, chiaveLicenze: "" });
  const presa = { chiudi() {}, manda: () => true, quando() {} };
  const vera = centralino.accogliUnaCasa(presa, { da: "127.0.0.1" });
  assert.equal(vera.dicelaLicenza, false);

  /* Entrata, e contata: il conto guarda `collegate`. */
  vera.id = CASA;
  centralino.collegate.set(CASA, vera);
  assert.equal(centralino.quantePronteAllaLicenza(), 0);

  centralino.laLicenzaDi(vera, "");
  assert.equal(vera.dicelaLicenza, true);
  assert.equal(centralino.quantePronteAllaLicenza(), 1);
});
