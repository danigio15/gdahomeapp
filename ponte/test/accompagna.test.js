/* L'accompagnatore: quello che la tessera faceva per la plancia, fatto da
 * dentro il riquadro della tessera «pagina web» di Home Assistant.
 *
 * Gira in un browser, e qui si fa girare in un browser finto e piccolo: un
 * `hass` che risponde, una pagina di Home Assistant con le sue ombre — il
 * riquadro dentro `hui-iframe-card`, dentro `hui-panel-view`, dentro
 * `hui-root` — e un biscotto. Non e' un browser vero e non vuole esserlo:
 * quello che si tiene fermo e' **quali chiamate partono** e **cosa resta
 * appeso nella pagina di Home Assistant**. Che giri in un browser vero lo
 * guarda la prova con Playwright, a parte.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const L_ACCOMPAGNATORE = fileURLToPath(new URL("../carta/accompagna.js", import.meta.url));

/* Una radice ombra, quel tanto che basta: tiene dei figli, li trova per
 * nome, e sa chi la ospita. */
function unOmbra(ospite) {
  const figli = [];
  const radice = {
    host: ospite,
    parentNode: null,
    figli,
    ownerDocument: {
      createElement: (chi) => ({ localName: chi, id: "", textContent: "", parentNode: null }),
    },
    appendChild(figlio) {
      figlio.parentNode = radice;
      figli.push(figlio);
      return figlio;
    },
    removeChild(figlio) {
      const dove = figli.indexOf(figlio);
      if (dove >= 0) figli.splice(dove, 1);
      figlio.parentNode = null;
    },
    getElementById: (nome) => figli.find((uno) => uno.id === nome) || null,
  };
  return radice;
}

/* La pagina di Home Assistant intorno al riquadro, con le sue ombre. */
function unaCasa({ pannello = true, inModifica = false, hass } = {}) {
  const tetto = { localName: "hui-root", lovelace: { editMode: inModifica }, parentNode: null };
  tetto.shadowRoot = unOmbra(tetto);
  const vista = {
    localName: pannello ? "hui-panel-view" : "hui-masonry-view",
    parentNode: tetto.shadowRoot,
  };
  const tessera = { localName: "hui-iframe-card", parentNode: vista };
  tessera.shadowRoot = unOmbra(tessera);
  const attributi = new Map([["sandbox", "allow-scripts allow-same-origin"]]);
  const riquadro = {
    localName: "iframe",
    parentNode: tessera.shadowRoot,
    getRootNode: () => tessera.shadowRoot,
    getAttribute: (nome) => (attributi.has(nome) ? attributi.get(nome) : null),
    setAttribute: (nome, valore) => attributi.set(nome, String(valore)),
    removeAttribute: (nome) => attributi.delete(nome),
    attributi,
  };
  const su = {
    document: { querySelector: (chi) => (chi === "home-assistant" ? { hass } : null) },
  };
  return { tetto, tessera, riquadro, su };
}

/* Un `hass` che mette in fila quello che gli si chiede. */
function unHass({ sessione = "s1", valida = true, ws = true, api = null } = {}) {
  const chieste = [];
  return {
    chieste,
    user: { id: "u1", is_admin: false },
    callWS(comando) {
      chieste.push(`ws ${comando.endpoint}`);
      if (!ws) return Promise.reject({ code: "unknown_command" });
      if (comando.endpoint === "/ingress/session") return Promise.resolve({ session: sessione });
      if (comando.endpoint === "/ingress/validate_session") {
        return valida ? Promise.resolve(null) : Promise.reject({ code: "401" });
      }
      return Promise.reject(new Error("non so"));
    },
    callApi(metodo, dove) {
      chieste.push(`api ${dove}`);
      return api ? Promise.resolve(api) : Promise.reject(new Error("no"));
    },
  };
}

/* La finestra del riquadro, con l'accompagnatore caricato dentro. */
function unRiquadro({ casa, biscotto = "" } = {}) {
  const biscotti = [];
  const giri = [];
  const ascolti = new Map();
  const documento = {
    location: { protocol: "https:" },
    visibilityState: "visible",
    get cookie() {
      return biscotto;
    },
    set cookie(uno) {
      biscotti.push(uno);
    },
    addEventListener: (nome, chi) => ascolti.set(`doc:${nome}`, chi),
    removeEventListener: (nome) => ascolti.delete(`doc:${nome}`),
  };
  const finestra = {
    document: documento,
    parent: casa?.su,
    frameElement: casa?.riquadro ?? null,
    setInterval: (chi, quanto) => {
      giri.push({ chi, quanto, vivo: true });
      return giri.length;
    },
    clearInterval: (quale) => {
      if (giri[quale - 1]) giri[quale - 1].vivo = false;
    },
    setTimeout: (chi) => chi(),
    addEventListener: (nome, chi) => ascolti.set(nome, chi),
    Promise,
    Date,
    JSON,
    String,
    Boolean,
    Error,
  };
  finestra.window = finestra;
  vm.createContext(finestra);
  vm.runInContext(readFileSync(L_ACCOMPAGNATORE, "utf8"), finestra, {
    filename: "accompagna.js",
  });
  return { finestra, A: finestra.__gdahomeAccompagna, biscotti, giri, ascolti };
}

test("la sessione si chiede sul WebSocket, come Home Assistant, e finisce nel biscotto", async () => {
  const hass = unHass();
  const { A, biscotti, finestra } = unRiquadro({ casa: unaCasa({ hass }) });
  const sessione = await A.laSessione(hass, finestra.document);
  assert.equal(sessione, "s1");
  assert.deepEqual(hass.chieste, ["ws /ingress/session"]);
  assert.deepEqual(biscotti, [
    "ingress_session=s1;path=/api/hassio_ingress/;SameSite=Strict;Secure",
  ]);
});

test("dove il WebSocket non la da', si prova la via di una volta; se no si dice la prima", async () => {
  const vecchia = unHass({ ws: false, api: { data: { session: "s2" } } });
  const uno = unRiquadro({ casa: unaCasa({ hass: vecchia }) });
  assert.equal(await uno.A.laSessione(vecchia, uno.finestra.document), "s2");
  assert.deepEqual(vecchia.chieste, ["ws /ingress/session", "api hassio/ingress/session"]);

  const nessuna = unHass({ ws: false });
  const due = unRiquadro({ casa: unaCasa({ hass: nessuna }) });
  await assert.rejects(due.A.laSessione(nessuna, due.finestra.document), (errore) => {
    assert.equal(errore.code, "unknown_command");
    /* E si legge: niente «[object Object]». */
    assert.equal(due.A.perche(errore), "codice unknown_command");
    return true;
  });
  assert.deepEqual(due.biscotti, []);
});

test("tenerla viva non ne fa una nuova; una scaduta invece si rifa'", async () => {
  const buona = unHass();
  const uno = unRiquadro({ casa: unaCasa({ hass: buona }) });
  assert.equal(await uno.A.rinfresca(buona, uno.finestra.document, "s0"), "s0");
  assert.deepEqual(buona.chieste, ["ws /ingress/validate_session"]);
  assert.deepEqual(uno.biscotti, []);

  const scaduta = unHass({ valida: false, sessione: "s9" });
  const due = unRiquadro({ casa: unaCasa({ hass: scaduta }) });
  assert.equal(await due.A.rinfresca(scaduta, due.finestra.document, "s0"), "s9");
  assert.deepEqual(scaduta.chieste, ["ws /ingress/validate_session", "ws /ingress/session"]);
});

test("la barra va via in una vista a pannello, e torna in modifica", () => {
  const casa = unaCasa({ hass: unHass() });
  const { A } = unRiquadro({ casa });
  assert.equal(A.laBarra(casa.riquadro), true);
  const foglio = casa.tetto.shadowRoot.getElementById(A.FOGLIO);
  assert.ok(foglio, "il foglio non c'e'");
  assert.match(foglio.textContent, /\.header \{ display: none/);
  assert.match(foglio.textContent, /--header-height: 0px/);
  /* Due volte non fa due fogli. */
  A.laBarra(casa.riquadro);
  assert.equal(casa.tetto.shadowRoot.figli.length, 1);

  /* In modifica la barra torna: «Fatto» sta li'. */
  casa.tetto.lovelace.editMode = true;
  assert.equal(A.laBarra(casa.riquadro), false);
  assert.equal(casa.tetto.shadowRoot.getElementById(A.FOGLIO), null);

  /* In una vista a griglia non si tocca: li' la barra porta le linguette. */
  const griglia = unaCasa({ pannello: false, hass: unHass() });
  assert.equal(A.laBarra(griglia.riquadro), false);
  assert.equal(griglia.tetto.shadowRoot.figli.length, 0);
});

test("la cornice va via solo dalla tessera «pagina web»", () => {
  const casa = unaCasa({ hass: unHass() });
  const { A } = unRiquadro({ casa });
  assert.equal(A.laCornice(casa.riquadro), true);
  assert.match(casa.tessera.shadowRoot.figli[0].textContent, /border-radius: 0/);
  const altra = unaCasa({ hass: unHass() });
  altra.tessera.localName = "una-tessera-di-qualcuno";
  assert.equal(A.laCornice(altra.riquadro), false);
});

test("nella plancia parte solo se il riquadro porta il segno di apri.html", () => {
  /* La plancia aperta dalla scheda dell'add-on — dove la sessione la tiene
   * Home Assistant — o dentro la tessera di qualcuno: non si tocca niente. */
  const casa = unaCasa({ hass: unHass() });
  const senza = unRiquadro({ casa, biscotto: "ingress_session=s0" });
  assert.equal(senza.A.accompagna(), false);
  assert.equal(senza.giri.length, 0);
  assert.equal(casa.tetto.shadowRoot.figli.length, 0);
});

test("col segno tiene viva la sessione del biscotto, e andando via rimette la barra", async () => {
  const hass = unHass();
  const casa = unaCasa({ hass });
  casa.riquadro.setAttribute("data-gdahome", "apri");
  const r = unRiquadro({ casa, biscotto: "altro=1; ingress_session=s0" });
  assert.equal(r.A.accompagna(), true);
  assert.ok(casa.tetto.shadowRoot.getElementById(r.A.FOGLIO), "la barra e' rimasta");

  /* Ogni mezzo minuto, la sessione che c'e' nel biscotto. */
  const sessione = r.giri.find((uno) => uno.quanto === 30000);
  assert.ok(sessione, "nessun giro ogni mezzo minuto");
  sessione.chi();
  await new Promise((ok) => setImmediate(ok));
  assert.deepEqual(hass.chieste, ["ws /ingress/validate_session"]);

  /* Il telefono che torna a schermo rinfresca subito. */
  r.ascolti.get("doc:visibilitychange")();
  await new Promise((ok) => setImmediate(ok));
  assert.equal(hass.chieste.length, 2);

  /* E quando Home Assistant toglie il riquadro, la barra torna e i giri si
   * fermano. */
  r.ascolti.get("pagehide")();
  assert.equal(casa.tetto.shadowRoot.getElementById(r.A.FOGLIO), null);
  assert.ok(r.giri.every((uno) => !uno.vivo));
});

test("hass si aspetta, chi guarda compreso, e se non arriva si dice", async () => {
  const hass = unHass();
  const casa = unaCasa({ hass });
  const { A } = unRiquadro({ casa });
  assert.equal(await A.aspettaLaCasa(50), hass);

  const vuota = unaCasa({ hass: null });
  const r = unRiquadro({ casa: vuota });
  /* `setTimeout` nel banco gira subito: per non girare a vuoto per sempre si
   * fa scadere l'attesa al primo giro. */
  await assert.rejects(r.A.aspettaLaCasa(-1), /Home Assistant non risponde/);
});
