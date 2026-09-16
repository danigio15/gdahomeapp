/* La segnalazione porta la forma dell'intestazione (#542).
 *
 * «In pratica nella plancia centrale nella barra in alto se avvio la Dashboard
 * funziona tutto, se invece passo ad altre plance e poi torno alla home
 * sparisce tutto tranne il meteo ed il pallino verde.» Manca il blocco a
 * sinistra: il tasto del menu e il nome della casa.
 *
 * Da qui non si riproduce — succede solo su WebKit, e WebKit in questo
 * ambiente non si installa — e chi l'ha segnalato la lettura dal vivo non
 * può darla: «non ho un Mac quindi niente Web Inspector, i bookmarklet su
 * Safari iOS non vengono eseguiti, l'estensione Comandi Rapidi risulta non
 * disponibile». Ha ragione, ed è un limite del telefono, non suo.
 *
 * Allora la misura se la porta la segnalazione, che si scrive con un dito. Tre
 * simboli distinguono i tre casi possibili: il blocco sparito dal documento,
 * nascosto da uno stile, o finito in un altro punto della pagina.
 *
 * E vale la regola di tutte le altre voci della diagnostica: nessuna entità,
 * nessun utente, nessun indirizzo.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const sezione = readFileSync(
  new URL("../src/sections/segnalazioni-section.js", import.meta.url),
  "utf8",
);
const backend = readFileSync(
  new URL("../../ticket_store.py", import.meta.url),
  "utf8",
);

const { DIAGNOSTIC_KEYS } = await import(
  `../src/sections/segnalazioni-section.js?fix=${Date.now()}`
);

test("«intestazione» è una voce della diagnostica, di qua e di là", () => {
  assert.ok(
    DIAGNOSTIC_KEYS.includes("intestazione"),
    "senza la chiave la finestra non la manda nemmeno",
  );
  /* Il backend ha la sua lista e butta via tutto il resto: le due devono
   * dire la stessa cosa, o la voce arriverebbe e verrebbe scartata. */
  assert.match(backend, /"intestazione",/);
});

test("la misura dice quanti sono, dove stanno e come si vestono", () => {
  const corpo = sezione.slice(
    sezione.indexOf("function formaDellaTestata"),
    sezione.indexOf("async function diagnostica"),
  );
  assert.ok(corpo, "la funzione deve esistere");
  /* I tre casi possibili, uno per simbolo. */
  assert.match(corpo, /`sinistra:\$\{sinistre\.length\}`/, "sparito");
  assert.match(corpo, /display:\$\{/, "nascosto da uno stile");
  assert.match(corpo, /`in:\$\{/, "finito in un altro punto");
  /* Sotto il tetto del backend, sempre. */
  assert.match(corpo, /\.slice\(0, 190\)/);
  /* E niente che non sia struttura: nessun testo della casa finisce qui. */
  assert.doesNotMatch(corpo, /textContent|innerText|entity|friendly_name/);
});

test("la voce si vede nel riquadro della diagnostica, col suo nome", () => {
  assert.match(sezione, /intestazione: t\("Intestazione", "Header"\)/);
  /* E la raccolta la chiede davvero: dichiararla e non raccoglierla sarebbe
   * una chiave che non arriva mai. */
  assert.match(sezione, /intestazione: formaDellaTestata\(\),/);
});

test("e due dei tre stati sbagliati la plancia se li ripara da sola", () => {
  const meteo = readFileSync(
    new URL("../src/sections/weather-in-masthead-section.js", import.meta.url),
    "utf8",
  );
  const corpo = meteo.slice(
    meteo.indexOf("function riparaIlBloccoASinistra"),
    meteo.indexOf("function ripara()"),
  );
  assert.ok(corpo, "la riparazione deve esistere");
  /* Nascosto da uno stile in linea: si toglie. */
  assert.match(corpo, /for \(const veste of \["display", "visibility"\]\)/);
  assert.match(corpo, /sinistra\.style\[veste\] = "";/);
  /* Finito fuori dall'intestazione: torna primo figlio. */
  assert.match(corpo, /if \(sinistra\.parentElement !== header\) \{\s*header\.prepend\(sinistra\);/);
  /* Sparito dal documento: NON si rifabbrica. Rifare markup del guscio
   * vorrebbe dire coprire una causa invece di trovarla — e la diagnostica
   * esiste apposta per trovarla. */
  assert.doesNotMatch(corpo, /createElement|innerHTML/);
  /* E la riparazione la chiama chi ripara gia' l'intestazione. */
  assert.match(meteo, /riparaIlBloccoASinistra\(header\);/);
});
