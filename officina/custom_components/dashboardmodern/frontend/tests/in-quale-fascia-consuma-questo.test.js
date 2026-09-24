/* In quale fascia consuma questo apparecchio (#111).
 *
 * «Mi aggiungi anche nel dispositivo le fasce per capire quanto quel
 * dispositivo assorbe di più e in quale fascia.»
 *
 * Queste prove tengono ferme le due cose che rendono il numero vero.
 *
 * La prima: i kilowattora che vengono dal sole NON stanno in nessuna fascia.
 * Una fascia è un prezzo, e il sole non ha prezzo a nessun'ora. Contandoli
 * uscirebbe un euro più alto di quello vero proprio accanto alla tessera
 * «Speso dalla rete», che il numero giusto ce l'ha.
 *
 * La seconda: la spartizione si fa ORA PER ORA, e non copiando la percentuale
 * del mese. È lo stesso guasto per cui la quota di sole della wallbox usciva
 * rovesciata — «49,4 dal fotovoltaico e 18,7 dalla rete» quando i numeri veri
 * erano 22,8 e 45,3 — e una macchina che carica di notte è proprio il caso in
 * cui una media di mese sbaglia di più.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { leFasceDelDispositivo } from "../src/core/le-fasce-del-dispositivo.js";
import { normalizzaLeFasce } from "../src/core/fasce-della-tariffa.js";

/* Tre fasce come in bolletta: F1 giorno feriale, F2 la sera, F3 la notte. */
const TRE = normalizzaLeFasce({
  quante: 3,
  voci: [
    { dalle: "08:00", prezzo: 0.3 },
    { dalle: "19:00", prezzo: 0.2 },
    { dalle: "23:00", prezzo: 0.1 },
  ],
});

/* Un secchiello orario, nella forma in cui arriva dal Recorder. */
const ora = (giorno, h, kwh) => ({ start: new Date(2026, 2, giorno, h).toISOString(), change: kwh });

test("senza fasce non c'è niente da dividere, e non si scrive niente", () => {
  const ore = { dispositivo: [ora(4, 23, 5)], casa: [ora(4, 23, 5)], rete: [ora(4, 23, 5)] };
  assert.equal(leFasceDelDispositivo(ore, { quante: 0 }), null);
  assert.equal(leFasceDelDispositivo(ore, {}), null);
  /* E senza consumi nemmeno: un apparecchio fermo non ha una fascia in cui
   * consuma di più. */
  assert.equal(leFasceDelDispositivo({ dispositivo: [] }, TRE), null);
});

test("ogni ora finisce nella sua fascia, e i kWh sono quelli suoi", () => {
  /* Mercoledì 4 marzo 2026: un'ora in ognuna delle tre. */
  const ore = {
    dispositivo: [ora(4, 10, 2), ora(4, 20, 3), ora(4, 23, 5)],
    /* Casa e rete uguali: in queste ore tutto viene dalla rete. */
    casa: [ora(4, 10, 10), ora(4, 20, 10), ora(4, 23, 10)],
    rete: [ora(4, 10, 10), ora(4, 20, 10), ora(4, 23, 10)],
  };
  const detto = leFasceDelDispositivo(ore, TRE, { prezzoUnico: 0.25 });
  assert.equal(detto.kwh, 10);
  assert.deepEqual(
    detto.fasce.map((f) => f.kwh),
    [2, 3, 5],
  );
  /* Tutto dalla rete: gli euro sono i kWh per il prezzo della loro fascia. */
  assert.equal(detto.rete, 10);
  assert.equal(detto.sole, 0);
  assert.ok(Math.abs(detto.euro - (2 * 0.3 + 3 * 0.2 + 5 * 0.1)) < 1e-9);
  /* E la fascia in cui pesa di più è quella coi kilowattora, non quella cara. */
  assert.equal(detto.punta.indice, 2);
  assert.equal(detto.tuttoSpartito, true);
});

test("i kilowattora che vengono dal sole non stanno in nessuna fascia", () => {
  /* Un'ora di pieno sole: la casa consuma 10 e dalla rete ne prende 2, cioè
   * l'80% arriva dal tetto. L'apparecchio in quell'ora ne prende 5. */
  const ore = {
    dispositivo: [ora(4, 12, 5)],
    casa: [ora(4, 12, 10)],
    rete: [ora(4, 12, 2)],
  };
  const detto = leFasceDelDispositivo(ore, TRE, { prezzoUnico: 0.25 });
  assert.equal(detto.kwh, 5, "i suoi kilowattora sono cinque, sole compreso");
  assert.ok(Math.abs(detto.rete - 1) < 1e-9, "dalla rete ne ha presi uno");
  assert.ok(Math.abs(detto.sole - 4) < 1e-9, "e quattro dal sole");
  /* L'euro sta SOLO su quello preso dalla rete: 1 kWh in F1 a 0,30. */
  assert.ok(Math.abs(detto.euro - 0.3) < 1e-9);
  /* Contandoli tutti sarebbero stati 1,50: cinque volte tanto. */
  assert.notEqual(Number(detto.euro.toFixed(2)), 1.5);
  /* La fascia però li conta tutti: la domanda era «in quale fascia assorbe»,
   * e assorbire dal sole è assorbire. */
  assert.equal(detto.fasce[0].kwh, 5);
  assert.ok(Math.abs(detto.fasce[0].rete - 1) < 1e-9);
  assert.ok(Math.abs(detto.fasce[0].sole - 4) < 1e-9);
});

test("la spartizione è ora per ora, non la media del mese", () => {
  /* Il caso della segnalazione, in piccolo: una macchina che carica di notte
   * in una casa che di giorno vive di sole.
   *
   * La casa nel mese: 100 kWh consumati, 40 dalla rete → il 60% dal sole.
   * La macchina però carica alle 2 di notte, quando di sole non ce n'è: la
   * sua quota di rete è 100%, non 40%. */
  const ore = {
    dispositivo: [ora(4, 2, 20)],
    casa: [ora(4, 2, 20), ora(4, 12, 80)],
    rete: [ora(4, 2, 20), ora(4, 12, 20)],
  };
  const detto = leFasceDelDispositivo(ore, TRE, { prezzoUnico: 0.25 });
  assert.equal(detto.rete, 20, "di notte il sole non c'è: tutto dalla rete");
  assert.equal(detto.sole, 0);
  /* Copiando la quota della casa (40/100 = 40%) sarebbero usciti 8 kWh dalla
   * rete invece di 20, cioè meno della metà. */
  assert.notEqual(detto.rete, 8);
  /* E le due di notte stanno in F3, la fascia che costa meno: 20 × 0,10. */
  assert.equal(detto.punta.indice, 2);
  assert.ok(Math.abs(detto.euro - 2) < 1e-9);
});

test("un'ora senza il consumo di casa non vota sulla spartizione, e si dice", () => {
  /* Il Recorder ha buttato l'ora della casa: quella spartizione non si sa.
   * `quotaDiRete` leggerebbe la casa mancante come «tutto dalla rete», che è
   * la risposta prudente quando il dato c'è ed è zero e un'invenzione quando
   * non c'è affatto. */
  const ore = {
    dispositivo: [ora(4, 2, 10), ora(4, 3, 10)],
    casa: [ora(4, 2, 10)],
    rete: [ora(4, 2, 10)],
  };
  const detto = leFasceDelDispositivo(ore, TRE, { prezzoUnico: 0.25 });
  /* I kilowattora ci sono tutti — l'ora in cui li ha presi si sa comunque. */
  assert.equal(detto.kwh, 20);
  assert.equal(detto.fasce[2].kwh, 20);
  /* Ma solo metà si è potuta dividere, e l'euro riguarda solo quella. */
  assert.equal(detto.rete, 10);
  assert.ok(Math.abs(detto.euro - 1) < 1e-9);
  assert.equal(detto.spartito.kwh, 10);
  assert.equal(detto.spartito.senza, 10);
  assert.equal(detto.tuttoSpartito, false, "e il blocco lo deve dichiarare");
});

test("il confronto con la tariffa unica sta sugli stessi kWh presi dalla rete", () => {
  const ore = {
    dispositivo: [ora(4, 23, 10)],
    casa: [ora(4, 23, 10)],
    rete: [ora(4, 23, 10)],
  };
  const detto = leFasceDelDispositivo(ore, TRE, { prezzoUnico: 0.25 });
  /* 10 kWh in F3 a 0,10 = 1,00 €. Con la tariffa unica sarebbero 2,50. */
  assert.ok(Math.abs(detto.euro - 1) < 1e-9);
  assert.ok(Math.abs(detto.unico.euro - 2.5) < 1e-9);
  assert.ok(Math.abs(detto.risparmio - 1.5) < 1e-9);
  /* Senza un prezzo unico non c'è confronto da fare, e non lo si inventa. */
  const senza = leFasceDelDispositivo(ore, TRE);
  assert.equal(senza.unico, null);
  assert.equal(senza.risparmio, null);
});

test("il profilo delle ventiquattro ore c'è sempre tutto, e in ordine", () => {
  const ore = {
    dispositivo: [ora(4, 2, 7), ora(5, 2, 3)],
    casa: [ora(4, 2, 10), ora(5, 2, 10)],
    rete: [ora(4, 2, 10), ora(5, 2, 5)],
  };
  const detto = leFasceDelDispositivo(ore, TRE);
  assert.equal(detto.ore.length, 24);
  assert.deepEqual(
    detto.ore.map((una) => una.ora),
    Array.from({ length: 24 }, (_, i) => i),
  );
  /* Le due di notte sommano i due giorni; le altre ore sono a zero e non
   * mancano: chi disegna non deve rimettere a posto i buchi. */
  assert.equal(detto.ore[2].kwh, 10);
  assert.ok(Math.abs(detto.ore[2].rete - (7 + 1.5)) < 1e-9);
  assert.equal(detto.ore[5].kwh, 0);
  /* E ogni colonna sa di che colore è: la fascia feriale di quell'ora. */
  assert.equal(detto.ore[2].fascia, 2);
  assert.equal(detto.ore[10].fascia, 0);
  assert.equal(detto.ore[20].fascia, 1);
});

test("una fascia senza prezzo suo ripiega sulla tariffa unica, e lo dichiara", () => {
  const zoppa = normalizzaLeFasce({
    quante: 2,
    voci: [{ dalle: "08:00", prezzo: 0.3 }, { dalle: "19:00" }],
  });
  const ore = {
    dispositivo: [ora(4, 20, 4)],
    casa: [ora(4, 20, 4)],
    rete: [ora(4, 20, 4)],
  };
  const detto = leFasceDelDispositivo(ore, zoppa, { prezzoUnico: 0.25 });
  assert.equal(detto.fasce[0].suo, true);
  assert.equal(detto.fasce[1].suo, false, "questa non ha un prezzo suo");
  assert.equal(detto.fasce[1].prezzo, 0.25);
  assert.ok(Math.abs(detto.euro - 1) < 1e-9);
});

/* «Il costo riportato in alto del dispositivo inerente al mese non si trova
 * con quello riportato sotto dalle fasce.»
 *
 * Dal campo, con lo scatto della wallbox: in alto 192,4 kWh e 34,69 €, sotto
 * 12,58 €. Nessuno dei due era un errore di somma — erano due conti diversi
 * detti con la stessa parola. In alto TUTTO il consumo al prezzo medio delle
 * fasce pesato sulle ore della settimana (0,1804 €/kWh in quella casa); sotto
 * solo i 111,9 kWh presi dalla rete, ai prezzi delle fasce vere, ora per ora.
 * Su una macchina che carica di notte la stima sbagliava del sessanta per
 * cento.
 *
 * La scheda adesso, quando la misura c'e', la usa. E per usarla le serve anche
 * il valore del sole alle ore in cui il sole e' entrato: e' il numero che
 * chiama «risparmiato grazie al FV», e senza quello i tre euro del mese
 * verrebbero da due fonti diverse — che e' esattamente il difetto di prima,
 * rifatto dentro una card sola.
 */
test("il sole vale il prezzo dell'ora in cui è entrato, non la media della settimana", () => {
  /* Mercoledì 4 marzo: due kilowattora di giorno, metà dal sole, e cinque di
   * notte tutti dalla rete. */
  const ore = {
    dispositivo: [ora(4, 10, 2), ora(4, 23, 5)],
    casa: [ora(4, 10, 10), ora(4, 23, 10)],
    /* Di giorno la casa prende dalla rete solo la metà: l'altra è sole. */
    rete: [ora(4, 10, 5), ora(4, 23, 10)],
  };
  const detto = leFasceDelDispositivo(ore, TRE, { prezzoUnico: 0.25 });
  /* Un kilowattora dal sole, ed è entrato in F1, che costa 0,30. */
  assert.ok(Math.abs(detto.sole - 1) < 1e-9);
  assert.ok(Math.abs(detto.valoreDelSole - 0.3) < 1e-9);
  /* E quello preso dalla rete costa il prezzo delle sue ore: uno in F1 e
   * cinque in F3. */
  assert.ok(Math.abs(detto.euro - (1 * 0.3 + 5 * 0.1)) < 1e-9);
  /* I due numeri sono la stessa storia divisa in due, e insieme fanno quello
   * che l'apparecchio sarebbe costato tutto dalla rete: è la riga in cima
   * alla scheda. */
  assert.ok(Math.abs(detto.valoreDelSole + detto.euro - (2 * 0.3 + 5 * 0.1)) < 1e-9);
});

test("senza sole il valore del sole è zero, e la card non cambia niente", () => {
  const ore = {
    dispositivo: [ora(4, 23, 5)],
    casa: [ora(4, 23, 10)],
    rete: [ora(4, 23, 10)],
  };
  const detto = leFasceDelDispositivo(ore, TRE, { prezzoUnico: 0.25 });
  assert.equal(detto.valoreDelSole, 0);
});
