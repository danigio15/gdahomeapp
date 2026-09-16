/* Il ponte: quello che succede quando un telefono si collega.
 *
 * L'idea sta tutta in una riga: **al telefono il ponte si presenta come Home
 * Assistant**. Stessa stretta di mano — `auth_required`, `auth`, `auth_ok` —
 * stessi messaggi, stessi numeri di richiesta. Il telefono non sa di parlare
 * con un ponte, e quindi qualunque codice che sa parlare con Home Assistant
 * funziona di qui senza cambiare una virgola.
 *
 * L'unica differenza sta nel segno: dove Home Assistant vuole un suo segno,
 * qui ci va quello del ponte, che il telefono ha ricevuto abbinandosi. Il
 * ponte lo riconosce, apre *lui* il filo con Home Assistant col segno del
 * Supervisor, e da quel momento passa i messaggi da una parte all'altra senza
 * guardarci dentro.
 *
 * Cosa vuol dire questo per la sicurezza, detto chiaro: un telefono abbinato
 * puo' fare in Home Assistant quello che puo' fare il ponte, cioe' tutto. Per
 * questo un codice di abbinamento nasce solo dietro l'autenticazione di Home
 * Assistant, dura cinque minuti, si usa una volta, e ogni telefono si stacca
 * da solo dalla console.
 */

import { CasaIrraggiungibile } from "./casa.js";
import { Chiacchieroni } from "./chiacchieroni.js";
import { eUnaCommissione, no } from "./commissioni.js";
import { NOME } from "./marchio.js";

/* Quanti messaggi al secondo puo' mandare un telefono.
 *
 * Una plancia che si apre ne manda una raffica — le sottoscrizioni, i
 * registri, lo storico — e poi quasi niente. Il limite serve contro un
 * telefono impazzito o un cliente scritto male, non contro l'uso normale:
 * qualunque cosa sotto questa soglia passa senza accorgersene. */
const MESSAGGI_AL_SECONDO = 50;
/* La raffica e' larga per la plancia vera: aprendola a freddo il telefono
 * chiede al ponte trecento file in pochi secondi — i moduli, i caratteri, i
 * ritratti — e sono tutti messaggi su questo filo. Dopo la prima volta li
 * tiene sul disco e non li chiede piu'. */
const RAFFICA = 600;

/* Ogni quanto il ponte controlla che il telefono ci sia ancora.
 *
 * Un telefono che esce dal Wi-Fi non chiude niente: il socket resta li',
 * apparentemente aperto, finche' qualcuno non prova a scriverci. Senza questo
 * giro il ponte terrebbe in piedi un filo con Home Assistant per ogni telefono
 * che se n'e' andato. */
const BATTITO = 30_000;
const SILENZIO_MASSIMO = 90_000;

/* ─── Il mucchio: perche' esiste ──────────────────────────────────────────
 *
 * Un evento di Home Assistant, verso il telefono, era un messaggio. Dentro
 * casa non costa niente — e' un socket sulla rete locale — ma **da fuori** si
 * passa dal centralino, e li' ogni messaggio e' una richiesta contata: il
 * piano gratuito di Cloudflare ne da' centomila al giorno, e una casa vera ne
 * manda cinque al secondo. Fanno quarantamila all'ora: due ore e mezza di
 * plancia aperta e il centralino si spegne per tutti fino a mezzanotte.
 *
 * Il rimedio non e' mandare meno cose: e' **mandarle insieme**. Gli eventi si
 * raccolgono per una finestra breve e partono in un messaggio solo. Cinque al
 * secondo diventano uno al secondo, e la casa a schermo e' la stessa: nessuno
 * legge cinque cambiamenti al secondo, e la plancia li disegna quando li
 * riceve.
 *
 * Cosa **non** si raggruppa: le risposte. Chi accende una luce aspetta, e un
 * secondo di attesa su un tocco si sente. Va nel mucchio solo quello che
 * arriva da se'.
 *
 * E si raggruppa **solo** passando dal centralino: in casa la finestra
 * sarebbe un ritardo pagato per risparmiare niente. */
const FINESTRA_DEL_MUCCHIO = 1000;
/* Piu' di cosi' non si aspetta: una raffica — la casa che si riavvia, cento
 * entita' che cambiano insieme — parte subito invece di gonfiare un messaggio
 * che poi va spezzato in pezzi da mezzo megabyte. */
const MUCCHIO_MASSIMO = 60;
/* Il segno del mucchio. Non e' JSON apposta: un JSON non contiene mai un
 * ritorno a capo vero — dentro una stringa e' `\n`, due caratteri — quindi
 * spezzare su quello e' esatto, e non costa ne' una lettura ne' una
 * riscrittura dei messaggi che stanno dentro. Un messaggio di Home Assistant
 * comincia per `{`, quindi questo segno non si confonde con niente. */
export const SEGNO_DEL_MUCCHIO = "mucchio\n";

/* E' un evento, cioe' roba che arriva da se' e che si puo' far aspettare?
 *
 * Si guarda in testa e non si apre il resto: un `get_states` da un megabyte
 * letto per sapere che tipo e' costa piu' di quanto valga. Sbagliare non rompe
 * niente — il telefono spacchetta il mucchio e tratta ogni pezzo come se
 * fosse arrivato da solo — ma sbagliare dalla parte di «non e' un evento»
 * costa una richiesta, e dall'altra parte costa un secondo di attesa a una
 * risposta. Quindi si e' prudenti: nel mucchio ci va solo chi lo dice in
 * chiaro nei primi caratteri. */
const eUnEvento = (testo) => /"type"\s*:\s*"event"/.test(testo.slice(0, 200));

export class Ponte {
  constructor({ casa, dispositivi, registro, commissioni = null, utenti = null }) {
    this.casa = casa;
    this.dispositivi = dispositivi;
    this.registro = registro;
    /* Chi amministra questa casa (`utenti.js`). Serve a una riga sola: una
     * plancia riservata a chi amministra non si apre a un telefono intestato a
     * chi non amministra. Si guarda solo quello che c'e' gia' in mano — un
     * messaggio sul filo si risponde subito, non si tiene un telefono appeso
     * mentre si chiede a Home Assistant. */
    this.utenti = utenti;
    /* Quello che il ponte fa da se' per il telefono, senza passare da Home
     * Assistant: vedi `commissioni.js`. Senza, un `ponte/…` riceve un rifiuto
     * invece di finire in Home Assistant, che non saprebbe cosa farsene. */
    this.commissioni = commissioni;
    this.collegamenti = new Set();
    /* Chi parla di piu' in questa casa. Serve a una domanda sola, e non c'e'
     * altro posto da cui rispondere: un telefono che riceve seicento eventi
     * al minuto vede il numero e non i nomi, e i nomi sono tutto il rimedio.
     * Vedi `chiacchieroni.js`. */
    this.chiacchieroni = new Chiacchieroni();
  }

  /* Un telefono ha appena aperto una presa. */
  accogli(presa, { da = "?", mucchio = false } = {}) {
    const collegamento = new Collegamento(this, presa, da, { mucchio });
    this.collegamenti.add(collegamento);
    collegamento.avvia();
    return collegamento;
  }

  quantiCollegati() {
    return this.collegamenti.size;
  }

  collegatiPerDispositivo() {
    const conto = new Map();
    for (const uno of this.collegamenti) {
      if (!uno.dispositivo) continue;
      conto.set(uno.dispositivo.id, (conto.get(uno.dispositivo.id) || 0) + 1);
    }
    return conto;
  }

  /* Butta giu' i fili di un telefono staccato dalla console. Senza questo, un
   * telefono revocato resterebbe dentro finche' non chiude lui. */
  scollega(idDelDispositivo) {
    let quanti = 0;
    for (const uno of [...this.collegamenti]) {
      if (uno.dispositivo?.id !== idDelDispositivo) continue;
      uno.chiudi(1008, "questo dispositivo e' stato staccato");
      quanti += 1;
    }
    return quanti;
  }

  chiudiTutto() {
    for (const uno of [...this.collegamenti]) uno.chiudi(1001, "il ponte si sta spegnendo");
  }
}

function leggi(testo) {
  try {
    const detto = JSON.parse(testo);
    return detto && typeof detto === "object" ? detto : null;
  } catch (_errore) {
    return null;
  }
}

class Collegamento {
  constructor(ponte, presa, da, { mucchio = false } = {}) {
    this.ponte = ponte;
    this.presa = presa;
    this.da = da;
    this.dispositivo = null;
    this.filo = null;
    this.chiuso = false;
    this.gettoni = RAFFICA;
    this.ultimoGettone = Date.now();
    this.vistoIl = Date.now();
    this.battito = null;
    /* Gli eventi si raggruppano solo se tutte e due le cose sono vere: il
     * telefono sa spacchettare un mucchio (l'ha detto nella stretta di mano)
     * e questo filo passa dal centralino, dove ogni messaggio e' una
     * richiesta contata. In casa non c'e' niente da risparmiare, e un ritardo
     * pagato per niente e' solo un ritardo. */
    this.faIlMucchio = mucchio === true && String(da).startsWith("centralino");
    this._mucchio = [];
    this._svuota = null;
  }

  avvia() {
    this.presa.onMessaggio = (testo) => this._dalTelefono(testo);
    this.presa.onChiusa = (motivo = "") => this._finito(motivo);
    /* Un telefono che riceve e non chiede — l'app ferma sulla home — non manda
     * niente per minuti, ed e' vivo lo stesso. Il pong e' il suo modo di dire
     * che c'e'. */
    this.presa.onPong = () => {
      this.vistoIl = Date.now();
    };
    /* Come Home Assistant: la prima parola la dice il server. */
    this.presa.manda(JSON.stringify({ type: "auth_required", ha_version: NOME }));
    this.battito = setInterval(() => this._controlla(), BATTITO);
  }

  _controlla() {
    if (this.chiuso) return;
    if (Date.now() - this.vistoIl > SILENZIO_MASSIMO) {
      this.chiudi(1001, "nessun segno di vita");
      return;
    }
    this.presa.ping();
  }

  _dalTelefono(testo) {
    if (this.chiuso) return;
    this.vistoIl = Date.now();
    if (!this._cePosto()) {
      this.chiudi(1008, "troppi messaggi");
      return;
    }

    /* Dopo la stretta il ponte non guarda piu' dentro: quello che arriva e'
     * roba fra il telefono e Home Assistant, e leggerla sarebbe soltanto un
     * modo per sbagliarla. Con un'eccezione: i messaggi `ponte/…`, che sono
     * per il ponte e in Home Assistant non devono arrivare. Si riconoscono
     * senza aprire il JSON, e si aprono solo quelli. */
    if (this.dispositivo) {
      if (eUnaCommissione(testo)) {
        const detto = leggi(testo);
        if (detto && this._eUnaCommissione(detto)) {
          this._commissione(detto);
          return;
        }
      }
      if (!this.filo?.manda(testo)) this.chiudi(1011, "il filo con la casa e' caduto");
      return;
    }

    let detto;
    try {
      detto = JSON.parse(testo);
    } catch (_errore) {
      this._rifiuta("non ho capito");
      return;
    }
    if (detto?.type !== "auth") {
      this._rifiuta("prima bisogna autenticarsi");
      return;
    }
    this._autentica(String(detto.access_token || ""));
  }

  /* Le commissioni le riconosce chi le fa; un ponte senza commissioni
   * riconosce solo i `ponte/…`, per dire di no invece di girarli a Home
   * Assistant, che non saprebbe cosa farsene. */
  _eUnaCommissione(detto) {
    const commissioni = this.ponte.commissioni;
    if (commissioni) return commissioni.riconosce(detto);
    return typeof detto.type === "string" && detto.type.startsWith("ponte/");
  }

  _commissione(detto) {
    const commissioni = this.ponte.commissioni;
    /* Chi chiede: il telefono che ha aperto questo filo, cioe' l'utente di
     * Home Assistant a cui e' intestato. Serve alle plance riservate — senza,
     * un telefono chiederebbe l'elenco e se lo prenderebbe tutto. Un telefono
     * abbinato prima di oggi non ha nessun utente addosso, e quello vede
     * tutto: com'era ieri. */
    const chiChiede = this.dispositivo?.utente || "";
    const risposta = commissioni
      ? commissioni.rispondi(detto, {
          chiChiede,
          amministra: this.ponte.utenti?.amministratoreSubito?.(chiChiede) ?? null,
        })
      : Promise.resolve(no(detto.id ?? null, "unknown_command", "questo ponte non lo sa fare"));
    risposta
      .catch((errore) => {
        this.ponte.registro?.errore?.(`commissione andata storta: ${errore?.message || errore}`);
        return no(detto.id ?? null, "ponte_http", "non ha funzionato");
      })
      .then((detta) => {
        if (!this.chiuso) this.presa.manda(JSON.stringify(detta));
      });
  }

  async _autentica(segno) {
    const dispositivo = this.ponte.dispositivi.riconosci(segno);
    if (!dispositivo) {
      this.ponte.registro?.attenzione?.(`abbinamento rifiutato da ${this.da}`);
      this._rifiuta("segno non valido");
      return;
    }

    try {
      this.filo = await this.ponte.casa.apriIlFilo({
        onMessaggio: (dallaCasa) => this._alTelefono(dallaCasa),
        onChiusa: (perche = "") => {
          this.ponte.registro?.attenzione?.(`il filo con Home Assistant si e' chiuso${perche}`);
          this.chiudi(1011, "Home Assistant ha chiuso");
        },
      });
    } catch (errore) {
      const perche =
        errore instanceof CasaIrraggiungibile ? errore.message : "non riesco a parlare con la casa";
      this.ponte.registro?.errore?.(`filo non aperto per ${dispositivo.nome}: ${perche}`);
      this._rifiuta(perche);
      return;
    }

    /* Fra l'`await` e qui il telefono puo' essersene andato. */
    if (this.chiuso) {
      this.filo.chiudi();
      return;
    }

    this.dispositivo = dispositivo;
    this.ponte.registro?.info?.(`${dispositivo.nome} e' entrato da ${this.da}`);
    this.presa.manda(JSON.stringify({ type: "auth_ok", ha_version: NOME }));
  }

  /* Quello che va al telefono. Da qui passa **solo** cio' che arriva da Home
   * Assistant: le risposte del ponte se ne vanno per conto loro, e sono poche.
   */
  _alTelefono(testo) {
    if (this.chiuso) return;
    /* Prima di tutto il resto, e costa un'espressione regolare sui primi
     * quattrocento caratteri: il ponte gli eventi non li apre, e questo non
     * comincia adesso. */
    this.ponte.chiacchieroni.segna(testo);
    if (!this.faIlMucchio || !eUnEvento(testo)) {
      /* Prima quello che aspetta, poi questo: l'ordine con cui Home Assistant
       * ha parlato non si cambia. Una risposta che scavalca l'evento che l'ha
       * preceduta e' una tessera che si disegna col valore di prima. */
      this._svuotaIlMucchio();
      this.presa.manda(testo);
      return;
    }
    this._mucchio.push(testo);
    if (this._mucchio.length >= MUCCHIO_MASSIMO) {
      this._svuotaIlMucchio();
      return;
    }
    if (this._svuota) return;
    this._svuota = setTimeout(() => this._svuotaIlMucchio(), FINESTRA_DEL_MUCCHIO);
    this._svuota.unref?.();
  }

  _svuotaIlMucchio() {
    if (this._svuota) {
      clearTimeout(this._svuota);
      this._svuota = null;
    }
    if (!this._mucchio.length) return;
    const insieme = this._mucchio;
    this._mucchio = [];
    if (this.chiuso) return;
    /* Uno solo non e' un mucchio: si manda com'e', cosi' un telefono vecchio
     * — o un pezzo di codice che non conosce il segno — non ci si trova
     * davanti senza motivo. */
    if (insieme.length === 1) {
      this.presa.manda(insieme[0]);
      return;
    }
    this.presa.manda(SEGNO_DEL_MUCCHIO + insieme.join("\n"));
  }

  _rifiuta(perche) {
    this.presa.manda(JSON.stringify({ type: "auth_invalid", message: perche }));
    this.chiudi(1008, perche);
  }

  /* Un secchio che si riempie da solo: cinquanta gettoni al secondo, trecento
   * al massimo. Chi sta sotto non se ne accorge mai. */
  _cePosto() {
    const ora = Date.now();
    this.gettoni = Math.min(
      RAFFICA,
      this.gettoni + ((ora - this.ultimoGettone) / 1000) * MESSAGGI_AL_SECONDO,
    );
    this.ultimoGettone = ora;
    if (this.gettoni < 1) return false;
    this.gettoni -= 1;
    return true;
  }

  chiudi(codice = 1000, motivo = "") {
    if (this.chiuso) return;
    /* Quello che era nel mucchio parte adesso: un evento raccolto e mai
     * mandato e' una tessera che resta col valore di prima. Prima di alzare
     * `chiuso`, che ferma la scrittura. */
    this._svuotaIlMucchio();
    this.chiuso = true;
    if (this.battito) clearInterval(this.battito);
    this.filo?.chiudi();
    this.presa.chiudi(codice, motivo);
    this.ponte.collegamenti.delete(this);
  }

  _finito(motivo = "") {
    if (this.chiuso) return;
    this.chiuso = true;
    if (this.battito) clearInterval(this.battito);
    /* La presa non c'e' piu': il mucchio si butta, e il suo timer con lui. */
    this._mucchio = [];
    if (this._svuota) {
      clearTimeout(this._svuota);
      this._svuota = null;
    }
    /* Perche' se n'e' andato. Un telefono che chiude l'app se ne va senza dire
     * niente, e quello e' il caso normale; quando invece un motivo c'e' —
     * l'abbiamo chiuso noi, o e' arrivato qualcosa di storto — va scritto, se
     * no chi legge il registro non ha niente da cui partire. */
    if (motivo && this.dispositivo) {
      this.ponte.registro?.attenzione?.(`${this.dispositivo.nome} e' uscito: ${motivo}`);
    }
    this.filo?.chiudi();
    this.ponte.collegamenti.delete(this);
  }
}
