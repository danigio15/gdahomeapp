/* La chat, provata dai due sportelli come la usano davvero.
 *
 * Le regole che contano qui sono quelle che, se saltano, saltano in silenzio:
 * una linea che nasce leggendo (e allora l'archivio si riempie di stanze
 * vuote), un secondo che si prende la linea di un altro, una cancellazione che
 * cancella solo dallo schermo, un limite che non conta.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { ArchivioDellaChat, Chat, LIMITI } from "../src/chat.js";
import { costruisciIlServer } from "../src/server.js";

const CASA = `casa_${"0f1e2d3c".repeat(4)}`;
const ALTRA = `casa_${"9a8b7c6d".repeat(4)}`;
const SEGRETO = "5".repeat(64);
const CHIAVE = "chiave-della-console-lunga-abbastanza";

const centralinoFinto = { quanteCase: () => 0, quantiTelefoni: () => 0 };

async function banco({ chiave = CHIAVE } = {}) {
  let orologio = Date.UTC(2026, 0, 1);
  const archivio = new ArchivioDellaChat(":memory:", { adesso: () => orologio });
  const chat = new Chat({ archivio, chiaveDellaConsole: chiave });
  const server = costruisciIlServer({ centralino: centralinoFinto, chat });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const base = `http://127.0.0.1:${server.address().port}`;

  return {
    archivio,
    chat,
    base,
    /* Come bussa il ponte: il segreto in `Bearer`, la casa in `X-Casa`, e le
     * tre note nelle intestazioni. */
    casa(via = "", { casa = CASA, segreto = SEGRETO, metodo = "GET", corpo, note = {} } = {}) {
      return fetch(`${base}/casa/messaggi${via}`, {
        method: metodo,
        headers: {
          ...(segreto ? { authorization: `Bearer ${segreto}` } : {}),
          ...(casa ? { "x-casa": casa } : {}),
          ...(corpo ? { "content-type": "application/json" } : {}),
          ...(note.versione ? { "x-versione": note.versione } : {}),
          ...(note.ha ? { "x-ha": note.ha } : {}),
          ...(note.nome ? { "x-nome": note.nome } : {}),
        },
        body: corpo ? JSON.stringify(corpo) : undefined,
      });
    },
    console(via = "", { chiave: quale = CHIAVE, metodo = "GET", corpo } = {}) {
      return fetch(`${base}/console/conversazioni${via}`, {
        method: metodo,
        headers: {
          ...(quale ? { authorization: `Bearer ${quale}` } : {}),
          ...(corpo ? { "content-type": "application/json" } : {}),
        },
        body: corpo ? JSON.stringify(corpo) : undefined,
      });
    },
    avanti(quanto) {
      orologio += quanto;
    },
    async spegni() {
      await new Promise((ok) => server.close(ok));
      archivio.chiudi();
    },
  };
}

test("una linea nasce scrivendo, non leggendo", async () => {
  const b = await banco();
  try {
    const letta = await b.casa();
    assert.equal(letta.status, 200);
    assert.deepEqual(await letta.json(), { messaggi: [], aperta: false });
    /* La cosa che conta: leggere non l'ha fatta nascere. */
    assert.equal(b.archivio.quanteLinee(), 0);

    const scritta = await b.casa("", {
      metodo: "POST",
      corpo: { testo: "Non mi si vede la temperatura" },
    });
    const detta = await scritta.json();
    assert.equal(detta.nuova, true);
    assert.equal(detta.messaggio.da, "casa");
    assert.equal(b.archivio.quanteLinee(), 1);
  } finally {
    await b.spegni();
  }
});

test("la prima che scrive si prende la linea, e un'altra non ci entra", async () => {
  const b = await banco();
  try {
    await b.casa("", { metodo: "POST", corpo: { testo: "Ciao" } });
    const intrusa = await b.casa("", { segreto: "4".repeat(64) });
    assert.equal(intrusa.status, 403);
    assert.equal((await intrusa.json()).errore, "segreto sbagliato");
  } finally {
    await b.spegni();
  }
});

test("senza segreto e senza linea valida non si passa", async () => {
  const b = await banco();
  try {
    assert.equal((await b.casa("", { segreto: "" })).status, 401);
    assert.equal((await b.casa("", { segreto: "corto" })).status, 401);
    assert.equal((await b.casa("", { casa: "pippo" })).status, 400);
  } finally {
    await b.spegni();
  }
});

test("la casa rilegge solo quello che non aveva, col «dopo»", async () => {
  const b = await banco();
  try {
    await b.casa("", { metodo: "POST", corpo: { testo: "Primo" } });
    await b.casa("", { metodo: "POST", corpo: { testo: "Secondo" } });
    const tutti = await (await b.casa()).json();
    assert.deepEqual(
      tutti.messaggi.map((uno) => uno.testo),
      ["Primo", "Secondo"],
    );
    const dopo = await (await b.casa(`?dopo=${tutti.messaggi[0].id}`)).json();
    assert.deepEqual(
      dopo.messaggi.map((uno) => uno.testo),
      ["Secondo"],
    );
  } finally {
    await b.spegni();
  }
});

test("la console senza la chiave non vede niente", async () => {
  const b = await banco();
  try {
    assert.equal((await b.console("", { chiave: "" })).status, 403);
    assert.equal((await b.console("", { chiave: "sbagliata" })).status, 403);
  } finally {
    await b.spegni();
  }
});

test("senza chiave configurata la console resta chiusa a tutti", async () => {
  const b = await banco({ chiave: "" });
  try {
    assert.equal(b.chat.consoleAperta, false);
    assert.equal((await b.console("", { chiave: "" })).status, 403);
    /* Ma le case scrivono lo stesso: meglio ricevere e non poter leggere che
     * perdere quello che qualcuno ha scritto. */
    const scritta = await b.casa("", { metodo: "POST", corpo: { testo: "Aiuto" } });
    assert.equal(scritta.status, 200);
  } finally {
    await b.spegni();
  }
});

test("la console vede l'elenco, risponde, e la casa lo legge", async () => {
  const b = await banco();
  try {
    await b.casa("", {
      metodo: "POST",
      corpo: { testo: "La luce non si spegne" },
      note: { versione: "plancia 1.4.19 ponte 0.18.0", ha: "2026.1.0", nome: "Giovanni" },
    });

    const elenco = await (await b.console()).json();
    assert.equal(elenco.conversazioni.length, 1);
    const riga = elenco.conversazioni[0];
    assert.equal(riga.id, CASA);
    assert.equal(riga.nome, "Giovanni");
    assert.equal(riga.versione, "plancia 1.4.19 ponte 0.18.0");
    assert.equal(riga.ultimo, "La luce non si spegne");
    assert.equal(riga.non_letti, 1);

    const risposta = await b.console(`/${CASA}`, {
      metodo: "POST",
      corpo: { testo: "Hai provato a riavviare l'add-on?" },
    });
    assert.equal(risposta.status, 200);
    assert.equal((await risposta.json()).messaggio.da, "console");

    /* La casa la trova. */
    const letti = await (await b.casa()).json();
    assert.deepEqual(
      letti.messaggi.map((uno) => uno.da),
      ["casa", "console"],
    );

    /* E la console, avendo letto, non ha piu' non letti. */
    await b.console(`/${CASA}`);
    const dinuovo = await (await b.console()).json();
    assert.equal(dinuovo.conversazioni[0].non_letti, 0);
  } finally {
    await b.spegni();
  }
});

test("la console non risponde a una linea che non esiste", async () => {
  const b = await banco();
  try {
    const risposta = await b.console(`/${ALTRA}`, { metodo: "POST", corpo: { testo: "Ehi" } });
    assert.equal(risposta.status, 404);
  } finally {
    await b.spegni();
  }
});

test("cancellare cancella per tutti e due", async () => {
  const b = await banco();
  try {
    await b.casa("", { metodo: "POST", corpo: { testo: "Cosa" } });
    assert.equal((await (await b.casa("", { metodo: "DELETE" })).json()).cancellata, true);
    assert.equal(b.archivio.quanteLinee(), 0);
    /* E la console non la vede piu'. */
    assert.deepEqual((await (await b.console()).json()).conversazioni, []);

    /* La console puo' cancellare la sua, e su una che non c'e' dice si'
     * comunque: chi cancella vuole che non ci sia. */
    await b.casa("", { metodo: "POST", corpo: { testo: "Di nuovo" } });
    assert.equal(
      (await (await b.console(`/${CASA}`, { metodo: "DELETE" })).json()).cancellata,
      true,
    );
    assert.equal(
      (await (await b.console(`/${ALTRA}`, { metodo: "DELETE" })).json()).cancellata,
      true,
    );
  } finally {
    await b.spegni();
  }
});

test("dopo una cancellazione la linea rinasce, e lo dice", async () => {
  const b = await banco();
  try {
    await b.casa("", { metodo: "POST", corpo: { testo: "Prima" } });
    await b.console(`/${CASA}`, { metodo: "DELETE" });
    const rinata = await (await b.casa("", { metodo: "POST", corpo: { testo: "Dopo" } })).json();
    /* `nuova` e' quello che dice alla casa di buttare la sua copia: quella
     * parla di un filo che non esiste piu'. */
    assert.equal(rinata.nuova, true);
  } finally {
    await b.spegni();
  }
});

test("venti messaggi in un'ora, e il ventunesimo aspetta", async () => {
  const b = await banco();
  try {
    for (let i = 0; i < LIMITI.alOra; i += 1) {
      const risposta = await b.casa("", { metodo: "POST", corpo: { testo: `numero ${i}` } });
      assert.equal(risposta.status, 200, `il messaggio ${i} doveva passare`);
    }
    const troppo = await b.casa("", { metodo: "POST", corpo: { testo: "e questo no" } });
    assert.equal(troppo.status, 429);
    assert.equal((await troppo.json()).errore, "troppi messaggi in un'ora");

    /* Un'ora dopo si riparte. */
    b.avanti(61 * 60 * 1000);
    assert.equal((await b.casa("", { metodo: "POST", corpo: { testo: "ora si" } })).status, 200);
  } finally {
    await b.spegni();
  }
});

test("un messaggio vuoto non e' un messaggio", async () => {
  const b = await banco();
  try {
    assert.equal((await b.casa("", { metodo: "POST", corpo: { testo: "   " } })).status, 400);
    assert.equal(b.archivio.quanteLinee(), 0);
  } finally {
    await b.spegni();
  }
});

test("il nome lasciato vuoto non cancella quello di ieri", async () => {
  const b = await banco();
  try {
    await b.casa("", { metodo: "POST", corpo: { testo: "Uno" }, note: { nome: "Giovanni" } });
    await b.casa("", { metodo: "POST", corpo: { testo: "Due" } });
    const elenco = await (await b.console()).json();
    assert.equal(elenco.conversazioni[0].nome, "Giovanni");
  } finally {
    await b.spegni();
  }
});

test("la storia si accorcia da sola", async () => {
  const archivio = new ArchivioDellaChat(":memory:");
  try {
    archivio.apriLaLinea(CASA, SEGRETO, { nome: "", versione: "", ha: "", lingua: "" });
    for (let i = 0; i < LIMITI.storia + 12; i += 1) archivio.scrivi(CASA, "casa", `riga ${i}`);
    const tutti = archivio.db
      .prepare("SELECT COUNT(*) AS q FROM messaggi WHERE linea = ?")
      .get(CASA);
    assert.equal(Number(tutti.q), LIMITI.storia);
  } finally {
    archivio.chiudi();
  }
});

test("una linea ferma da sei mesi se ne va, conversazione compresa", async () => {
  let orologio = Date.UTC(2026, 0, 1);
  const archivio = new ArchivioDellaChat(":memory:", { adesso: () => orologio });
  try {
    archivio.apriLaLinea(CASA, SEGRETO, { nome: "", versione: "", ha: "", lingua: "" });
    archivio.scrivi(CASA, "casa", "qualcosa");
    assert.equal(archivio.potatura(), 0);

    orologio += LIMITI.silenzio + 1000;
    assert.equal(archivio.potatura(), 1);
    assert.equal(archivio.quanteLinee(), 0);
    const restano = archivio.db.prepare("SELECT COUNT(*) AS q FROM messaggi").get();
    assert.equal(Number(restano.q), 0);
  } finally {
    archivio.chiudi();
  }
});

test("la pagina della console si apre, e non chiede la chiave per aprirsi", async () => {
  const b = await banco();
  try {
    /* La chiave serve alle vie di sotto, non alla pagina: se servisse anche
     * per la pagina non ci sarebbe nessun posto in cui batterla. */
    const risposta = await fetch(`${b.base}/console/`);
    assert.equal(risposta.status, 200);
    assert.match(risposta.headers.get("content-type"), /text\/html/);
    const pagina = await risposta.text();
    assert.match(pagina, /Assistenza gdahome/);
    /* E non si porta niente da fuori: nessuna richiesta a nessun altro. */
    assert.doesNotMatch(pagina, /https?:\/\/(?!127\.0\.0\.1)/);
  } finally {
    await b.spegni();
  }
});
