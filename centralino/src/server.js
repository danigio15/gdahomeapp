/* La porta del centralino.
 *
 * Tre vie, e nient'altro. Chi bussa altrove non trova niente.
 *
 *   GET  /salute                      dice solo che e' vivo
 *   WS   /casa/<casa_…>              una casa che chiama fuori
 *   WS   /telefono/<casa_…>           un telefono che va alla sua casa
 *   WS   /abbinamento/<impronta>      un telefono che si sta abbinando
 *
 * L'identificativo della casa sta nell'indirizzo e non e' un segreto: serve a
 * instradare. Il segno — quello che fa entrare davvero — viaggia dentro il
 * filo, verso la casa, che e' l'unica che lo puo' verificare.
 */

import { createServer } from "node:http";

import { CASA_VALIDA } from "./case.js";
import { MESSAGGIO_MASSIMO } from "./centralino.js";
import { accetta, eUnaSalita } from "./presa.js";
import { json } from "./sportello.js";

const IMPRONTA_VALIDA = /^[0-9a-f]{64}$/;

export const rotta = (richiesta) => new URL(richiesta.url || "/", "http://centralino").pathname;

export function costruisciIlServer({ centralino, sportello = null, acceso = Date.now() }) {
  const server = createServer((richiesta, risposta) => {
    const via = rotta(richiesta);

    /* `/salute` dice tre cose, e sono le tre che servono quando qualcosa non
     * va: che e' vivo, da quanto — un numero piccolo dopo che nessuno ha
     * toccato niente vuol dire che si e' riacceso da solo — e se le
     * segnalazioni hanno il loro gettone. */
    if (via === "/salute" && richiesta.method === "GET") {
      json(risposta, {
        vivo: true,
        acceso_da: Math.round((Date.now() - acceso) / 1000),
        case: centralino.quanteCase(),
        telefoni: centralino.quantiTelefoni(),
        segnalazioni: Boolean(sportello?.pronto),
      });
      return;
    }

    /* Lo sportello: le vie che non sono del filo. E' lento per mestiere — un
     * corpo da leggere, GitHub da aspettare — quindi la risposta arriva dopo,
     * e il 404 si dice solo se la via non era sua. */
    if (sportello) {
      sportello
        .forseServe(richiesta, risposta, via)
        .then((suo) => {
          if (!suo) json(risposta, { errore: "qui non c'e' niente" }, 404);
        })
        .catch((errore) => {
          if (risposta.headersSent) {
            risposta.end();
            return;
          }
          json(
            risposta,
            { errore: "centralino", spiegazione: String(errore?.message || errore) },
            500,
          );
        });
      return;
    }

    json(risposta, { errore: "qui non c'e' niente" }, 404);
  });

  server.on("upgrade", (richiesta, socket) => {
    const via = rotta(richiesta);
    if (!eUnaSalita(richiesta)) {
      socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
      return;
    }
    const da = socket.remoteAddress || "?";

    /* `/casa` e `/casa/<casa_…>` sono la stessa porta. L'identificativo
     * nell'indirizzo qui non serve — chi decide e' il `sono-io` che arriva
     * subito dopo, ed e' l'unico che porta anche il segreto — ma il centralino
     * sulla nuvola ne ha bisogno per sapere a quale casa consegnare il filo
     * prima ancora di accettarlo. Le due punte parlano la stessa lingua a
     * tutti e due. */
    if (via === "/casa" || /^\/casa\/[A-Za-z0-9_]+$/.test(via)) {
      const presa = accetta(richiesta, socket, { messaggioMassimo: MESSAGGIO_MASSIMO });
      if (presa) centralino.accogliUnaCasa(presa, { da });
      return;
    }

    const alTelefono = /^\/telefono\/([A-Za-z0-9_]+)$/.exec(via);
    if (alTelefono && CASA_VALIDA.test(alTelefono[1])) {
      const presa = accetta(richiesta, socket, { messaggioMassimo: MESSAGGIO_MASSIMO });
      if (presa) centralino.accogliUnTelefono(presa, { casa: alTelefono[1], da });
      return;
    }

    const inAbbinamento = /^\/abbinamento\/([0-9a-f]+)$/.exec(via);
    if (inAbbinamento && IMPRONTA_VALIDA.test(inAbbinamento[1])) {
      const presa = accetta(richiesta, socket, { messaggioMassimo: MESSAGGIO_MASSIMO });
      if (presa) centralino.accogliUnAbbinamento(presa, { impronta: inAbbinamento[1], da });
      return;
    }

    socket.end("HTTP/1.1 404 Not Found\r\n\r\n");
  });

  return server;
}
