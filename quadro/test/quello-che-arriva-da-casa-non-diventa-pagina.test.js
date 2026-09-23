/* Quello che arriva da una casa non diventa un pezzo di pagina.
 *
 * Il rapporto lo scrive una macchina che non e' nostra, e finisce nella
 * pagina di chi installa e in quella di chi tiene il quadro. Prima si teneva
 * com'era arrivato, e le due pagine lo scrivevano dentro `innerHTML` fidandosi
 * che un numero fosse un numero: un rapporto con un pezzo di pagina al posto
 * di una cifra diventava pagina.
 *
 * Le difese sono due, e si provano tutte e due:
 *
 *  1. il server tiene la **forma** del rapporto (`forma-del-rapporto.js`):
 *     numeri che sono numeri, parole tagliate, elenchi col tetto, niente
 *     campi sconosciuti;
 *  2. nelle pagine, ogni cosa scritta dentro un pezzo di HTML passa da
 *     `testo()`, da `Number()`, o da una funzione che lo fa gia'. Questa si
 *     prova leggendo il sorgente: ogni `${…}` dentro un modello che contiene
 *     un tag viene guardato, e quello che non e' riconosciuto sicuro fa cadere
 *     la prova. Una riga nuova che scrive un valore cosi' com'e' si ferma qui.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { alzaIlQuadro } from "../src/index.js";
import { laFormaDel } from "../src/forma-del-rapporto.js";

const QUI = dirname(fileURLToPath(import.meta.url));
const CRUSCOTTO = readFileSync(join(QUI, "..", "console", "index.html"), "utf8");
const GESTIONE = readFileSync(join(QUI, "..", "gestore", "index.html"), "utf8");

const CHIAVE_DEL_GESTORE = "una-chiave-lunga-abbastanza-per-il-gestore";
const UNA = "casa_a3f19c74e05b2d8890fa4c1e6b73d052";
const VELENO = '<img src=x onerror="alert(1)">';

/* ─── Il server ───────────────────────────────────────────────────────── */

test("la forma del rapporto: numeri, parole tagliate, elenchi col tetto, niente di sconosciuto", () => {
  const detta = laFormaDel({
    ogni: VELENO,
    ha: "x".repeat(5000),
    telefoni: { abbinati: VELENO, visti7gg: "3", segreto: "via" },
    rete: {
      internet: "si'",
      schede: [{ nome: "eth0", segnale: VELENO, su: true }, "non un oggetto"],
      sorvegliate: { giu: { a: 1 }, quante: 2 },
    },
    addon: {
      quanti: VELENO,
      accesi: 3,
      elenco: Array.from({ length: 1000 }, () => ({ nome: "a" })),
    },
    macchina: "non un oggetto",
    plance: {
      elenco: [
        { profilo: '"><b>', titolo: "x" },
        { profilo: "primary", titolo: "Casa" },
      ],
    },
    aggiornamenti: { elenco: [{ nome: "A", a: "1", note: "javascript:alert(1)" }] },
    chissa: { cosa: 1 },
  });
  assert.equal(detta.ogni, null);
  assert.equal(detta.ha.length, 40);
  assert.deepEqual(detta.telefoni, { abbinati: null, visti7gg: 3 });
  assert.equal(detta.rete.internet, false);
  assert.deepEqual(detta.rete.schede, [{ nome: "eth0", segnale: null, su: true }]);
  assert.deepEqual(detta.rete.sorvegliate, { giu: null, quante: 2 });
  assert.equal(detta.addon.quanti, null);
  assert.equal(detta.addon.elenco.length, 200);
  assert.equal("macchina" in detta, false, "una struttura sbagliata resta fuori");
  assert.deepEqual(detta.plance.elenco, [{ profilo: "primary", titolo: "Casa" }]);
  assert.equal(detta.aggiornamenti.elenco[0].note, "");
  assert.equal("chissa" in detta, false, "un campo sconosciuto resta fuori");
});

test("un rapporto col veleno arriva alla console senza veleno", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "veleno-"));
  const acceso = await alzaIlQuadro({
    porta: 0,
    cartella,
    livello: "errore",
    chiaveDelGestore: CHIAVE_DEL_GESTORE,
  });
  const dove = `http://127.0.0.1:${acceso.porta}`;
  try {
    const io = await (
      await fetch(`${dove}/gestore/installatori`, {
        method: "POST",
        headers: { authorization: `Bearer ${CHIAVE_DEL_GESTORE}` },
        body: JSON.stringify({ nome: "Impianti Rossi" }),
      })
    ).json();
    const retro = (via, opzioni = {}) =>
      fetch(`${dove}/console${via}`, {
        ...opzioni,
        headers: { authorization: `Bearer ${io.chiave}`, ...(opzioni.headers || {}) },
      });
    const { codice } = await (await retro("/inviti", { method: "POST", body: "{}" })).json();
    const rapporto = await fetch(`${dove}/rapporto`, {
      method: "POST",
      headers: { authorization: `Bearer ${codice}`, "x-casa": UNA },
      body: JSON.stringify({
        quando: new Date().toISOString(),
        ogni: 1,
        telefoni: { abbinati: VELENO, visti7gg: VELENO },
        rete: {
          internet: true,
          schede: [{ nome: "wlan0", tipo: "wifi", su: true, segnale: VELENO }],
          sorvegliate: { giu: VELENO, quante: VELENO },
        },
        addon: { quanti: VELENO, accesi: VELENO, spentiCheDovrebbero: 0, elenco: [] },
        batterie: { scariche: VELENO, piuBassa: VELENO },
        macchina: { discoVita: VELENO, discoLiberi: VELENO },
        registro: { errori24h: VELENO },
        altro: VELENO,
      }),
    });
    assert.equal(rapporto.status, 200);
    const tutto = await (await retro("/case")).text();
    assert.ok(!tutto.includes("<img"), "nel cruscotto non arriva nessun pezzo di pagina");
    assert.ok(!tutto.includes("onerror"), "ne' un pezzo di un pezzo");
    const [casa] = JSON.parse(tutto).case;
    assert.equal(casa.carta.telefoni.abbinati, null);
    assert.equal(casa.carta.rete.schede[0].segnale, null);
    assert.equal(casa.carta.rete.sorvegliate.giu, null);
    assert.equal(casa.carta.addon.accesi, null);
    assert.equal("altro" in casa.carta, false);
    /* E lo stesso dalla gestione, che legge la stessa forma. */
    const dallaGestione = await (
      await fetch(`${dove}/gestore/installatore/${io.chi}/case`, {
        headers: { authorization: `Bearer ${CHIAVE_DEL_GESTORE}` },
      })
    ).text();
    assert.ok(!dallaGestione.includes("<img"));
  } finally {
    await acceso.spegni();
    rmSync(cartella, { recursive: true, force: true });
  }
});

/* ─── Le pagine ───────────────────────────────────────────────────────── */

/* Lo script della pagina: quello fra l'ultimo `<script>` e il suo `</script>`. */
function loScript(html) {
  const inizio = html.lastIndexOf("\n    <script>\n");
  const fine = html.indexOf("\n    </script>", inizio);
  assert.ok(inizio > 0 && fine > inizio, "lo script della pagina non si trova");
  return { testo: html.slice(inizio, fine), riga: html.slice(0, inizio).split("\n").length };
}

/* I modelli (`…`) di un pezzo di JavaScript, con le loro parti fisse e i loro
 * `${…}`. Un lettore piccolo e a buon mercato: stringhe, commenti, espressioni
 * regolari e modelli dentro modelli — quanto basta per queste due pagine. */
function iModelli(sorgente) {
  const modelli = [];
  /* I modelli aperti in questo momento: uno scritto dentro un altro e' nello
   * stesso posto della pagina, e se il primo e' HTML lo e' anche lui. */
  const aperti = [];
  let i = 0;
  let ultimo = "(";
  const puoEssereUnaRegola = () => /[(,=:[!&|?{};+\-*%<>~^]$|^$|return$|typeof$/.test(ultimo);

  function saltaStringa(quale) {
    i += 1;
    while (i < sorgente.length && sorgente[i] !== quale) {
      if (sorgente[i] === "\\") i += 1;
      i += 1;
    }
    i += 1;
  }
  function saltaRegola() {
    i += 1;
    let inClasse = false;
    while (i < sorgente.length) {
      const c = sorgente[i];
      if (c === "\\") i += 1;
      else if (c === "[") inClasse = true;
      else if (c === "]") inClasse = false;
      else if (c === "/" && !inClasse) break;
      i += 1;
    }
    i += 1;
    while (/[a-z]/i.test(sorgente[i] || "")) i += 1;
  }
  /* Da un `{` fino al `}` che lo chiude, leggendo quello che c'e' dentro. */
  function codice(finoA) {
    let profondo = 0;
    const da = i;
    while (i < sorgente.length) {
      const c = sorgente[i];
      const dopo = sorgente[i + 1];
      if (c === "/" && dopo === "/") {
        while (i < sorgente.length && sorgente[i] !== "\n") i += 1;
        continue;
      }
      if (c === "/" && dopo === "*") {
        i = sorgente.indexOf("*/", i + 2) + 2;
        continue;
      }
      if (c === '"' || c === "'") {
        saltaStringa(c);
        ultimo = "s";
        continue;
      }
      if (c === "`") {
        modello();
        ultimo = "s";
        continue;
      }
      if (c === "/" && puoEssereUnaRegola()) {
        saltaRegola();
        ultimo = "r";
        continue;
      }
      if (c === "{") profondo += 1;
      if (c === "}") {
        if (finoA && profondo === 0) return sorgente.slice(da, i);
        profondo -= 1;
      }
      if (!/\s/.test(c)) {
        if (/[A-Za-z0-9_$]/.test(c)) {
          let fine = i;
          while (/[A-Za-z0-9_$]/.test(sorgente[fine] || "")) fine += 1;
          ultimo = sorgente.slice(i, fine);
          i = fine;
          continue;
        }
        ultimo = c;
      }
      i += 1;
    }
    return sorgente.slice(da, i);
  }
  function modello() {
    const inizio = i;
    i += 1;
    const fisse = [];
    const dentro = [];
    const suo = { inizio, fisse, dentro, padre: aperti[aperti.length - 1] ?? null };
    aperti.push(suo);
    let pezzo = "";
    while (i < sorgente.length && sorgente[i] !== "`") {
      if (sorgente[i] === "\\") {
        pezzo += sorgente.slice(i, i + 2);
        i += 2;
        continue;
      }
      if (sorgente[i] === "$" && sorgente[i + 1] === "{") {
        fisse.push(pezzo);
        pezzo = "";
        i += 2;
        const da = i;
        const espressione = codice(true);
        dentro.push({ espressione: espressione.trim(), da });
        i += 1;
        continue;
      }
      pezzo += sorgente[i];
      i += 1;
    }
    fisse.push(pezzo);
    i += 1;
    aperti.pop();
    modelli.push(suo);
  }
  codice(false);
  return modelli;
}

/* Spezza un'espressione al primo livello: fuori da parentesi, stringhe e
 * modelli. */
function alPrimoLivello(espressione, segno) {
  const pezzi = [];
  let profondo = 0;
  let da = 0;
  for (let k = 0; k < espressione.length; k += 1) {
    const c = espressione[k];
    if ("([{".includes(c)) profondo += 1;
    else if (")]}".includes(c)) profondo -= 1;
    else if (
      profondo === 0 &&
      espressione.startsWith(segno, k) &&
      /* Il `?` di un ternario, non quello di `?.` o di `??`. */
      !(segno === "?" && (/[.?]/.test(espressione[k + 1] || "") || espressione[k - 1] === "?"))
    ) {
      pezzi.push(espressione.slice(da, k));
      da = k + segno.length;
      k += segno.length - 1;
    }
  }
  pezzi.push(espressione.slice(da));
  return pezzi.map((uno) => uno.trim());
}

/* Le stringhe e i modelli dentro un'espressione diventano segnaposti: i
 * modelli li guarda la prova per conto loro, e una stringa scritta nel
 * sorgente non viene da casa. */
function senzaLetterali(espressione) {
  let fuori = "";
  let k = 0;
  let profondoModello = 0;
  while (k < espressione.length) {
    const c = espressione[k];
    if (c === '"' || c === "'") {
      let j = k + 1;
      while (j < espressione.length && espressione[j] !== c) j += espressione[j] === "\\" ? 2 : 1;
      fuori += "S";
      k = j + 1;
      continue;
    }
    if (c === "`") {
      let j = k + 1;
      profondoModello = 0;
      while (j < espressione.length) {
        if (espressione[j] === "\\") j += 2;
        else if (espressione[j] === "$" && espressione[j + 1] === "{") {
          profondoModello += 1;
          j += 2;
        } else if (espressione[j] === "{" && profondoModello > 0) {
          profondoModello += 1;
          j += 1;
        } else if (espressione[j] === "}" && profondoModello > 0) {
          profondoModello -= 1;
          j += 1;
        } else if (espressione[j] === "`" && profondoModello === 0) break;
        else j += 1;
      }
      fuori += "T";
      k = j + 1;
      continue;
    }
    fuori += c;
    k += 1;
  }
  return fuori;
}

/**
 * Un'espressione e' sicura dentro un pezzo di HTML se ogni valore che puo'
 * uscirne e' sicuro: una stringa o un modello scritti nel sorgente, un
 * numero scritto nel sorgente, `testo(…)`, `Number(…)`, una chiamata a una
 * funzione che scrive gia' sicuro, un elenco di modelli (`.map(…).join(…)`),
 * o un nome dell'elenco di quelli che tengono HTML gia' fatto.
 */
/* Le parentesi di fuori, se sono davvero una coppia: `(a).b(c)` non lo e'. */
function senzaParentesi(e) {
  if (!e.startsWith("(") || !e.endsWith(")")) return e;
  let profondo = 0;
  for (let k = 0; k < e.length; k += 1) {
    if (e[k] === "(") profondo += 1;
    else if (e[k] === ")") profondo -= 1;
    if (profondo === 0 && k < e.length - 1) return e;
  }
  return e.slice(1, -1).trim();
}

/* Il segno che si scrive dentro un `${…}` quando quello che esce e' HTML
 * fatto qui, da pezzi gia' passati da `testo()`: e' una riga guardata a mano,
 * e il segno lo dice a chi legge dopo. */
const GIA_HTML = "/* già HTML */";

function sicura(espressione, { funzioni, pezziFatti }) {
  if (espressione.includes(GIA_HTML)) return true;
  const e = senzaLetterali(espressione.replace(/\/\*[\s\S]*?\*\//g, "")).trim();
  const ternario = alPrimoLivello(e, "?");
  if (ternario.length > 1) {
    /* `c ? a : b`: la condizione non si scrive, i due rami si'. */
    const rami = alPrimoLivello(ternario.slice(1).join("?"), ":");
    return rami.every((ramo) => sicura(ramo, { funzioni, pezziFatti }));
  }
  for (const segno of ["||", "??"]) {
    const pezzi = alPrimoLivello(e, segno);
    if (pezzi.length > 1) return pezzi.every((uno) => sicura(uno, { funzioni, pezziFatti }));
  }
  const eE = alPrimoLivello(e, "&&");
  if (eE.length > 1) return sicura(eE[eE.length - 1], { funzioni, pezziFatti });
  const pezzi = alPrimoLivello(e, "+");
  if (pezzi.length > 1) return pezzi.every((uno) => sicura(uno, { funzioni, pezziFatti }));
  const nudo = senzaParentesi(e);
  if (nudo !== e) return sicura(nudo, { funzioni, pezziFatti });
  if (/^(S|T|-?\d+(\.\d+)?)$/.test(nudo)) return true;
  /* Un confronto e' un si' o un no, e un si' o un no si scrive «true». */
  for (const segno of ["===", "!==", "<=", ">="]) {
    if (alPrimoLivello(nudo, segno).length > 1) return true;
  }
  if (/^!/.test(nudo)) return true;
  /* Un numero scritto con le sue cifre: `.toFixed(…)` torna solo cifre. */
  if (/\.toFixed\(\d\)$/.test(nudo)) return true;
  /* Una tabella della pagina — `LE_ICONE[…]`, `TINTA_DI[…]` — torna quello
   * che c'e' scritto nella pagina, o niente. */
  if (/^[A-Z][A-Z_]*\[[^\]]*\]$/.test(nudo)) return true;
  /* Una costante della pagina, e la lunghezza di un elenco: sono numeri o
   * parole scritte qui. */
  if (/^[A-Z][A-Z0-9_]*$/.test(nudo)) return true;
  if (/\.length$/.test(nudo)) return true;
  if (/^(testo|Number)\(/.test(nudo)) return true;
  if (/\.join\(S?\)$/.test(nudo)) return true;
  const chiamata = /^([A-Za-z_$][\w$]*)\(/.exec(nudo);
  if (chiamata && funzioni.has(chiamata[1])) return true;
  if (pezziFatti.has(nudo)) return true;
  return false;
}

function insicure(html, regole) {
  const { testo: script, riga } = loScript(html);
  const trovate = [];
  const eHtml = (modello) =>
    Boolean(modello) && (/<\/?[a-zA-Z]/.test(modello.fisse.join("")) || eHtml(modello.padre));
  for (const modello of iModelli(script)) {
    if (!eHtml(modello)) continue;
    for (const uno of modello.dentro) {
      if (sicura(uno.espressione, regole)) continue;
      trovate.push(
        `riga ${riga + script.slice(0, uno.da).split("\n").length - 1}: \${${uno.espressione}}`,
      );
    }
  }
  return trovate;
}

/* Le funzioni che tornano gia' testo sicuro, o HTML fatto di pezzi sicuri.
 * Ognuna e' nella pagina, e i suoi modelli li guarda questa stessa prova. */
const FUNZIONI_COMUNI = [
  "testo",
  "Number",
  "encodeURIComponent",
  "plurale",
  "daQuanto",
  "ilGiorno",
  "quantoResta",
  "anellino",
  "misura",
  "metro",
  "unaRiga",
  "ilTasto",
  "iNomiGiu",
  "iSegniDi",
  "gliAggiornamenti",
  "ilSegnoDi",
  "laStriscia",
  "laPastiglia",
  "ilMetro",
  "leRighe",
  "icona",
];

/* E quelle del cruscotto soltanto. `ilNomeDi` c'e' anche nella gestione, ma
 * li' torna il nome com'e': non vale per tutte e due. */
const FUNZIONI_DEL_CRUSCOTTO = [
  "ilNomeDi",
  "cosaCambia",
  "anello",
  "laFraseDellaFlotta",
  "lineaViva",
  "spia",
  "soloIGuai",
  "ilDettaglio",
  "comeVa",
  "gliAddon",
  "laMacchina",
  "laRete",
  "leAltreMacchine",
  "leVestiDellePlance",
  "ilSuoMarchio",
];

test("nel cruscotto ogni valore dentro un pezzo di HTML passa da testo()", () => {
  const trovate = insicure(CRUSCOTTO, {
    funzioni: new Set([...FUNZIONI_COMUNI, ...FUNZIONI_DEL_CRUSCOTTO]),
    pezziFatti: new Set([]),
  });
  assert.deepEqual(trovate, [], `queste righe scrivono un valore com'e':\n${trovate.join("\n")}`);
});

/* E quelle della gestione. */
const FUNZIONI_DELLA_GESTIONE = [
  "cosaCambia",
  "spia",
  "comeVa",
  "gliAddon",
  "laMacchina",
  "laRete",
  "numero",
  "anelloDeiPosti",
  "laChiaveNuova",
  "leSueCase",
  "laScheda",
  "ilFare",
];

test("nella gestione ogni valore dentro un pezzo di HTML passa da testo()", () => {
  const trovate = insicure(GESTIONE, {
    funzioni: new Set([...FUNZIONI_COMUNI, ...FUNZIONI_DELLA_GESTIONE]),
    pezziFatti: new Set([]),
  });
  assert.deepEqual(trovate, [], `queste righe scrivono un valore com'e':\n${trovate.join("\n")}`);
});

test("la prova se ne accorge davvero", () => {
  /* Una prova che non cade mai non prova niente: le si da' una pagina finta
   * con la riga di prima, e deve trovarla. */
  const finta =
    "x\n    <script>\n" +
    "const c = {};\n" +
    "dove.innerHTML = `<b>${testo(c.a)}</b><i>${c.telefoni.abbinati}</i>`;\n" +
    "\n    </script>\n";
  const trovate = insicure(finta, { funzioni: new Set(FUNZIONI_COMUNI), pezziFatti: new Set() });
  assert.equal(trovate.length, 1);
  assert.match(trovate[0], /c\.telefoni\.abbinati/);
});
