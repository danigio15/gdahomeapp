/* L'anteprima della plancia, nel Config (#379): le regole, senza documento.
 *
 * «Il drag e drop non deve essere sulla plancia: ti avevo detto di creare
 * un'anteprima nel Config dove si fa questa cosa.» Nel Config, nella scheda
 * di una sezione, c'e' la sezione vera dentro una cornice larga quanto il
 * telefono o quanto il computer: dentro si spostano i riquadri, gli elementi
 * e i pezzi dei disegni, e «Salva» li scrive. Qui stanno le cose che si
 * possono dire senza una pagina: quale sezione ha l'anteprima in quale
 * scheda, quanto e' grande ogni schermo, quanto va rimpicciolito per stare
 * nella colonna, e come si prepara il documento della cornice.
 */

/** Gli schermi dell'anteprima: la larghezza e l'altezza in cui la pagina si
 * dispone. Il telefono e' quello delle prove (390 × 844), il computer uno
 * schermo da portatile. */
export const SCHERMI = Object.freeze({
  telefono: Object.freeze({ larghezza: 390, altezza: 844 }),
  computer: Object.freeze({ larghezza: 1280, altezza: 860 }),
});

export const DISPOSITIVI = Object.freeze(Object.keys(SCHERMI));

/** Le schede del Config che hanno l'anteprima, e la pagina della plancia che
 * mostrano. I nomi vecchi delle schede (`sez1`) sono gli stessi di quelli
 * nuovi (`energy`). */
export const PAGINE_DELLE_SCHEDE = Object.freeze({
  sez1: "energy",
  energy: "energy",
  sez4: "security",
  security: "security",
});

/** La pagina della plancia che una scheda del Config mostra in anteprima, o
 * "" se quella scheda non ne ha. */
export function paginaDellaScheda(scheda) {
  const chiave = String(scheda || "").trim();
  return Object.prototype.hasOwnProperty.call(PAGINE_DELLE_SCHEDE, chiave)
    ? PAGINE_DELLE_SCHEDE[chiave]
    : "";
}

/** Lo schermo di un dispositivo: un nome sconosciuto e' il computer. */
export function schermoDi(dispositivo) {
  return SCHERMI[dispositivo] || SCHERMI.computer;
}

/** Il primo schermo da mostrare: quello di chi sta configurando. */
export function dispositivoDiPartenza(larghezzaDellaFinestra) {
  const w = Number(larghezzaDellaFinestra);
  return Number.isFinite(w) && w > 0 && w < 720 ? "telefono" : "computer";
}

/** Quanto rimpicciolire lo schermo perche' stia tutto davanti: largo quanto
 * la colonna e, se si sa, alto quanto c'e' posto — lo schermo intero si vede
 * senza far scorrere il Config, e dentro si scorre come su un telefono vero.
 * Mai piu' grande del vero, mai cosi' piccolo da non poterci mettere un dito. */
export function scalaPer(larghezzaDellaColonna, dispositivo, altezzaDisponibile = 0) {
  const { larghezza, altezza } = schermoDi(dispositivo);
  const colonna = Number(larghezzaDellaColonna);
  if (!Number.isFinite(colonna) || colonna <= 0) return 1;
  let scala = Math.min(1, colonna / larghezza);
  const alto = Number(altezzaDisponibile);
  if (Number.isFinite(alto) && alto > 0) scala = Math.min(scala, alto / altezza);
  return Math.max(0.3, scala);
}

/** Il guscio della plancia per una lingua: l'italiano ha il suo, tutte le
 * altre lingue partono da quello inglese (come in `legacy/host.js`). */
export function guscioPerLaLingua(lingua) {
  return /^it(\b|[-_]|$)/i.test(String(lingua || "").trim())
    ? "dashboard.html"
    : "dashboard-en.html";
}

const ATTRIBUTO = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");

/** Il documento della cornice, quando la plancia di fuori non ha un
 * indirizzo da ricaricare (dentro Home Assistant vive in `about:srcdoc`): il
 * guscio letto dal suo posto, con l'indirizzo da cui prendere i suoi file e la
 * lingua di chi guarda. Chi rende la cornice un'anteprima e' il guscio stesso
 * (`storage-namespace.js`), che legge il segno sulla cornice. */
export function documentoDellAnteprima(html, { base = "", lingua = "" } = {}) {
  let testo = String(html || "");
  const codice = String(lingua || "").trim();
  if (codice)
    testo = testo.replace(
      /<html\b[^>]*>/i,
      (tag) => `${tag.replace(/\slang="[^"]*"/i, "").slice(0, -1)} lang="${ATTRIBUTO(codice)}">`,
    );
  if (base && !/<base\s/i.test(testo)) {
    const segno = `<base href="${ATTRIBUTO(base)}">`;
    testo = /<head(?:\s[^>]*)?>/i.test(testo)
      ? testo.replace(/<head(?:\s[^>]*)?>/i, (testa) => `${testa}${segno}`)
      : `${segno}${testo}`;
  }
  return testo;
}

/** Il segno che la cornice porta: la pagina e lo schermo. */
export function segnoDellaCornice(pagina, dispositivo) {
  return `${String(pagina || "")}:${DISPOSITIVI.includes(dispositivo) ? dispositivo : "computer"}`;
}
