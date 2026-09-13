/* Il manifesto dell'add-on: l'unico file che legge qualcun altro.
 *
 * Una prova che sembra inutile, e non lo e'. Il `config.yaml` del ponte non lo
 * apre nessuno dei programmi che stanno qui: lo legge il **Supervisor** di Home
 * Assistant, su un'altra macchina, dentro un negozio di add-on. E se non si
 * legge, li' non succede niente di rumoroso — l'archivio si aggiunge, e dentro
 * non c'e' nessun add-on. Nessun errore, nessuna riga rossa: la voce
 * semplicemente non compare.
 *
 * E' andata cosi' per un giorno. Nella descrizione dell'add-on c'era un «due
 * punti» seguito da uno spazio, senza virgolette, e in YAML quella e' la cosa
 * che separa una chiave dal suo valore: il manifesto era illeggibile. Da qui
 * non se ne sapeva nulla, perche' le prove erano tutte verdi — nessuna leggeva
 * quel file. Quello che sembrava «l'add-on non compare nel negozio» era un
 * segno di interpunzione.
 *
 * **Perche' qui non c'e' un lettore di YAML.** Le prove del ponte girano su
 * Node e basta, senza installare niente: e' scritto anche nel workflow, ed e'
 * una proprieta' che vale piu' di questa prova. Quindi qui si guardano le due
 * regole che quel file deve rispettare, e che sono esattamente i due modi in
 * cui lo si rompe scrivendoci dentro. Il file letto **per davvero** da un
 * lettore di YAML lo guarda `npm run format:check`, cioe' prettier, che nel
 * lavoro della forma del codice c'e' — e li' `ponte/config.yaml`,
 * `repository.yaml` e `ponte/build.yaml` ci sono dentro apposta.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const qui = (relativo) => fileURLToPath(new URL(relativo, import.meta.url));

/* I file che Home Assistant legge prima di far comparire qualcosa: l'archivio,
 * il manifesto dell'add-on, e come si costruisce. */
const MANIFESTI = [
  ["l'archivio", "../../repository.yaml"],
  ["il manifesto dell'add-on", "../config.yaml"],
  ["come si costruisce", "../build.yaml"],
];

/* Una riga «chiave: valore» col valore scritto in chiaro. Le liste (`- roba`),
 * i commenti e le righe vuote non sono questo. */
const UNA_RIGA = /^(\s*)([a-z_][a-z0-9_]*):[ \t]+(.+)$/i;

test("nessun valore scritto in chiaro contiene un «due punti» piu' spazio", () => {
  /* La regola che ci e' costata un giorno. In YAML «due punti piu' spazio» e'
   * quello che separa una chiave dal suo valore: dentro un valore senza
   * virgolette non ci puo' stare, e il file diventa illeggibile per intero —
   * non solo quella riga. Una frase italiana quei due punti li vuole, e allora
   * la frase si mette fra virgolette. */
  for (const [chi, dove] of MANIFESTI) {
    const righe = readFileSync(qui(dove), "utf8").split("\n");
    righe.forEach((una, quante) => {
      if (/^\s*#/.test(una)) return;
      const trovata = UNA_RIGA.exec(una);
      if (!trovata) return;
      const valore = trovata[3].trim();
      if (valore.startsWith('"') || valore.startsWith("'") || valore.startsWith("#")) return;
      /* Il commento in coda non e' parte del valore. */
      const senzaCommento = valore.split(" #")[0];
      assert.ok(
        !/:[ \t]/.test(senzaCommento),
        `${chi}, riga ${quante + 1}: «${trovata[2]}» ha un «due punti» dentro un ` +
          `valore senza virgolette, e cosi' il file non si legge:\n  ${una.trim()}`,
      );
    });
  }
});

/* Le chiavi di un blocco del manifesto, quelle rientrate di due spazi.
 *
 * Si leggono a mano perche' quello che si guarda e' un elenco di nomi in un
 * blocco piatto, non una struttura. Se un giorno quel blocco cambiasse forma,
 * le liste tornerebbero vuote e la prova lo direbbe. */
function leChiaviDi(testo, blocco) {
  const righe = testo.split("\n");
  const inizio = righe.findIndex((una) => una === `${blocco}:`);
  assert.notEqual(inizio, -1, `nel manifesto non c'e' nessun blocco «${blocco}:»`);
  const chiavi = [];
  for (const una of righe.slice(inizio + 1)) {
    if (/^\S/.test(una)) break;
    const trovata = /^ {2}([a-z_]+):/.exec(una);
    if (trovata) chiavi.push(trovata[1]);
  }
  assert.ok(chiavi.length > 0, `il blocco «${blocco}:» non ha nessuna chiave`);
  return chiavi;
}

test("ogni opzione dell'add-on ha la sua riga nello schema", () => {
  /* Il Supervisor le vuole tutte e due, e uguali: un'opzione senza schema e' un
   * manifesto rifiutato, e una riga di schema senza opzione e' una casella che
   * compare vuota nella scheda dell'add-on. E' l'altro modo di far sparire un
   * add-on dal negozio. */
  const manifesto = readFileSync(qui("../config.yaml"), "utf8");
  assert.deepEqual(leChiaviDi(manifesto, "options").sort(), leChiaviDi(manifesto, "schema").sort());
});
