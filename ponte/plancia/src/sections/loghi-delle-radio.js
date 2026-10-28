/* I loghi delle radio: si mettono solo quando si sono caricati davvero.
 *
 * «Controlla che non carica tutte le icone»: il logo di una stazione di Radio
 * Browser e' l'icona del suo sito, e tante non ci sono piu', o sono `http`
 * dentro una pagina `https` — e il browser non le carica. Il logo andava
 * scritto subito come sfondo, e lo sfondo nascondeva il 📻: dove il logo non
 * arrivava restava un quadratino bianco, vuoto.
 *
 * Adesso il markup porta solo l'indirizzo (`data-dm-radio-logo`) e il 📻; il
 * logo si prova a parte e si mette come sfondo solo se arriva. Quelli che non
 * arrivano tengono il 📻. Come e' andata si ricorda, cosi' ridisegnando non si
 * richiede niente e non si vede lampeggiare.
 */

import { esc } from "./shared.js";

/** @type {Map<string, "si" | "no" | Promise<void>>} */
const COM_E_ANDATA = new Map();

/* Un indirizzo che sta in `url('…')` senza uscirne. */
const perLoSfondo = (url) => String(url || "").replace(/["'()\\\s]/g, (c) => encodeURIComponent(c));

/** Il segnaposto col 📻 (o con `dentro`, gia' HTML: il bollino di una radio
 * pronta) e, se c'e', l'indirizzo del logo da provare. */
export function logoDellaRadioMarkup(logo, classe, { dentro = "📻", stile = "" } = {}) {
  const url = perLoSfondo(logo);
  return `<span class="${classe}" aria-hidden="true"${stile ? ` style="${esc(stile)}"` : ""}${url ? ` data-dm-radio-logo="${esc(url)}"` : ""}>${dentro}</span>`;
}

function mettiLoSfondo(segnaposto, url) {
  if (segnaposto.isConnected !== false) segnaposto.style.backgroundImage = `url('${url}')`;
}

function prova(url) {
  const andata = COM_E_ANDATA.get(url);
  if (andata) return andata;
  const attesa = new Promise((fatto) => {
    const immagine = new Image();
    immagine.referrerPolicy = "no-referrer";
    immagine.onload = () => {
      COM_E_ANDATA.set(url, immagine.naturalWidth > 0 ? "si" : "no");
      fatto();
    };
    immagine.onerror = () => {
      COM_E_ANDATA.set(url, "no");
      fatto();
    };
    immagine.src = url;
  });
  COM_E_ANDATA.set(url, attesa);
  return attesa;
}

/** Dentro `contenitore`, a ogni segnaposto il suo logo, se arriva. */
export function mettiILoghiDelleRadio(contenitore) {
  if (typeof Image !== "function") return;
  for (const segnaposto of contenitore?.querySelectorAll?.("[data-dm-radio-logo]") || []) {
    const url = segnaposto.dataset.dmRadioLogo;
    const andata = COM_E_ANDATA.get(url);
    if (andata === "si") mettiLoSfondo(segnaposto, url);
    else if (andata !== "no")
      void prova(url).then(() => {
        if (COM_E_ANDATA.get(url) === "si") mettiLoSfondo(segnaposto, url);
      });
  }
}
