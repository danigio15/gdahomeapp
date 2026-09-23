/* La plancia servita dal quadro: la pagina dell'editor, dentro il cruscotto.
 *
 * «Quando premo Configurazione mi deve aprire il classico editor della
 * plancia»: non una casella di JSON, la pagina vera — la Configurazione di
 * DashboardModern, con «Configura Entita'» e tutto il resto. E' la stessa
 * pagina che il ponte serve dentro Home Assistant e che l'app serve nel
 * telefono, servita una terza volta da qui, con le sue premesse
 * (`ponte/src/premesse.js` e' il gemello di questo file).
 *
 * ─── Cosa cambia, servita da qui ────────────────────────────────────────
 *
 * Tre cose, e tutte e tre stanno nelle premesse:
 *
 *  1. il WebSocket che la pagina apre non va a Home Assistant e nemmeno al
 *     ponte: va al quadro, a una **cucitura cieca** (`cucitura-cieca.js`) che
 *     risponde con l'inventario di casa — cosa c'e', non cosa succede — e
 *     con lo scatto della plancia, e che di un salvataggio fa un lavoro
 *     «configura» che la casa ritira;
 *  2. la pagina si apre **sulla Configurazione** e ci resta: la barra in
 *     fondo, il «← HOME», le tessere che qui non hanno senso (segnalazioni,
 *     chat, donazioni, tema e barra «su questo dispositivo») non ci sono;
 *  3. il deposito del browser della pagina e' **uno per casa e per plancia**,
 *     e si svuota a ogni apertura: la plancia tiene una copia locale di
 *     quello che sta scrivendo, e una copia della casa Rossi che finisse
 *     nell'editor della casa Bianchi sarebbe la cosa peggiore che questo
 *     file possa fare.
 *
 * ─── Dove stanno i file ─────────────────────────────────────────────────
 *
 * In `ponte/plancia/`, che e' la stessa cartella dell'add-on: il quadro non
 * si porta una plancia sua, si porta **quella**. Sulla macchina del quadro
 * la mette `accendi.sh` accanto a `src/` (`quadro/plancia/`); nella
 * repository si trova da sola in `../ponte/plancia`. I file si servono sotto
 * `/dashboardmodern_static/<impronta>/…` come fa il ponte, e per lo stesso
 * motivo: l'impronta cambia coi file, e il browser puo' tenerseli un anno.
 * La pagina li chiede in **relativo**, come il cruscotto chiede le sue vie:
 * un prefisso davanti al quadro resta davanti anche a loro.
 *
 * I file statici escono **senza** il marchio dell'installatore: stanno a un
 * indirizzo solo per tutti e senza chiave, e il logo di uno finirebbe nella
 * cache del browser di un altro. Il marchio va nella **pagina**, che e' una
 * per casa: il velo d'avvio col suo logo, il suo nome nel titolo.
 */

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { inDuePezzi, laPagina, vestiDiGdahome } from "./marchio.js";

export const BASE = "/dashboardmodern_static";

/* Come si chiama il messaggio con cui il cruscotto passa alla pagina il suo
 * gettone (`biglietti.js`, `GettoniDellEditor`). **La stessa parola** di
 * `apriLEditor` in `console/index.html`. */
export const IL_GETTONE = "gettone";

const QUI = dirname(fileURLToPath(import.meta.url));

const TIPI = Object.freeze({
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".txt": "text/plain; charset=utf-8",
});

/* Quello che concorre all'impronta: la pagina e i moduli. */
const CON_IMPRONTA = ["legacy", "src"];

/* Quello che sta fuori dall'impronta, e si serve com'e'. */
const FISSE = new Set(["avatars", "brands"]);

/* Un pezzo di percorso e' fatto di lettere, numeri e pochi segni. */
const PEZZO_BUONO = /^[A-Za-z0-9_\-.@+~]+$/;

export const CASA_BUONA = /^casa_[0-9a-f]{32}$/;
export const PROFILO_BUONO = /^[a-z0-9][a-z0-9-]{0,40}$/;

/* Dove sta la plancia: detta (`QUADRO_PLANCIA`), o `plancia/` accanto a
 * `src/` — dove la mette `accendi.sh` — o `../ponte/plancia`, che e' la
 * repository. La prima che c'e'. */
export function dovELaPlancia(detta = process.env.QUADRO_PLANCIA || "") {
  const candidate = [detta, join(QUI, "..", "plancia"), join(QUI, "..", "..", "ponte", "plancia")]
    .filter(Boolean)
    .map((una) => resolve(una));
  return candidate.find((una) => existsSync(join(una, "legacy", "dashboard.html"))) ?? candidate[1];
}

export class PlanciaServita {
  constructor({ cartella = dovELaPlancia() } = {}) {
    this.cartella = resolve(cartella);
    this._impronta = null;
    this._quanti = 0;
  }

  /* C'e' una plancia da servire? Basta che ci sia la pagina. */
  get cE() {
    return existsSync(join(this.cartella, "legacy", "dashboard.html"));
  }

  /* L'impronta del contenuto: si calcola una volta, alla prima domanda. */
  get impronta() {
    if (this._impronta) return this._impronta;
    const somma = createHash("sha256");
    let quanti = 0;
    for (const cartella of CON_IMPRONTA) {
      for (const relativo of this._iFile(join(this.cartella, cartella), cartella)) {
        somma.update(relativo);
        somma.update("\0");
        somma.update(readFileSync(join(this.cartella, relativo)));
        somma.update("\0");
        quanti += 1;
      }
    }
    this._impronta = somma.digest("hex").slice(0, 16);
    this._quanti = quanti;
    return this._impronta;
  }

  get base() {
    return `${BASE}/${this.impronta}`;
  }

  /* Quanti file: si sa dopo aver calcolato l'impronta. */
  get file() {
    void this.impronta;
    return this._quanti;
  }

  /* Che versione e', per dirlo accanto a quella dell'impianto. */
  versione() {
    try {
      const letto = JSON.parse(readFileSync(join(this.cartella, "ORIGINE.json"), "utf8"));
      const versione = String(letto?.versione ?? "").trim();
      return /^[0-9]+(\.[0-9]+){1,3}$/.test(versione) ? versione : "";
    } catch (_errore) {
      return "";
    }
  }

  /* Un file, dal percorso come lo chiede il browser: `{stato, tipo, corpo}`.
   * Senza marchio (vedi in cima): quello che esce di qui e' uguale per
   * tutti. */
  leggi(percorso) {
    const pezzi = String(percorso || "")
      .split("?")[0]
      .split("/");
    /* ["", "dashboardmodern_static", <impronta o cartella fissa>, …] */
    if (pezzi.length < 4 || pezzi[0] !== "" || `/${pezzi[1]}` !== BASE) return questoNo();
    let relativi;
    if (FISSE.has(pezzi[2])) relativi = pezzi.slice(2);
    else if (pezzi[2] === this.impronta && CON_IMPRONTA.includes(pezzi[3]))
      relativi = pezzi.slice(3);
    else return questoNo();
    if (relativi.length < 2 || !relativi.every((uno) => PEZZO_BUONO.test(uno) && uno !== ".."))
      return questoNo();
    const tipo = TIPI[extname(relativi[relativi.length - 1]).toLowerCase()];
    if (!tipo) return questoNo();
    const dove = resolve(this.cartella, ...relativi);
    if (!dove.startsWith(this.cartella + sep)) return questoNo();
    try {
      if (!statSync(dove).isFile()) return questoNo();
      const vestito = vestiDiGdahome(
        relativi.join("/"),
        readFileSync(dove),
        tipo,
        null,
        this.versione(),
      );
      return { stato: 200, tipo: vestito.tipo, corpo: vestito.corpo };
    } catch (_errore) {
      return questoNo();
    }
  }

  /**
   * La pagina dell'editor per una plancia di una casa, con le premesse.
   *
   * `chi` e' chi installa, come lo vuole `marchio.js` — `{nome, logo, tipo}`
   * — e `vesti` sono i nomi che ha scelto per questa plancia (`titolo`,
   * `velo`), che vanno sul velo d'avvio e nel titolo. `configurata` dice
   * alla pagina se dentro c'e' qualcosa, cosi' non scrive «collega le tue
   * entita'» a una casa configurata.
   */
  pagina({ casa, profilo, chi = null, vesti = null, configurata = null }) {
    const testo = readFileSync(join(this.cartella, "legacy", "dashboard.html"), "utf8");
    const suo = chi ? { ...chi, titolo: vesti?.titolo || "", velo: vesti?.velo || "" } : null;
    return conLePremesseDaLontano(laPagina(testo, suo), {
      base: this.base,
      casa,
      profilo,
      vesti,
      configurata,
    });
  }

  *_iFile(cartella, relativa) {
    let nomi;
    try {
      nomi = readdirSync(cartella).sort();
    } catch (_errore) {
      return;
    }
    for (const nome of nomi) {
      const intero = join(cartella, nome);
      const relativo = `${relativa}/${nome}`;
      const dati = statSync(intero);
      if (dati.isDirectory()) {
        yield* this._iFile(intero, relativo);
        continue;
      }
      if (dati.isFile() && TIPI[extname(nome).toLowerCase()]) yield relativo;
    }
  }
}

function questoNo() {
  return {
    stato: 404,
    tipo: "text/plain; charset=utf-8",
    corpo: Buffer.from("qui non c'e' niente"),
  };
}

/* ─── Le premesse ────────────────────────────────────────────────────────── */

/* Gli indirizzi, **relativi**: ne' la base dei file ne' il filo partono dalla
 * radice del sito. Il cruscotto chiede le sue vie in relativo apposta — cosi'
 * funziona anche dietro un proxy che lo monta sotto un prefisso — e questa
 * pagina fa lo stesso: i file stanno tre cartelle sopra di lei
 * (`/plancia-da-lontano/<casa>/<profilo>/` → `/dashboardmodern_static/…`), e
 * il filo e' il suo stesso indirizzo con `websocket` in fondo. */

/* Il nome sotto cui la pagina tiene le sue cose nel deposito del browser:
 * uno per casa e per plancia, cosi' due editor aperti su due case non si
 * vedono. */
export const istanzaDi = (casa, profilo) => `quadro-${casa}-${profilo}`;

/* Il WebSocket che la pagina trova, e come entra.
 *
 * Il ponte da' alla pagina un WebSocket che va a un indirizzo fisso e basta
 * (`premesse.js`, `ilWebSocket`): li' sull'ingress non c'e' niente da
 * autenticare. Qui si': la cucitura cieca vuole sapere chi e', e la pagina
 * della plancia non ne sa niente. Quindi il WebSocket che le si da' lo dice
 * **lui**, come primo messaggio, nella forma che Home Assistant stesso usa
 * (`{type: "auth", access_token}`), e finche' non l'ha detto tiene da parte
 * quello che la pagina vorrebbe dire.
 *
 * Quello che manda non e' la chiave del cruscotto: e' un **gettone** che vale
 * mezz'ora, per questa casa e questa plancia soltanto (`biglietti.js`). Glielo
 * consegna il cruscotto che la contiene, con un `postMessage`, appena il
 * riquadro e' caricato. Si accetta solo da chi la contiene (`parent`) e dalla
 * propria origine: un messaggio da un'altra finestra non e' un gettone,
 * qualunque cosa dica. Dal deposito del browser non si legge niente: questa
 * pagina e' codice di un altro progetto, e la chiave che apre tutto il
 * cruscotto non deve passarle per le mani.
 *
 * Non nell'indirizzo: un gettone nell'indirizzo finisce nei registri di chi
 * sta in mezzo.
 *
 * Il filo sta all'indirizzo della pagina piu' `websocket`, letto dalla
 * pagina stessa: cosi' un prefisso davanti — un proxy che monta il quadro
 * sotto una cartella — resta davanti anche al filo. */
export function ilWebSocketCieco() {
  return (
    "(function(Vera){" +
    'var dove=(location.protocol==="https:"?"wss://":"ws://")+location.host+location.pathname.replace(/\\/+$/,"")+"/websocket";' +
    'var gettone="";' +
    "var aspettano=[];" +
    'addEventListener("message",function(evento){' +
    "var detto=evento&&evento.data;" +
    `if(!detto||detto.gdahome!==${JSON.stringify(IL_GETTONE)}||!detto.gettone)return;` +
    "if(evento.origin!==location.origin||evento.source!==window.parent||window.parent===window)return;" +
    "gettone=String(detto.gettone);" +
    "var da=aspettano.splice(0);for(var i=0;i<da.length;i+=1)da[i]();" +
    "});" +
    "function Cucita(_indirizzo,protocolli){" +
    "var vera=protocolli===undefined?new Vera(dove):new Vera(dove,protocolli);" +
    "var manda=vera.send.bind(vera);var dentro=false;var coda=[];" +
    "var entra=function(){if(vera.readyState!==1)return;" +
    'manda(JSON.stringify({type:"auth",access_token:gettone}));dentro=true;' +
    "var c=coda.splice(0);for(var i=0;i<c.length;i+=1)manda(c[i]);};" +
    'vera.addEventListener("open",function(){if(gettone)entra();else aspettano.push(entra);});' +
    "vera.send=function(testo){if(dentro)return manda(testo);coda.push(testo);};" +
    "return vera;}" +
    "Cucita.prototype=Vera.prototype;" +
    "Cucita.CONNECTING=0;Cucita.OPEN=1;Cucita.CLOSING=2;Cucita.CLOSED=3;" +
    "return Cucita;})(window.WebSocket)"
  );
}

/* Le vesti scelte per questa plancia, come le scrive `premesse.js`: la
 * parola del velo e la scritta della testata in due pezzi. Via `<` e `>`,
 * che finiscono dentro uno `<script>`. */
function leVesti(vesti) {
  if (!vesti || typeof vesti !== "object") return "";
  const pulito = (cosa) => String(cosa ?? "").replace(/[<>]/g, "");
  let fuori = "";
  const velo = pulito(vesti.velo);
  if (velo) fuori += `window.__GDAHOME_VELO__=${JSON.stringify(velo)};`;
  const testata = pulito(vesti.titolo);
  if (testata) fuori += `window.__GDAHOME_TESTATA__=${JSON.stringify(inDuePezzi(testata))};`;
  return fuori;
}

/* Il deposito del browser di questa istanza, svuotato prima che la pagina
 * lo legga. Le chiavi della plancia stanno sotto `cd_<istanza>_`
 * (`legacy/storage-namespace.js`); questo script gira prima di quello, sul
 * deposito vero. Quello che la pagina scrive lo manda subito alla casa: qui
 * non si butta niente che non sia gia' partito. */
function daCapo(istanza) {
  return (
    "(function(){try{" +
    `var p=${JSON.stringify(`cd_${istanza}_`)};var via=[];` +
    "for(var i=0;i<localStorage.length;i+=1){var k=localStorage.key(i);if(k&&k.indexOf(p)===0)via.push(k);}" +
    "for(var j=0;j<via.length;j+=1)localStorage.removeItem(via[j]);" +
    "}catch(e){}})();"
  );
}

/* La Configurazione, e basta.
 *
 * La pagina si apre sulla Home e ha una barra in fondo con tutte le sue
 * pagine: qui si sta sulla Configurazione e ci si resta — e' l'unica cosa
 * che da lontano si fa. Via la barra e la sua maniglia, via il «← HOME»
 * della Configurazione, via le tessere che parlano con la casa o col mondo
 * (segnalazioni, chat, donazioni) e quelle «su questo dispositivo» (tema,
 * barra), via il menu ☰ della plancia con dentro il «Reset totale».
 *
 * La linguetta si preme appena c'e' — la pagina i suoi script li legge per
 * qualche secondo — e si ripreme se la pagina se ne va: un tasto dentro
 * l'editor puo' portare altrove, e altrove qui non c'e' niente da vedere. */
export const LA_CONFIGURAZIONE_E_TUTTO =
  '<style id="gdahome-da-lontano">' +
  /* Con `html body` davanti: la plancia dichiara la sua barra
     `inline-flex!important` da un foglio che arriva dopo questo, e a parita'
     di peso vince l'ultimo. */
  "html body nav.tabs.bottom-nav-bar,html body .bottom-nav-handle{display:none!important}" +
  "html body #page-config .back-home-btn{display:none!important}" +
  "#page-config #dm-tkt-card,#page-config #dm-chat-card{display:none!important}" +
  "html body #page-config .dm-sostieni-tessera,html body #editor-modal .dm-sostieni-pastiglia,html body #ed-body .dm-sostieni-card{display:none!important}" +
  "#page-config .cfg-card-theme{display:none!important}" +
  "header .ha-menu-btn{display:none!important}" +
  /* Il tasto di Assist: parla con Home Assistant, che qui non c'e'. */
  "html body #dm-assist-tasto{display:none!important}" +
  "</style>" +
  "<script>(function(){" +
  'var laVoce=function(){var tutte=document.querySelectorAll(".tab");' +
  'for(var i=0;i<tutte.length;i+=1)if(tutte[i].getAttribute("data-tab")==="config")return tutte[i];return null;};' +
  'var ciSiamo=function(){var pagina=document.getElementById("page-config");return !!pagina&&pagina.classList.contains("active");};' +
  "var apri=function(prove){if(ciSiamo())return;var voce=laVoce();" +
  "if(voce){try{voce.click();}catch(male){}if(ciSiamo())return;}" +
  "if(prove<200)setTimeout(function(){apri(prove+1);},60);};" +
  "var parti=function(){apri(0);setInterval(function(){if(!ciSiamo())apri(0);},1500);};" +
  'if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",parti);else parti();' +
  "})();</script>";

/**
 * La pagina con in testa quello che le serve sapere: le stesse sette righe
 * del ponte (`premesse.js`), piu' quello che cambia da lontano.
 */
export function conLePremesseDaLontano(
  pagina,
  { base, casa, profilo, vesti = null, configurata = null },
) {
  const istanza = istanzaDi(casa, profilo);
  const premessa =
    `<base href="../../..${base.replace(/\/*$/, "/")}legacy/" />` +
    "<script>" +
    "window.__DASHBOARDMODERN_HOSTED__=true;" +
    `window.__DASHBOARDMODERN_BRIDGE_WS__=${ilWebSocketCieco()};` +
    `window.__DASHBOARDMODERN_INSTANCE__=${JSON.stringify(istanza)};` +
    `window.__DASHBOARDMODERN_PROFILE__=${JSON.stringify(profilo)};` +
    `window.__DASHBOARDMODERN_PRIMARY__=${profilo === "primary"};` +
    'window.__DASHBOARDMODERN_LOCALE__="it";' +
    "window.__GDAHOME__=true;" +
    "window.__GDAHOME_DA_LONTANO__=true;" +
    leVesti(vesti) +
    (typeof configurata === "boolean"
      ? `window.__GDAHOME_CONFIGURATA__=${configurata ? "true" : "false"};`
      : "") +
    daCapo(istanza) +
    "</script>" +
    LA_CONFIGURAZIONE_E_TUTTO;
  const testa = /<head[^>]*>/i.exec(pagina);
  if (!testa) return `${premessa}${pagina}`;
  const dove = testa.index + testa[0].length;
  return pagina.slice(0, dove) + premessa + pagina.slice(dove);
}
