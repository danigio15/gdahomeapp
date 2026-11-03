/* Quanti telefoni, e con quale versione dell'app: detto dalle case, contato qui.
 *
 * «Continuo a non vedere le app installate dagli utenti.» Il quadro le
 * versioni dell'app le sapeva solo dal rapporto delle case, e il rapporto
 * parte spento: su 178 case accese ne arrivavano sei telefoni. Il filo verso
 * il tramite invece lo apre ogni casa da sola, e allora la casa dice anche
 * qui — al collegamento e ogni ora — quanti telefoni ha visto nella
 * settimana, per negozio e versione:
 *
 *     casa → centralino   {t: "telefoni", visti7gg, versioni, rapporto}
 *
 * dove `versioni` e' `[{negozio, versione, costruzione, quanti}]`, lo stesso
 * conto che va nel rapporto (`ponte/src/rapporto.js`, `leVersioniDellApp`).
 *
 * ─── Quello che il centralino sa in piu', ed e' tutto qui ────────────────
 *
 * Numeri. Quanti telefoni per «App Store, 1.18.8, 1180800»: niente nomi,
 * niente modelli, niente identificativi dei telefoni o di chi li usa. Li tiene
 * in memoria finche' la casa e' collegata — non vanno su disco — e li dice
 * al quadro solo **sommati su tutte le case** (`/salute`, da dentro, sotto
 * `versioni_app`): da qui
 * non esce mai quale casa ha quali telefoni.
 *
 * `rapporto` vero vuol dire che la stessa casa manda gia' il suo rapporto al
 * quadro di gdahome, dove quei telefoni ci sono gia', casa per casa: qui la si
 * conta fra le case che lo dicono e i suoi telefoni no. Una casa, una fonte.
 *
 * Tutto quello che arriva si controlla stretto, come il resto del filo: una
 * forma sbagliata si butta intera, e un campo che non si conosce si ignora
 * (una casa piu' nuova del centralino puo' dire di piu').
 */

/* I negozi che si contano: App Store, Google Play, e "" per il browser o chi
 * non l'ha detto. */
const NEGOZI = new Set(["apple", "google", ""]);

/* Quante righe di versioni si tengono per casa. Il ponte ne manda al massimo
 * trenta. */
export const VERSIONI_PER_CASA = 30;

/* Quanti telefoni puo' dire una casa: abbinati, non insieme. Una famiglia
 * con i tablet a muro sta molto sotto. */
export const TELEFONI_AL_MASSIMO = 200;

/* Una versione si scrive con cifre, lettere, punti e trattini: «1.18.8»,
 * «1.18.8+1180800», «2.0.0-beta». */
const VERSIONE = /^[0-9A-Za-z.+_-]{0,40}$/;

const interoTra = (valore, minimo, massimo) =>
  Number.isSafeInteger(valore) && valore >= minimo && valore <= massimo;

/**
 * Quello che una casa ha detto, pulito: `{visti7gg, versioni, rapporto}`, o
 * `null` se la forma non torna. Si butta tutto e non solo la riga storta:
 * un conto a meta' direbbe un numero falso.
 */
export function iTelefoniDetti(detto) {
  if (!detto || typeof detto !== "object") return null;
  const { visti7gg, versioni, rapporto } = detto;
  if (!interoTra(visti7gg, 0, TELEFONI_AL_MASSIMO)) return null;
  if (!Array.isArray(versioni) || versioni.length > VERSIONI_PER_CASA) return null;
  const pulite = [];
  let insieme = 0;
  for (const una of versioni) {
    if (!una || typeof una !== "object") return null;
    const negozio = una.negozio ?? "";
    if (typeof negozio !== "string" || !NEGOZI.has(negozio)) return null;
    const versione = una.versione ?? "";
    if (typeof versione !== "string" || !VERSIONE.test(versione)) return null;
    const costruzione = una.costruzione ?? 0;
    if (!interoTra(costruzione, 0, 9_999_999_999)) return null;
    if (!interoTra(una.quanti, 1, TELEFONI_AL_MASSIMO)) return null;
    insieme += una.quanti;
    pulite.push({ negozio, versione, costruzione, quanti: una.quanti });
  }
  /* Le versioni sono dei telefoni visti: non possono essere di piu'. */
  if (insieme > visti7gg) return null;
  return { visti7gg, versioni: pulite, rapporto: rapporto === true };
}

/**
 * Il conto di tutte le case collegate, per `/salute`:
 *
 *   · `case`            quante case collegate hanno detto i loro telefoni;
 *   · `col_rapporto`    di quelle, quante li mandano gia' col rapporto al
 *                       quadro: i loro telefoni qui non si sommano;
 *   · `mute`            collegate che non hanno detto niente — l'add-on e'
 *                       di prima e non lo sa fare;
 *   · `visti7gg`        i telefoni visti nella settimana, sommati sulle case
 *                       senza rapporto;
 *   · `versioni`        `[{negozio, versione, costruzione, telefoni, case}]`,
 *                       sulle stesse case.
 */
export function iTelefoniDelleCase(collegate) {
  let dicono = 0;
  let colRapporto = 0;
  let mute = 0;
  let visti = 0;
  const conti = new Map();
  for (const casa of collegate) {
    const detti = casa?.telefoni;
    if (!detti) {
      mute += 1;
      continue;
    }
    dicono += 1;
    if (detti.rapporto) {
      colRapporto += 1;
      continue;
    }
    visti += detti.visti7gg;
    for (const una of detti.versioni) {
      const chiave = `${una.negozio}|${una.versione}|${una.costruzione}`;
      const gia = conti.get(chiave) || {
        negozio: una.negozio,
        versione: una.versione,
        costruzione: una.costruzione,
        telefoni: 0,
        case: 0,
      };
      gia.telefoni += una.quanti;
      gia.case += 1;
      conti.set(chiave, gia);
    }
  }
  return {
    case: dicono,
    col_rapporto: colRapporto,
    mute,
    visti7gg: visti,
    versioni: [...conti.values()].sort(
      (una, altra) =>
        una.negozio.localeCompare(altra.negozio) ||
        altra.costruzione - una.costruzione ||
        altra.versione.localeCompare(una.versione, "it", { numeric: true }),
    ),
  };
}
