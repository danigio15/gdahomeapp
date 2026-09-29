/* Le copie prese dal ponte devono restare identiche.
 *
 * `presa.js`, `segreti.js`, `archivio.js` e `registro.js` sono copie di quelli
 * del ponte. Non sono una libreria condivisa perche' non possono esserlo: il
 * ponte e' un add-on, e un add-on si costruisce con la sua cartella come unico
 * contesto — non puo' importare niente che stia fuori da li'.
 *
 * Il rischio delle copie e' che divergano in silenzio: si corregge un difetto
 * da una parte e dall'altra resta. Questa prova fa in modo che non succeda in
 * silenzio, che e' la parte che conta.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { laBandierinaIn, laChiaveIn } from "../../strumenti/accendi-gli-acquisti.mjs";

const QUI = dirname(fileURLToPath(import.meta.url));
const CENTRALINO = join(QUI, "..", "src");
const PONTE = join(QUI, "..", "..", "ponte", "src");
const NUVOLA = join(QUI, "..", "..", "nuvola", "src");

/* `gettone.js` e `chiave-licenze.js` ci sono dal giorno delle licenze: il
 * gettone si verifica con le stesse regole dappertutto (`docs/LICENZE.md`), e
 * la chiave e' la stessa riga in tutti i posti — e' `strumenti/chiave-licenze.mjs`
 * a scriverla, e se un giorno ne scrivesse una sola il centralino
 * rifiuterebbe i gettoni che il ponte accetta. */
const COPIATI = [
  "presa.js",
  "segreti.js",
  "archivio.js",
  "registro.js",
  "testo.js",
  "gettone.js",
  "chiave-licenze.js",
];

/* La chiave delle licenze e' l'unica riga che puo' essere diversa, e solo
 * in un modo: prima dell'iPhone sta nell'add-on e il centralino e la nuvola
 * sono senza (`strumenti/accendi-gli-acquisti.mjs`, «solo iPhone»). Tutto il
 * resto del file e' identico sempre, e se la chiave c'e' da tutte e due le
 * parti e' la stessa. */
function laChiaveCome(copia, delPonte, dove) {
  const vuota = (testo) => testo.replace(/(CHIAVE_PUBBLICA_LICENZE\s*=\s*)"[^"]*"/, '$1""');
  assert.equal(
    vuota(copia),
    vuota(delPonte),
    `«chiave-licenze.js» ${dove} e' diverso da quello del ponte: si rifa' con\n` +
      "  node strumenti/chiave-licenze.mjs",
  );
  const sua = laChiaveIn(copia);
  const quella = laChiaveIn(delPonte);
  assert.ok(
    sua === quella || (sua === "" && laBandierinaIn(delPonte)),
    `la chiave ${dove} non e' quella del ponte, e non e' «prima l'iPhone»`,
  );
}

test("le copie prese dal ponte sono ancora identiche", () => {
  for (const nome of COPIATI) {
    if (nome === "chiave-licenze.js") {
      laChiaveCome(
        readFileSync(join(CENTRALINO, nome), "utf8"),
        readFileSync(join(PONTE, nome), "utf8"),
        "del centralino",
      );
      continue;
    }
    assert.equal(
      readFileSync(join(CENTRALINO, nome), "utf8"),
      readFileSync(join(PONTE, nome), "utf8"),
      `«${nome}» e' diverso da quello del ponte. Si riallineano cosi':\n` +
        `  cp ponte/src/{${COPIATI.map((uno) => uno.replace(".js", "")).join(",")}}.js centralino/src/`,
    );
  }
});

/* `segnalazioni.js` invece viene dalla nuvola, ed e' una copia per un motivo
 * diverso: la stessa cosa gira in due posti — il Worker e la macchina — finche'
 * le case non saranno passate tutte di qua. Due copie che divergono vorrebbero
 * dire due comportamenti diversi a seconda di dove una casa e' finita, che e'
 * il genere di differenza che non si trova mai guardando il codice di una
 * parte sola. */
const PRESI_DALLA_NUVOLA = ["segnalazioni.js", "versioni.js"];

test("le copie prese dalla nuvola sono ancora identiche", () => {
  for (const nome of PRESI_DALLA_NUVOLA) {
    assert.equal(
      readFileSync(join(CENTRALINO, nome), "utf8"),
      readFileSync(join(NUVOLA, nome), "utf8"),
      `\u00ab${nome}\u00bb e' diverso da quello della nuvola. Si riallinea cosi':\n` +
        `  cp nuvola/src/${nome} centralino/src/`,
    );
  }
});

/* E la nuvola, che il gettone lo verifica con le sue funzioni, ha la stessa
 * chiave: la riga e' una, in tre posti. */
test("la chiave delle licenze e' la stessa nella nuvola", () => {
  laChiaveCome(
    readFileSync(join(NUVOLA, "chiave-licenze.js"), "utf8"),
    readFileSync(join(PONTE, "chiave-licenze.js"), "utf8"),
    "della nuvola",
  );
});

test("prima dell'iPhone il centralino puo' restare senza chiave, e solo allora", () => {
  const delPonte = (chiave, soloIPhone) =>
    `export const CHIAVE_PUBBLICA_LICENZE = "${chiave}";\nexport const LICENZE_SOLO_SULL_IPHONE = ${soloIPhone};\n`;
  const x = "6P9sdqQtlHcmH7Ve_SgzmyJmxJS28CNORRJJfjI3rnI";
  /* Prima l'iPhone: la casa con la chiave, il centralino senza. */
  laChiaveCome(delPonte("", true), delPonte(x, true), "di prova");
  /* Per tutti: senza la chiave il centralino lascerebbe entrare chi non paga. */
  assert.throws(() => laChiaveCome(delPonte("", false), delPonte(x, false), "di prova"));
  /* E una chiave diversa non va mai. */
  assert.throws(() => laChiaveCome(delPonte("un'altra", true), delPonte(x, true), "di prova"));
});
