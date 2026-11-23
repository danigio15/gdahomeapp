/* Il filo dell'orologio verso la casa, attraverso il centralino.
 *
 * Il servizio di fianco ha `fetch` e basta: il filo lo tiene il centralino,
 * allo sportello del polso (`centralino/src/polso.js`). Qui ci sono le due
 * cose che fa l'orologio:
 *
 *  - **abbinarsi** (`abbina`): la stessa stretta di mano dell'app
 *    (`abbina: 2`, col codice dentro la chiave e col legame), la conferma con
 *    `polso: "zepp"`, e dalla casa arrivano la chiave del filo, il suo nome
 *    per la casa e dove tornare. Il codice non si tiene;
 *  - **chiedere** (`IlFilo`): la stretta di mano con la chiave del filo, e
 *    poi le domande — la fotografia, un comando — una busta per volta, nella
 *    stessa sessione finche' il centralino la tiene. Se la sessione e' finita
 *    se ne apre un'altra, una volta.
 *
 * Non c'e' niente di Zepp qui dentro: `posta` porta una richiesta al
 * centralino e `caso` da' i byte a caso. Cosi' lo stesso codice gira
 * nell'app Zepp e nelle prove, contro il ponte e il centralino veri.
 */

import { sha256 } from "@noble/hashes/sha2.js";

import {
  Busta,
  chiaveDiSessione,
  codicePulito,
  coppiaEffimera,
  improntaDellaStretta,
  inBase64,
  inByte,
  VERSIONE,
  VERSIONE_DEL_LEGAME,
  VERSIONE_DELL_ABBINAMENTO,
} from "./cifra.js";

/* Il centralino di sempre: lo stesso dell'app (`centralinoDiDifettoScritto`),
 * con `https` al posto di `wss`. Dopo l'abbinamento vale quello che dice la
 * casa. */
export const CENTRALINO_DI_DIFETTO = "https://tramite.gdahome.org";

export const POLSO_ZEPP = "zepp";

/* Un no detto a parole, per chi guarda l'orologio. `staccato` vuol dire che
 * la chiave non vale piu': si ricollega col codice. */
export class FiloRotto extends Error {
  constructor(testo, { staccato = false } = {}) {
    super(testo);
    this.staccato = staccato;
  }
}

export function inHttp(indirizzo) {
  const scritto = String(indirizzo || "")
    .trim()
    .replace(/\/+$/, "");
  if (!scritto) return CENTRALINO_DI_DIFETTO;
  return scritto.replace(/^ws(s?):\/\//, "http$1://");
}

const esadecimale = (byte) => Array.from(byte, (b) => b.toString(16).padStart(2, "0")).join("");

/* Le parole della casa e del centralino, come le legge chi ha l'orologio. */
function aParole({ codice, motivo = "" } = {}, ripiego = "La casa non risponde") {
  const perche = String(motivo || "");
  if (codice === 4402 || perche === "premium-richiesto")
    return new FiloRotto("Fuori casa serve GdAHome Premium");
  if (codice === 4426 || perche === "aggiorna-add-on")
    return new FiloRotto("Aggiorna GdAHome in Home Assistant");
  if (perche === "casa non collegata")
    return new FiloRotto("La casa non è collegata in questo momento");
  if (perche === "nessun abbinamento in corso" || perche === "nessuno")
    return new FiloRotto("Il codice è scaduto: generane uno nuovo");
  if (perche === "codice") return new FiloRotto("Il codice non è giusto: ricontrollalo");
  if (perche === "tentativi") return new FiloRotto("Troppi tentativi: riprova fra un quarto d'ora");
  if (perche === "telefoni") return new FiloRotto("La casa ha già tutti i telefoni che può avere");
  if (perche === "staccato" || perche === "riabbina")
    return new FiloRotto("Questo orologio è stato staccato: ricollegalo col codice", {
      staccato: true,
    });
  return new FiloRotto(ripiego);
}

async function aLaPosta(posta, url, corpo) {
  let risposta;
  try {
    risposta = await posta(url, corpo);
  } catch (_errore) {
    throw new FiloRotto("Il telefono non raggiunge la casa: c'è internet?");
  }
  const { stato, corpo: detto } = risposta || {};
  if (stato === 429 || stato === 503) throw new FiloRotto("Troppe richieste: riprova fra poco");
  if (stato === 410) return { finita: true };
  if (stato !== 200 || !detto || typeof detto !== "object")
    throw new FiloRotto("Il centralino non risponde");
  return { s: detto.s, m: Array.isArray(detto.m) ? detto.m : [], fine: detto.fine || null };
}

/* La prima parola dell'orologio, e la chiave che ne viene. */
function laStretta({ caso, chi = null, abbinamento = false }) {
  const mia = coppiaEffimera(caso);
  const apertura = caso(16);
  const ciao = JSON.stringify({
    v: VERSIONE,
    ...(abbinamento ? { abbina: VERSIONE_DELL_ABBINAMENTO } : { chi }),
    apertura: inBase64(apertura),
    mia: inBase64(mia.pubblica),
    lega: VERSIONE_DEL_LEGAME,
    polso: POLSO_ZEPP,
  });
  return { mia, apertura, ciao };
}

function ilPronto(risposta) {
  const riga = risposta.m.find((una) => una.startsWith("{"));
  if (!riga) throw aParole(risposta.fine || {});
  const pronto = JSON.parse(riga);
  if (pronto.no)
    throw aParole({ motivo: pronto.riabbina ? "riabbina" : pronto.motivo }, String(pronto.no));
  if (pronto.pronto !== true || typeof pronto.mia !== "string")
    throw new FiloRotto("La casa ha risposto storto");
  return { riga, pronto };
}

/**
 * L'abbinamento col codice. Torna il legame da tenere: chi e' l'orologio per
 * la casa, la chiave del filo, la casa e il centralino.
 */
export async function abbina({
  codice,
  centralino = CENTRALINO_DI_DIFETTO,
  posta,
  caso,
  nome = "Amazfit",
  modello = "",
}) {
  const pulito = codicePulito(codice);
  if (pulito.length !== 16)
    throw new FiloRotto("Il codice ha sedici lettere e numeri: ricontrollalo");
  const url = `${inHttp(centralino)}/polso/abbinamento/${esadecimale(sha256(inByte(pulito)))}`;
  const { mia, apertura, ciao } = laStretta({ caso, abbinamento: true });

  const prima = await aLaPosta(posta, url, { m: [ciao] });
  if (prima.finita) throw new FiloRotto("Il centralino non risponde");
  const { riga, pronto } = ilPronto(prima);
  const legata = pronto.lega === VERSIONE_DEL_LEGAME;
  const busta = new Busta(
    chiaveDiSessione({
      miaSegreta: mia.segreta,
      suaPubblica: pronto.mia,
      delTelefono: mia.pubblica,
      dellaCasa: pronto.mia,
      apertura,
      codice: pulito,
      stretta: legata ? improntaDellaStretta(ciao, riga) : null,
    }),
  );
  const conferma = busta.chiudi(
    JSON.stringify({
      t: "conferma",
      telefono: inBase64(mia.pubblica),
      casa: pronto.mia,
      nome,
      sistema: POLSO_ZEPP,
      ...(modello ? { modello } : {}),
      polso: POLSO_ZEPP,
    }),
  );
  const dopo = await aLaPosta(posta, url, { s: prima.s, m: [conferma] });
  if (dopo.finita) throw new FiloRotto("Il centralino non risponde");
  for (const una of dopo.m) {
    if (una.startsWith("{")) {
      const no = JSON.parse(una);
      throw aParole({ motivo: no.motivo }, String(no.no || "La casa ha detto di no"));
    }
    const detto = JSON.parse(busta.apri(una));
    if (detto.t === "no")
      throw aParole({ motivo: detto.motivo }, String(detto.perche || "La casa ha detto di no"));
    if (detto.t === "ecco" && typeof detto.chiave === "string" && detto.dispositivo?.id) {
      return {
        id: detto.dispositivo.id,
        chiave: detto.chiave,
        casa: String(detto.ritorno?.casa || ""),
        centralino: inHttp(detto.ritorno?.centralino || centralino),
      };
    }
  }
  throw aParole(dopo.fine || {}, "La casa non ha risposto in tempo");
}

/* ─── Le domande di tutti i giorni ───────────────────────────────────────── */

export class IlFilo {
  constructor({ legame, posta, caso }) {
    this.legame = legame;
    this.posta = posta;
    this.caso = caso;
    this.sessione = null;
    this.busta = null;
    this.n = 0;
    this._inFila = Promise.resolve();
  }

  get _url() {
    return `${inHttp(this.legame.centralino)}/polso/telefono/${this.legame.casa}`;
  }

  async _entra() {
    const { mia, apertura, ciao } = laStretta({ caso: this.caso, chi: this.legame.id });
    const risposta = await aLaPosta(this.posta, this._url, { m: [ciao] });
    if (risposta.finita) throw new FiloRotto("Il centralino non risponde");
    const { riga, pronto } = ilPronto(risposta);
    const legata = pronto.lega === VERSIONE_DEL_LEGAME;
    this.busta = new Busta(
      chiaveDiSessione({
        miaSegreta: mia.segreta,
        suaPubblica: pronto.mia,
        delTelefono: mia.pubblica,
        dellaCasa: pronto.mia,
        apertura,
        chiaveDelFilo: this.legame.chiave,
        stretta: legata ? improntaDellaStretta(ciao, riga) : null,
      }),
    );
    this.sessione = risposta.s;
    /* La casa puo' aver detto qualcosa insieme al pronto: un orologio
     * staccato si sente dire `auth_invalid` nella prima busta. */
    for (const una of risposta.m) if (!una.startsWith("{")) this._leggi(una);
  }

  _leggi(una) {
    const detto = JSON.parse(this.busta.apri(una));
    if (detto?.type === "auth_invalid") {
      this.sessione = null;
      throw aParole({ motivo: "staccato" });
    }
    return detto;
  }

  /** Una domanda alla casa; una alla volta, nell'ordine in cui arrivano. */
  chiedi(domanda) {
    const giro = this._inFila.then(() => this._chiedi(domanda, true));
    this._inFila = giro.catch(() => {});
    return giro;
  }

  async _chiedi(domanda, ancoraUnaVolta) {
    if (!this.sessione) await this._entra();
    this.n += 1;
    const n = this.n;
    const busta = this.busta.chiudi(JSON.stringify({ ...domanda, n }));
    const risposta = await aLaPosta(this.posta, this._url, { s: this.sessione, m: [busta] });
    if (risposta.finita) {
      this.sessione = null;
      if (ancoraUnaVolta) return this._chiedi(domanda, false);
      throw new FiloRotto("Il centralino non risponde");
    }
    let trovata = null;
    for (const una of risposta.m) {
      if (una.startsWith("{")) continue;
      const detto = this._leggi(una);
      if (detto?.n === n) trovata = detto;
    }
    if (risposta.fine) {
      this.sessione = null;
      if (!trovata) {
        const no = aParole(risposta.fine);
        if (no.staccato || !ancoraUnaVolta) throw no;
        return this._chiedi(domanda, false);
      }
    }
    if (!trovata) throw new FiloRotto("La casa non ha risposto in tempo");
    return trovata;
  }
}
