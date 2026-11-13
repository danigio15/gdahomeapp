/* Case, licenze e telefoni: la vista «per casa» della Gestione.
 *
 * «Troppi telefoni abbinati e poche licenze: vorrei capire per ogni casa
 * premium quanti telefoni sono abbinati e quanti hanno il base.» Il quadro
 * mette insieme le licenze (`Licenze.perLeCase`) e il rapporto delle case
 * (`telefoni-per-casa.js`): una riga per casa, e un riepilogo. Delle case
 * senza rapporto i telefoni non si sanno, e non diventano zero.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { laFormaDel } from "../src/forma-del-rapporto.js";
import { Licenze } from "../src/licenze.js";
import { daDove, iTelefoniPerCasa, RIGHE_AL_MASSIMO } from "../src/telefoni-per-casa.js";

const QUI = dirname(fileURLToPath(import.meta.url));
const GESTORE = readFileSync(join(QUI, "..", "gestore", "index.html"), "utf8");
const SERVER = readFileSync(join(QUI, "..", "src", "server.js"), "utf8");

const PRIVATA = "Q2Iu3eKMxw3Y1GS9MypZjXvjPfHB959KImNldY80xr0";
const ADESSO = 1_763_000_000_000;
const GIORNO = 24 * 60 * 60 * 1000;
const SEGRETO = "un-segreto-lungo-della-casa-0001";
const casa = (n) => `casa_${String(n).repeat(32).slice(0, 32)}`;

function leLicenze() {
  const cartella = mkdtempSync(join(tmpdir(), "per-casa-"));
  const licenze = new Licenze({ cartella, chiave: PRIVATA, adesso: () => ADESSO });
  return { licenze, via: () => rmSync(cartella, { recursive: true, force: true }) };
}

test("le licenze per casa: quella che vale, da dove viene, e quando ha chiesto", () => {
  const { licenze, via } = leLicenze();
  try {
    licenze.riconosci(casa(1), SEGRETO); /* Base: ha chiesto, niente licenza */
    licenze.riconosci(casa(2), SEGRETO);
    licenze.regala({ app: "gdahome", casa: casa(2), mesi: 12 });
    licenze.regala({ app: "gdahome", casa: casa(3), mesi: null, nota: "per sempre" });
    const [codice] = licenze
      .generaCodici({ app: "gdahome", quanti: 1, mesi: 1 })
      .map((uno) => (typeof uno === "string" ? uno : uno.codice));
    licenze.riscatta(codice, casa(4));
    licenze.dalNegozio({
      app: "gdahome",
      sog: casa(5),
      scade: ADESSO + 10 * GIORNO,
      acquisto: "1000000001",
      piattaforma: "ios",
      prodotto: "gdahome_premium_mensile",
      abbonamento: { piano: "mensile", sandbox: true },
    });
    licenze.dalNegozio({
      app: "gdahome",
      sog: casa(6),
      scade: ADESSO + 10 * GIORNO,
      acquisto: "tok-6",
      piattaforma: "android",
      prodotto: "gdahome_premium",
      prova: true,
    });
    /* Una gdanav non fa Premium la casa. */
    licenze.regala({ app: "gdanav", casa: casa(7), mesi: 12 });
    const per = new Map(licenze.perLeCase().map((una) => [una.casa, una]));
    assert.equal(per.get(casa(1)).gdahome, null);
    assert.equal(per.get(casa(1)).chiesto, ADESSO);
    assert.equal(daDove(per.get(casa(2)).gdahome), "regalo");
    assert.equal(per.get(casa(3)).gdahome.scade, null);
    assert.equal(daDove(per.get(casa(4)).gdahome), "codice");
    assert.equal(daDove(per.get(casa(5)).gdahome), "sandbox");
    assert.equal(daDove(per.get(casa(6)).gdahome), "prova");
    assert.equal(per.get(casa(7)), undefined, "solo gdanav: per gdahome la casa non c'e'");
    /* Niente segreti, ne' impronte. */
    assert.equal(JSON.stringify(licenze.perLeCase()).includes("impronta"), false);
  } finally {
    via();
  }
});

test("una licenza scaduta conta come finita, e la casa e' Base", () => {
  let ora = ADESSO;
  const cartella = mkdtempSync(join(tmpdir(), "per-casa-"));
  try {
    const licenze = new Licenze({ cartella, chiave: PRIVATA, adesso: () => ora });
    licenze.regala({ app: "gdahome", casa: casa(1), mesi: 1 });
    ora += 40 * GIORNO;
    const [una] = licenze.perLeCase();
    assert.equal(una.gdahome, null);
    assert.equal(una.finite, 1);
    assert.equal(iTelefoniPerCasa([], [una], ora).case[0].licenza, "base");
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});

const dalQuadro = (n, telefoni, altro = {}) => ({
  casa: casa(n),
  nome: `Casa ${n}`,
  senzaNome: false,
  vistaIl: new Date(ADESSO - GIORNO).toISOString(),
  carta: { ponte: "1.19.0", ...(telefoni ? { telefoni } : {}) },
  ...altro,
});

test("una riga per casa: licenza, telefoni dal rapporto, add-on e ultimo contatto", () => {
  const V = iTelefoniPerCasa(
    [
      dalQuadro(1, { abbinati: 4, visti7gg: 3, diProva: 0, massimi: 2, licenza: "base" }),
      dalQuadro(2, { abbinati: 6, visti7gg: 5, massimi: null, licenza: "premium" }),
      dalQuadro(3, { abbinati: 2, visti7gg: 2 }),
      dalQuadro(4, null, { senzaNome: true }),
    ],
    [
      { casa: casa(1), chiesto: ADESSO - 2 * GIORNO, gdahome: null, finite: 0 },
      {
        casa: casa(2),
        chiesto: ADESSO - 60_000,
        gdahome: { origine: "negozio", prova: false, sandbox: false, scade: ADESSO + GIORNO },
      },
      { casa: casa(3), chiesto: ADESSO, gdahome: null, finite: 0 },
      /* Una casa che il rapporto non lo manda: la licenza si', i telefoni no. */
      { casa: casa(5), chiesto: ADESSO - 3_600_000, gdahome: null, finite: 0 },
      {
        casa: casa(6),
        chiesto: ADESSO,
        gdahome: { origine: "installatore", installatore: "ins_1", scade: null },
      },
    ],
    ADESSO,
  );
  const per = new Map(V.case.map((una) => [una.casa, una]));
  const prima = per.get(casa(1));
  assert.equal(prima.licenza, "base");
  assert.equal(prima.oltre, true, "Base con 4 telefoni: oltre i due");
  assert.equal(prima.telefoni.abbinati, 4);
  assert.equal(prima.telefoni.massimi, 2);
  assert.equal(prima.ponte, "1.19.0");
  assert.equal(prima.ultimo, ADESSO - GIORNO, "il rapporto e' piu' recente della domanda");
  assert.equal(per.get(casa(2)).origine, "acquisto");
  assert.equal(per.get(casa(2)).telefoni.massimi, null, "Premium: senza limite");
  assert.equal(per.get(casa(2)).oltre, false);
  assert.equal(per.get(casa(3)).oltre, false);
  assert.equal(per.get(casa(4)).licenza, "sconosciuta", "mai chiesto le licenze");
  assert.equal(per.get(casa(4)).nome, "", "senza nome resta la matricola corta");
  assert.equal(per.get(casa(4)).corto, casa(4).slice(5, 13));
  assert.equal(per.get(casa(5)).telefoni, null, "senza rapporto i telefoni non si sanno");
  assert.equal(per.get(casa(6)).origine, "installatore");
  /* Prima le Base oltre i due. */
  assert.equal(V.case[0].casa, casa(1));
  assert.deepEqual(
    {
      tutte: V.riepilogo.tutte,
      premium: V.riepilogo.premium,
      base: V.riepilogo.base,
      sconosciute: V.riepilogo.sconosciute,
      baseOltre: V.riepilogo.baseOltre,
      premiumConTelefoni: V.riepilogo.premiumConTelefoni,
      telefoniPremium: V.riepilogo.telefoniPremium,
      baseConTelefoni: V.riepilogo.baseConTelefoni,
      telefoniBase: V.riepilogo.telefoniBase,
    },
    {
      tutte: 6,
      premium: 2,
      base: 3,
      sconosciute: 1,
      baseOltre: 1,
      premiumConTelefoni: 1,
      telefoniPremium: 6,
      baseConTelefoni: 2,
      telefoniBase: 6,
    },
  );
  assert.deepEqual(V.riepilogo.origini, { acquisto: 1, installatore: 1 });
});

test("una casa sconosciuta al quadro ma Base per se stessa conta oltre i due", () => {
  const V = iTelefoniPerCasa([dalQuadro(1, { abbinati: 3, licenza: "base" })], [], ADESSO);
  assert.equal(V.case[0].licenza, "sconosciuta");
  assert.equal(V.case[0].oltre, true);
});

test("i numeri di un rapporto vecchio si segnano come vecchi", () => {
  const V = iTelefoniPerCasa(
    [dalQuadro(1, { abbinati: 1 }, { vistaIl: ADESSO - 30 * GIORNO })],
    [],
    ADESSO,
  );
  assert.equal(V.case[0].telefoniVecchi, true);
});

test("le righe hanno un tetto, e il riepilogo le conta tutte", () => {
  const molte = Array.from({ length: RIGHE_AL_MASSIMO + 3 }, (_, i) => ({
    casa: `casa_${String(i).padStart(32, "0")}`,
    chiesto: ADESSO,
    gdahome: null,
  }));
  const V = iTelefoniPerCasa([], molte, ADESSO);
  assert.equal(V.case.length, RIGHE_AL_MASSIMO);
  assert.equal(V.riepilogo.base, RIGHE_AL_MASSIMO + 3);
  assert.equal(V.riepilogo.tagliate, 3);
});

test("il rapporto porta i telefoni di prova, il tetto e la licenza, e niente di storto", () => {
  const detta = laFormaDel({
    telefoni: { abbinati: 3, visti7gg: 2, diProva: 1, massimi: null, licenza: "base" },
  });
  assert.deepEqual(detta.telefoni, {
    abbinati: 3,
    visti7gg: 2,
    diProva: 1,
    massimi: null,
    licenza: "base",
  });
  const storta = laFormaDel({ telefoni: { abbinati: 1, licenza: "<b>premium</b>" } });
  assert.equal("licenza" in storta.telefoni, false);
  assert.equal("massimi" in storta.telefoni, false, "un add-on di prima non lo dice");
});

test("la gestione la chiede con gli abbonamenti, e la pagina la scrive senza fidarsi", () => {
  assert.match(SERVER, /telefoniPerCasa: iTelefoniPerCasa\(tutteLeCase, licenze\.perLeCase\(\)\)/);
  assert.match(GESTORE, /Case, licenze e telefoni/);
  assert.match(GESTORE, /Case Base con più di 2 telefoni/);
  assert.match(GESTORE, /leVersioniDellApp\(\) \+ leCaseEITelefoni\(\)/);
  /* Quello che arriva da una casa passa da `testo(…)`. */
  assert.match(GESTORE, /<b>\$\{testo\(ilNome\(una\)\)\}<\/b>/);
  assert.match(GESTORE, /\$\{testo\(iTelefoni\(una\)\)\}/);
});
