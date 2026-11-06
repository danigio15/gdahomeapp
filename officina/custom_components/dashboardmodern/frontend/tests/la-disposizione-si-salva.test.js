/* La disposizione delle sezioni (`cd_disposizione`): i conti.
 *
 * «Devi farlo ovunque, anche per l'Auto, per il solare termico, ovunque, e
 * capisci poi come salvare realmente quella visuale.» Qui si tiene fermo come
 * una scelta salvata diventa l'ordine delle voci, anche quando la plancia
 * cambia versione e le voci nascono o spariscono, e come la scelta si scrive
 * e si toglie.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  CHIAVE_DISPOSIZIONE,
  conLaScelta,
  disposizioneDelleVoci,
  disposizionePulita,
  eComeDiSerie,
  entitaNelTesto,
  idDellaVoce,
  idUnici,
  ordineConLaScelta,
  sceltaPulita,
  paginaDellElenco,
  pagineCambiate,
  senzaLaPagina,
  senzaLaScelta,
} from "../src/core/disposizione.js";
import { CONFIG_KEYS, CONFIG_KEYS_REVISION } from "../src/core/chiavi-di-configurazione.js";

test("la casella viaggia col ponte, e la revisione lo dice", () => {
  assert.ok(CONFIG_KEYS.includes(CHIAVE_DISPOSIZIONE));
  assert.ok(CONFIG_KEYS_REVISION >= 76);
});

test("senza scelta l'ordine e' quello di serie", () => {
  assert.deepEqual(ordineConLaScelta(["a", "b", "c"], null), ["a", "b", "c"]);
  assert.ok(eComeDiSerie(["a", "b", "c"], {}));
});

test("la scelta mette le voci nel suo ordine", () => {
  assert.deepEqual(ordineConLaScelta(["a", "b", "c"], { ordine: ["c", "a", "b"] }), [
    "c",
    "a",
    "b",
  ]);
});

test("una voce nuova va vicino a quelle con cui e' nata, non in fondo", () => {
  /* Di serie: a b N c — la scelta salvata non conosceva N. */
  assert.deepEqual(ordineConLaScelta(["a", "b", "N", "c"], { ordine: ["c", "b", "a"] }), [
    "c",
    "b",
    "N",
    "a",
  ]);
  /* Nuova in cima di serie: resta in cima. */
  assert.deepEqual(ordineConLaScelta(["N", "a", "b"], { ordine: ["b", "a"] }), ["N", "b", "a"]);
});

test("una voce sparita si ignora", () => {
  assert.deepEqual(ordineConLaScelta(["a", "c"], { ordine: ["c", "b", "a"] }), ["c", "a"]);
});

test("nascosti e larghi si leggono per ogni voce", () => {
  assert.deepEqual(
    disposizioneDelleVoci(["a", "b"], {
      ordine: ["b", "a"],
      nascosti: ["a"],
      misure: { b: "larga" },
    }),
    [
      { id: "b", nascosto: false, misura: "larga" },
      { id: "a", nascosto: true, misura: "normale" },
    ],
  );
});

test("la spazzatura non entra", () => {
  assert.deepEqual(
    sceltaPulita({
      ordine: ["a", "a", "", null, "b c"],
      nascosti: "x",
      misure: { a: "gigante", b: "larga" },
    }),
    { ordine: ["a"], nascosti: [], misure: { b: "larga" } },
  );
  assert.deepEqual(disposizionePulita([1, 2]), {});
  assert.deepEqual(disposizionePulita({ ev: { ordine: [] } }), {});
});

test("una scelta uguale alla serie non si scrive (Ripristina)", () => {
  const tutta = { ev: { ordine: ["b", "a"] } };
  assert.deepEqual(conLaScelta(tutta, "ev", { ordine: ["a", "b"] }, ["a", "b"]), {});
  assert.deepEqual(senzaLaScelta({ ev: { ordine: ["b", "a"] }, boiler: { ordine: ["x"] } }, "ev"), {
    boiler: { ordine: ["x"], nascosti: [], misure: {} },
  });
});

test("scrivendo, le voci che ora mancano restano dove le aveva messe la scelta", () => {
  const prima = { ev: { ordine: ["c", "x", "b", "a"], nascosti: ["x"], misure: {} } };
  /* «x» adesso non c'e' (un riquadro che compare solo in carica). */
  const dopo = conLaScelta(prima, "ev", { ordine: ["a", "c", "b"] }, ["a", "b", "c"]);
  assert.deepEqual(dopo.ev.ordine, ["a", "c", "x", "b"]);
  assert.deepEqual(dopo.ev.nascosti, ["x"]);
});

test("Ripristina la pagina toglie i blocchi e gli elenchi dentro", () => {
  const tutta = {
    ev: { ordine: ["b"] },
    "ev:garage": { ordine: ["z"] },
    boiler: { ordine: ["q"] },
  };
  assert.deepEqual(Object.keys(senzaLaPagina(tutta, "ev")), ["boiler"]);
});

test("l'id di una voce: prima il dichiarato, poi l'id, poi l'entita'", () => {
  assert.equal(idDellaVoce({ dichiarato: "ev.ricarica", id: "x" }), "ev.ricarica");
  assert.equal(idDellaVoce({ id: "boiler-pressione" }), "#boiler-pressione");
  assert.equal(
    idDellaVoce({ attributi: "onclick=\"toggleEntity('light.cucina_led')\" class='lc'" }),
    "light.cucina_led",
  );
  assert.equal(idDellaVoce({ dati: ["Salone"], classi: "room-card active" }), "=salone");
  assert.equal(
    idDellaVoce({ titolo: "Ricarica di stanotte", classi: "dm-evv-card on" }),
    "dm-evv-card~ricarica-di-stanotte",
  );
  assert.equal(idDellaVoce({ classi: "active dm-tile" }), ".dm-tile");
  /* Un id generato a caso non e' un nome: non si usa. */
  assert.notEqual(
    idDellaVoce({ id: "a1b2c3d4e5f6a7b8", titolo: "Pressione" }),
    "#a1b2c3d4e5f6a7b8",
  );
});

test("un'entita' si riconosce solo se e' di un dominio vero", () => {
  assert.equal(entitaNelTesto("vai a window.location e poi light.salone"), "light.salone");
  assert.equal(entitaNelTesto("document.querySelector"), "");
});

test("gli id uguali si distinguono col numero", () => {
  assert.deepEqual(idUnici([".tile", ".tile", "a", ".tile"]), [".tile", ".tile·2", "a", ".tile·3"]);
});

/* Il Config elenca le pagine cambiate, ognuna col suo «Ripristina»: una
 * pagina e' tutte le chiavi che cominciano col suo nome, qualunque sia il
 * segno che le divide (un elenco dentro un blocco, una vista, un elenco
 * dentro una carta). */
test("le pagine cambiate si contano, e ripristinarne una toglie tutte le sue chiavi", () => {
  assert.equal(paginaDellElenco("ev"), "ev");
  assert.equal(paginaDellElenco("luci:zona-cucina"), "luci");
  assert.equal(paginaDellElenco("energy@oggi"), "energy");
  assert.equal(paginaDellElenco("security/telecamere"), "security");
  const tutta = {
    ev: { ordine: ["batteria", "auto"], nascosti: ["sessione"] },
    "luci:zona-cucina": { ordine: ["light.b", "light.a"] },
    luci: { nascosti: ["riepilogo", "zona-sala"] },
    "energy@oggi": { ordine: ["conti", "numeri"] },
    "security/telecamere": { ordine: ["camera.b", "camera.a"] },
    rotta: "niente",
  };
  assert.deepEqual(pagineCambiate(tutta), [
    { pagina: "ev", elenchi: 1, nascosti: 1 },
    { pagina: "luci", elenchi: 2, nascosti: 2 },
    { pagina: "energy", elenchi: 1, nascosti: 0 },
    { pagina: "security", elenchi: 1, nascosti: 0 },
  ]);
  assert.deepEqual(Object.keys(senzaLaPagina(tutta, "energy")).sort(), [
    "ev",
    "luci",
    "luci:zona-cucina",
    "security/telecamere",
  ]);
  assert.deepEqual(Object.keys(senzaLaPagina(tutta, "security")).includes("security/telecamere"), false);
  assert.deepEqual(pagineCambiate(null), []);
});
