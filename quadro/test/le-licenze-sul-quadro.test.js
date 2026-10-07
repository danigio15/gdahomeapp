/* Lo strumento delle licenze sulla macchina del quadro (`le-licenze.mjs`).
 *
 * Sempre su un file d'ambiente finto, in una cartella di passaggio: queste
 * prove girano anche sul quadro, prima di ogni aggiornamento, e li' il file
 * vero non lo devono nemmeno vedere.
 *
 * Quello che conta: la chiave si fa una volta sola e non si cambia piu'; di
 * segreti non se ne stampa nessuno; e quello che si scrive, riletto come lo
 * rilegge systemd, il quadro lo sa usare.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { lanciaLeLicenze } from "../le-licenze.mjs";
import { chiavePrivataDa, laPubblicaDi } from "../src/licenze.js";
import { Negozi } from "../src/negozi.js";

const STRUMENTO = join(dirname(fileURLToPath(import.meta.url)), "..", "le-licenze.mjs");

/* L'ambiente di un quadro appena acceso da accendi.sh. */
const DI_ACCENDI = [
  "QUADRO_PORTA=8100",
  "QUADRO_ASCOLTO=127.0.0.1",
  "QUADRO_DATI=/var/lib/quadro",
  "QUADRO_GESTORE=una-chiave-lunga-abbastanza-per-il-gestore",
  "QUADRO_REGISTRO=info",
];

function unAmbiente(righe = DI_ACCENDI) {
  const file = join(mkdtempSync(join(tmpdir(), "quadro-ambiente-")), "ambiente");
  writeFileSync(file, `${righe.join("\n")}\n`, { mode: 0o600 });
  return file;
}

/* Il file come lo legge systemd (`EnvironmentFile=`), scritto da capo e non
 * preso dallo strumento: fra apici singoli tutto e' com'e', fuori la barra
 * rovescia toglie se stessa. */
function comeSystemd(file) {
  const fuori = {};
  for (const riga of readFileSync(file, "utf8").split("\n")) {
    const uguale = riga.indexOf("=");
    if (!riga || riga.startsWith("#") || uguale < 0) continue;
    const resto = riga.slice(uguale + 1);
    let valore = "";
    let apici = false;
    for (let i = 0; i < resto.length; i += 1) {
      const c = resto[i];
      if (apici) {
        if (c === "'") apici = false;
        else valore += c;
      } else if (c === "'") {
        apici = true;
      } else if (c === "\\") {
        i += 1;
        valore += resto[i] ?? "";
      } else {
        valore += c;
      }
    }
    fuori[riga.slice(0, uguale)] = valore;
  }
  return fuori;
}

const laChiave = (file) => lanciaLeLicenze(["chiave", "--ambiente", file]).join("\n");

/* Un service account come lo scarica Google Cloud: su piu' righe, con la
 * chiave privata dentro una stringa piena di «\n». */
function unServiceAccount() {
  const chiave = generateKeyPairSync("rsa", { modulusLength: 2048 })
    .privateKey.export({ type: "pkcs8", format: "pem" })
    .toString();
  const conto = {
    type: "service_account",
    project_id: "gdahome-prova",
    private_key_id: "0123456789abcdef",
    private_key: chiave,
    client_email: "quadro@gdahome-prova.iam.gserviceaccount.com",
    token_uri: "https://oauth2.googleapis.com/token",
  };
  const file = join(mkdtempSync(join(tmpdir(), "google-")), "conto.json");
  writeFileSync(file, JSON.stringify(conto, null, 2));
  return { file, chiave, conto };
}

/* Una chiave .p8 come la scarica App Store Connect. */
function unaP8() {
  const pem = generateKeyPairSync("ec", { namedCurve: "P-256" })
    .privateKey.export({ type: "pkcs8", format: "pem" })
    .toString();
  const file = join(mkdtempSync(join(tmpdir(), "apple-")), "AuthKey_ABCDE12345.p8");
  writeFileSync(file, pem);
  return { file, pem };
}

const ISSUER = "57246542-96fe-1a63-e053-0824d011072a";

test("la chiave si fa una volta: la privata nel file e basta, a schermo solo la pubblica", () => {
  const file = unAmbiente();
  const detto = laChiave(file);
  const d = comeSystemd(file).QUADRO_LICENZE_CHIAVE;
  assert.match(d, /^[A-Za-z0-9_-]{43}$/);
  const pubblica = laPubblicaDi(chiavePrivataDa(d));
  assert.ok(detto.includes(`La pubblica: ${pubblica}`));
  assert.ok(!detto.includes(d), "la privata non si stampa");
  assert.ok(detto.includes("systemctl restart quadro"));

  /* Le righe di accendi.sh restano, e il file resta chiuso. */
  for (const riga of DI_ACCENDI) assert.ok(readFileSync(file, "utf8").includes(`${riga}\n`));
  assert.equal(statSync(file).mode & 0o777, 0o600);

  /* La seconda volta non si rifa': si ridice la stessa pubblica. */
  const prima = readFileSync(file, "utf8");
  const ancora = laChiave(file);
  assert.equal(readFileSync(file, "utf8"), prima);
  assert.match(ancora, /c'era gia'/);
  assert.ok(ancora.includes(`La pubblica: ${pubblica}`));
  assert.ok(!ancora.includes(d));
});

test("una chiave storta gia' scritta non si tocca", () => {
  const file = unAmbiente([...DI_ACCENDI, "QUADRO_LICENZE_CHIAVE=non-e-una-chiave"]);
  const prima = readFileSync(file, "utf8");
  assert.throws(() => laChiave(file), /non e' una chiave Ed25519 buona/);
  assert.equal(readFileSync(file, "utf8"), prima);
});

test("il service account di Google arriva al quadro intero, coi suoi «\\n»", () => {
  const file = unAmbiente();
  const { file: json, chiave, conto } = unServiceAccount();
  const detto = lanciaLeLicenze(["google", json, "--ambiente", file]).join("\n");
  assert.ok(detto.includes(conto.client_email));
  assert.ok(!detto.includes("PRIVATE KEY"), "la chiave non si stampa");

  const letto = comeSystemd(file);
  assert.equal(JSON.parse(letto.QUADRO_GOOGLE_SERVICE_ACCOUNT).private_key, chiave);
  assert.equal(new Negozi({ ambiente: letto }).configurato("android"), true);
  assert.equal(statSync(file).mode & 0o777, 0o600);

  /* Una seconda volta solo chiedendolo. */
  assert.throws(
    () => lanciaLeLicenze(["google", json, "--ambiente", file]),
    /c'e' gia'.*--sostituisci/s,
  );
  const altro = unServiceAccount();
  lanciaLeLicenze(["google", altro.file, "--sostituisci", "--ambiente", file]);
  const dopo = comeSystemd(file);
  assert.equal(JSON.parse(dopo.QUADRO_GOOGLE_SERVICE_ACCOUNT).private_key, altro.chiave);
  assert.equal(
    readFileSync(file, "utf8")
      .split("\n")
      .filter((r) => r.startsWith("QUADRO_GOOGLE_")).length,
    1,
  );
});

test("un file che non e' un service account si rifiuta, e non si scrive niente", () => {
  const file = unAmbiente();
  const prima = readFileSync(file, "utf8");
  const storto = join(mkdtempSync(join(tmpdir(), "google-")), "storto.json");
  writeFileSync(storto, "non sono un json");
  assert.throws(() => lanciaLeLicenze(["google", storto, "--ambiente", file]), /JSON/);
  writeFileSync(storto, JSON.stringify({ type: "authorized_user", client_id: "x" }));
  assert.throws(() => lanciaLeLicenze(["google", storto, "--ambiente", file]), /service account/);
  assert.equal(readFileSync(file, "utf8"), prima);
});

test("la chiave di Apple va su una riga, e il quadro la rimette a posto", () => {
  const file = unAmbiente();
  const { file: p8, pem } = unaP8();
  const detto = lanciaLeLicenze(["apple", p8, "ABCDE12345", ISSUER, "--ambiente", file]).join("\n");
  assert.ok(detto.includes("ABCDE12345"));
  assert.ok(!detto.includes("PRIVATE KEY"));

  const letto = comeSystemd(file);
  assert.equal(letto.QUADRO_APPLE_CHIAVE.replace(/\\n/g, "\n"), pem.trim());
  assert.equal(letto.QUADRO_APPLE_KEY_ID, "ABCDE12345");
  assert.equal(letto.QUADRO_APPLE_ISSUER, ISSUER);
  assert.equal(new Negozi({ ambiente: letto }).configurato("ios"), true);

  /* Un Key ID o un Issuer ID scritti storti si dicono subito. */
  const pulito = unAmbiente();
  assert.throws(
    () => lanciaLeLicenze(["apple", p8, "abc", ISSUER, "--ambiente", pulito]),
    /Key ID/,
  );
  assert.throws(
    () => lanciaLeLicenze(["apple", p8, "ABCDE12345", "issuer", "--ambiente", pulito]),
    /Issuer ID/,
  );
});

test("com'e' messo: cosa c'e' e cosa manca, senza mai un segreto", () => {
  const file = unAmbiente();
  const vuoto = lanciaLeLicenze(["--ambiente", file]).join("\n");
  assert.equal(vuoto.match(/manca/g)?.length, 3);

  laChiave(file);
  lanciaLeLicenze(["google", unServiceAccount().file, "--ambiente", file]);
  lanciaLeLicenze(["apple", unaP8().file, "ABCDE12345", ISSUER, "--ambiente", file]);
  const pieno = lanciaLeLicenze(["--ambiente", file]).join("\n");
  assert.equal(pieno.match(/c'e'/g)?.length, 3);
  assert.ok(!pieno.includes("PRIVATE KEY"));
  assert.ok(!pieno.includes(comeSystemd(file).QUADRO_LICENZE_CHIAVE));
  assert.match(pieno, /journalctl -u quadro/);
});

test("dal terminale: senza il file d'ambiente lo dice, ed esce con 1", () => {
  const fatto = spawnSync(process.execPath, [STRUMENTO, "--ambiente", "/non/c/e/ambiente"], {
    encoding: "utf8",
  });
  assert.equal(fatto.status, 1);
  assert.match(fatto.stderr, /Non trovo \/non\/c\/e\/ambiente/);

  const file = unAmbiente();
  const chiave = spawnSync(process.execPath, [STRUMENTO, "chiave", "--ambiente", file], {
    encoding: "utf8",
  });
  assert.equal(chiave.status, 0);
  assert.match(chiave.stdout, /La pubblica: [A-Za-z0-9_-]{43}/);
});
