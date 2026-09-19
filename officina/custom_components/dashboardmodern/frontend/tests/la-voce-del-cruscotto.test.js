/* Il riquadro che mostra il cruscotto dentro Home Assistant.
 *
 * Sono prove sul **testo** del modulo, non sull'elemento acceso: qui non c'è
 * un browser, e `customElements` nemmeno. Guardano però le tre cose che, se
 * sbagliate, si scoprirebbero solo aprendo la voce in casa di un installatore:
 *
 *  1. che l'indirizzo del quadro non finisca dentro la pagina senza filtro;
 *  2. che il riquadro non erediti i permessi della pagina che lo contiene;
 *  3. che la via di scampo — aprirlo fuori — ci sia sempre, e non solo quando
 *     l'avviso non è ancora stato letto. È la riga che salva chi ha un browser
 *     dove la memoria di una pagina dentro un'altra non resta.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const sorgente = await readFile(new URL("../cruscotto.js", import.meta.url), "utf8");

test("il riquadro non eredita i permessi della pagina che lo contiene", () => {
  /* `allow` senza `clipboard-write` vorrebbe dire non poter copiare la chiave
   * dal cruscotto; con dentro altro vorrebbe dire dare al quadro cose che non
   * gli servono — microfono, posizione — solo perché sta dentro casa. */
  const allow = /allow="([^"]*)"/.exec(sorgente);
  assert.ok(allow, "l'iframe non dichiara cosa permette");
  assert.deepEqual(allow[1].split(";").map((p) => p.trim()).filter(Boolean), ["clipboard-write"]);
  assert.match(sorgente, /referrerpolicy="no-referrer"/);
});

test("il collegamento esterno non si apre nella stessa scheda, e non passa il referrer", () => {
  assert.match(sorgente, /target="_blank"/);
  assert.match(sorgente, /rel="noopener noreferrer"/);
});

test("la via di scampo è sempre in vista, non solo prima di leggere l'avviso", () => {
  /* Il pezzo di HTML dell'avviso è quello che sparisce una volta letto: se il
   * collegamento stesse lì dentro, chi ha premuto «Ho capito» su un browser
   * che non tiene la memoria resterebbe senza modo di uscire. */
  const dopoAvviso = sorgente.slice(sorgente.indexOf('<div class="tutto">'));
  assert.match(dopoAvviso, /Aprilo fuori da qui/);
  const dentroAvviso = sorgente.slice(
    sorgente.indexOf("const avviso = this.letto"),
    sorgente.indexOf('<div class="tutto">'),
  );
  assert.doesNotMatch(dentroAvviso, /Aprilo fuori da qui/);
});

test("senza indirizzo non disegna un riquadro vuoto, lo dice", () => {
  assert.match(sorgente, /Non so a quale quadro mandarti/);
});

test("una memoria negata non fa cadere il riquadro", () => {
  /* Una finestra privata, o un browser con i dati dei siti bloccati: lì
   * `localStorage` non risponde, e un riquadro che si schianta è peggio di un
   * avviso che ricompare. */
  const quante = (sorgente.match(/catch \(_error\)/g) || []).length;
  assert.ok(quante >= 2, "le letture e le scritture della memoria vanno protette");
});

test("il nome dell'elemento porta la firma, come fa il pannello della plancia", () => {
  /* Due versioni dell'integrazione nella stessa pagina non si contendono un
   * nome che `customElements` registra una volta sola e poi è quello. */
  assert.match(sorgente, /dashboardmodern_static\\\/\(\[a-z0-9\]\+\)\\\//);
  assert.match(sorgente, /dashboardmodern-cruscotto-\$\{/);
});
