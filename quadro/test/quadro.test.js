/* Le prove del quadro, col server vero acceso.
 *
 * Quello che si prova, e in quest'ordine di importanza:
 *
 *  1. **che una casa non possa leggere la console.** E' la riga che regge
 *     tutto: le case che questo quadro guarda sono di clienti di qualcun
 *     altro, e la chiave di una casa apre una porta sola — depositare la
 *     propria cartolina — e non fa vedere niente;
 *  2. **che un codice usato non serva a nessun'altra casa**, che e' cosa vuol
 *     dire «si brucia»;
 *  3. che quello che una cartolina non dice resti «non si sa» invece di
 *     diventare una spunta rossa;
 *  4. che la matricola che conta sia quella verificata, non quella scritta nel
 *     corpo da chi manda.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { alzaIlQuadro } from "../src/index.js";

const CHIAVE_DELLA_CONSOLE = "una-chiave-lunga-abbastanza-per-la-console";
const UNA = "casa_a3f19c74e05b2d8890fa4c1e6b73d052";
const ALTRA = "casa_71cd3a6e884b09f25de4a1c7b3608e14";

const CARTOLINA = {
  quando: new Date().toISOString(),
  ogni: 15,
  ponte: "1.4.32.15",
  plance: { quante: 1, configurate: 1 },
  telefoni: { abbinati: 2, visti7gg: 2 },
  fuori: { acceso: true, filo: true },
  entita: { totali: 214, sparite: 0, impronte: [] },
  batterie: { scariche: 0, piuBassa: 47 },
  backup: { giorniFa: 2 },
  aggiornamenti: { quanti: 0, ha: false, addon: 0, gdahome: false, firmware: 0 },
  addon: { quanti: 3, accesi: 3, spentiCheDovrebbero: 0, elenco: [] },
  rete: { internet: true, schede: [], sorvegliate: { quante: 0, giu: 0 } },
  macchina: { scheda: "ODROID-N2+", cpu: 14, ram: 38, disco: 46, temperatura: 46, discoVita: 11 },
};

async function banco() {
  const cartella = mkdtempSync(join(tmpdir(), "quadro-"));
  const acceso = await alzaIlQuadro({
    porta: 0,
    cartella,
    livello: "errore",
    chiaveDellaConsole: CHIAVE_DELLA_CONSOLE,
  });
  const dove = `http://127.0.0.1:${acceso.porta}`;
  return {
    ...acceso,
    dove,
    /* Il retro: si bussa con la chiave della console. */
    retro: (via, opzioni = {}) =>
      fetch(`${dove}/console${via}`, {
        ...opzioni,
        headers: {
          authorization: `Bearer ${CHIAVE_DELLA_CONSOLE}`,
          "content-type": "application/json",
          ...(opzioni.headers || {}),
        },
      }),
    /* Il davanti: una casa che deposita. */
    deposita: (casa, chiave, carta = CARTOLINA) =>
      fetch(`${dove}/cartolina`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${chiave}`,
          "content-type": "application/json",
          "x-casa": casa,
        },
        body: JSON.stringify(carta),
      }),
    chiudi: async () => {
      await acceso.spegni();
      rmSync(cartella, { recursive: true, force: true });
    },
  };
}

const unCodice = async (b, per = "") => {
  const detto = await (
    await b.retro("/inviti", { method: "POST", body: JSON.stringify({ per }) })
  ).json();
  return detto.codice;
};

test("una casa non puo' leggere la console, e non e' una svista", async () => {
  const b = await banco();
  try {
    const codice = await unCodice(b);
    assert.equal((await b.deposita(UNA, codice)).status, 200);

    /* La chiave che le apre il deposito non le apre niente altro: quelle case
     * sono di clienti di qualcun altro. */
    for (const via of ["/case", "/inviti"]) {
      const risposta = await fetch(`${b.dove}/console${via}`, {
        headers: { authorization: `Bearer ${codice}` },
      });
      assert.equal(risposta.status, 401, `«${via}» si e' aperta con la chiave di una casa`);
    }
    /* E senza niente in testa, nemmeno. */
    assert.equal((await fetch(`${b.dove}/console/case`)).status, 401);
  } finally {
    await b.chiudi();
  }
});

test("un codice usato non serve a nessun'altra casa", async () => {
  const b = await banco();
  try {
    const codice = await unCodice(b);
    assert.equal((await b.deposita(UNA, codice)).status, 200);
    /* La stessa casa continua a entrare: la chiave e' sua. */
    assert.equal((await b.deposita(UNA, codice)).status, 200);
    /* Un'altra no, e non impara niente da come glielo si dice. */
    const altra = await b.deposita(ALTRA, codice);
    assert.equal(altra.status, 403);
    assert.match((await altra.json()).errore, /non apre niente/);
  } finally {
    await b.chiudi();
  }
});

test("un codice annullato non apre piu', e uno mai fatto nemmeno", async () => {
  const b = await banco();
  try {
    const codice = await unCodice(b);
    await b.retro(`/inviti/${codice}`, { method: "DELETE" });
    assert.equal((await b.deposita(UNA, codice)).status, 403);
    assert.equal((await b.deposita(UNA, "MAI-FATTO-QUESTO-QUI")).status, 403);
  } finally {
    await b.chiudi();
  }
});

test("una casa nuova nasce depositando, senza nome e in fila «collaudo aperto»", async () => {
  const b = await banco();
  try {
    await b.deposita(UNA, await unCodice(b, "Villa Aurora"));
    const { case: case_ } = await (await b.retro("/case")).json();
    assert.equal(case_.length, 1);
    assert.equal(case_[0].casa, UNA);
    assert.equal(case_[0].senzaNome, true);
    /* La prima cartolina di questa casa ha tutte le spunte a posto, quindi il
     * collaudo si chiude subito: e' giusto, l'impianto e' finito. */
    assert.equal(case_[0].stato.chiave, "posto");
    assert.ok(case_[0].collaudataIl);

    await b.retro(`/casa/${UNA}`, {
      method: "PUT",
      body: JSON.stringify({ nome: "Rossi — via Verdi 12" }),
    });
    const dopo = await (await b.retro("/case")).json();
    assert.equal(dopo.case[0].nome, "Rossi — via Verdi 12");
    assert.equal(dopo.case[0].senzaNome, false);
  } finally {
    await b.chiudi();
  }
});

test("quello che una cartolina non dice resta «non si sa», e non diventa rosso", async () => {
  const b = await banco();
  try {
    /* Una casa senza Supervisor e con Home Assistant giu': mezza cartolina. */
    await b.deposita(UNA, await unCodice(b), {
      quando: new Date().toISOString(),
      ogni: 15,
      ponte: "1.4.32.15",
    });
    const { case: case_ } = await (await b.retro("/case")).json();
    const collaudo = case_[0].collaudo;
    assert.equal(collaudo.aperte, 0, "niente e' «va male»");
    assert.equal(collaudo.fatte, 0, "e niente e' «a posto»");
    assert.equal(collaudo.ignote, collaudo.quante, "e' tutto «questa casa non lo dice»");
    /* E siccome nessuna spunta e' aperta, questa casa e' consegnabile: non
     * resta in fila per un dato che non e' suo. */
    assert.ok(case_[0].collaudataIl);
  } finally {
    await b.chiudi();
  }
});

test("la matricola che conta e' quella verificata, non quella scritta nel corpo", async () => {
  const b = await banco();
  try {
    await b.deposita(UNA, await unCodice(b), { ...CARTOLINA, casa: ALTRA });
    const { case: case_ } = await (await b.retro("/case")).json();
    assert.equal(case_.length, 1);
    assert.equal(case_[0].casa, UNA);
    assert.equal(case_[0].carta.casa, UNA, "la matricola del corpo si riscrive");
  } finally {
    await b.chiudi();
  }
});

test("una matricola storta non entra, e una cartolina che non e' JSON nemmeno", async () => {
  const b = await banco();
  try {
    const codice = await unCodice(b);
    assert.equal((await b.deposita("non-una-matricola", codice)).status, 400);
    const storta = await fetch(`${b.dove}/cartolina`, {
      method: "POST",
      headers: { authorization: `Bearer ${codice}`, "x-casa": UNA },
      body: "questo non e' JSON",
    });
    assert.equal(storta.status, 413);
  } finally {
    await b.chiudi();
  }
});

test("non seguirla piu' butta quello che se ne sa e anche la sua chiave", async () => {
  const b = await banco();
  try {
    const codice = await unCodice(b);
    await b.deposita(UNA, codice);
    await b.retro(`/casa/${UNA}`, { method: "DELETE" });
    const { case: case_ } = await (await b.retro("/case")).json();
    assert.equal(case_.length, 0);
    /* E senza buttare anche la chiave, la prima cartolina la farebbe rinascere
     * tre secondi dopo. */
    assert.equal((await b.deposita(UNA, codice)).status, 403);
  } finally {
    await b.chiudi();
  }
});

test("la soglia e la salute rispondono a chi non sa cosa sia questo indirizzo", async () => {
  const b = await banco();
  try {
    const soglia = await fetch(`${b.dove}/`);
    assert.equal(soglia.status, 200);
    assert.match(await soglia.text(), /Non si entra in nessuna casa/);
    const salute = await (await fetch(`${b.dove}/salute`)).json();
    assert.deepEqual(salute, { vivo: true, case: 0, console: true });
  } finally {
    await b.chiudi();
  }
});
