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

const dallaPiuNuova = (una, altra) =>
  altra.costruzione - una.costruzione ||
  altra.versione.localeCompare(una.versione, "it", { numeric: true });

/**
 * Da tutte le case (come `Case.elenco(TUTTE)` le veste) alle versioni.
 *
 * Torna `{ negozi, case, telefoni }`. `negozi.apple`, `negozi.google` e
 * `negozi.altro` hanno ognuno `{ versioni, telefoni, piuNuova }`, le versioni
 * dalla piu' nuova con `telefoni` e `case`. `case` sono solo quelle che ne
 * hanno detta almeno una, con le loro versioni (ognuna col suo negozio) e un
 * `indietro` vero se c'e' un telefono con una costruzione piu' vecchia della
 * piu' nuova vista nel suo negozio.
 */
export function leVersioniDelleApp(tutte = []) {
  const perNegozio = Object.fromEntries(NEGOZI.map((n) => [n, new Map()]));
  const perCasa = [];
  for (const una of tutte) {
    const dette = (Array.isArray(una?.carta?.telefoni?.versioni) ? una.carta.telefoni.versioni : [])
      .map(pulita)
      .filter((v) => v.quanti > 0);
    if (!dette.length) continue;
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

  const negozi = {};
  for (const negozio of NEGOZI) {
    const versioni = [...perNegozio[negozio].values()]
      .map((v) => ({ ...v, case: v.case.size }))
      .sort(dallaPiuNuova);
    negozi[negozio] = {
      versioni,
      telefoni: versioni.reduce((somma, v) => somma + v.telefoni, 0),
      piuNuova: versioni.reduce((max, v) => Math.max(max, v.costruzione), 0),
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
  return { negozi, case: case_, telefoni };
}
