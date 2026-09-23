/* I due tasti della gestione, e la differenza fra loro.
 *
 * Sono due cose diverse e si somigliano solo da fuori:
 *
 *  - **congela** e' un interruttore. Chi e' congelato apre la sua pagina, la
 *    sua chiave e' ancora buona, e non vede una riga dei suoi impianti: trova
 *    un cartello con un indirizzo a cui scrivere. Gli impianti restano accesi
 *    e il quadro continua a riceverli. Si scongela e torna tutto com'era;
 *  - **elimina** porta via tutto: lui, i suoi codici in attesa, le chiavi
 *    delle sue case, le sue case. Da li' in poi quelle case bussano e si
 *    sentono dire di no, e per tornare dentro ci vuole un codice nuovo di un
 *    installatore vivo, incollato da dentro casa.
 *
 * Quello che queste prove tengono davvero: che congela **non** tocchi niente
 * di quello che tocca elimina. Se un giorno le due cose si assomigliassero un
 * po' di piu', chi preme «congela» per una lite si ritroverebbe i clienti di
 * qualcun altro da riabbinare a mano.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { alzaIlQuadro } from "../src/index.js";
import { DOVE_SCRIVERE } from "../src/server.js";

const CHIAVE_DEL_GESTORE = "una-chiave-lunga-abbastanza-per-il-gestore";
const UNA = "casa_a3f19c74e05b2d8890fa4c1e6b73d052";
const ALTRA = "casa_71cd3a6e884b09f25de4a1c7b3608e14";

const RAPPORTO = {
  quando: new Date().toISOString(),
  ogni: 1,
  ponte: "1.5.9.1",
  plance: { quante: 1, configurate: 1 },
  telefoni: { abbinati: 1, visti7gg: 1 },
  fuori: { acceso: true, filo: true },
  entita: { totali: 214, giu: 0, dispositivi: 0, nomi: [] },
};

async function banco({ installatori = 2 } = {}) {
  const cartella = mkdtempSync(join(tmpdir(), "gelo-"));
  const acceso = await alzaIlQuadro({
    porta: 0,
    cartella,
    livello: "errore",
    chiaveDelGestore: CHIAVE_DEL_GESTORE,
  });
  const dove = `http://127.0.0.1:${acceso.porta}`;
  const gestore = (via, opzioni = {}) =>
    fetch(`${dove}/gestore${via}`, {
      ...opzioni,
      headers: {
        authorization: `Bearer ${CHIAVE_DEL_GESTORE}`,
        "content-type": "application/json",
        ...(opzioni.headers || {}),
      },
    });
  const iscritti = [];
  for (let n = 0; n < installatori; n += 1) {
    iscritti.push(
      await (
        await gestore("/installatori", {
          method: "POST",
          body: JSON.stringify({ nome: `Installatore ${n + 1}` }),
        })
      ).json(),
    );
  }
  return {
    ...acceso,
    dove,
    gestore,
    iscritti,
    retro: (via, opzioni = {}, chiave = iscritti[0]?.chiave) =>
      fetch(`${dove}/console${via}`, {
        ...opzioni,
        headers: {
          authorization: `Bearer ${chiave}`,
          "content-type": "application/json",
          ...(opzioni.headers || {}),
        },
      }),
    deposita: (casa, chiave, carta = RAPPORTO) =>
      fetch(`${dove}/rapporto`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${chiave}`,
          "content-type": "application/json",
          "x-casa": casa,
          /* Il segreto che la casa si fa da se' (`chiavi.riconosci`): e' con
           * questo che, cambiando installatore, dimostra di essere lei. */
          "x-casa-segreto": `il-segreto-di-${casa}`,
        },
        body: JSON.stringify(carta),
      }),
    chiudi: async () => {
      await acceso.spegni();
      rmSync(cartella, { recursive: true, force: true });
    },
  };
}

const unCodice = async (b, chiave, per = "") =>
  (
    await (
      await b.retro("/inviti", { method: "POST", body: JSON.stringify({ per }) }, chiave)
    ).json()
  ).codice;

/* ─── Congela ─────────────────────────────────────────────────────────── */

test("congelato, il cruscotto non fa vedere una riga — e dice a chi scrivere", async () => {
  const b = await banco();
  const [rossi] = b.iscritti;
  try {
    await b.deposita(UNA, await unCodice(b, rossi.chiave, "Rossi"));
    assert.equal((await (await b.retro("/case", {}, rossi.chiave)).json()).case.length, 1);

    await b.gestore(`/installatore/${rossi.chi}/congela`, { method: "POST" });

    /* Ogni via, non solo quella delle case: una via che si dimentica di
     * guardare sarebbe una finestra aperta in un muro. */
    for (const via of ["/case", "/io", "/inviti"]) {
      const risposta = await b.retro(via, {}, rossi.chiave);
      assert.equal(risposta.status, 403, `${via} risponde ancora`);
      const detto = await risposta.json();
      assert.equal(detto.congelato, true);
      assert.equal(detto.scrivi, DOVE_SCRIVERE);
      assert.equal(JSON.stringify(detto).includes(UNA), false, `${via} lascia passare una casa`);
    }

    /* E non e' «la chiave non va bene»: la chiave e' giusta, ed e' per questo
     * che si sa a chi si sta rispondendo. */
    assert.notEqual((await b.retro("/case", {}, rossi.chiave)).status, 401);
    assert.equal((await b.retro("/case", {}, "una-chiave-che-non-esiste-affatto")).status, 401);
  } finally {
    await b.chiudi();
  }
});

test("la pagina del cruscotto si apre lo stesso: e' li' che si legge il perche'", async () => {
  const b = await banco();
  const [rossi] = b.iscritti;
  try {
    await b.gestore(`/installatore/${rossi.chi}/congela`, { method: "POST" });
    const pagina = await fetch(`${b.dove}/console/`);
    assert.equal(pagina.status, 200);
  } finally {
    await b.chiudi();
  }
});

test("congelare non tocca gli impianti: continuano a mandare, e non si perde niente", async () => {
  const b = await banco();
  const [rossi] = b.iscritti;
  try {
    const codice = await unCodice(b, rossi.chiave, "Rossi");
    await b.deposita(UNA, codice);
    await b.retro(`/casa/${UNA}`, { method: "PUT", body: JSON.stringify({ nome: "Villa Rossi" }) });

    await b.gestore(`/installatore/${rossi.chi}/congela`, { method: "POST" });
    assert.equal((await b.deposita(UNA, codice)).status, 200, "la casa non deposita piu'");

    const quadro = await (await b.gestore("/installatori")).json();
    assert.equal(quadro.case, 1, "la casa e' sparita dal quadro");
    assert.equal(quadro.orfane, 0, "la casa risulta senza nessuno");
    assert.ok(quadro.installatori.find((uno) => uno.chi === rossi.chi).congelato);

    /* E scongelando si ritrova tutto, nome compreso: e' l'unica cosa che
     * distingue un interruttore da una cancellazione. */
    await b.gestore(`/installatore/${rossi.chi}/congela`, { method: "DELETE" });
    const sue = await (await b.retro("/case", {}, rossi.chiave)).json();
    assert.equal(sue.case.length, 1);
    assert.equal(sue.case[0].nome, "Villa Rossi");
  } finally {
    await b.chiudi();
  }
});

test("congelare uno non tocca gli altri", async () => {
  const b = await banco();
  const [rossi, bianchi] = b.iscritti;
  try {
    await b.deposita(ALTRA, await unCodice(b, bianchi.chiave, "Bianchi"));
    await b.gestore(`/installatore/${rossi.chi}/congela`, { method: "POST" });
    const sue = await b.retro("/case", {}, bianchi.chiave);
    assert.equal(sue.status, 200);
    assert.equal((await sue.json()).case.length, 1);
  } finally {
    await b.chiudi();
  }
});

/* ─── Elimina ─────────────────────────────────────────────────────────── */

test("eliminare porta via anche le sue case, e quelle case non entrano piu'", async () => {
  const b = await banco();
  const [rossi, bianchi] = b.iscritti;
  try {
    const codice = await unCodice(b, rossi.chiave, "Rossi");
    await b.deposita(UNA, codice);
    await b.deposita(ALTRA, await unCodice(b, bianchi.chiave, "Bianchi"));
    /* E un codice suo ancora in attesa, che se ne deve andare con lui. */
    await unCodice(b, rossi.chiave, "il prossimo");

    const detto = await (
      await b.gestore(`/installatore/${rossi.chi}`, { method: "DELETE" })
    ).json();
    assert.equal(detto.chiuso, true);
    assert.equal(detto.case, 1, "non ha detto quante case si e' portato dietro");
    assert.equal(detto.orfane, 0, "restano case senza nessuno: non e' una cancellazione");
    assert.equal(detto.installatori.length, 1, "nell'elenco c'e' ancora");

    /* La casa bussa e si sente dire di no: e' quello che «elimina» vuol dire,
     * e il motivo per cui va riabbinata da dentro casa. */
    assert.equal((await b.deposita(UNA, codice)).status, 403);

    /* Quella di Bianchi non c'entra niente e sta dov'era. */
    assert.equal((await (await b.retro("/case", {}, bianchi.chiave)).json()).case.length, 1);
  } finally {
    await b.chiudi();
  }
});

test("riaggiunto, quell'installatore e' un altro: le case vanno riabbinate", async () => {
  const b = await banco({ installatori: 1 });
  const [prima] = b.iscritti;
  try {
    const codice = await unCodice(b, prima.chiave, "la mia");
    await b.deposita(UNA, codice);
    await b.gestore(`/installatore/${prima.chi}`, { method: "DELETE" });

    const dopo = await (
      await b.gestore("/installatori", {
        method: "POST",
        body: JSON.stringify({ nome: "Installatore 1" }),
      })
    ).json();
    assert.notEqual(dopo.chi, prima.chi, "riaggiunto prende la stessa matricola");
    assert.equal((await (await b.retro("/case", {}, dopo.chiave)).json()).case.length, 0);

    /* E con un codice nuovo, incollato in casa, torna dentro. */
    await b.deposita(UNA, await unCodice(b, dopo.chiave, "la mia"));
    assert.equal((await (await b.retro("/case", {}, dopo.chiave)).json()).case.length, 1);
  } finally {
    await b.chiudi();
  }
});

test("un installatore che non c'e' non si congela e non si elimina", async () => {
  const b = await banco({ installatori: 1 });
  try {
    const chi = "inst_0000000000000000";
    assert.equal((await b.gestore(`/installatore/${chi}/congela`, { method: "POST" })).status, 404);
    assert.equal((await b.gestore(`/installatore/${chi}`, { method: "DELETE" })).status, 404);
  } finally {
    await b.chiudi();
  }
});
