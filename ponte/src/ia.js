/* L'intelligenza in casa: il ponte chiede a gdahome AI (Ollama).
 *
 * «Ingloba Ollama all'interno, che possa essere intelligente.» L'add-on
 * `gdahome AI` (cartella `ia/`) fa girare Ollama sulla rete interna degli
 * add-on. Qui il ponte lo trova — chiedendo al Supervisor com'e' messo e qual
 * e' il suo nome sulla rete — e gli fa una domanda sola, una volta al giorno:
 * cosa sono le cose che dal nome non si riconoscono.
 *
 * Quello che esce verso il modello e' poco e scelto: l'id e il nome di luci,
 * prese e porte. Mai persone, posizioni, telecamere, codici. E il modello
 * gira in casa: niente va fuori. Senza l'add-on, o con l'add-on fermo, non
 * succede niente: l'assistente resta con le sue regole e le sue abitudini.
 *
 * Il modello risponde in JSON (`format: "json"`), e la risposta si prende
 * solo per quello che e' previsto: un genere fra quelli conosciuti, per un id
 * che e' stato chiesto. Un modello che inventa non scrive niente.
 */

const SLUG = /(^|_)gdahome_ia$/;
const PORTA = 11434;
const ATTESA = 60 * 1000;

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
    segno = process.env.SUPERVISOR_TOKEN || "",
    supervisor = process.env.PONTE_SUPERVISOR || "http://supervisor",
    fetch: prendi = globalThis.fetch,
    registro = null,
  } = {}) {
    this.segno = segno;
    this.supervisor = String(supervisor).replace(/\/+$/, "");
    this.prendi = prendi;
    this.registro = registro;
  }

  async _alSupervisor(via) {
    const risposta = await this.prendi(`${this.supervisor}${via}`, {
      headers: { authorization: `Bearer ${this.segno}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!risposta.ok) return null;
    return (await risposta.json())?.data ?? null;
  }

  /** Dove sta Ollama, se l'add-on c'e' e gira: `http://host:11434`, o `null`. */
  async dove() {
    if (!this.segno || typeof this.prendi !== "function") return null;
    try {
      const elenco = await this._alSupervisor("/addons");
      const addon = (elenco?.addons || []).find((a) => SLUG.test(String(a?.slug || "")));
      if (!addon || addon.state !== "started") return null;
      const info = await this._alSupervisor(`/addons/${addon.slug}/info`);
      const host = String(info?.hostname || "").trim();
      if (!/^[a-z0-9-]+$/i.test(host)) return null;
      const modello = String(info?.options?.modello || "").trim();
      return { url: `http://${host}:${PORTA}`, modello: modello || "qwen2.5:1.5b" };
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
