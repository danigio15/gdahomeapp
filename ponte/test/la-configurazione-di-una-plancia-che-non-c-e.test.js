/* `dashboardmodern/config/get` con un profilo inventato rispondeva con uno
 * scatto vuoto e, dentro, i nomi di tutte le plance della casa (`profiles`),
 * anche di quelle riservate ad altri; e ogni nome inventato restava per
 * sempre fra quelli gia' chiesti all'integrazione (`_giaChiesti`). Adesso un
 * profilo che non e' di nessuna plancia e' «non c'e'», e dei nomi si dicono
 * solo quelli delle plance che chi chiede vede.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Commissioni } from "../src/commissioni.js";
import { Configurazione } from "../src/configurazione.js";
import { Plance } from "../src/plance.js";

const ZITTO = { info() {}, attenzione() {}, errore() {} };
const LEI = "a".repeat(32);
const LUI = "b".repeat(32);

function unaCasa() {
  const cartella = mkdtempSync(join(tmpdir(), "config-che-non-c-e-"));
  const plance = new Plance({ cartella, registro: ZITTO });
  const sua = plance.aggiungi("La camera di lei");
  plance.chiLaVede(sua.profilo, [LEI]);
  const configurazione = new Configurazione({ cartella });
  configurazione.scrivi("primary", { cd_stanze: '[{"name":"Cucina"}]' });
  configurazione.scrivi(sua.profilo, { cd_stanze: '[{"name":"Camera"}]' });
  /* Una casa con l'integrazione che risponde: e' li' che i nomi si contano. */
  const chieste = [];
  const casa = {
    async chiedi(comando) {
      chieste.push(comando);
      return { snapshot: null };
    },
  };
  const commissioni = new Commissioni({ casa, registro: ZITTO, plance, configurazione });
  return {
    commissioni,
    chieste,
    sua: sua.profilo,
    via: () => rmSync(cartella, { recursive: true, force: true }),
  };
}

const leggi = (casa, profilo, chi) =>
  casa.commissioni.rispondi(
    { id: 1, type: "dashboardmodern/config/get", profile: profilo },
    { chiChiede: chi, amministra: false },
  );

test("un profilo che non e' di nessuna plancia e' «non c'e'», e non si ricorda", async () => {
  const casa = unaCasa();
  try {
    for (let n = 0; n < 50; n += 1) {
      const risposta = await leggi(casa, `inventato-${n}`, LUI);
      assert.equal(risposta.success, false);
      assert.equal(risposta.error.code, "not_found");
      assert.equal(JSON.stringify(risposta).includes(casa.sua), false);
    }
    assert.equal(casa.chieste.length, 0, "nessuna domanda all'integrazione per un nome inventato");
    assert.equal(casa.commissioni._giaChiesti?.size ?? 0, 0);
  } finally {
    casa.via();
  }
});

test("dei nomi delle plance si dicono solo quelli delle plance che chi chiede vede", async () => {
  const casa = unaCasa();
  try {
    const lui = await leggi(casa, "primary", LUI);
    assert.equal(lui.success, true);
    assert.deepEqual(lui.result.profiles, ["primary"]);
    assert.equal(lui.result.snapshot.values.cd_stanze, '[{"name":"Cucina"}]');

    const lei = await leggi(casa, "primary", LEI);
    assert.deepEqual(lei.result.profiles, ["primary", casa.sua].sort());
    const sua = await leggi(casa, casa.sua, LEI);
    assert.equal(sua.result.snapshot.values.cd_stanze, '[{"name":"Camera"}]');
  } finally {
    casa.via();
  }
});
