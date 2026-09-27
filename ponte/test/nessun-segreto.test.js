/* Il guardiano dei segreti, messo alla prova.
 *
 * Un guardiano che non ha mai suonato non e' un guardiano: e' una riga verde
 * nelle prove. Quello che conta di `strumenti/nessun-segreto.mjs` non e' che
 * oggi dica «nessun segreto» — lo direbbe anche se le sue regole fossero
 * scritte male — ma che **suoni** quando davanti gli passa una credenziale, e
 * che **non suoni** su quello che in questa repository ci sta da sempre.
 *
 * Le due cose vanno insieme. Un guardiano cieco lascia passare una chiave; uno
 * che grida a ogni riga lo si spegne entro la settimana, e allora la chiave
 * passa lo stesso — solo piu' tardi e con piu' calma.
 *
 * Le finte credenziali qui sotto sono finte davvero: forme giuste, contenuto
 * inventato a mano. Non aprono niente da nessuna parte.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  I_NOMI_DEI_SEGRETI,
  I_SEGNI,
  LE_ECCEZIONI,
  guardaIlTesto,
  guardaLaRepository,
  iFileDellaRepository,
} from "../../strumenti/nessun-segreto.mjs";

const RADICE = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

const quali = (testo) => guardaIlTesto(testo).map((uno) => uno.segno);

/* Le finte credenziali si scrivono **a pezzi**, e la forma intera esiste solo
 * in memoria, il tempo di una prova. Per due ragioni, tutte e due imparate
 * spingendo:
 *
 * 1. GitHub, su questa repository, ha la **protezione al push** accesa. Il
 *    primo tentativo di mandare su questa prova e' stato rifiutato — «Stripe
 *    API Key», `ponte/test/nessun-segreto.test.js:42` — e ha fatto benissimo:
 *    un guardiano non puo' chiedere a quello vero di fare un'eccezione per lui.
 * 2. Il guardiano di casa gira su **questo stesso file**. Una chiave finta
 *    scritta per intero qui lo farebbe suonare su di se', e l'unico modo di
 *    zittirlo sarebbe un'eccezione — cioe' dichiarare un file dove le chiavi
 *    possono stare. Un buco per comodita' resta un buco.
 *
 * Il contenuto e' inventato a mano, carattere per carattere: non apre niente
 * da nessuna parte. Solo la forma e' quella vera, ed e' l'unica cosa che qui
 * serva. */
const pezzi = (...quali) => quali.join("");

/* Quarantatre caratteri base64url: la taglia di una chiave Ed25519 grezza.
 * Sta su una riga sua, lontano dalle parole che la farebbero riconoscere. */
const QUARANTATRE = "TnVsbGFEaVZlcm9RdWlEZW50cm9Tb2xvTGFGb3JtYUE";

const LE_FINTE = {
  "chiave-privata": pezzi(
    "-----BEGIN ",
    "PRIVATE KEY",
    "-----\nTm9uQ2VOaWVudGVEZW50cm9RdWVzdGFOb25FVW5hQ2hpYXZl\n-----END ",
    "PRIVATE KEY",
    "-----",
  ),
  "utenza-di-servizio": pezzi('{ "type": "service', '_account", "project_id": "gdahome" }'),
  "chiave-google": pezzi('const chiave = "AI', "za", 'SyD9naiVqNoNEsisteNonFunzionaMaiQQZ";'),
  "gettone-github": pezzi("GH_TOKEN=gh", "p_", "a".repeat(36)),
  "gettone-firmato": pezzi(
    "Authorization: Bearer ey",
    "JhbGciOiJFUzI1NiJ9.eyJpc3MiOiJnZGFob21lIn0.",
    "QUJDREVGR0hJSktMTU5PUFFSU1RVVldY",
  ),
  "chiave-di-pagamento": pezzi("STRIPE=sk", "_live", "_AbCdEfGhIjKlMnOpQrStUvWx"),
  "chiave-ed25519-grezza": pezzi("priv", "ata   ", QUARANTATRE),
  "credenziale-del-progetto": pezzi("QUADRO_LICENZE_CHIAVE", ' = "', QUARANTATRE, '"'),
};

test("ogni regola suona davanti alla sua credenziale", () => {
  /* Se domani si aggiunge un segno e ci si dimentica la finta, questa prova
   * lo dice: e' la ragione per cui il giro parte da I_SEGNI e non dall'elenco
   * qui sopra. */
  for (const segno of I_SEGNI) {
    const finta = LE_FINTE[segno.nome];
    assert.ok(finta, `manca la finta credenziale per «${segno.nome}»`);
    assert.deepEqual(quali(finta), [segno.nome], segno.nome);
  }
});

test("ogni regola dice cosa si e' perso, non un numero", () => {
  for (const segno of I_SEGNI) {
    assert.match(segno.nome, /^[a-z0-9-]+$/, segno.nome);
    assert.ok(segno.perche.length > 30, `il perche' di «${segno.nome}» e' troppo corto`);
  }
});

test("il pezzo mostrato e' mozzato: l'errore non ristampa la chiave", () => {
  const [trovato] = guardaIlTesto(LE_FINTE["chiave-privata"]);
  assert.ok(trovato.pezzo.length <= 25, trovato.pezzo);
  assert.ok(trovato.pezzo.endsWith("…"));
  assert.equal(trovato.riga, 1);
});

test("dice la riga, che in un file di quattromila non e' un dettaglio", () => {
  const testo = ["una", "due", "tre", LE_FINTE["chiave-google"]].join("\n");
  assert.equal(guardaIlTesto(testo)[0].riga, 4);
});

test("il modo giusto di scrivere un segreto non suona", () => {
  /* Queste righe stanno davvero nei workflow e nei documenti di questa
   * repository. Se il guardiano suonasse su di loro, la prima cosa che
   * succederebbe e' che qualcuno lo spegne. */
  const innocenti = [
    `          NEGOZIO_GOOGLE: \${{ secrets.NEGOZIO_GOOGLE }}`,
    `        CHIAVE_ANDROID: \${{ secrets.CHIAVE_ANDROID }}`,
    `    storePassword = chiaveVera.getProperty("storePassword")`,
    `la privata, da mettere **solo** sulla macchina del quadro come`,
    `\`QUADRO_LICENZE_CHIAVE\` (32 byte base64url, il \`d\` di una JWK Ed25519).`,
    `const QUADRO_LICENZE_CHIAVE = process.env.QUADRO_LICENZE_CHIAVE ?? "";`,
    `export const CHIAVE_PUBBLICA_LICENZE = "";`,
    `VERSIONE_MINIMA_APP = "1070000"`,
    `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ`,
  ];
  for (const riga of innocenti) assert.deepEqual(quali(riga), [], riga);
});

test("la chiave pubblica delle licenze, scritta per intero, non suona", () => {
  /* Perche' e' pubblica: sta apposta in cinque file di produzione
   * (`docs/LICENZE.md`), e il giorno che ci si scrive dentro quella vera il
   * guardiano non deve mettersi di traverso. */
  const pubblica = `export const CHIAVE_PUBBLICA_LICENZE = "6P9sdqQtlHcmH7Ve_SgzmyJmxJS28CNORRJJfjI3rnI";`;
  assert.deepEqual(quali(pubblica), []);
});

test("ogni eccezione dice il file, la regola e il perche' — e quel file c'e'", () => {
  const nomi = new Set(I_SEGNI.map((uno) => uno.nome));
  for (const una of LE_ECCEZIONI) {
    assert.ok(nomi.has(una.segno), `l'eccezione punta a una regola che non c'e': ${una.segno}`);
    assert.ok(una.perche.length > 40, `l'eccezione su ${una.file} non dice abbastanza`);
    assert.doesNotThrow(
      () => readFileSync(join(RADICE, una.file), "utf8"),
      `l'eccezione parla di un file che non c'e': ${una.file}`,
    );
  }
});

test("nessuna eccezione avanzata: se non serve piu', si toglie", () => {
  /* Un'eccezione che non copre piu' niente e' un buco aperto per abitudine. */
  const senza = guardaLaRepository({ radice: RADICE, eccezioni: [] });
  const coperti = new Set(senza.trovati.map((uno) => `${uno.file}::${uno.segno}`));
  for (const una of LE_ECCEZIONI) {
    assert.ok(
      coperti.has(`${una.file}::${una.segno}`),
      `l'eccezione «${una.segno}» su ${una.file} non copre piu' niente: toglila`,
    );
  }
});

test("le due chiavi di prova che ci sono, il guardiano le vede", () => {
  /* Il contrario della prova di sopra: che le regole peschino davvero dentro
   * questa repository, e non solo su stringhe scritte qui. */
  const senza = guardaLaRepository({ radice: RADICE, eccezioni: [] });
  assert.equal(senza.trovati.length, LE_ECCEZIONI.length, JSON.stringify(senza.trovati, null, 2));
});

test("nella repository, oggi, non c'e' nessun segreto", () => {
  /* La prova per cui esiste tutto il resto. */
  const esito = guardaLaRepository({ radice: RADICE });
  assert.deepEqual(esito.trovati, []);
  /* E ha davvero guardato: un giro che non apre niente passerebbe sempre. */
  assert.ok(esito.guardati > 1000, `guardati solo ${esito.guardati} file`);
});

test("guarda quello che e' pubblico, e non quello che non lo e'", () => {
  const file = iFileDellaRepository(RADICE);
  assert.ok(file.includes("ponte/src/server.js"));
  /* L'app web costruita: e' l'unico posto dove si vedrebbe un valore murato
   * dentro con `--dart-define`. */
  assert.ok(file.includes("ponte/app/main.dart.js"));
  /* E niente di quello che git non traccia. */
  assert.ok(!file.some((uno) => uno.startsWith("node_modules/")));
});

test("i nomi delle credenziali del progetto stanno in un posto solo", () => {
  const sorgente = readFileSync(join(RADICE, "strumenti", "nessun-segreto.mjs"), "utf8");
  for (const nome of I_NOMI_DEI_SEGRETI) {
    assert.match(sorgente, new RegExp(`"${nome}"`), nome);
    assert.deepEqual(quali(`${nome}=AbCdEfGhIjKlMnOpQrStUvWx`), ["credenziale-del-progetto"], nome);
  }
});
