/* Un codice di abbinamento vivo, e nient'altro.
 *
 * Serve a una domanda sola: «un telefono si presenta con questa impronta — a
 * quale casa lo mando?». La risposta la scrive la casa quando la console
 * fabbrica il codice, e vale cinque minuti.
 *
 * Perche' un oggetto per codice invece di un elenco unico: un elenco unico
 * sarebbe un punto solo per cui passano gli abbinamenti di tutte le case del
 * mondo — comodo da scrivere e un collo di bottiglia da tenere in piedi. Un
 * oggetto per impronta non esiste finche' non serve, non costa niente, e due
 * abbinamenti non si incontrano mai.
 *
 * **Il codice qui non arriva.** Arriva la sua impronta, e dall'impronta non si
 * torna indietro: chi leggesse questo oggetto non saprebbe cosa battere.
 */

/* La stessa finestra del codice, con un minuto di margine per gli orologi. */
const VIVE = 6 * 60 * 1000;

export class Codice {
  constructor(state) {
    this.state = state;
  }

  async fetch(richiesta) {
    const via = new URL(richiesta.url).pathname;

    if (via === "/apri" && richiesta.method === "POST") {
      const { casa } = await richiesta.json();
      await this.state.storage.put({ casa, scadeIl: Date.now() + VIVE });
      /* Un allarme lo cancella da solo: un abbinamento scaduto non deve
       * restare in giro ad aspettare che qualcuno lo guardi. */
      await this.state.storage.setAlarm(Date.now() + VIVE);
      return new Response(null, { status: 204 });
    }

    if (via === "/chiudi" && richiesta.method === "POST") {
      await this.state.storage.deleteAll();
      return new Response(null, { status: 204 });
    }

    const scritto = await this.state.storage.get(["casa", "scadeIl"]);
    const casa = scritto.get("casa");
    const scadeIl = scritto.get("scadeIl");
    if (!casa || !scadeIl || scadeIl <= Date.now()) {
      if (casa) await this.state.storage.deleteAll();
      return Response.json({ casa: null });
    }
    return Response.json({ casa });
  }

  async alarm() {
    await this.state.storage.deleteAll();
  }
}
