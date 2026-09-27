/* La casa sulla nuvola e le licenze: da fuori si entra con gdahome Premium.
 *
 * Le stesse regole del centralino in Node (`centralino/test/licenza.test.js`),
 * col Cloudflare finto di `casa.test.js`: un `state` che accetta i fili con le
 * loro targhette e tiene un archivio. Il gettone si verifica con
 * `crypto.subtle`, come nel Worker vero, e la chiave e' quella **di prova**
 * del contratto, messa sull'oggetto a mano: in `chiave-licenze.js` non ci va.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

import { Casa, PREMIUM_RICHIESTO } from "../src/casa.js";
import { CHIAVE_PUBBLICA_LICENZE } from "../src/chiave-licenze.js";
import { leggiGettone, verificaGettone } from "../src/gettone.js";
import { GIORNO, PUBBLICA_DI_PROVA, unGettone } from "../../ponte/test/gettoni-di-prova.js";

const unaCasaNuova = () => `casa_${randomBytes(16).toString("hex")}`;
const unSegreto = () => randomBytes(32).toString("hex");

function statoFinto() {
  const prese = [];
  const dentro = new Map();
  const scritture = [];
  return {
    prese,
    storage: {
      dentro,
      scritture,
      async get(chiave) {
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
        dentro.delete(chiave);
      },
      async getAlarm() {
        return null;
      },
      async setAlarm() {},
    },
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

async function unaCasa({ chiave = PUBBLICA_DI_PROVA, gettoneNelSaluto = null } = {}) {
  const state = statoFinto();
  const casa = new Casa(state, {});
  casa.chiaveLicenze = chiave;
  const id = unaCasaNuova();
  const filo = unFilo();
  await casa._accogliLaCasa(filo, id, "198.51.100.1");
  await casa.webSocketMessage(
    filo,
    JSON.stringify({
      t: "sono-io",
      casa: id,
      segreto: unSegreto(),
      ...(gettoneNelSaluto ? { gettone: gettoneNelSaluto(id) } : {}),
    }),
  );
  return {
    casa,
    state,
    id,
    filo,
    dice: (cosa) => casa.webSocketMessage(filo, JSON.stringify(cosa)),
    telefono: async (via = "telefono") => {
      const telefono = unFilo();
      await casa._accogliUnTelefono(telefono, "203.0.113.1", via);
      return telefono;
    },
  };
}

/* ─── Il gettone, con le funzioni del Worker ─────────────────────────────── */

test("nel codice la chiave e' vuota: di serie le licenze sono spente", () => {
  assert.equal(CHIAVE_PUBBLICA_LICENZE, "");
});

test("il gettone si verifica con crypto.subtle e le regole del contratto", async () => {
  const sog = unaCasaNuova();
  const adesso = 1_760_000_000_000;
  const vale = (gettone, altro = {}) =>
    verificaGettone(gettone, { chiave: PUBBLICA_DI_PROVA, sog, adesso, ...altro });
  const buono = unGettone({ sog }, { adesso });

  assert.equal((await vale(buono)).sog, sog);
  assert.ok(await vale(buono, { app: "gdanav" }), "gdahome vale anche per gdanav");
  assert.equal(await vale(unGettone({ sog, app: "gdanav" }, { adesso })), null);
  assert.equal(await vale(buono, { chiave: "" }), null);
  assert.equal(await vale(buono, { sog: unaCasaNuova() }), null);
  assert.equal(await vale(unGettone({ sog, v: 2 }, { adesso })), null);
  assert.equal(await vale(unGettone({ sog, fino: adesso }, { adesso })), null);
  assert.equal(await vale(unGettone({ sog, scade: adesso - 1 }, { adesso })), null);
  assert.ok(await vale(unGettone({ sog, scade: adesso + GIORNO }, { adesso })));
  assert.equal(await vale(unGettone({ sog }, { adesso, firmatoDa: "estraneo" })), null);
  const [primo, firma] = buono.split(".");
  assert.equal(await vale(`${primo}.${firma.slice(0, -4)}AAAA`), null);
  assert.equal(await vale("niente"), null);
  assert.equal(leggiGettone(buono).sog, sog);
});

/* ─── La porta ───────────────────────────────────────────────────────────── */

test("una casa senza gettone: il telefono si chiude con 4402 premium-richiesto", async () => {
  const c = await unaCasa();
  const telefono = await c.telefono();
  assert.deepEqual(telefono.chiusura, { codice: 4402, perche: "premium-richiesto" });
  assert.deepEqual(PREMIUM_RICHIESTO, { codice: 4402, motivo: "premium-richiesto" });
  /* Alla casa non e' arrivato nessun canale, e nessun numero e' stato speso. */
  assert.equal(
    c.filo.detti().some((uno) => uno.t === "apri"),
    false,
  );
  assert.equal(c.state.storage.dentro.has("prossimoCanale"), false);
});

test("il gettone detto dalla casa si scrive nell'archivio e apre la porta", async () => {
  const c = await unaCasa();
  await c.dice({ t: "licenza", tipo: "licenza", gettone: unGettone({ sog: c.id }) });
  assert.equal(typeof c.state.storage.dentro.get("premiumFino"), "number");

  /* Un oggetto nuovo sullo stesso archivio — la casa si e' addormentata e
   * risvegliata — se lo ricorda: non sta a memoria. */
  const risvegliata = new Casa(c.state, {});
  risvegliata.chiaveLicenze = PUBBLICA_DI_PROVA;
  const telefono = unFilo();
  await risvegliata._accogliUnTelefono(telefono, "203.0.113.1", "telefono");
  assert.equal(telefono.chiusura, null);
  assert.equal(c.filo.detti().at(-1).t, "apri");
});

test("il messaggio del contratto con `tipo` e basta, e il gettone nel saluto", async () => {
  const c = await unaCasa();
  await c.dice({ tipo: "licenza", gettone: unGettone({ sog: c.id }) });
  assert.equal((await c.telefono()).chiusura, null);

  const d = await unaCasa({ gettoneNelSaluto: (id) => unGettone({ sog: id }) });
  assert.equal(d.filo.detti().at(-1).t, "bene");
  assert.equal((await d.telefono()).chiusura, null);
});

test("un gettone storto non apre niente", async () => {
  const c = await unaCasa();
  for (const gettone of [
    unGettone({ sog: unaCasaNuova() }),
    unGettone({ sog: c.id, fino: Date.now() - 1 }),
    unGettone({ sog: c.id }, { firmatoDa: "estraneo" }),
    unGettone({ sog: c.id, app: "gdanav" }),
    "",
  ]) {
    await c.dice({ t: "licenza", tipo: "licenza", gettone });
    assert.equal((await c.telefono()).chiusura?.codice, 4402);
  }
});

test("la casa che non e' piu' Premium: escono i telefoni da fuori, non chi si abbina", async () => {
  const c = await unaCasa();
  await c.dice({ t: "licenza", tipo: "licenza", gettone: unGettone({ sog: c.id }) });
  const daFuori = await c.telefono();
  const siAbbina = await c.telefono("abbinamento");
  assert.equal(daFuori.chiusura, null);

  await c.dice({ t: "licenza", tipo: "licenza", gettone: "" });
  assert.deepEqual(daFuori.chiusura, { codice: 4402, perche: "premium-richiesto" });
  assert.equal(siAbbina.chiusura, null);
  assert.equal(c.state.storage.dentro.has("premiumFino"), false);
});

test("l'abbinamento resta aperto a una casa Base", async () => {
  const c = await unaCasa();
  const telefono = await c.telefono("abbinamento");
  assert.equal(telefono.chiusura, null);
  assert.equal(c.filo.detti().at(-1).via, "abbinamento");
});

test("con la chiave vuota il controllo e' spento, e l'archivio non si tocca", async () => {
  const c = await unaCasa({ chiave: "" });
  await c.dice({ t: "licenza", tipo: "licenza", gettone: "qualunque" });
  const telefono = await c.telefono();
  assert.equal(telefono.chiusura, null);
  assert.equal(c.state.storage.scritture.includes("premiumFino"), false);
});
