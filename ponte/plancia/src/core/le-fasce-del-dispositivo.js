/* In quale fascia consuma questo apparecchio (#111).
 *
 * «Mi aggiungi anche nel dispositivo le fasce per capire quanto quel
 * dispositivo assorbe di più e in quale fascia.»
 *
 * Il Report sa gia' dire in quale fascia consuma LA CASA — e' il blocco «Come
 * si divide il costo reale», in Panoramica. Ma la casa e' la somma di tutto, e
 * sapere che il 60% del mese e' passato in F3 non dice quale apparecchio ce
 * l'ha messo. La domanda utile e' l'altra: la wallbox, la lavatrice, il boiler
 * — ognuno in quale fascia pesa? Perche' da li' si decide cosa spostare.
 *
 * ── Perche' non basta il conto che c'e' gia' ──────────────────────────────
 *
 * `reportDelleFasce` fa esattamente questo conto per una serie di ore, e a
 * darle le ore dell'apparecchio invece di quelle della rete risponderebbe.
 * Manca pero' una cosa, ed e' quella che rende il numero vero: **i
 * kilowattora che un apparecchio prende dal sole non stanno in nessuna
 * fascia.**
 *
 * Una fascia e' un prezzo, e il sole non ha prezzo a nessuna ora. Mettere nel
 * conto anche quelli farebbe uscire un euro piu' alto di quello vero — proprio
 * accanto alla tessera «Speso dalla rete», che il numero giusto ce l'ha — e
 * chi legge si troverebbe due cifre diverse per la stessa spesa a tre
 * centimetri di distanza. E' il difetto che la card del dispositivo ha gia'
 * avuto una volta, con la quota di sole copiata dalla casa.
 *
 * Quindi le fasce si contano sui kilowattora PRESI DALLA RETE, ora per ora, e
 * il sole si conta a parte e si dice.
 *
 * ── Il conto ──────────────────────────────────────────────────────────────
 *
 * Ora per ora, con le stesse tre serie da cui esce la quota di sole:
 *
 *   - quanto ha preso l'apparecchio in quest'ora;
 *   - quale frazione di quello che consumava la casa veniva dalla rete —
 *     `quotaDiRete`, che e' gia' scritta e gia' provata;
 *   - in quale fascia cade quest'ora — `fasciaInVigore`, idem.
 *
 * Il resto e' una somma. Niente di nuovo si inventa qui: si mettono insieme
 * due conti che esistono, dalla parte in cui nessuno li aveva ancora messi.
 *
 * ── Cosa NON fa ───────────────────────────────────────────────────────────
 *
 * Non ripiega. Se per un'ora manca il consumo di casa o il prelievo dalla
 * rete, quella spartizione non si sa: l'ora entra nel conto dei kilowattora
 * dell'apparecchio — perche' li ha consumati davvero, e la sua fascia si sa —
 * ma resta fuori dalla divisione fra sole e rete, e il blocco lo dichiara.
 * Una percentuale inventata su meta' delle ore e' peggio di una percentuale
 * che manca.
 *
 * E non guarda nessun orologio e nessuna entita': entrano tre serie e una
 * configurazione, esce un oggetto. E' la meta' che si puo' provare senza una
 * casa, come dappertutto nel nucleo.
 */

import { perMomento, quotaDiRete } from "./quota-solare-del-dispositivo.js";
import {
  fasciaDelleOre,
  fasciaInVigore,
  leFasceValgono,
  normalizzaLeFasce,
} from "./fasce-della-tariffa.js";

const numero = (valore) => {
  const letto = Number(valore);
  return Number.isFinite(letto) ? letto : null;
};

const vuoto = (quante) => Array.from({ length: quante }, () => 0);

/**
 * Le fasce di un apparecchio, sulle ore che il Recorder ha.
 *
 * `dispositivo`, `casa` e `rete` sono tre serie di secchielli orari con lo
 * stesso passo — le stesse che misurano la quota di sole. `fasceSalvate` e'
 * la configurazione delle fasce; `prezzoUnico` e' la tariffa di sempre, che
 * vale come ripiego per una fascia senza prezzo e serve al confronto.
 *
 * Torna `null` quando le fasce non sono accese: senza fasce non c'e' niente
 * da dividere, e chi disegna non scrive il blocco.
 */
export function leFasceDelDispositivo(
  { dispositivo = [], casa = [], rete = [] } = {},
  fasceSalvate,
  { prezzoUnico = 0 } = {},
) {
  const config = normalizzaLeFasce(fasceSalvate);
  const quante = config.voci.length;
  if (!quante || !leFasceValgono(config)) return null;

  const unico = Math.max(0, numero(prezzoUnico) || 0);
  const prezzoDi = (indice) => {
    const suo = config.voci[indice]?.prezzo;
    return suo === null || suo === undefined ? unico : suo;
  };

  const suoi = perMomento(dispositivo);
  const diCasa = perMomento(casa);
  const dallaRete = perMomento(rete);

  const kwhPerFascia = vuoto(quante);
  const retePerFascia = vuoto(quante);
  const solePerFascia = vuoto(quante);
  /* Le ventiquattro ore del giorno, per il profilo: stessa forma di quello
   * della casa, cosi' chi disegna non impara due disegni. */
  const perOra = Array.from({ length: 24 }, () => ({ kwh: 0, rete: 0 }));

  let suoiKwh = 0;
  let spartiti = 0;
  let senzaSpartizione = 0;

  for (const [momento, kwh] of suoi) {
    if (!(kwh > 0)) continue;
    const quando = new Date(momento);
    const quale = fasciaInVigore(config, quando);
    if (quale < 0) continue;
    suoiKwh += kwh;
    kwhPerFascia[quale] += kwh;
    const casella = perOra[quando.getHours()];
    if (casella) casella.kwh += kwh;

    /* La spartizione si sa solo se quell'ora ce l'hanno tutte e tre.
     *
     * `quotaDiRete` legge una casa mancante come «tutto dalla rete» e un
     * prelievo mancante come «tutto dal sole»: sono le due risposte prudenti
     * quando il dato c'e' ed e' zero, e sono due invenzioni quando il dato non
     * c'e' affatto. E' la stessa regola della quota di sole, e per la stessa
     * ragione. */
    if (!diCasa.has(momento) || !dallaRete.has(momento)) {
      senzaSpartizione += kwh;
      continue;
    }
    const share = quotaDiRete(diCasa.get(momento), dallaRete.get(momento));
    const dallaPresa = kwh * share;
    spartiti += kwh;
    retePerFascia[quale] += dallaPresa;
    solePerFascia[quale] += kwh - dallaPresa;
    if (casella) casella.rete += dallaPresa;
  }

  if (!(suoiKwh > 0)) return null;

  const fasce = config.voci.map((voce, indice) => {
    const dallaRete_ = retePerFascia[indice];
    return {
      indice,
      dalle: voce.dalle,
      prezzo: prezzoDi(indice),
      /* Se il prezzo e' suo o e' il ripiego: una fascia senza numero non deve
       * sembrare una fascia che costa come tutte le altre per scelta. */
      suo: voce.prezzo !== null,
      kwh: kwhPerFascia[indice],
      rete: dallaRete_,
      sole: solePerFascia[indice],
      /* L'euro sta sui kilowattora presi dalla rete: quelli del sole non
       * costano niente a nessun'ora. */
      euro: dallaRete_ * prezzoDi(indice),
      quota: (kwhPerFascia[indice] / suoiKwh) * 100,
    };
  });

  const dallaRete_ = retePerFascia.reduce((a, b) => a + b, 0);
  const dalSole = solePerFascia.reduce((a, b) => a + b, 0);
  const euro = fasce.reduce((somma, fascia) => somma + fascia.euro, 0);

  /* La fascia in cui pesa di piu': e' la risposta alla domanda che l'ha
   * chiesta. Si guarda sui kilowattora e non sugli euro, perche' la domanda
   * e' «in quale fascia assorbe» — e la fascia piu' cara con pochi
   * kilowattora risponderebbe a un'altra domanda. */
  const punta = fasce.reduce((alta, fascia) => (fascia.kwh > alta.kwh ? fascia : alta), fasce[0]);

  return {
    fasce,
    kwh: suoiKwh,
    rete: dallaRete_,
    sole: dalSole,
    euro,
    punta,
    /* Le ventiquattro ore, sempre tutte e sempre in ordine. La fascia e'
     * quella FERIALE di quell'ora — una colonna ha un colore solo, e il
     * sabato non puo' tingerla a meta' — mentre i kilowattora sono quelli
     * veri, weekend compreso. */
    ore: perOra.map((casella, ora) => ({
      ora,
      kwh: casella.kwh,
      rete: casella.rete,
      fascia: fasciaDelleOre(config, ora * 60),
    })),
    /* Quanto avrebbe speso con una tariffa unica, sugli stessi kilowattora
     * presi dalla rete: e' la domanda vera dietro le fasce. Senza quel prezzo
     * non c'e' confronto da fare, e chi disegna non scrive la riga. */
    /* Quanto valgono i kilowattora arrivati dal sole, alle ore in cui sono
     * arrivati: e' quello che l'apparecchio non ha pagato, ed e' il numero che
     * la scheda del dispositivo chiama «risparmiato grazie al FV». Li' lo si
     * stimava col prezzo medio delle fasce sulla settimana — con una wallbox
     * che carica di notte quel prezzo e' quasi il doppio di quello vero — e
     * qui invece il prezzo e' quello dell'ora in cui il sole e' entrato. */
    valoreDelSole: fasce.reduce((somma, fascia) => somma + fascia.sole * fascia.prezzo, 0),
    unico: unico > 0 ? { prezzo: unico, euro: dallaRete_ * unico } : null,
    risparmio: unico > 0 ? dallaRete_ * unico - euro : null,
    /* Quanta parte dei suoi kilowattora si e' potuta dividere fra sole e
     * rete. Chi legge deve saperlo: le fasce sono esatte comunque — l'ora in
     * cui ha consumato si sa sempre — ma gli euro riguardano solo la parte
     * spartita. */
    spartito: { kwh: spartiti, senza: senzaSpartizione },
    tuttoSpartito: senzaSpartizione <= 0.0005,
  };
}
