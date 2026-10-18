/* La luminosita' dello schermo del tablet a muro (#224).
 *
 * «Piena quando qualcuno si avvicina, bassa a riposo, quasi spenta di notte.»
 * Queste prove tengono ferme le scelte che il pannello non puo' sbagliare:
 * spenta di serie (chi aveva gia' il tablet non vede cambiare niente), il
 * sensore di «Si sveglia da solo» che resta dov'era e diventa la prima fonte,
 * la notte del sole da mezz'ora dopo il tramonto, e le fonti Premium che
 * senza Premium non contano. */
import assert from "node:assert/strict";
import test from "node:test";
import {
  LUCE_SPENTA,
  MURO_VUOTO,
  chiCeVicino,
  eNotteDellaLuce,
  giornataDellaLuce,
  livelloDellaLuce,
  luceDellaStanza,
  lucePulita,
  muroPulito,
  notteDalSole,
} from "../src/core/plancia-a-muro.js";

const ORA = (hh, mm = 0) => new Date(2026, 9, 18, hh, mm);
/* Il sole del 18 ottobre: tramonta alle 18:30, sorge alle 7:20. */
const sole = (dove, prossimoTramonto) => ({
  state: dove,
  attributes: { next_setting: prossimoTramonto.toISOString() },
});

test("la luminosita' nasce spenta, e un config di prima resta com'era", () => {
  assert.deepEqual(MURO_VUOTO.luce, LUCE_SPENTA);
  const prima = muroPulito({
    attiva: true,
    risveglio: { attivo: true, entita: "binary_sensor.presenza" },
    pagine: [{ id: "p1", modello: "stanza" }],
  });
  assert.equal(prima.luce.attiva, false);
  assert.deepEqual(prima.luce, { ...LUCE_SPENTA });
  /* «Si sveglia da solo» resta scritto dov'era: e' la prima fonte di «Chi
   * c'e' vicino», e i tablet con la plancia di prima lo leggono ancora. */
  assert.deepEqual(prima.risveglio, { attivo: true, entita: "binary_sensor.presenza" });
});

test("i livelli si puliscono: 0% di notte si', meno del 10% vicino no", () => {
  assert.deepEqual(
    lucePulita({
      attiva: true,
      vicino: 3,
      riposo: 140,
      notte: 0,
      dopo: 17,
      giorno: "luna",
      prossimita: "si",
    }),
    {
      attiva: true,
      vicino: 10,
      riposo: 100,
      notte: 0,
      dopo: 45,
      giorno: "sole",
      prossimita: false,
    },
  );
  assert.equal(lucePulita({ notte: "" }).notte, 3);
  assert.equal(lucePulita({ dopo: 120, giorno: "stanza" }).dopo, 120);
  assert.equal(lucePulita({ giorno: "stanza" }).giorno, "stanza");
});

test("col sole la notte va da mezz'ora dopo il tramonto all'alba", () => {
  const stasera = ORA(18, 30);
  const domani = new Date(stasera.getTime() + 24 * 3600 * 1000);
  assert.equal(notteDalSole(sole("above_horizon", stasera), ORA(15)), false);
  /* Tramontato da un quarto d'ora: ancora giorno per lo schermo. */
  assert.equal(notteDalSole(sole("below_horizon", domani), ORA(18, 45)), false);
  assert.equal(notteDalSole(sole("below_horizon", domani), ORA(19, 0)), true);
  /* Alle cinque del mattino il prossimo tramonto e' stasera: il tramonto di
   * ieri e' un giorno prima, e la notte continua. */
  assert.equal(notteDalSole(sole("below_horizon", stasera), ORA(5)), true);
  assert.equal(notteDalSole(null, ORA(5)), null);
  assert.equal(notteDalSole({ state: "below_horizon", attributes: {} }, ORA(5)), true);
});

test("giorno e notte: dal sole, dall'orario, dalla luce della stanza", () => {
  const muro = (giorno) =>
    muroPulito({
      notte: { attiva: false, da: "22:00", a: "06:00" },
      luce: { attiva: true, giorno },
    });
  const domani = new Date(ORA(18, 30).getTime() + 24 * 3600 * 1000);
  const buio = sole("below_horizon", domani);
  /* Col sole conta il sole; senza sole, l'orario anche con l'interruttore
   * di «Di notte schermo nero» spento. */
  assert.equal(eNotteDellaLuce(muro("sole"), { sole: buio, adesso: ORA(20) }), true);
  assert.equal(eNotteDellaLuce(muro("sole"), { adesso: ORA(20) }), false);
  assert.equal(eNotteDellaLuce(muro("sole"), { adesso: ORA(23) }), true);
  assert.equal(eNotteDellaLuce(muro("orario"), { sole: buio, adesso: ORA(20) }), false);
  assert.equal(eNotteDellaLuce(muro("orario"), { adesso: ORA(5, 59) }), true);
  /* La luce della stanza e' Premium e serve una lettura: senza, vale il sole. */
  const stanza = muro("stanza");
  assert.equal(eNotteDellaLuce(stanza, { stanza: "buio", premium: true, adesso: ORA(15) }), true);
  assert.equal(
    eNotteDellaLuce(stanza, { stanza: "chiaro", premium: true, sole: buio, adesso: ORA(20) }),
    false,
  );
  assert.equal(eNotteDellaLuce(stanza, { stanza: "buio", premium: false, adesso: ORA(15) }), false);
  assert.equal(eNotteDellaLuce(stanza, { sole: buio, premium: true, adesso: ORA(20) }), true);
});

test("chi c'e' vicino: basta una fonte, e le due dei sensori sono Premium", () => {
  const muro = muroPulito({
    risveglio: { attivo: true, entita: "binary_sensor.presenza" },
    luce: { attiva: true, prossimita: true, dopo: 30 },
  });
  const adesso = 1_000_000;
  assert.equal(chiCeVicino(muro, { presenza: true, premium: true, adesso }), "presenza");
  assert.equal(chiCeVicino(muro, { prossimita: true, premium: true, adesso }), "prossimita");
  assert.equal(chiCeVicino(muro, { presenza: true, prossimita: true, adesso }), "");
  /* Un tocco vale sempre, per il tempo di «Abbassa dopo». */
  assert.equal(chiCeVicino(muro, { toccato: adesso - 29_000, adesso }), "tocco");
  assert.equal(chiCeVicino(muro, { toccato: adesso - 31_000, adesso }), "");
  /* Il sensore spento in «Chi c'e' vicino» non conta. */
  const senza = muroPulito({ luce: { attiva: true } });
  assert.equal(chiCeVicino(senza, { presenza: true, prossimita: true, premium: true, adesso }), "");
});

test("il livello: vicino, a riposo di giorno, di notte; spenta resta al sistema", () => {
  const muro = muroPulito({ luce: { attiva: true, vicino: 90, riposo: 20, notte: 0 } });
  assert.equal(livelloDellaLuce(muro, { vicino: true, notte: true }), 90);
  assert.equal(livelloDellaLuce(muro, { vicino: false, notte: false }), 20);
  assert.equal(livelloDellaLuce(muro, { vicino: false, notte: true }), 0);
  assert.equal(livelloDellaLuce(muroPulito({}), { vicino: true }), null);
});

test("la luce della stanza in tre parole, come la dice l'app", () => {
  assert.equal(luceDellaStanza(2), "buio");
  assert.equal(luceDellaStanza(30), "penombra");
  assert.equal(luceDellaStanza(300), "chiaro");
  assert.equal(luceDellaStanza(9, "buio"), "buio");
  assert.equal(luceDellaStanza(60, "chiaro"), "chiaro");
  assert.equal(luceDellaStanza("niente", "penombra"), "penombra");
});

test("l'anteprima di una giornata: notte, riposo e qualcuno che passa", () => {
  const muro = muroPulito({ luce: { attiva: true, vicino: 90, riposo: 20, notte: 3 } });
  const punti = giornataDellaLuce(muro, (ora) => ora < 7 || ora >= 19, 48);
  assert.equal(punti.length, 49);
  const a = (ora) => punti.find(([quando]) => quando === ora)[1];
  assert.equal(a(3), 3);
  assert.equal(a(10), 20);
  assert.equal(a(13), 90);
  assert.equal(a(22), 3);
});
