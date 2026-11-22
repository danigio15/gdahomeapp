/* Le statistiche dei periodi chiusi, tenute sul dispositivo.
 *
 * «Il Recorder di Home Assistant ci ha messo troppo a rispondere», fermo su
 * «Sto ancora leggendo le statistiche del Recorder · 3/4», ogni volta che si
 * apriva l'Energia. La quarta domanda era l'anno: dieci mesi di secchielli per
 * ogni entita' in una domanda sola, che su una casa con lo storico grande non
 * stava nel minuto, e quindi non arrivava mai. E non arrivando mai, non si
 * teneva mai: alla volta dopo si ripartiva da capo, e si cadeva uguale.
 *
 * Due cose, qui:
 *
 * - quando un arco lungo scade, lo si chiede **un mese alla volta**: le righe
 *   sono le stesse (gli spicchi si toccano senza sovrapporsi), ma ognuno sta
 *   nel suo tempo, e uno che cade non porta giu' gli altri;
 * - le risposte dei periodi **chiusi** — un mese finito non cambia piu' — si
 *   tengono sul dispositivo, non solo dieci minuti in memoria: riaprendo la
 *   plancia l'anno costa solo il mese in corso.
 *
 * Le righe tenute appartengono a una casa: due case con lo stesso
 * `sensor.casa_totale` sullo stesso telefono non devono mai leggersi a vicenda.
 * Per questo la chiave porta l'impronta della casa, e senza impronta non si
 * tiene niente sul dispositivo.
 */

/* Quanto valgono le righe tenute. Un mese chiuso non cambia, ma chi corregge
 * le statistiche dagli strumenti di Home Assistant deve rivedere il numero
 * giusto prima o poi: due settimane. */
export const DURATA_DELLE_STATISTICHE_TENUTE_MS = 14 * 86400000;

/* Quanto spazio prendono, al massimo. Il dispositivo ne ha poco (qualche
 * megabyte per tutta la plancia), e la configurazione viene prima. */
export const SPAZIO_DELLE_STATISTICHE_TENUTE = 1_500_000;

/* Per quanto, dopo che un arco lungo e' scaduto, lo si chiede direttamente a
 * spicchi senza riprovare prima tutto intero (un minuto buttato a ogni giro). */
export const RICORDO_DEL_RECORDER_LENTO_MS = 7 * 86400000;

const CHIAVE_DELLE_RIGHE = "dm_statistiche_tenute_v1";
const CHIAVE_DEL_RECORDER_LENTO = "dm_recorder_a_spicchi_v1";

/* Gli spicchi di un arco, ai confini dei mesi (ora locale, come gli archi).
 *
 * Contigui e senza sovrapposizioni: il Recorder da' le righe che *cominciano*
 * dentro l'arco, quindi la loro unione e' esattamente la risposta dell'arco
 * intero. Un arco che sta dentro un mese esce da solo. */
export function spicchiDellArco(start, end) {
  const da = new Date(start);
  const a = new Date(end);
  if (!(da < a)) return [];
  const spicchi = [];
  let inizio = da;
  while (inizio < a) {
    const prossimo = new Date(inizio.getFullYear(), inizio.getMonth() + 1, 1);
    const fine = prossimo < a ? prossimo : a;
    spicchi.push({ start: inizio, end: fine });
    inizio = fine;
  }
  return spicchi;
}

/* Le righe di piu' spicchi, rimesse insieme per entita' e in ordine. Una riga
 * che arrivasse due volte (lo stesso inizio) si tiene una volta sola. */
export function unisciLeRighe(risposte = []) {
  const perEntita = new Map();
  for (const risposta of risposte) {
    for (const [id, righe] of Object.entries(risposta || {})) {
      if (!Array.isArray(righe)) continue;
      const viste = perEntita.get(id) || new Map();
      for (const riga of righe) {
        const quando = Date.parse(riga?.start) || Number(riga?.start) || 0;
        if (!viste.has(quando)) viste.set(quando, riga);
      }
      perEntita.set(id, viste);
    }
  }
  return Object.fromEntries(
    [...perEntita].map(([id, viste]) => [
      id,
      [...viste.entries()].sort((x, y) => x[0] - y[0]).map(([, riga]) => riga),
    ]),
  );
}

/* Un numero breve che riconosce la casa: dove sta (la zona «home» di Home
 * Assistant) e da dove la si guarda. Non si scrive la posizione: se ne tiene
 * solo un'impronta, che serve a non mescolare due case. */
export function improntaDellaCasa(root = globalThis) {
  try {
    const casa = root.STATES?.["zone.home"]?.attributes || root._RAW_STATES?.["zone.home"]?.attributes;
    const lat = Number(casa?.latitude);
    const lon = Number(casa?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return "";
    const testo = [
      lat.toFixed(4),
      lon.toFixed(4),
      root.location?.host || "",
      root.__DASHBOARDMODERN_INSTANCE__ || "",
    ].join("|");
    /* FNV-1a a 32 bit: non deve essere segreto, deve solo distinguere. */
    let h = 0x811c9dc5;
    for (let i = 0; i < testo.length; i += 1) {
      h ^= testo.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(36);
  } catch (_errore) {
    return "";
  }
}

function leggi(storage, chiave) {
  try {
    const testo = storage?.getItem?.(chiave);
    if (!testo) return null;
    const valore = JSON.parse(testo);
    return valore && typeof valore === "object" ? valore : null;
  } catch (_errore) {
    return null;
  }
}

function scrivi(storage, chiave, valore) {
  try {
    storage?.setItem?.(chiave, JSON.stringify(valore));
    return true;
  } catch (_errore) {
    /* Pieno, o vietato (navigazione privata): si resta con la memoria. */
    return false;
  }
}

/* Le righe dei periodi chiusi sul dispositivo: una voce per domanda. */
export class StatisticheTenute {
  constructor({
    storage = globalThis.localStorage,
    impronta = () => improntaDellaCasa(),
    adesso = () => Date.now(),
    durata = DURATA_DELLE_STATISTICHE_TENUTE_MS,
    spazio = SPAZIO_DELLE_STATISTICHE_TENUTE,
  } = {}) {
    this.storage = storage;
    this.impronta = impronta;
    this.adesso = adesso;
    this.durata = durata;
    this.spazio = spazio;
  }

  chiaveDi(chiave) {
    const casa = this.impronta();
    return casa ? `${casa}|${chiave}` : "";
  }

  prendi(chiave) {
    const completa = this.chiaveDi(chiave);
    if (!completa) return null;
    const voce = leggi(this.storage, CHIAVE_DELLE_RIGHE)?.[completa];
    if (!voce || !(Number(voce.fino) > this.adesso())) return null;
    return voce.righe ?? null;
  }

  metti(chiave, righe) {
    const completa = this.chiaveDi(chiave);
    if (!completa || righe == null) return false;
    const tutte = leggi(this.storage, CHIAVE_DELLE_RIGHE) || {};
    const ora = this.adesso();
    /* Le scadute escono; quella nuova va in fondo, cosi' quando lo spazio
     * manca escono per prime le piu' vecchie. */
    const tenute = Object.entries(tutte).filter(
      ([nome, voce]) => nome !== completa && Number(voce?.fino) > ora,
    );
    tenute.push([completa, { fino: ora + this.durata, righe }]);
    while (tenute.length) {
      const testo = JSON.stringify(Object.fromEntries(tenute));
      if (testo.length <= this.spazio && scrivi(this.storage, CHIAVE_DELLE_RIGHE, Object.fromEntries(tenute)))
        return true;
      /* Una sola voce che da sola non ci sta non si tiene. */
      if (tenute.length === 1) break;
      tenute.shift();
    }
    return false;
  }

  /* Se di recente un arco lungo e' scaduto: allora si va a spicchi subito. */
  recorderLento() {
    const casa = this.impronta();
    const da = Number(leggi(this.storage, CHIAVE_DEL_RECORDER_LENTO)?.[casa || "_"]);
    return Number.isFinite(da) && this.adesso() - da < RICORDO_DEL_RECORDER_LENTO_MS;
  }

  segnaIlRecorderLento() {
    const casa = this.impronta() || "_";
    const tutte = leggi(this.storage, CHIAVE_DEL_RECORDER_LENTO) || {};
    tutte[casa] = this.adesso();
    scrivi(this.storage, CHIAVE_DEL_RECORDER_LENTO, tutte);
  }
}
