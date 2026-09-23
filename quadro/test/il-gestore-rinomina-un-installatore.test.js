/* Chi tiene il quadro puo' rinominare un installatore.
 *
 * Un nome sbagliato al momento di iscriverlo — «giovanni» invece di
 * «Elettrotecnica Giovanni» — non e' un dettaglio: e' quello che l'installatore
 * legge in cima al suo cruscotto, e quello che il quadro dice a ogni rapporto
 * alle sue case, che lo mettono in cima alla plancia. Fino a ieri l'unica via
 * era eliminarlo e rifarlo, cioe' riabbinare ogni impianto.
 *
 * Quello che si tiene qui: che il nome nuovo arrivi **dappertutto** — nella
 * gestione, nel cruscotto di lui, nella risposta che ricevono le sue case — e
 * che un nome vuoto non passi.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { alzaIlQuadro } from "../src/index.js";

const QUI = dirname(fileURLToPath(import.meta.url));
const GESTIONE = readFileSync(join(QUI, "..", "gestore", "index.html"), "utf8");
const CONSOLE = readFileSync(join(QUI, "..", "console", "index.html"), "utf8");

const CHIAVE_DEL_GESTORE = "una-chiave-lunga-abbastanza-per-il-gestore";
const UNA = "casa_a3f19c74e05b2d8890fa4c1e6b73d052";

const RAPPORTO = {
  quando: new Date().toISOString(),
  ogni: 1,
  ponte: "1.5.9.13",
  plance: { quante: 1, configurate: 1 },
  telefoni: { abbinati: 1, visti7gg: 1 },
  fuori: { acceso: true, filo: true },
  entita: { totali: 214, sparite: 0, dispositivi: 0, nomi: [] },
};

async function banco() {
  const cartella = mkdtempSync(join(tmpdir(), "rinomina-"));
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
  const uno = await (
    await gestore("/installatori", {
      method: "POST",
      body: JSON.stringify({ nome: "giovanni", soglia: 0 }),
    })
  ).json();
  const retro = (via, opzioni = {}) =>
    fetch(`${dove}/console${via}`, {
      ...opzioni,
      headers: {
        authorization: `Bearer ${uno.chiave}`,
        "content-type": "application/json",
        ...(opzioni.headers || {}),
      },
    });
  return {
    gestore,
    retro,
    uno,
    deposita: (casa, chiave) =>
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
        body: JSON.stringify(RAPPORTO),
      }),
    chiudi: async () => {
      await acceso.spegni();
      rmSync(cartella, { recursive: true, force: true });
    },
  };
}

test("il nome nuovo arriva nella gestione, nel cruscotto di lui e alle sue case", async () => {
  const b = await banco();
  try {
    /* Una casa sua, abbinata prima del cambio di nome: e' quella che al
     * rapporto dopo deve sentirsi dire il nome nuovo. */
    const codice = (await (await b.retro("/inviti", { method: "POST", body: "{}" })).json()).codice;
    const prima = await (await b.deposita(UNA, codice)).json();
    assert.equal(prima.di, "giovanni");

    const risposta = await b.gestore(`/installatore/${b.uno.chi}`, {
      method: "PUT",
      body: JSON.stringify({ nome: "  Elettrotecnica   Giovanni  " }),
    });
    assert.equal(risposta.status, 200);

    const elenco = (await (await b.gestore("/installatori")).json()).installatori;
    assert.equal(elenco.find((altro) => altro.chi === b.uno.chi)?.nome, "Elettrotecnica Giovanni");
    assert.equal((await (await b.retro("/io")).json()).nome, "Elettrotecnica Giovanni");
    /* La chiave e' la stessa: rinominare non e' rifare. */
    const dopo = await (await b.deposita(UNA, codice)).json();
    assert.equal(dopo.presa, true);
    assert.equal(dopo.di, "Elettrotecnica Giovanni");
  } finally {
    await b.chiudi();
  }
});

test("un nome vuoto non passa, e cambiare la soglia non tocca il nome", async () => {
  const b = await banco();
  try {
    for (const nome of ["", "   ", null]) {
      const risposta = await b.gestore(`/installatore/${b.uno.chi}`, {
        method: "PUT",
        body: JSON.stringify({ nome }),
      });
      assert.equal(risposta.status, 400, `con ${JSON.stringify(nome)}`);
      assert.match((await risposta.json()).errore, /serve un nome/);
    }
    await b.gestore(`/installatore/${b.uno.chi}`, {
      method: "PUT",
      body: JSON.stringify({ soglia: 5 }),
    });
    const suo = (await (await b.gestore("/installatori")).json()).installatori[0];
    assert.equal(suo.nome, "giovanni");
    assert.equal(suo.soglia, 5);
  } finally {
    await b.chiudi();
  }
});

test("la gestione ha il tasto «Rinomina», e la riga che si apre sotto", () => {
  assert.match(GESTIONE, /data-nome="\$\{testo\(uno\.chi\)\}">Rinomina</);
  assert.match(GESTIONE, /class="rigaNome" data-nome-di="\$\{testo\(uno\.chi\)\}" hidden/);
  assert.match(GESTIONE, /data-salva-nome="\$\{testo\(uno\.chi\)\}">Salva</);
  assert.match(GESTIONE, /maxlength="80"/);
  assert.match(GESTIONE, /async function cambiaIlNome\(chi, nome, tasto\)/);
  /* Vuoto si ferma prima di partire, e lo dice. */
  assert.match(GESTIONE, /if \(!pulito\) \{\s*avvisa\("Serve un nome"\);\s*return;/);
  /* La riga ha il suo stile, come quella del limite. */
  assert.match(GESTIONE, /\.rigaNome,\n\s+\.rigaLimite \{/);
  assert.match(GESTIONE, /\.rigaNome input \{/);
  /* Il tasto rinomina **l'installatore**: le case, dalla gestione, restano in
   * sola lettura, e la prova della scheda lo tiene (`data-rinomina=` non c'e'). */
  assert.doesNotMatch(GESTIONE, /data-rinomina=/);
  /* E il cruscotto non ce l'ha: da li' un installatore non si rinomina da se'. */
  assert.doesNotMatch(CONSOLE, /data-nome-di=/);
});
