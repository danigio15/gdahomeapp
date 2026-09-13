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
