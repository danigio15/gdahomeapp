/* Le luci di Natale, accese e spente dalla casa.
 *
 * L'albero su una presa smart deve accendersi al tramonto e spegnersi alle
 * undici e mezza anche quando nessuno ha la plancia aperta: a quell'ora la
 * plancia e' chiusa in tasca, o non c'e' proprio. Per questo l'orario sta
 * qui, nel ponte, che gira finche' gira Home Assistant — come la ricarica di
 * notte (`ricarica-di-notte.js`), di cui questo file ricalca la forma.
 *
 * Le regole non stanno qui: stanno in `plancia/src/core/feste.js`, che la
 * plancia legge per raccontarle («si spengono alle 23:30») e il ponte per
 * eseguirle — una regola sola, due lettori. Qui ci sono le tre cose che la
 * plancia non puo' fare:
 *
 *  - **guardare l'orologio** ogni mezzo minuto, a pagine chiuse;
 *  - **accendere e spegnere** con `light.turn_on`, `switch.turn_on`,
 *    `input_boolean.turn_on` (e i loro `turn_off`), sul filo del ponte;
 *  - **ricordarsi l'intervallo sul disco** (`/data/luci-di-natale.json`):
 *    se le ha gia' accese stasera, o se qualcuno le ha spente a mano. Un
 *    riavvio dell'add-on alle nove di sera non deve riaccendere un albero che
 *    uno aveva spento apposta.
 *
 * ── Solo nelle feste ──────────────────────────────────────────────────────
 *
 * Fuori dalla finestra delle feste (dall'8 dicembre al 6 gennaio, `inFesta`)
 * questo modulo non fa niente: nessuna accensione, nessuno spegnimento,
 * nemmeno la lettura degli stati. L'unica eccezione e' lo spegnimento di un
 * intervallo che lui stesso ha aperto e che finisce proprio con la fine delle
 * feste: e' chiudere la porta che si era aperta.
 *
 * Le impostazioni le legge dalla configurazione della plancia principale
 * (`cd_feste`), che viaggia gia' fra i dispositivi; gli stati dallo specchio
 * della casa che tengono le notifiche (`sentinella.js`): chiedere `get_states`
 * ogni trenta secondi vorrebbe dire scaricare tutta la casa ogni trenta
 * secondi. Non risponde a nessun comando: non c'e' niente da chiedergli.
 */

import { join } from "node:path";

import { Archivio } from "./archivio.js";
import { PROFILO_PRINCIPALE } from "./configurazione.js";
import {
  CHIAVE_FESTE,
  chiamateDelleLuci,
  decidiLeLuci,
  festePulite,
  inFesta,
  luciAccese,
  memoriaPulita,
} from "../plancia/src/core/feste.js";

/* Ogni quanto si guarda l'orologio. Mezzo minuto di ritardo su un albero che
 * si accende al tramonto non si vede. */
const BATTITO = 30_000;

/* Dopo un comando che Home Assistant non ha preso si riprova, ma non a ogni
 * battito: una presa staccata dal muro riempirebbe il registro. */
const RIPROVA_DOPO = 2 * 60_000;

export class LuciDiNatale {
  constructor({
    cartella = "",
    casa = null,
    configurazione = null,
    /* Lo stato di un'entita', dallo specchio della casa: `(id) => { state,
     * attributes }`. */
    stati = () => null,
    registro = null,
    adesso = () => Date.now(),
    ogni = (quanto, cosa) => setInterval(cosa, quanto),
    smetti = (segno) => clearInterval(segno),
  } = {}) {
    this._suDisco = Boolean(cartella);
    this.archivio = new Archivio(cartella ? join(cartella, "luci-di-natale.json") : "", {});
    this.casa = casa;
    this.configurazione = configurazione;
    this.stati = stati;
    this.registro = registro ?? { info() {}, attenzione() {}, errore() {} };
    this.adesso = adesso;
    this._ogni = ogni;
    this._smetti = smetti;
    this._battito = null;
    this._inCorso = false;
    this._riprovaDopo = 0;
  }

  get memoria() {
    return memoriaPulita(this.archivio.dati);
  }

  _impostazioni() {
    try {
      const valori = this.configurazione?.leggi?.(PROFILO_PRINCIPALE)?.snapshot?.values || {};
      return festePulite(valori[CHIAVE_FESTE]);
    } catch (_errore) {
      return festePulite(null);
    }
  }

  _salva(memoria) {
    this.archivio.dati = memoria;
    if (!this._suDisco) return;
    try {
      this.archivio.salva();
    } catch (errore) {
      this.registro.attenzione(`luci di Natale: memoria non scritta: ${errore?.message || errore}`);
    }
  }

  /* ── l'orologio ───────────────────────────────────────────────────── */

  parti() {
    if (this._battito) return;
    this._battito = this._ogni(BATTITO, () => {
      this.battito().catch((errore) =>
        this.registro.attenzione(`luci di Natale: ${errore?.message || errore}`),
      );
    });
    this._battito?.unref?.();
  }

  ferma() {
    if (this._battito) this._smetti(this._battito);
    this._battito = null;
  }

  /**
   * Un giro: si legge, si decide (`decidiLeLuci`), e se c'e' da accendere o
   * spegnere lo si fa. La memoria nuova si scrive solo se il comando e'
   * andato: altrimenti al giro dopo si ridecide da capo.
   */
  async battito() {
    if (this._inCorso) return null;
    const ora = this.adesso();
    if (ora < this._riprovaDopo) return null;
    const prima = this.memoria;
    /* Fuori dalle feste, e senza un intervallo aperto da chiudere, non si
     * guarda nemmeno la configurazione. */
    const aperto = Boolean(prima.giorno) && prima.stato !== "chiuso";
    if (!inFesta(new Date(ora)) && !aperto) return null;
    this._inCorso = true;
    try {
      const config = this._impostazioni();
      const tramonto = this.stati("sun.sun")?.attributes?.next_setting ?? null;
      const conto = luciAccese(config, (id) => this.stati(id));
      const accese = conto.accese > 0 ? true : conto.note === conto.totale ? false : null;
      const deciso = decidiLeLuci({ config, adesso: ora, tramonto, accese, memoria: prima });
      if (deciso.azione) {
        const accendi = deciso.azione === "accendi";
        try {
          for (const chiamata of chiamateDelleLuci(config, accendi))
            await this.casa?.chiedi?.({
              type: "call_service",
              domain: chiamata.domain,
              service: chiamata.service,
              service_data: chiamata.data,
            });
        } catch (errore) {
          this._riprovaDopo = ora + RIPROVA_DOPO;
          this.registro.attenzione(
            `luci di Natale: non si ${accendi ? "accendono" : "spengono"} (${errore?.message || errore})`,
          );
          return deciso;
        }
        this.registro.info(
          `luci di Natale: ${accendi ? "accese" : "spente"} (${deciso.perche}, ${config.luci.length} luci)`,
        );
      } else if (deciso.perche === "a-mano" && prima.stato !== "a-mano") {
        this.registro.info("luci di Natale: spente a mano, stasera non si riaccendono da sole");
      }
      if (JSON.stringify(deciso.memoria) !== JSON.stringify(prima)) this._salva(deciso.memoria);
      return deciso;
    } finally {
      this._inCorso = false;
    }
  }
}
