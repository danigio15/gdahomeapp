/* Un dispositivo Zigbee nuovo, dal telefono.
 *
 * «Vorrei poter abbinare un dispositivo zigbee direttamente dall'app, senza
 *  dover entrare in Home Assistant.»
 *
 * In Home Assistant una rete Zigbee la gestiscono due programmi diversi, e chi
 * ha una casa ne ha uno dei due: ZHA, che sta dentro Home Assistant, o
 * Zigbee2MQTT, che e' un add-on a parte e parla per posta. L'app non lo chiede
 * a nessuno: questo modulo guarda la casa e lo scopre, e la schermata cambia
 * da sola. La domanda «che rete hai» e' una domanda a cui la casa sa gia'
 * rispondere.
 *
 * ── Le tre cose che servono, e chi le sa fare ────────────────────────────
 *
 * APRIRE LA RETE. Una rete Zigbee non accetta ospiti a caso: si apre per
 * qualche minuto e poi si richiude da sola. Qui i due programmi non si
 * assomigliano per niente — ZHA ha un comando suo sul filo, Zigbee2MQTT vuole
 * un messaggio in una cassetta della posta — ed e' l'unica parte che cambia.
 *
 * SAPERE CHE E' ENTRATO QUALCUNO. Questa invece e' UNA SOLA, e vale per tutte
 * e quattro le reti: ZHA, Zigbee2MQTT, Matter e Thread. Un dispositivo che
 * entra in casa finisce nel registro dei dispositivi di Home Assistant, e il
 * registro annuncia chi arriva (`device_registry_updated`). Ascoltare quello
 * vuol dire non scrivere quattro ascoltatori che fanno la stessa cosa in
 * quattro modi — e vuol dire che una rete che oggi non c'e' funzionera' il
 * giorno che ci sara'.
 *
 * RICHIUDERE. Da sola dopo il tempo, o subito se chi guarda ha finito.
 *
 * ── Come si chiama la cassetta ───────────────────────────────────────────
 *
 * Zigbee2MQTT scrive e legge sotto un prefisso che si sceglie chi lo
 * installa. Di solito e' «zigbee2mqtt», ma non sempre — chi ha due antenne ne
 * ha due, e chi ha tradotto la sua configurazione l'ha chiamato altrimenti.
 * Darlo per scontato vuol dire un tasto che non fa niente in casa di qualcuno,
 * senza dire perche'.
 *
 * Allora non si da' per scontato: ci si mette in ascolto su `+/bridge/info` —
 * una sola domanda, con il carattere jolly — e si aspetta un attimo. Quel
 * messaggio Zigbee2MQTT lo lascia scritto nella cassetta (e' «retained»), per
 * cui chi si affaccia se lo trova gia' li'. Il prefisso e' la prima parola
 * dell'argomento da cui e' arrivato.
 *
 * Qui dentro la meta' che decide non tocca ne' la rete ne' l'orologio: entrano
 * le risposte di Home Assistant, escono i fatti. Il giro lo fa la classe in
 * fondo, come dappertutto nel ponte.
 */

/* Quali reti si sanno aprire. Il resto — Matter, Thread — entra in casa da
 * Home Assistant, e da qui si vede soltanto arrivare. */
export const NESSUNA = "";
export const ZHA = "zha";
export const Z2M = "zigbee2mqtt";

/* Per quanto si apre la rete. Quattro minuti sono il compromesso che usano
 * tutti: il tempo di scendere in garage a premere il tasto di una presa, e non
 * tanto da lasciare la porta aperta per una serata. */
export const QUANTO_RESTA_APERTA = 240;
export const AL_PIU_APERTA = 600;

/* Quanto si aspetta che la cassetta risponda. E' un messaggio gia' scritto che
 * arriva appena ci si affaccia: chi non risponde in due secondi non c'e'. */
export const ATTESA_DELLA_CASSETTA = 2000;

/* L'argomento con cui si chiede «chi c'e'»: il jolly prende qualunque
 * prefisso, e la risposta dice quale sia. */
export const DOVE_SI_CHIEDE = "+/bridge/info";

const pulito = (valore) => String(valore ?? "").trim();

/**
 * Il prefisso di una cassetta, dall'argomento da cui e' arrivato un messaggio.
 *
 * «zigbee2mqtt/bridge/info» da' «zigbee2mqtt»; «casa/zigbee/bridge/info» da'
 * «casa/zigbee», perche' un prefisso puo' avere delle barre dentro e tagliare
 * alla prima vorrebbe dire scrivere nella cassetta sbagliata.
 */
export function prefissoDellaCassetta(argomento) {
  const testo = pulito(argomento);
  const coda = "/bridge/info";
  if (!testo.endsWith(coda)) return "";
  return testo.slice(0, -coda.length);
}

/**
 * Se fra le integrazioni di questa casa c'e' ZHA, e in che stato.
 *
 * Una voce caricata vuol dire che l'antenna c'e' e risponde. Una che c'e' ma
 * non e' caricata — l'antenna staccata, il programma in errore — non e' una
 * rete che si possa aprire: si risponde «non c'e'», perche' un tasto che non
 * fa niente e' peggio di un tasto che manca.
 */
export function ceZha(voci = []) {
  const sue = (Array.isArray(voci) ? voci : []).filter(
    (voce) => pulito(voce?.domain).toLowerCase() === ZHA,
  );
  if (!sue.length) return false;
  return sue.some((voce) => {
    const stato = pulito(voce?.state).toLowerCase();
    /* Le versioni piu' vecchie non dicono lo stato: chi non lo dice si
     * considera in piedi, che e' come si comportava prima. */
    return !stato || stato === "loaded";
  });
}

/**
 * Quale rete c'e' in questa casa.
 *
 * ZHA vince quando ci sono tutte e due, e non e' un capriccio: sta dentro Home
 * Assistant, quindi il comando arriva e la conferma torna dalla stessa porta,
 * mentre Zigbee2MQTT passa per la posta e ha un pezzo in piu' che puo'
 * mancare. In una casa con tutt'e due — rara, ma esiste — la strada piu' corta
 * e' quella giusta.
 */
export function laReteDiCasa({ zha = false, cassetta = "" } = {}) {
  if (zha) return { quale: ZHA, cassetta: "" };
  const prefisso = pulito(cassetta);
  if (prefisso) return { quale: Z2M, cassetta: prefisso };
  return { quale: NESSUNA, cassetta: "" };
}

/** Quanti secondi si tiene aperta: dentro i limiti, e mai a caso. */
export function perQuanto(secondi) {
  const quanti = Number(secondi);
  if (!Number.isFinite(quanti) || quanti <= 0) return QUANTO_RESTA_APERTA;
  return Math.min(AL_PIU_APERTA, Math.round(quanti));
}

/**
 * Il comando che apre la rete, per la rete che c'e'.
 *
 * E' l'unico punto in cui i due programmi non si assomigliano, ed e' scritto
 * qui — dove si puo' provare senza una casa — invece che dentro il giro.
 *
 * ZHA ha un comando suo sul filo. Zigbee2MQTT vuole un messaggio in una
 * cassetta, e glielo si imbuca col servizio `mqtt.publish` di Home Assistant:
 * il ponte non ha un cliente MQTT suo e non deve averlo — la casa ce l'ha
 * gia', ed e' configurato.
 */
export function comeSiApre({ quale, cassetta = "" }, secondi = QUANTO_RESTA_APERTA) {
  const quanto = perQuanto(secondi);
  if (quale === ZHA) return { type: "zha/permit", duration: quanto };
  if (quale === Z2M && cassetta)
    return {
      type: "call_service",
      domain: "mqtt",
      service: "publish",
      service_data: {
        topic: `${cassetta}/bridge/request/permit_join`,
        payload: JSON.stringify({ time: quanto }),
      },
    };
  return null;
}

/** E quello che la richiude subito: la stessa strada, con zero al posto del tempo. */
export function comeSiChiude({ quale, cassetta = "" }) {
  if (quale === ZHA) return { type: "zha/permit", duration: 0 };
  if (quale === Z2M && cassetta)
    return {
      type: "call_service",
      domain: "mqtt",
      service: "publish",
      service_data: {
        topic: `${cassetta}/bridge/request/permit_join`,
        payload: JSON.stringify({ time: 0 }),
      },
    };
  return null;
}

/**
 * Se questo annuncio del registro e' un dispositivo appena entrato.
 *
 * Il registro annuncia anche le modifiche e le cancellazioni, e un dispositivo
 * rinominato non e' un dispositivo nuovo: chi guarda la schermata dell'attesa
 * vedrebbe entrare qualcosa che era gia' in casa.
 */
export function eUnoNuovo(evento) {
  return pulito(evento?.action).toLowerCase() === "create" && Boolean(pulito(evento?.device_id));
}

/**
 * Come si chiama un dispositivo appena entrato, e da dove viene.
 *
 * Il nome che conta e' quello che gli ha dato chi lo guarda (`name_by_user`);
 * senza, quello che si e' presentato lui. Un dispositivo Zigbee appena entrato
 * di solito si chiama col suo modello — «TS0121» — ed e' proprio per questo che
 * il passo dopo chiede un nome.
 */
export function comeSiPresenta(dispositivo = {}) {
  const nome = pulito(dispositivo.name_by_user) || pulito(dispositivo.name);
  return {
    id: pulito(dispositivo.id),
    nome,
    /* Marca e modello: sulla schermata del nome servono a far dire «ah, e'
     * quello» a chi ha appena premuto un tasto su una presa. */
    marca: pulito(dispositivo.manufacturer),
    modello: pulito(dispositivo.model),
    /* Da quale rete e' arrivato, quando si sa: un dispositivo entrato mentre
     * la rete Zigbee era aperta puo' comunque essere un Matter, e dirlo e'
     * meglio che lasciarlo credere. */
    tramite: pulito(dispositivo.primary_config_entry_domain),
  };
}

/* ── il giro alla casa ───────────────────────────────────────────────────── */

/**
 * La rete Zigbee di questa casa, vista dal ponte.
 *
 * Tiene la risposta per un po': l'app la chiede ogni volta che apre la
 * schermata, e «che rete hai» non cambia mentre uno guarda. Cambia quando si
 * installa qualcosa, e allora basta riaprire l'app.
 */
export const QUANTO_SI_RICORDA = 60_000;

export class Zigbee {
  constructor({ casa, registro = null, adesso = () => Date.now() } = {}) {
    this.casa = casa;
    this.registro = registro ?? { info() {}, attenzione() {}, errore() {} };
    this.adesso = adesso;
    this._rete = null;
    this._reteChiestaIl = 0;
    /* I dispositivi entrati da quando si sta guardando. L'elenco e' di chi
     * guarda: si svuota quando si riapre la rete, perche' quello che e'
     * entrato ieri non e' quello che sta entrando adesso. */
    this._entrati = [];
    this._disdici = null;
    this._chiudiDaSola = null;
    this._apertaFinoA = 0;
  }

  /** Quale rete c'e'. La risposta si tiene un minuto. */
  async rete({ forza = false } = {}) {
    const ora = this.adesso();
    if (!forza && this._rete && ora - this._reteChiestaIl < QUANTO_SI_RICORDA) return this._rete;
    const zha = await this._ceZha();
    /* La cassetta si cerca solo se ZHA non c'e': con ZHA in casa la risposta
     * e' gia' decisa, e affacciarsi alla posta sarebbe un giro per niente. */
    const cassetta = zha ? "" : await this._cercaLaCassetta();
    this._rete = laReteDiCasa({ zha, cassetta });
    this._reteChiestaIl = ora;
    return this._rete;
  }

  async _ceZha() {
    try {
      const voci = await this.casa.chiedi({ type: "config_entries/get", domain: ZHA });
      return ceZha(voci);
    } catch (_errore) {
      /* Una casa che non conosce quella domanda e' una casa senza ZHA: e'
       * Home Assistant stesso a rispondere, e se non sa rispondere quella
       * integrazione non c'e'. */
      return false;
    }
  }

  /**
   * Si affaccia alla posta e aspetta che qualcuno dica come si chiama.
   *
   * Due secondi, non di piu': il messaggio e' gia' scritto nella cassetta e
   * arriva subito. Chi non risponde in due secondi non c'e', e far aspettare
   * chi ha appena aperto una schermata e' il modo di farla sembrare rotta.
   */
  async _cercaLaCassetta() {
    let disdici = null;
    try {
      return await new Promise((risolvi) => {
        const scadenza = setTimeout(() => risolvi(""), ATTESA_DELLA_CASSETTA);
        this.casa
          .ascoltaIl({ type: "mqtt/subscribe", topic: DOVE_SI_CHIEDE }, (evento) => {
            const prefisso = prefissoDellaCassetta(evento?.topic);
            if (!prefisso) return;
            clearTimeout(scadenza);
            risolvi(prefisso);
          })
          .then(
            (smetti) => {
              disdici = smetti;
            },
            () => {
              /* Niente MQTT in questa casa: nessuna cassetta, e non e' un
               * guasto — e' una casa che Zigbee2MQTT non ce l'ha. */
              clearTimeout(scadenza);
              risolvi("");
            },
          );
      });
    } finally {
      try {
        await disdici?.();
      } catch (_errore) {
        /* L'abbonamento e' gia' morto col filo. */
      }
    }
  }

  /** Com'e' messa adesso: per la schermata 1 e per il conto alla rovescia. */
  async stato() {
    const rete = await this.rete();
    const ora = this.adesso();
    const restano = this._apertaFinoA > ora ? Math.round((this._apertaFinoA - ora) / 1000) : 0;
    return {
      quale: rete.quale,
      aperta: restano > 0,
      restano,
      entrati: this._entrati.slice(),
    };
  }

  /**
   * Apre la rete, e da quel momento ascolta chi entra.
   *
   * L'ascolto parte PRIMA del comando, e non e' pignoleria: fra l'ordine e la
   * rete aperta passano dei millisecondi, e un dispositivo gia' in attesa
   * entra subito. Ascoltando dopo, quello si perderebbe — e chi guarda
   * vedrebbe il conto alla rovescia scorrere su un dispositivo che e' gia'
   * dentro.
   */
  async apri({ secondi = QUANTO_RESTA_APERTA } = {}) {
    const rete = await this.rete();
    const comando = comeSiApre(rete, secondi);
    if (!comando) return { fatto: false, perche: "questa casa non ha una rete Zigbee" };
    this._entrati = [];
    await this._ascolta();
    await this.casa.chiedi(comando);
    const quanto = perQuanto(secondi);
    this._apertaFinoA = this.adesso() + quanto * 1000;
    clearTimeout(this._chiudiDaSola);
    /* La rete si richiude da sola: lo fa gia' il programma che la gestisce, e
     * questo timer serve solo a smettere di ascoltare e a far dire la verita'
     * allo stato. Senza, il ponte resterebbe in ascolto per sempre. */
    this._chiudiDaSola = setTimeout(() => this._scaduta(), quanto * 1000 + 1000);
    this._chiudiDaSola?.unref?.();
    this.registro.info(`zigbee: rete aperta per ${quanto}s (${rete.quale})`);
    return { fatto: true, quale: rete.quale, restano: quanto };
  }

  /** La richiude adesso. */
  async chiudi() {
    const rete = await this.rete();
    const comando = comeSiChiude(rete);
    this._scaduta();
    if (!comando) return { fatto: false, perche: "questa casa non ha una rete Zigbee" };
    await this.casa.chiedi(comando);
    this.registro.info("zigbee: rete richiusa");
    return { fatto: true };
  }

  _scaduta() {
    clearTimeout(this._chiudiDaSola);
    this._chiudiDaSola = null;
    this._apertaFinoA = 0;
    const smetti = this._disdici;
    this._disdici = null;
    /* Si smette di ascoltare senza aspettare: chi ha chiuso la schermata non
     * deve stare fermo mentre il ponte saluta Home Assistant. */
    Promise.resolve()
      .then(() => smetti?.())
      .catch(() => {});
  }

  async _ascolta() {
    if (this._disdici) return;
    this._disdici = await this.casa.ascolta(
      "device_registry_updated",
      (evento) => this._entrato(evento),
      {
        onCaduto: () => {
          this._disdici = null;
        },
      },
    );
  }

  async _entrato(evento) {
    if (!eUnoNuovo(evento)) return;
    const id = pulito(evento.device_id);
    if (this._entrati.some((uno) => uno.id === id)) return;
    let dispositivo = { id };
    try {
      const tutti = await this.casa.chiedi({ type: "config/device_registry/list" });
      const suo = (Array.isArray(tutti) ? tutti : []).find((uno) => pulito(uno?.id) === id);
      if (suo) dispositivo = suo;
    } catch (_errore) {
      /* Il nome non si sa: resta l'identificativo, e il passo dopo lo chiede
       * comunque. Meglio un dispositivo senza nome di un dispositivo perso. */
    }
    this._entrati.push(comeSiPresenta(dispositivo));
    this.registro.info(`zigbee: e' entrato ${id}`);
  }

  /**
   * Gli da' il nome che gli ha dato chi lo guarda (il passo 3).
   *
   * Il nome va nel registro di Home Assistant, dove lo vedono tutti — la
   * plancia, le automazioni, l'app — e non in un cassetto del ponte: un
   * dispositivo che si chiama «Presa lavatrice» nell'app e «TS0121» in casa
   * sarebbe lo stesso dispositivo con due nomi, che e' il modo in cui uno
   * smette di fidarsi di quello che legge.
   *
   * Si scrive in `name_by_user` e non in `name`: `name` e' come si e'
   * presentato lui, e sovrascriverlo vorrebbe dire perdere il modello —
   * l'unica cosa che dice cos'e' quell'oggetto quando fra un anno non ci si
   * ricorda piu'.
   */
  async rinomina(id, nome) {
    const quale = pulito(id);
    const come = pulito(nome).slice(0, 80);
    if (!quale) return { fatto: false, perche: "quale dispositivo?" };
    if (!come) return { fatto: false, perche: "il nome e' vuoto" };
    const dispositivo = await this.casa.chiedi({
      type: "config/device_registry/update",
      device_id: quale,
      name_by_user: come,
    });
    /* E lo si aggiorna anche nell'elenco di chi sta guardando: la schermata
     * dopo mostra il nome nuovo senza dover richiedere tutto. */
    const suo = this._entrati.find((uno) => uno.id === quale);
    if (suo) suo.nome = come;
    return {
      fatto: true,
      dispositivo: comeSiPresenta(dispositivo || { id: quale, name_by_user: come }),
    };
  }

  /** Smette di ascoltare e spegne il timer: serve a spegnere per bene. */
  spegni() {
    this._scaduta();
  }
}
