/* In che modo il centralino tiene le licenze: `spento`, `registra`, `impone`.
 *
 * Prima l'interruttore era uno solo, la chiave pubblica di `chiave-licenze.js`:
 * vuota, entravano tutti; scritta, il fuori casa si chiudeva **per tutti
 * insieme**, nel momento stesso in cui la versione con la chiave arrivava
 * sulla macchina. Non c'era un modo di guardare prima cosa sarebbe successo
 * con i gettoni veri, e non c'era un modo di tornare indietro senza un
 * rilascio.
 *
 * Adesso la chiave dice **con cosa** si verifica, e `MODO_LICENZE` dice
 * **cosa se ne fa**:
 *
 *   · `spento`    nessuno guarda i gettoni, entrano tutti. E' com'e' oggi.
 *   · `registra`  i gettoni si verificano e si conta chi resterebbe fuori —
 *                 lo dice `/salute`, chiesto da dentro — ma entrano tutti.
 *   · `impone`    il fuori casa e' Premium: chi non ha un gettone buono si
 *                 chiude con `4402` (o `4426`, se l'add-on e' di prima).
 *
 * ─── Di serie, e quello che non si puo' fare per sbaglio ──────────────────
 *
 * Senza `MODO_LICENZE`: `spento` con la chiave vuota, `registra` con la
 * chiave scritta. Scrivere la chiave, quindi, **non chiude piu' niente** da
 * solo: comincia a contare. Per chiudere serve dirlo, `MODO_LICENZE=impone`,
 * in `/etc/tramite/ambiente`, e si torna indietro togliendo la riga e
 * riavviando — un minuto, senza rilasciare niente.
 *
 * E non si impone mai senza una chiave buona. Con la chiave vuota, o storta,
 * nessun gettone potrebbe valere: imporre vorrebbe dire chiudere fuori tutte
 * le case del mondo, paganti comprese. Chi lo chiede si sente dire di no nel
 * registro, a lettere grandi, e il centralino resta `spento`. Lo stesso per
 * una parola che non si conosce: un errore di battitura non deve mai essere
 * la strada per chiudere.
 */

export const MODI_DELLE_LICENZE = Object.freeze(["spento", "registra", "impone"]);

/* Una chiave buona: trentadue byte in base64url, senza `=`. Una chiave storta
 * non fa valere nessun gettone, ed e' come non averla. */
export function chiaveBuona(chiave) {
  const scritta = String(chiave ?? "");
  return /^[A-Za-z0-9_-]+$/.test(scritta) && Buffer.from(scritta, "base64url").length === 32;
}

/**
 * Il modo in cui si lavora davvero, da quello chiesto e dalla chiave.
 *
 * `chiesto` e' quello che c'e' scritto in `MODO_LICENZE` (vuoto o assente:
 * il modo di serie). Torna sempre uno dei tre, e dice nel registro quando non
 * e' quello chiesto, e perche'.
 */
export function ilModoDelleLicenze(chiesto, { chiave = "", registro } = {}) {
  const dice = registro ?? { info() {}, attenzione() {}, errore() {} };
  const buona = chiaveBuona(chiave);
  const scritta = String(chiave ?? "") !== "";
  const diSerie = buona ? "registra" : "spento";
  const parola = String(chiesto ?? "")
    .trim()
    .toLowerCase();

  if (!parola) return diSerie;

  if (!MODI_DELLE_LICENZE.includes(parola)) {
    dice.errore(
      `MODO_LICENZE=«${chiesto}» non e' un modo che conosco (spento, registra, impone): ` +
        `resto «${diSerie}», e da fuori entrano tutti`,
    );
    return diSerie;
  }

  if (parola !== "spento" && !buona) {
    dice.errore(
      `!!! MODO_LICENZE=${parola} ma la chiave pubblica delle licenze ` +
        `${scritta ? "e' storta" : "e' vuota"}: nessun gettone potrebbe valere, e ` +
        `${parola === "impone" ? "imporre chiuderebbe fuori tutte le case" : "non ci sarebbe niente da contare"}. ` +
        "Resto «spento»: da fuori entrano tutti, come prima. !!!",
    );
    return "spento";
  }

  return parola;
}
