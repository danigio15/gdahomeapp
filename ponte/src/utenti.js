/* Chi c'e' in questa casa, e chi la amministra.
 *
 * Serve a due cose, e sono due cose diverse:
 *
 *  1. **disegnare le spunte** di «chi la vede» nella pagina di gdahome: un
 *     elenco di nomi da mettere in colonna;
 *  2. **rispondere a una domanda** quando qualcuno apre una plancia riservata
 *     a chi amministra: questo utente amministra?
 *
 * La seconda e' quella che conta, e il motivo per cui questo file esiste.
 * L'ingress di Home Assistant, in testa a ogni richiesta, scrive **chi** sta
 * guardando (`X-Remote-User-Id`) e non scrive **se amministra**. Percio' quel
 * pezzo va chiesto a Home Assistant, ed e' la sola cosa che questo file fa:
 * `config/auth/list`, e la risposta tenuta da parte per un minuto.
 *
 * **L'elenco non si copia sul disco.** Un elenco di utenti salvato invecchia:
 * chi ha tolto una persona da casa se la ritroverebbe ancora abilitata, e chi
 * ha fatto amministratore qualcuno resterebbe fuori. Vive un minuto in memoria
 * e poi si richiede.
 *
 * **Quando Home Assistant non risponde si tiene l'ultima buona**, vecchia
 * com'e'. Non e' pigrizia: l'alternativa e' che un singolo singhiozzo di Home
 * Assistant chiuda la plancia in faccia anche a chi la amministra. Una risposta
 * di un minuto fa e' quasi sempre la stessa; nessuna risposta non e' mai
 * giusta.
 */

/* Quanto vale una risposta prima di richiederla. Un minuto: abbastanza per non
 * chiedere a Home Assistant una volta per ogni pagina aperta, poco abbastanza
 * perche' un utente appena aggiunto compaia subito nelle spunte. */
const QUANTO_VALE = 60 * 1000;

/* Il gruppo degli amministratori, come lo chiama Home Assistant. */
const CHI_AMMINISTRA = "system-admin";

export class UtentiDiCasa {
  constructor({ casa, registro, adesso = () => Date.now(), quantoVale = QUANTO_VALE } = {}) {
    this.casa = casa;
    this.registro = registro ?? { info() {}, attenzione() {}, errore() {} };
    this.adesso = adesso;
    this.quantoVale = quantoVale;
    /* L'ultima risposta buona, e quando e' arrivata. `null` vuol dire «non ne
     * ho mai avuta una», che non e' la stessa cosa di «ne ho una vecchia». */
    this._ultimi = null;
    this._quando = 0;
    /* La richiesta in volo, se ce n'e' una: dieci pagine aperte insieme fanno
     * una domanda a Home Assistant, non dieci. */
    this._inVolo = null;
    /* Se l'ultimo tentativo e' andato male lo si dice una volta, non a ogni
     * richiesta: un registro che ripete la stessa riga ogni pagina aperta e'
     * un registro che non si legge piu'. */
    this._dettoIlGuaio = false;
  }

  /* L'elenco, chiesto a Home Assistant o ripreso da quello che c'e' in mano.
   *
   * Gli utenti **di sistema** non ci sono: sono quelli che Home Assistant fa da
   * se' per gli add-on e per le integrazioni — questo add-on ne ha uno — e in
   * una lista di «chi vede la plancia» sarebbero righe che non sono persone. */
  async elenco() {
    if (this._ultimi && this.adesso() - this._quando < this.quantoVale) return this._ultimi;
    if (this._inVolo) return this._inVolo;
    this._inVolo = this._chiedi().finally(() => {
      this._inVolo = null;
    });
    return this._inVolo;
  }

  async _chiedi() {
    try {
      const dentro = await this.casa.chiedi({ type: "config/auth/list" });
      const elenco = Array.isArray(dentro) ? dentro : [];
      this._ultimi = elenco
        .filter((uno) => uno && !uno.system_generated)
        .map((uno) => ({
          id: String(uno.id || ""),
          nome: String(uno.name || uno.username || "senza nome").slice(0, 60),
          amministratore:
            Boolean(uno.is_owner) ||
            (Array.isArray(uno.group_ids) ? uno.group_ids : []).includes(CHI_AMMINISTRA),
          attivo: uno.is_active !== false,
        }))
        .filter((uno) => uno.id);
      this._quando = this.adesso();
      this._dettoIlGuaio = false;
      return this._ultimi;
    } catch (errore) {
      if (!this._dettoIlGuaio) {
        this._dettoIlGuaio = true;
        this.registro.attenzione(
          `non riesco a chiedere chi c'e' in casa: ${errore?.message || errore}`,
        );
      }
      /* Si tiene l'ultima buona, vecchia com'e'. Se non ce n'e' mai stata una,
       * il guaio esce di qui: chi ha chiamato deve sapere che non lo sa
       * nessuno, e decidere lui cosa farne. */
      if (this._ultimi) return this._ultimi;
      throw errore;
    }
  }

  /* Se questo utente amministra la casa. `false` anche per un utente che non
   * esiste: non esistere non e' un titolo. */
  async amministratore(chi) {
    const cercato = String(chi || "").trim();
    if (!cercato) return false;
    const elenco = await this.elenco();
    return elenco.some((uno) => uno.id === cercato && uno.amministratore);
  }

  /* Lo stesso, ma **senza chiedere niente a nessuno**: solo da quello che c'e'
   * gia' in mano, anche vecchio. `null` vuol dire «non lo so», e chi chiama
   * deve saper stare anche su quella risposta.
   *
   * Serve nel punto dove non si puo' aspettare: la salita del WebSocket della
   * plancia, che va accettata o rifiutata subito. */
  amministratoreSubito(chi) {
    const cercato = String(chi || "").trim();
    if (!cercato) return false;
    if (!this._ultimi) return null;
    return this._ultimi.some((uno) => uno.id === cercato && uno.amministratore);
  }
}
