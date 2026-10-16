/* La scheda Runtime del config dice la versione di gdahome.
 *
 * «Aggiorna anche i dati nel runtime che sono vecchi e non allineati: devono
 * essere sempre allineati ad ogni aggiornamento.» Diceva 1.4.32 — il numero
 * della vecchia plancia — con gdahome alla 1.13. Il file lo riscrive il
 * sigillo della plancia; questa prova ferma le Prove se un aggiornamento
 * cambia il numero e il sigillo non si rifa'. */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

const qui = (via) => new URL(via, import.meta.url);

test("le versioni della plancia sono quelle dell'add-on, anche nel pacchetto servito", () => {
  const versione = readFileSync(qui("../config.yaml"), "utf8").match(/^version:\s*"([^"]+)"/m)[1];
  const info = readFileSync(qui("../plancia/legacy/build-info.js"), "utf8");
  assert.match(info, new RegExp(`"integrationVersion":"${versione.replace(/\./g, "\\.")}"`));
  assert.match(info, new RegExp(`"dashboardVersion":"${versione.replace(/\./g, "\\.")}"`));
  /* Il ponte serve il pacchetto, non i sorgenti: anche li' dentro. */
  const pacco = readdirSync(qui("../plancia/pacco/"))
    .filter((nome) => nome.endsWith(".js"))
    .map((nome) => readFileSync(qui(`../plancia/pacco/${nome}`), "utf8"))
    .join("\n");
  assert.ok(
    pacco.includes(`"integrationVersion": "${versione}"`),
    "il pacchetto dice un'altra versione",
  );
});
