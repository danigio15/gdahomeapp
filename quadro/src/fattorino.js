/* Chi porta fuori gli avvisi.
 *
 * `avvisi.js` decide **cosa** dire; questo lo consegna. Sono due file perche'
 * sono due mestieri: le regole si provano senza rete, e la rete si prova senza
 * dover fabbricare una casa muta.
 *
 * ─── Un indirizzo, e nient'altro ─────────────────────────────────────────
 *
 * Si manda un `POST` con dentro il messaggio, a un indirizzo che da'
 * l'installatore. Niente posta elettronica, e non per pigrizia: mandare una
 * mail che arrivi davvero vuol dire un server SMTP, TLS, SPF, DKIM e una
 * reputazione da difendere, e il primo avviso che finisce nello spam e' un
 * avviso che non e' mai esistito.
 *
 * Un `POST` invece lo capiscono gia' tutti quelli che uno usa: Telegram —
 * `api.telegram.org/bot<…>/sendMessage?chat_id=<…>` — Slack, ntfy.sh, un
 * gestionale suo. E chi vuole la mail ci mette davanti tre righe sue.
 *
 * ─── Cosa si manda ───────────────────────────────────────────────────────
 *
 *     { "testo": "…", "tipo": "muta", "case": ["casa_…"], "quadro": "…" }
 *
 * `testo` per primo, perche' e' quello che serve: chi riceve spesso lo prende
 * cosi' com'e' e lo mostra. Gli altri campi servono a chi ci vuole costruire
 * sopra qualcosa.
 *
 * ─── Se non si riesce a consegnare ───────────────────────────────────────
 *
 * Non si riprova all'infinito e non si tiene una coda. Se un indirizzo non
 * risponde, l'avviso e' perso — e la casa resta segnata come **non avvisata**,
 * quindi al giro dopo ci si riprova per conto suo. E' un ripescaggio che costa
 * zero righe, e basta: dietro a una consegna che non riesce c'e' quasi sempre
 * un indirizzo sbagliato, e una coda non lo raddrizza.
 */

/** Quanto si aspetta chi riceve prima di lasciar perdere. */
export const ATTESA = 10 * 1000;

/* Solo `https`, e per lo stesso motivo della cartolina: nel messaggio c'e' il
 * nome che l'installatore ha dato a una casa, cioe' l'unica cosa in tutto
 * questo quadro che nomini una persona. Su `http` la leggerebbe chiunque stia
 * in mezzo. */
const BUONO = /^https:\/\/[^\s/]+/;

export const indirizzoBuono = (dove) => BUONO.test(String(dove ?? "").trim());

export class Fattorino {
  constructor({ prendi = fetch, registro = { info() {}, errore() {} } } = {}) {
    this.prendi = prendi;
    this.registro = registro;
  }

  /**
   * Consegna un messaggio. Torna `true` solo se e' arrivato davvero.
   *
   * Il `false` non e' un dettaglio: e' quello che tiene la casa segnata come
   * non avvisata, e quindi quello che fa riprovare al giro dopo.
   */
  async porta(dove, detto) {
    if (!indirizzoBuono(dove)) return false;
    try {
      const risposta = await this.prendi(dove, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          testo: detto.testo,
          tipo: detto.tipo,
          case: detto.case,
          quadro: "gdahome",
        }),
        signal: AbortSignal.timeout(ATTESA),
      });
      if (!risposta.ok) {
        this.registro.errore(`l'avviso non e' stato accettato: ${risposta.status}`);
        return false;
      }
      return true;
    } catch (errore) {
      this.registro.errore(`l'avviso non e' partito: ${errore?.message || errore}`);
      return false;
    }
  }
}
