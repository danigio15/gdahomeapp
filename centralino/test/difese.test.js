/* Le difese del centralino: chi occupa posti senza parlare, chi manda troppo,
 * chi si fabbrica case a raffica, chi prova a prendere il posto di un altro.
 *
 * Sono tutte regole che, se saltano, non si vedono da nessuna parte: un
 * centralino pieno di fili muti funziona benissimo finche' non arriva l'ultimo
 * telefono vero che non trova posto. Qui si provano una per una, sul
 * centralino acceso davvero quando si puo', e sui pezzi da soli quando basta.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { setImmediate as nuovoGiro } from "node:timers/promises";

import { Case } from "../src/case.js";
import { ArchivioDellaChat, Chat } from "../src/chat.js";
import { Centralino, MESSAGGIO_DEL_TELEFONO } from "../src/centralino.js";
import { Freno } from "../src/freno.js";
import { daChi, eDaDentro } from "../src/indirizzo.js";
import { alzaIlCentralino } from "../src/index.js";
import { Contatti } from "../src/posta.js";
import { costruisciIlServer } from "../src/server.js";
import { Sportello } from "../src/sportello.js";

const impronta = (cosa) => createHash("sha256").update(cosa).digest("hex");
const unaCasaNuova = () => `casa_${randomBytes(16).toString("hex")}`;
const unSegreto = () => randomBytes(32).toString("hex");

async function attendi(condizione, entro = 5000) {
  const fine = Date.now() + entro;
  while (Date.now() < fine) {
    if (condizione()) return;
    await new Promise((ok) => setTimeout(ok, 5));
    await nuovoGiro();
  }
  throw new Error("l'attesa e' scaduta");
}

/* ─── Il banco ───────────────────────────────────────────────────────────── */

async function banco({ centralino: opzioni = {}, case: perLeCase = {}, ...altro } = {}) {
  const cartella = mkdtempSync(join(tmpdir(), "difese-"));
  const case_ = new Case({ cartella, ...perLeCase });
  const centralino = new Centralino({ case: case_, ...opzioni });
  const server = costruisciIlServer({ centralino, ...altro });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const porta = server.address().port;
  return {
    centralino,
    case: case_,
    cartella,
    dove: `ws://127.0.0.1:${porta}`,
    http: `http://127.0.0.1:${porta}`,
    spegni: async () => {
      centralino.chiudiTutto();
      await new Promise((ok) => server.close(ok));
      case_.chiudi();
      rmSync(cartella, { recursive: true, force: true });
    },
  };
}

function unFilo(indirizzo) {
  const presa = new WebSocket(indirizzo);
  const detti = [];
  let chiusura = null;
  presa.addEventListener("message", (evento) => detti.push(evento.data));
  const aperta = new Promise((ok, no) => {
    presa.addEventListener("open", ok);
    presa.addEventListener("error", () => no(new Error("non e' entrato")));
  });
  aperta.catch(() => {});
  const chiusa = new Promise((ok) =>
    presa.addEventListener("close", (evento) => {
      chiusura = { codice: evento.code, perche: evento.reason };
      ok(chiusura);
    }),
  );
  return {
    presa,
    detti,
    aperta,
    chiusa,
    chiusura: () => chiusura,
    manda: (cosa) => presa.send(typeof cosa === "string" ? cosa : JSON.stringify(cosa)),
    chiudi: () => presa.close(),
  };
}

function unaCasa(dove, { id = unaCasaNuova(), segreto = unSegreto() } = {}) {
  const filo = unFilo(`${dove}/casa/${id}`);
  const detti = () => filo.detti.map((uno) => JSON.parse(uno));
  return {
    ...filo,
    id,
    segreto,
    detti,
    canali: () =>
      detti()
        .filter((uno) => uno.t === "apri")
        .map((uno) => uno.c),
    ricevuti: () => detti().filter((uno) => uno.t === "d"),
    entra: async () => {
      await filo.aperta;
      filo.manda({ t: "sono-io", casa: id, segreto });
      await attendi(
        () => detti().some((uno) => uno.t === "bene" || uno.t === "no") || filo.chiusura(),
      );
      return detti().find((uno) => uno.t === "bene" || uno.t === "no") ?? null;
    },
  };
}

/* ─── Chi occupa un posto senza parlare ──────────────────────────────────── */

test("una casa che non si presenta in tempo viene chiusa, e non tocca le altre", async () => {
  const b = await banco({ centralino: { attesaDellaPresentazione: 150 } });
  try {
    const vera = unaCasa(b.dove);
    assert.equal((await vera.entra()).t, "bene");

    /* Una seconda presa sullo stesso identificativo, che bussa e tace: non
     * butta fuori la vera, e dopo il suo tempo se ne va lei. */
    const muta = unaCasa(b.dove, { id: vera.id });
    await muta.aperta;
    const { codice } = await muta.chiusa;
    assert.equal(codice, 1000);
    assert.equal(b.centralino.quanteCase(), 1);
    assert.equal(vera.chiusura(), null, "la casa vera e' ancora collegata");
    vera.chiudi();
  } finally {
    await b.spegni();
  }
});

test("un telefono che non dice niente viene chiuso, e libera il suo posto", async () => {
  const b = await banco({ centralino: { attesaDellaPrimaParola: 150 } });
  try {
    const casa = unaCasa(b.dove);
    await casa.entra();

    const muto = unFilo(`${b.dove}/telefono/${casa.id}`);
    await muto.aperta;
    await attendi(() => casa.canali().length === 1);
    await muto.chiusa;
    await attendi(() => casa.detti().some((uno) => uno.t === "chiudi"));
    assert.equal(b.centralino.quantiTelefoni(), 0);

    /* Uno che parla subito invece resta, anche dopo quel tempo. */
    const parla = unFilo(`${b.dove}/telefono/${casa.id}`);
    await parla.aperta;
    parla.manda("ciao");
    await new Promise((ok) => setTimeout(ok, 300));
    assert.equal(parla.chiusura(), null);
    assert.equal(b.centralino.quantiTelefoni(), 1);
    parla.chiudi();
    casa.chiudi();
  } finally {
    await b.spegni();
  }
});

test("da uno stesso indirizzo non si aprono fili all'infinito", async () => {
  const b = await banco({ centralino: { presePerIndirizzo: 2 } });
  try {
    const uno = unaCasa(b.dove);
    const due = unaCasa(b.dove);
    await Promise.all([uno.aperta, due.aperta]);
    const tre = unFilo(`${b.dove}/casa/${unaCasaNuova()}`);
    await assert.rejects(tre.aperta);
    /* Chiuso uno, il posto torna. */
    uno.chiudi();
    await uno.chiusa;
    await attendi(() => b.centralino.prese === 1);
    const quattro = unFilo(`${b.dove}/casa/${unaCasaNuova()}`);
    await quattro.aperta;
    quattro.chiudi();
    due.chiudi();
  } finally {
    await b.spegni();
  }
});

/* ─── Chi manda troppo ───────────────────────────────────────────────────── */

test("un messaggio troppo grande chiude il telefono, non la casa", async () => {
  const b = await banco();
  try {
    const casa = unaCasa(b.dove);
    await casa.entra();

    const grosso = unFilo(`${b.dove}/telefono/${casa.id}`);
    await grosso.aperta;
    grosso.manda("x".repeat(MESSAGGIO_DEL_TELEFONO + 1));
    assert.equal((await grosso.chiusa).codice, 1009);

    /* Dentro il limite, ma fatto di caratteri che nella busta JSON diventano
     * sei: la busta supererebbe il megabyte del ponte. Si chiude il
     * telefono, e alla casa non arriva niente. */
    const furbo = unFilo(`${b.dove}/telefono/${casa.id}`);
    await furbo.aperta;
    furbo.manda("\u0001".repeat(300 * 1024));
    assert.equal((await furbo.chiusa).codice, 1009);

    assert.equal(casa.chiusura(), null, "la casa e' ancora collegata");
    assert.equal(casa.ricevuti().length, 0);
    assert.equal(b.centralino.quanteCase(), 1);
    casa.chiudi();
  } finally {
    await b.spegni();
  }
});

test("un telefono parla in testo: un telaio binario lo chiude", async () => {
  const b = await banco();
  try {
    const casa = unaCasa(b.dove);
    await casa.entra();
    const telefono = unFilo(`${b.dove}/telefono/${casa.id}`);
    await telefono.aperta;
    telefono.presa.send(new Uint8Array([1, 2, 3]));
    assert.equal((await telefono.chiusa).codice, 1003);
    assert.equal(casa.ricevuti().length, 0);
    assert.equal(casa.chiusura(), null);
    casa.chiudi();
  } finally {
    await b.spegni();
  }
});

test("chi non legge non fa crescere la coda: oltre la soglia il filo si chiude", () => {
  const centralino = new Centralino({ case: {}, codaMassima: 100 });
  try {
    const chiuse = [];
    const mandati = [];
    const presa = {
      socket: { writableLength: 101 },
      manda: (testo) => mandati.push(testo),
      chiudi: (codice, perche) => chiuse.push({ codice, perche }),
    };
    assert.equal(centralino.manda(presa, "ciao"), false);
    assert.equal(mandati.length, 0);
    assert.equal(chiuse.length, 1);

    presa.socket.writableLength = 10;
    centralino.manda(presa, "ciao");
    assert.deepEqual(mandati, ["ciao"]);
  } finally {
    centralino.chiudiTutto();
  }
});

/* ─── Chi si fabbrica case ───────────────────────────────────────────────── */

test("le case nuove hanno un tetto all'ora; quelle che ci sono entrano sempre", async () => {
  const b = await banco({ case: { nuovePerIndirizzo: 2 } });
  try {
    const prima = unaCasa(b.dove);
    const seconda = unaCasa(b.dove);
    assert.equal((await prima.entra()).t, "bene");
    assert.equal((await seconda.entra()).t, "bene");

    /* La terza nuova dallo stesso indirizzo aspetta: non un «no» — il ponte
     * smetterebbe per sempre — ma una chiusura da cui si riprova. */
    const terza = unaCasa(b.dove);
    assert.equal(await terza.entra(), null);
    assert.equal((await terza.chiusa).codice, 1013);
    assert.equal(b.case.quante(), 2);

    /* Una che c'era gia' rientra senza contare. */
    prima.chiudi();
    await prima.chiusa;
    const diNuovo = unaCasa(b.dove, { id: prima.id, segreto: prima.segreto });
    assert.equal((await diNuovo.entra()).t, "bene");
    diNuovo.chiudi();
    seconda.chiudi();
  } finally {
    await b.spegni();
  }
});

test("le case si trovano per nome, e l'elenco non si riscrive a ogni casa nuova", () => {
  const cartella = mkdtempSync(join(tmpdir(), "case-"));
  try {
    const case_ = new Case({ cartella, scritturaAlPiuOgni: 60_000, nuovePerIndirizzo: 100 });
    let scritture = 0;
    const vera = case_.archivio.salva.bind(case_.archivio);
    case_.archivio.salva = () => {
      scritture += 1;
      vera();
    };
    const tante = Array.from({ length: 50 }, () => [unaCasaNuova(), unSegreto()]);
    for (const [id, segreto] of tante) assert.equal(case_.esito(id, segreto), "entra");
    /* La prima subito, le altre insieme al giro dopo. */
    assert.equal(scritture, 1);
    case_.chiudi();
    assert.equal(scritture, 2);

    const riletto = new Case({ cartella });
    assert.equal(riletto.quante(), 50);
    for (const [id, segreto] of tante) assert.equal(riletto.verifica(id, segreto), true);
    assert.equal(riletto.quella(tante[7][0]).id, tante[7][0]);
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});

/* ─── Chi prova a prendere il posto di un altro ──────────────────────────── */

test("un'impronta di abbinamento presa da una casa viva non la riscrive un'altra", async () => {
  const b = await banco();
  try {
    const giusta = unaCasa(b.dove);
    const altra = unaCasa(b.dove);
    await giusta.entra();
    await altra.entra();

    const codice = impronta("WXYZ2345");
    giusta.manda({ t: "apri-abbinamento", impronta: codice });
    await attendi(() => b.centralino.abbinamenti.size === 1);
    altra.manda({ t: "apri-abbinamento", impronta: codice });
    await new Promise((ok) => setTimeout(ok, 50));
    assert.equal(b.centralino.abbinamenti.get(codice).casa, giusta.id);

    const telefono = unFilo(`${b.dove}/abbinamento/${codice}`);
    await telefono.aperta;
    await attendi(() => giusta.canali().length === 1);
    assert.equal(altra.canali().length, 0);
    telefono.chiudi();

    /* Quando la prima se ne va, l'impronta non e' piu' di nessuno. */
    giusta.chiudi();
    await attendi(() => b.centralino.abbinamenti.size === 0);
    altra.manda({ t: "apri-abbinamento", impronta: codice });
    await attendi(() => b.centralino.abbinamenti.get(codice)?.casa === altra.id);
    altra.chiudi();
  } finally {
    await b.spegni();
  }
});

/* ─── Quello che si vede da fuori ────────────────────────────────────────── */

test("/salute da fuori dice solo che e' vivo e da quanto", async () => {
  const b = await banco();
  try {
    const daFuori = await fetch(`${b.http}/salute`, {
      headers: { "x-forwarded-for": "203.0.113.9" },
    });
    assert.deepEqual(Object.keys(await daFuori.json()).sort(), ["acceso_da", "vivo"]);
    /* Da dentro, cioe' senza passare da Caddy, dice tutto. */
    const daDentro = await (await fetch(`${b.http}/salute`)).json();
    assert.equal(daDentro.case, 0);
    assert.equal(daDentro.telefoni, 0);
  } finally {
    await b.spegni();
  }
});

test("ogni risposta dice al browser cosa non fare", async () => {
  const b = await banco();
  try {
    for (const via of ["/", "/salute", "/niente"]) {
      const risposta = await fetch(`${b.http}${via}`);
      assert.equal(risposta.headers.get("x-content-type-options"), "nosniff", via);
      assert.equal(risposta.headers.get("x-frame-options"), "DENY", via);
      assert.equal(risposta.headers.get("referrer-policy"), "no-referrer", via);
      assert.match(risposta.headers.get("content-security-policy"), /frame-ancestors 'none'/, via);
      assert.equal(risposta.headers.get("access-control-allow-credentials"), null, via);
    }
  } finally {
    await b.spegni();
  }
});

test("la console gira solo col suo script: regole per impronta, niente fuori, chiave nella scheda", async () => {
  const archivio = new ArchivioDellaChat(":memory:");
  const chat = new Chat({ archivio, chiaveDellaConsole: "k".repeat(40) });
  const b = await banco({ chat });
  try {
    const risposta = await fetch(`${b.http}/console/`);
    const regole = risposta.headers.get("content-security-policy");
    const pagina = await risposta.text();
    const script = /<script>([\s\S]*?)<\/script>/.exec(pagina)[1];
    const stile = /<style>([\s\S]*?)<\/style>/.exec(pagina)[1];
    const hash = (testo) => createHash("sha256").update(testo, "utf8").digest("base64");
    assert.match(
      regole,
      new RegExp(`script-src 'sha256-${hash(script).replace(/[+/]/g, "\\$&")}'`),
    );
    assert.match(regole, new RegExp(`style-src 'sha256-${hash(stile).replace(/[+/]/g, "\\$&")}'`));
    assert.match(regole, /default-src 'none'/);
    assert.match(regole, /connect-src 'self'/);
    assert.match(regole, /frame-ancestors 'none'/);
    assert.doesNotMatch(regole, /unsafe-inline/);
    /* Le regole per impronta non coprono gli stili scritti dentro gli
     * elementi: la pagina non ne deve avere, se no non si vedrebbero. */
    assert.doesNotMatch(pagina, /\sstyle="/);
    assert.doesNotMatch(pagina, /\son[a-z]+="/);
    /* La chiave nella scheda, non nel browser per sempre. */
    assert.doesNotMatch(pagina, /localStorage/);
    assert.match(pagina, /sessionStorage/);
  } finally {
    await b.spegni();
    archivio.chiudi();
  }
});

test("il centralino ascolta solo su questa macchina, se non gli si dice altro", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "alzato-"));
  const vecchio = process.env.CENTRALINO_REGISTRO;
  process.env.CENTRALINO_REGISTRO = "errore";
  try {
    const acceso = await alzaIlCentralino({ porta: 0, cartella, livello: "errore" });
    try {
      assert.equal(acceso.server.address().address, "127.0.0.1");
    } finally {
      await acceso.abbassa();
    }
  } finally {
    if (vecchio === undefined) delete process.env.CENTRALINO_REGISTRO;
    else process.env.CENTRALINO_REGISTRO = vecchio;
    rmSync(cartella, { recursive: true, force: true });
  }
});

/* ─── Da chi arriva ──────────────────────────────────────────────────────── */

test("l'indirizzo passato si crede solo da questa macchina, per tutte le porte", () => {
  const con = (remoteAddress, headers = {}) => ({ socket: { remoteAddress }, headers });
  assert.equal(daChi(con("127.0.0.1", { "x-forwarded-for": "203.0.113.7" })), "203.0.113.7");
  assert.equal(daChi(con("198.51.100.4", { "x-forwarded-for": "203.0.113.7" })), "198.51.100.4");
  assert.equal(eDaDentro(con("127.0.0.1")), true);
  assert.equal(eDaDentro(con("127.0.0.1", { "x-forwarded-for": "203.0.113.7" })), false);
  assert.equal(eDaDentro(con("198.51.100.4")), false);
});

test("il freno conta per indirizzo e in tutto, e chi e' fermato non allunga l'attesa", () => {
  let ora = 0;
  const freno = new Freno({ perChi: 2, inTutto: 3, adesso: () => ora });
  assert.equal(freno.concedi("a"), true);
  assert.equal(freno.concedi("a"), true);
  assert.equal(freno.concedi("a"), false);
  assert.equal(freno.concedi("b"), true);
  assert.equal(freno.concedi("c"), false, "il tetto in tutto");
  ora += 60 * 60 * 1000;
  assert.equal(freno.concedi("a"), true);
});

/* ─── La console della chat ──────────────────────────────────────────────── */

function unaChat(opzioni = {}) {
  const archivio = new ArchivioDellaChat(":memory:");
  const chat = new Chat({ archivio, chiaveDellaConsole: "c".repeat(40), ...opzioni });
  return { archivio, chat };
}

test("la chiave della console: almeno trentadue caratteri", () => {
  const corta = new Chat({ archivio: null, chiaveDellaConsole: "x".repeat(31) });
  assert.equal(corta.consoleAperta, false);
  const lunga = new Chat({ archivio: null, chiaveDellaConsole: "x".repeat(32) });
  assert.equal(lunga.consoleAperta, true);
});

test("i tentativi sbagliati hanno un tetto anche in tutto, non solo per indirizzo", async () => {
  const { archivio, chat } = unaChat({ sbagliInTutto: 3 });
  const b = await banco({ chat });
  try {
    const prova = (da, chiave = "sbagliata") =>
      fetch(`${b.http}/console/conversazioni`, {
        headers: { authorization: `Bearer ${chiave}`, "x-forwarded-for": da },
      });
    for (const da of ["203.0.113.1", "203.0.113.2", "203.0.113.3"]) {
      assert.equal((await prova(da)).status, 403);
    }
    /* Un indirizzo nuovo, e anche con la chiave giusta: la porta e' chiusa. */
    assert.equal((await prova("203.0.113.4", "c".repeat(40))).status, 429);
  } finally {
    await b.spegni();
    archivio.chiudi();
  }
});

test("una linea col nome di una casa conosciuta nasce solo col suo segreto", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "linee-"));
  const case_ = new Case({ cartella });
  const id = unaCasaNuova();
  const segreto = unSegreto();
  case_.esito(id, segreto);
  const { archivio, chat } = unaChat({ case: case_ });
  const b = await banco({ chat });
  try {
    const scrivi = (chi, conChe) =>
      fetch(`${b.http}/casa/messaggi`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${conChe}`,
          "x-casa": chi,
          "content-type": "application/json",
        },
        body: JSON.stringify({ testo: "ciao" }),
      });
    assert.equal((await scrivi(id, unSegreto())).status, 403);
    assert.equal(archivio.esiste(id), false);
    assert.equal((await scrivi(id, segreto)).status, 200);
    assert.equal(archivio.esiste(id), true);
  } finally {
    await b.spegni();
    archivio.chiudi();
    case_.chiudi();
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("con l'interruttore acceso, nascono solo le linee delle case conosciute", () => {
  const case_ = { quella: () => null, verifica: () => false };
  const { archivio, chat } = unaChat({ case: case_, soloCaseConosciute: true });
  try {
    assert.equal(chat._puoNascere(unaCasaNuova(), unSegreto()), false);
  } finally {
    archivio.chiudi();
  }
  const { archivio: altro, chat: libera } = unaChat({ case: case_ });
  try {
    assert.equal(libera._puoNascere(unaCasaNuova(), unSegreto()), true);
  } finally {
    altro.chiudi();
  }
});

test("da uno stesso indirizzo nascono poche linee nuove", async () => {
  const { archivio, chat } = unaChat({ nuovePerIndirizzo: 2 });
  const b = await banco({ chat });
  try {
    const nuova = (da) =>
      fetch(`${b.http}/casa/messaggi`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${unSegreto()}`,
          "x-casa": unaCasaNuova(),
          "content-type": "application/json",
          "x-forwarded-for": da,
        },
        body: JSON.stringify({ testo: "ciao" }),
      });
    assert.equal((await nuova("203.0.113.5")).status, 200);
    assert.equal((await nuova("203.0.113.5")).status, 200);
    assert.equal((await nuova("203.0.113.5")).status, 429);
    assert.equal((await nuova("203.0.113.6")).status, 200);
  } finally {
    await b.spegni();
    archivio.chiudi();
  }
});

/* ─── Il modulo dei contatti ─────────────────────────────────────────────── */

const unaLettera = {
  nome: "Anna",
  email: "anna@esempio.it",
  messaggio: "Ciao",
  lingua: "it",
};

function postinoFinto() {
  const mandate = [];
  return { pronto: true, mandate, manda: async (lettera) => mandate.push(lettera) };
}

test("il modulo non concede nessuna origine, e accetta solo quella del sito", async () => {
  const postino = postinoFinto();
  const contatti = new Contatti({
    postino,
    da: "assistenza@gdahome.org",
    a: "assistenza@gdahome.org",
    origini: ["https://gdahome.org"],
  });
  const b = await banco({ contatti });
  try {
    const manda = (origine) =>
      fetch(`${b.http}/contatto`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(origine ? { origin: origine } : {}) },
        body: JSON.stringify(unaLettera),
      });
    const daAltrove = await manda("https://altro.esempio");
    assert.equal(daAltrove.status, 403);
    assert.equal(daAltrove.headers.get("access-control-allow-origin"), null);
    assert.equal((await manda(null)).status, 403, "senza origine non e' un browser sul sito");
    const dalSito = await manda("https://gdahome.org");
    assert.equal(dalSito.status, 200);
    assert.equal(dalSito.headers.get("access-control-allow-origin"), null);
    assert.equal(postino.mandate.length, 1);
  } finally {
    await b.spegni();
  }
});

test("il modulo ha un tetto all'ora anche in tutto, da tutti gli indirizzi insieme", async () => {
  const postino = postinoFinto();
  const contatti = new Contatti({
    postino,
    da: "assistenza@gdahome.org",
    a: "assistenza@gdahome.org",
    lettereInTutto: 2,
  });
  const b = await banco({ contatti });
  try {
    const manda = (da) =>
      fetch(`${b.http}/contatto`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": da },
        body: JSON.stringify(unaLettera),
      });
    assert.equal((await manda("203.0.113.1")).status, 200);
    assert.equal((await manda("203.0.113.2")).status, 200);
    assert.equal((await manda("203.0.113.3")).status, 429);
    assert.equal(postino.mandate.length, 2);
  } finally {
    await b.spegni();
  }
});

/* ─── Lo sportello ───────────────────────────────────────────────────────── */

async function unoSportello(opzioni = {}, prendi) {
  const cartella = mkdtempSync(join(tmpdir(), "sportello-"));
  const case_ = new Case({ cartella });
  const id = unaCasaNuova();
  const segreto = unSegreto();
  case_.esito(id, segreto);
  const errori = [];
  const sportello = new Sportello({
    case: case_,
    cartella,
    gettone: "gettone",
    repo: "tizio/cose",
    fetch: prendi,
    registro: { errore: (riga) => errori.push(riga) },
    ...opzioni,
  });
  const b = await banco({ sportello });
  return {
    ...b,
    errori,
    apri: (da = "203.0.113.1") =>
      fetch(`${b.http}/casa/${id}/segnalazioni`, {
        method: "POST",
        headers: {
          authorization: `Casa ${segreto}`,
          "content-type": "application/json",
          "x-forwarded-for": da,
        },
        body: JSON.stringify({ titolo: "t", corpo: "c" }),
      }),
    via: async () => {
      await b.spegni();
      case_.chiudi();
      rmSync(cartella, { recursive: true, force: true });
    },
  };
}

test("un guasto dello sportello non racconta niente a chi bussa: il motivo va nel registro", async () => {
  const s = await unoSportello({}, async () => {
    throw new TypeError("connect ECONNREFUSED 10.1.2.3:443 dentro la macchina");
  });
  try {
    const risposta = await s.apri();
    assert.equal(risposta.status, 500);
    const detto = await risposta.json();
    assert.doesNotMatch(JSON.stringify(detto), /ECONNREFUSED|10\.1\.2\.3/);
    assert.match(s.errori.join("\n"), /ECONNREFUSED/);
  } finally {
    await s.via();
  }
});

test("le scritture verso GitHub hanno un tetto per indirizzo e in tutto", async () => {
  let numero = 1;
  const prendi = async () =>
    new Response(
      JSON.stringify({ number: numero++, html_url: "https://github.esempio/1", created_at: "x" }),
      { status: 201, headers: { "content-type": "application/json" } },
    );
  const s = await unoSportello({ scritturePerIndirizzo: 1, scrittureInTutto: 2 }, prendi);
  try {
    assert.equal((await s.apri("203.0.113.1")).status, 201);
    assert.equal((await s.apri("203.0.113.1")).status, 429, "per indirizzo");
    assert.equal((await s.apri("203.0.113.2")).status, 201);
    assert.equal((await s.apri("203.0.113.3")).status, 429, "in tutto");
  } finally {
    await s.via();
  }
});
