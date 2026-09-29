/* La ricevuta di chi compra fuori casa: `POST /licenza/<casa_…>`.
 *
 * Premium si compra dall'app, e la ricevuta del negozio deve arrivare alla
 * casa: e' lei che la porta al quadro, e il quadro che le da' il gettone
 * (`docs/LICENZE.md`). Di solito arriva sul filo cifrato col telefono. Ma chi
 * compra fuori casa lo fa proprio perche' da fuori la casa non gli si apre —
 * con la chiave delle licenze il centralino chiude i telefoni delle case Base
 * — e un filo su cui mandarla non ce l'ha. Senza questa porta avrebbe pagato
 * e non gli si sarebbe aperto niente fino al rientro a casa.
 *
 * Qui la ricevuta si consegna al centralino, e il centralino la gira alla casa
 * sul suo filo (`Centralino.portaLaRicevuta`) e aspetta la risposta. Dentro
 * non guarda: il corpo e' della casa. La casa controlla che l'abbia firmata un
 * telefono abbinato a lei — con la chiave del filo, che al centralino non e'
 * mai passata — e solo allora la porta al quadro. Chi bussa qui senza essere
 * uno dei suoi telefoni non ottiene niente.
 *
 *   POST /licenza/<casa_…>   {v, chi, quando, app, piattaforma, prodotto, ricevuta, firma}
 *
 * Risponde con lo stato e il corpo della casa: `200` con la licenza della
 * casa, com'e' dopo la ricevuta; i no con `{errore}`. Quelli di qui: `503
 * casa-non-collegata` (si riprova piu' tardi), `426 aggiorna-add-on` (la casa
 * ha l'add-on di prima, e una ricevuta non la saprebbe tenere), `504
 * la-casa-non-risponde`, `429` troppe in poco tempo.
 */

import { CASA_VALIDA } from "./case.js";
import { Freno } from "./freno.js";
import { daChi } from "./indirizzo.js";
import { RichiestaSbagliata } from "./segnalazioni.js";
import { byteDi, json } from "./sportello.js";

const VIA = /^\/licenza\/([A-Za-z0-9_]+)$/;

/* Una ricevuta dell'App Store e' un numero, una di Google un gettone di
 * qualche centinaio di caratteri: sedici kilobyte sono il tetto del quadro
 * per lo stesso corpo, e oltre non ci arriverebbe comunque. */
export const RICEVUTA_MASSIMA = 16 * 1024;

/* Quante ricevute in un'ora, da uno stesso indirizzo e in tutto. Chi compra
 * ne manda una, due se la rete cade; il tetto e' per chi bussa a ripetizione,
 * che altrimenti farebbe lavorare le case e il quadro per niente. */
export const RICEVUTE_PER_INDIRIZZO = 30;
export const RICEVUTE_IN_TUTTO = 3000;

export class Ricevute {
  constructor({
    centralino,
    registro = null,
    freno = new Freno({ perChi: RICEVUTE_PER_INDIRIZZO, inTutto: RICEVUTE_IN_TUTTO }),
  }) {
    this.centralino = centralino;
    this.registro = registro;
    this.freno = freno;
  }

  /* Se la via e' questa, risponde e torna `true`; se no `false`, e passa. */
  async forseServe(richiesta, risposta, via) {
    const trovata = VIA.exec(via);
    if (!trovata) return false;
    if (richiesta.method !== "POST") {
      risposta.setHeader("allow", "POST");
      json(risposta, { errore: "solo-post" }, 405);
      return true;
    }
    const casa = trovata[1];
    if (!CASA_VALIDA.test(casa)) {
      json(risposta, { errore: "casa-non-valida" }, 400);
      return true;
    }
    if (!this.freno.concedi(daChi(richiesta))) {
      risposta.setHeader("retry-after", "600");
      json(risposta, { errore: "troppe-ricevute" }, 429);
      return true;
    }
    let corpo;
    try {
      corpo = JSON.parse((await byteDi(richiesta, RICEVUTA_MASSIMA)).toString("utf8"));
    } catch (errore) {
      if (errore instanceof RichiestaSbagliata) {
        json(risposta, { errore: "ricevuta-troppo-grande" }, errore.stato);
        return true;
      }
      json(risposta, { errore: "non-json" }, 400);
      return true;
    }
    if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) {
      json(risposta, { errore: "non-json" }, 400);
      return true;
    }
    const { stato, corpo: detto } = await this.centralino.portaLaRicevuta(casa, corpo);
    if (stato >= 500) this.registro?.attenzione?.(`una ricevuta per una casa: ${stato}`);
    json(risposta, detto, stato);
    return true;
  }
}
