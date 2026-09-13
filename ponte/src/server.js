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
import { BASE } from "./plancia.js";
import { laVede, vedeQualcosa } from "./plance.js";
import { Cucitura } from "./cucitura.js";
import { conLePremesse, linguaPulita, paginaDellaLingua } from "./premesse.js";
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
    const presa = accetta(richiesta, socket, {
      /* Se chi legge inciampa, il filo cade: il motivo va nel registro, se no
       * si vede un telefono che si scollega e non si sa perche'. */
      onGuasto: (errore) => registro.errore(`un telefono: ${errore?.stack || errore}`),
    });
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
  plance,
  /* Chi c'e' in questa casa e chi la amministra (`utenti.js`). Serve a due
   * cose: disegnare le spunte di «chi la vede», e rispondere alla domanda che
   * l'ingress non sa — «questo utente amministra?» — quando una plancia e'
   * riservata a chi amministra. */
  utenti,
  /* Com'e' andata a mettere le plance fra le «Plance» di Home Assistant: la
   * scheda dell'add-on lo dice, perche' e' li' che si guarda quando una voce
   * nella barra laterale non c'e'. */
  planceInCasa,
  configurazione,
  /* Le commissioni: i comandi che il ponte fa da se' invece di girarli a Home
   * Assistant. Servono alla plancia servita qui — l'integrazione che li faceva
   * non c'e' piu' — e sono le stesse che riceve l'app. Una lista sola, se no
   * la plancia si comporterebbe in due modi a seconda di dove e' aperta. */
  commissioni,
  /* La chat di assistenza. Alla console serve per una riga sola, e non e' una
   * riga da poco: dire se questa casa **risponde** alle chat. */
  chat,
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
  const server = createServer(async (richiesta, risposta) => {
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
          plance,
          utenti,
          planceInCasa,
          configurazione,
          chat,
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

    /* La plancia, dentro Home Assistant.
     *
     * Nella dashboard la plancia e' un pannello dell'integrazione: la serve
     * lei, e la barra laterale ha la sua voce. L'integrazione va dismessa, e
     * allora quel mestiere lo fa il ponte: la pagina la serve lui, con le sue
     * premesse (`premesse.js`), e il WebSocket che quella pagina apre torna
     * qui (`cucitura.js`).
     *
     * Sta sulla porta dell'**ingress** e non su quella dell'app: cosi' ci
     * arriva solo chi e' entrato in Home Assistant, e non serve nessun altro
     * segno da chiedere a nessuno. */
    if (via === "/plancia" || via.startsWith("/plancia/")) {
      await laPlanciaServita({ via, richiesta, risposta, plancia, plance, utenti });
      return;
    }

    /* E i suoi file, gli stessi che la porta dell'app serve al telefono. Senza
     * questi la pagina arriverebbe nuda: il foglio di stile, i moduli e i
     * caratteri li chiede lei, per nome relativo, e da qui. */
    if (via.startsWith(`${BASE}/`)) {
      if (!plancia?.cE) {
        male(risposta, 404, "questo add-on non si porta dietro la plancia");
        return;
      }
      const letto = plancia.leggi(via);
      if (letto.stato !== 200) {
        male(risposta, letto.stato, "questo file non c'e'");
        return;
      }
      risposta.writeHead(200, {
        "content-type": letto.tipo,
        /* Nell'indirizzo c'e' l'impronta: quello che c'e' non cambia mai, e il
         * browser se lo puo' tenere. */
        "cache-control": "public, max-age=31536000, immutable",
        "content-length": letto.corpo.length,
      });
      risposta.end(letto.corpo);
      return;
    }

    servi(risposta, cartellaDellaConsole, via);
  });

  /* Il WebSocket della plancia servita qui.
   *
   * La pagina crede di parlare con Home Assistant: parla con la cucitura, che
   * risponde ai comandi del ponte e gira il resto alla casa. Ogni pagina si
   * prende un filo suo, come ogni telefono: i numeri dei messaggi sono i suoi
   * e non c'e' niente da rinumerare. */
  server.on("upgrade", (richiesta, socket) => {
    if (rotta(richiesta) !== "/plancia/api/websocket" || !eUnaSalita(richiesta)) {
      socket.end("HTTP/1.1 404 Not Found\r\n\r\n");
      return;
    }
    if (!casa) {
      socket.end("HTTP/1.1 503 Service Unavailable\r\n\r\n");
      return;
    }
    /* Questo filo e' uno per tutte le plance e non sa quale pagina l'ha
     * aperto: non puo' dire «questa plancia no». Ma puo' dire l'unica cosa che
     * sa, e che basta: chi non e' abilitato a **nessuna** plancia di questa
     * casa non ha niente da chiedere qui. Le pagine a cui non e' abilitato non
     * gliele serviamo (`laPlanciaServita`), quindi il filo che resta e' quello
     * di una plancia che gli si apre. */
    const chi = chiGuarda(richiesta);
    /* «Amministra?» qui si prende solo da quello che c'e' **gia' in mano**: una
     * salita va accettata o rifiutata subito, e non si tiene un browser
     * appeso mentre si chiede a Home Assistant. Se non lo sappiamo, questo
     * filo non lo si chiude per quello: per aprirlo bisogna aver ricevuto la
     * pagina della plancia, e quella l'ha chiesto per davvero. */
    if (!vedeQualcosa(plance?.elenco?.() ?? [], chi, utenti?.amministratoreSubito?.(chi) ?? null)) {
      socket.end("HTTP/1.1 403 Forbidden\r\n\r\n");
      return;
    }
    const presa = accetta(richiesta, socket, {
      onGuasto: (errore) => registro.errore(`la plancia: ${errore?.stack || errore}`),
    });
    if (!presa) return;
    const cucitura = new Cucitura({
      presa,
      casa,
      commissioni,
      registro,
      da: socket.remoteAddress || "?",
    });
    cucitura.avvia().catch((errore) => {
      registro.errore(`la cucitura della plancia e' andata storta: ${errore?.message || errore}`);
      cucitura.chiudi(1011, "non ha funzionato");
    });
  });

  return server;
}

/* La porta chiusa: cosa vede chi apre una plancia che non e' sua.
 *
 * Non e' un errore e non si scrive come tale: non c'e' niente di rotto e non
 * c'e' niente da riparare. E' una plancia che in questa casa e' stata
 * riservata a qualcun altro, e la riga dice **dove** si cambia — la pagina di
 * gdahome — perche' chi legge questo messaggio e non se l'aspettava vuole
 * sapere chi glielo puo' aprire, non un codice di stato.
 *
 * 403 e non 404: la plancia esiste, e dirlo non svela niente che chi abita in
 * questa casa non veda gia' nella barra laterale. */
function laPortaChiusa(risposta, quale, perche = "utenti") {
  /* Il titolo l'ha scritto chi ci abita, e finisce dentro del markup: si
   * riscrive prima. Non e' un pericolo vero — chi lo scrive e' chi amministra
   * la casa, e lo rileggerebbe lui — ma una funzione che costruisce una pagina
   * si difende da sola, cosi' resta vera anche domani. */
  const titolo = String(quale?.titolo || "Questa plancia")
    .slice(0, 40)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const pagina = `<!doctype html>
<html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titolo}</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center;
    background: #f2f4f7; color: #101317;
    font: 15px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 26rem; margin: 24px; padding: 26px 28px; border-radius: 20px;
    background: #fff; box-shadow: 0 1px 3px rgba(16,24,40,.09); text-align: center; }
  h1 { margin: 0 0 10px; font-size: 1.2rem; letter-spacing: -.01em; }
  p { margin: 0; color: #5b6471; }
  @media (prefers-color-scheme: dark) {
    body { background: #10141a; color: #e8ebf0; }
    main { background: #1a1f27; box-shadow: 0 1px 3px rgba(0,0,0,.4); }
    p { color: #9aa4b2; }
  }
</style></head>
<body><main>
  <h1>${titolo} non e' abilitata per te</h1>
  <p>${
    perche === "admin"
      ? "In questa casa questa plancia la vedono solo gli amministratori."
      : "In questa casa questa plancia la vedono solo alcuni utenti."
  } Chi amministra la casa puo' cambiarlo dalla pagina di <b>gdahome</b>, alla
  voce &laquo;Le plance&raquo;.</p>
</main></body></html>`;
  const byte = Buffer.from(pagina, "utf8");
  risposta.writeHead(403, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    "content-length": byte.length,
  });
  risposta.end(byte);
}

/* Chi sta guardando, secondo l'ingress di Home Assistant.
 *
 * Il Supervisor, su ogni richiesta che passa dall'ingress, scrive in testa
 * `X-Remote-User-Id` con l'identificativo dell'utente che ha la sessione, e
 * `X-Remote-User-Display-Name` col suo nome. Non e' una cosa che ci arriva
 * dalla pagina — quindi non e' una cosa che la pagina possa cambiare — ed e'
 * il motivo per cui «chi la vede» qui e' un cancello vero e non un velo
 * disegnato: la pagina della plancia non parte nemmeno, e non c'e' niente da
 * aggirare togliendo un pezzo di HTML col browser.
 *
 * Fuori dall'ingress quella riga non c'e' e questa funzione risponde stringa
 * vuota; `laVede` sa cosa farne. */
function chiGuarda(richiesta) {
  return String(richiesta.headers?.["x-remote-user-id"] || "").trim();
}

/* La pagina della plancia, servita dentro Home Assistant.
 *
 * `/plancia/` e' la prima; `/plancia/<profilo>/` una delle altre. La barra in
 * fondo non e' un dettaglio: senza, il browser crede che la pagina stia nella
 * cartella sopra. Il rimando si scrive **relativo** — `<profilo>/` e non
 * `/plancia/<profilo>/` — perche' sotto l'ingress davanti c'e' un prefisso che
 * qui non si conosce e non si deve conoscere.
 */
async function laPlanciaServita({ via, richiesta, risposta, plancia, plance, utenti }) {
  if (!plancia?.cE) {
    male(risposta, 404, "questo add-on non si porta dietro la plancia");
    return;
  }
  if (via === "/plancia") {
    risposta.writeHead(302, { location: "plancia/", "cache-control": "no-store" });
    risposta.end();
    return;
  }
  const profilo = via.slice("/plancia/".length).replace(/\/+$/, "");
  const quale = profilo ? (plance?.quale(profilo) ?? null) : (plance?.prima ?? null);
  if (profilo && !quale) {
    male(risposta, 404, "quella plancia non c'e'");
    return;
  }
  if (profilo && !via.endsWith("/")) {
    risposta.writeHead(302, { location: `${profilo}/`, "cache-control": "no-store" });
    risposta.end();
    return;
  }
  /* Chi la vede.
   *
   * Si guarda **prima** di leggere la pagina dal disco: a chi non e' abilitato
   * non si serve la plancia, non gliela si serve nascosta. La risposta e' una
   * pagina e non un JSON perche' qui dall'altra parte c'e' una persona dentro
   * un riquadro della sua Home Assistant, non un programma.
   *
   * «Amministra?» si chiede a Home Assistant, e **solo se serve**: e' l'unico
   * pezzo che l'ingress non dice, e una plancia che non lo chiede non deve
   * pagare una domanda a Home Assistant per ogni apertura. Se Home Assistant
   * non risponde e non c'e' nemmeno una risposta vecchia da riusare, la
   * plancia non si apre: e' la stessa regola dell'elenco — una restrizione
   * che cade quando non si sa niente non e' una restrizione. */
  const chi = chiGuarda(richiesta);
  let amministra = null;
  if (quale?.solo_admin === true && utenti) {
    try {
      amministra = await utenti.amministratore(chi);
    } catch (_errore) {
      amministra = null;
    }
  }
  if (!laVede(quale, chi, amministra)) {
    /* Quale delle due l'ha fermato, per dirgli quella giusta: sapere che una
     * plancia «e' solo degli amministratori» e' un'informazione che puo'
     * usare — va a chiedere a chi amministra — mentre «e' solo di alcuni
     * utenti» quando in realta' gli manca il gruppo lo manderebbe a chiedere
     * la cosa sbagliata. */
    const soloAdmin = quale?.solo_admin === true && amministra !== true;
    laPortaChiusa(risposta, quale, soloAdmin ? "admin" : "utenti");
    return;
  }
  const lingua = linguaPulita(
    new URL(richiesta.url || "/", "http://ponte").searchParams.get("lingua"),
  );
  const nome = paginaDellaLingua(plancia.varianti(), lingua);
  const letto = plancia.leggi(`${plancia.base}/legacy/${nome}`);
  if (letto.stato !== 200) {
    male(risposta, 500, "la pagina della plancia non si legge");
    return;
  }
  /* Il prefisso dell'ingress: Home Assistant lo dice, e va scritto dentro la
   * pagina — nel `<base>` e nell'indirizzo del WebSocket — perche' la pagina
   * da sola non lo puo' indovinare. */
  const davanti = String(richiesta.headers["x-ingress-path"] || "");
  const pagina = conLePremesse(letto.corpo.toString("utf8"), {
    base: `${davanti}${plancia.base}/legacy`,
    quale,
    lingua,
    doveIlWebSocket: `${davanti}/plancia/api/websocket`,
  });
  const byte = Buffer.from(pagina, "utf8");
  risposta.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    /* La pagina no: dentro ci sono le premesse, e cambiano con la plancia
     * scelta e col prefisso dell'ingress. */
    "cache-control": "no-store",
    "content-length": byte.length,
  });
  risposta.end(byte);
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
  plance,
  utenti,
  planceInCasa,
  configurazione,
  chat,
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

  /* Le plance di questa casa.
   *
   * E' il posto dove se ne aggiunge una: la scheda dell'add-on sta dietro
   * l'autenticazione di Home Assistant, ed e' li' che in Home Assistant si
   * aggiunge una seconda istanza dell'integrazione. Le stesse cose si fanno
   * anche dall'app, coi comandi `ponte/plance/*`.
   *
   * Chi non ha le plance — un ponte sul banco — risponde 404: meglio che una
   * pagina che mostra un elenco vuoto e un tasto che non fa niente. */
  if (via === "/api/plance") {
    if (!plance) {
      json(risposta, { errore: "senza_plance" }, 404);
      return;
    }
    if (metodo === "GET") {
      json(risposta, { plance: plance.elenco() });
      return;
    }
    let detto = {};
    if (metodo === "POST" || metodo === "PATCH" || metodo === "DELETE") {
      try {
        detto = await corpoDiJson(richiesta);
      } catch (errore) {
        male(risposta, 400, errore.message);
        return;
      }
    }
    try {
      if (metodo === "POST") {
        const quale = plance.aggiungi(detto?.titolo);
        json(risposta, { plance: plance.elenco(), quale }, 201);
        return;
      }
      if (metodo === "PATCH") {
        /* Tre cose si cambiano di una plancia, e da qui si cambia quella che
         * e' stata detta: `utenti` vuol dire «chi la vede», `solo_admin` vuol
         * dire «solo gli amministratori», e senza nessuna delle due vuol dire
         * «rinomina». Un solo comando e non tre perche' e' la stessa cosa — la
         * scheda di una plancia — e perche' cosi' l'elenco che torna e' sempre
         * quello aggiornato di tutto. */
        let quale;
        if (Array.isArray(detto?.utenti)) quale = plance.chiLaVede(detto?.profilo, detto.utenti);
        else if (typeof detto?.solo_admin === "boolean")
          quale = plance.soloChiAmministra(detto?.profilo, detto.solo_admin);
        else quale = plance.rinomina(detto?.profilo, detto?.titolo);
        json(risposta, { plance: plance.elenco(), quale });
        return;
      }
      if (metodo === "DELETE") {
        json(risposta, {
          plance: plance.togli(detto?.profilo, {
            dimentica: (quello) => configurazione?.dimentica(quello),
          }),
        });
        return;
      }
    } catch (errore) {
      json(
        risposta,
        { errore: errore?.codice || "plance", spiegazione: errore?.message || "" },
        400,
      );
      return;
    }
    male(risposta, 405, "metodo non previsto");
    return;
  }

  /* Gli utenti di Home Assistant, per la sola cosa a cui servono qui:
   * scegliere chi vede una plancia.
   *
   * Li chiede Home Assistant, non li teniamo noi — e' importante: un elenco di
   * utenti copiato da qualche parte invecchia, e chi ha tolto una persona da
   * casa se la ritroverebbe ancora spuntata. Di ognuno passa il minimo:
   * l'identificativo, il nome, e se amministra. Non la password, non le
   * credenziali, non i gruppi.
   *
   * Gli utenti **di sistema** non passano: sono quelli che Home Assistant fa
   * da se' per gli add-on e per le integrazioni — questo add-on ne ha uno — e
   * in una lista di «chi vede la plancia» sarebbero righe che non sono persone
   * e non aprono niente. */
  if (via === "/api/utenti" && metodo === "GET") {
    if (!utenti) {
      json(risposta, { errore: "senza_utenti" }, 404);
      return;
    }
    try {
      json(risposta, { utenti: await utenti.elenco() });
    } catch (errore) {
      /* Se la casa non risponde, la console lo dice e lascia stare: «chi la
       * vede» e' una scelta che si fa un giorno ogni tanto, e rifarla domani
       * non costa niente. Quello che non deve succedere e' che la pagina resti
       * con una rotella che gira. */
      json(
        risposta,
        { errore: "senza_utenti", spiegazione: String(errore?.message || errore).slice(0, 120) },
        502,
      );
    }
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
        /* E perche' l'ultimo tentativo non e' andato, a parole. Senza questa
         * riga la console dice «sto chiamando…» per ore, e chi guarda non ha
         * modo di sapere se il nome non si risolve, se la porta e' chiusa o
         * se dall'altra parte c'e' qualcosa che non e' un centralino. */
        perche: chiamata?.perche || "",
      },
      /* Che versione e' questo gdahome. La console la scrive accanto al nome,
       * sempre: la scheda «La versione» c'e' solo sugli add-on locali, e a chi
       * l'ha installato dal negozio non la diceva nessuno. */
      versione: opzioni.versione || "",
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
      /* Chi parla di piu' in questa casa, nell'ultimo minuto.
       *
       * E' la riga che risponde a «l'app va a scatti»: seicento eventi al
       * minuto non sono mille entita' che cambiano una volta, sono due o tre
       * che cambiano di continuo, e finche' non si sa quali non c'e' niente
       * da fare. Vedi `chiacchieroni.js`. */
      chiacchieroni: ponte?.chiacchieroni?.elenco() ?? null,
      /* E come e' andata a metterle fra le «Plance» di Home Assistant.
       *
       * Sta qui perche' e' il posto dove si guarda: chi ha aggiunto una
       * plancia e non la trova nella barra laterale deve leggere **in questa
       * pagina** perche', non andare a cercare una riga nel registro. `null`
       * vuol dire che non si e' ancora provato. */
      plance_in_casa: planceInCasa?.esito ?? null,
      /* Quante plance ha questa casa, e come si chiamano.
       *
       * Viaggiano insieme allo stato e non in una chiamata loro: questa pagina
       * lo stato lo chiede ogni dieci secondi, e un secondo giro per tre
       * righe sarebbe un giro per niente. */
      plance: plance ? plance.elenco() : [],
      /* Se questa casa risponde alle chat di assistenza.
       *
       * E' l'unico segno che la chiave della console e' arrivata dov'e' andata
       * a finire. Home Assistant un campo `password` lo nasconde e non lo
       * rimostra: chi l'ha appena incollata riapre la scheda, trova la casella
       * vuota e non ha modo di sapere se sia stata presa o buttata via. Questa
       * riga glielo dice.
       *
       * La chiave non esce di qui — ne' intera ne' a pezzi: esce **un si' o un
       * no**. */
      assistenza: { console: Boolean(chat?.eLaConsole) },
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
