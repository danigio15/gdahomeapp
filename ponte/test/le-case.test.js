/* Le prove del conto delle case.
 *
 * Quello che si prova davvero: che un giorno gia' scritto non venga mai
 * riscritto al ribasso — la giornata di oggi si vede a meta', e domani il
 * numero pieno deve poterla correggere; che le case non si sommino giorno per
 * giorno, che sarebbe contare quattordici volte la stessa casa; e che un
 * gettone senza il permesso giusto dica **quale** permesso manca, invece di un
 * numero di errore che non spiega niente.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  conta,
  FINESTRA,
  iConti,
  IL_FILE,
  ilBollino,
  ilGiorno,
  iFile,
  unisci,
} from "../../strumenti/conta-le-case.mjs";

/* Come risponde GitHub: un'ora per ogni giorno, i cloni e le case distinte di
 * quel giorno, e in cima i due totali della finestra — dove le case sono
 * distinte **su tutte e quattordici**, non la somma dei giorni. */
function comeRispondeGitHub(giorni, { uniques = null } = {}) {
  const clones = Object.entries(giorni).map(([giorno, [count, uniq]]) => ({
    timestamp: `${giorno}T00:00:00Z`,
    count,
    uniques: uniq,
  }));
  return {
    count: clones.reduce((somma, uno) => somma + uno.count, 0),
    uniques: uniques ?? Math.max(0, ...clones.map((uno) => uno.uniques)),
    clones,
  };
}

test("il giorno si ricava dall'ora, e quello che non e' un'ora non e' un giorno", () => {
  assert.equal(ilGiorno("2026-09-17T00:00:00Z"), "2026-09-17");
  assert.equal(ilGiorno("una parola"), "");
  assert.equal(ilGiorno(undefined), "");
});

test("un giorno gia' scritto si riscrive solo al rialzo", () => {
  /* La corsa e' di mattina: il giorno in corso si vede a meta'. Domani lo si
   * rivede pieno e va corretto in su; ma la finestra contiene anche i giorni
   * di prima, gia' pieni, e riscriverli con quello che passa non deve mai
   * farli scendere. */
  const ieri = unisci({}, comeRispondeGitHub({ "2026-09-16": [40, 12] }));
  assert.deepEqual(ieri["2026-09-16"], { cloni: 40, case: 12 });

  const oggi = unisci(ieri, comeRispondeGitHub({ "2026-09-16": [90, 31], "2026-09-17": [5, 3] }));
  assert.deepEqual(oggi["2026-09-16"], { cloni: 90, case: 31 });
  assert.deepEqual(oggi["2026-09-17"], { cloni: 5, case: 3 });

  /* E se GitHub, per un suo motivo, ridicesse un numero piu' basso su un
   * giorno gia' chiuso, quel numero non si prende: il totale di sempre non
   * torna mai indietro. */
  const dopo = unisci(oggi, comeRispondeGitHub({ "2026-09-16": [2, 1] }));
  assert.deepEqual(dopo["2026-09-16"], { cloni: 90, case: 31 });
});

test("i giorni restano in ordine, e quelli senza data si buttano", () => {
  const giorni = unisci(
    { "2026-09-18": { cloni: 1, case: 1 } },
    { clones: [{ timestamp: "2026-09-16T00:00:00Z", count: 3, uniques: 2 }, { count: 9 }] },
  );
  assert.deepEqual(Object.keys(giorni), ["2026-09-16", "2026-09-18"]);
});

test("le case non si sommano: sono quelle che distingue GitHub", () => {
  /* Tre giorni, quattro case ogni giorno. Sommandoli verrebbero dodici case,
   * e sarebbero le stesse quattro contate tre volte. GitHub le distingue su
   * tutta la finestra e dice cinque: quattro fisse piu' una passata una volta
   * sola. Quello e' il numero. */
  const giorni = unisci(
    {},
    comeRispondeGitHub(
      { "2026-09-15": [20, 4], "2026-09-16": [22, 4], "2026-09-17": [25, 4] },
      { uniques: 5 },
    ),
  );
  const conti = iConti(giorni, { distinte: 5 });
  assert.equal(conti.case, 5);
  /* Gli scaricamenti invece si sommano: sono passaggi, non persone. */
  assert.equal(conti.scaricamenti, 67);
  assert.equal(conti.dal, "2026-09-15");
  assert.equal(conti.giorni, 3);
});

test("senza il numero di GitHub si ripiega sul giorno piu' affollato", () => {
  /* Il ripiego sbaglia **per difetto** — le case di un giorno solo sono meno
   * di quelle di due settimane — ed e' il verso giusto in cui sbagliare un
   * numero che si mostra in pubblico. */
  const giorni = unisci(
    {},
    comeRispondeGitHub({ "2026-09-15": [20, 4], "2026-09-16": [40, 9], "2026-09-17": [25, 6] }),
  );
  assert.equal(iConti(giorni, { distinte: null }).case, 9);
});

test("il totale conta solo la finestra per le case, e tutta la storia per gli scaricamenti", () => {
  const giorni = {};
  for (let quale = 1; quale <= 40; quale += 1) {
    giorni[`2026-08-${String(quale).padStart(2, "0")}`] = { cloni: 10, case: 3 };
  }
  const conti = iConti(giorni, { distinte: null, finestra: FINESTRA });
  assert.equal(conti.scaricamenti, 400, "gli scaricamenti sono di sempre");
  assert.equal(conti.case, 3, "le case sono quelle della finestra");
});

test("i bollini escono nella forma che shields.io sa disegnare", () => {
  const bollino = ilBollino("case con gdahome", 12, "16a34a");
  assert.deepEqual(bollino, {
    schemaVersion: 1,
    label: "case con gdahome",
    message: "12",
    color: "16a34a",
  });
  const file = iFile(
    { "2026-09-16": { cloni: 4, case: 2 } },
    iConti({ "2026-09-16": { cloni: 4, case: 2 } }),
  );
  assert.deepEqual(Object.keys(file).sort(), [
    "bollino-case.json",
    "bollino-scaricamenti.json",
    IL_FILE,
  ]);
  assert.match(file["bollino-scaricamenti.json"].label, /dal 2026-09-16/);
});

test("un gettone senza il permesso giusto dice quale permesso manca", async () => {
  /* E' l'errore che si prendera' davvero, la prima volta: un gettone che
   * scrive le issue ma non legge il traffico. Un «403» e basta manderebbe a
   * cercare dalla parte sbagliata. */
  for (const stato of [403, 404]) {
    await assert.rejects(
      () =>
        conta({
          cartella: join(tmpdir(), "non-ci-arriva"),
          gettone: "finto",
          prendi: async () => ({ ok: false, status: stato, json: async () => ({}) }),
        }),
      /Administration: Read-only/,
    );
  }
});

test("senza gettone non si finge di aver contato", async () => {
  await assert.rejects(
    () => conta({ cartella: join(tmpdir(), "niente"), gettone: "" }),
    /manca il gettone/,
  );
});

test("i conti si scrivono, e il giro dopo riparte da quelli", async (t) => {
  const cartella = mkdtempSync(join(tmpdir(), "conti-"));
  t.after(() => rmSync(cartella, { recursive: true, force: true }));

  const risposta = (giorni, uniques) => async () => ({
    ok: true,
    status: 200,
    json: async () => comeRispondeGitHub(giorni, { uniques }),
  });

  await conta({
    cartella,
    gettone: "buono",
    prendi: risposta({ "2026-09-16": [40, 12] }, 12),
  });
  let scritto = JSON.parse(readFileSync(join(cartella, IL_FILE), "utf8"));
  assert.equal(scritto.case, 12);
  assert.equal(scritto.scaricamenti, 40);

  /* Il giro dopo GitHub non dice piu' niente di ieri — la finestra scorre — e
   * il totale non deve perderlo. */
  const conti = await conta({
    cartella,
    gettone: "buono",
    prendi: risposta({ "2026-09-17": [30, 9] }, 15),
  });
  assert.equal(conti.scaricamenti, 70, "ieri resta nel totale");
  assert.equal(conti.case, 15, "le case sono quelle che dice GitHub oggi");
  scritto = JSON.parse(readFileSync(join(cartella, IL_FILE), "utf8"));
  assert.deepEqual(Object.keys(scritto.giorni), ["2026-09-16", "2026-09-17"]);
  assert.equal(JSON.parse(readFileSync(join(cartella, "bollino-case.json"), "utf8")).message, "15");
});

test("un deposito rotto non ferma il conto: riparte dalla finestra", async (t) => {
  const cartella = mkdtempSync(join(tmpdir(), "conti-"));
  t.after(() => rmSync(cartella, { recursive: true, force: true }));
  writeFileSync(join(cartella, IL_FILE), "{ questo non e' JSON");
  const conti = await conta({
    cartella,
    gettone: "buono",
    prendi: async () => ({
      ok: true,
      status: 200,
      json: async () => comeRispondeGitHub({ "2026-09-17": [7, 3] }, 3),
    }),
  });
  assert.equal(conti.scaricamenti, 7);
});
