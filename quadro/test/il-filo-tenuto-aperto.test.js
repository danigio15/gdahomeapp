/* Il filo tenuto aperto, col quadro vero acceso.
 *
 * Quello che si prova e' una cosa sola, ed e' quella che si sente usandolo:
 * fra il tasto «Installa» e la casa che lo sa non passa piu' un minuto —
 * passa un giro di rete.
 *
 * Come funziona: dopo aver depositato, la casa chiede `/attesa` e quella
 * richiesta **non si chiude**. Resta li' finche' non c'e' qualcosa da dirle o
 * finche' non scade. Quando qualcuno preme il tasto, chi e' in linea lo sente
 * nell'istante.
 *
 * ─── Cosa NON deve succedere, ed e' la meta' che conta ───────────────────
 *
 * Il filo e' un **di piu'**. Chi non puo' tenerlo — un ponte vecchio, un proxy
 * che taglia le richieste lunghe — non deve perdere niente: il rapporto al
 * minuto porta il lavoro come ha sempre fatto. Percio' qui si prova anche che
 * il lavoro resti in coda per chi non aspetta, e che un lavoro consegnato a un
 * filo non venga consegnato due volte.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { alzaIlQuadro } from "../src/index.js";

const CHIAVE_DEL_GESTORE = "una-chiave-lunga-abbastanza-per-il-gestore";
const UNA = "casa_a3f19c74e05b2d8890fa4c1e6b73d052";

const RAPPORTO = {
  quando: new Date().toISOString(),
  ogni: 1,
  ponte: "1.5.9.2",
  manutenzione: true,
  plance: { quante: 1, configurate: 1 },
  telefoni: { abbinati: 1, visti7gg: 1 },
  aggiornamenti: {
    quanti: 1,
    ha: false,
    gdahome: false,
    addon: 1,
    firmware: 0,
    elenco: [
      { nome: "Mosquitto broker", da: "6.4.0", a: "6.5.1", nostra: false, installabile: true },
    ],
  },
};

async function banco() {
  const cartella = mkdtempSync(join(tmpdir(), "filo-"));
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
  const suo = await (
    await gestore("/installatori", {
      method: "POST",
      body: JSON.stringify({ nome: "Impianti Rossi" }),
    })
  ).json();
  const retro = (via, opzioni = {}) =>
    fetch(`${dove}/console${via}`, {
      ...opzioni,
      headers: {
        authorization: `Bearer ${suo.chiave}`,
        "content-type": "application/json",
        ...(opzioni.headers || {}),
      },
    });
  const codice = (
    await (
      await retro("/inviti", { method: "POST", body: JSON.stringify({ per: "Rossi" }) })
    ).json()
  ).codice;
  await fetch(`${dove}/rapporto`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${codice}`,
      "content-type": "application/json",
      "x-casa": UNA,
    },
    body: JSON.stringify(RAPPORTO),
  });
  return {
    ...acceso,
    dove,
    retro,
    codice,
    /* La casa che resta in linea. Torna la promessa, non la risposta: il punto
     * di questa via e' che la risposta arriva dopo. */
    attesa: (casa = UNA, chiave = codice, taglia = undefined) =>
      fetch(`${dove}/attesa`, {
        headers: { authorization: `Bearer ${chiave}`, "x-casa": casa },
        signal: taglia,
      }),
    installa: () =>
      retro(`/casa/${UNA}/installa`, {
        method: "POST",
        body: JSON.stringify({ nome: "Mosquitto broker", da: "6.4.0", a: "6.5.1" }),
      }),
    chiudi: async () => {
      await acceso.spegni();
      rmSync(cartella, { recursive: true, force: true });
    },
  };
}

test("premuto il tasto, chi e' in linea lo sente nell'istante", async () => {
  const b = await banco();
  try {
    /* La casa si mette in linea e **non** riceve niente: non c'e' ancora
     * niente da dirle. */
    const inLinea = b.attesa();
    let risposto = false;
    void inLinea.then(() => {
      risposto = true;
    });
    await new Promise((ok) => setTimeout(ok, 120));
    assert.equal(risposto, false, "ha risposto senza avere niente da dire");

    /* Adesso qualcuno preme «Installa». */
    const premuto = Date.now();
    assert.equal((await b.installa()).status, 200);

    const detto = await (await inLinea).json();
    const quanto = Date.now() - premuto;
    assert.equal(detto.fai?.cosa, "installa");
    assert.equal(detto.fai?.nome, "Mosquitto broker");
    assert.equal(detto.fai?.a, "6.5.1");
    assert.ok(quanto < 2000, `ci ha messo ${quanto}ms: non e' tempo reale`);
  } finally {
    await b.chiudi();
  }
});

test("quello che aspetta gia' non fa aspettare: si risponde subito", async () => {
  const b = await banco();
  try {
    await b.installa();
    /* Chiesto prima che la casa si mettesse in linea: la risposta e' immediata
     * e non c'e' niente da tenere aperto. */
    const detto = await (await b.attesa()).json();
    assert.equal(detto.fai?.nome, "Mosquitto broker");
  } finally {
    await b.chiudi();
  }
});

test("un lavoro consegnato al filo non si riconsegna col rapporto", async () => {
  const b = await banco();
  try {
    await b.installa();
    assert.ok((await (await b.attesa()).json()).fai, "il filo non l'ha avuto");

    /* Il rapporto dopo non lo ridà: una volta sola, come sempre. */
    const dopo = await (
      await fetch(`${b.dove}/rapporto`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${b.codice}`,
          "content-type": "application/json",
          "x-casa": UNA,
        },
        body: JSON.stringify(RAPPORTO),
      })
    ).json();
    assert.equal(dopo.fai, undefined, "lo stesso lavoro e' partito due volte");
  } finally {
    await b.chiudi();
  }
});

test("una casa sola per volta: il filo di prima si chiude a mani vuote", async () => {
  const b = await banco();
  try {
    const vecchio = b.attesa();
    await new Promise((ok) => setTimeout(ok, 80));
    const nuovo = b.attesa();
    /* Il vecchio torna subito, e vuoto. */
    assert.deepEqual(await (await vecchio).json(), {});

    await b.installa();
    /* E il lavoro va a quello nuovo, che e' quello che la casa sta davvero
     * ascoltando. */
    assert.ok((await (await nuovo).json()).fai);
  } finally {
    await b.chiudi();
  }
});

test("il filo vuole la chiave di quella casa, come il rapporto", async () => {
  const b = await banco();
  try {
    assert.equal((await b.attesa(UNA, "una-chiave-che-non-esiste")).status, 403);
    assert.equal((await b.attesa("non-una-matricola", b.codice)).status, 400);
  } finally {
    await b.chiudi();
  }
});

test("spegnendo, i fili aperti si chiudono invece di tenere in piedi il quadro", async () => {
  const b = await banco();
  const inLinea = b.attesa();
  await new Promise((ok) => setTimeout(ok, 80));
  /* Se `spegni` non li lasciasse andare, questa prova non finirebbe: `close`
   * aspetta le richieste in corso, e queste per definizione non finiscono. */
  await b.chiudi();
  assert.deepEqual(await (await inLinea).json(), {});
});
