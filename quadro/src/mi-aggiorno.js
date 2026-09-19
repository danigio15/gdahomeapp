/* Se il quadro riesce ad aggiornarsi, e da quanto non ci riesce.
 *
 * Il giro degli aggiornamenti gira ogni dieci minuti e chiede a GitHub qual e'
 * l'ultima versione del segno che segue. Quando quella domanda non ha risposta
 * — il segno cancellato, il gettone scaduto, GitHub giu', la rete che non c'e'
 * — prima **usciva in silenzio**: il quadro restava sull'ultima versione che
 * aveva, e non lo diceva a nessuno.
 *
 * E' il guasto peggiore che un pezzo come questo possa avere, perche' somiglia
 * in tutto a stare bene: il quadro risponde, le case depositano, le pagine si
 * aprono. Solo che le correzioni non arrivano piu', e ci si accorge il giorno
 * che serve una correzione.
 *
 * ─── Perche' non lo dice subito ───────────────────────────────────────────
 *
 * Perche' un tentativo andato a vuoto non vuol dire niente. GitHub ha i suoi
 * minuti storti, e una macchina in casa di qualcuno ha la sua rete. Dirlo al
 * primo vorrebbe dire un avviso che si accende da solo una volta a settimana
 * e che dopo un mese nessuno guarda piu' — ed e' lo stesso motivo per cui gli
 * avvisi delle case tacciono quattro volte su cinque.
 *
 * Un'ora sono **sei giri di fila** andati a vuoto. Quella non e' piu' una rete
 * storta: e' qualcosa che qualcuno deve guardare.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** Come si chiama il foglietto che il giro lascia quando non ce la fa. */
export const FOGLIETTO = "non-mi-aggiorno";

/**
 * Dove sta scritta la versione che gira adesso.
 *
 * Non la scriviamo noi: la scrive `accendi.sh` quando **scambia** il codice,
 * cioe' solo dopo che le prove di quella versione sono passate. E' il numero
 * vero di quello che sta girando, non quello che si sperava di far girare.
 *
 * Sta accanto alla cartella del codice e non dentro (`/opt/quadro/versione`,
 * col codice in `/opt/quadro/quadro/`), perche' il giro degli aggiornamenti
 * scambia la cartella del codice intera: un file dentro sarebbe cancellato e
 * riscritto proprio da chi lo deve leggere.
 */
const LA_VERSIONE = fileURLToPath(new URL("../../versione", import.meta.url));

/** Da quanto deve durare prima che valga la pena dirlo. */
export const DOPO_QUANTO = 60 * 60 * 1000;

/**
 * Come va l'aggiornamento. Torna `null` quando non c'e' niente da dire —
 * che e' il caso normale, e quello silenzioso.
 *
 * @returns {{da: string, ore: number, perche: string} | null}
 */
export function comeVaLAggiornamento({ cartella = "./dati", adesso = () => Date.now() } = {}) {
  let scritto = "";
  try {
    scritto = readFileSync(join(cartella, FOGLIETTO), "utf8");
  } catch (_errore) {
    /* Nessun foglietto: o non ha mai sbagliato, o l'ultimo giro e' andato bene
     * e se l'e' portato via. Sono la stessa cosa, e non si dice niente. */
    return null;
  }

  const [quando, ...resto] = String(scritto).split("\n");
  const primo = Number(String(quando).trim()) * 1000;
  if (!Number.isFinite(primo) || primo <= 0) return null;

  const da = adesso() - primo;
  if (da < DOPO_QUANTO) return null;

  return {
    da: new Date(primo).toISOString(),
    ore: Math.floor(da / (60 * 60 * 1000)),
    perche: resto.join("\n").trim() || "non si sa",
  };
}

/**
 * Quale versione sta girando: le prime sette cifre del commit.
 *
 * ─── Perche' serve ────────────────────────────────────────────────────────
 *
 * Perche' senza, «il quadro si e' aggiornato?» non ha risposta. Da nessuna
 * parte: non da `/salute`, che diceva solo di essere vivo; non dalla soglia,
 * che e' un testo fisso; non dalle pagine, che mostrano la versione **delle
 * case**, non la sua. Restava guardare il registro entrando nella macchina —
 * cioe' la cosa che questo quadro esiste apposta per non dover fare.
 *
 * E' la domanda che si fa ogni volta che si rilascia qualcosa, ed e' anche
 * quella che si fa quando una correzione sembra non essere arrivata. Una
 * macchina che si aggiorna da sola deve saper dire **a che punto e'**: se no
 * l'unico modo di controllarla e' fidarsi.
 *
 * Sette cifre e non quaranta perche' e' un numero che qualcuno legge e
 * confronta a occhio con quello dell'ultimo rilascio.
 *
 * Stringa vuota quando quel file non c'e': un quadro fatto partire a mano,
 * o uno sul banco di chi lo sta scrivendo. Non e' un guasto, e non si dice
 * niente.
 *
 * @returns {string} sette cifre esadecimali, o stringa vuota
 */
export function laVersioneCheGira({ dove = LA_VERSIONE } = {}) {
  try {
    const scritto = readFileSync(dove, "utf8").trim();
    return /^[0-9a-f]{40}$/.test(scritto) ? scritto.slice(0, 7) : "";
  } catch (_nonCE) {
    return "";
  }
}
