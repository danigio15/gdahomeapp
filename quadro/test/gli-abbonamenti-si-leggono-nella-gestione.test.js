/* La schermata «Abbonamenti» della Gestione gdahome (1.10.0).
 *
 * «Nella sezione Gestione gdahome creami un'altra parte dove mi devi dire
 * quanti abbonamenti fatti su Apple e su Play Store, se sono mensili o annuali
 * e quanti nel periodo di prova.» I conti li fa il quadro e li provano le
 * prove delle licenze (`le-licenze.test.js`, «Gli abbonamenti»); questa tiene
 * ferma la pagina: la voce nella barra, da dove prende i numeri, e le cose
 * che deve dire a chi la legge.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const QUI = dirname(fileURLToPath(import.meta.url));
const GESTORE = readFileSync(join(QUI, "..", "gestore", "index.html"), "utf8");

/* La voce delle licenze si chiama «Regali e codici» dalla Gestione a sezioni:
 * dentro ci sono i regali e i codici, e quello che si compra sta qui accanto,
 * in «Abbonamenti». */
test("la voce «Abbonamenti» sta nella barra, dopo «Regali e codici»", () => {
  assert.match(
    GESTORE,
    /\["licenze", "Regali e codici", 0\],\s*\["abbonamenti", "Abbonamenti", 0\],/,
  );
  assert.match(GESTORE, /abbonamenti:\s*'<svg/);
  assert.match(GESTORE, /schermata === "abbonamenti"\s*\? gliAbbonamenti\(\)/);
});

test("i numeri vengono dal quadro, e se non arrivano si tiene quello che c'era", () => {
  assert.match(GESTORE, /ABBONAMENTI = await chiedi\("\/abbonamenti"\);/);
  assert.match(GESTORE, /<b>Gli abbonamenti non sono arrivati<\/b>/);
});

test("la pagina dice negozio per negozio, mensili e annuali, in prova, disdetti", () => {
  assert.match(GESTORE, /\["ios", "App Store"\],\s*\["android", "Google Play"\],/);
  for (const parola of [
    "abbonamenti attivi",
    "mensili",
    "annuali",
    "di cui in prova gratuita",
    "di cui disdetti: finiscono a scadenza",
    "finiti negli ultimi 30 giorni",
    "prove finite che sono passate a pagamento",
    "al mese, quello che pagano i clienti",
  ])
    assert.ok(GESTORE.includes(`"${parola}"`), `manca «${parola}»`);
});

test("gli importi dicono cosa sono, e gli acquisti di prova non si contano", () => {
  assert.match(GESTORE, /Gli importi sono quelli che pagano i clienti, IVA compresa/);
  assert.match(GESTORE, /App Store Connect e nella Play Console/);
  assert.match(GESTORE, /"App Store \(TestFlight\)"/);
  assert.match(GESTORE, /"Google Play \(tester\)"/);
  assert.match(GESTORE, /"non entra nei conti"/);
});

test("le date si scrivono in italiano: «l'8 ott», «dall'1 nov»", () => {
  assert.match(GESTORE, /const elisa = giorno === 1 \|\| giorno === 8 \|\| giorno === 11;/);
  assert.match(GESTORE, /dal: \["dal ", "dall'"\]/);
});
