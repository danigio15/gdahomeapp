/* Capire la casa: cosa sono le cose, e cosa e' normale per questa casa.
 *
 * «Se c'e' un acquario in casa e ha la luce accesa non mi puo' dire che la
 * luce e' accesa, la spengo? Quella e' cosi' e tale resta.» Le regole della
 * sentinella guardavano lo stato e basta: una luce accesa con la casa vuota
 * era una luce dimenticata. Qui si guarda anche cosa e', e come va di solito.
 *
 * Tre modi di sapere che una cosa va lasciata stare, dal piu' sicuro:
 *
 *   1. **L'ha detto chi abita la casa**: il tasto «Restano così» sotto la
 *      notifica, o «Va bene stanotte» per una porta. Il primo vale per
 *      sempre, il secondo fino al mattino (o finche' la porta si chiude).
 *   2. **Dal nome**: una luce dell'acquario o del terrario, una notturna,
 *      quelle del giardino; una presa del frigo, del server, del router.
 *      Una porta interna, di notte con la gente in casa, non e' un pericolo.
 *   3. **Dalle abitudini delle ultime due settimane**: una luce che e' accesa
 *      con la casa vuota quasi tutti i giorni e' a orario, non dimenticata;
 *      una porta aperta quasi tutte le notti e' cosi' per scelta. Si impara
 *      da soli, senza che nessuno debba dire niente.
 *
 * Il modulo non manda niente e non legge Home Assistant: la sentinella gli
 * dice cosa vede, e lui ricorda. Quello che ricorda sta su disco
 * (`capire-la-casa.json`), e dentro ci sono solo identificativi di entita' e
 * giorni: niente persone, niente posizioni.
 */

import { join } from "node:path";

import { Archivio } from "./archivio.js";

const MINUTO = 60 * 1000;
const GIORNO = 24 * 60 * MINUTO;

/* Quanti giorni si guardano, e quanti ne bastano per dire «di solito». */
export const GIORNI_GUARDATI = 7;
export const GIORNI_DI_SOLITO = 4;
/* Una luce accesa con la casa vuota almeno mezz'ora: un giorno che conta. */
const MINUTI_CHE_CONTANO = 30;
/* Quanto si tiene: due settimane bastano, il resto si butta. */
const GIORNI_TENUTI = 14;

/* I generi riconosciuti dal nome, e cosa vogliono dire. */
const GENERI = Object.freeze([
  [
    "acquario",
    /acquari|aquari|vasca\s*pesci|fish\s*tank|fluval|juwel|eheim|tetra|aquael|chihiros|aquasky/i,
  ],
  ["terrario", /terrari|rettil|paludari|vivari/i],
  [
    "notte",
    /notturn|night\s*light|luce\s*(di\s*)?(cortesia|notte)|segnapasso|veilleuse|nachtlicht|nocturn|\bnotte\b/i,
  ],
  [
    "esterno",
    /giardin|esterno|esterne|esterni|outdoor|garden|jard|garten|au(ss|ß)en|exterior|ext[eé]rieur|terrasse|vialett|cortil|terrazz|balcon|portico|facciat|crepuscol/i,
  ],
  [
    "sempre",
    /frig|freezer|congelator|k[uü]hlschrank|gefrier|r[eé]frig[eé]rateur|nevera|server|router|modem|\bnas\b|switch\s*di\s*rete|firewall|pompa\s*(acquario|pozzo)|allarm|centralin|caldaia|boiler/i,
  ],
]);

/** Le cose che non si propongono mai di spegnere, e perche'. */
export const GENERI_DA_LASCIARE = Object.freeze({
  acquario: { it: "è dell'acquario", en: "belongs to the aquarium" },
  terrario: { it: "è del terrario", en: "belongs to the terrarium" },
  notte: { it: "è una luce notturna", en: "is a night light" },
  esterno: { it: "è fuori casa", en: "is outdoors" },
  sempre: { it: "deve restare accesa", en: "must stay on" },
});

/* Le stanze che non danno mai fuori. La cucina, la sala, la lavanderia
 * spesso si': una porta li' si tratta come una che da' fuori. */
const PORTA_INTERNA =
  /bagno|camer|studio|ripostigl|cabina|armadi|corridoi|bathroom|bedroom|closet|hallway/i;
const PORTA_ESTERNA =
  /ingress|entrat|portone|blindat|esterna|garage|box|basculant|giardin|terrazz|balcon|cancell|front|back\s*door|cortil/i;
/* «Porta/Finestra» e' il nome del sensore, non di cosa apre. */
const IL_SENSORE = /porta[\s_]*\/?[\s_]*finestra|door[\s_]*\/?[\s_]*window/gi;

/** Il genere di una cosa dal suo id e dal suo nome, o `null`. */
export function genereDi(id, nome = "") {
  const testo = `${String(id || "").replace(/[._]/g, " ")} ${nome || ""}`;
  for (const [genere, segno] of GENERI) if (segno.test(testo)) return genere;
  return null;
}

/**
 * Se una porta (o finestra) e' interna: di notte, con la gente in casa, una
 * porta interna aperta non e' niente. Nel dubbio non lo e': una porta che
 * non si sa dove sia si tratta come una che da' fuori.
 */
export function eInterna(id, nome = "", classe = "") {
  const testo = `${String(id || "").replace(/[._]/g, " ")} ${nome || ""}`.replace(IL_SENSORE, " ");
  if (/\bintern[ao]\b/i.test(testo)) return true;
  if (classe === "window" || classe === "garage_door" || /finestr|window/i.test(testo))
    return false;
  if (PORTA_ESTERNA.test(testo)) return false;
  return PORTA_INTERNA.test(testo);
}

/*
 * Il nome come lo dice una persona. Home Assistant mette insieme il nome del
 * dispositivo e quello dell'entita': «Sensore Porta/Finestra Cucina Porta».
 * Restano la stanza e il nome: «Cucina». Se togliendo non resta niente, si
 * tiene il nome di prima.
 */
const PAROLE_DA_TOGLIERE =
  /\b(sensore|sensor|contatto|contact|rilevatore|detector|stato|status|apertura|opening)\b|\bporta\s*\/\s*finestra\b|\bdoor\s*\/\s*window\b/gi;
export function nomePulito(nome = "") {
  const intero = String(nome || "").trim();
  let pulito = intero.replace(PAROLE_DA_TOGLIERE, " ");
  /* La parola che dice cos'e' («porta», «finestra») la dice gia' la frase. */
  pulito = pulito.replace(/\b(porta|finestra|door|window)\b\s*$/i, " ");
  pulito = pulito
    .replace(/[/·\-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!pulito) return intero;
  return pulito.charAt(0).toUpperCase() + pulito.slice(1);
}

/** Cos'e' un'apertura, per dirlo: «porta», «finestra» o «apertura». */
export function cosaApre(id, nome = "", classe = "") {
  if (classe === "window") return { it: "finestra", en: "window" };
  if (classe === "garage_door" || classe === "garage")
    return { it: "porta del garage", en: "garage door" };
  if (classe === "door" || classe === "gate") return { it: "porta", en: "door" };
  const testo = `${String(id || "").replace(/[._]/g, " ")} ${nome || ""}`.replace(IL_SENSORE, " ");
  if (/finestr|window/i.test(testo)) return { it: "finestra", en: "window" };
  if (/garage|basculant|\bbox\b/i.test(testo)) return { it: "porta del garage", en: "garage door" };
  if (/port|door/i.test(testo)) return { it: "porta", en: "door" };
  return { it: "apertura", en: "opening" };
}

/** Il giorno (di casa) di un istante: `2026-10-15`. La notte conta col giorno in cui comincia. */
export function giornoDi(ms, { notte = false } = {}) {
  const d = new Date(notte ? ms - 6 * 60 * MINUTO : ms);
  const due = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`;
}

/* Il prossimo mattino alle otto, da un istante. */
function prossimoMattino(ms) {
  const d = new Date(ms);
  d.setHours(8, 0, 0, 0);
  if (d.getTime() <= ms) d.setDate(d.getDate() + 1);
  return d.getTime();
}

const voce = (dato) => (dato && typeof dato === "object" && !Array.isArray(dato) ? dato : {});

export class CapireLaCasa {
  constructor({ cartella = "/data", adesso = () => Date.now(), memoria = null } = {}) {
    this.adesso = adesso;
    /* Le prove passano una memoria in mano, senza disco. */
    this.archivio = memoria
      ? { dati: memoria, salva() {} }
      : new Archivio(join(cartella, "capire-la-casa.json"), {});
    const d = this.archivio.dati;
    d.resta = voce(d.resta);
    d.silenzio = voce(d.silenzio);
    d.luci = voce(d.luci);
    d.porte = voce(d.porte);
    /* Quello che Home Assistant sa gia' di ogni cosa: l'area, la marca e il
     * modello del dispositivo (`descrivi`), e le luci che accende o spegne
     * un'automazione a orario (`automatiche`). Non si scrive: si rilegge. */
    this.descrizioni = {};
    this.automatiche = new Set();
    this._sporco = false;
  }

  get dati() {
    return this.archivio.dati;
  }

  _salva() {
    this._sporco = true;
  }

  /** Scrive su disco quello che e' cambiato: lo chiama la sentinella al battito. */
  scrivi() {
    if (!this._sporco) return;
    this._sporco = false;
    try {
      this.archivio.salva?.();
    } catch {
      /* Un disco che non scrive non ferma le notifiche. */
    }
  }

  /* ─── Quello che ha detto chi abita la casa ────────────────────────── */

  /** «Restano così»: queste cose non si propongono piu'. */
  resta(entita = []) {
    for (const id of [].concat(entita)) {
      if (typeof id === "string" && id.includes(".")) this.dati.resta[id] = this.adesso();
    }
    this._salva();
  }

  /** Torna a proporla (dal config). */
  nonRestaPiu(id) {
    delete this.dati.resta[id];
    this._salva();
  }

  /** «Va bene stanotte»: zitta fino al mattino, o finche' si chiude. */
  vaBeneStanotte(id) {
    if (typeof id !== "string" || !id.includes(".")) return;
    this.dati.silenzio[id] = prossimoMattino(this.adesso());
    this._salva();
  }

  /** Una porta che si chiude dimentica il suo «va bene». */
  chiusa(id) {
    if (this.dati.silenzio[id] === undefined) return;
    delete this.dati.silenzio[id];
    this._salva();
  }

  /* ─── Le abitudini ─────────────────────────────────────────────────── */

  /** Mezzo minuto di luce accesa con la casa vuota: lo dice il battito. */
  luceAccesaConLaCasaVuota(id, minuti, ora = this.adesso()) {
    const giorni = voce(this.dati.luci[id]);
    const oggi = giornoDi(ora);
    giorni[oggi] = Math.round(((giorni[oggi] || 0) + minuti) * 10) / 10;
    this.dati.luci[id] = giorni;
    this._salva();
  }

  /** Com'era una porta nella notte, con la casa che dorme. */
  portaDiNotte(id, aperta, ora = this.adesso()) {
    const notti = voce(this.dati.porte[id]);
    const stanotte = giornoDi(ora, { notte: true });
    /* Basta averla vista aperta una volta, in una notte, per dirla aperta. */
    if (notti[stanotte] === true) return;
    if (notti[stanotte] === aperta) return;
    notti[stanotte] = aperta || notti[stanotte] === true;
    this.dati.porte[id] = notti;
    this._salva();
  }

  _ultimiGiorni(ora, { notte = false } = {}) {
    const giorni = [];
    for (let i = 1; i <= GIORNI_GUARDATI; i += 1)
      giorni.push(giornoDi(ora - i * GIORNO, { notte }));
    return giorni;
  }

  /** Se una luce e' accesa con la casa vuota quasi tutti i giorni: a orario. */
  luceAbituale(id, ora = this.adesso()) {
    const giorni = voce(this.dati.luci[id]);
    const quanti = this._ultimiGiorni(ora).filter(
      (g) => (giorni[g] || 0) >= MINUTI_CHE_CONTANO,
    ).length;
    return quanti >= GIORNI_DI_SOLITO;
  }

  /** Se una porta e' aperta quasi tutte le notti: cosi' per scelta. */
  portaAbituale(id, ora = this.adesso()) {
    const notti = voce(this.dati.porte[id]);
    const quante = this._ultimiGiorni(ora, { notte: true }).filter((g) => notti[g] === true).length;
    return quante >= GIORNI_DI_SOLITO;
  }

  /* ─── La risposta ──────────────────────────────────────────────────── */

  /**
   * Se una cosa va lasciata stare, e perche': `{ perche }` o `null`.
   *
   * `tipo` e' «luce» o «porta»: il nome dice cose diverse per le due.
   */
  lasciaStare(id, nome = "", { tipo = "luce", ora = this.adesso() } = {}) {
    if (this.dati.resta[id] !== undefined) return { perche: "detto" };
    const fino = this.dati.silenzio[id];
    if (Number.isFinite(fino)) {
      if (fino > ora) return { perche: "stanotte" };
      delete this.dati.silenzio[id];
      this._salva();
    }
    if (tipo === "luce") {
      const genere = genereDi(id, `${nome} ${this.descrizioni[id] || ""}`);
      if (genere) return { perche: genere };
      if (this.automatiche.has(id)) return { perche: "automazione" };
      if (this.luceAbituale(id, ora)) return { perche: "abitudine" };
    } else if (this.portaAbituale(id, ora)) {
      return { perche: "abitudine" };
    }
    return null;
  }

  /**
   * Quello che Home Assistant sa delle cose: `{ id: "area · marca · modello" }`.
   * Una luce nell'area «Giardino» e' esterna, una porta nell'area «Bagno» e'
   * interna, una presa di un controller per acquari e' dell'acquario.
   */
  descrivi(descrizioni = {}) {
    this.descrizioni = descrizioni && typeof descrizioni === "object" ? descrizioni : {};
  }

  /** Le luci (e le prese) che un'automazione a orario accende o spegne da se'. */
  gestiteDaAutomazioni(entita = []) {
    this.automatiche = new Set([].concat(entita).filter((id) => typeof id === "string"));
  }

  /** Se una porta e' interna: dal nome, o dall'area dove sta. */
  portaInterna(id, nome = "", classe = "") {
    const area = this.descrizioni[id] || "";
    return eInterna(id, `${nome} ${area}`, classe);
  }

  /** Butta i giorni vecchi: lo chiama la sentinella una volta ogni tanto. */
  pota(ora = this.adesso()) {
    const limite = giornoDi(ora - GIORNI_TENUTI * GIORNO);
    for (const gruppo of [this.dati.luci, this.dati.porte]) {
      for (const [id, giorni] of Object.entries(gruppo)) {
        for (const g of Object.keys(voce(giorni))) if (g < limite) delete giorni[g];
        if (!Object.keys(voce(giorni)).length) delete gruppo[id];
      }
    }
    this._salva();
  }

  /** Quello che la casa ha capito, per il config («Cosa c'è in casa»). */
  elenco(stati = new Map(), nomeDi = (id) => id, ora = this.adesso()) {
    const fuori = [];
    for (const [id, stato] of stati) {
      const dominio = id.split(".")[0];
      if (!["light", "switch", "binary_sensor", "cover"].includes(dominio)) continue;
      const nome = nomeDi(stato, id);
      const porta = dominio === "binary_sensor" || dominio === "cover";
      if (
        porta &&
        !["door", "window", "garage_door", "opening", "garage", "gate"].includes(
          stato.attributes?.device_class,
        )
      )
        continue;
      const lascia = this.lasciaStare(id, nome, { tipo: porta ? "porta" : "luce", ora });
      const genere = porta
        ? eInterna(id, nome, stato.attributes?.device_class)
          ? "interna"
          : null
        : genereDi(id, nome);
      if (!lascia && !genere && dominio === "switch") continue;
      fuori.push({ entita: id, nome, genere, perche: lascia?.perche || null });
    }
    return fuori.slice(0, 200);
  }
}
