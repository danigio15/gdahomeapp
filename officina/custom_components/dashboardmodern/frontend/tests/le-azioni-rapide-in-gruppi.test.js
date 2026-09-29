/* Le azioni rapide, in gruppi (#139).
 *
 * «Utilizzando la plancia per tutto questo periodo ho notato la necessità di
 * poter avere una divisione delle azioni rapide in gruppi (tapparelle luci
 * clima…).»
 *
 * Qui si tiene fermo che il gruppo è una parola accanto all'azione e niente di
 * più: chi non ne scrive nessuna resta com'è, «Luci» e «luci» sono lo stesso
 * gruppo, i gruppi escono nell'ordine della loro prima azione, i tasti non si
 * spostano nel documento — si vedono in un altro ordine —, e un gruppo chiuso
 * è una cosa del telefono che l'ha chiuso, non della casa.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  LUNGHEZZA_DEL_GRUPPO,
  conIlGruppo,
  gruppiChiusi,
  gruppiDelleAzioni,
  gruppoDellAzione,
  inverti,
  nomiDeiGruppi,
} from "../src/core/gruppi-delle-azioni.js";

const { CHIAVE_GRUPPI_CHIUSI, contaDelGruppo } = await import(
  `../src/sections/azioni-rapide-gruppi-section.js?gruppi=${Date.now()}`
);

const sezione = readFileSync(
  new URL("../src/sections/azioni-rapide-gruppi-section.js", import.meta.url),
  "utf8",
);

const AZIONI = [
  { type: "scene", name: "Cena", entity: "scene.cena" },
  { type: "toggle", name: "Salotto", entity: "light.salotto", gruppo: "Luci" },
  { type: "script", name: "Su tutte", entity: "script.su", gruppo: "Tapparelle" },
  { type: "toggle", name: "Cucina", entity: "light.cucina", gruppo: " luci " },
  { type: "builtin", builtin: "clima", gruppo: "Clima" },
];

test("senza gruppi resta com'è: nessun titolo, e ogni tasto al suo posto", () => {
  const senza = gruppiDelleAzioni(AZIONI.map(({ gruppo, ...resto }) => resto));
  assert.deepEqual(senza.gruppi, []);
  assert.deepEqual(senza.ordine.tasti, [0, 1, 2, 3, 4]);
  assert.deepEqual(gruppiDelleAzioni([]).gruppi, []);
  assert.deepEqual(gruppiDelleAzioni(null).gruppi, []);
});

test("i gruppi escono nell'ordine della prima azione, e «luci» è «Luci»", () => {
  const accese = new Set(["light.salotto", "light.cucina"]);
  const { gruppi, senzaGruppo, ordine } = gruppiDelleAzioni(AZIONI, (azione) =>
    accese.has(azione.entity) ? true : null,
  );
  assert.deepEqual(
    gruppi.map((gruppo) => [gruppo.nome, gruppo.indici, gruppo.accese]),
    [
      ["Luci", [1, 3], 2],
      ["Tapparelle", [2], 0],
      ["Clima", [4], 0],
    ],
  );
  assert.deepEqual(senzaGruppo, [0]);
  /* A vista: prima la fila di oggi, poi ogni gruppo col titolo davanti. */
  assert.deepEqual(ordine.titoli, { luci: 1, tapparelle: 4, clima: 6 });
  assert.deepEqual(ordine.tasti, [0, 2, 5, 3, 7]);
  assert.deepEqual(nomiDeiGruppi(AZIONI), ["Luci", "Tapparelle", "Clima"]);
});

test("il gruppo si scrive e si toglie senza toccare il resto dell'azione", () => {
  const azione = { type: "toggle", name: "Salotto", entity: "light.salotto", confirm: "Sicuro?" };
  const con = conIlGruppo(azione, "  Luci   di  sopra ");
  assert.equal(con.gruppo, "Luci di sopra");
  assert.equal(con.confirm, "Sicuro?");
  assert.equal(azione.gruppo, undefined, "l'azione di prima non cambia");
  assert.equal("gruppo" in conIlGruppo(con, "   "), false);
  assert.equal(conIlGruppo(azione, "x".repeat(60)).gruppo.length, LUNGHEZZA_DEL_GRUPPO);
  assert.equal(gruppoDellAzione({ gruppo: 42 }), "42");
  assert.equal(gruppoDellAzione(null), "");
});

test("un gruppo chiuso è del telefono, e un gruppo sparito non chiude niente", () => {
  const { gruppi } = gruppiDelleAzioni(AZIONI);
  assert.deepEqual([...gruppiChiusi(["LUCI", "vecchio"], gruppi)], ["luci"]);
  assert.deepEqual(inverti([], "Luci"), ["luci"]);
  assert.deepEqual(inverti(["luci", "clima"], "Luci"), ["clima"]);
  assert.deepEqual(gruppiChiusi("rotto", gruppi).size, 0);
  assert.equal(CHIAVE_GRUPPI_CHIUSI, "dm_azioni_gruppi_chiusi");
  assert.match(sezione, /root\.localStorage\?\.setItem\?\.\(CHIAVE_GRUPPI_CHIUSI/);
  assert.doesNotMatch(sezione, /writeJsonIfChanged\(CHIAVE_GRUPPI_CHIUSI/);
});

test("il titolo dice quante sono accese, e da chiuso quante azioni ha dentro", () => {
  const gruppo = (accese, quante) => ({ accese, indici: Array.from({ length: quante }) });
  assert.equal(contaDelGruppo(gruppo(1, 4)), "1 accesa");
  assert.equal(contaDelGruppo(gruppo(3, 4)), "3 accese");
  assert.equal(contaDelGruppo(gruppo(0, 4)), "");
  assert.equal(contaDelGruppo(gruppo(0, 4), true), "4 azioni");
  assert.equal(contaDelGruppo(gruppo(0, 1), true), "1 azione");
  assert.equal(contaDelGruppo(gruppo(2, 3), true), "2 accese");
});

test("i tasti non si spostano: si vedono in un altro ordine", () => {
  /* Chi colora i tasti, chi ci disegna il simbolo e chi ci posa la copertina
   * li riconosce dalla posizione: spostarli nel documento li scambierebbe. */
  assert.match(
    sezione,
    /ordina\(tasto, String\(struttura\.ordine\.tasti\[indice\] \?\? indice\)\)/,
  );
  assert.doesNotMatch(sezione, /\.(append|prepend|before|after|insertBefore)\(tasto/);
  assert.match(sezione, /grid-column:1\/-1/);
  assert.match(sezione, /\[data-dm-qa-chiuso="true"\]\{display:none!important\}/);
  /* Il titolo ha un contrassegno suo, diverso da quello che dice di che gruppo
   * e' un tasto: con lo stesso, il titolo finiva scritto dentro il primo tasto
   * del gruppo, e un tocco su un tasto chiudeva il gruppo. */
  assert.match(sezione, /closest\?\.\("#qa-grid > \.dm-qa-gruppo\[data-dm-qa-titolo\]"\)/);
  assert.match(sezione, /titolo\.dataset\.dmQaTitolo = gruppo\.chiave;/);
  /* Il titolo si fa dopo i tasti finiti, col segno che il motore ha scelto. */
  assert.match(
    sezione,
    /wrapFunction\("buildQuickActions", "__dmGruppiAzioni", \(\) => root\.setTimeout\?\.\(ripassa, 0\)\)/,
  );
});

test("nel Config il gruppo si scrive accanto all'azione e si salva al cambio", () => {
  assert.match(sezione, /tieniIlBloccoNellaScheda\("__dmGruppiAzioniConfig", caselleDeiGruppi\)/);
  assert.match(sezione, /doc\.addEventListener\("change", onChange\)/);
  assert.match(sezione, /writeJsonIfChanged\("cd_quick_actions", azioni\)/);
  assert.match(sezione, /list="\$\{DATALIST_ID\}"/);
});
