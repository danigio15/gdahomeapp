/* L'editor vero della plancia, dentro il cruscotto.
 *
 * «Quando premo Configurazione mi deve aprire il classico editor della
 * plancia»: la pagina di DashboardModern, servita dal quadro con le sue
 * premesse, sopra un filo **cieco** — la pagina crede di parlare con Home
 * Assistant e parla col quadro, che di casa ha solo lo scatto e l'inventario
 * (cosa c'e', non cosa succede). Quello che si tiene fermo: che sul filo si
 * entri col codice del cruscotto e solo per una casa propria che lo
 * permette; che gli stati escano ciechi; che un salvataggio diventi un lavoro
 * «configura» che la casa ritira; che un comando a un dispositivo o un flusso
 * non passino; e che la pagina, ai file e al filo, ci arrivi per gli indirizzi
 * giusti.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { alzaIlQuadro } from "../src/index.js";
import { BASE, istanzaDi, PlanciaServita } from "../src/plancia-servita.js";

const QUI = dirname(fileURLToPath(import.meta.url));
const CRUSCOTTO = readFileSync(join(QUI, "..", "console", "index.html"), "utf8");
const GESTIONE = readFileSync(join(QUI, "..", "gestore", "index.html"), "utf8");

const CHIAVE_DEL_GESTORE = "una-chiave-lunga-abbastanza-per-il-gestore";
const UNA = "casa_a3f19c74e05b2d8890fa4c1e6b73d052";

const rapporto = (piu = {}) => ({
  quando: new Date().toISOString(),
  ogni: 1,
  ponte: "1.5.9.14",
  ha: "2026.9.1",
  manutenzione: false,
  configurazione: true,
  marchio: true,
  plance: {
    quante: 1,
    configurate: 1,
    elenco: [{ profilo: "primary", titolo: "Casa", revisione: 12 }],
  },
  telefoni: { abbinati: 1, visti7gg: 1 },
  fuori: { acceso: true, filo: true },
  entita: { totali: 214, sparite: 0, dispositivi: 0, nomi: [] },
  ...piu,
});

const VALORI = {
  dm_schema_version: "4",
  cd_stanze: JSON.stringify([{ id: "cucina", name: "Cucina" }]),
};

/* L'inventario come lo manda la casa: gia' cieco. Dentro ci si mette apposta
 * uno stato vero e un indirizzo, per vedere che il quadro li ritoglie. */
const INVENTARIO = {
  stati: [
    {
      entity_id: "light.cucina",
      state: "on",
      attributes: { friendly_name: "Cucina", brightness: 200 },
    },
    {
      entity_id: "camera.ingresso",
      state: "streaming",
      attributes: { friendly_name: "Ingresso", entity_picture: "/api/camera_proxy/x?token=abc" },
    },
  ],
  entita: [{ entity_id: "light.cucina", device_id: "d1", platform: "hue", unique_id: "00:11" }],
  dispositivi: [
    { id: "d1", name: "Hue", area_id: "cucina", manufacturer: "Signify", identifiers: [["x"]] },
  ],
  stanze: [{ area_id: "cucina", name: "Cucina" }],
  piani: [],
};

async function banco() {
  const cartella = mkdtempSync(join(tmpdir(), "editor-"));
  const acceso = await alzaIlQuadro({
    porta: 0,
    cartella,
    livello: "errore",
    chiaveDelGestore: CHIAVE_DEL_GESTORE,
  });
  const dove = `http://127.0.0.1:${acceso.porta}`;
  const gestore = (via, opzioni = {}) =>
    fetch(`${dove}/gestore${via}`, {
      ...opzioni,
      headers: {
        authorization: `Bearer ${CHIAVE_DEL_GESTORE}`,
        "content-type": "application/json",
        ...(opzioni.headers || {}),
      },
    });
  const iscritti = [];
  for (const nome of ["Impianti Rossi", "Impianti Bianchi"]) {
    iscritti.push(
      await (
        await gestore("/installatori", { method: "POST", body: JSON.stringify({ nome }) })
      ).json(),
    );
  }
  const retro = (via, opzioni = {}, chiave = iscritti[0].chiave) =>
    fetch(`${dove}/console${via}`, {
      ...opzioni,
      headers: {
        authorization: `Bearer ${chiave}`,
        "content-type": "application/json",
        ...(opzioni.headers || {}),
      },
    });
  const unCodice = async (chiave) =>
    (await (await retro("/inviti", { method: "POST", body: "{}" }, chiave)).json()).codice;
  const daCasa = (via, codice, opzioni = {}) =>
    fetch(`${dove}${via}`, {
      ...opzioni,
      headers: {
        authorization: `Bearer ${codice}`,
        "content-type": "application/json",
        "x-casa": UNA,
        ...(opzioni.headers || {}),
      },
    });
  const deposita = async (codice, carta = rapporto()) =>
    (await daCasa("/rapporto", codice, { method: "POST", body: JSON.stringify(carta) })).json();
  const manda = (codice, scatto) =>
    daCasa("/plancia", codice, { method: "POST", body: JSON.stringify(scatto) });
  /* Il filo dell'editor, aperto come lo apre la pagina: si entra col codice
   * e si parla a messaggi numerati. */
  const filo = async (chiave = iscritti[0].chiave, profilo = "primary") => {
    const ws = new WebSocket(
      `ws://127.0.0.1:${acceso.porta}/plancia-da-lontano/${UNA}/${profilo}/websocket`,
    );
    const arrivati = [];
    const aspettano = [];
    ws.addEventListener("message", (evento) => {
      const detto = JSON.parse(evento.data);
      const chi = aspettano.shift();
      if (chi) chi(detto);
      else arrivati.push(detto);
    });
    const chiusa = new Promise((ok) => ws.addEventListener("close", () => ok()));
    await new Promise((ok, no) => {
      ws.addEventListener("open", ok, { once: true });
      ws.addEventListener("error", no, { once: true });
    });
    const prossimo = () =>
      arrivati.length ? Promise.resolve(arrivati.shift()) : new Promise((ok) => aspettano.push(ok));
    let numero = 0;
    const chiedi = async (cosa) => {
      numero += 1;
      ws.send(JSON.stringify({ id: numero, ...cosa }));
      const risposta = await prossimo();
      assert.equal(risposta.id, numero);
      return risposta;
    };
    return {
      ws,
      prossimo,
      chiedi,
      chiusa,
      entra: async (codice = chiave) => {
        ws.send(JSON.stringify({ type: "auth", access_token: codice }));
        return prossimo();
      },
    };
  };
  return {
    dove,
    retro,
    iscritti,
    unCodice,
    deposita,
    manda,
    daCasa,
    filo,
    plancia: acceso.plancia,
    chiudi: async () => {
      await acceso.spegni();
      rmSync(cartella, { recursive: true, force: true });
    },
  };
}

test("la pagina dell'editor si serve per una casa che lo permette, con le premesse e il marchio", async () => {
  const b = await banco();
  try {
    const codice = await b.unCodice();
    /* Prima del rapporto la casa non c'e': niente pagina. */
    assert.equal((await fetch(`${b.dove}/plancia-da-lontano/${UNA}/primary/`)).status, 404);
    await b.deposita(codice, rapporto({ configurazione: false }));
    assert.equal((await fetch(`${b.dove}/plancia-da-lontano/${UNA}/primary/`)).status, 404);
    await b.deposita(codice);
    await b.retro(`/casa/${UNA}/plancia/primary`, {
      method: "PUT",
      body: JSON.stringify({ titolo: "Casa Rossi", velo: "Rossi" }),
    });
    const risposta = await fetch(`${b.dove}/plancia-da-lontano/${UNA}/primary/`);
    assert.equal(risposta.status, 200);
    assert.equal(risposta.headers.get("cache-control"), "no-store");
    const pagina = await risposta.text();
    const base = b.plancia.base;
    assert.ok(pagina.includes(`<base href="${base}/legacy/" />`));
    assert.ok(pagina.includes("window.__DASHBOARDMODERN_HOSTED__=true;"));
    assert.ok(
      pagina.includes(
        `window.__DASHBOARDMODERN_INSTANCE__=${JSON.stringify(istanzaDi(UNA, "primary"))};`,
      ),
    );
    assert.ok(pagina.includes('window.__DASHBOARDMODERN_PROFILE__="primary";'));
    assert.ok(pagina.includes("window.__GDAHOME_DA_LONTANO__=true;"));
    assert.ok(pagina.includes(`/plancia-da-lontano/${UNA}/primary/websocket`));
    /* Il codice: dal deposito del cruscotto, o dal cruscotto stesso, mai
     * dall'indirizzo. */
    assert.ok(pagina.includes('localStorage.getItem("gdahome.quadro.chiave")'));
    assert.ok(pagina.includes('type:"auth",access_token:chiave'));
    assert.ok(pagina.includes("evento.origin!==location.origin"));
    /* La Configurazione e basta. */
    assert.ok(pagina.includes('id="gdahome-da-lontano"'));
    assert.ok(
      pagina.includes(
        "html body nav.tabs.bottom-nav-bar,html body .bottom-nav-handle{display:none!important}",
      ),
    );
    assert.ok(pagina.includes('getAttribute("data-tab")==="config"'));
    /* Il deposito di questa istanza si svuota prima che la pagina lo legga. */
    assert.ok(pagina.includes(JSON.stringify(`cd_${istanzaDi(UNA, "primary")}_`)));
    /* Le vesti scelte dal cruscotto, e il nome di chi installa. */
    assert.ok(pagina.includes('window.__GDAHOME_VELO__="Rossi";'));
    assert.ok(pagina.includes('window.__GDAHOME_TESTATA__=["Casa","Rossi"];'));
    assert.ok(pagina.includes("<title>Casa Rossi</title>"));
    assert.ok(pagina.includes("<b>Rossi</b>"));
    /* Una pagina di un'altra plancia, o di un'altra casa, non parla a questo
     * filo. */
    const altra = await (await fetch(`${b.dove}/plancia-da-lontano/${UNA}/suocero/`)).text();
    assert.ok(altra.includes(`/plancia-da-lontano/${UNA}/suocero/websocket`));
  } finally {
    await b.chiudi();
  }
});

test("i file della plancia si servono sotto l'impronta, senza chiave e senza marchio", async () => {
  const b = await banco();
  try {
    const foglio = await fetch(`${b.dove}${b.plancia.base}/legacy/dashboard-runtime-it.css`);
    assert.equal(foglio.status, 200);
    assert.equal(foglio.headers.get("content-type"), "text/css; charset=utf-8");
    assert.equal(foglio.headers.get("cache-control"), "public, max-age=31536000, immutable");
    assert.equal(
      (await fetch(`${b.dove}${BASE}/0000000000000000/legacy/dashboard.html`)).status,
      404,
    );
    assert.equal((await fetch(`${b.dove}${b.plancia.base}/legacy/../ORIGINE.json`)).status, 404);
    assert.equal((await fetch(`${b.dove}${BASE}/brands/../../package.json`)).status, 404);
    const nostro = new PlanciaServita();
    assert.equal(nostro.impronta, b.plancia.impronta);
  } finally {
    await b.chiudi();
  }
});

test("sul filo si entra col codice, per una casa propria che lo permette; poi l'inventario esce cieco", async () => {
  const b = await banco();
  try {
    const codice = await b.unCodice();
    await b.deposita(codice);
    await b.manda(codice, {
      profilo: "primary",
      titolo: "Casa",
      revisione: 12,
      chiavi: 4,
      generazione: 2,
      aggiornataIl: 1700000000000,
      valori: VALORI,
      inventario: INVENTARIO,
    });

    /* Senza codice, o col codice sbagliato, o col codice di un altro
     * installatore: fuori, con una parola che la pagina sa leggere. */
    const muto = await b.filo();
    muto.ws.send(JSON.stringify({ id: 1, type: "get_states" }));
    assert.equal((await muto.prossimo()).type, "auth_invalid");
    await muto.chiusa;
    const sbagliato = await b.filo();
    assert.equal((await sbagliato.entra("non-questa")).type, "auth_invalid");
    await sbagliato.chiusa;
    const diBianchi = await b.filo(b.iscritti[1].chiave);
    const no = await diBianchi.entra();
    assert.equal(no.type, "auth_invalid");
    assert.match(no.message, /non la segui tu/);
    await diBianchi.chiusa;

    const filo = await b.filo();
    assert.deepEqual(await filo.entra(), { type: "auth_ok", ha_version: "gdahome" });

    /* Gli stati: ciechi, e senza l'indirizzo dell'immagine. */
    const stati = await filo.chiedi({ type: "get_states" });
    assert.equal(stati.success, true);
    assert.deepEqual(stati.result, [
      { entity_id: "light.cucina", state: "unknown", attributes: { friendly_name: "Cucina" } },
      { entity_id: "camera.ingresso", state: "unknown", attributes: { friendly_name: "Ingresso" } },
    ]);
    const registro = await filo.chiedi({ type: "config/entity_registry/list" });
    assert.deepEqual(registro.result, [
      { entity_id: "light.cucina", device_id: "d1", platform: "hue" },
    ]);
    const dispositivi = await filo.chiedi({ type: "config/device_registry/list" });
    assert.deepEqual(dispositivi.result, [
      { id: "d1", name: "Hue", area_id: "cucina", manufacturer: "Signify" },
    ]);
    assert.deepEqual((await filo.chiedi({ type: "config/area_registry/list" })).result, [
      { area_id: "cucina", name: "Cucina" },
    ]);
    assert.deepEqual((await filo.chiedi({ type: "config/floor_registry/list" })).result, []);

    /* Ci si abbona, e non arriva niente; la casa non ha un posto. */
    assert.equal(
      (await filo.chiedi({ type: "subscribe_events", event_type: "state_changed" })).success,
      true,
    );
    const casa = await filo.chiedi({ type: "get_config" });
    assert.equal(casa.result.version, "2026.9.1");
    assert.equal(casa.result.latitude, null);
    assert.equal(
      (await filo.chiedi({ type: "frontend/get_user_data", key: "x" })).result.value,
      null,
    );

    /* Lo scatto, com'e' arrivato da casa, con i suoi numeri. */
    const letta = await filo.chiedi({ type: "dashboardmodern/config/get", profile: "primary" });
    assert.equal(letta.result.profile, "primary");
    assert.deepEqual(letta.result.snapshot, {
      revision: 12,
      updated_at: 1700000000000,
      keys_revision: 4,
      writer_generation: 2,
      reset: false,
      values: VALORI,
    });

    /* Il catalogo delle integrazioni, dai registri. */
    const catalogo = await filo.chiedi({ type: "dashboardmodern/integrations/catalog" });
    assert.equal(catalogo.success, true);
    assert.ok(JSON.stringify(catalogo.result).includes("hue"));

    /* Quello che da lontano non si fa: comandi, flussi, storia, foto,
     * azzeramenti. Per nome. */
    for (const type of [
      "call_service",
      "camera/stream",
      "camera_thumbnail",
      "auth/sign_path",
      "history/history_during_period",
      "dashboardmodern/www/upload",
      "dashboardmodern/config/restore",
      "conversation/process",
    ]) {
      const risposta = await filo.chiedi({ type });
      assert.equal(risposta.success, false, type);
      assert.equal(risposta.error.code, "not_allowed", type);
    }
    filo.ws.close();
    await filo.chiusa;
  } finally {
    await b.chiudi();
  }
});

test("un salvataggio dall'editor diventa un lavoro «configura» che la casa ritira, e la pagina rilegge il suo", async () => {
  const b = await banco();
  try {
    const codice = await b.unCodice();
    await b.deposita(codice);
    await b.manda(codice, { profilo: "primary", titolo: "Casa", revisione: 12, valori: VALORI });
    const filo = await b.filo();
    await filo.entra();

    const nuovi = {
      ...VALORI,
      cd_stanze: JSON.stringify([{ id: "cucina", name: "Cucina nuova" }]),
    };
    const salvata = await filo.chiedi({
      type: "dashboardmodern/config/set",
      profile: "primary",
      snapshot: { values: nuovi, keys_revision: 4, writer_generation: 2 },
      expected_revision: 12,
    });
    assert.equal(salvata.success, true);
    assert.equal(salvata.result.status, "saved");
    assert.equal(salvata.result.snapshot.revision, 13);
    assert.deepEqual(salvata.result.snapshot.values, nuovi);

    /* Riletta subito dopo, e' quella scritta: non quella di prima con una
     * revisione piu' bassa, che la pagina crederebbe un conflitto. */
    const riletta = await filo.chiedi({ type: "dashboardmodern/config/get", profile: "primary" });
    assert.equal(riletta.result.snapshot.revision, 13);
    assert.deepEqual(riletta.result.snapshot.values, nuovi);

    /* Il lavoro e' in coda per la casa, con la revisione su cui si e'
     * scritto; la casa lo ritira una volta sola. */
    const risposta = await b.deposita(codice);
    assert.equal(risposta.fai.cosa, "configura");
    assert.equal(risposta.fai.nome, "primary");
    assert.equal(risposta.fai.da, "12");
    /* Un secondo salvataggio prima che la casa passi riscrive sotto lo
     * stesso lavoro: quello che ritira e' l'ultimo. */
    const ancora = { ...nuovi, cd_stanze: JSON.stringify([{ id: "cucina", name: "Cucina tre" }]) };
    const seconda = await filo.chiedi({
      type: "dashboardmodern/config/set",
      profile: "primary",
      snapshot: { values: ancora, keys_revision: 4, writer_generation: 2 },
      expected_revision: 13,
    });
    assert.equal(seconda.result.status, "saved");
    assert.equal(seconda.result.snapshot.revision, 14);
    const ritiro = await b.daCasa(`/plancia/primary?id=${risposta.fai.id}`, codice);
    assert.equal(ritiro.status, 200);
    const consegna = await ritiro.json();
    assert.deepEqual(consegna.valori, ancora);
    assert.equal(consegna.revisioneAttesa, 12);

    /* Un flusso non passa, nemmeno da qui; e una plancia non si azzera. */
    const conFlusso = await filo.chiedi({
      type: "dashboardmodern/config/set",
      profile: "primary",
      snapshot: {
        values: { ...nuovi, cd_telecamere: JSON.stringify([{ stream: "rtsp://u:p@10.0.0.9/a" }]) },
      },
    });
    assert.equal(conFlusso.success, false);
    assert.equal(conFlusso.error.code, "flussi");
    const azzera = await filo.chiedi({
      type: "dashboardmodern/config/set",
      profile: "primary",
      snapshot: { values: {} },
      reset: true,
    });
    assert.equal(azzera.error.code, "not_allowed");
    /* Un'altra plancia su questo filo: no. */
    const altra = await filo.chiedi({ type: "dashboardmodern/config/get", profile: "suocero" });
    assert.equal(altra.success, false);
    filo.ws.close();
    await filo.chiusa;
  } finally {
    await b.chiudi();
  }
});

test("chi apre l'editor chiede lo scatto di adesso: la casa in linea passa subito, e lo manda anche a revisione ferma", async () => {
  const b = await banco();
  try {
    const codice = await b.unCodice();
    await b.deposita(codice);
    await b.manda(codice, { profilo: "primary", titolo: "Casa", revisione: 12, valori: VALORI });
    /* A revisione ferma il quadro non lo richiede. */
    assert.equal("vuoleLaPlancia" in (await b.deposita(codice)), false);

    const stato = await (await b.retro(`/casa/${UNA}/plancia/primary/stato`)).json();
    assert.equal(stato.scatto.revisione, 12);
    assert.equal(stato.inventario, false);
    assert.equal(stato.inLinea, false);
    assert.equal(stato.editor, b.plancia.versione());

    const inLinea = b.daCasa("/attesa", codice);
    await new Promise((ok) => setTimeout(ok, 50));
    const chiesto = await b.retro(`/casa/${UNA}/plancia/primary/rinfresca`, { method: "POST" });
    assert.equal(chiesto.status, 200);
    assert.equal((await chiesto.json()).inLinea, true);
    assert.deepEqual(await (await inLinea).json(), { rapporto: true });
    /* E al rapporto che segue lo scatto si richiede, revisione o no. */
    assert.deepEqual((await b.deposita(codice)).vuoleLaPlancia, ["primary"]);
    await b.manda(codice, {
      profilo: "primary",
      titolo: "Casa",
      revisione: 12,
      valori: VALORI,
      inventario: INVENTARIO,
    });
    assert.equal("vuoleLaPlancia" in (await b.deposita(codice)), false);
    assert.equal(
      (await (await b.retro(`/casa/${UNA}/plancia/primary/stato`)).json()).inventario,
      true,
    );

    /* Non per una casa di un altro, non per una che non lo permette. */
    const diBianchi = await b.retro(
      `/casa/${UNA}/plancia/primary/rinfresca`,
      { method: "POST" },
      b.iscritti[1].chiave,
    );
    assert.equal(diBianchi.status, 404);
    await b.deposita(codice, rapporto({ configurazione: false }));
    assert.equal(
      (await b.retro(`/casa/${UNA}/plancia/primary/rinfresca`, { method: "POST" })).status,
      409,
    );
  } finally {
    await b.chiudi();
  }
});

test("il cruscotto apre l'editor in un riquadro sopra la pagina, e la gestione no", () => {
  /* Il riquadro sta fuori da quello che si ridisegna a ogni rapporto: un
   * editor che si ricarica ogni dieci secondi non e' un editor. */
  assert.match(CRUSCOTTO, /<main id="dove"><\/main>/);
  assert.match(CRUSCOTTO, /<div id="editor-plancia" class="editor-plancia" hidden>/);
  assert.match(CRUSCOTTO, /<iframe\s+id="editor-riquadro"/);
  assert.match(CRUSCOTTO, /async function apriLEditor\(casa, profilo\)/);
  /* Le due vie del cruscotto, e la pagina dell'editor per indirizzo relativo. */
  assert.match(CRUSCOTTO, /\/casa\/\$\{casa\}\/plancia\/\$\{profilo\}\/rinfresca`/);
  assert.match(CRUSCOTTO, /\/casa\/\$\{casa\}\/plancia\/\$\{profilo\}\/stato`/);
  assert.match(CRUSCOTTO, /`\.\.\/plancia-da-lontano\/\$\{casa\}\/\$\{profilo\}\/`/);
  /* Il codice al riquadro con un messaggio, alla propria origine: non
   * nell'indirizzo. */
  assert.match(CRUSCOTTO, /postMessage\(\{ gdahome: "chiave", chiave \}, location\.origin\)/);
  /* La casella di JSON non c'e' piu'. */
  assert.doesNotMatch(CRUSCOTTO, /textarea\.configurazione|data-plancia-testo|lEditorDi/);
  assert.doesNotMatch(GESTIONE, /editor-plancia|plancia-da-lontano|data-configura-plancia/);
});
