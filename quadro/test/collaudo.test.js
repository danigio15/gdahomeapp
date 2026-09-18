/* Le prove delle regole: da una cartolina alle spunte, e a una parola.
 *
 * Quello che si prova davvero: che **«non lo so» non sia «va male»** — e' la
 * differenza fra un cruscotto utile e uno che mente, e una cartolina a pezzi
 * e' la cosa normale, non l'eccezione; che muta batta tutto, perche' di una
 * casa che non parla non si sa niente nemmeno di buono; e che un
 * aggiornamento solo non faccia suonare una spia, se no si smette di
 * guardarle.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  aggiornamentiPesano,
  collaudoChiuso,
  ilCollaudo,
  lePastiglie,
  loStato,
} from "../src/collaudo.js";

const ADESSO = Date.parse("2026-09-18T09:44:00Z");
const appena = (quanti = 3) => new Date(ADESSO - quanti * 60_000).toISOString();

const BUONA = {
  quando: appena(),
  ogni: 15,
  plance: { quante: 1, configurate: 1 },
  telefoni: { abbinati: 2, visti7gg: 2 },
  fuori: { acceso: true, filo: true },
  entita: { totali: 214, sparite: 0, impronte: [] },
  aggiornamenti: { quanti: 0, ha: false, gdahome: false, addon: 0, firmware: 0 },
  addon: { quanti: 3, accesi: 3, spentiCheDovrebbero: 0, elenco: [] },
  rete: { internet: true, schede: [], sorvegliate: { quante: 0, giu: 0 } },
  macchina: { scheda: "ODROID-N2+", cpu: 14, ram: 38, disco: 46, temperatura: 46, discoVita: 11 },
  backup: { giorniFa: 2 },
  batterie: { scariche: 0, piuBassa: 47 },
};

test("una cartolina a pezzi non e' una casa che va male", () => {
  /* Un Supervisor muto e Home Assistant giu': arriva quasi niente. E' il
   * giorno in cui l'installatore ha piu' bisogno di ricevere qualcosa. */
  const collaudo = ilCollaudo({ quando: appena(), ogni: 15, ponte: "1.4.32.15" });
  assert.equal(collaudo.aperte, 0, "niente e' «va male»");
  assert.equal(collaudo.fatte, 0, "e niente e' «a posto»");
  assert.equal(collaudo.ignote, collaudo.quante);
  /* E siccome nessuna spunta e' aperta, quella casa e' consegnabile: non resta
   * in fila per un dato che non e' suo. */
  assert.equal(collaudoChiuso({ quando: appena(), ogni: 15 }), true);
});

test("una casa a posto ha tutte le spunte fatte, e nessuna ignota", () => {
  const collaudo = ilCollaudo(BUONA);
  assert.equal(collaudo.fatte, collaudo.quante);
  assert.equal(collaudo.aperte, 0);
  assert.equal(collaudo.ignote, 0);
});

test("quello che va male si vede, e il resto resta a posto", () => {
  const collaudo = ilCollaudo({
    ...BUONA,
    addon: { quanti: 7, accesi: 5, spentiCheDovrebbero: 2, elenco: [] },
    macchina: { ...BUONA.macchina, temperatura: 79, disco: 93 },
  });
  assert.equal(collaudo.aperte, 2);
  assert.equal(collaudo.ignote, 0);
  assert.equal(collaudoChiuso({ ...BUONA, macchina: { ...BUONA.macchina, disco: 93 } }), false);
});

test("una macchina che dichiara solo il disco si giudica sul disco", () => {
  /* Senza System Monitor mancano CPU, memoria e temperatura: quello che resta
   * basta per un giudizio, e si da'. */
  const spunta = ilCollaudo({
    ...BUONA,
    macchina: { scheda: "ODROID-N2+", disco: 93 },
  }).spunte.find((una) => una.cosa === "La macchina non soffre");
  assert.equal(spunta.fatta, false);
  /* E una che non dichiara nessun numero non si giudica per niente. */
  const muta = ilCollaudo({ ...BUONA, macchina: { scheda: "ODROID-N2+" } }).spunte.find(
    (una) => una.cosa === "La macchina non soffre",
  );
  assert.equal(muta.fatta, null);
});

test("muta batte tutto: di una casa che non parla non si sa niente di buono", () => {
  const vecchia = { ...BUONA, quando: new Date(ADESSO - 3 * 60 * 60 * 1000).toISOString() };
  const stato = loStato({ carta: vecchia, collaudataIl: ADESSO }, ADESSO);
  assert.equal(stato.chiave, "muta");
  assert.match(stato.perché, /è vecchio di altrettanto/);
});

test("il collaudo mai chiuso sta in una fila sua, non fra i guasti", () => {
  const stato = loStato(
    { carta: { ...BUONA, telefoni: { abbinati: 0, visti7gg: 0 } }, collaudataIl: null },
    ADESSO,
  );
  assert.equal(stato.chiave, "aperto");
});

test("un aggiornamento solo non suona; Home Assistant si", () => {
  assert.equal(aggiornamentiPesano({ quanti: 1, ha: false, gdahome: false }), false);
  assert.equal(aggiornamentiPesano({ quanti: 1, ha: true, gdahome: false }), true);
  assert.equal(aggiornamentiPesano({ quanti: 1, ha: false, gdahome: true }), true);
  assert.equal(aggiornamentiPesano({ quanti: 3, ha: false, gdahome: false }), true);

  /* Ma si vede lo stesso, come pastiglia: si smette di suonare, non di dirlo. */
  const pastiglie = lePastiglie({
    ...BUONA,
    aggiornamenti: { quanti: 1, ha: false, gdahome: false },
  });
  assert.ok(pastiglie.some((una) => /aggiornamento/.test(una.parola)));
  assert.equal(
    loStato(
      {
        carta: { ...BUONA, aggiornamenti: { quanti: 1, ha: false, gdahome: false } },
        collaudataIl: ADESSO,
      },
      ADESSO,
    ).chiave,
    "posto",
  );
});

test("la riga dei guai si ferma a tre, che un elenco di nove non si legge", () => {
  const messaMale = {
    ...BUONA,
    rete: { internet: false, schede: [], sorvegliate: { quante: 4, giu: 2 } },
    addon: { quanti: 7, accesi: 5, spentiCheDovrebbero: 2, elenco: [] },
    entita: { totali: 132, sparite: 1, impronte: [] },
    batterie: { scariche: 4, piuBassa: 6 },
    backup: { giorniFa: 88 },
    macchina: { ...BUONA.macchina, temperatura: 79, disco: 93, discoVita: 94 },
  };
  const stato = loStato({ carta: messaMale, collaudataIl: ADESSO }, ADESSO);
  assert.equal(stato.chiave, "guardare");
  assert.match(stato.perché, /e altre \d+ cose qui sotto/);
});

test("senza niente che non va, la pastiglia dice quello che c'e' invece di tacere", () => {
  const pastiglie = lePastiglie(BUONA);
  assert.equal(pastiglie.length, 1);
  assert.equal(pastiglie[0].come, "bene");
  assert.match(pastiglie[0].parola, /214 entità/);
});
