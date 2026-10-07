/* «Nelle azioni rapide, sotto il comando scena, se inserisco un'entita' che e'
 * un select — quindi apre un menu a tendina — mi devi far scegliere cosa far
 * partire.» E poi: «mi devi aprire un popup dove poter selezionare quelle
 * presenti nell'entita'».
 *
 * Un `select` non si accende e non e' una scena: ha delle voci. Il tasto
 * chiedeva `scene.turn_on` (o `select.toggle`), e Home Assistant rispondeva
 * che quel servizio non c'e', in silenzio: da fuori, un tasto rotto. Adesso
 * il tasto apre un popup con le voci del menu e mette quella che si tocca;
 * chi vuole un tasto secco fissa una voce nell'editor, e allora il tasto la
 * mette senza chiedere e si accende quando la casa e' su quella. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  datiPerEntita,
  servizioPerEntita,
  vociDelMenu,
} from "../src/sections/azioni-servizio-giusto-section.js";
import { azioneAccesa, entitaDelleAzioni } from "../src/core/azione-accesa.js";

const leggi = (nome) => readFileSync(new URL(`../${nome}`, import.meta.url), "utf8");

const CASA = {
  "select.modalita": {
    state: "Notte",
    attributes: { friendly_name: "Modalità casa", options: ["Giorno", "Notte", "Vacanza"] },
  },
  "input_select.scena": { state: "Cena" },
  "light.salone": { state: "on" },
};

test("un menu a tendina chiama select_option: con la voce fissata, o con quella scelta", () => {
  assert.equal(servizioPerEntita("select.modalita", CASA), "select_option");
  assert.equal(servizioPerEntita("input_select.scena", CASA), "select_option");
  const fissa = { type: "scene", entity: "select.modalita", option: "Vacanza" };
  assert.deepEqual(datiPerEntita("select.modalita", fissa), { option: "Vacanza" });
  assert.deepEqual(datiPerEntita("input_select.scena", { option: "Pranzo" }), { option: "Pranzo" });
  /* Senza una voce fissata i dati sono vuoti: e' il popup che la mette. */
  assert.deepEqual(datiPerEntita("select.modalita", { type: "toggle" }), {});
  /* E per chi non e' un menu la voce non conta niente. */
  assert.equal(servizioPerEntita("light.salone", CASA), "");
  assert.deepEqual(datiPerEntita("light.salone", { option: "Vacanza" }), {});
});

test("le voci del popup sono quelle dell'entita', e quella di adesso si sa", () => {
  assert.deepEqual(vociDelMenu("select.modalita", CASA), {
    nome: "Modalità casa",
    attuale: "Notte",
    voci: ["Giorno", "Notte", "Vacanza"],
  });
  /* Un menu che non dice le sue voci: niente da elencare, e lo si dice. */
  assert.deepEqual(vociDelMenu("input_select.scena", CASA), {
    nome: "input_select.scena",
    attuale: "Cena",
    voci: [],
  });
  assert.deepEqual(vociDelMenu("select.sparito", CASA), {
    nome: "select.sparito",
    attuale: "",
    voci: [],
  });
});

test("il tasto si accende quando la casa e' sulla voce fissata", () => {
  const azione = { type: "scene", entity: "select.modalita", option: "Notte" };
  assert.equal(azioneAccesa(azione, CASA), true);
  assert.equal(azioneAccesa({ ...azione, option: "Giorno" }, CASA), false);
  assert.equal(
    azioneAccesa(azione, { "select.modalita": { state: "unavailable" } }),
    null,
    "un menu che non risponde non e' spento",
  );
  /* Una scena vera resta senza stato, come prima. */
  assert.equal(azioneAccesa({ type: "scene", entity: "scene.cena" }, CASA), null);
  /* E chi decide se ridisegnare guarda anche questa entita'. */
  assert.deepEqual(entitaDelleAzioni([azione, { type: "scene", entity: "scene.cena" }]), [
    "select.modalita",
  ]);
});

test("senza una voce fissata il tasto apre il popup, e il popup chiama il servizio", () => {
  const sorgente = leggi("src/sections/azioni-servizio-giusto-section.js");
  /* Scene e script non tornano piu' al vecchio giro per tipo: si guarda l'entita'. */
  assert.match(sorgente, /\["luci_group", "builtin"\]\.includes\(azione\.type\)/);
  assert.doesNotMatch(sorgente, /"builtin", "script", "scene"\]/);
  assert.match(
    sorgente,
    /if \(E_UN_MENU\.test\(entity\) && !dati\.option\) \{\s*apriIlMenu\(entity, azione\);/,
  );
  assert.match(sorgente, /service_data: \{ entity_id: entity, \.\.\.dati \}/);
  /* Il popup: una finestra sola, con la veste delle altre, una riga per voce,
   * quella di adesso segnata, e al tocco `select_option` con quella voce. */
  assert.match(sorgente, /const POPUP = "dm-qa-popup";/);
  assert.match(sorgente, /<article class="dm-widget-detail" data-dm-qa-scheda>/);
  assert.match(
    sorgente,
    /data-dm-qa-voce="\$\{esc\(voce\)\}" data-attuale="\$\{voce === attuale\}"/,
  );
  assert.match(
    sorgente,
    /chiama\(entity\.split\("\."\)\[0\], "select_option", entity, \{ option: voce \}\)/,
  );
  assert.match(sorgente, /classList\?\.add\("dm-widget-popup-open"\)/);
  /* E il disegno dell'azione, non il suo nome: un'icona puo' essere un
   * simbolo scelto a mano o un token del catalogo, e scritta come testo
   * «mdi:home» si legge tale e quale sopra il titolo. */
  assert.match(
    sorgente,
    /writeIconGlyph\(faccia, azione\?\.icon, \{ size: 22, fallback: "🎚️" \}\)/,
  );
  assert.doesNotMatch(sorgente, /faccia\.textContent = /);
  /* La veste e' quella delle altre finestre: il foglio dei widget la dichiara
   * anche per questa, in ogni regola, e nessuna resta a due. */
  const widgets = leggi("src/sections/home-widgets-section.js");
  assert.ok(widgets.includes("#dm-widget-popup,#dm-casa-popup,#dm-qa-popup"));
  assert.doesNotMatch(widgets, /#dm-widget-popup,#dm-casa-popup[^,]/);
});

for (const runtime of ["dashboard-runtime-it.js", "dashboard-runtime-en.js"]) {
  test(`${runtime}: l'editor fa fissare la voce, se si vuole, e la salva`, () => {
    const sorgente = leggi(`legacy/${runtime}`);
    assert.match(sorgente, /<select id="ed-qa-option" class="ed-input"/);
    assert.match(
      sorgente,
      /<input id="ed-qa-ent" autocomplete="off" oninput="edQaEntityChanged\(\)"/,
    );
    assert.match(sorgente, /function edQaEntityChanged\(\)/);
    /* Le voci le dice l'entita', e solo un menu ne ha. */
    assert.match(sorgente, /\/\^\(select\|input_select\)\\\.\/\.test\(eid\)/);
    assert.match(sorgente, /Array\.isArray\(attr\.options\)/);
    const aggiunta = sorgente.slice(sorgente.indexOf("function edAddQA()"));
    const corpo = aggiunta.slice(0, aggiunta.indexOf("\n}\n"));
    assert.match(corpo, /if \(opt\) a\.option = opt;/);
    /* Facoltativa: senza voce si aggiunge lo stesso, e il tasto apre il popup. */
    assert.doesNotMatch(corpo, /if \(!opt\)/);
    /* Cambiato il tipo si riguarda l'entita'; scelta dal cercatore, la riga
     * delle voci si aggiorna da sola. */
    const tipo = sorgente.slice(sorgente.indexOf("function edQaTypeChanged()"));
    assert.match(tipo.slice(0, tipo.indexOf("\n}\n")), /edQaEntityChanged\(\);/);
    assert.match(
      sorgente,
      /if \(ref === '__ed_qa__'\) \{ const qa = document\.getElementById\('ed-qa-ent'\); if \(qa\) \{ qa\.value = id; edQaEntityChanged\(\); \} return; \}/,
    );
    /* E nell'elenco si legge quale voce mette. */
    assert.match(sorgente, /\(a\.option \? ' → ' \+ a\.option : ''\)/);
  });
}

test("chi modifica un'azione dall'editor ritrova la voce, e la risalva", () => {
  const crud = leggi("src/sections/editor-crud-section.js");
  assert.match(crud, /setField\("ed-qa-option", item\.option \|\| ""\)/);
  assert.match(crud, /if \(voce\) next\.option = voce;\s*else delete next\.option;/);
});
