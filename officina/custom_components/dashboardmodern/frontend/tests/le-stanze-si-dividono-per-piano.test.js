/* «Rooms must be displayed in groups based on the selected floor, with the room
 * icon and name centered. Small icons should appear on the card to indicate the
 * status or count of lights (on/off), climate control, power outlets, alerts,
 * doors, windows, and temperature» (#17, parti 1 e 2).
 *
 * La pagina Stanze si apriva su UNA stanza, con la fila delle linguette in
 * cima. Con cinque stanze funziona; con venti — ed è il caso che teneva aperta
 * anche la #12, «via il limite di 8 stanze» — quella fila diventa uno
 * scorrimento orizzontale in cui si cerca il nome.
 *
 * Qui si tiene ferma la parte che si prova senza un documento: come si divide
 * l'elenco fra i piani, quando un titolo serve e quando ruba una riga, e quali
 * pastiglie merita una stanza dato quello che c'è dentro adesso.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  PASTIGLIE_DELLA_STANZA,
  acceseNelPiano,
  pastiglieDellaStanza,
  stanzePerPiano,
} from "../src/core/le-stanze-per-piano.js";

const leggi = (nome) => readFileSync(new URL(`../src/${nome}`, import.meta.url), "utf8");

const CASA = [
  { id: "room-cucina", name: "Cucina", floor: "Piano terra" },
  { id: "room-camera", name: "Camera", floor: "Primo piano" },
  { id: "room-bagno", name: "Bagno", floor: "Piano terra" },
  { id: "room-cantina", name: "Cantina", floor: "" },
];

/* ── i piani ────────────────────────────────────────────────────────────── */

test("le stanze si dividono per piano, nell'ordine dei piani della casa", () => {
  const gruppi = stanzePerPiano(CASA, { piani: ["Piano terra", "Primo piano"] });
  assert.deepEqual(
    gruppi.map((gruppo) => [gruppo.piano, gruppo.stanze.map((stanza) => stanza.id)]),
    [
      ["Piano terra", ["room-cucina", "room-bagno"]],
      ["Primo piano", ["room-camera"]],
      /* Le stanze a cui nessuno ha detto il piano per ultime: sono quelle da
       * sistemare, e stanno in fondo come le cose da sistemare. */
      ["", ["room-cantina"]],
    ],
  );
});

test("un piano che il registro non conosce va in fondo, ma prima di chi non ne ha", () => {
  const gruppi = stanzePerPiano(
    [
      { id: "a", floor: "Mansarda" },
      { id: "b", floor: "" },
      { id: "c", floor: "Piano terra" },
    ],
    { piani: ["Piano terra"] },
  );
  assert.deepEqual(
    gruppi.map((gruppo) => gruppo.piano),
    ["Piano terra", "Mansarda", ""],
  );
  /* E senza nessun ordine dichiarato restano come sono comparsi: inventare un
   * alfabeto li rimescolerebbe a ogni stanza nuova. */
  assert.deepEqual(
    stanzePerPiano([{ floor: "Zeta" }, { floor: "Alfa" }], {}).map((gruppo) => gruppo.piano),
    ["Zeta", "Alfa"],
  );
});

test("con un piano solo il titolo non si scrive, con più di uno si scrivono tutti", () => {
  /* Un titolo sopra tutte le stanze della casa dice quello che si sa già, e
   * ruba una riga a ogni schermata. */
  const uno = stanzePerPiano([{ id: "a", floor: "Piano terra" }, { id: "b", floor: "Piano terra" }]);
  assert.equal(uno.length, 1);
  assert.equal(uno[0].intitolare, false);
  /* E se nessuna ha un piano, idem: non si intitola il nulla. */
  assert.equal(stanzePerPiano([{ id: "a" }, { id: "b" }])[0].intitolare, false);

  /* Con più gruppi si intitolano TUTTI, anche quello senza piano: un gruppo
   * muto in fondo a un elenco diviso si legge come «queste stanno nel piano
   * qui sopra», che è il contrario di quello che dice. */
  const tanti = stanzePerPiano(CASA, {});
  assert.ok(tanti.length > 1);
  assert.ok(tanti.every((gruppo) => gruppo.intitolare === true));
  /* La parola per quello senza piano la mette chi disegna: qui non si
   * scrivono parole. */
  assert.equal(tanti.at(-1).piano, "");
  assert.match(leggi("sections/rooms-page-section.js"), /t\("Senza piano", "No floor"\)/);
});

test("quello che non è un elenco di stanze non diventa un piano", () => {
  assert.deepEqual(stanzePerPiano(null), []);
  /* Un buco nell'elenco non diventa una stanza senza nome: si toglie, e con
   * esso il gruppo che avrebbe tenuto solo lui. */
  assert.deepEqual(stanzePerPiano([null, undefined]), []);
});

/* ── le pastiglie ───────────────────────────────────────────────────────── */

test("escono solo le pastiglie che hanno qualcosa da dire", () => {
  const piene = pastiglieDellaStanza({
    luci: 3,
    prese: 2,
    clima: 0,
    finestre: 1,
    porte: 0,
    mute: 0,
    gradi: 21.4,
  });
  assert.deepEqual(
    piene.map((voce) => [voce.chiave, voce.conto || voce.valore]),
    [
      ["luci", 3],
      ["prese", 2],
      ["gradi", 21.4],
      ["finestre", 1],
    ],
  );
  /* Una stanza a riposo porta la sua temperatura e basta: «0 luci, 0 prese, 0
   * finestre» occupa mezza tessera per dire che non succede niente. */
  assert.deepEqual(
    pastiglieDellaStanza({ gradi: 19 }).map((voce) => voce.chiave),
    ["gradi"],
  );
  assert.deepEqual(pastiglieDellaStanza({}), []);
});

test("una stanza senza termometro non dice «0°»", () => {
  /* `Number(null)` fa zero, ed è la trappola: senza guardia, ogni stanza senza
   * sonda porterebbe una pastiglia che dice zero gradi — non una misura
   * mancante, una misura sbagliata. */
  for (const gradi of [null, undefined, "", "caldo", NaN])
    assert.deepEqual(pastiglieDellaStanza({ gradi }), [], `«${gradi}» non è una temperatura`);
  /* E lo zero vero si dice: fuori può fare zero gradi. */
  assert.equal(pastiglieDellaStanza({ gradi: 0 })[0].valore, 0);
  assert.equal(pastiglieDellaStanza({ gradi: -3.5 })[0].valore, -3.5);
});

test("l'ordine è quello con cui si guarda una stanza da fuori", () => {
  /* Prima cosa è rimasto acceso, poi com'è messa, in fondo quello che non va. */
  assert.deepEqual(
    PASTIGLIE_DELLA_STANZA.map((voce) => voce.chiave),
    ["luci", "prese", "gradi", "clima", "finestre", "porte", "mute"],
  );
});

test("quali pastiglie comandano, e quali portano dentro", () => {
  /* «Una pastiglia che a volte comanda e a volte no sarebbe peggio di due
   * disegni diversi»: ognuna ha una risposta sola, sempre la stessa. */
  const per = new Map(PASTIGLIE_DELLA_STANZA.map((voce) => [voce.chiave, voce.comanda]));
  assert.equal(per.get("luci"), "spegni");
  assert.equal(per.get("prese"), "spegni");
  /* I gradi non sono un interruttore, una finestra non si chiude da una
   * pastiglia, e un avviso si guarda — non si spegne. */
  for (const chiave of ["gradi", "clima", "finestre", "porte", "mute"])
    assert.equal(per.get(chiave), "entra", `«${chiave}» non deve comandare`);
  assert.equal(new Set(per.values()).size, 2, "non esiste una terza risposta");
});

/* ── il piano, in una riga ──────────────────────────────────────────────── */

test("il piano dice quante luci sono rimaste accese lassù", () => {
  const [terra, primo] = stanzePerPiano(CASA, { piani: ["Piano terra", "Primo piano"] });
  const conti = {
    "room-cucina": { luci: 3 },
    "room-bagno": { luci: 2 },
    "room-camera": { luci: 0 },
  };
  assert.equal(acceseNelPiano(terra, conti), 5);
  assert.equal(acceseNelPiano(primo, conti), 0);
  /* Una stanza che il conto non ce l'ha non fa saltare la somma. */
  assert.equal(acceseNelPiano(terra, {}), 0);
  assert.equal(acceseNelPiano(null, conti), 0);
});

/* ── la pagina ──────────────────────────────────────────────────────────── */

test("senza una stanza scelta la pagina è l'elenco, e da dentro si torna", () => {
  const sezione = leggi("sections/rooms-page-section.js");
  assert.match(sezione, /if \(!clean\(scelta\)\) return indiceMarkup\(pagine, states\);/);
  /* La stanza cancellata riporta all'elenco invece di far comparire la prima
   * della lista, che è quello che si faceva quando l'elenco non c'era. */
  assert.match(
    sezione,
    /if \(state\.room && !pagine\.some\(\(pagina\) => pagina\.id === state\.room\)\) state\.room = "";/,
  );
  assert.match(sezione, /data-dm-stanze-indice/);
  /* E la tessera si apre col dito e con la tastiera: ha `role="button"` e sta
   * nel giro dei tabulatori, quindi Invio deve fare quello che fa il dito. */
  assert.match(sezione, /data-dm-stanza-vai\],\.dm-stanze-tessera/);
});

test("l'impronta della pagina sente i conti, ma solo quando l'elenco si vede", () => {
  /* Una luce spenta in un'altra stanza non cambia il conto delle cose né le
   * luci della stanza aperta: senza i conti nell'impronta, la tessera di
   * quella stanza resterebbe col numero vecchio. */
  assert.match(
    leggi("sections/rooms-page-section.js"),
    /clean\(scelta\) \? "" : JSON\.stringify\(tuttiIConti\(pagine, states\)\)/,
  );
});
