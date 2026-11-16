/* «Usa un modello 3D tuo»: la finestra che porta nella Casa 3D la casa fatta
 * con un altro programma (#440).
 *
 * Dal campo: «possibilita' di caricare la pianta 3D fatta da un altro
 * programma e utilizzare quella grafica senza passare da quella della app».
 *
 *   1. Si sceglie il file: GLB (il migliore), glTF tutto in uno, o OBJ.
 *      Prima di tutto si guarda cos'e' davvero (`core/modello-3d.js`): un file
 *      che rimanda fuori, compresso, rovinato o enorme si ferma qui, col suo
 *      perche' e con cosa fare.
 *   2. Si vede: il modello sul prato, con accanto una persona alta 1,75 m e
 *      la griglia di un metro. Se e' grande come un palazzo o piccolo come
 *      una scatola di scarpe, le unita' si correggono con un tocco (m, cm,
 *      mm, pollici, piedi); se e' sdraiato, si dice quale asse va in alto;
 *      si gira; e il lato lungo si puo' scrivere in metri.
 *   3. «Usa questo modello»: il file sale al ponte a pezzi, il config si
 *      prende il suo nome e come raddrizzarlo, e la Casa 3D si rifa' con lui.
 *      I dispositivi si mettono poi con «Arreda», toccando il modello.
 *
 * Solo chi configura la plancia la apre. Il file resta nel ponte di casa e
 * si da' solo a chi e' di casa (`ponte/src/modelli-3d.js`).
 */
import { CHIAVE_CASA3D, casa3dPulita } from "../core/casa-3d.js";
import {
  MODELLO_MASSIMO,
  TRIANGOLI_DA_AVVISO,
  controllaIlModello,
  unitaProbabili,
} from "../core/modello-3d.js";
import { daiVendor } from "../core/cartella-della-plancia.js";
import { puoConfigurare } from "./la-config-e-di-chi-la-amministra-section.js";
import { currentProfile } from "./config-persistence-section.js";
import {
  clean,
  doc,
  esc,
  installStyle,
  locale,
  readJson,
  root,
  senzaCadere,
  t,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_CASA_3D_MODELLO__";
const ID = "dm-casa3d-modello";
const state = (root[KEY] ||= { installed: false, S: null });

/* three e i suoi caricatori, dalla stessa cartella della plancia che gira:
 * lo stesso indirizzo della Casa 3D, cosi' il motore e' uno solo. */
function vendor(nome, riserva) {
  const servita = daiVendor(String(import.meta.url || ""), nome, null);
  if (servita) return servita;
  try {
    return riserva();
  } catch (_errore) {
    return `../../legacy/vendor/${nome}`;
  }
}
export const MOTORE = Object.freeze({
  tre: vendor(
    "three.module.min.js",
    () => new URL("../../legacy/vendor/three.module.min.js", import.meta.url).href,
  ),
  caricatori: vendor(
    "three-caricatori.module.min.js",
    () => new URL("../../legacy/vendor/three-caricatori.module.min.js", import.meta.url).href,
  ),
});

/** three, i caricatori e i pezzi della scena del modello, una volta sola. */
export async function caricaIlMotore() {
  const [THREE, caricatori, scena] = await Promise.all([
    import(MOTORE.tre),
    import(MOTORE.caricatori),
    import("./casa-3d/scena-modello.js"),
  ]);
  return { THREE, caricatori, scena };
}

const casaSalvata = () => casa3dPulita(readJson(CHIAVE_CASA3D, null));
const profilo = () => {
  try {
    return currentProfile();
  } catch (_errore) {
    return "primary";
  }
};
const numero = (v, cifre = 1) =>
  Number(v).toLocaleString(locale() || "it", { maximumFractionDigits: cifre });

/** Le parole per un motivo di rifiuto (dal controllo, dal ponte, dalla scena). */
export function perche(motivo) {
  switch (motivo) {
    case "grande":
      return t(
        "Il file supera i 50 MB: alleggeriscilo (meno dettagli, trame più piccole).",
        "The file exceeds 50 MB: make it lighter (less detail, smaller textures).",
      );
    case "sconosciuto":
    case "vuoto":
      return t(
        "Questo file non è un modello GLB, glTF o OBJ.",
        "This file is not a GLB, glTF or OBJ model.",
      );
    case "rotto":
    case "versione":
      return t(
        "Il modello è rovinato o di una versione che non leggo (serve glTF 2).",
        "The model is damaged or of a version I can't read (glTF 2 is needed).",
      );
    case "esterno":
      return t(
        "Il modello rimanda a file esterni: esportalo come GLB, con le trame dentro.",
        "The model points to outside files: export it as GLB, with textures inside.",
      );
    case "compresso":
      return t(
        "Il modello è compresso (Draco, Meshopt o KTX2): esportalo senza compressione.",
        "The model is compressed (Draco, Meshopt or KTX2): export it without compression.",
      );
    case "estensione":
      return t(
        "Il modello usa un'estensione glTF che non so leggere.",
        "The model uses a glTF extension I can't read.",
      );
    case "pesante":
      return t(
        "Troppi triangoli (oltre 4 milioni): semplifica il modello.",
        "Too many triangles (over 4 million): simplify the model.",
      );
    case "senza-facce":
      return t("Nel modello non c'è niente da disegnare.", "There's nothing to draw in the model.");
    case "pieno":
      return t(
        "Lo spazio per i modelli è pieno: togline uno.",
        "Model storage is full: remove one.",
      );
    case "troppi":
      return t(
        "Troppi caricamenti di fila: riprova fra qualche minuto.",
        "Too many uploads in a row: try again in a few minutes.",
      );
    case "permesso":
      return t(
        "Il modello lo cambia solo chi configura questa plancia.",
        "Only whoever configures this dashboard can change the model.",
      );
    case "senza-ponte":
      return t(
        "Il modello si carica dall'app GdAHome o dalla plancia servita dal ponte.",
        "The model is uploaded from the GdAHome app or the dashboard served by the bridge.",
      );
    case "non-si-apre":
      return t(
        "Il modello non si apre su questo dispositivo.",
        "The model can't open on this device.",
      );
    default:
      return t("Non è andata: riprova.", "That didn't work: try again.");
  }
}

/* ── la finestra ──────────────────────────────────────────────────────── */

function nodo() {
  return doc?.getElementById(ID) || null;
}

const scelta = (gruppo, valore, testo, si) =>
  `<button type="button" class="c3mm-ch${si ? " si" : ""}" data-c3mm="${gruppo}" data-v="${esc(valore)}">${esc(testo)}</button>`;

function corpoMarkup() {
  const S = state.S;
  const salvato = S.salvata.modello;
  const imp = S.imp;
  const misure = S.misure;
  const guai = S.errore ? `<p class="c3mm-errore">⚠️ ${esc(S.errore)}</p>` : "";
  const lavoro = S.lavoro ? `<p class="c3mm-lavoro">⏳ ${esc(S.lavoro)}</p>` : "";
  const nome = salvato?.nome || "";
  const quanti = numero(S.triangoli, 0);
  const inUso = salvato
    ? `<section class="c3mm-scheda">
        <p><b>${esc(t(`Modello in uso: ${nome}`, `Model in use: ${nome}`))}</b></p>
        <div class="c3mm-riga">
          ${
            salvato.attivo
              ? `<button type="button" class="c3mm-btn" data-c3mm="spegni">${esc(t("Usa la casa generata", "Use the generated house"))}</button>`
              : `<button type="button" class="c3mm-btn" data-c3mm="accendi">${esc(t("Usa il modello", "Use the model"))}</button>`
          }
          ${S.forma ? "" : `<button type="button" class="c3mm-btn" data-c3mm="correggi">${esc(t("Correggi misure e verso", "Fix size and facing"))}</button>`}
          <button type="button" class="c3mm-btn rosso" data-c3mm="togli">${esc(t("Togli il modello", "Remove the model"))}</button>
        </div>
      </section>`
    : "";
  const scegli = `<section class="c3mm-scheda">
      <p>${esc(
        t(
          "Hai già la casa in 3D fatta con un altro programma? Caricala qui e la Casa 3D userà quella, con sopra luci, sensori e tapparelle.",
          "Already have your home in 3D, made with another program? Upload it here and the 3D Home will use it, with lights, sensors and shutters on top.",
        ),
      )}</p>
      <label class="c3mm-btn pieno">📂 ${esc(t("Scegli il file", "Choose the file"))}<input type="file" accept=".glb,.gltf,.obj,model/gltf-binary,model/gltf+json,model/obj" data-c3mm-file hidden></label>
      <p class="c3mm-piccolo">${esc(
        t(
          "Meglio GLB: un file solo, con le trame dentro. Va bene anche glTF con tutto dentro, o OBJ (senza colori). Fino a 50 MB.",
          "GLB is best: one file, textures inside. A self-contained glTF works too, or OBJ (no colours). Up to 50 MB.",
        ),
      )}</p>
      <details class="c3mm-piccolo"><summary>${esc(t("Da dove esportarlo", "Where to export it from"))}</summary><p>${esc(
        t(
          "SweetHome3D: vista 3D → Esporta in formato OBJ. SketchUp, Blender, Homestyler: esporta GLB (glTF binario). Planner 5D, magicplan: esporta OBJ o GLB. RoomPlan e Polycam: GLB; un USDZ si converte in GLB con Blender o Reality Converter.",
          "SweetHome3D: 3D view → Export to OBJ format. SketchUp, Blender, Homestyler: export GLB (glTF binary). Planner 5D, magicplan: export OBJ or GLB. RoomPlan and Polycam: GLB; a USDZ converts to GLB with Blender or Reality Converter.",
        ),
      )}</p></details>
    </section>`;
  const anteprima = S.forma
    ? `<section class="c3mm-scheda">
        <div class="c3mm-tela" data-c3mm-tela></div>
        <p class="c3mm-piccolo">${esc(t("Controlla le misure: la persona accanto è alta 1,75 m.", "Check the size: the person next to it is 1.75 m tall."))}</p>
        <p><b>${esc(t("Misure", "Size"))}</b> · ${esc(`${numero(misure[0])} × ${numero(misure[2])} × ${numero(misure[1])} m`)}${
          S.triangoli ? ` · <span class="c3mm-piccolo">${esc(numero(S.triangoli, 0))} △</span>` : ""
        }</p>
        <div class="c3mm-gruppo"><span>${esc(t("Unità del file", "File units"))}</span>${["m", "cm", "mm", "in", "ft"].map((u) => scelta("unita", u, u, imp.unita === u)).join("")}</div>
        <div class="c3mm-gruppo"><span>${esc(t("Asse in alto", "Up axis"))}</span>${scelta("su", "y", "Y ↑", imp.su === "y")}${scelta("su", "z", "Z ↑", imp.su === "z")}</div>
        <div class="c3mm-gruppo"><span>${esc(t("Verso", "Facing"))}</span>${[0, 90, 180, -90].map((r) => scelta("rot", r, `${r < 0 ? 270 : r}°`, imp.rot === r)).join("")}</div>
        <label class="c3mm-gruppo"><span>${esc(t("Lato lungo", "Longest side"))}</span><input class="c3mm-in" data-c3mm-lato inputmode="decimal" value="${esc(numero(Math.max(misure[0], misure[2]), 2))}"> m</label>
        ${
          S.triangoli > TRIANGOLI_DA_AVVISO
            ? `<p class="c3mm-avviso">⚠️ ${esc(t(`Il modello è molto pesante (${quanti} triangoli): su un tablet lento si aprirà la casa generata.`, `The model is very heavy (${quanti} triangles): on a slow tablet the generated house will open.`))}</p>`
            : ""
        }
        ${S.avvisi.includes("immagini") || S.lato > 4096 ? `<p class="c3mm-avviso">⚠️ ${esc(t("Ha molte immagini: potrebbe essere lento.", "It has many images: it may be slow."))}</p>` : ""}
        <div class="c3mm-riga">
          <button type="button" class="c3mm-btn" data-c3mm="annulla">${esc(t("Annulla", "Cancel"))}</button>
          <button type="button" class="c3mm-btn pieno" data-c3mm="usa"${S.lavoro ? " disabled" : ""}>${esc(t("Usa questo modello", "Use this model"))}</button>
        </div>
      </section>`
    : "";
  return `${inUso}${S.forma ? "" : scegli}${lavoro}${guai}${anteprima}`;
}

function disegna() {
  const n = nodo();
  if (!n || !state.S) return;
  const posto = n.querySelector("[data-c3mm-corpo]");
  const tela = posto.querySelector("[data-c3mm-tela]");
  /* La tela dell'anteprima non si rifa' a ogni tocco: si sposta nel corpo nuovo. */
  const vivo = state.S.vista?.tela;
  posto.innerHTML = corpoMarkup();
  const nuova = posto.querySelector("[data-c3mm-tela]");
  if (nuova && vivo) {
    nuova.replaceWith(vivo);
    disegnaLAnteprima();
  } else if (nuova && state.S.forma) avviaLAnteprima(nuova);
  else if (!nuova && (vivo || tela)) fermaLAnteprima();
}

function apriLaFinestra() {
  nodo()?.remove();
  const n = doc.createElement("div");
  n.id = ID;
  n.innerHTML = `<section class="c3mm-finestra" role="dialog" aria-modal="true" aria-labelledby="c3mm-titolo">
      <header><h2 id="c3mm-titolo">🧊 ${esc(t("Il tuo modello 3D", "Your 3D model"))}</h2>
        <button type="button" class="c3mm-chiudi" data-c3mm="chiudi" aria-label="${esc(t("Chiudi", "Close"))}">✕</button></header>
      <div class="c3mm-corpo" data-c3mm-corpo></div>
    </section>`;
  doc.body.appendChild(n);
  n.addEventListener("click", alClic);
  n.addEventListener("change", alCambio);
  return n;
}

/** Apre la finestra del modello. Solo per chi configura la plancia. */
export function apriIlModello3D() {
  if (!doc?.body) return false;
  let admin = false;
  try {
    admin = puoConfigurare();
  } catch (_errore) {}
  if (!admin) return false;
  installaLoStile();
  state.S = {
    salvata: casaSalvata(),
    file: null,
    forma: null,
    imp: { unita: "m", su: "y", rot: 0, scala: 1 },
    misure: [0, 0, 0],
    triangoli: 0,
    avvisi: [],
    lato: 0,
    errore: "",
    lavoro: "",
    vista: null,
    motore: null,
  };
  apriLaFinestra();
  disegna();
  return true;
}

function chiudi() {
  fermaLAnteprima();
  try {
    if (state.S?.forma && !state.S.forma.inScena) state.S.motore?.scena.liberaLaForma(state.S.forma.radice);
  } catch (_errore) {}
  state.S = null;
  nodo()?.remove();
}

/* ── il file ──────────────────────────────────────────────────────────── */

async function motore() {
  const S = state.S;
  S.motore ||= await caricaIlMotore();
  return S.motore;
}

/** Il modello appena scelto (o riscaricato): controllato, letto, misurato. */
async function prendiLaForma(byte, imp = null) {
  const S = state.S;
  const esito = controllaIlModello(byte);
  if (!esito.ok) {
    S.errore = perche(esito.errore);
    return false;
  }
  try {
    const { THREE, caricatori, scena } = await motore();
    const forma = await scena.caricaLaForma(THREE, caricatori, byte);
    if (state.S !== S) return false;
    S.forma = forma;
    S.triangoli = forma.triangoli;
    S.avvisi = forma.avvisi;
    S.lato = forma.lato;
    const c = forma.confini;
    const lati = c ? [0, 1, 2].map((i) => c.max[i] - c.min[i]) : [1, 1, 1];
    S.imp = imp || {
      unita: unitaProbabili(Math.max(...lati)),
      /* Un glTF ha Y in alto per regola; un OBJ dipende da chi l'ha fatto: una
       * casa e' piu' larga che alta, e se la Z e' il lato corto e' lei. */
      su: forma.formato === "obj" && lati[2] < lati[1] * 0.8 ? "z" : "y",
      rot: 0,
      scala: 1,
    };
    misura();
    return true;
  } catch (errore) {
    root.console?.warn?.("[DashboardModern] casa 3d, modello", errore);
    S.errore = perche(errore?.motivo || "non-si-apre");
    return false;
  }
}

function misura() {
  const S = state.S;
  if (!S?.forma || !S.motore) return;
  const gruppo = S.vista?.gruppo || new S.motore.THREE.Group();
  S.misure = S.motore.scena.posaLaForma(S.motore.THREE, gruppo, S.forma.confini, S.imp).misure;
  sistemaLaPersona();
}

async function alFile(file) {
  const S = state.S;
  if (!file || !S) return;
  S.errore = "";
  fermaLAnteprima();
  S.forma = null;
  if (file.size > MODELLO_MASSIMO) {
    S.errore = perche("grande");
    return disegna();
  }
  S.lavoro = t("Arriva la casa…", "Loading the house…");
  disegna();
  const byte = new Uint8Array(await file.arrayBuffer());
  S.file = { nome: clean(file.name).slice(0, 80), byte };
  await prendiLaForma(byte);
  if (state.S !== S) return;
  S.lavoro = "";
  disegna();
}

async function correggi() {
  const S = state.S;
  const m = S.salvata.modello;
  if (!m) return;
  S.errore = "";
  S.lavoro = t("Scarico il modello… 0%", "Downloading the model… 0%");
  disegna();
  try {
    const { scaricaIlModello } = await import("./casa-3d/modello-dal-ponte.js");
    const byte = await scaricaIlModello(m, {
      quandoAvanza: (fatti, tutti) => {
        const pct = Math.round((fatti / Math.max(1, tutti)) * 100);
        S.lavoro = t(`Scarico il modello… ${pct}%`, `Downloading the model… ${pct}%`);
        disegna();
      },
    });
    S.file = null;
    await prendiLaForma(byte, { unita: m.unita, su: m.su, rot: m.rot, scala: m.scala });
  } catch (errore) {
    S.errore = perche(errore?.motivo || "filo");
  }
  if (state.S !== S) return;
  S.lavoro = "";
  disegna();
}

/* ── salvare ──────────────────────────────────────────────────────────── */

function scrivi(casa) {
  writeJsonIfChanged(CHIAVE_CASA3D, casa3dPulita(casa));
  try {
    if (typeof root.__DM_CASA3D_RIDISEGNA__ === "function") root.__DM_CASA3D_RIDISEGNA__();
    else root.dispatchEvent?.(new Event("dashboardmodern:persistence-restored"));
  } catch (_errore) {}
}

async function usa() {
  const S = state.S;
  if (!S?.forma) return;
  const prima = S.salvata.modello;
  let dati = prima ? { ...prima } : null;
  if (S.file) {
    S.errore = "";
    S.lavoro = t("Caricamento… 0%", "Uploading… 0%");
    disegna();
    try {
      const { caricaIlModello } = await import("./casa-3d/modello-dal-ponte.js");
      const fatto = await caricaIlModello(S.file.byte, {
        profilo: profilo(),
        quandoAvanza: (fatti, tutti) => {
          const pct = Math.round((fatti / Math.max(1, tutti)) * 100);
          S.lavoro = t(`Caricamento… ${pct}%`, `Uploading… ${pct}%`);
          disegna();
        },
      });
      dati = { ...fatto, nome: S.file.nome, dispositivi: [] };
    } catch (errore) {
      if (state.S !== S) return;
      S.lavoro = "";
      S.errore = perche(errore?.motivo || "filo");
      return disegna();
    }
  }
  if (!dati || state.S !== S) return;
  const casa = casaSalvata();
  scrivi({
    ...casa,
    modello: { ...dati, ...S.imp, triangoli: S.triangoli, attivo: true },
  });
  /* Il modello di prima, se era un altro, nel ponte non serve piu'. */
  if (prima && prima.id !== dati.id) {
    const { togliIlModello } = await import("./casa-3d/modello-dal-ponte.js");
    togliIlModello(prima.id, { profilo: profilo() });
  }
  chiudi();
}

async function togli() {
  const S = state.S;
  const m = S?.salvata.modello;
  if (!m) return;
  const ok = root.confirm?.(
    t(
      "Togliere il modello? I dispositivi messi sopra si perdono.",
      "Remove the model? Devices placed on it are lost.",
    ),
  );
  if (ok === false) return;
  scrivi({ ...casaSalvata(), modello: null });
  const { togliIlModello } = await import("./casa-3d/modello-dal-ponte.js");
  togliIlModello(m.id, { profilo: profilo() });
  chiudi();
}

function accendi(si) {
  const casa = casaSalvata();
  if (!casa.modello) return;
  scrivi({ ...casa, modello: { ...casa.modello, attivo: si } });
  chiudi();
}

function alClic(ev) {
  const el = ev.target.closest("[data-c3mm]");
  if (!el || !state.S) return;
  const S = state.S;
  const cosa = el.dataset.c3mm;
  if (cosa === "chiudi") return chiudi();
  if (cosa === "annulla") {
    /* Con un modello gia' in uso si torna a lui; senza, si chiude. */
    if (!S.salvata.modello) return chiudi();
    fermaLAnteprima();
    S.forma = null;
    S.file = null;
    return disegna();
  }
  if (cosa === "usa") return void usa();
  if (cosa === "togli") return void togli();
  if (cosa === "correggi") return void correggi();
  if (cosa === "spegni") return accendi(false);
  if (cosa === "accendi") return accendi(true);
  if (cosa === "unita") S.imp.unita = el.dataset.v;
  else if (cosa === "su") S.imp.su = el.dataset.v === "z" ? "z" : "y";
  else if (cosa === "rot") S.imp.rot = Number(el.dataset.v) || 0;
  else return;
  /* Cambiando unita' o asse la scala scritta a mano non vale piu'. */
  if (cosa !== "rot") S.imp.scala = 1;
  misura();
  disegna();
  inquadraLAnteprima();
}

function alCambio(ev) {
  const S = state.S;
  if (!S) return;
  if (ev.target.matches("[data-c3mm-file]")) {
    void alFile(ev.target.files?.[0]);
    return;
  }
  if (ev.target.matches("[data-c3mm-lato]")) {
    const voluto = Number(String(ev.target.value).replace(",", "."));
    const ora = Math.max(S.misure[0], S.misure[2]);
    if (voluto > 0 && ora > 0) S.imp.scala = Math.min(1000, Math.max(0.001, (S.imp.scala * voluto) / ora));
    misura();
    disegna();
    inquadraLAnteprima();
  }
}

/* ── l'anteprima ──────────────────────────────────────────────────────── */

function avviaLAnteprima(tela) {
  const S = state.S;
  if (!S?.motore || !S.forma) return;
  const { THREE } = S.motore;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (_errore) {
    S.errore = perche("non-si-apre");
    return;
  }
  renderer.setPixelRatio(Math.min(2, root.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  tela.appendChild(renderer.domElement);
  const scena = new THREE.Scene();
  scena.add(new THREE.HemisphereLight("#eef2ff", "#3b4252", 1.6));
  const sole = new THREE.DirectionalLight("#fff1d6", 2);
  sole.position.set(-8, 14, 9);
  scena.add(sole);
  const gruppo = new THREE.Group();
  gruppo.add(S.forma.radice);
  scena.add(gruppo);
  const persona = new THREE.Group();
  const pelle = new THREE.MeshStandardMaterial({ color: "#f97316", roughness: 0.6 });
  const corpo = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.5, 16), pelle);
  corpo.position.y = 0.75;
  const testa = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), pelle);
  testa.position.y = 1.62;
  persona.add(corpo, testa);
  scena.add(persona);
  const cam = new THREE.PerspectiveCamera(35, 1, 0.05, 5000);
  S.vista = { tela, renderer, scena, gruppo, persona, cam, griglia: null, az: 0.7, al: 0.45, d: 20 };
  misura();
  inquadraLAnteprima();
  let presa = null;
  renderer.domElement.addEventListener("pointerdown", (ev) => {
    presa = { x: ev.clientX, y: ev.clientY, az: S.vista.az, al: S.vista.al };
    renderer.domElement.setPointerCapture?.(ev.pointerId);
  });
  renderer.domElement.addEventListener("pointermove", (ev) => {
    if (!presa || !S.vista) return;
    S.vista.az = presa.az - (ev.clientX - presa.x) * 0.01;
    S.vista.al = Math.max(0.05, Math.min(1.5, presa.al + (ev.clientY - presa.y) * 0.008));
    disegnaLAnteprima();
  });
  renderer.domElement.addEventListener("pointerup", () => (presa = null));
  disegnaLAnteprima();
}

function sistemaLaPersona() {
  const V = state.S?.vista;
  if (!V) return;
  const { THREE } = state.S.motore;
  const m = state.S.misure;
  V.persona.position.set(m[0] / 2 + 0.8, 0, 0);
  if (V.griglia) {
    V.scena.remove(V.griglia);
    V.griglia.geometry.dispose();
    V.griglia.material.dispose();
  }
  /* la griglia di un metro, finche' non diventa una macchia: poi di dieci */
  const lato = Math.min(2000, Math.ceil(Math.max(m[0], m[2], 4) * 1.6));
  const passo = lato > 200 ? 10 : 1;
  V.griglia = new THREE.GridHelper(Math.ceil(lato / passo) * passo, Math.ceil(lato / passo), "#64748b", "#cbd5e1");
  V.scena.add(V.griglia);
}

function inquadraLAnteprima() {
  const V = state.S?.vista;
  if (!V) return;
  const m = state.S.misure;
  V.d = Math.max(4, Math.max(m[0], m[1], m[2], 1.75) * 2.2);
  V.alto = Math.max(m[1], 1.75) * 0.4;
  disegnaLAnteprima();
}

function disegnaLAnteprima() {
  const V = state.S?.vista;
  if (!V) return;
  const w = V.tela.clientWidth || 300,
    h = V.tela.clientHeight || 260;
  V.renderer.setSize(w, h, false);
  V.cam.aspect = w / h;
  V.cam.near = Math.max(0.01, V.d / 500);
  V.cam.far = V.d * 20;
  V.cam.updateProjectionMatrix();
  V.cam.position.set(Math.sin(V.az) * Math.cos(V.al) * V.d, V.alto + Math.sin(V.al) * V.d, Math.cos(V.az) * Math.cos(V.al) * V.d);
  V.cam.lookAt(0, V.alto, 0);
  V.renderer.render(V.scena, V.cam);
}

function fermaLAnteprima() {
  const V = state.S?.vista;
  if (!V) return;
  V.gruppo.remove(state.S.forma?.radice);
  V.renderer.dispose();
  V.renderer.domElement.remove();
  state.S.vista = null;
}

/* ── il foglio ────────────────────────────────────────────────────────── */

function installaLoStile() {
  const M3 = `#${ID}`;
  installStyle(
    "dm-casa3d-modello-style",
    `
    ${M3}{position:fixed;inset:0;z-index:2147483300;display:flex;align-items:center;justify-content:center;padding:16px;
      background:rgba(15,23,42,.65);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);font-family:'Inter',system-ui,sans-serif}
    ${M3} *{box-sizing:border-box}
    ${M3} .c3mm-finestra{display:flex;flex-direction:column;width:100%;max-width:640px;max-height:92vh;overflow:hidden;border-radius:24px;
      background:#0c1322;color:#e6edf7;border:1px solid #263453;box-shadow:0 30px 80px rgba(0,0,0,.45)}
    ${M3} .c3mm-finestra>header{position:static;display:flex;align-items:center;justify-content:space-between;gap:10px;height:auto;min-height:0;
      margin:0;padding:14px 18px;border:0;border-bottom:1px solid #263453;border-radius:0;background:transparent;box-shadow:none;color:#e6edf7}
    ${M3} .c3mm-finestra h2{margin:0;font-family:'Oswald',system-ui,sans-serif;font-size:18px;letter-spacing:.06em;text-transform:uppercase;color:#e6edf7}
    ${M3} .c3mm-chiudi{width:36px;height:36px;border-radius:50%;border:0;cursor:pointer;background:#1b2540;color:#e6edf7;font-weight:800}
    ${M3} .c3mm-corpo{padding:14px 18px 18px;overflow-y:auto;display:flex;flex-direction:column;gap:12px}
    ${M3} .c3mm-scheda{display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:18px;background:rgba(22,31,54,.86);border:1px solid #263453}
    ${M3} .c3mm-scheda p{margin:0;font-size:13px;line-height:1.45}
    ${M3} .c3mm-piccolo{font-size:12px!important;opacity:.78}
    ${M3} details p{margin-top:6px!important}
    ${M3} summary{cursor:pointer;font-weight:700}
    ${M3} .c3mm-riga{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
    ${M3} .c3mm-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:10px 16px;border-radius:999px;cursor:pointer;
      font:inherit;font-size:13px;font-weight:800;border:1px solid #334569;background:#1b2540;color:#e6edf7}
    ${M3} .c3mm-btn.pieno{background:#0ea5e9;border-color:#0ea5e9;color:#fff}
    ${M3} .c3mm-btn.rosso{background:rgba(190,18,60,.25);border-color:rgba(248,113,113,.5)}
    ${M3} .c3mm-btn[disabled]{opacity:.5;cursor:default}
    ${M3} label.c3mm-btn{align-self:flex-start}
    ${M3} .c3mm-tela{position:relative;height:280px;border-radius:14px;overflow:hidden;background:radial-gradient(ellipse at 50% 40%,#1b2b4f,#0d1528 75%);touch-action:none}
    ${M3} .c3mm-tela canvas{width:100%;height:100%;display:block}
    ${M3} .c3mm-gruppo{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:12.5px}
    ${M3} .c3mm-gruppo>span{min-width:110px;font-weight:700;opacity:.85}
    ${M3} .c3mm-ch{padding:6px 12px;border-radius:999px;border:1px solid rgba(148,163,184,.35);background:rgba(148,163,184,.1);color:inherit;font:inherit;
      font-size:12.5px;cursor:pointer}
    ${M3} .c3mm-ch.si{background:#0ea5e9;border-color:#0ea5e9;color:#fff;font-weight:800}
    ${M3} .c3mm-in{width:90px;padding:7px 10px;border-radius:10px;background:rgba(148,163,184,.1);color:inherit;border:1px solid rgba(148,163,184,.35);font:inherit}
    ${M3} .c3mm-errore{margin:0;padding:10px 12px;border-radius:12px;background:rgba(220,38,38,.18);border:1px solid rgba(248,113,113,.45);font-size:13px;font-weight:700}
    ${M3} .c3mm-avviso{color:#fbbf24;font-weight:700}
    ${M3} .c3mm-lavoro{margin:0;font-size:13px;font-weight:700;color:#7dd3fc}
    @media(max-width:520px){${M3} .c3mm-gruppo>span{min-width:100%}}
    `,
  );
}

export function installCasa3DModello() {
  if (!doc || state.installed) return false;
  state.installed = true;
  root.__DM_CASA3D_MODELLO__ = apriIlModello3D;
  doc.addEventListener?.("keydown", (ev) => {
    if (ev.key === "Escape" && state.S) chiudi();
  });
  return true;
}

senzaCadere(installCasa3DModello);
