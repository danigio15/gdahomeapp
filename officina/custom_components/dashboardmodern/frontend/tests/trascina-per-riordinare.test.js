/* Riordinare trascinando (#379): i conti che decidono dove cade una riga.
 *
 * «Sarebbe carino se le tessere si potessero spostare con drag & drop.» Il
 * trascinamento vero si prova nel browser; qui si tengono fermi i tre conti
 * che lo governano: dove cade una riga a seconda di dove sta il suo centro,
 * come cambia l'elenco quando cade, e quanto scorre l'elenco vicino ai bordi.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  doveCade,
  riduzioneDelFantasma,
  scorrimentoAlBordo,
  spostaNellaLista,
  versoIlBordo,
} from "../src/sections/trascina-per-riordinare.js";

/* Cinque righe alte 40 con 8 di spazio: centri a 20, 68, 116, 164, 212. */
const centri = [20, 68, 116, 164, 212];

test("ferma dov'era, la riga resta al suo posto", () => {
  assert.equal(doveCade(centri, 2, 116), 2);
  assert.equal(doveCade(centri, 0, 20), 0);
});

test("passato il centro della vicina, prende il suo posto", () => {
  assert.equal(doveCade(centri, 2, 160), 2, "prima del centro della successiva resta");
  assert.equal(doveCade(centri, 2, 170), 3, "oltre il centro della successiva scende");
  assert.equal(doveCade(centri, 2, 70), 2, "sotto il centro della precedente resta");
  assert.equal(doveCade(centri, 2, 66), 1, "sopra il centro della precedente sale");
  assert.equal(doveCade(centri, 4, -50), 0, "in cima a tutte");
  assert.equal(doveCade(centri, 0, 999), 4, "in fondo a tutte");
});

test("l'elenco: la riga presa va nel posto nuovo, le altre scorrono", () => {
  const lista = ["meteo", "luci", "clima", "auto", "energia"];
  assert.deepEqual(spostaNellaLista(lista, 4, 0), ["energia", "meteo", "luci", "clima", "auto"]);
  assert.deepEqual(spostaNellaLista(lista, 0, 2), ["luci", "clima", "meteo", "auto", "energia"]);
  assert.deepEqual(spostaNellaLista(lista, 1, 1), lista);
  assert.deepEqual(
    spostaNellaLista(lista, 9, 0),
    lista,
    "un indice che non c'e' non cambia niente",
  );
  assert.deepEqual(
    lista,
    ["meteo", "luci", "clima", "auto", "energia"],
    "l'originale non si tocca",
  );
});

test("vicino ai bordi l'elenco scorre, piu' in fretta quanto piu' ci si avvicina", () => {
  assert.equal(scorrimentoAlBordo(300, 0, 600), 0, "in mezzo sta fermo");
  assert.ok(scorrimentoAlBordo(40, 0, 600) < 0, "in alto sale");
  assert.ok(scorrimentoAlBordo(570, 0, 600) > 0, "in basso scende");
  assert.ok(Math.abs(scorrimentoAlBordo(2, 0, 600)) > Math.abs(scorrimentoAlBordo(40, 0, 600)));
  assert.equal(scorrimentoAlBordo(-100, 0, 600), -14, "oltre il bordo non supera il massimo");
});

/* ── l'anteprima modificabile: la bozza ── */
import {
  alternaNellaBozza,
  bozzaCambiata,
  bozzaDa,
  bozzaRiallineata,
  spostaFraLeVisibili,
} from "../src/core/anteprima-modificabile.js";

test("la bozza nasce dalla scelta salvata, pulita", () => {
  assert.deepEqual(
    bozzaDa({ ordine: ["luci", "clima", "luci", ""], nascoste: ["clima", "fantasma"] }),
    {
      ordine: ["luci", "clima"],
      nascoste: ["clima"],
    },
  );
});

test("spostando fra le sole tessere visibili, quelle che non si vedono tengono il posto", () => {
  /* In Home si vedono luci, meteo, energia; «allagamenti» c'e' nell'ordine
   * ma adesso non ha niente da dire. Energia portata in cima alle visibili
   * va davanti a luci, e allagamenti resta fra meteo ed energia. */
  const bozza = bozzaDa({ ordine: ["luci", "meteo", "allagamenti", "energia"] });
  const visibili = ["luci", "meteo", "energia"];
  assert.deepEqual(spostaFraLeVisibili(bozza, visibili, 2, 0).ordine, [
    "energia",
    "luci",
    "meteo",
    "allagamenti",
  ]);
  assert.deepEqual(spostaFraLeVisibili(bozza, visibili, 0, 1).ordine, [
    "meteo",
    "luci",
    "allagamenti",
    "energia",
  ]);
});

test("l'occhio accende e spegne, e la bozza sa quando e' diversa dalla salvata", () => {
  const salvata = { ordine: ["luci", "meteo"], nascoste: [] };
  let bozza = bozzaDa(salvata);
  assert.equal(bozzaCambiata(bozza, salvata), false);
  bozza = alternaNellaBozza(bozza, "meteo");
  assert.deepEqual(bozza.nascoste, ["meteo"]);
  assert.equal(bozzaCambiata(bozza, salvata), true);
  bozza = alternaNellaBozza(bozza, "meteo");
  assert.equal(bozzaCambiata(bozza, salvata), false, "riaccesa, e' di nuovo uguale");
  assert.equal(bozzaCambiata(null, salvata), false, "senza bozza non c'e' niente da salvare");
});

test("una voce nata mentre la bozza era in mano entra al suo posto, una sparita esce", () => {
  const bozza = { ordine: ["meteo", "luci", "vecchia"], nascoste: ["vecchia"] };
  assert.deepEqual(bozzaRiallineata(bozza, { ordine: ["luci", "nuova", "meteo"] }), {
    ordine: ["meteo", "nuova", "luci"],
    nascoste: [],
  });
});

test("il fantasma sta nello schermo: largo al piu' lo schermo, alto al piu' il 40%", () => {
  assert.equal(riduzioneDelFantasma(200, 100, 390, 844), 1, "una tessera piccola non si tocca");
  const largo = riduzioneDelFantasma(740, 200, 390, 844);
  assert.ok(
    740 * 1.05 * largo <= 390 - 16 + 0.5,
    "l'Antifurto largo come lo schermo ci sta di lato",
  );
  const alto = riduzioneDelFantasma(360, 700, 390, 844);
  assert.ok(700 * alto <= 844 * 0.4 + 0.5, "un riquadro altissimo si rimpicciolisce al 40%");
  assert.equal(
    riduzioneDelFantasma(5000, 5000, 390, 844),
    0.35,
    "mai cosi' piccolo da non leggersi",
  );
});

test("la pagina scorre solo verso dove va il puntatore", () => {
  /* Una voce presa gia' dentro il bordo in basso (sopra la barra della
   * modifica): finche' il puntatore non scende, la pagina non corre giu'. */
  assert.equal(versoIlBordo(12, 0), 0, "fermo nel bordo: niente");
  assert.equal(versoIlBordo(12, -200), 0, "sta salendo: il bordo in basso non conta");
  assert.equal(versoIlBordo(12, 30), 12, "scende davvero: scorre");
  assert.equal(versoIlBordo(-12, 5), 0, "in alto, appena preso: niente");
  assert.equal(versoIlBordo(-12, -40), -12, "sale davvero: scorre su");
  assert.equal(versoIlBordo(0, 300), 0, "lontano dai bordi resta fermo");
});
