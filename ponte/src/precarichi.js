/* I precarichi della pagina: i pochi che servono, e i molti che no.
 *
 * `dashboard.html` porta trecentocinquantaquattro righe di
 * `<link rel="modulepreload">`. Non e' il grafo della pagina: e' un elenco che
 * arriva da chi costruisce la plancia, e dentro ci stanno duecentocinquantanove
 * moduli che nessuno importa. Il browser li chiede tutti, li compila, e non ne
 * apre nemmeno uno.
 *
 * Dentro casa non si sente: sono file su una rete locale. Fuori casa ognuno e'
 * un giro sul filo attraverso il centralino, e a freddo — cioe' dopo ogni
 * aggiornamento, perche' l'impronta nel percorso cambia e il telefono ricomincia
 * da zero — sono trecentosessantasei file e 9,25 MB, di cui 5,45 non li apre
 * nessuno. E' il minuto che ci mette la plancia ad aprirsi da fuori.
 *
 * Un `modulepreload` e' un **consiglio**, non un import: dice al browser di
 * prendersi avanti un modulo che poi qualcuno importera'. Togliere una di quelle
 * righe non cambia niente di quello che la pagina esegue — un modulo importato
 * si carica comunque, quando lo si importa. Perche' questo resti vero anche nei
 * tempi, quelle del grafo si lasciano dove sono e in quell'ordine: senza il
 * consiglio si caricherebbero a cascata, sei giri uno dietro l'altro.
 *
 * Il grafo si cammina sui file dell'add-on, che sono quelli che si servono, e
 * non su un elenco scritto a mano: la plancia della versione dopo arriva col
 * suo grafo senza che nessuno aggiorni niente. E la cartella non si tocca — si
 * pota la pagina al momento di servirla, come il marchio. Il sigillo resta
 * quello di prima.
 *
 * Quando qualcosa non torna — la pagina non dice da quale modulo parte, il
 * primo modulo non si legge, il grafo viene fuori troppo piccolo o troppo
 * grande — la pagina si serve **com'e'**. Tutti gli errori di qui vanno in una
 * direzione sola: un precarico in piu' non ha mai rotto niente, e una plancia
 * lenta e' sempre meglio di una plancia che non parte.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";

/* Da quale modulo parte la pagina, e le righe da potare. */
const IL_MODULO_DI_PARTENZA = /<script[^>]+\btype="module"[^>]*\bsrc="([^"]+)"/i;
const UN_PRECARICO = /[ \t]*<link\b[^>]*\brel="modulepreload"[^>]*>[ \t]*\r?\n?/gi;
const IL_SUO_INDIRIZZO = /\bhref="([^"]+)"/i;

/* Da dove un modulo tira gli altri: `from "…"`, `import("…")`, `import "…"`.
 * Si prende tutto quello che somiglia a un import, e si sbaglia includendo. */
const I_RIFERIMENTI = [
  /\bfrom\s*["']([^"']+)["']/g,
  /\bimport\s*\(\s*["']([^"']+)["']/g,
  /(?:^|[\n;])\s*import\s*["']([^"']+)["']/g,
];

/* Quanti moduli al massimo si guardano. Il grafo vero ne ha novantaquattro:
 * con questo tetto una plancia storta costa un millisecondo, non un ponte
 * fermo. Arrivarci vuol dire che non l'abbiamo capita, e allora non si pota. */
const AL_MASSIMO = 3000;

/* E quanti almeno. Un grafo di tre moduli non vuol dire che la pagina ne usa
 * tre: vuol dire che non l'abbiamo letta. */
const ALMENO_TANTI = 10;

function leggiDalDisco(dove) {
  return readFileSync(dove, "utf8");
}

function dentroLa(cartella, dove) {
  return dove === cartella || dove.startsWith(cartella + sep);
}

/* Un percorso relativo, senza quello che non fa parte del file. */
function soloIlFile(riferimento) {
  return riferimento.split("?")[0].split("#")[0];
}

function eRelativo(riferimento) {
  return riferimento.startsWith(".") || riferimento.startsWith("/");
}

/* I moduli che questo modulo tira dentro.
 *
 * Prima si toglie quello che non e' codice: un percorso citato in una
 * spiegazione non e' un import, e qui dentro le spiegazioni sono lunghe.
 * Sbagliare a togliere costa un precarico in piu' o un modulo caricato un giro
 * dopo, mai una pagina rotta. */
function iRiferimenti(testo) {
  const codice = testo.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
  const fuori = new Set();
  for (const quale of I_RIFERIMENTI) {
    quale.lastIndex = 0;
    let trovato;
    while ((trovato = quale.exec(codice))) fuori.add(trovato[1]);
  }
  return fuori;
}

/* Il grafo, camminato dal primo modulo. Torna i percorsi sul disco.
 *
 * Un modulo che non si legge ci sta dentro lo stesso: e' comunque un modulo che
 * il browser andra' a chiedere, e tenergli il precarico e' il verso giusto in
 * cui sbagliare. */
function ilGrafo(primo, cartella, legge) {
  const dentro = new Set();
  const coda = [primo];
  while (coda.length > 0 && dentro.size < AL_MASSIMO) {
    const qui = coda.shift();
    if (dentro.has(qui)) continue;
    dentro.add(qui);
    let testo;
    try {
      testo = legge(qui);
    } catch (_errore) {
      continue;
    }
    const dove = dirname(qui);
    for (const riferimento of iRiferimenti(testo)) {
      if (!eRelativo(riferimento)) continue;
      const dritto = resolve(dove, soloIlFile(riferimento));
      if (dentroLa(cartella, dritto)) coda.push(dritto);
    }
  }
  return dentro;
}

/* Gli indirizzi precaricati dalla pagina, come li ha scritti. Serve alle prove
 * e a dire in una riga quanti se ne sono tolti. */
export function iPrecarichi(testo) {
  const fuori = [];
  for (const riga of String(testo ?? "").match(UN_PRECARICO) || []) {
    const indirizzo = riga.match(IL_SUO_INDIRIZZO)?.[1];
    if (indirizzo) fuori.push(indirizzo);
  }
  return fuori;
}

/// La pagina senza i precarichi che nessuno importa.
///
/// `cartella` e' la radice della plancia, `relativo` la pagina dentro di essa
/// (`legacy/dashboard.html`). Con `legge` si da' un altro modo di leggere i
/// moduli, che e' come la si prova senza un disco.
export function senzaIPrecarichiMorti(testo, { cartella, relativo, legge = leggiDalDisco } = {}) {
  const pagina = String(testo ?? "");
  if (!cartella || !relativo) return pagina;

  const radice = resolve(cartella);
  const suDisco = resolve(radice, ...String(relativo).split("/"));
  if (!dentroLa(radice, suDisco)) return pagina;

  const partenza = pagina.match(IL_MODULO_DI_PARTENZA)?.[1];
  if (!partenza || !eRelativo(partenza)) return pagina;
  const primo = resolve(dirname(suDisco), soloIlFile(partenza));
  if (!dentroLa(radice, primo)) return pagina;

  const grafo = ilGrafo(primo, radice, legge);
  if (grafo.size < ALMENO_TANTI || grafo.size >= AL_MASSIMO) return pagina;

  return pagina.replace(UN_PRECARICO, (riga) => {
    const indirizzo = riga.match(IL_SUO_INDIRIZZO)?.[1];
    if (!indirizzo || !eRelativo(indirizzo)) return riga;
    const dove = resolve(dirname(suDisco), soloIlFile(indirizzo));
    if (!dentroLa(radice, dove) || grafo.has(dove)) return riga;
    return "";
  });
}
