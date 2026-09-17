/* L'avviso «non hai ancora collegato le tue entita'» non deve dirlo a chi le
 * ha collegate.
 *
 * Il guardiano sta in una stringa — un pezzo di programma che va dentro la
 * pagina della plancia — e una stringa nessuno la prova. Per dodici secondi ha
 * fatto il contrario di quello che c'era scritto nel suo commento, e si e'
 * visto in una fotografia arrivata da fuori: «La dashboard e' quasi pronta»
 * sopra una casa con diciassette sezioni dentro.
 *
 * **Come si prova.** Con un documento finto e, soprattutto, con l'orologio in
 * mano: il difetto era un `Date.now()` che scadeva, e aspettare dodici secondi
 * veri in una prova vuol dire una prova che nessuno rifa'. Qui il tempo lo
 * muove la prova, un battito per volta, ed e' l'unico modo di tenere ferma una
 * scadenza senza dipendere da quanto e' carica la macchina — la stessa lezione
 * di `battito.test.js`.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import vm from "node:vm";

import { AVVISO_ASPETTA_LA_CONFIGURAZIONE } from "../src/premesse.js";

const OGNI = 250;
const IL_NOME = "cd-empty-banner";

/* Il programma senza i tag, che dentro un `vm` non si possono eseguire. */
function ilGuardiano() {
  return AVVISO_ASPETTA_LA_CONFIGURAZIONE.replace(/^<script>/, "").replace(/<\/script>$/, "");
}

/* Un documento quel tanto che basta: un corpo con dei figli, e degli id. */
function unaPagina({ configurata = undefined, pieno = false } = {}) {
  let adesso = 1_000_000;
  const chiamato = { svuota: 0 };
  const intervalli = new Map();
  let prossimo = 1;

  const figli = [];
  const corpo = {
    appendChild(chi) {
      chi.parentNode = corpo;
      figli.push(chi);
      return chi;
    },
    removeChild(chi) {
      const dove = figli.indexOf(chi);
      if (dove >= 0) figli.splice(dove, 1);
      chi.parentNode = null;
      return chi;
    },
  };

  const documento = {
    body: corpo,
    createElement: () => ({
      id: "",
      style: {},
      parentNode: null,
      _attributi: new Set(),
      setAttribute(nome) {
        this._attributi.add(nome);
      },
      hasAttribute(nome) {
        return this._attributi.has(nome);
      },
    }),
    getElementById: (id) => figli.find((uno) => uno.id === id) || null,
    addEventListener: () => {},
  };

  const ascolti = new Map();
  const finestra = {
    document: documento,
    addEventListener(che, quale) {
      if (!ascolti.has(che)) ascolti.set(che, []);
      ascolti.get(che).push(quale);
    },
    setInterval(quale) {
      const id = prossimo++;
      intervalli.set(id, quale);
      return id;
    },
    clearInterval(id) {
      intervalli.delete(id);
    },
    setTimeout(quale) {
      quale();
      return 0;
    },
    Date: { now: () => adesso },
    Object,
    /* Le quattro domande della plancia. La prima basta, e la prova la muove. */
    get ENTITY_OVERRIDES() {
      return pieno ? { "light.x": {} } : {};
    },
    cdCfgList: () => [],
    cdCfg: () => ({}),
    cdEmptyStateCheck: () => {
      chiamato.svuota += 1;
    },
  };
  if (configurata !== undefined) finestra.__GDAHOME_CONFIGURATA__ = configurata;
  finestra.window = finestra;

  vm.runInContext(ilGuardiano(), vm.createContext(finestra), { filename: "avviso.js" });

  return {
    chiamato,
    /* Quanti battiti passano. Il tempo lo muove questa, non l'orologio vero. */
    batti(quanti) {
      for (let giro = 0; giro < quanti; giro += 1) {
        adesso += OGNI;
        for (const quale of [...intervalli.values()]) quale();
      }
    },
    /* La configurazione e' arrivata: la plancia lo dice con questo evento. */
    arrivata(piena) {
      pieno = piena;
      for (const quale of ascolti.get("dashboardmodern:persistence-restored") || []) quale();
    },
    /* Se il posto dell'avviso e' occupato da noi. */
    get ilPosto() {
      return documento.getElementById(IL_NOME);
    },
    get battiti() {
      return intervalli.size;
    },
  };
}

test("a una casa configurata non si dice mai che non lo e', per quanto lento sia il filo", () => {
  /* Il caso della fotografia: `configurata` e' vera, il filo non ha ancora
   * portato niente. Prima a dodici secondi — quarantotto battiti — il posto si
   * liberava e partiva la loro funzione. */
  const pagina = unaPagina({ configurata: true, pieno: false });
  assert.ok(pagina.ilPosto, "il posto dell'avviso non e' stato occupato");

  pagina.batti(48);
  assert.equal(pagina.chiamato.svuota, 0, "a dodici secondi si e' arreso");

  /* E nemmeno a un minuto. Non c'e' un'ora in cui diventa vero. */
  pagina.batti(240);
  assert.equal(pagina.chiamato.svuota, 0);
  assert.ok(pagina.ilPosto, "il posto e' stato lasciato libero");
});

test("e quando la configurazione arriva, il posto si libera in silenzio", () => {
  const pagina = unaPagina({ configurata: true, pieno: false });
  pagina.batti(48);
  pagina.arrivata(true);
  assert.equal(pagina.chiamato.svuota, 0, "ha chiamato la loro funzione su una casa piena");
  assert.equal(pagina.ilPosto, null, "il posto e' rimasto occupato");
});

test("una casa senza niente vede l'avviso subito, non dopo dodici secondi", () => {
  /* Il ponte dice «non ho configurazione»: non c'e' niente da aspettare, e il
   * posto non si occupa nemmeno. La loro funzione fa il suo mezzo secondo dopo
   * che la pagina e' pronta, com'e' sempre stato. */
  const pagina = unaPagina({ configurata: false, pieno: false });
  assert.equal(pagina.ilPosto, null, "ha occupato il posto di un avviso vero");
  assert.equal(pagina.battiti, 0, "ha messo un battito che non serve a niente");
});

test("una plancia di musica e apriporta non e' una plancia vuota", async () => {
  /* Il caso che ha fatto uscire l'avviso su una casa configurata, e non c'entra
   * il filo lento: le quattro domande che la plancia si fa guardano
   * `ENTITY_OVERRIDES`, le stanze, le unita' clima e le luci. Una plancia con
   * HOME, AUTO, MUSICA, APRI PORTE e CONFIG non ne riempie **nessuna** — e la
   * plancia diceva «non hai ancora collegato le tue entita'» a chi le sezioni
   * se le era fatte una per una.
   *
   * Il ponte le chiavi le conta tutte, non quattro. Quindi quando dice
   * «configurata» l'avviso non compare, nemmeno a configurazione arrivata:
   * fra le due risposte si tiene quella meglio informata. */
  const pagina = unaPagina({ configurata: true, pieno: false });
  pagina.batti(4);
  pagina.arrivata(false);
  assert.equal(pagina.chiamato.svuota, 0, "ha detto «non hai collegato niente» a una casa piena");
  assert.ok(pagina.ilPosto, "ha lasciato libero il posto dell'avviso");

  /* E non ci ripensa nemmeno dopo, per quanto passi. */
  pagina.batti(240);
  assert.equal(pagina.chiamato.svuota, 0);
});

test("se nessuno lo dice resta l'orologio di prima, e non peggiora niente", () => {
  /* Un ponte di ieri non manda `__GDAHOME_CONFIGURATA__`. Allora vale la
   * regola vecchia: dodici secondi, e poi l'avviso. */
  const pagina = unaPagina({ pieno: false });
  pagina.batti(47);
  assert.equal(pagina.chiamato.svuota, 0, "si e' arreso prima dei dodici secondi");
  pagina.batti(2);
  assert.equal(pagina.chiamato.svuota, 1, "non si e' arreso a dodici secondi");
});

test("il battito non gira per sempre: dopo mezzo minuto comanda l'evento", () => {
  /* Un `setInterval` ogni 250 ms che non finisce mai si vede nella
   * diagnostica, e questa e' una plancia che deve girare liscia. */
  const pagina = unaPagina({ configurata: true, pieno: false });
  /* Mezzo minuto sono centoventi battiti da 250 ms: prima ci deve essere, */
  pagina.batti(119);
  assert.equal(pagina.battiti, 1, "il battito si e' spento prima di mezzo minuto");
  /* dopo no. */
  pagina.batti(3);
  assert.equal(pagina.battiti, 0, "il battito gira ancora dopo mezzo minuto");

  /* E l'evento funziona comunque: e' lui che comanda da qui in avanti. */
  pagina.arrivata(true);
  assert.equal(pagina.ilPosto, null);
});

test("il patto e' scritto in due posti, e i due testi sono lo stesso testo", async () => {
  /* Il ponte serve la pagina dentro Home Assistant; il servitore dell'app la
   * serve al telefono e al browser. Sono due programmi in due lingue, e questo
   * pezzo deve essere identico: un guardiano corretto da una parte sola vuol
   * dire il difetto ancora vivo dall'altra — che e' proprio la parte da cui e'
   * arrivata la fotografia. */
  const { readFile } = await import("node:fs/promises");
  const dart = await readFile(
    new URL("../../app/lib/plancia/premesse.dart", import.meta.url),
    "utf8",
  );
  const da = dart.indexOf("static const String lAvvisoAspettaLaConfigurazione =");
  assert.ok(da > 0, "nell'app quel pezzo non si trova piu'");
  const a = dart.indexOf("'})();</script>';", da);
  assert.ok(a > da);
  const pezzi = dart.slice(da, a + "'})();</script>';".length).match(/'(?:[^'\\]|\\.)*'/gs) || [];
  const suo = pezzi
    .map((uno) => uno.slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, "\\"))
    .join("");
  assert.equal(suo, AVVISO_ASPETTA_LA_CONFIGURAZIONE);
});
