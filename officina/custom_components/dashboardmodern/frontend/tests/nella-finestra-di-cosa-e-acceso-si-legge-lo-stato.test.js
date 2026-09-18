/* «Nei popup dei dispositivi accesi togli la riga sotto al nome: non voglio
 *  vedere il nome entità. E migliora graficamente gli stati on, così è brutto.»
 *
 * Sotto ogni nome c'era questo:
 *
 *     BINARY_SENSOR.FINESTRA_BAGNO_GRANDE_CONTACT · ON
 *
 * Due righe per non dire niente. La prima è il nome che quella cosa ha dentro
 * Home Assistant: serve a chi configura — e in configurazione infatti c'è — e
 * a chi guarda la casa non dice niente che non sappia già dal nome vero. La
 * seconda era lo stato grezzo, in maiuscolo: «ON» non è una parola italiana, e
 * sotto il nome di una finestra non è nemmeno la parola giusta.
 *
 * Adesso resta il nome, e accanto c'è com'è adesso, detto e in una pastiglia
 * del colore della cosa che si sta guardando: «Aperta», «Accesa», «In
 * riproduzione». Le parole sono quelle di `le-parole-di-home-assistant.js`, che
 * è il posto dove stanno tutte, e per le cose che si aprono quelle al
 * femminile — «aperta», non «acceso» — che è l'altra metà della stessa tabella.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const sorgente = () =>
  readFile(new URL("../src/sections/come-sta-la-casa-section.js", import.meta.url), "utf8");

test("l'identificatore dell'entità non si scrive più nella finestra", async () => {
  const fonte = await sorgente();
  /* La riga che c'era, e la classe che la vestiva: se tornano, torna anche il
   * «BINARY_SENSOR.…» sotto il nome. */
  assert.ok(!fonte.includes("dm-casa-id"), "la riga dell'entità è tornata");
  assert.ok(!/<div class="d-state">/.test(fonte), "la seconda riga sotto il nome è tornata");
  /* E il nome resta, che è l'unica cosa che distingue una finestra dall'altra. */
  assert.match(fonte, /<div class="d-name">\$\{esc\(nome\)\}<\/div>/);
});

test("com'è adesso si dice in parole, e le parole vengono da dove stanno tutte", async () => {
  const fonte = await sorgente();
  assert.match(fonte, /from "\.\/le-parole-di-home-assistant\.js"/);
  assert.match(fonte, /parolaDiStato\(grezzo\)/);
  /* Le cose che si aprono parlano al femminile e con le loro parole: un
   * contatto dice `on` quando è aperto. */
  assert.match(
    fonte,
    /const SI_APRONO = new Set\(\["varchi", "porte", "finestre", "tapparelle"\]\)/,
  );
  assert.match(fonte, /\{ on: "open", off: "closed" \}/);
  assert.match(fonte, /parolaDellaPorta\(comeSiApre\)/);
  /* La chiave della pastiglia arriva fino alla riga: senza, la finestra dei
   * varchi direbbe «acceso» come quella delle luci. */
  assert.match(fonte, /rigaDellElenco\(voce, states, chiave\)/);
});

test("lo stato è una pastiglia, e prende il colore di quello che si sta guardando", async () => {
  const fonte = await sorgente();
  assert.match(fonte, /class="dm-casa-stato" data-dm-muta="\$\{adesso\.muta\}"/);
  /* Il colore è quello della tessera che si è toccata — la finestra se lo mette
   * addosso quando si apre — e non un colore scritto qui dentro. */
  assert.match(fonte, /#dm-casa-popup \.dm-casa-stato\{[\s\S]*?var\(--dm-widget-accent/);
  assert.match(fonte, /border-radius:999px/);
  /* Chi non risponde resta grigio: è l'unico stato che non è una notizia sulla
   * casa, e non deve sembrarlo. */
  assert.match(fonte, /\.dm-casa-stato\[data-dm-muta="true"\]\{[\s\S]*?--text-dim/);
  /* Il giallo acceso di prima non c'è più. */
  assert.ok(!fonte.includes(".d-state b{font-weight:900;color:#f59e0b}"));
});
