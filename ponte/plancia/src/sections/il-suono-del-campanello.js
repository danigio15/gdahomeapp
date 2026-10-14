/* Il suono del campanello sul tablet a muro.
 *
 * Niente file da scaricare: il suono lo fa il browser, con la WebAudio, dalle
 * note scritte in `core/il-campanello-a-muro.js`. Ogni nota e' una piccola
 * campana — la fondamentale e due armonici che muoiono prima — e il giro
 * ricomincia finche' chi suona non smette: «Silenzia», «Apri», «Chiudi», o i
 * trenta secondi dello squillo.
 *
 * Un browser non lascia suonare una pagina che nessuno ha ancora toccato.
 * Dentro l'app di gdahome il WebView lo permette (`app/lib/schermate/
 * riquadro/sul_telefono.dart`); in un browser qualunque il suono parte dal
 * primo tocco in poi, e finche' non c'e' stato il pannello lo dice — una
 * volta — invece di restare muto senza spiegare perche'.
 */
import { noteDelSuono } from "../core/il-campanello-a-muro.js";
import { doc, root } from "./shared.js";

const KEY = "__DASHBOARDMODERN_SUONO_DEL_CAMPANELLO__";
const state = (root[KEY] ||= { contesto: null, giro: 0, voci: [], sbloccato: false, ascolta: false });

/* Gli armonici di una campana: la fondamentale, poi i due che le danno il
 * metallo. Quelli alti muoiono prima, come in una campana vera. */
const ARMONICI = Object.freeze([
  { per: 1, forza: 1, dura: 1 },
  { per: 2.76, forza: 0.32, dura: 0.55 },
  { per: 5.4, forza: 0.1, dura: 0.3 },
]);

function contesto() {
  if (state.contesto) return state.contesto;
  const Contesto = root.AudioContext || root.webkitAudioContext;
  if (typeof Contesto !== "function") return null;
  try {
    state.contesto = new Contesto();
  } catch (_errore) {
    state.contesto = null;
  }
  return state.contesto;
}

/* Il primo tocco sblocca il suono per tutta la vita della pagina: il contesto
 * nasce (o riparte) dentro un gesto, ed e' l'unico momento in cui il browser
 * lo lascia partire. */
function sblocca() {
  const c = contesto();
  if (!c) return;
  c.resume?.()
    ?.then(() => {
      state.sbloccato = c.state === "running";
    })
    ?.catch(() => {});
}

/** Si mette in ascolto del primo tocco. Non fa niente la seconda volta. */
export function ascoltaIlPrimoTocco() {
  if (state.ascolta || !doc) return;
  state.ascolta = true;
  for (const evento of ["pointerdown", "keydown", "touchstart"])
    doc.addEventListener(evento, sblocca, { capture: true, passive: true });
}

/** Se il browser non lascia ancora suonare: serve un tocco. */
export function suonoBloccato() {
  const c = state.contesto;
  return Boolean(c) && c.state !== "running";
}

function rintocco(c, nota, inizio, volume) {
  for (const armonico of ARMONICI) {
    const oscillatore = c.createOscillator();
    const forza = c.createGain();
    const durata = Math.max(0.05, nota.durata * armonico.dura);
    oscillatore.type = "sine";
    oscillatore.frequency.value = nota.frequenza * armonico.per;
    forza.gain.setValueAtTime(0.0001, inizio);
    forza.gain.exponentialRampToValueAtTime(
      Math.max(0.0002, volume * armonico.forza * 0.3),
      inizio + 0.008,
    );
    forza.gain.exponentialRampToValueAtTime(0.0001, inizio + durata);
    oscillatore.connect(forza).connect(c.destination);
    oscillatore.start(inizio);
    oscillatore.stop(inizio + durata + 0.05);
    state.voci.push(oscillatore);
    oscillatore.onended = () => {
      state.voci = state.voci.filter((voce) => voce !== oscillatore);
    };
  }
}

function unGiro(suono, volume) {
  const c = contesto();
  if (!c) return;
  const { note } = noteDelSuono(suono);
  const adesso = c.currentTime + 0.02;
  for (const nota of note) rintocco(c, nota, adesso + nota.inizio, volume);
}

/**
 * Fa suonare il campanello: `suono` e' uno dei nomi del nucleo, `volume` da
 * 0 a 100. Con `ripeti` il giro ricomincia finche' non lo si ferma; senza,
 * suona una volta sola — e' il «▶ Prova» della scheda.
 */
export function suonaIlCampanello(suono, volume = 70, { ripeti = true } = {}) {
  fermaIlCampanello();
  const { giro, note } = noteDelSuono(suono);
  if (!note.length || volume <= 0) return false;
  const c = contesto();
  if (!c) return false;
  c.resume?.()?.catch(() => {});
  const forza = Math.min(1, Math.max(0, volume / 100));
  unGiro(suono, forza);
  if (ripeti && giro > 0)
    state.giro = root.setInterval?.(() => unGiro(suono, forza), giro * 1000) || 0;
  return true;
}

/** Smette di suonare, subito: anche la nota a meta' si spegne. */
export function fermaIlCampanello() {
  if (state.giro) root.clearInterval?.(state.giro);
  state.giro = 0;
  for (const voce of state.voci) {
    try {
      voce.stop();
    } catch (_errore) {}
  }
  state.voci = [];
}

/** Se sta suonando adesso. */
export function staSuonando() {
  return Boolean(state.giro) || state.voci.length > 0;
}
