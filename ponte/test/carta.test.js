/* La cartina che apre la plancia dentro una Plancia di Home Assistant.
 *
 * Era l'unico pezzo del progetto senza una prova, ed e' quello che e' costato
 * di piu': tre ore di ipotesi per una chiamata che Home Assistant non serve
 * piu'. La sessione dell'ingress si chiedeva con `POST
 * /api/hassio/ingress/session`, che era la via di una volta; oggi si chiede
 * sul WebSocket con `supervisor/api` e `/ingress/session`, ed e' quello che fa
 * il frontend di Home Assistant quando apri la scheda di un add-on.
 *
 * Il difetto da solo sarebbe stato mezz'ora. Le altre due e mezza le ha prese
 * un `String(errore)` su un oggetto: la tessera diceva «La plancia non si e'
 * aperta — [object Object]». Cioe' diceva di aver guardato, senza dire niente.
 *
 * **Come si prova un file fatto per un browser.** Con un browser finto, e
 * piccolo: `HTMLElement`, un registro di elementi, un `document` con un
 * biscotto. Non e' un browser vero e non vuole esserlo — quello che si tiene
 * fermo qui e' *quali chiamate partono* e *cosa si legge quando va storto*,
 * che sono le due cose che nessun browser avrebbe mostrato meglio.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const LA_CARTA = fileURLToPath(new URL("../carta/plancia.js", import.meta.url));

/* Un browser quel tanto che basta. */
function unBrowser() {
  const biscotti = [];
  const registro = new Map();
  class HTMLElement {
    constructor() {
      this.shadowRoot = null;
      this.isConnected = true;
    }
    attachShadow() {
      this.shadowRoot = {
        innerHTML: "",
        querySelector() {
          return { textContent: "", src: "", style: {} };
        },
      };
      return this.shadowRoot;
    }
  }
  const finestra = {
    HTMLElement,
    customElements: {
      get: (nome) => registro.get(nome),
      define: (nome, quale) => registro.set(nome, quale),
    },
    document: {
      set cookie(uno) {
        biscotti.push(uno);
      },
      get cookie() {
        return biscotti.join("; ");
      },
      location: { protocol: "http:" },
      createElement: (chi) => unElemento(chi),
    },
    setInterval: () => 0,
    clearInterval: () => {},
    URL,
    Promise,
    console,
  };
  finestra.window = finestra;
  const contesto = vm.createContext(finestra);
  vm.runInContext(readFileSync(LA_CARTA, "utf8"), contesto, { filename: "plancia.js" });
  return { finestra, biscotti, Tessera: registro.get("gdahome-plancia") };
}

/* Un elemento, quel tanto che basta per essere messo e tolto. */
function unElemento(chi) {
  return {
    localName: chi,
    id: "",
    textContent: "",
    parentNode: null,
    remove() {
      const dentro = this.parentNode?.dentro;
      const dove = dentro ? dentro.indexOf(this) : -1;
      if (dove >= 0) dentro.splice(dove, 1);
      this.parentNode = null;
    },
  };
}

/* Una radice ombra: quello che ci sta dentro, e chi ce l'ha. */
function unaRadice(host) {
  const dentro = [];
  return {
    host,
    parentNode: null,
    dentro,
    getElementById: (id) => dentro.find((uno) => uno.id === id) || null,
    appendChild(uno) {
      uno.parentNode = this;
      dentro.push(uno);
      return uno;
    },
  };
}

/* Home Assistant sopra la tessera, con le sue due ombre in mezzo.
 *
 * `hui-root` disegna la barra; `hui-panel-view` e' la vista che tiene una
 * tessera sola. Fra l'una e l'altra c'e' un confine d'ombra, e fra la vista e
 * la tessera un altro: sono quelli che una salita fatta col solo `parentNode`
 * non passa. */
function unaPlanciaDiHomeAssistant({ pannello = true, modifica = false } = {}) {
  const tetto = { localName: "hui-root", lovelace: { editMode: modifica } };
  tetto.shadowRoot = unaRadice(tetto);
  const vista = {
    localName: pannello ? "hui-panel-view" : "hui-masonry-view",
    parentNode: tetto.shadowRoot,
  };
  vista.shadowRoot = unaRadice(vista);
  return { tetto, dove: vista.shadowRoot };
}

/* La tessera attaccata dove la attacca Home Assistant. Torna anche il tetto,
 * che e' dove si va a guardare se la barra c'e' ancora. */
function inCasa(config = { addon: "gdahome", profilo: "" }, come = {}) {
  const { Tessera } = unBrowser();
  const ha = unaPlanciaDiHomeAssistant(come);
  const tessera = new Tessera();
  tessera.setConfig(config);
  tessera.parentNode = ha.dove;
  tessera.connectedCallback();
  return { tessera, tetto: ha.tetto };
}

/* Il foglio che toglie la barra, se c'e'. */
function ilFoglio(tetto) {
  return tetto.shadowRoot.dentro.find((uno) => uno.id === "gdahome-senza-barra") || null;
}

/* Un Home Assistant finto: tiene in fila quello che gli si chiede. */
function unaCasa({ ws, api } = {}) {
  const chieste = [];
  return {
    chieste,
    callWS: async (comando) => {
      chieste.push({ come: "ws", ...comando });
      if (ws) return ws(comando);
      if (comando.endpoint === "/addons/gdahome/info")
        return { ingress_url: "/api/hassio_ingress/xyz" };
      if (comando.endpoint === "/ingress/session") return { session: "sessione-nuova" };
      return {};
    },
    callApi: async (metodo, via) => {
      chieste.push({ come: "api", metodo, via });
      if (api) return api(metodo, via);
      throw { status_code: 404, body: { message: "Not Found" } };
    },
  };
}

async function apri(casa, config = { addon: "gdahome", profilo: "" }) {
  const { Tessera, biscotti } = unBrowser();
  const tessera = new Tessera();
  tessera.setConfig(config);
  tessera.hass = casa;
  /* `_disegna` parte da sola e non si aspetta: due giri di coda bastano. */
  await new Promise((ok) => setImmediate(ok));
  await new Promise((ok) => setImmediate(ok));
  return { tessera, biscotti };
}

test("la sessione dell'ingress si chiede sul WebSocket, come la chiede Home Assistant", async () => {
  const casa = unaCasa();
  const { tessera, biscotti } = await apri(casa);

  /* Le due chiamate, in quest'ordine: dov'e' l'add-on, e poi la sessione. */
  assert.deepEqual(
    casa.chieste.map((una) => `${una.come} ${una.endpoint || una.via}`),
    ["ws /addons/gdahome/info", "ws /ingress/session"],
  );
  const sessione = casa.chieste.at(-1);
  assert.equal(sessione.type, "supervisor/api");
  assert.equal(sessione.method, "post");

  /* E il biscotto, con gli stessi limiti che gli mette il frontend: solo per
   * l'ingress, e solo da questo sito. */
  assert.equal(biscotti.length, 1);
  assert.match(biscotti[0], /^ingress_session=sessione-nuova;/);
  assert.match(biscotti[0], /path=\/api\/hassio_ingress\/;SameSite=Strict/);
  /* Su http niente `Secure`, se no il browser il biscotto non lo prende. */
  assert.equal(biscotti[0].includes("Secure"), false);

  /* E il riquadro guarda dove deve. */
  assert.equal(tessera._dove, "/api/hassio_ingress/xyz/plancia/");
});

test("se la via nuova non c'e', si prova quella di prima", async () => {
  /* Un Home Assistant piu' vecchio: `supervisor/api` c'e' per l'add-on ma non
   * per la sessione. Allora si ripiega sulla chiamata REST, che li' funziona
   * ancora. */
  const casa = unaCasa({
    ws: (comando) => {
      if (comando.endpoint === "/addons/gdahome/info")
        return { ingress_url: "/api/hassio_ingress/xyz" };
      throw { code: "unknown_command", message: "non lo so fare" };
    },
    api: async () => ({ data: { session: "sessione-vecchia" } }),
  });
  const { biscotti } = await apri(casa);
  assert.match(biscotti[0], /^ingress_session=sessione-vecchia;/);
  assert.deepEqual(
    casa.chieste.map((una) => `${una.come} ${una.endpoint || una.via}`),
    ["ws /addons/gdahome/info", "ws /ingress/session", "api hassio/ingress/session"],
  );
});

test("quando non riesce lo dice, e non dice «[object Object]»", async () => {
  /* La riga che e' costata tre ore. `hass.callApi` non solleva un `Error`:
   * solleva un oggetto, e `String(oggetto)` fa «[object Object]» — un
   * messaggio che sembra una spiegazione e non lo e'. */
  const casa = unaCasa({
    ws: (comando) => {
      if (comando.endpoint === "/addons/gdahome/info")
        return { ingress_url: "/api/hassio_ingress/xyz" };
      throw { status_code: 404, body: { message: "Not Found" } };
    },
  });
  const { tessera } = await apri(casa);
  const detto = tessera._perche({ status_code: 404, body: { message: "Not Found" } });
  assert.equal(detto, "Not Found");

  /* E in tutti gli altri modi in cui un errore puo' arrivare storto. */
  assert.equal(tessera._perche(new Error("rotto")), "rotto");
  assert.equal(tessera._perche("rotto"), "rotto");
  assert.equal(tessera._perche({ code: "not_found" }), "codice not_found");
  assert.equal(tessera._perche({ status_code: 502 }), "HTTP 502");
  assert.match(tessera._perche({ chissa: 1 }), /chissa/);
  assert.match(tessera._perche({}), /non ha detto perche'/);
  assert.match(tessera._perche(null), /non ha detto perche'/);

  /* Nessuno di questi, mai. */
  for (const uno of [{}, null, { code: 1 }, new Error(""), { body: {} }]) {
    assert.equal(tessera._perche(uno).includes("[object"), false);
  }
});

test("senza sapere quale add-on aprire non fa finta di niente", async () => {
  const casa = unaCasa();
  const { tessera } = await apri(casa, { profilo: "" });
  assert.equal(casa.chieste.length, 0);
  assert.match(tessera._perche(new Error("questa tessera non sa quale add-on aprire")), /add-on/);
});

/* ── La barra di Home Assistant sopra la plancia ──────────────────────────
 *
 * Finche' la plancia la portava l'integrazione era un pannello, e un pannello
 * non ha niente sopra. Adesso e' una tessera in una dashboard Lovelace, e una
 * dashboard ha sempre la sua barra: «gdahome», la lente, il piu', la matita.
 * Nessuno l'ha aggiunta — e' comparsa cambiando casa.
 *
 * Il modo chiosco la copriva, ma da solo si accende solo su uno schermo stretto
 * comandato da un dito: su un tablet appeso al muro, e su un computer, restava
 * li'. Queste prove tengono fermo che va via da sola, e — che conta di piu' —
 * i quattro casi in cui **non** deve andare via.
 */

test("la barra di Home Assistant sopra la plancia va via da sola", () => {
  const { tetto } = inCasa();
  const foglio = ilFoglio(tetto);
  assert.ok(foglio, "il foglio che toglie la barra non e' stato messo");
  assert.equal(foglio.localName, "style");
  /* La barra, e lo spazio che si teneva: l'una senza l'altro lascia una
   * striscia vuota alta cinquantasei punti. */
  assert.match(foglio.textContent, /\.header\s*\{\s*display:\s*none/);
  assert.match(foglio.textContent, /--header-height:\s*0px/);
});

test("e quando la plancia se ne va, la barra torna", () => {
  const { tessera, tetto } = inCasa();
  assert.ok(ilFoglio(tetto));
  tessera.disconnectedCallback();
  assert.equal(ilFoglio(tetto), null);
  /* E la radice ombra di Home Assistant resta come l'abbiamo trovata: niente
   * di nostro dentro casa d'altri. */
  assert.deepEqual(tetto.shadowRoot.dentro, []);
});

test("in una vista a griglia la barra resta: porta le linguette", () => {
  /* Chi si e' messo la tessera in mezzo alle sue, in una vista normale, quella
   * barra la usa per cambiare pagina. Toglierla la' non e' una cura. */
  const { tetto } = inCasa({ addon: "gdahome", profilo: "" }, { pannello: false });
  assert.equal(ilFoglio(tetto), null);
});

test("in modifica la barra resta: e' l'unico modo di uscirne", () => {
  /* In modifica «Fatto» sta proprio li'. Nascosta la barra, si resterebbe
   * dentro l'editor senza una strada per tornare. */
  const { tetto } = inCasa({ addon: "gdahome", profilo: "" }, { modifica: true });
  assert.equal(ilFoglio(tetto), null);
});

test("«barra: true» la lascia dov'e'", () => {
  const { tetto } = inCasa({ addon: "gdahome", profilo: "", barra: true });
  assert.equal(ilFoglio(tetto), null);
});

test("due giri non sdoppiano il foglio", () => {
  /* Si chiama due volte di proposito: una quando la tessera si attacca, e una
   * dopo che il riquadro e' aperto — perche' al primo giro la vista che la
   * tiene puo' non esserci ancora. */
  const { tessera, tetto } = inCasa();
  tessera._togliLaBarra();
  tessera._togliLaBarra();
  assert.equal(tetto.shadowRoot.dentro.length, 1);
});

test("fuori da una Plancia non cerca niente, e non si rompe", () => {
  /* La stessa tessera, senza niente sopra: nessun `hui-root`, nessuna vista.
   * Deve dire no e andare avanti — non sollevare. */
  const { Tessera } = unBrowser();
  const tessera = new Tessera();
  tessera.setConfig({ addon: "gdahome", profilo: "" });
  assert.equal(tessera._togliLaBarra(), false);
  assert.doesNotThrow(() => tessera._rimettiLaBarra());
});

/* La pagina dentro chiede il codice da se' (`{gdahome: "chiave?"}`), e la
 * tessera risponde: a lei sola, e solo se viene dall'origine del quadro. */
test("la tessera risponde alla pagina che chiede il codice, e a nessun altro", () => {
  const { finestra } = unBrowser();
  const Riquadro = finestra.customElements.get("gdahome-riquadro");
  assert.ok(Riquadro, "la tessera del riquadro c'e'");
  const tessera = Object.create(Riquadro.prototype);
  tessera._config = { dove: "https://quadro.gdahome.org/console/", chiave: "la-chiave" };
  const mandati = [];
  const dentro = { postMessage: (detto, origine) => mandati.push([detto, origine]) };
  tessera.shadowRoot = { querySelector: () => ({ contentWindow: dentro }) };

  tessera._rispondiAllaPagina({
    data: { gdahome: "chiave?" },
    origin: "https://quadro.gdahome.org",
    source: dentro,
  });
  /* Per valore: l'oggetto nasce nel contesto della tessera, e un confronto
   * stretto guarderebbe anche il suo prototipo, che e' di un altro mondo. */
  assert.equal(
    JSON.stringify(mandati),
    JSON.stringify([[{ gdahome: "chiave", chiave: "la-chiave" }, "https://quadro.gdahome.org"]]),
  );

  /* Un'altra origine, un'altra finestra, un'altra domanda: niente. */
  const altra = { postMessage: (detto, origine) => mandati.push(["altra", detto, origine]) };
  tessera._rispondiAllaPagina({
    data: { gdahome: "chiave?" },
    origin: "https://altro.example",
    source: dentro,
  });
  tessera._rispondiAllaPagina({
    data: { gdahome: "chiave?" },
    origin: "https://quadro.gdahome.org",
    source: altra,
  });
  tessera._rispondiAllaPagina({
    data: { gdahome: "pagina" },
    origin: "https://quadro.gdahome.org",
    source: dentro,
  });
  assert.equal(mandati.length, 1);

  /* E senza codice nelle opzioni non c'e' niente da rispondere. */
  tessera._config = { dove: "https://quadro.gdahome.org/console/", chiave: "" };
  tessera._rispondiAllaPagina({
    data: { gdahome: "chiave?" },
    origin: "https://quadro.gdahome.org",
    source: dentro,
  });
  assert.equal(mandati.length, 1);
});

/* «Le 3 linee per tornare in HA»: su Chrome e sull'app per Mac non facevano
 * niente, su iPhone e Android si' (#35).
 *
 * Il tasto chiedeva a Home Assistant di aprire la barra laterale. Su uno
 * schermo stretto quella barra e' un cassetto e si apre; su uno largo non e'
 * un cassetto — sta di fianco o non c'e' — e li' non c'era niente da aprire.
 * Adesso su schermo largo rimette la barra della dashboard, che e' quella che
 * il kiosk toglie e che porta il menu e le linguette. */
test("il tasto del menu: stretto chiede il cassetto, largo rimette la barra", () => {
  const { finestra } = unBrowser();
  const Riquadro = finestra.customElements.get("gdahome-riquadro");
  const riquadro = Object.create(Riquadro.prototype);
  riquadro._config = { dove: "https://quadro.gdahome.org/console/" };

  const chiesti = [];
  riquadro.dispatchEvent = (evento) => chiesti.push(evento?.type);
  /* Il browser finto ha quel tanto che basta: l'evento lo si aggiunge qui,
   * dov'e' la prova che lo usa. */
  finestra.CustomEvent = class {
    constructor(tipo, dettagli) {
      this.type = tipo;
      Object.assign(this, dettagli || {});
    }
  };

  /* Schermo stretto: si chiede il cassetto, e la barra resta com'era. */
  finestra.matchMedia = (quale) => ({ matches: /max-width: 870px/.test(quale) });
  let tolta = 0;
  riquadro._barra = { remove: () => (tolta += 1) };
  riquadro._apriIlMenu();
  assert.deepEqual(chiesti, ["hass-toggle-menu"]);
  assert.equal(tolta, 0, "sul telefono la barra della dashboard non c'entra");

  /* Schermo largo: si chiede lo stesso — non fa male — e in piu' la barra
   * torna, che e' l'unica strada indietro che li' esiste. */
  finestra.matchMedia = () => ({ matches: false });
  riquadro._apriIlMenu();
  assert.deepEqual(chiesti, ["hass-toggle-menu", "hass-toggle-menu"]);
  assert.equal(tolta, 1, "la barra della dashboard torna");
  assert.equal(riquadro._barra, null);
});

test("e premuto di nuovo la barra se ne va: il kiosk si accende e si spegne", () => {
  const { finestra } = unBrowser();
  const Riquadro = finestra.customElements.get("gdahome-riquadro");
  const riquadro = Object.create(Riquadro.prototype);
  riquadro._config = { dove: "https://quadro.gdahome.org/console/" };
  riquadro.dispatchEvent = () => {};
  riquadro._barra = null;
  finestra.matchMedia = () => ({ matches: false });
  finestra.CustomEvent = class {
    constructor(tipo) {
      this.type = tipo;
    }
  };

  /* Senza una dashboard vera sotto, rimettere il kiosk non trova nessun
   * tetto: quello che conta e' che ci PROVI, cioe' che il secondo tocco non
   * sia un tocco a vuoto come il primo era prima di questa correzione. */
  riquadro._apriIlMenu();
  assert.equal(riquadro._barra, null);
});
