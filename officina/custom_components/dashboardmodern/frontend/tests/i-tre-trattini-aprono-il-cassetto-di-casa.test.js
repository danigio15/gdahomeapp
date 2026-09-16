/* I tre trattini aprono il cassetto di Home Assistant (#535).
 *
 * «Ho notato ora che da iPhone non ci sono problemi, invece da Google Chrome ho
 * il problema dei 3 trattini per tornare indietro che non vanno.»
 *
 * Il guscio guardava `window.parent === window` e concludeva «non siamo dentro
 * Home Assistant, apri il menu della plancia». Era vero quando la plancia
 * stava dentro un iframe; da quando il pannello è un ELEMENTO di questo stesso
 * documento non lo è più — dentro Home Assistant quel confronto è vero uguale,
 * e l'hamburger apriva il menu sbagliato su qualunque browser.
 *
 * Da telefono non si vedeva perché lì comanda il chiosco, che l'hamburger se
 * lo prende prima con il suo gesto; da PC il chiosco è spento, e restava il
 * menu della plancia al posto del cassetto.
 *
 * `home-assistant` adesso si cerca dove può stare davvero: in questo documento
 * e, solo se un padre c'è, nel suo.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const gusci = ["legacy/dashboard-runtime-it.js", "legacy/dashboard-runtime-en.js"];
const leggi = (percorso) => readFileSync(new URL(`../${percorso}`, import.meta.url), "utf8");

test("il guscio cerca Home Assistant in questo documento, non solo nel padre", () => {
  for (const nome of gusci) {
    const sorgente = leggi(nome);
    const corpo = sorgente.slice(
      sorgente.indexOf("function documentoDiHomeAssistant"),
      sorgente.indexOf("function apriMenuLaterale"),
    );
    assert.ok(corpo, `${nome}: la funzione deve esistere`);
    /* Prima di tutto qui: e' il caso del pannello, che e' quasi sempre. */
    assert.match(
      corpo,
      /if \(document\.querySelector\('home-assistant'\)\) return document;/,
      nome,
    );
    /* Il padre si guarda solo se un padre c'e' davvero, e dietro un try:
     * un iframe di un altro dominio non si tocca. */
    assert.match(corpo, /if \(window\.parent === window\) return null;/, nome);
    assert.match(corpo, /catch\(err\) \{\s*return null;/, nome);
  }
});

test("dentro Home Assistant l'hamburger non apre più il menu della plancia", () => {
  for (const nome of gusci) {
    const sorgente = leggi(nome);
    const corpo = sorgente.slice(
      sorgente.indexOf("function apriMenuLaterale"),
      sorgente.indexOf("function cdOpenAppMenu"),
    );
    assert.ok(corpo, `${nome}: l'hamburger deve esistere`);
    /* La vecchia scorciatoia — «non ho un padre, quindi sono da solo» — non
     * deve tornare: e' quella che rompeva il tasto dentro il pannello. */
    assert.doesNotMatch(
      corpo,
      /if \(window\.parent === window\) \{ cdOpenAppMenu\(\); return; \}/,
      `${nome}: la scorciatoia sbagliata e' tornata`,
    );
    /* Si chiede dov'e' Home Assistant, e solo se non c'e' si apre il nostro. */
    assert.match(corpo, /const pDoc = documentoDiHomeAssistant\(\);/, nome);
    assert.match(corpo, /if \(!pDoc\) \{ cdOpenAppMenu\(\); return; \}/, nome);
    /* E il cassetto si chiama come lo chiama Home Assistant. */
    assert.match(corpo, /'hass-toggle-menu'/, nome);
    assert.match(corpo, /haElement\.dispatchEvent\(toggleEvent\);/, nome);
  }
});
