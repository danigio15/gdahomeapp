/* L'indirizzo di un punto: «Via Roma 12, Milano» invece di due numeri.
 *
 * «Non mi devi mostrare coordinate ma voglio vedere indirizzo.» Il
 * device_tracker dell'auto dice dov'e' in latitudine e longitudine, e Home
 * Assistant da solo non sa dire la via. La via la sa OpenStreetMap
 * (Nominatim, https://nominatim.org), e la si chiede da qui, dal ponte, in
 * casa: la plancia e il telefono chiedono al ponte, il ponte chiede a
 * Nominatim.
 *
 * ── Cosa esce di casa, e cosa no ─────────────────────────────────────────
 *
 * Esce il punto, e basta: due numeri arrotondati a quattro decimali (una
 * decina di metri), senza nomi, senza entita', senza chi sta guardando. Non
 * passa dal centralino ne' da nessun server di GdAHome. Nei registri del
 * ponte non si scrivono ne' le coordinate ne' l'indirizzo.
 *
 * ── Le regole di Nominatim ───────────────────────────────────────────────
 *
 * Il servizio pubblico chiede (https://operations.osmfoundation.org/policies/nominatim/):
 * al piu' una domanda al secondo, un nome che dica chi chiede, e di tenere
 * da parte le risposte. Quindi: una domanda per volta, con almeno 1,1 s fra
 * una e l'altra; le risposte si tengono in memoria per sette giorni (al piu'
 * cinquecento); e un punto gia' chiesto non si richiede. Un'auto parcheggiata
 * fa una domanda sola.
 */

export const NOMINATIM = "https://nominatim.openstreetmap.org/reverse";
const ATTESA = 10_000;
const FRA_DUE_DOMANDE = 1100;
const DURANO = 7 * 24 * 60 * 60 * 1000;
const AL_PIU = 500;

const numero = (valore) => {
  const n = typeof valore === "number" ? valore : Number(String(valore ?? "").trim());
  return Number.isFinite(n) ? n : null;
};

const dorme = (ms) => new Promise((fatto) => setTimeout(fatto, ms));

/** Il punto buono, o `null`: due numeri dentro il mondo, e non lo zero. */
export function puntoBuono(lat, lon) {
  const a = numero(lat);
  const b = numero(lon);
  if (a === null || b === null) return null;
  if (Math.abs(a) > 90 || Math.abs(b) > 180 || (a === 0 && b === 0)) return null;
  return { lat: Math.round(a * 1e4) / 1e4, lon: Math.round(b * 1e4) / 1e4 };
}

/**
 * L'indirizzo da scrivere, dalla risposta di Nominatim: via e numero, e la
 * citta'. Senza via, il posto (un parcheggio, un centro commerciale) o la
 * frazione; e se proprio non c'e' niente, i primi pezzi di `display_name`.
 */
export function indirizzoDaNominatim(risposta) {
  const a = risposta?.address && typeof risposta.address === "object" ? risposta.address : {};
  const testo = (valore) => (typeof valore === "string" ? valore.trim() : "");
  const via = testo(a.road) || testo(a.pedestrian) || testo(a.footway) || testo(a.path);
  const civico = testo(a.house_number);
  const luogo =
    testo(a.city) ||
    testo(a.town) ||
    testo(a.village) ||
    testo(a.hamlet) ||
    testo(a.suburb) ||
    testo(a.municipality);
  const posto = testo(a.amenity) || testo(a.shop) || testo(a.tourism) || testo(a.leisure);
  const primo = via ? [via, civico].filter(Boolean).join(" ") : posto;
  const fatto = [primo, luogo].filter(Boolean).join(", ");
  if (fatto) return fatto;
  const tutto = testo(risposta?.display_name);
  return tutto
    ? tutto
        .split(",")
        .slice(0, 3)
        .map((pezzo) => pezzo.trim())
        .join(", ")
    : "";
}

export class Indirizzi {
  constructor({
    prendi = globalThis.fetch,
    adesso = () => Date.now(),
    aspetta = dorme,
    versione = "",
    lingua = "it",
  } = {}) {
    this.prendi = prendi;
    this.adesso = adesso;
    this.aspetta = aspetta;
    this.chi = `GdAHome${versione ? `/${versione}` : ""} (add-on per Home Assistant)`;
    this.lingua = lingua;
    /** "lat,lon" → { indirizzo, il } */
    this._tenuti = new Map();
    /** "lat,lon" → Promise, per non chiedere due volte lo stesso punto. */
    this._inCorso = new Map();
    /* La coda: una domanda dopo l'altra. */
    this._coda = Promise.resolve();
    this._ultima = 0;
  }

  /**
   * L'indirizzo del punto, o `""` se non si sa. Non lancia: una via che non
   * arriva e' una pastiglia che dice «Fuori casa», non una pagina rotta.
   */
  async indirizzoDi(lat, lon) {
    const punto = puntoBuono(lat, lon);
    if (!punto) return "";
    const chiave = `${punto.lat.toFixed(4)},${punto.lon.toFixed(4)}`;
    const tenuto = this._tenuti.get(chiave);
    if (tenuto && this.adesso() - tenuto.il < DURANO) return tenuto.indirizzo;
    const gia = this._inCorso.get(chiave);
    if (gia) return gia;
    const domanda = (this._coda = this._coda.then(() => this._chiedi(punto)))
      .then((indirizzo) => {
        if (indirizzo) this._tieni(chiave, indirizzo);
        return indirizzo;
      })
      .catch(() => "")
      .finally(() => this._inCorso.delete(chiave));
    this._inCorso.set(chiave, domanda);
    return domanda;
  }

  async _chiedi(punto) {
    const manca = this._ultima + FRA_DUE_DOMANDE - this.adesso();
    if (manca > 0) await this.aspetta(manca);
    this._ultima = this.adesso();
    const url =
      `${NOMINATIM}?format=jsonv2&zoom=18&addressdetails=1` +
      `&lat=${punto.lat.toFixed(4)}&lon=${punto.lon.toFixed(4)}` +
      `&accept-language=${encodeURIComponent(this.lingua)}`;
    try {
      const risposta = await this.prendi(url, {
        headers: { "user-agent": this.chi, accept: "application/json" },
        signal: AbortSignal.timeout(ATTESA),
      });
      if (!risposta?.ok) return "";
      return indirizzoDaNominatim(await risposta.json());
    } catch (_errore) {
      return "";
    }
  }

  _tieni(chiave, indirizzo) {
    this._tenuti.delete(chiave);
    this._tenuti.set(chiave, { indirizzo, il: this.adesso() });
    while (this._tenuti.size > AL_PIU) this._tenuti.delete(this._tenuti.keys().next().value);
  }
}
