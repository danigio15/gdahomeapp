/* Tutte le frasi dell'app, in tutte le lingue, una accanto all'altra.
 *
 * Serve a una cosa che il compilatore non sa fare: **rileggere**. Che una
 * frase abbia la sua traduzione lo garantisce Dart — `inLingua` le vuole tutte
 * (vedi `app/lib/parole.dart`) — ma che quella traduzione sia buona lo può
 * dire solo qualcuno che la legge. Sparse in trenta file non si rileggono;
 * tutte in fila sì.
 *
 *   node strumenti/le-parole.mjs            le stampa in fila
 *   node strumenti/le-parole.mjs --conta    solo quante sono
 *   node strumenti/le-parole.mjs --md       una tabella, da incollare
 *
 * Legge il programma come testo, senza compilarlo: un `inLingua(` e le
 * stringhe che gli stanno dentro. Non e' un analizzatore di Dart e non
 * pretende di esserlo; se un giorno non tornasse piu' il conto, la prova
 * `app/test/parole_test.dart` resta quella che conta.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const DOVE = "app/lib";

/* Tutti i file del programma, uno per uno. */
function iFile(cartella) {
  const fuori = [];
  for (const nome of readdirSync(cartella)) {
    const quale = join(cartella, nome);
    if (statSync(quale).isDirectory()) fuori.push(...iFile(quale));
    else if (nome.endsWith(".dart")) fuori.push(quale);
  }
  return fuori;
}

/* Le stringhe di un pezzo di Dart, unite quando stanno una accanto all'altra:
   `'una ' 'frase'` e' una frase sola, e cosi' la scrive chi va a capo. */
function leStringhe(dentro) {
  const fuori = [];
  let quale = "";
  const forma = /'((?:[^'\\]|\\.)*)'/g;
  let ultima = -1;
  let trovata;
  while ((trovata = forma.exec(dentro))) {
    const fraLeDue = dentro.slice(ultima, trovata.index);
    if (ultima >= 0 && /^[\s]*$/.test(fraLeDue)) quale += trovata[1];
    else {
      if (quale) fuori.push(quale);
      quale = trovata[1];
    }
    ultima = forma.lastIndex;
  }
  if (quale) fuori.push(quale);
  return fuori;
}

/* Da dove comincia un `inLingua(` a dove finisce. */
function finoAllaChiusa(testo, da) {
  let livello = 1;
  let stringa = null;
  let i = da;
  while (i < testo.length && livello) {
    const c = testo[i];
    if (stringa) {
      if (c === "\\") i += 1;
      else if (c === stringa) stringa = null;
    } else if (c === "'" || c === '"') stringa = c;
    else if (c === "(") livello += 1;
    else if (c === ")") livello -= 1;
    i += 1;
  }
  return i - 1;
}

const frasi = [];
for (const quale of iFile(DOVE)) {
  /* `parole.dart` e' il meccanismo, non una frase: la sua `inLingua(...)` e'
     la dichiarazione. */
  if (quale.endsWith("parole.dart")) continue;
  const testo = readFileSync(quale, "utf8");
  let da = 0;
  for (;;) {
    const dove = testo.indexOf("inLingua(", da);
    if (dove < 0) break;
    const fine = finoAllaChiusa(testo, dove + "inLingua(".length);
    const dentro = testo.slice(dove + "inLingua(".length, fine);
    const per = {};
    /* Ogni lingua e quello che le tocca: `it:` fino a `en:`, e cosi' via.
       Il nome di una lingua sta **all'inizio** o dopo una virgola: dentro una
       frase «add-on: il suo tunnel» c'e' un `on:` che non e' una lingua. */
    const pezzi = dentro.split(/(?:^|,)\s*([a-z]{2}):/);
    for (let i = 1; i < pezzi.length; i += 2) {
      per[pezzi[i]] = leStringhe(pezzi[i + 1]).join("");
    }
    if (per.it || per.en) frasi.push({ dove: quale, per });
    da = fine;
  }
}

const LINGUE = ["it", "en"];
if (process.argv.includes("--conta")) {
  console.log(`${frasi.length} frasi`);
  for (const quale of LINGUE) {
    const senza = frasi.filter((una) => !una.per[quale]);
    console.log(
      `  ${quale}: ${frasi.length - senza.length}${senza.length ? ` — ne mancano ${senza.length}` : ""}`,
    );
    for (const una of senza) console.log(`       ${una.dove}: ${una.per.it || una.per.en}`);
  }
} else if (process.argv.includes("--md")) {
  console.log("| italiano | inglese | dove |");
  console.log("|---|---|---|");
  for (const una of frasi) {
    const riga = (t) => (t || "").replaceAll("|", "\\|").replaceAll("\\n", " ");
    console.log(
      `| ${riga(una.per.it)} | ${riga(una.per.en)} | ${una.dove.replace("app/lib/", "")} |`,
    );
  }
} else {
  let dove = "";
  for (const una of frasi) {
    if (una.dove !== dove) {
      dove = una.dove;
      console.log(`\n── ${dove.replace("app/lib/", "")}`);
    }
    console.log(`  it  ${una.per.it}`);
    console.log(`  en  ${una.per.en}`);
  }
  console.log(`\n${frasi.length} frasi, in ${new Set(frasi.map((u) => u.dove)).size} file`);
}
