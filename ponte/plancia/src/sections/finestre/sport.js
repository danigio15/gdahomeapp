/* La finestra del widget Sport (vedi `../finestre-dei-widget.js`).
 *
 * Un riquadro per ogni cosa seguita, col pezzo che conta: per la squadra la
 * partita — in corso, la prossima o l'ultima — con la forma recente; per la
 * Formula 1 e la MotoGP il prossimo gran premio con gli orari e l'ultimo
 * podio. Le classifiche intere stanno nella pagina Sport, a un tocco da «Apri
 * sezione».
 *
 * I risultati arrivano gia' fatti dal modello della tessera (`sportModel`),
 * che li prende dalla pagina Sport: qui non si chiede niente a nessuno.
 */
import { registraFinestra } from "../finestre-dei-widget.js";
import { finestraDelloSportMarkup, foglioDelloSport } from "../sport-section.js";

const P = ":is(#dm-widget-popup,#dm-casa-popup,#dm-qa-popup)";

registraFinestra("sport", {
  disegna: (w) => finestraDelloSportMarkup(w.vista, w.minuto),
  sottotitolo: (w) => w.caption || "",
  stile: foglioDelloSport(P),
});
