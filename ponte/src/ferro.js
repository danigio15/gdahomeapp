/* Il ferro sotto Home Assistant: la macchina, la rete e gli add-on.
 *
 * Quasi tutto lo dice il **Supervisor**, e questo e' il motivo per cui questa
 * parte esiste invece di chiedere a chi ci abita di installare qualcosa: un
 * installatore non puo' contare sul fatto che in ogni casa qualcuno abbia
 * aggiunto l'integrazione giusta. Il disco, la scheda, le interfacce di rete e
 * gli add-on ci sono sempre, in ogni casa, senza che nessuno configuri niente.
 *
 * ─── Quello che il Supervisor NON dice, e va detto ────────────────────────
 *
 * **CPU, memoria e temperatura della macchina non ci sono.** `/supervisor/stats`
 * esiste e sembra la risposta, ma sono i numeri del **contenitore del
 * Supervisor**, non del ferro: darli per quelli della macchina vorrebbe dire
 * scrivere «CPU al 3%» su una scheda in ginocchio. Quei tre numeri li ha Home
 * Assistant solo se in quella casa c'e' l'integrazione **System Monitor**, e
 * dove non c'e' restano `null` — che il quadro mostra come «questa casa non lo
 * dice», con dentro il rimedio: una integrazione da aggiungere.
 *
 * Un `null` detto e' un'informazione; un numero inventato e' un danno.
 *
 * ─── Le vie ──────────────────────────────────────────────────────────────
 *
 *   /os/info          la scheda (`board`: `odroid-n2`), la versione del sistema
 *   /host/info        i dischi, e `disk_life_time`
 *   /network/info     le interfacce — la stessa via che `ritorno.js` chiama gia'
 *   /addons           gli add-on, con `state` e `boot`
 *   /core/info        la versione di Home Assistant
 *   /supervisor/info  la versione del Supervisor
 *
 * Le funzioni che leggono quelle risposte stanno fuori dalla classe e non
 * sanno cosa sia la rete: la forma di quelle risposte non la decidiamo noi, e
 * va letta senza fidarsi di niente.
 *
 * Qui dentro si **legge**, con una sola eccezione dichiarata: `spegniLaCartolina`
 * svuota la casella del quadro nelle opzioni dell'add-on, ed e' quello che sta
 * dietro il tasto «smetti» della console. Sta qui e non altrove perche' e'
 * una chiamata al Supervisor, e le chiamate al Supervisor stanno in un posto
 * solo.
 */

/** Quanto si aspetta il Supervisor prima di lasciar perdere. */
const ATTESA = 5000;

/** Ogni quanto si torna a chiedere. Il ferro non cambia al secondo. */
export const QUANTO_DURA = 60 * 1000;

/* La tacca della temperatura: non e' un numero scelto qui, e' quella che la
 * plancia disegna gia' sull'arco del MiniPC, ed e' dove un ODROID comincia a
 * rallentarsi da solo. */
export const TROPPO_CALDO = 75;

/* Dove Home Assistant tiene i tre numeri della macchina, quando qualcuno ha
 * messo System Monitor. Due nomi per ognuno: quello di adesso e quello di
 * prima del 2024.6, perche' una casa ferma a due anni fa e' esattamente la
 * casa che un quadro deve saper guardare. */
const DOVE_STA = Object.freeze({
  cpu: ["sensor.system_monitor_processor_use", "sensor.processor_use"],
  ram: ["sensor.system_monitor_memory_use_percent", "sensor.memory_use_percent"],
  temperatura: ["sensor.system_monitor_processor_temperature", "sensor.processor_temperature"],
  acceso: ["sensor.system_monitor_last_boot", "sensor.last_boot", "sensor.uptime"],
});

const GIORNO = 24 * 60 * 60 * 1000;

const pulito = (valore) => String(valore ?? "").trim();

const numero = (valore) => {
  const letto = Number(valore);
  return Number.isFinite(letto) ? letto : null;
};

/* Una percentuale, o `null`. Fuori dallo zero-cento non e' una percentuale. */
const percento = (valore) => {
  const quanto = numero(valore);
  if (quanto === null || quanto < 0 || quanto > 100) return null;
  return Math.round(quanto);
};

/* Il primo di questi nomi che in questa casa esiste e dice un numero. */
function daiSensori(stati, nomi) {
  const dentro = Array.isArray(stati) ? stati : [];
  for (const nome of nomi) {
    const uno = dentro.find((quello) => pulito(quello?.entity_id) === nome);
    if (!uno || pulito(uno.state) === "unavailable" || pulito(uno.state) === "unknown") continue;
    return uno;
  }
  return null;
}

/* Come si scrive il nome di una scheda. Il Supervisor dice `odroid-n2`, e
 * chi ripara queste macchine la chiama ODROID-N2. Le altre si lasciano come
 * stanno, in maiuscolo: inventare un abbellimento per una scheda che non
 * conosciamo vuol dire storpiarne il nome. */
export function laScheda(board, sistema = "") {
  const detta = pulito(board).toLowerCase();
  if (!detta) return pulito(sistema) || "";
  if (detta.startsWith("odroid")) return detta.toUpperCase();
  if (detta === "rpi5" || detta === "rpi4" || detta === "rpi3")
    return `Raspberry Pi ${detta.slice(3)}`;
  if (detta === "generic-x86-64") return "PC x86-64";
  return detta.toUpperCase();
}

/**
 * La macchina: il ferro sotto Home Assistant.
 *
 * `os` e `host` sono i `data` di `/os/info` e `/host/info`; `stati` e' il
 * `get_states` che serve per i tre numeri che il Supervisor non ha.
 *
 * I gigabyte del disco il Supervisor li da' gia' tali — `disk_total`,
 * `disk_used`, `disk_free` — e la percentuale si fa qui invece di chiederla,
 * perche' lui quella non la dice.
 */
export function laMacchina({ os = null, host = null, stati = [], adesso = () => Date.now() } = {}) {
  const totale = numero(host?.disk_total);
  const usato = numero(host?.disk_used);
  const liberi = numero(host?.disk_free);

  const acceso = daiSensori(stati, DOVE_STA.acceso);
  const daQuando = acceso ? Date.parse(pulito(acceso.state)) : NaN;

  return {
    scheda: laScheda(os?.board, host?.operating_system),
    /* Tre numeri che ci sono solo dove c'e' System Monitor. `null` non e'
     * zero, e il quadro li mostra diversi. */
    cpu: percento(daiSensori(stati, DOVE_STA.cpu)?.state),
    ram: percento(daiSensori(stati, DOVE_STA.ram)?.state),
    temperatura: (() => {
      const letta = numero(daiSensori(stati, DOVE_STA.temperatura)?.state);
      /* Una temperatura di scheda sta fra lo zero e il centocinquanta. Fuori
       * di li' e' un sensore che dice un'altra cosa, o che dice male. */
      return letta === null || letta < -20 || letta > 150 ? null : Math.round(letta);
    })(),
    disco: totale && totale > 0 && usato !== null ? Math.round((usato / totale) * 100) : null,
    discoLiberi: liberi === null ? null : Math.round(liberi * 10) / 10,
    /* Quanta vita del disco e' gia' andata.
     *
     * E' la riga che su queste schede conta piu' di tutte e che non guarda
     * nessuno: Home Assistant scrive tutto il giorno, e una eMMC o una microSD
     * hanno un numero di scritture e poi finiscono. Il Supervisor la dichiara
     * dove il supporto la sa dire; un SSD dentro un NUC non la sa, e li' resta
     * `null` invece di diventare uno zero rassicurante. */
    discoVita: percento(host?.disk_life_time),
    accesaDa: Number.isNaN(daQuando)
      ? null
      : Math.max(0, Math.floor((adesso() - daQuando) / GIORNO)),
  };
}

/**
 * La rete: le schede della macchina, e se questa casa vede fuori.
 *
 * `network` e' il `data` di `/network/info`. `filoSu` non si chiede a nessuno:
 * e' se il filo del ponte verso il centralino sta in piedi adesso, ed e' la
 * prova piu' onesta che esista che questa casa arriva fuori — non un ping a un
 * indirizzo scelto da noi, ma la cosa vera che deve funzionare.
 *
 * **L'SSID non esce.** Una rete che si chiama «Casa Rossi» e' una persona, e
 * questa cartolina va a chi ha installato l'impianto, non a chi ci abita. Il
 * segnale si', che e' un numero e spiega meta' dei guai.
 */
export function laRete({ network = null, filoSu = false } = {}) {
  const dentro = Array.isArray(network?.interfaces) ? network.interfaces : [];
  const schede = [];
  for (const scheda of dentro) {
    if (!scheda || typeof scheda !== "object") continue;
    const nome = pulito(scheda.interface);
    if (!nome) continue;
    const su = scheda.connected === true;
    const indirizzi = Array.isArray(scheda.ipv4?.address) ? scheda.ipv4.address : [];
    schede.push({
      nome,
      tipo: pulito(scheda.type) === "wireless" ? "wifi" : "ethernet",
      su,
      /* Il Supervisor marca `primary` la scheda da cui esce il traffico. */
      principale: scheda.primary === true,
      /* L'indirizzo **sulla rete di casa**, senza la maschera: arriva come
       * `192.168.1.50/24`. E' un dato che non identifica nessuno e a chi
       * ripara queste macchine serve tutti i giorni; quello pubblico, che
       * direbbe dove abiti, non esce. */
      ip: su ? pulito(indirizzi[0]).split("/")[0] : "",
      segnale: pulito(scheda.type) === "wireless" && su ? percento(scheda.wifi?.signal) : null,
    });
  }
  return { internet: filoSu === true, schede };
}

/**
 * Gli apparati di rete di casa: il router e i suoi ripetitori.
 *
 * Non sono le schede della macchina e non vanno confusi con quelle. Sono i
 * `binary_sensor` con `device_class: connectivity` che la sezione «Macchine e
 * rete» della plancia adotta — e li adotta **per integrazione, non per
 * classe**, che e' la regola scritta in `core/macchine-e-rete.js` e serve a
 * non risucchiare ogni telefono e ogni presa Wi-Fi della casa.
 *
 * Qui dentro quella scelta non si rifa': arriva gia' fatta in `scelte`, che
 * sono gli identificativi che la plancia ha adottato. Vuoto vuol dire **zero**,
 * e zero si manda: un elenco vuoto e' una risposta, indovinare non lo e'.
 */
export function gliApparati(stati, { scelte = [] } = {}) {
  const dentro = Array.isArray(stati) ? stati : [];
  const volute = new Set((Array.isArray(scelte) ? scelte : []).map(pulito).filter(Boolean));
  if (!volute.size) return { quante: 0, giu: 0 };
  const loro = dentro.filter((uno) => volute.has(pulito(uno?.entity_id)));
  return {
    quante: loro.length,
    /* Giu' vuol dire giu' **o** sparito: per chi guarda un router, «non
     * risponde» e «Home Assistant non ci parla piu'» sono lo stesso guaio. */
    giu: loro.filter((uno) => pulito(uno?.state) !== "on").length,
  };
}

/**
 * Gli add-on, e la sola domanda che conta.
 *
 * `addons` e' il `data.addons` di `/addons`.
 *
 * Non «quanti sono spenti»: **quanti partono all'avvio e sono fermi**. Nessuno
 * spegne un add-on lasciandogli l'avvio automatico, quindi quello li' si e'
 * fermato da solo ed e' una cosa da andare a vedere. Uno messo a mano e
 * lasciato fermo e' una scelta di chi ci abita, e dirglielo ogni quarto d'ora
 * insegna a non guardare piu' le spie.
 */
export function gliAddon({ addons = [] } = {}) {
  const dentro = Array.isArray(addons) ? addons : [];
  const elenco = dentro
    .map((uno) => ({
      nome: pulito(uno?.name) || pulito(uno?.slug),
      su: pulito(uno?.state) === "started",
      allAvvio: pulito(uno?.boot) === "auto",
      aggiornabile: uno?.update_available === true,
    }))
    .filter((uno) => uno.nome)
    .sort((una, altra) => una.nome.localeCompare(altra.nome));
  return {
    quanti: elenco.length,
    accesi: elenco.filter((uno) => uno.su).length,
    spentiCheDovrebbero: elenco.filter((uno) => !uno.su && uno.allAvvio).length,
    elenco,
  };
}

/**
 * Chi va a chiedere tutto questo al Supervisor.
 *
 * Quattro domande in parallelo e una risposta tenuta un minuto. Una che va
 * male non fa fallire le altre: un Supervisor senza il permesso della rete
 * deve dare una cartolina senza la rete, non nessuna cartolina.
 */
export class Ferro {
  constructor({
    supervisor = process.env.PONTE_SUPERVISOR || "http://supervisor",
    segno = process.env.SUPERVISOR_TOKEN || "",
    fetch: prendi = globalThis.fetch,
    registro,
    adesso = () => Date.now(),
    quantoDura = QUANTO_DURA,
  } = {}) {
    this.supervisor = String(supervisor).replace(/\/+$/, "");
    this.segno = String(segno);
    this.prendi = prendi;
    this.registro = registro ?? { debug() {}, info() {}, attenzione() {}, errore() {} };
    this.adesso = adesso;
    this.quantoDura = quantoDura;
    this._ultimo = null;
    this._quando = 0;
    this._inVolo = null;
    /* Un Supervisor che non risponde lo si dice una volta, non a ogni giro:
     * una cartolina ogni quindici minuti farebbe un registro illeggibile. */
    this._dettoIlGuaio = false;
  }

  /** Le quattro risposte grezze, o quello che si e' riusciti ad avere. */
  async chiedi() {
    const ora = this.adesso();
    if (this._ultimo && ora - this._quando < this.quantoDura) return this._ultimo;
    if (this._inVolo) return this._inVolo;
    this._inVolo = this._vai()
      .then((detto) => {
        this._ultimo = detto;
        this._quando = this.adesso();
        return detto;
      })
      .finally(() => {
        this._inVolo = null;
      });
    return this._inVolo;
  }

  async _vai() {
    const [os, host, network, addons, core, supervisor] = await Promise.all([
      this._via("/os/info"),
      this._via("/host/info"),
      this._via("/network/info"),
      this._via("/addons"),
      this._via("/core/info"),
      this._via("/supervisor/info"),
    ]);
    const nessuna = !os && !host && !network && !addons && !core && !supervisor;
    if (nessuna && !this._dettoIlGuaio) {
      this.registro.attenzione(
        "il Supervisor non risponde: la cartolina parte lo stesso, senza la macchina ne' la rete",
      );
      this._dettoIlGuaio = true;
    }
    if (!nessuna) this._dettoIlGuaio = false;
    return { os, host, network, addons: addons?.addons ?? [], core, supervisor };
  }

  /* Svuotare la casella del quadro nelle opzioni dell'add-on.
   *
   * E' **l'unica cosa che questo file scrive**, e c'e' per un motivo solo: un
   * tasto «smetti» che smette finche' non si riavvia non e' un tasto che
   * smette, e' una bugia con un bottone sopra. Fermare il postino in memoria
   * lascia la riga nella scheda dell'add-on, e al primo riavvio la casa
   * ricomincia a parlare senza che nessuno l'abbia chiesto.
   *
   * La via e' quella del Supervisor per le proprie opzioni, la stessa famiglia
   * di `/addons/self/rebuild` che `aggiornamento.js` usa gia'. Si scrive solo
   * questa chiave: quello che c'e' d'altro nella scheda non si tocca. */
  async spegniLaCartolina() {
    if (!this.segno || typeof this.prendi !== "function") {
      return { spento: false, perche: "qui non c'e' nessun Supervisor a cui dirlo" };
    }
    try {
      const risposta = await this.prendi(`${this.supervisor}/addons/self/options`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.segno}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ options: { quadro: "" } }),
        signal: AbortSignal.timeout(ATTESA),
      });
      if (!risposta.ok) {
        return {
          spento: false,
          perche: `il Supervisor ha risposto ${risposta.status}: svuota la casella «Il quadro» nella scheda dell'add-on`,
        };
      }
      this.registro.info("la cartolina non parte piu': la casella del quadro e' stata svuotata");
      return { spento: true, perche: "" };
    } catch (errore) {
      return { spento: false, perche: String(errore?.message || errore) };
    }
  }

  async _via(via) {
    if (!this.segno || typeof this.prendi !== "function") return null;
    try {
      const risposta = await this.prendi(`${this.supervisor}${via}`, {
        headers: { authorization: `Bearer ${this.segno}` },
        signal: AbortSignal.timeout(ATTESA),
      });
      if (!risposta.ok) {
        this.registro.debug(`il Supervisor ha risposto ${risposta.status} su ${via}`);
        return null;
      }
      const detto = await risposta.json();
      return detto?.data ?? null;
    } catch (errore) {
      this.registro.debug(`${via}: ${errore?.message || errore}`);
      return null;
    }
  }
}
