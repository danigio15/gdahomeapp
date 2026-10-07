/* L'interruttore degli acquisti, e il programma che lo guarda.
 *
 * «Fai tutto adesso, pero' lascialo spento.» Quindi la prova che conta piu' di
 * tutte e' la prima: che girandolo senza chiederlo non si accenda. Un
 * programma che si chiama «accendi» e che accende quando lo si interroga e'
 * un guaio che si scopre in produzione.
 *
 * Poi il caso brutto, quello che non si vede a occhio: i sei file che tengono
 * la chiave che **non sono d'accordo**. Vorrebbe dire che una parte verifica e
 * un'altra no — il centralino chiude i telefoni e l'add-on non limita niente,
 * o il contrario — e non se ne accorge nessuno finche' non chiama un cliente.
 * Meglio chiamarlo rotto e fermarsi.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  I_FILE_DELLA_CHIAVE,
  I_PASSI_A_MANO,
  comEMesso,
  laChiaveIn,
} from "../../strumenti/accendi-gli-acquisti.mjs";
import { PUBBLICA_DI_PROVA } from "./gettoni-di-prova.js";

const RADICE = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

/* Come racconta lo stato, la prima riga: quello che si cerca nell'uscita. */
const LA_PAROLA = {
  spento: /SPENTO/,
  "senza-centralino": /ACCESO SENZA IL CENTRALINO/,
  acceso: /L'interruttore e' ACCESO:/,
};

/* Una copia di passaggio coi soli file della chiave, scritti come li scrive
 * `chiave-licenze.mjs`. */
function finta(chiavi) {
  const dove = mkdtempSync(join(tmpdir(), "acquisti-"));
  I_FILE_DELLA_CHIAVE.forEach((nome, i) => {
    const dentro = join(dove, nome);
    mkdirSync(dirname(dentro), { recursive: true });
    const valore = Array.isArray(chiavi) ? chiavi[i] : chiavi;
    writeFileSync(
      dentro,
      nome.endsWith(".dart")
        ? `const chiavePubblicaLicenze = '${valore}';\n`
        : `export const CHIAVE_PUBBLICA_LICENZE = "${valore}";\n`,
    );
  });
  return dove;
}

/* Una copia di passaggio **spenta** con i due programmi veri dentro: li' si
 * puo' chiedere `--fallo` senza toccare questa repository, qualunque sia il
 * suo stato. */
function copiaSpenta() {
  const dove = finta("");
  for (const nome of [
    "strumenti/accendi-gli-acquisti.mjs",
    "strumenti/chiave-licenze.mjs",
    "ponte/test/gettoni-di-prova.js",
  ]) {
    mkdirSync(dirname(join(dove, nome)), { recursive: true });
    copyFileSync(join(RADICE, nome), join(dove, nome));
  }
  return dove;
}

/* Il primo passo: la chiave nell'add-on e nell'app, non nel centralino. */
const DI_PROVA = "6P9sdqQtlHcmH7Ve_SgzmyJmxJS28CNORRJJfjI3rnI";
const soloCasaEApp = (x) =>
  I_FILE_DELLA_CHIAVE.map((nome) =>
    nome.startsWith("ponte/") || nome.startsWith("app/") ? x : "",
  );

test("chiamato senza chiedere niente, NON accende", () => {
  /* Gira il programma vero, su questa repository vera, e poi guarda che i
   * file della chiave siano com'erano. E' la prova che permette di lasciarlo
   * qui dentro. Racconta lo stato che c'e' — spento oggi, acceso a meta' o
   * del tutto il giorno che si accende — e non cambia niente. */
  const prima = I_FILE_DELLA_CHIAVE.map((nome) => readFileSync(join(RADICE, nome), "utf8"));
  const detto = execFileSync("node", ["strumenti/accendi-gli-acquisti.mjs"], {
    cwd: RADICE,
    encoding: "utf8",
  });
  const dopo = I_FILE_DELLA_CHIAVE.map((nome) => readFileSync(join(RADICE, nome), "utf8"));
  assert.deepEqual(dopo, prima, "ha toccato i file senza che nessuno glielo chiedesse");
  assert.match(detto, LA_PAROLA[comEMesso({ radice: RADICE }).stato]);
});

test("in questa repository l'interruttore non e' mai rotto, ne' con la chiave di prova", () => {
  /* Spento oggi; il giorno che si accende, prima senza il centralino e poi
   * dappertutto. Rotto mai: vorrebbe dire che una parte verifica e un'altra
   * no. E la chiave non e' mai quella di prova dei documenti, con cui
   * chiunque si fa Premium da solo. */
  const come = comEMesso({ radice: RADICE });
  assert.ok(come.stato in LA_PAROLA, JSON.stringify(come, null, 2));
  assert.notEqual(come.chiave, PUBBLICA_DI_PROVA);
});

test("tutti d'accordo con una chiave vera: acceso", () => {
  const come = comEMesso({ radice: finta("6P9sdqQtlHcmH7Ve_SgzmyJmxJS28CNORRJJfjI3rnI") });
  assert.equal(come.stato, "acceso");
  assert.equal(come.chiave, "6P9sdqQtlHcmH7Ve_SgzmyJmxJS28CNORRJJfjI3rnI");
});

test("il primo passo: la chiave nella casa e nell'app, il centralino senza", () => {
  const come = comEMesso({ radice: finta(soloCasaEApp(DI_PROVA)) });
  assert.equal(come.stato, "senza-centralino", JSON.stringify(come, null, 2));
  assert.equal(come.chiave, DI_PROVA);
});

test("la chiave nel centralino e non nella casa: rotto", () => {
  /* Il centralino chiuderebbe fuori tutte le case, perche' nessuna gli
   * direbbe una licenza che lui sappia leggere. */
  const chiavi = I_FILE_DELLA_CHIAVE.map((nome) =>
    nome.startsWith("centralino/") ? DI_PROVA : "",
  );
  const come = comEMesso({ radice: finta(chiavi) });
  assert.equal(come.stato, "rotto");
});

test("la chiave nella casa ma non nell'app: rotto", () => {
  const chiavi = I_FILE_DELLA_CHIAVE.map((nome) => (nome.startsWith("ponte/") ? DI_PROVA : ""));
  const come = comEMesso({ radice: finta(chiavi) });
  assert.equal(come.stato, "rotto");
});

test("il primo passo con due chiavi diverse: rotto", () => {
  const chiavi = I_FILE_DELLA_CHIAVE.map((nome) =>
    nome.startsWith("ponte/") ? DI_PROVA : nome.startsWith("app/") ? "unAltraChiave" : "",
  );
  const come = comEMesso({ radice: finta(chiavi) });
  assert.equal(come.stato, "rotto");
});

test("--fallo a interruttore spento non fabbrica una coppia qui", () => {
  /* La privata stamperebbe su questo schermo: il suo posto e' solo la
   * macchina del quadro. Si prova sul programma vero, ma in una copia di
   * passaggio spenta, e **mai su questa repository**: il giorno del primo
   * passo, qui `--fallo` accenderebbe davvero il centralino, e rifarebbe
   * tutte le prove dentro questa. */
  const copia = copiaSpenta();
  const prima = I_FILE_DELLA_CHIAVE.map((nome) => readFileSync(join(copia, nome), "utf8"));
  const qui = I_FILE_DELLA_CHIAVE.map((nome) => readFileSync(join(RADICE, nome), "utf8"));
  let detto = "";
  let uscita = 0;
  try {
    execFileSync("node", ["strumenti/accendi-gli-acquisti.mjs", "--fallo"], {
      cwd: copia,
      encoding: "utf8",
      stdio: "pipe",
    });
  } catch (errore) {
    uscita = errore.status;
    detto = String(errore.stderr);
  }
  const dopo = I_FILE_DELLA_CHIAVE.map((nome) => readFileSync(join(copia, nome), "utf8"));
  assert.deepEqual(dopo, prima);
  assert.equal(uscita, 1);
  assert.match(detto, /--senza-centralino --pubblica/);
  assert.doesNotMatch(detto, /QUADRO_LICENZE_CHIAVE=/);
  assert.deepEqual(
    I_FILE_DELLA_CHIAVE.map((nome) => readFileSync(join(RADICE, nome), "utf8")),
    qui,
    "questa repository non si tocca",
  );
});

test("un file che non la pensa come gli altri: rotto, e si dice quale", () => {
  const chiavi = I_FILE_DELLA_CHIAVE.map((_, i) => (i === 2 ? "" : "unaChiaveQualunque"));
  const come = comEMesso({ radice: finta(chiavi) });
  assert.equal(come.stato, "rotto");
  assert.match(come.perche, /stessa chiave/);
  const vuoto = come.dentro.find((uno) => uno.chiave === "");
  assert.equal(vuoto.file, I_FILE_DELLA_CHIAVE[2]);
});

test("un file che non c'e' e' rotto, non spento", () => {
  /* Vuoto e mancante non sono la stessa cosa: «non c'e' la chiave» e «non c'e'
   * il file» si riparano in due modi diversi. */
  const come = comEMesso({
    radice: finta(""),
    file: [...I_FILE_DELLA_CHIAVE, "ponte/src/non-esiste.js"],
  });
  assert.equal(come.stato, "rotto");
  assert.match(come.perche, /non c'e'/);
});

test("la chiave si legge tutte e due le lingue in cui e' scritta", () => {
  assert.equal(laChiaveIn('export const CHIAVE_PUBBLICA_LICENZE = "abc";'), "abc");
  assert.equal(laChiaveIn("const chiavePubblicaLicenze = 'abc';"), "abc");
  assert.equal(laChiaveIn('export const CHIAVE_PUBBLICA_LICENZE = "";'), "");
  assert.equal(laChiaveIn("qui non c'e' niente"), null);
});

test("i file che guarda sono quelli che la chiave ce l'hanno davvero", () => {
  /* Se domani un pezzo nuovo tenesse la chiave e qui non fosse nominato,
   * resterebbe indietro senza che nessuno lo sappia: un pezzo che non
   * verifica, in mezzo a quelli che verificano. */
  const strumento = readFileSync(join(RADICE, "strumenti", "chiave-licenze.mjs"), "utf8");
  for (const nome of I_FILE_DELLA_CHIAVE) assert.ok(strumento.includes(nome), nome);

  /* E al contrario, che e' il verso che fa danno: un file a cui
   * `chiave-licenze.mjs` scrive la chiave e che qui non si guarda resterebbe
   * fuori dal conto. Gli elenchi sono due e devono dire la stessa cosa. */
  const suoi = [...strumento.matchAll(/"((?:ponte|centralino|app)\/[^"]+\.(?:js|dart))"/g)].map(
    (uno) => uno[1],
  );
  assert.deepEqual(new Set(suoi), new Set(I_FILE_DELLA_CHIAVE), suoi.join(" · "));
});

test("i passi a mano sono in ordine, e il centralino e' l'ultimo", () => {
  /* E' l'ordine il contenuto: il centralino chiude il fuori casa, e va acceso
   * quando l'app che lo sa spiegare e' gia' nei negozi. */
  assert.ok(I_PASSI_A_MANO.length >= 5);
  const ultimo = I_PASSI_A_MANO.at(-1);
  assert.match(ultimo.che, /centralino/i);
  assert.match(ultimo.come, /aggiorna l'add-on/);
  assert.match(ultimo.come, /pronte_alla_licenza/);
  /* E i negozi stanno fra quelli di «prima»: una casa che diventa Base senza
   * un prodotto da comprare ha solo un lucchetto. */
  assert.equal(I_PASSI_A_MANO[0].quando, "prima");
  assert.match(I_PASSI_A_MANO[0].che, /negozi/i);
});
