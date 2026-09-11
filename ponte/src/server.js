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
import { invito } from "./invito.js";
import { accetta, eUnaSalita } from "./presa.js";
import { qrInSvg } from "./qr.js";
import { impronta } from "./segreti.js";

/* Un corpo piu' grande di cosi' non e' un abbinamento. */
const CORPO_MASSIMO = 4 * 1024;

const TIPI = Object.freeze({
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  /* Quello che si porta dietro l'app web: i caratteri, la tela di Flutter, i
   * suoi dati. Un tipo sbagliato qui non e' un dettaglio — un carattere
   * servito come byte qualunque il browser lo rifiuta, e un `.wasm` servito
   * male non parte proprio. */
  ".json": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
  ".otf": "font/otf",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".map": "application/json; charset=utf-8",
  ".bin": "application/octet-stream",
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
         * un quadretto non ha mai visto un indirizzo. */
        json(
          risposta,
          { segno, chiave, dispositivo, ritorno: (await ritorno?.cosaDire()) ?? null },
          201,
        );
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
  ritorno,
  plancia,
  aggiornamento,
  cartellaDellaConsole,
  cartellaDellApp,
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
          ritorno,
          plancia,
          aggiornamento,
        });
      } catch (errore) {
        registro.errore(`la console e' inciampata: ${errore?.message || errore}`);
        male(risposta, 500, "qualcosa e' andato storto");
      }
      return;
    }

    /* gdahome in un browser, servito dall'add-on stesso.
     *
     * E' il link che serviva: chi ha l'add-on acceso ha gia' l'app, e non c'e'
     * niente da installare da nessuna parte. Dietro l'ingress vuol dire anche
     * che chi non e' entrato in Home Assistant non ci arriva.
     *
     * Un avvertimento onesto: la plancia dentro l'app web la serve un service
     * worker, e un browser i service worker li fa girare solo su `https` o
     * `localhost`. Chi apre Home Assistant su un indirizzo `http` vede tutto
     * il resto e non la plancia — e l'app glielo dice invece di restare
     * bianca. */
    if (via === "/app" || via.startsWith("/app/")) {
      if (!cartellaDellApp || !existsSync(cartellaDellApp)) {
        male(risposta, 404, "questo add-on non si porta dietro gdahome da browser");
        return;
      }
      /* La barra in fondo non e' un dettaglio: senza, il browser crede che la
       * pagina stia nella cartella **sopra**, e tutti i file dell'app li va a
       * cercare un piano piu' su. Il rimando e' scritto **relativo** apposta —
       * `app/` e non `/app/` — perche' cosi' vale sia da solo sia sotto
       * l'ingress, dove davanti c'e' un prefisso che qui non si conosce e non
       * si deve conoscere. */
      if (via === "/app") {
        risposta.writeHead(302, { location: "app/", "cache-control": "no-store" });
        risposta.end();
        return;
      }
      servi(risposta, cartellaDellApp, via.slice("/app".length), { deposito: true });
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
  ritorno,
  plancia,
  aggiornamento,
}) {
  /* C'e' una versione nuova del ponte?
   *
   * Sta in una via sua e non dentro `/api/stato` perche' la risposta arriva da
   * GitHub: `/api/stato` la console lo chiede ogni dieci secondi, e dieci
   * secondi non sono il passo di una cosa che cambia una volta al giorno.
   */
  if (via === "/api/aggiornamento" && metodo === "GET") {
    if (!aggiornamento) {
      json(risposta, { locale: false });
      return;
    }
    json(risposta, await aggiornamento.stato());
    return;
  }

  /* «Portati dentro la versione nuova.»
   *
   * Si risponde **prima** di chiedere la ricostruzione, perche' la
   * ricostruzione ammazza questo stesso programma: una risposta che non arriva
   * mai, a chi guarda, e' un guasto. Cosi' invece la console sa che e' andata,
   * e sa anche che fra un minuto la pagina torna.
   */
  if (via === "/api/aggiornamento" && metodo === "POST") {
    if (!aggiornamento) {
      male(risposta, 409, "questo ponte non si sa aggiornare da se'");
      return;
    }
    let versione;
    try {
      versione = await aggiornamento.porta();
    } catch (errore) {
      registro.attenzione(`l'aggiornamento non e' andato: ${errore?.message || errore}`);
      male(risposta, 409, String(errore?.message || errore));
      return;
    }
    json(risposta, { versione, ricostruisco: true });
    /* Dopo la risposta, e non prima. Il mezzo secondo e' perche' la risposta
     * arrivi davvero a destinazione e non resti in un buffer di un processo
     * che sta per morire. */
    setTimeout(() => {
      aggiornamento
        .rifalla()
        .then((esito) => {
          if (!esito.chiesto) registro.attenzione(esito.perche);
        })
        .catch((errore) => registro.attenzione(`ricostruzione: ${errore?.message || errore}`));
    }, 500);
    return;
  }

  if (via === "/api/stato" && metodo === "GET") {
    const saluto = await casa.saluta();
    const collegati = ponte.collegatiPerDispositivo();
    json(risposta, {
      casa: saluto,
      /* Come va il filo verso il centralino. Va detto a schermo: senza, chi ha
       * messo un indirizzo sbagliato nella scheda dell'add-on lo scopre in
       * stazione, quando l'app non trova la casa e non c'e' niente da
       * guardare. */
      centralino: {
        configurato: Boolean(chiamata?.dove),
        dentro: chiamata?.dentro ?? false,
        rifiutata: chiamata?.rifiutata ?? null,
        casa: identita?.casa ?? null,
        /* L'indirizzo del centralino, che non e' un segreto: e' un indirizzo
         * pubblico, e la console lo usa per comporre il link di gdahome da
         * aprire in un browser — lo stesso posto, con `https` davanti. */
        dove: chiamata?.dove || null,
      },
      porta: opzioni.portaDellApp,
      massimi: opzioni.dispositiviMassimi,
      /* Se questo add-on si porta dietro gdahome da aprire in un browser.
       * La console lo chiede per sapere se mostrare il link o tacere: un link
       * che porta a un 404 e' peggio di nessun link. */
      app: Boolean(opzioni.app && existsSync(opzioni.app)),
      /* Da dove viene la plancia che questo ponte serve, e se e' intatta.
       *
       * Sta in questa pagina e non nascosto in un registro perche' e' la
       * risposta a «questa e' quella vera?», e chi se lo chiede se lo chiede
       * guardando qui. */
      plancia: plancia?.cE ? plancia.provenienza : null,
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
    json(risposta, { codice, scadeIl, invito: await unInvito(codice, ritorno, chiamata) });
    return;
  }

  /* Il codice che c'e' adesso, per chi ricarica la pagina.
   *
   * Senza, una pagina ricaricata mentre il codice e' ancora buono lo perde di
   * vista e costringe a fabbricarne un altro — cioe' a buttare via quello
   * valido, e a ricominciare da capo davanti a chi sta inquadrando. */
  if (via === "/api/codice" && metodo === "GET") {
    const vivo = abbinamento.vivo();
    if (!vivo) {
      json(risposta, { attivo: false });
      return;
    }
    json(risposta, {
      attivo: true,
      ...vivo,
      invito: await unInvito(vivo.codice, ritorno, chiamata),
    });
    return;
  }

  if (via === "/api/codice" && metodo === "DELETE") {
    chiamata?.chiudiLAbbinamento();
    json(risposta, { annullato: abbinamento.annulla() });
    return;
  }

  /* Il codice a quadretti, disegnato qui.
   *
   * Il disegno lo fa il ponte e non la pagina: cosi' la console resta tre
   * file senza niente da scaricare, e il codice non passa mai per un
   * indirizzo — sta nel corpo di una risposta che non si mette in cache. */
  if (via === "/api/qr.svg" && metodo === "GET") {
    const vivo = abbinamento.vivo();
    if (!vivo) {
      male(risposta, 404, "nessun codice di abbinamento e' attivo");
      return;
    }
    risposta.writeHead(200, {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "no-store",
    });
    risposta.end(
      qrInSvg(await unInvito(vivo.codice, ritorno, chiamata), {
        titolo: "Codice di abbinamento",
      }),
    );
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

/* Quello che va dentro il codice a quadretti: il codice, e come si arriva a
 * questa casa. Se il Supervisor non risponde si va avanti con quello che c'e':
 * un invito senza indirizzi funziona lo stesso dal centralino, e uno senza
 * centralino funziona lo stesso in casa. */
async function unInvito(codice, ritorno, chiamata) {
  const dove = (await ritorno?.cosaDire()) ?? {};
  return invito({
    codice,
    centralino: dove.centralino || chiamata?.dove || "",
    indirizzi: dove.indirizzi ?? [],
  });
}

/* I file della console e quelli dell'app web. Nessun percorso puo' uscire
 * dalla sua cartella.
 *
 * Col `deposito` acceso i file si possono tenere: l'app web pesa qualche
 * megabyte e non cambia finche' non si aggiorna l'add-on, e riscaricarla a
 * ogni apertura su una rete di casa e' tempo perso a guardare una pagina
 * bianca. La pagina d'ingresso no — quella dice qual e' la versione, e va
 * chiesta ogni volta. */
function servi(risposta, cartella, via, { deposito = false } = {}) {
  const chiesto = via === "/" || via === "" ? "/index.html" : via;
  const dentro = normalize(join(cartella, chiesto));
  if (!dentro.startsWith(normalize(cartella)) || !existsSync(dentro)) {
    male(risposta, 404, "qui non c'e' niente");
    return;
  }
  const laPagina = chiesto === "/index.html";
  risposta.writeHead(200, {
    "content-type": TIPI[extname(dentro)] || "application/octet-stream",
    "cache-control": deposito && !laPagina ? "public, max-age=3600" : "no-store",
  });
  createReadStream(dentro).pipe(risposta);
}
