/* Chi parla di piu', in casa.
 *
 * Un telefono che riceve seicento eventi al minuto non ha un problema di
 * telefono: ha una casa che parla dieci volte al secondo. E quei dieci al
 * secondo, in una casa vera, non sono mille entita' che cambiano una volta —
 * sono **due o tre** che cambiano di continuo: un contatore di potenza, un
 * sensore di consumo istantaneo, una presa che misura i watt. Le altre
 * duecento stanno ferme per ore.
 *
 * Finche' non si sa **quali**, non c'e' niente da fare: si guarda una
 * diagnostica che dice «seicento eventi» e si tira a indovinare. Sapendolo,
 * il rimedio sta in Home Assistant e costa un minuto — a quelle due o tre si
 * mette un filtro, o le si tolgono dalla registrazione — e il traffico cala
 * di dieci volte senza toccare una riga di questo programma.
 *
 * **Come si conta, e quanto costa.** Un'espressione regolare sui primi
 * quattrocento caratteri, e niente altro: il nome dell'entita' in un evento di
 * Home Assistant sta in testa, e leggere il JSON per intero — su seicento
 * eventi al minuto — vorrebbe dire fare per misurare il lavoro che si sta
 * misurando. Il ponte gli eventi non li apre mai, li gira come sono, ed e'
 * per questo che sta dietro a una casa che parla molto.
 *
 * **Il minuto di cui si parla e' un minuto intero.** Due sacchetti: quello che
 * si sta riempiendo e quello di prima. Si racconta quello di prima, perche' un
 * contatore azzerato tre secondi fa direbbe «due eventi» a una casa che ne fa
 * seicento, e chi guarda si tranquillizzerebbe per un difetto di chi conta.
 * Finche' un minuto intero non c'e' si dice quello che c'e', e si dice anche
 * che e' parziale.
 */

/* Quanto dura un sacchetto. */
export const UN_MINUTO = 60_000;

/* Quante entita' si nominano. Cinque: chi legge cerca il colpevole, non un
 * inventario — e il colpevole, quando c'e', sta nelle prime due. */
export const QUANTE_SE_NE_DICONO = 5;

/* Quanto si guarda in testa al messaggio. Il tipo e il nome dell'entita' di un
 * evento di Home Assistant stanno nei primi duecento caratteri; quattrocento
 * sono il doppio, per le versioni che ci mettono in mezzo qualcosa. */
const QUANTO_SI_GUARDA = 400;

const E_UN_EVENTO = /"type"\s*:\s*"event"/;
const IL_NOME = /"entity_id"\s*:\s*"([^"]{1,255})"/;

export class Chiacchieroni {
  constructor({ adesso = () => Date.now(), quanto = UN_MINUTO } = {}) {
    this.adesso = adesso;
    this.quanto = quanto;
    this._ora = new Map();
    this._prima = null;
    this._daQuando = adesso();
    this._quantiOra = 0;
    this._quantiPrima = 0;
  }

  /* Un messaggio in partenza verso un telefono. Se non e' un evento non
   * conta, e se e' un evento senza nome — ce ne sono: `call_service`,
   * `automation_triggered` — conta fra i totali e non fra i nomi. */
  segna(testo) {
    if (typeof testo !== "string" || testo.length === 0) return;
    const testa = testo.length > QUANTO_SI_GUARDA ? testo.slice(0, QUANTO_SI_GUARDA) : testo;
    if (!E_UN_EVENTO.test(testa)) return;
    this._giraSeServe();
    this._quantiOra += 1;
    const trovato = IL_NOME.exec(testa);
    if (!trovato) return;
    const quale = trovato[1];
    this._ora.set(quale, (this._ora.get(quale) || 0) + 1);
  }

  _giraSeServe() {
    const adesso = this.adesso();
    if (adesso - this._daQuando < this.quanto) return;
    /* Un sacchetto solo indietro: di due minuti fa non importa a nessuno, e
     * tenerne dieci vorrebbe dire una diagnostica che racconta la settimana
     * scorsa a chi ha l'app che scatta adesso. */
    this._prima = this._ora;
    this._quantiPrima = this._quantiOra;
    this._ora = new Map();
    this._quantiOra = 0;
    this._daQuando = adesso;
  }

  /* Chi ha parlato di piu', e quanti eventi in tutto.
   *
   * `intero` dice se il minuto di cui si parla e' un minuto vero o quello che
   * si e' visto finora: un numero su mezzo minuto non si confronta con uno su
   * un minuto, e chi guarda ha il diritto di saperlo invece di dedurlo. */
  elenco(quanti = QUANTE_SE_NE_DICONO) {
    this._giraSeServe();
    const intero = this._prima !== null;
    const sacchetto = intero ? this._prima : this._ora;
    const totale = intero ? this._quantiPrima : this._quantiOra;
    const quali = [...sacchetto.entries()]
      .sort((uno, altro) => altro[1] - uno[1] || uno[0].localeCompare(altro[0]))
      .slice(0, Math.max(0, quanti))
      .map(([entita, eventi]) => ({ entita, eventi }));
    return {
      intero,
      /* Su quanto tempo: un minuto quando il minuto c'e', e i secondi
       * passati quando no. */
      secondi: intero
        ? Math.round(this.quanto / 1000)
        : Math.max(1, Math.round((this.adesso() - this._daQuando) / 1000)),
      eventi: totale,
      quali,
    };
  }
}
