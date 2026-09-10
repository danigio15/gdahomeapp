/* Lo spegnimento programmato del clima (#364): il conto alla rovescia sta
 * nel ponte.
 *
 * «Vorrei uno slider per decidere il tempo che un condizionatore debba
 * restare acceso dal momento che gli do l'on, utile spesso di notte o per
 * accensioni a spot.»
 *
 * La parte che conta non e' lo slider, e' **dove vive il conto alla
 * rovescia**. Un timer nel browser muore chiudendo la pagina, e chi accende
 * il condizionatore per due ore prima di dormire la pagina la chiude sempre:
 * resterebbe acceso tutta la notte. Nella dashboard il timer lo tiene
 * l'integrazione dentro Home Assistant (`spegnimento.py`); qui l'integrazione
 * non c'e' — la plancia la porta l'add-on — e allora lo tiene il ponte, con
 * le stesse tre scelte:
 *
 *   - **la scadenza si scrive sul disco.** Un riavvio dell'add-on nel mezzo
 *     della notte non deve lasciare acceso un condizionatore: all'avvio le
 *     scadenze si rileggono e si riarmano, e quelle gia' passate si eseguono
 *     subito — meglio spegnere in ritardo che non spegnere;
 *   - **lo spegnimento e' `homeassistant.turn_off`.** Nella casella
 *     dell'unita' puo' esserci un `climate`, ma anche uno `switch` o un
 *     `input_boolean`: quel servizio sceglie da se' il dominio giusto;
 *   - **il timer si annulla da solo quando l'unita' viene spenta a mano.**
 *     Chi spegne prima non deve ritrovarsi un timer che, due ore dopo,
 *     spegne un'unita' che nel frattempo qualcun altro aveva riacceso.
 *
 * La plancia chiede tre cose sul filo, con gli stessi nomi dell'integrazione:
 * `dashboardmodern/clima/timer/list`, `/set {entity_id, minuti}` e
 * `/clear {entity_id}`. Chi risponde e' `commissioni.js`; qui c'e' solo il
 * conto.
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/* Il piu' corto e il piu' lungo che si possano chiedere, in minuti: sono gli
 * estremi dello slider in plancia. */
export const MIN_MINUTI = 1;
export const MAX_MINUTI = 720;

/* Quanti timer possono stare appesi insieme. Uno per unita' climatica, e le
 * unita' sono una decina: cento e' un fondo, non un limite che si tocca. */
export const MAX_TIMER = 100;

/* Quanto si aspetta prima di scrivere: una raffica di tocchi non e' una
 * raffica di file. */
const SCRIVI_DOPO = 5_000;

const NOME_DEL_FILE = "spegnimenti.json";

export class Spegnimento {
  constructor({
    casa,
    cartella,
    registro = null,
    adesso = () => Date.now(),
    /* I timer si passano da fuori perche' le prove non aspettino: sul banco
     * un'ora dura un istante. */
    programma = (fra, cosa) => setTimeout(cosa, fra),
    annulla = (segno) => clearTimeout(segno),
  } = {}) {
    this.casa = casa;
    this.percorso = cartella ? join(cartella, NOME_DEL_FILE) : "";
    this.registro = registro ?? { info() {}, attenzione() {}, errore() {} };
    this.adesso = adesso;
    this._programma = programma;
    this._annulla = annulla;
    /* entity_id -> scadenza in millisecondi. */
    this._scadenze = new Map();
    /* entity_id -> il segno con cui si disarma l'allarme. */
    this._allarmi = new Map();
    this._scrittura = null;
    this._caricato = false;
    this._lascia = null;
  }

  /* ── memoria ─────────────────────────────────────────────────────────── */

  /* Rilegge le scadenze dal disco e rimette in piedi gli allarmi. Si fa una
   * volta sola; si puo' chiamare quante volte si vuole. */
  carica() {
    if (this._caricato) return;
    this._caricato = true;
    if (this.percorso) {
      try {
        const letto = JSON.parse(readFileSync(this.percorso, "utf8"));
        const grezze = letto?.scadenze;
        if (grezze && typeof grezze === "object") {
          for (const [entita, scadenza] of Object.entries(grezze)) {
            const quando = Number(scadenza);
            if (typeof entita === "string" && entita.includes(".") && Number.isFinite(quando))
              this._scadenze.set(entita, quando);
          }
        }
      } catch (_errore) {
        /* Nessun file, o un file storto: e' come non avere timer. */
      }
    }
    for (const entita of [...this._scadenze.keys()]) this._arma(entita);
    this._ascolta();
  }

  _salva() {
    if (!this.percorso) return;
    if (this._scrittura) return;
    this._scrittura = this._programma(SCRIVI_DOPO, () => {
      this._scrittura = null;
      this.scriviAdesso();
    });
  }

  /* Scrive subito: allo spegnimento dell'add-on, e nelle prove. */
  scriviAdesso() {
    if (!this.percorso) return;
    if (this._scrittura) {
      this._annulla(this._scrittura);
      this._scrittura = null;
    }
    try {
      mkdirSync(dirname(this.percorso), { recursive: true });
      const provvisorio = `${this.percorso}.nuovo`;
      writeFileSync(
        provvisorio,
        JSON.stringify({ scadenze: Object.fromEntries(this._scadenze) }, null, 2),
      );
      renameSync(provvisorio, this.percorso);
    } catch (errore) {
      this.registro.attenzione(`spegnimenti non scritti: ${errore?.message || errore}`);
    }
  }

  /* ── allarmi ─────────────────────────────────────────────────────────── */

  _disarma(entita) {
    const segno = this._allarmi.get(entita);
    if (segno === undefined) return;
    this._allarmi.delete(entita);
    this._annulla(segno);
  }

  /* Mette l'allarme per la scadenza di quell'entita'. Una scadenza gia'
   * passata — il riavvio nel mezzo della notte — non si butta: si esegue
   * subito. */
  _arma(entita) {
    this._disarma(entita);
    const scadenza = this._scadenze.get(entita);
    if (scadenza === undefined) return;
    const fra = Math.max(0, scadenza - this.adesso());
    this._allarmi.set(
      entita,
      this._programma(fra, () => {
        this._allarmi.delete(entita);
        this.spegni(entita).catch((errore) => {
          this.registro.attenzione(
            `${entita}: lo spegnimento programmato non e' riuscito: ${errore?.message || errore}`,
          );
        });
      }),
    );
  }

  /* ── quello che la plancia chiede ────────────────────────────────────── */

  /* Le scadenze appese, cosi' come stanno. */
  scadenze() {
    this.carica();
    return Object.fromEntries(this._scadenze);
  }

  /* Programma lo spegnimento di quell'entita' fra quei minuti. Zero minuti
   * vuol dire «togli il timer», e torna `null` perche' non c'e' nessuna
   * scadenza da mostrare. */
  programma(entita, minuti) {
    this.carica();
    const quanti = Math.trunc(Number(minuti) || 0);
    if (quanti <= 0) {
      this.annulla(entita);
      return null;
    }
    const dentro = Math.max(MIN_MINUTI, Math.min(quanti, MAX_MINUTI));
    if (!this._scadenze.has(entita) && this._scadenze.size >= MAX_TIMER) {
      /* Il fondo: prima cede la scadenza piu' lontana, che e' quella che ha
       * ancora piu' tempo per essere rimessa. */
      let piuLontana = null;
      for (const [quale, quando] of this._scadenze)
        if (piuLontana === null || quando > this._scadenze.get(piuLontana)) piuLontana = quale;
      this._disarma(piuLontana);
      this._scadenze.delete(piuLontana);
    }
    const scadenza = this.adesso() + dentro * 60_000;
    this._scadenze.set(entita, scadenza);
    this._arma(entita);
    this._salva();
    this._ascolta();
    return scadenza;
  }

  /* Toglie il timer di quell'entita', senza toccare l'entita'. */
  annulla(entita) {
    this.carica();
    this._disarma(entita);
    if (this._scadenze.delete(entita)) {
      this._salva();
      this._ascolta();
    }
    return null;
  }

  /* La scadenza e' arrivata: spegni, e togli il timer. */
  async spegni(entita) {
    this._disarma(entita);
    if (this._scadenze.delete(entita)) {
      this._salva();
      this._ascolta();
    }
    await this.casa.chiedi({
      type: "call_service",
      domain: "homeassistant",
      service: "turn_off",
      service_data: { entity_id: entita },
    });
    this.registro.info(`${entita}: spento allo scadere del timer`);
  }

  /* ── chi spegne a mano si porta via anche il timer ───────────────────── */

  /* Segue i cambi di stato finche' c'e' almeno un timer, e nessun altro
   * momento: un'unita' che va a `off` da sola si porta via il suo timer.
   * L'ascolto e' del filo del ponte, che si riapre da solo se cade; se al
   * momento di abbonarsi la casa non risponde, si riprova al prossimo timer. */
  _ascolta() {
    if (!this._scadenze.size) {
      if (this._lascia) {
        const lascia = this._lascia;
        this._lascia = null;
        Promise.resolve()
          .then(() => lascia())
          .catch(() => {});
      }
      return;
    }
    if (this._lascia || this._abbonandomi || typeof this.casa?.ascolta !== "function") return;
    this._abbonandomi = this.casa
      .ascolta("state_changed", (evento) => this._cambiata(evento))
      .then(
        (lascia) => {
          this._abbonandomi = null;
          this._lascia = () => {
            this._lascia = null;
            return lascia();
          };
          /* Nel frattempo i timer possono essere finiti tutti. */
          if (!this._scadenze.size) this._ascolta();
        },
        (errore) => {
          this._abbonandomi = null;
          this.registro.attenzione(`non seguo gli stati del clima: ${errore?.message || errore}`);
        },
      );
  }

  _cambiata(evento) {
    const dati = evento?.data;
    const entita = dati?.entity_id;
    if (!entita || !this._scadenze.has(entita)) return;
    const nuovo = dati.new_state;
    /* `null` e' l'entita' sparita, non spenta: un'integrazione che si ricarica
     * non deve buttare il timer di chi sta dormendo. */
    if (!nuovo || nuovo.state === "unknown" || nuovo.state === "unavailable") return;
    if (nuovo.state === "off") this.annulla(entita);
  }

  /* Spegne per bene: gli allarmi si disarmano (il file li ricorda) e quello
   * che era da scrivere si scrive adesso. */
  chiudi() {
    for (const entita of [...this._allarmi.keys()]) this._disarma(entita);
    if (this._lascia) {
      const lascia = this._lascia;
      this._lascia = null;
      Promise.resolve()
        .then(() => lascia())
        .catch(() => {});
    }
    this.scriviAdesso();
  }
}
