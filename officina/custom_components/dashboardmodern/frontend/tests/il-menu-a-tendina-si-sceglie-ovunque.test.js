/* «La cosa che abbiamo modificato per azioni rapide, scene, aprendo popup:
 * sviluppa la stessa cosa ovunque. Cioe' dove nella sezione entita' viene
 * inserita una entita' select, fai aprire popup dove si sceglie la modalita' di
 * quel select.»
 *
 * Il popup c'era gia', ed era di uno solo: le azioni rapide. Dappertutto
 * altrove un menu a tendina era una riga morta — nelle stanze portava in Home
 * (e quella e' stata la prova accanto a questa), nelle sezioni proprie e fra
 * le entita' proprie non aveva nemmeno un tasto, perche' `select` non e' fra i
 * domini che si accendono e si spengono. Chi se l'era messo in pagina ci
 * trovava scritto com'era messo e nient'altro.
 *
 * Adesso sono quattro posti e una finestra sola. Le due cose che questa prova
 * tiene sono proprio quelle due:
 *
 *   - la DOMANDA — «questa entita' si sceglie?» — e' scritta una volta, in
 *     `core/comandi-accanto.js`, che dei generi e' il padrone. Tre copie della
 *     stessa riga diventano tre risposte diverse il giorno che nasce un
 *     dominio nuovo;
 *   - la FINESTRA e' una, e le altre tre sezioni la aprono invece di
 *     disegnarsene una loro. Due elenchi della stessa cosa, disegnati in due
 *     posti, dopo un po' dicono due cose diverse.
 *
 * E il divieto «si vede ma non si comanda» vale anche qui: un'entita' messa in
 * sola lettura si legge, non si sceglie.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { genereDelComando, siPuoScegliere } from "../src/core/comandi-accanto.js";
import { letturaDellaVoce } from "../src/core/sezioni-mie.js";
import { lettureDellaSezione } from "../src/core/entita-mie.js";

const leggi = (rel) => readFileSync(new URL(`../src/${rel}`, import.meta.url), "utf8");

/** I quattro posti in cui un menu a tendina si sceglie. */
const LA_FINESTRA = "sections/azioni-servizio-giusto-section.js";
const CHI_LA_APRE = Object.freeze([
  "sections/rooms-page-section.js",
  "sections/sezioni-mie-section.js",
  "sections/entita-mie-section.js",
]);

const STATI = {
  "select.ampli": { state: "CD", attributes: { friendly_name: "Ampli", options: ["CD", "Radio"] } },
  "input_select.modo": {
    state: "Casa",
    attributes: { friendly_name: "Modo", options: ["Casa", "Fuori"] },
  },
  "automation.sera": { state: "on", attributes: { friendly_name: "Sera" } },
  "switch.presa": { state: "on", attributes: { friendly_name: "Presa" } },
  "sensor.temp": { state: "21.4", attributes: { friendly_name: "Temp" } },
};

test("la domanda «si sceglie?» la fa il padrone dei generi", () => {
  assert.equal(siPuoScegliere("select.ampli"), true);
  assert.equal(siPuoScegliere("input_select.modo"), true);
  for (const altro of ["switch.presa", "automation.sera", "sensor.temp", "light.x", "", null])
    assert.equal(siPuoScegliere(altro), false, `${altro} non e' un menu a tendina`);
  /* E la risposta e' il genere, non un elenco suo di domini: se domani nasce
   * un terzo dominio a tendina, si aggiunge alla tabella e basta. */
  assert.equal(siPuoScegliere("select.ampli"), genereDelComando("select.ampli") === "tendina");
});

test("nessuno se la riscrive per conto suo", () => {
  for (const dove of CHI_LA_APRE) {
    const sorgente = leggi(dove);
    assert.doesNotMatch(
      sorgente,
      /"select"\s*\|\|[\s\S]{0,40}"input_select"/,
      `${dove}: si e' riscritto l'elenco dei domini a tendina`,
    );
  }
  /* I due modelli la chiedono di la' invece di guardarsi il dominio. */
  for (const dove of ["core/sezioni-mie.js", "core/entita-mie.js"]) {
    assert.match(leggi(dove), /siPuoScegliere/, `${dove}: non chiede piu' il genere`);
    assert.match(leggi(dove), /tendina: siPuoScegliere\(entity\)/, `${dove}: non lo dice alla riga`);
  }
});

test("i due modelli dicono quali righe hanno delle voci", () => {
  for (const [entita, atteso] of Object.entries({
    "select.ampli": true,
    "input_select.modo": true,
    "automation.sera": false,
    "switch.presa": false,
    "sensor.temp": false,
  })) {
    const mia = letturaDellaVoce({ id: "x", entity: entita }, STATI);
    assert.equal(mia.tendina, atteso, `sezioni mie: ${entita}`);
    const [sua] = lettureDellaSezione(
      [{ id: "y", entity: entita, sezione: "energy" }],
      "energy",
      STATI,
    );
    assert.equal(sua.tendina, atteso, `entita mie: ${entita}`);
  }
  /* E una tendina non si spaccia per comandabile: la levetta non ce l'ha, e
   * disegnarne una vorrebbe dire disegnare un interruttore che non inverte
   * niente. */
  assert.equal(letturaDellaVoce({ id: "x", entity: "select.ampli" }, STATI).comandabile, false);
});

test("la finestra e' una, e le altre tre la aprono", () => {
  assert.match(leggi(LA_FINESTRA), /export function apriIlMenu\(/);
  for (const dove of CHI_LA_APRE) {
    const sorgente = leggi(dove);
    assert.match(
      sorgente,
      /import \{ apriIlMenu \} from "\.\/azioni-servizio-giusto-section\.js";/,
      `${dove}: non apre la finestra di tutti`,
    );
    assert.match(sorgente, /apriIlMenu\(/, `${dove}: la importa e non la usa`);
    /* Nessuno si disegna un elenco suo: le righe delle voci hanno un nome
     * solo, e quel nome sta di la'. */
    assert.doesNotMatch(sorgente, /dm-qa-voce/, `${dove}: si e' disegnato un elenco suo`);
  }
});

test("nelle sezioni proprie il tasto c'e', e viene prima della levetta", () => {
  const sorgente = leggi("sections/sezioni-mie-section.js");
  /* La tendina si guarda PRIMA di `comandabile`: `select` non e' fra i domini
   * che si accendono, e chiedere prima quello la rimanderebbe nel vuoto. */
  const coda = sorgente.slice(sorgente.indexOf("function codaMarkup"));
  const doveTendina = coda.indexOf("riga.tendina");
  const doveComandabile = coda.indexOf("!riga.comandabile");
  assert.ok(doveTendina > -1, "la coda non guarda piu' se la riga ha delle voci");
  assert.ok(
    doveTendina < doveComandabile,
    "la tendina si guarda dopo «comandabile», e li' non arriva mai",
  );
  assert.match(coda, /data-dm-mia-scegli="\$\{esc\(riga\.entity\)\}"/);
  /* Il tocco e' suo: nella stessa casella c'e' anche la levetta. */
  assert.match(
    sorgente,
    /const scegli = event\.target\?\.closest\?\.\("\[data-dm-mia-scegli\]"\);[\s\S]{0,400}?apriIlMenu\(suo\);/,
  );
});

test("fra le entita' proprie idem, e con lo stesso ordine", () => {
  const sorgente = leggi("sections/entita-mie-section.js");
  const coda = sorgente.slice(sorgente.indexOf("function codaMarkup"));
  assert.ok(coda.indexOf("riga.tendina") < coda.indexOf("!riga.comandabile"));
  assert.match(coda, /data-dm-mie-scegli="\$\{esc\(riga\.entity\)\}"/);
  assert.match(
    sorgente,
    /const scegli = event\.target\?\.closest\?\.\("\[data-dm-mie-scegli\]"\);[\s\S]{0,400}?apriIlMenu\(suo\);/,
  );
});

test("«si vede ma non si comanda» vale anche per l'elenco", () => {
  /* Un'entita' messa in sola lettura non si sceglie, e non mostra nemmeno il
   * tasto: un tasto che al tocco non fa niente e' peggio di nessun tasto. */
  for (const dove of CHI_LA_APRE) {
    const sorgente = leggi(dove);
    assert.match(sorgente, /siComanda/, `${dove}: il divieto non si guarda piu'`);
  }
  assert.match(
    leggi("sections/sezioni-mie-section.js"),
    /riga\.tendina && siComanda\(riga\.entity\)/,
    "sezioni mie: il tasto compare anche su una riga bloccata",
  );
  assert.match(
    leggi("sections/entita-mie-section.js"),
    /riga\.tendina && siComanda\(riga\.entity\)/,
    "entita mie: il tasto compare anche su una riga bloccata",
  );
});

test("fra le entita' proprie il verbo della levetta non si scrive piu' a mano", () => {
  /* Per i sette domini che questa pagina comanda oggi la regola scritta a mano
   * e quella di `comandi-accanto` dicono la stessa cosa, dominio per dominio:
   * qui non cambia niente adesso. Cambia il giorno che l'elenco delle
   * comandabili si allunga — di la' il verbo c'e' gia', e qui bisognava
   * ricordarsi di venirlo a scrivere. */
  const sorgente = leggi("sections/entita-mie-section.js");
  assert.doesNotMatch(sorgente, /dominio === "scene" \|\| dominio === "script" \? "turn_on"/);
  assert.match(
    sorgente,
    /const comando = comandoCheAbilita\(\{ entity \}\) \|\|\s*\n?\s*comandoDelDispositivo\(\{ entity \}\) \|\| \{/,
  );
  assert.match(sorgente, /chiamaHa\(comando\.domain, comando\.service, comando\.data\);/);
  /* E quello che `comandi-accanto` non conosce resta roba che si inverte. */
  assert.match(sorgente, /service: "toggle",/);
});
