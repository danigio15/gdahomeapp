/* Con gdahome Base i telefoni sono due, sempre.
 *
 * «Con Base i telefoni abbinati prima del limite non restano: massimo 2
 * telefoni, sempre.» Una casa Base con piu' di due telefoni tiene i due
 * usati piu' di recente; gli altri si staccano davvero — il segno non apre
 * piu', i fili aperti si chiudono col perche', e quando ribussano la casa
 * glielo dice cifrato con `limite-telefoni-base`, che l'app legge per portare
 * alla pagina Premium. Con Premium nessun limite, a licenze spente nessun
 * cambiamento, e mai prima che la casa abbia chiesto la licenza al quadro.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  Dispositivi,
  PERCHE_LIMITE_DI_BASE,
  telefoniOltreBase,
  TroppiDispositivi,
} from "../src/dispositivi.js";
import { Licenze } from "../src/licenze.js";
import { GIORNO, PUBBLICA_DI_PROVA, unGettone } from "./gettoni-di-prova.js";

const QUI = dirname(fileURLToPath(import.meta.url));
const CASA = "casa_0123456789abcdef0123456789abcdef";
const ADESSO = 1_760_000_000_000;
const ZITTO = { debug() {}, info() {}, attenzione() {}, errore() {} };
const ORA = 60 * 60 * 1000;

/* Una casa cucita come in `index.js`: le licenze, i telefoni coi massimi
 * delle licenze, e un ponte finto che si segna chi ha scollegato. */
function unaCasa({ chiave = PUBBLICA_DI_PROVA, gettone = null, diSerie = 10 } = {}) {
  const cartella = mkdtempSync(join(tmpdir(), "due-telefoni-"));
  let ora = ADESSO;
  const adesso = () => ora;
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
    adesso,
    registro: ZITTO,
  });
  const dispositivi = new Dispositivi({ cartella, adesso, giorniDiSilenzio: 0 });
  dispositivi.massimi = () => licenze.telefoniMassimi(diSerie);
  dispositivi.provaNeiMassimi = () => licenze.attive && !licenze.premium;
  const scollegati = [];
  const ponte = { scollega: (id, perche) => scollegati.push({ id, perche }) };
  return {
    licenze,
    dispositivi,
    ponte,
    scollegati,
    avanti: (quanto) => {
      ora += quanto;
    },
    via: () => rmSync(cartella, { recursive: true, force: true }),
  };
}

/* Quattro telefoni abbinati quando non c'era limite, usati in ore diverse. */
function quattroTelefoni(c) {
  const abbinati = {};
  for (const nome of ["vecchio", "nonna", "papa", "mamma"]) {
    const uno = c.dispositivi.lista.length;
    c.dispositivi.lista.push({
      id: `dm_${nome}`,
      nome,
      sistema: "android",
      impronta: "",
      chiave: String(uno + 1).repeat(64),
      natoIl: ADESSO - 30 * GIORNO,
      vistoIl: ADESSO - 30 * GIORNO,
    });
    abbinati[nome] = `dm_${nome}`;
  }
  c.dispositivi.archivio.salva();
  /* Chi si e' fatto vedere per ultimo: mamma, poi papa', poi la nonna. */
  const visto = { nonna: ADESSO - 3 * ORA, papa: ADESSO - 2 * ORA, mamma: ADESSO - ORA };
  for (const [nome, quando] of Object.entries(visto))
    c.dispositivi.lista.find((uno) => uno.id === abbinati[nome]).vistoIl = quando;
  return abbinati;
}

test("con Base restano i due usati piu' di recente, e gli altri si staccano davvero", async () => {
  const c = unaCasa();
  try {
    quattroTelefoni(c);
    await c.licenze.rinnova();
    assert.equal(c.licenze.premium, false);
    const via = telefoniOltreBase(c);
    assert.deepEqual(via.sort(), ["dm_nonna", "dm_vecchio"]);
    assert.deepEqual(
      c.dispositivi
        .elenco()
        .map((uno) => uno.id)
        .sort(),
      ["dm_mamma", "dm_papa"],
    );
    /* Il segno non apre piu', e la chiave resta per dirgli di no cifrato,
     * col perche'. */
    assert.equal(c.dispositivi.chiaveDi("dm_nonna"), null);
    assert.equal(c.dispositivi.chiaveRevocataDi("dm_nonna"), "2".repeat(64));
    assert.equal(c.dispositivi.perCheEStaccato("dm_nonna"), PERCHE_LIMITE_DI_BASE);
    /* I loro fili aperti si chiudono, col perche'. */
    assert.deepEqual(
      c.scollegati.sort((a, b) => a.id.localeCompare(b.id)),
      [
        { id: "dm_nonna", perche: "limite-telefoni-base" },
        { id: "dm_vecchio", perche: "limite-telefoni-base" },
      ],
    );
    /* Ed e' scritto sul disco: un riavvio non li riporta. */
    const sulDisco = JSON.parse(readFileSync(c.dispositivi.archivio.percorso, "utf8"));
    assert.deepEqual(sulDisco.dispositivi.map((uno) => uno.id).sort(), ["dm_mamma", "dm_papa"]);
  } finally {
    c.via();
  }
});

test("con Base anche il tablet e i telefoni di prova stanno nei due", async () => {
  const c = unaCasa();
  try {
    await c.licenze.rinnova();
    c.dispositivi.massimi = () => 10; /* com'era prima del limite */
    c.dispositivi.provaNeiMassimi = false;
    c.dispositivi.abbina({ nome: "Tablet a muro", sistema: "android" });
    c.avanti(ORA);
    c.dispositivi.abbina({ nome: "di prova", finoA: ADESSO + 7 * GIORNO });
    c.avanti(ORA);
    c.dispositivi.abbina({ nome: "Telefono", sistema: "ios" });
    c.dispositivi.massimi = () => c.licenze.telefoniMassimi(10);
    const via = telefoniOltreBase(c);
    assert.equal(via.length, 1);
    assert.deepEqual(
      c.dispositivi.elenco().map((uno) => uno.nome),
      ["di prova", "Telefono"],
    );
  } finally {
    c.via();
  }
});

test("con Premium nessun limite: nessuno si stacca", async () => {
  const c = unaCasa({ gettone: unGettone({ sog: CASA }, { adesso: ADESSO }) });
  try {
    quattroTelefoni(c);
    await c.licenze.rinnova();
    assert.equal(c.licenze.premium, true);
    assert.deepEqual(telefoniOltreBase(c), []);
    assert.equal(c.dispositivi.quanti(), 4);
  } finally {
    c.via();
  }
});

test("a licenze spente nessun cambiamento", async () => {
  const c = unaCasa({ chiave: "" });
  try {
    quattroTelefoni(c);
    await c.licenze.rinnova();
    assert.deepEqual(telefoniOltreBase(c), []);
    assert.equal(c.dispositivi.quanti(), 4);
  } finally {
    c.via();
  }
});

test("prima della prima domanda al quadro non si stacca nessuno", async () => {
  const c = unaCasa();
  try {
    quattroTelefoni(c);
    assert.equal(c.licenze.chiesta, false);
    assert.deepEqual(telefoniOltreBase(c), [], "appena acceso «Base» vuol dire «non letta»");
    await c.licenze.rinnova();
    assert.equal(telefoniOltreBase(c).length, 2);
  } finally {
    c.via();
  }
});

test("il gettone che scade senza rinnovo fa tornare Base, e i telefoni tornano due", async () => {
  const c = unaCasa({ gettone: unGettone({ sog: CASA }, { adesso: ADESSO }) });
  try {
    quattroTelefoni(c);
    await c.licenze.rinnova();
    assert.deepEqual(telefoniOltreBase(c), []);
    c.avanti(9 * GIORNO);
    assert.equal(c.licenze.premium, false);
    assert.equal(telefoniOltreBase(c).length, 2);
    assert.equal(c.dispositivi.quanti(), 2);
  } finally {
    c.via();
  }
});

test("con Base il terzo telefono non entra, e dopo ogni abbinamento si riguarda", async () => {
  const c = unaCasa();
  try {
    await c.licenze.rinnova();
    let riguardata = 0;
    c.dispositivi.dopoLAbbinamento = () => {
      riguardata += 1;
      telefoniOltreBase(c);
    };
    c.dispositivi.abbina({ nome: "uno" });
    c.dispositivi.abbina({ nome: "due" });
    assert.throws(() => c.dispositivi.abbina({ nome: "tre" }), TroppiDispositivi);
    assert.equal(riguardata, 2);
    assert.equal(c.dispositivi.quanti(), 2);
  } finally {
    c.via();
  }
});

test("le opzioni possono solo stringere: con uno, ne resta uno", async () => {
  const c = unaCasa({ diSerie: 1 });
  try {
    quattroTelefoni(c);
    await c.licenze.rinnova();
    assert.equal(telefoniOltreBase(c).length, 3);
    assert.deepEqual(
      c.dispositivi.elenco().map((uno) => uno.id),
      ["dm_mamma"],
    );
  } finally {
    c.via();
  }
});

test("l'add-on la fa valere al cambio di licenza, ogni minuto e dopo ogni abbinamento", () => {
  const indice = readFileSync(join(QUI, "..", "src", "index.js"), "utf8");
  assert.match(indice, /telefoniOltreBase\(\{ licenze, dispositivi, ponte \}\)/);
  assert.match(indice, /licenze\.on\("cambio", dueTelefoniConBase\)/);
  assert.match(indice, /dispositivi\.dopoLAbbinamento = dueTelefoniConBase/);
  assert.match(indice, /dueTelefoniConBase\(\);\s*\}, 60 \* 1000\)/);
});
