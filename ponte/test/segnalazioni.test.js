/* Le prove delle segnalazioni dalla parte del ponte: il centralino e' un
 * server HTTP finto, e si guarda cosa gli arriva e cosa torna all'app. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Commissioni } from "../src/commissioni.js";
import {
  ALLEGATO_MASSIMO,
  CentralinoHaDettoNo,
  Segnalazioni,
  SenzaCentralino,
  baseDelCentralino,
} from "../src/segnalazioni.js";

const IDENTITA = { casa: `casa_${"c".repeat(32)}`, segreto: "il-segreto-della-casa" };
const ZITTO = { info() {}, attenzione() {}, errore() {} };

/* Un centralino finto: tiene le issue in memoria e risponde come quello
 * vero, comprese le porte chiuse. */
async function centralinoFinto() {
  const arrivate = [];
  const issue = new Map();
  let prossimo = 7;
  let chat = null;
  const filo = (numero) => {
    const una = issue.get(numero);
    return {
      numero,
      tipo: una.tipo,
      titolo: una.titolo,
      stato: una.stato,
      aperta_il: "2026-09-08T10:00:00Z",
      url: `https://github.com/x/y/issues/${numero}`,
      messaggi: una.messaggi,
    };
  };
  const server = createServer(async (richiesta, risposta) => {
    const pezzi = [];
    for await (const pezzo of richiesta) pezzi.push(pezzo);
    const corpo = Buffer.concat(pezzi);
    const eUnFile = !(richiesta.headers["content-type"] || "").startsWith("application/json");
    const detto = corpo.length && !eUnFile ? JSON.parse(corpo.toString("utf8")) : {};
    arrivate.push({
      metodo: richiesta.method,
      via: richiesta.url,
      autorizzazione: richiesta.headers.authorization,
      detto,
      tipo: richiesta.headers["content-type"],
      nome: richiesta.headers["x-gdahome-nome"],
      byte: eUnFile ? corpo : null,
    });
    const json = (cosa, stato = 200) => {
      risposta.writeHead(stato, { "content-type": "application/json" });
      risposta.end(JSON.stringify(cosa));
    };
    if (richiesta.headers.authorization !== `Casa ${IDENTITA.segreto}`) {
      return json({ errore: "non_ti_riconosco", spiegazione: "non ti riconosco" }, 403);
    }
    const via = richiesta.url.replace(`/casa/${IDENTITA.casa}`, "");
    if (via === "/segnalazioni" && richiesta.method === "GET") {
      return json({
        segnalazioni: [...issue.entries()]
          .filter(([, una]) => una.tipo !== "chat")
          .map(([numero, una]) => ({
            numero,
            tipo: una.tipo,
            titolo: una.titolo,
            stato: una.stato,
          })),
      });
    }
    if (via === "/segnalazioni" && richiesta.method === "POST") {
      if (!detto.titolo)
        return json({ errore: "manca_il_titolo", spiegazione: "Manca il titolo." }, 400);
      const numero = prossimo++;
      issue.set(numero, {
        tipo: detto.tipo,
        titolo: detto.titolo,
        stato: "aperta",
        diagnostica: detto.diagnostica,
        messaggi: [{ da: "casa", testo: detto.corpo, il: "t0" }],
      });
      return json(filo(numero), 201);
    }
    let m;
    if ((m = /^\/segnalazioni\/(\d+)$/.exec(via)) && richiesta.method === "GET") {
      if (!issue.has(Number(m[1])))
        return json({ errore: "non_trovata", spiegazione: "non e' tua" }, 404);
      return json(filo(Number(m[1])));
    }
    if ((m = /^\/segnalazioni\/(\d+)\/risposte$/.exec(via)) && richiesta.method === "POST") {
      issue.get(Number(m[1])).messaggi.push({ da: "casa", testo: detto.testo, il: "t1" });
      return json(filo(Number(m[1])));
    }
    if ((m = /^\/segnalazioni\/(\d+)\/allegati$/.exec(via)) && richiesta.method === "POST") {
      issue.get(Number(m[1])).messaggi.push({
        da: "casa",
        testo: `📷 ${richiesta.headers["x-gdahome-nome"]} (${corpo.length} B)`,
        il: "t4",
      });
      return json(filo(Number(m[1])), 201);
    }
    if (via === "/chat" && richiesta.method === "GET")
      return json({ chat: chat ? filo(chat) : null });
    if (via === "/chat/messaggi" && richiesta.method === "POST") {
      if (!chat) {
        chat = prossimo++;
        issue.set(chat, {
          tipo: "chat",
          titolo: "Chat di assistenza",
          stato: "aperta",
          messaggi: [],
        });
      }
      issue.get(chat).messaggi.push({ da: "casa", testo: detto.testo, il: "t2" });
      return json(filo(chat), 201);
    }
    json({ errore: "non_trovato", spiegazione: "qui non c'e' niente" }, 404);
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  return {
    indirizzo: `ws://127.0.0.1:${server.address().port}`,
    arrivate,
    issue,
    rispondiIlManutentore: (numero, testo) =>
      issue.get(numero).messaggi.push({ da: "manutentore", testo, il: "t3" }),
    spegni: () => new Promise((ok) => server.close(ok)),
  };
}

test("dal wss del centralino si ricava la porta http di fianco", () => {
  assert.equal(
    baseDelCentralino("wss://gdahome-centralino.x.workers.dev"),
    "https://gdahome-centralino.x.workers.dev",
  );
  assert.equal(baseDelCentralino("ws://127.0.0.1:8787/"), "http://127.0.0.1:8787");
  assert.equal(baseDelCentralino(""), "");
  assert.equal(baseDelCentralino(undefined), "");
});

test("una segnalazione va al centralino col segreto della casa, e resta anche qui", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "segnalazioni-"));
  const centralino = await centralinoFinto();
  let ora = 100_000;
  const mie = new Segnalazioni({
    identita: IDENTITA,
    centralino: centralino.indirizzo,
    cartella,
    versione: "0.9.0",
    registro: ZITTO,
    adesso: () => ora,
  });
  assert.equal(mie.spedibili, true);

  const vuoto = await mie.elenco();
  assert.deepEqual(vuoto, { spedibili: true, aggiornato_il: 100_000, segnalazioni: [] });

  const aperta = await mie.crea({
    tipo: "idea",
    titolo: "Una tessera per la piscina",
    corpo: "Sarebbe bello.",
    diagnostica: { app: "10·3693d43", sistema: "android", "Chiave Strana!": "no", vuota: null },
  });
  assert.equal(aperta.numero, 7);
  assert.equal(aperta.stato, "aperta");
  const mandata = centralino.arrivate.find((una) => una.metodo === "POST");
  assert.equal(mandata.via, `/casa/${IDENTITA.casa}/segnalazioni`);
  assert.equal(mandata.autorizzazione, `Casa ${IDENTITA.segreto}`);
  assert.equal(mandata.detto.tipo, "idea");
  /* La diagnostica: quella dell'app ripulita, piu' quella del ponte. */
  assert.equal(mandata.detto.diagnostica.app, "10·3693d43");
  assert.equal(mandata.detto.diagnostica.ponte, "0.9.0");
  assert.match(mandata.detto.diagnostica.node, /^v\d+/);
  assert.equal("Chiave Strana!" in mandata.detto.diagnostica, false);
  assert.equal("vuota" in mandata.detto.diagnostica, false);

  /* Sul disco, e nell'elenco anche senza richiedere. */
  const suDisco = JSON.parse(readFileSync(join(cartella, "segnalazioni.json"), "utf8"));
  assert.equal(suDisco.segnalazioni[0].numero, 7);
  assert.equal(suDisco.fili["7"].messaggi.length, 1);
  const elenco = await mie.elenco();
  assert.equal(elenco.segnalazioni.length, 1);
  assert.equal(elenco.segnalazioni[0].messaggi, 1);

  /* Il manutentore risponde; rileggendo si vede, e si puo' rispondere. */
  centralino.rispondiIlManutentore(7, "Buona idea, la faccio.");
  const riletta = await mie.leggi(7);
  assert.equal(riletta.messaggi.length, 2);
  assert.equal(riletta.messaggi[1].da, "manutentore");
  const risposta = await mie.rispondi(7, "Grazie!");
  assert.equal(risposta.messaggi.length, 3);
  assert.equal((await mie.elenco()).segnalazioni[0].messaggi, 3);

  /* Una che non e' sua. */
  await assert.rejects(
    () => mie.leggi(99),
    (errore) =>
      errore instanceof CentralinoHaDettoNo &&
      errore.codice === "non_trovata" &&
      errore.stato === 404,
  );
  await assert.rejects(
    () => mie.crea({ tipo: "idea", titolo: "", corpo: "x" }),
    (errore) => errore.codice === "manca_il_titolo",
  );

  await centralino.spegni();
  rmSync(cartella, { recursive: true, force: true });
});

test("la chat: niente finche' nessuno scrive, poi un filo solo", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "segnalazioni-"));
  const centralino = await centralinoFinto();
  const mie = new Segnalazioni({
    identita: IDENTITA,
    centralino: centralino.indirizzo,
    cartella,
    registro: ZITTO,
  });
  assert.equal(await mie.chat(), null);
  const prima = await mie.chatta("Buongiorno", { app: "10" });
  assert.equal(prima.tipo, "chat");
  assert.deepEqual(
    prima.messaggi.map((uno) => uno.testo),
    ["Buongiorno"],
  );
  const seconda = await mie.chatta("Ho una domanda");
  assert.equal(seconda.numero, prima.numero);
  assert.equal(seconda.messaggi.length, 2);
  assert.equal((await mie.chat()).messaggi.length, 2);
  /* La chat non sta fra le segnalazioni. */
  assert.deepEqual((await mie.elenco({ aggiorna: true })).segnalazioni, []);
  await centralino.spegni();
  rmSync(cartella, { recursive: true, force: true });
});

test("senza centralino si dice, e non si prova nemmeno", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "segnalazioni-"));
  const mie = new Segnalazioni({ identita: IDENTITA, centralino: "", cartella, registro: ZITTO });
  assert.equal(mie.spedibili, false);
  assert.deepEqual((await mie.elenco()).spedibili, false);
  await assert.rejects(() => mie.crea({ tipo: "idea", titolo: "t", corpo: "c" }), SenzaCentralino);
  await assert.rejects(() => mie.chat(), SenzaCentralino);
  rmSync(cartella, { recursive: true, force: true });
});

test("un centralino che non risponde e' un no parlante, e l'elenco vecchio resta", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "segnalazioni-"));
  const centralino = await centralinoFinto();
  const mie = new Segnalazioni({
    identita: IDENTITA,
    centralino: centralino.indirizzo,
    cartella,
    registro: ZITTO,
  });
  await mie.crea({ tipo: "problema", titolo: "t", corpo: "c" });
  await centralino.spegni();

  const elenco = await mie.elenco({ aggiorna: true });
  assert.equal(elenco.segnalazioni.length, 1, "quello che si sapeva resta");
  await assert.rejects(
    () => mie.leggi(7),
    (errore) =>
      errore instanceof CentralinoHaDettoNo &&
      errore.stato === 0 &&
      /non risponde/.test(errore.message),
  );

  /* Un segreto sbagliato: il centralino lo dice, e il ponte lo riporta. */
  const altro = await centralinoFinto();
  const sbagliato = new Segnalazioni({
    identita: { casa: IDENTITA.casa, segreto: "altro" },
    centralino: altro.indirizzo,
    cartella,
    registro: ZITTO,
  });
  await assert.rejects(
    () => sbagliato.crea({ tipo: "problema", titolo: "t", corpo: "c" }),
    (errore) => errore.codice === "non_ti_riconosco" && errore.stato === 403,
  );
  await altro.spegni();
  rmSync(cartella, { recursive: true, force: true });
});

test("dall'app: i comandi ponte/segnalazioni e ponte/chat, e i loro no", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "segnalazioni-"));
  const centralino = await centralinoFinto();
  const con = new Commissioni({
    casa: { indirizzo: "http://supervisor/core", segno: "s" },
    registro: ZITTO,
    segnalazioni: new Segnalazioni({
      identita: IDENTITA,
      centralino: centralino.indirizzo,
      cartella,
      registro: ZITTO,
    }),
  });
  assert.equal(con.riconosce({ type: "ponte/segnalazioni/elenco" }), true);
  assert.equal(con.riconosce({ type: "ponte/chat/scrivi" }), true);

  const vuoto = await con.rispondi({ id: 1, type: "ponte/segnalazioni/elenco" });
  assert.equal(vuoto.success, true);
  assert.deepEqual(vuoto.result.segnalazioni, []);

  const creata = await con.rispondi({
    id: 2,
    type: "ponte/segnalazioni/crea",
    tipo: "domanda",
    titolo: "Come si fa?",
    corpo: "…",
    diagnostica: { app: "10" },
  });
  assert.equal(creata.success, true);
  assert.equal(creata.result.numero, 7);

  const letta = await con.rispondi({ id: 3, type: "ponte/segnalazioni/leggi", numero: 7 });
  assert.equal(letta.result.titolo, "Come si fa?");
  const risposta = await con.rispondi({
    id: 4,
    type: "ponte/segnalazioni/rispondi",
    numero: 7,
    testo: "Aggiungo…",
  });
  assert.equal(risposta.result.messaggi.length, 2);
  assert.equal(
    (await con.rispondi({ id: 5, type: "ponte/segnalazioni/leggi" })).error.code,
    "invalid_format",
  );
  assert.equal(
    (await con.rispondi({ id: 6, type: "ponte/segnalazioni/leggi", numero: 99 })).error.code,
    "non_trovata",
  );

  assert.deepEqual((await con.rispondi({ id: 7, type: "ponte/chat/leggi" })).result, {
    chat: null,
  });
  const chat = await con.rispondi({
    id: 8,
    type: "ponte/chat/scrivi",
    testo: "Ciao",
    diagnostica: { app: "10" },
  });
  assert.equal(chat.result.tipo, "chat");
  assert.equal(
    (await con.rispondi({ id: 9, type: "ponte/chat/leggi" })).result.chat.messaggi.length,
    1,
  );
  assert.equal(
    (await con.rispondi({ id: 10, type: "ponte/segnalazioni/boh" })).error.code,
    "unknown_command",
  );

  const senza = new Commissioni({ casa: { indirizzo: "x", segno: "s" }, registro: ZITTO });
  assert.equal(
    (await senza.rispondi({ id: 11, type: "ponte/segnalazioni/elenco" })).error.code,
    "unknown_command",
  );
  const senzaCentralino = new Commissioni({
    casa: { indirizzo: "x", segno: "s" },
    registro: ZITTO,
    segnalazioni: new Segnalazioni({
      identita: IDENTITA,
      centralino: "",
      cartella,
      registro: ZITTO,
    }),
  });
  assert.equal(
    (await senzaCentralino.rispondi({ id: 12, type: "ponte/chat/leggi" })).error.code,
    "senza_centralino",
  );

  await centralino.spegni();
  rmSync(cartella, { recursive: true, force: true });
});

test("un allegato va al centralino in binario, col nome e il tipo, e torna nel filo", async () => {
  const centralino = await centralinoFinto();
  const con = new Commissioni({
    casa: { indirizzo: "http://supervisor/core", segno: "s" },
    registro: ZITTO,
    segnalazioni: new Segnalazioni({
      identita: IDENTITA,
      centralino: centralino.indirizzo,
      cartella: mkdtempSync(join(tmpdir(), "segnalazioni-")),
      registro: ZITTO,
    }),
  });
  const creata = await con.rispondi({
    id: 1,
    type: "ponte/segnalazioni/crea",
    tipo: "problema",
    titolo: "La luce",
    corpo: "Non va",
  });
  const numero = creata.result.numero;
  const byte = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5]);

  const conFoto = await con.rispondi({
    id: 2,
    type: "ponte/segnalazioni/allega",
    numero,
    nome: "cucina.jpg",
    tipo: "image/jpeg",
    byte: byte.toString("base64"),
  });
  assert.equal(conFoto.success, true);
  assert.match(conFoto.result.messaggi.at(-1).testo, /^📷 cucina\.jpg \(9 B\)/);

  const arrivato = centralino.arrivate.find((una) => /\/allegati$/.test(una.via));
  assert.equal(arrivato.metodo, "POST");
  assert.equal(arrivato.tipo, "image/jpeg");
  assert.equal(arrivato.nome, "cucina.jpg");
  assert.deepEqual([...arrivato.byte], [...byte]);

  /* Senza file, o con roba che non e' base64: no. */
  const senza = await con.rispondi({
    id: 3,
    type: "ponte/segnalazioni/allega",
    numero,
    byte: "!!!",
  });
  assert.equal(senza.success, false);
  assert.equal(senza.error.code, "invalid_format");
  /* Troppo grande: lo dice il ponte, senza nemmeno chiamare. */
  const prima = centralino.arrivate.length;
  const grosso = await con.rispondi({
    id: 4,
    type: "ponte/segnalazioni/allega",
    numero,
    nome: "film.mp4",
    tipo: "video/mp4",
    byte: Buffer.alloc(ALLEGATO_MASSIMO + 1).toString("base64"),
  });
  assert.equal(grosso.success, false);
  assert.equal(grosso.error.code, "troppo_grande");
  assert.equal(centralino.arrivate.length, prima);
  await centralino.spegni();
});
