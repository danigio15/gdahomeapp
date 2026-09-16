/* Una tessera per un'entità qualsiasi: c'è, ma non si trovava (#568, #570).
 *
 * «Se possibile aggiungere tessere per evidenziare lo stato di una entità»
 * (#568) e «Ho un sensore che mi controlla lo stato in % e in cm del livello
 * del sale addolcitore. Sarebbe possibile integrarlo da qualche parte?» (#570)
 * sono la stessa richiesta, e la risposta esisteva gia': «In evidenza», nella
 * scheda 🧩 Widget, con la spunta «Tessera a sé» che le da' una tessera tutta
 * sua in Home.
 *
 * Due persone in due giorni non l'hanno trovata, e quello e' un difetto: il
 * titolo diceva soltanto «In evidenza» e l'introduzione parlava di «entita' da
 * tenere d'occhio», non di tessere. Adesso il blocco si chiama con la parola
 * che hanno usato loro e l'introduzione nomina il caso: il livello del sale.
 *
 * E l'icona si sceglie dal catalogo di casa come dappertutto, invece di essere
 * una casella dove incollare un'emoji di sistema.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { LOAD_ICON_CATALOG, loadCatalogMatch } from "../src/core/personalization-catalog.js";
import { chiaveDelDisegno, disegnoDelCatalogo } from "../src/core/catalogo-disegni.js";

const leggi = (percorso) => readFileSync(new URL(`../src/${percorso}`, import.meta.url), "utf8");

test("l'icona di una tessera in evidenza si sceglie dal catalogo di casa", () => {
  const editor = leggi("sections/todo-editor-section.js");
  const riga = editor
    .split("\n")
    .find((linea) => linea.includes('data-evid-field="icon"'));
  assert.ok(riga, "la casella dell'icona deve esserci");
  assert.match(riga, /data-icon-category="load"/, "senza categoria il motore non apre niente");
  assert.match(riga, /data-icon-glifo="true"/, "li' ci va il segno, non il nome mdi");
  assert.match(riga, /\breadonly\b/, "una casella che si scrive a mano accetta emoji di sistema");
});

test("il blocco si chiama con la parola che hanno usato loro", () => {
  const editor = leggi("sections/todo-editor-section.js");
  assert.match(editor, /In evidenza · le tue tessere/);
  /* E l'introduzione nomina il caso concreto della #570, che e' il modo piu'
   * breve di far capire cosa ci si puo' mettere. */
  assert.match(editor, /livello del sale dell'addolcitore/);
  assert.match(editor, /Tessera a sé/);
});

test("l'addolcitore ha la sua voce nel catalogo, con un disegno di casa", () => {
  const voce = LOAD_ICON_CATALOG.find((item) => item.id === "softener");
  assert.ok(voce, "il catalogo dei carichi deve avere l'addolcitore");
  assert.equal(voce.it, "Addolcitore");
  assert.equal(voce.en, "Water softener");
  /* Si trova cercandolo col nome mdi, che e' quello che finisce salvato. */
  assert.equal(loadCatalogMatch(voce.mdi)?.id, "softener");
  /* E il disegno e' il nostro, non un'emoji: la prova di famiglia lo verifica
   * gia' a tappeto, qui si controlla che esista per QUESTA voce. */
  assert.ok(chiaveDelDisegno("softener"), "senza disegno resterebbe una faccina di sistema");
  assert.match(disegnoDelCatalogo("softener", 96), /viewBox="0 0 96 96"/);
});
