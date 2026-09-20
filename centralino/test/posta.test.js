/* Il modulo dei contatti, provato con un server di posta finto e uno vero.
 *
 * Il server di posta e' finto ma il protocollo e' vero: la presa e' una presa
 * TCP di Node, STARTTLS cifra davvero con un certificato fatto per le prove,
 * e quello che il finto riceve e' quello che riceverebbe il server della
 * casella. Le regole che contano, e che si rompono in silenzio:
 *
 *  - **in chiaro non si parla**: se il server non offre STARTTLS la password
 *    non deve partire, e la lettera nemmeno;
 *  - **«partito» solo se e' partito**: il 250 dopo DATA, e nient'altro;
 *  - **la porta non fa finta**: senza server di posta risponde che non e'
 *    configurata, e dice dove scrivere;
 *  - quello che una persona scrive nel nome non diventa un'intestazione.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer as ascoltaInChiaro } from "node:net";
import { TLSSocket, createServer as ascoltaCifrato } from "node:tls";

import {
  Contatti,
  LETTERE_ALL_ORA,
  Postino,
  PostaNonParte,
  daChi,
  emailBuona,
  laLettera,
  paginaDellEsito,
  parolaCodificata,
} from "../src/posta.js";
import { costruisciIlServer } from "../src/server.js";

/* Un certificato per «posta.prova» e 127.0.0.1, buono per cent'anni e per
 * nient'altro: la chiave e' qui, quindi non protegge niente e non deve. */
const CHIAVE = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgLc0QqbczhWaL8n7/
lNHOAJBSYZIEOGROnzvR8fNTSYahRANCAAQfekVnzKK3o/+Zii18UmbIo0p/bDMD
7a7tw8s/TF8W0yLSJC4G7cavglJs7WbD/oDWT/YnTQEYkrTeDHidPM25
-----END PRIVATE KEY-----
`;
const CERTIFICATO = `-----BEGIN CERTIFICATE-----
MIIBojCCAUegAwIBAgIUCAQxA+t1d2PwpERupzOEnP1mKyEwCgYIKoZIzj0EAwIw
FjEUMBIGA1UEAwwLcG9zdGEucHJvdmEwIBcNMjYwOTIwMTU1NDEyWhgPMjEyNjA4
MjcxNTU0MTJaMBYxFDASBgNVBAMMC3Bvc3RhLnByb3ZhMFkwEwYHKoZIzj0CAQYI
KoZIzj0DAQcDQgAEH3pFZ8yit6P/mYotfFJmyKNKf2wzA+2u7cPLP0xfFtMi0iQu
Bu3Gr4JSbO1mw/6A1k/2J00BGJK03gx4nTzNuaNxMG8wHQYDVR0OBBYEFAzVELYb
97Qs3x6y6d+SsiT8ABEFMB8GA1UdIwQYMBaAFAzVELYb97Qs3x6y6d+SsiT8ABEF
MA8GA1UdEwEB/wQFMAMBAf8wHAYDVR0RBBUwE4ILcG9zdGEucHJvdmGHBH8AAAEw
CgYIKoZIzj0EAwIDSQAwRgIhAO4/XPXCYKHS/JFlJcvgP3SFPMMszqf2caGHuNVZ
MkeKAiEArkXISK54XBR3AfEdketGYSsQPL56L8kEpqZv3O4YQbw=
-----END CERTIFICATE-----
`;

/* ─── Il server di posta finto ───────────────────────────────────────────── */

/* Parla SMTP quanto basta, e tiene tutto quello che gli arriva. Le manopole:
 * `starttls` (lo offre o no), `cifratoDaSubito` (la 465), `rifiuta` (dice di
 * no alla password). */
async function serverDiPosta({ starttls = true, cifratoDaSubito = false, rifiuta = false } = {}) {
  const ricevuto = { comandi: [], lettere: [], cifrato: false, utente: null, password: null };

  const servi = (presa) => {
    let cifrata = presa instanceof TLSSocket;
    let resto = "";
    let dentroDATA = false;
    let lettera = "";
    const di = (riga) => presa.write(`${riga}\r\n`);

    const rispondi = (riga) => {
      if (dentroDATA) {
        if (riga === ".") {
          dentroDATA = false;
          ricevuto.lettere.push(lettera);
          lettera = "";
          di("250 presa");
        } else {
          lettera += `${riga.replace(/^\.\./, ".")}\n`;
        }
        return;
      }
      ricevuto.comandi.push(riga);
      const verbo = riga.split(/[ :]/)[0].toUpperCase();
      if (verbo === "EHLO") {
        di("250-posta.prova saluta");
        if (starttls && !cifrata) di("250-STARTTLS");
        di("250-AUTH PLAIN LOGIN");
        di("250 8BITMIME");
      } else if (verbo === "STARTTLS") {
        di("220 vai");
        presa.removeAllListeners("data");
        const sopra = new TLSSocket(presa, { isServer: true, key: CHIAVE, cert: CERTIFICATO });
        cifrata = true;
        ricevuto.cifrato = true;
        ascolta(sopra);
      } else if (verbo === "AUTH") {
        const [, , chiave] = riga.split(" ");
        const [, utente, password] = Buffer.from(chiave, "base64").toString("utf8").split("\0");
        ricevuto.utente = utente;
        ricevuto.password = password;
        di(rifiuta ? "535 no" : "235 entra");
      } else if (verbo === "MAIL" || verbo === "RCPT") {
        di("250 ok");
      } else if (verbo === "DATA") {
        dentroDATA = true;
        di("354 dimmi");
      } else if (verbo === "QUIT") {
        di("221 ciao");
        presa.end();
      } else {
        di("500 non so");
      }
    };

    const ascolta = (su) => {
      resto = "";
      su.on("data", (pezzo) => {
        resto += pezzo.toString("utf8");
        let fine;
        while ((fine = resto.indexOf("\r\n")) !== -1) {
          const riga = resto.slice(0, fine);
          resto = resto.slice(fine + 2);
          rispondi(riga);
        }
      });
      su.on("error", () => {});
      /* La presa cifrata non e' nuova: e' la stessa, e chi ci scrive sopra
       * deve scrivere cifrato. */
      presa = su;
    };

    presa.on("error", () => {});
    di("220 posta.prova pronta");
    ascolta(presa);
  };

  const server = cifratoDaSubito
    ? ascoltaCifrato({ key: CHIAVE, cert: CERTIFICATO }, servi)
    : ascoltaInChiaro(servi);
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  return {
    porta: server.address().port,
    ricevuto,
    spegni: () => new Promise((ok) => server.close(ok)),
  };
}

const unPostino = (posta, altro = {}) =>
  new Postino({
    server: "127.0.0.1",
    porta: posta.porta,
    utente: "assistenza@gdahome.org",
    password: "la-password",
    miChiamo: "tramite.prova",
    ca: [CERTIFICATO],
    ...altro,
  });

const unaLettera = (altro = {}) =>
  laLettera({
    nome: "Anna Verdi",
    email: "anna@esempio.it",
    messaggio: "Seguo dodici impianti in provincia di Bari.\nVorrei un accesso.",
    da: "assistenza@gdahome.org",
    a: "assistenza@gdahome.org",
    sito: "gdahome.org",
    quando: new Date("2026-09-20T15:00:00Z"),
    caso: "abc123",
    ...altro,
  });

/* ─── La lettera ─────────────────────────────────────────────────────────── */

test("la lettera ha le intestazioni giuste, e chi ha scritto sta nel Reply-To", () => {
  const { testo, mittente, destinatario, oggetto } = unaLettera();
  assert.equal(mittente, "assistenza@gdahome.org");
  assert.equal(destinatario, "assistenza@gdahome.org");
  assert.equal(oggetto, "Dal sito gdahome.org: Anna Verdi");
  assert.match(
    testo,
    /^From: "gdahome\.org, il modulo dei contatti" <assistenza@gdahome\.org>\r\n/,
  );
  assert.match(testo, /\r\nTo: <assistenza@gdahome\.org>\r\n/);
  assert.match(testo, /\r\nReply-To: "Anna Verdi" <anna@esempio\.it>\r\n/);
  assert.match(testo, /\r\nSubject: Dal sito gdahome\.org: Anna Verdi\r\n/);
  assert.match(testo, /\r\nDate: Sun, 20 Sep 2026 15:00:00 \+0000\r\n/);
  assert.match(testo, /\r\nMessage-ID: <abc123@gdahome\.org>\r\n/);
  assert.match(testo, /\r\nContent-Type: text\/plain; charset="utf-8"\r\n/);
  assert.match(testo, /\r\nContent-Transfer-Encoding: base64\r\n\r\n/);
  assert.ok(testo.endsWith("\r\n"));

  const corpo = Buffer.from(testo.split("\r\n\r\n")[1].replace(/\r\n/g, ""), "base64").toString(
    "utf8",
  );
  assert.match(corpo, /^Nome: Anna Verdi\nEmail: anna@esempio\.it\nLingua della pagina: it\n/);
  assert.match(corpo, /Seguo dodici impianti in provincia di Bari\.\nVorrei un accesso\.\n$/);
});

test("le lettere fuori dall'ASCII si dichiarano, e il corpo non ha righe oltre le 76", () => {
  assert.equal(parolaCodificata("Anna"), "Anna");
  assert.equal(parolaCodificata("Niccolò"), "=?UTF-8?B?TmljY29sw7I=?=");
  const { testo } = unaLettera({ nome: "Niccolò Rè", messaggio: "à".repeat(400) });
  assert.match(testo, /\r\nReply-To: =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?= <anna@esempio\.it>\r\n/);
  assert.match(testo, /\r\nSubject: =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=\r\n/);
  for (const riga of testo.split("\r\n")) assert.ok(riga.length <= 78, `riga lunga: ${riga}`);
});

test("un ritorno a capo nel nome non diventa un'intestazione", () => {
  const { testo } = unaLettera({ nome: 'Anna\r\nBcc: tutti@esempio.it\r\n"' });
  assert.doesNotMatch(testo, /\r\nBcc:/);
  assert.match(testo, /\r\nReply-To: "Anna Bcc: tutti@esempio\.it \\"" <anna@esempio\.it>\r\n/);
});

test("si riconosce un indirizzo, e si rifiuta quello che non lo e'", () => {
  assert.ok(emailBuona("anna@esempio.it"));
  assert.ok(emailBuona("  anna.verdi+casa@posta.esempio.co.uk "));
  for (const brutto of [
    "anna",
    "anna@esempio",
    "@esempio.it",
    "anna@esempio.it, altro@x.it",
    "a <b@c.it>",
    `${"a".repeat(200)}@x.it`,
    "",
    null,
  ]) {
    assert.ok(!emailBuona(brutto), `«${brutto}» passa e non dovrebbe`);
  }
});

/* ─── Il postino ─────────────────────────────────────────────────────────── */

test("il postino consegna con STARTTLS: si presenta cifrato e la lettera arriva intera", async () => {
  const posta = await serverDiPosta();
  try {
    await unPostino(posta).manda(unaLettera());
    assert.equal(posta.ricevuto.cifrato, true, "non ha cifrato");
    assert.equal(posta.ricevuto.utente, "assistenza@gdahome.org");
    assert.equal(posta.ricevuto.password, "la-password");
    const verbi = posta.ricevuto.comandi.map((uno) => uno.split(/[ :]/)[0]);
    assert.deepEqual(verbi, ["EHLO", "STARTTLS", "EHLO", "AUTH", "MAIL", "RCPT", "DATA", "QUIT"]);
    /* La password viaggia dopo STARTTLS, mai prima. */
    assert.ok(verbi.indexOf("AUTH") > verbi.indexOf("STARTTLS"));
    assert.ok(posta.ricevuto.comandi.includes("MAIL FROM:<assistenza@gdahome.org>"));
    assert.ok(posta.ricevuto.comandi.includes("RCPT TO:<assistenza@gdahome.org>"));
    assert.equal(posta.ricevuto.lettere.length, 1);
    assert.match(posta.ricevuto.lettere[0], /^From: "gdahome\.org, il modulo dei contatti"/);
    assert.match(posta.ricevuto.lettere[0], /\nReply-To: "Anna Verdi" <anna@esempio\.it>\n/);
  } finally {
    await posta.spegni();
  }
});

test("il postino consegna anche con TLS da subito, come sulla 465", async () => {
  const posta = await serverDiPosta({ cifratoDaSubito: true });
  try {
    await unPostino(posta, { sicurezza: "tls" }).manda(unaLettera());
    const verbi = posta.ricevuto.comandi.map((uno) => uno.split(/[ :]/)[0]);
    assert.deepEqual(verbi, ["EHLO", "AUTH", "MAIL", "RCPT", "DATA", "QUIT"]);
    assert.equal(posta.ricevuto.lettere.length, 1);
  } finally {
    await posta.spegni();
  }
});

test("se il server non offre STARTTLS, la password non parte e la lettera nemmeno", async () => {
  const posta = await serverDiPosta({ starttls: false });
  try {
    await assert.rejects(unPostino(posta).manda(unaLettera()), (errore) => {
      assert.ok(errore instanceof PostaNonParte);
      assert.match(errore.message, /STARTTLS/);
      return true;
    });
    assert.equal(posta.ricevuto.utente, null, "la password e' partita in chiaro");
    assert.equal(posta.ricevuto.lettere.length, 0);
  } finally {
    await posta.spegni();
  }
});

test("una password rifiutata e' un errore che non porta la password", async () => {
  const posta = await serverDiPosta({ rifiuta: true });
  try {
    await assert.rejects(unPostino(posta).manda(unaLettera()), (errore) => {
      assert.ok(errore instanceof PostaNonParte);
      assert.match(errore.message, /535 a AUTH/);
      assert.doesNotMatch(errore.message, /la-password/);
      assert.doesNotMatch(errore.message, /bGEtcGFzc3dvcmQ/, "c'e' la password in base64");
      return true;
    });
    assert.equal(posta.ricevuto.lettere.length, 0);
  } finally {
    await posta.spegni();
  }
});

test("in chiaro si parla solo con questa macchina, e un server che non c'e' e' un errore", async () => {
  assert.throws(
    () => new Postino({ server: "smtp.esempio.it", sicurezza: "nessuna" }),
    PostaNonParte,
  );
  assert.throws(() => new Postino({ server: "smtp.esempio.it", sicurezza: "boh" }), PostaNonParte);
  assert.equal(new Postino({ server: "smtp.esempio.it", porta: 465 }).sicurezza, "tls");
  assert.equal(new Postino({ server: "smtp.esempio.it" }).sicurezza, "starttls");
  assert.equal(new Postino().pronto, false);
  await assert.rejects(new Postino().manda(unaLettera()), PostaNonParte);
  await assert.rejects(
    new Postino({ server: "127.0.0.1", porta: 9, attesa: 2000 }).manda(unaLettera()),
    PostaNonParte,
  );
});

/* ─── La porta ───────────────────────────────────────────────────────────── */

const centralinoFinto = { quanteCase: () => 0, quantiTelefoni: () => 0 };

async function banco({ posta = null, a = "assistenza@gdahome.org", lettereAllOra, adesso } = {}) {
  const contatti = new Contatti({
    postino: posta ? unPostino(posta) : null,
    da: "assistenza@gdahome.org",
    a,
    sito: "gdahome.org",
    ...(lettereAllOra ? { lettereAllOra } : {}),
    ...(adesso ? { adesso } : {}),
  });
  const server = costruisciIlServer({ centralino: centralinoFinto, contatti });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const http = `http://127.0.0.1:${server.address().port}`;
  return {
    http,
    contatti,
    manda: (corpo, intestazioni = {}) =>
      fetch(`${http}/contatto`, {
        method: "POST",
        headers: { "content-type": "application/json", ...intestazioni },
        body: JSON.stringify(corpo),
      }),
    spegni: () => new Promise((ok) => server.close(ok)),
  };
}

const unMessaggio = (altro = {}) => ({
  nome: "Anna Verdi",
  email: "anna@esempio.it",
  messaggio: "Vorrei un accesso al cruscotto.",
  lingua: "it",
  ...altro,
});

test("dal sito si scrive, e la lettera arriva: /salute lo dice", async () => {
  const posta = await serverDiPosta();
  const b = await banco({ posta });
  try {
    assert.equal((await (await fetch(`${b.http}/salute`)).json()).posta, true);
    const risposta = await b.manda(unMessaggio());
    assert.equal(risposta.status, 200);
    assert.deepEqual(await risposta.json(), { inviato: true });
    assert.equal(posta.ricevuto.lettere.length, 1);
    assert.match(posta.ricevuto.lettere[0], /\nReply-To: "Anna Verdi" <anna@esempio\.it>\n/);
  } finally {
    await b.spegni();
    await posta.spegni();
  }
});

test("quello che manca o non va si dice, e non parte niente", async () => {
  const posta = await serverDiPosta();
  const b = await banco({ posta });
  try {
    const casi = [
      [unMessaggio({ nome: "  " }), "manca_il_nome"],
      [unMessaggio({ email: "anna" }), "email_sbagliata"],
      [unMessaggio({ messaggio: "" }), "manca_il_messaggio"],
      [unMessaggio({ messaggio: "x".repeat(5001) }), "troppo_lungo"],
      [unMessaggio({ nome: "x".repeat(121) }), "troppo_lungo"],
    ];
    for (const [corpo, errore] of casi) {
      const risposta = await b.manda(corpo);
      assert.equal(risposta.status, 400, errore);
      assert.equal((await risposta.json()).errore, errore);
    }
    const nonJson = await fetch(`${b.http}/contatto`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{non json",
    });
    assert.equal(nonJson.status, 400);
    const tipoStrano = await fetch(`${b.http}/contatto`, {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "ciao",
    });
    assert.equal(tipoStrano.status, 415);
    const get = await fetch(`${b.http}/contatto`);
    assert.equal(get.status, 405);
    assert.equal(get.headers.get("allow"), "POST");
    assert.equal(posta.ricevuto.lettere.length, 0);
  } finally {
    await b.spegni();
    await posta.spegni();
  }
});

test("la trappola piena fa dire «partito» senza spedire niente", async () => {
  const posta = await serverDiPosta();
  const b = await banco({ posta });
  try {
    const risposta = await b.manda(unMessaggio({ sito: "http://spam.esempio" }));
    assert.equal(risposta.status, 200);
    assert.deepEqual(await risposta.json(), { inviato: true });
    assert.equal(posta.ricevuto.lettere.length, 0);
  } finally {
    await b.spegni();
    await posta.spegni();
  }
});

test("senza server di posta la porta non fa finta: dice che e' spenta, e dove scrivere", async () => {
  const b = await banco();
  try {
    assert.equal((await (await fetch(`${b.http}/salute`)).json()).posta, false);
    const risposta = await b.manda(unMessaggio());
    assert.equal(risposta.status, 503);
    const detto = await risposta.json();
    assert.equal(detto.errore, "posta_spenta");
    assert.equal(detto.scrivi, "assistenza@gdahome.org");
  } finally {
    await b.spegni();
  }
});

test("un server di posta che dice di no e' un 502, e la pagina lo dice a chi non ha JavaScript", async () => {
  const posta = await serverDiPosta({ rifiuta: true });
  const b = await banco({ posta });
  try {
    const risposta = await b.manda(unMessaggio());
    assert.equal(risposta.status, 502);
    assert.equal((await risposta.json()).errore, "posta");

    const dalModulo = await fetch(`${b.http}/contatto`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(unMessaggio({ lingua: "en" })).toString(),
    });
    assert.equal(dalModulo.status, 502);
    assert.match(dalModulo.headers.get("content-type"), /^text\/html/);
    const pagina = await dalModulo.text();
    assert.match(pagina, /Your message did not go out\./);
    assert.match(pagina, /mailto:assistenza@gdahome\.org/);
  } finally {
    await b.spegni();
    await posta.spegni();
  }
});

test("il modulo senza JavaScript e' un modulo: risponde con una pagina, nella sua lingua", async () => {
  const posta = await serverDiPosta();
  const b = await banco({ posta });
  try {
    const risposta = await fetch(`${b.http}/contatto`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(unMessaggio({ nome: "Anna & Co" })).toString(),
    });
    assert.equal(risposta.status, 200);
    assert.match(risposta.headers.get("content-type"), /^text\/html/);
    const pagina = await risposta.text();
    assert.match(pagina, /<html lang="it">/);
    assert.match(pagina, /Il messaggio è partito\./);
    assert.match(pagina, /href="\/#contatti"/);
    assert.equal(posta.ricevuto.lettere.length, 1);

    /* Niente viene da fuori, come nelle pagine del sito. */
    assert.doesNotMatch(pagina, /(?:src|href)="(https?:)?\/\//);
    /* E quello che si scrive nella pagina non e' HTML. */
    assert.doesNotMatch(
      paginaDellEsito({ detto: {}, scrivi: "<b>x</b>@y.it", stato: 503 }),
      /<b>x/,
    );
  } finally {
    await b.spegni();
    await posta.spegni();
  }
});

test("cinque lettere all'ora per indirizzo, e l'indirizzo e' quello che dice Caddy", async () => {
  const posta = await serverDiPosta();
  let ora = 1_000_000;
  const b = await banco({ posta, adesso: () => ora });
  try {
    for (let volta = 0; volta < LETTERE_ALL_ORA; volta += 1) {
      const risposta = await b.manda(unMessaggio(), { "x-forwarded-for": "203.0.113.7" });
      assert.equal(risposta.status, 200, `la ${volta + 1}ª`);
    }
    const dopo = await b.manda(unMessaggio(), { "x-forwarded-for": "203.0.113.7" });
    assert.equal(dopo.status, 429);
    assert.equal((await dopo.json()).errore, "troppo_spesso");
    /* Un altro indirizzo non c'entra. */
    const altro = await b.manda(unMessaggio(), { "x-forwarded-for": "203.0.113.8, 10.0.0.1" });
    assert.equal(altro.status, 200);
    /* Passata un'ora, si ricomincia. */
    ora += 60 * 60 * 1000 + 1;
    const piuTardi = await b.manda(unMessaggio(), { "x-forwarded-for": "203.0.113.7" });
    assert.equal(piuTardi.status, 200);
    assert.equal(posta.ricevuto.lettere.length, LETTERE_ALL_ORA + 2);
  } finally {
    await b.spegni();
    await posta.spegni();
  }
});

test("l'indirizzo passato si crede solo se lo porta questa macchina", () => {
  const con = (remoteAddress, xff) =>
    daChi({ socket: { remoteAddress }, headers: { "x-forwarded-for": xff } });
  assert.equal(con("127.0.0.1", "203.0.113.7"), "203.0.113.7");
  assert.equal(con("::ffff:127.0.0.1", "203.0.113.7, 10.0.0.1"), "203.0.113.7");
  assert.equal(con("127.0.0.1", undefined), "127.0.0.1");
  /* Da fuori, l'intestazione la scrive chi vuole: non si crede. */
  assert.equal(con("198.51.100.4", "203.0.113.7"), "198.51.100.4");
});
