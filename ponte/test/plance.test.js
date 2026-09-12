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
        istanza: "ponte",
        primaria: true,
        creata_il: 0,
      },
    ]);
    /* «ponte» e non «ponte-primary»: quel nome sta gia' scritto nei depositi
     * dei telefoni di chi ce l'ha da prima, e cambiarlo vorrebbe dire una
     * plancia che si ritrova il tema di serie senza che nessuno l'abbia
     * toccato. */
    assert.equal(plance.prima.istanza, "ponte");

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
      istanza: "ponte-casa-al-mare",
      primaria: false,
      creata_il: 7000,
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
