/* Con Base si vede solo la principale: se e' vuota e il lavoro sta in
 * un'altra plancia, lo si riporta li' (`la-plancia-di-base.js`). */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Configurazione } from "../src/configurazione.js";
import { Plance } from "../src/plance.js";
import { portaNellaPrincipale } from "../src/la-plancia-di-base.js";

const ZITTO = { info() {}, attenzione() {}, errore() {} };
const CASA = { cd_stanze: '[{"id":"sala","name":"Sala"}]', cd_sections: '{"luci":true}' };
const ALTRA = { cd_stanze: '[{"id":"cucina","name":"Cucina"}]' };

function unaCasa() {
  const cartella = mkdtempSync(join(tmpdir(), "plancia-di-base-"));
  let ora = 1000;
  const configurazione = new Configurazione({ cartella, adesso: () => (ora += 1000) });
  const plance = new Plance({ cartella, registro: ZITTO, adesso: () => 1000 });
  return {
    cartella,
    configurazione,
    plance,
    via: () => rmSync(cartella, { recursive: true, force: true }),
  };
}

test("la principale vuota prende il lavoro della plancia «casa», che resta com'era", () => {
  const { configurazione, plance, via } = unaCasa();
  try {
    const casa = plance.aggiungi("casa");
    configurazione.scrivi(casa.profilo, CASA);
    const detti = [];
    const da = portaNellaPrincipale({
      plance,
      configurazione,
      registro: { info: (riga) => detti.push(riga) },
    });
    assert.equal(da, casa.profilo);
    assert.deepEqual(configurazione.leggi("primary").snapshot.values, CASA);
    assert.deepEqual(configurazione.leggi(casa.profilo).snapshot.values, CASA);
    assert.match(detti.join("\n"), /«casa»/);
    /* E la seconda volta non c'e' piu' niente da fare. */
    assert.equal(portaNellaPrincipale({ plance, configurazione }), "");
  } finally {
    via();
  }
});

test("una principale con dentro qualcosa non si tocca", () => {
  const { configurazione, plance, via } = unaCasa();
  try {
    configurazione.scrivi("primary", ALTRA);
    const casa = plance.aggiungi("casa");
    configurazione.scrivi(casa.profilo, CASA);
    assert.equal(portaNellaPrincipale({ plance, configurazione }), "");
    assert.deepEqual(configurazione.leggi("primary").snapshot.values, ALTRA);
  } finally {
    via();
  }
});

test("fra due plance configurate vince quella scritta per ultima", () => {
  const { configurazione, plance, via } = unaCasa();
  try {
    const prima = plance.aggiungi("vecchia");
    const seconda = plance.aggiungi("casa");
    configurazione.scrivi(seconda.profilo, CASA);
    configurazione.scrivi(prima.profilo, ALTRA);
    assert.equal(portaNellaPrincipale({ plance, configurazione }), prima.profilo);
    assert.deepEqual(configurazione.leggi("primary").snapshot.values, ALTRA);
  } finally {
    via();
  }
});

test("senza altre plance configurate non succede niente", () => {
  const { configurazione, plance, via } = unaCasa();
  try {
    plance.aggiungi("casa");
    assert.equal(portaNellaPrincipale({ plance, configurazione }), "");
    assert.equal(configurazione.leggi("primary").snapshot, null);
  } finally {
    via();
  }
});
