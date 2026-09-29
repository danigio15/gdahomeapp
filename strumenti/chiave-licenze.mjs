/* La chiave delle licenze: si fabbrica una volta, prima del rilascio.
 *
 * Il quadro firma i gettoni delle licenze con una privata Ed25519, e tutti gli
 * altri — l'add-on, il centralino, l'app gdahome, gdanav — li
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
 *     node strumenti/chiave-licenze.mjs --senza-centralino --pubblica <x>
 *
 * e' il primo passo: la pubblica va nell'add-on e nell'app, e il centralino
 * resta senza. La casa tiene la licenza e gira le ricevute, l'app
 * e il browser mettono i lucchetti di Base, e il fuori casa resta aperto a
 * tutti finche' non si rilancia senza `--senza-centralino`
 * (`docs/ACCENDERE-GLI-ACQUISTI.md`). Qui la coppia **non si fabbrica**: si e'
 * fatta sulla macchina del quadro, e di li' e' uscita solo la pubblica.
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
const DI_QUI_JS = ["ponte/src/chiave-licenze.js", "centralino/src/chiave-licenze.js"];
const DI_QUI_DART = ["app/lib/licenza/chiave.dart"];
/* E quello dentro gdanav, che sta in un'altra repository. */
const IN_GDANAV_DART = "packages/gdanav_app/lib/stato/chiave_licenze.dart";

function leggiGliArgomenti(argv) {
  const detti = { gdanav: "", pubblica: "", radice: join(QUI, ".."), senzaCentralino: false };
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
    else if (uno === "--senza-centralino") detti.senzaCentralino = true;
    else if (uno === "--aiuto" || uno === "-h" || uno === "--help") {
      process.stdout.write(
        "node strumenti/chiave-licenze.mjs [--gdanav <cartella di gdanav>] [--pubblica <x>] [--radice <cartella>]\n" +
          "node strumenti/chiave-licenze.mjs --senza-centralino --pubblica <x> [--radice <cartella>]\n",
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

/* Il file JS: si cambia la stringa assegnata a `CHIAVE_PUBBLICA_LICENZE`, e
 * nient'altro — il resto del file e' di chi l'ha scritto. Se il file non c'e'
 * si fa; se c'e' ma la costante no, la si aggiunge in fondo. */
function scriviNelJs(file, x) {
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

/* Il file Dart: lo stesso, con `chiavePubblicaLicenze`. */
function scriviNelDart(file, x) {
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
if (detti.senzaCentralino && !x)
  fermati(
    "--senza-centralino vuole --pubblica: la coppia si fa sulla macchina del quadro, e di li' esce solo la pubblica",
  );
if (detti.senzaCentralino && detti.gdanav)
  fermati(
    "--senza-centralino non tocca gdanav: dentro gdahome segue la casa, e da sola non e' ancora nel negozio",
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

/* Il primo passo mette la chiave dove serve alla casa e all'app, e toglie
 * quella del centralino, se c'era: con la chiave chiuderebbe fuori da casa i
 * telefoni delle case Base. Il secondo passo — senza
 * `--senza-centralino` — la scrive dappertutto. */
const CASA_E_APP = new Set(["ponte/src/chiave-licenze.js", "app/lib/licenza/chiave.dart"]);
const senzaCentralino = detti.senzaCentralino;
const perQuesto = (via) => (!senzaCentralino || CASA_E_APP.has(via) ? x : "");

const scritti = [];
for (const via of DI_QUI_JS)
  scritti.push([join(radice, via), scriviNelJs(join(radice, via), perQuesto(via))]);
for (const via of DI_QUI_DART)
  scritti.push([join(radice, via), scriviNelDart(join(radice, via), perQuesto(via))]);
if (detti.gdanav) {
  const cartella = resolve(detti.gdanav);
  if (!existsSync(join(cartella, "packages")))
    fermati(`${cartella} non sembra gdanav: non c'e' packages/`);
  const file = join(cartella, IN_GDANAV_DART);
  scritti.push([file, scriviNelDart(file, x)]);
}

const bella = (file) => {
  const corto = relative(process.cwd(), file);
  return corto.startsWith("..") ? file : corto;
};

process.stdout.write(
  `\n── La pubblica ────────────────────────────────────────────────────────\n\n  ${x}\n\n` +
    scritti.map(([file, come]) => `  ${come.padEnd(9)} ${bella(file)}\n`).join("") +
    (senzaCentralino
      ? "\n  Primo passo: la chiave e' nell'add-on e nell'app, il centralino resta\n" +
        "  senza. I lucchetti di Base li mettono l'app e il browser; il fuori casa\n" +
        "  resta aperto finche' non si rilancia senza --senza-centralino.\n"
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
      "  Prima del rilascio: ponte, centralino, app gdahome e gdanav\n" +
      "  devono uscire tutti con questa pubblica.\n\n",
  );
}
