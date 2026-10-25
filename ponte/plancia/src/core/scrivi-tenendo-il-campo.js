/* Riscrivere una pagina mentre qualcuno ci scrive dentro.
 *
 * «Io scrivo ma lo mette al contrario nel campo di ricerca, e continua a
 * lampeggiare.» A ogni lettera la pagina si riscriveva tutta (`innerHTML`),
 * compreso il campo dove si stava scrivendo. Il campo nuovo prendeva il fuoco
 * e il cursore, ma la tastiera del telefono stava componendo la parola nel
 * campo vecchio: la lettera dopo finiva in testa, la parola usciva rovesciata,
 * e qualche lettera raddoppiava. E tutta la pagina, rifatta da
 * capo, lampeggiava.
 *
 * Qui il campo che ha il fuoco non si tocca mai: si cambia solo quello che
 * gli sta intorno, nodo per nodo, e solo dove e' diverso. Se la forma della
 * pagina e' cambiata troppo per farlo (un pezzo in piu' o in meno attorno al
 * campo), si torna a riscrivere tutto e a rimettere fuoco e cursore, come
 * prima.
 */

/** Riscrive `contenitore` con `html` senza toccare `campo`, se ci riesce.
 * Torna `true` quando il campo e' rimasto quello di prima. */
export function scriviTenendoIlCampo(contenitore, html, campo) {
  if (!contenitore || !campo || !contenitore.contains?.(campo)) return false;
  const doc = contenitore.ownerDocument;
  const modello = doc.createElement("template");
  modello.innerHTML = html;
  const nuovo = modello.content;
  if (!stessaForma(contenitore, nuovo, campo)) return false;
  allinea(contenitore, nuovo, campo);
  return true;
}

/* Si puo' allineare se, lungo la strada che porta al campo, ogni nodo ha lo
 * stesso nome e lo stesso numero di figli: allora il campo ha un posto
 * preciso anche nella pagina nuova. */
function stessaForma(vecchio, nuovo, campo) {
  if (vecchio === campo) return nuovo.nodeName === campo.nodeName;
  const prima = vecchio.childNodes;
  const dopo = nuovo.childNodes;
  if (prima.length !== dopo.length) return false;
  for (let i = 0; i < prima.length; i += 1) {
    if (!prima[i].contains?.(campo)) continue;
    if (prima[i].nodeName !== dopo[i].nodeName) return false;
    return stessaForma(prima[i], dopo[i], campo);
  }
  return false;
}

function allinea(vecchio, nuovo, campo) {
  if (vecchio === campo) return;
  if (vecchio.nodeType === 1 && nuovo.nodeType === 1) copiaGliAttributi(vecchio, nuovo);
  const prima = [...vecchio.childNodes];
  const dopo = [...nuovo.childNodes];
  for (let i = 0; i < prima.length; i += 1) {
    if (prima[i].contains?.(campo)) {
      allinea(prima[i], dopo[i], campo);
    } else if (!prima[i].isEqualNode(dopo[i])) {
      prima[i].replaceWith(dopo[i]);
    }
  }
}

function copiaGliAttributi(vecchio, nuovo) {
  for (const { name } of [...vecchio.attributes]) {
    if (!nuovo.hasAttribute(name)) vecchio.removeAttribute(name);
  }
  for (const { name, value } of [...nuovo.attributes]) {
    if (vecchio.getAttribute(name) !== value) vecchio.setAttribute(name, value);
  }
}
