/* Le prove della casa di prova: il codice per chi rivede l'app.
 *
 * Tre piani, dal piu' piccolo al piu' grande:
 *
 *   - il codice da solo, e i telefoni «di prova» nell'archivio, con
 *     l'orologio finto: la scadenza dei sette giorni si prova davvero;
 *   - la stretta di mano col portiere, quando i codici vivi sono due e il
 *     telefono non dice quale ha;
 *   - la catena intera, accesa: la console che fa il codice, il centralino
 *     vero che lo instrada, un telefono che entra da fuori, la revoca che lo
 *     butta fuori.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

import { Case } from "../../centralino/src/case.js";
import { Centralino } from "../../centralino/src/centralino.js";
import { costruisciIlServer } from "../../centralino/src/server.js";

import { Abbinamento } from "../src/abbinamento.js";
import {
  CasaDiProva,
  GIORNI_AL_MASSIMO,
  InUso,
  SenzaUtente,
  TELEFONI_DI_PROVA,
} from "../src/casa-di-prova.js";
import { Chiamata } from "../src/chiamata.js";
import {
  aperturaNuova,
  Busta,
  chiaveDiSessione,
  coppiaEffimera,
  VERSIONE,
  VERSIONE_DELL_ABBINAMENTO,
} from "../src/cifra.js";
import { Dispositivi, TroppiDispositivi } from "../src/dispositivi.js";
import { Identita } from "../src/identita.js";
import { Ponte } from "../src/ponte.js";
import { Portiere, PresaCifrata } from "../src/portiere.js";
import { accetta } from "../src/presa.js";
import { Ritorno } from "../src/ritorno.js";
import { impronta } from "../src/segreti.js";
import { costruisciLaConsole } from "../src/server.js";
import { telefonoCifrato } from "./telefono-cifrato.js";

const GIORNO = 24 * 60 * 60 * 1000;

/* Due utenti di Home Assistant: chi amministra, e chi no. */
const CHI_AMMINISTRA = "a".repeat(32);
const REVISIONE = "b".repeat(32);

const giro = () => new Promise((ok) => setImmediate(ok));

function orologio(partenza = 1_700_000_000_000) {
  let ora = partenza;
  return {
    adesso: () => ora,
    avanti: (quanto) => {
      ora += quanto;
    },
  };
}

function cartellaFinta() {
  const dove = mkdtempSync(join(tmpdir(), "prova-"));
  return { dove, via: () => rmSync(dove, { recursive: true, force: true }) };
}

async function attendi(condizione, { entro = 5000 } = {}) {
  const fine = Date.now() + entro;
  while (!condizione()) {
    if (Date.now() > fine) throw new Error("non e' successo in tempo");
    await new Promise((ok) => setTimeout(ok, 10));
  }
}

/* ─── Il codice ──────────────────────────────────────────────────────────── */

test("la casa di prova vuole un utente, e vale al massimo sette giorni", () => {
  const cartella = cartellaFinta();
  try {
    const tempo = orologio();
    const prova = new CasaDiProva({ cartella: cartella.dove, adesso: tempo.adesso });
    assert.throws(() => prova.nuova({}), SenzaUtente);
    assert.throws(() => prova.nuova({ utente: "una frase qualunque" }), SenzaUtente);

    const fatta = prova.nuova({ utente: REVISIONE, giorni: 30 });
    assert.match(fatta.codice, /^[0-9A-Z]{16}$/);
    assert.equal(fatta.utente, REVISIONE);
    assert.equal(fatta.scadeIl - tempo.adesso(), GIORNI_AL_MASSIMO * GIORNO);
  } finally {
    cartella.via();
  }
});

test("i giorni si scelgono da uno a sette, e quelli che non sono un numero valgono sette", () => {
  const cartella = cartellaFinta();
  try {
    const tempo = orologio();
    const prova = new CasaDiProva({ cartella: cartella.dove, adesso: tempo.adesso });
    for (const [detti, attesi] of [
      [1, 1],
      [3, 3],
      ["3", 3],
      [0, 7],
      [-2, 7],
      ["mai", 7],
      [undefined, 7],
    ]) {
      const fatta = prova.nuova({ utente: REVISIONE, giorni: detti });
      assert.equal(fatta.scadeIl - tempo.adesso(), attesi * GIORNO, `con ${detti}`);
      prova.togli();
    }
  } finally {
    cartella.via();
  }
});

test("una alla volta: la seconda si fa dopo aver revocato la prima, o dopo la scadenza", () => {
  const cartella = cartellaFinta();
  try {
    const tempo = orologio();
    const prova = new CasaDiProva({ cartella: cartella.dove, adesso: tempo.adesso });
    const prima = prova.nuova({ utente: REVISIONE, giorni: 1 });
    assert.throws(() => prova.nuova({ utente: REVISIONE }), InUso);

    tempo.avanti(GIORNO);
    assert.equal(prova.viva(), null, "scaduta non vale, anche se e' ancora scritta");
    assert.equal(prova.scaduta(), true);
    const seconda = prova.nuova({ utente: REVISIONE });
    assert.notEqual(seconda.codice, prima.codice);
    assert.equal(prova.scaduta(), false);

    assert.equal(prova.togli(), true);
    assert.equal(prova.viva(), null);
    assert.equal(prova.togli(), false, "togliere due volte non fa niente");
  } finally {
    cartella.via();
  }
});

test("la casa di prova resta dopo un riavvio dell'add-on", () => {
  const cartella = cartellaFinta();
  try {
    const tempo = orologio();
    const prima = new CasaDiProva({ cartella: cartella.dove, adesso: tempo.adesso });
    const fatta = prima.nuova({ utente: REVISIONE, giorni: 3 });
    const dopo = new CasaDiProva({ cartella: cartella.dove, adesso: tempo.adesso });
    assert.deepEqual(dopo.viva(), fatta);
    /* Il file e' quello: il codice e' in chiaro apposta (vedi in cima a
     * `casa-di-prova.js`), e accanto c'e' per chi e' e quando scade. */
    const scritto = JSON.parse(readFileSync(join(cartella.dove, "casa-di-prova.json"), "utf8"));
    assert.equal(scritto.prova.codice, fatta.codice);
  } finally {
    cartella.via();
  }
});

/* ─── I telefoni di prova ────────────────────────────────────────────────── */

test("un telefono di prova scade col suo codice: non entra, non si conta, e lo si sa cifrato", () => {
  const cartella = cartellaFinta();
  try {
    const tempo = orologio();
    const dispositivi = new Dispositivi({ cartella: cartella.dove, adesso: tempo.adesso });
    const diCasa = dispositivi.abbina({ nome: "iPhone di casa", sistema: "ios" });
    const diProva = dispositivi.abbina({
      nome: "iPhone",
      sistema: "ios",
      utente: REVISIONE,
      finoA: tempo.adesso() + GIORNO,
    });

    assert.equal(dispositivi.quanti(), 2);
    assert.equal(dispositivi.quantiDiProva(), 1);
    const riga = dispositivi.elenco().find((uno) => uno.id === diProva.dispositivo.id);
    assert.equal(riga.finoA, tempo.adesso() + GIORNO, "la console scrive fino a quando");
    assert.equal(
      "finoA" in dispositivi.elenco().find((uno) => uno.id === diCasa.dispositivo.id),
      false,
      "un telefono di casa non ha scadenza",
    );
    assert.ok(dispositivi.riconosci(diProva.segno));
    assert.equal(dispositivi.chiaveDi(diProva.dispositivo.id), diProva.chiave);
    /* Il filo lo chiede per la licenza: l'app, li', lascia in vista gli
     * abbonamenti. */
    assert.equal(dispositivi.diProva(diProva.dispositivo.id), true);
    assert.equal(dispositivi.diProva(diCasa.dispositivo.id), false);
    assert.equal(dispositivi.diProva("dm_che_non_c_e"), false);

    tempo.avanti(GIORNO);
    /* Lo spazzino non e' ancora passato, e il telefono e' gia' fuori. */
    assert.equal(dispositivi.riconosci(diProva.segno), null);
    assert.equal(dispositivi.diProva(diProva.dispositivo.id), false);
    assert.equal(dispositivi.chiaveDi(diProva.dispositivo.id), null);
    assert.equal(dispositivi.chiaveRevocataDi(diProva.dispositivo.id), diProva.chiave);
    assert.equal(dispositivi.utenteDi(diProva.dispositivo.id), "");
    assert.equal(dispositivi.quanti(), 1);
    assert.equal(dispositivi.quantiDiProva(), 0);
    assert.deepEqual(
      dispositivi.elenco().map((uno) => uno.nome),
      ["iPhone di casa"],
    );

    /* E quando passa, lo toglie anche dal file, ricordandone la chiave. */
    assert.deepEqual(dispositivi.viaQuelliDiProva(), [diProva.dispositivo.id]);
    assert.deepEqual(dispositivi.viaQuelliDiProva(), []);
    assert.equal(dispositivi.chiaveRevocataDi(diProva.dispositivo.id), diProva.chiave);
    assert.ok(dispositivi.riconosci(diCasa.segno), "quello di casa non e' stato toccato");
  } finally {
    cartella.via();
  }
});

test("revocando escono tutti i telefoni di prova, anche quelli ancora nel loro tempo", () => {
  const cartella = cartellaFinta();
  try {
    const tempo = orologio();
    const dispositivi = new Dispositivi({ cartella: cartella.dove, adesso: tempo.adesso });
    const diCasa = dispositivi.abbina({ nome: "di casa" });
    const uno = dispositivi.abbina({ nome: "uno", finoA: tempo.adesso() + GIORNO });
    const due = dispositivi.abbina({ nome: "due", finoA: tempo.adesso() + GIORNO });

    const usciti = dispositivi.viaQuelliDiProva({ tutti: true });
    assert.deepEqual(usciti.sort(), [uno.dispositivo.id, due.dispositivo.id].sort());
    assert.equal(dispositivi.quanti(), 1);
    assert.ok(dispositivi.riconosci(diCasa.segno));
    assert.equal(dispositivi.chiaveRevocataDi(uno.dispositivo.id), uno.chiave);
  } finally {
    cartella.via();
  }
});

test("un telefono di prova scaduto mentre l'add-on era spento esce all'accensione", () => {
  const cartella = cartellaFinta();
  try {
    const tempo = orologio();
    const prima = new Dispositivi({ cartella: cartella.dove, adesso: tempo.adesso });
    prima.abbina({ nome: "di prova", finoA: tempo.adesso() + GIORNO });
    tempo.avanti(2 * GIORNO);
    const dopo = new Dispositivi({ cartella: cartella.dove, adesso: tempo.adesso });
    assert.equal(dopo.lista.length, 0);
  } finally {
    cartella.via();
  }
});

test("i telefoni di prova scaduti non tengono il posto a quelli di casa", () => {
  const cartella = cartellaFinta();
  try {
    const tempo = orologio();
    const dispositivi = new Dispositivi({
      cartella: cartella.dove,
      massimi: 2,
      adesso: tempo.adesso,
    });
    dispositivi.abbina({ nome: "di casa" });
    dispositivi.abbina({ nome: "di prova", finoA: tempo.adesso() + GIORNO });
    assert.throws(() => dispositivi.abbina({ nome: "terzo" }), TroppiDispositivi);
    tempo.avanti(GIORNO);
    assert.ok(dispositivi.abbina({ nome: "terzo" }));
  } finally {
    cartella.via();
  }
});

/* ─── La stretta di mano, con due codici vivi ────────────────────────────── */

/* Una presa che tiene tutto quello che le si dice: come in `portiere.test.js`. */
function presaFinta() {
  const presa = {
    mandati: [],
    chiusa: null,
    onMessaggio() {},
    onChiusa() {},
    manda(testo) {
      presa.mandati.push(testo);
      return true;
    },
    chiudi(codice, motivo) {
      if (presa.chiusa) return;
      presa.chiusa = { codice, motivo };
      presa.onChiusa();
    },
    arriva(testo) {
      presa.onMessaggio(testo);
    },
    get inChiaro() {
      return presa.mandati.filter((uno) => uno.startsWith("{")).map((uno) => JSON.parse(uno));
    },
  };
  return presa;
}

/* Un telefono fatto a mano che si abbina col codice che ha, e conferma. */
function unTelefonoCheSiAbbina(presa, codice, altro = {}) {
  const mia = coppiaEffimera();
  const apertura = aperturaNuova();
  presa.arriva(
    JSON.stringify({
      v: VERSIONE,
      abbina: VERSIONE_DELL_ABBINAMENTO,
      apertura: apertura.toString("base64"),
      mia: mia.pubblica.toString("base64"),
    }),
  );
  const pronto = presa.inChiaro.find((uno) => uno.pronto);
  if (!pronto) return { pronto: null };
  const busta = new Busta(
    chiaveDiSessione({
      miaPrivata: mia.privata,
      suaPubblica: pronto.mia,
      delTelefono: mia.pubblica,
      dellaCasa: Buffer.from(pronto.mia, "base64"),
      apertura,
      codice,
    }),
    { io: "telefono" },
  );
  presa.arriva(
    busta.chiudi(
      JSON.stringify({
        t: "conferma",
        telefono: mia.pubblica.toString("base64"),
        casa: pronto.mia,
        nome: "iPhone",
        sistema: "ios",
        ...altro,
      }),
    ),
  );
  return {
    pronto,
    lette: () =>
      presa.mandati.filter((uno) => !uno.startsWith("{")).map((uno) => JSON.parse(busta.apri(uno))),
  };
}

function unPortiere({ tempo = orologio() } = {}) {
  const cartella = cartellaFinta();
  const dispositivi = new Dispositivi({ cartella: cartella.dove, adesso: tempo.adesso });
  const abbinamento = new Abbinamento({ adesso: tempo.adesso });
  const casaDiProva = new CasaDiProva({ cartella: cartella.dove, adesso: tempo.adesso });
  const chiusi = [];
  const portiere = new Portiere({
    ponte: { accogli() {} },
    dispositivi,
    abbinamento,
    casaDiProva,
    registro: null,
  });
  portiere.chiamata = { chiudiLAbbinamento: () => chiusi.push("abbinamento") };
  return { portiere, dispositivi, abbinamento, casaDiProva, chiusi, tempo, via: cartella.via };
}

test("col solo codice di prova si entra come l'utente scelto, e il codice resta buono", async () => {
  const c = unPortiere();
  try {
    const { codice } = c.casaDiProva.nuova({ utente: REVISIONE, giorni: 7 });
    for (const nome of ["iPhone", "iPad"]) {
      const presa = presaFinta();
      c.portiere.accogli(presa, { da: "centralino 17.0.0.1" });
      const telefono = unTelefonoCheSiAbbina(presa, codice, { nome });
      await giro();
      const [ecco] = telefono.lette();
      assert.equal(ecco.t, "ecco", nome);
      assert.equal(ecco.dispositivo.utente, REVISIONE);
    }
    assert.equal(c.dispositivi.quantiDiProva(), 2, "lo stesso codice per due telefoni");
    assert.ok(c.casaDiProva.viva(), "il codice di prova non si spende");
    assert.deepEqual(c.chiusi, [], "e l'attesa al centralino resta aperta");
    for (const uno of c.dispositivi.elenco()) {
      assert.equal(uno.finoA, c.casaDiProva.viva().scadeIl, "ogni telefono scade col codice");
    }
  } finally {
    c.via();
  }
});

test("con due codici vivi la casa capisce da sola quale ha in mano il telefono", async () => {
  const c = unPortiere();
  try {
    const diProva = c.casaDiProva.nuova({ utente: REVISIONE });
    const diCasa = c.abbinamento.nuovo(CHI_AMMINISTRA);

    /* Prima quello di prova: il codice di casa resta vivo. */
    const presaProva = presaFinta();
    c.portiere.accogli(presaProva, { da: "192.168.1.30" });
    const iPad = unTelefonoCheSiAbbina(presaProva, diProva.codice, { nome: "iPad" });
    await giro();
    /* Le buste si aprono una volta sola: si leggono e si tengono. */
    const [eccoPerLIPad] = iPad.lette();
    assert.equal(eccoPerLIPad.t, "ecco");
    assert.equal(eccoPerLIPad.dispositivo.utente, REVISIONE);
    assert.notEqual(c.abbinamento.vivo(), null, "il codice di casa non e' stato toccato");

    /* Poi quello di casa: si spende lui, e quello di prova resta. */
    const presaCasa = presaFinta();
    c.portiere.accogli(presaCasa, { da: "192.168.1.31" });
    const diGiovanni = unTelefonoCheSiAbbina(presaCasa, diCasa.codice, { nome: "di casa" });
    await giro();
    const [ecco] = diGiovanni.lette();
    assert.equal(ecco.t, "ecco");
    assert.equal(ecco.dispositivo.utente, CHI_AMMINISTRA);
    assert.equal(c.abbinamento.vivo(), null, "il codice di casa si e' speso");
    assert.deepEqual(c.chiusi, ["abbinamento"]);
    assert.ok(c.casaDiProva.viva(), "quello di prova no");
    const diCasaInElenco = c.dispositivi.elenco().find((uno) => uno.nome === "di casa");
    assert.equal("finoA" in diCasaInElenco, false, "il telefono di casa non scade");
  } finally {
    c.via();
  }
});

test("con due codici vivi, uno sbagliato non apre nessuna delle due porte e si conta", async () => {
  const c = unPortiere();
  try {
    c.casaDiProva.nuova({ utente: REVISIONE });
    c.abbinamento.nuovo();
    const presa = presaFinta();
    c.portiere.accogli(presa, { da: "estraneo" });
    unTelefonoCheSiAbbina(presa, "ZZZZZZZZZZZZZZZZ");
    await giro();
    assert.equal(c.dispositivi.quanti(), 0);
    assert.equal(presa.inChiaro.find((uno) => uno.no)?.motivo, "codice");
    assert.equal(c.abbinamento.stato().tentativiSbagliati, 1);
  } finally {
    c.via();
  }
});

test("una casa di prova revocata fra la stretta di mano e la conferma non fa entrare", async () => {
  const c = unPortiere();
  try {
    const { codice } = c.casaDiProva.nuova({ utente: REVISIONE });
    const presa = presaFinta();
    c.portiere.accogli(presa, { da: "192.168.1.30" });
    /* La stretta di mano a meta': il `pronto` e' partito, la conferma no. */
    const mia = coppiaEffimera();
    const apertura = aperturaNuova();
    presa.arriva(
      JSON.stringify({
        v: VERSIONE,
        abbina: VERSIONE_DELL_ABBINAMENTO,
        apertura: apertura.toString("base64"),
        mia: mia.pubblica.toString("base64"),
      }),
    );
    const pronto = presa.inChiaro.find((uno) => uno.pronto);
    c.casaDiProva.togli();
    const busta = new Busta(
      chiaveDiSessione({
        miaPrivata: mia.privata,
        suaPubblica: pronto.mia,
        delTelefono: mia.pubblica,
        dellaCasa: Buffer.from(pronto.mia, "base64"),
        apertura,
        codice,
      }),
      { io: "telefono" },
    );
    presa.arriva(
      busta.chiudi(
        JSON.stringify({
          t: "conferma",
          telefono: mia.pubblica.toString("base64"),
          casa: pronto.mia,
        }),
      ),
    );
    await giro();
    const [no] = presa.mandati
      .filter((uno) => !uno.startsWith("{"))
      .map((uno) => JSON.parse(busta.apri(uno)));
    assert.equal(no.t, "no");
    assert.equal(no.motivo, "codice");
    assert.equal(c.dispositivi.quanti(), 0);
  } finally {
    c.via();
  }
});

test("col codice di prova entrano al massimo cinque telefoni", async () => {
  const c = unPortiere();
  try {
    const { codice } = c.casaDiProva.nuova({ utente: REVISIONE });
    for (let i = 0; i < TELEFONI_DI_PROVA; i += 1) {
      const presa = presaFinta();
      c.portiere.accogli(presa, { da: `192.168.1.${40 + i}` });
      unTelefonoCheSiAbbina(presa, codice, { nome: `telefono ${i}` });
      await giro();
    }
    assert.equal(c.dispositivi.quantiDiProva(), TELEFONI_DI_PROVA);
    const presa = presaFinta();
    c.portiere.accogli(presa, { da: "192.168.1.60" });
    const sesto = unTelefonoCheSiAbbina(presa, codice);
    await giro();
    const [no] = sesto.lette();
    assert.equal(no.t, "no");
    assert.equal(no.motivo, "telefoni");
    assert.equal(c.dispositivi.quantiDiProva(), TELEFONI_DI_PROVA);
  } finally {
    c.via();
  }
});

test("la presa cifrata prova le altre chiavi solo sulla prima busta", () => {
  const prima = Buffer.alloc(32, 1);
  const seconda = Buffer.alloc(32, 2);
  const presa = presaFinta();
  const cifrata = new PresaCifrata(presa, prima, { altre: [seconda] });
  const arrivati = [];
  cifrata.onMessaggio = (testo) => arrivati.push(testo);

  const telefono = new Busta(seconda, { io: "telefono" });
  presa.arriva(telefono.chiudi("ciao"));
  assert.deepEqual(arrivati, ["ciao"]);
  assert.equal(cifrata.quale, 1, "l'ha aperta la seconda chiave");
  presa.arriva(telefono.chiudi("ancora"));
  assert.deepEqual(arrivati, ["ciao", "ancora"]);
  /* Le risposte partono con la chiave che ha aperto. */
  cifrata.manda("risposta");
  assert.equal(telefono.apri(presa.mandati.at(-1)), "risposta");

  /* Dopo la prima, una busta con l'altra chiave e' guasta e basta. */
  const altro = new Busta(prima, { io: "telefono" });
  altro.ricevo = 0;
  altro.mando = 2;
  presa.arriva(altro.chiudi("da un altro"));
  assert.equal(presa.chiusa?.motivo, "busta guasta");
});

/* ─── La catena intera ───────────────────────────────────────────────────── */

const SEGNO_DELLA_CASA = "segno-finto-del-supervisor";

async function homeAssistantFinta() {
  const prese = [];
  const server = createServer((_r, risposta) => {
    risposta.writeHead(200, { "content-type": "application/json" });
    risposta.end('{"message":"API running."}');
  });
  server.on("upgrade", (richiesta, socket) => {
    const presa = accetta(richiesta, socket, {
      onMessaggio: (testo) => {
        const detto = JSON.parse(testo);
        if (detto.type === "auth") {
          presa.manda(
            JSON.stringify(
              detto.access_token === SEGNO_DELLA_CASA
                ? { type: "auth_ok" }
                : { type: "auth_invalid" },
            ),
          );
          return;
        }
        presa.manda(JSON.stringify({ id: detto.id, type: "result", success: true, result: [] }));
      },
    });
    if (!presa) return;
    prese.push(presa);
    presa.manda(JSON.stringify({ type: "auth_required" }));
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  return {
    indirizzo: `http://127.0.0.1:${server.address().port}`,
    spegni: async () => {
      for (const presa of prese) presa.chiudi();
      await new Promise((ok) => server.close(ok));
    },
  };
}

async function catena({ gestore = true } = {}) {
  const cartelle = [];
  const nuovaCartella = (nome) => {
    const dove = mkdtempSync(join(tmpdir(), `${nome}-`));
    cartelle.push(dove);
    return dove;
  };
  const ha = await homeAssistantFinta();
  const centralino = new Centralino({
    case: new Case({ cartella: nuovaCartella("case") }),
    chiaveLicenze: "",
  });
  const serverDelCentralino = costruisciIlServer({ centralino });
  await new Promise((ok) => serverDelCentralino.listen(0, "127.0.0.1", ok));
  const doveIlCentralino = `ws://127.0.0.1:${serverDelCentralino.address().port}`;

  const { Casa } = await import("../src/casa.js");
  const casa = new Casa({ indirizzo: ha.indirizzo, segno: SEGNO_DELLA_CASA });
  const cartella = nuovaCartella("ponte");
  const dispositivi = new Dispositivi({ cartella });
  const ponte = new Ponte({ casa, dispositivi, registro: null });
  const abbinamento = new Abbinamento({});
  const casaDiProva = new CasaDiProva({ cartella });
  const identita = new Identita({ cartella: nuovaCartella("identita") });
  const ritorno = new Ritorno({
    identita,
    centralino: doveIlCentralino,
    porta: 8098,
    segno: "un-segno",
    fetch: async () => ({ ok: true, json: async () => ({ data: { interfaces: [] } }) }),
  });
  const portiere = new Portiere({
    ponte,
    dispositivi,
    abbinamento,
    casaDiProva,
    registro: null,
    ritorno,
  });
  const chiamata = new Chiamata({ dove: doveIlCentralino, identita, portiere, attesaMassima: 200 });
  portiere.chiamata = chiamata;
  chiamata.avvia();
  await attendi(() => chiamata.dentro);

  /* Chi preme i tasti nella console amministra; «Revisione» no. */
  const utenti = {
    elenco: async () => [
      { id: CHI_AMMINISTRA, nome: "Giovanni", amministratore: true, attivo: true },
      { id: REVISIONE, nome: "Revisione", amministratore: false, attivo: true },
    ],
    amministratore: async (chi) => chi === CHI_AMMINISTRA,
  };
  const console_ = costruisciLaConsole({
    ponte,
    casa,
    dispositivi,
    abbinamento,
    casaDiProva,
    /* La casa di prova si fa solo dall'Home Assistant del gestore: qui lo e',
     * tranne dove la prova dice di no. */
    opzioni: { portaDellApp: 8098, dispositiviMassimi: 10, gestore },
    registro: null,
    chiamata,
    identita,
    ritorno,
    utenti,
    cartellaDellaConsole: fileURLToPath(new URL("../console", import.meta.url)),
    proxyDellIngress: ["127.0.0.1"],
  });
  await new Promise((ok) => console_.listen(0, "127.0.0.1", ok));
  const allaConsole = (via, { method = "GET", corpo } = {}) =>
    fetch(`http://127.0.0.1:${console_.address().port}${via}`, {
      method,
      headers: { "x-remote-user-id": CHI_AMMINISTRA, "content-type": "application/json" },
      ...(corpo ? { body: JSON.stringify(corpo) } : {}),
    });

  return {
    centralino,
    doveIlCentralino,
    dispositivi,
    casaDiProva,
    identita,
    chiamata,
    allaConsole,
    spegni: async () => {
      await new Promise((ok) => console_.close(ok));
      chiamata.spegni();
      ponte.chiudiTutto();
      centralino.chiudiTutto();
      await new Promise((ok) => serverDelCentralino.close(ok));
      await ha.spegni();
      for (const dove of cartelle) rmSync(dove, { recursive: true, force: true });
    },
  };
}

test("la console non fa una casa di prova per chi amministra, ne' per nessuno", async () => {
  const c = await catena();
  try {
    let risposta = await c.allaConsole("/api/prova", {
      method: "POST",
      corpo: { utente: CHI_AMMINISTRA },
    });
    assert.equal(risposta.status, 400);
    assert.match((await risposta.json()).errore, /non amministra/);

    risposta = await c.allaConsole("/api/prova", { method: "POST", corpo: {} });
    assert.equal(risposta.status, 400);

    risposta = await c.allaConsole("/api/prova", {
      method: "POST",
      corpo: { utente: "c".repeat(32) },
    });
    assert.equal(risposta.status, 400, "un utente che in casa non c'e'");
    assert.equal(c.casaDiProva.viva(), null);
  } finally {
    await c.spegni();
  }
});

test("la casa di prova si fa solo dall'Home Assistant del gestore", async () => {
  /* «La casa di prova deve essere solo per me gestore, non per tutti.» Serve
   * a chi pubblica l'app, e quella casa e' una sola: altrove la console non
   * la mostra, e il ponte non la fa nemmeno se qualcuno la chiede a mano. */
  const c = await catena({ gestore: false });
  try {
    const risposta = await c.allaConsole("/api/prova", {
      method: "POST",
      corpo: { utente: REVISIONE, giorni: 3 },
    });
    assert.equal(risposta.status, 403);
    assert.match((await risposta.json()).errore, /gestore/);
    assert.equal(c.casaDiProva.viva(), null);

    /* Lo stato lo dice, con un si' o un no: la console decide da qui se
     * mostrare la scheda. */
    const stato = await (await c.allaConsole("/api/stato")).json();
    assert.equal(stato.gestore, false);
    assert.deepEqual(stato.prova, { attiva: false });

    /* Guardarla e revocarla restano: una casa di prova fatta prima di questa
     * regola si deve poter chiudere da qualunque casa. */
    const { codice, scadeIl } = c.casaDiProva.nuova({ utente: REVISIONE });
    c.chiamata.apriLaProva(impronta(codice), scadeIl);
    const vista = await (await c.allaConsole("/api/prova")).json();
    assert.equal(vista.attiva, true);
    const revocata = await (await c.allaConsole("/api/prova", { method: "DELETE" })).json();
    assert.equal(revocata.revocata, true);
    assert.equal(c.casaDiProva.viva(), null);
  } finally {
    await c.spegni();
  }
});

test("lo stato dice al gestore che e' il gestore, e la chiave non esce", async () => {
  const c = await catena();
  try {
    const stato = await (await c.allaConsole("/api/stato")).json();
    assert.equal(stato.gestore, true);
  } finally {
    await c.spegni();
  }
});

test("dalla console al telefono che entra da fuori, e la revoca che lo butta fuori", async () => {
  const c = await catena();
  try {
    /* La console fa il codice, per «Revisione» e per tre giorni. */
    const fatta = await (
      await c.allaConsole("/api/prova", {
        method: "POST",
        corpo: { utente: REVISIONE, giorni: 3 },
      })
    ).json();
    assert.equal(fatta.attiva, true);
    assert.match(fatta.codice, /^[0-9A-Z]{16}$/);
    assert.equal(fatta.telefoniMassimi, TELEFONI_DI_PROVA);
    assert.equal(
      (await c.allaConsole("/api/prova", { method: "POST", corpo: { utente: REVISIONE } })).status,
      409,
    );

    /* Il centralino ha l'impronta, e la tiene per tre giorni, non sei minuti. */
    await attendi(() => c.centralino.abbinamenti.has(impronta(fatta.codice)));
    const attesa = c.centralino.abbinamenti.get(impronta(fatta.codice));
    assert.equal(attesa.prova, true);
    assert.ok(attesa.scadeIl - Date.now() > 2 * GIORNO);

    /* Il QR, da scaricare: un PNG vero, con dentro l'invito. */
    const png = await c.allaConsole("/api/prova/qr.png");
    assert.equal(png.status, 200);
    assert.equal(png.headers.get("content-type"), "image/png");
    const byte = Buffer.from(await png.arrayBuffer());
    assert.deepEqual([...byte.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const lato = byte.readUInt32BE(16);
    const idat = byte.indexOf("IDAT");
    const righe = inflateSync(byte.subarray(idat + 4, idat + 4 + byte.readUInt32BE(idat - 4)));
    assert.equal(righe.length, (lato + 1) * lato, "una riga per pixel, col suo filtro");

    /* Due telefoni entrano da fuori, col codice battuto a mano. */
    const entrati = [];
    for (const nome of ["iPhone", "iPad"]) {
      const telefono = telefonoCifrato(
        `${c.doveIlCentralino}/abbinamento/${impronta(fatta.codice)}`,
        { codice: fatta.codice },
      );
      await telefono.dentro;
      telefono.conferma({ nome, sistema: "ios" });
      entrati.push(await telefono.aspetta("ecco"));
    }
    assert.equal(c.dispositivi.quantiDiProva(), 2);
    assert.ok(c.centralino.abbinamenti.has(impronta(fatta.codice)), "l'attesa resta aperta");

    /* Uno dei due e' dentro, sul filo vero. */
    const dentro = telefonoCifrato(`${c.doveIlCentralino}/telefono/${c.identita.casa}`, {
      chi: entrati[0].dispositivo.id,
      chiave: entrati[0].chiave,
    });
    await dentro.dentro;
    await dentro.aspetta("auth_required");
    dentro.manda({ type: "auth", access_token: entrati[0].segno });
    await dentro.aspetta("auth_ok");

    /* Lo stato dice quanti, il codice no. */
    const stato = await (await c.allaConsole("/api/stato")).json();
    assert.deepEqual(
      { attiva: stato.prova.attiva, telefoni: stato.prova.telefoni },
      { attiva: true, telefoni: 2 },
    );
    assert.equal(JSON.stringify(stato).includes(fatta.codice), false);

    /* La revoca: il codice smette di valere, i telefoni escono, il filo si
     * chiude, il centralino dimentica l'attesa. */
    const revocata = await (await c.allaConsole("/api/prova", { method: "DELETE" })).json();
    assert.deepEqual(revocata, { revocata: true, telefoni: 2 });
    await dentro.chiusa;
    assert.equal(c.dispositivi.quanti(), 0);
    assert.equal(c.casaDiProva.viva(), null);
    await attendi(() => !c.centralino.abbinamenti.has(impronta(fatta.codice)));
    assert.deepEqual(await (await c.allaConsole("/api/prova")).json(), { attiva: false });
  } finally {
    await c.spegni();
  }
});

test("il centralino che si riavvia si risente dire la casa di prova", async () => {
  const c = await catena();
  try {
    const { codice, scadeIl } = c.casaDiProva.nuova({ utente: REVISIONE });
    c.chiamata.apriLaProva(impronta(codice), scadeIl);
    await attendi(() => c.centralino.abbinamenti.has(impronta(codice)));

    /* Il centralino perde la memoria; la casa ricade e ribussa. */
    c.centralino.abbinamenti.clear();
    c.chiamata.presa.close();
    await attendi(() => c.centralino.abbinamenti.has(impronta(codice)), { entro: 8000 });
    assert.equal(c.centralino.abbinamenti.get(impronta(codice)).prova, true);
  } finally {
    await c.spegni();
  }
});
