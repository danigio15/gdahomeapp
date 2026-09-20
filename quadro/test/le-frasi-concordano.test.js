/* Le frasi che cambiano col numero, e che col numero devono concordare.
 *
 * `plurale()` fa concordare **la parola che conta** — «1 impianto», «3
 * impianti» — e non la frase intorno. Il resto della riga resta scritto una
 * volta sola, e quasi sempre va bene; ma dove la frase parla di quella cosa —
 * «che li guardi», «i loro rapporti» — con uno solo diventa sgrammaticata, e
 * si legge come un guasto anche quando non lo e'.
 *
 * E' successo davvero: tolto l'unico installatore, la gestione diceva
 *
 *     1 impianto senza piu' nessuno che li guardi.
 *     Sono impianti di installatori che hai tolto: continuano a mandare le
 *     loro rapporti…
 *
 * Tre concordanze sbagliate in due righe — e un «le rapporti» che fa dubitare
 * di tutto il resto della pagina.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { iControlli } from "../src/controlli.js";

const QUI = dirname(fileURLToPath(import.meta.url));
const qua = (...pezzi) => readFileSync(join(QUI, "..", ...pezzi), "utf8");
const PAGINE = [
  ["console/index.html", qua("console", "index.html")],
  ["gestore/index.html", qua("gestore", "index.html")],
];

test("«rapporto» è maschile in tutte e due le pagine", () => {
  /* Il nome ha cambiato genere strada facendo, e in giro erano rimasti dei
   * femminili: «la rapporto», «le loro rapporti», «una rapporto». */
  for (const [quale, pagina] of PAGINE) {
    for (const storta of [
      /\bla rapporto\b/i,
      /\ble rapporti\b/i,
      /\ble loro rapporti\b/i,
      /\ble sue rapporti\b/i,
      /\buna rapporto\b/i,
      /\bquesta rapporto\b/i,
      /\brapporta\b/i,
    ]) {
      assert.ok(!storta.test(pagina), `«${quale}» ha ancora ${storta} — «rapporto» è maschile`);
    }
  }
});

test("l'avviso degli impianti rimasti soli concorda col loro numero", () => {
  /* Con uno solo la frase va al singolare tutta quanta, non solo il nome. */
  const pagina = qua("gestore", "index.html");
  assert.match(pagina, /ORFANE === 1 \? "lo guardi" : "li guardi"/);
  assert.match(pagina, /È rimasto indietro da quando/);
  assert.match(pagina, /Sono rimasti indietro da quando/);
  assert.match(pagina, /ORFANE === 1 \? "recupera" : "recuperano"/);
});

test("l'avviso non promette che un installatore riaggiunto si riprenda i suoi impianti", () => {
  /* Provato, e non succede: `Installatori.fai` da' una matricola nuova ogni
   * volta. La riga lo prometteva, e una pagina che promette una cosa che non
   * fa e' peggio di una che non dice niente — chi la legge aspetta un giorno
   * che non arriva.
   *
   * Adesso quella promessa non serve piu' nemmeno smentirla: da «elimina» non
   * nascono piu' impianti rimasti soli, perche' le case se ne vanno con lui.
   * Quelli che si vedono sono roba di prima, e la pagina dice quello. */
  const pagina = qua("gestore", "index.html");
  for (const bugia of [
    /tornano? a qualcuno il giorno che/,
    /si ritrova da assegnare/,
    /Riaggiungere quell'installatore/,
  ]) {
    assert.ok(!bugia.test(pagina), `la pagina promette di nuovo ${bugia}`);
  }
  assert.match(pagina, /Adesso non ne nascono più/);
});

test("il riavvio si chiama riavvio, non «il filo che cade»", () => {
  /* «Fa cadere il filo» diceva la cosa dal punto di vista del programma: il
   * collegamento si interrompe. Chi legge non sta guardando un collegamento,
   * sta decidendo se premere Installa adesso o stasera — e quello che gli
   * serve sapere e' che la casa **si riavvia**.
   *
   * L'app lo diceva gia' cosi' («riavvia la casa»): era il quadro l'unico a
   * parlare di fili, per la stessa cosa e nella stessa schermata. */
  for (const [quale, pagina] of PAGINE) {
    for (const storta of [/cadere il filo/i, /staccano il filo/i, /stacca il filo/i]) {
      assert.ok(!storta.test(pagina), `«${quale}» parla ancora di fili invece che di riavvio`);
    }
  }
  assert.match(qua("console", "index.html"), /riavvio necessario/);
});

/* ─── I controlli: il nome dice di cosa, non come va ─────────────────── */

/* Un rapporto in cui va tutto bene, e uno in cui va tutto male. Le stesse
 * dieci righe, gli stessi dieci nomi. */
const TUTTO_BENE = {
  quando: new Date().toISOString(),
  ogni: 1,
  plance: { quante: 1, configurate: 1 },
  telefoni: { abbinati: 2, visti7gg: 2 },
  fuori: { acceso: true, filo: true },
  entita: { totali: 214, giu: 0, dispositivi: 0, nomi: [] },
  aggiornamenti: { quanti: 0, ha: false, addon: 0, gdahome: false, firmware: 0 },
  addon: { quanti: 14, accesi: 14, spentiCheDovrebbero: 0, elenco: [] },
  rete: { internet: true, schede: [], sorvegliate: { quante: 2, giu: 0 } },
  macchina: { scheda: "ODROID-N2+", cpu: 14, ram: 38, disco: 12, temperatura: 37, discoVita: 11 },
  backup: { giorniFa: 1 },
  batterie: { scariche: 0, piuBassa: 91 },
};

const TUTTO_MALE = {
  ...TUTTO_BENE,
  plance: { quante: 1, configurate: 0 },
  telefoni: { abbinati: 0, visti7gg: 0 },
  fuori: { acceso: true, filo: false },
  entita: { totali: 214, giu: 31, dispositivi: 17, nomi: ["Termostato bagno"] },
  aggiornamenti: { quanti: 4, ha: true, addon: 3, gdahome: false, firmware: 0 },
  addon: { quanti: 14, accesi: 11, spentiCheDovrebbero: 3, elenco: [] },
  rete: { internet: false, schede: [], sorvegliate: { quante: 2, giu: 1 } },
  macchina: { scheda: "ODROID-N2+", cpu: 99, ram: 92, disco: 94, temperatura: 81, discoVita: 88 },
  backup: { giorniFa: 60 },
  batterie: { scariche: 2, piuBassa: 4 },
};

test("il nome di un controllo non cambia fra il verde e il rosso", () => {
  /* Il guasto era questo, e si vedeva solo quando la riga diventava rossa:
   *
   *     ✗ Sono collegati tutti          17 dispositivi non collegati
   *     ✗ Niente da aggiornare          4 aggiornamenti in attesa
   *     ✗ Nessuna batteria da cambiare  2 sotto soglia
   *
   * Un titolo solo per tre stati: raccontandone uno, e' sbagliato negli
   * altri due. */
  const bene = iControlli(TUTTO_BENE).controlli;
  const male = iControlli(TUTTO_MALE).controlli;
  const ignoti = iControlli({ quando: TUTTO_BENE.quando, ogni: 1 }).controlli;

  assert.deepEqual(
    male.map((uno) => uno.cosa),
    bene.map((uno) => uno.cosa),
  );
  assert.deepEqual(
    ignoti.map((uno) => uno.cosa),
    bene.map((uno) => uno.cosa),
  );

  /* E che i tre casi ci siano davvero: se no la prova passerebbe da sola. */
  assert.ok(bene.every((uno) => uno.va === true));
  assert.ok(male.every((uno) => uno.va === false));
  assert.ok(ignoti.every((uno) => uno.va === null));
});

test("il nome di un controllo e' un nome, non un giudizio", () => {
  /* La regola, scritta in cima a `controlli.js`: il nome dice **di cosa** si
   * parla, il numero a destra **come sta**, il bollino **se va bene**. Queste
   * sono le parole con cui un nome smette di essere un nome. */
  const GIUDIZI = [
    /\bnon\b/i,
    /\bnessun/i,
    /\bniente\b/i,
    /\btutt[oiae]\b/i,
    /\bsono\b/i,
    /\bc'è\b/i,
    /\bè\b/i,
    /\bgira/i,
    /\bregge\b/i,
    /\bfunziona\b/i,
    /\bsoffre\b/i,
    /\bcambiare\b/i,
    /\baggiornare\b/i,
  ];
  for (const uno of iControlli(TUTTO_MALE).controlli) {
    for (const giudizio of GIUDIZI) {
      assert.ok(!giudizio.test(uno.cosa), `«${uno.cosa}» giudica invece di nominare: ${giudizio}`);
    }
    assert.ok(
      uno.cosa.split(/\s+/).length <= 3,
      `«${uno.cosa}» e' una frase, non un nome: piu' di tre parole`,
    );
  }
});

test("la console disegna tre stati, non due", () => {
  /* `null` vuol dire «questa casa non lo dice», e per un pezzo la pagina lo
   * disegnava come le righe rotte: un guaio dove c'era solo silenzio. */
  const [, pagina] = PAGINE[0];
  assert.match(pagina, /ignoto/, "la console non ha piu' lo stato «non si sa»");
  assert.match(pagina, /bene: "✓", male: "✗", ignoto: "◇"/);
  assert.match(pagina, /bene: "a posto", male: "non va", ignoto: "non si sa"/);
});

test("del collaudo non e' rimasto niente sullo schermo", () => {
  /* Non l'aveva chiesto nessuno, e sullo schermo si vedeva: una casa appena
   * abbinata veniva archiviata come lavoro non finito perche' aveva due
   * batterie scariche, e ci restava finche' qualcuno non gliele cambiava.
   * Adesso sono dieci controlli, verdi o rossi, e chi guarda decide da se'. */
  const morte = [
    /collaud/i,
    /non è ancora stata consegnata/i,
    /spunt[ae] apert[ae]/i,
    /tutte spuntate/i,
    /resta in fila/i,
  ];
  for (const [quale, pagina] of PAGINE) {
    for (const parola of morte) {
      assert.ok(!parola.test(pagina), `«${quale}» dice ancora ${parola}`);
    }
  }
  /* `consegnata` come nome di variabile resta, e non c'entra: e' la chiave che
   * la scheda dell'add-on porge alla pagina. */
});

test("quello che una casa non manda non si scrive «undefined»", () => {
  /* Visto in un render, tutto insieme su una schermata sola:
   *
   *     DISCO  undefined GB liberi                      12%
   *     undefined · accesa da undefined giorni.
   *     Home Assistant Core           undefined  c'è la nuova
   *
   * I metri lo sapevano gia' fare — una CPU che non c'e' non si disegna a
   * zero — ma le righe di contorno no. */
  const [, pagina] = PAGINE[0];
  for (const guardia of [/cE\(m\.discoLiberi\)/, /cE\(m\.accesaDa\)/, /cE\(quale\)/]) {
    assert.match(pagina, guardia, `manca la guardia ${guardia}: torna «undefined» sullo schermo`);
  }
});

test("il conto degli aggiornamenti e l'elenco non si smentiscono", () => {
  /* Il riquadro diceva «Niente da fare: questa casa è aggiornata» ogni volta
   * che l'elenco era vuoto — anche con quattro aggiornamenti contati due dita
   * piu' su, fra i controlli. I ponti fino alla 1.5.8 mandano il conto e non
   * l'elenco, quindi capitava su ogni casa non ancora aggiornata. */
  const [, pagina] = PAGINE[0];
  assert.match(pagina, /non manda l'elenco/);
  assert.match(pagina, /const quanti = Number\(c\.aggiornamenti\.quanti\) \|\| 0;/);
});

/* ─── E le parole devono essere le stesse dei due schermi ─────────────────
 *
 * «Inoltre le scritte devono essere uguali, che cazzo significa si porta col
 * cacciavite?»
 *
 * Un firmware che non si installa da qui nel cruscotto si chiamava «si porta
 * col cacciavite» e nell'app «Questo si aggiorna dal suo apparecchio». Due
 * schermi, la stessa cosa, due vocabolari — e uno dei due bisogna pure
 * indovinarlo. Chi li guarda tutti e due non sta leggendo due programmi.
 *
 * Il cacciavite resta nei commenti, dove parliamo fra noi.
 */

test("un firmware che non si installa da qui si chiama come nell'app", () => {
  const laPagina = qua("console", "index.html");
  const senzaCommenti = laPagina.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(
    !/cacciavite/i.test(senzaCommenti),
    "nella pagina si legge ancora «cacciavite»: nell'app quella parola non c'è",
  );
  /* E si chiama con le parole che usa l'app (`app/lib/schermate/aggiornamenti.dart`). */
  assert.match(senzaCommenti, /si aggiorna dal suo apparecchio/);

  /* L'app, per confronto: se un giorno cambia li', questa prova lo dice. */
  const lApp = readFileSync(
    join(QUI, "..", "..", "app", "lib", "schermate", "aggiornamenti.dart"),
    "utf8",
  );
  assert.match(
    lApp,
    /si aggiorna dal suo apparecchio/,
    "l'app ha cambiato parole: cambiale anche nel cruscotto",
  );
});
