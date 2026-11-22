/* Il flusso dell'energia, grande, in Home (#460).
 *
 * «Vorrei una card da esporre in primo piano del fotovoltaico e non il
 * semplice widget, si può fare?» La tessera Energia della Home dice un numero
 * — quanto consuma la casa — e sotto, piccoli, quelli del giorno. Il disegno
 * con il sole, la rete, la batteria e le frecce sta nella pagina Energia, e
 * chi vuole vederlo passando davanti al tablet deve aprirla.
 *
 * Adesso c'e' anche in Home, come blocco: «Flusso energia», che si accende
 * fra i blocchi della Home e si mette dove si vuole con gli altri. Il sole, la
 * rete, la batteria e la casa — e l'auto, se il flusso dell'Energia ha gia' la
 * sua wallbox — con le frecce nel verso giusto, piu' grosse quanto piu' passa.
 *
 * I numeri non sono nuovi: sono le letture di casa che la plancia fa gia'
 * (`lettureDiCasa`, le stesse della tessera), spartite con la stessa
 * aritmetica dell'Energia (`allocateSourceFlows`) e con lo stesso spessore
 * (`flowIntensity`). Un nodo senza sensore non c'e': una casa senza batteria
 * non vede una batteria a zero.
 *
 * Qui non c'e' DOM: quali nodi, dove stanno, quali frecce e in che verso.
 */
import { allocateSourceFlows } from "./energy-flow-truth.js";
import { flowIntensity } from "./energy-flow-topology.js";

/** Il nome del blocco nella fila della Home (`core/ordine-dei-blocchi.js`). */
export const BLOCCO_DEL_FLUSSO = "flusso";

/** Dove si scrive se il blocco si vede: una scelta della casa, nel config. */
export const CHIAVE_FLUSSO_IN_HOME = "cd_home_flusso";

/**
 * Se il blocco si vede.
 *
 * Spento di serie: una Home non deve riempirsi da sola di un disegno grande
 * che nessuno ha chiesto, e chi ha gia' la tessera Energia la ritrova com'era.
 * Si accende solo con un «si» scritto.
 */
export function ilFlussoSiVede(scritto) {
  return (
    String(scritto ?? "")
      .trim()
      .toLowerCase() === "si"
  );
}

/** Come si salva la scelta: «si», oppure niente (la casella vuota vale «no»). */
export function sceltaDelFlusso(acceso) {
  return acceso ? "si" : null;
}

/* Sotto quanti watt una freccia e' ferma: il rumore di un inverter di notte
 * non e' un flusso. E' la soglia con cui il guscio dell'Energia spegne le sue
 * linee. */
export const SOGLIA_DEL_FLUSSO_W = 10;

/* I nodi, nell'ordine in cui si leggono. */
export const NODI_DEL_FLUSSO = Object.freeze(["solare", "rete", "casa", "batteria", "auto"]);

const numero = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const positivo = (v) => (v != null && v > 0 ? v : 0);

/* Che cosa sta facendo un nodo, in una parola che la sezione traduce. */
function versoDel(k, watt) {
  if (watt == null) return "";
  const fermo = Math.abs(watt) < SOGLIA_DEL_FLUSSO_W;
  if (k === "solare") return fermo ? "fermo" : "produce";
  if (k === "rete") return fermo ? "fermo" : watt > 0 ? "preleva" : "immette";
  if (k === "batteria") return fermo ? "ferma" : watt > 0 ? "scarica" : "carica";
  if (k === "auto") return fermo ? "ferma" : "carica";
  return fermo ? "fermo" : "consuma";
}

/**
 * I nodi e le frecce, dai numeri di casa.
 *
 * @param {{solare?:number|null, rete?:number|null, batteria?:number|null,
 *   casa?:number|null, soc?:number|null}} letture coi versi di `lettureDiCasa`:
 *   rete positiva = prelievo, batteria positiva = scarica.
 * @param {{auto?: {watt:number|null, soc?:number|null}|null}} altro l'auto,
 *   solo quando il flusso dell'Energia ha la sua wallbox.
 * @returns {{nodi: Array<{k:string, watt:number|null, soc:number|null,
 *   verso:string}>, archi: Array<{id:string, da:string, a:string, watt:number,
 *   attivo:boolean, sempre:boolean, larghezza:number, durata:number}>,
 *   vuoto:boolean}}
 *   `vuoto` quando non c'e' nessuna sorgente (ne' sole, ne' rete, ne'
 *   batteria): un flusso con la sola casa non ha niente da disegnare.
 *   `sempre` dice le frecce che si vedono anche ferme, smorte: i raggi verso
 *   casa e verso l'auto. Le altre compaiono solo quando passa qualcosa.
 */
export function ilFlussoDiCasa(letture = {}, { auto = null } = {}) {
  const solare = numero(letture?.solare);
  const rete = numero(letture?.rete);
  const batteria = numero(letture?.batteria);
  const casa = numero(letture?.casa);
  const soc = numero(letture?.soc);
  const ceAuto = auto && typeof auto === "object" && numero(auto.watt) != null;
  const ce = {
    solare: solare != null,
    rete: rete != null,
    batteria: batteria != null || soc != null,
    auto: Boolean(ceAuto),
  };
  const vuoto = !ce.solare && !ce.rete && !ce.batteria;
  ce.casa = !vuoto;
  const nodi = [];
  const metti = (k, watt, carica = null) => {
    if (ce[k])
      nodi.push({
        k,
        watt,
        soc: carica == null ? null : Math.max(0, Math.min(100, carica)),
        verso: versoDel(k, watt),
      });
  };
  metti("solare", solare);
  metti("rete", rete);
  metti("casa", casa);
  metti("batteria", batteria, soc);
  if (ceAuto) metti("auto", numero(auto.watt), numero(auto.soc));
  if (vuoto) return { nodi: [], archi: [], vuoto: true };

  const f = allocateSourceFlows({
    solar: positivo(solare),
    grid: rete ?? 0,
    battery: batteria ?? 0,
  });
  const verso = (da, a, watt, sempre = false) => ({ da, a, watt: positivo(watt), sempre });
  const tutti = [
    verso("solare", "casa", f.solarToHome, true),
    verso("rete", "casa", f.gridToHome, true),
    verso("batteria", "casa", f.batteryToHome, true),
    verso("solare", "rete", f.solarToGrid),
    verso("solare", "batteria", f.solarToBattery),
    /* Rete e batteria hanno una strada sola, percorsa nei due versi: vince
     * quello in cui passa qualcosa. */
    f.batteryToGrid > f.gridToBattery
      ? verso("batteria", "rete", f.batteryToGrid)
      : verso("rete", "batteria", f.gridToBattery),
    ...(ceAuto ? [verso("casa", "auto", Math.abs(numero(auto.watt)), true)] : []),
  ].filter((arco) => ce[arco.da] && ce[arco.a]);
  const attivi = tutti.filter((arco) => arco.watt >= SOGLIA_DEL_FLUSSO_W);
  const picco = attivi.reduce((m, arco) => Math.max(m, arco.watt), 0);
  const archi = tutti.map((arco) => {
    const attivo = arco.watt >= SOGLIA_DEL_FLUSSO_W;
    const forza = flowIntensity(attivo ? arco.watt : 0, picco);
    return {
      id: [arco.da, arco.a].sort().join("-"),
      ...arco,
      attivo,
      larghezza: attivo ? forza.width : 2,
      durata: attivo ? forza.duration : 0,
    };
  });
  return { nodi, archi, vuoto: false };
}

/**
 * Dove sta ogni nodo, in percento del palco, e quante file ha il disegno.
 *
 * Una croce con la casa nel mezzo: il sole sopra, la rete a sinistra, la
 * batteria a destra, l'auto sotto. Le file che non servono non ci sono — una
 * casa senza fotovoltaico non lascia un buco in alto — e il palco e' alto
 * quanto le sue file. La stessa croce va sul telefono e sul tablet: cambiano
 * le misure, non i posti.
 */
export function postiDelFlusso(nodi = []) {
  const quali = new Set((Array.isArray(nodi) ? nodi : []).map((n) => n?.k));
  const file = [];
  if (quali.has("solare")) file.push("sopra");
  file.push("mezzo");
  if (quali.has("auto")) file.push("sotto");
  const y = (fila) => ((file.indexOf(fila) + 0.5) / file.length) * 100;
  const posti = {};
  if (quali.has("solare")) posti.solare = { x: 50, y: y("sopra") };
  if (quali.has("rete")) posti.rete = { x: 15, y: y("mezzo") };
  if (quali.has("casa")) posti.casa = { x: 50, y: y("mezzo") };
  if (quali.has("batteria")) posti.batteria = { x: 85, y: y("mezzo") };
  if (quali.has("auto")) posti.auto = { x: 50, y: y("sotto") };
  return { posti, file: file.length };
}

/**
 * La strada di una freccia, in pixel, fra due centri.
 *
 * Diritta fra la casa e i suoi vicini; dal sole verso la rete e la batteria
 * prima in orizzontale e poi giu', come nell'Energia; fra rete e batteria un
 * arco che passa sopra la casa. `r` e' il raggio dei cerchi (`rDa` e `rA`
 * quando i due capi sono diversi, come la casa che e' piu' grande): la
 * freccia parte e arriva sul bordo, non al centro.
 */
export function stradaFra(da, a, { r = 0, rDa = r, rA = r, arco = false, gomito = false } = {}) {
  if (!da || !a) return "";
  const t = (v) => Math.round(v * 10) / 10;
  if (arco) {
    /* Abbastanza in alto da scavalcare la casa, che sta in mezzo ed e' piu'
     * grande degli altri: il colmo di una curva cosi' sta a meta' altezza. */
    const sopra =
      Math.min(da.y, a.y) - Math.max(Math.max(rDa, rA) * 3.6, Math.abs(a.x - da.x) * 0.22);
    const cx = (da.x + a.x) / 2;
    const p0 = verso(da, { x: cx, y: sopra }, rDa);
    const p1 = verso(a, { x: cx, y: sopra }, rA);
    return `M ${t(p0.x)} ${t(p0.y)} Q ${t(cx)} ${t(sopra)} ${t(p1.x)} ${t(p1.y)}`;
  }
  if (gomito) {
    const c = { x: a.x, y: da.y };
    const p0 = verso(da, c, rDa);
    const p1 = verso(a, c, rA);
    return `M ${t(p0.x)} ${t(p0.y)} Q ${t(c.x)} ${t(c.y)} ${t(p1.x)} ${t(p1.y)}`;
  }
  const p0 = verso(da, a, rDa);
  const p1 = verso(a, da, rA);
  return `M ${t(p0.x)} ${t(p0.y)} L ${t(p1.x)} ${t(p1.y)}`;
}

/* Il punto sul bordo del cerchio di centro `c`, guardando verso `p`. */
function verso(c, p, r) {
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  const l = Math.hypot(dx, dy) || 1;
  return { x: c.x + (dx / l) * r, y: c.y + (dy / l) * r };
}
