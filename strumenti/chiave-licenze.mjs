/* La chiave delle licenze: si fabbrica una volta, prima del rilascio.
 *
 * Il quadro firma i gettoni delle licenze con una privata Ed25519, e tutti gli
 * altri — l'add-on, il centralino, la nuvola, l'app gdahome, gdanav — li
 * verificano con la pubblica scritta nel loro codice (`docs/LICENZE.md`, «La
 * chiave»). Di serie la pubblica e' vuota, e nessun gettone vale: tutti sono
 * Base.
 *
 *     node strumenti/chiave-licenze.mjs [--gdanav ../gdanav]
 *
 * fabbrica la coppia, scrive la pubblica in tutti i file che la tengono e
 * stampa la privata. La privata va messa **solo** sulla macchina del quadro,
 * come `QUADRO_LICENZE_CHIAVE`, e da nessun'altra parte: chi ce l'ha fa
 * Premium chiunque.
 *
 *     node strumenti/chiave-licenze.mjs --pubblica <x> [--gdanav ../gdanav]
 *
 * non fabbrica niente: scrive la pubblica che gli si da'. Serve a rimettere
 * la stessa chiave in una copia nuova della repository, o in gdanav dopo.
 *
 * `--radice <cartella>` scrive in un'altra copia invece che in questa: e'
 * quello che usano le prove, su una cartella di passaggio.
 *
 *     node strumenti/chiave-licenze.mjs --solo-iphone --pubblica <x>
 *
 * e' «prima l'iPhone»: la pubblica va nell'add-on e nell'app, il centralino e
 * la nuvola restano senza, e la bandierina `LICENZE_SOLO_SULL_IPHONE` si
 * accende in tutti i file. La casa tiene i gettoni senza limitare niente, e i
 * lucchetti li mette solo l'app per iPhone (`docs/ACCENDERE-GLI-ACQUISTI.md`).
 * Qui la coppia **non si fabbrica**: si e' fatta sulla macchina del quadro, e
 * di li' e' uscita solo la pubblica. Senza `--solo-iphone` la bandierina
 * torna spenta: la chiave vale dappertutto.
 *
 * Se la privata si perde, se ne fabbrica un'altra e si rilasciano tutti i
 * pezzi: i gettoni vecchi smettono di valere entro otto giorni, e le case li
 * rinnovano da sole. Se la privata **esce**, si fa lo stesso, subito.
 */

import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const QUI = dirname(fileURLToPath(import.meta.url));

/* I file che tengono la pubblica, dentro questa repository. */
const DI_QUI_JS = [
  "ponte/src/chiave-licenze.js",
  "centralino/src/chiave-licenze.js",
  "nuvola/src/chiave-licenze.js",
];
const DI_QUI_DART = ["app/lib/licenza/chiave.dart"];
/* E quello dentro gdanav, che sta in un'altra repository. */
const IN_GDANAV_DART = "packages/gdanav_app/lib/stato/chiave_licenze.dart";

function leggiGliArgomenti(argv) {
  const detti = { gdanav: "", pubblica: "", radice: join(QUI, ".."), soloSullIPhone: false };
  for (let i = 0; i < argv.length; i += 1) {
    const uno = argv[i];
    const dopo = () => {
      const valore = argv[i + 1];
      if (valore === undefined || valore.startsWith("--"))
        fermati(`dopo ${uno} ci vuole un valore`);
      i += 1;
      return valore;
    };
    if (uno === "--gdanav") detti.gdanav = dopo();
    else if (uno === "--pubblica") detti.pubblica = dopo();
    else if (uno === "--radice") detti.radice = dopo();
    else if (uno === "--solo-iphone") detti.soloSullIPhone = true;
    else if (uno === "--aiuto" || uno === "-h" || uno === "--help") {
      process.stdout.write(
        "node strumenti/chiave-licenze.mjs [--gdanav <cartella di gdanav>] [--pubblica <x>] [--radice <cartella>]\n" +
          "node strumenti/chiave-licenze.mjs --solo-iphone --pubblica <x> [--radice <cartella>]\n",
      );
      process.exit(0);
    } else fermati(`non so cosa sia ${uno}`);
  }
  return detti;
}

function fermati(perche) {
  process.stderr.write(`chiave-licenze: ${perche}\n`);
  process.exit(1);
}

/* Trentadue byte in base64url, senza `=`: la forma del contratto. */
const eUnaChiave = (x) =>
  /^[A-Za-z0-9_-]{43}$/.test(x) && Buffer.from(x, "base64url").length === 32;

/* La bandierina «prima l'iPhone», nella lingua del file: si cambia il valore
 * se c'e', si aggiunge in fondo se no. `null` la lascia stare: il file di
 * gdanav non ce l'ha, e non gli serve. */
function conLaBandierina(testo, nome, si) {
  if (si === null) return testo;
  const cerca = new RegExp(`(${nome}\\s*=\\s*)(?:true|false)`);
  if (cerca.test(testo)) return testo.replace(cerca, `$1${si}`);
  const riga =
    nome === "LICENZE_SOLO_SULL_IPHONE"
      ? `export const LICENZE_SOLO_SULL_IPHONE = ${si};\n`
      : `const licenzeSoloSullIPhone = ${si};\n`;
  return `${testo.replace(/\n*$/, "\n")}\n${riga}`;
}

/* Il file JS: si cambia la stringa assegnata a `CHIAVE_PUBBLICA_LICENZE` e
 * la bandierina, e nient'altro — il resto del file e' di chi l'ha scritto. Se
 * il file non c'e' si fa; se c'e' ma la costante no, la si aggiunge in fondo. */
function scriviNelJs(file, x, soloSullIPhone = false) {
  const esito = scriviLaChiaveNelJs(file, x);
  writeFileSync(
    file,
    conLaBandierina(readFileSync(file, "utf8"), "LICENZE_SOLO_SULL_IPHONE", soloSullIPhone),
  );
  return esito;
}

function scriviLaChiaveNelJs(file, x) {
  const riga = `export const CHIAVE_PUBBLICA_LICENZE = "${x}";\n`;
  if (!existsSync(file)) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(
      file,
      "/* La chiave pubblica delle licenze: Ed25519, 32 byte in base64url.\n" +
        " *\n" +
        " * La scrive `strumenti/chiave-licenze.mjs`, uguale in tutti i pezzi\n" +
        " * (`docs/LICENZE.md`, «La chiave»). Vuota, nessun gettone vale. */\n\n" +
        riga,
    );
    return "fatto";
  }
  const prima = readFileSync(file, "utf8");
  const cerca = /(CHIAVE_PUBBLICA_LICENZE\s*=\s*)(["'`])[^"'`]*\2/;
  if (cerca.test(prima)) {
    writeFileSync(
      file,
      prima.replace(cerca, (_tutto, testa, virgolette) => `${testa}${virgolette}${x}${virgolette}`),
    );
    return "cambiato";
  }
  writeFileSync(file, `${prima.replace(/\n*$/, "\n")}\n${riga}`);
  return "aggiunto";
}

/* Il file Dart: lo stesso, con `chiavePubblicaLicenze` e
 * `licenzeSoloSullIPhone` (`null`: il file di gdanav, che non ce l'ha). */
function scriviNelDart(file, x, soloSullIPhone = false) {
  const esito = scriviLaChiaveNelDart(file, x);
  writeFileSync(
    file,
    conLaBandierina(readFileSync(file, "utf8"), "licenzeSoloSullIPhone", soloSullIPhone),
  );
  return esito;
}

function scriviLaChiaveNelDart(file, x) {
  const riga = `const chiavePubblicaLicenze = '${x}';\n`;
  if (!existsSync(file)) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(
      file,
      "// La chiave pubblica delle licenze: Ed25519, 32 byte in base64url.\n" +
        "//\n" +
        "// La scrive `strumenti/chiave-licenze.mjs`, uguale in tutti i pezzi\n" +
        "// (docs/LICENZE.md, «La chiave»). Vuota, nessun gettone vale.\n\n" +
        riga,
    );
    return "fatto";
  }
  const prima = readFileSync(file, "utf8");
  const cerca = /(chiavePubblicaLicenze\s*=\s*)(["'])[^"']*\2/;
  if (cerca.test(prima)) {
    writeFileSync(
      file,
      prima.replace(cerca, (_tutto, testa, virgolette) => `${testa}${virgolette}${x}${virgolette}`),
    );
    return "cambiato";
  }
  writeFileSync(file, `${prima.replace(/\n*$/, "\n")}\n${riga}`);
  return "aggiunto";
}

const detti = leggiGliArgomenti(process.argv.slice(2));
const radice = resolve(detti.radice);

let x = detti.pubblica.trim();
let d = "";
if (detti.soloSullIPhone && !x)
  fermati(
    "--solo-iphone vuole --pubblica: la coppia si fa sulla macchina del quadro, e di li' esce solo la pubblica",
  );
if (detti.soloSullIPhone && detti.gdanav)
  fermati(
    "--solo-iphone non tocca gdanav: dentro gdahome segue la casa, e da sola non e' ancora nel negozio",
  );
if (x) {
  if (!eUnaChiave(x))
    fermati("la pubblica deve essere 32 byte in base64url (43 caratteri, senza `=`)");
} else {
  const { privateKey } = generateKeyPairSync("ed25519");
  const jwk = privateKey.export({ format: "jwk" });
  x = jwk.x;
  d = jwk.d;
}

/* Prima dell'iPhone la chiave va dove serve alla casa e all'app. Il
 * centralino e la nuvola restano senza — con la chiave chiuderebbero fuori da
 * casa i telefoni delle case Base, Android compresi — ma la bandierina si
 * accende anche li': cosi' i tre file dell'add-on, del centralino e della
 * nuvola restano uguali in tutto tranne che nella chiave. */
const SOLO_CASA_E_APP = new Set(["ponte/src/chiave-licenze.js", "app/lib/licenza/chiave.dart"]);
const soloSullIPhone = detti.soloSullIPhone;
const perQuesto = (via) => (!soloSullIPhone || SOLO_CASA_E_APP.has(via) ? x : "");

const scritti = [];
for (const via of DI_QUI_JS)
  scritti.push([join(radice, via), scriviNelJs(join(radice, via), perQuesto(via), soloSullIPhone)]);
for (const via of DI_QUI_DART)
  scritti.push([
    join(radice, via),
    scriviNelDart(join(radice, via), perQuesto(via), soloSullIPhone),
  ]);
if (detti.gdanav) {
  const cartella = resolve(detti.gdanav);
  if (!existsSync(join(cartella, "packages")))
    fermati(`${cartella} non sembra gdanav: non c'e' packages/`);
  const file = join(cartella, IN_GDANAV_DART);
  scritti.push([file, scriviNelDart(file, x, null)]);
}

const bella = (file) => {
  const corto = relative(process.cwd(), file);
  return corto.startsWith("..") ? file : corto;
};

process.stdout.write(
  `\n── La pubblica ────────────────────────────────────────────────────────\n\n  ${x}\n\n` +
    scritti.map(([file, come]) => `  ${come.padEnd(9)} ${bella(file)}\n`).join("") +
    (soloSullIPhone
      ? "\n  Prima l'iPhone: la chiave e' nell'add-on e nell'app, il centralino e la\n" +
        "  nuvola restano senza. La casa tiene i gettoni e non limita niente; i\n" +
        "  lucchetti li mette solo l'app per iPhone.\n"
      : detti.gdanav
        ? ""
        : "\n  gdanav non e' stato toccato: rilancia con --pubblica e --gdanav <cartella>.\n"),
);

if (d) {
  process.stdout.write(
    "\n── La privata: SOLO sulla macchina del quadro ─────────────────────────\n\n" +
      `  QUADRO_LICENZE_CHIAVE=${d}\n\n` +
      "  Mettila nell'ambiente del servizio del quadro (lo stesso file dove sta\n" +
      "  QUADRO_GESTORE), riavvialo, e controlla nel registro che dica\n" +
      `  «le licenze sono accese: la pubblica e' ${x}».\n\n` +
      "  Poi cancellala da qui: non va in nessun file della repository, in\n" +
      "  nessun segreto di GitHub e in nessuna chat. Chi ce l'ha fa Premium\n" +
      "  chiunque. Se esce, si rilancia questo script e si rilascia tutto.\n\n" +
      "  Prima del rilascio: ponte, centralino, nuvola, app gdahome e gdanav\n" +
      "  devono uscire tutti con questa pubblica.\n\n",
  );
}
