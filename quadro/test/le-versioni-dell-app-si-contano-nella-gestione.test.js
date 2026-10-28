/* Le versioni dell'app sui telefoni, nella schermata «Abbonamenti».
 *
 * «Nella sezione abbonamenti mi metti anche una parte per verificare le
 * versioni installate delle app dagli utenti.» Ogni casa dice nel rapporto
 * quanti telefoni ha per versione (solo quanti, mai quali); il quadro li
 * mette insieme (`src/versioni-delle-app.js`) e la gestione li fa vedere.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { laFormaDel } from "../src/forma-del-rapporto.js";
import { leVersioniDelleApp } from "../src/versioni-delle-app.js";

const QUI = dirname(fileURLToPath(import.meta.url));
const GESTORE = readFileSync(join(QUI, "..", "gestore", "index.html"), "utf8");
const SERVER = readFileSync(join(QUI, "..", "src", "server.js"), "utf8");
const VELENO = '<img src=x onerror="alert(1)">';

test("nel rapporto: negozio, versione, costruzione e quanti — nient'altro, e col tetto", () => {
  const detta = laFormaDel({
    telefoni: {
      abbinati: 3,
      visti7gg: 3,
      versioni: [
        {
          negozio: "apple",
          versione: "1.18.7",
          costruzione: 1180715,
          quanti: 2,
          nome: "iPhone di Persona 1",
        },
        { negozio: VELENO, versione: VELENO.repeat(5), costruzione: VELENO, quanti: "1" },
        "non un oggetto",
        ...Array.from({ length: 50 }, () => ({ versione: "1.0", costruzione: 1, quanti: 1 })),
      ],
    },
  });
  assert.deepEqual(detta.telefoni.versioni[0], {
    negozio: "apple",
    versione: "1.18.7",
    costruzione: 1180715,
    quanti: 2,
  });
  assert.equal("negozio" in detta.telefoni.versioni[1], false);
  assert.equal(detta.telefoni.versioni[1].versione.length, 40);
  assert.equal(detta.telefoni.versioni[1].costruzione, null);
  assert.ok(detta.telefoni.versioni.length <= 30);
});

const casa = (id, nome, versioni) => ({ casa: id, nome, carta: { telefoni: { versioni } } });

test("si contano negozio per negozio, dalla piu' nuova, con quanti telefoni e in quante case", () => {
  const V = leVersioniDelleApp([
    casa("casa_1", "Villa", [
      { negozio: "apple", versione: "1.18.7", costruzione: 1180714, quanti: 2 },
      { negozio: "google", versione: "1.18.7", costruzione: 1180715, quanti: 1 },
    ]),
    casa("casa_2", "Centro", [
      { negozio: "google", versione: "1.18.7", costruzione: 0, quanti: 2 },
      { negozio: "google", versione: "1.18.7", costruzione: 1180715, quanti: 1 },
    ]),
    casa("casa_3", "Mare", [{ versione: "", costruzione: null, quanti: 1 }]),
    casa("casa_4", "Senza rapporto", undefined),
    { casa: "casa_5", nome: "Senza carta", carta: null },
  ]);
  assert.deepEqual(V.negozi.apple, {
    versioni: [{ versione: "1.18.7", costruzione: 1180714, telefoni: 2, case: 1 }],
    telefoni: 2,
    piuNuova: 1180714,
  });
  assert.deepEqual(V.negozi.google.versioni, [
    { versione: "1.18.7", costruzione: 1180715, telefoni: 2, case: 2 },
    { versione: "1.18.7", costruzione: 0, telefoni: 2, case: 1 },
  ]);
  assert.equal(V.negozi.altro.telefoni, 1);
  assert.equal(V.telefoni, 7);
  /* La Villa ha l'iPhone con la 1180714 e Android con la 1180715: e' la piu'
   * nuova del suo negozio, e quindi e' aggiornata. */
  assert.deepEqual(
    V.case.map((una) => [una.nome, una.indietro]),
    [
      ["Centro", true],
      ["Mare", false],
      ["Villa", false],
    ],
  );
});

test("senza nessun numero di costruzione nessuno e' «indietro»", () => {
  const V = leVersioniDelleApp([
    casa("casa_1", "Villa", [{ negozio: "apple", versione: "1.18.7", costruzione: 0, quanti: 1 }]),
  ]);
  assert.equal(V.negozi.apple.piuNuova, 0);
  assert.equal(V.case[0].indietro, false);
});

test("la gestione le chiede con gli abbonamenti, e la pagina le scrive negozio per negozio senza fidarsi", () => {
  assert.match(SERVER, /versioniDelleApp: leVersioniDelleApp\(case_\.elenco\(TUTTE\)\)/);
  assert.match(GESTORE, /Versioni dell'app sui telefoni/);
  assert.match(GESTORE, /unNegozio\("apple"\)/);
  assert.match(GESTORE, /unNegozio\("google"\)/);
  /* Ogni cosa che arriva da una casa passa da `testo(…)`. */
  assert.match(GESTORE, /<b>\$\{testo\(laVersione\(v\)\)\}<\/b>/);
});
