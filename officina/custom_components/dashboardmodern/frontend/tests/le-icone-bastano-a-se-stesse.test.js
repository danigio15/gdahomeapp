/* «Il problema della barra: non carica le icone, scompaiono.» Su iPhone.
 *
 * Partito dalla barra, e finito in tutta la plancia: contando nella pagina
 * vera, il difetto ce l'avevano anche le dieci facce delle tessere della Home
 * e le quattro pastiglie della fascia sotto il meteo. La causa e' una sola,
 * quindi la cura e' una sola, e queste prove la tengono ferma dappertutto.
 *
 * Misurato dal video fotogramma per fotogramma: la barra sta agli stessi
 * pixel, le scritte pure, e cambia solo la fascia dei disegni. Il disegno c'e'
 * e occupa il suo posto — e' trasparente. Cioe' il suo riempimento e'
 * `url(#qualcosa)` e quel qualcosa non si e' trovato.
 *
 * Non si trovava per una ragione precisa: i disegni bastano a se' stessi, ma
 * il foglio unico delle sfumature sta PRIMO nel corpo della pagina, e a un
 * identificatore ripetuto risponde sempre il primo che lo porta. Da quel
 * momento il disegno nella barra non guarda le proprie sfumature, guarda
 * quelle del foglio: un rimando fra due elementi diversi, verso un SVG
 * larghezza zero, che WebKit non risolve e Chromium si'. Da qui «solo su
 * iPhone».
 *
 * Queste prove tengono ferma la cura — nella barra il disegno si porta via un
 * nome suo — e le tre condizioni che la rendono una cura e non un altro
 * difetto: che basti davvero a se' stesso, che il nome sia sempre lo stesso a
 * ogni giro, e che chi non lo chiede resti come prima.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir } from "node:fs/promises";

import { CHIAVI_OGGETTI, oggettoWidget } from "../src/core/oggetti-widget.js";

const SORGENTE = new URL("../src/", import.meta.url);

const idDichiarati = (markup) =>
  new Set([...markup.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => id));

const idChiesti = (markup) => [...markup.matchAll(/url\(#([^)\s]+)\)/g)].map(([, id]) => id);

test("col posto, ogni disegno dichiara da se' tutto quello che chiede", () => {
  const fuori = [];
  for (const chiave of CHIAVI_OGGETTI) {
    const suo = oggettoWidget(chiave, "", `nav-${chiave}`);
    const dichiarati = idDichiarati(suo);
    for (const id of idChiesti(suo)) {
      if (!dichiarati.has(id)) fuori.push(`${chiave} → ${id}`);
    }
  }
  assert.deepEqual(
    [...new Set(fuori)],
    [],
    "un disegno della barra chiede una sfumatura che non dichiara: tornerebbe a dipendere dal foglio, e su WebKit resterebbe trasparente",
  );
  assert.ok(CHIAVI_OGGETTI.length > 40, `pochi disegni provati: ${CHIAVI_OGGETTI.length}`);
});

test("due posti diversi non si passano le sfumature", () => {
  /* Il punto della cura: se due voci mostrassero lo stesso disegno con lo
   * stesso nome, la prima risponderebbe anche per la seconda — ed e' esatto il
   * difetto della #304, dove la prima portatrice stava in un ramo che la
   * configurazione teneva a `display:none`. */
  const qui = oggettoWidget("clima", "", "nav-clima");
  const la = oggettoWidget("clima", "", "nav-meteo");
  const suoi = idChiesti(qui);
  assert.ok(suoi.length > 0, "il fiocco non chiede nessuna sfumatura?");
  for (const id of suoi) assert.ok(!la.includes(id), `${id} risponde anche altrove`);
});

test("lo stesso posto da' sempre lo stesso markup", () => {
  /* La barra decide se ridisegnare confrontando quello che c'e' con quello che
   * scriverebbe: un nome diverso a ogni giro vorrebbe dire ridisegnare per
   * sempre, tre volte al secondo, e sarebbe un difetto peggiore di quello che
   * si sta curando. */
  for (const chiave of ["luci", "clima", "energia", "temperatura"]) {
    assert.equal(
      oggettoWidget(chiave, "", `nav-${chiave}`),
      oggettoWidget(chiave, "", `nav-${chiave}`),
    );
  }
});

test("il ripiego di colore resta anche col nome nuovo", () => {
  /* `url(#x) currentColor`: se la sfumatura non si trovasse comunque, il
   * disegno viene pieno del colore del testo invece che trasparente. Le due
   * riscritture si toccano — una cambia il nome dentro `url(#...)`, l'altra
   * aggiunge il ripiego accanto — e nell'ordine sbagliato il ripiego non
   * arriverebbe. */
  const suo = oggettoWidget("clima", "", "nav-clima");
  assert.match(suo, /stroke="url\(#nav-clima-dmoGelo\) currentColor"/);
});

test("chi non chiede il posto resta col foglio, come prima", () => {
  /* Le tessere e le voci di configurazione non hanno il difetto: la
   * correzione vale dove si vede e non muove il resto. */
  const nudo = oggettoWidget("clima");
  assert.match(nudo, /url\(#dmoGelo\)/);
  assert.ok(!nudo.includes("nav-clima"));
});

test("la barra chiede il disegno col suo posto", async () => {
  const source = await readFile(
    new URL("../src/sections/navigation-section.js", import.meta.url),
    "utf8",
  );
  /* Il posto e' la voce: sempre lo stesso per quella voce, diverso da ogni
   * altra. Non un contatore e non un numero a caso. */
  assert.match(source, /oggettoWidget\(disegno, "", `nav-\$\{pagina\}`\)/);
});

/* Quanti argomenti ha questa chiamata, contando solo le virgole di primo
 * livello: le chiamate stanno anche su piu' righe, e dentro ci sono altre
 * parentesi e altre virgole. */
function argomentiDellaChiamata(testo, dopoLaParentesi) {
  let dentro = 1;
  let virgole = 0;
  for (let i = dopoLaParentesi; i < testo.length; i += 1) {
    const c = testo[i];
    if (c === "(" || c === "[" || c === "{") dentro += 1;
    else if (c === ")" || c === "]" || c === "}") {
      dentro -= 1;
      if (!dentro) return virgole + 1;
    } else if (c === "," && dentro === 1) virgole += 1;
  }
  return 0;
}

test("chi mostra un oggetto dice sempre dove lo mette", async () => {
  /* La regola che tiene in piedi la cura, e la parte che si dimentica: un
   * posto in meno e quel disegno torna a dipendere dal foglio in cima al
   * corpo, cioe' torna trasparente su WebKit — e trasparente solo la', dove
   * qui non si prova. Allora lo prova la sorgente.
   *
   * `haOggettoWidget` e il foglio restano la rete: chi non passa il posto non
   * si rompe, si vede soltanto dove il rimando fra elementi si risolve. */
  const senzaPosto = [];
  const files = (await readdir(SORGENTE, { recursive: true })).filter((nome) => /\.js$/.test(nome));
  let chiamate = 0;
  for (const nome of files) {
    if (nome.endsWith("oggetti-widget.js")) continue;
    const testo = await readFile(new URL(nome, SORGENTE), "utf8");
    for (const trovato of testo.matchAll(/\boggettoWidget\(/g)) {
      const dopo = trovato.index + trovato[0].length;
      chiamate += 1;
      if (argomentiDellaChiamata(testo, dopo) < 3) {
        const riga = testo.slice(0, trovato.index).split("\n").length;
        senzaPosto.push(`${nome}:${riga}`);
      }
    }
  }
  assert.ok(chiamate > 10, `poche chiamate trovate: ${chiamate}`);
  assert.deepEqual(
    senzaPosto,
    [],
    "qui si mostra un disegno senza dire dove: passa un terzo argomento stabile (il posto), o su iPhone quel disegno resta trasparente",
  );
});
