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
  nomeDiFile,
  paroleDellaPersona,
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
  assert.equal((await mie.crea({ tipo: "chat", titolo: "t", corpo: "c" })).tipo, "problema");
  await assert.rejects(() => mie.crea({ tipo: "idea", titolo: "", corpo: "c" }), /Manca il titolo/);
  await assert.rejects(
    () => mie.crea({ tipo: "idea", titolo: "t", corpo: "   " }),
    /Manca il testo/,
  );
});

test("la chat e' una issue sola per casa, che nasce alla prima parola", async () => {
  const storage = archivioFinto();
  const { github, issues } = gitHubFinto();
  const mie = new Segnalazioni({ storage, github, casa: "casa_" + "b".repeat(32) });

  assert.equal(await mie.chat(), null);
  const prima = await mie.chatta("Buongiorno, ho una domanda.", { app: "10" });
  assert.equal(prima.tipo, "chat");
  assert.equal(prima.titolo, "Chat di assistenza");
  assert.equal(issues.get(41).title, "[chat] Casa casa_bbbbbbb");
  assert.deepEqual(
    prima.messaggi.map((uno) => uno.testo),
    ["Buongiorno, ho una domanda."],
  );

  issues.get(41).commenti.push({ body: "Dimmi pure.", created_at: "t2" });
  const seconda = await mie.chatta("Come si fa a…");
  assert.equal(issues.size, 1, "sempre la stessa issue");
  assert.deepEqual(
    seconda.messaggi.map((uno) => [uno.da, uno.testo]),
    [
      ["casa", "Buongiorno, ho una domanda."],
      ["manutentore", "Dimmi pure."],
      ["casa", "Come si fa a…"],
    ],
  );
  assert.equal((await mie.chat()).messaggi.length, 3);
  /* La chat non sta fra le segnalazioni. */
  assert.deepEqual(await mie.elenco(), []);
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
    () => mie.chat(),
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
  await assert.rejects(
    mie.allega(aperta.numero, { nome: "x.exe", tipo: "application/octet-stream", byte }),
    (errore) => errore instanceof RichiestaSbagliata && errore.codice === "tipo_non_ammesso",
  );
});

test("un allegato alla chat la fa nascere, se non c'era", async () => {
  const { github, chiamate } = gitHubFinto();
  const storage = archivioFinto();
  const mie = new Segnalazioni({
    storage,
    github,
    casa: "casa_1",
    adesso: () => 1_700_000_000_000,
  });
  const byte = new Uint8Array([1, 2, 3, 4]);
  const chat = await mie.allegaAllaChat({ nome: "clip.mp4", tipo: "video/mp4", byte }, {});
  assert.ok(chat.numero);
  assert.equal(chat.tipo, "chat");
  assert.match(chat.messaggi.at(-1).testo, /^🎬 clip\.mp4 \(4 B\)/);
  assert.ok(chiamate.some((una) => una.metodo === "PUT"));
});

test("i nomi dei file si puliscono, e il peso si legge", () => {
  assert.equal(nomeDiFile("../../segreti/../foto di casa.JPG"), "segreti_.._foto_di_casa.JPG");
  assert.equal(nomeDiFile("   "), "allegato");
  assert.equal(nomeDiFile("a".repeat(100)).length, 60);
});
