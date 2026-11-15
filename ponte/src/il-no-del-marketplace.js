/* Quando il Marketplace di Home Assistant dice di no, dirlo giusto.
 *
 * Da Home Assistant 2026.11 HACS non c'e' piu': le integrazioni e le schede
 * scaricate le installa il Marketplace, che e' dentro Home Assistant. Prima di
 * installare o aggiornare vuole che il suo avviso — «questa roba la scrive la
 * comunita', nessuno la controlla» — sia stato letto e accettato, e finche'
 * non lo e' ogni `update.install` torna con:
 *
 *   «Open the Marketplace and read the warning first, installing and
 *    updating work once it is accepted»
 *
 * (`homeassistant/components/marketplace/strings.json`, chiave
 * `warning_not_accepted`).
 *
 * ─── Perche' accettarlo non bastava ───────────────────────────────────────
 *
 * «L'ho già fatto nel Marketplace ma non mi fa installare gli aggiornamenti.»
 * L'accettazione e' **di un utente**: `marketplace/warning/accept` la salva
 * col nome di chi la da', e `update.install` guarda l'utente che chiama
 * (`marketplace/update.py`, `warning_accepted(self._context.user_id)`; la
 * prova di Home Assistant e' `test_install_needs_warning_accepted_by_caller`).
 * Il ponte parla con Home Assistant col segno del Supervisor, e quindi per il
 * Marketplace chi installa dall'app e' l'utente «Supervisor», che l'avviso non
 * l'ha letto. Averlo accettato col proprio utente non cambia niente.
 *
 * Accettarlo noi al posto della persona sarebbe facile — e' un comando solo —
 * ed e' proprio quello che non si fa da soli: e' un consenso, e Home
 * Assistant lo chiede apposta a chi installa. Quello che si fa e' dirlo, con
 * le due strade che funzionano: installare da Home Assistant con il proprio
 * utente, oppure — chi amministra la casa, dopo averlo letto — accettarlo
 * anche per l'utente di GdAHome dalla pagina Aggiornamenti dell'app
 * (`l-avviso-del-marketplace.js`). Il no porta con se' la chiave di Home
 * Assistant, ed e' da quella che l'app sa di mostrare l'avviso.
 *
 * Le parole di Home Assistant restano in coda, come per il Supervisor: a chi
 * cerca aiuto in rete servono esatte.
 */

/** Se questo «no» e' il Marketplace che vuole l'avviso accettato. */
export function eIlMarketplace(errore) {
  if (errore?.chiave === "warning_not_accepted") return true;
  const detto = String(errore?.message ?? errore ?? "");
  return /marketplace/i.test(detto) && /(warning|accept)/i.test(detto);
}

/** Il «no» del Marketplace detto in italiano, o `null` se non e' lui. */
export function comeDirloDelMarketplace(errore) {
  if (!eIlMarketplace(errore)) return null;
  const suo = String(errore?.message ?? errore ?? "").trim();
  return (
    "Il Marketplace di Home Assistant installa e aggiorna solo per chi ha letto e accettato il suo avviso, e l'accettazione vale utente per utente. " +
    "Dall'app l'aggiornamento lo chiede GdAHome, con il suo utente di Home Assistant e non con il tuo: per questo averlo accettato col tuo utente non basta. " +
    "Per aggiornare apri Home Assistant con il tuo utente e installalo da Impostazioni → Aggiornamenti, oppure dalla plancia di GdAHome aperta dentro Home Assistant. " +
    "Se l'avviso non l'hai ancora accettato, Home Assistant te lo mostra aprendo il Marketplace dal suo menu. " +
    "Se amministri la casa puoi anche leggerlo nell'app e accettarlo per GdAHome: dopo, gli aggiornamenti del Marketplace si installano anche da qui." +
    (suo ? ` (Home Assistant dice: ${suo})` : "")
  );
}
