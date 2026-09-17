/* Le prove del caricamento sul Play Console.
 *
 * Qui non si prova «funziona»: quello lo dice Google, e lo dice una volta sola
 * quando si carica davvero. Si prova quello che **si puo'** provare da qui, ed
 * e' quasi tutto quello che conta:
 *
 *  - che un credenziale incollato nel modo sbagliato dica **come** e' sbagliato,
 *    invece di far cadere la corsa su un `JSON.parse`;
 *  - che il biglietto firmato sia un JWT vero, verificabile con la chiave
 *    pubblica, e che chieda il permesso giusto: se quello e' storto, Google
 *    risponde «invalid_grant» e da quella parola non si capisce niente;
 *  - che le novita' troppo lunghe fermino tutto **prima** di caricare settanta
 *    megabyte — compreso il caso vero: quelle che stanno in questa repository;
 *  - che «production» non parta per sbaglio;
 *  - e che una modifica aperta non resti mai aperta, nemmeno quando qualcosa
 *    va male a meta' strada. E' la cosa che si dimentica sempre, e che la volta
 *    dopo fa trovare il negozio in uno stato che nessuno sa spiegare.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, createVerify } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CARTELLA_DELLE_NOVITA,
  COME_SI_CHIAMA,
  QUANTO_SI_PUO_SCRIVERE,
  ilBiglietto,
  ilCredenziale,
  laPista,
  leNovita,
  porta,
  quantoPesa,
} from "../../strumenti/porta-nel-negozio.mjs";

const RADICE = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

/* Una chiave finta, fatta qui: la firma si verifica per davvero, e non serve
 * nessun segreto di nessuno. */
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const CHIAVE = privateKey.export({ type: "pkcs8", format: "pem" });

function credenzialeFinto() {
  return {
    type: "service_account",
    client_email: "negozio@gdahome.iam.gserviceaccount.com",
    private_key: CHIAVE,
    token_uri: "https://oauth2.googleapis.com/token",
  };
}

const daUrl = (testo) => Buffer.from(testo.replace(/-/g, "+").replace(/_/g, "/"), "base64");

test("il credenziale si accetta in chiaro e in base64, e sbagliato dice come", () => {
  const dentro = JSON.stringify(credenzialeFinto());

  const chiaro = ilCredenziale(dentro);
  assert.equal(chiaro.posta, "negozio@gdahome.iam.gserviceaccount.com");
  assert.equal(chiaro.dove, "https://oauth2.googleapis.com/token");

  /* In base64 esce identico: sono due modi di incollare la stessa cosa, e chi
   * non sa quale usare usa questo perche' di a-capo non ne ha. */
  const impacchettato = ilCredenziale(Buffer.from(dentro, "utf8").toString("base64"));
  assert.deepEqual(impacchettato, chiaro);

  /* E i tre modi di sbagliarlo, ognuno con la sua frase. */
  assert.throws(() => ilCredenziale(""), /manca NEGOZIO_GOOGLE/);
  assert.throws(() => ilCredenziale("questo non e' niente"), /non e' un JSON/);
  assert.throws(
    () => ilCredenziale(JSON.stringify({ project_id: "gdahome" })),
    /mancano «client_email» o «private_key»/,
    "il file del progetto non e' il file della chiave, e succede di scambiarli",
  );
});

test("il biglietto e' un JWT vero, e chiede il permesso giusto", () => {
  const credenziale = ilCredenziale(JSON.stringify(credenzialeFinto()));
  const adesso = Date.parse("2026-09-17T02:00:00Z");
  const biglietto = ilBiglietto(credenziale, { adesso });

  const [testa, dentro, firma] = biglietto.split(".");
  assert.deepEqual(JSON.parse(daUrl(testa).toString("utf8")), { alg: "RS256", typ: "JWT" });

  const detto = JSON.parse(daUrl(dentro).toString("utf8"));
  assert.equal(detto.iss, "negozio@gdahome.iam.gserviceaccount.com");
  assert.equal(detto.scope, "https://www.googleapis.com/auth/androidpublisher");
  assert.equal(detto.aud, "https://oauth2.googleapis.com/token");
  assert.equal(detto.iat, adesso / 1000);
  assert.equal(detto.exp - detto.iat, 3600, "vale un'ora, come vuole Google");

  /* E la firma regge: e' l'unica cosa che qui si puo' verificare davvero, ed e'
   * quella che decide se Google ci parla o no. */
  assert.ok(
    createVerify("RSA-SHA256").update(`${testa}.${dentro}`).verify(publicKey, daUrl(firma)),
    "la firma doveva tornare con la chiave pubblica",
  );
});

test("le novita': il nome del file e' la lingua, e 500 caratteri sono 500", (t) => {
  const cartella = mkdtempSync(join(tmpdir(), "negozio-"));
  t.after(() => rmSync(cartella, { recursive: true, force: true }));

  writeFileSync(join(cartella, "it-IT.txt"), "Adesso fa una cosa nuova.\n");
  writeFileSync(join(cartella, "en-US.txt"), "It now does a new thing.\n");
  /* Un file che non e' una lingua non ci va: questa cartella e' un elenco di
   * lingue, e un `LEGGIMI.txt` diventerebbe una lingua che non esiste. Per
   * questo il foglietto accanto e' un `.md`. */
  writeFileSync(join(cartella, "LEGGIMI.md"), "spiegazioni");

  assert.deepEqual(leNovita(cartella), [
    { language: "en-US", text: "It now does a new thing." },
    { language: "it-IT", text: "Adesso fa una cosa nuova." },
  ]);

  writeFileSync(join(cartella, "it-IT.txt"), "a".repeat(QUANTO_SI_PUO_SCRIVERE + 12));
  assert.throws(
    () => leNovita(cartella),
    /it-IT\.txt e' 512 caratteri.*12 di troppo/,
    "deve dire quale file e di quanto: rifarlo a occhio e' come non dirlo",
  );

  writeFileSync(join(cartella, "it-IT.txt"), "   \n  ");
  assert.throws(() => leNovita(cartella), /it-IT\.txt e' vuoto/);

  assert.throws(() => leNovita(join(cartella, "non-c-e")), /manca la cartella/);
});

test("le novita' di questa repository stanno nella casella", () => {
  /* La prova che vale di piu', ed e' quella che si sarebbe presa in faccia: se
   * un giorno una di quelle frasi cresce di venti caratteri, questo si ferma
   * qui e non dopo aver caricato l'`.aab`. */
  const dette = leNovita(join(RADICE, CARTELLA_DELLE_NOVITA));
  assert.ok(dette.length >= 2, "italiano e inglese, come tutto il resto");
  for (const una of dette) {
    assert.match(
      una.language,
      /^[a-z]{2}-[A-Z]{2}$/,
      `«${una.language}» non e' un codice di lingua`,
    );
    assert.ok(
      una.text.length <= QUANTO_SI_PUO_SCRIVERE,
      `${una.language}: ${una.text.length} caratteri, il negozio ne prende ${QUANTO_SI_PUO_SCRIVERE}`,
    );
  }
});

test("«production» non parte per sbaglio", () => {
  assert.equal(laPista("internal"), "internal");
  assert.equal(laPista(" alpha "), "alpha");
  assert.throws(() => laPista(""), /su quale pista/);
  assert.throws(() => laPista("production"), /aggiungi --davvero/);
  assert.equal(laPista("production", { davvero: true }), "production");
  /* Le piste fatte a mano hanno un nome loro, e passano: l'elenco delle solite
   * serve a suggerire, non a vietare. */
  assert.equal(laPista("custom-12345"), "custom-12345");
});

test("il peso si dice come lo direbbe uno", () => {
  assert.equal(quantoPesa(68_075_192), "65 MB");
  assert.equal(quantoPesa(1_500_000), "1.4 MB");
});

/* ─── Il viaggio, con un negozio finto ─────────────────────────────────────── */

/* Un Play Console finto: tiene in fila le chiamate che gli arrivano — perche'
 * metà di questa prova e' **quali** chiamate partono, e in che ordine — e sa
 * fallire su una di esse, per vedere cosa succede alla modifica aperta. */
function negozioFinto({ rompiti = "" } = {}) {
  const fatte = [];
  const prendi = async (dove, opzioni = {}) => {
    const via = String(dove);
    const metodo = String(opzioni.method || "GET");
    fatte.push(`${metodo} ${via.replace("https://androidpublisher.googleapis.com", "")}`);
    const risposta = (stato, cosa) => ({
      ok: stato < 400,
      status: stato,
      async text() {
        return JSON.stringify(cosa);
      },
      async json() {
        return cosa;
      },
    });
    if (via.includes("oauth2.googleapis.com/token")) {
      return risposta(200, { access_token: "un-gettone" });
    }
    if (rompiti && via.includes(rompiti) && metodo !== "DELETE") {
      return risposta(403, { error: { message: "the caller does not have permission" } });
    }
    if (via.includes("/bundles?uploadType=media")) return risposta(200, { versionCode: 104322 });
    if (via.endsWith("/edits") && metodo === "POST") return risposta(200, { id: "modifica-1" });
    return risposta(200, {});
  };
  return { prendi, fatte };
}

function unPacco(t) {
  const cartella = mkdtempSync(join(tmpdir(), "pacco-"));
  t.after(() => rmSync(cartella, { recursive: true, force: true }));
  const dove = join(cartella, "app-release.aab");
  writeFileSync(dove, Buffer.alloc(2048, 7));
  return dove;
}

const NOVITA = [{ language: "it-IT", text: "Una cosa nuova." }];

test("il giro intero: apre, carica, mette sulla pista, chiede, consegna", async (t) => {
  const negozio = negozioFinto();
  const esito = await porta({
    pacco: unPacco(t),
    pista: "internal",
    novita: NOVITA,
    segreto: JSON.stringify(credenzialeFinto()),
    prendi: negozio.prendi,
  });

  assert.deepEqual(esito, { versione: 104322, pista: "internal", pubblicato: true });
  const app = `/androidpublisher/v3/applications/${COME_SI_CHIAMA}`;
  assert.deepEqual(negozio.fatte, [
    "POST https://oauth2.googleapis.com/token",
    `POST ${app}/edits`,
    `POST /upload/androidpublisher/v3/applications/${COME_SI_CHIAMA}/edits/modifica-1/bundles?uploadType=media`,
    `PATCH ${app}/edits/modifica-1/tracks/internal`,
    `POST ${app}/edits/modifica-1:validate`,
    `POST ${app}/edits/modifica-1:commit`,
  ]);
});

test("--prova fa tutto e poi butta: nel negozio non cambia niente", async (t) => {
  /* E' il modo di provare il credenziale la prima volta senza che nessuno si
   * ritrovi una versione nuova. Il `validate` ci resta — e' li' che si scopre
   * se qualcosa non va — e al posto del `commit` c'e' il cestino. */
  const negozio = negozioFinto();
  const esito = await porta({
    pacco: unPacco(t),
    pista: "internal",
    novita: NOVITA,
    segreto: JSON.stringify(credenzialeFinto()),
    prendi: negozio.prendi,
    prova: true,
  });

  assert.equal(esito.pubblicato, false);
  assert.equal(esito.versione, 104322);
  assert.ok(
    negozio.fatte.some((una) => una.includes(":validate")),
    "il controllo di Google si fa anche in prova: e' quello che serve",
  );
  assert.ok(!negozio.fatte.some((una) => una.includes(":commit")));
  assert.ok(negozio.fatte.some((una) => una.startsWith("DELETE")));
});

test("se qualcosa va male la modifica si butta, e si dice cosa ha detto Google", async (t) => {
  const negozio = negozioFinto({ rompiti: "/tracks/" });
  await assert.rejects(
    () =>
      porta({
        pacco: unPacco(t),
        pista: "internal",
        novita: NOVITA,
        segreto: JSON.stringify(credenzialeFinto()),
        prendi: negozio.prendi,
      }),
    /403.*does not have permission/,
    "un «403» da solo manderebbe a cercare dalla parte sbagliata",
  );
  assert.ok(
    negozio.fatte.some(
      (una) =>
        una === `DELETE /androidpublisher/v3/applications/${COME_SI_CHIAMA}/edits/modifica-1`,
    ),
    "una modifica aperta e mai consegnata resta li' a scadere, e la volta dopo nessuno sa cosa c'era dentro",
  );
});

test("senza gettone non si carica niente, e si dice dove guardare", async (t) => {
  const prendi = async (dove) => {
    if (String(dove).includes("oauth2")) {
      return {
        ok: false,
        status: 400,
        async json() {
          return { error: "invalid_grant" };
        },
        async text() {
          return "";
        },
      };
    }
    throw new Error("non ci si doveva arrivare");
  };
  await assert.rejects(
    () =>
      porta({
        pacco: unPacco(t),
        pista: "internal",
        novita: NOVITA,
        segreto: JSON.stringify(credenzialeFinto()),
        prendi,
      }),
    /va invitato nel Play Console/,
  );
});
