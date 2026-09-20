/* Le prove delle regole: da un rapporto ai dieci controlli, e a una parola.
 *
 * Quello che si prova davvero: che **«non lo so» non sia «va male»** — e' la
 * differenza fra un cruscotto utile e uno che mente, e un rapporto a pezzi
 * e' la cosa normale, non l'eccezione; che offline batta tutto, perche' di una
 * casa che non parla non si sa niente nemmeno di buono; e che un
 * aggiornamento solo non faccia suonare una spia, se no si smette di
 * guardarle.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { aggiornamentiPesano, iControlli, lePastiglie, loStato } from "../src/controlli.js";

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

test("un rapporto a pezzi non e' una casa che va male", () => {
  /* Un Supervisor muto e Home Assistant giu': arriva quasi niente. E' il
   * giorno in cui l'installatore ha piu' bisogno di ricevere qualcosa. */
  const c = iControlli({ quando: appena(), ogni: 15, ponte: "1.4.32.15" });
  assert.equal(c.male, 0, "niente e' «va male»");
  assert.equal(c.bene, 0, "e niente e' «a posto»");
  assert.equal(c.ignoti, c.quanti);
  /* E quella casa non finisce in nessuna fila per questo: niente e' rosso. */
  assert.equal(loStato({ carta: { quando: appena(), ogni: 15 } }, ADESSO).chiave, "posto");
});

test("una casa a posto ha tutti i controlli verdi, e nessuno ignoto", () => {
  const c = iControlli(BUONA);
  assert.equal(c.bene, c.quanti);
  assert.equal(c.male, 0);
  assert.equal(c.ignoti, 0);
});

test("quello che va male si vede, e il resto resta a posto", () => {
  const c = iControlli({
    ...BUONA,
    addon: { quanti: 7, accesi: 5, spentiCheDovrebbero: 2, elenco: [] },
    macchina: { ...BUONA.macchina, temperatura: 79, disco: 93 },
  });
  assert.equal(c.male, 2);
  assert.equal(c.ignoti, 0);
});

test("una macchina che dichiara solo il disco si giudica sul disco", () => {
  /* Senza System Monitor mancano CPU, memoria e temperatura: quello che resta
   * basta per un giudizio, e si da'. */
  const quello = iControlli({
    ...BUONA,
    macchina: { scheda: "ODROID-N2+", disco: 93 },
  }).controlli.find((uno) => uno.cosa === "La macchina");
  assert.equal(quello.va, false);
  /* E una che non dichiara nessun numero non si giudica per niente. */
  const zitta = iControlli({ ...BUONA, macchina: { scheda: "ODROID-N2+" } }).controlli.find(
    (uno) => uno.cosa === "La macchina",
  );
  assert.equal(zitta.va, null);
});

test("offline batte tutto: di una casa che non parla non si sa niente di buono", () => {
  const vecchia = { ...BUONA, quando: new Date(ADESSO - 3 * 60 * 60 * 1000).toISOString() };
  const stato = loStato({ carta: vecchia }, ADESSO);
  assert.equal(stato.chiave, "offline");
  assert.match(stato.perché, /risalgono ad allora/);
});

test("una casa appena montata non finisce in una fila a parte", () => {
  /* C'era un quarto stato, «collaudo aperto», e ci finiva ogni casa in cui un
   * controllo era rosso e nessuno aveva ancora dichiarato finito l'impianto:
   * una casa che funziona, archiviata come lavoro lasciato a meta'. Adesso le
   * file sono tre, e un telefono che manca e' semplicemente da guardare. */
  const stato = loStato({ carta: { ...BUONA, telefoni: { abbinati: 0, visti7gg: 0 } } }, ADESSO);
  assert.equal(stato.chiave, "guardare");
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
      { carta: { ...BUONA, aggiornamenti: { quanti: 1, ha: false, gdahome: false } } },
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
  const stato = loStato({ carta: messaMale }, ADESSO);
  assert.equal(stato.chiave, "guardare");
  assert.match(stato.perché, /e altre \d+ segnalazioni/);
});

test("senza niente che non va, la pastiglia dice quello che c'e' invece di tacere", () => {
  const pastiglie = lePastiglie(BUONA);
  assert.equal(pastiglie.length, 1);
  assert.equal(pastiglie[0].come, "bene");
  assert.match(pastiglie[0].parola, /214 entità/);
});
