/* La disposizione delle sezioni (#379), dopo la revisione indipendente.
 *
 * Quello che la revisione ha trovato e che si tiene fermo coi conti:
 *   - l'ordine di serie di un elenco gia' riordinato non si rilegge dalla
 *     pagina quando arriva una voce nuova (l'ordine dell'utente diventava «di
 *     serie», e un Salva uguale cancellava la sua scelta);
 *   - due dispositivi che salvano insieme non si cancellano a vicenda le
 *     pagine: `cd_disposizione` si fonde elenco per elenco;
 *   - la casella ha un tetto, e una chiave troppo lunga si accorcia invece di
 *     sparire in silenzio;
 *   - gli id fatti dai titoli sono uguali in ogni lingua.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  CHIAVE_DISPOSIZIONE,
  TETTO_ELENCHI,
  TETTO_VOCI,
  chiaveCorta,
  conLaScelta,
  disposizioneDelleVoci,
  disposizionePulita,
  eComeDiSerie,
  serieAggiornata,
} from "../src/core/disposizione.js";
import {
  CHIAVI_A_CASELLE,
  conLeModificheInSospeso,
  fondiLeCaselle,
} from "../src/sections/config-persistence-section.js";
import { registerCatalog, resetCatalogs, reverseLookup } from "../src/core/i18n.js";
import { sourceOf } from "../src/core/i18n-dom.js";

/* ── l'ordine di serie ─────────────────────────────────────────────────── */

test("una voce che arriva dopo si infila accanto a chi le sta prima nella pagina", () => {
  /* Di serie a, b, c; l'utente ha messo c, b, a. Arriva «d» dopo «b». */
  assert.deepEqual(serieAggiornata(["a", "b", "c"], ["c", "b", "d", "a"]), ["a", "b", "d", "c"]);
});

test("un riquadro aggiunto in fondo alla pagina va in fondo anche di serie", () => {
  assert.deepEqual(serieAggiornata(["a", "b", "c"], ["c", "b", "a", "d"]), ["a", "b", "c", "d"]);
  assert.deepEqual(serieAggiornata(["a", "b", "c"], ["c", "b", "a", "d", "e"]), ["a", "b", "c", "d", "e"]);
});

test("l'ordine dell'utente non diventa quello di serie", () => {
  const serie = serieAggiornata(["a", "b", "c"], ["c", "b", "a", "nuova"]);
  assert.deepEqual(serie, ["a", "b", "c", "nuova"]);
  /* E «Ripristina» (la scelta vuota) torna davvero di serie. */
  assert.deepEqual(
    disposizioneDelleVoci(serie, {}).map((d) => d.id),
    serie,
  );
});

test("una voce nuova in cima resta in cima, una che sparisce se ne va", () => {
  assert.deepEqual(serieAggiornata(["a", "b", "c"], ["prima", "c", "a"]), ["prima", "a", "c"]);
});

test("salvare la stessa fila dell'utente, con una voce arrivata dopo, non cancella la scelta", () => {
  const serie = serieAggiornata(["a", "b", "c"], ["c", "b", "a", "d"]);
  const scelta = { ordine: ["c", "b", "a", "d"], nascosti: [], misure: {} };
  assert.equal(eComeDiSerie(serie, scelta), false);
  const tutta = conLaScelta({}, "luci", scelta, serie);
  assert.deepEqual(tutta.luci.ordine, ["c", "b", "a", "d"]);
});

test("senza vecchia serie si prende la pagina com'e'", () => {
  assert.deepEqual(serieAggiornata(null, ["x", "y"]), ["x", "y"]);
  assert.deepEqual(serieAggiornata(["x", "x", "y"], ["y", "x", "y"]), ["x", "y"]);
});

/* ── due dispositivi ───────────────────────────────────────────────────── */

test("cd_disposizione si fonde elenco per elenco", () => {
  assert.ok(CHIAVI_A_CASELLE.includes(CHIAVE_DISPOSIZIONE));
  assert.ok(CHIAVI_A_CASELLE.includes("cd_entity_overrides"));
});

test("il telefono che salva l'Auto non cancella le Luci salvate dal PC", () => {
  const base = JSON.stringify({ meteo: { ordine: ["b", "a"], nascosti: [], misure: {} } });
  const dalPc = JSON.stringify({
    meteo: { ordine: ["b", "a"], nascosti: [], misure: {} },
    luci: { ordine: ["cucina", "sala"], nascosti: ["bagno"], misure: {} },
  });
  const dalTelefono = JSON.stringify({
    meteo: { ordine: ["b", "a"], nascosti: [], misure: {} },
    "ev@dm-na": { ordine: [], nascosti: ["dettagli"], misure: {} },
  });
  const fusa = JSON.parse(fondiLeCaselle(dalPc, dalTelefono, base));
  assert.deepEqual(fusa.luci.nascosti, ["bagno"]);
  assert.deepEqual(fusa["ev@dm-na"].nascosti, ["dettagli"]);
  assert.deepEqual(fusa.meteo.ordine, ["b", "a"]);
});

test("le modifiche in sospeso di cd_disposizione passano dalla fusione", () => {
  const remoti = {
    cd_disposizione: JSON.stringify({ luci: { ordine: ["x", "y"], nascosti: [], misure: {} } }),
  };
  const locali = {
    cd_disposizione: JSON.stringify({ security: { ordine: ["b", "a"], nascosti: [], misure: {} } }),
  };
  const base = { cd_disposizione: JSON.stringify({}) };
  const uscita = conLeModificheInSospeso(remoti, locali, ["cd_disposizione"], base);
  const fusa = JSON.parse(uscita.cd_disposizione);
  assert.deepEqual(Object.keys(fusa).sort(), ["luci", "security"]);
});

test("una pagina rimessa di serie su un dispositivo resta di serie dopo la fusione", () => {
  const base = JSON.stringify({ luci: { ordine: ["y", "x"], nascosti: [], misure: {} } });
  const remoto = base;
  const locale = JSON.stringify({});
  const fusa = JSON.parse(fondiLeCaselle(remoto, locale, base));
  assert.equal(fusa.luci, undefined);
});

/* ── il tetto ──────────────────────────────────────────────────────────── */

test("la casella ha un tetto: si tengono le scelte piu' recenti", () => {
  const tanta = {};
  for (let i = 0; i < TETTO_ELENCHI + 40; i += 1) tanta[`pagina${i}`] = { ordine: ["a", "b"], nascosti: [], misure: {} };
  const pulita = disposizionePulita(tanta);
  assert.equal(Object.keys(pulita).length, TETTO_ELENCHI);
  assert.ok(pulita[`pagina${TETTO_ELENCHI + 39}`]);
  assert.equal(pulita.pagina0, undefined);
});

test("una scelta appena salvata va in fondo, e il tetto non la taglia", () => {
  const tanta = {};
  for (let i = 0; i < TETTO_ELENCHI; i += 1) tanta[`pagina${i}`] = { ordine: ["a", "b"], nascosti: [], misure: {} };
  const dopo = conLaScelta(tanta, "pagina0", { ordine: ["b", "a"], nascosti: [], misure: {} }, ["a", "b"]);
  const chiavi = Object.keys(dopo);
  assert.equal(chiavi.at(-1), "pagina0");
  const ancora = conLaScelta(dopo, "nuova", { ordine: ["b", "a"], nascosti: [], misure: {} }, ["a", "b"]);
  assert.equal(Object.keys(ancora).length, TETTO_ELENCHI);
  assert.ok(ancora.nuova);
  assert.ok(ancora.pagina0);
  assert.equal(ancora.pagina1, undefined);
});

test("le voci di una scelta hanno un tetto anche loro", () => {
  const ordine = Array.from({ length: TETTO_VOCI + 50 }, (_, i) => `v${i}`);
  const pulita = disposizionePulita({ luci: { ordine, nascosti: ordine, misure: {} } });
  assert.equal(pulita.luci.ordine.length, TETTO_VOCI);
  assert.equal(pulita.luci.nascosti.length, TETTO_VOCI);
});

test("una chiave troppo lunga si accorcia, sempre uguale, invece di sparire", () => {
  const lunga = `ev@dm-na:dettagli/${"elenco-dentro-una-carta-".repeat(12)}`;
  const corta = chiaveCorta(lunga);
  assert.ok(corta.length <= 160);
  assert.ok(corta.startsWith("ev@dm-na:dettagli/"));
  assert.equal(chiaveCorta(lunga), corta);
  assert.notEqual(chiaveCorta(`${lunga}x`), corta);
  const tutta = conLaScelta({}, corta, { ordine: ["b", "a"], nascosti: [], misure: {} }, ["a", "b"]);
  assert.ok(tutta[corta], "la scelta si salva");
  /* E quelle corte restano come sono, spazi a parte. */
  assert.equal(chiaveCorta("luci:sala"), "luci:sala");
  assert.equal(chiaveCorta('a b"c'), "a-b-c");
});

/* ── gli id nelle lingue ───────────────────────────────────────────────── */

test("un titolo scritto in un'altra lingua torna alla sua chiave inglese", () => {
  resetCatalogs();
  registerCatalog("de", { Temperature: "Temperatur", "Front door": "Haustür" });
  try {
    assert.equal(reverseLookup("Temperatur", "de"), "Temperature");
    assert.equal(sourceOf("Temperatur", "de"), "Temperature");
    assert.equal(sourceOf("Temperature", "en"), "Temperature");
    /* L'italiano passa dall'indice delle sorgenti. */
    assert.equal(sourceOf("Temperatura", "it"), "Temperature");
    /* Un nome scritto da chi usa la plancia e' lo stesso in ogni lingua. */
    assert.equal(sourceOf("Portone", "de"), sourceOf("Portone", "it"));
    assert.equal(sourceOf("Cancelletto dell'orto", "de"), "Cancelletto dell'orto");
    assert.equal(sourceOf("Cancelletto dell'orto", "it"), "Cancelletto dell'orto");
  } finally {
    resetCatalogs();
  }
});
