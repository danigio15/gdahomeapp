/* Tagliare un testo senza spezzare quello che una persona vede come un
 * carattere solo.
 *
 * `slice` conta le unita' UTF-16, e un emoji ne occupa due: tagliare in mezzo
 * lascia mezza coppia, che non e' un carattere.
 *
 * E il guaio arriva in ritardo, che e' la parte scomoda. Nel JSON quella meta'
 * viene scappata e torna indietro identica: in rete non si rompe niente, e
 * guardando le richieste non si vede nulla. Si rompe **all'arrivo**, appena il
 * testo viene scritto come UTF-8: nell'archivio che lo conserva, su uno schermo
 * che lo mostra. Un «grazie 🙏» che finisce esattamente sul limite non diventa
 * «grazie »: diventa «grazie �», e resta scritto cosi'.
 *
 * Contare i punti di codice invece delle unita' basta a non rompere niente, ma
 * non basta a non fare danni: una bandiera, un pollice col colore della pelle,
 * una famiglia, sono piu' punti di codice tenuti insieme da giunture
 * invisibili. Tagliare fra quelli lascia caratteri veri, pero' fa comparire
 * pezzi che nessuno ha scritto — mezza famiglia, un pollice che cambia colore.
 * `Intl.Segmenter` sa dove stanno le giunture; dove non c'e', si ripiega sui
 * punti di codice, che e' la parte che conta.
 *
 * Il limite resta contato in unita' UTF-16, come prima: quello che cambia e'
 * soltanto **dove** si taglia, non quanto ne passa. Un archivio che accettava
 * quattromila continua ad accettarne quattromila.
 */

/* `false` vuol dire «non ancora chiesto», `null` «non c'e'». */
let aGruppi = false;

function segmenta(testo) {
  if (aGruppi === false) {
    try {
      aGruppi = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    } catch (_errore) {
      aGruppi = null;
    }
  }
  return aGruppi ? [...aGruppi.segment(testo)].map((uno) => uno.segment) : Array.from(testo);
}

export function tagliaBene(testo, massimo) {
  const tutto = String(testo ?? "");
  if (tutto.length <= massimo) return tutto;
  let fuori = "";
  for (const pezzo of segmenta(tutto)) {
    if (fuori.length + pezzo.length > massimo) break;
    fuori += pezzo;
  }
  return fuori;
}
