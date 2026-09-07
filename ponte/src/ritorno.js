/* Come si torna a questa casa.
 *
 * Un telefono che si abbina inquadrando un quadretto non sa niente di dove sia
 * finito: non ha battuto nessun indirizzo, ed e' apposta — chiedere a
 * qualcuno l'indirizzo della propria casa vuol dire chiedergli di andarlo a
 * cercare nel router. Quindi glielo diciamo noi, una volta sola, mentre si
 * abbina.
 *
 * Tre cose:
 *
 *   - **casa**: l'identificativo al centralino. Non e' un segreto, serve a
 *     instradare. Senza, un telefono abbinato dal centralino non saprebbe a
 *     quale filo tornare.
 *   - **centralino**: dove chiamare per entrare da fuori. E' lo stesso a cui
 *     chiama questa casa: se un giorno cambia, i telefoni gia' abbinati lo
 *     scoprono da soli — vedi `PIANO.md`.
 *   - **indirizzi**: dove sta questa casa sulla rete di casa.
 *
 * L'ultimo e' quello che fa la differenza tutti i giorni. Senza, un telefono
 * sul divano manderebbe «accendi la luce» in giro per il mondo e indietro:
 * funziona, ma si sente. Con, in casa si va dritti — cinque millesimi invece
 * di trecento — e il centralino resta quello che deve essere: la strada di
 * quando si e' fuori, non la strada e basta.
 *
 * ─── Perche' si chiede al Supervisor ──────────────────────────────────────
 *
 * Un add-on non vede la rete di casa: sta in un contenitore, e le sue schede
 * di rete dicono `172.30.32.x`, che e' la rete fra gli add-on e non serve a
 * nessun telefono. L'indirizzo su cui i telefoni arrivano e' quello **della
 * macchina** che ospita Home Assistant, e quello lo sa il Supervisor.
 *
 * Se non risponde — permesso mancante, Supervisor vecchio, o si sta girando
 * su un computer per prova — si torna una lista vuota e basta: il telefono
 * passera' dal centralino sempre, che e' piu' lento ma funziona. Un guasto
 * qui non deve impedire un abbinamento.
 */

/* La rete fra gli add-on e il Supervisor. Non e' la rete di casa, e un
 * telefono li' sopra non ci arriva. */
const RETE_DEGLI_ADDON = /^172\.30\./;

/* Ogni quanto si torna a chiedere. Gli indirizzi di casa cambiano poco, e un
 * abbinamento non e' il momento di aspettare una richiesta di rete. */
const QUANTO_DURA = 5 * 60 * 1000;

const ATTESA = 5000;

export class Ritorno {
  constructor({
    identita,
    centralino = "",
    porta = 8098,
    supervisor = process.env.PONTE_SUPERVISOR || "http://supervisor",
    segno = process.env.SUPERVISOR_TOKEN || "",
    fetch: prendi = globalThis.fetch,
    registro,
    adesso = () => Date.now(),
    quantoDura = QUANTO_DURA,
  } = {}) {
    this.identita = identita;
    this.centralino = String(centralino || "").replace(/\/+$/, "");
    this.porta = porta;
    this.supervisor = String(supervisor).replace(/\/+$/, "");
    this.segno = String(segno);
    this.prendi = prendi;
    this.registro = registro ?? { info() {}, attenzione() {}, errore() {} };
    this.adesso = adesso;
    this.quantoDura = quantoDura;

    this._indirizzi = null;
    this._chiestoIl = 0;
  }

  /* Quello che si dice a un telefono che si e' appena abbinato. */
  async cosaDire() {
    return {
      casa: this.identita?.casa ?? null,
      centralino: this.centralino || null,
      indirizzi: await this.indirizzi(),
    };
  }

  async indirizzi() {
    if (this._indirizzi && this.adesso() - this._chiestoIl < this.quantoDura) {
      return this._indirizzi;
    }
    const trovati = await this._chiediAlSupervisor();
    this._indirizzi = trovati;
    this._chiestoIl = this.adesso();
    return trovati;
  }

  async _chiediAlSupervisor() {
    if (!this.segno || typeof this.prendi !== "function") return [];
    try {
      const risposta = await this.prendi(`${this.supervisor}/network/info`, {
        headers: { authorization: `Bearer ${this.segno}` },
        signal: AbortSignal.timeout(ATTESA),
      });
      if (!risposta.ok) {
        this.registro.attenzione(
          `il Supervisor non dice gli indirizzi di casa (${risposta.status}): da fuori si passera' sempre dal centralino`,
        );
        return [];
      }
      const detto = await risposta.json();
      return leggiGliIndirizzi(detto?.data, this.porta);
    } catch (errore) {
      this.registro.attenzione(
        `non riesco a sapere gli indirizzi di casa: ${errore?.message || errore}`,
      );
      return [];
    }
  }
}

/* Da quello che dice il Supervisor alla lista che serve al telefono.
 *
 * Sta fuori dalla classe perche' e' la parte che si sbaglia, ed e' la parte
 * che si prova: la forma di quella risposta non la decidiamo noi, e va letta
 * senza fidarsi di niente.
 */
export function leggiGliIndirizzi(datiDelSupervisor, porta) {
  const schede = datiDelSupervisor?.interfaces;
  if (!Array.isArray(schede)) return [];

  const trovati = [];
  for (const scheda of schede) {
    if (!scheda || scheda.enabled === false) continue;
    const indirizzi = scheda.ipv4?.address;
    if (!Array.isArray(indirizzi)) continue;
    for (const scritto of indirizzi) {
      /* Arrivano come `192.168.1.50/24`: la maschera non serve. */
      const solo = String(scritto || "")
        .split("/")[0]
        .trim();
      if (!eUnIndirizzoDaDare(solo)) continue;
      const con = `${solo}:${porta}`;
      if (!trovati.includes(con)) trovati.push(con);
    }
  }
  /* Piu' di quattro vuol dire che si sta guardando qualcosa che non e' una
   * casa: il telefono li proverebbe tutti, e ognuno costa un'attesa. */
  return trovati.slice(0, 4);
}

function eUnIndirizzoDaDare(indirizzo) {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(indirizzo)) return false;
  if (indirizzo.startsWith("127.")) return false;
  /* Quello che si da' a un telefono quando nessuno ha ancora dato un
   * indirizzo: non porta da nessuna parte. */
  if (indirizzo.startsWith("169.254.")) return false;
  if (RETE_DEGLI_ADDON.test(indirizzo)) return false;
  return true;
}
