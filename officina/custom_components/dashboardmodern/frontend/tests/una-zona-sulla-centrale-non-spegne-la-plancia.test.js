/* Una zona scritta sulla centrale non spegne la plancia (1.9.2).
 *
 * «Dopo le azioni rapide non compare più niente», su tante case, dentro Home
 * Assistant e nell'app. Nella 1.9.0 la pastiglia della ZONA leggeva `escluso`,
 * che esiste solo in quella dell'ingresso: con una zona dichiarata sulla
 * centrale la fila si fermava con un ReferenceError. La pagina Sicurezza si
 * disegna mentre il suo modulo si carica, e un errore a quel punto ferma tutta
 * la parte a moduli: restavano la testata, il meteo e le azioni rapide.
 *
 * Nella casa demo le zone non ci sono, e sulla macchina delle prove i moduli
 * arrivano prima degli stati di Home Assistant: per questo era tutto verde.
 * Qui si prova la fila con una zona vera, e poi la regola che impedisce a un
 * pezzo solo di portarsi dietro tutti gli altri.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { riquadroDelleZone } from "../src/sections/security-showcase-section.js";
import { senzaCadere } from "../src/sections/shared.js";

const QUI = dirname(fileURLToPath(import.meta.url));
const SRC = join(QUI, "..", "src");

const PAROLE = {
  zoneTitolo: "Zone e ingressi",
  zone: "Zone",
  ingressi: "Ingressi",
  zoneSommario: () => "1 attiva",
  ingressiSommario: () => "1 chiuso",
};

/* Le pastiglie una per una, col nome che portano. */
function pastiglie(html) {
  return html
    .split('<span class="dm-sec-zona"')
    .slice(1)
    .map((pezzo) => ({ nome: (pezzo.match(/<b>([^<]*)<\/b>/) || [])[1] || "", html: pezzo }));
}

test("una zona sulla centrale si disegna, e il lucchetto sta sull'ingresso escluso", () => {
  const html = riquadroDelleZone(
    [{ entity: "binary_sensor.salotto_movimento", name: "Salotto", stato: "attivo", glifo: "" }],
    [
      { entity: "binary_sensor.finestra_bagno", name: "Finestra bagno", stato: "chiuso", escluso: "escluso", glifo: "" },
      { entity: "binary_sensor.portone", name: "Portone", stato: "chiuso", escluso: "", glifo: "" },
    ],
    PAROLE,
  );
  const perNome = Object.fromEntries(pastiglie(html).map((p) => [p.nome, p.html]));
  assert.deepEqual(Object.keys(perNome).sort(), ["Finestra bagno", "Portone", "Salotto"]);
  /* Una zona della Presenza non si esclude: il lucchetto non ce l'ha. */
  assert.doesNotMatch(perNome.Salotto, /dm-sec-zona-esclusa/);
  assert.match(perNome["Finestra bagno"], /dm-sec-zona-esclusa/);
  assert.doesNotMatch(perNome.Portone, /dm-sec-zona-esclusa/);
});

test("senzaCadere: chi cade lo dice, e chi viene dopo parte lo stesso", (t) => {
  const detti = [];
  t.mock.method(console, "error", (...parole) => detti.push(parole));
  const prima = globalThis.__DASHBOARDMODERN_PEZZI_CADUTI__;
  delete globalThis.__DASHBOARDMODERN_PEZZI_CADUTI__;
  try {
    function installCheCade() {
      throw new ReferenceError("escluso is not defined");
    }
    let dopo = false;
    assert.equal(senzaCadere(installCheCade), undefined);
    assert.equal(
      senzaCadere(() => {
        dopo = true;
        return "fatto";
      }, "installDopo"),
      "fatto",
    );
    assert.equal(dopo, true);
    assert.deepEqual(globalThis.__DASHBOARDMODERN_PEZZI_CADUTI__, [
      { pezzo: "installCheCade", errore: "escluso is not defined" },
    ]);
    assert.equal(detti.length, 1);
    assert.match(String(detti[0][0]), /installCheCade non e' partito/);
  } finally {
    if (prima === undefined) delete globalThis.__DASHBOARDMODERN_PEZZI_CADUTI__;
    else globalThis.__DASHBOARDMODERN_PEZZI_CADUTI__ = prima;
  }
});

test("la sequenza dell'avvio accende ogni pezzo con senzaCadere", () => {
  const runtime = readFileSync(join(SRC, "sections", "section-runtime.js"), "utf8");
  const inizio = runtime.indexOf("export function installSectionRuntime() {");
  const fine = runtime.indexOf("root[RUNTIME_KEY] = Object.freeze({", inizio);
  assert.ok(inizio > 0 && fine > inizio, "la sequenza non si trova piu'");
  const sequenza = runtime.slice(inizio, fine);
  const passi = sequenza.match(/senzaCadere\(install[A-Za-z0-9]*\);/g) || [];
  assert.ok(passi.length > 150, `mi aspettavo un centinaio e mezzo di passi, ne ho contati ${passi.length}`);
  /* Quella con gli argomenti passa da una freccia: `senzaCadere(() =>` e, a
   * capo, la chiamata. */
  const righe = sequenza.split("\n");
  const scoperte = righe.filter(
    (riga, indice) => /^\s*install[A-Za-z0-9_]*\(/.test(riga) && !/=>\s*$/.test(righe[indice - 1] || ""),
  );
  assert.deepEqual(scoperte, [], "un'accensione fuori da senzaCadere ferma tutte quelle dopo di lei");
});

test("nessun modulo si accende scoperto mentre si carica", () => {
  /* Un modulo che si accende in cima al file, o nell'else del readyState, lo
   * fa mentre si carica: se li' cade, cade l'import di tutta la plancia. */
  const scoperte = [];
  for (const cartella of ["sections", "core"]) {
    for (const nome of readdirSync(join(SRC, cartella))) {
      if (!nome.endsWith(".js")) continue;
      const righe = readFileSync(join(SRC, cartella, nome), "utf8").split("\n");
      righe.forEach((riga, indice) => {
        if (/^(?:\}\s*)?(?:else\s+)?install[A-Za-z0-9_]*\(\);?\s*$/.test(riga))
          scoperte.push(`${cartella}/${nome}:${indice + 1}`);
        if (/;\s*else\s+install[A-Za-z0-9_]*\(\);?\s*$/.test(riga)) scoperte.push(`${cartella}/${nome}:${indice + 1}`);
        if (/^ {2}install[A-Za-z0-9_]*\(\);\s*$/.test(riga) && /^\} else \{\s*$/.test(righe[indice - 1] || ""))
          scoperte.push(`${cartella}/${nome}:${indice + 1}`);
      });
    }
  }
  assert.deepEqual(scoperte, []);
});
