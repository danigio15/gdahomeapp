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

import { laChiaveIn } from "../../strumenti/accendi-gli-acquisti.mjs";

const QUI = dirname(fileURLToPath(import.meta.url));
const CENTRALINO = join(QUI, "..", "src");
const PONTE = join(QUI, "..", "..", "ponte", "src");

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
 * in un modo: al primo passo sta nell'add-on e il centralino e' senza
 * (`strumenti/accendi-gli-acquisti.mjs`, «senza-centralino»). Tutto il
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
  /* Vuota si', finche' non tocca al centralino (il primo passo,
   * `docs/ACCENDERE-GLI-ACQUISTI.md`); un'altra chiave mai. */
  assert.ok(
    sua === quella || sua === "",
    `la chiave ${dove} non e' quella del ponte, e non e' vuota`,
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

test("il centralino puo' restare senza la chiave della casa, ma non averne un'altra", () => {
  const delPonte = (chiave) => `export const CHIAVE_PUBBLICA_LICENZE = "${chiave}";\n`;
  const x = "6P9sdqQtlHcmH7Ve_SgzmyJmxJS28CNORRJJfjI3rnI";
  /* Il primo passo: la casa con la chiave, il centralino senza. */
  laChiaveCome(delPonte(""), delPonte(x), "di prova");
  /* Tutti e due: la stessa. */
  laChiaveCome(delPonte(x), delPonte(x), "di prova");
  /* Una chiave diversa non va mai. */
  assert.throws(() => laChiaveCome(delPonte("un'altra"), delPonte(x), "di prova"));
  /* E il centralino con una chiave che la casa non ha chiuderebbe fuori
   * tutte le case: nessuna gli direbbe una licenza. */
  assert.throws(() => laChiaveCome(delPonte(x), delPonte(""), "di prova"));
});
