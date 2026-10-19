/* La pappa degli animali: quando e' l'ora, il telefono lo sa.
 *
 * Dal campo: «confermo che e' stato dato da mangiare e mi avvisa quando sara'
 * da rifare». La pappa si segna dalla scheda nella plancia (`cd_animali`), e
 * il ponte la guarda a ogni battito: una notifica per ogni pappa segnata,
 * quando l'ora arriva, e di nuovo solo dopo la prossima. */
import { test } from "node:test";
import assert from "node:assert/strict";

import { EVENTI, Sentinella, categoriaDi } from "../src/sentinella.js";
import { doveApre } from "../src/notifiche.js";

const ORA = 60 * 60_000;
const segnata = Date.parse("2026-10-19T08:00:00Z");

function conLaPappa(pappa = new Date(segnata).toISOString()) {
  let ora = segnata;
  const dette = [];
  const sentinella = new Sentinella({ adesso: () => ora, quando: (e) => dette.push(e) });
  let animali = [{ id: "micio", nome: "Micio", specie: "gatto", pappa_ogni: "12", pappa }];
  sentinella.valori = () => ({ cd_animali: JSON.stringify(animali) });
  return {
    sentinella,
    dette,
    vai: (ms) => {
      ora = segnata + ms;
      sentinella.battito();
    },
    segna: (ms) => {
      animali = [{ ...animali[0], pappa: new Date(segnata + ms).toISOString() }];
    },
  };
}

test("«animali» e' un evento della casa, e il tocco apre la pagina degli Animali", () => {
  assert.ok(EVENTI.includes("animali"));
  assert.equal(categoriaDi("animali"), "casa");
  assert.deepEqual(doveApre({ tipo: "animali" }), { sezione: "animali" });
});

test("prima dell'ora tace; all'ora lo dice una volta sola", () => {
  const { dette, vai } = conLaPappa();
  vai(11 * ORA);
  assert.equal(dette.length, 0);
  vai(12 * ORA);
  vai(12 * ORA + 30_000);
  vai(14 * ORA);
  assert.equal(dette.length, 1);
  assert.equal(dette[0].tipo, "animali");
  assert.equal(dette[0].parole.it.titolo, "🍽️ È ora della pappa di Micio");
  assert.match(dette[0].parole.it.testo, /^L'ultima 12 h fa$/);
});

test("segnata la pappa dopo, alla sua ora lo ridice", () => {
  const { dette, vai, segna } = conLaPappa();
  vai(12 * ORA);
  segna(13 * ORA);
  vai(20 * ORA);
  assert.equal(dette.length, 1);
  vai(25 * ORA);
  assert.equal(dette.length, 2);
});

test("senza una pappa segnata, o senza ritmo, non dice niente", () => {
  const { dette, vai } = conLaPappa("");
  vai(48 * ORA);
  assert.equal(dette.length, 0);
});

test("«Ha mangiato» dalla notifica segna la pappa nella configurazione della plancia", async () => {
  const { mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { Configurazione, PROFILO_PRINCIPALE } = await import("../src/configurazione.js");
  const { Notifiche } = await import("../src/notifiche.js");
  const cartella = mkdtempSync(join(tmpdir(), "pappa-"));
  try {
    const adesso = segnata + 13 * ORA;
    const configurazione = new Configurazione({ cartella, adesso: () => adesso });
    configurazione.scrivi(PROFILO_PRINCIPALE, {
      cd_animali: JSON.stringify([
        {
          id: "micio",
          nome: "Micio",
          specie: "gatto",
          pappa_ogni: "12",
          pappa: new Date(segnata).toISOString(),
        },
      ]),
    });
    const notifiche = new Notifiche({ cartella, configurazione, adesso: () => adesso });
    assert.equal(notifiche._segnaLaPappa("micio"), true);
    const [micio] = JSON.parse(configurazione.leggi().snapshot.values.cd_animali);
    assert.equal(micio.pappa, new Date(adesso).toISOString());
    assert.equal(micio.pappa_ogni, "12");
    assert.equal(notifiche._segnaLaPappa("fido"), false);
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});
