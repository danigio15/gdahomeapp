/* La pubblica di prova non finisce mai nei file veri.
 *
 * La coppia di prova sta scritta in `docs/LICENZE.md`, privata compresa: serve
 * alle prove. Se per sbaglio la sua pubblica andasse nei file con
 * `strumenti/chiave-licenze.mjs`, chiunque abbia letto i documenti
 * firmerebbe da se' gettoni Premium che non si possono togliere. Lo strumento
 * la rifiuta, e una chiave vera passa come prima.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { PUBBLICA_DI_PROVA } from "./gettoni-di-prova.js";

const STRUMENTO = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "strumenti",
  "chiave-licenze.mjs",
);

function scrivi(pubblica) {
  const radice = mkdtempSync(join(tmpdir(), "chiave-di-prova-"));
  const esito = spawnSync(
    process.execPath,
    [STRUMENTO, "--senza-centralino", "--pubblica", pubblica, "--radice", radice],
    { encoding: "utf8" },
  );
  return { radice, esito };
}

test("lo strumento della chiave rifiuta la pubblica di prova, e non scrive niente", () => {
  const { radice, esito } = scrivi(PUBBLICA_DI_PROVA);
  try {
    assert.equal(esito.status, 1);
    assert.match(esito.stderr, /pubblica di prova/);
    assert.deepEqual(readdirSync(radice), []);
  } finally {
    rmSync(radice, { recursive: true, force: true });
  }
});

test("una pubblica vera passa, e va nella casa e nell'app", () => {
  const vera = generateKeyPairSync("ed25519").publicKey.export({ format: "jwk" }).x;
  const { radice, esito } = scrivi(vera);
  try {
    assert.equal(esito.status, 0, esito.stderr);
    assert.ok(existsSync(join(radice, "ponte", "src", "chiave-licenze.js")));
    assert.ok(existsSync(join(radice, "app", "lib", "licenza", "chiave.dart")));
  } finally {
    rmSync(radice, { recursive: true, force: true });
  }
});
