/* Le due porte.
 *
 * `console` sta dietro l'ingress di Home Assistant, che ci mette davanti la
 * propria autenticazione: chi non e' entrato in Home Assistant non arriva qui.
 * E' l'unico posto dove nasce un codice di abbinamento e dove si stacca un
 * telefono.
 *
 * `app` e' la porta su cui bussa il telefono, ed e' l'unica che puo' finire
 * esposta a internet. Quello che si puo' fare da li' e' scritto in tre righe:
 * chiedere se il ponte e' vivo, presentare un codice di abbinamento, aprire il
 * filo con un segno gia' avuto. Nient'altro esiste su quella porta.
 */

import { createReadStream, existsSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

import { CodiceSbagliato, TroppiTentativi } from "./abbinamento.js";
import { TroppiDispositivi } from "./dispositivi.js";
import { accetta, eUnaSalita } from "./presa.js";
import { impronta } from "./segreti.js";

/* Un corpo piu' grande di cosi' non e' un abbinamento. */
const CORPO_MASSIMO = 4 * 1024;

const TIPI = Object.freeze({
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
});

/* ─── Le risposte ────────────────────────────────────────────────────────── */

/* Le intestazioni che fanno passare un browser.
 *
 * Servono a una cosa sola: far parlare col ponte una versione **web** dell'app
 * — quella che gira nel collaudo dal vivo, e quella che un giorno potrebbe
 * stare su un tablet appeso al muro. Un'app vera, quella installata, di CORS
 * non sa niente e non gli serve.
 *
 * Perche' l'origine aperta qui non e' un buco, detto per esteso: su questa
 * porta ogni sportello vuole o un codice di abbinamento valido — che vive
 * cinque minuti, si usa una volta, e nasce solo dietro l'autenticazione di
 * Home Assistant — o un segno gia' avuto, che viaggia nel corpo e non in un
 * biscotto. Non c'e' nessuna autorita' implicita: niente cookie, niente
 * sessione del browser, niente che una pagina qualunque possa sfruttare per
 * conto di chi la guarda. Una pagina cattiva con queste intestazioni puo' fare
 * esattamente quello che puo' gia' fare `curl`, cioe' bussare senza sapere
 * niente. Quello che tiene la porta chiusa e' il codice e il segno, non
 * l'origine. */
const PER_IL_BROWSER = Object.freeze({
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "600",
});

function json(risposta, corpo, stato = 200) {
  const testo = JSON.stringify(corpo);
  risposta.writeHead(stato, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(testo),
  });
  risposta.end(testo);
}

const male = (risposta, stato, perche) => json(risposta, { errore: perche }, stato);

async function corpoDiJson(richiesta) {
  let quanto = 0;
  const pezzi = [];
  for await (const pezzo of richiesta) {
    quanto += pezzo.length;
    if (quanto > CORPO_MASSIMO) throw new CorpoTroppoGrande("il corpo e' troppo grande");
    pezzi.push(pezzo);
  }
  if (!pezzi.length) return {};
  try {
    const letto = JSON.parse(Buffer.concat(pezzi).toString("utf8"));
    return letto && typeof letto === "object" ? letto : {};
  } catch (_errore) {
    throw new CorpoIllegibile("il corpo non e' JSON");
  }
}

export class CorpoTroppoGrande extends Error {}
export class CorpoIllegibile extends Error {}

export const rotta = (richiesta) => {
  /* Sotto ingress l'indirizzo arriva con davanti un prefisso che cambia a ogni
   * riavvio di Home Assistant — `/api/hassio_ingress/<gettone>/`. Quel
   * prefisso lo dice Home Assistant stessa in `X-Ingress-Path`, ed e' l'unico
   * modo giusto di toglierlo: cercare a mano un pezzo noto dentro il percorso
   * non funziona, perche' il prefisso comincia a sua volta con `/api/`. */
  const intero = new URL(richiesta.url || "/", "http://ponte").pathname;
  const prefisso = String(richiesta.headers?.["x-ingress-path"] || "");
  if (prefisso && intero.startsWith(prefisso)) return intero.slice(prefisso.length) || "/";
  return intero;
};

/* ─── La porta dell'app ──────────────────────────────────────────────────── */

export function costruisciLaPortaDellApp({
  ponte,
  portiere,
  dispositivi,
  abbinamento,
  registro,
  chiamata,
  ritorno,
}) {
  const server = createServer(async (richiesta, risposta) => {
    /* Qui, e **solo** qui.
     *
     * La prima versione le metteva dentro la funzione che scrive le risposte,
     * che pero' e' la stessa delle due porte: la console si ritrovava
     * l'origine aperta, e la console e' il posto dove nascono i codici di
     * abbinamento. Una pagina qualunque aperta nel browser di chi e' dentro
     * Home Assistant avrebbe potuto fabbricarsene uno e leggersi l'elenco dei
     * telefoni. La console sta dietro l'ingress e li' deve restare. */
    for (const [nome, valore] of Object.entries(PER_IL_BROWSER)) {
      risposta.setHeader(nome, valore);
    }

    const via = rotta(richiesta);
    const metodo = String(richiesta.method || "").toUpperCase();
    const da = richiesta.socket.remoteAddress || "?";

    /* Il browser, prima di una POST con un corpo JSON, chiede il permesso.
     * Va risposto, e va risposto senza toccare niente. */
    if (metodo === "OPTIONS") {
      risposta.writeHead(204, PER_IL_BROWSER);
      risposta.end();
      return;
    }

    if (metodo === "GET" && via === "/salute") {
      json(risposta, {
        vivo: true,
        dispositivi: dispositivi.quanti(),
        collegati: ponte.quantiCollegati(),
      });
      return;
    }

    if (metodo === "POST" && via === "/abbinamento") {
      let corpo;
      try {
        corpo = await corpoDiJson(richiesta);
      } catch (errore) {
        male(risposta, 400, errore.message);
        return;
      }
      try {
        abbinamento.consuma(corpo.codice);
      } catch (errore) {
        if (errore instanceof TroppiTentativi) {
          registro.attenzione(`troppi tentativi di abbinamento da ${da}`);
          male(risposta, 429, "troppi tentativi: riprova piu' tardi");
          return;
        }
        if (errore instanceof CodiceSbagliato) {
          registro.attenzione(`codice di abbinamento sbagliato da ${da}`);
          male(risposta, 403, errore.message);
          return;
        }
        throw errore;
      }
      try {
        const { dispositivo, segno, chiave } = dispositivi.abbina({
          nome: corpo.nome,
          sistema: corpo.sistema,
        });
        /* Il codice e' stato speso: l'attesa al centralino non serve piu', e
         * lasciarla aperta vorrebbe dire tenere una via buona per qualcosa che
         * non esiste piu'. */
        chiamata?.chiudiLAbbinamento();
        registro.info(`abbinato «${dispositivo.nome}»`);
        /* Il segno **e** la chiave del filo: sono due cose diverse e servono
         * tutte e due. Senza la chiave il telefono farebbe la stretta di mano
         * e poi non capirebbe una parola.
         *
         * E il ritorno: dove ribussare domani. Chi si e' abbinato battendo
         * otto lettere non ha mai visto un indirizzo. */
        json(risposta, { segno, chiave, dispositivo, ritorno: (await ritorno?.cosaDire()) ?? null }, 201);
      } catch (errore) {
        if (errore instanceof TroppiDispositivi) {
          male(risposta, 409, errore.message);
          return;
        }
        throw errore;
      }
      return;
    }

    male(risposta, 404, "qui non c'e' niente");
  });

  server.on("upgrade", (richiesta, socket) => {
    if (rotta(richiesta) !== "/casa" || !eUnaSalita(richiesta)) {
      socket.end("HTTP/1.1 404 Not Found\r\n\r\n");
      return;
    }
    const presa = accetta(richiesta, socket, {});
    /* Anche in casa si passa dal portiere: la rete di casa non e' cifrata, e
     * chi ci sta sopra non deve poter leggere piu' di chi sta sul centralino.
     * E soprattutto: cosi' l'app ha **una strada sola** invece di due. */
    if (presa) portiere.accogli(presa, { da: socket.remoteAddress || "?" });
  });

  return server;
}

/* ─── La console, dietro l'ingress ───────────────────────────────────────── */

export function costruisciLaConsole({
  ponte,
  casa,
  dispositivi,
  abbinamento,
  opzioni,
  registro: scritto,
  chiamata,
  identita,
  cartellaDellaConsole,
}) {
  /* Un registro c'e' sempre, anche quando non gliene danno uno.
   *
   * Non e' pignoleria: qui dentro il registro si scrive **dentro il gestore
   * delle richieste**, e anche dentro il `catch` che dovrebbe salvare la
   * situazione. Se non c'e', il salvagente affonda insieme al naufrago: la
   * risposta non viene mai chiusa, e chi ha chiamato aspetta per sempre. Un
   * pezzo che manca deve dare un 500, non una rotella che gira. */
  const registro = scritto ?? { info() {}, attenzione() {}, errore() {} };
  return createServer(async (richiesta, risposta) => {
    const via = rotta(richiesta);
    const metodo = String(richiesta.method || "").toUpperCase();

    if (via.startsWith("/api/")) {
      try {
        await api({
          via,
          metodo,
          richiesta,
          risposta,
          ponte,
          casa,
          dispositivi,
          abbinamento,
          opzioni,
          registro,
          chiamata,
          identita,
        });
      } catch (errore) {
        registro.errore(`la console e' inciampata: ${errore?.message || errore}`);
        male(risposta, 500, "qualcosa e' andato storto");
      }
      return;
    }

    servi(risposta, cartellaDellaConsole, via);
  });
}

async function api({
  via,
  metodo,
  richiesta,
  risposta,
  ponte,
  casa,
  dispositivi,
  abbinamento,
  opzioni,
  registro,
  chiamata,
  identita,
}) {
  if (via === "/api/stato" && metodo === "GET") {
    const saluto = await casa.saluta();
    const collegati = ponte.collegatiPerDispositivo();
    json(risposta, {
      casa: saluto,
      porta: opzioni.portaDellApp,
      massimi: opzioni.dispositiviMassimi,
      abbinamento: abbinamento.stato(),
      dispositivi: dispositivi
        .elenco()
        .map((uno) => ({ ...uno, collegati: collegati.get(uno.id) || 0 })),
    });
    return;
  }

  if (via === "/api/codice" && metodo === "POST") {
    if (dispositivi.quanti() >= opzioni.dispositiviMassimi) {
      male(risposta, 409, `sono gia' abbinati ${opzioni.dispositiviMassimi} dispositivi`);
      return;
    }
    const { codice, scadeIl } = abbinamento.nuovo();
    /* Al centralino ne va detta l'**impronta**, perche' possa instradare chi
     * si presenta con questo codice. Il codice li' non arriva mai. */
    chiamata?.apriLAbbinamento(impronta(codice));
    registro.info("codice di abbinamento fabbricato dalla console");
    json(risposta, { codice, scadeIl });
    return;
  }

  if (via === "/api/codice" && metodo === "DELETE") {
    chiamata?.chiudiLAbbinamento();
    json(risposta, { annullato: abbinamento.annulla() });
    return;
  }

  const telefono = /^\/api\/dispositivi\/([A-Za-z0-9_]+)$/.exec(via);
  if (telefono && metodo === "DELETE") {
    const id = telefono[1];
    const staccato = dispositivi.stacca(id);
    const buttatiGiu = ponte.scollega(id);
    if (!staccato) {
      male(risposta, 404, "questo dispositivo non c'e'");
      return;
    }
    registro.info(`dispositivo staccato, e ${buttatiGiu} fili chiusi`);
    json(risposta, { staccato: true, filiChiusi: buttatiGiu });
    return;
  }

  if (telefono && metodo === "PATCH") {
    let corpo;
    try {
      corpo = await corpoDiJson(richiesta);
    } catch (errore) {
      male(risposta, 400, errore.message);
      return;
    }
    if (!dispositivi.rinomina(telefono[1], corpo.nome)) {
      male(risposta, 404, "questo dispositivo non c'e'");
      return;
    }
    json(risposta, { rinominato: true });
    return;
  }

  male(risposta, 404, "qui non c'e' niente");
}

/* I file della console. Nessun percorso puo' uscire dalla sua cartella. */
function servi(risposta, cartella, via) {
  const chiesto = via === "/" || via === "" ? "/index.html" : via;
  const dentro = normalize(join(cartella, chiesto));
  if (!dentro.startsWith(normalize(cartella)) || !existsSync(dentro)) {
    male(risposta, 404, "qui non c'e' niente");
    return;
  }
  risposta.writeHead(200, {
    "content-type": TIPI[extname(dentro)] || "application/octet-stream",
    "cache-control": "no-store",
  });
  createReadStream(dentro).pipe(risposta);
}
