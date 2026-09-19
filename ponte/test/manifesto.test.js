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

/* Le sezioni di un blocco del manifesto, e le caselle di ognuna.
 *
 * Dalla 1.5.8 le opzioni sono annidate: `casa:`, `chi_installa:`, e sotto le
 * caselle. E' l'unico modo che la scheda dell'add-on abbia di disegnare un
 * titolo — Home Assistant, piatte, le mette una sotto l'altra e basta.
 *
 * Si leggono a mano, contando i rientri, e non con un lettore di YAML: la
 * forma di questo blocco **e'** quello che si sta provando, e un lettore che
 * la normalizza guarderebbe da un'altra parte. Torna un elenco di coppie,
 * perche' anche l'ordine e' una cosa che si prova.
 *
 * Le sezioni stanno a due spazi in tutt'e tre i file. Le caselle no: nel
 * manifesto sono a quattro, nelle traduzioni a sei, perche' li' c'e' `fields:`
 * in mezzo — ed e' quello che dice `dentro`. */
function leSezioniDi(testo, blocco, dentro = 0) {
  const righe = testo.split("\n");
  const inizio = righe.findIndex((una) => una === `${blocco}:`);
  assert.notEqual(inizio, -1, `non c'e' nessun blocco «${blocco}:»`);
  const fuori = [];
  const laSezione = /^ {2}([a-z_]+):\s*$/;
  const laCasella = new RegExp(`^ {${4 + dentro * 2}}([a-z_]+):`);
  for (const una of righe.slice(inizio + 1)) {
    if (/^\S/.test(una)) break;
    const sezione = laSezione.exec(una);
    if (sezione) {
      fuori.push([sezione[1], []]);
      continue;
    }
    const casella = laCasella.exec(una);
    if (casella && fuori.length) fuori[fuori.length - 1][1].push(casella[1]);
  }
  assert.ok(fuori.length > 0, `il blocco «${blocco}:» non ha nessuna sezione`);
  return fuori;
}

/* Le caselle tutte di fila, sezione per sezione: «casa/quadro». Cosi' due
 * elenchi si confrontano in una riga sola, e un nome spostato da una sezione
 * all'altra si vede — che e' proprio il genere di cosa che si vuole vedere. */
const leChiaviDi = (testo, blocco, dentro = 0) =>
  leSezioniDi(testo, blocco, dentro).flatMap(([sezione, caselle]) =>
    caselle.map((una) => `${sezione}/${una}`),
  );

test("ogni opzione dell'add-on ha la sua riga nello schema", () => {
  /* Il Supervisor le vuole tutte e due, e uguali: un'opzione senza schema e' un
   * manifesto rifiutato, e una riga di schema senza opzione e' una casella che
   * compare vuota nella scheda dell'add-on. E' l'altro modo di far sparire un
   * add-on dal negozio. */
  const manifesto = readFileSync(qui("../config.yaml"), "utf8");
  assert.deepEqual(leChiaviDi(manifesto, "options").sort(), leChiaviDi(manifesto, "schema").sort());
});

/* Le opzioni si leggono nelle due lingue.
 *
 * `translations/it.yaml` e `translations/en.yaml` sono quelli che danno un nome
 * a ogni casella nella scheda dell'add-on: senza, Home Assistant scrive il nome
 * della chiave cosi' com'e' — «da_fuori_casa». E chi aggiunge un'opzione la
 * dimentica in uno dei due file, non in tutti e due: allora quella casella
 * torna a chiamarsi come la variabile, ma **in una lingua sola**, che e' il
 * genere di cosa che nessuno prova perche' nessuno tiene Home Assistant in due
 * lingue insieme. Qui invece si vede. */
const LE_LINGUE = ["it", "en"];

test("ogni opzione dell'add-on ha il suo nome in tutte le lingue", () => {
  const manifesto = readFileSync(qui("../config.yaml"), "utf8");
  const opzioni = leChiaviDi(manifesto, "options").sort();
  for (const lingua of LE_LINGUE) {
    const parole = readFileSync(qui(`../translations/${lingua}.yaml`), "utf8");
    assert.deepEqual(
      leChiaviDi(parole, "configuration", 1).sort(),
      opzioni,
      `«translations/${lingua}.yaml» non dice le stesse opzioni del manifesto`,
    );
    /* Il nome non basta che ci sia: deve dire qualcosa. Una voce con il solo
     * `description` lascia la casella chiamata come la variabile. */
    /* Il nome non basta che ci sia: deve dire qualcosa. E lo vogliono
     * tutt'e due — la sezione, che nella scheda diventa il **titolo**, e ogni
     * casella dentro. Una sezione senza nome e' un titolo che dice
     * «chi_installa». */
    for (const [sezione, caselle] of leSezioniDi(parole, "configuration", 1)) {
      assert.match(
        parole,
        new RegExp(`^ {2}${sezione}:\\n {4}name: \\S`, "m"),
        `in «translations/${lingua}.yaml» la sezione «${sezione}» non ha un titolo`,
      );
      for (const quale of caselle) {
        assert.match(
          parole,
          new RegExp(`^ {6}${quale}:\\n(?: {8}.*\\n)* {8}name: \\S`, "m"),
          `in «translations/${lingua}.yaml» la casella «${sezione}/${quale}» non ha un nome`,
        );
      }
    }
  }
});

test("le quattro liste stanno nello stesso ordine, e non solo con le stesse voci", () => {
  /* Quattro elenchi delle stesse dodici righe: le opzioni, lo schema, e i due
   * file delle lingue. Le prove qui sopra tengono che siano **le stesse**, e
   * le ordinano prima di confrontarle — cioe' guardano apposta da un'altra
   * parte rispetto all'ordine.
   *
   * L'ordine pero' e' quello che il Supervisor disegna nella scheda, e quella
   * scheda la leggono tre persone diverse: chi abita la casa, chi installa, e
   * una persona sola al mondo. Le tre chiavi in fondo restano vuote in tutte
   * le case tranne una, e stanno in fondo apposta — prima «La chiave della
   * console» stava fra i telefoni e l'installatore, e chi leggeva dall'alto
   * non aveva nessun modo di capire che non era roba sua.
   *
   * Senza questa prova quell'ordine e' una cosa che vive nella testa di chi
   * l'ha messo: il primo che aggiunge una casella la scrive dove capita, e la
   * scheda torna a essere un elenco. */
  const manifesto = readFileSync(qui("../config.yaml"), "utf8");
  const opzioni = leChiaviDi(manifesto, "options");
  assert.deepEqual(leChiaviDi(manifesto, "schema"), opzioni, "lo schema segue un altro ordine");
  for (const lingua of LE_LINGUE) {
    assert.deepEqual(
      leChiaviDi(readFileSync(qui(`../translations/${lingua}.yaml`), "utf8"), "configuration", 1),
      opzioni,
      `«translations/${lingua}.yaml» segue un altro ordine`,
    );
  }

  /* E le sezioni stanno in quest'ordine: prima quella di chi abita la casa,
   * poi le tre che restano vuote in tutte le case tranne una o due, e in fondo
   * i due numeri che non cambia nessuno. E' la regola che l'ordine serve a
   * tenere, e senza dirla questa prova fisserebbe l'ordine di oggi senza
   * sapere perche'. */
  assert.deepEqual(
    leSezioniDi(manifesto, "options").map(([quale]) => quale),
    ["casa", "chi_installa", "gestione", "assistenza", "avanzate"],
  );
});

test("le sezioni hanno un titolo che dice di chi e' quella roba", () => {
  /* Home Assistant, con le caselle piatte, non ha titoli di sezione: le
   * disegnava una sotto l'altra e basta, e per un anno l'unico posto dove dire
   * «questa non e' roba tua» e' stato il nome — «Casa · …», «Installatore · …».
   *
   * Era costato un'ora a chi l'ha usata per prima: la chiave del proprio
   * cruscotto era finita nella casella della casa, e da li' un `403` a ogni
   * giro che non diceva niente di utile. Il prefisso l'ha risolto a meta': con
   * tredici caselle in fila, «non si capisce un tubo» lo stesso.
   *
   * Adesso il titolo c'e' per davvero, perche' le caselle sono annidate. E
   * quindi il prefisso **non ci va piu'**: «La casa › Casa · Da fuori casa» e'
   * la stessa parola detta due volte. */
  for (const lingua of LE_LINGUE) {
    const parole = readFileSync(qui(`../translations/${lingua}.yaml`), "utf8");
    const titoli = [...parole.matchAll(/^ {4}name: (.*)$/gm)].map((una) => una[1]);
    assert.equal(titoli.length, 5, `«${lingua}.yaml» non ha cinque titoli di sezione`);
    for (const titolo of titoli) {
      assert.ok(titolo.trim().length > 2, `«${titolo}» non e' un titolo`);
    }
    const nomi = [...parole.matchAll(/^ {8}name: (.*)$/gm)].map((una) => una[1]);
    assert.equal(nomi.length, 14, `«${lingua}.yaml» non ha quattordici nomi di casella`);
    for (const nome of nomi) {
      assert.ok(
        !nome.includes(" · "),
        `«${nome}» porta ancora il prefisso: adesso lo dice il titolo della sezione`,
      );
    }
  }
});
