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
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  I_FILE_DELLA_CHIAVE,
  I_PASSI_A_MANO,
  comEMesso,
  laBandierinaIn,
  laChiaveIn,
} from "../../strumenti/accendi-gli-acquisti.mjs";

const RADICE = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

/* Una copia di passaggio coi soli file della chiave, scritti come li scrive
 * `chiave-licenze.mjs`: la chiave, e la bandierina «prima l'iPhone». */
function finta(chiavi, soloIPhone = false) {
  const dove = mkdtempSync(join(tmpdir(), "acquisti-"));
  I_FILE_DELLA_CHIAVE.forEach((nome, i) => {
    const dentro = join(dove, nome);
    mkdirSync(dirname(dentro), { recursive: true });
    const valore = Array.isArray(chiavi) ? chiavi[i] : chiavi;
    const bandierina = Array.isArray(soloIPhone) ? soloIPhone[i] : soloIPhone;
    writeFileSync(
      dentro,
      nome.endsWith(".dart")
        ? `const chiavePubblicaLicenze = '${valore}';\nconst licenzeSoloSullIPhone = ${bandierina};\n`
        : `export const CHIAVE_PUBBLICA_LICENZE = "${valore}";\nexport const LICENZE_SOLO_SULL_IPHONE = ${bandierina};\n`,
    );
  });
  return dove;
}

/* Prima l'iPhone: la chiave nell'add-on e nell'app, non nel centralino e
 * nella nuvola. */
const DI_PROVA = "6P9sdqQtlHcmH7Ve_SgzmyJmxJS28CNORRJJfjI3rnI";
const soloCasaEApp = (x) =>
  I_FILE_DELLA_CHIAVE.map((nome) =>
    nome.startsWith("ponte/") || nome.startsWith("app/") ? x : "",
  );

test("chiamato senza chiedere niente, NON accende", () => {
  /* Gira il programma vero, su questa repository vera, e poi guarda che la
   * chiave sia ancora vuota dov'e' scritta. E' la prova che permette di
   * lasciarlo qui dentro. */
  const prima = I_FILE_DELLA_CHIAVE.map((nome) => readFileSync(join(RADICE, nome), "utf8"));
  const detto = execFileSync("node", ["strumenti/accendi-gli-acquisti.mjs"], {
    cwd: RADICE,
    encoding: "utf8",
  });
  const dopo = I_FILE_DELLA_CHIAVE.map((nome) => readFileSync(join(RADICE, nome), "utf8"));
  assert.deepEqual(dopo, prima, "ha toccato i file senza che nessuno glielo chiedesse");
  assert.match(detto, /SPENTO/);
});

test("oggi, in questa repository, l'interruttore e' spento", () => {
  /* Se un giorno questa diventa rossa, e' perche' qualcuno ha acceso gli
   * acquisti — e allora e' una notizia, non un guasto. */
  const come = comEMesso({ radice: RADICE });
  assert.equal(come.stato, "spento", JSON.stringify(come.dentro, null, 2));
  assert.equal(come.chiave, "");
});

test("tutti d'accordo con una chiave vera: acceso", () => {
  const come = comEMesso({ radice: finta("6P9sdqQtlHcmH7Ve_SgzmyJmxJS28CNORRJJfjI3rnI") });
  assert.equal(come.stato, "acceso");
  assert.equal(come.chiave, "6P9sdqQtlHcmH7Ve_SgzmyJmxJS28CNORRJJfjI3rnI");
});

test("prima l'iPhone: la chiave nella casa e nell'app, la bandierina dappertutto", () => {
  const come = comEMesso({ radice: finta(soloCasaEApp(DI_PROVA), true) });
  assert.equal(come.stato, "solo-iphone", JSON.stringify(come, null, 2));
  assert.equal(come.chiave, DI_PROVA);
});

test("prima l'iPhone con la chiave nel centralino: rotto", () => {
  /* Il centralino con la chiave chiuderebbe fuori da casa i telefoni delle
   * case Base, Android compresi: proprio quello che «solo iPhone» non vuole. */
  const come = comEMesso({ radice: finta(DI_PROVA, true) });
  assert.equal(come.stato, "rotto");
  assert.match(come.perche, /centralino/);
});

test("la bandierina accesa a meta': rotto", () => {
  const bandierine = I_FILE_DELLA_CHIAVE.map((nome) => nome.startsWith("app/"));
  const come = comEMesso({ radice: finta(soloCasaEApp(DI_PROVA), bandierine) });
  assert.equal(come.stato, "rotto");
  assert.match(come.perche, /bandierina/);
});

test("la chiave solo nella casa e nell'app, ma senza bandierina: rotto", () => {
  /* E' l'errore di chi scrive la chiave a mano: la casa si limiterebbe per
   * tutti mentre il centralino lascia passare. */
  const come = comEMesso({ radice: finta(soloCasaEApp(DI_PROVA), false) });
  assert.equal(come.stato, "rotto");
});

test("la bandierina si legge nelle due lingue, e dove non c'e' e' spenta", () => {
  assert.equal(laBandierinaIn("export const LICENZE_SOLO_SULL_IPHONE = true;"), true);
  assert.equal(laBandierinaIn("const licenzeSoloSullIPhone = false;"), false);
  assert.equal(laBandierinaIn('export const CHIAVE_PUBBLICA_LICENZE = "";'), false);
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
  const suoi = [
    ...strumento.matchAll(/"((?:ponte|centralino|nuvola|app)\/[^"]+\.(?:js|dart))"/g),
  ].map((uno) => uno[1]);
  assert.deepEqual(new Set(suoi), new Set(I_FILE_DELLA_CHIAVE), suoi.join(" · "));
});

test("i passi a mano sono in ordine, e il centralino e' l'ultimo", () => {
  /* E' l'ordine il contenuto: il centralino prima del rilascio chiude fuori
   * ogni casa con l'add-on vecchio, pagante o no. */
  assert.ok(I_PASSI_A_MANO.length >= 5);
  const ultimo = I_PASSI_A_MANO.at(-1);
  assert.match(ultimo.che, /centralino/i);
  assert.match(ultimo.come, /pronte_alla_licenza/);
  /* E i negozi stanno fra quelli di «prima»: una casa che diventa Base senza
   * un prodotto da comprare ha solo un lucchetto. */
  assert.equal(I_PASSI_A_MANO[0].quando, "prima");
  assert.match(I_PASSI_A_MANO[0].che, /negozi/i);
});
