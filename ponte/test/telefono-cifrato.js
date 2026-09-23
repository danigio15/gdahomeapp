/* Un telefono, dalla parte del telefono.
 *
 * Fa la stretta di mano col portiere e poi parla cifrato. Serve alle prove, ma
 * e' anche la descrizione piu' precisa di quello che dovra' fare l'app: se
 * questo file e il codice Dart divergono, il telefono vero non entra.
 */

import {
  aperturaNuova,
  Busta,
  chiaveDiSessione,
  coppiaEffimera,
  VERSIONE,
  VERSIONE_DELL_ABBINAMENTO,
} from "../src/cifra.js";

/* Tre modi di presentarsi:
 *
 *   - `chi` e `chiave`: un telefono gia' abbinato;
 *   - `codice`: un telefono che si abbina, con la stretta di mano legata al
 *     codice (`abbina: 2`). Dopo `dentro` si manda `conferma(...)`;
 *   - `abbina: true`: l'app di prima, che una casa di adesso rifiuta. */
export function telefonoCifrato(
  indirizzo,
  { chi = null, chiave = null, codice = null, abbina = false, gzip = false } = {},
) {
  const presa = new WebSocket(indirizzo);
  const mia = coppiaEffimera();
  const apertura = aperturaNuova();

  const detti = [];
  const inChiaro = [];
  let busta = null;
  /* Le buste grandi arrivano a pezzi: uno che comincia con `|` non e' finito.
   * L'app vera fa la stessa cosa, ed e' scritto in `portiere.js`. */
  let pezzi = "";
  let laStretta = null;
  let guasta = null;
  let sua = null;

  const dentro = new Promise((riuscito, fallito) => {
    laStretta = { riuscito, fallito };
  });

  presa.addEventListener("open", () => {
    presa.send(
      JSON.stringify({
        v: VERSIONE,
        ...(codice != null
          ? { abbina: VERSIONE_DELL_ABBINAMENTO }
          : abbina
            ? { abbina: true }
            : { chi }),
        apertura: apertura.toString("base64"),
        mia: mia.pubblica.toString("base64"),
        /* Un telefono che sa aprire il gzip lo dice; uno vecchio no. */
        ...(gzip ? { gzip: true } : {}),
      }),
    );
  });

  let quantiTelai = 0;
  let quantiCaratteri = 0;
  presa.addEventListener("message", (evento) => {
    quantiTelai += 1;
    const testo = typeof evento.data === "string" ? evento.data : String(evento.data);
    quantiCaratteri += testo.length;
    if (!busta) {
      const detto = JSON.parse(testo);
      inChiaro.push(detto);
      if (detto.no) {
        laStretta.fallito(new Error(detto.no));
        return;
      }
      sua = detto.mia;
      busta = new Busta(
        chiaveDiSessione({
          miaPrivata: mia.privata,
          suaPubblica: detto.mia,
          delTelefono: mia.pubblica,
          dellaCasa: Buffer.from(detto.mia, "base64"),
          apertura,
          ...(codice != null ? { codice } : { chiaveDelFilo: chiave }),
        }),
        /* Si comprime verso la casa solo se la casa ha detto di saperlo
         * aprire: e' la stessa regola dell'app vera. */
        { io: "telefono", comprime: gzip && detto.gzip === true },
      );
      laStretta.riuscito();
      return;
    }
    /* Una busta che non si apre e' fatale, ma non e' un'esplosione: si segna
     * e si chiude. Vale come specifica per l'app vera — su un canale che passa
     * da un terzo, un messaggio che non si apre o e' rotto o e' stato toccato,
     * e in tutti e due i casi andare avanti sarebbe peggio che fermarsi. */
    if (testo.startsWith("|")) {
      pezzi += testo.slice(1);
      return;
    }
    /* Una riga in chiaro dopo la stretta: e' il no di un abbinamento con un
     * codice sbagliato, che non si puo' dire in una busta. Una busta non
     * comincia mai con una graffa: in base64 non c'e'. */
    if (testo.startsWith("{")) {
      inChiaro.push(JSON.parse(testo));
      return;
    }
    const intero = pezzi ? pezzi + testo : testo;
    pezzi = "";

    try {
      detti.push(JSON.parse(busta.apri(intero)));
    } catch (errore) {
      guasta = errore;
      try {
        presa.close();
      } catch (_altro) {
        /* Gia' chiusa. */
      }
    }
  });

  const chiusa = new Promise((ok) => presa.addEventListener("close", ok));
  presa.addEventListener("error", () => {
    if (busta) return;
    laStretta.fallito(new Error("il telefono non e' entrato"));
  });

  return {
    presa,
    detti,
    inChiaro,
    dentro,
    chiusa,
    get guasta() {
      return guasta;
    },
    manda: (cosa) => presa.send(busta.chiudi(JSON.stringify(cosa))),
    /* La conferma dell'abbinamento: le due chiavi pubbliche, come le ha viste
     * il telefono, e chi e'. */
    conferma: (altro = {}) =>
      presa.send(
        busta.chiudi(
          JSON.stringify({
            t: "conferma",
            telefono: mia.pubblica.toString("base64"),
            casa: sua,
            ...altro,
          }),
        ),
      ),
    get quantiTelai() {
      return quantiTelai;
    },
    /* Quanto e' passato sul filo, in caratteri: e' quello che la
     * compressione deve far calare. */
    get quantiCaratteri() {
      return quantiCaratteri;
    },
    mandaGrezzo: (testo) => presa.send(testo),
    aspetta: async (quale) => {
      const trova = () =>
        detti.find((uno) =>
          typeof quale === "string" ? uno.type === quale || uno.t === quale : quale(uno),
        );
      await attendi(() => trova() != null);
      return trova();
    },
    chiudi: () => presa.close(),
  };
}

const nuovoGiro = (millesimi = 5) => new Promise((ok) => setTimeout(ok, millesimi));

export async function attendi(condizione, entro = 6000) {
  const fine = Date.now() + entro;
  while (Date.now() < fine) {
    if (condizione()) return;
    await nuovoGiro();
  }
  throw new Error("l'attesa e' scaduta");
}
