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
import { leVersioniDalTramite, leVersioniDelleApp } from "../src/versioni-delle-app.js";

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
  assert.match(
    SERVER,
    /versioniDelleApp: leVersioniDelleApp\(\s*case_\.elenco\(TUTTE\),\s*ultime\.tutte\(\),\s*\(await iNumeriDelTramite\(\)\)\?\.versioniApp \?\? null,?\s*\)/,
  );
  assert.match(GESTORE, /Versioni dell'app sui telefoni/);
  assert.match(GESTORE, /unNegozio\("apple"\)/);
  assert.match(GESTORE, /unNegozio\("google"\)/);
  /* Ogni cosa che arriva da una casa passa da `testo(…)`. */
  assert.match(GESTORE, /<b>\$\{testo\(laVersione\(v\)\)\}<\/b>/);
});

test("l'ultima scritta come pubblicata conta come la piu' nuova del suo negozio", () => {
  const V = leVersioniDelleApp(
    [
      casa("casa_1", "Villa", [
        { negozio: "apple", versione: "1.18.7", costruzione: 1180715, quanti: 1 },
      ]),
    ],
    { apple: { costruzione: 1180801, versione: "1.18.8" }, google: null },
  );
  assert.equal(V.negozi.apple.piuNuova, 1180801);
  assert.equal(V.case[0].indietro, true);
  assert.equal(V.negozi.google.piuNuova, 0);
});

/* «Mancano tutti quelli che hanno la 1.18.7»: le case con l'add-on di prima
 * della 1.18.7.14 dicono solo quanti telefoni hanno visto, non con quale
 * versione. Non spariscono: si contano a parte, con l'add-on che hanno. */
test("i telefoni delle case che la versione non la dicono si contano a parte", () => {
  const V = leVersioniDelleApp([
    casa("casa_1", "Villa", [
      { negozio: "apple", versione: "1.18.8", costruzione: 1180800, quanti: 1 },
    ]),
    {
      casa: "casa_2",
      nome: "Centro",
      carta: { ponte: "1.18.7.10", telefoni: { abbinati: 3, visti7gg: 2 } },
    },
    {
      casa: "casa_3",
      nome: "Mare",
      carta: { ponte: "1.18.6", telefoni: { abbinati: 5, visti7gg: 4, versioni: [] } },
    },
    /* Nessun telefono visto in settimana: non c'e' niente da dire. */
    { casa: "casa_4", nome: "Monti", carta: { ponte: "1.17.0", telefoni: { visti7gg: 0 } } },
    { casa: "casa_5", nome: "Senza carta", carta: null },
  ]);
  assert.equal(V.telefoni, 1);
  assert.deepEqual(V.senzaVersioni, {
    telefoni: 6,
    case: [
      { casa: "casa_3", nome: "Mare", telefoni: 4, ponte: "1.18.6" },
      { casa: "casa_2", nome: "Centro", telefoni: 2, ponte: "1.18.7.10" },
    ],
    /* Senza il tramite le case accese mute non si sanno. */
    caseAccese: null,
  });
  /* Le case che non dicono le versioni non finiscono fra quelle «per casa». */
  assert.deepEqual(
    V.case.map((una) => una.nome),
    ["Villa"],
  );
});

test("la pagina scrive i telefoni senza versione, e il totale li comprende", () => {
  assert.match(GESTORE, /V\.senzaVersioni/);
  assert.match(GESTORE, /data-senza-versioni/);
  assert.match(GESTORE, /add-on prima della 1\.18\.7\.14/);
  assert.match(GESTORE, /const tuttiITelefoni = V\.telefoni \+ MUTE\.telefoni/);
  /* Anche qui quello che arriva da una casa passa da `testo(…)`. */
  assert.match(GESTORE, /add-on \$\{testo\(una\.ponte\)\}/);
});

/* «Continuo a non vedere le app installate dagli utenti.» Il rapporto parte
 * spento: le versioni arrivano anche dal tramite, che le sente da tutte le
 * case accese gia' sommate (`centralino/src/telefoni.js`). Le case col
 * rapporto il tramite non le somma: ogni casa una volta sola. */
test("le versioni dal tramite si aggiungono a quelle dei rapporti, una casa una volta", () => {
  const V = leVersioniDelleApp(
    [
      casa("casa_1", "Villa", [
        { negozio: "apple", versione: "1.18.8", costruzione: 1180800, quanti: 1 },
      ]),
    ],
    {},
    {
      case: 120,
      col_rapporto: 1,
      mute: 57,
      visti7gg: 160,
      versioni: [
        { negozio: "apple", versione: "1.18.8", costruzione: 1180800, telefoni: 70, case: 52 },
        { negozio: "apple", versione: "1.18.7", costruzione: 1180716, telefoni: 21, case: 18 },
        { negozio: "google", versione: "1.18.8", costruzione: 1180800, telefoni: 48, case: 40 },
        { negozio: "google", versione: "1.16.12", costruzione: 1161200, telefoni: 12, case: 11 },
        { negozio: "", versione: "", costruzione: 0, telefoni: 9, case: 8 },
      ],
    },
  );
  assert.equal(V.negozi.apple.telefoni, 92);
  assert.deepEqual(
    V.negozi.apple.versioni.map((v) => [v.versione, v.telefoni, v.case]),
    [
      ["1.18.8", 71, 53],
      ["1.18.7", 21, 18],
    ],
  );
  assert.equal(V.negozi.google.telefoni, 60);
  assert.equal(V.negozi.altro.telefoni, 9);
  assert.equal(V.telefoni, 161);
  assert.equal(V.senzaVersioni.caseAccese, 57);
  assert.deepEqual(V.fonti, { dalTramite: 119, colRapporto: 1 });
  /* Casa per casa restano solo quelle del rapporto: il tramite non dice quali. */
  assert.deepEqual(
    V.case.map((una) => una.nome),
    ["Villa"],
  );
});

test("dal tramite si prende solo la forma giusta", () => {
  for (const storto of [null, "tanti", { case: -1, col_rapporto: 0, mute: 0, visti7gg: 0 }, {}])
    assert.equal(leVersioniDalTramite(storto), null);
  const pulito = leVersioniDalTramite({
    case: 2,
    col_rapporto: 0,
    mute: 0,
    visti7gg: 3,
    versioni: [
      { negozio: VELENO, versione: VELENO.repeat(5), costruzione: "x", telefoni: 3, case: 2 },
      { negozio: "apple", versione: "1.18.8", costruzione: 1180800, telefoni: 0, case: 0 },
    ],
  });
  assert.equal(pulito.versioni.length, 1);
  assert.equal(pulito.versioni[0].negozio, "altro");
  assert.equal(pulito.versioni[0].versione.length <= 40, true);
  assert.equal(pulito.versioni[0].costruzione, 0);
});

test("un rapporto di piu' di una settimana fa non si conta: la casa ora la dice il tramite", () => {
  const ADESSO = Date.UTC(2026, 10, 3, 12);
  const GIORNO = 24 * 3600 * 1000;
  const V = leVersioniDelleApp(
    [
      {
        ...casa("casa_1", "Villa", [
          { negozio: "apple", versione: "1.18.8", costruzione: 1180800, quanti: 2 },
        ]),
        vistaIl: ADESSO - 2 * GIORNO,
      },
      /* Ha spento il rapporto dieci giorni fa: il quadro tiene l'ultimo,
       * ma i suoi telefoni adesso li somma il tramite. */
      {
        ...casa("casa_2", "Baita", [
          { negozio: "apple", versione: "1.18.7", costruzione: 1180714, quanti: 3 },
        ]),
        vistaIl: ADESSO - 10 * GIORNO,
      },
      {
        casa: "casa_3",
        nome: "Vecchia",
        vistaIl: ADESSO - 30 * GIORNO,
        carta: { telefoni: { visti7gg: 4 }, ponte: "1.18.7.10" },
      },
    ],
    {},
    {
      case: 2,
      col_rapporto: 1,
      mute: 0,
      visti7gg: 5,
      versioni: [
        { negozio: "apple", versione: "1.18.7", costruzione: 1180714, telefoni: 3, case: 1 },
      ],
    },
    ADESSO,
  );
  assert.deepEqual(
    V.negozi.apple.versioni.map((v) => [v.versione, v.telefoni, v.case]),
    [
      ["1.18.8", 2, 1],
      ["1.18.7", 3, 1],
    ],
  );
  assert.deepEqual(
    V.case.map((una) => una.nome),
    ["Villa"],
  );
  assert.equal(V.senzaVersioni.telefoni, 0);
  assert.deepEqual(V.fonti, { dalTramite: 1, colRapporto: 1 });
});

test("la gestione non promette quello che non sa: niente «ognuna una volta sola»", () => {
  assert.doesNotMatch(GESTORE, /ognuna una volta sola/);
  assert.match(GESTORE, /dell'ultima settimana/);
});
