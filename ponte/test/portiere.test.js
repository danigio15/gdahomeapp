/* Le prove del portiere: la stretta di mano, e soprattutto quella
 * dell'abbinamento.
 *
 * Qui la presa e' finta — un oggetto che tiene quello che gli si manda — e il
 * telefono e' fatto a mano con `cifra.js`: cosi' si puo' fare quello che un
 * telefono vero non fa, cioe' sbagliare apposta. Un codice diverso, una
 * conferma con le chiavi di un altro, un'app di prima, uno che non dice
 * niente e aspetta.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { Abbinamento } from "../src/abbinamento.js";
import {
  aperturaNuova,
  Busta,
  chiaveDelFiloNuova,
  chiaveDiSessione,
  coppiaEffimera,
  VERSIONE,
  VERSIONE_DELL_ABBINAMENTO,
} from "../src/cifra.js";
import { Portiere, PresaCifrata } from "../src/portiere.js";
import { impronta } from "../src/segreti.js";

const giro = () => new Promise((ok) => setImmediate(ok));

/* Una presa che tiene tutto quello che le si dice. */
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
    /* Le righe in chiaro, lette. */
    get inChiaro() {
      return presa.mandati.filter((uno) => uno.startsWith("{")).map((uno) => JSON.parse(uno));
    },
  };
  return presa;
}

function dispositiviFinti({ chiavi = {}, revocate = {} } = {}) {
  const abbinati = [];
  return {
    abbinati,
    chiaveDi: (id) => chiavi[id] ?? null,
    chiaveRevocataDi: (id) => revocate[id] ?? null,
    abbina({ nome, sistema, utente }) {
      const dispositivo = { id: `dm_${abbinati.length}`, nome, sistema, utente };
      abbinati.push(dispositivo);
      return { dispositivo, segno: "5".repeat(64), chiave: "6".repeat(64) };
    },
  };
}

function unPortiere({ dispositivi = dispositiviFinti(), attesaDellaStretta } = {}) {
  const abbinamento = new Abbinamento({});
  const accolti = [];
  const portiere = new Portiere({
    ponte: { accogli: (presa, come) => accolti.push({ presa, come }) },
    dispositivi,
    abbinamento,
    registro: null,
    ...(attesaDellaStretta ? { attesaDellaStretta } : {}),
  });
  return { portiere, abbinamento, dispositivi, accolti };
}

/* Un telefono fatto a mano: dice la prima parola, e quando la casa risponde
 * ricava la chiave con quello che ha — un codice, o una chiave del filo. */
function unTelefono(presa, { codice = null, chiaveDelFilo = null, chi = null, prima = {} } = {}) {
  const mia = coppiaEffimera();
  const apertura = aperturaNuova();
  presa.arriva(
    JSON.stringify({
      v: VERSIONE,
      ...(codice != null ? { abbina: VERSIONE_DELL_ABBINAMENTO } : { chi }),
      apertura: apertura.toString("base64"),
      mia: mia.pubblica.toString("base64"),
      ...prima,
    }),
  );
  const pronto = presa.inChiaro.find((uno) => uno.pronto);
  if (!pronto) return { pronto: null };
  const chiave = chiaveDiSessione({
    miaPrivata: mia.privata,
    suaPubblica: pronto.mia,
    delTelefono: mia.pubblica,
    dellaCasa: Buffer.from(pronto.mia, "base64"),
    apertura,
    ...(codice != null ? { codice } : { chiaveDelFilo }),
  });
  const busta = new Busta(chiave, { io: "telefono" });
  return {
    pronto,
    mia: mia.pubblica.toString("base64"),
    sua: pronto.mia,
    manda: (cosa) => presa.arriva(busta.chiudi(JSON.stringify(cosa))),
    /* Le buste che la casa gli ha mandato, aperte. */
    lette: () =>
      presa.mandati.filter((uno) => !uno.startsWith("{")).map((uno) => JSON.parse(busta.apri(uno))),
  };
}

/* ─── L'abbinamento ──────────────────────────────────────────────────────── */

test("col codice giusto e la conferma giusta arrivano segno e chiave", async () => {
  const { portiere, abbinamento, dispositivi } = unPortiere();
  const { codice } = abbinamento.nuovo();
  const presa = presaFinta();
  portiere.accogli(presa, { da: "192.168.1.20" });

  const telefono = unTelefono(presa, { codice });
  assert.equal(telefono.pronto.gzip, undefined, "l'abbinamento non comprime");
  /* Prima della conferma, dalla casa e' uscito solo il `pronto`. */
  assert.equal(presa.mandati.length, 1);

  telefono.manda({ t: "conferma", telefono: telefono.mia, casa: telefono.sua, nome: "Pixel" });
  await giro();

  const [ecco] = telefono.lette();
  assert.equal(ecco.t, "ecco");
  assert.equal(ecco.segno, "5".repeat(64));
  assert.equal(dispositivi.abbinati.length, 1);
  assert.equal(abbinamento.vivo(), null, "il codice si e' speso");
  assert.equal(presa.chiusa.codice, 1000);
});

test("chi sta in mezzo con l'impronta ma senza il codice non riceve niente", async () => {
  /* E' il centralino che si mette in mezzo: l'impronta la conosce, perche'
   * e' su quella che instrada, e prova a usarla al posto del codice. La
   * stretta di mano va — e' in chiaro — ma la sua conferma non si apre. */
  const { portiere, abbinamento, dispositivi } = unPortiere();
  const { codice } = abbinamento.nuovo();
  const presa = presaFinta();
  portiere.accogli(presa, { da: "centralino 203.0.113.9" });

  const inMezzo = unTelefono(presa, { codice: impronta(codice) });
  inMezzo.manda({ t: "conferma", telefono: inMezzo.mia, casa: inMezzo.sua });
  await giro();

  assert.equal(dispositivi.abbinati.length, 0);
  assert.equal(
    presa.mandati.some((uno) => uno.includes("5".repeat(64))),
    false,
    "il segno non e' uscito, nemmeno cifrato",
  );
  const no = presa.inChiaro.find((uno) => uno.no);
  assert.equal(no.motivo, "codice");
  assert.equal(presa.chiusa.codice, 1008);
  assert.equal(abbinamento.stato().tentativiSbagliati, 1, "e il tentativo si e' contato");
  assert.notEqual(abbinamento.vivo(), null, "il codice vero resta buono per chi ce l'ha");
});

test("una conferma con le chiavi di un'altra stretta di mano non passa", async () => {
  const { portiere, abbinamento, dispositivi } = unPortiere();
  const { codice } = abbinamento.nuovo();
  const presa = presaFinta();
  portiere.accogli(presa, { da: "192.168.1.20" });

  const telefono = unTelefono(presa, { codice });
  telefono.manda({ t: "conferma", telefono: telefono.mia, casa: coppiaEffimera().pubblica });
  await giro();

  assert.equal(dispositivi.abbinati.length, 0);
  assert.equal(telefono.lette()[0].t, "no");
  assert.equal(abbinamento.stato().tentativiSbagliati, 1);
});

test("un'app di prima si sente dire di aggiornarsi, e la stretta non parte", () => {
  const { portiere, abbinamento } = unPortiere();
  abbinamento.nuovo();
  const presa = presaFinta();
  portiere.accogli(presa, { da: "192.168.1.20" });

  presa.arriva(
    JSON.stringify({
      v: VERSIONE,
      abbina: true,
      apertura: aperturaNuova().toString("base64"),
      mia: coppiaEffimera().pubblica.toString("base64"),
    }),
  );
  const [no] = presa.inChiaro;
  assert.equal(no.motivo, "aggiorna");
  assert.match(no.no, /aggiorna l'app/);
  assert.equal(
    presa.inChiaro.some((uno) => uno.pronto),
    false,
  );
  assert.ok(presa.chiusa);
});

test("senza un codice vivo non si stringe nemmeno la mano", () => {
  const { portiere } = unPortiere();
  const presa = presaFinta();
  portiere.accogli(presa, { da: "192.168.1.20" });
  const telefono = unTelefono(presa, { codice: "ABCDEFGHJKMNPQRS" });
  assert.equal(telefono.pronto, null);
  assert.equal(presa.inChiaro[0].motivo, "nessuno");
});

test("da una porta dove non ci si abbina, non ci si abbina", () => {
  const { portiere, abbinamento } = unPortiere();
  const { codice } = abbinamento.nuovo();
  const presa = presaFinta();
  portiere.accogli(presa, { da: "centralino", abbina: false });
  const telefono = unTelefono(presa, { codice });
  assert.equal(telefono.pronto, null);
  assert.ok(presa.chiusa);
});

test("chi ha sbagliato troppe volte aspetta, e gli altri no", async () => {
  const { portiere, abbinamento, dispositivi } = unPortiere();
  const { codice } = abbinamento.nuovo();
  for (let i = 0; i < 5; i += 1) {
    const presa = presaFinta();
    portiere.accogli(presa, { da: "estraneo" });
    const furbo = unTelefono(presa, { codice: `SBAGLIATO${i}` });
    furbo.manda({ t: "conferma", telefono: furbo.mia, casa: furbo.sua });
  }

  const ancora = presaFinta();
  portiere.accogli(ancora, { da: "estraneo" });
  assert.equal(unTelefono(ancora, { codice }).pronto, null, "nemmeno col codice giusto");
  assert.equal(ancora.inChiaro[0].motivo, "tentativi");

  const presa = presaFinta();
  portiere.accogli(presa, { da: "192.168.1.20" });
  const telefono = unTelefono(presa, { codice });
  telefono.manda({ t: "conferma", telefono: telefono.mia, casa: telefono.sua });
  await giro();
  assert.equal(telefono.lette()[0].t, "ecco");
  assert.equal(dispositivi.abbinati.length, 1);
});

test("una stretta di mano che non arriva si chiude da sola", async () => {
  const { portiere, abbinamento } = unPortiere({ attesaDellaStretta: 30 });
  const muta = presaFinta();
  portiere.accogli(muta, { da: "192.168.1.20" });
  await new Promise((ok) => setTimeout(ok, 80));
  assert.ok(muta.chiusa, "chi non dice niente non tiene occupata la porta");

  /* E chi stringe la mano per abbinarsi e poi non conferma. */
  const { codice } = abbinamento.nuovo();
  const presa = presaFinta();
  portiere.accogli(presa, { da: "192.168.1.20" });
  assert.ok(unTelefono(presa, { codice }).pronto);
  await new Promise((ok) => setTimeout(ok, 80));
  assert.ok(presa.chiusa);
  assert.notEqual(abbinamento.vivo(), null);
});

/* ─── Il telefono staccato ───────────────────────────────────────────────── */

test("un telefono staccato di cui la casa ha la chiave lo sa dentro il cifrato", () => {
  const vecchia = chiaveDelFiloNuova();
  const { portiere } = unPortiere({
    dispositivi: dispositiviFinti({ revocate: { dm_via: vecchia } }),
  });
  const presa = presaFinta();
  portiere.accogli(presa, { da: "192.168.1.20" });

  const telefono = unTelefono(presa, { chi: "dm_via", chiaveDelFilo: vecchia });
  assert.ok(telefono.pronto);
  assert.equal(
    presa.inChiaro.some((uno) => uno.riabbina),
    false,
    "niente in chiaro che chiunque potrebbe scrivere",
  );
  const [detto] = telefono.lette();
  assert.equal(detto.type, "auth_invalid");
  assert.ok(presa.chiusa);
});

test("un telefono che non si conosce proprio riceve il no in chiaro, come prima", () => {
  const { portiere } = unPortiere();
  const presa = presaFinta();
  portiere.accogli(presa, { da: "192.168.1.20" });
  unTelefono(presa, { chi: "dm_mai_visto", chiaveDelFilo: chiaveDelFiloNuova() });
  assert.equal(presa.inChiaro[0].riabbina, true);
});

/* ─── I pezzi, prima e dopo essersi fidati ───────────────────────────────── */

test("prima della prima busta aperta, i pezzi non passano il megabyte", () => {
  const presa = presaFinta();
  const cifrata = new PresaCifrata(presa, Buffer.alloc(32, 7));
  const mezzo = "A".repeat(512 * 1024);
  presa.arriva(`|${mezzo}`);
  presa.arriva(`|${mezzo}`);
  assert.equal(presa.chiusa, null);
  presa.arriva(`|${mezzo}`);
  assert.equal(presa.chiusa?.motivo, "messaggio troppo grande");
  assert.equal(cifrata.viva, false);
});

test("dopo, chi ha aperto la porta puo' mandare la casa intera", () => {
  const chiave = Buffer.alloc(32, 7);
  const presa = presaFinta();
  const cifrata = new PresaCifrata(presa, chiave);
  const arrivati = [];
  cifrata.onMessaggio = (testo) => arrivati.push(testo);
  const telefono = new Busta(chiave, { io: "telefono" });

  presa.arriva(telefono.chiudi("ciao"));
  const grande = telefono.chiudi("x".repeat(3 * 1024 * 1024));
  const PEZZO = 512 * 1024;
  for (let da = 0; da < grande.length; da += PEZZO) {
    const pezzo = grande.slice(da, da + PEZZO);
    presa.arriva(da + PEZZO >= grande.length ? pezzo : `|${pezzo}`);
  }
  assert.equal(presa.chiusa, null);
  assert.equal(arrivati.length, 2);
  assert.equal(arrivati[1].length, 3 * 1024 * 1024);
});
