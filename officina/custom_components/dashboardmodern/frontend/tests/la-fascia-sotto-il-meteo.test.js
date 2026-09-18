/* La fascia sotto il meteo su una riga sola, e l'icona che non è nostra.
 *
 * Due cose viste nello stesso giro di segnalazioni, e qui stanno insieme
 * perché sono le due regole pure che ne sono uscite.
 *
 * ── La fascia ───────────────────────────────────────────────────────────────
 * «Deve essere su una riga, quindi da smartphone se non entra la devi rendere
 *  scorrevole o che scorre lei automaticamente.»
 *
 * Era andata a capo per la #400. Torna su una riga e si muove da sola, e il
 * movimento lo fa il foglio di stile: al foglio serve sapere quanta strada
 * c'è e quanto tempo metterci, e sono i due conti che si tengono fermi qui.
 * Il secondo è quello che conta: velocità costante, non durata costante — con
 * una durata fissa una fascia appena più larga striscerebbe e una molto più
 * larga sfreccerebbe.
 *
 * ── L'icona ─────────────────────────────────────────────────────────────────
 * «Nel menù a tendina dei dispositivi la lavastoviglie ha due icone, una non è
 *  nostra: devi eliminarla da dove la pesca.»
 *
 * Da dove: il guscio scrive l'opzione come `<option>${d.icon} ${d.name}</option>`,
 * quindi il suo testo porta dentro l'emoji, e quando il nome pulito non si
 * trova la tendina ricade su quel testo. Il ripiego resta, ma l'emoji si
 * stacca — e non si butta, perché è l'ultima cosa che dice che apparecchio sia.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  VELO_DELLA_FASCIA,
  durataDellaDeriva,
  laCorsaDelNastro,
  spazioDaPercorrere,
} from "../src/core/la-fascia-deriva.js";

test("una fascia che ci sta tutta non ha strada da fare", () => {
  assert.equal(spazioDaPercorrere({ scrollWidth: 300, clientWidth: 300 }), 0);
  assert.equal(spazioDaPercorrere({ scrollWidth: 280, clientWidth: 300 }), 0);
  /* Due pixel di tolleranza: gli scarti frazionari di uno schermo a densità
   * due non sono pastiglie nascoste, e una fascia non deve derivare di mezzo
   * pixel per colpa loro. */
  assert.equal(spazioDaPercorrere({ scrollWidth: 301.4, clientWidth: 300 }), 0);
  assert.equal(spazioDaPercorrere({}), 0);
});

test("quello che resta fuori è la strada da percorrere", () => {
  assert.equal(spazioDaPercorrere({ scrollWidth: 520, clientWidth: 358 }), 162);
});

test("la deriva va a velocità costante, non a durata costante", () => {
  /* È la differenza fra una cosa che si legge e una che no: il doppio di
   * strada vuole il doppio di tempo. */
  const corta = durataDellaDeriva(150);
  const lunga = durataDellaDeriva(300);
  assert.ok(corta > 0);
  assert.equal(Math.round((lunga / corta) * 10) / 10, 2);
});

test("niente strada, niente tempo: non c'è nessuna animazione da chiedere", () => {
  assert.equal(durataDellaDeriva(0), 0);
  assert.equal(durataDellaDeriva(-40), 0);
  assert.equal(durataDellaDeriva(undefined), 0);
});

test("un filo di troppo non fa una deriva lampo, e una fascia enorme non eterna", () => {
  /* I due estremi hanno un pavimento e un tetto: sotto, una pastiglia che
   * sbuca farebbe uno scatto; sopra, una fascia lunghissima non si muoverebbe
   * più in modo percepibile. */
  assert.ok(durataDellaDeriva(3) >= 4);
  assert.ok(durataDellaDeriva(100000) <= 40);
});

test("l'emoji del guscio si stacca dal nome, e resta come suggerimento", async () => {
  /* Il modulo della tendina tocca il documento all'import: la regola si prova
   * da sola, che è il motivo per cui è esportata. */
  const { nomeSenzaEmoji } = await import("../src/sections/report-tendina-dispositivi-section.js");
  assert.deepEqual(nomeSenzaEmoji("🍽️ Lavastoviglie"), {
    glifo: "🍽️",
    nome: "Lavastoviglie",
  });
  assert.deepEqual(nomeSenzaEmoji("🔌 Elettrodomestici"), {
    glifo: "🔌",
    nome: "Elettrodomestici",
  });
  /* Una famiglia e un mestiere: sequenze con giunzione e tono della pelle, che
   * un ritaglio ingenuo spezzerebbe a metà lasciando mezzo carattere nel nome. */
  assert.deepEqual(nomeSenzaEmoji("👨‍👩‍👧 Famiglia").nome, "Famiglia");
  assert.deepEqual(nomeSenzaEmoji("🧑🏽‍🔧 Tecnico").nome, "Tecnico");
});

test("un nome che comincia per cifra non è un'emoji e non si tocca", async () => {
  const { nomeSenzaEmoji } = await import("../src/sections/report-tendina-dispositivi-section.js");
  for (const nome of ["3 Camere", "Boiler", "Frigorifero A+++", "230V quadro"])
    assert.deepEqual(nomeSenzaEmoji(nome), { glifo: "", nome });
});

test("un'opzione fatta di sola emoji non resta senza nome", async () => {
  const { nomeSenzaEmoji } = await import("../src/sections/report-tendina-dispositivi-section.js");
  /* Togliendo tutto resterebbe una riga vuota, che è peggio dell'emoji: allora
   * l'emoji torna a fare da nome. */
  assert.equal(nomeSenzaEmoji("🍽️").nome, "🍽️");
  assert.equal(nomeSenzaEmoji("").nome, "");
});

/* La fascia ha un bordo interno, e il nastro comincia dentro di lui.
 *
 * `clientWidth` comprende l'imbottitura; il nastro no — parte dopo. Prendendo
 * quella misura così com'è, la strada risultava più corta di tutta
 * l'imbottitura: il nastro si fermava prima del proprio capo e l'ultima
 * pastiglia restava tagliata, cioè proprio quella che si stava aspettando, e
 * con il velo del bordo sopra a renderla ancora meno leggibile.
 */
test("l'imbottitura della fascia non è strada che il nastro può usare", () => {
  /* Sei pixel per parte, come li mette il foglio di stile. */
  const conImbottitura = spazioDaPercorrere({
    scrollWidth: 400,
    clientWidth: 300,
    imbottitura: 12,
  });
  assert.equal(conImbottitura, 112, "la strada cresce di quanto misura l'imbottitura");
  /* Senza dirla, resta il conto di prima: dodici pixel in meno, e la coda
   * dell'ultima pastiglia fuori dal bordo. */
  assert.equal(spazioDaPercorrere({ scrollWidth: 400, clientWidth: 300 }), 100);
});

test("una fascia che ci sta tutta non si muove, imbottitura o no", () => {
  /* 288 di spazio utile per 286 di pastiglie: dentro, e ferma. */
  assert.equal(spazioDaPercorrere({ scrollWidth: 286, clientWidth: 300, imbottitura: 12 }), 0);
  /* E l'imbottitura non può far muovere una fascia che ci sta: due pixel di
   * tolleranza restano quelli, misurati sullo spazio vero. */
  assert.equal(spazioDaPercorrere({ scrollWidth: 290, clientWidth: 300, imbottitura: 12 }), 0);
  assert.equal(spazioDaPercorrere({ scrollWidth: 291, clientWidth: 300, imbottitura: 12 }), 3);
});

test("un'imbottitura assurda non inventa strada", () => {
  /* Numeri che non sono numeri, o negativi, valgono zero: una misura sbagliata
   * non deve far partire un'animazione che nessuno ha chiesto. */
  assert.equal(spazioDaPercorrere({ scrollWidth: 100, clientWidth: 300, imbottitura: -50 }), 0);
  assert.equal(spazioDaPercorrere({ scrollWidth: 100, clientWidth: 300, imbottitura: "boh" }), 0);
});

test("la sezione dice davvero quanto misura l'imbottitura, o il conto resta teorico", () => {
  /* L'aritmetica qui sopra vale solo se chi ha il documento in mano passa la
   * misura: senza, `spazioDaPercorrere` userebbe lo zero di difetto e
   * tornerebbe esattamente il conto sbagliato di prima. */
  const sezione = readFileSync(
    new URL("../src/sections/come-sta-la-casa-section.js", import.meta.url),
    "utf8",
  );
  assert.match(sezione, /imbottitura: imbottituraDellaFascia\(riga\)/);
  assert.match(sezione, /function imbottituraDellaFascia\(riga\)/);
  assert.match(sezione, /paddingLeft/);
  assert.match(sezione, /paddingRight/);
});

/* «Sistema la fascia tagliata ai lati.»
 *
 * La fascia non era rotta: deriva, si ferma se le si mette un dito sopra, e
 * sfuma i due bordi solo quando c'è davvero qualcosa fuori. Tagliata lo era
 * però ai due capi della corsa, e per una ragione precisa: il nastro arrivava
 * a filo del bordo interno, e sul bordo interno la sfumatura è ancora piena.
 * La prima e l'ultima pastiglia — quelle che si stava aspettando — si
 * fermavano mezze sotto il velo, senza più strada per uscirne.
 */
test("la corsa del nastro sporge di un velo a ogni capo", () => {
  const fuori = spazioDaPercorrere({ scrollWidth: 520, clientWidth: 358 });
  assert.equal(fuori, 162);
  assert.equal(laCorsaDelNastro(fuori), 162 + 2 * VELO_DELLA_FASCIA);
});

test("ai due capi la pastiglia esce tutta da sotto la sfumatura", () => {
  /* Il conto che conta: alla fine dell'andata il nastro non si ferma a filo
   * del bordo, ma un velo più in là. Quello che avanza oltre lo spazio fuori è
   * esattamente il velo, per parte. */
  for (const fuori of [3, 40, 162, 900]) {
    const corsa = laCorsaDelNastro(fuori);
    const sporgenza = (corsa - fuori) / 2;
    assert.equal(sporgenza, VELO_DELLA_FASCIA, `con ${fuori} fuori`);
    assert.ok(sporgenza >= VELO_DELLA_FASCIA, "sotto il velo resterebbe tagliata");
  }
});

test("una fascia che ci sta tutta non sporge di niente", () => {
  /* Il velo si accende solo con la deriva: senza strada non c'è né sfumatura
   * né sporgenza, altrimenti una casa tranquilla con due voci avrebbe due
   * bordi sfumati che dicono «continua» su niente. */
  assert.equal(laCorsaDelNastro(0), 0);
  assert.equal(laCorsaDelNastro(-10), 0);
  assert.equal(laCorsaDelNastro(undefined), 0);
});

test("la durata si calcola sulla corsa vera, velo compreso", () => {
  /* Altrimenti la velocità non è più quella dichiarata: quarantaquattro pixel
   * percorsi nel tempo di zero sono uno strappo alla fine di ogni andata. */
  const fuori = 200;
  const corsa = laCorsaDelNastro(fuori);
  assert.ok(durataDellaDeriva(corsa) > durataDellaDeriva(fuori));
  assert.equal(durataDellaDeriva(corsa), durataDellaDeriva(fuori + 2 * VELO_DELLA_FASCIA));
});

test("il velo della sfumatura e quello della corsa sono lo stesso numero", () => {
  /* Scritto due volte — una nella sfumatura, una nella corsa — prima o poi uno
   * dei due cambierebbe da solo, e la pastiglia tornerebbe mezza sfumata senza
   * che nessuno avesse toccato la sfumatura. Quindi: un numero nel modulo, una
   * variabile nel foglio, e nel foglio nessuna misura scritta a mano. */
  const sezione = readFileSync(
    new URL("../src/sections/come-sta-la-casa-section.js", import.meta.url),
    "utf8",
  );
  /* Lo scrive la sezione, col numero del modulo. */
  assert.match(sezione, /setProperty\("--dm-casa-velo", `\$\{VELO_DELLA_FASCIA\}px`\)/);
  assert.match(sezione, /const strada = laCorsaDelNastro\(fuori\)/);
  assert.match(sezione, /durataDellaDeriva\(strada\)/);
  /* La sfumatura lo legge da lì, e la corsa anche. */
  const sfumatura = sezione.match(/mask-image:linear-gradient\(to right,[^;}]+/g) || [];
  assert.equal(sfumatura.length, 2, "la sfumatura e la sua copia -webkit-");
  for (const riga of sfumatura) {
    assert.match(riga, /var\(--dm-casa-velo/);
    /* Il ripiego della variabile è uno zero, e uno zero non è una misura:
     * togliendola, nella sfumatura non deve restare nessun numero. */
    const senzaVelo = riga.replaceAll("var(--dm-casa-velo,0px)", "VELO");
    assert.ok(!/\d+px/.test(senzaVelo), `misura scritta a mano nella sfumatura: ${riga}`);
  }
  assert.match(sezione, /from\{translate:var\(--dm-casa-velo,0px\)\}/);
  assert.match(
    sezione,
    /to\{translate:calc\(var\(--dm-casa-velo,0px\) - var\(--dm-casa-strada,0px\)\)\}/,
  );
  /* E quando non c'è deriva si toglie con gli altri: una variabile rimasta
   * sporcherebbe la prossima fascia che non deve muoversi. */
  assert.match(sezione, /removeProperty\("--dm-casa-velo"\)/);
});

test("senza animazioni il velo se lo guadagna lo scorrimento", () => {
  /* Chi ha chiesto meno movimento si trascina la fascia a mano, e a mano non
   * si può sporgere oltre il contenuto: lì il velo lo deve fare il nastro,
   * allargandosi di quanto la fascia sfuma. Senza, in quel caso le due
   * pastiglie dei capi restavano tagliate davvero. */
  const sezione = readFileSync(
    new URL("../src/sections/come-sta-la-casa-section.js", import.meta.url),
    "utf8",
  );
  const menoMovimento = sezione.slice(sezione.indexOf("@media (prefers-reduced-motion:reduce)"));
  assert.match(menoMovimento, /padding-inline:var\(--dm-casa-velo,0px\)/);
});
