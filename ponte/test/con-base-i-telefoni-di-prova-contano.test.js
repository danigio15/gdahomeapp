/* Con gdahome Base i telefoni sono due, anche quelli della casa di prova.
 *
 * «Troppi telefoni abbinati e poche licenze.» I telefoni entrati col codice
 * della casa di prova stavano fuori dai massimi: la casa di prova e' quella
 * di chi tiene la Gestione, e la rivedono Apple e Google. Ma il ponte sa di
 * essere la casa del gestore solo perche' nella casella
 * `chiave_della_gestione` delle opzioni c'e' scritto qualcosa — una parola
 * qualsiasi, che nessuno controlla. Una casa Base ci scriveva «x», faceva la
 * casa di prova per un utente qualunque, la allungava ogni settimana, e
 * abbinava quanti telefoni voleva.
 *
 * La prova qui sotto monta i pezzi come li monta `index.js` — le licenze con
 * la chiave, senza gettone (Base), e i telefoni coi massimi delle licenze —
 * e mostra che il terzo telefono, di prova, adesso resta fuori. Con Premium
 * e a licenze spente resta tutto come prima.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Dispositivi, TroppiDispositivi } from "../src/dispositivi.js";
import { Licenze } from "../src/licenze.js";
import { GIORNO, PUBBLICA_DI_PROVA, unGettone } from "./gettoni-di-prova.js";

const QUI = dirname(fileURLToPath(import.meta.url));
const CASA = "casa_0123456789abcdef0123456789abcdef";
const ADESSO = 1_760_000_000_000;
const ZITTO = { debug() {}, info() {}, attenzione() {}, errore() {} };

/* Le licenze e i telefoni, cuciti come in `index.js`. `gettone` e' quello
 * che il quadro risponde: nessuno vuol dire Base. */
function unaCasa({ chiave = PUBBLICA_DI_PROVA, gettone = null } = {}) {
  const cartella = mkdtempSync(join(tmpdir(), "prova-nei-massimi-"));
  const licenze = new Licenze({
    casa: CASA,
    segreto: () => "s".repeat(64),
    cartella,
    chiave,
    dove: "https://quadro.prova",
    fetch: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ gettoni: gettone ? { gdahome: gettone } : {}, licenze: [] }),
    }),
    adesso: () => ADESSO,
    registro: ZITTO,
  });
  const dispositivi = new Dispositivi({ cartella, adesso: () => ADESSO });
  dispositivi.massimi = () => licenze.telefoniMassimi(10);
  dispositivi.provaNeiMassimi = () => licenze.attive && !licenze.premium;
  return { licenze, dispositivi, via: () => rmSync(cartella, { recursive: true, force: true }) };
}

const FINO = ADESSO + 7 * GIORNO;

test("con Base il telefono di prova non passa oltre i due", async () => {
  const c = unaCasa();
  try {
    await c.licenze.rinnova();
    assert.equal(c.licenze.premium, false, "nessun gettone: Base");
    c.dispositivi.abbina({ nome: "Telefono di casa" });
    c.dispositivi.abbina({ nome: "Tablet di casa" });
    /* Prima questo passava, e dopo di lui quanti se ne voleva. */
    assert.throws(() => c.dispositivi.abbina({ nome: "di prova", finoA: FINO }), TroppiDispositivi);
    assert.equal(c.dispositivi.quanti(), 2);
  } finally {
    c.via();
  }
});

test("con Base un telefono di prova prende uno dei due posti", async () => {
  const c = unaCasa();
  try {
    await c.licenze.rinnova();
    c.dispositivi.abbina({ nome: "di prova 1", finoA: FINO });
    c.dispositivi.abbina({ nome: "di prova 2", finoA: FINO });
    assert.throws(() => c.dispositivi.abbina({ nome: "di prova 3", finoA: FINO }));
    assert.throws(() => c.dispositivi.abbina({ nome: "Telefono di casa" }), TroppiDispositivi);
    assert.equal(c.dispositivi.postiPresi(), 2);
  } finally {
    c.via();
  }
});

test("con Premium la casa di prova resta fuori dai massimi, come prima", async () => {
  const c = unaCasa({ gettone: unGettone({ sog: CASA }, { adesso: ADESSO }) });
  try {
    await c.licenze.rinnova();
    assert.equal(c.licenze.premium, true);
    for (let i = 0; i < 5; i += 1) c.dispositivi.abbina({ nome: `di prova ${i}`, finoA: FINO });
    for (let i = 0; i < 3; i += 1) c.dispositivi.abbina({ nome: `di casa ${i}` });
    assert.equal(c.dispositivi.quantiDiProva(), 5);
    assert.equal(c.dispositivi.quantiDiCasa(), 3);
  } finally {
    c.via();
  }
});

test("a licenze spente i telefoni di prova non tolgono posto, come prima", async () => {
  const c = unaCasa({ chiave: "" });
  try {
    c.dispositivi.massimi = () => c.licenze.telefoniMassimi(2);
    for (let i = 0; i < 4; i += 1) c.dispositivi.abbina({ nome: `di prova ${i}`, finoA: FINO });
    c.dispositivi.abbina({ nome: "di casa 1" });
    c.dispositivi.abbina({ nome: "di casa 2" });
    assert.throws(() => c.dispositivi.abbina({ nome: "di casa 3" }), TroppiDispositivi);
    assert.equal(c.dispositivi.postiPresi(), 2);
  } finally {
    c.via();
  }
});

test("l'add-on li cuce cosi', e la console non fa un codice per il terzo", () => {
  const indice = readFileSync(join(QUI, "..", "src", "index.js"), "utf8");
  assert.match(
    indice,
    /dispositivi\.provaNeiMassimi = \(\) => licenze\.attive && !licenze\.premium;/,
  );
  const server = readFileSync(join(QUI, "..", "src", "server.js"), "utf8");
  assert.match(server, /dispositivi\.postiPresi\?\.\(\) \?\? dispositivi\.quantiDiCasa\(\)/);
});
