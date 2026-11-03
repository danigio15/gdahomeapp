/* Le versioni dell'app sui telefoni, per la schermata «Abbonamenti».
 *
 * «Nella sezione abbonamenti mi metti anche una parte per verificare le
 * versioni installate delle app dagli utenti», «per singolo negozio, Apple e
 * Google». Ogni casa dice nel suo rapporto quanti telefoni, fra quelli visti
 * nell'ultima settimana, hanno quale versione e da quale negozio vengono
 * (`telefoni.versioni`, `ponte/src/rapporto.js`): solo quanti, mai quali.
 * Qui si mettono insieme negozio per negozio: per versione, quanti telefoni e
 * in quante case; e casa per casa, quali versioni ci girano.
 *
 * La versione e' quella che l'app dice di se' («1.18.7») col suo numero di
 * costruzione (1180714). Le app di prima dicono solo la prima: costruzione
 * zero, «numero non detto». La piu' nuova si guarda negozio per negozio: una
 * build puo' essere gia' su Google Play e ancora in revisione da Apple, e
 * chi ha l'iPhone non e' «indietro» per questo.
 */

/** I negozi, nell'ordine in cui si mostrano. `altro` e' il browser, o chi
 * non l'ha detto. */
export const NEGOZI = ["apple", "google", "altro"];

const ilNegozio = (detto) => (detto === "apple" || detto === "google" ? detto : "altro");

const pulita = (una) => ({
  negozio: ilNegozio(una?.negozio),
  versione: typeof una?.versione === "string" ? una.versione.slice(0, 40) : "",
  costruzione: Number.isInteger(una?.costruzione) && una.costruzione > 0 ? una.costruzione : 0,
  quanti: Number.isInteger(una?.quanti) && una.quanti > 0 ? una.quanti : 0,
});

/** Fin quando vale l'ultimo rapporto di una casa: una settimana, come i
 * telefoni «visti nella settimana» che ci sono dentro. */
export const RAPPORTO_VALE = 7 * 24 * 3600 * 1000;

/* Quando il rapporto e' arrivato, in millisecondi; senza data si tiene,
 * come prima. */
const rapportoScaduto = (vistaIl, adesso) => {
  const il = typeof vistaIl === "number" ? vistaIl : Date.parse(vistaIl ?? "");
  return Number.isFinite(il) && adesso - il > RAPPORTO_VALE;
};

const dallaPiuNuova = (una, altra) =>
  altra.costruzione - una.costruzione ||
  altra.versione.localeCompare(una.versione, "it", { numeric: true });

/**
 * Da tutte le case (come `Case.elenco(TUTTE)` le veste) alle versioni.
 *
 * Torna `{ negozi, case, telefoni, senzaVersioni }`. `negozi.apple`, `negozi.google` e
 * `negozi.altro` hanno ognuno `{ versioni, telefoni, piuNuova }`, le versioni
 * dalla piu' nuova con `telefoni` e `case`. `case` sono solo quelle che ne
 * hanno detta almeno una, con le loro versioni (ognuna col suo negozio) e un
 * `indietro` vero se c'e' un telefono con una costruzione piu' vecchia della
 * piu' nuova vista nel suo negozio.
 *
 * E `senzaVersioni`: i telefoni visti nella settimana in case che le versioni
 * non le dicono — l'add-on di prima della 1.18.7.14 manda solo quanti sono.
 * «Mancano tutti quelli che hanno la 1.18.7»: senza questa riga il totale
 * sembrava tutto, e quelle case sparivano. `{ telefoni, case }`, le case con
 * quanti telefoni e la versione dell'add-on, da quella con piu' telefoni.
 *
 * Un rapporto arrivato piu' di [RAPPORTO_VALE] fa non si conta: il quadro
 * tiene l'ultimo che ha avuto anche quando la casa il rapporto lo spegne, e
 * da allora i suoi telefoni li somma il tramite. Contarli anche qui li
 * contava due volte, per sempre. Resta una settimana in cui una casa che lo
 * ha appena spento puo' stare in tutte e due: il tramite non dice quali
 * case somma, e la gestione lo scrive.
 */
export function leVersioniDelleApp(
  tutte = [],
  ultime = {},
  dalTramite = null,
  adesso = Date.now(),
) {
  const perNegozio = Object.fromEntries(NEGOZI.map((n) => [n, new Map()]));
  const perCasa = [];
  const muteCase = [];
  for (const una of tutte) {
    if (rapportoScaduto(una?.vistaIl, adesso)) continue;
    const dette = (Array.isArray(una?.carta?.telefoni?.versioni) ? una.carta.telefoni.versioni : [])
      .map(pulita)
      .filter((v) => v.quanti > 0);
    if (!dette.length) {
      const visti = Number(una?.carta?.telefoni?.visti7gg);
      if (Number.isInteger(visti) && visti > 0)
        muteCase.push({
          casa: una.casa,
          nome: una.nome,
          telefoni: visti,
          ponte: typeof una?.carta?.ponte === "string" ? una.carta.ponte.slice(0, 40) : "",
        });
      continue;
    }
    for (const v of dette) {
      const mappa = perNegozio[v.negozio];
      const chiave = `${v.versione}|${v.costruzione}`;
      const gia = mappa.get(chiave) || {
        versione: v.versione,
        costruzione: v.costruzione,
        telefoni: 0,
        case: new Set(),
      };
      gia.telefoni += v.quanti;
      gia.case.add(una.casa);
      mappa.set(chiave, gia);
    }
    perCasa.push({
      casa: una.casa,
      nome: una.nome,
      vistaIl: una.vistaIl ?? null,
      versioni: dette.sort(
        (a, b) => NEGOZI.indexOf(a.negozio) - NEGOZI.indexOf(b.negozio) || dallaPiuNuova(a, b),
      ),
    });
  }

  /* E quelle che le case dicono al tramite (`centralino/src/telefoni.js`):
   * gia' sommate di la', senza sapere quali case. Le case che mandano il
   * rapporto il tramite non le somma — i loro telefoni sono gia' qui sopra,
   * casa per casa. Una casa che il rapporto l'ha appena spento la somma il
   * tramite e qui resta fino a una settimana: vedi `RAPPORTO_VALE`. */
  const tramite = leVersioniDalTramite(dalTramite);
  for (const v of tramite?.versioni ?? []) {
    const mappa = perNegozio[v.negozio];
    const chiave = `${v.versione}|${v.costruzione}`;
    const gia = mappa.get(chiave) || {
      versione: v.versione,
      costruzione: v.costruzione,
      telefoni: 0,
      case: new Set(),
    };
    gia.telefoni += v.telefoni;
    gia.caseDalTramite = (gia.caseDalTramite || 0) + v.case;
    mappa.set(chiave, gia);
  }

  const negozi = {};
  for (const negozio of NEGOZI) {
    const versioni = [...perNegozio[negozio].values()]
      .map(({ caseDalTramite = 0, ...v }) => ({ ...v, case: v.case.size + caseDalTramite }))
      .sort(dallaPiuNuova);
    negozi[negozio] = {
      versioni,
      telefoni: versioni.reduce((somma, v) => somma + v.telefoni, 0),
      /* La piu' nuova vista, o quella scritta come pubblicata se e' piu'
       * avanti: appena esce, chi non l'ha ancora presa e' indietro. */
      piuNuova: versioni.reduce(
        (max, v) => Math.max(max, v.costruzione),
        Number.isSafeInteger(ultime?.[negozio]?.costruzione) ? ultime[negozio].costruzione : 0,
      ),
    };
  }
  const case_ = perCasa
    .map((una) => ({
      ...una,
      indietro: una.versioni.some((v) => {
        const piuNuova = negozi[v.negozio].piuNuova;
        return piuNuova > 0 && v.costruzione < piuNuova;
      }),
    }))
    .sort(
      (una, altra) =>
        Number(altra.indietro) - Number(una.indietro) ||
        String(una.nome || una.casa).localeCompare(String(altra.nome || altra.casa), "it"),
    );
  const telefoni = NEGOZI.reduce((somma, n) => somma + negozi[n].telefoni, 0);
  muteCase.sort(
    (una, altra) =>
      altra.telefoni - una.telefoni ||
      String(una.nome || una.casa).localeCompare(String(altra.nome || altra.casa), "it"),
  );
  const senzaVersioni = {
    telefoni: muteCase.reduce((somma, una) => somma + una.telefoni, 0),
    case: muteCase,
    /* Le case accese adesso che al tramite non dicono niente: l'add-on e' di
     * prima e non lo sa fare. Sono un numero e basta — il tramite non dice
     * quali — e comprendono anche quelle dell'elenco qui sopra che sono
     * accese. `null`: il tramite non risponde, o e' di prima. */
    caseAccese: tramite ? tramite.mute : null,
  };
  return {
    negozi,
    case: case_,
    telefoni,
    senzaVersioni,
    /* Da dove arrivano: quante case dal tramite (senza rapporto) e quante
     * col rapporto. `null` se il tramite non le dice. */
    fonti: {
      dalTramite: tramite ? tramite.case - tramite.colRapporto : null,
      colRapporto: perCasa.length,
    },
  };
}

/**
 * Quello che il tramite dice sotto `versioni_app`, pulito: niente di piu' di
 * numeri e versioni, e `null` se la forma non torna o non c'e'.
 */
export function leVersioniDalTramite(detto) {
  if (!detto || typeof detto !== "object") return null;
  const intero = (cosa) => (Number.isSafeInteger(cosa) && cosa >= 0 ? cosa : null);
  const case_ = intero(detto.case);
  const colRapporto = intero(detto.col_rapporto ?? detto.colRapporto);
  const mute = intero(detto.mute);
  const visti = intero(detto.visti7gg);
  if (case_ === null || colRapporto === null || mute === null || visti === null) return null;
  const versioni = (Array.isArray(detto.versioni) ? detto.versioni : [])
    .slice(0, 300)
    .map((una) => ({
      negozio: ilNegozio(una?.negozio),
      versione: typeof una?.versione === "string" ? una.versione.slice(0, 40) : "",
      costruzione: intero(una?.costruzione) ?? 0,
      telefoni: intero(una?.telefoni) ?? 0,
      case: intero(una?.case) ?? 0,
    }))
    .filter((una) => una.telefoni > 0);
  return { case: case_, colRapporto, mute, visti7gg: visti, versioni };
}
