/* I precarichi morti: quelli che la pagina chiede e non apre.
 *
 * Quello che queste prove tengono fermo e' una cosa sola, e non e' un numero:
 * **la pagina esegue esattamente quello che eseguiva prima**. Un
 * `modulepreload` e' un consiglio, e togliere un consiglio non cambia il
 * programma; ma per non cambiare nemmeno i tempi, i consigli che contano —
 * quelli del grafo — devono restare tutti, e nell'ordine in cui stavano.
 *
 * Il resto sono le vie di fuga: quando non si capisce la pagina, la pagina
 * passa com'e'.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

import { iPrecarichi, senzaIPrecarichiMorti } from "../src/precarichi.js";
import { laPagina } from "../src/marchio.js";
import { Plancia } from "../src/plancia.js";

/* Una plancia finta, in memoria: la pagina, il modulo di partenza, e i moduli.
 * Cosi' si prova senza un disco, e si vede quello che conta. */
function unaCasa(moduli) {
  return (dove) => {
    const chiave = dove.split("/plancia/")[1];
    if (!(chiave in moduli)) throw new Error(`non c'e': ${dove}`);
    return moduli[chiave];
  };
}

function unaPagina(precarichi, partenza = "./modules-entry.js") {
  return [
    "<!doctype html><html><head>",
    ...precarichi.map((quale) => `<link rel="modulepreload" href="${quale}">`),
    `<script type="module" src="${partenza}"></script>`,
    "</head><body></body></html>",
  ].join("\n");
}

const dieciCheServono = Object.fromEntries(
  Array.from({ length: 10 }, (_, i) => [`src/serve${i}.js`, ""]),
);
const dieciImport = Array.from({ length: 10 }, (_, i) => `import "../src/serve${i}.js";`).join(
  "\n",
);

test("il precarico di un modulo che nessuno importa non si serve", () => {
  const pagina = unaPagina(["../src/serve0.js", "../src/nessuno.js"]);
  const fatto = senzaIPrecarichiMorti(pagina, {
    cartella: "/plancia",
    relativo: "legacy/dashboard.html",
    legge: unaCasa({
      "legacy/modules-entry.js": 'import "../src/serve0.js";\n' + dieciImport,
      ...dieciCheServono,
    }),
  });
  assert.deepEqual(iPrecarichi(fatto), ["../src/serve0.js"]);
  assert.ok(!fatto.includes("nessuno.js"));
});

test("quello che serve resta, e nell'ordine in cui stava", () => {
  const dieci = Array.from({ length: 10 }, (_, i) => `../src/serve${i}.js`);
  const pagina = unaPagina([...dieci, "../src/nessuno.js"]);
  const fatto = senzaIPrecarichiMorti(pagina, {
    cartella: "/plancia",
    relativo: "legacy/dashboard.html",
    legge: unaCasa({ "legacy/modules-entry.js": dieciImport, ...dieciCheServono }),
  });
  assert.deepEqual(iPrecarichi(fatto), dieci);
});

test("un import su piu' righe conta come un import", () => {
  /* E' il caso di `modules-entry.js`, che comincia con un import di quindici
   * nomi su diciotto righe. Contarlo male voleva dire buttare il precarico di
   * un modulo che la pagina apre subito. */
  const moduli = {
    "legacy/modules-entry.js": [
      "import {",
      "  uno,",
      "  due,",
      '} from "../src/aPiuRighe.js";',
      dieciImport,
    ].join("\n"),
    "src/aPiuRighe.js": "",
    ...dieciCheServono,
  };
  const fatto = senzaIPrecarichiMorti(unaPagina(["../src/aPiuRighe.js", "../src/no.js"]), {
    cartella: "/plancia",
    relativo: "legacy/dashboard.html",
    legge: unaCasa(moduli),
  });
  assert.deepEqual(iPrecarichi(fatto), ["../src/aPiuRighe.js"]);
});

test("un import chiesto a mano, e un `export … from`, contano", () => {
  const moduli = {
    "legacy/modules-entry.js": [
      'const quando = () => import("../src/quando.js");',
      'export { qualcosa } from "../src/passaggio.js";',
      dieciImport,
    ].join("\n"),
    "src/quando.js": "",
    "src/passaggio.js": "",
    ...dieciCheServono,
  };
  const fatto = senzaIPrecarichiMorti(
    unaPagina(["../src/quando.js", "../src/passaggio.js", "../src/no.js"]),
    { cartella: "/plancia", relativo: "legacy/dashboard.html", legge: unaCasa(moduli) },
  );
  assert.deepEqual(iPrecarichi(fatto), ["../src/quando.js", "../src/passaggio.js"]);
});

test("il grafo si cammina fino in fondo, non solo il primo giro", () => {
  const moduli = {
    "legacy/modules-entry.js": 'import "../src/uno.js";\n' + dieciImport,
    "src/uno.js": 'import "./due.js";',
    "src/due.js": 'import "./tre.js";',
    "src/tre.js": "",
    ...dieciCheServono,
  };
  const fatto = senzaIPrecarichiMorti(
    unaPagina(["../src/uno.js", "../src/due.js", "../src/tre.js"]),
    {
      cartella: "/plancia",
      relativo: "legacy/dashboard.html",
      legge: unaCasa(moduli),
    },
  );
  assert.deepEqual(iPrecarichi(fatto), ["../src/uno.js", "../src/due.js", "../src/tre.js"]);
});

test("un anello fra due moduli non ferma nessuno", () => {
  const moduli = {
    "legacy/modules-entry.js": 'import "../src/qua.js";\n' + dieciImport,
    "src/qua.js": 'import "./la.js";',
    "src/la.js": 'import "./qua.js";',
    ...dieciCheServono,
  };
  const fatto = senzaIPrecarichiMorti(unaPagina(["../src/qua.js", "../src/la.js"]), {
    cartella: "/plancia",
    relativo: "legacy/dashboard.html",
    legge: unaCasa(moduli),
  });
  assert.deepEqual(iPrecarichi(fatto), ["../src/qua.js", "../src/la.js"]);
});

test("un modulo importato che non si legge tiene il suo precarico", () => {
  /* Non sapere com'e' fatto un modulo non e' una ragione per non
   * precaricarlo: e' una ragione in piu' per lasciarlo dov'e'. */
  const fatto = senzaIPrecarichiMorti(unaPagina(["../src/misterioso.js", "../src/no.js"]), {
    cartella: "/plancia",
    relativo: "legacy/dashboard.html",
    legge: unaCasa({
      "legacy/modules-entry.js": 'import "../src/misterioso.js";\n' + dieciImport,
      ...dieciCheServono,
    }),
  });
  assert.deepEqual(iPrecarichi(fatto), ["../src/misterioso.js"]);
});

test("un percorso citato in una spiegazione non e' un import", () => {
  const moduli = {
    "legacy/modules-entry.js": [
      '/* Quello che si vede sta in "../src/soloDetto.js", e non si importa. */',
      dieciImport,
    ].join("\n"),
    ...dieciCheServono,
  };
  const fatto = senzaIPrecarichiMorti(unaPagina(["../src/soloDetto.js"]), {
    cartella: "/plancia",
    relativo: "legacy/dashboard.html",
    legge: unaCasa(moduli),
  });
  assert.deepEqual(iPrecarichi(fatto), []);
});

/* ─── Le vie di fuga: quando non si capisce, non si tocca ─────────────────── */

test("una pagina che non dice da quale modulo parte passa com'e'", () => {
  const pagina = unaPagina(["../src/uno.js"]).replace(/<script[^>]*><\/script>/, "");
  assert.equal(
    senzaIPrecarichiMorti(pagina, {
      cartella: "/plancia",
      relativo: "legacy/dashboard.html",
      legge: unaCasa({}),
    }),
    pagina,
  );
});

test("un grafo troppo piccolo vuol dire che non l'abbiamo letto: non si pota", () => {
  /* Otto moduli piu' quello di partenza: nove, uno sotto la soglia. Con
   * `dashboard.html` ne vengono novantacinque; se un giorno ne venissero tre,
   * la ragione sarebbe che il modo di caricarli e' cambiato, non che la pagina
   * ne usa tre — e allora la si serve com'e'. */
  const otto = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`src/p${i}.js`, ""]));
  const pagina = unaPagina([
    ...Array.from({ length: 8 }, (_, i) => `../src/p${i}.js`),
    "../src/no.js",
  ]);
  const fatto = senzaIPrecarichiMorti(pagina, {
    cartella: "/plancia",
    relativo: "legacy/dashboard.html",
    legge: unaCasa({
      "legacy/modules-entry.js": Array.from(
        { length: 8 },
        (_, i) => `import "../src/p${i}.js";`,
      ).join("\n"),
      ...otto,
    }),
  });
  assert.equal(fatto, pagina);
});

test("il modulo di partenza che non si legge lascia la pagina com'e'", () => {
  const pagina = unaPagina(["../src/uno.js", "../src/due.js"]);
  assert.equal(
    senzaIPrecarichiMorti(pagina, {
      cartella: "/plancia",
      relativo: "legacy/dashboard.html",
      legge: unaCasa({}),
    }),
    pagina,
  );
});

test("un precarico che esce dalla cartella della plancia non si tocca", () => {
  const pagina = unaPagina(["../../fuori.js", "https://altrove.example/x.js", "../src/no.js"]);
  const fatto = senzaIPrecarichiMorti(pagina, {
    cartella: "/plancia",
    relativo: "legacy/dashboard.html",
    legge: unaCasa({ "legacy/modules-entry.js": dieciImport, ...dieciCheServono }),
  });
  assert.deepEqual(iPrecarichi(fatto), ["../../fuori.js", "https://altrove.example/x.js"]);
});

test("senza cartella o senza pagina non si pota niente", () => {
  const pagina = unaPagina(["../src/uno.js"]);
  assert.equal(senzaIPrecarichiMorti(pagina, {}), pagina);
  assert.equal(senzaIPrecarichiMorti(pagina, { cartella: "/plancia" }), pagina);
  assert.equal(senzaIPrecarichiMorti(pagina, { relativo: "legacy/dashboard.html" }), pagina);
});

/* ─── E la plancia vera ───────────────────────────────────────────────────── */

test("la plancia vera: la pagina servita ha solo i precarichi del suo grafo", (t) => {
  const plancia = new Plancia();
  if (!plancia.cE) return t.skip("senza plancia non c'e' niente da potare");

  for (const variante of plancia.varianti()) {
    const servita = plancia.leggi(`${plancia.base}/legacy/${variante}`);
    assert.equal(servita.stato, 200, variante);
    const dopo = iPrecarichi(servita.corpo.toString("utf8"));
    const prima = iPrecarichi(
      laPagina(readFileSync(`${plancia.cartella}/legacy/${variante}`, "utf8")),
    );

    /* Che ne siano stati tolti tanti e' il punto di tutto il lavoro. */
    assert.ok(prima.length > 300, `${variante}: prima ce n'erano ${prima.length}`);
    assert.ok(dopo.length < 150, `${variante}: dopo ce ne sono ${dopo.length}`);

    /* Quelli rimasti sono gli stessi, nello stesso ordine: potare vuol dire
     * togliere righe, non riscriverle. */
    assert.deepEqual(
      dopo,
      prima.filter((quale) => dopo.includes(quale)),
      variante,
    );
  }
});

test("la plancia vera: fuori dai precarichi la pagina non cambia di un byte", (t) => {
  const plancia = new Plancia();
  if (!plancia.cE) return t.skip("senza plancia non c'e' niente da potare");
  const senzaPrecarichi = (testo) =>
    testo.replace(/[ \t]*<link\b[^>]*\brel="modulepreload"[^>]*>[ \t]*\r?\n?/gi, "");

  for (const variante of plancia.varianti()) {
    const servita = plancia.leggi(`${plancia.base}/legacy/${variante}`).corpo.toString("utf8");
    const vestita = laPagina(readFileSync(`${plancia.cartella}/legacy/${variante}`, "utf8"));
    assert.equal(senzaPrecarichi(servita), senzaPrecarichi(vestita), variante);
  }
});

test("la plancia vera: nessun modulo del grafo e' rimasto senza precarico", (t) => {
  /* La prova che tiene ferma la promessa. Il grafo si cammina qui una seconda
   * volta, con un occhio diverso — si guarda ogni file di `src/` e `legacy/` e
   * si chiede chi lo importa — e quello che ne viene deve stare tutto fra i
   * precarichi rimasti. Se un giorno la plancia caricasse i moduli in un altro
   * modo, questa prova lo direbbe prima di una casa vera. */
  const plancia = new Plancia();
  if (!plancia.cE) return t.skip("senza plancia non c'e' niente da potare");
  const radice = plancia.cartella;
  const dentro = new Set();
  const coda = [resolve(radice, "legacy/modules-entry.js")];
  while (coda.length > 0 && dentro.size < 3000) {
    const qui = coda.shift();
    if (dentro.has(qui)) continue;
    dentro.add(qui);
    let testo;
    try {
      testo = readFileSync(qui, "utf8");
    } catch (_errore) {
      continue;
    }
    const codice = testo.replace(/\/\*[\s\S]*?\*\//g, " ");
    for (const trovato of codice.matchAll(/\bfrom\s*["'](\.[^"']+)["']/g)) {
      coda.push(resolve(dirname(qui), trovato[1]));
    }
    for (const trovato of codice.matchAll(/(?:^|[\n;])\s*import\s*["'](\.[^"']+)["']/g)) {
      coda.push(resolve(dirname(qui), trovato[1]));
    }
  }

  const servita = plancia.leggi(`${plancia.base}/legacy/dashboard.html`).corpo.toString("utf8");
  const rimasti = new Set(iPrecarichi(servita).map((quale) => resolve(radice, "legacy", quale)));
  const entrata = resolve(radice, "legacy/modules-entry.js");
  const senzaPrecarico = [...dentro].filter((quale) => quale !== entrata && !rimasti.has(quale));
  assert.deepEqual(
    senzaPrecarico.map((quale) => relative(radice, quale)),
    [],
    "questi moduli la pagina li importa e non li precarica piu'",
  );
});
