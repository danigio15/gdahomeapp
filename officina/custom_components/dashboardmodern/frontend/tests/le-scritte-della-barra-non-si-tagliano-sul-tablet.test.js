/* «I testi delle icone della navbar non entrano: devi distanziare le icone
 * lasciando testo grande.»
 *
 * Da una fotografia di un tablet di casa, con ventitre' sezioni accese: nella
 * barra in basso si leggeva «ANIM…», «AGEN…», «ELETT…», «GESTI…», «TEMP…»,
 * «MUS…». Dieci scritte su ventitre' tagliate a meta'. E «GESTI…» e' la voce
 * peggiore di tutte, perche' non dice se e' la gestione termica o quella
 * degli installatori.
 *
 * Da dove veniva, misurato in un browser vero e non indovinato. Per gli
 * schermi che si toccano da 900 punti in su c'e' una regola apposta, e diceva
 * `flex: 1 1 auto`: la riga si divide fra le linguette. Con poche sezioni
 * funzionava; con ventitre' dividere la riga vuol dire dare a ognuna il suo
 * minimo — settantadue punti — e in settantadue punti, tolto il margine, per
 * la scritta ne restano poco piu' di cinquanta. «Elettrodomestici» a dieci
 * punti di carattere ne chiede centosei.
 *
 * La cura e' il contrario: ogni linguetta larga quanto la sua parola
 * (`flex: 0 0 auto`, nessun tetto), scritta da undici punti, e quello che non
 * ci sta nella riga si raggiunge scorrendo. Misurato sullo stesso banco di
 * prima: da dieci tagliate a zero, la barra cresce di quindici punti in
 * altezza, e se ne vedono tredici e mezzo invece di quindici e nove.
 *
 * Questa prova tiene chiusa la porta da cui e' entrato il difetto: chi domani
 * rimette un tetto alla linguetta, o i puntini alla scritta, la trova qui.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/* I due fogli sono lo stesso programma in due lingue: una regola che finisce
 * in uno solo e' una plancia inglese che si comporta diversamente. */
const FOGLI = ["dashboard-runtime-it.css", "dashboard-runtime-en.css"];

const APERTURA = "@media (hover: none) and (pointer: coarse) and (min-width: 900px) and (min-height: 600px) {";

/** Il blocco del tablet, dal suo `@media` alla graffa che lo chiude. */
function bloccoDelTablet(foglio) {
  const testo = readFileSync(new URL(`../legacy/${foglio}`, import.meta.url), "utf8");
  const inizio = testo.indexOf(APERTURA);
  assert.notEqual(inizio, -1, `${foglio}: il blocco del tablet non c'e' piu'`);
  let dentro = 0;
  for (let i = testo.indexOf("{", inizio); i < testo.length; i += 1) {
    if (testo[i] === "{") dentro += 1;
    else if (testo[i] === "}") {
      dentro -= 1;
      if (dentro === 0) return testo.slice(inizio, i + 1);
    }
  }
  throw new Error(`${foglio}: il blocco del tablet non si chiude`);
}

test("sul tablet la linguetta e' larga quanto la sua parola, non quanto le tocca", () => {
  for (const foglio of FOGLI) {
    const blocco = bloccoDelTablet(foglio);
    /* `1 1 auto` e' la riga che si divide: con ventitre' sezioni ognuna
     * scende al minimo, ed e' li' che la scritta si taglia. */
    assert.doesNotMatch(blocco, /flex:\s*1\s+1\s+auto/, `${foglio}: la riga si divide di nuovo fra le linguette`);
    assert.match(blocco, /flex:\s*0\s+0\s+auto\s*!important/, `${foglio}: la linguetta non si misura piu' da se'`);
    /* Nessun tetto: un tetto e' una parola tagliata a una misura decisa
     * prima di sapere quale parola fosse. */
    assert.match(blocco, /max-width:\s*none\s*!important/, `${foglio}: e' tornato un tetto alla linguetta`);
    assert.doesNotMatch(blocco, /max-width:\s*\d+px/, `${foglio}: la linguetta ha di nuovo un tetto in punti`);
  }
});

test("la scritta e' grande abbastanza da leggersi, e intera", () => {
  for (const foglio of FOGLI) {
    const blocco = bloccoDelTablet(foglio);
    const misura = /font-size:\s*(\d+)px\s*!important/.exec(blocco.slice(blocco.indexOf(".tab .text")));
    assert.ok(misura, `${foglio}: la scritta della barra non dice piu' quanto e' grande`);
    assert.ok(
      Number(misura[1]) >= 11,
      `${foglio}: la scritta della barra e' tornata a ${misura[1]} punti, e sotto gli undici non si legge da un metro`,
    );
    /* I puntini erano la resa: si tagliava perche' non c'era posto. Adesso il
     * posto c'e' per costruzione, e tagliare sarebbe tagliare per niente. */
    const dellaScritta = blocco.slice(blocco.indexOf(".tab .text"));
    assert.match(dellaScritta, /text-overflow:\s*clip\s*!important/, `${foglio}: sono tornati i puntini`);
    assert.match(dellaScritta, /overflow:\s*visible\s*!important/, `${foglio}: la scritta e' di nuovo chiusa dentro la linguetta`);
  }
});

test("la riga comincia da sinistra, perche' deborda quasi sempre", () => {
  /* `space-evenly` spartisce l'avanzo prima e dopo le voci. Su una riga piu'
   * lunga dello schermo quell'avanzo e' negativo, e il browser lo toglie da
   * tutte e due le parti: la prima voce finisce sotto il bordo sinistro e non
   * si raggiunge scorrendo, perche' sta PRIMA dell'inizio dello scorrimento. */
  for (const foglio of FOGLI) {
    const blocco = bloccoDelTablet(foglio);
    assert.doesNotMatch(blocco, /justify-content:\s*space-evenly/, `${foglio}: la prima voce torna sotto il bordo`);
    assert.match(blocco, /justify-content:\s*flex-start\s*!important/, `${foglio}: la riga non comincia piu' da sinistra`);
  }
});

test("i due fogli dicono la stessa cosa", () => {
  const [italiano, inglese] = FOGLI.map(bloccoDelTablet);
  /* Si confrontano senza i commenti, che sono l'unica cosa che ha il diritto
   * di essere scritta in due lingue diverse. */
  const senzaCommenti = (testo) => testo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").trim();
  assert.equal(
    senzaCommenti(italiano),
    senzaCommenti(inglese),
    "il blocco del tablet non e' piu' lo stesso nelle due lingue",
  );
});
