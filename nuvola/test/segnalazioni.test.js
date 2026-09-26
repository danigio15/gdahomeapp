/* Le prove delle segnalazioni sul centralino: le forme, GitHub finto, e le
 * regole di una casa. */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ALLEGATO_MASSIMO,
  APERTE_MASSIME,
  GitHub,
  GitHubNonRisponde,
  MARCATORE_CASA,
  RichiestaSbagliata,
  SCRITTURE_ALLORA,
  Segnalazioni,
  classifica,
  corpoDellaIssue,
  filo,
  inBase64,
  innocuo,
  nomeColSuoTipo,
  nomeDiFile,
  paroleDellaPersona,
  statoDellaIssue,
  tipoDelFile,
} from "../src/segnalazioni.js";

/* Un archivio come quello del Durable Object: get, put, e basta. */
function archivioFinto() {
  const dentro = new Map();
  return {
    async get(chiave) {
      return dentro.get(chiave);
    },
    async put(chiave, valore) {
      dentro.set(chiave, valore);
    },
    dentro,
  };
}

/* Un GitHub finto: risponde alle quattro chiamate e si ricorda cosa gli si
 * e' chiesto. */
function gitHubFinto({ rotto = false } = {}) {
  const chiamate = [];
  const issues = new Map();
  const file = new Map();
  let prossimo = 41;
  const prendi = async (url, opzioni = {}) => {
    chiamate.push({
      url,
      metodo: opzioni.method,
      corpo: opzioni.body ? JSON.parse(opzioni.body) : null,
      intestazioni: opzioni.headers,
    });
    if (rotto)
      return { ok: false, status: 401, json: async () => ({ message: "Bad credentials" }) };
    const via = new URL(url).pathname;
    const corpo = opzioni.body ? JSON.parse(opzioni.body) : null;
    let m;
    if ((m = /\/issues$/.exec(via)) && opzioni.method === "POST") {
      const issue = {
        number: prossimo++,
        title: corpo.title,
        body: corpo.body,
        state: "open",
        created_at: "2026-09-08T10:00:00Z",
        updated_at: "2026-09-08T10:00:00Z",
        html_url: `https://github.com/x/y/issues/${prossimo - 1}`,
        commenti: [],
      };
      issues.set(issue.number, issue);
      return { ok: true, status: 201, json: async () => issue };
    }
    if ((m = /\/issues\/(\d+)\/comments/.exec(via))) {
      const issue = issues.get(Number(m[1]));
      if (!issue) return { ok: false, status: 404, json: async () => ({ message: "Not Found" }) };
      if (opzioni.method === "POST") {
        const commento = { body: corpo.body, created_at: "2026-09-08T11:00:00Z" };
        issue.commenti.push(commento);
        return { ok: true, status: 201, json: async () => commento };
      }
      return { ok: true, status: 200, json: async () => issue.commenti };
    }
    if ((m = /\/issues\/(\d+)$/.exec(via))) {
      const issue = issues.get(Number(m[1]));
      if (!issue) return { ok: false, status: 404, json: async () => ({ message: "Not Found" }) };
      return { ok: true, status: 200, json: async () => issue };
    }
    if ((m = /\/contents\/(.+)$/.exec(via)) && opzioni.method === "PUT") {
      file.set(m[1], corpo.content);
      return {
        ok: true,
        status: 201,
        json: async () => ({ content: { html_url: `https://github.com/x/y/blob/main/${m[1]}` } }),
      };
    }
    return { ok: false, status: 404, json: async () => ({ message: "Not Found" }) };
  };
  const github = new GitHub({ token: "gettone", repo: "x/y", fetch: prendi });
  return { github, chiamate, issues, file };
}

test("le issue nella repository del progetto, le foto in un'altra", async () => {
  /* Gli allegati non sono allegati di GitHub: si **committano** dentro una
   * repository, e restano nella storia di git per sempre. La repository del
   * progetto e' quella che Home Assistant clona per installare l'add-on: le
   * foto delle case degli altri non ci vanno, o le scaricherebbero tutti, a
   * ogni installazione, per sempre. Quindi le issue in una e i file in
   * un'altra — e qui si guarda che ognuna vada dove deve. */
  const chieste = [];
  const prendi = async (url, opzioni = {}) => {
    chieste.push({ url, metodo: opzioni.method || "GET" });
    return {
      ok: true,
      status: 201,
      json: async () => ({ number: 7, content: { html_url: "https://github.com/a/b/blob/x" } }),
    };
  };
  const github = new GitHub({
    token: "gettone",
    repo: "chi/progetto",
    repoAllegati: "chi/allegati",
    fetch: prendi,
  });

  await github.apriIssue({ titolo: "t", corpo: "c", etichette: [] });
  await github.mettiFile({
    via: "allegati/7/foto.jpg",
    byte: new Uint8Array([1, 2, 3]),
    messaggio: "m",
  });
  await github.commenta(7, "ciao");

  assert.deepEqual(
    chieste.map((una) => una.url.replace("https://api.github.com/repos/", "")),
    [
      "chi/progetto/issues",
      "chi/allegati/contents/allegati/7/foto.jpg",
      "chi/progetto/issues/7/comments",
    ],
  );
});

test("senza la seconda repository tutto resta dov'era: nella stessa", async () => {
  const chieste = [];
  const prendi = async (url) => {
    chieste.push(url);
    return { ok: true, status: 201, json: async () => ({ content: {} }) };
  };
  const github = new GitHub({ token: "gettone", repo: "chi/una-sola", fetch: prendi });
  assert.equal(github.repoAllegati, "chi/una-sola");
  await github.mettiFile({ via: "allegati/1/x.jpg", byte: new Uint8Array([1]), messaggio: "m" });
  assert.match(chieste[0], /repos\/chi\/una-sola\/contents\//);
});

test("da dove viene una segnalazione si vede dall'etichetta, e non si puo' fingere", async () => {
  /* Due strade, e chi legge l'elenco delle issue deve poterle dividere: una
   * segnalazione scritta col telefono in mano non e' la stessa cosa di una
   * scritta davanti a Home Assistant — due programmi diversi, due modi
   * diversi di rompersi. Nell'elenco si vedono solo le etichette, quindi
   * l'origine e' un'etichetta. */
  const fatte = [];
  const finto = {
    pronto: true,
    async apriIssue(cosa) {
      fatte.push(cosa);
      return { number: fatte.length, html_url: "https://x/y/issues/1", created_at: "t" };
    },
  };
  const deposito = () => {
    const dentro = new Map();
    return {
      async get(chiave) {
        return dentro.get(chiave);
      },
      async put(chiave, valore) {
        dentro.set(chiave, valore);
      },
    };
  };

  const dallApp = new Segnalazioni({ storage: deposito(), github: finto, casa: "casa_1" });
  await dallApp.crea({ tipo: "problema", titolo: "t", corpo: "c", da: "app" });
  assert.deepEqual(fatte[0].etichette, ["gdahome", "problema", "da-app"]);

  const dallaPlancia = new Segnalazioni({ storage: deposito(), github: finto, casa: "casa_2" });
  await dallaPlancia.crea({ tipo: "idea", titolo: "t", corpo: "c", da: "plancia" });
  assert.deepEqual(fatte[1].etichette, ["gdahome", "idea", "da-home-assistant"]);
  assert.match(fatte[1].corpo, /\| da \| da-home-assistant \|/);

  /* Quello che arriva da fuori non si crede sulla parola: un'origine che non
   * si conosce diventa «app» — da dove arrivavano tutte prima di oggi — e la
   * segnalazione passa lo stesso. Buttarne via una per un'etichetta sarebbe
   * il modo peggiore di essere severi. */
  const strana = new Segnalazioni({ storage: deposito(), github: finto, casa: "casa_3" });
  await strana.crea({ tipo: "domanda", titolo: "t", corpo: "c", da: "da-home-assistant" });
  assert.deepEqual(fatte[2].etichette, ["gdahome", "domanda", "da-app"]);
  const senza = new Segnalazioni({ storage: deposito(), github: finto, casa: "casa_4" });
  await senza.crea({ tipo: "problema", titolo: "t", corpo: "c" });
  assert.deepEqual(fatte[3].etichette, ["gdahome", "problema", "da-app"]);
});

test("il corpo della issue porta le parole e la diagnostica, e le parole tornano da sole", () => {
  const corpo = corpoDellaIssue({
    corpo: "La luce del salotto non risponde.",
    diagnostica: {
      app: "10·3693d43",
      ponte: "0.9.0",
      telefono: "Android 14",
      vuoto: "",
      nullo: null,
    },
    casa: "casa_0123456789abcdef0123456789abcdef",
  });
  assert.match(corpo, /^La luce del salotto non risponde\.\n\n---\n<!-- gdahome:diagnostica -->/);
  assert.match(corpo, /\| app \| 10·3693d43 \|/);
  assert.match(corpo, /\| ponte \| 0\.9\.0 \|/);
  assert.doesNotMatch(corpo, /vuoto|nullo/);
  /* La casa si riconosce da un pezzo dell'identificativo, non tutto. */
  assert.match(corpo, /\| casa \| `casa_0123456` \|/);
  assert.equal(paroleDellaPersona(corpo), "La luce del salotto non risponde.");
  assert.equal(paroleDellaPersona("solo parole"), "solo parole");
  /* Una barra verticale dentro un valore non rompe la tabella. */
  assert.match(
    corpoDellaIssue({ corpo: "x", diagnostica: { a: "uno | due" } }),
    /\| a \| uno\s+due \|/,
  );
});

test("chi ha scritto un commento lo dice il segno, non l'autore", () => {
  assert.deepEqual(classifica({ body: `${MARCATORE_CASA}\nCiao, sono io.`, created_at: "t1" }), {
    da: "casa",
    testo: "Ciao, sono io.",
    il: "t1",
  });
  assert.deepEqual(classifica({ body: "Ciao, ti rispondo.", created_at: "t2" }), {
    da: "manutentore",
    testo: "Ciao, ti rispondo.",
    il: "t2",
  });
  const intero = filo(
    { numero: 7, tipo: "idea", titolo: "Una cosa", aperta_il: "t0" },
    {
      number: 7,
      state: "closed",
      body: "Le parole\n\n---\n<!-- gdahome:diagnostica -->\n| a | b |",
      created_at: "t0",
      html_url: "u",
    },
    [{ body: "risposta", created_at: "t1" }],
  );
  assert.equal(intero.stato, "chiusa");
  assert.equal(intero.titolo, "Una cosa");
  assert.deepEqual(intero.messaggi, [
    { da: "casa", testo: "Le parole", il: "t0" },
    { da: "manutentore", testo: "risposta", il: "t1" },
  ]);
});

test("GitHub si chiama col gettone, e un no di GitHub e' un errore parlante", async () => {
  const { github, chiamate } = gitHubFinto();
  assert.equal(github.pronto, true);
  const issue = await github.apriIssue({ titolo: "t", corpo: "c", etichette: ["gdahome"] });
  assert.equal(issue.number, 41);
  assert.equal(chiamate[0].url, "https://api.github.com/repos/x/y/issues");
  assert.equal(chiamate[0].intestazioni.authorization, "Bearer gettone");
  assert.deepEqual(chiamate[0].corpo, { title: "t", body: "c", labels: ["gdahome"] });

  const rotto = gitHubFinto({ rotto: true }).github;
  await assert.rejects(
    () => rotto.leggiIssue(1),
    (errore) =>
      errore instanceof GitHubNonRisponde &&
      errore.stato === 401 &&
      /Bad credentials/.test(errore.message),
  );

  assert.equal(new GitHub({ token: "", repo: "x/y" }).pronto, false);
  assert.equal(new GitHub({ token: "g", repo: "senza-barra" }).pronto, false);
});

test("una casa apre, rilegge e risponde solo alle sue segnalazioni", async () => {
  const storage = archivioFinto();
  const { github, issues } = gitHubFinto();
  const mie = new Segnalazioni({
    storage,
    github,
    casa: "casa_" + "a".repeat(32),
    adesso: () => 1000,
  });

  assert.deepEqual(await mie.elenco(), []);
  const aperta = await mie.crea({
    tipo: "idea",
    titolo: "  Un'idea  ",
    corpo: "Sarebbe bello…",
    diagnostica: { app: "10" },
  });
  assert.equal(aperta.numero, 41);
  assert.equal(aperta.tipo, "idea");
  assert.equal(aperta.titolo, "Un'idea");
  assert.equal(aperta.stato, "aperta");
  assert.deepEqual(aperta.messaggi, [
    { da: "casa", testo: "Sarebbe bello…", il: "2026-09-08T10:00:00Z" },
  ]);
  assert.equal(issues.get(41).title, "[idea] Un'idea");
  assert.deepEqual(
    (await mie.elenco()).map((una) => una.numero),
    [41],
  );

  /* Il manutentore risponde da GitHub. */
  issues.get(41).commenti.push({ body: "Grazie, la faccio.", created_at: "t2" });
  const riletta = await mie.leggi(41);
  assert.equal(riletta.messaggi.length, 2);
  assert.equal(riletta.messaggi[1].da, "manutentore");

  const risposta = await mie.rispondi(41, "Perfetto!");
  assert.equal(risposta.messaggi.length, 3);
  assert.deepEqual(risposta.messaggi[2], {
    da: "casa",
    testo: "Perfetto!",
    il: "2026-09-08T11:00:00Z",
  });
  assert.ok(issues.get(41).commenti[1].body.startsWith(MARCATORE_CASA));

  /* Una issue che non e' sua non si legge, anche se esiste. */
  issues.set(99, { number: 99, title: "altrui", body: "", state: "open", commenti: [] });
  await assert.rejects(
    () => mie.leggi(99),
    (errore) => errore instanceof RichiestaSbagliata && errore.codice === "non_trovata",
  );

  /* Quando il manutentore la chiude, si vede. */
  issues.get(41).state = "closed";
  assert.equal((await mie.leggi(41)).stato, "chiusa");
  assert.equal((await mie.elenco())[0].stato, "chiusa");
});

test("un tipo strano diventa un problema, e senza titolo o testo non si apre niente", async () => {
  const mie = new Segnalazioni({
    storage: archivioFinto(),
    github: gitHubFinto().github,
    casa: "c",
  });
  assert.equal((await mie.crea({ tipo: "boh", titolo: "t", corpo: "c" })).tipo, "problema");
  /* «chat» era un tipo, e non lo e' piu': una parola che non e' un tipo
   * diventa un problema, come tutte le altre. */
  assert.equal((await mie.crea({ tipo: "chat", titolo: "t", corpo: "c" })).tipo, "problema");
  await assert.rejects(() => mie.crea({ tipo: "idea", titolo: "", corpo: "c" }), /Manca il titolo/);
  await assert.rejects(
    () => mie.crea({ tipo: "idea", titolo: "t", corpo: "   " }),
    /Manca il testo/,
  );
});

test("senza gettone il centralino lo dice, e non prova nemmeno", async () => {
  const mie = new Segnalazioni({
    storage: archivioFinto(),
    github: new GitHub({ token: "", repo: "x/y" }),
    casa: "c",
  });
  await assert.rejects(
    () => mie.crea({ tipo: "idea", titolo: "t", corpo: "c" }),
    (errore) => errore.codice === "non_configurate" && errore.stato === 503,
  );
  await assert.rejects(
    () => mie.leggi(7),
    (errore) => errore.codice === "non_configurate",
  );
  /* L'elenco invece si legge sempre: e' roba di casa. */
  assert.deepEqual(await mie.elenco(), []);
});

test("i limiti: dieci aperte per casa, sessanta scritture l'ora", async () => {
  let ora = 0;
  const mie = new Segnalazioni({
    storage: archivioFinto(),
    github: gitHubFinto().github,
    casa: "c",
    adesso: () => ora,
  });
  for (let i = 0; i < APERTE_MASSIME; i += 1) {
    await mie.crea({ tipo: "problema", titolo: `n${i}`, corpo: "c" });
  }
  await assert.rejects(
    () => mie.crea({ tipo: "problema", titolo: "una di troppo", corpo: "c" }),
    (errore) => errore.codice === "troppe" && errore.stato === 429,
  );

  /* Le scritture: dopo sessanta in un'ora si aspetta; un'ora dopo si riparte. */
  const altre = new Segnalazioni({
    storage: archivioFinto(),
    github: gitHubFinto().github,
    casa: "c",
    adesso: () => ora,
  });
  const prima = await altre.crea({ tipo: "problema", titolo: "t", corpo: "c" });
  for (let i = 1; i < SCRITTURE_ALLORA; i += 1) await altre.rispondi(prima.numero, `m${i}`);
  await assert.rejects(
    () => altre.rispondi(prima.numero, "troppa"),
    (errore) => errore.codice === "troppe",
  );
  ora += 3_600_001;
  assert.ok(await altre.rispondi(prima.numero, "adesso si"));
});

test("un allegato finisce nella repository, e sotto la issue c'e' il commento che lo indica", async () => {
  const { github, chiamate, file } = gitHubFinto();
  const storage = archivioFinto();
  const mie = new Segnalazioni({
    storage,
    github,
    casa: "casa_1",
    adesso: () => 1_700_000_000_000,
  });
  const aperta = await mie.crea({
    tipo: "problema",
    titolo: "La luce",
    corpo: "Non va",
    diagnostica: {},
  });

  const byte = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
  const filo = await mie.allega(aperta.numero, {
    nome: "cucina (sera).jpg",
    tipo: "image/jpeg",
    byte,
  });

  const messo = chiamate.find((una) => una.metodo === "PUT");
  assert.ok(messo, "il file va messo con una PUT");
  assert.match(messo.url, new RegExp(`/contents/allegati/${aperta.numero}/.*cucina_sera_.jpg$`));
  assert.equal(messo.corpo.content, inBase64(byte));
  assert.equal(file.size, 1);

  const ultimo = filo.messaggi.at(-1);
  assert.equal(ultimo.da, "casa");
  assert.match(ultimo.testo, /^📷 cucina_sera_\.jpg \(7 B\)\n.*\?raw=true$/);

  /* Non della casa: no. */
  await assert.rejects(
    mie.allega(999, { nome: "x.jpg", tipo: "image/jpeg", byte }),
    (errore) => errore instanceof RichiestaSbagliata && errore.codice === "non_trovata",
  );
  /* Troppo grande, o non una foto: no, e si dice. */
  await assert.rejects(
    mie.allega(aperta.numero, {
      nome: "x.jpg",
      tipo: "image/jpeg",
      byte: new Uint8Array(ALLEGATO_MASSIMO + 1),
    }),
    (errore) => errore instanceof RichiestaSbagliata && errore.codice === "troppo_grande",
  );
  /* Il tipo lo dicono i byte: un eseguibile resta un eseguibile anche se
   * si dichiara una foto. (Prima qui si mandavano i byte di una foto
   * dichiarandoli «application/octet-stream», e il no arrivava per
   * l'intestazione; adesso l'intestazione non si guarda piu'.) */
  const eseguibile = new TextEncoder().encode("MZ\x90\x00 questo non e' una foto");
  await assert.rejects(
    mie.allega(aperta.numero, { nome: "x.jpg", tipo: "image/jpeg", byte: eseguibile }),
    (errore) => errore instanceof RichiestaSbagliata && errore.codice === "tipo_non_ammesso",
  );
});

test("i nomi dei file si puliscono, e il peso si legge", () => {
  assert.equal(nomeDiFile("../../segreti/../foto di casa.JPG"), "segreti_.._foto_di_casa.JPG");
  assert.equal(nomeDiFile("   "), "allegato");
  assert.equal(nomeDiFile("a".repeat(100)).length, 60);
});

test("tre stati e non due: chiusa, in lavorazione, aperta", () => {
  /* I filtri dell'app sono tre gruppi, gli stessi della dashboard, e senza il
   * mezzo una segnalazione che qualcuno ha gia' preso in mano resta scritta
   * «da lavorare» — chi l'ha aperta non sa se e' stata vista.
   *
   * Su GitHub «presa in carico» non e' uno stato: sono due segni, e valgono
   * tutti e due. Assegnarsi una issue e' il modo naturale; l'etichetta serve a
   * chi preferisce dirlo cosi'. */
  assert.equal(statoDellaIssue({ state: "open" }), "aperta");
  assert.equal(statoDellaIssue({ state: "open", assignee: { login: "tizio" } }), "in-carico");
  assert.equal(statoDellaIssue({ state: "open", assignees: [{ login: "tizio" }] }), "in-carico");
  assert.equal(statoDellaIssue({ state: "open", labels: [{ name: "in-carico" }] }), "in-carico");
  /* Le etichette arrivano anche come parole sole, e con le maiuscole di chi
   * le ha scritte. */
  assert.equal(statoDellaIssue({ state: "open", labels: ["In-Carico"] }), "in-carico");
  /* Un'etichetta qualsiasi non e' «presa in carico». */
  assert.equal(statoDellaIssue({ state: "open", labels: [{ name: "gdahome" }] }), "aperta");
  /* Chiusa vince su tutto: una risolta non e' in lavorazione. */
  assert.equal(statoDellaIssue({ state: "closed", assignee: { login: "tizio" } }), "chiusa");
  /* E una issue che non si e' potuta leggere non inventa niente. */
  assert.equal(statoDellaIssue(null), "aperta");
});

test("il filo porta lo stato dei tre gruppi, e l'elenco se lo tiene", async () => {
  /* Quello che l'app filtra e' il campo `stato` che arriva da qui: se il filo
   * dicesse solo «aperta» o «chiusa», il gruppo di mezzo nell'app non
   * esisterebbe per nessuna segnalazione. */
  const dentro = filo(
    { numero: 7, tipo: "problema", titolo: "La luce" },
    { number: 7, state: "open", assignees: [{ login: "tizio" }], body: "non va" },
    [],
  );
  assert.equal(dentro.stato, "in-carico");
});

/* ─── Le difese ──────────────────────────────────────────────────────────── */

test("il tipo di un allegato lo dicono i suoi byte, non l'intestazione", () => {
  const da = (...byte) => {
    const tutti = new Uint8Array(32);
    tutti.set(byte.flat());
    return tutti;
  };
  const testo = (parole) => [...parole].map((una) => una.charCodeAt(0));
  assert.equal(tipoDelFile(da(0xff, 0xd8, 0xff, 0xe0)), "image/jpeg");
  assert.equal(tipoDelFile(da(testo("\x89PNG\r\n\x1a\n"))), "image/png");
  assert.equal(tipoDelFile(da(testo("GIF89a"))), "image/gif");
  assert.equal(tipoDelFile(da(testo("RIFF"), [1, 2, 3, 4], testo("WEBP"))), "image/webp");
  assert.equal(tipoDelFile(da([0, 0, 0, 24], testo("ftypisom"))), "video/mp4");
  assert.equal(tipoDelFile(da([0, 0, 0, 20], testo("ftypqt  "))), "video/quicktime");
  assert.equal(tipoDelFile(da([0, 0, 0, 24], testo("ftypheic"))), "image/heic");
  assert.equal(tipoDelFile(da([0x1a, 0x45, 0xdf, 0xa3], testo("....webm"))), "video/webm");
  /* Il resto no: una pagina, un eseguibile, un Matroska qualunque, un ftyp
   * che non si conosce. */
  assert.equal(tipoDelFile(da(testo("<html><script>"))), "");
  assert.equal(tipoDelFile(da(testo("MZ"))), "");
  assert.equal(tipoDelFile(da([0x1a, 0x45, 0xdf, 0xa3], testo("matroska"))), "");
  assert.equal(tipoDelFile(da([0, 0, 0, 24], testo("ftypxxxx"))), "");
  /* E il nome prende l'estensione di quello che il file e'. */
  assert.equal(nomeColSuoTipo("pagina.html", "image/png"), "pagina.png");
  assert.equal(nomeColSuoTipo("foto", "image/jpeg"), "foto.jpg");
});

test("un file che si dichiara foto ma e' una pagina non si allega; una foto con un nome strano si'", async () => {
  const { github, chiamate } = gitHubFinto();
  const mie = new Segnalazioni({ storage: archivioFinto(), github, casa: "casa_1" });
  const aperta = await mie.crea({ tipo: "problema", titolo: "t", corpo: "c" });
  const pagina = new TextEncoder().encode("<html><script>alert(1)</script></html>");
  await assert.rejects(
    mie.allega(aperta.numero, { nome: "foto.png", tipo: "image/png", byte: pagina }),
    (errore) => errore.codice === "tipo_non_ammesso",
  );
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  await mie.allega(aperta.numero, { nome: "trucco.html", tipo: "text/html", byte: png });
  const messo = chiamate.find((una) => una.metodo === "PUT");
  assert.match(messo.url, /trucco\.png$/);
});

test("le chiamate e i commenti HTML non passano nella issue", async () => {
  const { github, chiamate } = gitHubFinto();
  const mie = new Segnalazioni({ storage: archivioFinto(), github, casa: "casa_1" });
  const aperta = await mie.crea({
    tipo: "problema",
    titolo: "Aiuto @manutentore",
    corpo: "Guardate @tizio e @org/squadra <!-- nascosto --> scrivete a anna@esempio.it",
    diagnostica: { versione: "@qualcuno <!-- x -->" },
  });
  const issue = chiamate.find((una) => /\/issues$/.test(una.url)).corpo;
  for (const testo of [issue.title, issue.body]) {
    assert.doesNotMatch(testo, /(^|[^\w])@[a-z]/i, testo);
    assert.doesNotMatch(testo, /<!-- (nascosto|x)/, testo);
  }
  /* Gli indirizzi email restano come sono, e i segni nostri pure. */
  assert.match(issue.body, /anna@esempio\.it/);
  assert.match(issue.body, /<!-- gdahome:diagnostica -->/);
  assert.equal(innocuo("@tizio").replace("‍", ""), "@tizio");

  await mie.rispondi(aperta.numero, "ciao @tizio <!-- x");
  const risposta = chiamate.filter((una) => /\/comments$/.test(una.url)).at(-1).corpo.body;
  assert.ok(risposta.startsWith(MARCATORE_CASA));
  assert.doesNotMatch(risposta.slice(MARCATORE_CASA.length), /@tizio|<!--/);
});

test("gli allegati vanno sul loro ramo, che si crea da solo la prima volta", async () => {
  const chieste = [];
  let ramoFatto = false;
  const prendi = async (url, opzioni = {}) => {
    const metodo = opzioni.method || "GET";
    const corpo = opzioni.body ? JSON.parse(opzioni.body) : null;
    chieste.push({ url, metodo, corpo });
    const rispondi = (status, json) => ({ ok: status < 300, status, json: async () => json });
    const via = new URL(url).pathname;
    if (metodo === "PUT" && via.includes("/contents/")) {
      if (!ramoFatto) return rispondi(404, { message: "Branch allegati not found" });
      return rispondi(201, { content: { html_url: "https://github.com/a/b/blob/allegati/x" } });
    }
    if (via === "/repos/chi/allegati") return rispondi(200, { default_branch: "main" });
    if (via === "/repos/chi/allegati/git/ref/heads/main")
      return rispondi(200, { object: { sha: "a".repeat(40) } });
    if (via === "/repos/chi/allegati/git/refs" && metodo === "POST") {
      ramoFatto = true;
      return rispondi(201, {});
    }
    return rispondi(404, { message: "Not Found" });
  };
  const github = new GitHub({
    token: "g",
    repo: "chi/progetto",
    repoAllegati: "chi/allegati",
    ramoAllegati: "allegati",
    fetch: prendi,
  });
  const messo = await github.mettiFile({
    via: "allegati/1/x.png",
    byte: new Uint8Array([1]),
    messaggio: "m",
  });
  assert.match(messo.url, /blob\/allegati\//);
  const messe = chieste.filter((una) => una.metodo === "PUT");
  assert.equal(messe.length, 2, "una volta, poi di nuovo dopo aver creato il ramo");
  assert.ok(messe.every((una) => una.corpo.branch === "allegati"));
  const creato = chieste.find((una) => una.url.endsWith("/git/refs"));
  assert.deepEqual(creato.corpo, { ref: "refs/heads/allegati", sha: "a".repeat(40) });

  /* Se il ramo non si riesce a creare, l'errore lo dice. */
  const senzaPermessi = new GitHub({
    token: "g",
    repo: "chi/progetto",
    repoAllegati: "chi/allegati",
    ramoAllegati: "allegati",
    fetch: async (url, opzioni = {}) =>
      (opzioni.method || "GET") === "PUT"
        ? { ok: false, status: 404, json: async () => ({ message: "Branch allegati not found" }) }
        : { ok: false, status: 403, json: async () => ({ message: "Resource not accessible" }) },
  });
  await assert.rejects(
    senzaPermessi.mettiFile({ via: "x", byte: new Uint8Array([1]), messaggio: "m" }),
    (errore) => errore instanceof GitHubNonRisponde && /ramo «allegati»/.test(errore.message),
  );
  /* Un nome di ramo strano non si usa. */
  assert.equal(new GitHub({ token: "g", repo: "a/b", ramoAllegati: "../main" }).ramoAllegati, "");
});

test("oltre il conto di tutti, la casa aspetta anche se il suo conto e' libero", async () => {
  const { github } = gitHubFinto();
  const chiesti = [];
  const mie = new Segnalazioni({
    storage: archivioFinto(),
    github,
    casa: "casa_1",
    chi: "203.0.113.4",
    freno: async (chi) => {
      chiesti.push(chi);
      return false;
    },
  });
  await assert.rejects(
    mie.crea({ tipo: "problema", titolo: "t", corpo: "c" }),
    (errore) => errore instanceof RichiestaSbagliata && errore.stato === 429,
  );
  assert.deepEqual(chiesti, ["203.0.113.4"]);
});
