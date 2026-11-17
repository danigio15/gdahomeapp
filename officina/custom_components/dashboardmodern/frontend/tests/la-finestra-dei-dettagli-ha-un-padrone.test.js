/* «Se clicco su apertura telecamera, dopo un po' compaiono le luci, ma sopra
 * c'è ancora la camera.»
 *
 * La finestra dei dettagli e' una sola e ci scrivono in tanti. Il ridisegno
 * delle luci, a ogni luce che cambiava in casa, guardava solo che la finestra
 * fosse aperta — e con la telecamera davanti la riempiva di luci, sotto il
 * titolo «📹 …», col video ancora acceso dietro. E al contrario: la strada di
 * una telecamera che rispondeva tardi scriveva il suo video sulle luci aperte
 * nel frattempo.
 *
 * Adesso la finestra ha un padrone (`dmFinestraDi` nel guscio, letto da
 * `core/chi-ha-la-finestra.js`) e il motore delle telecamere numera le sue
 * aperture: chi scrive dopo, prima guarda che sia ancora roba sua.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

import {
  FINESTRA_LUCI,
  FINESTRA_TELECAMERA,
  laFinestraEDi,
  padroneDellaFinestra,
} from "../src/core/chi-ha-la-finestra.js";

const leggi = (percorso) => readFileSync(new URL(percorso, import.meta.url), "utf8");
const GUSCI = {
  it: leggi("../legacy/dashboard-runtime-it.js"),
  en: leggi("../legacy/dashboard-runtime-en.js"),
};
const LUCI = leggi("../src/sections/lights-scene-section.js");
const ELETTRODOMESTICO = leggi("../src/sections/appliance-detail-popup-section.js");
const SUBITO = leggi("../src/sections/telecamera-subito-section.js");

function finestra({ aperta = true, dataset = {} } = {}) {
  const classi = new Set(aperta ? ["show"] : []);
  return {
    dataset: { ...dataset },
    classList: {
      contains: (nome) => classi.has(nome),
      add: (nome) => classi.add(nome),
      remove: (nome) => classi.delete(nome),
    },
  };
}

test("la finestra dice chi la tiene, e chiusa non e' di nessuno", () => {
  const aperta = finestra({ dataset: { dmFinestra: "camera_view", dmGettone: "7" } });
  assert.deepEqual({ ...padroneDellaFinestra(aperta) }, { tipo: "camera_view", gettone: "7" });
  assert.equal(laFinestraEDi(aperta, FINESTRA_TELECAMERA), true);
  /* Aperta, ma non delle luci: le luci non la ridisegnano. */
  assert.equal(laFinestraEDi(aperta, FINESTRA_LUCI), false);
  assert.equal(padroneDellaFinestra(finestra({ aperta: false, dataset: aperta.dataset })), null);
  assert.equal(laFinestraEDi(null, FINESTRA_LUCI), false);
});

test("col gettone, la stessa specie riaperta per un'altra cosa non e' piu' la sua", () => {
  const aperta = finestra({ dataset: { dmFinestra: "appliance_view", dmGettone: "4" } });
  assert.equal(laFinestraEDi(aperta, "appliance_view", { gettone: 4 }), true);
  aperta.dataset.dmGettone = "5";
  assert.equal(laFinestraEDi(aperta, "appliance_view", { gettone: 4 }), false);
});

test("un guscio che il padrone non lo scrive si legge dal suo tipo", () => {
  const vecchia = finestra();
  assert.equal(laFinestraEDi(vecchia, FINESTRA_LUCI, { ripiego: "gestione_luci" }), true);
  assert.equal(laFinestraEDi(vecchia, FINESTRA_LUCI, { ripiego: "camera_view" }), false);
  /* Quando il padrone e' scritto, vale lui e non il ripiego. */
  const scritta = finestra({ dataset: { dmFinestra: "camera_view", dmGettone: "1" } });
  assert.equal(laFinestraEDi(scritta, FINESTRA_LUCI, { ripiego: "gestione_luci" }), false);
});

/* Le funzioni del guscio, prese dal file vero ed eseguite in una scatola. */
function funzione(sorgente, nome) {
  const inizio = sorgente.search(new RegExp(`\\nfunction ${nome}\\(`));
  assert.ok(inizio >= 0, `${nome} non c'e' nel guscio`);
  const fine = sorgente.indexOf("\n}\n", inizio);
  return sorgente.slice(inizio, fine + 3);
}

function scatola(sorgente) {
  const modal = finestra({ aperta: false });
  const lista = { dataset: {}, isConnected: true, innerHTML: "" };
  const chiuse = [];
  const contesto = {
    document: { getElementById: (id) => (id === "details-modal" ? modal : null) },
    dmCamCleanup: () => chiuse.push("pulizia"),
  };
  const codice = [
    "let currentPopupType = null;",
    "let _dmFinestraGiro = 0;",
    "let _dmCamApertura = 0;",
    "const DM_CAM_SUPERATA = 'superata';",
    ...[
      "dmFinestraDi",
      "dmCamNuovaApertura",
      "dmCamAncoraAperta",
      "dmCamCorpo",
      "dmCamChiudi",
    ].map((nome) => funzione(sorgente, nome)),
    "globalThis.leggi = () => ({ tipo: currentPopupType, giro: _dmFinestraGiro });",
  ].join("\n");
  vm.runInNewContext(codice, contesto);
  return { ...contesto, modal, lista, chiuse };
}

for (const [lingua, sorgente] of Object.entries(GUSCI)) {
  test(`guscio ${lingua}: chi apre si prende la finestra, e lasciare la telecamera la ferma`, () => {
    const s = scatola(sorgente);
    s.dmFinestraDi("camera_view", true);
    s.modal.classList.add("show");
    assert.equal(s.modal.dataset.dmFinestra, "camera_view");
    const gettoneTelecamera = s.modal.dataset.dmGettone;
    assert.deepEqual(s.chiuse, []);

    /* Le luci prendono la finestra: la telecamera si chiude davvero. */
    s.dmFinestraDi("gestione_luci", true);
    assert.equal(s.modal.dataset.dmFinestra, "gestione_luci");
    assert.notEqual(s.modal.dataset.dmGettone, gettoneTelecamera);
    assert.deepEqual(s.chiuse, ["pulizia"]);

    /* Il ridisegno dello stesso contenuto non cambia gettone. */
    const gettoneLuci = s.modal.dataset.dmGettone;
    s.dmFinestraDi("gestione_luci", false);
    assert.equal(s.modal.dataset.dmGettone, gettoneLuci);
    assert.deepEqual(s.chiuse, ["pulizia"]);
  });

  test(`guscio ${lingua}: la strada che risponde tardi non scrive nel corpo di un altro`, () => {
    const s = scatola(sorgente);
    const apertura = s.dmCamNuovaApertura(s.lista);
    const corpo = s.dmCamCorpo(s.lista, apertura);
    corpo.innerHTML = "<video>";
    assert.equal(s.lista.innerHTML, "<video>");

    /* La finestra passa alle luci mentre la strada aspetta. */
    s.dmCamChiudi();
    s.lista.innerHTML = "<luci>";
    assert.throws(() => {
      corpo.innerHTML = "<video tardi>";
    }, /superata/);
    assert.equal(s.lista.innerHTML, "<luci>");
    assert.equal(s.dmCamAncoraAperta(s.lista, apertura), false);

    /* Un riquadro tolto dalla pagina non e' piu' di nessuno. */
    const riquadro = { dataset: {}, isConnected: true, innerHTML: "" };
    const sua = s.dmCamNuovaApertura(riquadro);
    assert.equal(s.dmCamAncoraAperta(riquadro, sua), true);
    riquadro.isConnected = false;
    assert.equal(s.dmCamAncoraAperta(riquadro, sua), false);
  });

  test(`guscio ${lingua}: ogni apertura della finestra dei dettagli passa da dmFinestraDi`, () => {
    /* L'unico tipo scritto a mano resta quello dei sottocarichi, che hanno una
     * finestra loro (`subloads-modal`), e il `null` della chiusura. */
    const scritti = [...sorgente.matchAll(/(?<!let )currentPopupType\s*=\s*([^=;][^;]*);/g)]
      .map((preso) => preso[1].trim())
      .filter((valore) => !valore.startsWith("="));
    assert.deepEqual(scritti.sort(), ["'subloads_' + type", "null", "tipo"].sort());
    assert.match(sorgente, /function dmFinestraDi\(tipo, nuova\) \{[\s\S]*?currentPopupType = tipo;/);
    for (const chiamata of [
      "dmFinestraDi('appliance_view', true)",
      "dmFinestraDi('avviso_custom', true)",
      "dmFinestraDi('gestione_luci', isClick)",
      "dmFinestraDi('camera_view', true)",
      "dmFinestraDi(tipo, !!e)",
    ])
      assert.ok(sorgente.includes(chiamata), chiamata);
    /* Chiudere la finestra chiude anche l'apertura della telecamera. */
    assert.match(sorgente, /try \{ dmCamChiudi\(\); \} catch\(e\) \{\}\s*currentPopupType = null;/);
    /* Le strade scrivono nel corpo che si ferma, non nella lista nuda. */
    assert.match(sorgente, /WebRTC: \(strada\) => dmCamWebRTC\(cam, strada, corpo, strada\.attesa\)/);
    assert.match(sorgente, /catch \(err\) \{[\s\S]{0,260}?if \(!mia\(\)\) return;/);
  });
}

test("le luci si ridisegnano solo nella finestra che e' loro", () => {
  assert.match(LUCI, /laFinestraEDi\(doc\?\.getElementById\("details-modal"\), FINESTRA_LUCI/);
  /* Il controllo sta prima di qualunque scrittura nella lista. */
  const sync = LUCI.slice(LUCI.indexOf("function sync() {"));
  assert.ok(sync.indexOf("if (!popupOurs())") < sync.indexOf("return paint()"));
  assert.doesNotMatch(LUCI, /function popupShowing\(/);
});

test("il catalogo arrivato tardi riveste solo l'elettrodomestico che aveva aperto", () => {
  assert.match(ELETTRODOMESTICO, /laFinestraEDi\(modal, FINESTRA_ELETTRODOMESTICO, \{\s*gettone: state\.gettone/);
});

test("la telecamera aperta subito non scrive e non ripulisce dopo che e' passata ad altri", () => {
  assert.match(SUBITO, /const apertura = giaAperta \|\| nuovaApertura\(content\);/);
  assert.match(SUBITO, /await corsaDelGuscio\(corta, cam, corpo\);/);
  assert.match(SUBITO, /\} catch \(_errore\) \{\s*if \(!ancora\(\)\) return undefined;\s*\/\* Col tempo intero/);
  assert.match(SUBITO, /precedente\.call\(this, cam, title, content, apertura\)/);
});
