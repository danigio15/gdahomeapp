/* «Non funziona da app web.» La chiave arrivava «a spinta»: chi ospita la
 * pagina cercava il riquadro e gliela mandava, indovinando il momento — e
 * nell'app web non arrivava. Adesso e' la pagina a chiedere, a chi la
 * contiene e a chi l'ha aperta, finche' qualcuno risponde. Provato in
 * Chromium con un ospite che risponde e basta: si apre senza chiedere, nel
 * riquadro e nella scheda. Qui si tiene fermo com'e' scritto. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const QUI = dirname(fileURLToPath(import.meta.url));
const CRUSCOTTO = readFileSync(join(QUI, "..", "console", "index.html"), "utf8");

test("senza chiave la pagina la chiede a chi la ospita, e smette appena arriva", () => {
  const corpo = CRUSCOTTO.slice(CRUSCOTTO.indexOf("function chiediLaChiaveAChiMiOspita()"));
  const funzione = corpo.slice(0, corpo.indexOf("\n      }\n") + 9);
  assert.match(funzione, /if \(chiave\) return;/);
  /* A chi la contiene e a chi l'ha aperta: tutte e due, quando ci sono. */
  assert.match(funzione, /window\.parent !== window\) ospiti\.push\(window\.parent\)/);
  assert.match(funzione, /if \(window\.opener\) ospiti\.push\(window\.opener\)/);
  /* La domanda non porta niente, quindi va a chiunque. */
  assert.match(funzione, /postMessage\(\{ gdahome: "chiave\?" \}, "\*"\)/);
  /* Piu' colpi, a distanza crescente, e ognuno si ferma se la chiave c'e'. */
  assert.match(
    funzione,
    /for \(const fra of \[400, 1200, 3000, 7000\]\) setTimeout\(domanda, fra\)/,
  );
  /* Col biglietto non si chiede: la chiave arriva da quello. */
  assert.match(CRUSCOTTO, /if \(!BIGLIETTO\) chiediLaChiaveAChiMiOspita\(\);/);
});

test("la risposta entra dalla stessa porta della consegna: e' lo stesso messaggio", () => {
  assert.match(CRUSCOTTO, /if \(!detto \|\| detto\.gdahome !== "chiave"\) return;/);
  /* E quella battuta a mano resta padrona, come per la consegna. */
  const ascolto = CRUSCOTTO.slice(CRUSCOTTO.indexOf('addEventListener("message"'));
  assert.match(ascolto.slice(0, 1400), /consegnata = arrivata;\s*if \(chiave\) return;/);
});

test("la risposta si prende solo da chi ci tiene, e da un'origine nuova solo dopo un si'", () => {
  /* Prima si prendeva da chiunque: una pagina qualunque che mettesse il
   * cruscotto in un riquadro gli poteva consegnare la sua chiave, e chi
   * guardava lavorava in un cruscotto non suo. */
  const ascolto = CRUSCOTTO.slice(CRUSCOTTO.indexOf('addEventListener("message"')).slice(0, 1400);
  assert.match(ascolto, /if \(!daChiCiTiene\(evento\.source\)\) return;/);
  assert.match(ascolto, /if \(!origineFidata\(String\(evento\.origin \|\| ""\)\)\) \{/);
  /* Da un'origine nuova si offre, con scritto da dove viene, e non si prende. */
  assert.match(
    ascolto,
    /offerta = \{ chiave: arrivata, origine: String\(evento\.origin \|\| ""\) \};/,
  );
  assert.match(CRUSCOTTO, /id="usa-la-consegnata"/);
  assert.match(CRUSCOTTO, /\$\{testo\(offerta\.origine\)\}/);
  /* Le origini fidate: questa, quelle scritte dal quadro, quelle gia' dette. */
  assert.match(CRUSCOTTO, /origine === location\.origin \|\|/);
  assert.match(CRUSCOTTO, /<meta name="gdahome-ospiti" content="" \/>/);
  /* Avuta la chiave, o smesso di aspettarla, chi ci ha aperto si lascia
   * andare: la pagina non tiene in mano una finestra dell'app. */
  assert.match(CRUSCOTTO, /if \(window\.opener\) window\.opener = null;/);
  assert.match(ascolto, /lasciaChiMiHaAperto\(\);\s*consegnata = arrivata;/);
  assert.match(CRUSCOTTO, /setTimeout\(lasciaChiMiHaAperto, 10000\);/);
  /* E la chiave sta nella scheda, non nel browser. */
  assert.doesNotMatch(CRUSCOTTO, /localStorage\.setItem\(DOVE_STA_LA_CHIAVE/);
  assert.match(CRUSCOTTO, /localStorage\.removeItem\(DOVE_STA_LA_CHIAVE\)/);
});
