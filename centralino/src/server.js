/* La porta del centralino.
 *
 * Poche vie, e chi bussa altrove non trova niente.
 *
 *   GET  /                            la soglia: cos'e' questo indirizzo
 *   GET  /salute                      dice solo che e' vivo (e di piu' a chi guarda da dentro)
 *   GET  /console/                    la console della chat, e le sue vie
 *   POST /contatto                    il modulo «Contatti» del sito, che Caddy passa qui
 *   WS   /casa/<casa_…>              una casa che chiama fuori
 *   WS   /telefono/<casa_…>           un telefono che va alla sua casa
 *   WS   /abbinamento/<impronta>      un telefono che si sta abbinando
 *
 * La prima e' l'unica che non serve a niente di tecnico, ed e' quella che
 * mancava: l'indirizzo del centralino uno se lo tiene fra i segnalibri e lo
 * apre nudo, e trovarci un errore in JSON vuol dire crederlo rotto.
 *
 * L'identificativo della casa sta nell'indirizzo e non e' un segreto: serve a
 * instradare. Il segno — quello che fa entrare davvero — viaggia dentro il
 * filo, verso la casa, che e' l'unica che lo puo' verificare.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";

import { CASA_VALIDA } from "./case.js";
import { MESSAGGIO_DEL_TELEFONO, MESSAGGIO_MASSIMO } from "./centralino.js";
import { daChi, eDaDentro, reteDi } from "./indirizzo.js";
import { accetta, eUnaSalita } from "./presa.js";
import { laSoglia } from "./soglia.js";
import { json } from "./sportello.js";

const IMPRONTA_VALIDA = /^[0-9a-f]{64}$/;

/* La console della chat: una pagina sola, servita da qui.
 *
 * Sta sulla macchina e non porta niente da fuori. Si legge dal disco al primo
 * che la chiede e poi resta in memoria: sono venti kilobyte, e chi apre la
 * console la apre dieci volte al giorno. */
const PAGINA_DELLA_CONSOLE = new URL("../console/index.html", import.meta.url);
let paginaDellaConsole;
let regoleDellaConsole = "";

/* Le regole che il browser fa rispettare alla pagina della console.
 *
 * La console apre tutte le conversazioni, e la sua chiave passa dalla pagina:
 * il browser deve eseguire **quello** script e nessun altro. Lo script e lo
 * stile stanno dentro la pagina, e si dicono per impronta — SHA-256 del loro
 * testo esatto, calcolata qui quando la pagina si legge — cosi' uno script
 * infilato da qualche parte non gira, perche' la sua impronta non e' questa.
 * La pagina parla solo con questo indirizzo, e non si lascia mettere dentro
 * un riquadro di nessun altro. */
function regoleDellaPagina(pagina) {
  const impronte = (etichetta) =>
    [...pagina.matchAll(new RegExp(`<${etichetta}>([\\s\\S]*?)</${etichetta}>`, "g"))]
      .map((uno) => `'sha256-${createHash("sha256").update(uno[1], "utf8").digest("base64")}'`)
      .join(" ");
  return [
    "default-src 'none'",
    `script-src ${impronte("script") || "'none'"}`,
    `style-src ${impronte("style") || "'none'"}`,
    "connect-src 'self'",
    "img-src 'self' data:",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
}

function laConsole(risposta) {
  try {
    if (paginaDellaConsole === undefined) {
      paginaDellaConsole = readFileSync(PAGINA_DELLA_CONSOLE);
      regoleDellaConsole = regoleDellaPagina(paginaDellaConsole.toString("utf8"));
    }
  } catch (_errore) {
    paginaDellaConsole = null;
  }
  if (!paginaDellaConsole) {
    json(risposta, { errore: "la console non c'e'" }, 404);
    return;
  }
  risposta.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    "content-length": paginaDellaConsole.length,
    "content-security-policy": regoleDellaConsole,
  });
  risposta.end(paginaDellaConsole);
}

/* Quello che vale per ogni risposta, qualunque porta la dia.
 *
 * Nessuna pagina di qui si mette dentro un riquadro altrui; nessun file si
 * legge per quello che il browser indovina invece che per quello che e'; e
 * l'indirizzo da cui si arriva non si racconta a nessuno. Le regole di
 * difetto non lasciano girare niente: la soglia e la pagina dei contatti non
 * hanno script, e la console — l'unica che ne ha — ha le sue. */
const INTESTAZIONI_DI_SEMPRE = Object.freeze({
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
  "content-security-policy":
    "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
});

export const rotta = (richiesta) => new URL(richiesta.url || "/", "http://centralino").pathname;

export function costruisciIlServer({
  centralino,
  sportello = null,
  chat = null,
  /* Il modulo dei contatti del sito, e la posta con cui spedisce. Senza, la
   * via risponde lo stesso e dice che non e' configurata. */
  contatti = null,
  registro = null,
  acceso = Date.now(),
  /* Come si chiamano il sito e l'app di questo centralino, per la soglia.
   * Quello che non si sa non si inventa: la riga non compare. */
  dove = {},
}) {
  const soglia = Buffer.from(laSoglia(dove), "utf8");
  const server = createServer((richiesta, risposta) => {
    for (const [nome, valore] of Object.entries(INTESTAZIONI_DI_SEMPRE)) {
      risposta.setHeader(nome, valore);
    }
    const indirizzo = new URL(richiesta.url || "/", "http://centralino");
    const via = indirizzo.pathname;

    /* La soglia. Anche a testa in giu' — `curl -I` — perche' e' la prima cosa
     * che si prova quando si controlla se un indirizzo risponde. */
    if (
      (via === "/" || via === "/index.html") &&
      (richiesta.method === "GET" || richiesta.method === "HEAD")
    ) {
      risposta.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "content-length": soglia.length,
      });
      risposta.end(richiesta.method === "HEAD" ? undefined : soglia);
      return;
    }

    /* `/salute` dice tre cose, e sono le tre che servono quando qualcosa non
     * va: che e' vivo, da quanto — un numero piccolo dopo che nessuno ha
     * toccato niente vuol dire che si e' riacceso da solo — e se le
     * segnalazioni hanno il loro gettone. `posta` dice se il modulo dei
     * contatti del sito ha un server di posta con cui spedire.
     *
     * **Da fuori ne dice due**: che e' vivo e da quanto. Il secondo serve a
     * chi sposta il segno del tramite (il riassunto del bottone «Il tramite»
     * su Actions dice di guardare `acceso_da`). Quante case e quanti telefoni
     * ci sono, e cosa e' acceso e cosa no, non servono a chi passa: li vede
     * chi guarda dalla macchina stessa — `curl` da dentro, lo script che la
     * accende, le prove — cioe' chi arriva senza passare da Caddy. */
    if (via === "/salute" && richiesta.method === "GET") {
      if (!eDaDentro(richiesta)) {
        json(risposta, { vivo: true, acceso_da: Math.round((Date.now() - acceso) / 1000) });
        return;
      }
      json(risposta, {
        vivo: true,
        acceso_da: Math.round((Date.now() - acceso) / 1000),
        case: centralino.quanteCase(),
        telefoni: centralino.quantiTelefoni(),
        segnalazioni: Boolean(sportello?.pronto),
        chat: chat ? { linee: chat.archivio.quanteLinee(), console: chat.consoleAperta } : false,
        posta: Boolean(contatti?.pronto),
      });
      return;
    }

    /* La pagina della console. Le vie `/console/conversazioni…` sono della
     * chat e passano di sotto: questa e' soltanto la pagina che le chiama. */
    if ((via === "/console" || via === "/console/") && richiesta.method === "GET") {
      laConsole(risposta);
      return;
    }

    /* Le porte lente, una in fila all'altra: la chat, lo sportello e il modulo
     * dei contatti leggono un corpo, aspettano un archivio, GitHub o un server
     * di posta, e la risposta arriva dopo. La prima che riconosce la via
     * risponde; se nessuna la riconosce e' un 404.
     *
     * L'errore che scappa da qui non racconta niente a chi bussa: il motivo
     * vero finisce nel registro, non nella risposta. */
    (async () => {
      if (chat && (await chat.forseServe(richiesta, risposta, indirizzo))) return;
      if (sportello && (await sportello.forseServe(richiesta, risposta, via))) return;
      if (contatti && (await contatti.forseServe(richiesta, risposta, via))) return;
      json(risposta, { errore: "qui non c'e' niente" }, 404);
    })().catch((errore) => {
      registro?.errore?.(`una porta e' inciampata: ${errore?.stack || errore}`);
      if (risposta.headersSent) {
        risposta.end();
        return;
      }
      json(risposta, { errore: "centralino" }, 500);
    });
  });

  /* Se chi legge un messaggio inciampa, il filo si chiude — e il motivo va
   * **scritto qui**. Prima finiva in un `catch` vuoto dentro la presa: la casa
   * vedeva cadere il filo, ribussava dopo un minuto, e in nessuno dei due
   * registri c'era una riga. Un guasto dentro di noi travestito da guasto di
   * rete e' la cosa piu' costosa da cercare. */
  const ilGuasto = (dove) => (errore) =>
    registro?.errore?.(`${dove}: ${errore?.stack || errore?.message || errore}`);

  server.on("upgrade", (richiesta, socket) => {
    const via = rotta(richiesta);
    if (!eUnaSalita(richiesta)) {
      socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
      return;
    }
    /* Da chi arriva: quello vero, anche dietro Caddy. Serve a contare i fili
     * per indirizzo, ed e' quello che la casa si vede dire all'apertura di un
     * canale — lo stesso che le dice il centralino sulla nuvola. */
    const da = daChi(richiesta);
    /* I fili si contano per rete (in IPv6 un /64 intero e' di una persona
     * sola), ma alla casa si dice l'indirizzo com'e'. */
    const rete = reteDi(da);
    if (centralino.cePostoPer && !centralino.cePostoPer(rete)) {
      socket.end("HTTP/1.1 503 Service Unavailable\r\nretry-after: 30\r\n\r\n");
      return;
    }
    const contaLaPresa = (presa) => {
      if (!presa || !centralino.unaPresaIn) return presa;
      const andata = centralino.unaPresaIn(rete);
      socket.once("close", andata);
      return presa;
    };

    /* `/casa` e `/casa/<casa_…>` sono la stessa porta. L'identificativo
     * nell'indirizzo qui non serve — chi decide e' il `sono-io` che arriva
     * subito dopo, ed e' l'unico che porta anche il segreto — ma il centralino
     * sulla nuvola ne ha bisogno per sapere a quale casa consegnare il filo
     * prima ancora di accettarlo. Le due punte parlano la stessa lingua a
     * tutti e due. */
    if (via === "/casa" || /^\/casa\/[A-Za-z0-9_]+$/.test(via)) {
      const presa = contaLaPresa(
        accetta(richiesta, socket, {
          messaggioMassimo: MESSAGGIO_MASSIMO,
          onGuasto: ilGuasto("una casa"),
        }),
      );
      if (presa) centralino.accogliUnaCasa(presa, { da });
      return;
    }

    const alTelefono = /^\/telefono\/([A-Za-z0-9_]+)$/.exec(via);
    if (alTelefono && CASA_VALIDA.test(alTelefono[1])) {
      const presa = contaLaPresa(
        accetta(richiesta, socket, {
          messaggioMassimo: MESSAGGIO_DEL_TELEFONO,
          onGuasto: ilGuasto("un telefono"),
        }),
      );
      if (presa) centralino.accogliUnTelefono(presa, { casa: alTelefono[1], da });
      return;
    }

    const inAbbinamento = /^\/abbinamento\/([0-9a-f]+)$/.exec(via);
    if (inAbbinamento && IMPRONTA_VALIDA.test(inAbbinamento[1])) {
      const presa = contaLaPresa(
        accetta(richiesta, socket, {
          messaggioMassimo: MESSAGGIO_DEL_TELEFONO,
          onGuasto: ilGuasto("un abbinamento"),
        }),
      );
      if (presa) centralino.accogliUnAbbinamento(presa, { impronta: inAbbinamento[1], da });
      return;
    }

    socket.end("HTTP/1.1 404 Not Found\r\n\r\n");
  });

  return server;
}
