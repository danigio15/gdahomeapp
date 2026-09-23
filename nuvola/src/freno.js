/* Il freno: quante volte in un'ora, per indirizzo e in tutto.
 *
 * Ogni casa e' un oggetto suo, e da dentro una casa le altre non si vedono:
 * «quante case sono nate nell'ultima ora» o «quante segnalazioni sono partite
 * in tutto» sono domande che nessuna casa sa rispondere. Le risponde questo,
 * che e' uno solo per tutto il centralino.
 *
 * Gli si chiede poco — una volta per ogni casa che nasce, e una per ogni
 * scrittura verso GitHub — quindi essere uno solo non e' un collo di
 * bottiglia. I conti stanno nel suo archivio, non in memoria: un oggetto che
 * non lavora viene spento, e un limite di un'ora che si azzera ogni due
 * minuti non sarebbe un limite.
 */

import { reteDi } from "./rete.js";

const UN_ORA = 60 * 60 * 1000;

/* Un tetto che non c'e' — `null`, perche' in JSON l'infinito non si scrive —
 * vuol dire nessun tetto. */
const tetto = (valore) =>
  valore === null || valore === undefined || !Number.isFinite(Number(valore))
    ? Infinity
    : Number(valore);

/* Oltre questi, un conto non si allunga: serve a dire «pieno», non a tenere
 * la storia. */
const CONTO_MASSIMO = 5000;

export class Freno {
  constructor(state) {
    this.state = state;
  }

  async fetch(richiesta) {
    const via = new URL(richiesta.url).pathname;
    if (via !== "/concedi" || richiesta.method !== "POST") {
      return new Response(null, { status: 404 });
    }
    let detto = {};
    try {
      detto = await richiesta.json();
    } catch (_errore) {
      return new Response(null, { status: 400 });
    }
    const si = await this.concedi(detto);
    return Response.json({ si });
  }

  /* Torna `true` e conta, se c'e' posto sia per quell'indirizzo sia in
   * tutto; torna `false` e non conta niente, se no. */
  async concedi({
    cosa = "",
    chi = "?",
    perChi = Infinity,
    inTutto = Infinity,
    adesso = Date.now(),
  }) {
    const tipo =
      String(cosa)
        .replace(/[^a-z-]/g, "")
        .slice(0, 20) || "altro";
    /* In IPv6 si conta la rete /64, non l'indirizzo: vedi `rete.js`. */
    const suo = `${tipo}|${reteDi(chi).slice(0, 64)}`;
    const tutti = `${tipo}|*`;
    const recenti = (valore) =>
      (Array.isArray(valore) ? valore : []).filter((quando) => adesso - quando < UN_ORA);

    const scritto = await this.state.storage.get([suo, tutti]);
    const suoi = recenti(scritto.get(suo));
    const diTutti = recenti(scritto.get(tutti));
    if (diTutti.length >= tetto(inTutto) || suoi.length >= tetto(perChi)) return false;

    suoi.push(adesso);
    diTutti.push(adesso);
    await this.state.storage.put({
      [suo]: suoi.slice(-CONTO_MASSIMO),
      [tutti]: diTutti.slice(-CONTO_MASSIMO),
    });
    const allarme = await this.state.storage.getAlarm();
    if (allarme === null || allarme === undefined) {
      await this.state.storage.setAlarm(adesso + UN_ORA);
    }
    return true;
  }

  /* Una volta l'ora si butta via quello che non conta piu': gli indirizzi
   * che non si sono fatti vivi nell'ultima ora non devono restare scritti. */
  async alarm() {
    const adesso = Date.now();
    const tutto = await this.state.storage.list();
    const via = [];
    let resta = false;
    for (const [chiave, valore] of tutto) {
      const vivi = (Array.isArray(valore) ? valore : []).filter(
        (quando) => adesso - quando < UN_ORA,
      );
      if (vivi.length) resta = true;
      else via.push(chiave);
    }
    for (let da = 0; da < via.length; da += 128) {
      await this.state.storage.delete(via.slice(da, da + 128));
    }
    if (resta) await this.state.storage.setAlarm(adesso + UN_ORA);
  }
}
