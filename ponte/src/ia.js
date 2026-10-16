/* L'intelligenza in casa: Ollama, dentro l'add-on gdahome.
 *
 * «Ingloba Ollama all'interno, che possa essere intelligente» — e «deve
 * essere tutto in un add-on». Chi accende «Intelligenza dell'assistente»
 * nelle opzioni si trova Ollama acceso dentro questo stesso add-on (`run.sh`),
 * che ascolta solo su 127.0.0.1: non lo raggiunge nessun altro, e dal ponte
 * da fuori non si vede. Il modello la prima volta lo scarica il ponte, in
 * /data, e da li' resta. Una domanda sola, una volta al giorno: cosa sono le
 * cose che dal nome non si riconoscono.
 *
 * Quello che esce verso il modello e' poco e scelto: l'id e il nome di luci,
 * prese e porte. Mai persone, posizioni, telecamere, codici. E il modello
 * gira in casa: niente va fuori. Spenta, o su una macchina a 32 bit dove
 * Ollama non c'e', non succede niente: l'assistente resta con le sue regole
 * e le sue abitudini.
 *
 * Il modello risponde in JSON (`format: "json"`), e la risposta si prende
 * solo per quello che e' previsto: un genere fra quelli conosciuti, per un id
 * che e' stato chiesto. Un modello che inventa non scrive niente.
 */

const ATTESA = 60 * 1000;
/* Il primo scaricamento del modello: un gigabyte, anche su una linea lenta. */
const ATTESA_DEL_MODELLO = 60 * 60 * 1000;

/* I generi che il modello puo' dire, e cosa vogliono dire per l'assistente. */
export const GENERI_DELL_IA = Object.freeze([
  "acquario",
  "terrario",
  "notte",
  "esterno",
  "sempre",
  "interna",
  "normale",
]);

const DOMANDA = `Sei l'assistente di una casa domotica. Per ogni dispositivo dimmi cos'e', con una sola parola fra queste:
- acquario: luce o pompa di un acquario o di una vasca di pesci;
- terrario: luce o lampada di un terrario o di animali;
- notte: luce notturna, segnapasso, luce di cortesia;
- esterno: luce o presa fuori casa (giardino, terrazzo, vialetto, facciata);
- sempre: cosa che deve restare accesa (frigo, freezer, server, router, modem, caldaia, allarme);
- interna: porta fra due stanze della casa (non verso fuori);
- normale: tutto il resto.
Rispondi solo con un oggetto JSON: {"<id>": "<parola>", ...}. Nel dubbio: normale.`;

export class Ia {
  constructor({
    url = process.env.PONTE_IA || "",
    modello = process.env.PONTE_IA_MODELLO || "qwen2.5:1.5b",
    fetch: prendi = globalThis.fetch,
    registro = null,
  } = {}) {
    /* Solo in casa: un indirizzo che non e' locale non si usa. */
    this.url = /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(String(url)) ? String(url) : "";
    this.modello = String(modello || "").trim() || "qwen2.5:1.5b";
    this.prendi = prendi;
    this.registro = registro;
    this._modelloPronto = false;
  }

  /** Se l'intelligenza e' accesa nelle opzioni e Ollama c'e'. */
  get accesa() {
    return Boolean(this.url) && typeof this.prendi === "function";
  }

  /* Il modello c'e'? Se no, lo si scarica: la prima volta ci vuole un po'. */
  async _ilModello() {
    if (this._modelloPronto) return true;
    const elenco = await this.prendi(`${this.url}/api/tags`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!elenco.ok) return false;
    const nomi = ((await elenco.json())?.models || []).map((m) =>
      String(m?.name || m?.model || ""),
    );
    const conLaVersione = this.modello.includes(":") ? this.modello : `${this.modello}:latest`;
    if (!nomi.includes(conLaVersione)) {
      this.registro?.info?.(
        `intelligenza: scarico il modello ${this.modello}, la prima volta ci vuole un po'`,
      );
      const presa = await this.prendi(`${this.url}/api/pull`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: this.modello, stream: false }),
        signal: AbortSignal.timeout(ATTESA_DEL_MODELLO),
      });
      if (!presa.ok) return false;
      this.registro?.info?.(`intelligenza: il modello ${this.modello} e' pronto`);
    }
    this._modelloPronto = true;
    return true;
  }

  /** Dove sta Ollama e con che modello, se e' accesa e pronta; o `null`. */
  async dove() {
    if (!this.accesa) return null;
    try {
      return (await this._ilModello()) ? { url: this.url, modello: this.modello } : null;
    } catch {
      return null;
    }
  }

  /**
   * Cosa sono queste cose: `[{ id, nome, stanza? }]` → `{ id: genere }`, solo
   * per gli id chiesti e i generi conosciuti. `null` se il modello non c'e'.
   */
  async riconosci(cose = []) {
    const lista = cose
      .filter((c) => typeof c?.id === "string" && c.id.includes("."))
      .slice(0, 60)
      .map((c) => ({
        id: c.id,
        nome: String(c.nome || "").slice(0, 60),
        ...(c.stanza ? { stanza: String(c.stanza).slice(0, 40) } : {}),
      }));
    if (!lista.length) return {};
    const dove = await this.dove();
    if (!dove) return null;
    try {
      const risposta = await this.prendi(`${dove.url}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: dove.modello,
          stream: false,
          format: "json",
          options: { temperature: 0 },
          messages: [
            { role: "system", content: DOMANDA },
            { role: "user", content: JSON.stringify(lista) },
          ],
        }),
        signal: AbortSignal.timeout(ATTESA),
      });
      if (!risposta.ok) return null;
      const testo = (await risposta.json())?.message?.content;
      const detto = JSON.parse(String(testo || "{}"));
      const chiesti = new Set(lista.map((c) => c.id));
      const fuori = {};
      for (const [id, genere] of Object.entries(detto && typeof detto === "object" ? detto : {})) {
        const g = String(genere || "")
          .trim()
          .toLowerCase();
        if (chiesti.has(id) && GENERI_DELL_IA.includes(g)) fuori[id] = g;
      }
      return fuori;
    } catch (errore) {
      this.registro?.attenzione?.(`gdahome AI non ha risposto: ${errore?.message || errore}`);
      return null;
    }
  }
}
