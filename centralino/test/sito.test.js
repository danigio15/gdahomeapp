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
    /* `<title ...>`: il titolo porta la sua traduzione inglese in un
       attributo (`data-en`), quindi fra il nome del tag e la parentesi ci puo'
       stare altro. */
    assert.match(pagina, /<title[^>]*>[^<]+<\/title>/, `«${quale}» non ha un titolo`);
  }
});

test("niente viene da fuori: nessun carattere, nessuna libreria, nessun contatore", () => {
  /* La pagina lo promette a parole. Qui si guarda che sia vero: tutto quello
   * che la pagina tira su deve stare di fianco a lei. */
  const fuori = /(?:src|href)="(https?:)?\/\/[^"]+"/g;

  /* I collegamenti su cui si clicca sono un'altra cosa: quelli portano via,
   * non tirano dentro. Si guardano solo le cose che il browser va a prendere
   * da solo, e quindi gli `<a>` si tolgono di mezzo prima di guardare.
   *
   * Si tolgono **per tag e non per riga**. Prima si saltava la riga che
   * conteneva un `<a`, che e' la stessa cosa finche' un collegamento sta tutto
   * su una riga sola. Ma un `<a>` con tre attributi e un indirizzo lungo,
   * prettier lo apre su piu' righe — e l'`href` finisce su una riga dove di
   * `<a` non c'e' traccia. La prova lo leggeva come un font scaricato da
   * Google, e falliva su un link su cui si clicca. */
  /* Le parole inglesi della pagina stanno in un attributo `data-en`, e in
     qualche frase dentro c'e' un collegamento: li' il `<a ...>` sta scritto
     con le entita' — `&lt;a href="..."&gt;` — perche' quello e' il contenuto
     di un attributo. Va tolto di mezzo come l'altro: e' un collegamento su cui
     si clicca, non una cosa che il browser va a prendere. Quello che invece
     resta guardato e' tutto il resto di quegli attributi, e deve restare: un
     `src` forestiero dentro un `data-en` diventerebbe vero appena la pagina si
     legge in inglese. */
  const senzaCollegamenti = (pagina) =>
    pagina.replace(/<a\s[^>]*>/g, "").replace(/&lt;a\s[^&]*&gt;/g, "");

  for (const quale of PAGINE) {
    const preso = senzaCollegamenti(leggi(quale)).match(fuori);
    assert.equal(preso, null, `«${quale}» si porta dentro una cosa da fuori: ${preso?.[0]}`);
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

/* ─── La lingua ──────────────────────────────────────────────────────────── */

test("le due pagine hanno i tasti della lingua, e le sigle non si traducono", () => {
  /* Il selettore sta in cima a tutte e due le pagine: chi arriva
     sull'informativa da un link del Play Store deve poterla leggere nella sua
     lingua senza tornare all'indice.

     «IT» e «EN» non hanno un `data-en` e non devono averlo: si leggono uguali
     in tutte le lingue, ed e' il motivo per cui su un selettore si usano le
     sigle invece dei nomi. Un `data-en` la' sopra vorrebbe dire un tasto che
     cambia nome quando lo si preme. */
  for (const quale of PAGINE) {
    const pagina = leggi(quale);
    for (const lingua of ["it", "en"]) {
      const tasto = new RegExp(`<button[^>]*data-lingua="${lingua}"[^>]*>`);
      assert.match(pagina, tasto, `in «${quale}» manca il tasto «${lingua}»`);
      const scritto = tasto.exec(pagina)[0];
      assert.ok(
        !scritto.includes("data-en"),
        `in «${quale}» il tasto «${lingua}» porta una traduzione: le sigle non si traducono`,
      );
    }
  }
});

test("ogni frase inglese della pagina dice qualcosa", () => {
  /* Un `data-en` vuoto e' peggio di un `data-en` che non c'e': quando la
     pagina passa all'inglese, quel pezzo si cancella invece di restare in
     italiano. */
  for (const quale of PAGINE) {
    for (const trovata of leggi(quale).matchAll(/data-en(?:-[a-z-]+)?=("|')(.*?)\1/gs)) {
      assert.ok(
        trovata[2].trim().length > 0,
        `in «${quale}» c'e' un «data-en» vuoto: in inglese quel pezzo sparirebbe`,
      );
    }
  }
});

/* ─── Quello che la pagina promette, e che il codice deve confermare ─────── */

test("il sito non racconta un codice di abbinamento diverso da quello vero", async () => {
  /* La pagina diceva «otto lettere», e il codice ne fa **sedici**: era vero
     quando il codice era di otto, ed e' rimasto scritto li' dopo. Nessuna prova
     lo guardava, perche' una pagina non si compila — e una promessa sbagliata
     su come si abbina un telefono e' la prima cosa che legge chi arriva.
     Adesso la lunghezza vera la dice `segreti.js`, e la pagina deve dire
     quella. */
  const { codiceNuovo } = await import("../../ponte/src/segreti.js");
  const quanti = codiceNuovo().length;
  const aParole = {
    8: ["otto", "eight"],
    12: ["dodici", "twelve"],
    16: ["sedici", "sixteen"],
    20: ["venti", "twenty"],
  }[quanti];
  assert.ok(aParole, `il codice e' di ${quanti} caratteri e qui non so come si scrive`);
  const indice = leggi("sito/index.html");
  for (const [lingua, parola] of [
    ["italiano", aParole[0]],
    ["inglese", aParole[1]],
  ])
    assert.ok(
      indice.includes(parola),
      `il sito non dice in ${lingua} quanti caratteri ha il codice (${parola})`,
    );
  /* E non deve dire nessun altro numero: una pagina che dice due lunghezze
     diverse e' peggio di una che ne dice una sbagliata. */
  for (const [quante, come] of Object.entries({ 8: "otto", 12: "dodici", 20: "venti" }))
    if (Number(quante) !== quanti)
      assert.ok(
        !new RegExp(`${come} (lettere|caratteri)`, "i").test(indice),
        `il sito parla di «${come} lettere», ma il codice e' di ${quanti} caratteri`,
      );
});
