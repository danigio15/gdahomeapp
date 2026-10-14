/* La busta del tramite: chiusa dal bottone, aperta dalla macchina.
 *
 * Le due meta' stanno in due posti — chi chiude in `strumenti/`, chi apre
 * dentro `accendi.sh`, che la scrive sulla macchina — e qui si provano
 * insieme: lo script che apre e' proprio quello che `accendi.sh` scrive, preso
 * da li' e fatto girare come lo farebbe systemd.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { chiudiPerLaMacchina, nudaDaPubblica } from "../../strumenti/busta-del-tramite.mjs";

const QUI = dirname(fileURLToPath(import.meta.url));
const ACCENDI = readFileSync(join(QUI, "..", "accendi.sh"), "utf8");
const STRUMENTO = join(QUI, "..", "..", "strumenti", "busta-del-tramite.mjs");

const CONTO = JSON.stringify({
  type: "service_account",
  project_id: "gdahome-prova",
  client_email: "invio@gdahome-prova.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\nfinta\n-----END PRIVATE KEY-----\n",
});

function unaMacchina() {
  const cartella = mkdtempSync(join(tmpdir(), "busta-"));
  const { privateKey, publicKey } = generateKeyPairSync("x25519");
  const credenziali = join(cartella, "credenziali");
  execFileSync("mkdir", ["-p", credenziali, join(cartella, "firebase")]);
  writeFileSync(join(credenziali, "chiave"), privateKey.export({ type: "pkcs8", format: "pem" }));
  const apri = /cat >"\$DOVE\/apri-la-busta\.mjs" <<'FINE'\n([\s\S]*?)\nFINE\n/.exec(ACCENDI);
  assert.ok(apri, "accendi.sh non scrive piu' chi apre la busta");
  writeFileSync(join(cartella, "apri-la-busta.mjs"), apri[1]);
  const fuori = join(cartella, "firebase", "firebase-invio.json");
  return {
    cartella,
    pubblica: nudaDaPubblica(publicKey).toString("base64"),
    fuori,
    apri: (busta) => {
      writeFileSync(join(cartella, "firebase-invio.busta"), busta);
      return execFileSync(
        process.execPath,
        [join(cartella, "apri-la-busta.mjs"), join(cartella, "firebase-invio.busta"), fuori],
        {
          env: { ...process.env, CREDENTIALS_DIRECTORY: credenziali },
          encoding: "utf8",
          stdio: "pipe",
        },
      );
    },
    via: () => rmSync(cartella, { recursive: true, force: true }),
  };
}

test("chiusa per la macchina, si apre solo li', e il file nasce chiuso a 600", () => {
  const macchina = unaMacchina();
  try {
    const busta = chiudiPerLaMacchina(CONTO, macchina.pubblica);
    assert.ok(!busta.includes("gdahome-prova"), "dentro non si legge niente");
    const detto = macchina.apri(`Il tramite sulla abc\n\n${busta}\n`);
    assert.match(detto, /al suo posto/);
    assert.equal(readFileSync(macchina.fuori, "utf8"), CONTO);
    assert.equal(statSync(macchina.fuori).mode & 0o777, 0o600);
    assert.ok(!detto.includes("PRIVATE KEY"));
  } finally {
    macchina.via();
  }
});

test("chiusa per un'altra macchina, o toccata, non si apre e non scrive niente", () => {
  const macchina = unaMacchina();
  const altra = unaMacchina();
  try {
    const perLAltra = chiudiPerLaMacchina(CONTO, altra.pubblica);
    assert.throws(
      () => macchina.apri(perLAltra),
      (errore) => {
        assert.match(String(errore.stdout), /non si apre/);
        assert.ok(!String(errore.stdout).includes("gdahome-prova"));
        return true;
      },
    );
    assert.equal(existsSync(macchina.fuori), false);

    const giusta = chiudiPerLaMacchina(CONTO, macchina.pubblica).split("\n");
    const riga = giusta[2];
    giusta[2] = riga.slice(0, 10) + (riga[10] === "A" ? "B" : "A") + riga.slice(11);
    assert.throws(() => macchina.apri(giusta.join("\n")));
    assert.equal(existsSync(macchina.fuori), false);
    /* Senza busta non e' un errore: le notifiche restano come sono. */
    assert.match(macchina.apri("Il tramite sulla abc\n"), /nessuna busta/);
  } finally {
    macchina.via();
    altra.via();
  }
});

test("lo strumento del bottone prende il segreto da una variabile, e scrive solo la busta", () => {
  const macchina = unaMacchina();
  try {
    const uscita = execFileSync(process.execPath, [STRUMENTO, "chiudi"], {
      env: { ...process.env, BUSTA_DENTRO: CONTO, CHIAVE_DELLA_MACCHINA: macchina.pubblica },
      encoding: "utf8",
    });
    assert.match(uscita, /^-----BEGIN GDAHOME BUSTA-----\n[\s\S]+\n-----END GDAHOME BUSTA-----\n$/);
    assert.ok(!uscita.includes("gdahome-prova"));
    assert.match(macchina.apri(uscita), /al suo posto/);
  } finally {
    macchina.via();
  }
});

test("il servizio che apre non va in rete, e il tramite riceve la chiave come credenziale", () => {
  const servizio =
    /cat >\/etc\/systemd\/system\/tramite-apri-la-busta\.service <<FINE\n([\s\S]*?)\nFINE\n/.exec(
      ACCENDI,
    );
  assert.ok(servizio);
  for (const riga of [
    /^PrivateNetwork=yes$/m,
    /^ProtectSystem=strict$/m,
    /^ReadWritePaths=\$CONFIGURAZIONE\/firebase$/m,
    /^LoadCredential=chiave:\$CHIAVE_DELLA_BUSTA$/m,
  ]) {
    assert.match(servizio[1], riga);
  }
  assert.match(
    ACCENDI,
    /^LoadCredential=firebase-invio:\$CONFIGURAZIONE\/firebase\/firebase-invio\.json$/m,
  );
  /* La chiave della macchina non finisce nell'ambiente del tramite. */
  assert.doesNotMatch(ACCENDI, /printf 'FIREBASE/);
});
