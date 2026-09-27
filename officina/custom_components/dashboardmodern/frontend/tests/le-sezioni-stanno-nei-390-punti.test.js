/* Le sezioni della plancia, misurate a 390 punti in un browser vero.
 *
 * «Sborda», «non si legge», «si taglia»: le segnalazioni dal campo dicono
 * sempre la stessa cosa e sempre di una pagina diversa, e guardare venti
 * scatti a occhio trova quello che salta all'occhio e lascia dentro quello
 * che e' largo cinque pixel di troppo. Quindi si misura: si apre ogni voce
 * della barra su uno schermo da 390 punti — un iPhone qualunque — e si
 * chiedono al browser due numeri per ogni elemento. Chi esce dalla larghezza
 * della finestra, e chi e' piu' largo del suo contenitore che lo taglia senza
 * avere chiesto i puntini.
 *
 * Quattordici sezioni misurate. Tre guasti, tutti qui sotto: uno vero — la
 * pagina Luci che scorreva di lato di sedici pixel — e due che si leggono
 * male. Il resto delle pagine era a posto, e quello che restava segnato erano
 * cose volute: il nastro che deriva sotto il meteo, le strisce di pastiglie
 * che si scorrono col dito, e il testo scritto per chi non vede.
 *
 * Queste prove leggono il sorgente. Non rifanno la misura — per quella ci
 * vuole un browser, e sta nelle prove e2e — ma tengono ferme le tre righe che
 * l'hanno chiusa, perche' sono tre righe che si tolgono senza accorgersene.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const leggi = (nome) => readFileSync(new URL(`../src/${nome}`, import.meta.url), "utf8");

test("la pagina delle Luci dichiara la sua colonna, e non si allarga col figlio piu' largo", () => {
  /* Una griglia senza colonne se ne fa una implicita larga quanto il figlio
   * piu' largo. Qui il figlio piu' largo era la testata — il riquadro dei
   * conti e i due tasti «accendi tutte / spegni tutte» affiancati — e la sua
   * larghezza naturale a 390 punti e' 387 dove ce ne sono 354: la pagina
   * usciva di sedici pixel e si portava dietro le card, che di quella colonna
   * sono figlie. E' lo stesso guasto della card della Musica, e vale per tre
   * pagine, perche' questo foglio lo portano Luci, Stanze e Prese. */
  const foglio = leggi("sections/lights-page-section.js");
  assert.match(
    foglio,
    /\.dm-lucip-wrap\{[^}]*display:grid;grid-template-columns:minmax\(0,1fr\)/,
    "la colonna della pagina Luci non e' dichiarata: torna a sbordare",
  );
  /* E dentro, sul telefono, «1fr» da solo ha per minimo il contenuto minimo:
   * il nome lungo di una luce allargherebbe la colonna invece di accorciarsi. */
  assert.match(foglio, /\.dm-lucip-grid\{grid-template-columns:minmax\(0,1fr\)\}/);
});

test("la pastiglia del comfort e' larga quanto la sua parola", () => {
  /* Era un cerchietto con dentro un'emoji — «width:28px», e «24px» sul
   * telefono — ed e' diventata una parola: «Comfort», «Freddo», «Non
   * disponibile». La regola nuova rifa' tutto con «!important», «max-width»
   * compreso, ma la larghezza vecchia era rimasta: la pastiglia restava quella
   * del cerchietto, tirata a 58 dal «min-width», e la parola dentro veniva
   * tagliata. Misurato: 61 pixel di scritta in 56. */
  const foglio = leggi("sections/temperature-section.js");
  const riga = /\.temp-comfort-badge\{[^}]*\}/.exec(foglio)?.[0] || "";
  assert.ok(riga, "la regola della pastiglia non c'e' piu': questa prova non misura niente");
  assert.match(riga, /width:auto!important/, "la larghezza del cerchietto vecchio torna a vincere");
  assert.match(riga, /overflow:hidden!important/, "senza questo la prova non dice niente di nuovo");
});

test("il numero degli elettrodomestici accesi e la sua parola concordano", () => {
  /* «1 elettrodomestici attivi» sta sotto il numero piu' grande della pagina,
   * e a chi legge non sembra una sfumatura di lingua: sembra che il programma
   * abbia sbagliato a contare. Lo zero resta al plurale, che e' come si dice. */
  const foglio = leggi("sections/appliance-showcase-section.js");
  assert.match(foglio, /activeOne: t\("elettrodomestico attivo", "appliance running"\)/);
  assert.match(
    foglio,
    /counts\.running === 1 \? labels\.activeOne : labels\.active/,
    "la parola non segue piu' il numero",
  );
});
