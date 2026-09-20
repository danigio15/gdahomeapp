/* «Le icone in basso vanno e vengono» (#8), e la cura precedente non e' bastata.
 *
 * Su iPhone le icone della barra restavano trasparenti: il posto c'era, il
 * nome sotto pure, e in mezzo niente. Tornavano tutte insieme dopo qualche
 * secondo, o scorrendo. Portare le sfumature dentro ogni disegno (#304) non
 * ha cambiato niente, e chi aveva segnalato l'ha detto chiaro: «uguale a
 * prima».
 *
 * Il video guardato fotogramma per fotogramma dice perche': fra le caselle
 * vuote c'erano anche le EMOJI — la batteria, l'ingranaggio — che sfumature
 * non ne hanno. Quello che le caselle vuote avevano in comune, e i nomi sotto
 * no, era il filtro: il guscio spegne i simboli a riposo con
 * `grayscale(1) opacity(0.5)`, e qui sopra ce n'era uno piu' leggero per i
 * disegni di casa. Su WebKit un elemento con un filtro dentro una barra che
 * scorre diventa un livello a se', e quel livello si ridipinge quando gli
 * pare.
 *
 * Quindi le caselle della barra non hanno filtri, in nessun tema e su nessuna
 * voce: ne' il nostro, ne' quello del guscio. Queste prove tengono ferme le
 * due meta': che la regola ci sia e vinca, e che nessun'altra regola della
 * barra rimetta un filtro sulle caselle.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const leggi = (rel) => readFile(new URL(rel, import.meta.url), "utf8");

/* La regola che spegne il filtro, e come vince.
 *
 * Il guscio scrive `nav.tabs.bottom-nav-bar .tab .icon{filter:...!important}`
 * (specificita' 0,4,1), e per la voce aperta e per quella sotto il mouse
 * `nav.tabs.bottom-nav-bar .tab.active .icon` e `... .tab:hover .icon`
 * (0,5,1). La classe nominata due volte porta la nostra a 0,5,1: pari alle
 * piu' alte del guscio, e la nostra viene dopo nel foglio, quindi vince. */
const REGOLA = "nav.tabs.bottom-nav-bar.bottom-nav-bar .tab .icon{filter:none!important}";

test("la barra spegne ogni filtro sulle caselle, per tutte le voci e tutti i temi", async () => {
  const sorgente = await leggi("../src/sections/navigation-section.js");
  assert.ok(sorgente.includes(REGOLA), "manca la regola che spegne il filtro sulle caselle");
});

test("nessuna regola della barra rimette un filtro sulle caselle", async () => {
  const sorgente = await leggi("../src/sections/navigation-section.js");
  /* Ogni regola che nomina la casella di una voce della barra: il filtro, se
   * c'e', deve essere `none`. Un `grayscale` o un `saturate` qui dentro e' il
   * difetto che torna, con qualunque nome. */
  const regole = sorgente.matchAll(/([^{}]*\.tab[^{}]*\.icon[^{}]*)\{([^}]*)\}/g);
  const conFiltro = [];
  for (const [, selettore, corpo] of regole) {
    for (const [, valore] of corpo.matchAll(/(?:^|;)\s*filter\s*:\s*([^;!]+)/g)) {
      if (valore.trim() !== "none") conFiltro.push(`${selettore.trim()} → ${valore.trim()}`);
    }
  }
  assert.deepEqual(conFiltro, []);
});

test("i filtri del guscio sulle caselle sono quelli che la regola sa battere", async () => {
  /* Se il guscio un giorno ne scrivesse uno piu' specifico, la nostra regola
   * perderebbe in silenzio: questa prova lo dice prima. */
  for (const lingua of ["it", "en"]) {
    const foglio = await leggi(`../legacy/dashboard-runtime-${lingua}.css`);
    const selettori = new Set();
    for (const [, selettore, corpo] of foglio.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      if (!/\bfilter\s*:/.test(corpo)) continue;
      for (const uno of selettore.split(",")) {
        const pulito = uno.trim();
        if (/bottom-nav-bar/.test(pulito) && /\.icon\b/.test(pulito)) selettori.add(pulito);
      }
    }
    assert.deepEqual(
      [...selettori].sort(),
      [
        "nav.tabs.bottom-nav-bar .tab .icon",
        "nav.tabs.bottom-nav-bar .tab.active .icon",
        "nav.tabs.bottom-nav-bar .tab:hover .icon",
      ],
      `il guscio (${lingua}) ha cambiato i filtri sulle caselle della barra`,
    );
  }
});
