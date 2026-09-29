/* Il foglio dei segni: dipinge i segnaposti `<i class="dm-segno">`.
 *
 * Il segnaposto e' vuoto e resta vuoto: il disegno lo mette il foglio, come
 * immagine di sfondo. Cosi' il guscio, che scrive le sue linguette in HTML, e
 * le sezioni che confrontano il proprio markup prima di riscriverlo non vedono
 * mai cambiare niente — nessuno ridisegna per colpa nostra.
 *
 * Il foglio non porta tutto il catalogo: sono piu' di centottanta disegni, e
 * una pagina ne usa una ventina. Una regola si aggiunge la prima volta che un
 * segnaposto con quel nome compare nel documento.
 */
import {
  emojiInSegni,
  segnoDaValoreHtml,
  segnoHtml,
  senzaEmoji,
  svgDelSegno,
} from "../core/segni-del-catalogo.js";
import { doc, root } from "./shared.js";

const ID_BASE = "dm-segni-base";
const ID_REGOLE = "dm-segni-regole";

const state = { installed: false, scritti: new Set(), osservatore: null };

const BASE = `
.dm-segno{display:inline-block;flex:0 0 auto;width:var(--dm-segno,1.15em);height:var(--dm-segno,1.15em);vertical-align:-.22em;background:center/contain no-repeat;font-style:normal;line-height:1}
`;

function foglio(id) {
  let nodo = doc.getElementById(id);
  if (!nodo) {
    nodo = doc.createElement("style");
    nodo.id = id;
    (doc.head || doc.documentElement).append(nodo);
  }
  return nodo;
}

/** La regola CSS di una chiave: il disegno come immagine, codificato. */
export function regolaDelSegno(chiave) {
  const svg = svgDelSegno(chiave);
  if (!svg) return "";
  const dato = encodeURIComponent(svg).replace(/'/g, "%27").replace(/"/g, "%22");
  return `.dm-segno[data-dm-segno="${chiave}"]{background-image:url("data:image/svg+xml,${dato}")}`;
}

/** Aggiunge al foglio le regole dei segnaposti che sono nel documento. */
export function dipingiISegni(radice = doc) {
  if (!radice?.querySelectorAll) return 0;
  const nuove = [];
  const nodi = [...radice.querySelectorAll("[data-dm-segno]")];
  if (radice.matches?.("[data-dm-segno]")) nodi.push(radice);
  for (const nodo of nodi) {
    const chiave = nodo.dataset.dmSegno;
    if (!chiave || state.scritti.has(chiave)) continue;
    state.scritti.add(chiave);
    const regola = regolaDelSegno(chiave);
    if (regola) nuove.push(regola);
  }
  if (nuove.length) foglio(ID_REGOLE).append(doc.createTextNode(`${nuove.join("\n")}\n`));
  return nuove.length;
}

export function installSegniDelCatalogoSection() {
  if (!doc || state.installed) return false;
  state.installed = true;
  /* Il guscio e' uno script classico, e non importa moduli: le stesse
   * funzioni le trova sulla finestra. */
  root.dmSegno = segnoHtml;
  root.dmSegnoDaValore = segnoDaValoreHtml;
  root.dmEmojiInSegni = emojiInSegni;
  root.dmSenzaEmoji = senzaEmoji;
  foglio(ID_BASE).textContent = BASE;
  dipingiISegni(doc);
  const Osservatore = root.MutationObserver;
  if (typeof Osservatore === "function" && doc.documentElement) {
    state.osservatore = new Osservatore((cambi) => {
      for (const cambio of cambi) {
        if (cambio.type === "attributes") dipingiISegni(cambio.target);
        else for (const nodo of cambio.addedNodes) if (nodo.nodeType === 1) dipingiISegni(nodo);
      }
    });
    state.osservatore.observe(doc.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-dm-segno"],
    });
  }
  return true;
}
