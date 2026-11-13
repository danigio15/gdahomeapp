/* Le notifiche dal centralino a Firebase.
 *
 * Firebase e' finto — un server HTTP qui accanto, che risponde come Google —
 * ma la chiave e' vera: una chiave RSA fatta adesso, con cui il centralino
 * firma la sua richiesta d'accesso come la firmerebbe per Google. Il resto e'
 * il centralino vero, con una casa vera che gli parla sul filo.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createVerify, generateKeyPairSync, randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Case } from "../src/case.js";
import { Centralino } from "../src/centralino.js";
import { costruisciIlServer } from "../src/server.js";
import {
  chiaveDiFirebaseDa,
  FRASE_DI_RISERVA,
  leggiLaChiaveDiFirebase,
  PostinoDiFirebase,
  Spinte,
} from "../src/spinte.js";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const PRIVATA = privateKey.export({ type: "pkcs8", format: "pem" });
const CONTO = JSON.stringify({
  type: "service_account",
  project_id: "gdahome-prova",
  client_email: "invio@gdahome-prova.iam.gserviceaccount.com",
  private_key: PRIVATA,
  token_uri: "https://altrove.example/token",
});

const unTelefono = () => `dm_${randomBytes(8).toString("hex")}`;
const unGettone = () => `gettone_${randomBytes(24).toString("hex")}`;
const unaBusta = () => randomBytes(200).toString("base64");

/* Un Firebase finto: l'accesso e l'invio, e quello che ha ricevuto. */
async function unFirebase({ morti = new Set() } = {}) {
  const ricevuti = [];
  const accessi = [];
  const server = createServer((richiesta, risposta) => {
    let corpo = "";
    richiesta.on("data", (pezzo) => (corpo += pezzo));
    richiesta.on("end", () => {
      if (richiesta.url === "/token") {
        const detto = new URLSearchParams(corpo);
        accessi.push(detto.get("assertion"));
        risposta.writeHead(200, { "content-type": "application/json" });
        risposta.end(JSON.stringify({ access_token: "accesso-finto", expires_in: 3600 }));
        return;
      }
      const messaggio = JSON.parse(corpo).message;
      ricevuti.push({
        url: richiesta.url,
        autorizzazione: richiesta.headers.authorization,
        messaggio,
      });
      if (morti.has(messaggio.token)) {
        risposta.writeHead(404, { "content-type": "application/json" });
        risposta.end(
          JSON.stringify({
            error: { status: "NOT_FOUND", details: [{ errorCode: "UNREGISTERED" }] },
          }),
        );
        return;
      }
      risposta.writeHead(200, { "content-type": "application/json" });
      risposta.end(JSON.stringify({ name: "projects/gdahome-prova/messages/1" }));
    });
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const dove = `http://127.0.0.1:${server.address().port}`;
  return {
    ricevuti,
    accessi,
    postino: (chiave) =>
      new PostinoDiFirebase({ chiave, accesso: `${dove}/token`, invio: `${dove}/v1/projects` }),
    spegni: () => new Promise((ok) => server.close(ok)),
  };
}

/* Un registro che si ricorda tutto, per guardarci dentro. */
function unRegistro() {
  const righe = [];
  const scrivi = (riga) => righe.push(String(riga));
  return { righe, info: scrivi, attenzione: scrivi, errore: scrivi, debug: scrivi };
}

test("la chiave di Firebase: si legge dal file, e se non e' un conto di servizio resta spenta", () => {
  const cartella = mkdtempSync(join(tmpdir(), "firebase-"));
  try {
    const registro = unRegistro();
    writeFileSync(join(cartella, "firebase-invio"), CONTO);
    const chiave = leggiLaChiaveDiFirebase({ cartellaDelleCredenziali: cartella, registro });
    assert.equal(chiave.progetto, "gdahome-prova");
    writeFileSync(join(cartella, "firebase-invio"), "{}");
    assert.equal(leggiLaChiaveDiFirebase({ cartellaDelleCredenziali: cartella, registro }), null);
    assert.equal(chiaveDiFirebaseDa('{"private_key":"segretissimo"}', { registro }), null);
    assert.equal(chiaveDiFirebaseDa("non json segretissimo", { registro }), null);
    assert.ok(registro.righe.length >= 2);
    assert.ok(
      !registro.righe.join("\n").includes("segretissimo"),
      "il contenuto non finisce nel registro",
    );
    assert.equal(leggiLaChiaveDiFirebase({ cartellaDelleCredenziali: "" }), null);
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("il messaggio: Android solo dati, iPhone la frase di riserva, le urgenti sensibili al tempo", async () => {
  const firebase = await unFirebase();
  try {
    const chiave = chiaveDiFirebaseDa(CONTO);
    const postino = firebase.postino(chiave);
    const busta = unaBusta();
    assert.equal(
      await postino.manda({
        gettone: unGettone(),
        telefono: "dm_0123456789abcdef",
        busta,
        urgente: true,
      }),
      "partita",
    );
    const { url, autorizzazione, messaggio } = firebase.ricevuti[0];
    assert.equal(url, "/v1/projects/gdahome-prova/messages:send");
    assert.equal(autorizzazione, "Bearer accesso-finto");
    assert.deepEqual(messaggio.data, { g: "1", d: "dm_0123456789abcdef", b: busta });
    assert.equal(
      messaggio.android.notification,
      undefined,
      "su Android nessuna frase: la scrive l'app",
    );
    assert.deepEqual(messaggio.apns.payload.aps.alert, {
      title: FRASE_DI_RISERVA.titolo,
      body: FRASE_DI_RISERVA.testo,
    });
    assert.equal(messaggio.apns.payload.aps["interruption-level"], "time-sensitive");

    /* La richiesta d'accesso e' firmata con la chiave del conto, e per Google
     * — non per l'indirizzo scritto nel JSON. */
    const [testa, dentro, firma] = firebase.accessi[0].split(".");
    const verifica = createVerify("RSA-SHA256").update(`${testa}.${dentro}`);
    assert.equal(verifica.verify(publicKey, Buffer.from(firma, "base64url")), true);
    const affermazioni = JSON.parse(Buffer.from(dentro, "base64url").toString());
    assert.equal(affermazioni.aud, "https://oauth2.googleapis.com/token");
    assert.equal(affermazioni.scope, "https://www.googleapis.com/auth/firebase.messaging");

    /* Il secondo messaggio non richiede l'accesso: vale un'ora. */
    await postino.manda({
      gettone: unGettone(),
      telefono: "dm_0123456789abcdef",
      busta,
      urgente: false,
    });
    assert.equal(firebase.accessi.length, 1);
    assert.equal(firebase.ricevuti[1].messaggio.apns.payload.aps["interruption-level"], "active");
  } finally {
    await firebase.spegni();
  }
});

test("i gettoni: per casa, chiusi a 600, e via quando la casa li toglie o Firebase non li conosce", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "spinte-"));
  const morto = unGettone();
  const firebase = await unFirebase({ morti: new Set([morto]) });
  try {
    const registro = unRegistro();
    const spinte = new Spinte({
      cartella,
      registro,
      postino: firebase.postino(chiaveDiFirebaseDa(CONTO)),
    });
    const casa = `casa_${randomBytes(16).toString("hex")}`;
    const [uno, due] = [unTelefono(), unTelefono()];
    spinte.elenco(casa, [
      { telefono: uno, gettone: unGettone() },
      { telefono: due, gettone: morto },
      { telefono: "non valido", gettone: unGettone() },
    ]);
    assert.deepEqual(Object.keys(spinte.gettoniDi(casa)).sort(), [uno, due].sort());
    const file = join(cartella, "spinte.json");
    assert.equal(statSync(file).mode & 0o777, 0o600);

    assert.equal(await spinte.spingi(casa, { telefono: uno, busta: unaBusta() }), "partita");
    assert.equal(await spinte.spingi(casa, { telefono: due, busta: unaBusta() }), "morta");
    assert.deepEqual(Object.keys(spinte.gettoniDi(casa)), [uno], "il gettone morto se ne va");
    assert.equal(await spinte.spingi(casa, { telefono: due, busta: unaBusta() }), "senza-gettone");
    /* Una casa non spinge ai telefoni di un'altra. */
    const altra = `casa_${randomBytes(16).toString("hex")}`;
    assert.equal(await spinte.spingi(altra, { telefono: uno, busta: unaBusta() }), "senza-gettone");
    /* Una busta che non e' base64, o troppo grande, non parte. */
    assert.equal(await spinte.spingi(casa, { telefono: uno, busta: "<script>" }), "rifiutata");
    assert.equal(
      await spinte.spingi(casa, { telefono: uno, busta: "A".repeat(5000) }),
      "rifiutata",
    );

    /* L'elenco vuoto toglie tutto. */
    spinte.elenco(casa, []);
    assert.deepEqual(spinte.gettoniDi(casa), {});
    /* Il disco si scrive al piu' ogni tanto: chiudendo, quello che aspetta
     * si scrive adesso. */
    spinte.chiudi();
    assert.deepEqual(JSON.parse(readFileSync(file, "utf8")).case, {});

    /* E nel registro non c'e' ne' un gettone, ne' una chiave. */
    const tutto = registro.righe.join("\n");
    assert.ok(
      !tutto.includes("gettone_") &&
        !tutto.includes("PRIVATE KEY") &&
        !tutto.includes("accesso-finto"),
    );
  } finally {
    await firebase.spegni();
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("il freno per casa: oltre il tetto al minuto le spinte si fermano", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "spinte-"));
  try {
    let mandate = 0;
    const spinte = new Spinte({
      cartella,
      perCasaAlMinuto: 3,
      postino: { manda: async () => ((mandate += 1), "partita") },
    });
    const casa = `casa_${randomBytes(16).toString("hex")}`;
    const telefono = unTelefono();
    spinte.elenco(casa, [{ telefono, gettone: unGettone() }]);
    const esiti = [];
    for (let i = 0; i < 5; i += 1)
      esiti.push(await spinte.spingi(casa, { telefono, busta: unaBusta() }));
    assert.deepEqual(esiti, ["partita", "partita", "partita", "troppe", "troppe"]);
    assert.equal(mandate, 3);
    /* Senza chiave sono spente, e non parte niente. */
    assert.equal(
      await new Spinte({ cartella }).spingi(casa, { telefono, busta: unaBusta() }),
      "spente",
    );
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("il freno delle urgenti: un minuto pieno di movimenti non ferma il campanello", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "spinte-"));
  try {
    let mandate = 0;
    const spinte = new Spinte({
      cartella,
      perCasaAlMinuto: 3,
      urgentiPerCasaAlMinuto: 2,
      postino: { manda: async () => ((mandate += 1), "partita") },
    });
    const casa = `casa_${randomBytes(16).toString("hex")}`;
    const telefono = unTelefono();
    spinte.elenco(casa, [{ telefono, gettone: unGettone() }]);
    const esiti = [];
    for (let i = 0; i < 4; i += 1)
      esiti.push(await spinte.spingi(casa, { telefono, busta: unaBusta() }));
    assert.deepEqual(esiti, ["partita", "partita", "partita", "troppe"]);
    /* Le urgenti hanno il loro freno: passano, ma un tetto lo hanno. */
    const urgente = () => spinte.spingi(casa, { telefono, busta: unaBusta(), urgente: true });
    assert.equal(await urgente(), "partita");
    assert.equal(await urgente(), "partita");
    assert.equal(await urgente(), "troppe");
    assert.equal(mandate, 5);
    /* E contano fra tutte: le normali restano ferme. */
    assert.equal(await spinte.spingi(casa, { telefono, busta: unaBusta() }), "troppe");
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("dal filo della casa: l'elenco, la spinta, e il gettone morto detto alla casa", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "centralino-"));
  const morto = unGettone();
  const firebase = await unFirebase({ morti: new Set([morto]) });
  const spinte = new Spinte({ cartella, postino: firebase.postino(chiaveDiFirebaseDa(CONTO)) });
  const centralino = new Centralino({ case: new Case({ cartella }), chiaveLicenze: "", spinte });
  const server = costruisciIlServer({ centralino });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const presa = new WebSocket(`ws://127.0.0.1:${server.address().port}/casa`);
  const detti = [];
  presa.addEventListener("message", (evento) => detti.push(JSON.parse(evento.data)));
  const aspetta = async (prova) => {
    for (let i = 0; i < 200; i += 1) {
      if (prova()) return;
      await new Promise((ok) => setTimeout(ok, 10));
    }
    throw new Error("non e' arrivato");
  };
  try {
    await new Promise((ok, no) => {
      presa.addEventListener("open", ok);
      presa.addEventListener("error", no);
    });
    const casa = `casa_${randomBytes(16).toString("hex")}`;
    presa.send(JSON.stringify({ t: "sono-io", casa, segreto: randomBytes(32).toString("hex") }));
    await aspetta(() => detti.some((d) => d.t === "bene"));

    const [vivo, andato] = [unTelefono(), unTelefono()];
    presa.send(
      JSON.stringify({
        t: "spinta-elenco",
        telefoni: [
          { telefono: vivo, gettone: unGettone() },
          { telefono: andato, gettone: morto },
        ],
      }),
    );
    await aspetta(() => Object.keys(spinte.gettoniDi(casa)).length === 2);
    const busta = unaBusta();
    presa.send(JSON.stringify({ t: "spinta", n: 1, telefono: vivo, busta, urgente: false }));
    presa.send(JSON.stringify({ t: "spinta", n: 2, telefono: andato, busta, urgente: true }));
    await aspetta(() => detti.some((d) => d.t === "spinta-morta"));
    assert.deepEqual(
      detti.find((d) => d.t === "spinta-morta"),
      { t: "spinta-morta", telefono: andato },
    );
    assert.equal(firebase.ricevuti.length, 2);
    assert.equal(firebase.ricevuti[0].messaggio.data.b, busta, "la busta arriva com'e', e basta");
    assert.deepEqual(Object.keys(spinte.gettoniDi(casa)), [vivo]);
  } finally {
    presa.close();
    centralino.chiudiTutto();
    await new Promise((ok) => server.close(ok));
    await firebase.spegni();
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("l'elenco dei gettoni: niente zavorra, un freno per casa, un tetto in tutto, e il disco non si riscrive a ogni messaggio", () => {
  const cartella = mkdtempSync(join(tmpdir(), "spinte-"));
  try {
    const spinte = new Spinte({
      cartella,
      elenchiPerCasa: 3,
      caseAlPiu: 2,
      gettoniInTutto: 5,
      scritturaAlPiuOgni: 60_000,
    });
    const casa = `casa_${randomBytes(16).toString("hex")}`;
    const telefono = unTelefono();
    /* Un gettone vero di Firebase e' sui duecento caratteri, e passa; uno da
     * quattro kilobyte e' zavorra, e no. */
    const vero = `f${randomBytes(8).toString("hex")}:APA91b${"x".repeat(160)}`;
    assert.equal(spinte.elenco(casa, [{ telefono, gettone: vero }]), true);
    assert.equal(spinte.gettoniDi(casa)[telefono], vero);
    const file = join(cartella, "spinte.json");
    const scrittoPrima = readFileSync(file, "utf8");
    assert.equal(spinte.elenco(casa, [{ telefono, gettone: "A".repeat(4096) }]), true);
    assert.deepEqual(spinte.gettoniDi(casa), {}, "un gettone da 4 KB non si tiene");

    /* Il secondo cambiamento non ha riscritto il file: aspetta il giro. */
    assert.equal(readFileSync(file, "utf8"), scrittoPrima);

    /* Oltre tre elenchi in dieci minuti, la casa non viene ascoltata. */
    assert.equal(spinte.elenco(casa, [{ telefono, gettone: unGettone() }]), true);
    assert.equal(spinte.elenco(casa, [{ telefono, gettone: unGettone() }]), "troppi");
    assert.equal(Object.keys(spinte.gettoniDi(casa)).length, 1);

    /* Il tetto delle case: la seconda entra, la terza no. */
    const seconda = `casa_${randomBytes(16).toString("hex")}`;
    const terza = `casa_${randomBytes(16).toString("hex")}`;
    assert.equal(
      spinte.elenco(seconda, [
        { telefono: unTelefono(), gettone: unGettone() },
        { telefono: unTelefono(), gettone: unGettone() },
      ]),
      true,
    );
    assert.equal(spinte.elenco(terza, [{ telefono: unTelefono(), gettone: unGettone() }]), "pieno");
    /* E quello dei gettoni: la seconda non puo' crescere oltre cinque in tutto. */
    const tanti = Array.from({ length: 5 }, () => ({
      telefono: unTelefono(),
      gettone: unGettone(),
    }));
    assert.equal(spinte.elenco(seconda, tanti), "pieno");
    assert.equal(spinte.quanti(), 3);

    /* Chiudendo, il file si scrive con l'ultimo stato. */
    spinte.chiudi();
    const sulDisco = JSON.parse(readFileSync(file, "utf8")).case;
    assert.deepEqual(Object.keys(sulDisco).sort(), [casa, seconda].sort());
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("i gettoni delle case potate se ne vanno con loro", () => {
  const cartella = mkdtempSync(join(tmpdir(), "spinte-"));
  try {
    let ora = Date.now();
    const case_ = new Case({ cartella, adesso: () => ora });
    const viva = `casa_${randomBytes(16).toString("hex")}`;
    const zitta = `casa_${randomBytes(16).toString("hex")}`;
    const segreto = randomBytes(32).toString("hex");
    assert.ok(case_.riconosci(zitta, segreto));
    ora += 200 * 24 * 60 * 60 * 1000;
    assert.ok(case_.riconosci(viva, segreto));
    const spinte = new Spinte({ cartella });
    spinte.elenco(viva, [{ telefono: unTelefono(), gettone: unGettone() }]);
    spinte.elenco(zitta, [{ telefono: unTelefono(), gettone: unGettone() }]);
    assert.equal(case_.potatura(), 1);
    assert.equal(case_.viva(zitta), false);
    assert.equal(
      spinte.potatura((casa) => case_.viva(casa)),
      1,
    );
    assert.deepEqual(spinte.gettoniDi(zitta), {});
    assert.equal(Object.keys(spinte.gettoniDi(viva)).length, 1);
    assert.equal(spinte.quanti(), 1);
    spinte.chiudi();
    case_.chiudi();
    assert.deepEqual(
      Object.keys(JSON.parse(readFileSync(join(cartella, "spinte.json"), "utf8")).case),
      [viva],
    );
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});
