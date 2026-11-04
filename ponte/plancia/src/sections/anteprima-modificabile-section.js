/* L'anteprima modificabile del Config (#379).
 *
 * «Voglio vedere bene il discorso drag & drop. In ogni sezione del config
 *  possiamo creare un'anteprima, e in quell'anteprima si spostano a proprio
 *  piacimento le cose; quando si salvano vanno nella plancia modificate.»
 *
 * Un riquadro in cima alla scheda del Config che mostra la sezione com'e' —
 * con le sue voci vere, disegnate da chi le disegna in plancia — e dove le
 * voci si trascinano col mouse o col dito, si accendono e si spengono con
 * l'occhio, si spostano dalla tastiera. Niente si scrive finche' non si preme
 * «Salva»: fino a li' e' una bozza, e lo dice («Modifiche non salvate»).
 * «Annulla» butta la bozza, «Ripristina» propone l'ordine di partenza.
 *
 * Il riquadro non sa niente delle sezioni: ognuna si registra dicendo come si
 * legge la scelta salvata, come si disegna una voce, come si salva.
 *
 *     registraAnteprima("home", {
 *       titolo, spiega,                 // le parole in cima
 *       leggi: () => ({ ordine, nascoste }),
 *       predefinito: () => ({ ordine, nascoste }),
 *       voci: () => Map(chiave -> { nome, html, segnaposto }),
 *       salva: (bozza) => {},
 *       classeGriglia, ambito,          // come si veste la griglia
 *       siNasconde: true,               // se c'e' l'occhio
 *     });
 *     anteprimaMarkup("home")            // dove la si vuole
 */
import {
  alternaNellaBozza,
  bozzaCambiata,
  bozzaDa,
  bozzaRiallineata,
  spostaFraLeVisibili,
} from "../core/anteprima-modificabile.js";
import { STILE_RIORDINA } from "./trascina-per-riordinare.js";
import { doc, esc, installStyle, root, senzaCadere, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_ANTEPRIMA_MODIFICABILE__";
const state = (root[KEY] ||= {
  installed: false,
  registrate: new Map(),
  bozze: new Map(),
  ambiti: new Set(),
  mosse: new Map(),
  dispositivi: new Map(),
});

/* Le larghezze in cui si puo' guardare l'anteprima: chi configura dal
 * computer vuole vedere anche come sara' sul telefono. */
const DISPOSITIVI = Object.freeze(["telefono", "tablet", "computer"]);

function dispositivoDiPartenza() {
  const largo = root.innerWidth || 1200;
  return largo <= 560 ? "telefono" : largo <= 1024 ? "tablet" : "computer";
}

function dispositivo(id) {
  return state.dispositivi.get(id) || dispositivoDiPartenza();
}

export function registraAnteprima(id, definizione) {
  state.registrate.set(id, definizione);
  if (definizione.ambito) state.ambiti.add(definizione.ambito);
}

function salvata(id) {
  return bozzaDa(state.registrate.get(id)?.leggi?.() || {});
}

/** La bozza che si sta guardando: quella in mano se c'e', se no la salvata. */
export function bozzaDellAnteprima(id) {
  const tenuta = state.bozze.get(id);
  return tenuta ? bozzaRiallineata(tenuta, salvata(id)) : salvata(id);
}

export function anteprimaCambiata(id) {
  return bozzaCambiata(state.bozze.get(id) && bozzaDellAnteprima(id), salvata(id));
}

/** Chi tocca la scelta da fuori — le frecce ▲▼ dell'elenco — butta la bozza:
 * due mani sulla stessa scelta danno un risultato che nessuno ha voluto. */
export function dimenticaLaBozza(id) {
  state.bozze.delete(id);
  state.mosse.delete(id);
}

/* Le voci che l'anteprima mostra, nell'ordine della bozza. Una voce che la
 * sezione non sa disegnare adesso — la tessera degli allagamenti quando
 * nessun sensore e' bagnato — non c'e': tiene il suo posto nella bozza, ma
 * nell'anteprima non ingombra. Con `segnaposto: true` invece si vede, come
 * riquadro tratteggiato col nome. */
function vociVisibili(def, bozza) {
  const voci = def.voci?.() || new Map();
  return bozza.ordine.filter((chiave) => voci.has(chiave)).map((chiave) => [chiave, voci.get(chiave)]);
}

/* Le voci si dividono in due gruppi: quelle che in plancia si vedono adesso,
 * disegnate come sono, e quelle che compaiono solo quando servono — gli
 * avvisi che si accendono da soli — raccolte sotto, piccole. Ognuno si
 * riordina per conto suo; la posizione fra un gruppo e l'altro resta quella
 * della bozza. */
function gruppiDiVoci(def, bozza) {
  const visibili = vociVisibili(def, bozza);
  return {
    vere: visibili.filter(([, voce]) => !voce.segnaposto),
    quandoServono: visibili.filter(([, voce]) => voce.segnaposto),
  };
}

function occhioMarkup(def, chiave, voce, spenta) {
  if (def.siNasconde === false) return "";
  return `<button type="button" class="dm-ant-occhio" data-dm-non-trascinare data-dm-ant-occhio="${esc(chiave)}"
      aria-pressed="${!spenta}" aria-label="${esc(
        spenta ? t(`Mostra ${voce.nome}`, `Show ${voce.nome}`) : t(`Nascondi ${voce.nome}`, `Hide ${voce.nome}`),
      )}">${spenta ? OCCHIO_CHIUSO : OCCHIO}</button>`;
}

function vociMarkup(def, bozza, voci) {
  const nascoste = new Set(bozza.nascoste);
  return voci
    .map(([chiave, voce], i) => {
      const spenta = nascoste.has(chiave);
      const nota = voce.segnaposto ? voce.nota || t("Compare da sola quando serve", "Shows up on its own when needed") : "";
      const dentro = voce.segnaposto
        ? `<span class="dm-ant-segnaposto">${
            voce.icona ? `<span class="dm-ant-segnaposto-icona" aria-hidden="true">${voce.icona}</span>` : ""
          }<b>${esc(voce.nome)}</b></span>`
        : voce.html;
      return `<div class="dm-ant-voce" data-dm-riordina-riga="${esc(chiave)}" data-dm-maniglia data-dm-tieni
          data-spenta="${spenta}" data-segnaposto="${Boolean(voce.segnaposto)}" tabindex="0" role="listitem"${
            nota ? ` title="${esc(nota)}"` : ""
          }
          aria-label="${esc(
            `${t(`${voce.nome}, posizione ${i + 1} di ${voci.length}`, `${voce.nome}, position ${i + 1} of ${voci.length}`)}${
              spenta ? `, ${t("nascosta", "hidden")}` : ""
            }. ${t("Trascina o usa le frecce per spostarla.", "Drag or use the arrows to move it.")}`,
          )}">${dentro}${occhioMarkup(def, chiave, voce, spenta)}</div>`;
    })
    .join("");
}

/** Il riquadro intero, da mettere dove la sezione vuole. */
export function anteprimaMarkup(id) {
  const def = state.registrate.get(id);
  if (!def) return "";
  installStyles();
  /* Chi mette il riquadro nella pagina lo fa dopo questa chiamata: la scala
   * si misura al prossimo fotogramma, quando c'e'. */
  adattaPresto();
  const bozza = bozzaDellAnteprima(id);
  const cambiata = anteprimaCambiata(id);
  const predefinita = bozzaDa(def.predefinito?.() || {});
  const giaPredefinita = !bozzaCambiata(bozza, predefinita);
  const gruppi = gruppiDiVoci(def, bozza);
  return `<section class="dm-anteprima" data-dm-anteprima="${esc(id)}" data-cambiata="${cambiata}">
    <header class="dm-ant-testa">
      <div class="dm-ant-titoli">
        <strong>${esc(parola(def.titolo) || t("Anteprima", "Preview"))}</strong>
        <small>${esc(
          parola(def.spiega) ||
            t(
              "Trascina per spostare, l'occhio per nascondere. Niente cambia in plancia finché non applichi.",
              "Drag to move, the eye to hide. Nothing changes on the dashboard until you apply.",
            ),
        )}</small>
      </div>
      <span class="dm-ant-stato" role="status" aria-live="polite">${cambiata ? `<i></i>${esc(contaModifiche(id))}` : ""}</span>
    </header>
    ${def.dispositivi === false ? "" : dispositiviMarkup(id)}
    <div class="dm-ant-fondo" data-dispositivo="${esc(dispositivo(id))}"${
      def.ambito ? ` id="${esc(def.ambito)}"` : ""
    }${attributiDellAmbito(def, dispositivo(id))}>
      <div class="dm-ant-griglia ${esc(def.classeGriglia || "")}" data-dm-riordina="griglia" data-dm-gruppo="vere" role="list">${vociMarkup(
        def,
        bozza,
        gruppi.vere,
      )}</div>${
        gruppi.quandoServono.length
          ? `<div class="dm-ant-dopo">
        <div class="dm-ant-dopo-titolo"><b>${esc(t("Compaiono quando servono", "Show up when needed"))}</b><small>${esc(
          parola(def.spiegaQuandoServono) ||
            t(
              "Non sono in Home adesso: arrivano da sole quando hanno qualcosa da dire, nell'ordine che scegli qui.",
              "They aren't on Home right now: they arrive on their own when they have something to say, in the order you choose here.",
            ),
        )}</small></div>
        <div class="dm-ant-pillole" data-dm-riordina="griglia" data-dm-gruppo="quandoServono" role="list">${vociMarkup(
          def,
          bozza,
          gruppi.quandoServono,
        )}</div>
      </div>`
          : ""
      }
    </div>
    <footer class="dm-ant-piede">
      <button type="button" class="dm-ant-tasto" data-dm-ant-azione="ripristina"${
        giaPredefinita ? " disabled" : ""
      }>${esc(t("Ripristina", "Reset"))}</button>
      <span class="dm-ant-spazio"></span>
      <button type="button" class="dm-ant-tasto" data-dm-ant-azione="annulla"${cambiata ? "" : " disabled"}>${esc(
        t("Annulla", "Cancel"),
      )}</button>
      <button type="button" class="dm-ant-tasto dm-ant-salva" data-dm-ant-azione="salva"${
        cambiata ? "" : " disabled"
      }>${esc(t("Applica", "Apply"))}</button>
    </footer>
  </section>`;
}

/* Gli attributi che l'ospite vero porta e da cui il suo foglio dipende — la
 * Home compatta, per dirne uno — si mettono anche sull'anteprima, cosi' si
 * veste uguale. */
function attributiDellAmbito(def, quale) {
  const attributi =
    (typeof def.attributiAmbito === "function" ? def.attributiAmbito(quale) : def.attributiAmbito) || {};
  return Object.entries(attributi)
    .filter(([nome, valore]) => /^data-[a-z-]+$/.test(nome) && valore !== undefined && valore !== null)
    .map(([nome, valore]) => ` ${nome}="${esc(String(valore))}"`)
    .join("");
}

/* «2 modifiche non salvate»: quante mosse si sono fatte da quando la bozza
 * e' nata — spostamenti e occhi — perche' «non salvate» da solo non dice se
 * si e' toccato una cosa o tutto. */
function contaModifiche(id) {
  const quante = Math.max(1, state.mosse.get(id) || 1);
  return quante === 1
    ? t("1 modifica non salvata", "1 unsaved change")
    : t(`${quante} modifiche non salvate`, `${quante} unsaved changes`);
}

function dispositiviMarkup(id) {
  const scelto = dispositivo(id);
  const nomi = {
    telefono: t("Telefono", "Phone"),
    tablet: t("Tablet", "Tablet"),
    computer: t("Computer", "Computer"),
  };
  return `<div class="dm-ant-dispositivi" role="group" aria-label="${esc(t("Guarda come su", "View as"))}">${DISPOSITIVI.map(
    (quale) =>
      `<button type="button" data-dm-ant-dispositivo="${quale}" aria-pressed="${quale === scelto}">${DISEGNI[quale]}<span>${esc(
        nomi[quale],
      )}</span></button>`,
  ).join("")}</div>`;
}

/* L'anteprima «Telefono» larga come un telefono vero. Se il riquadro e'
 * piu' stretto — la si guarda da un telefono, dentro la finestra del Config —
 * la griglia si rimpicciolisce tutta insieme: le tessere restano quelle della
 * Home, coi nomi interi, solo piu' piccole. */
const LARGHEZZA_TELEFONO = 390;

function adattaLeScale() {
  for (const griglia of doc?.querySelectorAll?.('.dm-ant-fondo[data-dispositivo="telefono"] .dm-ant-griglia') || []) {
    const fondo = griglia.closest(".dm-ant-fondo");
    const stile = root.getComputedStyle?.(fondo);
    const spazio =
      fondo.clientWidth - (parseFloat(stile?.paddingLeft) || 0) - (parseFloat(stile?.paddingRight) || 0);
    if (spazio > 0 && spazio < LARGHEZZA_TELEFONO) {
      const k = spazio / LARGHEZZA_TELEFONO;
      griglia.classList.add("dm-ant-in-scala");
      griglia.style.width = `${LARGHEZZA_TELEFONO}px`;
      griglia.style.maxWidth = "none";
      griglia.style.transform = `scale(${k})`;
      griglia.style.marginBottom = `${-(1 - k) * griglia.offsetHeight}px`;
    } else if (griglia.classList.contains("dm-ant-in-scala")) {
      griglia.classList.remove("dm-ant-in-scala");
      for (const prop of ["width", "maxWidth", "transform", "marginBottom"]) griglia.style[prop] = "";
    }
  }
}

function adattaPresto() {
  if (state.inScala) return;
  state.inScala = true;
  root.requestAnimationFrame?.(() => {
    state.inScala = false;
    adattaLeScale();
  });
}

/** Ridisegna il riquadro al suo posto, tenendo il fuoco dov'era. */
export function ridisegnaAnteprima(id) {
  const vecchia = doc?.querySelector?.(`[data-dm-anteprima="${cssEsc(id)}"]`);
  if (!vecchia) return;
  const fuoco = doc.activeElement;
  const voceConFuoco = fuoco?.closest?.("[data-dm-riordina-riga]")?.dataset?.dmRiordinaRiga;
  const occhioConFuoco = fuoco?.dataset?.dmAntOcchio;
  const azioneConFuoco = fuoco?.dataset?.dmAntAzione;
  const altezza = vecchia.querySelector(".dm-ant-fondo")?.scrollTop || 0;
  const scatola = doc.createElement("div");
  scatola.innerHTML = anteprimaMarkup(id);
  const nuova = scatola.firstElementChild;
  if (!nuova) return;
  vecchia.replaceWith(nuova);
  const fondo = nuova.querySelector(".dm-ant-fondo");
  if (fondo) fondo.scrollTop = altezza;
  const daFocalizzare = occhioConFuoco
    ? nuova.querySelector(`[data-dm-ant-occhio="${cssEsc(occhioConFuoco)}"]`)
    : voceConFuoco
      ? nuova.querySelector(`[data-dm-riordina-riga="${cssEsc(voceConFuoco)}"]`)
      : azioneConFuoco
        ? nuova.querySelector(`[data-dm-ant-azione="${cssEsc(azioneConFuoco)}"]:not([disabled])`)
        : null;
  daFocalizzare?.focus?.({ preventScroll: true });
  adattaLeScale();
}

/* Titolo e spiegazione si chiedono al momento di disegnare: la lingua si
 * sceglie dopo che le sezioni si sono registrate. */
const parola = (valore) => (typeof valore === "function" ? valore() : valore);

const cssEsc = (testo) => (root.CSS?.escape ? root.CSS.escape(String(testo)) : String(testo));

function cambia(id, nuova) {
  state.bozze.set(id, nuova);
  state.mosse.set(id, (state.mosse.get(id) || 0) + 1);
  /* Tornati alla scelta salvata, le mosse fatte non contano piu'. */
  if (!anteprimaCambiata(id)) state.mosse.delete(id);
  ridisegnaAnteprima(id);
}

function onRiordina(event) {
  const radice = event.target?.closest?.("[data-dm-anteprima]");
  const gruppo = event.target?.dataset?.dmGruppo;
  if (!radice || !gruppo) return;
  event.stopPropagation();
  const id = radice.dataset.dmAnteprima;
  const { da, a } = event.detail || {};
  const bozza = bozzaDellAnteprima(id);
  const visibili = (gruppiDiVoci(state.registrate.get(id) || {}, bozza)[gruppo] || []).map(([chiave]) => chiave);
  cambia(id, spostaFraLeVisibili(bozza, visibili, da, a));
}

function onClick(event) {
  const radice = event.target?.closest?.("[data-dm-anteprima]");
  if (!radice) return;
  const id = radice.dataset.dmAnteprima;
  const def = state.registrate.get(id);
  if (!def) return;
  /* Le voci sono disegnate come in plancia, e in plancia un tocco apre la
   * finestra della tessera: qui no, qui si sistemano. */
  event.stopPropagation();
  const vista = event.target.closest("[data-dm-ant-dispositivo]");
  if (vista) {
    event.preventDefault();
    state.dispositivi.set(id, vista.dataset.dmAntDispositivo);
    ridisegnaAnteprima(id);
    return;
  }
  const occhio = event.target.closest("[data-dm-ant-occhio]");
  if (occhio) {
    event.preventDefault();
    cambia(id, alternaNellaBozza(bozzaDellAnteprima(id), occhio.dataset.dmAntOcchio));
    return;
  }
  const azione = event.target.closest("[data-dm-ant-azione]")?.dataset?.dmAntAzione;
  if (!azione) {
    if (event.target.closest(".dm-ant-voce")) event.preventDefault();
    return;
  }
  event.preventDefault();
  if (azione === "annulla") {
    dimenticaLaBozza(id);
    ridisegnaAnteprima(id);
  } else if (azione === "ripristina") {
    cambia(id, bozzaDa(def.predefinito?.() || {}));
  } else if (azione === "salva") {
    applica(id);
    root.edToast?.(t("💾 Salvato: la plancia è aggiornata", "💾 Saved: the dashboard is updated"));
  }
}

/* La bozza scritta dove la sezione la tiene, e il riquadro ridisegnato. */
function applica(id) {
  const def = state.registrate.get(id);
  if (!def || !anteprimaCambiata(id)) return false;
  const bozza = bozzaDellAnteprima(id);
  dimenticaLaBozza(id);
  try {
    def.salva?.(bozza);
  } finally {
    ridisegnaAnteprima(id);
  }
  return true;
}

/* Nel Config il salvataggio e' uno, in fondo alla scheda («💾 Salva
 * sezione»): il tasto dell'anteprima dice «Applica», e chi preme il
 * salvataggio della scheda con una bozza ancora aperta la trova scritta
 * anche lei — non resta indietro in silenzio. */
export function applicaLeBozzeAperte(dentro = doc) {
  let quante = 0;
  for (const riquadro of dentro?.querySelectorAll?.("[data-dm-anteprima]") || [])
    if (applica(riquadro.dataset.dmAnteprima)) quante += 1;
  return quante;
}

function onSalvaLaScheda(event) {
  const piede = event.target?.closest?.("[data-dm-save-all]");
  if (!piede) return;
  applicaLeBozzeAperte(piede.closest("#ed-body") || doc);
}

/* Lo spazio sotto l'Esc della finestra del Config: una bozza aperta non si
 * perde chiudendo per sbaglio — la si ritrova riaprendo. Qui non c'e' da
 * fare niente: la bozza vive in memoria finche' la pagina e' aperta. */

/* Le voci si vestono come in plancia: le sezioni che le disegnano hanno il
 * loro foglio legato all'ospite in pagina (`#dm-widgets` per la Home), che
 * nel Config non c'e'. Si copiano le regole di quell'ospite sull'ambito
 * dell'anteprima, una volta e quando i fogli cambiano. */
function copiaLeRegole() {
  if (!doc?.styleSheets) return;
  const ambiti = [...state.ambiti].filter(Boolean);
  if (!ambiti.length) return;
  const firma = `${doc.styleSheets.length}:${ambiti.join(",")}`;
  if (state.firmaStili === firma) return;
  const regole = [];
  const leggi = (lista, fuori = "") => {
    for (const regola of lista) {
      if (regola.cssRules && regola.media) {
        const dentro = [];
        leggi(regola.cssRules, dentro);
        if (dentro.length) regole.push(`@media ${regola.media.mediaText}{${dentro.join("\n")}}`);
        continue;
      }
      const testo = regola.cssText || "";
      if (!regola.selectorText || !regola.selectorText.includes("#dm-widgets")) continue;
      for (const ambito of ambiti) {
        const copia = testo.replaceAll("#dm-widgets", `#${ambito}`);
        if (Array.isArray(fuori)) fuori.push(copia);
        else regole.push(copia);
      }
    }
  };
  for (const foglio of doc.styleSheets) {
    if (foglio.ownerNode?.id === "dm-anteprima-copia") continue;
    try {
      leggi(foglio.cssRules);
    } catch (_error) {
      /* Un foglio d'un'altra origine non si legge: non e' nostro. */
    }
  }
  state.firmaStili = firma;
  installStyle("dm-anteprima-copia", regole.join("\n"));
}

const DISEGNI = Object.freeze({
  telefono: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M11 18.5h2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  tablet: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M11 18h2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  computer: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 20h8M12 16v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
});

const OCCHIO = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
const OCCHIO_CHIUSO = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 4.4-1M9.9 9.9a3 3 0 0 0 4.2 4.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;

function installStyles() {
  copiaLeRegole();
  installStyle(
    "dm-anteprima-style",
    `
.dm-anteprima{margin:0 0 18px;border-radius:22px;border:1px solid var(--card-border,#e2e8f0);
  background:var(--surface-2,#f8fafc);overflow:hidden}
.dm-anteprima .dm-ant-testa{display:flex;flex-direction:row;flex-wrap:wrap;align-items:flex-start;justify-content:flex-start;
  gap:8px 12px;margin:0;padding:14px 16px 10px;text-align:left;
  position:static;background:transparent;border:0;box-shadow:none;border-radius:0}
.dm-ant-titoli{display:grid;gap:3px;min-width:min(100%,260px);flex:1 1 260px}
.dm-ant-titoli strong{font-size:15px;font-weight:800;color:var(--text,#0f172a)}
.dm-ant-titoli small{font-size:12px;line-height:1.4;font-weight:600;color:var(--text-dim,#64748b)}
.dm-ant-stato:empty{display:none}
.dm-ant-stato{display:inline-flex;align-items:center;gap:6px;flex:0 0 auto;padding:5px 10px;border-radius:999px;
  font-size:11.5px;font-weight:800;color:#92400e;background:color-mix(in srgb,#f59e0b 18%,var(--card-bg,#fff));
  border:1px solid color-mix(in srgb,#f59e0b 40%,transparent)}
.dm-ant-stato i{width:7px;height:7px;border-radius:50%;background:#f59e0b}
.dm-ant-dispositivi{display:flex;gap:4px;margin:0 16px 10px;padding:3px;width:max-content;max-width:calc(100% - 32px);box-sizing:border-box;
  border-radius:999px;background:var(--surface-3,#eef2f7);border:1px solid var(--card-border,#e2e8f0)}
.dm-ant-dispositivi button{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:0 12px;border:0;border-radius:999px;
  background:transparent;color:var(--text-dim,#64748b);font:inherit;font-size:12.5px;font-weight:800;cursor:pointer}
.dm-ant-dispositivi button svg{width:17px;height:17px;flex:0 0 auto}
@media (max-width:520px){
  .dm-ant-dispositivi{width:auto;margin:0 12px 10px}
  .dm-ant-dispositivi button{flex:1 1 0;justify-content:center;padding:0 6px;font-size:11.5px;min-width:0}
  .dm-ant-dispositivi button span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .dm-ant-dispositivi button svg{display:none}
}
.dm-ant-dispositivi button[aria-pressed="true"]{background:var(--card-bg,#fff);color:var(--text,#0f172a);box-shadow:0 1px 4px rgba(15,23,42,.18)}
.dm-ant-fondo[data-dispositivo="telefono"] .dm-ant-griglia{max-width:390px;margin:0 auto}
.dm-ant-fondo[data-dispositivo="tablet"] .dm-ant-griglia{max-width:768px;margin:0 auto}
.dm-ant-fondo{position:relative;padding:12px 16px 16px;max-height:min(64vh,680px);overflow:auto;overscroll-behavior:contain}
.dm-ant-griglia{position:relative}
.dm-ant-voce{position:relative;border-radius:22px;outline:none;cursor:grab}
.dm-ant-voce:focus-visible{box-shadow:0 0 0 3px var(--accent,#3b82f6)}
.dm-ant-voce>.dm-tile{width:100%;height:100%;pointer-events:none}
.dm-ant-voce[data-spenta="true"]>:not(.dm-ant-occhio){opacity:.38;filter:grayscale(.8)}
.dm-ant-voce[data-spenta="true"]::after{content:"";position:absolute;inset:0;border-radius:inherit;
  border:2px dashed color-mix(in srgb,var(--text-dim,#94a3b8) 60%,transparent);pointer-events:none}
/* L'occhio sta sull'angolo, fuori dalla tessera: la tessera resta com'e' in
   Home, nome e numero interi, e l'occhio non copre mai niente. */
.dm-ant-occhio{position:absolute;top:-9px;right:-9px;z-index:3;width:30px;height:30px;padding:0;border-radius:50%;
  display:inline-flex;align-items:center;justify-content:center;cursor:pointer;
  border:1px solid var(--card-border,#e2e8f0);background:var(--card-bg,#fff);color:var(--text,#0f172a);
  box-shadow:0 3px 10px -3px rgba(15,23,42,.35)}
.dm-ant-occhio svg{width:16px;height:16px}
.dm-ant-occhio[aria-pressed="false"]{color:var(--text-dim,#64748b)}
.dm-ant-occhio:focus-visible{outline:2px solid var(--accent,#3b82f6);outline-offset:2px}
/* «Compaiono quando servono»: pillole piccole, una dopo l'altra, larghe
   quanto il loro nome. */
.dm-ant-dopo{margin-top:18px;padding-top:14px;border-top:1px dashed color-mix(in srgb,var(--text-dim,#94a3b8) 45%,transparent)}
.dm-ant-dopo-titolo{display:grid;gap:2px;margin:0 0 10px}
.dm-ant-dopo-titolo b{font-size:13px;font-weight:800;color:var(--text,#0f172a)}
.dm-ant-dopo-titolo small{font-size:11.5px;line-height:1.4;font-weight:600;color:var(--text-dim,#64748b)}
.dm-ant-pillole{position:relative;display:flex;flex-wrap:wrap;gap:8px}
.dm-ant-pillole .dm-ant-voce{display:inline-flex;border-radius:999px}
.dm-ant-segnaposto{display:inline-flex;align-items:center;gap:8px;min-height:40px;padding:4px 40px 4px 6px;border-radius:999px;
  border:1.5px dashed color-mix(in srgb,var(--text-dim,#94a3b8) 55%,transparent);
  background:color-mix(in srgb,var(--card-bg,#fff) 75%,transparent)}
.dm-ant-segnaposto b{font-size:12.5px;font-weight:800;color:var(--text,#0f172a);white-space:nowrap}
.dm-ant-segnaposto-icona{width:30px;height:30px;flex:0 0 30px;display:inline-flex;align-items:center;justify-content:center;
  border-radius:50%;background:var(--surface-3,#eef2f7)}
.dm-ant-segnaposto-icona .dm-oggetto,.dm-ant-segnaposto-icona svg{width:20px;height:20px}
.dm-ant-pillole .dm-ant-occhio{top:50%;right:5px;transform:translateY(-50%);width:30px;height:30px;box-shadow:none}
.dm-ant-pillole .dm-ant-voce[data-spenta="true"]::after{display:none}
/* Il telefono si guarda in piccolo: la griglia e' larga come la Home vera di
   un telefono (390 punti) e, se lo spazio non basta, si rimpicciolisce tutta
   insieme invece di stringere le tessere e tagliarne i nomi. */
.dm-ant-fondo[data-dispositivo="telefono"] .dm-ant-griglia.dm-ant-in-scala{margin:0;transform-origin:0 0}
@media (max-width:520px){
  .dm-ant-fondo{padding:12px 12px 14px}
}
.dm-anteprima .dm-ant-piede{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0;padding:10px 14px 14px;
  border-top:1px solid var(--card-border,#e2e8f0);background:transparent;box-shadow:none;border-radius:0}
.dm-ant-spazio{flex:1 1 auto}
.dm-ant-tasto{min-height:44px;padding:0 16px;border-radius:14px;border:1px solid var(--card-border,#e2e8f0);
  background:var(--card-bg,#fff);color:var(--text,#0f172a);font:inherit;font-size:13.5px;font-weight:800;cursor:pointer}
.dm-ant-tasto[disabled]{opacity:.5;cursor:default}
.dm-ant-salva{min-width:120px;background:var(--accent,#2563eb);border-color:transparent;color:#fff;
  box-shadow:0 10px 22px -12px var(--accent,#2563eb)}
.dm-ant-salva[disabled]{background:var(--surface-3,#e2e8f0);color:var(--text-dim,#64748b);box-shadow:none;opacity:1}
@media (max-width:520px){
  .dm-ant-spazio{display:none}
  .dm-ant-tasto{flex:1 1 auto;padding:0 12px}
}
.dm-anteprima[data-cambiata="true"]{border-color:color-mix(in srgb,#f59e0b 55%,transparent)}
${STILE_RIORDINA}
`,
  );
}

export function installAnteprimaModificabile() {
  if (!doc || state.installed) return;
  state.installed = true;
  doc.addEventListener("dm-riordina", onRiordina);
  root.addEventListener?.("resize", adattaPresto);
  /* In cattura: le voci sono tessere vere, e il loro tocco in plancia apre
   * una finestra — qui il tocco si ferma prima di arrivarci. */
  doc.addEventListener("click", onClick, true);
  doc.addEventListener("click", onSalvaLaScheda, true);
}

senzaCadere(installAnteprimaModificabile);
