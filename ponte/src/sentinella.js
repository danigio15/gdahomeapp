/* La sentinella: guarda la casa e dice quando c'e' qualcosa da dire.
 *
 * Non manda niente a nessuno. Guarda gli stati di Home Assistant — tutti
 * all'inizio, poi uno alla volta a ogni `state_changed` — e quando una regola
 * scatta tira fuori un **evento**: cos'e' successo, quanto e' urgente, di che
 * categoria e', con che parole dirlo e quali tasti metterci sotto. A chi
 * mandarlo, e se, lo decide `notifiche.js`, che sa dei telefoni, delle
 * persone, delle ore di silenzio e di chi vede quale telecamera.
 *
 * Le regole stanno tutte sul ponte, e non nell'app: il telefono puo' essere
 * spento, e la casa no. E stanno qui, in un posto solo, scritte come funzioni
 * di quello che si vede, cosi' una prova le accende con una casa finta e un
 * orologio finto e guarda cosa dicono.
 *
 * Le regole riconoscono le cose come le riconosce Home Assistant: per
 * `device_class` prima di tutto, e per nome solo dove Home Assistant una
 * classe non ce l'ha (un frigorifero, una lavatrice). Una regola che non
 * trova niente in casa non dice niente: una casa senza antifurto non riceve
 * «antifurto scattato», e una senza persone non sa quando e' vuota — e allora
 * non lo dice, invece di indovinare.
 */

import { CapireLaCasa, cosaApre, nomePulito } from "./capire-la-casa.js";

const MINUTO = 60 * 1000;
const ORA = 60 * MINUTO;

/* Le tre urgenze, e i loro nomi sul filo. */
export const URGENZE = Object.freeze(["bassa", "normale", "urgente"]);

/* Le categorie della pagina «Notifiche» nell'app, e gli eventi di ognuna. Il
 * nome dell'evento e' anche la chiave del suo interruttore nelle impostazioni
 * di un telefono (`notifiche.js`). */
export const CATEGORIE = Object.freeze({
  urgenti: ["antifurto", "allarmi", "campanello"],
  sicurezza: ["inserimenti", "uscito", "aperture", "movimento"],
  casa: ["elettrodomestici", "frigo", "pioggia"],
  persone: ["arrivi"],
  assistente: ["suggerimenti"],
  manutenzione: ["riepilogo"],
  personalizzate: ["personalizzata"],
  /* I viaggi pianificati di gdanav (`viaggi.js`): «parti fra 10 minuti». */
  viaggi: ["viaggi"],
});

export const EVENTI = Object.freeze(Object.values(CATEGORIE).flat());

export function categoriaDi(tipo) {
  for (const [categoria, tipi] of Object.entries(CATEGORIE))
    if (tipi.includes(tipo)) return categoria;
  return null;
}

/* ─── Come si riconoscono le cose ──────────────────────────────────────── */

const ALLARMI = Object.freeze({
  moisture: { it: "Allagamento", en: "Water leak", emoji: "💧" },
  smoke: { it: "Fumo", en: "Smoke", emoji: "🔥" },
  gas: { it: "Gas", en: "Gas", emoji: "⚠️" },
  carbon_monoxide: { it: "Monossido di carbonio", en: "Carbon monoxide", emoji: "⚠️" },
});

/* Gli stati dell'antifurto che si dicono quando cambiano: ogni modo di
 * inserirlo, e il disinserito. Non i passaggi («arming», «pending») ne'
 * lo scattato, che ha la sua notifica urgente. */
const MODI_DELL_ANTIFURTO = Object.freeze({
  armed_away: { it: "Inserito totale", en: "Armed away", emoji: "🔒" },
  armed_home: { it: "Inserito parziale (casa)", en: "Armed home", emoji: "🏠" },
  armed_night: { it: "Inserito notte", en: "Armed night", emoji: "🌙" },
  armed_vacation: { it: "Inserito vacanza", en: "Armed vacation", emoji: "🧳" },
  armed_custom_bypass: { it: "Inserito personalizzato", en: "Armed custom", emoji: "🛡️" },
  disarmed: { it: "Disinserito", en: "Disarmed", emoji: "🔓" },
});

const APERTURE = new Set(["door", "garage_door", "opening"]);
const COPERTURE_APERTE = new Set(["garage", "gate", "door"]);
const MOVIMENTO = new Set(["motion", "occupancy", "presence"]);

const NOME_DEL_CAMPANELLO = /campanell|doorbell|citofon|ding/i;
/* Per gli eventi la parola intera: «ding» dentro «building» non e' un campanello. */
const EVENTO_DEL_CAMPANELLO = /campanell|doorbell|citofon|intercom|(^|[._])ding([._]|$)/i;
const NOME_DEL_CANCELLO = /cancell|gate|portone|cancel/i;
const NOME_DELLA_PIOGGIA = /pioggia|piove|rain/i;
const NOME_ELETTRODOMESTICO =
  /lavatric|lavastovigl|asciugatric|washer|washing|dishwasher|dryer|lavasciug/i;
const NOME_DEL_FREEZER = /freezer|congelator/i;

/* Il genere di un elettrodomestico, per non dirlo due volte. La lavastoviglie
 * prima della lavatrice: «dishwasher» contiene «washer». */
const GENERI_DI_ELETTRODOMESTICO = [
  ["lavastoviglie", /lavastovigl|dishwasher/i],
  ["lavasciuga", /lavasciug|washer.?dryer/i],
  ["asciugatrice", /asciugatric|dryer/i],
  ["lavatrice", /lavatric|washer|washing/i],
];
export function genereDiElettrodomestico(testo) {
  for (const [genere, forma] of GENERI_DI_ELETTRODOMESTICO) if (forma.test(testo)) return genere;
  return String(testo);
}
const STESSO_ELETTRODOMESTICO = 15 * 60 * 1000;

/* Il nome senza quello che dice la presa: «asciugatrice W», «Lavatrice
 * potenza», «Lavastoviglie kW» sono l'elettrodomestico, con la maiuscola. */
export function nomeDellElettrodomestico(nome) {
  const pulito = String(nome)
    .replace(/\b(potenza|power|consumo|watt|k?w)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!pulito) return String(nome);
  return pulito.charAt(0).toUpperCase() + pulito.slice(1);
}
const NOME_DEL_FRIGO = /frigo|fridge|refrigerat/i;

const PIOVE = new Set(["rainy", "pouring", "lightning-rainy", "hail", "snowy-rainy"]);
const FINITO =
  /^(finished|finish|end|ended|done|complete|completed|finito|terminato|completato|fine)$/i;

/* Le soglie di un frigorifero e di un congelatore: oltre, per un quarto
 * d'ora, si dice. Sono quelle di chi li vende, con un margine. */
const SOGLIA_DEL_FREEZER = -12;
const SOGLIA_DEL_FRIGO = 8;

/* Quanto deve durare una cosa perche' la si dica. Una porta aperta per un
 * minuto e' una porta che si sta chiudendo. */
const APERTA_DA = 10 * MINUTO;
const FRIGO_CALDO_DA = 15 * MINUTO;
const PORTA_DEL_FRIGO_DA = 3 * MINUTO;
const LUCI_CON_CASA_VUOTA_DA = 30 * MINUTO;
/* La casa dorme: niente luci e niente movimento da venti minuti. */
const CASA_CHE_DORME_DA = 20 * MINUTO;
const CLIMA_CON_CASA_VUOTA_DA = 60 * MINUTO;
const ELETTRODOMESTICO_ACCESO = 15; // W
const ELETTRODOMESTICO_FERMO = 5; // W
const ELETTRODOMESTICO_GIRA_ALMENO = 10 * MINUTO;
const ELETTRODOMESTICO_FERMO_DA = 5 * MINUTO;

/* Di notte: dalle dieci di sera alle sei del mattino, nell'ora di casa. */
export function eNotte(data) {
  const ora = data.getHours();
  return ora >= 22 || ora < 6;
}

const nomeDi = (stato, id) =>
  String(stato?.attributes?.friendly_name || id.split(".")[1]?.replace(/_/g, " ") || id).slice(
    0,
    60,
  );

const dominioDi = (id) => String(id).split(".")[0];

const numero = (valore) => {
  const n = Number(String(valore ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const duePassi = (it, en) => ({ it, en });

/* Per quanto, detto a una persona. */
export function perQuanto(ms, lingua = "it") {
  const minuti = Math.max(1, Math.round(ms / MINUTO));
  if (minuti < 60) return `${minuti} min`;
  const ore = Math.round(minuti / 60);
  return lingua === "en" ? `${ore} h` : `${ore} h`;
}

/* ─── La sentinella ────────────────────────────────────────────────────── */

export class Sentinella {
  constructor({
    adesso = () => Date.now(),
    quando = () => {},
    registro = null,
    capire = null,
  } = {}) {
    this.adesso = adesso;
    /* Cosa sono le cose e cosa e' normale per questa casa
     * (`capire-la-casa.js`). Senza disco nelle prove. */
    this.capire = capire || new CapireLaCasa({ adesso, memoria: {} });
    this.quando = quando;
    this.registro = registro;
    /** Gli stati, per entita': `{state, attributes, dal}`. */
    this.stati = new Map();
    /** Di quale dispositivo e' ogni entita' (`registri.js`): serve a trovare
     * la telecamera dello stesso campanello. */
    this.dispositivoDi = {};
    /** Le notifiche personalizzate, come le tiene `notifiche.js`. */
    this.personalizzate = [];
    /* Quello che una regola deve ricordarsi fra un giro e l'altro: da quando
     * un elettrodomestico gira, se una cosa lunga e' gia' stata detta. */
    this._memoria = new Map();
    /* Chi altro vuole sapere di ogni cambio: le automazioni
     * (`automazioni.js`). Lo specchio e' uno, e chi lo guarda non deve
     * chiedere la casa una seconda volta a Home Assistant. */
    this.ascoltatori = [];
  }

  /* ─── Quello che arriva da Home Assistant ──────────────────────────── */

  /* Tutti gli stati insieme, all'inizio o dopo una caduta del filo. Non fa
   * scattare niente: quello che e' gia' cosi' non e' una novita'. */
  carica(elenco) {
    this.stati.clear();
    for (const uno of Array.isArray(elenco) ? elenco : []) {
      if (!uno?.entity_id) continue;
      this.stati.set(uno.entity_id, this._stato(uno));
    }
  }

  _stato(uno) {
    const dal = Date.parse(uno?.last_changed || "");
    return {
      state: String(uno?.state ?? ""),
      attributes: uno?.attributes && typeof uno.attributes === "object" ? uno.attributes : {},
      dal: Number.isFinite(dal) ? dal : this.adesso(),
    };
  }

  /* Un `state_changed`. */
  cambia(id, nuovo, vecchio = null) {
    if (typeof id !== "string" || !id.includes(".")) return;
    const prima = vecchio ? this._stato(vecchio) : (this.stati.get(id) ?? null);
    const vuotaPrima = this.casaVuota();
    if (nuovo) {
      const ora = this._stato(nuovo);
      /* Solo un attributo cambiato non e' un cambio di stato: il «da
       * quando» resta quello di prima. */
      if (prima && prima.state === ora.state) ora.dal = prima.dal;
      this.stati.set(id, ora);
    } else {
      this.stati.delete(id);
      return;
    }
    const dopo = this.stati.get(id);
    /* Una porta che si chiude dimentica il suo «va bene stanotte». */
    if (["off", "closed"].includes(dopo.state)) this.capire.chiusa(id);
    for (const ascolta of this.ascoltatori) {
      try {
        ascolta(id, dopo, prima);
      } catch (errore) {
        this.registro?.errore?.(`chi ascolta la casa: ${errore?.message || errore}`);
      }
    }
    try {
      this._regoleDelMomento(id, dopo, prima, vuotaPrima);
      this._personalizzate();
    } catch (errore) {
      this.registro?.errore?.(`una regola delle notifiche: ${errore?.message || errore}`);
    }
  }

  /* Il giro lento: quello che scatta dopo che una cosa e' durata abbastanza.
   * `notifiche.js` lo chiama ogni mezzo minuto. */
  battito() {
    try {
      this._durate();
      this._personalizzate();
    } catch (errore) {
      this.registro?.errore?.(`una regola delle notifiche: ${errore?.message || errore}`);
    }
    /* Le abitudini su disco, e una volta al giorno via i giorni vecchi. */
    const oggi = new Date(this.adesso()).toDateString();
    if (this._potatoIl !== oggi) {
      this._potatoIl = oggi;
      this.capire.pota();
    }
    this.capire.scrivi();
  }

  _dici(evento) {
    try {
      this.quando({ quando: this.adesso(), azioni: [], ...evento });
    } catch (errore) {
      this.registro?.errore?.(`una notifica non e' partita: ${errore?.message || errore}`);
    }
  }

  /* ─── Chi c'e' in casa ─────────────────────────────────────────────── */

  persone() {
    return [...this.stati].filter(([id]) => dominioDi(id) === "person");
  }

  /* Vuota, piena, o non si sa (`null`): senza persone in Home Assistant non
   * c'e' modo di dirlo, e non lo si indovina. */
  casaVuota() {
    const persone = this.persone();
    if (!persone.length) return null;
    return persone.every(([, stato]) => stato.state !== "home");
  }

  /* L'entita' `person.*` di un utente di Home Assistant. */
  personaDi(utente) {
    if (!utente) return null;
    for (const [id, stato] of this.persone()) if (stato.attributes?.user_id === utente) return id;
    return null;
  }

  aCasa(utente) {
    const persona = this.personaDi(utente);
    return persona ? this.stati.get(persona)?.state === "home" : null;
  }

  /* ─── Le telecamere e i cancelli vicini ────────────────────────────── */

  /* La telecamera che fa vedere quello che e' successo: prima quella dello
   * stesso dispositivo, poi quella che ha una parola del nome in comune, poi
   * l'unica che c'e'. Altrimenti nessuna. */
  telecameraPer(id) {
    const telecamere = [...this.stati.keys()].filter((uno) => dominioDi(uno) === "camera");
    if (!telecamere.length) return null;
    const suo = this.dispositivoDi?.[id];
    if (suo) {
      const stessa = telecamere.find((una) => this.dispositivoDi?.[una] === suo);
      if (stessa) return stessa;
    }
    const parole = String(id.split(".")[1] || "")
      .split("_")
      .filter((una) => una.length > 3);
    const vicina = telecamere.find((una) => parole.some((parola) => una.includes(parola)));
    if (vicina) return vicina;
    return telecamere.length === 1 ? telecamere[0] : null;
  }

  /* Il cancello da aprire dal campanello: una serratura, una copertura o un
   * tasto che si chiama cancello. */
  cancello() {
    for (const [id] of this.stati) {
      const dominio = dominioDi(id);
      if (!NOME_DEL_CANCELLO.test(id)) continue;
      if (dominio === "lock") return { dominio: "lock", servizio: "unlock", entita: [id] };
      if (dominio === "cover") return { dominio: "cover", servizio: "open_cover", entita: [id] };
      if (dominio === "button") return { dominio: "button", servizio: "press", entita: [id] };
    }
    return null;
  }

  /* ─── Le regole che scattano subito ────────────────────────────────── */

  _regoleDelMomento(id, dopo, prima, vuotaPrima) {
    const dominio = dominioDi(id);
    const classe = dopo.attributes?.device_class;
    const era = prima?.state;
    const nome = nomeDi(dopo, id);

    /* L'antifurto scattato. */
    if (dominio === "alarm_control_panel" && dopo.state === "triggered" && era !== "triggered") {
      const camera = this.telecameraPer(id);
      this._dici({
        tipo: "antifurto",
        urgenza: "urgente",
        chiave: `antifurto:${id}`,
        pausa: 5 * MINUTO,
        entita: id,
        camera,
        parole: {
          it: {
            titolo: `🚨 Antifurto scattato · ${nome}`,
            testo: dopo.attributes?.changed_by
              ? `Da ${String(dopo.attributes.changed_by).slice(0, 40)}`
              : "Sirena accesa",
          },
          en: { titolo: `🚨 Alarm triggered · ${nome}`, testo: "Siren on" },
        },
        azioni: [{ id: "guarda", parole: duePassi("Guarda", "View"), apre: true }],
      });
      return;
    }

    /* L'antifurto inserito, in uno dei suoi modi, o disinserito. Solo un
     * cambio vero: non al primo stato che si legge, non tornando da
     * «non disponibile», non fra due letture uguali. */
    const modo = MODI_DELL_ANTIFURTO[dopo.state];
    if (
      dominio === "alarm_control_panel" &&
      modo &&
      prima &&
      era !== dopo.state &&
      era !== "unavailable" &&
      era !== "unknown"
    ) {
      const chi = dopo.attributes?.changed_by
        ? String(dopo.attributes.changed_by).slice(0, 40)
        : "";
      this._dici({
        tipo: "inserimenti",
        urgenza: "normale",
        chiave: `inserimenti:${id}`,
        pausa: 0,
        entita: id,
        parole: {
          it: {
            titolo: `${modo.emoji} Antifurto · ${modo.it}`,
            testo: chi ? `${nome} · da ${chi}` : nome,
          },
          en: {
            titolo: `${modo.emoji} Alarm · ${modo.en}`,
            testo: chi ? `${nome} · by ${chi}` : nome,
          },
        },
        azioni: [{ id: "guarda", parole: duePassi("Guarda", "View"), apre: true }],
      });
      return;
    }

    /* Allagamento, fumo, gas: dal primo sensore che se ne accorge. */
    if (dominio === "binary_sensor" && ALLARMI[classe] && dopo.state === "on" && era !== "on") {
      if (classe === "moisture" && NOME_DELLA_PIOGGIA.test(id)) {
        this._piove(id);
        return;
      }
      const cosa = ALLARMI[classe];
      this._dici({
        tipo: "allarmi",
        urgenza: "urgente",
        chiave: `allarmi:${id}`,
        pausa: 10 * MINUTO,
        entita: id,
        parole: {
          it: {
            titolo: `${cosa.emoji} ${cosa.it} · ${nome}`,
            testo: "Il sensore se n'è accorto adesso",
          },
          en: { titolo: `${cosa.emoji} ${cosa.en} · ${nome}`, testo: "The sensor just noticed" },
        },
        azioni: [{ id: "guarda", parole: duePassi("Guarda", "View"), apre: true }],
      });
      return;
    }

    /* Il campanello: un `event.*` di classe doorbell che cambia ora, o un
     * sensore che si chiama campanello e si accende. */
    /* Non tutti i campanelli dicono «doorbell»: il citofono di Ring, e altri,
     * arrivano come un `event.*` senza classe, col nome o l'evento che dicono
     * cos'e' («…_ding», `event_type: ding`). Il movimento no: e' un'altra
     * notifica, e ha la sua classe. */
    const tipoDiEvento = String(dopo.attributes?.event_type ?? "").toLowerCase();
    const eUnCampanello =
      classe === "doorbell" ||
      (classe !== "motion" &&
        (EVENTO_DEL_CAMPANELLO.test(id) ||
          /^(ding|intercom_ding|ring|doorbell)$/.test(tipoDiEvento)));
    const suona =
      (dominio === "event" &&
        eUnCampanello &&
        prima &&
        era !== dopo.state &&
        era !== "unavailable" &&
        dopo.state !== "unavailable") ||
      (dominio === "binary_sensor" &&
        NOME_DEL_CAMPANELLO.test(id) &&
        dopo.state === "on" &&
        era === "off");
    if (suona) {
      const cancello = this.cancello();
      this._dici({
        tipo: "campanello",
        urgenza: "urgente",
        chiave: `campanello:${id}`,
        pausa: 30 * 1000,
        entita: id,
        camera: this.telecameraPer(id),
        chiamata: true,
        parole: {
          it: { titolo: "🔔 Suona il campanello", testo: `${nome} · adesso` },
          en: { titolo: "🔔 Someone's at the door", testo: `${nome} · now` },
        },
        azioni: [
          ...(cancello
            ? [{ id: "apri", parole: duePassi("Apri cancello", "Open gate"), servizio: cancello }]
            : []),
          { id: "ignora", parole: duePassi("Ignora", "Ignore"), ignora: true },
        ],
      });
      return;
    }

    /* Le persone: chi arriva e chi esce, e la casa che si svuota. */
    if (dominio === "person" && prima && era !== dopo.state) {
      const arriva = dopo.state === "home" && era !== "home";
      const esce = era === "home" && dopo.state !== "home";
      if (arriva || esce) {
        this._dici({
          tipo: "arrivi",
          urgenza: "bassa",
          chiave: `arrivi:${id}:${arriva ? "su" : "giu"}`,
          pausa: 5 * MINUTO,
          entita: id,
          persona: id,
          parole: arriva
            ? {
                it: { titolo: `🏠 ${nome} è arrivato a casa`, testo: "Adesso" },
                en: { titolo: `🏠 ${nome} got home`, testo: "Just now" },
              }
            : {
                it: { titolo: `👋 ${nome} è uscito`, testo: "Adesso" },
                en: { titolo: `👋 ${nome} left`, testo: "Just now" },
              },
        });
      }
      if (vuotaPrima === false && this.casaVuota() === true) this._casaAppenaVuota(nome);
      return;
    }

    /* Movimento con la casa vuota. */
    if (
      dominio === "binary_sensor" &&
      MOVIMENTO.has(classe) &&
      dopo.state === "on" &&
      era !== "on"
    ) {
      if (this.casaVuota() === true) {
        this._dici({
          tipo: "movimento",
          urgenza: "normale",
          chiave: `movimento:${id}`,
          pausa: 30 * MINUTO,
          entita: id,
          camera: this.telecameraPer(id),
          parole: {
            it: {
              titolo: `🏃 Movimento con casa vuota · ${nome}`,
              testo: "Nessuno in casa, ma qualcosa si muove",
            },
            en: {
              titolo: `🏃 Motion while away · ${nome}`,
              testo: "Nobody's home, but something moved",
            },
          },
          azioni: [{ id: "guarda", parole: duePassi("Guarda", "View"), apre: true }],
        });
      }
      return;
    }

    /* La pioggia: il tempo che diventa pioggia, o un sensore di pioggia. */
    if (
      (dominio === "weather" && PIOVE.has(dopo.state) && !PIOVE.has(era)) ||
      (dominio === "binary_sensor" &&
        NOME_DELLA_PIOGGIA.test(id) &&
        dopo.state === "on" &&
        era !== "on")
    ) {
      this._piove(id);
      return;
    }

    /* Un elettrodomestico che dice da se' d'aver finito. */
    if (
      (dominio === "sensor" || dominio === "select") &&
      NOME_ELETTRODOMESTICO.test(id) &&
      FINITO.test(dopo.state) &&
      prima &&
      !FINITO.test(era)
    ) {
      this._elettrodomesticoFinito(id, nome);
      return;
    }

    /* Una potenza che scende: il conto lo fa `_durate`, qui si segna. */
    if (dominio === "sensor" && NOME_ELETTRODOMESTICO.test(id) && this._watt(dopo) !== null) {
      this._seguiLaPotenza(id, dopo);
    }
  }

  _watt(stato) {
    const unita = String(stato?.attributes?.unit_of_measurement || "");
    if (unita !== "W" && unita !== "kW") return null;
    const n = numero(stato.state);
    if (n === null) return null;
    return unita === "kW" ? n * 1000 : n;
  }

  _seguiLaPotenza(id, stato) {
    const watt = this._watt(stato);
    const chiave = `potenza:${id}`;
    const memoria = this._memoria.get(chiave) ?? { giraDal: null, fermoDal: null };
    const ora = this.adesso();
    if (watt >= ELETTRODOMESTICO_ACCESO) {
      memoria.giraDal ??= ora;
      memoria.fermoDal = null;
    } else if (watt <= ELETTRODOMESTICO_FERMO && memoria.giraDal !== null) {
      memoria.fermoDal ??= ora;
    }
    this._memoria.set(chiave, memoria);
  }

  /* Lo stesso elettrodomestico lo dice spesso da due parti: dal suo stato
   * («finished») e dalla presa che ne misura la potenza. «Perché arriva due
   * volte la notifica»: «Asciugatrice: finito» e «asciugatrice W: finito» alla
   * stessa ora. Di un genere (lavatrice, asciugatrice, lavastoviglie…) si dice
   * una volta sola per quarto d'ora, da qualunque parte arrivi. */
  _elettrodomesticoFinito(id, nome) {
    const genere = genereDiElettrodomestico(`${id} ${nome}`);
    const chiave = `finito:${genere}`;
    const ora = this.adesso();
    const ultimo = this._memoria.get(chiave);
    if (ultimo != null && ora - ultimo < STESSO_ELETTRODOMESTICO) return;
    this._memoria.set(chiave, ora);
    nome = nomeDellElettrodomestico(nome);
    this._dici({
      tipo: "elettrodomestici",
      urgenza: "normale",
      chiave: `elettrodomestici:${id}`,
      pausa: 30 * MINUTO,
      entita: id,
      parole: {
        it: { titolo: `🧺 ${nome}: finito`, testo: "Ha appena finito" },
        en: { titolo: `🧺 ${nome}: done`, testo: "It just finished" },
      },
    });
  }

  _finestreAperte() {
    const aperte = [];
    for (const [id, stato] of this.stati) {
      const classe = stato.attributes?.device_class;
      if (dominioDi(id) === "binary_sensor" && classe === "window" && stato.state === "on")
        aperte.push(nomeDi(stato, id));
      if (dominioDi(id) === "cover" && classe === "window" && stato.state === "open")
        aperte.push(nomeDi(stato, id));
    }
    return aperte;
  }

  /* Piove, o sta per piovere: si dice solo se c'e' una finestra aperta. */
  _piove(id, { fra = null } = {}) {
    const aperte = this._finestreAperte();
    if (!aperte.length) return;
    const quali = aperte.slice(0, 3).join(", ");
    this._dici({
      tipo: "pioggia",
      urgenza: "normale",
      chiave: "pioggia",
      pausa: 2 * ORA,
      entita: id,
      parole: fra
        ? {
            it: { titolo: `🌧️ Tra ${fra} min piove`, testo: `Finestre aperte: ${quali}` },
            en: { titolo: `🌧️ Rain in ${fra} min`, testo: `Open windows: ${quali}` },
          }
        : {
            it: { titolo: "🌧️ Piove", testo: `Finestre aperte: ${quali}` },
            en: { titolo: "🌧️ It's raining", testo: `Open windows: ${quali}` },
          },
    });
  }

  /* La previsione oraria, chiesta da `notifiche.js` a `weather.get_forecasts`:
   * se nella prossima ora piove e c'e' una finestra aperta, lo si dice prima. */
  previsione(dove, elenco) {
    const ora = this.adesso();
    for (const una of Array.isArray(elenco) ? elenco : []) {
      const quando = Date.parse(una?.datetime || "");
      if (!Number.isFinite(quando) || quando < ora - 5 * MINUTO || quando > ora + ORA) continue;
      const probabilita = numero(una?.precipitation_probability);
      if (PIOVE.has(una?.condition) || (probabilita !== null && probabilita >= 70)) {
        this._piove(dove, { fra: Math.max(5, Math.round((quando - ora) / MINUTO / 5) * 5) || 30 });
        return;
      }
    }
  }

  /* L'ultimo esce e l'antifurto e' spento. */
  _casaAppenaVuota(chi) {
    for (const [id, stato] of this.stati) {
      if (dominioDi(id) !== "alarm_control_panel" || stato.state !== "disarmed") continue;
      const azioni = stato.attributes?.code_arm_required
        ? [{ id: "guarda", parole: duePassi("Apri l'app", "Open the app"), apre: true }]
        : [
            {
              id: "inserisci",
              parole: duePassi("Inserisci", "Arm"),
              servizio: {
                dominio: "alarm_control_panel",
                servizio: "alarm_arm_away",
                entita: [id],
              },
            },
            { id: "piu-tardi", parole: duePassi("Più tardi", "Later"), piuTardi: true },
          ];
      this._dici({
        tipo: "uscito",
        urgenza: "normale",
        chiave: `uscito:${id}`,
        pausa: 30 * MINUTO,
        entita: id,
        parole: {
          it: {
            titolo: "🛡️ Uscito senza antifurto",
            testo: `${chi} è l'ultimo a uscire e l'antifurto è spento`,
          },
          en: {
            titolo: "🛡️ Left without the alarm",
            testo: `${chi} was the last to leave and the alarm is off`,
          },
        },
        azioni,
      });
      return;
    }
  }

  /* ─── Le regole che vogliono tempo ─────────────────────────────────── */

  _unaVolta(chiave, vale) {
    if (!vale) {
      this._memoria.delete(`detto:${chiave}`);
      return false;
    }
    if (this._memoria.get(`detto:${chiave}`)) return false;
    this._memoria.set(`detto:${chiave}`, true);
    return true;
  }

  /* Se la casa dorme: nessuna luce accesa e nessun movimento da venti
   * minuti. Le luci che restano accese per conto loro (l'acquario, la
   * notturna, quelle a orario) non tengono sveglia la casa. */
  _casaDorme(ora) {
    let sveglia = false;
    for (const [id, stato] of this.stati) {
      const dominio = dominioDi(id);
      if (dominio === "light" && stato.state === "on") {
        if (!this.capire.lasciaStare(id, nomeDi(stato, id), { tipo: "luce", ora })) sveglia = true;
      } else if (
        dominio === "binary_sensor" &&
        MOVIMENTO.has(stato.attributes?.device_class) &&
        stato.state === "on"
      ) {
        sveglia = true;
      }
      if (sveglia) break;
    }
    if (sveglia || !this._memoria.has("svegliaFinoA")) this._memoria.set("svegliaFinoA", ora);
    return ora - this._memoria.get("svegliaFinoA") >= CASA_CHE_DORME_DA;
  }

  /* L'ora in cui e' uscita l'ultima persona, se si sa: «alle 9:12». */
  _uscitaUltima() {
    const fuori = this.persone()
      .filter(([, stato]) => stato.state !== "home")
      .map(([, stato]) => stato.dal)
      .filter(Number.isFinite);
    if (!fuori.length) return null;
    const d = new Date(Math.max(...fuori));
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  _durate() {
    const ora = this.adesso();
    const vuota = this.casaVuota();
    const notte = eNotte(new Date(ora));
    const dorme = this._casaDorme(ora);
    /* Quanto e' passato dal battito di prima, per le abitudini: al piu' un
     * minuto, perche' un ponte fermo per un'ora non ha visto niente. */
    const passati = Math.min(1, Math.max(0, (ora - (this._ultimoBattito ?? ora)) / MINUTO));
    this._ultimoBattito = ora;
    const lasciate = [];
    const luciAccese = [];
    const luciDaSpegnere = [];
    let luciDa = Infinity;
    const climiAccesi = [];
    let climaDa = Infinity;

    for (const [id, stato] of this.stati) {
      const dominio = dominioDi(id);
      const classe = stato.attributes?.device_class;
      const da = ora - stato.dal;
      const nome = nomeDi(stato, id);

      /* Porte e garage aperti: con la casa vuota, o di notte quando la casa
       * dorme.
       *
       * «Questa notifica che senso ha?»: alle dieci di sera in punto, con
       * tutti svegli, «Sensore Porta/Finestra Cucina Porta aperta da 1 h · È
       * notte». Adesso, con la gente in casa, si aspetta che la casa dorma
       * (`casaDorme`), e si tace per una porta interna, per una che di notte
       * resta spesso aperta (l'abitudine) e per una a cui si e' gia' detto
       * «Va bene stanotte». Con la casa vuota si dice sempre: e' sicurezza. */
      const aperta =
        (dominio === "binary_sensor" && APERTURE.has(classe) && stato.state === "on") ||
        (dominio === "cover" && COPERTURE_APERTE.has(classe) && stato.state === "open");
      const eUnaApertura =
        (dominio === "binary_sensor" && APERTURE.has(classe)) ||
        (dominio === "cover" && COPERTURE_APERTE.has(classe));
      if (eUnaApertura && notte && dorme && vuota !== true)
        this.capire.portaDiNotte(id, aperta, ora);
      /* Con la casa vuota la tace solo chi l'ha detto: l'abitudine e una
       * porta interna valgono quando in casa c'e' qualcuno. */
      const detto = aperta ? this.capire.lasciaStare(id, nome, { tipo: "porta", ora }) : null;
      const lascia =
        aperta &&
        (vuota === true
          ? ["detto", "stanotte"].includes(detto?.perche)
          : detto !== null || this.capire.portaInterna(id, nome, classe));
      const daDire = aperta && !lascia && da >= APERTA_DA && (vuota === true || (notte && dorme));
      if (this._unaVolta(`aperture:${id}`, daDire)) {
        const dove = nomePulito(nome);
        const cosa = cosaApre(id, nome, classe);
        const ultima = vuota === true ? this._uscitaUltima() : null;
        this._dici({
          tipo: "aperture",
          urgenza: "normale",
          chiave: `aperture:${id}`,
          pausa: ORA,
          entita: id,
          camera: this.telecameraPer(id),
          parole: {
            it: {
              titolo:
                vuota === true
                  ? `🚪 ${dove}: ${cosa.it} aperta, in casa non c'è nessuno`
                  : `🚪 ${dove}: la ${cosa.it} è ancora aperta`,
              testo:
                vuota === true
                  ? `Aperta da ${perQuanto(da)}${ultima ? `, uscita l'ultima persona alle ${ultima}` : ""}.`
                  : "In casa si dorme. Di solito di notte è chiusa.",
            },
            en: {
              titolo:
                vuota === true
                  ? `🚪 ${dove}: ${cosa.en} open, nobody's home`
                  : `🚪 ${dove}: the ${cosa.en} is still open`,
              testo:
                vuota === true
                  ? `Open for ${perQuanto(da, "en")}${ultima ? `, last person left at ${ultima}` : ""}.`
                  : "The house is asleep. It's usually closed at night.",
            },
          },
          azioni: [
            ...(dominio === "cover"
              ? [
                  {
                    id: "chiudi",
                    parole: duePassi("Chiudi", "Close"),
                    servizio: { dominio: "cover", servizio: "close_cover", entita: [id] },
                  },
                ]
              : []),
            {
              id: "va-bene",
              parole:
                vuota === true
                  ? duePassi("Va bene così", "That's fine")
                  : duePassi("Va bene stanotte", "Fine tonight"),
              vaBene: [id],
            },
            { id: "piu-tardi", parole: duePassi("Più tardi", "Later"), piuTardi: true },
          ],
        });
      }

      /* Freezer e frigo troppo caldi, o con la porta aperta. */
      if (dominio === "sensor" && classe === "temperature") {
        const gradi = numero(stato.state);
        const soglia = NOME_DEL_FREEZER.test(id)
          ? SOGLIA_DEL_FREEZER
          : NOME_DEL_FRIGO.test(id)
            ? SOGLIA_DEL_FRIGO
            : null;
        if (soglia !== null) {
          const memoria = `caldo:${id}`;
          const sopra = gradi !== null && gradi > soglia;
          if (!sopra) this._memoria.delete(memoria);
          else if (!this._memoria.has(memoria)) this._memoria.set(memoria, ora);
          const daQuando = this._memoria.get(memoria);
          if (this._unaVolta(`frigo:${id}`, sopra && ora - daQuando >= FRIGO_CALDO_DA)) {
            const unita = stato.attributes?.unit_of_measurement || "°C";
            this._dici({
              tipo: "frigo",
              urgenza: "normale",
              chiave: `frigo:${id}`,
              pausa: ORA,
              entita: id,
              parole: {
                it: {
                  titolo: `🧊 ${nome}: troppo caldo`,
                  testo: `${stato.state} ${unita} da ${perQuanto(ora - daQuando)}`,
                },
                en: {
                  titolo: `🧊 ${nome}: too warm`,
                  testo: `${stato.state} ${unita} for ${perQuanto(ora - daQuando, "en")}`,
                },
              },
            });
          }
        }
      }
      if (
        dominio === "binary_sensor" &&
        (NOME_DEL_FREEZER.test(id) || NOME_DEL_FRIGO.test(id)) &&
        (classe === "door" || classe === "opening")
      ) {
        if (this._unaVolta(`portafrigo:${id}`, stato.state === "on" && da >= PORTA_DEL_FRIGO_DA)) {
          this._dici({
            tipo: "frigo",
            urgenza: "normale",
            chiave: `portafrigo:${id}`,
            pausa: 30 * MINUTO,
            entita: id,
            parole: {
              it: { titolo: `🧊 ${nome}: porta aperta`, testo: `Aperta da ${perQuanto(da)}` },
              en: { titolo: `🧊 ${nome}: door open`, testo: `Open for ${perQuanto(da, "en")}` },
            },
          });
        }
      }

      /* Elettrodomestici che finiscono: la potenza e' scesa e resta giu'. */
      if (dominio === "sensor" && NOME_ELETTRODOMESTICO.test(id)) {
        const memoria = this._memoria.get(`potenza:${id}`);
        if (
          memoria?.giraDal != null &&
          memoria.fermoDal != null &&
          memoria.fermoDal - memoria.giraDal >= ELETTRODOMESTICO_GIRA_ALMENO &&
          ora - memoria.fermoDal >= ELETTRODOMESTICO_FERMO_DA
        ) {
          this._memoria.delete(`potenza:${id}`);
          this._elettrodomesticoFinito(id, nome);
        } else if (
          memoria?.giraDal != null &&
          memoria.fermoDal != null &&
          memoria.fermoDal - memoria.giraDal < ELETTRODOMESTICO_GIRA_ALMENO &&
          ora - memoria.fermoDal >= ELETTRODOMESTICO_FERMO_DA
        ) {
          /* Un'accensione breve non e' un lavaggio. */
          this._memoria.delete(`potenza:${id}`);
        }
      }

      if (vuota === true && dominio === "light" && stato.state === "on") {
        /* L'abitudine si impara prima di decidere: una luce accesa con la
         * casa vuota quasi tutti i giorni e' a orario. */
        if (passati > 0) this.capire.luceAccesaConLaCasaVuota(id, passati, ora);
        const lascia = this.capire.lasciaStare(id, nome, { tipo: "luce", ora });
        if (lascia) {
          lasciate.push({ id, nome, perche: lascia.perche });
        } else {
          luciAccese.push(nome);
          luciDaSpegnere.push(id);
          luciDa = Math.min(luciDa, stato.dal);
        }
      }
      if (
        vuota === true &&
        dominio === "climate" &&
        !["off", "unavailable", "unknown"].includes(stato.state)
      ) {
        climiAccesi.push(id);
        climaDa = Math.min(climaDa, stato.dal);
      }
    }

    /* L'assistente: luci e clima accesi con la casa vuota. */
    const vuotaDa = this._vuotaDa(vuota);
    const luciLunghe =
      luciAccese.length && ora - Math.max(luciDa, vuotaDa) >= LUCI_CON_CASA_VUOTA_DA;
    if (this._unaVolta("suggerimenti:luci", Boolean(luciLunghe))) {
      const quante = luciAccese.length;
      const daQuando = perQuanto(ora - Math.max(luciDa, vuotaDa));
      /* Quelle lasciate stare si dicono, in una riga: chi legge sa che
       * l'assistente le ha viste, e perche' non le tocca. «Spegni» spegne
       * solo le altre: prima spegneva tutte le luci accese, acquario
       * compreso. */
      const nomiLasciati = lasciate.slice(0, 2).map((l) => l.nome);
      const restaIt = nomiLasciati.length
        ? ` Restano accese ${nomiLasciati.join(", ")}${lasciate.length > 2 ? ` e altre ${lasciate.length - 2}` : ""}.`
        : "";
      const restaEn = nomiLasciati.length
        ? ` Leaving on ${nomiLasciati.join(", ")}${lasciate.length > 2 ? ` and ${lasciate.length - 2} more` : ""}.`
        : "";
      const elenco = (lingua) =>
        quante === 1
          ? luciAccese[0]
          : `${luciAccese.slice(0, 3).join(", ")}${quante > 3 ? (lingua === "en" ? ` and ${quante - 3} more` : ` e altre ${quante - 3}`) : ""}`;
      this._dici({
        tipo: "suggerimenti",
        urgenza: "bassa",
        importante: true,
        chiave: "suggerimenti:luci",
        pausa: 2 * ORA,
        parole: {
          it: {
            titolo: `💡 Nessuno in casa da ${daQuando}`,
            testo: `${quante === 1 ? "Accesa" : "Accese"}: ${elenco("it")}.${restaIt} ${quante === 1 ? "La spengo?" : "Le spengo?"}`,
          },
          en: {
            titolo: `💡 Nobody home for ${perQuanto(ora - Math.max(luciDa, vuotaDa), "en")}`,
            testo: `On: ${elenco("en")}.${restaEn} Turn ${quante === 1 ? "it" : "them"} off?`,
          },
        },
        azioni: [
          {
            id: "spegni",
            parole:
              quante === 1
                ? duePassi("Spegni", "Turn off")
                : duePassi(`Spegni le ${quante} luci`, `Turn off ${quante} lights`),
            servizio: {
              dominio: "light",
              servizio: "turn_off",
              entita: luciDaSpegnere.slice(0, 40),
            },
          },
          {
            id: "resta",
            parole:
              quante === 1
                ? duePassi("Resta così", "Leave it on")
                : duePassi("Restano così", "Leave them on"),
            resta: luciDaSpegnere.slice(0, 40),
          },
          { id: "piu-tardi", parole: duePassi("Più tardi", "Later"), piuTardi: true },
        ],
      });
    }
    const climaLungo =
      climiAccesi.length && ora - Math.max(climaDa, vuotaDa) >= CLIMA_CON_CASA_VUOTA_DA;
    if (this._unaVolta("suggerimenti:clima", Boolean(climaLungo))) {
      this._dici({
        tipo: "suggerimenti",
        urgenza: "bassa",
        importante: true,
        chiave: "suggerimenti:clima",
        pausa: 3 * ORA,
        parole: {
          it: {
            titolo: "🌡️ Clima acceso con la casa vuota",
            testo: "Assistente di casa · lo spengo?",
          },
          en: { titolo: "🌡️ Climate on with nobody home", testo: "Home assistant · turn it off?" },
        },
        azioni: [
          {
            id: "spegni",
            parole: duePassi("Spegni", "Turn off"),
            servizio: {
              dominio: "climate",
              servizio: "turn_off",
              entita: climiAccesi.slice(0, 20),
            },
          },
          { id: "piu-tardi", parole: duePassi("Più tardi", "Later"), piuTardi: true },
        ],
      });
    }
    /* Con «Tutti»: anche la musica rimasta accesa. */
    const suona =
      vuota === true
        ? [...this.stati].filter(
            ([id, s]) =>
              dominioDi(id) === "media_player" &&
              s.state === "playing" &&
              ora - s.dal >= LUCI_CON_CASA_VUOTA_DA,
          )
        : [];
    if (this._unaVolta("suggerimenti:musica", suona.length > 0)) {
      this._dici({
        tipo: "suggerimenti",
        urgenza: "bassa",
        importante: false,
        chiave: "suggerimenti:musica",
        pausa: 3 * ORA,
        parole: {
          it: {
            titolo: `🎵 ${nomeDi(suona[0][1], suona[0][0])} suona con la casa vuota`,
            testo: "Assistente di casa · la fermo?",
          },
          en: {
            titolo: `🎵 ${nomeDi(suona[0][1], suona[0][0])} is playing with nobody home`,
            testo: "Home assistant · stop it?",
          },
        },
        azioni: [
          {
            id: "spegni",
            parole: duePassi("Ferma", "Stop"),
            servizio: {
              dominio: "media_player",
              servizio: "media_pause",
              entita: suona.map(([id]) => id).slice(0, 10),
            },
          },
        ],
      });
    }
  }

  /* Da quando la casa e' vuota: l'ultima persona uscita. */
  _vuotaDa(vuota) {
    if (vuota !== true) return Infinity;
    return Math.max(...this.persone().map(([, stato]) => stato.dal));
  }

  /* ─── Il riepilogo della sera ──────────────────────────────────────── */

  /* Quello che va sistemato, in una notifica sola. `null` se non c'e' niente:
   * un riepilogo vuoto non si manda. */
  riepilogo() {
    const batterie = [];
    let aggiornamenti = 0;
    /* «Non ci sono 65 dispositivi non connessi»: qui si contavano le entita'
     * mute che hanno un dispositivo, non i dispositivi. Adesso la regola e'
     * quella del cruscotto di chi installa (`salute.js`) e della pagina «Non
     * connessi» della plancia: un dispositivo e' giu' quando NESSUNA delle sue
     * entita' risponde, e conta una volta. Un canale non usato di uno switch
     * acceso, il blocco bambini di un'asciugatrice spenta, non lo fanno giu'. */
    const muti = new Set();
    const vivi = new Set();
    for (const [id, stato] of this.stati) {
      const dominio = dominioDi(id);
      if (dominio === "sensor" && stato.attributes?.device_class === "battery") {
        const n = numero(stato.state);
        if (n !== null && n <= 15) batterie.push(nomeDi(stato, id));
      }
      if (dominio === "update" && stato.state === "on") aggiornamenti += 1;
      const suo = this.dispositivoDi?.[id];
      if (!suo) continue;
      if (stato.state === "unavailable") muti.add(suo);
      else vivi.add(suo);
    }
    const spenti = [...muti].filter((suo) => !vivi.has(suo)).length;
    if (!batterie.length && !spenti && !aggiornamenti) return null;
    const pezziIt = [];
    const pezziEn = [];
    if (batterie.length) {
      pezziIt.push(
        batterie.length === 1 ? "1 batteria scarica" : `${batterie.length} batterie scariche`,
      );
      pezziEn.push(batterie.length === 1 ? "1 low battery" : `${batterie.length} low batteries`);
    }
    if (spenti) {
      pezziIt.push(
        spenti === 1 ? "1 dispositivo non connesso" : `${spenti} dispositivi non connessi`,
      );
      pezziEn.push(spenti === 1 ? "1 device offline" : `${spenti} devices offline`);
    }
    if (aggiornamenti) {
      pezziIt.push(aggiornamenti === 1 ? "1 aggiornamento" : `${aggiornamenti} aggiornamenti`);
      pezziEn.push(aggiornamenti === 1 ? "1 update" : `${aggiornamenti} updates`);
    }
    return {
      tipo: "riepilogo",
      urgenza: "bassa",
      chiave: "riepilogo",
      pausa: 12 * ORA,
      parole: {
        it: { titolo: "🔋 Riepilogo di stasera", testo: pezziIt.join(", ") },
        en: { titolo: "🔋 Tonight's summary", testo: pezziEn.join(", ") },
      },
    };
  }

  /* ─── Le personalizzate ────────────────────────────────────────────── */

  _personalizzate() {
    const ora = this.adesso();
    for (const regola of this.personalizzate) {
      if (!regola?.attiva) continue;
      const stato = this.stati.get(regola.entita);
      const vale = Boolean(stato) && condizioneVera(regola, stato.state);
      const memoria = `pers:${regola.id}`;
      if (!vale) {
        this._memoria.delete(memoria);
        continue;
      }
      if (!this._memoria.has(memoria)) this._memoria.set(memoria, { dal: ora, detta: 0 });
      const traccia = this._memoria.get(memoria);
      const serve = (Number(regola.per) || 0) * MINUTO;
      if (ora - traccia.dal < serve) continue;
      const ripeti = (Number(regola.nonRipetere) || 0) * MINUTO;
      if (traccia.detta && (!ripeti || ora - traccia.detta < ripeti)) continue;
      traccia.detta = ora;
      const nome = nomeDi(stato, regola.entita);
      const unita = stato.attributes?.unit_of_measurement
        ? ` ${stato.attributes.unit_of_measurement}`
        : "";
      const valore = `${stato.state}${unita}`;
      const da = perQuanto(Math.max(ora - traccia.dal, serve || MINUTO));
      const scritto = String(regola.testo || "").trim();
      const testoIt = regola.conValore !== false ? `${valore} da ${da} · ${nome}` : nome;
      const testoEn = regola.conValore !== false ? `${valore} for ${da} · ${nome}` : nome;
      this._dici({
        tipo: "personalizzata",
        urgenza: URGENZE.includes(regola.urgenza) ? regola.urgenza : "normale",
        chiave: `personalizzata:${regola.id}`,
        /* Il «non ripetere» lo tiene gia' la regola: il conto dei telefoni
         * non deve fermarne una seconda prima del tempo. */
        pausa: Math.max(0, ripeti - MINUTO),
        entita: regola.entita,
        solo: Array.isArray(regola.chi) ? regola.chi : [],
        parole: {
          it: { titolo: regola.titolo, testo: scritto ? `${scritto} · ${testoIt}` : testoIt },
          en: { titolo: regola.titolo, testo: scritto ? `${scritto} · ${testoEn}` : testoEn },
        },
      });
    }
  }
}

/* Se lo stato rispetta la condizione di una notifica personalizzata. I
 * numeri si confrontano come numeri, il resto come testo. */
export function condizioneVera(regola, stato) {
  const scritto = String(regola?.valore ?? "").trim();
  const n = numero(stato);
  const soglia = numero(scritto);
  switch (regola?.condizione) {
    case "sopra":
      return n !== null && soglia !== null && n > soglia;
    case "sotto":
      return n !== null && soglia !== null && n < soglia;
    case "uguale":
      return n !== null && soglia !== null ? n === soglia : String(stato) === scritto;
    case "diverso":
      return n !== null && soglia !== null ? n !== soglia : String(stato) !== scritto;
    default:
      return false;
  }
}
