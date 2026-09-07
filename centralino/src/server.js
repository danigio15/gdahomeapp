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

const IMPRONTA_VALIDA = /^[0-9a-f]{64}$/;

function json(risposta, corpo, stato = 200) {
  const testo = JSON.stringify(corpo);
  risposta.writeHead(stato, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(testo),
    /* Il centralino lo chiama anche una versione web dell'app, da un'origine
     * qualunque. Non c'e' niente da difendere con l'origine: qui non ci sono
     * biscotti e nessuna autorita' implicita — chi bussa senza sapere niente
     * non ottiene niente. */
    "access-control-allow-origin": "*",
  });
  risposta.end(testo);
}

export const rotta = (richiesta) => new URL(richiesta.url || "/", "http://centralino").pathname;

export function costruisciIlServer({ centralino }) {
  const server = createServer((richiesta, risposta) => {
    if (rotta(richiesta) === "/salute" && richiesta.method === "GET") {
      json(risposta, {
        vivo: true,
        case: centralino.quanteCase(),
        telefoni: centralino.quantiTelefoni(),
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
