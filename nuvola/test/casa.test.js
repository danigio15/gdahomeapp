/* L'oggetto della casa sulla nuvola, provato con un Cloudflare finto.
 *
 * Il Durable Object vero qui non c'e': c'e' un `state` che fa le poche cose
 * che la casa gli chiede — accettare un filo con le sue targhette, ridarli per
 * targhetta, tenere un archivio e un allarme. I fili sono oggetti che si
 * ricordano cosa hanno ricevuto e come sono stati chiusi. Le vie per cui la
 * casa li riceve (`fetch`, che vuole un 101 che Node non sa fare) si saltano:
 * si chiamano direttamente i pezzi che `fetch` chiamerebbe.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

import { Casa, MESSAGGIO_DEL_TELEFONO, SILENZIO_MASSIMO } from "../src/casa.js";
import { Codice } from "../src/codice.js";
import { Freno } from "../src/freno.js";

const unaCasaNuova = () => `casa_${randomBytes(16).toString("hex")}`;
const unSegreto = () => randomBytes(32).toString("hex");

function archivioFinto() {
  const dentro = new Map();
  let allarme = null;
  const scritture = [];
  return {
    dentro,
    scritture,
    async get(chiave) {
      if (Array.isArray(chiave)) return new Map(chiave.map((una) => [una, dentro.get(una)]));
      return dentro.get(chiave);
    },
    async put(chiave, valore) {
      scritture.push(chiave);
      if (typeof chiave === "object") {
        for (const [una, suo] of Object.entries(chiave)) dentro.set(una, suo);
      } else dentro.set(chiave, valore);
    },
    async delete(chiave) {
      scritture.push(chiave);
      for (const una of [].concat(chiave)) dentro.delete(una);
    },
    async deleteAll() {
      scritture.push("*");
      dentro.clear();
    },
    async list() {
      return new Map(dentro);
    },
    async getAlarm() {
      return allarme;
    },
    async setAlarm(quando) {
      allarme = quando;
    },
    async deleteAlarm() {
      allarme = null;
    },
    allarme: () => allarme,
  };
}

function statoFinto() {
  const prese = [];
  return {
    prese,
    storage: archivioFinto(),
    acceptWebSocket(presa, targhette) {
      presa.targhette = targhette;
      prese.push(presa);
    },
    getWebSockets(targhetta) {
      return prese.filter((una) => una.readyState === 1 && una.targhette.includes(targhetta));
    },
    setWebSocketAutoResponse() {},
  };
}

function unFilo() {
  let allegato = null;
  return {
    readyState: 1,
    mandati: [],
    chiusura: null,
    send(testo) {
      if (this.readyState !== 1) throw new Error("chiusa");
      this.mandati.push(testo);
    },
    close(codice, perche) {
      if (this.chiusura) return;
      this.chiusura = { codice, perche };
      this.readyState = 3;
    },
    accept() {},
    serializeAttachment(cosa) {
      allegato = structuredClone(cosa);
    },
    deserializeAttachment() {
      return allegato;
    },
    detti() {
      return this.mandati.map((uno) => JSON.parse(uno));
    },
  };
}

function unaCasa(env = {}) {
  const state = statoFinto();
  const casa = new Casa(state, env);
  const id = unaCasaNuova();
  const segreto = unSegreto();
  return {
    casa,
    state,
    id,
    segreto,
    async bussa({ da = "198.51.100.1" } = {}) {
      const filo = unFilo();
      await casa._accogliLaCasa(filo, id, da);
      return filo;
    },
    async entra(filo, come = segreto) {
      await casa.webSocketMessage(filo, JSON.stringify({ t: "sono-io", casa: id, segreto: come }));
      return filo;
    },
    async telefono(da = "203.0.113.1", via = "telefono") {
      const filo = unFilo();
      await casa._accogliUnTelefono(filo, da, via);
      return filo;
    },
  };
}

/* Mette indietro l'orologio di un filo: e' come se fosse arrivato prima. */
function invecchia(filo, quanto) {
  const suo = filo.deserializeAttachment();
  filo.serializeAttachment({
    ...suo,
    ...(suo.arrivataIl ? { arrivataIl: suo.arrivataIl - quanto } : {}),
    ...(suo.arrivatoIl ? { arrivatoIl: suo.arrivatoIl - quanto } : {}),
  });
}

/* ─── Chi bussa non butta fuori nessuno ──────────────────────────────────── */

test("chi bussa col nome di una casa non la stacca: prima deve presentarsi", async () => {
  const c = unaCasa();
  const vera = await c.entra(await c.bussa());
  assert.equal(vera.detti().at(-1).t, "bene");
  const telefono = await c.telefono();
  assert.equal(vera.detti().at(-1).t, "apri");

  /* Qualcuno che conosce l'identificativo apre un filo e non si presenta. */
  const intruso = await c.bussa();
  assert.equal(vera.chiusura, null, "la casa vera e' ancora li'");

  /* I telefoni continuano a parlare con la casa vera, non con lui. */
  await c.casa.webSocketMessage(telefono, "ciao");
  assert.equal(vera.detti().at(-1).m, "ciao");
  assert.equal(intruso.mandati.length, 0);

  /* E se si presenta col segreto sbagliato, e' lui che se ne va. */
  await c.entra(intruso, unSegreto());
  assert.equal(intruso.chiusura.codice, 1008);
  assert.equal(vera.chiusura, null);
});

test("chi non si presenta in tempo viene chiuso dall'allarme", async () => {
  const c = unaCasa();
  const muto = await c.bussa();
  assert.ok(c.state.storage.allarme(), "un allarme per quando scade");
  await c.casa.alarm();
  assert.equal(muto.chiusura, null, "non ancora: il suo tempo non e' passato");
  invecchia(muto, 60_000);
  await c.casa.alarm();
  assert.equal(muto.chiusura.codice, 1000);
  /* E non ha lasciato niente nell'archivio. */
  assert.equal(c.state.storage.dentro.size, 0);
});

test("la casa vera che si ripresenta prende il posto di quella di prima", async () => {
  const c = unaCasa();
  const prima = await c.entra(await c.bussa());
  const dopo = await c.entra(await c.bussa());
  assert.equal(dopo.detti().at(-1).t, "bene");
  assert.equal(prima.chiusura.codice, 1000);
  const telefono = await c.telefono();
  await c.casa.webSocketMessage(telefono, "ciao");
  assert.equal(dopo.detti().at(-1).m, "ciao");
  /* La chiusura di quella vecchia non butta giu' i telefoni della nuova. */
  await c.casa.webSocketClose(prima);
  assert.equal(telefono.chiusura, null);
});

test("troppe prese in attesa: se ne va la piu' vecchia", async () => {
  const c = unaCasa();
  const prima = await c.bussa();
  invecchia(prima, 1000);
  const altre = [];
  for (let i = 0; i < 8; i += 1) altre.push(await c.bussa());
  assert.equal(prima.chiusura?.codice, 1000);
  assert.ok(altre.every((una) => una.chiusura === null));
});

/* ─── I telefoni ─────────────────────────────────────────────────────────── */

test("un telefono verso una casa che non c'e' non scrive niente nell'archivio", async () => {
  const c = unaCasa();
  const telefono = await c.telefono();
  assert.equal(telefono.chiusura.perche, "casa non collegata");
  assert.deepEqual(c.state.storage.scritture, []);

  /* Nemmeno se qualcuno bussa come casa senza presentarsi. */
  await c.bussa();
  const altro = await c.telefono();
  assert.equal(altro.chiusura.perche, "casa non collegata");
  assert.deepEqual(c.state.storage.scritture, []);
});

test("un messaggio troppo grande o binario chiude il telefono, non la casa", async () => {
  const c = unaCasa();
  const casa = await c.entra(await c.bussa());

  const grosso = await c.telefono();
  await c.casa.webSocketMessage(grosso, "x".repeat(MESSAGGIO_DEL_TELEFONO + 1));
  assert.equal(grosso.chiusura.codice, 1009);

  const furbo = await c.telefono();
  await c.casa.webSocketMessage(furbo, "\u0001".repeat(300 * 1024));
  assert.equal(furbo.chiusura.codice, 1009);

  const binario = await c.telefono();
  await c.casa.webSocketMessage(binario, new ArrayBuffer(4));
  assert.equal(binario.chiusura.codice, 1003);

  assert.equal(casa.chiusura, null);
  assert.equal(
    casa.detti().filter((uno) => uno.t === "d").length,
    0,
    "alla casa non e' arrivato niente",
  );
});

test("un telefono che non dice niente viene chiuso; uno che parla resta", async () => {
  const c = unaCasa();
  await c.entra(await c.bussa());
  const muto = await c.telefono();
  const parla = await c.telefono();
  await c.casa.webSocketMessage(parla, "ciao");
  invecchia(muto, 60_000);
  invecchia(parla, 60_000);
  await c.casa.alarm();
  assert.equal(muto.chiusura?.perche, "nessuna parola dal telefono");
  assert.equal(parla.chiusura, null);
});

/* ─── Le case nuove, e quelle sparite ───────────────────────────────────── */

test("una casa nuova oltre il conto aspetta: niente «no», e niente scritto", async () => {
  const chieste = [];
  const env = {
    FRENO: {
      idFromName: (nome) => nome,
      get: () => ({
        fetch: async (_via, { body }) => {
          chieste.push(JSON.parse(body));
          return Response.json({ si: false });
        },
      }),
    },
  };
  const c = unaCasa(env);
  const filo = await c.entra(await c.bussa({ da: "198.51.100.7" }));
  assert.equal(filo.chiusura.codice, 1013);
  assert.equal(
    filo.detti().some((uno) => uno.t === "no"),
    false,
  );
  assert.equal(await c.state.storage.get("impronta"), undefined);
  assert.equal(chieste[0].cosa, "casa");
  assert.equal(chieste[0].chi, "198.51.100.7");
});

test("una casa sparita da sei mesi viene dimenticata", async () => {
  const c = unaCasa();
  const filo = await c.entra(await c.bussa());
  assert.ok(await c.state.storage.get("vistaIl"));
  await c.casa.webSocketClose(filo);
  filo.close(1000, "");

  /* Ieri: resta tutto. */
  await c.casa.alarm();
  assert.ok(await c.state.storage.get("impronta"));

  /* Sei mesi e un giorno: se ne va. */
  await c.state.storage.put("vistaIl", Date.now() - SILENZIO_MASSIMO - 86_400_000);
  await c.casa.alarm();
  assert.equal(await c.state.storage.get("impronta"), undefined);
  assert.equal(c.state.storage.allarme(), null);
});

/* ─── L'abbinamento ──────────────────────────────────────────────────────── */

function unCodice() {
  const state = { storage: archivioFinto() };
  const codice = new Codice(state);
  const apri = (casa) =>
    codice.fetch(
      new Request("https://centralino/apri", { method: "POST", body: JSON.stringify({ casa }) }),
    );
  const quale = async () =>
    (await (await codice.fetch(new Request("https://centralino/quale"))).json()).casa;
  return { apri, quale };
}

test("un'impronta presa da una casa non la riscrive un'altra finche' vale", async () => {
  const codice = unCodice();
  const giusta = unaCasaNuova();
  assert.equal((await codice.apri(giusta)).status, 204);
  assert.equal((await codice.apri(unaCasaNuova())).status, 409);
  assert.equal(await codice.quale(), giusta);
  /* La stessa casa invece la rinnova. */
  assert.equal((await codice.apri(giusta)).status, 204);
});

/* ─── Il freno ───────────────────────────────────────────────────────────── */

test("il freno conta per indirizzo e in tutto, e l'ora dopo si ricomincia", async () => {
  const freno = new Freno({ storage: archivioFinto() });
  const chiedi = (chi, adesso = 1_000_000) =>
    freno.concedi({ cosa: "casa", chi, perChi: 2, inTutto: 3, adesso });
  assert.equal(await chiedi("a"), true);
  assert.equal(await chiedi("a"), true);
  assert.equal(await chiedi("a"), false);
  assert.equal(await chiedi("b"), true);
  assert.equal(await chiedi("c"), false);
  assert.equal(await chiedi("a", 1_000_000 + 3_600_001), true);
});

/* ─── Gli errori ─────────────────────────────────────────────────────────── */

test("un guasto delle segnalazioni non racconta niente a chi bussa", async () => {
  const c = unaCasa({ GITHUB_SEGNALAZIONI: "g", GITHUB_REPO: "x/y" });
  await c.entra(await c.bussa());
  const vero = c.state.storage.get.bind(c.state.storage);
  c.state.storage.get = async (chiave) => {
    if (chiave === "segnalazioni") throw new Error("SQLITE_IOERR dentro la macchina");
    return vero(chiave);
  };
  const errore = console.error;
  console.error = () => {};
  try {
    const risposta = await c.casa.fetch(
      new Request(`https://centralino/casa/${c.id}/segnalazioni`, {
        headers: { authorization: `Casa ${c.segreto}` },
      }),
    );
    assert.equal(risposta.status, 500);
    assert.doesNotMatch(await risposta.text(), /SQLITE/);
  } finally {
    console.error = errore;
  }
});

test("la casa sa da quale porta e' entrato il telefono", async () => {
  const c = unaCasa();
  const vera = await c.entra(await c.bussa());
  await c.telefono();
  assert.equal(vera.detti().at(-1).via, "telefono");
  await c.telefono("203.0.113.2", "abbinamento");
  assert.equal(vera.detti().at(-1).via, "abbinamento");
});
