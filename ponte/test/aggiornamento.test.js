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
 * - che un Supervisor che non lascia ricostruire non passi per riuscito.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  Aggiornamento,
  confrontaLeVersioni,
  pezziDellaVersione,
  versioneNelManifesto,
} from "../src/aggiornamento.js";

const manifesto = (versione) => `name: Il ponte\nversion: "${versione}"\nslug: ponte\n`;

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
const risposta = ({ ok = true, status = 200, testo = "", byte = null } = {}) => ({
  ok,
  status,
  text: async () => testo,
  arrayBuffer: async () => byte ?? new Uint8Array([1, 2, 3]).buffer,
});

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
    const ponte = unPonte({
      prendi: async () => risposta({ testo: manifesto("0.16.0") }),
    });
    const stato = await ponte.stato();
    assert.equal(stato.locale, true);
    assert.equal(stato.mia, "0.15.0");
    assert.equal(stato.nuova, "0.16.0");
    assert.equal(stato.cE, true);
  });

  it("quando e' la stessa, non c'e' nessun bottone da premere", async () => {
    const ponte = unPonte({
      prendi: async () => risposta({ testo: manifesto("0.15.0") }),
    });
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
      prendi: async () => {
        quante += 1;
        return risposta({ testo: manifesto("0.16.0") });
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
    const ponte = unPonte({
      attrezzi,
      prendi: async () => risposta({}),
    });
    assert.equal(await ponte.porta(), "0.16.0");

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
    const ponte = unPonte({ attrezzi, prendi: async () => risposta({}) });
    await assert.rejects(() => ponte.porta(), /manca src\/index\.js/);
    /* E soprattutto: la cartella di prima e' ancora al suo posto. */
    assert.ok(attrezzi.esistono.has("/addons/gdahome/config.yaml"));
    assert.ok(!attrezzi.mosse.includes("togli /addons/gdahome"));
  });

  it("se GitHub non da' il pacchetto non si tocca niente", async () => {
    const attrezzi = attrezziFinti({ ci: ["/addons/gdahome", "/addons/gdahome/config.yaml"] });
    const ponte = unPonte({
      attrezzi,
      prendi: async () => risposta({ ok: false, status: 500 }),
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
