/* Le prove della chat di assistenza: quella della dashboard, fatta dal ponte.
 *
 * Quello che conta qui non e' che le parole arrivino — quello lo fa una
 * richiesta HTTP — ma le tre regole che, sbagliate, perdono un messaggio senza
 * dirlo a nessuno:
 *
 * - il **segnalibro** si sposta di uno per volta e non salta: la propria frase
 *   ha il numero piu' alto di tutti, e prenderla come segno lascerebbe indietro
 *   una risposta arrivata nel frattempo;
 * - una conversazione **cancellata** dal centralino va via anche di qua, perche'
 *   e' quello che era stato promesso;
 * - un centralino **giu'** non e' una schermata vuota: la copia in casa esiste
 *   per questo, e il guasto si dice accanto alle parole, non al posto loro.
 *
 * E una cosa che non si vede: il segreto della casa non esce da qui.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Chat, ChatHaDettoNo, unaIdentita } from "../src/chat.js";

const ZITTO = { info() {}, attenzione() {}, errore() {} };

/* Un centralino della chat finto: tiene le righe, le da' «dopo il numero N»,
 * e si ricorda come gli si e' bussato. */
function centralinoFinto({ righe = [], aperta = true, rotto = false } = {}) {
  const chiamate = [];
  /* Il numero lo da' il centralino, e lo da' sempre piu' alto di tutti quelli
   * che ha: si calcola al momento e non una volta sola, se no una riga
   * aggiunta dalla prova — chi risponde che scrive nel frattempo — si
   * prenderebbe il numero del messaggio dopo. */
  const prossimo = () => righe.reduce((piu, riga) => Math.max(piu, riga.id), 0) + 1;
  const prendi = async (url, opzioni = {}) => {
    const via = new URL(url);
    chiamate.push({
      via: via.pathname + via.search,
      metodo: opzioni.method,
      intestazioni: opzioni.headers,
      corpo: opzioni.body ? JSON.parse(opzioni.body) : null,
    });
    if (rotto) throw new Error("ECONNREFUSED");
    if (via.pathname !== "/casa/messaggi") {
      return { ok: false, status: 404, json: async () => ({ errore: "non_trovato" }) };
    }
    if (opzioni.method === "POST") {
      const nuova = !righe.length;
      const riga = {
        id: prossimo(),
        da: "casa",
        testo: JSON.parse(opzioni.body).testo,
        scritto_il: 1000,
      };
      righe.push(riga);
      return { ok: true, status: 201, json: async () => ({ messaggio: riga, nuova }) };
    }
    if (opzioni.method === "DELETE") {
      righe.length = 0;
      return { ok: true, status: 200, json: async () => ({ cancellata: true }) };
    }
    const dopo = Number(via.searchParams.get("dopo") || 0);
    return {
      ok: true,
      status: 200,
      json: async () => ({ aperta, messaggi: righe.filter((riga) => riga.id > dopo) }),
    };
  };
  return { prendi, chiamate, righe };
}

function unaChat(centralino, { adesso = () => 1000, giaAperta = false } = {}) {
  const cartella = mkdtempSync(join(tmpdir(), "chat-"));
  const chat = new Chat({
    cartella,
    centralino: "https://centralino.esempio",
    versione: "0.16.0",
    plancia: "1.4.19",
    fetch: centralino.prendi,
    registro: ZITTO,
    adesso,
  });
  /* Una casa che la chat l'ha gia' aperta: senza la linea non si rilegge
   * niente, ed e' giusto — chi non ha mai scritto non ha nulla da rileggere. */
  if (giaAperta) {
    chat.dati.identita = unaIdentita();
    chat.archivio.salva();
  }
  return { chat, cartella, via: () => rmSync(cartella, { recursive: true, force: true }) };
}

test("un nome e un segreto presi dal caso, e il segreto non esce da qui", async () => {
  const una = unaIdentita();
  assert.match(una.casa, /^casa_[0-9a-f]{32}$/);
  assert.match(una.segreto, /^[0-9a-f]{64}$/);
  assert.notEqual(unaIdentita().casa, una.casa);

  const centralino = centralinoFinto();
  const { chat, via } = unaChat(centralino);
  try {
    /* Prima della prima parola questa casa non esiste per il centralino: chi
     * la chat non l'ha mai usata non ha lasciato niente da nessuna parte. */
    assert.equal(chat.aperta, false);
    assert.deepEqual(chat.stato(), {
      enabled: true,
      console: false,
      opened: false,
      name: "",
      unread: 0,
      preview: "",
      written_at: 0,
      messages: 0,
    });

    const detto = await chat.scrivi("Buongiorno, una domanda.", { nome: "Giovanni" });
    assert.equal(chat.aperta, true);
    /* La risposta alla finestra porta il messaggio e nient'altro: nessuna
     * traccia del segreto, e nessun identificativo di questa casa. */
    const scritto = JSON.stringify(detto);
    assert.doesNotMatch(scritto, /[0-9a-f]{64}/);
    assert.doesNotMatch(scritto, /casa_/);

    /* Al centralino invece si va col segno: e' l'unico modo per dimostrare
     * che chi bussa e' la stessa casa di ieri. */
    const posta = centralino.chiamate.find((una) => una.metodo === "POST");
    assert.match(posta.intestazioni.authorization, /^Bearer [0-9a-f]{64}$/);
    assert.match(posta.intestazioni["x-casa"], /^casa_[0-9a-f]{32}$/);
    /* Sotto «versione» chi risponde legge di cosa si sta parlando: la plancia
     * davanti — e' quella che manda l'integrazione, ed e' quella di cui si
     * chiede — e poi che in mezzo c'e' il ponte. Senza le parole sarebbero
     * due numeri, e «0.16.0» letto come una versione della plancia porta a
     * cercare un difetto che non e' mai esistito. */
    assert.equal(posta.intestazioni["x-versione"], "plancia 1.4.19 ponte 0.16.0");
    /* Chi gira non e' Home Assistant ma il ponte: non si finge una versione
     * che non c'e'. */
    assert.equal(posta.intestazioni["x-ha"], "");
    assert.equal(posta.intestazioni["x-nome"], "Giovanni");
    assert.deepEqual(posta.corpo, { testo: "Buongiorno, una domanda.", nome: "Giovanni" });
  } finally {
    via();
  }
});

test("il segnalibro non salta una risposta arrivata mentre si scriveva", async () => {
  /* E' il difetto che questa prova esiste per tenere fuori: il numero che il
   * centralino da' alla propria frase e' il piu' alto di tutti, e prenderlo
   * come segnalibro lascerebbe indietro per sempre una risposta arrivata nei
   * secondi prima. */
  const centralino = centralinoFinto({
    righe: [{ id: 1, da: "casa", testo: "la prima", scritto_il: 1 }],
  });
  const { chat, via } = unaChat(centralino, { giaAperta: true });
  try {
    await chat.conversazione();
    assert.deepEqual(
      chat.messaggi.map((riga) => riga.id),
      [1],
    );
    /* Chi risponde scrive, e nessuno l'ha ancora letto. */
    centralino.righe.push({ id: 2, da: "console", testo: "ti rispondo", scritto_il: 2 });
    /* E intanto da qui si manda un'altra frase. */
    await chat.scrivi("un'altra cosa");
    /* La rilettura parte da **prima** della propria frase, quindi la risposta
     * di mezzo c'e'. */
    assert.deepEqual(
      chat.messaggi.map((riga) => riga.id),
      [1, 2, 3],
    );
    const nonLetti = chat.nonLetti.map((riga) => riga.testo);
    assert.deepEqual(nonLetti, ["ti rispondo"]);
    assert.equal(chat.stato().unread, 1);
    assert.equal(chat.stato().preview, "ti rispondo");

    /* Aprire la conversazione e' averla letta. */
    const filo = await chat.conversazione();
    assert.equal(filo.enabled, true);
    assert.equal(filo.error, "");
    assert.equal(chat.stato().unread, 0);
  } finally {
    via();
  }
});

test("la stessa richiesta due volte non scrive il messaggio due volte", async () => {
  const centralino = centralinoFinto({
    righe: [{ id: 7, da: "console", testo: "ciao", scritto_il: 1 }],
  });
  const { chat, via } = unaChat(centralino, { giaAperta: true });
  try {
    await chat.conversazione();
    /* Si rilegge da capo, come dopo un riavvio nel mezzo. */
    chat.dati.letto = 0;
    chat._lettoIl = 0;
    await chat.conversazione();
    assert.equal(chat.messaggi.length, 1);
  } finally {
    via();
  }
});

test("una conversazione cancellata dal centralino va via anche di qua", async () => {
  const centralino = centralinoFinto({
    righe: [{ id: 1, da: "casa", testo: "c'era", scritto_il: 1 }],
    aperta: false,
  });
  const { chat, via } = unaChat(centralino);
  try {
    await chat.scrivi("apro io");
    /* Il centralino dice «non c'e' nessuna linea»: quelle parole non esistono
     * piu', e tenerle qui sarebbe il contrario di quello che era stato
     * promesso a chi le ha scritte. */
    const filo = await chat.conversazione();
    assert.deepEqual(filo.messages, []);
    assert.equal(chat.messaggi.length, 0);
    /* L'identita' invece resta: cancellarla vorrebbe dire che il messaggio
     * dopo arriva a chi risponde come una persona nuova. */
    assert.equal(chat.aperta, true);
  } finally {
    via();
  }
});

test("il centralino giu' non e' una schermata vuota", async () => {
  const centralino = centralinoFinto({
    righe: [{ id: 1, da: "console", testo: "una risposta", scritto_il: 1 }],
  });
  const { chat, via } = unaChat(centralino, { giaAperta: true });
  try {
    await chat.conversazione();
    assert.equal(chat.messaggi.length, 1);

    /* Da qui in poi la rete non c'e'. */
    const rotto = centralinoFinto({ rotto: true });
    chat.prendi = rotto.prendi;
    chat._lettoIl = 0;
    const filo = await chat.conversazione();
    /* Le parole che c'erano si vedono ancora, e il guasto si dice accanto. */
    assert.equal(filo.messages.length, 1);
    assert.match(filo.error, /raggiungibile/);
    assert.equal(filo.opened, true);
  } finally {
    via();
  }
});

test("senza indirizzo non si disegna nessuna porta, e scrivere si rifiuta", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "chat-"));
  try {
    const chat = new Chat({ cartella, centralino: "", registro: ZITTO });
    assert.equal(chat.accesa, false);
    assert.equal(chat.stato().enabled, false);
    assert.deepEqual(await chat.conversazione(), { enabled: false, messages: [] });
    await assert.rejects(
      () => chat.scrivi("ciao"),
      (errore) => errore instanceof ChatHaDettoNo && errore.codice === "disabled",
    );
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("una frase vuota non parte, e una troppo lunga si accorcia", async () => {
  const centralino = centralinoFinto();
  const { chat, via } = unaChat(centralino);
  try {
    await assert.rejects(
      () => chat.scrivi("   "),
      (errore) => errore instanceof ChatHaDettoNo && errore.codice === "empty",
    );
    await chat.scrivi("a".repeat(5000));
    const posta = centralino.chiamate.find((una) => una.metodo === "POST");
    assert.equal(posta.corpo.testo.length, 4000);
  } finally {
    via();
  }
});

test("la versione dell'app resta scritta anche nei giri che non la mandano", async () => {
  /* E' il difetto che questa prova tiene fuori: il centralino riscrive le
   * note **anche quando si rilegge**, e una versione mandata solo insieme a
   * una frase verrebbe cancellata dal primo giro di rilettura — chi risponde
   * si troverebbe l'etichetta senza l'app, e proprio mentre guarda una
   * domanda arrivata dall'app. */
  const centralino = centralinoFinto();
  const { chat, via } = unaChat(centralino);
  try {
    await chat.scrivi("dall'app", { app: "1.0.2" });
    chat._lettoIl = 0;
    await chat.conversazione();
    const etichette = centralino.chiamate.map((una) => una.intestazioni["x-versione"]);
    assert.ok(etichette.length >= 2);
    for (const etichetta of etichette) {
      assert.equal(etichetta, "plancia 1.4.19 ponte 0.16.0 app 1.0.2");
      /* Il centralino ne tiene quaranta caratteri, e quello che sta oltre lo
       * taglia lui: se il taglio tocca, la cosa tagliata e' l'app. */
      assert.ok(etichetta.length <= 40);
    }
  } finally {
    via();
  }
});

test("dimenticare cancella dal centralino, non solo da qua", async () => {
  const centralino = centralinoFinto();
  const { chat, via } = unaChat(centralino);
  try {
    await chat.scrivi("una cosa");
    assert.equal(chat.messaggi.length, 1);
    assert.equal(await chat.dimentica(), true);
    assert.equal(chat.messaggi.length, 0);
    assert.ok(centralino.chiamate.some((una) => una.metodo === "DELETE"));

    /* Se il centralino non risponde, di qua non si cancella niente: sarebbe
     * promettere una cosa che non e' stata fatta. */
    const rotto = centralinoFinto({ rotto: true });
    chat.prendi = rotto.prendi;
    chat.dati.messaggi = [{ id: 1, da: "casa", testo: "resta", scritto_il: 1 }];
    await assert.rejects(() => chat.dimentica());
    assert.equal(chat.messaggi.length, 1);
  } finally {
    via();
  }
});
