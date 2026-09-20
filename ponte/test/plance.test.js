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

/* ─── Le vesti: il titolo scelto da chi ha montato l'impianto ───────────
 *
 * La domanda che ha fatto nascere queste prove: «se l'utente toglie
 * l'installatore, cosa gli resta? perde la configurazione della plancia?»
 *
 * No, e il motivo e' che qui si tocca **solo il titolo**. La configurazione
 * sta sotto il `profilo` (`configurazione.js`), e il profilo non si sfiora:
 * cambiare il titolo e' come cambiare la targhetta sulla porta, quello che
 * c'e' dentro la stanza non si muove. Queste prove tengono ferma quella riga.
 *
 * E la seconda domanda, arrivata dopo: «e se chi ci abita la rinomina?». Il
 * suo titolo resta, finche' l'installatore non sceglie qualcos'altro.
 */

test("la plancia si veste col titolo scelto, e lo rida' indietro quando la scelta sparisce", () => {
  const { cartella, via } = unPosto();
  try {
    const plance = lePlance(cartella);
    plance.aggiungi("Suocero");
    assert.equal(
      plance.vesti({ primary: { titolo: "Casa Rossi" }, suocero: { titolo: "Nonni" } }),
      true,
    );
    assert.equal(plance.quale().titolo, "Casa Rossi");
    assert.equal(plance.quale("suocero").titolo, "Nonni");

    /* La stessa scelta, al rapporto dopo: niente da scrivere. */
    assert.equal(
      plance.vesti({ primary: { titolo: "Casa Rossi" }, suocero: { titolo: "Nonni" } }),
      false,
    );

    /* Via le scelte: la prima torna nostra, l'altra torna com'era in casa. */
    assert.equal(plance.vesti({}), true);
    assert.equal(plance.quale().titolo, "gdahome");
    assert.equal(plance.quale("suocero").titolo, "Suocero");
    assert.equal(plance.vesti({}), false);
  } finally {
    via();
  }
});

test("vestendola non si perde niente della plancia", () => {
  /* Il profilo e' quello che regge la configurazione, ed e' quello che non si
   * tocca. Se cambiasse, chi ci abita si ritroverebbe una plancia vuota il
   * giorno che l'installatore le da' un nome — e nessuno collegherebbe le
   * due cose. */
  const { cartella, via } = unPosto();
  try {
    const plance = lePlance(cartella);
    plance.chiLaVede("primary", ["u1"]);
    const prima = plance.quale();

    plance.vesti({ primary: { titolo: "Casa Rossi" } });
    plance.vesti({});
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

test("un titolo scritto in casa resta finche' l'installatore non sceglie qualcos'altro", () => {
  /* Il caso storto: la plancia porta il titolo scelto dall'installatore, e
   * chi ci abita la rinomina dall'app. La stessa scelta torna ogni minuto
   * col rapporto, e non deve riscrivere niente — se no i due se la
   * rinominerebbero a vicenda per sempre. */
  const { cartella, via } = unPosto();
  try {
    const plance = lePlance(cartella);
    plance.vesti({ primary: { titolo: "Casa Rossi" } });
    plance.rinomina("primary", "La mia casa");

    assert.equal(plance.vesti({ primary: { titolo: "Casa Rossi" } }), false);
    assert.equal(plance.quale().titolo, "La mia casa");

    /* Una scelta **nuova** invece si mette, e il titolo di casa si ricorda:
     * sparita la scelta, torna quello. */
    assert.equal(plance.vesti({ primary: { titolo: "Villa Rossi" } }), true);
    assert.equal(plance.quale().titolo, "Villa Rossi");
    assert.equal(plance.vesti({}), true);
    assert.equal(plance.quale().titolo, "La mia casa");
  } finally {
    via();
  }
});

test("se la scelta sparisce dopo che in casa l'hanno rinominata, il titolo di casa resta", () => {
  const { cartella, via } = unPosto();
  try {
    const plance = lePlance(cartella);
    plance.vesti({ primary: { titolo: "Casa Rossi" } });
    plance.rinomina("primary", "La mia casa");
    assert.equal(plance.vesti({}), true);
    assert.equal(plance.quale().titolo, "La mia casa");
    assert.equal(plance.vesti({}), false);
  } finally {
    via();
  }
});

test("la scelta sopravvive a una riaccensione, e una plancia che non c'e' non si veste", () => {
  const { cartella, via } = unPosto();
  try {
    lePlance(cartella).vesti({ primary: { titolo: "Casa Rossi" }, fantasma: { titolo: "X" } });
    /* Riacceso: se `scelta` e `daInstallatore` non sopravvivessero alla
     * ripulita, quel titolo diventerebbe «di chi ci abita» e non si
     * toglierebbe piu'. */
    const dopo = lePlance(cartella);
    assert.equal(dopo.quale().titolo, "Casa Rossi");
    assert.equal(dopo.quale("fantasma"), null);
    assert.equal(dopo.vesti({ primary: { titolo: "Casa Rossi" } }), false);
    assert.equal(dopo.vesti({}), true);
    assert.equal(dopo.quale().titolo, "gdahome");
  } finally {
    via();
  }
});

test("il titolo che fino a ieri prendeva il nome dell'installatore torna nostro", () => {
  /* Fino alla 1.5.9.12 la prima plancia prendeva da sola il nome di chi
   * segue la casa, e lo segnava in `daInstallatore`. Dopo l'aggiornamento,
   * alla prima risposta senza scelte, quel titolo torna «gdahome»: il nome
   * da solo non va piu' nel menu laterale, ci va quello scelto. */
  const { cartella, via } = unPosto();
  try {
    writeFileSync(
      join(cartella, "plance.json"),
      JSON.stringify({
        plance: [
          {
            profilo: "primary",
            titolo: "Impianti Rossi",
            creata_il: 0,
            utenti: [],
            solo_admin: false,
            daInstallatore: "Impianti Rossi",
          },
        ],
      }),
    );
    const plance = lePlance(cartella);
    assert.equal(plance.quale().titolo, "Impianti Rossi");
    assert.equal(plance.vesti({}), true);
    assert.equal(plance.quale().titolo, "gdahome");
  } finally {
    via();
  }
});

test("una plancia voluta dal cruscotto nasce una volta, gia' vestita, e se in casa la tolgono non rinasce", () => {
  const { cartella, via } = unPosto();
  try {
    const plance = lePlance(cartella);
    const avvisi = [];
    plance.quandoCambia = (elenco) => avvisi.push(elenco.map((una) => una.profilo));
    const mappa = { taverna: { titolo: "Taverna", velo: "Rossi", nuova: true } };
    assert.equal(plance.vesti(mappa), true);
    assert.equal(plance.quale("taverna").titolo, "Taverna");
    assert.equal(plance.quale("taverna").istanza, "gdahome-taverna");
    assert.deepEqual(avvisi, [["primary", "taverna"]]);

    /* La stessa mappa, il giro dopo: niente da fare. E senza «nuova» — il
     * quadro l'ha vista nel rapporto — e' una plancia come le altre. */
    assert.equal(plance.vesti(mappa), false);
    assert.equal(plance.vesti({ taverna: { titolo: "Taverna" } }), false);

    /* Sparita la scelta, il titolo resta il suo: e' nata con quello. */
    assert.equal(plance.vesti({}), true);
    assert.equal(plance.quale("taverna").titolo, "Taverna");

    /* In casa la tolgono: la mappa senza «nuova» non la fa rinascere. */
    plance.archivio.dati.plance = plance.archivio.dati.plance.filter(
      (una) => una.profilo !== "taverna",
    );
    plance.archivio.salva();
    assert.equal(plance.vesti({ taverna: { titolo: "Taverna" } }), false);
    assert.equal(plance.quale("taverna"), null);
  } finally {
    via();
  }
});

test("dal cruscotto non nasce una plancia storta, senza nome, ne' la nona", () => {
  const { cartella, via } = unPosto();
  try {
    const plance = lePlance(cartella);
    assert.equal(plance.vesti({ "Taverna!": { titolo: "Taverna", nuova: true } }), false);
    assert.equal(plance.vesti({ taverna: { titolo: "  ", nuova: true } }), false);
    assert.equal(plance.quante, 1);
    /* E la prima non si crea due volte: «nuova» su un profilo che c'e' gia'
     * e' solo una scelta di titolo. */
    assert.equal(plance.vesti({ primary: { titolo: "Casa Rossi", nuova: true } }), true);
    assert.equal(plance.quante, 1);
    assert.equal(plance.quale().titolo, "Casa Rossi");

    for (let n = 2; n <= QUANTE_AL_MASSIMO; n += 1) plance.aggiungi(`Plancia ${n}`);
    assert.equal(plance.quante, QUANTE_AL_MASSIMO);
    /* La scelta della prima resta nella mappa, come nella vita: e' la nona
     * che non nasce, e non c'e' altro da scrivere. */
    assert.equal(
      plance.vesti({ primary: { titolo: "Casa Rossi" }, nona: { titolo: "Nona", nuova: true } }),
      false,
    );
    assert.equal(plance.quale("nona"), null);
    assert.equal(plance.quante, QUANTE_AL_MASSIMO);
  } finally {
    via();
  }
});
