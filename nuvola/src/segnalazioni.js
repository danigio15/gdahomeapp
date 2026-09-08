/* Le segnalazioni e la chat: dall'app a chi mantiene il progetto, e ritorno.
 *
 * Una segnalazione aperta dall'app diventa una **issue** in una repository di
 * GitHub scelta da chi mantiene il progetto; la chat di assistenza e' una
 * issue sola per casa, che resta aperta e cresce di commento in commento. Il
 * manutentore risponde da GitHub — un commento sotto la issue — e chi ha
 * scritto se lo ritrova nell'app. Nessuna console da costruire: la console
 * e' GitHub.
 *
 * Perche' passa dal centralino e non dal telefono: il gettone di GitHub e'
 * del manutentore e non deve stare su nessun telefono e in nessun ponte. Sta
 * qui, come segreto del Worker, e viaggia solo verso api.github.com. La casa
 * si presenta col suo segreto — lo stesso della chiamata — e puo' leggere e
 * scrivere solo nelle issue che ha aperto lei.
 *
 * Chi ha scritto cosa: tutti i commenti li scrive lo stesso gettone, quindi
 * l'autore non basta a distinguere. Quelli della casa portano un segno in
 * testa, invisibile su GitHub; gli altri sono del manutentore.
 */

export const TIPI = Object.freeze(["problema", "idea", "domanda", "chat"]);
export const TITOLO_MASSIMO = 120;
export const CORPO_MASSIMO = 8000;
export const MESSAGGIO_MASSIMO = 4000;

/* Quante segnalazioni aperte puo' avere una casa, e quante scritture in
 * un'ora: un'app impazzita non deve riempire la repository. */
export const APERTE_MASSIME = 10;
export const SCRITTURE_ALLORA = 60;

export const MARCATORE_CASA = "<!-- gdahome:casa -->";
const MARCATORE_DIAGNOSTICA = "<!-- gdahome:diagnostica -->";

const testo = (valore, massimo) =>
  String(valore ?? "")
    .trim()
    .slice(0, massimo);

/* ─── Le forme ───────────────────────────────────────────────────────────── */

/* Il corpo della issue: quello che la persona ha scritto, poi la diagnostica
 * raccolta da sola, separate da un segno che al ritorno permette di ridare
 * alla persona solo le sue parole. */
export function corpoDellaIssue({ corpo, diagnostica, casa }) {
  const righe = [testo(corpo, CORPO_MASSIMO)];
  const voci = Object.entries(diagnostica || {}).filter(
    ([chiave, valore]) => chiave && valore !== undefined && valore !== null && valore !== "",
  );
  if (voci.length || casa) {
    righe.push("", "---", MARCATORE_DIAGNOSTICA, "", "| | |", "|---|---|");
    for (const [chiave, valore] of voci.slice(0, 40)) {
      righe.push(`| ${pulisci(chiave)} | ${pulisci(String(valore))} |`);
    }
    if (casa) righe.push(`| casa | \`${pulisci(String(casa)).slice(0, 12)}\` |`);
  }
  return righe.join("\n");
}

const pulisci = (valore) =>
  String(valore)
    .replace(/[|\r\n]+/g, " ")
    .trim()
    .slice(0, 200);

/* Le parole della persona, senza la diagnostica. */
export function paroleDellaPersona(corpo) {
  const tutto = String(corpo ?? "");
  const dove = tutto.indexOf(`---\n${MARCATORE_DIAGNOSTICA}`);
  return (dove >= 0 ? tutto.slice(0, dove) : tutto).trim();
}

/* Un commento di GitHub, come lo vede l'app: di chi e', cosa dice, quando. */
export function classifica(commento) {
  const corpo = String(commento?.body ?? "");
  const dallaCasa = corpo.startsWith(MARCATORE_CASA);
  return {
    da: dallaCasa ? "casa" : "manutentore",
    testo: (dallaCasa ? corpo.slice(MARCATORE_CASA.length) : corpo).trim(),
    il: commento?.created_at || "",
  };
}

/* Il filo intero: la issue e i suoi commenti, nella forma dell'app. */
export function filo(voce, issue, commenti) {
  return {
    numero: Number(issue?.number ?? voce?.numero),
    tipo: voce?.tipo || "problema",
    titolo: voce?.titolo || String(issue?.title ?? ""),
    stato: issue?.state === "closed" ? "chiusa" : "aperta",
    aperta_il: issue?.created_at || voce?.aperta_il || "",
    aggiornata_il: issue?.updated_at || "",
    url: issue?.html_url || voce?.url || "",
    messaggi: [
      { da: "casa", testo: paroleDellaPersona(issue?.body), il: issue?.created_at || "" },
      ...(Array.isArray(commenti) ? commenti : []).map(classifica),
    ],
  };
}

/* ─── GitHub ─────────────────────────────────────────────────────────────── */

export class GitHubNonRisponde extends Error {
  constructor(stato, messaggio) {
    super(messaggio || `GitHub ha risposto ${stato}`);
    this.stato = stato;
  }
}

export class GitHub {
  constructor({ token, repo, fetch: prendi = globalThis.fetch, base = "https://api.github.com" }) {
    this.token = token;
    this.repo = repo;
    this.prendi = prendi;
    this.base = base;
  }

  get pronto() {
    return Boolean(this.token && /^[\w.-]+\/[\w.-]+$/.test(String(this.repo || "")));
  }

  async _chiama(metodo, via, corpo) {
    const risposta = await this.prendi(`${this.base}/repos/${this.repo}${via}`, {
      method: metodo,
      headers: {
        authorization: `Bearer ${this.token}`,
        accept: "application/vnd.github+json",
        "user-agent": "gdahome-centralino",
        "x-github-api-version": "2022-11-28",
        ...(corpo ? { "content-type": "application/json" } : {}),
      },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    if (!risposta.ok) {
      let perche = "";
      try {
        perche = (await risposta.json())?.message || "";
      } catch (_errore) {
        /* Senza corpo. */
      }
      throw new GitHubNonRisponde(risposta.status, perche);
    }
    return risposta.status === 204 ? null : risposta.json();
  }

  apriIssue({ titolo, corpo, etichette }) {
    return this._chiama("POST", "/issues", { title: titolo, body: corpo, labels: etichette });
  }

  leggiIssue(numero) {
    return this._chiama("GET", `/issues/${numero}`);
  }

  commenti(numero) {
    return this._chiama("GET", `/issues/${numero}/comments?per_page=100`);
  }

  commenta(numero, testo) {
    return this._chiama("POST", `/issues/${numero}/comments`, { body: testo });
  }
}

/* ─── Le segnalazioni di una casa ────────────────────────────────────────── */

export class RichiestaSbagliata extends Error {
  constructor(codice, messaggio, stato = 400) {
    super(messaggio);
    this.codice = codice;
    this.stato = stato;
  }
}

/* Vive dentro l'oggetto della casa: `storage` e' il suo, e le issue che
 * conosce sono solo le sue. */
export class Segnalazioni {
  constructor({ storage, github, casa, adesso = () => Date.now() }) {
    this.storage = storage;
    this.github = github;
    this.casa = casa;
    this.adesso = adesso;
  }

  async elenco() {
    return (await this.storage.get("segnalazioni")) ?? [];
  }

  async crea({ tipo, titolo, corpo, diagnostica }) {
    this._pronto();
    const quale = TIPI.includes(tipo) && tipo !== "chat" ? tipo : "problema";
    const titoloPulito = testo(titolo, TITOLO_MASSIMO);
    const corpoPulito = testo(corpo, CORPO_MASSIMO);
    if (!titoloPulito) throw new RichiestaSbagliata("manca_il_titolo", "Manca il titolo.");
    if (!corpoPulito) throw new RichiestaSbagliata("manca_il_corpo", "Manca il testo.");
    const elenco = await this.elenco();
    if (elenco.filter((una) => una.stato !== "chiusa").length >= APERTE_MASSIME) {
      throw new RichiestaSbagliata(
        "troppe",
        `Ci sono gia' ${APERTE_MASSIME} segnalazioni aperte per questa casa.`,
        429,
      );
    }
    await this._contaUnaScrittura();
    const issue = await this.github.apriIssue({
      titolo: `[${quale}] ${titoloPulito}`,
      corpo: corpoDellaIssue({ corpo: corpoPulito, diagnostica, casa: this.casa }),
      etichette: ["gdahome", quale],
    });
    const voce = {
      numero: issue.number,
      tipo: quale,
      titolo: titoloPulito,
      stato: "aperta",
      aperta_il: issue.created_at || new Date(this.adesso()).toISOString(),
      url: issue.html_url || "",
    };
    await this.storage.put("segnalazioni", [voce, ...elenco]);
    return filo(voce, issue, []);
  }

  async leggi(numero) {
    this._pronto();
    const voce = await this._mia(numero);
    const [issue, commenti] = await Promise.all([
      this.github.leggiIssue(voce.numero),
      this.github.commenti(voce.numero),
    ]);
    await this._aggiorna(voce, issue);
    return filo(voce, issue, commenti);
  }

  async rispondi(numero, messaggio) {
    this._pronto();
    const voce = await this._mia(numero);
    const pulito = testo(messaggio, MESSAGGIO_MASSIMO);
    if (!pulito) throw new RichiestaSbagliata("manca_il_testo", "Manca il testo.");
    await this._contaUnaScrittura();
    await this.github.commenta(voce.numero, `${MARCATORE_CASA}\n${pulito}`);
    return this.leggi(voce.numero);
  }

  /* La chat: una issue sola per casa, che nasce alla prima parola. */
  async chat() {
    this._pronto();
    const numero = await this.storage.get("chat");
    if (numero) {
      const voce = { numero, tipo: "chat", titolo: "Chat di assistenza" };
      const [issue, commenti] = await Promise.all([
        this.github.leggiIssue(numero),
        this.github.commenti(numero),
      ]);
      return filo(voce, issue, commenti);
    }
    return null;
  }

  async chatta(messaggio, diagnostica) {
    this._pronto();
    const pulito = testo(messaggio, MESSAGGIO_MASSIMO);
    if (!pulito) throw new RichiestaSbagliata("manca_il_testo", "Manca il testo.");
    await this._contaUnaScrittura();
    let numero = await this.storage.get("chat");
    if (!numero) {
      const issue = await this.github.apriIssue({
        titolo: `[chat] Casa ${String(this.casa || "").slice(0, 12)}`,
        corpo: corpoDellaIssue({ corpo: pulito, diagnostica, casa: this.casa }),
        etichette: ["gdahome", "chat"],
      });
      numero = issue.number;
      await this.storage.put("chat", numero);
      return filo({ numero, tipo: "chat", titolo: "Chat di assistenza" }, issue, []);
    }
    await this.github.commenta(numero, `${MARCATORE_CASA}\n${pulito}`);
    return this.chat();
  }

  _pronto() {
    if (!this.github?.pronto) {
      throw new RichiestaSbagliata(
        "non_configurate",
        "Il centralino non ha le segnalazioni accese: manca il gettone di GitHub o la repository.",
        503,
      );
    }
  }

  async _mia(numero) {
    const voce = (await this.elenco()).find((una) => una.numero === Number(numero));
    if (!voce)
      throw new RichiestaSbagliata(
        "non_trovata",
        "Questa segnalazione non e' di questa casa.",
        404,
      );
    return voce;
  }

  async _aggiorna(voce, issue) {
    const stato = issue?.state === "closed" ? "chiusa" : "aperta";
    if (voce.stato === stato) return;
    const elenco = await this.elenco();
    await this.storage.put(
      "segnalazioni",
      elenco.map((una) => (una.numero === voce.numero ? { ...una, stato } : una)),
    );
    voce.stato = stato;
  }

  async _contaUnaScrittura() {
    const ora = this.adesso();
    const recenti = ((await this.storage.get("scritture")) ?? []).filter(
      (quando) => ora - quando < 3_600_000,
    );
    if (recenti.length >= SCRITTURE_ALLORA) {
      throw new RichiestaSbagliata(
        "troppe",
        "Troppe scritture in un'ora: riprova piu' tardi.",
        429,
      );
    }
    recenti.push(ora);
    await this.storage.put("scritture", recenti);
  }
}
