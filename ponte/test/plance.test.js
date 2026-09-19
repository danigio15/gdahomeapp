/* Le prove delle plance: piu' d'una, come nella dashboard.
 *
 * Quello che conta qui non e' che un elenco si allunghi — quello lo fa un
 * `push` — ma quattro cose che, sbagliate, costano il lavoro di chi si e'
 * disegnato la casa:
 *
 *  - la **prima** plancia c'e' sempre, si chiama come si e' sempre chiamata e
 *    tiene il cassetto che ha sempre tenuto: chi ha l'add-on da prima di
 *    questa versione non deve accorgersi di niente;
 *  - i tre nomi di una plancia fanno tre mestieri diversi — il cassetto della
 *    configurazione, il titolo sullo schermo, l'istanza nel deposito del
 *    browser — e rinominarla non deve toccare gli altri due;
 *  - togliendone una va via anche il suo cassetto, se no il giorno che
 *    qualcuno ne rifa' una con lo stesso nome si ritrova il lavoro di prima;
 *  - la prima non si toglie: una casa senza nessuna plancia e' un'app che si
 *    apre su niente.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Plance, QUANTE_AL_MASSIMO, QuellaPlanciaNo, TroppePlance } from "../src/plance.js";
import { Configurazione } from "../src/configurazione.js";

const ZITTO = { info() {}, attenzione() {}, errore() {} };

function unPosto() {
  const cartella = mkdtempSync(join(tmpdir(), "plance-"));
  return { cartella, via: () => rmSync(cartella, { recursive: true, force: true }) };
}

function lePlance(cartella, { adesso = () => 1000 } = {}) {
  return new Plance({ cartella, registro: ZITTO, adesso });
}

test("la prima plancia c'e' sempre, e si chiama come il prodotto", () => {
  const { cartella, via } = unPosto();
  try {
    const plance = lePlance(cartella);
    assert.deepEqual(plance.elenco(), [
      {
        profilo: "primary",
        titolo: "gdahome",
        istanza: "gdahome",
        primaria: true,
        creata_il: 0,
        /* Vuoto: la vedono tutti. E' come nasce una plancia, ed e' come si
         * ritrovano quelle di chi ha l'add-on da prima. */
        utenti: [],
        solo_admin: false,
      },
    ]);
    /* «gdahome» e non «gdahome-primary»: la prima c'e' sempre, e il suo nome
     * non ha bisogno di dire quale e'. */
    assert.equal(plance.prima.istanza, "gdahome");

    /* E riaprendo lo stesso posto non nasce niente di nuovo. */
    assert.equal(lePlance(cartella).quante, 1);
  } finally {
    via();
  }
});

test("una plancia in piu' ha un cassetto suo, e un'istanza sua", () => {
  const { cartella, via } = unPosto();
  try {
    const plance = lePlance(cartella, { adesso: () => 7000 });
    const nuova = plance.aggiungi("Casa al mare");
    assert.deepEqual(nuova, {
      profilo: "casa-al-mare",
      titolo: "Casa al mare",
      istanza: "gdahome-casa-al-mare",
      primaria: false,
      creata_il: 7000,
      utenti: [],
      solo_admin: false,
    });
    /* La prima resta la prima, e resta in cima. */
    assert.deepEqual(
      plance.elenco().map((una) => una.profilo),
      ["primary", "casa-al-mare"],
    );

    /* Il cassetto deve passare per buono alla cassetta della configurazione:
     * e' la chiave con cui il lavoro sta sul disco. */
    assert.ok(Configurazione.profiloBuono(nuova.profilo));

    /* Due plance con lo stesso nome non si pestano i piedi: il cassetto e'
     * un altro, e il titolo puo' ripetersi quanto vuole. */
    const gemella = plance.aggiungi("Casa al mare");
    assert.equal(gemella.profilo, "casa-al-mare-2");
    assert.equal(gemella.titolo, "Casa al mare");
  } finally {
    via();
  }
});

test("un titolo che non lascia lettere prende un nome qualunque, non nessuno", () => {
  const { cartella, via } = unPosto();
  try {
    const plance = lePlance(cartella);
    /* Il cassetto si ricava dal titolo, e un titolo fatto di soli emoji o
     * scritto in un altro alfabeto non lascia niente da cui ricavarlo: allora
     * il nome lo fa il difetto, che e' brutto e funziona. */
    const emoji = plance.aggiungi("🏖️");
    assert.ok(Configurazione.profiloBuono(emoji.profilo));
    assert.equal(emoji.titolo, "🏖️");
    const senzaNome = plance.aggiungi("   ");
    assert.ok(Configurazione.profiloBuono(senzaNome.profilo));
    assert.equal(senzaNome.titolo, "Plancia");
  } finally {
    via();
  }
});

test("rinominare cambia il titolo e nient'altro", () => {
  const { cartella, via } = unPosto();
  try {
    const plance = lePlance(cartella);
    const nuova = plance.aggiungi("Mare");
    const dopo = plance.rinomina(nuova.profilo, "  Casa   al  mare  ");
    /* Lo spazio di troppo si mangia, il resto no. */
    assert.equal(dopo.titolo, "Casa al mare");
    /* Il cassetto e l'istanza restano quelli: rinominare una plancia non deve
     * cancellarle la configurazione ne' il tema. */
    assert.equal(dopo.profilo, nuova.profilo);
    assert.equal(dopo.istanza, nuova.istanza);

    /* Anche la prima si rinomina: e' la sua casa, si chiama come vuole. */
    assert.equal(plance.rinomina("primary", "La mia").titolo, "La mia");

    /* Un titolo vuoto no: una plancia senza nome, in un elenco, non si
     * trova. */
    assert.throws(() => plance.rinomina(nuova.profilo, "   "), { codice: "senza_titolo" });
    assert.throws(() => plance.rinomina("mai-esistita", "x"), QuellaPlanciaNo);
  } finally {
    via();
  }
});

test("togliendo una plancia va via anche il suo cassetto", () => {
  const { cartella, via } = unPosto();
  try {
    const plance = lePlance(cartella);
    const cassetta = new Configurazione({ cartella, adesso: () => 1000 });
    const nuova = plance.aggiungi("Mare");
    cassetta.scrivi(nuova.profilo, { "dm-home": '{"x":1}' }, { updated_at: 1000 });
    assert.ok(cassetta.leggi(nuova.profilo).snapshot);

    plance.togli(nuova.profilo, { dimentica: (quale) => cassetta.dimentica(quale) });
    assert.equal(plance.quante, 1);
    /* Il cassetto non c'e' piu': chi rifacesse una plancia con lo stesso nome
     * non si ritrova il lavoro di quella di prima. */
    assert.deepEqual(cassetta.leggi(nuova.profilo).snapshot, null);
    assert.deepEqual(cassetta.leggi(nuova.profilo).profiles, []);
  } finally {
    via();
  }
});

test("la prima non si toglie, e quella che non c'e' nemmeno", () => {
  const { cartella, via } = unPosto();
  try {
    const plance = lePlance(cartella);
    assert.throws(() => plance.togli("primary"), { codice: "non_la_prima" });
    assert.throws(() => plance.togli("mai-esistita"), { codice: "plancia_sconosciuta" });
    assert.equal(plance.quante, 1);
  } finally {
    via();
  }
});

test("oltre il tetto non se ne aggiungono, e si dice", () => {
  const { cartella, via } = unPosto();
  try {
    const plance = lePlance(cartella);
    for (let quante = plance.quante; quante < QUANTE_AL_MASSIMO; quante += 1) {
      plance.aggiungi(`Plancia ${quante}`);
    }
    assert.equal(plance.quante, QUANTE_AL_MASSIMO);
    assert.throws(() => plance.aggiungi("Una di troppo"), TroppePlance);
  } finally {
    via();
  }
});

test("un file scritto a mano non fa cadere il ponte", () => {
  const { cartella, via } = unPosto();
  try {
    /* Il file sta in `/data`, e in `/data` ci si arriva. Quello che c'e'
     * scritto si prende per quello che si capisce, e il resto si butta: una
     * riga senza cassetto non e' una plancia, e due con lo stesso cassetto
     * sono una. */
    writeFileSync(
      join(cartella, "plance.json"),
      JSON.stringify({
        plance: [
          { titolo: "senza cassetto" },
          { profilo: "mare", titolo: "Mare" },
          { profilo: "mare", titolo: "Mare di nuovo" },
        ],
      }),
    );
    const plance = lePlance(cartella);
    assert.deepEqual(
      plance.elenco().map((una) => una.profilo),
      ["primary", "mare"],
    );
    /* E il file sistemato resta sistemato. */
    const scritto = JSON.parse(readFileSync(join(cartella, "plance.json"), "utf8"));
    assert.equal(scritto.plance.length, 2);
  } finally {
    via();
  }
});

/* ─── Il nome di chi ha montato l'impianto ─────────────────────────────────
 *
 * La domanda che ha fatto nascere queste prove: «se l'utente toglie
 * l'installatore, cosa gli resta? perde la configurazione della plancia?»
 *
 * No, e il motivo e' che qui si tocca **solo il titolo**. La configurazione
 * sta sotto il `profilo` (`configurazione.js`), e il profilo non si sfiora:
 * cambiare il titolo e' come cambiare la targhetta sulla porta, quello che
 * c'e' dentro la stanza non si muove. Queste prove tengono ferma quella riga.
 */

test("la plancia prende il nome dell'installatore, e lo rida' indietro quando se ne va", () => {
  const { cartella, via } = unPosto();
  try {
    const plance = lePlance(cartella);
    assert.equal(plance.quale().titolo, "gdahome");

    assert.equal(plance.intestala("Impianti Rossi"), true);
    assert.equal(plance.quale().titolo, "Impianti Rossi");

    /* E togliendolo si torna al nostro, senza che nessuno scriva niente. */
    assert.equal(plance.intestala(""), true);
    assert.equal(plance.quale().titolo, "gdahome");
  } finally {
    via();
  }
});

test("togliendo l'installatore non si perde niente della plancia", () => {
  /* Il profilo e' quello che regge la configurazione, ed e' quello che non si
   * tocca. Se cambiasse, chi ci abita si ritroverebbe una plancia vuota il
   * giorno che cambia installatore — e nessuno collegherebbe le due cose. */
  const { cartella, via } = unPosto();
  try {
    const plance = lePlance(cartella);
    const prima = plance.quale();

    plance.intestala("Impianti Rossi");
    plance.intestala("");
    const dopo = plance.quale();

    assert.equal(dopo.profilo, prima.profilo, "il profilo e' cambiato: la configurazione e' persa");
    assert.equal(dopo.istanza, prima.istanza, "l'istanza e' cambiata: il browser non si ritrova");
    assert.equal(dopo.primaria, true);
    assert.deepEqual(dopo.utenti, prima.utenti);
    assert.equal(dopo.solo_admin, prima.solo_admin);
  } finally {
    via();
  }
});

test("un titolo scritto da chi ci abita non lo tocca nessun installatore", () => {
  /* Ne' per metterci il suo, ne' per rimetterci il nostro. E' la stessa
   * regola con cui, a suo tempo, si e' cambiato il nome del prodotto di
   * prima: una volta sola, e solo se nessuno l'aveva rinominata. */
  const { cartella, via } = unPosto();
  try {
    const plance = lePlance(cartella);
    plance.rinomina("primary", "Casa nostra");

    assert.equal(plance.intestala("Impianti Rossi"), false);
    assert.equal(plance.quale().titolo, "Casa nostra");
    assert.equal(plance.intestala(""), false);
    assert.equal(plance.quale().titolo, "Casa nostra");
  } finally {
    via();
  }
});

test("rinominandola a mano, quel titolo diventa suo e non torna piu' indietro", () => {
  /* Il caso storto: l'installatore c'e', la plancia porta il suo nome, e chi
   * ci abita la rinomina. Da quel momento quel titolo e' di chi ci abita, e
   * il giorno che l'installatore si toglie non deve tornare «gdahome»
   * cancellando quello che aveva scritto. */
  const { cartella, via } = unPosto();
  try {
    const plance = lePlance(cartella);
    plance.intestala("Impianti Rossi");
    plance.rinomina("primary", "La mia casa");

    assert.equal(plance.intestala(""), false);
    assert.equal(plance.quale().titolo, "La mia casa");
  } finally {
    via();
  }
});

test("lo stesso installatore due volte non riscrive niente", () => {
  /* Il rapporto parte ogni minuto e porta ogni volta lo stesso nome: se ogni
   * giro scrivesse sul disco, quel file cambierebbe data millequattrocento
   * volte al giorno, e chi guarda i backup non capirebbe piu' niente. */
  const { cartella, via } = unPosto();
  try {
    const plance = lePlance(cartella);
    assert.equal(plance.intestala("Impianti Rossi"), true);
    assert.equal(plance.intestala("Impianti Rossi"), false);
    assert.equal(plance.intestala(""), true);
    assert.equal(plance.intestala(""), false);
  } finally {
    via();
  }
});

test("il nome dell'installatore sopravvive a una riaccensione", () => {
  const { cartella, via } = unPosto();
  try {
    lePlance(cartella).intestala("Impianti Rossi");
    /* Riacceso: se `daInstallatore` non sopravvivesse alla ripulita, quel
     * titolo diventerebbe «di chi ci abita» e non si toglierebbe piu'. */
    const dopo = lePlance(cartella);
    assert.equal(dopo.quale().titolo, "Impianti Rossi");
    assert.equal(dopo.intestala(""), true);
    assert.equal(dopo.quale().titolo, "gdahome");
  } finally {
    via();
  }
});
