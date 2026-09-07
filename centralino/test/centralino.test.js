/* Le prove del centralino.
 *
 * Il centralino e' acceso davvero, su una porta effimera. La casa e il
 * telefono sono WebSocket clienti veri di Node — quelli che useranno il ponte
 * e l'app — quindi quello che si prova qui e' il protocollo, non una sua
 * imitazione.
 *
 * La cosa che si sta provando piu' di tutte: che **la casa non apra niente**.
 * In nessuna di queste prove qualcuno si mette in ascolto dalla parte della
 * casa. La casa chiama, e basta.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash, randomBytes } from "node:crypto";

import { Case } from "../src/case.js";
import { Centralino } from "../src/centralino.js";
import { costruisciIlServer } from "../src/server.js";

const impronta = (cosa) => createHash("sha256").update(cosa).digest("hex");
const unaCasaNuova = () => `casa_${randomBytes(16).toString("hex")}`;
const unSegreto = () => randomBytes(32).toString("hex");

/* ─── Il banco ───────────────────────────────────────────────────────────── */

async function banco({ giorniDiSilenzio = 180 } = {}) {
  const cartella = mkdtempSync(join(tmpdir(), "centralino-"));
  const case_ = new Case({ cartella, giorniDiSilenzio });
  const centralino = new Centralino({ case: case_ });
  const server = costruisciIlServer({ centralino });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const dove = `ws://127.0.0.1:${server.address().port}`;

  return {
    centralino,
    case: case_,
    cartella,
    dove,
    http: `http://127.0.0.1:${server.address().port}`,
    spegni: async () => {
      centralino.chiudiTutto();
      await new Promise((ok) => server.close(ok));
      rmSync(cartella, { recursive: true, force: true });
    },
  };
}

/* Una casa: chiama fuori, si presenta, e parla per canali. */
function unaCasa(dove, { id = unaCasaNuova(), segreto = unSegreto() } = {}) {
  const presa = new WebSocket(`${dove}/casa`);
  const detti = [];
  presa.addEventListener("message", (evento) => detti.push(JSON.parse(evento.data)));
  const aperta = new Promise((ok, no) => {
    presa.addEventListener("open", ok);
    presa.addEventListener("error", () => no(new Error("la casa non e' entrata")));
  });
  const chiusa = new Promise((ok) => presa.addEventListener("close", ok));

  const casa = {
    id,
    segreto,
    presa,
    detti,
    aperta,
    chiusa,
    manda: (cosa) => presa.send(JSON.stringify(cosa)),
    canali: () => detti.filter((uno) => uno.t === "apri").map((uno) => uno.c),
    ricevuti: () => detti.filter((uno) => uno.t === "d"),
    chiudi: () => presa.close(),
    entra: async () => {
      await casa.aperta;
      casa.manda({ t: "sono-io", casa: id, segreto });
      await attendi(() => detti.some((uno) => uno.t === "bene" || uno.t === "no"));
      return detti.find((uno) => uno.t === "bene" || uno.t === "no");
    },
  };
  return casa;
}

/* Un telefono: si collega e parla in chiaro — quello che manda arriva alla
 * casa cosi' com'e'. */
function unTelefono(dove, via) {
  const presa = new WebSocket(`${dove}${via}`);
  const detti = [];
  presa.addEventListener("message", (evento) => detti.push(evento.data));
  const aperta = new Promise((ok, no) => {
    presa.addEventListener("open", ok);
    presa.addEventListener("error", () => no(new Error("il telefono non e' entrato")));
  });
  const chiusa = new Promise((ok) => presa.addEventListener("close", ok));
  return {
    presa,
    detti,
    aperta,
    chiusa,
    manda: (testo) => presa.send(testo),
    chiudi: () => presa.close(),
  };
}

/* ─── Le prove ───────────────────────────────────────────────────────────── */

test("il centralino dice di essere vivo", async () => {
  const b = await banco();
  try {
    const detto = await (await fetch(`${b.http}/salute`)).json();
    assert.equal(detto.vivo, true);
    assert.equal(detto.case, 0);
  } finally {
    await b.spegni();
  }
});

test("una casa si presenta, e da quel momento e' collegata", async () => {
  const b = await banco();
  try {
    const casa = unaCasa(b.dove);
    assert.equal((await casa.entra()).t, "bene");
    assert.equal(b.centralino.quanteCase(), 1);
    assert.equal(b.case.quante(), 1);
    casa.chiudi();
  } finally {
    await b.spegni();
  }
});

test("il segreto della casa non finisce sul disco in chiaro", async () => {
  const b = await banco();
  try {
    const casa = unaCasa(b.dove);
    await casa.entra();
    const { readFileSync } = await import("node:fs");
    const scritto = readFileSync(join(b.cartella, "case.json"), "utf8");
    assert.equal(scritto.includes(casa.segreto), false);
    assert.equal(scritto.includes(impronta(casa.segreto)), true);
    casa.chiudi();
  } finally {
    await b.spegni();
  }
});

test("chi si ripresenta con lo stesso identificativo e un altro segreto resta fuori", async () => {
  const b = await banco();
  try {
    const vera = unaCasa(b.dove);
    await vera.entra();

    const finta = unaCasa(b.dove, { id: vera.id, segreto: unSegreto() });
    assert.equal((await finta.entra()).t, "no");
    await finta.chiusa;

    /* E la vera e' ancora dentro: nessuno l'ha buttata fuori. */
    assert.equal(b.centralino.quanteCase(), 1);
    vera.chiudi();
  } finally {
    await b.spegni();
  }
});

test("la stessa casa che si ricollega prende il posto del proprio fantasma", async () => {
  const b = await banco();
  try {
    const prima = unaCasa(b.dove);
    await prima.entra();

    /* Stesso identificativo, stesso segreto: e' lei, tornata dopo che il
     * router si e' riavviato e il filo di prima e' rimasto aperto e muto. */
    const dopo = unaCasa(b.dove, { id: prima.id, segreto: prima.segreto });
    assert.equal((await dopo.entra()).t, "bene");

    await prima.chiusa;
    assert.equal(b.centralino.quanteCase(), 1);
    dopo.chiudi();
  } finally {
    await b.spegni();
  }
});

test("un telefono arriva alla sua casa, e i byte passano nei due sensi", async () => {
  const b = await banco();
  try {
    const casa = unaCasa(b.dove);
    await casa.entra();

    const telefono = unTelefono(b.dove, `/telefono/${casa.id}`);
    await telefono.aperta;
    await attendi(() => casa.canali().length === 1);
    const canale = casa.canali()[0];

    telefono.manda('{"type":"auth","access_token":"il-mio-segno"}');
    await attendi(() => casa.ricevuti().length === 1);
    assert.equal(casa.ricevuti()[0].c, canale);
    assert.equal(casa.ricevuti()[0].m, '{"type":"auth","access_token":"il-mio-segno"}');

    casa.manda({ c: canale, t: "d", m: '{"type":"auth_ok"}' });
    await attendi(() => telefono.detti.length === 1);
    assert.equal(telefono.detti[0], '{"type":"auth_ok"}');

    telefono.chiudi();
    casa.chiudi();
  } finally {
    await b.spegni();
  }
});

test("due telefoni sulla stessa casa non si mescolano", async () => {
  const b = await banco();
  try {
    const casa = unaCasa(b.dove);
    await casa.entra();

    const uno = unTelefono(b.dove, `/telefono/${casa.id}`);
    const due = unTelefono(b.dove, `/telefono/${casa.id}`);
    await Promise.all([uno.aperta, due.aperta]);
    await attendi(() => casa.canali().length === 2);
    const [canaleUno, canaleDue] = casa.canali();
    assert.notEqual(canaleUno, canaleDue);

    uno.manda("sono il primo");
    due.manda("sono il secondo");
    await attendi(() => casa.ricevuti().length === 2);

    const perCanale = new Map(casa.ricevuti().map((uno) => [uno.c, uno.m]));
    assert.equal(perCanale.get(canaleUno), "sono il primo");
    assert.equal(perCanale.get(canaleDue), "sono il secondo");

    casa.manda({ c: canaleUno, t: "d", m: "risposta al primo" });
    await attendi(() => uno.detti.length === 1);
    assert.deepEqual(uno.detti, ["risposta al primo"]);
    assert.deepEqual(due.detti, [], "il secondo non ha visto niente");

    uno.chiudi();
    due.chiudi();
    casa.chiudi();
  } finally {
    await b.spegni();
  }
});

test("un telefono verso una casa che non e' collegata viene chiuso subito", async () => {
  const b = await banco();
  try {
    const telefono = unTelefono(b.dove, `/telefono/${unaCasaNuova()}`);
    await telefono.aperta.catch(() => {});
    await telefono.chiusa;
    assert.deepEqual(telefono.detti, []);
  } finally {
    await b.spegni();
  }
});

test("quando la casa se ne va, i suoi telefoni se ne accorgono subito", async () => {
  const b = await banco();
  try {
    const casa = unaCasa(b.dove);
    await casa.entra();
    const telefono = unTelefono(b.dove, `/telefono/${casa.id}`);
    await telefono.aperta;
    await attendi(() => casa.canali().length === 1);

    casa.chiudi();

    await telefono.chiusa;
    await attendi(() => b.centralino.quanteCase() === 0);
    assert.equal(b.centralino.quantiTelefoni(), 0);
  } finally {
    await b.spegni();
  }
});

test("quando il telefono se ne va, la casa lo viene a sapere", async () => {
  const b = await banco();
  try {
    const casa = unaCasa(b.dove);
    await casa.entra();
    const telefono = unTelefono(b.dove, `/telefono/${casa.id}`);
    await telefono.aperta;
    await attendi(() => casa.canali().length === 1);
    const canale = casa.canali()[0];

    telefono.chiudi();

    await attendi(() => casa.detti.some((uno) => uno.t === "chiudi" && uno.c === canale));
    assert.equal(b.centralino.quantiTelefoni(), 0);
    casa.chiudi();
  } finally {
    await b.spegni();
  }
});

/* ─── L'abbinamento ──────────────────────────────────────────────────────── */

test("il telefono che si abbina arriva alla casa giusta, e il codice qui non passa mai", async () => {
  const b = await banco();
  try {
    const casa = unaCasa(b.dove);
    await casa.entra();

    const codice = "ABCD2345";
    casa.manda({ t: "apri-abbinamento", impronta: impronta(codice) });
    await attendi(() => b.centralino.abbinamenti.size === 1);

    /* Il telefono conosce il codice; il centralino ne vede solo l'impronta. */
    const telefono = unTelefono(b.dove, `/abbinamento/${impronta(codice)}`);
    await telefono.aperta;
    await attendi(() => casa.canali().length === 1);

    telefono.manda(JSON.stringify({ t: "abbinami", codice }));
    await attendi(() => casa.ricevuti().length === 1);
    /* Il codice arriva **alla casa**, che e' l'unica che lo puo' verificare. */
    assert.equal(JSON.parse(casa.ricevuti()[0].m).codice, codice);

    /* E il centralino non lo ha mai avuto in mano. */
    assert.equal([...b.centralino.abbinamenti.keys()][0], impronta(codice));
    assert.equal([...b.centralino.abbinamenti.keys()].includes(codice), false);

    telefono.chiudi();
    casa.chiudi();
  } finally {
    await b.spegni();
  }
});

test("un'impronta che nessuno ha registrato non porta da nessuna parte", async () => {
  const b = await banco();
  try {
    const casa = unaCasa(b.dove);
    await casa.entra();

    const telefono = unTelefono(b.dove, `/abbinamento/${impronta("MAI-VISTO")}`);
    await telefono.aperta.catch(() => {});
    await telefono.chiusa;
    assert.equal(casa.canali().length, 0, "la casa non e' stata nemmeno disturbata");
    casa.chiudi();
  } finally {
    await b.spegni();
  }
});

test("un codice nuovo spegne quello di prima", async () => {
  const b = await banco();
  try {
    const casa = unaCasa(b.dove);
    await casa.entra();

    casa.manda({ t: "apri-abbinamento", impronta: impronta("PRIMO123") });
    await attendi(() => b.centralino.abbinamenti.size === 1);
    casa.manda({ t: "apri-abbinamento", impronta: impronta("SECONDO2") });
    await attendi(() => [...b.centralino.abbinamenti.keys()][0] === impronta("SECONDO2"));

    assert.equal(b.centralino.abbinamenti.size, 1);
    casa.chiudi();
  } finally {
    await b.spegni();
  }
});

test("quando la casa se ne va, il suo abbinamento se ne va con lei", async () => {
  const b = await banco();
  try {
    const casa = unaCasa(b.dove);
    await casa.entra();
    casa.manda({ t: "apri-abbinamento", impronta: impronta("ABCD2345") });
    await attendi(() => b.centralino.abbinamenti.size === 1);

    casa.chiudi();
    await attendi(() => b.centralino.abbinamenti.size === 0);
  } finally {
    await b.spegni();
  }
});

/* ─── Quello che non deve passare ────────────────────────────────────────── */

test("senza presentarsi, una casa non puo' fare niente", async () => {
  const b = await banco();
  try {
    const casa = unaCasa(b.dove);
    await casa.aperta;
    casa.manda({ t: "apri-abbinamento", impronta: impronta("ABCD2345") });
    await casa.chiusa;
    assert.equal(b.centralino.abbinamenti.size, 0);
  } finally {
    await b.spegni();
  }
});

test("le vie che non esistono non aprono niente", async () => {
  const b = await banco();
  try {
    for (const via of [
      "/",
      "/telefono",
      "/telefono/non-una-casa",
      "/telefono/casa_soloventidue",
      "/abbinamento/corta",
      "/abbinamento/ZZZZ",
      "/altrove",
    ]) {
      const telefono = unTelefono(b.dove, via);
      const finita = await Promise.race([
        telefono.aperta.then(() => "aperta"),
        telefono.chiusa.then(() => "chiusa"),
        new Promise((ok) => setTimeout(() => ok("chiusa"), 800)),
      ]).catch(() => "chiusa");
      assert.notEqual(finita, "aperta", `«${via}» non deve aprirsi`);
    }
  } finally {
    await b.spegni();
  }
});

test("una casa che parla a vanvera viene chiusa, non ingoiata", async () => {
  const b = await banco();
  try {
    const casa = unaCasa(b.dove);
    await casa.aperta;
    casa.presa.send("questo non e' json");
    await casa.chiusa;
    assert.equal(b.centralino.quanteCase(), 0);
  } finally {
    await b.spegni();
  }
});

test("una casa non puo' mandare byte a un canale che non e' suo", async () => {
  const b = await banco();
  try {
    const mia = unaCasa(b.dove);
    const tua = unaCasa(b.dove);
    await mia.entra();
    await tua.entra();

    const telefono = unTelefono(b.dove, `/telefono/${tua.id}`);
    await telefono.aperta;
    await attendi(() => tua.canali().length === 1);
    const canaleDiTua = tua.canali()[0];

    /* La casa «mia» prova a scrivere sul canale della casa «tua». I numeri di
     * canale sono per casa, quindi quel numero da lei non vuol dire niente. */
    mia.manda({ c: canaleDiTua, t: "d", m: "ciao, sono un'altra casa" });
    await nuovoGiro(200);
    assert.deepEqual(telefono.detti, []);

    telefono.chiudi();
    mia.chiudi();
    tua.chiudi();
  } finally {
    await b.spegni();
  }
});

/* ─── Attese ─────────────────────────────────────────────────────────────── */

const nuovoGiro = (millesimi = 5) => new Promise((ok) => setTimeout(ok, millesimi));

async function attendi(condizione, entro = 5000) {
  const fine = Date.now() + entro;
  while (Date.now() < fine) {
    if (condizione()) return;
    await nuovoGiro();
  }
  throw new Error("l'attesa e' scaduta");
}
