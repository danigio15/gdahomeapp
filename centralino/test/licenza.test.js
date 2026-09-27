/* Il centralino e le licenze: da fuori casa si entra con gdahome Premium.
 *
 * Il contratto sta in `docs/LICENZE.md`. Qui si prova la parte del
 * centralino, con la casa e il telefono veri — WebSocket clienti di Node — e
 * la chiave **di prova** passata a mano: in `chiave-licenze.js` non ci va.
 *
 *   - la casa dice il gettone (`{t|tipo: "licenza", gettone}`, o dentro il
 *     `sono-io`), il centralino lo verifica e se lo ricorda;
 *   - un telefono verso una casa senza gettone buono si chiude con `4402`
 *     `premium-richiesto`; l'abbinamento resta aperto a tutti;
 *   - con la chiave vuota il controllo e' spento: entrano tutti, come ieri.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash, randomBytes } from "node:crypto";

import { Case } from "../src/case.js";
import { Centralino, PREMIUM_RICHIESTO } from "../src/centralino.js";
import { costruisciIlServer } from "../src/server.js";
import { PUBBLICA_DI_PROVA, unGettone } from "../../ponte/test/gettoni-di-prova.js";

const impronta = (cosa) => createHash("sha256").update(cosa).digest("hex");
const unaCasaNuova = () => `casa_${randomBytes(16).toString("hex")}`;
const unSegreto = () => randomBytes(32).toString("hex");

async function attendi(condizione, entro = 3000) {
  const fine = Date.now() + entro;
  while (Date.now() < fine) {
    if (condizione()) return;
    await new Promise((ok) => setTimeout(ok, 10));
  }
  throw new Error("non e' successo in tempo");
}

async function banco({ chiaveLicenze = PUBBLICA_DI_PROVA } = {}) {
  const cartella = mkdtempSync(join(tmpdir(), "centralino-licenza-"));
  const centralino = new Centralino({ case: new Case({ cartella }), chiaveLicenze });
  const server = costruisciIlServer({ centralino });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  return {
    centralino,
    dove: `ws://127.0.0.1:${server.address().port}`,
    spegni: async () => {
      centralino.chiudiTutto();
      await new Promise((ok) => server.close(ok));
      rmSync(cartella, { recursive: true, force: true });
    },
  };
}

function unaCasa(dove, { id = unaCasaNuova(), segreto = unSegreto() } = {}) {
  const presa = new WebSocket(`${dove}/casa`);
  const detti = [];
  presa.addEventListener("message", (evento) => detti.push(JSON.parse(evento.data)));
  const aperta = new Promise((ok) => presa.addEventListener("open", ok));
  return {
    id,
    detti,
    manda: (cosa) => presa.send(JSON.stringify(cosa)),
    canali: () => detti.filter((uno) => uno.t === "apri"),
    chiusi: () => detti.filter((uno) => uno.t === "chiudi"),
    chiudi: () => presa.close(),
    entra: async (altro = {}) => {
      await aperta;
      presa.send(JSON.stringify({ t: "sono-io", casa: id, segreto, ...altro }));
      await attendi(() => detti.some((uno) => uno.t === "bene" || uno.t === "no"));
    },
  };
}

function unTelefono(dove, via) {
  const presa = new WebSocket(`${dove}${via}`);
  const aperta = new Promise((ok) => presa.addEventListener("open", ok));
  const chiusa = new Promise((ok) =>
    presa.addEventListener("close", (evento) => ok({ codice: evento.code, motivo: evento.reason })),
  );
  presa.addEventListener("error", () => {});
  return { presa, aperta, chiusa, chiudi: () => presa.close() };
}

test("una casa senza gettone: il telefono si chiude con 4402 premium-richiesto", async () => {
  const b = await banco();
  try {
    const casa = unaCasa(b.dove);
    await casa.entra();
    const telefono = unTelefono(b.dove, `/telefono/${casa.id}`);
    assert.deepEqual(await telefono.chiusa, {
      codice: PREMIUM_RICHIESTO.codice,
      motivo: PREMIUM_RICHIESTO.motivo,
    });
    assert.deepEqual(PREMIUM_RICHIESTO, { codice: 4402, motivo: "premium-richiesto" });
    /* Alla casa non e' arrivato nessun canale: il telefono non e' entrato. */
    assert.equal(casa.canali().length, 0);
    casa.chiudi();
  } finally {
    await b.spegni();
  }
});

test("il gettone detto dalla casa apre la porta ai suoi telefoni", async () => {
  const b = await banco();
  try {
    const casa = unaCasa(b.dove);
    await casa.entra();
    casa.manda({ t: "licenza", tipo: "licenza", gettone: unGettone({ sog: casa.id }) });
    await attendi(() => b.centralino.ePremium(casa.id));

    const telefono = unTelefono(b.dove, `/telefono/${casa.id}`);
    await telefono.aperta;
    await attendi(() => casa.canali().length === 1);
    assert.equal(casa.canali()[0].via, "telefono");
    telefono.chiudi();
    casa.chiudi();
  } finally {
    await b.spegni();
  }
});

test("il messaggio del contratto, con `tipo` e basta, si capisce lo stesso", async () => {
  const b = await banco();
  try {
    const casa = unaCasa(b.dove);
    await casa.entra();
    casa.manda({ tipo: "licenza", gettone: unGettone({ sog: casa.id }) });
    await attendi(() => b.centralino.ePremium(casa.id));
    casa.chiudi();
  } finally {
    await b.spegni();
  }
});

test("il gettone puo' arrivare anche dentro la presentazione", async () => {
  const b = await banco();
  try {
    const id = unaCasaNuova();
    const casa = unaCasa(b.dove, { id });
    await casa.entra({ gettone: unGettone({ sog: id }) });
    assert.equal(b.centralino.ePremium(id), true);
    casa.chiudi();
  } finally {
    await b.spegni();
  }
});

test("un gettone storto non apre niente: di un'altra casa, scaduto, firmato da altri, gdanav", async () => {
  const b = await banco();
  try {
    const casa = unaCasa(b.dove);
    await casa.entra();
    const storti = [
      unGettone({ sog: unaCasaNuova() }),
      unGettone({ sog: casa.id, fino: Date.now() - 1 }),
      unGettone({ sog: casa.id, scade: Date.now() - 1 }),
      unGettone({ sog: casa.id }, { firmatoDa: "estraneo" }),
      /* gdanav da solo non e' gdahome: da fuori casa non si entra. */
      unGettone({ sog: casa.id, app: "gdanav" }),
      "niente",
    ];
    for (const gettone of storti) {
      casa.manda({ t: "licenza", tipo: "licenza", gettone });
      casa.manda({ t: "battito" });
      await attendi(() => casa.detti.filter((uno) => uno.t === "battito").length > 0);
      casa.detti.length = 0;
      assert.equal(b.centralino.ePremium(casa.id), false);
    }
    casa.chiudi();
  } finally {
    await b.spegni();
  }
});

test("la casa che non e' piu' Premium: escono i telefoni da fuori, non chi si abbina", async () => {
  const b = await banco();
  try {
    const casa = unaCasa(b.dove);
    await casa.entra();
    casa.manda({ t: "licenza", tipo: "licenza", gettone: unGettone({ sog: casa.id }) });
    await attendi(() => b.centralino.ePremium(casa.id));

    const daFuori = unTelefono(b.dove, `/telefono/${casa.id}`);
    await daFuori.aperta;
    const codice = randomBytes(10).toString("hex");
    casa.manda({ t: "apri-abbinamento", impronta: impronta(codice) });
    await attendi(() => b.centralino.abbinamenti.size === 1);
    const siAbbina = unTelefono(b.dove, `/abbinamento/${impronta(codice)}`);
    await siAbbina.aperta;
    await attendi(() => casa.canali().length === 2);

    /* Il quadro non la rinnova piu': la casa lo dice con un gettone vuoto. */
    casa.manda({ t: "licenza", tipo: "licenza", gettone: "" });
    assert.deepEqual(await daFuori.chiusa, { codice: 4402, motivo: "premium-richiesto" });
    assert.equal(b.centralino.ePremium(casa.id), false);
    await attendi(() => casa.chiusi().length === 1);
    /* Quello che si abbina e' ancora li'. */
    assert.equal(siAbbina.presa.readyState, WebSocket.OPEN);
    siAbbina.chiudi();
    casa.chiudi();
  } finally {
    await b.spegni();
  }
});

test("l'abbinamento resta aperto anche a una casa Base", async () => {
  const b = await banco();
  try {
    const casa = unaCasa(b.dove);
    await casa.entra();
    const codice = randomBytes(10).toString("hex");
    casa.manda({ t: "apri-abbinamento", impronta: impronta(codice) });
    await attendi(() => b.centralino.abbinamenti.size === 1);
    const telefono = unTelefono(b.dove, `/abbinamento/${impronta(codice)}`);
    await telefono.aperta;
    await attendi(() => casa.canali().length === 1);
    assert.equal(casa.canali()[0].via, "abbinamento");
    telefono.chiudi();
    casa.chiudi();
  } finally {
    await b.spegni();
  }
});

test("una casa che non c'e' resta «casa non collegata», Premium o no", async () => {
  const b = await banco();
  try {
    const telefono = unTelefono(b.dove, `/telefono/${unaCasaNuova()}`);
    const { codice, motivo } = await telefono.chiusa;
    assert.equal(codice, 1000);
    assert.equal(motivo, "casa non collegata");
  } finally {
    await b.spegni();
  }
});

test("con la chiave vuota il controllo e' spento: entrano tutti, come prima", async () => {
  const b = await banco({ chiaveLicenze: "" });
  try {
    const casa = unaCasa(b.dove);
    await casa.entra();
    /* Un gettone detto a un centralino senza chiave non cambia niente. */
    casa.manda({ t: "licenza", tipo: "licenza", gettone: "" });
    const telefono = unTelefono(b.dove, `/telefono/${casa.id}`);
    await telefono.aperta;
    await attendi(() => casa.canali().length === 1);
    telefono.chiudi();
    casa.chiudi();
  } finally {
    await b.spegni();
  }
});
