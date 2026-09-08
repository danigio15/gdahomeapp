/* Le prove della configurazione tenuta dal ponte.
 *
 * Quello che si prova e' che risponda come l'integrazione: stessi stati,
 * stesse forme, stesse regole contro le perdite di dati. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  chiaviDiContenuto,
  Configurazione,
  eConfigurata,
  ScattoTroppoGrande,
  STATO,
  valoriBuoni,
} from "../src/configurazione.js";

function cassetta() {
  const cartella = mkdtempSync(join(tmpdir(), "configurazione-"));
  let ora = 1_000_000;
  const config = new Configurazione({ cartella, adesso: () => (ora += 1000) });
  return { config, cartella, via: () => rmSync(cartella, { recursive: true, force: true }) };
}

const CONFIGURATA = { cd_stanze: '[{"id":"sala","name":"Sala"}]', cd_sections: '{"luci":true}' };

test("cosa conta come contenuto, e cosa no", () => {
  assert.equal(chiaviDiContenuto({}), 0);
  assert.equal(chiaviDiContenuto(null), 0);
  assert.equal(chiaviDiContenuto({ cd_sections: '{"luci":true}', dm_schema_version: "4" }), 0);
  assert.equal(chiaviDiContenuto({ cd_stanze: "[]" }), 0);
  assert.equal(chiaviDiContenuto({ cd_stanze: '[{"name":""}]' }), 0);
  assert.equal(chiaviDiContenuto({ cd_stanze: '[{"name":"Sala"}]' }), 1);
  assert.equal(chiaviDiContenuto({ cd_costo_kwh: "0" }), 0);
  assert.equal(chiaviDiContenuto({ cd_costo_kwh: "0.25" }), 1);
  assert.equal(chiaviDiContenuto({ cd_solo_lettura: "false" }), 0);
  assert.equal(chiaviDiContenuto({ cd_solo_lettura: "true" }), 1);
  assert.equal(chiaviDiContenuto({ cd_nota: "non e' json" }), 1);
  assert.equal(chiaviDiContenuto({ cd_nota: "   " }), 0);

  /* `dm_dashboard_state` si giudica dalle sezioni: una busta vuota non e'
   * configurata, e nell'energia i `metadata` non contano. */
  assert.equal(chiaviDiContenuto({ dm_dashboard_state: '{"schema_version":4,"sections":{}}' }), 0);
  assert.equal(
    chiaviDiContenuto({ dm_dashboard_state: '{"sections":{"energy":{"metadata":{"x":1}}}}' }),
    0,
  );
  assert.equal(
    chiaviDiContenuto({ dm_dashboard_state: '{"sections":{"energy":{"grid":"sensor.rete"}}}' }),
    1,
  );
  assert.equal(
    chiaviDiContenuto({ dm_dashboard_state: '{"sections":{"rooms":[{"name":"Sala"}]}}' }),
    1,
  );
  assert.equal(eConfigurata(CONFIGURATA), true);
});

test("i valori accettati sono stringhe, entro i limiti", () => {
  assert.deepEqual(valoriBuoni({ a: "1", b: 2, c: null }), { a: "1" });
  assert.throws(() => valoriBuoni("no"), ScattoTroppoGrande);
  assert.throws(() => valoriBuoni([]), ScattoTroppoGrande);
  const troppe = Object.fromEntries(Array.from({ length: 257 }, (_, i) => [`k${i}`, "x"]));
  assert.throws(() => valoriBuoni(troppe), /too many keys/);
  assert.throws(() => valoriBuoni({ a: "x".repeat(2 * 1024 * 1024 + 1) }), /exceeds/);
  const grosso = Object.fromEntries(
    Array.from({ length: 5 }, (_, i) => [`k${i}`, "x".repeat(2 * 1024 * 1024)]),
  );
  assert.throws(() => valoriBuoni(grosso), /snapshot exceeds/);
});

test("una plancia nuova non ha niente, e la prima scrittura e' la revisione 1", () => {
  const { config, via } = cassetta();
  assert.deepEqual(config.leggi(), {
    profile: "primary",
    requested_profile: null,
    snapshot: null,
    recoverable: [],
    profiles: [],
  });

  const scritta = config.scrivi("primary", CONFIGURATA, { keys_revision: 3, writer_generation: 2 });
  assert.equal(scritta.status, STATO.salvato);
  assert.equal(scritta.profile, "primary");
  assert.deepEqual(scritta.snapshot, {
    revision: 1,
    updated_at: 1_001_000,
    keys_revision: 3,
    writer_generation: 2,
    reset: false,
    values: CONFIGURATA,
  });
  assert.deepEqual(scritta.recoverable, []);

  const letta = config.leggi("primary");
  assert.equal(letta.snapshot.revision, 1);
  assert.deepEqual(letta.profiles, ["primary"]);
  via();
});

test("scrivere gli stessi valori non conia una revisione, ma timbra la busta", () => {
  const { config, via } = cassetta();
  config.scrivi("primary", CONFIGURATA, { keys_revision: 1, writer_generation: 1 });
  const uguale = config.scrivi(
    "primary",
    { ...CONFIGURATA },
    { keys_revision: 1, writer_generation: 1 },
  );
  assert.equal(uguale.status, STATO.uguale);
  assert.equal(uguale.snapshot.revision, 1);

  const timbrata = config.scrivi(
    "primary",
    { ...CONFIGURATA },
    { keys_revision: 4, writer_generation: 3 },
  );
  assert.equal(timbrata.status, STATO.uguale);
  assert.equal(timbrata.snapshot.revision, 1);
  assert.equal(timbrata.snapshot.keys_revision, 4);
  assert.equal(timbrata.snapshot.writer_generation, 3);

  /* All'indietro no. */
  const indietro = config.scrivi(
    "primary",
    { ...CONFIGURATA },
    { keys_revision: 2, writer_generation: 1 },
  );
  assert.equal(indietro.snapshot.keys_revision, 4);
  assert.equal(indietro.snapshot.writer_generation, 3);
  via();
});

test("una revisione attesa che non torna e' un conflitto, e non si scrive", () => {
  const { config, via } = cassetta();
  config.scrivi("primary", CONFIGURATA);
  const conflitto = config.scrivi(
    "primary",
    { ...CONFIGURATA, cd_luci: "[1]" },
    { expected_revision: 0 },
  );
  assert.equal(conflitto.status, STATO.conflitto);
  assert.equal(conflitto.snapshot.revision, 1);
  assert.equal(conflitto.snapshot.values.cd_luci, undefined);

  const giusta = config.scrivi(
    "primary",
    { ...CONFIGURATA, cd_luci: "[1]" },
    { expected_revision: 1 },
  );
  assert.equal(giusta.status, STATO.salvato);
  assert.equal(giusta.snapshot.revision, 2);

  /* Su una plancia nuova la revisione attesa e' zero. */
  const nuova = config.scrivi("mare", CONFIGURATA, { expected_revision: 0 });
  assert.equal(nuova.status, STATO.salvato);
  assert.equal(
    config.scrivi("altra", CONFIGURATA, { expected_revision: 3 }).status,
    STATO.conflitto,
  );
  via();
});

test("il vuoto sopra una plancia configurata si rifiuta, a meno di un azzeramento voluto", () => {
  const { config, via } = cassetta();
  config.scrivi("primary", CONFIGURATA);
  const rifiutata = config.scrivi("primary", { cd_sections: "{}" });
  assert.equal(rifiutata.status, STATO.rifiutatoVuoto);
  assert.equal(rifiutata.snapshot.revision, 1);
  assert.deepEqual(rifiutata.snapshot.values, CONFIGURATA);

  const azzerata = config.scrivi("primary", { cd_sections: "{}" }, { reset: true });
  assert.equal(azzerata.status, STATO.salvato);
  assert.equal(azzerata.snapshot.revision, 2);
  assert.equal(azzerata.snapshot.reset, true);
  /* Quella di prima e' li' da recuperare. */
  assert.deepEqual(azzerata.recoverable, [
    { revision: 1, updated_at: 1_001_000, content_keys: 1, reset: false },
  ]);

  /* Su una plancia vuota il vuoto si scrive e basta. */
  assert.equal(config.scrivi("mare", { cd_sections: "{}" }).status, STATO.salvato);
  via();
});

test("si tengono le ultime cinque revisioni configurate, e si ripristinano", () => {
  const { config, via } = cassetta();
  for (let i = 1; i <= 7; i += 1) {
    config.scrivi("primary", { cd_stanze: `[{"name":"Stanza ${i}"}]` });
  }
  const letta = config.leggi("primary");
  assert.equal(letta.snapshot.revision, 7);
  assert.deepEqual(
    letta.recoverable.map((una) => una.revision),
    [6, 5, 4, 3, 2],
  );

  const ripristinata = config.ripristina("primary", 4);
  assert.equal(ripristinata.status, STATO.salvato);
  assert.equal(ripristinata.snapshot.revision, 8);
  assert.equal(ripristinata.snapshot.values.cd_stanze, '[{"name":"Stanza 4"}]');
  assert.deepEqual(
    ripristinata.recoverable.map((una) => una.revision),
    [7, 6, 5, 4, 3],
  );

  const sconosciuta = config.ripristina("primary", 99);
  assert.equal(sconosciuta.status, STATO.conflitto);
  assert.equal(sconosciuta.snapshot.revision, 8);
  assert.equal(config.ripristina("mai-vista", 1).status, STATO.conflitto);
  via();
});

test("quello che si scrive resta sul disco, e lo rilegge chi viene dopo", () => {
  const { config, cartella, via } = cassetta();
  config.scrivi("primary", CONFIGURATA, { keys_revision: 2 });
  config.scrivi("primary", { ...CONFIGURATA, cd_luci: "[1]" });

  const dopo = new Configurazione({ cartella });
  const letta = dopo.leggi("primary");
  assert.equal(letta.snapshot.revision, 2);
  assert.equal(letta.snapshot.values.cd_luci, "[1]");
  assert.deepEqual(
    letta.recoverable.map((una) => una.revision),
    [1],
  );
  via();
});

test("i profili hanno un nome semplice", () => {
  assert.equal(Configurazione.profiloBuono("primary"), true);
  assert.equal(Configurazione.profiloBuono("plancia-mare"), true);
  assert.equal(Configurazione.profiloBuono("Mare"), false);
  assert.equal(Configurazione.profiloBuono("../x"), false);
  assert.equal(Configurazione.profiloBuono(""), false);
  assert.equal(Configurazione.profiloBuono(3), false);
});
