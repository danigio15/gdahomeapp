/* Le finestre dei widget, una per tessera.
 *
 * «Analizza tutti i widget e proponimi miglioramenti… Le approvo tutte.» Ogni
 * tessera della Home apriva la stessa finestra generica — il verdetto, «Le
 * misure», «Lo stato» — riempita con quello che il modello aveva in mano. Le
 * finestre nuove sono disegnate una per una, sul mestiere di ciascuna: il
 * numero che conta in grande, i comandi a portata di pollice, niente nomi
 * grezzi e niente doppioni.
 *
 * Qui c'e' solo l'elenco: chi disegna la finestra di una tessera si registra
 * con la sua chiave, e `home-widgets-section.js` la chiede prima di ripiegare
 * su quella generica. I disegni stanno in `finestre/<gruppo>.js`, ognuno col
 * suo stile, e non importano la Home: niente giri fra moduli.
 */

const FINESTRE = new Map();

/**
 * Registra la finestra di una tessera.
 *
 * @param {string} chiave la chiave della tessera (o la sua famiglia)
 * `sottotitolo`, se c'e', scrive la riga sotto il titolo della finestra al
 * posto delle briciole della sezione: «2 impegni oggi · 3 da fare» dice di
 * piu' di «Impegni · Da fare · Prossimi giorni».
 *
 * @param {{disegna:(widget:object, states:object)=>string, stile?:string, sottotitolo?:(widget:object)=>string}} finestra
 */
export function registraFinestra(chiave, { disegna, stile = "", sottotitolo = null } = {}) {
  const quale = String(chiave ?? "").trim();
  if (!quale || typeof disegna !== "function") return false;
  FINESTRE.set(quale, {
    disegna,
    stile: String(stile || ""),
    sottotitolo: typeof sottotitolo === "function" ? sottotitolo : null,
  });
  return true;
}

/** La finestra registrata per questa chiave, o `null`. */
export function finestraDi(chiave) {
  return FINESTRE.get(String(chiave ?? "").trim()) || null;
}

/** Gli stili di tutte le finestre registrate, in un foglio solo. */
export function stiliDelleFinestre() {
  return [...FINESTRE.values()]
    .map((finestra) => finestra.stile)
    .filter(Boolean)
    .join("\n");
}

/**
 * Il tasto che chiama un servizio di Home Assistant, da dentro una finestra.
 *
 * Il gestore dei clic della Home lo riconosce da `data-dm-w-servizio` e lo
 * chiama: le finestre non devono sapere come si parla a Home Assistant. Con
 * `conferma` il primo tocco arma il tasto e cambia la scritta, il secondo
 * esegue: aprire un cancello o disinserire un allarme non si fa per sbaglio.
 */
export function tastoServizio(
  { domain, service, data = {} },
  { classe = "", testo = "", conferma = "", attributi = "" } = {},
) {
  const comando = JSON.stringify({ domain, service, data });
  const sicuro = (valore) =>
    String(valore ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;");
  return `<button type="button" class="${sicuro(classe)}" data-dm-w-servizio="${sicuro(comando)}"${
    conferma ? ` data-dm-w-conferma="${sicuro(conferma)}"` : ""
  } ${attributi}>${testo}</button>`;
}
