/* La configurazione di una plancia, dal cruscotto: com'e' fatta arriva da
 * casa, la si riscrive, e la casa ritira il lavoro.
 *
 * Il permesso e' il terzo interruttore dell'add-on, e la casa lo dice nel
 * rapporto: senza, qui non si deposita, non si legge e non si scrive niente —
 * chieda pure chi vuole. Quello che si tiene fermo: che lo scatto parta solo
 * quando il quadro lo chiede e solo se e' cambiato, che un flusso di
 * telecamera non passi da nessuna delle due porte, che la modifica diventi un
 * lavoro `configura` che la casa ritira una volta sola, e che un installatore
 * non legga le plance di un altro.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { alzaIlQuadro } from "../src/index.js";
import { haFlussi } from "../src/plance.js";

const QUI = dirname(fileURLToPath(import.meta.url));
const CRUSCOTTO = readFileSync(join(QUI, "..", "console", "index.html"), "utf8");
const GESTIONE = readFileSync(join(QUI, "..", "gestore", "index.html"), "utf8");

const CHIAVE_DEL_GESTORE = "una-chiave-lunga-abbastanza-per-il-gestore";
const UNA = "casa_a3f19c74e05b2d8890fa4c1e6b73d052";

const rapporto = (piu = {}) => ({
  quando: new Date().toISOString(),
  ogni: 1,
  ponte: "1.5.9.13",
  manutenzione: false,
  configurazione: true,
  plance: {
    quante: 1,
    configurate: 1,
    elenco: [{ profilo: "primary", titolo: "Casa", revisione: 12 }],
  },
  telefoni: { abbinati: 1, visti7gg: 1 },
  fuori: { acceso: true, filo: true },
  entita: { totali: 214, sparite: 0, dispositivi: 0, nomi: [] },
  ...piu,
});

const VALORI = {
  dm_schema_version: "4",
  cd_stanze: JSON.stringify([{ id: "cucina", name: "Cucina" }]),
};

async function banco() {
  const cartella = mkdtempSync(join(tmpdir(), "configura-"));
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
  for (const nome of ["Impianti Rossi", "Impianti Bianchi"]) {
    iscritti.push(
      await (
        await gestore("/installatori", { method: "POST", body: JSON.stringify({ nome }) })
      ).json(),
    );
  }
  const retro = (via, opzioni = {}, chiave = iscritti[0].chiave) =>
    fetch(`${dove}/console${via}`, {
      ...opzioni,
      headers: {
        authorization: `Bearer ${chiave}`,
        "content-type": "application/json",
        ...(opzioni.headers || {}),
      },
    });
  const unCodice = async (chiave) =>
    (await (await retro("/inviti", { method: "POST", body: "{}" }, chiave)).json()).codice;
  /* Le due porte della casa: il rapporto, e la plancia che manda o ritira. */
  const daCasa = (via, codice, opzioni = {}) =>
    fetch(`${dove}${via}`, {
      ...opzioni,
      headers: {
        authorization: `Bearer ${codice}`,
        "content-type": "application/json",
        "x-casa": UNA,
        ...(opzioni.headers || {}),
      },
    });
  const deposita = async (codice, carta = rapporto()) =>
    (await daCasa("/rapporto", codice, { method: "POST", body: JSON.stringify(carta) })).json();
  const manda = (codice, scatto) =>
    daCasa("/plancia", codice, { method: "POST", body: JSON.stringify(scatto) });
  return {
    retro,
    iscritti,
    unCodice,
    deposita,
    manda,
    daCasa,
    chiudi: async () => {
      await acceso.spegni();
      rmSync(cartella, { recursive: true, force: true });
    },
  };
}

test("lo scatto parte quando il quadro lo chiede, e solo se e' cambiato", async () => {
  const b = await banco();
  try {
    const codice = await b.unCodice();
    /* Il quadro non ha niente: lo chiede. */
    const prima = await b.deposita(codice);
    assert.deepEqual(prima.vuoleLaPlancia, ["primary"]);
    /* La casa lo manda. */
    const presa = await b.manda(codice, {
      profilo: "primary",
      titolo: "Casa",
      revisione: 12,
      valori: VALORI,
    });
    assert.equal(presa.status, 200);
    /* Adesso ce l'ha, alla stessa revisione: non lo chiede piu'. */
    const dopo = await b.deposita(codice);
    assert.equal("vuoleLaPlancia" in dopo, false);
    /* In casa e' cambiata: lo richiede. */
    const cambiata = rapporto();
    cambiata.plance.elenco[0].revisione = 13;
    assert.deepEqual((await b.deposita(codice, cambiata)).vuoleLaPlancia, ["primary"]);
  } finally {
    await b.chiudi();
  }
});

test("senza il terzo interruttore non si chiede, non si deposita, non si legge e non si scrive", async () => {
  const b = await banco();
  try {
    const codice = await b.unCodice();
    const chiuso = await b.deposita(codice, rapporto({ configurazione: false }));
    assert.equal("vuoleLaPlancia" in chiuso, false);
    const presa = await b.manda(codice, { profilo: "primary", revisione: 12, valori: VALORI });
    assert.equal(presa.status, 409);
    assert.match((await presa.json()).errore, /non lascia configurare/);
    const letta = await b.retro(`/casa/${UNA}/plancia/primary/configurazione`);
    assert.equal(letta.status, 409);
    const scritta = await b.retro(`/casa/${UNA}/plancia/primary/configurazione`, {
      method: "PUT",
      body: JSON.stringify({ valori: VALORI, revisioneAttesa: 12 }),
    });
    assert.equal(scritta.status, 409);
    /* E un impianto con l'add-on di ieri, che la parola non la dice, e' chiuso
     * come uno che dice di no. */
    const diIeri = rapporto();
    delete diIeri.configurazione;
    assert.equal("vuoleLaPlancia" in (await b.deposita(codice, diIeri)), false);
  } finally {
    await b.chiudi();
  }
});

test("dal cruscotto si legge com'e' fatta e la si riscrive; la casa ritira il lavoro una volta sola", async () => {
  const b = await banco();
  try {
    const codice = await b.unCodice();
    await b.deposita(codice);
    await b.manda(codice, { profilo: "primary", titolo: "Casa", revisione: 12, valori: VALORI });

    const letta = await b.retro(`/casa/${UNA}/plancia/primary/configurazione`);
    assert.equal(letta.status, 200);
    const { scatto } = await letta.json();
    assert.equal(scatto.revisione, 12);
    assert.deepEqual(scatto.valori, VALORI);

    /* Un'altra plancia, che la casa non ha mandato: niente da leggere, e non
     * e' un errore. */
    const vuota = await b.retro(`/casa/${UNA}/plancia/suocero/configurazione`);
    assert.equal(vuota.status, 200);
    assert.equal((await vuota.json()).scatto, null);

    const nuovi = {
      ...VALORI,
      cd_stanze: JSON.stringify([{ id: "cucina", name: "Cucina nuova" }]),
    };
    const scritta = await b.retro(`/casa/${UNA}/plancia/primary/configurazione`, {
      method: "PUT",
      body: JSON.stringify({ valori: nuovi, revisioneAttesa: 12 }),
    });
    assert.equal(scritta.status, 200);
    const { chiesto } = await scritta.json();
    assert.equal(chiesto.cosa, "configura");
    assert.equal(chiesto.nome, "primary");

    /* Il lavoro arriva alla casa nella risposta al rapporto: il nome della
     * cosa da fare, non la cosa. */
    const risposta = await b.deposita(codice);
    assert.equal(risposta.fai.cosa, "configura");
    assert.equal(risposta.fai.nome, "primary");
    assert.equal(risposta.fai.da, "12");
    assert.ok(!JSON.stringify(risposta).includes("Cucina nuova"));

    /* La casa se la va a prendere, per quell'id, e una volta sola. */
    const sbagliato = await b.daCasa(`/plancia/primary?id=non-questo`, codice);
    assert.equal(sbagliato.status, 404);
    const ritiro = await b.daCasa(`/plancia/primary?id=${risposta.fai.id}`, codice);
    assert.equal(ritiro.status, 200);
    const consegna = await ritiro.json();
    assert.deepEqual(consegna.valori, nuovi);
    assert.equal(consegna.revisioneAttesa, 12);
    assert.equal((await b.daCasa(`/plancia/primary?id=${risposta.fai.id}`, codice)).status, 404);
  } finally {
    await b.chiudi();
  }
});

test("un flusso di telecamera non passa da nessuna delle due porte, nemmeno dentro un valore JSON", async () => {
  const b = await banco();
  try {
    const codice = await b.unCodice();
    await b.deposita(codice);
    /* Dentro la plancia i valori sono testi JSON: il setaccio deve guardarci
     * dentro, o un `rtsp://` in mezzo a un elenco passa. */
    const conFlusso = {
      ...VALORI,
      cd_telecamere: JSON.stringify([
        { entity: "camera.ingresso", stream: "rtsp://u:p@192.168.1.9/ingresso" },
      ]),
    };
    assert.equal(haFlussi(conFlusso), true);
    /* Da casa: quello che arriva si tiene senza il flusso, e all'installatore
     * non si fa vedere. */
    const presa = await b.manda(codice, {
      profilo: "primary",
      titolo: "Casa",
      revisione: 12,
      valori: conFlusso,
    });
    assert.equal(presa.status, 200);
    const letta = await (await b.retro(`/casa/${UNA}/plancia/primary/configurazione`)).json();
    assert.ok(!JSON.stringify(letta).includes("rtsp://"));
    assert.equal(JSON.parse(letta.scatto.valori.cd_telecamere)[0].entity, "camera.ingresso");
    /* Dal cruscotto: si rifiuta, e si dice. */
    const scritta = await b.retro(`/casa/${UNA}/plancia/primary/configurazione`, {
      method: "PUT",
      body: JSON.stringify({ valori: conFlusso, revisioneAttesa: 12 }),
    });
    assert.equal(scritta.status, 400);
    assert.match((await scritta.json()).errore, /flusso/);
    assert.equal("fai" in (await b.deposita(codice)), false);
  } finally {
    await b.chiudi();
  }
});

test("un installatore non legge ne' scrive le plance di un altro", async () => {
  const b = await banco();
  try {
    const codice = await b.unCodice();
    await b.deposita(codice);
    await b.manda(codice, { profilo: "primary", titolo: "Casa", revisione: 12, valori: VALORI });
    const diBianchi = b.iscritti[1].chiave;
    const letta = await b.retro(`/casa/${UNA}/plancia/primary/configurazione`, {}, diBianchi);
    assert.equal(letta.status, 404);
    const scritta = await b.retro(
      `/casa/${UNA}/plancia/primary/configurazione`,
      { method: "PUT", body: JSON.stringify({ valori: VALORI, revisioneAttesa: 12 }) },
      diBianchi,
    );
    assert.equal(scritta.status, 404);
  } finally {
    await b.chiudi();
  }
});

test("il cruscotto apre la configurazione dal capitolo «Le plance», e solo dove la casa lo permette", () => {
  const capitolo = CRUSCOTTO.slice(
    CRUSCOTTO.indexOf("function leVestiDellePlance(casa, c)"),
    CRUSCOTTO.indexOf("function soloIGuai(casa)"),
  );
  assert.match(capitolo, /const siConfigura = c\.configurazione === true;/);
  assert.match(capitolo, /siConfigura && !una\.nuova/);
  assert.match(capitolo, /data-configura-plancia="\$\{testo\(casa\.casa\)\}"/);
  /* Il tasto apre l'editor vero, in un riquadro sopra la pagina: la casella
   * di JSON di prima non c'e' piu' (`l-editor-della-plancia-dal-cruscotto`). */
  assert.match(
    CRUSCOTTO,
    /apriLEditor\(tasto\.dataset\.configuraPlancia, tasto\.dataset\.profilo\)/,
  );
  assert.doesNotMatch(capitolo, /lEditorDi|textarea/);
  /* Chi non lo permette lo legge, invece di cercare un tasto che non c'e'. */
  assert.match(capitolo, /non ha attivato la <b>configurazione da lontano<\/b>/);
  /* E la gestione legge e basta: nessun tasto, nessun editor. */
  assert.doesNotMatch(GESTIONE, /data-configura-plancia|apriLEditor|editor-plancia/);
});
