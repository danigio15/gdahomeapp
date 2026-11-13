/* Le case, una per riga: la licenza e i telefoni. Per la Gestione.
 *
 * «Troppi telefoni abbinati e poche licenze: vorrei capire per ogni casa
 * premium quanti telefoni sono abbinati e quanti hanno il base.» La sezione
 * «Versioni dell'app» conta i telefoni visti nella settimana, sommati: dice
 * quale app hanno, non di quale casa sono ne' se la casa e' Premium. Qui si
 * mettono insieme, casa per casa, le due cose che il quadro sa gia':
 *
 *   - la **licenza**, dalle licenze (`Licenze.perLeCase`): ogni casa che ha
 *     chiesto i suoi gettoni almeno una volta, e ogni casa con una licenza.
 *     Premium con da dove viene — acquisto, prova gratuita, acquisto di prova
 *     (sandbox), regalo, codice regalo, installatore — o Base. «Sconosciuta»
 *     per una casa che il quadro conosce solo dal rapporto e che le licenze
 *     non le ha mai chieste (un add-on di prima, o mai arrivato al quadro);
 *   - i **telefoni**, dal rapporto della casa (`telefoni` in
 *     `ponte/src/rapporto.js`): abbinati, di cui della casa di prova, visti
 *     nella settimana, quanti se ne possono abbinare e la licenza come la vede
 *     la casa (gli ultimi tre dagli add-on dopo la 1.19.0). Il rapporto parte
 *     spento: delle case che non lo mandano i telefoni **non si sanno**, e si
 *     dice cosi' — mai zero. Il tramite i telefoni li sa da tutte le case, ma
 *     li dice solo sommati, e cosi' resta (`docs/PRIVACY.md`).
 *
 * L'ultimo contatto e' il piu' recente fra l'ultimo rapporto e l'ultima
 * domanda di licenze (quella si scrive al piu' una volta l'ora).
 *
 * Il riepilogo conta le case Premium, le Base, quelle sconosciute, e le Base
 * con piu' di [TELEFONI_CON_BASE] telefoni di casa: fino all'add-on che stacca
 * quelli di troppo erano normali — i telefoni abbinati prima del limite
 * restavano — e adesso sono una casa da guardare.
 */

/** I telefoni di una casa con gdahome Base. Lo stesso numero del ponte
 * (`TELEFONI_CON_BASE`, `ponte/src/licenze.js`). */
export const TELEFONI_CON_BASE = 2;

/** Quante righe al piu': il resto si conta nel riepilogo. */
export const RIGHE_AL_MASSIMO = 500;

const intero = (detto) => (Number.isSafeInteger(detto) && detto >= 0 ? detto : null);

const quando = (detto) => {
  const il = typeof detto === "number" ? detto : Date.parse(detto ?? "");
  return Number.isFinite(il) && il > 0 ? il : null;
};

/** Da dove viene una licenza gdahome che vale, in una parola. */
export function daDove(gdahome) {
  if (!gdahome) return null;
  if (gdahome.origine === "negozio") {
    if (gdahome.sandbox) return "sandbox";
    if (gdahome.prova) return "prova";
    return "acquisto";
  }
  if (gdahome.origine === "installatore") return "installatore";
  if (gdahome.origine === "regalo") return gdahome.codice ? "codice" : "regalo";
  return "altro";
}

/* I telefoni di una casa, dalla sua carta: `null` se il rapporto non li
 * dice. */
function iTelefoniDi(carta) {
  const t = carta?.telefoni;
  if (!t || typeof t !== "object") return null;
  const abbinati = intero(t.abbinati);
  if (abbinati === null) return null;
  const diProva = intero(t.diProva);
  return {
    abbinati,
    diProva,
    visti7gg: intero(t.visti7gg),
    /* `undefined`: non lo dice. `null`: senza limite. */
    massimi: "massimi" in t ? (t.massimi === null ? null : intero(t.massimi)) : undefined,
    licenza: ["premium", "base", "spente"].includes(t.licenza) ? t.licenza : null,
  };
}

/**
 * Le case, dalla carta del quadro (`Case.elenco(TUTTE)`) e dalle licenze
 * (`Licenze.perLeCase()`).
 *
 * Torna `{ case, riepilogo }`. Ogni casa: `casa`, `corto` (otto cifre della
 * matricola), `nome` (quello scritto dall'installatore, o vuoto), `licenza`
 * («premium», «base», «sconosciuta»), `origine` (vedi [daDove]), `scade`,
 * `telefoni` (vedi `iTelefoniDi`, o `null`), `ponte` (la versione
 * dell'add-on, dal rapporto), `rapportoIl`, `licenzeIl`, `ultimo`, e `oltre`
 * vero per una Base con piu' telefoni del dovuto.
 */
export function iTelefoniPerCasa(tutte = [], perLicenze = [], adesso = Date.now()) {
  const righe = new Map();
  const di = (casa) => {
    if (!righe.has(casa))
      righe.set(casa, {
        casa,
        corto: String(casa).slice(5, 13),
        nome: "",
        licenza: "sconosciuta",
        origine: null,
        scade: null,
        telefoni: null,
        ponte: "",
        rapportoIl: null,
        licenzeIl: null,
      });
    return righe.get(casa);
  };
  for (const una of Array.isArray(tutte) ? tutte : []) {
    if (typeof una?.casa !== "string" || !una.casa.startsWith("casa_")) continue;
    const riga = di(una.casa);
    riga.nome = una.senzaNome ? "" : String(una.nome || "").slice(0, 120);
    riga.telefoni = iTelefoniDi(una.carta);
    riga.ponte = typeof una.carta?.ponte === "string" ? una.carta.ponte.slice(0, 40) : "";
    riga.rapportoIl = quando(una.vistaIl);
  }
  for (const una of Array.isArray(perLicenze) ? perLicenze : []) {
    if (typeof una?.casa !== "string" || !una.casa.startsWith("casa_")) continue;
    const riga = di(una.casa);
    riga.licenzeIl = quando(una.chiesto);
    if (una.gdahome) {
      riga.licenza = "premium";
      riga.origine = daDove(una.gdahome);
      riga.scade = typeof una.gdahome.scade === "number" ? una.gdahome.scade : null;
    } else if (una.chiesto || una.finite > 0) {
      riga.licenza = "base";
    }
  }

  const tutteLeRighe = [...righe.values()].map((riga) => {
    const ultimo = Math.max(riga.rapportoIl ?? 0, riga.licenzeIl ?? 0) || null;
    /* Base, secondo il quadro o secondo la casa: tutte e due vogliono dire
     * «due telefoni». */
    const base =
      riga.licenza === "base" ||
      (riga.licenza === "sconosciuta" && riga.telefoni?.licenza === "base");
    const oltre = base && riga.telefoni !== null && riga.telefoni.abbinati > TELEFONI_CON_BASE;
    return {
      ...riga,
      ultimo,
      /* Un rapporto vecchio di piu' di una settimana: i suoi numeri sono di
       * allora. */
      telefoniVecchi: riga.rapportoIl !== null && adesso - riga.rapportoIl > 7 * 24 * 3600 * 1000,
      oltre,
    };
  });

  const peso = (riga) =>
    riga.oltre ? 0 : riga.licenza === "premium" ? 1 : riga.licenza === "base" ? 2 : 3;
  tutteLeRighe.sort(
    (una, altra) =>
      peso(una) - peso(altra) ||
      (altra.telefoni?.abbinati ?? -1) - (una.telefoni?.abbinati ?? -1) ||
      (altra.ultimo ?? 0) - (una.ultimo ?? 0) ||
      una.casa.localeCompare(altra.casa),
  );

  const premium = tutteLeRighe.filter((riga) => riga.licenza === "premium");
  const base = tutteLeRighe.filter((riga) => riga.licenza === "base");
  const somma = (quali, campo) =>
    quali.reduce((tot, riga) => tot + (riga.telefoni?.[campo] ?? 0), 0);
  const conTelefoni = (quali) => quali.filter((riga) => riga.telefoni !== null);
  const origini = {};
  for (const riga of premium) origini[riga.origine] = (origini[riga.origine] || 0) + 1;
  return {
    case: tutteLeRighe.slice(0, RIGHE_AL_MASSIMO),
    riepilogo: {
      tutte: tutteLeRighe.length,
      premium: premium.length,
      base: base.length,
      sconosciute: tutteLeRighe.length - premium.length - base.length,
      baseOltre: tutteLeRighe.filter((riga) => riga.oltre).length,
      /* Di quante case si sanno i telefoni (col rapporto), e quanti sono. */
      premiumConTelefoni: conTelefoni(premium).length,
      telefoniPremium: somma(premium, "abbinati"),
      baseConTelefoni: conTelefoni(base).length,
      telefoniBase: somma(base, "abbinati"),
      origini,
      tagliate: Math.max(0, tutteLeRighe.length - RIGHE_AL_MASSIMO),
    },
  };
}
