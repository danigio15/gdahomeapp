/* Le vesti delle plance: i due nomi che l'installatore sceglie per ogni
 * plancia di una sua casa.
 *
 * Il titolo va nel menu laterale di Home Assistant e in cima alla home; la
 * parola del velo compare col suo logo mentre la pagina si apre. Il quadro
 * le tiene per casa e per profilo, e le rimanda alla casa con la risposta a
 * ogni rapporto: e' l'unica strada da cui entrano, ed e' la stessa del nome e
 * del logo.
 *
 * Quello che si tiene qui: che si vesta **solo una plancia che la casa ha
 * detto di avere**, che un installatore non vesta le case di un altro, che
 * un impianto con l'add-on di ieri lo dica invece di far finta, e che un nome
 * arrivato dal cruscotto non porti HTML in casa d'altri.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { alzaIlQuadro } from "../src/index.js";
import { PLANCE_AL_MASSIMO } from "../src/case.js";
import { QUANTE_AL_MASSIMO } from "../../ponte/src/plance.js";

const QUI = dirname(fileURLToPath(import.meta.url));
const CRUSCOTTO = readFileSync(join(QUI, "..", "console", "index.html"), "utf8");
const GESTIONE = readFileSync(join(QUI, "..", "gestore", "index.html"), "utf8");

const CHIAVE_DEL_GESTORE = "una-chiave-lunga-abbastanza-per-il-gestore";
const UNA = "casa_a3f19c74e05b2d8890fa4c1e6b73d052";
const ALTRA = "casa_71cd3a6e884b09f25de4a1c7b3608e14";

const RAPPORTO = {
  quando: new Date().toISOString(),
  ogni: 1,
  ponte: "1.5.9.13",
  plance: {
    quante: 2,
    configurate: 1,
    elenco: [
      { profilo: "primary", titolo: "gdahome" },
      { profilo: "suocero", titolo: "Suocero" },
    ],
  },
  telefoni: { abbinati: 1, visti7gg: 1 },
  fuori: { acceso: true, filo: true },
  entita: { totali: 214, sparite: 0, dispositivi: 0, nomi: [] },
};

/* Un impianto con l'add-on di ieri: quante plance ha, ma non quali. */
const RAPPORTO_DI_IERI = { ...RAPPORTO, ponte: "1.5.9.12", plance: { quante: 1, configurate: 1 } };

async function banco() {
  const cartella = mkdtempSync(join(tmpdir(), "vesti-"));
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
  const deposita = async (casa, codice, carta = RAPPORTO) =>
    (
      await fetch(`${dove}/rapporto`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${codice}`,
          "content-type": "application/json",
          "x-casa": casa,
          /* Il segreto che la casa si fa da se' (`chiavi.riconosci`): e' con
           * questo che, cambiando installatore, dimostra di essere lei. */
          "x-casa-segreto": `il-segreto-di-${casa}`,
        },
        body: JSON.stringify(carta),
      })
    ).json();
  const vesti = (casa, profilo, corpo, chiave) =>
    retro(
      `/casa/${casa}/plancia/${profilo}`,
      { method: "PUT", body: JSON.stringify(corpo) },
      chiave,
    );
  return {
    dove,
    gestore,
    retro,
    iscritti,
    unCodice,
    deposita,
    vesti,
    chiudi: async () => {
      await acceso.spegni();
      rmSync(cartella, { recursive: true, force: true });
    },
  };
}

test("le vesti scelte tornano alla casa col rapporto dopo, e si leggono nell'elenco", async () => {
  const b = await banco();
  try {
    const codice = await b.unCodice();
    const prima = await b.deposita(UNA, codice);
    assert.equal("vesti" in prima, false, "senza scelte non parte niente");

    const messa = await b.vesti(UNA, "primary", { titolo: "Casa Rossi", velo: "Rossi impianti" });
    assert.equal(messa.status, 200);
    const sua = (await messa.json()).case.find((casa) => casa.casa === UNA);
    assert.deepEqual(sua.vesti, { primary: { titolo: "Casa Rossi", velo: "Rossi impianti" } });

    /* Una sola delle due basta. */
    await b.vesti(UNA, "suocero", { titolo: "Nonni" });
    const dopo = await b.deposita(UNA, codice);
    assert.deepEqual(dopo.vesti, {
      primary: { titolo: "Casa Rossi", velo: "Rossi impianti" },
      suocero: { titolo: "Nonni", velo: "" },
    });

    /* Tutte e due vuote tolgono la scelta, e senza scelte non parte niente. */
    await b.vesti(UNA, "primary", { titolo: "", velo: "  " });
    await b.vesti(UNA, "suocero", {});
    const spoglia = await b.deposita(UNA, codice);
    assert.equal("vesti" in spoglia, false);
    const elenco = (await (await b.retro("/case")).json()).case;
    assert.deepEqual(elenco.find((casa) => casa.casa === UNA).vesti, {});
  } finally {
    await b.chiudi();
  }
});

test("si veste solo una plancia che la casa dice di avere, e solo una casa propria", async () => {
  const b = await banco();
  try {
    const codice = await b.unCodice();
    await b.deposita(UNA, codice);

    const fantasma = await b.vesti(UNA, "fantasma", { titolo: "X" });
    assert.equal(fantasma.status, 404);
    assert.match((await fantasma.json()).errore, /non ha una plancia/);

    /* L'altro installatore: «non e' tua» e «non esiste» si dicono uguale. */
    const altrui = await b.vesti(UNA, "primary", { titolo: "X" }, b.iscritti[1].chiave);
    assert.equal(altrui.status, 404);
    assert.match((await altrui.json()).errore, /non la segui tu/);
    const mai = await b.vesti(ALTRA, "primary", { titolo: "X" });
    assert.equal(mai.status, 404);

    /* E senza chiave non si entra. */
    const nudo = await b.vesti(UNA, "primary", { titolo: "X" }, "una-chiave-inventata");
    assert.equal(nudo.status, 401);
  } finally {
    await b.chiudi();
  }
});

test("un impianto con l'add-on di ieri non si veste, e lo dice", async () => {
  const b = await banco();
  try {
    const codice = await b.unCodice();
    await b.deposita(UNA, codice, RAPPORTO_DI_IERI);
    const risposta = await b.vesti(UNA, "primary", { titolo: "Casa Rossi" });
    assert.equal(risposta.status, 409);
    assert.match((await risposta.json()).errore, /aggiorna l'add-on/);
  } finally {
    await b.chiudi();
  }
});

test("un nome che arriva dal cruscotto non porta HTML in casa d'altri, e non e' infinito", async () => {
  const b = await banco();
  try {
    const codice = await b.unCodice();
    await b.deposita(UNA, codice);
    await b.vesti(UNA, "primary", {
      titolo: '<b>Casa</b>   "Rossi" & C.',
      velo: "x".repeat(200),
    });
    const dopo = await b.deposita(UNA, codice);
    assert.deepEqual(dopo.vesti, {
      primary: { titolo: "b Casa /b Rossi C.", velo: "x".repeat(40) },
    });
  } finally {
    await b.chiudi();
  }
});

test("dalla gestione le vesti si vedono, e basta", async () => {
  const b = await banco();
  try {
    const codice = await b.unCodice();
    await b.deposita(UNA, codice);
    await b.vesti(UNA, "primary", { titolo: "Casa Rossi", velo: "Rossi impianti" });
    const sue = await (await b.gestore(`/installatore/${b.iscritti[0].chi}/case`)).json();
    assert.deepEqual(sue.case[0].vesti, {
      primary: { titolo: "Casa Rossi", velo: "Rossi impianti" },
    });
    /* Dalla gestione non c'e' una via per vestirle: si guarda soltanto. */
    const provato = await b.gestore(`/casa/${UNA}/plancia/primary`, {
      method: "PUT",
      body: JSON.stringify({ titolo: "X" }),
    });
    assert.equal(provato.status, 404);
  } finally {
    await b.chiudi();
  }
});

test("quando una casa cambia installatore, le vesti del vecchio se ne vanno con lui", async () => {
  const b = await banco();
  try {
    const codice = await b.unCodice();
    await b.deposita(UNA, codice);
    await b.vesti(UNA, "primary", { titolo: "Casa Rossi" });
    /* Riabbinata con un codice di Bianchi: la casa e' sua, e le scelte di
     * Rossi non sono affari suoi. */
    const diBianchi = await b.unCodice(b.iscritti[1].chiave);
    const dopo = await b.deposita(UNA, diBianchi);
    assert.equal(dopo.presa, true);
    assert.equal("vesti" in dopo, false);
  } finally {
    await b.chiudi();
  }
});

test("il cruscotto ha il capitolo «Le plance» con due caselle per plancia; la gestione lo legge e basta", () => {
  assert.match(CRUSCOTTO, /<h2>Le plance<\/h2>/);
  assert.match(CRUSCOTTO, /function leVestiDellePlance\(casa, c\)/);
  assert.match(CRUSCOTTO, /data-veste-titolo/);
  assert.match(CRUSCOTTO, /data-veste-velo/);
  assert.match(CRUSCOTTO, /data-salva-veste="\$\{testo\(una\.profilo\)\}"/);
  assert.match(CRUSCOTTO, /\/casa\/\$\{tasto\.dataset\.perCasa\}\/plancia\//);
  /* Quaranta lettere, come il titolo di una plancia nel ponte. */
  assert.match(CRUSCOTTO, /maxlength="40"/);
  /* Un impianto con l'add-on di ieri lo dice, invece di far finta. */
  assert.match(CRUSCOTTO, /precedente alla 1\.5\.9\.13/);
  /* Il tasto non porta `data-casa`: quello apre il foglio di una casa. */
  assert.doesNotMatch(CRUSCOTTO, /data-salva-veste="[^"]*" data-casa=/);

  /* Una plancia in piu' si aggiunge da qui, una in attesa si annulla, e il
   * conto tiene la stessa misura del ponte. */
  assert.match(CRUSCOTTO, /data-nuova-plancia="\$\{testo\(casa\.casa\)\}"/);
  assert.match(CRUSCOTTO, /\/casa\/\$\{tasto\.dataset\.nuovaPlancia\}\/plance`/);
  assert.match(CRUSCOTTO, /data-annulla-veste="\$\{testo\(una\.profilo\)\}"/);
  /* Una plancia in attesa non aspetta nessuno: la casa la crea da sola, e
   * la pastiglia lo dice cosi' — non «in attesa che la casa la crei», che si
   * leggeva come un permesso da dare. */
  assert.match(CRUSCOTTO, /in arrivo<\/span>/);
  assert.match(CRUSCOTTO, /in casa nessuno deve confermare niente/);
  assert.doesNotMatch(CRUSCOTTO, /in attesa che la casa la crei/);
  assert.match(CRUSCOTTO, new RegExp(`const PLANCE_AL_MASSIMO = ${QUANTE_AL_MASSIMO};`));
  assert.equal(PLANCE_AL_MASSIMO, QUANTE_AL_MASSIMO);

  assert.match(GESTIONE, /<h2>Le plance<\/h2>/);
  assert.match(GESTIONE, /vesti-lette/);
  assert.match(GESTIONE, /in arrivo: la casa la crea da sola/);
  assert.doesNotMatch(
    GESTIONE,
    /data-salva-veste=|data-veste-titolo|data-veste-velo|data-nuova-plancia|data-annulla-veste/,
  );
});

test("una plancia in piu' dal cruscotto: nasce in attesa, la casa la crea, e da li' e' come le altre", async () => {
  const b = await banco();
  try {
    const codice = await b.unCodice();
    await b.deposita(UNA, codice);
    /* La casa e' in linea sul filo: appena la plancia si chiede, la si
     * sveglia perche' passi adesso — e' nella risposta al rapporto che la
     * trova, e un minuto d'attesa si leggeva come «la casa deve
     * confermare». */
    const inLinea = fetch(`${b.dove}/attesa`, {
      headers: { authorization: `Bearer ${codice}`, "x-casa": UNA },
    });
    await new Promise((ok) => setTimeout(ok, 50));
    const fatta = await b.retro(`/casa/${UNA}/plance`, {
      method: "POST",
      body: JSON.stringify({ titolo: "Taverna dei nonni", velo: "Rossi" }),
    });
    assert.equal(fatta.status, 200);
    assert.equal((await fatta.json()).profilo, "taverna-dei-nonni");
    assert.deepEqual(await (await inLinea).json(), { rapporto: true });
    const risposta = await b.deposita(UNA, codice);
    assert.deepEqual(risposta.vesti, {
      "taverna-dei-nonni": { titolo: "Taverna dei nonni", velo: "Rossi", nuova: true },
    });

    /* Un'altra con lo stesso nome prende un profilo suo, e con gli accenti
     * si scrive lo stesso. */
    const seconda = await (
      await b.retro(`/casa/${UNA}/plance`, {
        method: "POST",
        body: JSON.stringify({ titolo: "Taverna dei nonni" }),
      })
    ).json();
    assert.equal(seconda.profilo, "taverna-dei-nonni-2");
    const terza = await (
      await b.retro(`/casa/${UNA}/plance`, {
        method: "POST",
        body: JSON.stringify({ titolo: "Città!" }),
      })
    ).json();
    assert.equal(terza.profilo, "citta");

    /* I nomi di una in attesa si cambiano, e resta in attesa; svuotata
     * tutta, la casa non la crea. */
    await b.vesti(UNA, "taverna-dei-nonni", { titolo: "Taverna", velo: "" });
    await b.vesti(UNA, "taverna-dei-nonni-2", { titolo: "", velo: "" });
    await b.vesti(UNA, "citta", {});
    const dopo = await b.deposita(UNA, codice);
    assert.deepEqual(dopo.vesti, {
      "taverna-dei-nonni": { titolo: "Taverna", velo: "", nuova: true },
    });
    const senza = await b.vesti(UNA, "taverna-dei-nonni", { titolo: "", velo: "Rossi" });
    assert.equal(senza.status, 400);

    /* La casa l'ha creata: dal rapporto in cui compare non e' piu' nuova. */
    const conLaNuova = {
      ...RAPPORTO,
      plance: {
        quante: 3,
        configurate: 1,
        elenco: [...RAPPORTO.plance.elenco, { profilo: "taverna-dei-nonni", titolo: "Taverna" }],
      },
    };
    const creata = await b.deposita(UNA, codice, conLaNuova);
    assert.deepEqual(creata.vesti, { "taverna-dei-nonni": { titolo: "Taverna", velo: "" } });
    const sua = (await (await b.retro("/case")).json()).case.find((casa) => casa.casa === UNA);
    assert.deepEqual(sua.vesti, { "taverna-dei-nonni": { titolo: "Taverna", velo: "" } });

    /* E se in casa la tolgono, le sue vesti se ne vanno: non rinasce. */
    const tolta = await b.deposita(UNA, codice);
    assert.equal("vesti" in tolta, false);
  } finally {
    await b.chiudi();
  }
});

test("di plance se ne tengono otto, contando quelle in attesa; e serve il nome", async () => {
  const b = await banco();
  try {
    const codice = await b.unCodice();
    const sei = {
      ...RAPPORTO,
      plance: {
        quante: 6,
        configurate: 6,
        elenco: ["primary", "a", "b", "c", "d", "e"].map((profilo) => ({
          profilo,
          titolo: profilo,
        })),
      },
    };
    await b.deposita(UNA, codice, sei);
    const aggiungi = (titolo) =>
      b.retro(`/casa/${UNA}/plance`, { method: "POST", body: JSON.stringify({ titolo }) });
    assert.equal((await aggiungi("Sette")).status, 200);
    assert.equal((await aggiungi("Otto")).status, 200);
    const nona = await aggiungi("Nove");
    assert.equal(nona.status, 409);
    assert.match((await nona.json()).errore, /se ne tengono 8/);
    const muta = await aggiungi("   ");
    assert.equal(muta.status, 400);
    assert.match((await muta.json()).errore, /serve il nome/);

    /* Senza l'elenco — l'add-on di ieri — non si aggiunge niente. */
    await b.deposita(ALTRA, await b.unCodice(), RAPPORTO_DI_IERI);
    const ieri = await b.retro(`/casa/${ALTRA}/plance`, {
      method: "POST",
      body: JSON.stringify({ titolo: "X" }),
    });
    assert.equal(ieri.status, 409);
    /* E una casa che non e' sua nemmeno. */
    const altrui = await b.retro(
      `/casa/${UNA}/plance`,
      { method: "POST", body: JSON.stringify({ titolo: "X" }) },
      b.iscritti[1].chiave,
    );
    assert.equal(altrui.status, 404);
  } finally {
    await b.chiudi();
  }
});
