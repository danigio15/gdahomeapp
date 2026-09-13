/* Chi vede una plancia, e chi no.
 *
 * Nella dashboard era un'opzione dell'integrazione — `allowed_user_ids` — e il
 * controllo lo faceva il pannello, nel browser: un `if` dentro un file che il
 * browser scarica. Bastava a nascondere una plancia a chi in casa non la deve
 * vedere, e non bastava a niente di piu'.
 *
 * Qui il controllo sta **nell'add-on**, e la differenza e' che l'add-on sa chi
 * sta guardando senza chiederlo alla pagina: l'ingress di Home Assistant gli
 * scrive in testa a ogni richiesta `X-Remote-User-Id`, e quella riga non la
 * mette il browser. Percio' qui si prova la cosa che conta: che a chi non e'
 * abilitato **la pagina della plancia non arrivi**.
 *
 * Le quattro righe che, sbagliate, costano care:
 *
 *  - un elenco **vuoto** vuol dire tutti, e non nessuno: se no, il giorno
 *    dell'aggiornamento tutte le plance di tutte le case sparirebbero;
 *  - chi e' nell'elenco entra, chi non c'e' no;
 *  - chi ha un elenco e non si sa chi sia **non entra**: una restrizione che
 *    si spegne da sola quando non si sa niente non e' una restrizione;
 *  - il filo della plancia — uno per tutte — si chiude a chi non vede nessuna
 *    plancia, e resta aperto a chi ne vede almeno una.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Plance, laVede, utentiPuliti, vedeQualcosa } from "../src/plance.js";
import { NIENTE_PER_TE } from "../src/commissioni.js";
import { UtentiDiCasa } from "../src/utenti.js";
import { Abbinamento } from "../src/abbinamento.js";
import { Dispositivi } from "../src/dispositivi.js";
import { Commissioni } from "../src/commissioni.js";

const ZITTO = { info() {}, attenzione() {}, errore() {} };

/* Gli identificativi di Home Assistant: trentadue cifre esadecimali. */
const IO = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
const LEI = "0f9e8d7c6b5a49382716f5e4d3c2b1a0";
const NESSUNO = "ffffffffffffffffffffffffffffffff";

function unPosto() {
  const cartella = mkdtempSync(join(tmpdir(), "chi-vede-"));
  return { cartella, via: () => rmSync(cartella, { recursive: true, force: true }) };
}

test("vuoto vuol dire tutti, e non nessuno", () => {
  /* E' la riga che tiene in piedi le case di chi c'e' gia': nessuna plancia ha
   * questo campo prima di oggi, e dopo l'aggiornamento devono vedersi come
   * ieri. Se `[]` volesse dire «nessuno», l'aggiornamento spegnerebbe la
   * plancia a tutti, in tutte le case, in una volta. */
  assert.equal(laVede({ utenti: [] }, IO), true);
  assert.equal(laVede({ utenti: [] }, ""), true);
  assert.equal(laVede({}, IO), true);
  assert.equal(laVede(null, IO), true);
});

test("chi c'e' nell'elenco entra, chi non c'e' no", () => {
  const quale = { utenti: [IO] };
  assert.equal(laVede(quale, IO), true);
  assert.equal(laVede(quale, LEI), false);
  assert.equal(laVede(quale, NESSUNO), false);
});

test("con un elenco, chi non si sa chi e' non entra", () => {
  /* Fuori dall'ingress la riga `X-Remote-User-Id` non c'e', e `chi` arriva
   * vuoto. Con un elenco addosso, la risposta e' no: chi ha scritto un elenco
   * ha chiesto una restrizione, e una restrizione che cade quando non si sa
   * niente non serve a niente. */
  assert.equal(laVede({ utenti: [IO] }, ""), false);
  assert.equal(laVede({ utenti: [IO] }, null), false);
  assert.equal(laVede({ utenti: [IO] }, undefined), false);
});

test("l'elenco si ripulisce: solo identificativi veri, una volta ognuno", () => {
  /* Non e' pignoleria sulla forma. Un elenco pieno di roba che non e' un
   * identificativo e' un elenco di fantasmi: nessuno di quei nomi corrisponde
   * a un utente, quindi la plancia non si apre a nessuno — e chi l'ha
   * configurata crede di averla aperta a qualcuno. Meglio buttare quello che
   * non puo' essere un utente. */
  assert.deepEqual(utentiPuliti([IO, IO, LEI]), [IO, LEI]);
  assert.deepEqual(utentiPuliti(["", null, undefined, 7]), []);
  assert.deepEqual(utentiPuliti(["mario", "tutti", "*"]), []);
  /* Maiuscole: Home Assistant li scrive minuscoli, ma un elenco copiato a
   * mano puo' arrivare cosi', e sono lo stesso identificativo. */
  assert.deepEqual(utentiPuliti([IO.toUpperCase()]), [IO.toUpperCase()]);
  assert.deepEqual(utentiPuliti("non un elenco"), []);
  assert.deepEqual(utentiPuliti(null), []);
});

test("il filo si chiude a chi non vede nessuna plancia, e resta aperto a chi ne vede una", () => {
  /* Il filo della plancia e' uno per tutte e non sa quale pagina l'ha aperto:
   * non puo' dire «questa plancia no». Ma l'unica cosa che sa basta — chi non
   * vede **nessuna** plancia non ha niente da chiedere. */
  const casa = [{ utenti: [IO] }, { utenti: [IO, LEI] }];
  assert.equal(vedeQualcosa(casa, IO), true);
  assert.equal(vedeQualcosa(casa, LEI), true);
  assert.equal(vedeQualcosa(casa, NESSUNO), false);
  assert.equal(vedeQualcosa(casa, ""), false);

  /* Una casa dove nessuna plancia ha un elenco: il filo e' di tutti. */
  assert.equal(vedeQualcosa([{ utenti: [] }, { utenti: [] }], NESSUNO), true);
  /* E una casa senza plance non chiude niente: non c'e' niente da chiudere. */
  assert.equal(vedeQualcosa([], NESSUNO), true);
});

test("la scelta si salva, si rilegge dal disco e si annulla", () => {
  const { cartella, via } = unPosto();
  try {
    const plance = new Plance({ cartella, registro: ZITTO, adesso: () => 1000 });
    const mare = plance.aggiungi("Casa al mare");
    assert.deepEqual(mare.utenti, [], "una plancia nuova la vedono tutti");

    const riservata = plance.chiLaVede(mare.profilo, [LEI, LEI, "storto"]);
    assert.deepEqual(riservata.utenti, [LEI], "l'elenco si ripulisce salvando");

    /* Riaprendo lo stesso posto la scelta c'e' ancora: sta sul disco, non in
     * memoria. E' il motivo per cui questa prova riapre invece di rileggere. */
    const dopo = new Plance({ cartella, registro: ZITTO });
    assert.deepEqual(dopo.quale(mare.profilo).utenti, [LEI]);

    /* Un elenco vuoto la riapre a tutti: e' il modo di annullare la scelta, e
     * non serve un secondo comando per dire «come prima». */
    assert.deepEqual(dopo.chiLaVede(mare.profilo, []).utenti, []);
    assert.equal(laVede(dopo.quale(mare.profilo), NESSUNO), true);
  } finally {
    via();
  }
});

test("anche la prima plancia si puo' riservare, e rinominarla non tocca chi la vede", () => {
  const { cartella, via } = unPosto();
  try {
    const plance = new Plance({ cartella, registro: ZITTO });
    /* Chi tiene una plancia per se' e una per chi abita con lui vuole
     * restringere proprio quella di sempre: non c'e' motivo di fare
     * un'eccezione per la prima. */
    assert.deepEqual(plance.chiLaVede("primary", [IO]).utenti, [IO]);

    /* I tre nomi di una plancia fanno tre mestieri diversi, e adesso c'e' una
     * quarta cosa: chi la vede. Rinominare non deve toccarla. */
    const rinominata = plance.rinomina("primary", "La mia");
    assert.equal(rinominata.titolo, "La mia");
    assert.deepEqual(rinominata.utenti, [IO]);
  } finally {
    via();
  }
});

/* ─── «Solo gli amministratori» ──────────────────────────────────────────── */

test("«solo amministratori»: si passa solo se si amministra, e «non lo so» e' un no", () => {
  const quale = { utenti: [], solo_admin: true };
  assert.equal(laVede(quale, IO, true), true);
  assert.equal(laVede(quale, IO, false), false);
  /* `null` e' «non lo so ancora»: Home Assistant non ha risposto, o non
   * gliel'abbiamo chiesto. Stessa regola dell'elenco — chi ha chiesto una
   * restrizione l'ha chiesta anche per i momenti in cui non si sa niente. */
  assert.equal(laVede(quale, IO, null), false);
  assert.equal(laVede(quale, IO), false);

  /* Senza la richiesta, «amministra» non cambia niente: una plancia che non
   * chiede di amministrare si apre a chiunque, amministratore o no. */
  assert.equal(laVede({ utenti: [] }, IO, false), true);
});

test("le due restrizioni si sommano, non si scelgono", () => {
  /* Chi mette l'elenco **e** «solo amministratori» intende entrambe: e' il
   * caso di «questa la vede solo mia moglie, e solo perche' amministra». Se si
   * scegliessero, una delle due sarebbe scritta e non farebbe niente. */
  const quale = { utenti: [LEI], solo_admin: true };
  assert.equal(laVede(quale, LEI, true), true, "lei amministra ed e' in elenco: entra");
  assert.equal(laVede(quale, LEI, false), false, "in elenco ma non amministra: no");
  assert.equal(laVede(quale, IO, true), false, "amministra ma non e' in elenco: no");
  assert.equal(laVede(quale, IO, false), false);
});

test("il filo guarda anche «amministra», e una plancia libera lo tiene aperto", () => {
  const casa = [{ utenti: [], solo_admin: true }];
  assert.equal(vedeQualcosa(casa, IO, true), true);
  assert.equal(vedeQualcosa(casa, IO, false), false);
  assert.equal(vedeQualcosa(casa, IO, null), false);

  /* Con due plance, una riservata e una no, il filo resta aperto: non vede
   * quella, vede l'altra. */
  const mista = [{ utenti: [], solo_admin: true }, { utenti: [] }];
  assert.equal(vedeQualcosa(mista, IO, false), true);
});

test("«solo amministratori» si salva, si rilegge, e non tocca l'elenco", () => {
  const { cartella, via } = unPosto();
  try {
    const plance = new Plance({ cartella, registro: ZITTO });
    assert.equal(
      plance.prima.solo_admin,
      false,
      "una plancia nasce senza chiedere di amministrare",
    );

    assert.equal(plance.soloChiAmministra("primary", true).solo_admin, true);
    /* Le due scelte sono due cassetti diversi: metterne una non svuota
     * l'altra. */
    assert.deepEqual(plance.chiLaVede("primary", [IO]).utenti, [IO]);
    assert.equal(plance.quale("primary").solo_admin, true);

    /* E sta sul disco, non in memoria. */
    const dopo = new Plance({ cartella, registro: ZITTO });
    assert.equal(dopo.quale("primary").solo_admin, true);
    assert.deepEqual(dopo.quale("primary").utenti, [IO]);

    assert.equal(dopo.soloChiAmministra("primary", false).solo_admin, false);
    assert.deepEqual(dopo.quale("primary").utenti, [IO], "spegnerla ha toccato l'elenco");
  } finally {
    via();
  }
});

/* ─── Chi c'e' in casa, e chi la amministra ──────────────────────────────── */

/* Una Home Assistant che risponde a `config/auth/list`, e che si puo' far
 * cadere per vedere cosa succede quando non risponde. */
function unaCasa(risposta) {
  let quante = 0;
  return {
    get quante() {
      return quante;
    },
    cade: false,
    chiedi() {
      quante += 1;
      if (this.cade) return Promise.reject(new Error("la casa non risponde"));
      return Promise.resolve(risposta);
    },
  };
}

const COME_RISPONDE_HA = [
  { id: IO, name: "Giovanni", is_owner: true, is_active: true, group_ids: ["system-admin"] },
  { id: LEI, name: "Marta", is_owner: false, is_active: true, group_ids: ["system-users"] },
  { id: NESSUNO, name: "Supervisor", system_generated: true, group_ids: ["system-admin"] },
];

test("chi amministra lo dice Home Assistant, e gli utenti di sistema non contano", async () => {
  const casa = unaCasa(COME_RISPONDE_HA);
  const utenti = new UtentiDiCasa({ casa, registro: ZITTO });

  assert.equal(await utenti.amministratore(IO), true);
  assert.equal(await utenti.amministratore(LEI), false);
  /* «Supervisor» amministra, ma e' un utente che Home Assistant fa da se': in
   * una lista di «chi vede la plancia» non e' una persona, e non deve poter
   * aprire niente per conto suo. */
  assert.equal(await utenti.amministratore(NESSUNO), false);
  /* E chi non esiste non amministra: non esistere non e' un titolo. */
  assert.equal(await utenti.amministratore("mai-visto"), false);
  assert.equal(await utenti.amministratore(""), false);

  const elenco = await utenti.elenco();
  assert.deepEqual(
    elenco.map((uno) => [uno.nome, uno.amministratore]),
    [
      ["Giovanni", true],
      ["Marta", false],
    ],
  );
});

test("la risposta vale un minuto, e dieci pagine fanno una domanda sola", async () => {
  let quando = 1000;
  const casa = unaCasa(COME_RISPONDE_HA);
  const utenti = new UtentiDiCasa({ casa, registro: ZITTO, adesso: () => quando });

  /* Dieci insieme: una domanda. Senza questo, dieci pagine aperte nello stesso
   * momento sarebbero dieci giri su Home Assistant per la stessa risposta. */
  await Promise.all(Array.from({ length: 10 }, () => utenti.elenco()));
  assert.equal(casa.quante, 1);

  /* Dentro il minuto non si richiede. */
  quando += 30 * 1000;
  await utenti.elenco();
  assert.equal(casa.quante, 1);

  /* Dopo il minuto sì: un utente appena aggiunto deve comparire senza
   * riavviare l'add-on. */
  quando += 40 * 1000;
  await utenti.elenco();
  assert.equal(casa.quante, 2);
});

test("se Home Assistant non risponde si tiene l'ultima buona, e al primo giro lo dice", async () => {
  let quando = 1000;
  const casa = unaCasa(COME_RISPONDE_HA);
  const utenti = new UtentiDiCasa({ casa, registro: ZITTO, adesso: () => quando });

  await utenti.elenco();
  casa.cade = true;
  quando += 90 * 1000;

  /* Vecchia di un minuto e mezzo, ma e' quasi sempre la stessa. L'alternativa
   * e' che un singhiozzo di Home Assistant chiuda la plancia in faccia anche a
   * chi la amministra. */
  assert.equal(await utenti.amministratore(IO), true);

  /* Ma se non ce n'e' mai stata una buona, il guaio esce: chi ha chiamato deve
   * sapere che non lo sa nessuno, e il cancello decide di conseguenza — no. */
  const digiuna = new UtentiDiCasa({ casa: unaCasa(null), registro: ZITTO });
  digiuna.casa.cade = true;
  await assert.rejects(digiuna.elenco(), /non risponde/);
});

test("«amministra?» senza aspettare: quello che c'e' in mano, o «non lo so»", async () => {
  const casa = unaCasa(COME_RISPONDE_HA);
  const utenti = new UtentiDiCasa({ casa, registro: ZITTO });

  /* A freddo non lo sa, e non va a chiederlo: serve dove non si puo'
   * aspettare — la salita di un WebSocket, che va accettata o rifiutata
   * subito. */
  assert.equal(utenti.amministratoreSubito(IO), null);
  assert.equal(casa.quante, 0, "e' andato a chiedere dove non doveva");

  await utenti.elenco();
  assert.equal(utenti.amministratoreSubito(IO), true);
  assert.equal(utenti.amministratoreSubito(LEI), false);
  assert.equal(utenti.amministratoreSubito(""), false);
});

test("una plancia che non c'e' non si riserva", () => {
  const { cartella, via } = unPosto();
  try {
    const plance = new Plance({ cartella, registro: ZITTO });
    assert.throws(() => plance.chiLaVede("mai-esistita", [IO]), /non c'e'/);
    assert.throws(() => plance.soloChiAmministra("mai-esistita", true), /non c'e'/);
  } finally {
    via();
  }
});

test("cambiare chi la vede riscrive le voci in Home Assistant", () => {
  /* Dentro la vista di una Plancia c'e' l'elenco, ed e' quello che fa dire
   * alla cartina «questa non e' abilitata per te». Se cambiare l'elenco non
   * avvisasse, la voce in Home Assistant resterebbe quella di prima fino al
   * prossimo riavvio dell'add-on. */
  const { cartella, via } = unPosto();
  try {
    const avvisi = [];
    const plance = new Plance({
      cartella,
      registro: ZITTO,
      quandoCambia: (elenco) => avvisi.push(elenco.length),
    });
    plance.chiLaVede("primary", [IO]);
    assert.equal(avvisi.length, 1, "nessuno ha avvisato Home Assistant");

    /* Scrivere la stessa cosa non avvisa: salvare la configurazione di una
     * Plancia fa ridisegnare tutte le pagine aperte, e non si fa per niente. */
    plance.chiLaVede("primary", [IO]);
    assert.equal(avvisi.length, 1, "ha avvisato per una scrittura che non cambiava niente");
  } finally {
    via();
  }
});

/* ─── L'utente dentro il codice ──────────────────────────────────────────── */

/* Il buco che «chi la vede» da sola non copriva.
 *
 * Il QR abbina un **telefono**, non un utente di Home Assistant. Quel telefono
 * poi chiede le plance al filo, e senza niente addosso se le prende tutte —
 * comprese quelle riservate a qualcun altro. Cioe': riservi una plancia a tua
 * moglie, abbini il telefono di tua moglie, e quel telefono vede anche le tue.
 *
 * La cura: chi fabbrica il codice lo firma, il telefono eredita quell'utente,
 * e l'elenco passa dalla stessa `laVede` che vale dentro Home Assistant.
 */

test("il codice porta con se' per chi e', e il telefono lo eredita", () => {
  const a = new Abbinamento({ adesso: () => 1000 });
  const { codice, utente } = a.nuovo(LEI);
  assert.equal(utente, LEI, "il codice non si e' intestato a nessuno");

  /* E lo dice a chi lo consuma: e' l'unico posto che lo sa, e chi abbina il
   * telefono deve poterlo intestare. */
  assert.deepEqual(a.consuma(codice), { utente: LEI });
});

test("un codice senza padrone resta senza, e un identificativo storto non conta", () => {
  const a = new Abbinamento({ adesso: () => 1000 });
  assert.equal(a.nuovo().utente, "", "un codice non firmato si e' intestato a qualcuno");
  /* Un valore storto diventa «non si sa di chi e'» — cioe' vede tutto, come
   * prima — e non un fantasma che non corrisponde a nessuno e non apre
   * niente. */
  assert.equal(a.nuovo("mario").utente, "");
  assert.equal(a.nuovo("tutti").utente, "");
});

test("il telefono nasce intestato, e l'elenco lo dice", () => {
  const { cartella, via } = unPosto();
  try {
    const suoi = new Dispositivi({ cartella, adesso: () => 1000 });
    const { dispositivo, segno } = suoi.abbina({
      nome: "Pixel di Marta",
      sistema: "Android",
      utente: LEI,
    });
    assert.equal(suoi.utenteDi(dispositivo.id), LEI);
    assert.equal(suoi.elenco()[0].utente, LEI, "l'elenco non dice di chi e'");
    /* E lo dice anche quando il telefono bussa.
     *
     * Questa riga e' il difetto che si e' visto in casa: `utenteDi` e
     * `elenco` leggono l'archivio e dicevano la cosa giusta, ma il ponte non
     * chiede a loro — chiede a chi bussa, cioe' a quello che torna da
     * `riconosci`, e la' l'utente veniva buttato via. Il valore era giusto
     * due passi prima e uno dopo, e in mezzo si perdeva: il cancello delle
     * plance riservate non si e' mai chiuso per nessuno. */
    assert.equal(
      suoi.riconosci(segno).utente,
      LEI,
      "chi bussa deve dire di chi e', se no il filo non lo sa",
    );

    /* Un telefono abbinato prima di oggi non ha nessun utente addosso, e
     * quello **vede tutto**: e' la riga che non spegne le case di chi c'e'
     * gia' il giorno dell'aggiornamento. */
    const vecchio = suoi.abbina({ nome: "iPhone", sistema: "iOS" });
    assert.equal(suoi.utenteDi(vecchio.dispositivo.id), "");
    assert.equal(laVede({ utenti: [IO] }, suoi.utenteDi(vecchio.dispositivo.id)), false);
    assert.equal(laVede({ utenti: [] }, suoi.utenteDi(vecchio.dispositivo.id)), true);
  } finally {
    via();
  }
});

test("l'app riceve solo le plance sue, e non sa che le altre esistono", async () => {
  const { cartella, via } = unPosto();
  try {
    const plance = new Plance({ cartella, registro: ZITTO });
    const mare = plance.aggiungi("Casa al mare");
    plance.chiLaVede(mare.profilo, [LEI]);

    const commissioni = new Commissioni({
      plance,
      plancia: { cE: true, descrizione: () => ({ base: "/x" }) },
      registro: ZITTO,
    });

    /* Marta: vede la sua, e la prima che e' di tutti. */
    const sua = await commissioni.rispondi(
      { id: 1, type: "ponte/plance/elenco" },
      { chiChiede: LEI },
    );
    assert.deepEqual(
      sua.result.plance.map((una) => una.profilo),
      ["primary", mare.profilo],
    );

    /* Giovanni: la «Casa al mare» non e' sua, e **non compare**. Non «compare
     * grigia»: non c'e'. */
    const mia = await commissioni.rispondi(
      { id: 2, type: "ponte/plance/elenco" },
      { chiChiede: IO },
    );
    assert.deepEqual(
      mia.result.plance.map((una) => una.profilo),
      ["primary"],
    );

    /* E se la chiede per nome, non gli si apre: gli si da' la sua. Senza
     * spiegargli che quella esiste ed e' di un altro — che e' una cosa che
     * non deve sapere, e per lui non cambia niente. */
    const forzata = await commissioni.rispondi(
      { id: 3, type: "ponte/plancia", profilo: mare.profilo },
      { chiChiede: IO },
    );
    assert.equal(forzata.success, true);
    assert.deepEqual(
      forzata.result.plance.map((una) => una.profilo),
      ["primary"],
    );

    /* Un telefono che non si sa di chi sia vede tutto: i telefoni abbinati
     * prima di oggi non si spengono a tradimento. */
    const vecchio = await commissioni.rispondi(
      { id: 4, type: "ponte/plance/elenco" },
      { chiChiede: "" },
    );
    assert.equal(vecchio.result.plance.length, 2);
  } finally {
    via();
  }
});

test("chi non vede nessuna plancia non ne vede nessuna, e gli si dice", async () => {
  /* Qui, prima, la regola si piegava: «se nessuna e' sua, la prima si apre
   * comunque, se no il telefono si apre sul vuoto». Quel ripiego spegneva la
   * restrizione **proprio per chi doveva fermare** — bastava farsi un codice
   * per se' per aprire la plancia riservata a un altro — ed e' venuto fuori
   * alla prima prova in casa: plancia riservata a lei, codice fatto per lui,
   * e lui la vedeva.
   *
   * Il vuoto era un problema vero, e la risposta giusta non e' aprire la
   * plancia di un altro: e' dirlo. */
  const { cartella, via } = unPosto();
  try {
    const plance = new Plance({ cartella, registro: ZITTO });
    plance.chiLaVede("primary", [LEI]);
    const commissioni = new Commissioni({
      plance,
      plancia: { cE: true, descrizione: () => ({ base: "/x" }) },
      registro: ZITTO,
    });

    const elenco = await commissioni.rispondi(
      { id: 1, type: "ponte/plance/elenco" },
      { chiChiede: IO },
    );
    assert.equal(elenco.result.plance.length, 0, "nessuna, e non quella di lei");

    const aprire = await commissioni.rispondi({ id: 2, type: "ponte/plancia" }, { chiChiede: IO });
    assert.equal(aprire.success, false, "non si apre niente");
    assert.equal(aprire.error.code, NIENTE_PER_TE);

    /* E i file nemmeno: senza questo la porta si riapriva da un'altra parte,
     * perche' l'app che si sente dire no va a cercare la plancia fra i
     * pannelli di Home Assistant. */
    const file = await commissioni.rispondi(
      { id: 3, type: "ponte/http", percorso: "/dashboardmodern_static/app.js" },
      { chiChiede: IO },
    );
    assert.equal(file.success, false, "niente file della plancia");
    assert.equal(file.error.code, NIENTE_PER_TE);
  } finally {
    via();
  }
});

test("e non si puo' nemmeno rinominare o togliere quella di un altro", async () => {
  /* Vederla e' meno grave che cancellarla: se il cancello ferma solo lo
   * sguardo, chi conosce il nome del profilo puo' ancora entrare dalla
   * finestra. */
  const { cartella, via } = unPosto();
  try {
    const plance = new Plance({ cartella, registro: ZITTO });
    plance.chiLaVede("primary", [LEI]);
    const commissioni = new Commissioni({
      plance,
      plancia: { cE: true, descrizione: () => ({ base: "/x" }) },
      registro: ZITTO,
    });

    const rinomina = await commissioni.rispondi(
      { id: 1, type: "ponte/plance/rinomina", profilo: "primary", titolo: "mia adesso" },
      { chiChiede: IO },
    );
    assert.equal(rinomina.success, false);
    assert.equal(rinomina.error.code, NIENTE_PER_TE);

    const togli = await commissioni.rispondi(
      { id: 2, type: "ponte/plance/togli", profilo: "primary" },
      { chiChiede: IO },
    );
    assert.equal(togli.success, false);
    assert.equal(togli.error.code, NIENTE_PER_TE);

    /* E la plancia e' ancora la', col nome di prima. */
    assert.equal(plance.elenco().length, 1);
    assert.notEqual(plance.quale("primary").titolo, "mia adesso");
  } finally {
    via();
  }
});

test("ma un telefono di prima, che non dice di chi e', vede tutto", async () => {
  /* La regola del passaggio, sempre la stessa: chi non si sa chi e' vede
   * tutto. Un aggiornamento non spegne la casa a nessuno. */
  const { cartella, via } = unPosto();
  try {
    const plance = new Plance({ cartella, registro: ZITTO });
    plance.chiLaVede("primary", [LEI]);
    const commissioni = new Commissioni({
      plance,
      plancia: { cE: true, descrizione: () => ({ base: "/x" }) },
      registro: ZITTO,
    });
    const elenco = await commissioni.rispondi({ id: 1, type: "ponte/plance/elenco" }, {});
    assert.equal(elenco.result.plance.length, 1);
    const aprire = await commissioni.rispondi({ id: 2, type: "ponte/plancia" }, {});
    assert.equal(aprire.success, true);
  } finally {
    via();
  }
});
