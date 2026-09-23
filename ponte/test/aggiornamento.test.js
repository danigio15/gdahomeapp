/* Il ponte si aggiorna da se': le prove.
 *
 * Qui sotto non si tocca nessun disco vero. Non e' comodita': una prova che
 * scambia `/addons/gdahome` e' una prova che non si puo' lanciare, e allora non
 * la si lancerebbe mai — cioe' esattamente il pezzo di codice piu' delicato
 * dell'add-on resterebbe l'unico senza prove. Gli attrezzi che toccano il
 * disco stanno raccolti in un posto solo proprio per poterne mettere un'altra
 * copia, che invece di scrivere prende appunti.
 *
 * Quello che conta:
 *
 * - l'ordine dello scambio, perche' in `/addons` non ci sia mai un momento con
 *   due ponti o con nessuno;
 * - che un pacchetto senza dentro un ponte vero non entri;
 * - che una repository privata senza gettone lo dica, invece di dire «404»;
 * - che un Supervisor che non lascia ricostruire non passi per riuscito;
 * - che si porti dentro solo l'ultima release, solo piu' nuova, e solo un
 *   pacchetto che si apre senza uscire dalla sua cartella.
 */

import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { gzipSync } from "node:zlib";

import {
  ATTREZZI,
  Aggiornamento,
  confrontaLeVersioni,
  guardaIlPacco,
  IL_PACCO,
  LA_FIRMA,
  pezziDellaVersione,
  versioneNelManifesto,
} from "../src/aggiornamento.js";
import { improntaDi } from "../src/provenienza.js";

const manifesto = (versione) => `name: Il ponte\nversion: "${versione}"\nslug: ponte\n`;

const TESTA = "danigio15-gdahomeapp-abc1234";

/* Un archivio tar vero, fatto a mano: blocchi da 512 byte, un'intestazione e
 * il contenuto. Serve a provare l'apertura con archivi che GitHub non
 * farebbe mai. */
function unTar(voci) {
  const blocchi = [];
  for (const { nome, corpo = "", tipo = "0", collegamento = "", modo = 0o644 } of voci) {
    const dati = Buffer.from(corpo);
    const testa = Buffer.alloc(512);
    testa.write(nome, 0, 100, "utf8");
    testa.write(modo.toString(8).padStart(7, "0"), 100, 8, "utf8");
    testa.write("0000000", 108, 8, "utf8");
    testa.write("0000000", 116, 8, "utf8");
    testa.write(dati.length.toString(8).padStart(11, "0"), 124, 12, "utf8");
    testa.write("00000000000", 136, 12, "utf8");
    testa.write("        ", 148, 8, "utf8");
    testa.write(tipo, 156, 1, "utf8");
    testa.write(collegamento, 157, 100, "utf8");
    testa.write("ustar", 257, 6, "utf8");
    testa.write("00", 263, 2, "utf8");
    let somma = 0;
    for (const byte of testa) somma += byte;
    testa.write(`${somma.toString(8).padStart(6, "0")}\0 `, 148, 8, "utf8");
    blocchi.push(testa, dati, Buffer.alloc((512 - (dati.length % 512)) % 512));
  }
  blocchi.push(Buffer.alloc(1024));
  return Buffer.concat(blocchi);
}

/* Il pacchetto di un ponte vero, con dentro la versione che si vuole. */
function unPacco(versione = "0.16.0", { ancora = [], testa = TESTA } = {}) {
  return gzipSync(
    unTar([
      { nome: `${testa}/`, tipo: "5" },
      { nome: `${testa}/ponte/`, tipo: "5" },
      { nome: `${testa}/ponte/config.yaml`, corpo: manifesto(versione) },
      { nome: `${testa}/ponte/run.sh`, corpo: "#!/bin/sh\n", modo: 0o4755 },
      { nome: `${testa}/ponte/src/index.js`, corpo: "// il ponte\n" },
      /* Un collegamento fuori dal ponte non conta: quella parte non si apre. */
      { nome: `${testa}/officina/legacy`, tipo: "2", collegamento: "../ponte/plancia" },
      ...ancora,
    ]),
  );
}

/* Gli attrezzi che scrivono su un foglio invece che sul disco.
 *
 * `ci` e' l'elenco di quello che esiste; `mosse` e' il registro di tutto
 * quello che si e' fatto, in ordine — ed e' l'ordine la cosa da guardare.
 */
function attrezziFinti({ ci = [], dentroIlPacchetto = null } = {}) {
  const esistono = new Set(ci);
  const mosse = [];
  return {
    mosse,
    esistono,
    esiste: (dove) => esistono.has(dove),
    leggi: async (dove) => {
      mosse.push(`leggi ${dove}`);
      if (dove.endsWith("/config.yaml")) return manifesto("0.16.0");
      return "";
    },
    scrivi: async (dove) => {
      mosse.push(`scrivi ${dove}`);
      esistono.add(dove);
    },
    cartella: async (dove) => {
      mosse.push(`cartella ${dove}`);
      esistono.add(dove);
    },
    togli: async (dove) => {
      mosse.push(`togli ${dove}`);
      esistono.delete(dove);
    },
    sposta: async (da, a) => {
      mosse.push(`sposta ${da} → ${a}`);
      esistono.delete(da);
      esistono.add(a);
    },
    elenca: async () => ["danigio15-gdahomeapp-abc1234"],
    copia: async (da, a) => {
      mosse.push(`copia ${da} → ${a}`);
      esistono.add(a);
      /* Quello che c'era dentro l'origine si ritrova dentro la copia: se no
       * il manifesto da spostare dopo non ci sarebbe. */
      for (const uno of [...esistono]) {
        if (uno.startsWith(`${da}/`)) esistono.add(uno.replace(da, a));
      }
    },
    scompatta: async (_archivio, dentro) => {
      mosse.push(`scompatta in ${dentro}`);
      for (const file of dentroIlPacchetto ?? [
        "config.yaml",
        "Dockerfile",
        "run.sh",
        "src/index.js",
        "plancia/ORIGINE.json",
      ]) {
        esistono.add(`${dentro}/danigio15-gdahomeapp-abc1234/ponte/${file}`);
      }
    },
  };
}

/* Un ponte locale finto, con dentro tutto quello che serve per provare. */
function unPonte({
  mia = "0.15.0",
  gettone = "unGettone",
  attrezzi,
  prendi,
  segno = "unSegno",
} = {}) {
  const strumenti =
    attrezzi ?? attrezziFinti({ ci: ["/addons/gdahome", "/addons/gdahome/config.yaml"] });
  return new Aggiornamento({
    mia,
    gettone,
    segno,
    addon: "/addons",
    passaggio: "/passaggio/ponte-nuovo",
    attrezzi: strumenti,
    fetch: prendi,
    adesso: () => 1000,
  });
}

/* Una risposta di `fetch` finta, con il minimo che serve. */
const risposta = ({ ok = true, status = 200, testo = "", byte = null, json = null } = {}) => ({
  ok,
  status,
  text: async () => testo,
  json: async () => json ?? JSON.parse(testo || "null"),
  arrayBuffer: async () => {
    const dati = byte ?? Buffer.from([1, 2, 3]);
    return dati.buffer.slice(dati.byteOffset, dati.byteOffset + dati.byteLength);
  },
});

/* La scheda di una release, come la da' GitHub. */
const unaRelease = (tag, allegati = []) =>
  risposta({
    json: {
      tag_name: tag,
      draft: false,
      prerelease: false,
      assets: allegati.map((nome) => ({
        name: nome,
        browser_download_url: `https://github.com/danigio15/gdahomeapp/releases/download/${tag}/${nome}`,
      })),
    },
  });

/* GitHub finto: la scheda dell'ultima release, e i pacchetti. */
function gitHub({
  tag = "v0.16.0",
  pacco = unPacco(),
  allegati = [],
  firma = "",
  chieste = [],
} = {}) {
  return async (dove) => {
    chieste.push(dove);
    if (dove.endsWith("/releases/latest")) return unaRelease(tag, allegati);
    if (dove.endsWith(`/${LA_FIRMA}`)) return risposta({ byte: Buffer.from(firma) });
    if (dove.includes("/tarball/") || dove.endsWith(`/${IL_PACCO}`))
      return risposta({ byte: pacco });
    return risposta({});
  };
}

describe("le versioni si confrontano come numeri, non come parole", () => {
  it("0.9.0 viene prima di 0.10.0, anche se come testo verrebbe dopo", () => {
    assert.deepEqual(pezziDellaVersione("0.10.0"), [0, 10, 0]);
    assert.equal(confrontaLeVersioni("0.9.0", "0.10.0"), -1);
    assert.equal(confrontaLeVersioni("0.10.0", "0.9.0"), 1);
    assert.equal(confrontaLeVersioni("1.4.19", "1.4.19"), 0);
    /* Una versione piu' corta non e' una versione piu' piccola. */
    assert.equal(confrontaLeVersioni("1.4", "1.4.0"), 0);
  });

  it("una versione che non c'e' non si confronta: torna null, non 'aggiornato'", () => {
    assert.equal(confrontaLeVersioni("", "0.15.0"), null);
    assert.equal(confrontaLeVersioni("0.15.0", ""), null);
  });

  it("la versione si legge dal manifesto, con e senza virgolette", () => {
    assert.equal(versioneNelManifesto(manifesto("0.15.0")), "0.15.0");
    assert.equal(versioneNelManifesto("version: 0.15.0\n"), "0.15.0");
    assert.equal(versioneNelManifesto("nessuna versione qui"), "");
  });
});

describe("cosa dice la console", () => {
  it("fuori da un add-on locale non c'e' niente da aggiornare, e non si mostra niente", async () => {
    const ponte = unPonte({ attrezzi: attrezziFinti({ ci: [] }) });
    const stato = await ponte.stato();
    assert.equal(stato.locale, false);
    assert.equal(stato.nuova, "");
  });

  it("quando la pubblicata e' piu' nuova, lo dice", async () => {
    const chieste = [];
    const ponte = unPonte({ prendi: gitHub({ chieste }) });
    const stato = await ponte.stato();
    assert.equal(stato.locale, true);
    assert.equal(stato.mia, "0.15.0");
    assert.equal(stato.nuova, "0.16.0");
    assert.equal(stato.cE, true);
    /* Si guarda l'ultima release, non il ramo. */
    assert.deepEqual(chieste, [
      "https://api.github.com/repos/danigio15/gdahomeapp/releases/latest",
    ]);
  });

  it("quando e' la stessa, non c'e' nessun bottone da premere", async () => {
    const ponte = unPonte({ prendi: gitHub({ tag: "v0.15.0" }) });
    assert.equal((await ponte.stato()).cE, false);
  });

  it("una repository privata senza gettone non risponde «404»: dice cosa manca", async () => {
    const ponte = unPonte({
      gettone: "",
      prendi: async () => risposta({ ok: false, status: 404 }),
    });
    const stato = await ponte.stato();
    assert.equal(stato.gettone, false);
    assert.equal(stato.cE, null);
    assert.match(stato.guaio, /gettone/);
  });

  it("la risposta di GitHub si tiene in tasca: dieci giri, una richiesta", async () => {
    let quante = 0;
    const ponte = unPonte({
      prendi: async (dove) => {
        quante += 1;
        return gitHub()(dove);
      },
    });
    await ponte.stato();
    await ponte.stato();
    await ponte.stato();
    assert.equal(quante, 1);
    /* Chi preme «guarda se c'e' una versione nuova» la vuole adesso. */
    await ponte.stato({ dariccapo: true });
    assert.equal(quante, 2);
  });
});

describe("portarsela dentro", () => {
  it("lo scambio lascia sempre un add-on valido: il manifesto si mette per ultimo", async () => {
    const attrezzi = attrezziFinti({ ci: ["/addons/gdahome", "/addons/gdahome/config.yaml"] });
    const chieste = [];
    const ponte = unPonte({ attrezzi, prendi: gitHub({ chieste }) });
    assert.equal(await ponte.porta(), "0.16.0");
    /* Il pacchetto e' quello del tag della release, non quello di `main`. */
    assert.ok(
      chieste.includes("https://api.github.com/repos/danigio15/gdahomeapp/tarball/v0.16.0"),
    );
    assert.ok(!chieste.some((una) => una.includes("main")));

    const scambio = attrezzi.mosse.filter((mossa) => mossa.includes("/addons/"));
    assert.deepEqual(scambio, [
      "togli /addons/gdahome.nuova",
      "copia /passaggio/ponte-nuovo/danigio15-gdahomeapp-abc1234/ponte → /addons/gdahome.nuova",
      "sposta /addons/gdahome.nuova/config.yaml → /addons/gdahome.nuova/config.yaml.arrivato",
      "togli /addons/gdahome",
      "sposta /addons/gdahome.nuova → /addons/gdahome",
      "sposta /addons/gdahome/config.yaml.arrivato → /addons/gdahome/config.yaml",
    ]);
    /* La cosa che conta di quell'ordine: quando la cartella vecchia se ne va,
     * quella nuova e' gia' pronta e senza manifesto — per il Supervisor non
     * e' un add-on, quindi non ce ne sono due con lo stesso nome. */
    const quandoTolgo = scambio.indexOf("togli /addons/gdahome");
    const quandoCopio = scambio.findIndex((mossa) => mossa.startsWith("copia "));
    assert.ok(quandoCopio < quandoTolgo);
  });

  it("un pacchetto senza un ponte vero dentro non entra", async () => {
    const attrezzi = attrezziFinti({
      ci: ["/addons/gdahome", "/addons/gdahome/config.yaml"],
      dentroIlPacchetto: ["config.yaml", "Dockerfile", "run.sh"],
    });
    const ponte = unPonte({ attrezzi, prendi: gitHub() });
    await assert.rejects(() => ponte.porta(), /manca src\/index\.js/);
    /* E soprattutto: la cartella di prima e' ancora al suo posto. */
    assert.ok(attrezzi.esistono.has("/addons/gdahome/config.yaml"));
    assert.ok(!attrezzi.mosse.includes("togli /addons/gdahome"));
  });

  it("se GitHub non da' il pacchetto non si tocca niente", async () => {
    const attrezzi = attrezziFinti({ ci: ["/addons/gdahome", "/addons/gdahome/config.yaml"] });
    const ponte = unPonte({
      attrezzi,
      prendi: async (dove) =>
        dove.endsWith("/releases/latest")
          ? unaRelease("v0.16.0")
          : risposta({ ok: false, status: 500 }),
    });
    await assert.rejects(() => ponte.porta(), /500/);
    assert.ok(!attrezzi.mosse.includes("togli /addons/gdahome"));
  });

  it("fuori da un add-on locale non si prova nemmeno", async () => {
    const ponte = unPonte({ attrezzi: attrezziFinti({ ci: [] }) });
    await assert.rejects(() => ponte.porta(), /non e' un add-on locale/);
  });
});

describe("la ricostruzione", () => {
  it("si chiede al Supervisor, dopo aver riletto il negozio", async () => {
    const bussate = [];
    const ponte = unPonte({
      prendi: async (dove) => {
        bussate.push(dove);
        return risposta({});
      },
    });
    assert.deepEqual(await ponte.rifalla(), { chiesto: true });
    assert.deepEqual(bussate, [
      "http://supervisor/store/reload",
      "http://supervisor/addons/self/rebuild",
    ]);
  });

  it("un Supervisor che dice no non passa per riuscito: dice cosa premere a mano", async () => {
    const ponte = unPonte({
      prendi: async () => risposta({ ok: false, status: 403 }),
    });
    const esito = await ponte.rifalla();
    assert.equal(esito.chiesto, false);
    assert.match(esito.perche, /Ricostruisci/);
  });

  it("senza il segno del Supervisor non si bussa a vuoto", async () => {
    const ponte = unPonte({
      segno: "",
      prendi: async () => {
        throw new Error("non si deve arrivare qui");
      },
    });
    assert.equal((await ponte.rifalla()).chiesto, false);
  });

  it("la chiamata a rebuild interrotta vuol dire che sta succedendo, non che e' andata male", async () => {
    /* La ricostruzione ci porta via la rete sotto i piedi: la richiesta muore
     * a meta' proprio perche' ha funzionato. */
    const ponte = unPonte({
      prendi: async (dove) => {
        if (dove.endsWith("/rebuild")) throw new Error("socket hang up");
        return risposta({});
      },
    });
    assert.deepEqual(await ponte.rifalla(), { chiesto: true });
  });
});

describe("solo l'ultima release, solo in avanti", () => {
  const conLaCartella = () =>
    attrezziFinti({ ci: ["/addons/gdahome", "/addons/gdahome/config.yaml"] });

  it("una release uguale o piu' vecchia non entra: non si torna indietro", async () => {
    for (const tag of ["v0.15.0", "v0.14.9"]) {
      const attrezzi = conLaCartella();
      const ponte = unPonte({ attrezzi, prendi: gitHub({ tag, pacco: unPacco(tag.slice(1)) }) });
      await assert.rejects(() => ponte.porta(), /non si torna indietro/, tag);
      assert.ok(!attrezzi.mosse.some((mossa) => mossa.includes("/addons/")), tag);
    }
  });

  it("un tag che non e' un numero di versione non e' una release da portare dentro", async () => {
    const ponte = unPonte({ prendi: gitHub({ tag: "main" }) });
    assert.equal((await ponte.stato()).nuova, "");
    await assert.rejects(() => ponte.porta(), /non so qual e' l'ultima versione/);
  });

  it("il manifesto nel pacchetto deve dire la versione della release", async () => {
    const attrezzi = conLaCartella();
    const ponte = unPonte({ attrezzi, prendi: gitHub({ pacco: unPacco("0.17.0") }) });
    await assert.rejects(() => ponte.porta(), /il pacchetto dice 0\.17\.0/);
    assert.ok(!attrezzi.mosse.some((mossa) => mossa.startsWith("scompatta")));
  });
});

describe("il pacchetto si apre senza uscire dalla sua cartella", () => {
  const storti = [
    ["un percorso assoluto", { nome: "/etc/cron.d/ponte", corpo: "x" }],
    ["un `..`", { nome: `${TESTA}/ponte/../../fuori.txt`, corpo: "x" }],
    [
      "un collegamento simbolico nel ponte",
      { nome: `${TESTA}/ponte/src/via`, tipo: "2", collegamento: "/etc" },
    ],
    [
      "un collegamento fisico nel ponte",
      { nome: `${TESTA}/ponte/src/duro`, tipo: "1", collegamento: "/etc/passwd" },
    ],
    ["un dispositivo nel ponte", { nome: `${TESTA}/ponte/src/disco`, tipo: "3" }],
  ];

  for (const [come, voce] of storti) {
    it(`${come} fa rifiutare tutto il pacchetto`, async () => {
      const attrezzi = attrezziFinti({ ci: ["/addons/gdahome", "/addons/gdahome/config.yaml"] });
      const ponte = unPonte({
        attrezzi,
        prendi: gitHub({ pacco: unPacco("0.16.0", { ancora: [voce] }) }),
      });
      await assert.rejects(() => ponte.porta());
      assert.ok(!attrezzi.mosse.some((mossa) => mossa.startsWith("scompatta")), come);
      assert.ok(!attrezzi.mosse.includes("togli /addons/gdahome"), come);
    });
  }

  it("un pacchetto con due cartelle in testa non ha la forma giusta", () => {
    const tar = unTar([
      { nome: `${TESTA}/ponte/config.yaml`, corpo: manifesto("0.16.0") },
      { nome: "altro/ponte/config.yaml", corpo: manifesto("0.16.0") },
    ]);
    assert.throws(() => guardaIlPacco(tar), /forma/);
  });

  it("un'intestazione rovinata non si legge", () => {
    const tar = unTar([{ nome: `${TESTA}/ponte/config.yaml`, corpo: manifesto("0.16.0") }]);
    tar[0] ^= 0xff;
    assert.throws(() => guardaIlPacco(tar), /rovinato/);
  });

  it("aperto davvero: esce solo la cartella del ponte, e senza i bit speciali", async () => {
    const dove = mkdtempSync(join(tmpdir(), "ponte-pacco-"));
    try {
      const archivio = join(dove, "pacco.tar.gz");
      writeFileSync(archivio, unPacco("0.16.0"));
      const dentro = join(dove, "fuori");
      await ATTREZZI.cartella(dentro);
      await ATTREZZI.scompatta(archivio, dentro);
      assert.deepEqual(readdirSync(join(dentro, TESTA)), ["ponte"]);
      assert.equal(
        versioneNelManifesto(readFileSync(join(dentro, TESTA, "ponte", "config.yaml"), "utf8")),
        "0.16.0",
      );
      const modo = statSync(join(dentro, TESTA, "ponte", "run.sh")).mode;
      assert.equal(modo & 0o4000, 0, "niente setuid");
      assert.equal(modo & 0o100, 0o100, "ma si esegue");
    } finally {
      rmSync(dove, { recursive: true, force: true });
    }
  });
});

describe("la firma, quando il ponte conosce la chiave", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const chiave = publicKey.export({ type: "spki", format: "pem" });
  const firmato = (byte) =>
    sign(null, Buffer.from(improntaDi(byte), "utf8"), privateKey).toString("base64");

  const unPonteConLaChiave = (prendi, attrezzi) =>
    new Aggiornamento({
      mia: "0.15.0",
      segno: "unSegno",
      addon: "/addons",
      passaggio: "/passaggio/ponte-nuovo",
      attrezzi:
        attrezzi ?? attrezziFinti({ ci: ["/addons/gdahome", "/addons/gdahome/config.yaml"] }),
      fetch: prendi,
      chiave,
      adesso: () => 1000,
    });

  it("una firma che torna fa entrare il pacchetto della release", async () => {
    const pacco = unPacco();
    const chieste = [];
    const ponte = unPonteConLaChiave(
      gitHub({ pacco, allegati: [IL_PACCO, LA_FIRMA], firma: firmato(pacco), chieste }),
    );
    assert.equal(await ponte.porta(), "0.16.0");
    /* Il pacchetto e' quello firmato, non quello che GitHub rifa' dal tag. */
    assert.ok(chieste.some((una) => una.endsWith(`/${IL_PACCO}`)));
    assert.ok(!chieste.some((una) => una.includes("/tarball/")));
  });

  it("una firma che non torna ferma tutto", async () => {
    const attrezzi = attrezziFinti({ ci: ["/addons/gdahome", "/addons/gdahome/config.yaml"] });
    const ponte = unPonteConLaChiave(
      gitHub({ allegati: [IL_PACCO, LA_FIRMA], firma: firmato(Buffer.from("altro")) }),
      attrezzi,
    );
    await assert.rejects(() => ponte.porta(), /la firma del pacchetto non torna/);
    assert.ok(!attrezzi.mosse.includes("togli /addons/gdahome"));
  });

  it("con la chiave, una release senza firma non entra", async () => {
    const ponte = unPonteConLaChiave(gitHub());
    await assert.rejects(() => ponte.porta(), /non e' firmata/);
  });

  it("senza la chiave si va avanti, e la console lo sa", async () => {
    const ponte = unPonte({ prendi: gitHub() });
    assert.equal((await ponte.stato()).firma, false);
  });
});
