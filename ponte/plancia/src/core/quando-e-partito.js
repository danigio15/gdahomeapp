/* Da quando è in funzione, chiesto alla casa (#143).
 *
 * «Quando guardo la sezione elettrodomestici segna inizio ciclo anche se è
 *  già iniziato da 1 ora.»
 *
 * È la #65 vista da più vicino, e la #65 era stata chiusa senza chiedere
 * niente a nessuno: il contatore dei cicli distingueva «l'ho visto partire»
 * da «l'ho trovato già partito», e nel secondo caso scriveva «da prima di» —
 * onesto, ma l'ora era comunque quella in cui si era guardato. Onesto e
 * inutile: chi apre la plancia vuole sapere quando è partita la lavatrice,
 * non quando ha aperto la plancia.
 *
 * L'ora vera però la casa ce l'ha. Home Assistant registra ogni cambio di
 * stato, e la storia di un'entità nelle ultime ventiquattro ore dice
 * esattamente quando quella macchina si è messa in funzione. Basta chiederlo,
 * e si chiede una volta sola per ciclo — solo quando l'avvio è una
 * supposizione, mai quando lo si è visto succedere.
 *
 * ── Come si legge la storia ─────────────────────────────────────────────
 *
 * Le righe che torna Home Assistant sono i CAMBI di stato, non i campioni:
 * ogni riga vale da quando è scritta fino alla riga dopo, e l'ultima vale
 * fino ad adesso. Una lavatrice partita alle 14:00 e ancora in giro sono due
 * righe — «running alle 14:00» e nient'altro — non novanta minuti di
 * campioni.
 *
 * Perciò non si contano le righe accese: si cammina all'indietro dall'ultima,
 * e la corsa finisce dove si trova una sosta più lunga della tolleranza. La
 * tolleranza è la stessa del contatore dei cicli, venti minuti, e per lo
 * stesso motivo (#26): una lavatrice a metà programma sta ferma davvero —
 * l'ammollo, il carico dell'acqua — e una presa smart quei minuti li vede
 * come zero watt. Se le due regole non fossero la stessa, la storia direbbe
 * un ciclo e il contatore un altro.
 *
 * ── Quando la risposta non è sicura ─────────────────────────────────────
 *
 * Se la corsa arriva fino al bordo della finestra, il ciclo è cominciato
 * PRIMA di quello che si è chiesto, e non si sa quanto prima. Allora l'ora
 * resta un «da prima di» — ma è il «da prima di» giusto, dodici ore fa invece
 * che adesso, ed è tutta un'altra informazione.
 *
 * È puro: entrano le righe, la regola per dire se una parola vuol dire «in
 * funzione» e l'istante; esce l'ora. Niente rete, niente DOM, niente orologio.
 */

/** Quanto indietro si guarda: oltre un giorno non è più questo ciclo. */
export const ORE_DI_STORIA = 24;

/* La stessa sosta che il contatore dei cicli lascia passare senza chiudere il
 * ciclo (#26). Sta scritta in due posti perché i due moduli non si conoscono,
 * e una prova tiene insieme i due numeri. */
export const PAUSA_DENTRO_UN_CICLO_MS = 20 * 60 * 1000;

const numero = (valore) => {
  if (valore === "" || valore == null) return null;
  const n = Number(valore);
  return Number.isFinite(n) ? n : null;
};

/** Da quando a quando si guarda indietro. La sanno in due: chi chiede e chi legge. */
export function finestraDellAvvio(adesso, ore = ORE_DI_STORIA) {
  const a = Number(adesso);
  return { da: a - ore * 3600000, a };
}

/** La domanda: i cambi di stato di un'entità nelle ultime ore. */
export function domandaDellAvvio(entity, adesso, ore = ORE_DI_STORIA) {
  const { da, a } = finestraDellAvvio(adesso, ore);
  return {
    type: "history/history_during_period",
    start_time: new Date(da).toISOString(),
    end_time: new Date(a).toISOString(),
    entity_ids: [String(entity)],
    /* Lo stato al bordo serve: senza, una macchina partita prima della
     * finestra non avrebbe nessuna riga accesa e sembrerebbe ferma. */
    include_start_time_state: true,
    /* Tutti i cambi, non solo quelli «significativi»: su un sensore di
     * potenza il significativo salta proprio i passaggi da e verso lo zero,
     * che sono gli unici che qui contano. */
    significant_changes_only: false,
    minimal_response: true,
    no_attributes: true,
  };
}

/**
 * Le righe della risposta, nella forma `{ stato, quando }`.
 *
 * Home Assistant risponde `{ [entity]: [...] }`, e le voci arrivano in due
 * vestiti a seconda della versione e di `minimal_response`: `{ state, last_changed }`
 * per la prima, `{ s, lu }` per quelle dopo — dove `lu` è in SECONDI. Si
 * leggono tutti e due, che costa tre righe e non lascia fuori nessuno.
 */
export function righeDellaStoria(risposta, entity) {
  const elenco = Array.isArray(risposta?.[entity])
    ? risposta[entity]
    : Array.isArray(risposta)
      ? risposta.flat()
      : [];
  return elenco
    .map((voce) => {
      const stato = String(voce?.s ?? voce?.state ?? "");
      const secondi = numero(voce?.lu ?? voce?.last_updated_ts ?? voce?.last_changed_ts);
      const quando =
        secondi != null
          ? secondi * 1000
          : Date.parse(voce?.last_changed ?? voce?.last_updated ?? "");
      return Number.isFinite(quando) ? { stato, quando } : null;
    })
    .filter(Boolean);
}

/**
 * L'inizio della corsa che è ancora aperta adesso, o `null` se adesso la
 * macchina non risulta in funzione.
 *
 * Torna `{ quando, certo }`: `certo` è falso quando la corsa arriva fino al
 * bordo della finestra, cioè quando il ciclo è cominciato prima di quello che
 * si è chiesto e l'ora è un «da prima di».
 *
 * `da` è l'inizio della finestra chiesta, ed è quello che distingue le due
 * cose: `include_start_time_state` fa arrivare anche lo stato che valeva al
 * bordo, e quella riga NON è un avvio — è solo la prima notizia che si ha.
 * Senza saperlo, una macchina partita dentro la finestra e una partita il
 * giorno prima si leggerebbero allo stesso modo.
 */
export function avvioDallaStoria(
  righe,
  { inFunzione, adesso, da = -Infinity, pausaMs = PAUSA_DENTRO_UN_CICLO_MS },
) {
  const ordinate = (Array.isArray(righe) ? righe : [])
    .filter((riga) => Number.isFinite(riga?.quando) && riga.quando <= adesso)
    .sort((a, b) => a.quando - b.quando);
  if (!ordinate.length) return null;
  /* Fin quando vale una riga: fino alla prossima, e l'ultima fino ad adesso. */
  const fineDi = (i) => (i + 1 < ordinate.length ? ordinate[i + 1].quando : adesso);

  let i = ordinate.length - 1;
  if (!inFunzione(ordinate[i].stato)) return null;
  let avvio = ordinate[i].quando;
  for (i -= 1; i >= 0; i -= 1) {
    const riga = ordinate[i];
    if (inFunzione(riga.stato)) {
      avvio = riga.quando;
      continue;
    }
    /* Una sosta dentro la tolleranza è ancora questo ciclo: si scavalca senza
     * spostare l'avvio, che lo riscriverà la riga accesa più indietro. */
    if (fineDi(i) - riga.quando <= pausaMs) continue;
    break;
  }
  /* Se la corsa comincia sul bordo — o prima — quella riga è lo stato che
   * valeva all'inizio della finestra: il ciclo era già in piedi, e di quanto
   * prima non si sa. L'ora resta migliore di «adesso», ma è un «da prima di». */
  return { quando: avvio, certo: avvio > da };
}

/* ── quando una riga vuol dire «in funzione» ─────────────────────────────
 *
 * Tre regole, e sono le stesse tre con cui il modello della scheda decide se
 * la macchina sta lavorando adesso: la parola dello stato, l'interruttore di
 * attività, i watt sopra la soglia. Chi chiede la storia sceglie quella che
 * vale per il suo apparecchio — la stessa che ha usato per dire IN FUNZIONE —
 * così la storia e la card non possono leggere due cose diverse.
 */

/** In funzione quando la parola dello stato lo dice. */
export function dalleParole(letturaDelloStato) {
  return (stato) => letturaDelloStato(stato) === "running";
}

/** In funzione quando l'interruttore di attività è acceso. */
export function dallInterruttore() {
  return (stato) =>
    String(stato ?? "")
      .trim()
      .toLowerCase() === "on";
}

/** In funzione quando i watt stanno sopra la soglia. */
export function daiWatt(soglia, fattore = 1) {
  return (stato) => {
    const watt = numero(stato);
    return watt != null && watt * fattore >= soglia;
  };
}
