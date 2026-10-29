/* La finestra del widget Salute (vedi `../finestre-dei-widget.js`).
 *
 * I passi di oggi con l'anello dell'obiettivo, le misure della prima persona
 * e, se c'e', questa settimana di Strava con le ultime attivita'. I grafici e
 * lo storico stanno nella pagina Salute, a un tocco da «Apri sezione».
 *
 * La vista arriva gia' fatta dal modello della tessera (`saluteModel`).
 */
import { registraFinestra } from "../finestre-dei-widget.js";
import { finestraSaluteMarkup, foglioSalute, sottotitoloSalute } from "../salute-section.js";

const P = ":is(#dm-widget-popup,#dm-casa-popup,#dm-qa-popup)";

registraFinestra("salute", {
  disegna: (w) => finestraSaluteMarkup(w.vista),
  sottotitolo: (w) => sottotitoloSalute(w.vista),
  stile: foglioSalute(P),
});
