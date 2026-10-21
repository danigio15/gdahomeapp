/* La nuova pagina Auto: i conti dello storico e dell'obiettivo di carica.
 *
 * «Scusa non le puoi recuperare dallo storico?» Le ricariche di un mese
 * qualunque escono dalle statistiche orarie della wallbox; il sole si stima
 * ora per ora contro quello che la casa ha preso dalla rete. E la percentuale
 * si sceglie libera, ma solo fra i valori che l'entita' accetta.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  finestraDelloStorico,
  giorniDalleOre,
  kmAllaPercentuale,
  kmDeiGiorni,
  laPercentuale,
  leScorciatoie,
  meseAccanto,
  oreDiRicarica,
  percentualeConsentita,
  ricaricheDalleOre,
  totaliDelloStorico,
  unPasso,
} from "../src/core/la-nuova-auto.js";

const alle = (giorno, ora) => new Date(2026, 9, giorno, ora).getTime();
const riga = (giorno, ora, change) => ({ start: alle(giorno, ora), change });

test("il sole e' quello che la rete non ha dato", () => {
  const auto = [riga(18, 12, 3), riga(18, 13, 2)];
  const rete = [riga(18, 12, 1), riga(18, 13, 4)];
  const ore = oreDiRicarica(auto, rete, () => 0.2);
  assert.equal(ore.length, 2);
  assert.equal(ore[0].sole, 2);
  assert.equal(ore[0].rete, 1);
  assert.ok(Math.abs(ore[0].costo - 0.2) < 1e-9);
  /* Un'ora in cui la casa ha preso piu' di quanto ha caricato l'auto: niente sole. */
  assert.equal(ore[1].sole, 0);
  assert.ok(Math.abs(ore[1].costo - 0.4) < 1e-9);
});

test("senza la rete il sole non si inventa e si paga tutto", () => {
  const ore = oreDiRicarica([riga(18, 23, 5)], null, () => 0.1);
  assert.equal(ore[0].sole, null);
  assert.ok(Math.abs(ore[0].costo - 0.5) < 1e-9);
  const giorni = giorniDalleOre(ore, alle(18, 0), alle(19, 0));
  assert.equal(totaliDelloStorico(giorni, []).quotaSole, null);
});

test("senza la rete ma col sole e la casa, il sole e' l'eccedenza", () => {
  const auto = [riga(18, 12, 3), riga(18, 20, 4)];
  /* A mezzogiorno 4 kWh di sole, la casa 4 con l'auto dentro: 1 per il resto,
   * 3 per l'auto. La sera niente sole: tutto pagato. */
  const sole = [riga(18, 12, 4), riga(18, 20, 0)];
  const casa = [riga(18, 12, 4), riga(18, 20, 4.5)];
  const ore = oreDiRicarica(auto, [], () => 0.2, { sole, casa });
  assert.equal(ore[0].sole, 3);
  assert.equal(ore[0].costo, 0);
  assert.equal(ore[1].sole, 0);
  assert.ok(Math.abs(ore[1].costo - 0.8) < 1e-9);
  /* Col sole ma senza la casa non si inventa niente. */
  assert.equal(oreDiRicarica(auto, null, () => 0.2, { sole })[0].sole, null);
});

test("le ore di fila sono una ricarica, anche con un'ora ferma in mezzo", () => {
  const auto = [
    riga(15, 23, 7),
    riga(16, 0, 7),
    /* le 01 ferma */
    riga(16, 2, 4),
    /* una briciola il pomeriggio: non e' una ricarica */
    riga(16, 15, 0.04),
    riga(17, 13, 2.5),
  ];
  const ricariche = ricaricheDalleOre(oreDiRicarica(auto, [], () => null));
  assert.equal(ricariche.length, 2);
  /* La piu' recente per prima. */
  assert.equal(ricariche[0].inizio, alle(17, 13));
  assert.equal(ricariche[1].inizio, alle(15, 23));
  assert.equal(ricariche[1].fine, alle(16, 3));
  assert.equal(ricariche[1].kwh, 18);
});

test("i giorni della finestra ci sono tutti, anche vuoti", () => {
  const ore = oreDiRicarica([riga(18, 12, 3)], [riga(18, 12, 0)], () => 0.25);
  const giorni = giorniDalleOre(ore, alle(16, 0), alle(19, 0));
  assert.deepEqual(
    giorni.map((g) => g.kwh),
    [0, 0, 3],
  );
  const totali = totaliDelloStorico(giorni, ricaricheDalleOre(ore));
  assert.equal(totali.kwh, 3);
  assert.equal(totali.quotaSole, 1);
  assert.equal(totali.costo, 0);
  assert.equal(totali.ricariche, 1);
});

test("le finestre: sette giorni, un mese, un periodo", () => {
  const adesso = new Date(2026, 9, 20, 15, 30).getTime();
  const sette = finestraDelloStorico("7", { adesso });
  assert.equal(sette.inizio, new Date(2026, 9, 14).getTime());
  assert.equal(sette.fine, new Date(2026, 9, 21).getTime());
  /* Il mese in corso finisce stanotte, ma il grafico tiene i suoi 31 giorni. */
  const mese = finestraDelloStorico("mese", { adesso });
  assert.equal(mese.inizio, new Date(2026, 9, 1).getTime());
  assert.equal(mese.fine, new Date(2026, 9, 21).getTime());
  assert.equal(mese.giorni, 31);
  const settembre = finestraDelloStorico("mese", { adesso, mese: meseAccanto({ anno: 2026, mese: 9 }, -1) });
  assert.equal(settembre.fine, new Date(2026, 9, 1).getTime());
  assert.equal(settembre.giorni, 30);
  /* Scritto al contrario si gira; il futuro si taglia. */
  const periodo = finestraDelloStorico("periodo", { adesso, dal: "2026-10-25", al: "2026-10-05" });
  assert.equal(periodo.inizio, new Date(2026, 9, 5).getTime());
  assert.equal(periodo.fine, new Date(2026, 9, 21).getTime());
  /* Piu' di due mesi non si chiedono. */
  const lungo = finestraDelloStorico("periodo", { adesso, dal: "2026-01-01", al: "2026-10-01" });
  assert.equal(lungo.giorni, 62);
  assert.equal(lungo.tagliato, true);
  assert.deepEqual(meseAccanto({ anno: 2026, mese: 0 }, -1), { anno: 2025, mese: 11 });
});

test("i km del giorno dal contachilometri, senza il primo salto", () => {
  const giorni = kmDeiGiorni(
    [riga(18, 0, 18000), riga(19, 0, 42.5), riga(20, 0, 0)],
    alle(18, 0),
    alle(21, 0),
  );
  assert.deepEqual(
    giorni.map((g) => g.km),
    [0, 42.5, 0],
  );
});

test("la percentuale libera di un number, col suo passo", () => {
  const info = laPercentuale(
    { entity_id: "number.auto_limite", state: "80", attributes: { min: 50, max: 100, step: 5 } },
  );
  assert.equal(info.libera, true);
  assert.equal(percentualeConsentita(info, 83), 85);
  assert.equal(percentualeConsentita(info, 20), 50);
  assert.equal(unPasso(info, +1), 85);
  assert.equal(unPasso(info, -1), 75);
  assert.deepEqual(leScorciatoie(info), [70, 80, 90, 100]);
});

test("un select si sceglie solo fra le sue voci", () => {
  const info = laPercentuale({
    entity_id: "select.limite",
    state: "80",
    attributes: { options: ["60", "80", "100"] },
  });
  assert.equal(info.libera, false);
  assert.equal(percentualeConsentita(info, 87), 80);
  assert.equal(unPasso(info, +1), 100);
  assert.equal(unPasso(info, -1), 60);
  assert.deepEqual(leScorciatoie(info), [60, 80, 100]);
});

test("un sensore si legge e non si scrive", () => {
  const info = laPercentuale({ entity_id: "sensor.limite", state: "90", attributes: {} });
  assert.equal(info.scrivibile, false);
  assert.equal(laPercentuale(null), null);
});

test("i km all'obiettivo seguono l'autonomia di adesso", () => {
  assert.equal(kmAllaPercentuale(262, 68, 80), 308);
  assert.equal(kmAllaPercentuale(262, 0, 80), null);
});
