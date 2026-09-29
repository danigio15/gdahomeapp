/* «Nelle stanze della home dove compare la lucina quando sono accese le luci,
 * si può spegnere tutto senza entrare nella stanza?» — il cliente di un
 * installatore, al primo minuto, arrivando da Fibaro.
 *
 * La card della stanza in Home porta in fondo i tasti di quello che si spegne —
 * la luce, la presa, il clima — e il tocco chiede prima di spegnere, come nella
 * pagina Stanze. Il resto della card porta dentro, come prima.
 *
 * Qui si tiene ferma la parte che si prova senza un documento: quanti ne
 * spegne ogni tasto, cosa dice la didascalia, e che la domanda e l'annulla
 * siano la stessa regola della pagina Stanze.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const { didascaliaDellaStanza, riassuntoDellaStanza, tastiDellaStanza } = await import(
  `../src/sections/stanze-in-plancia-section.js?spegni=${Date.now()}`
);

const sorgente = readFileSync(
  new URL("../src/sections/stanze-in-plancia-section.js", import.meta.url),
  "utf8",
);

const STANZA = Object.freeze({
  id: "room-soggiorno",
  name: "Soggiorno",
  blocchi: [
    {
      key: "luci",
      voci: [
        { entity: "light.piantana" },
        { entity: "light.faretti" },
        { entity: "light.lettura" },
        { entity: "light.rotta" },
      ],
    },
    { key: "prese", voci: [{ entity: "switch.presa_tv" }, { entity: "switch.presa_lampada" }] },
    { key: "clima", voci: [{ entity: "climate.soggiorno" }, { entity: "climate.veranda" }] },
    { key: "coperture", voci: [{ entity: "cover.soggiorno" }] },
    { key: "media", voci: [{ entity: "media_player.cassa" }] },
  ],
});

const STATI = Object.freeze({
  "light.piantana": { state: "on" },
  "light.faretti": { state: "on" },
  "light.lettura": { state: "off" },
  "light.rotta": { state: "unavailable" },
  "switch.presa_tv": { state: "on" },
  "switch.presa_lampada": { state: "off" },
  "climate.soggiorno": { state: "cool" },
  "climate.veranda": { state: "off" },
  "cover.soggiorno": { state: "open" },
  "media_player.cassa": { state: "playing" },
});

const tutto = (stato) => Object.fromEntries(Object.keys(STATI).map((entity) => [entity, { state: stato }]));

test("i tasti sono la luce, la presa e il clima, e contano quello che spengono", () => {
  /* Nell'ordine della pagina Stanze. La luce che non risponde non entra nel
   * conto: un comando non la raggiunge, e un tasto che dice «3» e ne spegne
   * due è una promessa non mantenuta. */
  assert.deepEqual(
    tastiDellaStanza(STANZA, STATI).map((tasto) => [tasto.chiave, tasto.quante]),
    [
      ["luci", 2],
      ["prese", 1],
      ["clima", 1],
    ],
  );
});

test("senza niente acceso non c'è nessun tasto", () => {
  assert.deepEqual(tastiDellaStanza(STANZA, tutto("off")), []);
});

test("quello che non ha un tasto si dice a parole, sotto i gradi", () => {
  const riassunto = riassuntoDellaStanza(STANZA, STATI);
  const tasti = tastiDellaStanza(STANZA, STATI);
  /* I nomi delle sezioni, gli stessi del menu: chi legge «Musica» sa già
   * dove andarla a cercare. */
  assert.equal(didascaliaDellaStanza(riassunto.perTipo, tasti), "Tapparelle · Musica");
  /* Una stanza spenta lo dice, invece di restare muta. */
  assert.equal(didascaliaDellaStanza([], []), "Tutto spento");
});

test("una luce col lucchetto non ha il tasto, ma resta nella didascalia", () => {
  /* Chi ha la casa può chiudere un'entità col lucchetto: da lì non si
   * comanda. La luce però resta accesa, e la card lo deve dire. */
  const prima = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (chiave) =>
      chiave === "cd_solo_lettura"
        ? JSON.stringify({ "light.piantana": true, "light.faretti": true })
        : null,
    setItem() {},
    removeItem() {},
  };
  try {
    const tasti = tastiDellaStanza(STANZA, STATI);
    assert.deepEqual(
      tasti.map((tasto) => tasto.chiave),
      ["prese", "clima"],
    );
    const riassunto = riassuntoDellaStanza(STANZA, STATI);
    assert.equal(didascaliaDellaStanza(riassunto.perTipo, tasti), "Luci · Tapparelle · Musica");
  } finally {
    globalThis.localStorage = prima;
  }
});

test("il tocco su un tasto chiede, e non porta dentro la stanza", () => {
  /* I tasti stanno prima della card che li contiene: senza uscire lì, ogni
   * tocco su un tasto porterebbe anche dentro la stanza. */
  const tocco = sorgente.slice(sorgente.indexOf("function onClick("));
  assert.ok(
    tocco.indexOf("evento.stopPropagation();") < tocco.indexOf("apriLaStanza("),
    "i tasti escono prima che la card porti dentro",
  );
  assert.match(tocco, /velo\.chiedi\(stanza, /);
  assert.match(tocco, /velo\.spegni\(stanza, /);
  assert.match(tocco, /velo\.rimetti\(\)/);
  /* E la domanda è quella della pagina Stanze, scritta una volta sola. */
  assert.match(sorgente, /const velo = spegnereDaFuori\(state, /);
});

test("con la domanda aperta, il tocco sulla card è un no, non un'entrata", () => {
  /* Il no non ha un tasto — la domanda se ne va da sola, come nella pagina
   * Stanze — ma chi ha toccato la lampadina per sbaglio e tocca la card si
   * aspetta che la domanda sparisca, non di finire dentro la stanza. */
  const tocco = sorgente.slice(sorgente.indexOf("function onClick("));
  const no = tocco.indexOf("velo.lascia();");
  assert.ok(no > 0, "il tocco sulla card chiude la domanda");
  assert.ok(no < tocco.indexOf("apriLaStanza("), "e lo fa prima di portare dentro");
  assert.match(tocco, /if \(vivo\(state\.chiesta\) && state\.chiesta\.stanza === stanza\) \{/);
});

test("la domanda e l'annulla stanno nella firma del blocco", () => {
  /* Nascono e muoiono senza che cambi nessuno stato della casa: senza di loro
   * nella firma, il tocco non si vedrebbe. */
  assert.match(
    sorgente,
    /\[state\.chiesta\?\.stanza, state\.chiesta\?\.chiave, state\.annulla\?\.stanza, state\.annulla\?\.chiave\]/,
  );
});

test("la card non è un tasto dentro cui ci sono tasti", () => {
  /* Un <button> dentro un <button> non esiste: la card è una tessera con
   * role="button", e Invio e spazio la aprono come il dito. */
  assert.match(sorgente, /<article class="dm-stanza-plancia" role="button" tabindex="0"/);
  assert.match(sorgente, /doc\.addEventListener\("keydown", onKey\);/);
});
