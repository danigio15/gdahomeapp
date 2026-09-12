/* La cucitura: la plancia dentro Home Assistant, cucita sul ponte.
 *
 * Fino a oggi la plancia, fuori dal pannello dell'integrazione, si apriva in
 * un posto solo: dentro l'app. Li' c'e' un servitore — `app/lib/plancia/` —
 * che le serve la pagina e le fa da Home Assistant: la plancia crede di
 * parlare con la casa, e parla con lui.
 *
 * Ma l'integrazione va dismessa, e chi ha solo l'add-on la plancia dentro Home
 * Assistant non ce l'avrebbe piu'. Quindi quel mestiere lo fa anche il ponte,
 * dalla sua parte: la pagina la serve lui (`premesse.js`), e il WebSocket che
 * quella pagina apre finisce qui.
 *
 * **Non c'e' niente da autenticare, e non e' una dimenticanza.** Questa presa
 * sta sulla porta dell'ingress, e sull'ingress arriva solo chi e' gia' entrato
 * in Home Assistant: il Supervisor non lascia passare nessun altro. Chi bussa
 * qui e' quindi qualcuno che in quella casa e' gia' dentro, e chiedergli un
 * secondo segno sarebbe chiedergli di autenticarsi due volte per la stessa
 * stanza. La porta dell'app e' un'altra cosa — e' esposta, e li' il segno
 * serve.
 *
 * **Niente rinumerazione.** Ogni pagina si prende un filo suo verso Home
 * Assistant, come ogni telefono (`ponte.js`): i numeri dei messaggi sono i
 * suoi e passano com'e'. Due contatori su un filo solo sarebbero il motivo per
 * cui nell'app esiste una rinumerazione; qui il filo e' uno per pagina e non
 * serve.
 *
 * Quello che non passa a Home Assistant sono i comandi che il ponte fa da se'
 * — `dashboardmodern/config/*`, il catalogo, le foto, la chat, le plance — che
 * nella dashboard li faceva l'integrazione. Li riconosce `commissioni.js`, ed
 * e' la stessa lista che vale per l'app: una sola, se no la plancia si
 * comporterebbe in due modi a seconda di dove e' aperta.
 */

import { CasaIrraggiungibile } from "./casa.js";
import { eUnaCommissione, no } from "./commissioni.js";

function leggi(testo) {
  try {
    const detto = JSON.parse(testo);
    return detto && typeof detto === "object" ? detto : null;
  } catch (_errore) {
    return null;
  }
}

export class Cucitura {
  constructor({ presa, casa, commissioni = null, registro, da = "?", quale = null } = {}) {
    this.presa = presa;
    this.casa = casa;
    this.commissioni = commissioni;
    this.registro = registro ?? { info() {}, attenzione() {}, errore() {} };
    this.da = da;
    /* Quale plancia sta guardando: serve solo a dirlo nel registro, cosi' chi
     * legge sa se e' quella di sempre o la seconda. */
    this.quale = quale;
    this.filo = null;
    this.chiusa = false;
    presa.onMessaggio = (testo) => this._dallaPagina(testo);
    presa.onChiusa = () => this._laPaginaSeNEAndata();
  }

  /* Si apre il filo verso Home Assistant e si dice alla pagina che e'
   * dentro.
   *
   * `auth_ok` e basta, e senza aspettare un `auth`: la plancia ospitata non ne
   * manda nessuno — glielo dice `__DASHBOARDMODERN_HOSTED__` — e resterebbe
   * ad aspettare per sempre. */
  async avvia() {
    try {
      this.filo = await this.casa.apriIlFilo({
        onMessaggio: (dallaCasa) => this._allaPagina(dallaCasa),
        onChiusa: (perche = "") => {
          this.registro.attenzione(`il filo della plancia si e' chiuso${perche}`);
          this.chiudi(1011, "Home Assistant ha chiuso");
        },
      });
    } catch (errore) {
      const perche =
        errore instanceof CasaIrraggiungibile ? errore.message : "non riesco a parlare con la casa";
      this.registro.errore(`la plancia non si e' cucita: ${perche}`);
      /* `auth_invalid` e non un silenzio: la pagina lo sa leggere, e dice che
       * la casa non risponde invece di restare a girare. */
      this._manda({ type: "auth_invalid", message: perche });
      this.chiudi(1011, perche);
      return;
    }
    if (this.chiusa) {
      this.filo.chiudi();
      return;
    }
    this.registro.info(
      `la plancia${this.quale?.titolo ? ` «${this.quale.titolo}»` : ""} si e' aperta da ${this.da}`,
    );
    this._manda({ type: "auth_ok", ha_version: "ponte" });
  }

  _dallaPagina(testo) {
    if (this.chiusa) return;
    /* Un `auth` che arriva lo stesso si lascia cadere: qui non c'e' niente da
     * autenticare, e rispondergli «no» chiuderebbe una pagina che va bene. */
    if (eUnaCommissione(testo)) {
      const detto = leggi(testo);
      if (detto && this._eSua(detto)) {
        this._commissione(detto);
        return;
      }
    }
    if (!this.filo?.manda(testo)) this.chiudi(1011, "il filo con la casa e' caduto");
  }

  /* Quali comandi fa il ponte invece di girarli. E' la stessa domanda che fa
   * il ponte per un telefono, e la fa lo stesso oggetto: due elenchi
   * vorrebbero dire una plancia che nell'app sa fare una cosa e in Home
   * Assistant no. */
  _eSua(detto) {
    if (this.commissioni) return this.commissioni.riconosce(detto);
    return typeof detto.type === "string" && detto.type.startsWith("ponte/");
  }

  _commissione(detto) {
    const risposta = this.commissioni
      ? this.commissioni.rispondi(detto)
      : Promise.resolve(no(detto.id ?? null, "unknown_command", "questo ponte non lo sa fare"));
    risposta
      .catch((errore) => {
        this.registro.errore(
          `commissione della plancia andata storta: ${errore?.message || errore}`,
        );
        return no(detto.id ?? null, "ponte_plancia", "non ha funzionato");
      })
      .then((detta) => {
        if (!this.chiusa) this.presa.manda(JSON.stringify(detta));
      });
  }

  _allaPagina(testo) {
    if (this.chiusa) return;
    this.presa.manda(testo);
  }

  _manda(cosa) {
    if (this.chiusa) return;
    this.presa.manda(JSON.stringify(cosa));
  }

  _laPaginaSeNEAndata() {
    /* La pagina se n'e' andata — ricaricata, chiusa, cambiata sezione — e il
     * suo filo verso Home Assistant non serve piu' a nessuno. Lasciarlo
     * aperto vorrebbe dire un filo per ogni ricarica, e una plancia si
     * ricarica tutto il giorno. */
    this.chiusa = true;
    this.filo?.chiudi();
    this.filo = null;
  }

  chiudi(codice = 1000, perche = "") {
    if (this.chiusa) {
      this.filo?.chiudi();
      this.filo = null;
      return;
    }
    this.chiusa = true;
    try {
      this.presa.chiudi(codice, perche);
    } catch (_errore) {
      /* Gia' chiusa. */
    }
    this.filo?.chiudi();
    this.filo = null;
  }
}
