/* I segni degli aggiornamenti: da dove arrivano, quando si richiedono, quando
 * si rinuncia (`core/loghi-degli-aggiornamenti.js`).
 *
 * «Sull'iPhone, nella finestra Aggiornamenti pendenti, una lettera per riga al
 * posto dell'icona.» Le regole qui sotto sono quelle che la tolgono: un no di
 * un momento non e' per sempre, dove c'e' il ponte non si va mai a indirizzi
 * diretti, e dove il ponte non c'e' valgono solo i due che Home Assistant usa
 * da se'.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ATTESA_DEL_LOGO,
  creaLaMemoriaDeiLoghi,
  esitoDelGuasto,
  esitoDellaRisposta,
  fraQuantoSiRiprova,
  indirizzoDiretto,
} from "../src/core/loghi-degli-aggiornamenti.js";
import { bridgeRequest } from "../src/sections/config-persistence-section.js";

const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const presa = { stato: 200, tipo: "image/png", corpo: PNG };
const unGiro = () => new Promise((fatto) => setTimeout(fatto, 0));

test("gli indirizzi diretti: solo i due di Home Assistant, e mai dove c'e' il ponte", () => {
  const addon = "/api/hassio/addons/a0d7b954_proxmox/icon";
  const marchio = "https://brands.home-assistant.io/_/frigate/icon.png";
  assert.equal(indirizzoDiretto(addon), addon);
  assert.equal(
    indirizzoDiretto("/api/hassio/addons/core_mosquitto/logo"),
    "/api/hassio/addons/core_mosquitto/logo",
  );
  assert.equal(indirizzoDiretto(marchio), marchio);
  /* Dentro l'app e nella pagina del ponte, niente: c'e' il ponte. */
  assert.equal(indirizzoDiretto(addon, { colPonte: true }), "");
  assert.equal(indirizzoDiretto(marchio, { colPonte: true }), "");
  /* Tutto il resto no: altri host, altre strade di casa, gettoni, salti. */
  for (const no of [
    "",
    "https://example.com/icon.png",
    "http://brands.home-assistant.io/_/frigate/icon.png",
    "https://brands.home-assistant.io.example.com/x.png",
    "//brands.home-assistant.io/_/frigate/icon.png",
    "/api/camera_proxy/camera.porta?token=abc",
    "/api/hassio/addons/core_ssh/info",
    "/api/hassio/addons/../backups/icon",
    "/api/hassio/addons/a0d7b954_proxmox/icon?token=abc",
    "https://brands.home-assistant.io/_/frigate/icon.png?token=abc",
    "javascript:alert(1)",
    "data:image/png;base64,AAAA",
  ])
    assert.equal(indirizzoDiretto(no), "", no);
});

test("una risposta del ponte: l'immagine, il no che e' una risposta, l'intoppo", () => {
  assert.deepEqual(esitoDellaRisposta(presa), {
    esito: "preso",
    url: `data:image/png;base64,${PNG}`,
  });
  assert.equal(
    esitoDellaRisposta({ stato: 200, tipo: "image/svg+xml; charset=utf-8", corpo: PNG }).url,
    `data:image/svg+xml;base64,${PNG}`,
  );
  for (const stato of [403, 404, 410]) assert.equal(esitoDellaRisposta({ stato }).esito, "niente");
  for (const stato of [0, 500, 502, 504])
    assert.equal(esitoDellaRisposta({ stato }).esito, "caduto");
  assert.equal(esitoDellaRisposta(null).esito, "caduto");
  /* Quello che non e' un'immagine non diventa un `data:` da disegnare. */
  assert.equal(esitoDellaRisposta({ stato: 200, tipo: "text/html", corpo: PNG }).esito, "niente");
  assert.equal(
    esitoDellaRisposta({ stato: 200, tipo: "image/png", corpo: "<script>" }).esito,
    "niente",
  );
  assert.equal(esitoDellaRisposta({ stato: 200, tipo: "image/png", corpo: "" }).esito, "niente");
});

test("un no del filo: chi non sa la domanda non e' un intoppo", () => {
  assert.equal(esitoDelGuasto({ code: "not_found" }), "niente");
  assert.equal(esitoDelGuasto({ code: "unknown_command" }), "nonSa");
  /* Il pannello di Home Assistant lo dice cosi', senza il ponte. */
  assert.equal(esitoDelGuasto(new Error("Unknown command.")), "nonSa");
  assert.equal(esitoDelGuasto(new Error("ponte/aggiornamenti/logo timed out")), "caduto");
  assert.equal(esitoDelGuasto(new Error("ponte/aggiornamenti/logo bridge error")), "caduto");
  assert.equal(esitoDelGuasto(undefined), "caduto");
});

test("si riprova sempre piu' di rado, ma si riprova", () => {
  assert.equal(fraQuantoSiRiprova(1), 3_000);
  assert.equal(fraQuantoSiRiprova(2), 6_000);
  assert.ok(fraQuantoSiRiprova(3) > fraQuantoSiRiprova(2));
  assert.equal(fraQuantoSiRiprova(50), 120_000);
  /* Piu' di quanto aspetta l'app, che e' quanto il ponte ci mette davvero. */
  assert.ok(ATTESA_DEL_LOGO >= 12_000);
});

test("la memoria: un intoppo si richiede, una risposta si tiene", async () => {
  let ora = 1_000;
  const chiesti = [];
  const arrivati = [];
  const riprove = [];
  let rispondi = () => Promise.reject(new Error("ponte/aggiornamenti/logo timed out"));
  const loghi = creaLaMemoriaDeiLoghi({
    chiedi: (entita) => {
      chiesti.push(entita);
      return rispondi(entita);
    },
    arrivato: (entita, url) => arrivati.push([entita, url]),
    riprova: (entita, fra) => riprove.push([entita, fra]),
    colPonte: () => true,
    adesso: () => ora,
  });
  /* Prima volta: la lettera, e la domanda parte. */
  assert.equal(
    loghi.logo("update.frigate_server", "https://brands.home-assistant.io/_/frigate/icon.png"),
    "",
  );
  await unGiro();
  assert.deepEqual(chiesti, ["update.frigate_server"]);
  assert.equal(loghi.voce("update.frigate_server").esito, "caduto");
  assert.deepEqual(riprove, [["update.frigate_server", 3_000]]);
  /* Dentro l'app nessun indirizzo diretto, neanche intanto. */
  assert.equal(loghi.logo("update.frigate_server"), "");
  await unGiro();
  assert.equal(chiesti.length, 1, "prima dell'ora non si richiede");
  /* Passata l'ora, si richiede: e stavolta arriva. */
  ora += 3_001;
  rispondi = () => Promise.resolve(presa);
  loghi.logo("update.frigate_server");
  await unGiro();
  assert.equal(chiesti.length, 2);
  assert.deepEqual(arrivati, [["update.frigate_server", `data:image/png;base64,${PNG}`]]);
  assert.equal(loghi.logo("update.frigate_server"), `data:image/png;base64,${PNG}`);
  /* Preso e' preso: non si chiede piu'. */
  ora += 1_000_000;
  loghi.logo("update.frigate_server");
  await unGiro();
  assert.equal(chiesti.length, 2);
  /* E «non ce n'e' uno» e' una risposta: si tiene. */
  rispondi = () => Promise.resolve({ stato: 404 });
  loghi.logo("update.firmware");
  await unGiro();
  loghi.logo("update.firmware");
  await unGiro();
  assert.equal(chiesti.filter((chi) => chi === "update.firmware").length, 1);
  assert.equal(loghi.voce("update.firmware").esito, "niente");
});

test("la memoria: una domanda per volta per entita', al massimo quattro insieme", async () => {
  const aperte = [];
  const loghi = creaLaMemoriaDeiLoghi({
    chiedi: (entita) =>
      new Promise((fatto) => {
        aperte.push([entita, fatto]);
      }),
    colPonte: () => true,
  });
  for (let i = 0; i < 6; i += 1) {
    loghi.logo(`update.uno_${i}`);
    loghi.logo(`update.uno_${i}`);
  }
  await unGiro();
  assert.equal(aperte.length, 4);
  aperte[0][1](presa);
  await unGiro();
  await unGiro();
  assert.equal(aperte.length, 5);
  assert.deepEqual(
    aperte.map(([chi]) => chi),
    ["update.uno_0", "update.uno_1", "update.uno_2", "update.uno_3", "update.uno_4"],
  );
});

test("fuori dal ponte: l'indirizzo che Home Assistant usa da se', o la lettera", async () => {
  /* Il pannello di Home Assistant: la domanda torna «non conosco». */
  const nelPannello = creaLaMemoriaDeiLoghi({
    chiedi: () =>
      Promise.reject(Object.assign(new Error("Unknown command."), { code: "unknown_command" })),
    colPonte: () => false,
  });
  const addon = "/api/hassio/addons/a0d7b954_proxmox/icon";
  nelPannello.logo("update.proxmox_ve_update", addon);
  await unGiro();
  assert.equal(nelPannello.logo("update.proxmox_ve_update", addon), addon);
  /* Un indirizzo di casa che non e' l'icona di un add-on: lettera. */
  nelPannello.logo("update.altro", "/api/image_proxy/image.x?token=abc");
  await unGiro();
  assert.equal(nelPannello.logo("update.altro"), "");
  /* Senza nessuno da chiedere, subito l'indirizzo. */
  const senza = creaLaMemoriaDeiLoghi({ chiedi: null });
  assert.equal(
    senza.logo("update.core", "https://brands.home-assistant.io/homeassistant/icon.png"),
    "https://brands.home-assistant.io/homeassistant/icon.png",
  );
  /* E un ponte che non c'e' (la plancia fuori dall'app, `null`) e' lo stesso. */
  const nulla = creaLaMemoriaDeiLoghi({ chiedi: () => Promise.resolve(null) });
  nulla.logo("update.proxmox_ve_update", addon);
  await unGiro();
  assert.equal(nulla.logo("update.proxmox_ve_update", addon), addon);
});

test("la sezione chiede col ponte, rimanda la lettura e posa il segno dove la riga c'e'", () => {
  const sezione = readFileSync(
    new URL("../src/sections/home-widgets-section.js", import.meta.url),
    "utf8",
  );
  assert.match(
    sezione,
    /"ponte\/aggiornamenti\/logo",\s*\{ entity_id: entita \},\s*\{ attesa: ATTESA_DEL_LOGO, rimanda: true \}/,
  );
  assert.match(sezione, /colPonte: \(\) => root\.__GDAHOME__ === true/);
  assert.match(sezione, /function posaIlLogo\(entita, url\)/);
  const persistenza = readFileSync(
    new URL("../src/sections/config-persistence-section.js", import.meta.url),
    "utf8",
  );
  assert.match(
    persistenza,
    /export function bridgeRequest\(type, payload = \{\}, \{ attesa = 8000, rimanda = false \} = \{\}\)/,
  );
});

/* La cucitura dell'app, in piccolo: la presa si apre subito, l'`auth_ok` arriva
 * quando il filo e' su, e quello che arriva prima si butta
 * (`app/lib/plancia/cucitura.dart`, `dallaPagina`). */
function laCucituraDellApp({ filoSuDopo }) {
  const visti = { buttati: [], presi: [] };
  class Cucitura {
    constructor() {
      this.readyState = 0;
      this.dentro = false;
      setTimeout(() => {
        this.readyState = 1;
      }, 1);
      setTimeout(() => {
        this.dentro = true;
        this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
      }, filoSuDopo);
    }
    send(testo) {
      const detto = JSON.parse(testo);
      if (!this.dentro) {
        visti.buttati.push(detto.type);
        return;
      }
      visti.presi.push(detto.type);
      setTimeout(() =>
        this.onmessage?.({
          data: JSON.stringify({ id: detto.id, type: "result", success: true, result: presa }),
        }),
      );
    }
    close() {
      this.readyState = 3;
    }
  }
  return { Cucitura, visti };
}

async function conLaCucitura(filoSuDopo, prova) {
  const { Cucitura, visti } = laCucituraDellApp({ filoSuDopo });
  globalThis.__DASHBOARDMODERN_HOSTED__ = true;
  globalThis.__DASHBOARDMODERN_BRIDGE_WS__ = Cucitura;
  try {
    await prova(visti);
  } finally {
    delete globalThis.__DASHBOARDMODERN_HOSTED__;
    delete globalThis.__DASHBOARDMODERN_BRIDGE_WS__;
  }
}

test("una lettura partita prima della porta si rimanda quando la porta si apre", async () => {
  await conLaCucitura(120, async (visti) => {
    const risposta = await bridgeRequest(
      "ponte/aggiornamenti/logo",
      { entity_id: "update.frigate_server" },
      { attesa: 2_000, rimanda: true },
    );
    assert.deepEqual(risposta, presa);
    assert.deepEqual(visti.buttati, ["ponte/aggiornamenti/logo"]);
    assert.deepEqual(visti.presi, ["ponte/aggiornamenti/logo"]);
  });
});

test("senza `rimanda` resta com'era: una scrittura non parte due volte", async () => {
  await conLaCucitura(120, async (visti) => {
    await assert.rejects(
      bridgeRequest("dashboardmodern/config/set", { profile: "primary" }, { attesa: 400 }),
      /timed out/,
    );
    assert.deepEqual(visti.buttati, ["dashboardmodern/config/set"]);
    assert.deepEqual(visti.presi, []);
  });
});

test("con la porta gia' aperta la lettura parte una volta sola", async () => {
  await conLaCucitura(2, async (visti) => {
    await bridgeRequest("ponte/aggiornamenti/logo", { entity_id: "update.x" }, { rimanda: true });
    assert.deepEqual(visti.buttati, []);
    assert.deepEqual(visti.presi, ["ponte/aggiornamenti/logo"]);
  });
});

test("il no del ponte porta il suo codice", async () => {
  class Rifiuta {
    constructor() {
      this.readyState = 1;
      setTimeout(() => this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) }));
    }
    send(testo) {
      const { id } = JSON.parse(testo);
      setTimeout(() =>
        this.onmessage?.({
          data: JSON.stringify({
            id,
            type: "result",
            success: false,
            error: { code: "unknown_command", message: "Unknown command." },
          }),
        }),
      );
    }
    close() {}
  }
  globalThis.__DASHBOARDMODERN_HOSTED__ = true;
  globalThis.__DASHBOARDMODERN_BRIDGE_WS__ = Rifiuta;
  try {
    const errore = await bridgeRequest("ponte/aggiornamenti/logo", {}).catch((e) => e);
    assert.equal(errore.code, "unknown_command");
    assert.equal(esitoDelGuasto(errore), "nonSa");
  } finally {
    delete globalThis.__DASHBOARDMODERN_HOSTED__;
    delete globalThis.__DASHBOARDMODERN_BRIDGE_WS__;
  }
});
