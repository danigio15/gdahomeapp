/* L'italiano che si vede e che si sente e' scritto per esteso.
 *
 * In questa repository i commenti scrivono «e'», «perche'», «piu'», «gia'»:
 * e' una convenzione, e per un commento va benissimo. Sullo schermo no — li'
 * e' semplicemente italiano sbagliato — e nella voce e' peggio, perche' chi
 * fa i suoni legge l'apostrofo come una pausa e la parola esce spezzata in
 * due.
 *
 * Fra le due cose c'e' un copia-e-incolla di distanza: le frasi del film
 * stanno **negli stessi file** dei commenti che le spiegano, a volte due
 * righe sotto. Questa prova tiene separate le due scritture.
 *
 * Il modo di distinguerle e' meccanico, e non ha bisogno di sapere
 * l'italiano: in una parola elisa l'apostrofo ha **una lettera dopo**
 * (`l'impianto`, `dell'add-on`, `nessun'altra`, `un'eMMC`). Un accento
 * scritto con l'apostrofo no: dopo ha uno spazio o un punto. L'unica parola
 * vera che finisce in apostrofo e' «po'», e quella e' l'eccezione.
 *
 * Quello che questa prova **non** sa dire e' se la frase e' scritta bene —
 * se «resta fermo a sei mesi fa» sia italiano, o se lo schermo stia dicendo
 * la stessa cosa della voce. Quello lo legge una persona, e va riletto ogni
 * volta che si cambia una riga del copione.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PARLATO } from "../video/parlato.js";

const QUI = dirname(fileURLToPath(import.meta.url));

/** Le frasi che si vedono, dal markup di **tutti** i film. */
function leDidascalie() {
  /* Tutti, e non solo quello del quadro: la convenzione dei commenti e' la
     stessa in ogni file di questa cartella, e quindi lo e' anche il rischio. */
  const cartella = join(QUI, "..", "video");
  return readdirSync(cartella)
    .filter((nome) => nome.endsWith(".js"))
    .flatMap((nome) => {
      /* Via i commenti, se no si pescano le frasi che stanno **dentro** i
         commenti — che e' proprio la scrittura da cui si vuole stare
         separati. */
      const dentro = readFileSync(join(cartella, nome), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      /* Il primo pezzo di `t("italiano", "inglese")`, con gli apici di tutte
         e due le razze e le fughe rimesse a posto. */
      return [...dentro.matchAll(/t\(\s*(["'])((?:\\.|(?!\1).)*)\1/g)].map((una) => [
        nome,
        una[2].replace(/\\(['"])/g, "$1"),
      ]);
    });
}

/** Le frasi del film: quelle che si sentono. */
const leBattute = () => PARLATO.flatMap((scena) => scena.pezzi.map((pezzo) => pezzo.it));

/** Senza i tag, che non si vedono e non si sentono. */
const soloParole = (testo) => testo.replace(/<[^>]*>/g, " ");

const TUTTE = () => [
  ...leDidascalie().map(([nome, testo]) => [`si vede (${nome})`, testo]),
  ...leBattute().map((testo) => ["si sente", testo]),
];

test("nessun accento scritto con l'apostrofo", () => {
  for (const [dove, grezzo] of TUTTE()) {
    const testo = soloParole(grezzo);
    for (const trovata of testo.matchAll(/(\w*)'(.?)/g)) {
      const [, prima, dopo] = trovata;
      if (/[\p{L}]/u.test(dopo)) continue; // elisione: `l'impianto`
      if (prima.toLowerCase() === "po") continue; // «un po'», che e' cosi'
      assert.fail(
        `«${prima}'» in una frase che ${dove}:\n      ${testo.trim()}\n` +
          `      Sullo schermo e nella voce l'accento si scrive sulla vocale — «è»,\n` +
          `      «più», «perché», «già», «così», «può» — e l'apostrofo si lascia ai commenti.`,
      );
    }
  }
});

test("le virgolette del film si aprono e si chiudono", () => {
  for (const [dove, grezzo] of TUTTE()) {
    const testo = soloParole(grezzo);
    const aperte = (testo.match(/«/g) ?? []).length;
    const chiuse = (testo.match(/»/g) ?? []).length;
    assert.equal(
      aperte,
      chiuse,
      `virgolette scompagnate (${aperte} aperte, ${chiuse} chiuse) in una frase che ${dove}:\n` +
        `      ${testo.trim()}`,
    );
  }
});
