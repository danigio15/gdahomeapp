/* Il giorno dei pagamenti, dalla parte della casa: le app vecchie si fermano.
 *
 * Il centralino dice la versione minima (`GET /versioni`); la casa la chiede,
 * la tiene in `/data`, e il portiere rifiuta con `aggiorna-l-app` il telefono
 * che non dice il suo numero — le app di oggi — o ne dice uno piu' piccolo.
 * Con la minima a zero, com'e' di serie, non cambia niente: e' la prima
 * prova.
 *
 * Il centralino qui e' quello vero di `../../centralino`, acceso con la sua
 * minima; il telefono e' fatto a mano con `cifra.js`, come in
 * `portiere.test.js`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Case } from "../../centralino/src/case.js";
import { Centralino } from "../../centralino/src/centralino.js";
import { costruisciIlServer } from "../../centralino/src/server.js";

import { Abbinamento } from "../src/abbinamento.js";
import {
  aperturaNuova,
  chiaveDelFiloNuova,
  chiaveDiSessione,
  coppiaEffimera,
  VERSIONE,
  VERSIONE_DELL_ABBINAMENTO,
} from "../src/cifra.js";
import { Portiere } from "../src/portiere.js";
import { numeroDiCostruzione, VersioneMinima } from "../src/versione-minima.js";

const ZITTO = { debug() {}, info() {}, attenzione() {}, errore() {} };
const QUESTA = 1061100;

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

/* Un telefono gia' abbinato (`chi` e la sua chiave), o uno che si abbina
 * (`codice`). `app` e' il numero che dice: `undefined` = un'app di oggi, che
 * non lo dice. */
function bussa(portiere, { chi = null, chiave = null, codice = null, app, da = "192.168.1.20" }) {
  const presa = presaFinta();
  portiere.accogli(presa, { da });
  const mia = coppiaEffimera();
  const apertura = aperturaNuova();
  presa.arriva(
    JSON.stringify({
      v: VERSIONE,
      ...(codice != null ? { abbina: VERSIONE_DELL_ABBINAMENTO } : { chi }),
      apertura: apertura.toString("base64"),
      mia: mia.pubblica.toString("base64"),
      ...(app === undefined ? {} : { app }),
    }),
  );
  const pronto = presa.inChiaro.find((uno) => uno.pronto) ?? null;
  if (pronto && chiave) {
    /* La chiave si ricava come farebbe il telefono: se la stretta e' giusta
     * non solleva. */
    chiaveDiSessione({
      miaPrivata: mia.privata,
      suaPubblica: pronto.mia,
      delTelefono: mia.pubblica,
      dellaCasa: Buffer.from(pronto.mia, "base64"),
      apertura,
      chiaveDelFilo: chiave,
    });
  }
  return { presa, pronto, no: presa.inChiaro.find((uno) => uno.no) ?? null };
}

/* Il centralino vero, con la sua minima, e una casa che gliela chiede. */
async function banco({ minima = 0 } = {}) {
  const cartelle = [];
  const nuova = (nome) => {
    const dove = mkdtempSync(join(tmpdir(), `${nome}-`));
    cartelle.push(dove);
    return dove;
  };
  const case_ = new Case({ cartella: nuova("case") });
  /* Qui si prova il centralino, non la licenza: senza chiave, come oggi,
   * qualunque sia quella scritta nel codice (`docs/LICENZE.md`). */
  const centralino = new Centralino({ case: case_, chiaveLicenze: "" });
  const server = costruisciIlServer({ centralino, versioneMinima: minima });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const doveIlCentralino = `ws://127.0.0.1:${server.address().port}`;

  const cartella = nuova("ponte");
  const versioneMinima = new VersioneMinima({
    centralino: doveIlCentralino,
    cartella,
    registro: ZITTO,
  });
  const chiave = chiaveDelFiloNuova();
  const accolti = [];
  const abbinamento = new Abbinamento({});
  const portiere = new Portiere({
    ponte: { accogli: (presa, come) => accolti.push({ presa, come }) },
    dispositivi: {
      chiaveDi: (id) => (id === "dm_mio" ? chiave : null),
      chiaveRevocataDi: () => null,
    },
    abbinamento,
    registro: null,
    versioneMinima,
  });
  return {
    versioneMinima,
    portiere,
    abbinamento,
    accolti,
    chiave,
    cartella,
    doveIlCentralino,
    spegni: async () => {
      versioneMinima.ferma();
      centralino.chiudiTutto();
      await new Promise((ok) => server.close(ok));
      case_.chiudi();
      for (const una of cartelle) rmSync(una, { recursive: true, force: true });
    },
  };
}

test("con la minima a zero non cambia niente: entrano anche le app che non dicono il numero", async () => {
  const b = await banco({ minima: 0 });
  try {
    assert.equal(await b.versioneMinima.chiedi(), 0);
    for (const app of [undefined, 1, QUESTA]) {
      const { pronto, no } = bussa(b.portiere, { chi: "dm_mio", chiave: b.chiave, app });
      assert.ok(pronto, `app ${app}`);
      assert.equal(no, null);
    }
    assert.equal(b.accolti.length, 3);
  } finally {
    await b.spegni();
  }
});

test("con la minima accesa, l'app di oggi (senza numero) e quella piu' vecchia si fermano", async () => {
  const b = await banco({ minima: 1070000 });
  try {
    assert.equal(await b.versioneMinima.chiedi(), 1070000);

    for (const app of [undefined, QUESTA, "1069999", "domani", null]) {
      const { pronto, no, presa } = bussa(b.portiere, { chi: "dm_mio", chiave: b.chiave, app });
      assert.equal(pronto, null, `app ${app}`);
      assert.equal(no.motivo, "aggiorna-l-app");
      assert.equal(no.minima, 1070000);
      /* Detto in chiaro e in parole: un'app di oggi non conosce il motivo,
       * e mostra la frase. */
      assert.match(no.no, /aggiorna/);
      assert.ok(presa.chiusa);
    }

    /* Anche chi si abbina: un'app che non si puo' usare non si abbina. */
    const { codice } = b.abbinamento.nuovo();
    const abbinandosi = bussa(b.portiere, { codice });
    assert.equal(abbinandosi.pronto, null);
    assert.equal(abbinandosi.no.motivo, "aggiorna-l-app");

    /* E da fuori, dal centralino, lo stesso. */
    const daFuori = bussa(b.portiere, {
      chi: "dm_mio",
      chiave: b.chiave,
      da: "centralino 1.2.3.4",
    });
    assert.equal(daFuori.no.motivo, "aggiorna-l-app");

    assert.equal(b.accolti.length, 0);
  } finally {
    await b.spegni();
  }
});

test("con la minima accesa, l'app nuova entra come prima", async () => {
  const b = await banco({ minima: 1070000 });
  try {
    await b.versioneMinima.chiedi();
    for (const app of [1070000, 1070001, "1070000"]) {
      const { pronto, no } = bussa(b.portiere, { chi: "dm_mio", chiave: b.chiave, app });
      assert.ok(pronto, `app ${app}`);
      assert.equal(no, null);
    }
    /* E si abbina. */
    const { codice } = b.abbinamento.nuovo();
    const abbinandosi = bussa(b.portiere, { codice, app: 1070000 });
    assert.ok(abbinandosi.pronto);
  } finally {
    await b.spegni();
  }
});

test("la minima resta sul disco: un centralino che tace non riapre le app vecchie", async () => {
  const b = await banco({ minima: 1070000 });
  try {
    await b.versioneMinima.chiedi();
    /* Un'altra accensione, con un centralino che non risponde. */
    const dopo = new VersioneMinima({
      centralino: "ws://127.0.0.1:9",
      cartella: b.cartella,
      registro: ZITTO,
    });
    assert.equal(dopo.minima, 1070000);
    assert.equal(await dopo.chiedi(), 1070000);
    assert.equal(dopo.troppoVecchia(undefined), true);
    assert.equal(dopo.troppoVecchia(1070000), false);

    /* Un centralino vecchio, senza `/versioni`, nemmeno. */
    const senza = new VersioneMinima({
      centralino: "wss://centralino.esempio",
      cartella: b.cartella,
      registro: ZITTO,
      fetch: async () => ({ ok: false, status: 404, json: async () => ({}) }),
    });
    assert.equal(await senza.chiedi(), 1070000);

    /* E il centralino che torna a zero le riapre. */
    const aZero = new VersioneMinima({
      centralino: "wss://centralino.esempio",
      cartella: b.cartella,
      registro: ZITTO,
      fetch: async (dove) => {
        assert.equal(dove, "https://centralino.esempio/versioni");
        return { ok: true, status: 200, json: async () => ({ gdahome: { minima: 0 } }) };
      },
    });
    assert.equal(await aZero.chiedi(), 0);
    assert.equal(aZero.troppoVecchia(undefined), false);
  } finally {
    await b.spegni();
  }
});

test("senza un indirizzo non si chiede niente, e nessuno si ferma", async () => {
  let chiesto = false;
  const versione = new VersioneMinima({
    centralino: "",
    fetch: async () => {
      chiesto = true;
      throw new Error("non doveva chiedere");
    },
    registro: ZITTO,
  });
  versione.parti();
  assert.equal(await versione.chiedi(), 0);
  versione.ferma();
  assert.equal(chiesto, false);
  assert.equal(versione.troppoVecchia(undefined), false);
});

test("un numero di costruzione e' un intero da zero in su", () => {
  assert.equal(numeroDiCostruzione(1061100), 1061100);
  assert.equal(numeroDiCostruzione("1061100"), 1061100);
  for (const no of [undefined, null, "", "abc", -1, 1.5, "1.5", {}, [], true]) {
    assert.equal(numeroDiCostruzione(no), null, String(no));
  }
});

test("l'app nel browser di questo add-on sotto la minima si dice nel registro", async () => {
  const cartellaDellApp = mkdtempSync(join(tmpdir(), "app-web-"));
  const detti = [];
  try {
    writeFileSync(
      join(cartellaDellApp, "version.json"),
      JSON.stringify({ build_number: "1061100" }),
    );
    const versione = new VersioneMinima({
      centralino: "wss://centralino.esempio",
      cartellaDellApp,
      registro: { ...ZITTO, attenzione: (riga) => detti.push(riga) },
      fetch: async () => ({
        ok: true,
        status: 200,
        json: async () => ({ gdahome: { minima: 1070000 } }),
      }),
    });
    await versione.chiedi();
    assert.equal(detti.length, 1);
    assert.match(detti[0], /1061100.*1070000/);
  } finally {
    rmSync(cartellaDellApp, { recursive: true, force: true });
  }
});
