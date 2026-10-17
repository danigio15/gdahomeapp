/* Quando la casa sta tirando troppo (#508).
 *
 * «Possibilità di avere un campo dove inserire un valore massimo di potenza
 * che fa colorare di color ambra o rosso la card per capire un sovraccarico.»
 *
 * Una tessera che dice «4,8 kW» non dice niente finche' non si sa quanto e'
 * tanto: tre chilowatt sono la sera di una casa con l'induzione accesa, e sono
 * il distacco del contatore in una casa da tre. Il numero che separa le due
 * cose lo sa solo chi abita li', quindi lo scrive lui.
 *
 * Due numeri e non uno: ambra e' «occhio», rossa e' «adesso salta». Chi ne
 * vuole uno solo ne scrive uno solo — l'altro resta vuoto e non colora niente.
 *
 * E si sceglie su COSA guardarli, perche' le due domande sono diverse:
 *
 *   · il CARICO DI CASA e' quanto stanno consumando gli apparecchi. E' la
 *     domanda di chi ha un fotovoltaico: la casa puo' tirare sei chilowatt
 *     senza che il contatore se ne accorga, perche' li sta facendo il sole;
 *   · il CARICO DI RETE e' quanto sta passando dal contatore. E' la domanda
 *     di chi teme il distacco, perche' il limite del contratto sta li' e non
 *     sul consumo.
 *
 * Della rete si guarda solo il PRELIEVO. Il verso negativo e' l'immissione —
 * sole che va fuori — e sei chilowatt regalati alla rete non sono un
 * sovraccarico: sono una bella giornata. Leggere il valore assoluto avrebbe
 * acceso il rosso a mezzogiorno d'agosto, che e' il momento in cui la casa sta
 * meglio di sempre.
 *
 * Il modulo e' puro: entrano la soglia come l'ha scritta chi abita la casa e
 * le letture gia' fatte, esce un verdetto. Niente DOM, niente Home Assistant.
 */

const clean = (valore) => String(valore ?? "").trim();

/* Dove si tiene la soglia. Non e' di questo dispositivo: chi ha un contatore
 * da tre chilowatt ce l'ha da tre anche guardando dal telefono, quindi viaggia
 * con la configurazione — come la soglia delle batterie e quella delle
 * tapparelle. */
export const SOGLIA_POTENZA_KEY = "cd_energia_soglia";

/** Su cosa si misura il sovraccarico. */
export const SORGENTE_CASA = "casa";
export const SORGENTE_RETE = "rete";

/** Il verdetto: in quiete, da tenere d'occhio, o oltre. */
export const LIVELLO_QUIETE = "quiete";
export const LIVELLO_AMBRA = "ambra";
export const LIVELLO_ROSSA = "rossa";

/* I due colori sono quelli che la segnalazione chiede per nome — ambra e
 * rosso — e sono gli stessi che la plancia usa gia' per «guarda» e «non va»:
 * l'ambra delle allerte, il rosso delle aperture. Una tavolozza sola. */
export const COLORE_AMBRA = "#f59e0b";
export const COLORE_ROSSA = "#dc2626";

/* Un numero scritto a mano.
 *
 * La virgola e' come si scrive un decimale in mezza Europa, e chi scrive
 * «3,3» non sta sbagliando: `Number("3,3")` invece e' `NaN`, e una soglia
 * NaN non colora niente senza dirlo a nessuno. Vuoto vuol dire «non l'ho
 * messa», e non zero: zero e' una soglia scritta, e vuol dire «qualunque
 * consumo e' troppo» — strano, ma e' una risposta, non un'assenza. */
function numero(scritto) {
  if (scritto === null || scritto === undefined || clean(scritto) === "") return null;
  const valore = Number(String(scritto).replace(",", "."));
  return Number.isFinite(valore) && valore >= 0 ? valore : null;
}

/**
 * La soglia com'e' salvata, riportata in forma.
 *
 * Accetta anche la stringa JSON che arriva dalla casella, perche' e' li' che
 * vive: chiedere a ogni chiamante di fare `JSON.parse` in un `try` vorrebbe
 * dire lo stesso `try` scritto in tre posti.
 */
export function sogliaDellaPotenza(grezzo) {
  let fonte = grezzo;
  if (typeof fonte === "string") {
    try {
      fonte = JSON.parse(fonte);
    } catch (_errore) {
      fonte = null;
    }
  }
  const base = fonte && typeof fonte === "object" && !Array.isArray(fonte) ? fonte : {};
  return {
    sorgente: clean(base.sorgente) === SORGENTE_RETE ? SORGENTE_RETE : SORGENTE_CASA,
    ambra: numero(base.ambra),
    rossa: numero(base.rossa),
  };
}

/** Se c'e' almeno un numero da confrontare. Senza, non si colora niente. */
export function sogliaScritta(soglia) {
  return soglia?.ambra != null || soglia?.rossa != null;
}

/**
 * I watt da sorvegliare, dalle letture di casa.
 *
 * `letture` e' quello che la plancia gia' sa — `{casa, rete}` in watt, con la
 * rete positiva quando si preleva. Non si legge nessun sensore qui: leggerlo
 * una seconda volta e' il modo di far dire due numeri diversi alla stessa
 * corrente, ed e' gia' successo (#435).
 */
export function wattDaSorvegliare(letture = {}, sorgente = SORGENTE_CASA) {
  const grezzo = sorgente === SORGENTE_RETE ? letture?.rete : letture?.casa;
  if (typeof grezzo !== "number" || !Number.isFinite(grezzo)) return null;
  /* Il prelievo, non lo scambio: l'immissione non e' un sovraccarico. */
  if (sorgente === SORGENTE_RETE) return Math.max(0, grezzo);
  return grezzo;
}

/**
 * Il verdetto sulla potenza di adesso.
 *
 * Sopra la soglia rossa e' rossa, sopra l'ambra e' ambra, «esattamente sopra»
 * conta come sopra — chi scrive 3300 vuol dire «da tremilatrecento in su ci
 * siamo». La rossa si guarda per prima, cosi' chi le ha scritte al contrario
 * — rossa piu' bassa dell'ambra, che non e' una configurazione sensata ma e'
 * una configurazione possibile — vede comunque il colore piu' grave e non
 * resta in ambra per sempre.
 *
 * @returns {{livello:string, watt:number|null, sorgente:string, limite:number|null}}
 */
export function livelloDellaPotenza(soglia, letture = {}) {
  const regola = sogliaDellaPotenza(soglia);
  const watt = wattDaSorvegliare(letture, regola.sorgente);
  const fermo = { livello: LIVELLO_QUIETE, watt, sorgente: regola.sorgente, limite: null };
  if (watt === null || !sogliaScritta(regola)) return fermo;
  if (regola.rossa != null && watt >= regola.rossa)
    return { livello: LIVELLO_ROSSA, watt, sorgente: regola.sorgente, limite: regola.rossa };
  if (regola.ambra != null && watt >= regola.ambra)
    return { livello: LIVELLO_AMBRA, watt, sorgente: regola.sorgente, limite: regola.ambra };
  return fermo;
}

/** Il colore di un verdetto, o `null` quando non c'e' niente da colorare. */
export function coloreDelLivello(livello) {
  if (livello === LIVELLO_ROSSA) return COLORE_ROSSA;
  if (livello === LIVELLO_AMBRA) return COLORE_AMBRA;
  return null;
}

/* ── una soglia per contatore ───────────────────────────────────────────
 *
 * «Poi le soglie ho visto che sono in comune, anche queste andrebbero divise:
 * io ho due contatori.»
 *
 * Con due contatori i limiti sono due — ognuno ha il suo contratto, e salta
 * per conto suo — e una soglia sola confrontata con la somma diceva
 * «sovraccarico 3,77 kW oltre 3,00 kW» quando nessuno dei due aveva passato
 * niente: 1,97 da una parte e 1,80 dall'altra.
 *
 * La forma segue la regola degli impianti: NON SI SPOSTA NIENTE. La soglia che
 * c'era resta al primo livello ed e' quella del primo impianto — chi ha un
 * contatore solo non migra niente — e quelle degli altri stanno accanto, in
 * `perImpianto`, sotto il loro id. */
export const SOGLIE_PER_IMPIANTO = "perImpianto";
const PRIMO = "impianto";

function oggettoDa(grezzo) {
  let fonte = grezzo;
  if (typeof fonte === "string") {
    try {
      fonte = JSON.parse(fonte);
    } catch (_errore) {
      fonte = null;
    }
  }
  return fonte && typeof fonte === "object" && !Array.isArray(fonte) ? fonte : {};
}

const ePrimo = (plantId, index) => index === 0 || !clean(plantId) || clean(plantId) === PRIMO;

/** La soglia di UN impianto, in forma. Il primo e' quella di sempre. */
export function sogliaDellImpianto(grezzo, plantId = "", index = 0) {
  const base = oggettoDa(grezzo);
  if (ePrimo(plantId, index)) return sogliaDellaPotenza(base);
  const altre = oggettoDa(base[SOGLIE_PER_IMPIANTO]);
  return sogliaDellaPotenza(altre[clean(plantId)]);
}

/** Lo stesso oggetto salvato, con la soglia di un impianto riscritta. */
export function conLaSogliaDellImpianto(grezzo, plantId = "", index = 0, nuova = {}) {
  const base = oggettoDa(grezzo);
  const soglia = sogliaDellaPotenza(nuova);
  if (ePrimo(plantId, index)) return { ...base, ...soglia };
  return {
    ...base,
    [SOGLIE_PER_IMPIANTO]: { ...oggettoDa(base[SOGLIE_PER_IMPIANTO]), [clean(plantId)]: soglia },
  };
}

/** Se almeno un impianto ha una soglia scritta: senza, non si legge niente. */
export function qualcheSogliaScritta(grezzo) {
  const base = oggettoDa(grezzo);
  if (sogliaScritta(sogliaDellaPotenza(base))) return true;
  return Object.values(oggettoDa(base[SOGLIE_PER_IMPIANTO])).some((voce) =>
    sogliaScritta(sogliaDellaPotenza(voce)),
  );
}

const GRAVITA = { [LIVELLO_QUIETE]: 0, [LIVELLO_AMBRA]: 1, [LIVELLO_ROSSA]: 2 };

/**
 * Il verdetto di ogni impianto, ognuno sulle SUE letture e con la SUA soglia.
 *
 * `impianti` e' una lista di `{id, index, nome, letture:{casa, rete}}`. Esce la
 * stessa lista coi verdetti, nello stesso ordine.
 */
export function verdettiDegliImpianti(grezzo, impianti = []) {
  return (Array.isArray(impianti) ? impianti : []).map((impianto, posto) => {
    const index = Number.isInteger(impianto?.index) ? impianto.index : posto;
    return {
      ...livelloDellaPotenza(sogliaDellImpianto(grezzo, impianto?.id, index), impianto?.letture),
      impianto: clean(impianto?.id) || PRIMO,
      nome: clean(impianto?.nome),
    };
  });
}

/**
 * Il verdetto piu' grave fra quelli degli impianti: il rosso prima dell'ambra,
 * e a parita' chi e' piu' oltre il suo limite. Senza niente, la quiete.
 */
export function ilVerdettoPeggiore(verdetti = []) {
  let peggiore = null;
  for (const verdetto of Array.isArray(verdetti) ? verdetti : []) {
    if (!verdetto || verdetto.livello === LIVELLO_QUIETE) continue;
    if (!peggiore) {
      peggiore = verdetto;
      continue;
    }
    const prima = GRAVITA[verdetto.livello] - GRAVITA[peggiore.livello];
    const oltre = (voce) => (voce.limite ? voce.watt / voce.limite : 0);
    if (prima > 0 || (prima === 0 && oltre(verdetto) > oltre(peggiore))) peggiore = verdetto;
  }
  return (
    peggiore || {
      livello: LIVELLO_QUIETE,
      watt: null,
      sorgente: SORGENTE_CASA,
      limite: null,
      impianto: "",
      nome: "",
    }
  );
}
