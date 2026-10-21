/* Le bollette dalla posta: «A, usiamo Gmail».
 *
 * Una mail del fornitore — qui una come quelle di Enel Energia, in HTML e in
 * quoted-printable come arrivano da Gmail — diventa una bolletta; il lettore
 * IMAP entra in sola lettura e non scrive mai la password; il servizio la
 * tiene cifrata, e una password sbagliata non resta da nessuna parte. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  bollettaDalMessaggio,
  bolletteDaiMessaggi,
  dataDa,
  fornitoreDelMittente,
  importoDa,
  leggiIlMessaggio,
} from "../src/le-bollette-nella-posta.js";
import { LettoreDiRisposte, Posta, tra } from "../src/la-posta.js";
import { Bollette, indirizzoNascosto, ricercaGmail } from "../src/bollette.js";
import { ErroreDellaPosta } from "../src/la-posta.js";

const qp = (testo) =>
  Buffer.from(testo, "utf8")
    .toString("latin1")
    .replace(
      /[^\x20-\x7e\n]|=/g,
      (c) => `=${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`,
    );

function mailEnel({
  numero = "0123456789",
  importo = "52,00",
  scadenza = "05/11/2026",
  extra = "",
} = {}) {
  const html = `<html><body><p>Gentile Cliente,</p>
<p>ti informiamo che &egrave; disponibile la tua bolletta n. ${numero} del 15/10/2026.</p>
<table><tr><td>Importo da pagare</td><td>&euro; ${importo}</td></tr>
<tr><td>Scadenza</td><td>${scadenza}</td></tr></table>
<p>Periodo di fatturazione: dal 01/08/2026 al 30/09/2026. Consumo fatturato: 412 kWh.</p>
${extra}<p>Scopri l'offerta con 30 € di bonus!</p></body></html>`;
  return Buffer.from(
    [
      "From: Enel Energia <noreply@enel.it>",
      "Subject: =?UTF-8?Q?La_tua_bolletta_Enel_Energia_=C3=A8_disponibile?=",
      "Date: Thu, 15 Oct 2026 08:12:00 +0200",
      `Message-ID: <${numero}@enel.it>`,
      'Content-Type: multipart/alternative; boundary="confine"',
      "",
      "--confine",
      'Content-Type: text/html; charset="UTF-8"',
      "Content-Transfer-Encoding: quoted-printable",
      "",
      qp(html),
      "--confine--",
      "",
    ].join("\r\n"),
    "latin1",
  );
}

test("i numeri e le date all'italiana", () => {
  assert.equal(importoDa("1.234,56"), 1234.56);
  assert.equal(importoDa("52,00"), 52);
  assert.equal(importoDa("52.00"), 52);
  assert.equal(new Date(dataDa("05/11/2026")).getMonth(), 10);
  assert.equal(new Date(dataDa("5 novembre 2026")).getDate(), 5);
  assert.equal(dataDa("31/02/2026"), null);
});

test("il mittente dice il fornitore", () => {
  assert.equal(fornitoreDelMittente("Enel Energia <noreply@enel.it>").id, "enel");
  assert.equal(fornitoreDelMittente("x@comunicazioni.enelenergia.it").id, "enel");
  assert.equal(fornitoreDelMittente("amico@gmail.com"), null);
});

test("la mail di Enel diventa una bolletta: importo, scadenza, periodo, consumo", () => {
  const m = leggiIlMessaggio(mailEnel());
  assert.equal(m.oggetto, "La tua bolletta Enel Energia è disponibile");
  const b = bollettaDalMessaggio(m);
  assert.equal(b.fornitore, "enel");
  assert.equal(b.numero, "0123456789");
  assert.equal(b.importo, 52);
  assert.equal(new Date(b.scadenza).getDate(), 5);
  assert.equal(new Date(b.periodo.dal).getMonth(), 7);
  assert.equal(new Date(b.periodo.al).getMonth(), 8);
  assert.deepEqual(b.consumo, { valore: 412, unita: "kwh" });
  /* Il bonus in fondo non e' l'importo. */
  assert.notEqual(b.importo, 30);
  assert.equal(b.pagata, null);
});

test("con la domiciliazione la bolletta e' gia' pagata", () => {
  const b = bollettaDalMessaggio(
    mailEnel({ extra: "<p>L'importo sar&agrave; addebitato sul conto corrente indicato.</p>" }),
  );
  assert.equal(b.pagata, true);
});

test("una promozione non e' una bolletta, e la stessa bolletta si conta una volta", () => {
  const promo = Buffer.from(
    "From: news@enel.it\r\nSubject: Offerta speciale\r\nContent-Type: text/plain\r\n\r\nSolo per te 50 euro di sconto",
  );
  assert.equal(bollettaDalMessaggio(promo), null);
  const due = bolletteDaiMessaggi([
    mailEnel(),
    mailEnel(),
    mailEnel({ numero: "999888777", importo: "61,20" }),
  ]);
  assert.equal(due.length, 2);
});

/* ── il lettore IMAP, contro una presa finta ─────────────────────────── */

class PresaFinta extends EventEmitter {
  constructor(risposte) {
    super();
    this.scritte = [];
    this.risposte = risposte;
    setImmediate(() => this.emit("data", Buffer.from("* OK Gimap ready\r\n")));
  }
  write(riga) {
    this.scritte.push(riga);
    const tag = riga.split(" ")[0];
    const comando = riga.split(" ")[1];
    const corpo = this.risposte[comando]?.(tag) ?? `${tag} OK fatto\r\n`;
    setImmediate(() =>
      this.emit("data", Buffer.isBuffer(corpo) ? corpo : Buffer.from(corpo, "latin1")),
    );
  }
  end() {}
  destroy() {}
}

test("il lettore IMAP: letterali, sola lettura, e la password mai nel registro", async () => {
  const messaggio = mailEnel();
  const registro = {
    righe: [],
    info(r) {
      this.righe.push(r);
    },
  };
  const presa = new PresaFinta({
    UID: (tag) =>
      /SEARCH/.test(presa.scritte.at(-1))
        ? `* SEARCH 4 7\r\n${tag} OK SEARCH completed\r\n`
        : Buffer.concat([
            Buffer.from(`* 1 FETCH (UID 4 BODY[] {${messaggio.length}}\r\n`, "latin1"),
            messaggio,
            Buffer.from(`)\r\n${tag} OK FETCH completed\r\n`, "latin1"),
          ]),
  });
  const posta = new Posta({ presa, registro });
  await posta.apri();
  await posta.entra("casa@gmail.com", 'segreto"con\\virgolette');
  await posta.apriLaCartella();
  const uid = await posta.cerca({ gmail: ricercaGmail(["enel"]) });
  assert.deepEqual(uid, [4, 7]);
  const letti = await posta.leggi([4]);
  assert.equal(letti.length, 1);
  assert.equal(bollettaDalMessaggio(letti[0]).importo, 52);
  assert.ok(presa.scritte.some((r) => r.includes("EXAMINE")));
  assert.ok(presa.scritte.some((r) => r.includes("BODY.PEEK[]")));
  assert.ok(!presa.scritte.some((r) => /\bSELECT\b|\bSTORE\b/.test(r)));
  assert.ok(presa.scritte[0].includes(tra('segreto"con\\virgolette')));
  assert.ok(!registro.righe.join("\n").includes("segreto"));
});

test("le risposte a pezzi si rimettono insieme", () => {
  const l = new LettoreDiRisposte();
  l.aggiungi(Buffer.from("* 1 FETCH (BODY[] {5}\r\nab"));
  assert.equal(l.prossima(), null);
  l.aggiungi(Buffer.from("cde)\r\n"));
  const r = l.prossima();
  assert.equal(r.letterali[0].toString(), "abcde");
});

/* ── il servizio ─────────────────────────────────────────────────────── */

function postaFinta({ rifiuta = false, messaggi = [mailEnel()] } = {}) {
  return () => ({
    async apri() {},
    async entra() {
      if (rifiuta) throw new ErroreDellaPosta("accesso", "Invalid credentials");
    },
    async apriLaCartella() {},
    async cerca() {
      return messaggi.map((_m, i) => i + 1);
    },
    async leggi() {
      return messaggi;
    },
    async esci() {},
  });
}

test("collegare: la password resta cifrata, non torna indietro, e quella sbagliata non si salva", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "bollette-"));
  const sbagliata = new Bollette({ cartella, apriLaPosta: postaFinta({ rifiuta: true }) });
  assert.deepEqual(
    await sbagliata.collega({ email: "casa@gmail.com", password: "abcd efgh ijkl mnop" }),
    {
      errore: "accesso-rifiutato",
    },
  );
  assert.equal(sbagliata.stato().collegata, false);

  const bollette = new Bollette({ cartella, apriLaPosta: postaFinta() });
  const stato = await bollette.collega({
    email: "Casa@Gmail.com",
    password: "abcd efgh ijkl mnop",
    fornitori: ["enel", "inventato"],
  });
  assert.equal(stato.collegata, true);
  assert.equal(stato.indirizzo, "c•••@gmail.com");
  assert.deepEqual(stato.fornitori, ["enel"]);
  assert.equal(stato.bollette[0].importo, 52);
  assert.ok(!JSON.stringify(stato).includes("abcd"));
  const sulDisco = readFileSync(join(cartella, "bollette.json"), "utf8");
  assert.ok(!sulDisco.includes("abcdefghijklmnop"));
  /* E si riapre: la stessa chiave decifra la stessa password. */
  const riaperta = new Bollette({ cartella, apriLaPosta: postaFinta() });
  assert.equal((await riaperta.aggiorna()).errore, "");
  assert.equal(riaperta.scollega().collegata, false);
});

test("l'indirizzo si dice nascosto, e la ricerca guarda solo i fornitori", () => {
  assert.equal(indirizzoNascosto("daniele@gmail.com"), "d•••@gmail.com");
  assert.match(ricercaGmail(["enel"]), /from:enel\.it/);
  assert.doesNotMatch(ricercaGmail(["enel"]), /eon/);
});
