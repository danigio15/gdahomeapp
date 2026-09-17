/* Le segnalazioni scritte dalla plancia, in Home Assistant.
 *
 * Quello che si tiene fermo qui e' una traduzione, e le traduzioni si rompono
 * in silenzio: un tipo che diventa la parola sbagliata non fa cadere niente —
 * fa nascere una issue etichettata «idea» per un difetto, e nessuno se ne
 * accorge finche' non la legge qualcuno. Percio' la corrispondenza fra i due
 * vocabolari si prova riga per riga, in entrambi i versi.
 *
 * E una cosa piu' importante delle altre: **da dove arriva lo stampa il
 * ponte**. Dal telefono `da-app`, da qui `da-home-assistant`, e chi scrive non
 * puo' nemmeno provare a dirlo — era la richiesta, ed e' la riga che divide
 * l'elenco delle issue in due.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CHI_FIRMA,
  SegnalazioniDellaPlancia,
  STATI,
  TIPI,
  unFilo,
  unTicket,
} from "../src/segnalazioni-della-plancia.js";

/* Le `Segnalazioni` vere in miniatura: tengono quello che gli arriva — perche'
 * meta' di questa prova e' **con cosa** vengono chiamate — e rispondono nella
 * forma del centralino. */
function segnalazioniFinte({ spedibili = true, elenco = [] } = {}) {
  const dette = [];
  return {
    dette,
    spedibili,
    async elenco({ aggiorna = false } = {}) {
      dette.push({ cosa: "elenco", aggiorna });
      return { spedibili, aggiornato_il: 0, segnalazioni: elenco };
    },
    async crea(detto) {
      dette.push({ cosa: "crea", ...detto });
      return {
        numero: 42,
        tipo: detto.tipo,
        titolo: detto.titolo,
        stato: "aperta",
        aperta_il: "2026-09-17T02:00:00Z",
        url: "https://github.com/danigio15/gdahomeapp/issues/42",
      };
    },
    async leggi(numero) {
      dette.push({ cosa: "leggi", numero });
      return {
        numero,
        tipo: "problema",
        titolo: "La luce non si spegne",
        stato: "in-carico",
        aperta_il: "2026-09-16T10:00:00Z",
        url: "https://github.com/danigio15/gdahomeapp/issues/7",
        messaggi: [
          { da: "casa", testo: "Premo e non succede niente.", il: "2026-09-16T10:00:00Z" },
          { da: "manutentore", testo: "Che marca e'?", il: "2026-09-16T11:00:00Z" },
          { da: "casa", testo: "Shelly.", il: "2026-09-16T11:30:00Z" },
        ],
      };
    },
    async rispondi(numero, testo) {
      dette.push({ cosa: "rispondi", numero, testo });
      return this.leggi(numero);
    },
  };
}

const UNA = {
  numero: 7,
  tipo: "problema",
  titolo: "La luce non si spegne",
  stato: "aperta",
  aperta_il: "2026-09-16T10:00:00Z",
  url: "https://github.com/danigio15/gdahomeapp/issues/7",
};

test("i due vocabolari si corrispondono, e nei due versi", () => {
  /* Tre tipi da una parte, tre dall'altra, e nessuno che si perda per strada:
   * la finestra manda i suoi nomi, il centralino vuole i propri. */
  assert.deepEqual(TIPI, { bug: "problema", feature: "idea", assistenza: "domanda" });
  for (const [della, nostro] of Object.entries(TIPI)) {
    assert.equal(unTicket({ ...UNA, tipo: nostro }).type, della, `${nostro} → ${della}`);
  }

  /* E gli stati: tre nostri, e ognuno deve cadere nella colonna giusta delle
   * tre che la finestra disegna. */
  assert.deepEqual(STATI, { aperta: "inviato", "in-carico": "in-carico", chiusa: "chiuso" });
  assert.equal(unTicket({ ...UNA, stato: "aperta" }).state, "inviato");
  assert.equal(unTicket({ ...UNA, stato: "in-carico" }).state, "in-carico");
  assert.equal(unTicket({ ...UNA, stato: "chiusa" }).state, "chiuso");

  /* Una parola che non si conosce non fa cadere una finestra: diventa quella
   * piu' innocua. Da fuori arriva sempre qualcosa che non ci si aspetta. */
  assert.equal(unTicket({ ...UNA, tipo: "vattelapesca" }).type, "bug");
  assert.equal(unTicket({ ...UNA, stato: "vattelapesca" }).state, "inviato");
});

test("una segnalazione, nella forma che la finestra sa disegnare", () => {
  const ticket = unTicket(UNA);
  assert.equal(ticket.id, "7");
  assert.equal(ticket.remote_id, "7");
  assert.equal(ticket.title, "La luce non si spegne");
  assert.equal(ticket.issue_url, "https://github.com/danigio15/gdahomeapp/issues/7");
  /* Le date: la finestra conta in millesimi, il centralino scrive un'ora. */
  assert.equal(ticket.created_at, Date.parse("2026-09-16T10:00:00Z"));
  /* E una data che non c'e' e' zero, non `NaN`: `NaN` in una pagina si legge
   * «Invalid Date». */
  assert.equal(unTicket({ ...UNA, aperta_il: "" }).created_at, 0);
  /* Il testo nell'elenco non c'e', e non si inventa: arriva aprendo il filo. */
  assert.equal(ticket.body, "");
});

test("il filo: il testo, e i commenti da che lato stanno", () => {
  const filo = unFilo({
    numero: 7,
    titolo: "La luce non si spegne",
    stato: "in-carico",
    messaggi: [
      { da: "casa", testo: "Premo e non succede niente.", il: "2026-09-16T10:00:00Z" },
      { da: "manutentore", testo: "Che marca e'?", il: "2026-09-16T11:00:00Z" },
      { da: "casa", testo: "Shelly.", il: "2026-09-16T11:30:00Z" },
    ],
  });
  /* Il primo messaggio e' la segnalazione: da questa parte sta dentro
   * `messaggi` come tutti gli altri, e la finestra lo vuole a parte. */
  assert.equal(filo.body, "Premo e non succede niente.");
  assert.equal(filo.comments.length, 2);
  assert.deepEqual(
    filo.comments.map((uno) => [uno.author, uno.maintainer]),
    [
      ["manutentore", true],
      ["casa", false],
    ],
  );
  assert.equal(filo.comments[0].at, Date.parse("2026-09-16T11:00:00Z"));
  /* Un filo senza messaggi non e' un guasto: e' una segnalazione appena
   * nata, e la finestra disegna un testo vuoto invece di rompersi. */
  assert.deepEqual(unFilo({ numero: 1 }).comments, []);
  assert.equal(unFilo({ numero: 1 }).body, "");
});

test("scrivendo da Home Assistant, sulla issue finisce «da-home-assistant»", async () => {
  /* La riga che divide l'elenco delle issue in due, ed era la richiesta. Non
   * la scrive la finestra e non la scrive il telefono: la mette il ponte,
   * perche' quale dei due comandi sia arrivato lo sa solo lui. */
  const mie = segnalazioniFinte();
  const dalla = new SegnalazioniDellaPlancia({ segnalazioni: mie });

  const esito = await dalla.crea({
    ticket_type: "feature",
    title: "Vorrei il meteo in testata",
    body: "Sarebbe comodo.",
    diagnostics: { sezione: "home" },
  });

  const chiesto = mie.dette.find((una) => una.cosa === "crea");
  assert.equal(chiesto.da, "plancia", "da qui e' sempre «plancia», e non si puo' dire altro");
  assert.equal(chiesto.tipo, "idea", "«feature» della finestra e' «idea» per il centralino");
  assert.equal(chiesto.titolo, "Vorrei il meteo in testata");
  assert.deepEqual(chiesto.diagnostica, { sezione: "home" });

  /* E quello che torna alla finestra e' la segnalazione nella sua forma, col
   * testo appena scritto: l'elenco non lo porta, ma chi ha appena premuto
   * invia si aspetta di rileggere quello che ha scritto. */
  assert.equal(esito.delivered, true);
  assert.equal(esito.ticket.id, "42");
  assert.equal(esito.ticket.type, "feature");
  assert.equal(esito.ticket.body, "Sarebbe comodo.");
});

test("col centralino la finestra si usa; senza, lo dice — e dice il vero", async () => {
  /* Sono le due righe che decidono cosa la finestra offre. Con `delivery` e
   * `account.connected` la finestra si usa: il modulo, il campo per rispondere
   * sotto una segnalazione, «Le tue richieste». Senza, disegna la sua nota —
   * quella del 💤 — e quella nota a quel punto e' vera. */
  const con = new SegnalazioniDellaPlancia({ segnalazioni: segnalazioniFinte({ elenco: [UNA] }) });
  const dentro = await con.elenco();
  assert.equal(dentro.delivery, true);
  assert.deepEqual(dentro.account, { connected: true, login: CHI_FIRMA, maintainer: false });
  assert.equal(dentro.tickets.length, 1);
  assert.equal(dentro.tickets[0].title, "La luce non si spegne");

  const senza = new SegnalazioniDellaPlancia({
    segnalazioni: segnalazioniFinte({ spedibili: false }),
  });
  const fuori = await senza.elenco();
  assert.equal(fuori.delivery, false);
  assert.deepEqual(fuori.account, { connected: false, login: "", maintainer: false });

  /* E su un ponte senza segnalazioni del tutto non si finge: nessun elenco,
   * e la finestra sa che non c'e' niente da mostrare. */
  const niente = new SegnalazioniDellaPlancia({});
  assert.deepEqual((await niente.elenco()).tickets, []);
  assert.equal((await niente.elenco()).delivery, false);
});

test("la coda di chi risponde non si accende mai da qui", async () => {
  /* `console: true` farebbe comparire nella finestra i bottoni del
   * manutentore, e quelli da qui non li serve nessuno: un bottone che si
   * accende e non funziona e' peggio di un bottone che non c'e'. */
  const dalla = new SegnalazioniDellaPlancia({ segnalazioni: segnalazioniFinte() });
  assert.equal((await dalla.elenco()).console, false);
  assert.equal((await dalla.sincronizza()).console, false);
});

test("sincronizzare vuol dire richiederlo adesso al centralino", async () => {
  const mie = segnalazioniFinte({ elenco: [UNA] });
  const dalla = new SegnalazioniDellaPlancia({ segnalazioni: mie });
  await dalla.elenco();
  await dalla.sincronizza();
  assert.deepEqual(
    mie.dette.map((una) => una.aggiorna),
    [false, true],
    "l'elenco si accontenta di quello che ha, il sincronizza no",
  );
});

test("aprire e rispondere passano dal numero, e tornano il filo intero", async () => {
  const mie = segnalazioniFinte();
  const dalla = new SegnalazioniDellaPlancia({ segnalazioni: mie });

  const filo = await dalla.filo(7);
  assert.equal(filo.number, 7);
  assert.equal(filo.body, "Premo e non succede niente.");

  const dopo = await dalla.rispondi(7, "Ho provato a riavviarla.");
  assert.deepEqual(mie.dette.at(-2), {
    cosa: "rispondi",
    numero: 7,
    testo: "Ho provato a riavviarla.",
  });
  /* Si torna il filo e non un «fatto»: la finestra butta quello che aveva e
   * rilegge, e darglielo subito le risparmia un giro. */
  assert.equal(dopo.comments.length, 2);
});

test("i pallini: meglio nessuno che uno che dice una cosa falsa", async () => {
  /* Non letto vorrebbe dire «c'e' una risposta piu' nuova dell'ultima volta
   * che hai aperto». Quel «ultima volta» da questa parte non si tiene, e
   * inventarlo vorrebbe dire dei pallini che si accendono a caso. */
  const dalla = new SegnalazioniDellaPlancia({ segnalazioni: segnalazioniFinte() });
  assert.deepEqual(await dalla.nonLetti(), { messages: [] });
});

test("la firma non si collega, e la finestra lo sente dire", async () => {
  /* Nell'integrazione questi tre comandi erano il ballo del codice a sei cifre
   * su github.com. Qui non c'e' niente da collegare — la issue la apre il
   * centralino — e la finestra deve sentirselo dire, non ricevere un rifiuto:
   * un rifiuto le fa disegnare un errore rosso per una cosa che non serve. */
  const dalla = new SegnalazioniDellaPlancia({ segnalazioni: segnalazioniFinte() });
  const detto = dalla.laFirmaNonSiCollega();
  assert.equal(detto.niente_da_collegare, true);
  assert.equal(detto.connected, true);
  assert.match(detto.perche, /non serve collegare niente/);
});
