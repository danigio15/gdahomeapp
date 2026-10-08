/* Chi usa un aiuto di un altro modulo lo importa (#163).
 *
 * «Gestione termica ferma dopo la 1.7.0.» La pagina mostrava le linguette e
 * sotto niente: la 1.7.0 aveva insegnato alle targhette della caldaia a salire
 * di scala al migliaio — «1,21 kW» invece di «1211 W» — chiamando
 * `laMisuraDallUnita`, e l'import quel file non l'aveva. Gli altri tre file
 * toccati dalla stessa modifica lo avevano; questo no. Un modulo del browser
 * non perdona un nome che non conosce: ogni targhetta con un numero dentro
 * rompeva il disegno, e la pagina restava vuota.
 *
 * Le prove della sezione leggevano il sorgente come testo, e un testo con
 * dentro la chiamata giusta passa anche senza l'import. Qui si guarda proprio
 * quello: ogni funzione che un modulo della plancia esporta, e che un altro
 * modulo chiama, in quell'altro modulo deve essere importata o dichiarata.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

const CARTELLE = ["core", "sections"];

const sorgenti = CARTELLE.flatMap((cartella) => {
  const dove = new URL(`../src/${cartella}/`, import.meta.url);
  return readdirSync(dove)
    .filter((nome) => nome.endsWith(".js"))
    .map((nome) => ({
      file: `${cartella}/${nome}`,
      testo: readFileSync(new URL(nome, dove), "utf8"),
    }));
});

/* I commenti fuori: qui dentro si citano spesso le funzioni per nome, e una
 * funzione citata non e' una funzione chiamata. Togliere un pezzo di troppo
 * — un «//» dentro un indirizzo — puo' solo far perdere una chiamata, non
 * inventarne una. */
const senzaCommenti = (testo) =>
  testo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\])\/\/[^\n]*/g, "$1");

/* Le funzioni che ogni modulo dichiara col proprio nome, quelle col nome
 * composto — `laMisuraDallUnita`, `contoDeiVarchi`. Le parole semplici restano
 * fuori: «translate» o «filtra» sono anche funzioni dei fogli di stile e nomi
 * di parametri, e scambiarle per una chiamata vorrebbe dire una prova che
 * grida per niente.
 *
 * Anche quelle **non esportate** (#190). La 1.10.0 ha tolto da
 * `rooms-page-section.js` la sua `disegnoDellaStanza`, aggiornando due
 * chiamate su tre: la terza, nella testata della stanza aperta, chiamava un
 * nome che li' non c'era piu' — e ogni stanza si apriva vuota. Contare solo le
 * esportate lasciava passare proprio questo caso: una funzione di casa sua
 * che sparisce, mentre una con lo stesso nome vive in un altro file. */
function esportate({ testo }) {
  return [...testo.matchAll(/^(?:export )?(?:async )?function\*? ?([A-Za-z_$][\w$]*)/gm)]
    .map((trovato) => trovato[1])
    .filter((nome) => /[a-z][A-Z]/.test(nome));
}

const daChi = new Map();
for (const sorgente of sorgenti)
  for (const nome of esportate(sorgente)) {
    if (!daChi.has(nome)) daChi.set(nome, new Set());
    daChi.get(nome).add(sorgente.file);
  }

const escapa = (nome) => nome.replace(/\$/g, "\\$");

/* Una chiamata vera, non la definizione di un metodo: `nome(…) {` e' un
 * metodo scritto in un oggetto o in una classe, e quello e' un nome suo. */
function chiamate(codice, nome) {
  const cerca = new RegExp(`(?<![\\w$.])${escapa(nome)}\\(`, "g");
  let vere = 0;
  for (const trovato of codice.matchAll(cerca)) {
    let profondita = 0;
    let fine = trovato.index + trovato[0].length - 1;
    for (; fine < codice.length; fine += 1) {
      if (codice[fine] === "(") profondita += 1;
      else if (codice[fine] === ")" && --profondita === 0) break;
    }
    if (!/^\s*\{/.test(codice.slice(fine + 1, fine + 8))) vere += 1;
  }
  return vere;
}

/* Importata, dichiarata qui, o arrivata come parametro: in tutti e tre i casi
 * il modulo quel nome lo conosce. */
function loConosce(codice, nome) {
  const n = escapa(nome);
  const importato = new RegExp(`import\\s*\\{[^}]*(?<![\\w$])${n}(?![\\w$])[^}]*\\}\\s*from`);
  const dichiarato = new RegExp(
    `(?:function\\*?\\s*${n}\\s*\\(|(?:const|let|var)\\s+${n}(?![\\w$])|(?:const|let|var)\\s*\\{[^}]*(?<![\\w$:])${n}(?![\\w$])[^}]*\\}\\s*=|(?:const|let|var)\\s*\\[[^\\]]*(?<![\\w$])${n}(?![\\w$])[^\\]]*\\]\\s*=)`,
  );
  const parametro = new RegExp(
    `(?:\\([^()]*(?<![\\w$.])${n}(?![\\w$])[^()]*\\)\\s*(?:=>|\\{)|(?<![\\w$.])${n}\\s*=(?![=>]))`,
  );
  return importato.test(codice) || dichiarato.test(codice) || parametro.test(codice);
}

test("ogni funzione di un altro modulo che si chiama, si importa", () => {
  const mancano = [];
  for (const sorgente of sorgenti) {
    const codice = senzaCommenti(sorgente.testo);
    /* Una passata sola per file, per sapere quali nomi vi si chiamano: provarli
     * tutti uno per uno contro quattrocento file costava dieci secondi. */
    const chiamati = new Set(
      [...codice.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)\(/g)].map((trovato) => trovato[1]),
    );
    for (const nome of chiamati) {
      const file = daChi.get(nome);
      if (!file || file.has(sorgente.file)) continue;
      if (!chiamate(codice, nome)) continue;
      if (loConosce(codice, nome)) continue;
      mancano.push(`${sorgente.file}: ${nome}() — sta in ${[...file].join(", ")}`);
    }
  }
  assert.deepEqual(mancano, []);
});

test("la gestione termica sa salire di scala: l'aiuto che usa lo importa", () => {
  const sezione = readFileSync(
    new URL("../src/sections/impianti-termici-section.js", import.meta.url),
    "utf8",
  );
  assert.match(sezione, /laMisuraDallUnita\(valore, unita, \{ decimali: cifre \}\)/);
  assert.match(
    sezione,
    /import \{ laMisuraDallUnita \} from "\.\.\/core\/le-unita-della-corrente\.js";/,
  );
});
