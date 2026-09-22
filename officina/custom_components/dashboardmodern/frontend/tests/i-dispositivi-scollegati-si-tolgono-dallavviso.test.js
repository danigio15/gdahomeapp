/* La scheda «Scollegati», e il cestino che toglie dall'avviso per sempre.
 *
 * La tessera «Dispositivi non connessi» (#33) compare da sola quando qualcosa
 * smette di rispondere, e finché resta muta va benissimo così. Il guaio è
 * quando dice il vero su una cosa che non interessa — «fra i non connessi
 * finiscono dispositivi che funzionano» — perché allora l'avviso si impara a
 * ignorare, e un avviso che si ignora è peggio di nessun avviso.
 *
 * Ci sono due ragioni, e tutte e due sono vere: un'entità che non c'è più —
 * un'integrazione tolta, un'entità rinominata — resta `unavailable` per
 * sempre; e ci sono le cose spente apposta, la presa dell'albero di Natale a
 * gennaio. Perciò serve un elenco con un cestino accanto a ogni riga.
 *
 * La regola che queste prove tengono ferma è che l'elenco sia UNO: la scheda
 * e la tessera leggono la stessa funzione. Con due copie, il giorno che si
 * scostano, il cestino toglierebbe dalla scheda una cosa che la tessera
 * continua a dire — e sarebbe il difetto di partenza, peggiorato.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  iDispositiviScollegati,
  mettiDaParte,
  TESSERA_SCOLLEGATI,
} from "../src/core/i-dispositivi-scollegati.js";
import { escluseDellaTessera } from "../src/core/fuori-dai-widget.js";
import { famigliaDellaScheda } from "../src/core/alberatura-del-config.js";

const QUI = dirname(fileURLToPath(import.meta.url));
const sorgente = (...pezzi) => readFileSync(join(QUI, "..", ...pezzi), "utf8");

const ORA = Date.now();
const STATES = Object.freeze({
  "switch.presa_giardino": {
    state: "unavailable",
    last_changed: new Date(ORA - 3 * 3600e3).toISOString(),
    attributes: { friendly_name: "Presa giardino" },
  },
  "switch.albero_natale": {
    state: "unavailable",
    attributes: { friendly_name: "Albero di Natale" },
  },
  "switch.presa_cucina": { state: "on", attributes: { friendly_name: "Presa cucina" } },
  "sensor.appena_acceso": { state: "unknown", attributes: { friendly_name: "Appena acceso" } },
});
const CONFIGURATE = Object.freeze([
  "switch.presa_giardino",
  "switch.albero_natale",
  "switch.presa_cucina",
  "sensor.appena_acceso",
]);

const nomi = (righe) => righe.map((una) => una.entity);

test("l'elenco è chi non risponde adesso, e nient'altro", () => {
  const { adesso } = iDispositiviScollegati({ configurate: CONFIGURATE, states: STATES });
  assert.deepEqual(nomi(adesso), ["switch.albero_natale", "switch.presa_giardino"]);
  /* `unknown` non è un guasto: è un'entità che c'è e non ha ancora un valore,
   * ed è normalissima dopo un riavvio. Contarla vorrebbe dire una riga rossa
   * a ogni riavvio, cioè un avviso che si impara a ignorare. */
  assert.equal(adesso.some((una) => una.entity === "sensor.appena_acceso"), false);
});

test("il cestino toglie dall'elenco, e la riga passa fra quelle tolte", () => {
  const escluse = mettiDaParte([], "switch.albero_natale");
  const { adesso, messiDaParte } = iDispositiviScollegati({
    configurate: CONFIGURATE,
    states: STATES,
    escluse,
  });
  assert.deepEqual(nomi(adesso), ["switch.presa_giardino"]);
  assert.deepEqual(nomi(messiDaParte), ["switch.albero_natale"]);
});

test("la scelta vale per questa tessera e basta", () => {
  /* La stessa presa può stare configurata in Prese, e lì deve restare accesa:
   * si toglie dall'avviso, non da casa. */
  assert.deepEqual(mettiDaParte([], "switch.albero_natale"), [
    `${TESSERA_SCOLLEGATI}|switch.albero_natale`,
  ]);
  assert.equal(escluseDellaTessera(mettiDaParte([], "switch.x"), "prese").size, 0);
  assert.equal(escluseDellaTessera(mettiDaParte([], "switch.x"), TESSERA_SCOLLEGATI).size, 1);
});

test("la voce non ha la forma di un'entità, e non torna indietro dalla porta di servizio", () => {
  /* `entitaConfigurate` cammina dentro tutte le chiavi di configurazione e
   * raccoglie tutto quello che ha la forma di un identificativo. Se la scelta
   * si scrivesse nuda, la presa messa da parte tornerebbe «configurata» e
   * quindi di nuovo nell'elenco: un giro che si morde la coda. La tessera
   * davanti è quello che glielo impedisce. */
  const ENTITY_ID = /^[a-z_][a-z0-9_]*\.[a-z0-9_]+$/i;
  for (const voce of mettiDaParte([], "switch.albero_natale"))
    assert.equal(ENTITY_ID.test(voce), false, voce);
});

test("non si toglie due volte la stessa cosa", () => {
  const una = mettiDaParte([], "switch.albero_natale");
  assert.deepEqual(mettiDaParte(una, "switch.albero_natale"), una);
});

test("fra le tolte si distingue quella che in casa non c'è più", () => {
  /* Sono i due guai che finiscono nello stesso elenco: un dispositivo vero
   * che si è deciso di non sentire, e configurazione rimasta indietro. Il
   * secondo è da ripulire, e adesso si vede che lo è. */
  let escluse = mettiDaParte([], "switch.albero_natale");
  escluse = mettiDaParte(escluse, "sensor.integrazione_tolta");
  const { messiDaParte } = iDispositiviScollegati({
    configurate: CONFIGURATE,
    states: STATES,
    escluse,
  });
  assert.deepEqual(
    messiDaParte.map((una) => `${una.entity}:${una.cE}`),
    ["switch.albero_natale:true", "sensor.integrazione_tolta:false"],
  );
});

test("una voce nuda non si spaccia per una tolta da qui", () => {
  /* Una voce senza tessera tiene l'entità fuori da TUTTE le tessere, e
   * l'ha scritta un altro interruttore. Dirla qui direbbe che l'ha messa da
   * parte chi non l'ha messa — anche se l'effetto sull'elenco è lo stesso. */
  const { adesso, messiDaParte } = iDispositiviScollegati({
    configurate: CONFIGURATE,
    states: STATES,
    escluse: ["switch.albero_natale"],
  });
  assert.deepEqual(nomi(adesso), ["switch.presa_giardino"]);
  assert.deepEqual(messiDaParte, []);
});

test("un magazzino vuoto o storto non fa cadere niente", () => {
  assert.deepEqual(iDispositiviScollegati(), { adesso: [], messiDaParte: [] });
  assert.deepEqual(iDispositiviScollegati({ configurate: null, states: null, escluse: null }), {
    adesso: [],
    messiDaParte: [],
  });
});

test("la tessera della Home legge la stessa funzione, non una sua copia", () => {
  /* È la regola che tiene insieme le due facce. Se la tessera tornasse a
   * farsi il suo elenco, il cestino toglierebbe dalla scheda una cosa che lei
   * continua a dire. */
  const tessera = sorgente("src", "sections", "home-widgets-section.js");
  assert.match(tessera, /import \{ iDispositiviScollegati \} from "\.\.\/core\/i-dispositivi-scollegati\.js"/);
  assert.match(tessera, /const \{ adesso: mute \} = iDispositiviScollegati\(/);
  assert.equal(/chiNonRisponde\(/.test(tessera), false, "la tessera si è rifatta l'elenco");
});

test("nella scheda il cestino è l'unico comando", () => {
  const scheda = sorgente("src", "sections", "i-dispositivi-scollegati-section.js");
  /* Niente tasto verde in fondo: il cestino scrive subito, e un «Salva
   * sezione» farebbe credere che finché non lo si preme non sia successo
   * niente — mentre è già successo tutto. */
  assert.match(
    sorgente("src", "sections", "config-uniformity-section.js"),
    /const NO_SAVE_TABS = new Set\(\[[^\]]*"scollegati"/,
  );
  /* E niente interruttore dei widget accanto alle righe: scriverebbe nello
   * stesso posto del cestino, senza chiedere, e saprebbe anche rimettere
   * dentro quello che il cestino promette tolto per sempre. */
  assert.match(
    sorgente("src", "sections", "widget-entity-choice-section.js"),
    /row\.matches\("\.dm-scollegati-riga"\)/,
  );
  /* Non si torna indietro, quindi si chiede. */
  assert.match(scheda, /root\.confirm/);
  /* E non c'è un tasto per aggiungere: le righe le mette la plancia. */
  assert.equal(/ed-btn-add/.test(scheda), false);
});

test("la scheda sta con le macchine e la rete", () => {
  /* È lì che si va a vedere quando qualcosa non si raggiunge, ed è quasi
   * sempre la ragione vera: un ripetitore spento, un wifi che non arriva in
   * fondo al giardino. */
  assert.equal(famigliaDellaScheda("scollegati"), "macchine");
});
