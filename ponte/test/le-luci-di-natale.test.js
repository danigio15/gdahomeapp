/* Le luci di Natale nel ponte (`le-luci-di-natale.js`, e le regole in
 * `plancia/src/core/feste.js`), con un orologio finto.
 *
 * Quello che deve restare vero: al tramonto (o all'ora scelta) si accendono,
 * all'ora di spegnimento si spengono, una volta sola; nei giorni non scelti
 * no; chi le spegne a mano non viene contraddetto fino all'intervallo dopo;
 * un riavvio nel mezzo non riaccende niente; e fuori dalle feste — dal 7
 * gennaio al 7 dicembre — il ponte non tocca niente, nemmeno se la
 * configurazione c'e'.
 */

import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { LuciDiNatale } from "../src/le-luci-di-natale.js";

const alle = (anno, mese, giorno, ore, minuti = 0, secondi = 0) =>
  new Date(anno, mese - 1, giorno, ore, minuti, secondi).getTime();

const FESTE = {
  luci: [{ entity: "switch.presa_albero", nome: "Albero" }, { entity: "light.presepe" }],
  accendi: { tipo: "tramonto", scarto: 0 },
  spegni: { ora: "23:30" },
  giorni: [0, 1, 2, 3, 4, 5, 6],
};

/* Una casa finta: gli stati in una mappa, i servizi annotati e applicati
 * agli stati come farebbe Home Assistant. */
function casaFinta({ feste = FESTE, tramonto = "2026-12-20T16:42:00", cartella = "" } = {}) {
  const orologio = { ora: alle(2026, 12, 20, 12) };
  const stati = new Map([
    ["switch.presa_albero", { state: "off", attributes: {} }],
    ["light.presepe", { state: "off", attributes: {} }],
    [
      "sun.sun",
      { state: "above_horizon", attributes: { next_setting: new Date(tramonto).toISOString() } },
    ],
  ]);
  const chiamate = [];
  const casa = {
    async chiedi(comando) {
      chiamate.push(comando);
      for (const id of comando.service_data.entity_id)
        stati.set(id, { state: comando.service === "turn_on" ? "on" : "off", attributes: {} });
      return {};
    },
  };
  const configurazione = {
    leggi: () => ({ snapshot: { values: { cd_feste: JSON.stringify(feste) } } }),
  };
  const luci = new LuciDiNatale({
    cartella,
    casa,
    configurazione,
    stati: (id) => stati.get(id) ?? null,
    adesso: () => orologio.ora,
  });
  const a = async (quando) => {
    orologio.ora = quando;
    return luci.battito();
  };
  return { luci, stati, chiamate, orologio, a };
}

const servizi = (chiamate) => chiamate.map((c) => `${c.domain}.${c.service}`);

test("al tramonto si accendono, una chiamata per dominio; alle 23:30 si spengono", async () => {
  const { chiamate, a, stati } = casaFinta();
  await a(alle(2026, 12, 20, 16, 41, 30));
  assert.deepEqual(chiamate, []);
  await a(alle(2026, 12, 20, 16, 42));
  assert.deepEqual(servizi(chiamate), ["switch.turn_on", "light.turn_on"]);
  assert.deepEqual(chiamate[0].service_data, { entity_id: ["switch.presa_albero"] });
  assert.equal(stati.get("light.presepe").state, "on");
  await a(alle(2026, 12, 20, 20));
  await a(alle(2026, 12, 20, 23, 29, 30));
  assert.equal(chiamate.length, 2);
  await a(alle(2026, 12, 20, 23, 30));
  assert.deepEqual(servizi(chiamate).slice(2), ["switch.turn_off", "light.turn_off"]);
  /* Riaccese a mano per gli ospiti: l'orario ha gia' detto la sua. */
  stati.set("switch.presa_albero", { state: "on", attributes: {} });
  await a(alle(2026, 12, 20, 23, 50));
  assert.equal(chiamate.length, 4);
});

test("lo scarto sul tramonto e l'ora scritta", async () => {
  const conScarto = casaFinta({ feste: { ...FESTE, accendi: { tipo: "tramonto", scarto: 30 } } });
  await conScarto.a(alle(2026, 12, 20, 17, 0));
  assert.deepEqual(conScarto.chiamate, []);
  await conScarto.a(alle(2026, 12, 20, 17, 12));
  assert.equal(conScarto.chiamate.length, 2);
  const allOra = casaFinta({ feste: { ...FESTE, accendi: { tipo: "ora", ora: "18:15" } } });
  await allOra.a(alle(2026, 12, 20, 18, 14));
  assert.deepEqual(allOra.chiamate, []);
  await allOra.a(alle(2026, 12, 20, 18, 15));
  assert.equal(allOra.chiamate.length, 2);
});

test("spente a mano dentro l'intervallo: non si riaccendono fino a domani", async () => {
  const { chiamate, a, stati, orologio } = casaFinta();
  await a(alle(2026, 12, 20, 16, 43));
  assert.equal(chiamate.length, 2);
  stati.set("switch.presa_albero", { state: "off", attributes: {} });
  stati.set("light.presepe", { state: "off", attributes: {} });
  for (let minuti = 0; minuti < 120; minuti += 1) await a(alle(2026, 12, 20, 19, minuti));
  assert.equal(chiamate.length, 2, "nessuna riaccensione");
  /* A fine intervallo non c'e' niente da spegnere. */
  await a(alle(2026, 12, 20, 23, 30));
  assert.equal(chiamate.length, 2);
  /* Il giorno dopo si ricomincia. sun.sun dice gia' il tramonto di domani. */
  orologio.ora = alle(2026, 12, 21, 16, 43);
  await a(orologio.ora);
  assert.deepEqual(servizi(chiamate).slice(2), ["switch.turn_on", "light.turn_on"]);
});

test("un riavvio nel mezzo si ricorda della sera: niente riaccensioni", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "luci-di-natale-"));
  const prima = casaFinta({ cartella });
  await prima.a(alle(2026, 12, 20, 16, 43));
  prima.stati.set("switch.presa_albero", { state: "off", attributes: {} });
  prima.stati.set("light.presepe", { state: "off", attributes: {} });
  await prima.a(alle(2026, 12, 20, 18));
  assert.equal(prima.luci.memoria.stato, "a-mano");
  const dopo = casaFinta({ cartella });
  dopo.stati.set("sun.sun", {
    state: "below_horizon",
    attributes: { next_setting: new Date("2026-12-21T16:43:00").toISOString() },
  });
  await dopo.a(alle(2026, 12, 20, 21));
  assert.deepEqual(dopo.chiamate, []);
});

test("nei giorni non scelti non si accendono", async () => {
  /* Il 20 dicembre 2026 e' una domenica: solo il sabato. */
  const { chiamate, a } = casaFinta({ feste: { ...FESTE, giorni: [6] } });
  await a(alle(2026, 12, 20, 18));
  assert.deepEqual(chiamate, []);
  await a(alle(2026, 12, 26, 18));
  assert.equal(chiamate.length, 2);
});

test("con l'orario spento il ponte non tocca niente, nemmeno nelle feste", async () => {
  for (const [quando, tramonto] of [
    [alle(2026, 12, 20, 18), "2026-12-20T16:42:00"],
    [alle(2026, 11, 28, 18), "2026-11-28T16:45:00"],
  ]) {
    const { chiamate, a } = casaFinta({ feste: { ...FESTE, automatico: false }, tramonto });
    assert.equal(await a(quando), null);
    assert.deepEqual(chiamate, [], new Date(quando).toString());
  }
  const senza = casaFinta({ feste: { ...FESTE, luci: [] } });
  assert.equal(await senza.a(alle(2026, 12, 20, 18)), null);
  assert.deepEqual(senza.chiamate, []);
});

test("l'albero montato prima delle feste si accende gia' all'orario", async () => {
  const { chiamate, a } = casaFinta({ tramonto: "2026-11-28T16:45:00" });
  await a(alle(2026, 11, 28, 16, 46));
  assert.deepEqual(servizi(chiamate), ["switch.turn_on", "light.turn_on"]);
  await a(alle(2026, 11, 28, 23, 31));
  assert.deepEqual(servizi(chiamate).slice(2), ["switch.turn_off", "light.turn_off"]);
});

test("una casa che non risponde si riprova dopo un po', senza perdere la sera", async () => {
  const finta = casaFinta();
  let rifiuta = true;
  const vera = finta.luci.casa.chiedi;
  finta.luci.casa.chiedi = async (comando) => {
    if (rifiuta) throw new Error("non raggiungibile");
    return vera(comando);
  };
  await finta.a(alle(2026, 12, 20, 16, 43));
  assert.deepEqual(finta.luci.memoria, {});
  rifiuta = false;
  await finta.a(alle(2026, 12, 20, 16, 43, 30));
  assert.equal(finta.chiamate.length, 0, "aspetta prima di riprovare");
  await finta.a(alle(2026, 12, 20, 16, 46));
  assert.equal(finta.chiamate.length, 2);
  assert.equal(finta.luci.memoria.stato, "acceso");
});
