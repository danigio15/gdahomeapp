/* Le segnalazioni: dall'app a chi mantiene il progetto, e ritorno.
 *
 * Una segnalazione aperta dall'app diventa una **issue** in una repository di
 * GitHub scelta da chi mantiene il progetto. Il manutentore risponde da GitHub
 * — un commento sotto la issue — e chi ha scritto se lo ritrova nell'app.
 * Nessuna console da costruire: la console e' GitHub.
 *
 * La chat di assistenza da qui non passa, e prima passava: era una issue sola
 * per casa, con l'etichetta «chat». Chiedere aiuto non e' segnalare un
 * difetto — si incolla un pezzo di configurazione, il nome delle proprie
 * entita' — e non si chiede a nessuno di farlo su una pagina che chiunque
 * puo' leggere. Quella chat e' la chat della dashboard, ha un centralino suo,
 * e la fa il ponte (`ponte/src/chat.js`).
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

export const TIPI = Object.freeze(["problema", "idea", "domanda"]);

/* Da dove arriva una segnalazione, e come si chiama la sua etichetta.
 *
 * Serve a chi legge l'elenco delle issue: «questa l'ha scritta qualcuno col
 * telefono in mano, quella qualcuno davanti a Home Assistant». Sono due
 * strade diverse — due programmi diversi, due modi diversi di rompersi — e
 * tenerle distinte vuol dire poterle filtrare.
 *
 * Un'etichetta e non una riga nella tabella: nella tabella c'era gia' il
 * `sistema` (web, android, ios), ma sta in fondo alla issue, aperta, e
 * nell'elenco non si vede. Filtrare si filtra per etichetta.
 *
 * La stampa il **ponte**, non chi scrive: le due strade sono due comandi
 * diversi, e quale dei due sia arrivato lo sa solo lui. Cosi' non c'e' niente
 * da indovinare e niente da falsificare. Quello che arriva qui si controlla
 * lo stesso — da fuori arriva sempre qualcosa che non ci si aspetta. */
export const DA_DOVE = Object.freeze({
  app: "da-app",
  plancia: "da-home-assistant",
});
export const DA_DI_DIFETTO = "app";
export const TITOLO_MASSIMO = 120;
export const CORPO_MASSIMO = 8000;
export const MESSAGGIO_MASSIMO = 4000;

/* Quante segnalazioni aperte puo' avere una casa, e quante scritture in
 * un'ora: un'app impazzita non deve riempire la repository. */
export const APERTE_MASSIME = 10;
export const SCRITTURE_ALLORA = 60;

export const MARCATORE_CASA = "<!-- gdahome:casa -->";
const MARCATORE_DIAGNOSTICA = "<!-- gdahome:diagnostica -->";

/* Gli allegati: foto e video, messi nella stessa repository delle issue,
 * sotto `allegati/<numero>/`, con un commento che li indica. Passano per
 * intero dal ponte e da qui, quindi c'e' un tetto: una foto ridotta pesa
 * qualche centinaio di chilobyte, un video corto qualche megabyte. */
export const ALLEGATO_MASSIMO = 10 * 1024 * 1024;
export const TIPI_DI_ALLEGATO = Object.freeze([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/3gpp",
]);

/* Che cosa e' davvero un file, dai suoi primi byte.
 *
 * Il tipo che arriva nell'intestazione lo scrive chi manda, e da solo non
 * dice niente: un file qualunque si puo' dichiarare «image/png». I primi byte
 * invece sono il file — ogni formato comincia con la sua firma — e sono
 * quelli che decidono. Quello che non ha la firma di una foto o di un video
 * non si allega, qualunque cosa dica di essere.
 *
 * HEIC e 3GP ci sono perche' sono quelli che fanno i telefoni: le foto di un
 * iPhone e i video di tanti Android. Stanno nella stessa scatola dell'MP4 e
 * del MOV — `ftyp` all'ottavo byte — e li distingue la marca che segue. */
const MARCHE = Object.freeze({
  "image/heic": ["heic", "heix", "heim", "heis", "hevc", "hevx"],
  "image/heif": ["mif1", "msf1", "mif2"],
  "video/quicktime": ["qt  "],
  "video/3gpp": ["3gp4", "3gp5", "3gp6", "3gp7", "3gg6", "3g2a", "3g2b", "3g2c"],
  "video/mp4": [
    "isom",
    "iso2",
    "iso4",
    "iso5",
    "iso6",
    "mp41",
    "mp42",
    "avc1",
    "M4V ",
    "M4A ",
    "mmp4",
    "dash",
    "MSNV",
    "f4v ",
  ],
});

const ascii = (byte, da, quanti) => String.fromCharCode(...byte.subarray(da, da + quanti));

export function tipoDelFile(byte) {
  if (!(byte instanceof Uint8Array) || byte.length < 3) return "";
  if (byte[0] === 0xff && byte[1] === 0xd8 && byte[2] === 0xff) return "image/jpeg";
  if (ascii(byte, 0, 8) === "\x89PNG\r\n\x1a\n") return "image/png";
  if (ascii(byte, 0, 6) === "GIF87a" || ascii(byte, 0, 6) === "GIF89a") return "image/gif";
  if (ascii(byte, 0, 4) === "RIFF" && ascii(byte, 8, 4) === "WEBP") return "image/webp";
  if (ascii(byte, 4, 4) === "ftyp") {
    const marca = ascii(byte, 8, 4);
    for (const [tipo, marche] of Object.entries(MARCHE)) {
      if (marche.includes(marca)) return tipo;
    }
    return "";
  }
  /* WebM e' un Matroska che lo dice nella testa: la firma EBML, e poco dopo
   * la parola «webm». Un Matroska qualunque no. */
  if (byte[0] === 0x1a && byte[1] === 0x45 && byte[2] === 0xdf && byte[3] === 0xa3) {
    return ascii(byte, 0, Math.min(byte.length, 64)).includes("webm") ? "video/webm" : "";
  }
  return "";
}

/* L'estensione che il file deve avere, per il tipo che e' davvero. Un file
 * che si chiama `.html` ma e' una foto diventa `.png`: il nome lo sceglie chi
 * manda, e da qui in poi lo legge GitHub. */
const ESTENSIONI = Object.freeze({
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/3gpp": "3gp",
});

export function nomeColSuoTipo(nome, tipo) {
  const pulito = nomeDiFile(nome);
  const estensione = ESTENSIONI[tipo];
  if (!estensione) return pulito;
  const senza = pulito.replace(/\.[A-Za-z0-9]{1,8}$/, "") || "allegato";
  return `${senza.slice(0, 60 - estensione.length - 1)}.${estensione}`;
}

/* Quello che la persona scrive finisce in una issue pubblica, e GitHub
 * legge il Markdown: una chiocciola davanti a un nome chiama quella persona
 * — le arriva una notifica, da una repository che non conosce — e un
 * commento HTML nasconde il testo a chi legge la pagina ma non a chi legge
 * il sorgente. Nessuna delle due cose serve a chi segnala un difetto.
 *
 * Si mette in mezzo un carattere che non si vede (U+200D): a chi legge il
 * testo resta identico, e GitHub non ci riconosce piu' ne' la chiamata ne' il
 * commento. Gli indirizzi email restano come sono: li' la chiocciola ha una
 * lettera davanti, e GitHub non la legge come una chiamata. */
const INVISIBILE = "\u200d";
export function innocuo(valore) {
  return String(valore ?? "")
    .replace(/(^|[^A-Za-z0-9_`])@(?=[A-Za-z0-9])/g, `$1@${INVISIBILE}`)
    .replace(/<!--/g, `<${INVISIBILE}!--`)
    .replace(/-->/g, `--${INVISIBILE}>`);
}

/* Un nome di file che si puo' scrivere in una repository senza sorprese:
 * lettere, numeri, punto, trattino, trattino basso. Il resto diventa un
 * trattino basso, e non si va oltre i sessanta caratteri. */
export function nomeDiFile(nome) {
  const pulito = String(nome ?? "")
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^[._-]+/, "")
    .slice(0, 60);
  return pulito || "allegato";
}

/* Quanto pesa, detto a una persona. */
export function pesoLeggibile(byte) {
  if (byte < 1024) return `${byte} B`;
  if (byte < 1024 * 1024) return `${Math.round(byte / 1024)} KB`;
  return `${(byte / (1024 * 1024)).toFixed(1)} MB`;
}

/* Tagliare senza spezzare un emoji.
 *
 * `slice` conta le unita' UTF-16 e un emoji ne occupa due: un titolo che
 * finisce esattamente sul limite lascerebbe mezza coppia, che non e' un
 * carattere. Il JSON la scappa e la porta fin la' intatta — in rete non si
 * rompe niente — e a rompersi e' quello che ne resta scritto nella issue: il
 * rombo col punto di domanda, per sempre.
 *
 * Qui si contano i punti di codice e non i gruppi, al contrario di quello che
 * fa la chat: questo file gira anche su Cloudflare, e `Intl.Segmenter` non e'
 * detto che ci sia. Senza i gruppi una bandiera tagliata a meta' diventa due
 * lettere, che e' brutto ma e' un carattere vero; con `slice` diventava un
 * buco. */
const testo = (valore, massimo) => {
  const pulito = String(valore ?? "").trim();
  if (pulito.length <= massimo) return pulito;
  let fuori = "";
  for (const pezzo of Array.from(pulito)) {
    if (fuori.length + pezzo.length > massimo) break;
    fuori += pezzo;
  }
  return fuori;
};

/* ─── Le forme ───────────────────────────────────────────────────────────── */

/* Il corpo della issue: quello che la persona ha scritto, poi la diagnostica
 * raccolta da sola, separate da un segno che al ritorno permette di ridare
 * alla persona solo le sue parole. */
export function corpoDellaIssue({ corpo, diagnostica, casa, da = "" }) {
  const righe = [innocuo(testo(corpo, CORPO_MASSIMO))];
  const voci = Object.entries(diagnostica || {}).filter(
    ([chiave, valore]) => chiave && valore !== undefined && valore !== null && valore !== "",
  );
  if (voci.length || casa) {
    righe.push("", "---", MARCATORE_DIAGNOSTICA, "", "| | |", "|---|---|");
    for (const [chiave, valore] of voci.slice(0, 40)) {
      righe.push(`| ${pulisci(chiave)} | ${pulisci(String(valore))} |`);
    }
    /* Da dove viene, in testa alle righe di servizio: e' la prima domanda di
       chi apre la issue, e l'etichetta la risponde nell'elenco ma qui dentro
       no. */
    if (da) righe.push(`| da | ${pulisci(da)} |`);
    if (casa) righe.push(`| casa | \`${pulisci(String(casa)).slice(0, 12)}\` |`);
  }
  return righe.join("\n");
}

const pulisci = (valore) =>
  innocuo(
    String(valore)
      .replace(/[|\r\n]+/g, " ")
      .trim()
      .slice(0, 200),
  );

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

/* In che stato e' una segnalazione: aperta, in lavorazione, chiusa.
 *
 * Tre e non due, perche' tre sono i gruppi che l'app mostra nei filtri — gli
 * stessi della dashboard: «Da lavorare», «In lavorazione», «Chiuse». Senza il
 * mezzo, una segnalazione che qualcuno ha gia' preso in mano resta scritta
 * «da lavorare», e chi l'ha aperta non sa se e' stata vista.
 *
 * Su GitHub «presa in carico» non e' uno stato: sono due segni, e valgono
 * tutti e due. **Assegnata a qualcuno** e' il modo naturale — prendersi una
 * issue vuol dire mettersi il proprio nome sopra — e **l'etichetta**
 * `in-carico` serve a chi preferisce dirlo cosi'. Chiusa vince su tutto: una
 * segnalazione risolta non e' in lavorazione.
 */
export function statoDellaIssue(issue) {
  if (issue?.state === "closed") return "chiusa";
  const etichette = (Array.isArray(issue?.labels) ? issue.labels : []).map((una) =>
    String((una && una.name) || una || "")
      .trim()
      .toLowerCase(),
  );
  const assegnata =
    Boolean(issue?.assignee) || (Array.isArray(issue?.assignees) ? issue.assignees.length : 0) > 0;
  return assegnata || etichette.includes("in-carico") ? "in-carico" : "aperta";
}

/* Il filo intero: la issue e i suoi commenti, nella forma dell'app. */
export function filo(voce, issue, commenti) {
  return {
    numero: Number(issue?.number ?? voce?.numero),
    tipo: voce?.tipo || "problema",
    titolo: voce?.titolo || String(issue?.title ?? ""),
    stato: statoDellaIssue(issue),
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
  constructor({
    token,
    repo,
    repoAllegati = "",
    ramoAllegati = "",
    fetch: prendi = globalThis.fetch,
    base = "https://api.github.com",
  }) {
    this.token = token;
    this.repo = repo;
    /* Dove vanno le **foto e i video**, che possono essere un'altra
     * repository.
     *
     * Di solito e' la stessa delle issue, e cosi' sta in gdahome: chi guarda
     * una segnalazione ci trova dentro l'allegato, senza andarlo a cercare
     * altrove.
     *
     * L'interruttore c'e' perche' gli allegati non sono allegati di GitHub —
     * l'API non ha un modo di attaccare un file a una issue — quindi si
     * **committano**, sotto `allegati/<numero>/`, e restano nella storia di
     * git. Il giorno che quella repository diventasse pesante, i file si
     * spostano da qui: un ramo a parte, un'altra repository, e non cambia una
     * riga di programma. Vuota vale quella delle issue. */
    this.repoAllegati = repoAllegati || repo;
    /* E su quale **ramo**. Vuoto vuol dire quello principale, com'era prima.
     *
     * Quando gli allegati stanno nella repository del progetto, il ramo
     * principale e' quello che Home Assistant scarica per installare
     * l'add-on: ogni foto finita li' se la porterebbe dietro chiunque
     * installi. Un ramo a parte — `allegati` — tiene i file nella stessa
     * repository, visibili dalla segnalazione, ma fuori da quello che si
     * scarica. Se il ramo non c'e' ancora lo si crea al primo allegato. */
    const ramo = String(ramoAllegati || "").trim();
    this.ramoAllegati = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,99}$/.test(ramo) ? ramo : "";
    /* Non `this.prendi = prendi`: `fetch` chiamata come metodo di
     * quest'oggetto — `this.prendi(...)` — arriva col `this` sbagliato, e il
     * worker la rifiuta con «Illegal invocation». Si chiama e basta. */
    this.prendi = (...argomenti) => prendi(...argomenti);
    this.base = base;
  }

  get pronto() {
    return Boolean(this.token && /^[\w.-]+\/[\w.-]+$/.test(String(this.repo || "")));
  }

  async _chiama(metodo, via, corpo, { dove = "" } = {}) {
    const quale = dove || this.repo;
    const risposta = await this.prendi(`${this.base}/repos/${quale}${via}`, {
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

  /* Mette un file nella repository degli allegati, in `via`, con un commit.
   * Vuole il permesso «Contents: Read and write» sul gettone — su **quella**
   * repository: senza, GitHub risponde 403 o 404, e l'app lo dice. Torna
   * l'indirizzo con cui aprirlo. */
  async mettiFile({ via, byte, messaggio }) {
    const corpo = {
      message: messaggio,
      content: inBase64(byte),
      ...(this.ramoAllegati ? { branch: this.ramoAllegati } : {}),
    };
    let risposta;
    try {
      risposta = await this._chiama("PUT", `/contents/${via}`, corpo, { dove: this.repoAllegati });
    } catch (errore) {
      /* Il ramo che non c'e' ancora: GitHub lo dice con un 404 o un 422 che
       * parlano di «branch». Si crea una volta, e si riprova una volta. */
      if (!this.ramoAllegati || !ramoMancante(errore)) throw errore;
      await this._creaIlRamo();
      risposta = await this._chiama("PUT", `/contents/${via}`, corpo, { dove: this.repoAllegati });
    }
    const contenuto = risposta?.content ?? {};
    return {
      via,
      url: contenuto.html_url ? `${contenuto.html_url}?raw=true` : "",
    };
  }

  /* Il ramo degli allegati, fatto partire dalla punta del ramo principale.
   *
   * Vuole lo stesso permesso dei file — «Contents: Read and write» — e niente
   * di piu'. Se due allegati arrivano insieme e lo creano tutti e due, il
   * secondo si sente dire «esiste gia'», che e' proprio quello che voleva. */
  async _creaIlRamo() {
    const dove = { dove: this.repoAllegati };
    try {
      const repository = await this._chiama("GET", "", null, dove);
      const principale = String(repository?.default_branch || "main");
      const punta = await this._chiama(
        "GET",
        `/git/ref/heads/${encodeURIComponent(principale)}`,
        null,
        dove,
      );
      const sha = punta?.object?.sha;
      if (!sha) throw new GitHubNonRisponde(404, "non trovo la punta del ramo principale");
      await this._chiama(
        "POST",
        "/git/refs",
        { ref: `refs/heads/${this.ramoAllegati}`, sha },
        dove,
      );
    } catch (errore) {
      if (
        errore instanceof GitHubNonRisponde &&
        errore.stato === 422 &&
        /exist/i.test(errore.message)
      )
        return;
      throw new GitHubNonRisponde(
        errore?.stato || 502,
        `il ramo «${this.ramoAllegati}» degli allegati non c'e' e non riesco a crearlo` +
          (errore?.message ? `: ${errore.message}` : ""),
      );
    }
  }
}

function ramoMancante(errore) {
  return (
    errore instanceof GitHubNonRisponde &&
    (errore.stato === 404 || errore.stato === 422) &&
    /branch|ref/i.test(errore.message)
  );
}

/* Base64 di byte, a pezzi: `btoa` vuole una stringa di caratteri a un
 * byte, e farla in un colpo solo su dieci megabyte sfonda la pila. */
export function inBase64(byte) {
  const pezzi = [];
  const passo = 0x8000;
  for (let da = 0; da < byte.length; da += passo) {
    pezzi.push(String.fromCharCode.apply(null, byte.subarray(da, da + passo)));
  }
  return btoa(pezzi.join(""));
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
  constructor({ storage, github, casa, adesso = () => Date.now(), freno = null, chi = "" }) {
    this.storage = storage;
    this.github = github;
    this.casa = casa;
    this.adesso = adesso;
    /* Il limite sopra quello della casa: per indirizzo e in tutto. Lo
     * decide chi ospita — la macchina lo tiene in memoria, la nuvola in un
     * oggetto suo — e qui si chiede e basta: `true` vuol dire «avanti». */
    this.freno = freno;
    this.chi = chi;
  }

  async elenco() {
    return (await this.storage.get("segnalazioni")) ?? [];
  }

  async crea({ tipo, titolo, corpo, diagnostica, da }) {
    this._pronto();
    const quale = TIPI.includes(tipo) ? tipo : "problema";
    /* Da dove arriva. Quello che non si conosce diventa «app», che e' da dove
       arrivavano tutte prima di oggi: una segnalazione non si butta via per
       un'etichetta. */
    const daDove = Object.prototype.hasOwnProperty.call(DA_DOVE, String(da || ""))
      ? String(da)
      : DA_DI_DIFETTO;
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
      titolo: `[${quale}] ${innocuo(titoloPulito)}`,
      corpo: corpoDellaIssue({
        corpo: corpoPulito,
        diagnostica,
        casa: this.casa,
        da: DA_DOVE[daDove],
      }),
      etichette: ["gdahome", quale, DA_DOVE[daDove]],
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
    await this.github.commenta(voce.numero, `${MARCATORE_CASA}\n${innocuo(pulito)}`);
    return this.leggi(voce.numero);
  }

  /* Un allegato a una segnalazione: il file va nella repository, e sotto la
   * issue va un commento che lo indica, con il segno della casa. */
  async allega(numero, allegato) {
    this._pronto();
    const voce = await this._mia(numero);
    await this._contaUnaScrittura();
    await this._allega(voce.numero, allegato);
    return this.leggi(voce.numero);
  }

  async _allega(numero, { nome, byte }) {
    if (!(byte instanceof Uint8Array) || byte.length === 0)
      throw new RichiestaSbagliata("manca_il_file", "Manca il file.");
    if (byte.length > ALLEGATO_MASSIMO)
      throw new RichiestaSbagliata(
        "troppo_grande",
        `L'allegato e' troppo grande: al massimo ${pesoLeggibile(ALLEGATO_MASSIMO)}.`,
        413,
      );
    /* Il tipo lo dicono i byte, non l'intestazione: quello dichiarato non si
     * guarda nemmeno. Vedi `tipoDelFile`. */
    const vero = tipoDelFile(byte);
    if (!vero || !TIPI_DI_ALLEGATO.includes(vero))
      throw new RichiestaSbagliata(
        "tipo_non_ammesso",
        "Si possono allegare solo foto e video.",
        415,
      );
    const pulito = nomeColSuoTipo(nome, vero);
    const via = `allegati/${numero}/${new Date(this.adesso()).toISOString().replace(/[:.]/g, "-")}-${pulito}`;
    const messo = await this.github.mettiFile({
      via,
      byte,
      messaggio: `Allegato alla #${numero}: ${pulito}`,
    });
    const foto = vero.startsWith("image/");
    await this.github.commenta(
      numero,
      `${MARCATORE_CASA}\n${foto ? "📷" : "🎬"} ${pulito} (${pesoLeggibile(byte.length)})\n${messo.url}`,
    );
    return messo;
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
    const stato = statoDellaIssue(issue);
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
    if (this.freno && !(await this.freno(this.chi))) {
      throw new RichiestaSbagliata(
        "troppe",
        "Troppe scritture in un'ora dal centralino: riprova piu' tardi.",
        429,
      );
    }
    recenti.push(ora);
    await this.storage.put("scritture", recenti);
  }
}
