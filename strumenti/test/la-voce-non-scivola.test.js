/* La voce non scivola via dal film.
 *
 * La traccia del film del quadro si monta mettendo ogni frase a un secondo
 * preciso, e quel secondo e' lo stesso che `parlato-tempi.json` passa alle
 * didascalie: se la traccia finita dura anche solo un po' meno di quello che
 * dicono i conti, la voce e le parole scritte si staccano — piano, un pezzo
 * per volta, e alla fine del film di mezzo secondo.
 *
 * Il guasto che questa prova tiene lontano e' vero e ha un nome: `rubberband`,
 * che abbassa la voce, **accorcia dello 0,3%**. Su quattro minuti sono otto
 * decimi di secondo. Per questo sta in `abbassaLaVoce`, che lavora su un pezzo
 * per volta *prima* che i tempi siano contati — cosi' ogni pezzo viene poi
 * misurato com'e' venuto davvero — e non puo' stare in `RIPULITURA`, che gira
 * sulla traccia gia' montata, dove quello 0,3% non lo recupera piu' nessuno.
 *
 * Da fuori le due cose si somigliano: sono due liste di filtri di ffmpeg. La
 * differenza e' che una puo' permettersi di spostare il tempo e l'altra no.
 *
 * Percio' qui l'elenco e' **al contrario**: non i filtri vietati, ma quelli
 * ammessi. Un filtro che sposta il tempo e a cui nessuno ha pensato passerebbe
 * una lista di divieti; da una lista di permessi no, e chi ne aggiunge uno
 * deve fermarsi un momento a dire se il tempo lo tocca.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const QUI = dirname(fileURLToPath(import.meta.url));
const VOCE = readFileSync(join(QUI, "..", "video", "voce.mjs"), "utf8");

/* Filtri che cambiano il suono e lasciano stare la durata. */
const LASCIANO_STARE_IL_TEMPO = new Set([
  "highpass",
  "lowpass",
  "bandpass",
  "equalizer",
  "treble",
  "bass",
  "anequalizer",
  "deesser",
  "acompressor",
  "alimiter",
  "agate",
  "volume",
  "loudnorm",
]);

/** La lista di filtri che sta in `const <nome> = [ … ];`, letta dal sorgente. */
function laLista(nome) {
  const trovata = VOCE.match(new RegExp(`const ${nome} = \\[([\\s\\S]*?)\\];`));
  assert.ok(trovata, `in voce.mjs non c'e' piu' nessun «const ${nome} = [ … ]»`);
  return [...trovata[1].matchAll(/"([^"]+)"/g)].map((una) => una[1]);
}

test("i filtri che ripuliscono la voce non spostano il tempo", () => {
  const filtri = laLista("RIPULITURA");
  assert.ok(filtri.length > 0, "RIPULITURA e' vuota: la voce esce come esce dal modello");

  for (const filtro of filtri) {
    const nome = filtro.split("=")[0].trim();
    assert.ok(
      LASCIANO_STARE_IL_TEMPO.has(nome),
      `«${nome}» gira sulla traccia gia' montata, e li' un filtro puo' spostare il tempo\n` +
        `      solo se qualcuno rifa' i conti. Se davvero lascia stare la durata, mettilo\n` +
        `      fra quelli ammessi qui sopra; se la cambia — come «rubberband» o «atempo» —\n` +
        `      il suo posto e' «abbassaLaVoce», che lavora prima che i tempi siano contati.`,
    );
  }
});

test("chi abbassa la voce lo fa un pezzo per volta, prima dei conti", () => {
  /* Non basta che `rubberband` non sia in RIPULITURA: deve essere da qualche
     parte, se no la voce torna alta come usciva dal modello. */
  assert.match(
    VOCE,
    /async function abbassaLaVoce\([\s\S]*?rubberband=pitch=/,
    "«abbassaLaVoce» non sposta piu' l'altezza: la voce esce com'esce dal modello",
  );

  /* E deve essere chiamata dove i pezzi sono ancora pezzi. Dopo — sulla
     traccia montata — sarebbe lo 0,3% che non si recupera. */
  const dentro = VOCE.indexOf("await abbassaLaVoce(");
  const iConti = VOCE.indexOf("function iTempi(");
  assert.ok(dentro !== -1, "nessuno chiama piu' «abbassaLaVoce»");
  assert.ok(
    dentro < iConti,
    "«abbassaLaVoce» viene chiamata dopo che i tempi sono stati contati: " +
      "i pezzi misurati non sono piu' quelli che finiscono nel film",
  );
});
