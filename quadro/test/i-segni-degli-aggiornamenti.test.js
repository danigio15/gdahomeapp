/* L'icona vera di un aggiornamento, e le sue note intere.
 *
 * Il giro, per intero: la casa manda i byte dentro il rapporto, il quadro li
 * tiene, e li serve dal **suo** indirizzo. Il browser di chi installa non va
 * piu' a farsi vedere su `brands.home-assistant.io`, e quello che vede e'
 * l'icona giusta invece del logo di HACS.
 *
 * Quello che si prova davvero e' la parte che costa: **un'icona viaggia una
 * volta sola**. Il quadro dice quali segni non ha, la casa manda quelli e
 * nessun altro. Senza, sarebbe qualche megabyte al giorno per casa per roba
 * che non cambia mai — e chi rompe quella riga non se ne accorge guardando lo
 * schermo, perche' a schermo funziona uguale.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { alzaIlQuadro } from "../src/index.js";
import { ilSegnoDi } from "../../ponte/src/segni.js";

const CHIAVE_DEL_GESTORE = "una-chiave-lunga-abbastanza-per-il-gestore";
const UNA = "casa_a3f19c74e05b2d8890fa4c1e6b73d052";
const ALTRA = "casa_71cd3a6e884b09f25de4a1c7b3608e14";

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 7),
]);

const SEGNO = ilSegnoDi("Mosquitto broker", "6.5.1");

const rapporto = (piu = {}) => ({
  quando: new Date().toISOString(),
  ogni: 1,
  ponte: "1.5.9.4",
  aggiornamenti: {
    quanti: 1,
    ha: false,
    gdahome: false,
    addon: 1,
    firmware: 0,
    elenco: [
      {
        nome: "Mosquitto broker",
        da: "6.4.0",
        a: "6.5.1",
        nostra: false,
        installabile: true,
        segno: SEGNO,
        ...piu,
      },
    ],
  },
});

async function banco() {
  const cartella = mkdtempSync(join(tmpdir(), "segni-"));
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
  const unCodice = async (per = "") =>
    (await (await retro("/inviti", { method: "POST", body: JSON.stringify({ per }) })).json())
      .codice;
  return {
    ...acceso,
    dove,
    retro,
    unCodice,
    deposita: (casa, chiave, carta) =>
      fetch(`${dove}/rapporto`, {
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

test("il quadro dice cosa gli manca, e poi non lo richiede piu'", async () => {
  const b = await banco();
  try {
    const codice = await b.unCodice("Rossi");

    /* Primo rapporto: il segno c'e', l'icona no. Il quadro la chiede. */
    const primo = await (await b.deposita(UNA, codice, rapporto())).json();
    assert.deepEqual(primo.manca, [SEGNO]);

    /* La casa la manda. */
    const secondo = await (
      await b.deposita(
        UNA,
        codice,
        rapporto({ logo: PNG.toString("base64"), logoTipo: "image/png", note: "## 6.5.1\nRoba." }),
      )
    ).json();
    assert.equal(secondo.manca, undefined, "la richiede ancora, e viaggerebbe per sempre");

    /* E da li' in poi non la chiede piu'. */
    const terzo = await (await b.deposita(UNA, codice, rapporto())).json();
    assert.equal(terzo.manca, undefined);
  } finally {
    await b.chiudi();
  }
});

test("l'icona si serve dall'indirizzo del quadro, e senza chiave", async () => {
  const b = await banco();
  try {
    const codice = await b.unCodice("Rossi");
    await b.deposita(
      UNA,
      codice,
      rapporto({ logo: PNG.toString("base64"), logoTipo: "image/png" }),
    );

    /* Senza chiave: quel disegno deve arrivare nel browser di chi installa, e
     * sedici cifre esadecimali non si indovinano. */
    const presa = await fetch(`${b.dove}/segno/${SEGNO}`);
    assert.equal(presa.status, 200);
    assert.equal(presa.headers.get("content-type"), "image/png");
    assert.equal(presa.headers.get("x-content-type-options"), "nosniff");
    assert.ok(presa.headers.get("content-security-policy")?.includes("sandbox"));
    assert.deepEqual(Buffer.from(await presa.arrayBuffer()), PNG);

    /* Un segno che non c'e' e' un 404, non un mezzo disegno. */
    assert.equal((await fetch(`${b.dove}/segno/${"0".repeat(16)}`)).status, 404);
    assert.equal((await fetch(`${b.dove}/segno/non-un-segno`)).status, 404);
  } finally {
    await b.chiudi();
  }
});

test("quello che non e' un'immagine non diventa un'immagine", async () => {
  const b = await banco();
  try {
    const codice = await b.unCodice("Rossi");
    /* Il controllo lo fa gia' la casa. Rifarlo qui non e' diffidenza verso
     * quella casa: fra le due macchine c'e' una rete, e un controllo da una
     * parte sola non e' un controllo. */
    await b.deposita(
      UNA,
      codice,
      rapporto({ logo: Buffer.from("<html>ciao</html>").toString("base64") }),
    );
    assert.equal((await fetch(`${b.dove}/segno/${SEGNO}`)).status, 404);
    /* E siccome non l'ha presa, la richiede: non si segna «arrivata». */
    const dopo = await (await b.deposita(UNA, codice, rapporto())).json();
    assert.deepEqual(dopo.manca, [SEGNO]);
  } finally {
    await b.chiudi();
  }
});

test("due case che aspettano lo stesso aggiornamento ne fanno una copia sola", async () => {
  /* E' il motivo per cui il segno viene dal nome e dalla versione e non dalla
   * casa: quaranta case con lo stesso Mosquitto da aggiornare tengono qui
   * un'icona, non quaranta. */
  const b = await banco();
  try {
    const una = await b.unCodice("Rossi");
    const altra = await b.unCodice("Bianchi");
    await b.deposita(UNA, una, rapporto({ logo: PNG.toString("base64") }));
    /* La seconda casa non se la sente nemmeno chiedere. */
    const detto = await (await b.deposita(ALTRA, altra, rapporto())).json();
    assert.equal(detto.manca, undefined);
  } finally {
    await b.chiudi();
  }
});

test("le note intere si leggono dal cruscotto, con la chiave", async () => {
  const b = await banco();
  try {
    const codice = await b.unCodice("Rossi");
    await b.deposita(UNA, codice, rapporto({ note: "## 6.5.1\n\n- una cosa\n- un'altra" }));

    /* La pagina sa quali aggiornamenti hanno qualcosa da aprire. */
    const sue = await (await b.retro("/case")).json();
    assert.deepEqual(sue.note, [SEGNO]);

    const dette = await (await b.retro(`/note/${SEGNO}`)).json();
    assert.match(dette.note, /una cosa/);

    /* Un CHANGELOG e' testo che qualcuno ha scritto, e vuole la chiave: non e'
     * un disegno come l'icona. */
    assert.equal((await fetch(`${b.dove}/console/note/${SEGNO}`)).status, 401);
    assert.equal((await b.retro(`/note/${"0".repeat(16)}`)).status, 404);
  } finally {
    await b.chiudi();
  }
});

test("l'entita' di una casa non passa di qui", async () => {
  /* Il segno e' un'impronta di quello che nel rapporto c'e' gia' — il nome e
   * la versione — e non aggiunge niente a quello che il quadro sa. Se un
   * giorno ci finisse dentro l'entita', sarebbe `update.camera_di_marco`: chi
   * ci abita, e in quale stanza. */
  assert.equal(ilSegnoDi("Mosquitto broker", "6.5.1"), SEGNO);
  assert.notEqual(ilSegnoDi("Mosquitto broker", "6.5.2"), SEGNO);
  assert.match(SEGNO, /^[0-9a-f]{16}$/);
});
