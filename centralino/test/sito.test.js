/* Il sito su gdahome.org: due pagine ferme, e due promesse da tenere.
 *
 * Le prove stanno qui, e non e' un caso: sono quelle che la macchina gira
 * prima di scambiare una versione con un'altra (`scarica.sh`). Una pagina
 * rotta, o un'informativa che non dice piu' quello che dice il codice, non
 * arriva a prendere il posto di una che stava bene.
 *
 * Le promesse sono due, e tutte e due si possono rompere per distrazione:
 *
 *  - **niente che venga da fuori**. La pagina dice a chi la apre che non c'e'
 *    nessun carattere scaricato, nessuna libreria, nessun contatore. Basta un
 *    `<link>` a un font per farla diventare una bugia, e nessuno se ne
 *    accorgerebbe guardandola;
 *  - **l'informativa pubblicata e' quella scritta**. `docs/PRIVACY.md` e
 *    `sito/privacy.html` sono la stessa cosa detta due volte: quello che il
 *    Play Store legge e' la seconda, ma quella che si corregge, quando si
 *    corregge, e' quasi sempre la prima.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RADICE = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const leggi = (dove) => readFileSync(join(RADICE, dove), "utf8");

const PAGINE = ["sito/index.html", "sito/privacy.html"];

test("le pagine ci sono, e hanno un nome", () => {
  for (const quale of PAGINE) {
    const pagina = leggi(quale);
    assert.ok(pagina.length > 500, `«${quale}» e' troppo corta per essere una pagina`);
    assert.match(pagina, /<title>[^<]+<\/title>/, `«${quale}» non ha un titolo`);
  }
});

test("niente viene da fuori: nessun carattere, nessuna libreria, nessun contatore", () => {
  /* La pagina lo promette a parole. Qui si guarda che sia vero: tutto quello
   * che la pagina tira su deve stare di fianco a lei. */
  const fuori = /(?:src|href)="(https?:)?\/\/[^"]+"/g;
  for (const quale of PAGINE) {
    const pagina = leggi(quale);
    for (const riga of pagina.split("\n")) {
      /* I collegamenti su cui si clicca sono un'altra cosa: quelli portano
       * via, non tirano dentro. Si guardano solo le cose che il browser va a
       * prendere da solo. */
      if (/<a\s/.test(riga)) continue;
      const preso = riga.match(fuori);
      assert.equal(preso, null, `«${quale}» si porta dentro una cosa da fuori: ${preso?.[0]}`);
    }
  }
});

test("l'informativa pubblicata dice quello che dice quella scritta", () => {
  const scritta = leggi("docs/PRIVACY.md");
  const pubblicata = leggi("sito/privacy.html");

  /* Ogni sezione dell'una sta anche nell'altra. Aggiungerne una sola da una
   * parte — «Cosa fa l'assistente vocale», un domani — e dimenticarla
   * dall'altra vuol dire pubblicare un'informativa che non e' quella vera. */
  const sezioni = [...scritta.matchAll(/^## (.+)$/gm)].map((una) => una[1]);
  assert.ok(sezioni.length >= 8, `mi aspettavo piu' sezioni, ne ho trovate ${sezioni.length}`);
  for (const titolo of sezioni) {
    assert.ok(
      pubblicata.includes(titolo),
      `la sezione «${titolo}» c'e' in docs/PRIVACY.md e non su gdahome.org`,
    );
  }

  /* E la data: un'informativa cambiata che porta la data di prima e' peggio di
   * una non cambiata, perche' dice a chi la legge che non e' successo niente. */
  const quando = /^Ultimo aggiornamento: (.+)$/m.exec(scritta);
  assert.ok(quando, "docs/PRIVACY.md non dice di quando e'");
  assert.ok(pubblicata.includes(quando[1]), `la pagina porta una data diversa da «${quando[1]}»`);
});

test("dall'indice ci si arriva, e senza passare da GitHub", () => {
  /* L'indirizzo che il Play Store tiene e' quello del sito: se il collegamento
   * tornasse a puntare al file su GitHub, la pagina che Google controlla e
   * quella che la gente trova non sarebbero piu' la stessa. */
  const indice = leggi("sito/index.html");
  assert.match(indice, /href="privacy\.html"/, "l'indice non manda all'informativa di casa");
});
